// Ponte com a casca Android nativa (window.AVNative).
//
// Este arquivo é o ÚNICO ponto do lado web que conhece o shell nativo. Ele é
// carregado antes de qualquer outro script dos dois apps e, no NAVEGADOR, é
// um no-op completo: sem `window.__AVBridge` ele retorna imediatamente, não
// define `__NATIVE__` e nada muda. É essa assimetria que permite a mesma base
// de código rodar nos dois contextos.
//
// REGRA DE ESCRITA (vale para todo o projeto): as guardas no resto do código
// são sempre `if (!window.__NATIVE__) { …comportamento web… }`, nunca o
// inverso como caminho principal — o comportamento de navegador é o padrão, e
// o nativo é a exceção que se declara.
//
// A ponte entrega URLs SERVÍVEIS, nunca bytes: arquivos do dispositivo e
// compartilhamentos chegam como `https://appassets.androidplatform.net/saf/…`
// e o lado web usa `fetch()` + `Blob` exatamente como já faz com o OPFS. Um
// vídeo de 2 GB nunca passa por base64.

(function (global) {
  'use strict';

  const B = global.__AVBridge;
  if (!B) return; // navegador comum — nada a fazer

  global.__NATIVE__ = true;
  try { global.__SHELL_VERSION__ = B.shellVersion(); } catch (_) { global.__SHELL_VERSION__ = 0; }
  try { global.__AV_ROLE__ = B.role(); } catch (_) { global.__AV_ROLE__ = ''; }
  // versionName do APK — o índice de SHELL exibido ao operador (≠
  // __SHELL_VERSION__, que é o contrato interno da ponte). Vazio num shell
  // antigo, sem `appVersion()`: a UI então mostra só a versão da base web.
  try { global.__SHELL_NAME__ = B.appVersion() || ''; } catch (_) { global.__SHELL_NAME__ = ''; }

  // ---- confirmação de boot (watchdog do OTA) ----
  // A base web pode ter sido baixada por OTA. Se ela estiver quebrada, o app
  // ficaria inutilizável até reinstalar — por isso o shell só considera um
  // bundle bom depois que ele confirma que subiu INTEIRO. Não confirmar é o
  // caminho seguro: o lançamento seguinte descarta o bundle e volta ao
  // embutido no APK (mais velho, porém funcionando).
  //
  // Até a v5.48 a única condição era `window.AVDB` no evento `load`, e o
  // comentário aqui raciocinava sobre "um erro de sintaxe em db.js" — o
  // arquivo MENOS provável de quebrar. A ordem dos scripts é native.js →
  // db.js → stage.js → louvorja.js → bible.js → controle.js: um erro de
  // sintaxe (ou um throw de inicialização) em qualquer um dos QUATRO últimos
  // aborta só AQUELE script, o `load` dispara do mesmo jeito, `AVDB` continua
  // lá — e o bundle quebrado era carimbado como bom e servido PARA SEMPRE,
  // exatamente o oposto do que este mecanismo existe para fazer. Como o OTA
  // publica a cada push em `main` e o controle.js (8 mil linhas) é de longe o
  // que mais muda, esse era justamente o caso provável.
  //
  // O sinal agora é "o app está DE PÉ", e cada peça dele cobre um trecho da
  // cadeia que a anterior não cobre:
  //
  //   1. papel 'controle' — o WebView do Display carrega bem menos código
  //      (não carrega controle.js nem louvorja.js), então deixá-lo confirmar
  //      validaria um bundle cujo Controle nunca chegou a rodar. E o Display
  //      é o caso NORMAL de culto (TV conectada), ou seja, ele confirmaria
  //      quase sempre no lugar do outro. Sem TV o Display nem existe: quem
  //      confirma é sempre o Controle, que é quem precisa funcionar.
  //   2. `AVDB` (db.js) e `createStage` (stage.js) — os dois módulos
  //      compartilhados, cada um publicando seu global no fim do arquivo.
  //   3. `__avBack` (controle.js, ~linha 8017 de 8222) — só existe se o
  //      controle.js foi PARSEADO por inteiro e EXECUTADO até quase o fim.
  //      É a mesma função que o `MainActivity.handleBack()` consulta, ou
  //      seja, um contrato que já existe, não um marcador inventado aqui.
  //   4. um `<li>` dentro de `#playlist` — o HTML entrega esse `<ul>` VAZIO;
  //      quem o preenche é `renderPlaylist()`, chamado por `load()` dentro do
  //      `init()` assíncrono. É o que prova que a inicialização terminou de
  //      verdade: `init()` começa por `loadCollections()` (louvorja.js) e só
  //      então monta a tela, então uma quebra em louvorja.js ou bible.js
  //      derruba o `init()` antes daqui e o marcador nunca aparece.
  //
  // Por que POLLING e não uma checagem única no `load`: o `init()` do Controle
  // é assíncrono (várias leituras de IndexedDB) e termina DEPOIS do `load`.
  // Uma checagem única rejeitaria todo bundle bom — o OTA pararia de funcionar
  // por inteiro, que é o defeito oposto e igualmente ruim.
  //
  // Não há risco de descompasso de versão: `native.js` viaja DENTRO do bundle
  // que ele valida, então esta função e o `__avBack` que ela exige são sempre
  // do mesmo commit.
  //
  // O erro possível aqui é o SEGURO: a confirmação chega ~1 s depois do
  // `load` (o tempo do `init()`), então fechar o app nesse intervalo faz um
  // bundle bom ser descartado. Custo: o app volta ao embutido e o OTA baixa
  // de novo na abertura seguinte. O erro do outro lado — carimbar um bundle
  // quebrado — não tem volta sem publicar uma versão nova.
  const OTA_POLL_MS = 250;
  const OTA_GIVEUP_MS = 30000; // depois disto o bundle é dado como quebrado

  function otaAppIsUp() {
    if (global.__AV_ROLE__ !== 'controle') return false;
    if (!global.AVDB || !global.createStage) return false;
    if (typeof global.__avBack !== 'function') return false;
    return !!document.querySelector('#playlist > li');
  }

  global.addEventListener('load', function () {
    // O Display nem entra no laço: ele nunca confirma (ver item 1 acima).
    if (global.__AV_ROLE__ !== 'controle') return;
    const started = Date.now();
    (function poll() {
      if (otaAppIsUp()) {
        try { B.otaConfirm(); } catch (_) { /* shell antigo, sem OTA */ }
        return;
      }
      // Desistir em silêncio é o comportamento correto: sem confirmação, o
      // WebUpdater descarta o bundle no lançamento seguinte.
      if (Date.now() - started >= OTA_GIVEUP_MS) return;
      global.setTimeout(poll, OTA_POLL_MS);
    })();
  });

  // ---- chamadas assíncronas (Promise sobre callbacks do Kotlin) ----
  // O Kotlin resolve chamando window.__avResolve(id, valor) — o valor já
  // chega como objeto/array/null JavaScript, não como string para reparsear.
  //
  // O id é ESCOPADO AO CARREGAMENTO da página, não um contador puro. O
  // renderer pode morrer no meio de uma chamada em voo (dois WebViews, vídeo
  // grande e player do YouTube no mesmo processo — é para isso que existe o
  // `onRenderProcessGone` do WebViewFactory): o WebView é destruído e
  // recriado, a página recarrega e o contador volta a zero, mas o `resolve`
  // do Kotlin aponta sempre para o WebView ATUAL. Com ids "1", "2", "3" a
  // resposta atrasada de um `listFolder` da página velha resolvia a promise
  // homônima da página NOVA — uma lista de arquivos chegando, por exemplo,
  // onde se esperava o retorno de `displays()`. Com a época aleatória por
  // carregamento, a resposta velha simplesmente não acha entrada no mapa e é
  // descartada, que é o que se quer.
  const EPOCH = Math.random().toString(36).slice(2, 8);
  const pending = new Map();
  let seq = 0;

  // Prazo das chamadas que NÃO dependem de gente. Se o lado nativo nunca
  // responder (resposta perdida, exceção no Kotlin depois de entrar no
  // método), sem isto a promise fica pendente para sempre e o fluxo que a
  // aguardava para no meio — sem erro, sem flash, sem nada no console. É rede
  // de segurança, não deadline de UX: generoso de propósito, porque varrer
  // uma pasta enorme do SAF leva segundos.
  const CALL_TIMEOUT_MS = 60000;

  global.__avResolve = function (id, value) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (entry.timer) global.clearTimeout(entry.timer);
    entry.resolve(value);
  };

  // `timeoutMs` é OPCIONAL de propósito: `pickFolder` e `requestMic` esperam
  // uma PESSOA (navegar no seletor do SAF, responder ao diálogo de permissão)
  // e não têm prazo razoável — um timeout ali resolveria null com o operador
  // ainda escolhendo a pasta, e o `resolve` que chegasse depois seria jogado
  // fora. Essas ficam sem prazo, como antes.
  function call(invoke, timeoutMs) {
    return new Promise((resolve) => {
      const id = EPOCH + ':' + (++seq);
      const entry = { resolve, timer: 0 };
      pending.set(id, entry);
      if (timeoutMs) {
        entry.timer = global.setTimeout(function () {
          if (pending.get(id) !== entry) return;
          pending.delete(id);
          resolve(null); // cada chamador já trata null (lista vazia, string vazia, false)
        }, timeoutMs);
      }
      try {
        invoke(id);
      } catch (_) {
        pending.delete(id);
        if (entry.timer) global.clearTimeout(entry.timer);
        resolve(null);
      }
    });
  }

  // ---- barramento de comandos (relay nativo) ----
  // Roda SEMPRE em paralelo ao BroadcastChannel: cada comando sai pelos dois
  // caminhos e `shared/db.js` descarta a cópia repetida pelo campo `__mid`.
  // Assim o sistema funciona igual com ou sem BroadcastChannel entre os dois
  // WebViews, sem precisar detectar qual dos dois está funcionando.
  const busListeners = [];

  global.__avBusDeliver = function (json) {
    let msg;
    try { msg = JSON.parse(json); } catch (_) { return; }
    for (const fn of busListeners) {
      try { fn(msg); } catch (_) { /* um listener quebrado não derruba os outros */ }
    }
  };

  global.__AVBus = {
    post(msg) {
      try { B.busPost(JSON.stringify(msg)); } catch (_) { /* ponte indisponível */ }
    },
    recv(fn) { busListeners.push(fn); },
  };

  // ---- compartilhamento recebido por intent ----
  let shareCb = null;
  let sharePumping = false;

  async function pumpShare() {
    if (!shareCb || sharePumping) return;
    sharePumping = true;
    try {
      const share = await call((id) => B.takeShare(id), CALL_TIMEOUT_MS);
      if (share) shareCb(share);
    } finally {
      sharePumping = false;
    }
  }

  // Chamado pelo Kotlin quando um share chega com o app JÁ aberto.
  global.__avShareArrived = function () { pumpShare(); };

  // ---- telas conectadas ----
  let displaysCb = null;
  global.__avDisplaysChanged = function () {
    if (!displaysCb) return;
    global.AVNative.displays().then((list) => displaysCb(list));
  };

  global.AVNative = {
    // Pastas do dispositivo — substitui showDirectoryPicker(), que NÃO existe
    // no Android. É o que faz a sincronização de pastas funcionar no celular.
    // `pickFolder` fica SEM prazo: quem responde é o operador, no seletor do
    // SAF. `listFolder` é trabalho de máquina, então leva a rede de segurança.
    pickFolder: () => call((id) => B.pickFolder(id)),
    listFolder: (uri) => call((id) => B.listFolder(id, uri), CALL_TIMEOUT_MS).then((r) => r || []),

    // Compartilhamento vindo de outros apps (substitui o share_target do SW).
    onShare(cb) { shareCb = cb; pumpShare(); },

    // Telas de apresentação (a TV).
    displays: () => call((id) => B.displays(id), CALL_TIMEOUT_MS).then((r) => r || []),
    onDisplayChange(cb) { displaysCb = cb; },

    // Botão de cast da preview: abre o seletor de ESPELHAMENTO DE TELA do
    // Android (Smart View / Wireless display) — não o Google Cast, que é
    // outra coisa (ver NativeBridge.openCastPicker). Num shell antigo, sem o
    // método, não faz nada em vez de quebrar.
    openCast() { try { B.openCast(); } catch (_) { /* shell antigo */ } },

    // Abre uma URL FORA do app (navegador ou o app que a reivindicar). O
    // WebView do Controle recusa navegar para qualquer coisa que não seja o
    // próprio origin — é a invariante que impede conteúdo estranho de entrar
    // num WebView que injeta `__AVBridge` em toda página —, então sem este
    // método um link externo simplesmente não faz nada. Só `https`, e a
    // validação é repetida no Kotlin: aqui ela é conveniência, lá é a guarda.
    // Num shell antigo o método não existe e o `try` engole; quem chama já não
    // oferece o botão nesse caso (ver appendYoutubeSearch).
    openExternal(url) {
      try {
        const u = String(url || '');
        if (!/^https:\/\//i.test(u)) return;
        B.openExternal(u);
      } catch (_) { /* shell antigo */ }
    },

    // Para onde o botão vai abrir, em texto — os alvos variam por fabricante
    // e não são API documentada, então o popup de Exibição mostra isso.
    // (num shell sem o método, `call` já resolve null — isto vira string vazia)
    castTarget: () => call((id) => B.castTarget(id), CALL_TIMEOUT_MS).then((r) => (r && r.label) || ''),

    // Botões físicos de volume: pede que a Activity os intercepte e os entregue
    // em `window.__avVolumeKey(±1)` — sem isso eles mexem na saída do sistema
    // (e, com espelhamento ativo, no volume da TV) em vez do fader do app.
    captureVolumeKeys(on) { try { B.captureVolumeKeys(!!on); } catch (_) { /* shell antigo */ } },
    // Fader já no limite: devolve o passo ao volume do sistema.
    systemVolume(step) { try { B.systemVolume(step | 0); } catch (_) { /* shell antigo */ } },

    // Microfone (push-to-talk): garante a permissão RECORD_AUDIO do Android
    // ANTES do getUserMedia. Sem ela o WebView nega a captura de propósito
    // (ver MicChromeClient). Num shell antigo resolve false — e o lado web
    // tenta o getUserMedia mesmo assim, que é o caminho do navegador.
    requestMic: () => call((id) => B.requestMic(id)).then((r) => r === true),

    // Downloads em andamento: sem isto o Android congela o processo quando o
    // app é minimizado e a sincronização para no meio — justamente o que
    // acontece no uso normal, já que ninguém fica olhando a tela enquanto um
    // hinário inteiro baixa.
    keepAlive(on) { try { B.keepAlive(!!on); } catch (_) { /* ignorado */ } },

    // Progresso do download em curso, para a notificação do serviço em
    // primeiro plano — com o app minimizado ela é a única janela para o que
    // está acontecendo. `{ label, done, total, etaMs }`. Num shell antigo o
    // método não existe: o `try` engole e a notificação segue estática, que é
    // exatamente o comportamento anterior.
    bgProgress(p) {
      try {
        B.bgProgress(JSON.stringify({
          label: String((p && p.label) || ''),
          done: Math.max(0, (p && p.done) | 0),
          total: Math.max(0, (p && p.total) | 0),
          etaMs: Math.max(0, (p && p.etaMs) | 0),
          // O item em destaque agora (nome de música/capítulo/arquivo). Vem
          // como lista por compatibilidade com shells anteriores, mas hoje o
          // lado web manda UM de cada vez, consumindo uma FILA — ver
          // bgItemStart/bgPacerTick em controle.js. Não é rodízio entre os
          // itens em voo: o rodízio trazia o mesmo nome de volta várias vezes
          // e a lista não ia a lugar nenhum; a fila consome cada nome UMA
          // vez, em ordem. (O mesmo texto errado sobre "rodízio" ainda está
          // em NativeBridge.kt — corrigir junto ao mexer lá.)
          items: (p && Array.isArray(p.items) ? p.items : []).map(String).slice(0, 6),
          // Há quanto tempo nada acontece. Um shell anterior ignora o campo e
          // a notificação simplesmente não distingue travado de lento.
          idleMs: Math.max(0, (p && p.idleMs) | 0),
        }));
      } catch (_) { /* ignorado */ }
    },

    // O que está no ar, para a notificação de controles e a sessão de mídia
    // (SessionService.kt). `active:false` = nada em cena: a notificação some.
    // Num shell anterior o método não existe e o `try` engole — o app segue
    // sem notificação de controles, como antes.
    nowPlaying(s) {
      try {
        B.nowPlaying(JSON.stringify({
          active: !!(s && s.active),
          title: String((s && s.title) || ''),
          subtitle: String((s && s.subtitle) || ''),
          playing: !!(s && s.playing),
          // ⏮/⏭ passam ESTROFE em vez de mídia (letra, versículo, mensagem).
          slideMode: !!(s && s.slideMode),
          wallpaper: !!(s && s.wallpaper),
          positionMs: Math.max(0, (s && s.positionMs) | 0),
          durationMs: Math.max(0, (s && s.durationMs) | 0),
        }));
      } catch (_) { /* ignorado */ }
    },

    // Ação vinda da notificação, da tela de bloqueio ou de um botão de mídia.
    // O callback recebe a string da ação; quem executa é o lado web, com os
    // mesmos handlers dos botões da tela.
    onRemote(cb) {
      global.__avRemote = function (action) {
        try { cb(String(action)); } catch (_) { /* ignorado */ }
      };
    },
  };
})(this);
