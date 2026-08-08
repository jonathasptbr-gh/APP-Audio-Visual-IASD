// O ORÁCULO DO MUXER fMP4 do espelho (`assets/web/espelho/fmp4.js`), em Node
// puro: sem navegador, sem rede, determinístico.
//
// ## Por que ele é o teste SEM `continue-on-error`
//
// Porque um erro aqui NÃO dá erro. Um `tfdt` truncado em 32 bits, um
// `data_offset` deslocado de quatro bytes, um `sample_flags` de delta anunciado
// como chave — nada disso lança exceção em lugar nenhum: dá tela preta, ou lixo
// verde, na frente da congregação, com todos os contadores subindo. É o mesmo
// argumento de `tools/sidx.test.mjs` (lá se LÊ um box, aqui se ESCREVE), e este
// arquivo é copiado do molde dele de propósito: os boxes são construídos pelo
// código do app e RE-LIDOS aqui, byte a byte, contra a ISO/IEC 14496-12.
//
// O navegador é o outro oráculo, e ele responde outra pergunta — se o
// `buffered` sai inteiro (`tools/espelho-cliente.test.mjs`). Os dois são
// necessários: este pega o byte errado, aquele pega a semântica errada.
//
//   node tools/fmp4.test.mjs
import fs from 'node:fs';

const src = fs.readFileSync(
  new URL('../app/src/main/assets/web/espelho/fmp4.js', import.meta.url), 'utf8');
const window = {};
new Function('window', src)(window);
const F = window.AVFmp4;

let falhas = 0;
function ok(cond, msg, obtido) {
  if (cond) { console.log('ok      ' + msg); return; }
  console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : ''));
  falhas++;
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  ok(ja === jb, msg, ja + '\n        esperado: ' + jb);
}

// ---------------------------------------------------------------------------
// UM LEITOR DE BOXES ESCRITO AQUI, do zero.
//
// Reusar qualquer coisa do arquivo sob teste faria o teste concordar com o
// defeito. Isto é vinte linhas e é a única forma de a asserção significar algo.
// ---------------------------------------------------------------------------
function lerCaixas(buf, ini = 0, fim = buf.length) {
  const saida = [];
  let p = ini;
  while (p + 8 <= fim) {
    const tam = buf.readUInt32BE(p);
    const tipo = buf.toString('latin1', p + 4, p + 8);
    if (tam < 8 || p + tam > fim) { saida.push({ tipo, tam, quebrado: true, ini: p }); break; }
    saida.push({ tipo, tam, ini: p, corpo: buf.subarray(p + 8, p + tam) });
    p += tam;
  }
  return saida;
}

// Caminho tipo `moov/trak/mdia/mdhd`. Devolve o corpo do box, ou null.
function achar(buf, caminho) {
  let atual = lerCaixas(buf);
  let corpo = null;
  for (const passo of caminho.split('/')) {
    const c = atual.find((x) => x.tipo === passo);
    if (!c || c.quebrado) return null;
    corpo = c.corpo;
    atual = lerCaixas(corpo);
  }
  return corpo;
}

// Percorre a árvore inteira conferindo que todo `size` fecha exatamente com o
// pai. É o teste que pega um `juntar` esquecido em qualquer lugar do arquivo.
function arvoreCoerente(buf, ini = 0, fim = buf.length, prof = 0) {
  const CONTEINERES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf', 'mvex', 'moof', 'traf']);
  let p = ini;
  while (p < fim) {
    if (p + 8 > fim) return 'sobrou lixo de ' + (fim - p) + ' byte(s) em profundidade ' + prof;
    const tam = buf.readUInt32BE(p);
    const tipo = buf.toString('latin1', p + 4, p + 8);
    if (tam < 8) return 'box ' + tipo + ' com tamanho ' + tam;
    if (p + tam > fim) return 'box ' + tipo + ' (' + tam + ') estoura o pai';
    if (CONTEINERES.has(tipo)) {
      const e = arvoreCoerente(buf, p + 8, p + tam, prof + 1);
      if (e) return tipo + ' > ' + e;
    }
    p += tam;
  }
  return null;
}

const b = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);

// ---------------------------------------------------------------------------
// UM SPS SINTÉTICO, escrito bit a bit a partir da ITU-T H.264 §7.3.2.1.1
//
// Não é um SPS "de memória" copiado de algum lugar: é construído aqui com um
// escritor Exp-Golomb próprio, para que o teste do PARSER não dependa de eu ter
// decorado bytes certos. Perfil 66 (Baseline) mantém o SPS no ramo curto —
// o ramo longo (perfis High) é exercitado logo abaixo com `croma`.
// ---------------------------------------------------------------------------
class EscritorDeBits {
  constructor() { this.bits = []; }
  u(n, v) { for (let i = n - 1; i >= 0; i--) this.bits.push((v >> i) & 1); }
  bit(v) { this.bits.push(v & 1); }
  ue(v) {
    const n = v + 1;
    const largura = Math.floor(Math.log2(n));
    for (let i = 0; i < largura; i++) this.bits.push(0);
    this.u(largura + 1, n);
  }
  bytes() {
    const bits = this.bits.slice();
    bits.push(1);                                   // rbsp_stop_one_bit
    while (bits.length % 8) bits.push(0);
    const out = Buffer.alloc(bits.length / 8);
    for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 1 << (7 - (i & 7));
    return out;
  }
}

function spsSintetico({ perfil = 66, nivel = 31, larguraMb, alturaMb, recorte = [0, 0, 0, 0], croma = 1 }) {
  const w = new EscritorDeBits();
  w.u(8, perfil);
  w.u(8, 0);                                        // constraint flags
  w.u(8, nivel);
  w.ue(0);                                          // seq_parameter_set_id
  const perfilAlto = [100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(perfil);
  if (perfilAlto) {
    w.ue(croma);
    if (croma === 3) w.bit(0);                      // separate_colour_plane_flag
    w.ue(0); w.ue(0);                               // bit_depth_*_minus8
    w.bit(0);                                       // qpprime_y_zero_transform_bypass_flag
    w.bit(0);                                       // seq_scaling_matrix_present_flag
  }
  w.ue(0);                                          // log2_max_frame_num_minus4
  w.ue(0);                                          // pic_order_cnt_type = 0
  w.ue(4);                                          // log2_max_pic_order_cnt_lsb_minus4
  w.ue(1);                                          // max_num_ref_frames
  w.bit(0);                                         // gaps_in_frame_num_value_allowed_flag
  w.ue(larguraMb - 1);
  w.ue(alturaMb - 1);
  w.bit(1);                                         // frame_mbs_only_flag
  w.bit(1);                                         // direct_8x8_inference_flag
  const temRecorte = recorte.some((x) => x > 0);
  w.bit(temRecorte ? 1 : 0);
  if (temRecorte) recorte.forEach((x) => w.ue(x));
  return Buffer.concat([Buffer.from([0x67]), w.bytes()]);
}

// ---------------------------------------------------------------------------
// 1. Annex-B → comprimento-prefixado
// ---------------------------------------------------------------------------
const START4 = [0, 0, 0, 1];
const START3 = [0, 0, 1];

eq(F.nais(Buffer.from([...START4, 9, 0x10, ...START3, 0x65, 1, 2, 3])).map((x) => Array.from(x)),
  [[9, 0x10], [0x65, 1, 2, 3]],
  'start code de 3 e de 4 bytes na mesma passada');

eq(Array.from(F.anexoBParaAvcc(Buffer.from([...START4, 0x65, 0xaa, 0xbb]))),
  [0, 0, 0, 3, 0x65, 0xaa, 0xbb],
  'AVCC: prefixo de 4 bytes com o comprimento da NALU');

eq(Array.from(F.anexoBParaAvcc(Buffer.from([...START4, 0x67, 1, ...START4, 0x68, 2, 3]))),
  [0, 0, 0, 2, 0x67, 1, 0, 0, 0, 3, 0x68, 2, 3],
  'duas NALUs: dois comprimentos, nenhum start code sobrevive');

// Os zeros de enchimento do fim não podem virar bytes da NALU: eles são o
// quarto byte do start code seguinte ou `cabac_zero_words`.
eq(Array.from(F.anexoBParaAvcc(Buffer.from([...START3, 0x65, 0x80, 0, 0, ...START3, 0x41, 0x80]))),
  [0, 0, 0, 2, 0x65, 0x80, 0, 0, 0, 2, 0x41, 0x80],
  'zeros antes do start code seguinte não entram na NALU');

eq(Array.from(F.anexoBParaAvcc(Buffer.from([1, 2, 3]))), [],
  'lixo sem start code nenhum vira zero NALU (e não estoura)');

// ---------------------------------------------------------------------------
// 2. `separarParametros` — por TIPO de NALU, nunca por posição
// ---------------------------------------------------------------------------
{
  const aud = [0x09, 0x10];
  const sei = [0x06, 0x05, 0x00, 0x80];
  const sps = [0x67, 0x42, 0xe0, 0x1e, 0x99];
  const pps = [0x68, 0xce, 0x3c, 0x80];
  const csd = Buffer.from([...START4, ...aud, ...START4, ...sps, ...START3, ...sei, ...START4, ...pps]);
  const par = F.separarParametros(csd);
  eq(Array.from(par.sps || []), sps, 'o SPS é achado por nal_unit_type 7, com AUD na frente');
  eq(Array.from(par.pps || []), pps, 'o PPS é achado por nal_unit_type 8, com SEI no meio');
  ok(F.separarParametros(Buffer.from([...START4, ...aud])).sps === null,
    'csd sem SPS devolve null (e quem chamou tem de dizer isso)');
}

// ---------------------------------------------------------------------------
// 3. Anti-emulação e o leitor de bits do SPS
// ---------------------------------------------------------------------------
eq(Array.from(F.semEmulacao(Buffer.from([0, 0, 3, 1, 0, 0, 3, 0, 7]))), [0, 0, 1, 0, 0, 0, 7],
  'os bytes 0x03 de anti-emulação saem antes da leitura de bits');
eq(Array.from(F.semEmulacao(Buffer.from([0, 3, 1, 3]))), [0, 3, 1, 3],
  'e um 0x03 que NÃO vem depois de dois zeros fica onde está');

// ---------------------------------------------------------------------------
// 4. Dimensões a partir do SPS — é o único jeito de o CLIENTE saber o tamanho
// ---------------------------------------------------------------------------
eq(F.dimensoesDe(spsSintetico({ larguraMb: 80, alturaMb: 45 })), { larg: 1280, alt: 720 },
  '1280x720 (80x45 macroblocos) sai do SPS');
eq(F.dimensoesDe(spsSintetico({ larguraMb: 120, alturaMb: 68, recorte: [0, 0, 0, 4] })),
  { larg: 1920, alt: 1080 },
  '1920x1080 com o recorte de 8 linhas que 68 macroblocos exigem');
eq(F.dimensoesDe(spsSintetico({ perfil: 100, larguraMb: 80, alturaMb: 45 })), { larg: 1280, alt: 720 },
  'perfil High (100) percorre o ramo longo do SPS e chega no mesmo tamanho');
ok(F.dimensoesDe(Buffer.from([0x67, 0x42])) === null,
  'um SPS truncado devolve null em vez de estourar (o chamador cai na reserva)');

eq(F.codecDe(Buffer.from([0x67, 0x42, 0xe0, 0x1e])), 'avc1.42E01E',
  'a string de codec sai dos três bytes do SPS');
eq(F.codecDe(Buffer.from([0x67, 0x64, 0x00, 0x1f])), 'avc1.64001F',
  'e um perfil High vira 64001F (não 640,0,31)');

// ---------------------------------------------------------------------------
// 5. O SEGMENTO DE INICIALIZAÇÃO
// ---------------------------------------------------------------------------
const SPS = spsSintetico({ larguraMb: 80, alturaMb: 45 });
const PPS = Buffer.from([0x68, 0xce, 0x3c, 0x80]);
const CSD = Buffer.concat([Buffer.from(START4), SPS, Buffer.from(START4), PPS]);

const init = F.initVideo(CSD);
ok(!!init, 'initVideo devolve um descritor para um csd bem formado');
const bi = b(init.bytes);

ok(arvoreCoerente(bi) === null, 'toda caixa do init fecha com o pai', arvoreCoerente(bi));
eq(lerCaixas(bi).map((c) => c.tipo), ['ftyp', 'moov'], 'o init é ftyp + moov, nesta ordem');
eq(init.mime, 'video/mp4; codecs="avc1.42001F"', 'o mime carrega o codec derivado do SPS');
eq([init.larg, init.alt], [1280, 720], 'as dimensões do init vieram do SPS');

{
  const mdhd = b(achar(bi, 'moov/trak/mdia/mdhd'));
  ok(!!mdhd, 'o moov tem trak/mdia/mdhd');
  eq(mdhd.readUInt32BE(12), 1000000,
    'timescale da faixa = 1 000 000 (µs): o carimbo do MediaCodec entra VERBATIM');
  eq(mdhd.readUInt32BE(16), 0, 'duration = 0 — ao vivo não tem duração');
}
{
  const trex = b(achar(bi, 'moov/mvex/trex'));
  ok(!!trex, 'o moov tem mvex/trex (sem ele nenhum moof é aceito)');
  eq(trex.readUInt32BE(4), 1, 'trex aponta para a faixa 1');
}
{
  const tkhd = b(achar(bi, 'moov/trak/tkhd'));
  eq(tkhd.readUInt32BE(0) & 0xffffff, 3, 'tkhd flags = 3 (track_enabled | in_movie)');
  eq([tkhd.readUInt32BE(76) / 65536, tkhd.readUInt32BE(80) / 65536], [1280, 720],
    'tkhd carrega largura e altura em 16.16');
}
{
  const stsd = b(achar(bi, 'moov/trak/mdia/minf/stbl/stsd'));
  const entradas = lerCaixas(stsd, 8);
  eq(entradas.map((c) => c.tipo), ['avc1'], 'a sample entry é avc1');
  const avc1 = entradas[0].corpo;
  eq([avc1.readUInt16BE(24), avc1.readUInt16BE(26)], [1280, 720], 'a avc1 declara 1280x720');
  const avcc = lerCaixas(avc1, 78).find((c) => c.tipo === 'avcC');
  ok(!!avcc, 'e dentro dela vem o avcC (no deslocamento 78 da VisualSampleEntry)');
  const r = avcc.corpo;
  eq(r[0], 1, 'avcC: configurationVersion = 1');
  eq([r[1], r[2], r[3]], [SPS[1], SPS[2], SPS[3]], 'avcC: perfil/compat/nível copiados do SPS');
  eq(r[4] & 3, 3, 'avcC: lengthSizeMinusOne = 3 — bate com o prefixo de 4 bytes do AVCC');
  eq(r[5] & 0x1f, 1, 'avcC: um SPS');
  eq(r.readUInt16BE(6), SPS.length, 'avcC: comprimento do SPS');
  eq(Array.from(r.subarray(8, 8 + SPS.length)), Array.from(SPS), 'avcC: os bytes do SPS');
  const oPps = 8 + SPS.length;
  eq(r[oPps], 1, 'avcC: um PPS');
  eq(Array.from(r.subarray(oPps + 3, oPps + 3 + PPS.length)), Array.from(PPS), 'avcC: os bytes do PPS');
}
ok(F.initVideo(Buffer.from([...START4, 0x09, 0x10])) === null,
  'um csd sem SPS/PPS não vira init nenhum');

// A COSTURA DE CODEC: o `moov` não sabe o que é H.264. É por ela que o teste de
// navegador consegue um veredito num Chromium sem codecs proprietários.
{
  const falsa = F.caixa('vp09', F.b32(0));
  const outro = b(F.initCom(falsa, 640, 360));
  ok(arvoreCoerente(outro) === null, 'initCom monta um moov coerente com QUALQUER sample entry');
  eq(lerCaixas(b(achar(outro, 'moov/trak/mdia/minf/stbl/stsd')), 8).map((c) => c.tipo), ['vp09'],
    'e a sample entry que entrou é a que sai — nada de avc1 embutido no moov');
}

// ---------------------------------------------------------------------------
// 6. O FRAGMENTO — moof + mdat
// ---------------------------------------------------------------------------
{
  const dados = Buffer.from([0, 0, 0, 4, 0x65, 1, 2, 3]);
  // Acima de 2³² µs de propósito: 5 000 s de sessão. Um `tfdt` truncado em 32
  // bits ANDA PARA TRÁS e quebra a MediaSource em silêncio.
  const DTS = 5000123456;
  const frag = b(F.mediaSegment({ seq: 7, dts: DTS, dur: 33333, chave: true, dados }));
  ok(arvoreCoerente(frag) === null, 'toda caixa do fragmento fecha com o pai', arvoreCoerente(frag));
  const caixas = lerCaixas(frag);
  eq(caixas.map((c) => c.tipo), ['moof', 'mdat'], 'o fragmento é moof + mdat, nesta ordem');

  eq(b(achar(frag, 'moof/mfhd')).readUInt32BE(4), 7, 'mfhd carrega o número de sequência');

  const tfhd = b(achar(frag, 'moof/traf/tfhd'));
  eq(tfhd.readUInt32BE(0) & 0xffffff, 0x020000,
    'tfhd flags = default-base-is-moof (o data_offset conta deste moof)');
  eq(tfhd.readUInt32BE(4), 1, 'tfhd aponta para a faixa 1');

  const tfdt = b(achar(frag, 'moof/traf/tfdt'));
  eq(tfdt[0], 1, 'tfdt é version 1 (64 bits) — 32 bits estouram em 72 min de µs');
  eq(tfdt.readUInt32BE(4) * 4294967296 + tfdt.readUInt32BE(8), DTS,
    'tfdt = o carimbo do MediaCodec, VERBATIM, acima de 2^32');

  const trun = b(achar(frag, 'moof/traf/trun'));
  eq(trun.readUInt32BE(0) & 0xffffff, 0x000701,
    'trun flags = data-offset + sample-duration + sample-size + sample-flags');
  eq(trun.readUInt32BE(4), 1, 'trun: uma amostra por fragmento');
  eq(trun.readInt32BE(8), caixas[0].tam + 8,
    'trun data_offset = tamanho do moof + o cabeçalho do mdat (aponta para o 1º byte da amostra)');
  eq(trun.readUInt32BE(12), 33333, 'trun sample_duration');
  eq(trun.readUInt32BE(16), dados.length, 'trun sample_size = os bytes da amostra');
  eq(trun.readUInt32BE(20), 0x02000000, 'trun sample_flags de QUADRO-CHAVE');

  eq(Array.from(caixas[1].corpo), Array.from(dados), 'o mdat carrega a amostra intacta');

  // O deslocamento tem de APONTAR mesmo. É a asserção que pega um `juntar`
  // esquecido em qualquer box do moof, e nenhum navegador diria por quê.
  eq(Array.from(frag.subarray(trun.readInt32BE(8), trun.readInt32BE(8) + dados.length)),
    Array.from(dados), 'e o data_offset aponta EXATAMENTE para o primeiro byte da amostra');

  const delta = b(F.mediaSegment({ seq: 8, dts: DTS, dur: 1, chave: false, dados }));
  eq(b(achar(delta, 'moof/traf/trun')).readUInt32BE(20), 0x01010000,
    'um quadro delta é marcado como non-sync (senão o navegador decodifica dele e pinta lixo)');
}

// ---------------------------------------------------------------------------
// 7. O ATRASO DE UM QUADRO — o invariante que decide se o cliente toca (D3)
// ---------------------------------------------------------------------------
{
  const m = F.criar();
  eq(!!m.csd(CSD), true, 'o muxer aceita o csd e monta o init');

  const chave = Buffer.from([...START4, 0x65, 1, 2, 3]);
  const inter = Buffer.from([...START4, 0x41, 9]);

  const f0 = m.quadro({ ptsUs: 1000, chave: true, dados: chave });
  ok(f0 === null, 'o PRIMEIRO quadro não sai: a duração dele ainda não é conhecida');
  ok(m.pendente(), 'ele fica retido');

  // Intervalos deliberadamente DESIGUAIS: 33 333 µs (cena em movimento) e
  // 125 000 µs (cena parada, com o batimento de 8 Hz sendo a única fonte).
  // É exatamente o caso que um `sample_duration` fixo transformaria em buraco.
  const f1 = b(m.quadro({ ptsUs: 34333, chave: false, dados: inter }));
  const f2 = b(m.quadro({ ptsUs: 1034333, chave: false, dados: inter }));
  const f3 = b(m.esvaziar(500000));

  const t = (f) => {
    const d = b(achar(f, 'moof/traf/tfdt'));
    const u = b(achar(f, 'moof/traf/trun'));
    return { dts: d.readUInt32BE(4) * 4294967296 + d.readUInt32BE(8), dur: u.readUInt32BE(12) };
  };
  eq(t(f1), { dts: 1000, dur: 33333 }, 'o 1º fragmento sai com a duração MEDIDA até o 2º quadro');
  eq(t(f2), { dts: 34333, dur: 1000000 }, 'e o 2º com 1 s inteiro — a cena parou, e isso é a VERDADE');
  eq(t(b(f3)), { dts: 1034333, dur: 500000 }, 'esvaziar() fecha o pendente com a duração arbitrada');

  // A ASSERÇÃO QUE VALE POR TODAS: sem buraco. `fim(N) === início(N+1)` em toda
  // a sequência é a propriedade que o `buffered` do navegador vai enxergar como
  // UM intervalo só — e é ela que a v anterior deste desenho quebrava.
  const seq = [t(f1), t(f2), t(b(f3))];
  let colado = true;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i - 1].dts + seq[i - 1].dur !== seq[i].dts) colado = false;
  }
  ok(colado, 'NENHUM BURACO: o fim de cada amostra é o início da seguinte',
    JSON.stringify(seq));

  eq(b(achar(f1, 'moof/traf/trun')).readUInt32BE(20), 0x02000000,
    'a bandeira de chave viaja com o quadro a que pertence, não com o que a emitiu');

  // Números de sequência ESTRITAMENTE crescentes: um `mfhd` repetido faz o
  // navegador tratar o fragmento como retransmissão.
  const seqs = [f1, f2, b(f3)].map((f) => b(achar(f, 'moof/mfhd')).readUInt32BE(4));
  eq(seqs, [1, 2, 3], 'os números de sequência crescem de um em um');
}

// A DESCONTINUIDADE fecha o buraco em vez de abri-lo: um quadro retido cuja
// próxima notícia chega segundos depois vira uma amostra LONGA. A imagem ficou
// congelada aqueles segundos — escrever isso é a verdade, e é o que mantém o
// `buffered` inteiro.
{
  const m = F.criar();
  m.csd(CSD);
  const q = Buffer.from([...START4, 0x65, 1]);
  m.quadro({ ptsUs: 0, chave: true, dados: q });
  const f = b(m.quadro({ ptsUs: 4000000, chave: true, dados: q }));
  eq(b(achar(f, 'moof/traf/trun')).readUInt32BE(12), 4000000,
    'depois de 4 s de encoder remontado, a amostra retida dura 4 s (e não abre buraco)');
}

// Um PTS que não avança não pode virar amostra de duração zero — é um buraco
// disfarçado, e o encoder repetindo o quadro no mesmo carimbo é caso real.
{
  const m = F.criar();
  m.csd(CSD);
  const q = Buffer.from([...START4, 0x65, 1]);
  m.quadro({ ptsUs: 500, chave: true, dados: q });
  const f = b(m.quadro({ ptsUs: 500, chave: false, dados: q }));
  eq(b(achar(f, 'moof/traf/trun')).readUInt32BE(12), 1, 'PTS repetido vira duração 1 µs, nunca 0');
}

// `descartar()` joga o retido fora SEM emitir — é o que se faz quando o cliente
// vai recomeçar com uma MediaSource nova.
{
  const m = F.criar();
  m.csd(CSD);
  m.quadro({ ptsUs: 0, chave: true, dados: Buffer.from([...START4, 0x65, 1]) });
  m.descartar();
  ok(!m.pendente() && m.esvaziar(1000) === null, 'descartar() esvazia o pendente sem emitir nada');
}

// ---------------------------------------------------------------------------
// 8. A FAIXA DE SOM — `mp4a`/`esds` a partir do AudioSpecificConfig
//
// Os dois ASC abaixo são ESCRITOS AQUI bit a bit (ISO/IEC 14496-3 §1.6.2.1),
// não copiados de memória: 5 bits de audioObjectType, 4 de
// samplingFrequencyIndex, 4 de channelConfiguration.
//
//   AAC-LC (2) · 48000 (índice 3) · 2 canais → 00010 0011 0010 0 → 0x11 0x90
//   AAC-LC (2) · 44100 (índice 4) · 1 canal  → 00010 0100 0001 0 → 0x12 0x08
//
// Um erro de um bit aqui não lança nada em lugar nenhum: dá áudio no dobro da
// velocidade, ou faixa que o navegador ignora.
// ---------------------------------------------------------------------------
function ascSintetico(objeto, indice, canais) {
  const w = new EscritorDeBits();
  w.u(5, objeto);
  w.u(4, indice);
  w.u(4, canais);
  // Sem `rbsp_stop_one_bit`: o ASC não é RBSP. São 13 bits, completados com
  // zeros até fechar os dois bytes que o `csd-0` do MediaCodec entrega.
  const bits = w.bits.slice();
  while (bits.length % 8) bits.push(0);
  const out = Buffer.alloc(bits.length / 8);
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 1 << (7 - (i & 7));
  return out;
}

const ASC48 = ascSintetico(2, 3, 2);
eq(Array.from(ASC48), [0x11, 0x90], 'o ASC sintético de 48 kHz estéreo é 0x11 0x90');

eq(F.lerAsc(ASC48), { objeto: 2, taxa: 48000, canais: 2, codec: 'mp4a.40.2' },
  'lerAsc: AAC-LC, 48 kHz, estéreo');
eq(F.lerAsc(ascSintetico(2, 4, 1)), { objeto: 2, taxa: 44100, canais: 1, codec: 'mp4a.40.2' },
  'lerAsc: 44,1 kHz mono — a taxa vem do ASC, nunca de um chute');
ok(F.lerAsc(Buffer.from([0x11])) === null,
  'um ASC truncado devolve null (e o cliente segue MUDO, com a imagem intacta)');
// Índice 13 é reservado, não é taxa. Aceitá-lo daria um `mdhd` com timescale 0.
ok(F.lerAsc(ascSintetico(2, 13, 2)) === null,
  'um samplingFrequencyIndex reservado devolve null em vez de timescale zero');

const som = F.initAudio(ASC48);
ok(!!som, 'initAudio devolve um descritor para um ASC bem formado');
const bs = b(som.bytes);

ok(arvoreCoerente(bs) === null, 'toda caixa do init de som fecha com o pai', arvoreCoerente(bs));
eq(lerCaixas(bs).map((c) => c.tipo), ['ftyp', 'moov'], 'o init de som também é ftyp + moov');
eq(som.mime, 'audio/mp4; codecs="mp4a.40.2"', 'o mime de áudio carrega o codec derivado do ASC');
eq([som.taxa, som.canais, som.escala], [48000, 2, 48000],
  'taxa, canais e timescale saem todos do mesmo ASC');

{
  const mdhd = b(achar(bs, 'moov/trak/mdia/mdhd'));
  eq(mdhd.readUInt32BE(12), 48000,
    'timescale da faixa de som = a TAXA (1024 amostras por quadro, exato — em µs seriam 21333,33)');
  const hdlr = b(achar(bs, 'moov/trak/mdia/hdlr'));
  eq(hdlr.toString('latin1', 8, 12), 'soun', "handler_type = 'soun' (com 'vide' a faixa é ignorada)");
  const trex = b(achar(bs, 'moov/mvex/trex'));
  eq(trex.readUInt32BE(4), 2, 'trex do som aponta para a faixa 2');
  const tkhd = b(achar(bs, 'moov/trak/tkhd'));
  eq(tkhd.readUInt32BE(0) & 0xffffff, 3, 'tkhd de som também é track_enabled | in_movie');
  eq(tkhd.readUInt32BE(12), 2, 'tkhd do som é a faixa 2');
  eq([tkhd.readUInt32BE(76), tkhd.readUInt32BE(80)], [0, 0],
    'e ele NÃO reserva área de imagem (width/height zerados)');
  ok(!!lerCaixas(b(achar(bs, 'moov/trak/mdia/minf'))).find((c) => c.tipo === 'smhd'),
    "o minf de som traz 'smhd' (um 'vmhd' aqui não lança e não toca)");
}

{
  const stsd = b(achar(bs, 'moov/trak/mdia/minf/stbl/stsd'));
  const entradas = lerCaixas(stsd, 8);
  eq(entradas.map((c) => c.tipo), ['mp4a'], 'a sample entry de som é mp4a');
  const mp4a = entradas[0].corpo;
  eq(mp4a.readUInt16BE(16), 2, 'mp4a declara 2 canais');
  eq(mp4a.readUInt16BE(18), 16, 'mp4a declara amostras de 16 bits');
  eq(mp4a.readUInt32BE(24) / 65536, 48000, 'mp4a declara a taxa em 16.16');

  // O `esds` mora no deslocamento 28 da AudioSampleEntry. Um byte a mais ou a
  // menos nos campos "reserved" o desloca — e o navegador recusa o init inteiro
  // sem dizer por quê.
  const esds = lerCaixas(mp4a, 28).find((c) => c.tipo === 'esds');
  ok(!!esds, 'e dentro dela vem o esds (no deslocamento 28 da AudioSampleEntry)');

  // Os descritores, desmontados aqui — tag, comprimento base-128, corpo.
  const desc = (buf, o) => {
    const tag = buf[o];
    let p = o + 1;
    let tam = 0;
    for (;;) {
      const x = buf[p++];
      tam = tam * 128 + (x & 0x7f);
      if (!(x & 0x80)) break;
    }
    return { tag, tam, ini: p, corpo: buf.subarray(p, p + tam) };
  };
  const es = desc(esds.corpo, 4);                   // depois de version+flags do FullBox
  eq(es.tag, 0x03, 'esds: o primeiro descritor é o ES_Descriptor (tag 3)');
  eq(es.corpo.length, es.tam, 'esds: o comprimento do ES_Descriptor fecha com o corpo');
  eq(es.corpo.readUInt16BE(0), 2, 'esds: ES_ID = 2 (a faixa de som)');
  const dcd = desc(es.corpo, 3);
  eq(dcd.tag, 0x04, 'esds: dentro dele, o DecoderConfigDescriptor (tag 4)');
  eq(dcd.corpo[0], 0x40, 'esds: objectTypeIndication = 0x40 (MPEG-4 Audio)');
  eq(dcd.corpo[1] >> 2, 5, 'esds: streamType = 5 (AudioStream)');
  const dsi = desc(dcd.corpo, 13);
  eq(dsi.tag, 0x05, 'esds: e o DecoderSpecificInfo (tag 5)');
  eq(Array.from(dsi.corpo), Array.from(ASC48),
    'esds: o AudioSpecificConfig vai VERBATIM lá dentro — é ele que configura o decodificador');
  const sl = desc(es.corpo, 3 + 2 + dcd.tam);
  eq(sl.tag, 0x06, 'esds: e o SLConfigDescriptor fecha o ES_Descriptor');
  eq(sl.corpo[0], 0x02, 'esds: SLConfig predefinido = 2 (o valor de MP4)');
}

ok(F.initAudio(Buffer.from([0x11])) === null,
  'um ASC ilegível não vira init de som nenhum — o espelho fica mudo, não meio mudo');

// ---------------------------------------------------------------------------
// 9. O EIXO DE TEMPO DO ÁUDIO — 1024 amostras exatas, e nenhum buraco
//
// Os carimbos são os que o `EspelhoAudio.ptsAgora()` produz: `âncora +
// amostras × 1e6 / taxa`, com a divisão INTEIRA do Kotlin. A 48 kHz eles
// avançam 21333, 21333, 21334… — e é justamente essa alternância que uma
// duração convertida do carimbo ABSOLUTO transformaria em jitter de ±1 amostra
// por quadro.
// ---------------------------------------------------------------------------
{
  const m = F.criar();
  ok(m.quadroAudio({ ptsUs: 0, dados: Buffer.from([1]) }) === null,
    'sem csd de áudio o muxer não produz fragmento de som nenhum');

  eq(!!m.csdAudio(ASC48), true, 'o muxer aceita o csd de áudio e monta o init');

  const ANCORA = 5000000000;                        // 5 000 s: acima de 2³² µs, como no vídeo
  const pts = (n) => ANCORA + Math.floor(n * 1024 * 1000000 / 48000);
  const aac = Buffer.from([0x21, 0x10, 0x05, 0x20]);

  ok(m.quadroAudio({ ptsUs: pts(0), dados: aac }) === null,
    'o PRIMEIRO quadro AAC também não sai: ele é a âncora e ainda não tem duração');

  const frags = [];
  for (let n = 1; n <= 4; n++) {
    const f = m.quadroAudio({ ptsUs: pts(n), dados: aac });
    if (f) frags.push(b(f));
  }
  const ta = (f) => {
    const d = b(achar(f, 'moof/traf/tfdt'));
    const u = b(achar(f, 'moof/traf/trun'));
    return { dts: d.readUInt32BE(4) * 4294967296 + d.readUInt32BE(8), dur: u.readUInt32BE(12) };
  };
  const linha = frags.map(ta);
  eq(linha.map((x) => x.dur), [1024, 1024, 1024, 1024],
    'cada quadro AAC dura 1024 amostras EXATAS, apesar do carimbo em µs truncado');
  eq(linha[0].dts, Math.round(ANCORA * 48000 / 1000000),
    'o tfdt do primeiro quadro é a âncora convertida uma vez — o mesmo instante do vídeo, em segundos');
  let coladoA = true;
  for (let i = 1; i < linha.length; i++) {
    if (linha[i - 1].dts + linha[i - 1].dur !== linha[i].dts) coladoA = false;
  }
  ok(coladoA, 'NENHUM BURACO na faixa de som: o tfdt ACUMULA a duração já arredondada',
    JSON.stringify(linha));

  eq(b(achar(frags[0], 'moof/traf/tfhd')).readUInt32BE(4), 2,
    'e o fragmento de som aponta para a faixa 2 (o de vídeo continua na 1)');
  eq(b(achar(frags[0], 'moof/traf/trun')).readUInt32BE(20), 0x02000000,
    'todo quadro AAC é ponto de sincronismo — marcá-lo como delta deixaria o espelho mudo');
  eq(frags.map((f) => b(achar(f, 'moof/mfhd')).readUInt32BE(4)), [1, 2, 3, 4],
    'o som tem o PRÓPRIO contador de sequência (compartilhá-lo com o vídeo daria mfhd repetido)');
}

// O BLOCO DE PCM PERDIDO — a fila do `EspelhoAudio` enchendo salta o carimbo, e
// é exatamente aqui que o atraso de um quadro paga por si na faixa de som.
{
  const m = F.criar();
  m.csdAudio(ASC48);
  const aac = Buffer.from([0x21, 0x10]);
  m.quadroAudio({ ptsUs: 0, dados: aac });
  m.quadroAudio({ ptsUs: 21333, dados: aac });
  // 40 ms de PCM descartados: o carimbo seguinte salta ~61 ms em vez de 21.
  const f = b(m.quadroAudio({ ptsUs: 21333 + 61333, dados: aac }));
  eq(b(achar(f, 'moof/traf/trun')).readUInt32BE(12), 2944,
    'um bloco de PCM perdido vira uma amostra mais LONGA (2944 = 61,3 ms), e não um buraco');
}

{
  const m = F.criar();
  m.csdAudio(ASC48);
  const aac = Buffer.from([0x21]);
  m.quadroAudio({ ptsUs: 1000, dados: aac });
  const f = b(m.quadroAudio({ ptsUs: 1000, dados: aac }));
  eq(b(achar(f, 'moof/traf/trun')).readUInt32BE(12), 1,
    'carimbo de áudio repetido vira duração 1 amostra, nunca 0');
}

{
  const m = F.criar();
  m.csdAudio(ASC48);
  m.quadroAudio({ ptsUs: 0, dados: Buffer.from([0x21]) });
  ok(m.pendenteAudio(), 'o quadro AAC fica retido, como o de vídeo');
  m.descartarAudio();
  ok(!m.pendenteAudio() && m.esvaziarAudio(1024) === null,
    'descartarAudio() esvazia o retido sem emitir — é o que se faz ao soltar a faixa de som');
}

// AS DUAS FAIXAS SÃO INDEPENDENTES, e este é o teste que prova que soltar uma
// não mexe na outra: o vídeo continua contando as suas sequências.
{
  const m = F.criar();
  m.csd(CSD);
  m.csdAudio(ASC48);
  const q = Buffer.from([...START4, 0x65, 1]);
  m.quadroAudio({ ptsUs: 0, dados: Buffer.from([0x21]) });
  m.quadro({ ptsUs: 0, chave: true, dados: q });
  const fv = b(m.quadro({ ptsUs: 33333, chave: false, dados: q }));
  const fa = b(m.quadroAudio({ ptsUs: 21333, dados: Buffer.from([0x21]) }));
  eq(b(achar(fv, 'moof/mfhd')).readUInt32BE(4), 1, 'o vídeo começa a sequência dele em 1');
  eq(b(achar(fa, 'moof/mfhd')).readUInt32BE(4), 1, 'e o som começa a dele em 1, sem se atrapalharem');
  eq(b(achar(fv, 'moof/traf/tfhd')).readUInt32BE(4), 1, 'faixa 1 para a imagem');
  eq(b(achar(fa, 'moof/traf/tfhd')).readUInt32BE(4), 2, 'faixa 2 para o som');
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas ? 1 : 0);
