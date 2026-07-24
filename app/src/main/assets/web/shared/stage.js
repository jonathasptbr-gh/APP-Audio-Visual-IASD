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
    let ended = false;
    let loadSeq = 0;
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

    // A cortina deve cobrir sempre que não há mídia, ela "terminou" (ended:
    // aguardando replay) ou o operador pediu view='wallpaper'.
    function computeCover() { return !current || ended || view === 'wallpaper'; }

    // Elemento de mídia atualmente visível (alvo do fade de CONTEÚDO, ao
    // trocar de item) — só existe quando a cortina não está cobrindo; se
    // estiver cobrindo, ninguém vê nada, então não há o que esmaecer.
    function visibleEl() {
      if (!current || coveredNow) return null;
      if (current.kind === 'image') return img;
      if (current.kind === 'video' || current.kind === 'audio') return video;
      return null;
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

    // Resolve quando o elemento tem conteúdo pronto para pintar (imagem
    // decodificada / primeiro frame do vídeo). Sem isso o fade-in corre sobre
    // a camada preta e o conteúdo "pipoca" no meio da transição. Timeout de
    // segurança para mídia que demora/falha em carregar.
    function mediaReady(el) {
      return new Promise((resolve) => {
        let done = false;
        let t = null;
        const finish = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
        t = setTimeout(finish, 2500);
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
    function applyMedia() {
      const kind = current ? current.kind : null;
      img.hidden = !(kind === 'image');
      video.hidden = !(kind === 'video' || kind === 'audio') || ended;
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
    function stop() { video.pause(); video.currentTime = 0; }
    // stop com fade-out (cobre com a cortina); descartado se um load/clear
    // mais novo chegar durante o fade.
    async function stopFaded() {
      const seq = ++loadSeq;
      await coverIn(true);
      if (seq !== loadSeq) return;
      stop();
      // 'stop' volta ao wallpaper (protocolo): ended tira a mídia de cena
      // mantendo current — play() recarrega a visão e reproduz do início.
      ended = true;
      if (!forceMuted) video.volume = volume;
      applyMedia();
    }
    function seek(t) { if (isFinite(t)) video.currentTime = t; }
    function setView(v) { view = v; instantCover(computeCover()); applyMedia(); }
    // Troca de view com transição: visual→wallpaper cobre; wallpaper→visual
    // revela. Só a CORTINA transiciona — o áudio (que continua tocando com o
    // visual desligado) fica intocado, sem rampa que terminaria num salto de
    // volume.
    async function setViewFaded(v) {
      if (v === view) return;
      const seq = ++loadSeq;
      view = v;
      if (v === 'wallpaper') {
        await coverIn(false);
      } else {
        await coverOut();
      }
      if (seq !== loadSeq) return;
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
      clearFadeStyle(video); clearFadeStyle(img);
      video.pause(); video.removeAttribute('src'); video.load();
      _revokeUrl();
    }

    async function load(id, v, m, vol) {
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
        video.pause(); video.removeAttribute('src'); video.load();
        clearFadeStyle(video); clearFadeStyle(img);
      }
      const rec = await AVDB.getMedia(id);
      if (seq !== loadSeq) return;
      if (!rec) { clear(); return; }
      current = rec;

      _revokeUrl();

      img.hidden = true; img.removeAttribute('src');
      video.pause(); video.removeAttribute('src'); video.load();
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
      } else if (rec.opfsPath) {
        // Arquivo sincronizado no OPFS: resolve o File direto do origin,
        // sem permissão e sem cópia para o IDB.
        let file = null;
        try { file = await AVDB.opfsGetFile(rec.opfsPath); } catch (_) {}
        if (seq !== loadSeq) return;
        if (!file) { clear(); return; }
        url = URL.createObjectURL(file);
        isBlobUrl = true;
      } else if (rec.url) {
        url = rec.url;
        isBlobUrl = false;
      } else {
        clear(); return;
      }

      if (rec.kind === 'image') {
        img.src = url;
      } else {
        video.src = url;
        video.muted = forceMuted ? true : muted;
        if (!forceMuted) video.volume = volume;
        play();
      }
      applyMedia();
      // Revela (esconde a cortina) se a view pedir e ainda estiver coberto —
      // primeiro conteúdo depois do wallpaper, ou depois de ended/stop/clear.
      // Se nada estava cobrindo (já em cena, só trocando de item), coverOut()
      // não faz nada — quem cuidou da troca visual foi o fade de CONTEÚDO
      // acima.
      if (view === 'visual' && coveredNow) {
        if (fadeIn) {
          const el = rec.kind === 'image' ? img : (rec.kind === 'video' || rec.kind === 'audio' ? video : null);
          if (el) { await mediaReady(el); if (seq !== loadSeq) return; }
        }
        await coverOut();
        if (seq !== loadSeq) return;
      }
    }

    function clear() {
      current = null;
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
        case 'load': return load(cmd.mediaId, cmd.view, cmd.muted, cmd.volume);
        case 'view': return setViewFaded(cmd.view);
        case 'mute': setMute(cmd.muted); break;
        case 'volume': if (typeof cmd.volume === 'number') setVolume(cmd.volume); break;
        case 'play': play(); break;
        case 'pause': pause(); break;
        case 'stop': return stopFaded();
        case 'seek': seek(cmd.time); break;
        case 'clear': return clearFaded();
        case 'fade': setFade(cmd); break;
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

    if (opts.onEnded) video.addEventListener('ended', opts.onEnded);
    if (opts.onTime) {
      ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended', 'volumechange'].forEach((ev) =>
        video.addEventListener(ev, opts.onTime));
    }
    if (opts.onError) video.addEventListener('error', opts.onError);

    setFit(fit); // aplica o valor inicial (default 'contain') via style, já na criação

    return {
      handle, load, clear, play, pause, stop, seek, setView, setMute, setVolume, setFade, setFit,
      setForceMuted,
      coverIn, coverOut, instantCover, fadeOutToBlack,
      getCurrent: () => current,
      getView: () => view,
      isPlaying: isPlayingNow,
      isTimed: () => !!current && (current.kind === 'video' || current.kind === 'audio'),
      getTime: () => video.currentTime,
      getDuration: () => video.duration,
      getMuted: () => (forceMuted ? muted : video.muted),
      getVolume: () => volume,
      getFit: () => fit,
      isForceMuted: () => forceMuted,
    };
  }

  global.createStage = createStage;
  // Utilidades de áudio expostas para reuso (Display e Controle carregam este
  // arquivo antes dos seus): fonte única da rampa de volume e da sua duração.
  createStage.rampSteps = rampSteps;
  createStage.MUTE_RAMP_TIME = MUTE_RAMP_TIME;
})(this);
