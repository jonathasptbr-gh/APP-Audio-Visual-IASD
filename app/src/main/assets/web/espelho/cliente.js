// ============================================================================
// O CLIENTE DO ESPELHO DE PIXELS (P6 do `docs/ESPELHO-DE-PIXELS.md`)
//
// Roda no navegador de QUEM ESTÁ NA REDE DA IGREJA — um tablet no fundo do
// salão, um notebook na sala anexa, a smart TV da recepção. Ele não é parte do
// app: é uma página servida por `http://<ip do celular>:8787/`, e tudo o que ela
// faz é (1) provar quem é, uma vez, e (2) transformar um fluxo binário infinito
// num `<video>`.
//
// ## As três coisas que este arquivo é, e as três que ele NÃO é
//
// É: o transporte (§5), a fila de `appendBuffer` serializada, e o estado
// desenhado em português na própria tela.
//
// NÃO é: um segundo telão. Ele não sabe o que é uma estrofe, uma cortina, um
// versículo ou um fade — nem tem como saber, porque o que atravessa a rede são
// PIXELS. É essa ignorância que faz o espelho não ter como ser parcial, e é ela
// que mantém a invariante 5 do `CLAUDE.md` intacta com um recurso inteiro a
// mais. NÃO é dono de relógio: o eixo de tempo é o `presentationTimeUs` do
// `MediaCodec` do celular, ele viaja em todo quadro e ninguém aqui o
// reconcilia com nada (§2.2). E NÃO tem canal de volta para o barramento de
// comandos: o upstream inteiro são três palavras — `key`, `alive`, `audio`.
// O cliente é somente-leitura de pixels (§3.6, invariante 8).
//
// ## O piso é `http://`, e isso governa cada linha
//
// A rede da igreja pode não ter internet num domingo, e certificado público
// para IP privado não existe (§2.4). Logo TUDO que a IDL marca
// `[SecureContext]` vem `undefined` aqui: `crypto.randomUUID`, `crypto.subtle`,
// `navigator.wakeLock`, `VideoDecoder`, `AudioWorklet`. A disciplina é a mesma
// do `if (!window.__NATIVE__)` do resto do projeto — o piso é o caminho
// principal, o melhor entra guardado por `isSecureContext`. Quem varre isto é
// `tools/contexto-seguro.test.mjs`.
//
// E a consequência boa, que é o motivo de o decodificador ser `MediaSource` e
// não WebCodecs: **um `<video>` tocando segura a tela acesa sem pedir permissão
// nenhuma** — o wake lock de vídeo do Chromium exige um `HTMLMediaElement` com
// vídeo, cobrindo a tela, e não pede contexto seguro. Um `<canvas>` não segura.
// É por isso que no MODO IMAGEM esta página avisa, por escrito, que a tela do
// aparelho pode apagar sozinha (§3.10, P25).
// ============================================================================
(function (global) {
  'use strict';

  const doc = global.document;

  // --------------------------------------------------------------------------
  // O PROTOCOLO (§5.2). Dezesseis bytes de cabeçalho, e o comprimento é NOSSO:
  // os limites de chunk do HTTP não coincidem com os limites de mensagem para
  // quem lê de um `ReadableStream`, então o prefixo é obrigatório.
  // --------------------------------------------------------------------------
  const CAB = 16;
  const T_CSD_VIDEO = 0x01;
  const T_VIDEO = 0x02;
  const T_CSD_AUDIO = 0x10;
  const T_AUDIO = 0x11;
  const T_JPEG = 0x20;
  const T_CONTROLE = 0x30;
  const F_CHAVE = 1;

  // Teto de sanidade para o campo de tamanho. Um IDR de 720p passa longe disto;
  // o que ele impede é um comprimento corrompido (ou um servidor que não é o
  // nosso) fazer o cliente acumular memória para sempre esperando bytes que
  // nunca vêm — falha silenciosa que terminaria em aba morta, sem mensagem.
  const CARGA_MAX = 8 * 1024 * 1024;

  // O token vive em `sessionStorage` e NUNCA numa URL (§3.5, invariante 2).
  // `sessionStorage` e não `localStorage` de propósito: o token tem prazo e
  // morre com a sessão do espelho — guardá-lo além da aba seria prometer uma
  // permanência que o servidor não dá.
  const CHAVE = 'av-espelho';

  const POLL_MS = 1200;                   // compasso do "já aprovaram?"
  const POLL_LIMITE = 5 * 60 * 1000;      // e o prazo para desistir de esperar

  // Espera crescente entre reconexões. Curta no começo porque a causa mais
  // comum é o servidor tendo reiniciado o encoder (segundos), longa no fim
  // porque a segunda causa mais comum é o operador ter desligado o espelho — e
  // martelar uma porta fechada gasta rádio de um AP de igreja.
  const RECONEXAO = [500, 1000, 2000, 4000, 8000];

  // A JANELA VIVA (§2.2). Cinco segundos de passado: o bastante para o
  // navegador ter margem de decodificação e pouco o suficiente para a cota do
  // MSE nunca ser o assunto. Na cota apertada (`QuotaExceededError`) a poda é
  // mais agressiva — dois segundos.
  const JANELA_S = 5;
  const GUARDA_S = 2;

  // A PERSEGUIÇÃO DA BORDA, por `playbackRate` e nunca por `currentTime`
  // (§3.11, invariante 6): escrever `currentTime` estala, e um estalo por
  // compasso durante duas horas é pior que meio segundo de atraso.
  const ALVO_S = 0.6;
  const TOL_S = 0.25;
  const RAPIDO = 1.08;                    // acima disto o áudio ficaria audivelmente rápido
  const LENTO = 0.97;
  const BORDA_MS = 500;

  // ...E A EXCEÇÃO, que é outra coisa e por isso tem outro nome. Quando o
  // atraso passa de oito segundos não há perseguição possível: a 1,08× seriam
  // minutos para alcançar. Isso acontece depois de a aba ter ficado congelada,
  // ou de uma reconexão longa — casos em que o quadro retido pelo muxer vira
  // uma amostra de vários segundos para NÃO abrir buraco no `buffered` (ver o
  // cabeçalho de `fmp4.js`). Fechar o buraco é o certo; a contrapartida é este
  // salto único, aqui, uma vez. Ele não é a perseguição — é a recuperação dela.
  const SALTO_S = 8;

  // Fila de append longa demais = este aparelho não dá conta do fluxo. Ver
  // `recomecar()`: a resposta NÃO é descartar fragmentos (isso abriria buraco,
  // que é exatamente o que o muxer trabalha para evitar), é recomeçar limpo.
  const FILA_MAX = 60;

  const ALIVE_MS = 5 * 60 * 1000;
  const CHAVE_MS = 2000;                  // freio do pedido de IDR (§3.6, invariante 9)

  // ---- O SOM (§3.9). Três números, e cada um existe por um modo de falhar ----
  //
  // 1. O quanto se SEGURA o `csd` de vídeo esperando o de áudio numa conexão em
  //    que esta tela já pediu som. Ele cobre a ida e a volta do `POST /r` que
  //    liga o áudio no servidor, e é o preço de as duas `SourceBuffer` terem de
  //    nascer JUNTAS (ver `abrirMidia`).
  const ESPERA_CSD_AUDIO_MS = 2500;
  // 2. Faixa de som aberta e NENHUM quadro AAC chegando por este tempo: o grafo
  //    do celular caiu. Sem soltar a faixa, o `<video>` PARA — a MSE só toca
  //    quando TODAS as faixas têm dado no instante atual, e a imagem morreria
  //    por causa do som. É a falha segura do §3.9 lida do lado do cliente.
  const AUDIO_MUDO_MS = 3000;
  // 3. E o mesmo, medido de outro jeito: a borda do som ficando este tanto
  //    atrás da borda da imagem.
  const ATRASO_AUDIO_S = 3;
  // Quantas vezes se aceita remontar a `MediaSource` para ligar o som numa
  // sessão. O gesto é UM, então uma remontagem basta; o teto existe para o dia
  // em que algo insista, porque um laço de remontagem seria a projeção piscando
  // sem parar por causa do recurso auxiliar.
  const REBUILDS_AUDIO = 3;

  // O relato cabe no corpo de 256 B que o `POST /par` aceita (§5.1), e a conta
  // é apertada de propósito — passar do teto não dá erro de validação, dá um
  // `close` seco do servidor, que na tela vira "não foi possível falar com o
  // celular". A conta, no pior caso: os campos fixos somam 141 caracteres
  // (booleanos todos `false`, tela de quatro dígitos), mais 15 do `pin` OU 10
  // do `qr`, mais até 3 de um `telaAcesaMin` de quatro dígitos. Sobram 97 para
  // o `ua`.
  //
  // 88, e não 97, porque a margem paga o escape de JSON (um `"` ou `\` no
  // User-Agent vira dois caracteres) e um campo futuro. O que se perde são os
  // últimos oito caracteres de um User-Agent — o motor e a versão, que é o que
  // interessa no Registro, vêm no COMEÇO em todo navegador atual.
  const UA_MAX = 88;

  // --------------------------------------------------------------------------
  // Elementos e estado
  // --------------------------------------------------------------------------
  const el = {};
  let token = '';
  let vivo = false;                       // o laço de conexão deve continuar?
  let abortar = null;                     // AbortController da conexão em curso
  let tentativa = 0;

  let muxer = null;
  let ms = null;
  let sbV = null;                         // a faixa de imagem
  let sbA = null;                         // a de som, quando esta tela pediu
  let mime = '';
  let mimeA = '';
  const fila = [];                        // itens `{ b: bytes, a: éÁudio }`
  let emVoo = null;                       // { tipo:'append'|'remove', a } | null
  let podaPedida = false;
  let cotaSeguidas = 0;
  let posicionado = false;
  let esperandoChave = true;
  let compasso = null;

  // O gesto do visitante pediu som? É a única coisa que faz esta tela receber
  // AAC — nada aqui liga o grafo de áudio do celular, que sobe sozinho com o
  // espelho (§3.9); o que o `POST /r {"do":"audio"}` liga é a ENTREGA para
  // ESTA tela (§3.6, invariante 10).
  let audioQuerido = false;
  let initVideoRetido = null;             // o `csd` de vídeo à espera do de áudio
  let esperaAudio = null;
  let audioDesde = 0;                     // quando a faixa de som abriu (vigia do mudo)
  let audioUltimoMs = 0;                  // e quando chegou o último quadro AAC
  let rebuilds = 0;

  let modoImagem = false;
  let ctx2d = null;
  let ultimaChave = 0;
  let gestoFeito = false;

  const conta = { quadros: 0, bytes: 0, recomecos: 0, reconexoes: 0, quadrosAudio: 0 };
  let acesaDesde = Date.now();
  let acesaMs = 0;

  // --------------------------------------------------------------------------
  // Utilidades
  // --------------------------------------------------------------------------

  function dormir(ms2) { return new Promise((r) => setTimeout(r, ms2)); }

  function texto(id, s, ruim) {
    const e = el[id];
    if (!e) return;
    e.textContent = s || '';
    e.classList.toggle('ruim', !!ruim);
  }

  // O ESTADO DESENHADO. Com o celular do outro lado do salão, esta linha é a
  // única resposta possível para "por que a tela está preta?" — e por isso ela
  // diz a CAUSA, não "erro".
  function avisar(s, ruim) {
    texto('aviso', s, ruim);
    if (el.aviso) el.aviso.classList.toggle('some', !ruim && !s);
    // A frase que apareceu aqui vale mais no Registro do operador do que nesta
    // tela: quem está com o celular na mão é quem pode agir. `relatar` só
    // envia quando ela de fato muda.
    try { relatar(); } catch (_) { /* antes do token não há para onde mandar */ }
  }

  // A FRASE DO SOM É PEGAJOSA, e as outras não. Toda conexão bem-sucedida
  // limpa o aviso (`avisar('')`), porque o que ele carregava era "sem sinal" —
  // um evento. "Esta tela está sem som" é um ESTADO: some junto no primeiro
  // reconecte e o visitante nunca fica sabendo por que não ouve nada. Guardá-la
  // aqui é o que faz ela voltar depois de cada limpeza.
  let avisoSom = '';

  function semSom(frase) {
    avisoSom = frase || '';
    avisar(avisoSom);
  }

  // O "limpar a tela" de sempre, que agora repõe o estado do som por baixo.
  function limparAviso() {
    avisar(avisoSom);
  }

  // `sessionStorage` pode LANÇAR (modo privado de alguns navegadores, cota
  // zerada por política corporativa). Um espelho que não abre porque o
  // armazenamento é hostil seria um defeito gratuito: sem ele o token vive só
  // na memória desta aba, que é quase a mesma coisa.
  function guardado(v) {
    try {
      if (v === undefined) return global.sessionStorage.getItem(CHAVE) || '';
      if (v) global.sessionStorage.setItem(CHAVE, v);
      else global.sessionStorage.removeItem(CHAVE);
    } catch (_) { /* memória só */ }
    return v || '';
  }

  function minutosAcesa() {
    const agora = doc.visibilityState === 'visible' ? Date.now() - acesaDesde : 0;
    return Math.round((acesaMs + agora) / 60000);
  }

  function temMediaSource() {
    return typeof (global.ManagedMediaSource || global.MediaSource) === 'function';
  }

  function suporta(m) {
    const MS = global.ManagedMediaSource || global.MediaSource;
    try { return !!MS && MS.isTypeSupported(m); } catch (_) { return false; }
  }

  // Fluxos de `fetch`. Numa TV velha isto é `false`, e aí NADA funciona — nem o
  // modo imagem, que usa o MESMO transporte (§3.11, invariante 12). O cliente
  // se relata assim mesmo, porque é esse relato que responde, no Registro do
  // operador e sem ninguém abrir console numa TV, qual navegador aquela TV tem.
  function temFluxo() {
    try {
      return typeof global.ReadableStream === 'function'
        && !!global.Response && 'body' in global.Response.prototype;
    } catch (_) { return false; }
  }

  // §5.5 — uma vez no pareamento, e depois a cada 5 min como `alive`.
  function relato() {
    return {
      ua: (global.navigator.userAgent || '').slice(0, UA_MAX),
      w: (global.screen && global.screen.width) | 0,
      h: (global.screen && global.screen.height) | 0,
      seguro: !!global.isSecureContext,
      mse: temMediaSource(),
      mms: typeof global.ManagedMediaSource === 'function',
      fetchStream: temFluxo(),
      // As duas linhas abaixo NOMEIAM APIs de contexto seguro sem chamá-las: em
      // `http://` as duas vêm `undefined` e o relato registra `false`, que é
      // exatamente o dado que o operador precisa ver. A guarda está na mesma
      // linha de propósito — ela é o que diz que isto é detecção, não uso.
      videoDecoder: !!global.isSecureContext && typeof global.VideoDecoder === 'function',
      wakeLock: !!global.isSecureContext && !!(global.navigator.wakeLock),
      telaAcesaMin: minutosAcesa(),
    };
  }

  async function postar(rota, corpo, comToken) {
    const cab = { 'Content-Type': 'application/json' };
    if (comToken && token) cab.Authorization = 'Bearer ' + token;
    const r = await fetch(rota, {
      method: 'POST', headers: cab, cache: 'no-store', body: JSON.stringify(corpo),
    });
    let json = null;
    try { json = await r.json(); } catch (_) { json = null; }
    return { status: r.status, corpo: json };
  }

  // --------------------------------------------------------------------------
  // PAREAMENTO (§5.4) — o operador fica no laço, e é ele quem aprova
  // --------------------------------------------------------------------------

  // ---- O QR: quem MOSTRA é esta tela, e quem LÊ é o celular ----------------
  //
  // A inversão é o recurso inteiro. No PIN, o celular exibia um segredo curto
  // durante todo o culto e alguém o digitava aqui — num teclado de controle
  // remoto, do outro lado do salão. Aqui esta página pede um `id` de espera,
  // desenha, e espera a câmera do operador. O `id` NÃO é segredo (o servidor o
  // devolve a quem pedir): o que autoriza é o operador ter apontado a câmera
  // para ESTA tela, que é a mesma decisão que ele já tomava na folha.
  //
  // O prefixo `AVE1:` existe para o app poder RECUSAR um QR qualquer — um
  // cartaz, uma nota fiscal, o Wi-Fi da igreja — em vez de mandar um texto
  // aleatório como id de aprovação.
  const QR_PREFIXO = 'AVE1:';
  // A espera do servidor vence em 5 min; o desenho é refeito antes disso para
  // nunca haver um QR em cartaz que já não vale. Um código que "não funciona"
  // sem dizer por quê é o pior desfecho possível para este recurso.
  const QR_RENOVA_MS = 4 * 60 * 1000;
  // E a espera entre tentativas quando o pedido falha (espelho ainda subindo,
  // rede associando). Curta: é a primeira coisa que acontece na tela.
  const QR_RETENTA_MS = 4000;

  let qrVivo = false;
  let qrId = '';

  function mostrarQr(id) {
    qrId = id || '';
    if (!el.qrBox || !el.qr) return;
    if (!qrId || !global.AVQr) { el.qrBox.hidden = true; return; }
    try {
      // As cores do QR são as do PALCO (preto sobre branco), e não as da
      // paleta: contraste máximo é requisito de leitura, não escolha de estilo.
      // É a mesma exceção que `--stage-text: #fff` já declara.
      global.AVQr.pintar(el.qr, QR_PREFIXO + qrId, '#000000', '#ffffff');
      el.qrBox.hidden = false;
    } catch (_) {
      el.qrBox.hidden = true;
    }
  }

  /**
   * O laço do QR: pede uma espera, desenha, enquete a aprovação, e renova antes
   * de a espera vencer. Roda até alguém entrar (por aqui ou pelo PIN).
   *
   * Ele NÃO desabilita o campo do PIN nem compete com ele: os dois caminhos
   * criam esperas independentes, e a primeira que for aprovada ganha. Quem
   * cancela o outro é o `qrVivo`, conferido depois de cada `await`.
   */
  async function cicloQr() {
    if (qrVivo || !el.qrBox) return;
    qrVivo = true;
    while (qrVivo) {
      let r;
      try {
        const corpo = relato();
        corpo.qr = true;
        r = await postar('/par', corpo, false);
      } catch (_) { r = { status: 0 }; }
      if (!qrVivo) return;

      if (!(r.status === 202 && r.corpo && r.corpo.espera)) {
        // Sem QR, a tela ainda tem o PIN — e precisa DIZER isso, porque um
        // espaço vazio onde deveria haver um código não explica nada.
        mostrarQr('');
        if (el.pinBox) el.pinBox.open = true;
        texto('parMsg', 'O código não pôde ser gerado agora. Use os seis dígitos abaixo.');
        await dormir(QR_RETENTA_MS);
        continue;
      }

      const id = String(r.corpo.espera);
      mostrarQr(id);
      texto('parMsg', 'Esperando a leitura no celular…');
      const ate = Date.now() + QR_RENOVA_MS;
      let entrou = false;
      while (qrVivo && Date.now() < ate) {
        await dormir(POLL_MS);
        if (!qrVivo) return;
        let p;
        try { p = await postar('/par', { espera: id }, false); } catch (_) { p = { status: 0 }; }
        if (p.status === 200 && p.corpo && p.corpo.t) {
          token = String(p.corpo.t);
          guardado(token);
          entrou = true;
          break;
        }
        // 403 aqui é o operador tendo RECUSADO esta tela, ou a espera vencida.
        // Nos dois casos a resposta certa é pedir um código novo, não desistir:
        // esta página é uma TV que ninguém vai atender, e ela precisa continuar
        // oferecendo uma forma de entrar.
        if (p.status === 403) break;
      }
      if (entrou) { pararQr(); aoPlayer(); return; }
    }
  }

  function pararQr() {
    qrVivo = false;
    qrId = '';
    if (el.qrBox) el.qrBox.hidden = true;
  }

  async function parear() {
    const pin = (el.pin.value || '').replace(/[^0-9]/g, '');
    if (pin.length !== 6) { texto('parMsg', 'São seis dígitos.', true); return; }
    el.parBtn.disabled = true;
    texto('parMsg', 'Enviando…');
    let r;
    try {
      const corpo = relato();
      corpo.pin = pin;
      r = await postar('/par', corpo, false);
    } catch (_) {
      // A causa quase sempre é a rede, não o código. Dizer isso poupa o
      // visitante de digitar o PIN mais três vezes.
      texto('parMsg', 'Não foi possível falar com o celular. Confira a rede e tente de novo.', true);
      el.parBtn.disabled = false;
      return;
    }
    if (r.status === 202 && r.corpo && r.corpo.espera) {
      await aguardar(String(r.corpo.espera));
      return;
    }
    // O servidor responde 403 tanto para PIN errado quanto para origem
    // bloqueada por tentativas (§3.5, invariante 6). A mensagem cobre os dois
    // sem afirmar qual é — e é o servidor que decide se ainda aceita.
    texto('parMsg', 'Código não confere. Confira o número na tela do celular.', true);
    el.parBtn.disabled = false;
  }

  async function aguardar(id) {
    texto('parMsg', 'Aguardando a aprovação no celular…');
    const ate = Date.now() + POLL_LIMITE;
    for (;;) {
      await dormir(POLL_MS);
      let r;
      try { r = await postar('/par', { espera: id }, false); } catch (_) { r = { status: 0 }; }
      if (r.status === 200 && r.corpo && r.corpo.t) {
        token = String(r.corpo.t);
        guardado(token);
        pararQr();
        aoPlayer();
        return;
      }
      if (r.status === 403) {
        texto('parMsg', 'A tela não foi liberada.', true);
        el.parBtn.disabled = false;
        return;
      }
      if (Date.now() > ate) {
        texto('parMsg', 'Ninguém respondeu no celular. Tente de novo.', true);
        el.parBtn.disabled = false;
        return;
      }
    }
  }

  function aoPareamento(motivo) {
    parar();
    el.play.hidden = true;
    el.par.hidden = false;
    doc.body.classList.remove('projetando');
    el.parBtn.disabled = false;
    el.pin.value = '';
    if (motivo) texto('parMsg', motivo, true);
    // O QR volta ao ar SEM esperar toque: uma tela que caiu (sessão vencida,
    // espelho desligado e religado) é justamente a que ninguém está olhando —
    // e a que o operador vai querer readmitir apontando a câmera de novo.
    pararQr();
    cicloQr();
  }

  function aoPlayer() {
    el.par.hidden = true;
    el.play.hidden = false;
    avisar('Conectando…');
    comecar();
  }

  // --------------------------------------------------------------------------
  // A MÍDIA — `MediaSource`, fila de append serializada, poda, borda
  //
  // ## AS DUAS `SourceBuffer` NASCEM JUNTAS, E ISSO GOVERNA O RESTO
  //
  // Não é escolha de estilo: **o Chromium recusa `addSourceBuffer` depois que a
  // `MediaSource` inicializou** (o `ChunkDemuxer` só aceita ids novos enquanto
  // está esperando os segmentos de inicialização; depois disso vem
  // `QuotaExceededError`). É por isso que hls.js e o Shaka criam todas as
  // faixas de uma vez. Daí as três consequências que o código abaixo carrega:
  //
  //  1. quando esta tela ainda não pediu som, a `MediaSource` nasce **só com
  //     vídeo** — e é o caso da maioria das telas, que ficam mudas por decisão
  //     (§3.11, invariante 10);
  //  2. o gesto que liga o som **remonta** a `MediaSource` uma vez. Pisca, e
  //     pisca no instante exato em que o visitante tocou na tela esperando algo
  //     acontecer;
  //  3. numa conexão em que o som JÁ é querido, o `csd` de vídeo fica RETIDO
  //     por até `ESPERA_CSD_AUDIO_MS` esperando o de áudio, porque os dois
  //     precisam estar em mãos antes do primeiro `appendBuffer`.
  //
  // E o outro lado da mesma moeda, que é o que mantém a falha segura do §3.9:
  // a MSE só toca quando **todas** as faixas têm dado no instante atual, então
  // uma faixa de som que pare de receber **para a imagem**. Quem impede isso é
  // o vigia de [soltarAudio] — sem som é ruim, sem imagem é o culto.

  // A `MediaSource` SOBREVIVE ÀS RECONEXÕES, e isso não é economia: o carimbo
  // de tempo do fio é absoluto (base do PROCESSO do celular, §5.2), então
  // depois de uma queda o fluxo continua na MESMA linha do tempo. Recriá-la a
  // cada reconexão jogaria fora o passado e piscaria a tela à toa; mantendo-a,
  // o quadro que o muxer reteve antes da queda é fechado com a duração real do
  // buraco e o `buffered` continua sendo um intervalo só.
  //
  // [infoA] é o descritor da faixa de som, ou `null` — e `null` é o caminho
  // normal: quem não pediu som não ganha faixa de som.
  function abrirMidia(infoV, infoA) {
    if (ms) {
      // Reconexão: o `csd` chega de novo em toda conexão (§5.3). Reenviar o
      // segmento de inicialização é legal em MSE e é o que mantém a
      // `SourceBuffer` viva do outro lado de uma troca de encoder.
      if (infoV.mime === mime) { enfileirar(infoV.bytes, false); return; }
      // Mime diferente é resolução/perfil trocados — proibido durante a sessão
      // (§3.2, invariante 3). Se acontecer, recomeçar é a única saída honesta.
      recomecar('o formato do vídeo mudou');
      return;
    }
    if (!temMediaSource()) {
      avisar('Este navegador não sabe receber vídeo ao vivo. Peça o modo imagem.', true);
      return;
    }
    if (!suporta(infoV.mime)) {
      // Acontece de verdade: o Chromium de código aberto (o do CI, e o de
      // algumas TVs) não traz H.264. Dizer QUAL é o formato é o que transforma
      // "não funciona" num pedido concreto.
      avisar('Este navegador não decodifica ' + infoV.codec + '. Peça o modo imagem.', true);
      return;
    }
    // UM NAVEGADOR PODE TER O VÍDEO E NÃO O ÁUDIO. Nesse caso o som cai fora
    // AQUI, antes de existir faixa nenhuma — nunca depois, que é quando ele
    // levaria a imagem junto.
    let som = infoA;
    if (som && !suporta(som.mime)) {
      semSom('Esta tela fica sem som: o navegador não decodifica ' + som.codec + '.');
      som = null;
    }
    mime = infoV.mime;
    mimeA = som ? som.mime : '';
    const MS = global.ManagedMediaSource || global.MediaSource;
    ms = new MS();
    // `disableRemotePlayback` e os dois eventos abaixo são o que o
    // `ManagedMediaSource` do iOS 17+ exige para sequer começar — e no resto
    // dos navegadores não custam nada (§3.11, invariante 7).
    try { el.v.disableRemotePlayback = true; } catch (_) {}
    ms.addEventListener('startstreaming', () => { aplicar(); });
    ms.addEventListener('endstreaming', () => {});
    ms.addEventListener('sourceopen', function () {
      try {
        sbV = prepararBuffer(mime, false);
      } catch (e) {
        avisar('Não deu para preparar o vídeo (' + ((e && e.message) || '?') + ').', true);
        return;
      }
      if (som) {
        try {
          sbA = prepararBuffer(som.mime, true);
          audioDesde = Date.now();
          audioUltimoMs = 0;
        } catch (e) {
          // O SOM CAI SOZINHO, e a imagem segue. É a falha segura inteira numa
          // linha: nada aqui derruba a `MediaSource` que já tem vídeo.
          sbA = null;
          mimeA = '';
          som = null;
          semSom('Esta tela ficou sem som (' + ((e && e.name) || '?') + ').');
        }
      }
      // OS DOIS `appendBuffer` SÓ AGORA: enquanto os dois ids não tiverem
      // recebido o segmento de inicialização, a `MediaSource` não inicializa —
      // e enfileirar o vídeo antes de o `addSourceBuffer` do som ter acontecido
      // seria correr contra isso à toa.
      enfileirar(infoV.bytes, false);
      if (som) enfileirar(som.bytes, true);
      aplicar();
    }, { once: true });
    el.v.src = URL.createObjectURL(ms);
  }

  function prepararBuffer(tipo, ehAudio) {
    const b = ms.addSourceBuffer(tipo);
    // `segments`, NUNCA `sequence`: nossos fragmentos carregam o `tfdt`
    // absoluto do relógio mestre, e `sequence` mandaria o navegador
    // inventar os tempos — destruindo de graça a sincronia que a
    // `MediaSource` existe para dar.
    b.mode = 'segments';
    b.addEventListener('updateend', aoTerminar);
    b.addEventListener('error', function () {
      // Um erro NA FAIXA DE SOM não pode derrubar a projeção — solta-se o som.
      // Na de imagem não há o que salvar, e recomeçar limpo é a saída.
      if (ehAudio) soltarAudio('o decodificador recusou o som');
      else recomecar('o decodificador recusou os dados');
    });
    return b;
  }

  function enfileirar(bytes, ehAudio) {
    fila.push({ b: bytes, a: !!ehAudio });
    if (fila.length > FILA_MAX) { recomecar('esta tela não está dando conta do fluxo'); return; }
    aplicar();
  }

  // A FILA SERIALIZADA. `appendBuffer` com `updating === true` lança
  // `InvalidStateError` (spec MSE) — e `remove()` disputa o mesmo estado. O
  // idioma já existe na casa (`shared/mse.js`, `f.ocupada` + `aplicar()`); o
  // que muda aqui é que a poda entra na MESMA fila, senão ela e o append se
  // atropelam no primeiro `QuotaExceededError`.
  //
  // Com duas faixas a fila continua sendo UMA, e uma operação em voo por vez —
  // não duas em paralelo, uma por buffer. Cada item sabe o próprio destino, a
  // ordem de chegada é preservada, e o `updateend` de qualquer um dos dois cai
  // no mesmo lugar sem ambiguidade sobre o que acabou.
  function aplicar() {
    if (!sbV || emVoo || !ms || ms.readyState !== 'open') return;
    if (podaPedida) {
      podaPedida = false;
      if (podar(cotaSeguidas > 0)) return;
    }
    while (fila.length) {
      const it = fila[0];
      const alvo = it.a ? sbA : sbV;
      // O destino sumiu (a faixa de som foi solta): o item vai fora. Segurá-lo
      // travaria a fila inteira, e com ela a imagem.
      if (!alvo) { fila.shift(); continue; }
      if (alvo.updating) return;
      emVoo = { tipo: 'append', a: it.a };
      try {
        alvo.appendBuffer(it.b);
      } catch (e) {
        emVoo = null;
        // `QuotaExceededError` é ESPERADO, não é falha: o MSE tem cota e um
        // fluxo infinito a atinge por construção. A resposta é podar o passado
        // e tentar o MESMO buffer de novo — ele continua na cabeça da fila.
        if (e && e.name === 'QuotaExceededError') {
          cotaSeguidas++;
          podaPedida = true;
          // Poda que não libera nada três vezes seguidas significa que não há
          // passado a podar (o cursor ainda está no começo). Insistir seria um
          // laço quente; recomeçar limpo é a saída.
          if (cotaSeguidas > 3) { recomecar('a memória de vídeo deste navegador encheu'); return; }
          aplicar();
          return;
        }
        recomecar('o navegador recusou os dados (' + ((e && e.name) || '?') + ')');
      }
      return;
    }
  }

  function aoTerminar() {
    const era = emVoo;
    emVoo = null;
    if (era && era.tipo === 'append') { fila.shift(); cotaSeguidas = 0; }
    posicionar();
    aplicar();
  }

  function faixaDe(alvo) {
    if (!alvo) return null;
    try {
      const b = alvo.buffered;
      return b && b.length ? b : null;
    } catch (_) { return null; }
  }

  // Uma poda por giro, na faixa que precisar — as duas entram na mesma fila
  // serializada, e o compasso de meio segundo dá conta das duas de sobra.
  function podar(agressiva) {
    const limite = el.v.currentTime - (agressiva ? GUARDA_S : JANELA_S);
    const alvos = [sbV, sbA];
    for (let i = 0; i < alvos.length; i++) {
      const alvo = alvos[i];
      if (!alvo || alvo.updating) continue;
      const b = faixaDe(alvo);
      if (!b) continue;
      if (!(limite > b.start(0) + 0.05)) continue;
      try {
        emVoo = { tipo: 'remove', a: alvo === sbA };
        alvo.remove(0, limite);
        return true;
      } catch (_) { emVoo = null; }
    }
    return false;
  }

  // O POSICIONAMENTO INICIAL — e ele NÃO é a perseguição da borda.
  //
  // O `tfdt` do fio é absoluto: uma tela que entra 40 minutos depois de o
  // espelho ligar recebe fragmentos que começam em t = 2400 s. O elemento nasce
  // em `currentTime = 0`, que não está em intervalo bufferizado nenhum — e um
  // `<video>` fora do buffer não toca, não erra e não avisa. Um posicionamento,
  // uma vez, é a única forma de entrar na linha do tempo. Rebasear o carimbo no
  // cliente seria a alternativa, e ela custaria uma SEGUNDA linha do tempo para
  // reconciliar em toda reconexão — que é justamente o que o §2.2 recusa.
  //
  // COM SOM, O PONTO É O MAIS TARDE DOS DOIS. O áudio começa a chegar depois da
  // imagem (ele passa por um `POST` de ida e volta), então o começo da faixa de
  // som é POSTERIOR ao da imagem — e um `currentTime` antes dele deixaria a
  // faixa de som sem dado no instante atual: a MSE não toca, o cursor não anda,
  // e como o cursor não anda ele nunca alcança o som. Trava para sempre, sem
  // erro nenhum. Entrar pelo mais tarde dos dois é o que fecha essa porta.
  function posicionar() {
    if (posicionado || !sbV) return;
    const bv = faixaDe(sbV);
    if (!bv) return;
    let ini = bv.start(0);
    if (sbA) {
      const ba = faixaDe(sbA);
      // Sem som ainda: ESPERAR. Quem desiste é o vigia de [soltarAudio], e ele
      // desiste com prazo — não aqui, calado.
      if (!ba) return;
      ini = Math.max(ini, ba.start(0));
    }
    posicionado = true;
    try { el.v.currentTime = ini; } catch (_) {}
    tocar();
  }

  // O VIGIA DO SOM. Duas perguntas, a mesma resposta.
  //
  // Ele existe porque a MSE não toca sem dado em TODAS as faixas: um grafo de
  // áudio que caiu no celular (contexto suspenso, WebView remontado, encoder
  // AAC solto) congelaria a IMAGEM em três telas da igreja. Soltar a faixa de
  // som devolve a imagem na hora, e o cliente DIZ que ficou sem som — nunca
  // fica quieto, porque "sem som" e "travado" são a mesma tela preta para quem
  // está olhando.
  function vigiarAudio() {
    if (!sbA || !ms || ms.readyState !== 'open') return;
    const agora = Date.now();
    const ba = faixaDe(sbA);
    if (!ba) {
      // Faixa aberta que nunca recebeu um quadro: o `csd` veio e o áudio não.
      if (audioDesde && agora - audioDesde > AUDIO_MUDO_MS) soltarAudio('o som não chegou');
      return;
    }
    if (audioUltimoMs && agora - audioUltimoMs > AUDIO_MUDO_MS) {
      soltarAudio('o som parou de chegar');
      return;
    }
    const bv = faixaDe(sbV);
    if (bv && bv.end(bv.length - 1) - ba.end(ba.length - 1) > ATRASO_AUDIO_S) {
      soltarAudio('o som ficou para trás');
    }
  }

  // Solta a faixa de som SEM tocar na de imagem. `removeSourceBuffer` numa
  // `MediaSource` aberta é operação normal da spec, e o que ela custa é a
  // faixa de áudio sumir do elemento — que é exatamente o pedido.
  function soltarAudio(porque) {
    if (!sbA) return;
    const morto = sbA;
    sbA = null;
    mimeA = '';
    audioDesde = 0;
    audioUltimoMs = 0;
    // Os fragmentos de som que ainda estavam na fila vão fora com ela; o
    // `aplicar` já os descartaria, e tirá-los aqui é o que impede a fila de
    // encostar no `FILA_MAX` por causa de uma faixa que não existe mais.
    for (let i = fila.length - 1; i >= 0; i--) if (fila[i].a) fila.splice(i, 1);
    if (emVoo && emVoo.a) emVoo = null;
    if (muxer) muxer.descartarAudio();
    try { ms.removeSourceBuffer(morto); } catch (_) { /* já saiu com a MediaSource */ }
    semSom('Esta tela ficou sem som (' + porque + ') — a imagem continua.');
    aplicar();
  }

  function tocar() {
    const p = el.v.play();
    // O cliente nasce MUDO e tocando: "muted autoplay is always allowed". Se
    // ainda assim for barrado, o botão de gesto é a saída — e ele já está na
    // tela.
    if (p && p.catch) p.catch(() => { avisar('Toque na tela para começar.'); });
  }

  function borda() {
    if (!sbV || !ms || ms.readyState !== 'open') return;
    // O VIGIA VEM ANTES DA PERSEGUIÇÃO: com a faixa de som travando o elemento,
    // o `currentTime` não anda, e perseguir uma borda a partir de um cursor
    // congelado só produziria um salto atrás do outro.
    vigiarAudio();
    // E o posicionamento pode ter ficado esperando o som entrar (ver
    // `posicionar`); depois de soltar a faixa, ele precisa de alguém que o
    // chame de novo — o `updateend` sozinho não basta quando não há mais o que
    // appendar.
    posicionar();
    const b = faixaDe(sbV);
    if (!b) return;
    const fim = b.end(b.length - 1);
    const atraso = fim - el.v.currentTime;

    if (el.v.paused && posicionado) tocar();

    if (atraso > SALTO_S) {
      // A recuperação, não a perseguição — ver o comentário de `SALTO_S`.
      try { el.v.currentTime = fim - ALVO_S; } catch (_) {}
      el.v.playbackRate = 1;
    } else if (atraso > ALVO_S + TOL_S) {
      el.v.playbackRate = RAPIDO;
    } else if (atraso < ALVO_S - TOL_S) {
      el.v.playbackRate = LENTO;
    } else {
      el.v.playbackRate = 1;
    }

    // A JANELA NAVEGÁVEL sai daqui, e NÃO de `ms.duration`: ao vivo não se
    // escreve duração e não se chama `endOfStream()` (§3.11, invariante 5) —
    // é o ponto exato em que copiar o `shared/mse.js`, que tem duração, daria
    // errado.
    if (typeof ms.setLiveSeekableRange === 'function') {
      try { ms.setLiveSeekableRange(b.start(0), fim); } catch (_) {}
    }
    podaPedida = true;
    aplicar();
  }

  // --------------------------------------------------------------------------
  // MODO IMAGEM (Entrega 1) — o MESMO transporte, quadros 0x20
  // --------------------------------------------------------------------------

  function aoModoImagem() {
    if (modoImagem) return;
    modoImagem = true;
    el.v.hidden = true;
    el.foto.hidden = false;
    ctx2d = el.foto.getContext('2d');
    // A RESSALVA DITA NA PRÓPRIA PÁGINA (§3.10, P25): um `<canvas>` não é
    // `HTMLMediaElement`, e o wake lock de vídeo do navegador não vale para ele.
    // Sem esta frase, a primeira coisa que chega ao operador é "não funciona".
    avisar('Modo imagem — nesta modalidade a tela deste aparelho pode apagar sozinha.');
  }

  function desenhar(bitmap) {
    if (!ctx2d) return;
    if (el.foto.width !== bitmap.width || el.foto.height !== bitmap.height) {
      el.foto.width = bitmap.width;
      el.foto.height = bitmap.height;
    }
    ctx2d.drawImage(bitmap, 0, 0);
    if (bitmap.close) bitmap.close();
  }

  function jpeg(carga) {
    aoModoImagem();
    const blob = new Blob([carga], { type: 'image/jpeg' });
    // `createImageBitmap` não é de contexto seguro e existe desde sempre no
    // Chromium; o piso do `<img>` cobre a TV velha, que é justamente o aparelho
    // para o qual o modo imagem existe.
    if (typeof global.createImageBitmap === 'function') {
      global.createImageBitmap(blob).then(desenhar).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () { desenhar(img); URL.revokeObjectURL(url); };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  // --------------------------------------------------------------------------
  // A VOLTA (§5.1, `POST /r`) — três palavras, e nenhuma delas entra no
  // barramento de comandos do app
  // --------------------------------------------------------------------------

  function pedirChave() {
    const agora = Date.now();
    if (agora - ultimaChave < CHAVE_MS) return;
    ultimaChave = agora;
    postar('/r', { do: 'key' }, true).catch(() => {});
  }

  // "Entregue AAC para ESTA tela." Não liga grafo nenhum no celular — o áudio
  // do espelho sobe com o espelho (§3.9); o que isto abre é a torneira desta
  // tela, e o servidor responde empurrando o `csd` de áudio guardado.
  function pedirAudio() {
    // No MODO IMAGEM não há `MediaSource` nem faixa de som — pedir AAC seria
    // pedir bytes para jogar fora. (Do outro lado o canal de áudio nem chega a
    // ser instalado naquele modo, então isto é cinto e suspensório.)
    if (modoImagem) return;
    postar('/r', { do: 'audio', on: true }, true).catch(() => {});
  }

  let ultimoAlive = 0;

  // O QUE ESTA TELA ESTÁ VENDO, dito ao celular.
  //
  // Até aqui o Registro do operador respondia só o que o SERVIDOR sabia de cada
  // tela: bytes escritos, descartes, quando foi o último write. Nada disso
  // distingue "a tela está projetando" de "a tela está num laço de reconexão
  // dizendo que não recebeu som" — e foi exatamente essa a pergunta que ficou
  // sem resposta no primeiro culto de teste, com o celular jurando que mandava
  // AAC e a tela jurando que não recebia. O canal já existia (`alive`); o que
  // faltava era o cliente contar o próprio estado por ele.
  //
  // Três campos, e só três: a frase que está na tela (que é onde o cliente já
  // escreve a causa), se a faixa de som existe, e quantos recomeços ele já deu.
  // O texto é cortado aqui e SANEADO no Kotlin, como todo texto vindo da rede.
  const AVISO_MAX = 110;

  function corpoDoAlive() {
    return {
      do: 'alive',
      telaAcesaMin: minutosAcesa(),
      aviso: (el.aviso ? el.aviso.textContent || '' : '').slice(0, AVISO_MAX),
      som: !!sbA,
      recomecos: conta.recomecos,
    };
  }

  function bater() {
    if (!vivo || !token) return;
    postar('/r', corpoDoAlive(), true).catch(() => {});
  }

  // E ele é enviado também A CADA CONEXÃO e a cada troca da frase, não só de
  // cinco em cinco minutos: uma tela que reconecta a cada três segundos é
  // justamente a que o operador precisa enxergar, e um relato que chega no
  // quinto minuto chegaria depois do culto. O freio é o próprio evento — o
  // corpo é minúsculo e só sai quando algo de fato mudou.
  let ultimoRelato = ' ';

  function relatar() {
    if (!vivo || !token) return;
    const chave = (el.aviso ? el.aviso.textContent || '' : '') + '|' + (sbA ? '1' : '0');
    if (chave === ultimoRelato) return;
    ultimoRelato = chave;
    postar('/r', corpoDoAlive(), true).catch(() => {});
  }

  // --------------------------------------------------------------------------
  // O FLUXO: desmontar `[16 B][carga]` de um `ReadableStream`
  // --------------------------------------------------------------------------

  const pedacos = [];
  let disponivel = 0;
  let cabecalho = null;

  function tirar(n) {
    const saida = new Uint8Array(n);
    let o = 0;
    while (o < n) {
      const p = pedacos[0];
      const quanto = Math.min(p.length, n - o);
      saida.set(p.subarray(0, quanto), o);
      if (quanto === p.length) pedacos.shift();
      else pedacos[0] = p.subarray(quanto);
      o += quanto;
    }
    disponivel -= n;
    return saida;
  }

  function u32(b, o) {
    return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  }

  function processar() {
    for (;;) {
      if (!cabecalho) {
        if (disponivel < CAB) return;
        const h = tirar(CAB);
        cabecalho = {
          tipo: h[0],
          chave: (h[1] & F_CHAVE) !== 0,
          tam: u32(h, 4),
          // Dois uint32 e não um uint64: evita `BigInt` no cliente, e 2^53 µs
          // são 285 anos de folga (§5.2).
          pts: u32(h, 8) * 4294967296 + u32(h, 12),
        };
        if (cabecalho.tam > CARGA_MAX) {
          cabecalho = null;
          throw new Error('quadro maior que o teto — o fluxo saiu de sincronia');
        }
      }
      if (disponivel < cabecalho.tam) return;
      const carga = tirar(cabecalho.tam);
      const q = cabecalho;
      cabecalho = null;
      receber(q, carga);
    }
  }

  function receber(q, carga) {
    conta.bytes += carga.length + CAB;
    if (q.tipo === T_CSD_VIDEO) {
      const info = muxer.csd(carga);
      if (!info) { avisar('O sinal veio sem os parâmetros do vídeo.', true); return; }
      // A RETENÇÃO: esta tela já pediu som e a `MediaSource` ainda não existe,
      // então as duas faixas têm de nascer juntas — e o `csd` de áudio vem logo
      // atrás, assim que o `POST /r` desta conexão der a volta. Segurar aqui
      // custa milissegundos; abrir só com vídeo custaria uma remontagem.
      if (!ms && audioQuerido && !esperaAudio) {
        initVideoRetido = info;
        esperaAudio = setTimeout(function () {
          esperaAudio = null;
          const retido = initVideoRetido;
          initVideoRetido = null;
          if (!retido || ms) return;
          // O som não veio: o grafo do celular não subiu (§3.9 — o handshake
          // que libera o `forceMuted` nunca chegou). Abre-se só com imagem, e
          // se diz isso: mudo é um estado, não um defeito escondido.
          semSom('Esta tela está sem som — o celular não está enviando áudio.');
          abrirMidia(retido, null);
        }, ESPERA_CSD_AUDIO_MS);
        return;
      }
      abrirMidia(info, null);
      return;
    }
    if (q.tipo === T_VIDEO) {
      // MANDAR BYTES ANTES DO IDR PRODUZ LIXO VERDE (§5.3). O servidor já
      // segura, e o cliente confere de novo — o custo é um `if` e o benefício é
      // que uma reconexão no meio de um GOP nunca pinta lixo na frente de
      // ninguém.
      if (esperandoChave) {
        if (!q.chave) return;
        esperandoChave = false;
      }
      conta.quadros++;
      tentativa = 0;                      // quadro de verdade: a espera zera
      const frag = muxer.quadro({ ptsUs: q.pts, chave: q.chave, dados: carga });
      if (frag) enfileirar(frag);
      if (conta.quadros === 1) limparAviso();
      return;
    }
    if (q.tipo === T_JPEG) {
      conta.quadros++;
      tentativa = 0;
      jpeg(carga);
      return;
    }
    // O ÁUDIO (§3.9): uma SEGUNDA `SourceBuffer` da MESMA `MediaSource`, com o
    // AAC vindo pronto do `MediaCodec` do celular. A sincronia A/V é do
    // NAVEGADOR — uma `MediaSource`, uma linha do tempo —, e é por isso que
    // isto custa dez linhas em vez das duzentas de um relógio próprio.
    if (q.tipo === T_CSD_AUDIO) {
      // Uma tela que não pediu som não recebe AAC (§3.6, invariante 10); se
      // algo chegar assim mesmo, ela continua muda.
      if (!audioQuerido) return;
      const infoA = muxer.csdAudio(carga);
      // ASC ilegível: MUDO, e a imagem intacta. É a metade do cliente da falha
      // segura do §3.9 — nunca áudio pela metade.
      if (!infoA) { semSom('Esta tela fica sem som: o sinal veio sem os parâmetros do áudio.'); return; }
      if (esperaAudio) {
        // O par completo: as duas faixas nascem agora, juntas.
        clearTimeout(esperaAudio);
        esperaAudio = null;
        const retido = initVideoRetido;
        initVideoRetido = null;
        if (retido) abrirMidia(retido, infoA);
        return;
      }
      // Reconexão com a faixa já de pé: reenviar o segmento de inicialização é
      // legal em MSE e é o que a mantém viva do outro lado da queda.
      if (sbA && infoA.mime === mimeA) { enfileirar(infoA.bytes, true); return; }
      // E o `csd` que chega com a `MediaSource` já montada sem faixa de som
      // não pode montar uma agora — o Chromium recusa `addSourceBuffer` depois
      // da inicialização (ver o cabeçalho desta seção). Quem remonta é o GESTO,
      // uma vez; aqui a chegada tardia é ignorada, e é ela que fecha o laço de
      // remontagens que um "remonta quando o csd chegar" produziria.
      return;
    }
    if (q.tipo === T_AUDIO) {
      if (!sbA) return;
      audioUltimoMs = Date.now();
      conta.quadrosAudio++;
      // O som chegou: a frase pegajosa que dizia o contrário sai de cena.
      if (avisoSom) semSom('');
      const frag = muxer.quadroAudio({ ptsUs: q.pts, dados: carga });
      if (frag) enfileirar(frag, true);
      return;
    }
    if (q.tipo === T_CONTROLE) {
      let j = null;
      try { j = JSON.parse(new TextDecoder().decode(carga)); } catch (_) { return; }
      controle(j);
    }
  }

  function controle(j) {
    if (!j || !j.m) return;
    if (j.m === 'sem-audio') {
      avisar('Esta cena vai sem som' + (j.por ? ' (' + String(j.por).slice(0, 24) + ')' : '') + '.');
      return;
    }
    if (j.m === 'modo') {
      if (j.v === 'imagem') aoModoImagem();
      return;
    }
    if (j.m === 'adeus') {
      // Despedida do servidor: NÃO reconectar. Insistir contra um espelho que o
      // operador desligou é a diferença entre uma página quieta e três telas
      // martelando um AP de igreja durante o resto do culto.
      vivo = false;
      parar();
      avisar('O espelho foi desligado no celular.', true);
    }
  }

  // --------------------------------------------------------------------------
  // O LAÇO DE CONEXÃO
  // --------------------------------------------------------------------------

  async function conectar() {
    pedacos.length = 0;
    disponivel = 0;
    cabecalho = null;
    esperandoChave = true;
    // A RETENÇÃO É POR CONEXÃO. Um `csd` de vídeo guardado à espera de um de
    // áudio que morreu com a conexão anterior não pode atravessar para esta:
    // ele abriria a `MediaSource` com o par errado, e o `csd` novo (que vem
    // logo abaixo) cairia no caminho de reconexão sem faixa de som nenhuma.
    if (esperaAudio) { clearTimeout(esperaAudio); esperaAudio = null; }
    initVideoRetido = null;

    abortar = typeof global.AbortController === 'function' ? new global.AbortController() : null;
    const r = await fetch('/v', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      signal: abortar ? abortar.signal : undefined,
    });
    // 404 É A RESPOSTA ÚNICA do servidor para token inválido, rota inexistente e
    // `Host` recusado (§3.4, invariante 5) — não vazar existência é decisão de
    // projeto, e a consequência aqui é que o cliente NÃO TEM COMO distinguir.
    // Um token válido nunca leva 404, então tratar como token morto é a única
    // leitura útil: voltar ao pareamento é a ação que resolve os três casos.
    if (r.status === 404 || r.status === 401 || r.status === 403) {
      token = '';
      guardado('');
      aoPareamento('A sessão desta tela terminou. Digite o código de novo.');
      return;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (!r.body || !r.body.getReader) throw new Error('sem fluxo');

    conta.reconexoes++;
    limparAviso();
    // O PEDIDO DE ÁUDIO É POR CONEXÃO, não por sessão: do lado do servidor a
    // tela é recriada a cada `GET /v` e nasce sem áudio (§3.6, invariante 10),
    // então uma queda de rede deixaria esta tela muda para sempre se o pedido
    // não fosse refeito aqui. É também ele que faz o `csd` de áudio chegar
    // logo atrás do de vídeo — que é o que a retenção em `receber` espera.
    if (audioQuerido) pedirAudio();
    // E o relato desta conexão, sem esperar a batida de cinco minutos: numa
    // tela que reconecta em laço, ESTE é o único momento em que ela consegue
    // contar o que aconteceu na conexão anterior.
    ultimoRelato = ' ';
    relatar();
    const leitor = r.body.getReader();
    for (;;) {
      const passo = await leitor.read();
      if (passo.done) return;             // o servidor fechou: quem reconecta é o laço
      if (!vivo) { try { leitor.cancel(); } catch (_) {} return; }
      pedacos.push(passo.value);
      disponivel += passo.value.length;
      processar();
    }
  }

  async function laco() {
    while (vivo) {
      // Quem abortou fomos NÓS (`recomecar`/`parar`), e nesse caso a tela já
      // está dizendo o motivo certo. Sem esta distinção, o `AbortError` do
      // próprio `fetch` sobrescreveria a frase boa por "Sem sinal — The user
      // aborted a request", em inglês, na tela de quem só quer assistir ao
      // culto.
      let nosso = false;
      try {
        await conectar();
      } catch (e) {
        if (!vivo) return;
        if (e && e.name === 'AbortError') nosso = true;
        else avisar('Sem sinal — ' + ((e && e.message) || 'a conexão caiu') + '.', true);
      }
      if (!vivo) return;
      const espera = RECONEXAO[Math.min(tentativa, RECONEXAO.length - 1)];
      tentativa++;
      if (!nosso) avisar('Sem sinal — tentando de novo em ' + Math.round(espera / 1000) + ' s.', true);
      await dormir(espera);
    }
  }

  // Recomeçar LIMPO. Nunca se descarta fragmento já muxado: isso abriria buraco
  // no `buffered`, que é exatamente o que o atraso de um quadro do `fmp4.js`
  // trabalha para evitar, e navegador PARA em buraco. Quando não há saída, a
  // saída é jogar fora a linha do tempo inteira e montar outra — pisca uma vez
  // e volta certo.
  function recomecar(porque, suave) {
    conta.recomecos++;
    fila.length = 0;
    // A CONEXÃO CAI JUNTO, e sem isto o recomeço não recomeça nada: o `csd`
    // (`0x01`) e o IDR só chegam na ABERTURA de uma conexão (§5.3). Uma
    // `MediaSource` nova sem um `csd` novo ficaria esperando para sempre, com
    // quadros delta chegando e sendo descartados, e nada na tela dizendo por
    // quê. Quem reabre é o laço; `tentativa` zera para a espera ser a curta.
    tentativa = 0;
    if (abortar) { try { abortar.abort(); } catch (_) {} abortar = null; }
    emVoo = null;
    podaPedida = false;
    cotaSeguidas = 0;
    posicionado = false;
    esperandoChave = true;
    sbV = null;
    sbA = null;
    mime = '';
    mimeA = '';
    audioDesde = 0;
    audioUltimoMs = 0;
    if (esperaAudio) { clearTimeout(esperaAudio); esperaAudio = null; }
    initVideoRetido = null;
    if (muxer) { muxer.descartar(); muxer.descartarAudio(); }
    if (ms) {
      try {
        if (ms.readyState === 'open') {
          // TODAS as faixas, de trás para a frente: `sourceBuffers` é uma lista
          // VIVA, e remover pelo índice 0 num laço crescente pula a segunda.
          for (let i = ms.sourceBuffers.length - 1; i >= 0; i--) {
            ms.removeSourceBuffer(ms.sourceBuffers[i]);
          }
        }
      } catch (_) {}
    }
    ms = null;
    try {
      if (el.v.src) { URL.revokeObjectURL(el.v.src); el.v.removeAttribute('src'); el.v.load(); }
    } catch (_) {}
    // `suave` é o recomeço PEDIDO (ligar o som): ele não é falha, e pintá-lo de
    // vermelho no meio do culto diria a coisa errada a quem acabou de tocar na
    // tela.
    if (suave) avisar(porque ? porque + '…' : '');
    else avisar(porque ? 'Recomeçando: ' + porque + '.' : 'Recomeçando…', true);
  }

  function parar() {
    vivo = false;
    if (abortar) { try { abortar.abort(); } catch (_) {} abortar = null; }
    if (compasso) { clearInterval(compasso); compasso = null; }
    // O `csd` de vídeo retido morre com a conexão: soltá-lo depois abriria uma
    // `MediaSource` para um fluxo que não existe mais.
    if (esperaAudio) { clearTimeout(esperaAudio); esperaAudio = null; }
    initVideoRetido = null;
  }

  function comecar() {
    if (vivo) return;
    if (!temFluxo()) {
      // Sem fluxo de `fetch` NADA funciona — nem o modo imagem, que usa o mesmo
      // transporte (§3.11, invariante 12). Dizer isso é melhor que uma tela
      // preta eterna, e o relato já subiu no pareamento: o operador vê no
      // Registro QUAL navegador é esse.
      avisar('Este navegador não consegue receber o fluxo. Atualize-o ou use outro aparelho.', true);
      return;
    }
    vivo = true;
    muxer = global.AVFmp4.criar();
    ultimoAlive = Date.now();
    compasso = setInterval(function () {
      if (!modoImagem) borda();
      if (Date.now() - ultimoAlive > ALIVE_MS) { ultimoAlive = Date.now(); bater(); }
    }, BORDA_MS);
    laco();
  }

  // --------------------------------------------------------------------------
  // O GESTO — um toque, quatro efeitos (§3.11, invariante 9)
  // --------------------------------------------------------------------------

  async function gesto() {
    gestoFeito = true;
    el.gesto.hidden = true;
    doc.body.classList.add('projetando');

    try { if (el.play.requestFullscreen) await el.play.requestFullscreen(); } catch (_) {}

    // AS TELAS NASCEM MUDAS POR DECISÃO, não só por política (§3.11, inv. 10):
    // elas estão dentro da igreja, a 100–300 ms da PA, e três telas
    // desmutadas são três alto-falantes com eco. Quem está em outra sala é quem
    // aperta — e é este toque.
    //
    // E É AQUI, E SÓ AQUI, QUE A `MediaSource` É REMONTADA PARA GANHAR SOM. O
    // Chromium recusa `addSourceBuffer` depois que ela inicializou (ver o
    // cabeçalho da seção da mídia), então a faixa de áudio não pode ser
    // acrescentada a uma projeção em curso: ou ela nasce junto, ou tudo nasce de
    // novo. Amarrar a remontagem ao GESTO — e não à chegada do `csd` de áudio —
    // é o que garante que ela aconteça UMA vez, num instante em que o visitante
    // está olhando para a tela porque acabou de tocar nela.
    audioQuerido = true;
    try {
      el.v.muted = false;
      pedirAudio();
    } catch (_) {}
    tentarSom();
    tocar();

    // CINTO E SUSPENSÓRIO, nunca o único cinto: quem segura a tela acesa no
    // modo vídeo é o wake lock do próprio `<video>` tocando, que não pede
    // contexto seguro nenhum. Este só existe quando houver TLS.
    if (global.isSecureContext && global.navigator.wakeLock) {
      try { await global.navigator.wakeLock.request('screen'); } catch (_) {}
    }
  }

  // "Ligar o som" é REMONTAR, e por isso mora numa função com nome.
  //
  // A faixa de áudio não pode ser acrescentada a uma `MediaSource` que já
  // inicializou (ver o cabeçalho da seção da mídia), então ou ela nasce junto
  // com a de imagem, ou tudo nasce de novo. Só quem toca na tela chega aqui —
  // nunca a chegada de um `csd`, que produziria um laço de remontagens —, e o
  // teto de [REBUILDS_AUDIO] garante que a projeção nunca pisque mais que isso
  // por causa do som. É também o caminho de VOLTA depois de o vigia ter soltado
  // a faixa: o visitante toca de novo e o som retorna.
  function tentarSom() {
    if (!audioQuerido || sbA || modoImagem || !ms) return;
    if (rebuilds >= REBUILDS_AUDIO) return;
    rebuilds++;
    recomecar('Ligando o som', true);
  }

  // --------------------------------------------------------------------------
  // Partida
  // --------------------------------------------------------------------------

  function acordar() {
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'visible') {
        acesaDesde = Date.now();
      } else {
        acesaMs += Date.now() - acesaDesde;
      }
    });
  }

  function iniciar() {
    ['par', 'pin', 'pinBox', 'parBtn', 'parMsg', 'qrBox', 'qr', 'play', 'v', 'foto', 'gesto', 'aviso'].forEach(function (id) {
      el[id] = doc.getElementById(id);
    });
    if (!el.par || !el.play) return;      // não é a página do espelho

    el.parBtn.addEventListener('click', parear);
    el.pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') parear(); });
    el.gesto.addEventListener('click', gesto);
    // Um toque em qualquer lugar da projeção vale como o gesto: um visitante
    // que não viu o botão ainda assim consegue a tela cheia. E, depois do
    // primeiro, um toque vale como "tenta o som de novo" — é a saída da tela
    // que ficou sem áudio, dita por ela mesma no aviso.
    el.play.addEventListener('click', function () { if (gestoFeito) tentarSom(); else gesto(); });
    acordar();

    token = guardado();
    // O QR NASCE JUNTO COM A PÁGINA — sem toque, sem foco, sem nada a digitar.
    // É uma TV: ninguém vai clicar em "gerar código". O campo do PIN não recebe
    // foco por isso mesmo: um teclado virtual abrindo sozinho numa smart TV
    // cobriria justamente o código que ela precisa mostrar.
    if (token) aoPlayer();
    else cicloQr();
  }

  // O ESTADO, LEGÍVEL DE FORA. Esta página não tem Registro — o Registro do
  // operador está no celular, e o que chega lá é o `alive`. Isto aqui é a
  // janela de quem estiver com um console aberto ao lado do aparelho, e é
  // também o que `tools/espelho-cliente.test.mjs` inspeciona. Só leitura:
  // nada aqui liga ou desliga coisa nenhuma.
  global.__espelho = {
    estado: function () {
      return {
        pareado: !!token, vivo: vivo, modoImagem: modoImagem,
        // O QR em cartaz: `qr` é o desenho na tela, `qrId` diz se há espera
        // criada. Os dois juntos separam "o servidor não deu id" de "deu e o
        // desenho falhou" — que na tela são o mesmo espaço vazio.
        qr: !!(el.qrBox && !el.qrBox.hidden), qrId: !!qrId,
        mime: mime, fila: fila.length, posicionado: posicionado,
        quadros: conta.quadros, bytes: conta.bytes,
        recomecos: conta.recomecos, reconexoes: conta.reconexoes,
        // O som, do jeito que ele falha: `audioQuerido` sem `audio` é "esta
        // tela pediu e não recebeu", que é a leitura que faltava no aparelho.
        audioQuerido: audioQuerido, audio: !!sbA, mimeAudio: mimeA,
        quadrosAudio: conta.quadrosAudio, mudo: el.v ? !!el.v.muted : true,
        aviso: el.aviso ? el.aviso.textContent : '',
      };
    },
    relato: relato,
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
