// ===== refs =====
const prevEl = document.getElementById('prev');
const playPauseEl = document.getElementById('playpause');
const stopEl = document.getElementById('stop');
const nextEl = document.getElementById('next');
const repeatEl = document.getElementById('repeat');

const npNameEl = document.getElementById('npName');
const npNameInnerEl = document.getElementById('npNameInner');
const seekEl = document.getElementById('seek');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');
const slidePrevBtnEl = document.getElementById('slidePrevBtn');
const slideNextBtnEl = document.getElementById('slideNextBtn');

const viewToggleEl = document.getElementById('viewToggle');
const muteToggleEl = document.getElementById('muteToggle');
const volSliderEl = document.getElementById('volSlider');
const volValueEl = document.getElementById('volValue');
const faderWrapEl = document.querySelector('.fader-wrap');

// Modo de uso (ver "Modos de uso" mais abaixo)
const appModeSegEl = document.getElementById('appModeSeg');
const simpleModeEl = document.getElementById('simpleMode');
const simpleFullBtnEl = document.getElementById('simpleFullBtn');
const fullSimpleBtnEl = document.getElementById('fullSimpleBtn');
const simpleCastBtnEl = document.getElementById('simpleCastBtn');
const simpleCastLabelEl = document.getElementById('simpleCastLabel');
const simpleCastStatusEl = document.getElementById('simpleCastStatus');
const simpleSearchBtnEl = document.getElementById('simpleSearchBtn');
const simpleVeilEl = document.getElementById('simpleVeil');
const simpleStageEl = document.getElementById('simpleStage');
// A preview e a casa dela no modo avançado: são módulo-nível porque o nó MUDA
// DE PAI conforme o modo (ver hostPreview).
const previewEl = document.getElementById('preview');
const previewRowEl = document.querySelector('.preview-row');
const pvCastBtnEl = document.getElementById('pvCastBtn');
const simpleNpNameEl = document.getElementById('simpleNpName');
const simplePlayEl = document.getElementById('simplePlay');
const simpleStopEl = document.getElementById('simpleStop');
const simpleMuteEl = document.getElementById('simpleMute');
const simpleLyricsEl = document.getElementById('simpleLyrics');
const simpleTimeEl = document.getElementById('simpleTime');
const simpleTimeCurEl = document.getElementById('simpleTimeCur');
const simpleTimeDurEl = document.getElementById('simpleTimeDur');
const simpleTimeFillEl = document.getElementById('simpleTimeFill');
const simpleTimeHitEl = document.getElementById('simpleTimeHit');
const simpleVolWrapEl = document.getElementById('simpleVolWrap');
const simpleVolUpEl = document.getElementById('simpleVolUp');
const simpleVolDownEl = document.getElementById('simpleVolDown');
const simpleVolValueEl = document.getElementById('simpleVolValue');

// ===== O modo LEMBRADO (o resto da história em "Modos de uso", mais abaixo) =====
// O modo escolhido sobrevive a fechar o app. Quem opera o culto toda semana
// estava pagando dois toques por sessão para voltar ao avançado, e o operador
// que só quer tocar um louvor nunca sai do simplificado — que continua sendo o
// padrão de quem nunca escolheu nada.
//
// **Em `localStorage`, e não no IndexedDB como TODO o resto do estado**, por um
// motivo específico: esta chave precisa ser lida ANTES DO PRIMEIRO QUADRO. O
// `<body>` nasce `mode-simple` justamente para a tela certa aparecer sem
// esperar JS nenhum, e uma leitura do IDB é assíncrona — ela só volta depois de
// o app já ter pintado o simplificado. Quem tivesse deixado o avançado veria a
// tela errada e ela trocaria embaixo do dedo, no meio do primeiro toque.
// `localStorage` é síncrono, e vive no mesmo `app_webview/` do IDB: mesma
// durabilidade, mesma regra de backup, some junto numa desinstalação.
//
// UMA fonte, não duas: gravar nos dois lugares "por garantia" só cria o dia em
// que eles discordam e ninguém sabe qual vale.
const APP_MODE_KEY = 'av.appMode';
function storedAppMode() {
  // `localStorage` lança quando o armazenamento está bloqueado (aba anônima de
  // certos navegadores). O padrão do app é o simplificado, então o `catch` já
  // é a resposta certa — não há o que tratar.
  try { return localStorage.getItem(APP_MODE_KEY) === 'full' ? 'full' : 'simple'; }
  catch (_) { return 'simple'; }
}
let appMode = storedAppMode();
// Só a PINTURA aqui, no topo do arquivo: é a única parte que não pode esperar.
// O resto de `setAppMode` (segmento das Configurações, render do simplificado,
// o vazado da faixa de abas) roda no `init()`, quando o módulo inteiro já
// existe e a faixa de abas já tem largura para ser medida.
document.body.classList.toggle('mode-simple', appMode === 'simple');
simpleModeEl.classList.toggle('open', appMode === 'simple');

const mixerEl = document.getElementById('mixer');
const volToggleEl = document.getElementById('volToggle');
const volCloseEl = document.getElementById('volClose');
const settingsBtnEl = document.getElementById('settingsBtn');
const pvSoundBtnEl = document.getElementById('pvSoundBtn');
const lyricsViewBtnEl = document.getElementById('lyricsViewBtn');
const lyricsPopupEl = document.getElementById('lyricsPopup');
const lyricsPopupTitleEl = document.getElementById('lyricsPopupTitle');
const lyricsPopupCloseEl = document.getElementById('lyricsPopupClose');
const lyricsViewSegEl = document.getElementById('lyricsViewSeg');
const lyricsViewBodyEl = document.getElementById('lyricsViewBody');
const openDisplayBtnEl = document.getElementById('openDisplayBtn');
const displayStatusTextEl = document.getElementById('displayStatusText');
const castTargetLineEl = document.getElementById('castTargetLine');

const pvWallEl = document.getElementById('pvWall');
const pvBusyEl = document.getElementById('pvBusy');
const pvBusyCapEl = document.getElementById('pvBusyCap');
const pvBusyLabelEl = document.getElementById('pvBusyLabel');
const pvImgEl = document.getElementById('pvImg');
const pvVideoEl = document.getElementById('pvVideo');
const pvYoutubeEl = document.getElementById('pvYoutube');
const pvLyricsEl = document.getElementById('pvLyrics');
const pvLyricsImgEl = document.getElementById('pvLyricsImg');
const pvLyricsContentEl = document.getElementById('pvLyricsContent');
const pvLyricsLineEl = document.getElementById('pvLyricsLine');
const pvLyricsAuxEl = document.getElementById('pvLyricsAux');
const pvTextEl = document.getElementById('pvText');
const pvTextContentEl = document.getElementById('pvTextContent');
const pvTextMainEl = document.getElementById('pvTextMain');
const pvTextSubEl = document.getElementById('pvTextSub');

const plBtnEl = document.getElementById('plBtn');
const plCountEl = document.getElementById('plCount');
const playlistEl = document.getElementById('playlist');
const plPopupEl = document.getElementById('plPopup');
const plPopupCountEl = document.getElementById('plPopupCount');
const plPopupCloseEl = document.getElementById('plPopupClose');
const plPackEl = document.getElementById('plPack');

const fileEl = document.getElementById('file');
const mainEl = document.querySelector('main');
// `.bottombar` e `.deck` eram as âncoras da barra de seleção enquanto ela morava
// na caixa de controles (v5.107 a mudou para o rodapé da lista). Ninguém mais
// os consulta.
const tabsEl = document.querySelector('.tabs');
const libraryEl = document.getElementById('library');
// O rodapé FIXO da caixa da lista: fora do `<ul>` rolável, e por isso sempre à
// vista. Hospeda "Importar arquivos" e, durante a seleção múltipla, a `#selbar`
// (ver `renderListFoot` e `hostSelbar`) — nunca os dois ao mesmo tempo.
const listFootEl = document.getElementById('listFoot');
// Favoritos: a gaveta do topo (ver `openFavorites`). A lista dela é um segundo
// HOST para as MESMAS funções de render — não uma segunda implementação.
const favPopupEl = document.getElementById('favPopup');
const favSheetEl = document.getElementById('favSheet');
const favListEl = document.getElementById('favList');
const favTitleEl = document.getElementById('favTitle');
const favIconEl = document.getElementById('favIcon');
const favBackEl = document.getElementById('favBack');
const favCloseEl = document.getElementById('favClose');
const favSearchBarEl = document.getElementById('favSearchBar');

// ONDE a lista da tela atual é desenhada. Os Favoritos viraram gaveta na v5.53,
// e a única coisa que muda para o resto do código é esta: as funções de render
// (`renderLibrary`, `renderFolderList`, `renderVirtualFolders`…) continuam as
// mesmas, escrevendo no host que esta função devolve. Duplicá-las para a gaveta
// seria manter duas listas de favoritos que divergiriam no primeiro ajuste.
function listHost() {
  return activeTab === 'folders' ? favListEl : libraryEl;
}
const listTitleEl = document.getElementById('listTitle');
const appVersionEl = document.getElementById('appVersion');

// ===== Índices de versão (base web × shell nativo) =====
// Os dois atualizam por caminhos INDEPENDENTES — a base web chega por OTA
// (bundle publicado em `web-latest`, aplicado no lançamento seguinte) e o
// shell só muda instalando um APK novo. Por isso são exibidos à parte: ver
// "Web v4.87" com "Shell v1.5" diz na hora que o OTA chegou mas o APK não
// (ou o contrário). Manter WEB_VERSION igual a `version` em version.json —
// é ela que dispara (ou não) a atualização nos aparelhos.
const WEB_VERSION = '5.148';

// Escrita UMA vez, na carga: o indicador mora no rodapé de Configurações desde
// a v5.49 e não depende mais de qual aba está aberta (no cabeçalho ele
// aparecia só no Cronograma, o que era em si uma inconsistência — o mesmo
// metadado existindo ou não conforme a tela). `__SHELL_NAME__` é publicada por
// `native.js`, que roda antes deste arquivo.
function renderVersionLabel() {
  // __SHELL_NAME__ = versionName do APK (ver native.js). Vazio no navegador e
  // em shells anteriores ao `appVersion()` — aí sai só a versão da base web.
  const shell = window.__SHELL_NAME__;
  appVersionEl.textContent = shell
    ? 'Web v' + WEB_VERSION + ' · Shell v' + shell
    : 'Controle v' + WEB_VERSION;
  appVersionEl.title = shell
    ? 'Base web v' + WEB_VERSION + ' (atualiza por OTA) · shell nativo v' + shell + ' (atualiza instalando o APK)'
    : 'Base web v' + WEB_VERSION;
}

renderVersionLabel();

// TOCAR NA VERSÃO PROCURA ATUALIZAÇÃO (v5.136 · shell 31). Não é um botão novo:
// é o mesmo rótulo que já responde "que versão estou usando?" respondendo
// também "e tem uma mais nova?". As duas perguntas são a mesma conversa, e o
// alvo já estava na tela.
//
// Ele existe porque a procura automática, por mais agressiva que seja, tem um
// piso de tempo — e o operador que ACABOU de publicar uma correção não quer
// esperar piso nenhum. `forcar` pula o piso; é o único chamador que o faz.
if (appVersionEl && window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 31) {
  appVersionEl.classList.add('tocavel');
  appVersionEl.title += ' — toque para procurar atualização';
  appVersionEl.addEventListener('click', () => {
    AVNative.otaCheck(true);
    // `avisar`, não `flash`: o flash é no-op desde que o toast saiu, e esta
    // resposta é o ÚNICO sinal de que o toque fez alguma coisa.
    avisar('Procurando atualização…');
    // A busca é rede: o desfecho chega pelo empurrão do shell (`__avOta`) ou
    // pela enquete. Estas duas consultas antecipadas existem para o caso em que
    // não HÁ nada novo — aí não há empurrão nenhum, e sem elas o toque ficaria
    // sem resposta até a enquete seguinte.
    setTimeout(() => atualizarProcura(false), 4000);
    setTimeout(() => atualizarProcura(true), 12000);
  });
}
// Relê o estado da procura e, se houver algo, oferece. `anunciar` só na ÚLTIMA
// das duas consultas: as duas dizendo "já está na mais recente" seriam dois
// avisos para uma pergunta. (O parâmetro NÃO pode se chamar `avisar`: ele
// sombrearia a função global de aviso, que é justamente quem fala aqui.)
async function atualizarProcura(anunciar) {
  try { otaDiagTexto = await AVNative.otaDiag(); } catch (_) { /* shell antigo */ }
  // O TOQUE DESFAZ A RECUSA. "Depois" silencia o aviso AUTOMÁTICO desta sessão
  // (regra 2 do bloco abaixo); ele não pode silenciar o operador que voltou
  // para pedir a atualização de propósito.
  otaRecusadas.clear();
  await ofertarAtualizacao();
  if (anunciar && !otaPendenteVersao) avisar('Você já está na versão mais recente.');
}


const selbarEl = document.getElementById('selbar');
const selCountEl = document.getElementById('selCount');
const selCancelEl = document.getElementById('selCancel');
const selPlaylistEl = document.getElementById('selPlaylist');
const selFavEl = document.getElementById('selFav');
const selFolderEl = document.getElementById('selFolder');
const favHeadBtnEl = document.getElementById('favHeadBtn');
const selRenameEl = document.getElementById('selRename');
const selDeleteEl = document.getElementById('selDelete');

const backBtnEl = document.getElementById('backBtn');
const addDirBtnEl = document.getElementById('addDirBtn');
const libSearchEl = document.getElementById('libSearch');
const fadePopupEl = document.getElementById('fadePopup');
const fadePopupCloseEl = document.getElementById('fadePopupClose');
const fitSegEl = document.getElementById('fitSeg');
const rotBtnEl = document.getElementById('rotBtn');
const rotLabelEl = document.getElementById('rotLabel');
const lyricsBgSegEl = document.getElementById('lyricsBgSeg');
const wallFileEl = document.getElementById('wallFile');
const wallPickEl = document.getElementById('wallPick');
const wallResetEl = document.getElementById('wallReset');
const diagBoxEl = document.getElementById('diagBox');
const diagCopyEl = document.getElementById('diagCopy');
// Espelho de pixels: a LINHA em Configurações e a FOLHA que ela abre.
const mirrorRowEl = document.getElementById('mirrorRow');
const mirrorRowHintEl = document.getElementById('mirrorRowHint');
const mirrorOpenBtnEl = document.getElementById('mirrorOpenBtn');
const mirrorPopupEl = document.getElementById('mirrorPopup');
const mirrorCloseEl = document.getElementById('mirrorClose');
const mirrorLeadEl = document.getElementById('mirrorLead');
const mirrorAddrEl = document.getElementById('mirrorAddr');
const mirrorUrlEl = document.getElementById('mirrorUrl');
const mirrorPinEl = document.getElementById('mirrorPin');
const mirrorModeSegEl = document.getElementById('mirrorModeSeg');
const mirrorAutoEl = document.getElementById('mirrorAuto');
const mirrorListEl = document.getElementById('mirrorList');
const mirrorToggleEl = document.getElementById('mirrorToggle');
const mirrorScanEl = document.getElementById('mirrorScan');
const qrPopupEl = document.getElementById('qrPopup');
const qrCloseEl = document.getElementById('qrClose');
const qrVideoEl = document.getElementById('qrVideo');
const qrMsgEl = document.getElementById('qrMsg');
const songMenuPopupEl = document.getElementById('songMenuPopup');
const songMenuTitleEl = document.getElementById('songMenuTitle');
const songMenuListEl = document.getElementById('songMenuList');
const songMenuCloseEl = document.getElementById('songMenuClose');
const folderPopupEl = document.getElementById('folderPopup');
const folderPickerListEl = document.getElementById('folderPickerList');
const folderPopupCloseEl = document.getElementById('folderPopupClose');
const newFolderInPickerBtnEl = document.getElementById('newFolderInPickerBtn');

const hymnSearchBtnEl = document.getElementById('hymnSearchBtn');
const hymnSearchPopupEl = document.getElementById('hymnSearchPopup');
const hymnSearchCloseEl = document.getElementById('hymnSearchClose');
const hymnSearchTotalEl = document.getElementById('hymnSearchTotal');
const hymnSearchInputEl = document.getElementById('hymnSearchInput');
const hymnResultsEl = document.getElementById('hymnResults');
const hymnSearchTitleEl = document.getElementById('hymnSearchTitle');
const bibleVerPopupEl = document.getElementById('bibleVerPopup');
const bibleVerListEl = document.getElementById('bibleVerList');
const bibleVerCloseEl = document.getElementById('bibleVerClose');
// Escopo da busca/lista: null = busca global no acervo (botão de lupa);
// coll.id = lista de músicas de UMA coleção (toque no card do álbum).

// Só entradas COM chamador (limpeza da auditoria 2026-08: saíram prev, stop,
// next, edit, close, plAdd, schedule e back, todas sem um único uso — o único
// acesso dinâmico é `ICON[coll.iconKey]`, e `iconKey` só assume 'music' ou
// 'queue').
const ICON = {
  play: '', // play_arrow
  pause: '', // pause
  // Nomes pelo GLIFO, não pelo estado: os botões passaram a mostrar a AÇÃO
  // (ver renderControls), então "viewOn" apareceria justamente com a view
  // desligada — o nome mentiria.
  image: '',    // image
  imageOff: '', // image_not_supported
  volOn: '', // volume_up
  volOff: '', // volume_off
  music: '', // music_note
  broken: '', // broken_image
  del: '', // delete
  import: '', // folder_open
  repeatAll: '', // repeat
  repeatOne: '', // repeat_one
  shuffle: '', // shuffle
  drag: '', // drag_indicator
  // ADICIONAR AO CRONOGRAMA fica na família do TEMPO (`more_time`, um
  // relógio com "+", v5.110): o `playlist_add` que o botão usava era um
  // borrão ao lado do `queue_music` da playlist — a mesma pilha de linhas
  // com outra marquinha no canto. O relógio não tem linha nenhuma e diz o que
  // a lista é: a ORDEM do culto, não uma fila de reprodução.
  cronoAdd: '', // more_time    — ao Cronograma
  add: '',      // add          — "a uma lista" (a folha escolhe qual)
  plRemove: '', // playlist_remove
  queue: '', // queue_music
  folder: '',    // folder
  // Favoritos: os atalhos são marcados com estrela, não com pasta — a seção
  // deixou de ser "onde os arquivos ficam" e passou a ser "o que eu marquei".
  star: '',      // star
  folderNew: '', // create_new_folder
};

const REPEATS = ['off', 'all', 'one', 'shuffle'];

// ===== estado =====
let plItems = [];          // mídias da playlist (ordenadas)
let libItems = [];         // mídias da aba ativa
let currentItem = null;    // registro da mídia atual (mesmo que não esteja na aba visível)
let currentId = null;
let view = 'visual';
let muted = false;
let volume = 1;
let playing = false;
// Declarado AQUI, junto do resto do estado, e não ao lado dos listeners da
// barra (onde nasceu): `pushNowPlaying` o lê, e um `let` só é acessível depois
// da linha que o declara. Com o arquivo inteiro entre um e outro, qualquer
// render disparado durante a carga viraria um ReferenceError — e só no app,
// porque no navegador `pushNowPlaying` retorna antes de chegar nele.
let seeking = false;      // operador arrastando a barra de progresso
let repeat = 'all';
let activeTab = 'imports';
let selectionMode = false;
const selected = new Set();
// Miniaturas blob→object URL, POR HOST de lista: a revogação era uma lista
// única cruzando os dois hosts (`libraryEl` × a gaveta de Favoritos) —
// redesenhar um revogava as URLs ainda EM USO no outro, e as miniaturas de lá
// viravam ícone quebrado. Cada host revoga só o que ele próprio criou, no
// redesenho dele (ver renderLibrary).
const thumbUrlsPorHost = new Map(); // host -> [urls do último render dele]
let thumbUrlsAtual = [];            // o balde do render em curso
let currentFolder = null; // null | {id, name, _opfs?} — pasta aberta (persiste entre trocas de aba)
let folders = [];          // [{id, name}, ...] — atalhos (organização opcional)
let folderCounts = {};     // {folderId: count}
// FAVORITOS: os ids marcados, numa lista plana. É um Set em memória porque a
// pergunta que a tela faz o tempo todo é "este item está favoritado?", uma vez
// por linha desenhada; no banco ele é a lista `favs` (ver LISTS em db.js), que
// é o que faz a estrela segurar o blob contra o gc.
let favSet = new Set();
let favItems = [];         // os registros, para a seção de Favoritos da gaveta
let opfsFolders = [];      // [{id, name, count, syncedAt, handle?}] — pastas sincronizadas no OPFS
let folderQuery = '';      // filtro de busca dentro de pasta OPFS
let syncBusy = false;      // sincronização em andamento
// Transições visuais são INERENTES ao sistema (sempre ligadas, duração fixa) —
// não há opção de desligar nem ajustar. Fade in/out em toda troca visual:
// mídia, cortina do wallpaper (view toggle), letra e texto bíblico.
const fadeCfg = createStage.FADE; // fonte única, compartilhada com o Display
// ===== Coleções de mídia do LouvorJA (acervo offline) =====
// Sistema genérico que cobre TODAS as coleções do banco público do LouvorJA
// (ver docs/FONTE-DE-DADOS-LOUVORJA.md e a seção "Coleções de mídia (LouvorJA)"
// no CLAUDE.md). Cada coleção vira um card na aba Álbuns e uma pasta OPFS
// própria (folders/<coll.id>/), com sincronizar/atualizar/excluir e busca — o
// mesmo mecanismo que antes era exclusivo do Hinário 2022, agora parametrizado
// por coleção.
//
// Dois tipos de coleção:
//  - 'hymnal' (fixas): um arquivo de LISTA do banco (pt_hymnal / pt_hymnal_1996)
//    já é o índice completo de hinos. Sempre visíveis; o índice leve é
//    atualizado sozinho (autoRefreshCollections).
//  - 'album' (dinâmicas): descobertas em pt_categories (um card por álbum do
//    banco). O índice de cada álbum vem de album_{id}.musics e é buscado
//    automaticamente (autoRefreshCollections, fase 2 — só metadados), com
//    concorrência limitada e TTL (ALBUM_INDEX_TTL), pra a busca cobrir todo o
//    acervo mesmo sem nada baixado.
//
// O himnário em espanhol e demais idiomas ficam de fora naturalmente: só
// consumimos arquivos 'pt_*' (ver COLLECTION_LOCALE).
const COLLECTION_LOCALE = 'pt';
// Quantas requisições manter em voo ao mesmo tempo.
//
// 6 não é chute: é o teto de conexões simultâneas POR HOST do motor do WebView
// em HTTP/1.1. Medido no Chromium com um servidor de latência (36 arquivos de
// 400 KB, 250 ms de RTT cada), mediana de 3 rodadas:
//
//     concorrência   tempo    ganho    pico real de conexões
//              3     3,24s    (base)          3
//              6     1,77s     +82%           6
//              8     1,71s     +89%           6      ← trava em 6
//             12     2,05s     +58%           6
//             24     1,77s     +83%           6
//
// Ou seja: de 3 para 6 o download quase DOBRA; acima de 6 o navegador
// simplesmente enfileira e não há ganho nenhum — só mais Blobs em memória ao
// mesmo tempo. Como cada música é baixada de forma sequencial (metadados →
// capa → Cantado → Playback), a concorrência do laço é exatamente o número de
// conexões, então este é o parâmetro que importa.
//
// Pelo mesmo motivo NÃO se ganha nada paralelizando álbuns entre si: o limite
// é por HOST, não por álbum — dois álbuns com 3 cada dariam as mesmas 6
// conexões, com progresso fragmentado e mais estado concorrente de brinde.
const NET_CONCURRENCY = 6;

const HYMNAL_2022_ID = 'hymnal-2022'; // == pasta OPFS legada; preserva downloads já feitos
const FIXED_COLLECTIONS = [
  { id: HYMNAL_2022_ID, name: 'Hinário Adventista 2022', kind: 'hymnal', source: Louvorja.HYMNAL_2022_FILE, iconKey: 'music' },
  { id: 'hymnal-1996',  name: 'Hinário Adventista 1996', kind: 'hymnal', source: Louvorja.HYMNAL_1996_FILE, iconKey: 'music' },
];
// Índice (metadados leves) de cada coleção, por coll.id → { indexSyncedAt,
// songs:[{ id_music, track, name, duration, has_instrumental_music,
// fileIdFull, fileIdPlayback }] }. Fonte de verdade em memória (carregada no
// init por loadCollections); persistida em state 'coll:<id>'.
let collState = {};
// Catálogo de álbuns (state 'albumCatalog') — a HIERARQUIA do banco, não uma
// lista achatada: `{ categories: [{ id_category, name, order, albums: [...] }],
// albums: [{ id_album, name, color }] }`.
//
// O banco do LouvorJA organiza o acervo em **categoria → álbum → música**, e é
// só isso: não existe grupo acima da categoria nem subcategoria (confirmado no
// código do app-ja, ver docs/FONTE-DE-DADOS-LOUVORJA.md §5.5). A relação
// categoria↔álbum é **N:N** — o mesmo álbum aparece em mais de uma categoria —,
// e `subtitle`/`order` são campos do PIVÔ: mudam conforme a categoria em que o
// álbum está sendo mostrado. Por isso a lista de categorias é preservada
// inteira aqui, e `albums` é só o índice deduplicado que dá identidade a cada
// card (é ele que vira `coll.id`).
//
// Antes guardávamos apenas `[{id_album, name}]` achatado — o que jogava fora
// exatamente a classificação que o operador precisa para achar um álbum.
let albumCatalog = { categories: [], albums: [] };
// Registro completo de coleções: hinários fixos + um card por álbum do catálogo.
// `subtitle`/`order` NÃO entram aqui: são do pivô categoria↔álbum e só fazem
// sentido no contexto de uma categoria (ver renderCollectionsList).
function allCollections() {
  const cols = FIXED_COLLECTIONS.slice();
  for (const a of albumCatalog.albums) {
    cols.push({ id: 'album-' + a.id_album, name: a.name, kind: 'album',
      source: 'album_' + a.id_album, albumId: a.id_album, iconKey: 'queue',
      color: a.color || null });
  }
  return cols;
}
function collSongs(id) { return (collState[id] && collState[id].songs) || []; }

// ===== Bíblia (acervo online, baixado na 1ª vez que for usado) =====
// Ver bible.js (window.Bible) e a seção "Bíblia" no CLAUDE.md. A seleção é uma
// "tabela periódica" em três telas (livros → capítulos → versículos); a
// estrutura dos livros é offline (Bible.BOOKS), só o TEXTO de cada capítulo
// (e a lista de versões/livros com ids reais) vem da rede.
let bibleScreen = 'books';       // 'books' | 'chapters' (capítulo + versículo) | 'reading'
let bibleVersions = [];          // [{ id, name }] baixadas (state 'bibleVersions')
let bibleBooksOnline = null;     // [{ id, name }] do banco (state 'bibleBooks') — casa o id_bible_book real
let bibleVersionId = null;       // versão selecionada (state 'bibleVersion')
let bibleSel = { bookIdx: -1, chapter: 0 }; // seleção em andamento
let bibleChapterData = null;     // { verses:[{n,text}] } do capítulo aberto na tela de versículos
let bibleChapterLoading = false; // baixando o capítulo agora?
let bibleChapterError = '';      // mensagem de falha (sem rede etc.)
let bibleLoadSeq = 0;            // descarta downloads de capítulo obsoletos (troca rápida)
// Sessão de leitura ativa (texto projetado): { versionId, bookIdx, bookId,
// bookName, chapter, verses, idx }. null = nenhum texto bíblico em cena.
let bibleSession = null;
// Download da versão INTEIRA (todos os capítulos) — progresso em memória:
// { versionId, total, done, running, seq }. null = nenhum download em andamento.
// `seq` (contra `bibleDlSeq`) é o que identifica a varredura: comparar
// `versionId` é REVERSÍVEL — A→B→A ressuscitava os workers da primeira.
let bibleDl = null;
let bibleDlSeq = 0;
// Versões já totalmente baixadas (offline) — cache em memória de
// state['bibleComplete:<v>'], pra a tela de livros mostrar "completa" sem async.
const bibleCompleteVersions = new Set();

// ===== Mensagens (texto puro personalizado) =====
// Fonte "mensagem" da Camada de Texto: textos curtos que o operador salva e
// projeta (avisos, versículos avulsos, etc.). Cada mensagem é um slide.
// Persistido em state 'messages'. msgSession espelha bibleSession (idx dentro
// da lista + projecting) — passa/volta com os mesmos botões de slide.
let messages = [];       // [{ id, text }]
let msgSession = null;   // { idx, projecting } | null

// ===== Letra avulsa (projetar a letra SEM tocar a música) =====
// Uma quinta fonte da Camada de Texto, ao lado de Bíblia, Mensagem, cronômetro
// e sorteio — e a única que nasce no acervo. Serve o caso em que a congregação
// canta ao vivo (instrumentistas na frente, ou hino sem gravação no aparelho):
// o telão precisa da letra, e não pode ter um áudio tocando por cima nem trocar
// de estrofe sozinho no tempo da gravação.
//
// É por isso que ela NÃO é uma terceira variante de `playSongVariant`: uma
// variante toca um arquivo, e aqui não há arquivo nenhum — a letra vem do
// acervo de letras (`songLyricStanzas`), que existe mesmo para músicas nunca
// baixadas. A passagem de estrofe é do operador, pelos mesmos ⏮/⏭ que já
// passam mensagem e versículo (ver slideTarget).
let lyricSession = null;  // { title, stanzas: [string], idx, projecting } | null
// id_bible_book real do livro no índice `idx` de Bible.BOOKS: usa o id da lista
// online (mesma ordem canônica) quando baixada; senão cai no índice+1.
function bibleBookId(idx) {
  const b = bibleBooksOnline && bibleBooksOnline[idx];
  return (b && b.id != null) ? b.id : (idx + 1);
}

// Estado transitório de UI por coleção (não persistido): sincronização em
// andamento, mensagem de status e peso (bytes) já baixado.
const collUI = {};
function ui(id) { return collUI[id] || (collUI[id] = { syncBusy: false, cancel: false, status: '', statusTimer: null, bytes: 0 }); }

// Estado transitório de UI por GRUPO (categoria, Hinários, Outros): o mesmo
// papel de `collUI`, mas para o download da coleção inteira — ver syncGroup.
const groupUI = {};
function gui(key) {
  return groupUI[key] || (groupUI[key] = { busy: false, cancel: false, status: '' });
}
function setGroupStatus(key, text, autoClearMs) {
  const g = gui(key);
  g.status = text || '';
  clearTimeout(g.statusTimer);
  if (autoClearMs) {
    g.statusTimer = setTimeout(() => { g.status = ''; refreshCollectionsIfVisible(); }, autoClearMs);
  }
  refreshCollectionsIfVisible();
}

// Baixar um GRUPO inteiro: "CDs Oficiais/Ano", "Adoradores", os hinários…
// Um por vez, e não em paralelo: cada `syncCollection` já baixa 3 músicas
// simultâneas, e multiplicar isso por uma dúzia de álbuns saturaria a rede da
// igreja sem terminar nenhum deles antes.
//
// A pergunta de rede é feita UMA VEZ para o lote — perguntar por álbum
// significaria doze diálogos seguidos, que ninguém lê. A resposta é repassada
// a cada `syncCollection` (`allowMobile`), então nenhum deles pergunta de novo.
async function syncGroup(key, label, colls, opts) {
  const g = gui(key);
  // O cancelamento vale a partir da PRÓXIMA MÚSICA, não do próximo álbum: há
  // álbuns de centenas de faixas, e esperar o atual terminar era, na prática,
  // não poder cancelar. `syncCollection` recebe este mesmo sinal e fecha a
  // própria fila (ver lá).
  if (g.busy) { g.cancel = true; setGroupStatus(key, 'Cancelando…'); return; }
  if (!colls.length) return;
  if (!AVDB.opfsSupported()) { setGroupStatus(key, 'OPFS indisponível', 5000); return; }

  // "Todo o acervo" confirma SEMPRE, mesmo no Wi-Fi: são milhares de músicas e
  // vários GB no aparelho. A pergunta de rede (abaixo) é sobre o plano de
  // dados; esta é sobre a escala, e as duas são perguntas diferentes.
  if (opts && opts.confirmScale) {
    let songs = 0, est = 0;
    for (const c of colls) {
      const pend = faltamNaColecao(c.id);
      songs += pend;
      est += estimatePendingBytes(c);
    }
    // "Nada pendente" NÃO é "já completo" (v5.135): um álbum SEM ÍNDICE tem
    // zero variantes faltando pela conta — ele não tem lista nenhuma —, e essa
    // era a resposta na janela em que o `autoRefreshCollections` ainda não
    // indexou o acervo. O botão de baixar TUDO respondia "Já completo" e não
    // fazia nada. Quem sabe a diferença é `grupoCompleto`, que exige índice.
    if (grupoCompleto(colls)) { setGroupStatus(key, 'Já completo', 5000); return; }
    // Sem índice ainda não há o que contar, e "0 músicas" seria uma promessa
    // errada dos dois jeitos possíveis (nem "nada a fazer", nem um tamanho).
    const escala = songs
      ? ', com ' + songs + ' música(s) ainda não baixada(s)'
        + (est ? ', aproximadamente ' + fmtBytes(est) : '')
      : '. As listas ainda estão sendo carregadas, então o tamanho só aparece depois';
    const ok = await appConfirm({
      title: 'Baixar toda a biblioteca?',
      // O tamanho sai da mesma medida do álbum avulso (ver `medirColecao`).
      message: 'São ' + colls.length + ' coleções' + escala + '.'
        + '\n\nO download continua com o app minimizado, mostra o progresso na notificação '
        + 'e pode ser cancelado a qualquer momento.',
      okText: 'Baixar tudo', cancelText: 'Agora não',
    });
    if (!ok) return;
  }

  let allowMobile = true;
  if (!isConfirmedWifi()) {
    // Estimativa do lote pela mesma medida do álbum avulso (ver
    // `medirColecao`): duração do que falta × a taxa medida no aparelho.
    let est = 0;
    for (const coll of colls) est += estimatePendingBytes(coll);
    allowMobile = await appConfirm({
      title: 'Baixar usando dados móveis?',
      message: 'Você não está numa rede Wi-Fi confirmada. Baixar "' + label + '" são '
        + colls.length + ' álbum(ns)' + (est ? ', aproximadamente ' + fmtBytes(est) : '')
        + '.\n\nEsta escolha vale só para este download, agora.',
      okText: 'Usar dados móveis', cancelText: 'Só no Wi-Fi',
    });
    if (!allowMobile) { setGroupStatus(key, 'Aguardando Wi-Fi', 5000); return; }
  }

  g.busy = true; g.cancel = false;
  setGroupStatus(key, 'Preparando…');
  renderCollectionsNow(); // resposta ao toque é imediata; só o progresso é coalescido
  try {
    // O lote inteiro conta como UMA tarefa de segundo plano: sem isso o
    // serviço seria desligado no fim de cada álbum e o processo podia ser
    // congelado justamente entre um e outro.
    // A notificação acompanha o LOTE, não cada álbum: o total é a soma das
    // músicas que faltam em todos eles, contada uma vez no começo. Reiniciar a
    // barra a cada álbum daria doze barras curtas em vez de uma que informa
    // quanto falta de verdade.
    let totalPend = 0;
    for (const coll of colls) totalPend += faltamNaColecao(coll.id);
    let batchDone = 0;
    let semRede = 0;   // álbuns que nem chegaram a baixar (índice/rede falhou)
    const notifId = bgTaskStart(label, Math.max(1, totalPend));
    // `bgTaskEnd` DENTRO do `withBgWork`, não num `finally` externo: o
    // `finally` de `withBgWork` roda ANTES do de fora, e é ele que solta o
    // serviço e limpa o registro de tarefas — encerrar a tarefa depois disso
    // chegava sempre tarde demais (ver bgWorkEnd). Encerrar a tarefa primeiro
    // e só então soltar o serviço é a ordem que syncDeviceFolder já tinha.
    await withBgWork(async () => {
      try {
        for (let i = 0; i < colls.length; i++) {
          if (g.cancel) break;
          const coll = colls[i];
          // SEM O NOME DO ÁLBUM. Este texto cai num chip estreito (o cabeçalho
          // do acervo, ou a linha de um grupo), e nome de álbum não tem largura
          // previsível — "Álbum 3/12 · Arautos do Rei…" empurrava o ✕ do popup
          // para fora da tela. Quem diz QUAL álbum está baixando é o card dele
          // (`setCollStatus`, logo abaixo) e a notificação (`bgTaskStep`, na
          // linha seguinte, que continua levando o nome).
          setGroupStatus(key, 'Álbum ' + (i + 1) + '/' + colls.length);
          bgTaskStep(notifId, batchDone, label + ' · ' + coll.name);
          const r = await syncCollection(coll, {
            allowMobile: true,
            notifOwned: true,                     // a tarefa da notificação é do lote
            notifTaskId: notifId,                 // …e é nela que os nomes entram
            fromGroup: true,                      // não é "o operador tocou de novo" (ver syncCollection)
            cancelled: () => g.cancel,            // o cancelamento atravessa o álbum
            onSong: () => bgTaskStep(notifId, ++batchDone),
          });
          if (r && !r.ok) semRede++;
        }
      } finally { bgTaskEnd(notifId); }
    });
    // Sem rede, `fetchCollectionIndex` lança em cada álbum e o laço inteiro
    // termina em segundos sem baixar nada. Anunciar "Coleção completa" em
    // verde ali mandava o operador embora convencido de que o acervo estava
    // no aparelho — o status por álbum existe, mas fica dentro de um card
    // colapsado e se autolimpa. O cabeçalho, que é o que ele está olhando,
    // agora conta as falhas.
    setGroupStatus(key, g.cancel ? 'Cancelado'
      : semRede ? semRede + (semRede > 1 ? ' álbuns' : ' álbum') + ' sem rede'
      : 'Completo', 5000);
  } catch (_) {
    setGroupStatus(key, 'Erro no download', 6000);
  } finally {
    g.busy = false; g.cancel = false;
    refreshCollectionsIfVisible();
  }
}

// Indicador de sincronização de uma coleção — subtítulo no card
// (renderCollectionCard). autoClearMs limpa sozinho (mensagens finais/erro);
// durante o progresso fica até a próxima chamada. Substitui o toast flutuante.
function setCollStatus(id, text, autoClearMs) {
  const u = ui(id);
  u.status = text || '';
  clearTimeout(u.statusTimer);
  if (autoClearMs) {
    u.statusTimer = setTimeout(() => { u.status = ''; refreshCollectionsIfVisible(); }, autoClearMs);
  }
  refreshCollectionsIfVisible();
}
// Peso (bytes) do que uma coleção OCUPA NO APARELHO — medido na pasta OPFS
// dela, arquivo por arquivo.
//
// Ainda assim não é para chamar de dentro de um render de lista: é IO, e a aba
// Álbuns tem dezenas a centenas de cards. O valor é mantido incrementalmente em
// `downloadCollectionFile` e reconferido onde é barato e necessário: ao ABRIR o
// popup de opções, ao TERMINAR uma sincronização e depois de apagar arquivos
// (exclusão de coleção/registros), onde a conta muda em bloco.
async function updateCollBytes(id) {
  try {
    // PELO DISCO, não pelo catálogo (v5.134). O catálogo só conhece os ÁUDIOS:
    // as imagens de fundo da letra são gravadas na mesma pasta OPFS e não viram
    // registro (elas são referenciadas de dentro dos slides, não são mídia da
    // biblioteca). Somando o catálogo, portanto, a conta ignorava centenas de MB
    // num hinário inteiro — e o comentário da medição afirmava justamente o
    // contrário, que a taxa "amortiza sozinha o que não é áudio". Não
    // amortizava: esses bytes nunca entraram em conta nenhuma.
    //
    // E é MAIS BARATO: perguntar o tamanho de cada arquivo não desserializa
    // nada, enquanto o `getAll` do catálogo trazia thumbnail e letra inteira de
    // cada faixa só para somar um campo.
    const total = await AVDB.opfsFolderSize('folders/' + id);
    const u = ui(id);
    pesoConferido.add(id);
    if (total !== u.bytes) { u.bytes = total; salvarPesos(); refreshCollectionsIfVisible(); }
  } catch (_) { /* sem pasta ainda — peso fica 0 */ }
}

// O peso medido PERSISTE (v5.93). `collUI` é estado de sessão, e até aqui o
// peso de um álbum só existia depois de o operador abrir as opções dele —
// bastava fechar o app para o número sumir. Agora ele aparece na barra do card
// de todo álbum completo, e recontar o catálogo de cada um a cada abertura é
// caro do jeito descrito acima (um `getAll` que desserializa thumbnail e letra
// de centenas de registros). Guardado em `state`, ele nasce pronto.
const PESO_KEY = 'coll-bytes';
const pesoConferido = new Set();   // ids já recontados nesta sessão
let pesoTimer = null;

async function carregarPesos() {
  const mapa = (await AVDB.getState(PESO_KEY)) || {};
  for (const id of Object.keys(mapa)) {
    const n = mapa[id];
    if (typeof n === 'number' && n > 0) ui(id).bytes = n;
  }
}
// Escrita coalescida: o contador sobe a cada arquivo baixado, e gravar o mapa
// inteiro por música seria uma transação de IDB por download.
function salvarPesos() {
  clearTimeout(pesoTimer);
  pesoTimer = setTimeout(() => {
    const mapa = {};
    for (const id of Object.keys(collUI)) {
      const n = collUI[id].bytes;
      if (n > 0) mapa[id] = n;
    }
    AVDB.setState(PESO_KEY, mapa);
  }, 1500);
}
// Conferência sob demanda do peso guardado. A recontagem roda UMA vez por
// sessão e por álbum — o `pesoConferido` é o que impede o
// `refreshCollectionsIfVisible` de dentro dela de virar laço.
function conferirPesoSeFaltar(id) {
  if (pesoConferido.has(id)) return;
  // UMA VEZ POR SESSÃO, TENHA ELE PESO OU NÃO (v5.134). Antes a reconferência
  // só acontecia com o peso ZERADO, e o efeito era que um número errado nunca
  // se corrigia: o acumulador só sobe (`bytes +=` a cada arquivo), então
  // qualquer divergência — arquivos apagados por fora, um download contado duas
  // vezes, as imagens que nunca entraram na conta — ficava gravada para sempre
  // em `state`, e reaparecia a cada abertura. Com a medida vindo do disco (ver
  // `updateCollBytes`) a reconferência ficou barata o suficiente para ser a
  // regra, não a exceção.
  if (countDownloaded(id) === 0 && ui(id).bytes === 0) return;
  pesoConferido.add(id);
  // UM DE CADA VEZ. Na primeira abertura depois da atualização, todos os álbuns
  // com download entram aqui no mesmo render — e cada recontagem varre a pasta
  // OPFS da coleção arquivo a arquivo (`opfsFolderSize`, v5.134 — barata, mas
  // não grátis em centenas de faixas). Em série isso vira trabalho de fundo;
  // em paralelo, um engasgo na lista.
  filaPeso = filaPeso.then(() => updateCollBytes(id)).catch(() => {});
}
let filaPeso = Promise.resolve();
// ===== MEDIÇÃO DO PESO DE UM ÁLBUM =====
// São DUAS perguntas, e só uma delas tem resposta exata:
//
//   1. quanto já está NO APARELHO — soma do tamanho real dos arquivos na pasta
//      OPFS da coleção. É EXATO, e inclui tudo o que o download traz: os áudios
//      Cantado e Playback, a capa e as imagens de fundo da letra. Medir a PASTA,
//      e não o catálogo, é o que faz essa frase ser verdadeira (v5.134): as
//      imagens de fundo não viram registro de mídia, então a soma do catálogo
//      deixava de fora justamente a parte que ninguém consegue estimar.
//   2. quanto pesa o ÁLBUM INTEIRO — o que falta ainda não veio, então é
//      ESTIMATIVA. O "~" na tela é parte da informação, não enfeite.
//
// A estimativa é por DURAÇÃO, não por contagem de faixas (que era o método até
// a v5.92). Áudio é bytes por segundo: num hinário as faixas têm durações
// parecidas e os dois métodos empatam, mas num álbum com um louvor de 2 min ao
// lado de um louvor de 9 a média por faixa erra feio, e erra logo na pergunta
// que o operador faz antes de gastar dados móveis. A duração vem do índice que
// o app já tem (`duration`, "HH:MM:SS" — ver docs/FONTE-DE-DADOS-LOUVORJA.md).
//
// A TAXA é MEDIDA no próprio aparelho: bytes no disco ÷ segundos baixados.
// Isso amortiza sozinho o que não é áudio (capas e imagens de letra pesam, e as
// faixas que faltam também trarão as suas) e acompanha o bitrate real do
// acervo, em vez de fixar um número que envelhece. Só passou a ser verdade na
// v5.134: enquanto o numerador vinha do catálogo, os bytes das imagens não
// estavam nele, e a taxa medida era a do áudio puro — o que a fazia
// SUBESTIMAR sistematicamente tudo o que ela projetava.
//
// A ordem das fontes vai da mais específica para a mais genérica: a taxa DESTE
// álbum, depois a média de tudo o que já foi baixado no aparelho, e só então a
// constante — 128 kbps, que é o que o LouvorJA serve. Sem essa escada, um
// álbum ainda vazio não teria tamanho nenhum a mostrar, que é exatamente
// quando a informação é mais útil.
const BPS_PADRAO = 16000;          // 128 kbps ≈ 16 KB/s
const SEG_PADRAO = 210;            // 3min30 — só para faixa sem duração no índice

function segundosDaMusica(s) { return parseTimeToSeconds(s && s.duration) || 0; }

// O levantamento bruto de uma coleção: quantas VARIANTES (Cantado + Playback)
// já estão no aparelho, quantas faltam, quantas NÃO EXISTEM na origem, e os
// segundos de cada lado. As sem duração no índice são contadas à parte — elas
// existem (índices antigos, ou um `duration` vazio na origem) e somá-las como
// zero segundo faria o álbum parecer menor do que é.
//
// ESTA É A FONTE ÚNICA DE "COMPLETA" (v5.134), e ela não existia: a mesma
// pergunta era respondida em QUATRO lugares por `countDownloaded(id) >=
// collSongs(id).length` — uma conta de MÚSICAS, enquanto o download busca
// VARIANTES e a medida de peso já contava variantes. As duas respostas
// divergiam sozinhas, e a tela mostrava as duas ao mesmo tempo.
//
// E havia um caso que nenhuma das duas resolvia: uma música cuja origem NÃO TEM
// áudio (`url_music` vazio no `music_{id}`). Ela nunca ganha `fileIdFull`,
// então a coleção nunca ficava completa, o botão de baixar não sumia NUNCA, e
// cada sincronização voltava a buscar o metadado dela para descobrir de novo
// que não há o que baixar. Agora o app marca (`semAudio`/`semPlayback`, ver
// `ensureSongVariant`) e para de contá-la como pendente: "não existe" e "não
// baixei ainda" deixaram de ser a mesma coisa.
// ===== Memoização por PASSADA de render =====
// `levantarColecao` varre todas as músicas de uma coleção, e `bytesPorSegundo`
// sem taxa própria varre TODAS as coleções chamando `levantarColecao` em cada
// uma — por card, várias vezes por card, a cada redesenho de 400 ms durante
// uma sincronização (`COLL_REFRESH_MS`). Com dezenas de álbuns e milhares de
// faixas isso era O(coleções × músicas) por card para recomputar números que
// não mudaram dentro do MESMO redesenho.
//
// O cache vale só DURANTE uma passada de `renderCollectionsList` (a flag), e é
// zerado no início de cada uma: a passada é síncrona, então nenhum dado muda
// no meio dela — a invalidação é a própria limpeza por passada. Fora de uma
// passada (diálogos de confirmação, laços de sincronização) a conta segue
// fresca, sem cache, porque ali dado velho custaria uma resposta errada.
let cacheColecoesAtivo = false;
const cacheLevantar = new Map();  // id -> resultado de levantarColecao
let cacheBpsGlobal = 0;           // taxa global (o laço por todas as coleções)

function levantarColecao(id) {
  if (cacheColecoesAtivo && cacheLevantar.has(id)) return cacheLevantar.get(id);
  const r = {
    segFeitos: 0, segFalta: 0, feitasSemTempo: 0, faltaSemTempo: 0,
    feitas: 0, falta: 0, semFonte: 0,
  };
  for (const s of collSongs(id)) {
    const d = segundosDaMusica(s);
    // O Playback só conta quando existe: `has_instrumental_music` é o que
    // decide se o download vai buscar a segunda variante. A duração dele não
    // está na lista leve (só em `music_{id}`), e usar a do Cantado é a
    // aproximação certa — é a mesma música.
    const variantes = [
      { tem: !!s.fileIdFull, sem: !!s.semAudio },
      s.has_instrumental_music ? { tem: !!s.fileIdPlayback, sem: !!s.semPlayback } : null,
    ];
    for (const v of variantes) {
      if (!v) continue;
      if (v.tem) { r.feitas++; if (d) r.segFeitos += d; else r.feitasSemTempo++; }
      else if (v.sem) r.semFonte++;
      else { r.falta++; if (d) r.segFalta += d; else r.faltaSemTempo++; }
    }
  }
  if (cacheColecoesAtivo) cacheLevantar.set(id, r);
  return r;
}

// "Esta coleção está completa?" — a pergunta da tela inteira, num lugar só.
// Sem índice não há resposta: um álbum que nunca sincronizou não está completo
// nem incompleto, e o botão ali serve para buscar a lista.
function colecaoCompleta(id) {
  if (!collSongs(id).length) return false;
  return levantarColecao(id).falta === 0;
}

// Quantas VARIANTES ainda faltam — a conta que os diálogos de confirmação e a
// barra da notificação usam. Uma música sem áudio na origem não entra: ela
// nunca vai ser baixada, e prometer "12 músicas" para depois baixar 10 é a
// forma mais barata de parecer quebrado.
function faltamNaColecao(id) { return levantarColecao(id).falta; }

// E a mesma pergunta para um GRUPO (uma categoria, "Toda a biblioteca"): ele
// está completo quando TODAS as suas coleções estão, pela definição de cada
// card. Não por uma soma de músicas — que responderia diferente da linha logo
// abaixo dela, que é o defeito que a v5.134 acabou de fechar nos cards.
//
// Sem índice não conta: uma coleção que nunca sincronizou não está completa, e
// é ela que mantém o botão do grupo na tela — que é exatamente o certo, porque
// ali ainda há o que buscar.
function grupoCompleto(colls) {
  if (!colls || !colls.length) return false;
  return colls.every((c) => colecaoCompleta(c.id));
}

// Bytes por segundo medidos no aparelho (ver a escada acima).
function bytesPorSegundo(id) {
  const u = ui(id);
  const meu = levantarColecao(id);
  if (u.bytes && meu.segFeitos) return u.bytes / meu.segFeitos;
  // A taxa GLOBAL não depende do `id`: dentro de uma passada de render ela é
  // a mesma para todo card sem taxa própria — calcular uma vez basta.
  if (cacheColecoesAtivo && cacheBpsGlobal) return cacheBpsGlobal;
  let bytes = 0, seg = 0;
  for (const c of allCollections()) {
    const cu = collUI[c.id];
    if (!cu || !cu.bytes) continue;
    const l = levantarColecao(c.id);
    if (!l.segFeitos) continue;
    bytes += cu.bytes; seg += l.segFeitos;
  }
  const taxa = (bytes && seg) ? bytes / seg : BPS_PADRAO;
  if (cacheColecoesAtivo) cacheBpsGlobal = taxa;
  return taxa;
}

// A medida completa de um álbum: `{ noAparelho, falta, total, exato }`.
// `exato` só é verdadeiro quando NÃO falta nada — é ele que decide se a tela
// escreve "48 MB" ou "~48 MB", e essa diferença é a honestidade do número.
function medirColecao(id) {
  const u = ui(id);
  const l = levantarColecao(id);
  const bps = bytesPorSegundo(id);
  const falta = Math.round(bps * (l.segFalta + l.faltaSemTempo * SEG_PADRAO));
  const noAparelho = u.bytes || 0;
  return { noAparelho, falta, total: noAparelho + falta, exato: l.falta === 0 };
}

// Quanto, mais ou menos, falta baixar. Mantida como função própria porque é a
// pergunta dos diálogos de confirmação (rede e escala), onde o número precisa
// bater com o que o painel do álbum mostra.
function estimatePendingBytes(coll) { return medirColecao(coll.id).falta; }

// A FRAÇÃO QUE SE LÊ ANTES DE BAIXAR É DE PESO, NÃO DE FAIXAS (v5.94).
//
// "2/4" e "137/600" respondem "quantas já tenho", que é a pergunta de DEPOIS.
// Antes de tocar no botão a pergunta é outra — quanto isto vai custar de dados
// e de espaço —, e para ela a contagem não serve: quatro faixas podem ser 8 MB
// ou 80 MB, e é justamente essa diferença que decide esperar o Wi-Fi. A
// contagem não se perde: ela continua no chip "Sincronizados" das opções do
// álbum, que é onde mora o detalhe.
//
// Serve os três contadores da tela (o card do álbum, o cabeçalho de categoria e
// "Todo o acervo") porque a pergunta é a mesma nos três, e um deles em faixas e
// outro em MB seria a pior das versões.
function fracaoPeso(ids) {
  let no = 0, total = 0, temIndice = false, completo = true;
  for (const id of ids) {
    const faixas = collSongs(id).length;
    if (faixas) temIndice = true;
    // A MESMA `colecaoCompleta` do botão e dos chips. Antes aqui era a conta de
    // músicas e no `medirColecao` (logo abaixo, no mesmo laço!) a de variantes:
    // a barra escrevia "48 MB" — número exato — ao lado de um card que ainda
    // mostrava o botão de baixar.
    if (!colecaoCompleta(id)) completo = false;
    const m = medirColecao(id);
    no += m.noAparelho; total += m.total;
  }
  if (!temIndice || !total) return null;      // sem índice não há o que medir
  // "Completo" é a MESMA definição do resto da tela (`colecaoCompleta`), senão
  // a barra escreveria "~" ao lado de um chip dizendo "Completo offline" —
  // divergem quando um Playback falhou, e duas respostas para a mesma pergunta
  // na mesma tela é pior do que a imprecisão que isso esconde. Com o peso ainda
  // desconhecido (a recontagem de fundo não terminou), cai na estimativa.
  if (completo && no > 0) return fmtBytes(no);
  if (!no) return '~' + fmtBytes(total);      // nada baixado: só o que vai custar
  return fmtFracBytes(no, total);
}

// O miolo comum das duas formas de "tanto de tanto" (`fmtFracBytes` e
// `fmtParBytes`): a unidade só aparece uma vez quando é a mesma nos dois
// números; se divergirem (800 KB de ~1,2 GB), as duas ficam — omitir a
// primeira seria simplesmente falso. O separador é o ÚNICO ponto em que as
// formas diferem, então ele é o parâmetro.
function fmtBytesPar(a, b, sep) {
  const fa = fmtBytes(a);
  const fb = fmtBytes(b);
  const [va, ua] = fa.split(' ');
  const ub = fb.split(' ')[1];
  return (ua === ub ? va : fa) + sep + fb;
}
// "3,7/~18 MB" — a forma curta, para as barras (ver `fmtParBytes`, a forma por
// extenso do chip de opções, que tem largura para o "de").
function fmtFracBytes(a, b) { return fmtBytesPar(a, b, '/~'); }

// Downloads de música em andamento ("<coll.id>:<id_music>" -> Promise) — evita
// disparar dois downloads da mesma música em paralelo (tocar duas vezes rápido).
const songDownloadInFlight = new Map();

// ===== Detecção de rede (Wi-Fi vs dados móveis) =====
// Só afeta a sincronização em MASSA do Hinário 2022 (baixar tudo de uma vez)
// — nunca o download individual disparado por tocar/adicionar um hino
// específico, que é sempre permitido (é exatamente o uso que gera o gasto de
// dados, não um download em massa não solicitado). Network Information API
// (Chrome/Android, onde os dois apps sempre rodam); sem suporte no navegador
// cai em 'unknown', tratado como "Wi-Fi não confirmado" — mais conservador
// (evita presumir Wi-Fi e gastar dados móveis à toa) do que assumir Wi-Fi por
// falta de informação.
function networkConnection() {
  // Só `navigator.connection`: os prefixos moz/webkit eram herança de PWA —
  // este bundle roda em Chromium (WebView/Chrome), onde o nome é o padrão.
  return navigator.connection || null;
}
function networkType() {
  const conn = networkConnection();
  return (conn && typeof conn.type === 'string') ? conn.type : 'unknown';
}
function isConfirmedWifi() {
  const t = networkType();
  return t === 'wifi' || t === 'ethernet';
}
let mediaFit = 'contain'; // preenchimento da mídia (persistido em state 'fit')
// Modo "mesa de som": saída de áudio local — a preview deixa de ser
// forçosamente muda e passa a tocar o som de verdade pelo próprio aparelho.
// Não mexe na comunicação com o Display (comandos continuam normais); se o
// Display nem estiver aberto, ele só não escuta, sem tratamento especial
// disso aqui. Não é persistido: cada abertura do app começa em modo normal
// (preview muda), evitando som inesperado saindo do celular numa sessão nova.
let standalone = false;
let ytEnded = false;       // YouTube terminou/parou sem player tocando: ▶ recarrega
// HÁ MÍDIA EM CENA NO TELÃO? (v5.142)
//
// Não é "existe uma mídia selecionada" — isso é o `currentId`, que sobrevive de
// propósito ao stop e ao fim natural, para o ▶ poder repetir a faixa. É "o telão
// está mostrando esta mídia agora", e as duas coisas divergem em exatamente dois
// pontos: `stopClear` (o operador cobriu o telão) e `resetAfterEnd` (a música
// acabou e nada a seguiu). Nos dois o telão voltou ao wallpaper e o `currentId`
// ficou onde estava.
//
// Faltava uma resposta para essa pergunta, e três defeitos saíram daí:
//
//  1. A RECONEXÃO DO TELÃO reenviava `load` para uma mídia parada, e o telão
//     acordava com um vídeo engatilhado que ninguém pediu — o retângulo cinza
//     com o play, ou o primeiro quadro da música que já tinha acabado.
//  2. O MESMO no fim de cada música: o item continua selecionado, então todo
//     dongle que caísse e voltasse ressuscitava a faixa anterior.
//  3. O ▶ DEPOIS DO STOP decidia por `preview.getCurrent()`, que só fica nulo no
//     FIM do fade de saída do `clearFaded` — meio segundo depois. Tocar play
//     nessa janela mandava um `play` que o `clear` em curso apagava logo em
//     seguida: o botão não fazia nada, e o operador aprendeu a tocar em stop
//     duas vezes para "destravar". Era o fade, não o stop.
//
// Uma variável, três defeitos: o estado que faltava era esse.
let midiaNoAr = false;
let displayAudioBlocked = false; // Display reportou áudio bloqueado pelo navegador
const scrollPos = {};      // posição de scroll por aba/pasta (sessão)

// ===== preview (espelho do display) =====
// Mostra exatamente o que o display mostra; sempre mudo. Recebe os MESMOS
// comandos enviados ao display e ainda comanda a barra de progresso/avanço.
const preview = createStage({
  wallpaper: pvWallEl, img: pvImgEl, video: pvVideoEl, forceMuted: true,
  onTime: previewTick,
  // A PREVIEW É A CANÁRIA da transmissão direta: ela toca o mesmo registro que
  // o telão, na mesma hora, e é aqui — na tela do operador — que uma URL
  // expirada aparece primeiro. Quem recupera é o Controle, porque é ele que
  // tem a ponte (o Display recebe `host = null`) e é ele que manda a cena.
  onStreamErro: (rec, porque) => { recuperarStream(rec, porque); },
  // Display presente é a fonte de verdade do avanço automático: quando ele
  // está ativo, quem avança é o `media-ended` remoto (com guarda de mediaId).
  // Sem este early-return, se o Display chegar ao fim antes da preview (drift
  // até SYNC_DRIFT), os dois disparariam autoAdvance() e pulariam uma faixa.
  // Mesmo princípio de previewTick/ytPreviewTick.
  onEnded: () => {
    // A letra sai de cena junto com a música, esmaecendo (camada paralela: não
    // participa do fade do stage) — e `pvLyricsEnded` impede o slide de capa de
    // reaparecer com o currentTime zerado do replay, logo antes do wallpaper.
    pvLyricsEnded = true;
    if (pvLyrics) pvLayerOut(pvLyricsEl);
    if (displayActive()) return;
    autoAdvance();
  },
  onError: (e) => {
    const code = e.target.error ? e.target.error.code : '?';
    const src = e.target.src ? e.target.src.slice(-60) : '(sem src)';
    flash('Erro ' + code + ': …' + src);
  },
});

// ===== preview do YouTube (player real, mudo, minúsculo) =====
// stage.js não toca YouTube (só mostra a thumbnail) — para ter uma preview
// de verdade aqui, criamos nosso próprio YT.Player, sempre mudo, dirigido
// pelos mesmos comandos que vão para o Display (mesmo padrão do
// display.js, bem simplificado: sem cortina/fade próprios do vídeo, sem
// avanço automático — isso continua vindo do display-status remoto).
let ytPreviewApiPromise = null;
function loadYtPreviewApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytPreviewApiPromise) return ytPreviewApiPromise;
  ytPreviewApiPromise = new Promise((resolve, reject) => {
    const prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prevCb) prevCb(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    // Sem onerror, uma falha de rede no fetch do script deixaria a promise
    // pendente para sempre — e como ela é cacheada, TODA preview YouTube
    // futura travaria. Rejeitar + limpar o cache deixa a próxima tentativa
    // refazer o fetch.
    tag.onerror = () => { ytPreviewApiPromise = null; reject(new Error('YT API load failed')); };
    document.head.appendChild(tag);
  });
  return ytPreviewApiPromise;
}

let ytPreview = null; // { mediaId, player }
let ytPreviewSeq = 0;

// Rampa curta de volume do player da preview do YouTube, usada ao ligar/
// desligar a "mesa de som" — evita o corte abrupto de áudio. Reusa o mesmo
// passo-a-passo/duração do stage.js (createStage.rampSteps/MUTE_RAMP_TIME),
// fonte única compartilhada pelos três sinks de áudio do sistema.
const MUTE_RAMP_TIME = createStage.MUTE_RAMP_TIME;
let ytPreviewRampTimer = null;
// Aplica o mudo real ao FIM da rampa de descida (mesmo papel do muteApplyTimer
// do stage.js e do yt.muteApplyTimer do Display).
let ytPreviewMuteApplyTimer = null;
function ytPreviewRampVolume(from, to, dur) {
  clearInterval(ytPreviewRampTimer);
  const p = ytPreview && ytPreview.player;
  if (!p) return;
  try { p.setVolume(Math.round(Math.min(1, Math.max(0, from)) * 100)); } catch (_) {}
  ytPreviewRampTimer = createStage.rampSteps(from, to, dur, (v) => {
    try { if (ytPreview && ytPreview.player) ytPreview.player.setVolume(Math.round(v * 100)); } catch (_) {}
  });
}

function dropYtPreview() {
  if (ytPreview) {
    clearInterval(ytPreview.qualityTimer);
    clearInterval(ytPreview.tickTimer);
    if (ytPreview.player) { try { ytPreview.player.destroy(); } catch (_) {} }
  }
  clearInterval(ytPreviewRampTimer);
  clearTimeout(ytPreviewMuteApplyTimer);
  ytPreview = null;
  pvYoutubeEl.hidden = true;
  pvYoutubeEl.innerHTML = '';
}

// Pede a menor qualidade disponível: a preview já é minúscula (~150px de
// altura), então isso só reforça o que o YouTube tende a escolher sozinho
// pelo tamanho do player — evita puxar HD à toa num player que ninguém vê em
// tamanho real. Reforçado também por polling (abaixo, não só onReady/
// onPlaybackQualityChange): o iframe agora é renderizado a 400% do wrapper
// e encolhido de volta via CSS (ver controle.css, truque pra deixar a UI do
// YouTube proporcionalmente menor) — o YouTube decide a qualidade padrão
// pelo tamanho do iframe QUE ELE PRÓPRIO enxerga (400%, não o tamanho visual
// já encolhido), então sem reforço contínuo esse truque de UI poderia
// silenciosamente puxar uma qualidade mais alta do que antes.
function ytPreviewForceLowQuality(player) {
  try { if (player.getPlaybackQuality() !== 'tiny') player.setPlaybackQuality('tiny'); } catch (_) {}
}

// `startAt` (segundos) existe para a REMONTAGEM: mover o `#preview` de lugar no
// DOM recarrega o iframe do YouTube e mata o player, então `hostPreview` o
// reconstrói — e reconstruir do zero faria a miniatura voltar ao início de um
// vídeo que segue no telão. Mesmo campo, mesmo nome e mesmo papel do `startAt`
// de `loadYoutube` no Display.
async function loadYtPreview(rec, v, startAt) {
  dropYtPreview();
  const seq = ++ytPreviewSeq;
  // stage.js retorna cedo para kind='youtube' (só marca a thumbnail) e por
  // isso nunca chega na revelação da cortina no fim de load() — cobre aqui
  // à parte, igual o display.js faz para o player real. A thumbnail (posta
  // por preview.handle() em paralelo) fica como placeholder até o player
  // real assumir por cima (mesmo z-index, depois no DOM).
  preview.instantCover(v === 'wallpaper');
  try { await loadYtPreviewApi(); }
  catch (_) { return; }   // API não carregou (rede) — mantém só a thumbnail
  if (seq !== ytPreviewSeq) return;
  const host = document.createElement('div');
  pvYoutubeEl.appendChild(host);
  pvYoutubeEl.hidden = false;
  const cur = { mediaId: rec.id, player: null, qualityTimer: null, tickTimer: null };
  ytPreview = cur;
  cur.player = new YT.Player(host, {
    videoId: rec.youtubeId,
    playerVars: {
      autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0,
      iv_load_policy: 3, rel: 0, playsinline: 1,
      // Segundos inteiros — é o que a IFrame Player API aceita.
      start: Math.max(0, Math.floor(startAt || 0)),
    },
    events: {
      onReady: (e) => {
        if (ytPreview !== cur) return;
        // Normalmente a preview é sempre muda (espelha o Display); no modo
        // "mesa de som" ela é quem toca o áudio de verdade, com o volume/mudo
        // que o operador já tiver definido.
        if (standalone) {
          try { if (!muted) e.target.unMute(); e.target.setVolume(Math.round(volume * 100)); } catch (_) {}
        } else {
          try { e.target.mute(); } catch (_) {}
        }
        ytPreviewForceLowQuality(e.target);
        try { e.target.playVideo(); } catch (_) {}
        clearInterval(cur.qualityTimer);
        cur.qualityTimer = setInterval(() => {
          if (ytPreview !== cur || !cur.player) return;
          ytPreviewForceLowQuality(cur.player);
        }, 1500);
        startYtPreviewTick(cur);
      },
      onStateChange: (e) => { if (ytPreview === cur) onYtPreviewState(e); },
      onPlaybackQualityChange: (e) => { if (ytPreview === cur) ytPreviewForceLowQuality(e.target); },
    },
  });
}

// A preview do YouTube (player real na tela do operador) é a FONTE DE VERDADE
// do play/pause, da barra de progresso e do avanço automático dos itens YouTube
// — como a preview local (`previewTick`) faz para mídia comum. Antes isso
// dependia só do `display-status` remoto do Display, que pode chegar atrasado
// ou nem chegar (Display em segundo plano/fechado), deixando o ▶/⏸ preso e sem
// pausar. Agora o player local dirige a UI, sempre responsivo.
function startYtPreviewTick(cur) {
  clearInterval(cur.tickTimer);
  cur.tickTimer = setInterval(() => {
    if (ytPreview !== cur || !cur.player) return;
    ytPreviewTick();
  }, 500);
}
// Sincronização (qualquer tipo de mídia com tempo — YouTube, áudio, vídeo):
// o player do DISPLAY (a projeção real) é a fonte de verdade quando está
// enviando status; se ele não existir / estiver estrangulado ou fechado
// (nenhum display-status recente), a PREVIEW local assume. `displayStatusAt`
// guarda o instante do último display-status do item atual; `displayActive()`
// = recebeu algo há menos de DISPLAY_TIMEOUT. `lastDisplayTime` guarda o
// último `currentTime` reportado — usado por quem precisa da posição
// "oficial" fora do fluxo de tick (`stepSlide`/`renderSlideNav`, ver
// `authoritativeTime()`).
let displayStatusAt = 0;
let lastDisplayTime = 0;
const DISPLAY_TIMEOUT = 2500; // sem status do Display por mais que isso → preview assume
const SYNC_DRIFT = 1.6;       // só re-sincroniza a preview se o drift passar disso (s)
function displayActive() {
  return (Date.now() - displayStatusAt) < DISPLAY_TIMEOUT;
}
function ytDisplayActive() {
  return !!(currentItem && currentItem.kind === 'youtube') && displayActive();
}
// Posição "oficial" do item atual: a do Display enquanto ele for a fonte de
// verdade (ver acima), senão a da própria preview. Usado por ações
// disparadas fora do ciclo de tick normal (stepSlide, renderSlideNav) — sem
// isso, "estrofe anterior/próxima" calcularia a partir de um tempo local já
// desatualizado em relação ao que está de fato no telão.
function authoritativeTime() {
  if (currentItem && currentItem.kind !== 'youtube' && displayActive()) return lastDisplayTime;
  return preview.getTime() || 0;
}
// Re-alinha a preview à projeção real do Display (fonte de verdade): casa o
// play/pause e, se o tempo divergir muito (ex: preview estrangulada enquanto o
// Controle esteve minimizado), busca o instante do Display. Não busca em "mesa
// de som" (evita salto audível); só casa play/pause.
function ytResyncPreviewToDisplay(isPlaying, currentTime) {
  const p = ytPreview && ytPreview.player;
  if (!p) return;
  try {
    if (!standalone && typeof currentTime === 'number' && isFinite(currentTime)) {
      const pt = p.getCurrentTime() || 0;
      if (Math.abs(pt - currentTime) > SYNC_DRIFT) p.seekTo(currentTime, true);
    }
    const st = p.getPlayerState();
    if (isPlaying && st !== 1 && st !== 3) p.playVideo();
    else if (!isPlaying && st === 1) p.pauseVideo();
  } catch (_) {}
}
// Mesmo princípio de ytResyncPreviewToDisplay, para mídia comum (áudio/vídeo
// do próprio stage.js, não YouTube): casa o play/pause e corrige o tempo da
// preview se o drift passar de SYNC_DRIFT — sem isso, dois decodificadores
// de áudio independentes (Display e preview) divergem aos poucos e a letra
// sincronizada acaba trocando de slide em momentos diferentes nos dois
// lados. Também não busca em "mesa de som" (evita salto audível).
function resyncPreviewToDisplay(isPlaying, currentTime) {
  if (!preview.isTimed()) return;
  try {
    if (!standalone && typeof currentTime === 'number' && isFinite(currentTime)) {
      const pt = preview.getTime() || 0;
      if (Math.abs(pt - currentTime) > SYNC_DRIFT) preview.seek(currentTime);
    }
    if (isPlaying && !preview.isPlaying()) preview.play();
    else if (!isPlaying && preview.isPlaying()) preview.pause();
  } catch (_) {}
}
function ytPreviewTick() {
  if (ytDisplayActive()) return; // Display presente é a fonte — a preview só assume na ausência dele
  const p = ytPreview && ytPreview.player;
  if (!p) return;
  let st = -1, t = 0, dur = 0;
  try { st = p.getPlayerState(); t = p.getCurrentTime() || 0; dur = p.getDuration() || 0; } catch (_) { return; }
  setPlaying(st === 1 || st === 3); // playing | buffering
  durTimeEl.textContent = fmtTime(dur);
  seekEl.disabled = !(dur > 0);
  if (!seeking) {
    seekEl.max = dur > 0 ? dur : 0;
    seekEl.value = t;
    curTimeEl.textContent = fmtTime(t);
  }
  renderSimpleTime();   // o YouTube não passa por renderSlideNav
}
function onYtPreviewState(e) {
  if (ytDisplayActive()) return; // Display presente é a fonte — ignora eventos locais
  const st = e.data; // 1 playing, 2 paused, 3 buffering, 0 ended, 5 cued
  if (st === 0) { // fim natural → avança a playlist (só quando a preview é a fonte)
    setPlaying(false);
    ytEnded = true;
    autoAdvance();
    return;
  }
  if (st === 1 || st === 2 || st === 3) {
    ytEnded = false;
    ytPreviewTick();
  }
}

// Transporte do player da preview: play/pause/seek sempre; mute/volume só
// importam no modo "mesa de som" (fora dele a preview do YouTube é sempre
// muda, como a mídia local). A cortina (view/fade) é tratada à parte, sempre
// via preview.handle() (ver cmd()), pois é a mesma cortina compartilhada
// usada pela mídia local.
function ytPreviewHandle(obj) {
  if (!ytPreview || !ytPreview.player) return;
  const p = ytPreview.player;
  switch (obj.type) {
    case 'play': try { p.playVideo(); } catch (_) {} break;
    case 'pause': try { p.pauseVideo(); } catch (_) {} break;
    case 'seek': if (typeof obj.time === 'number') { try { p.seekTo(obj.time, true); } catch (_) {} } break;
    // Mudo e volume seguem a MESMA orquestração do ytHandle do Display (e do
    // setMute do stage): rampa curta em vez de corte seco — no modo "mesa de
    // som" este é o áudio que sai na caixa da igreja, e um corte no talo estala.
    case 'mute':
      if (standalone) {
        clearTimeout(ytPreviewMuteApplyTimer);
        if (obj.muted) {
          // Desce até 0 e só então muta de fato (o "pop" mora no corte).
          ytPreviewRampVolume(volume, 0, MUTE_RAMP_TIME);
          ytPreviewMuteApplyTimer = setTimeout(() => {
            // Confere de novo: um mute/unmute mais recente pode ter mudado a
            // intenção enquanto a rampa corria — a aplicação atrasada não pode
            // ressuscitar um mudo já desfeito.
            if (muted && standalone) { try { p.mute(); } catch (_) {} }
          }, MUTE_RAMP_TIME * 1000);
        } else {
          // Desmuta já (senão volume 0 não seria ouvido) e sobe em rampa.
          try { p.unMute(); } catch (_) {}
          ytPreviewRampVolume(0, volume, MUTE_RAMP_TIME);
        }
      }
      break;
    case 'volume':
      if (standalone && typeof obj.volume === 'number') {
        // O operador mandou: cancela qualquer rampa em curso, senão os passos
        // restantes (com o alvo antigo) sobrescreveriam o valor novo e o fader
        // "voltaria" sozinho.
        clearInterval(ytPreviewRampTimer);
        clearTimeout(ytPreviewMuteApplyTimer);
        try { p.setVolume(Math.round(obj.volume * 100)); } catch (_) {}
      }
      break;
  }
}

// Liga/desliga o modo "mesa de som": é só uma SAÍDA DE ÁUDIO LOCAL — a
// preview passa a tocar o som de verdade pelo próprio aparelho, em vez de
// sempre muda. Não mexe em nada da comunicação com o Display: os comandos
// continuam sendo enviados normalmente (cmd() não muda de comportamento);
// na prática, se o Display nem estiver aberto, ninguém escuta esses
// comandos e é como se ele não existisse — mas o Controle não precisa saber
// disso nem tratar esse caso de forma especial.
async function setStandalone(v) {
  if (standalone === v) return;
  standalone = v;
  // Mídia local: a rampa vive no stage (setForceMuted). YouTube da preview:
  // rampa aqui, em paralelo, com a mesma duração — ligar desmuta e sobe de 0
  // ao volume alvo (respeitando o mudo do operador); desligar desce até 0 e só
  // então muta.
  preview.setForceMuted(!standalone);
  pushAudioAlive();
  if (ytPreview && ytPreview.player) {
    const p = ytPreview.player;
    clearInterval(ytPreviewRampTimer);
    // Mesmo timer do 'mute' de ytPreviewHandle: as duas rampas são mutuamente
    // exclusivas no tempo e a mais recente tem de cancelar a anterior.
    clearTimeout(ytPreviewMuteApplyTimer);
    if (standalone) {
      if (!muted) { try { p.unMute(); } catch (_) {} ytPreviewRampVolume(0, volume, MUTE_RAMP_TIME); }
      else { try { p.setVolume(Math.round(volume * 100)); } catch (_) {} }
    } else {
      ytPreviewRampVolume(volume, 0, MUTE_RAMP_TIME);
      ytPreviewMuteApplyTimer = setTimeout(() => {
        if (!standalone && ytPreview && ytPreview.player) { try { ytPreview.player.mute(); } catch (_) {} }
      }, MUTE_RAMP_TIME * 1000);
    }
  }
  renderStandaloneSeg();
}

// A mesa de som é um ÍCONE SOBRE A PREVIEW desde a v5.82 (foi botão do mixer,
// depois segmento em Configurações). Ela é a única preferência daquela lista
// que se mexe DURANTE o culto — chega-se, liga-se a caixa, e ou há som no
// aparelho ou não —, e o lugar de decidir isso é olhando para a preview, que é
// justamente onde o som está sendo julgado. Dois toques num popup para uma
// decisão dessa frequência era atrito puro.
//
// O ÍCONE mostra o ESTADO (alto-falante inteiro = há som no celular; riscado =
// não há), pela mesma convenção do botão de mudo e da cortina: o riscado é o
// corte. Quem nomeia a ação é o `title`.
// MESA DE SOM LIGADA = O CELULAR É A CAIXA DE SOM, e aí minimizar o app não
// pode calar o louvor. Este WebView (o do Controle) é estrangulado em segundo
// plano de propósito — é o certo quando ele é só a mesa de comando —, mas
// deixa de ser quando é ELE que está tocando: o áudio sai daqui, do `<video>`
// da preview, não do telão.
//
// Foi essa distinção que faltou nas três tentativas anteriores: elas
// protegeram o WebView do TELÃO, e o problema relatado acontecia com a mesa de
// som, isto é, no outro WebView.
function pushAudioAlive() {
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 17) return;
  try { AVNative.keepAudioAlive(standalone); } catch (_) { /* shell antigo */ }
}

// HÁ UMA TELA RECEBENDO A PROJEÇÃO?
//
// Não é a mesma pergunta de `displayActive()`, que mede se o telão MANDOU
// notícia há pouco (ele só emite `display-status` com mídia em cena): um telão
// conectado e mostrando o wallpaper não responde nada, e continua sendo um
// telão conectado. Aqui a pergunta é sobre a CONEXÃO — a `Presentation` no app,
// a janela do Display no navegador —, que é o que decide se ligar o som deste
// aparelho atrapalha alguém.
//
// A liberação de teste do simplificado (`castTestUnlocked`) NÃO conta, e é
// deliberado: ela não conecta nada, então não há player nenhum para interromper
// — esconder o botão ali tiraria o som do único lugar onde ele pode ser ouvido.
function telaoConectado() {
  if (!window.__NATIVE__) return !!(webDisplayWin && !webDisplayWin.closed);
  return lastDisplays.length > 0;
}

// O BOTÃO DA MESA DE SOM SOME COM TELÃO CONECTADO (v5.141).
//
// Os dois WebViews dividem o mesmo processo e a mesma saída de áudio do
// Android. Ligar o som da preview enquanto o telão projeta não é "ouvir junto":
// o `<video>` do Controle assume o foco de áudio e o player do telão é
// INTERROMPIDO no meio do louvor, na frente da congregação. O botão existe para
// o caso em que o celular É a caixa de som — e esse caso, por definição, é o
// caso sem telão.
//
// Some, e não fica desabilitado: um botão apagado num canto da preview seria
// mais um elemento a decifrar durante o culto, e a explicação ("por que não
// posso ligar o som?") não cabe num `title` que ninguém vai abrir. Sem telão
// ele volta sozinho, no mesmo lugar de sempre.
function renderStandaloneSeg() {
  if (!pvSoundBtnEl) return;
  pvSoundBtnEl.hidden = telaoConectado();
  pvSoundBtnEl.classList.toggle('on', standalone);
  pvSoundBtnEl.title = standalone
    ? 'Som no celular LIGADO — tocar para desligar'
    : 'Som no celular desligado — tocar para ligar (mesa de som)';
}

// A tela pode ser conectada COM A MESA DE SOM JÁ LIGADA — é o caso normal, aliás:
// o operador chega, ouve o louvor pelo celular enquanto acerta as coisas, e só
// então liga o dongle. Esconder o botão sem desligar o modo deixaria exatamente
// o estado que este lote existe para impedir, e sem nenhum controle na tela para
// desfazê-lo. Quem re-renderiza é o próprio `setStandalone`.
function pushTelaoNoSom() {
  if (telaoConectado() && standalone) { setStandalone(false); return; }
  renderStandaloneSeg();
}

// Fundo da letra sincronizada (Hinário 2022): 'black' (padrão) ignora as
// imagens dos slides e mantém o fundo preto atrás do texto; 'image' usa as
// imagens de verdade. Persistido em state.lyricsBg, aplicado ao vivo (igual
// fade/fit) via comando — tanto no Display quanto na própria preview, que
// segue o mesmo conceito universal de espelhar o telão.
//
// Mora no popup de EXIBIÇÃO (segmento "Imagens dos slides"), junto do
// preenchimento e do wallpaper: é uma preferência de como o telão se parece,
// escolhida uma vez, não um controle que se opera durante o culto. O botão que
// tinha no mixer virou a leitura da letra completa (ver openLyricsPopup).
let lyricsBg = 'black';
async function setLyricsBg(mode) {
  mode = mode === 'image' ? 'image' : 'black';
  if (lyricsBg === mode) return;
  lyricsBg = mode;
  await AVDB.setState('lyricsBg', lyricsBg);
  renderLyricsBgSeg();
  cmd({ type: 'lyricsbg', mode: lyricsBg });
}
function renderLyricsBgSeg() {
  lyricsBgSegEl.querySelectorAll('.fit-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lyricsbg === lyricsBg);
  });
}

// Envia o comando ao display E aplica na preview (espelho) — YouTube usa seu
// próprio player pequeno (acima); mídia comum continua no stage.js. O modo
// "mesa de som" não altera nada aqui (ver setStandalone) — só a saída de
// áudio da preview muda, a comunicação com o Display permanece normal.
function cmd(obj) {
  AVDB.sendCommand(obj);
  // O tempo volta a correr: destrava a letra congelada pelo fim natural.
  if (obj.type === 'load' || obj.type === 'play' || obj.type === 'seek') pvLyricsEnded = false;
  // Texto manual (Bíblia/Mensagem): overlay independente — espelha na preview.
  if (obj.type === 'text') { showPvText(obj); return; }
  if (obj.type === 'text-hide') { hidePvText(); return; }
  const nowYoutube = !!(currentItem && currentItem.kind === 'youtube');
  if (obj.type === 'load') {
    // Esconde a letra incondicionalmente (como o Display). O texto manual é um
    // overlay independente: só some ao carregar VISUAL; ÁUDIO toca por baixo e
    // mantém o texto (independência áudio × texto).
    hidePvLyrics(true);
    const keepText = pvTextActive && currentItem && currentItem.kind === 'audio';
    if (!keepText) hidePvText(false); // o load abaixo já monta a cena nova
    // preview.handle() sempre roda primeiro: mantém preview.getCurrent()/
    // fallback de thumbnail em dia (stage.js já sabe lidar com kind=youtube,
    // só não toca o vídeo) — mesmo quando o player real assume por cima.
    preview.handle(obj);
    if (nowYoutube) loadYtPreview(currentItem, obj.view);
    else if (ytPreview) dropYtPreview();
    // Só mostra a letra do áudio se NÃO houver texto manual em cena (precedência).
    if (!keepText && currentItem && currentItem.kind === 'audio' && Array.isArray(currentItem.lyrics) && currentItem.lyrics.length) showPvLyrics(currentItem);
    return;
  }
  if (obj.type === 'clear') {
    hidePvLyrics(true);
    hidePvText(false); // a cena inteira está sendo encerrada; nada a restaurar
    if (ytPreview) dropYtPreview();
    preview.handle(obj);
    return;
  }
  if (obj.type === 'lyricsbg') {
    // Não é um comando do stage.js (letra é camada paralela) — aplica direto
    // na preview, se ela estiver mostrando letra sincronizada agora.
    applyPvLyricsBg();
    return;
  }
  if (obj.type === 'view' || obj.type === 'fit') {
    preview.handle(obj); // cortina/config compartilhada — sempre, independe do youtube
    return;
  }
  if (nowYoutube && ytPreview) { ytPreviewHandle(obj); return; }
  preview.handle(obj);
}

function previewTick() {
  // Texto manual em cena sem áudio de fundo: nada de mídia/tempo a sincronizar.
  // (Com áudio de fundo, o texto é overlay e a preview segue o áudio normalmente.)
  // O conjunto é o MESMO de `clearManualText` — as cinco sessões, incluindo
  // cronômetro e sorteio; listar só três deixava o tick rodando sobre uma
  // preview sem mídia durante uma contagem regressiva.
  if ((bibleSession || msgSession || lyricSession || chronoSession || drawSession)
    && !preview.getCurrent()) return;
  // Itens YouTube tocam só no Display (player real): a UI de transporte é
  // dirigida pelo display-status remoto, não pela preview local.
  if (currentItem && currentItem.kind === 'youtube') return;
  // Display presente é a fonte de verdade (ver displayActive()) — a preview
  // só dirige a UI/letra na ausência dele; enquanto ele estiver ativo, quem
  // atualiza tudo isso é o handler de 'display-status' (AVDB.onCommand).
  if (displayActive()) return;
  setPlaying(preview.isPlaying());
  const dur = preview.getDuration();
  durTimeEl.textContent = fmtTime(dur);
  seekEl.disabled = !preview.isTimed();
  if (!seeking) {
    seekEl.max = isFinite(dur) && dur > 0 ? dur : 0;
    seekEl.value = preview.getTime() || 0;
    curTimeEl.textContent = fmtTime(preview.getTime());
  }
  updatePvLyricSlide(preview.getTime() || 0);
  renderSlideNav();
}

// ===== Fades de camada paralela da preview (letra, texto) =====
// A preview mostra exatamente o que vai ao telão, transições incluídas — por
// isso são LITERALMENTE as mesmas funções do Display, vindas de stage.js. Não
// há calibração própria aqui (o que difere entre preview e telão é só o CSS,
// em cq* relativos a cada container).
const PV_LAYER_FADE_MS = createStage.LAYER_FADE_MS;
const findSlideIndex = createStage.findSlideIndex;
const pvFadeIn = createStage.fadeContentIn;
const pvLayerIn = createStage.fadeLayerIn;
const pvLayerOut = createStage.fadeLayerOut;
const chronoReading = createStage.chronoReading;
const CHRONO_TICK_MS = createStage.CHRONO_TICK_MS;
const drawReading = createStage.drawReading;
const DRAW_FRAME_MS = createStage.DRAW_FRAME_MS;

// ===== Letra sincronizada na preview — mesma visualização do Display =====
// A preview já espelha o Display para imagem/vídeo (stage.js) e YouTube
// (segundo player, ver loadYtPreview) — letra sincronizada segue o mesmo
// princípio universal do sistema: o operador vê no celular exatamente o que
// está sendo exibido no telão.
let pvLyrics = null;
let pvLyricsMeta = null; // { hymnName, hymnTrack } do item atual, pro slide de capa
let pvLyricSlideIdx = -1;
let pvLyricLoadSeq = 0;
let pvLyricImgKey = null;
let pvLyricImgUrl = null;
// Fim natural da faixa (local ou reportado pelo Display): trava a troca de
// slide até o próximo load/play/seek. Sem isso, o `currentTime = 0` que o fim
// natural produz (preparando o replay) faz o slide de CAPA reaparecer por um
// instante antes de o wallpaper cobrir — o "piscar da thumbnail" no fim da música.
let pvLyricsEnded = false;

// `fade` = a letra está saindo de cena para o operador ver (fim da música,
// texto manual assumindo). Espelha hideLyrics() do Display, inclusive o
// adiamento do teardown da imagem de fundo (ela é FILHA da camada: desmontá-la
// de imediato faria o fundo sumir por trás de um texto ainda esmaecendo).
function hidePvLyrics(fade) {
  pvLyrics = null;
  pvLyricsMeta = null;
  pvLyricSlideIdx = -1;
  ++pvLyricLoadSeq; // descarta uma imagem ainda resolvendo (não deve reaparecer)
  const seq = pvLyricLoadSeq;
  const teardown = () => {
    if (seq !== pvLyricLoadSeq) return; // a letra voltou nesse meio tempo
    if (pvLyricImgUrl) { URL.revokeObjectURL(pvLyricImgUrl); pvLyricImgUrl = null; }
    pvLyricImgKey = null;
    pvLyricsImgEl.hidden = true;
    pvLyricsImgEl.removeAttribute('src');
  };
  if (fade && !pvLyricsEl.hidden && pvLyricsEl.animate && fadeCfg.out) {
    pvLayerOut(pvLyricsEl);
    setTimeout(teardown, PV_LAYER_FADE_MS);
  } else {
    pvLyricsEl.hidden = true;
    teardown();
  }
}

function showPvLyrics(rec) {
  pvLyrics = rec.lyrics;
  pvLyricsMeta = { hymnName: rec.hymnName, hymnTrack: rec.hymnTrack };
  pvLyricSlideIdx = -1;
  pvLayerIn(pvLyricsEl);
  applyPvLyricsBgClass();
  renderPvLyricSlide(0);
}

// A moldura (borda + fundo semitransparente) só faz sentido cobrindo uma
// imagem de fundo de verdade — mesmo motivo do Display (ver
// applyLyricsBgClass em display.js). `.imgbg` liga a moldura só quando
// lyricsBg==='image' (ver .pv-lyrics-box/.pv-lyrics-content.imgbg em
// controle.css).
function applyPvLyricsBgClass() {
  pvLyricsContentEl.classList.toggle('imgbg', lyricsBg === 'image');
}

function renderPvLyricSlide(idx) {
  if (idx === pvLyricSlideIdx) return;
  pvLyricSlideIdx = idx;
  const slide = pvLyrics[idx];
  if (!slide) return;

  pvLyricsContentEl.classList.toggle('cover', !!slide.cover);
  if (slide.cover) {
    const meta = pvLyricsMeta || {};
    pvLyricsLineEl.textContent = (meta.hymnTrack ? meta.hymnTrack + '. ' : '') + (meta.hymnName || '');
    pvLyricsAuxEl.hidden = true;
  } else {
    pvLyricsLineEl.textContent = slide.text || '';
    pvLyricsAuxEl.textContent = slide.auxText || '';
    pvLyricsAuxEl.hidden = !slide.auxText;
  }
  // Trecho sem letra (solo, introdução, instrumental): a moldura esmaece e
  // some, deixando só a imagem de fundo — mesmo comportamento do telão.
  pvLyricsContentEl.classList.toggle('nolyric', !pvLyricsLineEl.textContent.trim() && pvLyricsAuxEl.hidden);
  pvFadeIn(pvLyricsLineEl);
  if (!pvLyricsAuxEl.hidden) pvFadeIn(pvLyricsAuxEl);

  applyPvLyricsImage(slide);
}

// Resolve (ou limpa) a imagem de fundo do slide atual, respeitando o modo
// preto/imagens (`lyricsBg`, ver setLyricsBg) — só troca de fato se a chave
// efetiva mudou (linhas seguidas costumam compartilhar a mesma imagem), com
// guarda de sequência pra descartar resoluções obsoletas.
function applyPvLyricsImage(slide) {
  if (!slide) return;
  const key = (lyricsBg === 'image' && slide.imageOpfsPath) ? slide.imageOpfsPath : null;
  if (key === pvLyricImgKey) return;
  const seq = ++pvLyricLoadSeq;
  if (!key) {
    pvLyricImgKey = null;
    // Oculta a <img> (não só limpa o src) — mesmo motivo do Display: sem
    // isso, alguns navegadores mostram o ícone/borda padrão de "imagem
    // quebrada" mesmo sem `src`, aparecendo como uma linha branca de
    // margem sobre o preto de .pv-lyrics-bg. Sai esmaecendo, e `src`/object
    // URL só caem DEPOIS do fade (limpá-las agora exporia justamente esse
    // ícone durante toda a transição).
    const url = pvLyricImgUrl;
    pvLyricImgUrl = null;
    pvLayerOut(pvLyricsImgEl);
    setTimeout(() => {
      if (seq !== pvLyricLoadSeq) return; // outra imagem já assumiu
      pvLyricsImgEl.removeAttribute('src');
      if (url) URL.revokeObjectURL(url);
    }, PV_LAYER_FADE_MS);
    return;
  }
  AVDB.opfsGetFile(key).then((file) => {
    if (seq !== pvLyricLoadSeq) return;
    const url = URL.createObjectURL(file);
    const prevUrl = pvLyricImgUrl;
    pvLyricImgUrl = url;
    pvLyricImgKey = key;
    pvLyricsImgEl.src = url;
    // Cada imagem de estrofe entra com fade — igual ao telão.
    pvLayerIn(pvLyricsImgEl);
    if (prevUrl) URL.revokeObjectURL(prevUrl);
  }).catch(() => {});
}

function updatePvLyricSlide(t) {
  if (!pvLyrics || pvLyricsEnded) return;
  // Replay depois do fim: a letra foi esmaecida junto com a música, mas os
  // slides continuam carregados — o tempo voltar a correr a traz de volta.
  if (pvLyricsEl.hidden) pvLayerIn(pvLyricsEl);
  renderPvLyricSlide(findSlideIndex(pvLyrics, t));
}

// Reaplica o fundo (preto/imagens) no slide atual sem precisar de uma troca
// de estrofe — chamado quando o operador alterna o botão de fundo da letra.
function applyPvLyricsBg() {
  if (!pvLyrics || pvLyricSlideIdx < 0) return;
  applyPvLyricsBgClass();
  applyPvLyricsImage(pvLyrics[pvLyricSlideIdx]);
}

// ===== Camada de TEXTO manual na preview (Bíblia/Mensagem) — espelha o Display =====
// Overlay independente do áudio: um som pode seguir tocando por baixo (preview
// muda), como no Display. `mode`: 'verse' (sublinha = referência) | 'message'.
let pvTextActive = false;

// `restore` = a cena anterior deve voltar (ver hideText no display.js: mesma
// regra dos dois lados — 'text-hide' restaura; load visual/stop/clear não,
// porque algo novo já vai assumir a cena).
function hidePvText(restore = true) {
  if (!pvTextActive && pvTextEl.hidden) return;
  pvTextActive = false;
  stopPvLiveTimer();   // espelha hideText no Display
  // Sai esmaecendo — e o texto NÃO é limpo aqui: apagá-lo agora deixaria o
  // cartão vazio visível durante todo o fade. O próximo showPvText sobrescreve.
  pvLayerOut(pvTextEl);
  if (restore) restorePvSceneAfterText();
}

// Espelha restoreSceneAfterText() do Display: só a letra sincronizada precisa
// ser remontada (vídeo/imagem/YouTube nunca pararam e reaparecem sozinhos), e
// no slide correspondente ao instante atual — por authoritativeTime(), que é
// a posição do Display quando ele é a fonte de verdade.
function restorePvSceneAfterText() {
  // YouTube segue tocando por baixo do cartão e reaparece sozinho.
  if (ytPreview) return;
  const cur = preview.getCurrent();
  // NADA de fato em cena — nenhuma mídia carregada, ou a que havia já terminou
  // (só na playlist, ou tocada antes). O ponto de repouso é o WALLPAPER, não o
  // preto: showPvText abriu a cortina para o cartão aparecer, e sem isto ela
  // ficava aberta sobre o vazio quando o texto saía. Note que a fonte aqui é o
  // STAGE (`preview.getCurrent()`), não `currentItem`: este último é o item
  // SELECIONADO, que continua apontando para uma música só da playlist ou já
  // terminada — era justamente ele que fazia a preview achar que havia algo em
  // cena quando não havia.
  if (!cur || preview.hasEnded()) { preview.coverIn(false); return; }
  if (cur.kind !== 'audio' || !Array.isArray(cur.lyrics) || !cur.lyrics.length) return;
  showPvLyrics(cur);
  updatePvLyricSlide(authoritativeTime());
}

// Texto VIVO na preview (cronômetro e sorteio): mesmo desenho do Display (ver
// showText lá) — o valor é derivado localmente do descritor, não recebido
// pronto. Os dois laços são independentes de propósito: cada um lê o MESMO
// `startAt`/`rollUntil` do MESMO relógio do aparelho, e o ruído do sorteio sai
// do MESMO PRNG semeado, então convergem quadro a quadro sem sincronizar nada.
// Um laço só para os dois modos, como no Display: o cartão é um só.
let pvLiveKind = '';
let pvLiveDesc = null;
let pvLiveTimer = null;

function pvLiveTick() {
  const r = pvLiveKind === 'draw' ? drawReading(pvLiveDesc, Date.now())
    : pvLiveKind === 'chrono' ? chronoReading(pvLiveDesc, Date.now()) : null;
  if (!r) return;
  pvTextMainEl.textContent = r.text;
  pvTextMainEl.style.setProperty('--ch', r.text.length);  // ver .mode-chrono no CSS
  pvTextContentEl.classList.toggle('chrono-over', !!r.over);
  pvTextContentEl.classList.toggle('draw-rolling', !!r.rolling);
  if (pvLiveKind === 'draw' && !r.rolling) stopPvLiveTimer();
}

function startPvLive(kind, desc) {
  pvLiveKind = kind; pvLiveDesc = desc || {};
  stopPvLiveTimer();
  pvLiveTick();
  if (kind === 'draw') {
    if (pvLiveDesc.rollUntil && Date.now() < pvLiveDesc.rollUntil) {
      pvLiveTimer = setInterval(pvLiveTick, DRAW_FRAME_MS);
    }
    return;
  }
  if (pvLiveDesc.mode === 'clock' || pvLiveDesc.running) {
    pvLiveTimer = setInterval(pvLiveTick, CHRONO_TICK_MS);
  }
}

function stopPvLiveTimer() {
  if (pvLiveTimer) { clearInterval(pvLiveTimer); pvLiveTimer = null; }
}

function clearPvLive() {
  stopPvLiveTimer(); pvLiveKind = ''; pvLiveDesc = null;
  pvTextContentEl.classList.remove('chrono-over', 'draw-rolling');
}

function showPvText(obj) {
  const wallpaper = obj.view === 'wallpaper';
  const isMsg = obj.mode === 'message';
  const isChrono = obj.mode === 'chrono';
  const isDraw = obj.mode === 'draw';
  pvTextContentEl.classList.toggle('mode-message', isMsg);
  pvTextContentEl.classList.toggle('mode-chrono', isChrono);
  pvTextContentEl.classList.toggle('mode-draw', isDraw);
  if (isChrono) {
    startPvLive('chrono', obj.chrono || {});
  } else if (isDraw) {
    startPvLive('draw', obj.draw || {});
  } else {
    clearPvLive();
    pvTextMainEl.textContent = obj.main || '';
  }
  pvTextSubEl.textContent = obj.sub || '';
  if (pvTextActive) {
    // Já em cena (troca de versículo/mensagem): fade-in do texto.
    pvFadeIn(pvTextMainEl); if (obj.sub) pvFadeIn(pvTextSubEl);
    preview.instantCover(wallpaper);
    return;
  }
  // O cartão é OPACO e fica acima de toda a mídia (.pv-text, z-index 2): nada
  // precisa ser interrompido para ele aparecer — nem o player do YouTube, que
  // antes era derrubado aqui e não tinha como voltar. A letra sincronizada é a
  // única exceção (ela É texto; volta em hidePvText, no slide certo).
  hidePvLyrics(true);
  pvTextActive = true;
  pvLayerIn(pvTextEl);
  if (wallpaper) preview.instantCover(true); else preview.coverOut();
}

// ===== util =====
function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}
function msym(code) {
  const s = document.createElement('span');
  s.className = 'msym';
  s.textContent = code;
  return s;
}
function persistCurrent() {
  return AVDB.setState('current', { mediaId: currentId, view, muted, volume, at: Date.now() });
}

// Sessão nova, player LIMPO. A mídia que ficou selecionada na sessão anterior
// não volta ao abrir o app: `current` é estado de uma sessão (o que estava no
// ar naquele culto), não biblioteca. O Cronograma, a playlist, os favoritos, as
// coleções e a Bíblia baixada continuam intactos — some só a seleção, e o item
// segue a um toque de distância na lista.
//
// O volume, o mudo e a cortina (`view`) FICAM: são o ajuste da mesa, não uma
// seleção — quem deixou o volume em 40 na semana passada não quer reabrir em
// 100.
//
// E NÃO manda `clear` para o telão. No app os dois WebViews sobem juntos (o
// Display já nasce no wallpaper, e nada é retomado sem comando explícito); no
// navegador o Display é outra janela, que pode estar projetando — e uma recarga
// do Controle (a do service worker, inclusive) apagaria a projeção no meio do
// culto.
async function clearCurrentSelection() {
  const cur = (await AVDB.getState('current')) || {};
  if (!cur.mediaId) return;
  await AVDB.setState('current', { ...cur, mediaId: null, at: Date.now() });
}

// ===== miniaturas =====
function drawThumb(srcEl, w, h) {
  return new Promise((resolve) => {
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(size / w, size / h);
    const dw = w * scale, dh = h * scale;
    ctx.drawImage(srcEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72);
  });
}
function thumbFromImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try { resolve(await drawThumb(img, img.naturalWidth, img.naturalHeight)); }
      catch (e) { resolve(null); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function thumbFromVideo(file, medidas) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let settled = false;
    function finish(blob) {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    }
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    // A altura e a duração saem de CARONA no elemento que já vai ser carregado
    // para a miniatura — medi-las depois custaria um segundo decode do mesmo
    // arquivo. Em `loadedmetadata` porque é o evento mais cedo em que elas
    // existem: se o prazo de segurança lá embaixo vencer antes do seek, os
    // números já foram guardados.
    v.onloadedmetadata = () => {
      if (!medidas) return;
      medidas.height = v.videoHeight || 0;
      medidas.seconds = Math.round(v.duration) || 0;
    };
    v.onloadeddata = () => {
      try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); }
      catch (e) { finish(null); }
    };
    v.onseeked = async () => {
      try { finish(await drawThumb(v, v.videoWidth || 160, v.videoHeight || 160)); }
      catch (e) { finish(null); }
    };
    v.onerror = () => finish(null);
    v.src = url;
    // Garante limpeza caso onseeked nunca dispare (ex: vídeo com duração=0).
    setTimeout(() => finish(null), 3500);
  });
}
async function makeThumb(file, kind, medidas) {
  if (kind !== 'image' && kind !== 'video') return null;
  return kind === 'image' ? thumbFromImage(file) : thumbFromVideo(file, medidas);
}

// A DURAÇÃO de um áudio, para o subtítulo da lista (v5.118).
//
// Vídeo não precisa disto: o `<video>` que monta a miniatura já sabe a altura e
// a duração, então elas saem de carona. Áudio não tem miniatura, e um decode
// só para medir seria caro se ele lesse o arquivo — daí `preload='metadata'`,
// que traz o cabeçalho e para.
//
// Prazo curto e falha em ZERO: um formato que o WebView não sabe abrir não pode
// travar uma importação. Sem o número, o subtítulo diz só "Áudio", que é o
// comportamento de antes deste campo existir.
function medirAudio(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('audio');
    let pronto = false;
    const fim = (seg) => {
      if (pronto) return;
      pronto = true;
      URL.revokeObjectURL(url);
      resolve(seg);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => fim(Math.round(a.duration) || 0);
    a.onerror = () => fim(0);
    a.src = url;
    setTimeout(() => fim(0), 4000);
  });
}

// Miniatura + os metadados do subtítulo, numa passada só.
//
// Usado nos dois caminhos de IMPORTAÇÃO (o seletor de arquivos e o
// compartilhamento), que trazem alguns arquivos por vez. A sincronização de
// PASTA fica de fora de propósito: ela percorre centenas de arquivos, e uma
// leitura de metadados por áudio ali é um custo que o operador sente no tempo
// da sincronização inteira, para ganhar um detalhe numa linha. Lá o subtítulo
// diz só o tipo, que já é a informação que faltava.
async function prepararMidia(file, kind) {
  const m = {};
  const thumb = await makeThumb(file, kind, m);
  if (kind === 'audio') m.seconds = await medirAudio(file);
  return { thumb, height: m.height || null, seconds: m.seconds || null };
}

// ===== carregar + render =====
// Guarda de sequência: load() é async e disparada fire-and-forget por dezenas
// de handlers. Sem isto, duas chamadas concorrentes poderiam terminar fora de
// ordem e a mais antiga sobrescreveria o estado/render da mais nova. Só o
// último load() aplica seu resultado (mesmo padrão do loadSeq do stage.js).
let loadSeqCtl = 0;
async function load() {
  const myseq = ++loadSeqCtl;

  // ---- FASE 1: só leituras do IDB, em locais (nada de estado/DOM ainda) ----
  const cur = await AVDB.getState('current');
  const repeatV = (await AVDB.getState('repeat')) || 'off';
  const plItemsV = await AVDB.listItems('playlist');
  const foldersV = (await AVDB.getState('folders')) || [];
  // Contagens das pastas em paralelo (antes era um await sequencial por pasta
  // a cada micro-mudança — ex: uma simples adição à playlist relia tudo).
  const folderIdArrays = await Promise.all(foldersV.map((f) => AVDB.getState('folder_' + f.id)));
  const folderCountsV = {};
  foldersV.forEach((f, i) => { folderCountsV[f.id] = (folderIdArrays[i] || []).length; });
  const opfsFoldersV = (await AVDB.getState('opfs-folders')) || [];
  // Os favoritos entram na FASE 1 como todo o resto: a estrela de cada linha é
  // desenhada por `renderLibrary`, e ela precisa do conjunto pronto — ler
  // depois faria a primeira pintura sair com todas as estrelas apagadas.
  const favIdsV = await AVDB.listIds('favs');
  const favItemsV = await AVDB.listItems('favs');
  const messagesV = (await AVDB.getState('messages')) || [];
  const chronoPrefsV = (await AVDB.getState('chronoPrefs')) || null;
  const drawPrefsV = (await AVDB.getState('drawPrefs')) || null;
  const storedFit = await AVDB.getState('fit');
  const storedRot = await AVDB.getState('rotate');
  const lyricsBgV = (await AVDB.getState('lyricsBg')) === 'image' ? 'image' : 'black';
  const downloadOkV = !!(await AVDB.getState('downloadOk'));
  let libItemsV;
  if (activeTab === 'folders') {
    if (currentFolder && currentFolder._opfs) {
      libItemsV = (await AVDB.filesByFolder(currentFolder.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } else {
      libItemsV = currentFolder ? await loadFolderMediaItems(currentFolder.id) : [];
    }
  } else if (activeTab === 'imports') {
    // Só a aba que é de fato lista de IDs de mídia. 'bible' e 'messages'
    // NÃO são listas de mídia — e 'messages' guarda
    // objetos {id,text} no mesmo state key, então passar isso por listItems
    // (getMedia por id) lançaria DataError e quebraria o load() inteiro.
    // ('playlist' saiu da comparação: nenhum caminho produz esse activeTab —
    // a playlist é popup desde que virou `#plPopup`.)
    libItemsV = await AVDB.listItems(activeTab);
  } else {
    libItemsV = [];
  }
  const curMediaId = cur && cur.mediaId ? cur.mediaId : null;
  const currentItemV = curMediaId ? (await AVDB.getMedia(curMediaId)) || null : null;

  // Um load() mais novo assumiu enquanto este lia o IDB — descarta este.
  if (myseq !== loadSeqCtl) return;

  // ---- FASE 2: aplica ao estado do módulo + render (síncrono, atômico) ----
  currentId = curMediaId;
  view = (cur && cur.view) || 'visual';
  muted = !!(cur && cur.muted);
  volume = (cur && typeof cur.volume === 'number') ? cur.volume : 1;
  repeat = repeatV;
  plItems = plItemsV;
  folders = foldersV;
  folderCounts = folderCountsV;
  opfsFolders = opfsFoldersV;
  favSet = new Set(favIdsV);
  favItems = favItemsV;
  messages = messagesV;
  applyChronoPrefs(chronoPrefsV);
  applyDrawPrefs(drawPrefsV);
  // "Esticar" SAIU da UI na v5.142 e o valor guardado é MIGRADO aqui, uma vez.
  // Sem a migração, quem já o tinha escolhido continuaria com a mídia distorcida
  // no telão e sem nenhum botão na tela que explicasse por quê — o pior estado
  // possível: o defeito permanece e o controle dele some.
  if (storedFit === 'fill') { mediaFit = 'contain'; AVDB.setState('fit', mediaFit); }
  else if (storedFit) mediaFit = storedFit;
  mediaRot = ROTACOES.includes(storedRot | 0) ? (storedRot | 0) : 0;
  lyricsBg = lyricsBgV;
  downloadConsent = downloadOkV;
  libItems = libItemsV;
  currentItem = currentItemV;

  renderLyricsBgSeg();
  renderControls();
  renderNowPlaying();
  renderRepeat();
  renderTabs();
  renderListTitle();
  renderPlaylist();
  renderLibrary();
  renderSelbar();
  renderSlideNav();

  // mantém a preview alinhada (sem recarregar a mídia). NÃO mexe na cortina
  // (setView) enquanto um texto bíblico está em cena: a Bíblia é uma camada
  // paralela e o stage da preview está sem `current` (=null), então setView
  // recobriria a cortina e o texto sumiria da preview ao trocar de aba — a
  // projeção deve ser independente da navegação, como qualquer outra mídia.
  if (!pvTextActive) preview.setView(view);
  preview.setMute(muted); preview.setVolume(volume);
  preview.setFade({ fadeIn: fadeCfg.in, fadeOut: fadeCfg.out, time: fadeCfg.time });
  preview.setFit(mediaFit);
  preview.setRotate(mediaRot);
  renderRotBtn();

  // restaura a posição de scroll da aba/pasta atual
  listHost().scrollTop = scrollPos[scrollKey()] || 0;
}

// chave de posição de scroll: aba (+ pasta aberta, se houver)
function scrollKey() {
  return activeTab + (currentFolder ? '/' + currentFolder.id : '');
}
function rememberScroll() {
  scrollPos[scrollKey()] = listHost().scrollTop;
}

// CONVENÇÃO (v5.50): o ÍCONE RISCADO mostra o CORTE — o estado em que a coisa
// está desligada —, e a cor/borda confirma. Vale para os dois cortes do app: o
// som (alto-falante riscado = mudo) e a imagem (imagem riscada = telão coberto).
//
// A v5.47 tinha adotado o oposto ("o ícone mostra a AÇÃO que o toque executa"),
// e a razão declarada era que estado e ação conviviam misturados na tela. O
// problema era real, mas a solução escolhida gastava o riscado — o símbolo
// universal de "cortado" — para dizer justamente que NÃO está cortado. Nada se
// perde invertendo: a COR já carrega o estado sozinha (`.view-blocked`,
// `.muted`, `.blocked` pintam o botão inteiro), o `title` continua nomeando a
// ação, e o ícone volta a ser lido como todo mundo lê um alto-falante riscado.
//
// O ▶/⏸ segue sendo AÇÃO — ali a convenção é de plataforma (todo player do
// mundo mostra ▶ quando está pausado) e o botão não tem cor de estado.
// `renderRepeat` também segue mostrando o modo atual (ver lá).
function renderControls() {
  // Coberto → imagem RISCADA; mídia no ar → imagem inteira.
  viewToggleEl.querySelector('.msym').textContent = view === 'wallpaper' ? ICON.imageOff : ICON.image;
  viewToggleEl.classList.toggle('view-blocked', view === 'wallpaper');
  viewToggleEl.title = view === 'visual' ? 'Cobrir o telão' : 'Mostrar a mídia no telão';
  // 3 estados do botão de mudo: normal | mudo (operador) | sem áudio no
  // Display (navegador bloqueou — tocando mudo; clique tenta liberar). Nos dois
  // últimos NÃO SAI SOM, e é isso que o riscado diz; o que os distingue é a
  // cor (vermelho de mudo × âmbar pulsante de bloqueado).
  const blocked = displayAudioBlocked && !muted;
  muteToggleEl.querySelector('.msym').textContent = (muted || blocked) ? ICON.volOff : ICON.volOn;
  muteToggleEl.classList.toggle('muted', muted);
  muteToggleEl.classList.toggle('blocked', blocked);
  muteToggleEl.title = blocked
    ? 'Sem áudio no Display — toque para tentar liberar'
    : muted ? 'Tirar o mudo' : 'Mutar';
  // Os DOIS faders (mixer e barra lateral do modo simplificado) mostram o
  // mesmo volume: um só ponto os escreve, então nunca divergem.
  const volPct = Math.round(volume * 100);
  syncFader(volSliderEl, faderWrapEl, volValueEl, volPct);
  renderSimple();
  // A cortina (view) muda por aqui, não por renderNowPlaying — e o rótulo do
  // botão da notificação depende dela. A deduplicação segura o excesso.
  pushNowPlaying();
}

// Põe um fader (trilho + número) no volume atual. O trilho é desenhado pelo
// nosso CSS (ver `.fader`), porque a espessura do trilho nativo é fixa e não
// acompanha a largura da coluna — e `appearance: none` desliga junto o
// preenchimento que vinha do `accent-color`. `--vol` é esse preenchimento, e
// mora no WRAPPER porque o número dentro do cap é irmão do input.
//
// O input que o dedo está arrastando não é reescrito: o valor voltaria
// arredondado no meio do movimento. O preenchimento e o número, sim — eles
// devem seguir o dedo.
function syncFader(input, wrap, label, pct) {
  if (volSeekingEl !== input) input.value = pct;
  wrap.style.setProperty('--vol', String(pct / 100));
  label.textContent = String(pct);
}

// EXCEÇÃO à convenção "ícone = ação": este botão CICLA por quatro modos
// (off → all → one → shuffle), não alterna dois. Num par binário mostrar a ação
// não custa nada, porque o estado é o inverso dela; num ciclo de quatro, o
// glifo só cabe um — mostrar o PRÓXIMO modo apagaria da tela qual está valendo,
// e a cor (`.active`) só distingue ligado de desligado, não qual dos três.
// Então aqui o ícone segue sendo o modo ATUAL, que é a informação que se perde.
function renderRepeat() {
  const icon = repeat === 'one' ? ICON.repeatOne : repeat === 'shuffle' ? ICON.shuffle : ICON.repeatAll;
  const label = repeat === 'off' ? 'Repetição desativada'
    : repeat === 'one' ? 'Repetir 1' : repeat === 'shuffle' ? 'Aleatório' : 'Repetir tudo';
  repeatEl.querySelector('.msym').textContent = icon;
  repeatEl.title = label;
  repeatEl.classList.toggle('active', repeat !== 'off');
}

function renderNowPlaying() {
  // Sorteio EM EXIBIÇÃO.
  if (drawProjecting()) {
    npNameInnerEl.textContent = 'Sorteio';
    applyTitleMarquee();
    playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
    renderSimple();
    pushNowPlaying();
    return;
  }
  // Cronômetro/relógio/timer EM EXIBIÇÃO: o nome da ferramenta. Não há barra de
  // progresso (o tempo dele não é o de uma mídia), e o ▶ segue valendo para o
  // áudio de fundo, que continua tocando por baixo do cartão.
  if (chronoProjecting()) {
    const m = CHRONO_MODES.find((x) => x.id === chrono.mode);
    npNameInnerEl.textContent = m ? m.name : 'Cronômetro';
    applyTitleMarquee();
    playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
    renderSimple();
    pushNowPlaying();
    return;
  }
  // Letra avulsa EM EXIBIÇÃO: o nome da música + a estrofe. Sem o número, duas
  // estrofes seguidas dão exatamente o mesmo cabeçalho e o operador perde a
  // única referência de onde está na música.
  if (lyricProjecting()) {
    npNameInnerEl.textContent = lyricSession.title
      + ' · ' + (lyricSession.idx + 1) + '/' + lyricSession.stanzas.length;
    applyTitleMarquee();
    // A MESMA regra do cronômetro logo acima: o ▶/⏸ segue o áudio de fundo
    // (que continua por baixo do texto) e o seek fica com quem já o governa
    // (previewTick/display-status). Forçar ▶ fixo e seek desabilitado fazia o
    // transporte piscar até o próximo tick quando havia áudio tocando.
    playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
    renderSimple();
    pushNowPlaying();
    return;
  }
  // Mensagem EM EXIBIÇÃO: mostra "Mensagem" no now-playing.
  if (msgSession && msgSession.projecting) {
    npNameInnerEl.textContent = 'Mensagem ' + (msgSession.idx + 1);
    applyTitleMarquee();
    playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
    renderSimple();
    pushNowPlaying();
    return;
  }
  // Texto bíblico EM EXIBIÇÃO: mostra a referência (livro cap:versículo). Antes
  // de ativar a exibição (só selecionado), o telão ainda não mostra a Bíblia,
  // então o now-playing segue a mídia/estado normal.
  if (bibleSession && bibleSession.projecting) {
    const v = bibleSession.verses[bibleSession.idx];
    npNameInnerEl.textContent = bibleSession.bookName + ' ' + bibleSession.chapter + ':' + v.n;
    applyTitleMarquee();
    // Mesma regra do cronômetro: ▶/⏸ acompanha o áudio de fundo e o seek não
    // é tocado aqui (ver o comentário no ramo da letra avulsa).
    playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
    renderSimple();
    pushNowPlaying();
    return;
  }
  // Prioriza plItems/libItems (já carregados); usa currentItem como fallback
  // para o caso de o item estar somente em outra aba (ex: dentro de uma pasta).
  const cur = [...plItems, ...libItems].find((m) => m.id === currentId) || currentItem;
  // A apresentação leva a PÁGINA no título, pela mesma razão da letra avulsa
  // logo acima: sem o número, duas páginas seguidas dão o mesmo cabeçalho e o
  // operador perde a única referência de onde está no material.
  npNameInnerEl.textContent = cur
    ? (isDeck(cur) ? cur.name + ' · ' + (deckPagina + 1) + '/' + cur.pages.length : cur.name)
    : 'Nada em exibição';
  applyTitleMarquee();
  playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
  const isTimed = cur && (cur.kind === 'video' || cur.kind === 'audio');
  seekEl.disabled = !isTimed;
  renderSimple();
  pushNowPlaying();
}

// Título rolante: se o nome da mídia não couber na largura disponível, liga a
// animação de rolagem (ping-pong) para que o operador possa lê-lo inteiro.
// Mede no estado estático (a leitura de scrollWidth força o reflow, que também
// reinicia a animação ao religar a classe). A distância e a duração (velocidade
// ~constante) vão para o CSS via variáveis.
function applyTitleMarquee() {
  npNameEl.classList.remove('scrolling');
  npNameInnerEl.style.removeProperty('--np-shift');
  npNameInnerEl.style.removeProperty('--np-dur');
  const overflow = npNameInnerEl.scrollWidth - npNameEl.clientWidth;
  if (overflow > 4) {
    const shift = overflow + 12; // +margem para o fim do texto sair da borda
    const dur = Math.max(5, shift / 32 + 2);
    npNameInnerEl.style.setProperty('--np-shift', (-shift) + 'px');
    npNameInnerEl.style.setProperty('--np-dur', dur.toFixed(1) + 's');
    npNameEl.classList.add('scrolling');
  }
}

// ===== Notificação de controles / tela de bloqueio (só no app) =====
// Espelha para o sistema o que está no ar. O título sai do PRÓPRIO elemento já
// renderizado (`#npName`), não de uma segunda árvore de decisão: as três
// origens possíveis (mídia, versículo, mensagem) já são resolvidas em
// `renderNowPlaying`, e duplicar essa lógica aqui era garantir que as duas
// versões divergissem com o tempo.
//
// `slideMode` é o que decide se ⏮/⏭ passam MÍDIA ou ESTROFE — na notificação só
// cabem três botões no modo compacto, e com uma letra/versículo/mensagem em
// cena é a estrofe que o operador está passando.
//
// A POSIÇÃO fica fora da chave de deduplicação porque a sessão de mídia
// extrapola o tempo sozinha (posição + decorrido × velocidade) — reenviar a
// cada segundo só para mexer o cursor seria desperdício. Mas um SEEK é uma
// descontinuidade que a extrapolação não tem como adivinhar: pular uma estrofe
// deixava a barra contando a partir do ponto ANTIGO, mostrando um tempo falso
// até a próxima mudança de estado.
//
// Em vez de avisar em cada ponto que faz seek (slide, barra, gesto, re-sincronia
// com o Display), compara-se aqui o tempo real com o que a sessão estaria
// extrapolando: divergiu além da tolerância, republica. Um só lugar cobre todas
// as causas, inclusive as que ainda não existem. A tolerância absorve o jitter
// normal do `display-status`, que chega com latência variável.
const POS_TOL_MS = 1500;
let lastScene = '';
let lastPosMs = 0, lastPosAt = 0, lastPosPlaying = false;
function pushNowPlaying() {
  if (!window.__NATIVE__) return;
  const who = slideTarget();
  // CENA é tudo que está no telão, não só mídia. Cronômetro e sorteio ficavam
  // de fora: `renderNowPlaying` já os trata como cena (escreve "Cronômetro" no
  // título e chama esta função), mas aqui `active` dava false e o Kotlin
  // derrubava a sessão de mídia. O efeito não é a projeção cair no meio — uma
  // vez que qualquer mídia foi tocada, `currentId` nunca mais volta a null e a
  // cena segue ativa —, é o caso da sessão RECÉM-ABERTA: projetar a contagem
  // regressiva de abertura sem ter selecionado mídia nenhuma não LEVANTA o
  // serviço em primeiro plano, e o processo (com a `Presentation` junto)
  // continua descartável sob pressão de memória exatamente durante os dez
  // minutos em que o operador minimiza o app para esperar.
  const active = !!currentId
    || !!(msgSession && msgSession.projecting)
    || !!(bibleSession && bibleSession.projecting)
    || lyricProjecting()
    || chronoProjecting()
    || drawProjecting();
  const subtitle = who === 'bible' ? 'Bíblia'
    : who === 'songlyrics' ? 'Letra (sem música)'
    : who === 'message' ? 'Mensagem'
    : who === 'lyrics' ? 'Letra sincronizada'
    : (plItems.length > 1 && currentId)
      ? 'Playlist · ' + (plItems.findIndex((m) => m.id === currentId) + 1) + ' de ' + plItems.length
      : '';
  // Posição e duração saem da PRÓPRIA barra de progresso, não de um cálculo
  // paralelo: ela já é mantida em dia pelos três caminhos (tick da preview,
  // display-status e tick do YouTube) e é a única fonte que cobre todos os
  // tipos de mídia — `preview.getDuration()` é do `<video>` do stage e não
  // sabe nada de um vídeo do YouTube. Desabilitada = sem linha do tempo
  // (imagem, versículo, mensagem): zera, para o sistema não desenhar uma barra
  // que não significa nada.
  const temTempo = !seekEl.disabled;
  const cena = {
    active,
    title: npNameInnerEl.textContent || '',
    subtitle,
    playing,
    slideMode: !!who,
    // Como o operador CHAMA o que ⏮/⏭ passam agora. A notificação escrevia
    // "(estrofe)" sempre, e com uma APRESENTAÇÃO em cena isso é simplesmente
    // outra palavra — o que passa ali é página. Num shell antigo o campo é
    // ignorado e o rótulo volta a ser o de sempre.
    //
    // A palavra sai da MESMA tabela que nomeia os botões da tela
    // (`SLIDE_AXIS_NAME`): são a mesma pergunta feita em dois lugares, e a
    // cópia local respondia "estrofe" para um versículo e para uma mensagem.
    slideLabel: SLIDE_AXIS_NAME[who] || 'estrofe',
    wallpaper: view === 'wallpaper',
    positionMs: temTempo ? Math.round((parseFloat(seekEl.value) || 0) * 1000) : 0,
    durationMs: temTempo ? Math.round((parseFloat(seekEl.max) || 0) * 1000) : 0,
  };
  // A posição fica FORA da chave de deduplicação de propósito: a sessão de
  // mídia extrapola o tempo sozinha a partir do último estado e da velocidade
  // (1x tocando), então reenviar a cada segundo só para mexer o cursor seria
  // desperdício. O que precisa chegar é toda MUDANÇA de estado.
  const chave = JSON.stringify([cena.active, cena.title, cena.subtitle,
    cena.playing, cena.slideMode, cena.wallpaper, cena.durationMs]);
  const agora = Date.now();
  const extrapolado = lastPosAt
    ? lastPosMs + (lastPosPlaying ? agora - lastPosAt : 0)
    : null;
  // Arrastando a barra, `seekEl.value` é a posição do DEDO e não a da mídia —
  // republicar aí encheria a sessão de instantes que ainda não aconteceram.
  const saltou = !seeking
    && (extrapolado === null || Math.abs(cena.positionMs - extrapolado) > POS_TOL_MS);
  if (chave === lastScene && !saltou) return;
  lastScene = chave;
  lastPosMs = cena.positionMs;
  lastPosAt = agora;
  lastPosPlaying = cena.playing;
  AVNative.nowPlaying(cena);
}

// `playing` e o ícone do ▶/⏸ andam SEMPRE juntos — e a notificação de
// controles precisa saber da troca. Eram sete pontos repetindo as mesmas duas
// linhas, e nenhum deles avisava o nativo: a sessão de mídia nascia "pausada" e
// ficava assim para sempre. Isso produzia dois sintomas de uma vez — o ícone na
// notificação nunca mudava, e o estado que o SISTEMA acreditava divergia do
// real, fazendo `onPlay`/`onPause` caírem nas guardas de `__avRemote` e virarem
// no-op. ⏮/⏭ seguiam funcionando por não dependerem desse estado, que foi
// exatamente o padrão observado em aparelho.
function setPlaying(v) {
  playing = !!v;
  playPauseEl.querySelector('.msym').textContent = playing ? ICON.pause : ICON.play;
  renderSimple();   // o botão do modo simplificado espelha este
  pushNowPlaying();
}

// Reenvia a cena mesmo sem mudança de estado — usado quando há indício de que
// o que o sistema mostra ficou para trás (ver `__avRemote`).
function resyncScene() {
  lastScene = '';
  pushNowPlaying();
}

function renderTabs() {
  // Favoritos não tem aba própria (o `activeTab` continua sendo 'folders'): é
  // uma sub-tela do Cronograma (entra-se pelo botão no fim da lista, e o voltar
  // retorna pra lá). Manter o Cronograma aceso enquanto se está nela evita uma
  // faixa de abas sem nada marcado.
  const shown = activeTab === 'folders' ? 'imports' : activeTab;
  tabsEl.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === shown));
  moveTabIndicator();
}

// Põe o vazado (`.tab-ind`) sobre a aba ativa. Ele é UM elemento para os três
// alvos justamente para poder DESLIZAR entre eles — a transição está no CSS;
// aqui só se escreve para onde ir.
//
// Medido, não calculado por fração: `offsetLeft`/`offsetWidth` da célula ativa
// valem para qualquer arranjo da faixa, enquanto um "25% por aba" seria uma
// suposição sobre a contagem de alvos que quebraria calada no dia em que um
// deles mudasse de tamanho ou sumisse.
//
// `animar = false` para POUSAR em vez de viajar: na primeira medição e num
// `resize`, uma transição faria o vazado atravessar a tela vindo da borda
// esquerda (onde ele nasce, com largura 0).
function moveTabIndicator(animar) {
  const alvo = tabsEl.querySelector('.tab.active');
  // Sem largura = faixa oculta (modo simplificado esconde a caixa de
  // controles). Medir ali daria 0 e apagaria a posição boa que já está lá.
  if (!alvo || !alvo.offsetWidth) return;
  if (animar === false) {
    tabsEl.classList.add('no-anim');
    // Força o reflow ANTES de escrever a posição nova: sem isto o navegador
    // agrupa a classe e o valor na mesma passada e a transição roda mesmo
    // assim.
    void tabsEl.offsetWidth;
  }
  tabsEl.style.setProperty('--tab-x', alvo.offsetLeft + 'px');
  tabsEl.style.setProperty('--tab-w', alvo.offsetWidth + 'px');
  if (animar === false) {
    void tabsEl.offsetWidth;
    tabsEl.classList.remove('no-anim');
  }
}

// O cabeçalho da LISTA (a faixa de cima da tela avançada). Ficou com três
// elementos desde a v5.53 — voltar, título e a troca de modo — porque a busca
// da pasta e o botão de sincronizar foram com os Favoritos para a gaveta, e
// eram eles que faziam desta faixa a mais disputada do app. Quem cuida do
// cabeçalho DA GAVETA é `renderFavHeader`.
function renderListTitle() {
  renderFavHeader();
  // A TROCA DE MODO SÓ EXISTE NO CRONOGRAMA (v5.111). Ela é a saída do modo
  // avançado, e sair de um modo pelo meio dele — da grade de livros da Bíblia,
  // de dentro do sorteio — é pular dois degraus de uma vez. O Cronograma é a
  // tela INICIAL e é onde o voltar desemboca (a escada de `__avBack` termina em
  // "aba diferente do Cronograma → volta para ele"), então quem quer o Modo
  // Fácil já passa por aqui de qualquer jeito. Nas outras abas o botão era
  // sobretudo um alvo grande do lado esquerdo, esperando um toque errado.
  // O 'folders' cai no ramo do Cronograma: com a gaveta aberta, a tela ATRÁS
  // dela é o Cronograma, e é o cabeçalho dele que está por baixo.
  //
  // Ele fica VAGO, não `hidden`: a classe esconde por `visibility`, que preserva
  // a caixa (e tira o botão do toque, do foco e da árvore de acessibilidade).
  // Com `display: none` o título — que é centrado no espaço que sobra — pulava
  // uns 60px para a esquerda a cada deslize entre abas, e um nome de tela que
  // muda de lugar é o oposto do que ele existe para fazer.
  fullSimpleBtnEl.classList.toggle('mode-switch--vago',
    activeTab === 'mic' || activeTab === 'bible');
  if (activeTab === 'mic') {
    backBtnEl.hidden = true;
    // "Ferramentas" desde a v5.51 — "Diversos" nomeava a aba pelo que ela NÃO
    // é (nem acervo, nem Bíblia, nem Cronograma). O `activeTab` segue `'mic'` e
    // as funções seguem `renderDiversos`/`refreshDiversos`: é a MESMA razão do
    // `data-tab="mic"` — trocar a string interna não muda nada visível e
    // esbarraria em `TAB_ORDER`, `scrollKey()` e nas guardas espalhadas.
    listTitleEl.hidden = false; listTitleEl.textContent = 'Ferramentas';
    return;
  }
  if (activeTab === 'bible') {
    backBtnEl.hidden = bibleScreen === 'books';
    // A aba Bíblia era a ÚNICA sem título: ele saíra para liberar espaço numa
    // faixa que também carregava o indicador de versão. A versão desceu para
    // Configurações (v5.49) e a faixa passou a sobrar — e uma tela sem nome é
    // a única do app em que "onde eu estou" depende de reconhecer a grade.
    listTitleEl.hidden = false; listTitleEl.textContent = 'Bíblia';
    return;
  }
  // Com a gaveta aberta o `activeTab` é 'folders', mas a tela ATRÁS dela
  // continua sendo o Cronograma — e é o nome dele que o cabeçalho de baixo tem
  // de mostrar. Mesmo raciocínio do `renderTabs`, que mantém a aba Cronograma
  // acesa enquanto os Favoritos estão em cena.
  backBtnEl.hidden = true;
  listTitleEl.hidden = false;
  listTitleEl.textContent = 'Cronograma';
}

// Cabeçalho da gaveta de Favoritos: quem ele mostra depende de estar na raiz
// (atalhos + pastas) ou dentro de um atalho/pasta.
function renderFavHeader() {
  const inFolder = activeTab === 'folders' && currentFolder !== null;
  const inOpfs = inFolder && !!currentFolder._opfs;
  favBackEl.hidden = !inFolder;
  // O ícone de estrela é a IDENTIDADE da gaveta; dentro de uma pasta quem
  // ocupa aquele lugar é o voltar, e dois símbolos lado a lado no mesmo canto
  // só competiriam.
  favIconEl.hidden = inFolder;
  favTitleEl.textContent = inFolder ? currentFolder.name : 'Favoritos';
  // Sincronizar é ação da RAIZ (escolher uma pasta do dispositivo); dentro de
  // uma pasta a re-sincronização mora na própria linha dela, na raiz.
  addDirBtnEl.hidden = !(activeTab === 'folders' && !inFolder);
  // A busca é do catálogo em memória de uma pasta do dispositivo — só existe lá.
  favSearchBarEl.hidden = !inOpfs;
  libSearchEl.value = inOpfs ? folderQuery : '';
}

// ---- thumb element ----
function thumbEl(item) {
  const t = document.createElement('div');
  t.className = 'thumb';
  if (item.thumb && typeof item.thumb === 'string') {
    // URL string thumb (e.g. YouTube hqdefault)
    const im = document.createElement('img'); im.src = item.thumb; im.alt = '';
    t.appendChild(im);
  } else if (item.thumb) {
    const url = URL.createObjectURL(item.thumb);
    thumbUrlsAtual.push(url);
    const im = document.createElement('img'); im.src = url; im.alt = '';
    t.appendChild(im);
  } else {
    t.appendChild(msym(item.kind === 'audio' ? ICON.music : ICON.broken));
    t.classList.add('thumb--icon');
  }
  return t;
}

// ---- Playlist (sequência) ----
function renderPlaylist() {
  const count = plItems.length;
  // O badge (e a cor do ícone) não devem chamar atenção quando a playlist é só
  // a mídia atual (1 item); conta apenas os itens além do primeiro (2 itens →
  // "1", 3 → "2"...) — mesmo critério pros dois, o ícone só fica destacado
  // quando existe de fato uma fila além do item em exibição.
  plCountEl.textContent = count > 1 ? String(count - 1) : '';
  plPopupCountEl.textContent = String(count);
  plBtnEl.classList.toggle('has-items', count > 1);

  playlistEl.innerHTML = '';
  if (count === 0) {
    // O texto mandava DESLIZAR o item para a esquerda — o gesto saiu na v5.50
    // (ver `attachRowGestures`) e a frase ficou para trás, ensinando ao
    // operador um caminho que não existe mais. Hoje se acrescenta pela seleção
    // múltipla ou pela folha de destinos do acervo.
    playlistEl.innerHTML = '<li class="empty">Playlist vazia.<br>Segure um item da lista para selecioná-lo'
      + '<br>e toque em "Acrescentar à playlist".</li>';
    return;
  }
  plItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'row-item' + (item.id === currentId ? ' active' : '');
    li.dataset.id = item.id;

    const row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = item.name;
    const rm = document.createElement('button'); rm.className = 'row-btn'; rm.title = 'Tirar da playlist';
    rm.appendChild(msym(ICON.plRemove));
    rm.addEventListener('click', async (e) => { e.stopPropagation(); await AVDB.listRemove('playlist', item.id); load(); });
    const handle = document.createElement('button'); handle.className = 'row-handle'; handle.title = 'Arraste para reordenar';
    handle.appendChild(msym(ICON.drag));

    row.append(name, rm, handle);
    li.appendChild(row);
    row.addEventListener('click', (e) => { if (!e.target.closest('.row-btn,.row-handle')) send(item.id); });
    attachHandle(handle, item.id, 'playlist');
    playlistEl.appendChild(li);
  });
}

// ---- Biblioteca (Cronograma / Favoritos) ----
// ===== Bíblia: metadados, seleção (tabela periódica) e download =====

// Garante a lista de versões (pt_bible_version) e de livros (pt_bible_book) —
// baixadas na 1ª vez e cacheadas em state; offline reusa o cache. Silenciosa
// (uma falha de rede só mantém o que já houver). A seleção de livros/capítulos
// funciona mesmo sem isso (Bible.BOOKS é offline); versões/ids reais só são de
// fato necessários no download do capítulo.
async function ensureBibleMeta(force) {
  // versões
  if (!bibleVersions.length) bibleVersions = (await AVDB.getState('bibleVersions')) || [];
  if (!bibleVersions.length || force) {
    try {
      const fetched = await Bible.fetchVersions();
      if (fetched.length) { bibleVersions = fetched; await AVDB.setState('bibleVersions', fetched); }
    } catch (_) {}
  }
  // versão selecionada (padrão: Almeida Revista e Atualizada — ver
  // pickDefaultBibleVersion; senão a 1ª disponível)
  if (bibleVersionId == null) {
    const saved = await AVDB.getState('bibleVersion');
    bibleVersionId = (saved != null && bibleVersions.some((v) => v.id === saved))
      ? saved : pickDefaultBibleVersion(bibleVersions);
  }
  // livros (ids reais)
  if (!bibleBooksOnline) bibleBooksOnline = (await AVDB.getState('bibleBooks')) || null;
  if (!bibleBooksOnline || force) {
    try {
      const fetched = await Bible.fetchBooks();
      if (fetched.length) { bibleBooksOnline = fetched; await AVDB.setState('bibleBooks', fetched); }
    } catch (_) {}
  }
  // Completude offline de TODAS as versões (pra resumir na lista de seleção).
  // O próprio Set é o cache: versão que já está nele não volta ao IDB (uma
  // versão completa não "des-completa", e os downloads que completam uma já a
  // adicionam na hora — ver ensureBibleVersionDownloaded). As leituras que
  // restam saem em paralelo: são independentes, e em série este laço pagava
  // uma ida ao IDB por versão a cada entrada na aba.
  await Promise.all(bibleVersions
    .filter((v) => !bibleCompleteVersions.has(v.id))
    .map(async (v) => {
      if (await AVDB.getState('bibleComplete:' + v.id)) bibleCompleteVersions.add(v.id);
    }));
  if (activeTab === 'bible') renderLibrary();
}

// Versão padrão: Almeida Revista e Atualizada (RA/ARA) quando existir no banco,
// senão a primeira disponível.
function pickDefaultBibleVersion(versions) {
  if (!versions.length) return null;
  const ra = versions.find((v) => /revista\s+e\s+atualizada|\bara\b|(^|\s)ra(\s|$)/i.test(v.name || ''));
  return (ra || versions[0]).id;
}

// Popup de seleção de versão (bottom-sheet) — a lista não fica mais toda
// exposta em chips; um botão com a versão atual abre esta lista.
function openBibleVerPopup() {
  renderBibleVerList();
  bibleVerPopupEl.classList.add('open');
}
function closeBibleVerPopup() { bibleVerPopupEl.classList.remove('open'); }
function renderBibleVerList() {
  bibleVerListEl.innerHTML = '';
  bibleVersions.forEach((v) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'row bible-ver-row' + (v.id === bibleVersionId ? ' selected' : '');
    // nome + status offline resumido (completa / baixando / —)
    const main = document.createElement('span'); main.className = 'bible-ver-main';
    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = v.name;
    const st = document.createElement('span'); st.className = 'bible-ver-status';
    if (bibleCompleteVersions.has(v.id)) { st.textContent = '✓ Completa offline'; st.classList.add('done'); }
    else if (bibleDl && bibleDl.running && bibleDl.versionId === v.id) { st.textContent = 'Baixando ' + bibleDl.done + '/' + bibleDl.total + '…'; }
    else { st.textContent = 'Baixa ao usar'; }
    main.append(name, st);
    row.appendChild(main);
    if (v.id === bibleVersionId) { const chk = document.createElement('span'); chk.textContent = '✓'; chk.className = 'bible-ver-check'; row.appendChild(chk); }
    row.addEventListener('click', () => {
      closeBibleVerPopup();
      changeBibleVersion(v.id); // troca + recarrega o capítulo atual na nova versão
    });
    li.appendChild(row);
    bibleVerListEl.appendChild(li);
  });
}

// Entrada na aba Bíblia: garante os metadados e dispara o download da versão
// INTEIRA na 1ª vez (em segundo plano) — ver ensureBibleVersionDownloaded.
async function enterBibleTab() {
  // Armazenamento persistente (mesma proteção do sync de músicas/pastas): pede
  // ao browser para NÃO descartar a origin sob pressão de espaço — garante que
  // a Bíblia baixada (cache IDB em 'bible:<v>_<b>_<c>') sobreviva entre sessões.
  // persist() é da origin inteira (não por store) e idempotente.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await ensureBibleMeta(false);
  if (bibleVersionId != null) ensureBibleVersionDownloaded(bibleVersionId);
}

// Baixa a versão INTEIRA da Bíblia (todos os capítulos de todos os livros) na
// 1ª vez que ela é usada — em segundo plano, resumível (pula o que já está em
// cache), concorrência limitada (runLimited, 5). O texto de cada capítulo é
// leve (só versículos, sem mídia), então o volume total é modesto. O progresso
// (bibleDl) aparece na tela de livros; ao terminar sem falhas, marca
// state['bibleComplete:<v>'] pra não refazer. A leitura por capítulo
// (loadBibleChapter) continua funcionando sob demanda se o operador abrir um
// capítulo antes de o download em massa chegar nele.
async function ensureBibleVersionDownloaded(versionId) {
  if (versionId == null) return;
  // Já baixando esta versão, ou já completa: nada a fazer.
  if (bibleDl && bibleDl.running && bibleDl.versionId === versionId) return;
  if (bibleCompleteVersions.has(versionId)) return;
  if (await AVDB.getState('bibleComplete:' + versionId)) { bibleCompleteVersions.add(versionId); return; }
  await ensureBibleMeta(false); // garante os ids reais dos livros

  // Lista de todos os capítulos (livro × capítulo).
  const items = [];
  Bible.BOOKS.forEach((b, i) => {
    const bId = bibleBookId(i);
    // `bookName` só serve para a notificação mostrar "Gênesis 3" em vez de um id.
    for (let c = 1; c <= b.chapters; c++) items.push({ bId, chapter: c, bookName: b.name });
  });
  const total = items.length;

  // O que JÁ está em cache, numa transação só e sem ler valor nenhum. Antes
  // eram 1189 `getState` — 1189 transações desserializando o capítulo inteiro
  // só para testar existência —, refeitos a CADA entrada na aba sempre que a
  // flag `bibleComplete` não estivesse marcada.
  const prefix = 'bible:' + versionId + '_';
  let cached = null;
  try {
    cached = new Set((await AVDB.stateKeys(prefix)).map((k) => String(k).slice(prefix.length)));
  } catch (_) { /* sem getAllKeys (improvável): o teste volta a ser por capítulo */ }
  const missing = cached
    ? items.filter((it) => !cached.has(it.bId + '_' + it.chapter))
    : items;

  // Tudo em cache: marca a flag e encerra. Isso conserta o caso em que uma
  // única falha de rede num download anterior condenava a versão a revarrer
  // para sempre — a flag só era gravada com `failed === 0`, e nunca era
  // reavaliada depois.
  if (!missing.length) {
    await AVDB.setState('bibleComplete:' + versionId, true);
    bibleCompleteVersions.add(versionId);
    return;
  }

  let done = total - missing.length, failed = 0;
  // Sequência monotônica: cada invocação ganha a sua, e uma varredura superada
  // nunca mais volta a valer (ver o guard do worker abaixo). Trocar `bibleDl`
  // por si só não bastava — a igualdade de versão é reversível.
  const runSeq = ++bibleDlSeq;
  bibleDl = { versionId, total, done, running: true, seq: runSeq };
  refreshBibleDl();

  // 1189 capítulos: é o download mais longo do app e o que mais sofria com o
  // congelamento do processo ao minimizar.
  const notifId = bgTaskStart('Bíblia · ' + (bibleVersionName(versionId) || 'versão'), missing.length);
  // `bgTaskEnd` dentro do `withBgWork` — mesma ordem de syncGroup/syncCollection:
  // o `finally` de withBgWork roda primeiro e já limpa o registro de tarefas.
  await withBgWork(async () => {
   try {
    await runLimited(missing, NET_CONCURRENCY, async (it) => {
    // Guard por SEQUÊNCIA, não por igualdade de versão: o teste antigo
    // (`bibleDl.versionId !== versionId`) era reversível — trocar de versão e
    // VOLTAR fazia os workers da varredura antiga, ainda em voo, passarem no
    // teste de novo e retomarem em paralelo com a nova. Pior, a antiga
    // terminava primeiro e, como os capítulos que ela pulou saíam pelo
    // `return` sem contar falha, gravava `bibleComplete` sobre uma varredura
    // incompleta — flag persistida, versão nunca mais completada.
    if (!bibleDl || !bibleDl.running || bibleDl.seq !== runSeq) { failed++; return; }
    const key = prefix + it.bId + '_' + it.chapter;
    const nome = (it.bookName || '') + ' ' + it.chapter;
    bgItemStart(notifId, nome);
    try {
      // Só quando não houve varredura de chaves (fallback): confere um a um.
      if (!cached && (await AVDB.getState(key))) { done++; return; }
      const vs = await Bible.fetchChapter(versionId, it.bId, it.chapter);
      if (vs.length) await AVDB.setState(key, { verses: vs, syncedAt: Date.now() });
      else failed++;
    } catch (_) { failed++; }
    finally { bgItemEnd(notifId, nome); }
    done++;
    bgTaskStep(notifId, done - (total - missing.length));
    if (bibleDl && bibleDl.seq === runSeq) { bibleDl.done = done; refreshBibleDl(); }
    });
   } finally { bgTaskEnd(notifId); }
  });

  if (bibleDl && bibleDl.seq === runSeq) {
    bibleDl.running = false;
    if (failed === 0) { await AVDB.setState('bibleComplete:' + versionId, true); bibleCompleteVersions.add(versionId); }
    refreshBibleDl();
  }
}

// O status offline/progresso do download aparece SÓ dentro do popup de seleção
// de versão (`.bible-ver-status` por versão) — não disputa espaço com a leitura.
// Enquanto o download roda, re-renderiza a lista se o popup estiver aberto.
function refreshBibleDl() {
  if (bibleVerPopupEl.classList.contains('open')) renderBibleVerList();
}

// Ordem das telas da Bíblia (pra direção do slide de transição).
// Capítulo e versículo convivem numa tela só (`chapters`, dividida ao meio na
// vertical): escolher o capítulo e o versículo é um gesto só, e voltar da
// leitura mostra os dois de uma vez, marcados na grade.
const BIBLE_SCREENS = ['books', 'chapters', 'reading'];

// Navega entre as telas da Bíblia sem recarregar o IDB inteiro (só re-render):
// guarda o scroll, volta ao topo e faz um leve slide direcional (fundo → frente
// desliza da direita; voltar, da esquerda).
function gotoBibleScreen(screen) {
  const dir = BIBLE_SCREENS.indexOf(screen) >= BIBLE_SCREENS.indexOf(bibleScreen) ? 1 : -1;
  bibleScreen = screen;
  renderLibrary();
  renderListTitle();
  libraryEl.scrollTop = 0;
  animateTabSwitch(dir); // mesma animação de deslize das abas (genérica em #library)
}

function renderBible() {
  const wrap = document.createElement('div');
  // A tela de livros preenche a altura disponível (grade compacta, sem scroll);
  // as demais rolam normalmente se precisarem (ex.: Salmos, 150 capítulos).
  // Todas as telas preenchem a altura disponível e cabem sem scroll (ver
  // .bible-wrap em controle.css).
  wrap.className = 'bible-wrap';
  if (bibleScreen === 'chapters') renderBibleChapters(wrap);
  else if (bibleScreen === 'reading') renderBibleReading(wrap);
  else renderBibleBooks(wrap);
  libraryEl.appendChild(wrap);
}

function bibleCell(sym, opts) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'bible-cell' + (opts && opts.cls ? ' ' + opts.cls : '') + (opts && opts.active ? ' active' : '');
  const s = document.createElement('span'); s.className = 'bible-cell-sym'; s.textContent = sym;
  cell.appendChild(s);
  if (opts && opts.name) {
    const nm = document.createElement('span'); nm.className = 'bible-cell-name'; nm.textContent = opts.name;
    cell.appendChild(nm);
  }
  return cell;
}

function renderBibleBooks(wrap) {
  // (O seletor de versão e o status de download saíram daqui — moram na tela de
  // leitura, dando mais espaço para a grade de livros. Ver renderBibleReading.)
  const grid = document.createElement('div'); grid.className = 'bible-grid bible-grid--books';
  Bible.BOOKS.forEach((b, i) => {
    // Só a abreviação (sem o nome completo) — fonte maior, ver .bible-grid--books.
    const cell = bibleCell(b.abbr, { cls: 'bg-' + b.g });
    cell.title = b.name;
    cell.addEventListener('click', () => { bibleSel = { bookIdx: i, chapter: 0 }; gotoBibleScreen('chapters'); });
    grid.appendChild(cell);
  });
  wrap.appendChild(grid);
}

// Capítulo e versículo na MESMA tela, dividida ao meio na vertical: em cima a
// grade de capítulos, embaixo a de versículos do capítulo escolhido. O nome do
// livro fica em destaque no topo — sem ele, uma tela só de números não diz em
// que livro o operador está.
//
// As duas grades marcam a seleção atual (`.active`), então **voltar da leitura
// mostra de imediato o capítulo E o versículo que estão no ar**, sem o
// operador ter que se localizar.
function renderBibleChapters(wrap) {
  const book = Bible.BOOKS[bibleSel.bookIdx];
  if (!book) { gotoBibleScreen('books'); return; }

  const head = document.createElement('div'); head.className = 'bible-book-head';
  const nm = document.createElement('span'); nm.className = 'bible-book-name'; nm.textContent = book.name;
  head.appendChild(nm);
  if (bibleSel.chapter) {
    const ref = document.createElement('span'); ref.className = 'bible-book-ref';
    ref.textContent = 'Capítulo ' + bibleSel.chapter;
    head.appendChild(ref);
  }
  wrap.appendChild(head);

  const split = document.createElement('div'); split.className = 'bible-split';

  // ---- metade de cima: capítulos ----
  const top = document.createElement('div'); top.className = 'bible-half';
  const cGrid = document.createElement('div'); cGrid.className = 'bible-grid bible-grid--num bible-grid--chapters';
  for (let c = 1; c <= book.chapters; c++) {
    const cell = bibleCell(String(c), { cls: 'bible-cell--num', active: bibleSel.chapter === c });
    cell.addEventListener('click', () => {
      if (bibleSel.chapter === c) return;
      bibleSel.chapter = c;
      renderLibrary();          // marca o capítulo já; a metade de baixo mostra "Baixando…"
      loadBibleChapter();
    });
    cGrid.appendChild(cell);
  }
  top.appendChild(cGrid);

  // ---- metade de baixo: versículos ----
  const bottom = document.createElement('div'); bottom.className = 'bible-half';
  bottom.appendChild(bibleVersesPane());

  split.append(top, bottom);
  wrap.appendChild(split);
  requestAnimationFrame(() => {
    scrollActiveIntoView(cGrid);
    scrollActiveIntoView(bottom.querySelector('.bible-grid--verses'));
  });
}

// Rola cada grade até a célula marcada. As duas podem ser longas (Salmos tem
// 150 capítulos, o 119 tem 176 versículos), e voltar da leitura tem que
// mostrar onde se está sem o operador procurar.
function scrollActiveIntoView(grid) {
  const active = grid && grid.querySelector('.bible-cell.active');
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'center' });
}

// A metade de baixo: grade de versículos do capítulo selecionado, ou o estado
// em que ela está (nada escolhido / baixando / erro / capítulo vazio).
function bibleVersesPane() {
  const note = (text, err) => {
    const n = document.createElement('div');
    n.className = 'bible-note' + (err ? ' err' : '');
    n.textContent = text;
    return n;
  };
  if (!bibleSel.chapter) return note('Nenhum capítulo selecionado.');
  if (bibleChapterLoading) return note('Baixando versículos…');
  if (bibleChapterError) return note(bibleChapterError, true);
  const verses = bibleChapterData && bibleChapterData.verses ? bibleChapterData.verses : [];
  if (!verses.length) return note('Nenhum versículo neste capítulo.');

  const onThisChapter = bibleSession
    && bibleSession.bookIdx === bibleSel.bookIdx && bibleSession.chapter === bibleSel.chapter;
  const grid = document.createElement('div'); grid.className = 'bible-grid bible-grid--num bible-grid--verses';
  verses.forEach((v, i) => {
    const cell = bibleCell(String(v.n), {
      cls: 'bible-cell--num',
      active: onThisChapter && bibleSession.idx === i,
    });
    cell.addEventListener('click', () => startBibleReading(i));
    grid.appendChild(cell);
  });
  return grid;
}

// Baixa (ou lê do cache) o texto do capítulo selecionado. Cacheado em
// state 'bible:<versao>_<livro>_<capitulo>' (baixado na 1ª vez que for usado).
async function loadBibleChapter() {
  const seq = ++bibleLoadSeq;
  bibleChapterData = null; bibleChapterError = ''; bibleChapterLoading = true;
  if (activeTab === 'bible') renderLibrary();
  await ensureBibleMeta(false);
  if (seq !== bibleLoadSeq) return;
  const vId = bibleVersionId;
  if (vId == null) {
    bibleChapterLoading = false;
    bibleChapterError = 'Nenhuma versão da Bíblia disponível. Conecte-se à internet uma vez para baixá-la.';
    if (activeTab === 'bible') renderLibrary();
    return;
  }
  const bId = bibleBookId(bibleSel.bookIdx);
  const key = 'bible:' + vId + '_' + bId + '_' + bibleSel.chapter;
  let cached = await AVDB.getState(key);
  if (!cached || !cached.verses || !cached.verses.length) {
    try {
      const vs = await Bible.fetchChapter(vId, bId, bibleSel.chapter);
      if (!vs.length) throw new Error('vazio');
      cached = { verses: vs, syncedAt: Date.now() };
      await AVDB.setState(key, cached);
    } catch (_) {
      if (seq !== bibleLoadSeq) return;
      bibleChapterLoading = false;
      bibleChapterError = (navigator.onLine === false)
        ? 'Sem internet — não foi possível baixar este capítulo.'
        : 'Não foi possível baixar este capítulo. Tente novamente.';
      if (activeTab === 'bible') renderLibrary();
      return;
    }
  }
  if (seq !== bibleLoadSeq) return;
  bibleChapterData = cached;
  bibleChapterLoading = false;
  if (activeTab === 'bible' && bibleScreen === 'chapters') renderLibrary();
}

// Inicia a leitura a partir do versículo `i` (índice na lista do capítulo):
// define a sessão e abre a tela de leitura — SEM exibir ainda (o texto só é
// projetado depois que o operador toca no versículo central; ver
// renderBibleReading / activateBibleVerse).
function startBibleReading(i) {
  if (!bibleChapterData || !bibleChapterData.verses.length) return;
  clearMsgSession(); // só um texto manual por vez (Bíblia × Mensagem)
  const book = Bible.BOOKS[bibleSel.bookIdx];
  bibleSession = {
    versionId: bibleVersionId,
    bookIdx: bibleSel.bookIdx,
    bookId: bibleBookId(bibleSel.bookIdx),
    bookName: book.name,
    chapter: bibleSel.chapter,
    verses: bibleChapterData.verses,
    idx: i,
    projecting: false,   // ainda não exibido; ativa ao tocar o central
  };
  bibleScreen = 'reading';
  renderListTitle();
  bibleRenderReading();
  animateTabSwitch(1); // desliza pra frente (verses → reading)
}

// Define o versículo central da leitura. Se a visualização já estiver ativa,
// EXIBE o novo versículo automaticamente; senão, só move o central na tela
// (sem projetar) — é o gate pedido: navegar entre anterior/próximo antes de
// ativar não mostra nada no telão.
function bibleSetIdx(idx) {
  const s = bibleSession;
  if (!s || idx < 0 || idx >= s.verses.length) return;
  s.idx = idx;
  if (s.projecting) projectBibleVerse(idx);
  else { renderNowPlaying(); renderSlideNav(); bibleRenderReading(); }
}

// O toque no versículo CENTRAL alterna a exibição pública: exibe se está
// fora do ar, tira do ar se está exibindo. É o mesmo gesto nos dois sentidos
// — quem acabou de projetar um versículo tem o dedo exatamente onde precisa
// para tirá-lo do telão, sem procurar outro controle.
//
// Tirar do ar NÃO encerra a sessão de leitura (diferente do stop ⏹): a
// seleção, o capítulo e o versículo central continuam onde estavam, e um
// novo toque volta a exibir. É a diferença entre "esconder" e "sair".
function toggleBibleVerse() {
  const s = bibleSession;
  if (!s) return;
  if (s.projecting) hideBibleVerse();
  else projectBibleVerse(s.idx);
}

// Tira a Escritura do telão mantendo a sessão viva.
function hideBibleVerse() {
  const s = bibleSession;
  if (!s || !s.projecting) return;
  s.projecting = false;
  // `text-hide` encerra só a Camada de Texto — um áudio de fundo, se houver,
  // segue tocando (ver "Independência do áudio" na arquitetura da camada).
  cmd({ type: 'text-hide' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  bibleRenderReading();
}

// Projeta o versículo de índice `idx` da sessão atual (Display + preview).
// Sempre marca a sessão como "exibindo" (projecting) — é o ato de mostrar.
function projectBibleVerse(idx) {
  const s = bibleSession;
  if (!s || idx < 0 || idx >= s.verses.length) return;
  clearChronoSession(); clearDrawSession();   // cartão único: um provedor por vez
  s.idx = idx;
  s.projecting = true;
  const v = s.verses[idx];
  const ref = s.bookName + ' ' + s.chapter + ':' + v.n;
  view = 'visual';   // projetar a Escritura sempre revela (desliga o wallpaper)
  persistCurrent();
  // Camada de texto unificada: modo 'verse' (sublinha = referência dourada).
  cmd({ type: 'text', mode: 'verse', main: v.text, sub: ref, view: 'visual' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  bibleRenderReading();
}

// Re-render só da tela de leitura (destaque do versículo central), preservando
// o scroll — usado tanto ao projetar quanto ao só mover o central.
function bibleRenderReading() {
  if (activeTab === 'bible' && (bibleScreen === 'reading' || bibleScreen === 'chapters')) {
    const sp = libraryEl.scrollTop;
    renderLibrary();
    libraryEl.scrollTop = sp;
  }
}

function bibleVersionName(id) {
  const v = bibleVersions.find((x) => x.id === id);
  return v ? v.name : '';
}

// Sigla da versão, para caber no seletor ao lado de livro/capítulo/versículo.
// Nomes como "Almeida Revista e Atualizada" ocupam a linha inteira; a sigla
// que todo mundo já usa (ARA) diz a mesma coisa em três letras. As regras, em
// ordem: um acrônimo entre parênteses no próprio nome é a melhor resposta
// possível; um nome de uma palavra já é a sigla; senão, as iniciais das
// palavras significativas (ignorando "e", "de", "na"…).
const BIBLE_ABBR_STOP = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'na', 'no', 'em', 'a', 'o', 'as', 'os', 'para', 'com']);
function bibleVersionAbbr(id) {
  const name = bibleVersionName(id);
  if (!name) return 'Versão';
  const paren = name.match(/\(([A-Za-zÀ-ÿ0-9]{2,6})\)/);
  if (paren) return paren[1].toUpperCase();
  const words = name.split(/[\s\-–]+/).filter(Boolean).filter((w) => !BIBLE_ABBR_STOP.has(w.toLowerCase()));
  if (!words.length) return name.slice(0, 5).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 5).toUpperCase();
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 5);
}

// Troca a versão da Bíblia (do seletor na tela de leitura). Recarrega o
// capítulo atual na nova versão, mantendo o versículo; reexibe se estava
// exibindo.
async function changeBibleVersion(id) {
  if (id == null || bibleVersionId === id) return;
  bibleVersionId = id;
  bibleAdjCache = {}; // vizinhos em cache eram da versão antiga
  await AVDB.setState('bibleVersion', id);
  ensureBibleVersionDownloaded(id);
  if (!bibleSession) { renderLibrary(); return; }
  const s = bibleSession;
  let verses;
  try { verses = await fetchBibleChapterCached(id, s.bookIdx, s.chapter); }
  catch (_) { renderLibrary(); return; }
  if (bibleSession !== s) return;
  s.versionId = id;
  s.verses = verses;
  s.idx = Math.min(s.idx, verses.length - 1);
  // INVALIDA qualquer `loadBibleChapter` em voo: sem isto, um capítulo lento
  // pedido antes desta troca voltava DEPOIS, passava na guarda de sequência
  // (que não havia mudado) e sobrescrevia `bibleChapterData` com os versículos
  // do capítulo/versão antigos sob o rótulo dos novos — e `startBibleReading`
  // monta a sessão a partir daí, projetando o versículo errado com a
  // referência certa. É o mesmo papel do `loadSeq` do stage.
  ++bibleLoadSeq;
  bibleChapterData = { verses };
  // …e zera o estado da grade: uma falha antiga ("Não foi possível baixar
  // este capítulo") continuava na metade de baixo da tela mesmo com o
  // capítulo novo já carregado e no ar.
  bibleChapterError = ''; bibleChapterLoading = false;
  if (s.projecting) projectBibleVerse(s.idx);
  else bibleRenderReading();
}

// Referência do capítulo vizinho (cruza para o próximo/anterior LIVRO nos
// extremos). null = fim/início da Bíblia.
function nextChapterRef(bookIdx, chapter) {
  const b = Bible.BOOKS[bookIdx];
  if (chapter < b.chapters) return { bookIdx, chapter: chapter + 1 };
  if (bookIdx < Bible.BOOKS.length - 1) return { bookIdx: bookIdx + 1, chapter: 1 };
  return null;
}
function prevChapterRef(bookIdx, chapter) {
  if (chapter > 1) return { bookIdx, chapter: chapter - 1 };
  if (bookIdx > 0) return { bookIdx: bookIdx - 1, chapter: Bible.BOOKS[bookIdx - 1].chapters };
  return null;
}

// Lê (do cache) ou baixa o texto de um capítulo — [{ n, text }]. Lança se não
// houver cache nem rede.
async function fetchBibleChapterCached(versionId, bookIdx, chapter) {
  const bId = bibleBookId(bookIdx);
  const key = 'bible:' + versionId + '_' + bId + '_' + chapter;
  let cached = await AVDB.getState(key);
  if (!cached || !cached.verses || !cached.verses.length) {
    const vs = await Bible.fetchChapter(versionId, bId, chapter);
    if (!vs.length) throw new Error('vazio');
    cached = { verses: vs, syncedAt: Date.now() };
    await AVDB.setState(key, cached);
  }
  return cached.verses;
}

// Move a sessão de leitura para outro capítulo (cruza livro nos extremos),
// baixando o texto se necessário.
// `want`: 'first' | 'last' | um índice (podendo ser NEGATIVO, contado a partir
// do fim — é como um salto de -2 que estourou o começo do capítulo chega aqui).
async function bibleGotoChapter(bookIdx, chapter, want) {
  const s = bibleSession;
  if (!s) return;
  let verses;
  try { verses = await fetchBibleChapterCached(s.versionId, bookIdx, chapter); }
  catch (_) { return; } // sem cache e sem rede: fica onde está
  if (!bibleSession || bibleSession !== s) return; // a sessão trocou durante o await
  const book = Bible.BOOKS[bookIdx];
  const wasProjecting = s.projecting;
  let idx;
  if (want === 'last') idx = verses.length - 1;
  else if (typeof want === 'number') idx = want < 0 ? verses.length + want : want;
  else idx = 0;
  idx = Math.max(0, Math.min(verses.length - 1, idx));
  bibleSession = {
    versionId: s.versionId, bookIdx, bookId: bibleBookId(bookIdx),
    bookName: book.name, chapter, verses, idx,
    projecting: wasProjecting,
  };
  // A seleção acompanha a leitura (grid de versículos e título seguem o capítulo).
  bibleSel = { bookIdx, chapter };
  bibleChapterData = { verses };
  renderListTitle();
  // Exibe o novo versículo só se já estava exibindo; senão apenas move o central.
  if (wasProjecting) projectBibleVerse(bibleSession.idx);
  else { renderNowPlaying(); renderSlideNav(); bibleRenderReading(); }
}

// Passa/volta um versículo (reusa os botões de slide). No fim do último
// versículo do capítulo, pula para o 1º do capítulo seguinte (indo para o
// próximo LIVRO, se preciso); no início, volta para o último do anterior.
// Respeita o gate: se ainda não ativou a visualização, só move o central.
async function bibleStep(delta) {
  const s = bibleSession;
  if (!s) return;
  const t = s.idx + delta;
  if (t >= 0 && t < s.verses.length) { bibleSetIdx(t); return; }
  // Cruzando o limite: `want` leva o quanto sobrou do salto, para um pulo de
  // +2 no último versículo cair no segundo do capítulo seguinte.
  if (delta > 0) {
    const nx = nextChapterRef(s.bookIdx, s.chapter);
    if (nx) await bibleGotoChapter(nx.bookIdx, nx.chapter, t - s.verses.length);
  } else {
    const pv = prevChapterRef(s.bookIdx, s.chapter);
    if (pv) await bibleGotoChapter(pv.bookIdx, pv.chapter, t);
  }
}

// Cache dos capítulos VIZINHOS (só pra preview do anterior/próximo que cruza o
// limite do capítulo/livro), por `<versao>_<livroIdx>_<capitulo>`. Limpo ao
// trocar de versão / encerrar a leitura.
let bibleAdjCache = {};
let bibleAdjSeq = 0;

// Info do versículo vizinho (delta = -1 anterior, +1 próximo). Dentro do
// capítulo: o versículo direto. No limite: cruza pro capítulo/livro vizinho
// (verso já em cache do vizinho, se houver). null = início/fim da Bíblia.
function bibleAdjacentVerse(delta) {
  const s = bibleSession;
  const t = s.idx + delta;
  if (t >= 0 && t < s.verses.length) {
    return { bookIdx: s.bookIdx, chapter: s.chapter, bookName: s.bookName, v: s.verses[t], cross: false };
  }
  const ref = delta > 0 ? nextChapterRef(s.bookIdx, s.chapter) : prevChapterRef(s.bookIdx, s.chapter);
  if (!ref) return null; // início/fim da Bíblia
  const book = Bible.BOOKS[ref.bookIdx];
  const cachedKey = s.versionId + '_' + ref.bookIdx + '_' + ref.chapter;
  const cached = bibleAdjCache[cachedKey];
  // Índice DENTRO do capítulo vizinho: com mais de um versículo de preview à
  // frente, um `delta` de +2 no último versículo cai no SEGUNDO do capítulo
  // seguinte, não no primeiro. `t` já é o índice absoluto que estourou.
  let v = null;
  if (cached && cached.length) {
    const j = delta > 0 ? (t - s.verses.length) : (cached.length + t);
    v = cached[Math.max(0, Math.min(cached.length - 1, j))];
  }
  return {
    bookIdx: ref.bookIdx, chapter: ref.chapter, bookName: book.name, v,
    cross: true, crossBook: ref.bookIdx !== s.bookIdx, chapterRef: ref,
  };
}

// Baixa/lê o capítulo vizinho pra preencher a preview do anterior/próximo que
// cruza limite, e re-renderiza a leitura quando chega.
async function ensureAdjLoaded(ref) {
  const s = bibleSession;
  if (!s) return;
  const key = s.versionId + '_' + ref.bookIdx + '_' + ref.chapter;
  if (bibleAdjCache[key]) return;
  const seq = ++bibleAdjSeq;
  let verses;
  try { verses = await fetchBibleChapterCached(s.versionId, ref.bookIdx, ref.chapter); }
  catch (_) { return; }
  bibleAdjCache[key] = verses;
  if (seq === bibleAdjSeq && bibleSession && activeTab === 'bible' && bibleScreen === 'reading') {
    bibleRenderReading();
  }
}

// Tela de LEITURA: seletor de versão + status offline no topo, versículo
// anterior / atual / próximo empilhados (o anterior/próximo mostram também o
// salto pro capítulo/livro vizinho nos limites, com indicador da mudança), e a
// referência atual num botão que volta para a seleção de livros. Toque no
// CENTRAL ativa a exibição; toque no anterior/próximo move pro central (só
// exibe automaticamente depois de ativado — ver bibleSetIdx).
function renderBibleReading(wrap) {
  const s = bibleSession;
  if (!s) { gotoBibleScreen('books'); return; }
  const read = document.createElement('div'); read.className = 'bible-read';

  // delta: -1 (anterior) | 0 (atual) | +1 (próximo)
  const mkSection = (delta, role) => {
    const sec = document.createElement('div');
    const info = delta === 0
      ? { bookName: s.bookName, chapter: s.chapter, v: s.verses[s.idx], cross: false }
      : bibleAdjacentVerse(delta);
    if (!info) { // início/fim da Bíblia
      sec.className = 'bible-vsec ' + role + ' empty';
      const t = document.createElement('div'); t.className = 'bible-vsec-text';
      t.textContent = delta > 0 ? 'Fim da Bíblia' : 'Início da Bíblia';
      sec.appendChild(t);
      return sec;
    }
    const live = role === 'cur' && s.projecting;
    sec.className = 'bible-vsec ' + role + (live ? ' live' : '') + (info.cross ? ' cross' : '');
    // Indicador de mudança de capítulo/livro (antes de selecionar).
    if (info.cross) {
      const badge = document.createElement('div'); badge.className = 'bible-vsec-cross';
      const arrow = delta > 0 ? '▸ ' : '◂ ';
      const label = info.crossBook
        ? (delta > 0 ? 'Livro seguinte: ' : 'Livro anterior: ') + info.bookName + ' ' + info.chapter
        : 'Capítulo ' + info.chapter;
      badge.textContent = arrow + label;
      sec.appendChild(badge);
    }
    const ref = document.createElement('div'); ref.className = 'bible-vsec-ref';
    ref.textContent = (live ? '● No ar · ' : '') + info.bookName + ' ' + info.chapter + (info.v ? ':' + info.v.n : '');
    const txt = document.createElement('div'); txt.className = 'bible-vsec-text';
    txt.textContent = info.v ? info.v.text : (info.cross ? '…' : '');
    sec.append(ref, txt);
    sec.addEventListener('click', () => {
      if (role === 'cur') toggleBibleVerse(); // exibe / tira do ar
      else bibleStep(delta); // navega (cruza capítulo/livro nos limites)
    });
    if (info.cross && !info.v && info.chapterRef) ensureAdjLoaded(info.chapterRef);
    return sec;
  };
  // Um versículo atrás e DOIS à frente: sobrava espaço na tela, e ler adiante
  // é o que o operador faz — ele precisa saber o que vem para acompanhar a
  // leitura, não o que já passou.
  read.appendChild(mkSection(-1, 'adj'));
  read.appendChild(mkSection(0, 'cur'));
  read.appendChild(mkSection(1, 'adj'));
  read.appendChild(mkSection(2, 'adj'));

  // Rodapé: um controle segmentado só, com as QUATRO coordenadas do que está
  // sendo lido — versão · livro · capítulo · versículo —, cada uma levando ao
  // seu próprio seletor. A versão entra pela SIGLA (ver bibleVersionAbbr):
  // "Almeida Revista e Atualizada" ocupava a linha inteira e empurrava a
  // referência para baixo. Antes a referência era um botão só, que sempre
  // voltava à grade de livros: trocar só o capítulo custava passar pela
  // seleção de livro de novo. Capítulo e versículo levam à mesma tela porque
  // as duas grades convivem nela (ver "Seleção em tabela periódica").
  const foot = document.createElement('div'); foot.className = 'bible-read-foot';
  const v = s.verses[s.idx];
  const nav = document.createElement('div'); nav.className = 'bible-ref-nav';
  const part = (label, value, onClick, cls) => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'bible-ref-part' + (cls ? ' ' + cls : '');
    const l = document.createElement('span'); l.className = 'bible-ref-label'; l.textContent = label;
    const t = document.createElement('span'); t.className = 'bible-ref-value'; t.textContent = value;
    b.append(l, t);
    b.addEventListener('click', onClick);
    nav.appendChild(b);
  };
  // A seleção acompanha a leitura antes de abrir a grade, senão ela abriria no
  // que o operador escolheu por último, não no que está no ar.
  const goto = (screen) => () => {
    bibleSel = { bookIdx: s.bookIdx, chapter: s.chapter };
    gotoBibleScreen(screen);
  };
  if (bibleVersions.length) part('Versão', bibleVersionAbbr(bibleVersionId), openBibleVerPopup);
  part('Livro', s.bookName, goto('books'), 'bible-ref-part--book');
  part('Capítulo', String(s.chapter), goto('chapters'));
  part('Versículo', String(v.n), goto('chapters'));
  foot.appendChild(nav);
  // GUARDAR A REFERÊNCIA (v5.103). Até aqui a leitura bíblica era uma coisa do
  // MOMENTO: o versículo da pregação de domingo tinha de ser reencontrado ao
  // vivo, navegando livro → capítulo → versículo enquanto o pregador falava. As
  // duas ações abaixo o transformam num item — no roteiro do culto (na ordem
  // certa, entre o hino e o aviso) ou nos favoritos (o Salmo 23 que volta toda
  // semana). O que é guardado é a REFERÊNCIA, não o texto: trocar de versão
  // depois continua valendo, e nada do texto da Escritura é duplicado no banco.
  // SÓ ÍCONE, e NA MESMA LINHA da referência (v5.109): com os rótulos, as duas
  // ações não cabiam ao lado dos quatro campos e ocupavam uma segunda faixa —
  // altura tirada da leitura, que é o conteúdo desta tela. São os mesmos dois
  // símbolos que a linha da lista e a barra de seleção já usam para estas
  // mesmas duas ações; onde eles se repetem, o rótulo não acrescenta nada.
  const acoes = document.createElement('div'); acoes.className = 'bible-read-acoes';
  acoes.append(
    cueSaveBtn(ICON.cronoAdd, 'Adicionar ao Cronograma', (b) => salvarVersiculo('imports', b)),
    cueSaveBtn(ICON.star, 'Favoritar', (b) => salvarVersiculo('favs', b)),
  );
  foot.appendChild(acoes);
  read.appendChild(foot);
  wrap.appendChild(read);
}

// O versículo em leitura vira uma cena de roteiro. O nome é a própria
// referência — numa lista de culto, "Salmo 23:1" diz tudo o que precisa dizer.
async function salvarVersiculo(destino, btn) {
  const s = bibleSession;
  if (!s) return;
  const v = s.verses[s.idx];
  if (!v) return;
  const nome = s.bookName + ' ' + s.chapter + ':' + v.n;
  const rec = await criarCue('verse', {
    versionId: s.versionId, bookIdx: s.bookIdx, chapter: s.chapter, verse: v.n,
  }, nome, destino, btn);
  // O aviso vem do `criarCue` — inclusive o "já está nos favoritos", que é o
  // que impede o operador de marcar o mesmo versículo duas vezes.
  if (!rec) return;
}

// Encerra o modo de leitura bíblica (quando uma mídia comum assume, ou stop).
function clearBibleSession() {
  if (!bibleSession) return;
  bibleSession = null;
  bibleAdjCache = {};
  // A tela de leitura depende da sessão: sem ela, volta pra seleção.
  if (bibleScreen === 'reading') bibleScreen = 'chapters';
  renderSlideNav();
  renderNowPlaying();
  if (activeTab === 'bible') { renderLibrary(); renderListTitle(); }
}

// ===== Mensagens: lista, projeção e navegação =====
function clearMsgSession() {
  if (!msgSession) return;
  msgSession = null;
  renderSlideNav();
  renderNowPlaying();
  refreshDiversos();
}
// ===== CENAS DE ROTEIRO (`kind: 'cue'`) =====
//
// O Cronograma se chama "a lista do culto" desde sempre, mas até a v5.102 ele
// só guardava MÍDIA — coisa com bytes. Metade de um culto real (a contagem
// regressiva de abertura, a leitura bíblica, o aviso, a letra projetada sem
// música) morava em OUTRAS abas, cada uma com a sua sessão, e a ordem do que
// vem depois ficava só na cabeça do operador — que navegava entre abas ao vivo,
// no domingo de manhã.
//
// Um cue é um item de lista que aponta para uma CENA em vez de para bytes. Três
// propriedades desenham o resto do desenho:
//
//  1. **O Display não muda uma linha.** Um cue NUNCA vira um comando `load`:
//     projetar um cue chama a MESMA função que o botão da aba correspondente já
//     chamava (`projectBibleVerse`, `projectMessage`, `projectChrono`,
//     `projectDraw`, `projectLyricStanza`), que por sua vez manda o `text`/
//     `chrono`/`draw` de sempre. É a invariante 5 do projeto aplicada aqui:
//     nada de lógica de projeção nova — só um ponteiro novo.
//  2. **A reconexão do telão vem de graça.** Projetar um cue deixa a SESSÃO
//     correspondente montada, e `resendSceneToDisplay` já reenvia sessões (o
//     cronômetro pelo descritor, o versículo pela referência). Nada a
//     acrescentar lá além de não tentar dar `load` no próprio cue.
//  3. **O descritor é uma REFERÊNCIA, não uma cópia do conteúdo.** O versículo
//     guarda `{versão, livro, capítulo, número}` e o texto vem do cache da
//     Bíblia na hora de projetar: um cue não envelhece quando a mensagem é
//     editada nem duplica o texto da Escritura no banco.
// Os seis subtipos. O ícone é SVG inline — a fonte de ícones é um SUBSET de ~30
// glifos (ver shared/material-symbols.css), e um código fora dela desenha um
// quadrado vazio; é o mesmo motivo pelo qual `syncIconSvg` e companhia existem.
// Só o "pacote" reusa um glifo do subset, porque `queue_music` é exatamente o
// que ele é.
const CUE_SVG = {
  // O MESMO desenho da aba da Bíblia (livro aberto com uma cruz), copiado dela:
  // o item de roteiro que abre a Escritura tem de usar o símbolo pelo qual a
  // Escritura é conhecida NESTE app. Um segundo desenho de livro só faria o
  // operador se perguntar se são coisas diferentes.
  verse: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z"/>'
    + '<path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19"/>'
    + '<line x1="11.5" y1="6.4" x2="11.5" y2="11.6"/><line x1="9.2" y1="8.4" x2="13.8" y2="8.4"/>',
  message: '<path d="M20 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
  songlyrics: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="11" x2="16" y2="11"/><line x1="4" y1="16" x2="20" y2="16"/><line x1="4" y1="21" x2="12" y2="21"/>',
  chrono: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><line x1="9" y1="2" x2="15" y2="2"/>',
  draw: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/>',
};

function cueIconSvg(cue) {
  const d = CUE_SVG[cue];
  if (!d) return '';
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
}

const CUES = {
  verse: { nome: 'Versículo' },
  message: { nome: 'Mensagem' },
  songlyrics: { nome: 'Letra' },
  chrono: { nome: 'Tempo' },
  draw: { nome: 'Sorteio' },
  group: { nome: 'Pacote', glifo: () => ICON.queue },
};

function isCue(rec) { return !!(rec && rec.kind === 'cue' && rec.cue); }

// O QUE ESTE ITEM É — a segunda linha de toda linha da lista (v5.118).
//
// Antes isto era um SELO ao lado do nome, e o selo tinha um defeito estrutural:
// ele dividia a largura com o nome, num `flex` em que o nome tem `flex: 1`. Com
// um título curto ele aparecia; com "Firme nas Promessas — Arautos do Rei (Ao
// Vivo)" ele era espremido ou empurrado para fora. Ou seja, a informação sumia
// exatamente nos itens em que ela era mais necessária — os de nome comprido,
// que são justamente os que menos se distinguem entre si numa lista.
//
// Como subtítulo ele passa a ter linha própria e é SEMPRE visível. E não custa
// altura nenhuma: a linha já tem 40px por causa da miniatura, e duas linhas de
// texto cabem dentro disso com folga — a lista não ficou mais alta em um pixel.
//
// O detalhe que acompanha o tipo é o que o registro JÁ tem à mão. Nada aqui
// decodifica arquivo nem mede coisa alguma: a resolução vem do shell (ou do
// `<video>` que já monta a miniatura), a duração vem junto, as páginas são o
// tamanho do array. Um detalhe que exigisse trabalho por linha, a cada render,
// não valeria a informação que dá.
function subtituloItem(item) {
  if (!item) return '';
  if (isCue(item)) return cueTipo(item);
  if (item.kind === 'deck') {
    const n = Array.isArray(item.pages) ? item.pages.length : 0;
    return 'Apresentação' + (n ? ' · ' + n + (n === 1 ? ' página' : ' páginas') : '');
  }
  // O item de PLAYER: o link, sem bytes no aparelho. Dizer "YouTube" é dizer
  // que ele depende da rede durante o culto, que é a diferença que importa
  // entre ele e o arquivo baixado do mesmo vídeo.
  if (item.kind === 'youtube') return 'YouTube';
  if (item.kind === 'video') return 'Vídeo' + (item.height ? ' · ' + item.height + 'p' : '');
  if (item.kind === 'audio') {
    const d = fmtDur(item.seconds);
    return 'Áudio' + (d ? ' · ' + d : '');
  }
  if (item.kind === 'image') return 'Imagem';
  if (!item.blob && item.url) return 'Link externo';
  return 'Arquivo';
}

// ===== UM SÓ CAMINHO PARA "ADICIONAR" (v5.104) =====
//
// Todo destino do app passa por aqui, e por dois motivos que andam juntos:
//
// 1. **O aviso.** Metade dos destinos não está na tela quando se manda algo
//    para eles (mandar ao Cronograma estando na Bíblia, favoritar de dentro do
//    acervo), e sem resposta o operador toca de novo — que é como se duplica.
// 2. **A duplicação.** A resposta precisa distinguir "entrou" de "já estava
//    lá", porque é a segunda que evita o toque repetido.
//
// As listas são conjuntos de ids, então `listAdd` já é idempotente para MÍDIA:
// o mesmo vídeo não entra duas vezes na mesma lista, por construção. O que não
// era idempotente é a CENA DE ROTEIRO — cada uma cria um registro novo, com id
// novo — e é por isso que ela tem uma chave de conteúdo (ver `cueChave`).
// Duas formas por destino, porque as duas frases pedem preposições
// diferentes: "já está NO Cronograma" e "adicionado AO Cronograma". Com uma só
// forma, metade dos avisos sai torta — e um aviso torto num app em português é
// a primeira coisa que se lê como descuido.
const LISTA_ROTULO = {
  imports: { em: 'no Cronograma', para: 'ao Cronograma' },
  playlist: { em: 'na playlist', para: 'à playlist' },
  favs: { em: 'nos favoritos', para: 'aos favoritos' },
};
const ROTULO_PADRAO = { em: 'na lista', para: 'à lista' };

// ===== DESTINOS: um item pode ir para MAIS DE UM lugar de uma vez (v5.141) =====
//
// Toda porta de entrada do app — o acervo, a busca do YouTube, o link
// compartilhado, a importação de arquivos — perguntava "para onde?" e aceitava
// UMA resposta: a folha fechava no primeiro toque, e quem quisesse o mesmo
// louvor na playlist E nos Favoritos tinha de refazer a busca, reabrir a folha
// e — no caso do YouTube — pagar o download de novo. O item é o mesmo; o que
// muda é em quantas listas ele entra, e isso nunca foi uma escolha exclusiva.
//
// A tabela é a fonte única: uma porta nova ganha os três destinos escrevendo
// uma linha, e um destino novo aparece em todas as portas de uma vez. `chave` é
// o nome do destino como o app fala dele por fora (é o que viaja nas ações e no
// `ytAcao`); `lista` é o nome no banco, que não se confunde com ele — o
// Cronograma é a lista `imports` desde antes de se chamar Cronograma.
const DESTINOS = [
  { chave: 'playlist', lista: 'playlist', rotulo: 'Playlist', sub: 'Entra na fila do que está tocando agora' },
  { chave: 'cronograma', lista: 'imports', rotulo: 'Cronograma', sub: 'A lista do culto' },
  { chave: 'favoritos', lista: 'favs', rotulo: 'Favoritos', sub: 'O que se usa toda semana, sempre à mão' },
];
function destinoPorChave(chave) { return DESTINOS.find((d) => d.chave === chave) || null; }
function listaDoDestino(chave) {
  const d = destinoPorChave(chave);
  return d ? d.lista : 'imports';
}
function listasDosDestinos(chaves) {
  // `Set` porque duas chaves podem cair na mesma lista num futuro em que um
  // destino novo compartilhe a `imports` — e um `listAdd` repetido gastaria uma
  // transação para não fazer nada.
  return [...new Set((chaves || []).map(listaDoDestino))];
}

// "à playlist e aos favoritos" — a lista de destinos escrita como se fala.
// Sem isto o aviso do multi-destino sairia como "adicionado à playlist,
// adicionado ao Cronograma", que é a mesma frase duas vezes.
function juntarFrases(partes) {
  if (partes.length <= 1) return partes[0] || '';
  return partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
}
function ondeDe(listas, campo) {
  return juntarFrases(listas.map((l) => (LISTA_ROTULO[l] || ROTULO_PADRAO)[campo]));
}

// O nome do item, encurtado — o aviso é uma linha e o nome de um louvor com o
// álbum junto passa fácil da largura da tela.
function rotuloItem(nome) {
  if (!nome) return '';
  return '"' + (nome.length > 28 ? nome.slice(0, 28) + '…' : nome) + '" ';
}

// Acrescenta O MESMO id a VÁRIAS listas, com um aviso só.
//
// Um aviso por lista seria três faixas piscando uma por cima da outra para um
// toque único — o mesmo argumento de `textoLote`, que já resolvia isto para
// vários itens num destino só. Aqui é o espelho: um item em vários destinos.
//
// A frase separa o que ENTROU do que JÁ ESTAVA, porque é essa distinção que
// impede o toque repetido (ver o cabeçalho acima). Com os dois casos presentes
// ela diz os dois — "adicionado à playlist — já estava no Cronograma" —, e não
// um resumo que esconderia metade.
async function adicionarNasListas(listas, id, nome, btn) {
  const alvos = [...new Set(listas)];
  const novas = [], antigas = [];
  for (const l of alvos) {
    if (await AVDB.listHas(l, id)) { antigas.push(l); continue; }
    await AVDB.listAdd(l, id);
    novas.push(l);
  }
  const que = rotuloItem(nome);
  let texto;
  if (!novas.length) texto = que + 'já está ' + ondeDe(antigas, 'em');
  else if (!antigas.length) texto = que + 'adicionado ' + ondeDe(novas, 'para');
  else texto = que + 'adicionado ' + ondeDe(novas, 'para') + ' — já estava ' + ondeDe(antigas, 'em');
  responder(btn, novas.length ? (antigas.length ? 'dup' : 'ok') : 'dup', texto);
  if (alvos.includes('favs')) await recarregarFavoritos();
  if (alvos.includes('playlist')) { plItems = await AVDB.listItems('playlist'); renderPlaylist(); }
  return novas.length;
}

// A forma de UM destino, que é o que a maior parte do app ainda usa.
async function adicionarNaLista(lista, id, nome, btn) {
  return (await adicionarNasListas([lista], id, nome, btn)) > 0;
}

// A identidade de uma CENA: tipo + descritor. Duas cenas com a mesma chave são
// a mesma coisa para o operador ("Salmo 23:1" é "Salmo 23:1"), ainda que sejam
// dois registros diferentes no banco.
//
// `JSON.stringify` basta porque os descritores são montados sempre pelo MESMO
// código, campo a campo e na mesma ordem — não são objetos que chegam de fora.
function cueChave(cue, data) {
  const d = data || {};
  // A MENSAGEM é identificada pelo `msgId`. O texto viaja junto no descritor
  // como reserva (para o roteiro não ficar mudo se ela for apagada), mas duas
  // cenas da MESMA mensagem são a mesma cena — comparar o texto deixaria a
  // reserva decidir a identidade.
  if (cue === 'message') return 'message:' + (d.msgId || d.text || '');
  return cue + ':' + JSON.stringify(d);
}

async function acharCueIgual(lista, cue, data) {
  const chave = cueChave(cue, data);
  const itens = await AVDB.listItems(lista);
  return itens.find((r) => isCue(r) && cueChave(r.cue, r.data) === chave) || null;
}

// A mesma pergunta, mas SÍNCRONA e só sobre os favoritos — `favItems` já está
// em memória, e quem precisa disto (a estrela de cada linha) é desenhado num
// laço de render, onde um `await` por linha seria uma leitura de IDB por item.
function favCue(cue, data) {
  const chave = cueChave(cue, data);
  return favItems.find((r) => isCue(r) && cueChave(r.cue, r.data) === chave) || null;
}

// A miniatura de uma cena: o símbolo do tipo no lugar da imagem que ela não
// tem. Mesma caixa das outras (`.thumb--icon`), então a lista não muda de
// ritmo por causa dela.
function cueThumb(rec) {
  const t = document.createElement('div');
  t.className = 'thumb thumb--icon thumb--cue';
  const meta = CUES[rec.cue];
  if (meta && meta.glifo) t.appendChild(msym(meta.glifo()));
  else t.innerHTML = cueIconSvg(rec.cue);
  return t;
}

// O que a linha do Cronograma mostra à esquerda do nome: qual TIPO de cena é.
// Sem isso, "Salmo 23:1" e "Bem-vindos ao culto" seriam duas linhas de texto
// indistinguíveis numa lista que também tem vídeo e hino.
function cueTipo(rec) { return (isCue(rec) && CUES[rec.cue]) ? CUES[rec.cue].nome : ''; }

// Cria a cena e devolve o registro. `destino` é a lista — o Cronograma por
// padrão, mas a mesma função serve aos Favoritos (é o mesmo id em outra lista).
async function criarCue(cue, data, nome, destino, btn) {
  if (!CUES[cue]) return null;
  const lista = destino || 'imports';
  // ANTI-DUPLICAÇÃO, com regras DIFERENTES por destino — e a diferença é do
  // operador, não técnica:
  //
  //  - **Favoritos não repetem.** Favoritar é marcar; dois "Salmo 23:1" na
  //    mesma gaveta são ruído puro, e ninguém consegue distingui-los. O item
  //    que já existe é reaproveitado e o aviso diz isso.
  //  - **O Cronograma PODE repetir.** O mesmo versículo pode ser lido na
  //    abertura e no apelo, e a mesma contagem regressiva pode aparecer duas
  //    vezes no culto. Aqui a duplicata é criada — mas o aviso avisa, que é o
  //    que separa a repetição intencional do toque dado duas vezes.
  const igual = await acharCueIgual(lista, cue, data);
  const onde = LISTA_ROTULO[lista] || ROTULO_PADRAO;
  if (igual && lista !== 'imports') {
    responder(btn, 'dup', rotuloItem(igual.name) + 'já está ' + onde.em);
    return igual;
  }
  const rec = await AVDB.addCue(cue, data, { name: nome, list: lista });
  responder(btn, igual ? 'dup' : 'ok', igual
    ? rotuloItem(nome) + 'adicionado — já havia um igual no Cronograma'
    : rotuloItem(nome) + 'adicionado ' + onde.para);
  if (lista === 'favs') await recarregarFavoritos();
  // Redesenha só quando a tela em cena é justamente a que acabou de receber o
  // item — guardar um versículo estando na aba da Bíblia não precisa remontar
  // o Cronograma, que ainda vai ser carregado ao voltar para ele.
  if ((lista === 'imports' && activeTab === 'imports' && !currentFolder)
    || (lista === 'favs' && activeTab === 'folders' && !currentFolder)) await load();
  return rec;
}

// PROJETA uma cena. Cada ramo termina na função que a aba correspondente já
// usava, então o comportamento (incluindo ⏮/⏭, o rótulo do now-playing e a
// notificação nativa) é idêntico ao de projetar pela aba — porque É a mesma
// projeção.
async function playCue(rec) {
  if (!isCue(rec)) return;
  const d = rec.data || {};
  switch (rec.cue) {
    case 'verse': return projetarVersiculoRef(d);
    case 'message': return projetarMensagemCue(d);
    case 'songlyrics': return projetarLetraCue(d);
    case 'chrono': return projetarTempoCue(d);
    case 'draw': return projetarSorteioCue(d);
    case 'group': return abrirPacote(d);
    default: return undefined;
  }
}

// ---- versículo ----
// Monta a sessão de leitura DO ZERO a partir da referência e projeta. Não
// reaproveita `bibleGotoChapter` de propósito: aquela exige uma sessão já
// aberta (lê `s.versionId` dela), e aqui a sessão é justamente o que não
// existe — o operador pode estar em qualquer aba quando toca no roteiro.
async function projetarVersiculoRef(ref) {
  // A VERSÃO EM USO HOJE tem precedência sobre a que estava em uso quando o
  // item foi guardado: a referência é do TEXTO ("Salmo 23:1"), não da tradução,
  // e um roteiro montado há um mês não pode arrastar de volta uma versão que o
  // operador trocou desde então — nem disparar o download dela no domingo.
  // A guardada fica como RESERVA, e é ela que salva o caso offline: a versão de
  // hoje pode não ter este capítulo em cache, e a de então provavelmente tem.
  const versoes = [bibleVersionId, ref.versionId].filter((v, i, a) => v && a.indexOf(v) === i);
  if (!versoes.length) { avisar('Escolha uma versão da Bíblia primeiro', 'erro'); return; }
  let verses = null;
  let versao = versoes[0];
  for (const v of versoes) {
    try { verses = await fetchBibleChapterCached(v, ref.bookIdx, ref.chapter); versao = v; break; }
    catch (_) { /* tenta a próxima */ }
  }
  if (!verses || !verses.length) { avisar('Sem este capítulo no aparelho (e sem internet para baixar)', 'erro'); return; }
  const book = Bible.BOOKS[ref.bookIdx];
  if (!book) return;
  // Pelo NÚMERO do versículo, não pelo índice: capítulos com numeração
  // irregular (ou uma versão que traga um versículo a menos) deslocariam o
  // índice e projetariam outra coisa. Sem o número, cai no primeiro.
  let idx = verses.findIndex((v) => v.n === ref.verse);
  if (idx < 0) idx = 0;
  clearMsgSession(); clearChronoSession(); clearDrawSession(); clearLyricSession();
  bibleSession = {
    versionId: versao, bookIdx: ref.bookIdx, bookId: bibleBookId(ref.bookIdx),
    bookName: book.name, chapter: ref.chapter, verses, idx, projecting: false,
  };
  // A aba da Bíblia (se o operador for até ela) abre no que está no ar, e não
  // no que ele escolheu por último — a leitura continua de onde o roteiro
  // parou, e daí em diante ⏮/⏭ passam versículo como em qualquer leitura.
  bibleSel = { bookIdx: ref.bookIdx, chapter: ref.chapter };
  bibleChapterData = { verses };
  bibleScreen = 'reading';
  projectBibleVerse(idx);
}

// ---- mensagem ----
// Guarda o `msgId` E o texto. Com a mensagem ainda na lista, projeta pelo
// ÍNDICE — e aí ⏮/⏭ passam para a mensagem seguinte, como sempre. Apagada a
// mensagem, o roteiro não pode ficar mudo no meio do culto: projeta o texto
// guardado, sem sessão de navegação (o `slideTarget` devolve null e os botões
// voltam a ser de mídia, que é a leitura honesta — não há lista para percorrer).
function projetarMensagemCue(d) {
  const i = d.msgId ? messages.findIndex((m) => m.id === d.msgId) : -1;
  if (i >= 0) { projectMessage(i); return; }
  const texto = String(d.text || '').trim();
  if (!texto) { avisar('A mensagem deste item foi excluída', 'erro'); return; }
  clearManualText();
  view = 'visual';
  persistCurrent();
  cmd({ type: 'text', mode: 'message', main: texto, sub: '', view: 'visual' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
}

// ---- letra avulsa ----
async function projetarLetraCue(d) {
  const coll = allCollections().find((c) => c.id === d.collId);
  const s = coll ? collSongs(d.collId).find((x) => String(x.id_music) === String(d.songId)) : null;
  if (!coll || !s) { avisar('Esta música não está mais no acervo', 'erro'); return; }
  await projectSongLyricsOnly(coll, s);
}

// ---- cronômetro / relógio / timer ----
// O cue é um PRESET: ele reescreve o estado da ferramenta (modo, duração,
// legenda) e projeta. Um timer de abertura no roteiro tem de começar do
// princípio — daí o reset da contagem e o start automático, que é o que o
// operador faria em seguida de qualquer forma.
function projetarTempoCue(d) {
  if (CHRONO_MODES.some((m) => m.id === d.mode)) chrono.mode = d.mode;
  if (typeof d.durationMs === 'number' && d.durationMs > 0) chrono.durationMs = d.durationMs;
  if (typeof d.label === 'string') chrono.label = d.label;
  if (typeof d.secs === 'boolean') chrono.secs = d.secs;
  if (typeof d.h12 === 'boolean') chrono.h12 = d.h12;
  chrono.baseMs = 0;
  chrono.running = chrono.mode !== 'clock';
  chrono.startAt = chrono.running ? Date.now() : 0;
  saveChronoPrefs();
  projectChrono();
}

// ---- sorteio ----
// Também um preset (faixa ou lista de opções). NÃO sorteia sozinho: o resultado
// é o momento público do sorteio, e ele pertence ao toque do operador em
// "Sortear" — um número que já aparece pronto ao entrar em cena tira justamente
// o que faz a coisa ter graça.
function projetarSorteioCue(d) {
  if (d.kind === 'text' || d.kind === 'number') draw.kind = d.kind;
  if (typeof d.min === 'number') draw.min = d.min;
  if (typeof d.max === 'number') draw.max = d.max;
  if (Array.isArray(d.pool)) draw.pool = d.pool.map(String);
  if (typeof d.label === 'string') draw.label = d.label;
  draw.value = null; draw.rollUntil = 0;
  saveDrawPrefs();
  projectDraw();
}

// ---- pacote ----
// O "pacote de playlist": um cue que carrega uma FILA inteira. Tocar substitui
// a playlist pelos itens dele e começa pelo primeiro — é o bloco de louvores da
// abertura entrando com um toque, em vez de quatro itens montados à mão a cada
// semana. Os ids que não existirem mais são simplesmente pulados (uma mídia
// excluída não pode impedir o resto do bloco de tocar).
async function abrirPacote(d) {
  const ids = Array.isArray(d.ids) ? d.ids : [];
  const recs = (await Promise.all(ids.map((id) => AVDB.getMedia(id)))).filter(Boolean);
  if (!recs.length) { avisar('As mídias deste pacote não estão mais no aparelho', 'erro'); return; }
  await AVDB.listSet('playlist', recs.map((r) => r.id));
  plItems = recs;
  renderPlaylist();
  await send(recs[0].id);
}

// ===== Letra avulsa: projeção e navegação =====
function clearLyricSession() {
  if (!lyricSession) return;
  lyricSession = null;
  renderSlideNav();
  renderNowPlaying();
}
function lyricProjecting() { return !!(lyricSession && lyricSession.projecting); }

// Abre a sessão a partir de uma música do acervo. `songLyricStanzas` lê só o
// que já está no aparelho; quando não há nada, o caminho é o MESMO das outras
// duas opções da folha — baixar a música (que traz a letra junto) e tentar de
// novo. Até a v5.63 isto era um beco sem saída: "Letra ainda não baixada." e
// nada acontecia, num item que o operador acabara de escolher.
async function projectSongLyricsOnly(coll, s) {
  // A RESPOSTA VEM PRIMEIRO — mesma regra de `playSongVariant`.
  closeSongMenu();
  closeHymnSearch();
  const bg = previewBusy('Baixando a letra', songLabel(coll, s));
  try {
    let stanzas = await lyricStanzaTexts(coll, s);
    if (!stanzas.length) {
      await ensureSongDownloaded(coll, s, { toast: !bg.visivel });
      stanzas = await lyricStanzaTexts(coll, s);
    }
    if (!stanzas.length) { avisar('Letra indisponível para esta música', 'erro'); return; }
    clearBibleSession(); clearMsgSession(); clearChronoSession(); clearDrawSession();
    lyricSession = { title: songLabel(coll, s), stanzas, idx: 0, projecting: true };
    projectLyricStanza(0);
  } finally {
    bg.soltar();
  }
}

// As estrofes já achatadas em texto de slide (uma string por estrofe, linhas
// separadas por `\n`), sem as vazias.
async function lyricStanzaTexts(coll, s) {
  const estrofes = await songLyricStanzas(coll, s);
  return (estrofes || []).map((e) => (e.l || []).join('\n').trim()).filter((t) => t);
}

function projectLyricStanza(idx) {
  if (!lyricSession) return;
  lyricSession.idx = Math.min(Math.max(idx, 0), lyricSession.stanzas.length - 1);
  lyricSession.projecting = true;
  view = 'visual';
  persistCurrent();
  // `mode: 'message'` — o telão já sabe desenhar um bloco de texto centrado, que
  // é exatamente o que uma estrofe é. Um modo novo no protocolo só para isto
  // exigiria shell/bundle novos dos dois lados sem mudar um pixel do resultado.
  cmd({ type: 'text', mode: 'message', main: lyricSession.stanzas[lyricSession.idx], sub: '', view: 'visual' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
}

function lyricStep(delta) {
  if (!lyricSession) return;
  const t = Math.min(Math.max(lyricSession.idx + delta, 0), lyricSession.stanzas.length - 1);
  if (t === lyricSession.idx) return;
  if (!lyricProjecting()) { lyricSession.idx = t; renderSlideNav(); return; }
  projectLyricStanza(t);
}

// Encerra QUALQUER texto manual em cena (Bíblia, Mensagem, letra avulsa,
// cronômetro ou sorteio) — só um por vez.
function clearManualText() {
  clearBibleSession(); clearMsgSession(); clearLyricSession();
  clearChronoSession(); clearDrawSession();
}

// Projeta a mensagem de índice `idx` (Display + preview). Encerra a Bíblia (só
// um texto manual por vez).
function projectMessage(idx) {
  if (idx < 0 || idx >= messages.length) return;
  clearBibleSession();
  clearChronoSession();
  clearDrawSession();
  msgSession = { idx, projecting: true };
  view = 'visual';
  persistCurrent();
  cmd({ type: 'text', mode: 'message', main: messages[idx].text, sub: '', view: 'visual' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  refreshDiversos();
}

// Tira a mensagem do telão mantendo a sessão viva (o operador pode reexibir
// pela lista). Espelha hideBibleVerse: `text-hide` encerra só a Camada de
// Texto — um áudio de fundo, se houver, segue tocando.
function hideMessage() {
  if (!msgProjecting()) return;
  msgSession.projecting = false;
  cmd({ type: 'text-hide' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  // Uma chamada só: a segunda (lapso — nenhum outro hide* do arquivo repete)
  // remontava a aba inteira, microfone incluído, duas vezes no mesmo pulso.
  refreshDiversos();
}

// Passa/volta entre mensagens salvas (reusa os botões de slide). Com a
// mensagem fora do ar (o operador tocou no X), passar só MOVE a seleção — não
// traz de volta o que ele acabou de tirar. Mesma regra da Bíblia (bibleSetIdx).
function msgStep(delta) {
  if (!msgSession) return;
  const t = Math.min(Math.max(msgSession.idx + delta, 0), messages.length - 1);
  if (t === msgSession.idx) return;
  if (!msgProjecting()) {
    msgSession.idx = t;
    renderSlideNav();
    refreshDiversos();
    return;
  }
  projectMessage(t);
}

async function saveMessages() { await AVDB.setState('messages', messages); }

async function addMessage() {
  const text = await appPrompt({ title: 'Nova mensagem', message: 'Texto da mensagem:', okText: 'Salvar', placeholder: 'Ex.: Bem-vindos ao culto!' });
  if (!text || !text.trim()) return;
  messages.push({ id: uid(), text: text.trim() });
  await saveMessages();
  refreshDiversos();
}

async function deleteMessage(id) {
  const i = messages.findIndex((m) => m.id === id);
  if (i < 0) return;
  if (msgSession) {
    if (msgSession.idx === i) {
      // TIRAR DO AR antes de anular a sessão. `clearManualText()` sozinho
      // zerava `msgSession` sem mandar `text-hide`: o aviso apagado continuava
      // projetado no telão e na preview, e — como a sessão morria junto — o
      // botão "Tirar do telão" ficava DESABILITADO e a linha sumia da lista.
      // O operador não tinha mais nenhum caminho na aba para tirar o texto do
      // ar; só ⏹ Parar ou projetar outra coisa por cima.
      hideMessage();
      clearMsgSession();
    } else if (msgSession.idx > i) {
      // REINDEXAR: apagar uma mensagem ACIMA da projetada deixava `idx`
      // apontando para a vizinha errada (ou para fora do array). Sintomas:
      // "Mensagem 3" numa lista de duas, nenhuma linha marcada como ativa, e
      // "Projetar no telão" caindo no guard `idx >= messages.length` de
      // `projectMessage` — um botão que não faz nada e não explica por quê.
      msgSession.idx--;
    }
  }
  messages.splice(i, 1);
  await saveMessages();
  refreshDiversos();
}

// ===== Microfone ao vivo (push-to-talk) =====
// Segurar o botão abre o microfone e a voz sai NA PROJEÇÃO, ao vivo. A captura
// acontece no Display, não aqui: um MediaStream não atravessa o
// BroadcastChannel, então quem reproduz é quem abre o microfone (ver startMic
// em display.js). Daqui só sai o comando.
//
// O comando vai por `AVDB.sendCommand`, **não** por `cmd()`: `cmd()` também
// aplica na preview, e a preview é este mesmo aparelho, a centímetros do
// microfone — reproduzir aqui seria realimentação garantida.
let micOn = false;          // o Display confirmou que está captando
let micPressed = false;     // o dedo está no botão agora
let micError = '';

function sendMic(on) {
  micPressed = on;
  AVDB.sendCommand({ type: 'mic', on });
  renderMicUI();
}

function renderMicUI() {
  const btn = document.getElementById('micBtn');
  if (!btn) return;
  const live = micOn || micPressed;
  btn.classList.toggle('live', live);
  const label = btn.querySelector('.mic-btn-label');
  if (label) label.textContent = live ? 'No ar' : 'Microfone';
  // A nota só existe para ERRO (permissão negada, sem microfone…) — é
  // diagnóstico, não instrução de uso.
  const note = document.getElementById('micNote');
  if (note) {
    note.textContent = micError ? micErrorText(micError) : '';
    note.hidden = !micError;
  }
}

function micErrorText(err) {
  if (err === 'NotAllowedError' || err === 'SecurityError') {
    return 'Permissão de microfone negada. Autorize o app nas configurações do Android.';
  }
  if (err === 'NotFoundError') return 'Nenhum microfone encontrado neste aparelho.';
  if (err === 'unsupported') return 'Este aparelho não expõe captura de áudio ao app.';
  // "EM USO POR OUTRO APP" SAIU (v5.142) — a frase nomeava uma causa e quase
  // sempre a errada. `NotReadableError` é o "não consegui abrir o dispositivo"
  // genérico do WebRTC, e no Android a causa comum aqui não é outro app: é o
  // sistema recusando a sessão de VOZ que o cancelamento de eco pede enquanto o
  // áudio está indo para outro lugar (o telão). O app agora tenta de novo sem o
  // processamento antes de desistir (ver `startMic`), então chegar até esta
  // mensagem já significa que as três tentativas falharam — e aí a única coisa
  // honesta a dizer é o que de fato costuma destravar.
  if (err === 'NotReadableError') {
    return 'O Android não liberou o microfone. Costuma ser uma chamada, um gravador '
      + 'aberto em outro app ou o assistente de voz — feche-os e tente de novo.';
  }
  return 'Não foi possível abrir o microfone (' + err + ').';
}

// O microfone virou uma BARRA, e não mais um disco: ele fica fixo na base da
// aba, fora do acordeão, porque push-to-talk é o único controle daqui que pode
// ser preciso no meio de uma frase — ter que abrir uma seção antes de falar o
// tornaria inútil. Como barra ele custa ~56px de altura em vez de 132 e ainda
// oferece uma área de toque MAIOR (largura inteira), que é o que importa para
// achá-lo sem olhar.
function renderMic() {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'micBtn'; btn.className = 'mic-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/>'
    + '<line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
  const label = document.createElement('span'); label.className = 'mic-btn-label';
  label.textContent = 'Microfone';
  btn.appendChild(label);

  // Push-to-talk: abre no pointerdown e fecha em QUALQUER forma de soltar.
  // `setPointerCapture` mantém o evento de soltura vindo para cá mesmo se o
  // dedo escorregar para fora do botão — sem isso o microfone ficaria aberto.
  btn.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    micError = '';
    // A permissão do Android é pedida AQUI, no primeiro uso — não na abertura
    // do app, onde um pedido de gravar áudio sem contexto seria negado por
    // reflexo. No navegador não existe ponte: o getUserMedia do Display pede.
    if (window.__NATIVE__) {
      const ok = await AVNative.requestMic();
      if (!ok) { micError = 'NotAllowedError'; renderMicUI(); return; }
      if (!micPressed && !btn.hasPointerCapture(e.pointerId)) return; // já soltou
    }
    sendMic(true);
  });
  const release = () => { if (micPressed || micOn) sendMic(false); };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);

  return btn;
}

// ===== Rodapé da aba Ferramentas: microfone + projetar =====
// "Projetar no telão" saiu do fim de cada painel e veio para cá, ao lado do
// microfone. São as duas ações que MANDAM ALGO PARA A TELA — as únicas com
// efeito fora do celular —, e tê-las sempre no mesmo lugar vale mais do que a
// proximidade com os controles que as configuram: o operador aprende UM ponto
// da tela em vez de um por ferramenta. De quebra, o botão para de descer
// conforme o painel cresce (no sorteio de texto ele ficava abaixo da lista).
function miscProjectState() {
  if (miscTool === 'draw') {
    const live = drawProjecting();
    return { live, disabled: false, hint: '', act: () => (live ? hideDraw() : projectDraw()) };
  }
  if (miscTool === 'chrono') {
    const live = chronoProjecting();
    return { live, disabled: false, hint: '', act: () => (live ? hideChrono() : projectChrono()) };
  }
  // Mensagens: projetar exige saber QUAL, e isso se escolhe tocando na lista.
  // O botão cobre o resto — tirar do ar, e reexibir a que ficou selecionada
  // depois de um "Tirar do telão" (é a ação natural seguinte, e sem ela o
  // operador teria que caçar a linha certa de novo).
  const live = msgProjecting();
  const podeVoltar = !!msgSession;
  return {
    live,
    disabled: !live && !podeVoltar,
    hint: !live && !podeVoltar ? 'Toque numa mensagem da lista para projetar' : '',
    act: () => { if (live) hideMessage(); else if (msgSession) projectMessage(msgSession.idx); },
  };
}

function renderFoot() {
  const wrap = document.createElement('div'); wrap.className = 'mic-wrap';

  const row = document.createElement('div'); row.className = 'misc-foot';
  row.appendChild(renderMic());

  const st = miscProjectState();
  const proj = document.createElement('button');
  proj.type = 'button';
  proj.id = 'miscProjectBtn';
  proj.className = 'misc-project' + (st.live ? ' live' : '');
  proj.textContent = st.live ? 'Tirar do telão' : 'Projetar no telão';
  proj.disabled = st.disabled;
  if (st.hint) proj.title = st.hint;
  proj.addEventListener('click', st.act);
  row.appendChild(proj);
  wrap.appendChild(row);

  const note = document.createElement('div'); note.id = 'micNote'; note.className = 'mic-note'; note.hidden = true;
  wrap.appendChild(note);

  libraryEl.appendChild(wrap);
  renderMicUI();
}

// ===== Cronômetro / Relógio / Timer (aba Ferramentas) =====
// Terceiro provedor da Camada de Texto, ao lado da Bíblia e das Mensagens, e
// pelo mesmo motivo: o que vai ao telão é um cartão de texto. A diferença é que
// aqui o texto é DERIVADO do tempo, não digitado — ver chronoReading em
// stage.js, e o laço em showText (display.js).
//
// `chrono` é a fonte única do estado; `chronoSession` diz apenas se ele está no
// ar, exatamente como `msgSession.projecting`. Separar os dois é o que permite
// deixar o cronômetro correndo aqui e projetá-lo depois — ou tirá-lo do telão
// sem zerar a contagem.
let chronoSession = null;   // { projecting } | null
let chrono = {
  mode: 'clock',            // 'clock' | 'stopwatch' | 'timer'
  running: false,
  startAt: 0,               // epoch ms da última partida
  baseMs: 0,                // acumulado das voltas anteriores (pausas)
  durationMs: 5 * 60000,    // alvo do timer
  // Relógio SEM segundos por padrão: no telão o que o operador e a igreja
  // querem é a hora, e o dígito dos segundos mudando o tempo todo puxa o olho
  // para um número que não informa nada. Quem precisar liga no chip.
  secs: false,
  h12: false,               // relógio em 12 h
  label: '',                // sublinha dourada no telão (opcional)
};
let chronoPanelTimer = null;

const CHRONO_MODES = [
  { id: 'clock', name: 'Relógio' },
  { id: 'stopwatch', name: 'Cronômetro' },
  { id: 'timer', name: 'Timer' },
];
const CHRONO_PRESETS = [1, 3, 5, 10, 15, 30];

const CHRONO_PREFS_V = 2;   // 2 = relógio passou a nascer sem segundos

function applyChronoPrefs(p) {
  if (!p) return;
  // Preferências gravadas ANTES da v2 carregam `secs: true` só porque era o
  // padrão de então, não porque alguém escolheu — respeitá-las faria a mudança
  // de padrão não chegar a ninguém que já tivesse aberto a aba uma vez.
  const legado = p.v !== CHRONO_PREFS_V;
  // Só as PREFERÊNCIAS voltam do banco. Uma contagem em curso não sobrevive ao
  // fechamento do app de propósito: restaurar um cronômetro que "correu" com o
  // app fechado mostraria um número sem significado nenhum.
  if (CHRONO_MODES.some((m) => m.id === p.mode)) chrono.mode = p.mode;
  if (typeof p.durationMs === 'number' && p.durationMs > 0) chrono.durationMs = p.durationMs;
  if (typeof p.secs === 'boolean' && !legado) chrono.secs = p.secs;
  if (typeof p.h12 === 'boolean') chrono.h12 = p.h12;
  if (typeof p.label === 'string') chrono.label = p.label;
}

function saveChronoPrefs() {
  return AVDB.setState('chronoPrefs', {
    v: CHRONO_PREFS_V,
    mode: chrono.mode, durationMs: chrono.durationMs,
    secs: chrono.secs, h12: chrono.h12, label: chrono.label,
  });
}

function chronoProjecting() { return !!(chronoSession && chronoSession.projecting); }

// O descritor enviado ao telão. É uma CÓPIA: o comando atravessa o barramento
// (e o relay nativo o serializa), então mandar o objeto vivo convidaria a uma
// mutação posterior a "vazar" para um comando já enviado.
function chronoDescriptor() {
  return {
    mode: chrono.mode, running: chrono.running, startAt: chrono.startAt,
    baseMs: chrono.baseMs, durationMs: chrono.durationMs,
    secs: chrono.secs, h12: chrono.h12,
  };
}

// Reenvia o descritor SE estiver no ar. Todo comando de start/pause/zerar/troca
// de modo passa por aqui — é o único ponto que fala com o telão, então nenhum
// caminho novo pode esquecer de atualizar a projeção.
function pushChrono() {
  if (!chronoProjecting()) return;
  cmd({ type: 'text', mode: 'chrono', chrono: chronoDescriptor(), sub: chrono.label || '', view: 'visual' });
}

// Projeta (Display + preview). Encerra Bíblia e Mensagem: a Camada de Texto é
// um cartão só, e só um provedor por vez (mesma regra de projectMessage).
function projectChrono() {
  clearBibleSession();
  clearMsgSession();
  clearDrawSession();
  chronoSession = { projecting: true };
  view = 'visual';
  persistCurrent();
  cmd({ type: 'text', mode: 'chrono', chrono: chronoDescriptor(), sub: chrono.label || '', view: 'visual' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  refreshDiversos();
}

// Tira do telão SEM parar a contagem — espelha hideMessage/hideBibleVerse: um
// áudio de fundo segue tocando, e o cronômetro segue correndo aqui para poder
// voltar ao ar no ponto certo.
function hideChrono() {
  if (!chronoProjecting()) return;
  chronoSession.projecting = false;
  cmd({ type: 'text-hide' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  refreshDiversos();
}

function clearChronoSession() {
  if (!chronoSession) return;
  chronoSession = null;
  renderNowPlaying();
  renderSlideNav();
  refreshDiversos();
}

function chronoStart() {
  if (chrono.running) return;
  chrono.running = true;
  chrono.startAt = Date.now();
  pushChrono();
  renderChrono();
}

// Pausar CONGELA o acumulado: sem isso, `startAt` sozinho perderia todo o
// trecho anterior na retomada.
function chronoPause() {
  if (!chrono.running) return;
  chrono.baseMs = createStage.chronoElapsed(chrono, Date.now());
  chrono.running = false;
  chrono.startAt = 0;
  pushChrono();
  renderChrono();
}

function chronoReset() {
  chrono.baseMs = 0;
  chrono.startAt = chrono.running ? Date.now() : 0;
  pushChrono();
  renderChrono();
}

function chronoSetMode(mode) {
  if (chrono.mode === mode) return;
  chrono.mode = mode;
  // Trocar de ferramenta zera a contagem: levar o decorrido do cronômetro para
  // dentro de um timer daria um valor que o operador não pediu nem espera.
  chrono.running = false; chrono.baseMs = 0; chrono.startAt = 0;
  saveChronoPrefs();
  pushChrono();
  renderChrono();
}

function chronoSetDuration(ms) {
  chrono.durationMs = Math.max(1000, Math.round(ms));
  saveChronoPrefs();
  pushChrono();
  renderChrono();
}

// Atualiza só o NÚMERO do painel (o resto do painel não muda a cada tick).
// No-op quando a aba não está montada — o laço pode sobreviver a um render.
function renderChronoReadout(r) {
  const el = document.getElementById('chronoRead');
  if (!el) return;
  const rr = r || chronoReading(chrono, Date.now());
  el.textContent = rr.text;
  el.classList.toggle('over', rr.over);
}

function chronoPanelTick() { renderChronoReadout(); }

function startChronoPanelTimer() {
  stopChronoPanelTimer();
  if (chrono.mode === 'clock' || chrono.running) {
    chronoPanelTimer = setInterval(chronoPanelTick, CHRONO_TICK_MS);
  }
}

function stopChronoPanelTimer() {
  if (chronoPanelTimer) { clearInterval(chronoPanelTimer); chronoPanelTimer = null; }
}

function chronoSegBtn(m) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'misc-seg' + (chrono.mode === m.id ? ' active' : '');
  b.textContent = m.name;
  b.addEventListener('click', () => chronoSetMode(m.id));
  return b;
}

function renderChrono() {
  const host = document.getElementById('chronoWrap');
  if (!host) return;
  host.innerHTML = '';

  const modes = document.createElement('div');
  modes.className = 'misc-modes';
  CHRONO_MODES.forEach((m) => modes.appendChild(chronoSegBtn(m)));
  host.appendChild(modes);

  const read = document.createElement('div');
  read.className = 'chrono-read'; read.id = 'chronoRead';
  host.appendChild(read);

  // ---- Timer: alvo da contagem ----
  if (chrono.mode === 'timer') {
    const presets = document.createElement('div');
    presets.className = 'chrono-presets';
    CHRONO_PRESETS.forEach((min) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'misc-chip' + (chrono.durationMs === min * 60000 ? ' active' : '');
      b.textContent = min + ' min';
      b.addEventListener('click', () => chronoSetDuration(min * 60000));
      presets.appendChild(b);
    });
    host.appendChild(presets);

    const row = document.createElement('div');
    row.className = 'misc-row';
    const lab = document.createElement('span');
    lab.className = 'misc-row-label'; lab.textContent = 'Minutos';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = '1'; inp.max = '600'; inp.inputMode = 'numeric';
    inp.className = 'misc-num';
    inp.value = String(Math.max(1, Math.round(chrono.durationMs / 60000)));
    // `change` (e não `input`): reprojetar a cada dígito faria o telão piscar
    // valores intermediários enquanto o operador ainda digita.
    inp.addEventListener('change', () => {
      const v = parseInt(inp.value, 10);
      if (isFinite(v) && v > 0) chronoSetDuration(v * 60000);
      else renderChrono();
    });
    row.appendChild(lab); row.appendChild(inp);
    host.appendChild(row);
  }

  // ---- Relógio: formato ----
  if (chrono.mode === 'clock') {
    const opts = document.createElement('div');
    opts.className = 'misc-opts';
    const mk = (name, on, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'misc-chip' + (on ? ' active' : '');
      b.textContent = name;
      b.addEventListener('click', fn);
      return b;
    };
    opts.appendChild(mk('Segundos', chrono.secs, () => {
      chrono.secs = !chrono.secs; saveChronoPrefs(); pushChrono(); renderChrono();
    }));
    opts.appendChild(mk('12 h', chrono.h12, () => {
      chrono.h12 = !chrono.h12; saveChronoPrefs(); pushChrono(); renderChrono();
    }));
    host.appendChild(opts);
  }

  // ---- Transporte (não existe para o relógio: a hora não se pausa) ----
  if (chrono.mode !== 'clock') {
    const acts = document.createElement('div');
    acts.className = 'chrono-actions';
    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'chrono-btn primary';
    // Ícone/rótulo = a AÇÃO, nunca o estado (ver "O ícone mostra a AÇÃO" na
    // arquitetura): correndo, o botão oferece PAUSAR.
    run.textContent = chrono.running ? 'Pausar' : 'Iniciar';
    run.addEventListener('click', () => (chrono.running ? chronoPause() : chronoStart()));
    const zero = document.createElement('button');
    zero.type = 'button'; zero.className = 'chrono-btn';
    zero.textContent = 'Zerar';
    zero.addEventListener('click', chronoReset);
    acts.appendChild(run); acts.appendChild(zero);
    host.appendChild(acts);
  }

  // ---- Sublinha do telão ----
  const labRow = document.createElement('div');
  labRow.className = 'misc-row';
  const labLab = document.createElement('span');
  labLab.className = 'misc-row-label'; labLab.textContent = 'Legenda';
  const labInp = document.createElement('input');
  labInp.type = 'text'; labInp.className = 'misc-text';
  labInp.placeholder = 'opcional — ex: Início do culto';
  labInp.maxLength = 60;
  labInp.value = chrono.label;
  labInp.addEventListener('change', () => {
    chrono.label = labInp.value.trim();
    saveChronoPrefs();
    pushChrono();
  });
  labRow.appendChild(labLab); labRow.appendChild(labInp);
  host.appendChild(labRow);

  // O PRESET vira item do roteiro. A contagem regressiva de abertura é a cena
  // mais previsível de um culto — e era justamente a que não cabia na lista do
  // culto: o operador tinha de lembrar de vir a esta aba, escolher o modo,
  // ajustar os minutos e projetar, com o salão já enchendo. Guardado aqui, um
  // toque no Cronograma faz as quatro coisas.
  host.appendChild(cueSaveRow('Guardar esta contagem', async (destino, btn) => {
    const nome = chrono.label
      || (chrono.mode === 'timer' ? 'Timer ' + Math.round(chrono.durationMs / 60000) + ' min'
        : chrono.mode === 'clock' ? 'Relógio' : 'Cronômetro');
    return criarCue('chrono', {
      mode: chrono.mode, durationMs: chrono.durationMs, label: chrono.label,
      secs: chrono.secs, h12: chrono.h12,
    }, nome, destino, btn);
  }));

  renderChronoReadout();
  startChronoPanelTimer();
}

// UM BOTÃO DE ÍCONE para "guardar isto aqui" (v5.109). Os dois destinos de uma
// cena de roteiro apareciam com rótulo em dois lugares ("Ao Cronograma" /
// "Favoritar" na Bíblia, "Cronograma" / "Favoritos" nas Ferramentas) e com
// ícone só em todos os outros (linha da lista, barra de seleção, folha das
// músicas) — o mesmo par de ações desenhado de duas formas, e a forma com texto
// era justamente a que não cabia na linha em que estava.
//
// O rótulo vira `title` + `aria-label`: sem texto na tela, é ele que nomeia o
// botão para o leitor de tela e para o toque longo.
function cueSaveBtn(icone, titulo, fn) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'cue-save-btn';
  b.title = titulo; b.setAttribute('aria-label', titulo);
  b.appendChild(msym(icone));
  b.addEventListener('click', () => fn(b));
  return b;
}

// A linha "guardar isto" das ferramentas: os DOIS destinos possíveis para uma
// cena de roteiro, lado a lado. Uma função só porque cronômetro e sorteio fazem
// exatamente a mesma pergunta — e um terceiro provedor de Camada de Texto que
// apareça amanhã ganha os dois botões sem reescrever nada.
function cueSaveRow(rotulo, montar) {
  const row = document.createElement('div');
  row.className = 'misc-row misc-row--save';
  const lab = document.createElement('span');
  lab.className = 'misc-row-label'; lab.textContent = rotulo;
  const botoes = document.createElement('div'); botoes.className = 'misc-save-btns';
  const mk = (icone, titulo, destino) => {
    botoes.appendChild(cueSaveBtn(icone, titulo, async (b) => {
      const rec = await montar(destino, b);
      if (!rec) responder(b, 'erro', 'Não foi possível guardar');
    }));
  };
  mk(ICON.cronoAdd, 'Adicionar ao Cronograma', 'imports');
  mk(ICON.star, 'Favoritar', 'favs');
  row.append(lab, botoes);
  return row;
}

// ===== Sorteio (aba Ferramentas) =====
// Quarto provedor da Camada de Texto. Sorteia NÚMERO (faixa de/até) ou TEXTO
// (uma lista de opções — nomes, prêmios, perguntas).
//
// **Quem sorteia é só o Controle.** Se cada tela rodasse o próprio
// `Math.random`, o telão e a preview anunciariam ganhadores DIFERENTES — o
// pior defeito possível aqui, e público. O resultado viaja pronto no descritor;
// o que cada lado faz sozinho é apenas a animação até ele (ver drawReading em
// stage.js).
let drawSession = null;   // { projecting } | null
let draw = {
  kind: 'number',   // 'number' | 'text'
  min: 1,
  max: 100,
  pool: [],         // opções de texto
  noRepeat: true,
  label: '',
  value: null,      // último resultado
  used: [],         // já sorteados (só conta com noRepeat)
  seed: 0,
  rollUntil: 0,
};
let drawPanelTimer = null;

const DRAW_ROLL_MS = 1800;   // suspense sem cansar
const DRAW_POOL_CAP = 40;    // amostra do ruído que viaja no comando
const DRAW_SPAN_CAP = 100000;

function drawProjecting() { return !!(drawSession && drawSession.projecting); }

function applyDrawPrefs(p) {
  if (!p) return;
  if (p.kind === 'text' || p.kind === 'number') draw.kind = p.kind;
  if (typeof p.min === 'number') draw.min = p.min;
  if (typeof p.max === 'number') draw.max = p.max;
  if (Array.isArray(p.pool)) draw.pool = p.pool.filter((x) => typeof x === 'string');
  if (typeof p.noRepeat === 'boolean') draw.noRepeat = p.noRepeat;
  if (typeof p.label === 'string') draw.label = p.label;
  // Ao contrário do cronômetro, aqui o RESULTADO e os já sorteados VOLTAM. Um
  // cronômetro restaurado mostraria um tempo que não correu; um sorteio não
  // depende do relógio — e perder "quem já foi sorteado" porque o app fechou no
  // meio faria a próxima rodada repetir alguém, que é o erro que `noRepeat`
  // existe para impedir.
  if (Array.isArray(p.used)) draw.used = p.used.map(String);
  if (typeof p.value === 'string' || typeof p.value === 'number') draw.value = String(p.value);
}

function saveDrawPrefs() {
  return AVDB.setState('drawPrefs', {
    kind: draw.kind, min: draw.min, max: draw.max, pool: draw.pool,
    noRepeat: draw.noRepeat, label: draw.label, used: draw.used, value: draw.value,
  });
}

// Quantas opções ainda podem sair. Para número não materializa a faixa: um
// "de 1 até 100000" viraria um array de 100 mil strings a cada render.
function drawRemaining() {
  if (draw.kind === 'text') {
    if (!draw.noRepeat) return draw.pool.length;
    const used = new Set(draw.used);
    return draw.pool.filter((x) => !used.has(x)).length;
  }
  const span = Math.max(0, draw.max - draw.min + 1);
  return draw.noRepeat ? Math.max(0, span - new Set(draw.used).size) : span;
}

function pickText() {
  const used = new Set(draw.used);
  const cand = draw.noRepeat ? draw.pool.filter((x) => !used.has(x)) : draw.pool;
  if (!cand.length) return null;
  return cand[Math.floor(Math.random() * cand.length)];
}

// Amostragem por REJEIÇÃO enquanto sobra folga, varredura quando aperta: numa
// faixa grande, montar a lista do que falta a cada sorteio é caro à toa; no
// fim, quando quase tudo já saiu, a rejeição é que ficaria cara.
function pickNumber() {
  const span = draw.max - draw.min + 1;
  if (span <= 0) return null;
  if (!draw.noRepeat) return draw.min + Math.floor(Math.random() * span);
  const used = new Set(draw.used.map(Number));
  if (used.size >= span) return null;
  for (let i = 0; i < 200; i++) {
    const n = draw.min + Math.floor(Math.random() * span);
    if (!used.has(n)) return n;
  }
  const left = [];
  for (let n = draw.min; n <= draw.max; n++) if (!used.has(n)) left.push(n);
  return left.length ? left[Math.floor(Math.random() * left.length)] : null;
}

// A amostra do ruído do rolo. Não é o sorteio — é só o que pisca antes de
// assentar —, então uma amostra basta e evita mandar uma lista de 500 nomes
// pelo barramento a cada rodada.
function drawNoisePool() {
  if (draw.kind !== 'text') return null;
  if (draw.pool.length <= DRAW_POOL_CAP) return draw.pool.slice();
  const out = [];
  for (let i = 0; i < DRAW_POOL_CAP; i++) out.push(draw.pool[Math.floor(Math.random() * draw.pool.length)]);
  return out;
}

function drawDescriptor() {
  return {
    kind: draw.kind, value: draw.value, seed: draw.seed, rollUntil: draw.rollUntil,
    min: draw.min, max: draw.max, pool: drawNoisePool(),
  };
}

function pushDraw() {
  if (!drawProjecting()) return;
  cmd({ type: 'text', mode: 'draw', draw: drawDescriptor(), sub: draw.label || '', view: 'visual' });
}

function doDraw() {
  const v = draw.kind === 'text' ? pickText() : pickNumber();
  if (v == null) {
    flash(draw.kind === 'text' && !draw.pool.length
      ? 'Escreva as opções antes de sortear.'
      : 'Todas as opções já saíram. Toque em "Reiniciar" para sortear de novo.');
    return;
  }
  draw.value = String(v);
  if (draw.noRepeat) draw.used.push(String(v));
  // Semente nova a cada rodada: sem ela o ruído do rolo seria idêntico toda
  // vez, e um sorteio que "roda igual" parece decidido de antemão.
  draw.seed = (Math.random() * 0x7fffffff) | 0;
  draw.rollUntil = Date.now() + DRAW_ROLL_MS;
  saveDrawPrefs();
  pushDraw();
  renderDraw();
}

function drawReset() {
  draw.used = [];
  draw.value = null;
  draw.rollUntil = 0;
  saveDrawPrefs();
  pushDraw();
  renderDraw();
}

function projectDraw() {
  clearBibleSession();
  clearMsgSession();
  clearChronoSession();
  drawSession = { projecting: true };
  view = 'visual';
  persistCurrent();
  cmd({ type: 'text', mode: 'draw', draw: drawDescriptor(), sub: draw.label || '', view: 'visual' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  refreshDiversos();
}

function hideDraw() {
  if (!drawProjecting()) return;
  drawSession.projecting = false;
  cmd({ type: 'text-hide' });
  renderControls();
  renderNowPlaying();
  renderSlideNav();
  refreshDiversos();
}

function clearDrawSession() {
  if (!drawSession) return;
  drawSession = null;
  renderNowPlaying();
  renderSlideNav();
  refreshDiversos();
}

function renderDrawReadout() {
  const el = document.getElementById('drawRead');
  if (!el) return;
  const r = createStage.drawReading(
    { kind: draw.kind, value: draw.value, seed: draw.seed, rollUntil: draw.rollUntil,
      min: draw.min, max: draw.max, pool: draw.pool },
    Date.now(),
  );
  el.textContent = r.text;
  el.classList.toggle('rolling', r.rolling);
  if (!r.rolling) stopDrawPanelTimer();
}

function startDrawPanelTimer() {
  stopDrawPanelTimer();
  if (draw.rollUntil && Date.now() < draw.rollUntil) {
    drawPanelTimer = setInterval(renderDrawReadout, DRAW_FRAME_MS);
  }
}

function stopDrawPanelTimer() {
  if (drawPanelTimer) { clearInterval(drawPanelTimer); drawPanelTimer = null; }
}

function drawChip(name, on, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'misc-chip' + (on ? ' active' : '');
  b.textContent = name;
  b.addEventListener('click', fn);
  return b;
}

function renderDraw() {
  const host = document.getElementById('drawWrap');
  if (!host) return;
  host.innerHTML = '';

  const modes = document.createElement('div');
  modes.className = 'misc-modes';
  // `id` interno × `name` exibido, como em CHRONO_MODES — o id era 'texto'
  // com um ternário remapeando para 'text' logo abaixo, dois nomes para o
  // mesmo valor dentro do mesmo laço.
  [{ id: 'number', name: 'Número' }, { id: 'text', name: 'Texto' }].forEach((m) => {
    const id = m.id;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'misc-seg' + (draw.kind === id ? ' active' : '');
    b.textContent = m.name;
    b.addEventListener('click', () => {
      if (draw.kind === id) return;
      draw.kind = id;
      // Trocar a natureza do sorteio invalida o histórico: "12" e "Maria" não
      // pertencem ao mesmo conjunto, e manter os dois faria `noRepeat` filtrar
      // por valores que nem podem sair.
      draw.used = []; draw.value = null; draw.rollUntil = 0;
      saveDrawPrefs(); pushDraw(); renderDraw();
    });
    modes.appendChild(b);
  });
  host.appendChild(modes);

  const read = document.createElement('div');
  read.className = 'draw-read'; read.id = 'drawRead';
  host.appendChild(read);

  // ---- Fonte das opções ----
  if (draw.kind === 'number') {
    const row = document.createElement('div');
    row.className = 'draw-range';
    const mk = (lab, val, fn) => {
      const wrap = document.createElement('label');
      wrap.className = 'draw-range-field';
      const s = document.createElement('span'); s.className = 'misc-row-label'; s.textContent = lab;
      const i = document.createElement('input');
      i.type = 'number'; i.inputMode = 'numeric'; i.className = 'misc-num';
      i.value = String(val);
      i.addEventListener('change', () => fn(parseInt(i.value, 10)));
      wrap.appendChild(s); wrap.appendChild(i);
      return wrap;
    };
    row.appendChild(mk('De', draw.min, (v) => {
      if (!isFinite(v)) return renderDraw();
      draw.min = v; if (draw.max < draw.min) draw.max = draw.min;
      if (draw.max - draw.min + 1 > DRAW_SPAN_CAP) draw.max = draw.min + DRAW_SPAN_CAP - 1;
      saveDrawPrefs(); renderDraw();
    }));
    row.appendChild(mk('Até', draw.max, (v) => {
      if (!isFinite(v)) return renderDraw();
      draw.max = v; if (draw.max < draw.min) draw.max = draw.min;
      if (draw.max - draw.min + 1 > DRAW_SPAN_CAP) draw.max = draw.min + DRAW_SPAN_CAP - 1;
      saveDrawPrefs(); renderDraw();
    }));
    host.appendChild(row);
  } else {
    const ta = document.createElement('textarea');
    ta.className = 'draw-pool'; ta.rows = 5;
    ta.placeholder = 'Uma opção por linha\nEx.:\nMaria\nJoão\nAna';
    ta.value = draw.pool.join('\n');
    // `change` (e não `input`): reprojetar/repersistir a cada tecla escreveria
    // no IDB dezenas de vezes enquanto o operador ainda digita a lista.
    ta.addEventListener('change', () => {
      draw.pool = ta.value.split('\n').map((s) => s.trim()).filter(Boolean);
      saveDrawPrefs(); renderDraw();
    });
    host.appendChild(ta);
  }

  // ---- Regras e histórico ----
  const opts = document.createElement('div');
  opts.className = 'misc-opts';
  opts.appendChild(drawChip('Não repetir', draw.noRepeat, () => {
    draw.noRepeat = !draw.noRepeat; saveDrawPrefs(); renderDraw();
  }));
  const left = drawRemaining();
  const info = document.createElement('span');
  info.className = 'draw-info';
  info.textContent = draw.noRepeat
    ? left + ' de ' + (draw.kind === 'text' ? draw.pool.length : Math.max(0, draw.max - draw.min + 1)) + ' restantes'
    : (draw.kind === 'text' ? draw.pool.length + ' opções' : Math.max(0, draw.max - draw.min + 1) + ' números');
  opts.appendChild(info);
  if (draw.used.length) {
    const rst = document.createElement('button');
    rst.type = 'button'; rst.className = 'misc-chip'; rst.textContent = 'Reiniciar';
    rst.addEventListener('click', drawReset);
    opts.appendChild(rst);
  }
  host.appendChild(opts);

  // Os já sorteados, à vista: numa rifa a pergunta seguinte é sempre "quem já
  // saiu?" — e o contador sozinho não responde.
  if (draw.used.length) {
    const hist = document.createElement('div');
    hist.className = 'draw-hist';
    draw.used.slice().reverse().forEach((u, i) => {
      const c = document.createElement('span');
      c.className = 'draw-hist-chip' + (i === 0 ? ' last' : '');
      c.textContent = u;
      hist.appendChild(c);
    });
    host.appendChild(hist);
  }

  // ---- Legenda ----
  const labRow = document.createElement('div');
  labRow.className = 'misc-row';
  const labLab = document.createElement('span');
  labLab.className = 'misc-row-label'; labLab.textContent = 'Legenda';
  const labInp = document.createElement('input');
  labInp.type = 'text'; labInp.className = 'misc-text';
  labInp.placeholder = 'opcional — ex: Sorteio dos visitantes';
  labInp.maxLength = 60;
  labInp.value = draw.label;
  labInp.addEventListener('change', () => {
    draw.label = labInp.value.trim(); saveDrawPrefs(); pushDraw();
  });
  labRow.appendChild(labLab); labRow.appendChild(labInp);
  host.appendChild(labRow);

  // ---- Ações ----
  const go = document.createElement('button');
  go.type = 'button'; go.className = 'draw-go';
  go.textContent = draw.used.length || draw.value ? 'Sortear de novo' : 'Sortear';
  go.disabled = left <= 0;
  go.addEventListener('click', doDraw);
  host.appendChild(go);

  // O sorteio guardado é a CONFIGURAÇÃO (faixa ou lista de opções), nunca um
  // resultado: projetar a cena arma o sorteio e espera o toque em "Sortear" —
  // um ganhador que já aparece pronto ao entrar em cena tira do momento
  // justamente o que ele tem de público.
  host.appendChild(cueSaveRow('Guardar este sorteio', async (destino, btn) => {
    const nome = draw.label || (draw.kind === 'text'
      ? 'Sorteio (' + draw.pool.length + ' opções)'
      : 'Sorteio ' + draw.min + '–' + draw.max);
    return criarCue('draw', {
      kind: draw.kind, min: draw.min, max: draw.max,
      pool: draw.kind === 'text' ? draw.pool.slice() : [], label: draw.label,
    }, nome, destino, btn);
  }));

  renderDrawReadout();
  startDrawPanelTimer();
}

// ===== Mensagens na aba Ferramentas =====
// Deixou de ser um botão flutuante sobre a preview e passou a ser uma seção
// como as outras. O FAB fazia sentido quando Mensagens era a única ferramenta
// avulsa; com três delas, ter uma em cima da preview e duas numa aba era a
// mesma pergunta ("que aviso eu ponho na tela?") respondida em dois lugares
// diferentes. E o espaço sobre a preview é justamente o que menos sobra.
function renderMsg() {
  const host = document.getElementById('msgWrap');
  if (!host) return;
  host.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'msg-list';
  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty'; empty.textContent = 'Nenhuma mensagem.';
    list.appendChild(empty);
  } else {
    messages.forEach((m, i) => {
      const active = msgSession && msgSession.projecting && msgSession.idx === i;
      const row = document.createElement('div');
      row.className = 'msg-item' + (active ? ' active' : '');
      const txt = document.createElement('div');
      txt.className = 'msg-text'; txt.textContent = m.text;
      // Tocar PROJETA — e tocar de novo TIRA DO AR (v5.104), exatamente como o
      // versículo central da Bíblia. É o mesmo gesto nos dois sentidos: quem
      // acabou de projetar um aviso tem o dedo onde precisa para tirá-lo, sem
      // procurar outro controle. Tirar do ar não encerra a sessão — a linha
      // segue selecionada e um novo toque a devolve ao telão.
      txt.addEventListener('click', () => {
        if (active) hideMessage(); else projectMessage(i);
      });
      // A mensagem entra no ROTEIRO (v5.103): o aviso de sempre — o convite do
      // sábado, o recado da secretaria — deixa de viver só nesta aba e passa a
      // ocupar o lugar dele na ordem do culto. O que o item guarda é o `id` da
      // mensagem (mais o texto como reserva), então editá-la aqui atualiza o
      // que o roteiro projeta.
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'row-btn';
      add.title = 'Adicionar ao Cronograma';
      add.appendChild(msym(ICON.cronoAdd));
      add.addEventListener('click', async (e) => {
        e.stopPropagation();
        const rec = await criarCue('message', { msgId: m.id, text: m.text },
          m.text.length > 40 ? m.text.slice(0, 40) + '…' : m.text, 'imports', add);
        if (!rec) responder(add, 'erro', 'Não foi possível adicionar');
      });
      // FAVORITAR uma mensagem (v5.104). Ela não tem id de mídia — o que se
      // favorita é a CENA dela —, então a estrela alterna a existência de um
      // cue `message` nos favoritos, em vez de mexer numa lista de ids. Para
      // quem opera é a mesma estrela de todas as outras linhas do app.
      const cueFav = favCue('message', { msgId: m.id, text: m.text });
      const fav = document.createElement('button');
      fav.type = 'button';
      fav.className = 'row-btn fav-btn' + (cueFav ? ' on' : '');
      fav.title = cueFav ? 'Remover dos favoritos' : 'Favoritar';
      fav.innerHTML = starSvg(!!cueFav);
      fav.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (cueFav) {
          await AVDB.listRemove('favs', cueFav.id);
          await recarregarFavoritos();
          responder(fav, 'ok', 'Removido dos favoritos');
        } else {
          await criarCue('message', { msgId: m.id, text: m.text },
            m.text.length > 40 ? m.text.slice(0, 40) + '…' : m.text, 'favs', fav);
        }
        // O redesenho da aba (que troca a estrela vazada pela cheia) espera o
        // pulso terminar: remontar a linha agora arrancaria o botão que está
        // justamente mostrando a confirmação.
        setTimeout(refreshDiversos, PULSO_MS);
      });
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'row-btn';
      del.appendChild(msym(ICON.del));
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(m.id); });
      row.append(txt, fav, add, del);
      list.appendChild(row);
    });
  }
  host.appendChild(list);

  const add = document.createElement('button');
  add.type = 'button'; add.className = 'msg-add-btn';
  add.textContent = '+ Nova mensagem';
  add.addEventListener('click', addMessage);
  host.appendChild(add);

}

// ===== A aba Ferramentas =====
// Três ferramentas empilhadas não cabiam numa tela de celular. A primeira
// tentativa (v5.31) foi um acordeão, e ele custava caro pelo que entregava:
// três cabeçalhos permanentes comendo altura, e a ferramenta em uso empurrada
// para baixo conforme a posição dela na pilha. Um SELETOR no topo faz o mesmo
// trabalho em UMA linha — as outras ferramentas continuam a um toque, e o
// painel ativo começa sempre no mesmo lugar, o que importa para a memória
// muscular de quem opera sem olhar.
//
// O microfone fica FORA do seletor, fixo na base: é o único controle daqui com
// urgência real (ver renderMic).
let miscTool = 'msg';

const MISC_TOOLS = [
  { id: 'msg', name: 'Mensagens', wrap: 'msgWrap', render: () => renderMsg(), live: () => msgProjecting() },
  { id: 'chrono', name: 'Tempo', wrap: 'chronoWrap', render: () => renderChrono(), live: () => chronoProjecting() },
  { id: 'draw', name: 'Sorteio', wrap: 'drawWrap', render: () => renderDraw(), live: () => drawProjecting() },
];

function renderDiversos() {
  // Só a ferramenta ATIVA é montada, e é o render dela que religa o seu timer.
  // As outras não existem no DOM — nenhum laço batendo em nó invisível.
  stopChronoPanelTimer();
  stopDrawPanelTimer();

  const sw = document.createElement('div');
  sw.className = 'misc-switch';
  MISC_TOOLS.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'misc-tab' + (miscTool === t.id ? ' active' : '');
    b.dataset.tool = t.id;
    const label = document.createElement('span');
    label.textContent = t.name;
    b.appendChild(label);
    // Ponto vermelho = esta ferramenta está PROJETANDO. Fora dela, nada na aba
    // diria isso: trocar de ferramenta não tira do telão a que estava no ar, e
    // sem o ponto o operador teria que voltar em cada uma para descobrir qual é.
    if (t.live()) {
      const dot = document.createElement('span');
      dot.className = 'misc-tab-live';
      b.appendChild(dot);
    }
    b.addEventListener('click', () => {
      if (miscTool === t.id) return;
      miscTool = t.id;
      libraryEl.innerHTML = '';
      renderDiversos();
    });
    sw.appendChild(b);
  });
  libraryEl.appendChild(sw);

  const tool = MISC_TOOLS.find((t) => t.id === miscTool) || MISC_TOOLS[0];
  const panel = document.createElement('div');
  panel.className = 'misc-panel misc-panel--' + tool.id;
  panel.id = tool.wrap;
  libraryEl.appendChild(panel);
  tool.render();

  renderFoot();
}

// Redesenha só a aba Ferramentas (usado quando o estado de uma ferramenta muda
// por fora do painel — ex.: uma mensagem projetada por outro caminho).
function refreshDiversos() {
  if (activeTab !== 'mic') return;
  libraryEl.innerHTML = '';
  renderDiversos();
}

// ===== Mensagens: botão flutuante na preview + popup =====
// Deixou de ser uma aba: um aviso de texto é uma interrupção rápida ("bem-vindos",
// "desliguem o celular"), não uma seção da biblioteca que se navega. Vive como
// um botão sobre a preview, no canto inferior esquerdo.
//
// O MESMO botão faz as duas coisas, conforme o estado: sem mensagem no ar, abre
// a lista; com uma mensagem projetada, vira um **X que a tira da tela**. É a
// ação que o operador quer ter à mão nesse momento — e evita ter que reabrir o
// popup só para desligar o que já está exibido.
function msgProjecting() { return !!(msgSession && msgSession.projecting); }

function renderLibrary() {
  const host = listHost();
  // Revoga SÓ as URLs que este host criou no render anterior — as do outro
  // host continuam em cena e continuam válidas (ver `thumbUrlsPorHost`).
  (thumbUrlsPorHost.get(host) || []).forEach((u) => URL.revokeObjectURL(u));
  thumbUrlsAtual = [];
  thumbUrlsPorHost.set(host, thumbUrlsAtual);
  host.innerHTML = '';
  // Ferramentas NÃO rola: quem administra a altura ali é o acordeão (a seção
  // aberta ocupa o que sobra e rola por dentro, se precisar). Com a rolagem da
  // lista ligada, a página inteira voltaria a rolar e o microfone sairia da
  // base — que é justamente o que o acordeão veio resolver.
  libraryEl.classList.toggle('lib-misc', activeTab === 'mic');
  // ANTES do desvio por aba, e não no fim: Bíblia, Ferramentas e a raiz dos
  // Favoritos saem por `return` daqui, e o rodapé é da CAIXA da lista, não da
  // lista — deixado para o fim, o "Importar arquivos" do Cronograma continuava
  // desenhado embaixo da grade de livros da Bíblia.
  renderListFoot();

  if (activeTab === 'bible') {
    renderBible();
    return;
  }

  if (activeTab === 'mic') {
    renderDiversos();
    return;
  }

  if (activeTab === 'folders' && !currentFolder) {
    renderFolderList();
    return;
  }

  // Filtro de busca dentro de pasta OPFS (catálogo em memória — instantâneo).
  let items = libItems;
  const fq = folderQuery.toLowerCase().trim();
  if (fq && activeTab === 'folders' && currentFolder && currentFolder._opfs) {
    items = libItems.filter((m) => m.name.toLowerCase().includes(fq));
  }

  // Lista vazia MAS com download em curso: a linha provisória é a única coisa
  // que existe, e ela precisa aparecer — é justamente o primeiro item chegando.
  // Sem isto o operador via "Cronograma vazio" durante todo o download do
  // primeiro vídeo, que é o pior momento possível para essa frase.
  const provisorias = (activeTab === 'imports' && !currentFolder)
    ? [...libBaixando.entries()].filter(([chave]) => !libItems.some((m) => m.id === chave))
    : [];

  if (items.length === 0 && !provisorias.length) {
    host.innerHTML = activeTab === 'folders'
      ? (fq ? '<li class="empty">Nenhum arquivo encontrado.</li>'
        : (currentFolder && currentFolder._opfs
          ? '<li class="empty">Pasta vazia.</li>'
          : '<li class="empty">Pasta vazia.<br>Segure itens no Cronograma para selecioná-los'
            + '<br>e use "Adicionar a uma pasta".</li>'))
      : '<li class="empty">Cronograma vazio.</li>';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    // Bug fix: active highlight only when not in selection mode
    const isActive = !selectionMode && item.id === currentId;
    li.className = 'lib-item' + (isActive ? ' active' : '') + (selected.has(item.id) ? ' selected' : '');
    li.dataset.id = item.id;

    const row = document.createElement('div'); row.className = 'row';

    // A miniatura é o primeiro elemento (flush à esquerda). A seleção múltipla
    // é indicada só pelo highlight azul (.lib-item.selected) — sem ícone de check.
    const thumb = isCue(item) ? cueThumb(item) : thumbEl(item);

    // NOME + SUBTÍTULO numa coluna só (v5.118). O tipo do item era um selo ao
    // lado do nome e disputava largura com ele — some no primeiro título
    // comprido, que é justamente onde ele faz falta. Ver `subtituloItem`.
    const textWrap = document.createElement('div'); textWrap.className = 'row-text';
    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = item.name;
    const sub = document.createElement('span'); sub.className = 'row-sub';
    sub.textContent = subtituloItem(item);
    textWrap.append(name, sub);
    // Item de player do YouTube num shell que sabe baixar: o botão converte o
    // link num arquivo local. Quem diz que ele DEPENDE DO YOUTUBE agora é o
    // subtítulo; aqui ficou só a ação de tirar essa dependência.
    let ytDl = null;
    if (item.kind === 'youtube') {
      const podeBaixar = window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 16;
      if (podeBaixar && item.url && activeTab === 'imports') {
        ytDl = document.createElement('button');
        ytDl.className = 'row-btn';
        ytDl.title = 'Baixar o vídeo e usar o arquivo no lugar do player';
        ytDl.innerHTML = downloadAllIconSvg();
        ytDl.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (ytDl.disabled) return;
          ytDl.disabled = true;
          // A linha JÁ existe: o aviso vai nela, com a chave do próprio item.
          // Se o arquivo desse vídeo já existir (baixado por outro caminho), o
          // `ytArquivo` o devolve e não há download nenhum.
          const rec = await ytArquivo(
            { id: item.youtubeId || extractYouTubeId(item.url), url: item.url, name: item.name },
            { chave: item.id, lista: 'imports' },
          );
          if (!rec) { ytDl.disabled = false; return; }
          // O arquivo TOMA O LUGAR do link, NA MESMA POSIÇÃO: duas linhas com o
          // mesmo nome deixariam o operador adivinhando qual das duas é a que
          // toca em segundo plano. `addMedia` já pendurou o novo no fim do
          // Cronograma, então a troca é "tira a cópia do fim, substitui no
          // lugar do antigo".
          await AVDB.listSet('imports', (ids) => {
            const sem = ids.filter((x) => x !== rec.id);
            const i = sem.indexOf(item.id);
            if (i >= 0) sem[i] = rec.id; else sem.push(rec.id);
            return sem;
          });
          // Agora o Cronograma o segura: sai do slot avulso (no-op se ele nunca
          // esteve lá).
          await AVDB.listRemove('avulsos', rec.id);
          // `gc` decide sozinho se o link some: ele só apaga o que não estiver
          // referenciado em nenhuma outra lista nem num Favorito — se o item
          // antigo também estiver na playlist, ele fica lá, inteiro.
          await AVDB.gc(item.id);
          if (currentId === item.id) await send(rec.id);
          await load();
        });
      }
    }
    const handle = document.createElement('button'); handle.className = 'row-handle'; handle.title = 'Arraste para reordenar';
    handle.appendChild(msym(ICON.drag));

    // Botão para entrar no Cronograma sem cópia (mesmo id nas listas; os bytes
    // continuam onde estão). Vale para QUALQUER item fora do Cronograma —
    // arquivo de pasta do dispositivo, favorito, item de atalho. Até a v5.102 só
    // a pasta OPFS o tinha: de dentro de um Favorito não havia como mandar nada
    // para a lista do culto, que é justamente o que um favorito existe para
    // fazer (o caminho era toque longo → seleção → e ali só havia playlist).
    let addBtn = null;
    if (activeTab === 'folders') {
      addBtn = document.createElement('button'); addBtn.className = 'row-btn'; addBtn.title = 'Adicionar ao Cronograma';
      addBtn.appendChild(msym(ICON.cronoAdd));
      addBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await adicionarNaLista('imports', item.id, item.name, addBtn);
      });
    }

    // A ESTRELA, em toda linha: é ela que torna favoritar um toque só. Fica
    // fora da seleção múltipla porque ali o alvo é o conjunto, não a linha.
    const star = selectionMode ? null : favBtn(item.id, item.name);

    // Item que JÁ existe e está sendo baixado (converter um link em arquivo):
    // o aviso vai nele mesmo, não na preview.
    const dl = libBaixando.get(item.id);
    if (dl) {
      li.classList.add('baixando');
      li.dataset.dl = item.id;
      const anel = document.createElement('span'); anel.className = 'dl-ring';
      anel.innerHTML = downloadArrowIconSvg();
      thumb.appendChild(anel);
    }

    const parts = [thumb, textWrap];
    if (dl) {
      const pct = document.createElement('span'); pct.className = 'dl-pct';
      pct.textContent = dl.pct >= 0 ? dl.pct + '%' : '';
      parts.push(pct);
    }
    // Baixando: o botão de converter sai de cena. Ele já está desabilitado, mas
    // continuar desenhando "baixar" ao lado de um anel girando é oferecer a
    // ação que está justamente em curso.
    if (ytDl && !dl) parts.push(ytDl);
    if (star) parts.push(star);
    if (addBtn) parts.push(addBtn);
    if (activeTab !== 'folders') parts.push(handle);
    row.append(...parts);
    li.appendChild(row);
    attachRowGestures(row, item);
    if (activeTab !== 'folders') attachHandle(handle, item.id, activeTab);
    host.appendChild(li);
  });

  // As linhas PROVISÓRIAS vão no fim, que é para onde o item vai quando
  // existir: `addMedia` sempre pendura no fim do Cronograma.
  provisorias.forEach(([chave, reg]) => host.appendChild(libBusyRow(chave, reg)));
}

// Importar arquivos é uma ação sobre ESTA lista, não uma aba — mas até a v5.106
// ele era o último `<li>` do `<ul>` rolável, e com trinta itens no Cronograma
// (que é o culto normal) alcançá-lo exigia rolar a lista inteira. Agora mora no
// RODAPÉ FIXO da caixa da lista (`#listFoot`), fora da rolagem: continua junto
// do lugar onde os arquivos vão cair e está sempre a um toque.
// O `<input type="file">` continua dentro de um <label>, que é o que dispensa
// JS pra abrir o seletor.
//
// A função reconstrói só o que é DELA: o rodapé é dividido com a barra de
// seleção (ver `hostSelbar`), e um `innerHTML = ''` aqui tiraria a `#selbar` do
// documento — o nó é um só, movido, e perdê-lo significa perder os listeners.
function renderListFoot() {
  const antiga = listFootEl.querySelector('.import-row');
  // O seletor de arquivos mora DENTRO da linha antiga; tirá-lo antes de
  // descartá-la é o que preserva o listener de `change` (mesmo cuidado do
  // fantasma da troca de aba).
  if (fileEl.parentElement && fileEl.parentElement.closest('.import-row')) mainEl.appendChild(fileEl);
  if (antiga) antiga.remove();
  // O rodapé some quando não tem inquilino nenhum. Não dá para deixar isso com
  // um `:empty` no CSS: a `#selbar` MORA aqui mesmo fora da seleção (escondida
  // pelo `hidden`), então o rodapé nunca fica de fato vazio — e um filho de
  // altura zero ainda consome o `gap` do `<main>`, que viraria uma faixa de ar
  // acima da caixa de controles em toda aba sem rodapé.
  const temImport = activeTab === 'imports' && !currentFolder && !selectionMode;
  const temSelbar = selectionMode && selbarEl.parentElement === listFootEl;
  listFootEl.hidden = !temImport && !temSelbar;
  if (!temImport) return;
  const li = document.createElement('div');
  li.className = 'import-row';

  // UM botão só, para TODO arquivo — inclusive apresentação (v5.99). O que
  // muda é só QUEM abre o seletor:
  //
  //  - no app (shell ≥ 21), o seletor do SISTEMA (`AVNative.pickDoc`). É o
  //    único caminho que serve para o PDF: o `<input type="file">` devolve um
  //    `File` — bytes já lidos —, e quem desenha o PDF é o shell, que precisa
  //    do ARQUIVO; mandar os bytes de volta pela ponte inverteria o princípio
  //    dela ("URLs servíveis, nunca bytes"). O `content://` que o seletor
  //    entrega é a mesma porta por onde as pastas do dispositivo já entram.
  //  - no navegador (e num shell antigo), o `<input type="file">` de sempre,
  //    dentro de um <label>, que é o que dispensa JS para abrir o seletor.
  //
  // O rótulo é o mesmo nos dois casos: o operador escolhe o ARQUIVO, não a
  // porta por onde ele entra.
  const usaSeletorNativo = window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 21;
  const label = document.createElement(usaSeletorNativo ? 'button' : 'label');
  if (usaSeletorNativo) label.type = 'button';
  label.className = 'import-btn';
  label.title = 'Importar arquivos (mídia, PDF ou PowerPoint)';
  label.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>'
    + '<path d="M14 3v5h5"/>'
    + '<line x1="12" y1="12" x2="12" y2="17.6"/>'
    + '<line x1="9.2" y1="14.8" x2="14.8" y2="14.8"/></svg>';
  const txt = document.createElement('span');
  txt.textContent = 'Importar arquivos';
  label.appendChild(txt);
  if (usaSeletorNativo) label.addEventListener('click', importarPeloSistema);
  else label.appendChild(fileEl); // o MESMO input de sempre, só reposicionado

  // O BOTÃO DE FAVORITOS SAIU DAQUI (v5.104). Ele fazia par com "Importar" — as
  // duas respondendo "de onde vem a mídia?" —, mas era também a ÚNICA porta da
  // gaveta, e uma porta no fim de uma lista rolável não é acesso rápido: com
  // trinta itens no Cronograma era preciso rolar tudo para chegar num favorito.
  // Agora ela mora no cabeçalho FIXO, com rótulo, alcançável de qualquer aba —
  // e "Importar arquivos" fica com a linha inteira, que é o que ele sempre
  // quis (o nome do botão cabe sem reticências em qualquer tela).
  li.appendChild(label);
  listFootEl.appendChild(li);
}

// Os tipos que o seletor do sistema oferece. PDF e PPTX entram na MESMA lista
// dos de mídia: uma apresentação é um arquivo como qualquer outro, e separá-la
// num botão próprio faria o operador escolher a PORTA antes de escolher o
// arquivo. `.ppt` (o binário anterior a 2007) e `.odp` ficam de fora porque o
// app não sabe desenhá-los — oferecer e depois falhar é pior que não oferecer.
const IMPORT_MIMES = [
  'image/*', 'video/*', 'audio/*',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',');

async function importarPeloSistema() {
  const escolhidos = await AVNative.pickDoc(IMPORT_MIMES);
  if (!escolhidos || !escolhidos.length) return;   // o operador desistiu
  // Pelo MESMO caminho do compartilhamento: os itens já vêm no formato
  // `{ name, type, url }` que ele espera, e é lá que mora o roteamento por
  // tipo. Duas rotas de importação divergiriam na primeira correção.
  await importShare({ files: escolhidos });
}

// "N de M músicas" — e o M NÃO é o tamanho da lista (v5.134). Uma música cuja
// origem não tem áudio (`semAudio`, ver `ensureSongVariant`) nunca vira arquivo
// no aparelho: mantê-la no denominador travava o contador em 53/54 para sempre,
// ao lado de um chip dizendo "Completo offline" — as duas frases certas pela
// sua própria régua, contando coisas diferentes na mesma linha. Ela sai dos
// DOIS lados da fração, que é o mesmo que `colecaoCompleta` já faz.
function songsBaixaveis(id) {
  return collSongs(id).filter((s) => !s.semAudio);
}
function countDownloaded(id) {
  return collSongs(id).filter((s) => s.fileIdFull).length;
}

// (O ícone de antena `wifiIconEl()` saiu na v5.73 com o chip "Rede" das opções
// do álbum, seu único consumidor. A regra de rede não mudou: quem decide se a
// sincronização em massa pergunta antes de usar dados móveis continua sendo
// `isConfirmedWifi()`, e ela o diz na hora, no diálogo — que é onde a
// informação tem consequência. Um chip permanente repetindo o estado da rede
// em cada álbum aberto era ruído entre dados sobre o ÁLBUM.)

// SVG inline (fora do subset da fonte): setas circulares de "sincronizar".
function syncIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>'
    + '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
    + '</svg>';
}
// SVG inline de "baixar tudo" — seta para baixo sobre uma bandeja, distinta
// das setas circulares de "sincronizar" (que é por álbum): aqui é a coleção
// inteira, uma ação de outra escala.
function downloadAllIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 3v10"/><polyline points="8 9 12 13 16 9"/>'
    + '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'
    + '</svg>';
}
// SVG inline de "cancelar" — o mesmo botão do grupo enquanto o lote roda.
function closeIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
    + '</svg>';
}
// SVG inline de "check" (verde), usado no status "Completo offline".
function checkIconSvg() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
}
// (`listIconSvg` saiu: sem chamador desde que "Ver músicas" deixou as opções
// do álbum — a lista é o toque no card.)
// SVG inline de "seta para cima" — o MESMO botão da engrenagem enquanto as
// opções estão à mostra (v5.73). A engrenagem acesa dizia "as opções estão
// abertas" só pela cor; a seta diz o que o toque FAZ, que é recolher o painel
// que está logo abaixo dela. É a convenção de qualquer gaveta, e aqui o alvo é
// literalmente o teto do painel que ela fecha.
function chevronUpIconSvg() {
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
}
// (`gearIconSvg` saiu na v5.95, com o botão de opções do card: as opções agora
// aparecem sozinhas com o álbum aberto, e o único símbolo daquele canto é a
// seta que fecha. O mesmo desenho continua no botão de Configurações que
// flutua sobre a preview, que tem o seu.)
// SVG inline de "voz" (microfone) — botão de tocar a variante CANTADO (vocal).
function voiceIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
}
// SVG inline de "nota musical" — botão de tocar a variante PLAYBACK (instrumental).
function noteIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';
}

// Lista de cards da aba Álbuns: hinários (fixos) + um card por álbum do
// catálogo. Cada card é um "check do sistema" (não abre como pasta): símbolo,
// status, estatísticas e ações.
// Um álbum que na verdade é hinário não ganha card próprio (os dois hinários
// já são coleções fixas). O fato vem de `album_{id}.categories` e só se sabe
// depois de baixar o índice do álbum; até lá, o nome é o palpite disponível.
function isHymnalAlbum(coll) {
  if (coll.kind !== 'album') return false;
  const st = collState[coll.id];
  if (st && st.isHymnal != null) return !!st.isHymnal;
  return /hin[aá]rio/i.test(coll.name || '');
}

// O NÚMERO só existe em hinário. Ali ele é o nome da música — se pede "o 471",
// e a numeração é a mesma no hinário impresso de todo mundo. Num álbum,
// `track` é só a posição no disco: um dado de catálogo que ninguém usa para
// pedir nem para achar. "12. Ele Vem" não ajuda a reconhecer nada, e numa
// busca global punha uma coluna de números sem significado na frente de todo
// título de álbum.
function collNumbersSongs(coll) {
  return !!coll && (coll.kind === 'hymnal' || isHymnalAlbum(coll));
}

// Rótulo da música. É o ÚNICO lugar que decide se o número entra — a lista da
// coleção, a busca, o nome do arquivo baixado e o slide de capa passam todos
// por aqui (ou pelo `hymnTrack` que ele governa).
function songLabel(coll, s, pad) {
  const n = collNumbersSongs(coll) && s.track
    ? (pad ? String(s.track).padStart(3, '0') : String(s.track)) + '. ' : '';
  return n + s.name;
}

// Faixa de álbum já baixada carrega o número GRAVADO no registro ("012. Nome
// (Cantado)" e `hymnTrack`), de quando tudo era numerado. Só parar de escrever
// deixaria a biblioteca existente numerada para sempre — e é justamente ela que
// o operador já tem. Passagem única, marcada em estado: varre os arquivos das
// coleções que não numeram e tira o prefixo. Não recalcula o nome a partir de
// `hymnName` porque o registro também cobre importados e variantes; remover o
// "N. " da frente é a operação exata, e nada mais.
const MIG_SEM_NUMERO = 'migSemNumeroAlbuns';

async function desnumerarAlbunsBaixados() {
  if (await AVDB.getState(MIG_SEM_NUMERO)) return;
  try {
    const semNumero = new Set(
      allCollections().filter((c) => !collNumbersSongs(c)).map((c) => c.id));
    if (semNumero.size) {
      const arquivos = await AVDB.filesAll();
      for (const rec of arquivos) {
        if (!semNumero.has(rec.folder)) continue;
        const limpo = String(rec.name || '').replace(/^\d+\.\s*/, '');
        if (limpo === rec.name && rec.hymnTrack == null) continue;
        rec.name = limpo;
        rec.hymnTrack = null;
        await AVDB.fileAdd(rec);
      }
    }
    await AVDB.setState(MIG_SEM_NUMERO, 1);
  } catch (_) {
    // Sem a marca, a próxima abertura tenta de novo — é uma limpeza cosmética
    // e nada depende dela para o app funcionar.
  }
}

// A aba Álbuns espelha a classificação do banco: **categoria → álbum**, na
// ordem que o próprio banco define (`order`), com os hinários num grupo fixo
// no topo. Antes era uma lista plana de todos os álbuns em ordem de descoberta
// — sem categoria, sem subtítulo e sem ordem —, o que tornava impossível achar
// um álbum específico entre dezenas.
//
// A relação categoria↔álbum é N:N, então **o mesmo álbum pode aparecer em mais
// de uma categoria** — de propósito: é assim no banco e no app original, e o
// `subtitle` que acompanha o card muda conforme a categoria (é campo de pivô).
// Álbuns de uma categoria que de fato viram card (existem no catálogo e não
// são hinário disfarçado).
function categoryCards(cat) {
  const byId = new Map(allCollections().map((c) => [c.id, c]));
  const out = [];
  for (const a of cat.albums) {
    const coll = byId.get('album-' + a.id_album);
    if (coll && !isHymnalAlbum(coll)) out.push({ coll, ctx: a });
  }
  return out;
}

// O MIOLO do cabeçalho de grupo — contador (busy/done/fração) + botão de
// lote/cancelar — usado pelo `header()` da lista E pelo "Baixar todo o acervo"
// fixo do popup (`renderAcervoTotal`). Era escrito duas vezes, compartilhando
// até o mesmo estado (`gui(key)`); com o miolo num lugar só, a régua do verde
// e o comportamento do botão não têm como divergir entre os dois.
// `aposClique` é a diferença legítima do popup: ele precisa se redesenhar.
function montarResumoGrupo(host, key, text, colls, gOpts, aposClique) {
  const g = gui(key);
  const complete = grupoCompleto(colls);

  const info = document.createElement('span');
  info.className = 'coll-group-count' + (g.busy ? ' busy' : (complete ? ' done' : ''));
  info.textContent = g.status || fracaoPeso(colls.map((c) => c.id)) || '—';
  host.appendChild(info);

  // COM O GRUPO INTEIRO BAIXADO O BOTÃO SAI DA LINHA (v5.135) — a MESMA regra
  // da barra do card. Enquanto o download ROLA ele continua, porque ali ele é
  // o cancelar.
  if (!complete || g.busy) {
    const btn = document.createElement('button');
    btn.className = 'coll-group-btn' + (g.busy ? ' busy' : '');
    btn.title = g.busy
      ? 'Cancelar o download'
      : (gOpts && gOpts.confirmScale)
        ? 'Baixar TODA a biblioteca (' + colls.length + ' coleções)'
        : 'Baixar a coleção completa (' + colls.length + ' álbum(ns))';
    btn.innerHTML = g.busy ? closeIconSvg() : downloadAllIconSvg();
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      syncGroup(key, text, colls, gOpts);
      if (aposClique) aposClique();
    });
    host.appendChild(btn);
  }
}

// O MESMO navegador de acervo, em dois lugares: a aba Álbuns e o estado padrão
// da busca (ver renderSearchResults). É uma função só de propósito — duas
// cópias divergiriam no primeiro ajuste de categoria, e o operador veria dois
// acervos diferentes conforme por onde entrou.
function renderCollectionsList(alvo, redesenhar, opts) {
  // A passada é síncrona: liga a memoização de `levantarColecao`/taxa global
  // (ver "Memoização por PASSADA de render"), zerada aqui a cada redesenho.
  // O `finally` desliga mesmo se um card lançar — cache ligado fora de uma
  // passada é dado velho em diálogo de confirmação.
  cacheLevantar.clear(); cacheBpsGlobal = 0;
  cacheColecoesAtivo = true;
  try {
    renderCollectionsListMiolo(alvo, redesenhar, opts);
  } finally {
    cacheColecoesAtivo = false;
  }
}
function renderCollectionsListMiolo(alvo, redesenhar, opts) {
  alvo = alvo || libraryEl;
  redesenhar = redesenhar || renderLibrary;
  redesenharAcervo = redesenhar;
  const byId = new Map(allCollections().map((c) => [c.id, c]));
  let any = false;

  // Cabeçalho de grupo: nome + resumo (baixados/total do grupo inteiro) + o
  // botão que baixa a COLEÇÃO COMPLETA — ele deixou de ser só um rótulo e
  // passou a ser onde mora a ação. (`showName === false` existia para o caso
  // de um filtro ativo, quando a pílula selecionada já dizia o nome do grupo;
  // as pílulas saíram na v5.70, e hoje só "Todo o acervo" o usa, porque ali o
  // nome estaria dentro do próprio botão.)
  // O parâmetro se chama `gOpts`, e não `opts`, para não sombrear o `opts` de
  // `renderCollectionsList` — o `semTotal` lá de fora é lido DENTRO desta
  // função de render, e o shadowing esconderia o engano em silêncio.
  const header = (text, colls, showName, gOpts) => {
    const li = document.createElement('li');
    li.className = 'coll-group';
    if (showName !== false) {
      const name = document.createElement('span');
      name.className = 'coll-group-name';
      name.textContent = text;
      li.appendChild(name);
    }
    if (colls && colls.length && !(gOpts && gOpts.semBotao)) {
      // Contador + botão de lote: o miolo compartilhado (`montarResumoGrupo`,
      // acima) — a regra de o botão sumir com o grupo completo, o cancelar
      // durante o download e a régua do verde moram lá.
      montarResumoGrupo(li, 'grp:' + text, text, colls, gOpts);
    } else if (colls && colls.length) {
      // Grupo SEM botão de lote (ver "Hinários"): o contador continua, porque
      // ele informa; o que sai é a ação que juntaria coleções grandes demais
      // num download só. A régua do "verde" é a MESMA do ramo com botão
      // (`grupoCompleto`, que conta VARIANTES): a conta anterior, por músicas
      // com `fileIdFull`, ignorava Playbacks e pintava de completo um hinário
      // com instrumentais faltando — a divergência que a v5.134 aboliu.
      const info = document.createElement('span');
      info.className = 'coll-group-count' + (grupoCompleto(colls) ? ' done' : '');
      info.textContent = fracaoPeso(colls.map((c) => c.id)) || '—';
      li.appendChild(info);
    }
    alvo.appendChild(li);
  };

  // Baixar TODO o acervo de uma vez: os hinários mais todos os álbuns de todas
  // as categorias.
  // `semTotal`: no popup do acervo esta barra subiu para o CABEÇALHO (ver
  // renderAcervoTotal) — é a ação de maior alcance da tela e estava rolando
  // junto com a lista, saindo de vista assim que se descia um pouco.
  if (!(opts && opts.semTotal)) {
    const todas = allCollections().filter((c) => !isHymnalAlbum(c));
    if (todas.length > 1) header('Toda a biblioteca', todas, true, { confirmScale: true });
  }

  const fixed = FIXED_COLLECTIONS.filter((c) => byId.has(c.id));
  if (fixed.length) {
    // **Os hinários NÃO baixam em lote.** São as duas maiores coleções do
    // acervo (~1.100 músicas juntas): um botão só disparando as duas é um
    // download que ninguém consegue dimensionar antes de tocar, e que não dá
    // para parar pela metade sem perder o outro. Cada um baixa pelo próprio
    // card (o botão na barra). O contador do grupo fica — ele informa.
    header('Hinários', fixed, true, { semBotao: true });
    fixed.forEach((coll) => { alvo.appendChild(renderCollectionCard(coll)); any = true; });
  }

  for (const cat of albumCatalog.categories) {
    const cards = categoryCards(cat);
    if (!cards.length) continue;
    header(cat.name, cards.map((x) => x.coll), true);
    cards.forEach(({ coll, ctx }) => { alvo.appendChild(renderCollectionCard(coll, ctx)); any = true; });
  }

  // Álbuns conhecidos que nenhuma categoria reivindicou (catálogo antigo,
  // migrado de uma versão sem categorias, ou álbum removido de todas elas).
  const claimed = new Set();
  for (const cat of albumCatalog.categories) for (const a of cat.albums) claimed.add('album-' + a.id_album);
  const orphans = albumCatalog.albums
    .map((a) => byId.get('album-' + a.id_album))
    .filter((c) => c && !claimed.has(c.id) && !isHymnalAlbum(c));
  if (orphans.length) {
    header(albumCatalog.categories.length ? 'Outros álbuns' : 'Álbuns', orphans, true);
    orphans.forEach((coll) => { alvo.appendChild(renderCollectionCard(coll)); any = true; });
  }

  if (!any) {
    const empty = document.createElement('li'); empty.className = 'empty';
    empty.textContent = 'Nenhuma coleção disponível.';
    alvo.appendChild(empty);
  }
}

// Cartão informativo de UMA coleção (hinário ou álbum) — NÃO é uma pasta: é um
// "check do sistema" (símbolo, status, estatísticas sincronizados/peso/rede +
// ações sincronizar/excluir). Não abre como pasta ao tocar (o operador
// acessa/toca as músicas pela busca do acervo, botão de lupa). Sempre visível,
// mesmo antes da 1ª sincronização. Retorna o <li> (não anexa).
//
// COLAPSADO POR PADRÃO (deixa a lista compacta): mostra só uma barra com nome +
// resumo de sincronização (baixados/total). Tocar na barra EXPANDE o card com o
// detalhe completo (status, ações, estatísticas). O estado (expandido) é
// transitório em `ui(coll.id).expanded` (não persistido) — cada abertura do app
// começa colapsada.
// `ctx` = a entrada do álbum DENTRO da categoria sendo renderizada (o pivô:
// subtitle/order). Nulo para hinários e órfãos.
function renderCollectionCard(coll, ctx) {
  const total = songsBaixaveis(coll.id).length;
  const downloaded = countDownloaded(coll.id);
  // UMA definição só, e ela conta VARIANTES (ver `levantarColecao`): a antiga
  // comparava músicas com `fileIdFull`, ignorando os Playbacks que o download
  // busca — e nunca ficava completa numa coleção com música sem áudio na
  // origem, deixando o botão de baixar para sempre na tela.
  const complete = colecaoCompleta(coll.id);
  const u = ui(coll.id);

  const li = document.createElement('li');
  li.className = 'hymnal-card';
  // (A `coll.color` do banco desenhava uma faixa lateral de 3px no cartão. Ela
  // saiu na v5.71 com as molduras: era mais uma linha vertical repetida em toda
  // a lista. O campo continua no catálogo, de graça, se um dia a cor voltar
  // como tinta do ícone.)

  // Uma linha só: ícone + nome/subtítulo + resumo + engrenagem. O card deixou
  // de ser um acordeão de manutenção — TOCAR NELE ABRE A LISTA DE MÚSICAS, que
  // é o que o operador quer quase sempre. Sincronizar, excluir e o estado do
  // download moram atrás da engrenagem (openCollectionOptions), fora do
  // caminho de uso.
  const bar = document.createElement('div'); bar.className = 'coll-bar';
  const barIcon = document.createElement('div'); barIcon.className = 'coll-bar-icon';
  barIcon.appendChild(msym(ICON[coll.iconKey] || ICON.music));

  const info = document.createElement('div'); info.className = 'coll-bar-info';
  const barName = document.createElement('span'); barName.className = 'coll-bar-name'; barName.textContent = coll.name;
  info.appendChild(barName);
  const subtitle = ctx && ctx.subtitle;
  if (subtitle) {
    const sub = document.createElement('span'); sub.className = 'coll-bar-sub';
    sub.textContent = subtitle;
    info.appendChild(sub);
  }
  bar.append(barIcon, info);

  // Resumo de sincronização: progresso ao vivo enquanto sincroniza, senão
  // baixados/total.
  //
  // COM O ÁLBUM INTEIRO BAIXADO ELE SOME (v5.70), junto com o botão de baixar
  // que já saíra na v5.63. "24/24" não pede nada nem informa nada de novo — é
  // ruído repetido em cada linha de uma lista de dezenas de álbuns, e o estado
  // que o operador procura ali é justamente o oposto: o que ainda FALTA. Numa
  // lista toda baixada, o silêncio é a resposta certa, e ela continua legível
  // por eliminação: "não sincron." quando não há índice, uma fração quando
  // falta algo, nada quando está completo. O detalhe (peso, "✓ Completo
  // offline") segue na engrenagem dentro do card aberto.
  const summary = document.createElement('span'); summary.className = 'coll-bar-sync';
  const peso = fracaoPeso([coll.id]);
  if (u.syncBusy && u.status) {
    summary.classList.add('busy'); summary.textContent = u.status;
  } else if (peso) {
    summary.textContent = peso;
  } else {
    summary.textContent = coll.kind === 'album' ? 'não sincron.' : '—';
  }
  bar.appendChild(summary);
  // Reconferência do peso: uma vez por sessão e por álbum (ver a função — desde
  // a v5.134 ela vale para qualquer peso, não só o zerado).
  conferirPesoSeFaltar(coll.id);

  // A BARRA INTEIRA é o alvo do acordeão: o toque nela abre a coleção ali
  // mesmo. Houve uma seta anunciando isso; ela saiu na v5.71, porque numa lista
  // em que todo card abre ela dizia o mesmo em todas as linhas — e quem anuncia
  // a abertura agora é o próprio movimento, animado desde a v5.63.
  // A engrenagem desceu para dentro do aberto (ver abaixo) — manutenção é o que
  // se procura depois de já estar olhando o álbum, não antes.
  // Baixar/cancelar direto na barra. Desde a v5.45 a engrenagem mora DENTRO
  // do card aberto — o que, num hinário de 600 faixas, punha a ação de baixar
  // atrás de expandir uma lista enorme. E é por este botão que cada hinário
  // baixa separado do outro (ver o cabeçalho "Hinários").
  // COM O ÁLBUM INTEIRO BAIXADO O BOTÃO SAI DA BARRA. Ele dizia "Baixar esta
  // coleção" para uma coleção que já está toda no aparelho — um alvo do tamanho
  // de `--hit` oferecendo uma ação sem efeito, em cada linha de uma lista de
  // dezenas de álbuns. O que resta a fazer ali (re-sincronizar o índice, apagar,
  // ver o peso) é manutenção e já mora na engrenagem DENTRO do card aberto, que
  // é onde se procura depois de abrir o álbum. Enquanto o download ROLA o botão
  // continua, porque ali ele é o cancelar.
  // ABERTO, a engrenagem toma o lugar do botão de baixar (v5.72). São a mesma
  // coluna e o mesmo alvo, e nunca fazem falta ao mesmo tempo: fechado o que se
  // decide é "baixo isto?"; aberto, já se está olhando o conteúdo, e o que
  // sobra é manutenção. Antes ela era uma barra larga rotulada DENTRO do card —
  // uma linha inteira gasta com o que agora cabe no canto que já existia.
  //
  // A exceção é o download EM CURSO: ali o botão é o CANCELAR, e ele continua
  // na barra mesmo com o card aberto. Um álbum de centenas de faixas, uma vez
  // começado, precisa poder parar num toque — esconder isso atrás da engrenagem
  // devolveria o problema que o botão de cancelar veio resolver.
  if (u.expanded && !u.syncBusy) {
    const cfg = document.createElement('button');
    cfg.className = 'coll-bar-dl coll-bar-cfg';
    cfg.title = 'Fechar o álbum';
    // A SETA FECHA O ÁLBUM (v5.95). Ela era uma engrenagem que abria um painel
    // de opções dentro do card — mas com as opções encolhidas numa linha só de
    // dois botões, elas cabem SEMPRE que o álbum está aberto, e um botão para
    // revelar duas ações que já caberiam na tela é cerimônia. O alvo continua
    // sendo o mesmo canto de sempre; o que ele faz agora é o que a seta já
    // dizia.
    cfg.innerHTML = chevronUpIconSvg();
    cfg.addEventListener('click', (e) => {
      e.stopPropagation();   // divide a barra com o toque que também alterna
      alternarAcordeao();
    });
    bar.appendChild(cfg);
  } else if (u.syncBusy || !complete) {
    const dl = document.createElement('button');
    dl.className = 'coll-bar-dl' + (u.syncBusy ? ' busy' : '');
    dl.title = u.syncBusy ? 'Cancelar o download'
      : (total > 0 ? 'Baixar esta coleção' : 'Sincronizar a lista');
    dl.innerHTML = u.syncBusy ? closeIconSvg() : downloadAllIconSvg();
    dl.addEventListener('click', (e) => { e.stopPropagation(); syncCollection(coll); });
    bar.appendChild(dl);
  }

  // Sem índice ainda não há lista para abrir — o toque abre o card assim mesmo,
  // e o que ele mostra são as opções, onde está o sincronizar que resolve isso.
  //
  // Nomeada porque tem DOIS gatilhos: o toque na barra e a seta (v5.95).
  const alternarAcordeao = () => {
    if (!total && !u.expanded) { openCollectionOptions(coll); return; }
    // Acordeão: uma coleção aberta por vez. Duas listas de centenas de músicas
    // abertas ao mesmo tempo empurrariam o acervo para fora da tela e tirariam
    // do lugar exatamente o card que o operador mira.
    const abrindo = !u.expanded;
    const aplicar = () => {
      // Fechar zera a paginação junto: reabrir um hinário de 613 hinos que
      // ficou rolado até o fim traria os 613 de volta de uma vez, que é
      // exatamente o custo que `COLL_PAGE` existe para evitar.
      allCollections().forEach((c) => { const x = ui(c.id); x.expanded = false; x.shown = 0; });
      u.expanded = abrindo;
      if (abrindo) u.shown = COLL_PAGE;
      // O card só existe DEPOIS do redesenho (a lista inteira é reconstruída),
      // então quem anima a abertura é o próprio render — este é o recado.
      if (abrindo) u.animarAbertura = true;
      redesenharAcervo();
    };
    // Fechando: anima ANTES de redesenhar. O redesenho apaga o nó, e um nó
    // apagado não tem como sair deslizando.
    const aberto = li.querySelector('.coll-open');
    if (!abrindo && aberto) { collapseAccordion(aberto, aplicar); return; }
    aplicar();
  };
  bar.addEventListener('click', alternarAcordeao);
  li.appendChild(bar);

  // ----- Aberto: as opções (se pedidas) + as músicas da coleção -----
  // `total === 0` também abre: é o caso do álbum sem índice, em que o card só
  // tem as opções a mostrar — e é para elas que o toque na barra leva.
  if (u.expanded) {
    li.classList.add('expanded');

    // Um invólucro só para os dois blocos abertos: é ele que a animação de
    // altura recorta. As margens negativas dele repetem as da lista de músicas
    // (que sangra até a borda do card para o filete do topo atravessar a
    // largura toda) — sem isso o `overflow:hidden` cortaria justamente esse
    // filete durante a animação.
    const aberto = document.createElement('div'); aberto.className = 'coll-open';

    // As opções ALI MESMO, logo abaixo da barra, dentro do card (v5.72). Eram
    // um bottom-sheet (`#collPopup`), e um popup para ver o peso e o estado de
    // sincronização de um álbum que já está aberto na tela era uma camada a
    // mais sobre outra camada — o acervo já é um popup de tela cheia. Aqui elas
    // ficam onde o assunto está, e fechar é o mesmo toque que abriu.
    const opts = document.createElement('div'); opts.className = 'coll-opts coll-opts--inline';
    buildCollectionOptions(coll, opts);
    aberto.appendChild(opts);

    // A lista sai INTEIRA, quantos itens tenha: aqui o operador está folheando
    // um álbum, não filtrando o acervo — cortar num teto esconderia o fim de
    // qualquer hinário. É o mesmo `hymnResultRow` da busca, sem o subtítulo da
    // coleção (que é o próprio card em volta). Ela só chega em PÁGINAS de
    // `COLL_PAGE`, à medida que o scroll alcança o fim — ver `fillSongList`.
    if (total > 0) {
      const lista = document.createElement('ul'); lista.className = 'coll-songs';
      fillSongList(lista, coll, u);
      aberto.appendChild(lista);
    }
    li.appendChild(aberto);

    // Só o toque que ABRIU anima. Um redesenho por outro motivo (o progresso do
    // download, a volta de uma sincronização) reencontra o card já aberto — e
    // vê-lo "abrir" de novo sozinho leria como se algo tivesse acontecido.
    if (u.animarAbertura) {
      u.animarAbertura = false;
      // O `li` ainda não está no documento: medir agora daria zero.
      requestAnimationFrame(() => expandAccordion(aberto));
    }
  }
  return li;
}

// ===== A lista do álbum chega em páginas =====
// Um hinário tem 613 hinos, e cada linha é um `<li>` com miniatura, dois botões
// e SVG inline dentro deles. Montar as 613 de uma vez no toque que abre o card
// é meio segundo de JAVASCRIPT SÍNCRONO num celular: a animação de abertura
// nasce já engasgada e o toque parece não ter funcionado. Pior, isso acontece
// TODA vez que o card é redesenhado — e o progresso de um download redesenha o
// acervo a cada `COLL_REFRESH_MS`.
//
// Então a lista chega de `COLL_PAGE` em `COLL_PAGE`, e o gatilho da próxima
// página é o SCROLL CHEGAR NO FIM da anterior — não um botão. Quem folheia um
// hinário está procurando um hino, não administrando uma lista: parar para
// pedir mais é atrito num gesto que já é contínuo.
const COLL_PAGE = 100;

// Preenche (ou completa) `lista` até `u.shown` e reinstala a sentinela do fim.
// É INCREMENTAL de propósito: a próxima página é anexada às linhas que já estão
// no DOM, sem reconstruir as anteriores — reconstruir mexeria no scroll debaixo
// do dedo do operador, que é o gesto que acabou de pedir a página.
function fillSongList(lista, coll, u) {
  const songs = collSongs(coll.id);
  if (!u.shown) u.shown = COLL_PAGE;
  const ate = Math.min(u.shown, songs.length);
  for (let i = lista.querySelectorAll('.hymn-result').length; i < ate; i++) {
    lista.appendChild(hymnResultRow(coll, songs[i], null, true));
  }

  const velha = lista.querySelector('.coll-more');
  if (velha) {
    if (velha.__obs) velha.__obs.disconnect();
    velha.remove();
  }
  if (ate >= songs.length) return;

  // A sentinela é também o BOTÃO da próxima página. O observador cobre o caso
  // normal (o dedo rolando), o toque cobre quem chegou aqui de outro jeito —
  // uma lista curta demais para rolar dentro do popup, por exemplo.
  const sent = document.createElement('li');
  sent.className = 'coll-more';
  const btn = document.createElement('button');
  btn.className = 'coll-more-btn';
  btn.innerHTML = '<span class="dl-ring"></span>';
  btn.appendChild(document.createTextNode('Carregando mais ' + Math.min(COLL_PAGE, songs.length - ate)
    + ' de ' + (songs.length - ate) + ' restantes'));
  sent.appendChild(btn);

  const mais = () => {
    if (sent.__obs) sent.__obs.disconnect();
    if (!lista.isConnected) return;
    u.shown = ate + COLL_PAGE;
    fillSongList(lista, coll, u);
  };
  btn.addEventListener('click', mais);

  // `root: null` (a viewport) resolve sozinho o problema de descobrir QUAL é o
  // contêiner que rola — a interseção com a viewport já vem recortada pelos
  // `overflow` dos ancestrais, então a sentinela só "aparece" quando de fato
  // aparece na tela. A margem adianta a página em ~300px: o objetivo é que o
  // operador nunca CHEGUE a ver esta linha.
  const obs = new IntersectionObserver((entradas) => {
    if (entradas.some((e) => e.isIntersecting)) mais();
  }, { rootMargin: '300px 0px' });
  sent.__obs = obs;
  lista.appendChild(sent);
  obs.observe(sent);
}

// ===== Acordeões: a animação de altura =====
// Um acordeão que troca `display` aparece PRONTO, e num toque a lista inteira
// abaixo dá um salto — o operador perde de vista onde estava. Animar a altura
// mostra de onde o conteúdo saiu, que é a única informação que o salto destrói.
//
// A altura é MEDIDA (`scrollHeight`) e animada até um `auto` final: um teto
// fixo em CSS cortaria a letra de um hino de 40 linhas ou deixaria um vão
// enorme depois de um refrão de duas.
const ACC_MS = 220;
const ACC_EASE = 'cubic-bezier(.22,.61,.36,1)';

// `prefers-reduced-motion` é a única razão para NÃO animar: quem pediu menos
// movimento no sistema pediu isso para o app inteiro.
function semMovimento() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function expandAccordion(el) {
  if (!el || !el.isConnected) return;
  if (semMovimento()) return;
  // `offsetHeight`, e não `scrollHeight`: a caixa da letra tem teto de altura e
  // rola por dentro — o conteúdo de um hino de 40 linhas passa MUITO do que ela
  // de fato ocupa, e animar até lá abriria um vão e depois recuaria.
  const alvo = el.offsetHeight;
  if (!alvo) return;
  el.style.overflow = 'hidden';
  const anim = el.animate(
    [{ height: '0px', opacity: 0 }, { height: alvo + 'px', opacity: 1 }],
    { duration: ACC_MS, easing: ACC_EASE },
  );
  // O `finally` do acordeão: sem devolver o `overflow`, a lista de músicas
  // ficaria presa à altura do instante em que a animação foi montada — e a
  // letra que uma linha abre depois seria cortada.
  const soltar = () => { el.style.overflow = ''; };
  anim.addEventListener('finish', soltar);
  anim.addEventListener('cancel', soltar);
}

// Fecha animando e SÓ ENTÃO executa `depois` (que costuma apagar o nó).
function collapseAccordion(el, depois) {
  if (!el || !el.isConnected || semMovimento()) { depois(); return; }
  const de = el.offsetHeight;
  if (!de) { depois(); return; }
  el.style.overflow = 'hidden';
  const anim = el.animate(
    [{ height: de + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
    { duration: ACC_MS, easing: ACC_EASE },
  );
  let feito = false;
  const fim = () => { if (feito) return; feito = true; el.style.overflow = ''; depois(); };
  anim.addEventListener('finish', fim);
  anim.addEventListener('cancel', fim);
}

// Quem redesenha o acervo depende de onde ele está na tela. `renderCollectionsList`
// recebe esse callback e o guarda aqui para os cards — eles são criados um a um
// e não têm como saber o alvo sozinhos.
let redesenharAcervo = () => {};

// "Baixar todo o acervo", no cabeçalho do popup: o mesmo `syncGroup` e a mesma
// chave de grupo (`grp:Toda a biblioteca`) da barra que existia na lista — só
// que FIXO no alto. Ali é a ação de maior alcance da tela; dentro da lista, ela
// saía de vista assim que o operador descia um pouco, que é justamente quando
// ele está decidindo se baixa tudo ou escolhe um álbum.
function renderAcervoTotal(redesenhar) {
  hymnSearchTotalEl.innerHTML = '';
  const todas = allCollections().filter((c) => !isHymnalAlbum(c));
  if (todas.length < 2) return;
  // O bloco contador+botão é o MESMO do cabeçalho de categoria
  // (`montarResumoGrupo`) — aqui ele pesa ainda mais: é o botão de maior
  // alcance da tela. A única diferença é o `redesenhar` após o clique.
  montarResumoGrupo(hymnSearchTotalEl, 'grp:Toda a biblioteca', 'Toda a biblioteca',
    todas, { confirmScale: true }, redesenhar);
}

// ===== Abrir o card de uma coleção =====
// Abre o card sem passar pelo alternador da barra: é o caminho do toque numa
// coleção SEM ÍNDICE (ali não há lista para folhear, e o que resolve isso —
// sincronizar — está nas opções, que hoje aparecem sozinhas com o card aberto).
function openCollectionOptions(coll) {
  const u = ui(coll.id);
  // Reconta o peso PELO DISCO (`opfsFolderSize`, v5.134 — não mais pelo
  // catálogo): uma coleção, ao abrir. Durante o uso ele é mantido
  // incrementalmente; os outros pontos de reconferência estão listados no
  // comentário de `updateCollBytes`.
  updateCollBytes(coll.id);
  allCollections().forEach((c) => { ui(c.id).expanded = false; });
  u.expanded = true;
  u.animarAbertura = true;
  redesenharAcervo();
}

// Preenche `alvo` com o painel de opções da coleção. Não abre nada: quem decide
// ONDE ele aparece é o card (`.coll-opts--inline`), e quem o mantém em dia é o
// redesenho do acervo, que o progresso da sincronização já dispara
// (`refreshCollectionsIfVisible`) — não há mais um popup com vida própria para
// sincronizar à parte.
function buildCollectionOptions(coll, collOptsEl) {
  const total = songsBaixaveis(coll.id).length;
  const downloaded = countDownloaded(coll.id);
  // UMA definição só, e ela conta VARIANTES (ver `levantarColecao`): a antiga
  // comparava músicas com `fileIdFull`, ignorando os Playbacks que o download
  // busca — e nunca ficava completa numa coleção com música sem áudio na
  // origem, deixando o botão de baixar para sempre na tela.
  const complete = colecaoCompleta(coll.id);
  const u = ui(coll.id);

  // A LINHA DE STATUS SAIU DAQUI (v5.73). Parada, ela repetia numa linha
  // inteira o que o chip abaixo já diz ("Completo offline", "Parcial", "Não
  // sincronizado"); em movimento, repetia PALAVRA POR PALAVRA o
  // "Baixando 2 de 4…" que a barra do card mostra dois centímetros acima — e a
  // barra é fixa no topo do aberto, então ela nunca sai de vista enquanto se
  // lê o painel.

  const stats = document.createElement('div'); stats.className = 'hymnal-card-stats';

  // UM chip para as duas informações (v5.73): quantas faixas estão no aparelho
  // e o que isso significa. Separadas, "4/4" e "Completo offline" eram a mesma
  // frase dita duas vezes — e a segunda ainda ocupava a largura toda.
  const sinc = document.createElement('div');
  sinc.className = 'hymnal-stat sinc' + (complete ? ' done' : '');
  const sLabel = document.createElement('label'); sLabel.textContent = 'Sincronizados';
  const sVal = document.createElement('b');
  if (complete) sVal.innerHTML = checkIconSvg();
  // O texto num <span> porque o <b> é flex (por causa do ✓): num contêiner
  // flex o texto solto vira item anônimo e o `text-overflow` do pai não o
  // alcança — o nome de um álbum longo cortaria a seco em vez de reticências.
  const sTxt = document.createElement('span');
  sTxt.textContent = (total ? downloaded + '/' + total : '—') + ' · '
    + (complete ? 'Completo offline' : (total > 0 ? 'Parcial' : 'Não sincronizado'));
  sVal.appendChild(sTxt);
  sinc.append(sLabel, sVal);
  stats.appendChild(sinc);

  // O peso à DIREITA: é o número curto e secundário da linha, e ancorá-lo na
  // borda oposta dá ao chip de sincronização toda a largura de que ele precisa.
  //
  // E ele diz as DUAS medidas (v5.93): o que está no aparelho e o que o álbum
  // inteiro vai ocupar. Só o primeiro número não responde a pergunta que se faz
  // antes de baixar — "quanto isto vai custar" —, e só o segundo esconde o que
  // já foi gasto. Completo, os dois seriam o mesmo número dito duas vezes,
  // então fica um só, sem o "~": ali a medida é exata.
  const m = medirColecao(coll.id);
  // Mesma definição de "completo" da barra do card (ver `fracaoPeso`): os dois
  // números estão a dois centímetros um do outro na mesma tela.
  const pesoTxt = (complete && m.noAparelho) ? fmtBytes(m.noAparelho)
    : !m.total ? '—'
      : m.noAparelho ? fmtParBytes(m.noAparelho, m.total)
        : '~' + fmtBytes(m.total);
  stats.appendChild(hymnalStat('Peso', pesoTxt, 'right'));
  collOptsEl.appendChild(stats);

  // OS DOIS BOTÕES DIVIDEM UMA LINHA (v5.95). Empilhados, eles ocupavam duas
  // faixas largas para duas ações curtas, e era esse tamanho que obrigava a
  // esconder tudo atrás de uma engrenagem. Lado a lado eles cabem sempre — e é
  // por isso que as opções não precisam mais ser reveladas por um botão.
  //
  // Os rótulos encurtaram junto, pelo mesmo motivo: "Baixar álbum" virou
  // "Baixar" e "Cancelar o download" virou "Cancelar" porque o card em volta JÁ
  // diz de que álbum se trata e a barra logo acima já mostra o progresso — a
  // palavra que sobrava era a que repetia o contexto, não a que informava.
  const acoes = document.createElement('div');
  acoes.className = 'coll-opts-acoes';

  // O MESMO botão dispara e cancela — o download de um álbum grande leva
  // dezenas de minutos, e sem um jeito de parar o operador ficava refém dele.
  const syncBtn = document.createElement('button');
  // `cancel`, não `busy`: `busy` gira o ícone, e um ✕ girando não se lê como
  // "toque para parar". Quem indica atividade é o status logo acima.
  syncBtn.className = 'new-folder-btn' + (u.syncBusy ? ' cancel' : '');
  syncBtn.innerHTML = u.syncBusy ? closeIconSvg() : syncIconSvg();
  // O rótulo diz o que ESTE toque vai fazer neste álbum (v5.73). "Atualizar e
  // baixar" era a mesma frase para os dois casos opostos: com o álbum inteiro
  // no aparelho não há o que baixar — só conferir se o catálogo mudou —, e com
  // ele vazio "atualizar" não descreve nada do que vai acontecer.
  syncBtn.appendChild(document.createTextNode(
    u.syncBusy ? 'Cancelar' : (complete ? 'Verificar atualizações' : 'Baixar'),
  ));
  syncBtn.addEventListener('click', () => syncCollection(coll));
  acoes.appendChild(syncBtn);

  if (downloaded > 0 || total > 0) {
    const rmBtn = document.createElement('button');
    rmBtn.className = 'new-folder-btn danger';
    rmBtn.appendChild(msym(ICON.del));
    // "Remover do dispositivo", e não "Excluir downloads do álbum": o que sai é
    // o que ocupa espaço NESTE aparelho, e o álbum continua no acervo para
    // baixar de novo quando quiser. "Excluir" prometia um dano maior do que o
    // que a ação faz.
    rmBtn.appendChild(document.createTextNode('Remover do dispositivo'));
    rmBtn.addEventListener('click', () => deleteCollection(coll));
    acoes.appendChild(rmBtn);
  }
  collOptsEl.appendChild(acoes);
}

// Monta um "chip" de estatística (rótulo em cima, valor embaixo).
function hymnalStat(label, value, extraClass) {
  const el = document.createElement('div');
  el.className = 'hymnal-stat' + (extraClass ? ' ' + extraClass : '');
  const l = document.createElement('label'); l.textContent = label;
  const v = document.createElement('b'); v.textContent = value;
  el.append(l, v);
  return el;
}

// Só re-renderiza os cards de coleção se a aba Álbuns estiver de fato visível —
// evita custo de DOM à toa enquanto o operador está em outra aba durante o download.
//
// COALESCIDO: o progresso da sincronização chama isto uma vez por música
// baixada (e uma vez por álbum indexado no auto-refresh). Sincronizar um
// hinário de 613 hinos com a aba aberta reconstruía a lista inteira 613 vezes
// — centenas de <li> com SVG inline cada. Como a informação é meramente
// informativa, um re-render a cada COLL_REFRESH_MS basta; a chamada final
// (fim do download, status limpo) chega pelo mesmo caminho e fecha o estado.
const COLL_REFRESH_MS = 400;
let collRefreshTimer = null;
function refreshCollectionsIfVisible() {
  if (collRefreshTimer) return;
  collRefreshTimer = setTimeout(() => {
    collRefreshTimer = null;
    renderCollectionsNow();
  }, COLL_REFRESH_MS);
}
function renderCollectionsNow() {
  // O acervo não tem mais aba própria (v5.44): quem o mostra é o estado padrão
  // da busca. Só redesenha se ele estiver de fato à vista — redesenhar por
  // baixo de uma lista de músicas tiraria do lugar o que o operador mira.
  if (hymnSearchPopupEl.classList.contains('open')
      && searchIsBrowsing(normalizeForSearch(hymnSearchInputEl.value).trim())) {
    renderSearchResults(hymnSearchInputEl.value);
  }
  // (O painel de opções vive DENTRO do card desde a v5.72, então ele é
  // redesenhado junto com o acervo — não há mais um popup a sincronizar à
  // parte.)
}

// A tela de FAVORITOS: uma seção de atalhos organizados, não um gerenciador de
// arquivos. Tecnicamente é o mesmo mecanismo de sempre (pastas virtuais em
// `folders`/`folder_<id>` + pastas do dispositivo sincronizadas no OPFS) — o
// que mudou é a leitura: aqui estão os caminhos curtos para o que o operador
// usa toda semana, e não "o lugar onde os arquivos moram".
//
// Duas origens, cada uma com seu cabeçalho, na ordem em que fazem sentido:
// os atalhos criados pelo operador primeiro (é o que ele marcou), as pastas
// do dispositivo depois (a origem bruta, que ele sincronizou uma vez).
function renderFolderList() {
  if (opfsFolders.length === 0 && folders.length === 0 && favItems.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.innerHTML = 'Nenhum favorito ainda.<br>Toque na estrela de qualquer item para marcá-lo aqui'
      + '<br>— ou crie uma pasta para agrupar o que você mais usa.';
    favListEl.appendChild(empty);
    appendNewFavoriteRow();
    renderStorageUsage();
    return;
  }
  // OS MARCADOS VÊM PRIMEIRO: é o que a estrela promete e o que o operador vem
  // buscar. Os atalhos são a organização de quem tem muita coisa, e as pastas
  // do dispositivo são a origem bruta — as duas descem.
  //
  // E vêm SEPARADOS POR TIPO (v5.104). Numa lista única, um versículo, um hino
  // e um pacote são três linhas de texto com ícones diferentes, e achar "aquela
  // mensagem" no meio de trinta favoritos vira leitura linha a linha. O tipo é
  // a primeira coisa que o operador sabe sobre o que procura ("era um vídeo"),
  // então é por ele que a lista se divide.
  FAV_GRUPOS.forEach((g) => {
    const doGrupo = favItems.filter((it) => favGrupo(it) === g.id);
    if (!doGrupo.length) return;
    appendFavSection(g.nome);
    doGrupo.forEach((item) => favListEl.appendChild(favItemRow(item)));
  });
  // "MINHAS PASTAS" × "PASTAS DO SISTEMA" (v5.112). Antes eram "Atalhos" e
  // "Pastas do dispositivo": "atalho" sugere um ponteiro para uma coisa que
  // mora em outro lugar, e não é isso que elas são — são PASTAS, agrupamentos
  // que o operador cria aqui e enche com o que já favoritou. As do sistema, ao
  // contrário, são exatamente um VÍNCULO: apontam para uma pasta do
  // armazenamento do aparelho e existem para ser re-sincronizadas (daí o
  // `folder_open` e o botão de setas circulares, que as separam das outras à
  // primeira vista). O par de títulos diz de quem é cada uma.
  if (folders.length) appendFavSection('Minhas pastas');
  renderVirtualFolders();
  if (opfsFolders.length) appendFavSection('Pastas do sistema');
  opfsFolders.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'lib-item folder-opfs';
    const row = document.createElement('div'); row.className = 'row';
    const icon = document.createElement('div'); icon.className = 'thumb thumb--icon';
    icon.appendChild(msym(ICON.import));
    const nameEl = document.createElement('span'); nameEl.className = 'row-name'; nameEl.textContent = f.name;
    const countEl = document.createElement('span'); countEl.className = 'folder-count'; countEl.textContent = String(f.count || 0);
    const syncBtn = document.createElement('button'); syncBtn.className = 'row-btn'; syncBtn.title = 'Re-sincronizar com a pasta do dispositivo';
    // Setas circulares, o MESMO desenho de "sincronizar" dos cards de coleção.
    // Antes era `ICON.import` (folder_open) — o mesmo glifo do ícone à esquerda,
    // que identifica a pasta: na mesma linha, o operador via o mesmo desenho
    // duas vezes, um como identidade e outro como ação (com a lixeira ao lado).
    syncBtn.innerHTML = syncIconSvg();
    syncBtn.addEventListener('click', (e) => { e.stopPropagation(); syncDeviceFolder(f); });
    const rmBtn = document.createElement('button'); rmBtn.className = 'row-btn'; rmBtn.title = 'Excluir pasta e arquivos sincronizados';
    rmBtn.appendChild(msym(ICON.del));
    rmBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteOpfsFolder(f); });
    row.append(icon, nameEl, countEl, syncBtn, rmBtn);
    li.appendChild(row);
    li.addEventListener('click', () => openOpfsFolder(f));
    favListEl.appendChild(li);
  });
  appendNewFavoriteRow();
  renderStorageUsage();
}

// Os grupos da gaveta, NA ORDEM em que aparecem. A ordem é fixa (não segue o
// que tem mais itens): uma lista que se reordena sozinha obriga a procurar de
// novo a cada abertura, e o que se quer aqui é memória muscular.
//
// Mídia primeiro, cenas de roteiro depois: o que se favorita mais é música e
// vídeo, e um culto normal não tem trinta versículos marcados.
const FAV_GRUPOS = [
  { id: 'audio', nome: 'Músicas e áudios' },
  { id: 'video', nome: 'Vídeos' },
  { id: 'youtube', nome: 'YouTube' },
  { id: 'image', nome: 'Imagens' },
  { id: 'deck', nome: 'Apresentações' },
  { id: 'verse', nome: 'Versículos' },
  { id: 'songlyrics', nome: 'Letras' },
  { id: 'message', nome: 'Mensagens' },
  { id: 'chrono', nome: 'Tempo' },
  { id: 'draw', nome: 'Sorteios' },
  { id: 'group', nome: 'Pacotes' },
  { id: 'other', nome: 'Outros' },
];

// A que grupo um favorito pertence. Uma CENA vale pelo subtipo dela (um
// versículo não é "outro"); o resto vale pelo `kind` da mídia. O que não se
// encaixar cai em "Outros" em vez de sumir — um favorito invisível seria pior
// que um mal classificado.
function favGrupo(item) {
  if (isCue(item)) return CUES[item.cue] ? item.cue : 'other';
  const k = item && item.kind;
  return FAV_GRUPOS.some((g) => g.id === k) ? k : 'other';
}

// Uma linha da seção "Favoritos" — o item em si, não um grupo. Tocar faz o
// MESMO que tocar nele no Cronograma (`onTap`: mídia toca, cena projeta), a
// estrela desmarca e o `+` manda para a lista do culto. São as três coisas que
// se quer de um favorito, sem entrar em pasta nenhuma.
function favItemRow(item) {
  const li = document.createElement('li');
  li.className = 'lib-item' + (item.id === currentId ? ' active' : '');
  li.dataset.id = item.id;
  const row = document.createElement('div'); row.className = 'row';
  // A MESMA coluna nome+subtítulo da biblioteca, e de propósito: uma segunda
  // anatomia de linha divergiria da primeira no próximo ajuste. Aqui o
  // subtítulo é ESCONDIDO por CSS (ver `#favList .row-sub`) — a gaveta agrupa
  // por tipo em seções, então o cabeçalho já diz o que a linha diria, e ela é a
  // lista que precisa ser compacta.
  const textWrap = document.createElement('div'); textWrap.className = 'row-text';
  const nome = document.createElement('span'); nome.className = 'row-name'; nome.textContent = item.name;
  const sub = document.createElement('span'); sub.className = 'row-sub';
  sub.textContent = subtituloItem(item);
  textWrap.append(nome, sub);
  const add = document.createElement('button');
  add.className = 'row-btn'; add.title = 'Adicionar ao Cronograma';
  add.appendChild(msym(ICON.cronoAdd));
  add.addEventListener('click', async (e) => {
    e.stopPropagation();
    await adicionarNaLista('imports', item.id, item.name, add);
  });
  const partes = [isCue(item) ? cueThumb(item) : thumbEl(item), textWrap];
  partes.push(favBtn(item.id, item.name), add);
  row.append(...partes);
  li.appendChild(row);
  // Os mesmos gestos da biblioteca: toque projeta/toca, toque longo entra na
  // seleção múltipla. Uma segunda regra de gesto só para esta lista seria a
  // mesma divergência que a gaveta inteira existe para evitar.
  attachRowGestures(row, item);
  return li;
}

// Cabeçalho de origem dentro dos Favoritos ("Favoritos" / "Atalhos" / "Pastas
// do dispositivo"): as três coisas vivem na mesma lista e se comportam igual ao
// toque, então sem um rótulo o operador não sabe qual é qual — e só uma delas
// pede sincronização.
function appendFavSection(title) {
  const li = document.createElement('li');
  li.className = 'fav-section';
  li.textContent = title;
  favListEl.appendChild(li);
}

// Atalhos: grupos criados pelo operador (pastas virtuais). Excluir um atalho
// não apaga mídia nenhuma — é só o caminho curto que some.
function renderVirtualFolders() {
  folders.forEach((folder) => {
    const count = folderCounts[folder.id] || 0;
    const li = document.createElement('li');
    li.className = 'lib-item';

    const row = document.createElement('div'); row.className = 'row';
    // PASTA, não estrela (v5.104): a estrela virou o marcador de favorito em
    // cada linha do app, e o mesmo símbolo não pode significar "isto está
    // marcado" e "isto é um grupo" na mesma gaveta.
    const icon = document.createElement('div'); icon.className = 'thumb thumb--icon';
    icon.appendChild(msym(ICON.folder));
    const nameEl = document.createElement('span'); nameEl.className = 'row-name'; nameEl.textContent = folder.name;
    const countEl = document.createElement('span'); countEl.className = 'folder-count'; countEl.textContent = String(count);
    const rmBtn = document.createElement('button'); rmBtn.className = 'row-btn'; rmBtn.title = 'Excluir pasta';
    rmBtn.appendChild(msym(ICON.del));
    rmBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteFolder(folder.id); });

    row.append(icon, nameEl, countEl, rmBtn);
    li.appendChild(row);
    li.addEventListener('click', () => openFolder(folder));
    favListEl.appendChild(li);
  });
}

// Criar um atalho vazio direto na tela de Favoritos. Antes só existia o
// caminho de trás para a frente (selecionar mídias → "salvar em pasta" → nova
// pasta): uma seção de atalhos que não deixa criar um atalho é justamente o
// que não se espera dela. Mesmo desenho do botão "Nova pasta" do seletor.
function appendNewFavoriteRow() {
  const li = document.createElement('li');
  li.className = 'import-row';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'import-btn';
  btn.appendChild(msym(ICON.folderNew));
  const txt = document.createElement('span');
  txt.textContent = 'Nova pasta';
  btn.appendChild(txt);
  btn.addEventListener('click', promptNewFavorite);
  li.appendChild(btn);
  favListEl.appendChild(li);
}

async function promptNewFavorite() {
  const name = await appPrompt({ title: 'Nova pasta', message: 'Nome da pasta:', okText: 'Criar', placeholder: 'Ex.: Louvores especiais' });
  if (name && name.trim()) await createFolder(name.trim());
}

// Rodapé com o uso de armazenamento do origin (OPFS + IDB). `alvo` porque esta
// linha vive em dois lugares: a tela de Favoritos e o acervo dentro da busca —
// e é lá que ela mais importa, já que quem ocupa o disco é o download de
// música. `valido` é a condição de que a tela ainda é a mesma quando o
// `estimate()` responde (ele é assíncrono; a aba pode ter mudado no meio).
function renderStorageUsage(alvo, valido) {
  // Sem `alvo`, é a linha do rodapé dos Favoritos — que hoje mora na gaveta. O
  // outro chamador (o acervo dentro da busca) passa o dele.
  alvo = alvo || favListEl;
  valido = valido || (() => activeTab === 'folders' && !currentFolder);
  if (!(navigator.storage && navigator.storage.estimate)) return;
  navigator.storage.estimate().then(({ usage, quota }) => {
    if (!valido()) return;
    // Remove uma linha anterior antes de anexar: sem isto, dois estimate()
    // pendentes (renderFolderList chamado em sequência) empilhariam duas
    // linhas de uso na mesma lista.
    const old = alvo.querySelector('.storage-usage');
    if (old) old.remove();
    const li = document.createElement('li');
    li.className = 'empty storage-usage';
    li.textContent = fmtBytes(usage || 0) + ' usados de ' + fmtBytes(quota || 0) + ' disponíveis';
    alvo.appendChild(li);
  }).catch(() => {});
}

// Vírgula decimal (v5.93): o app é em português e o número aparece ao lado de
// texto em português — "1.5 GB" lia como mil e quinhentos em pt-BR.
//
// Uma casa só até 10, nenhuma acima: "1,4 GB" é informação, "148,3 MB" é uma
// precisão que a medida não tem (a estimativa varia mais que essa casa) e que
// ainda faz o número balançar de largura a cada música baixada.
function fmtBytes(n) {
  const num = (v) => (v < 10 ? v.toFixed(1) : String(Math.round(v))).replace('.', ',');
  if (n >= 1073741824) return num(n / 1073741824) + ' GB';
  if (n >= 1048576) return num(n / 1048576) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

// "3,7 de ~18 MB" — a forma por extenso do chip de opções. O miolo (unidade
// repetida só quando necessário) é o mesmo da forma curta: `fmtBytesPar`.
function fmtParBytes(a, b) { return fmtBytesPar(a, b, ' de ~'); }

function renderSelbar() {
  hostSelbar();
  selbarEl.hidden = !selectionMode;
  // As ABAS NÃO SOMEM MAIS durante a seleção (v5.107): a barra passou a ocupar
  // o rodapé da lista, não a faixa de navegação. Quem cede o lugar é o
  // "Importar arquivos", e é `renderListFoot` (pela guarda de `selectionMode`)
  // que cuida disso.
  renderListFoot();
  if (!selectionMode) return;
  selCountEl.textContent = String(selected.size);
  selRenameEl.disabled = selected.size !== 1;
}

// ===== FAVORITOS: a marcação de UM TOQUE =====
//
// Até a v5.102 favoritar era "escolher (ou criar) um atalho e pôr o item nele":
// seis passos para o primeiro favorito, porque o modelo por baixo eram as
// antigas PASTAS VIRTUAIS com um nome novo. Agora existe o ato simples — a
// estrela da linha marca e desmarca na hora — e os atalhos continuam ali como
// ORGANIZAÇÃO OPCIONAL, para quem quiser agrupar.
//
// A lista mora no banco (`favs`) e é um detentor de referência como qualquer
// outra (ver LISTS em db.js): favoritar segura o blob, desfavoritar deixa o gc
// decidir. Nenhuma regra de coleta nova.
function isFav(id) { return favSet.has(id); }

async function toggleFav(id, nome, btn) {
  if (!id) return;
  // A estrela já muda de estado na hora — este aviso acrescenta O QUE foi
  // marcado. Numa lista de trinta linhas, a estrela que acendeu está no meio
  // da tela e o dedo a cobre no exato instante em que ela muda.
  const rotulo = nome ? '"' + (nome.length > 24 ? nome.slice(0, 24) + '…' : nome) + '"' : 'Item';
  if (favSet.has(id)) {
    favSet.delete(id);
    // `listRemove` (e não um setState cru) porque é ele que roda o gc na MESMA
    // transação: desfavoritar algo que não está em mais lista nenhuma tem de
    // liberar o espaço, não deixar um registro invisível para trás.
    await AVDB.listRemove('favs', id);
  } else {
    favSet.add(id);
    await AVDB.listAdd('favs', id);
  }
  const marcado = favSet.has(id);
  responder(btn, 'ok', rotulo + (marcado ? ' adicionado aos favoritos' : ' removido dos favoritos'));
  await recarregarFavoritos();
  // O BOTÃO SE ATUALIZA NO LUGAR (estrela cheia ↔ vazada) e a lista só é
  // remontada DEPOIS do pulso: `renderLibrary` recria as linhas, e recriar
  // agora arrancaria da tela justamente o botão que está confirmando.
  // O redesenho continua sendo necessário — a estrela do mesmo item aparece no
  // Cronograma, dentro de um atalho e na gaveta, e na gaveta a linha até some
  // ao ser desmarcada. (A playlist não tem estrela: ela é a fila do momento,
  // não uma coleção.)
  if (btn) {
    btn.classList.toggle('on', marcado);
    btn.title = marcado ? 'Remover dos favoritos' : 'Favoritar';
    btn.innerHTML = starSvg(marcado);
  }
  setTimeout(renderLibrary, PULSO_MS);
}

// Relê a lista e os registros. Chamado depois de qualquer mudança — é o único
// ponto que reconstrói `favSet`/`favItems`, para os dois nunca divergirem.
async function recarregarFavoritos() {
  const ids = await AVDB.listIds('favs');
  favSet = new Set(ids);
  favItems = await AVDB.listItems('favs');
}

// O botão de estrela de uma linha. `.on` = favoritado (a cor faz o estado, como
// no resto do app); o rótulo diz o que o toque FAZ.
// A estrela SÓLIDA quando marcada, contornada quando não — e por isso ela é
// SVG, não o glifo da fonte: `material-symbols.woff2` é um subset ESTÁTICO da
// família *Outlined*, sem o eixo `FILL` da fonte variável, então o glifo
// `star` desenha sempre a mesma estrela vazada. Cor sozinha carregava o estado,
// mas preenchido × vazado é a convenção universal de "favorito" — é o que se
// reconhece sem aprender, e some a dúvida de "esta estrela dourada quer dizer
// que está marcado ou que dá para marcar?".
const STAR_PATH = 'M12 3.4l2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 17.17l-5.4 2.84 1.03-6.01L3.27 9.75l6.03-.88z';

function starSvg(cheia) {
  return '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"'
    + (cheia
      ? ' fill="currentColor" stroke="none">'
      : ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">')
    + '<path d="' + STAR_PATH + '"/></svg>';
}

function favBtn(id, nome) {
  const b = document.createElement('button');
  const on = isFav(id);
  b.className = 'row-btn fav-btn' + (on ? ' on' : '');
  b.title = on ? 'Remover dos favoritos' : 'Favoritar';
  b.innerHTML = starSvg(on);
  b.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(id, nome, b); });
  return b;
}

// ===== ações de reprodução / sequência =====
async function send(id) {
  // UMA CENA DE ROTEIRO NÃO É MÍDIA: ela não pode virar um comando `load` (o
  // telão apagaria, porque um registro sem blob/url/pages cai no `clear` do
  // stage). A guarda fica AQUI, e não só no toque da lista, porque `send` é o
  // ponto por onde TODOS os caminhos passam — o avanço automático da playlist,
  // o ⏮/⏭ do transporte, a notificação nativa e o pacote logo acima.
  const alvo = [...plItems, ...libItems, ...favItems].find((m) => m.id === id)
    || (await AVDB.getMedia(id));
  if (isCue(alvo)) {
    currentItem = alvo;
    currentId = id;
    await persistCurrent();
    document.querySelectorAll('.lib-item,.row-item').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
    await playCue(alvo);
    return;
  }
  currentId = id;
  // O registro já foi resolvido acima (listas carregadas, com o IDB como
  // reserva) — a mídia AVULSA (v5.87 — "Tocar agora" num vídeo do YouTube) não
  // está em lista nenhuma, e sem essa leitura o `|| currentItem` deixava no ar
  // o nome do item ANTERIOR, que é pior que nome nenhum.
  currentItem = alvo || currentItem;
  // Independência áudio × texto: um ÁUDIO (música de fundo) NÃO encerra o texto
  // manual em cena (Bíblia/Mensagem/cronômetro); qualquer VISUAL (vídeo/imagem/
  // YouTube) encerra. Um louvor de fundo sob a contagem regressiva de abertura
  // é justamente o uso normal.
  if (!((bibleSession || msgSession || lyricSession || chronoSession || drawSession) && currentItem && currentItem.kind === 'audio')) clearManualText();
  await persistCurrent();
  ytEnded = false;
  displayStatusAt = 0; // até o Display confirmar o novo item, a preview dirige
  lastDisplayTime = 0;
  // A apresentação entra sempre pela PRIMEIRA página: quem manda o operador
  // para outra é o par de botões do transporte, e uma cena nova que começasse
  // no meio do deck anterior seria um slide aleatório no telão.
  deckPagina = 0;
  cmd({ type: 'load', mediaId: id, view, muted, volume, page: 0 });
  // A partir daqui há mídia no telão — é o que a reconexão precisa reenviar e o
  // que o ▶ pode retomar em vez de recarregar (ver `midiaNoAr`).
  midiaNoAr = true;
  // re-render leve de estados ativos
  document.querySelectorAll('.lib-item,.row-item').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
  renderNowPlaying();
  // E o EIXO DOS BOTÕES, que muda com o item (v5.101). Sem esta linha, trocar
  // de mídia deixava ⏮/⏭ com o estado da mídia ANTERIOR — e para uma
  // APRESENTAÇÃO isso é permanente: quem repunha os limites era o pulso de
  // `timeupdate` da preview, que só existe em áudio/vídeo. Um deck é imagem
  // parada, então nada mais rodava: o nome já dizia "1/9" (ele sai de
  // `renderNowPlaying`, que É chamado) e os botões continuavam apagados,
  // sem passar página. Parecia intermitente porque dependia do que estava em
  // cena ANTES — vindo de uma música com letra os botões já estavam acesos e
  // funcionavam; vindo de uma imagem, não. Só uma importação consertava, e por
  // acidente: ela termina em `load()`, que chama isto.
  renderSlideNav();
  if (currentItem && currentItem.kind === 'youtube') {
    // Zera a UI de transporte; o display-status remoto assume em seguida.
    seekEl.value = 0; seekEl.max = 0; seekEl.disabled = true;
    curTimeEl.textContent = '0:00'; durTimeEl.textContent = '0:00';
  }
}

function step(delta) {
  if (plItems.length === 0) return;
  const idx = plItems.findIndex((m) => m.id === currentId);
  const target = idx === -1 ? 0 : (idx + delta + plItems.length) % plItems.length;
  send(plItems[target].id);
}

// Navegação manual de estrofe (independente da posição do áudio): pula pro
// tempo do slide vizinho reaproveitando o comando `seek` já existente — o
// Display (e a própria preview) sincronizam a letra sozinhos ao reagir ao
// novo tempo, sem precisar de um comando novo no protocolo.
// Quem os botões de estrofe controlam AGORA: sempre o elemento que está NO AR,
// nunca o que apenas existe em memória.
//
// A distinção passou a importar quando o toque no versículo virou um toggle:
// uma sessão de leitura pode continuar aberta com a Escritura FORA do ar (o
// operador tirou do telão, mas segue navegando a seleção). Antes bastava a
// sessão existir para os botões pertencerem a ela — e o hino que voltava a
// aparecer ficava sem controle de estrofe. A ordem abaixo é a mesma da
// precedência visual: texto manual cobre a letra, e a letra volta a mandar
// assim que o texto sai.
// REGRA: tudo o que muda a resposta desta função precisa chamar
// `renderSlideNav()` — e não só `renderNowPlaying()`. As duas descrevem a MESMA
// cena (o nome e o eixo dos botões), e quem atualiza uma sozinha deixa a outra
// mentindo. O nome tem muito mais caminhos de atualização que o eixo, então a
// divergência aparece sempre do mesmo jeito: cabeçalho certo, botões errados.
//
// Foi assim o defeito da v5.100: projetar o cronômetro (ou o sorteio) sobre uma
// APRESENTAÇÃO derrubava o alvo para `null`, e ao tirá-lo o nome voltava a
// dizer "1/9" enquanto ⏮/⏭ continuavam apagados. Para uma apresentação isso era
// PERMANENTE, porque quem repunha os limites de tempos em tempos era o pulso de
// `timeupdate` da preview — e um deck é imagem parada. Só uma importação
// consertava, por acidente: ela termina em `load()`, que chama isto.
function slideTarget() {
  // O cronômetro não tem slides. Sem esta guarda, os botões de estrofe cairiam
  // na letra do áudio de fundo — que está ESCONDIDO atrás do cartão: o operador
  // apertaria "próxima estrofe" e a música saltaria, sem nada mudar na tela.
  if (chronoProjecting() || drawProjecting()) return null;
  if (lyricProjecting()) return 'songlyrics';
  if (msgSession && msgSession.projecting) return 'message';
  if (bibleSession && bibleSession.projecting) return 'bible';
  // A APRESENTAÇÃO é o alvo mais literal que este par de botões já teve: cada
  // toque passa uma página. Vem antes da letra porque um deck não tem letra —
  // são caminhos que nunca coexistem.
  if (isDeck(currentItem)) return 'deck';
  const lyrics = currentItem && Array.isArray(currentItem.lyrics) ? currentItem.lyrics : null;
  if (lyrics && lyrics.length) return 'lyrics';
  return null;
}

function stepSlide(delta) {
  const who = slideTarget();
  if (who === 'deck') { deckStep(delta); return; }
  if (who === 'songlyrics') { lyricStep(delta); return; }
  if (who === 'message') { msgStep(delta); return; }
  if (who === 'bible') { bibleStep(delta); return; }
  if (who !== 'lyrics') return;
  const lyrics = currentItem.lyrics;
  const idx = findSlideIndex(lyrics, authoritativeTime());
  const target = Math.min(Math.max(idx + delta, 0), lyrics.length - 1);
  if (target === idx) return;
  cmd({ type: 'seek', time: lyrics[target].time });
}

// Habilita/desabilita os botões de estrofe conforme o item atual tem letra
// sincronizada e a posição dentro dela (desabilita no primeiro/último slide).
function renderSlideNav() {
  // Mesmo pulso da navegação de estrofe: a leitura auxiliar (popup da letra /
  // do capítulo) e a zona de letra do modo simplificado acompanham o que está
  // no ar sem um timer próprio.
  refreshLyricsView();
  refreshSimpleLyrics();
  renderSimpleTime();
  const who = slideTarget(); // o que está NO AR — ver slideTarget()
  applySlideLimits(who);
  // O eixo do transporte é escrito DEPOIS dos limites: ele lê o `disabled` das
  // âncoras para dizer quando o toque curto não tem para onde ir.
  renderTransportAxis(who);
}

// Onde as âncoras de estrofe podem ir a partir daqui (é isso que `disabled`
// significa nelas). Saiu de dentro de `renderSlideNav` para o eixo do
// transporte poder ser desenhado depois — os `return` intermediários não
// deixavam.
function applySlideLimits(who) {
  // Letra avulsa: passa/volta entre as estrofes da música escolhida.
  if (who === 'songlyrics') {
    slidePrevBtnEl.disabled = lyricSession.idx <= 0;
    slideNextBtnEl.disabled = lyricSession.idx >= lyricSession.stanzas.length - 1;
    return;
  }
  // Mensagens: passa/volta entre as mensagens salvas (nos extremos desabilita).
  if (who === 'message') {
    slidePrevBtnEl.disabled = msgSession.idx <= 0;
    slideNextBtnEl.disabled = msgSession.idx >= messages.length - 1;
    return;
  }
  // Leitura bíblica: só desabilita no começo (Gn 1:1) e no fim (Ap, último
  // versículo) da Bíblia — nos limites de capítulo cruza para o vizinho.
  if (who === 'bible') {
    const s = bibleSession;
    const lastBook = Bible.BOOKS.length - 1;
    slidePrevBtnEl.disabled = (s.bookIdx === 0 && s.chapter === 1 && s.idx === 0);
    slideNextBtnEl.disabled = (s.bookIdx === lastBook
      && s.chapter === Bible.BOOKS[lastBook].chapters && s.idx === s.verses.length - 1);
    return;
  }
  if (who === 'deck') {
    slidePrevBtnEl.disabled = deckPagina <= 0;
    slideNextBtnEl.disabled = deckPagina >= currentItem.pages.length - 1;
    return;
  }
  if (who !== 'lyrics') {
    slidePrevBtnEl.disabled = true;
    slideNextBtnEl.disabled = true;
    return;
  }
  const lyrics = currentItem.lyrics;
  const idx = findSlideIndex(lyrics, authoritativeTime());
  slidePrevBtnEl.disabled = idx <= 0;
  slideNextBtnEl.disabled = idx >= lyrics.length - 1;
}

// Em que eixo ⏮/⏭ estão agora (ver "Um par de botões, dois eixos"). Na
// notificação nativa o rótulo do botão diz o modo; na tela não cabe rótulo,
// então dizem a COR (contorno em accent) e o `title`. Sem esse sinal o eixo só
// se descobriria depois de tocar — e descobrir errado, no meio de um louvor,
// custa a música inteira.
//
// E o botão precisa dizer também quando o toque curto NÃO tem para onde ir (a
// última estrofe do hino, a última mensagem). Antes isso era óbvio: o botão de
// estrofe ficava CINZA. Agora o mesmo botão ainda serve à mídia no toque longo,
// então ele não pode ser `disabled` — o que ele faz é esmaecer (`.axis-end`),
// que é a mesma leitura de "este caminho acabou" sem tirar o outro do ar.
//
// AS TRÊS TABELAS COBREM TODOS OS ALVOS DE `slideTarget()`, e isso não é
// zelo: elas são indexadas pelo alvo, e um alvo que falte não dá erro nenhum —
// vira `undefined` e o `title` do botão passa a dizer literalmente
// "undefined · segure para a próxima mídia". Faltavam justamente os dois mais
// novos, `deck` (v5.97) e `songlyrics` — e o da apresentação é o que mais
// aparece, porque ali ⏮/⏭ são o único jeito de passar página.
const SLIDE_AXIS_NAME = {
  lyrics: 'estrofe', songlyrics: 'estrofe', bible: 'versículo',
  message: 'mensagem', deck: 'página',
};
const SLIDE_AXIS_PREV = {
  lyrics: 'Estrofe anterior', songlyrics: 'Estrofe anterior', bible: 'Versículo anterior',
  message: 'Mensagem anterior', deck: 'Página anterior',
};
const SLIDE_AXIS_NEXT = {
  lyrics: 'Próxima estrofe', songlyrics: 'Próxima estrofe', bible: 'Próximo versículo',
  message: 'Próxima mensagem', deck: 'Próxima página',
};
function renderTransportAxis(who) {
  const par = [[prevEl, slidePrevBtnEl, SLIDE_AXIS_PREV[who], 'Mídia anterior', 'segure para a mídia anterior'],
    [nextEl, slideNextBtnEl, SLIDE_AXIS_NEXT[who], 'Próxima mídia', 'segure para a próxima mídia']];
  for (const [btn, ancora, rotulo, soMidia, dica] of par) {
    btn.classList.toggle('slide-mode', !!who);
    btn.classList.toggle('axis-end', !!who && ancora.disabled);
    btn.title = who
      ? rotulo + (ancora.disabled ? ' (fim) · ' : ' · ') + dica
      : soMidia;
  }
}

// ===== Leitura auxiliar: letra completa / capítulo inteiro =====
// O telão mostra UMA estrofe (ou UM versículo) por vez — é o formato certo
// para quem assiste, e o errado para quem opera: o operador precisa saber o
// que vem depois. Este popup é a íntegra do que está em cena, só para ler
// (com scroll); projetar continua sendo dos controles de estrofe/versículo.
//
// As duas fontes convivem: um louvor de fundo durante a leitura bíblica deixa
// letra E capítulo disponíveis ao mesmo tempo, e aí o seletor do topo escolhe.
// Sem essa disputa, a única fonte disponível abre direto, sem seletor.
let lvSource = null;      // escolha manual do operador ('lyrics' | 'bible' | null = automática)
let lvCurIdx = -1;        // índice destacado (estrofe/versículo no ar)
let lvFollow = true;      // acompanhar sozinho? Desliga ao primeiro scroll manual
let lvSig = '';           // assinatura do conteúdo já renderizado (ver lvSignature)

// Fontes disponíveis AGORA, na mesma ordem de precedência da tela.
function lyricsViewSources() {
  const list = [];
  const lyrics = currentItem && Array.isArray(currentItem.lyrics) ? currentItem.lyrics : null;
  if (lyrics && lyrics.length) list.push('lyrics');
  // A sessão de leitura basta (mesmo fora do ar): o capítulo está em cena para
  // o operador, que é justamente quem lê aqui.
  if (bibleSession && bibleSession.verses && bibleSession.verses.length) list.push('bible');
  return list;
}

// Qual fonte mostrar: a escolhida pelo operador enquanto continuar disponível;
// senão a primeira da lista (a letra, quando há as duas).
function lvActiveSource() {
  const avail = lyricsViewSources();
  if (lvSource && avail.includes(lvSource)) return lvSource;
  return avail[0] || null;
}

// Índice do que está no ar dentro da fonte ativa.
function lvCurrentIndex(src) {
  if (src === 'lyrics') return findSlideIndex(currentItem.lyrics, authoritativeTime());
  if (src === 'bible') return bibleSession.idx;
  return -1;
}

// Muda de conteúdo? Então re-renderiza; senão só move o destaque. Cobre trocar
// de música, de capítulo e a chegada/saída de uma das fontes.
//
// A lista de fontes DISPONÍVEIS entra na assinatura, não só a ativa: com um
// louvor tocando, começar a leitura bíblica não muda o conteúdo em cena (a
// letra continua na frente) mas passa a haver o que alternar — e sem isso o
// seletor do topo só apareceria na próxima troca de estrofe.
function lvSignature(src) {
  const avail = lyricsViewSources().join('+');
  if (src === 'lyrics') return avail + '|lyrics|' + currentId + '|' + currentItem.lyrics.length;
  if (src === 'bible') {
    const s = bibleSession;
    return avail + '|bible|' + s.versionId + '|' + s.bookIdx + '|' + s.chapter + '|' + s.verses.length;
  }
  return avail + '|none';
}

function openLyricsPopup() {
  lvFollow = true; // toda abertura começa acompanhando o que está no ar
  renderLyricsView();
  lyricsPopupEl.classList.add('open');
  // Depois de aberto (a folha ainda está subindo): o scroll só é possível com
  // o elemento já medido.
  requestAnimationFrame(() => lvScrollToCurrent(false));
}

function closeLyricsPopup() {
  lyricsPopupEl.classList.remove('open');
}

function renderLyricsView() {
  const avail = lyricsViewSources();
  const src = lvActiveSource();
  lvSig = lvSignature(src);
  lvCurIdx = src ? lvCurrentIndex(src) : -1;

  // Seletor só quando há de fato o que alternar.
  lyricsViewSegEl.hidden = avail.length < 2;
  lyricsViewSegEl.querySelectorAll('.fit-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lvsrc === src);
  });

  lyricsViewBodyEl.innerHTML = '';
  if (!src) {
    lyricsPopupTitleEl.textContent = 'Letra';
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nada em exibição com letra ou texto bíblico.';
    lyricsViewBodyEl.appendChild(empty);
    return;
  }
  if (src === 'lyrics') {
    const track = currentItem.hymnTrack ? currentItem.hymnTrack + '. ' : '';
    lyricsPopupTitleEl.textContent = track + (currentItem.hymnName || currentItem.name || 'Letra');
    lvBuildSong(lyricsViewBodyEl, lvCurIdx);
  } else {
    const b = bibleSession;
    // A sigla da versão só entra quando a lista de versões já foi baixada — sem
    // ela `bibleVersionAbbr` devolve o rótulo genérico "Versão", que no título
    // seria só ruído.
    const abbr = bibleVersionName(b.versionId) ? ' · ' + bibleVersionAbbr(b.versionId) : '';
    lyricsPopupTitleEl.textContent = b.bookName + ' ' + b.chapter + abbr;
    lvBuildBible(lyricsViewBodyEl, lvCurIdx);
  }
}

// Desenha as estrofes da música em cena dentro de `el`, destacando `cur`.
function lvBuildSong(el, cur) {
  const lyrics = currentItem.lyrics;
  lyrics.forEach((slide, i) => {
    // O slide de capa não tem letra (no telão é o título do hino). Vira uma
    // linha curta "Início": some do texto, mas continua sendo uma posição real
    // da música — é ela que fica destacada durante a introdução, e ocultá-la
    // faria o destaque sumir justo aí.
    const row = document.createElement('div');
    row.className = 'lv-row' + (slide.cover ? ' lv-row--cover' : '');
    row.dataset.i = String(i);
    if (slide.cover) {
      row.textContent = 'Início';
    } else {
      if (slide.auxText) {
        const aux = document.createElement('div');
        aux.className = 'lv-aux';
        aux.textContent = slide.auxText;
        row.appendChild(aux);
      }
      // A DIVISÃO DENTRO DO SLIDE (v5.142).
      //
      // Um slide da API pode trazer mais de uma estrofe, separadas por uma
      // LINHA EM BRANCO (`<br><br>` na origem, que o `normalizeLyricText`
      // converte em `\n\n`). O visualizador desenhava tudo num nó só com
      // `white-space: pre-line` — e é aí que a divisão se perdia: `pre-line`
      // COLAPSA sequências de espaço em branco, então `\n\n` vira UMA quebra
      // simples e as duas estrofes encostam uma na outra como se fossem um
      // bloco só. Era literalmente o relato: "alguns hinos não estão dividindo,
      // mesmo na realidade tendo divisões".
      //
      // Cada bloco vira um parágrafo próprio. A LINHA continua sendo UMA (o
      // mesmo `data-i`, o mesmo destaque, a mesma posição no tempo): o que se
      // divide é a apresentação do texto, não a unidade de projeção — dividir a
      // unidade quebraria o realce da estrofe em cena e o ⏮/⏭.
      String(slide.text || '')
        .split(/\n[ \t]*\n+/)
        .map((b) => b.trim())
        .filter(Boolean)
        .forEach((bloco) => {
          const txt = document.createElement('div');
          txt.className = 'lv-text';
          txt.textContent = bloco;
          row.appendChild(txt);
        });
    }
    if (i === cur) row.classList.add('current');
    el.appendChild(row);
  });
}

// Desenha o capítulo em leitura dentro de `el`, destacando `cur`.
function lvBuildBible(el, cur) {
  const s = bibleSession;
  s.verses.forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'lv-row lv-row--verse';
    row.dataset.i = String(i);
    const n = document.createElement('span');
    n.className = 'lv-num';
    n.textContent = String(v.n);
    const txt = document.createElement('span');
    txt.className = 'lv-text';
    txt.textContent = v.text;
    row.append(n, txt);
    if (i === cur) row.classList.add('current');
    el.appendChild(row);
  });
}

// Move o destaque dentro de um container já desenhado (sem re-render).
function lvMarkCurrent(el, idx) {
  const prev = el.querySelector('.lv-row.current');
  if (prev) prev.classList.remove('current');
  const row = el.querySelector('.lv-row[data-i="' + idx + '"]');
  if (row) row.classList.add('current');
}

// Chamado no mesmo pulso que a navegação de estrofe (renderSlideNav), que já
// roda a cada tick e a cada troca de versículo/mensagem. Com o popup fechado
// custa uma comparação de classe.
function refreshLyricsView() {
  if (!lyricsPopupEl.classList.contains('open')) return;
  const src = lvActiveSource();
  if (lvSignature(src) !== lvSig) { renderLyricsView(); lvScrollToCurrent(true); return; }
  if (!src) return;
  const idx = lvCurrentIndex(src);
  if (idx === lvCurIdx) return;
  lvCurIdx = idx;
  lvMarkCurrent(lyricsViewBodyEl, idx);
  lvScrollToCurrent(true);
}

// ===== Zona de letra do modo simplificado =====
// A mesma letra do popup de leitura auxiliar, embutida na tela: ali o espaço
// entre as ações e as teclas estava vazio, e é justamente o que o operador
// quer olhar enquanto a música toca. Só a MÚSICA (a Bíblia não existe neste
// modo), e também só leitura.
let lvSimpleSig = '';
let lvSimpleIdx = -1;
let lvSimpleFollow = true;

function refreshSimpleLyrics() {
  if (appMode !== 'simple') return;
  const has = !!(currentItem && Array.isArray(currentItem.lyrics) && currentItem.lyrics.length);
  const sig = has ? (currentId + '|' + currentItem.lyrics.length) : 'none';
  if (sig !== lvSimpleSig) {
    lvSimpleSig = sig;
    lvSimpleFollow = true;   // música nova: volta a acompanhar
    simpleLyricsEl.innerHTML = '';
    lvSimpleIdx = has ? findSlideIndex(currentItem.lyrics, authoritativeTime()) : -1;
    if (!has) {
      const empty = document.createElement('div');
      empty.className = 'lv-empty';
      empty.textContent = 'A letra da música aparece aqui.';
      simpleLyricsEl.appendChild(empty);
      return;
    }
    lvBuildSong(simpleLyricsEl, lvSimpleIdx);
    requestAnimationFrame(() => lvScroll(simpleLyricsEl, lvSimpleFollow, false));
    return;
  }
  if (!has) return;
  const idx = findSlideIndex(currentItem.lyrics, authoritativeTime());
  if (idx === lvSimpleIdx) return;
  lvSimpleIdx = idx;
  lvMarkCurrent(simpleLyricsEl, idx);
  lvScroll(simpleLyricsEl, lvSimpleFollow, true);
}

// Rolar com o dedo para de disputar o scroll, como no popup — até a próxima
// música (ou o próximo `sig`, que religa o acompanhamento).
simpleLyricsEl.addEventListener('pointerdown', () => { lvSimpleFollow = false; });
simpleLyricsEl.addEventListener('wheel', () => { lvSimpleFollow = false; }, { passive: true });

// Centraliza a linha no ar. `smooth` só na atualização ao vivo — na abertura o
// conteúdo precisa já nascer na posição certa, sem uma rolagem visível.
// Rola o PRÓPRIO corpo do popup (scrollTop), não scrollIntoView: este último
// mexeria também nos ancestrais, e a lista do app fica atrás da folha.
function lvScrollToCurrent(smooth) {
  lvScroll(lyricsViewBodyEl, lvFollow, smooth);
}

function lvScroll(el, follow, smooth) {
  if (!follow) return;
  const row = el.querySelector('.lv-row.current');
  if (!row) return;
  const top = row.offsetTop - (el.clientHeight - row.offsetHeight) / 2;
  el.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}

function resetAfterEnd() {
  // stage.js já voltou ao wallpaper internamente (ended flag);
  // apenas atualiza a UI sem limpar currentId (replay possível com play)
  //
  // E o telão está no wallpaper: o item continua SELECIONADO (é o que permite
  // repetir com o ▶), mas não está mais EM CENA. Sem esta linha, todo dongle
  // que caísse depois do fim de um louvor trazia a faixa de volta à TV — que é
  // o "ele tenta exibir a primeira tela/thumbnail" do relato.
  midiaNoAr = false;
  setPlaying(false);
  seekEl.value = 0;
  curTimeEl.textContent = '0:00';
  seekEl.disabled = false;
  durTimeEl.textContent = fmtTime(preview.getDuration());
}

function autoAdvance() {
  if (repeat === 'off') { resetAfterEnd(); return; }
  if (repeat === 'one') { if (currentId) send(currentId); return; }
  if (plItems.length === 0) return;
  if (repeat === 'shuffle') {
    if (plItems.length === 1) { send(plItems[0].id); return; }
    let i; do { i = Math.floor(Math.random() * plItems.length); } while (plItems[i].id === currentId);
    send(plItems[i].id);
    return;
  }
  // all
  const idx = plItems.findIndex((m) => m.id === currentId);
  const target = idx === -1 ? 0 : (idx + 1) % plItems.length;
  send(plItems[target].id);
}

async function cycleRepeat() {
  repeat = REPEATS[(REPEATS.indexOf(repeat) + 1) % REPEATS.length];
  await AVDB.setState('repeat', repeat);
  renderRepeat();
}

async function setView(v) {
  view = v; await persistCurrent();
  // Com a Camada de Texto em cena — Bíblia OU Mensagem, o mesmo cartão —,
  // 'view' só liga/desliga a cortina compartilhada (mesmo modelo do YouTube):
  // não passa por preview.handle, que recobriria na hora, já que o stage da
  // preview está sem `current` (a camada é paralela) e computeCover() daria
  // true. O Display já trata os dois provedores por `textActive`; checar só
  // `bibleSession` fazia a mensagem sumir da preview enquanto seguia no telão.
  if (pvTextActive) {
    AVDB.sendCommand({ type: 'view', view });
    // Cortina com fade (coverIn/coverOut respeitam a config de transições).
    if (v === 'wallpaper') preview.coverIn(false); else preview.coverOut();
    renderControls();
    return;
  }
  cmd({ type: 'view', view });
  renderControls();
}
async function toggleMute() {
  // Sem áudio no Display (bloqueio do navegador, não é mudo do operador):
  // o clique vira "liberar o som" — pede uma retentativa imediata.
  if (displayAudioBlocked && !muted) {
    AVDB.sendCommand({ type: 'audio-retry' });
    flash('Tentando liberar o áudio no Display…');
    return;
  }
  muted = !muted; await persistCurrent();
  cmd({ type: 'mute', muted });
  renderControls();
}

// Parar = limpar o display (volta ao wallpaper); mantém currentId para replay com play.
async function stopClear() {
  // Parar também é um comando do operador: arma a mesma janela de
  // `pausaPedida` que o ▶ arma, senão o `pause` que o 'clear' provoca no
  // <video> da preview entrava no diário como "PAUSA ESPONTÂNEA" — um falso
  // alarme no instrumento que existe para achar as pausas de verdade.
  pausaEm = Date.now();
  cmd({ type: 'clear' });
  clearManualText();
  // O TELÃO ESTÁ VAZIO A PARTIR DAQUI, e isso precisa ser dito ANTES do fade
  // terminar: quem pergunta a `preview.getCurrent()` recebe "ainda tem mídia"
  // durante todo o esmaecimento do `clearFaded` (ver `midiaNoAr`).
  midiaNoAr = false;
  setPlaying(false);
  // YouTube: 'clear' derruba o player da preview (dropYtPreview via cmd) e o do
  // Display → o próximo ▶ precisa recarregar (send), não só reenviar 'play'.
  if (currentItem && currentItem.kind === 'youtube') ytEnded = true;
  playPauseEl.querySelector('.msym').textContent = ICON.play;
  seekEl.value = 0; seekEl.disabled = true;
  curTimeEl.textContent = '0:00';
  await persistCurrent();
}



// ===== gestos da biblioteca =====
// **O deslize lateral da linha SAIU na v5.50.** Ele adicionava o item à
// playlist (`dx <= -SWIPE`), e a pista disso era um ícone a 22% de opacidade
// atrás da linha — um atalho que praticamente ninguém descobria e que, ainda
// assim, reservava para si o eixo horizontal da maior parte da tela. Era ele
// que impedia o carrossel de abas de funcionar onde o operador de fato desliza:
// sobre a lista. Trocar um atalho invisível por uma navegação que todo aparelho
// Android tem é a troca certa — e a playlist continua a UM toque, pelo botão
// `+` de cada resultado do acervo e pelo popup da playlist.
//
// O que fica: toque (troca a cena) e toque longo (entra na seleção múltipla).
// O movimento agora só CANCELA o gesto da linha, em qualquer direção: quem
// estiver deslizando está falando com o carrossel ou com a rolagem, não com o
// item.
const MOVE = 10, LONGPRESS = 450;

function attachRowGestures(row, item) {
  let startX = 0, startY = 0, startT = 0, longFired = false, lp = null, pid = null;

  row.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.row-handle') || e.target.closest('.row-btn')) return;
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; startT = Date.now(); longFired = false;
    lp = setTimeout(() => { longFired = true; enterSelection(item.id); }, LONGPRESS);
  });
  row.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    // Saiu do lugar? O toque deixou de ser um toque. `pid = null` encerra o
    // gesto DESTA linha sem tocar no evento — ele segue subindo para o
    // carrossel de abas e para a rolagem da lista, que são de quem o dedo está
    // falando agora.
    if (Math.abs(e.clientX - startX) > MOVE || Math.abs(e.clientY - startY) > MOVE) {
      clearTimeout(lp); pid = null;
    }
  });
  row.addEventListener('pointerup', (e) => {
    if (pid === null) return;
    clearTimeout(lp);
    if (!longFired && Date.now() - startT < LONGPRESS) onTap(item);
    pid = null;
  });
  row.addEventListener('pointercancel', () => { clearTimeout(lp); pid = null; });
}

// Trocar de música do zero: a playlist passa a ser SÓ este item.
//
// Junto vai o `repeat='one'`: repetir a mesma música é uma escolha sobre a
// música que estava tocando, não uma preferência permanente — mantê-la aqui
// prenderia o item novo em laço, que é o oposto de "escolhi outra coisa para
// tocar". `all`/`shuffle` ficam: são comportamentos da FILA, e continuam
// valendo quando o operador acrescentar itens a ela.
async function replacePlaylistWith(rec) {
  await AVDB.listSet('playlist', [rec.id]);
  plItems = [rec];
  renderPlaylist();
  if (repeat === 'one') {
    repeat = 'off';
    await AVDB.setState('repeat', repeat);
    renderRepeat();
  }
}

async function onTap(item) {
  if (selectionMode) { toggleSelect(item.id); return; }
  // Cena de roteiro: PROJETA, e não mexe na playlist. Um versículo não é uma
  // fila de reprodução — trocar a playlist por ele apagaria o bloco de louvores
  // que o operador acabou de montar, e o áudio de fundo (que a Camada de Texto
  // deixa tocando de propósito) morreria junto.
  if (isCue(item)) { await send(item.id); return; }
  // Toque direto na biblioteca: define a playlist como este item apenas.
  // ACRESCENTAR à fila (sem substituir) é outra coisa: o `+` dos resultados do
  // acervo (`addSongToPlaylist`) e, para itens da biblioteca, o botão de
  // playlist da barra de seleção (`addSelectedToPlaylist`) — que substituiu o
  // deslize à esquerda na v5.50.
  await replacePlaylistWith(item);
  send(item.id);
}

// Acrescenta os SELECIONADOS à playlist, sem substituir a fila. É o que o
// deslize à esquerda na linha fazia até a v5.50, agora num botão da barra de
// seleção: visível, e para vários itens de uma vez. Sem isto a única coisa que
// um item da biblioteca sabia fazer era SUBSTITUIR a fila (o toque simples) —
// montar uma sequência de culto dependeria de um gesto que a tela não anuncia.
// Favoritar o CONJUNTO. Marca todos quando há algum desmarcado (a intenção de
// quem selecionou cinco itens e toca na estrela é "quero estes cinco nos
// favoritos"); com todos já marcados, o mesmo toque desmarca — é o alternador
// de sempre, aplicado ao conjunto.
async function favoritarSelecionados() {
  const ids = [...selected];
  if (!ids.length) return;
  const marcar = ids.some((id) => !favSet.has(id));
  let mexidos = 0;
  for (const id of ids) {
    if (marcar === favSet.has(id)) continue;
    mexidos++;
    if (marcar) { favSet.add(id); await AVDB.listAdd('favs', id); }
    else { favSet.delete(id); await AVDB.listRemove('favs', id); }
  }
  const tipo = marcar ? tipoLote(mexidos, ids.length) : 'ok';
  responder(selFavEl, tipo, marcar
    ? textoLote(mexidos, ids.length, LISTA_ROTULO.favs)
    : (ids.length === 1 ? 'Removido dos favoritos' : mexidos + ' removidos dos favoritos'));
  await recarregarFavoritos();
  // A barra sai DEPOIS do pulso: `exitSelection` a esconde (`hidden`), e sair
  // na hora arrancaria da tela justamente o botão que está confirmando.
  sairDaSelecaoDepois();
}

// A SELEÇÃO SOBREVIVE AO DESTINO (v5.141).
//
// Até aqui um destino encerrava a seleção: mandar cinco louvores para a playlist
// E para os Favoritos exigia selecioná-los duas vezes, um por um, na mão. É o
// mesmo defeito que a folha de destinos tinha — "só um caminho por vez" —, com
// a diferença de que aqui não é preciso caixa de marcação nenhuma: os destinos
// já são três botões lado a lado, e o único que os separava era a barra sumindo
// no primeiro toque.
//
// A barra continua sendo fechada pelo ✕ (`#selCancel`), pelo botão voltar do
// aparelho e por desmarcar o último item — três saídas que já existiam. O que
// muda é ela não decidir sozinha que o operador terminou.
//
// O redesenho espera o pulso do botão pelo mesmo motivo de sempre: remontar a
// lista agora arrancaria da tela justamente o botão que está confirmando.
function sairDaSelecaoDepois() {
  setTimeout(() => { load(); }, PULSO_MS);
}

// A conta é do LOTE: "3 de 4 adicionados" diz, numa linha, que um deles já
// estava lá — com um aviso por item o operador veria quatro mensagens piscando
// e não leria nenhuma.
async function addSelectedToPlaylist() {
  if (!selected.size) return;
  const total = selected.size;
  // A forma ATÔMICA do `listSet` (a fn roda dentro da MESMA transação que
  // grava — a forma que o db.js manda preferir): o laço anterior pagava duas
  // transações por item (`listHas` + `listAdd`), e a contagem de novos sai da
  // própria fn, sobre a MESMA lista que foi gravada.
  let novos = 0;
  await AVDB.listSet('playlist', (atual) => {
    for (const id of selected) {
      if (atual.includes(id)) continue;
      atual.push(id); novos++;
    }
    return atual;
  });
  responder(selPlaylistEl, tipoLote(novos, total), textoLote(novos, total, LISTA_ROTULO.playlist));
  sairDaSelecaoDepois();
}

// O aviso de uma operação em lote (playlist, favoritos, atalho).
function tipoLote(novos, total) { return novos === total ? 'ok' : 'dup'; }

function textoLote(novos, total, onde) {
  if (novos === total) return total === 1 ? 'Adicionado ' + onde.para : total + ' itens adicionados ' + onde.para;
  if (novos === 0) return total === 1 ? 'Já está ' + onde.em : 'Todos já estavam ' + onde.em;
  return novos + ' de ' + total + ' adicionados ' + onde.para + ' — o resto já estava lá';
}

// ===== arrastar para reordenar =====
function attachHandle(handle, id, listName) {
  let pid = null, startY = 0, li = null, scrollHost = null;
  const onDragScroll = () => { if (li) measureDrag(li.parentElement, li); };
  const stopDrag = () => {
    if (scrollHost) scrollHost.removeEventListener('scroll', onDragScroll);
    scrollHost = null;
    endDrag();
  };
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    pid = e.pointerId; startY = e.clientY; li = handle.closest('li');
    li.classList.add('dragging');
    // Mede a lista aqui, uma vez — durante o arrasto não se lê mais layout.
    // A rolagem da lista é o único evento que invalida as medidas.
    measureDrag(li.parentElement, li);
    scrollHost = li.parentElement;
    scrollHost.addEventListener('scroll', onDragScroll, { passive: true });
    try { handle.setPointerCapture(pid); } catch (_) {}
  });
  handle.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    li.style.transform = `translateY(${e.clientY - startY}px)`;
    showDropLine(li.parentElement, li, e.clientY);
  });
  async function drop(e) {
    if (pid === null) return;
    const ul = li.parentElement;
    const target = dropIndex(ul, li, e.clientY);
    li.style.transform = ''; li.classList.remove('dragging');
    hideDropLine(ul);
    pid = null;
    stopDrag();
    await reorder(listName, id, target);
  }
  handle.addEventListener('pointerup', drop);
  handle.addEventListener('pointercancel', () => { if (li) { li.style.transform = ''; li.classList.remove('dragging'); hideDropLine(li.parentElement); } pid = null; stopDrag(); });
}

// Medidas dos itens, capturadas UMA vez no início do arrasto.
//
// Antes, cada `pointermove` (60–120 eventos por segundo) fazia um
// querySelectorAll da lista inteira e um getBoundingClientRect por item —
// logo depois de escrever `li.style.transform`, o que força um reflow
// SÍNCRONO a cada evento. Num Cronograma de 200 itens isso é o suficiente
// para o arrasto engasgar. As posições não mudam durante o arrasto (o item
// arrastado se move por transform, que não altera o layout), então basta
// medir no pointerdown e refazer se a lista rolar.
let dragGeom = null;
function measureDrag(ul, draggedLi) {
  const items = [];
  for (const el of ul.children) {
    if (el === draggedLi || el.tagName !== 'LI') continue;
    const r = el.getBoundingClientRect();
    items.push({ mid: r.top + r.height / 2, top: r.top, bottom: r.bottom });
  }
  dragGeom = { ul, items, ulTop: ul.getBoundingClientRect().top, scroll: ul.scrollTop };
}
function endDrag() { dragGeom = null; }

// Índice de destino a partir de uma coordenada Y — a MESMA conta usada pela
// linha-guia, para que o que o operador vê seja onde o item cai.
function dropIndex(ul, draggedLi, y) {
  if (!dragGeom || dragGeom.ul !== ul) measureDrag(ul, draggedLi);
  const items = dragGeom.items;
  for (let i = 0; i < items.length; i++) if (y < items[i].mid) return i;
  return items.length;
}

// linha-guia azul mostrando onde o item vai cair
function showDropLine(ul, draggedLi, y) {
  let line = ul.querySelector('.drop-line');
  if (!line) { line = document.createElement('div'); line.className = 'drop-line'; ul.appendChild(line); }
  if (!dragGeom || dragGeom.ul !== ul) measureDrag(ul, draggedLi);
  const { items, ulTop, scroll } = dragGeom;
  const idx = dropIndex(ul, draggedLi, y);
  let top;
  if (idx < items.length) top = items[idx].top - ulTop;
  else if (items.length) top = items[items.length - 1].bottom - ulTop;
  else top = 0;
  line.style.top = (top + scroll) + 'px';
}
function hideDropLine(ul) {
  const line = ul && ul.querySelector('.drop-line');
  if (line) line.remove();
}

async function reorder(listName, id, toIndex) {
  const ids = await AVDB.listIds(listName);
  const from = ids.indexOf(id);
  if (from === -1) return;
  ids.splice(from, 1);
  ids.splice(toIndex, 0, id);
  await AVDB.listSet(listName, ids);
  load();
}

// ===== seleção múltipla =====
function enterSelection(id) {
  selectionMode = true;
  selected.clear();
  selected.add(id);
  renderLibrary(); renderSelbar();
}
function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  if (selected.size === 0) exitSelection();
  else { renderLibrary(); renderSelbar(); }
}
function exitSelection() {
  selectionMode = false; selected.clear();
  renderLibrary(); renderSelbar();
}
async function deleteSelected() {
  // O ✓ "já está aqui" da busca do YouTube vive num Map em memória
  // (`ytEstado`) e nunca é recalculado enquanto a entrada existir — excluir a
  // mídia sem invalidá-lo deixava a busca prometendo, pela sessão inteira, um
  // download que não existe mais. A marca cai ANTES da remoção porque depois
  // do gc o registro pode já não existir para dizer QUAL era o vídeo; se ele
  // sobreviver em outra lista, `marcarYtProntos` remarca a partir do IDB.
  for (const id of selected) {
    const it = libItems.find((m) => m.id === id) || await AVDB.getMedia(id);
    if (it && it.youtubeId) setYtEstado(it.youtubeId, null);
  }
  if (activeTab === 'folders' && currentFolder && currentFolder._opfs) {
    // Pasta OPFS: apaga o arquivo físico e delega o registro + referências a
    // `purgeCatalogRecords` — a MESMA limpeza da exclusão de pasta/Hinário
    // (duas cópias da lista de detentores divergiriam no primeiro que alguém
    // esquecesse). Só o `opfsDeleteFile` é daqui: numa seleção avulsa não há
    // diretório inteiro a remover em bloco.
    const recs = [];
    for (const id of selected) {
      const rec = await AVDB.fileGet(id);
      if (rec && rec.opfsPath) await AVDB.opfsDeleteFile(rec.opfsPath);
      recs.push(rec || { id });
    }
    await purgeCatalogRecords(recs);
    await refreshOpfsFolderCount(currentFolder.id);
  } else if (activeTab === 'folders' && currentFolder) {
    // Pelo `listRemove`, que roda o gc na mesma transação — tirar do atalho o
    // último detentor de um blob tem de liberar o espaço. O `setState` cru que
    // havia aqui deixava o registro órfão e fora do alcance de qualquer faxina.
    for (const id of selected) await AVDB.listRemove('folder_' + currentFolder.id, id);
  } else if (activeTab === 'folders') {
    // RAIZ da gaveta: o que está selecionado ali são FAVORITOS, e excluir é
    // desmarcar. Sem esta linha o `else` de baixo caía em
    // `listRemove('folders', id)` — a chave do ÍNDICE de atalhos, que guarda
    // objetos e não ids: um no-op silencioso, com o operador vendo o item
    // continuar na lista depois de mandar excluí-lo.
    for (const id of selected) {
      favSet.delete(id); await AVDB.listRemove('favs', id); await soltarAvulso(id);
    }
    await recarregarFavoritos();
  } else {
    for (const id of selected) { await AVDB.listRemove(activeTab, id); await soltarAvulso(id); }
  }
  exitSelection(); load();
}

// A PRATELEIRA INVISÍVEL não sobrevive a uma exclusão explícita (v5.118).
//
// `avulsos` é a única lista que o operador NÃO vê: ela existe para "Tocar
// agora" não sujar o Cronograma e para não rebaixar o mesmo vídeo duas vezes no
// mesmo culto (ver `fixarAvulso`). Mas ela conta para o `isReferenced`, e o
// `deleteSelected` só removia da aba ATIVA — então excluir um vídeo do
// Cronograma deixava a prateleira segurando o registro: o blob ficava no
// aparelho, invisível em toda tela, e a lista de resultados do YouTube
// continuava marcando aquele vídeo como "já está aqui" sem que existisse um
// lugar onde removê-lo. Era o que o operador via, e ele tinha razão.
//
// A regra: excluir é uma DECLARAÇÃO DE INTENÇÃO, e ela vale para os detentores
// que o operador não pode enxergar. A prateleira é cache, não biblioteca.
//
// A ÚNICA exceção é o que está em cena agora. Ali a prateleira está fazendo
// exatamente o trabalho para o qual foi criada — segurar a mídia projetada que
// não pertence a lista nenhuma —, e soltá-la apagaria o blob de baixo de uma
// projeção em andamento: o vídeo continuaria tocando (o Display já tem os
// bytes), mas uma queda do dongle o traria de volta e o `getMedia` não acharia
// nada. Quando essa mídia sair de cena e outra ocupar seu lugar, o rodízio de
// `fixarAvulso` a solta sozinho.
//
// `listRemove` decide sozinho se o blob morre: se o Cronograma, a playlist ou um
// Favorito ainda o tiverem, ele fica inteiro. Esta função nunca apaga nada por
// conta própria — ela só deixa de esconder um detentor.
async function soltarAvulso(id) {
  if (!id || id === currentId) return;
  await AVDB.listRemove('avulsos', id);
}
async function renameSelected() {
  if (selected.size !== 1) return;
  const id = [...selected][0];
  const item = libItems.find((m) => m.id === id);
  const name = await appPrompt({ title: 'Renomear', message: 'Novo nome:', value: item ? item.name : '', okText: 'Renomear' });
  if (name && name.trim()) await AVDB.renameMedia(id, name.trim());
  exitSelection(); load();
}

// ===== pastas =====
async function loadFolderMediaItems(folderId) {
  // Pela API de listas (`listIds`), como todo o resto do arquivo — o
  // `getState` cru que havia aqui era o único acesso fora dela, e ainda
  // devolvia o array compartilhado sem cópia.
  const ids = await AVDB.listIds('folder_' + folderId);
  const items = await Promise.all(ids.map((id) => AVDB.getMedia(id)));
  return items.filter(Boolean);
}

function openFolder(folder) {
  rememberScroll();
  currentFolder = folder;
  load();
}

// ===== Favoritos: a gaveta do topo =====
// Abrir é entrar no `activeTab === 'folders'` de sempre — a diferença é só
// ONDE a lista é desenhada (ver `listHost`). Manter o activeTab é o que faz
// toda a navegação interna (abrir pasta, buscar, selecionar, excluir) continuar
// valendo sem uma segunda implementação.
// A aba que estava embaixo quando a gaveta abriu. Ela é aberta de QUALQUER aba
// desde a v5.103 (o botão do cabeçalho), então fechar tem de devolver o
// operador ao lugar de onde ele veio: quem abriu os favoritos no meio de uma
// leitura bíblica não espera cair no Cronograma ao fechá-los.
let favVoltarPara = 'imports';

function openFavorites() {
  if (activeTab !== 'folders') favVoltarPara = activeTab;
  favPopupEl.classList.add('open');
  switchTab('folders');
  hostSelbar();
}

// Fechar volta para o Cronograma, que é a tela que estava atrás. E volta para a
// RAIZ: uma gaveta reabre no topo — reaparecer dentro de um atalho que o
// operador fechou há dois toques seria uma memória que ninguém pediu (a
// posição de ROLAGEM, essa sim, continua guardada por `scrollPos`).
function closeFavorites() {
  favPopupEl.classList.remove('open');
  if (selectionMode) exitSelection();
  currentFolder = null;
  folderQuery = '';
  libSearchEl.value = '';
  hostSelbar();
  switchTab(favVoltarPara || 'imports', true);
}

// A barra de seleção múltipla vive no RODAPÉ DA LISTA, e some atrás da gaveta
// de Favoritos quando ela abre — selecionar itens dentro de uma pasta deixaria
// a barra invisível. Então ela MUDA de casa junto com a lista, pelo mesmo
// padrão que o `<input type="file">` já usa (ver renderListFoot): um nó só,
// movido, em vez de dois que divergem.
//
// A casa dela era a caixa de controles, no lugar da faixa de ABAS (v5.107 tirou
// de lá). As ações são da LISTA; trocar a navegação de lugar para mostrá-las
// mexe no que não é da seleção, e some com as abas justamente quando o operador
// pode querer sair da tela. No rodapé ela ocupa a fatia do "Importar arquivos",
// que é a única coisa da tela que a seleção múltipla de fato substitui.
function hostSelbar() {
  if (favPopupEl.classList.contains('open')) {
    if (selbarEl.parentElement !== favSheetEl) favSheetEl.appendChild(selbarEl);
    return;
  }
  if (selbarEl.parentElement !== listFootEl) listFootEl.appendChild(selbarEl);
}

function navigateBack() {
  if (activeTab === 'bible') {
    if (bibleScreen === 'reading') gotoBibleScreen('chapters');
    else if (bibleScreen === 'chapters') gotoBibleScreen('books');
    return;
  }
  // Na raiz dos Favoritos o voltar FECHA a gaveta (a tela de trás é o
  // Cronograma); dentro de um atalho/pasta, sobe um nível primeiro.
  if (activeTab === 'folders' && currentFolder === null) { closeFavorites(); return; }
  rememberScroll();
  // A seleção pertence à lista que está sendo deixada — mesmo motivo do
  // `exitSelection` que `switchTab` faz ao trocar de aba.
  if (selectionMode) exitSelection();
  currentFolder = null;
  folderQuery = '';
  libSearchEl.value = '';
  load();
}

async function createFolder(name) {
  const id = uid();
  folders.push({ id, name });
  await AVDB.setState('folders', folders);
  load();
}

// Excluir um atalho NÃO apaga mídia que tenha outro dono — mas o que ficar sem
// dono nenhum precisa ser coletado, e é isso que `folderDrop` faz numa
// transação só (índice + lista + gc).
//
// Antes eram dois `setState` crus, e isso VAZAVA em silêncio: uma mídia cujo
// último detentor era aquele atalho virava um registro que nenhuma lista aponta
// e que nenhum gc alcança (ele só roda dentro de `listRemove`). O blob ficava
// no IndexedDB para sempre — um vídeo grande "sumia" da tela e continuava
// ocupando o disco, sem tela nenhuma no app capaz de recuperá-lo.
async function deleteFolder(folderId) {
  const folder = folders.find((f) => f.id === folderId);
  if (!(await appConfirm({ title: 'Excluir pasta', message: 'Excluir a pasta "' + (folder ? folder.name : '') + '"? As mídias não são apagadas.', okText: 'Excluir' }))) return;
  await AVDB.folderDrop(folderId);
  if (currentFolder && currentFolder.id === folderId) currentFolder = null;
  load();
}

// `listSet(name, fn)`, e não um `setState` do array inteiro: a fn roda na
// MESMA transação de "state" que grava o resultado (a garantia das listas
// fixas). Com o array cru, um download que terminasse entre a leitura e
// a escrita perdia a própria entrada — o registro ficava criado e fora de
// qualquer lista, que é o vazamento que `addMediaToList` existe para impedir.
async function addToFolder(folderId, ids, btn) {
  const alvo = folders.find((f) => f.id === folderId);
  const nomePasta = '"' + ((alvo && alvo.name) || 'pasta') + '"';
  const onde = { em: 'em ' + nomePasta, para: 'a ' + nomePasta };
  // Mesma forma atômica de `addSelectedToPlaylist`: uma transação para o lote
  // inteiro, com os "novos" contados dentro da própria fn.
  let novos = 0;
  await AVDB.listSet('folder_' + folderId, (atual) => {
    for (const id of ids) {
      if (atual.includes(id)) continue;
      atual.push(id); novos++;
    }
    return atual;
  });
  responder(btn, tipoLote(novos, ids.length), textoLote(novos, ids.length, onde));
  // A folha do seletor fecha depois do pulso, pelo mesmo motivo da barra. A
  // SELEÇÃO fica (v5.141): os mesmos itens podem ir para uma segunda pasta, ou
  // para a playlist e os Favoritos, sem serem selecionados de novo.
  setTimeout(() => { closeFolderPicker(); load(); }, PULSO_MS);
}

// `ids` explícito = o alvo veio de fora da seleção múltipla (uma música do
// acervo). Sem ele, o seletor age sobre `selected`, como sempre.
let folderPickIds = null;

function openFolderPicker(ids) {
  folderPickIds = (ids && ids.length) ? ids : null;
  renderFolderPicker();
  folderPopupEl.classList.add('open');
}

function closeFolderPicker() {
  folderPickIds = null;
  folderPopupEl.classList.remove('open');
}

function renderFolderPicker() {
  folderPickerListEl.innerHTML = '';
  if (folders.length === 0) {
    folderPickerListEl.innerHTML = '<li class="empty">Nenhuma pasta ainda.<br>Crie uma abaixo.</li>';
    return;
  }
  const selectedIds = folderPickIds || [...selected];
  folders.forEach((folder) => {
    const li = document.createElement('li');
    const btn = document.createElement('button'); btn.className = 'folder-pick-btn';
    btn.append(msym(ICON.folder), Object.assign(document.createElement('span'), { textContent: folder.name }));
    btn.addEventListener('click', () => { addToFolder(folder.id, selectedIds, btn); });
    li.appendChild(btn);
    folderPickerListEl.appendChild(li);
  });
}


// ===== pastas sincronizadas (OPFS) =====
// A pasta do dispositivo é copiada para o Origin Private File System em uma
// única operação com permissão (showDirectoryPicker). Depois disso o acesso é
// permanente: nenhuma permissão é pedida para listar, buscar ou reproduzir —
// o catálogo (metadados + thumbnails) fica no IDB e os bytes no OPFS.

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

async function refreshOpfsFolderCount(folderId) {
  const f = opfsFolders.find((x) => x.id === folderId);
  if (!f) return;
  f.count = (await AVDB.filesByFolder(folderId)).length;
  await AVDB.setState('opfs-folders', opfsFolders);
}

// Abre uma pasta do dispositivo e devolve uma FONTE uniforme, para que o
// corpo da sincronização (abaixo) seja um só nos dois contextos:
//
//   { name, uri?, handle?, entries: [{ name, stat(), read() }] }
//
// - No NAVEGADOR: File System Access API (showDirectoryPicker + handles).
// - No APP NATIVO: Storage Access Framework via AVNative.pickFolder/listFolder.
//   A File System Access API **não existe no Android** — era por isso que a
//   sincronização de pastas, no PWA, sempre caía no aviso "navegador não
//   suporta seleção de pastas" em qualquer celular. Aqui ela funciona.
//
// `stat()` devolve { size, mtime } SEM ler os bytes: é o que permite pular
// arquivos inalterados de graça (no SAF os metadados já vêm na listagem; no
// navegador o File é obtido uma vez e reaproveitado por `read()`).
async function openFolderSource(existing) {
  if (window.__NATIVE__) {
    let picked = existing && existing.uri ? { uri: existing.uri, name: existing.name } : null;
    let list = picked ? await AVNative.listFolder(picked.uri) : null;
    // Sem URI salvo, ou permissão revogada / pasta movida (listagem vazia
    // onde antes havia arquivos): pede a pasta de novo.
    if (!picked || (list.length === 0 && existing && existing.count > 0)) {
      picked = await AVNative.pickFolder();
      if (!picked) return null; // operador cancelou
      list = await AVNative.listFolder(picked.uri);
    }
    return {
      name: picked.name,
      uri: picked.uri,
      entries: list.map((f) => ({
        name: f.name,
        stat: async () => ({ size: f.size, mtime: f.mtime }),
        read: async () => {
          // A ponte entrega URL servível, não bytes: isto é um fetch local
          // em streaming, o mesmo padrão já usado com o OPFS.
          const res = await fetch(f.url);
          if (!res.ok) throw new Error('leitura falhou');
          return await res.blob();
        },
      })),
    };
  }

  // `avisar`, não `flash` (no-op): sem o aviso, um navegador sem a API
  // simplesmente não responderia ao toque — falha muda.
  if (!('showDirectoryPicker' in window)) { avisar('Navegador não suporta seleção de pastas', 'erro'); return null; }

  // Re-sync: tenta reutilizar o handle salvo (browsers que persistem a
  // permissão nem mostram prompt); senão cai no picker.
  let handle = existing && existing.handle;
  if (handle) {
    try {
      let perm = await handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') handle = null;
    } catch (_) { handle = null; }
  }
  if (!handle) {
    try { handle = await window.showDirectoryPicker({ mode: 'read' }); }
    catch (_) { return null; } // usuário cancelou
  }

  const entries = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== 'file') continue;
    let cached = null;
    const file = async () => (cached || (cached = await entry.getFile()));
    entries.push({
      name,
      stat: async () => { const f = await file(); return { size: f.size, mtime: f.lastModified }; },
      read: file,
    });
  }
  return { name: handle.name, handle, entries };
}

// Sincroniza (ou re-sincroniza) uma pasta do dispositivo para o OPFS.
// `existing` = registro de opfsFolders para re-sync; undefined para nova pasta.
async function syncDeviceFolder(existing) {
  if (!AVDB.opfsSupported()) { avisar('Navegador não suporta armazenamento OPFS', 'erro'); return; }
  if (syncBusy) { avisar('Sincronização em andamento…', 'dup'); return; }

  const source = await openFolderSource(existing);
  if (!source) return;

  syncBusy = true;
  // Copiar uma pasta inteira do dispositivo para o OPFS é longo (vídeos
  // grandes); mesma proteção contra o congelamento ao minimizar.
  bgWorkBegin();
  let folderNotifId = 0; // fora do try: o finally precisa encerrar a tarefa
  try {
    // Pede armazenamento persistente para o browser não descartar os arquivos.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    let folder = existing || opfsFolders.find((f) => f.name === source.name);
    if (!folder) {
      folder = { id: uid(), name: source.name, count: 0, syncedAt: 0 };
      opfsFolders.push(folder);
    }
    // `handle` (web) e `uri` (nativo) cumprem o mesmo papel: acelerar o
    // re-sync sem pedir a pasta de novo.
    if (source.handle) folder.handle = source.handle;
    if (source.uri) folder.uri = source.uri;

    const existingRecs = await AVDB.filesByFolder(folder.id);
    const bySrcName = new Map(existingRecs.map((r) => [r.srcName, r]));

    const entries = [];
    for (const entry of source.entries) {
      const type = guessMediaType(entry.name);
      if (AVDB.kindFromType(type) === 'other') continue;
      entries.push([entry, type]);
    }

    let done = 0, added = 0;
    folderNotifId = bgTaskStart('Pasta · ' + folder.name, entries.length);
    for (const [entry, type] of entries) {
      done++;
      // Cada chamada reinicia o timer do aviso, então a faixa fica em cena
      // durante a cópia inteira, contando — é o progresso na própria tela
      // (a notificação só aparece com o app minimizado).
      avisar('Sincronizando ' + done + '/' + entries.length + '…');
      bgTaskStep(folderNotifId, done);
      const name = entry.name;
      bgItemOnly(folderNotifId, name);
      let st;
      try { st = await entry.stat(); } catch (_) { continue; }
      const prev = bySrcName.get(name);
      // Já sincronizado e inalterado (mesmo tamanho e data) → pula.
      if (prev && prev.size === st.size && prev.mtime === st.mtime) continue;
      let file;
      try { file = await entry.read(); } catch (_) { continue; }
      const kind = AVDB.kindFromType(type);
      const path = 'folders/' + folder.id + '/' + name;
      try { await AVDB.opfsWriteFile(path, file); } catch (_) { continue; }
      const thumb = await makeThumb(file, kind);
      await AVDB.fileAdd({
        id: prev ? prev.id : uid(),
        folder: folder.id,
        opfsPath: path,
        srcName: name,
        name: name.replace(/\.[^.]+$/, ''),
        type, kind,
        size: st.size,
        mtime: st.mtime,
        thumb,
        blob: null, url: null,
        addedAt: prev ? prev.addedAt : Date.now(),
      });
      added++;
    }

    folder.count = (await AVDB.filesByFolder(folder.id)).length;
    folder.syncedAt = Date.now();
    await AVDB.setState('opfs-folders', opfsFolders);
    // O desfecho é o que a faixa existe para dizer: "já em dia" é a resposta
    // que evita re-sincronizar à toa, e ela precisa se distinguir de "entrou".
    if (added > 0) avisar(added + ' arquivo(s) sincronizado(s)');
    else avisar('Pasta já em dia', 'dup');
  } catch (_) {
    avisar('Erro na sincronização', 'erro');
  } finally {
    syncBusy = false;
    bgTaskEnd(folderNotifId);
    bgWorkEnd();
  }
  load();
}

function openOpfsFolder(f) {
  rememberScroll();
  currentFolder = { id: f.id, name: f.name, _opfs: true };
  folderQuery = '';
  libSearchEl.value = '';
  load();
}

// Remove uma leva de registros do catálogo OPFS (store "files") e limpa as
// referências que tenham sobrado nas listas. Usado ao excluir uma pasta OPFS
// ou o Hinário inteiro — os bytes já são apagados em bloco por opfsDeleteDir,
// então aqui não é preciso opfsDeleteFile por registro.
async function purgeCatalogRecords(recs) {
  for (const r of recs) {
    await AVDB.fileDelete(r.id);
    // `favs` entra junto: um arquivo de pasta favoritado e depois excluído
    // deixaria uma estrela apontando para um registro que não existe mais — a
    // linha some da gaveta pelo `filter(Boolean)` do `listItems`, mas o id fica
    // na lista, contando como favorito para sempre.
    for (const l of ['imports', 'playlist', 'avulsos', 'favs']) await AVDB.listRemove(l, r.id);
  }
}

async function deleteOpfsFolder(f) {
  if (!(await appConfirm({ title: 'Excluir pasta', message: 'Excluir a pasta "' + f.name + '" e todos os arquivos sincronizados?', okText: 'Excluir' }))) return;
  const recs = await AVDB.filesByFolder(f.id);
  await purgeCatalogRecords(recs);
  await AVDB.opfsDeleteDir('folders/' + f.id);
  opfsFolders = opfsFolders.filter((x) => x.id !== f.id);
  await AVDB.setState('opfs-folders', opfsFolders);
  if (currentFolder && currentFolder.id === f.id) currentFolder = null;
  load();
}

// Fonte única extensão→MIME. Usada por guessMediaType (arquivos OPFS) e, via
// AVDB.kindFromType, por detectUrlKind (URLs) — antes as duas mantinham listas
// de extensões separadas que podiam divergir.
const MEDIA_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/mp4',
  m4v: 'video/mp4', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
  flac: 'audio/flac', m4a: 'audio/mp4', opus: 'audio/opus',
  // A apresentação entra como PDF e vira IMAGENS no aparelho (ver
  // `deckImportar`). Os formatos de origem — .pptx, .odp — ficam de fora de
  // propósito: não existe no Android quem os desenhe, e aceitar o arquivo para
  // depois não conseguir projetá-lo é pior do que dizer na hora o que fazer.
  pdf: 'application/pdf',
};
function guessMediaType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return MEDIA_MIME[ext] || 'application/octet-stream';
}

// ===== Coleções de mídia (LouvorJA) — sincronização e download =====
// Carrega em memória o estado de todas as coleções (índices por coll.id) + o
// catálogo de álbuns, aplicando a migração do estado legado 'hymnal2022' →
// 'coll:hymnal-2022' (mesma pasta OPFS 'hymnal-2022', então os downloads já
// feitos continuam válidos). Chamado uma vez no init, antes do primeiro load().
async function loadCollections() {
  const legacy = await AVDB.getState('hymnal2022');
  const has2022 = await AVDB.getState('coll:' + HYMNAL_2022_ID);
  if (legacy && !has2022) await AVDB.setState('coll:' + HYMNAL_2022_ID, legacy);

  // Migração: até a v4.90 o catálogo era um ARRAY achatado [{id_album,name}].
  // Um array antigo é aceito como o índice de álbuns, sem categorias — a
  // próxima `fetchAlbumCatalog` (roda ao abrir o app) traz a hierarquia.
  const savedCatalog = await AVDB.getState('albumCatalog');
  albumCatalog = Array.isArray(savedCatalog)
    ? { categories: [], albums: savedCatalog }
    : (savedCatalog && Array.isArray(savedCatalog.albums) ? savedCatalog : { categories: [], albums: [] });
  const cols = allCollections();
  const states = await Promise.all(cols.map((c) => AVDB.getState('coll:' + c.id)));
  collState = {};
  cols.forEach((c, i) => { collState[c.id] = states[i] || { indexSyncedAt: 0, songs: [] }; });
  await carregarPesos();
  await loadLyricStore();
}

// Descobre os álbuns disponíveis no banco (pt_categories) e persiste a
// hierarquia categoria → álbum (com subtítulo, cor e ordem) — alimenta os
// cards de álbum da aba Álbuns (um por álbum), visíveis offline. Álbuns cujo
// nome parece de hinário são pulados: já têm card dedicado (evita duplicar).
// Lança em falha (sem rede/resposta inválida).
async function fetchAlbumCatalog() {
  const cats = await Louvorja.fetchList(Louvorja.CATEGORIES_FILE);
  if (!Array.isArray(cats)) throw new Error('Resposta inválida (categorias)');
  const seen = new Map();
  const categories = [];
  for (const cat of cats) {
    if (!cat || cat.id_category == null) continue;
    const catAlbums = [];
    for (const a of (Array.isArray(cat.albums) ? cat.albums : [])) {
      if (!a || a.id_album == null) continue;
      const name = a.name || ('Álbum ' + a.id_album);
      // subtitle/order vêm do PIVÔ (variam por categoria) — ficam na entrada
      // da categoria; name/color são do álbum e vão pro índice deduplicado.
      catAlbums.push({
        id_album: a.id_album,
        subtitle: a.subtitle || '',
        order: Number(a.order) || 0,
      });
      if (!seen.has(a.id_album)) seen.set(a.id_album, { id_album: a.id_album, name, color: a.color || null });
    }
    catAlbums.sort((x, y) => x.order - y.order);
    categories.push({
      id_category: cat.id_category,
      name: cat.name || 'Sem categoria',
      order: Number(cat.order) || 0,
      albums: catAlbums,
    });
  }
  categories.sort((x, y) => x.order - y.order);
  albumCatalog = { categories, albums: Array.from(seen.values()) };
  await AVDB.setState('albumCatalog', albumCatalog);
  // Garante entrada em collState pros álbuns novos (índice vazio até sincronizar).
  for (const coll of allCollections()) {
    if (!collState[coll.id]) collState[coll.id] = { indexSyncedAt: 0, songs: [] };
  }
  refreshCollectionsIfVisible();
}

// Busca o índice (metadados leves) de UMA coleção e atualiza collState[coll.id],
// preservando fileIdFull/fileIdPlayback já conhecidos de cada música. Para
// hinários, o arquivo de lista (coll.source) já é o índice; para álbuns, o
// índice vem de album_{id}.musics. Lança em caso de falha (sem rede/resposta
// inválida); quem chama decide se avisa o operador ou ignora silenciosamente.
async function fetchCollectionIndex(coll) {
  const raw = await Louvorja.fetchList(coll.source);
  const list = coll.kind === 'album'
    ? (raw && Array.isArray(raw.musics) ? raw.musics : null)
    : (Array.isArray(raw) ? raw : null);
  if (!list) throw new Error('Resposta inválida do servidor (' + coll.source + ')');

  // Um "álbum" cujo registro traz uma categoria começando com `hymnal.` é, na
  // verdade, um hinário — o app-ja redireciona a abertura dele para o módulo
  // do hinário em vez de listar faixas (ver docs/FONTE-DE-DADOS-LOUVORJA.md
  // §5.2). Aqui os dois hinários já têm card fixo, então marcamos para não
  // mostrar um card duplicado. É o critério AUTORITATIVO; até o índice do
  // álbum chegar, `isHymnalAlbum()` se vira com o nome.
  const isHymnal = coll.kind === 'album' && raw && Array.isArray(raw.categories)
    && raw.categories.some((c) => String(c).startsWith('hymnal.'));

  const byId = new Map(collSongs(coll.id).map((s) => [s.id_music, s]));
  // MUTAÇÃO IN-PLACE, não objetos novos: `syncCollection` tira um snapshot do
  // array e grava `fileIdFull`/`fileIdPlayback` nos objetos DELE conforme baixa.
  // Esta atualização de índice roda a cada retomada do app — ou seja, no meio
  // de uma sincronização em massa, que é justamente quando o operador minimiza.
  // Recriar os objetos deixava o snapshot apontando para órfãos: os bytes iam
  // pro OPFS, mas os ids eram descartados no `setState` seguinte e a música
  // aparecia como não baixada (e era rebaixada). Reaproveitar o objeto também
  // preserva de graça qualquer campo extra (ex.: `_norm` da busca).
  let colheu = false;   // o índice trouxe letra de graça? (ver abaixo)
  const songs = list.map((row) => {
    const s = byId.get(row.id_music)
      || { id_music: row.id_music, fileIdFull: null, fileIdPlayback: null };
    s.track = row.track;
    s.name = row.name;
    s.duration = row.duration;
    // A API PODE mandar a letra já no índice (o app-ja busca por esse campo —
    // ver docs/FONTE-DE-DADOS-LOUVORJA.md §5.3). Quando manda, é de graça:
    // aproveitamos e a música nem entra na fila de download de letras.
    if (row.lyric) {
      const est = typeof row.lyric === 'string'
        ? [{ a: null, l: normalizeLyricText(row.lyric).split('\n').map((x) => x.trim()).filter(Boolean) }]
        : lyricStanzasFromMeta(row);
      if (est && est.length) { lyricStoreFor(coll.id)[row.id_music] = est; colheu = true; }
    }
    s.has_instrumental_music = !!row.has_instrumental_music;
    s._norm = normalizeForSearch(row.name);
    return s;
  });
  collState[coll.id] = { indexSyncedAt: Date.now(), songs, isHymnal };
  await AVDB.setState('coll:' + coll.id, collState[coll.id]);
  // Só grava se houve colheita: um `setState` do acervo de letras a cada
  // atualização de índice reescreveria megabytes por nada.
  if (colheu) { await saveLyricStore(coll.id); invalidateLyricIndex(); }
  refreshCollectionsIfVisible();
  // Popup de busca aberto durante a atualização: re-renderiza pra refletir a
  // lista nova na hora (sem esperar o operador reabrir o popup).
  if (hymnSearchPopupEl.classList.contains('open')) renderSearchResults(hymnSearchInputEl.value);
}


// Executa `fn` sobre `items` com concorrência limitada (no máximo `limit` em
// voo ao mesmo tempo). Usado pra buscar o índice de dezenas de álbuns sem
// disparar todas as requisições de uma vez.
async function runLimited(items, limit, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Índices de álbum são considerados "frescos" por este tempo — dentro dele,
// uma retomada do app não refaz a requisição (evita N requisições a cada
// visibilitychange). Álbuns novos ou ainda sem índice são sempre buscados.
const ALBUM_INDEX_TTL = 12 * 60 * 60 * 1000; // 12 h

// Atualização automática e silenciosa — ao abrir o app e ao retomar do 2º
// plano (ver o handler de visibilitychange no fim do arquivo), sem aviso de erro:
//  1. índices leves dos HINÁRIOS (fixos) + catálogo de ÁLBUNS (nomes dos cards);
//  2. índice leve (só metadados — album_{id}.musics, SEM áudio) de CADA álbum,
//     pra a busca do acervo cobrir TODAS as músicas de TODOS os álbuns mesmo
//     sem nada baixado (tocar num resultado baixa sob demanda — igual ao
//     hinário). Concorrência limitada + TTL (pula álbuns indexados há pouco,
//     mas sempre busca os novos/vazios). Uma falha (ex: sem rede) só mantém o
//     que já está em cache.
let collectionsRefreshing = false;
async function autoRefreshCollections() {
  if (collectionsRefreshing) return;
  collectionsRefreshing = true;
  try {
    // Coleção sincronizando agora não é atualizada por aqui: o download em
    // massa está escrevendo nos objetos desta lista, e mesmo com a mutação
    // in-place do `fetchCollectionIndex` não há por que competir pelo
    // `setState` da mesma chave no meio do trabalho pesado.
    const idle = (c) => !ui(c.id).syncBusy;
    // Fase 1: hinários + catálogo de álbuns (barato).
    await Promise.all([
      ...FIXED_COLLECTIONS.filter(idle).map((c) => fetchCollectionIndex(c).catch(() => {})),
      fetchAlbumCatalog().catch(() => {}),
    ]);
    // Fase 2: índice de cada álbum (só os que estão vazios ou vencidos pelo TTL).
    const now = Date.now();
    const stale = allCollections().filter((c) => {
      if (c.kind !== 'album' || !idle(c)) return false;
      const st = collState[c.id];
      return !st || !st.songs.length || (now - (st.indexSyncedAt || 0)) > ALBUM_INDEX_TTL;
    });
    await runLimited(stale, NET_CONCURRENCY, (c) => fetchCollectionIndex(c).catch(() => {}));
    // Fase 3: as LETRAS dos hinários, como informação padrão do acervo — o
    // índice sozinho não responde "qual hino fala em…". Fire-and-forget: é
    // longa (uma requisição por música) e nada na tela espera por ela; o
    // progresso vai para a notificação, como qualquer trabalho de massa.
    syncLyrics().catch(() => {});
  } finally { collectionsRefreshing = false; }
}

// Sincroniza (ou re-sincroniza) UMA coleção da API do LouvorJA para uso 100%
// offline. Duas fases: (1) Índice leve (nomes/números/duração) — a busca usa
// só isso; (2) Download pesado: para cada música ainda não baixada (ou cujo
// arquivo catalogado tenha sido apagado por fora, ou que ainda não tenha a
// letra sincronizada — backfill sem rebaixar o áudio), busca music_{id} e
// grava áudio Cantado + Playback (se houver) + capa/letra no OPFS/catálogo
// (mesma pasta `folders/<coll.id>/`). Aditiva e resumível: interromper e
// sincronizar de novo continua de onde parou, sem duplicar.
// `opts.allowMobile`: a pergunta de rede já foi feita para o LOTE (ver
// syncGroup) — não repetir por álbum.
// `opts.fromGroup`: a chamada é PROGRAMÁTICA (o laço do lote), não um toque do
// operador — ver o guard de cancelamento abaixo.
//
// Devolve `{ ok, baixados, falhou }`. Antes devolvia `undefined` em todos os
// caminhos, e por isso uma queda de rede era invisível para o chamador: o lote
// varria 40 álbuns em segundos sem baixar nada e ainda anunciava "Coleção
// completa" (ver syncGroup). `ok:false` = não deu para baixar (rede,
// armazenamento, erro); cancelar ou já estar completo é `ok:true`.
async function syncCollection(coll, opts) {
  const allowMobile = !!(opts && opts.allowMobile);
  const u = ui(coll.id);
  // Tocar de novo com a sincronização em andamento CANCELA. Antes isto era um
  // `return` mudo: um álbum de centenas de faixas, uma vez começado, não tinha
  // como ser interrompido a não ser fechando o app.
  if (u.syncBusy) {
    // …mas só quando quem tocou foi o OPERADOR. Vindo do lote, o álbum já
    // está baixando por conta própria: reinterpretar isso como "segundo
    // toque" ABORTAVA o download em curso — o operador pedia dois downloads e
    // o efeito líquido era parar um. Aqui o lote apenas pula o álbum.
    if (opts && opts.fromGroup) return { ok: true, baixados: 0, falhou: 0 };
    u.cancel = true;
    setCollStatus(coll.id, 'Cancelando…');
    renderCollectionsNow();
    return { ok: true, baixados: 0, falhou: 0 };
  }
  if (!AVDB.opfsSupported()) {
    setCollStatus(coll.id, 'Armazenamento OPFS indisponível', 5000);
    return { ok: false, baixados: 0, falhou: 0 };
  }
  u.syncBusy = true; u.cancel = false;
  setCollStatus(coll.id, 'Atualizando lista…');
  renderCollectionsNow(); // resposta ao toque é imediata; só o PROGRESSO é coalescido
  // Cancelamento: o próprio álbum (botão) ou o lote que o contém (syncGroup).
  // Declarado antes de tudo porque a VARREDURA do que falta também é longa num
  // álbum de centenas de faixas — cancelar ali já precisa valer.
  const cancelled = () => u.cancel || !!(opts && opts.cancelled && opts.cancelled());
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    try { await fetchCollectionIndex(coll); }
    catch (_) {
      setCollStatus(coll.id, 'Sem internet — falha ao atualizar', 5000);
      return { ok: false, baixados: 0, falhou: 0 };
    }
    const songs = collSongs(coll.id);

    const pending = [];
    // Em pedaços de 8, e não em série: cada música custa até 2 `fileGet`
    // (Cantado + Playback), e num hinário de ~600 faixas a varredura serial
    // eram ~1200 leituras de IDB uma a uma antes do primeiro byte de download.
    // O cancelamento continua valendo por iteração — conferido a cada pedaço,
    // e um pedaço em voo custa no máximo 8 leituras, não o álbum.
    const PASSO_VARREDURA = 8;
    for (let i = 0; i < songs.length; i += PASSO_VARREDURA) {
      if (cancelled()) { setCollStatus(coll.id, 'Cancelado', 4000); return { ok: true, baixados: 0, falhou: 0 }; }
      const fatia = songs.slice(i, i + PASSO_VARREDURA);
      const flags = await Promise.all(fatia.map((s) => songVariantsNeeded(coll, s)));
      flags.forEach((f, k) => { if (f.needsFull || f.needsPlayback) pending.push(fatia[k]); });
    }
    if (pending.length === 0) { setCollStatus(coll.id, 'Já completo offline', 4000); return { ok: true, baixados: 0, falhou: 0 }; }
    if (cancelled()) { setCollStatus(coll.id, 'Cancelado', 4000); return { ok: true, baixados: 0, falhou: 0 }; }

    // Fora do Wi-Fi a sincronização em massa NÃO é bloqueada — ela pergunta.
    // Baixar um hinário inteiro pode ser bastante coisa, e só o operador sabe
    // se o plano dele aguenta; o que o app não pode é decidir sozinho por ele,
    // em nenhuma das duas direções. A escolha vale **só para esta
    // sincronização deste álbum**: não vira uma preferência do app, e o
    // próximo álbum pergunta de novo.
    if (!isConfirmedWifi() && !allowMobile) {
      const est = estimatePendingBytes(coll);
      const proceed = await appConfirm({
        title: 'Baixar usando dados móveis?',
        message: 'Você não está numa rede Wi-Fi confirmada. Baixar ' + pending.length
          + ' música(s) pendente(s) de "' + coll.name + '" agora vai usar a internet móvel'
          + (est ? ' (aproximadamente ' + fmtBytes(est) + ')' : '') + '.\n\n'
          + 'Esta escolha vale só para este álbum, agora. Se preferir esperar o Wi-Fi, a lista '
          + 'já foi atualizada e cada música continua sendo baixada sozinha quando você tocá-la.',
        okText: 'Usar dados móveis', cancelText: 'Só no Wi-Fi',
      });
      if (!proceed) {
        setCollStatus(coll.id, 'Lista atualizada', 5000);
        return { ok: true, baixados: 0, falhou: 0 };
      }
    }

    let done = 0, falhou = 0;
    const CONCURRENCY = NET_CONCURRENCY;
    let next = 0;
    // Dentro de um lote (syncGroup) o rótulo da notificação já traz o contexto
    // do grupo; sozinho, é o nome do álbum.
    const notifLabel = (opts && opts.notifLabel) || coll.name;
    // Dentro de um lote a tarefa da notificação é do LOTE (notifOwned) — este
    // álbum só repassa o passo, sem abrir uma tarefa concorrente.
    const notifId = (opts && opts.notifOwned) ? 0 : bgTaskStart(notifLabel, pending.length);
    // Qual tarefa da notificação recebe os nomes: a do lote, quando há um.
    const itemTaskId = (opts && opts.notifTaskId) || notifId;
    async function worker() {
      while (next < pending.length) {
        // FECHAR A FILA é o que cancelar significa aqui: nenhuma música nova
        // entra, e as que já estão no ar (até NET_CONCURRENCY) terminam. Parar
        // no meio de um download deixaria um arquivo truncado catalogado como
        // completo — e o custo de esperar é uma faixa, não um álbum de 600.
        if (cancelled()) return;
        const s = pending[next++];
        bgItemStart(itemTaskId, s.name);
        // `done` conta TENTATIVAS (é ele que move a barra), `falhou` conta as
        // que voltaram sem áudio. Sem essa separação, uma queda de rede fazia
        // o rodapé anunciar "Atualizado (60 baixado(s))" com zero bytes no
        // disco: downloadCollectionSong engole a falha e o worker contava a
        // música como baixada.
        let okSong = true;
        try { okSong = (await downloadCollectionSong(coll, s)) !== false; }
        finally { bgItemEnd(itemTaskId, s.name); }
        done++;
        if (!okSong) falhou++;
        setCollStatus(coll.id, cancelled()
          ? 'Cancelando — concluindo o que já começou…'
          : 'Baixando ' + done + '/' + pending.length + '…');
        if (opts && opts.onSong) opts.onSong();
        else bgTaskStep(notifId, done);
        await AVDB.setState('coll:' + coll.id, collState[coll.id]);
      }
    }
    // Sincronização em massa: dezenas ou centenas de áudios — o operador
    // dispara e sai do app. Sem a proteção, parava ao minimizar.
    //
    // `bgTaskEnd` DENTRO do `withBgWork` (ver a mesma nota em syncGroup): o
    // `finally` de withBgWork roda antes de um `finally` externo e já limpa o
    // registro de tarefas, então encerrar a tarefa depois dele não tinha mais
    // efeito nenhum.
    await withBgWork(async () => {
      try {
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      } finally { bgTaskEnd(notifId); }
    });
    setCollStatus(coll.id, (cancelled() ? 'Cancelado (' : 'Atualizado (') + (done - falhou) + ' baixado(s))'
      + (falhou ? ' · ' + falhou + ' sem rede' : ''), 4000);
    // Tudo o que se tentou falhou: para o lote isso é o mesmo que não ter
    // baixado nada, e o cabeçalho do grupo precisa saber.
    return { ok: !(falhou > 0 && falhou >= done), baixados: done - falhou, falhou };
  } catch (_) {
    setCollStatus(coll.id, 'Erro na sincronização', 5000);
    return { ok: false, baixados: 0, falhou: 0 };
  } finally {
    u.syncBusy = false; u.cancel = false;
    // RECONFERIR O PESO AO FIM DO LOTE (v5.134). Durante o download o número
    // sobe por acumulação (`u.bytes +=` a cada arquivo), que é o certo para dar
    // movimento na tela mas erra em toda borda: uma faixa que falhou no meio,
    // um download repetido que sobrescreveu o arquivo anterior, um cancelamento
    // no meio do lote. O fim do lote é o momento em que perguntar ao disco é
    // barato — não há mais IO concorrente — e é o único ponto em que o número
    // exibido pode ser trocado pelo real sem custo visível.
    updateCollBytes(coll.id);
    refreshCollectionsIfVisible();
  }
}

// Baixa (ou completa) uma música: busca os metadados individuais (URLs reais) e
// grava áudio Cantado + Playback (se houver) + capa/letra sincronizada no
// OPFS/catálogo. `s` é mutado in-place (fileIdFull/fileIdPlayback), refletido
// no collState[coll.id] compartilhado.
//
// Devolve `false` quando nem os metadados vieram (sem rede) — quem chama
// precisa poder distinguir "baixou" de "desistiu em silêncio", senão o status
// final conta como baixada uma música que não saiu do lugar.
async function downloadCollectionSong(coll, s) {
  let meta;
  try { meta = await Louvorja.fetchList('music_' + s.id_music); }
  catch (_) { return false; } // sem rede agora; a próxima sincronização tenta de novo

  // Cache de imagens por URL, compartilhado entre as duas variantes (Cantado
  // e Playback quase sempre usam as mesmas imagens da letra) — evita baixar a
  // mesma imagem mais de uma vez.
  const imgCache = new Map();
  async function resolveImage(url) {
    if (!url) return null;
    if (imgCache.has(url)) return imgCache.get(url);
    const result = await downloadCollectionImage(coll.id, url, s.id_music, imgCache.size);
    imgCache.set(url, result);
    return result;
  }

  const coverImage = meta.url_image ? await resolveImage(meta.url_image) : null;
  const thumb = coverImage ? coverImage.thumbBlob : null;

  await ensureSongVariant(coll, s, 'fileIdFull', meta.url_music, 'Cantado', meta, 'time', thumb, resolveImage);
  if (s.has_instrumental_music) {
    await ensureSongVariant(coll, s, 'fileIdPlayback', meta.url_instrumental_music, 'Playback', meta, 'instrumental_time', thumb, resolveImage);
  }
}

// Garante que uma variante (Cantado/Playback) tenha áudio E letra
// sincronizada. Cobre 3 casos: nunca baixado (baixa tudo); áudio já baixado
// mas ainda sem `lyrics` (só recalcula e grava a letra no registro existente,
// SEM rebaixar o áudio — backfill dos itens baixados antes da letra existir);
// já completo (não faz nada).
async function ensureSongVariant(coll, s, fileKey, urlPath, variantLabel, meta, timeField, thumb, resolveImage) {
  // "NÃO EXISTE" NÃO É "NÃO BAIXEI" (v5.134). Uma música cuja origem não traz o
  // arquivo (`url_music`/`url_instrumental_music` vazios no `music_{id}`) nunca
  // ia ganhar id de arquivo — e, como toda a tela contava a ausência do id como
  // "falta baixar", a coleção NUNCA ficava completa: o botão de baixar não sumia
  // mais, e cada sincronização voltava a buscar o metadado dela só para
  // redescobrir que não há o que baixar. A marca fica no índice da coleção, e o
  // `fetchCollectionIndex` a preserva de graça (ele reaproveita o objeto).
  const semFonte = fileKey === 'fileIdFull' ? 'semAudio' : 'semPlayback';
  if (!urlPath) { s[semFonte] = true; return; }
  // E o contrário também: a origem pode ter ganhado o arquivo depois. Sem
  // apagar a marca, o app continuaria dizendo "não existe" para sempre.
  if (s[semFonte]) delete s[semFonte];
  const existingId = s[fileKey];
  const existingRec = existingId ? await AVDB.fileGet(existingId) : null;
  if (existingRec && existingRec.lyrics !== undefined) return; // já completo

  const lyrics = await buildLyricSlides(meta, timeField, resolveImage);

  if (existingRec) {
    existingRec.lyrics = lyrics;
    existingRec.hymnName = s.name;
    existingRec.hymnTrack = s.track;
    await AVDB.fileAdd(existingRec);
    invalidateLyricIndex();   // letra nova no aparelho: a busca precisa vê-la
    return;
  }
  // (A guarda de `urlPath` vazio está lá em cima, junto com a marca de "não
  // existe na origem" — aqui ela seria tarde: a letra já teria sido montada.)
  const id = await downloadCollectionFile(coll, s, urlPath, variantLabel, thumb, lyrics);
  if (id) { s[fileKey] = id; invalidateLyricIndex(); }
}

async function downloadCollectionFile(coll, s, urlPath, variantLabel, thumb, lyrics) {
  if (!urlPath) return null;
  let blob;
  try {
    const res = await fetch(Louvorja.fileUrl(urlPath));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    blob = await res.blob();
  } catch (_) { return null; }
  const ext = (urlPath.split('.').pop() || 'mp3').toLowerCase().split('?')[0];
  const id = uid();
  const path = 'folders/' + coll.id + '/' + s.id_music + '-' + variantLabel.toLowerCase() + '.' + ext;
  try { await AVDB.opfsWriteFile(path, blob); } catch (_) { return null; }
  await AVDB.fileAdd({
    id, folder: coll.id, opfsPath: path,
    srcName: s.id_music + '-' + variantLabel,
    name: songLabel(coll, s, true) + ' (' + variantLabel + ')',
    // `hymnTrack` é o número NO HINÁRIO, não a faixa do disco: fora de um
    // hinário fica nulo, e com isso o slide de capa, o título do popup de
    // letra e a preview param de numerar sem precisar saber de coleção
    // nenhuma (nenhum deles tem acesso a ela — o Display, em especial, só
    // recebe o registro do arquivo).
    hymnName: s.name, hymnTrack: collNumbersSongs(coll) ? s.track : null,
    type: blob.type || 'audio/mpeg', kind: 'audio',
    size: blob.size, mtime: Date.now(), thumb, lyrics,
    blob: null, url: null, addedAt: Date.now(),
  });
  // Peso da coleção: soma incremental, sem tocar o IDB. Recalcular com um
  // `filesByFolder` a cada arquivo baixado significava um getAll do catálogo
  // inteiro (registros COM thumb e letra) por música — ver updateCollBytes.
  ui(coll.id).bytes += blob.size || 0;
  salvarPesos();
  return id;
}

// Baixa uma imagem em resolução real pro OPFS (fundo dos slides de letra) e
// gera a miniatura do catálogo (mesmo `drawThumb`) a partir do MESMO blob —
// evita baixar a capa duas vezes (uma pro fundo, outra só pra miniatura).
async function downloadCollectionImage(folderId, url, songId, index) {
  let blob;
  try {
    const res = await fetch(Louvorja.fileUrl(url));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    blob = await res.blob();
  } catch (_) { return null; }
  const ext = (url.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const path = 'folders/' + folderId + '/' + songId + '-img-' + index + '.' + ext;
  try { await AVDB.opfsWriteFile(path, blob); } catch (_) { return null; }
  // ELAS TAMBÉM PESAM (v5.134). As imagens de fundo da letra vão para a MESMA
  // pasta dos áudios e ocupam disco como eles — mas não viram registro no
  // catálogo (são referenciadas de dentro dos slides, não são mídia da
  // biblioteca), e por isso ficavam de fora de toda conta: da soma incremental
  // daqui e da recontagem, que somava o catálogo. Num hinário inteiro isso é
  // centenas de MB que a tela não mostrava — e que o operador via sumir do
  // aparelho sem explicação.
  ui(folderId).bytes += blob.size || 0;
  salvarPesos();

  let thumbBlob = null;
  let objUrl = null;
  try {
    objUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = objUrl;
    });
    thumbBlob = await drawThumb(img, img.naturalWidth, img.naturalHeight);
  } catch (_) {
    // sem miniatura, mas a imagem de fundo já foi gravada — segue normalmente
  } finally {
    if (objUrl) URL.revokeObjectURL(objUrl);
  }
  return { opfsPath: path, thumbBlob };
}

// "HH:MM:SS" (ou variações com menos partes) → segundos. `null` se
// vazio/inválido — nunca 0, pra não colidir com o tempo fixo do slide de capa.
function parseTimeToSeconds(str) {
  if (!str) return null;
  const parts = String(str).split(':').map(Number);
  if (parts.some((n) => isNaN(n))) return null;
  while (parts.length < 3) parts.unshift(0);
  const [h, m, sec] = parts;
  return h * 3600 + m * 60 + sec;
}

// Monta os slides de letra sincronizada de uma variante (Cantado usa `time`,
// Playback usa `instrumental_time`): slide de capa (tempo 0, sem texto,
// imagem da música) + uma entrada por linha de `meta.lyric` marcada como
// `show_slide`, ordenadas por tempo. Uma linha sem imagem própria herda a da
// anterior (fallback "grudento", igual ao app original); linhas sem tempo
// utilizável no campo ativo são ignoradas. Retorna `null` se não sobrar
// nenhuma linha real (só a capa) — sinaliza "sem letra utilizável", pra não
// tentar de novo a cada sincronização (ver ensureSongVariant).
// A API do LouvorJA embute quebras de linha manuais como tags `<br>` literais
// dentro do texto (confirmado no app-ja: ele usa `v-html` pra renderizar
// essas tags como quebra real) — sem isso, a letra ficaria como um único
// parágrafo e o navegador quebraria a linha sozinho, de forma diferente da
// quebra original pretendida pelo hino. Convertemos pra `\n` real (não
// `innerHTML`/`v-html` — mais seguro, sem risco de injeção) e `white-space:
// pre-line` no CSS (`.lyrics-line`/`.lyrics-aux`) respeita essas quebras.
function normalizeLyricText(str) {
  return (str || '').replace(/<br\s*\/?>/gi, '\n').trim();
}

async function buildLyricSlides(meta, timeField, resolveImage) {
  let prevImage = meta.url_image ? await resolveImage(meta.url_image) : null;
  let prevImagePosition = meta.image_position;

  const cover = {
    time: 0, text: null, auxText: null, cover: true,
    imageOpfsPath: prevImage ? prevImage.opfsPath : null,
    imagePosition: prevImagePosition,
  };

  const lines = Object.values(meta.lyric || {})
    .filter((l) => l.show_slide === 1)
    .sort((a, b) => a.order - b.order);

  const slides = [cover];
  for (const line of lines) {
    const time = parseTimeToSeconds(line[timeField]);
    if (time === null) continue;
    if (line.url_image) {
      const resolved = await resolveImage(line.url_image);
      if (resolved) { prevImage = resolved; prevImagePosition = line.image_position; }
    }
    slides.push({
      time,
      text: normalizeLyricText(line.lyric),
      auxText: line.aux_lyric ? normalizeLyricText(line.aux_lyric) : null,
      cover: false,
      imageOpfsPath: prevImage ? prevImage.opfsPath : null,
      imagePosition: prevImagePosition,
    });
  }

  if (slides.length <= 1) return null; // só a capa — nada de real pra sincronizar

  slides.sort((a, b) => a.time - b.time);
  return slides;
}

async function deleteCollection(coll) {
  if (!(await appConfirm({ title: 'Excluir ' + coll.name, message: 'Excluir o que foi baixado de "' + coll.name + '" (áudios e capas) e a lista offline?', okText: 'Excluir' }))) return;
  const recs = await AVDB.filesByFolder(coll.id);
  await purgeCatalogRecords(recs);
  await AVDB.opfsDeleteDir('folders/' + coll.id);
  collState[coll.id] = { indexSyncedAt: 0, songs: [] };
  await AVDB.setState('coll:' + coll.id, collState[coll.id]);
  const u = ui(coll.id); u.bytes = 0;
  pesoConferido.add(coll.id);   // zerado por exclusão, não por falta de medida
  salvarPesos();
  if (currentFolder && currentFolder.id === coll.id) currentFolder = null;
  load();
}

// ---- popup de busca ----
// Debounce comum aos dois campos de busca (pasta e acervo): digitar não deve
// disparar um re-render completo por tecla.
const SEARCH_DEBOUNCE_MS = 130;
function debounce(fn, ms) {
  let t = null;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
function normalizeForSearch(s) {
  return String(s || '').normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();
}

// ===== Acervo de LETRAS (texto puro, para busca) =====
// A letra deixou de depender do áudio: ela é baixada junto com o índice, como
// informação padrão do acervo. Antes, só quem tinha a música no aparelho podia
// buscá-la — e o operador que procura "aquele hino que fala em…" quase nunca
// tem os 600 baixados.
//
// É um acervo SEPARADO do `files`, e de propósito:
//   - `files[].lyrics` são SLIDES (tempo, imagem, capa) e só existem com áudio
//     baixado. É o que a projeção sincronizada consome.
//   - `lyricStore` é só TEXTO, por música, e existe para toda música do índice.
//     É o que a busca consome.
// Fundi-los faria a busca carregar tempos e caminhos de imagem à toa, e faria
// o download do índice arrastar o peso dos slides.
//
// Guardado em `state` por coleção (`lyrics:<collId>`), gravado em LOTES: são
// centenas de músicas, e reescrever o blob inteiro a cada uma tornaria o
// download quadrático.
let lyricStore = {};          // { [collId]: { [id_music]: [{a,l}] | string[] (legado) | 0 } }
let lyricSyncRunning = false;

// `0` (e não ausência) marca "já perguntamos e esta música não tem letra" —
// sem isso, toda abertura do app tentaria de novo as mesmas centenas.
const LYRIC_NONE = 0;
const LYRIC_BATCH = 25;       // músicas por gravação

function lyricStoreFor(id) { return lyricStore[id] || (lyricStore[id] = {}); }

async function loadLyricStore() {
  const cols = allCollections();
  const saved = await Promise.all(cols.map((c) => AVDB.getState('lyrics:' + c.id)));
  lyricStore = {};
  cols.forEach((c, i) => { lyricStore[c.id] = (saved[i] && typeof saved[i] === 'object') ? saved[i] : {}; });
}

function saveLyricStore(collId) {
  return AVDB.setState('lyrics:' + collId, lyricStoreFor(collId));
}

// ===== A letra é uma lista de ESTROFES, não de linhas soltas =====
// O banco já entrega assim: cada entrada de `music_{id}.lyric` **é** uma
// estrofe, com `order`, o texto (linhas separadas por `<br>`) e `aux_lyric`,
// que é o RÓTULO da seção ("Refrão", "1ª Estrofe"). Até a v5.42 guardávamos só
// as linhas achatadas — o formato de que a BUSCA precisa —, e a visualização da
// letra completa herdava esse achatamento: trinta linhas seguidas, sem respiro
// e sem dizer onde entra o refrão, que é justamente o que o operador procura
// quando abre a letra.
//
// Guardar por estrofe não custa nada à busca: ela achata na hora de indexar
// (`lyricFlatLines`). O caminho inverso — inferir estrofes de linhas soltas —
// não existe, e é por isso que a mudança é no armazenamento e não só na tela.
//
// Formato: `[{ a: rótulo|null, l: [linhas] }]`. O legado (`['linha', ...]`)
// continua sendo lido; `lyricStanzas` normaliza os dois.
function lyricIsStanzas(v) {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null;
}

// Sempre `[{a, l}]`, venha do formato novo ou do antigo. Uma letra legada vira
// UMA estrofe só — que é exatamente o que ela era na tela antes disto.
function lyricStanzas(v) {
  if (lyricIsStanzas(v)) return v.map((e) => ({ a: e.a || null, l: e.l || [] }));
  if (Array.isArray(v) && v.length) return [{ a: null, l: v.filter((x) => typeof x === 'string') }];
  return null;
}

// Achata para a BUSCA (índice e casamento por trecho). O rótulo entra junto:
// "refrão" é palavra que se digita, e ignorá-la tiraria da busca um texto que
// está na letra.
function lyricFlatLines(v) {
  const est = lyricStanzas(v);
  if (!est) return null;
  const out = [];
  for (const e of est) {
    if (e.a) out.push(e.a);
    for (const ln of e.l) if (ln) out.push(ln);
  }
  return out.length ? out : null;
}

// Extrai as ESTROFES de um registro `music_{id}`, na ordem do banco. Ao
// contrário de `buildLyricSlides`, NÃO filtra por `show_slide`: uma estrofe que
// não vira slide continua sendo letra da música, e para BUSCAR isso só ajuda.
function lyricStanzasFromMeta(meta) {
  const linhas = Object.values((meta && meta.lyric) || {})
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const out = [];
  for (const l of linhas) {
    const texto = normalizeLyricText(l.lyric);
    const rotulo = normalizeLyricText(l.aux_lyric).replace(/\n+/g, ' ').trim();
    const ls = texto ? texto.split('\n').map((x) => x.trim()).filter(Boolean) : [];
    if (!ls.length && !rotulo) continue;
    out.push({ a: rotulo || null, l: ls });
  }
  return out.length ? out : null;
}

// ===== Busca DENTRO da letra =====
// "Qual é o hino que fala em 'firme nas promessas'?" é a pergunta que o
// operador faz de verdade, e até aqui a busca só respondia por título e número.
//
// A letra JÁ está no aparelho: `buildLyricSlides` a grava no registro do
// arquivo (store `files`) quando a música é baixada. Então o índice sai de UMA
// leitura do IDB, sem nenhuma requisição — e funciona offline, que é o estado
// normal no meio de um culto.
//
// **Duas fontes, uma chave.** O índice é montado por `collId:id_music` e puxa
// de onde houver: do `lyricStore` (baixado com o índice — cobre os hinários
// inteiros) ou dos slides do arquivo baixado (`files[].lyrics` — cobre álbuns e
// qualquer música já no aparelho). A linha encontrada aparece no resultado
// justamente para o operador ver POR QUE aquele item casou.
let lyricIndex = null;        // Map<'collId:idMusic', { norm, lines }> | null
let lyricIndexPending = null;

// Mínimo de caracteres para a busca entrar na letra. Com menos que isso o
// trecho casaria em quase todo hino ("de", "ao") e afogaria os resultados por
// título, que é o que o operador procura na maior parte das vezes.
const LYRIC_MIN_Q = 3;

// Linhas a partir dos SLIDES de um arquivo baixado. Uma estrofe pode ter
// várias linhas (o `<br>` da API vira `\n` em normalizeLyricText); quebrar aqui
// faz o trecho exibido ser UMA linha, e não o bloco inteiro.
// Cada slide já É uma estrofe — `text` com as linhas e `auxText` com o rótulo.
// Este é o caminho do que está BAIXADO no aparelho, e ele nunca precisou de
// upgrade de formato: a estrutura sempre esteve ali, só era descartada.
function stanzasFromSlides(slides) {
  const out = [];
  for (const slide of slides || []) {
    if (!slide || slide.cover) continue;
    const ls = String(slide.text || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const rotulo = String(slide.auxText || '').trim();
    if (!ls.length && !rotulo) continue;
    out.push({ a: rotulo || null, l: ls });
  }
  return out;
}

async function buildLyricIndex() {
  const map = new Map();
  let porArquivo = new Map();
  try {
    const files = await AVDB.filesAll();
    for (const f of files) {
      if (f && Array.isArray(f.lyrics) && f.lyrics.length) porArquivo.set(f.id, f.lyrics);
    }
  } catch (_) { /* sem os arquivos ainda dá para indexar o lyricStore */ }

  for (const coll of allCollections()) {
    const store = lyricStore[coll.id] || null;
    for (const s of collSongs(coll.id)) {
      // O acervo de letras vem PRIMEIRO: é texto puro e completo. Os slides
      // são o complemento para o que ele não cobre (álbuns, músicas avulsas).
      let lines = store ? lyricFlatLines(store[s.id_music]) : null;
      if (!lines) {
        const slides = porArquivo.get(s.fileIdFull) || porArquivo.get(s.fileIdPlayback);
        if (slides) lines = lyricFlatLines(stanzasFromSlides(slides));
      }
      if (!lines || !lines.length) continue;
      map.set(coll.id + ':' + s.id_music, { norm: normalizeForSearch(lines.join('\n')), lines });
    }
  }
  return map;
}

// Constrói sob demanda e redesenha quando ficar pronto — `renderSearchResults`
// é síncrona (roda a cada tecla) e não pode esperar o IDB.
function ensureLyricIndex() {
  if (lyricIndex || lyricIndexPending) return;
  lyricIndexPending = buildLyricIndex().then((m) => {
    lyricIndex = m;
    lyricIndexPending = null;
    // Só redesenha se o popup ainda estiver aberto e houver o que refinar.
    if (hymnSearchPopupEl.classList.contains('open')) renderSearchResults(hymnSearchInputEl.value);
  }).catch(() => { lyricIndexPending = null; });
}

// A letra de uma música só entra no índice quando é baixada; um download novo
// torna o índice obsoleto. Invalidar (em vez de reconstruir) evita pagar a
// leitura no meio de uma sincronização em massa.
function invalidateLyricIndex() { lyricIndex = null; }

// Linhas da letra de UMA música, das duas fontes (acervo de texto primeiro,
// slides do arquivo baixado como complemento). Assíncrona por causa do
// `fileGet`; o acervo de texto, que cobre os hinários, resolve sem esperar IDB.
async function songLyricStanzas(coll, s) {
  const store = lyricStore[coll.id];
  const doAcervo = store ? lyricStanzas(store[s.id_music]) : null;
  // O acervo de texto vem primeiro, MAS um registro legado (linhas soltas, uma
  // "estrofe" só) perde para os slides do arquivo baixado, que trazem a divisão
  // de verdade. Enquanto a fila não reescreve o legado, quem já tem a música no
  // aparelho já vê a letra dividida.
  if (doAcervo && (doAcervo.length > 1 || doAcervo[0].a)) return doAcervo;
  for (const fid of [s.fileIdFull, s.fileIdPlayback]) {
    if (!fid) continue;
    const rec = await AVDB.fileGet(fid).catch(() => null);
    if (!rec || !Array.isArray(rec.lyrics)) continue;
    const est = stanzasFromSlides(rec.lyrics);
    if (est.length) return est;
  }
  return doAcervo;
}

// Devolve a LINHA da letra que casa com a busca, ou null.
function lyricMatch(coll, s, q) {
  if (!lyricIndex || q.length < LYRIC_MIN_Q) return null;
  const e = lyricIndex.get(coll.id + ':' + s.id_music);
  if (!e || !e.norm.includes(q)) return null;
  for (const ln of e.lines) {
    if (normalizeForSearch(ln).includes(q)) return ln;
  }
  return e.lines[0];   // casou no todo mas não numa linha (busca cruzou a quebra)
}

// ===== Download das letras (roda no arranque, como o índice) =====
// **Todo o acervo indexado**, hinários e álbuns — a mesma cobertura do índice
// de músicas. A busca por trecho não teria por que conhecer metade do acervo:
// "aquele hino que fala em…" e "aquela música do álbum que fala em…" são a
// mesma pergunta, e o operador não sabe (nem deveria precisar saber) de qual
// coleção veio o que ele está procurando.
//
// **Hinários primeiro na fila.** São o que mais se busca, e a fila pode levar
// alguns minutos na primeira abertura: se ela for interrompida (app fechado,
// rede caiu), o que já desceu é o que mais importa. O resto continua na
// próxima abertura, de onde parou.
//
// **Adia só em rede móvel CONHECIDA** — e a assimetria com `syncCollection` é
// deliberada. Lá o que desce são centenas de MB de áudio, e perguntar é o certo.
// Aqui é JSON de texto: alguns KB por música, poucos MB no hinário inteiro —
// menos que UMA música que o app baixa com um toque, sem perguntar nada.
//
// Por isso a condição é `type === 'cellular'`, e não `isConfirmedWifi()`:
// `navigator.connection.type` não existe em boa parte dos aparelhos e devolve
// `'unknown'`, então exigir Wi-Fi CONFIRMADO faria o recurso simplesmente nunca
// rodar na maioria deles — um no-op silencioso, que é o pior resultado
// possível. Na dúvida, baixa; a certeza de estar no plano de dados é que adia.
// E não pergunta nada no arranque: um diálogo ao abrir o app chegaria
// justamente quando o operador quer é ligar o telão.
// Falta letra, OU a que existe está no formato antigo (linhas soltas, sem
// estrofe). O legado entra na mesma fila do que nunca foi baixado: é uma
// passagem única, em segundo plano e só em wi-fi, exatamente como a primeira
// carga foi. Inferir estrofes a partir de linhas achatadas não é possível —
// por isso o upgrade custa uma releitura do `music_{id}`, e não uma conversão
// local.
// `LYRIC_NONE` (0) NÃO entra: já sabemos que essa música não tem letra, e
// nada muda com o formato novo.
function songsMissingLyric(coll) {
  const store = lyricStoreFor(coll.id);
  return collSongs(coll.id).filter((s) => {
    const v = store[s.id_music];
    if (v === undefined) return true;
    return Array.isArray(v) && v.length > 0 && !lyricIsStanzas(v);
  });
}

async function syncLyrics() {
  if (lyricSyncRunning) return;
  if (networkType() === 'cellular') return;

  // Hinários antes dos álbuns (ver acima). Dentro de cada grupo, a ordem do
  // acervo.
  const cols = allCollections()
    .filter((c) => collSongs(c.id).length)
    .sort((a, b) => (a.kind === 'hymnal' ? 0 : 1) - (b.kind === 'hymnal' ? 0 : 1));

  // Agrupado por `id_music`, e não por (coleção, música): a MESMA faixa aparece
  // em várias coletâneas, e `music_{id}` é o mesmo documento para todas. Uma
  // busca por par custaria três requisições para uma música em três álbuns —
  // aqui custa uma, e o resultado é distribuído para todas as coleções que a
  // contêm. É o que torna varrer o acervo inteiro viável.
  const porMusica = new Map();  // id_music → { nome, destinos: [collId, ...] }
  for (const coll of cols) {
    for (const s of songsMissingLyric(coll)) {
      let e = porMusica.get(s.id_music);
      if (!e) porMusica.set(s.id_music, (e = { nome: s.name, destinos: [] }));
      e.destinos.push(coll.id);
    }
  }
  const pendentes = [...porMusica.entries()].map(([id, e]) => ({ id, ...e }));
  if (!pendentes.length) return;

  lyricSyncRunning = true;
  const notifId = bgTaskStart('Letras das músicas', pendentes.length);
  let done = 0;
  let desdeGravacao = 0;
  const sujas = new Set();
  try {
    // `bgTaskEnd` DENTRO do withBgWork (mesma nota de syncGroup): o `finally`
    // dele roda antes do de fora e já limpa o registro de tarefas.
    await withBgWork(async () => {
     try {
      await runLimited(pendentes, NET_CONCURRENCY, async (item) => {
      bgItemStart(notifId, item.nome);
      try {
        const meta = await Louvorja.fetchList('music_' + item.id);
        const linhas = lyricStanzasFromMeta(meta) || LYRIC_NONE;
        for (const collId of item.destinos) {
          lyricStoreFor(collId)[item.id] = linhas;
          sujas.add(collId);
        }
      } catch (_) {
        // Falha de rede não vira LYRIC_NONE: sem a marca, a próxima abertura
        // tenta de novo. Marcar aqui gravaria "não tem letra" por causa de um
        // wi-fi que oscilou, e a música ficaria fora da busca para sempre.
      } finally { bgItemEnd(notifId, item.nome); }
      done++;
      bgTaskStep(notifId, done);
      if (++desdeGravacao >= LYRIC_BATCH) {
        desdeGravacao = 0;
        // Tirar a lista e limpar o conjunto ANTES de gravar. Os 6 workers
        // correm juntos: durante o `await` os outros continuam marcando
        // coleções sujas, e um `clear()` DEPOIS apagava essas marcas — a
        // letra ficava só na memória e, se aquela coleção já tivesse
        // acabado, nunca mais era marcada e a gravação final a ignorava.
        // Sintoma medido: 48 de 48 buscadas, 45 de 50 pares no disco, e um
        // álbum inteiro pela metade em ~1 de 6 aberturas.
        const lote = [...sujas];
        sujas.clear();
        await Promise.all(lote.map(saveLyricStore));
      }
      });
     } finally { bgTaskEnd(notifId); }
    });
  } finally {
    await Promise.all([...sujas].map(saveLyricStore)).catch(() => {});
    lyricSyncRunning = false;
    invalidateLyricIndex();   // o acervo cresceu: a busca precisa reindexar
  }
}

// Busca GLOBAL (botão de lupa): escopo null = varre todas as coleções.
function openHymnSearch() {
  hymnSearchTitleEl.textContent = 'Biblioteca';
  hymnSearchInputEl.placeholder = 'Nome, número ou trecho da letra…';
  hymnSearchInputEl.value = '';
  renderSearchResults('');
  hymnSearchPopupEl.classList.add('open');
  // **O TECLADO SOBE NOS DOIS MODOS** (v5.131).
  //
  // No simplificado isso vale desde a v5.90: ali o acervo é aberto por um botão
  // que se chama BUSCAR, e quem entra por ele sabe o que quer.
  //
  // No avançado a regra era o contrário, e o argumento era razoável — a
  // abertura é o acervo para folhear, e o teclado cobre metade dele. Só que na
  // prática quem abre a Biblioteca está atrás de UMA música, e o preço da regra
  // antiga era um toque a mais toda vez, no meio do culto, para chegar ao campo
  // que já estava na tela. Folhear continua a um toque de distância: fechar o
  // teclado é o gesto mais conhecido do Android.
  //
  // Síncrono e dentro do gesto: `focus()` adiado (um `setTimeout`) sai da
  // interação do toque, e aí o WebView aceita o foco mas NÃO abre o teclado —
  // o pior resultado possível, porque parece que funcionou.
  hymnSearchInputEl.focus();
}

function closeHymnSearch() {
  hymnSearchPopupEl.classList.remove('open');
}

// Duas telas no mesmo popup, e **o campo é a chave**: vazio = o ACERVO (as
// categorias, pílulas e cards, com as músicas de cada coleção dentro do próprio
// acordeão); com texto = a lista de músicas que casam, de todo o acervo.
//
// Não há mais um "modo coleção" separado (v5.45). Entrar numa coleção era trocar
// de tela e voltar; agora o álbum abre no lugar, com o acervo inteiro ainda
// visível em volta — o operador não perde onde estava para ver o que tem dentro.
function searchIsBrowsing(q) { return !q; }

function renderSearchResults(query) {
  const q = normalizeForSearch(query).trim();
  // Digitou outra coisa: os resultados do YouTube da busca anterior saem de
  // cena. Deixá-los ali embaixo de um termo novo é oferecer a resposta errada.
  if (!ytBuscando && ytBuscaItens && ytBuscaTermo !== (query || '').trim()) ytBuscaItens = null;
  if (searchIsBrowsing(q)) {
    hymnResultsEl.innerHTML = '';
    renderAcervoTotal(() => renderSearchResults(hymnSearchInputEl.value));
    renderCollectionsList(hymnResultsEl, () => renderSearchResults(hymnSearchInputEl.value),
      { semTotal: true });
    // Quem enche o disco é o download de música: a linha de uso vem junto do
    // acervo, que é onde se decide baixar (e onde se decide apagar).
    renderStorageUsage(hymnResultsEl, () => hymnSearchPopupEl.classList.contains('open')
      && searchIsBrowsing(normalizeForSearch(hymnSearchInputEl.value).trim()));
    return;
  }
  const cols = allCollections();
  // A letra só é varrida com busca de verdade (ver LYRIC_MIN_Q).
  if (q.length >= LYRIC_MIN_Q) ensureLyricIndex();

  const porNome = [];    // { coll, song }
  const porLetra = [];   // { coll, song, hit }
  let totalIndexed = 0;
  for (const coll of cols) {
    const songs = collSongs(coll.id);
    const numera = collNumbersSongs(coll);
    totalIndexed += songs.length;
    for (const s of songs) {
      // `_norm` é calculado UMA vez, ao montar o índice (fetchCollectionIndex /
      // loadCollections). Normalizar aqui significava três alocações de string
      // por música a cada tecla, sobre um nome que nunca muda — e a busca
      // global varre os dois hinários (~1100) mais todos os álbuns indexados.
      const norm = s._norm || (s._norm = normalizeForSearch(s.name));
      // Busca por NÚMERO só onde o número identifica a música: digitar "3"
      // traria a faixa 3 de cada álbum indexado, dezenas de resultados que
      // ninguém pediu, empurrando o hino 3 para o fim da lista.
      if (q === '' || norm.includes(q) || (numera && String(s.track) === q)) {
        porNome.push({ coll, song: s });
        continue;   // já casou pelo título: não procura na letra à toa
      }
      const hit = lyricMatch(coll, s, q);
      if (hit) porLetra.push({ coll, song: s, hit });
    }
  }
  // Título ANTES de letra, sempre. Quem digita "Firme nas Promessas" quer o
  // hino de mesmo nome no topo — não os quinze que citam a expressão numa
  // estrofe. Dentro de cada grupo a ordem do acervo é preservada.
  const matches = porNome.concat(porLetra);
  hymnResultsEl.innerHTML = '';
  if (totalIndexed === 0) {
    hymnResultsEl.innerHTML = '<li class="empty">Índice da biblioteca ainda não carregado.'
      + '<br>Precisa de internet na primeira vez.</li>';
    appendYoutubeSearch(query);
    return;
  }
  if (matches.length === 0) {
    // "no acervo" não é detalhe: logo abaixo vem o cabeçalho dos resultados do
    // YouTube, e sem dizer ONDE não achou a frase parece negar a busca inteira.
    hymnResultsEl.innerHTML = '<li class="empty">Nenhuma música encontrada na biblioteca.</li>';
    appendYoutubeSearch(query);
    return;
  }
  // Teto na busca: ela varre milhares de músicas de todos os álbuns, e
  // renderizar tudo a cada tecla travaria o campo. Folhear uma coleção INTEIRA
  // não passa mais por aqui — é o acordeão do card, que lista tudo.
  const LIMIT = 60;
  matches.slice(0, LIMIT).forEach((m) => hymnResultsEl.appendChild(hymnResultRow(m.coll, m.song, m.hit)));
  if (matches.length > LIMIT) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = '+' + (matches.length - LIMIT) + ' resultado(s). Refine a busca.';
    hymnResultsEl.appendChild(li);
  }
  appendYoutubeSearch(query);
}

// ===== "Pesquisar <texto> no YouTube", no fim da busca do acervo =====
// O acervo é o LouvorJA, e ele não tem tudo: um louvor especial gravado pelo
// coral da igreja, um clipe, um hino numa versão específica. Hoje a saída é
// sair do app, abrir o YouTube, digitar tudo de novo e compartilhar de volta —
// e o "digitar tudo de novo" acontece com o texto já digitado aqui, na tela em
// que se acabou de descobrir que a música não está no acervo. Esta linha é o
// atalho desse caminho: leva a busca pronta e devolve o operador ao ponto em
// que o compartilhamento (`ShareIntake`) já sabe receber o vídeo.
//
// Ela fecha o fim da lista em TODOS os desfechos da busca — inclusive (e
// principalmente) "Nenhuma música encontrada", que é justamente quando a
// pergunta "e agora?" aparece.
// Estado da busca do YouTube dentro do acervo: `null` = nem pediram; array =
// resultados do termo em `ytBuscaTermo`. Zerado a cada tecla nova (ver o
// chamador), porque uma lista de resultados de OUTRA busca embaixo do campo é
// pior que nenhuma.
let ytBuscaTermo = '';
let ytBuscaItens = null;
let ytBuscando = false;

function appendYoutubeSearch(texto) {
  const termo = (texto || '').trim();
  if (!termo) return;
  // Num shell antigo `AVNative.openExternal` não existe: a navegação para fora
  // do origin é BLOQUEADA no WebView (WebViewFactory.shouldOverrideUrlLoading)
  // e nada aconteceria ao tocar. Um botão morto no meio de um culto é pior que
  // botão nenhum, então ele só aparece onde de fato funciona — e volta sozinho
  // quando o APK novo for instalado. No navegador é sempre `window.open`.
  if (window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) < 15) return;

  // Onde o shell sabe pesquisar, o BOTÃO SAIU (v5.91). Ele existia para quem
  // decidisse antes de rolar — mas chegar no fim da lista já dispara a busca
  // sozinho, e as duas coisas juntas viraram um botão que quase sempre era
  // apertado depois de a busca já ter começado, ou que simplesmente não tinha
  // mais função. No lugar dele fica uma LINHA DE ESTADO: ela é a sentinela que
  // o observador vigia (precisa de altura de verdade), o sinal de que a busca
  // está em curso e, depois, o rótulo que separa o acervo dos resultados do
  // YouTube. O botão continua onde ele é a ÚNICA saída: navegador e shell < 18,
  // que não sabem pesquisar de dentro do app e abrem o YouTube por fora.
  const aquiDentro = window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 18;
  const li = document.createElement('li');
  if (aquiDentro) {
    const buscou = ytBuscaItens && ytBuscaTermo === termo;
    // CABEÇALHO DE SEÇÃO, não uma linha de aviso solta (v5.92): o que vem
    // abaixo dele não é mais o acervo, e a lista não dava esse degrau — as duas
    // origens vinham coladas, com a mesma anatomia de linha, e só o nome do
    // canal no subtítulo denunciava a troca. O filete em cima é a separação; o
    // alinhamento à esquerda e o peso são o que fazem ler como título de seção
    // e não como mais um item.
    li.className = 'yt-head';
    if (buscou) {
      li.textContent = ytBuscaItens.length
        ? 'Resultados do YouTube:'
        : 'Nada encontrado no YouTube.';
    } else {
      // Ainda não buscou, ou está buscando: os dois estados desenham a mesma
      // coisa de propósito. A linha só é VISTA quando a lista chega ao fim, e
      // ver a linha é o que dispara a busca — o intervalo entre uma coisa e
      // outra é o antirruído de 500 ms, não uma promessa em falso.
      const anel = document.createElement('span');
      anel.className = 'dl-ring';
      const txt = document.createElement('span');
      // Sem repetir o termo entre aspas: ele era necessário no BOTÃO, que
      // prometia levar AQUELE texto para fora do app. Numa linha de estado logo
      // abaixo do campo em que o operador acabou de digitar, ele só faz a
      // frase quebrar em duas linhas e desalinhar o anel.
      txt.textContent = 'Procurando no YouTube…';
      li.append(anel, txt);
    }
  } else {
    const btn = document.createElement('button');
    btn.className = 'yt-search-btn';
    btn.innerHTML = searchIconSvg();
    const txt = document.createElement('span');
    txt.className = 'yt-search-txt';
    // O termo entre aspas é o que diz que a busca vai levar ISTO, e não abrir o
    // YouTube na página inicial.
    txt.textContent = 'Pesquisar “' + termo + '” no YouTube';
    btn.appendChild(txt);
    btn.addEventListener('click', () => buscarNoYoutube(termo));
    li.appendChild(btn);
  }
  hymnResultsEl.appendChild(li);
  // CHEGAR NO FIM DA LISTA JÁ PESQUISA. Rolar até o fim do que o acervo tem é
  // exatamente o gesto de quem não achou o que queria.
  armarAutoBuscaYt(li, termo);

  // Os RESULTADOS, na mesma lista — é isto que dispensa sair do app. Só do
  // termo atual: uma lista de outra busca embaixo do campo é pior que nenhuma.
  if (ytBuscaItens && ytBuscaTermo === termo) {
    // Vazio: quem já disse isso foi a própria linha de estado (ou, no caminho
    // do botão, a linha abaixo).
    if (!ytBuscaItens.length) {
      if (!aquiDentro) {
        const vazio = document.createElement('li');
        vazio.className = 'empty';
        vazio.textContent = 'Nada encontrado no YouTube.';
        hymnResultsEl.appendChild(vazio);
      }
      return;
    }
    ytBuscaItens.forEach((r) => hymnResultsEl.appendChild(ytResultRow(r)));
    marcarYtProntos(ytBuscaItens);
  }
}

// O resultado que JÁ está no aparelho nasce marcado como concluído. O ✓ passa
// a dizer as duas coisas ao mesmo tempo — "acabou de baixar" e "já estava
// aqui" —, que é a informação de que o operador precisa antes de escolher o
// destino: tocar agora não vai custar um download. Assíncrono de propósito: a
// lista não espera pelo IDB, e o estado mora no Map (`ytEstado`), então
// sobrevive ao próximo render.
async function marcarYtProntos(itens) {
  // As consultas são independentes (índice `youtubeId`, sem blob) — em
  // paralelo, a página inteira de resultados é respondida no tempo de UMA ida
  // ao IDB, não de vinte em série.
  await Promise.all(itens.map(async (r) => {
    if (!r || !r.id || ytEstado.has(r.id)) return;
    const rec = await AVDB.mediaByYoutube(r.id);
    if (rec && rec.blob) setYtEstado(r.id, 'pronto');
  }));
}

// CANCELAR O DOWNLOAD EM CURSO (v5.131 · shell 28).
//
// O que o shell pode parar é o download; a EXTRAÇÃO (segundos, antes do
// primeiro byte) segue até o fim e só então o pedido é notado. Na prática o
// operador toca durante o download, que é a parte longa.
//
// Quem foi cancelado entra neste conjunto para o desfecho ser SILENCIOSO: a
// ponte devolve `null` como em qualquer falha, e sem esta marca o `ytAcao`
// pintaria a linha de vermelho e diria que deu erro — para algo que o próprio
// operador pediu.
const ytCancelados = new Set();
async function cancelarDownloadYt(r) {
  if (!r || !r.id) return;
  // Sem o método na ponte não há o que oferecer: um "cancelar" que só some com
  // a marca da tela enquanto o aparelho continua baixando centenas de MB é
  // pior que não ter botão, porque o operador acredita que parou.
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 28) return;
  if ((ytEstado.get(r.id) || {}).estado !== 'baixando') return;
  const ok = await appConfirm({
    title: 'Cancelar o download?',
    message: (r.name || 'Este vídeo') + '\n\nO que já baixou é descartado.',
    okText: 'Cancelar download',
    cancelText: 'Continuar baixando',
  });
  // O download pode ter TERMINADO durante a pergunta — e aí não há mais o que
  // cancelar. Sem esta segunda leitura, o pedido chegaria ao shell depois do
  // fim e ficaria armado contra o próximo download do mesmo vídeo.
  if (!ok || (ytEstado.get(r.id) || {}).estado !== 'baixando') return;
  ytCancelados.add(r.id);
  AVNative.ytCancel(r.url);
  setYtEstado(r.id, null);
}

// O estado de cada resultado (`baixando` / `pronto`) vive num Map, e não na
// classe do nó: a lista do acervo é RECONSTRUÍDA a cada tecla e a cada
// redesenho, e uma classe escrita no elemento sumiria no próximo render — com o
// download ainda correndo. É a mesma razão do `songRowBusy` das músicas.
const ytEstado = new Map();
// Existe alguma LINHA na tela mostrando este vídeo? É por ela que todo o
// retorno do YouTube acontece — o anel de download, o ✓ e o vermelho da falha
// moram na miniatura do resultado.
//
// A pergunta passou a importar na v5.137, quando um link COMPARTILHADO ganhou a
// mesma folha de escolhas da busca: ali não há busca aberta atrás, então não há
// miniatura nenhuma para pintar, e um download de minutos terminaria em
// silêncio absoluto — que é exatamente o que a v5.112 tirou deste caminho.
function ytLinhaVisivel(id) {
  // Comparação por `dataset`, sem seletor de atributo — o mesmo padrão de
  // `setYtEstado`/`setSongRowBusy`: montar um seletor a partir de dado é o
  // tipo de coisa que quebra calada no dia em que um id trouxer outro
  // caractere.
  if (!id) return false;
  return [...document.querySelectorAll('.yt-result')].some((li) => li.dataset.yt === id);
}

function setYtEstado(id, estado, pct) {
  if (estado) ytEstado.set(id, { estado, pct: typeof pct === 'number' ? pct : -1 });
  else ytEstado.delete(id);
  document.querySelectorAll('.yt-result').forEach((li) => {
    if (li.dataset.yt !== id) return;
    pintarYtLinha(li, ytEstado.get(id));
  });
}
// Quanto tempo a linha fica marcada como falha antes de voltar ao normal. Curto
// o bastante para não parecer permanente (o vídeo continua lá, e tentar de novo
// costuma funcionar), longo o bastante para ser visto por quem estava olhando a
// tela quando o download terminou.
const YT_ERRO_MS = 4000;
function pintarYtLinha(li, reg) {
  li.classList.toggle('baixando', !!reg && reg.estado === 'baixando');
  li.classList.toggle('pronto', !!reg && reg.estado === 'pronto');
  li.classList.toggle('erro', !!reg && reg.estado === 'erro');
  const t = li.querySelector('.dl-pct');
  if (t) t.textContent = (reg && reg.estado === 'baixando' && reg.pct >= 0) ? reg.pct + '%' : '';
}

// A folha de ações do resultado — as MESMAS três escolhas das músicas do
// acervo, pela mesma folha (`#songMenuPopup`) e com os mesmos ícones. Antes o
// toque baixava direto e pronto: o operador não escolhia nada e o vídeo caía no
// Cronograma quisesse ele ou não.
// Os tetos oferecidos, do melhor ao mais leve. 1080p é o telão da igreja e o
// padrão; 720p corta o tamanho pela metade sem doer numa tela dessas; 480p é a
// escolha de quem está no chip do celular minutos antes do culto — ali um
// louvor que TERMINA vale mais que um que não.
//
// 360p ficou de fora de propósito: num telão de salão ele é ruim o suficiente
// para não valer ser oferecido, e é justamente o piso em que o app ficou preso
// por sete versões. Acima de 1080p também não: o telão não mostra a diferença e
// o aparelho ainda guarda hinário e Bíblia.
const YT_ALTURAS = [1080, 720, 480];

// Uma linha de segmentos da folha de download — o MESMO desenho de
// Cantada/Playback das músicas do acervo. Duas perguntas usam este formato
// (forma e qualidade), e escrevê-lo duas vezes era garantir que a segunda
// divergisse da primeira no primeiro ajuste de estilo.
function ytSegRow(opcoes, atual, onPick) {
  const li = document.createElement('li'); li.className = 'song-menu-seg-row';
  const wrap = document.createElement('div'); wrap.className = 'fit-seg song-menu-seg';
  opcoes.forEach(([valor, rotulo]) => {
    const b = document.createElement('button');
    b.className = 'fit-opt' + (atual === valor ? ' active' : '');
    b.textContent = rotulo;
    b.addEventListener('click', () => onPick(valor));
    wrap.appendChild(b);
  });
  li.appendChild(wrap);
  return li;
}

function openYtMenu(r) {
  // A qualidade nasce no padrão A CADA ITEM, como a forma e como a variante das
  // músicas. Deliberado: um teto que grudasse faria o operador escolher 480p
  // numa rede ruim e receber, sem aviso, o vídeo principal do domingo seguinte
  // em 480p no telão. O atrito de dois toques é visível; a regressão silenciosa
  // não seria.
  if (!songMenuFor || songMenuFor.yt !== r) {
    songMenuFor = { yt: r, variant: 'full', audio: false, alt: YT_ALTURAS[0] };
    // Item novo, folha nova: os destinos marcados são da FOLHA ABERTA e não
    // atravessam de um vídeo para o outro. (Os toques nos seletores de forma e
    // qualidade remontam a folha para o MESMO `r` e passam por aqui sem zerar
    // nada, que é o que preserva o que já foi marcado.)
    destLimpar();
  }
  songMenuTitleEl.textContent = r.name || 'Vídeo do YouTube';
  songMenuListEl.innerHTML = '';
  // VÍDEO × SÓ ÁUDIO, no MESMO seletor de Cantada/Playback das músicas do
  // acervo — é a mesma pergunta ("qual faixa deste item?") e não havia por que
  // inventar um segundo desenho para ela. A escolha vale para as quatro ações
  // abaixo, em vez de dobrar a folha para oito linhas.
  //
  // Só aparece com shell ≥ 23 (`ytFetchAudio` na ponte). Num anterior o botão
  // não faria nada, e botão que não faz nada no meio de um culto é pior que
  // botão nenhum — mesma regra do botão de busca no YouTube.
  if (window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 23) {
    songMenuListEl.appendChild(ytSegRow(
      [[false, 'Vídeo'], [true, 'Só áudio']],
      !!songMenuFor.audio,
      (v) => { songMenuFor.audio = v; openYtMenu(r); },
    ));
  }
  // A QUALIDADE, logo abaixo da forma — e só quando há vídeo para qualificar:
  // com "Só áudio" escolhido não existe resolução nenhuma, e deixar a linha na
  // tela seria oferecer uma escolha que não faz nada (a mesma regra do botão de
  // busca no YouTube num shell antigo).
  //
  // Shell ≥ 25, pelo método `ytFetchAte` da ponte. Num anterior a linha não
  // aparece e o download sai no padrão de sempre — que é exatamente o que este
  // app fazia até agora, então nada regride.
  if (window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 25 && !songMenuFor.audio) {
    songMenuListEl.appendChild(ytSegRow(
      YT_ALTURAS.map((h) => [h, h + 'p']),
      songMenuFor.alt | 0,
      (v) => { songMenuFor.alt = v; openYtMenu(r); },
    ));
  }
  // O subtítulo do "Tocar agora" DIZ que o Cronograma fica de fora: é a
  // diferença entre as três opções, e ela não se adivinha olhando o ícone.
  // A escolha é lida AGORA, na montagem, e viaja no fecho de cada ação: o
  // `songMenuItem` chama `closeSongMenu()` antes da ação, e `closeSongMenu`
  // zera o `songMenuFor` — consultá-lo lá dentro encontraria null e todo
  // download sairia como vídeo. É o mesmo cuidado que a `variante` das músicas
  // já tomava, e a folha é remontada a cada toque no seletor, então o valor
  // capturado é sempre o vigente.
  const soAudio = !!songMenuFor.audio;
  // A altura viaja no fecho junto com a forma, e pelo MESMO motivo: o
  // `songMenuItem` chama `closeSongMenu()` antes da ação, e ela zera o
  // `songMenuFor` — ler o teto lá dentro encontraria null e todo download sairia
  // no padrão, calado.
  const altura = soAudio ? 0 : (songMenuFor.alt | 0);
  // OS DESTINOS SÃO MARCÁVEIS (v5.141), e aqui o ganho é maior que no acervo: um
  // vídeo do YouTube custa MINUTOS de download. Até aqui, querer o mesmo louvor
  // no Cronograma e nos Favoritos era baixá-lo duas vezes — e o operador só
  // descobria isso na segunda espera. Agora o download é um só e o arquivo entra
  // nas listas marcadas.
  //
  // "Tocar agora" NÃO ganha caixa: ele não é uma lista, é o telão. E ele
  // continua honrando o que estiver marcado (o `songMenuItem` passa a união),
  // então "marcar Cronograma + tocar agora" projeta e guarda no mesmo toque —
  // que é exatamente o que se faz com o louvor que acabou de chegar.
  const remontar = () => openYtMenu(r);
  destExecutor = (alvos, btn) => ytAcao(r, alvos, btn, soAudio, altura);
  songMenuListEl.appendChild(songMenuItem(msym(ICON.play), 'Tocar agora',
    soAudio ? 'Toca no fundo, sem mexer no telão' : 'Projeta em seguida, sem entrar no Cronograma',
    (vr, btn, alvos) => ytAcao(r, alvos, null, soAudio, altura), 'tocar'));
  songMenuListEl.appendChild(songMenuItem(msym(ICON.queue), 'Adicionar à playlist',
    'Entra na fila, sem entrar no Cronograma',
    (vr, btn, alvos) => ytAcao(r, alvos, btn, soAudio, altura), 'playlist', remontar));
  songMenuListEl.appendChild(songMenuItem(msym(ICON.cronoAdd), 'Adicionar ao Cronograma',
    'A lista do culto',
    (vr, btn, alvos) => ytAcao(r, alvos, btn, soAudio, altura), 'cronograma', remontar));
  songMenuListEl.appendChild(songMenuItem(msym(ICON.star), 'Favoritar',
    'Baixa e marca — fica à mão toda semana',
    (vr, btn, alvos) => ytAcao(r, alvos, btn, soAudio, altura), 'favoritos', remontar));
  const go = destConfirmRow();
  if (go) songMenuListEl.appendChild(go);
  songMenuPopupEl.classList.add('open');
}

// Baixa e faz o que foi escolhido.
//
// "Tocar agora" FECHA o acervo — mesma regra de `playSongVariant`: o cartão de
// progresso mora na preview, e a preview está atrás desta bandeja. As duas
// opções de "adicionar" MANTÊM o acervo aberto, porque o operador está no meio
// de uma busca e provavelmente vai pegar mais de um; ali o aviso é a própria
// linha, que fica marcada como concluída em vez de voltar ao estado inicial —
// era essa volta silenciosa que fazia parecer que nada tinha acontecido.
//
// Cada escolha vai para O SEU lugar, e só para ele. Até a v5.86 as três caíam
// no Cronograma, porque `addMedia` era quem escolhia a lista e ela era sempre
// "imports": pedir "Tocar agora" enchia a lista do culto de vídeo que o
// operador só quis ver uma vez. A lista de destino agora é decidida AQUI e
// entregue ao `addMedia`, que continua gravando registro e lista na mesma
// transação.
// (`YT_LISTA` e `YT_DESTINO_NOME` saíram na v5.141: eram uma segunda tabela de
// destinos, só para o YouTube, com os mesmos três nomes e as mesmas três listas
// da `DESTINOS`/`LISTA_ROTULO`. Duas tabelas divergiriam no primeiro destino que
// alguém acrescentasse a uma só — e o multi-destino precisava justamente de uma
// fonte única para montar a frase "adicionado à playlist e ao Cronograma".)

// Projeta um vídeo do YouTube SEM baixá-lo antes: o shell monta o manifesto das
// duas faixas adaptativas e o `MediaSource` do lado web as transforma num
// `<video>` comum (ver shared/mse.js).
//
// Devolve `true` quando assumiu a projeção. `false` significa "não deu" e o
// chamador segue para o download — não há nenhum aviso ao operador nesse
// caminho, de propósito: ele pediu o louvor, não o método, e um cartão dizendo
// "não deu para transmitir, vou baixar" seria ruído sobre uma decisão que não
// é dele.
// POR QUE a última tentativa de transmitir não entrou. Lido pelo Registro.
//
// Ele existe porque `tentarTransmitir` desiste em CINCO pontos e todos eram
// mudos: do lado do operador, "Tocar agora" simplesmente baixava, como sempre
// fizera, sem nada dizendo que uma transmissão tinha sido tentada. E o
// diagnóstico do shell não cobria estes casos — três deles acontecem ANTES de a
// ponte ser chamada.
let motivoStream = '';

async function tentarTransmitir(r, altura, somenteAudio) {
  const soAudio = !!somenteAudio;
  motivoStream = '';
  if (window.AVStream) window.AVStream.ultimoErro = '';
  if (!window.__NATIVE__) { motivoStream = 'navegador (sem ponte)'; return false; }
  const shell = window.__SHELL_VERSION__ | 0;
  // PISO 27, e não 26. Do shell 26 a transmissão está quebrada por construção —
  // a faixa ia no cabeçalho `Range` e o WebView aplicava o deslocamento uma
  // segunda vez sobre a fatia (ver o cabeçalho de `shared/mse.js`). Tentar ali
  // não é "tentar de graça": projeta uma cena que morre, abre a cortina sobre o
  // preto e ainda paga uma re-extração antes de finalmente baixar. Com o piso,
  // o download começa no primeiro toque.
  if (shell < 27) {
    motivoStream = 'shell ' + shell + ' — a transmissão exige 27 (instale o APK novo)';
    return false;
  }
  if (!window.AVStream) { motivoStream = 'shared/mse.js não carregou'; return false; }
  if (!r || !r.url) { motivoStream = 'resultado sem URL'; return false; }
  let man = null;
  try {
    man = await AVNative.ytStream(r.url, altura | 0);
  } catch (e) {
    motivoStream = 'a ponte falhou: ' + ((e && e.message) || '?');
    return false;
  }
  if (!man) { motivoStream = 'o shell não montou o manifesto (ver a linha "transmissão" abaixo)'; return false; }
  // SÓ ÁUDIO: a faixa de vídeo é DESCARTADA aqui, no lado web, e o shell não
  // precisa saber de nada. Ele já monta o par no mesmo manifesto, então pedir
  // "só o áudio" é jogar fora um descritor — não um segundo pedido, não uma
  // segunda extração, e sobretudo nenhum byte de 1080p baixado para nada. É por
  // isso que este recurso chega por OTA, sem APK novo.
  if (soAudio) man = Object.assign({}, man, { video: null, height: null });
  // O `suportado` é do APARELHO, não do manifesto: um WebView sem o codec
  // precisa cair no download em vez de projetar preto. E quando ele recusa, o
  // que interessa é QUAL string foi recusada — sem ela a informação é "não
  // deu", que não leva a lugar nenhum.
  if (!AVStream.suportado(man)) {
    const testar = (t) => {
      if (!t) return 'ausente';
      try { return MediaSource.isTypeSupported(t) ? 'ok' : 'RECUSADO'; } catch (_) { return 'erro'; }
    };
    const parte = (rotulo, faixa) => rotulo + ' [' + ((faixa && faixa.mime) || '—') + '] '
      + testar(faixa && faixa.mime);
    motivoStream = !window.MediaSource ? 'este WebView não tem MediaSource'
      : 'codecs recusados — ' + (soAudio ? '' : parte('vídeo', man.video) + ' · ')
        + parte('áudio', man.audio);
    return false;
  }
  const rec = await AVDB.addStreamMedia(man, {
    name: man.name || r.name || 'Vídeo',
    youtubeId: r.id || null,
    height: man.height || null,
    seconds: man.seconds || null,
    somenteAudio: soAudio,
    list: 'avulsos',
  });
  if (!rec) { motivoStream = 'o registro da mídia não foi criado'; return false; }
  motivoStream = soAudio ? 'transmitindo só o áudio' : 'transmitindo ' + (man.height || '?') + 'p';
  setYtEstado(r.id, null);
  await fixarAvulso(rec.id);
  await load();
  await send(rec.id);
  return true;
}

// A RECUPERAÇÃO quando um stream falha em cena.
//
// A causa esperada é a URL expirada: o manifesto vale algumas horas, e o
// registro pode ficar na prateleira mais que isso. Pedir um manifesto NOVO para
// o mesmo vídeo é barato (uma extração) e resolve o caso comum sem o operador
// saber que houve algo.
//
// Uma tentativa só: se a segunda também falhar, o problema não é a validade — é
// rede, codec ou um vídeo que ficou restrito —, e insistir num laço em cima de
// uma projeção morta é pior que parar. Aí a mídia é substituída pelo DOWNLOAD,
// que é o caminho que sempre funcionou.
const streamRetentado = new Set();
async function recuperarStream(rec, porque) {
  console.warn('[stream] falhou:', porque);
  if (!rec || !rec.youtubeId) {
    // Sem o vídeo de origem não há para onde cair, e insistir numa cena morta é
    // pior que assumir. Tira do telão e diz por quê.
    stopClear();
    return;
  }
  const link = 'https://www.youtube.com/watch?v=' + rec.youtubeId;
  // RE-EXTRAIR SÓ QUANDO A CAUSA É EXPIRAÇÃO, que é a única coisa que um
  // manifesto novo conserta — e ela se manifesta como 401/403 do googlevideo.
  // O discriminador já existia na mensagem desde a v5.124 (`HTTP n` × `a
  // requisição não completou`) e não era usado: qualquer falha pagava ~2 s de
  // extração para projetar uma SEGUNDA cena morta antes de baixar. São os dois
  // pares "play 0s / PAUSA ESPONTÂNEA 0s" da linha do tempo.
  const expirou = /HTTP 40[13]\b/.test(String(porque || ''));
  // A FORMA do registro manda em tudo o que vem abaixo: quem pediu só o áudio
  // não pode receber o vídeo de volta — nem no manifesto novo, nem no download
  // do fim da linha. É o mesmo reaproveitamento por forma do `ytArquivo`, e o
  // `kind` é o que separa as duas.
  const soAudio = rec.kind === 'audio';
  if (expirou && !streamRetentado.has(rec.id)) {
    streamRetentado.add(rec.id);
    let man = null;
    try { man = await AVNative.ytStream(link, rec.height | 0); } catch (_) {}
    if (man && soAudio) man = Object.assign({}, man, { video: null, height: null });
    if (man && window.AVStream && AVStream.suportado(man)) {
      await AVDB.setMediaStream(rec.id, man);
      if (currentId === rec.id) await send(rec.id);
      return;
    }
  }
  // O TELÃO SAI DA CENA MORTA ANTES DO DOWNLOAD, que leva minutos. Sem isto a
  // projeção fica no preto o tempo todo, com o operador sem saber se o app
  // ainda está fazendo alguma coisa — o wallpaper diz "nada em cena", que é a
  // verdade, e o aviso do download aparece na preview.
  if (currentId === rec.id) stopClear();
  // Fim da linha da transmissão: o vídeo vira ARQUIVO, que é o caminho de sempre.
  const novo = await ytArquivo(
    { id: rec.youtubeId, url: link, name: rec.name },
    { lista: 'avulsos', aviso: 'preview', somenteAudio: soAudio },
  );
  if (!novo) return;
  await fixarAvulso(novo.id);
  await AVDB.listRemove('avulsos', rec.id);
  await load();
  if (currentId === rec.id || !currentId) await send(novo.id);
}
// `destinos` é a LISTA de escolhas da folha — uma ou várias chaves de
// `DESTINOS`, mais o `tocar`, que não é lista nenhuma (v5.141). Uma string
// solta continua valendo: os chamadores de fora da folha (o link já no
// Cronograma) mandam um destino só, e escrever `['cronograma']` neles seria
// ruído.
async function ytAcao(r, destinos, btn, somenteAudio, altura) {
  const escolhas = [...new Set(typeof destinos === 'string' ? [destinos] : (destinos || []))];
  // Sem destino nenhum o download não teria dono e o item ficaria pendurado no
  // slot avulso, invisível — pior que o Cronograma, que é a lista à vista e de
  // onde se apaga com um toque. Não há caminho na UI que chegue aqui vazio; a
  // guarda existe para não haver.
  if (!escolhas.length) escolhas.push('cronograma');
  const tocar = escolhas.includes('tocar');
  // Os destinos que GUARDAM, na ordem da folha. `tocar` fica de fora: ele é o
  // telão, e o telão não é uma lista.
  const guardar = escolhas.filter((d) => d !== 'tocar');
  if (tocar) closeHymnSearch();
  setYtEstado(r.id, 'baixando');
  // O DOWNLOAD NASCE NA PRIMEIRA lista escolhida e é ESPALHADO para as demais
  // depois — o arquivo é um só, e o que muda entre os destinos é apenas em
  // quantos conjuntos de ids o mesmo registro aparece. Sem nenhum destino de
  // guarda (só "Tocar agora"), o slot avulso é quem segura os bytes, como
  // sempre.
  const listas = listasDosDestinos(guardar);
  const lista = listas[0] || 'avulsos';
  // "JÁ ESTAVA LÁ?" PRECISA SER PERGUNTADO AGORA, antes do download: um vídeo
  // novo NASCE na lista (o `addMedia` lá dentro já recebe o destino), então
  // perguntar depois anunciaria todo download novo como "já estava lá" — o
  // aviso mais confuso possível justamente no caminho mais demorado.
  // Só vale quando há arquivo no aparelho: é esse o registro que o `ytArquivo`
  // reaproveita. Um item de PLAYER (o link, sem bytes) não conta — dele sai um
  // registro novo, com id novo.
  // A FORMA escolhida no seletor do topo da folha (vídeo ou só áudio), que
  // chega por parâmetro porque a folha já fechou quando esta função roda. Ela
  // atravessa tudo o que vem abaixo: a pergunta "já está na lista?", o
  // reaproveitamento do arquivo e o download.
  const soAudio = !!somenteAudio;

  // TRANSMISSÃO DIRETA, e só em "Tocar agora" (v5.120).
  //
  // As outras três ações guardam o item para depois — playlist, Cronograma,
  // Favoritos —, e um manifesto de stream EXPIRA em algumas horas: guardar um
  // seria guardar algo que não abre no domingo. "Tocar agora" é o caso em que
  // o vídeo é visto uma vez, agora, e é exatamente onde esperar o download
  // inteiro dói mais.
  //
  // Falhando qualquer coisa — shell antigo, vídeo sem par adaptativo, WebView
  // sem o codec — o caminho segue para o download de sempre. Nada aqui é
  // caminho único.
  //
  // VALE TAMBÉM PARA "SÓ ÁUDIO" (v5.130). Ele ficava de fora porque a
  // transmissão nasceu como par vídeo+áudio, e o download de um m4a é rápido —
  // mas "rápido" não é o pedido: o pedido é NÃO ESPERAR. Um áudio de 8 MB ainda
  // são segundos de espera com o culto rodando, e a transmissão começa a tocar
  // com o primeiro fragmento, na casa dos kB.
  //
  // COMBINADO COM UM DESTINO DE GUARDA, a transmissão fica de fora: ela não
  // produz arquivo (é um manifesto que expira em horas), e o operador que
  // marcou "Cronograma" pediu justamente o que sobra depois do domingo. Aqui o
  // download é obrigatório, e projetar acontece no fim dele.
  if (tocar && !guardar.length && await tentarTransmitir(r, altura, soAudio)) return;

  const existente = r && r.id ? await AVDB.mediaByYoutube(r.id, soAudio ? 'audio' : 'video') : null;
  // "Já estava lá" é sobre o CONJUNTO: com mais de um destino, o que interessa
  // é se sobrou algo a fazer. Um vídeo que já está no Cronograma e não está nos
  // Favoritos não é uma duplicata — metade do pedido é nova.
  const listasNovas = [];
  for (const l of listas) {
    if (!(existente && existente.blob && await AVDB.listHas(l, existente.id))) listasNovas.push(l);
  }
  const jaNaLista = listas.length > 0 && listasNovas.length === 0;
  const rec = await ytArquivo(r, {
    lista,
    somenteAudio: soAudio,
    altura,
    naPreview: tocar,
    // O aviso na biblioteca só cala quando NENHUM destino é visível ali — e a
    // playlist é o único que não é. Com ela combinada ao Cronograma, o cartão
    // volta a valer.
    aviso: (guardar.length === 1 && guardar[0] === 'playlist') ? 'nenhum' : (tocar ? 'preview' : 'lib'),
    onPct: (pct) => setYtEstado(r.id, 'baixando', pct),
  });
  // FALAR QUANDO NÃO DEU. Até a v5.112 o download que falhava só apagava a
  // marca de "baixando" e sumia — nem item, nem erro, nem pista. Um download de
  // minutos que termina em nada é o pior silêncio possível do app, e ele valia
  // para todos os destinos, não só para o áudio.
  if (!rec) {
    // CANCELADO PELO OPERADOR não é falha: ele sabe o que aconteceu, porque
    // acabou de pedir. Pintar a linha de vermelho aqui seria o app discordando
    // de uma decisão dele.
    if (ytCancelados.has(r.id)) { ytCancelados.delete(r.id); setYtEstado(r.id, null); return; }
    // A FALHA FICA NA PRÓPRIA LINHA, não numa faixa flutuante (v5.119). O
    // estado `erro` pinta a miniatura do resultado — o mesmo canto que já
    // mostrava o anel de download e o ✓ de concluído. Ele é transitório: some
    // sozinho, e a linha volta a aceitar o toque, porque tentar de novo é
    // justamente o que se quer depois de uma falha de rede.
    setYtEstado(r.id, 'erro');
    setTimeout(() => { if ((ytEstado.get(r.id) || {}).estado === 'erro') setYtEstado(r.id, null); }, YT_ERRO_MS);
    pulsar(btn, 'erro');
    // SEM LINHA NA TELA, o vermelho não tem onde aparecer — é o caso do link
    // COMPARTILHADO (v5.137), que abre a folha sem busca nenhuma atrás. Aqui a
    // faixa de aviso é o único canal que resta ("flash" é no-op desde que o
    // toast saiu), e "um download de minutos que termina em nada" é o silêncio
    // que este app não pode ter.
    if (!ytLinhaVisivel(r.id)) avisar('Não deu para baixar "' + (r.name || 'o vídeo') + '".', 'erro');
    return;
  }
  setYtEstado(r.id, 'pronto');
  // O registro REAPROVEITADO pode estar em outra lista (ou só no slot avulso):
  // o download novo já nasceu na PRIMEIRA lista, mas nas outras não — e um
  // reaproveitado pode não estar em nenhuma. `listAdd` é idempotente, então o
  // laço vale para os dois casos sem perguntar qual é.
  if (guardar.length) {
    for (const l of listas) await AVDB.listAdd(l, rec.id);
    // Promovido a lista de verdade, sai do slot avulso — que existe só para
    // segurar o que não tem outro dono. A ordem importa: primeiro entra nas
    // listas novas, senão o `listRemove` coletaria o blob.
    await AVDB.listRemove('avulsos', rec.id);
    // SEM FAIXA DE AVISO NO FIM DO DOWNLOAD (v5.119). `responder` cai no
    // `avisar` quando o botão não está visível — e no caminho do YouTube ele
    // NUNCA está: a folha de destinos fecha antes da ação rodar. Ou seja, todo
    // download terminava numa faixa flutuante, que é exatamente o que este app
    // tirou de cena na v5.106.
    //
    // E ela não fazia falta: quem já responde é a MINIATURA do resultado, que
    // troca o anel de download pelo ✓ (`setYtEstado('pronto')`), e a linha que
    // aparece na lista de destino. O aviso repetia por escrito o que a tela
    // acabara de mostrar.
    //
    // O `pulsar` fica, e só ele: quando o botão POR ACASO está visível (a
    // conversão de um link já no Cronograma, que não passa por folha nenhuma),
    // o pulso é o feedback no lugar certo. Sem botão visível, silêncio — a
    // miniatura já falou.
    pulsar(btn, jaNaLista ? 'dup' : 'ok');
    // E o mesmo raciocínio no desfecho BOM. Sem linha na tela e sem botão
    // visível, os dois canais de sempre estão mudos — e o item pode ter ido
    // para a playlist ou os Favoritos, que não são a lista à vista. Uma frase
    // curta dizendo PARA ONDE ele foi é o que fecha o compartilhamento.
    if (!ytLinhaVisivel(r.id)) {
      const onde = juntarFrases((jaNaLista ? listas : listasNovas)
        .map((l) => (LISTA_ROTULO[l] || ROTULO_PADRAO).em));
      avisar((jaNaLista ? 'Já estava ' : 'Adicionado ') + onde + '.', jaNaLista ? 'dup' : 'ok');
    }
  } else {
    await fixarAvulso(rec.id);
  }
  if (listas.includes('playlist')) {
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
  }
  if (listas.includes('favs')) await recarregarFavoritos();
  await load();
  if (tocar) {
    // A mídia avulsa não está em `libItems` nem em `plItems`, então quem
    // resolve o nome dela é o `send` (que cai no `getMedia`).
    await send(rec.id);
  }
}

// Uma linha de resultado do YouTube. Mesma anatomia das linhas de música do
// acervo — miniatura à esquerda, nome e subtítulo — para a lista continuar
// sendo UMA lista, e não duas coladas.
function ytResultRow(r) {
  const li = document.createElement('li');
  li.className = 'lib-item hymn-result yt-result';
  li.dataset.yt = r.id;

  const row = document.createElement('div'); row.className = 'row hymn-row';
  const thumb = document.createElement('div'); thumb.className = 'thumb yt-thumb';
  if (r.thumb) {
    const im = document.createElement('img'); im.src = r.thumb; im.alt = ''; im.loading = 'lazy';
    thumb.appendChild(im);
  }
  const anel = document.createElement('span'); anel.className = 'dl-ring';
  anel.innerHTML = downloadArrowIconSvg();
  thumb.appendChild(anel);
  // O ✓ de concluído mora no mesmo lugar do anel: são os dois estados do mesmo
  // canto da miniatura, e a classe da linha decide qual aparece.
  const ok = document.createElement('span'); ok.className = 'yt-ok';
  ok.innerHTML = checkIconSvg();
  thumb.appendChild(ok);
  // E o TERCEIRO estado do mesmo canto: a falha. Ela morava numa faixa
  // flutuante no fim da tela, que foi para onde todo aviso deste app já não
  // vai — e o lugar certo é o mesmo em que o download foi anunciado.
  const err = document.createElement('span'); err.className = 'yt-err';
  err.innerHTML = closeIconSvg();
  thumb.appendChild(err);

  const info = document.createElement('div'); info.className = 'hymn-info';
  const nome = document.createElement('span'); nome.className = 'row-name';
  nome.textContent = r.name || '';
  const sub = document.createElement('span'); sub.className = 'hymn-sub';
  sub.textContent = [r.author, fmtDur(r.seconds)].filter(Boolean).join(' · ');
  info.append(nome, sub);

  const pct = document.createElement('span'); pct.className = 'dl-pct';
  row.append(thumb, info, pct);
  li.appendChild(row);
  pintarYtLinha(li, ytEstado.get(r.id));
  // O toque abre a MESMA folha de três escolhas das músicas do acervo — menos
  // no SIMPLIFICADO, onde ele toca e pronto: abrir uma folha com três opções
  // seria devolver ao operador exatamente a decisão que este modo poupa, e
  // duas delas (playlist, Cronograma) são listas que essa tela nem mostra. É a
  // mesma regra do toque numa música ali (`simplePlaySong`).
  li.addEventListener('click', () => {
    // BAIXANDO: o toque agora CANCELA (v5.131). Antes ele não fazia nada, e um
    // download começado por engano — o vídeo errado, o teto errado, a rede
    // ruim — só terminava esperando ele acabar. A confirmação existe porque o
    // toque nesta linha era inerte até ontem: quem tocar por reflexo não pode
    // perder um download de dez minutos por isso.
    if (li.classList.contains('baixando')) { cancelarDownloadYt(r); return; }
    // O teto vai EXPLÍCITO (`YT_ALTURAS[0]`, o padrão), como no share do
    // simplificado — deixá-lo implícito (undefined) fazia o mesmo "tocar"
    // viajar ora com altura, ora sem, e a diferença só aparecia em quem lê o
    // parâmetro lá na frente.
    if (appMode === 'simple') { ytAcao(r, 'tocar', null, false, YT_ALTURAS[0]); return; }
    openYtMenu(r);
  });
  return li;
}

// A mesma formatação de `fmtTime` — só a resposta ao zero difere: aqui a
// duração ausente vira string vazia (o subtítulo do resultado simplesmente
// não mostra nada), não "0:00".
function fmtDur(seg) {
  const n = Math.max(0, Math.floor(Number(seg) || 0));
  return n ? fmtTime(n) : '';
}

// O observador da sentinela de auto-busca. Um só, recriado a cada render — a
// lista é reconstruída a cada tecla, e um observador por render vazaria.
let ytAutoObs = null;
let ytAutoTimer = 0;
// A espera existe porque a lista é redesenhada A CADA TECLA: com poucos
// resultados o botão nasce visível, e sem ela a busca dispararia com o termo
// pela metade ("Fir"), uma vez por letra digitada. Meio segundo parado é o
// sinal de que o operador terminou de escrever.
const YT_AUTO_MS = 500;
function armarAutoBuscaYt(sentinela, termo) {
  if (ytAutoObs) { ytAutoObs.disconnect(); ytAutoObs = null; }
  clearTimeout(ytAutoTimer);
  // Nada a fazer se já pesquisou este termo, se está pesquisando, ou se o shell
  // não sabe pesquisar (ali o botão abre o YouTube por fora — disparar isso
  // sozinho seria tirar o operador do app sem ele ter pedido).
  if (ytBuscando || (ytBuscaItens && ytBuscaTermo === termo)) return;
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 18) return;
  ytAutoObs = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) { clearTimeout(ytAutoTimer); return; }
    clearTimeout(ytAutoTimer);
    ytAutoTimer = setTimeout(() => {
      // O termo pode ter mudado durante a espera — e aí esta busca é a de uma
      // pergunta que ninguém está mais fazendo.
      if (hymnSearchInputEl.value.trim() !== termo) return;
      if (!hymnSearchPopupEl.classList.contains('open')) return;
      buscarNoYoutube(termo);
    }, YT_AUTO_MS);
  }, { rootMargin: '0px' });
  ytAutoObs.observe(sentinela);
}

// Pede a busca ao shell e redesenha a lista com o resultado. No navegador (e
// num shell antigo) não há como pesquisar de dentro do app: ali o toque volta a
// ser o que sempre foi — abrir o YouTube por fora.
async function buscarNoYoutube(termo) {
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 18) {
    openYoutubeSearch(termo);
    return;
  }
  if (ytBuscando) return;
  ytBuscando = true;
  ytBuscaTermo = termo;
  ytBuscaItens = null;
  renderSearchResults(hymnSearchInputEl.value);
  try {
    const r = await AVNative.ytSearch(termo);
    ytBuscaItens = Array.isArray(r) ? r : [];
  } catch (_) {
    ytBuscaItens = [];
  } finally {
    ytBuscando = false;
    ytBuscaTermo = termo;
    renderSearchResults(hymnSearchInputEl.value);
  }
}

function openYoutubeSearch(termo) {
  const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(termo);
  if (!window.__NATIVE__) { window.open(url, '_blank', 'noopener'); return; }
  AVNative.openExternal(url);
}

// SVG inline (fora do subset da fonte): lupa. Deliberadamente NÃO é o logotipo
// do YouTube — o que este botão faz é uma BUSCA, e desenhar a marca de outro
// app num botão do nosso promete que ele abre lá dentro em algum lugar
// específico. Quem nomeia o destino é o texto ao lado.
function searchIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';
}

// Linha compacta: [▶] [nome / subtítulo] [+]. DOIS botões, e cada um abre uma
// folha rápida com as três escolhas que ele governa (ver openSongMenu): tocar
// (cantado / playback / só a letra) e adicionar (playlist / Cronograma /
// favoritos). O toque na LINHA continua sendo o acordeão da letra.
//
// Até a v5.62 as ações eram seis botões mudos que só apareciam com a linha
// aberta — dois grupos de três (Cantado e Playback), cada um com tocar,
// +Cronograma e +Playlist. Seis ícones dividindo a largura de um celular não
// cabem com rótulo, então nenhum tinha: a diferença entre "+ playlist" e
// "+ cronograma" era um desenho de 19px, e a escolha errada no meio do culto
// só aparecia depois. Dois alvos grandes e sempre à vista, com as opções
// ESCRITAS na folha, trocam seis adivinhações por duas leituras.
//
// O botão de tocar ocupa o lugar da miniatura. Ali havia um ícone decorativo
// (a mesma nota musical em todas as faixas do álbum) num quadrado de 46px — o
// maior alvo livre da linha, gasto com o único elemento que não informava nada.
// `semColecao` = a linha já está DENTRO do card da coleção (acordeão do
// acervo): repetir "Album 1" em cada uma das dez faixas é ruído.
function hymnResultRow(coll, s, lyricHit, semColecao) {
  const li = document.createElement('li');
  li.className = 'lib-item hymn-result';

  // A chave da linha: é por ela que o indicador de download reencontra esta
  // música depois de um redesenho (ver setSongRowBusy).
  const chave = songRowKey(coll, s);
  li.dataset.song = chave;

  const row = document.createElement('div'); row.className = 'row hymn-row';
  const play = document.createElement('button');
  play.className = 'hymn-play-thumb' + (songRowBusy.has(chave) ? ' busy' : '');
  play.title = 'Tocar "' + songLabel(coll, s) + '"';
  play.appendChild(msym(ICON.play));
  // O anel de download convive com o ▶ no mesmo botão: a classe `busy` troca
  // qual dos dois aparece. Montá-lo aqui, e não na hora, é o que faz a marca
  // sobreviver ao redesenho da lista (o progresso da sincronização redesenha o
  // acervo a cada 400 ms).
  const anel = document.createElement('span');
  anel.className = 'dl-ring'; anel.setAttribute('aria-hidden', 'true');
  anel.innerHTML = downloadArrowIconSvg();
  play.appendChild(anel);
  play.addEventListener('click', (e) => {
    e.stopPropagation();   // divide a linha com o acordeão da letra
    // No simplificado não há escolha: o toque toca o CANTADO. Abrir uma folha
    // com três opções seria devolver ao operador exatamente a decisão que este
    // modo poupa (é a mesma regra do toque na linha, abaixo).
    if (appMode === 'simple') { simplePlaySong(coll, s); return; }
    openSongMenu(coll, s, 'play');
  });

  const info = document.createElement('div'); info.className = 'hymn-info';
  const name = document.createElement('span'); name.className = 'row-name hymn-name';
  name.textContent = songLabel(coll, s);
  info.appendChild(name);
  // Subtítulo: a coleção de origem. A duração saiu daqui e virou coluna própria
  // à direita.
  if (!semColecao) {
    const sub = document.createElement('span'); sub.className = 'hymn-sub';
    sub.textContent = coll.name;
    info.appendChild(sub);
  }
  // Casou pela LETRA: mostra a linha. Sem ela, o resultado apareceria sem
  // nenhuma relação visível com o que foi digitado — e o operador não teria
  // como saber se é o hino certo sem abrir um por um.
  if (lyricHit) {
    const hit = document.createElement('span'); hit.className = 'hymn-lyric-hit';
    hit.textContent = lyricHit.length > 100 ? lyricHit.slice(0, 100) + '…' : lyricHit;
    info.appendChild(hit);
  }

  // A DURAÇÃO SAIU DA LINHA. Ela ocupava a coluna da direita — a única sobra de
  // largura numa linha de celular — para dizer "3:47", que não decide nada:
  // ninguém escolhe o louvor pelo tempo dele, e quem precisa do número o tem na
  // barra de progresso assim que a música entra. Esse lugar agora é do segundo
  // botão, que decide.
  const add = document.createElement('button');
  add.className = 'hymn-add-btn row-btn';
  add.title = 'Adicionar "' + songLabel(coll, s) + '" a uma lista';
  add.appendChild(msym(ICON.add));
  add.addEventListener('click', (e) => { e.stopPropagation(); openSongMenu(coll, s, 'add'); });

  row.append(play, info, add);

  // Letra completa, abaixo da linha. Só é montada quando a linha ABRE (e uma
  // vez só): montá-la para todos os resultados encheria a lista de centenas de
  // nós de texto que ninguém pediu — e a lista é reconstruída a cada tecla.
  const letra = document.createElement('div'); letra.className = 'hymn-lyrics';
  let letraMontada = false;
  let letraAlvo = null;   // a linha que casou com a busca, para rolar até ela
  async function montarLetra() {
    if (letraMontada) return;
    letraMontada = true;
    const estrofes = await songLyricStanzas(coll, s);
    letra.innerHTML = '';
    if (!estrofes) {
      const vazio = document.createElement('div');
      vazio.className = 'hymn-lyrics-empty';
      // Desde a v5.38 a letra cobre TODO o acervo, então a ausência passou a
      // significar sempre a mesma coisa: a fila do arranque ainda não chegou
      // nesta música (ou falhou). Duas mensagens diferentes sugeririam duas
      // causas diferentes onde só há uma.
      vazio.textContent = 'Letra ainda não baixada.';
      letra.appendChild(vazio);
      return;
    }
    const q = normalizeForSearch(hymnSearchInputEl.value).trim();
    let alvo = null;
    // Uma ESTROFE por bloco, com o rótulo ("Refrão") acima quando o banco o
    // traz. É a divisão que o operador enxerga no hinário e a que ele vai
    // projetar — trinta linhas seguidas eram um paredão em que não se acha
    // nada de relance.
    estrofes.forEach((est) => {
      const bloco = document.createElement('div');
      bloco.className = 'hymn-stanza';
      if (est.a) {
        const rot = document.createElement('div');
        rot.className = 'hymn-stanza-label';
        rot.textContent = est.a;
        bloco.appendChild(rot);
      }
      est.l.forEach((ln) => {
        const d = document.createElement('div');
        d.className = 'hymn-lyrics-line';
        d.textContent = ln;
        // A linha que casou com a busca fica marcada: o operador digitou um
        // trecho justamente para achá-lo, e numa letra de 30 linhas procurá-lo
        // de novo com os olhos é trabalho que o app pode poupar.
        if (q.length >= LYRIC_MIN_Q && normalizeForSearch(ln).includes(q)) {
          d.classList.add('hit');
          if (!alvo) alvo = d;
        }
        bloco.appendChild(d);
      });
      letra.appendChild(bloco);
    });
    // Rolar até ela só faz sentido com a caixa JÁ visível — e agora a letra é
    // montada antes de a linha abrir (a animação precisa medir a altura). Quem
    // rola é o chamador, depois de abrir.
    letraAlvo = alvo;
  }

  row.addEventListener('click', async () => {
    // No simplificado a linha TOCA (o cantado) — não abre letra nenhuma.
    if (appMode === 'simple') { simplePlaySong(coll, s); return; }
    const aberta = li.classList.contains('expanded');
    // Acordeão: abrir uma fecha a anterior — duas linhas abertas ao mesmo
    // tempo empurrariam a lista e tirariam do lugar o que o operador mira. O
    // escopo é a LISTA desta linha, não `hymnResultsEl`: as linhas de dentro do
    // card de um álbum vivem noutra `<ul>`, e ali a regra simplesmente não
    // valia — abrir a terceira faixa deixava as duas anteriores abertas.
    const lista = li.parentElement;
    if (lista) {
      lista.querySelectorAll(':scope > .hymn-result.expanded').forEach((el) => {
        if (el !== li) el.classList.remove('expanded');
      });
    }
    if (aberta) { collapseAccordion(letra, () => li.classList.remove('expanded')); return; }
    // A letra é montada ANTES de abrir: a animação mede a altura do que vai
    // ficar em cena, e uma caixa ainda vazia mediria zero.
    await montarLetra();
    li.classList.add('expanded');
    expandAccordion(letra);
    if (letraAlvo) letraAlvo.scrollIntoView({ block: 'center' });
  });

  li.append(row, letra);
  return li;
}

// ===== A folha rápida de uma música do acervo =====
// Dois botões na linha, duas folhas. Cada uma lista as três coisas que aquele
// botão pode fazer, ESCRITAS — é o que os seis ícones mudos da versão anterior
// não conseguiam dizer.
let songMenuFor = null;   // { coll, s, variant } — `variant` é a escolha da folha de adicionar

// ===== MARCAR MAIS DE UM DESTINO NA MESMA FOLHA (v5.141) =====
//
// A folha nasceu como "uma pergunta, uma resposta": cada linha era uma ação
// completa e o toque fechava tudo. O toque continua sendo isso — nada do que
// funcionava mudou de lugar —, mas cada linha de DESTINO ganhou uma caixa de
// marcação na borda direita.
//
// A regra é uma só, e vale para as duas folhas (acervo e YouTube):
//
//  - **Toque no corpo da linha** = executa AGORA, para aquele destino MAIS o
//    que já estiver marcado. É o caminho de um toque de sempre quando não há
//    nada marcado, e é o que fecha a escolha quando há: marcar "Playlist" e
//    tocar em "Cronograma" manda para os dois. Ignorar o que está marcado seria
//    o app desfazer, calado, uma escolha que o operador acabou de fazer.
//  - **Toque na caixa** = só marca (ou desmarca) e a folha CONTINUA aberta.
//  - Com pelo menos um marcado aparece a linha de confirmação no fim da folha,
//    para o caso em que todos os destinos desejados já estão marcados e não
//    sobrou nenhuma linha para tocar.
//
// O conjunto é da FOLHA ABERTA, não do item: ele nasce vazio a cada abertura,
// pelo mesmo motivo que o teto de resolução do YouTube nasce no padrão a cada
// item — uma marcação que grudasse mandaria para os Favoritos, sem aviso, o
// vídeo que se quis ver uma vez no domingo seguinte.
const destMarcados = new Set();
// Quem sabe EXECUTAR os destinos desta folha: `(chaves, btn) => Promise`. É
// definido por quem monta a folha (o acervo e o YouTube fazem coisas diferentes
// com a mesma lista de destinos) e lido pela linha de confirmação.
let destExecutor = null;

function destLimpar() { destMarcados.clear(); destExecutor = null; }

// A união do que está marcado com a linha em que se tocou, na ordem da tabela —
// para o aviso sair sempre na mesma ordem, e não na ordem em que o operador
// marcou.
function destUniao(chave) {
  const alvo = new Set(destMarcados);
  if (chave) alvo.add(chave);
  const ordem = DESTINOS.map((d) => d.chave).filter((c) => alvo.has(c));
  // Chaves que não estão na tabela (o `tocar` do YouTube) entram no fim: elas
  // não são lista nenhuma, e quem as trata é o executor.
  return ordem.concat([...alvo].filter((c) => !ordem.includes(c)));
}

function openSongMenu(coll, s, modo) {
  destLimpar();
  songMenuFor = { coll, s, variant: 'full' };
  songMenuTitleEl.textContent = songLabel(coll, s);
  renderSongMenu(modo);
  songMenuPopupEl.classList.add('open');
}

function closeSongMenu() {
  // A folha é reusada como SELETOR DE DESTINOS da importação (ver
  // `escolherDestinos`), e ali fechá-la é uma resposta — a promessa fica
  // pendente para sempre se ninguém a resolver. Fechar por ✕, pelo fundo ou
  // pelo botão voltar do aparelho entra todo aqui, então é aqui que a
  // desistência é dita.
  if (destPromptResolve) { fecharDestPrompt(null); return; }
  destLimpar();
  songMenuFor = null;
  songMenuPopupEl.classList.remove('open');
}

// A caixa de marcação de uma linha de destino. `stopPropagation` porque ela vive
// DENTRO do botão da linha: sem isso, marcar dispararia a ação da linha e a
// folha fecharia — o oposto exato do que a caixa existe para permitir.
function destCheck(chave, aoMudar) {
  const cx = document.createElement('span');
  cx.className = 'song-menu-check' + (destMarcados.has(chave) ? ' on' : '');
  cx.setAttribute('role', 'checkbox');
  cx.setAttribute('aria-checked', destMarcados.has(chave) ? 'true' : 'false');
  cx.title = destMarcados.has(chave) ? 'Marcado — tocar para desmarcar'
    : 'Marcar para enviar a mais de um destino';
  cx.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (destMarcados.has(chave)) destMarcados.delete(chave); else destMarcados.add(chave);
    aoMudar();
  });
  return cx;
}

// Uma linha da folha: ícone + rótulo + (às vezes) uma segunda linha explicando.
// `destino` (opcional) é a chave da tabela `DESTINOS`: com ela a linha ganha a
// caixa de marcação e a ação recebe a UNIÃO do marcado com esta linha.
function songMenuItem(icone, rotulo, sub, acao, destino, aoMudar) {
  const li = document.createElement('li');
  const btn = document.createElement('button'); btn.className = 'song-menu-btn';
  if (typeof icone === 'string') {
    const cx = document.createElement('span'); cx.className = 'song-menu-icon';
    cx.innerHTML = icone; btn.appendChild(cx);
  } else {
    icone.classList.add('song-menu-icon'); btn.appendChild(icone);
  }
  const txt = document.createElement('span'); txt.className = 'song-menu-text';
  const t = document.createElement('span'); t.className = 'song-menu-label'; t.textContent = rotulo;
  txt.appendChild(t);
  if (sub) {
    const d = document.createElement('span'); d.className = 'song-menu-sub'; d.textContent = sub;
    txt.appendChild(d);
  }
  btn.appendChild(txt);
  // A caixa só aparece para destino de TABELA. O "Tocar agora" do YouTube passa
  // por aqui com `destino = 'tocar'` para receber a união do que está marcado —
  // mas ele não é uma lista, e uma caixa nele ofereceria "marcar o telão".
  if (destino && destinoPorChave(destino)) btn.appendChild(destCheck(destino, aoMudar || (() => {})));
  // A variante escolhida no seletor do topo é LIDA AQUI e passada para a ação:
  // `closeSongMenu()` zera `songMenuFor`, e uma ação que fosse consultá-lo
  // depois disso encontraria null. Vale igual para os destinos marcados, que
  // `destLimpar()` zera no mesmo ponto.
  btn.addEventListener('click', () => {
    const variante = songMenuFor ? songMenuFor.variant : 'full';
    const alvos = destino ? destUniao(destino) : null;
    closeSongMenu();
    // O botão VAI com a ação mesmo assim: a folha fecha aqui (o download de uma
    // música ou de um vídeo leva de segundos a minutos, e uma folha aberta
    // durante isso é uma tela travada), então o `responder` cai na faixa de
    // aviso — mas se um dia alguma dessas ações deixar de fechar a folha, o
    // pulso passa a valer sem precisar lembrar de ligá-lo.
    acao(variante, btn, alvos);
  });
  li.appendChild(btn);
  return li;
}

// A linha de confirmação, no fim da folha e só com algo marcado. Ela existe
// para o caso em que já não há linha a tocar: marcados Playlist e Favoritos,
// tocar numa terceira linha acrescentaria um destino que ninguém pediu.
function destConfirmRow() {
  if (!destMarcados.size || !destExecutor) return null;
  const alvos = destUniao(null);
  const nomes = juntarFrases(alvos.map((c) => {
    const d = destinoPorChave(c);
    return d ? d.rotulo : c;
  }));
  const li = document.createElement('li');
  li.className = 'song-menu-go-row';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'song-menu-btn song-menu-go';
  const txt = document.createElement('span'); txt.className = 'song-menu-text';
  const t = document.createElement('span'); t.className = 'song-menu-label';
  t.textContent = alvos.length > 1 ? 'Enviar aos ' + alvos.length + ' destinos' : 'Enviar';
  const d = document.createElement('span'); d.className = 'song-menu-sub'; d.textContent = nomes;
  txt.append(t, d);
  btn.appendChild(txt);
  btn.addEventListener('click', () => {
    const variante = songMenuFor ? songMenuFor.variant : 'full';
    const exec = destExecutor;
    closeSongMenu();
    // A folha pode ter sido remontada por outra porta entre o desenho desta
    // linha e o toque nela; sem executor não há o que fazer, e uma exceção aqui
    // derrubaria o handler no meio de um culto.
    if (exec) exec(alvos, btn, variante);
  });
  li.appendChild(btn);
  return li;
}

// ===== A MESMA FOLHA, COMO PERGUNTA (importação e compartilhamento) =====
//
// Um arquivo importado ou compartilhado ia SEMPRE para o Cronograma, sem
// pergunta — a lista era escolhida no código (`destinoDoShare`). Para um louvor
// que se quer nos Favoritos, isso significava importar, achar o item na lista e
// marcá-lo à mão, um por um.
//
// Aqui a folha de destinos vira uma PERGUNTA: as mesmas três linhas marcáveis,
// o Cronograma já marcado (o destino de sempre, para quem só quer confirmar) e
// um botão que fecha. É a única porta em que a folha PRECISA de confirmação:
// nas outras cada linha é uma ação completa, e aqui não há ação nenhuma até o
// operador dizer para onde.
//
// **Desistir não perde o item.** Fechar por ✕, pelo fundo ou pelo voltar do
// aparelho resolve `null`, e quem chamou importa no destino padrão — a mesma
// regra do link compartilhado, que "nunca se perde".
let destPromptResolve = null;

function fecharDestPrompt(valor) {
  const r = destPromptResolve;
  destPromptResolve = null;
  destLimpar();
  songMenuFor = null;
  songMenuPopupEl.classList.remove('open');
  if (r) r(valor);
}

function escolherDestinos(titulo, padrao) {
  // No simplificado não existe Cronograma nem playlist: perguntar por listas que
  // a tela não tem seria pior que não perguntar (a mesma regra do link
  // compartilhado ali). Quem chama já sabe disso, mas a guarda fica: uma folha
  // aberta sobre a tela bloqueada não teria como ser respondida.
  if (simplificado()) return Promise.resolve(null);
  return new Promise((resolve) => {
    destPromptResolve = resolve;
    destLimpar();
    (padrao && padrao.length ? padrao : ['cronograma']).forEach((c) => destMarcados.add(c));
    songMenuFor = { destPrompt: true };
    songMenuTitleEl.textContent = titulo;
    renderDestPrompt();
    songMenuPopupEl.classList.add('open');
  });
}

const DEST_ICONE = { playlist: 'queue', cronograma: 'cronoAdd', favoritos: 'star' };

function renderDestPrompt() {
  songMenuListEl.innerHTML = '';
  const remontar = () => renderDestPrompt();
  DESTINOS.forEach((d) => {
    // Linhas PRÓPRIAS, e não `songMenuItem`: lá o corpo da linha EXECUTA e fecha
    // a folha, e aqui não há ação nenhuma por trás dele — a linha inteira marca,
    // que é o alvo que uma lista de opções pede. Reusar aquela função com uma
    // ação vazia deixaria a folha fechando a cada marcação.
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'song-menu-btn';
    // Mesma montagem do `songMenuItem`: a classe vai NO glifo, senão a escala
    // de `.song-menu-icon.msym` não o alcança e o ícone sai menor que o das
    // outras folhas.
    const ic = msym(ICON[DEST_ICONE[d.chave]] || ICON.add);
    ic.classList.add('song-menu-icon');
    const txt = document.createElement('span'); txt.className = 'song-menu-text';
    const t = document.createElement('span'); t.className = 'song-menu-label'; t.textContent = d.rotulo;
    const sub = document.createElement('span'); sub.className = 'song-menu-sub'; sub.textContent = d.sub;
    txt.append(t, sub);
    // A caixa é a MESMA das outras folhas — ela para o borbulhar, então o
    // listener da linha não roda duas vezes quando o toque cai exatamente nela.
    btn.append(ic, txt, destCheck(d.chave, remontar));
    btn.addEventListener('click', () => {
      if (destMarcados.has(d.chave)) destMarcados.delete(d.chave); else destMarcados.add(d.chave);
      remontar();
    });
    li.appendChild(btn);
    songMenuListEl.appendChild(li);
  });
  const li = document.createElement('li');
  li.className = 'song-menu-go-row';
  const go = document.createElement('button');
  go.type = 'button'; go.className = 'song-menu-btn song-menu-go';
  const txt = document.createElement('span'); txt.className = 'song-menu-text';
  const t = document.createElement('span'); t.className = 'song-menu-label';
  const escolhidos = destUniao(null);
  t.textContent = escolhidos.length ? 'Importar' : 'Escolha um destino';
  const sub = document.createElement('span'); sub.className = 'song-menu-sub';
  sub.textContent = juntarFrases(escolhidos.map((c) => (destinoPorChave(c) || {}).rotulo || c));
  txt.append(t, sub);
  go.appendChild(txt);
  go.disabled = !escolhidos.length;
  go.addEventListener('click', () => fecharDestPrompt(escolhidos));
  li.appendChild(go);
  songMenuListEl.appendChild(li);
}

function renderSongMenu(modo) {
  // A folha é compartilhada com os resultados do YouTube (`openYtMenu`) e com o
  // seletor de destinos da importação (`escolherDestinos`), que não têm
  // `coll`/`s` — e o seletor de variante do topo chama isto de volta.
  if (!songMenuFor || songMenuFor.yt || songMenuFor.destPrompt) return;
  const { coll, s } = songMenuFor;
  const temPlayback = !!s.has_instrumental_music;
  songMenuListEl.innerHTML = '';

  if (modo === 'play') {
    songMenuListEl.appendChild(songMenuItem(voiceIconSvg(), 'Tocar música cantada', '',
      () => playSongVariant(coll, s, 'full')));
    if (temPlayback) {
      songMenuListEl.appendChild(songMenuItem(noteIconSvg(), 'Tocar playback', 'Instrumental, sem a voz',
        () => playSongVariant(coll, s, 'playback')));
    }
    // "Só a letra" NÃO é uma variante de áudio: nenhum arquivo é tocado (nem
    // precisa estar baixado — a letra vem do acervo de letras). É por isso que
    // ela mora aqui e não numa terceira variante de `playSongVariant`.
    songMenuListEl.appendChild(songMenuItem(lyricsOnlyIconSvg(), 'Apenas a letra',
      'Sem música e sem passagem automática de slides',
      () => projectSongLyricsOnly(coll, s)));
    return;
  }

  // Adicionar. A escolha Cantada/Playback vira um seletor no topo em vez de
  // dobrar a lista de destinos: com playback, seis linhas diriam três coisas.
  // Sem playback ele nem aparece — não há o que escolher.
  if (temPlayback) {
    // O MESMO `ytSegRow` das folhas do YouTube — é a função que existe para
    // este desenho ("escrevê-lo duas vezes era garantir que a segunda
    // divergisse"), e esta era a segunda cópia.
    songMenuListEl.appendChild(ytSegRow(
      [['full', 'Cantada'], ['playback', 'Playback']],
      songMenuFor.variant,
      (v) => { songMenuFor.variant = v; renderSongMenu('add'); }));
  }

  // OS TRÊS DESTINOS SÃO MARCÁVEIS (v5.141): o toque na linha continua sendo a
  // ação completa de um toque só, e a caixa da borda acumula — a mesma música
  // vai para a playlist E para os Favoritos sem refazer a busca. O executor é o
  // mesmo dos três, porque a diferença entre eles sempre foi só a lista.
  const remontar = () => renderSongMenu('add');
  destExecutor = (alvos, btn, vr) => addSongToDestinos(coll, s, vr, alvos, btn);
  songMenuListEl.appendChild(songMenuItem(msym(ICON.queue), 'Adicionar à playlist',
    'Entra na fila do que está tocando agora',
    (vr, btn, alvos) => addSongToDestinos(coll, s, vr, alvos, btn), 'playlist', remontar));
  songMenuListEl.appendChild(songMenuItem(msym(ICON.cronoAdd), 'Adicionar ao Cronograma',
    'A lista do culto',
    (vr, btn, alvos) => addSongToDestinos(coll, s, vr, alvos, btn), 'cronograma', remontar));
  // "Escolha o atalho" saiu do subtítulo (v5.103): favoritar virou o ato
  // simples, sem seletor no meio. Organizar em atalho continua possível — pela
  // seleção múltipla, dentro da gaveta, para quem tem muita coisa marcada.
  songMenuListEl.appendChild(songMenuItem(msym(ICON.star), 'Favoritar',
    'O que se usa toda semana, sempre à mão',
    (vr, btn, alvos) => addSongToDestinos(coll, s, vr, alvos, btn), 'favoritos', remontar));
  // A LETRA como cena de roteiro: entra no Cronograma sem baixar áudio nenhum,
  // e projetá-la é o mesmo "Apenas a letra" da folha de tocar. É o item de
  // roteiro mais pedido depois do versículo — o hino que a congregação canta a
  // capela, ou o que toca da mesa de som enquanto o telão mostra a letra.
  songMenuListEl.appendChild(songMenuItem(lyricsOnlyIconSvg(), 'Só a letra, no Cronograma',
    'Sem baixar a música',
    (vr, btn) => addLyricCue(coll, s, btn)));
  // SEM caixa de marcação: a letra não é o mesmo item em outra lista, é OUTRO
  // item (uma cena de roteiro, sem áudio). Misturá-la aos destinos faria um
  // toque criar duas coisas diferentes de uma vez.
  const go = destConfirmRow();
  if (go) songMenuListEl.appendChild(go);
}

// Cena de roteiro da LETRA de uma música do acervo.
async function addLyricCue(coll, s, btn) {
  const rec = await criarCue('songlyrics',
    { collId: coll.id, songId: s.id_music },
    songLabel(coll, s), 'imports', btn);
  if (!rec) responder(btn, 'erro', 'Não foi possível adicionar');
}

// A seta de download dentro do `.dl-ring` — o mesmo desenho que o `#pvBusy`
// traz no HTML. (Aqui precisa ser JS: a linha é construída em tempo de
// execução.) Fora do subset da fonte, como a de `downloadAllIconSvg`.
function downloadArrowIconSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 4v9"/><polyline points="8 9.5 12 13.5 16 9.5"/>'
    + '<path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>'
    + '</svg>';
}

// ===== "Baixando" na LINHA da música =====
// Contador por música, não booleano: dois pedidos para a mesma faixa (adicionar
// à playlist e, em seguida, ao Cronograma) não podem fazer o primeiro a
// terminar apagar a marca do outro.
const songRowBusy = new Map();
function songRowKey(coll, s) { return coll.id + ':' + s.id_music; }

// O estado vive no Map, e não só na classe do botão, porque a lista do acervo é
// RECONSTRUÍDA durante o download (o progresso da sincronização redesenha a
// cada 400 ms): uma classe escrita no nó some no redesenho seguinte, e a linha
// voltava a mostrar ▶ com o download ainda correndo. `hymnResultRow` relê o
// Map ao montar; esta função cuida das linhas que já estão na tela.
function setSongRowBusy(coll, s, on) {
  const key = songRowKey(coll, s);
  const n = (songRowBusy.get(key) || 0) + (on ? 1 : -1);
  if (n > 0) songRowBusy.set(key, n); else songRowBusy.delete(key);
  const ligado = songRowBusy.has(key);
  // Comparação por `dataset`, sem seletor de atributo: a chave carrega `:` e
  // `-`, e montar um seletor a partir de dado é o tipo de coisa que quebra
  // calada no dia em que um id novo trouxer outro caractere.
  document.querySelectorAll('.hymn-result').forEach((li) => {
    if (li.dataset.song !== key) return;
    const btn = li.querySelector('.hymn-play-thumb');
    if (btn) btn.classList.toggle('busy', ligado);
  });
}

// SVG inline de "só a letra" (linhas de texto). O Material Symbols embarcado é
// um SUBCONJUNTO: um glifo que não foi incluído sai como retângulo vazio.
function lyricsOnlyIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="11" x2="16" y2="11"/>'
    + '<line x1="4" y1="16" x2="20" y2="16"/><line x1="4" y1="21" x2="12" y2="21"/>'
    + '</svg>';
}

// Verifica quais variantes de uma música ainda precisam ser baixadas: o
// arquivo não existe no catálogo (nunca baixado ou apagado por fora) OU existe
// mas ainda não tem a letra sincronizada (`lyrics === undefined` → backfill sem
// rebaixar o áudio). Regra única usada pela sincronização em massa e pelo
// download sob demanda.
async function songVariantsNeeded(coll, s) {
  // As duas leituras em paralelo: são independentes, e em série cada música
  // pagava duas idas ao IDB uma atrás da outra — multiplicado pela varredura
  // de um hinário inteiro (ver o laço de `syncCollection`).
  const [fullRec, playbackRec] = await Promise.all([
    s.fileIdFull ? AVDB.fileGet(s.fileIdFull) : null,
    s.fileIdPlayback ? AVDB.fileGet(s.fileIdPlayback) : null,
  ]);
  // `semAudio`/`semPlayback`: a origem NÃO TEM essa variante (v5.134). Sem essa
  // ressalva a música ficava pendente para sempre — cada sincronização buscava
  // o `music_{id}` dela de novo, só para redescobrir que não há URL, e o álbum
  // nunca chegava a "Já completo offline". A marca é apagada assim que uma URL
  // aparece (ver `ensureSongVariant`), então uma faixa que a origem publicar
  // depois volta sozinha para a fila.
  return {
    needsFull: !s.semAudio && (!fullRec || fullRec.lyrics === undefined),
    needsPlayback: !!(s.has_instrumental_music && !s.semPlayback
      && (!playbackRec || playbackRec.lyrics === undefined)),
  };
}

// Baixa uma música sob demanda ("conforme o uso") — diferente da sincronização
// em massa (gated por Wi-Fi), um download disparado por tocar/adicionar é
// sempre permitido, mesmo em dados móveis: é exatamente a música que o operador
// pediu pra usar, nunca o acervo inteiro de uma vez. Reaproveita
// downloadCollectionSong — a música sai já com áudio, capa e letra, pronta pra
// tocar 100% offline nas próximas vezes.
// `opts.toast === false` cala o aviso na tela principal — é o que o caminho de
// TOCAR usa desde a v5.64, porque ali quem anuncia o download é o indicador na
// miniatura da preview (ver `previewBusy`). Os caminhos de ADICIONAR seguem com
// o aviso (`avisar` — o flash é no-op desde que o toast saiu): eles não mexem
// na preview, e sem ele o toque ficaria mudo. A faixa é transitória e some
// sozinha, então ninguém precisa "fechá-la" no fim do download.
async function ensureSongDownloaded(coll, s, opts) {
  const { needsFull, needsPlayback } = await songVariantsNeeded(coll, s);
  if (!needsFull && !needsPlayback) return;

  // A LINHA da música mostra que ela está baixando. A marca é acesa AQUI, e não
  // no chamador, porque este é o único ponto que já sabe que existe download de
  // verdade: acendê-la antes da checagem acima faria a miniatura piscar em toda
  // música que já está no aparelho — e um indicador que pisca lê-se como falha.
  // Como consequência, todo caminho que baixa sob demanda ganha a marca sem
  // precisar lembrar dela.
  setSongRowBusy(coll, s, true);
  try {
    const key = coll.id + ':' + s.id_music;
    if (songDownloadInFlight.has(key)) { await songDownloadInFlight.get(key); return; }
    const p = withBgWork(async () => {
      if (!opts || opts.toast !== false) avisar('Baixando "' + s.name + '"…');
      await downloadCollectionSong(coll, s);
      await AVDB.setState('coll:' + coll.id, collState[coll.id]);
      refreshCollectionsIfVisible();
    });
    songDownloadInFlight.set(key, p);
    try { await p; } finally { songDownloadInFlight.delete(key); }
  } finally {
    setSongRowBusy(coll, s, false);
  }
}

async function resolveSongMediaId(coll, s, variant, opts) {
  await ensureSongDownloaded(coll, s, opts);
  const fileId = variant === 'full' ? s.fileIdFull : s.fileIdPlayback;
  if (!fileId) return null;
  const rec = await AVDB.fileGet(fileId);
  return rec ? fileId : null;
}

// Toca a versão CANTADA direto (modo simplificado). Se a música ainda não
// estiver no aparelho, pergunta ANTES de gastar internet — uma vez só: quem
// respondeu "baixar" já disse como quer que o app se comporte, e repetir a
// pergunta a cada música viraria ruído no meio do culto.
async function simplePlaySong(coll, s) {
  const { needsFull } = await songVariantsNeeded(coll, s);
  if (needsFull && !(await ensureDownloadConsent())) return;
  playSongVariant(coll, s, 'full');
}

// Persistido em `state.downloadOk`: a resposta vale para as próximas sessões
// também — "só aparece na primeira vez" seria falso se voltasse toda semana.
let downloadConsent = false;
async function ensureDownloadConsent() {
  if (downloadConsent) return true;
  const ok = await appConfirm({
    title: 'Baixar a música?',
    message: 'Esta música ainda não está no aparelho. Baixar agora usa a internet '
      + '(Wi-Fi ou dados móveis).\n\nEsta pergunta aparece só desta vez.',
    okText: 'Baixar',
    cancelText: 'Agora não',
  });
  if (!ok) return false;
  downloadConsent = true;
  await AVDB.setState('downloadOk', true);
  return true;
}

// ===== "Baixando…" na preview =====
// Tocar uma música que ainda não está no aparelho abre um download de dezenas
// de segundos. Até a v5.63 o toque não mudava NADA na tela: o acervo continuava
// aberto na mesma lista e o único sinal era um toast na tela principal, atrás
// do popup. Do lado de quem opera, "toquei e não aconteceu nada" — e o reflexo
// é tocar de novo.
//
// A correção tem duas metades, e a primeira é a que resolve o problema: a
// resposta ao toque é IMEDIATA e igual à de uma música já baixada — o acervo
// fecha na hora. A segunda diz o que está acontecendo, e diz **na miniatura da
// preview**: é ali que a mídia vai aparecer, então é ali que se anuncia que ela
// está a caminho. Um aviso na tela principal seria mais um cartaz avulso a
// interpretar; na preview a espera vira estado do próprio destino.
const PV_BUSY_DELAY_MS = 180;
let pvBusyCount = 0;
let pvBusyTimer = null;

// Devolve `{ visivel, soltar }`. `visivel` é falso no simplificado, onde a
// preview não está na tela — ali quem avisa continua sendo o toast, e é por
// isso que o chamador precisa saber.
// ===== "Baixando" NA LINHA DO CRONOGRAMA =====
//
// O cartão sobre a preview diz "isto vai entrar em cena". É a mensagem certa
// quando o toque foi TOCAR — e a errada quando ele foi só ADICIONAR: um vídeo
// compartilhado que apenas entra na lista não vai ao telão a seguir, e anunciar
// o download ali insinua o contrário. A regra passa a ser (v5.84): **o aviso
// mora onde o resultado vai aparecer.**
//
// Aqui o resultado é uma linha do Cronograma — só que ela ainda NÃO EXISTE
// enquanto o arquivo baixa. Por isso a linha é criada provisória: o operador vê
// o item entrar na lista na hora, com o anel e o percentual, e ele vira o item
// de verdade quando os bytes chegam. É a mesma ideia do `setSongRowBusy` no
// acervo, com um passo a mais porque lá a linha já existia.
//
// A chave é o ID DA MÍDIA quando ela já existe (o botão de converter um item de
// player), e uma chave provisória quando não existe (um link recém-chegado).
const libBaixando = new Map();

function libBusy(nome, chaveExistente) {
  const chave = chaveExistente || ('dl:' + Math.random().toString(36).slice(2, 9));
  libBaixando.set(chave, { nome: nome || 'Baixando…', pct: -1 });
  if (activeTab === 'imports') load();
  let solto = false;
  return {
    visivel: true,
    atualizar(_acao, _nome, pct) {
      const r = libBaixando.get(chave);
      if (!r || solto) return;
      r.pct = typeof pct === 'number' ? pct : r.pct;
      // Repinta SÓ o texto, sem refazer a lista: o percentual chega a cada
      // megabyte, e um `load()` por atualização reconstruiria dezenas de linhas
      // (com object URLs de miniatura) enquanto o operador rola a lista.
      document.querySelectorAll('.lib-item').forEach((li) => {
        if (li.dataset.dl !== chave) return;
        const t = li.querySelector('.dl-pct');
        if (t) t.textContent = r.pct >= 0 ? r.pct + '%' : '';
      });
    },
    soltar() {
      if (solto) return;
      solto = true;
      libBaixando.delete(chave);
      if (activeTab === 'imports') load();
    },
  };
}

// A linha provisória: mesma anatomia de uma linha de mídia (miniatura + nome),
// com o anel no lugar da miniatura — que é justamente o que ela ainda não tem.
function libBusyRow(chave, reg) {
  const li = document.createElement('li');
  li.className = 'lib-item baixando';
  li.dataset.dl = chave;
  const row = document.createElement('div'); row.className = 'row';
  const t = document.createElement('div'); t.className = 'thumb thumb--icon';
  const anel = document.createElement('span'); anel.className = 'dl-ring';
  anel.innerHTML = downloadArrowIconSvg();
  t.appendChild(anel);
  const nome = document.createElement('span'); nome.className = 'row-name';
  nome.textContent = reg.nome;
  const pct = document.createElement('span'); pct.className = 'dl-pct';
  pct.textContent = reg.pct >= 0 ? reg.pct + '%' : '';
  row.append(t, nome, pct);
  li.appendChild(row);
  return li;
}

function previewBusy(acao, nome) {
  // No simplificado a preview só está na tela com um telão conectado (ver
  // hostPreview/`.simple.locked`); bloqueado, quem avisa continua sendo o
  // toast — é por isso que o chamador precisa saber.
  if (appMode === 'simple' && !simpleDisplay()) return { visivel: false, atualizar: () => {}, soltar: () => {} };
  pvBusyCount++;
  pvBusyCapEl.textContent = acao;
  pvBusyLabelEl.textContent = nome;
  // Só acende depois de um respiro: uma música JÁ baixada resolve em poucos
  // milissegundos, e um cartão que pisca é pior que nenhum — lê-se como falha.
  if (!pvBusyTimer && !pvBusyEl.classList.contains('on')) {
    pvBusyTimer = setTimeout(() => {
      pvBusyTimer = null;
      if (pvBusyCount > 0) pvBusyEl.classList.add('on');
    }, PV_BUSY_DELAY_MS);
  }
  let solto = false;
  return {
    visivel: true,
    // Reescreve a legenda sem abrir um cartão novo — é por aqui que o
    // percentual de um download longo aparece. Com dois downloads ao mesmo
    // tempo o último a escrever ganha, exatamente como já acontecia quando os
    // dois chamavam `previewBusy`.
    // O 3º parâmetro (percentual) existe só para a assinatura bater com a de
    // `libBusy`: aqui quem mostra o número é o próprio texto da legenda.
    atualizar(acaoNova, nomeNovo) {
      if (solto) return;
      pvBusyCapEl.textContent = acaoNova;
      if (nomeNovo != null) pvBusyLabelEl.textContent = nomeNovo;
    },
    // Contado, e não um booleano: o operador pode disparar dois downloads
    // (tocar um hino e, enquanto ele baixa, projetar a letra de outro) — o
    // primeiro a terminar não pode apagar o indicador do outro.
    soltar() {
      if (solto) return;
      solto = true;
      pvBusyCount = Math.max(0, pvBusyCount - 1);
      if (pvBusyCount) return;
      clearTimeout(pvBusyTimer); pvBusyTimer = null;
      pvBusyEl.classList.remove('on');
    },
  };
}

async function playSongVariant(coll, s, variant) {
  // A RESPOSTA VEM PRIMEIRO. Fechar o acervo aqui, e não depois do download, é
  // o que faz o toque parecer ter funcionado — que é exatamente o que ele fez.
  closeSongMenu();
  closeHymnSearch();
  const bg = previewBusy('Baixando', songLabel(coll, s));
  try {
    // Dois avisos para o mesmo download é ruído: com o indicador na preview, a
    // faixa de aviso sai de cena.
    const id = await resolveSongMediaId(coll, s, variant, { toast: !bg.visivel });
    if (!id) { avisar('Não foi possível tocar (sem internet para baixar)', 'erro'); return; }
    const rec = await AVDB.getMedia(id);
    if (!rec) { avisar('Erro ao carregar mídia', 'erro'); return; }
    await replacePlaylistWith(rec);
    await send(id);
  } finally {
    bg.soltar();
  }
}

// Os três caminhos de ADICIONAR passam `toast: false` pelo mesmo motivo que o
// de tocar: quem anuncia o download é o indicador — aqui, a miniatura da linha
// da música (`setSongRowBusy`), que fica à vista porque o acervo continua
// aberto de propósito. O aviso que sobra é o do RESULTADO ("Adicionado à
// playlist"), que é outra informação.
async function addSongVariant(coll, s, variant, btn) {
  return addSongToDestinos(coll, s, variant, ['cronograma'], btn);
}

// UM download, VÁRIAS listas (v5.141). O caro aqui é `resolveSongMediaId` — ele
// baixa o áudio quando ele ainda não está no aparelho —, e o item resultante é
// o MESMO id em todas as listas. Fazer a conta uma vez e distribuir depois é a
// diferença entre esperar um download e esperar três para a mesma música.
async function addSongToDestinos(coll, s, variant, destinos, btn) {
  const alvos = (destinos && destinos.length) ? destinos : ['cronograma'];
  const id = await resolveSongMediaId(coll, s, variant, { toast: false });
  if (!id) { avisar('Não foi possível adicionar (sem internet para baixar)', 'erro'); return; }
  await adicionarNasListas(listasDosDestinos(alvos), id, songLabel(coll, s), btn);
  // Cada destino redesenha o que ele mudou, e só isso: os Favoritos aparecem na
  // estrela de cada linha do acervo, e o Cronograma só precisa ser remontado se
  // ele for a lista em cena.
  if (alvos.includes('favoritos')) renderLibrary();
  if (alvos.includes('cronograma') && activeTab === 'imports' && !currentFolder) load();
}

// (`addSongToFavorites` e `addSongToPlaylist` saíram na v5.141: eram três
// funções que diferiam APENAS na lista de destino, e o multi-destino as
// unificou em `addSongToDestinos`. Favoritar uma música do acervo continua
// BAIXANDO o arquivo, e isso é deliberado: um favorito é o que se usa toda
// semana, e o que o operador espera dele num domingo de manhã é que ele TOQUE —
// inclusive com a rede da igreja fora do ar. Um marcador que só guardasse a
// referência seria mais barato de criar e falharia justamente na hora em que ele
// é usado.)

// ===== transições (fade in/out) =====
function openFadePopup() {
  renderAppModeSeg();
  renderStandaloneSeg();
  renderFitSeg();
  renderRotBtn();
  renderLyricsBgSeg();
  renderWallSeg();
  // O estado do espelho é relido ao ABRIR (e depois só enquanto a folha dele
  // estiver aberta): a linha precisa dizer a verdade no instante em que o
  // operador olha para ela, e o espelho pode ter saído do ar sozinho por uma
  // falha nomeada desde a última vez.
  lerEspelho();
  pedirDiag();
  fadePopupEl.classList.add('open');
}
function closeFadePopup() {
  fadePopupEl.classList.remove('open');
}

// ===== A caixa-preta do telão, lida em Configurações =====
// Ver o comentário de `diag()` em display.js: é a única janela para o que
// acontece com a projeção enquanto o celular está fora da frente — não há
// console, não há logcat, e este WebView está estrangulado justamente nesse
// intervalo. O despejo é pedido ao ABRIR esta tela, não continuamente: o telão
// guarda o anel dele e entrega quando alguém pergunta.
let diagLinhas = [];

// O CONTROLE TEM O PRÓPRIO ANEL, e ele é o que importa no modo MESA DE SOM: ali
// quem toca é o `<video>` desta página, não o do telão — o registro do Display
// não veria nada. Foi exatamente essa distinção que faltou nas tentativas
// anteriores.
const DIAG_MAX_C = 40;
const diarioC = [];
function diagC(ev, extra) {
  diarioC.push(Object.assign({
    t: Date.now(), ev, oculto: document.visibilityState !== 'visible', onde: 'celular',
  }, extra || {}));
  if (diarioC.length > DIAG_MAX_C) diarioC.shift();
}
document.addEventListener('visibilitychange', () => diagC('visibilidade'));
window.addEventListener('freeze', () => diagC('congelou'));
window.addEventListener('resume', () => diagC('descongelou'));
(function vigiarPreview() {
  const v = document.getElementById('pvVideo') || document.querySelector('#preview video');
  if (!v) return;
  v.addEventListener('pause', () => diagC(pausaPedida() ? 'pausa (comando)' : 'PAUSA ESPONTÂNEA',
    { t2: Math.round(v.currentTime || 0) }));
  v.addEventListener('play', () => diagC('play', { t2: Math.round(v.currentTime || 0) }));
})();
// Uma pausa é "comandada" se o operador tocou em algo nos últimos instantes.
let pausaEm = 0;
function pausaPedida() { return Date.now() - pausaEm < 500; }

// O QUE ESTE APARELHO É — o cabeçalho do registro.
//
// Ele existe porque um log colado sem contexto obriga a primeira resposta a ser
// sempre a mesma pergunta ("qual versão? tem transmissão?"). Todo campo aqui é
// coisa que só o aparelho sabe e que muda a leitura do resto.
function cabecalhoDiag() {
  const l = [];
  l.push('Web v' + WEB_VERSION
    + (window.__SHELL_NAME__ ? ' · Shell v' + window.__SHELL_NAME__ : ' · navegador')
    + (window.__NATIVE__ ? ' · ponte ' + (window.__SHELL_VERSION__ | 0) : ''));
  if (displayStatusTextEl) l.push('Telão: ' + (displayStatusTextEl.textContent || '?'));
  if (castTargetLineEl && !castTargetLineEl.hidden) l.push(castTargetLineEl.textContent);
  // SUPORTE A TRANSMISSÃO DIRETA. É o dado mais útil deste bloco desde a
  // v5.120: quando um "Tocar agora" cai no download em vez de transmitir, a
  // primeira pergunta é se o WebView deste aparelho aceita os codecs — e a
  // resposta não se descobre de fora.
  l.push('Transmissão: ' + diagMse());
  // A ATUALIZAÇÃO QUE ESPERA. Ela é oferecida por um aviso, mas o aviso não
  // aparece com cena no ar nem com download em curso — e aí o Registro é o
  // único lugar que responde "por que ainda estou na versão antiga?".
  if (otaPendenteVersao) {
    l.push('Atualização: v' + otaPendenteVersao + ' baixada'
      + (horaRuimParaAtualizar() ? ' (esperando a tela livre)' : '')
      + ' — entra na próxima abertura');
  }
  // A PROCURA em si (v5.136). "Não apareceu aviso nenhum" tem quatro causas
  // indistinguíveis da tela — não há versão nova, a busca falhou, o bundle
  // exige um shell mais novo, ou a pergunta está esperando o telão esvaziar —,
  // e a linha acima só cobre a última. Sem esta, a resposta era um palpite.
  if (otaDiagTexto) l.push('Procura: ' + otaDiagTexto);
  // A FAXINA DA ABERTURA. Ela apaga mídia — sem dono, mas mídia —, e uma
  // limpeza que não deixa rastro é indistinguível de um sumiço.
  if (restosVarridos !== null) {
    l.push('Limpeza: ' + (restosVarridos
      ? restosVarridos + ' resto(s) sem dono removido(s) nesta abertura'
      : 'nenhum resto sem dono'));
  }
  l.push('Aparelho: ' + navigator.userAgent);
  return l.join('\n');
}

function diagMse() {
  if (!window.MediaSource) return 'sem MediaSource';
  const testes = [
    ['avc1', 'video/mp4; codecs="avc1.640028"'],
    ['aac', 'audio/mp4; codecs="mp4a.40.2"'],
  ];
  const faltam = testes
    .filter(([, t]) => { try { return !MediaSource.isTypeSupported(t); } catch (_) { return true; } })
    .map(([n]) => n);
  const codecs = faltam.length ? 'MediaSource sem ' + faltam.join('+') : 'MediaSource ok (avc1+aac)';
  // POR ONDE A FAIXA VIAJA. É a diferença entre transmitir e não transmitir
  // (ver o cabeçalho de `shared/mse.js`), e é decidida pelo shell instalado —
  // ou seja, não dá para inferir da versão web que o rodapé já mostra.
  if (!window.__NATIVE__) return codecs + ' · navegador (faixa no cabeçalho)';
  const podeStream = !!(window.AVStream && window.AVStream.disponivel && AVStream.disponivel());
  return codecs + ' · ' + (podeStream
    ? 'faixa na URL'
    : 'DESLIGADA: shell ' + (window.__SHELL_VERSION__ | 0) + ' < 27 (instale o APK novo)');
}

// ===== O bloco do ESPELHO DE PIXELS no Registro =====
// O Kotlin devolve DADO (JSON) e a frase é montada AQUI. Não é preciosismo: é
// a mesma divisão do `otaDiag`/`ytDiag`, é o que respeita a invariante 5, e é o
// que mantém a sanitização do que veio da rede num ponto só do lado nativo.
//
// TODA LINHA É OPCIONAL, e isso é de propósito: o recurso chega em entregas
// (imagem, depois vídeo, depois áudio), e um bloco que exigisse todos os campos
// quebraria a cada passo. O que o shell não souber responder simplesmente não
// aparece — nunca "undefined" no meio de um log que vai ser repassado.
function mirrorDur(ms) {
  const s = Math.round((Number(ms) || 0) / 1000);
  if (s < 60) return s + ' s';
  const m = Math.round(s / 60);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}

// Os cinco vereditos da sonda em frase — a tabela §7.4 da especificação. O
// Kotlin manda o NOME do enum; traduzir aqui é o mesmo princípio de todo o
// resto do bloco, e é o que permite mudar a frase sem tocar no shell.
const MIRROR_VEREDITO = {
  OK: 'OK — o vídeo aparece',
  OK_ESCURO: 'OK, porém ESCURO (as cores da rede saem mais escuras que o telão)',
  VIDEO_PRETO: 'VÍDEO SAI PRETO',
  TUDO_PRETO: 'TELA INTEIRA PRETA — a composição não chega',
  SEM_QUADRO: 'NENHUM QUADRO EM 5 s',
  INDEFINIDO: 'INDEFINIDO — mediu algo fora dos casos catalogados',
};
// `PowerManager.THERMAL_STATUS_*` por índice.
const MIRROR_TERMICA = ['NONE', 'LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL', 'EMERGENCY', 'SHUTDOWN'];

// O SOM DE UMA TELA, em uma frase.
//
// São DOIS fatos independentes, e cada combinação é um estado diferente com uma
// saída diferente — deixá-los crus ("torneira:nao faixa:nao") obrigava a leitura
// a ser feita de cabeça, e no primeiro culto de teste `torneira:nao`, que quer
// dizer "ninguém tocou naquela tela", foi lido como "o celular não está
// enviando som".
//
//  · `audio` (torneira) é o que o SERVIDOR abriu para aquela tela, e ele só
//    abre quando ela pede — o que só acontece no toque do visitante, porque as
//    telas nascem mudas por decisão (§3.11, invariante 10);
//  · `som` (faixa) é o que o CLIENTE de fato conseguiu montar.
//
// A discordância entre os dois é o defeito; a concordância em "não" é apenas
// uma tela que ninguém pediu para ouvir.
function somDaTela(c) {
  if (!c.audio && !c.som) return 'som: não pedido (ninguém tocou naquela tela)';
  if (c.audio && !c.som) return 'som: PEDIDO e a faixa não nasceu';
  if (!c.audio && c.som) return 'som: faixa montada sem a torneira aberta (?)';
  return 'som: tocando';
}

function blocoEspelho(d) {
  if (!d || typeof d !== 'object') return '';
  const l = ['Espelho de pixels'];
  const srv = d.servidor || {};
  const svc = d.servico || {};
  if (srv.ligado) {
    l.push('servidor: ' + (srv.url || '?')
      + ' (' + (srv.tls ? 'HTTPS' : 'HTTP') + ', ligado à Wi-Fi)'
      + (srv.noArMs ? ' · ' + mirrorDur(srv.noArMs) + ' no ar' : '')
      + (svc.servico ? ' · serviço de pé' : ' · SEM serviço em primeiro plano'));
  } else {
    l.push('servidor: desligado');
  }
  const t = d.telaVirtual;
  if (t) {
    l.push('tela virtual: ' + t.larg + 'x' + t.alt + ' @ ' + t.dpi + ' dpi'
      + ' · flags=' + (t.flags | 0)
      + ' · privada: ' + (t.privada ? 'SIM' : 'NÃO')
      // O nome do campo já diz que é DERIVADO, e a frase repete: não existe
      // getter público de FLAG_NEVER_BLANK, então isto é dedução de não termos
      // passado PUBLIC — não é leitura. Um Registro que afirma o que ninguém
      // mediu é pior que um que se cala.
      + ' · NEVER_BLANK (derivado): ' + (t.neverBlankDerivado ? 'SIM' : 'NÃO')
      + (t.id != null ? ' · id ' + t.id : ''));
  }
  const vp = d.viewport;
  if (vp) {
    // OS DOIS NÚMEROS, sempre — é a promessa do recurso ("o espelho desenha no
    // MESMO viewport CSS que a TV") virando leitura em vez de fé. 213 dpi dá
    // 961,5 px CSS para um alvo de 960: meio ponto percentual, que não muda uma
    // quebra de linha. Identidade de pixel não é prometida, e por isso os dois
    // aparecem.
    l.push('viewport do espelho: ' + (vp.cssExato != null ? vp.cssExato : vp.css) + ' px CSS'
      + ' (alvo: ' + vp.alvo + ' — a TV desenha assim)');
  }
  if (d.modo) l.push('modo: ' + (d.modo === 'video' ? 'vídeo (H.264)' : 'imagem (JPEG)'));
  const r = d.readback;
  if (r) {
    // O RGB MEDIDO SEMPRE, nunca só o veredito: há aparelho conhecido que
    // devolve a imagem escurecida, e uma comparação exata imprimiria "TELA
    // INTEIRA PRETA" — um diagnóstico falso, que manda o próximo leitor caçar
    // um defeito que não existe.
    l.push('readback: ' + (MIRROR_VEREDITO[r.veredito] || r.veredito || '?')
      + ' — fundo ' + r.fora + ' · vídeo ' + r.dentro
      + ' · preto ' + r.preto + ' · branco ' + r.branco
      + (r.pixelCopy ? ' · PixelCopy ' + r.pixelCopy : '')
      + (r.nota ? ' · ' + r.nota : ''));
  }
  const enc = d.encoder;
  if (enc) {
    l.push('encoder: ' + (enc.nome || '?')
      + (enc.maxInstancias ? ' · instâncias máx: ' + enc.maxInstancias : '')
      + ' · reclaims: ' + (enc.reclaims | 0));
  }
  const ritmo = d.ritmo;
  if (ritmo && d.ligado) {
    // O ÚNICO detector de "a janela do espelho morreu e o encoder continuou":
    // H.264 impecável de um retângulo preto, com todos os contadores subindo e
    // nenhuma exceção em lugar nenhum. Ele só ACUSA com vídeo tocando e cortina
    // aberta — durante uma oração com a cortina fechada e um louvor pausado
    // atrás, um detector ingênuo denunciaria uma falha que não existe, no
    // Registro, com botão de copiar, para ser repassado.
    // O TERMO DO fps SAIU, e a razão é que ele deixou de significar o que
    // significava: o batimento do papel espelho passou de 1 Hz para 8 Hz
    // (v5.144), então uma cena PARADA agora marca ~8 fps e a condição
    // `fps <= 1.2` nunca mais seria verdadeira — o alarme morreria calado, que
    // é o pior desfecho para um detector. Quem sobrou é o bitrate, e ele
    // sozinho separa os dois casos com folga de uma ordem de grandeza: um
    // retângulo preto só produz P-frames de macrobloco `skip` (dezenas a
    // poucas centenas de bytes) e quadros-chave de uma tela preta, o que dá
    // algo abaixo de 30 kbps; qualquer coisa de verdade em cena — até um
    // wallpaper parado, medido em 156 kbps no aparelho — fica muito acima.
    const parado = (ritmo.kbps | 0) < 40;
    const acusa = parado && cenaComVideoAberto();
    l.push('ritmo: ' + (ritmo.kbps | 0) + ' kbps · ' + (ritmo.fps || 0) + ' fps'
      + ' (' + Math.round((ritmo.janelaMs || 0) / 1000) + ' s)'
      + ' · cena "' + (npNameInnerEl ? (npNameInnerEl.textContent || '—') : '—') + '"'
      + ' — ' + (acusa
        ? 'ALARME: ISTO É UM RETÂNGULO PRETO'
        : (parado ? 'imagem parada, normal' : 'conteúdo se movendo')));
    // A CADÊNCIA, numa linha própria e inteiramente opcional (shell antigo não
    // manda estes campos e a linha não aparece — nunca "undefined" num log que
    // vai ser copiado e repassado). Ela existe para a próxima rodada em
    // aparelho ser CONCLUSIVA: "kbps + fps" não distingue uma fonte regular de
    // uma fonte em rajada, e é a rajada — o PIOR intervalo — que trava o
    // `<video>` do outro lado, porque ele consome em tempo real.
    const cad = [];
    if (ritmo.msMedio != null) {
      cad.push('intervalo ' + (ritmo.msMedio | 0) + ' ms · pior '
        + (ritmo.msPior | 0) + ' ms');
    }
    if (ritmo.chaves != null) {
      cad.push((ritmo.chaves | 0) + ' chave(s) = ' + (ritmo.kbpsChave | 0) + ' kbps');
    }
    if (ritmo.atrasoMs != null) {
      // "Relativo" está escrito na tela de propósito: o número é o quanto o
      // quadro de agora demorou A MAIS que o primeiro da sessão entre a captura
      // e o fio, e não uma latência absoluta (ver o KDoc de `EspelhoDiag`).
      // Sem a palavra, alguém somaria isto ao atraso do cliente.
      //
      // E COLADO NO TETO NÃO É UMA MEDIDA — é a ausência de uma. O Kotlin
      // trunca em `TETO_MS`, então um valor exatamente no teto quer dizer
      // "a âncora desta sessão não vale" (o anel sobreviveu a um espelho
      // anterior sem o carimbo ter andado para trás), e imprimi-lo como
      // "60000 ms" faz o operador ler um minuto de fila que não existe. Foi o
      // que apareceu no primeiro culto de teste, num espelho com 30 s no ar.
      const TETO_ATRASO_MS = 60000;
      const pinado = (ritmo.atrasoMs | 0) >= TETO_ATRASO_MS;
      cad.push(pinado
        ? 'atraso relativo: sem referência válida nesta sessão'
        : 'atraso relativo ' + (ritmo.atrasoMs | 0) + ' ms · pior '
          + (ritmo.atrasoPiorMs | 0) + ' ms');
    }
    if (cad.length) l.push('  cadência: ' + cad.join(' · '));
  }
  // O ÁUDIO, e ele precisa de DOIS vereditos nomeados — não de um número.
  //
  // A cadeia tem duas metades que falham de formas indistinguíveis num log:
  // o canal nativo (`WebMessageListener`) pode nunca ter sido instalado, e o
  // grafo Web Audio pode estar de pé produzindo NADA (é o modo de falha que a
  // especificação chama de pior: um `AudioWorkletNode` sem caminho até o
  // `destination` não lança, não avisa, e simplesmente não roda). Sem separar
  // os dois, "não sai som" seria uma frase só para duas causas opostas — e foi
  // exatamente por não haver esta linha que a primeira rodada em aparelho
  // gastou um teste inteiro sem descobrir que o `instalar()` nunca era chamado.
  const au = d.audio;
  if (au && typeof au === 'object') {
    if (!au.canal) {
      l.push('áudio: CANAL FECHADO — o espelho não tem por onde mandar som');
    } else if (!au.blocosPorSegundo) {
      l.push('áudio: canal aberto + 0 blocos de PCM/s'
        + ' — o telão não está entregando som (grafo Web Audio mudo)');
    } else {
      l.push('áudio: canal aberto · AAC ' + (au.bitrate ? (au.bitrate / 1000 | 0) + ' kbps' : '?')
        + ' @ ' + (au.taxa || '?') + ' Hz, ' + (au.canais || '?') + ' canal(is)'
        + ' · ' + au.blocosPorSegundo + ' blocos de PCM/s'
        + ' · ' + (au.quadros | 0) + ' quadro(s)'
        + (au.descartados ? ' · ' + au.descartados + ' descartado(s)' : ''));
    }
  }
  if (svc.termico != null) {
    l.push('térmica: ' + (MIRROR_TERMICA[svc.termico] || svc.termico)
      + ' (máx na sessão: ' + (MIRROR_TERMICA[svc.termicoMax] || svc.termicoMax) + ')'
      + ' · carregador: ' + (svc.carregando ? 'SIM' : 'NÃO'));
  }
  const telas = Array.isArray(srv.telas) ? srv.telas : [];
  const pend = Array.isArray(srv.pendentes) ? srv.pendentes : [];
  if (srv.ligado) {
    l.push('telas: ' + telas.length + ' conectada(s) de ' + (srv.teto || 3)
      + ' · ' + pend.length + ' pendente(s)');
    telas.forEach((c) => {
      l.push('  tela ' + (c.rotulo || '?') + '  ' + (c.ua || '?')
        + '  MSE:' + (c.mse ? 'sim' : 'nao')
        + '  fetch-stream:' + (c.fetchStream ? 'sim' : 'nao')
        + '  seguro:' + (c.seguro ? 'sim' : 'nao')
        + '  wakeLock:' + (c.wakeLock ? 'sim' : 'nao')
        + '  tela acesa ' + (c.telaAcesaMin | 0) + ' min');
      l.push('          ' + Math.round((c.bytes || 0) / 104857.6) / 10 + ' MB'
        + ' · ' + (c.descartes | 0) + ' descarte(s)'
        + ' · ultimo write ha ' + mirrorDur(c.ultimaEscritaMs)
        // O SOM EM UMA FRASE, e não em dois "nao" para o operador interpretar.
        + ' · ' + somDaTela(c)
        + ' · ' + (c.recomecos | 0) + ' recomeco(s)');
      // E A FRASE QUE ESTÁ ESCRITA NAQUELA TELA, quando há uma. É onde o
      // cliente já dizia a causa — só que para uma sala em que ninguém está.
      if (c.aviso) l.push('          diz: "' + c.aviso + '"');
    });
    // A LINHA MAIS IMPORTANTE DESTE BLOCO quando ela aparece. Servidor de pé,
    // porta escutando e nenhum SYN chegando é AP isolation — e ela é
    // indistinguível de "ninguém abriu ainda" sem que alguém a nomeie. Não há
    // conserto do lado do app: a saída é operacional (outro SSID, ou o hotspot
    // do celular), e por isso a frase precisa vir junto.
    if (srv.semConexaoMs > 120000) {
      l.push('nenhuma conexão desde que ligou (há ' + mirrorDur(srv.semConexaoMs) + ') — '
        + 'se alguém abriu o endereço, o roteador está isolando os clientes');
    }
    const saida = srv.ultimaSaida;
    if (saida && typeof saida === 'object') {
      l.push('ultima desconexao: tela ' + (saida.rotulo || '?')
        + ' · ' + (saida.motivo || '?'));
    }
  }
  const linhas = Array.isArray(d.linhas) ? d.linhas : [];
  if (linhas.length) {
    const hora = (t2) => new Date(t2).toLocaleTimeString('pt-BR', { hour12: false });
    linhas.slice(-12).forEach((x) => l.push('  ' + hora(x.em) + '  ' + x.txt));
  }
  return l.join('\n');
}

// O detector de ritmo só pode ACUSAR com vídeo tocando e a cortina ABERTA — a
// cortina cobre o telão, ou seja, por construção ela É um retângulo preto com a
// mídia carregada. `view` é a cortina (ver renderControls) e `currentItem` diz
// o tipo do que está em cena.
function cenaComVideoAberto() {
  if (view !== 'visual') return false;                 // cortina fechada: preto é o esperado
  if (!currentItem) return false;
  if (currentItem.kind === 'audio' || currentItem.kind === 'image') return false;
  try { return !!preview.isPlaying(); } catch (_) { return false; }
}

// A LINHA DO TEMPO dos dois processos, em ordem de relógio.
function eventosDiag() {
  if (!diagLinhas.length) {
    return 'Linha do tempo\n(sem registros — minimize o app com algo tocando e volte aqui)';
  }
  const hora = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour12: false });
  return 'Linha do tempo\n' + diagLinhas
    .slice(-16)
    .map((l) => hora(l.t) + '  ' + (l.onde === 'celular' ? '📱' : '📺') + ' ' + l.ev
      + (l.oculto ? ' [oculto]' : '') + (l.t2 != null ? '  ' + l.t2 + 's' : ''))
    .join('\n');
}

// O texto INTEIRO do registro — e é ele que o botão de copiar entrega. Guardado
// aparte do `textContent` porque a caixa pode estar rolada: copiar o que está
// VISÍVEL seria copiar meio log, que é o defeito que esta reforma corrigiu.
let diagTexto = '';

// Guarda de sequência: `renderDiag` virou assíncrona (ela pergunta o
// diagnóstico do YouTube à ponte), e é chamada DUAS vezes ao abrir
// Configurações — uma na hora, com o que já se tem, e outra quando a resposta
// do telão chega. Sem isto, a primeira poderia terminar depois da segunda e
// escrever por cima dela a linha do tempo SEM os eventos do telão, que é
// justamente o que se foi buscar.
let diagSeq = 0;

async function renderDiag() {
  if (!diagBoxEl) return;
  const meu = ++diagSeq;
  // O ESTADO DA PROCURA antes de montar o cabeçalho, que o lê (shell 31+). É a
  // única linha do bloco que precisa ir à ponte, e ela é barata: uma string.
  if (window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 31) {
    try { otaDiagTexto = await AVNative.otaDiag(); } catch (_) { otaDiagTexto = ''; }
    if (meu !== diagSeq) return;
  }
  const blocos = [cabecalhoDiag()];
  // A ÚLTIMA EXTRAÇÃO DO YOUTUBE vinha numa faixa do rodapé, em espaço fixo:
  // uma extração com várias tentativas transbordava e a parte de baixo ficava
  // inalcançável. Aqui ela é só mais um bloco de uma caixa que rola.
  if (window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 24) {
    let yt = '';
    try { yt = await AVNative.ytDiag(); } catch (_) {}
    if (yt) blocos.push('Última extração do YouTube\n' + yt);
  }
  // O lado WEB da última tentativa de transmitir. Ele vem à parte do
  // diagnóstico do shell porque três dos cinco pontos de desistência acontecem
  // antes de a ponte ser chamada — ali o Kotlin não tem o que dizer.
  if (motivoStream) {
    // O erro de REPRODUÇÃO entra junto, e é o que faltava: a v5.123 mostrava
    // "transmitindo 1080p" — a decisão — e nada sobre o vídeo ter morrido no
    // segundo zero logo depois. Decidir e conseguir são duas coisas.
    const falha = (window.AVStream && window.AVStream.ultimoErro) || '';
    blocos.push('Transmissão direta (último "Tocar agora")\n' + motivoStream
      + (falha ? '\nfalhou ao tocar: ' + falha : ''));
  }
  // O ESPELHO DE PIXELS: mais um BLOCO desta caixa, nunca uma faixa nova em
  // outro canto (regra do projeto). É o único lugar em que o veredito da sonda
  // de readback e o estado do servidor podem ser LIDOS e REPASSADOS — e o botão
  // de copiar, que já está no cabeçalho do Registro, os leva junto.
  if (espelhoDisponivel()) {
    let ed = null;
    try { ed = await AVNative.espelhoDiag(); } catch (_) { ed = null; }
    if (meu !== diagSeq) return;
    const bloco = blocoEspelho(ed);
    if (bloco) blocos.push(bloco);
  }
  if (meu !== diagSeq) return;   // outro render assumiu durante a espera
  blocos.push(eventosDiag());
  diagTexto = blocos.join('\n\n');
  diagBoxEl.textContent = diagTexto;
}
// Junta os dois anéis em ORDEM DE RELÓGIO: celular e telão são dois processos
// da mesma cena, e o que interessa é a sequência entre eles — "o celular ficou
// oculto e ENTÃO o telão pausou" é uma história diferente de "o telão pausou
// sozinho".
function juntarDiag(doTelao) {
  diagLinhas = diarioC.concat(doTelao || []).sort((a, b) => a.t - b.t);
  renderDiag();
}
function pedirDiag() {
  juntarDiag([]);
  if (displayActive()) AVDB.sendCommand({ type: 'diag-ask' });
}

// COPIAR UM CAMPO DE LOG. Regra do projeto: todo campo de diagnóstico nasce com
// este botão — ele existe para ser repassado, e a alternativa é transcrever
// números à mão ou fotografar a tela.
//
// `navigator.clipboard` exige contexto seguro, e o app tem um (a base é servida
// por `https://appassets.androidplatform.net`) — mas o WebView pode negar a
// permissão sem aviso, então o caminho antigo (`execCommand`) fica como reserva.
// A confirmação é o mesmo pulso do resto do app: o ícone vira ✓ por um instante.
//
// Ela viveu no meio do bloco do diagnóstico do YouTube até a v5.121, e por isso
// foi APAGADA junto quando aquele bloco saiu — o botão do registro passou a
// chamar uma função inexistente e não fazia nada. Um helper compartilhado
// morando dentro do escopo visual de um único consumidor é um convite a isso;
// agora ele fica ao lado de quem o usa e com o nome do que é.
async function copiarTexto(texto, btn) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(texto);
    ok = true;
  } catch (_) {
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      // Fora da vista, mas NÃO `display:none` nem `hidden`: um campo que não
      // está no layout não pode ser selecionado, e sem seleção o `copy` copia
      // nada — em silêncio.
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (__) { ok = false; }
  }
  if (btn) responder(btn, ok ? 'ok' : 'erro', ok ? null : 'Não foi possível copiar');
  return ok;
}

// O botão de copiar do registro. O `diagCopyEl` já existia lá em cima como
// referência PENDURADA — apontava para um `#diagCopy` que o HTML não tinha e
// não escutava nada. Agora o elemento existe e ele tem função.
//
// Copia o registro MONTADO, não o que está à vista: a caixa rola, e copiar a
// janela visível entregaria um pedaço do meio — que é justamente o defeito que
// esta reforma veio corrigir.
if (diagCopyEl) {
  diagCopyEl.addEventListener('click', () => copiarTexto(diagTexto || diagBoxEl.textContent || '', diagCopyEl));
}

function renderFitSeg() {
  fitSegEl.querySelectorAll('.fit-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.fit === mediaFit);
  });
}
// O seletor do wallpaper é o MESMO componente visual do preenchimento, então
// precisa acender o segmento vigente igual a ele: "Escolher imagem…" quando há
// uma imagem, "Padrão" quando é o gradiente.
function renderWallSeg() {
  wallPickEl.classList.toggle('active', customWallpaper);
  wallResetEl.classList.toggle('active', !customWallpaper);
}
async function applyFit(mode) {
  mediaFit = mode;
  renderFitSeg();
  await AVDB.setState('fit', mediaFit);
  cmd({ type: 'fit', fit: mediaFit });
}

// ===== GIRAR A MÍDIA (v5.142) =====
//
// Vídeo gravado de lado no celular chega DEITADO no telão. Não havia nada a
// fazer: a mídia é do operador, reencodar no meio de um culto não existe, e
// "grave de pé" não conserta um arquivo já pronto.
//
// UM BOTÃO QUE AVANÇA, não quatro segmentos. Ninguém pensa em "270°" — pensa em
// "gira mais uma vez até ficar de pé", e são no máximo três toques até qualquer
// orientação. O rótulo mostra o ângulo vigente para o estado ser legível sem
// contar toques, e é ele que diz que o giro está ligado quando a mídia em cena
// já está de pé por acaso.
//
// PERSISTIDO como o preenchimento (`state.rotate`), e pelo mesmo motivo: o
// telão pode reconectar, o app pode ser reaberto no meio do culto, e voltar ao
// zero sozinho seria desfazer um ajuste que ninguém pediu para desfazer.
const ROTACOES = [0, 90, 180, 270];
let mediaRot = 0;
function renderRotBtn() {
  if (!rotBtnEl) return;
  rotBtnEl.classList.toggle('active', mediaRot !== 0);
  if (rotLabelEl) rotLabelEl.textContent = mediaRot + '°';
  rotBtnEl.title = mediaRot ? 'Girada ' + mediaRot + '° — tocar gira mais 90°' : 'Girar 90° no telão';
}
async function applyRotate(graus) {
  mediaRot = ((graus | 0) % 360 + 360) % 360;
  if (!ROTACOES.includes(mediaRot)) mediaRot = 0;
  renderRotBtn();
  await AVDB.setState('rotate', mediaRot);
  cmd({ type: 'rotate', rotate: mediaRot });
}

// ===== URL / compartilhamento =====
function extractYouTubeId(url) {
  // Extrai apenas a parte http://... sem espaços ou texto extra
  const cleanUrl = (url || '').match(/https?:\/\/\S+/);
  if (!cleanUrl) return null;
  try {
    const u = new URL(cleanUrl[0]);
    let id = null;
    if (u.hostname === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0];
    } else if (u.hostname.includes('youtube.com')) {
      // watch?v=ID e também /shorts/ID, /live/ID, /embed/ID, /v/ID
      id = u.searchParams.get('v');
      if (!id) {
        const m = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/);
        if (m) id = m[1];
      }
    }
    if (id) id = decodeURIComponent(id);
    // Valida formato de ID do YouTube: exatamente 11 chars [A-Za-z0-9_-]
    return (id && /^[A-Za-z0-9_-]{11}$/.test(id)) ? id : null;
  } catch (_) {}
  return null;
}

function detectUrlKind(url) {
  if (extractYouTubeId(url)) return 'youtube';
  const lower = url.toLowerCase().split('?')[0];
  const ext = (lower.split('.').pop() || '');
  const mime = MEDIA_MIME[ext];
  // MEDIA_MIME só contém extensões de image/video/audio → kindFromType nunca
  // devolve 'other' aqui; extensão desconhecida (sem mime) vira 'url'.
  return mime ? AVDB.kindFromType(mime) : 'url';
}

// ===== A via NATIVA: o aparelho extrai e baixa o vídeo sozinho =====
//
// É o caminho principal desde a v5.81, e o que finalmente cumpre "sem
// configurar nada": quem extrai é o shell (`YoutubeGrab.kt`), com a
// requisição saindo do IP do próprio celular. Servidor público — Cobalt,
// Invidious, Piped — roda em IP de datacenter, que é exatamente o que o
// YouTube bloqueia; foi por isso que a via anterior não funcionou, e é por isso
// que ela saiu do app na v5.82 em vez de ficar como alternativa morta.
//
// O nativo entrega uma URL SERVÍVEL (`/saf/<token>`), não bytes: daqui para a
// frente o caminho é o mesmo de um arquivo compartilhado — `fetch` + `Blob` +
// `addMedia`. O arquivo intermediário é apagado logo depois; sem isso o vídeo
// ficaria duas vezes no aparelho.
//
// Exige shell ≥ 16. Num anterior o método não existe e a função devolve null
// na hora, sem custo: o link vira item de player embutido, que é o
// comportamento de sempre e continua sendo o plano B.
// `opts.naPreview` decide ONDE o aviso aparece — e a pergunta que ele responde
// é "isto vai entrar em cena a seguir?". Tocar: sim, o cartão vai sobre a
// preview. Só entrar na lista: não, o aviso vai na linha do Cronograma, que é
// onde o resultado vai aparecer. Ver `libBusy`.
async function ytBaixarNativo(link, nome, opts) {
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 16) return null;
  // SÓ O ÁUDIO exige shell ≥ 23 (o método `ytFetchAudio` da ponte). Num
  // anterior, pedir áudio devolveria null e o operador ficaria sem nada — e ele
  // pediu o louvor, não o formato: cai no vídeo, que toca igual. Quem desenha a
  // escolha na tela já a esconde nesse shell (ver `openYtMenu`); esta guarda é
  // para o caminho que não passa pela tela.
  const soAudio = !!(opts && opts.somenteAudio) && (window.__SHELL_VERSION__ | 0) >= 23;
  // O TETO DE RESOLUÇÃO escolhido pelo operador (v5.118). Ausente = o padrão do
  // shell (1080p), que é o caminho que funciona em qualquer versão: o `ytFetch`
  // do `native.js` só usa o método novo da ponte quando o teto pedido é MENOR
  // que o padrão. Nenhuma guarda de shell aqui, portanto — quem não pode
  // escolher simplesmente não escolhe, e baixa como sempre.
  const altura = (opts && opts.altura) | 0;
  const rotulo = nome || 'Vídeo do YouTube';
  const rotuloBaixando = soAudio ? 'Baixando áudio' : 'Baixando vídeo';
  const naPreview = !!(opts && opts.naPreview);
  // Três destinos de aviso, não dois. O terceiro (`aviso: 'nenhum'`) é a
  // playlist: ela mora dentro de uma bandeja fechada, então não há linha para
  // marcar — e desenhar a linha provisória no CRONOGRAMA prometeria um item
  // que nunca vai aparecer lá. Ali quem mostra o andamento é a própria linha
  // do resultado (`onPct`) mais a notificação do sistema.
  const aviso = (opts && opts.aviso) || (naPreview ? 'preview' : 'lib');
  const bg = aviso === 'preview' ? previewBusy(soAudio ? 'Preparando áudio' : 'Preparando vídeo', rotulo)
    : aviso === 'lib' ? libBusy(rotulo, opts && opts.chave)
      : { visivel: false, atualizar() {}, soltar() {} };
  const notif = bgTaskStart(rotuloBaixando, 1);
  // O NOME DO VÍDEO na linha da notificação, pela mesma razão do lote de
  // músicas: "Baixando vídeo" sozinho não diz QUAL, e com o app minimizado esta
  // é a única tela que existe. Uma tarefa de um item só nunca chega a trocar de
  // nome, então o compasso não tem o que fazer aqui — vai direto.
  bgItemOnly(notif, rotulo);
  // A INTENÇÃO, GRAVADA ANTES DE COMEÇAR. É o que permite reclamar o download
  // se esta página morrer no meio dele (ver `resgatarDownloads`) — e por isso
  // ela precisa estar no banco ANTES do primeiro byte, não depois.
  await lembrarIntencao({
    link,
    nome: rotulo,
    youtubeId: (opts && opts.youtubeId) || null,
    lista: (opts && opts.lista) || null,
    soAudio,
    altura,
    quando: Date.now(),
  });
  try {
    return await withBgWork(async () => {
      const r = await AVNative.ytFetch(link, (lidos, total) => {
        const pct = total ? Math.floor((lidos / total) * 100) : -1;
        bg.atualizar(pct >= 0
          ? rotuloBaixando + ' · ' + pct + '%'
          : rotuloBaixando + ' · ' + fmtBytes(lidos), null, pct);
        // Os MESMOS bytes que a preview já mostrava vão agora para a
        // notificação, que até a v5.117 ficava parada em "0 de 1" (ver
        // `bgTaskBytes`). É a diferença entre uma barra que anda e uma que
        // parece travada durante os minutos inteiros do download.
        bgTaskBytes(notif, lidos, total);
        if (opts && opts.onPct) opts.onPct(pct);
      }, soAudio, altura);
      if (!r || !r.url) return null;
      // CANCELADO NO ÚLTIMO SEGUNDO. O shell para o laço de cópia, mas há uma
      // janela em que ele já terminou de baixar e está juntando as faixas
      // (`MuxMp4`) — e aí o arquivo VEM, depois de o operador ter pedido para
      // parar. Sem esta guarda o item apareceria em cena como se o cancelamento
      // não tivesse acontecido. Os bytes intermediários são descartados aqui
      // mesmo: eles nunca chegaram à biblioteca.
      if (opts && opts.youtubeId && ytCancelados.has(opts.youtubeId)) {
        AVNative.ytDiscard(r.url);
        return null;
      }
      // O shell manda `r.audioOnly` dizendo se a faixa é mesmo só áudio (ver
      // YoutubeGrab.buscar). A UI NÃO usa esse campo: quando o vídeo não
      // oferece faixa separada, o que o operador pediu — tocar no fundo, sem
      // imagem no telão — acontece do mesmo jeito, porque quem manda no telão é
      // o `kind` do registro e não o container do arquivo. Anunciar a diferença
      // seria contar um detalhe de implementação no meio de um culto. Ele
      // continua no JSON porque é o que aparece no `Log.w` de quem for
      // diagnosticar por que um vídeo específico não entregou o áudio.
      try {
        const res = await fetch(r.url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.size) return null;
        // SEM MINIATURA quando é só áudio, e isso não é economia: a miniatura
        // de um áudio seria a "capa" que não pode existir. O registro entra com
        // `kind: 'audio'`, e é o kind que faz o telão manter o wallpaper em vez
        // de trocar de imagem (ver `semVisual` em stage.js).
        const thumb = soAudio ? null : await makeThumb(blob, 'video');
        return await AVDB.addMedia(blob, {
          // O sufixo é a MESMA convenção das músicas do acervo, que já se
          // chamam "(Cantado)"/"(Playback)": sem ele, o vídeo e o áudio do
          // mesmo link viram duas linhas com o nome idêntico na lista.
          name: (r.name || rotulo) + (soAudio ? ' (áudio)' : ''),
          type: r.type || (soAudio ? 'audio/mp4' : 'video/mp4'),
          kind: soAudio ? 'audio' : 'video',
          thumb,
          // A ALTURA REAL do que veio, dita pelo shell. Ela vira o subtítulo da
          // linha do Cronograma ("Vídeo · 1080p"), e é a única forma honesta de
          // responder "o que eu tenho aqui?" agora que o teto é escolhido a
          // cada download — inclusive quando o pedido não pôde ser atendido e o
          // que veio foi outra coisa. Descobrir isso depois exigiria decodificar
          // o arquivo.
          height: (r.height | 0) || null,
          // O id do vídeo fica GRAVADO no registro: é ele que faz o próximo
          // toque no mesmo resultado reaproveitar este arquivo em vez de
          // baixar tudo de novo (ver `ytArquivo`).
          youtubeId: (opts && opts.youtubeId) || null,
          // E a lista de destino vem de quem pediu: nem todo vídeo baixado
          // pertence ao Cronograma (ver `ytAcao`).
          list: (opts && opts.lista) || 'imports',
        });
      } finally {
        // No `finally`: mesmo que a cópia falhe, o arquivo do cache não pode
        // ficar para trás — ninguém mais tem o token dele.
        AVNative.ytDiscard(r.url);
      }
    });
  } catch (e) {
    console.warn('[yt nativo] falhou:', e && e.message);
    return null;
  } finally {
    bgTaskEnd(notif);
    bg.soltar();
    // A INTENÇÃO SAI DO REGISTRO AQUI, e só aqui: chegando neste ponto o
    // download acabou de um jeito ou de outro, e a página está viva para
    // contar. É justamente por ela NÃO chegar aqui — o renderer morreu no meio
    // — que a intenção sobrevive e é reclamada na abertura seguinte (ver
    // `resgatarDownloads`).
    await esquecerIntencao(link, soAudio);
  }
}

// ---------------------------------------------------------------------------
// O DOWNLOAD QUE O RENDERER LEVOU JUNTO (v5.133 · shell 30)
//
// O download roda no shell; quem o espera é um `fetch` DESTA página. Quando o
// renderer morre — dois WebViews, um vídeo grande e o player do YouTube dividem
// o mesmo processo, e o OOM é evento conhecido —, a página é recriada e o
// `fetch` morre com ela: o arquivo termina de baixar e não sobra ninguém para
// recebê-lo. Do lado do operador, dez minutos viram nada, sem explicação.
//
// A recuperação é uma dobradiça de duas metades:
//
// - **O shell guarda o desfecho** até alguém reclamá-lo (`YoutubeGrab.resgatar`).
// - **A página registra a INTENÇÃO** antes de pedir o download e a apaga no
//   fim. Uma intenção que sobrevive a um lançamento é, por definição, um
//   download que ninguém recebeu.
//
// Reclamar é pedir o MESMO download outra vez: o shell devolve o resultado
// guardado na hora (sem rede), ou — se o processo inteiro tiver morrido — baixa
// de novo, agora com a fila de IO livre. O registro fica no `state` do banco,
// que é o único lugar que sobrevive à morte da página.
// ---------------------------------------------------------------------------
const YT_INTENCOES = 'ytIntencoes';
// Uma intenção velha não vale a pena: as URLs do YouTube expiram em horas, e
// reviver o download de um louvor de anteontem na abertura de um domingo é
// gastar rede por algo que ninguém está esperando.
const INTENCAO_VALIDA_MS = 6 * 60 * 60 * 1000;

function mesmaIntencao(a, link, soAudio) {
  return a && a.link === link && !!a.soAudio === !!soAudio;
}

async function lembrarIntencao(intencao) {
  try {
    const atuais = (await AVDB.getState(YT_INTENCOES)) || [];
    const outras = atuais.filter((i) => !mesmaIntencao(i, intencao.link, intencao.soAudio));
    await AVDB.setState(YT_INTENCOES, outras.concat([intencao]));
  } catch (e) { console.warn('[yt] não deu para registrar a intenção:', e); }
}

async function esquecerIntencao(link, soAudio) {
  try {
    const atuais = (await AVDB.getState(YT_INTENCOES)) || [];
    const restam = atuais.filter((i) => !mesmaIntencao(i, link, soAudio));
    if (restam.length !== atuais.length) await AVDB.setState(YT_INTENCOES, restam);
  } catch (e) { console.warn('[yt] não deu para limpar a intenção:', e); }
}

// Chamado uma vez por abertura. Silencioso quando não há nada — que é o caso
// normal.
async function resgatarDownloads() {
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 30) return;
  let pendentes = [];
  try { pendentes = (await AVDB.getState(YT_INTENCOES)) || []; } catch (_) { return; }
  if (!pendentes.length) return;
  const agora = Date.now();
  // Limpa o registro ANTES de tentar: um resgate que falhe não pode ficar
  // tentando de novo a cada abertura, e quem der certo já reescreve a lista
  // pelo caminho normal (`lembrarIntencao` no começo do download).
  try { await AVDB.setState(YT_INTENCOES, []); } catch (_) { /* segue */ }
  for (const p of pendentes) {
    if (!p || !p.link || (agora - (p.quando || 0)) > INTENCAO_VALIDA_MS) continue;
    console.info('[yt] reclamando download interrompido:', p.nome || p.link);
    try {
      const rec = await ytArquivo(
        { id: p.youtubeId || null, url: p.link, name: p.nome },
        { lista: p.lista, somenteAudio: p.soAudio, altura: p.altura, aviso: 'nenhum' },
      );
      if (!rec) continue;
      // O DESTINO ORIGINAL é honrado: quem pediu "para o Cronograma" recebe no
      // Cronograma, mesmo que o app tenha morrido no meio. `listAdd` é
      // idempotente, e o registro pode já ter nascido na lista certa.
      if (p.lista) await AVDB.listAdd(p.lista, rec.id);
      await load();
    } catch (e) { console.warn('[yt] resgate falhou:', e && e.message); }
  }
}

function ehPdf(item) {
  const t = String((item && item.type) || '').toLowerCase();
  const n = String((item && item.name) || '').toLowerCase();
  return t === 'application/pdf' || n.endsWith('.pdf');
}
function ehPptx(item) {
  const t = String((item && item.type) || '').toLowerCase();
  const n = String((item && item.name) || '').toLowerCase();
  return n.endsWith('.pptx')
    || t === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}
// O que o app sabe transformar em páginas: PDF (pelo shell) e PPTX (aqui).
function ehApresentacao(item) { return ehPdf(item) || ehPptx(item); }

// O MOTIVO da última falha de importação de documento, para o aviso poder
// dizê-lo. Uma variável só, escrita logo antes de quem avisa ler: o aviso
// aparece uma vez por lote, e é sempre do último arquivo que falhou.
//
// Existe porque este código roda no aparelho do operador, num domingo de
// manhã, e quem desenvolve não tem o aparelho na mão. Sem o motivo na tela,
// todo defeito daqui chega como a mesma frase e o diagnóstico vira palpite.
let deckUltimoErro = '';

// Arquivo que o app aceitou mas não conseguiu abrir. DIÁLOGO, e não um aviso
// que some sozinho: o operador acabou de escolher (ou compartilhar) um arquivo,
// e nada acontecer leria como "importou".
function avisarNaoAbriu(nome) {
  const motivo = deckUltimoErro;
  deckUltimoErro = '';
  return appConfirm({
    title: 'Não deu para abrir',
    message: '"' + nome + '" não pôde ser lido. Um PDF com senha precisa de uma cópia '
      + 'sem proteção; um PowerPoint muito antigo (.ppt) precisa ser salvo como .pptx.'
      // O detalhe técnico fica no FIM e entre parênteses: quem só quer resolver
      // lê as duas frases acima e ignora esta; quem está diagnosticando (às
      // vezes por mensagem, sem o aparelho em mãos) tem o que precisa sem
      // logcat.
      + (motivo ? '\n\n(detalhe: ' + motivo + ')' : ''),
    okText: 'Entendi', cancelText: null,
  });
}
function nomeSemExtensao(n) { return String(n || '').replace(/\.[^.]+$/, ''); }

// ===== APRESENTAÇÃO (PDF / Google Apresentações) =====
//
// O que chega é um PDF — ou um link do Google Apresentações, que o shell baixa
// já exportado. O que o app guarda é uma IMAGEM POR PÁGINA: daí para a frente
// a apresentação é mídia comum, com fade, cortina, `MediaSession` e o telão
// que já existem. Ver SlideDeck.kt para por que o desenho é nativo e por que o
// formato de entrada é PDF e não `.pptx`.
//
// Exige shell >= 19. Num anterior o método não existe e a função devolve null
// na hora: o PDF volta a ser um arquivo qualquer e o link, um item de URL —
// exatamente o comportamento de antes.
let deckPagina = 0;   // página em cena da apresentação atual

function isDeck(rec) {
  return !!(rec && rec.kind === 'deck' && Array.isArray(rec.pages) && rec.pages.length);
}

function deckStep(delta) {
  if (!isDeck(currentItem)) return;
  const alvo = Math.min(Math.max(deckPagina + delta, 0), currentItem.pages.length - 1);
  if (alvo === deckPagina) return;
  deckPagina = alvo;
  cmd({ type: 'page', page: deckPagina });
  renderSlideNav();
  renderNowPlaying();
}

// ===== .pptx → páginas, DENTRO do WebView =====
//
// O Android não desenha PowerPoint: a plataforma só traz o `PdfRenderer` (que
// é o caminho do PDF). As bibliotecas nativas que fazem isso são comerciais, e
// converter num servidor exigiria conta, chave e mandar o material do culto
// para fora do aparelho. Sobrou uma saída, e ela roda AQUI: um renderizador de
// OOXML em JavaScript (`vendor/pptx-renderer.js`, Apache-2.0 — ver o LEIA-ME
// daquela pasta para o levantamento inteiro).
//
// O que ele produz é DOM. O que o app projeta é IMAGEM — então cada slide é
// rasterizado logo em seguida, e daí para a frente a apresentação é a MESMA
// mídia `deck` que um PDF vira: fade, cortina, telão, ⏮/⏭ e reconexão, tudo
// sem uma linha nova.
//
// A biblioteca entra por `import()` DINÂMICO: é 1,5 MB que só interessa a quem
// importar um `.pptx`, e carregá-la no boot custaria isso a todo culto.
const PPTX_LARGURA = 1920;   // o telão é 1080p; renderizar acima disso só engorda o IDB

async function pptxParaPaginas(file, onProgresso) {
  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import('../vendor/pptx-renderer.js');
  // Fora da tela, mas MEDIDO: um contêiner `display:none` não tem layout, e
  // sem layout não há o que rasterizar. Daí `position:fixed` + `left:-99999px`.
  const palco = document.createElement('div');
  palco.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + PPTX_LARGURA
    + 'px;pointer-events:none;opacity:0;';
  document.body.appendChild(palco);
  try {
    await PptxViewer.open(await file.arrayBuffer(), palco, { zipLimits: RECOMMENDED_ZIP_LIMITS });
    // Um quadro para o layout assentar antes de medir/serializar.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const slides = [...palco.children];
    const pages = [];
    for (let i = 0; i < slides.length; i++) {
      const blob = await elementoParaPng(slides[i]);
      if (!blob) return null;
      pages.push(blob);
      if (onProgresso) onProgresso(i + 1, slides.length);
    }
    return pages.length ? pages : null;
  } finally {
    palco.remove();
  }
}

// DOM → PNG sem biblioteca nenhuma: o elemento vai para dentro de um
// `<foreignObject>` de SVG, que o navegador desenha como imagem.
//
// As `<img>` do slide são blob: — e uma URL blob NÃO carrega dentro do
// foreignObject (o SVG é um documento à parte). Por isso cada uma é redesenhada
// num canvas e vira `data:` antes da serialização: sem esse passo, a foto do
// slide simplesmente não aparece na página gerada, e o defeito é silencioso.
async function elementoParaPng(el) {
  const r = el.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  const clone = el.cloneNode(true);
  const origens = [...el.querySelectorAll('img')];
  const copias = [...clone.querySelectorAll('img')];
  for (let i = 0; i < origens.length; i++) {
    try {
      const cv = document.createElement('canvas');
      cv.width = origens[i].naturalWidth || 1;
      cv.height = origens[i].naturalHeight || 1;
      cv.getContext('2d').drawImage(origens[i], 0, 0);
      copias[i].setAttribute('src', cv.toDataURL('image/png'));
    } catch (_) { /* imagem que não carregou: o slide sai sem ela */ }
  }
  const html = new XMLSerializer().serializeToString(clone);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
    + '<foreignObject width="100%" height="100%">'
    + '<div xmlns="http://www.w3.org/1999/xhtml">' + html + '</div>'
    + '</foreignObject></svg>';
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  try { await img.decode(); } catch (_) { return null; }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  // FUNDO BRANCO antes de desenhar, como no lado nativo (ver SlideDeck.kt): o
  // slide pode não pintar o próprio papel, e transparente, no telão, é o preto
  // do palco — o texto escuro sumiria.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

// Importa um `.pptx` já lido como File/Blob.
async function pptxImportar(file, nome, opts) {
  const rotulo = nome || 'Apresentação';
  const naPreview = !!(opts && opts.naPreview);
  const bg = naPreview
    ? previewBusy('Preparando apresentação', rotulo)
    : libBusy(rotulo, opts && opts.chave);
  const notif = bgTaskStart('Preparando apresentação', 1);
  try {
    return await withBgWork(async () => {
      const pages = await pptxParaPaginas(file, (feitas, total) => {
        const pct = total ? Math.floor((feitas / total) * 100) : -1;
        bg.atualizar('Preparando página ' + feitas + (total ? ' de ' + total : '') + '…', null, pct);
      });
      if (!pages) { deckUltimoErro = 'pptx: nenhuma página desenhada'; return null; }
      const thumb = await makeThumb(pages[0], 'image');
      return await AVDB.addDeck(pages, {
        name: rotulo, thumb, list: (opts && opts.lista) || 'imports',
      });
    });
  } catch (e) {
    console.warn('[pptx] falhou:', e && e.message);
    deckUltimoErro = 'pptx: ' + ((e && e.message) || 'erro sem mensagem');
    return null;
  } finally {
    bgTaskEnd(notif);
    bg.soltar();
  }
}

async function deckImportar(origem, nome, opts) {
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 19) return null;
  const rotulo = nome || 'Apresentação';
  const naPreview = !!(opts && opts.naPreview);
  const bg = naPreview
    ? previewBusy('Preparando apresentação', rotulo)
    : libBusy(rotulo, opts && opts.chave);
  const notif = bgTaskStart('Preparando apresentação', 1);
  let primeira = null;   // uma página basta para o descarte: ele apaga a pasta
  try {
    return await withBgWork(async () => {
      const r = await AVNative.deckPages(origem, rotulo, (feitas, total) => {
        const pct = total ? Math.floor((feitas / total) * 100) : -1;
        bg.atualizar('Preparando página ' + feitas + (total ? ' de ' + total : '') + '…', null, pct);
      });
      if (!r || !Array.isArray(r.pages) || !r.pages.length) {
        // Num shell < 22 não vem `erro` nenhum: o aviso sai sem detalhe, que é
        // exatamente o que ele já fazia.
        deckUltimoErro = (r && r.erro) ? String(r.erro) : 'o shell não devolveu páginas';
        return null;
      }
      primeira = r.pages[0];
      // TRUNCADA PELO SHELL (`truncado`, campo que o shell novo passa a
      // enviar): um deck cortado sem aviso leria como "o arquivo era assim", e
      // o operador só descobriria na frente da congregação, na página que não
      // existe. Campo ausente (shell antigo) = sem aviso, como sempre.
      if (r.truncado) avisar('Apresentação truncada em ' + r.pages.length + ' páginas', 'erro');
      // Uma página de cada vez: as imagens já estão no cache do aparelho, e
      // buscar as dezenas de uma vez só encheria a memória sem ganhar tempo.
      const pages = [];
      for (const u of r.pages) {
        const res = await fetch(u);
        if (!res.ok) { deckUltimoErro = 'página ' + (pages.length + 1) + ': HTTP ' + res.status; return null; }
        const b = await res.blob();
        if (!b.size) { deckUltimoErro = 'página ' + (pages.length + 1) + ' veio vazia'; return null; }
        pages.push(b);
      }
      const thumb = await makeThumb(pages[0], 'image');
      return await AVDB.addDeck(pages, {
        name: r.name || rotulo, thumb, list: (opts && opts.lista) || 'imports',
      });
    });
  } catch (e) {
    console.warn('[apresentação] falhou:', e && e.message);
    deckUltimoErro = 'web: ' + ((e && e.message) || 'erro sem mensagem');
    return null;
  } finally {
    // No `finally`, como o `ytDiscard`: mesmo que a cópia falhe, as páginas do
    // cache não podem ficar para trás — ninguém mais tem o token delas.
    if (primeira) AVNative.deckDiscard(primeira);
    bgTaskEnd(notif);
    bg.soltar();
  }
}

// O arquivo do vídeo: o que JÁ está no aparelho, ou um download novo.
//
// Até a v5.86 cada destino baixava por conta própria — tocar agora, adicionar
// à playlist e adicionar ao Cronograma eram três downloads do MESMO vídeo, de
// dezenas de MB, muito provavelmente em rede de celular. O registro guarda o
// `youtubeId` desde que é criado, então a pergunta "já tenho isto?" custa uma
// leitura de índice (`AVDB.mediaByYoutube`), sem desserializar blob nenhum.
//
// Só reaproveita quem tem BLOB — arquivo de verdade no aparelho. Um item de
// PLAYER (o link, sem bytes) carrega o mesmo `youtubeId` e é justamente o que
// esta função existe para substituir: aceitá-lo faria o botão "baixar o vídeo"
// da linha do Cronograma devolver o próprio link e parecer que não fez nada.
async function ytArquivo(alvo, opts) {
  const vid = alvo && alvo.id ? alvo.id : null;
  // O REAPROVEITAMENTO É POR FORMA (v5.112): quem pediu só o áudio não pode
  // receber o vídeo de 80 MB que já estava aqui — e quem pediu o vídeo não pode
  // receber um arquivo sem imagem. As duas formas convivem no banco com o mesmo
  // `youtubeId`, e é o `kind` que as separa.
  const soAudio = !!(opts && opts.somenteAudio);
  const ja = vid ? await AVDB.mediaByYoutube(vid, soAudio ? 'audio' : 'video') : null;
  if (ja && ja.blob) return ja;
  return ytBaixarNativo(alvo.url, alvo.name, Object.assign({ youtubeId: vid }, opts || {}));
}

// A prateleira da mídia avulsa — a que está em cena sem pertencer a lista
// nenhuma. É o que permite "Tocar agora" (e o share no simplificado) não
// encostar no Cronograma sem deixar registro órfão, que o gc nunca alcançaria.
//
// Ela é PEQUENA e tem tamanho fixo, porque os dois extremos são ruins: com um
// lugar só, voltar ao vídeo anterior baixa tudo de novo — exatamente o
// desperdício que a v5.87 existe para acabar; sem limite, a mídia que a tela
// não mostra vira uma pilha de centenas de MB que o operador não tem como
// apagar (não há tela de liberar espaço). Três cobre o uso real — alternar
// entre dois ou três vídeos num mesmo culto — e para por aí.
//
// Sai o mais ANTIGO (a lista guarda ordem de chegada), e quem sai passa pelo
// `listRemove`, que decide sozinho se o blob morre: ele fica inteiro se o
// Cronograma, a playlist ou um Favorito também o tiverem.
//
// Aceita um LOTE, e o lote nunca é podado: um share pode trazer cinco arquivos
// de uma vez, e com o limite aplicado item a item os primeiros seriam apagados
// pelos últimos DA MESMA LEVA — inclusive o que vai ser projetado, que é o
// primeiro. Quem cede lugar é sempre o que já estava aqui de antes.
const AVULSO_MAX = 3;
async function fixarAvulso(novos) {
  const lote = (Array.isArray(novos) ? novos : [novos]).filter(Boolean);
  if (!lote.length) return;
  const ids = await AVDB.listIds('avulsos');
  for (const id of lote) if (!ids.includes(id)) await AVDB.listAdd('avulsos', id);
  const outros = ids.filter((x) => !lote.includes(x));
  const cabem = Math.max(0, AVULSO_MAX - lote.length);
  const excedente = outros.slice(0, Math.max(0, outros.length - cabem));
  for (const velho of excedente) await AVDB.listRemove('avulsos', velho);
}

// Sentinela: o link SE RESOLVEU SOZINHO e não sobrou registro para entregar.
// Não é erro (`null`) nem item pronto, e são dois casos:
//
//  - no avançado, a folha de escolhas está NA TELA e quem decide agora é o
//    operador;
//  - no simplificado, o vídeo JÁ ESTÁ NO TELÃO, transmitido.
//
// Nos dois, o `focarImportado` do `importShare` só faria estrago: ele passa por
// `sairDasCamadas`, que fecharia a folha — e no simplificado redesenharia a
// tela por cima de uma projeção que acabou de começar.
const SHARE_TRATADO = Symbol('tratado');

// Devolve o registro criado — quem compartilhou precisa saber QUAL item
// chegou para poder levar o operador até ele (ver focarImportado).
async function handleSharedUrl(url, title) {
  if (!url) return null;
  const ytId = extractYouTubeId(url);
  if (ytId) {
    // NO AVANÇADO, AS MESMAS QUATRO ESCOLHAS DA BUSCA (v5.137).
    //
    // Um link compartilhado e um resultado da busca são o MESMO item — um vídeo
    // do YouTube que o operador quer no app —, e as duas portas davam em
    // lugares diferentes: a busca PERGUNTA (tocar · playlist · Cronograma ·
    // Favoritos, mais vídeo/só-áudio e o teto de resolução) e o share DECIDIA
    // sozinho, sempre vídeo, sempre no Cronograma, sempre no padrão de
    // qualidade. Quem compartilha um louvor de 40 min para tocar no fundo
    // recebia 1080p inteiro, sem ter como dizer que só queria o áudio.
    //
    // NO SIMPLIFICADO continua sem pergunta, e não por esquecimento: ali não
    // existe Cronograma nem playlist, o item vai direto ao telão, e uma folha
    // com destinos que a tela não tem seria pior que folha nenhuma. É a mesma
    // regra do toque numa música do acervo naquele modo (`simplePlaySong`).
    if (!simplificado()) {
      // O `sairDasCamadas()` do `importShare` já rodou: a folha abre sobre o
      // Cronograma, com todo popup anterior fechado.
      // O `title` do share é o `EXTRA_SUBJECT` do Android, e nem todo app o
      // preenche com o TÍTULO: alguns repetem a própria URL ali. Uma folha com
      // um endereço cru no cabeçalho não diz nada a mais que "vídeo do
      // YouTube" — e diz pior. O nome definitivo do item vem da extração, de
      // qualquer jeito (ver `ytBaixarNativo`); isto aqui é só o cabeçalho.
      const rotulo = (title && !/^https?:\/\//i.test(title.trim())) ? title : 'Vídeo do YouTube';
      openYtMenu({ id: ytId, url, name: rotulo });
      return SHARE_TRATADO;
    }
    // NO SIMPLIFICADO, TOCA DIRETO DA REDE (v5.138) — o mesmo que o "Tocar
    // agora" do avançado já faz. Ali o link compartilhado É um "tocar agora":
    // ele vai direto ao telão, não entra em lista visível nenhuma e ninguém
    // pediu para GUARDAR nada. Esperar centenas de MB baixarem para começar a
    // projetar era exatamente a espera que a transmissão direta existe para
    // acabar, e ela estava disponível o tempo todo — só não era tentada por
    // esta porta.
    //
    // `tentarTransmitir` já faz tudo quando dá certo: grava o registro em
    // `avulsos` (o mesmo destino que o share do simplificado usa), redesenha e
    // projeta. Falhando qualquer coisa — shell antigo, vídeo sem par
    // adaptativo, WebView sem o codec — ela devolve `false` e a linha abaixo
    // segue para o download de sempre, calado: o operador pediu o louvor, não
    // o método.
    const alvoStream = { id: ytId, url, name: title || ('YouTube: ' + ytId) };
    if (await tentarTransmitir(alvoStream, YT_ALTURAS[0], false)) return SHARE_TRATADO;
    // O link vira ARQUIVO — é a via que toca em segundo plano e não depende da
    // rede durante o culto. Falhando (vídeo restrito, shell antigo), cai no
    // item de player de sempre: um link compartilhado nunca se perde.
    // A via NATIVA — extração no próprio aparelho, sem servidor nenhum no meio
    // (ver `ytBaixarNativo` e YoutubeGrab.kt). Não pede configuração, não
    // depende de instância de terceiro e sai do IP do chip do operador, que é
    // justamente o que o YouTube não bloqueia.
    // No simplificado o item vai DIRETO ao telão (ver focarImportado), então o
    // aviso pertence à preview; no avançado ele só entra no Cronograma.
    // Compartilhar DE NOVO o mesmo vídeo não baixa de novo: `ytArquivo`
    // devolve o que já está no aparelho. Ele pode estar só no slot avulso
    // (foi tocado sem entrar em lista), e no avançado um share vai para o
    // Cronograma — daí o `listAdd`, idempotente para o caso de já estar lá.
    const nativo = await ytArquivo(
      { id: ytId, url, name: title || ('YouTube: ' + ytId) },
      { lista: destinoDoShare(), naPreview: simplificado() },
    );
    if (nativo) return guardarShare(nativo);
    return guardarShare(await AVDB.addUrlMedia(url, {
      kind: 'youtube',
      type: 'video/youtube',
      name: title || ('YouTube: ' + ytId),
      thumb: 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg',
      youtubeId: ytId,
      list: destinoDoShare(),
    }));
  }
  // APRESENTAÇÃO DO GOOGLE: o link vira PDF exportado e, daí, imagens — quem
  // sabe montar a URL de exportação é o shell (`deckExportUrl`), porque é ele
  // que sabe o que consegue abrir. Precisa estar compartilhada por link, que é
  // como um roteiro de culto circula; sem permissão a exportação falha e o link
  // cai no caminho de sempre (item de URL).
  if (window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= 19) {
    const exportacao = AVNative.deckExportUrl(url);
    if (exportacao) {
      const rec = await deckImportar(exportacao, title || 'Apresentação', {
        naPreview: simplificado(), lista: destinoDoShare(),
      });
      if (rec) return guardarShare(rec);
    }
  }
  const kind = detectUrlKind(url);
  const fallbackName = url.split('/').pop().split('?')[0] || url;
  return guardarShare(await AVDB.addUrlMedia(url, {
    kind,
    type: kind + '/url',
    name: title || fallbackName,
    thumb: null,
    list: destinoDoShare(),
  }));
}

// No SIMPLIFICADO um link compartilhado só toca — não existe Cronograma nesse
// modo, e pendurar o vídeo numa lista que a tela não mostra é guardar sem
// pedir. É a mesma regra do toque numa música do acervo ali (`simplePlaySong`,
// que também não abre folha de escolha) e a mesma de "Tocar agora": o destino
// é o slot avulso, que segura a mídia enquanto ela é a cena e a solta quando
// outra entra.
//
// Vale para LINK, não para arquivo. Um share de arquivos pode trazer vários de
// uma vez, e com um slot só cada um apagaria o anterior — ali o Cronograma
// continua sendo o destino nos dois modos.
function simplificado() { return appMode === 'simple'; }

// OS DESTINOS DO LOTE QUE ESTÁ ENTRANDO (v5.141). No avançado quem os escolhe é
// o operador, na folha (ver `escolherDestinos`); no simplificado a pergunta não
// existe e o valor é ignorado, porque lá tudo vai para a prateleira avulsa.
//
// Uma variável de módulo, e não um parâmetro carregado por dez funções: o
// caminho do share atravessa `handleSharedUrl`, `deckImportar`, `pptxImportar` e
// `AVDB.addMedia`, todos já recebendo `lista` como um nome só. O que mudou é
// quantas listas existem DEPOIS da primeira — e essa parte é sempre a mesma
// (`espalharShare`).
let shareDestinos = ['cronograma'];
function destinoDoShare() {
  return simplificado() ? 'avulsos' : listaDoDestino(shareDestinos[0]);
}
// As listas ALÉM da primeira. Quem cria o registro já o grava na primeira, na
// mesma transação; as outras são um `listAdd` idempotente por item.
async function espalharShare(id) {
  if (simplificado() || !id) return;
  const listas = listasDosDestinos(shareDestinos).slice(1);
  for (const l of listas) await AVDB.listAdd(l, id);
}
async function guardarShare(rec) {
  if (!rec) return rec;
  // No simplificado quem prende o registro na prateleira é o `importShare`, de
  // uma vez só para todo o lote (ver `fixarAvulso`). Aqui só resta o avançado.
  if (!simplificado()) {
    // O registro pode ser um REAPROVEITADO que estava só na prateleira avulsa.
    await AVDB.listAdd(destinoDoShare(), rec.id);
    await espalharShare(rec.id);
    await AVDB.listRemove('avulsos', rec.id);
  }
  return rec;
}

// Importa um share já normalizado. Aceita as DUAS formas de arquivo:
//   - `File` (navegador: o SW gravou o POST multipart em pending-share);
//   - `{ name, type, url }` (app nativo: a ponte entrega URL servível e os
//     bytes vêm por fetch, nunca base64).
// Daqui pra baixo o caminho é o mesmo dos arquivos importados à mão.
async function importShare(pending) {
  if (!pending) return false;
  let added = false;
  let primeiro = null;   // o 1º item que entrou: é ele que o foco vai buscar
  // A RESPOSTA VEM PRIMEIRO. Um link do YouTube vira arquivo em minutos e um
  // vídeo compartilhado leva segundos para ser copiado; sair do acervo (ou da
  // Bíblia, ou de uma pasta) só no fim disso deixava o operador olhando a tela
  // que ele já tinha deixado, sem sinal de que algo chegou. O cartão de
  // progresso aparece sobre a preview — que agora está à vista justamente
  // porque saímos das camadas antes, e não depois.
  await sairDasCamadas();

  const files = pending.files || [];
  // PARA ONDE VAI ISTO? (v5.141) — a pergunta que o app respondia sozinho.
  //
  // Ela não vale para TUDO o que chega: um link do YouTube abre a folha própria
  // dele logo abaixo (com os mesmos destinos, mais a forma e a qualidade), e
  // perguntar duas vezes pelo mesmo item seria pior que não perguntar. E no
  // simplificado `escolherDestinos` já devolve `null` sozinho — ali não existe
  // Cronograma nem playlist.
  //
  // Desistir (✕, fundo, voltar) devolve `null` e o lote entra no Cronograma,
  // como sempre entrou: um compartilhamento nunca se perde por causa de uma
  // pergunta.
  shareDestinos = ['cronograma'];
  const temLinkYt = !!(pending.url && extractYouTubeId(pending.url));
  if (files.length || (pending.url && !temLinkYt)) {
    const titulo = files.length > 1 ? 'Importar ' + files.length + ' itens' : 'Importar';
    const escolha = await escolherDestinos(titulo, ['cronograma']);
    if (escolha && escolha.length) shareDestinos = escolha;
  }
  // No simplificado NADA de um share vai para lista visível — arquivo inclusive
  // (v5.89): a tela não tem Cronograma nem playlist, e o que chega ali chega
  // para ir ao telão. Os ids do lote são fixados JUNTOS no fim, senão o quinto
  // arquivo empurraria o primeiro para fora — e o primeiro é justamente o que
  // vai ser projetado.
  const lote = [];
  let naoAbriu = null;   // o último arquivo que o app não conseguiu abrir
  let ok = 0;
  for (const item of files) {
    // DOCUMENTO (PDF ou PowerPoint): vira uma imagem por página, e cada formato
    // pelo caminho que existe para ele. O desvio acontece ANTES da leitura
    // porque o PDF não pode virar blob aqui — quem o desenha é o shell, e ele
    // precisa do arquivo ORIGINAL (a URL `/saf/`), não de uma cópia já lida.
    //
    // Este ramo atende as DUAS portas de entrada, que entregam a mesma forma:
    // o compartilhamento e o seletor do sistema (`importarPeloSistema`).
    if (ehApresentacao(item)) {
      const nome = nomeSemExtensao((item && item.name) || 'Apresentação');
      let rec = null;
      if (ehPdf(item) && !item.url) {
        // PDF sem URL servível: veio como `File` (o `<input type="file">` do
        // navegador, ou de um shell antigo). Quem desenha o PDF é o shell, e
        // ele precisa do ARQUIVO — não há caminho daqui.
        deckUltimoErro = window.__NATIVE__
          ? 'PDF precisa do seletor de arquivos do app (instale a versão nova)'
          : 'o navegador não desenha PDF; use o app';
      } else if (ehPdf(item)) {
        // PDF: quem desenha é o shell, e ele precisa do ARQUIVO (a URL `/saf/`),
        // não de uma cópia já lida — por isso o desvio acontece ANTES da leitura.
        rec = await deckImportar(item.url, nome, {
          naPreview: simplificado(), lista: destinoDoShare(),
        });
      } else if (ehPptx(item)) {
        // PPTX: quem desenha é o próprio WebView (ver `pptxParaPaginas`), então
        // aqui os bytes SERVEM — e é o único caminho que existe para ele.
        let arquivo = item instanceof File ? item : null;
        if (!arquivo && item.url) {
          try {
            const res = await fetch(item.url);
            if (res.ok) arquivo = await res.blob();
            else deckUltimoErro = 'não deu para ler o arquivo (HTTP ' + res.status + ')';
          } catch (e) {
            arquivo = null;
            deckUltimoErro = 'não deu para ler o arquivo: ' + ((e && e.message) || 'erro');
          }
        }
        if (arquivo) rec = await pptxImportar(arquivo, nome, {
          naPreview: simplificado(), lista: destinoDoShare(),
        });
      }
      if (rec) {
        // O registro nasceu na PRIMEIRA lista escolhida; as demais são um
        // `listAdd` por item (ver `espalharShare`).
        await espalharShare(rec.id);
        if (!primeiro) primeiro = rec.id;
        lote.push(rec.id);
        ok++;
      } else {
        // Arquivo que não abre (PDF com senha, PPTX corrompido): DIÁLOGO, e não
        // silêncio. O operador acabou de escolher um arquivo; nada acontecer
        // leria como "importou".
        naoAbriu = nome;
      }
      continue;
    }
    let blob = null;
    let name = '';
    if (item instanceof File) {
      blob = item;
      name = item.name;
    } else if (item && item.url) {
      try {
        const res = await fetch(item.url);
        if (!res.ok) continue;
        blob = await res.blob();
      } catch (_) { continue; }
      name = item.name || 'arquivo';
    } else {
      continue;
    }
    // O tipo vem da extensão (mesma fonte usada na sincronização de pastas):
    // provedores do Android costumam devolver MIME genérico.
    const type = guessMediaType(name) || blob.type;
    const kind = AVDB.kindFromType(type);
    const { thumb, height, seconds } = await prepararMidia(blob, kind);
    const rec = await AVDB.addMedia(blob, {
      name: name.replace(/\.[^.]+$/, ''), type, kind, thumb, height, seconds,
      list: destinoDoShare(),
    });
    // Só conta o que DE FATO entrou: um `addMedia` que falha com `ok++` fora
    // da guarda fazia o share terminar como sucesso sem item nenhum.
    if (rec) {
      await espalharShare(rec.id);
      if (!primeiro) primeiro = rec.id;
      lote.push(rec.id);
      ok++;
    }
  }
  if (ok > 0) added = true;

  // O LINK PODE SE RESOLVER SOZINHO (ver `SHARE_TRATADO`): a folha de escolhas
  // está na tela, ou a transmissão já está no telão. Nos dois casos não há item
  // a entregar, e chamar o `focarImportado` logo abaixo só faria estrago.
  let tratado = false;
  if (pending.url) {
    const rec = await handleSharedUrl(pending.url, pending.title);
    if (rec === SHARE_TRATADO) tratado = true;
    else {
      if (rec && !primeiro) primeiro = rec.id;
      if (rec) lote.push(rec.id);
    }
    added = true;
  }
  // Um share traz arquivos OU um link, mas a fixação é uma só de propósito: se
  // um dia vierem os dois, duas chamadas fariam a segunda expulsar a primeira.
  if (simplificado()) await fixarAvulso(lote);
  // As listas que não são a que está em cena precisam ser relidas: a estrela de
  // cada linha vem de `favSet`, e a fila da playlist de `plItems`.
  const listasEscolhidas = simplificado() ? [] : listasDosDestinos(shareDestinos);
  if (listasEscolhidas.includes('favs')) await recarregarFavoritos();
  if (listasEscolhidas.includes('playlist')) {
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
  }
  if (added && !tratado) await focarImportado(primeiro);
  // DIZER PARA ONDE FOI, e só quando não for óbvio. `focarImportado` leva o
  // operador ao Cronograma — a resposta visual de sempre —, mas um item que foi
  // para os Favoritos ou para a playlist não aparece ali, e sem uma frase o
  // import terminaria parecendo que nada entrou.
  if (added && !tratado && lote.length
    && (listasEscolhidas.length > 1 || (listasEscolhidas.length === 1 && listasEscolhidas[0] !== 'imports'))) {
    const quantos = lote.length === 1 ? '1 item adicionado ' : lote.length + ' itens adicionados ';
    avisar(quantos + ondeDe(listasEscolhidas, 'para') + '.', 'ok');
  }
  if (naoAbriu) await avisarNaoAbriu(naoAbriu);
  return added;
}

// O QUE CHEGOU PRECISA FICAR NA FRENTE DO OPERADOR.
//
// Um compartilhamento é sempre um pedido explícito e imediato — ninguém manda
// um vídeo para o app de projeção "para depois". Só que o app pode estar em
// qualquer lugar quando ele chega: na aba Bíblia, com o acervo aberto em tela
// cheia, dentro de uma pasta dos Favoritos, com a seleção múltipla ligada. Até
// a v5.76 o item entrava na lista `imports` e a variável `activeTab` era
// trocada por baixo de tudo isso — o operador voltava para o app e via
// exatamente a tela que tinha deixado, sem sinal nenhum de que algo chegou.
//
// Duas respostas, uma por modo, porque os dois modos querem coisas diferentes:
//
// - **Simplificado**: PROJETA na hora. Esse modo existe para quem não vai
//   operar nada — a lista sequer aparece ali, então "adicionei ao Cronograma"
//   não significa nada. Quem compartilha um louvor com o app já conectado à TV
//   quer aquilo no telão.
// - **Avançado**: leva para o **Cronograma**, que é onde o item entrou, e
//   deixa a decisão de projetar com o operador — ele pode estar com outra
//   coisa no ar neste exato momento.
// A metade que RESPONDE AO TOQUE, separada da que projeta — porque as duas
// acontecem em momentos diferentes (v5.83). Um link do YouTube leva minutos
// para virar arquivo, e até aqui o app só saía do acervo DEPOIS que o download
// terminava: o operador compartilhava, voltava para o app e continuava vendo a
// tela do acervo, sem sinal nenhum de que algo estava acontecendo. É o mesmo
// princípio que `playSongVariant` já seguia — "a resposta vem primeiro" — e ele
// vale ainda mais aqui, onde a espera é de minutos e não de segundos.
async function sairDasCamadas() {
  // 1. Sai de tudo que está POR CIMA da lista, em qualquer modo: um acervo em
  //    tela cheia esconderia tanto o Cronograma quanto a tela simplificada.
  if (selectionMode) exitSelection();
  POPUPS.forEach(([backdrop, , close]) => {
    if (backdrop.classList.contains('open')) close();
  });
  // 2. A preview em tela cheia só sai quando há TELÃO. Sem telão conectado ela
  //    É a projeção (ver "Divergências"), e derrubá-la para mostrar uma lista
  //    tiraria do ar o que estiver em cena — caro demais para um import.
  if (document.fullscreenElement && displayActive()) {
    try { await document.exitFullscreen(); } catch (_) {}
  }

  // 3. Fora do Cronograma, volta para ele — inclusive de dentro de uma pasta
  //    dos Favoritos, que é um `activeTab` próprio ('folders'). No simplificado
  //    não há abas: basta redesenhar.
  if (appMode !== 'simple' && activeTab !== 'imports') await switchTab('imports');
  else await load();
}

// E a metade que PROJETA, chamada quando o item finalmente existe.
async function focarImportado(id) {
  await sairDasCamadas();
  // No simplificado o item vai direto ao telão: esse modo existe para quem não
  // vai operar nada, e a lista sequer aparece nele.
  if (appMode === 'simple' && id) await send(id);
}

// (A leitura do estado `pending-share` saiu: quem o escrevia era o service
// worker dos dois PWAs, removido do bundle na v5.48 — era uma chave que
// ninguém escreve desde então.)
function registrarShareNativo() {
  // App nativo: o share chega por intent (AVNative.onShare) — o intent-filter
  // entrega o conteúdo direto, sem depender de um POST interceptado.
  if (!window.__NATIVE__) return;
  AVNative.onShare((share) => {
    importShare(share).catch((e) => {
      // O intent já foi CONSUMIDO no Kotlin: não existe segunda entrega. Sem
      // este catch a rejeição virava unhandled rejection no console e o
      // compartilhamento evaporava sem nenhum rastro visível.
      diagC('share falhou: ' + ((e && e.message) || e));
      avisar('Não deu para importar o compartilhamento', 'erro');
    });
  });
}

// ===== feedback rápido =====
// O sistema de alerta FLUTUANTE (toast) foi removido: as informações agora são
// transmitidas pela própria interface de design (estados dos botões, contadores,
// listas e — para a sincronização — o texto no card da coleção, ver
// setCollStatus/renderCollectionCard). flash() virou no-op para não precisar
// mexer nos pontos de chamada LEGADOS que restam espalhados pelo arquivo;
// qualquer mensagem que antes ia pro toast simplesmente não aparece mais.
// (Os pontos em que o aviso era o ÚNICO canal migraram para `avisar()` na
// auditoria de agosto/2026 — OTA pelo rótulo de versão, desfecho do share,
// sincronização de pastas e o "Baixando…" do acervo.)
//
// FEEDBACK NOVO NÃO USA flash(): quando o aviso é o único canal (nenhum botão,
// linha ou card na tela para responder), o canal é `avisar()` — a faixa de
// aviso logo abaixo, que se dispensa sozinha. Chamar flash() em código novo é
// escrever uma mensagem que ninguém verá.
function flash() { /* no-op: alerta flutuante removido (ver comentário acima) */ }

// ===== Aviso de salvamento (v5.104) =====
// A exceção à regra acima, e ela tem um limite claro: **só para o que o
// operador NÃO vê acontecer**. Mandar um item para o Cronograma estando na aba
// da Bíblia, favoritar de dentro do acervo, guardar um preset das Ferramentas —
// nesses casos a lista de destino não está na tela, o toque não muda um pixel e
// não há como saber se funcionou senão indo conferir. É assim que se acaba
// tocando duas vezes.
//
// O que ele NÃO é: o toast de volta. Não flutua (mora no fim da área de lista),
// não cobre o transporte (foi por isso que o toast saiu), não pede toque para
// sair e não é usado por nada que já tenha estado próprio na tela.
//
// `tipo`: 'ok' (entrou) | 'dup' (já estava lá) | 'erro'. A distinção é o ponto:
// "já estava nos favoritos" é a resposta que impede a duplicação acidental, e
// ela precisa ser visivelmente diferente de "adicionado".
const saveHintEl = document.getElementById('saveHint');
const AVISO_MS = 2400;
let avisoTimer = null;

// ===== O PULSO NO PRÓPRIO BOTÃO (v5.106) =====
// É este o feedback de adicionar/favoritar, e não a faixa de aviso: o dedo já
// está no botão e o olho também, e com dois destinos lado a lado (as
// Ferramentas têm "Cronograma" e "Favoritos") uma mensagem genérica não diria
// em qual dos dois se tocou.
//
// A faixa (`avisar`) ficou para o que o botão não consegue dizer: o MOTIVO de
// uma falha ("sem este capítulo no aparelho e sem internet para baixar") e os
// caminhos em que o botão tocado desaparece antes da resposta — a folha do
// acervo, por exemplo, que fecha porque o download pode levar minutos.
const PULSO_MS = 1100;

// "Está na tela?" não é `isConnected`: as folhas deste app fecham por
// `opacity: 0` (o nó continua no documento), e a barra de seleção some pelo
// atributo `hidden`. Sem os dois testes, o pulso "aconteceria" numa folha
// fechada e o caminho ficaria mudo — que é justamente o defeito que ele veio
// resolver.
function visivelNaTela(el) {
  if (!el || !el.isConnected) return false;
  if (el.offsetParent === null) return false;            // display:none em algum ancestral
  return !el.closest('.popup-backdrop:not(.open)');      // folha fechada
}

function pulsar(btn, tipo) {
  if (!visivelNaTela(btn)) return false;
  clearTimeout(btn._pulsoTimer);
  const classes = ['btn-pulso', 'btn-pulso--' + (tipo || 'ok')];
  btn.classList.remove('btn-pulso--ok', 'btn-pulso--dup', 'btn-pulso--erro');
  // Reinicia a transição quando o mesmo botão é tocado duas vezes seguidas:
  // sem o reflow, o segundo pulso não se distingue do primeiro ainda em cena.
  void btn.offsetWidth;
  btn.classList.add(...classes);
  btn._pulsoTimer = setTimeout(() => {
    btn.classList.remove('btn-pulso', 'btn-pulso--ok', 'btn-pulso--dup', 'btn-pulso--erro');
  }, PULSO_MS);
  return true;
}

// Responde no BOTÃO quando ele ainda está na tela; cai na faixa quando não
// está (folha fechada, lista redesenhada). Um só ponto de decisão, para nenhum
// caminho ficar mudo por esquecimento.
function responder(btn, tipo, texto) {
  if (pulsar(btn, tipo)) return;
  if (texto) avisar(texto, tipo);
}

function avisar(texto, tipo) {
  if (!saveHintEl || !texto) return;
  clearTimeout(avisoTimer);
  saveHintEl.textContent = texto;
  saveHintEl.className = 'save-hint save-hint--' + (tipo || 'ok');
  saveHintEl.hidden = false;
  // Reinicia a animação de entrada mesmo com o aviso já em cena (dois toques
  // seguidos): sem o reflow, o segundo aviso trocaria o texto sem nenhum
  // movimento e pareceria o primeiro, ainda parado ali.
  saveHintEl.classList.remove('on');
  void saveHintEl.offsetWidth;
  saveHintEl.classList.add('on');
  avisoTimer = setTimeout(() => {
    saveHintEl.classList.remove('on');
    // O `hidden` só no fim da saída, senão ele some com corte seco.
    avisoTimer = setTimeout(() => { saveHintEl.hidden = true; }, 220);
  }, AVISO_MS);
}

// ===== Proporção da preview =====
// A preview é uma MINIATURA FIEL do telão, e isso só se sustenta se ela tiver a
// PROPORÇÃO do telão. Ela era 16:9 fixo — contra uma TV 2,17:1 (3120×1440, um
// dongle comum), toda mídia mentia: uma imagem que preenche a preview ganha
// barras laterais na projeção, um vídeo enquadrado aqui aparece cortado lá, e um
// versículo que cabe em 3 linhas no telão aparecia truncado no meio da palavra.
//
// O resto do dimensionamento (letra, camada de texto) já é em `cq*`, relativo ao
// container — ou seja, INVARIANTE DE ESCALA: com a proporção certa, os mesmos
// números dão a mesma composição numa caixa de 280px e num telão de 3120px. Por
// isso a calibração da preview deixou de ser uma cópia com valores próprios e
// passou a repetir exatamente os do Display: o que fazia os valores divergirem
// era a proporção errada, não o tamanho.
//
// Sem TV conectada a projeção é a própria preview em tela cheia, no celular —
// então o alvo passa a ser a tela do aparelho em paisagem.
// Limites: a preview divide a linha com os dois botões de estrofe, que precisam
// continuar sendo alvos de toque utilizáveis. Telas reais de projeção ficam
// entre 4:3 e ~2,2:1, bem dentro da faixa; um painel 32:9 bateria no teto e
// deixaria de ser proporcional — troca deliberada, e o clamp é o que impede a
// linha de estourar.
const PV_AR_MIN = 1.2;
const PV_AR_MAX = 2.4;
function applyPreviewAspect(tv) {
  let ar = 16 / 9;
  if (tv && tv.w > 0 && tv.h > 0) {
    ar = tv.w / tv.h;
  } else if (window.screen && screen.width && screen.height) {
    // Projeção por tela cheia: a "tela real" é este aparelho, deitado.
    ar = Math.max(screen.width, screen.height) / Math.min(screen.width, screen.height);
  }
  ar = Math.min(PV_AR_MAX, Math.max(PV_AR_MIN, ar));
  document.documentElement.style.setProperty('--pv-ar', String(ar));
}
// Vale também no navegador (sem ponte): ali o alvo é sempre a tela do aparelho.
applyPreviewAspect(null);

// ===== Wallpaper personalizado =====
// A cortina do telão (e da preview) aceita uma imagem no lugar do gradiente
// padrão. O blob mora no state `wallpaper`, compartilhado com o Display; o
// comando `wallpaper` só avisa que mudou.
let pvWallpaperUrl = null;
// Há imagem escolhida agora? O seletor do popup de Exibição usa o mesmo
// componente segmentado do Preenchimento, mas nunca acendia nenhum segmento —
// o operador não tinha como saber qual wallpaper estava no telão sem fechar o
// popup e olhar a preview, e "Padrão" (que descarta a imagem) parecia um
// estado desmarcado em vez de uma ação.
let customWallpaper = false;

async function applyPvWallpaper() {
  let blob = null;
  try { blob = await AVDB.getState('wallpaper'); } catch (_) { /* segue no padrão */ }
  customWallpaper = blob instanceof Blob;
  renderWallSeg();
  if (pvWallpaperUrl) { URL.revokeObjectURL(pvWallpaperUrl); pvWallpaperUrl = null; }
  const brand = pvWallEl.querySelector('.pv-brand');
  if (blob instanceof Blob) {
    pvWallpaperUrl = URL.createObjectURL(blob);
    pvWallEl.style.backgroundImage = 'url("' + pvWallpaperUrl + '")';
    if (brand) brand.hidden = true;
  } else {
    pvWallEl.style.backgroundImage = '';
    if (brand) brand.hidden = false;
  }
}

// Reduz a imagem escolhida para caber num telão 1080p. O operador costuma
// pegar uma foto do próprio celular (12 MP): guardar e decodificar isso a
// cada abertura do Display seria desperdício puro — a cortina nunca passa da
// resolução da TV.
async function fitWallpaperImage(file) {
  const MAX_W = 1920;
  const MAX_H = 1080;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const scale = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
    if (scale >= 1) return file; // já cabe: guarda o original, sem recomprimir
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    return blob || file; // toBlob pode falhar em imagens enormes
  } catch (_) {
    return file; // formato exótico: guarda como veio
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function setWallpaper(file) {
  const blob = file ? await fitWallpaperImage(file) : null;
  await AVDB.setState('wallpaper', blob);
  customWallpaper = blob instanceof Blob;
  renderWallSeg();
  await applyPvWallpaper();
  // O Display lê o mesmo state — o comando só avisa que mudou.
  AVDB.sendCommand({ type: 'wallpaper' });
}

// ===== trabalho pesado com o app minimizado =====
// No app nativo, minimizar faz o Android tratar o processo como descartável e
// congelá-lo — e a sincronização (hinos, álbuns, Bíblia, pastas) morria no
// meio. Como ninguém fica olhando a tela enquanto um hinário inteiro baixa,
// isso acontecia justamente no uso normal.
//
// A ponte declara esse trabalho ao sistema (SyncService, um serviço em
// primeiro plano). Aqui só contamos quantos downloads estão em curso, para
// ligar no primeiro e desligar no último — dois downloads simultâneos não
// podem fazer o primeiro a terminar desligar a proteção do outro.
//
// No NAVEGADOR tudo isto é no-op: a aba já continua baixando em segundo plano.
let bgWorkCount = 0;

function bgWorkBegin() {
  if (!window.__NATIVE__) return;
  if (++bgWorkCount === 1) AVNative.keepAlive(true);
}

function bgWorkEnd() {
  if (!window.__NATIVE__) return;
  if (bgWorkCount > 0 && --bgWorkCount === 0) {
    // O `clear()` é a rede de segurança para uma tarefa que ficou órfã, mas
    // ele SOZINHO deixava o compasso ligado para sempre: com o `bgTasks` já
    // vazio, o `bgTaskEnd` que vinha depois achava o Map vazio, o `delete`
    // devolvia false e nem o `bgPacerSync()` nem o envio final rodavam — o
    // `setInterval` de 250 ms vazava pelo resto da sessão, batendo na ponte a
    // cada 2 s com uma tarefa vazia (notificação "Baixando mídias" presa) e,
    // pior, fazendo o próximo `bgTaskStart` reusar um pacer órfão.
    // Sincronizar aqui torna `bgWorkEnd` idempotente: a ordem entre ele e o
    // `bgTaskEnd` deixa de importar.
    bgTasks.clear();
    bgPacerSync();
    bgTaskSend(true);
    AVNative.keepAlive(false);
  }
}

// Envolve um trecho pesado. O `finally` é o ponto crítico: uma falha de rede
// no meio do download não pode deixar o serviço (e o wake lock) ligado.
async function withBgWork(fn) {
  bgWorkBegin();
  try { return await fn(); } finally { bgWorkEnd(); }
}

// ===== progresso na notificação do sistema =====
// A notificação do serviço em primeiro plano era estática ("Baixando mídias").
// Com o app minimizado — o uso normal durante uma sincronização — ela é a ÚNICA
// janela para o download, e não dizia quanto falta nem se ainda anda.
//
// REGISTRO de tarefas, não um slot único: o app tem downloads SIMULTÂNEOS (é
// por isso que `bgWorkCount` conta, em vez de ser um booleano) — entrar na aba
// Bíblia enquanto um lote de álbuns baixa dispara os dois ao mesmo tempo. Com
// um slot só, as duas tarefas escreviam uma por cima da outra: o `done` de uma
// aparecia com o `total` e o `startedAt` da outra, e a estimativa pulava de
// 1h30 para 2h40 e voltava. Cada tarefa agora tem seu próprio registro.
const bgTasks = new Map();
let bgTaskSeq = 0;

function bgTaskStart(label, total) {
  if (!window.__NATIVE__) return 0;
  const id = ++bgTaskSeq;
  bgTasks.set(id, {
    label, total: Math.max(1, total), done: 0,
    // FILA de exibição: nomes que entraram em download e ainda não passaram
    // pela linha da notificação. É um buffer, não o conjunto do que está no ar
    // — cada nome sai daqui UMA vez, o que torna a lista fluida e sem repetir.
    fila: [],
    spot: null,          // o nome que está na linha agora
    spotAt: 0,           // desde quando — o compasso decide quando trocar
    lastEventAt: 0,      // último evento REAL (item entrou/saiu, passo) — ver idleMs
    // Marcado no PRIMEIRO item concluído, não aqui: antes dele corre o
    // preparo (índice, varredura do que falta) e contá-lo como se fosse tempo
    // de download inflava a primeira estimativa, que depois despencava.
    firstStepAt: 0,
    shownEta: 0,
    etaAt: 0,        // quando shownEta foi suavizada pela última vez
    // `done`/`total` em BYTES em vez de itens — ver `bgTaskBytes`. Fica no
    // registro (e não num parâmetro do envio) porque a notificação mostra a
    // tarefa DOMINANTE, e um lote de músicas pode estar rodando ao lado de um
    // download de vídeo: a unidade é de cada tarefa, não do envio.
    bytes: false,
  });
  bgPacerSync();
  bgTaskSend(true);
  return id;
}

// COMPASSO da exibição — uma FILA, não um espelho do que está no ar.
//
// A concorrência existe para reduzir o tempo PROPORCIONAL de cada item: se os
// 6 juntos levam X, cada um custou X/6. A exibição segue essa mesma conta —
// cada nome ocupa a linha por X/6 e sai, um depois do outro. É deliberadamente
// ILUSTRATIVO e não em tempo real: os nomes vêm de um buffer do que já entrou
// em download, escoado num ritmo constante.
//
// Duas coisas que só a fila dá:
// - **Não repete.** Um rodízio entre os 6 em voo trazia o mesmo nome de volta
//   várias vezes; a fila consome cada um UMA vez, e a lista anda para a frente.
// - **Não engasga.** Os 6 workers andam em lockstep — começam e terminam
//   quase juntos —, então os eventos chegam em rajada (meia dúzia em poucos
//   ms) seguida de segundos de silêncio. Sem buffer, a rajada rendia UMA troca
//   de nome e o resto era descartado: o nome ficava parado até a rajada
//   seguinte, que é exatamente a sensação de travado.
//
// O ritmo é MEDIDO, não chutado: `decorrido / concluídos` é o tempo médio por
// item — com 6 em paralelo, o tal X/6. Se a fila acumula (rede acelerou), o
// escoamento acelera junto para a lista não ficar exibindo passado velho.
const BG_TICK_MS = 250;        // granularidade do compasso
const BG_SPIN_MIN = 400;       // abaixo disso ninguém consegue ler
const BG_SPIN_MAX = 5000;      // acima disso parece parado
const BG_SPIN_PADRAO = 1200;   // antes do 1º item concluído não há média
const BG_FILA_FOLGA = 3;       // itens em espera tolerados sem acelerar
const BG_REENVIO_MS = 2000;    // reenvio mínimo (faz o idleMs crescer na tela)
const BG_STALL_MS = 90000;     // mesmo limiar do lado nativo (SyncService)

let bgPacer = null;
function bgPacerSync() {
  if (bgTasks.size && !bgPacer) {
    bgPacer = setInterval(bgPacerTick, BG_TICK_MS);
  } else if (!bgTasks.size && bgPacer) {
    clearInterval(bgPacer); bgPacer = null;
  }
}

// Quanto tempo cada nome fica na linha, em ms.
function bgSpinMs(t) {
  let ms = (t.done > 0 && t.firstStepAt)
    ? (Date.now() - t.firstStepAt) / t.done
    : BG_SPIN_PADRAO;
  // Fila crescendo = a exibição está atrasada em relação ao download; escoa
  // proporcionalmente mais rápido em vez de acumular um passado cada vez mais
  // antigo.
  if (t.fila.length > BG_FILA_FOLGA) ms /= (t.fila.length / BG_FILA_FOLGA);
  return Math.min(BG_SPIN_MAX, Math.max(BG_SPIN_MIN, ms));
}

function bgPacerTick() {
  const now = Date.now();
  let mudou = false;
  for (const t of bgTasks.values()) {
    if (!t.fila.length) continue;
    // Travado: a lista CONGELA. Animar durante uma queda de rede esconderia
    // justamente o que precisa ser visto — e aqui não há novidade nenhuma para
    // mostrar, só passado. O `idleMs` cresce e os dois sinais concordam.
    if (t.lastEventAt && (now - t.lastEventAt) >= BG_STALL_MS) continue;
    if (t.spot && (now - t.spotAt) < bgSpinMs(t)) continue;
    t.spot = t.fila.shift();
    t.spotAt = now;
    mudou = true;
  }
  if (mudou || (now - bgLastSentAt) >= BG_REENVIO_MS) bgTaskSend(true);
}

function bgTaskStep(id, done, label) {
  if (!window.__NATIVE__) return;
  const t = bgTasks.get(id);
  if (!t) return;
  if (!t.firstStepAt) t.firstStepAt = Date.now();
  t.done = done;
  t.lastEventAt = Date.now();
  if (label) t.label = label;
  bgTaskSend(false);
}

// Progresso em BYTES — a tarefa passa a ser medida em bytes transferidos, não
// em itens concluídos (v5.118).
//
// O registro nasceu contando ITENS, e para um lote é a unidade certa: 54
// músicas, 1189 capítulos. Mas o download de UM vídeo do YouTube abria a tarefa
// com `total = 1`, e aí os dois números que a notificação existe para dar
// simplesmente não existiam: a barra ficava em 0% do começo ao fim, e
// `bgTaskEta` devolvia ZERO porque ela precisa de pelo menos um item concluído
// para ter uma média. Ou seja, o caso em que a notificação é a ÚNICA janela —
// app minimizado, centenas de MB, minutos de espera — era o caso em que ela não
// dizia nada.
//
// Os bytes sempre estiveram à mão: o shell os reporta a cada MB pelo
// `onProgresso` do `ytFetch`. Faltava um canal para eles. Como percentual e ETA
// são RAZÕES, toda a matemática que já existe vale sem mudar uma linha — trocar
// a unidade é só isto. Quem muda é a apresentação, e essa é a bandeira `bytes`
// que viaja até o `SyncService`.
//
// O `total` vem AQUI e não no `bgTaskStart` porque ele só é conhecido na
// primeira resposta do servidor. Pelo mesmo motivo o `firstStepAt` é marcado no
// primeiro byte: a estimativa passa a medir a taxa de transferência real, sem
// contar a extração (que roda antes e pode levar segundos).
function bgTaskBytes(id, lidos, total) {
  if (!window.__NATIVE__) return;
  const t = bgTasks.get(id);
  if (!t || !(total > 0)) return;
  t.bytes = true;
  t.total = total;
  if (!t.firstStepAt) t.firstStepAt = Date.now();
  t.done = Math.min(lidos, total);
  t.lastEventAt = Date.now();
  bgTaskSend(false);
}

// Um item concreto entrou em download: entra na FILA de exibição. É isto que
// dá a impressão de progresso — "23 de 54" é um número abstrato, "002. Ó
// Adorai o Senhor" é o que o operador reconhece, e ver a lista andar é o que
// mostra que a coisa se move.
//
// Quem decide QUANDO ele aparece é o compasso (bgPacerTick), não este momento:
// os 6 workers entram quase juntos, e mostrar a rajada crua daria uma troca
// só. O primeiro item de todos é promovido na hora, para a notificação não
// nascer sem nome.
function bgItemStart(id, nome) {
  if (!window.__NATIVE__ || !nome) return;
  const t = bgTasks.get(id);
  if (!t) return;
  t.lastEventAt = Date.now();
  if (!t.spot) {
    t.spot = nome; t.spotAt = t.lastEventAt;
    // `force`: este envio vem logo depois do de abertura da tarefa e seria
    // engolido pelo piso — e aí o PRIMEIRO nome da lista nunca apareceria,
    // porque o compasso já o teria substituído no primeiro passo.
    bgTaskSend(true);
    return;
  }
  t.fila.push(nome);
}

// Fluxo SEQUENCIAL (um item por vez, com vários `continue` no laço). Vai para
// a mesma fila: como ali os itens chegam um a um, o ritmo medido acompanha o
// real e a fila praticamente não acumula.
function bgItemOnly(id, nome) {
  bgItemStart(id, nome);
}

// Um item concluiu. Ele NÃO entra na fila aqui — já entrou ao começar; o que
// isto registra é que a tarefa deu sinal de vida, que é o que separa "está
// devagar" de "travou" (ver `idleMs` e BG_STALL_MS).
function bgItemEnd(id, nome) {
  if (!window.__NATIVE__ || !nome) return;
  const t = bgTasks.get(id);
  if (t) t.lastEventAt = Date.now();
}

function bgTaskEnd(id) {
  if (!window.__NATIVE__) return;
  if (bgTasks.delete(id)) { bgPacerSync(); bgTaskSend(true); }
}

// Tempo restante de UMA tarefa, em ms. 0 = ainda não dá para estimar.
//
// Média desde o primeiro item concluído (decorrido/concluídos x restantes),
// depois SUAVIZADA: itens têm tamanhos muito diferentes (uma música só Cantado
// x outra com Playback, capa e imagens de estrofe) e a rede oscila, então o
// valor bruto sobe e desce. A suavização é assimétrica de propósito — cai
// rápido, sobe devagar: uma contagem regressiva que aumenta parece quebrada,
// mesmo quando o número novo está certo.
// A suavização é por TEMPO (constante de tempo), não por chamada. Antes era um
// fator fixo aplicado a cada chamada, o que amarrava a estabilidade do número à
// frequência com que alguém pedia a estimativa: o compasso da fila
// (`bgPacerTick`) a chama muito mais vezes que os eventos chamavam, e o mesmo
// fator faria o valor exibido colar no bruto e voltar a pular — justamente o
// que a suavização existe para evitar. Com constante de tempo, o comportamento
// visto é o mesmo seja qual for a cadência das chamadas.
//
// Os valores reproduzem o que havia antes (0,5 e 0,15 por item, a ~1,7 s por
// item concluído com 6 em paralelo): τ = −Δt / ln(1 − α).
const ETA_TAU_DOWN = 2500;    // reage rápido quando a estimativa melhora
const ETA_TAU_UP = 10000;     // sobe com cautela
function bgTaskEta(t) {
  if (!t.firstStepAt || t.done <= 0 || t.total <= t.done) return 0;
  const now = Date.now();
  const bruto = ((now - t.firstStepAt) / t.done) * (t.total - t.done);
  if (!t.shownEta) { t.shownEta = bruto; t.etaAt = now; return bruto; }
  const dt = Math.max(0, now - (t.etaAt || now));
  t.etaAt = now;
  const a = 1 - Math.exp(-dt / (bruto < t.shownEta ? ETA_TAU_DOWN : ETA_TAU_UP));
  t.shownEta += (bruto - t.shownEta) * a;
  return t.shownEta;
}

// O Android limita a taxa de atualização de notificação e passa a DESCARTAR o
// excesso — sem freio, a barra parece travada. O piso vale só para a
// atualização de ROTINA (`bgTaskStep`, em que só o contador andou); tudo o que
// precisa chegar na hora passa `force`.
//
// HOUVE um segundo piso (250 ms) "escolhido pelo chamador" por um parâmetro
// `destaque`. Ele foi REMOVIDO porque nenhum dos cinco chamadores o passava —
// era código morto, e mexer na constante não produzia efeito nenhum no
// aparelho. Quem de fato dá o ritmo do item que entra em download é o compasso
// (`bgPacerTick`, BG_TICK_MS = 250 ms), que envia com `force` sempre que o
// nome na linha troca; o resultado na tela é o mesmo, e agora só há um
// mecanismo para entender. Repor o piso curto aqui seria PIOR que o `force`:
// o primeiro nome de uma tarefa nasce a poucos ms do envio de abertura e
// ficaria retido até o batimento de 2 s.
const BG_NOTIF_MIN_MS = 700;        // rotina: só o contador andou
let bgLastSentAt = 0;
function bgTaskSend(force) {
  const now = Date.now();

  // Com mais de uma tarefa em curso, a notificação mostra a DOMINANTE — a de
  // maior tempo restante, que é a que decide quando tudo acaba — e diz quantas
  // outras existem. Somar tarefas de naturezas diferentes (capítulos da Bíblia
  // + músicas) num total único daria um número que não significa nada.
  let alvo = null, etaAlvo = -1;
  for (const t of bgTasks.values()) {
    const eta = bgTaskEta(t);
    if (!alvo || eta > etaAlvo) { alvo = t; etaAlvo = eta; }
  }
  if (!alvo) {
    bgLastSentAt = now;
    try { AVNative.bgProgress({ label: '', done: 0, total: 0, etaMs: 0, items: [] }); } catch (_) {}
    return;
  }
  const outras = bgTasks.size - 1;
  // UM nome por vez (ver bgItemStart): `items` continua sendo lista só porque
  // é o formato da ponte — quem escolhe qual mostrar é o rodízio, não o Kotlin.
  const item = alvo.spot || null;
  if (!force && now - bgLastSentAt < BG_NOTIF_MIN_MS) return;
  bgLastSentAt = now;
  try {
    AVNative.bgProgress({
      label: alvo.label + (outras > 0 ? ' (+' + outras + ')' : ''),
      done: alvo.done,
      total: alvo.total,
      etaMs: Math.max(0, Math.round(etaAlvo)),
      items: item ? [item] : [],
      bytes: !!alvo.bytes,
      // Há quanto tempo NADA acontece nesta tarefa. É o que separa "travado" de
      // "esta faixa é grande" — sem isso os dois casos são a mesma tela parada.
      idleMs: alvo.lastEventAt ? Math.max(0, now - alvo.lastEventAt) : 0,
    });
  } catch (_) { /* shell antigo: a notificação segue estática */ }
}

// ===== Diálogo padrão do app (confirmações / prompts) =====
// Modal no tema do app que substitui os confirm()/prompt() nativos em TODA
// interação do tipo (excluir, renomear, avisos). Assíncrono: retorna uma
// Promise — confirm → true/false; prompt → string (OK) ou null (cancelar).
const appDialogEl = document.getElementById('appDialog');
const appDialogTitleEl = document.getElementById('appDialogTitle');
const appDialogMsgEl = document.getElementById('appDialogMsg');
const appDialogInputEl = document.getElementById('appDialogInput');
const appDialogOkEl = document.getElementById('appDialogOk');
const appDialogCancelEl = document.getElementById('appDialogCancel');
let appDialogResolve = null;

function closeAppDialog(result) {
  document.removeEventListener('keydown', onAppDialogKey);
  appDialogEl.classList.remove('open');
  const r = appDialogResolve; appDialogResolve = null;
  if (r) r(result);
}
// Esc cancela TAMBÉM o confirm. O comentário de `appConfirm` sempre prometeu
// isso, mas o único handler de Escape morava no keydown do INPUT — que só
// existe (e só tem foco) no prompt. O handler vive no documento e só está
// registrado enquanto o diálogo está aberto; resolve exatamente como o botão
// Cancelar do tipo em cena (false no confirm, null no prompt). O Esc vindo do
// input não resolve duas vezes: o `closeAppDialog` de lá remove este listener
// antes de o evento borbulhar até o documento.
function onAppDialogKey(e) {
  if (e.key !== 'Escape') return;
  closeAppDialog(appDialogInputEl.hidden ? false : null);
}
function openAppDialog(opts) {
  const { title, message, okText, cancelText, input, value, placeholder } = opts || {};
  return new Promise((resolve) => {
    // Se já houver um diálogo aberto, resolve o anterior como cancelado.
    if (appDialogResolve) closeAppDialog(input ? null : false);
    appDialogResolve = resolve;
    appDialogTitleEl.textContent = title || '';
    appDialogTitleEl.hidden = !title;
    appDialogMsgEl.textContent = message || '';
    appDialogMsgEl.hidden = !message;
    appDialogOkEl.textContent = okText || 'OK';
    // `cancelText: null` é o diálogo de AVISO: ele não pergunta nada, só conta
    // o que aconteceu, e um "Cancelar" ao lado do "Entendi" ofereceria uma
    // escolha que não existe.
    appDialogCancelEl.hidden = cancelText === null;
    appDialogCancelEl.textContent = cancelText || 'Cancelar';
    if (input) {
      appDialogInputEl.hidden = false;
      appDialogInputEl.value = value || '';
      appDialogInputEl.placeholder = placeholder || '';
    } else {
      appDialogInputEl.hidden = true;
    }
    appDialogEl.classList.add('open');
    document.addEventListener('keydown', onAppDialogKey);
    if (input) setTimeout(() => { appDialogInputEl.focus(); appDialogInputEl.select(); }, 60);
  });
}
// confirm → resolve true (OK) / false (cancelar/fora/Esc)
function appConfirm(opts) { return openAppDialog({ okText: 'Confirmar', cancelText: 'Cancelar', ...opts, input: false }); }
// prompt → resolve o texto (OK) / null (cancelar/fora/Esc)
function appPrompt(opts) { return openAppDialog({ okText: 'OK', cancelText: 'Cancelar', ...opts, input: true }); }

appDialogOkEl.addEventListener('click', () => closeAppDialog(appDialogInputEl.hidden ? true : appDialogInputEl.value));
appDialogCancelEl.addEventListener('click', () => closeAppDialog(appDialogInputEl.hidden ? false : null));
appDialogEl.addEventListener('click', (e) => { if (e.target === appDialogEl) closeAppDialog(appDialogInputEl.hidden ? false : null); });
appDialogInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); closeAppDialog(appDialogInputEl.value); }
  else if (e.key === 'Escape') closeAppDialog(null);
});

// ===== popup de playlist =====
// A fila em cena vira um PACOTE: um item do Cronograma que, ao ser tocado,
// devolve exatamente estes itens nesta ordem. O nome sai do primeiro item mais
// a contagem — "Abertura · 4 itens" é o que se reconhece numa lista de culto.
async function guardarPacote() {
  // Só MÍDIA entra num pacote. Uma cena de roteiro dentro dele abriria a porta
  // para um pacote que contém outro pacote — e dois que se contenham
  // mutuamente fariam `abrirPacote` chamar `send` em laço, travando o app. Um
  // pacote é uma FILA de reprodução; cena de roteiro se põe no Cronograma.
  const midias = plItems.filter((m) => !isCue(m));
  const ids = midias.map((m) => m.id);
  // Este é o único caso em que o pulso NÃO basta: ele diz "não deu", e aqui o
  // que o operador precisa saber é POR QUE (a fila tem menos de dois itens).
  // Motivo não cabe num botão — então os dois sinais saem juntos.
  if (ids.length < 2) {
    pulsar(plPackEl, 'erro');
    avisar('Monte a fila com dois ou mais itens antes de guardar', 'erro');
    return;
  }
  // O nome sai do primeiro item QUE ENTRA no pacote (`midias[0]`), não de
  // `plItems[0]`: com uma cena de roteiro no topo da fila, a sugestão citava
  // um item que o filtro acabara de deixar de fora.
  const sugestao = midias[0].name + ' +' + (ids.length - 1);
  const nome = await appPrompt({
    title: 'Guardar pacote', message: 'Nome do pacote:', value: sugestao, okText: 'Guardar',
  });
  if (nome === null) return;
  const rec = await criarCue('group', { ids }, (nome || '').trim() || sugestao, 'imports', plPackEl);
  if (!rec) { responder(plPackEl, 'erro', 'Não foi possível guardar'); return; }
  setTimeout(closePlPopup, PULSO_MS);
}

function openPlPopup() {
  renderPlaylist();
  plPopupEl.classList.add('open');
}
function closePlPopup() {
  plPopupEl.classList.remove('open');
}

// ===== eventos =====
fileEl.addEventListener('change', async () => {
  const files = Array.from(fileEl.files || []);
  let naoAbriu = null;
  for (const file of files) {
    // APRESENTAÇÃO escolhida por aqui (navegador, ou shell antigo sem o seletor
    // do sistema): vira páginas como qualquer outra. Sem este desvio um `.pptx`
    // entraria como mídia 'other' — importada e impossível de projetar. O PDF
    // não tem caminho AQUI: quem o desenha é o shell, que precisa do arquivo e
    // não de um `File` já lido — e é justamente por isso que, no app, este
    // botão abre o seletor do sistema.
    if (ehApresentacao(file)) {
      let rec = null;
      if (ehPptx(file)) rec = await pptxImportar(file, nomeSemExtensao(file.name), {});
      else deckUltimoErro = window.__NATIVE__
        ? 'PDF precisa do seletor de arquivos do app (instale a versão nova)'
        : 'o navegador não desenha PDF; use o app';
      if (!rec) naoAbriu = nomeSemExtensao(file.name);
      continue;
    }
    // O tipo vem da EXTENSÃO, com o do arquivo como reserva: um seletor de
    // documentos do Android pode entregar `application/octet-stream`, e aí a
    // mídia entraria como 'other' — importada mas impossível de reproduzir.
    // Mesma regra do share e da sincronização de pastas.
    const type = guessMediaType(file.name) || file.type;
    const kind = AVDB.kindFromType(type);
    const { thumb, height, seconds } = await prepararMidia(file, kind);
    await AVDB.addMedia(file, {
      name: file.name.replace(/\.[^.]+$/, ''), type, kind, thumb, height, seconds,
    });
  }
  fileEl.value = '';
  // Importar sempre cai no Cronograma (lista `imports`, via addMedia) — a aba
  // acompanha para o operador ver o que acabou de entrar.
  if (activeTab !== 'imports') activeTab = 'imports';
  load();
  if (naoAbriu) await avisarNaoAbriu(naoAbriu);
});

playPauseEl.addEventListener('click', () => {
  pausaEm = Date.now();
  // Texto manual em cena SEM áudio de fundo: play/pause não faz nada (navega-se
  // pelos botões de slide). Com um áudio de fundo tocando (preview.getCurrent),
  // o play/pause controla esse áudio — a projeção do texto é independente.
  // Vale para os DOIS provedores da camada (Bíblia e Mensagem): sem a Mensagem
  // aqui, um toque no ▶ caía em `send(currentId)`, que chama clearManualText()
  // e tirava a mensagem do telão no meio do culto.
  if (pvTextActive && !preview.getCurrent()) return;
  if (playing) { cmd({ type: 'pause' }); }
  // YouTube sem player vivo no Display (fim natural ou stop manual) → recarrega
  else if (ytEnded && currentItem && currentItem.kind === 'youtube' && currentId) { send(currentId); }
  // RETOMAR só vale com a mídia AINDA EM CENA. `preview.getCurrent()` sozinho
  // não respondia isso: depois de um stop ele continua devolvendo o registro
  // durante todo o fade de saída do `clearFaded` (~0,6 s), e o `play` mandado
  // nessa janela era apagado pelo `clear` que terminava logo atrás — o ▶ não
  // fazia nada, e o operador aprendia a tocar em STOP DUAS VEZES para
  // destravar. `midiaNoAr` cai no mesmo instante em que o stop é dado, então o
  // primeiro toque no ▶ já cai no `send` e recarrega. (v5.142)
  else if (midiaNoAr && preview.getCurrent()) { cmd({ type: 'play' }); }
  else if (currentId) { send(currentId); } // após stop: recarrega e inicia do início
});
stopEl.addEventListener('click', stopClear);
slidePrevBtnEl.addEventListener('click', () => stepSlide(-1));
slideNextBtnEl.addEventListener('click', () => stepSlide(1));

// ===== Um par de botões, dois eixos (⏮/⏭) =====
// Até a v5.48 a tela tinha QUATRO botões para duas ações vizinhas: estrofe
// (flanqueando a preview) e mídia (no transporte). Eram quatro alvos disputando
// a mesma faixa estreita, e os de estrofe passavam a maior parte do culto
// desabilitados — sem letra, sem versículo e sem mensagem eles não fazem nada.
//
// Agora é UM par, com os dois eixos separados pelo TEMPO do toque:
//   • toque curto → o eixo da CENA: passa estrofe quando há estrofe a passar
//     (letra, versículo ou mensagem no ar), e passa de mídia quando não há;
//   • toque longo → SEMPRE mídia. É a saída para quando a cena tem estrofes e
//     mesmo assim se quer trocar de música.
//
// A regra de qual eixo está valendo é `slideTarget()`, a MESMA que a notificação
// nativa consulta (`slideMode` em `pushNowPlaying`) e a mesma que o gesto da
// tela cheia usa. E quem executa continua sendo `#slidePrevBtn`/`#slideNextBtn`
// por `.click()`: eles saíram da tela, não do sistema — é neles que
// `applySlideLimits` guarda "dá para passar estrofe agora?", e um botão
// `disabled` é um no-op natural.
//
// O limiar é o mesmo `LONGPRESS` (450 ms) dos itens da biblioteca: dois tempos
// diferentes para "segurar" no mesmo app seriam duas coisas para o dedo
// aprender. O toque longo dispara NA HORA em que vence o prazo (não ao soltar):
// segurar e esperar a música trocar é a resposta que o dedo espera, e o
// `pointerup` seguinte já não repete a ação.
function attachTransportStep(btn, dir) {
  let timer = null, fired = false;
  const slideBtn = () => (dir < 0 ? slidePrevBtnEl : slideNextBtnEl);
  btn.addEventListener('pointerdown', () => {
    fired = false;
    clearTimeout(timer);
    timer = setTimeout(() => { fired = true; step(dir); }, LONGPRESS);
  });
  const cancel = () => { clearTimeout(timer); timer = null; };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, cancel));
  btn.addEventListener('click', () => {
    if (fired) { fired = false; return; }   // o toque longo já agiu
    if (slideTarget()) slideBtn().click();
    else step(dir);
  });
}
attachTransportStep(prevEl, -1);
attachTransportStep(nextEl, 1);
repeatEl.addEventListener('click', cycleRepeat);


seekEl.addEventListener('input', () => { curTimeEl.textContent = fmtTime(parseFloat(seekEl.value)); });
seekEl.addEventListener('change', () => cmd({ type: 'seek', time: parseFloat(seekEl.value) }));

viewToggleEl.addEventListener('click', () => setView(view === 'visual' ? 'wallpaper' : 'visual'));
muteToggleEl.addEventListener('click', toggleMute);
// Configurações: a porta fixa no topo da coluna do mixer. Substituiu a
// engrenagem que ficava sobre a preview — aquela sumia com um toque na
// miniatura, e uma configuração escondida atrás de um estado de UI é a que
// ninguém acha.
settingsBtnEl.addEventListener('click', openFadePopup);
pvSoundBtnEl.addEventListener('click', (e) => {
  // A preview inteira tem gestos próprios (arrastar o volume, tocar para tela
  // cheia): sem isto, ligar o som também disparava o gesto de baixo.
  e.stopPropagation();
  setStandalone(!standalone);
});
lyricsViewBtnEl.addEventListener('click', openLyricsPopup);
// Letra × Bíblia (só aparece com as duas em cena — ver renderLyricsView).
lyricsViewSegEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.fit-opt');
  if (!btn) return;
  lvSource = btn.dataset.lvsrc;
  lvFollow = true; // trocar de fonte é pedir para ver onde ela está
  renderLyricsView();
  lvScrollToCurrent(false);
});
// Rolou com o dedo? Então o operador está lendo adiante — o acompanhamento
// automático para de disputar o scroll com ele, até reabrir o popup (ou trocar
// de fonte). Sem isso, a estrofe seguinte puxaria a lista de volta no meio da
// leitura.
lyricsViewBodyEl.addEventListener('pointerdown', () => { lvFollow = false; });
lyricsViewBodyEl.addEventListener('wheel', () => { lvFollow = false; }, { passive: true });
// Imagens dos slides: segmento do popup de Exibição (Mostrar / Remover).
lyricsBgSegEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.fit-opt');
  if (btn) setLyricsBg(btn.dataset.lyricsbg);
});
// Volume recolhível (estado só de UI, não persistido): abrir troca os botões
// da lateral pelo fader com animação de entrada; fechar anima a saída do fader
// antes de trazer os botões de volta (também animados). Ver as classes
// vol-open/vol-closing/vol-revealing em controle.css.
const VOL_ANIM = 190; // ms — casa com as durações das animações no CSS
let volAnimTimer = null;
function openVolume() {
  clearTimeout(volAnimTimer);
  mixerEl.classList.remove('vol-closing', 'vol-revealing');
  mixerEl.classList.add('vol-open');
}
function closeVolume() {
  if (!mixerEl.classList.contains('vol-open')) return;
  clearTimeout(volAnimTimer);
  mixerEl.classList.add('vol-closing');
  volAnimTimer = setTimeout(() => {
    mixerEl.classList.remove('vol-open', 'vol-closing');
    mixerEl.classList.add('vol-revealing');
    volAnimTimer = setTimeout(() => mixerEl.classList.remove('vol-revealing'), VOL_ANIM);
  }, VOL_ANIM);
}

// ===== Espiada no volume (botões físicos) =====
// O botão físico mexe no fader daqui (ver `__avVolumeKey`), e até agora isso
// acontecia INVISÍVEL com a coluna no estado normal: o operador mudava o
// volume sem ver quanto ficou nem quanto ainda cabe. A espiada abre a MESMA
// visualização do toque no botão de volume — fader no lugar de top+mid, o
// botão da base virando ✕, as mesmas animações — e a recolhe sozinha alguns
// segundos depois. Reusa `openVolume`/`closeVolume` de propósito: um segundo
// jeito de mostrar o fader seria um segundo jeito de ele ficar diferente.
const VOL_PEEK_MS = 2800;
let volPeekTimer = null;
let volPeekOwned = false; // esta abertura é da espiada? só ela se recolhe sozinha

// O volume passa a ser do operador: quem abriu na mão fecha na mão. Chamado
// pelos toques nos dois botões — sem isto, uma espiada em curso recolheria a
// coluna que o operador acabou de abrir.
function cancelVolPeek() {
  clearTimeout(volPeekTimer);
  volPeekTimer = null;
  volPeekOwned = false;
}

function peekVolume() {
  // No modo simplificado a barra de volume já é a lateral inteira da tela:
  // não há o que espiar, e mexer no mixer escondido não teria efeito nenhum.
  if (appMode === 'simple') return;
  const open = mixerEl.classList.contains('vol-open') && !mixerEl.classList.contains('vol-closing');
  if (open && !volPeekOwned) return; // aberto pelo operador: a tecla não mexe nisso
  volPeekOwned = true;
  openVolume();
  clearTimeout(volPeekTimer);
  volPeekTimer = setTimeout(() => {
    volPeekTimer = null;
    volPeekOwned = false;
    closeVolume();
  }, VOL_PEEK_MS);
}

// Mexer no fader durante a espiada reinicia a contagem: o operador está
// usando o que a tecla acabou de revelar, e recolher debaixo do dedo dele
// seria o oposto do que a espiada existe para fazer. Continua sendo uma
// espiada — some sozinha alguns segundos depois que ele parar.
function bumpVolPeek() {
  if (volPeekOwned) peekVolume();
}

volToggleEl.addEventListener('click', () => { cancelVolPeek(); openVolume(); });
volCloseEl.addEventListener('click', () => { cancelVolPeek(); closeVolume(); });

// Se a largura mudar (ex: rotação), remede o título rolante — e o vazado da
// faixa de abas, que é posicionado em PIXELS medidos: numa rotação as células
// mudam de largura e ele ficaria sobre a aba errada. Sem animação, porque isto
// não é uma troca de aba: é a mesma aba num tamanho novo.
let titleResizeTimer = null;
window.addEventListener('resize', () => {
  moveTabIndicator(false);
  clearTimeout(titleResizeTimer);
  titleResizeTimer = setTimeout(applyTitleMarquee, 150);
});

// ===== Deslocamento com o teclado virtual =====
// O meta viewport pede `interactive-widget=resizes-content` (index.html), o que
// já faz o navegador encolher o layout quando o teclado abre — o app sobe
// sozinho e nada fica escondido. Este handler é o FALLBACK para navegadores que
// não honram esse hint: usa a VisualViewport API pra medir quanto o teclado
// cobriu e escreve isso em `--kb` (usado por `body { height: calc(100svh - var(--kb)) }`
// em controle.css). Quando o layout já é redimensionado pelo navegador (ou o
// teclado está fechado), a conta dá ~0 e nada muda — os dois mecanismos convivem
// sem brigar. Como o Controle roda sempre como PWA instalado no Android, a
// VisualViewport API está disponível.
(function keyboardShift() {
  const vv = window.visualViewport;
  if (!vv) return;
  let raf = 0;
  const apply = () => {
    raf = 0;
    // Altura coberta pelo teclado = o que sobra abaixo da viewport visual.
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb', kb + 'px');
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  apply();
})();

// Fonte única de "o operador mexeu no volume": o fader, o arrasto vertical na
// preview em tela cheia e os botões físicos passam todos por aqui, então os
// três ficam sempre coerentes entre si (e com o mudo, que sai sozinho).
function applyVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (volume > 0 && muted) { muted = false; cmd({ type: 'mute', muted }); }
  cmd({ type: 'volume', volume });
  renderControls();   // escreve os dois faders (ver syncFader)
}

// QUAL fader está sob o dedo (null = nenhum). Elemento em vez de booleano
// porque `syncFader` é chamada para cada fader e só o que está sendo arrastado
// deve escapar da reescrita do valor.
let volSeekingEl = null;
// (Era um `[volSliderEl].forEach` — array de um elemento só, resto de quando
// havia mais de um fader.)
volSliderEl.addEventListener('pointerdown', () => { volSeekingEl = volSliderEl; bumpVolPeek(); });
volSliderEl.addEventListener('pointerup', () => { volSeekingEl = null; });
volSliderEl.addEventListener('input', () => { applyVolume(parseFloat(volSliderEl.value) / 100); bumpVolPeek(); });
volSliderEl.addEventListener('change', () => { volSeekingEl = null; persistCurrent(); });


// ===== Modos de uso: simplificado × sonoplasta completo =====
// O app atende duas pessoas diferentes: quem só precisa conectar a tela e
// tocar um louvor, e o sonoplasta que opera o culto inteiro.
//
// **Abre no simplificado sem perguntar nada** — mas só até alguém escolher o
// contrário. Nunca há uma pergunta na abertura: ela cobraria um toque de todo
// mundo, inclusive de quem nem sabia que havia dois modos, antes de mostrar
// qualquer coisa útil. O que existe é MEMÓRIA: a partir da v5.66 o app reabre
// no último modo usado (ver `storedAppMode`, no topo do arquivo).
//
// A escolha era só da sessão, e o argumento era que o simplificado é o caso
// mais comum. Ele continua sendo — para quem nunca escolheu. Mas quem opera o
// culto TODA semana escolhia o avançado toda semana, e um app que esquece uma
// preferência explícita a cada abertura está cobrando o mesmo toque para
// sempre. O risco do outro lado — cair no avançado sem querer e reabrir nele —
// custa um toque no "← Modo simplificado" do cabeçalho, que é o par visível do
// botão que levou até ali (v5.49).
//
// O avançado fica a um toque, no botão do cabeçalho, e o segmento "Modo do app"
// do popup de Configurações é o mesmo destino, junto das demais preferências.
//
// O simplificado não é uma segunda implementação do transporte: os botões
// dele acionam os MESMOS controles do modo avançado por `.click()` (o mesmo
// padrão da notificação nativa), e o volume passa pelo mesmo `applyVolume`.
// Assim nenhuma regra de borda — texto sem áudio de fundo, YouTube que precisa
// recarregar, mudo bloqueado pelo navegador — existe em dois lugares.
// (`appMode` é declarado no TOPO do arquivo, junto de `storedAppMode`: a classe
// do `<body>` precisa estar certa antes do primeiro quadro.)
let lastDisplays = [];          // telas conectadas (ponte nativa)
// Releitura da lista de telas, definida junto do bloco nativo (ver mais abaixo)
// e chamada na retomada do app. No navegador continua no-op: lá quem responde
// "há tela?" é a janela do Display, e ela é observada por um relógio próprio.
let reconferirTelas = () => {};

function setAppMode(mode) {
  appMode = mode === 'simple' ? 'simple' : 'full';
  // A escolha é do operador, e ele não deveria refazê-la a cada abertura.
  try { localStorage.setItem(APP_MODE_KEY, appMode); } catch (_) { /* storage bloqueado */ }
  document.body.classList.toggle('mode-simple', appMode === 'simple');
  simpleModeEl.classList.toggle('open', appMode === 'simple');
  // A preview troca de casa junto com o modo (ver hostPreview) — antes dos
  // renders, para que eles já a encontrem no lugar certo.
  hostPreview();
  renderAppModeSeg();
  renderSimple();
  renderSimpleCast();
  renderSimpleGate();   // `renderSimpleCast` volta cedo fora do simplificado
  // Sair do simplificado com a busca aberta deixaria o popup por cima da tela
  // completa sem nada que explicasse por quê.
  if (appMode === 'full') closeHymnSearch();
  // A caixa de controles fica oculta no simplificado, e medir um elemento
  // escondido dá 0 — o vazado da faixa só pode ser posicionado quando ela
  // aparece. Sem animação: aqui ele POUSA, não viaja.
  if (appMode === 'full') moveTabIndicator(false);
}

function renderAppModeSeg() {
  appModeSegEl.querySelectorAll('.fit-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === appMode);
  });
}

// A tela simplificada é um ESPELHO dos controles reais: copia o glifo e o
// estado dos botões do mixer/transporte em vez de recalcular play/pause e
// mudo por conta própria. Se a regra mudar lá, muda aqui junto.
function renderSimple() {
  if (appMode !== 'simple') return;
  simpleNpNameEl.textContent = npNameInnerEl.textContent || 'Nada tocando';
  simplePlayEl.querySelector('.msym').textContent = playPauseEl.querySelector('.msym').textContent;
  simpleMuteEl.querySelector('.msym').textContent = muteToggleEl.querySelector('.msym').textContent;
  simpleMuteEl.classList.toggle('muted', muteToggleEl.classList.contains('muted'));
  simpleMuteEl.classList.toggle('blocked', muteToggleEl.classList.contains('blocked'));
  simpleMuteEl.title = muteToggleEl.title;
  // Volume por teclas: o número é o indicador, e `--vol` desenha a barrinha de
  // curso na base dele (ver .simple-vol-read::after).
  const pct = Math.round(volume * 100);
  simpleVolValueEl.textContent = String(pct);
  simpleVolWrapEl.style.setProperty('--vol', String(pct / 100));
  renderSimpleTime();
  refreshSimpleLyrics();
}

// Linha do tempo do simplificado. Espelha a MESMA barra do modo avançado
// (`#seek`) em vez de reconstruir a posição: aquela já é alimentada pelas três
// fontes possíveis — a preview local, o `display-status` do telão e o polling
// do YouTube — e é ela que sabe quando o item nem tem duração (imagem, texto).
function renderSimpleTime() {
  if (appMode !== 'simple') return;
  const dur = parseFloat(seekEl.max) || 0;
  const cur = parseFloat(seekEl.value) || 0;
  const timed = !seekEl.disabled && dur > 0;
  simpleTimeEl.hidden = !timed;
  if (!timed) return;
  // DURANTE O ARRASTE quem escreve a barra é o dedo (ver `setupSimpleSeek`).
  // Sem esta guarda, o `timeupdate` da mídia — que continua tocando enquanto se
  // procura o ponto — puxaria o preenchimento de volta a cada quadro e o dedo
  // brigaria com ele. É a mesma regra do `volSeekingEl` no fader.
  if (simpleSeeking) return;
  simpleTimeCurEl.textContent = fmtTime(cur);
  simpleTimeDurEl.textContent = fmtTime(dur);
  simpleTimeFillEl.style.width = Math.max(0, Math.min(100, (cur / dur) * 100)) + '%';
  if (simpleTimeHitEl) {
    simpleTimeHitEl.setAttribute('aria-valuemax', String(Math.round(dur)));
    simpleTimeHitEl.setAttribute('aria-valuenow', String(Math.round(cur)));
  }
}

// ===== A BARRA DE TEMPO DO SIMPLIFICADO É INTERATIVA (v5.142) =====
//
// Ela nasceu como indicador — "neste modo não se arrasta nada; quem precisa
// saltar no tempo usa o modo avançado". Só que saltar no tempo é a coisa mais
// comum que se faz durante um louvor (voltar o refrão, pular a introdução), e
// mandar o operador SAIR do modo para fazê-la é o oposto do que o modo existe
// para dar. As teclas grandes continuam sendo a regra; o que muda é que a barra
// deixou de ser um enfeite.
//
// Tocar salta; arrastar procura, e o comando só sai ao SOLTAR — um `seek` por
// quadro de movimento faria a mídia engasgar durante todo o gesto. O tempo
// enquanto o dedo anda é escrito na tela pelo próprio gesto (`simpleSeeking`),
// que é como o operador enxerga para onde está indo.
let simpleSeeking = false;
function setupSimpleSeek() {
  if (!simpleTimeHitEl) return;
  const dur = () => parseFloat(seekEl.max) || 0;
  const posicao = (e) => {
    const r = simpleTimeHitEl.getBoundingClientRect();
    if (!r.width) return 0;
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    return f * dur();
  };
  const pintar = (t) => {
    const d = dur();
    simpleTimeCurEl.textContent = fmtTime(t);
    simpleTimeFillEl.style.width = (d > 0 ? Math.max(0, Math.min(100, (t / d) * 100)) : 0) + '%';
  };
  simpleTimeHitEl.addEventListener('pointerdown', (e) => {
    if (seekEl.disabled || dur() <= 0) return;
    simpleSeeking = true;
    // `seeking` é o MESMO sinal que a barra do modo avançado arma: é ele que
    // impede a sessão de mídia de republicar uma posição que ainda está sob o
    // dedo (ver `pushNowPlaying`). Dois estados para a mesma coisa divergiriam.
    seeking = true;
    simpleTimeHitEl.classList.add('seeking');
    try { simpleTimeHitEl.setPointerCapture(e.pointerId); } catch (_) {}
    pintar(posicao(e));
  });
  simpleTimeHitEl.addEventListener('pointermove', (e) => {
    if (!simpleSeeking) return;
    pintar(posicao(e));
  });
  const soltar = (e) => {
    if (!simpleSeeking) return;
    simpleSeeking = false;
    seeking = false;
    simpleTimeHitEl.classList.remove('seeking');
    try { simpleTimeHitEl.releasePointerCapture(e.pointerId); } catch (_) {}
    const t = posicao(e);
    // A barra do modo avançado é a fonte de verdade da posição em toda a tela
    // (o `renderSimpleTime` a espelha, e `pushNowPlaying` a lê): escrevê-la aqui
    // é o que mantém os dois modos contando a mesma coisa até o próximo pulso
    // do `display-status` chegar.
    seekEl.value = String(t);
    curTimeEl.textContent = fmtTime(t);
    cmd({ type: 'seek', time: t });
    renderSimpleTime();
  };
  simpleTimeHitEl.addEventListener('pointerup', soltar);
  simpleTimeHitEl.addEventListener('pointercancel', (e) => {
    // Cancelado (o sistema tomou o gesto): NÃO salta. Um `seek` para onde o
    // dedo por acaso estava quando a chamada entrou seria um salto que ninguém
    // pediu; a barra volta sozinha ao valor real no próximo render.
    simpleSeeking = false;
    seeking = false;
    simpleTimeHitEl.classList.remove('seeking');
    try { simpleTimeHitEl.releasePointerCapture(e.pointerId); } catch (_) {}
    renderSimpleTime();
  });
}
setupSimpleSeek();

// Volume em passos, como num controle remoto — o MESMO passo dos botões
// físicos (VOL_KEY_STEP), para os dois caminhos não discordarem, e a mesma
// `applyVolume` de sempre (clamp, desmutar ao subir de 0, comando, render).
function simpleVolStep(dir) {
  applyVolume(volume + dir * VOL_KEY_STEP);
  persistCurrent();
}

// Segurar a tecla repete, como num controle de verdade. O primeiro passo sai
// no `pointerdown` (resposta imediata); a repetição só começa depois de uma
// pausa, senão um toque comum viraria dois.
function holdRepeat(btn, fn) {
  let delay = null, timer = null;
  const stop = () => { clearTimeout(delay); clearInterval(timer); delay = timer = null; };
  btn.addEventListener('pointerdown', () => {
    fn();
    delay = setTimeout(() => { timer = setInterval(fn, 120); }, 420);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, stop));
}

// Estado da tela no cartão "Conectar a tela". No app a `Presentation` aparece
// sozinha quando há telão, então o cartão informa o que já está conectado — e
// o toque abre o seletor de espelhamento. No navegador não há Presentation
// nem seletor: o cartão vira o atalho para a tela do Display.
// O ÍCONE DE CAST SOBRE A PREVIEW — e ele vale nos DOIS modos (v5.142).
//
// Esta função morava dentro de `renderSimpleCast`, que começa com
// `if (appMode !== 'simple') return`. O efeito era duplo e o segundo é o do
// relato: no modo avançado o ícone NUNCA era repintado, então o vermelho de
// "conectado" que o simplificado deixou aceso ficava para sempre — o operador
// trocava de modo, a tela caía, e o ícone seguia dizendo que havia telão. O
// estado da tela não é uma decoração de um dos modos; é o mesmo fato nos dois.
function renderCastBtn() {
  const tv = simpleDisplay();
  // `.connected` marca "há uma tela recebendo"; a liberação de teste NUNCA o
  // veste (ver `castTestUnlocked`) — ela é aviso, não conexão.
  pvCastBtnEl.classList.toggle('connected', !!tv && !castTestUnlocked);
  pvCastBtnEl.classList.toggle('testing', castTestUnlocked);
  pvCastBtnEl.title = castTestUnlocked
    ? 'Liberação de teste ativa — toque para trancar'
    : (tv ? 'Conectado: ' + (tv.name || 'TV') + ' — toque para trocar ou desconectar'
          : 'Espelhar na TV');
}

function renderSimpleCast() {
  renderCastBtn();
  if (appMode !== 'simple') return;
  const tv = simpleDisplay();
  // `.connected` é o verde de "há uma tela recebendo"; a liberação de teste
  // NUNCA o veste (ver `castTestUnlocked`) — ela é aviso, não conexão.
  simpleCastBtnEl.classList.toggle('connected', !!tv && !castTestUnlocked);
  simpleCastBtnEl.classList.toggle('testing', castTestUnlocked);
  // Sem tela, o botão é a tela inteira (ver o bloqueio abaixo) e precisa dizer
  // tudo sozinho: uma frase, no rótulo. Com tela conectada ele volta a ser um
  // cartão entre outros — o rótulo nomeia a ação e o subtítulo informa o
  // estado, que é a divisão de sempre.
  simpleCastLabelEl.textContent = tv ? 'Conectar a tela' : 'Toque para conectar uma tela';
  // O subtítulo tem UMA linha e corta com reticências: cabe o estado, não a
  // instrução. Quem está nesse modo acabou de segurar o botão 5 s para entrar
  // nele — a instrução de sair vai no `title`.
  simpleCastBtnEl.title = castTestUnlocked
    ? 'Liberação de teste ativa — segure 5 s para trancar'
    : 'Segure 5 s para liberar a tela sem telão (teste)';
  if (castTestUnlocked) {
    simpleCastStatusEl.textContent = 'Liberado para teste';
  } else if (!window.__NATIVE__) {
    simpleCastStatusEl.textContent = tv ? 'Tela do Display aberta' : 'Abrir a tela do Display';
  } else {
    simpleCastStatusEl.textContent = tv
      ? 'Conectado: ' + (tv.name || 'TV')
      : 'Toque para escolher a tela';
  }
  renderSimpleGate();
}

// ===== Bloqueio do simplificado sem tela conectada =====
// Neste modo a projeção É o telão — não há preview aqui. Sem tela conectada,
// buscar uma música e dar play produz som no celular e mais nada: os controles
// continuavam ali, respondendo a cada toque, sem que nada aparecesse em lugar
// nenhum. A cortina troca esse silêncio por uma resposta: embaça o que está
// atrás, intercepta os toques e deixa na frente só o que resolve o problema —
// o botão de conectar.
//
// **O "Modo avançado" continua acessível**, no cabeçalho. Sem TV o app não
// fica inútil: a projeção passa a ser a preview em tela cheia (ver CLAUDE.md,
// "Sem TV conectada o app continua útil"), e trancar essa saída transformaria
// a falta de telão numa parede. O que se bloqueia é o modo simplificado, não
// o app.
//
// A única parte que muda por contexto é quem responde "há tela?": no app é a
// `Presentation` (a ponte lista as telas de apresentação); no navegador não
// existe Presentation, então vale a janela do Display que o próprio botão
// abre — enquanto ela estiver aberta, há para onde projetar.
let webDisplayWin = null;      // navegador: janela do Display aberta pelo botão
let webDisplayTimer = null;

// ===== Liberação de TESTE do modo simplificado (segurar 5 s) =====
// Sem telão à mão não há como OLHAR a tela simplificada destravada — e ela é a
// tela que o app abre, ou seja, a que mais precisa ser vista enquanto se mexe
// no desenho dela. Segurar "Conectar a tela" por 5 s destrava como se houvesse
// telão; segurar de novo tranca.
//
// **É uma porta de desenvolvimento, e ela é honesta**: não finge conexão
// nenhuma. `simpleDisplay()` devolve um descritor marcado (`test: true`), o
// botão fica em AVISO (nunca no verde de conectado) e o subtítulo diz que é
// teste — quem pegar o aparelho nesse estado lê na tela o que está acontecendo,
// em vez de procurar a TV que "conectou" sozinha.
//
// Nada mais no app muda: os comandos continuam saindo pelo barramento como
// sempre (e, sem Display, ninguém os escuta — exatamente o que já acontece hoje
// com o modo avançado sem telão). A liberação não é persistida: cada abertura
// do app volta ao comportamento normal.
//
// 5 s é longo de propósito — o botão é a ÚNICA ação da tela bloqueada, e um
// limiar curto faria um toque hesitante virar um destravamento que ninguém
// pediu.
const CAST_HOLD_MS = 5000;
let castTestUnlocked = false;

function simpleDisplay() {
  if (castTestUnlocked) return { name: 'Modo de teste', test: true };
  if (!window.__NATIVE__) {
    return webDisplayWin && !webDisplayWin.closed ? { name: 'Display' } : null;
  }
  return lastDisplays[0] || null;
}

function renderSimpleGate() {
  const preso = appMode === 'simple' && !simpleDisplay();
  simpleVeilEl.hidden = !preso;
  simpleModeEl.classList.toggle('locked', preso);
  // A busca é o que a cortina esconde: reabri-la por trás dela deixaria o
  // popup no ar sobre uma tela bloqueada.
  if (preso) closeHymnSearch();
}

// ===== A PREVIEW é UM nó só, e ele MUDA DE CASA =====
// No avançado ela mora na faixa do deck; no simplificado, no lugar que era do
// botão de conectar. Move-se o mesmo elemento em vez de existirem duas, pelo
// mesmo padrão do `#selbar` e do `<input type=file>`: duas divergiriam no
// primeiro ajuste, e dois `createStage` decodificariam o MESMO vídeo duas
// vezes num aparelho que já roda dois WebViews.
//
// A troca acontece só na mudança de MODO — não ao conectar/desconectar. Com a
// tela bloqueada a faixa some por CSS (`.simple.locked .simple-stage`), e um
// `display:none` não custa nada; mover o nó a cada conexão, sim (ver abaixo).
function hostPreview() {
  const alvo = appMode === 'simple' ? simpleStageEl : previewRowEl;
  if (previewEl.parentElement === alvo) {
    pvCastBtnEl.hidden = !(appMode === 'simple' || window.__NATIVE__);
    return;
  }
  // Reparentar um `<video>` NÃO interrompe a reprodução desde que ele volte ao
  // documento no mesmo passo — e `appendChild` de um nó já anexado é remoção e
  // inserção atômicas, então o "removido do documento" nunca chega a valer.
  // Quem manda no botão de cast é o CONTEXTO: no simplificado ele é o sinal de
  // conexão e a porta de saída, então existe sempre; no avançado continua sendo
  // um atalho para um intent do Android, e some no navegador.
  pvCastBtnEl.hidden = !(appMode === 'simple' || window.__NATIVE__);
  const yt = ytPreview;
  const emQueSegundo = yt ? ytPreviewTime() : 0;
  alvo.appendChild(previewEl);
  // Um IFRAME, ao contrário, RECARREGA ao mudar de pai — o player do YouTube
  // morre junto. Como o item segue tocando no telão, a miniatura é remontada
  // no ponto em que estava, e não do começo.
  if (yt && currentItem && currentItem.kind === 'youtube') {
    loadYtPreview(currentItem, view, emQueSegundo);
  }
}

// Segundo atual do player da preview do YouTube (0 se ele não responder).
function ytPreviewTime() {
  try {
    const p = ytPreview && ytPreview.player;
    const t = p && p.getCurrentTime && p.getCurrentTime();
    return typeof t === 'number' && isFinite(t) ? t : 0;
  } catch (_) { return 0; }
}

// Abre a tela do Display no navegador e acompanha a janela: fechá-la é o
// equivalente a desconectar o telão, e a cortina precisa voltar. `closed` só
// se descobre olhando — não há evento — então o relógio existe apenas
// enquanto a janela existe.
function openWebDisplay() {
  webDisplayWin = window.open('../display/', 'avDisplay');
  renderSimpleCast();
  // No navegador a janela do Display é o "telão", e vale a mesma regra da mesa
  // de som (ver `telaoConectado`) — inclusive para desenvolver a base web fora
  // do aparelho, que é justamente o que este caminho serve.
  pushTelaoNoSom();
  clearInterval(webDisplayTimer);
  if (!webDisplayWin) return;
  webDisplayTimer = setInterval(() => {
    if (webDisplayWin && !webDisplayWin.closed) return;
    clearInterval(webDisplayTimer);
    webDisplayTimer = null;
    webDisplayWin = null;
    renderSimpleCast();
    pushTelaoNoSom();
  }, 1000);
}

simpleFullBtnEl.addEventListener('click', () => setAppMode('full'));
fullSimpleBtnEl.addEventListener('click', () => setAppMode('simple'));
appModeSegEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.fit-opt');
  if (!btn) return;
  setAppMode(btn.dataset.mode);
  closeFadePopup();   // a escolha já mudou a tela inteira atrás do popup
});
simpleSearchBtnEl.addEventListener('click', openHymnSearch);
// Os controles do simplificado são os do modo completo, acionados por click():
// um botão `disabled` continua sendo um no-op natural, e as bordas ficam num
// lugar só.
simplePlayEl.addEventListener('click', () => playPauseEl.click());
simpleStopEl.addEventListener('click', () => stopEl.click());
simpleMuteEl.addEventListener('click', () => muteToggleEl.click());
holdRepeat(simpleVolUpEl, () => simpleVolStep(1));
holdRepeat(simpleVolDownEl, () => simpleVolStep(-1));
// Toque curto = abrir o seletor de tela; 5 s segurando = liberação de teste
// (acima). O `holdFired` é o que impede o `click` seguinte de abrir o seletor
// de espelhamento em cima da tela que acabou de destravar.
(function setupCastHold() {
  let timer = null, holdFired = false;
  const stop = () => {
    clearTimeout(timer); timer = null;
    simpleCastBtnEl.classList.remove('simple-key--holding');
  };
  simpleCastBtnEl.style.setProperty('--cast-hold', CAST_HOLD_MS + 'ms');
  simpleCastBtnEl.addEventListener('pointerdown', () => {
    holdFired = false;
    clearTimeout(timer);
    // A classe reentra do zero a cada toque: reiniciar a animação exige que ela
    // saia e volte, e é o `stop()` de qualquer toque anterior que a tirou.
    simpleCastBtnEl.classList.add('simple-key--holding');
    timer = setTimeout(() => {
      holdFired = true;
      castTestUnlocked = !castTestUnlocked;
      stop();
      renderSimpleCast();
    }, CAST_HOLD_MS);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => simpleCastBtnEl.addEventListener(ev, stop));
  simpleCastBtnEl.addEventListener('click', () => {
    if (holdFired) { holdFired = false; return; }
    if (window.__NATIVE__) AVNative.openCast();
    else openWebDisplay();
  });
})();
// Fecha o ciclo com o HTML: as classes já vêm do documento (e, no modo
// lembrado, já foram corrigidas no topo do arquivo), aqui o estado do JS
// (segmento do popup, espelho dos controles) nasce igual a elas.
// `appMode`, e NÃO a constante `'simple'` que estava aqui: com o modo lembrado
// essa linha reescrevia o `localStorage` para "simple" em toda abertura, e o
// avançado nunca sobrevivia a fechar o app — o defeito era invisível, porque a
// tela ainda pintava certo até esta linha rodar.
setAppMode(appMode);
// Mesa de som nasce desligada (não é persistida); o segmento precisa nascer
// dizendo isso, senão a primeira abertura de Configurações mostra dois botões
// apagados e nenhuma escolha marcada.
renderStandaloneSeg();

// ===== Botões físicos de volume =====
// No app eles passam a mexer no fader daqui, não na saída do sistema: com
// espelhamento ativo o Android roteia esses botões para a TV, e o operador
// apertava sem que o volume do app saísse do lugar. A Activity intercepta a
// tecla e chama esta função (ver MainActivity.onKeyDown).
const VOL_KEY_STEP = 0.05;
if (window.__NATIVE__) {
  window.__avVolumeKey = (step) => {
    // Mostra o fader por alguns segundos, exatamente como se o operador
    // tivesse tocado no botão de volume (ver peekVolume) — inclusive quando a
    // tecla vai para o sistema: o fader no máximo/zero é justamente a resposta
    // para "por que o volume do app não muda?".
    peekVolume();
    // Já no limite do fader: devolve a tecla ao sistema (com a UI de volume do
    // Android), senão um aparelho com o volume de mídia baixo ficaria sem como
    // subir enquanto o app estivesse aberto.
    if ((step > 0 && volume >= 1) || (step < 0 && volume <= 0)) {
      AVNative.systemVolume(step);
      return;
    }
    applyVolume(volume + step * VOL_KEY_STEP);
    persistCurrent();
  };
  // Só agora — com o handler de pé — a Activity pode consumir as teclas.
  AVNative.captureVolumeKeys(true);

  // ===== Controles da notificação / tela de bloqueio / botões de mídia =====
  // Tudo cai nos MESMOS botões da tela, via `.click()`: os handlers já tratam
  // todos os casos de borda (texto sem áudio de fundo, YouTube que precisa
  // recarregar, limites da playlist), e um botão `disabled` é um no-op
  // natural. Reimplementar essas decisões aqui — ou pior, em Kotlin — seria
  // criar uma segunda verdade sobre o transporte.
  AVNative.onRemote((action) => {
    switch (action) {
      // 'play'/'pause' vêm de fontes que sabem o que querem (tela de bloqueio,
      // fone); o botão da notificação manda 'playpause', que é alternador.
      //
      // Quando a intenção JÁ é o estado atual, o pedido só pode ter vindo de
      // uma notificação desatualizada — o operador tocou no que a tela dele
      // mostrava. Alternar seria fazer o oposto do pedido (pausar o louvor);
      // ignorar em silêncio foi exatamente o defeito relatado na v1.17. Então
      // não se mexe na mídia e se REPUBLICA a cena, para o botão se corrigir.
      case 'play': if (!playing) playPauseEl.click(); else resyncScene(); break;
      case 'pause': if (playing) playPauseEl.click(); else resyncScene(); break;
      case 'playpause': playPauseEl.click(); break;
      case 'stop': stopEl.click(); break;
      case 'view': viewToggleEl.click(); break;
      // Com letra, versículo ou mensagem em cena, ⏮/⏭ passam ESTROFE — é o que
      // o operador está fazendo naquele momento. Ver `slideMode` em
      // pushNowPlaying, que é o que rotula os botões na notificação.
      case 'prev': (slideTarget() ? slidePrevBtnEl : prevEl).click(); break;
      case 'next': (slideTarget() ? slideNextBtnEl : nextEl).click(); break;
      default: break;
    }
  });
}



plBtnEl.addEventListener('click', openPlPopup);

// Ordem das abas (esquerda→direita) — define a DIREÇÃO do deslize na animação
// de troca de aba (ir pra uma aba à direita desliza a lista entrando pela
// direita, e vice-versa).
// Favoritos e Mensagens não têm aba, mas Favoritos ainda é uma TELA
// (activeTab 'folders') e precisa de posição aqui para a direção do deslize
// sair certa.
const TAB_ORDER = ['imports', 'folders', 'bible', 'mic'];
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Duração e curva da troca de aba. Vivem em DOIS lugares por necessidade — o
// vazado da faixa é uma transição CSS (`--tab-move`) e a lista é Web Animations
// —, mas são o mesmo movimento e precisam bater. Quem mexer num mexe no outro.
const TAB_MOVE_MS = 260;
const TAB_MOVE_EASE = 'cubic-bezier(.22,.61,.36,1)';

// Anima a entrada da lista ao trocar de aba: leve deslize direcional + fade.
// Usa a Web Animations API na PRÓPRIA `#library` — como o `load()` reconstrói o
// conteúdo em poucos ms (leituras IDB em memória), animar já a partir de
// opacity:0 esconde a troca e revela o conteúdo novo entrando. Sai cedo se o
// usuário prefere menos movimento.
// ===== A troca de aba é um DESLIZE INTEIRO =====
// Até a v5.58 só o conteúdo NOVO se mexia: entrava de 44px com um fade, e o
// antigo simplesmente sumia. Isso é um sinal de direção, não um deslize — a
// tela nunca saía do lugar, e o gesto (arrastar a lista para o lado) prometia
// exatamente que ela sairia.
//
// Agora as duas telas se movem juntas, larguras inteiras, como um carrossel de
// verdade: a que sai vai para `-100%`, a que entra vem de `+100%`, e em nenhum
// instante elas se sobrepõem — são vizinhas, coladas, empurrando-se.
//
// O truque está em ter as DUAS ao mesmo tempo com uma lista só no DOM: os nós
// antigos são MOVIDOS para um fantasma posicionado exatamente sobre a área da
// lista (`makeTabGhost`), e a `#library` de verdade fica livre para receber o
// conteúdo novo. Mover, e não CLONAR: um clone reinicia o download de cada
// miniatura por um `blob:` que o render seguinte revoga — as fotos sumiriam no
// meio do deslize. Movidos, os mesmos elementos seguem pintados.
let tabGhost = null;

function makeTabGhost() {
  // Um deslize ainda em curso perdeu a vez: tira o fantasma velho na hora, ou
  // dois deslizes rápidos deixariam dois retângulos empilhados sobre a lista.
  if (tabGhost) { tabGhost.remove(); tabGhost = null; }
  const g = document.createElement('ul');
  g.className = 'lib-list lib-ghost' + (libraryEl.classList.contains('lib-misc') ? ' lib-misc' : '');
  g.style.top = libraryEl.offsetTop + 'px';
  g.style.left = libraryEl.offsetLeft + 'px';
  g.style.width = libraryEl.offsetWidth + 'px';
  g.style.height = libraryEl.offsetHeight + 'px';
  const topo = libraryEl.scrollTop;
  // Desde a v5.107 o seletor de arquivos mora no RODAPÉ (`#listFoot`), que fica
  // fora do `<ul>` e portanto fora do fantasma — mas a guarda continua: se um
  // dia algo voltar a pendurá-lo dentro da lista, ele iria junto para o
  // fantasma, sairia do documento quando este fosse descartado, e o `change`
  // que importa arquivos deixaria de acontecer sem erro nenhum no console.
  if (fileEl.parentElement && fileEl.parentElement.closest('#library')) mainEl.appendChild(fileEl);
  while (libraryEl.firstChild) g.appendChild(libraryEl.firstChild);
  mainEl.appendChild(g);
  g.scrollTop = topo;   // o fantasma tem de começar onde o olho estava
  tabGhost = g;
  return g;
}

// `dir` = +1 quando a tela nova está à DIREITA (o dedo foi para a esquerda):
// a nova vem de +100% e a velha sai por -100%.
function animateTabSwitch(dir, ghost) {
  const opts = { duration: TAB_MOVE_MS, easing: TAB_MOVE_EASE, fill: 'both' };
  if (ghost) {
    const saida = ghost.animate(
      [{ transform: 'none' }, { transform: 'translateX(' + (-dir * 100) + '%)' }], opts);
    const limpar = () => { ghost.remove(); if (tabGhost === ghost) tabGhost = null; };
    saida.onfinish = limpar;
    saida.oncancel = limpar;
  }
  libraryEl.animate(
    [{ transform: 'translateX(' + (dir * 100) + '%)' }, { transform: 'none' }], opts);
}

// Troca de tela da lista. Nem toda tela tem aba: **Favoritos** é alcançada
// pelo botão no fim do Cronograma (ver renderListFoot), e o botão voltar dali
// retorna ao Cronograma — mas continua sendo um `activeTab` ('folders'), com a
// mesma navegação interna (atalhos, pastas do dispositivo, busca).
// `semAnim` para as trocas que NÃO são um passo lateral entre abas: fechar a
// gaveta de Favoritos volta para o Cronograma, mas o movimento que o operador
// vê ali é a gaveta subindo — um carrossel por baixo dela seria um segundo
// movimento contando outra história.
async function switchTab(tab, semAnim) {
  if (tab === activeTab) return;
  // Direção do deslize: +1 se a tela nova está à direita da atual, -1 se à esquerda.
  const dir = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(activeTab) ? 1 : -1;
  // Mantém a posição: guarda o scroll da aba atual e NÃO reseta a pasta
  // aberta — voltar para os Favoritos retorna exatamente onde estava.
  rememberScroll();
  // Sair da aba com o microfone aberto o deixaria captando sem nada na tela
  // que mostrasse isso. O botão é push-to-talk: sem o botão, sem microfone.
  if (activeTab === 'mic' && (micPressed || micOn)) sendMic(false);
  // O laço do painel morre com a aba (o cronômetro NÃO — ele segue correndo no
  // estado, e a projeção tem laço próprio). Sem isto sobraria um timer de 5 Hz
  // reescrevendo um nó que o `innerHTML = ''` da lista já descartou.
  if (activeTab === 'mic') { stopChronoPanelTimer(); stopDrawPanelTimer(); }
  // Os Favoritos são a gaveta, não uma aba: nem sai deslizando nem entra.
  const anima = !semAnim && !prefersReducedMotion && !!libraryEl.animate
    && activeTab !== 'folders' && tab !== 'folders'
    && !favPopupEl.classList.contains('open');
  // O fantasma é feito ANTES do render: ele leva embora os nós que ainda estão
  // na tela, e é ele que o operador continua vendo enquanto o `load()` monta a
  // lista nova (leituras de IndexedDB — poucos ms, mas não zero).
  const fantasma = anima ? makeTabGhost() : null;
  activeTab = tab;
  if (selectionMode) exitSelection();
  try {
    await load();
  } finally {
    // No `finally` porque um `load()` que falhe não pode deixar o fantasma
    // congelado sobre a lista para sempre.
    if (anima) animateTabSwitch(dir, fantasma);
  }
  // Ao entrar na Bíblia: garante versões/livros e baixa a versão INTEIRA na
  // 1ª vez (em segundo plano — ver ensureBibleVersionDownloaded).
  if (activeTab === 'bible') enterBibleTab();
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) switchTab(tab.dataset.tab);
});

// ===== Carrossel: deslizar horizontalmente troca de aba =====
// As três abas já são um carrossel na cabeça de quem usa Android — a animação
// de troca (`animateTabSwitch`) sempre desenhou a lista ENTRANDO pelo lado,
// mas o gesto que produz esse movimento em qualquer outro app não existia
// aqui: só o toque no ícone.
//
// A ordem é a da FAIXA (`SWIPE_TABS`), não a do `TAB_ORDER`: este inclui os
// Favoritos, que não têm botão na faixa — deslizar até uma tela que não aparece
// na navegação deixaria o operador num lugar sem indicação de onde ele está.
//
// **Vale SOBRE A LISTA, inclusive sobre as linhas** — e é isso que faz o
// carrossel existir de verdade. Na v5.49 ele ignorava gestos que começassem
// numa `.row`, porque a linha tinha deslize próprio (adicionar à playlist): na
// prática o Cronograma inteiro é feito de linhas, então o gesto não funcionava
// justamente na aba em que o operador mais tenta usá-lo. O deslize da linha
// saiu (ver "gestos da biblioteca") e o eixo horizontal ficou livre.
//
// As guardas restantes existem para não roubar gestos que já significam algo:
// campos de texto, trilhos que rolam na horizontal (as pílulas de categoria, o
// histórico do sorteio) e qualquer SUB-TELA (pasta aberta, capítulo/leitura da
// Bíblia — reconhecidas pelo botão voltar visível), onde o eixo horizontal
// pertence à navegação de dentro, não à de fora.
const SWIPE_TABS = ['imports', 'bible', 'mic'];
const TAB_SWIPE_MIN = 60;     // px — para TROCAR de aba
const TAB_CLAIM_MIN = 12;     // px — para REIVINDICAR o gesto do navegador
const TAB_SWIPE_RATIO = 1.5;  // quanto o eixo X precisa dominar o Y

(function setupTabCarousel() {
  // DUAS superfícies escutam: a área de conteúdo e a própria faixa de abas —
  // que desde a v5.54 mora na caixa de controles, fora do `<main>`. Deslizar
  // sobre a fileira de abas é o gesto mais óbvio de todos, e ele deixaria de
  // existir se o carrossel continuasse ouvindo só o `<main>`. O estado é
  // compartilhado de propósito: é UM gesto, não dois.
  const superficies = [mainEl, tabsEl];
  const ouvir = (ev, fn, opts) => superficies.forEach((el) => el.addEventListener(ev, fn, opts));

  // ===== O gesto de TOQUE não depende dos eventos de ponteiro =====
  // Esta é a terceira tentativa de destravar o carrossel na aba Ferramentas, e
  // as duas primeiras erraram pelo mesmo motivo: confiaram no fluxo de
  // `pointer*`. O navegador CANCELA esse fluxo (`pointercancel`) assim que
  // decide que o gesto é dele — e basta um scroller no caminho para ele
  // decidir. Quando isso acontece o `pid` some, e o `touchmove` que deveria
  // reivindicar o gesto volta cedo porque não havia gesto armado: o carrossel
  // morre antes de nascer.
  //
  // Agora o toque tem o ciclo INTEIRO próprio — `touchstart` arma,
  // `touchmove` decide o eixo, reivindica (`preventDefault`) e troca a aba,
  // `touchend`/`touchcancel` encerram. Um `pointercancel` não tem mais o que
  // matar. Os `pointer*` ficam só para o MOUSE (é assim que se desenvolve no
  // navegador de mesa), filtrados por `pointerType` para os dois caminhos não
  // tratarem o mesmo dedo duas vezes.
  let x0 = 0, y0 = 0;
  let ativo = false;         // gesto armado e ainda elegível
  let reivindicado = false;  // eixo já decidido como horizontal
  let done = false;          // aba já trocada neste gesto
  let engolirClique = false;

  function elegivel(target) {
    if (selectionMode) return false;
    if (!backBtnEl.hidden) return false;                 // sub-tela: o voltar manda ali
    if (SWIPE_TABS.indexOf(activeTab) < 0) return false;
    if (!target || !target.closest) return false;
    if (target.closest('input, textarea, .draw-hist, .bible-half')) return false;
    return true;
  }

  function comecar(target, x, y) {
    // Todo toque legítimo começa aqui, então é aqui que a trava do clique é
    // desarmada — ver `engolirClique`.
    engolirClique = false;
    ativo = elegivel(target);
    reivindicado = false;
    done = false;
    x0 = x; y0 = y;
  }

  // Devolve `true` quando o gesto é NOSSO (o chamador do toque usa isso para
  // decidir o `preventDefault`). Duas decisões, com limiares diferentes:
  //   • EIXO, aos 12px (`TAB_CLAIM_MIN`) — precisa ser cedo, antes de o
  //     navegador tomar a decisão dele;
  //   • TROCAR de aba, aos 60px (`TAB_SWIPE_MIN`) — precisa de intenção.
  // Uma vez reivindicado, o gesto continua nosso até o dedo levantar: soltar o
  // controle no meio deixaria a página rolar de lado no fim do movimento.
  function mover(x, y) {
    if (!ativo) return reivindicado;
    const dx = x - x0, dy = y - y0;
    if (!reivindicado) {
      if (Math.abs(dx) < TAB_CLAIM_MIN || Math.abs(dx) < Math.abs(dy) * TAB_SWIPE_RATIO) return false;
      reivindicado = true;
    }
    if (!done && Math.abs(dx) >= TAB_SWIPE_MIN) {
      // Age no meio do gesto (não ao soltar): a aba entra deslizando enquanto o
      // dedo ainda se move, que é o que faz o gesto parecer arrastar a tela.
      done = true;
      // O clique é engolido SEMPRE que o gesto se completa, inclusive na ponta
      // do carrossel (deslizar para além da última aba). Ali não há troca de
      // aba, mas o dedo percorreu 60px sobre a tela e o `click` sairia mesmo
      // assim: deslizar sobre "+ Nova mensagem" na última aba abria o diálogo
      // de mensagem nova — um gesto de navegação virando uma ação de conteúdo,
      // que é o pior defeito possível num controle de culto.
      engolirClique = true;
      const i = SWIPE_TABS.indexOf(activeTab) + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < SWIPE_TABS.length) switchTab(SWIPE_TABS[i]);
    }
    return true;
  }

  function terminar() { ativo = false; }

  // ---- toque (o caminho do aparelho) ----
  ouvir('touchstart', (e) => {
    // Dois dedos não é deslize de aba (é zoom, ou o operador segurando a tela).
    if (e.touches.length !== 1) { terminar(); return; }
    comecar(e.target, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  ouvir('touchmove', (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    // NÃO passivo: enquanto este listener existe o navegador espera a decisão
    // dele antes de rolar, e é essa espera que dá ao app a chance de dizer "o
    // eixo horizontal é meu". Um movimento vertical nunca é tocado.
    if (mover(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
  }, { passive: false });
  ['touchend', 'touchcancel'].forEach((ev) => ouvir(ev, terminar, { passive: true }));

  // ---- mouse (só para desenvolver no navegador de mesa) ----
  ouvir('pointerdown', (e) => { if (e.pointerType === 'mouse') comecar(e.target, e.clientX, e.clientY); });
  ouvir('pointermove', (e) => { if (e.pointerType === 'mouse') mover(e.clientX, e.clientY); });
  ['pointerup', 'pointercancel'].forEach((ev) => ouvir(ev, (e) => { if (e.pointerType === 'mouse') terminar(); }));

  // Todo deslize termina num `click` sobre o que estava sob o dedo. Sem engolir
  // esse clique, deslizar sobre a grade de livros trocava de aba **e** abria um
  // livro; sobre a faixa de abas, trocava de aba e voltava para a do ícone que
  // o dedo cruzou; e na ponta do carrossel, um deslize sobre "+ Nova mensagem"
  // abria o diálogo de mensagem. Um listener de CAPTURA, que roda antes de
  // qualquer handler do alvo.
  //
  // A trava é uma FLAG desarmada no toque seguinte, e não um listener com
  // prazo. O prazo (350 ms) parecia bastar — num aparelho o clique vem um
  // quadro depois do dedo levantar —, mas ele mede o tempo errado: numa página
  // em segundo plano (com a janela do Display aberta ao lado, no navegador) o
  // resto do gesto levava mais que isso e a trava expirava antes do clique
  // chegar, que é exatamente o defeito que ela existe para impedir. A flag não
  // depende de tempo nenhum: só um toque novo a limpa, e um toque novo é
  // justamente quando ela deixa de valer.
  ouvir('click', (e) => {
    if (!engolirClique) return;
    engolirClique = false;
    e.stopPropagation(); e.preventDefault();
  }, true);
})();

selCancelEl.addEventListener('click', exitSelection);
selPlaylistEl.addEventListener('click', addSelectedToPlaylist);
selFavEl.addEventListener('click', favoritarSelecionados);
// Arrow de propósito: `openFolderPicker(ids)` interpreta o 1º argumento, e
// passar a referência crua entregaria o MouseEvent como `ids` — funcionava por
// acidente (o evento não tem `.length`).
selFolderEl.addEventListener('click', () => openFolderPicker());
// A gaveta de qualquer aba: é o que faz dos Favoritos um acesso rápido de
// verdade, e não uma sub-tela no fim do Cronograma.
favHeadBtnEl.addEventListener('click', openFavorites);
plPackEl.addEventListener('click', guardarPacote);
selDeleteEl.addEventListener('click', deleteSelected);
selRenameEl.addEventListener('click', renameSelected);

backBtnEl.addEventListener('click', navigateBack);
favBackEl.addEventListener('click', navigateBack);
addDirBtnEl.addEventListener('click', () => syncDeviceFolder());
// Buscar redesenha a lista inteira (innerHTML = '' + um object URL novo por
// miniatura). Numa pasta de igreja com centenas de arquivos, sem debounce isso
// acontecia por TECLA — e nas primeiras letras a lista ainda é quase inteira.
libSearchEl.addEventListener('input', debounce(() => {
  folderQuery = libSearchEl.value;
  renderLibrary();
}, SEARCH_DEBOUNCE_MS));

hymnSearchBtnEl.addEventListener('click', openHymnSearch);
hymnSearchInputEl.addEventListener('input', debounce(() => renderSearchResults(hymnSearchInputEl.value), SEARCH_DEBOUNCE_MS));

// Mantém o indicador de Wi-Fi/dados móveis dos cards de coleção atualizado
// em tempo real (o navegador dispara 'change' quando o tipo de conexão muda).
(function () {
  const conn = networkConnection();
  if (conn && conn.addEventListener) conn.addEventListener('change', refreshCollectionsIfVisible);
})();

// Preview: FORA do fullscreen — toque simples coloca a PRÓPRIA preview em tela
// cheia (landscape); pressionar longo (~500 ms) abre as configurações de
// Exibição (fade/fit). A preview em tela cheia é a projeção direta pelo Controle
// (espelha a tela cheia do celular, sem depender do Miracast de app isolado).
//
// DENTRO do fullscreen — a tela inteira vira uma superfície de CONTROLE POR
// GESTOS INVISÍVEIS (nada é desenhado no telão), mapeados para as ações que já
// existem. Mapa (posição + tipo de movimento distinguem cada gesto):
//   • Volume        → ARRASTAR na vertical no terço DIREITO (cima = +, baixo = −)
//   • Play/Pause    → TOQUE no terço central
//   • Estrofe ± 1   → TOQUE no terço esquerdo (anterior) / direito (próxima)
//   • Mídia ± 1     → DESLIZE horizontal: ← próxima, → anterior
//   • Wallpaper on/off → DESLIZE para CIMA (terço esq/central)
//   • Sair da tela cheia → DESLIZE para BAIXO (terço esq/central) — ou o gesto
//                          de voltar do Android
// A trava de paisagem (Screen Orientation API) só é permitida COM o elemento já
// em fullscreen (padrão de player de vídeo); é destravada ao sair.
(function setupPreviewGestures() {
  const isFs = () => document.fullscreenElement === previewEl;

  // ---- controles nos cantos da preview (fora do fullscreen) ----
  // Antes as ações eram gestos invisíveis sobre a preview (toque = tela cheia,
  // toque longo = popup de Exibição) — nada na tela dizia que existiam. Cada
  // uma virou um botão num canto, e por um tempo o toque na preview os
  // MOSTRAVA/ESCONDIA.
  //
  // **Esse toque saiu na v5.67: eles são permanentes.** Esconder era uma
  // resposta ao desenho errado — dois retângulos de vidro empilhados numa
  // coluna, que de fato tampavam a miniatura. Com os ícones sem moldura e nos
  // CANTOS (cast em cima, tela cheia embaixo) não há mais o que atrapalhar, e o
  // que sobrava era um estado escondido: uma preview sem botão nenhum não
  // anuncia que basta tocar nela para trazê-los — é o problema dos gestos
  // invisíveis de volta, com um passo a mais. Errar o alvo por 2px também
  // deixou de custar caro: antes o toque caía no reconhecedor de gestos e
  // sumia com a coluna inteira.
  //
  // São DOIS desde a v5.49 — a engrenagem virou o `#settingsBtn` fixo no topo
  // do mixer.
  document.getElementById('pvFullBtn').addEventListener('click', enterFullscreen);
  // Cast: no avançado só existe com o shell nativo (é um intent do Android) —
  // regra geral do projeto: o web é o padrão, o nativo é a exceção que se
  // declara. No SIMPLIFICADO ele aparece sempre, porque ali é o sinal de
  // conexão da preview e a porta de saída dela (ver renderSimpleCast): no
  // navegador, "desconectar" é fechar a janela do Display.
  pvCastBtnEl.addEventListener('click', () => {
    // Liberação de TESTE: não há tela real para desconectar, então o toque
    // simplesmente tranca de volta. É o par do "segurar 5 s" que destravou —
    // e o botão que hospedava aquele gesto some justamente quando a liberação
    // fica ativa, porque a preview toma o lugar dele.
    if (castTestUnlocked) { castTestUnlocked = false; renderSimpleCast(); return; }
    if (window.__NATIVE__) AVNative.openCast();
    else openWebDisplay();
  });

  async function enterFullscreen() {
    try {
      if (previewEl.requestFullscreen) await previewEl.requestFullscreen();
      else if (previewEl.webkitRequestFullscreen) previewEl.webkitRequestFullscreen();
      try { await (screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')); } catch (_) {}
    } catch (_) {}
  }
  function exitFullscreen() { try { if (document.exitFullscreen) document.exitFullscreen(); } catch (_) {} }
  document.addEventListener('fullscreenchange', () => {
    // Nada a sincronizar nos botões: dentro da tela cheia quem os esconde é o
    // CSS (nada de UI sobre a projeção), e fora dela eles são permanentes.
    if (!document.fullscreenElement) { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (_) {} }
  });

  // ---- reconhecedor de gestos (só em fullscreen) ----
  const TAP_MOVE = 14, SWIPE_MIN = 45, VOL_MIN = 12;
  let sx = 0, sy = 0, third = 'center', volActive = false, volStart = 1;
  function zoneOf(clientX) {
    const r = previewEl.getBoundingClientRect();
    const x = clientX - r.left, w = r.width || 1;
    if (x < w / 3) return 'left';
    if (x > 2 * w / 3) return 'right';
    return 'center';
  }

  previewEl.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY;
    if (!isFs()) return; // fora do fullscreen basta a origem (toque × arrasto)
    third = zoneOf(e.clientX);
    volActive = false; volStart = volume;
    try { previewEl.setPointerCapture(e.pointerId); } catch (_) {}
  });

  previewEl.addEventListener('pointermove', (e) => {
    if (!isFs()) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    // volume: arrasto vertical no terço direito
    if (third === 'right' && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > VOL_MIN) {
      volActive = true;
      const h = previewEl.getBoundingClientRect().height || 1;
      applyVolume(volStart + (-dy / (h * 0.6))); // arrastar pra cima aumenta
    }
  });

  previewEl.addEventListener('pointerup', (e) => {
    if (isFs()) {
      if (volActive) { persistCurrent(); return; }
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      // Ações acionam os BOTÕES existentes (.click()): reaproveitam os handlers
      // e respeitam o `disabled` (ex.: estrofe ± vira no-op quando não há letra).
      if (Math.max(adx, ady) < TAP_MOVE) {                        // TOQUE
        if (third === 'left') slidePrevBtnEl.click();             // estrofe anterior
        else if (third === 'right') slideNextBtnEl.click();       // próxima estrofe
        else playPauseEl.click();                                 // centro → play/pause
      } else if (adx > ady && adx > SWIPE_MIN) {                  // DESLIZE horizontal → mídia
        if (dx < 0) nextEl.click(); else prevEl.click();          // ← próxima, → anterior
      } else if (ady > adx && ady > SWIPE_MIN && third !== 'right') { // DESLIZE vertical (esq/centro)
        if (dy < 0) viewToggleEl.click(); else exitFullscreen();  // ↑ wallpaper · ↓ sair
      }
    }
    // Fora do fullscreen a preview NÃO tem ação própria. Tinha: o toque
    // escondia/mostrava os botões dos cantos, e isso saiu na v5.67 (eles são
    // permanentes — ver acima). Quem age é quem tocar num botão.
  });

  previewEl.addEventListener('pointercancel', () => { volActive = false; });
})();
fitSegEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.fit-opt');
  if (btn) applyFit(btn.dataset.fit);
});
// Girar: AVANÇA 90° por toque, dando a volta. Ver `applyRotate`.
if (rotBtnEl) rotBtnEl.addEventListener('click', () => applyRotate(mediaRot + 90));
// Wallpaper: escolher imagem / voltar ao padrão.
wallFileEl.addEventListener('change', async () => {
  const file = (wallFileEl.files || [])[0];
  wallFileEl.value = '';
  if (file) await setWallpaper(file);
});
wallResetEl.addEventListener('click', () => { setWallpaper(null); });
// Estado do telão, no rodapé do popup de Exibição.
//
// O Display NÃO é mais um app que se "abre": é a `Presentation` que o shell
// cria sozinho na TV assim que uma tela de apresentação aparece — e recria
// quando o dongle cai e volta (o WebView recarrega /display/, dispara
// `display-ready` e o Controle reenvia o estado atual). Não há o que lançar,
// então aqui só se informa o que está conectado, ao vivo, pela ponte.
//
// No navegador não existe Presentation: o rodapé volta a ser o atalho para a
// tela do Display, útil para desenvolver a base web fora do app.
if (window.__NATIVE__) {
  const renderDisplayStatus = (list) => {
    const tv = (list && list[0]) || null;
    lastDisplays = list || [];
    renderSimpleCast();
    openDisplayBtnEl.disabled = true;
    openDisplayBtnEl.classList.toggle('connected', !!tv);
    displayStatusTextEl.textContent = tv
      ? 'Telão conectado: ' + (tv.name || 'TV') + ' (' + tv.w + '\u00d7' + tv.h + ')'
      : 'Nenhum telão conectado';
    applyPreviewAspect(tv);
    // O botão da mesa de som depende disto (ver `renderStandaloneSeg`): com
    // telão conectado, o som da preview interromperia o player do telão.
    pushTelaoNoSom();
  };
  AVNative.displays().then(renderDisplayStatus);
  AVNative.onDisplayChange(renderDisplayStatus);
  // E RECONFERE AO VOLTAR PARA A FRENTE (v5.142). O aviso do shell é um evento,
  // e um evento perdido não se recupera sozinho: a tela pode cair (ou voltar)
  // com o app minimizado, e este WebView é estrangulado justamente aí. Uma
  // leitura na retomada — a lista, não um evento — é o piso que fecha esse
  // buraco, e é barata: uma consulta ao DisplayManager quando o operador pega o
  // aparelho de volta.
  reconferirTelas = () => { AVNative.displays().then(renderDisplayStatus); };
  // Para onde o botão de cast da preview abre neste aparelho. Espelhamento de
  // tela não é Google Cast, e o alvo muda por fabricante (Smart View na
  // Samsung, "Wireless display" no AOSP) sem API documentada — então o app
  // mostra o que encontrou em vez de deixar isso invisível.
  AVNative.castTarget().then((label) => {
    if (!label) return;
    castTargetLineEl.hidden = false;
    castTargetLineEl.textContent = 'Espelhar abre: ' + label;
  });
} else {
  displayStatusTextEl.textContent = 'Abrir tela do Display';
  // Mesmo caminho do botão do simplificado: uma janela só (nome 'avDisplay') e
  // um só lugar que sabe se ela ainda está aberta.
  openDisplayBtnEl.addEventListener('click', openWebDisplay);
}


// ===== ESPELHO DE PIXELS: o telão nas telas da rede local =====
//
// O shell hospeda uma SEGUNDA cópia de `/web/display/` numa tela virtual que
// só ele enxerga, codifica o framebuffer dela e serve os quadros por HTTP na
// rede da igreja — até três navegadores, sem instalar nada neles e sem
// depender de internet. Ver `docs/ESPELHO-DE-PIXELS.md`.
//
// O QUE ESTE ARQUIVO FAZ, e só isto: desenha o interruptor, faz a pergunta que
// precisa ser feita antes de ligar, mostra endereço e PIN, e põe o operador no
// laço das telas que pedem entrada. Nenhuma decisão de rede, de encoder ou de
// pareamento mora aqui — o Kotlin devolve DADO (JSON) e a frase é montada
// deste lado, que é a mesma divisão do `otaDiag` e do `ytDiag`.
//
// **O espelho é AUXILIAR por contrato, e a consequência que governa toda esta
// tela: ele NUNCA se desliga sozinho.** Liga por ação do operador e desliga por
// ação do operador, pelo fechamento do app, ou por uma falha que o app nomeia
// em texto. Uma TV que conecta não o derruba — o que existe é uma CONFIRMAÇÃO
// antes de ligar com o telão no ar (abaixo), porque aí o aparelho passa a
// desenhar e codificar duas projeções ao mesmo tempo. Regra invertida seria pior
// que regra nenhuma: sem TV, as telas da rede SÃO o que a congregação vê, e um
// desligamento automático apagaria a projeção no meio do louvor.

// O piso de shell. Um método novo NÃO chega por OTA: num shell antigo a linha
// simplesmente não é desenhada, e volta sozinha quando o APK novo for
// instalado. É a mesma regra (e o mesmo motivo) do `appendYoutubeSearch`.
const MIRROR_SHELL = 32;
// Enquanto a folha está aberta, o estado é relido: é o que faz uma tela que
// acabou de digitar o PIN aparecer na fila sem o operador tocar em nada. Fora
// da folha nada é enquetado — o espelho não muda por conta própria.
const MIRROR_POLL_MS = 2500;

function espelhoDisponivel() {
  return !!window.__NATIVE__ && (window.__SHELL_VERSION__ | 0) >= MIRROR_SHELL;
}

// O último estado lido da ponte (`null` = nunca perguntamos). Formato em
// `AVNative.espelhoEstado`.
let mirrorEstado = null;
// O modo do PRÓXIMO ligar. Ele não é uma preferência lembrada entre aberturas
// de propósito: a Entrega 1 é o modo imagem e a escolha é do dia, não do app.
let mirrorModo = 'imagem';
let mirrorTimer = null;
let mirrorOcupado = false;
// A confirmação de ligar COM A TV NO AR, lembrada pela SESSÃO: perguntar de
// novo a cada toque viraria ruído, e quem já respondeu "sim" uma vez naquele
// culto não muda de ideia por causa do segundo toque.
let mirrorTvConfirmado = false;
// Este aparelho sabe ler um QR pela câmera? `null` = ainda não perguntamos.
// A pergunta é assíncrona (`getSupportedFormats`) e a resposta é lembrada pela
// sessão: ela é sobre o aparelho e o WebView, e nenhum dos dois muda no meio de
// um culto. Ver `sondarLeituraQr`.
let qrSuportado = null;

function espelhoLigado() { return !!(mirrorEstado && mirrorEstado.ligado); }

async function lerEspelho() {
  if (!espelhoDisponivel()) return null;
  let e = null;
  try { e = await AVNative.espelhoEstado(); } catch (_) { e = null; }
  mirrorEstado = e || null;
  if (mirrorEstado && mirrorEstado.modo) mirrorModo = mirrorEstado.modo;
  renderEspelho();
  return mirrorEstado;
}

// As três ressalvas que o operador precisa ouvir ANTES, e não num domingo: o
// roteador pode bloquear isso sozinho e não há conserto do lado do app; o
// celular precisa do carregador; e o som não vai completo.
const MIRROR_TEXTO_OFF =
  'Põe o telão inteiro — com fades, cortina e vídeo — em até três navegadores '
  + 'da rede da igreja. Ninguém instala nada: digita o endereço, vê o número de '
  + 'seis dígitos aqui na sua tela, e você aprova.\n\n'
  + 'Antes de ligar: o roteador da igreja pode bloquear isto sozinho (isolamento '
  + 'de clientes) — se for o caso, o Registro vai dizer em texto; deixe o celular '
  + 'no carregador; e o som não vai completo (vídeo do YouTube pelo player '
  + 'embutido vai mudo, e o microfone ao vivo nunca sai na rede, de propósito).';
const MIRROR_TEXTO_ON =
  'Quem for assistir abre o endereço abaixo no navegador. A tela mostra um '
  + 'código; toque em "Ler o código da tela", aponte a câmera para ele, e ela '
  + 'entra na hora.\n\n'
  + 'Sem câmera à mão, o número de seis dígitos continua valendo: quem digitar '
  + 'o número entra na fila abaixo e você aprova.\n\n'
  // O SOM É POR TELA, e quem liga é quem está na frente dela. Isto precisa
  // estar dito AQUI, na tela do operador, porque é ele quem vai ser perguntado
  // — e no primeiro culto de teste a resposta que faltava era esta.
  + 'Cada tela entra MUDA, de propósito (três telas com som dentro da igreja '
  + 'são três alto-falantes com eco). Quem estiver na sala toca uma vez na tela '
  + 'para ver em tela cheia e ouvir.';

function renderEspelho() {
  if (!mirrorRowEl) return;
  // A LINHA de Configurações. `hidden` até o shell ter os métodos.
  mirrorRowEl.hidden = !espelhoDisponivel();
  if (mirrorRowEl.hidden) return;
  const e = mirrorEstado || {};
  const ligado = !!e.ligado;
  const telas = Array.isArray(e.telas) ? e.telas : [];
  const pendentes = Array.isArray(e.pendentes) ? e.pendentes : [];
  mirrorRowHintEl.textContent = ligado
    ? (e.endereco || 'Ligado') + ' · ' + telas.length + ' tela(s)'
      + (pendentes.length ? ' · ' + pendentes.length + ' esperando' : '')
    : (e.erro || 'Desligado');
  // Verde é "há uma tela recebendo" no resto do app, e aqui quer dizer o mesmo.
  // Nunca o vermelho preenchido de "no ar": esse é do telão, e o espelho é
  // auxiliar — dois significados para a mesma cor na mesma tela é o erro que
  // este projeto já documenta ter cometido com o ícone da cortina.
  mirrorRowHintEl.classList.toggle('on', ligado);

  // A FOLHA.
  mirrorLeadEl.textContent = e.erro
    ? e.erro + '\n\n' + MIRROR_TEXTO_OFF
    : (ligado ? MIRROR_TEXTO_ON : MIRROR_TEXTO_OFF);
  mirrorAddrEl.hidden = !ligado;
  mirrorUrlEl.textContent = e.endereco || '';
  mirrorPinEl.textContent = e.pin || '';
  // O botão de ler o QR só existe com o espelho no ar: sem servidor não há
  // tela mostrando código nenhum, e apontar a câmera para o nada não é um
  // estado que valha desenhar. `qrLeituraOk()` é a sonda do aparelho (câmera +
  // leitor de QR + shell 33) — e ela é resolvida uma vez, ao abrir a folha.
  mirrorScanEl.hidden = !(ligado && qrSuportado === true);
  // "Uma tela esperando a leitura" é o dado que separa "ninguém abriu o
  // endereço" de "abriu, o código está lá, e o que falta é a câmera". As duas
  // coisas são a MESMA lista vazia, porque a espera de QR não entra nela.
  const emCartaz = e.qrEsperando | 0;
  mirrorScanEl.querySelector('span:last-child').textContent = emCartaz
    ? 'Ler o código da tela (' + emCartaz + ' esperando)'
    : 'Ler o código da tela';
  mirrorModeSegEl.querySelectorAll('.fit-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mirrormode === mirrorModo);
  });
  mirrorAutoEl.checked = !!e.autoAprovar;
  mirrorToggleEl.textContent = mirrorOcupado
    ? 'Um instante…'
    : (ligado ? 'Desligar o espelho' : 'Ligar o espelho');
  mirrorToggleEl.disabled = mirrorOcupado;
  mirrorToggleEl.classList.toggle('on', ligado);
  renderEspelhoLista(pendentes, telas);
}

// A fila de aprovação em cima, as telas já conectadas embaixo. Uma lista só,
// porque são a mesma pergunta em dois estados ("quem está olhando?") e duas
// listas fariam a de baixo parecer ação pendente quando não é.
function renderEspelhoLista(pendentes, telas) {
  mirrorListEl.innerHTML = '';
  pendentes.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'mirror-item';
    const main = document.createElement('div');
    main.className = 'mirror-item-main';
    const nome = document.createElement('span');
    nome.className = 'mirror-item-name';
    // `textContent`, NUNCA `innerHTML`: este texto vem de um desconhecido da
    // rede. Ele já é saneado no Kotlin (§3.5), e esta linha é a segunda
    // fechadura — a diferença entre um espelho e a execução de JavaScript de
    // terceiro no origin privilegiado que injeta `__AVBridge`.
    nome.textContent = p.ua || 'Tela desconhecida';
    const sub = document.createElement('span');
    sub.className = 'mirror-item-sub';
    sub.textContent = 'quer entrar' + (p.desdeMs ? ' · esperando há ' + mirrorDur(p.desdeMs) : '');
    main.append(nome, sub);
    const sim = document.createElement('button');
    sim.type = 'button';
    sim.className = 'mirror-act';
    sim.textContent = 'Aprovar';
    sim.addEventListener('click', () => decidirEspelho(p.id, true));
    const nao = document.createElement('button');
    nao.type = 'button';
    nao.className = 'mirror-act mirror-act--no';
    nao.textContent = 'Recusar';
    nao.addEventListener('click', () => decidirEspelho(p.id, false));
    li.append(main, sim, nao);
    mirrorListEl.appendChild(li);
  });
  telas.forEach((t) => {
    const li = document.createElement('li');
    li.className = 'mirror-item';
    const main = document.createElement('div');
    main.className = 'mirror-item-main';
    const nome = document.createElement('span');
    nome.className = 'mirror-item-name';
    nome.textContent = t.ua || 'Tela';
    const sub = document.createElement('span');
    sub.className = 'mirror-item-sub';
    sub.textContent = 'recebendo' + (t.rotulo ? ' · tela ' + t.rotulo : '');
    main.append(nome, sub);
    li.append(main);
    mirrorListEl.appendChild(li);
  });
  if (!mirrorListEl.children.length && espelhoLigado()) {
    const li = document.createElement('li');
    li.className = 'mirror-item';
    const main = document.createElement('div');
    main.className = 'mirror-item-main';
    const nome = document.createElement('span');
    nome.className = 'mirror-item-name';
    nome.textContent = 'Nenhuma tela ainda';
    const sub = document.createElement('span');
    sub.className = 'mirror-item-sub';
    // A frase que dá a saída, e não só o fato: "ninguém conectou" e "o roteador
    // está isolando os clientes" são a MESMA tela vazia, e o operador não tem
    // como distinguir sem que alguém diga. O veredito com hora está no
    // Registro; aqui fica a leitura curta.
    sub.textContent = 'se alguém já abriu o endereço, o roteador pode estar isolando os aparelhos';
    main.append(nome, sub);
    li.append(main);
    mirrorListEl.appendChild(li);
  }
}

async function decidirEspelho(id, aprovar) {
  if (!id) return;
  try { await AVNative.espelhoAprovar(id, aprovar); } catch (_) { /* ponte */ }
  await lerEspelho();
}

// ============================================================================
// O LEITOR DE QR — o caminho curto do pareamento
// ============================================================================
//
// **A INVERSÃO É O RECURSO.** No pareamento por PIN, o CELULAR mostra um
// segredo de seis dígitos e a TELA o digita: alguém atravessa o salão, um
// teclado de controle remoto entra na história, e o segredo fica em cartaz na
// tela do operador durante todo o culto — que é exatamente o motivo de a
// aprovação automática nascer desligada. Aqui é ao contrário: a TELA mostra e o
// CELULAR lê.
//
// E o que ela mostra **não é segredo nenhum**: é o `id` da espera que aquela
// página acabou de criar, que o servidor devolve a quem pedir. Ele não abre
// nada. O que autoriza é o operador ter apontado a câmera para AQUELA tela — a
// mesma decisão da invariante 5 do `EspelhoPares` ("o operador fica no laço"),
// tomada com um gesto em vez de uma lista. Quem fotografar o QR de longe leva
// 22 caracteres que já foram usados.
//
// Por isso a aprovação reusa `espelhoAprovar` sem método novo: ler o código é
// aprovar aquele id, e é literalmente o mesmo ato que o botão "Aprovar" da
// lista faz. O único método novo do lote é a PERMISSÃO de câmera.
//
// O SHELL PRECISA SER NOVO, e não há como contornar: sem `requestCam` o
// `getUserMedia` do WebView é negado **em silêncio** (a promise rejeita e não há
// erro no console), que é a armadilha que o `MicChromeClient` já documenta para
// o telão. Abaixo do shell 33 o botão nem aparece e o PIN segue sendo o
// caminho — ele nunca deixou de existir.

// O prefixo que separa "isto é uma tela do espelho" de "isto é um QR qualquer".
// Sem ele, apontar a câmera para um cartaz mandaria um texto aleatório como id
// de aprovação — inofensivo (nenhum id casa), mas indistinguível de uma falha.
const QR_PREFIXO = 'AVE1:';
// O id é base64url de 128 bits (22 caracteres) — a mesma forma do `SafRegistry`
// e do `StreamProxy`. Conferir a FORMA antes de mandar é o que faz um QR de
// outro app virar uma frase em vez de uma chamada à ponte.
const QR_FORMA = /^[A-Za-z0-9_-]{16,64}$/;
const QR_INTERVALO_MS = 220;

let qrLeitor = null;      // o BarcodeDetector, criado uma vez por leitura
let qrFluxo = null;       // o MediaStream vivo — é ELE que precisa morrer
let qrTimer = null;
let qrOcupado = false;    // uma detecção por vez (a chamada é assíncrona)

/**
 * O aparelho sabe ler QR? Uma vez por sessão, e o resultado governa o botão.
 *
 * `BarcodeDetector` existe no Chrome do Android e no WebView, mas depende de um
 * módulo do sistema que pode não estar presente — e `getSupportedFormats()` é a
 * única pergunta honesta, porque a classe existir não promete que ela saiba ler
 * `qr_code`.
 */
async function sondarLeituraQr() {
  if (qrSuportado !== null) return qrSuportado;
  qrSuportado = false;
  try {
    if (!espelhoDisponivel() || (window.__SHELL_VERSION__ | 0) < 33) return false;
    if (typeof window.BarcodeDetector !== 'function') return false;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return false;
    const formatos = await window.BarcodeDetector.getSupportedFormats();
    qrSuportado = Array.isArray(formatos) && formatos.indexOf('qr_code') >= 0;
  } catch (_) { qrSuportado = false; }
  return qrSuportado;
}

async function abrirLeitorQr() {
  if (qrFluxo) return;
  qrPopupEl.classList.add('open');
  qrMsgEl.textContent = 'Pedindo a câmera…';
  // A permissão do ANDROID antes do `getUserMedia` do WebView: sem ela o
  // `onPermissionRequest` do Controle nega calado, de propósito.
  let permitido = false;
  try { permitido = await AVNative.requestCam(); } catch (_) { permitido = false; }
  if (!qrPopupEl.classList.contains('open')) return;   // fechou enquanto pedia
  if (!permitido) {
    qrMsgEl.textContent = 'A câmera não foi liberada. Use o número de seis '
      + 'dígitos que aparece acima, ou libere a câmera nas permissões do app.';
    return;
  }
  try {
    qrFluxo = await navigator.mediaDevices.getUserMedia({
      // A traseira, porque o operador aponta o aparelho para a tela. `ideal` e
      // não `exact`: num aparelho de uma câmera só, `exact` FALHA em vez de
      // cair na que existe.
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    });
  } catch (e) {
    qrMsgEl.textContent = 'Não foi possível abrir a câmera (' + (e && e.name ? e.name : 'erro')
      + '). O número de seis dígitos continua valendo.';
    return;
  }
  if (!qrPopupEl.classList.contains('open')) { fecharLeitorQr(); return; }
  qrVideoEl.srcObject = qrFluxo;
  try { await qrVideoEl.play(); } catch (_) { /* autoplay mudo não costuma falhar */ }
  try { qrLeitor = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { qrLeitor = null; }
  if (!qrLeitor) {
    qrMsgEl.textContent = 'Este aparelho não sabe ler códigos QR.';
    fecharLeitorQr();
    return;
  }
  qrMsgEl.textContent = 'Aponte para o código que aparece na tela.';
  clearInterval(qrTimer);
  qrTimer = setInterval(passoLeitorQr, QR_INTERVALO_MS);
  vigiarImagemQr();
}

// A CÂMERA PODE ABRIR SEM ENTREGAR IMAGEM, e isso aconteceu em aparelho: o
// indicador do sistema acende, a leitura roda, e o operador olha para um
// retângulo preto sem ter como mirar. Um visor preto e um visor "ainda
// carregando" são a mesma tela, e quem está com o aparelho na mão não tem como
// distinguir — então o app diz qual dos dois é.
//
// `videoWidth` é o teste honesto: ele só sai de zero quando um quadro de
// verdade chegou ao elemento. A frase só aparece depois de dois segundos
// porque abrir a câmera leva um instante em qualquer aparelho, e um alarme que
// pisca no caminho normal é um alarme que ninguém lê.
function vigiarImagemQr() {
  const ate = Date.now() + 2000;
  const olhar = () => {
    if (!qrFluxo) return;
    if (qrVideoEl.videoWidth > 0) {
      qrMsgEl.textContent = 'Aponte para o código que aparece na tela ('
        + qrVideoEl.videoWidth + '×' + qrVideoEl.videoHeight + ').';
      return;
    }
    if (Date.now() > ate) {
      qrMsgEl.textContent = 'A câmera abriu mas não está entregando imagem. '
        + 'A leitura continua tentando às cegas — se não funcionar, use o número '
        + 'de seis dígitos.';
      return;
    }
    setTimeout(olhar, 250);
  };
  setTimeout(olhar, 250);
}

async function passoLeitorQr() {
  if (qrOcupado || !qrLeitor || !qrFluxo) return;
  qrOcupado = true;
  let achados = [];
  try { achados = await qrLeitor.detect(qrVideoEl); } catch (_) { achados = []; }
  qrOcupado = false;
  if (!qrFluxo) return;                       // fechou durante a detecção
  for (const a of achados) {
    const cru = (a && a.rawValue) || '';
    if (cru.slice(0, QR_PREFIXO.length) !== QR_PREFIXO) continue;
    const id = cru.slice(QR_PREFIXO.length);
    if (!QR_FORMA.test(id)) continue;
    await aprovarPorQr(id);
    return;
  }
  // Um QR que não é nosso é um desfecho DITO, não um silêncio: apontar para o
  // cartaz errado e não receber resposta nenhuma é indistinguível de "a câmera
  // não está lendo".
  if (achados.length) qrMsgEl.textContent = 'Este código não é de uma tela do espelho.';
}

async function aprovarPorQr(id) {
  // Para a leitura ANTES de aprovar: sem isto o intervalo seguinte dispara com
  // o mesmo código ainda na frente da câmera e aprova de novo. `espelhoAprovar`
  // é idempotente do lado do Kotlin (dois toques devolvem a MESMA sessão), mas
  // depender disso aqui seria deixar a corrida de pé por sorte.
  clearInterval(qrTimer);
  qrTimer = null;
  qrMsgEl.textContent = 'Liberando a tela…';
  let ok = false;
  try { ok = await AVNative.espelhoAprovar(id, true); } catch (_) { ok = false; }
  if (ok) {
    fecharLeitorQr();
    avisar('Tela liberada.');
    await lerEspelho();
    return;
  }
  // A recusa do Kotlin tem três causas, e o operador precisa da que se resolve:
  // o teto de três telas é a única acionável.
  qrMsgEl.textContent = 'A tela não foi liberada. Pode ser o limite de três '
    + 'telas — feche uma antes, ou peça para a página gerar um código novo.';
  qrTimer = setInterval(passoLeitorQr, QR_INTERVALO_MS);
}

/**
 * Fecha e **desliga a câmera**, que é a única coisa aqui que não pode ficar
 * para trás. Chamado pelo ✕, pelo toque no fundo e pelo botão voltar do
 * aparelho — os três, porque este popup está na tabela `POPUPS`.
 */
function fecharLeitorQr() {
  clearInterval(qrTimer);
  qrTimer = null;
  qrLeitor = null;
  qrOcupado = false;
  if (qrFluxo) {
    try { qrFluxo.getTracks().forEach((t) => t.stop()); } catch (_) { /* já morto */ }
    qrFluxo = null;
  }
  try { qrVideoEl.srcObject = null; } catch (_) { /* ignorado */ }
  qrPopupEl.classList.remove('open');
}

// LIGAR COM A TV NO AR pede uma confirmação explícita, e ela substitui o
// interruptor escondido em Configurações que o desenho anterior tinha: ninguém
// acharia aquele interruptor, e ele expressava a decisão errada (desligar o
// espelho sozinho). O custo real de rodar com telão — dois `/display/`, até
// três players do YouTube, dois encodes — é medível e falha ruidosamente; o que
// não se pode fazer é decidir por conta própria apagar a imagem que a sala
// anexa está assistindo.
async function confirmarEspelhoComTv() {
  if (mirrorTvConfirmado) return true;
  if (!lastDisplays.length) return true;
  const ok = await appConfirm({
    title: 'Ligar com a TV no ar?',
    message: 'Com o telão conectado, o aparelho passa a desenhar e codificar DUAS '
      + 'projeções ao mesmo tempo — isto dobra o trabalho dele.\n\n'
      + 'A TV não é afetada: se faltar fôlego, quem sai do ar é o espelho, com uma '
      + 'frase dizendo por quê. Ligar assim mesmo?',
    okText: 'Ligar assim mesmo',
    cancelText: 'Agora não',
  });
  if (ok) mirrorTvConfirmado = true;
  return ok;
}

async function ligarEspelho(modo) {
  if (mirrorOcupado) return;
  if (!(await confirmarEspelhoComTv())) return;
  mirrorOcupado = true;
  renderEspelho();
  let r = null;
  try { r = await AVNative.espelhoLigar(modo || mirrorModo); } catch (_) { r = null; }
  mirrorOcupado = false;
  mirrorEstado = r || null;
  if (r && r.modo) mirrorModo = r.modo;
  renderEspelho();
  // A falha é NOMEADA, sempre: "sem encoder livre agora", "só liga em Wi-Fi",
  // a classe da exceção do `show()`. Um espelho que não liga em silêncio é
  // indistinguível de um botão quebrado.
  if (!r) avisar('O espelho não respondeu.', 'erro');
  else if (r.erro) avisar(r.erro, 'erro');
  else avisar('Espelho ligado.');
}

async function desligarEspelho() {
  if (mirrorOcupado) return;
  mirrorOcupado = true;
  renderEspelho();
  try { AVNative.espelhoDesligar(); } catch (_) { /* ponte */ }
  // `espelhoDesligar` volta na hora (escreve um campo e sai — ver o KDoc da
  // ponte): a demolição acontece logo depois, na main thread do shell. Sem esta
  // folga a releitura pegaria o estado ANTERIOR e a folha diria "ligado" por um
  // ciclo. O relógio da folha aberta corrige de qualquer jeito; isto é para o
  // toque ter resposta imediata.
  await new Promise((r) => setTimeout(r, 300));
  mirrorOcupado = false;
  await lerEspelho();
  avisar('Espelho desligado.');
}

// TROCAR DE MODO É DESLIGAR E LIGAR DE NOVO, e a folha diz isso em vez de fingir
// que é um interruptor. O motivo é da plataforma: trocar a Surface de um
// VirtualDisplay ao vivo tem, nas palavras do AOSP, "efeito parecido com
// desligar a tela" — o consumidor novo não recebe nada até a janela redesenhar,
// o que numa cena parada pode ser um segundo inteiro de preto na rede.
async function escolherModoEspelho(modo) {
  if (!modo || modo === mirrorModo) return;
  if (!espelhoLigado()) { mirrorModo = modo; renderEspelho(); return; }
  const ok = await appConfirm({
    title: 'Trocar o modo',
    message: 'Trocar entre imagem e vídeo desliga e liga o espelho de novo (leva '
      + 'cerca de um segundo). As telas já aprovadas voltam sozinhas. Trocar agora?',
    okText: 'Trocar',
  });
  if (!ok) return;
  mirrorModo = modo;
  await desligarEspelho();
  await ligarEspelho(modo);
}

function openMirror() {
  if (!espelhoDisponivel()) return;
  mirrorPopupEl.classList.add('open');
  lerEspelho();
  // A sonda da câmera é feita AQUI, uma vez: ela é assíncrona e o `render` é
  // síncrono, então perguntar de dentro dele deixaria o botão aparecendo um
  // ciclo depois. Ao voltar, um `renderEspelho` acerta o botão.
  sondarLeituraQr().then(() => renderEspelho());
  clearInterval(mirrorTimer);
  mirrorTimer = setInterval(lerEspelho, MIRROR_POLL_MS);
}
function closeMirror() {
  mirrorPopupEl.classList.remove('open');
  clearInterval(mirrorTimer);
  mirrorTimer = null;
  // A folha fechando leva a câmera junto: o leitor foi aberto DE DENTRO dela, e
  // um popup filho que sobrevive ao pai é uma câmera ligada sem tela que a
  // explique.
  fecharLeitorQr();
}

if (mirrorRowEl) {
  mirrorOpenBtnEl.addEventListener('click', openMirror);
  mirrorModeSegEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.fit-opt');
    if (btn) escolherModoEspelho(btn.dataset.mirrormode);
  });
  mirrorAutoEl.addEventListener('change', async () => {
    // O `'*'` é a chave da aprovação automática desta sessão — ver o KDoc de
    // `espelhoAprovar` na ponte para por que é um id reservado e não um sexto
    // método.
    try { await AVNative.espelhoAprovar('*', mirrorAutoEl.checked); } catch (_) { /* ponte */ }
    await lerEspelho();
  });
  mirrorToggleEl.addEventListener('click', () => {
    if (espelhoLigado()) desligarEspelho(); else ligarEspelho();
  });
  mirrorScanEl.addEventListener('click', abrirLeitorQr);
  renderEspelho();
}

newFolderInPickerBtnEl.addEventListener('click', async () => {
  const name = await appPrompt({ title: 'Nova pasta', message: 'Nome da pasta:', okText: 'Criar', placeholder: 'Ex.: Louvores especiais' });
  if (name && name.trim()) { await createFolder(name.trim()); renderFolderPicker(); }
});

// Fechamento dos bottom-sheets: todos se comportam igual — o ✕ fecha e tocar
// no fundo (fora da folha) também. O par de listeners estava copiado seis
// vezes; aqui é uma tabela, e um popup novo entra com uma linha.
// A mesma tabela é a fonte do botão VOLTAR do Android (ver `__avBack`): um
// popup novo entra numa linha e já passa a ser fechável pelos três caminhos
// (✕, toque no fundo, botão do aparelho). Duas listas divergiriam no primeiro
// popup que alguém esquecesse de acrescentar na segunda.
// **Ordenada de BAIXO para CIMA**: o voltar percorre de trás para a frente e
// fecha o primeiro aberto, então o que fica por último é o que está por cima.
// (`collPopup`, as opções da coleção, saiu na v5.72: elas viraram um painel
// DENTRO do card do álbum, e um painel não é uma camada — quem o fecha é o
// mesmo toque na engrenagem que o abriu, ou o toque na barra que fecha o card.)
const POPUPS = [
  [plPopupEl, plPopupCloseEl, closePlPopup],
  // A gaveta de Favoritos vem CEDO na tabela (o voltar percorre de trás para a
  // frente): o seletor de atalhos e o diálogo de confirmação são abertos DE
  // DENTRO dela e precisam fechar primeiro.
  [favPopupEl, favCloseEl, closeFavorites],
  [hymnSearchPopupEl, hymnSearchCloseEl, closeHymnSearch],
  [bibleVerPopupEl, bibleVerCloseEl, closeBibleVerPopup],
  [fadePopupEl, fadePopupCloseEl, closeFadePopup],
  // A folha do espelho abre DE DENTRO de Configurações, então vem depois dela:
  // o voltar percorre esta tabela de trás para a frente e precisa fechar a de
  // cima primeiro. Uma linha aqui já a liga aos três caminhos de fechamento
  // (✕, toque no fundo, botão do aparelho) — é para isso que a tabela existe.
  [mirrorPopupEl, mirrorCloseEl, closeMirror],
  // E o leitor de QR abre de dentro da folha do espelho, então vem DEPOIS dela.
  // Aqui a linha vale mais que nos outros: fechar este popup é DESLIGAR A
  // CÂMERA, e é esta tabela que garante que os três caminhos façam isso.
  [qrPopupEl, qrCloseEl, fecharLeitorQr],
  [lyricsPopupEl, lyricsPopupCloseEl, closeLyricsPopup],
  // A folha da música abre DE DENTRO do acervo, e o seletor de atalhos abre de
  // dentro dela: o voltar percorre esta tabela de trás para a frente, então a
  // ordem aqui é a ordem em que as camadas se empilham.
  [songMenuPopupEl, songMenuCloseEl, closeSongMenu],
  [folderPopupEl, folderPopupCloseEl, closeFolderPicker],
];
POPUPS.forEach(([backdrop, closeBtn, close]) => {
  closeBtn.addEventListener('click', close);
  // Só o próprio backdrop: um clique dentro da folha não fecha.
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
});

// ===== Botão VOLTAR do aparelho (`__avBack`) =====
// Até a v5.32 o voltar só mandava a tarefa para segundo plano — sair por engano
// no meio de um culto derrubaria a projeção, e essa continua sendo a regra no
// fim da fila. O que faltava era a fila: com um popup aberto, uma pasta aberta
// ou a preview em tela cheia, o gesto que TODO usuário de Android conhece para
// "fechar isto" minimizava o app inteiro.
//
// Devolve `true` se consumiu o toque; `false` faz a Activity minimizar (ver
// MainActivity.onBackPressedDispatcher). A ordem é do mais efêmero ao mais
// permanente — é a ordem em que as coisas foram abertas, e portanto a ordem em
// que se espera desfazê-las.
//
// Vive só no app: no navegador não há botão voltar do sistema, e a base precisa
// continuar rodando lá (por isso nada aqui depende de `history`).
window.__avBack = function () {
  // 1. Diálogo modal (confirmar/renomear): cancela, como o botão Cancelar.
  if (appDialogEl.classList.contains('open')) {
    closeAppDialog(appDialogInputEl.hidden ? false : null);
    return true;
  }
  // 1.5. A hierarquia DE DENTRO da gaveta de Favoritos vem antes da própria
  //    gaveta — como já vale para as telas da Bíblia (passo 6). Primeiro a
  //    seleção múltipla, depois a pasta aberta: a seleção é do conteúdo da
  //    pasta, então sair da pasta com ela de pé deixaria itens marcados numa
  //    lista que não é mais a deles. (O passo 5, genérico, continua valendo
  //    para a seleção feita na lista de baixo, sem gaveta nenhuma aberta.)
  if (favPopupEl.classList.contains('open')) {
    if (selectionMode) { exitSelection(); return true; }
    if (currentFolder) { navigateBack(); return true; }
  }
  // 2. Bottom-sheets. Fecha o ÚLTIMO da tabela que estiver aberto — normalmente
  //    há um só, mas se houver dois o de cima é o que o operador vê.
  for (let i = POPUPS.length - 1; i >= 0; i--) {
    const [backdrop, , close] = POPUPS[i];
    if (backdrop.classList.contains('open')) { close(); return true; }
  }
  // 3. Preview em tela cheia — que, sem telão conectado, É a projeção. Sair
  //    dela é exatamente o que o voltar significa aqui.
  if (document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (_) {}
    return true;
  }
  // 4. Coluna do mixer aberta no fader.
  if (mixerEl.classList.contains('vol-open')) { closeVolume(); return true; }
  // 5. Seleção múltipla: o voltar cancela a seleção, não o app.
  if (selectionMode) { exitSelection(); return true; }
  // 6. Sub-tela com voltar próprio (pasta aberta, Favoritos, telas da Bíblia).
  //    Reusa `navigateBack` em vez de reimplementar a hierarquia: ela já sabe
  //    que a Bíblia sobe leitura→capítulos→livros e que a raiz dos Favoritos
  //    volta ao Cronograma.
  if (!backBtnEl.hidden) { navigateBack(); return true; }
  // 7. Fora do Cronograma: volta para ele. É a tela inicial da biblioteca, e
  //    sem este degrau o voltar pularia de "estou na Bíblia" direto para
  //    minimizar o app.
  if (activeTab !== 'imports') { switchTab('imports'); return true; }
  // Nada aberto: a Activity minimiza (a projeção segue viva).
  return false;
};

seekEl.addEventListener('pointerdown', () => { seeking = true; });
seekEl.addEventListener('pointerup', () => { seeking = false; });

// Telão reconectado (`display-ready`): o Display sempre abre no wallpaper e
// espera um comando — quem sabe o que estava em cena é o Controle. Reenvia a
// CENA INTEIRA, não só "mídia tocando": um versículo projetado durante a
// pregação ou uma imagem de aviso estática não têm `playing` e sumiam do telão
// para sempre depois de um blip do dongle, sem nenhum sinal no Controle (que
// seguia mostrando "● No ar").
//
// Ordem importa: a mídia primeiro, o texto depois. No Display um `load` visual
// encerra a Camada de Texto e um `load` de áudio a mantém — mandar o texto por
// último faz as duas combinações caírem no estado certo.
//
// `para` é o ENDEREÇO de quem pediu, e ele existe porque o barramento é um
// broadcast: até a v5.139 esta função era chamada sem destinatário e reenviava
// a cena para TODO MUNDO. Com um telão de verdade no ar, qualquer segunda
// instância de `/display/` que abrisse, recarregasse ou fosse restaurada pelo
// navegador fazia a TV rodar um `load` inteiro — fade de saída, releitura da
// mídia, re-seek, fade de entrada — na frente da congregação, por um evento
// que não tinha nada a ver com ela. Endereçado, o reenvio vai só para quem se
// anunciou. `undefined` (telão antigo, sem `__de`) mantém o broadcast de
// sempre: um bundle velho no telão continua reconectando igual.
function resendSceneToDisplay(para) {
  const enviar = (cmd) => AVDB.sendCommand(para ? Object.assign({ __para: para }, cmd) : cmd);
  // O GIRO VIAJA PRIMEIRO, antes do `load` (v5.142). Ele é preferência de
  // exibição, não conteúdo: o telão o lê do estado no arranque, mas entre o
  // `display-ready` e essa leitura há uma janela — e um telão que reconecta no
  // meio de um vídeo girado não pode mostrá-lo deitado nem por um quadro. Antes
  // do `load` porque `applyMedia` repõe o giro ao revelar a mídia; depois dele
  // seria um giro visível acontecendo na frente da congregação.
  if (mediaRot) enviar({ type: 'rotate', rotate: mediaRot });
  // Reenvia SEMPRE que houver mídia carregada — não só a que está tocando.
  // A condição anterior (`playing || isImage`) deixava de fora justamente o
  // caso mais comum de uma queda de dongle: o louvor de fundo PAUSADO para a
  // oração. Um vídeo pausado mostra o quadro congelado no telão e um áudio
  // pausado mantém a letra sincronizada em cena — nos dois casos há algo
  // projetado, e nos dois casos ele sumia para sempre.
  // `!isCue`: a cena de roteiro em cena é reenviada pelo bloco de TEXTO logo
  // abaixo (é uma sessão, como um versículo escolhido pela aba da Bíblia) — dar
  // `load` no id dela mandaria o telão carregar uma mídia sem bytes e apagaria
  // a projeção justamente na reconexão que este código existe para consertar.
  //
  // `midiaNoAr` (v5.142) É A PERGUNTA CERTA, e `currentId` sozinho era a errada.
  // Ele sobrevive de propósito ao stop e ao fim natural — é o que permite repetir
  // a faixa com o ▶ —, então reenviar por ele fazia o telão ACORDAR TOCANDO algo
  // que o operador tinha parado, ou ressuscitar a música que acabou. Esta função
  // restaura o que ESTAVA no ar; um telão vazio também é um estado, e restaurá-lo
  // é não mandar nada.
  if (midiaNoAr && currentId && !isCue(currentItem)) {
    // E leva a POSIÇÃO. Sem ela o telão recarregava a mídia do ZERO: um hino
    // aos 3:20 recomeçava do início na frente da congregação. Pior, o
    // `display-status` seguinte chegava com `currentTime` 0 e arrastava a
    // preview do Controle de volta junto — o operador perdia até a referência
    // de onde estava.
    // O tempo sai da própria barra de progresso (mesma fonte que
    // `pushNowPlaying` usa): é a única que cobre todos os tipos, inclusive
    // YouTube, onde `preview.getTime()` não sabe de nada.
    const t = !seekEl.disabled ? (parseFloat(seekEl.value) || 0) : 0;
    // A apresentação volta na PÁGINA em que estava, pelo mesmo motivo do
    // tempo: um telão que reconecta no meio da pregação não pode voltar ao
    // primeiro slide na frente de todo mundo.
    enviar({
      type: 'load', mediaId: currentId, view, muted, volume, time: t, playing,
      page: isDeck(currentItem) ? deckPagina : 0,
    });
  }
  // O cronômetro volta pelo DESCRITOR, não por um valor: o telão recalcula o
  // número a partir do mesmo `startAt`, então ele reaparece no segundo certo —
  // não no ponto em que a conexão caiu.
  if (drawProjecting()) {
    // O telão que reconecta no MEIO do rolo entra no mesmo quadro dos demais: o
    // quadro é função de `rollUntil` e do relógio, não de quantos ticks já
    // passaram por ali (ver drawReading).
    enviar({ type: 'text', mode: 'draw', draw: drawDescriptor(), sub: draw.label || '', view });
  } else if (chronoProjecting()) {
    enviar({ type: 'text', mode: 'chrono', chrono: chronoDescriptor(), sub: chrono.label || '', view });
  } else if (bibleSession && bibleSession.projecting) {
    const v = bibleSession.verses[bibleSession.idx];
    if (v) {
      const ref = bibleSession.bookName + ' ' + bibleSession.chapter + ':' + v.n;
      enviar({ type: 'text', mode: 'verse', main: v.text, sub: ref, view });
    }
  } else if (msgProjecting()) {
    const m = messages[msgSession.idx];
    if (m) enviar({ type: 'text', mode: 'message', main: m.text, sub: '', view });
  } else if (lyricProjecting()) {
    enviar({ type: 'text', mode: 'message', main: lyricSession.stanzas[lyricSession.idx], sub: '', view });
  }
}

// O Display (projeção real) é a FONTE DE SINCRONIZAÇÃO enquanto envia status
// — dirige o play/pause, a barra de progresso, a letra sincronizada e o
// avanço, e re-alinha a preview a ele. Se ele não existir/estiver
// estrangulado ou fechado (nenhum status recente → displayActive() falso), a
// PREVIEW local assume (previewTick/ytPreviewTick+onYtPreviewState). Isso
// cobre os dois casos: Controle em primeiro plano com Display em segundo
// (preview manda) e Controle minimizado com o Display tocando (Display
// manda, e a preview se re-alinha a ele ao voltar). Vale tanto para YouTube
// quanto para mídia comum (áudio/vídeo do stage.js) — dois decodificadores
// independentes (Display e preview) divergem aos poucos sem essa correção
// periódica, e a letra sincronizada acaba trocando de slide em momentos
// diferentes nos dois lados.
AVDB.onCommand((msg) => {
  if (!msg) return;
  // Reenvia SÓ para quem se anunciou (ver `resendSceneToDisplay`). Um telão
  // com bundle antigo não manda `__de`, e aí o reenvio volta a ser broadcast —
  // exatamente o comportamento de antes desta versão.
  if (msg.type === 'display-ready') { resendSceneToDisplay(msg.__de); return; }
  if (msg.type === 'diag-dump') {
    juntarDiag(Array.isArray(msg.linhas) ? msg.linhas : []);
    return;
  }
  // Áudio bloqueado no Display (política de autoplay): avisa o OPERADOR —
  // nada é exibido no telão; a recuperação automática roda no Display e o
  // botão de mudo do mixer vira indicador/atalho para liberar.
  if (msg.type === 'display-status' && typeof msg.audioBlocked === 'boolean'
      && msg.audioBlocked !== displayAudioBlocked) {
    displayAudioBlocked = msg.audioBlocked;
    flash(displayAudioBlocked
      ? 'Display sem áudio (navegador) — recuperando automaticamente…'
      : 'Áudio do Display ativo');
    renderControls();
  }
  // Microfone: camada de áudio independente da mídia — precisa ser tratado
  // ANTES do filtro por `mediaId` abaixo, que descarta tudo que não é sobre o
  // item em exibição.
  if (msg.type === 'mic-status') {
    micOn = !!msg.on;
    micError = msg.error || '';
    if (activeTab === 'mic') renderMicUI();
    return;
  }
  if (!currentItem || msg.mediaId !== currentId) return;
  const isYoutube = currentItem.kind === 'youtube';
  const isTimedLocal = currentItem.kind === 'audio' || currentItem.kind === 'video';
  if (!isYoutube && !isTimedLocal) return; // imagem/etc: sem noção de tempo, nada a sincronizar
  if (msg.type === 'display-status') {
    // Player morto/parado (fim natural ou stop manual): ignora qualquer
    // display-status ainda em trânsito reportando o player antigo tocando —
    // senão o ícone voltaria a "pause" e o ▶ (que deve recarregar) quebraria.
    if (isYoutube && ytEnded) return;
    displayStatusAt = Date.now();
    lastDisplayTime = msg.currentTime || 0;
    setPlaying(!!msg.playing);
    const dur = (typeof msg.duration === 'number' && isFinite(msg.duration)) ? msg.duration : 0;
    seekEl.disabled = !(dur > 0);
    durTimeEl.textContent = fmtTime(dur);
    if (!seeking) {
      seekEl.max = dur > 0 ? dur : 0;
      seekEl.value = msg.currentTime || 0;
      curTimeEl.textContent = fmtTime(msg.currentTime);
    }
    if (isYoutube) {
      renderSimpleTime();   // idem: o ramo do YouTube não chama renderSlideNav
      ytResyncPreviewToDisplay(playing, msg.currentTime);
    } else {
      updatePvLyricSlide(lastDisplayTime);
      renderSlideNav();
      resyncPreviewToDisplay(playing, msg.currentTime);
    }
  } else if (msg.type === 'media-ended') {
    // A GUARDA DE mediaId que o comentário da preview (`onEnded`) sempre
    // prometeu: o Display manda o id do que TERMINOU (stage e YouTube — ver
    // display.js), e um `media-ended` atrasado do item anterior, chegando
    // depois de um load novo, dispararia `autoAdvance` por cima do item que o
    // operador acabou de escolher — pulando uma faixa. Sem id dos dois lados
    // não há o que comparar e vale o comportamento de sempre.
    if (msg.mediaId && currentId && msg.mediaId !== currentId) return;
    displayStatusAt = Date.now();
    if (isYoutube) ytEnded = true;
    setPlaying(false);
    // Mesmo tratamento do onEnded local (o Display pode chegar ao fim primeiro):
    // a letra esmaece e trava, para o slide de capa não piscar no replay.
    pvLyricsEnded = true;
    if (pvLyrics) pvLayerOut(pvLyricsEl);
    autoAdvance();
  }
});

// O service worker SAIU (v5.48). Este bloco registrava `sw.js` e recarregava a
// página quando um SW novo assumisse — mas `sw.js` não existe no bundle desde
// que os andaimes de PWA foram removidos: o `register` devolvia 404 em toda
// abertura no navegador, `swReg` ficava eternamente null e o ramo de "checar
// atualização ao retomar" nunca executava. Era código morto que ainda por cima
// sujava o console justamente no ambiente onde a base é desenvolvida.
// No app nativo ele já era desligado de propósito (os assets vêm do APK e a
// atualização é o OTA do `WebUpdater`), então nada se perde nos dois contextos.

// Um ÚNICO handler ao retomar do 2º plano: atualiza os índices leves das
// coleções (índices dos hinários + catálogo de álbuns — só metadados, sem
// áudio — barato pra rodar a cada retomada, mantém a busca e os cards em
// dia). (A metade que "buscava a versão nova do service worker" saiu junto
// com o SW, v5.48 — ver o bloco acima.)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    // App em segundo plano: o botão de falar não está mais sob o dedo, então
    // o microfone não pode continuar aberto. Push-to-talk que sobrevive ao
    // app sair da frente vira um microfone esquecido ligado.
    if (micPressed || micOn) sendMic(false);
    // E a CÂMERA do leitor de QR, pelo mesmo motivo e com mais razão: ela é
    // visível de fora (o LED, o indicador do sistema) e o operador acabou de
    // sair da tela que a explicava.
    fecharLeitorQr();
    return;
  }
  autoRefreshCollections();
  // A tela pode ter caído (ou voltado) com o app minimizado — e é exatamente aí
  // que este WebView está estrangulado e pode perder o aviso do shell. Reler a
  // lista ao voltar para a frente é o piso que impede o ícone de cast de ficar
  // aceso sobre uma TV que não está mais lá (v5.142).
  reconferirTelas();
});

(async function init() {
  await loadCollections();
  await desnumerarAlbunsBaixados();
  // ANTES do load(): é ele que lê `current` e monta a tela a partir dela.
  await clearCurrentSelection();
  await load();
  // A SEGUNDA METADE do modo lembrado. A classe do `<body>` já foi escrita no
  // topo do arquivo (antes do primeiro quadro); falta o que depende do módulo
  // pronto: o segmento das Configurações, os renders do simplificado e — no
  // avançado — o vazado da faixa de abas, que só pode ser POSICIONADO agora,
  // porque medir a faixa antes de `load()` a desenhar daria zero.
  setAppMode(appMode);
  // Wallpaper escolhido pelo operador (a preview espelha o telão).
  await applyPvWallpaper();
  // registra a chegada de compartilhamentos (intent nativo; no navegador é no-op)
  registrarShareNativo();
  // Índices das coleções em segundo plano (fire-and-forget): não atrasa a
  // abertura do app, só deixa a busca/os cards prontos assim que a resposta chegar.
  autoRefreshCollections();
  // Metadados da Bíblia (versões + livros) em segundo plano — baixados na 1ª
  // vez e cacheados; deixa a aba Bíblia pronta pra baixar capítulos.
  ensureBibleMeta(false);
  // A FAXINA DOS RESTOS, por último e sem segurar nada (v5.131). Ver
  // `AVDB.gcOrfaos`: registros que nenhuma lista aponta e que nenhum caminho
  // normal alcançava — o `listSet` os criava a cada troca de playlist. Aqui é
  // o único momento seguro por construção: `load()` já leu tudo o que a tela
  // mostra, e o que a varredura apaga é, por definição, o que ninguém aponta.
  varrerRestos();
  // O DOWNLOAD QUE FICOU SEM DONO, reclamado. Depois do `load()` porque ele
  // acrescenta itens às listas, e antes de qualquer coisa demorada: se o shell
  // ainda tiver o arquivo guardado, o item aparece em segundos.
  resgatarDownloads();
  // O AVISO DE ATUALIZAÇÃO. A primeira consulta é adiada porque o download do
  // shell começa junto com a abertura (`checkAsync` no `onCreate`) e leva
  // alguns segundos — perguntar agora seria perguntar antes de haver resposta.
  // Depois é de minuto em minuto, e cada consulta custa a leitura de um JSON
  // minúsculo: quem decide se há o que mostrar é `ofertarAtualizacao`.
  setTimeout(ofertarAtualizacao, 20000);
  setInterval(ofertarAtualizacao, OTA_POLL_MS);
})();

// ---------------------------------------------------------------------------
// O AVISO DE ATUALIZAÇÃO (v5.132 · shell 29)
//
// Até aqui o OTA era invisível por completo: o bundle novo chegava calado e
// entrava na abertura seguinte. Quem quisesse a correção do dia tinha de saber,
// por fora, que precisava fechar e reabrir o app — e a correção mais urgente é
// justamente a que ninguém quer esperar.
//
// Três regras, e as três protegem o culto:
//
// 1. **Não oferece com cena no ar.** Aplicar recarrega os DOIS WebViews, e o
//    telão pisca. A garantia 1 do OTA ("nunca troca a base no meio de uma
//    sessão") existe contra a troca ACIDENTAL; oferecer no meio de uma
//    projeção seria transformá-la num acidente com convite. Sem cena, a mesma
//    troca é só uma escolha — e a pergunta espera o telão esvaziar.
// 2. **Recusar é definitivo nesta sessão.** Um aviso que volta a cada minuto
//    vira ruído, e ruído no meio de um culto é pior que a versão antiga.
// 3. **A pergunta diz que dá para não fazer nada.** A atualização entra sozinha
//    na próxima abertura de qualquer jeito; oferecer "agora" sem dizer isso
//    faria parecer que recusar significa ficar para trás.
// ---------------------------------------------------------------------------
const OTA_POLL_MS = 60000;
const otaRecusadas = new Set();
let otaPerguntando = false;
// O último diagnóstico da procura, lido do shell (shell 31+). Guardado aqui
// porque o Registro é montado de forma síncrona e a ponte é assíncrona.
let otaDiagTexto = '';
// A versão que está esperando, para o Registro poder dizê-la mesmo quando a
// pergunta não pode aparecer (cena no ar, download em curso, já recusada).
let otaPendenteVersao = '';

// Há algo projetado agora? MESMA leitura de `pushNowPlaying` — se ela mudar de
// ideia sobre o que é "cena", esta pergunta muda junto.
function cenaNoAr() {
  return !!currentId
    || !!(msgSession && msgSession.projecting)
    || !!(bibleSession && bibleSession.projecting)
    || lyricProjecting()
    || chronoProjecting()
    || drawProjecting();
}

// Momento ruim para recarregar as duas páginas: além da cena no ar, um download
// em curso morre com o documento — os `fetch` são desta página, e o arquivo que
// o shell terminar de baixar não teria mais quem o recebesse.
//
// E o ESPELHO NO AR é o terceiro caso (v5.141). Aplicar um bundle recarrega o
// Controle e o telão — e o espelho, que é uma TERCEIRA página, ficaria servindo
// o bundle ANTIGO, de um diretório que o `beginSession()` seguinte vai apagar.
// Aqui as telas da rede são o que alguém está de fato assistindo: sem TV
// conectada, elas são a projeção.
function horaRuimParaAtualizar() {
  return cenaNoAr() || bgWorkCount > 0 || espelhoLigado();
}

// O SHELL EMPURRA quando o bundle fica pronto (shell 31+): o aviso aparece no
// segundo em que a atualização chega, em vez de esperar até um minuto pela
// enquete. A enquete continua — ela é o piso, e cobre o caso de a página ter
// carregado depois de o bundle já estar no disco.
window.__avOta = function (versao) {
  if (versao) otaPendenteVersao = String(versao);
  ofertarAtualizacao();
};

async function ofertarAtualizacao() {
  if (!window.__NATIVE__ || (window.__SHELL_VERSION__ | 0) < 29) return;
  if (otaPerguntando) return;
  // PEDIR AO SHELL QUE PROCURE, e não só perguntar o que ele já tem (v5.136).
  // Antes desta linha a enquete lia um valor que ninguém atualizava: o shell
  // procurava UMA vez, no `onCreate`. Do shell 31 em diante ele procura sozinho
  // (ronda, retomada, rede voltando), e este cutucão é a terceira rede. Sem
  // `forcar`: o piso do shell é que decide se vale uma requisição, senão uma
  // enquete de um minuto viraria uma consulta à rede por minuto, para sempre.
  // Guarda própria (>= 31, e não o >= 29 do bloco): `otaCheck` só existe no
  // shell 31 — nos shells 29-30 a chamada lançava e era engolida a cada
  // minuto; o resto do fluxo (otaPending/otaApply, shell 29) continua valendo.
  if ((window.__SHELL_VERSION__ | 0) >= 31) {
    try { AVNative.otaCheck(false); } catch (_) { /* rede/ponte */ }
  }
  let versao = '';
  try { versao = (await AVNative.otaPending()) || ''; } catch (_) { return; }
  otaPendenteVersao = versao;
  if (!versao || otaRecusadas.has(versao)) return;
  // Só quando há de fato o que aplicar, e só se acharmos que o espelho está no
  // ar: a leitura pode estar velha (ele sai sozinho por falha nomeada), e uma
  // pergunta suprimida por um estado que não existe mais seria pior que a
  // pergunta. Não custa nada no caso comum — sem espelho, nem chega aqui.
  if (espelhoLigado()) await lerEspelho();
  // Depois da ida à ponte, e não antes: assim o Registro fica sabendo da versão
  // pendente mesmo nas horas em que a pergunta não pode aparecer.
  if (horaRuimParaAtualizar()) return;
  otaPerguntando = true;
  let ok = false;
  try {
    ok = await appConfirm({
      title: 'Atualização disponível',
      message: 'A versão ' + versao + ' do app já foi baixada.\n\n'
        + 'Ela entra sozinha na próxima vez que o app abrir. Atualizar agora?\n\n'
        + 'A tela vai recarregar — leva um instante.',
      okText: 'Atualizar agora',
      cancelText: 'Depois',
    });
  } finally {
    otaPerguntando = false;
  }
  if (!ok) { otaRecusadas.add(versao); return; }
  // Daqui não se volta: o documento é substituído pela recarga. Só quando NÃO
  // houver o que aplicar a promise devolve null e a página segue viva.
  const aplicada = await AVNative.otaApply();
  if (!aplicada) otaRecusadas.add(versao);
}

// Quantos restos a última faxina removeu — o Registro mostra, porque uma
// limpeza silenciosa que apaga mídia é exatamente o tipo de coisa que precisa
// deixar rastro.
let restosVarridos = null;
async function varrerRestos() {
  try {
    const n = await AVDB.gcOrfaos();
    restosVarridos = n;
    if (n) console.info('[limpeza] ' + n + ' registro(s) sem dono removido(s)');
  } catch (e) {
    restosVarridos = null;
    console.warn('[limpeza] falhou:', e);
  }
}
