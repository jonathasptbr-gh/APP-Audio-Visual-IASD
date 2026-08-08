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
// perseguição de borda do `cliente.js`, e ela está escrita lá.
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
// ## O ÁUDIO — uma faixa `mp4a`/`esds`, e ela NÃO mora no mesmo `moov`
//
// A Entrega 3 acrescentou o som, e a primeira decisão foi onde pôr a faixa. A
// especificação fala em "uma segunda `trak`"; o que se implementou é uma
// segunda **SourceBuffer**, com o **seu próprio** segmento de inicialização —
// `ftyp` + `moov` de uma faixa só, de som. Não é preferência de estilo:
//
//  - uma `SourceBuffer` é um *byte stream* independente para a MSE, e é assim
//    que hls.js e o Shaka entregam áudio e vídeo separados (**prática**);
//  - um `moov` de duas faixas obrigaria os dois fluxos a chegarem **juntos e
//    intercalados no mesmo fragmento**, e eles vêm de dois `MediaCodec`
//    diferentes, em duas threads, com carimbos independentes (§3.9);
//  - e o cliente pode **soltar o áudio sem tocar no vídeo** — que é a falha
//    segura escrita no §3.9: sem canal, sem handshake ou sem faixa, o espelho
//    fica MUDO e a imagem continua.
//
// O que a faixa de som herda do desenho do vídeo, e o que ela muda:
//
//  - **herda o atraso de um quadro.** Um `AudioWorklet` que perde blocos (a
//    fila do `EspelhoAudio` enchendo) produz um salto no PTS, e escrever 1024
//    amostras de duração ali abriria o mesmo buraco que trava o `<video>`. A
//    duração de um quadro AAC é MEDIDA até o seguinte, exatamente como a do
//    vídeo;
//  - **muda o timescale**: o do vídeo é 1 µs (o carimbo entra verbatim); o do
//    áudio é a **taxa de amostragem**, que é o que faz um quadro AAC durar
//    1024 unidades EXATAS. Em µs ele duraria 21333,33 — e um terço de
//    microssegundo por quadro são 4 s de deriva em duas horas de culto;
//  - por isso o `tfdt` do áudio **acumula** (`dts += dur`) em vez de ser
//    reconvertido a cada quadro: a conversão de µs para amostras é a única
//    conta arredondada do arquivo, e acumular a duração já arredondada mantém
//    o `buffered` colado por construção, com o erro contra o relógio do fio
//    preso em ±1 amostra (~20 µs) em vez de crescer.
//
// A âncora é convertida UMA vez, do primeiro quadro AAC — assim as duas faixas
// começam no mesmo instante em segundos, que é a única coisa que a
// `MediaSource` compara para sincronizar A/V.
//
// ## O que este arquivo NÃO faz
//
// Não fala com a rede (é o `cliente.js`) e não decide quando emitir (idem).
// Não trata B-frames: o encoder é configurado com `KEY_MAX_B_FRAMES = 0`, logo
// `DTS == PTS` e o `trun` não precisa de `composition_time_offset` (§2.2). E
// não inventa silêncio: um trecho de áudio que não chegou não vira quadro AAC
// fabricado aqui — quem decide o que fazer com um som que parou é o cliente.
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

  // A faixa de SOM vive noutro segmento de inicialização (ver o cabeçalho), e
  // dois *byte streams* independentes poderiam usar o mesmo id sem conflito.
  // Ela leva 2 assim mesmo: um despejo de `mp4box` ou de `ffprobe` feito num
  // domingo de manhã não pode deixar dúvida sobre qual faixa é qual.
  const FAIXA_SOM = 2;

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

  function mvhd(proximaFaixa) {
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
      b32(proximaFaixa));                            // next_track_ID
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

  // O `tkhd` de uma faixa de SOM: sem matriz de imagem que importe, sem
  // dimensões (largura/altura zeradas — um `tkhd` de som com 1280x720 faria o
  // navegador reservar área de vídeo para uma faixa que não desenha nada) e com
  // `volume` em 1.0, que é o campo que o vídeo zera.
  function tkhdSom() {
    return caixaCheia('tkhd', 0, 3,
      b32(0), b32(0),
      b32(FAIXA_SOM),
      b32(0),                                        // reserved
      b32(0),                                        // duration = 0 (ao vivo)
      b32(0), b32(0),                                // reserved
      b16(0), b16(1),                                // layer, alternate_group = 1 (áudio)
      b16(0x0100), b16(0),                           // volume 1.0, reserved
      b32(0x00010000), b32(0), b32(0),
      b32(0), b32(0x00010000), b32(0),
      b32(0), b32(0), b32(0x40000000),
      b32(0), b32(0));                               // width/height = 0
  }

  function mdhd(escala) {
    return caixaCheia('mdhd', 0, 0,
      b32(0), b32(0),
      b32(escala),
      b32(0),                                        // duration = 0 (ao vivo)
      b16(0x55c4),                                   // 'und' empacotado em 5 bits por letra
      b16(0));
  }

  // `tipo` é o handler_type de quatro letras: 'vide' ou 'soun'. Errá-lo não dá
  // erro — dá uma faixa que o navegador ignora.
  function hdlr(tipo) {
    return caixaCheia('hdlr', 0, 0,
      b32(0),
      b8(tipo.charCodeAt(0), tipo.charCodeAt(1), tipo.charCodeAt(2), tipo.charCodeAt(3)),
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

  // O irmão de som do `minf`. `smhd` no lugar do `vmhd`: são os dois
  // *media information headers*, e um `vmhd` numa faixa de som é a mesma classe
  // de erro do `hdlr` trocado — não lança, só não toca.
  function minfSom(entrada) {
    return caixa('minf',
      caixaCheia('smhd', 0, 0, b16(0), b16(0)),      // balance 0, reserved
      dinf(),
      stbl(entrada));
  }

  function trex(faixa) {
    return caixaCheia('trex', 0, 0,
      b32(faixa),
      b32(1),                                        // default_sample_description_index
      b32(0), b32(0), b32(0));                       // duração/tamanho/flags padrão: cada trun traz o seu
  }

  // O `moov` COM A *SAMPLE ENTRY* QUE VIER — a costura descrita no cabeçalho.
  // Tudo aqui é agnóstico de codec; quem sabe o que é H.264 é `entradaAvc1`.
  function initCom(entrada, larg, alt) {
    return juntar([
      ftyp(),
      caixa('moov',
        mvhd(FAIXA + 1),
        caixa('trak', tkhd(larg, alt), caixa('mdia', mdhd(ESCALA), hdlr('vide'), minf(entrada))),
        caixa('mvex', trex(FAIXA))),
    ]);
  }

  // O mesmo, para uma faixa de SOM — e é a mesma costura: `initSom` não sabe o
  // que é AAC, quem sabe é `entradaMp4a`. O `escala` é a taxa de amostragem,
  // pelo motivo escrito no cabeçalho.
  function initSom(entrada, escala) {
    return juntar([
      ftyp(),
      caixa('moov',
        mvhd(FAIXA_SOM + 1),
        caixa('trak', tkhdSom(), caixa('mdia', mdhd(escala), hdlr('soun'), minfSom(entrada))),
        caixa('mvex', trex(FAIXA_SOM))),
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
  // O ÁUDIO — `mp4a` + `esds`, a partir do `AudioSpecificConfig` do quadro 0x10
  //
  // O `MediaCodec` entrega o ASC pronto em `csd-0` (dois bytes, para AAC-LC), e
  // é ele que viaja no fio (§5.2). Ele é o análogo exato do SPS do lado do
  // vídeo: é a ÚNICA fonte da taxa de amostragem e do número de canais que o
  // cliente tem — nada disso viaja em campo separado, e chutar 48 kHz
  // funcionaria neste aparelho e passaria a mentir no primeiro que entregasse
  // 44,1 kHz, sem sinal em lugar nenhum.
  // --------------------------------------------------------------------------

  // ISO/IEC 14496-3, tabela 1.18. Os índices 13–15 não são taxas: 15 significa
  // "a taxa vem escrita a seguir, em 24 bits".
  const TAXAS_ASC = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050,
    16000, 12000, 11025, 8000, 7350, 0, 0, 0,
  ];

  // Devolve `{ objeto, taxa, canais, codec }` ou `null`. Nunca lança, e o
  // `null` importa: ele é o que faz o cliente ficar MUDO em vez de montar uma
  // faixa de som que o navegador vai recusar depois — áudio pela metade é
  // estalo na caixa de som do templo.
  function lerAsc(bytes) {
    try {
      const b = paraU8(bytes);
      if (b.length < 2) return null;
      const r = leitorDeBits(b);
      let objeto = r.u(5);
      // O escape de 5 bits: 31 significa "o tipo de objeto vem em 6 bits a
      // mais". Não acontece com AAC-LC, e ler errado aqui desloca a taxa.
      if (objeto === 31) objeto = 32 + r.u(6);
      const indice = r.u(4);
      const taxa = indice === 15 ? r.u(24) : TAXAS_ASC[indice];
      const cfg = r.u(4);
      if (!(taxa > 0)) return null;
      // `channelConfiguration` 0 significa "está no PCE, dentro do fluxo" —
      // não acontece com o encoder do aparelho, e supor estéreo é a suposição
      // que o `mp4a` precisa fazer para existir.
      const canais = cfg === 0 ? 2 : (cfg === 7 ? 8 : cfg);
      return { objeto: objeto, taxa: taxa, canais: canais, codec: 'mp4a.40.' + objeto };
    } catch (_) {
      return null;
    }
  }

  // O comprimento de um descritor MPEG-4: base 128, sete bits por byte, com o
  // bit alto marcando "tem mais". Um `esds` de AAC-LC cabe num byte só; a forma
  // longa está aqui porque a regra é da norma e não do nosso caso.
  function tamanhoDescritor(n) {
    const saida = [];
    let v = n;
    do {
      saida.unshift(v & 0x7f);
      v = Math.floor(v / 128);
    } while (v > 0);
    for (let i = 0; i < saida.length - 1; i++) saida[i] |= 0x80;
    return new Uint8Array(saida);
  }

  function descritor(tag, corpo) {
    return juntar([b8(tag), tamanhoDescritor(corpo.length), corpo]);
  }

  // ESDBox (ISO/IEC 14496-14 §5.6) — ES_Descriptor > DecoderConfigDescriptor >
  // DecoderSpecificInfo, com o ASC dentro do último. É este aninhamento que
  // carrega a configuração do decodificador AAC; **sem `esds` não há o que
  // tocar**, e o navegador recusa o segmento de inicialização inteiro.
  function esds(asc) {
    const dsi = descritor(0x05, paraU8(asc));
    const dcd = descritor(0x04, juntar([
      b8(0x40),                                      // objectTypeIndication: MPEG-4 Audio
      // streamType = 5 (AudioStream) << 2 | upStream = 0 << 1 | reserved = 1.
      b8(0x15),
      b8(0, 0, 0),                                   // bufferSizeDB
      // Bitrates NÃO declarados. O muxer não conhece o do encoder (ele é do
      // `EspelhoAudio`), e escrever um número inventado aqui seria pior que o
      // zero que a norma permite.
      b32(0), b32(0),
      dsi,
    ]));
    // SLConfigDescriptor predefinido = 2 ("reservado para uso em MP4").
    const sl = descritor(0x06, b8(0x02));
    const es = descritor(0x03, juntar([
      b16(FAIXA_SOM),                                // ES_ID
      b8(0),                                         // flags + streamPriority
      dcd,
      sl,
    ]));
    return caixaCheia('esds', 0, 0, es);
  }

  // AudioSampleEntry `mp4a` (ISO/IEC 14496-12 §12.2.3).
  function entradaMp4a(asc, canais, taxa) {
    return caixa('mp4a', juntar([
      b8(0, 0, 0, 0, 0, 0),                          // reserved
      b16(1),                                        // data_reference_index
      b32(0), b32(0),                                // reserved[2]
      b16(canais),
      b16(16),                                       // samplesize
      b16(0),                                        // pre_defined
      b16(0),                                        // reserved
      // 16.16 com ponto fixo, e por isso ele NÃO comporta taxas acima de
      // 65535 Hz — quem manda de verdade é o ASC dentro do `esds`. As taxas
      // que o `EspelhoAudio` aceita cabem todas aqui.
      b32(taxa * 65536),
    ]), esds(asc));
  }

  // O segmento de inicialização da faixa de som, a partir do quadro `0x10`.
  // Mesmo contrato do `initVideo`: devolve o `mime` junto, porque é ele que vai
  // para `addSourceBuffer` e deixar o chamador montar a string seria pedir para
  // os dois divergirem.
  function initAudio(csd) {
    const asc = paraU8(csd);
    const info = lerAsc(asc);
    if (!info) return null;
    return {
      bytes: initSom(entradaMp4a(asc, info.canais, info.taxa), info.taxa),
      codec: info.codec,
      mime: 'audio/mp4; codecs="' + info.codec + '"',
      taxa: info.taxa,
      canais: info.canais,
      escala: info.taxa,
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

  function moofDe(seq, dts, dur, chave, tamanho, deslocamento, faixa) {
    return caixa('moof',
      caixaCheia('mfhd', 0, 0, b32(seq)),
      caixa('traf',
        // flags = 0x020000 (default-base-is-moof): o `data_offset` do `trun`
        // passa a ser contado do primeiro byte DESTE `moof`. É o que permite
        // montar o fragmento sem saber onde ele vai cair no fluxo — e num fluxo
        // infinito não há "onde", porque não existe arquivo.
        caixaCheia('tfhd', 0, 0x020000, b32(faixa)),
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
    // `op.faixa` ausente é a faixa de VÍDEO: é o chamador antigo, e o oráculo
    // de `tools/fmp4.test.mjs` conta com isso.
    const faixa = op.faixa || FAIXA;
    const provisorio = moofDe(op.seq | 0, op.dts, op.dur | 0, !!op.chave, dados.length, 0, faixa);
    const moof = moofDe(
      op.seq | 0, op.dts, op.dur | 0, !!op.chave, dados.length, provisorio.length + 8, faixa,
    );
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

    // A faixa de som tem estado PRÓPRIO — inclusive o número de sequência.
    // `mfhd` é por faixa, e compartilhar o contador faria os dois fluxos
    // pularem números; um `moof` com sequência repetida é tratado como
    // retransmissão, e isso não dá erro nenhum.
    let somInit = null;
    let somSeq = 1;
    let somPend = null;
    let somDts = 0;

    // µs do fio → unidades do timescale do áudio. É a única conta arredondada
    // do arquivo, e ela acontece UMA vez por quadro sobre a DIFERENÇA (mais a
    // âncora, uma vez na vida) — nunca sobre o carimbo absoluto, que é o que
    // faria o erro de arredondamento reaparecer a cada fragmento.
    function emAmostras(us, escala) {
      return Math.round(us * escala / 1000000);
    }

    function fragmentoSom(q, dur) {
      const f = mediaSegment({
        seq: somSeq++,
        dts: somDts,
        dur: dur,
        // TODO quadro AAC é ponto de sincronismo — não existe "quadro AAC
        // intermediário". Marcá-lo como delta faria o navegador descartar tudo
        // até um quadro-chave que nunca vem, e o espelho ficaria mudo sem erro.
        chave: true,
        dados: q.dados,
        faixa: FAIXA_SOM,
      });
      somDts += dur;
      return f;
    }

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

      // ---- A FAIXA DE SOM. Mesmo desenho, outro eixo (ver o cabeçalho) ----

      // O quadro `0x10`. `null` quando o `AudioSpecificConfig` não é legível —
      // e aí o cliente segue MUDO, com a imagem intacta.
      csdAudio: function (bytes) {
        const novo = initAudio(bytes);
        // Um `csd` REPETIDO é o caso normal: ele chega em toda conexão (§5.3).
        // Reprocessá-lo não pode rebobinar o eixo do áudio — o `somDts` é da
        // SESSÃO, como o `tfdt` do vídeo.
        if (novo) somInit = novo;
        return novo;
      },
      initAudio: function () { return somInit; },

      // O quadro `0x11`. Devolve o fragmento do quadro AAC ANTERIOR, pelo mesmo
      // atraso de um quadro do vídeo — e aqui ele vale ainda mais: um bloco de
      // PCM perdido (a fila do `EspelhoAudio` enchendo) salta o PTS, e a
      // diferença medida fecha o salto em vez de abrir buraco.
      quadroAudio: function (q) {
        if (!somInit) return null;
        const escala = somInit.escala;
        const atual = { pts: q.ptsUs, dados: paraU8(q.dados) };
        const anterior = somPend;
        somPend = atual;
        if (!anterior) {
          // A ÂNCORA, convertida uma vez: é o que põe as duas faixas no mesmo
          // instante em segundos, que é a única coisa que a `MediaSource`
          // compara para sincronizar A/V.
          somDts = emAmostras(atual.pts, escala);
          return null;
        }
        let dur = emAmostras(atual.pts - anterior.pts, escala);
        // Um quadro AAC-LC são 1024 amostras; qualquer coisa fora disso é
        // salto (para cima) ou carimbo repetido (para baixo). O piso de 1 vale
        // pelo mesmo motivo do vídeo: duração 0 é um buraco disfarçado.
        if (!(dur > 0)) dur = 1;
        return fragmentoSom(anterior, dur);
      },

      // Fecha o quadro AAC retido com uma duração arbitrada — o fim do fluxo, e
      // o oráculo de teste.
      esvaziarAudio: function (durAmostras) {
        if (!somPend || !somInit) return null;
        const q = somPend;
        somPend = null;
        return fragmentoSom(q, Math.max(1, durAmostras | 0));
      },

      pendenteAudio: function () { return !!somPend; },

      // Só o quadro retido — o `somInit` e o `somDts` FICAM. Quem solta a faixa
      // de som inteira é o cliente, e ele não desfaz o eixo de tempo por isso:
      // um `somDts` rebobinado seria um `tfdt` andando para trás.
      descartarAudio: function () { somPend = null; },
    };
  }

  global.AVFmp4 = {
    ESCALA: ESCALA,
    FAIXA: FAIXA,
    FAIXA_SOM: FAIXA_SOM,
    FLAGS_CHAVE: FLAGS_CHAVE,
    FLAGS_DELTA: FLAGS_DELTA,
    criar: criar,
    initVideo: initVideo,
    initAudio: initAudio,
    initCom: initCom,
    initSom: initSom,
    lerAsc: lerAsc,
    entradaAvc1: entradaAvc1,
    entradaMp4a: entradaMp4a,
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
