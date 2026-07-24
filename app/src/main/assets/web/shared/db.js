// Camada de dados compartilhada entre os dois PWAs (Controle e Display).
// Mesmo domínio/origin => compartilham IndexedDB, OPFS e BroadcastChannel.
//
// Modelo:
//   - store "media": blobs importados (imagens/vídeos/áudios) e itens de URL.
//   - store "files": catálogo dos arquivos guardados no OPFS (só metadados +
//     thumbnail; os bytes ficam no Origin Private File System).
//   - listas (em "state"): "imports", "playlist" = arrays de ids.
//   - um blob de "media" só é apagado quando não está em NENHUMA lista (gc);
//     registros de "files" pertencem à sua pasta OPFS e não passam pelo gc.
//
// Exposto como window.AVDB.

(function (global) {
  'use strict';

  const DB_NAME = 'av-iasd';
  const DB_VERSION = 2;
  const STORE_MEDIA = 'media';
  const STORE_STATE = 'state';
  const STORE_FILES = 'files';
  const CHANNEL_NAME = 'av-iasd';
  const LISTS = ['imports', 'playlist'];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const fs = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
          fs.createIndex('folder', 'folder');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
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
  async function addMedia(blob, meta) {
    const type = (meta && meta.type) || blob.type;
    const record = makeMediaRecord({
      blob,
      type,
      kind: (meta && meta.kind) || kindFromType(type),
      thumb: (meta && meta.thumb) || null,
      name: (meta && meta.name) || 'sem-nome',
    });
    return addMediaToList(record, 'imports');
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
    return addMediaToList(record, 'imports');
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
  // Armazena um registro de URL temporário sem blob e sem adicioná-lo a nenhuma lista.
  async function storeUrlTemp(urlStr, meta) {
    const record = makeMediaRecord({
      url: urlStr,
      thumb: (meta && meta.thumb) || null,
      type: (meta && meta.type) || 'audio/mpeg',
      kind: (meta && meta.kind) || 'audio',
      name: (meta && meta.name) || 'sem-nome',
    });
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));
    return record;
  }
  // Armazena um blob temporário sem adicioná-lo a nenhuma lista (para pastas vinculadas).
  async function storeMediaTemp(blob, meta) {
    const record = makeMediaRecord({
      blob,
      type: blob.type,
      kind: (meta && meta.kind) || kindFromType(blob.type),
      thumb: (meta && meta.thumb) || null,
      name: (meta && meta.name) || 'sem-nome',
    });
    const s = await store(STORE_MEDIA, 'readwrite');
    await asPromise(s.add(record));
    return record;
  }
  // Exclui diretamente um registro de mídia pelo ID (usado para limpar temp de pastas vinculadas).
  async function deleteMedia(id) {
    const s = await store(STORE_MEDIA, 'readwrite');
    return asPromise(s.delete(id));
  }
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
  async function listSet(name, ids) {
    return setState(name, ids);
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
    // gc: o id ainda está referenciado por ALGUMA outra lista?
    let referenced = false;
    for (const l of LISTS) {
      if (l === name) continue; // acabou de sair desta
      const other = await readListIn(st, l);
      if (other.includes(id)) { referenced = true; break; }
    }
    if (!referenced) await asPromise(tx.objectStore(STORE_MEDIA).delete(id));
    await txDone(tx);
  }
  // Apaga o blob se não estiver referenciado por nenhuma lista. Mantido para
  // uso avulso; a remoção normal (listRemove) já coleta na própria transação.
  async function gc(id) {
    const db = await openDB();
    const tx = db.transaction([STORE_STATE, STORE_MEDIA], 'readwrite');
    const st = tx.objectStore(STORE_STATE);
    for (const l of LISTS) {
      const ids = await readListIn(st, l);
      if (ids.includes(id)) return; // referenciado — não apaga
    }
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

  function onCommand(handler) {
    const deliver = (msg) => {
      if (!msg) return;
      if (bus && alreadySeen(msg.__mid)) return;
      handler(msg);
    };
    if (channel) channel.addEventListener('message', (e) => deliver(e.data));
    if (bus) bus.recv(deliver);
  }

  global.AVDB = {
    openDB, setState, getState,
    addMedia, addUrlMedia, getMedia, storeUrlTemp, storeMediaTemp, deleteMedia, renameMedia,
    listIds, listSet, listItems, listHas, listAdd, listRemove, gc,
    fileAdd, fileGet, fileDelete, filesByFolder, filesAll,
    opfsSupported, opfsGetFile, opfsWriteFile, opfsDeleteFile, opfsDeleteDir,
    kindFromType, sendCommand, onCommand,
  };
})(this);
