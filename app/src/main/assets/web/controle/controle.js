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
const simpleCastBtnEl = document.getElementById('simpleCastBtn');
const simpleCastLabelEl = document.getElementById('simpleCastLabel');
const simpleCastStatusEl = document.getElementById('simpleCastStatus');
const simpleSearchBtnEl = document.getElementById('simpleSearchBtn');
const simpleVeilEl = document.getElementById('simpleVeil');
const simpleNpNameEl = document.getElementById('simpleNpName');
const simplePlayEl = document.getElementById('simplePlay');
const simpleMuteEl = document.getElementById('simpleMute');
const simpleLyricsEl = document.getElementById('simpleLyrics');
const simpleTimeEl = document.getElementById('simpleTime');
const simpleTimeCurEl = document.getElementById('simpleTimeCur');
const simpleTimeDurEl = document.getElementById('simpleTimeDur');
const simpleTimeFillEl = document.getElementById('simpleTimeFill');
const simpleVolWrapEl = document.getElementById('simpleVolWrap');
const simpleVolUpEl = document.getElementById('simpleVolUp');
const simpleVolDownEl = document.getElementById('simpleVolDown');
const simpleVolValueEl = document.getElementById('simpleVolValue');
const mixerEl = document.getElementById('mixer');
const volToggleEl = document.getElementById('volToggle');
const volCloseEl = document.getElementById('volClose');
const standaloneToggleEl = document.getElementById('standaloneToggle');
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

const fileEl = document.getElementById('file');
const tabsEl = document.querySelector('.tabs');
const libraryEl = document.getElementById('library');
const listTitleEl = document.getElementById('listTitle');
const appVersionEl = document.getElementById('appVersion');

// ===== Índices de versão (base web × shell nativo) =====
// Os dois atualizam por caminhos INDEPENDENTES — a base web chega por OTA
// (bundle publicado em `web-latest`, aplicado no lançamento seguinte) e o
// shell só muda instalando um APK novo. Por isso são exibidos à parte: ver
// "Web v4.87" com "Shell v1.5" diz na hora que o OTA chegou mas o APK não
// (ou o contrário). Manter WEB_VERSION igual a `version` em version.json —
// é ela que dispara (ou não) a atualização nos aparelhos.
const WEB_VERSION = '5.44';

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

const selbarEl = document.getElementById('selbar');
const selCountEl = document.getElementById('selCount');
const selCancelEl = document.getElementById('selCancel');
const selFolderEl = document.getElementById('selFolder');
const selRenameEl = document.getElementById('selRename');
const selDeleteEl = document.getElementById('selDelete');

const backBtnEl = document.getElementById('backBtn');
const addDirBtnEl = document.getElementById('addDirBtn');
const libSearchEl = document.getElementById('libSearch');
const fadePopupEl = document.getElementById('fadePopup');
const fadePopupCloseEl = document.getElementById('fadePopupClose');
const fitSegEl = document.getElementById('fitSeg');
const lyricsBgSegEl = document.getElementById('lyricsBgSeg');
const wallFileEl = document.getElementById('wallFile');
const wallPickEl = document.getElementById('wallPick');
const wallResetEl = document.getElementById('wallReset');
const folderPopupEl = document.getElementById('folderPopup');
const folderPickerListEl = document.getElementById('folderPickerList');
const folderPopupCloseEl = document.getElementById('folderPopupClose');
const newFolderInPickerBtnEl = document.getElementById('newFolderInPickerBtn');

const hymnSearchBtnEl = document.getElementById('hymnSearchBtn');
const hymnSearchPopupEl = document.getElementById('hymnSearchPopup');
const hymnSearchCloseEl = document.getElementById('hymnSearchClose');
const hymnSearchBackEl = document.getElementById('hymnSearchBack');
const hymnSearchInputEl = document.getElementById('hymnSearchInput');
const hymnResultsEl = document.getElementById('hymnResults');
const collPopupEl = document.getElementById('collPopup');
const collPopupTitleEl = document.getElementById('collPopupTitle');
const collOptsEl = document.getElementById('collOpts');
const collPopupCloseEl = document.getElementById('collPopupClose');
const hymnSearchCountEl = document.getElementById('hymnSearchCount');
const hymnSearchTitleEl = document.getElementById('hymnSearchTitle');
const bibleVerPopupEl = document.getElementById('bibleVerPopup');
const bibleVerListEl = document.getElementById('bibleVerList');
const bibleVerCloseEl = document.getElementById('bibleVerClose');
// Escopo da busca/lista: null = busca global no acervo (botão de lupa);
// coll.id = lista de músicas de UMA coleção (toque no card do álbum).
let searchScope = null;

const ICON = {
  prev: '', // skip_previous
  play: '', // play_arrow
  pause: '', // pause
  stop: '', // stop
  next: '', // skip_next
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
  edit: '', // edit
  close: '', // close
  plAdd: '', // playlist_add
  plRemove: '', // playlist_remove
  queue: '', // queue_music
  folder: '',    // folder
  // Favoritos: os atalhos são marcados com estrela, não com pasta — a seção
  // deixou de ser "onde os arquivos ficam" e passou a ser "o que eu marquei".
  star: '',      // star
  folderNew: '', // create_new_folder
  back: '',      // arrow_back
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
let thumbUrls = [];
let currentFolder = null; // null | {id, name, _opfs?} — pasta aberta (persiste entre trocas de aba)
let folders = [];          // [{id, name}, ...] — pastas virtuais
let folderCounts = {};     // {folderId: count}
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
// Filtro da aba Álbuns: null = tudo, 'hymnals' = só os hinários, ou um
// `id_category` do banco. Estado de UI da sessão — não persistido: cada
// abertura do app começa mostrando o acervo inteiro.
let albumFilter = null;

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
let bibleMetaLoaded = false;     // já tentou carregar versões/livros nesta sessão?
let bibleSel = { bookIdx: -1, chapter: 0 }; // seleção em andamento
let bibleChapterData = null;     // { verses:[{n,text}] } do capítulo aberto na tela de versículos
let bibleChapterLoading = false; // baixando o capítulo agora?
let bibleChapterError = '';      // mensagem de falha (sem rede etc.)
let bibleLoadSeq = 0;            // descarta downloads de capítulo obsoletos (troca rápida)
// Sessão de leitura ativa (texto projetado): { versionId, bookIdx, bookId,
// bookName, chapter, verses, idx }. null = nenhum texto bíblico em cena.
let bibleSession = null;
// Download da versão INTEIRA (todos os capítulos) — progresso em memória:
// { versionId, total, done, running }. null = nenhum download em andamento.
let bibleDl = null;
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
  if (!AVDB.opfsSupported()) { setGroupStatus(key, 'Armazenamento OPFS indisponível', 5000); return; }

  // "Todo o acervo" confirma SEMPRE, mesmo no Wi-Fi: são milhares de músicas e
  // vários GB no aparelho. A pergunta de rede (abaixo) é sobre o plano de
  // dados; esta é sobre a escala, e as duas são perguntas diferentes.
  if (opts && opts.confirmScale) {
    let songs = 0, est = 0;
    for (const c of colls) {
      const pend = collSongs(c.id).filter((x) => !x.fileIdFull).length;
      songs += pend;
      est += estimatePendingBytes(c, pend);
    }
    if (songs === 0) { setGroupStatus(key, 'Acervo já completo offline', 5000); return; }
    const ok = await appConfirm({
      title: 'Baixar todo o acervo?',
      // O tamanho sai do peso REAL do que já está no disco (mesma base do
      // álbum avulso). Sem nada baixado ainda não há de onde estimar, e a
      // frase omite o número em vez de inventar um.
      message: 'São ' + colls.length + ' coleções, com ' + songs
        + ' música(s) ainda não baixada(s)'
        + (est ? ', aproximadamente ' + fmtBytes(est) : '') + '.'
        + '\n\nO download continua com o app minimizado, mostra o progresso na notificação '
        + 'e pode ser cancelado a qualquer momento.',
      okText: 'Baixar tudo', cancelText: 'Agora não',
    });
    if (!ok) return;
  }

  let allowMobile = true;
  if (!isConfirmedWifi()) {
    // Estimativa do lote a partir do que JÁ está no disco (mesma base do
    // álbum avulso) — sem nada baixado ainda não há de onde tirar, e o
    // diálogo omite o tamanho em vez de inventar um.
    let est = 0;
    for (const coll of colls) {
      const pend = collSongs(coll.id).filter((x) => !x.fileIdFull).length;
      est += estimatePendingBytes(coll, pend);
    }
    allowMobile = await appConfirm({
      title: 'Baixar usando dados móveis?',
      message: 'Você não está numa rede Wi-Fi confirmada. Baixar "' + label + '" são '
        + colls.length + ' álbum(ns)' + (est ? ', aproximadamente ' + fmtBytes(est) : '')
        + '.\n\nEsta escolha vale só para este download, agora.',
      okText: 'Usar dados móveis', cancelText: 'Só no Wi-Fi',
    });
    if (!allowMobile) { setGroupStatus(key, 'Adiado para o Wi-Fi', 5000); return; }
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
    for (const coll of colls) totalPend += collSongs(coll.id).filter((x) => !x.fileIdFull).length;
    let batchDone = 0;
    const notifId = bgTaskStart(label, Math.max(1, totalPend));
    try {
      await withBgWork(async () => {
        for (let i = 0; i < colls.length; i++) {
          if (g.cancel) break;
          const coll = colls[i];
          setGroupStatus(key, 'Álbum ' + (i + 1) + '/' + colls.length + ' · ' + coll.name);
          bgTaskStep(notifId, batchDone, label + ' · ' + coll.name);
          await syncCollection(coll, {
            allowMobile: true,
            notifOwned: true,                     // a tarefa da notificação é do lote
            notifTaskId: notifId,                 // …e é nela que os nomes entram
            cancelled: () => g.cancel,            // o cancelamento atravessa o álbum
            onSong: () => bgTaskStep(notifId, ++batchDone),
          });
        }
      });
    } finally { bgTaskEnd(notifId); }
    setGroupStatus(key, g.cancel ? 'Cancelado' : 'Coleção completa', 5000);
  } catch (_) {
    setGroupStatus(key, 'Erro ao baixar a coleção', 6000);
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
// Peso (bytes) dos arquivos já baixados de uma coleção — somatório dos `size`
// do catálogo OPFS da pasta da coleção.
//
// NÃO chamar durante um render de lista: `filesByFolder` é um `getAll` da index
// que desserializa TODOS os registros da pasta (com thumbnail e letra) só para
// somar um campo — e a aba Álbuns tem dezenas a centenas de cards. Somado ao
// re-render por música baixada, virava N getAll do catálogo por download.
// O valor é mantido incrementalmente em `downloadCollectionFile` e recalculado
// só onde é barato e necessário: ao ABRIR o popup de opções e depois de apagar
// arquivos (exclusão de coleção/registros), onde a conta muda em bloco.
async function updateCollBytes(id) {
  try {
    const recs = await AVDB.filesByFolder(id);
    const total = recs.reduce((sum, r) => sum + (r.size || 0), 0);
    const u = ui(id);
    if (total !== u.bytes) { u.bytes = total; refreshCollectionsIfVisible(); }
  } catch (_) { /* sem catálogo ainda — peso fica 0 */ }
}
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
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
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
let displayAudioBlocked = false; // Display reportou áudio bloqueado pelo navegador
const scrollPos = {};      // posição de scroll por aba/pasta (sessão)

// ===== preview (espelho do display) =====
// Mostra exatamente o que o display mostra; sempre mudo. Recebe os MESMOS
// comandos enviados ao display e ainda comanda a barra de progresso/avanço.
const preview = createStage({
  wallpaper: pvWallEl, img: pvImgEl, video: pvVideoEl, forceMuted: true,
  onTime: previewTick,
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

// Pede a menor qualidade disponível: a preview já é minúscula (~130px de
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

async function loadYtPreview(rec, v) {
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
  standaloneToggleEl.classList.toggle('active', standalone);
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
  if ((bibleSession || msgSession) && !preview.getCurrent()) return;
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
function thumbFromVideo(file) {
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
async function makeThumb(file, kind) {
  if (kind !== 'image' && kind !== 'video') return null;
  return kind === 'image' ? thumbFromImage(file) : thumbFromVideo(file);
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
  const messagesV = (await AVDB.getState('messages')) || [];
  const chronoPrefsV = (await AVDB.getState('chronoPrefs')) || null;
  const drawPrefsV = (await AVDB.getState('drawPrefs')) || null;
  const storedFit = await AVDB.getState('fit');
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
  } else if (activeTab === 'imports' || activeTab === 'playlist') {
    // Só as abas que são de fato listas de IDs de mídia. 'bible' e 'messages'
    // NÃO são listas de mídia — e 'messages' guarda
    // objetos {id,text} no mesmo state key, então passar isso por listItems
    // (getMedia por id) lançaria DataError e quebraria o load() inteiro.
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
  messages = messagesV;
  applyChronoPrefs(chronoPrefsV);
  applyDrawPrefs(drawPrefsV);
  if (storedFit) mediaFit = storedFit;
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

  // restaura a posição de scroll da aba/pasta atual
  libraryEl.scrollTop = scrollPos[scrollKey()] || 0;
}

// chave de posição de scroll: aba (+ pasta aberta, se houver)
function scrollKey() {
  return activeTab + (currentFolder ? '/' + currentFolder.id : '');
}
function rememberScroll() {
  scrollPos[scrollKey()] = libraryEl.scrollTop;
}

// CONVENÇÃO: o ícone mostra a AÇÃO que o toque executa, nunca o estado atual.
// O estado fica por conta da COR/BORDA (`.view-blocked`, `.muted`, `.blocked`,
// `.active`), que já existia. Antes os dois papéis estavam misturados — o ▶/⏸
// já era ação, enquanto cortina e mudo eram estado —, então o mesmo botão
// significava coisas opostas dependendo de qual fosse.
//
// Num par binário nada se perde: se o ícone é a ação, o estado é o inverso
// dele, e a cor confirma. (`renderRepeat` é a exceção justificada — ver lá.)
function renderControls() {
  // Mídia no ar → o toque COBRE (imagem riscada); coberto → o toque MOSTRA.
  viewToggleEl.querySelector('.msym').textContent = view === 'visual' ? ICON.imageOff : ICON.image;
  viewToggleEl.classList.toggle('view-blocked', view === 'wallpaper');
  viewToggleEl.title = view === 'visual' ? 'Cobrir o telão' : 'Mostrar a mídia no telão';
  // 3 estados do botão de mudo: normal | mudo (operador) | sem áudio no
  // Display (navegador bloqueou — tocando mudo; clique tenta liberar). Nos dois
  // últimos o toque DEVOLVE o som, então o ícone é o de volume ligado.
  const blocked = displayAudioBlocked && !muted;
  muteToggleEl.querySelector('.msym').textContent = (muted || blocked) ? ICON.volOn : ICON.volOff;
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
    playPauseEl.querySelector('.msym').textContent = ICON.play;
    seekEl.disabled = true;
    renderSimple();
    pushNowPlaying();
    return;
  }
  // Prioriza plItems/libItems (já carregados); usa currentItem como fallback
  // para o caso de o item estar somente em outra aba (ex: dentro de uma pasta).
  const cur = [...plItems, ...libItems].find((m) => m.id === currentId) || currentItem;
  npNameInnerEl.textContent = cur ? cur.name : 'Nada em exibição';
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
  const active = !!currentId
    || !!(msgSession && msgSession.projecting)
    || !!(bibleSession && bibleSession.projecting);
  const subtitle = who === 'bible' ? 'Bíblia'
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
}

function renderListTitle() {
  // Indicador de versão: só ao lado do título da aba Cronograma.
  appVersionEl.hidden = activeTab !== 'imports';
  if (!appVersionEl.hidden) renderVersionLabel();
  if (activeTab === 'mic') {
    backBtnEl.hidden = true; addDirBtnEl.hidden = true; libSearchEl.hidden = true; libSearchEl.value = '';
    listTitleEl.hidden = false; listTitleEl.textContent = 'Diversos';
    return;
  }
  if (activeTab === 'bible') {
    backBtnEl.hidden = bibleScreen === 'books';
    addDirBtnEl.hidden = true;
    libSearchEl.hidden = true; libSearchEl.value = '';
    // Sem título na aba Bíblia — libera espaço (a grade/leitura falam por si).
    listTitleEl.hidden = true; listTitleEl.textContent = '';
    return;
  }
  const inFolder = activeTab === 'folders' && currentFolder !== null;
  const inOpfs = inFolder && currentFolder._opfs;
  // Favoritos não tem aba (chega-se a ela pelo botão no fim do Cronograma),
  // então o voltar precisa estar disponível já na raiz — é a única saída de lá.
  backBtnEl.hidden = !(inFolder || activeTab === 'folders');
  addDirBtnEl.hidden = !(activeTab === 'folders' && !inFolder);
  libSearchEl.hidden = !inOpfs;
  libSearchEl.value = inOpfs ? folderQuery : '';
  listTitleEl.hidden = inOpfs;
  const titles = { imports: 'Cronograma', folders: 'Favoritos', albums: 'Álbuns' };
  listTitleEl.textContent = inFolder ? currentFolder.name : (titles[activeTab] || '');
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
    thumbUrls.push(url);
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
    playlistEl.innerHTML = '<li class="empty">Playlist vazia.<br>Deslize um item para a esquerda para adicionar.</li>';
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
  bibleMetaLoaded = true;
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
  for (const v of bibleVersions) {
    if (await AVDB.getState('bibleComplete:' + v.id)) bibleCompleteVersions.add(v.id);
  }
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
  // Reatribuir bibleDl para a nova versão faz workers de um download anterior
  // (de outra versão) pararem sozinhos (checam versionId).
  bibleDl = { versionId, total, done, running: true };
  refreshBibleDl();

  // 1189 capítulos: é o download mais longo do app e o que mais sofria com o
  // congelamento do processo ao minimizar.
  const notifId = bgTaskStart('Bíblia · ' + (bibleVersionName(versionId) || 'versão'), missing.length);
  try {
  await withBgWork(() => runLimited(missing, NET_CONCURRENCY, async (it) => {
    if (!bibleDl || !bibleDl.running || bibleDl.versionId !== versionId) return; // superado/cancelado
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
    if (bibleDl && bibleDl.versionId === versionId) { bibleDl.done = done; refreshBibleDl(); }
  }));
  } finally { bgTaskEnd(notifId); }

  if (bibleDl && bibleDl.versionId === versionId) {
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
  bibleChapterData = { verses };
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
  read.appendChild(foot);
  wrap.appendChild(read);
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
// Encerra QUALQUER texto manual em cena (Bíblia ou Mensagem) — só um por vez.
function clearManualText() {
  clearBibleSession(); clearMsgSession(); clearChronoSession(); clearDrawSession();
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
  refreshDiversos();
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
  if (msgSession && msgSession.idx === i) clearManualText();
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
  if (err === 'NotReadableError') return 'O microfone está em uso por outro app.';
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

// ===== Rodapé da aba Diversos: microfone + projetar =====
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

// ===== Cronômetro / Relógio / Timer (aba Diversos) =====
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
  refreshDiversos();
}

function clearChronoSession() {
  if (!chronoSession) return;
  chronoSession = null;
  renderNowPlaying();
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

  renderChronoReadout();
  startChronoPanelTimer();
}

// ===== Sorteio (aba Diversos) =====
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
  refreshDiversos();
}

function hideDraw() {
  if (!drawProjecting()) return;
  drawSession.projecting = false;
  cmd({ type: 'text-hide' });
  renderControls();
  renderNowPlaying();
  refreshDiversos();
}

function clearDrawSession() {
  if (!drawSession) return;
  drawSession = null;
  renderNowPlaying();
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
  [{ id: 'number', name: 'Número' }, { id: 'texto', name: 'Texto' }].forEach((m) => {
    const id = m.id === 'texto' ? 'text' : 'number';
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

  renderDrawReadout();
  startDrawPanelTimer();
}

// ===== Mensagens na aba Diversos =====
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
      // Tocar PROJETA. Sem popup para fechar agora: a seção fica aberta e a
      // linha ativa marcada, então dá para passar de um aviso a outro sem
      // reabrir nada — que era o atrito do fluxo anterior.
      txt.addEventListener('click', () => projectMessage(i));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'row-btn';
      del.appendChild(msym(ICON.del));
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(m.id); });
      row.append(txt, del);
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

// ===== A aba Diversos =====
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

// Redesenha só a aba Diversos (usado quando o estado de uma ferramenta muda
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
  thumbUrls.forEach((u) => URL.revokeObjectURL(u));
  thumbUrls = [];
  libraryEl.innerHTML = '';
  // Diversos NÃO rola: quem administra a altura ali é o acordeão (a seção
  // aberta ocupa o que sobra e rola por dentro, se precisar). Com a rolagem da
  // lista ligada, a página inteira voltaria a rolar e o microfone sairia da
  // base — que é justamente o que o acordeão veio resolver.
  libraryEl.classList.toggle('lib-misc', activeTab === 'mic');

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

  if (items.length === 0) {
    libraryEl.innerHTML = activeTab === 'folders'
      ? (fq ? '<li class="empty">Nenhum arquivo encontrado.</li>'
        : (currentFolder && currentFolder._opfs
          ? '<li class="empty">Pasta vazia.</li>'
          : '<li class="empty">Atalho vazio.<br>Selecione mídias no Cronograma e use "Adicionar aos favoritos".</li>'))
      : '<li class="empty">Cronograma vazio.</li>';
    appendImportRow();
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    // Bug fix: active highlight only when not in selection mode
    const isActive = !selectionMode && item.id === currentId;
    li.className = 'lib-item' + (isActive ? ' active' : '') + (selected.has(item.id) ? ' selected' : '');
    li.dataset.id = item.id;

    if (activeTab !== 'folders') {
      const bg = document.createElement('div'); bg.className = 'swipe-bg';
      const right = document.createElement('div'); right.className = 'swipe-hint right'; right.appendChild(msym(ICON.plAdd));
      bg.appendChild(right);
      li.appendChild(bg);
    }

    const row = document.createElement('div'); row.className = 'row';

    // A miniatura é o primeiro elemento (flush à esquerda). A seleção múltipla
    // é indicada só pelo highlight azul (.lib-item.selected) — sem ícone de check.
    const thumb = thumbEl(item);

    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = item.name;
    // Badge for URL-based items
    let badge = null;
    if (item.kind === 'youtube') {
      badge = document.createElement('span'); badge.className = 'url-badge yt-badge'; badge.textContent = 'YT';
    } else if (!item.blob && item.url) {
      badge = document.createElement('span'); badge.className = 'url-badge'; badge.textContent = 'URL';
    }
    const handle = document.createElement('button'); handle.className = 'row-handle'; handle.title = 'Arraste para reordenar';
    handle.appendChild(msym(ICON.drag));

    // Arquivo OPFS dentro de pasta: botão para entrar no Cronograma sem cópia
    // (mesmo id nas listas; os bytes continuam só no OPFS).
    let addBtn = null;
    if (activeTab === 'folders' && item.opfsPath) {
      addBtn = document.createElement('button'); addBtn.className = 'row-btn'; addBtn.title = 'Adicionar ao Cronograma';
      addBtn.appendChild(msym(ICON.plAdd));
      addBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const had = await AVDB.listHas('imports', item.id);
        await AVDB.listAdd('imports', item.id);
        flash(had ? 'Já no Cronograma' : 'Adicionado ao Cronograma');
      });
    }

    const parts = [thumb, name];
    if (badge) parts.push(badge);
    if (addBtn) parts.push(addBtn);
    if (activeTab !== 'folders') parts.push(handle);
    row.append(...parts);
    li.appendChild(row);
    attachRowGestures(row, item);
    if (activeTab !== 'folders') attachHandle(handle, item.id, activeTab);
    libraryEl.appendChild(li);
  });

  appendImportRow();
}

// Importar arquivos vive NO FIM DO CRONOGRAMA, não mais numa aba: é uma ação
// sobre esta lista específica, e ficando no lugar onde os arquivos vão cair
// (o fim da lista) a relação fica óbvia. A faixa de abas volta a ser só
// navegação. O `<input type="file">` continua dentro de um <label>, que é o
// que dispensa JS pra abrir o seletor.
function appendImportRow() {
  if (activeTab !== 'imports' || currentFolder || selectionMode) return;
  const li = document.createElement('li');
  li.className = 'import-row';

  const label = document.createElement('label');
  label.className = 'import-btn';
  label.title = 'Importar arquivos';
  label.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>'
    + '<path d="M14 3v5h5"/>'
    + '<line x1="12" y1="12" x2="12" y2="17.6"/>'
    + '<line x1="9.2" y1="14.8" x2="14.8" y2="14.8"/></svg>';
  const txt = document.createElement('span');
  txt.textContent = 'Importar arquivos';
  label.appendChild(txt);
  label.appendChild(fileEl); // o MESMO input de sempre, só reposicionado

  // Favoritos saiu da faixa de abas e virou o par de "Importar": as duas são a
  // mesma pergunta — "de onde vem a mídia?" —, e ficam lado a lado no fim do
  // Cronograma, que é onde o resultado das duas aparece.
  const folders = document.createElement('button');
  folders.type = 'button';
  folders.className = 'import-btn';
  folders.title = 'Favoritos (atalhos e pastas do dispositivo)';
  // Estrela, não pasta: a seção é "o que eu marquei", e a pasta do dispositivo
  // é só uma das origens que moram lá dentro.
  folders.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 3.6l2.6 5.28 5.83.85-4.22 4.11 1 5.81L12 16.9l-5.21 2.75 1-5.81-4.22-4.11 5.83-.85z"/></svg>';
  const ftxt = document.createElement('span');
  ftxt.textContent = 'Favoritos';
  folders.appendChild(ftxt);
  folders.addEventListener('click', () => switchTab('folders'));

  li.append(label, folders);
  libraryEl.appendChild(li);
}

function countDownloaded(id) {
  return collSongs(id).filter((s) => s.fileIdFull).length;
}

// Linha fixa do Hinário Adventista 2022 no topo da lista de coleções — mesmo padrão
// visual das pastas sincronizadas do OPFS, mas a fonte é remota (API do
// LouvorJA), não um `showDirectoryPicker()` do dispositivo. Sempre visível
// (mesmo antes da 1ª sincronização) para o operador saber que a opção existe.
// SVG inline (ícone fora do subset da fonte, mesma convenção do botão de
// volume/mixer): antena de Wi-Fi. `.net-badge--warn` (via CSS) recolore para
// indicar "sem Wi-Fi confirmado" — a sincronização em massa fica desativada
// por padrão nesse estado (ver isConfirmedWifi/syncCollection).
function wifiIconEl() {
  const span = document.createElement('span');
  span.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M2 8.5a17 17 0 0 1 20 0"/><path d="M5.5 12.5a11.5 11.5 0 0 1 13 0"/><path d="M9 16.3a6 6 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none"/>'
    + '</svg>';
  return span.firstElementChild;
}

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
// SVG inline de "lista". Sem uso desde que "Ver músicas" saiu das opções do
// álbum (a lista é o toque no card); mantido por ser um ícone genérico do
// conjunto, útil na próxima lista que aparecer.
function listIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
}
// SVG inline de "engrenagem" — botão de opções do card de coleção (mesmo
// desenho do botão de configurações que flutua sobre a preview).
function gearIconSvg() {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<circle cx="12" cy="12" r="3.2"/>'
    + '<path d="M19.4 14.2a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V20a2 2 0 1 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H4a2 2 0 1 1 0-4h.11a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9.9a1.6 1.6 0 0 0 .97-1.47V4a2 2 0 1 1 4 0v.11a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97H20a2 2 0 1 1 0 4h-.11a1.6 1.6 0 0 0-1.47.97z"/>'
    + '</svg>';
}
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
// Pílulas de filtro no topo: Todos · Hinários · uma por categoria do banco.
// Com dezenas de álbuns em várias categorias, rolar a lista inteira para achar
// "os CDs oficiais" é lento — a pílula corta direto para o grupo.
function renderCollectionFilters(alvo, redesenhar) {
  const li = document.createElement('li');
  li.className = 'coll-filters';
  const add = (label, value) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'coll-pill' + (albumFilter === value ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      if (albumFilter === value) return;
      albumFilter = value;
      redesenhar();
      alvo.scrollTop = 0;
    });
    li.appendChild(b);
  };
  add('Todos', null);
  if (FIXED_COLLECTIONS.length) add('Hinários', 'hymnals');
  for (const cat of albumCatalog.categories) {
    // Categoria sem nenhum card visível não vira pílula (levaria a uma lista
    // vazia) — ex.: uma categoria só de álbuns que são hinários disfarçados.
    if (categoryCards(cat).length) add(cat.name, cat.id_category);
  }
  return li;
}

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

// O MESMO navegador de acervo, em dois lugares: a aba Álbuns e o estado padrão
// da busca (ver renderSearchResults). É uma função só de propósito — duas
// cópias divergiriam no primeiro ajuste de categoria, e o operador veria dois
// acervos diferentes conforme por onde entrou.
function renderCollectionsList(alvo, redesenhar) {
  alvo = alvo || libraryEl;
  redesenhar = redesenhar || renderLibrary;
  const byId = new Map(allCollections().map((c) => [c.id, c]));
  let any = false;

  alvo.appendChild(renderCollectionFilters(alvo, redesenhar));

  // Cabeçalho de grupo: nome + resumo (baixados/total do grupo inteiro) + o
  // botão que baixa a COLEÇÃO COMPLETA. Com um filtro ativo o nome é omitido
  // (a pílula selecionada já diz qual é), mas o cabeçalho continua existindo —
  // ele deixou de ser só um rótulo e passou a ser onde mora a ação.
  const header = (text, colls, showName, opts) => {
    const li = document.createElement('li');
    li.className = 'coll-group';
    if (showName !== false) {
      const name = document.createElement('span');
      name.className = 'coll-group-name';
      name.textContent = text;
      li.appendChild(name);
    }
    if (colls && colls.length) {
      const key = 'grp:' + text;
      const g = gui(key);
      let downloaded = 0, total = 0;
      for (const c of colls) { downloaded += countDownloaded(c.id); total += collSongs(c.id).length; }
      const complete = total > 0 && downloaded >= total;

      const info = document.createElement('span');
      info.className = 'coll-group-count' + (g.busy ? ' busy' : (complete ? ' done' : ''));
      info.textContent = g.status || (total ? downloaded + '/' + total : '—');
      li.appendChild(info);

      const btn = document.createElement('button');
      btn.className = 'coll-group-btn' + (g.busy ? ' busy' : '');
      btn.title = g.busy
        ? 'Cancelar o download'
        : (opts && opts.confirmScale)
          ? 'Baixar TODO o acervo (' + colls.length + ' coleções)'
          : 'Baixar a coleção completa (' + colls.length + ' álbum(ns))';
      btn.innerHTML = g.busy ? closeIconSvg() : downloadAllIconSvg();
      btn.addEventListener('click', (e) => { e.stopPropagation(); syncGroup(key, text, colls, opts); });
      li.appendChild(btn);
    }
    alvo.appendChild(li);
  };

  // Baixar TODO o acervo de uma vez: os hinários mais todos os álbuns de todas
  // as categorias. Só aparece em "Todos" — com um filtro ativo, "tudo" seria
  // ambíguo (tudo do filtro? tudo mesmo?), e o cabeçalho da categoria já cobre
  // o primeiro caso.
  if (albumFilter === null) {
    const todas = allCollections().filter((c) => !isHymnalAlbum(c));
    if (todas.length > 1) header('Todo o acervo', todas, true, { confirmScale: true });
  }

  const showHymnals = albumFilter === null || albumFilter === 'hymnals';
  const fixed = showHymnals ? FIXED_COLLECTIONS.filter((c) => byId.has(c.id)) : [];
  if (fixed.length) {
    header('Hinários', fixed, albumFilter === null);
    fixed.forEach((coll) => { alvo.appendChild(renderCollectionCard(coll)); any = true; });
  }

  for (const cat of albumCatalog.categories) {
    if (albumFilter === 'hymnals') break;
    if (albumFilter !== null && albumFilter !== cat.id_category) continue;
    const cards = categoryCards(cat);
    if (!cards.length) continue;
    header(cat.name, cards.map((x) => x.coll), albumFilter === null);
    cards.forEach(({ coll, ctx }) => { alvo.appendChild(renderCollectionCard(coll, ctx)); any = true; });
  }

  // Álbuns conhecidos que nenhuma categoria reivindicou (catálogo antigo,
  // migrado de uma versão sem categorias, ou álbum removido de todas elas).
  // Só aparecem em "Todos" — não pertencem a categoria nenhuma para filtrar.
  const claimed = new Set();
  if (albumFilter !== null) {
    if (!any) {
      const empty = document.createElement('li'); empty.className = 'empty';
      empty.textContent = 'Nada nesta seção.';
      alvo.appendChild(empty);
    }
    return;
  }
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
  const total = collSongs(coll.id).length;
  const downloaded = countDownloaded(coll.id);
  const complete = total > 0 && downloaded >= total;
  const u = ui(coll.id);

  const li = document.createElement('li');
  li.className = 'hymnal-card';
  // Cor do álbum no banco: uma faixa lateral. É só um traço de identidade
  // visual, e vem de graça no catálogo — nada é baixado por causa dela.
  if (coll.color) li.style.setProperty('--coll-color', coll.color);

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
  const summary = document.createElement('span'); summary.className = 'coll-bar-sync';
  if (u.syncBusy && u.status) {
    summary.classList.add('busy'); summary.textContent = u.status;
  } else if (total > 0) {
    if (complete) summary.classList.add('done');
    summary.textContent = downloaded + '/' + total;
  } else {
    summary.textContent = coll.kind === 'album' ? 'não sincron.' : '—';
  }
  bar.appendChild(summary);

  const cfg = document.createElement('button');
  cfg.className = 'hymnal-card-btn coll-bar-btn cfg-btn' + (u.syncBusy ? ' busy' : '');
  cfg.title = 'Opções de sincronização';
  cfg.innerHTML = gearIconSvg();
  cfg.addEventListener('click', (e) => { e.stopPropagation(); openCollectionOptions(coll); });
  bar.appendChild(cfg);

  // Sem índice ainda não há lista para abrir — o toque leva às opções, que é
  // justamente onde está o sincronizar que resolve isso.
  bar.addEventListener('click', () => {
    if (total > 0) openCollectionSongs(coll); else openCollectionOptions(coll);
  });
  li.appendChild(bar);
  return li;
}

// ===== Opções de uma coleção (bottom-sheet da engrenagem) =====
// Tudo que é manutenção: estado do download, sincronizar/atualizar e excluir.
// Fica fora da lista para que o card volte a ser só "o álbum", clicável.
let collOptionsFor = null;

function openCollectionOptions(coll) {
  collOptionsFor = coll;
  collPopupTitleEl.textContent = coll.name;
  // Único ponto em que o peso é recontado a partir do catálogo: uma coleção,
  // uma vez, ao abrir. Durante o uso ele é mantido incrementalmente.
  updateCollBytes(coll.id);
  renderCollectionOptions();
  collPopupEl.classList.add('open');
}

function closeCollectionOptions() {
  collOptionsFor = null;
  collPopupEl.classList.remove('open');
}

// Re-renderiza o popup se ele estiver aberto na coleção dada — é o que faz o
// progresso da sincronização aparecer sem fechar e reabrir.
function refreshCollectionOptions(id) {
  if (collOptionsFor && (!id || collOptionsFor.id === id) && collPopupEl.classList.contains('open')) {
    renderCollectionOptions();
  }
}

function renderCollectionOptions() {
  const coll = collOptionsFor;
  if (!coll) return;
  const total = collSongs(coll.id).length;
  const downloaded = countDownloaded(coll.id);
  const complete = total > 0 && downloaded >= total;
  const wifiOk = isConfirmedWifi();
  const u = ui(coll.id);

  collOptsEl.innerHTML = '';

  const status = document.createElement('div'); status.className = 'hymnal-card-status';
  if (u.status) {
    status.classList.add('sync');
    status.textContent = u.status;
  } else if (complete) {
    status.classList.add('done');
    status.innerHTML = checkIconSvg();
    status.appendChild(document.createTextNode(' Completo offline'));
  } else if (total > 0) {
    status.textContent = 'Parcial';
  } else {
    status.textContent = 'Não sincronizado';
  }
  collOptsEl.appendChild(status);

  const stats = document.createElement('div'); stats.className = 'hymnal-card-stats';
  stats.appendChild(hymnalStat('Sincronizados', total ? downloaded + '/' + total : '—', complete ? 'done' : ''));
  stats.appendChild(hymnalStat('Peso', u.bytes ? fmtBytes(u.bytes) : '—'));

  const net = document.createElement('div');
  net.className = 'hymnal-stat net ' + (wifiOk ? 'ok' : 'warn');
  net.title = wifiOk
    ? 'Wi-Fi confirmado — sincronização completa liberada'
    : 'Sem Wi-Fi confirmado — sincronizar pergunta antes de usar dados móveis (a escolha vale só para este álbum)';
  const netLabel = document.createElement('label'); netLabel.textContent = 'Rede';
  const netVal = document.createElement('b');
  netVal.appendChild(wifiIconEl());
  netVal.appendChild(document.createTextNode(wifiOk ? 'Wi-Fi' : 'Aguardando'));
  net.append(netLabel, netVal);
  stats.appendChild(net);
  collOptsEl.appendChild(stats);

  // O MESMO botão dispara e cancela — o download de um álbum grande leva
  // dezenas de minutos, e sem um jeito de parar o operador ficava refém dele.
  const syncBtn = document.createElement('button');
  // `cancel`, não `busy`: `busy` gira o ícone, e um ✕ girando não se lê como
  // "toque para parar". Quem indica atividade é o status logo acima.
  syncBtn.className = 'new-folder-btn' + (u.syncBusy ? ' cancel' : '');
  syncBtn.innerHTML = u.syncBusy ? closeIconSvg() : syncIconSvg();
  syncBtn.appendChild(document.createTextNode(
    u.syncBusy ? ' Cancelar o download' : (total > 0 ? ' Atualizar e baixar' : ' Sincronizar lista'),
  ));
  syncBtn.addEventListener('click', () => syncCollection(coll));
  collOptsEl.appendChild(syncBtn);

  if (downloaded > 0 || total > 0) {
    const rmBtn = document.createElement('button');
    rmBtn.className = 'new-folder-btn danger';
    rmBtn.appendChild(msym(ICON.del));
    rmBtn.appendChild(document.createTextNode(' Excluir baixado'));
    rmBtn.addEventListener('click', () => deleteCollection(coll));
    collOptsEl.appendChild(rmBtn);
  }
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
  // O popup de opções mostra o mesmo estado (progresso, baixados/total): se
  // estiver aberto, precisa acompanhar sem o operador fechar e reabrir.
  refreshCollectionOptions();
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
  if (opfsFolders.length === 0 && folders.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.innerHTML = 'Nenhum favorito ainda.<br>Crie atalhos para agrupar o que você mais usa,'
      + '<br>ou sincronize uma pasta do dispositivo.';
    libraryEl.appendChild(empty);
    appendNewFavoriteRow();
    renderStorageUsage();
    return;
  }
  if (folders.length) appendFavSection('Atalhos');
  renderVirtualFolders();
  if (opfsFolders.length) appendFavSection('Pastas do dispositivo');
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
    libraryEl.appendChild(li);
  });
  appendNewFavoriteRow();
  renderStorageUsage();
}

// Cabeçalho de origem dentro dos Favoritos ("Atalhos" / "Pastas do
// dispositivo"): as duas coisas vivem na mesma lista e se comportam igual ao
// toque, então sem um rótulo o operador não sabe qual é qual — e só uma delas
// pede sincronização.
function appendFavSection(title) {
  const li = document.createElement('li');
  li.className = 'fav-section';
  li.textContent = title;
  libraryEl.appendChild(li);
}

// Atalhos: grupos criados pelo operador (pastas virtuais). Excluir um atalho
// não apaga mídia nenhuma — é só o caminho curto que some.
function renderVirtualFolders() {
  folders.forEach((folder) => {
    const count = folderCounts[folder.id] || 0;
    const li = document.createElement('li');
    li.className = 'lib-item';

    const row = document.createElement('div'); row.className = 'row';
    const icon = document.createElement('div'); icon.className = 'thumb thumb--icon';
    icon.appendChild(msym(ICON.star));
    const nameEl = document.createElement('span'); nameEl.className = 'row-name'; nameEl.textContent = folder.name;
    const countEl = document.createElement('span'); countEl.className = 'folder-count'; countEl.textContent = String(count);
    const rmBtn = document.createElement('button'); rmBtn.className = 'row-btn'; rmBtn.title = 'Excluir atalho';
    rmBtn.appendChild(msym(ICON.del));
    rmBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteFolder(folder.id); });

    row.append(icon, nameEl, countEl, rmBtn);
    li.appendChild(row);
    li.addEventListener('click', () => openFolder(folder));
    libraryEl.appendChild(li);
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
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 3.6l2.6 5.28 5.83.85-4.22 4.11 1 5.81L12 16.9l-5.21 2.75 1-5.81-4.22-4.11 5.83-.85z"/></svg>';
  const txt = document.createElement('span');
  txt.textContent = 'Novo atalho';
  btn.appendChild(txt);
  btn.addEventListener('click', promptNewFavorite);
  li.appendChild(btn);
  libraryEl.appendChild(li);
}

async function promptNewFavorite() {
  const name = await appPrompt({ title: 'Novo atalho', message: 'Nome do atalho:', okText: 'Criar', placeholder: 'Ex.: Louvores especiais' });
  if (name && name.trim()) await createFolder(name.trim());
}

// Rodapé com o uso de armazenamento do origin (OPFS + IDB). `alvo` porque esta
// linha vive em dois lugares: a tela de Favoritos e o acervo dentro da busca —
// e é lá que ela mais importa, já que quem ocupa o disco é o download de
// música. `valido` é a condição de que a tela ainda é a mesma quando o
// `estimate()` responde (ele é assíncrono; a aba pode ter mudado no meio).
function renderStorageUsage(alvo, valido) {
  alvo = alvo || libraryEl;
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

function fmtBytes(n) {
  if (n >= 1073741824) return (n / 1073741824).toFixed(1) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

function renderSelbar() {
  selbarEl.hidden = !selectionMode;
  tabsEl.hidden = selectionMode;
  if (!selectionMode) return;
  selCountEl.textContent = String(selected.size);
  selRenameEl.disabled = selected.size !== 1;
}

// ===== ações de reprodução / sequência =====
async function send(id) {
  currentId = id;
  // Atualiza cache do item atual para renderNowPlaying funcionar mesmo fora da aba ativa.
  currentItem = [...plItems, ...libItems].find((m) => m.id === id) || currentItem;
  // Independência áudio × texto: um ÁUDIO (música de fundo) NÃO encerra o texto
  // manual em cena (Bíblia/Mensagem/cronômetro); qualquer VISUAL (vídeo/imagem/
  // YouTube) encerra. Um louvor de fundo sob a contagem regressiva de abertura
  // é justamente o uso normal.
  if (!((bibleSession || msgSession || chronoSession || drawSession) && currentItem && currentItem.kind === 'audio')) clearManualText();
  await persistCurrent();
  ytEnded = false;
  displayStatusAt = 0; // até o Display confirmar o novo item, a preview dirige
  lastDisplayTime = 0;
  cmd({ type: 'load', mediaId: id, view, muted, volume });
  // re-render leve de estados ativos
  document.querySelectorAll('.lib-item,.row-item').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
  renderNowPlaying();
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
function slideTarget() {
  // O cronômetro não tem slides. Sem esta guarda, os botões de estrofe cairiam
  // na letra do áudio de fundo — que está ESCONDIDO atrás do cartão: o operador
  // apertaria "próxima estrofe" e a música saltaria, sem nada mudar na tela.
  if (chronoProjecting() || drawProjecting()) return null;
  if (msgSession && msgSession.projecting) return 'message';
  if (bibleSession && bibleSession.projecting) return 'bible';
  const lyrics = currentItem && Array.isArray(currentItem.lyrics) ? currentItem.lyrics : null;
  if (lyrics && lyrics.length) return 'lyrics';
  return null;
}

function stepSlide(delta) {
  const who = slideTarget();
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
      const txt = document.createElement('div');
      txt.className = 'lv-text';
      txt.textContent = slide.text || '';
      row.appendChild(txt);
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
  cmd({ type: 'clear' });
  clearManualText();
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
const SWIPE = 72, MOVE = 10, LONGPRESS = 450;

function attachRowGestures(row, item) {
  let startX = 0, startY = 0, startT = 0, dx = 0, mode = null, lp = null, pid = null;
  const li = row.closest('li') || row.parentElement;

  row.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.row-handle') || e.target.closest('.row-btn')) return;
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; startT = Date.now(); dx = 0; mode = null;
    lp = setTimeout(() => { mode = 'long'; enterSelection(item.id); }, LONGPRESS);
  });
  row.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    const ddx = e.clientX - startX, ddy = e.clientY - startY;
    if (mode === null) {
      if (Math.abs(ddx) > MOVE && Math.abs(ddx) > Math.abs(ddy)) { mode = 'swipe'; clearTimeout(lp); try { row.setPointerCapture(pid); } catch (_) {} }
      else if (Math.abs(ddy) > MOVE) { clearTimeout(lp); pid = null; return; }
    }
    if (mode === 'swipe') {
      dx = ddx; row.style.transform = `translateX(${dx}px)`;
      li.classList.toggle('show-left', dx < 0);
    }
  });
  function finish(e) {
    if (pid === null) return;
    clearTimeout(lp);
    const dt = Date.now() - startT;
    if (mode === 'swipe') {
      row.style.transform = '';
      li.classList.remove('show-left');
      if (dx <= -SWIPE) addToPlaylist(item);
    } else if (mode !== 'long') {
      const moved = Math.abs((e.clientX || startX) - startX) > MOVE || Math.abs((e.clientY || startY) - startY) > MOVE;
      if (!moved && dt < LONGPRESS) onTap(item);
    }
    pid = null; mode = null;
  }
  row.addEventListener('pointerup', finish);
  row.addEventListener('pointercancel', () => { clearTimeout(lp); row.style.transform = ''; li.classList.remove('show-left'); pid = null; mode = null; });
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
  // Toque direto na biblioteca: define a playlist como este item apenas.
  // Swipe para esquerda continua ADICIONANDO à playlist.
  await replacePlaylistWith(item);
  send(item.id);
}

// Deslize à esquerda: adiciona (sem substituir) à playlist.
async function addToPlaylist(item) {
  const had = await AVDB.listHas('playlist', item.id);
  await AVDB.listAdd('playlist', item.id);
  flash(had ? 'Já na playlist' : 'Adicionado à playlist');
  load();
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
  if (activeTab === 'folders' && currentFolder && currentFolder._opfs) {
    // Pasta OPFS: apaga o arquivo físico, o registro do catálogo e as
    // referências que sobraram em listas.
    for (const id of selected) {
      const rec = await AVDB.fileGet(id);
      if (rec && rec.opfsPath) await AVDB.opfsDeleteFile(rec.opfsPath);
      await AVDB.fileDelete(id);
      for (const l of ['imports', 'playlist']) await AVDB.listRemove(l, id);
    }
    await refreshOpfsFolderCount(currentFolder.id);
  } else if (activeTab === 'folders' && currentFolder) {
    const ids = (await AVDB.getState('folder_' + currentFolder.id)) || [];
    await AVDB.setState('folder_' + currentFolder.id, ids.filter((id) => !selected.has(id)));
  } else {
    for (const id of selected) await AVDB.listRemove(activeTab, id);
  }
  exitSelection(); load();
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
  const ids = (await AVDB.getState('folder_' + folderId)) || [];
  const items = await Promise.all(ids.map((id) => AVDB.getMedia(id)));
  return items.filter(Boolean);
}

function openFolder(folder) {
  rememberScroll();
  currentFolder = folder;
  load();
}

function navigateBack() {
  if (activeTab === 'bible') {
    if (bibleScreen === 'reading') gotoBibleScreen('chapters');
    else if (bibleScreen === 'chapters') gotoBibleScreen('books');
    return;
  }
  // Na raiz dos Favoritos o voltar sai da tela (de volta ao Cronograma);
  // dentro de um atalho/pasta, sobe um nível primeiro.
  if (activeTab === 'folders' && currentFolder === null) { switchTab('imports'); return; }
  rememberScroll();
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

async function deleteFolder(folderId) {
  const folder = folders.find((f) => f.id === folderId);
  if (!(await appConfirm({ title: 'Excluir atalho', message: 'Excluir o atalho "' + (folder ? folder.name : '') + '"? As mídias não são apagadas.', okText: 'Excluir' }))) return;
  folders = folders.filter((f) => f.id !== folderId);
  await AVDB.setState('folders', folders);
  await AVDB.setState('folder_' + folderId, []);
  if (currentFolder && currentFolder.id === folderId) currentFolder = null;
  load();
}

async function addToFolder(folderId, ids) {
  const existing = (await AVDB.getState('folder_' + folderId)) || [];
  await AVDB.setState('folder_' + folderId, [...new Set([...existing, ...ids])]);
  flash('Adicionado aos favoritos');
  exitSelection();
  load();
}

function openFolderPicker() {
  renderFolderPicker();
  folderPopupEl.classList.add('open');
}

function closeFolderPicker() {
  folderPopupEl.classList.remove('open');
}

function renderFolderPicker() {
  folderPickerListEl.innerHTML = '';
  if (folders.length === 0) {
    folderPickerListEl.innerHTML = '<li class="empty">Nenhum atalho ainda.<br>Crie um abaixo.</li>';
    return;
  }
  const selectedIds = [...selected];
  folders.forEach((folder) => {
    const li = document.createElement('li');
    const btn = document.createElement('button'); btn.className = 'folder-pick-btn';
    btn.append(msym(ICON.star), Object.assign(document.createElement('span'), { textContent: folder.name }));
    btn.addEventListener('click', () => { closeFolderPicker(); addToFolder(folder.id, selectedIds); });
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

  if (!('showDirectoryPicker' in window)) { flash('Navegador não suporta seleção de pastas'); return null; }

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
  if (!AVDB.opfsSupported()) { flash('Navegador não suporta armazenamento OPFS'); return; }
  if (syncBusy) { flash('Sincronização em andamento…'); return; }

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
      flash('Sincronizando ' + done + '/' + entries.length + '…', true);
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
    flash(added > 0 ? added + ' arquivo(s) sincronizado(s)' : 'Pasta já em dia');
  } catch (_) {
    flash('Erro na sincronização');
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
    for (const l of ['imports', 'playlist']) await AVDB.listRemove(l, r.id);
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
// plano (ver wiring perto do check do service worker), sem aviso de erro:
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
// Quanto, mais ou menos, falta baixar — calculado a partir do peso REAL do
// que já está no disco desta coleção (não de uma média chutada). Sem nada
// baixado ainda não há de onde tirar, e o diálogo omite o tamanho em vez de
// inventar um.
function estimatePendingBytes(coll, pendingCount) {
  const u = ui(coll.id);
  const done = countDownloaded(coll.id);
  if (!u.bytes || done <= 0 || pendingCount <= 0) return 0;
  return Math.round((u.bytes / done) * pendingCount);
}

// `opts.allowMobile`: a pergunta de rede já foi feita para o LOTE (ver
// syncGroup) — não repetir por álbum.
async function syncCollection(coll, opts) {
  const allowMobile = !!(opts && opts.allowMobile);
  const u = ui(coll.id);
  // Tocar de novo com a sincronização em andamento CANCELA. Antes isto era um
  // `return` mudo: um álbum de centenas de faixas, uma vez começado, não tinha
  // como ser interrompido a não ser fechando o app.
  if (u.syncBusy) {
    u.cancel = true;
    setCollStatus(coll.id, 'Cancelando…');
    renderCollectionsNow();
    return;
  }
  if (!AVDB.opfsSupported()) { setCollStatus(coll.id, 'Armazenamento OPFS indisponível', 5000); return; }
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
    catch (_) { setCollStatus(coll.id, 'Sem internet — falha ao atualizar', 5000); return; }
    const songs = collSongs(coll.id);

    const pending = [];
    for (const s of songs) {
      if (cancelled()) { setCollStatus(coll.id, 'Cancelado', 4000); return; }
      const { needsFull, needsPlayback } = await songVariantsNeeded(coll, s);
      if (needsFull || needsPlayback) pending.push(s);
    }
    if (pending.length === 0) { setCollStatus(coll.id, 'Já completo offline', 4000); return; }
    if (cancelled()) { setCollStatus(coll.id, 'Cancelado', 4000); return; }

    // Fora do Wi-Fi a sincronização em massa NÃO é bloqueada — ela pergunta.
    // Baixar um hinário inteiro pode ser bastante coisa, e só o operador sabe
    // se o plano dele aguenta; o que o app não pode é decidir sozinho por ele,
    // em nenhuma das duas direções. A escolha vale **só para esta
    // sincronização deste álbum**: não vira uma preferência do app, e o
    // próximo álbum pergunta de novo.
    if (!isConfirmedWifi() && !allowMobile) {
      const est = estimatePendingBytes(coll, pending.length);
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
        return;
      }
    }

    let done = 0;
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
        try { await downloadCollectionSong(coll, s); }
        finally { bgItemEnd(itemTaskId, s.name); }
        done++;
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
    try {
      await withBgWork(() => Promise.all(Array.from({ length: CONCURRENCY }, worker)));
    } finally { bgTaskEnd(notifId); }
    setCollStatus(coll.id, (cancelled() ? 'Cancelado (' : 'Atualizado (') + done + ' baixado(s))', 4000);
  } catch (_) {
    setCollStatus(coll.id, 'Erro na sincronização', 5000);
  } finally {
    u.syncBusy = false; u.cancel = false;
    refreshCollectionsIfVisible();
  }
}

// Baixa (ou completa) uma música: busca os metadados individuais (URLs reais) e
// grava áudio Cantado + Playback (se houver) + capa/letra sincronizada no
// OPFS/catálogo. `s` é mutado in-place (fileIdFull/fileIdPlayback), refletido
// no collState[coll.id] compartilhado.
async function downloadCollectionSong(coll, s) {
  let meta;
  try { meta = await Louvorja.fetchList('music_' + s.id_music); }
  catch (_) { return; } // sem rede agora; a próxima sincronização tenta de novo

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
  if (!urlPath) return;
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
    await withBgWork(() => runLimited(pendentes, NET_CONCURRENCY, async (item) => {
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
    }));
  } finally {
    bgTaskEnd(notifId);
    await Promise.all([...sujas].map(saveLyricStore)).catch(() => {});
    lyricSyncRunning = false;
    invalidateLyricIndex();   // o acervo cresceu: a busca precisa reindexar
  }
}

// Busca GLOBAL (botão de lupa): escopo null = varre todas as coleções.
function openHymnSearch() {
  searchScope = null;
  hymnSearchTitleEl.textContent = 'Acervo';
  hymnSearchInputEl.placeholder = 'Nome, número ou trecho da letra…';
  hymnSearchInputEl.value = '';
  renderSearchResults('');
  hymnSearchPopupEl.classList.add('open');
  // **Sem foco automático.** Enquanto a abertura era uma lista de músicas, o
  // teclado subir junto era o certo — não havia mais nada a fazer ali. Agora a
  // abertura é o acervo para folhear, e o teclado cobriria metade dele antes de
  // o operador decidir se vai digitar.
}

// Sair de uma coleção e voltar ao navegador do acervo — o mesmo popup, sem
// fechá-lo. É o par do botão de voltar do cabeçalho e do gesto de voltar do
// Android (ver __avBack).
function searchLeaveScope() {
  if (!searchScope) return false;
  searchScope = null;
  hymnSearchTitleEl.textContent = 'Acervo';
  hymnSearchInputEl.placeholder = 'Nome, número ou trecho da letra…';
  hymnSearchInputEl.value = '';
  renderSearchResults('');
  hymnResultsEl.scrollTop = 0;
  return true;
}

function renderSearchBack() {
  hymnSearchBackEl.hidden = !searchScope;
}
// Lista de músicas de UMA coleção (toque no card do álbum): reaproveita o
// mesmo popup/rows da busca, escopado a essa coleção (mostra tudo por padrão,
// e o campo filtra dentro dela). Não auto-foca o campo (o operador está
// navegando a lista, não necessariamente digitando — evita abrir o teclado
// cobrindo os resultados).
function openCollectionSongs(coll) {
  searchScope = coll.id;
  hymnSearchTitleEl.textContent = coll.name;
  hymnSearchInputEl.placeholder = 'Filtrar músicas…';
  hymnSearchInputEl.value = '';
  renderSearchResults('');
  hymnSearchPopupEl.classList.add('open');
}
function closeHymnSearch() {
  hymnSearchPopupEl.classList.remove('open');
  searchScope = null;
}

// Renderiza os resultados: escopo null = TODAS as coleções (busca global);
// escopo = uma coleção (lista de músicas dela). Cada resultado carrega sua
// coleção pra tocar/adicionar/baixar sob demanda.
// Estado PADRÃO da busca global: o navegador do acervo — as mesmas categorias,
// pílulas e cards da aba Álbuns (`renderCollectionsList`), aqui dentro.
//
// Com o campo vazio a busca listava as primeiras 60 músicas de um acervo de
// milhares: uma fatia sem critério, que não é resposta a pergunta nenhuma. Quem
// abre a lupa sem saber o nome quer FOLHEAR, e folhear é por coleção — que é o
// recorte que o próprio banco já dá e que a aba Álbuns já desenhava. Digitar
// volta a listar músicas, exatamente como antes.
function searchIsBrowsing(q) { return !searchScope && !q; }

function renderSearchResults(query) {
  const q = normalizeForSearch(query).trim();
  if (searchIsBrowsing(q)) {
    hymnResultsEl.innerHTML = '';
    hymnSearchCountEl.textContent = String(allCollections().length);
    renderCollectionsList(hymnResultsEl, () => renderSearchResults(hymnSearchInputEl.value));
    // Quem enche o disco é o download de música: a linha de uso vem junto do
    // acervo, que é onde se decide baixar (e onde se decide apagar).
    renderStorageUsage(hymnResultsEl, () => hymnSearchPopupEl.classList.contains('open')
      && searchIsBrowsing(normalizeForSearch(hymnSearchInputEl.value).trim()));
    renderSearchBack();
    return;
  }
  renderSearchBack();
  const cols = searchScope ? allCollections().filter((c) => c.id === searchScope) : allCollections();
  // A letra só é varrida com busca de verdade (ver LYRIC_MIN_Q); a lista
  // completa de uma coleção não precisa do índice.
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
  hymnSearchCountEl.textContent = String(matches.length);
  hymnResultsEl.innerHTML = '';
  if (totalIndexed === 0) {
    hymnResultsEl.innerHTML = searchScope
      ? '<li class="empty">Lista ainda não carregada.<br>Precisa de internet na primeira vez.</li>'
      : '<li class="empty">Índice do acervo ainda não carregado.<br>Precisa de internet na primeira vez.</li>';
    return;
  }
  if (matches.length === 0) {
    hymnResultsEl.innerHTML = '<li class="empty">Nenhuma música encontrada.</li>';
    return;
  }
  // Escopado a UMA coleção (toque no card do álbum): a lista sai
  // INTEIRA, quantos itens tenha. Ali o operador está folheando um álbum, não
  // filtrando o acervo — cortar em 60 escondia o fim de qualquer hinário.
  // A busca GLOBAL mantém o teto: ela varre milhares de músicas de todos os
  // álbuns, e renderizar tudo a cada tecla travaria o campo.
  const LIMIT = searchScope ? Infinity : 60;
  matches.slice(0, LIMIT).forEach((m) => hymnResultsEl.appendChild(hymnResultRow(m.coll, m.song, m.hit)));
  if (matches.length > LIMIT) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = '+' + (matches.length - LIMIT) + ' resultado(s). Refine a busca.';
    hymnResultsEl.appendChild(li);
  }
}

// Linha compacta: [thumb] [nome / subtítulo] [duração]. As ações NÃO ficam
// mais sempre à vista — o toque na linha as revela logo abaixo (acordeão: só
// uma linha aberta por vez). Com a lista limpa sobra espaço para uma fonte
// maior, que é o que a torna legível de relance no meio do culto.
// Cada variante (Cantado/Playback) é um grupo [tocar][+ Cronograma][+
// Playlist]; o botão de tocar usa ícone de voz (Cantado) ou nota musical
// (Playback). Playback só aparece se a música tiver.
function hymnResultRow(coll, s, lyricHit) {
  const li = document.createElement('li');
  li.className = 'lib-item hymn-result';

  const row = document.createElement('div'); row.className = 'row hymn-row';
  const thumb = document.createElement('div'); thumb.className = 'thumb thumb--icon';
  thumb.appendChild(msym(ICON[coll.iconKey] || ICON.music));

  const info = document.createElement('div'); info.className = 'hymn-info';
  const name = document.createElement('span'); name.className = 'row-name hymn-name';
  name.textContent = songLabel(coll, s);
  info.appendChild(name);
  // Subtítulo: a coleção de origem — só na busca global, porque no escopo de
  // uma coleção o próprio título do popup já diz de onde vem. A duração saiu
  // daqui e virou coluna própria à direita.
  if (!searchScope) {
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

  const time = document.createElement('span'); time.className = 'hymn-time';
  time.textContent = s.duration || '';

  row.append(thumb, info, time);

  const actions = document.createElement('div'); actions.className = 'hymn-actions';
  actions.appendChild(hymnVariantEl(coll, s, 'full', 'Cantado'));
  if (s.has_instrumental_music) actions.appendChild(hymnVariantEl(coll, s, 'playback', 'Playback'));

  // Letra completa, abaixo dos botões. Só é montada quando a linha ABRE (e uma
  // vez só): montá-la para todos os resultados encheria a lista de centenas de
  // nós de texto que ninguém pediu — e a lista é reconstruída a cada tecla.
  const letra = document.createElement('div'); letra.className = 'hymn-lyrics';
  let letraMontada = false;
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
    if (alvo) alvo.scrollIntoView({ block: 'center' });
  }

  row.addEventListener('click', () => {
    // No simplificado não há escolha de variante: o toque na linha toca o
    // CANTADO. Abrir um acordeão com Cantado/Playback e dois "+" seria
    // devolver ao operador exatamente a decisão que este modo poupa.
    if (appMode === 'simple') { simplePlaySong(coll, s); return; }
    const open = li.classList.contains('expanded');
    // Acordeão: abrir uma fecha a anterior — duas linhas abertas ao mesmo
    // tempo empurrariam a lista e tirariam do lugar o que o operador mira.
    hymnResultsEl.querySelectorAll('.hymn-result.expanded').forEach((el) => el.classList.remove('expanded'));
    if (!open) { li.classList.add('expanded'); montarLetra(); }
  });

  li.append(row, actions, letra);
  return li;
}

function hymnVariantEl(coll, s, variant, label) {
  const wrap = document.createElement('div'); wrap.className = 'hymn-variant'; wrap.dataset.variant = variant;
  const playBtn = document.createElement('button'); playBtn.className = 'hymn-play row-btn'; playBtn.title = 'Tocar ' + label;
  playBtn.innerHTML = variant === 'playback' ? noteIconSvg() : voiceIconSvg();
  playBtn.addEventListener('click', () => playSongVariant(coll, s, variant));
  const addBtn = document.createElement('button'); addBtn.className = 'hymn-add row-btn'; addBtn.title = 'Adicionar ' + label + ' ao Cronograma';
  addBtn.appendChild(msym(ICON.plAdd));
  addBtn.addEventListener('click', () => addSongVariant(coll, s, variant));
  const plBtn = document.createElement('button'); plBtn.className = 'hymn-add row-btn'; plBtn.title = 'Adicionar ' + label + ' à playlist';
  plBtn.appendChild(msym(ICON.queue));
  plBtn.addEventListener('click', () => addSongToPlaylist(coll, s, variant));
  wrap.append(playBtn, addBtn, plBtn);
  return wrap;
}

// Verifica quais variantes de uma música ainda precisam ser baixadas: o
// arquivo não existe no catálogo (nunca baixado ou apagado por fora) OU existe
// mas ainda não tem a letra sincronizada (`lyrics === undefined` → backfill sem
// rebaixar o áudio). Regra única usada pela sincronização em massa e pelo
// download sob demanda.
async function songVariantsNeeded(coll, s) {
  const fullRec = s.fileIdFull ? await AVDB.fileGet(s.fileIdFull) : null;
  const playbackRec = s.fileIdPlayback ? await AVDB.fileGet(s.fileIdPlayback) : null;
  return {
    needsFull: !fullRec || fullRec.lyrics === undefined,
    needsPlayback: !!(s.has_instrumental_music && (!playbackRec || playbackRec.lyrics === undefined)),
  };
}

// Baixa uma música sob demanda ("conforme o uso") — diferente da sincronização
// em massa (gated por Wi-Fi), um download disparado por tocar/adicionar é
// sempre permitido, mesmo em dados móveis: é exatamente a música que o operador
// pediu pra usar, nunca o acervo inteiro de uma vez. Reaproveita
// downloadCollectionSong — a música sai já com áudio, capa e letra, pronta pra
// tocar 100% offline nas próximas vezes.
async function ensureSongDownloaded(coll, s) {
  const { needsFull, needsPlayback } = await songVariantsNeeded(coll, s);
  if (!needsFull && !needsPlayback) return;

  const key = coll.id + ':' + s.id_music;
  if (songDownloadInFlight.has(key)) { await songDownloadInFlight.get(key); return; }
  const p = withBgWork(async () => {
    flash('Baixando "' + s.name + '"…', true);
    await downloadCollectionSong(coll, s);
    await AVDB.setState('coll:' + coll.id, collState[coll.id]);
    refreshCollectionsIfVisible();
  });
  songDownloadInFlight.set(key, p);
  try { await p; } finally { songDownloadInFlight.delete(key); }
}

async function resolveSongMediaId(coll, s, variant) {
  await ensureSongDownloaded(coll, s);
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

async function playSongVariant(coll, s, variant) {
  const id = await resolveSongMediaId(coll, s, variant);
  if (!id) { flash('Não foi possível tocar (sem internet para baixar)'); return; }
  const rec = await AVDB.getMedia(id);
  if (!rec) { flash('Erro ao carregar mídia'); return; }
  await replacePlaylistWith(rec);
  closeHymnSearch();
  dismissFlash();   // fecha o toast "Baixando…" sticky que ensureSongDownloaded pode ter deixado
  send(id);
}

async function addSongVariant(coll, s, variant) {
  const id = await resolveSongMediaId(coll, s, variant);
  if (!id) { flash('Não foi possível adicionar (sem internet para baixar)'); return; }
  const had = await AVDB.listHas('imports', id);
  await AVDB.listAdd('imports', id);
  flash(had ? 'Já no Cronograma' : 'Adicionado ao Cronograma');
  if (activeTab === 'imports' && !currentFolder) load();
}

async function addSongToPlaylist(coll, s, variant) {
  const id = await resolveSongMediaId(coll, s, variant);
  if (!id) { flash('Não foi possível adicionar (sem internet para baixar)'); return; }
  const had = await AVDB.listHas('playlist', id);
  await AVDB.listAdd('playlist', id);
  plItems = await AVDB.listItems('playlist');
  renderPlaylist();
  flash(had ? 'Já na playlist' : 'Adicionado à playlist');
}

// ===== transições (fade in/out) =====
function openFadePopup() {
  renderAppModeSeg();
  renderFitSeg();
  renderLyricsBgSeg();
  renderWallSeg();
  fadePopupEl.classList.add('open');
}
function closeFadePopup() {
  fadePopupEl.classList.remove('open');
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

async function handleSharedUrl(url, title) {
  if (!url) return;
  const ytId = extractYouTubeId(url);
  if (ytId) {
    await AVDB.addUrlMedia(url, {
      kind: 'youtube',
      type: 'video/youtube',
      name: title || ('YouTube: ' + ytId),
      thumb: 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg',
      youtubeId: ytId,
    });
    flash('YouTube adicionado');
  } else {
    const kind = detectUrlKind(url);
    const fallbackName = url.split('/').pop().split('?')[0] || url;
    await AVDB.addUrlMedia(url, {
      kind,
      type: kind + '/url',
      name: title || fallbackName,
      thumb: null,
    });
    flash('Link adicionado');
  }
}

// Importa um share já normalizado. Aceita as DUAS formas de arquivo:
//   - `File` (navegador: o SW gravou o POST multipart em pending-share);
//   - `{ name, type, url }` (app nativo: a ponte entrega URL servível e os
//     bytes vêm por fetch, nunca base64).
// Daqui pra baixo o caminho é o mesmo dos arquivos importados à mão.
async function importShare(pending) {
  if (!pending) return false;
  let added = false;

  const files = pending.files || [];
  let ok = 0;
  for (const item of files) {
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
    const thumb = await makeThumb(blob, kind);
    await AVDB.addMedia(blob, { name: name.replace(/\.[^.]+$/, ''), type, kind, thumb });
    ok++;
  }
  if (ok > 0) {
    flash(ok + ' arquivo(s) adicionado(s)');
    added = true;
  }

  if (pending.url) {
    await handleSharedUrl(pending.url, pending.title);
    added = true;
  }
  if (added) {
    if (activeTab !== 'imports') activeTab = 'imports';
    load();
  }
  return added;
}

async function checkPendingShare() {
  // App nativo: o share chega por intent (AVNative.onShare), não pelo
  // `pending-share` que o service worker gravava — o intent-filter entrega o
  // conteúdo direto, sem depender de um POST interceptado.
  if (window.__NATIVE__) {
    AVNative.onShare((share) => { importShare(share); });
    return;
  }
  const pending = await AVDB.getState('pending-share');
  if (!pending) return;
  await AVDB.setState('pending-share', null);
  await importShare(pending);
}

// ===== feedback rápido =====
// O sistema de alerta FLUTUANTE (toast) foi removido: as informações agora são
// transmitidas pela própria interface de design (estados dos botões, contadores,
// listas e — para a sincronização — o texto no card da coleção, ver
// setCollStatus/renderCollectionCard). flash()/dismissFlash() viraram no-ops para
// não precisar mexer em cada um dos ~25 pontos de chamada espalhados pelo
// arquivo; qualquer mensagem que antes ia pro toast simplesmente não aparece
// mais. Feedback relevante que precisa continuar visível foi migrado para a
// própria UI no ponto de origem (ex: a sincronização do Hinário, abaixo).
function flash() { /* no-op: alerta flutuante removido (ver comentário acima) */ }
function dismissFlash() { /* no-op: alerta flutuante removido */ }

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
  if (bgWorkCount > 0 && --bgWorkCount === 0) { bgTasks.clear(); AVNative.keepAlive(false); }
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
// excesso — sem freio, a barra parece travada. Mas o freio não pode ser só
// tempo: com ele em 700 ms fixos, a troca do NOME na linha principal (que é o
// que dá a impressão de progresso) simplesmente nunca chegava quando os itens
// eram rápidos. Então há dois pisos, escolhidos pelo CHAMADOR (`destaque`): um
// curto para o item que entrou em download — a notícia do momento — e um longo
// para atualização de rotina, em que só o número andou. `force` ignora ambos
// (estado final e batimento).
//
// A prioridade é explícita, e não deduzida de "o nome mudou": eventos que
// chegam a poucos ms um do outro competem pelo mesmo piso, e quem decide qual
// deles merece a tela é quem sabe o que aconteceu — ver `bgItemEnd`.
const BG_NOTIF_MIN_MS = 700;        // rotina: só o contador andou
const BG_NOTIF_ITEM_MIN_MS = 250;   // entrou um item novo em download
let bgLastSentAt = 0;
function bgTaskSend(force, destaque) {
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
  const piso = destaque ? BG_NOTIF_ITEM_MIN_MS : BG_NOTIF_MIN_MS;
  if (!force && now - bgLastSentAt < piso) return;
  bgLastSentAt = now;
  try {
    AVNative.bgProgress({
      label: alvo.label + (outras > 0 ? ' (+' + outras + ')' : ''),
      done: alvo.done,
      total: alvo.total,
      etaMs: Math.max(0, Math.round(etaAlvo)),
      items: item ? [item] : [],
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
  appDialogEl.classList.remove('open');
  const r = appDialogResolve; appDialogResolve = null;
  if (r) r(result);
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
    appDialogCancelEl.textContent = cancelText || 'Cancelar';
    if (input) {
      appDialogInputEl.hidden = false;
      appDialogInputEl.value = value || '';
      appDialogInputEl.placeholder = placeholder || '';
    } else {
      appDialogInputEl.hidden = true;
    }
    appDialogEl.classList.add('open');
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
  for (const file of files) {
    // O tipo vem da EXTENSÃO, com o do arquivo como reserva: um seletor de
    // documentos do Android pode entregar `application/octet-stream`, e aí a
    // mídia entraria como 'other' — importada mas impossível de reproduzir.
    // Mesma regra do share e da sincronização de pastas.
    const type = guessMediaType(file.name) || file.type;
    const kind = AVDB.kindFromType(type);
    const thumb = await makeThumb(file, kind);
    await AVDB.addMedia(file, { name: file.name.replace(/\.[^.]+$/, ''), type, kind, thumb });
  }
  fileEl.value = '';
  // Importar sempre cai no Cronograma (lista `imports`, via addMedia) — a aba
  // acompanha para o operador ver o que acabou de entrar.
  if (activeTab !== 'imports') activeTab = 'imports';
  load();
});

playPauseEl.addEventListener('click', () => {
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
  else if (preview.getCurrent()) { cmd({ type: 'play' }); }
  else if (currentId) { send(currentId); } // após stop: recarrega e inicia do início
});
stopEl.addEventListener('click', stopClear);
prevEl.addEventListener('click', () => step(-1));
nextEl.addEventListener('click', () => step(1));
slidePrevBtnEl.addEventListener('click', () => stepSlide(-1));
slideNextBtnEl.addEventListener('click', () => stepSlide(1));
repeatEl.addEventListener('click', cycleRepeat);


seekEl.addEventListener('input', () => { curTimeEl.textContent = fmtTime(parseFloat(seekEl.value)); });
seekEl.addEventListener('change', () => cmd({ type: 'seek', time: parseFloat(seekEl.value) }));

viewToggleEl.addEventListener('click', () => setView(view === 'visual' ? 'wallpaper' : 'visual'));
muteToggleEl.addEventListener('click', toggleMute);
standaloneToggleEl.addEventListener('click', () => setStandalone(!standalone));
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

// Se a largura mudar (ex: rotação), remede o título rolante.
let titleResizeTimer = null;
window.addEventListener('resize', () => {
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
[volSliderEl].forEach((el) => {
  el.addEventListener('pointerdown', () => { volSeekingEl = el; bumpVolPeek(); });
  el.addEventListener('pointerup', () => { volSeekingEl = null; });
  el.addEventListener('input', () => { applyVolume(parseFloat(el.value) / 100); bumpVolPeek(); });
  el.addEventListener('change', () => { volSeekingEl = null; persistCurrent(); });
});


// ===== Modos de uso: simplificado × sonoplasta completo =====
// O app atende duas pessoas diferentes: quem só precisa conectar a tela e
// tocar um louvor, e o sonoplasta que opera o culto inteiro.
//
// **Abre SEMPRE no simplificado**, sem perguntar nada: é o caso mais comum, e
// uma pergunta na abertura cobra um toque de todo mundo — inclusive de quem
// nem sabia que havia dois modos — antes de mostrar qualquer coisa útil. O
// avançado fica a um toque, no botão do cabeçalho (e no segmento "Modo do app"
// do popup de Exibição, para voltar). A escolha vale só para a sessão: cada
// abertura recomeça no simplificado.
//
// O simplificado não é uma segunda implementação do transporte: os botões
// dele acionam os MESMOS controles do modo avançado por `.click()` (o mesmo
// padrão da notificação nativa), e o volume passa pelo mesmo `applyVolume`.
// Assim nenhuma regra de borda — texto sem áudio de fundo, YouTube que precisa
// recarregar, mudo bloqueado pelo navegador — existe em dois lugares.
let appMode = 'simple';         // o HTML já nasce com `body.mode-simple`
let lastDisplays = [];          // telas conectadas (ponte nativa)

function setAppMode(mode) {
  appMode = mode === 'simple' ? 'simple' : 'full';
  document.body.classList.toggle('mode-simple', appMode === 'simple');
  simpleModeEl.classList.toggle('open', appMode === 'simple');
  renderAppModeSeg();
  renderSimple();
  renderSimpleCast();
  renderSimpleGate();   // `renderSimpleCast` volta cedo fora do simplificado
  // Sair do simplificado com a busca aberta deixaria o popup por cima da tela
  // completa sem nada que explicasse por quê.
  if (appMode === 'full') closeHymnSearch();
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
  simpleTimeCurEl.textContent = fmtTime(cur);
  simpleTimeDurEl.textContent = fmtTime(dur);
  simpleTimeFillEl.style.width = Math.max(0, Math.min(100, (cur / dur) * 100)) + '%';
}

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
function renderSimpleCast() {
  if (appMode !== 'simple') return;
  const tv = simpleDisplay();
  simpleCastBtnEl.classList.toggle('connected', !!tv);
  // Sem tela, o botão é a tela inteira (ver o bloqueio abaixo) e precisa dizer
  // tudo sozinho: uma frase, no rótulo. Com tela conectada ele volta a ser um
  // cartão entre outros — o rótulo nomeia a ação e o subtítulo informa o
  // estado, que é a divisão de sempre.
  simpleCastLabelEl.textContent = tv ? 'Conectar a tela' : 'Toque para conectar uma tela';
  if (!window.__NATIVE__) {
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

function simpleDisplay() {
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

// Abre a tela do Display no navegador e acompanha a janela: fechá-la é o
// equivalente a desconectar o telão, e a cortina precisa voltar. `closed` só
// se descobre olhando — não há evento — então o relógio existe apenas
// enquanto a janela existe.
function openWebDisplay() {
  webDisplayWin = window.open('../display/', 'avDisplay');
  renderSimpleCast();
  clearInterval(webDisplayTimer);
  if (!webDisplayWin) return;
  webDisplayTimer = setInterval(() => {
    if (webDisplayWin && !webDisplayWin.closed) return;
    clearInterval(webDisplayTimer);
    webDisplayTimer = null;
    webDisplayWin = null;
    renderSimpleCast();
  }, 1000);
}

simpleFullBtnEl.addEventListener('click', () => setAppMode('full'));
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
simpleMuteEl.addEventListener('click', () => muteToggleEl.click());
holdRepeat(simpleVolUpEl, () => simpleVolStep(1));
holdRepeat(simpleVolDownEl, () => simpleVolStep(-1));
simpleCastBtnEl.addEventListener('click', () => {
  if (window.__NATIVE__) AVNative.openCast();
  else openWebDisplay();
});
// Fecha o ciclo com o HTML: as classes já vêm do documento, aqui o estado do
// JS (segmento do popup, espelho dos controles) nasce igual a elas.
setAppMode('simple');

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

// Anima a entrada da lista ao trocar de aba: leve deslize direcional + fade.
// Usa a Web Animations API na PRÓPRIA `#library` — como o `load()` reconstrói o
// conteúdo em poucos ms (leituras IDB em memória), animar já a partir de
// opacity:0 esconde a troca e revela o conteúdo novo entrando. Sai cedo se o
// usuário prefere menos movimento.
function animateTabSwitch(dir) {
  if (prefersReducedMotion || !libraryEl.animate) return;
  libraryEl.animate(
    [
      { opacity: 0, transform: 'translateX(' + (dir * 22) + 'px)' },
      { opacity: 1, transform: 'translateX(0)' },
    ],
    { duration: 220, easing: 'cubic-bezier(.22,.61,.36,1)' },
  );
}

// Troca de tela da lista. Nem toda tela tem aba: **Favoritos** é alcançada
// pelo botão no fim do Cronograma (ver appendImportRow), e o botão voltar dali
// retorna ao Cronograma — mas continua sendo um `activeTab` ('folders'), com a
// mesma navegação interna (atalhos, pastas do dispositivo, busca).
function switchTab(tab) {
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
  activeTab = tab;
  if (selectionMode) exitSelection();
  load();
  animateTabSwitch(dir);
  // Ao entrar na Bíblia: garante versões/livros e baixa a versão INTEIRA na
  // 1ª vez (em segundo plano — ver ensureBibleVersionDownloaded).
  if (activeTab === 'bible') enterBibleTab();
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) switchTab(tab.dataset.tab);
});

selCancelEl.addEventListener('click', exitSelection);
selFolderEl.addEventListener('click', openFolderPicker);
selDeleteEl.addEventListener('click', deleteSelected);
selRenameEl.addEventListener('click', renameSelected);

backBtnEl.addEventListener('click', navigateBack);
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
hymnSearchBackEl.addEventListener('click', searchLeaveScope);

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
  const previewEl = document.getElementById('preview');
  const isFs = () => document.fullscreenElement === previewEl;

  // ---- botões flutuantes (fora do fullscreen) ----
  // Antes as três ações eram gestos invisíveis sobre a preview (toque = tela
  // cheia, toque longo = popup de Exibição) — nada na tela dizia que existiam.
  // Agora cada uma tem seu botão semitransparente num canto, e o toque na
  // preview só MOSTRA/ESCONDE esses botões. Some sozinho depois de um tempo
  // para não tampar a projeção em miniatura.
  // Visíveis por padrão: são a única indicação de que essas ações existem, e a
  // preview fica na base da tela o tempo todo — esconder por omissão devolvia
  // o problema dos gestos invisíveis. O toque na preview os esconde (para ver
  // a miniatura limpa) e outro toque os traz de volta; não somem sozinhos.
  const fabsEl = document.getElementById('pvFabs');
  function showFabs(on) { fabsEl.hidden = !on; }
  // Os botões NÃO se escondem ao serem usados: são o estado padrão da preview.
  document.getElementById('pvSettingsBtn').addEventListener('click', openFadePopup);
  document.getElementById('pvFullBtn').addEventListener('click', enterFullscreen);
  // Cast: só existe com o shell nativo (é um intent do Android). No navegador
  // o botão nem aparece — regra geral do projeto: o web é o padrão, o nativo
  // é a exceção que se declara.
  const castBtnEl = document.getElementById('pvCastBtn');
  if (window.__NATIVE__) {
    castBtnEl.hidden = false;
    castBtnEl.addEventListener('click', () => AVNative.openCast());
  }

  async function enterFullscreen() {
    try {
      if (previewEl.requestFullscreen) await previewEl.requestFullscreen();
      else if (previewEl.webkitRequestFullscreen) previewEl.webkitRequestFullscreen();
      try { await (screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')); } catch (_) {}
    } catch (_) {}
  }
  function exitFullscreen() { try { if (document.exitFullscreen) document.exitFullscreen(); } catch (_) {} }
  document.addEventListener('fullscreenchange', () => {
    // Fora da tela cheia os botões são o padrão; dentro dela o CSS os esconde
    // de qualquer forma (nada de UI sobre a projeção). Sincronizar o estado
    // aqui evita sair da tela cheia com eles apagados sem motivo.
    showFabs(!document.fullscreenElement);
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
      return;
    }
    // Toque NO botão: quem responde é o handler dele. Este evento borbulha a
    // partir do botão, e esconder os FABs aqui (antes do `click`, que só é
    // despachado depois do pointerup) poderia engolir o clique.
    if (e.target.closest && e.target.closest('.pv-fab')) return;
    // Fora do fullscreen a preview não tem mais ação própria: o toque só
    // revela (ou esconde) os botões flutuantes, e a ação é de quem tocar no
    // botão. Um arrasto não conta como toque.
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < TAP_MOVE) showFabs(fabsEl.hidden);
  });

  previewEl.addEventListener('pointercancel', () => { volActive = false; });
})();
fitSegEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.fit-opt');
  if (btn) applyFit(btn.dataset.fit);
});
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
  };
  AVNative.displays().then(renderDisplayStatus);
  AVNative.onDisplayChange(renderDisplayStatus);
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


newFolderInPickerBtnEl.addEventListener('click', async () => {
  const name = await appPrompt({ title: 'Novo atalho', message: 'Nome do atalho:', okText: 'Criar', placeholder: 'Ex.: Louvores especiais' });
  if (name && name.trim()) { await createFolder(name.trim()); renderFolderPicker(); }
});

// Fechamento dos bottom-sheets: todos se comportam igual — o ✕ fecha e tocar
// no fundo (fora da folha) também. O par de listeners estava copiado seis
// vezes; aqui é uma tabela, e um popup novo entra com uma linha.
// A mesma tabela é a fonte do botão VOLTAR do Android (ver `__avBack`): um
// popup novo entra numa linha e já passa a ser fechável pelos três caminhos
// (✕, toque no fundo, botão do aparelho). Duas listas divergiriam no primeiro
// popup que alguém esquecesse de acrescentar na segunda.
const POPUPS = [
  [collPopupEl, collPopupCloseEl, closeCollectionOptions],
  [plPopupEl, plPopupCloseEl, closePlPopup],
  [hymnSearchPopupEl, hymnSearchCloseEl, closeHymnSearch],
  [bibleVerPopupEl, bibleVerCloseEl, closeBibleVerPopup],
  [fadePopupEl, fadePopupCloseEl, closeFadePopup],
  [lyricsPopupEl, lyricsPopupCloseEl, closeLyricsPopup],
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
  // 2. Dentro de uma COLEÇÃO na busca: sobe um nível (volta ao acervo) em vez
  //    de fechar o popup. Desde a v5.43 a busca tem dois níveis — acervo e
  //    coleção —, e pular do segundo direto para fora seria perder o caminho
  //    andado. O ✕ e o toque no fundo continuam fechando de uma vez: quem os
  //    toca está saindo, não voltando.
  if (hymnSearchPopupEl.classList.contains('open') && searchLeaveScope()) return true;
  // 3. Bottom-sheets. Fecha o ÚLTIMO da tabela que estiver aberto — normalmente
  //    há um só, mas se houver dois o de cima é o que o operador vê.
  for (let i = POPUPS.length - 1; i >= 0; i--) {
    const [backdrop, , close] = POPUPS[i];
    if (backdrop.classList.contains('open')) { close(); return true; }
  }
  // 4. Preview em tela cheia — que, sem telão conectado, É a projeção. Sair
  //    dela é exatamente o que o voltar significa aqui.
  if (document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (_) {}
    return true;
  }
  // 5. Coluna do mixer aberta no fader.
  if (mixerEl.classList.contains('vol-open')) { closeVolume(); return true; }
  // 6. Seleção múltipla: o voltar cancela a seleção, não o app.
  if (selectionMode) { exitSelection(); return true; }
  // 7. Sub-tela com voltar próprio (pasta aberta, Favoritos, telas da Bíblia).
  //    Reusa `navigateBack` em vez de reimplementar a hierarquia: ela já sabe
  //    que a Bíblia sobe leitura→capítulos→livros e que a raiz dos Favoritos
  //    volta ao Cronograma.
  if (!backBtnEl.hidden) { navigateBack(); return true; }
  // 8. Fora do Cronograma: volta para ele. É a tela inicial da biblioteca, e
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
function resendSceneToDisplay() {
  const isImage = !!currentItem && currentItem.kind === 'image';
  if (currentId && (playing || isImage)) {
    AVDB.sendCommand({ type: 'load', mediaId: currentId, view, muted, volume });
  }
  // O cronômetro volta pelo DESCRITOR, não por um valor: o telão recalcula o
  // número a partir do mesmo `startAt`, então ele reaparece no segundo certo —
  // não no ponto em que a conexão caiu.
  if (drawProjecting()) {
    // O telão que reconecta no MEIO do rolo entra no mesmo quadro dos demais: o
    // quadro é função de `rollUntil` e do relógio, não de quantos ticks já
    // passaram por ali (ver drawReading).
    AVDB.sendCommand({ type: 'text', mode: 'draw', draw: drawDescriptor(), sub: draw.label || '', view });
  } else if (chronoProjecting()) {
    AVDB.sendCommand({ type: 'text', mode: 'chrono', chrono: chronoDescriptor(), sub: chrono.label || '', view });
  } else if (bibleSession && bibleSession.projecting) {
    const v = bibleSession.verses[bibleSession.idx];
    if (v) {
      const ref = bibleSession.bookName + ' ' + bibleSession.chapter + ':' + v.n;
      AVDB.sendCommand({ type: 'text', mode: 'verse', main: v.text, sub: ref, view });
    }
  } else if (msgProjecting()) {
    const m = messages[msgSession.idx];
    if (m) AVDB.sendCommand({ type: 'text', mode: 'message', main: m.text, sub: '', view });
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
  if (msg.type === 'display-ready') { resendSceneToDisplay(); return; }
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

// Auto-atualização: ao abrir e ao retomar do segundo plano, checa se há uma
// versão nova publicada; quando o novo service worker assume o controle,
// recarrega para exibir a versão nova. Recarregar o Controle não afeta a
// projeção (o Display é um app à parte, que segue tocando).
let swReg = null;
// No app nativo NÃO há service worker: os assets vêm do APK (offline por
// natureza) e o compartilhamento chega por intent, não pelo POST em
// `share-target` que o SW interceptava.
if (!window.__NATIVE__ && 'serviceWorker' in navigator) {
  // Só recarrega numa ATUALIZAÇÃO (já havia um controller); a primeira
  // instalação reivindica a página sem precisar recarregar.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    swReg = reg;
    if (document.visibilityState === 'visible') reg.update().catch(() => {});
  }).catch(() => {});
}

// Um ÚNICO handler ao retomar do 2º plano (antes eram dois listeners
// separados): busca a versão nova do service worker E atualiza os índices
// leves das coleções (índices dos hinários + catálogo de álbuns — só
// metadados, sem áudio — barato pra rodar a cada retomada, mantém a busca e os
// cards em dia).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    // App em segundo plano: o botão de falar não está mais sob o dedo, então
    // o microfone não pode continuar aberto. Push-to-talk que sobrevive ao
    // app sair da frente vira um microfone esquecido ligado.
    if (micPressed || micOn) sendMic(false);
    return;
  }
  if (swReg) swReg.update().catch(() => {});
  autoRefreshCollections();
});

(async function init() {
  await loadCollections();
  await desnumerarAlbunsBaixados();
  // ANTES do load(): é ele que lê `current` e monta a tela a partir dela.
  await clearCurrentSelection();
  await load();
  // Wallpaper escolhido pelo operador (a preview espelha o telão).
  await applyPvWallpaper();
  // processa share pendente (Web Share Target via SW)
  await checkPendingShare();
  // Índices das coleções em segundo plano (fire-and-forget): não atrasa a
  // abertura do app, só deixa a busca/os cards prontos assim que a resposta chegar.
  autoRefreshCollections();
  // Metadados da Bíblia (versões + livros) em segundo plano — baixados na 1ª
  // vez e cacheados; deixa a aba Bíblia pronta pra baixar capítulos.
  ensureBibleMeta(false);
})();
