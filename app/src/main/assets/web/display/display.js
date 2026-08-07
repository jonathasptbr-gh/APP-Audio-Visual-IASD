const wallpaperEl = document.getElementById('wallpaper');
const imgEl = document.getElementById('img');
const videoEl = document.getElementById('video');
const youtubeEl = document.getElementById('youtube'); // wrapper; a API cria o iframe real dentro dele
const ytShieldEl = document.getElementById('ytShield');
const lyricsEl = document.getElementById('lyrics');
const lyricsImgEl = document.getElementById('lyricsImg');
const lyricsContentEl = document.getElementById('lyricsContent');
const lyricsLineEl = document.getElementById('lyricsLine');
const lyricsAuxEl = document.getElementById('lyricsAux');
const textEl = document.getElementById('text');
const textContentEl = document.getElementById('textContent');
const textMainEl = document.getElementById('textMain');
const textSubEl = document.getElementById('textSub');

// Config de transições, usada aqui para animar o player do YouTube (que vive
// fora do stage). INERENTE ao sistema: toda troca visual é animada com fade,
// sempre — não há opção de desligar nem ajustar. Vem de stage.js para não
// existirem duas cópias do mesmo objeto (Display e Controle) podendo divergir.
const fadeCfg = createStage.FADE;

// Fonte única do payload display-status: sendStatus (stage) e ytStatus
// (YouTube) só preenchem os valores; o `type` e o `audioBlocked` ficam num
// lugar só, evitando que os dois campos saiam inconsistentes para o Controle.
function sendDisplayStatus(fields) {
  AVDB.sendCommand(Object.assign({ type: 'display-status', audioBlocked }, fields));
}

// ===== CAIXA-PRETA DO TELÃO =====
//
// Três versões seguidas tentaram consertar "o vídeo para quando o app é
// minimizado" com HIPÓTESES — e as três erraram, porque ninguém consegue ver o
// que acontece com o telão enquanto o celular está fora da frente: não há
// console, não há logcat, e o Controle está estrangulado justamente nesse
// intervalo.
//
// Este anel resolve isso: o Display anota o que ACONTECE COM ELE, guarda no
// próprio processo, e o Controle pede o despejo quando o operador abre
// Configurações. É pouca coisa e é barato, mas é a diferença entre corrigir e
// adivinhar.
const DIAG_MAX = 60;
const diario = [];
function diag(ev, extra) {
  diario.push(Object.assign({
    t: Date.now(),
    ev,
    oculto: document.visibilityState !== 'visible',
  }, extra || {}));
  if (diario.length > DIAG_MAX) diario.shift();
}

// A visibilidade da PÁGINA é a peça central da investigação: se ela nunca vira
// "oculta" e o vídeo para mesmo assim, a causa é outra (suspensão do renderer,
// Presentation derrubada) — e isso muda inteiramente o que corrigir.
document.addEventListener('visibilitychange', () => diag('visibilidade'));
window.addEventListener('pagehide', () => diag('pagehide'));
window.addEventListener('freeze', () => diag('congelou'));
window.addEventListener('resume', () => diag('descongelou'));

function sendStatus() {
  if (yt) return; // com YouTube ativo o status tem fluxo próprio (ytStatus)
  // No fim natural o stage zera o currentTime (preparando o replay) e continua
  // emitindo tempo: seguir isso re-renderizaria o slide 0 e a CAPA do hino
  // piscava por um instante antes do wallpaper cobrir. Terminado, a letra
  // congela no último slide — e o onEnded a esmaece.
  if (!stage.hasEnded()) updateLyricSlide(stage.isTimed() ? stage.getTime() : 0);
  const cur = stage.getCurrent();
  sendDisplayStatus({
    mediaId: cur ? cur.id : null,
    view: stage.getView(),
    muted: stage.getMuted(),
    volume: stage.getVolume(),
    playing: stage.isPlaying(),
    currentTime: stage.isTimed() ? stage.getTime() : 0,
    duration: stage.isTimed() ? stage.getDuration() : 0,
  });
}

const stage = createStage({
  wallpaper: wallpaperEl,
  img: imgEl,
  video: videoEl,
  forceMuted: false,
  onTime: sendStatus,
  // O TELÃO NÃO RECUPERA SOZINHO uma transmissão que falhou, e não é omissão:
  // ele não tem a ponte (`host = null`, ver NativeBridge) para pedir um
  // manifesto novo, e duas recuperações independentes para a mesma cena
  // brigariam entre si. Quem conserta é o Controle, cuja preview toca o MESMO
  // registro e vê o mesmo erro no mesmo instante — e que reenvia a cena
  // arrumada pelo caminho de sempre.
  onStreamErro: (rec, porque) => { console.warn('[stream] telão:', porque); },
  onBlocked: () => {
    // A guarda de nativo fica AQUI, e não só dentro de beginAudioRecovery():
    // no APK não há política de gesto (ver #startBtn), então um NotAllowedError
    // só pode ser falso positivo — e mutar o stage antes de descobrir isso
    // deixava o telão sem som sem armar recuperação nenhuma (beginAudioRecovery
    // devolve cedo em __NATIVE__, `audioBlocked` continua false e nem
    // tryRestoreAudio nem o comando 'audio-retry' fazem qualquer coisa). O
    // silêncio durava até o próximo load, e o Controle não recebia sinal: o
    // display-status só carrega `audioBlocked`, que ali é false.
    if (window.__NATIVE__) return;
    // Autoplay com som bloqueado: segue tocando MUDO (sempre permitido — o
    // vídeo aparece no telão sem toque) e a recuperação religa o áudio.
    stage.setMute(true);
    stage.play();
    beginAudioRecovery();
  },
  onEnded: () => {
    sendStatus();
    // A letra sai de cena junto com a música, esmaecendo — ela é uma camada
    // paralela e não participa do fade do stage. Se um próximo item vier em
    // seguida (avanço de playlist), o load dele mostra a letra nova.
    if (currentLyrics) fadeLayerOut(lyricsEl);
    const cur = stage.getCurrent();
    AVDB.sendCommand({ type: 'media-ended', mediaId: cur ? cur.id : null });
  },
});

// ===== Letra sincronizada (Hinário 2022 — ver CLAUDE.md) =====
// Camada paralela ao stage.js (mesmo padrão da ponte do YouTube): stage.js
// não sabe nada sobre texto/letra, só gerencia wallpaper/img/video. O layer
// #lyrics vive no mesmo z-index dos demais layers de mídia, então a cortina
// do wallpaper (z-index maior, já existente) cobre/revela-o de graça.
let currentLyrics = null; // array de slides do item atual, ou null (sem letra)
let currentLyricsMeta = null; // { hymnName, hymnTrack } do item atual — persistido à parte
                               // (não só passado ao showLyrics) pra o slide de capa mostrar o
                               // título certo mesmo quando renderizado de novo pelo tick de
                               // tempo (ex: operador volta pra estrofe 0 depois de já ter
                               // avançado), não só na primeira exibição.
let lyricSlideIdx = -1;
let lyricLoadSeq = 0;     // descarta resoluções de imagem obsoletas (mesmo padrão do loadSeq do stage)
let lyricImgKey = null;   // imageOpfsPath já renderizado agora (evita recriar a object URL à toa)
let lyricImgUrl = null;   // object URL em uso, para revogar quando trocar de fato
let lyricTeardownTimer = null; // desmontagem atrasada da camada (ver hideLyrics/showLyrics)
// 'black' (padrão) ignora as imagens dos slides e mantém o fundo preto atrás
// do texto; 'image' usa as imagens de verdade. Persistido em state.lyricsBg
// pelo Controle, aplicado ao vivo via comando (ver setLyricsBgMode).
let lyricsBgMode = 'black';

// ===== Fades de camada paralela (letra, texto) =====
// A cortina do wallpaper e a mídia do stage já têm as próprias transições; as
// camadas paralelas não passam por lá, e sem estes helpers apareciam/sumiam
// com corte seco. Os quatro vivem em stage.js: são idênticos aos do Controle
// (que os aplica em #pvLyrics/#pvText) e não têm calibração própria nenhuma —
// só o CSS de cada app é que difere. Ver "fades de camada paralela" lá.
const LAYER_FADE_MS = createStage.LAYER_FADE_MS;
const findSlideIndex = createStage.findSlideIndex;
const animateFadeIn = createStage.fadeContentIn;
const fadeLayerIn = createStage.fadeLayerIn;
const fadeLayerOut = createStage.fadeLayerOut;
const chronoReading = createStage.chronoReading;
const CHRONO_TICK_MS = createStage.CHRONO_TICK_MS;
const drawReading = createStage.drawReading;
const DRAW_FRAME_MS = createStage.DRAW_FRAME_MS;

// `fade` = a letra está saindo de cena para o operador ver (fim da música,
// texto manual assumindo). Sem fade quando outra mídia já vai ocupar o lugar
// no mesmo instante — aí a transição é da mídia que entra.
function hideLyrics(fade) {
  currentLyrics = null;
  currentLyricsMeta = null;
  lyricSlideIdx = -1;
  ++lyricLoadSeq; // descarta uma imagem ainda resolvendo (não deve reaparecer)
  const seq = lyricLoadSeq;
  // A imagem de fundo é FILHA da camada: desmontá-la agora faria o fundo sumir
  // de imediato por trás de um texto ainda esmaecendo. Some junto com a camada.
  const teardown = () => {
    if (seq !== lyricLoadSeq) return; // a letra voltou nesse meio tempo
    if (lyricImgUrl) { URL.revokeObjectURL(lyricImgUrl); lyricImgUrl = null; }
    lyricImgKey = null;
    lyricsImgEl.hidden = true;
    lyricsImgEl.removeAttribute('src');
  };
  clearTimeout(lyricTeardownTimer);
  if (fade && !lyricsEl.hidden && lyricsEl.animate && fadeCfg.out) {
    fadeLayerOut(lyricsEl);
    lyricTeardownTimer = setTimeout(teardown, LAYER_FADE_MS);
  } else {
    lyricsEl.hidden = true;
    teardown();
  }
}

function showLyrics(rec) {
  // Um texto manual (Bíblia/mensagem) em cena tem precedência: a música toca de
  // fundo, mas a letra dela não substitui o texto projetado pelo operador.
  if (textActive) return;
  // A letra VOLTOU antes do teardown agendado por hideLyrics: cancela-o de
  // forma explícita. A guarda de sequência sozinha não bastava — se a estrofe
  // que volta usa a MESMA imagem (`key === lyricImgKey`, o caso normal quando
  // um versículo entra e sai em menos de LAYER_FADE_MS, e também quando dois
  // hinos compartilham o mesmo imageOpfsPath), applyLyricsImage devolve cedo e
  // NÃO incrementa lyricLoadSeq: o teardown disparava com o seq ainda válido,
  // revogava a object URL em uso e apagava o fundo da letra que acabara de
  // reaparecer, deixando-a sobre preto até a próxima troca de estrofe.
  clearTimeout(lyricTeardownTimer);
  currentLyrics = rec.lyrics;
  currentLyricsMeta = { hymnName: rec.hymnName, hymnTrack: rec.hymnTrack };
  lyricSlideIdx = -1;
  fadeLayerIn(lyricsEl);
  renderLyricSlide(0);
}

// Só mexe no DOM quando o índice realmente muda (chamado a cada tick de tempo).
function renderLyricSlide(idx) {
  if (idx === lyricSlideIdx) return;
  const slide = currentLyrics[idx];
  // O índice só é REGISTRADO depois de validado: gravá-lo antes fazia um índice
  // inexistente (findSlideIndex devolvendo -1 num tempo anterior ao 1º slide,
  // ou um showLyrics com a lista ainda vazia) ficar marcado como "já
  // renderizado" — e se o mesmo índice voltasse a ser pedido, a guarda de cima
  // devolvia cedo e o slide certo nunca era pintado.
  if (!slide) return;
  lyricSlideIdx = idx;

  lyricsContentEl.classList.toggle('cover', !!slide.cover);
  if (slide.cover) {
    const meta = currentLyricsMeta || {};
    const title = (meta.hymnTrack ? meta.hymnTrack + '. ' : '') + (meta.hymnName || '');
    lyricsLineEl.textContent = title;
    lyricsAuxEl.hidden = true;
  } else {
    lyricsLineEl.textContent = slide.text || '';
    lyricsAuxEl.textContent = slide.auxText || '';
    lyricsAuxEl.hidden = !slide.auxText;
  }
  // Trecho sem letra (solo, introdução, instrumental): a moldura esmaece e
  // some, deixando só a imagem de fundo — uma caixa escura vazia no meio da
  // tela não tem função nenhuma. Volta sozinha quando houver o que cantar.
  lyricsContentEl.classList.toggle('nolyric', !lyricsLineEl.textContent.trim() && lyricsAuxEl.hidden);
  animateFadeIn(lyricsLineEl);
  if (!lyricsAuxEl.hidden) animateFadeIn(lyricsAuxEl);

  applyLyricsImage(slide);
}

// Resolve (ou limpa) a imagem de fundo do slide dado, respeitando o modo
// preto/imagens (`lyricsBgMode`) — só troca de fato se a chave efetiva
// mudou (linhas seguidas costumam compartilhar a mesma imagem — fallback
// "grudento" do sync), com guarda de sequência pra descartar resoluções
// obsoletas (mesmo padrão do `loadSeq` do stage).
function applyLyricsImage(slide) {
  if (!slide) return;
  const key = (lyricsBgMode === 'image' && slide.imageOpfsPath) ? slide.imageOpfsPath : null;
  if (key === lyricImgKey) return;
  const seq = ++lyricLoadSeq;
  if (!key) {
    lyricImgKey = null;
    // Oculta a <img> (não só limpa o src): sem isso, alguns navegadores
    // renderam o ícone/borda padrão de "imagem quebrada" mesmo sem `src`,
    // aparecendo como uma linha branca de margem sobre o preto de
    // `.lyrics-bg`. Escondida, o preto do próprio `.lyrics-bg` fica exposto.
    // Sai esmaecendo: desligar o fundo das músicas é uma troca visível na
    // projeção, não um corte — e por isso a `src` e a object URL só caem
    // DEPOIS do fade (limpá-las agora exporia o ícone de imagem quebrada
    // durante toda a transição, que é exatamente o que se quer evitar).
    const url = lyricImgUrl;
    lyricImgUrl = null;
    fadeLayerOut(lyricsImgEl);
    setTimeout(() => {
      // A revogação vem ANTES da guarda de sequência, e de propósito:
      // `lyricImgUrl` já foi zerada acima, então esta URL não é mais de
      // ninguém — nenhum outro caminho vai revogá-la. Deixá-la atrás do guard
      // significava que uma imagem nova entrando em menos de LAYER_FADE_MS
      // (estrofe seguinte, ou o operador religando o fundo pelo 'lyricsbg')
      // invalidava o callback e o blob da foto ficava retido até o WebView do
      // telão morrer — uma vez a cada ocorrência, o culto inteiro.
      if (url) URL.revokeObjectURL(url);
      if (seq !== lyricLoadSeq) return; // outra imagem já assumiu: o src é DELA
      lyricsImgEl.removeAttribute('src');
    }, LAYER_FADE_MS);
    return;
  }
  AVDB.opfsGetFile(key).then((file) => {
    if (seq !== lyricLoadSeq) return; // um slide mais novo já assumiu enquanto isso resolvia
    const url = URL.createObjectURL(file);
    const prevUrl = lyricImgUrl;
    lyricImgUrl = url;
    lyricImgKey = key;
    lyricsImgEl.src = url;
    // Cada imagem de estrofe entra com fade (e a primeira, ao ligar o fundo,
    // também) — a troca seca entre fotos era o corte mais perceptível da
    // letra sincronizada.
    fadeLayerIn(lyricsImgEl);
    if (prevUrl) URL.revokeObjectURL(prevUrl);
  }).catch(() => {
    // falha ao resolver: mantém a imagem anterior em tela (nada pior que
    // ficar sem fundo nenhum por causa de uma falha pontual de leitura)
  });
}

// Troca o modo preto/imagens ao vivo (comando do Controle) e reaplica no
// slide atual, sem precisar de uma troca de estrofe pra isso surtir efeito.
function setLyricsBgMode(mode) {
  lyricsBgMode = mode === 'image' ? 'image' : 'black';
  applyLyricsBgClass();
  if (currentLyrics && lyricSlideIdx >= 0) applyLyricsImage(currentLyrics[lyricSlideIdx]);
}

// A moldura (borda + fundo semitransparente) só faz sentido cobrindo uma
// imagem de fundo de verdade — no modo preto puro ela é uma zona escura
// flutuando sobre uma tela já preta, sem função nenhuma. `.imgbg` liga a
// moldura só quando o modo é 'image' (ver .lyrics-box/.lyrics-content.imgbg
// em display.css).
function applyLyricsBgClass() {
  lyricsContentEl.classList.toggle('imgbg', lyricsBgMode === 'image');
}

// Chamado a cada tick de tempo (sendStatus/onTime) — sem timer novo.
function updateLyricSlide(t) {
  if (!currentLyrics) return;
  // Replay depois do fim: a letra foi esmaecida no onEnded, mas os slides
  // continuam carregados — o tempo voltar a correr a traz de volta.
  if (lyricsEl.hidden) fadeLayerIn(lyricsEl);
  renderLyricSlide(findSlideIndex(currentLyrics, t));
}

// ===== Camada de TEXTO manual (Bíblia + Mensagens — ver "Camada de Texto") =====
// Camada paralela ao stage.js: um cartão de texto por baixo da cortina do
// wallpaper (que fica por cima de TUDO — nada é colocado sobre o wallpaper).
// É INDEPENDENTE do áudio: um som pode seguir tocando por baixo (o <video> do
// stage renderiza preto no áudio-só) e o transporte continua controlando esse
// áudio de fundo. `mode`: 'verse' (referência dourada embaixo) | 'message'.
let textActive = false;
let textView = 'visual';
let textMode = 'verse';

// ===== Texto VIVO: cronômetro/relógio/timer e sorteio =====
// É o MESMO cartão da Bíblia e das Mensagens (`mode: 'chrono'` | `'draw'`), e
// isso não é economia de CSS: herdando o cartão, herda também toda a regra de
// convivência já madura — `load` de áudio mantém o cartão no ar, `load` visual
// o encerra, a cortina do wallpaper o cobre, `text-hide` o tira sem parar o som
// de fundo. Um layer novo teria que reimplementar as quatro, e envelheceria
// separado.
//
// O que muda em relação a um versículo é só a ORIGEM do texto: em vez de vir
// pronto no comando, é DERIVADO a cada tick de um descritor (ver chronoReading
// e drawReading em stage.js).
//
// Os dois modos vivos dividem UM laço só, de propósito: o cartão é um só, então
// dois timers escrevendo no mesmo nó nunca seriam ambos corretos — bastaria um
// esquecer de parar o outro para o sorteio ser sobrescrito pelo relógio. Com um
// registro único isso é estruturalmente impossível.
let liveKind = '';    // 'chrono' | 'draw' | ''
let liveDesc = null;
let liveTimer = null;

function liveReading() {
  if (liveKind === 'draw') return drawReading(liveDesc, Date.now());
  if (liveKind === 'chrono') return chronoReading(liveDesc, Date.now());
  return null;
}

function liveTick() {
  const r = liveReading();
  if (!r) return;
  textMainEl.textContent = r.text;
  // O CSS dimensiona a fonte a partir daqui (ver .mode-chrono em display.css):
  // "09:59" e "12:34:56 PM" não podem sair do mesmo tamanho — o primeiro
  // ficaria pequeno à toa, o segundo vazaria da tela.
  textMainEl.style.setProperty('--ch', r.text.length);
  textContentEl.classList.toggle('chrono-over', !!r.over);
  textContentEl.classList.toggle('draw-rolling', !!r.rolling);
  // O sorteio ASSENTOU: nada mais muda até o próximo comando, e um laço batendo
  // num número parado só gastaria bateria.
  if (liveKind === 'draw' && !r.rolling) stopLiveTimer();
}

function startLive(kind, desc) {
  liveKind = kind; liveDesc = desc || {};
  stopLiveTimer();
  liveTick();
  if (kind === 'draw') {
    // Só rola enquanto há rolo; depois o próprio liveTick se desliga.
    if (liveDesc.rollUntil && Date.now() < liveDesc.rollUntil) {
      liveTimer = setInterval(liveTick, DRAW_FRAME_MS);
    }
    return;
  }
  // O relógio e o timer/cronômetro EM MARCHA precisam de laço; um cronômetro
  // pausado é um número parado, e manter um timer batendo nele só gastaria
  // bateria com o app em cima de uma projeção que não muda.
  if (liveDesc.mode === 'clock' || liveDesc.running) liveTimer = setInterval(liveTick, CHRONO_TICK_MS);
}

function stopLiveTimer() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}

function clearLive() {
  stopLiveTimer(); liveKind = ''; liveDesc = null;
  textContentEl.classList.remove('chrono-over', 'draw-rolling');
}

function showText(cmd) {
  const wallpaper = cmd.view === 'wallpaper';
  textMode = cmd.mode === 'message' ? 'message'
    : (cmd.mode === 'chrono' || cmd.mode === 'draw') ? cmd.mode : 'verse';
  textContentEl.classList.toggle('mode-message', textMode === 'message');
  textContentEl.classList.toggle('mode-chrono', textMode === 'chrono');
  textContentEl.classList.toggle('mode-draw', textMode === 'draw');
  if (textMode === 'chrono') {
    startLive('chrono', cmd.chrono || {});
  } else if (textMode === 'draw') {
    startLive('draw', cmd.draw || {});
  } else {
    clearLive();
    textMainEl.textContent = cmd.main || '';
  }
  textSubEl.textContent = cmd.sub || '';
  textSubEl.hidden = !cmd.sub;
  textView = wallpaper ? 'wallpaper' : 'visual';
  if (textActive) {
    // Já em cena (troca de versículo/mensagem): fade-in do texto, sem mexer na moldura.
    animateFadeIn(textMainEl); if (!textSubEl.hidden) animateFadeIn(textSubEl);
    stage.instantCover(wallpaper);
    return;
  }
  // O cartão é OPACO e fica acima de toda a mídia (.text-layer, z-index 2):
  // nada precisa ser interrompido para ele aparecer. A mídia segue tocando
  // intacta por baixo — áudio audível, vídeo rodando, posição preservada — e
  // reaparece exatamente onde estava quando o texto sair (hideText).
  //
  // A letra sincronizada é a única exceção: ela É texto, então sai de cena
  // enquanto o texto manual está no ar (precedência do operador). Volta em
  // hideText, no slide correspondente ao instante atual da música.
  hideLyrics(true);
  textActive = true;
  fadeLayerIn(textEl);
  // Revela conforme a view (wallpaper mantém a cortina por cima).
  if (wallpaper) stage.instantCover(true); else stage.coverOut();
}

// `restore` = a cena anterior deve voltar. Verdadeiro no 'text-hide' (o
// operador só tirou o texto do ar); falso quando algo NOVO já vai assumir a
// cena logo em seguida (load de visual, stop, clear) — restaurar ali faria a
// letra piscar por um instante antes de ser substituída.
function hideText(restore = true) {
  if (!textActive) return;
  textActive = false;
  // O laço do texto vivo para JUNTO com o cartão: fora de cena ele só gastaria
  // bateria reescrevendo um nó invisível. O descritor fica (o texto também não
  // é limpo — ver abaixo), então o valor segue certo durante o fade.
  stopLiveTimer();
  // Sai esmaecendo — e o texto NÃO é limpo aqui: apagá-lo agora deixaria o
  // cartão vazio visível durante todo o fade. O próximo showText sobrescreve.
  fadeLayerOut(textEl);
  if (restore) restoreSceneAfterText();
}

// Devolve a cena ao estado em que ela estava antes do texto manual entrar.
// Vídeo/imagem/YouTube não precisam de nada: nunca foram interrompidos e
// reaparecem sozinhos assim que o cartão opaco sai da frente. Só a letra
// sincronizada precisa ser remontada — e no slide certo, não do começo.
function restoreSceneAfterText() {
  // YouTube segue tocando por baixo do cartão e reaparece sozinho — mas a
  // cortina ainda precisa concordar com a view do player: enquanto o cartão
  // estava no ar o operador pode ter coberto ou descoberto o telão.
  if (yt) { reconcileCover(yt.view); return; }
  const cur = stage.getCurrent();
  // NADA de fato em cena — nenhuma mídia carregada, ou a que havia já terminou
  // (só na playlist, ou tocada antes). O ponto de repouso do telão é o
  // WALLPAPER, não o preto: `showText` abriu a cortina para o cartão aparecer,
  // e sem isto ela ficava aberta sobre o vazio quando o texto saía.
  if (!cur || stage.hasEnded()) { stage.coverIn(false); return; }
  if (cur.kind === 'audio' && Array.isArray(cur.lyrics) && cur.lyrics.length) {
    showLyrics(cur);
    updateLyricSlide(stage.getTime());
  }
  // Última coisa, e para TODOS os tipos de mídia (antes só a letra era
  // remontada e os demais devolviam cedo): `showText` mexeu na cortina por
  // conta própria para o cartão aparecer, então sair de cena tem que devolvê-la
  // ao que a view vigente manda. Sem isto, um versículo tirado do ar com o
  // telão coberto deixava a cortina cobrindo uma mídia cuja view é 'visual' —
  // e o toque seguinte no botão de visual não fazia nada, porque para o stage
  // nada havia mudado.
  reconcileCover(stage.getView());
}

// A cortina do wallpaper é COMPARTILHADA (stage, YouTube e a camada de texto
// mexem nela), mas o estado de view é de quem é dono da cena. Este helper só
// faz a cortina obedecer a uma view já decidida — coverIn/coverOut devolvem
// cedo quando ela já está onde deveria, então chamar à toa não custa nem
// pisca nada no telão.
function reconcileCover(view) {
  // `stage.shouldCover()` cobre o caso do ÁUDIO SEM LETRA (v5.112): a view dele
  // é 'visual' como a de qualquer mídia, mas não há o que revelar — abrir a
  // cortina deixaria o telão no preto do palco. Só vale quando a cena é do
  // stage: com o player do YouTube no ar, `current` pode estar nulo aqui, e a
  // pergunta responderia "cobre" justamente sobre o vídeo que está tocando.
  if (view === 'wallpaper' || (!yt && stage.shouldCover())) stage.coverIn(false);
  else stage.coverOut();
}

// ===== Microfone ao vivo (push-to-talk) =====
// O operador segura o botão no Controle e a voz sai na PROJEÇÃO, ao vivo.
//
// A captura acontece AQUI, no Display, não no Controle — e não é detalhe de
// implementação: um `MediaStream` não atravessa o BroadcastChannel (não é
// clonável), então mandar o áudio "pela ponte" não existe como opção. O que
// atravessa é o comando; quem abre o microfone é quem vai reproduzi-lo.
//
// Caminho de áudio: getUserMedia → MediaStreamSource → GainNode →
// destination. É o menor atraso disponível na plataforma; ainda assim há a
// latência do WebView (tipicamente ~0,1–0,3 s), inerente e não removível daqui.
//
// ATENÇÃO — REALIMENTAÇÃO: microfone e alto-falante no mesmo ambiente apitam.
// `echoCancellation` fica LIGADO de propósito: num culto, um ganho realimentado
// é um estrago imediato e público, e vale mais que a fidelidade extra de
// desligar o processamento. Mesmo assim, se a saída de áudio for o próprio
// celular (e não a TV), o risco continua — é do formato, não do código.
let micStream = null;
let micCtx = null;
let micSrc = null;
let micGain = null;
const MIC_RAMP = 0.12; // s — entrada/saída sem estalo

function micStatus(on, error) {
  AVDB.sendCommand({ type: 'mic-status', on: !!on, error: error || '' });
}

// Token da captura EM VOO. `micStream` sozinho não servia como guarda: ele só
// existe DEPOIS de o getUserMedia resolver, e o primeiro push-to-talk da sessão
// demora (permissão + onPermissionRequest do WebView). Um on→off→on nesse
// intervalo — o operador aperta, não ouve nada, solta e aperta de novo —
// disparava um SEGUNDO getUserMedia com o primeiro ainda pendente; quando os
// dois resolviam, o segundo sobrescrevia micStream/micSrc/micGain e o primeiro
// ficava com as trilhas vivas e o ganho ligado ao destination, sem ninguém
// para pará-lo: microfone aberto no telão (e o indicador de gravação do
// Android aceso) até o WebView do telão ser recriado.
let micSeq = 0;

async function startMic() {
  if (micStream) return; // já no ar
  const seq = ++micSeq;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micStatus(false, 'unsupported');
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (e) {
    micStatus(false, (e && e.name) || 'error');
    return;
  }
  // O operador pode ter soltado o botão (ou apertado de novo, começando outra
  // captura) enquanto a permissão era resolvida: nos dois casos este stream já
  // nasceu obsoleto e não pode virar áudio no telão — quem manda é a última
  // intenção, e o token diz se esta ainda é ela.
  if (seq !== micSeq || !micWanted) {
    stream.getTracks().forEach((t) => t.stop());
    // O Controle precisa saber que ISTO não virou microfone: o stopMic de
    // quem soltou o botão saiu cedo (micStream ainda era null — não havia o
    // que derrubar) e não emitiu nada, então sem esta linha o indicador do
    // botão ficava no último estado. Só quando o operador SOLTOU: se ele
    // apertou de novo (`micWanted` ainda true), a captura mais nova é quem
    // vai anunciar o próprio desfecho — um `false` daqui poderia chegar
    // DEPOIS do `true` dela e apagar um microfone que está no ar.
    if (!micWanted) micStatus(false);
    return;
  }
  micStream = stream;
  try {
    micCtx = micCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (micCtx.state === 'suspended') { try { await micCtx.resume(); } catch (_) {} }
    // O resume é OUTRO await, e um stopMic() aqui no meio já teria passado
    // batido: ele derruba as trilhas, mas não existiria micSrc/micGain para
    // desconectar — e a continuação abaixo ligaria a fonte ao destination
    // depois de o operador ter soltado o botão. Reconfere antes de conectar.
    if (seq !== micSeq || !micWanted) {
      stream.getTracks().forEach((t) => t.stop());
      if (micStream === stream) micStream = null;
      return;
    }
    micSrc = micCtx.createMediaStreamSource(micStream);
    micGain = micCtx.createGain();
    micGain.gain.value = 0;
    micSrc.connect(micGain);
    micGain.connect(micCtx.destination);
    micGain.gain.linearRampToValueAtTime(1, micCtx.currentTime + MIC_RAMP);
    micStatus(true);
  } catch (e) {
    stopMic();
    micStatus(false, (e && e.name) || 'audio-error');
  }
}

function stopMic() {
  // Invalida a captura em voo ANTES da saída antecipada: com `micStream` ainda
  // null (permissão não resolveu) esta função não tinha nada a derrubar, mas
  // precisa mesmo assim registrar que o operador soltou o botão — senão o
  // getUserMedia pendente vira um microfone aberto que nenhum comando desliga.
  ++micSeq;
  if (!micStream) return;
  const stream = micStream, src = micSrc, gain = micGain;
  micStream = null; micSrc = null; micGain = null;
  // Desliga em rampa e só então derruba a fonte — cortar no meio de uma
  // palavra produz um estalo bem audível numa caixa de som.
  const drop = () => {
    try { if (src) src.disconnect(); } catch (_) {}
    try { if (gain) gain.disconnect(); } catch (_) {}
    stream.getTracks().forEach((t) => t.stop());
    // SUSPENDE o contexto, não fecha: fechado exigiria criar outro no aperto
    // seguinte, e é justamente esse custo (e a latência de abertura) que se
    // quer evitar num push-to-talk. Suspenso, ele para de segurar a saída de
    // áudio. Só se ninguém tiver reaberto o microfone nesse meio tempo —
    // startMic religa com o resume que já existe lá.
    if (micCtx && !micStream) { try { micCtx.suspend(); } catch (_) {} }
  };
  if (gain && micCtx) {
    try {
      gain.gain.cancelScheduledValues(micCtx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, micCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0, micCtx.currentTime + MIC_RAMP);
    } catch (_) {}
    setTimeout(drop, MIC_RAMP * 1000 + 40);
  } else {
    drop();
  }
  micStatus(false);
}

// Intenção do operador (o botão está pressionado?). Guardada à parte de
// `micStream` porque a captura é assíncrona: sem isso, soltar o botão antes de
// a permissão resolver deixaria o microfone aberto sozinho.
let micWanted = false;

function setMic(on) {
  micWanted = !!on;
  if (micWanted) startMic(); else stopMic();
}

// ===== Wallpaper personalizado =====
// A cortina do telão aceita uma imagem escolhida pelo operador no lugar do
// gradiente padrão. A imagem vem do state `wallpaper` (blob), gravada pelo
// Controle; o comando `wallpaper` só avisa que ela mudou — o Display lê do
// IDB, que é compartilhado. Sem imagem, volta ao gradiente e à marca.
let wallpaperUrl = null;

async function applyWallpaper() {
  let blob = null;
  try { blob = await AVDB.getState('wallpaper'); } catch (_) { /* segue no padrão */ }
  if (wallpaperUrl) { URL.revokeObjectURL(wallpaperUrl); wallpaperUrl = null; }
  const brand = wallpaperEl.querySelector('.wallpaper-brand');
  if (blob instanceof Blob) {
    wallpaperUrl = URL.createObjectURL(blob);
    wallpaperEl.style.backgroundImage = 'url("' + wallpaperUrl + '")';
    // A marca é a identidade do fundo PADRÃO; sobre uma imagem própria ela
    // só atrapalharia.
    if (brand) brand.hidden = true;
  } else {
    wallpaperEl.style.backgroundImage = '';
    if (brand) brand.hidden = false;
  }
}

// ===== Áudio sem toque: recuperação automática =====
// A política de autoplay dos navegadores pode bloquear som sem gesto do
// usuário. Em vez de exigir um toque no telão, o vídeo começa mudo e o áudio
// é religado sozinho em retentativas (num PWA instalado costuma liberar na
// primeira). NADA é exibido no telão: o estado vai no campo `audioBlocked`
// do display-status e o Controle avisa o operador. Um toque/tecla no Display
// (se acontecer) resolve na hora.
let audioBlocked = false;
let audioRetryTimer = null;

function pushStatus() { if (yt) ytStatus(); else sendStatus(); }

function beginAudioRecovery() {
  // No app nativo não existe bloqueio de autoplay (ver #startBtn abaixo):
  // qualquer "bloqueio" detectado aqui seria falso positivo, e o efeito
  // visível seria o indicador âmbar de "sem áudio" aceso no mixer do
  // Controle sem motivo real.
  if (window.__NATIVE__) return;
  if (audioBlocked) return;
  audioBlocked = true;
  pushStatus();
  scheduleAudioRetry(1500);
}

function endAudioRecovery() {
  clearTimeout(audioRetryTimer);
  if (!audioBlocked) return;
  audioBlocked = false;
  pushStatus();
}

function scheduleAudioRetry(ms) {
  clearTimeout(audioRetryTimer);
  audioRetryTimer = setTimeout(tryRestoreAudio, ms);
}

// Este mecanismo de recuperação é exclusivo do stage (vídeo/áudio locais).
// O YouTube não usa detecção de bloqueio de autoplay: num PWA instalado o
// autoplay com som é liberado normalmente, e a antiga tentativa de detecção
// gerava falsos positivos (buffering demorado confundido com bloqueio),
// deixando o vídeo mutando/desmutando e reiniciando em loop.
function tryRestoreAudio() {
  if (!audioBlocked || yt) return;
  const cur = stage.getCurrent();
  if (!cur || (cur.kind !== 'video' && cur.kind !== 'audio')) { endAudioRecovery(); return; }
  if (videoEl.paused) { scheduleAudioRetry(5000); return; } // não está tocando agora
  stage.setMute(false);
  setTimeout(() => {
    if (!audioBlocked) return;
    if (videoEl.paused) {
      // o navegador pausou ao desmutar: ainda bloqueado — segue mudo
      stage.setMute(true);
      stage.play();
      scheduleAudioRetry(5000);
    } else if (!videoEl.muted) {
      endAudioRecovery();
    } else {
      scheduleAudioRetry(5000);
    }
  }, 350);
}

// Qualquer gesto real no Display (toque, tecla de um controle remoto) concede
// a ativação do navegador — religa o áudio na hora (só se aplica ao stage).
function onUserGesture() {
  if (!audioBlocked || yt) return;
  stage.setMute(false);
  stage.play();
  endAudioRecovery();
}
document.addEventListener('pointerdown', onUserGesture);
document.addEventListener('keydown', onUserGesture);

// ===== YouTube: IFrame Player API oficial =====
// Antes disso o Display falava diretamente com o protocolo interno (não
// documentado) do embed via postMessage cru — reimplementar esse protocolo à
// mão é frágil (timing de handshake, mensagens do vídeo anterior confundidas
// com o novo). A API oficial (`https://www.youtube.com/iframe_api`) expõe um
// objeto `YT.Player` de verdade: eventos garantidos (onReady/onStateChange),
// métodos reais (playVideo/pauseVideo/seekTo/setVolume/mute/unMute) e
// destroy() para descartar uma instância sem ambiguidade. O embed continua
// usando a sessão logada do navegador (conta Premium ⇒ sem anúncios).
let yt = null;   // estado do player ativo (null = sem YouTube em cena)
let ytSeq = 0;   // guarda sequencial: descarta fades/loads assíncronos obsoletos

// Carrega a API oficial uma única vez. Não é dependência de BUILD (não entra
// npm nenhum, e o projeto já depende de rede/youtube.com para tocar o vídeo),
// mas também NÃO é "só um <script>": ele executa no mesmo documento onde o
// shell publica `__AVBridge` via addJavascriptInterface, com acesso
// same-origin ao IndexedDB, ao OPFS e à ponte nativa. Não há CSP em nenhuma
// das duas páginas, então o risco de supply-chain neste endpoint é ACEITO
// conscientemente — a mitigação (header Content-Security-Policy servido pelo
// WebPathHandler, ou o player dentro de um iframe de outro origin) está fora
// do alcance deste arquivo e ainda não foi feita.
let ytApiPromise = null;
function loadYtApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prevCb) prevCb(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    // Sem onerror, uma falha de rede deixaria a promise pendente para sempre
    // (e cacheada), travando o `await loadYtApi()` de todo vídeo do YouTube
    // desta sessão. Rejeitar + limpar o cache deixa a próxima tentativa
    // refazer o fetch.
    tag.onerror = () => { ytApiPromise = null; reject(new Error('YT API load failed')); };
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// Chama um método do player "com segurança": ignora se o player ainda não
// aceita comandos ou já foi destruído (evita exceções não tratadas).
function ytSafeCall(fn) { try { fn(); } catch (_) {} }

// A API substitui este elemento host pelo <iframe> real que ela cria e
// gerencia — um host novo a cada vídeo garante um iframe/contentWindow novo,
// então nunca há confusão entre eventos de um player e o próximo.
let ytHostSeq = 0;
function createYtHost() {
  const host = document.createElement('div');
  host.id = 'yt-host-' + (++ytHostSeq);
  youtubeEl.appendChild(host);
  return host;
}

function ytStatus() {
  if (!yt || !yt.player || yt.stopping) return;
  let state = -1, currentTime = 0, duration = 0;
  try {
    state = yt.player.getPlayerState();
    currentTime = yt.player.getCurrentTime() || 0;
    duration = yt.player.getDuration() || 0;
  } catch (_) { return; }
  sendDisplayStatus({
    mediaId: yt.mediaId,
    view: yt.view,
    muted: yt.muted,
    volume: yt.volume,
    playing: state === 1 || state === 3, // playing | buffering
    currentTime,
    duration,
  });
}

// A API oficial não empurra tempo continuamente (só eventos discretos de
// estado) — para a barra de progresso do Controle, fazemos um polling leve
// enquanto este player existir. Também resincroniza o mudo: se autoplay com
// som foi bloqueado (comum antes do toque em #startBtn — ver mais abaixo), o
// player pode ter ficado mudo mesmo com o operador querendo som.
// `player.isMuted()` é um FATO real relatado pelo player agora — ao contrário
// da antiga detecção por tempo decorrido (removida por gerar falsos positivos
// com buffering), aqui não há suposição: só reage quando o mudo realmente
// diverge da intenção, convergindo assim que a página tiver um gesto real.
function ytStartTimeLoop() {
  const cur = yt;
  clearInterval(cur.timeLoop);
  cur.timeLoop = setInterval(() => {
    if (yt !== cur || !cur.player) return;
    if (!cur.muted) {
      let stillMuted = false;
      try { stillMuted = cur.player.isMuted(); } catch (_) {}
      if (stillMuted) {
        ytSafeCall(() => cur.player.unMute());
        ytSafeCall(() => cur.player.setVolume(Math.round(cur.volume * 100)));
      }
    }
    ytStatus();
  }, 500);
}

function ytClearFadeStyle() {
  youtubeEl.style.transition = '';
  youtubeEl.style.opacity = '';
}

// Escudo anti-UI: usado APENAS no fim do vídeo, para a tela final de
// "vídeos relacionados" nunca chegar ao telão enquanto o player é derrubado.
// Pausa e seek seguem o padrão (quadro congelado + UI nativa do YouTube,
// como um player normal) — sem tela preta.
function ytShield(on) {
  ytShieldEl.classList.toggle('on', !!on);
  if (!on) { ytShieldEl.style.transition = ''; ytShieldEl.style.opacity = ''; }
}

// Fonte única (compartilhada com o stage.js) da duração da rampa de mudo.
const MUTE_RAMP_TIME = createStage.MUTE_RAMP_TIME;

// Rampa de volume do player (fade sonoro) via setVolume, reusando o mesmo
// passo-a-passo do stage (createStage.rampSteps) — mesma curva/duração.
function ytRampVolume(from, to, dur) {
  if (!yt || !yt.player) return;
  const p = yt.player;
  clearInterval(yt.rampTimer);
  yt.rampTimer = createStage.rampSteps(from, to, dur, (v) => ytSafeCall(() => p.setVolume(Math.round(v * 100))));
}

// Revela o wrapper do YouTube (DOM + fade-in). Chamado quando o vídeo está de
// fato REPRODUZINDO (estado 1) ou quando o timeout de segurança expira —
// antes disso o player mostra título/botão grande, que nunca devem aparecer
// no telão. Independe da view: quem cobre/revela conforme o wallpaper
// ligado/desligado é a cortina compartilhada do stage (ver stage.coverIn/
// coverOut em ytSetView e onPlayerStateChange) — o wrapper em si só cuida de
// "o vídeo já tem conteúdo pronto pra mostrar", sempre.
function ytShow() {
  if (!yt || yt.shown) return;
  yt.shown = true;
  clearTimeout(yt.showTimer);
  if (fadeCfg.in) {
    youtubeEl.style.transition = 'none';
    youtubeEl.style.opacity = '0';
    youtubeEl.hidden = false;
    void youtubeEl.offsetWidth;
    youtubeEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
    youtubeEl.style.opacity = '1';
    yt.fadeTimer = setTimeout(ytClearFadeStyle, fadeCfg.time * 1000 + 60);
  } else {
    youtubeEl.hidden = false;
    ytClearFadeStyle();
  }
}

// Derruba o player imediatamente (sem transição).
function ytDrop() {
  if (yt) {
    clearInterval(yt.rampTimer);
    clearInterval(yt.timeLoop);
    clearTimeout(yt.showTimer);
    clearTimeout(yt.fadeTimer);
    clearTimeout(yt.endTimer);
    clearTimeout(yt.startTimer);
    clearTimeout(yt.muteApplyTimer);
    clearTimeout(yt.resumeTimer);
    if (yt.player) ytSafeCall(() => yt.player.destroy());
    yt = null;
  }
  ytShield(false);
  youtubeEl.hidden = true;
  // destroy() já remove o iframe que a API criou; innerHTML='' garante que
  // nenhum host residual sobre — o próximo load cria um host (e portanto um
  // iframe/contentWindow) inteiramente novo, então uma mensagem atrasada do
  // player anterior nunca pode ser confundida com o estado do próximo vídeo.
  youtubeEl.innerHTML = '';
  ytClearFadeStyle();
}

// Esmaece o player visível (fade-out ativo) com rampa de volume; quem chama
// decide o que vem depois. O vídeo NÃO é pausado (pausa desenharia a UI do
// YouTube no meio do fade) — o destino é sempre derrubar o player.
function ytFadeOutPlayer() {
  return new Promise((resolve) => {
    if (!yt || !fadeCfg.out || youtubeEl.hidden || !yt.shown) { resolve(); return; }
    clearTimeout(yt.fadeTimer);
    ytRampVolume(yt.volume, 0, fadeCfg.time);
    youtubeEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
    youtubeEl.style.opacity = '0';
    if (ytShieldEl.classList.contains('on')) {
      // escudo do fim de vídeo esmaece junto, revelando o wallpaper
      ytShieldEl.style.transition = 'opacity ' + fadeCfg.time + 's ease';
      ytShieldEl.style.opacity = '0';
    }
    setTimeout(resolve, fadeCfg.time * 1000);
  });
}

// `startAt`/`autoplay` chegam no comando de load da RECONEXÃO do telão (ver
// resendSceneToDisplay no Controle). Sem eles o vídeo do YouTube recomeçava do
// zero — e tocando — depois de um blip do dongle, exatamente como acontecia com
// a mídia local.
async function loadYoutube(rec, v, m, vol, startAt, autoplay) {
  // O YouTube não usa a recuperação de áudio do stage (ver tryRestoreAudio) —
  // se ela ficou presa em "bloqueado" por causa de um vídeo local anterior,
  // isso não pode vazar para o indicador do mixer durante o YouTube.
  endAudioRecovery();
  const seq = ++ytSeq;
  const desiredView = v === 'wallpaper' ? 'wallpaper' : 'visual';
  if (yt) {
    // YouTube → YouTube: esmaece o player atual antes de trocar.
    await ytFadeOutPlayer();
    if (seq !== ytSeq) return;
    ytDrop();
  } else {
    // Mídia comum sai esmaecendo até o PRETO (nunca a cortina do wallpaper
    // aqui — é troca de conteúdo, não um stop/clear do operador).
    await stage.fadeOutToBlack();
    if (seq !== ytSeq) return;
  }

  // Enquanto o vídeo carrega (mais lento que mídia local — depende de rede),
  // mostra PRETO em vez do wallpaper se a intenção é ver o conteúdo: o
  // wallpaper é reservado para quando é de fato a escolha do operador
  // (view='wallpaper'), não para uma espera de carregamento — sem isso, o
  // wallpaper ficava exposto por vários segundos a cada troca para YouTube,
  // parecendo que o sistema tinha parado em vez de só carregando.
  stage.instantCover(desiredView === 'wallpaper');

  try { await loadYtApi(); }
  catch (e) {
    // API não carregou (rede): aborta o load do vídeo — mas NUNCA em silêncio
    // sobre o preto. O instantCover acima acabou de descobrir o palco (view
    // 'visual') esperando um vídeo que não vem; devolver a cortina deixa o
    // telão no wallpaper, que é o ponto de repouso, em vez de um preto que se
    // lê como projetor apagado. E a caixa-preta registra o porquê — é a linha
    // que o `diag-dump` leva ao Registro quando o operador abrir Configurações.
    if (seq !== ytSeq) return; // um load mais novo já assumiu a cena
    diag('YT API FALHOU', { erro: String((e && e.message) || e || '?').slice(0, 80) });
    stage.instantCover(true);
    return;
  }
  if (seq !== ytSeq) return; // um load mais novo chegou enquanto a API carregava

  yt = {
    mediaId: rec.id,
    view: desiredView,
    muted: !!m,
    volume: typeof vol === 'number' ? vol : 1,
    player: null,
    ready: false, shown: false, endedSent: false, stopping: false,
    autoplay: autoplay !== false,
    // A INTENÇÃO de transporte, separada do estado real do player — é ela que
    // o vigia de segundo plano compara (ver ytWatchResume).
    wantPlaying: autoplay !== false,
    resumeTries: 0,
    showTimer: null, fadeTimer: null, endTimer: null, rampTimer: null,
    startTimer: null, timeLoop: null, muteApplyTimer: null, resumeTimer: null,
  };
  const cur = yt;
  // O wrapper fica oculto (cortina do wallpaper em cena) até o vídeo
  // REPRODUZIR — os estados de carregamento/cued do player mostram título e
  // botão grande.
  youtubeEl.hidden = true;
  ytClearFadeStyle();
  // Segurança: se por algum motivo o player nunca revelar sozinho (nenhum
  // onReady/onStateChange chegou), revela mesmo assim — melhor player com UI
  // do que telão vazio.
  cur.showTimer = setTimeout(() => { if (yt === cur && !cur.shown) ytShow(); }, 5000);

  const host = createYtHost();
  // Player "limpo": sem barra de controles (controls=0), sem anotações
  // (iv_load_policy=3), sem teclado (disablekb=1) e sem botão de fullscreen
  // (fs=0) — todo o transporte vem do Controle via a API. Junto com
  // pointer-events:none no wrapper (CSS) e o escudo anti-UI, nenhum overlay
  // do YouTube aparece no telão: só o vídeo.
  const player = new YT.Player(host, {
    videoId: rec.youtubeId,
    playerVars: {
      // `start` é o único jeito de o embed ABRIR já na posição: um seekTo
      // depois do onReady aparece como salto no telão. Só aceita inteiro.
      start: (typeof startAt === 'number' && startAt > 0) ? Math.floor(startAt) : 0,
      autoplay: autoplay === false ? 0 : 1,
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      // LEGENDA NUNCA. Num telão de culto ela cobre a parte de baixo do vídeo
      // — exatamente onde a Camada de Texto do app escreve — e vem no idioma e
      // no gosto da CONTA que estiver logada no WebView, não numa escolha do
      // operador. `cc_load_policy: 0` é só metade: ele diz "não force a
      // legenda", e perde para o "sempre mostrar legendas" da conta. A outra
      // metade é `unloadModule` (ver ytKillCaptions), que tira o módulo do
      // player em vez de pedir educadamente.
      cc_load_policy: 0,
      rel: 0,
      origin: location.origin,
    },
    events: {
      onReady: (e) => { if (yt === cur) onPlayerReady(e); },
      onStateChange: (e) => { if (yt === cur) onPlayerStateChange(e); },
    },
  });
  cur.player = player;
  // allow precisa estar no iframe real (criado pela API) para autoplay com
  // som/fullscreen/PiP funcionarem — garantido aqui em vez de depender do
  // default da API.
  ytSafeCall(() => {
    const frame = player.getIframe();
    if (frame) frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
  });
}

// stop/clear com YouTube ativo: esmaece e derruba o player (volta ao wallpaper).
async function stopYoutube() {
  const seq = ++ytSeq;
  // Marca 'stopping' já aqui: o vídeo continua tocando durante o fade
  // (rampa de volume, sem pausar — pausar desenharia UI), então sem isso o
  // Controle receberia display-status com playing:true durante todo o
  // fade-out (via polling OU via onPlayerStateChange) e sobrescreveria o
  // ícone de play que o stop acabou de aplicar.
  if (yt) { yt.stopping = true; clearInterval(yt.timeLoop); }
  await ytFadeOutPlayer();
  if (seq !== ytSeq) return;
  ytDrop();
}

function onPlayerReady(e) {
  if (!yt || yt.ready) return;
  yt.ready = true;
  const p = yt.player;
  ytSafeCall(() => {
    const frame = p.getIframe();
    if (frame) frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
  });
  ytKillCaptions(p);
  ytSafeCall(() => { if (yt.muted) p.mute(); else p.unMute(); });
  ytSafeCall(() => p.setVolume(Math.round(yt.volume * 100)));
  // Cena que voltou PAUSADA (reconexão): o quadro precisa aparecer, mas o vídeo
  // não pode sair andando sozinho na frente da congregação. `ytWatchStart`
  // também não corre — ele existe para empurrar um play que não pegou, e aqui
  // não há play a empurrar.
  if (yt.autoplay === false) {
    ytSafeCall(() => p.pauseVideo());
    ytShow();
    ytStartTimeLoop();
    return;
  }
  ytSafeCall(() => p.playVideo());
  ytStartTimeLoop();
  ytWatchStart(0);
}

// Tira a legenda do player, de verdade. `unloadModule` DESCARREGA o módulo em
// vez de pedir para ele ficar escondido, e é o único caminho que vence o
// "sempre mostrar legendas" de uma conta logada. São dois nomes porque são dois
// players: `cc` é o HTML5 (o que roda hoje) e `captions` é o legado — chamar os
// dois é barato e cobre o dia em que o embed servir o outro.
//
// Roda no `onReady` E de novo quando o vídeo começa a REPRODUZIR: o módulo de
// legenda costuma ser carregado junto com a faixa de vídeo, ou seja, depois do
// ready — descarregar só ali deixaria a legenda voltar no primeiro quadro.
function ytKillCaptions(p) {
  if (!p) return;
  ytSafeCall(() => p.unloadModule('captions'));
  ytSafeCall(() => p.unloadModule('cc'));
}

// ===== O vídeo não pode parar porque o app saiu da frente =====
// Com o app minimizado o telão segue projetando (a `Presentation` não morre com
// a Activity — é para isso que existe o serviço de sessão), e um `<video>`
// local continua tocando normalmente. O embed do YouTube, não: o player dele
// PAUSA sozinho quando a página passa a "oculta", que é o que o Android reporta
// ao WebView quando o app vai para segundo plano. O louvor parava no meio.
//
// Aqui isso é sempre um engano, e dá para afirmar: o player nasce com
// `controls: 0`, `disablekb: 1`, o wrapper tem `pointer-events: none` e ainda
// há o escudo anti-UI — NINGUÉM pausa este vídeo pelo telão. Toda pausa que o
// app não pediu (`wantPlaying`) veio do próprio YouTube, e a resposta certa é
// mandar tocar de novo.
//
// LIMITADO a algumas tentativas espaçadas, e não um laço eterno: se o vídeo
// parar por um motivo real e permanente (um erro do embed, por exemplo),
// insistir para sempre seria uma briga invisível com o player. O contador zera
// a cada vez que ele volta a REPRODUZIR, então uma sessão longa com várias
// idas ao segundo plano é recuperada todas as vezes.
const YT_RESUME_TRIES = 4;
const YT_RESUME_MS = 700;
function ytWatchResume() {
  const cur = yt;
  if (!cur || !cur.wantPlaying || cur.stopping || cur.endedSent) return;
  if (cur.resumeTries >= YT_RESUME_TRIES) return;
  cur.resumeTries++;
  clearTimeout(cur.resumeTimer);
  cur.resumeTimer = setTimeout(() => {
    if (yt !== cur || !cur.player || !cur.wantPlaying || cur.stopping) return;
    let st;
    try { st = cur.player.getPlayerState(); } catch (_) { return; }
    if (st !== 2) return;   // já saiu da pausa sozinho
    ytSafeCall(() => cur.player.playVideo());
  }, YT_RESUME_MS);
}

// Garante que o vídeo realmente comece (o primeiro playVideo() pode chegar
// antes do player interno estar pronto para aceitá-lo — sem retentativa, o
// vídeo fica parado/cued indefinidamente). NUNCA mexe no mudo aqui: isso não
// é detecção de bloqueio de áudio, só um empurrão para o play pegar. Desiste
// sozinho assim que o vídeo entra em reprodução/pausa/buffering, ou após
// algumas tentativas.
function ytWatchStart(attempt) {
  const cur = yt;
  cur.startTimer = setTimeout(() => {
    if (yt !== cur || !cur.player) return;
    let st;
    try { st = cur.player.getPlayerState(); } catch (_) { return; }
    if (st === 1 || st === 2 || st === 3) return; // playing/paused/buffering: já saiu do zero
    if (attempt >= 4) return;
    ytSafeCall(() => cur.player.playVideo());
    ytWatchStart(attempt + 1);
  }, 2000);
}

function onPlayerStateChange(e) {
  if (!yt) return;
  const st = e.data;
  if (st === 1) { // reproduzindo: revela (1ª vez) e libera replays de 'ended'
    ytShow();
    ytShield(false);
    yt.endedSent = false;
    // O módulo de legenda entra junto com a faixa de vídeo, DEPOIS do ready —
    // descarregar só lá deixava a legenda voltar no primeiro quadro.
    ytKillCaptions(yt.player);
    // Voltou a tocar: a cota do vigia de segundo plano é reposta.
    yt.resumeTries = 0;
    clearTimeout(yt.resumeTimer);
    // Se a view atual pedir visual, esconde a cortina (a reprodução em si
    // não espera por isso — só a exibição). Se a view for wallpaper, fica
    // tocando por baixo da cortina; ytSetView('visual') revela depois.
    if (yt.view === 'visual') stage.coverOut();
  }
  // Pausa que o app NÃO pediu = o YouTube pausou sozinho (app em segundo
  // plano). Ver ytWatchResume: aqui ninguém mais tem como pausar este player.
  if (st === 2) ytWatchResume();
  if (st === 0 && !yt.endedSent) { // fim do vídeo → avanço de playlist no Controle
    yt.endedSent = true;
    // cobre a tela final de "vídeos relacionados" enquanto o player cai —
    // instantâneo, e já deixa a cortina do wallpaper pronta por baixo do
    // escudo (revelada com fade quando o escudo sumir em ytFadeOutPlayer()).
    ytShield(true);
    stage.instantCover(true);
    AVDB.sendCommand({ type: 'media-ended', mediaId: yt.mediaId });
    // Sem 'load' de avanço automático em seguida (repeat off / Controle
    // fechado), derruba o player — fim natural volta ao wallpaper.
    const cur = yt;
    cur.endTimer = setTimeout(() => {
      let curSt;
      try { curSt = cur.player && cur.player.getPlayerState(); } catch (_) { curSt = null; }
      if (yt === cur && curSt === 0) stopYoutube();
    }, 400);
  }
  ytStatus();
}

// Transporte/volume/view com YouTube ativo, via métodos do YT.Player.
function ytHandle(cmd) {
  if (!yt.player) return;
  const p = yt.player;
  switch (cmd.type) {
    case 'play':
      yt.wantPlaying = true;
      yt.resumeTries = 0;
      ytSafeCall(() => p.playVideo());
      break;
    case 'pause':
      // A intenção do operador desarma o vigia — daqui em diante a pausa é
      // legítima e não pode ser desfeita por ele.
      yt.wantPlaying = false;
      clearTimeout(yt.resumeTimer);
      // padrão de player normal: quadro congelado (a UI nativa que o
      // YouTube desenhar na pausa é aceita — sem tela preta)
      ytSafeCall(() => p.pauseVideo());
      break;
    case 'seek':
      if (isFinite(cmd.time)) ytSafeCall(() => p.seekTo(cmd.time, true));
      break;
    case 'volume':
      if (typeof cmd.volume === 'number') {
        yt.volume = cmd.volume;
        clearInterval(yt.rampTimer); // operador manda: cancela rampa em curso
        clearTimeout(yt.muteApplyTimer);
        ytSafeCall(() => p.setVolume(Math.round(cmd.volume * 100)));
      }
      break;
    case 'mute': {
      // Mesma rampa curta do stage.js (mídia local): ao mutar, desce o volume
      // até 0 e só então muta de fato (evita corte abrupto); ao desmutar,
      // desmuta já (senão volume=0 não seria ouvido) e sobe a rampa.
      yt.muted = !!cmd.muted;
      clearTimeout(yt.muteApplyTimer);
      const cur = yt;
      if (cur.muted) {
        let alreadyMuted = false;
        try { alreadyMuted = p.isMuted(); } catch (_) {}
        ytRampVolume(alreadyMuted ? 0 : cur.volume, 0, MUTE_RAMP_TIME);
        cur.muteApplyTimer = setTimeout(() => {
          if (yt === cur && cur.muted) ytSafeCall(() => cur.player.mute());
        }, MUTE_RAMP_TIME * 1000);
      } else {
        ytSafeCall(() => p.unMute());
        ytRampVolume(0, cur.volume, MUTE_RAMP_TIME);
      }
      break;
    }
    case 'view': ytSetView(cmd.view === 'wallpaper' ? 'wallpaper' : 'visual'); break;
  }
}

// Visual on/off para YouTube: liga/desliga a cortina COMPARTILHADA do
// wallpaper (mesma usada pelo stage) — o wrapper do YouTube em si nunca
// esconde/revela por causa da view; ele só cuida de ter conteúdo pronto (ver
// ytShow()). O vídeo continua tocando (áudio incluído) por baixo da cortina
// quando ela está cobrindo.
function ytSetView(v) {
  if (!yt || yt.view === v) return;
  yt.view = v;
  if (v === 'wallpaper') stage.coverIn(false); // sem rampa: só o visual muda
  else stage.coverOut();
  ytStatus();
}

// Um `pause` que o app não pediu é o EVENTO que interessa: é ele que o
// operador vê como "o vídeo parou". `pausaComandada` é armado por quem manda
// pausar de verdade, e zerado logo depois.
let pausaComandada = 0;
(function vigiarVideo() {
  const v = document.getElementById('video');
  if (!v) return;
  v.addEventListener('pause', () => {
    const meu = Date.now() - pausaComandada < 400;
    diag(meu ? 'pausa (comando)' : 'PAUSA ESPONTÂNEA', { t2: Math.round(v.currentTime) });
  });
  v.addEventListener('play', () => diag('play', { t2: Math.round(v.currentTime) }));
  v.addEventListener('stalled', () => diag('travou'));
  v.addEventListener('emptied', () => diag('esvaziou'));
})();

AVDB.onCommand(async (cmd) => {
  // A guarda vem PRIMEIRO: ela estava três linhas abaixo, depois de dois
  // acessos a `cmd.type` — ou seja, o comando nulo que ela existe para barrar
  // já teria derrubado o handler antes de chegar nela. Hoje `deliverCommand`
  // filtra o nulo antes daqui, então isto é cinto e suspensório; a ordem
  // errada é que não podia ficar, porque quem lê conclui que o caso está
  // coberto.
  if (!cmd) return;
  if (cmd.type === 'pause' || cmd.type === 'clear' || cmd.type === 'load') pausaComandada = Date.now();
  // O Controle pede a caixa-preta ao abrir Configurações.
  if (cmd.type === 'diag-ask') {
    AVDB.sendCommand({ type: 'diag-dump', linhas: diario.slice(-DIAG_MAX) });
    return;
  }

  // Preenchimento (object-fit): sempre vai pro stage, mesmo com YouTube ativo
  // (o iframe não usa isso) — sem esse desvio explícito, cairia em ytHandle()
  // (que ignora 'fit') enquanto um vídeo do YouTube estiver tocando, e o
  // stage só pegaria o valor novo na próxima mídia local, com atraso.
  if (cmd.type === 'fit') {
    stage.setFit(cmd.fit);
    return;
  }

  // Fundo da letra sincronizada (preto/imagens dos slides) — não é um
  // comando do stage.js, letra é camada paralela (ver setLyricsBgMode).
  if (cmd.type === 'lyricsbg') {
    setLyricsBgMode(cmd.mode);
    return;
  }

  // Texto manual (Bíblia/Mensagem): camada paralela (ver showText). Um novo
  // 'text' mostra/atualiza o cartão; 'text-hide' encerra sem tocar na mídia.
  if (cmd.type === 'text') { showText(cmd); return; }
  if (cmd.type === 'text-hide') { hideText(); return; }
  // Wallpaper trocado no Controle: a imagem já está no state compartilhado.
  if (cmd.type === 'wallpaper') { applyWallpaper(); return; }
  // Microfone ao vivo: camada de ÁUDIO independente — não toca na mídia, no
  // texto nem na cortina. Convive com qualquer coisa em cena.
  if (cmd.type === 'mic') { setMic(cmd.on); return; }
  // Enquanto o texto manual está em cena, ele é um OVERLAY independente:
  //  - 'view' liga/desliga a cortina do wallpaper por cima do texto;
  //  - transporte (play/pause/seek/volume/mute) segue pro stage — controla o
  //    ÁUDIO DE FUNDO (o texto não é afetado);
  //  - 'load' de ÁUDIO troca o som de fundo mantendo o texto; 'load' de VISUAL
  //    (vídeo/imagem/YouTube) e 'clear' encerram o texto e seguem o fluxo.
  if (textActive) {
    if (cmd.type === 'view') {
      const v = cmd.view === 'wallpaper' ? 'wallpaper' : 'visual';
      textView = v;
      // Delega a mudança a QUEM É DONO do estado (o player do YouTube, ou o
      // stage), em vez de mexer na cortina por fora. Chamar coverIn/coverOut
      // direto daqui movia a cortina deixando `stage.view`/`yt.view`
      // congelados no valor antigo, e o estrago só aparecia DEPOIS do
      // 'text-hide': o 'view' seguinte comparava com esse valor, concluía que
      // nada mudara e RETORNAVA SEM FAZER NADA — o botão de cobrir/mostrar o
      // telão ficava morto e o operador precisava tocá-lo duas ou três vezes.
      // Na direção oposta era pior: com a cortina cobrindo e `stage.view`
      // ainda 'visual', o 'play' seguinte reavaliava computeCover() e
      // DESCOBRIA o telão sozinho, expondo a mídia que o operador tinha
      // coberto de propósito.
      if (yt) { ytSetView(v); return; }
      // `overlay: true` — o cartão de texto está por cima do stage, então aqui
      // descobrir REVELA alguma coisa mesmo sem mídia nenhuma. Sem esse aviso o
      // stage pularia a transição (ele só enxerga o que ele mesmo desenha, e
      // sem mídia a cortina cobre nos dois valores de view — ver setViewFaded)
      // e o versículo apareceria seco, sem o fade.
      await stage.handle({ type: 'view', view: v, overlay: true });
      // O cartão de texto é INDEPENDENTE da mídia — um versículo no ar sem
      // nada carregado é o caso mais comum na pregação. Para o stage, porém,
      // "sem mídia" (ou mídia terminada) quer dizer cortina fechada
      // (computeCover), e o instantCover final de setViewFaded reengoliria o
      // versículo logo depois do fade. Reafirma a cortina aberta agora que o
      // estado interno da view já foi atualizado, que é o que o delegar acima
      // veio buscar. `textActive` é reconferido porque o fade dura 0,6 s: se
      // nesse meio tempo o texto saiu de cena, quem manda é
      // restoreSceneAfterText.
      if (textActive && textView === 'visual') stage.instantCover(false);
      return;
    }
    if (cmd.type === 'clear') hideText(false);
    // O 'load' com texto em cena é decidido no bloco principal, logo abaixo,
    // com UMA leitura do registro — este bloco fazia um `getMedia` próprio e o
    // principal repetia a MESMA leitura duas linhas depois, um IDB pago em
    // dobro a cada troca de mídia durante a pregação.
    // demais comandos (play/pause/seek/volume/mute) caem no fluxo normal abaixo.
  }

  if (cmd.type === 'load') {
    // Esconde a letra incondicionalmente ANTES de qualquer coisa (mesmo
    // padrão do loadSeq do stage.js): sem isso, trocar de um hino direto pra
    // um vídeo do YouTube nunca escondia o layer de letra de verdade — só
    // ficava mascarado por sorte de ordem de pintura no DOM.
    hideLyrics(true);
    const rec = await AVDB.getMedia(cmd.mediaId);
    // Texto manual em cena: 'load' VISUAL o encerra, 'load' de áudio o mantém
    // (o som de fundo troca por baixo do cartão). Sem restaurar a cena: o
    // próprio load abaixo monta a nova (restaurar aqui faria a antiga piscar).
    if (textActive && (!rec || rec.kind !== 'audio')) hideText(false);
    if (rec && rec.kind === 'youtube') {
      loadYoutube(rec, cmd.view, cmd.muted, cmd.volume, cmd.time, cmd.playing);
      return;
    }
    // YouTube → mídia comum: o player esmaece por cima enquanto a nova mídia
    // entra por baixo (crossfade); sem fade, derruba na hora. O `++ytSeq`
    // também CANCELA um loadYoutube possivelmente em curso entre os awaits
    // (yt ainda null): sem isto, esse player nasceria por cima desta mídia
    // comum alguns segundos depois (o fadeOutToBlack/loadYtApi ainda corria
    // quando este load chegou).
    if (yt && fadeCfg.out && !youtubeEl.hidden) {
      stopYoutube();
    } else {
      ++ytSeq;
      ytDrop();
    }
    if (rec && rec.kind === 'audio' && Array.isArray(rec.lyrics) && rec.lyrics.length) showLyrics(rec);
    stage.handle(cmd);
    return;
  }

  // Passar SLIDE da apresentação: só a imagem do palco troca (ver `page` no
  // stage.js). Não passa pelo `load` de propósito — recarregar a mídia para
  // trocar uma página que já está na mão faria o telão piscar preto a cada
  // slide, na frente da congregação.
  if (cmd.type === 'page') {
    stage.handle(cmd);
    return;
  }

  if (cmd.type === 'clear') {
    hideLyrics(true);
    // `++ytSeq` (via stopYoutube quando há player, ou direto) cancela também um
    // loadYoutube em curso entre os awaits (yt ainda null) — sem isto, o vídeo
    // começaria a tocar depois de o operador já ter parado.
    if (yt) stopYoutube();
    else ++ytSeq;
    stage.handle(cmd);
    return;
  }

  // Operador pediu (botão de mudo do mixer): retentativa imediata de áudio.
  if (cmd.type === 'audio-retry') {
    if (audioBlocked) tryRestoreAudio();
    return;
  }

  if (yt) { ytHandle(cmd); return; }

  stage.handle(cmd);
});

async function restore() {
  // Adianta o fetch do script da IFrame Player API do YouTube (~1x por sessão)
  // já na abertura do Display, em vez de esperar o primeiro vídeo do YouTube
  // ser carregado. SÓ NO NAVEGADOR: lá o embed é o caminho normal de um vídeo
  // do YouTube e o custo de rede vai ser pago de qualquer forma — só não faz
  // sentido esperar o meio do culto pra pagá-lo. No app nativo o embed é
  // fallback raro (o caminho é a transmissão direta ou o download), e o
  // prefetch injetava script de terceiro no origin privilegiado — o mesmo
  // documento que enxerga `__AVBridge`, IDB e OPFS, sem CSP (risco declarado
  // em loadYtApi) — em TODA sessão, mesmo nas muitas em que nenhum embed
  // toca. O `loadYtApi()` sob demanda do loadYoutube() continua cobrindo o
  // caso nativo, pagando o fetch só quando o fallback é real.
  // Fire-and-forget: não atrasa nada, loadYoutube() espera a mesma promise.
  if (!window.__NATIVE__) {
    loadYtApi().catch(() => {});   // prefetch: falha de rede é retentada no 1º loadYoutube()
  }
  // Config de transições (fade) definida no Controle — preferência visual,
  // não é "tocar" nada.
  // Transições são INERENTES ao sistema (sempre ligadas, duração fixa — ver
  // fadeCfg acima): não há mais config salva nem ajustável; aplica o valor fixo.
  stage.setFade({ fadeIn: fadeCfg.in, fadeOut: fadeCfg.out, time: fadeCfg.time });
  // As preferências visuais ficam num try/finally porque ANUNCIAR-SE não pode
  // depender delas. Toda a reconexão do sistema pende do 'display-ready' (é ele
  // que dispara o resendSceneToDisplay do Controle): se uma leitura do IDB
  // rejeitasse — upgrade bloqueado, armazenamento despejado, transação
  // abortada —, a Presentation recriada depois de um blip do espelhamento
  // ficava parada no wallpaper, sem nada no Controle explicando e sem outra
  // saída além de reiniciar o app. Perder o fundo da letra ou o wallpaper é
  // um defeito visível e recuperável; perder a reconexão, não.
  try {
    // Fundo da letra sincronizada (preto/imagens dos slides) — preferência
    // visual, igual ao fade/fit.
    const lyricsBg = await AVDB.getState('lyricsBg');
    lyricsBgMode = lyricsBg === 'image' ? 'image' : 'black';
    applyLyricsBgClass();
    // Preenchimento da mídia (ajustar/preencher/esticar) — preferência visual,
    // igual ao fade acima.
    const fit = await AVDB.getState('fit');
    if (fit) stage.setFit(fit);
    // Wallpaper escolhido pelo operador — preferência visual, igual às acima.
    await applyWallpaper();
  } catch (_) {
    // Segue nos padrões (preto na letra, 'contain' no fit, gradiente no fundo).
  } finally {
    // NÃO recarrega nem toca a última mídia sozinho: abrir o Display nunca
    // deve iniciar reprodução por conta própria — fica no wallpaper (ponto
    // inicial) até um comando explícito chegar. O Controle, ao receber
    // 'display-ready', decide (baseado no que ELE sabe que estava tocando,
    // não em algo persistido pelo próprio Display) se reenvia um 'load' para
    // retomar.
    diag('telão pronto');
    AVDB.sendCommand({ type: 'display-ready' });
  }
}

// Toque único ao abrir ("Ligar Sistema"): o gesto real (pointerdown, que já
// borbulha para o listener de recuperação de áudio do stage) libera autoplay
// com som em conteúdo de terceiros (iframe do YouTube) pelo resto da sessão.
// Some para sempre no primeiro toque — se um YouTube já tiver sido restaurado
// (restore() abaixo) antes do toque, o clique dá um empurrão imediato
// (play + som); mesmo sem isso, ytWatchStart() e o resync de mudo em
// ytStartTimeLoop() convergiriam sozinhos em até alguns segundos. Além de
// ativar o Display, o mesmo gesto abre o Controle (mesma ressalva do botão
// "Abrir Display" do Controle: sem API web garantida para lançar outro PWA
// instalado, pode cair numa aba comum do Chrome como fallback).
const startBtnEl = document.getElementById('startBtn');

// No app nativo o overlay "Ligar Sistema" NÃO EXISTE: o WebView roda com
// `setMediaPlaybackRequiresUserGesture(false)`, então não há política de gesto
// para destravar — nem para mídia local, nem para o iframe do YouTube. O
// telão precisa acender sozinho ao receber um comando; exigir um toque numa
// TV (que não recebe toque nenhum) seria um beco sem saída.
if (window.__NATIVE__) startBtnEl.hidden = true;
// "Ligar Display" APENAS ativa o Display (destrava o áudio de terceiros/YouTube
// com o gesto real). O Display é INDEPENDENTE — não abre o Controle nem
// redireciona pra lugar nenhum. `display: standalone` no manifest continua
// (não `fullscreen`), mas aqui não há mais nenhum window.open.
startBtnEl.addEventListener('click', () => {
  if (yt && yt.player) {
    const p = yt.player;
    ytSafeCall(() => { if (yt.muted) p.mute(); else p.unMute(); });
    ytSafeCall(() => p.setVolume(Math.round(yt.volume * 100)));
    ytSafeCall(() => p.playVideo());
  }
  // Feedback de toque (pill "confirma" antes de sumir) — sem isso o overlay
  // desaparece no mesmo instante do clique e o toque parece não ter feito nada.
  startBtnEl.classList.add('confirming');
  setTimeout(() => { startBtnEl.hidden = true; }, 300);
}, { once: true });

// NÃO há auto-atualização por service worker aqui. Havia um bloco que
// registrava `sw.js` e recarregava a página no `controllerchange` (adiando até
// o telão ficar idle), mas o `sw.js` saiu do bundle junto com os andaimes dos
// dois PWAs instaláveis: no navegador o register devolvia 404 e a promise era
// engolida pelo .catch, e no app nativo o bloco nem chegava a rodar. Ou seja,
// código morto nos dois contextos, sugerindo ao próximo leitor uma atualização
// que não existia. Quem atualiza a base web agora é o OTA do shell, aplicado
// no PRÓXIMO lançamento — justamente para nunca recarregar o WebView do telão
// no meio de um culto.

restore();
