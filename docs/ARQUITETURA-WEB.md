# Claude Code — Audio Visual IASD

A **base web** do sistema de projeção de mídia para culto (IASD): duas telas no
mesmo origin — **Controle** (celular do operador) e **Display** (o telão) — em
JavaScript puro, sem frameworks nem dependências de build. Funciona 100%
offline.

> Este documento cobre **só a base web** (`app/src/main/assets/web/`). A casca
> Android que a hospeda — Presentation, ponte `AVNative`, SAF, OTA, serviço de
> segundo plano — está em [`../CLAUDE.md`](../CLAUDE.md).

## Índice

1. [Regra obrigatória após qualquer alteração](#regra-obrigatória-após-qualquer-alteração) — fluxo de git/merge
2. [Regras de desenvolvimento](#regras-de-desenvolvimento) — invariantes do projeto
3. [A ideia](#a-ideia-duas-telas-um-só-estado) — duas telas, um só estado
4. [Estrutura de arquivos](#estrutura-de-arquivos)
5. [Modelo de dados (`shared/db.js`)](#modelo-de-dados-shareddbjs) — IDB, OPFS, BroadcastChannel
6. [Motor de renderização (`shared/stage.js`)](#motor-de-renderização-sharedstagejs) — cortina, fades, concorrência
7. [Controle](#controle) — layout, mixer, biblioteca, coleções (LouvorJA), letra sincronizada
8. [Display](#display) — wallpaper, YouTube, recuperação de áudio
9. [Design System (padrões visuais / CSS)](#design-system-padrões-visuais--css) — **tokens de cor/medida/método**
10. [Como esta base é servida](#como-esta-base-é-servida)
11. [Fonte de ícones (Material Symbols)](#fonte-de-ícones-material-symbols)
12. [Build, distribuição e instalação](#build-distribuição-e-instalação)

---

## Regra obrigatória após qualquer alteração

**Sempre fazer merge com `main` ao finalizar qualquer atualização nos arquivos.**

Fluxo padrão:
```bash
# 1. Desenvolver na branch designada
git add <arquivos>
git commit -m "mensagem descritiva"
git push -u origin <branch>

# 2. Merge obrigatório para main
git checkout main
git merge <branch> --no-ff -m "Merge: <descrição resumida>"
git push origin main
```

---

## Regras de desenvolvimento

- **Contexto de execução fixo: as duas telas SEMPRE rodam dentro do app
  Android**, em dispositivo móvel — o Controle no celular do operador, o
  Display numa `Presentation` na TV. Não projetar nem otimizar para aba de
  navegador ou desktop: decisões de UX/autoplay/layout assumem esse contexto.
  Rodar no navegador continua sendo obrigatório (é como se desenvolve e testa
  fora do aparelho), mas não é o alvo do desenho.
- Nunca perder funcionalidades existentes ao refatorar.
- **Seleção de texto desligada globalmente nos dois apps** (`user-select:
  none !important` + `-webkit-touch-callout: none` +
  `-webkit-tap-highlight-color: transparent` no seletor `*`, em
  `controle.css`/`display.css`) — nenhum dos dois é um documento de texto; um
  toque comprido em botão/linha/telão não deve abrir menu de seleção/copiar. O
  `!important` é necessário porque a UA stylesheet do navegador tem
  especificidade maior que `*` e podia reativar a seleção em algum elemento no
  aparelho. Única exceção: `input, textarea` no Controle (`user-select: text
  !important`, que vence o `*` pela maior especificidade) — os campos de busca
  (`#libSearch`/`#hymnSearchInput`) precisam continuar editáveis/selecionáveis.
- Toda operação IDB multi-passo que precise de atomicidade deve usar `storeTx()`.
- Não introduzir dependências externas — JavaScript puro no cliente, Kotlin puro + AndroidX oficial no shell. (Exceção já existente: Display **e** Controle carregam a IFrame Player API oficial do YouTube via `<script src="https://www.youtube.com/iframe_api">` em runtime — não é dependência de build/npm, e o recurso YouTube já depende de rede/youtube.com para tocar o vídeo mesmo sem essa API. O Controle usa isso para a preview de vídeos do YouTube — ver seção do YouTube.)
- Ao atualizar o código, atualizar este documento se a mudança afetar arquitetura, protocolo de comandos ou API pública. Mudanças no shell (Kotlin) vão em `../CLAUDE.md`.
- **Todo código novo precisa continuar rodando no navegador.** Caminhos
  específicos do nativo entram sempre como `if (!window.__NATIVE__) { …web… }`
  — nunca o inverso: o comportamento de navegador é o padrão, e o nativo é a
  exceção que se declara. Os pontos onde os dois divergem (autoplay, pastas do
  dispositivo, compartilhamento, fullscreen, atualização) estão tabelados em
  `../CLAUDE.md`, "Divergências entre o caminho web e o nativo".
- **A cada atualização de código, incrementar a versão visual do Controle** em
  **três lugares que precisam bater**: a constante `WEB_VERSION` em
  `controle/controle.js` (é ela que o cabeçalho renderiza — ver
  `renderVersionLabel()`), o fallback estático do `<span id="appVersion">` em
  `controle/index.html` e `version` em `version.json` (é este último que
  dispara a atualização por OTA nos aparelhos). Versionamento incremental
  simples (5.26, 5.27, 5.28…). **Versão atual: v5.28.**
  No app nativo o rótulo mostra os **dois índices** — `Web v5.17 · Shell v1.18`
  —, porque base web e shell atualizam por caminhos independentes (OTA ×
  instalar APK); no navegador sai só `Controle v5.28`.

---

## A ideia: duas telas, um só estado

O sistema é **duas telas** — o **Controle** (celular do operador) e o
**Display** (o telão) — que rodam no **mesmo origin** e por isso compartilham:

- **IndexedDB** — metadados, listas e blobs importados, visíveis pelas duas.
- **OPFS** (Origin Private File System) — bytes dos arquivos sincronizados de
  pastas do dispositivo; acesso permanente, sem prompts de permissão.
- **BroadcastChannel** (`av-iasd`) — o Controle envia comandos em tempo real
  para o Display.

**Onde cada uma roda:** no aparelho, o shell nativo abre as duas em WebViews do
mesmo processo/origin — o Controle na Activity e o Display numa
`android.app.Presentation`, que vai **só ele** para a TV. No navegador (só para
desenvolver) são duas páginas, `/controle/` e `/display/`.

> **De onde isso veio.** A arquitetura nasceu como **dois PWAs instaláveis**,
> porque o Miracast só espelha a tela inteira do celular e a única saída era
> instalar o Display como app separado para espelhar apenas ele. A
> `Presentation` resolveu isso de verdade, e os andaimes daquele modelo
> (`manifest.json`, ícones de WebAPK, service workers, a página com os dois
> links) **foram removidos** — ver CLAUDE.md, "Andaimes do modelo de dois
> PWAs". O que ficou é justamente o que era bom: mesmo origin, IDB/OPFS/
> BroadcastChannel compartilhados e um protocolo de comandos que não mudou.

Tudo funciona **100% offline** — os arquivos vêm do APK (ou do bundle OTA já
baixado) —, exceto o que depende de rede por natureza: vídeos do YouTube,
itens de URL externa e a primeira sincronização do acervo LouvorJA.

---

## Estrutura de arquivos

```
app/src/main/assets/web/
├── version.json                # identidade do bundle OTA (version + minShell)
├── shared/
│   ├── native.js               # ponte AVNative (só existe no app; no-op no navegador)
│   ├── db.js                   # Camada comum: IndexedDB + OPFS + BroadcastChannel (+ relay nativo)
│   ├── stage.js                # Motor de renderização compartilhado
│   ├── material-symbols.css    # Font-face da fonte de ícones (subset offline; só o Controle usa)
│   └── fonts/
│       └── material-symbols.woff2  # ~3.2 KB — 30 glifos
├── controle/
│   ├── index.html              # UI do operador
│   ├── controle.css            # Estilos do Controle
│   ├── controle.js             # Lógica do Controle
│   ├── louvorja.js             # Cliente da API pública do LouvorJA (Coleções de mídia — ver seção própria)
│   └── bible.js                # Cliente da parte bíblica do banco LouvorJA (livros/versões/capítulos — ver seção "Bíblia")
└── display/
    ├── index.html              # UI do Display (inclui iframe #youtube)
    ├── display.css             # Estilos do Display
    └── display.js              # Lógica do Display
docs/
└── FONTE-DE-DADOS-LOUVORJA.md  # Referência técnica do banco compartilhado (app-ja/LouvorJA)
```

Sem `manifest.json`, sem `icons/`, sem `sw.js` e sem `server.js`: ícone, nome e
orientação vêm do APK, os arquivos são locais por natureza e a atualização é
por OTA (ver "Como esta base é servida").

---

## Modelo de dados (`shared/db.js`)

### IndexedDB — banco `av-iasd` v2

| Object Store | Chave | Conteúdo |
|---|---|---|
| `media` | `id` (UUID) | `{ id, blob, url, thumb, type, kind, name, youtubeId, createdAt }` |
| `files` | `id` (UUID), índice `folder` | catálogo OPFS: `{ id, folder, opfsPath, srcName, name, type, kind, size, mtime, thumb, addedAt }` |
| `state` | chave string | valor arbitrário (listas, estado atual, pastas, transições…) |

Um registro de mídia tem **`blob`, `url` OU `opfsPath`** (nunca mais de um):
blobs locais importados, itens de URL externa (link direto, YouTube) ou
arquivos sincronizados no OPFS. `thumb` pode ser um `Blob`
(miniatura gerada via Canvas) ou uma **string URL** (ex: thumbnail
`hqdefault.jpg` do YouTube).

> **Atenção:** qualquer código que abra o banco fora de `db.js` (ex:
> `storePendingShare` no SW do Controle) deve usar `indexedDB.open('av-iasd')`
> **sem número de versão**, para não quebrar com `VersionError` quando o schema
> for atualizado. **Porém** esse open sem versão precisa de um
> `onupgradeneeded` que crie ao menos o store `state`: numa **instalação
> nova** (share recebido ANTES da 1ª abertura do app) o banco ainda não
> existe e nasceria sem nenhum object store, fazendo o `transaction('state')`
> lançar `NotFoundError` e perder o share silenciosamente. O `db.js` completa
> o schema (media/files) no upgrade 1→2 seguinte, que checa
> `if (!contains(...))` — sem conflito com o store criado pelo SW.

### OPFS + catálogo (`files`)

Os **bytes** dos arquivos de pastas sincronizadas moram no **OPFS**
(`navigator.storage.getDirectory()`), em `folders/<folderId>/<arquivo>`. O
store `files` do IDB guarda apenas **metadados + thumbnail** — por isso listar
e buscar centenas de arquivos é instantâneo (nunca toca o disco); o arquivo só
é aberto na hora de reproduzir (`opfsGetFile` → `URL.createObjectURL`).

- OPFS pertence ao origin: **nenhuma permissão é pedida** para ler — nem no
  Controle, nem no Display (mesmo origin ⇒ mesmo OPFS).
- `getMedia(id)` procura em `media` e cai para `files` — assim IDs do catálogo
  entram em `playlist`/`imports`/pastas virtuais **sem copiar bytes**.
- O `gc()` das listas só apaga do store `media`; registros de `files`
  pertencem à sua pasta OPFS e só são removidos pela exclusão na pasta.
- `renameMedia` cobre os dois stores (no catálogo, renomeia só a exibição;
  o `opfsPath` não muda).

**Duas listas nomeadas** (arrays de IDs guardados em `state`): `imports`, `playlist`.
Migração: `imports` herda o antigo state `order` se `imports` ainda não existir.
(A antiga lista `favorites` foi removida — ver legado nas chaves de `state`.)

O campo `kind` é derivado do `type` (ou definido pelo chamador para itens de URL):

| Origem | `kind` |
|---|---|
| `type` começa com `image/` | `'image'` |
| `type` começa com `video/` | `'video'` |
| `type` começa com `audio/` | `'audio'` |
| link do YouTube | `'youtube'` |
| URL sem extensão reconhecida | `'url'` |
| outro | `'other'` |

### Chaves de `state` em uso

| Chave | Conteúdo |
|---|---|
| `imports` / `playlist` | arrays de IDs de mídia |
| `current` | `{ mediaId, view, muted, volume, at }` — estado de exibição atual. O `mediaId` é **limpo na abertura** (`clearCurrentSelection`): sessão nova começa com o player vazio; volume/mudo/cortina ficam, que são o ajuste da mesa e não uma seleção |
| `repeat` | `'off'` \| `'all'` \| `'one'` \| `'shuffle'` |
| `fade` | legado — as transições visuais (fade in/out) viraram **inerentes ao sistema** (`createStage.FADE`, fixo em `{in:true, out:true, time:0.6}` e compartilhado pelos dois apps, não configurável); esta chave **não é mais lida nem gravada** (fica ignorada se existir de versões antigas). Fade em toda troca visual: mídia, cortina do wallpaper (view toggle), letra e texto bíblico |
| `fit` | `'contain'` \| `'cover'` \| `'fill'` — preenchimento da mídia (ajustar/preencher/esticar) no Display e na preview |
| `lyricsBg` | `'black'` (padrão) \| `'image'` — fundo atrás da letra sincronizada: preto ou as imagens dos slides |
| `wallpaper` | `Blob` da imagem escolhida para a cortina do telão, ou ausente/`null` = gradiente padrão (ver "Wallpaper personalizado") |
| `folders` | `[{ id, name }]` — pastas virtuais |
| `folder_<id>` | array de IDs de mídia da pasta |
| `messages` | `[{ id, text }]` — mensagens de texto puro da aba Mensagens (ver "Camada de Texto") |
| `opfs-folders` | `[{ id, name, count, syncedAt, handle? }]` — pastas sincronizadas no OPFS (`handle` acelera re-sync) |
| `coll:<id>` | `{ indexSyncedAt, songs: [{ id_music, track, name, duration, has_instrumental_music, fileIdFull, fileIdPlayback }] }` — índice offline de UMA coleção do LouvorJA (`coll:hymnal-2022`, `coll:hymnal-1996`, `coll:album-<id>`) — ver "Coleções de mídia (LouvorJA)" |
| `albumCatalog` | `{ categories: [{ id_category, name, order, albums: [{ id_album, subtitle, order }] }], albums: [{ id_album, name, color }] }` — a hierarquia categoria → álbum de `pt_categories` (ver "Classificação" nas Coleções). Formato antigo (array achatado) é migrado na leitura |
| `bibleVersions` | `[{ id, name }]` — versões/traduções da Bíblia (de `pt_bible_version`), baixadas na 1ª vez — ver "Bíblia" |
| `bibleBooks` | `[{ id, name }]` — livros da Bíblia (de `pt_bible_book`) para casar o `id_bible_book` real; a estrutura de exibição (abreviações/nº de capítulos) é offline em `bible.js` |
| `bibleVersion` | id da versão da Bíblia selecionada pelo operador |
| `bible:<v>_<b>_<c>` | `{ verses: [{ n, text }], syncedAt }` — texto de UM capítulo (`bible_{v}_{b}_{c}`); a versão inteira é baixada na 1ª vez que a aba é usada (e cada capítulo também sob demanda como fallback) |
| `bibleComplete:<v>` | `true` quando a versão `<v>` foi baixada por completo (todos os capítulos) — evita refazer o download em massa |
| `hymnal2022` | legado — migrado para `coll:hymnal-2022` no `loadCollections()` (a chave antiga permanece, ignorada) |
| `pending-share` | `{ files, url, title, ts }` — share recebido pelo SW aguardando processamento |
| `order` | legado — lido apenas como fallback de `imports` |
| `favorites` | legado (recurso de favoritos removido) — array de IDs; não é mais lido nem gravado, ignorado |
| `linked-folders` | legado (pastas vinculadas por handle) — substituído por `opfs-folders`; ignorado |
| `louvorja-token` / `louvorja-hymnal` | legado (hinário online removido na v2.5); ignorados |

### API exposta (`window.AVDB`)

```js
openDB, setState, getState
stateKeys(prefix)             // chaves de `state` com esse prefixo, numa transação
                              // só e SEM ler valor nenhum — teste de presença em massa
addMedia(blob, meta)          // cria registro + adiciona a 'imports'
addUrlMedia(url, meta)        // item de URL externa (blob=null) + adiciona a 'imports'
storeUrlTemp(url, meta)       // registro temporário de URL, fora de qualquer lista
storeMediaTemp(blob, meta)    // blob temporário fora de listas (pastas vinculadas)
getMedia(id), deleteMedia(id), renameMedia(id, name)
listIds, listSet, listItems, listHas, listAdd, listRemove, gc
fileAdd, fileGet, fileDelete, filesByFolder, filesAll   // catálogo OPFS
opfsSupported, opfsGetFile, opfsWriteFile,              // Origin Private
opfsDeleteFile, opfsDeleteDir                           // File System
kindFromType, sendCommand, onCommand
```

#### Garbage collection de blobs

Um registro só é excluído automaticamente quando **não está em nenhuma das duas listas** (`imports`/`playlist`):

```
listRemove(listName, id)
  → se id não aparece em nenhuma outra lista → delete no store media (gc)
```

**Atomicidade (transação única):** `listAdd`, `listRemove` (com o gc embutido)
e `addMedia`/`addUrlMedia` (registro + entrada na lista) fazem o
read-modify-write dentro de **uma só transação IDB** — não em transações
separadas. Sem isso havia dois defeitos: (a) *lost update* — duas escritas
concorrentes (ex: share sendo processado + reordenação) liam o mesmo array e
a segunda gravação sobrescrevia a primeira, perdendo um id; (b) *registro
órfão* — se o `add` em `media` completasse mas o `listAdd` falhasse, sobrava
um blob em `media` fora de qualquer lista, que o gc nunca coletaria (vaza
espaço). O gc de `listRemove` também roda na mesma transação da remoção
(state + media): checa as outras listas e só então apaga o blob, fechando o
TOCTOU em que um `listAdd` concorrente re-referenciaria o id no intervalo.
(`readListIn` lê a lista a partir de um objectStore já aberto, para reuso
dentro dessas transações; `txDone(tx)` confirma o commit.) A regra do projeto
("operação IDB multi-passo atômica usa transação única") agora é honrada por
essas funções — antes elas a violavam.

Registros **temporários** (`storeUrlTemp` / `storeMediaTemp`) não pertencem a
lista alguma — quem cria é responsável por excluí-los com `deleteMedia()`.
Sem consumidores atuais (o hinário, que usava o mecanismo, foi removido na
v2.5); a API permanece disponível.

### BroadcastChannel — canal `av-iasd`

Todos os comandos são objetos com um campo `type`.

#### Controle → Display

| `type` | Campos extras | Descrição |
|---|---|---|
| `load` | `mediaId, view, muted, volume` | Carrega e exibe uma mídia |
| `play` | — | Inicia reprodução |
| `pause` | — | Pausa |
| `seek` | `time` (segundos) | Pula para o instante indicado |
| `volume` | `volume` (0.0–1.0) | Altera o volume |
| `mute` | `muted` (bool) | Liga/desliga mudo |
| `view` | `view` (`'visual'`\|`'wallpaper'`) | Alterna entre exibir a mídia ou o wallpaper (com fade, se ativo) |
| `clear` | — | Limpa o Display (volta ao wallpaper, zera `currentId`; com fade-out, se ativo) |
| `fit` | `fit` (`'contain'`\|`'cover'`\|`'fill'`) | Atualiza ao vivo o preenchimento da mídia (ajustar/preencher/esticar) |
| `lyricsbg` | `mode` (`'black'`\|`'image'`) | Atualiza ao vivo o fundo atrás da letra sincronizada (preto ou imagens dos slides) |
| `wallpaper` | — | Avisa que a imagem do wallpaper mudou. **Sem payload**: o blob mora no state `wallpaper`, que os dois apps compartilham — o Display relê do IDB (ver "Wallpaper personalizado") |
| `text` | `main, sub, mode, view` | Projeta/atualiza a **Camada de Texto** manual (Bíblia OU Mensagem — ver "Camada de Texto"). `main`=texto principal, `sub`=referência (dourada, abaixo; vazio nas mensagens), `mode`=`'verse'`\|`'message'`. Um novo `text` troca o conteúdo em cena; `view` só liga/desliga a cortina compartilhada. **Independente do áudio**: um `text` NÃO para a mídia do stage — o áudio segue tocando por baixo |
| `text-hide` | — | Encerra a Camada de Texto (Bíblia/Mensagem) sem tocar na mídia de fundo |
| `mic` | `on` (bool) | **Microfone ao vivo** (push-to-talk): o Display abre o microfone e reproduz a voz na projeção. Camada de ÁUDIO independente — não toca na mídia, no texto nem na cortina. Enviado por `AVDB.sendCommand` direto, **nunca** por `cmd()`: a preview é o mesmo aparelho, a centímetros do microfone |
| `audio-retry` | — | Retentativa imediata de liberar o áudio bloqueado (botão de mudo do Controle no estado "sem áudio") |

#### Display → Controle

| `type` | Campos extras | Descrição |
|---|---|---|
| `display-ready` | — | Display pronto; Controle reenvia o estado atual (se estiver tocando) |
| `display-status` | `mediaId, view, muted, volume, playing, currentTime, duration, audioBlocked` | Estado do Display a cada evento de tempo/estado (`audioBlocked`: navegador bloqueou som sem gesto; o Controle avisa o operador) |
| `media-ended` | `mediaId` | Vídeo/áudio chegou ao fim |
| `mic-status` | `on`, `error` | Resultado da abertura do microfone (permissão negada, sem microfone, em uso por outro app…) |

---

## Motor de renderização (`shared/stage.js`)

`createStage(opts)` retorna um objeto com a API de reprodução. Usado pelo Display
(tela real) e pelo Controle (mini-preview sempre mudo). Suporta blobs locais,
arquivos do OPFS (`opfsPath` — resolvidos via `AVDB.opfsGetFile`, com re-checagem
de `loadSeq` após o await) e itens de URL direta (`blob=null, url=string`).
Itens `kind='youtube'` **não são reproduzidos pelo stage** — ele apenas mostra
a thumbnail no `<img>`; a reprodução real é feita externamente (iframe no
`display.js`, que também **reaproveita a cortina do wallpaper deste mesmo
stage** — ver "Modelo de camadas" abaixo).

### Modelo de camadas: wallpaper é uma cortina por cima de tudo

O wallpaper fica **acima** (z-index maior) de toda mídia — img/video no stage,
e o iframe do YouTube no Display. A mídia toca/troca de conteúdo **livremente
por baixo**, sem nunca precisar saber se está "visível"; o wallpaper só
liga/desliga essa cortina por cima, com fade quando configurado.

Isso existe porque o modelo antigo (mídia por cima, escondida/revelada
conforme a view) exigia que cada tipo de mídia rastreasse "já posso me
revelar?" — para o YouTube isso significava só revelar o iframe quando
`view==='visual'` **e** o vídeo já estivesse tocando; se o vídeo começasse com
o wallpaper ligado, essa condição nunca era satisfeita e o vídeo ficava preso
atrás do wallpaper para sempre, mesmo depois de desligar o wallpaper (o áudio
tocava normalmente, só o vídeo nunca aparecia). Com o wallpaper como cortina
por cima, revelar é sempre só "esconder a cortina" — não depende mais de em
que estado (view) a mídia foi carregada.

- **`coveredNow`** (privado) é a única fonte de verdade sobre se a cortina
  está cobrindo agora. Começa `true` (nada carregado).
- **`computeCover()`**: `!current || ended || view === 'wallpaper'` — a
  cortina deve cobrir sempre que não há mídia, ela "terminou" (`ended`,
  aguardando replay) ou o operador pediu `view='wallpaper'`.
- **`instantCover(show)`** / **`coverIn(rampAudio)`** / **`coverOut()`**: as
  três únicas funções que tocam o elemento do wallpaper. `coverIn`/`coverOut`
  fazem fade (conforme `fadeOut`/`fadeIn` e `fadeTime`) e usam `coverSeq` para
  descartar fades de cortina obsoletos (um pedido mais novo cancela o
  anterior); `instantCover` é imediato (sem fade) e sempre vence.
- `img.hidden`/`video.hidden` (**`applyMedia()`**) passam a depender **só do
  `kind`** da mídia atual — nunca de `view`/`ended`. A mídia continua
  renderizando/tocando por baixo mesmo com a cortina fechada (é assim que o
  áudio do YouTube ou de um vídeo local continua audível com "wallpaper on").
- **`stage.coverIn`/`coverOut`/`instantCover` são expostos publicamente** —
  o Display os chama diretamente para a cortina do YouTube (`ytSetView()`,
  `onPlayerStateChange()`), já que é o **mesmo elemento físico** de wallpaper
  compartilhado. `coverIn(rampAudio=true)` mexe no volume do `<video>` do
  próprio stage — o YouTube **nunca** deve chamá-lo com `rampAudio=true` (sua
  própria rampa de áudio é feita externamente, via `setVolume` do player).

### Opções de criação

```js
createStage({
  wallpaper,    // elemento do wallpaper (cortina, por cima de tudo)
  img,          // elemento <img>
  video,        // elemento <video>
  forceMuted,   // bool — mantém vídeo sempre mudo (preview do Controle)
  onEnded,      // callback quando o vídeo termina
  onTime,       // callback em timeupdate / loadedmetadata / play / pause / ended / volumechange
  onBlocked,    // callback quando autoplay é bloqueado pelo browser (só
                // NotAllowedError; AbortError de um play() interrompido por
                // pause()/load() seguinte — normal em toda troca de mídia —
                // é ignorado, para não disparar recuperação de áudio à toa)
  onError,      // callback no evento 'error' do <video>
})
```

### Estado interno

```
current     → registro da mídia carregada (null = nada)
ended       → flag: vídeo chegou ao fim (permite replay sem recarregar)
view        → 'visual' | 'wallpaper'
muted       → bool (intenção do operador; independe de forceMuted)
volume      → 0.0 – 1.0
url         → object URL do blob OU URL externa em uso
isBlobUrl   → bool — se true, revoga com URL.revokeObjectURL ao trocar/limpar
loadSeq     → contador para descartar loads/fades concorrentes obsoletos
coveredNow  → bool — a cortina do wallpaper está cobrindo agora?
coverSeq    → contador para descartar fades de cortina obsoletos
fadeIn/fadeOut/fadeTime → transições (fixas: createStage.FADE, ver abaixo)
```

### Transições (fade)

**Regra geral: transição entre mídias é sempre PRETO; o wallpaper só aparece
como ponto final (resting state confirmado), inicial (nada carregado ainda)
ou manipulado explicitamente pelo operador (`view` toggle).** Nunca como parte
de uma troca de conteúdo em andamento — inclusive quando a troca depende de
rede (YouTube) ou é ambígua no momento (fim natural, antes de saber se um
próximo item vem em seguida).

Duas transições **independentes** quando fade está ativo:

**Áudio nunca mostra o `<video>`** (`applyMedia`: `video.hidden = kind !==
'video' || ended`). O elemento é só o "sink" de som — em áudio puro não há um
pixel a exibir. Mantê-lo em cena fazia o navegador desenhar o **placeholder de
mídia** (retângulo claro com botão de play) por cima do preto: invisível
durante o hino, porque a camada de letra o cobria, e aparecendo justamente no
FIM, quando a letra esmaece e o descobre. É o mesmo placeholder já perseguido
na troca de mídia (ver `resetMediaDom`/`load`), mas com outra origem — ali era
um `<video>` sem `src`, aqui é um `<video>` com `src` e nada a mostrar. Um
elemento `display:none` continua tocando áudio normalmente.

**A entrada tem rampa de volume, como a saída.** Isto não existia: `load()`
escrevia o volume direto no alvo e a mídia entrava no talo enquanto o visual
ainda esmaecia — a saída tinha rampa, a entrada não, e a assimetria era audível
a cada troca de hino. Agora, com `fadeIn` ligado, `rampVolume(0, volume,
fadeTime)` roda **depois** de `play()` (que restaura o volume alvo e limpa o
`rampTimer`, e por isso não pode vir depois da rampa).

- **Fade de CONTEÚDO** (`runFadeOut(rampAudio)` + `mediaReady`/fade-in): troca
  de item enquanto já visível (ex: vídeo A → vídeo B com a cortina já aberta),
  fim natural (`ended`) e troca de TIPO de conteúdo (mídia local ↔ YouTube via
  `fadeOutToBlack()`, ver seção do Display). A mídia atual esmaece até o
  **preto** (não até o wallpaper — a cortina não participa dessa transição);
  a próxima entra com fade-in a partir do preto, só depois de pronta pra
  pintar (`mediaReady`: `img.decode()` / `loadeddata` do vídeo, timeout de
  2,5 s) — sem isso o conteúdo "pipoca" no meio do fade. Vídeo/áudio ramp
  0 → alvo junto (exceto preview `forceMuted`).
- **Fade da CORTINA** (`coverIn`/`coverOut`): cobrir ou revelar a mídia
  (independente de qual mídia é ou de qual tipo) — reservado para os três
  contextos legítimos do wallpaper (ponto final/inicial/manual), nunca para
  uma troca de conteúdo em si. Usado em:
  - **Saída** (`stop`, `clear`, `view→wallpaper`): `coverIn()` — a cortina
    sobe revelando... nada, ela é opaca; a mídia continua tocando
    (des)coberta por baixo. `stop`/`clear` cobrem **com rampa de áudio**
    (`coverIn(true)` — corta a reprodução abruptamente, então o volume desce
    suave); `view` toggle é **sem rampa** nos dois sentidos (só o visual
    muda, o áudio não é afetado).
  - **Entrada** (`load` que revela conteúdo coberto, `view→visual`):
    `coverOut()` — a cortina desce, revelando a mídia que já estava tocando
    por baixo (sem precisar esperar nada dela).
- **`ended` (fim natural)**: esmaece até o **PRETO** (`runFadeOut(false)` —
  sem rampa, o vídeo já parou sozinho), nunca a cortina — ainda não se sabe
  se um próximo item vem em seguida. Só cobre com o wallpaper de fato
  (`instantCover(true)`) **~400 ms depois**, e só se `ended` continuar
  verdadeiro e nenhum `loadSeq` mais novo tiver assumido a cena nesse meio
  tempo — ou seja, só quando fica confirmado que é o ponto final de verdade
  (`repeat='off'` ou Controle fechado). Com avanço automático de playlist, o
  `load` do próximo item (disparado por `onEnded`) chega quase junto e
  assume via `loadSeq` bem antes desse prazo — a marca nunca chega a
  aparecer entre os itens da playlist. `video.hidden` também passa a
  considerar `ended` (além do `kind`): sem isso, o `currentTime=0` do fim
  natural (preparando o replay) mostraria um salto pro primeiro frame antes
  do preto/cortina cobrir.
- `setVolume` do operador cancela qualquer rampa em curso (de conteúdo ou de
  cortina — ambas usam o mesmo `rampTimer` do `<video>`, mutuamente exclusivas
  no tempo); `play`/`stop` restauram o volume alvo (evita ficar preso em
  volume 0 pós fade).

### API exposta

```js
stage.handle(cmd)
stage.load(id, view, muted, volume)
stage.clear()
stage.play() / pause()
stage.seek(seconds)
stage.setView(v) / setMute(m) / setVolume(vol)
stage.setFade({ fadeIn, fadeOut, time })  // chamado uma vez, no init, com createStage.FADE
stage.setFit(v)        // 'contain' (ajustar) | 'cover' (preencher) | 'fill' (esticar)
stage.setForceMuted(v) // alterna em tempo real se o stage é forçado a ficar sempre mudo
                        // (preview normal) ou toca áudio de verdade (modo "mesa de som"),
                        // com rampa curta de volume (MUTE_RAMP_TIME)
stage.coverIn(rampAudio) / coverOut() / instantCover(show)  // cortina do wallpaper (ver acima)
stage.fadeOutToBlack()  // esmaece até o preto e reseta (current=null) sem tocar a cortina —
                        // usado só na troca de TIPO de conteúdo (mídia local ↔ YouTube)
stage.getCurrent()     // → registro atual ou null
stage.getView()        // → 'visual' | 'wallpaper'
stage.isPlaying()      // → bool
stage.hasEnded()       // → bool (fim natural, aguardando replay — as camadas
                       //   paralelas usam isso para não re-renderizar com o
                       //   currentTime já zerado; ver "Fim natural" na Camada de Texto)
stage.isTimed()        // → bool (true para vídeo/áudio)
stage.getTime()        // → currentTime em segundos
stage.getDuration()    // → duração em segundos
stage.getMuted()       // → bool
stage.getVolume()      // → 0.0 – 1.0
stage.getFit()         // → 'contain' | 'cover' | 'fill'
stage.isForceMuted()   // → bool
```

### Proporção da preview (`--pv-ar`)

A preview é uma **miniatura fiel do telão**, e isso só se sustenta se ela tiver
a **proporção** do telão. Ela era `aspect-ratio: 16/9` fixo — contra um dongle
2,17:1 (3120×1440, comum), toda mídia mentia sobre o enquadramento: uma imagem
16:9 preenchia a preview inteira e ganhava barras laterais de 18% na projeção,
um vídeo enquadrado aqui aparecia cortado lá, e um versículo que cabe em 3
linhas no telão aparecia truncado no meio da palavra.

`applyPreviewAspect(tv)` (controle.js) escreve `--pv-ar` em `:root`, e
`.preview` usa `aspect-ratio: var(--pv-ar, 16 / 9)`. A fonte é
`AVNative.displays()` — que já devolve `{w, h}` da tela conectada — mais
`onDisplayChange`, então trocar de TV no meio do culto reajusta a preview
sozinho. **Sem TV conectada a projeção é a própria preview em tela cheia**, no
celular: aí o alvo passa a ser a tela do aparelho em paisagem
(`max(screen.w, screen.h) / min(...)`), que é exatamente o que vai ao
espelhamento. No navegador, sem ponte, vale sempre esse segundo caminho.

**A preview ENCOLHE em vez de transbordar.** A largura ideal é
`--deck-pv-h × --pv-ar` (a altura da faixa da grade vezes a proporção), mas ela
nem sempre cabe: num telão largo, ou num celular estreito, a soma
`preview + 2 botões + gaps` estoura a coluna. Com `height: 100%` fixo e
`flex: 0 0 auto` a preview simplesmente vazava por baixo da coluna do mixer e
levava o botão de próxima estrofe para fora da tela. Hoje quem manda é a
LARGURA: `width` ideal + `max-width: 100%` + `flex: 0 1 auto`, com
`height: auto` + `aspect-ratio` — o flex encolhe a preview até caber e a altura
acompanha, preservando a proporção; `align-self: center` mantém a miniatura
centrada quando ela fica mais baixa que a faixa. A altura da faixa é o token
`--deck-pv-h`, usado tanto no `grid-template-rows` do `.deck` quanto neste
cálculo — se os dois divergirem, a conta da largura passa a estar errada.

O valor é limitado a `[PV_AR_MIN, PV_AR_MAX]` = `[1.2, 2.4]`: a preview divide
a linha com os dois botões de estrofe, que precisam continuar sendo alvos de
toque (`.slide-nav-btn` tem `min-width: 40px`). Telas reais de projeção ficam
entre 4:3 e ~2,2:1, bem dentro da faixa; um painel 32:9 bate no teto e deixa de
ser proporcional — troca deliberada. Verificado em 24 combinações (6 larguras de
celular × 4 proporções de telão): nada transborda a linha nem invade o mixer, e
os dois botões de estrofe continuam acionáveis em todas.

Duas consequências que valem registrar:

- **A calibração deixou de ser duplicada.** Todo o dimensionamento das camadas
  já era em `cq*`, relativo ao container, logo **invariante de escala**: com a
  proporção certa, os mesmos números dão a mesma composição em 280px e em
  3120px. Os valores próprios que a preview tinha (`.pv-text-main` 16% maior,
  `.pv-lyrics-box` bem maior…) eram compensação empírica para a proporção
  errada. Hoje `.pv-*` repete literalmente os valores de `.text-*`/`.lyrics-*`,
  e a fidelidade passa a ser estrutural em vez de ajustada à mão.
- **A borda virou `outline`.** Com `box-sizing: border-box`, uma `border: 1px`
  entra no border-box e o `aspect-ratio` passa a valer para a caixa COM a
  borda — 1px em 128px de altura já desloca a proporção ~0,8%, e a proporção é
  justamente o que se está tentando acertar. `outline` com `outline-offset:
  -1px` desenha igual sem ocupar layout.

### Preenchimento da mídia (`setFit`)

`setFit(v)` aplica `object-fit` direto via `style` no `<img>` e no `<video>`
do stage (`'contain'` por padrão, aceita `'cover'`/`'fill'`; qualquer outro
valor cai em `'contain'`) — sobrepõe o `object-fit: contain` fixo do CSS.
Só afeta mídia local (imagem/vídeo do próprio stage); o iframe do YouTube não
usa isso (é conteúdo cross-origin, fora do stage). Persistido em `state.fit`
e propagado pelo comando `fit` — que, tanto no Display quanto no Controle, é
despachado direto para o stage **mesmo com um vídeo do YouTube tocando no
momento** (o roteamento normal de comandos cairia no ramo do YouTube, que
ignora `fit`, e o stage só pegaria o valor novo na próxima mídia local, com
atraso).

### Rampa de mudo (`setMute`)

Mutar/desmutar não corta o áudio na hora — faz uma rampa curta de volume
(`MUTE_RAMP_TIME`, 0,25 s) usando o mesmo `rampTimer` das outras transições
(mutuamente exclusivas no tempo, a mais recente cancela a anterior). Ao
mutar, a rampa desce até 0 e só então `video.muted` é de fato marcado como
`true` (evita o "pop" de um corte abrupto); ao desmutar, `video.muted` volta
a `false` já na hora (senão volume 0 não seria ouvido) e a rampa sobe de 0
até o volume alvo. Um `setTimeout` (`muteApplyTimer`) aplica o `muted` real
ao final da rampa de descida, mas confere `muted` de novo nesse instante —
um `setMute()`/`load()` mais recente pode ter mudado a intenção enquanto a
rampa corria, e a aplicação atrasada não deve "ressuscitar" um mudo já
desfeito. `setVolume()` (o operador arrastando o fader) cancela qualquer
rampa de mudo em andamento, senão o volume ajustado manualmente seria
sobrescrito pelo `muteApplyTimer` pendente. O YouTube no Display usa a mesma
lógica, em paralelo: rampa via `player.setVolume()` (`ytRampVolume`) e só
chama `player.mute()`/`unMute()` no início/fim da rampa, pelos mesmos motivos.

**Fonte única da rampa de volume** (`createStage.rampSteps` /
`createStage.MUTE_RAMP_TIME`): o passo-a-passo do fade sonoro
(`steps = max(2, round(dur*20))`, clamp 0–1) e a duração da rampa de mudo
(0,25 s) ficam definidos **uma vez** no `stage.js` e expostos como
propriedades de `createStage`. Os três "sinks" de áudio do sistema — o
`<video>` do stage (`rampVolume`), o player do YouTube no Display
(`ytRampVolume`) e o da preview no Controle (`ytPreviewRampVolume`) — reusam
esse mesmo `rampSteps`, cada um passando só o seu `apply(v)` (o "onde escrever
o volume"). Antes a matemática e a constante estavam duplicadas nos três
arquivos e podiam divergir. A *orquestração* do mudo (quando mutar de fato,
`muteApplyTimer`) continua por player, pois depende do estado de cada um.

### Concorrência de carregamento

`load()` é assíncrona. O contador `loadSeq` garante que apenas o **último** `load()`
iniciado aplica seu resultado — chamadas anteriores obsoletas são descartadas.

**A troca de view tem contador PRÓPRIO (`viewSeq`).** `setViewFaded` usava o
mesmo `loadSeq`, e isso fazia um toque em "visual on/off" **cancelar um `load()`
em curso**: o `load` fica assíncrono de 0,7 s a 3 s (fade-out de 0,6 s +
`getMedia` + `opfsGetFile` + `mediaReady` até 2,5 s), e nessa janela o
`runFadeOut` já levou a mídia anterior a `opacity:0` e volume 0 — mas o `src`
novo nunca chegava a ser aplicado. Resultado: telão preto e mudo, com
`current` ainda apontando para o item antigo. O gesto é natural logo depois de
escolher um item (e o deslize ↑ da preview em tela cheia faz o mesmo), então
não é um caso de borda.

A cortina é **ortogonal ao conteúdo** — é o que a própria seção "Duas
transições independentes" afirma. `setViewFaded` guarda os dois contadores:
descarta se um `setViewFaded` mais novo assumiu (`viewSeq`) **ou** se um
`load`/`clear` assumiu a cena no meio do fade (`loadSeq`) — nesses casos quem
chegou depois já decidiu o estado final da cortina. Ações exclusivas
(`load`/`clear`) continuam podendo cancelar um `load`; trocar a view, não.

---

## Controle

### Modos de uso: simplificado (padrão) × avançado

O app atende duas pessoas diferentes. Uma abre o celular para **conectar a
tela e tocar um louvor**; a outra opera o culto inteiro — Cronograma, álbuns,
Bíblia, Camada de Texto, playlist, letra sincronizada, microfone. A tela que
serve bem à segunda é excessiva para a primeira, e esconder recursos atrás de
uma configuração só empurraria a escolha para um lugar onde ninguém procura.

**O app abre SEMPRE no simplificado**, sem perguntar nada. A versão anterior
(v5.23) mostrava um seletor de modo na abertura; ele saiu porque cobrava um
toque de todo mundo — inclusive de quem nem sabia que havia dois modos — antes
de mostrar qualquer coisa útil, e o caso comum é justamente o simplificado.
A classe `mode-simple` **já vem no `<body>` do HTML** (e `.open` no
`#simpleMode`), então a tela certa aparece sem esperar JS ou IndexedDB — era o
mesmo motivo pelo qual o seletor nascia visível no documento.

O **modo avançado** fica a um toque, no botão do cabeçalho ("Modo avançado"), e
o caminho de volta é o segmento **Modo do app** no popup de Exibição
(`#appModeSeg`). A escolha vale só para a sessão: cada abertura recomeça no
simplificado — quem abre o app hoje pode não ser quem abre no próximo culto.

**O simplificado NÃO é uma segunda implementação.** A tela avançada continua
no DOM, só oculta (`body.mode-simple`), e os controles do modo simples
**acionam os botões reais por `.click()`** — o mesmo padrão que a notificação
nativa já usa. Um botão `disabled` continua sendo um no-op natural, e nenhuma
regra de borda (texto sem áudio de fundo, YouTube que precisa recarregar, mudo
bloqueado pelo navegador) passa a existir em dois lugares. Na mesma linha,
`renderSimple()` **copia o glifo e as classes** dos botões do mixer em vez de
recalcular play/pause e mudo: se a regra mudar lá, muda aqui junto.

**A tela é um CONTROLE REMOTO**: teclas grandes (`.simple-key`), nada de
arrastar. Quem usa este modo costuma estar de pé, com o celular numa mão só —
mirar um alvo fino ali é o pior formato possível.

| Elemento | O que faz |
|---|---|
| **Conectar a tela** (`#simpleCastBtn`) | `AVNative.openCast()` — o seletor de espelhamento do Android. O subtítulo mostra a tela conectada ao vivo (`AVNative.displays()`), porque "conectar" é a primeira dúvida de quem abre o app. **Sem tela conectada é o único botão disponível** (ver o bloqueio abaixo). No navegador vira o atalho para a tela do Display |
| **Buscar música** (`#simpleSearchBtn`) | o MESMO popup de busca do acervo (`openHymnSearch`). Um toque na linha **toca a versão Cantada direto** (ver abaixo) |
| **Linha do tempo** (`#simpleTime`) | decorrido · barra · duração, só LEITURA — espelha a mesma `#seek` do modo avançado (que já é alimentada pela preview, pelo `display-status` e pelo polling do YouTube) e some quando o item não tem duração |
| **Letra** (`#simpleLyrics`) | a letra INTEIRA da música em cena, com o mesmo destaque e o mesmo acompanhamento da leitura auxiliar do modo avançado |
| **Play/pause e mudo** | `.click()` em `#playpause` / `#muteToggle` |
| **Volume** (`#simpleVolDown` / `#simpleVolUp`) | teclas **−** e **+** com o número no meio (`.simple-vol-read`), não um slider |
| **Modo avançado** (`#simpleFullBtn`) | `setAppMode('full')` — a tela completa de sempre. Era texto `--muted` sobre `--surface` (5,38:1): dentro do mínimo, mas lido como legenda, não como botão. Desde a v5.40 é texto pleno sobre `--surface-2` com borda de accent — **9,75:1**, e agora se anuncia como controle sem virar a ação principal de ninguém |

**Sem escolha de variante.** No simplificado o toque na linha da busca chama
`simplePlaySong()`, que toca o **Cantado** e pronto: abrir o acordeão com
Cantado/Playback e dois "+" seria devolver ao operador exatamente a decisão que
este modo existe para poupar. A faixa de ações some inteira
(`body.mode-simple .hymn-actions`), e no modo avançado a mesma linha continua
abrindo o acordeão de sempre.

**A pergunta do download aparece UMA vez.** Se a música ainda não está no
aparelho, `ensureDownloadConsent()` pergunta antes de gastar internet e grava a
resposta em `state.downloadOk` — quem respondeu "baixar" já disse como quer que
o app se comporte, e repetir a pergunta a cada música viraria ruído no meio do
culto. A verificação usa `songVariantsNeeded()`, a mesma regra da sincronização
em massa (não basta ter `fileIdFull`: o arquivo pode ter sido apagado por fora).

**Volume em degraus, não em curso.** `simpleVolStep()` usa o MESMO passo dos
botões físicos (`VOL_KEY_STEP`) e a mesma `applyVolume()` — clamp, desmutar ao
subir de 0, comando e render num lugar só. `holdRepeat()` faz a tecla repetir
enquanto segurada, como num controle de verdade: o primeiro passo sai no
`pointerdown` (resposta imediata) e a repetição só começa depois de uma pausa,
senão um toque comum viraria dois. O indicador mostra o número e uma barrinha
de curso na base (`--vol`, a mesma variável do fader).

**A zona de letra reusa o renderizador da leitura auxiliar**: `lvBuildSong()` e
`lvMarkCurrent()` receberam o CONTAINER como parâmetro, então o popup do modo
avançado e a zona do simplificado desenham as mesmas linhas `.lv-row` com o
mesmo destaque — e `refreshSimpleLyrics()` entra no mesmo pulso de
`renderSlideNav()`, sem timer próprio. Rolar com o dedo desliga o
acompanhamento até a próxima música, como no popup.

A espiada do volume pelos botões físicos (`peekVolume`) **não roda no
simplificado**: as teclas de volume já estão na tela, com o número ao lado.

#### Sem tela conectada, o modo inteiro fica bloqueado (v5.39–v5.41)

Neste modo **a projeção É o telão** — não existe preview aqui. Sem tela
conectada, buscar uma música e dar play produzia som no celular e mais nada:
os controles continuavam à disposição, respondendo a cada toque, sem que nada
aparecesse em lugar nenhum. O modo avançado não tem esse problema, porque lá a
preview mostra o que sairia no telão; aqui não há para onde olhar.

`renderSimpleGate()` cobre a tela com a cortina `#simpleVeil` — `backdrop-
filter: blur(7px)` mais um véu — que **intercepta os toques** do que ficou
atrás. A cortina é só o vidro fosco: não tem conteúdo. Na frente sobem duas
coisas, e só duas:

- **Conectar a tela** (`#simpleCastBtn`), a única ação que resolve o bloqueio.
  Bloqueada a tela, a faixa `.simple-actions` deixa de ser faixa: vira um
  bloco absoluto no **centro exato da tela**, com a busca escondida e o botão
  preenchido no accent (`--accent-fill`, ícone de 44px, sombra colorida). Ele
  não podia continuar sendo a mesma tecla escura das outras: a única ação
  possível da tela não disputa atenção com o teclado embaçado atrás dela.
  **Ali ele é ícone e UMA frase** — "Toque para conectar uma tela" — e nada
  mais: o subtítulo repetia o rótulo e a mensagem que havia acima dele dizia
  pela terceira vez a mesma coisa, três textos para uma tela com uma ação só.
  Com tela conectada o rótulo volta a nomear a ação ("Conectar a tela") e o
  subtítulo volta a informar QUAL tela, que aí é notícia.
- **Modo avançado** (`#simpleFullBtn`), no cabeçalho. **Sem TV o app não fica
  inútil** — a projeção passa a ser a preview em tela cheia —, e trancar essa
  saída transformaria a falta de telão numa parede. O que se bloqueia é o modo
  simplificado, não o app.

**A mensagem é legenda do botão, não par dele.** `.simple-gate-msg` mora dentro
de `.simple-actions` (e não na cortina) para ficar colada ao botão que resolve
o problema, mas sai do fluxo e se pendura acima dele — assim quem fica no meio
exato é o BOTÃO. Centralizar o grupo inteiro o empurraria para baixo do centro
pela altura do texto (medido: 481 em vez de 450, numa tela de 900).

**A única parte que muda por contexto é quem responde "há tela?"** — o resto do
mecanismo é o mesmo nos dois. No app são as telas de apresentação que a ponte
lista (`AVNative.displays()` + `onDisplayChange`), então o dongle que cai
rebaixa a cortina e o que volta a levanta, pelo caminho que já existia. No
navegador não existe `Presentation`: vale a **janela do Display** que o próprio
botão abre (`openWebDisplay`), e fechá-la equivale a desconectar. Como não há
evento de "janela fechada", um relógio de 1 s olha o `closed` — e ele só existe
enquanto a janela existe.

Dois detalhes que só aparecem em uso:

- **A busca aberta é fechada pelo bloqueio.** Perder a tela com o popup no ar
  deixaria a busca funcionando por cima de uma tela bloqueada — e tocar uma
  música dali não projetaria nada.
- **A cortina precisa de `[hidden] { display: none }` explícito.** O
  `display: flex` da regra venceria o `display: none` que o navegador dá a
  `[hidden]`, e ela nunca sairia da frente. Onde não há suporte a
  `backdrop-filter` o véu fica opaco: uma cortina transparente pareceria um
  toque perdido, não um bloqueio.

### Layout geral

```
┌─────────────────────────────────────────────────────────┐
│  [←] Cronograma            Controle v4.75  [busca][sync] │  ← .list-header (topo; sem appbar)
│  ┌───────────────────────────────────────────────────┐  │
│  │  item 1                                           │  │  ← .lib-list
│  │  item 2                                           │  │     (área scrollável)
│  └───────────────────────────────────────────────────┘  │
│  [+ Importar] [★ Favoritos]  ← última linha do Cronograma │
│  Cronograma  Álbuns  Bíblia  Microfone              🔍   │  ← .tabs (mescladas ao fundo)
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┬──────┐         │  ← .bottombar (base fixa)
│  │  Nome da mídia atual  [seek bar]    │ Wall │         │
│  │─────────────────────────────────────│ Letra│         │
│  │  ⏮ Preview 16:9 ⏭                  │ Mesa │         │
│  │─────────────────────────────────────│ Mudo │         │
│  │  🔁  ⏮  ▶/⏸  ⏹  ⏭  [Playlist]    │ Vol  │         │
│  └─────────────────────────────────────┴──────┘         │
│  [margem segura para navegação por gestos]              │
└─────────────────────────────────────────────────────────┘
```

**Sem barra de topo (`.appbar` removida):** o app começa direto no cabeçalho da
lista. `main` ganhou `padding-top` com `env(safe-area-inset-top)` (a antiga
appbar cuidava do notch/status bar).

**Cabeçalho da lista (`.list-header`):** botão voltar (dentro de pasta), título da
aba/pasta, o **indicador de versão** (`#appVersion` — só aparece ao lado do
título da aba **Cronograma**, `activeTab==='imports'`), campo de busca (dentro de
pasta OPFS) e botão de sincronizar pasta do dispositivo (só na raiz dos
**Favoritos**). Na aba Bíblia o título fica oculto (libera espaço — ver "Bíblia").

**Controles (`.bottombar`):** fixados na base da tela. O padding inferior usa
`max(env(safe-area-inset-bottom), 12px)` para garantir margem segura contra
acionamentos acidentais pela navegação por gestos do Android/iOS.

**Grade real (CSS Grid), não flex aproximado:** `.deck` é um `display:grid` de
2 colunas (`1fr` / `56px` do mixer) × 3 linhas (`auto` / `130px` do preview /
`auto`), com `.nowplaying`, `.preview-row` e `.transport` como itens diretos
da grade (não há mais um `.deck-main` intermediário). O `#mixer` ocupa as 3
linhas (`grid-row: 1 / 4`) e usa `grid-template-rows: subgrid` para **herdar
exatamente essas mesmas 3 faixas de altura** — garante alinhamento pixel a
pixel entre a coluna do mixer e nowplaying/preview/transport, em vez de
depender de flex-basis calculado à parte (a fonte de um desalinhamento
antigo entre as duas colunas). `padding` do `#mixer` é **só horizontal** (`0
.35rem`): padding vertical deslocaria as linhas herdadas do subgrid,
reintroduzindo o desalinhamento.

**Sem "card" de fundo:** os botões do mixer ficam **livres** (cada um só com
o próprio fundo via `.ctl-btn`) — `#mixer` não tem `background`/`border-radius`
próprios, só posiciona pela grade.

**O mixer NUNCA dita a altura das faixas** — quem dita é sempre a coluna 1
(nowplaying / preview / transport). Cada `.mixer-slot` é apenas uma caixa de
posicionamento **vazia no fluxo**, e os botões vivem num `.mixer-stack`
`position:absolute; inset:0` dentro dela. Um item absoluto sai do fluxo e não
entra no cálculo de max-content das faixas `auto` do `.deck` — e como o
`#mixer` é `subgrid`, qualquer coisa que ficasse no fluxo ali contribuiria
para as faixas do pai.

Era essa contribuição que deformava a caixa de controles ao **abrir o slide de
volume**: o conteúdo do mixer muda entre os dois estados (top/mid somem, e o
botão da base troca de ícone — um SVG de 22px por um glifo da fonte, alturas
intrínsecas diferentes), então as faixas `auto` 1 e 3 mudavam de tamanho e
levavam junto a altura do deck e da preview. Fora do fluxo, os dois estados
são indistinguíveis para a grade. (O `min-height: 0` que existia antes
resolvia só metade do problema: ele zera o mínimo automático, mas uma faixa
`auto` continua sendo dimensionada pelo max-content dos itens.)

O mixer é dividido em 3 "fatias" (`.mixer-slot` > `.mixer-stack`), uma por
linha da grade:

| Fatia | Linha da grade | Conteúdo |
|---|---|---|
| `.mixer-top` | 1 (mesma de `.nowplaying`) | **visual on/off** (`#viewToggle`) |
| `.mixer-mid` | 2 (mesma de `.preview-row`, 130px) | **letra/texto completo** (`#lyricsViewBtn`, ícone de **folha com linhas** — SVG inline; abre a leitura auxiliar), **mesa de som** (`#standaloneToggle`, ícone de **fone de ouvido** — SVG inline), **mudo** (`#muteToggle`) — empilhados, cada um com `flex:1` |
| `.mixer-bottom` | 3 (mesma de `.transport`) | **volume** (`#volToggle`/`#volClose`, recolhível) |

Essa ordem (wallpaper no topo, depois letra/mesa de som/mudo no meio, volume
na base) agrupa os controles de **áudio** (mesa de som + mudo) perto do
volume, na base, e o de **visual** perto do wallpaper, no topo. A fatia do
meio começa com a **leitura auxiliar** (ver seção própria): ali morava o
antigo botão de fundo da letra, que virou uma opção do popup de Exibição —
é preferência de aparência, escolhida uma vez, não algo que se opera durante
o culto. Cada botão tem `flex:1` dentro da própria fatia — top
(1 botão) e bottom (1 de cada vez) preenchem a fatia inteira; mid (3
botões) a divide em partes iguais.

**Fonte única do volume (`applyVolume`)**: o fader, o arrasto vertical no
terço direito da preview em tela cheia e os **botões físicos de volume** (no
app) passam todos pela mesma função — que aplica o clamp, desliga o mudo se o
volume subir de 0, envia o comando e atualiza o fader. Antes a lógica estava
duplicada entre o `input` do fader e o `gSetVolume` do gesto.

**Botões físicos** (só no app; `window.__avVolumeKey`): a Activity intercepta
`KEYCODE_VOLUME_UP/DOWN` e entrega o passo aqui, em vez de deixar o Android
tratá-los. Era esse o problema durante o espelhamento: o sistema roteia esses
botões para a **saída em uso**, e com Miracast/Smart View ativo isso vira o
volume da TV — o operador apertava e o fader do app não saía do lugar. **Com o
fader já no máximo (ou no zero)**, o passo é devolvido ao sistema
(`AVNative.systemVolume`, com a UI de volume do Android), senão um aparelho
com o volume de mídia baixo ficaria sem como subir enquanto o app estivesse
aberto. Ver "Divergências" em `../CLAUDE.md`.

**A tecla ESPIA o fader** (`peekVolume`, `VOL_PEEK_MS` = 2,8 s): com a coluna
no estado normal, apertar o botão físico mexia no volume de forma **invisível**
— o operador mudava o volume sem ver quanto ficou nem quanto ainda cabe. Agora
a tecla abre a **mesma** visualização do toque em `#volToggle` (é literalmente
`openVolume()`: fader no lugar de top+mid, o botão da base virando ✕, as mesmas
animações) e a recolhe sozinha alguns segundos depois, por `closeVolume()`. Um
segundo jeito de desenhar o fader seria um segundo jeito de ele ficar diferente.
Três regras cuidam da convivência com o toque:
- **Só recolhe o que ela mesma abriu** (`volPeekOwned`): com o volume aberto
  pelo operador, a tecla não mexe no estado da coluna — apenas move o fader.
- **Tocar em `#volToggle`/`#volClose` cancela a contagem** (`cancelVolPeek`):
  quem abriu na mão fecha na mão.
- **Mexer no fader durante a espiada reinicia a contagem** (`bumpVolPeek`, no
  `pointerdown`/`input` do `#volSlider`): recolher debaixo do dedo do operador
  seria o oposto do que a espiada existe para fazer. Continua sendo uma
  espiada — some sozinha alguns segundos depois que ele parar.

No navegador nada disso acontece: os botões físicos não chegam à página, e
`peekVolume` só é chamada de `window.__avVolumeKey`.

Tocar no botão de volume liga a classe `.vol-open` no `#mixer`, que troca
**top + mid** (os 4 botões: visual/letra/mesa de som/mudo) pelo
**fader vertical** (`.fader-wrap`, posicionado via `grid-row: 1 / 3` — ocupa
exatamente o mesmo espaço de top+mid combinados) **+ um botão de ocultar**
(`#volClose`, ícone ✕) que aparece na mesma fatia `.mixer-bottom`, no lugar
de `#volToggle`. O botão da base (volume/ocultar) **não muda de lugar** entre
os dois estados — só troca de característica (ícone/cor) instantaneamente;
quem anima é o que está **acima** dele: o fader entra ao abrir (fade + leve
deslize) e sai ao fechar (`.vol-closing` mantém a classe durante a saída),
e ao voltar os botões de top/mid entram animados (`.vol-revealing`). É só
estado de UI (não persistido; cada abertura começa recolhida). As durações
no JS (`openVolume`/`closeVolume` em `controle.js`) casam com as do CSS
(`@keyframes vol-slide-in/out`). O botão de volume é **preenchido de azul
(accent) com o ícone de mixer/faders em branco** (SVG inline — o ícone não
existe no subset da fonte; ver seção da fonte), visualmente distinto do
mudo. Mexer no volume com mudo ativo desliga o mudo automaticamente.
Mutar/desmutar não corta o volume na hora — faz uma rampa curta (ver
`setMute` em `stage.js`).

**O fader tem a LARGURA DOS BOTÕES que ele substitui**: a coluna não muda de
espessura ao abrir o volume, só de conteúdo — mesmo raio (`--radius-btn`) e
mesmo fundo (`--surface`) da parte ainda não preenchida. Isso exige desenhar
o trilho (`appearance: none` + `::-webkit-slider-runnable-track`), porque a
espessura do trilho NATIVO é fixa: alargar o `<input>` sozinho só deixava a
barrinha de sempre boiando num alvo maior (verificado — o trilho pintado não
mudou de espessura com o elemento a 44,8px).

Como `appearance: none` desliga junto o preenchimento que vinha do
`accent-color`, ele passa a ser um gradiente com o corte em `--vol` (0–1),
escrito por `renderControls()` no mesmo ponto em que o valor do fader é
sincronizado — um lugar só, e os dois nunca discordam. O corte não é
`--vol * 100%` puro: o CENTRO do cap percorre a altura MENOS a espessura dele
(`--fader-cap`, 26px), então a conta desconta isso e a borda do azul fica
exatamente sob o cap em qualquer posição (conferido em 0%, 35%, 75% e 100%).
O cap atravessa a coluna inteira, como o de uma mesa de som de verdade — e é
um alvo de toque bem maior que o thumb redondo de 34px que havia antes.

**O cap carrega o NÚMERO (0–100)** do volume atual (`#volValue`,
`.fader-value`): saber que o fader está "mais ou menos na metade" não é a
mesma coisa que saber que está em 50 — e com os botões físicos o valor muda
sem ninguém tocar na barra. O número é um elemento IRMÃO do `<input>`, não um
filho: `::-webkit-slider-thumb` é pseudo-elemento e não aceita conteúdo. Por
isso ele repete a MESMA conta de posição do preenchimento, com `--vol` e
`--fader-cap` declaradas no `.fader-wrap` (o ancestral comum aos dois) —
assim o número nunca se descola do cap. `pointer-events: none`: quem recebe o
arrasto continua sendo o input por baixo. O cap subiu de 16px para 26px para
"100" caber com folga.

**Grade também alinha a preview e o transporte:** os dois botões de
navegação de estrofe (`#slidePrevBtn`/`#slideNextBtn`, ver "Letra
sincronizada" abaixo) flanqueiam a preview dentro de `.preview-row` — como
essa linha inteira compartilha a mesma faixa de 130px da grade que
`.mixer-mid`, os três (slide-nav esquerdo, os 3 botões do meio do mixer,
slide-nav direito) ficam com o topo/base exatamente alinhados. O botão de
**repetir** (`#repeat`) é o **primeiro** botão de `.transport` (à esquerda de
⏮ ▶/⏸ ⏹ ⏭, com o de playlist por último à direita) — sendo o primeiro
elemento da linha, seu início (borda esquerda) cai exatamente sob
`#slidePrevBtn` da linha de cima, já que ambas as linhas (`.preview-row` e
`.transport`) começam na mesma coluna da grade.

**Título rolante (now-playing):** o nome da mídia em exibição (`#npName`) tem
um span interno (`#npNameInner`); quando o texto não cabe na largura
disponível, `applyTitleMarquee()` liga a classe `.scrolling` e uma animação
ping-pong (`@keyframes np-marquee`) que rola o título de um lado ao outro para
poder ser lido inteiro (distância e duração calculadas pela medição do
overflow e passadas via `--np-shift`/`--np-dur`). Quando cabe, fica estático e
centralizado (com reticências como fallback). Remedido em cada
`renderNowPlaying()` e no `resize` (debounce).

A preview é um `createStage` com `forceMuted: true` que recebe os mesmos comandos
enviados ao Display (função `cmd()` envia ao canal E aplica na preview). A preview
local comanda a barra de progresso e o avanço automático da playlist. Para itens
YouTube, `cmd()` também dirige um segundo `YT.Player` próprio da preview (mudo,
qualidade mínima) — ver seção do YouTube no Display para os detalhes.

**Coluna de botões sobre a preview** (`#pvFabs`, `setupPreviewGestures`):
quatro botões semitransparentes numa **coluna colada à direita**, de cima para
baixo, **visíveis por padrão**. Cada um é `flex:1`, então a coluna se reparte
sozinha pela altura da preview — inclusive quando o de cast não existe
(navegador), onde os três restantes ficam mais altos. O tamanho do ícone vem do
CSS (`17px`), não do atributo do `<svg>`: a altura de cada botão é fração da
preview, e um ícone de 20px estouraria a caixa.

Passaram por dois arranjos antes deste. Primeiro **um em cada canto** —
dispersos, o olho procurava os quatro em lugares diferentes, e o do topo
tampava justamente a parte da miniatura onde costuma estar o texto projetado.
Depois **uma fileira na base** — que sobrava vazio dos dois lados, já que quatro
botões não chegam perto da largura da preview. Em pé, à direita, eles usam a
altura inteira, que é a dimensão apertada aqui (a linha do deck tem 130px).

| Ordem (de cima) | Botão | Ação |
|---|---|---|
| 1 | `#pvSettingsBtn` (engrenagem) | popup de **Exibição** (`openFadePopup`) |
| 2 | `#pvCastBtn` (cast) | seletor de espelhamento do Android (`AVNative.openCast()`) — **só no app nativo**; oculto no navegador |
| 3 | `#pvFullBtn` (expandir) | **tela cheia** da preview (`requestFullscreen` + trava de paisagem) |

> Havia um quarto (`#pvMsgBtn`, mensagem na tela). Ele saiu na v5.31: Mensagens
> virou uma seção da aba **Diversos**. Enquanto era a única ferramenta avulsa o
> FAB se justificava; com três delas, ter uma em cima da preview e duas numa aba
> era a mesma pergunta ("que aviso eu ponho na tela?") respondida em dois
> lugares — e o espaço sobre a preview é o que menos sobra.

São a única indicação de que essas ações existem, e a preview fica na base da
tela o tempo todo; escondê-los por omissão devolvia o problema dos gestos
invisíveis que eles substituíram (toque = tela cheia, toque longo = popup), que
nada na tela anunciava. Um **toque na preview os esconde** (para ver a
miniatura limpa) e outro os traz de volta; **não somem sozinhos** nem ao serem
usados.

Ficam **sempre ocultos em tela cheia** (`.preview:fullscreen .pv-fabs {
display:none }`): sem TV conectada, a tela cheia É a projeção, e um botão
sobreposto iria junto para o telão. `.pv-fabs` é `pointer-events:none` (só os
botões recebem toque), senão a barra cobriria parte da preview e o toque nunca
chegaria ao reconhecedor de gestos.

A **tela cheia** (`requestFullscreen` no `#preview` + `screen.orientation.lock
('landscape')`, permitida só já em fullscreen — padrão de player de vídeo,
destravada no `fullscreenchange`) é a **projeção quando não há telão
conectado**. CSS: `.preview:fullscreen` preenche a tela (cantos retos, sem
borda, `touch-action:none`; as camadas internas já são `inset:0` +
`object-fit`). O popup de Exibição guarda o seletor de **preenchimento da
mídia** (`#fitSeg` — Ajustar/Preencher/Esticar, ver `stage.setFit()`), as
**imagens dos slides** das músicas (`#lyricsBgSeg` — Mostrar/Remover, ver
"Fundo preto vs. imagens dos slides"), o **wallpaper do telão** e o **estado
do telão** no rodapé. As três primeiras são a mesma pergunta — como o telão se
parece —, respondida uma vez e não durante o culto; por isso as imagens dos
slides deixaram o mixer e vieram para cá. As transições (fade) **não têm
controle ali** — são inerentes ao sistema (ver o state `fade`).

**Controle por gestos invisíveis DENTRO do fullscreen:** a tela inteira vira uma
superfície de controle **sem desenhar nada no telão** (o operador espelha a tela
cheia). O reconhecedor distingue cada gesto por **posição (terço esq/central/
dir) + tipo de movimento** e aciona os **botões já existentes** (`.click()`, que
reaproveita os handlers e respeita `disabled` — ex.: estrofe ± vira no-op sem
letra):

| Gesto | Ação | Botão/rota |
|---|---|---|
| Toque terço **central** | Play/Pause | `playPauseEl` |
| Toque terço **esquerdo** | Estrofe anterior | `slidePrevBtnEl` |
| Toque terço **direito** | Próxima estrofe | `slideNextBtnEl` |
| Deslize **←** (horizontal) | Próxima mídia | `nextEl` |
| Deslize **→** (horizontal) | Mídia anterior | `prevEl` |
| Deslize **↑** (esq/central) | Wallpaper on/off | `viewToggleEl` |
| Deslize **↓** (esq/central) | Sair da tela cheia | `document.exitFullscreen()` |
| **Arrastar na vertical** no terço **direito** | Volume (cima=+, baixo=−) | `gSetVolume` (mesma lógica do fader `#volSlider`) |

Limiares: toque `<14px`, deslize `>45px`, volume vertical `>12px` (relativo,
`-dy/(altura*0.6)`). `setPointerCapture` no `pointerdown` garante o rastreio do
arrasto. O terço direito faz **tap = próxima estrofe**, **arrasto vertical =
volume** e **deslize horizontal = mídia** (distintos por eixo/movimento); deslize
vertical no terço direito nunca vira sair/wallpaper (é sempre volume). A config de
preenchimento é persistida em `state.fit`, aplicada ao vivo via comando (`fit`,
Display + preview) e recarregada do state ao inicializar. A de fade **não
existe mais**: é fixa e compartilhada (`createStage.FADE`), sem state nem
comando (ver a chave legada `fade`).

### Wallpaper personalizado

A cortina do telão aceita uma **imagem escolhida pelo operador** no lugar do
gradiente padrão — em "Exibição" (pressionar longo na preview): *Escolher
imagem* / *Padrão*.

- O blob mora no **state `wallpaper`**, que Controle e Display compartilham,
  então o comando `wallpaper` **não carrega payload**: só avisa que mudou, e
  cada lado relê do IDB. (Mandar a imagem pelo canal seria copiar megabytes a
  cada troca, sem ganho nenhum.)
- A imagem é **reduzida para no máximo 1920×1080** (`fitWallpaperImage`) antes
  de ser guardada. O operador escolhe uma foto do próprio celular (12 MP);
  guardar e decodificar isso a cada abertura seria desperdício puro — a
  cortina nunca passa da resolução da TV. Imagens que já cabem são guardadas
  como vieram, sem recompressão.
- A **marca "Audio Visual IASD"** (`.wallpaper-brand`/`.pv-brand`) é ocultada
  enquanto há imagem própria: ela é a identidade do fundo padrão e sobre uma
  imagem escolhida só atrapalharia.
- CSS: a imagem entra como `background-image` inline (vence o
  `background: var(--wallpaper)` da folha) com `background-size: cover` —
  limpar o inline devolve o gradiente. Aplicado em `restore()` (Display) e no
  `init()` (Controle), além do comando ao vivo.

**Botão ⏹ ("Parar e limpar"):** envia `clear` (volta ao wallpaper) mas mantém
`currentId` — o ▶ recarrega e reproduz do início.

**Botão de playlist (`#plBtn`):** mora na própria linha de transporte
(`.transport`), à direita do botão de repetição — não é mais uma aba
separada (`.tabs`); abre o mesmo bottom-sheet com a fila de reprodução de
sempre. Reaproveita o tamanho/estilo de `.t-btn` (a linha de transporte
cresceu de 5 para 6 botões, cada um um pouco mais estreito). O badge de
contagem (`#plCount`) só aparece a partir do **2º item** (mostra
`count - 1`), e o ícone só fica destacado em azul (`.has-items`) nesse mesmo
caso: com apenas a mídia atual em fila, a playlist é só a reprodução avulsa
e não deve chamar atenção nem com um "1" enganoso nem com o ícone colorido —
fica neutro (branco).

### Feedback (sem alerta flutuante)

Não há mais **toast flutuante**. As informações são transmitidas pela própria
interface (estados de botão, contadores, listas). `flash()`/`dismissFlash()` em
`controle.js` viraram **no-ops** — mantidos só para não mexer nos ~25 pontos de
chamada; qualquer mensagem que antes ia pro toast simplesmente não aparece mais.
O único feedback migrado explicitamente para a UI é a **sincronização das
coleções**: `setCollStatus(id, text, autoClearMs?)` grava um subtítulo
no card da coleção (`renderCollectionCard`) — "Atualizando lista…", "Baixando N/T…",
"Já completo offline", "Sem internet — falha ao atualizar" etc. `autoClearMs`
limpa mensagens finais/erro sozinho; o progresso fica até a próxima chamada. O
`.toast` do CSS foi removido.

### Diálogo padrão do app (confirmações / prompts)

`confirm()`/`prompt()` **nativos foram substituídos** por um **modal no tema do
app** (`#appDialog`/`.dialog-*` no CSS + `openAppDialog`/`appConfirm`/`appPrompt`
em `controle.js`) — centralizado, com botão primário azul (accent) e cancelar
neutro. É **assíncrono** (retorna uma Promise): `appConfirm({title, message,
okText, cancelText})` → `true`/`false`; `appPrompt({title, message, value,
placeholder, okText})` → string (OK) ou `null` (cancelar/fora/Esc). Um só
diálogo reutilizável (o DOM é estático no `index.html`); abrir um novo enquanto
outro está aberto resolve o anterior como cancelado. **Toda interação do tipo
usa isto**: excluir pasta sincronizada/virtual/Hinário, renomear, nova pasta e o
aviso de "sem Wi-Fi" da sincronização em massa. (A exclusão de **pasta virtual**,
que antes não confirmava nada, agora também passa por este diálogo.)

### Deslocamento com o teclado virtual

Para o teclado não cobrir listas/preview: o meta viewport declara
`interactive-widget=resizes-content` (o navegador encolhe o layout ao abrir o
teclado). Como fallback (navegadores que não honram o hint), um handler de
**VisualViewport** (`keyboardShift()` em `controle.js`) mede a altura coberta
pelo teclado (`innerHeight - vv.height - vv.offsetTop`) e escreve em `--kb`, que
`body { height: calc(100svh - var(--kb)) }` (controle.css) usa para encolher o
app pra cima. Quando o layout já é redimensionado pelo navegador (ou o teclado
está fechado), a conta dá ~0 e nada muda — os dois mecanismos convivem.

### Modo "mesa de som" (saída de áudio local)

Botão `#standaloneToggle` no mixer (ícone de **fone de ouvido** — SVG inline,
fora do subset da fonte — reforçando "ouvir o áudio aqui"): liga um modo em que
a **preview do Controle passa a tocar o áudio de verdade pelo próprio
aparelho**, em vez de sempre muda — para quando não há intenção de exibir vídeo,
só tocar música
(ex: o celular do operador ligado direto na mesa de som/caixa de som da
igreja, sem precisar nem abrir o Display).

- **Não mexe em nada da comunicação com o Display** — `cmd()` continua
  enviando todos os comandos normalmente (`AVDB.sendCommand`), exatamente
  como no modo normal. Se o Display estiver aberto, ele continua recebendo e
  reagindo aos comandos como sempre; se não estiver aberto, os comandos
  simplesmente não têm quem escute — o Controle não trata esse caso de forma
  especial, nem precisa saber se o Display está ou não em uso.
- `setStandalone(v)` só alterna a saída de áudio da preview, **com rampa curta**
  (a mesma `MUTE_RAMP_TIME` do mudo, 0,25 s) — ligar/desligar não corta o áudio
  na hora:
  - **Ligar**: `preview.setForceMuted(false)` — a preview deixa de ser sempre
    muda e passa a tocar o volume/mudo real que o operador já tiver ajustado; o
    áudio **sobe em rampa de 0 até o alvo**. Se o item atual for YouTube, o
    player da preview (`ytPreview`) é desmutado e sobe pela mesma rampa
    (`ytPreviewRampVolume`, em paralelo).
  - **Desligar**: o áudio **desce em rampa até 0 e só então muta**
    (`preview.setForceMuted(true)`; para o YouTube, `ytPreviewRampVolume` +
    `player.mute()` ao fim da rampa).
- `stage.js` ganhou `setForceMuted(v)`/`isForceMuted()`: `forceMuted` deixou
  de ser fixado na criação do stage (`const`) e virou alternável em tempo
  real (`let`). A troca faz a mesma rampa do `setMute` (`rampVolume` +
  `MUTE_RAMP_TIME`): ao **desativar**, `forceMuted` só liga no **fim** da rampa
  (senão `rampVolume` abortaria de imediato, pois ignora pedidos com
  `forceMuted` já ligado); ao **ativar**, respeita o mudo do operador. Sem mídia
  tocando, aplica na hora (sem rampa, nada a esmaecer).
- **Não é persistido** — cada abertura do app começa em modo normal (preview
  muda), evitando som inesperado saindo do celular numa sessão nova.

### Leitura auxiliar (letra completa / capítulo inteiro)

O telão mostra **uma** estrofe (ou **um** versículo) por vez — o formato certo
para quem assiste, e o errado para quem opera: o operador precisa saber o que
vem depois, e a preview só espelha o que já está no ar. O botão do meio do
mixer (`#lyricsViewBtn`, folha com linhas) abre um bottom-sheet **com scroll**
(`#lyricsPopup`) com a íntegra do que está em cena.

- **Duas fontes, uma tela**: a **letra** da música em cena
  (`currentItem.lyrics`, os mesmos slides que o Display projeta — o slide de
  capa vira a linha "Início") e o **capítulo** da leitura bíblica
  (`bibleSession.verses`, numerados como numa Bíblia impressa). Basta a sessão
  existir: um capítulo fora do ar continua sendo o que o operador está lendo.
- **O seletor do topo (`#lyricsViewSeg`) só aparece quando há as duas** — o que
  acontece de verdade com um louvor de fundo durante a leitura. Com uma fonte
  só, ela abre direto, sem um seletor de uma opção. A escolha manual (`lvSource`)
  vale enquanto aquela fonte existir; sumindo, cai na disponível.
- **É leitura, não operação.** Nenhuma linha projeta nada ao toque: o que vai
  ao telão continua saindo dos botões de estrofe/versículo (`stepSlide`) e da
  tela da Bíblia. Um popup de consulta que também projeta seria a pior hora
  possível para um toque errado.
- **Um BLOCO de texto, não uma pilha de cartões**: cada estrofe/versículo é um
  parágrafo — sem fundo, sem moldura e sem o padding que cada cartão cobrava.
  Numa tela de celular aquilo custava mais da metade da altura em enfeite, e a
  letra é justamente o que se quer ver de uma vez. O destaque do que está no ar
  virou uma **barra na margem + a cor de acento**; todas as linhas têm o mesmo
  `padding-left` (com a borda transparente nas demais), então o texto não se
  desloca quando a estrofe muda. Na Bíblia o número do versículo entra na linha
  do texto, como numa Bíblia impressa.
- **Acompanha sozinho, mas não disputa**: a linha no ar fica destacada
  (`.lv-row.current`) e a lista rola até centralizá-la — até o operador rolar
  com o dedo (`lvFollow`, desligado no primeiro `pointerdown`/`wheel`, religado
  ao reabrir ou ao trocar de fonte). Sem isso, ler adiante seria impossível:
  a estrofe seguinte puxaria a lista de volta no meio da leitura.
- **Sem timer próprio**: `refreshLyricsView()` é chamada de `renderSlideNav()`,
  que já roda a cada tick de tempo e a cada troca de versículo/mensagem. Com o
  popup fechado custa uma comparação de classe. Uma **assinatura** do conteúdo
  (`lvSignature`) decide entre re-renderizar (trocou a música, o capítulo ou a
  disponibilidade das fontes) e só mover o destaque — e ela inclui a lista de
  fontes DISPONÍVEIS, não só a ativa: começar a leitura bíblica com um louvor
  tocando não muda o que está na frente, mas passa a haver o que alternar.

### Onde o Display roda

O Display **não é mais um app que se abre**. No aparelho ele é a
`android.app.Presentation` que o shell nativo cria sozinho na TV assim que uma
tela de apresentação aparece — e recria quando o dongle cai e volta (o WebView
recarrega `/display/`, dispara `display-ready` e o Controle reenvia o estado
atual). Por isso o rodapé do popup de Exibição (`#openDisplayBtn`) é um
**indicador de estado**, alimentado ao vivo por `AVNative.displays()` +
`onDisplayChange`: "Telão conectado: <nome> (<w>×<h>)" ou "Nenhum telão
conectado".

**Sem telão conectado**, a projeção é a **preview em tela cheia** (botão de
expandir sobre a preview) — o operador espelha a tela inteira do celular, o que
funciona em qualquer aparelho. É por isso que a tela cheia e seus gestos
invisíveis continuam existindo.

No **navegador** não há Presentation: o mesmo rodapé volta a ser um atalho
(`window.open('../display/', '_blank')`) para abrir a tela do Display numa
janela à parte — útil para desenvolver a base web fora do app, e nada mais.

### Abas e biblioteca

As abas ficam na **base da seção de listas** (ícones), num **trilho com fundo
próprio** (`--bar` + borda `--line`). Até a v5.31 a faixa era transparente
("mesclada ao fundo do app") e um botão inativo era indistinguível do vazio ao
redor: a única pista de que ali havia alvos de toque era o ícone. Hoje cada aba
tem fundo (`--surface`) e a **ativa é preenchida em accent** — o sublinhado de
2 px de antes era o elemento de menor contraste da tela justamente no que
precisa ser mais óbvio, "onde eu estou". O **botão de busca** (`.tab-add`)
passou a ser **contornado** em vez de preenchido: encostado numa aba ativa
sólida, dois azuis cheios diriam a mesma coisa para naturezas diferentes — um é
onde eu estou, o outro é uma ação. São **quatro**:
**Cronograma** · **Álbuns** · **Bíblia** · **Diversos** (as `.tab`, `flex:1`) ·
**buscar no acervo** (`#hymnSearchBtn`, `.tab-add`, à direita):

- **Cronograma** (`imports`) — itens importados; ficam até serem excluídos.
- **Álbuns** (`albums`) — o acervo do LouvorJA, agrupado por categoria. Ver
  "Coleções de mídia (LouvorJA)".
- **Bíblia** (`bible`) — seleção e projeção de textos bíblicos. Não é uma lista
  de mídia; ver a seção **"Bíblia"** abaixo.
- **Diversos** (`activeTab` segue sendo `'mic'`, por herança) — as **ferramentas
  que não são acervo**: **Mensagens**, **Tempo** (relógio/cronômetro/timer) e
  **Sorteio**, escolhidas num seletor no topo, mais o rodapé com **microfone** e
  **"Projetar no telão"**. Ver "Diversos" abaixo.

> A aba nasceu como **Microfone**, com uma ferramenta só. Ao ganhar a segunda,
> virou **Diversos** e o ícone deixou de ser o microfone: com mais de uma coisa
> dentro, um glifo que nomeia só uma delas esconde o resto. O `data-tab`
> continua `mic` de propósito — renomeá-lo não mudaria nada visível e quebraria
> o `TAB_ORDER`, o `scrollKey()` e as guardas espalhadas que já falam essa
> string.

**Duas telas saíram da faixa de abas**, cada uma por um motivo próprio:

- **Favoritos** (`activeTab` segue sendo `'folders'`) — atalhos criados pelo
  operador e pastas do dispositivo sincronizadas no OPFS. Continua sendo um
  `activeTab` (com toda a navegação interna: abrir, buscar, sincronizar), mas
  chega-se a ela pelo **botão ao lado de "Importar arquivos"**, no fim do
  Cronograma: as duas respondem à mesma pergunta — "de onde vem a mídia?" — e
  ficam onde o resultado delas aparece. O `#backBtn` passa a aparecer também
  na **raiz** dos Favoritos (é a única saída de lá) e `navigateBack()` volta
  ao Cronograma; `renderTabs()` mantém o Cronograma aceso enquanto se está
  neles, para a faixa não ficar sem nada marcado.
- **Mensagens** — foi para a aba **Diversos** (v5.31), como seção do acordeão.
  Antes era um botão flutuante sobre a preview; ver "Diversos" abaixo.

**Importar arquivos e Favoritos** (`appendImportRow`) são a **última linha da
lista do Cronograma** (`.import-row` com dois `.import-btn` lado a lado,
tracejados, separados da lista por uma margem). O `<input type="file"
multiple>` continua sendo o mesmo elemento de sempre (`#file`, com o listener
de `change` já registrado) — ele mora solto no `index.html` e é **movido** para
dentro do `<label>` a cada render, porque `libraryEl.innerHTML = ''`
destruiria um input criado ali. A linha não aparece dentro de pasta nem em modo
de seleção múltipla.

**Navegação persistente:** trocar de aba **não** reseta a pasta aberta nem a
busca — voltar para os Favoritos retorna exatamente onde estava. A posição de scroll
é guardada por aba/pasta (`scrollPos`, chave `scrollKey()` = aba + id da pasta)
e restaurada ao fim de cada `load()`; `rememberScroll()` é chamado antes de
trocar de aba, abrir pasta ou voltar. (Memória por sessão, em RAM.)

**Animação de troca de aba** (`animateTabSwitch`): ao trocar de aba, a lista
`#library` entra com um leve **deslize direcional + fade** (Web Animations API
na própria lista, ~220 ms). A direção vem da ordem das abas (`TAB_ORDER =
['imports','folders','albums','bible']`): ir pra uma aba à **direita** desliza entrando
da direita (`translateX(22px)→0`), à esquerda o contrário. Como o `load()`
reconstrói o conteúdo em poucos ms, animar já a partir de `opacity:0` esconde a
troca e revela o conteúdo novo entrando; o `overflow:hidden` do `main` clipa o
deslize (não vaza horizontalmente). Respeita `prefers-reduced-motion` (sai cedo).

**`load()` tem guarda de sequência** (`loadSeqCtl`, como o `loadSeq` do
stage): é async e disparada fire-and-forget por dezenas de handlers, então
duas chamadas concorrentes poderiam terminar fora de ordem e a mais antiga
sobrescreveria o estado/render da mais nova. `load()` lê tudo do IDB em locais
(as contagens das pastas em `Promise.all`, não mais um `await` sequencial por
pasta a cada micro-mudança) e só aplica ao estado do módulo + renderiza se
`myseq === loadSeqCtl` — senão descarta.

Miniaturas (160×160 px, JPEG 72%) geradas via Canvas no momento da importação.
Vídeos têm thumbnail extraído de um frame perto do início — `min(0,5 s,
duração/3)`, ou seja, 0,5 s para qualquer vídeo acima de ~1,5 s (evita seek
longo/lento; timeout de 3,5 s).
Itens sem blob local exibem badge `URL` ou `YT`.

### Gestos nos itens da biblioteca

| Gesto | Ação |
|---|---|
| Toque simples | **Substitui a playlist por este item** e o exibe no Display |
| Deslize à esquerda | **Adiciona** à playlist (sem substituir) |
| Segurar e arrastar (⠿) | Reordena o item na lista |
| Pressionar e segurar | Entra no modo de seleção múltipla |

**O arrasto mede a lista UMA vez** (`measureDrag`, no `pointerdown`; um listener
de `scroll` remede se a lista rolar, e `endDrag` limpa tudo no fim). Antes, cada
`pointermove` — 60 a 120 por segundo — fazia um `querySelectorAll` da lista
inteira e um `getBoundingClientRect` por item, logo depois de escrever
`li.style.transform`: um **reflow síncrono por evento**, com o arrasto
engasgando num Cronograma grande. As posições não mudam durante o arrasto (o
item se move por `transform`, que não altera o layout), então medir uma vez
basta. `showDropLine` e `dropIndex` leem o mesmo cache — a linha-guia e o
destino real nunca discordam.

**Modo de seleção múltipla:** barra substitui as abas, com contagem e botões de
adicionar aos favoritos, renomear (1 item) e excluir. Os itens selecionados são
indicados **só pelo highlight azul** (`.lib-item.selected` — borda accent), sem
ícone de check; a miniatura fica sempre encostada à esquerda (não há coluna
reservada). Excluir dentro de pasta virtual só remove da pasta; nas demais abas
usa `listRemove` (com gc).

### Favoritos (atalhos + pastas do dispositivo)

A tela é a **seção de atalhos organizados** do app: o caminho curto para o que
o operador usa toda semana. O mecanismo por baixo é o mesmo de sempre — pastas
virtuais (`state.folders` + `folder_<id>`) e pastas do dispositivo
sincronizadas no OPFS (`state['opfs-folders']`), com as MESMAS chaves de state
(renomear a leitura não pode custar a biblioteca de ninguém) —, o que mudou é o
enquadramento: não é "onde os arquivos moram", é "o que eu marquei".

A lista tem duas origens, cada uma sob um cabeçalho próprio (`appendFavSection`,
`.fav-section`), porque as duas se comportam igual ao toque e só uma delas
sincroniza:

1. **Atalhos** (`renderVirtualFolders`) — grupos criados pelo operador, ícone
   de **estrela** (`ICON.star`, glifo que já estava no subset e voltou a ter
   uso). Recebem itens pela seleção múltipla ("Adicionar aos favoritos",
   `#selFolder` → `#folderPopup`) e agora também podem ser criados **na própria
   tela**, pelo botão "Novo atalho" no fim da lista (`appendNewFavoriteRow`):
   uma seção de atalhos que não deixa criar um atalho é justamente o que não se
   espera dela. Excluir um atalho não apaga mídia nenhuma.
2. **Pastas do dispositivo** — as pastas sincronizadas no OPFS, com o botão de
   re-sync e o de excluir, exatamente como antes (detalhes abaixo).

- **Pastas sincronizadas (OPFS)** — o fluxo principal para bibliotecas grandes.
  `window.showDirectoryPicker()` pede permissão **uma única vez**, na
  sincronização: os arquivos de mídia são **copiados em streaming para o OPFS**
  (`folders/<folderId>/<arquivo>`) e catalogados no store `files` (metadados +
  thumbnail gerada na hora). Depois disso, abrir o app, listar, buscar e
  reproduzir **nunca pede permissão** — o catálogo responde na hora e o stage
  resolve os bytes do OPFS sob demanda.
  - **Re-sync** (botão na linha da pasta): tenta reutilizar o handle salvo em
    `opfs-folders` (browsers que persistem permissão nem mostram prompt) e cai
    no picker se necessário. Arquivos com mesmo nome+tamanho+data são pulados;
    novos/alterados são copiados. A sincronização é **aditiva** — nada é
    excluído automaticamente. Sem indicador flutuante de progresso (o toast foi
    removido — ver "Feedback / sem alerta flutuante" abaixo); ao terminar, a
    contagem da linha da pasta é re-renderizada com o total atualizado.
  - `navigator.storage.persist()` é solicitado na sincronização para proteger
    os arquivos contra descarte do browser; o rodapé da aba mostra o uso via
    `navigator.storage.estimate()`.
  - Itens da pasta têm botão ➕ que adiciona o **id do catálogo** ao Cronograma
    (zero-cópia — `getMedia` resolve pelo fallback). Seleção múltipla permite
    renomear e excluir (exclui do OPFS + catálogo + remove das listas).
  - Excluir a pasta (com `confirm()`) apaga o diretório OPFS inteiro, os
    registros do catálogo e as referências em listas.
- **Atalhos (pastas virtuais)** — criados pelo usuário (state `folders` +
  `folder_<id>`); recebem itens pelo botão "Adicionar aos favoritos" da seleção
  múltipla (funciona também com IDs do catálogo OPFS) e nascem vazios pelo
  botão "Novo atalho". Excluir o atalho não exclui as mídias.

### Coleções de mídia (LouvorJA)

Integração com o catálogo público do app **LouvorJA** (`api.louvorja.com.br`,
mesmo backend usado pelo app `app-ja`), para trazer **todo o acervo** como fonte
de mídia offline, sem copiar nenhum código do app-ja (Vue/Vuex) — só o
**protocolo HTTP** dele é reaproveitado, via um cliente próprio e mínimo:
`controle/louvorja.js` (`window.Louvorja`, JS puro, sem dependências).

> 📄 **Referência completa da fonte de dados:**
> [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md) documenta
> **toda** a estrutura técnica classificatória do banco compartilhado (endpoints,
> token, convenção de nomes dos arquivos `json_db` e o schema de cada tipo —
> `music_{id}`, `album_{id}`, listas de músicas/hinários/coletâneas/bíblia,
> `config`, servidor de arquivos). Consulte-o para pedir **qualquer** arquivo do
> sistema sem precisar abrir o repositório do `app-ja`.

#### O número é do HINÁRIO, não da faixa (v5.42)

`collNumbersSongs(coll)` decide, e `songLabel(coll, s, pad)` é o único lugar
que monta o rótulo — lista da coleção, busca, nome do arquivo baixado e slide
de capa passam todos por ali (ou pelo `hymnTrack` que ele governa).

Num hinário o número **é** o nome da música: pede-se "o 471", e a numeração é
a mesma no hinário impresso de todo mundo. Num álbum, `track` é só a posição no
disco — um dado de catálogo que ninguém usa para pedir nem para achar. "12. Ele
Vem" não ajuda a reconhecer nada, e numa busca global punha uma coluna de
números sem significado na frente de todo título de álbum.

Três consequências, e a terceira é a que menos se vê:

- **`hymnTrack` fica nulo fora de hinário.** É o número NO HINÁRIO, não a faixa
  do disco. Com isso o slide de capa, o título do popup de letra e a preview
  param de numerar sem precisar conhecer coleção nenhuma — nenhum deles tem
  acesso a ela (o Display, em especial, só recebe o registro do arquivo).
- **A busca por NÚMERO passa a valer só onde o número identifica.** Digitar "3"
  trazia a faixa 3 de cada álbum indexado — dezenas de resultados que ninguém
  pediu, empurrando o hino 3 para o fim da lista.
- **Uma passagem única corrige o que já está baixado**
  (`desnumerarAlbunsBaixados`, estado `migSemNumeroAlbuns`). Só parar de
  escrever deixaria numerada para sempre a biblioteca que o operador já tem.
  Ela remove o prefixo `N. ` do nome e zera o `hymnTrack` nos arquivos das
  coleções que não numeram — não recalcula o nome a partir de `hymnName`
  porque o mesmo registro cobre importados e variantes, e tirar o prefixo é a
  operação exata.

- **`Louvorja.fetchList(file)`** — `GET {url-base}/{file}?{YYYYMMDD}` com
  header `Api-Token`, mesmo formato do `Database.js` do app-ja (URL de
  produção + token embutidos no arquivo — já públicos no bundle do app-ja,
  não é um segredo protegido).
- **`Louvorja.fileUrl(path)`** — resolve um campo de URL do banco (ex:
  `url_music`) para a URL completa de download do arquivo.
- Arquivos consumidos: as **listas** `pt_hymnal`/`pt_hymnal_1996` (hinários) e
  `pt_categories` (catálogo de álbuns → `album_{id}`); o **registro individual**
  `music_{id_music}` (com `url_music`, `url_instrumental_music`, `url_image`,
  letra). Constantes de conveniência: `Louvorja.HYMNAL_2022_FILE`,
  `HYMNAL_1996_FILE`, `CATEGORIES_FILE`.

#### Sistema de coleções (genérico)

O que antes era exclusivo do Hinário 2022 virou um **sistema genérico de
coleções**, todo parametrizado por uma `coll = { id, name, kind, source, iconKey }`
(ver `allCollections()`/`FIXED_COLLECTIONS` em `controle.js`). Cada coleção tem
**uma pasta OPFS própria** (`folders/<coll.id>/`) e um **card** no acervo (o
estado padrão da busca; até a v5.43, a aba Álbuns).
Dois tipos:

- **`hymnal`** (fixas): a `source` é um arquivo de **lista** (`pt_hymnal`,
  `pt_hymnal_1996`) que já é o índice completo de hinos. Sempre visíveis; o
  índice leve é atualizado sozinho (`autoRefreshCollections`).
- **`album`** (dinâmicas): descobertas em `pt_categories`
  (`fetchAlbumCatalog` → `state.albumCatalog`, um card por álbum, agrupados
  por categoria). O índice de
  cada álbum vem de `album_{id}.musics` e é buscado **automaticamente**
  (`autoRefreshCollections`, fase 2 — só metadados, sem áudio), com
  concorrência limitada e um TTL (`ALBUM_INDEX_TTL`, 12 h) pra não refazer N
  requisições a cada retomada; álbuns novos/vazios são sempre buscados. Assim a
  busca do acervo cobre **todas** as músicas de **todos** os álbuns mesmo sem
  nada baixado (tocar num resultado baixa sob demanda — igual ao hinário).
  Álbuns cujo nome parece de hinário são pulados (já têm card dedicado).

O himnário em espanhol e demais idiomas ficam de fora naturalmente — só
consumimos arquivos `pt_*`.

**Estado por coleção**: `state['coll:<id>'] = { indexSyncedAt, songs:[…] }`;
fonte de verdade em memória (`collState`, carregada uma vez no `init` por
`loadCollections()`). **Migração**: o antigo `state.hymnal2022` é copiado para
`coll:hymnal-2022` (mesma pasta OPFS `hymnal-2022` — downloads já feitos
continuam válidos). UI transitória (sync em andamento, status, peso) fica em
`collUI` (não persistida).

**Aba Álbuns** (`data-tab="albums"`): `renderCollectionsList` renderiza um card
por coleção (`renderCollectionCard`), **agrupados por categoria** — os dois
hinários num grupo fixo no topo, depois cada categoria do banco. No topo, uma
faixa de **pílulas de filtro** (`.coll-filters`: Todos · Hinários · uma por
categoria, `albumFilter`): com dezenas de álbuns em várias categorias, rolar a
lista inteira para achar um grupo é lento. Uma categoria sem nenhum card
visível não vira pílula (levaria a uma lista vazia), e os álbuns órfãos — os
que categoria nenhuma reivindica — só aparecem em "Todos". O filtro é estado de
sessão, não persistido: cada abertura mostra o acervo inteiro. O card do Hinário **saiu da tela de pastas** (hoje os **Favoritos**, que voltou
a ser só atalhos e pastas do dispositivo).

Os mecanismos abaixo (sincronização/download/letra/Wi-Fi/busca) valem **por
coleção**, exatamente como antes valiam só pro Hinário 2022.

#### Baixar a coleção COMPLETA (`syncGroup`)

O cabeçalho de cada grupo (`.coll-group`) deixou de ser só um rótulo: ele
carrega o **resumo do grupo inteiro** (`baixados/total`, somando todos os
álbuns dali) e o botão que **baixa a coleção completa** — "CDs Oficiais/Ano"
tem uma dúzia de álbuns, e sincronizar um a um pela engrenagem de cada card era
uma dúzia de idas ao popup. Vale para os três tipos de grupo: os hinários, cada
categoria do banco e os álbuns órfãos.

Com um filtro de categoria ativo o cabeçalho **omite o nome** (a pílula
selecionada já diz qual é) mas continua existindo — o que estava lá antes era
redundante, o que está lá agora é uma ação.

- **Um álbum por vez, nunca em paralelo** — e isso não custa velocidade: o
  limite de conexões é por HOST, não por álbum (ver `NET_CONCURRENCY`). Dois
  álbuns com 3 downloads cada dariam exatamente as mesmas 6 conexões que um
  álbum com 6, só que com o progresso fragmentado e mais estado concorrente.
- **A pergunta de rede é feita UMA VEZ para o lote.** Fora do Wi-Fi, um
  diálogo com a contagem de álbuns e a estimativa somada; a resposta é
  repassada a cada `syncCollection` via `opts.allowMobile`, então nenhum deles
  pergunta de novo. Sem isso seriam doze diálogos seguidos, que ninguém lê — e
  a decisão continua sendo do operador, como manda a política de Wi-Fi.
- **O lote inteiro é UMA tarefa de segundo plano** (`withBgWork` em volta do
  laço, não por álbum): senão o `SyncService` seria desligado no fim de cada
  álbum e o processo podia ser congelado justamente entre um e outro — que é o
  cenário normal, já que o operador dispara e sai do app.
- **Cancelável na próxima MÚSICA, não no próximo álbum.** Durante o download o
  botão vira ✕; o toque marca `cancel`, e esse sinal **atravessa o álbum em
  curso** (`opts.cancelled`, lido pelo `worker` de `syncCollection`). Parar só
  entre álbuns era, na prática, não poder parar: há álbuns de centenas de
  faixas, e o operador ficava preso ao lote inteiro depois de mudar de ideia.
  Medido com o código real (600 faixas): o cancelamento custa **6 músicas**, as
  que já estavam no ar.
- Estado transitório em `groupUI`/`gui(key)` (não persistido), com
  `setGroupStatus` espelhando o `setCollStatus` dos cards — logo, o progresso
  também passa pelo re-render coalescido.
- **A notificação do sistema acompanha o LOTE**, não cada álbum: o total é a
  soma das músicas pendentes de todos eles, contada uma vez no começo
  (`bgTaskStart` no `syncGroup`, e `syncCollection` recebe `notifOwned` para
  não abrir uma tarefa própria). Ver "Progresso em segundo plano".

**Baixar TODO o acervo** é o mesmo mecanismo com todas as coleções: um
cabeçalho "Todo o acervo" no topo, visível **só em "Todos"** — com um filtro
ativo "tudo" seria ambíguo (tudo do filtro? tudo mesmo?), e o cabeçalho da
categoria já cobre o primeiro caso. Ele confirma **sempre**, mesmo no Wi-Fi
(`opts.confirmScale`), com a contagem de coleções, de músicas pendentes e o
tamanho estimado: a pergunta de rede é sobre o plano de dados, esta é sobre a
escala, e são perguntas diferentes. Com tudo já baixado ele não abre diálogo
nenhum — só responde "Acervo já completo offline".

#### Concorrência de download (`NET_CONCURRENCY`)

Quantas requisições ficam em voo ao mesmo tempo — usada pelo download de
músicas (`syncCollection`), pela Bíblia e pela atualização de índices.

**6 é o teto de conexões simultâneas por host** do motor do WebView em
HTTP/1.1, medido no Chromium com um servidor de latência (36 arquivos de
400 KB, 250 ms de RTT), mediana de 3 rodadas:

| concorrência | tempo | ganho | pico real de conexões |
|---|---|---|---|
| 3 | 3,24 s | (base) | 3 |
| **6** | **1,77 s** | **+82%** | **6** |
| 8 | 1,71 s | +89% | 6 |
| 12 | 2,05 s | +58% | 6 |
| 24 | 1,77 s | +83% | 6 |

De 3 para 6 o download quase **dobra**; acima de 6 o navegador enfileira e não
há ganho — só mais Blobs em memória ao mesmo tempo. Como cada música é baixada
**sequencialmente** (metadados → capa → Cantado → Playback, com as imagens de
estrofe em série por causa do cache compartilhado `resolveImage`), a
concorrência do laço é exatamente o número de conexões: é este o parâmetro que
importa, e não "quantos álbuns ao mesmo tempo".

Ressalva honesta: se o servidor do LouvorJA falar HTTP/2, o limite de 6 não se
aplica (multiplexação) — mas aí o gargalo passa a ser banda, e mais streams
paralelos também não aumentariam o total. 6 é seguro nos dois cenários. O
protocolo real não pôde ser verificado (a rede de desenvolvimento não alcança
`api.louvorja.com.br`).

#### Progresso em segundo plano (`bgTaskStart`/`bgTaskStep`)

Com o app minimizado — o uso normal durante uma sincronização — a notificação
do `SyncService` é a única janela para o download, e era um texto fixo. Quem
sabe o progresso é o lado web, então é ele que reporta, por
`AVNative.bgProgress({label, done, total, etaMs, items, idleMs})`.

Instrumentados: `syncCollection` (por música), `syncGroup` (por música, no
total do lote), `ensureBibleVersionDownloaded` (por capítulo) e
`syncDeviceFolder` (por arquivo).

- **A notificação mostra O QUE está baixando.** `bgItemStart`/`bgItemEnd`
  registram os itens em voo por tarefa (`bgItemOnly` para fluxos sequenciais,
  cujos `continue` deixariam nomes presos na lista). "23 de 54" é abstrato;
  "002. Ó Adorai o Senhor" é o que o operador reconhece.
- **A lista é uma FILA (`t.fila`), não um espelho do que está no ar.** A
  concorrência existe para reduzir o tempo PROPORCIONAL de cada item: se os 6
  juntos levam X, cada um custou X/6 — e a exibição segue a mesma conta, dando
  X/6 de tela a cada nome. É deliberadamente **ilustrativo e não em tempo
  real**; contador, barra e estimativa seguem sendo os números reais.
- **Fila, e não rodízio entre os itens em voo.** O rodízio repetia nomes e a
  lista não avançava. A fila consome cada um UMA vez, em ordem. Medido (18
  faixas, 6 em paralelo): **18/18 exibidos, 0 repetidos, em ordem, fila
  zerada**.
- **O ritmo é MEDIDO** (`bgSpinMs` = `decorrido / concluídos`), não chutado:
  mediana de **500 ms em tela contra 521 ms de custo amortizado real**; com
  faixas irregulares, 750 contra 750. Fila acumulando (rede acelerou) → escoa
  proporcionalmente mais rápido, para não exibir passado velho.
- **Sem o buffer a lista engasgava.** Os 6 workers andam em lockstep: entram e
  saem quase juntos, então os eventos chegam em RAJADA (meia dúzia em poucos
  ms) seguida de segundos de silêncio. Sem fila, a rajada rendia UMA troca de
  nome e o resto era descartado — parado até a rajada seguinte, exatamente a
  sensação de travado.
- **O compasso PARA quando trava** (`BG_STALL_MS`, 90 s sem evento real):
  animar durante uma queda de rede esconderia justamente o que precisa ser
  visto, e ali não há novidade a mostrar, só passado. A lista congela e o
  `idleMs` cresce — os dois sinais concordam. Verificado: 6 nomes distintos em
  operação normal, 1 só com a tarefa travada.
- **`idleMs`** separa "travado" de "esta faixa é grande". Passado o limiar, a
  notificação para de prometer tempo restante (uma ETA sobre um ritmo que já
  não existe é a promessa mais enganosa possível) e passa a "sem resposta há
  X" — sem degraus, porque aqui o número precisa SUBIR a cada atualização.
- **O freio é por PRIORIDADE, escolhida pelo chamador**: 250 ms para um item
  que ENTROU em download, 700 ms para rotina. Explícita, e não deduzida de "o
  nome mudou": no laço do worker o fim de uma música e o início da seguinte
  distam poucos ms, e disputando o mesmo piso o fim derrubava o início — que é
  o fato mais fresco.
- **`bgTasks` é um REGISTRO (Map), não um slot único.** Downloads simultâneos
  existem — é por isso que `bgWorkCount` conta em vez de ser booleano — e com
  um slot só as tarefas se sobrescreviam: o `done` de uma saía com o `total` e
  o relógio da outra, e a estimativa pulava de 1h30 para 2h40 e voltava. A
  notificação mostra a **dominante** (maior tempo restante) e marca as demais
  com `(+N)`.
- A **estimativa de tempo** sai do ritmo médio desde o **primeiro item
  concluído** (`decorrido/concluídos × restantes`) — não desde o `start`, que
  incluiria o preparo (índice, varredura) e inflaria a primeira leitura. Média,
  não taxa instantânea: faixas têm tamanhos muito diferentes.
- **Suavização assimétrica por constante de tempo** (`ETA_TAU_DOWN` 2,5 s /
  `ETA_TAU_UP` 10 s) e **arredondamento em degraus** no lado nativo: a série
  passa a ser uma contagem regressiva de verdade (2h20 → 2h10 → 2h → …), em vez
  de um número que sobe e desce. Por tempo, e não por chamada: o compasso de
  1 s pede a estimativa muito mais vezes que os eventos pediam, e um fator fixo
  por chamada devolveria o número instável.
- **Intervalo mínimo de `BG_NOTIF_MIN_MS` (700 ms)** entre atualizações: o
  Android limita a taxa de updates de notificação e passa a descartá-los; sem
  o freio, uma faixa curta atualizaria várias vezes por segundo e a barra
  pareceria travada. O estado final é enviado com `force`, ignorando o freio.
- No navegador, e num shell anterior ao `SHELL_VERSION` 10, é no-op.

**Duas camadas, independentes** (`state['coll:<id>']`, ver tabela acima):

1. **Índice** (leve, só metadados) — permanece offline assim que sincronizado
   uma vez; é o que alimenta a busca (item 2 abaixo) mesmo antes do download
   pesado terminar.
2. **Download** (pesado) — para cada hino do índice, baixa o áudio Cantado
   (`url_music`) sempre e o Playback/instrumental (`url_instrumental_music`)
   quando existir, mais a capa e as imagens por estrofe (ver "Letra
   sincronizada" abaixo) — grava tudo no **mesmo catálogo OPFS das pastas
   sincronizadas** (`AVDB.fileAdd` + `AVDB.opfsWriteFile`, pasta da coleção
   `folders/<coll.id>/`), então listar, buscar, tocar e excluir dentro dele
   funciona **sem nenhum código novo** — é só mais uma pasta OPFS (ver
   "Favoritos" acima), só que a fonte da sincronização é uma API remota em vez
   de `showDirectoryPicker()`.

**UI — o card É o álbum; a manutenção mora atrás da engrenagem**
(`renderCollectionCard()` + `.hymnal-card` no CSS): cada coleção é uma **linha
só** — símbolo + nome (+ subtítulo da categoria) + **resumo de sincronização**
(`baixados/total`, ou o progresso ao vivo enquanto sincroniza) + um botão de
**engrenagem**. **Tocar no card abre a LISTA DE MÚSICAS** (`openCollectionSongs`),
que é o que o operador quer quase sempre; sem índice ainda, o toque leva às
opções, que é justamente onde está o sincronizar que resolve isso.

O card ganha uma **faixa lateral** com a `color` que o álbum tem no banco
(`--coll-color`, escrita no `style` pelo JS) — identidade visual que vem de
graça no catálogo, sem baixar nada.

> Antes o card era um **acordeão de "check do sistema"**: tocar nele expandia
> um painel de status, e as músicas só eram alcançáveis por um botão "Ver
> músicas" na barra ou pela busca do acervo. Ou seja, o toque natural no álbum
> fazia a coisa menos útil. O acordeão (`ui(coll.id).expanded`) e o botão de
> sincronizar da barra deixaram de existir.

**Opções da coleção** (`openCollectionOptions` → bottom-sheet `#collPopup`):
tudo que é manutenção, fora do caminho de uso — **linha de status** (progresso
via `setCollStatus`, ou "✓ Completo offline" em verde quando `downloaded ===
total`, ou "Parcial…"/"Não sincronizado"), a faixa de **estatísticas** (chips
`.hymnal-stat`): **Sincronizados** (`downloaded/total`), **Peso**
(`fmtBytes(ui(coll.id).bytes)`) e **Rede** (Wi-Fi
confirmado × "Aguardando", ícone de Wi-Fi SVG inline — ver `isConfirmedWifi`);
e os botões **Sincronizar/Atualizar** (`syncCollection`) e **Excluir baixado**
(`deleteCollection`). Não há "Ver músicas" aqui: a lista é o **toque no card**,
e ter duas rotas fazia o popup competir com o gesto principal.

**O botão de sincronizar é o mesmo botão de CANCELAR.** Com o download em
curso ele vira ✕ ("Cancelar o download", classe `.cancel` — âmbar e **sem
giro**: um ✕ girando não se lê como "toque para parar", e quem indica
atividade é o status acima). Antes, um segundo toque caía num `return` mudo
por `u.syncBusy`: um álbum de centenas de faixas, uma vez começado, só parava
fechando o app. O cancelamento **fecha a fila** — nenhuma música nova entra e
as que já estão no ar (até `NET_CONCURRENCY`) terminam. Abortar no meio de um
download deixaria um arquivo truncado catalogado como completo, e o custo de
esperar é uma faixa, não um álbum. `u.cancel` também é conferido na
**varredura** do que falta (`songVariantsNeeded` por música), que num álbum
grande já é demorada por si só.

`refreshCollectionOptions()` é
chamado por `refreshCollectionsIfVisible()`, então o progresso da
sincronização aparece no popup aberto sem fechar e reabrir.

**O peso NÃO é recalculado durante o render.** `updateCollBytes` faz um
`filesByFolder` — um `getAll` da index que desserializa TODOS os registros da
pasta, **com thumbnail e letra**, só para somar um campo. Como
`renderCollectionCard` o chamava, e o valor mudar dispara outro
`refreshCollectionsIfVisible`, sincronizar uma coleção com a aba aberta
executava N `getAll` do catálogo (N = número de cards, dezenas a centenas) a
cada música baixada. Hoje: `downloadCollectionFile` **soma o `blob.size`** ao
cache (`ui(id).bytes`), sem tocar o IDB, `deleteCollection` zera, e o
recálculo completo só roda ao **abrir** o popup de opções — uma coleção, uma
vez.

**E o re-render é coalescido** (`refreshCollectionsIfVisible` agenda,
`renderCollectionsNow` executa; `COLL_REFRESH_MS` = 400 ms). O progresso chama
isso uma vez por música: sincronizar o Hinário 2022 reconstruía a lista inteira
613 vezes. A resposta ao TOQUE continua imediata — `syncCollection` chama
`renderCollectionsNow()` direto ao ligar o `syncBusy`; só o progresso, que é
informativo, espera a janela.

Sincronização é **aditiva e resumível**: interromper e sincronizar de novo só
baixa o que falta (`fileGet` reconfirma que o arquivo catalogado ainda existe
de fato antes de pular — cobre até exclusões manuais feitas por dentro da
pasta via seleção múltipla).

#### Classificação: categoria → álbum (a hierarquia do banco)

O acervo do LouvorJA tem **dois níveis, e só isso: categoria → álbum →
música** — não há grupo acima da categoria nem subcategoria (confirmado no
código do app-ja; ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.5). A relação
categoria↔álbum é **N:N**, e `subtitle`/`order` são campos do **pivô**: variam
conforme a categoria em que o álbum é mostrado.

`state.albumCatalog` guarda essa hierarquia inteira —
`{ categories: [{ id_category, name, order, albums: [{ id_album, subtitle,
order }] }], albums: [{ id_album, name, color }] }`. `albums` é o índice
deduplicado que dá identidade a cada card (vira `coll.id`); `categories`
preserva a classificação. **Até a v4.90 isto era um array achatado
`[{id_album, name}]`** — que jogava fora exatamente a classificação que o
operador precisa para achar um álbum entre dezenas. `loadCollections()` aceita
o formato antigo e a próxima `fetchAlbumCatalog()` traz a hierarquia.

`renderCollectionsList()` renderiza **cabeçalhos de categoria** (`.coll-group`)
na ordem do banco (`category.order`), com os álbuns de cada uma também na
ordem do banco (`album.order` do pivô), e os **hinários num grupo fixo no
topo**. Como a relação é N:N, **o mesmo álbum aparece em mais de uma
categoria** — de propósito, é assim no banco e no app original, e o subtítulo
muda junto. Álbuns que nenhuma categoria reivindica (catálogo migrado, ou
álbum removido de todas) caem num grupo "Outros álbuns", em vez de sumirem.

**Álbum que é hinário disfarçado** (`isHymnalAlbum`): se
`album_{id}.categories` contém uma string começando com `hymnal.`, aquele
"álbum" é na verdade um hinário — o app-ja redireciona a abertura dele para o
módulo do hinário. Como os dois hinários já têm card fixo aqui, o card
duplicado é omitido. Esse é o critério **autoritativo**, gravado como
`collState[id].isHymnal` quando o índice do álbum chega; até lá vale um
palpite pelo nome (`/hin[aá]rio/i`), que era o único critério antes.

**Índices sempre em dia, automaticamente** (`fetchCollectionIndex` /
`autoRefreshCollections`): sem esperar o operador apertar "sincronizar", ao
abrir o app (`init()`) e toda vez que o Controle volta de segundo plano
(`visibilitychange`, mesma cadência do check de versão do service worker),
buscam-se (fase 1) os **índices leves dos hinários** (id/número/nome/duração/
tem-playback — **sem** áudio nenhum) + o **catálogo de álbuns** (nomes dos
cards, via `fetchAlbumCatalog`); e (fase 2) o **índice leve de CADA álbum**
(`album_{id}.musics`, também só metadados), com concorrência limitada
(`runLimited`, 5) e TTL (`ALBUM_INDEX_TTL`, 12 h — pula álbuns indexados há
pouco, mas sempre busca os novos/vazios). `autoRefreshCollections` é
**silenciosa**: sem rede, só mantém o que já está em cache, sem erro visível.
`fetchCollectionIndex` faz o merge **mutando os objetos existentes no lugar**,
em vez de recriá-los — usada tanto por essa atualização automática quanto pela
fase 1 de `syncCollection`. Assim **todo o acervo** (hinários + todas as músicas
de todos os álbuns) entra na busca sozinho, baixado ou não.

**Por que in-place, e não objetos novos:** `syncCollection` tira um snapshot do
array e grava `fileIdFull`/`fileIdPlayback` nos objetos DELE conforme baixa.
Como esta atualização roda em toda retomada do app — ou seja, exatamente
durante uma sincronização em massa, que é quando o operador minimiza —,
recriar os objetos deixava o snapshot apontando para órfãos: os bytes iam pro
OPFS e pro catálogo, mas os ids eram descartados no `setState` seguinte, o card
mostrava menos baixados do que existem e a música era rebaixada. Reaproveitar o
objeto também preserva de graça qualquer campo extra (`lyrics`, `_norm`).
Complementarmente, `autoRefreshCollections` **pula coleções com `syncBusy`** —
não há por que competir pela mesma chave durante o trabalho pesado.

**Busca/lista — popup único com dois escopos** (`searchScope`): o mesmo popup
(`#hymnSearchPopup`) serve tanto pra **busca global** quanto pra **lista de uma
coleção**. O **botão de lupa** (`#hymnSearchBtn`, SVG inline, no canto direito
das abas) abre com `searchScope=null` (título "Buscar no acervo") e
varre **todas as coleções** indexadas; o botão **Ver músicas** do card
(`openCollectionSongs(coll)`) abre com `searchScope=coll.id` (título = nome da
coleção) e mostra só as músicas daquela coleção (o campo então **filtra dentro
dela**; sem auto-focar o campo, pra não abrir o teclado sobre a lista).
`renderSearchResults` escolhe as coleções conforme o escopo; cada resultado
carrega sua `coll` pra tocar/adicionar/baixar sob demanda. No escopo global o
subtítulo do resultado mostra a coleção de origem; escopado, só a duração.
Diferente dos demais popups (bottom-sheets), a bandeja **desliza a partir do
TOPO** (CSS: `#hymnSearchPopup` com `align-items:flex-start`, `.popup-sheet` com
`translateY(-100%)` e cantos arredondados embaixo) — além de ser o pedido de UX,
casa com o teclado, que sobe da base sem cobrir os resultados. O campo de busca
usa `.lib-search`, hoje com `appearance:none` + supressão das pseudo-partes
`::-webkit-search-*` (mata o visual nativo do `type="search"`). **Escopado a uma coleção, a lista sai INTEIRA** (sem teto): ali o operador
está folheando um álbum, não filtrando o acervo, e cortar em 60 escondia o fim
de qualquer hinário. A busca **global** mantém o teto de 60 — ela varre
milhares de músicas de todos os álbuns, e renderizar tudo a cada tecla
travaria o campo. Resultados vêm
dos índices já em memória (`collState`, filtro em memória; o subtítulo do
resultado mostra a coleção de origem) —
funciona sem rede assim que os índices já tiverem sido buscados pelo menos uma
vez (hinários e álbuns entram sozinhos via `autoRefreshCollections`); se o popup
estiver aberto quando um índice atualiza, a lista se re-renderiza na hora.

**Nome normalizado uma vez, não por tecla** (`s._norm`, gravado por
`fetchCollectionIndex` e preenchido sob demanda no filtro): `normalizeForSearch`
faz `normalize('NFD') + replace + toLowerCase` — três alocações de string sobre
um valor que nunca muda, antes repetidas para **cada música do acervo a cada
tecla digitada**. Os dois campos de busca (acervo e pasta) também passaram a ter
**debounce** (`SEARCH_DEBOUNCE_MS` = 130 ms): a busca dentro de uma pasta OPFS
refaz a lista inteira com `innerHTML=''` e um object URL novo por miniatura, e
numa pasta de centenas de arquivos isso acontecia a cada tecla, com a lista
ainda quase inteira nas primeiras letras.
**Linha compacta, ações reveladas pelo toque** (`hymnResultRow`): o resultado
é `[thumb 46px] [nome / subtítulo] [duração]` — e nada mais. Tocar na linha
abre as ações logo abaixo, em **acordeão** (abrir uma fecha a anterior: duas
abertas ao mesmo tempo empurrariam a lista e tirariam do lugar o que o
operador estava mirando). Com as ações fora do caminho sobra espaço para uma
**fonte maior** (`.hymn-name` em `1.02rem`), que é o ponto — a lista precisa
ser legível de relance no meio do culto. A **duração** virou coluna própria à
direita (`.hymn-time`, saiu do subtítulo, alinhada entre as linhas), e o
subtítulo (`.hymn-sub`) ficou só com a coleção de origem, na busca global.

`.hymn-actions` é **irmã** de `.hymn-row` dentro do `<li>` (não filha) — por
isso um toque num botão de ação não borbulha para o handler da linha e não
fecha o acordeão, sem precisar de `stopPropagation`. As ações são agrupadas
por variante (`.hymn-variant`, cada grupo `flex:1`); dentro do grupo,
tocar/+Cronograma/+Playlist **crescem** (`flex:1`) pra preencher a largura
disponível. Os grupos são: **Cantado** e **Playback** (a 2ª só se
`has_instrumental_music`), cada grupo com **três ações** — **tocar**
(`playSongVariant`, ícone de **voz/microfone** pro Cantado, **nota musical** pro
Playback — `voiceIconSvg`/`noteIconSvg`; substitui a playlist e exibe, igual ao
toque simples da biblioteca), **➕ Cronograma** (`addSongVariant` →
`AVDB.listAdd('imports', id)`) e **➕ Playlist** (`addSongToPlaylist` →
`AVDB.listAdd('playlist', id)` + `renderPlaylist`). Todas baixam a música na
hora se ainda não estiver offline (ver "Resolução do id de mídia por variante"
abaixo).

**Resolução do id de mídia por variante** (`resolveSongMediaId`) é
**offline-first com download sob demanda**: se a variante já foi baixada
(fase 2 acima), usa o id do catálogo OPFS direto (zero-cópia, mesmo padrão do
botão ➕ das pastas); senão, `ensureSongDownloaded` baixa a música **de
verdade** ali mesmo (mesma `downloadCollectionSong` da sincronização em massa —
áudio + capa + letra, pronto pra tocar 100% offline dali em diante), não um
registro temporário/streaming. `songDownloadInFlight` (Map por
`<coll.id>:<id_music>`, sessão) evita disparar dois downloads da mesma música em
paralelo se o operador tocar/adicionar duas vezes rápido antes do primeiro
terminar. Ver
"Wi-Fi vs dados móveis" abaixo para a política de quando cada tipo de
download é permitido.

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin do
> Audio Visual IASD (`https://jonathasptbr-gh.github.io`) — não verificado
> em produção no momento desta implementação (rede da sessão de
> desenvolvimento não tinha acesso a `api.louvorja.com.br` para testar). Se o
> `fetch` falhar por CORS, a sincronização e a busca ao vivo (mas não a busca
> no índice já baixado) param de funcionar.

#### Letra sincronizada (slides + temporizador)

Cada variante baixada (registro em `files`, criado por `downloadCollectionFile`)
ganha campos extras, sem exigir bump de `DB_VERSION` (o `files`/`media` do
`shared/db.js` guarda objetos livres de schema):

- `lyrics`: `Array<{ time, text, auxText, cover, imageOpfsPath, imagePosition }> | null | undefined`
  — sentinela de 3 estados: `undefined` = nunca processado (dispara
  reprocessamento na próxima sincronização, mesmo que o áudio já esteja
  baixado — é o que dá **backfill** aos hinos sincronizados antes desta
  funcionalidade existir, sem rebaixar áudio: `ensureSongVariant` só
  recalcula e regrava a letra no registro já existente); `null` = já
  processado, mas o hino não tem estrofes com tempo utilizável (não tenta de
  novo à toa); array = primeiro item é sempre o slide de capa (`cover:true`,
  `text:null`, `time:0`, imagem da música), os demais vêm do mapa `lyric` de
  `music_{id}` (filtrados por `show_slide`, tempo do campo certo — `time`
  para Cantado, `instrumental_time` para Playback — convertido pra segundos
  via `parseTimeToSeconds`, ordenados por tempo).
- `hymnName`/`hymnTrack`: título limpo e número do hino (`s.name`/`s.track`,
  sem o prefixo/sufixo que `name` carrega pra exibição na lista) — usados
  pelo Display no slide de capa.

**Quebras de linha vêm da própria API, como `<br>` literal** dentro de
`lyric`/`aux_lyric` (confirmado no app-ja: ele usa `v-html` pra deixar o
navegador interpretar essas tags como quebra real). `buildLyricSlides`
passa `text`/`auxText` por `normalizeLyricText()`, que troca `<br>` (e
variações `<br/>`/`<br />`) por `\n` real — **não** por `innerHTML`/`v-html`
(sem risco de injeção: é só uma troca de string, o resto do texto continua
literal). O CSS (`.lyrics-line`/`.lyrics-aux` no Display,
`.pv-lyrics-line`/`.pv-lyrics-aux` na preview) usa `white-space: pre-line`
para respeitar esse `\n` — sem isso, a quebra pretendida pelo hino se perde
e o navegador quebra a linha sozinho, do jeito errado (ou mostra o `<br>`
literal na tela, já que `textContent` não interpreta HTML).

Imagens por estrofe (`imageOpfsPath`) são baixadas de verdade pro OPFS
(mesma pasta `folders/<coll.id>/`, `downloadCollectionImage`) — nunca URL
remota direta, preserva o offline. Uma linha sem imagem própria **herda a da
anterior** (fallback "grudento", igual ao app original); imagens iguais
entre linhas/variantes são baixadas uma única vez (`resolveImage`, cache por
URL compartilhado entre Cantado e Playback do mesmo hino, já que costumam
usar as mesmas imagens). Um hino tocado/adicionado antes de qualquer
sincronização em massa passa pelo mesmo `downloadCollectionSong` sob demanda
(ver "Resolução do id de mídia por variante" acima) — já sai dali com letra
sincronizada, igual a um hino baixado em massa.

#### Wi-Fi vs dados móveis

A sincronização em **massa** (`syncCollection`, baixar todas as músicas
pendentes de uma coleção de uma vez) fora do Wi-Fi **não é bloqueada — ela
pergunta**. Baixar um hinário inteiro pode ser bastante coisa, e só o operador
sabe se o plano dele aguenta; o que o app não pode é decidir sozinho por ele,
em nenhuma das duas direções.

Sem Wi-Fi confirmado (`isConfirmedWifi`, Network Information API —
`navigator.connection.type === 'wifi' || 'ethernet'`; sem suporte no navegador
cai em `'unknown'`, tratado como Wi-Fi **não** confirmado, postura
conservadora), a lista leve é atualizada sempre (metadados, barato) e o
download pesado abre um diálogo de duas saídas: **"Usar dados móveis"** ou
**"Só no Wi-Fi"**. A escolha vale **só para aquela sincronização daquele
álbum** — não vira preferência do app, e o próximo álbum pergunta de novo.

O diálogo mostra **quanto** falta, quando dá para saber: `estimatePendingBytes`
extrapola a partir do peso REAL do que já está em disco naquela coleção
(`bytes / baixados × pendentes`). Sem nada baixado ainda não há de onde tirar,
e a mensagem omite o tamanho em vez de inventar um número.

Um indicador (`.net-badge`, ícone de Wi-Fi inline — fora do subset da fonte)
aparece nas opções da coleção, atualizado ao vivo
(`connection.addEventListener('change', ...)`).

O download **individual** (tocar/adicionar uma música, `ensureSongDownloaded`)
não pergunta nada e é sempre permitido, em qualquer rede: é exatamente o hino
que o operador acabou de pedir — uma música, não um acervo —, e um diálogo a
cada toque seria só atrito. Na prática,
sem Wi-Fi o hinário vai sendo baixado aos poucos, só com o que de fato for
usado em cada culto, em vez de baixar tudo de uma vez usando dados móveis.

**Display** (`public/display/`): novo layer `#lyrics` (imagem de fundo
`object-fit:cover` + um retângulo central com moldura — `.lyrics-box`: no
padrão visual de "vídeo de louvor" (cantos **retos**, não arredondados;
borda fina e **nítida**, `rgba(255,255,255,.85)`; fundo semitransparente
`rgba(0,0,0,.4)`; sem `box-shadow`), `width`/`height` fixos e margens
(`.lyrics-content`, padding em vh/vw) — a legibilidade do texto vem da
própria moldura, não de um gradiente cobrindo a tela inteira, então
funciona igual independente da imagem por trás), inserido no DOM entre
`#video` e `#youtube`, mesmo `z-index:1` dos demais layers de mídia — a
cortina do wallpaper (`z-index:2`, já existente) cobre/revela esse layer de
graça, **sem nenhuma mudança em `stage.js`** (letra é tratada como camada
paralela, mesmo padrão já usado pela ponte do YouTube). `hideLyrics()` é
chamado incondicionalmente no início do tratamento de `load` (antes do
atalho de YouTube) e em `stop`/`clear` — sem isso, trocar de um hino pra um
vídeo do YouTube não escondia a letra de verdade, só ficava mascarado por
sorte de ordem de pintura no DOM. Depois de `AVDB.getMedia(cmd.mediaId)` (já
existia), se `rec.kind==='audio' && rec.lyrics?.length` → `showLyrics(rec)`.
O avanço de slide reaproveita o `onTime`/`sendStatus()` já existente (sem
timer novo): `updateLyricSlide(t)` acha o último slide cujo `time <= t` e só
mexe no DOM quando o índice muda; a imagem de fundo só é re-resolvida (via
`AVDB.opfsGetFile` + object URL, com guarda de sequência tipo `loadSeq`) se o
`imageOpfsPath` realmente mudou entre um slide e o seguinte. `hymnName`/
`hymnTrack` do item atual ficam guardados à parte (`currentLyricsMeta`, não
só passados como parâmetro do `showLyrics` inicial) — sem isso, o slide de
capa perderia o título ao ser re-renderizado pelo tick de tempo (ex:
operador volta pra estrofe 0 depois de já ter avançado).

**Fundo preto vs. imagens dos slides** (`lyricsBgMode`, state `lyricsBg`,
comando `lyricsbg`): **preto é o padrão** — a imagem de cada slide (baixada
durante a sincronização, ver acima) só é de fato usada como fundo se o
operador escolher "Mostrar" no segmento **Imagens dos slides** do popup de
**Exibição** (`#lyricsBgSeg` → `setLyricsBg`/`renderLyricsBgSeg`). Até a v5.18
isso era um botão do mixer; ele saiu de lá porque é uma preferência de
aparência (como preenchimento e wallpaper, seus vizinhos agora), não um
controle de operação — e o lugar que abriu no mixer virou a **leitura
auxiliar** (ver seção própria). `applyLyricsImage(slide)` centraliza a decisão: calcula a "chave
efetiva" da imagem (`slide.imageOpfsPath` só se `lyricsBgMode==='image'`,
senão `null`) antes de decidir se resolve/revoga a `object URL` — o resto da
lógica (cache por chave, guarda de sequência) não muda. `setLyricsBgMode(m)`
troca o modo ao vivo e reaplica no slide atual (`applyLyricsImage`) sem
precisar esperar uma troca de estrofe. Persistido em `state.lyricsBg`
(lido no `restore()` do Display e no `load()` do Controle) e propagado ao
vivo pelo comando `lyricsbg` — mesmo padrão de `fade`/`fit`, mas tratado à
parte de `stage.handle()` (letra é camada paralela, não um comando do
stage). A preview aplica o mesmo modo em si mesma via `applyPvLyricsBg()`
(chamado direto em `cmd()`, sem esperar o Display confirmar nada).

**Moldura só no modo imagem**: a borda + fundo semitransparente da caixa
(`.lyrics-box`/`.pv-lyrics-box`) só existem para dar contraste/legibilidade
contra uma imagem de fundo de verdade — no modo preto puro seriam só uma
zona escura flutuando à toa sobre uma tela já preta, sem função nenhuma.
`applyLyricsBgClass()` (Display) / `applyPvLyricsBgClass()` (Controle)
ligam a classe `.imgbg` em `.lyrics-content`/`.pv-lyrics-content` só quando
o modo é `'image'` — `border`/`background` de `.lyrics-box`/`.pv-lyrics-box`
ficam `transparent` por padrão e só ganham cor via
`.lyrics-content.imgbg .lyrics-box`/`.pv-lyrics-content.imgbg .pv-lyrics-box`.
Chamado em `setLyricsBgMode()`/`restore()` (Display) e em
`showPvLyrics()`/`applyPvLyricsBg()` (Controle) — cobre tanto a troca ao
vivo do botão quanto o estado inicial ao abrir um item já com o modo salvo.

**Preview do Controle (mesma visualização, em miniatura)**: a preview
**sempre espelha o telão** — já vale pra imagem/vídeo (via `stage.js`
compartilhado) e pra YouTube (segundo player, ver seção própria); letra
sincronizada segue o mesmo princípio universal do sistema. `#pvLyrics`
dentro de `#preview` reproduz a mesma estrutura visual do Display (fundo +
retângulo com moldura), só que com tamanhos **fixos em px** (não vw/vh, que
aqui seriam relativos à tela toda do celular, não à caixinha pequena da
preview — por isso não dá pra reaproveitar a mesma folha de estilo, embora a
estrutura e a lógica JS sejam praticamente idênticas, no mesmo padrão de
duplicação já usado pela preview do YouTube). `showPvLyrics`/`hidePvLyrics`/
`renderPvLyricSlide`/`updatePvLyricSlide` espelham exatamente as funções do
Display, chamadas nos mesmos pontos: `cmd()` (`load`/`stop`/`clear`, em vez
do tratamento de comando do Display) e `previewTick()` (em vez do
`sendStatus()`). Não existe mais uma legenda de texto solta na
`.nowplaying` (`#npLyric`, removida) — a miniatura visual da preview já
mostra a composição real (fundo + posição do texto), tornando a legenda
redundante.

**Controle**: dois botões de navegação manual de estrofe (`#slidePrevBtn`/
`#slideNextBtn`) flanqueiam a preview (`.preview-row`, preview mantida em
16:9, botões ocupam o espaço horizontal que sobra — e, por compartilharem a
mesma faixa de 130px da grade do `.deck`, ficam com a mesma altura da fatia
`.mixer-mid`, ver seção do Mixer). `stepSlide(delta)` reaproveita o
**comando `seek` já existente** (sem novo tipo no protocolo) — pula pro
`time` do slide vizinho, e tanto o Display quanto a própria preview
sincronizam a letra sozinhos ao reagir ao novo tempo.

**Moldura de tamanho FIXO** (`.lyrics-box`/`.pv-lyrics-box`): a caixa não
cresce/encolhe conforme o texto do slide muda — `width`/`height` fixos (não
`max-width` + altura intrínseca) calculados para caber o pior caso real: as
letras do Hinário 2022 nunca passam de **2 linhas** por estrofe
(`-webkit-line-clamp: 2` em `.lyrics-line`/`.pv-lyrics-line`, tanto no slide
normal quanto no de capa; `.lyrics-aux`/`.pv-lyrics-aux` — rótulo curto de
seção, ex: "Refrão" — fica em **1 linha só**, não 2, o que também mantém a
caixa mais enxuta).

**Redimensionamento por Container Queries (`cq*`), não `vh`/`vw`**:
`.lyrics-content` (Display) e `.pv-lyrics-content` (preview) são
`container-type: size` — tudo dentro deles (moldura, fonte, padding, gap)
usa unidades `cqw`/`cqh`/`cqmin` (relativas ao TAMANHO DO PRÓPRIO
CONTAINER, não ao viewport). Isso resolve dois problemas que a versão
anterior (`vh`/`vw` + pisos/tetos em `rem`/`px`) tinha:
- **Descompasso em telas pequenas**: um piso de fonte em `rem` fixo parava
  de encolher enquanto a caixa (só em `vh`) continuava encolhendo — a fonte
  acabava maior que a caixa, cortando/bugando o texto. Unidades `cq*` puras
  não têm piso/teto absoluto — tudo escala junto, sempre, em qualquer
  tamanho de tela.
- **Fonte grande demais em proporção estreita**: a fonte usa `cqmin` (o
  menor entre a largura e a altura do container — análogo ao `vmin`, mas
  relativo ao container), não `cqh` puro. Só `cqh` cresce com a altura
  mesmo quando a largura é o fator mais apertado (ex: janela redimensionada
  em modo retrato) — a própria linha de texto (não a quebra intencional)
  deixava de caber, consumindo sozinha as 2 linhas do clamp e cortando fora
  a segunda linha (autorizada) inteira. `cqmin` encolhe a fonte junto com a
  dimensão mais apertada, sempre.
- **Padding do container NUNCA é em `cq*`** — e o motivo é mais forte do que
  parecia. Unidades de container escritas NO PRÓPRIO container **não se
  referem a ele**: resolvem contra o ancestral mais próximo que seja container
  e, não havendo nenhum, contra o **viewport**. No Display isso passa
  despercebido (o container preenche o viewport, então os números coincidem);
  na preview do Controle é destrutivo — a caixa tem ~130px de altura dentro de
  uma tela de ~980px, então `7cqh` virava 7% da TELA DO CELULAR, ou seja
  ~137px de padding vertical numa caixa de 128px. O content-box colapsava para
  zero e, com ele, a fonte (que é `cqmin` do container). **Era essa a causa
  real de o versículo aparecer espremido e cortado na preview.**
  A regra era seguida por `.lyrics-content`/`.pv-lyrics-content` mas estava
  violada por `.text-content`/`.pv-text-content`; hoje as quatro seguem o
  mesmo modelo: o container não tem padding percentual, a CAIXA é fração dele
  (`76cqw`/`32cqh` na letra, `86cqw`/`86cqh` no texto) e o que sobra vira
  margem sozinho via `align-items`/`justify-content: center`.

**Proporções calibradas por medição em pixel** de um vídeo de louvor de
referência (moldura ~76-80% da largura da tela / ~27-36% da altura; fonte da
letra com cap-height ~8,3% da altura da tela). Valores atuais: `.lyrics-line`
em `8cqmin`, `.lyrics-aux` em `4.2cqmin`, capa em `9.5cqmin`, caixa **fixa e
compacta** em `76cqw`/`32cqh`. **A preview usa EXATAMENTE os mesmos números**
(ver "Proporção da preview" abaixo): `cq*` é relativo ao container, portanto
invariante de escala — com a mesma proporção, os mesmos valores dão a mesma
composição numa caixa de 280px e num telão de 3120px. A preview já teve
valores próprios (`9.3cqmin`, `92cqw`/`60cqh`…), que eram compensação
empírica para a proporção errada, não uma necessidade. `overflow:hidden`
no `.lyrics-box`/`.pv-lyrics-box` junto do `-webkit-line-clamp` em
`.lyrics-line`/`.lyrics-aux` (`.pv-lyrics-line`/`.pv-lyrics-aux` na preview)
são a garantia final: qualquer letra maior que o clamp é cortada com
reticências, nunca estoura a moldura (isso ainda pode acontecer em
proporções extremas, tipo uma janela de teste em modo retrato — o Display é
sempre landscape em produção e a preview segue a proporção do telão, dentro de
um clamp, então essa situação não ocorre no uso real).

**Fundo preto sem ícone de "imagem quebrada"**: no modo preto (padrão), a
`<img>` de fundo (`#lyricsImg`/`#pvLyricsImg`) fica **`hidden`** de
propósito, em vez de só sem `src`. Isso sozinho **não bastava**: o seletor
`.lyrics-bg img`/`.pv-lyrics-bg img` (uma classe + um tipo, mais específico
que a regra `[hidden] { display:none }` da folha de estilo padrão do
navegador) vencia e mantinha `display:block` mesmo com o atributo `hidden`
ligado pelo JS — a `<img>` sem `src` continuava renderizando o ícone/borda
padrão de "imagem quebrada" (aparecia como uma linha branca de margem sobre
o preto), no Display e às vezes na preview. A correção precisa de uma regra
própria com especificidade suficiente: `.lyrics-bg img[hidden] { display:
none; }` / `.pv-lyrics-bg img[hidden] { display: none; }`. `.lyrics-bg`/
`.pv-lyrics-bg` têm `background:#000` próprio (preto de verdade,
independente da `<img>`); `applyLyricsImage`/`applyPvLyricsImage` alternam
`hidden` junto com `src` a cada troca de modo/slide.

### Compartilhamento

Compartilhar mídia com o app cai direto no **Cronograma**. Quem recebe é o
`intent-filter` nativo (`ShareIntake.kt`), que entrega o share à ponte no
formato `{ files:[{name,type,url}], url, title }` — as URLs são servíveis
(`/saf/<token>`), nunca bytes. Do lado web, `checkPendingShare()` processa no
init (e `window.__avShareArrived()` empurra na hora quando o app já está
aberto):

> Isto substituiu o **Web Share Target** do modelo de PWA: o
> `manifest.json` do Controle declarava `share_target` (POST multipart em
> `share-target`, arquivos no campo `media`), o service worker interceptava o
> POST, gravava `pending-share` no IDB e redirecionava para o app. O formato
> do `pending-share` e todo o processamento abaixo continuam idênticos — só a
> entrega mudou.

- **Arquivos** → importados como `addMedia` (com thumbnail).
- **URL do YouTube** (youtu.be, youtube.com — `watch?v=`, `/shorts/`, `/live/`,
  `/embed/`, `/v/`; ID de 11 chars validado) → `addUrlMedia` com
  `kind:'youtube'`, `youtubeId` e thumb `hqdefault.jpg` — cai direto no
  **Cronograma** (`imports`), pronto para tocar.
- **Outras URLs** → `kind` detectado pela extensão (`video`/`audio`/`image`/`url`).

### Modos de repetição

Ciclo ao tocar no botão 🔁: `off → all → one → shuffle → off` (persistido em `repeat`).

**Tocar uma música nova zera o `one`** (`replacePlaylistWith`): tanto o toque
simples na biblioteca quanto o "tocar" de um resultado da busca substituem a
playlist por aquele item só — e, junto, desligam o `repeat='one'`. Repetir a
mesma música é uma escolha sobre a música que ESTAVA tocando; mantê-la
prenderia o item novo em laço, que é o oposto de "escolhi outra coisa para
tocar". `all` e `shuffle` ficam: são comportamentos da FILA e voltam a valer
assim que o operador acrescentar itens a ela.

| Modo | Comportamento ao fim do item |
|---|---|
| `off` | Playlist para; `currentId` permanece para replay manual |
| `all` | Avança para o próximo; ao fim da lista volta ao início |
| `one` | Recarrega e reproduz o mesmo item |
| `shuffle` | Avança para item aleatório (nunca repete o atual) |

---

## Camada de Texto (Bíblia · Mensagens · Letra)

O sistema serve **texto no telão** por três provedores que compartilham um
**modelo padronizado** de camada paralela (mesmo padrão do YouTube: um layer
`z-index:1` que a **cortina do wallpaper** — `z-index:2`, sempre por cima de
tudo — cobre/revela "de graça", sem tocar em `stage.js`). Os três são:

| Provedor | Driver | Origem do texto | Camada física |
|---|---|---|---|
| **Bíblia** | manual (operador avança versículo) | banco LouvorJA | `#text` / `#pvText` |
| **Mensagens** | manual (operador avança mensagem) | `state.messages` (texto puro) | `#text` / `#pvText` |
| **Cronômetro/relógio/timer** | **derivado do relógio** (sem avanço) | o próprio tempo (`chronoReading`) | `#text` / `#pvText` |
| **Sorteio** | **derivado** (rolo até assentar) | faixa numérica ou lista de opções (`drawReading`) | `#text` / `#pvText` |

> **Mensagens vive na aba Diversos** (v5.31), como uma seção do acordeão:
> lista de avisos salvos, "+ Nova mensagem" e — quando há uma projetada —
> "Tirar do telão" (`hideMessage` → `text-hide`, que encerra só a Camada de
> Texto; um áudio de fundo segue tocando). Tocar numa mensagem projeta e a
> linha fica marcada, então passar de um aviso a outro não exige reabrir nada
> — que era o atrito do bottom-sheet anterior. Com a mensagem fora do ar mas a
> sessão viva, os botões de slide só MOVEM a seleção (mesma regra da Bíblia).

| **Letra sincronizada** | **temporizado** (segue o `currentTime` do áudio) | música do LouvorJA | `#lyrics` / `#pvLyrics` |

**Bíblia e Mensagens são literalmente o MESMO cartão** (`#text` no Display,
`#pvText` na preview) — mesmo comando `text`/`text-hide`, só o campo `mode`
distingue (`'verse'` mostra a referência dourada abaixo do texto; `'message'`
usa fonte maior/mais linhas e sem referência). A **Letra** é o **provedor
temporizado** da mesma família — fica no seu layer dedicado `#lyrics` porque
carrega recursos que o cartão de texto puro não representa (imagem de fundo por
estrofe, slide de capa, texto auxiliar); mesclá-la ao `#text` arriscaria a
sincronização de tempo (o recurso principal), então ela permanece separada,
mas segue o mesmo modelo de cortina/fades.

**Independência do áudio** (o ponto-chave do modelo unificado): a Camada de
Texto é **desacoplada do ciclo de vida da mídia do stage** — `showText`/
`showPvText` **não** chamam `stage.clear()`/`preview.clear()`. Assim é possível
**projetar um versículo (ou mensagem) enquanto um áudio toca em segundo plano**:

- Um comando `text`/`text-hide` nunca para a mídia do stage.
- Com a Camada de Texto ativa, o **transporte** (`play`/`pause`/`seek`/`volume`/
  `mute`) continua indo pro stage — controla o **áudio de fundo** (o texto não é
  afetado); o `view` liga/desliga a cortina por cima do texto.
- Um `load` de **áudio** troca o som de fundo **mantendo** o texto; um `load` de
  **visual** (imagem/vídeo/YouTube), `stop` ou `clear` **encerram** o texto e
  seguem o fluxo normal (o Display checa o `kind` do registro em `load` pra
  decidir; o Controle usa `keepText = pvTextActive && currentItem.kind ==='audio'`).
- A **letra sincronizada não coexiste** com a Camada de Texto manual:
  `showLyrics`/`showPvLyrics` retornam cedo se um texto manual estiver em cena
  (a letra pertence a UMA música tocando; um versículo/mensagem manual tem
  precedência sobre a letra do áudio de fundo).
- **Sair do texto sem nada em cena volta ao WALLPAPER, não ao preto**
  (`restoreSceneAfterText`/`restorePvSceneAfterText`). `showText` abre a
  cortina para o cartão aparecer; se não há mídia carregada — ou a que havia já
  terminou (item só na playlist, ou tocado antes) — ninguém a fechava de volta,
  e o telão ficava preto. Agora, quando não há YouTube tocando e
  `!getCurrent() || hasEnded()`, a cortina sobe (`coverIn(false)`). No Controle
  a fonte disso é o **stage** (`preview.getCurrent()`), não `currentItem`: este
  último é o item SELECIONADO e continua apontando para a música terminada — era
  exatamente ele que fazia a preview achar que ainda havia algo em cena.

### Botão voltar do aparelho (`__avBack`)

O shell entrega o botão voltar do Android a `window.__avBack()`; devolver `true`
significa "consumi o toque", `false` faz a Activity minimizar (a projeção segue
viva — sair do app por engano num culto derrubaria o telão). A escada completa,
o prazo de resposta e o porquê de a decisão ser do lado web estão em
[`CLAUDE.md`](../CLAUDE.md), seção "Botão voltar: fecha antes de minimizar".

Do lado web importam duas coisas:

- **A tabela `POPUPS` é a fonte única.** Ela já registrava o ✕ e o toque no
  fundo; agora registra também o voltar. Um popup novo entra numa linha e passa
  a ser fechável pelos três caminhos — duas listas divergiriam no primeiro que
  alguém esquecesse de acrescentar na segunda.
- **A hierarquia não é reimplementada.** O degrau de sub-tela chama
  `navigateBack()`, a mesma função do `#backBtn`, que já sabe que a Bíblia sobe
  leitura→capítulos→livros e que a raiz dos Favoritos volta ao Cronograma.

`__avBack` **não** usa `history`: no navegador não há botão voltar do sistema, e
a função simplesmente nunca é chamada lá. A base continua rodando nos dois
contextos sem guarda nenhuma.

### Acervo de LETRAS (baixado no arranque, v5.36)

A letra deixou de depender do áudio: é baixada junto com o índice, como
informação padrão do acervo. Antes, só quem tinha a música no aparelho podia
buscá-la — e quem procura "aquele hino que fala em…" quase nunca tem os 600
baixados.

**Dois acervos, de propósito.** `files[].lyrics` são **slides** (tempo, imagem,
capa) e só existem com áudio baixado — é o que a projeção sincronizada consome.
`state.lyrics:<collId>` é só **texto**, por música, e existe para toda música do
índice — é o que a busca consome. Fundi-los faria a busca carregar tempos e
caminhos de imagem à toa, e faria o download do índice arrastar o peso dos
slides. O índice de busca (`buildLyricIndex`) lê os **dois**, chaveado por
`collId:id_music`, com o acervo de texto tendo precedência.

- **Caminho de graça primeiro.** Se a API mandar `lyric` já no índice do acervo
  (o app-ja busca por esse campo — §5.3 de `FONTE-DE-DADOS-LOUVORJA.md`),
  `fetchCollectionIndex` colhe dali e a música nem entra na fila. Verificado
  contra uma API simulada: com o campo presente, **zero** requisições
  `music_{id}`.
- **Todo o acervo indexado** (v5.38): hinários **e** álbuns, a mesma cobertura
  do índice de músicas. A busca por trecho não teria por que conhecer metade do
  acervo — "aquele hino que fala em…" e "aquela música do álbum que fala em…"
  são a mesma pergunta, e o operador não sabe (nem deveria precisar saber) de
  qual coleção veio o que procura.
- **Hinários primeiro na fila.** São o que mais se busca, e a fila pode levar
  alguns minutos na primeira abertura: se ela for interrompida (app fechado,
  rede caiu), o que já desceu é o que mais importa. Verificado: os 20 primeiros
  pedidos são todos do hinário, com os álbuns já indexados na fila.
- **Agrupado por `id_music`, não por (coleção, música).** A MESMA faixa aparece
  em várias coletâneas, e `music_{id}` é o mesmo documento para todas — uma
  busca por par custaria três requisições para uma faixa em três álbuns. Aqui
  custa uma, e o resultado é distribuído para todas as coleções que a contêm. É
  o que torna varrer o acervo inteiro viável. Medido: 3 álbuns de 10 faixas com
  uma compartilhada + 20 hinos = **48 requisições**, não 50, e nenhuma música
  pedida duas vezes.
- **Adia só em rede móvel CONHECIDA** (`networkType() === 'cellular'`), e a
  assimetria com `syncCollection` é deliberada: lá descem centenas de MB de
  áudio e perguntar é o certo; aqui é JSON de texto, poucos MB no hinário
  inteiro — menos que UMA música que o app baixa com um toque sem perguntar.
  Usar `isConfirmedWifi()` seria pior que inútil: `navigator.connection.type`
  não existe em boa parte dos aparelhos e devolve `'unknown'`, então exigir
  Wi-Fi confirmado faria o recurso **nunca rodar** na maioria deles.
- **Incremental e resumível.** Só busca o que falta; reabrir o app não refaz
  nada. Verificado: 40 requisições na primeira abertura, **0** na segunda, e
  exatamente **2** depois de apagar duas do acervo.
- **`0` marca "não tem letra"**, e é diferente de ausência: sem essa marca,
  toda abertura tentaria de novo as mesmas centenas. Mas **falha de rede não
  marca** — senão um wi-fi que oscilou tiraria o hino da busca para sempre.
- **Gravação em LOTES** (`LYRIC_BATCH`, 25): são centenas de músicas, e
  reescrever o blob inteiro a cada uma tornaria o download quadrático.
- **A lista de sujas é tirada ANTES de gravar, não depois** (v5.41). Os 6
  workers correm juntos: durante o `await` da gravação os outros continuam
  marcando coleções, e o `clear()` que rodava *depois* apagava essas marcas.
  A letra ficava só na memória — e se aquela coleção já tivesse terminado,
  nunca mais era marcada e a gravação final a ignorava. Medido na API
  simulada: **48 de 48 músicas buscadas, 45 de 50 pares no disco**, com um
  álbum inteiro pela metade, em ~1 de cada 6 aberturas. Com hinário só o
  defeito quase não aparecia (uma coleção, sempre com item seguinte para
  remarcá-la); varrer o acervo inteiro (v5.38) — muitas coleções pequenas
  acabando no meio dos flushes — foi o que o trouxe à tona.
  `test-letras-corrida` reproduz com 150 hinos + 20 álbuns de 5: falha em 3
  asserções com o `clear()` no lugar errado, passa com ele no certo.
- **Indexa TODA linha**, inclusive `aux_lyric` e estrofes sem `show_slide` — ao
  contrário de `buildLyricSlides`, que filtra o que vira slide. Uma estrofe que
  não é projetada continua sendo letra da música, e para buscar isso só ajuda.
- **Guardado por ESTROFE desde a v5.43** — `[{ a: rótulo|null, l: [linhas] }]`.
  O banco já entrega assim: cada entrada de `music_{id}.lyric` **é** uma
  estrofe, com `order` e `aux_lyric` (o rótulo: "Refrão", "1ª Estrofe"). Até a
  v5.42 guardávamos só as linhas achatadas — o formato de que a BUSCA precisa —,
  e a visualização da letra completa herdava esse achatamento: trinta linhas
  seguidas, sem respiro e sem dizer onde entra o refrão, que é exatamente o que
  o operador procura quando abre a letra. Guardar por estrofe não custa nada à
  busca (`lyricFlatLines` achata na hora de indexar, e o rótulo entra junto —
  "refrão" é palavra que se digita); o caminho inverso, inferir estrofes de
  linhas soltas, **não existe**. Por isso a mudança é no armazenamento, e não
  só na tela.
  - `lyricStanzas` normaliza os dois formatos: um registro legado vira UMA
    estrofe sem rótulo — que é exatamente o que ele já era na tela.
  - O legado entra na mesma fila do que nunca foi baixado (`songsMissingLyric`):
    uma passagem única, em segundo plano e só em wi-fi, como a primeira carga.
    `LYRIC_NONE` (0) **não** entra — já sabemos que a música não tem letra, e o
    formato não muda isso.
  - Quem já tem a música BAIXADA nem espera a fila: os slides do arquivo
    (`stanzasFromSlides`) sempre tiveram a divisão, com `auxText` por slide — ela
    só era descartada. Por isso `songLyricStanzas` prefere os slides quando o
    acervo de texto ainda está no formato antigo.
- Roda como fase 3 do `refreshCollections`, fire-and-forget, com o progresso na
  notificação pelo mesmo `withBgWork` do resto do trabalho de massa.

### O acervo É o estado padrão da busca (v5.43)

Com o campo vazio, a busca listava as primeiras 60 músicas de um acervo de
milhares: uma fatia sem critério, que não responde pergunta nenhuma. Quem abre a
lupa **sem saber o nome** quer folhear — e folhear é por coleção, que é o
recorte que o próprio banco dá e que a aba Álbuns desenhava (ela saiu na
v5.44 — ver abaixo).

Então a abertura da busca passou a ser esse navegador: as mesmas pílulas de
filtro, os mesmos cabeçalhos de categoria e os mesmos cards. **É a mesma
função** — `renderCollectionsList(alvo, redesenhar)` ganhou o elemento-alvo e o
callback de redesenho como parâmetros. Duas cópias divergiriam no primeiro
ajuste de categoria, e o operador veria dois acervos diferentes conforme por
onde entrou.

A busca ganha assim **dois níveis**, e isso muda três coisas:

- **Digitar troca o nível.** `searchIsBrowsing(q)` é `!searchScope && !q`: com
  texto, volta a listar músicas exatamente como antes; apagando, o acervo
  retorna. Nenhuma outra regra da busca mudou.
- **Tocar num card abre a coleção NO PRÓPRIO CARD** (acordeão), com o acervo
  inteiro ainda visível em volta. Até a v5.44 era uma segunda tela, com um
  voltar no cabeçalho e um degrau próprio em `__avBack`; entrar e sair para ver
  o que tem dentro de um álbum é caro quando a pergunta é "em qual deles está
  aquela música?". Uma coleção aberta por vez — duas listas de centenas de
  faixas empurrariam o acervo para fora da tela.
  - A lista sai **inteira**, sem teto: quem abriu um álbum quer percorrê-lo.
    O teto de 60 é da BUSCA, que varre milhares de músicas a cada tecla.
  - As linhas são as mesmas `hymnResultRow` da busca, **sem o subtítulo da
    coleção** (`semColecao`) — repetir "Album 1" nas dez faixas é ruído; o card
    em volta já diz de quem elas são.
  - **A engrenagem desceu para dentro do aberto** (`.coll-open-cfg`), larga e
    rotulada. Manutenção — sincronizar, excluir, peso — é o que se procura
    depois de já estar olhando o álbum, não antes; na barra ela era um ícone
    mudo disputando o toque com a própria linha, que agora abre a coleção.
  - **A barra da coleção aberta GRUDA no topo** (`position: sticky`). Sem isso,
    percorrer as 600 faixas de um hinário empurrava a própria barra — e a seta
    que fecha — para fora da tela: a única seta à vista passava a ser a de
    OUTRO card, e tocá-la abria aquele em vez de fechar este. Do lado de quem
    opera, "toquei na seta e não fechou". Grudada, a seta da coleção em que se
    está fica sempre ao alcance, e o nome dela também.
  - **Baixar/cancelar voltou para a barra** (`.coll-bar-dl`). Com a engrenagem
    dentro do aberto, baixar um hinário passava por expandir 600 linhas —
    caro para a ação mais comum do acervo.
- **O campo não rouba mais o foco na abertura.** Enquanto ela era uma lista de
  músicas, o teclado subir junto era o certo — não havia mais nada a fazer ali.
  Agora a abertura é um acervo para folhear, e o teclado cobriria metade dele
  antes de o operador decidir se vai digitar.

#### Tela cheia, e a ação de maior alcance no título (v5.45)

- **O popup ocupa a tela toda** (`.popup-sheet--full`, sem cantos
  arredondados). É a tela em que o operador passa mais tempo antes do culto —
  folhear álbuns, abrir letras, decidir o que baixar — e a folha de 80vh
  deixava uma faixa morta no topo enquanto a lista rolava apertada embaixo.
  Cantos retos porque cantos arredondados anunciam "há algo atrás", e aqui não
  há.
- **"Baixar todo o acervo" subiu para o cabeçalho** (`renderAcervoTotal`,
  mesmo `syncGroup` e mesma chave `grp:Todo o acervo`). Dentro da lista ela
  saía de vista ao primeiro rolar — justamente quando o operador está
  decidindo entre baixar tudo e escolher um álbum. `renderCollectionsList`
  ganhou `opts.semTotal` para não desenhá-la duas vezes.
- **O contador de itens saiu.** Na abertura ele contava coleções e durante a
  busca, resultados: o mesmo número dizendo coisas diferentes, ao lado de um
  título que já explica a tela. O contador que importa é o `N/M` de baixados,
  que está em cada card e agora também no cabeçalho.
- **Os hinários NÃO baixam em lote** (v5.46). São as duas maiores coleções do
  acervo (~1.100 músicas juntas): um botão só disparando as duas é um download
  que ninguém dimensiona antes de tocar, e que não dá para parar pela metade
  sem perder o outro. O cabeçalho "Hinários" mantém o contador (ele informa) e
  perde o botão (`opts.semBotao`); cada hinário baixa pelo botão do próprio
  card. As categorias de álbuns seguem com o download em lote — ali cada álbum
  tem uma dezena de faixas.
- **As opções da coleção abrem ACIMA do acervo** (v5.46). Os dois são
  `.popup-backdrop` com o mesmo `z-index`, então quem vencia era a ordem do
  documento — e o acervo, declarado depois, cobria as opções por inteiro: o
  toque na engrenagem parecia não fazer nada. `#collPopup` ganhou um degrau
  (`z-index: 210`) e foi para o FIM de `POPUPS`, que passou a ser ordenada de
  baixo para cima: o voltar percorre a tabela de trás para a frente, então
  fechar o acervo antes das opções as deixaria órfãs no ar.

#### E a aba de Álbuns saiu (v5.44)

Com o acervo desenhado dentro da busca, a aba virou uma segunda porta para a
mesma tela — e duas portas para o mesmo lugar, numa barra de quatro botões, é
espaço gasto sem informação nova. A **lupa** passa a ser a única entrada:
`activeTab` nunca mais vale `'albums'`, e `TAB_ORDER` (que decide a direção do
deslize entre abas) perdeu a entrada.

Nada de função se perdeu — é a mesma `renderCollectionsList`, com os mesmos
cards, cabeçalhos de grupo e botões de sincronizar. Duas peças foram junto:

- **A linha de uso de disco** (`renderStorageUsage`) ganhou `alvo` e a condição
  `valido()` e acompanhou o acervo. Ela mede OPFS + IDB, e quem enche o disco é
  o download de música: o lugar dela é onde se decide baixar — e apagar. Segue
  também em Favoritos, onde já estava.
- **O refresh periódico** (`renderCollectionsNow`, que acompanha o progresso de
  um download em curso) passou a redesenhar o popup — e **só quando ele está
  mostrando o acervo**. Redesenhar por baixo de uma lista de músicas tiraria do
  lugar exatamente o que o operador está mirando.

### Letra completa no resultado aberto (v5.37)

Tocar num resultado da busca já abria o acordeão com Cantado/Playback; agora,
**abaixo dos botões**, vem a **letra completa** da música. É o que fecha o
ciclo da busca por trecho: achar o hino e conferir se é ele mesmo, sem tocar
nada e sem sair da lista.

- **Montada só ao ABRIR, e uma vez só.** Montá-la para todos os resultados
  encheria a lista de centenas de nós de texto que ninguém pediu — e a lista é
  reconstruída a cada tecla digitada.
- **A linha que casou com a busca fica marcada** (fundo dourado) e recebe
  `scrollIntoView`. O operador digitou aquele trecho justamente para achá-lo;
  numa letra de 30 linhas, procurá-lo de novo com os olhos é trabalho que o app
  pode poupar. A marca usa FUNDO, não só cor: precisa ser achada de relance,
  com o bloco rolando.
- **Rola por dentro**, com teto de `40vh`. Solta, uma letra de 40 linhas
  empurraria os resultados seguintes para fora da tela — e o operador perderia
  de vista justamente a lista que estava percorrendo.
- **Sem letra, explica por quê.** Desde a v5.38 a letra cobre todo o acervo, e
  a ausência passou a significar sempre a mesma coisa — a fila do arranque
  ainda não chegou nesta música (ou falhou). A mensagem é única.
- A fonte é `songLyricLines`, que lê os mesmos dois acervos da busca (texto
  primeiro, slides do arquivo baixado como complemento).

### Busca dentro da LETRA (v5.35)

"Qual é o hino que fala em *firme nas promessas*?" é a pergunta que o operador
faz de verdade, e até a v5.34 a busca só respondia por título e número. Agora o
mesmo campo (`#hymnSearchInput`) também varre o texto das letras.

**A letra já está no aparelho.** `buildLyricSlides` a grava no registro do
arquivo (store `files`) quando a música é baixada — então o índice sai de **uma
leitura do IDB**, sem nenhuma requisição, e funciona offline, que é o estado
normal no meio de um culto.

- **Alcance** (desde a v5.38): **todo o acervo indexado**, hinários e álbuns —
  ver "Acervo de LETRAS" acima. Não depende mais de a música estar baixada.
- **Título ANTES de letra, sempre.** Quem digita "Firme nas Promessas" quer o
  hino de mesmo nome no topo, não os quinze que citam a expressão numa estrofe.
  São dois grupos concatenados (`porNome` + `porLetra`), e quem casa por título
  **nem chega a consultar** a letra.
- **A linha que casou aparece no resultado** (`.hymn-lyric-hit`, em itálico
  dourado com barra à esquerda, para se ler como citação e não como mais um
  subtítulo). Sem ela o item apareceria sem nenhuma relação visível com o que
  foi digitado, e o operador teria que abrir um por um para descobrir se é o
  hino certo.
- **Mínimo de 3 caracteres** (`LYRIC_MIN_Q`) para a busca entrar na letra: com
  menos, "de"/"ao" casariam em quase todo hino e afogariam os resultados por
  título, que são a maioria dos casos.
- **A estrofe é quebrada em linhas** na indexação (o `<br>` da API já virou
  `\n` em `normalizeLyricText`), para o trecho exibido ser uma linha e não o
  bloco inteiro.
- **O índice é construído sob demanda e redesenha ao ficar pronto**:
  `renderSearchResults` é síncrona (roda a cada tecla) e não pode esperar o IDB.
  É invalidado (`invalidateLyricIndex`) no ponto exato em que uma letra nova é
  gravada — invalidar em vez de reconstruir evita pagar a leitura no meio de uma
  sincronização em massa.
- **Custo medido**: com **3.000** letras indexadas — a escala do acervo inteiro
  —, **16,5 ms por tecla** incluindo o render dos resultados. A varredura é `String.includes` sobre um texto
  normalizado uma única vez por música.
- **Acento não atrapalha**: índice e consulta passam pelo mesmo
  `normalizeForSearch` (NFD + remoção de diacríticos), então "criacao" acha
  "criação".

### Diversos: o seletor de ferramenta

A aba reúne quatro ferramentas, e três delas empilhadas **não cabiam** numa tela
de celular: a página ganhava rolagem vertical, e o que a rolagem escondia era
justamente a ferramenta que não estava em uso.

A v5.31 tentou um **acordeão** e ele foi trocado na v5.32: cobrava três
cabeçalhos permanentes de altura para entregar o mesmo resultado, e ainda
deslocava o painel para baixo conforme a posição da ferramenta na pilha — o
Sorteio começava três linhas mais abaixo que as Mensagens. Hoje é um **seletor
no topo** (`.misc-switch`), uma linha só:

- **Uma ferramenta ativa por vez** (`miscTool`), e **só ela é montada** no DOM —
  é o render dela que religa o seu timer de painel. As outras não existem, então
  não há laço batendo em nó invisível.
- **O painel ativo começa sempre no mesmo lugar**, o que importa para a memória
  muscular de quem opera sem olhar.
- **O trilho do seletor é PREENCHIDO no segmento ativo**, ao contrário dos
  segmentados de dentro das ferramentas (Relógio/Cronômetro/Timer,
  Número/Texto), que são contornados. São dois níveis de escolha empilhados na
  mesma tela; parecidos demais, leriam como um só.
- **Ponto vermelho no segmento = aquela ferramenta está projetando.** Trocar de
  ferramenta **não** tira do telão a que estava no ar, e sem o ponto descobrir
  qual é exigiria visitar cada uma. No segmento ativo o ponto ganha um anel
  claro, onde vermelho sobre azul perderia contraste.
- **`#library` não rola nesta aba** (`.lib-misc`): quem administra a altura é o
  seletor + painel, e o painel ativo rola por dentro se precisar. Com a rolagem
  da lista ligada, a página inteira voltaria a rolar e o rodapé sairia da base.
- Verificado nas três ferramentas: **zero rolagem**, horizontal ou vertical.

**O rodapé são as duas ações que MANDAM ALGO PARA A TELA**, lado a lado
(`renderFoot`): o **microfone** e **"Projetar no telão"**. São as únicas com
efeito fora do celular, e tê-las sempre no mesmo ponto vale mais do que a
proximidade com os controles que as configuram — o operador aprende UM lugar em
vez de um por ferramenta. De quebra, o botão de projetar parou de descer
conforme o painel cresce (no sorteio de texto ele ficava abaixo da lista).

- O microfone é uma **barra**, não mais um disco de 132 px: é o único controle
  daqui com urgência real (push-to-talk pode ser preciso no meio de uma frase),
  e como barra custa ~56 px de altura oferecendo área de toque **maior**.
- **"Projetar" age sobre a ferramenta ATIVA** (`miscProjectState`). Em Mensagens
  ele não pode projetar sozinho — falta saber QUAL, e isso se escolhe tocando na
  lista —, então fica **inerte com um `title` que explica**; some não, porque o
  botão é um ponto fixo da tela e sumir faria o microfone pular de largura a
  cada troca. Com uma mensagem já selecionada ele **reexibe** a que ficou: é a
  ação natural depois de um "Tirar do telão", e sem ela o operador teria que
  caçar a linha certa de novo.

> **Vazamento horizontal (v5.31).** A faixa "de/até" do sorteio empurrava a aba
> além da largura da tela. Causa: o padrão de um item flex é `min-width: auto`,
> que o impede de encolher abaixo da largura intrínseca do conteúdo — e um
> `<input type="number">` sem `size` mede ~200 px por conta própria. Dois campos
> de 200 px não cabiam em 394 px. `min-width: 0` nos dois níveis (o campo e o
> wrapper) resolve. É o vazamento clássico de flexbox, e vale para qualquer
> input futuro dentro de uma linha `.misc-row`.

### Diversos: cronômetro · relógio · timer

Terceiro provedor da Camada de Texto, na aba **Diversos** (junto do microfone).
O que vai ao telão é o **mesmo cartão** da Bíblia e das Mensagens
(`mode: 'chrono'`), e isso não é economia de CSS: herdando o cartão, herda
junto toda a regra de convivência já madura — `load` de **áudio** mantém o
cronômetro no ar (louvor de fundo sob a contagem de abertura é o uso normal),
`load` **visual** o encerra, a cortina do wallpaper o cobre, `text-hide` o tira
sem parar o som. Um layer próprio teria que reimplementar as quatro e
envelheceria separado.

**O comando carrega um DESCRITOR, não um valor.** Quem conta o tempo é cada
lado, localmente, a partir de uma origem comum:

```js
{ type:'text', mode:'chrono', sub:'<legenda>', view:'visual',
  chrono: { mode:'clock'|'stopwatch'|'timer',
            running, startAt:<epoch ms>, baseMs:<acumulado nas pausas>,
            durationMs:<alvo do timer>, secs, h12 } }
```

Mandar o texto pronto a cada segundo colocaria ~3.600 comandos/hora no
barramento só para mexer dois dígitos — e deixaria o telão **parado** se um
deles se perdesse. Os dois WebViews são o mesmo processo no mesmo aparelho,
então `Date.now()` é a mesma base dos dois lados (no navegador, idem).

A consequência que mais importa é a **reconexão**: como o número é derivado do
descritor, `resendSceneToDisplay` reenviar o mesmo objeto devolve o cronômetro
**no segundo certo**, não no ponto em que a conexão caiu — sem estado nenhum a
ressincronizar. É o mesmo princípio do `load` + posição já usado para a mídia.
Verificado recarregando o Display com um timer estourado em cena: volta
exibindo exatamente o mesmo valor do Controle.

- **O relógio nasce em `HH:MM`, 24 h** (v5.31). No telão o que interessa é a
  hora; o dígito dos segundos mudando o tempo todo puxa o olho para um número
  que não informa nada. Quem precisar liga no chip. Preferências gravadas antes
  da v5.31 carregam `secs: true` só porque era o padrão de então — por isso
  `chronoPrefs` ganhou um `v`, e um registro sem ele tem o `secs` ignorado:
  respeitar uma "escolha" que ninguém fez faria a mudança não chegar a ninguém.
- **`baseMs` existe porque pausar precisa congelar o acumulado.** Com `startAt`
  sozinho, retomar perderia todo o trecho anterior.
- **O timer NÃO congela em zero** — passa a contar em negativo, em vermelho
  (`.chrono-over`). Num culto, "estourou por 4 minutos" é a informação que se
  quer; um `00:00` parado não distingue "acabou agora" de "acabou há muito".
- **`tabular-nums` não é enfeite.** Com algarismos de larguras diferentes, a
  linha inteira se desloca a cada segundo (o "1" é bem mais estreito que o "8")
  e o número parece tremer — o defeito clássico de relógio digital em web.
- **A fonte é dimensionada pelo CONTEÚDO** (`--ch`, o número de caracteres, que
  o tick escreve no elemento; o CSS faz `min(24cqmin, calc(86cqw / var(--ch) /
  0.66))`). Um tamanho fixo teria que servir ao pior caso — `12:34:56 PM`, 11
  caracteres, numa tela 4:3 — e aí `09:59` sairia pequeno à toa; generoso
  demais, o pior caso vazaria da tela. Medido em 5 proporções (16:9, 4:3,
  16:10) × 6 strings: nenhum vazamento, e 259 px de corpo em 1080p contra os
  69 px que um valor fixo conservador daria.
- **O laço só existe quando há o que animar**: relógio sempre; cronômetro/timer
  só em marcha. Pausado é um número parado, e `hideText` derruba o laço junto
  com o cartão — fora de cena ele só gastaria bateria reescrevendo um nó
  invisível.
- **O painel do Controle tem laço próprio**, com vida ligada à aba: o operador
  precisa ver a contagem correr **antes** de projetar. Sair da aba não para a
  contagem (ela vive no estado), só o laço do painel.
- **Cronômetro e sorteio dividem UM laço só** no cartão (`liveKind`/`liveDesc`
  no Display, `pvLiveKind`/`pvLiveDesc` no Controle). O cartão é um só, então
  dois timers escrevendo no mesmo nó nunca seriam ambos corretos — bastaria um
  esquecer de parar o outro para o sorteio ser sobrescrito pelo relógio. Com um
  registro único isso é estruturalmente impossível, em vez de depender de
  lembrar. (No PAINEL são dois laços, e ali está certo: são duas seções lado a
  lado, cada uma com o seu próprio nó.)
- **Um provedor por vez.** `projectChrono` encerra Bíblia e Mensagem, e as duas
  encerram o cronômetro — é um cartão só. Enquanto ele está no ar,
  `slideTarget()` devolve `null`: sem essa guarda, os botões de estrofe cairiam
  na letra do áudio de fundo, que está **escondido atrás do cartão** — o
  operador apertaria "próxima estrofe" e a música saltaria sem nada mudar na
  tela.
- **Só as PREFERÊNCIAS persistem** (`state.chronoPrefs`: modo, duração, formato
  do relógio, legenda). Uma contagem em curso não sobrevive ao fechamento do
  app de propósito: restaurar um cronômetro que "correu" com o app fechado
  mostraria um número sem significado.
- A ferramenta vive só no **modo avançado**, como o microfone: o simplificado
  existe para quem quer conectar a tela e tocar um louvor.

### Diversos: sorteio

Quarto provedor da Camada de Texto, na mesma aba. Sorteia **número** (faixa
de/até) ou **texto** (lista de opções — nomes, prêmios, perguntas).

**Quem sorteia é só o Controle.** Se cada tela rodasse o próprio `Math.random`,
o telão e a preview anunciariam **ganhadores diferentes** — o pior defeito
possível aqui, e público. O resultado viaja pronto no descritor; o que cada
lado faz sozinho é só a animação até ele.

```js
{ type:'text', mode:'draw', sub:'<legenda>', view:'visual',
  draw: { kind:'number'|'text', value, seed, rollUntil,
          min, max, pool:[<amostra do ruído>] } }
```

- **O rolo é local, e determinístico.** `rollUntil` diz até quando rolar; o
  quadro exibido sai de `rnd32(seed + quadro)` — um PRNG semeado (mulberry32),
  não `Math.random`. É isso que faz telão e preview piscarem **os mesmos
  valores**: a preview existe para mostrar o que o telão mostra, e dois ruídos
  diferentes a tornariam uma tela paralela em vez de um espelho. Medido: 8 de 8
  quadros idênticos durante o rolo.
- **O quadro sai do tempo QUE FALTA**, não do decorrido — assim ele é função
  pura de (descritor, relógio), e um telão que reconecta **no meio do rolo**
  entra no mesmo quadro dos demais e assenta no mesmo ganhador. Verificado
  recarregando o Display durante a animação.
- **Semente nova a cada rodada**: sem ela o ruído seria idêntico toda vez, e um
  sorteio que "roda igual" parece decidido de antemão.
- **A amostra do ruído é limitada** (`DRAW_POOL_CAP`, 40). O que pisca antes de
  assentar não é o sorteio — mandar uma lista de 500 nomes pelo barramento a
  cada rodada seria pagar caro por decoração.
- **"Não repetir" (padrão)** guarda os já sorteados e os exclui das próximas
  rodadas; a lista fica **à vista**, em ordem inversa, porque numa rifa a
  pergunta seguinte é sempre "quem já saiu?" e o contador sozinho não responde.
  Esgotado, o botão desabilita em vez de repetir alguém.
- **Números não materializam a faixa.** Amostragem por rejeição enquanto sobra
  folga, varredura só quando aperta: um "de 1 até 100000" viraria um array de
  100 mil strings a cada sorteio, e no fim (quase tudo já sorteado) a rejeição
  é que ficaria cara. A faixa é limitada a `DRAW_SPAN_CAP` (100000).
- **O resultado e o histórico PERSISTEM** (`state.drawPrefs`), ao contrário do
  cronômetro. Um cronômetro restaurado mostraria um tempo que não correu; um
  sorteio não depende do relógio — e perder "quem já foi sorteado" porque o app
  fechou no meio faria a rodada seguinte repetir alguém, que é exatamente o
  erro que "não repetir" existe para impedir.
- **Trocar número↔texto zera o histórico**: "12" e "Maria" não pertencem ao
  mesmo conjunto, e manter os dois faria o filtro excluir valores que nem podem
  sair.
- **Verificado uniforme**, que é a promessa central: 6.000 sorteios em 1–6 dão
  X² = 9,59 (corte de 1% = 15,09) e 5.000 em cinco nomes dão X² = 5,09 (corte
  13,28).

### Entradas e saídas de camada sempre com fade (`fadeLayerIn`/`fadeLayerOut`)

A mídia do stage e a cortina do wallpaper já têm as próprias transições (ver
`stage.js`). As camadas **paralelas** — letra, texto manual e a imagem de fundo
das estrofes — não passam por lá, e por isso apareciam/sumiam com corte seco.
`fadeLayerIn`/`fadeLayerOut` dão a elas o mesmo tratamento, com
`LAYER_FADE_MS` = 320 ms. **Nada entra ou sai da projeção sem transição.**

As quatro funções (`fadeLayerIn`, `fadeLayerOut`, `fadeContentIn` e o
`findSlideIndex` da letra) vivem em **`shared/stage.js`**, expostas como
propriedades de `createStage` — mesmo padrão já usado por `rampSteps`/
`MUTE_RAMP_TIME`. Elas eram idênticas linha a linha nos dois apps (`pvLayerIn`/
`pvLayerOut`/`pvFadeIn` no Controle) e **não têm calibração própria nenhuma**:
o que difere entre preview e telão é só o CSS, em `cq*` relativo a cada
container. Cada app mantém os aliases locais (`pvLayerIn = createStage.
fadeLayerIn`, etc.) para o resto do código não mudar. As camadas que de fato
carregam calibração continuam duplicadas, de propósito.

- `fadeLayerIn` **não repete o fade** se a camada já estava visível (guarda
  `wasHidden`) — trocar de versículo não faz o cartão inteiro piscar; quem
  anima aí é só o texto (`animateFadeIn`/`pvFadeIn`, 260 ms).
- `fadeLayerOut` só esconde no **término natural** da animação (`onfinish`):
  se um `fadeLayerIn` cancelar o fade no meio (a camada voltou), esconder ali
  apagaria o que acabou de entrar.
- **`hideLyrics(fade)` adia o teardown da imagem de fundo** em `LAYER_FADE_MS`.
  A `<img>` é FILHA da camada: revogar a object URL e escondê-la de imediato
  faria o fundo sumir por trás de um texto ainda esmaecendo. O `lyricLoadSeq`
  guarda esse teardown atrasado (se a letra voltar nesse meio tempo, ele é
  descartado). Mesma coisa em `hidePvLyrics(fade)`.
- `hideText`/`hidePvText` **não limpam o texto** ao sair: apagá-lo na hora
  deixaria o cartão vazio visível durante todo o fade. O próximo `showText`
  sobrescreve.
- Chamadas com `fade=false` continuam existindo de propósito: quando algo
  NOVO já assume a cena no mesmo instante, a transição é da mídia que entra.

### Trecho sem letra: a moldura some (`.nolyric`)

Solos, introduções e trechos instrumentais têm slide com tempo mas sem texto a
cantar. `renderLyricSlide`/`renderPvLyricSlide` ligam a classe `.nolyric` em
`.lyrics-content`/`.pv-lyrics-content` quando a linha principal está vazia **e**
o auxiliar está oculto; o CSS esmaece a moldura inteira
(`.lyrics-content.nolyric .lyrics-box { opacity: 0 }`, com `transition` na
própria `.lyrics-box`), deixando só a imagem de fundo. Uma caixa escura vazia
parada no meio do telão durante um solo não comunica nada. Volta esmaecendo
quando houver o que cantar.

### Fim natural: a capa do hino não pode piscar

No fim da faixa o stage zera o `currentTime` (preparando o replay) e continua
emitindo tempo. Seguir isso re-renderizaria o slide 0 — a **capa do hino**
aparecia por um instante antes de o wallpaper cobrir. Duas guardas simétricas:

- **Display**: `sendStatus()` só chama `updateLyricSlide` se `!stage.hasEnded()`
  (`hasEnded` foi adicionado à API pública de `stage.js`); o `onEnded` esmaece
  a camada (`fadeLayerOut(lyricsEl)`) mantendo os slides carregados.
- **Controle**: a flag `pvLyricsEnded` trava `updatePvLyricSlide` — ligada pelo
  `onEnded` da preview **e** pelo `media-ended` remoto (o Display pode chegar ao
  fim primeiro), desligada em `cmd()` no próximo `load`/`play`/`seek`.

Terminada a faixa, a letra congela no último slide; o replay a traz de volta
(`updateLyricSlide`/`updatePvLyricSlide` refazem o `fadeLayerIn` se a camada
estiver escondida).

O restante desta seção detalha o provedor **Bíblia**; as **Mensagens** são um
provedor mínimo (CRUD de texto puro em `state.messages` + `projectMessage`/
`msgStep`, análogos a `startBibleReading`/`bibleStep`), e a **Letra** tem sua
própria seção ("Letra sincronizada").

## Bíblia (aba `bible`)

Aba própria para **selecionar e projetar textos bíblicos**, com os dados vindos
do mesmo banco público do LouvorJA (ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.6).
O cliente é `public/controle/bible.js` (`window.Bible`, JS puro), que reaproveita
o transporte de `louvorja.js` (`Louvorja.fetchList`) — sem novas credenciais.

### Duas fontes de dados

- **Estrutura offline (`Bible.BOOKS`)**: os **66 livros** do cânon (abreviação +
  nome + nº de capítulos + testamento `ot`/`nt`), fatos fixos embutidos em
  `bible.js`. Alimentam a seleção de livros/capítulos **sem rede nenhuma**, mesmo
  antes de qualquer download.
- **Online (baixada na 1ª vez que for usada)**: a lista de **versões**
  (`pt_bible_version` → `state.bibleVersions`), a lista de **livros** com o
  `id_bible_book` real (`pt_bible_book` → `state.bibleBooks`, só pra casar os ids
  — a exibição vem de `Bible.BOOKS`) e o **texto dos capítulos**
  (`bible_{v}_{b}_{c}` → cache `state['bible:<v>_<b>_<c>']`). `ensureBibleMeta()`
  busca versões+livros em segundo plano (no `init` e ao entrar na aba); é
  silenciosa (sem rede, mantém o cache). `bibleBookId(idx)` usa o id online
  quando há, senão cai em `idx+1` (ordem canônica).

**Download da versão INTEIRA na 1ª vez** (`ensureBibleVersionDownloaded`,
disparado por `enterBibleTab()` ao entrar na aba e ao trocar de versão): em vez
de baixar só o capítulo tocado, ao usar a Bíblia pela primeira vez o app baixa
**todos os 1189 capítulos** da versão selecionada em segundo plano — resumível
(pula o que já está em cache), concorrência limitada (`runLimited`, 5). O texto
é leve (só versículos, sem mídia), então o volume total é modesto. O progresso
(`bibleDl`, memória) aparece **só dentro do popup de seleção de versão**
(`.bible-ver-status` por versão: "✓ Completa offline" / "Baixando N/1189…" /
"Baixa ao usar" — `refreshBibleDl` re-renderiza a lista enquanto o popup está
aberto), **sem disputar espaço com a leitura**; ao terminar sem falhas marca
`state['bibleComplete:<v>']` pra não refazer (cacheado em memória em
`bibleCompleteVersions`, populado pra **todas** as versões no `ensureBibleMeta`). O download **NÃO** é disparado no `init` (só quando o
operador de fato abre a aba Bíblia), e a leitura por capítulo
(`loadBibleChapter`) continua baixando sob demanda como fallback se o operador
abrir um capítulo antes de o download em massa chegar nele.

**O que já está em cache é descoberto com UMA leitura de chaves**
(`AVDB.stateKeys('bible:<v>_')` → `Set`), não com 1189 `getState`. Cada
`getState` abre a própria transação e desserializa o capítulo INTEIRO (~30
versículos de texto) só para testar existência — e essa varredura era refeita a
cada entrada na aba enquanto a flag `bibleComplete` não estivesse marcada. Uma
chave só existe quando o capítulo foi gravado com versículos (os dois pontos de
escrita conferem `vs.length`), então a presença da chave basta como teste.
Consequência boa: se a varredura mostrar que **nada falta**, a flag é marcada
ali mesmo — antes ela só era gravada com `failed === 0`, e uma única falha de
rede (o Wi-Fi da igreja) condenava a versão a revarrer para sempre.

**Persistência offline (não some entre sessões)**: os capítulos ficam no
IndexedDB (`state`, durável por natureza — sobrevive a fechar/reabrir o app e a
atualizações de service worker, que só trocam o cache de assets estáticos). Além
disso, `enterBibleTab()` pede `navigator.storage.persist()` — **a mesma
proteção do sync de músicas/pastas** — para o browser não descartar a origin sob
pressão de espaço (é origin-wide e idempotente). O download é **resumível**:
cada capítulo é gravado assim que chega, então uma interrupção não perde o que
já baixou — a reabertura pula o que está em cache e continua de onde parou.

> O texto de cada versículo pode conter marcação HTML (o app original renderiza
> com `v-html`); aqui `Bible.stripHtml()` extrai **texto puro** (troca de string,
> **sem** `innerHTML` — `<br>`→espaço, tags removidas, entidades comuns
> decodificadas), no mesmo espírito do `normalizeLyricText` da letra.

**Versão padrão: Almeida Revista e Atualizada** (`pickDefaultBibleVersion` casa
por nome — "revista e atualizada"/"RA"/"ARA"; senão a 1ª disponível). A troca de
versão fica num **botão seletor** (`.bible-ver-btn`, com a versão atual) que abre
o **popup** `#bibleVerPopup` com a lista — a lista não fica mais toda exposta em
chips. **O seletor mora na tela de LEITURA** (não na de livros — dá mais espaço
pra grade). Persistido em `state.bibleVersion`; trocar (`changeBibleVersion`)
recarrega o capítulo atual na nova versão (mantendo o versículo) e dispara o
download da nova versão inteira.

### Seleção em "tabela periódica" (três telas)

`renderBible()` despacha por `bibleScreen` (`'books'`|`'chapters'`|`'reading'`),
renderizando dentro de `#library` uma **grade de células no estilo de uma
tabela periódica** (`.bible-grid` + `.bible-cell`): cada célula é um "símbolo"
(a abreviação do livro, ou o número do capítulo/versículo). Os **blocos de
livro são preenchidos por inteiro com a cor do grupo/divisão canônica** (campo
`g` em `bible.js` → classe `.bg-<g>`: `lei`, `historicos`, `poeticos`,
`pmaiores`, `pmenores`, `evangelhos`, `atos`, `paulinas`, `gerais`,
`apocalipse`) — **sem** número de índice e **só a abreviação** (sem o nome
completo, fonte maior). A grade de livros (`.bible-grid--books`) **preenche a
altura disponível** (11 linhas em `1fr`) pra caber **sem scroll**.

**Capítulo e versículo convivem numa tela só** (`'chapters'`), dividida na
vertical (`.bible-split`): em cima a grade de **capítulos**, embaixo a de
**versículos** do capítulo escolhido (`bibleVersesPane()`, que também rende os
estados "Escolha um capítulo acima." / "Baixando versículos…" / erro / capítulo
vazio). O **nome do livro fica em destaque no topo** (`.bible-book-head`) — sem
ele, uma tela só de números não diz em que livro o operador está.

As duas metades dividem a área **ao meio** e cada uma **rola por conta
própria** (`minmax(0,1fr)` nas faixas — sem o mínimo em 0, uma grade grande
como os 150 capítulos de Salmos esticaria a faixa e comeria a outra metade).

A **barra de rolagem fica sempre visível** nelas: no Android a barra é
"overlay" — só aparece durante o gesto e some —, então nada indicava que havia
mais capítulos ou versículos abaixo. Declarar largura em `::-webkit-scrollbar`
tira o modo overlay e a barra passa a ocupar espaço de verdade, o que é o que a
torna permanente (`scrollbar-width`/`scrollbar-color` cobrem o mesmo no padrão
novo). A grade ganha um `padding-right` para a última coluna não encostar nela.

> Houve uma tentativa de **encaixar tudo sem scroll**, encolhendo as células e
> repartindo a altura conforme o número de linhas de cada grade
> (`fitBibleGrids`, calculado em JS). Foi revertida: com Salmos ou o Salmo 119
> as células ficavam pequenas demais para acertar o toque, e a proporção
> variável fazia a tela mudar de cara a cada livro. Rolar com uma barra
> visível é mais previsível.

As duas grades marcam a seleção atual (`.bible-cell.active`: fundo accent +
anel branco), e é isso que faz **voltar da leitura mostrar de imediato o
capítulo E o versículo que estão no ar**, sem o operador ter que se localizar —
e sem procurar, já que nada rola.

Capítulos e versículos mantêm **tons distintos** (`.bible-grid--chapters` em
tom frio/azulado, `.bible-grid--verses` em tom quente/dourado) pra separar bem
os dois níveis. Fluxo: **livros → capítulo+versículo → leitura**; o botão
voltar (`#backBtn`) recua uma tela (`navigateBack` é `bible`-aware,
`gotoBibleScreen`), e cada troca faz um **leve slide direcional**
(`animateTabSwitch` reaproveitado; `BIBLE_SCREENS` dá a direção).

> Antes eram **quatro** telas — capítulo e versículo eram passos separados. Um
> versículo tem duas coordenadas dentro do mesmo livro; separá-las em telas
> obrigava a voltar uma tela só para trocar de capítulo, e ao voltar da leitura
> só se via a grade de versículos, sem pista de qual capítulo era.

Tocar num **capítulo** dispara `loadBibleChapter()`, que lê o cache ou **baixa
o capítulo na hora** (`Bible.fetchChapter`, gravado em `state`) — sem trocar de
tela: a metade de baixo mostra o estado enquanto isso. Guarda de sequência
(`bibleLoadSeq`) descarta downloads obsoletos numa troca rápida.

### Tela de leitura + projeção e navegação por slide

Tocar num **versículo** (`startBibleReading`) inicia uma **sessão de leitura**
(`bibleSession = { versionId, bookIdx, bookId, bookName, chapter, verses, idx,
projecting }`) e abre a tela `'reading'` — **mas NÃO projeta nada ainda**
(`projecting:false`). A tela de leitura (`renderBibleReading`, `.bible-read`)
mostra **quatro seções empilhadas** — versículo **anterior · atual · próximo ·
seguinte** (`.bible-vsec`): um atrás e **dois à frente**, porque ler adiante é
o que o operador faz (ele precisa saber o que vem para acompanhar a leitura,
não o que já passou).

**Cabe na tela sem scroll**: as quatro seções repartem entre si a altura que
sobra depois do rodapé (`flex: 1 1 0` + `min-height: 0` — é o `min-height` que
permite encolherem abaixo do próprio conteúdo; sem ele voltariam a empurrar a
tela). O **central recebe metade a mais** (`flex: 1.5`), então é o último a
apertar quando o versículo é longo. O texto que não couber é cortado com
reticências (`-webkit-line-clamp`): a íntegra vai para o telão, aqui basta
reconhecer o versículo. Rolar para achar o versículo central seria o oposto do
que essa tela serve. Embaixo, um **rodapé** (`.bible-read-foot`) com um **controle segmentado
único** (`.bible-ref-nav`) trazendo as quatro coordenadas do que está sendo
lido — **Versão · Livro · Capítulo · Versículo** —, cada uma levando ao seu
próprio seletor. Emendados, continuam lendo como uma referência
("ARA · João · 3 · 16") em vez de quatro ações soltas.

A **versão entra pela sigla** (`bibleVersionAbbr`): "Almeida Revista e
Atualizada" ocupava a linha inteira e empurrava a referência para baixo, e a
sigla que todo mundo já usa diz a mesma coisa em três letras. As regras, em
ordem: um acrônimo entre parênteses no próprio nome é a melhor resposta
possível; um nome de uma palavra já é a sigla; senão, as iniciais das palavras
significativas (ignorando "e", "de", "na"…) — o que dá ARA, ARC, NVI, NAA,
NTLH, ACF. Sem `flex-wrap`: quem cede espaço quando a linha aperta é o **nome
do livro** (`.bible-ref-part--book`, o único de largura imprevisível), com
reticências.

Antes a referência era um botão só, que sempre voltava à grade de livros —
trocar só o capítulo custava passar pela seleção de livro de novo. Capítulo e
Versículo levam à mesma tela porque as duas grades convivem nela. Cada botão
sincroniza `bibleSel` com a leitura antes de navegar, senão a grade abriria no
que o operador escolheu por último, e não no que está no ar. O status offline **não** fica aqui
(só no popup de versões — ver acima). Nos **limites de capítulo/livro**,
as seções anterior/próximo mostram o versículo do **capítulo vizinho** (cruzando
pro livro seguinte/anterior), com um **badge indicador** (`.bible-vsec-cross`,
borda tracejada — ex.: "◂ Livro anterior: Amós 9") **antes** de selecioná-lo; o
texto do vizinho é lido sob demanda (`bibleAdjacentVerse`/`ensureAdjLoaded`,
cache `bibleAdjCache`). Início/fim da Bíblia mostram "Início/Fim da Bíblia".

**Gate de ativação (`projecting`)** — o texto só vai pro telão depois de um
toque no versículo CENTRAL:
- Tocar no **anterior/próximo** (`.bible-vsec.adj`) → `bibleSetIdx` move aquele
  versículo pro central. Enquanto `projecting` é `false`, **só move** (nada é
  exibido; aparece a dica `.bible-read-hint`).
- Tocar no **central** (`.bible-vsec.cur`) → `activateBibleVerse` liga
  `projecting` e **exibe** o versículo (o central ganha o rótulo verde "● No ar",
  classe `.live`).
- Já **ativado**, tocar no anterior/próximo (ou usar os botões de slide) **exibe
  automaticamente** o novo versículo (`bibleSetIdx` chama `projectBibleVerse`).

`projectBibleVerse` sempre marca `projecting:true` (é o ato de exibir);
`renderNowPlaying` só mostra a referência quando `projecting` (antes disso o
telão ainda não tem a Bíblia, então o now-playing segue a mídia normal).

A projeção usa a **Camada de Texto** unificada (ver seção "Camada de Texto"): o
comando `text` (`{ main, sub, mode:'verse', view }`) mostra o **texto do
versículo com a referência (dourada, em `sub`) ABAIXO dele** num cartão central
de **tamanho fixo**, tanto no **Display** (`#text` layer, ver abaixo) quanto na
**preview** do Controle (`#pvText`, `showPvText`) — a preview sempre espelha o
telão. `projectBibleVerse` monta esse comando via `cmd()`.

Os **controles de slide** (`#slidePrevBtn`/`#slideNextBtn`, e os gestos
invisíveis da preview em tela cheia) **passam/voltam versículos** quando há
sessão ativa: `stepSlide` e `renderSlideNav` checam `bibleSession` antes da letra
sincronizada, chamando `bibleStep`. **No fim do último versículo do capítulo,
`bibleStep` pula para o 1º versículo do capítulo seguinte — cruzando para o
próximo LIVRO se preciso** (`nextChapterRef`/`prevChapterRef` +
`bibleGotoChapter`, que baixa o capítulo vizinho sob demanda e faz a seleção
acompanhar); os botões só desabilitam no começo (Gn 1:1) e no fim (Ap, último
versículo) da Bíblia. Cada troca reenvia um novo comando `text` (não `seek` —
não há áudio/tempo) e o **texto entra com fade** (`animateFadeIn`/`pvFadeIn` —
transições são inerentes ao sistema, ver o state `fade`); mostrar/
esconder a camada e o toggle de wallpaper usam a cortina com fade
(`coverIn`/`coverOut`). O mesmo fade curto entra nas trocas de estrofe da letra
sincronizada. O `#npName` mostra a referência atual; `play`/`pause` **NÃO** são
mais no-op — controlam o **áudio de fundo** quando há um tocando (ver
"Independência do áudio" na seção Camada de Texto); só viram no-op sem áudio de
fundo (`playPause` checa `!preview.getCurrent()`). Uma **mídia comum** (visual)
assumindo a cena (`send`) ou o **stop** (`stopClear`) encerram a leitura
(`clearManualText` = `clearBibleSession` + `clearMsgSession` + o Display/preview
escondem a camada). Um `send` de **áudio** com sessão de texto ativa **mantém** a
sessão (não chama `clearManualText`) — é o áudio de fundo. O `viewToggle`
(`setView`, ciente da sessão de texto) liga/desliga a **cortina compartilhada**
do wallpaper por cima do texto, sem passar por `preview.handle` (que recobriria —
não há mídia carregada no stage, a menos que seja o áudio de fundo).

**As guardas da Camada de Texto no Controle usam `pvTextActive`, nunca
`bibleSession`.** O Display sempre tratou os dois provedores de forma unificada
(`textActive`); o Controle checava só a Bíblia em dois pontos, e com uma
**Mensagem** no ar isso dava dois defeitos reais: (a) o `setView` caía no
caminho genérico → `setViewFaded` → `instantCover(computeCover())`, e como o
stage da preview está sem `current` a cortina voltava na hora — a mensagem
sumia da preview enquanto seguia corretamente no telão; (b) o ▶ caía em
`send(currentId)`, que chama `clearManualText()` e **tirava a mensagem do telão
no meio do culto**, quando pela documentação deveria ser no-op (e com a Bíblia
era). `previewTick` já usava o predicado certo — os outros dois pontos agora
também.

A projeção de texto é **independente da navegação de abas** (como qualquer outra
mídia): o `load()` (disparado a cada troca de aba) **não chama
`preview.setView` enquanto `pvTextActive`** — sem essa guarda, como o stage da
preview está sem `current` (a Camada de Texto é paralela), `setView` cairia em
`computeCover()===true` e recobriria a cortina, fazendo o texto sumir da preview
ao sair da aba. O Display nunca é afetado por troca de aba (só encerra o texto
com `load` visual/`stop`/`clear` explícitos).

### No Display

Layer `#text` (`.text-layer`), **`z-index:2` — acima de toda a mídia**
(`z-index:1`), inclusive do iframe do YouTube, que vem depois no DOM e com
z-index igual pintaria por cima do cartão. A cortina do wallpaper sobe para
`z-index:3` (nada é colocado sobre o wallpaper) e o escudo do YouTube para
`4`. Como `.layer` já traz `background:#000`, o cartão é **opaco**: o texto
manual cobre a cena inteira, que é o que se espera de uma interferência
direta do operador.

**É essa opacidade que dá continuidade à cena.** Nada precisa ser
interrompido para o texto aparecer: a mídia segue tocando intacta por baixo —
áudio audível, vídeo rodando, posição preservada — e **reaparece exatamente
onde estava** quando o texto sai. Antes o `showText` derrubava o player do
YouTube (`ytDrop()`) para o cartão ficar visível, e não havia como voltar:
tirar o versículo do ar deixava a cena vazia.

`showText(cmd)` chama apenas `hideLyrics(true)` — a letra sincronizada é a única
coisa que sai de cena, porque ela **é** texto e o manual tem precedência — e
**NÃO chama `stage.clear()`** (o áudio de fundo segue tocando, ver
"Independência do áudio"); pinta `main`/`sub`, aplica a classe
`.mode-message` conforme o `mode` e revela conforme a `view`; um novo `text` já
em cena só troca o texto (sem piscar). Enquanto `textActive`, o roteamento de
comandos trata a Camada de Texto como paralela (igual ao YouTube): `view` só
liga/desliga a cortina (`stage.coverIn/coverOut`); `load` de **áudio** mantém o
texto (troca o som de fundo), `load` de **visual**/`stop`/`clear` chamam
`hideText(false)` e seguem o fluxo; **transporte** (play/pause/seek/volume/mute)
cai no fluxo do stage (áudio de fundo).

**Sair do texto devolve a cena** (`hideText(restore)` → `restoreSceneAfterText()`,
espelhado por `hidePvText`/`restorePvSceneAfterText` na preview): vídeo, imagem e
YouTube não precisam de nada — nunca foram interrompidos e reaparecem sozinhos
assim que o cartão sai da frente. Só a **letra sincronizada** precisa ser
remontada, e **no slide correspondente ao instante atual** da música
(`updateLyricSlide(stage.getTime())`; na preview, `authoritativeTime()`), não do
começo — a música avançou enquanto o versículo estava no ar. O parâmetro
`restore` é falso justamente quando algo novo já vai assumir a cena (load de
visual, `stop`, `clear`): restaurar ali faria a cena antiga piscar antes de ser
substituída. Como `showLyrics` retorna cedo enquanto `textActive`, trocar o
áudio de fundo com o texto no ar também funciona: ao sair, entra a letra do
áudio **atual**. O texto (`.text-box`) usa o mesmo redimensionamento por Container Queries da
letra (`container-type:size` + `cq*`), mas em prosa (caixa-baixa) e **SEM
moldura, ocupando a tela inteira**. A moldura da letra sincronizada existe para
dar contraste contra a imagem de fundo da estrofe; aqui o texto é sempre
projetado sobre o preto, então a borda seria só uma caixa desenhada à toa — e,
pior, uma caixa FIXA e menor que a tela, que apertava textos bíblicos (bem mais
longos que uma estrofe) num espaço pequeno enquanto sobrava tela vazia em
volta. Agora o texto ocupa o que tiver, com margens generosas
(`padding: 7cqh 7cqw` no container) e **fonte bem maior** (`6.4cqmin`, contra
`4.8cqmin` da caixa antiga; `7.4cqmin` no modo mensagem). No modo `verse` a
**referência (`#textSub`) fica ABAIXO do texto** (ordem no DOM, `hidden` quando
vazia — mensagens não têm referência) e conteúdos muito longos continuam sendo
cortados com reticências (`-webkit-line-clamp: 8` + `overflow:hidden`), que é a
garantia final contra vazamento. A preview espelha tudo isso em
`.pv-text-*`.

---

## Display

Interface mínima: wallpaper + layer de imagem + layer de vídeo + iframe do YouTube.

Escuta o BroadcastChannel e repassa os comandos para `stage.handle()` (ou para
a ponte do YouTube). Ao inicializar, **não** recarrega nem toca a última mídia
sozinho — `restore()` só restaura a config de fade (preferência visual) e
envia `display-ready`; o Display abre sempre no wallpaper (ponto inicial),
esperando um comando explícito. A inicialização do sistema precisa ser
**controlada** (nenhuma mídia deve começar a tocar sozinha ao abrir o app) —
quem decide se retoma o que estava tocando é o **Controle**, ao receber
`display-ready` (com base no que ELE sabe que estava tocando, não em algo
persistido pelo próprio Display).

**Toque único ao abrir (`#startBtn`, "Ligar Sistema") — só no navegador.**
No app ele fica **oculto** (`window.__NATIVE__`): o WebView roda com
`mediaPlaybackRequiresUserGesture = false`, e uma TV não recebe toque nenhum.
No navegador a área de toque cobre a tela inteira (z-index acima de tudo,
inclusive do wallpaper e do escudo do YouTube — qualquer toque serve) e some
para sempre após o primeiro toque; um `.start-pill` central (fundo amarelo,
cantos arredondados, sombra) é só a pista visual de "isto é clicável" — sem
ele o texto flutuando no preto não parecia um botão. **Ele APENAS ativa o
Display** (destrava o áudio de terceiros/YouTube com o gesto real): não abre o
Controle nem redireciona pra lugar nenhum. (Chegou a existir uma chamada a
`requestFullscreen()` + trava de orientação via Screen Orientation API **no
Display** — removida: na prática regrediu o lançamento do Controle e nunca
engajou. A trava de paisagem só reapareceu, com sucesso, na **preview do
Controle** — lá ela roda já dentro de um `requestFullscreen` de elemento, que é o
contexto em que a Screen Orientation API é permitida.) Ao tocar, a classe `.confirming` dispara uma
animação rápida (~0,3s: pill cresce levemente e esmaece, fundo vai a
transparente) antes do elemento sumir de fato (`hidden = true` só depois do
`setTimeout` correspondente) — sem esse feedback, o overlay sumia no mesmo
instante do toque e a ação parecia não ter surtido efeito nenhum. Existe
porque autoplay com som em conteúdo de
**terceiros** (o iframe do YouTube) exige um **gesto real do usuário** na
página — diferente da mídia local do stage (mesma origem), que autoplay com
som é liberado automaticamente (ver abaixo). Esse gesto **não
pode ser simulado via JS** (é assim que o navegador garante que é uma ação
real da pessoa) — por isso o botão, em vez de tentar automatizar. O toque é um
`pointerdown` normal, que já borbulha para o listener de recuperação de áudio
do stage; se um YouTube já tiver sido restaurado (`restore()`) antes do
toque, o clique reaplica mute/volume/play nele imediatamente — mesmo sem
isso, `ytWatchStart()` e a resincronização de mudo em `ytStartTimeLoop()` (ver
seção do YouTube) convergiriam sozinhos em poucos segundos.

**Áudio sem toque (recuperação automática — só mídia local do stage):** ao
contrário do `#startBtn` acima (que existe só por causa do YouTube), mídia
local **não precisa de nenhum toque prévio** — não há overlay de unlock
bloqueante para ela. Se a política de autoplay do navegador bloquear
som sem gesto num vídeo/áudio local, ele **começa mudo** (sempre permitido — o
conteúdo aparece no telão sem toque) e a recuperação automática religa o áudio
em retentativas de ~5 s (`setMute(false)`, detectando se o navegador pausou).
**No app este mecanismo é desativado** (`window.__NATIVE__`): sem política de
gesto no WebView, qualquer detecção seria falso positivo. No navegador, a
primeira retentativa costuma resolver. **Nada é exibido no telão**: o estado vai no
campo `audioBlocked` do `display-status`; no **Controle**, além do toast, o
**botão de mudo do mixer** vira indicador (estado `.blocked`, âmbar pulsante,
ícone de volume off) e **atalho**: o clique envia `audio-retry` (retentativa
imediata) em vez de alternar o mudo. Qualquer gesto real no Display
(toque/tecla — `pointerdown`/`keydown` no documento) religa o áudio na hora. O
comando `mute` do operador encerra a recuperação. **Este mecanismo não se
aplica ao YouTube** — ver seção abaixo.

### YouTube (IFrame Player API oficial)

Ao receber `load` de um item `kind='youtube'` vindo de mídia comum, o Display
esmaece o stage até o **preto** (`stage.fadeOutToBlack()` — nunca a cortina do
wallpaper: é troca de conteúdo, não um stop/clear do operador) e cria um
player usando a **IFrame Player API oficial do YouTube**
(`https://www.youtube.com/iframe_api`, carregada por `loadYtApi()`) em vez de
falar diretamente com o protocolo interno do embed via `postMessage` cru. A
API expõe um objeto `YT.Player` de verdade — eventos garantidos
(`onReady`/`onStateChange`) e métodos reais (`playVideo`, `pauseVideo`,
`seekTo`, `setVolume`, `mute`/`unMute`, `destroy`) — eliminando uma classe
inteira de bugs de timing que a reimplementação manual do protocolo (versão
anterior) sofria.

- **Fetch do script adiantado para a abertura do Display** (`restore()` chama
  `loadYtApi()` sem esperar, antes de enviar `display-ready`): o Cronograma é,
  na prática, sempre usado na sessão em curso, então esse fetch de rede vai
  acontecer de qualquer forma — adiantá-lo tira essa etapa do caminho crítico
  do primeiro vídeo do YouTube tocado (que antes só disparava o fetch no
  próprio `loadYoutube()`). `loadYtApi()` é idempotente e cacheia a promise
  (`ytApiPromise`), então chamadas seguintes em `loadYoutube()` reaproveitam
  o mesmo carregamento sem custo extra. **Não cria nenhum player** — só busca
  o script; não viola a regra de "nenhuma mídia inicia sozinha ao abrir".
  - **Pré-carregar os próprios vídeos (criar players com antecedência) foi
    descartado**: o Cronograma não é a fila de reprodução real (isso é a
    `playlist`, cuja ordem só é previsível em `repeat='all'`/`'one'` — em
    `'shuffle'` ou uso ad-hoc não há "próximo" confiável), e manter múltiplos
    `YT.Player` vivos ao mesmo tempo consome memória/CPU/rede em paralelo no
    mesmo aparelho que já faz o Miracast — risco maior que o ganho, já que o
    `cueVideoById()` tende a só buscar metadados (não bufferizar vídeo de
    verdade) antes do play de qualquer forma.

- **`#youtube` é só um wrapper** (`<div class="layer yt-frame" hidden>`); a
  API cria o `<iframe>` real **dentro** dele a cada vídeo, via um elemento
  host descartável (`createYtHost()` — id incremental `yt-host-N`). O CSS
  (`.yt-frame iframe { width/height:100% }`) estiliza qualquer iframe filho,
  então o wrapper nunca precisa conhecer detalhes do iframe da API.
- **UI mínima**: `playerVars` pede `controls:0`, `disablekb:1`, `fs:0`,
  `iv_load_policy:3`, `rel:0` — sem barra de controles, teclado, fullscreen,
  anotações ou vídeos relacionados ao final. O wrapper tem
  `pointer-events:none` (CSS) — toque/hover no telão nunca invoca overlays;
  todo o transporte vem do Controle. `allow="autoplay; fullscreen;
  encrypted-media; picture-in-picture"` é aplicado programaticamente no
  iframe (`getIframe().setAttribute('allow', …)`, logo após criar o player e
  de novo em `onPlayerReady`), já que a API não garante esse atributo por
  conta própria. Usa a sessão logada do navegador (mesmo domínio
  `youtube.com`) — conta **Premium** é detectada automaticamente (sem
  anúncios).
  - **Truque de escala para minimizar a marca do YouTube** (`.yt-frame
    iframe` em `display.css`, mesmo em `.pv-yt-frame` do Controle — ver
    seção da preview): o que sobra de UI própria do YouTube (logo, botão de
    play do estado "cued", spinner de buffering) tem um piso de tamanho que
    não é exposto por `playerVars` — não escala pra baixo conforme o iframe
    encolhe. O iframe é renderizado a **400% do wrapper**
    (`width/height:400%`, centralizado) e depois encolhido de volta com
    `transform: scale(.25)`: como o CSS transform só afeta a composição
    final (não o layout interno que o iframe usa pra decidir o tamanho da
    própria UI), o iframe "pensa" que está com 4x o tamanho — bem dentro da
    faixa onde essa UI fica proporcional ao vídeo — e só depois a imagem já
    pronta (vídeo + UI) é encolhida de volta pra caber no wrapper. Aplicado
    tanto no Display (já em tela cheia — aqui o objetivo é minimizar ainda
    mais a marca, não corrigir desproporção) quanto na preview do Controle
    (onde a caixa é bem menor que o mínimo recomendado pelo YouTube — 480×270
    pra 16:9 — e por isso a UI ficava visivelmente grande demais antes desse
    truque).
- **Reveal do wrapper independe da view**: o wrapper (`ytShow()`) fica oculto
  só até o primeiro estado `PLAYING` (1) — os estados de carregamento/cued
  mostram título e botão grande, que nunca chegam ao telão (safety: revela às
  cegas em 5 s se nenhum evento tiver chegado ainda). Quem decide se isso
  aparece de fato na tela é a **cortina compartilhada do wallpaper**
  (`stage.coverIn()`/`coverOut()` — ver "Modelo de camadas" na seção do
  motor de renderização), não o wrapper: ao entrar no estado `PLAYING`,
  `onPlayerStateChange()` chama `stage.coverOut()` **só se** `yt.view` for
  `'visual'`; se for `'wallpaper'`, o wrapper já revelado continua tocando
  (com áudio) por baixo da cortina, e `ytSetView('visual')` (chamado depois,
  quando o operador desligar o wallpaper) só precisa abrir a cortina — o vídeo
  já está pronto e visível por baixo. Antes dessa separação, o wrapper só se
  revelava se `view==='visual'` no momento do `PLAYING`; um vídeo que
  começasse com o wallpaper ligado nunca satisfazia essa condição e ficava
  preso atrás do wallpaper para sempre (o áudio tocava normalmente, só o
  vídeo nunca aparecia ao desligar o wallpaper depois).
- **Fim do vídeo** (estado `ENDED`, 0): `ytShield(true)` cobre instantaneamente
  a tela final de "vídeos relacionados" e `stage.instantCover(true)` garante
  o wallpaper já pronto (opaco) por baixo do escudo. Se nenhum `load` de
  avanço automático chegar em ~400 ms, o Display **derruba o player**
  (`destroy()`) e o escudo esmaece (`ytFadeOutPlayer()`), revelando o
  wallpaper já coberto — sem o escudo, o wallpaper (agora por cima de tudo)
  ficaria escondido atrás da tela de "vídeos relacionados" em vez de cobri-la;
  o `#ytShield` por isso tem z-index **acima** do wallpaper. O Controle marca
  `ytEnded` e o ▶ recarrega o item (novo `load`).
- **Pausa e seek seguem o padrão de player normal**: quadro congelado no
  telão; a UI que o YouTube desenhar nesses estados é aceita (sem tela preta).
  `stop`/`clear`/troca **não pausam** o player antes do fade (pausa desenharia
  UI): o fade-out visual corre com **rampa de volume** via `setVolume`
  (`ytRampVolume`) e o player é derrubado ao final.
- **Stop/clear manual com fade out ativo**: o player do Display continua tocando
  (estado `PLAYING`) durante toda a rampa de volume do fade-out. `stopYoutube()`
  marca `yt.stopping=true` e limpa `yt.timeLoop` **antes** de aguardar o fade, e
  `ytStatus()` não envia `display-status` enquanto esse flag estiver ativo —
  evita reportar `playing:true` no meio do stop. No Controle, `stopClear()` marca
  `ytEnded=true` para itens `kind==='youtube'`, garantindo que o próximo ▶ chame
  `send(currentId)` (recarga completa) em vez do `cmd({type:'play'})` genérico
  (no-op sem player vivo). A antiga corrida do `ytStopping` (um `display-status`
  atrasado em trânsito reportando `playing:true` e desfazendo o `ytEnded`,
  exigindo apertar stop duas vezes) foi resolvida de outra forma: o
  `display-status` só zera `ytEnded` junto com um `playing` fresco do item atual
  e o `stopClear()` não é mais desfeito por status em trânsito da mesma forma —
  a flag `ytStopping` foi removida (ver a seção de sincronização da preview do
  YouTube para o modelo Display-como-fonte/preview-fallback).
- **Status e progresso**: ao contrário do protocolo antigo (que empurrava
  `infoDelivery` continuamente), a API oficial só notifica em transições
  discretas de estado — por isso `ytStartTimeLoop()` faz um polling leve
  (a cada 500 ms, via `getCurrentTime()`/`getDuration()`/`getPlayerState()`)
  enquanto o player existir, alimentando `display-status` para a barra de
  progresso do Controle.
- **Recuperação de mudo via fato real, não heurística de tempo**: autoplay com
  som em conteúdo de terceiros exige um gesto do usuário na página (ver
  `#startBtn` acima) — antes desse gesto, o player pode ignorar o `unMute()`
  inicial e ficar mudo mesmo com `yt.muted===false` (intenção do operador é
  som). Diferente da antiga tentativa (removida por gerar falsos positivos:
  media unstarted/cued por tempo demais **não prova** bloqueio, só pode ser
  buffering lento), `ytStartTimeLoop()` (a cada 500 ms) chama
  `player.isMuted()` — um **fato real** relatado pelo player agora, não uma
  suposição — e só reage (reenvia `unMute()` + `setVolume()`) quando isso
  realmente diverge da intenção. Converge assim que a página tiver um gesto
  real: o toque em `#startBtn` (se ainda visível) resolve na hora; sem ele,
  o próprio polling resolve em até ~500 ms depois do primeiro gesto (toque,
  tecla) em qualquer lugar do Display. `onPlayerReady()` ainda faz a
  tentativa inicial de `mute`/`unMute` + `setVolume` + `playVideo` uma vez,
  conforme `yt.muted`, e nunca muta o vídeo por conta própria (fora dessa
  resincronização). `loadYoutube()` encerra qualquer recuperação de áudio do
  **stage** que tenha ficado presa (`endAudioRecovery()`) — sem isso, um
  bloqueio de um vídeo local anterior ficava "grudado" e o indicador de mudo
  do mixer aparecia aceso durante o YouTube sem motivo real.
- **Preto (não wallpaper) enquanto o vídeo carrega**: `loadYoutube()` calcula
  a view desejada (`desiredView`) antes de decidir a cortina —
  `stage.instantCover(desiredView === 'wallpaper')`. Carregar um vídeo do
  YouTube depende de rede e é bem mais lento que mídia local; cobrir com o
  wallpaper **de propósito** (`view='wallpaper'`) continua correto, mas usar
  o wallpaper só porque o vídeo ainda não carregou (`view='visual'`) fazia a
  marca aparecer por vários segundos a cada troca, parecendo que o sistema
  tinha parado em vez de só carregando — por isso, nesse caso, a cortina fica
  fora (preto simples, nada cobrindo) até o vídeo entrar em `PLAYING` e
  `ytShow()`/`stage.coverOut()` revelarem-no.
- **Início garantido sem mexer no mudo**: o primeiro `playVideo()` (em
  `onPlayerReady()`) pode chegar antes do player interno aceitar o comando e
  o vídeo fica parado em unstarted/cued. `ytWatchStart()` reenvia
  `playVideo()` a cada ~2 s (até 4 tentativas) enquanto o estado não avança
  para playing/paused/buffering — sem tocar em mute/volume, só um empurrão
  para o play pegar.
- **Host novo a cada troca (`ytDrop()`)**: em vez de só trocar o `src` de um
  iframe fixo (abordagem antiga, que mantinha o mesmo `contentWindow` entre
  vídeos), cada `loadYoutube()` cria um elemento host novo e a API instancia
  um `<iframe>` novo dentro dele; `ytDrop()` chama `player.destroy()` e limpa
  o wrapper (`innerHTML = ''`). Isso garante que uma mensagem do player
  anterior ainda em trânsito nunca seja confundida com o estado do vídeo
  novo (causa de reinícios/travamentos esporádicos na versão com
  `postMessage` manual) — cada instância de `YT.Player` só entrega eventos
  para os callbacks fechados sobre ela mesma (`if (yt === cur) …`).
- **Transições**: com fade ativo, o reveal do **wrapper** no estado `PLAYING`
  usa fade próprio (opacidade do wrapper); a cortina do wallpaper (se
  aplicável) usa sua própria transição via `stage.coverOut()`/`coverIn()` —
  as duas são independentes. `stop`/`clear`/troca esmaecem o player antes de
  derrubá-lo. `ytSeq` guarda operações assíncronas obsoletas (equivalente ao
  `loadSeq` do stage) — inclusive o carregamento assíncrono da própria API
  (`loadYtApi()`) na primeira vez.
  - **Cancelar um `loadYoutube` em curso quando `yt` ainda é `null`:**
    `loadYoutube()` fica entre `await`s (o `fadeOutToBlack`, que pode durar
    `fadeTime` até 5 s, e o `loadYtApi()`) antes de atribuir `yt`. Um
    `stop`/`clear`/`load` de mídia comum que chegue nessa janela **bumpa
    `ytSeq`** mesmo com `yt` nulo (`if (yt) stopYoutube(); else ++ytSeq;` no
    stop/clear; o `else { ++ytSeq; ytDrop(); }` no load comum) — assim o
    `if (seq !== ytSeq) return` do `loadYoutube` em curso o descarta. Sem isso,
    o player nasceria por cima do novo estado (vídeo tocando depois de um stop,
    ou por cima da mídia comum que entrou) alguns segundos depois. Se falhar o
    `loadYtApi()` (rede), o `try/catch` aborta o load em vez de pendurar.
- **No Controle, a preview do YouTube é um SEGUNDO `YT.Player` independente**
  (`controle.js`: `loadYtPreview()`/`ytPreviewHandle()`/`dropYtPreview()`),
  não uma captura do que está no Display — inevitável, já que o iframe do
  YouTube é cross-origin e não pode ser espelhado por `captureStream()`/canvas
  (bloqueado pela mesma-origin policy), e a Screen Capture API
  (`getDisplayMedia()`) não é confiável no Chrome Android, que é onde o
  Display sempre roda. O player da preview:
  - Vive dentro de `#pvYoutube` (wrapper `.pv-layer` no `#preview`, mesmo
    padrão do `#youtube` do Display: a API cria o `<iframe>` real dentro
    dele). `stage.js` continua tratando `kind='youtube'` só como thumbnail
    (`img.src = rec.thumb`) — `preview.handle()` roda normalmente em paralelo
    (mantém `preview.getCurrent()` em dia, usado pela lógica de play/pause do
    botão de transporte) e serve de placeholder visual até o player real
    assumir por cima (mesmo z-index, depois no DOM).
  - **Sempre mudo** (`mute:1` no `playerVars` + `player.mute()` em
    `onReady`) e pede a **menor qualidade disponível**
    (`setPlaybackQuality('tiny')`) — reforçada em três pontos:
    `onReady`, `onPlaybackQualityChange` (o YouTube pode ignorar o pedido
    inicial) e um **polling a cada 1,5s** enquanto o player existir
    (`ytPreviewForceLowQuality`, limpo por `dropYtPreview()`). O polling
    existe especificamente por causa do truque de escala da UI (acima): como
    o iframe agora é renderizado a 400% do wrapper — bem maior do que o
    tamanho visual de ~130px de altura —, o YouTube decide a qualidade
    padrão pelo tamanho QUE ELE enxerga (400%), então sem reforço contínuo
    esse truque puramente visual poderia silenciosamente puxar uma
    qualidade mais alta (e mais consumo de rede) do que antes dele existir.
  - **Independente do player do Display** (não é o mesmo vídeo "espelhado"
    frame a frame): os dois recebem os mesmos comandos (`cmd()` despacha para
    `AVDB.sendCommand` E para a preview) e por isso tocam/pausam/buscam em
    paralelo, mas cada um busca o stream por conta própria — pequenas
    diferenças de buffering entre os dois são esperadas e não indicam
    problema real no Display.
  - **Custo consciente**: dois players do YouTube tocando ao mesmo tempo (um
    no aparelho do Display, outro no celular do operador) dobram o consumo de
    rede/bateria do celular durante toda a sessão — troca deliberada para
    ganhar a preview de verdade; a qualidade "tiny" existe justamente para
    reduzir esse custo o quanto der.
  - `dropYtPreview()` (`player.destroy()` + limpa `#pvYoutube`) roda em
    `stop`/`clear` e ao trocar para outro item (YouTube ou mídia comum) —
    mesmo padrão de "host novo a cada troca" do Display (`ytDrop()`), evita
    que uma mensagem do player anterior seja confundida com a do novo.
  - Comandos `play`/`pause`/`seek` vão para o player real
    (`ytPreviewHandle()`); `mute`/`volume` só valem no modo **"mesa de som"**
    (fora dele a preview é sempre muda, como já era pra mídia local) e seguem a
    MESMA orquestração do `ytHandle` do Display: mutar desce em rampa
    (`ytPreviewRampVolume`) e só então chama `player.mute()`, no fim
    (`ytPreviewMuteApplyTimer`, que reconfere a intenção — um mute/unmute mais
    recente não pode ser desfeito pela aplicação atrasada); desmutar chama
    `unMute()` na hora e sobe em rampa; e um `volume` do operador **cancela a
    rampa em curso**. Sem isso, no modo mesa de som — em que esse é o áudio que
    sai na caixa da igreja — o mudo cortava no talo, e arrastar o fader durante
    a rampa de entrada era desfeito pelos passos restantes (o fader "voltava"
    sozinho). `view` continua indo para `preview.handle()` sempre — é a mesma cortina do wallpaper
    compartilhada com a mídia local, e `stage.js` só pula a revelação
    automática no fim de `load()` para `kind='youtube'` (retorna cedo, só
    marca a thumbnail) — por isso `cmd()` chama
    `preview.instantCover(view === 'wallpaper')` à parte em `loadYtPreview()`,
    igual o Display faz para o player real.
  - **Sincronização do play/pause, progresso e avanço dos itens YouTube: o
    DISPLAY é a fonte de verdade quando presente; a preview é o fallback.** O
    player do Display (a projeção real) manda enquanto envia `display-status`;
    se ele não existir / estiver estrangulado ou fechado (nenhum status há mais
    de `DISPLAY_TIMEOUT`=2,5 s → `ytDisplayActive()` falso), a preview local
    assume. Isso resolve os dois casos opostos:
    - **Controle em 1º plano, Display em 2º** (Display espelhado/estrangulado):
      o status remoto rareia → `ytDisplayActive()` falso → a preview (na tela
      do operador, nunca estrangulada) dirige o ▶/⏸ e o progresso.
    - **Controle minimizado, Display tocando**: a preview é que fica
      estrangulada; o Display segue enviando status → dirige a UI e, via
      `ytResyncPreviewToDisplay()`, **re-alinha a preview** (casa play/pause e,
      se o tempo divergir mais que `SYNC_DRIFT`=1,6 s, busca o instante do
      Display) — sem isso a preview voltava dessincronizada da projeção.
    Mecanismo: `displayStatusAt` marca o último status do item atual
    (`send()` zera para a preview dirigir até o Display confirmar o item novo);
    o player da preview expõe `onStateChange` (▶/⏸ na hora) e um polling de
    500 ms (`ytPreviewTick`) para o progresso — **ambos retornam cedo quando
    `ytDisplayActive()`** (só agem na ausência do Display); o fim natural
    (`ENDED`) dispara `autoAdvance()` só quando a preview é a fonte, senão é o
    `media-ended` remoto que avança. `ytResyncPreviewToDisplay()` não busca em
    "mesa de som" (evita salto audível), só casa play/pause.

**O mesmo princípio vale para mídia comum (áudio/vídeo do `stage.js`), não só
YouTube** — `displayStatusAt`/`DISPLAY_TIMEOUT`/`SYNC_DRIFT` são
compartilhados entre os dois casos (`displayActive()` genérico, sem checar o
`kind`); o que muda é só qual player é re-alinhado: `resyncPreviewToDisplay()`
faz o equivalente de `ytResyncPreviewToDisplay()` pro stage local (`preview`)
— casa play/pause e corrige o tempo via `preview.seek()` se o drift passar de
`SYNC_DRIFT`, também sem buscar em "mesa de som". Isso existe porque o
Display e a preview são **dois decodificadores de áudio/vídeo independentes**
(dois elementos `<audio>`/`<video>` distintos, um em cada app) — mesmo
recebendo o mesmo comando `load` no mesmo instante, cada um tem sua própria
latência de buffering, e o `currentTime` dos dois diverge aos poucos; sem
essa correção periódica, a letra sincronizada (baseada em fronteiras de
tempo) acaba trocando de slide em momentos ligeiramente diferentes no
Display e na preview. `previewTick()` (o `onTime` local do stage da preview)
retorna cedo sempre que `displayActive()` — nesse caso é o handler de
`display-status` em `AVDB.onCommand` que atualiza a UI/letra a partir do
tempo reportado pelo Display (`lastDisplayTime`). `stepSlide()`/
`renderSlideNav()` (navegação manual de estrofe) usam `authoritativeTime()` —
não `preview.getTime()` direto — para calcular o slide atual a partir da
posição "oficial" (a do Display quando ele for a fonte, senão a da própria
preview); sem isso, "estrofe anterior/próxima" calcularia a partir de um
tempo local já desatualizado em relação ao que está de fato no telão.

O **avanço automático de fim de faixa** segue o mesmo princípio: o `onEnded`
do stage da preview também **retorna cedo quando `displayActive()`** — quando
o Display está presente, quem avança é só o `media-ended` remoto (com guarda
de `mediaId`). Sem esse early-return, se o Display chegasse ao fim antes da
preview (drift até `SYNC_DRIFT`), os dois disparariam `autoAdvance()` e uma
faixa seria pulada. É o mesmo padrão de `previewTick`/`ytPreviewTick` aplicado
ao fim natural.

---

## Como esta base é servida

Não há servidor nem service worker neste repositório. Os arquivos são servidos
pelo shell nativo via `WebViewAssetLoader`, em
`https://appassets.androidplatform.net/` (contexto seguro — é o que faz OPFS e
IndexedDB funcionarem), e a atualização chega por **OTA**, não por cache-first.
Ver `CLAUDE.md` (seções "Invariantes do shell" e "OTA da base web").

O que isso substituiu, do tempo dos dois PWAs: um `server.js` em Node puro para
desenvolvimento, dois `sw.js` com cache-first + versão de cache por app, o
auto-reload no `controllerchange` e o POST em `share-target` interceptado pelo
SW (hoje um `intent-filter` — ver "Compartilhamento").

Para abrir a base no navegador durante o desenvolvimento basta qualquer
servidor estático apontado para `app/src/main/assets/web/` (`python3 -m
http.server`, por exemplo). Sem o shell, `window.__NATIVE__` fica indefinido e
todo o caminho nativo vira no-op — que é exatamente a regra de escrita do
projeto.

---

## Design System (padrões visuais / CSS)

Toda a UI segue um conjunto fixo de **tokens** (variáveis CSS em `:root`) — a
fonte única de verdade para cor, superfície, raio e feedback de toque. **Regra:
não usar valor literal solto na folha; sempre referenciar um token.** Isso
existe porque o projeto acumulou muitas alterações estéticas pontuais (cores e
medidas repetidas à mão), que foram consolidadas nestes padrões.

### Onde ficam os tokens

- **`controle/controle.css`** — `:root` completo (o Controle tem toda a UI rica).
- **`display/display.css`** — `:root` **mínimo**, só com os tokens de **marca**
  compartilhados (o Display é só wallpaper + mídia, sem componentes de UI).

> ⚠️ **Não há CSS compartilhado entre os dois apps** (nenhuma folha comum). Os
> tokens de marca abaixo estão **duplicados** nas duas folhas e precisam ser
> mantidos **idênticos manualmente**. Ao mudar um deles, mudar nos dois
> arquivos: `--gold`, `--danger`, `--wallpaper`, `--lyrics-frame-bg`.

### Tokens

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#121212` | fundo do app — cinza real, não quase-preto (ver "Escada de elevação") |
| `--panel` / `--panel-2` | `#2a2a2a` / `#383838` | painéis / item ativo/selecionado |
| `--bar` | `#232323` | appbar / bottombar / trilho de abas |
| `--line` | `#454545` | **todas** as bordas/separadores (1,95:1 contra o fundo — antes 1,19:1, invisível) |
| `--surface` | `rgba(255,255,255,.12)` | fundo padrão de botão/controle |
| `--surface-2` | `rgba(255,255,255,.18)` | chip/campo/badge levemente mais claro |
| `--text` / `--muted` | `#f2f2f2` / `#a3a3a3` | texto / texto secundário (o `#777` anterior dava 3,94:1 — reprovado em AA) |
| `--accent` | `#58a6ff` | **marca primária** (azul) como **texto, ícone e borda** sobre fundo escuro (7,4:1) |
| `--accent-fill` | `#1f6feb` | o mesmo azul como **fundo de elemento com texto branco** (4,6:1). Ver "Um azul não serve aos dois papéis" |
| `--accent-soft` | `rgba(88,166,255,.18)` | fundo suave de estado ativo (accent) |
| `--gold` 🔁 | `#fbc02d` | **marca secundária** (dourado "IASD"): logo, capa da letra, pill "Ligar Sistema" |
| `--gold-soft` | `rgba(251,192,45,.18)` | fundo do estado "áudio bloqueado" (âmbar) |
| `--gold-text` | `#ffe082` | texto do estado "áudio bloqueado" |
| `--danger` 🔁 | `#e53935` | perigo (excluir, mudo, view bloqueada) — e, no Display, o timer estourado |
| `--danger-soft` | `rgba(229,57,53,.22)` | fundo suave de perigo |
| `--danger-text` | `#ffcdd2` | texto sobre fundo de perigo |
| `--success` | `#66bb6a` | sucesso / "check do sistema" (cartão do Hinário completo offline) |
| `--success-soft` | `rgba(102,187,106,.18)` | fundo suave de sucesso |
| `--radius-btn` | `8px` | raio de **botões/controles** (unifica os antigos 7/8/9px) |
| `--radius-card` | `10px` | raio de **cartões/painéis** (preview, itens de lista, popups internos, folhas) |
| `--radius-pill` | `999px` | badges, chips, pills |
| `--wallpaper` 🔁 | `radial-gradient(circle at 50% 35%, #14331f 0%, #0a1a10 55%, #050b07 100%)` | cortina do wallpaper (Display + preview) |
| `--lyrics-frame-bg` 🔁 | `rgba(0,0,0,.62)` | fundo da faixa da letra (modo imagem). **Sem borda** desde a v5.42: o contorno branco desenhava um retângulo que competia com a letra, e quem separa o texto da foto é a faixa. Densidade escolhida pelo PIOR caso — uma foto branca: `.40` deixava o fundo em ~#999 (2,4:1 com o texto branco, reprovado); `.62` põe em ~#616161, **6,2:1** |
| `--fader-cap` | `26px` | espessura do cap do fader — **dois** faders a usam (mixer e barra do modo simplificado), e a posição do número sai dela |
| `--press` | `scale(.96)` | **feedback de toque padrão**: todo `:active` usa `transform: var(--press)` |

🔁 = token de marca, duplicado em `display.css` — manter em sync.

### Métodos/convenções visuais padronizados

- **Feedback de toque:** todo elemento interativo usa
  `:active { transform: var(--press); }` (antes havia `scale(.95/.96/.97/.98)`
  misturados — unificados em `.96`). A regra é **UMA SÓ**, um `:is(...)` com a
  lista de seletores logo depois do bloco `:root`. Antes ela estava repetida em
  17 lugares e, ainda assim, nove controles ficavam de fora (voltar, abas,
  seleção múltipla, botões de linha, fechar popup, escolher pasta,
  preenchimento, linha de música…): como o `*` zera o tap-highlight, esses
  ficavam **totalmente mudos ao toque** no aparelho. Com a lista única, um botão
  novo entra acrescentando um nome — não copiando uma regra.
- **Tamanho de ícone:** três degraus, e só eles — `--icon-sm` (20px, botões de
  linha/cabeçalho/popup), `--icon-md` (22px, abas e transporte) e `--icon-lg`
  (24px, miniatura-ícone e dicas de deslize). Antes havia oito tamanhos
  (19…27px), cinco deles usados uma única vez.
- **Alvo de toque:** botão de ícone é **34px** ou mais (`.row-btn`,
  `.popup-close`, `.back-btn`, `.add-dir-btn`), `.sel-btn` 36, `.hymnal-card-btn`
  38, `.tab` 42. Nada abaixo disso — o `.back-btn` já teve 20×20 px sendo a
  única saída da tela de Favoritos e da navegação da Bíblia.
- **Receita repetida vira seletor agrupado, não cópia:** os estados de cor são
  declarados por ESTADO (`.view-blocked`/`.muted`/`.danger` num bloco,
  `.active` noutro), a coluna "nome + subtítulo" das linhas de lista é uma regra
  para `.coll-bar-info, .bible-ver-main, .hymn-info`, e `.slide-nav-btn` divide
  a receita de `.t-btn` em vez de reescrevê-la.
- **Ordem importa quando a especificidade empata:** `.pv-text { z-index: 2 }`
  precisa vir DEPOIS de `.pv-layer { z-index: 1 }` (o elemento tem as duas
  classes). Já esteve antes, e o cartão de texto só ficava acima do iframe do
  YouTube por acaso, pela ordem no DOM.
- **Realce de toque:** `-webkit-tap-highlight-color: transparent` e
  `user-select: none` ficam **só no seletor `*`** (topo da folha) — **não
  repetir** por elemento (era redundante em ~12 regras, removido).
- **Exceção de seleção de texto:** só `input, textarea` no Controle (o campo de
  busca precisa ser editável) — ver "Regras de desenvolvimento".
- **Cantos:** botões/controles = `--radius-btn`; contêineres = `--radius-card`;
  pills/badges = `--radius-pill`. Casos especiais fora do sistema (intencionais):
  `border-radius:0` da faixa da letra ("vídeo de louvor", cantos retos), `50%`
  do thumb do fader, `18px 18px 0 0` das bottom-sheets, `4px` do `.url-badge`.
- **Cores fora do sistema (intencionais):** `#fff` puro em texto de botão, `#000`
  em fundos de mídia/preview e o `box-shadow` dourado do `.start-pill`
  (`rgba(251,192,45,.35)`, alfa próprio) — são one-offs deliberados, não
  candidatos a token.

### O ícone mostra a AÇÃO; a cor mostra o ESTADO

Regra única para todo botão de alternância, na tela **e** na notificação do
app nativo: **o ícone é o que o toque vai fazer**, nunca o que está valendo
agora. Quem sinaliza o estado é a **cor/borda** (`.view-blocked`, `.muted`,
`.blocked`, `.active`, `.live`) — e só ela.

As duas convenções conviviam misturadas: o ▶/⏸ e o botão de mensagem já eram
ação, enquanto cortina e mudo eram estado. O mesmo gesto — olhar o ícone —
significava coisas opostas conforme o botão, e o operador precisava lembrar
qual era qual no meio de um culto.

| Estado | Ícone (a ação) | Cor |
|---|---|---|
| mídia no ar | imagem riscada — *cobrir* | neutra |
| telão coberto | imagem — *mostrar* | vermelha (`.view-blocked`) |
| som ligado | alto-falante mudo — *mutar* | neutra |
| mudo | alto-falante — *tirar o mudo* | vermelha (`.muted`) |
| áudio bloqueado | alto-falante — *liberar* | âmbar pulsante (`.blocked`) |

Num par binário nada se perde: se o ícone é a ação, o estado é o inverso dele
e a cor confirma.

**A exceção é o `repeat`** (`renderRepeat`), e ela é de forma, não de gosto: o
botão CICLA por quatro modos (off → all → one → shuffle). Num ciclo o glifo só
cabe um, e mostrar o próximo apagaria da tela qual está valendo — a cor
distingue ligado de desligado, não qual dos três. Ali o ícone segue sendo o
modo atual, que é a informação que se perderia.

Botões de **função** (fone da mesa de som, folha da leitura auxiliar) e
**segmentados** (preenchimento, imagens dos slides, wallpaper) ficam fora da
regra por natureza: não alternam duas ações opostas — o ícone nomeia o recurso,
e o `.active` / o segmento marcado dizem o resto.

### Escada de elevação, e por que ela foi refeita (v5.34)

O que separa duas camadas não é a cor de cada uma, é o **degrau** entre elas. A
escala até a v5.33 era quase plana e, num celular fora de quarto escuro, botão
e fundo viravam a mesma mancha preta. Medido na tela renderizada, com composição
alfa real (quase todo controle usa `--surface`, que é branco a 6% e só existe
em relação ao que está atrás):

| Par | Antes | Depois |
|---|---|---|
| trilho de abas × aba inativa | 1,15:1 | **1,46:1** |
| fundo × botão de transporte | 1,15:1 | **1,46:1** |
| painel × campo/chip | — | **1,72:1** |
| painel × barra do microfone | 1,09:1 | **1,31:1** |
| borda/separador × fundo | 1,19:1 | **1,95:1** |
| texto secundário (`--muted`) | 3,94:1 ❌ | **7,43:1** |
| branco sobre aba ativa | 3,75:1 ❌ | **4,63:1** |

A correção foi pelos **dois lados**: o fundo subiu para um cinza real e os
elementos da frente subiram mais, para o degrau crescer em vez de só deslocar.

- **Piso adotado: 1,25:1 entre superfícies**, 4,5:1 para texto (mínimo AA) e
  1,7:1 para bordas. Há teste medindo isso na tela renderizada — mudar um token
  para baixo desses valores falha.
- **`--surface`/`--surface-2` continuam sendo branco com alfa** de propósito:
  assim um botão mantém o mesmo degrau relativo esteja ele sobre o fundo, sobre
  a barra ou dentro de um cartão. Três valores fixos divergiriam no primeiro
  ajuste.
- **O trilho de abas é separado do fundo pela BORDA**, não pelo tom (1,12:1
  entre eles). É de propósito: uma barra clara demais competiria com os botões
  que ela contém, que são o que precisa saltar.

### Um azul não serve aos dois papéis

`--accent` era um valor único usado como **cor de texto** e como **fundo com
texto branco**. Isso é uma contradição aritmética, não uma questão de gosto:
para ser legível como texto sobre fundo escuro o azul precisa ser claro; para
receber branco por cima precisa ser escuro. O valor antigo (`#2f81f7`) dava
**3,75:1** de branco sobre a aba ativa — reprovado em AA — e, depois que o fundo
subiu, caía para **2,66:1** como cor de texto, que é pior ainda.

Daí os dois tokens. A regra para escolher é o **papel**, não a aparência:

- fundo de elemento **com texto branco** → `--accent-fill`
- texto, ícone ou borda **sobre fundo escuro** → `--accent`
- elemento **decorativo** sem texto por cima (barra de progresso, linha de
  arraste, trilho de scroll) → `--accent`, que é o que os destaca

### Ao adicionar/alterar estilo

1. Existe token pro valor? Use-o. Não existe e o valor se repete? **Crie um token**.
2. Cor/medida de marca nova → adicionar **nos dois** `:root` (Controle + Display) e marcar 🔁 nesta tabela.
3. Botão novo → acrescentar o seletor à lista `:is(...)` do feedback de toque; nada de tap-highlight nem de `:active` próprio.
3b. Fundo em accent? Escolha o token pelo PAPEL (ver acima): `--accent-fill`
   se houver texto branco por cima, `--accent` se for texto/ícone/borda ou
   decoração. E respeite os pisos de contraste (1,25:1 superfícies, 4,5:1
   texto, 1,7:1 bordas).
4. Botão que alterna → ícone = ação, cor = estado (ver acima).
5. Atualizar esta tabela e bumpar a versão visual + caches dos SW.

---

## Fonte de ícones (Material Symbols)

Versão subconjuntada (~3.2 KB woff2): peso 400, 30 glifos no subset (26
efetivamente usados na UI — referenciados por codepoint via o mapa `ICON` em
`controle.js` **ou** direto como entidade HTML `&#x…;` no `controle/index.html`).
**Só o Controle carrega a fonte** — o Display é só wallpaper + mídia, sem
nenhum glifo (por isso `display/index.html` não inclui
`material-symbols.css`/`.woff2`).

**Codepoints no subset:**
```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E14C E150 E251 E2C7 E2C8 E2CC E3A1 E3AD
E413 E5C4 E5CF E838 E86C E872 E8F5 E945 EB80 F116
```

`E838` (star) **voltou a ter uso**: é o ícone dos atalhos de **Favoritos**
(`ICON.star`, ver "Favoritos"). `E5CF` (expand_more), `E8F5` (visibility_off) e
`E86C` (check_circle — antigo ícone de seleção múltipla, agora só highlight
azul) continuam no woff2 sem referência (glifos reservados) — podem sair num
próximo re-subset.

Para adicionar ícone: obter codepoint em `fonts.google.com/icons?icon.style=Rounded`
e gerar novo subset com `fontTools`.

**Ícones fora do subset → SVG inline.** Quando um ícone necessário não está no
subset e re-gerar o woff2 não vale a pena (ou o ambiente não tem `fontTools`),
usa-se um `<svg>` inline direto no HTML, com `fill/stroke: currentColor` (herda
a cor do botão). Hoje: o botão de **volume** do mixer (`#volToggle`, ícone de
faders/mixer), a **lupa** da busca do acervo (`#hymnSearchBtn`), a antena de
**Wi-Fi** dos cards de coleção (`wifiIconEl`), o **fone de ouvido** da mesa de
som (`#standaloneToggle`), a **folha com linhas** da leitura auxiliar
(`#lyricsViewBtn`, que substituiu a flor do antigo botão de fundo da letra), o
ícone **"arquivos+"** (documento com `+`) do botão de importar no fim do
Cronograma (`.import-btn`), que diferencia importar ARQUIVOS de abrir os
FAVORITOS (estrela, no botão ao lado — e a mesma estrela no "Novo atalho"),
os três botões flutuantes da preview (**engrenagem**, **cast** e
**expandir** — `#pvSettingsBtn`/`#pvCastBtn`/`#pvFullBtn`),
e nos **cards de coleção** as **setas circulares** de sincronizar
(`syncIconSvg`), o **check** verde de "completo offline" (`checkIconSvg`) e o
ícone de **lista** do botão "Ver músicas" (`listIconSvg`) e a **engrenagem** de
opções da coleção (`gearIconSvg`); e nos
resultados da busca os botões de tocar **voz/microfone** (Cantado, `voiceIconSvg`)
e **nota musical** (Playback, `noteIconSvg`); e o **livro com uma cruz** da aba
**Bíblia** (`.tab[data-tab="bible"]`).

> **Borda nativa dos `<button>`**: `.tab-add`, `.pv-fab` (e os botões do cartão do Hinário)
> zeram `border`/`appearance` explicitamente — sem isso, um `<button>` (ex.:
> `#hymnSearchBtn`) herda a **borda 3D bicolor (bevel)** do sistema, fora do
> padrão do app. O mesmo motivo do `appearance:none` no `.lib-search`
> (`type="search"`).

---

## Build, distribuição e instalação

Tudo isso vive no shell, não aqui: o APK é gerado e assinado pelo CI
(`.github/workflows/apk.yml`) e a base web é publicada como bundle OTA na
release de tag fixa `web-latest`. Ver `CLAUDE.md`, seções "OTA da base web" e
"Build e distribuição".

Do modelo antigo saíram: o deploy do `public/` no GitHub Pages, a instalação
dos dois PWAs pelo Chrome ("Adicionar à tela inicial"), os `manifest.json` com
`scope`/`orientation`/`share_target`, os ícones PNG/maskable exigidos pelo
gerador de WebAPK e o espelhamento do Display via Miracast de app isolado —
substituído pela `Presentation`, que manda só o Display para a TV.
