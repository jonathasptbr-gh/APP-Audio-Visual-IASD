// Camada de dados compartilhada entre os dois PWAs (Controle e Display).
// Mesmo domínio/origin => compartilham IndexedDB, OPFS e BroadcastChannel.
//
// Modelo:
//   - store "media": blobs importados (imagens/vídeos/áudios), itens de URL e
//     apresentações (kind 'deck': um array de Blobs, uma imagem por página).
//   - store "files": catálogo dos arquivos guardados no OPFS (só metadados +
//     thumbnail; os bytes ficam no Origin Private File System).
//   - listas (em "state"): "imports", "playlist", "avulsos", "favs" = arrays de
//     ids ("avulsos" é a prateleira invisível da mídia que está em cena sem
//     pertencer a lista nenhuma; "favs" é a marcação de um toque — ver LISTS).
//   - Atalhos (organização opcional dentro dos Favoritos): "folders" =
//     [{id,name}] e um array de ids por atalho em "folder_<id>". São detentores
//     de referência como as listas.
//   - um blob de "media" só é apagado quando NADA mais aponta para ele — nem
//     lista, nem Favorito (ver `isReferenced`); registros de "files"
//     pertencem à sua pasta OPFS e não passam pelo gc.
//
// Exposto como window.AVDB.

(function (global) {
  'use strict';

  const DB_NAME = 'av-iasd';
  // 3: índice `youtubeId` em "media" (v5.87) — ver `mediaByYoutube`.
  //
  // SUBIR ISTO TEM UM PREÇO, e ele não é o upgrade: é a VOLTA. `open` com uma
  // versão MENOR do que a do banco lança VersionError, e a base web anterior é
  // exatamente para onde o watchdog do OTA volta quando um bundle não confirma
  // (e é o que o APK instalado embute até a Release seguinte). Um bundle que
  // sobe o DB_VERSION, é servido uma vez e depois é descartado deixa a base
  // antiga sem conseguir ABRIR o banco: um lançamento inteiro sem playlist,
  // sem Cronograma e sem biblioteca. O caso se cura sozinho (o `check()`
  // seguinte rebaixa o bundle de novo), mas o lançamento estragado é real.
  // Portanto: só suba junto com uma Release, e só quando o ganho não couber
  // numa chave de `state` — que é onde uma estrutura auxiliar deve morar.
  const DB_VERSION = 3;
  const STORE_MEDIA = 'media';
  const STORE_STATE = 'state';
  const STORE_FILES = 'files';
  const CHANNEL_NAME = 'av-iasd';
  // As listas FIXAS. NÃO é a lista completa de quem referencia um id de mídia
  // — os Favoritos moram em chaves dinâmicas (`folder_<id>`). Quem decide se
  // um blob pode ser apagado é `isReferenced`, não esta constante.
  //
  // "avulsos" (v5.87) é a única que o operador NÃO vê: é o detentor da mídia
  // que está em cena sem pertencer a lista nenhuma — "Tocar agora" num
  // resultado do YouTube não tem nada a ver com o Cronograma, mas um registro
  // em NENHUMA lista é vazamento permanente (o gc só alcança o que uma lista
  // já segurou; ver o comentário das funções removidas na v5.48). Ela é
  // PEQUENA e de tamanho fixo (`AVULSO_MAX`, no Controle): quem entra empurra
  // o mais antigo para fora, e aí o gc decide — o blob some se ninguém mais o
  // quiser, e fica inteiro se o Cronograma, a playlist ou um Favorito também o
  // tiverem.
  //
  // "favs" (v5.103) é a marcação de UM TOQUE: um id está favoritado ou não, sem
  // pertencer a grupo nenhum. Ela entra aqui — e não numa chave à parte — porque
  // é isto que a torna um DETENTOR DE REFERÊNCIA de verdade: `isReferenced`
  // varre esta constante, então favoritar passa a segurar o blob e desfavoritar
  // passa a poder coletá-lo, sem uma linha nova de gc. Os atalhos
  // (`folder_<id>`) continuam existindo ao lado dela, como organização
  // OPCIONAL — ver `folderDrop`.
  const LISTS = ['imports', 'playlist', 'avulsos', 'favs'];

  let dbPromise = null;

  // A conexão é memorizada, mas a FALHA não: até a v5.48 `dbPromise` guardava
  // também a promise REJEITADA, então uma única falha do `indexedDB.open`
  // (pressão de armazenamento, renderer se recuperando de um OOM) deixava todo
  // o AVDB rejeitando para sempre — o app ficava sem dados até ser fechado e
  // reaberto, sem nenhum caminho de recuperação. Zerando `dbPromise` no
  // caminho de erro, a próxima chamada simplesmente tenta de novo.
  function openDB() {
    if (dbPromise) return dbPromise;
    const p = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // O store pode já existir (upgrade 2 → 3): aí o objectStore vem da
        // transação do próprio upgrade, e não de um `createObjectStore` — que
        // lançaria ConstraintError e deixaria o app sem banco nenhum.
        const ms = db.objectStoreNames.contains(STORE_MEDIA)
          ? req.transaction.objectStore(STORE_MEDIA)
          : db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        // Registros com `youtubeId: null` ficam FORA do índice (null não é
        // chave IDB válida), que é exatamente o que se quer: o índice só tem
        // os vídeos baixados do YouTube, e a busca por um id devolve ou o
        // registro dele ou nada.
        if (!ms.indexNames.contains('youtubeId')) ms.createIndex('youtubeId', 'youtubeId');
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const fs = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
          fs.createIndex('folder', 'folder');
        }
      };
      // Só invalida o cache se ele ainda for ESTA promise: um `openDB`
      // posterior pode já ter posto outra no lugar, e zerá-la faria a próxima
      // chamada abrir uma terceira conexão à toa.
      const forget = () => { if (dbPromise === p) dbPromise = null; };
      req.onsuccess = () => {
        const db = req.result;
        // A OUTRA página (Controle × Display, mesmo origin) pediu um upgrade.
        // Sem fechar aqui, a conexão velha BLOQUEIA o upgrade dela e a outra
        // página fica esperando para sempre, com a tela montada e sem dado
        // nenhum — no meio de um culto. No app o caso não chega a acontecer
        // (o `beginSession` fixa um único bundle por sessão, logo um único
        // DB_VERSION); no navegador, com as duas páginas abertas, é o que
        // segura a subida de 2 para 3 da v5.87 — que é justamente o dia em que
        // ninguém lembraria disto.
        db.onversionchange = () => { db.close(); forget(); };
        // Conexão fechada por fora (o navegador pode forçar em falha de
        // armazenamento): o handle memorizado está morto, reabrir na próxima.
        db.onclose = forget;
        resolve(db);
      };
      const fail = (err) => { forget(); reject(err || new Error('IndexedDB indisponível')); };
      req.onerror = () => fail(req.error);
      // A ponta oposta do `onversionchange`: se ALGUÉM não fechar a conexão
      // velha, `onblocked` é o único aviso que existe. Sem ele o `open` não
      // resolve NEM rejeita, e quem chamou fica pendurado sem erro nenhum.
      req.onblocked = () => fail(new Error('IndexedDB bloqueado por outra conexão (upgrade pendente)'));
    });
    dbPromise = p;
    return p;
  }

  function store(name, mode) {
    return openDB().then((db) => db.transaction(name, mode).objectStore(name));
  }
  // Retorna [objectStore, transaction] para operações que precisam de atomicidade (get+put).
  function storeTx(name, mode) {
    return openDB().then((db) => {
      const tx = db.transaction(name, mode);
      return [tx.objectStore(name), tx];
    });
  }
  function asPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  // Resolve quando a transação inteira commita — usado nas operações
  // multi-passo (read-modify-write) que precisam confirmar a atomicidade.
  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transação abortada'));
    });
  }
  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  }
  // Constrói um registro de "media" a partir de campos padrão + overrides do
  // chamador (evita repetir a mesma estrutura em addMedia/addUrlMedia/temp).
  function makeMediaRecord(fields) {
    return Object.assign({
      id: uid(),
      blob: null,
      url: null,
      thumb: null,
      type: 'url/unknown',
      kind: 'other',
      name: 'sem-nome',
      youtubeId: null,
      // APRESENTAÇÃO: um array de Blobs, uma imagem por página (kind 'deck').
      // Dentro do PRÓPRIO registro, e não em arquivos soltos no OPFS, porque
      // assim o gc que já existe leva as páginas junto quando o item sai da
      // última lista — páginas no OPFS pediriam uma faxina paralela, que é
      // exatamente o tipo de bookkeeping duplicado que vaza espaço em silêncio.
      // O IndexedDB guarda Blob por REFERÊNCIA: ler o registro não traz os
      // bytes de dezenas de páginas para a memória.
      pages: null,
      // CENA DE ROTEIRO (kind 'cue', v5.103): o item do Cronograma que não tem
      // bytes — um versículo, uma mensagem, a letra de um hino, o cronômetro de
      // abertura, um sorteio ou um pacote de mídias. `cue` é o subtipo e `data`
      // o DESCRITOR (a referência do que projetar), nunca o conteúdo: o texto do
      // versículo continua vindo do cache da Bíblia na hora de projetar, e o que
      // vai ao telão continua sendo o MESMO comando `text`/`chrono`/`draw` que o
      // Display já entende — nenhuma lógica de projeção nova, nem no shell nem
      // no Display (que sequer sabe que cues existem: um cue nunca vira `load`).
      cue: null,
      data: null,
      // ALTURA em pixels do vídeo, quando conhecida (v5.118). É o subtítulo da
      // linha do Cronograma — "Vídeo · 1080p" —, e ela existe como CAMPO porque
      // a única outra forma de saber a resolução de um blob é decodificá-lo, o
      // que significaria abrir um `<video>` por linha a cada render. Quem sabe
      // é quem gravou: o shell devolve a altura do que de fato baixou, e a
      // importação de arquivo a lê do mesmo `<video>` que já monta a miniatura.
      // `null` quando não se sabe — e aí o subtítulo diz só o tipo.
      height: null,
      // DURAÇÃO em segundos, pela mesma razão e com a mesma regra. Ela é o
      // detalhe do subtítulo de um ÁUDIO, que não tem resolução para mostrar.
      seconds: null,
      // TRANSMISSÃO DIRETA (v5.120): o manifesto das duas faixas adaptativas —
      // URLs servíveis pelo próprio origin e os byte-ranges do DASH. Uma mídia
      // com este campo não tem `blob` nem `url`: quem a toca é o `MediaSource`
      // (ver shared/mse.js), e o `stage.js` a trata como vídeo em tudo o mais.
      //
      // Ela é TRANSITÓRIA por natureza, e isso não é descuido: as URLs do
      // googlevideo expiram em algumas horas. Um registro de stream que
      // sobreviva à expiração falha ao tocar — e é o `onStreamErro` do Controle
      // que pede um manifesto novo e o regrava aqui.
      stream: null,
      createdAt: Date.now(),
    }, fields);
  }
  // Lê o array de ids de uma lista a partir de um objectStore de "state" já
  // aberto (para uso DENTRO de uma transação existente, sem abrir outra).
  // Cobre a migração "imports" ← "order".
  async function readListIn(stateStore, name) {
    let ids = await asPromise(stateStore.get(name));
    if (ids == null && name === 'imports') ids = await asPromise(stateStore.get('order'));
    return Array.isArray(ids) ? ids.slice() : [];
  }
  function kindFromType(type) {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'other';
  }

  // ---- state genérico ----
  async function setState(key, value) {
    const s = await store(STORE_STATE, 'readwrite');
    return asPromise(s.put(value, key));
  }
  async function getState(key) {
    const s = await store(STORE_STATE, 'readonly');
    return asPromise(s.get(key));
  }
  // Chaves de `state` que começam com `prefix`, numa transação só e sem
  // desserializar valor nenhum. Existe para testar PRESENÇA em massa: a Bíblia
  // precisa saber quais dos 1189 capítulos já estão em cache, e fazer isso com
  // 1189 `getState` significava 1189 transações lendo o capítulo inteiro (~30
  // versículos de texto) só para descartar o conteúdo.
  async function stateKeys(prefix) {
    const s = await store(STORE_STATE, 'readonly');
    // '￿' é maior que qualquer caractere possível no sufixo, então o
    // intervalo cobre exatamente as chaves que começam com o prefixo.
    const range = IDBKeyRange.bound(prefix, prefix + '￿', false, false);
    return asPromise(s.getAllKeys(range));
  }

  // ---- media ----
  // Insere o registro em "media" E o adiciona à lista numa ÚNICA transação
  // (media + state) — sem isso, uma falha entre o add e o listAdd deixaria um
  // registro órfão em "media" que o gc() nunca coleta (nunca esteve numa
  // lista) e que vaza espaço no IDB indefinidamente.
  async function addMediaToList(record, listName) {
    const db = await openDB();
    const tx = db.transaction([STORE_MEDIA, STORE_STATE], 'readwrite');
    await asPromise(tx.objectStore(STORE_MEDIA).add(record));
    const st = tx.objectStore(STORE_STATE);
    const ids = await readListIn(st, listName);
    if (!ids.includes(record.id)) { ids.push(record.id); await asPromise(st.put(ids, listName)); }
    await txDone(tx);
    return record;
  }
  // `meta.type`/`meta.kind` são opcionais e só existem porque nem toda origem
  // de bytes informa um MIME confiável: provedores de documentos do Android
  // (SAF/share por intent) costumam devolver `application/octet-stream`, que
  // classificaria a mídia como 'other' e a tornaria inutilizável. Quem tem
  // uma fonte melhor (a extensão do arquivo) passa aqui; o padrão continua
  // sendo o tipo do próprio blob.
  //
  // `meta.list` escolhe QUAL lista recebe o registro; o padrão continua sendo
  // "imports" (o Cronograma), que é onde toda importação sempre entrou. Ele
  // existe porque nem toda mídia baixada pertence ao Cronograma: "Tocar agora"
  // num vídeo do YouTube entra em "avulsos" e "Adicionar à playlist" entra
  // direto na playlist. Continua sendo UMA transação — a lista é escolhida,
  // não dispensada, justamente para o registro nunca nascer órfão.
  async function addMedia(blob, meta) {
    const type = (meta && meta.type) || blob.type;
    const record = makeMediaRecord({
      blob,
      type,
      kind: (meta && meta.kind) || kindFromType(type),
      thumb: (meta && meta.thumb) || null,
      name: (meta && meta.name) || 'sem-nome',
      youtubeId: (meta && meta.youtubeId) || null,
      height: (meta && meta.height) || null,
      seconds: (meta && meta.seconds) || null,
      stream: (meta && meta.stream) || null,
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }
  // Uma mídia de TRANSMISSÃO DIRETA: sem bytes no aparelho, sem URL única — o
  // que ela tem é o manifesto das faixas. Não passa por `addMedia`, que deriva
  // tipo e kind de um blob que aqui não existe.
  //
  // `kind: 'video'` de propósito, e não um kind novo: para todo o resto do app
  // isto É um vídeo — a cortina, o fade, o transporte, a barra de progresso e a
  // sessão de mídia não têm por que saber de onde vêm os bytes. Um kind próprio
  // obrigaria cada um desses lugares a aprender um caso a mais.
  async function addStreamMedia(stream, meta) {
    const record = makeMediaRecord({
      stream,
      thumb: (meta && meta.thumb) || null,
      type: 'video/mp4',
      kind: 'video',
      name: (meta && meta.name) || 'Vídeo',
      youtubeId: (meta && meta.youtubeId) || null,
      height: (meta && meta.height) || null,
      seconds: (meta && meta.seconds) || null,
    });
    return addMediaToList(record, (meta && meta.list) || 'avulsos');
  }

  // Regrava o manifesto de uma mídia de transmissão — o caminho de recuperação
  // quando as URLs expiram. Get + put na MESMA transação, como o `renameMedia`.
  async function setMediaStream(id, stream) {
    const [st, tx] = await storeTx(STORE_MEDIA, 'readwrite');
    const record = await asPromise(st.get(id));
    if (!record) return null;
    record.stream = stream || null;
    await asPromise(st.put(record));
    await txDone(tx);
    return record;
  }

  // Uma APRESENTAÇÃO: as páginas já rasterizadas (ver SlideDeck.kt, no shell).
  // Ela não tem `blob` nem `url` — a mídia É a lista de páginas —, e por isso
  // não passa por `addMedia`, que deriva tipo e kind de um blob que aqui não
  // existe.
  async function addDeck(pages, meta) {
    const record = makeMediaRecord({
      pages: Array.isArray(pages) ? pages : [],
      thumb: (meta && meta.thumb) || null,
      type: 'application/pdf',
      kind: 'deck',
      name: (meta && meta.name) || 'Apresentação',
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }
  // Uma CENA DE ROTEIRO (ver `cue` em makeMediaRecord). Entra numa lista pela
  // mesma transação de tudo o mais — um cue órfão seria tão invisível quanto um
  // blob órfão, e o gc o coleta pelas mesmas regras (ele é um registro de
  // "media" como outro qualquer, só que sem bytes).
  //
  // NÃO exige subir o DB_VERSION: nenhum índice novo, e o IndexedDB não tem
  // esquema por registro. Um bundle ANTERIOR a esta versão que encontre um cue
  // o trata como mídia sem blob/url — `stage.load` cai no `clear()` e o telão
  // fica no wallpaper, que é a degradação certa (nada quebra, nada projeta).
  async function addCue(cue, data, meta) {
    const record = makeMediaRecord({
      cue,
      data: data || {},
      kind: 'cue',
      type: 'cue/' + cue,
      name: (meta && meta.name) || 'Cena',
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }

  // O vídeo do YouTube que já está no aparelho, ou null. É o que impede o app
  // de baixar o MESMO vídeo de novo a cada destino escolhido (tocar, playlist,
  // Cronograma) — um download de dezenas de MB repetido por engano, em rede de
  // celular, no meio de um culto.
  //
  // `getAllKeys` no índice devolve só as chaves primárias: nenhum blob é
  // desserializado para responder a pergunta. Entre vários registros do mesmo
  // vídeo (o link importado como item de player e o arquivo baixado depois),
  // ganha o que tem BLOB — é ele que toca em segundo plano e não depende da
  // rede.
  // `kind` OPCIONAL (v5.112): o mesmo vídeo do YouTube pode existir aqui em
  // duas formas — o arquivo de vídeo e o de SÓ ÁUDIO —, e as duas carregam o
  // mesmo `youtubeId`. Sem o filtro, quem pediu o áudio podia receber o vídeo
  // que já estava baixado (e vice-versa), o que é justamente o contrário do que
  // o operador escolheu. Omitido, o comportamento é o de sempre: serve
  // qualquer forma, que é o que a marca de "já está aqui" na lista de
  // resultados quer saber.
  async function mediaByYoutube(youtubeId, kind) {
    if (!youtubeId) return null;
    const s = await store(STORE_MEDIA, 'readonly');
    const ids = await asPromise(s.index('youtubeId').getAllKeys(IDBKeyRange.only(youtubeId)));
    if (!ids || !ids.length) return null;
    let recs = (await Promise.all(ids.map((id) => getMedia(id)))).filter(Boolean);
    if (kind) recs = recs.filter((r) => r.kind === kind);
    return recs.find((r) => r.blob) || recs[0] || null;
  }
  // Item de URL externa (sem blob local); kind pode ser 'image','video','audio','youtube'.
  async function addUrlMedia(url, meta) {
    const record = makeMediaRecord({
      url,
      thumb: (meta && meta.thumb) || null,
      type: (meta && meta.type) || 'url/unknown',
      kind: (meta && meta.kind) || 'url',
      name: (meta && meta.name) || url,
      youtubeId: (meta && meta.youtubeId) || null,
    });
    return addMediaToList(record, (meta && meta.list) || 'imports');
  }
  // Busca em "media" e, se não achar, no catálogo OPFS "files" — assim um id
  // de arquivo sincronizado pode entrar em listas/pastas e tocar no Display
  // sem cópia temporária.
  async function getMedia(id) {
    const s = await store(STORE_MEDIA, 'readonly');
    const rec = await asPromise(s.get(id));
    if (rec) return rec;
    return fileGet(id);
  }
  // REMOVIDAS na v5.48: `storeUrlTemp`, `storeMediaTemp` e `deleteMedia`.
  // As duas primeiras gravavam em "media" SEM entrar em lista nenhuma, e o
  // comentário da terceira dizia que servia "para limpar temp de pastas
  // vinculadas" — pastas vinculadas não existem mais (foram substituídas pelas
  // pastas OPFS, sincronizadas por syncDeviceFolder/fileAdd), e as três não
  // tinham um único chamador em toda a base. Pior que código morto: quem lesse
  // o comentário concluiria que existe um caminho de limpeza de temporários
  // (não existe — o gc só roda dentro de `listRemove`), e voltar a usá-las
  // criaria registros que NENHUM gc alcança, ou seja, vazamento permanente no
  // IDB. Quem precisar de um registro de mídia usa `addMedia`/`addUrlMedia`,
  // que já entram numa lista e portanto são coletáveis.
  async function renameMedia(id, name) {
    // get + put na mesma transação para garantir atomicidade (o await entre os
    // dois mantém a transação viva pois ambos são requests IDB encadeados).
    const [s, tx] = await storeTx(STORE_MEDIA, 'readwrite');
    const record = await asPromise(s.get(id));
    if (record) {
      record.name = name;
      await asPromise(s.put(record));
      return txDone(tx);
    }
    // Registro do catálogo OPFS: renomeia só o nome de exibição (o path fica).
    const [fs, ftx] = await storeTx(STORE_FILES, 'readwrite');
    const f = await asPromise(fs.get(id));
    if (!f) return;
    f.name = name;
    await asPromise(fs.put(f));
    return txDone(ftx);
  }

  // ---- catálogo OPFS (store "files") ----
  async function fileAdd(record) {
    const s = await store(STORE_FILES, 'readwrite');
    return asPromise(s.put(record));
  }
  async function fileGet(id) {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.get(id));
  }
  async function fileDelete(id) {
    const s = await store(STORE_FILES, 'readwrite');
    return asPromise(s.delete(id));
  }
  async function filesByFolder(folder) {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.index('folder').getAll(folder));
  }
  async function filesAll() {
    const s = await store(STORE_FILES, 'readonly');
    return asPromise(s.getAll());
  }

  // ---- OPFS (Origin Private File System) ----
  // Os bytes dos arquivos sincronizados moram aqui; nunca pedem permissão e
  // são visíveis para os dois PWAs (mesmo origin). Paths no formato "a/b/c.mp4".
  function opfsSupported() {
    return !!(navigator.storage && navigator.storage.getDirectory);
  }
  function splitPath(path) {
    return String(path).split('/').filter(Boolean);
  }
  async function opfsDir(parts, create) {
    let dir = await navigator.storage.getDirectory();
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: !!create });
    return dir;
  }
  async function opfsGetFile(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    const dir = await opfsDir(parts, false);
    const fh = await dir.getFileHandle(name);
    return fh.getFile();
  }
  async function opfsWriteFile(path, blob) {
    const parts = splitPath(path);
    const name = parts.pop();
    const dir = await opfsDir(parts, true);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  }
  async function opfsDeleteFile(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    try {
      const dir = await opfsDir(parts, false);
      await dir.removeEntry(name);
    } catch (_) {}
  }
  async function opfsDeleteDir(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    try {
      const dir = await opfsDir(parts, false);
      await dir.removeEntry(name, { recursive: true });
    } catch (_) {}
  }

  // ---- listas ----
  async function listIds(name) {
    let ids = await getState(name);
    // Migração: "imports" herda o antigo "order".
    if (ids == null && name === 'imports') ids = await getState('order');
    return Array.isArray(ids) ? ids.slice() : [];
  }
  // Duas formas, e a diferença entre elas é atomicidade:
  //
  //   listSet(name, [ids])   grava o array como veio. O chamador leu a lista
  //                          ANTES, fora de transação, então é um
  //                          read-modify-write partido: um `listAdd` que
  //                          commite entre a leitura e esta escrita é perdido
  //                          (o item some da lista, e o registro que
  //                          `addMediaToList` criou em "media" fica órfão para
  //                          sempre — nunca esteve em lista nenhuma, e o gc só
  //                          roda dentro de `listRemove`). Hoje isso não
  //                          acontece: nenhum escritor de fundo mexe em listas
  //                          (a sincronização usa `fileAdd`). É fragilidade
  //                          estrutural, não defeito em operação — mas o
  //                          primeiro escritor de fundo que alguém acrescentar
  //                          sobre `listAdd` a transforma em perda de item.
  //
  //   listSet(name, fn)      forma ATÔMICA: `fn(listaAtual)` roda dentro da
  //                          MESMA transação de "state" que grava o resultado,
  //                          igual ao `listAdd`. `fn` precisa ser SÍNCRONA —
  //                          um await dentro dela deixaria a transação
  //                          autocommitar antes do `put`.
  //
  // Prefira a forma com função ao escrever código novo (ex.: reordenar é
  // `listSet(name, (ids) => …)` em vez de ler, mexer e devolver o array).
  async function listSet(name, ids) {
    if (typeof ids !== 'function') return setState(name, ids);
    const [s, tx] = await storeTx(STORE_STATE, 'readwrite');
    const next = ids(await readListIn(s, name));
    await asPromise(s.put(Array.isArray(next) ? next : [], name));
    return txDone(tx);
  }
  async function listItems(name) {
    const ids = await listIds(name);
    if (ids.length === 0) return [];
    // Busca todos os registros em paralelo (uma transação por get, mas sem sequencialização desnecessária).
    const records = await Promise.all(ids.map((id) => getMedia(id)));
    // Preserva a ordem da lista e descarta ids que não têm mais registro.
    return records.filter(Boolean);
  }
  async function listHas(name, id) {
    return (await listIds(name)).includes(id);
  }
  // Read-modify-write atômico: lê a lista, grava a versão modificada e só
  // então commita, tudo numa transação de "state" — evita o lost update de
  // duas escritas concorrentes (ex: share sendo processado + reordenação).
  async function listAdd(name, id) {
    const [s, tx] = await storeTx(STORE_STATE, 'readwrite');
    const ids = await readListIn(s, name);
    if (ids.includes(id)) return;
    ids.push(id);
    await asPromise(s.put(ids, name));
    await txDone(tx);
  }
  // TODOS os detentores de referência a um id de "media" — a pergunta que o gc
  // precisa acertar antes de destruir um blob.
  //
  // Até a v5.48 o gc só olhava LISTS, e os Favoritos ficaram de fora: o
  // Controle guarda cada atalho em `state['folder_<id>']` (índice dos atalhos
  // em `state['folders']`), que são listas de ids de mídia como qualquer
  // outra, só que em chaves que o gc não conhecia. O resultado era destrutivo
  // e silencioso: importar um vídeo, adicioná-lo a um Favorito e depois
  // excluí-lo do Cronograma apagava o BLOB — o Favorito continuava com o id,
  // `getMedia` devolvia undefined, o `filter(Boolean)` do Controle descartava
  // sem avisar e o item sumia do atalho para sempre (um blob importado não
  // existe em lugar nenhum além do IDB).
  //
  // Roda DENTRO da transação de quem chamou (recebe o objectStore de "state"
  // já aberto), porque a decisão de apagar precisa enxergar o mesmo instante
  // da remoção — ver o TOCTOU descrito em listRemove.
  //
  // NOTA para quem acrescentar um detentor novo: qualquer chave de `state` que
  // passe a guardar ids de mídia precisa entrar AQUI. É este o ponto único.
  async function isReferenced(stateStore, id, exceptList) {
    for (const l of LISTS) {
      if (l === exceptList) continue;
      const ids = await readListIn(stateStore, l);
      if (ids.includes(id)) return true;
    }
    const folders = await asPromise(stateStore.get('folders'));
    if (Array.isArray(folders)) {
      for (const f of folders) {
        if (!f || f.id == null) continue;
        const ids = await readListIn(stateStore, 'folder_' + f.id);
        if (ids.includes(id)) return true;
      }
    }
    return false;
  }
  // Remoção + gc na MESMA transação (state + media): sem isso, um listAdd
  // concorrente entre a remoção e a checagem do gc poderia re-referenciar o
  // id e o gc apagaria o blob mesmo assim (TOCTOU).
  async function listRemove(name, id) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    const before = await readListIn(st, name);
    const after = before.filter((x) => x !== id);
    if (after.length === before.length) return; // não estava na lista
    await asPromise(st.put(after, name));
    // gc: o id ainda está referenciado em algum outro lugar (outra lista ou um
    // Favorito)? `name` é excluído da varredura porque acabou de sair dela.
    if (!(await isReferenced(st, id, name))) await asPromise(tx.objectStore(STORE_MEDIA).delete(id));
    await txDone(tx);
  }
  // Apaga um ATALHO inteiro (`folders` + `folder_<id>`), coletando o que ficar
  // sem dono. Numa transação só, e pela mesma `isReferenced` de todo o resto.
  //
  // ISTO ERA UM VAZAMENTO SILENCIOSO até a v5.103. O Controle apagava o atalho
  // com dois `setState` crus — tirava a entrada de `folders` e gravava a lista
  // vazia — e nada mais acontecia: uma mídia cujo ÚLTIMO detentor era aquele
  // atalho virava um registro que nenhuma lista aponta e que NENHUM gc alcança
  // (o gc só roda dentro de `listRemove`). O blob ficava no IndexedDB para
  // sempre, invisível na tela e sem caminho de limpeza — um vídeo de centenas
  // de MB "sumia" e continuava ocupando o disco do aparelho.
  //
  // A ordem importa: o atalho sai de `folders` ANTES da varredura, senão
  // `isReferenced` o encontraria no índice e ele seguraria os próprios ids.
  async function folderDrop(folderId) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    const key = 'folder_' + folderId;
    const ids = await readListIn(st, key);
    const folders = await asPromise(st.get('folders'));
    const restantes = Array.isArray(folders) ? folders.filter((f) => f && f.id !== folderId) : [];
    await asPromise(st.put(restantes, 'folders'));
    await asPromise(st.delete(key));
    const ms = tx.objectStore(STORE_MEDIA);
    for (const id of ids) {
      if (!(await isReferenced(st, id, null))) await asPromise(ms.delete(id));
    }
    await txDone(tx);
  }

  // Apaga o blob se não estiver referenciado por lista nem por Favorito.
  // HOJE NÃO TEM CHAMADOR: a remoção normal (listRemove) já coleta na própria
  // transação. Fica como válvula avulsa — e usa a MESMA `isReferenced` de
  // propósito, para que um detentor novo não precise ser lembrado em dois
  // lugares (foi essa duplicação que deixou os Favoritos de fora do gc).
  async function gc(id) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    if (await isReferenced(st, id, null)) return; // referenciado — não apaga
    await asPromise(tx.objectStore(STORE_MEDIA).delete(id));
    await txDone(tx);
  }

  // ---- canal de comandos ----
  // No navegador: só BroadcastChannel, como sempre.
  //
  // No app nativo: os dois WebViews (Controle e Display) são same-origin no
  // mesmo processo, então BroadcastChannel *deve* funcionar — mas o
  // isolamento de sites do WebView pode surpreender, e uma falha aí derrubaria
  // o comando do telão no meio de um culto. Em vez de detectar (handshake com
  // janela de corrida), o relay nativo (window.__AVBus, ver shared/native.js)
  // roda SEMPRE em paralelo: cada comando sai pelos dois caminhos e a cópia
  // repetida é descartada aqui pelo `__mid`. O resto do sistema não sabe de
  // nada — sendCommand/onCommand mantêm exatamente a mesma assinatura.
  const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;
  const bus = global.__AVBus || null;

  // Identidade de mensagem: origem única desta página + contador. Só é usada
  // quando há relay (no navegador nenhum campo extra é adicionado).
  const MID_PREFIX = Math.random().toString(36).slice(2, 8);
  let midSeq = 0;

  // Janela de deduplicação: os ids vistos recentemente. O comando mais
  // frequente (display-status) roda a 2 Hz, então algumas centenas de ids
  // cobrem com folga qualquer diferença de latência entre os dois caminhos.
  const seenMids = new Set();
  const MID_LIMIT = 400;

  function alreadySeen(mid) {
    if (!mid) return false;
    if (seenMids.has(mid)) return true;
    seenMids.add(mid);
    if (seenMids.size > MID_LIMIT) {
      // Set preserva ordem de inserção: descarta os mais antigos.
      const drop = seenMids.size - MID_LIMIT;
      let i = 0;
      for (const old of seenMids) {
        if (i++ >= drop) break;
        seenMids.delete(old);
      }
    }
    return false;
  }

  function sendCommand(command) {
    if (bus) {
      // Marca a mensagem para o outro lado poder deduplicar as duas cópias.
      command.__mid = MID_PREFIX + ':' + (++midSeq);
      bus.post(command);
    }
    if (channel) channel.postMessage(command);
  }

  // Uma ÚNICA assinatura dos dois caminhos, com a lista de handlers por cima.
  //
  // O motivo é o `alreadySeen`, que TESTA E MARCA na mesma chamada: até a
  // v5.48 cada `onCommand` criava seu próprio `deliver`, e todos
  // compartilhavam o mesmo conjunto de mids. Com dois listeners na mesma
  // página, o `deliver` do primeiro marcava o mid e o do segundo via a
  // mensagem como repetida — o segundo listener NUNCA receberia nada. E só no
  // app nativo: no navegador não há `bus`, não há `__mid`, e os dois
  // funcionariam. Um recurso testado no navegador que para de funcionar no
  // aparelho é o pior modo de falhar deste projeto.
  //
  // Hoje há exatamente um `onCommand` por página (controle.js e display.js),
  // então a armadilha estava latente — e é justamente por isso que ela seria
  // descoberta tarde, por quem só quisesse observar `display-status` num
  // módulo novo.
  const cmdHandlers = [];
  let cmdSubscribed = false;

  function deliverCommand(msg) {
    if (!msg) return;
    // Deduplica UMA vez por MENSAGEM (as duas cópias do relay), não uma vez
    // por listener.
    if (bus && alreadySeen(msg.__mid)) return;
    // Cópia da lista: um handler que registre outro durante a entrega não
    // altera a rodada em curso.
    for (const fn of cmdHandlers.slice()) {
      // Um handler que lança não pode calar os demais — no telão isso
      // significaria perder o comando seguinte no meio de um culto.
      try { fn(msg); } catch (e) { console.error('[AVDB] handler de comando falhou', e); }
    }
  }

  function onCommand(handler) {
    cmdHandlers.push(handler);
    if (cmdSubscribed) return;
    cmdSubscribed = true;
    if (channel) channel.addEventListener('message', (e) => deliverCommand(e.data));
    if (bus) bus.recv(deliverCommand);
  }

  // `openDB` saiu da superfície pública na v5.48: não tinha chamador fora
  // daqui, e expor a conexão crua convida a montar transações por fora dos
  // helpers — que é exatamente onde mora a atomicidade deste arquivo.
  global.AVDB = {
    setState, getState, stateKeys,
    addMedia, addUrlMedia, addStreamMedia, setMediaStream, addDeck, addCue,
    getMedia, mediaByYoutube, renameMedia,
    listIds, listSet, listItems, listHas, listAdd, listRemove, gc, folderDrop,
    fileAdd, fileGet, fileDelete, filesByFolder, filesAll,
    opfsSupported, opfsGetFile, opfsWriteFile, opfsDeleteFile, opfsDeleteDir,
    kindFromType, sendCommand, onCommand,
  };
})(this);
