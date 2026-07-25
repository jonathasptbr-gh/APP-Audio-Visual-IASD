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

// Config de transições espelhada localmente (o stage guarda a dele própria)
// para animar o player do YouTube, que vive fora do stage. INERENTE ao sistema:
// toda troca visual é animada com fade, sempre — não há opção de desligar nem
// ajustar (ver restore()).
let fadeCfg = { in: true, out: true, time: 0.6 };

// Fonte única do payload display-status: sendStatus (stage) e ytStatus
// (YouTube) só preenchem os valores; o `type` e o `audioBlocked` ficam num
// lugar só, evitando que os dois campos saiam inconsistentes para o Controle.
function sendDisplayStatus(fields) {
  AVDB.sendCommand(Object.assign({ type: 'display-status', audioBlocked }, fields));
}

function sendStatus() {
  if (yt) return; // com YouTube ativo o status tem fluxo próprio (ytStatus)
  updateLyricSlide(stage.isTimed() ? stage.getTime() : 0);
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
  onBlocked: () => {
    // Autoplay com som bloqueado: segue tocando MUDO (sempre permitido — o
    // vídeo aparece no telão sem toque) e a recuperação religa o áudio.
    stage.setMute(true);
    stage.play();
    beginAudioRecovery();
  },
  onEnded: () => {
    sendStatus();
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
// 'black' (padrão) ignora as imagens dos slides e mantém o fundo preto atrás
// do texto; 'image' usa as imagens de verdade. Persistido em state.lyricsBg
// pelo Controle, aplicado ao vivo via comando (ver setLyricsBgMode).
let lyricsBgMode = 'black';

// Último índice de slide cujo `time` já passou — mesmo algoritmo usado no
// Controle (previewTick) para manter os dois em sincronia.
function findSlideIndex(lyrics, time) {
  let idx = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= time) idx = i; else break;
  }
  return idx < 0 ? 0 : idx;
}

// Fade-in curto de um elemento (troca de slide/versículo) — respeita a config
// de transições (fadeCfg.in). Anima só o conteúdo de texto, não a moldura
// (evita a moldura "piscar"). Cancela uma animação anterior em curso.
function animateFadeIn(el) {
  if (!el || !el.animate || !fadeCfg.in) return;
  try { el.getAnimations().forEach((a) => a.cancel()); } catch (_) {}
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease' });
}

function hideLyrics() {
  currentLyrics = null;
  currentLyricsMeta = null;
  lyricSlideIdx = -1;
  lyricsEl.hidden = true;
  if (lyricImgUrl) { URL.revokeObjectURL(lyricImgUrl); lyricImgUrl = null; }
  lyricImgKey = null;
  lyricsImgEl.hidden = true;
  lyricsImgEl.removeAttribute('src');
}

function showLyrics(rec) {
  // Um texto manual (Bíblia/mensagem) em cena tem precedência: a música toca de
  // fundo, mas a letra dela não substitui o texto projetado pelo operador.
  if (textActive) return;
  currentLyrics = rec.lyrics;
  currentLyricsMeta = { hymnName: rec.hymnName, hymnTrack: rec.hymnTrack };
  lyricSlideIdx = -1;
  lyricsEl.hidden = false;
  renderLyricSlide(0);
}

// Só mexe no DOM quando o índice realmente muda (chamado a cada tick de tempo).
function renderLyricSlide(idx) {
  if (idx === lyricSlideIdx) return;
  lyricSlideIdx = idx;
  const slide = currentLyrics[idx];
  if (!slide) return;

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
    if (lyricImgUrl) { URL.revokeObjectURL(lyricImgUrl); lyricImgUrl = null; }
    // Oculta a <img> (não só limpa o src): sem isso, alguns navegadores
    // renderam o ícone/borda padrão de "imagem quebrada" mesmo sem `src`,
    // aparecendo como uma linha branca de margem sobre o preto de
    // `.lyrics-bg`. Escondida, o preto do próprio `.lyrics-bg` fica exposto.
    lyricsImgEl.hidden = true;
    lyricsImgEl.removeAttribute('src');
    return;
  }
  AVDB.opfsGetFile(key).then((file) => {
    if (seq !== lyricLoadSeq) return; // um slide mais novo já assumiu enquanto isso resolvia
    const url = URL.createObjectURL(file);
    const prevUrl = lyricImgUrl;
    lyricImgUrl = url;
    lyricImgKey = key;
    lyricsImgEl.src = url;
    lyricsImgEl.hidden = false;
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

function showText(cmd) {
  const wallpaper = cmd.view === 'wallpaper';
  textMode = cmd.mode === 'message' ? 'message' : 'verse';
  textContentEl.classList.toggle('mode-message', textMode === 'message');
  textMainEl.textContent = cmd.main || '';
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
  hideLyrics();
  textActive = true;
  textEl.hidden = false;
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
  textEl.hidden = true;
  textMainEl.textContent = '';
  textSubEl.textContent = '';
  if (restore) restoreSceneAfterText();
}

// Devolve a cena ao estado em que ela estava antes do texto manual entrar.
// Vídeo/imagem/YouTube não precisam de nada: nunca foram interrompidos e
// reaparecem sozinhos assim que o cartão opaco sai da frente. Só a letra
// sincronizada precisa ser remontada — e no slide certo, não do começo.
function restoreSceneAfterText() {
  const cur = stage.getCurrent();
  if (!cur || cur.kind !== 'audio' || !Array.isArray(cur.lyrics) || !cur.lyrics.length) return;
  showLyrics(cur);
  updateLyricSlide(stage.getTime());
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

// Carrega a API oficial uma única vez (é só um <script>, não uma dependência
// de build — o projeto já depende de rede/youtube.com para tocar o vídeo).
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

async function loadYoutube(rec, v, m, vol) {
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
  catch (_) { return; }   // API não carregou (rede) — aborta o load do vídeo
  if (seq !== ytSeq) return; // um load mais novo chegou enquanto a API carregava

  yt = {
    mediaId: rec.id,
    view: desiredView,
    muted: !!m,
    volume: typeof vol === 'number' ? vol : 1,
    player: null,
    ready: false, shown: false, endedSent: false, stopping: false,
    showTimer: null, fadeTimer: null, endTimer: null, rampTimer: null,
    startTimer: null, timeLoop: null, muteApplyTimer: null,
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
      autoplay: 1,
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
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
  ytSafeCall(() => { if (yt.muted) p.mute(); else p.unMute(); });
  ytSafeCall(() => p.setVolume(Math.round(yt.volume * 100)));
  ytSafeCall(() => p.playVideo());
  ytStartTimeLoop();
  ytWatchStart(0);
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
    // Se a view atual pedir visual, esconde a cortina (a reprodução em si
    // não espera por isso — só a exibição). Se a view for wallpaper, fica
    // tocando por baixo da cortina; ytSetView('visual') revela depois.
    if (yt.view === 'visual') stage.coverOut();
  }
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
      ytSafeCall(() => p.playVideo());
      break;
    case 'pause':
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

AVDB.onCommand(async (cmd) => {
  if (!cmd) return;

  if (cmd.type === 'fade') {
    fadeCfg = {
      in: !!cmd.fadeIn,
      out: !!cmd.fadeOut,
      time: (typeof cmd.time === 'number' && cmd.time > 0) ? cmd.time : fadeCfg.time,
    };
    stage.handle(cmd);
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
  // Enquanto o texto manual está em cena, ele é um OVERLAY independente:
  //  - 'view' liga/desliga a cortina do wallpaper por cima do texto;
  //  - transporte (play/pause/seek/volume/mute) segue pro stage — controla o
  //    ÁUDIO DE FUNDO (o texto não é afetado);
  //  - 'load' de ÁUDIO troca o som de fundo mantendo o texto; 'load' de VISUAL
  //    (vídeo/imagem/YouTube), 'stop' e 'clear' encerram o texto e seguem o fluxo.
  if (textActive) {
    if (cmd.type === 'view') {
      textView = cmd.view === 'wallpaper' ? 'wallpaper' : 'visual';
      if (textView === 'wallpaper') stage.coverIn(false); else stage.coverOut();
      return;
    }
    if (cmd.type === 'load') {
      const rec = await AVDB.getMedia(cmd.mediaId);
      // Visual encerra; áudio mantém. Sem restaurar: o load logo abaixo já
      // monta a cena nova (restaurar aqui faria a antiga piscar antes).
      if (!rec || rec.kind !== 'audio') hideText(false);
    } else if (cmd.type === 'stop' || cmd.type === 'clear') {
      hideText(false);
    }
    // demais comandos (play/pause/seek/volume/mute) caem no fluxo normal abaixo.
  }

  if (cmd.type === 'load') {
    // Esconde a letra incondicionalmente ANTES de qualquer coisa (mesmo
    // padrão do loadSeq do stage.js): sem isso, trocar de um hino direto pra
    // um vídeo do YouTube nunca escondia o layer de letra de verdade — só
    // ficava mascarado por sorte de ordem de pintura no DOM.
    hideLyrics();
    const rec = await AVDB.getMedia(cmd.mediaId);
    if (rec && rec.kind === 'youtube') {
      loadYoutube(rec, cmd.view, cmd.muted, cmd.volume);
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

  if (cmd.type === 'stop' || cmd.type === 'clear') {
    hideLyrics();
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
  // ser carregado. O Cronograma é, na prática, sempre usado na sessão em
  // curso — então esse custo de rede vai ser pago de qualquer forma; só não
  // faz sentido esperar o meio do culto pra pagá-lo. Fire-and-forget: não
  // atrasa nada, loadYoutube() já teria que esperar essa mesma promise.
  loadYtApi().catch(() => {});   // prefetch: uma falha de rede aqui é retentada no 1º loadYoutube()
  // Config de transições (fade) definida no Controle — preferência visual,
  // não é "tocar" nada.
  // Transições são INERENTES ao sistema (sempre ligadas, duração fixa — ver
  // fadeCfg acima): não há mais config salva nem ajustável; aplica o valor fixo.
  stage.setFade({ fadeIn: fadeCfg.in, fadeOut: fadeCfg.out, time: fadeCfg.time });
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
  // NÃO recarrega nem toca a última mídia sozinho: abrir o Display nunca
  // deve iniciar reprodução por conta própria — fica no wallpaper (ponto
  // inicial) até um comando explícito chegar. O Controle, ao receber
  // 'display-ready', decide (baseado no que ELE sabe que estava tocando,
  // não em algo persistido pelo próprio Display) se reenvia um 'load' para
  // retomar.
  AVDB.sendCommand({ type: 'display-ready' });
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

// Auto-atualização: checa por versão nova ao abrir/retomar e recarrega quando
// um novo service worker assume — MAS nunca recarrega com mídia em cena (evita
// piscar/interromper a projeção ao vivo): adia até o Display voltar ao
// wallpaper (idle = sem YouTube e sem mídia local carregada).
// No app nativo NÃO há service worker: os assets já são locais (vêm do APK) e
// o auto-reload por `controllerchange` brigaria com o ciclo de vida da
// Presentation — recarregar o WebView do telão no meio de um culto é
// exatamente o que não pode acontecer.
if (!window.__NATIVE__ && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  const idle = () => !yt && !stage.isPlaying() && !stage.getCurrent();
  const reloadWhenIdle = () => {
    if (refreshing || !idle()) return;
    refreshing = true;
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    reloadWhenIdle();
    // Ainda com mídia em cena: reavalia periodicamente até ficar idle.
    if (!refreshing) setInterval(reloadWhenIdle, 3000);
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const check = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); };
    check();
    document.addEventListener('visibilitychange', check);
  }).catch(() => {});
}

restore();
