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
  // db.js → mse.js → stage.js → louvorja.js → bible.js → controle.js: um erro
  // de sintaxe (ou um throw de inicialização) em qualquer um dos CINCO últimos
  // aborta só AQUELE script, o `load` dispara do mesmo jeito, `AVDB` continua
  // lá — e o bundle quebrado era carimbado como bom e servido PARA SEMPRE,
  // exatamente o oposto do que este mecanismo existe para fazer. Como o OTA
  // publica a cada push em `main` e o controle.js (o maior arquivo do bundle,
  // de longe) é o que mais muda, esse era justamente o caso provável.
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
  //   2. `AVDB` (db.js), `AVStream` (mse.js) e `createStage` (stage.js) — os
  //      três módulos compartilhados, cada um publicando seu global no fim do
  //      arquivo, incondicionalmente e no parse (o `AVStream` existe mesmo num
  //      navegador sem MediaSource — só o `suportado()` dele responde false).
  //      O mse.js era o ÚNICO script do Controle fora do watchdog: um bundle
  //      com ele quebrado era carimbado como bom.
  //   3. `__avBack` (controle.js, perto do FIM do arquivo) — só existe se o
  //      controle.js foi PARSEADO por inteiro e EXECUTADO até quase o fim.
  //      (Sem número de linha de propósito: o arquivo cresce a cada versão e
  //      um número aqui envelhece no push seguinte.)
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
    if (!global.AVDB || !global.AVStream || !global.createStage) return false;
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
  // `padEnd`: a mantissa de `Math.random()` pode render menos de 6 dígitos em
  // base 36 (0.5 → "i", por exemplo) e o slice devolve o que houver — uma
  // época curta encolhe o espaço de ids e aumenta a chance de uma resposta
  // atrasada da página anterior casar com uma promise desta.
  const EPOCH = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
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

  // Inteiro não-negativo SEM truncar em 32 bits. `x | 0` — o idioma curto que
  // se usa para isso — passa por um Int32 COM SINAL: qualquer número acima de
  // 2.147.483.647 vira negativo, e o `Math.max(0, …)` que costuma vir junto o
  // esconde zerando tudo. Aqui viajam TAMANHOS DE ARQUIVO, e um vídeo de 1080p
  // do YouTube passa dos 2 GB sem esforço.
  function inteiro(v) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

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

  // ---- progresso das chamadas longas ----
  // Download do YouTube e rasterização da apresentação levam minutos, e o
  // nativo empurra o andamento por `__avYtProgress`/`__avDeckProgress`
  // passando o ID DA CHAMADA. Guardar o callback num MAPA por id — e não numa
  // variável só, como era até aqui — é o que mantém dois trabalhos separados:
  // com uma variável, a segunda chamada sobrescrevia o callback da primeira e
  // as duas passavam a alimentar o MESMO cartão (o do último a começar),
  // enquanto o outro ficava parado no percentual em que estava. O `id` já
  // viajava na ponte desde sempre e era simplesmente ignorado aqui.
  const progresso = new Map();

  function rotaDeProgresso(nome) {
    global[nome] = function (id, a, b) {
      const cb = progresso.get(id);
      if (!cb) return;
      try { cb(Number(a) || 0, Number(b) || 0); } catch (_) { /* callback do chamador */ }
    };
  }
  rotaDeProgresso('__avYtProgress');
  rotaDeProgresso('__avDeckProgress');

  // Como o `call`, mas com um callback de andamento amarrado ao id da chamada.
  // A entrada sai do mapa quando a promise resolve — e ela SEMPRE resolve
  // (`call` devolve null em qualquer falha), então não há vazamento possível.
  function callComProgresso(invoke, onProgresso) {
    let meuId = null;
    return call((id) => {
      meuId = id;
      if (onProgresso) progresso.set(id, onProgresso);
      invoke(id);
    }).then((r) => {
      if (meuId) progresso.delete(meuId);
      return r;
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

  // ---- o DRENO do ESPELHO DE PIXELS (papel 'espelho') ----
  //
  // O espelho de pixels (ver docs/ESPELHO-DE-PIXELS.md) hospeda uma SEGUNDA
  // cópia de `/web/display/` numa `Presentation` sobre um `VirtualDisplay`
  // privado, cujo framebuffer é codificado e servido na rede local. Ele é o
  // mesmo arquivo, o mesmo origin e o mesmo barramento do telão de verdade —
  // e é justamente por ser idêntico que ele NÃO PODE FALAR.
  //
  // A arquitetura inteira SUPÕE um telão só. Dois emissores no barramento
  // quebram, cada um à sua maneira:
  //
  //   - `display-status` sai a ~4 Hz de CADA telão. O Controle o usa como
  //     fonte de sincronização (preview, barra, `authoritativeTime`) e o
  //     `NativeBridge.snoopDisplayStatus` o lê de passagem para corrigir a
  //     notificação de mídia — que é a ÚNICA janela do operador justamente
  //     quando o app está minimizado. Duas fontes alternadas ali dão uma
  //     barra que anda para a frente e para trás.
  //   - `media-ended` dobrado dá um segundo `load` do mesmo item em
  //     `repeat one` (fade duplo, visível na frente da congregação).
  //   - `mic-status` do espelho (que não tem `MicChromeClient` e por isso nega
  //     o `getUserMedia` em silêncio) APAGA o estado do microfone real, porque
  //     o Controle o aplica sem filtro de origem.
  //   - `diag-ask` respondido por dois telões faz o Registro mostrar o diário
  //     de UM dos dois, sem dizer qual.
  //
  // ## É uma LISTA DE PERMISSÃO de um item, e não um dreno total
  //
  // A tentação é calar tudo. Isso QUEBRA O RECURSO: `display.js` anuncia
  // `display-ready` ao fim do `init()`, e é esse anúncio — e só ele — que faz
  // o Controle reenviar a cena (`resendSceneToDisplay`). Calado por inteiro, o
  // espelho fica no wallpaper até alguém tocar em alguma coisa: exatamente nos
  // três casos em que ele precisa se recuperar sozinho — ligado no meio do
  // culto, depois da morte do renderer, e depois da recarga que o OTA faz.
  //
  // Deixar passar EXATAMENTE esse é seguro porque o reenvio é ENDEREÇADO
  // desde a v5.140: o anúncio vai assinado (`__de`), o Controle carimba
  // `__para` em todos os comandos da resposta, e o telão de verdade descarta o
  // que não for dele. Nenhum outro comando ganha essa proteção, e por isso
  // nenhum outro passa.
  //
  // E é uma lista de PERMISSÃO, nunca de recusa: um tipo de mensagem novo em
  // `display.js` nasce mudo aqui por construção. Uma lista de recusa deixaria
  // o próximo vazar em silêncio, que é a classe de defeito que este bloco
  // existe para fechar.
  const ESPELHO = global.__AV_ROLE__ === 'espelho';

  global.__AVBus = {
    post(msg) {
      // A lista de permissão. Ver o bloco acima: um item, e o motivo dele.
      if (ESPELHO && !(msg && msg.type === 'display-ready')) return;
      try { B.busPost(JSON.stringify(msg)); } catch (_) { /* ponte indisponível */ }
    },
    recv(fn) { busListeners.push(fn); },
  };

  // A OUTRA metade do dreno: o `BroadcastChannel`.
  //
  // `sendCommand` (shared/db.js) manda por DOIS caminhos em paralelo — o relay
  // nativo acima e o `BroadcastChannel` —, então calar só um deixaria o
  // espelho falando pelo outro. Mas o conserto NÃO é apagar a API:
  //
  //   - `db.js` decide o canal perguntando `'BroadcastChannel' in global`.
  //     Apagando a propriedade, `channel` nasce `null` e o espelho fica com um
  //     ÚNICO caminho de RECEPÇÃO — e a redundância dos dois caminhos é
  //     decisão escrita deste projeto (o relay existe porque o isolamento de
  //     sites do WebView pode surpreender). Zerar a função também não basta,
  //     porque `in` continuaria respondendo `true` e `new BroadcastChannel`
  //     lançaria.
  //   - O que precisa morrer é o ENVIO, e só ele. Uma subclasse do construtor
  //     real com `postMessage` mudo é literalmente isso: o objeto que `db.js`
  //     cria continua sendo um `BroadcastChannel` de verdade, recebe tudo o
  //     que o Controle manda, e não devolve nada.
  //
  // ORDEM: isto tem de rodar ANTES de `db.js`, que captura o construtor no
  // corpo do módulo (`new BroadcastChannel(CHANNEL_NAME)` na carga). O
  // `display/index.html` carrega `native.js` PRIMEIRO — é a mesma razão pela
  // qual `__NATIVE__` é definido aqui —, então a troca chega a tempo. Trocar
  // depois seria um no-op silencioso.
  //
  // A guarda de `typeof` não é zelo: `class extends undefined` LANÇA, e uma
  // exceção nesta IIFE derruba o resto da ponte inteira num WebView que por
  // qualquer motivo não traga a API.
  if (ESPELHO && typeof global.BroadcastChannel === 'function') {
    const CanalReal = global.BroadcastChannel;
    global.BroadcastChannel = class extends CanalReal {
      postMessage() { /* o espelho não fala no barramento — ver o bloco acima */ }
    };
  }

  // ---- compartilhamento recebido por intent ----
  let shareCb = null;
  let sharePumping = false;
  // Um `__avShareArrived` chegou COM o pump em voo: sem esta bandeira o
  // segundo share era simplesmente ignorado (o early-return de baixo) e
  // ficava no Kotlin esperando um próximo gatilho que podia nunca vir — o
  // operador compartilhava dois arquivos em sequência e só o primeiro
  // aparecia. A bandeira faz o finally rebombear uma vez.
  let shareDeNovo = false;

  async function pumpShare() {
    if (!shareCb) return;
    if (sharePumping) { shareDeNovo = true; return; }
    sharePumping = true;
    try {
      const share = await call((id) => B.takeShare(id), CALL_TIMEOUT_MS);
      if (share) shareCb(share);
    } finally {
      sharePumping = false;
      if (shareDeNovo) {
        shareDeNovo = false;
        pumpShare();
      }
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

    // Vídeo do YouTube como ARQUIVO, extraído e baixado pelo PRÓPRIO APARELHO
    // (ver YoutubeGrab.kt). Resolve `{ url, name, size, type }` com uma URL
    // servível — o lado web faz `fetch` + `Blob` como faz com um share — ou
    // null se não deu. SEM PRAZO: é rede de verdade, um louvor de 40 minutos
    // leva o que tiver de levar, e um timeout aqui abortaria justamente o
    // download que estava indo bem.
    // `onProgresso(lidos, total)` é opcional; o nativo empurra por
    // `__avYtProgress` a cada megabyte, com o id desta chamada.
    // `somenteAudio` baixa a FAIXA DE ÁUDIO (m4a) em vez do vídeo — e cai num
    // método próprio da ponte (`ytFetchAudio`), não num parâmetro a mais: a
    // ponte casa o método por nome + aridade, e mudar a assinatura do `ytFetch`
    // quebraria o download inteiro num shell antigo que recebesse este bundle
    // por OTA. Aqui a degradação é a certa: sem `ytFetchAudio`, o `try` do
    // `callComProgresso` falha e a promise resolve null, e quem pediu áudio
    // recebe "não deu" — mas quem pediu vídeo nunca é afetado. Quem oferece a
    // escolha na tela já pergunta o `__SHELL_VERSION__` antes de desenhá-la.
    // `altura` (v5.118) é o TETO de resolução do vídeo — o operador o escolhe
    // na folha de download (1080p · 720p · 480p). Ele cai num TERCEIRO destino
    // (`ytFetchAte`) pela mesma razão do áudio, e com um cuidado a mais: só é
    // usado quando o teto pedido é MENOR que o padrão do shell. Pedir 1080p
    // continua saindo pelo `ytFetch` de sempre, que existe em toda versão —
    // assim quem não mexeu no seletor nunca depende de um APK novo.
    ytFetch(url, onProgresso, somenteAudio, altura) {
      const teto = altura | 0;
      return callComProgresso(
        (id) => {
          if (somenteAudio) return B.ytFetchAudio(id, String(url));
          if (teto > 0 && teto < 1080) return B.ytFetchAte(id, String(url), teto);
          return B.ytFetch(id, String(url));
        },
        onProgresso,
      );
    },
    // O MANIFESTO DA TRANSMISSÃO DIRETA de um vídeo do YouTube: as duas faixas
    // adaptativas com os byte-ranges do DASH e URLs servíveis pelo próprio
    // origin (ver StreamProxy.kt). `null` num shell antigo, quando não há par
    // transmissível, ou quando o vídeo é restrito — e aí quem chamou cai no
    // download, que continua inteiro.
    //
    // COM prazo, como o gêmeo `ytSearch` — e ao contrário do `ytFetch`: aqui
    // há uma EXTRAÇÃO no meio (segundos), não um download de minutos. Sem o
    // prazo, um resolve perdido (exceção no Kotlin depois de entrar no método,
    // renderer trocado no meio) deixava o `tentarTransmitir` num await para
    // SEMPRE — o "Tocar agora" nem transmitia nem caía no download, o pior
    // desfecho possível. O null do timeout é o mesmo null da falha normal:
    // quem chamou cai no download, como sempre.
    ytStream: (url, altura) => call(
      (id) => B.ytStream(id, String(url), altura | 0),
      CALL_TIMEOUT_MS,
    ),

    // Busca no YouTube DENTRO do app: devolve
    // `[{ id, url, name, author, seconds, thumb }]`. Lista vazia num shell
    // antigo (o `call` resolve null) — quem chama já não desenha a seção.
    ytSearch: (termo) => call((id) => B.ytSearch(id, String(termo)), CALL_TIMEOUT_MS)
      .then((r) => r || []),

    // Apaga o arquivo intermediário depois que os bytes já foram para a
    // biblioteca — senão o vídeo fica DUAS vezes no aparelho.
    ytDiscard(url) { try { B.ytDiscard(String(url)); } catch (_) { /* shell antigo */ } },

    // PARA o download deste link (shell 28+). Não devolve nada e não espera: o
    // desfecho chega pelo caminho de sempre — a promise do `ytFetch` resolve
    // `null`, como em qualquer falha —, e quem sabe que a causa foi um
    // cancelamento é quem o pediu.
    //
    // Síncrono de propósito, sem `call`: do outro lado ele só escreve um campo,
    // e enfileirá-lo na fila de IO o faria rodar DEPOIS do download que se quer
    // parar. Num shell antigo o `try` engole e nada acontece — por isso quem
    // desenha o botão pergunta o `__SHELL_VERSION__` antes.
    ytCancel(url) { try { B.ytCancel(String(url)); } catch (_) { /* shell antigo */ } },

    // A ATUALIZAÇÃO DA BASE WEB que já está baixada e espera o próximo
    // lançamento (shell 29+). String vazia quando não há nada novo — e num
    // shell antigo o `call` resolve null, que o chamador lê como "nada".
    otaPending: () => call((id) => B.otaPending(id), CALL_TIMEOUT_MS),

    // APLICA essa atualização AGORA: as duas páginas recarregam. Devolve a
    // versão aplicada, ou null se não havia o que aplicar.
    //
    // Quem chama some junto — o documento é substituído —, então este `await`
    // normalmente não tem para onde voltar. Ele existe para o caso em que NÃO
    // houve o que aplicar, o único desfecho em que a página continua viva.
    otaApply: () => call((id) => B.otaApply(id), CALL_TIMEOUT_MS),

    // PROCURAR AGORA (shell 31+). Síncrono e sem resposta de propósito: quem
    // entrega o desfecho é o `otaPending` seguinte ou o empurrão do shell
    // (`window.__avOta`) — segurar uma promise pelo tempo de um download de
    // megabytes daria um botão travado. Num shell antigo o `try` engole e a
    // procura segue sendo a da abertura.
    otaCheck(forcar) { try { B.otaCheck(!!forcar); } catch (_) { /* shell antigo */ } },

    // O ESTADO DA PROCURA, em uma linha, para o Registro: quando foi a última,
    // o que ela deu e quantas falhas seguidas. Vazio num shell antigo.
    otaDiag: () => call((id) => B.otaDiag(id), CALL_TIMEOUT_MS).then((r) => r || ''),

    // DIAGNÓSTICO da última extração do YouTube: uma linha dizendo quantas
    // faixas de cada tipo o extrator recebeu e qual venceu. Vazio num shell
    // antigo (o `call` resolve null) e antes da primeira extração.
    ytDiag: () => call((id) => B.ytDiag(id), CALL_TIMEOUT_MS).then((r) => r || ''),

    // O SELETOR DE ARQUIVOS do aparelho: resolve `[{ url, name, type }]`, uma
    // entrada por arquivo escolhido (lista vazia se o operador desistir). É a
    // importação inteira do app no nativo — imagem, vídeo, áudio, PDF e PPTX
    // pela mesma porta —, e não só documentos.
    //
    // O `<input type="file">` continua existindo para o NAVEGADOR. Aqui ele não
    // serve: entrega um `File` (bytes já lidos), e o PDF precisa ser aberto
    // pelo Kotlin, que só sabe abrir um ARQUIVO. Pelo seletor do sistema todo
    // import chega como URL servível — o mesmo formato do compartilhamento.
    //
    // SEM PRAZO, como o `pickFolder`: quem responde é uma PESSOA escolhendo um
    // arquivo, e um timeout resolveria null com o seletor ainda aberto.
    pickDoc: (mimes) => call((id) => B.pickDoc(id, String(mimes || ''))).then((r) => r || []),

    // ---- apresentação (PDF / Google Apresentações) ----
    // Rasteriza uma apresentação e resolve `{ name, pages: [url] }`: uma imagem
    // por página, em URLs servíveis — daqui para a frente o caminho é o de
    // qualquer imagem importada. Ver SlideDeck.kt para por que o formato é PDF
    // e por que o desenho é nativo.
    //
    // SEM PRAZO, como o `ytFetch`: rasterizar dezenas de páginas (ou baixar a
    // exportação do Google) leva o tempo que levar, e um timeout abortaria
    // justamente a apresentação grande. `onProgresso(feitas, total)` é
    // opcional; o nativo empurra por `__avDeckProgress` a cada página.
    deckPages(origem, nome, onProgresso) {
      return callComProgresso(
        (id) => B.deckPages(id, String(origem), String(nome || '')),
        onProgresso,
      );
    },
    // A URL de exportação em PDF de um link do Google Apresentações, ou ''. É
    // SÍNCRONO de propósito: quem chama precisa da resposta para decidir o
    // caminho do import, e a pergunta é só um casamento de expressão regular.
    deckExportUrl(link) {
      try { return B.deckExportUrl(String(link)) || ''; } catch (_) { return ''; }
    },
    // Apaga as páginas intermediárias depois da cópia para a biblioteca.
    deckDiscard(url) { try { B.deckDiscard(String(url)); } catch (_) { /* shell antigo */ } },

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

    // Mesa de som LIGADA: o áudio sai pelo celular, deste WebView, e ele não
    // pode ser suspenso quando o app é minimizado. Desligada, ele volta a ser
    // estrangulado em segundo plano — que é o certo quando o celular é só a
    // mesa de comando e o som está no telão.
    keepAudioAlive(on) { try { B.keepAudioAlive(!!on); } catch (_) { /* shell antigo */ } },

    // ---------- ESPELHO DE PIXELS (shell 32+) ----------
    //
    // O telão numa tela virtual privada, servido a navegadores da rede local
    // (ver docs/ESPELHO-DE-PIXELS.md). Num shell antigo o `call` resolve null e
    // o `try` engole — mas quem desenha a linha já pergunta o
    // `__SHELL_VERSION__` antes, porque botão que não faz nada no meio de um
    // culto é pior que botão nenhum.
    //
    // ESTES QUATRO NÃO REMONTAM CAMPO A CAMPO, e isso é deliberado: eles só
    // repassam o `callId` e devolvem o JSON que o KOTLIN montou. A forma de
    // falhar preferida deste projeto — um campo esquecido na remontagem, lido
    // como `false`/`0` do outro lado (`slideLabel` v5.97→v5.102, `bytes`
    // v5.118→v5.137) — não tem por onde acontecer aqui, porque não há
    // remontagem. O que sobra de cuidado é a coerção dos ARGUMENTOS, abaixo.
    espelhoLigar: (modo) => call(
      (id) => B.espelhoLigar(id, String(modo || 'imagem')), CALL_TIMEOUT_MS,
    ),
    // Síncrono e SEM `callId`, no molde do `ytCancel`: desligar não pode
    // esperar a fila de nada. Quem responde é o próprio estado, na consulta
    // seguinte.
    espelhoDesligar() { try { B.espelhoDesligar(); } catch (_) { /* shell antigo */ } },
    espelhoEstado: () => call((id) => B.espelhoEstado(id), CALL_TIMEOUT_MS),
    espelhoDiag: () => call((id) => B.espelhoDiag(id), CALL_TIMEOUT_MS),
    // `idPendente` vazio (ou '*') é a chave da APROVAÇÃO AUTOMÁTICA da sessão,
    // e `sim` é o valor dela — é o mesmo método porque é a mesma decisão do
    // operador: quem entra nesta tela.
    espelhoAprovar: (idPendente, sim) => call(
      (id) => B.espelhoAprovar(id, String(idPendente || ''), !!sim), CALL_TIMEOUT_MS,
    ).then((r) => r === true),

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
          // `inteiro()` e NÃO `| 0` (v5.137). O bitwise trunca para 32 bits com
          // sinal: um vídeo de 1080p passa dos 2 GB, o valor VIRA NEGATIVO, o
          // `Math.max(0, …)` o zera e a barra fica parada no começo do download
          // mais longo que o app faz. O lado Kotlin já lia `Long` justamente
          // por isso — a truncagem acontecia antes de ele ver o número.
          done: inteiro(p && p.done),
          total: inteiro(p && p.total),
          etaMs: inteiro(p && p.etaMs),
          // A UNIDADE. Sem este campo o Kotlin lê `optBoolean` como false e
          // apresenta bytes como se fossem ITENS: "0 de 398458880", que se lê
          // como quase quatrocentos milhões de músicas. É o mesmo modo de
          // falhar do `nowPlaying` (ver CLAUDE.md): esta função remonta o
          // objeto campo a campo, e um campo esquecido some em silêncio.
          // CAMPO NOVO AQUI = CAMPO NOVO NO OBJETO ACIMA, sempre.
          bytes: !!(p && p.bytes),
          // O item em destaque agora (nome de música/capítulo/arquivo). Vem
          // como lista por compatibilidade com shells anteriores, mas hoje o
          // lado web manda UM de cada vez, consumindo uma FILA — ver
          // bgItemStart/bgPacerTick em controle.js. Não é rodízio entre os
          // itens em voo: o rodízio trazia o mesmo nome de volta várias vezes
          // e a lista não ia a lugar nenhum; a fila consome cada nome UMA
          // vez, em ordem.
          items: (p && Array.isArray(p.items) ? p.items : []).map(String).slice(0, 6),
          // Há quanto tempo nada acontece. Um shell anterior ignora o campo e
          // a notificação simplesmente não distingue travado de lento.
          idleMs: inteiro(p && p.idleMs),
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
          // COMO o operador chama o que ⏮/⏭ passam agora ("estrofe",
          // "versículo", "página"). O campo existe desde a v5.97 no
          // `pushNowPlaying` e é lido pelo `SessionService` desde então — mas
          // ele NUNCA chegava lá: este objeto é montado campo a campo, e quem
          // esquece de um aqui o descarta em silêncio, sem erro em lugar
          // nenhum. Resultado: a notificação escrevia "(estrofe)" também
          // durante uma APRESENTAÇÃO, onde o que passa é página. Num shell
          // antigo o campo é ignorado e o rótulo volta ao de sempre.
          slideLabel: String((s && s.slideLabel) || ''),
          wallpaper: !!(s && s.wallpaper),
          // `inteiro()` e NÃO `| 0`, como no bgProgress acima — o defeito
          // irmão: o bitwise trunca em Int32 COM SINAL, e uma duração acima de
          // ~596 h de milissegundos (ou qualquer conta futura em bytes) vira
          // negativa e o clamp a zera. Mesma regra para os dois campos de
          // tempo, para a linha do tempo da sessão nunca andar para trás.
          positionMs: inteiro(s && s.positionMs),
          durationMs: inteiro(s && s.durationMs),
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
