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
  // 1 000 000 µs (cena parada, com o batimento de 1 Hz sendo a única fonte).
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

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas ? 1 : 0);
