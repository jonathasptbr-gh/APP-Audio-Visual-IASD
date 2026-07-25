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
  // bundle bom depois que ele confirma que carregou por inteiro.
  //
  // `load` dispara depois de todos os scripts, e a checagem de `AVDB` é o que
  // dá sentido à confirmação: um erro de sintaxe em `db.js` deixaria a página
  // "carregada" mas sem sistema nenhum — nesse caso NÃO confirmamos, e o
  // lançamento seguinte volta ao bundle embutido no APK.
  global.addEventListener('load', function () {
    if (!global.AVDB) return;
    try { B.otaConfirm(); } catch (_) { /* shell antigo, sem OTA */ }
  });

  // ---- chamadas assíncronas (Promise sobre callbacks do Kotlin) ----
  // O Kotlin resolve chamando window.__avResolve(id, valor) — o valor já
  // chega como objeto/array/null JavaScript, não como string para reparsear.
  const pending = new Map();
  let seq = 0;

  global.__avResolve = function (id, value) {
    const resolve = pending.get(id);
    if (!resolve) return;
    pending.delete(id);
    resolve(value);
  };

  function call(invoke) {
    return new Promise((resolve) => {
      const id = String(++seq);
      pending.set(id, resolve);
      try {
        invoke(id);
      } catch (_) {
        pending.delete(id);
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
      const share = await call((id) => B.takeShare(id));
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
    pickFolder: () => call((id) => B.pickFolder(id)),
    listFolder: (uri) => call((id) => B.listFolder(id, uri)).then((r) => r || []),

    // Compartilhamento vindo de outros apps (substitui o share_target do SW).
    onShare(cb) { shareCb = cb; pumpShare(); },

    // Telas de apresentação (a TV).
    displays: () => call((id) => B.displays(id)).then((r) => r || []),
    onDisplayChange(cb) { displaysCb = cb; },

    // Botão de cast da preview: abre o seletor de espelhamento do Android
    // (a tela de Cast das Configurações — o popup das configurações rápidas
    // não é exposto a apps de terceiros; ver NativeBridge.openCast).
    // Num shell antigo, sem o método, não faz nada em vez de quebrar.
    openCast() { try { B.openCast(); } catch (_) { /* shell antigo */ } },

    // Sessão de culto.
    keepAwake(on) { try { B.keepAwake(!!on); } catch (_) { /* ignorado */ } },

    // Downloads em andamento: sem isto o Android congela o processo quando o
    // app é minimizado e a sincronização para no meio — justamente o que
    // acontece no uso normal, já que ninguém fica olhando a tela enquanto um
    // hinário inteiro baixa.
    keepAlive(on) { try { B.keepAlive(!!on); } catch (_) { /* ignorado */ } },
  };
})(this);
