// ============================================================================
// O MUXER fMP4 DO ESPELHO — NALUs H.264 viram MP4 fragmentado, em JavaScript
// (P2 do `docs/ESPELHO-DE-PIXELS.md`)
//
// ## Por que existe um muxer aqui
//
// O celular manda pelo fio o que o `MediaCodec` produz: NALUs H.264 em
// Annex-B, com um carimbo de tempo em microssegundos (§5.2). Nenhum navegador
// come isso. O que TODO navegador come é `MediaSource` + MP4 fragmentado — e
// entre uma coisa e outra existe só o contêiner, que são cabeçalhos. Este
// arquivo é esse contêiner, e nada mais: ele não decodifica, não desenha, não
// mede tempo. Ele embrulha.
//
// A alternativa era `WebCodecs`, e ela está recusada NOMINALMENTE (§3.10): o
// `VideoDecoder` desenha num `<canvas>`, e canvas **não segura a tela acesa** —
// o wake lock de vídeo do Chromium exige um `HTMLMediaElement` tocando. Num
// telão de igreja 300 ms de latência não têm consumidor; a tela do tablet
// apagando no meio do hino tem consumidor imediato. Além disso o WebCodecs
// exclui Firefox Android e o navegador embarcado de TV (webOS 6.3.2 é Chromium
// 79), obrigaria a escrever a sincronia A/V que a `MediaSource` dá de graça —
// e **não economizaria este arquivo**, porque o piso continua sendo MSE.
//
// ## O INVARIANTE QUE DECIDE SE O CLIENTE TOCA OU ENGASGA: o atraso de um quadro
//
// O achado D3 da especificação, e ele custa cinco linhas de código e o recurso
// inteiro se for ignorado:
//
//   O `trun` de um fragmento carrega a DURAÇÃO da amostra. Com fragmento de um
//   quadro só e taxa de quadros VARIÁVEL — que é o nosso caso: numa cena parada
//   o encoder não emite nada e o batimento de 1 Hz produz um quadro por segundo,
//   numa cena com vídeo ele produz 30 — escrever essa duração na hora em que o
//   quadro chega significa CHUTAR quanto ele vai durar. Chutar 33 ms e o
//   seguinte vir 1 s depois abre um BURACO de 967 ms no `buffered`, e navegador
//   PARA em buraco de faixa bufferizada (é o problema que dash.js e Shaka
//   resolvem com gap-jumping escrito à mão).
//
//   Então: **só se emite o fragmento de N quando N+1 chega**, com
//   `sample_duration = pts(N+1) − pts(N)`. A duração deixa de ser palpite e
//   passa a ser medição. Custa até 1 s de latência numa cena PARADA (onde não há
//   nada para atrasar) e zero numa cena em movimento.
//
// O corolário que só aparece na segunda leitura: **o par também é feito
// ATRAVÉS de uma descontinuidade** — encoder remontado, reconexão do cliente,
// tudo. Um quadro pendente cuja próxima notícia chega 4 s depois vira uma
// amostra de 4 s, e o `buffered` continua sendo UM intervalo só. É exatamente o
// que aconteceu na tela: a imagem ficou congelada aqueles 4 s. Fechar o buraco
// com a verdade é melhor que abrir um buraco que trava o `<video>` para sempre.
// Quem cuida do outro lado dessa moeda (o cliente ficar 4 s atrás da borda) é a
// perseguição de borda do `espelho.js`, e ela está escrita lá.
//
// ## A costura de codec, e por que ela é pública
//
// Todo o `moov` — `mvhd`, `tkhd`, `mdhd`, `hdlr`, `minf`, `stbl`, `mvex/trex` —
// é INDEPENDENTE do codec. A única peça que sabe o que é H.264 é a *sample
// entry* (`avc1` + `avcC`). Essa separação já existiria de qualquer forma, mas
// ela é EXPORTADA (`initCom`) por um motivo concreto: o Chromium que o CI
// baixa é o build aberto, **sem codecs proprietários** — `isTypeSupported`
// devolve `false` para todo `avc1`. Sem a costura, `tools/espelho-cliente.test.mjs`
// não teria como pedir ao NAVEGADOR o veredito sobre `buffered`, que é a única
// coisa que nenhuma leitura de especificação entrega. Com ela, o teste monta uma
// *sample entry* de VP9 (que aquele Chromium aceita) e exercita o resto do
// muxer — que é justamente a parte onde o erro mora.
//
// ## O que este arquivo NÃO faz
//
// Não fala com a rede (é o `espelho.js`), não decide quando emitir (idem), não
// tem áudio: a faixa AAC (`mp4a`/`esds`) é a Entrega 3 e entra aqui como uma
// segunda `trak` quando P7 chegar. E não trata B-frames: o encoder é
// configurado com `KEY_MAX_B_FRAMES = 0`, logo `DTS == PTS` e o `trun` não
// precisa de `composition_time_offset` (§2.2).
//
// Referência de tudo o que se escreve abaixo: ISO/IEC 14496-12 (contêiner) e
// ISO/IEC 14496-15 (o `avcC`). O precedente da casa para manipular estes boxes
// é `shared/mse.js` (o leitor de `sidx`) — lá se LÊ, aqui se ESCREVE.
// ============================================================================
(function (global) {
  'use strict';

  // O relógio do sistema inteiro é o `presentationTimeUs` do `MediaCodec`, em
  // MICROSSEGUNDOS, e ele viaja no fio em todo quadro (§2.2/§5.2). Adotar a
  // mesma unidade como `timescale` da faixa é o que faz `tfdt` ser o carimbo
  // VERBATIM: zero arredondamento, zero deriva, e nenhuma linha de código
  // convertendo nada. Qualquer outro valor aqui reintroduz uma conta — e uma
  // conta reintroduz um erro de meio quadro que se acumula em duas horas.
  const ESCALA = 1000000;

  // O `mvhd` tem uma escala PRÓPRIA, e ela não precisa ser a da faixa: ela só
  // mede a duração do filme, que num fluxo ao vivo é 0 para sempre.
  const ESCALA_FILME = 1000;

  const FAIXA = 1;

  // Dimensões de reserva, usadas só quando o SPS não puder ser lido. Não é
  // chute: é a resolução que `EspelhoDisplay` fixa para a tela virtual
  // (§3.2, `LARG`/`ALT`), e ela é IMUTÁVEL durante a sessão. O caminho normal
  // deriva do próprio SPS — o cliente recebe só as NALUs e não tem outra fonte.
  const LARG_PADRAO = 1280;
  const ALT_PADRAO = 720;

  // --------------------------------------------------------------------------
  // Bytes: as primitivas. Nada aqui merece comentário além de um: TUDO é
  // big-endian, porque é assim que o ISO 14496-12 define todo campo numérico.
  // --------------------------------------------------------------------------

  function paraU8(x) {
    if (x instanceof Uint8Array) return x;
    if (x && x.buffer instanceof ArrayBuffer) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    return new Uint8Array(x || 0);
  }

  function juntar(partes) {
    let n = 0;
    for (let i = 0; i < partes.length; i++) n += partes[i].length;
    const saida = new Uint8Array(n);
    let o = 0;
    for (let i = 0; i < partes.length; i++) { saida.set(partes[i], o); o += partes[i].length; }
    return saida;
  }

  function b8() { return new Uint8Array(Array.prototype.slice.call(arguments)); }
  function b16(v) { return new Uint8Array([(v >>> 8) & 255, v & 255]); }
  function b32(v) {
    return new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
  }

  // 64 bits SEM `BigInt`. O `tfdt` de uma sessão de duas horas passa de
  // 7.2 × 10⁹ µs — muito além dos 2³² que um `>>>` comporta —, e um truncamento
  // aqui não daria erro nenhum: daria um `tfdt` que ANDA PARA TRÁS, e um `tfdt`
  // que anda para trás quebra a `MediaSource` em silêncio (§5.2). É o mesmo
  // modo de falhar do `| 0` que truncava os bytes do `bgProgress` (v5.137), e é
  // por isso que o oráculo de `tools/fmp4.test.mjs` usa um valor acima de 2³².
  // `Number` cobre até 2⁵³ µs = 285 anos; `BigInt` custaria conversão em cada
  // conta e não compra nada.
  function b64(v) {
    const alto = Math.floor(v / 4294967296);
    const baixo = v - alto * 4294967296;
    return juntar([b32(alto), b32(baixo)]);
  }

  // `[tamanho:u32][tipo:4cc][corpo]` — a estrutura de TODO box do formato.
  function caixa(tipo) {
    const corpo = juntar(Array.prototype.slice.call(arguments, 1));
    const cab = new Uint8Array(8);
    cab.set(b32(corpo.length + 8), 0);
    for (let i = 0; i < 4; i++) cab[4 + i] = tipo.charCodeAt(i);
    return juntar([cab, corpo]);
  }

  // FullBox: um box com `version` (1 byte) e `flags` (3 bytes) na frente do
  // corpo. Errar essa distinção desloca TUDO o que vem depois — e o efeito não
  // é uma exceção, é vídeo que não toca.
  function caixaCheia(tipo, versao, flags) {
    const partes = Array.prototype.slice.call(arguments, 3);
    partes.unshift(b8(versao, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255));
    return caixa.apply(null, [tipo].concat(partes));
  }

  function hex2(n) { return (n < 16 ? '0' : '') + (n & 255).toString(16).toUpperCase(); }

  // --------------------------------------------------------------------------
  // ANNEX-B → COMPRIMENTO-PREFIXADO
  //
  // O `MediaCodec` entrega NALUs separadas por *start code* (`00 00 01`, com um
  // `00` a mais quando são quatro bytes). O MP4 não usa start code: cada NALU é
  // precedida do PRÓPRIO comprimento, com o tamanho desse prefixo declarado no
  // `avcC` (`lengthSizeMinusOne = 3` ⇒ quatro bytes). A conversão é a única
  // coisa que se faz com os BYTES do vídeo neste arquivo — o resto é cabeçalho.
  // --------------------------------------------------------------------------

  // As NALUs de um buffer Annex-B, sem os start codes.
  //
  // Os zeros do FIM de cada NALU saem junto, e isso é seguro por construção: o
  // último byte de uma NALU bem formada contém o `rbsp_stop_one_bit`, logo nunca
  // é `0x00`. O que aparece ali é o quarto byte de um start code de 4 bytes do
  // NAL seguinte, ou `cabac_zero_words` de preenchimento — os dois descartáveis.
  function nais(dados) {
    const b = paraU8(dados);
    const saida = [];
    let i = 0;
    while (i + 2 < b.length && !(b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 1)) i++;
    while (i + 2 < b.length) {
      const ini = i + 3;
      let j = ini;
      let achou = false;
      while (j + 2 < b.length) {
        if (b[j] === 0 && b[j + 1] === 0 && b[j + 2] === 1) { achou = true; break; }
        j++;
      }
      let fim = achou ? j : b.length;
      while (fim > ini && b[fim - 1] === 0) fim--;
      if (fim > ini) saida.push(b.subarray(ini, fim));
      if (!achou) break;
      i = j;
    }
    return saida;
  }

  function anexoBParaAvcc(dados) {
    const partes = [];
    const lista = nais(dados);
    for (let i = 0; i < lista.length; i++) {
      partes.push(b32(lista[i].length));
      partes.push(lista[i]);
    }
    return juntar(partes);
  }

  // SPS (`nal_unit_type` 7) e PPS (8) de um `csd` em Annex-B — que é como o
  // `MediaCodec` entrega `csd-0`/`csd-1` (§3.3, invariante 6) e como o quadro
  // `0x01` os transporta (§5.2). Um AUD (9) ou um SEI (6) no meio é legal e
  // precisa ser ignorado, e não pulado por posição.
  function separarParametros(csd) {
    let sps = null;
    let pps = null;
    const lista = nais(csd);
    for (let i = 0; i < lista.length; i++) {
      const tipo = lista[i][0] & 0x1f;
      if (tipo === 7 && !sps) sps = lista[i];
      else if (tipo === 8 && !pps) pps = lista[i];
    }
    return { sps: sps, pps: pps };
  }

  // --------------------------------------------------------------------------
  // O SPS — de onde saem o `codecs=` e as dimensões
  //
  // Por que ler o SPS em vez de aceitar as dimensões de fora: **o cliente não
  // tem outra fonte**. O fio manda NALUs e um carimbo de tempo, e mais nada
  // (§5.2) — a resolução da tela virtual é decisão do celular e não viaja.
  // Chutar 1280×720 funcionaria HOJE e passaria a mentir no dia em que
  // `EspelhoDisplay.LARG` mudar, sem nenhum sinal em lugar nenhum.
  //
  // A leitura é bit a bit (Exp-Golomb), como manda a ITU-T H.264 §7.3.2.1.1, e
  // ela precisa vir depois da remoção dos bytes de anti-emulação — senão um
  // `00 00 03` no meio do SPS desloca todos os bits seguintes.
  // --------------------------------------------------------------------------

  function semEmulacao(b) {
    const saida = new Uint8Array(b.length);
    let n = 0;
    let zeros = 0;
    for (let i = 0; i < b.length; i++) {
      if (zeros === 2 && b[i] === 3) { zeros = 0; continue; }
      saida[n++] = b[i];
      zeros = b[i] === 0 ? zeros + 1 : 0;
    }
    return saida.subarray(0, n);
  }

  function leitorDeBits(b) {
    let i = 0;
    function bit() {
      if ((i >> 3) >= b.length) throw new Error('SPS acabou antes da conta');
      const v = (b[i >> 3] >>> (7 - (i & 7))) & 1;
      i++;
      return v;
    }
    function u(n) {
      let v = 0;
      for (let k = 0; k < n; k++) v = (v * 2) + bit();
      return v;
    }
    // Exp-Golomb sem sinal: N zeros, um 1, N bits de valor.
    function ue() {
      let z = 0;
      while (bit() === 0) {
        z++;
        if (z > 32) throw new Error('SPS: Exp-Golomb sem fim');
      }
      return z ? (Math.pow(2, z) - 1) + u(z) : 0;
    }
    function se() {
      const k = ue();
      return (k & 1) ? ((k + 1) >> 1) : -(k >> 1);
    }
    return { u: u, ue: ue, se: se, bit: bit };
  }

  // Devolve `{ larg, alt }` ou `null`. Nunca lança: um SPS que este parser não
  // entenda vale menos que um espelho que não abre — o chamador cai nas
  // dimensões de reserva e o vídeo continua, porque quem manda no tamanho real
  // é o decodificador, não o contêiner.
  function dimensoesDe(sps) {
    try {
      const b = semEmulacao(paraU8(sps));
      const r = leitorDeBits(b.subarray(1));         // pula o byte de cabeçalho da NALU
      const perfil = r.u(8);
      r.u(8);                                        // constraint_set flags + reserved
      r.u(8);                                        // level_idc
      r.ue();                                        // seq_parameter_set_id
      let croma = 1;
      let planosSeparados = 0;
      if (perfil === 100 || perfil === 110 || perfil === 122 || perfil === 244 || perfil === 44
        || perfil === 83 || perfil === 86 || perfil === 118 || perfil === 128 || perfil === 138
        || perfil === 139 || perfil === 134 || perfil === 135) {
        croma = r.ue();
        if (croma === 3) planosSeparados = r.bit();
        r.ue();                                      // bit_depth_luma_minus8
        r.ue();                                      // bit_depth_chroma_minus8
        r.bit();                                     // qpprime_y_zero_transform_bypass_flag
        if (r.bit()) {                               // seq_scaling_matrix_present_flag
          const quantas = croma !== 3 ? 8 : 12;
          for (let i = 0; i < quantas; i++) {
            if (r.bit()) {
              // Lista de escala: a especificação a percorre com um delta
              // acumulado, e parar cedo (quando o delta zera) faz parte dela.
              const tam = i < 6 ? 16 : 64;
              let ultimo = 8;
              let proximo = 8;
              for (let k = 0; k < tam; k++) {
                if (proximo !== 0) proximo = (ultimo + r.se() + 256) % 256;
                ultimo = proximo === 0 ? ultimo : proximo;
              }
            }
          }
        }
      }
      r.ue();                                        // log2_max_frame_num_minus4
      const ordem = r.ue();                          // pic_order_cnt_type
      if (ordem === 0) {
        r.ue();
      } else if (ordem === 1) {
        r.bit();
        r.se();
        r.se();
        const quantos = r.ue();
        for (let i = 0; i < quantos; i++) r.se();
      }
      r.ue();                                        // max_num_ref_frames
      r.bit();                                       // gaps_in_frame_num_value_allowed_flag
      const larguraMb = r.ue() + 1;
      const alturaMapa = r.ue() + 1;
      const soQuadros = r.bit();
      if (!soQuadros) r.bit();                       // mb_adaptive_frame_field_flag
      r.bit();                                       // direct_8x8_inference_flag
      let esq = 0;
      let dir = 0;
      let topo = 0;
      let base = 0;
      if (r.bit()) {                                 // frame_cropping_flag
        esq = r.ue(); dir = r.ue(); topo = r.ue(); base = r.ue();
      }
      // O recorte é contado em unidades de croma, não em pixels (H.264 §7.4.2.1.1).
      const subL = croma === 1 || croma === 2 ? 2 : 1;
      const subA = croma === 1 ? 2 : 1;
      const unidadeX = (croma === 0 || planosSeparados) ? 1 : subL;
      const unidadeY = ((croma === 0 || planosSeparados) ? 1 : subA) * (2 - soQuadros);
      const larg = larguraMb * 16 - (esq + dir) * unidadeX;
      const alt = (2 - soQuadros) * alturaMapa * 16 - (topo + base) * unidadeY;
      if (!(larg > 0) || !(alt > 0)) return null;
      return { larg: larg, alt: alt };
    } catch (_) {
      return null;
    }
  }

  // `avc1.PPCCLL`, com os três bytes que o próprio SPS carrega logo depois do
  // cabeçalho da NALU: profile_idc, as flags de constraint e o level_idc. É a
  // string que vai para `addSourceBuffer` — e um `codecs=` que não bate com o
  // `avcC` faz o navegador RECUSAR o segmento de inicialização.
  function codecDe(sps) {
    const b = paraU8(sps);
    if (b.length < 4) return 'avc1.42E01E';
    return 'avc1.' + hex2(b[1]) + hex2(b[2]) + hex2(b[3]);
  }

  // AVCDecoderConfigurationRecord (ISO/IEC 14496-15 §5.2.4.1).
  function avcC(sps, pps) {
    return caixa('avcC', juntar([
      b8(1, sps[1], sps[2], sps[3]),
      // 111111 + lengthSizeMinusOne(=3): prefixo de comprimento de 4 bytes, que
      // é o que `anexoBParaAvcc` escreve. Os dois números TÊM de concordar.
      b8(0xff),
      b8(0xe1),                                      // 111 + numOfSequenceParameterSets = 1
      b16(sps.length), sps,
      b8(1),                                         // numOfPictureParameterSets = 1
      b16(pps.length), pps,
    ]));
  }

  // VisualSampleEntry `avc1` (ISO/IEC 14496-12 §12.1.3). Os campos "reserved" e
  // "pre_defined" são zeros obrigatórios — omiti-los desloca o `avcC`.
  function entradaAvc1(sps, pps, larg, alt) {
    const nome = new Uint8Array(32);                 // compressorname: 1 byte de tamanho + 31
    return caixa('avc1', juntar([
      b8(0, 0, 0, 0, 0, 0),                          // reserved
      b16(1),                                        // data_reference_index
      b16(0), b16(0),                                // pre_defined, reserved
      b32(0), b32(0), b32(0),                        // pre_defined[3]
      b16(larg), b16(alt),
      b32(0x00480000), b32(0x00480000),              // 72 dpi horizontal/vertical
      b32(0),                                        // reserved
      b16(1),                                        // frame_count
      nome,
      b16(0x0018),                                   // depth
      b16(0xffff),                                   // pre_defined = −1
    ]), avcC(sps, pps));
  }

  // --------------------------------------------------------------------------
  // O SEGMENTO DE INICIALIZAÇÃO: `ftyp` + `moov`
  // --------------------------------------------------------------------------

  function ftyp() {
    // `avc1` NÃO entra na lista de marcas compatíveis de propósito: o `moov`
    // daqui é agnóstico de codec (ver o cabeçalho), e uma marca prometendo
    // H.264 num arquivo montado com outra *sample entry* seria mentira do
    // contêiner sobre si mesmo. `iso6` é a marca de MP4 fragmentado.
    return caixa('ftyp',
      b8(0x69, 0x73, 0x6f, 0x6d),                    // major_brand 'isom'
      b32(0),                                        // minor_version
      b8(0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x69, 0x73, 0x6f, 0x36, 0x6d, 0x70, 0x34, 0x31));
  }

  function mvhd() {
    return caixaCheia('mvhd', 0, 0,
      b32(0), b32(0),                                // creation/modification: zero, não "agora".
      b32(ESCALA_FILME),
      b32(0),                                        // duration = 0: AO VIVO NÃO TEM DURAÇÃO (§3.11, inv. 5)
      b32(0x00010000),                               // rate 1.0
      b16(0x0100),                                   // volume 1.0
      b16(0), b32(0), b32(0),                        // reserved
      b32(0x00010000), b32(0), b32(0),               // matriz identidade
      b32(0), b32(0x00010000), b32(0),
      b32(0), b32(0), b32(0x40000000),
      b32(0), b32(0), b32(0), b32(0), b32(0), b32(0), // pre_defined[6]
      b32(FAIXA + 1));                               // next_track_ID
  }

  function tkhd(larg, alt) {
    // flags = 3: track_enabled | track_in_movie. Sem `track_enabled` o
    // navegador ignora a faixa inteira — e não avisa.
    return caixaCheia('tkhd', 0, 3,
      b32(0), b32(0),
      b32(FAIXA),
      b32(0),                                        // reserved
      b32(0),                                        // duration = 0 (ao vivo)
      b32(0), b32(0),                                // reserved
      b16(0), b16(0),                                // layer, alternate_group
      b16(0), b16(0),                                // volume (0 para vídeo), reserved
      b32(0x00010000), b32(0), b32(0),
      b32(0), b32(0x00010000), b32(0),
      b32(0), b32(0), b32(0x40000000),
      b32(larg * 65536), b32(alt * 65536));          // 16.16 com ponto fixo
  }

  function mdhd() {
    return caixaCheia('mdhd', 0, 0,
      b32(0), b32(0),
      b32(ESCALA),
      b32(0),                                        // duration = 0 (ao vivo)
      b16(0x55c4),                                   // 'und' empacotado em 5 bits por letra
      b16(0));
  }

  function hdlr() {
    return caixaCheia('hdlr', 0, 0,
      b32(0),
      b8(0x76, 0x69, 0x64, 0x65),                    // 'vide'
      b32(0), b32(0), b32(0),
      b8(0x45, 0x53, 0x50, 0x45, 0x4c, 0x48, 0x4f, 0));  // "ESPELHO\0"
  }

  function dinf() {
    // `url ` com flags = 1 significa "os dados estão neste mesmo arquivo". É o
    // caso de todo fMP4 e a única forma que a MediaSource aceita.
    return caixa('dinf', caixaCheia('dref', 0, 0, b32(1), caixaCheia('url ', 0, 1)));
  }

  function stbl(entrada) {
    // As quatro tabelas VAZIAS não são enfeite: num MP4 fragmentado toda a
    // informação de amostra mora nos `moof`, mas o `stbl` continua obrigatório
    // e o parser recusa o `moov` sem elas.
    return caixa('stbl',
      caixaCheia('stsd', 0, 0, b32(1), entrada),
      caixaCheia('stts', 0, 0, b32(0)),
      caixaCheia('stsc', 0, 0, b32(0)),
      caixaCheia('stsz', 0, 0, b32(0), b32(0)),
      caixaCheia('stco', 0, 0, b32(0)));
  }

  function minf(entrada) {
    return caixa('minf',
      caixaCheia('vmhd', 0, 1, b16(0), b16(0), b16(0), b16(0)),
      dinf(),
      stbl(entrada));
  }

  function trex() {
    return caixaCheia('trex', 0, 0,
      b32(FAIXA),
      b32(1),                                        // default_sample_description_index
      b32(0), b32(0), b32(0));                       // duração/tamanho/flags padrão: cada trun traz o seu
  }

  // O `moov` COM A *SAMPLE ENTRY* QUE VIER — a costura descrita no cabeçalho.
  // Tudo aqui é agnóstico de codec; quem sabe o que é H.264 é `entradaAvc1`.
  function initCom(entrada, larg, alt) {
    return juntar([
      ftyp(),
      caixa('moov',
        mvhd(),
        caixa('trak', tkhd(larg, alt), caixa('mdia', mdhd(), hdlr(), minf(entrada))),
        caixa('mvex', trex())),
    ]);
  }

  // O segmento de inicialização a partir do `csd` que veio no quadro `0x01`.
  // Devolve também o `mime` porque é ele que vai para `addSourceBuffer` — e
  // deixar o chamador montar a string seria pedir para os dois divergirem.
  function initVideo(csd, largForcada, altForcada) {
    const par = separarParametros(csd);
    if (!par.sps || !par.pps) return null;
    const dim = dimensoesDe(par.sps) || { larg: LARG_PADRAO, alt: ALT_PADRAO };
    const larg = largForcada || dim.larg;
    const alt = altForcada || dim.alt;
    const codec = codecDe(par.sps);
    return {
      bytes: initCom(entradaAvc1(par.sps, par.pps, larg, alt), larg, alt),
      codec: codec,
      mime: 'video/mp4; codecs="' + codec + '"',
      larg: larg,
      alt: alt,
      // Do próprio SPS, não do que o chamador achou: é o que o diagnóstico
      // imprime quando alguém perguntar "o telão está em que resolução?".
      dimensaoLida: !!dim,
    };
  }

  // --------------------------------------------------------------------------
  // O FRAGMENTO: `moof` + `mdat`
  // --------------------------------------------------------------------------

  // `sample_flags` (ISO/IEC 14496-12 §8.8.3.1), e vale escrever os dois valores
  // por extenso porque errá-los NÃO dá erro:
  //
  //   quadro-chave  → sample_depends_on = 2 (não depende de ninguém),
  //                   sample_is_non_sync_sample = 0  ⇒ 0x02000000
  //   quadro delta  → sample_depends_on = 1, non_sync = 1  ⇒ 0x01010000
  //
  // Se um delta for anunciado como chave, o navegador começa a decodificar dele
  // e pinta lixo verde. Se uma CHAVE for anunciada como delta, o navegador
  // DESCARTA tudo até encontrar uma chave — e como o servidor manda uma por
  // conexão, o resultado é uma tela preta permanente sem um único erro.
  const FLAGS_CHAVE = 0x02000000;
  const FLAGS_DELTA = 0x01010000;

  function moofDe(seq, dts, dur, chave, tamanho, deslocamento) {
    return caixa('moof',
      caixaCheia('mfhd', 0, 0, b32(seq)),
      caixa('traf',
        // flags = 0x020000 (default-base-is-moof): o `data_offset` do `trun`
        // passa a ser contado do primeiro byte DESTE `moof`. É o que permite
        // montar o fragmento sem saber onde ele vai cair no fluxo — e num fluxo
        // infinito não há "onde", porque não existe arquivo.
        caixaCheia('tfhd', 0, 0x020000, b32(FAIXA)),
        // version 1 ⇒ `baseMediaDecodeTime` de 64 bits. Obrigatório: em µs, uma
        // sessão de 72 minutos já estoura os 32 bits da versão 0.
        caixaCheia('tfdt', 1, 0, b64(dts)),
        caixaCheia('trun', 0, 0x000701,              // data-offset + duração + tamanho + flags
          b32(1),                                    // sample_count
          b32(deslocamento),
          b32(dur),
          b32(tamanho),
          b32(chave ? FLAGS_CHAVE : FLAGS_DELTA))));
  }

  // Um fragmento de UMA amostra. `dados` já vem comprimento-prefixado.
  //
  // O `data_offset` depende do tamanho do `moof`, que depende do `data_offset`:
  // o `moof` é montado duas vezes, a primeira só para medir. São duas dezenas de
  // bytes por quadro — remendar o número dentro do buffer economizaria isso e
  // custaria um deslocamento mágico no código, que é exatamente a classe de erro
  // que este arquivo inteiro existe para não cometer.
  function mediaSegment(op) {
    const dados = paraU8(op.dados);
    const provisorio = moofDe(op.seq | 0, op.dts, op.dur | 0, !!op.chave, dados.length, 0);
    const moof = moofDe(op.seq | 0, op.dts, op.dur | 0, !!op.chave, dados.length, provisorio.length + 8);
    return juntar([moof, caixa('mdat', dados)]);
  }

  // --------------------------------------------------------------------------
  // O MUXER — o atraso de um quadro, que é o motivo de este objeto existir
  // --------------------------------------------------------------------------

  function criar() {
    let init = null;
    let seq = 1;
    // O quadro que já chegou e AINDA NÃO PODE SER EMITIDO, porque a duração
    // dele é a distância até o próximo. Ver o cabeçalho: é o invariante 1.
    let pendente = null;

    return {
      // O quadro `0x01`. Devolve o descritor do segmento de inicialização (com
      // `bytes` e `mime`) ou `null` se o `csd` não trouxer SPS+PPS — caso em que
      // quem chamou tem de DIZER isso, não seguir em frente.
      csd: function (bytes) {
        init = initVideo(bytes);
        return init;
      },
      init: function () { return init; },

      // O quadro `0x02`. Devolve o fragmento do quadro ANTERIOR (ou `null` no
      // primeiro de todos, e depois de um `esvaziar`).
      quadro: function (q) {
        const atual = { dts: q.ptsUs, chave: !!q.chave, dados: anexoBParaAvcc(q.dados) };
        const anterior = pendente;
        pendente = atual;
        if (!anterior) return null;
        // A duração é MEDIDA, nunca chutada. Um PTS que não avança (o encoder
        // repetindo o quadro no mesmo carimbo, ou um relógio que empacou) daria
        // duração 0 e uma amostra de duração 0 é um buraco disfarçado: o piso de
        // 1 µs mantém o `buffered` contínuo e é imperceptível.
        let dur = atual.dts - anterior.dts;
        if (!(dur > 0)) dur = 1;
        const frag = mediaSegment({
          seq: seq++, dts: anterior.dts, dur: dur, chave: anterior.chave, dados: anterior.dados,
        });
        return frag;
      },

      // Fecha o quadro pendente com uma duração ARBITRADA. Só existe para o fim
      // do fluxo (o operador desligou, o servidor se despediu) e para o oráculo
      // de teste — na vida real o par sempre chega, inclusive através de uma
      // descontinuidade, e é por isso que o `buffered` não abre buraco.
      esvaziar: function (durUs) {
        if (!pendente) return null;
        const q = pendente;
        pendente = null;
        return mediaSegment({
          seq: seq++, dts: q.dts, dur: Math.max(1, durUs | 0), chave: q.chave, dados: q.dados,
        });
      },

      pendente: function () { return !!pendente; },

      // Descarta o quadro retido SEM emitir. É o que se faz quando o cliente
      // vai recomeçar do zero (uma `MediaSource` nova): emitir o pendente ali
      // colocaria uma amostra órfã antes do segmento de inicialização.
      descartar: function () { pendente = null; },
    };
  }

  global.AVFmp4 = {
    ESCALA: ESCALA,
    FAIXA: FAIXA,
    FLAGS_CHAVE: FLAGS_CHAVE,
    FLAGS_DELTA: FLAGS_DELTA,
    criar: criar,
    initVideo: initVideo,
    initCom: initCom,
    entradaAvc1: entradaAvc1,
    mediaSegment: mediaSegment,
    anexoBParaAvcc: anexoBParaAvcc,
    separarParametros: separarParametros,
    dimensoesDe: dimensoesDe,
    codecDe: codecDe,
    nais: nais,
    semEmulacao: semEmulacao,
    caixa: caixa,
    caixaCheia: caixaCheia,
    juntar: juntar,
    b8: b8,
    b16: b16,
    b32: b32,
    b64: b64,
  };
})(typeof window !== 'undefined' ? window : this);
