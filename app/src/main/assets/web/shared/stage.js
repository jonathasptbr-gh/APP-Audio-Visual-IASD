// "Palco" de reprodução reutilizável: aplica os mesmos comandos no Display e
// na pré-visualização do Controle, garantindo que mostrem exatamente a mesma
// coisa (wallpaper / imagem / vídeo + view + mudo + volume + play/seek).
//
// Uso: const stage = createStage({ wallpaper, img, video, forceMuted, onEnded, onTime, onBlocked });
// e depois stage.handle(cmd) para cada comando.
// Suporta blobs locais, arquivos do OPFS (opfsPath), itens de URL direta
// (blob=null, url=string) e itens youtube (kind='youtube').
//
// Modelo de camadas: o wallpaper é uma cortina que fica POR CIMA de toda
// mídia (CSS z-index) — img/video (e, no Display, o iframe do YouTube,
// gerenciado externamente) tocam/trocam de conteúdo livremente por baixo,
// sem precisar saber se estão "visíveis"; o wallpaper só liga/desliga essa
// cortina, com fade quando configurado. Isso evita a classe de bug em que
// uma mídia carregada com o wallpaper ligado nunca aprendia a se revelar
// depois — agora revelar é sempre só "esconder a cortina", nunca depende de
// em que estado a mídia foi carregada.

(function (global) {
  'use strict';

  // Rampa curta ao mutar/desmutar (evita corte abrupto de áudio). Fonte única
  // compartilhada com display.js e controle.js (via createStage.MUTE_RAMP_TIME).
  const MUTE_RAMP_TIME = 0.25;
  // Transições são INERENTES ao sistema: sempre ligadas, duração fixa, sem UI
  // nem state. Fonte ÚNICA (via createStage.FADE) — antes o mesmo objeto estava
  // escrito à mão nos dois apps e podia divergir sem ninguém notar.
  const FADE = { in: true, out: true, time: 0.6 };

  // O PÔSTER VAZIO — 1×1 transparente, e é isto que mata o "retângulo cinza com
  // um play preto gigante".
  //
  // O contrato do WebView é explícito (`WebChromeClient.getDefaultVideoPoster`):
  // *"o elemento de vídeo é representado por uma imagem de pôster; ela pode ser
  // dada pelo atributo `poster`, e **se o atributo estiver ausente um pôster
  // padrão será usado**"*. Esse padrão é o retângulo com o botão de play, e o
  // app não tem como estilizá-lo — só como deixar de pedi-lo.
  //
  // O `stage` já sabia disso pela metade: ele esconde o `<video>` enquanto não
  // há `src` (ver `load()`), justamente porque o placeholder piscava a cada
  // troca de mídia. Com a TRANSMISSÃO DIRETA a janela deixou de ser um piscar:
  // o `src` é um `MediaSource` que nasce VAZIO e só ganha o primeiro quadro
  // depois de init + índice + primeiro fragmento virem da rede — segundos, com
  // o elemento já revelado por `applyMedia()`. "Sem `src`" virou "sem dados", e
  // a regra de esconder não alcançava esse caso.
  //
  // Transparente, e não preto: as camadas já pintam `--stage-bg` por baixo
  // (`.layer` / `.pv-layer`), então o que aparece é exatamente o preto do
  // palco — sem uma segunda definição de "qual preto" para divergir da paleta.
  const POSTER_VAZIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  // Quanto esperar pelo primeiro quadro de uma TRANSMISSÃO antes de revelar
  // assim mesmo. Não é o tempo esperado (init + índice + fragmento levam ~1-3 s
  // numa rede de igreja): é o socorro para o caso em que o quadro nunca vem, e
  // por isso é generoso. Enquanto ele corre, o palco mostra preto — o mesmo
  // preto que mostraria de qualquer jeito, já que não há quadro. Quem falha de
  // verdade avisa antes, por `onStreamErro`.
  const PRONTO_STREAM_MS = 15000;
  // Duração dos fades de CAMADA (letra, texto, YouTube): entrar/sair de uma
  // camada paralela, em ms. Também compartilhada pelos dois apps.
  const LAYER_FADE_MS = 320;

  // ---- fades de camada paralela (letra/texto) ----
  // Estas três são idênticas nos dois apps (o Display as usa em #lyrics/#text,
  // o Controle em #pvLyrics/#pvText) e não têm nenhuma calibração própria —
  // por isso vivem aqui, e não duplicadas. As camadas COM calibração própria
  // (tamanhos em cq*) continuam separadas, no CSS de cada app.

  // Fade curto de conteúdo dentro de uma camada já visível (troca de texto).
  function fadeContentIn(el) {
    if (!el || !el.animate || !FADE.in) return;
    try { el.getAnimations().forEach((a) => a.cancel()); } catch (_) {}
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease' });
  }

  // Revela a camada inteira.
  function fadeLayerIn(el) {
    if (!el) return;
    const wasHidden = el.hidden;
    el.hidden = false;
    el.style.opacity = '';
    if (!el.animate) return;
    // Cancela SEMPRE, mesmo que a camada já estivesse visível: pode haver um
    // fadeLayerOut em curso (ela estava saindo e voltou), e deixá-lo correr
    // esconderia no `onfinish` justamente o que acabou de entrar.
    let hadAnim = false;
    try { el.getAnimations().forEach((a) => { hadAnim = true; a.cancel(); }); } catch (_) {}
    if (!FADE.in) return;
    if (!wasHidden && !hadAnim) return; // já em cena e estável: não repete o fade
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LAYER_FADE_MS, easing: 'ease' });
  }

  // Esconde a camada inteira.
  function fadeLayerOut(el) {
    if (!el || el.hidden) return;
    if (!el.animate || !FADE.out) { el.hidden = true; return; }
    try { el.getAnimations().forEach((a) => a.cancel()); } catch (_) {}
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LAYER_FADE_MS, easing: 'ease' });
    // Só o término natural esconde: se um fadeLayerIn cancelar esta animação no
    // meio (a camada voltou), esconder aqui apagaria o que acabou de entrar.
    anim.onfinish = () => { el.hidden = true; el.style.opacity = ''; };
  }

  // Índice do slide de letra vigente num instante (último com time <= t).
  function findSlideIndex(lyrics, time) {
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= time) idx = i; else break;
    }
    return idx < 0 ? 0 : idx;
  }
  // Passo-a-passo genérico de volume: from→to (0..1) ao longo de `dur` s,
  // chamando apply(v) a cada passo (v já clampado em 0..1). Retorna o id do
  // interval — o chamador guarda para poder cancelar. Compartilhado pelos três
  // "sinks" de áudio do sistema: o <video> do stage, o player do YouTube no
  // Display e o da preview no Controle (todos com a mesma curva/duração).
  function rampSteps(from, to, dur, apply) {
    const steps = Math.max(2, Math.round(dur * 20));
    let i = 0, id;
    id = setInterval(() => {
      i++;
      apply(Math.min(1, Math.max(0, from + (to - from) * (i / steps))));
      if (i >= steps) clearInterval(id);
    }, (dur * 1000) / steps);
    return id;
  }

  function createStage(opts) {
    const wallpaper = opts.wallpaper;
    const img = opts.img;
    const video = opts.video;
    // Não é const: o Controle alterna isso em tempo real no modo "mesa de
    // som" (preview normalmente sempre muda vira independente, com áudio de
    // verdade saindo pelo próprio aparelho) — ver setForceMuted().
    let forceMuted = !!opts.forceMuted;

    let current = null;
    let view = 'visual';
    let muted = false;
    let volume = 1;
    let fit = 'contain'; // object-fit: 'contain' (ajustar) | 'cover' (preencher) | 'fill' (esticar)
    let url = null;
    let isBlobUrl = false;
    // O controlador da TRANSMISSÃO DIRETA (ver shared/mse.js), quando a mídia
    // em cena é um stream em vez de um arquivo. Um por vez, como o `url`: cada
    // load derruba o anterior, senão duas MediaSource continuariam pedindo
    // bytes da rede para um vídeo que já saiu do telão.
    let stream = null;
    let deckIdx = 0;      // página em cena da apresentação (kind 'deck')
    let ended = false;
    let loadSeq = 0;
    // Quantos load() estão EM VOO agora. Existe para o handler de `ended`: o
    // fim natural do vídeo não é uma ação do operador e não pode cancelar um
    // load que ele pediu (ver o comentário do próprio handler, lá embaixo).
    // Contador, e não booleano, porque um load pode começar enquanto outro
    // ainda espera o fade/getMedia — o segundo bump do loadSeq descarta o
    // primeiro, mas a promise dele só se resolve depois.
    let loadsEmVoo = 0;
    let viewSeq = 0; // troca de view (cortina) — independente do loadSeq
    // Transições de entrada/saída (config vem do Controle via comando 'fade').
    let fadeIn = false;
    let fadeOut = false;
    let fadeTime = 1; // segundos
    let rampTimer = null;
    let muteApplyTimer = null;

    // Cortina do wallpaper: única fonte de verdade sobre se ela está cobrindo
    // a mídia agora. Começa cobrindo (nada carregado ainda).
    let coveredNow = true;
    let coverSeq = 0; // descarta fades de cortina obsoletos (interrompidos por outro)

    function setFade(cfg) {
      if (typeof cfg.fadeIn === 'boolean') fadeIn = cfg.fadeIn;
      if (typeof cfg.fadeOut === 'boolean') fadeOut = cfg.fadeOut;
      if (typeof cfg.time === 'number' && cfg.time > 0) fadeTime = cfg.time;
    }

    // Cortina (wallpaper) — instantânea ou com fade. Não mexe em current/
    // ended/view: quem decide QUANDO cobrir/revelar é o chamador (stage ou,
    // no Display, o código do YouTube, que só reaproveita esta cortina
    // compartilhada). rampAudio de coverIn() só se aplica ao <video> do
    // próprio stage — o YouTube nunca deve passar rampAudio=true aqui (sua
    // própria rampa de áudio é feita externamente, no player do YouTube).
    function instantCover(show) {
      coverSeq++;
      coveredNow = show;
      wallpaper.style.transition = '';
      wallpaper.style.opacity = '';
      wallpaper.style.display = show ? 'flex' : 'none';
    }

    function coverIn(rampAudio) {
      if (coveredNow) return Promise.resolve();
      const seq = ++coverSeq;
      return new Promise((resolve) => {
        if (!fadeOut) { instantCover(true); resolve(); return; }
        wallpaper.style.transition = 'none';
        wallpaper.style.display = 'flex';
        wallpaper.style.opacity = '0';
        void wallpaper.offsetWidth; // força reflow para a transição valer
        wallpaper.style.transition = 'opacity ' + fadeTime + 's ease';
        wallpaper.style.opacity = '1';
        if (rampAudio && !forceMuted && current
            && (current.kind === 'video' || current.kind === 'audio') && !video.muted) {
          rampVolume(video.volume, 0, fadeTime);
        }
        setTimeout(() => {
          if (seq !== coverSeq) { resolve(); return; }
          coveredNow = true;
          wallpaper.style.transition = '';
          wallpaper.style.opacity = '';
          resolve();
        }, fadeTime * 1000);
      });
    }

    function coverOut() {
      if (!coveredNow) return Promise.resolve();
      const seq = ++coverSeq;
      return new Promise((resolve) => {
        if (!fadeIn) { instantCover(false); resolve(); return; }
        wallpaper.style.transition = 'opacity ' + fadeTime + 's ease';
        wallpaper.style.opacity = '0';
        setTimeout(() => {
          if (seq !== coverSeq) { resolve(); return; }
          coveredNow = false;
          wallpaper.style.transition = '';
          wallpaper.style.opacity = '';
          wallpaper.style.display = 'none';
          resolve();
        }, fadeTime * 1000);
      });
    }

    /**
     * ÁUDIO PURO NÃO TEM O QUE MOSTRAR (v5.112).
     *
     * Um registro de áudio sem letra sincronizada — um mp3 importado, o
     * instrumental de fundo, o áudio baixado de um vídeo do YouTube — não põe
     * nada no `<img>` nem no `<video>` (ver `applyMedia`). Sem esta pergunta a
     * cortina ABRIA para ele: o telão saía do wallpaper e ficava no PRETO do
     * palco, com o louvor tocando por trás de um retângulo vazio. Não era uma
     * capa errada, era a ausência de qualquer coisa — e no meio de um culto
     * isso se lê como projetor apagado.
     *
     * A letra é a exceção que confirma: quando o áudio TEM letra, a cortina
     * precisa sair da frente, porque a `.lyrics-layer` fica por baixo dela (o
     * wallpaper tem z-index maior, e é assim que ele cobre/revela as camadas de
     * graça — ver display/index.html). Por isso a pergunta é feita ao PRÓPRIO
     * registro, que é quem carrega a letra, e não à camada, que o stage não
     * conhece.
     *
     * A Camada de Texto (mensagem/versículo sobre um áudio de fundo) não passa
     * por aqui: quem abre a cortina para ela é o `showText` do Display, de
     * propósito e por conta própria.
     */
    function semVisual() {
      return !!current && current.kind === 'audio'
        && !(Array.isArray(current.lyrics) && current.lyrics.length);
    }

    // A cortina deve cobrir sempre que não há mídia, ela "terminou" (ended:
    // aguardando replay), o operador pediu view='wallpaper' — ou o que entrou
    // não tem imagem nenhuma para mostrar.
    function computeCover() { return !current || ended || view === 'wallpaper' || semVisual(); }

    // Elemento de mídia atualmente visível (alvo do fade de CONTEÚDO, ao
    // trocar de item) — só existe quando a cortina não está cobrindo; se
    // estiver cobrindo, ninguém vê nada, então não há o que esmaecer.
    // O mapeamento kind→elemento é o de `elDe` (fonte única, mais abaixo):
    // duplicá-lo aqui, como era, divergiria no primeiro kind novo.
    function visibleEl() {
      return coveredNow ? null : elDe(current);
    }

    function clearFadeStyle(el) {
      el.style.transition = '';
      el.style.opacity = '';
    }

    // Rampa de volume (fade sonoro) do <video> do próprio stage — usada tanto
    // no fade de CONTEÚDO (troca de item) quanto por coverIn() (parar/limpar).
    function rampVolume(from, to, dur) {
      clearInterval(rampTimer);
      if (forceMuted) return;
      video.volume = Math.min(1, Math.max(0, from));
      rampTimer = rampSteps(from, to, dur, (v) => { video.volume = v; });
    }

    // Esmaece a mídia de CONTEÚDO visível até o preto (troca de item, nada a
    // ver com a cortina do wallpaper); resolve imediatamente se fade-out
    // desligado ou nada visível agora.
    function runFadeOut(rampAudio) {
      return new Promise((resolve) => {
        const el = fadeOut ? visibleEl() : null;
        if (!el) { resolve(); return; }
        el.style.transition = 'opacity ' + fadeTime + 's ease';
        el.style.opacity = '0';
        if (rampAudio !== false && el === video && !video.muted) rampVolume(video.volume, 0, fadeTime);
        setTimeout(resolve, fadeTime * 1000);
      });
    }

    // A ENTRADA do conteúdo, espelhando [runFadeOut] — e ela não existia.
    //
    // A troca de item tinha metade da transição: a mídia velha esmaecia até o
    // preto e a nova ENTRAVA NO TALO, em opacidade cheia. Passou anos sem
    // incomodar porque um arquivo local vira primeiro quadro em milissegundos:
    // o corte acontecia colado no fim do esmaecimento e lia-se como um corte de
    // vídeo. A transmissão direta escancarou a falta — entre o preto e o
    // primeiro quadro há a rede inteira (init + índice + fragmento), e o vídeo
    // "aparecia do nada" segundos depois.
    //
    // Quem chama espera o [mediaReady] ANTES: sem isso o fade correria sobre a
    // camada ainda vazia e o conteúdo pipocaria no meio dela — o mesmo motivo
    // pelo qual a cortina já esperava.
    function runFadeIn(el, rampAudio) {
      return new Promise((resolve) => {
        if (!fadeIn || !el) { resolve(); return; }
        // O 0 já está escrito desde antes de o elemento ser revelado (ver o
        // `applyMedia` lá embaixo): escrevê-lo só agora daria um quadro em
        // opacidade cheia antes da transição começar, que é exatamente o
        // estouro que se quer evitar.
        el.style.transition = 'opacity ' + fadeTime + 's ease';
        el.style.opacity = '1';
        // A rampa de áudio é PEDIDA, não presumida: no caminho normal ela já
        // correu junto do `play()`, e refazê-la aqui zeraria um volume que já
        // subiu. Quem pede é só o stream, cujo som ainda não existia lá atrás.
        if (rampAudio === true && el === video && !forceMuted && !video.muted && volume > 0) {
          rampVolume(0, volume, fadeTime);
        }
        setTimeout(() => { clearFadeStyle(el); resolve(); }, fadeTime * 1000);
      });
    }

    // O elemento que ESTE registro ocupa em cena. Um só lugar decidindo isso:
    // `visibleEl`, o caminho da cortina e a entrada do conteúdo perguntam
    // todos aqui (a cópia à mão que `visibleEl` carregava já foi absorvida).
    function elDe(rec) {
      if (!rec) return null;
      if (rec.kind === 'image' || rec.kind === 'deck') return img;
      if (rec.kind === 'video' || rec.kind === 'audio') return video;
      return null;
    }

    // Resolve quando o elemento tem conteúdo pronto para pintar (imagem
    // decodificada / primeiro frame do vídeo). Sem isso o fade-in corre sobre
    // a camada preta e o conteúdo "pipoca" no meio da transição. Timeout de
    // segurança para mídia que demora/falha em carregar.
    function mediaReady(el, prazoMs) {
      return new Promise((resolve) => {
        let done = false;
        let t = null;
        const finish = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
        // O PRAZO É DO CHAMADOR porque as duas fontes têm ordens de grandeza
        // diferentes: um arquivo local vira quadro em milissegundos (2,5 s ali
        // é um socorro que nunca dispara), e um stream tem a rede inteira pela
        // frente. Com o prazo curto num stream, a transição corria sobre o
        // preto e o primeiro quadro pipocava depois dela — a mesma "entrada no
        // talo" que este fade existe para eliminar.
        t = setTimeout(finish, prazoMs || 2500);
        if (el === img) {
          if (img.complete && img.naturalWidth) finish();
          else if (img.decode) img.decode().then(finish, finish);
          else img.addEventListener('load', finish, { once: true });
        } else if (video.readyState >= 2) {
          finish();
        } else {
          video.addEventListener('loadeddata', finish, { once: true });
        }
      });
    }

    // Qual elemento de mídia está ativo (independe da cortina — a mídia toca
    // por baixo normalmente; quem esconde é só o wallpaper por cima). Vídeo
    // também fica oculto quando `ended`: sem isso, o `currentTime=0` do fim
    // natural (preparando o replay) mostraria um salto pro primeiro frame
    // antes da cortina (se for o caso) cobrir — preto é sempre mais correto
    // que esse salto.
    //
    // ÁUDIO NÃO MOSTRA O <video>: ele é só o "sink" de som, não há um único
    // pixel a exibir. Mantê-lo visível fazia o navegador desenhar o
    // placeholder de mídia (retângulo claro com botão de play) por cima do
    // preto — invisível durante o hino, porque a camada de letra o cobria, e
    // aparecendo justamente no FIM, quando a letra esmaece e o descobre. É o
    // mesmo placeholder que já perseguimos na troca de mídia; aqui a fonte era
    // o próprio elemento estar em cena sem nada para mostrar.
    function applyMedia() {
      const kind = current ? current.kind : null;
      // A APRESENTAÇÃO usa o mesmo `<img>`: cada página é uma imagem, e tudo o
      // que vale para imagem (fade, cortina, `object-fit`) vale para ela.
      img.hidden = !(kind === 'image' || kind === 'deck');
      video.hidden = kind !== 'video' || ended;
      video.muted = forceMuted ? true : muted;
      if (!forceMuted) video.volume = volume;
    }

    function play() {
      if (!current || (current.kind !== 'video' && current.kind !== 'audio')) return;
      ended = false;
      clearInterval(rampTimer);
      clearTimeout(muteApplyTimer);
      if (!forceMuted) video.volume = volume; // restaura pós fade-out
      applyMedia();
      instantCover(computeCover());
      const p = video.play();
      // Usa `muted` (intenção interna) e não video.muted: o browser pode forçar
      // video.muted=true antes de rejeitar, ocultando o motivo real do bloqueio.
      // Só é bloqueio de autoplay de fato quando o erro é NotAllowedError — um
      // play() interrompido por um pause()/load() seguinte (AbortError, comum
      // em toda troca normal de mídia) não é bloqueio e não deve disparar a
      // recuperação de áudio (isso travava a fluidez, mutando/tentando religar
      // o som a cada troca de mídia sem motivo real).
      if (p && p.catch) p.catch((err) => {
        if (opts.onBlocked && !muted && err && err.name === 'NotAllowedError') opts.onBlocked();
      });
    }
    function pause() { video.pause(); }
    function seek(t) { if (isFinite(t)) video.currentTime = t; }
    function setView(v) { view = v; instantCover(computeCover()); applyMedia(); }
    // Troca de view com transição: visual→wallpaper cobre; wallpaper→visual
    // revela. Só a CORTINA transiciona — o áudio (que continua tocando com o
    // visual desligado) fica intocado, sem rampa que terminaria num salto de
    // volume.
    // A cortina é ORTOGONAL ao conteúdo, então esta função tem contador
    // PRÓPRIO (viewSeq) — usar o loadSeq aqui fazia um toque em "visual on/off"
    // durante o load() (que fica assíncrono de 0,7 s a 3 s: fade-out + OPFS +
    // mediaReady) descartar o carregamento em curso: a mídia anterior já tinha
    // ido a opacity 0 e volume 0, o src novo nunca era aplicado, e o telão
    // ficava preto e mudo. Só ações exclusivas (load/clear) podem cancelar um
    // load; trocar a view, não.
    //
    // `cmd.overlay` = quem chamou tem uma camada PRÓPRIA por cima do stage (o
    // cartão de texto do Display), então descobrir revela alguma coisa mesmo
    // sem mídia. Sem esse aviso o stage só enxerga o que ele mesmo desenha.
    async function setViewFaded(v, overlay) {
      if (v === view) return;
      const seq = ++viewSeq;
      const lseq = loadSeq;
      const antes = computeCover();
      view = v;
      // NADA EM CENA: a cortina cobre nos DOIS valores de view (computeCover
      // devolve true por `!current`/`ended`, independentemente dela), então não
      // há transição a fazer. Fazer uma era o defeito: `coverOut` esmaecia o
      // wallpaper sobre o VAZIO — que é preto — e o `instantCover` do fim o
      // recolocava. Do lado de quem opera, descobrir o telão sem mídia nenhuma
      // "piscava preto e voltava", uma reação forte para um botão que ali não
      // muda nada do que está projetado.
      if (computeCover() === antes && !overlay) return;
      if (v === 'wallpaper') {
        await coverIn(false);
      } else {
        await coverOut();
      }
      // Um setViewFaded mais novo, ou um load/clear que assumiu a cena no meio
      // do fade, mandam mais que este: nos dois casos quem chegou depois já
      // decidiu o estado final da cortina.
      if (seq !== viewSeq || lseq !== loadSeq) return;
      instantCover(computeCover());
    }
    function isPlayingNow() {
      return !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused;
    }
    // Mutar/desmutar faz uma rampa curta de volume (MUTE_RAMP_TIME) em vez de
    // cortar o áudio na hora — evita o "pop" de um corte abrupto. Ao mutar,
    // a rampa desce até 0 e só então a mídia é de fato marcada como muda
    // (video.muted=true); ao desmutar, desmuta já (senão volume=0 não seria
    // ouvido) e a rampa sobe de 0 até o volume alvo. Usa o mesmo rampTimer
    // compartilhado das outras rampas (fade de conteúdo/cortina) — mutuamente
    // exclusivas no tempo, a mais recente sempre cancela a anterior.
    function setMute(m) {
      muted = m;
      if (forceMuted) { video.muted = true; return; } // preview: sempre muda, sem rampa
      clearTimeout(muteApplyTimer);
      const playingNow = !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused;
      if (!playingNow) { clearInterval(rampTimer); video.muted = muted; return; }
      if (muted) {
        rampVolume(video.muted ? 0 : video.volume, 0, MUTE_RAMP_TIME);
        // Confere `muted` de novo ao aplicar: um load()/setMute() mais recente
        // pode ter mudado a intenção enquanto a rampa corria.
        muteApplyTimer = setTimeout(() => { if (muted) video.muted = true; }, MUTE_RAMP_TIME * 1000);
      } else {
        video.muted = false;
        rampVolume(0, volume, MUTE_RAMP_TIME);
      }
    }
    function setVolume(vol) {
      volume = vol;
      clearInterval(rampTimer); // operador manda: cancela rampa de fade em curso
      clearTimeout(muteApplyTimer); // evita mutar sozinho depois, com o volume já ajustado
      if (!forceMuted) video.volume = vol;
    }
    // Preenchimento da mídia: 'contain' (ajustar, mostra tudo, pode ter barras),
    // 'cover' (preenche o quadro, corta o excesso) ou 'fill' (estica, distorce
    // a proporção). Aplicado direto via style (sobrepõe o object-fit do CSS)
    // — mesmo valor pros dois elementos, já que só um está visível por vez.
    function setFit(v) {
      fit = (v === 'cover' || v === 'fill') ? v : 'contain';
      img.style.objectFit = fit;
      video.style.objectFit = fit;
    }
    // Alterna se este stage é forçado a ficar sempre mudo (uso normal da
    // preview do Controle, espelhando o Display em silêncio) ou se passa a
    // tocar áudio de verdade pelo próprio aparelho ("mesa de som", modo
    // independente do Display). A troca não corta o áudio na hora — faz a mesma
    // rampa curta do setMute (MUTE_RAMP_TIME): ao ATIVAR, respeita o mudo do
    // operador e sobe o volume de 0 até o alvo; ao DESATIVAR, desce até 0 e só
    // então muta. Na desativação, `forceMuted` só liga no fim da rampa — senão
    // rampVolume abortaria de imediato (ele ignora pedidos com forceMuted já
    // ligado). Sem mídia tocando, aplica na hora (sem rampa, nada a esmaecer).
    function setForceMuted(v) {
      const target = !!v;
      clearInterval(rampTimer);
      clearTimeout(muteApplyTimer);
      const playingNow = !!current && (current.kind === 'video' || current.kind === 'audio') && !video.paused;
      if (!playingNow) {
        forceMuted = target;
        applyMedia();
        if (!forceMuted) video.volume = volume;
        return;
      }
      if (target) {
        // Desativar mesa de som: rampa até 0, depois muta (forceMuted no fim).
        if (video.muted) { forceMuted = true; return; }
        rampVolume(video.volume, 0, MUTE_RAMP_TIME);
        muteApplyTimer = setTimeout(() => {
          forceMuted = true; video.muted = true; video.volume = volume;
        }, MUTE_RAMP_TIME * 1000);
      } else {
        // Ativar mesa de som: som já liberado; respeita o mudo do operador.
        forceMuted = false;
        video.muted = muted;
        if (muted) video.volume = volume;
        else rampVolume(0, volume, MUTE_RAMP_TIME);
      }
    }

    function _revokeUrl() {
      if (stream) { try { stream.destruir(); } catch (_) {} stream = null; }
      if (url && isBlobUrl) { URL.revokeObjectURL(url); }
      url = null;
      isBlobUrl = false;
    }

    // Reset comum de DOM (sem mexer em current/ended/cortina) — usado por
    // clear() e fadeOutToBlack().
    function resetMediaDom() {
      clearInterval(rampTimer);
      clearTimeout(muteApplyTimer);
      img.hidden = true; img.removeAttribute('src');
      // Idem: esconder o <video> faz parte de limpar a fonte, não é detalhe
      // do applyMedia() que vem depois. Entre esta linha e ele há repaint
      // suficiente para o placeholder (retângulo claro + play) aparecer ao
      // parar ou limpar a mídia.
      video.hidden = true;
      clearFadeStyle(video); clearFadeStyle(img);
      video.pause(); video.removeAttribute('src'); video.load(); video.poster = POSTER_VAZIO;
      _revokeUrl();
    }

    // `startAt`/`autoplay` existem para a RECONEXÃO do telão. Quando o dongle
    // cai e volta, o Controle reenvia a cena — e até a v5.47 ele mandava só o
    // `load`, então a mídia recomeçava do ZERO e no estado "tocando". Um hino
    // aos 3:20 voltava do início na frente da congregação, e um louvor que
    // estava PAUSADO para a oração voltava tocando.
    // Vêm no PRÓPRIO comando de load, e não como um `seek`/`pause` enviado logo
    // depois, porque `onCommand` no Display não serializa: o load é assíncrono
    // (getMedia → opfsGetFile → mediaReady) e um comando seguinte chegaria a
    // tempo de agir sobre o <video> ANTERIOR, antes de a fonte nova entrar.
    // `page` só existe para a APRESENTAÇÃO (kind 'deck'): é a página em que ela
    // entra em cena. Vem no mesmo comando que a mídia pelo motivo de sempre —
    // um comando separado logo depois agiria sobre o item ANTERIOR, porque este
    // `load` é assíncrono (ver a nota do `startAt` no CLAUDE.md).
    // O invólucro que conta os loads EM VOO. O contador desce em TODAS as
    // saídas (daí o try/finally, que cobre os returns antecipados e um
    // getMedia que rejeite): um load "esquecido" no contador silenciaria o
    // fim natural — e com ele o avanço de playlist — até a página recarregar.
    async function load(id, v, m, vol, startAt, autoplay, page) {
      loadsEmVoo++;
      try {
        return await loadInner(id, v, m, vol, startAt, autoplay, page);
      } finally {
        loadsEmVoo--;
      }
    }

    async function loadInner(id, v, m, vol, startAt, autoplay, page) {
      if (v !== undefined) view = v;
      if (m !== undefined) muted = m;
      if (typeof vol === 'number') volume = vol;

      // Guarda sequencial: se outra chamada load() começar antes desta terminar
      // o fade/getMedia(), descartamos esta para evitar race de URL/current.
      const seq = ++loadSeq;
      // Troca de CONTEÚDO (item já visível dando lugar a outro): esmaece o
      // atual até o preto: sem relação com a cortina do wallpaper, que já
      // está fora de cena nesse caso (visibleEl() só retorna algo se não
      // estiver coberto).
      const willFade = fadeOut && !!visibleEl();
      await runFadeOut(true);
      if (seq !== loadSeq) return;
      ended = false;
      if (willFade) {
        // Esconde as camadas ainda esmaecidas ANTES de restaurar a opacidade
        // (evita a mídia antiga reaparecer durante o getMedia).
        img.hidden = true; img.removeAttribute('src');
        // O <video> tem que ser escondido JUNTO com a remoção da fonte: um
        // elemento de vídeo visível e sem `src` é pintado pelo navegador como
        // um retângulo claro com botão de play. Como o `getMedia`/`opfsGetFile`
        // logo abaixo são assíncronos, essa janela dura o suficiente para o
        // placeholder piscar na tela a cada troca de mídia.
        video.hidden = true;
        video.pause(); video.removeAttribute('src'); video.load(); video.poster = POSTER_VAZIO;
        clearFadeStyle(video); clearFadeStyle(img);
      }
      const rec = await AVDB.getMedia(id);
      if (seq !== loadSeq) return;
      if (!rec) { clear(); return; }
      current = rec;

      _revokeUrl();

      img.hidden = true; img.removeAttribute('src');
      // Escondido junto com a fonte (mesmo motivo de cima): sem `src` o
      // <video> visível vira um placeholder claro com botão de play.
      // applyMedia(), no fim deste load, revela conforme o kind que entrar.
      video.hidden = true;
      video.pause(); video.removeAttribute('src'); video.load(); video.poster = POSTER_VAZIO;
      // Nenhum estilo de fade anterior pode sobrar na mídia que vai entrar
      // (ex: opacity 0 de um fade-in descartado com a config já alterada).
      clearFadeStyle(video); clearFadeStyle(img);

      if (rec.kind === 'youtube') {
        // YouTube is handled externally; stage shows thumbnail in img if available
        if (rec.thumb) {
          img.src = rec.thumb;
          img.hidden = false;
        }
        return;
      }

      if (rec.blob) {
        url = URL.createObjectURL(rec.blob);
        isBlobUrl = true;
      } else if (rec.kind === 'deck' && Array.isArray(rec.pages) && rec.pages.length) {
        deckIdx = Math.min(Math.max(page | 0, 0), rec.pages.length - 1);
        url = URL.createObjectURL(rec.pages[deckIdx]);
        isBlobUrl = true;
      } else if (rec.opfsPath) {
        // Arquivo sincronizado no OPFS: resolve o File direto do origin,
        // sem permissão e sem cópia para o IDB.
        let file = null;
        try { file = await AVDB.opfsGetFile(rec.opfsPath); } catch (_) {}
        if (seq !== loadSeq) return;
        if (!file) { clear(); return; }
        url = URL.createObjectURL(file);
        isBlobUrl = true;
      } else if (rec.stream && global.AVStream && AVStream.suportado(rec.stream)) {
        // TRANSMISSÃO DIRETA: não há URL nenhuma a atribuir — quem escreve o
        // `video.src` é o próprio motor, com um `MediaSource`. O `suportado`
        // é conferido AQUI e não só no Controle porque este mesmo código roda
        // no telão: um aparelho cujo WebView não aceite o codec precisa cair
        // no `else` abaixo em vez de projetar preto.
        url = null;
        isBlobUrl = false;
      } else if (rec.url) {
        url = rec.url;
        isBlobUrl = false;
      } else {
        clear(); return;
      }

      // TRANSMISSÃO DIRETA em cena: o único caso em que "carregado" e "tem o que
      // mostrar/ouvir" estão a segundos de distância (a rede inteira entre um e
      // outro). Duas decisões dependem disso — a rampa de volume e o fade de
      // entrada —, e as duas ficariam erradas se lidas do `kind`, que aqui é
      // 'video' como o de um arquivo.
      const ehStream = !url && !!rec.stream;

      if (rec.kind === 'image' || rec.kind === 'deck') {
        img.src = url;
      } else {
        if (!url && rec.stream) {
          stream = AVStream.criar(video, rec.stream, {
            // A falha do stream não é tratada AQUI: o stage não tem uma
            // segunda fonte para esta mídia, e inventar uma seria adivinhar. O
            // dono (Controle ou Display) é quem sabe para onde cair — ver
            // `onStreamErro`, que o `createStage` recebe.
            onErro: (porque) => {
              if (seq !== loadSeq) return;
              try { opts.onStreamErro && opts.onStreamErro(rec, porque); } catch (_) {}
            },
          });
        } else {
          video.src = url;
        }
        video.muted = forceMuted ? true : muted;
        if (!forceMuted) video.volume = volume;
        // A posição só "gruda" depois que a duração é conhecida — escrever
        // currentTime junto com o src é perdido em silêncio. `once` porque
        // isto vale para ESTA fonte; a próxima traz o seu próprio pedido.
        if (typeof startAt === 'number' && startAt > 0) {
          video.addEventListener('loadedmetadata', () => {
            if (seq !== loadSeq) return;   // outro load assumiu durante a espera
            if (isFinite(startAt)) video.currentTime = startAt;
          }, { once: true });
        }
        // `autoplay === false` é a cena que voltou PAUSADA. `undefined` mantém
        // o comportamento de sempre (todo load normal toca), então nenhum outro
        // chamador precisou mudar. Sem `play()` aqui, quem revela a mídia é o
        // `applyMedia()` + a cortina no fim deste mesmo load.
        if (autoplay !== false) play();
        // ENTRADA COM RAMPA, espelhando a saída. Isto não existia: o volume
        // era escrito direto no alvo e a mídia entrava no talo enquanto o
        // visual ainda esmaecia — a saída tinha rampa, a entrada não, e a
        // assimetria era audível a cada troca de hino. `play()` restaura o
        // volume alvo (e limpa o rampTimer), então a rampa só pode vir DEPOIS
        // dele; ela mesma escreve o 0 inicial.
        //
        // SÓ QUE NUM STREAM ELA NÃO PODE COMEÇAR AQUI. O `play()` de um
        // `MediaSource` vazio não produz som nenhum: o áudio só começa quando o
        // primeiro fragmento chega da rede, segundos depois — e a essa altura a
        // rampa já teria terminado sozinha, entregando o som no talo justamente
        // no instante em que a imagem aparece. Ela viaja junto de quem REVELA a
        // mídia (a cortina abrindo ou o [runFadeIn] do conteúdo), logo abaixo.
        // Com a cortina fechada por escolha do operador (`view: 'wallpaper'`)
        // ninguém revela nada e o volume entra no alvo direto — que é o que já
        // acontecia, porque a rampa daqui terminava antes de haver som.
        if (fadeIn && !forceMuted && !video.muted && volume > 0 && !ehStream) {
          rampVolume(0, volume, fadeTime);
        }
      }
      // A OPACIDADE ZERO É ESCRITA ANTES DE REVELAR. `applyMedia()` tira o
      // `hidden`, e um elemento revelado em opacidade cheia pinta um quadro
      // antes de qualquer transição começar — o estouro que o fade existe para
      // evitar. Só no caminho SEM cortina: quando ela está cobrindo, quem faz a
      // transição é o `coverOut()` e um segundo fade por baixo dela seria uma
      // transição dentro da outra.
      const alvo = elDe(rec);
      const entrada = fadeIn && !coveredNow && !!alvo && !semVisual() && view === 'visual';
      if (entrada) {
        alvo.style.transition = '';
        alvo.style.opacity = '0';
      }
      applyMedia();
      // Revela (esconde a cortina) se a view pedir e ainda estiver coberto —
      // primeiro conteúdo depois do wallpaper, ou depois de ended/stop/clear.
      // Se nada estava cobrindo (já em cena, só trocando de item), coverOut()
      // não faz nada — quem cuidou da troca visual foi o fade de CONTEÚDO
      // acima.
      // `!semVisual()`: um áudio sem letra mantém o wallpaper — abrir a cortina
      // para ele mostraria o preto do palco. Ver `computeCover`.
      if (view === 'visual' && coveredNow && !semVisual()) {
        if (fadeIn && alvo) {
          await mediaReady(alvo, ehStream ? PRONTO_STREAM_MS : 0);
          if (seq !== loadSeq) return;
        }
        // Num stream a rampa de volume foi adiada lá em cima justamente para
        // cá: agora existe o que ouvir, e ela acompanha a cortina abrindo.
        if (ehStream && fadeIn && !forceMuted && !video.muted && volume > 0) {
          rampVolume(0, volume, fadeTime);
        }
        await coverOut();
        if (seq !== loadSeq) return;
      } else if (entrada) {
        // A ENTRADA DO CONTEÚDO, quando não há cortina para abrir. Espera o
        // primeiro quadro e só então esmaece de volta ao normal — imagem e som
        // entram juntos (ver `runFadeIn`).
        await mediaReady(alvo, ehStream ? PRONTO_STREAM_MS : 0);
        if (seq !== loadSeq) return;
        await runFadeIn(alvo, ehStream);
        if (seq !== loadSeq) return;
      }
      // E o caminho inverso: uma IMAGEM em cena, seguida de um áudio sem letra.
      // Ali a cortina estava aberta (havia o que ver), então ninguém a fecharia
      // — e o telão ficaria no preto do palco em vez de voltar ao wallpaper.
      if (semVisual() && !coveredNow) {
        await coverIn(false);
        if (seq !== loadSeq) return;
      }
    }

    // TROCA DE PÁGINA da apresentação em cena. Um `load` novo faria o ciclo
    // inteiro — fade de saída, leitura do IndexedDB, fade de entrada — para
    // trocar uma imagem que já está na mão: passar slide ficaria lento e
    // piscaria o preto entre um e outro. Aqui só a fonte do `<img>` muda.
    function page(n) {
      if (!current || current.kind !== 'deck') return;
      const pages = Array.isArray(current.pages) ? current.pages : [];
      if (!pages.length) return;
      const alvo = Math.min(Math.max(n | 0, 0), pages.length - 1);
      if (alvo === deckIdx) return;
      deckIdx = alvo;
      _revokeUrl();
      url = URL.createObjectURL(pages[alvo]);
      isBlobUrl = true;
      img.src = url;
    }

    function clear() {
      current = null;
      deckIdx = 0;
      ended = false;
      resetMediaDom();
      instantCover(true); // current=null: cobre sempre, independente da view
      applyMedia();
    }

    // clear com fade-out (cobre com a cortina); descartado se um load mais
    // novo chegar durante o fade. Usado pelo comando 'clear' do operador —
    // aqui o wallpaper É o destino certo (ponto final explícito).
    async function clearFaded() {
      const seq = ++loadSeq;
      await coverIn(true);
      if (seq !== loadSeq) return;
      clear();
    }

    // Esmaece o conteúdo até o PRETO e reseta o stage (current=null), sem
    // tocar na cortina do wallpaper — usado só na troca de TIPO de conteúdo
    // (mídia local ↔ YouTube, que vive fora do stage), nunca pelo comando
    // 'stop'/'clear' do operador (que quer mesmo o wallpaper, ver
    // clearFaded() acima). Se o conteúdo já esmaeceu sozinho (fim natural,
    // `ended`), pula o fade redundante.
    async function fadeOutToBlack() {
      const seq = ++loadSeq;
      if (!ended) {
        await runFadeOut(true);
        if (seq !== loadSeq) return;
      }
      current = null;
      ended = false;
      resetMediaDom();
      applyMedia();
    }

    // Retorna a promise das sub-chamadas assíncronas — a maioria dos
    // chamadores dispara e esquece, mas display.js precisa aguardar o clear()
    // (YouTube) antes de decidir o que mostrar enquanto o vídeo carrega.
    function handle(cmd) {
      switch (cmd.type) {
        case 'load': return load(cmd.mediaId, cmd.view, cmd.muted, cmd.volume, cmd.time, cmd.playing, cmd.page);
        case 'page': page(cmd.page); break;
        case 'view': return setViewFaded(cmd.view, cmd.overlay);
        case 'mute': setMute(cmd.muted); break;
        case 'volume': if (typeof cmd.volume === 'number') setVolume(cmd.volume); break;
        case 'play': play(); break;
        case 'pause': pause(); break;
        case 'seek': seek(cmd.time); break;
        case 'clear': return clearFaded();
        case 'fit': setFit(cmd.fit); break;
      }
    }

    // Fim natural → esmaece até o PRETO (nunca a cortina do wallpaper aqui:
    // ainda não se sabe se um próximo item está a caminho). Só cobre com o
    // wallpaper de fato depois de confirmar que ninguém assumiu a cena num
    // instante — evita a marca aparecer brevemente durante o avanço
    // automático de playlist. O 'load' do avanço automático (disparado por
    // onEnded, logo abaixo) chega quase junto e assume via loadSeq antes
    // desse prazo — a cortina não pisca entre os itens da playlist.
    video.addEventListener('ended', async () => {
      // UM LOAD EM VOO GANHA DO FIM NATURAL. O `++loadSeq` abaixo é uma AÇÃO
      // EXCLUSIVA — e o contrato do loadSeq (ver setViewFaded) é que só ações
      // do OPERADOR (load/clear) cancelam um load em curso. O `ended` não é
      // uma ação do operador: é o vídeo velho acabando sozinho, e ele acabava
      // de vencer justamente o caso real — o operador toca o próximo hino nos
      // últimos ~600 ms do vídeo atual, o vídeo termina durante o fade de
      // saída do load novo, o bump daqui descartava esse load em silêncio no
      // checkpoint seguinte e, sem repeat, o item pedido nunca entrava.
      // Retornar cedo deixa o load em voo fazer a transição — ele já vai
      // trocar a fonte, resetar `ended` e decidir a cortina.
      //
      // O avanço automático de playlist NÃO passa por aqui: no instante do
      // `ended` dele não há load nenhum em voo (`loadsEmVoo == 0`) — o load do
      // avanço só nasce DEPOIS, quando o `media-ended` chega ao Controle — e
      // a coreografia de sempre (ended dispara → Controle manda load → load
      // assume via loadSeq) segue intacta.
      if (loadsEmVoo > 0) return;
      const seq = ++loadSeq;
      await runFadeOut(false);
      if (seq !== loadSeq) return;
      ended = true;
      video.currentTime = 0;
      clearFadeStyle(video);
      applyMedia();
      setTimeout(() => {
        if (seq === loadSeq && ended) instantCover(true);
      }, 400);
    });

    // O PÔSTER SAI ASSIM QUE HÁ QUADRO. Ele existe só para cobrir a janela em
    // que o elemento está em cena sem nada para mostrar (ver `POSTER_VAZIO`);
    // mantê-lo depois disso mudaria comportamento, porque o `show poster flag`
    // do HTML segue LIGADO num vídeo pausado que ainda não tocou — e a cena
    // restaurada PAUSADA (reconexão do dongle) mostraria o preto do palco no
    // lugar do quadro congelado, que é justamente o que ela existe para
    // mostrar. Cada `load` o repõe antes de a fonte nova entrar.
    video.addEventListener('loadeddata', () => video.removeAttribute('poster'));

    // A MESMA guarda do handler interno (acima): com um load em voo, o fim
    // natural é do item que está SAINDO — anunciá-lo (`media-ended`) faria o
    // avanço automático do Controle disparar por cima do load que o operador
    // acabou de pedir, o mesmo defeito visto do outro lado do barramento. No
    // avanço normal `loadsEmVoo == 0` e o aviso sai como sempre.
    if (opts.onEnded) video.addEventListener('ended', (e) => {
      if (loadsEmVoo > 0) return;
      opts.onEnded(e);
    });
    if (opts.onTime) {
      ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended', 'volumechange'].forEach((ev) =>
        video.addEventListener(ev, opts.onTime));
    }
    if (opts.onError) video.addEventListener('error', opts.onError);

    setFit(fit); // aplica o valor inicial (default 'contain') via style, já na criação

    return {
      handle, load, clear, play, pause, seek, page, setView, setMute, setVolume, setFade, setFit,
      setForceMuted,
      coverIn, coverOut, instantCover, fadeOutToBlack,
      getCurrent: () => current,
      getView: () => view,
      isPlaying: isPlayingNow,
      // Chegou ao fim natural e está aguardando replay. As camadas paralelas
      // (letra, texto) precisam disso: no fim o stage zera o currentTime para
      // preparar o replay, e quem segue o tempo re-renderizaria o slide 0 —
      // fazendo a capa do hino piscar antes do wallpaper cobrir.
      hasEnded: () => ended,
      // "A cortina deveria estar cobrindo agora?" — a MESMA regra que o stage
      // usa internamente, exposta porque o Display também decide sobre a
      // cortina (ao tirar a Camada de Texto de cena, por exemplo) e não pode
      // reabri-la sobre um áudio que não tem o que mostrar. Duas cópias da
      // regra divergiriam no primeiro caso novo. Ver `computeCover`.
      shouldCover: computeCover,
      isTimed: () => !!current && (current.kind === 'video' || current.kind === 'audio'),
      getTime: () => video.currentTime,
      getDuration: () => video.duration,
      getMuted: () => (forceMuted ? muted : video.muted),
      getVolume: () => volume,
      // `getPage`/`getFit`/`isForceMuted` saíram da superfície: nunca tiveram
      // chamador fora daqui (grep na base inteira + tools/), e superfície
      // pública sem uso é contrato que envelhece sem ninguém vigiar.
    };
  }

  global.createStage = createStage;
  // Utilidades de áudio expostas para reuso (Display e Controle carregam este
  // arquivo antes dos seus): fonte única da rampa de volume e da sua duração.
  createStage.rampSteps = rampSteps;
  createStage.MUTE_RAMP_TIME = MUTE_RAMP_TIME;
  // Transições: config fixa do sistema + os fades de camada paralela, idênticos
  // nos dois apps (ver bloco no topo).
  createStage.FADE = FADE;
  createStage.LAYER_FADE_MS = LAYER_FADE_MS;
  createStage.fadeContentIn = fadeContentIn;
  createStage.fadeLayerIn = fadeLayerIn;
  createStage.fadeLayerOut = fadeLayerOut;
  createStage.findSlideIndex = findSlideIndex;

  // ===== Cronômetro / Relógio / Timer (aba Ferramentas) =====
  // O descritor é um OBJETO PEQUENO E ESTÁVEL, e não um fluxo de ticks: quem
  // conta o tempo é cada lado, localmente, a partir de uma ORIGEM comum
  // (`startAt`, em epoch ms). Mandar o texto pronto a cada segundo colocaria
  // ~3.600 comandos/hora no barramento só para mexer dois dígitos, e ainda
  // deixaria o telão parado se um deles se perdesse.
  //
  // A consequência importante é a RECONEXÃO: como o valor é derivado do
  // descritor, `resendSceneToDisplay` reenviar o mesmo objeto devolve o
  // cronômetro no segundo certo — sem estado nenhum a ressincronizar. É o
  // mesmo princípio do `load` + posição já usado para a mídia.
  //
  // Os dois WebViews são o MESMO processo no MESMO aparelho, então `Date.now()`
  // é a mesma base dos dois lados; no navegador, idem (duas abas da máquina).
  //
  // Descritor:
  //   { mode:'clock'|'stopwatch'|'timer',
  //     running:bool, startAt:<epoch ms>, baseMs:<acumulado nas pausas>,
  //     durationMs:<alvo do timer>, secs:bool, h12:bool }
  const CHRONO_TICK_MS = 200;   // 5 Hz: o segundo vira sem atraso perceptível

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Duração em ms → texto. Acima de 1 h entra o campo de horas; abaixo fica em
  // MM:SS, que é o formato que o operador lê de relance.
  function formatSpan(ms) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : pad2(m) + ':' + pad2(s);
  }

  // Tempo decorrido do cronômetro/timer. Pausado, o valor é só o acumulado —
  // por isso `baseMs` existe: sem ele, pausar e retomar perderia o trecho
  // anterior (ou exigiria reescrever `startAt`, que é justamente a âncora que
  // torna a reconexão trivial).
  function chronoElapsed(c, now) {
    const base = c.baseMs || 0;
    return c.running ? base + Math.max(0, now - (c.startAt || now)) : base;
  }

  // Leitura pronta para a tela. `over` marca o timer que passou do alvo: ele
  // NÃO congela em zero — continua contando, com sinal negativo. Num culto,
  // "estourou por 4 minutos" é a informação que se precisa; um 00:00 parado
  // não distingue "acabou agora" de "acabou há muito".
  function chronoReading(c, now) {
    if (!c) return { text: '', over: false };
    const t = new Date(now == null ? Date.now() : now);
    if (c.mode === 'clock') {
      let h = t.getHours();
      let suffix = '';
      if (c.h12) {
        suffix = h >= 12 ? ' PM' : ' AM';
        h = h % 12 || 12;
      }
      const hh = c.h12 ? String(h) : pad2(h);
      return { text: hh + ':' + pad2(t.getMinutes())
        + (c.secs === false ? '' : ':' + pad2(t.getSeconds())) + suffix, over: false };
    }
    const elapsed = chronoElapsed(c, now == null ? Date.now() : now);
    if (c.mode === 'timer') {
      const rem = (c.durationMs || 0) - elapsed;
      return { text: (rem < 0 ? '−' : '') + formatSpan(Math.abs(rem)), over: rem < 0 };
    }
    return { text: formatSpan(elapsed), over: false };
  }

  // ===== Sorteio (aba Ferramentas) =====
  // Mesmo desenho do cronômetro: o Controle SORTEIA e manda um descritor; os
  // dois lados apenas derivam o que mostrar. Quem sorteia tem que ser um só —
  // se cada tela rodasse o próprio `Math.random`, o telão e a preview
  // anunciariam ganhadores diferentes, que é o pior defeito possível aqui.
  //
  // O rolar dos números até assentar é local: `rollUntil` (epoch ms) diz até
  // quando rolar, e o quadro exibido é função do tempo restante. Duas
  // consequências: nenhum comando trafega durante a animação, e o telão que
  // reconectar no meio do rolo entra no MESMO quadro em que os outros estão.
  //
  // Descritor:
  //   { kind:'number'|'text', value, seed, rollUntil, min, max, pool:[...] }
  const DRAW_FRAME_MS = 70;    // ~14 quadros/s: rápido o bastante para borrar

  // PRNG determinístico (mulberry32). O ruído do rolo precisa ser IGUAL nos dois
  // lados — a preview existe para mostrar o que o telão está mostrando, e dois
  // ruídos diferentes a tornariam uma tela paralela em vez de um espelho.
  function rnd32(seed) {
    let t = (seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function drawReading(d, now) {
    if (!d || d.value == null || d.value === '') return { text: '—', rolling: false };
    const t = now == null ? Date.now() : now;
    if (!d.rollUntil || t >= d.rollUntil) return { text: String(d.value), rolling: false };
    // O quadro sai do tempo QUE FALTA, não do decorrido: assim ele é uma função
    // pura de (descritor, relógio) e qualquer tela que entre agora — inclusive
    // um telão que acabou de reconectar — cai no mesmo quadro das demais.
    const frame = Math.floor((d.rollUntil - t) / DRAW_FRAME_MS);
    const r = rnd32((d.seed || 0) + frame * 7919);
    if (d.kind === 'text') {
      const pool = Array.isArray(d.pool) && d.pool.length ? d.pool : [String(d.value)];
      return { text: String(pool[Math.floor(r * pool.length)]), rolling: true };
    }
    const min = typeof d.min === 'number' ? d.min : 0;
    const max = typeof d.max === 'number' ? d.max : 99;
    return { text: String(min + Math.floor(r * (max - min + 1))), rolling: true };
  }

  createStage.CHRONO_TICK_MS = CHRONO_TICK_MS;
  createStage.chronoElapsed = chronoElapsed;
  createStage.chronoReading = chronoReading;
  // `formatSpan` deixou de ser exposto: todo uso é interno (chronoReading) —
  // grep na base inteira e em tools/. `chronoElapsed` fica: o Controle o chama
  // ao pausar o cronômetro (acumular o baseMs).
  createStage.DRAW_FRAME_MS = DRAW_FRAME_MS;
  createStage.drawReading = drawReading;
})(this);
