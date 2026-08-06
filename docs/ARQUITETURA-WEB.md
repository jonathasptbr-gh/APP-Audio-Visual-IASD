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
5. [Documento em cena](#documento-em-cena-pdf-powerpoint-google-apresentações) — PDF, PowerPoint e Google Apresentações viram páginas
6. [Modelo de dados (`shared/db.js`)](#modelo-de-dados-shareddbjs) — IDB, OPFS, BroadcastChannel
7. [Motor de renderização (`shared/stage.js`)](#motor-de-renderização-sharedstagejs) — cortina, fades, concorrência
8. [Controle](#controle) — layout, mixer, biblioteca, coleções (LouvorJA), letra sincronizada
9. [Camada de Texto](#camada-de-texto-bíblia--mensagens--letra) — Bíblia, Mensagens, letra avulsa, cronômetro, sorteio, letra sincronizada
10. [Bíblia](#bíblia-aba-bible) — seleção, leitura e projeção
11. [Display](#display) — wallpaper, YouTube, microfone, recuperação de áudio
12. [Design System](#design-system--a-paleta-sala-escura-âmbar) — a paleta "Sala Escura", tokens, contraste
13. [Fonte de ícones (Material Symbols)](#fonte-de-ícones-material-symbols)
14. [Build, distribuição e instalação](#build-distribuição-e-instalação) — e como esta base é SERVIDA (asset loader + OTA)

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
- **Mídia PARADA não tem pulso — teste com ela.** Boa parte da UI do Controle é
  reposta de graça pelo `timeupdate` da preview, que só existe em áudio e vídeo.
  Uma imagem (e uma apresentação, que é imagem) não dispara nada: ali, um estado
  que alguém esqueceu de redesenhar fica **permanente**, enquanto no áudio ele se
  conserta sozinho no quadro seguinte e passa despercebido. Foi assim o defeito
  da v5.101 (ver "Documento em cena"). Ao mexer em qualquer render de cena,
  repita o teste com uma imagem em cena, não só com uma música.
- Não introduzir dependências externas — JavaScript puro no cliente, Kotlin puro
  + AndroidX oficial no shell. **Duas exceções deste lado, e as duas carregam sob
  demanda:**
  - a **IFrame Player API do YouTube** (`<script src="https://www.youtube.com/iframe_api">`,
    em runtime, no Display **e** no Controle) — não é dependência de build/npm, e
    o recurso YouTube já depende de rede/youtube.com para tocar o vídeo mesmo sem
    ela. O Controle a usa na preview — ver a seção do YouTube;
  - o **renderizador de `.pptx`** (`vendor/pptx-renderer.js`, Apache-2.0, por
    `import()` dinâmico) — existe porque o Android **não desenha PowerPoint** e
    as alternativas eram todas piores: bibliotecas nativas comerciais, um
    servidor de conversão (que manda o material do culto para fora do aparelho)
    ou escrever DrawingML à mão (que produz um slide PARECIDO com o que o pastor
    montou). O levantamento inteiro está no `LEIA-ME.md` daquela pasta.

  Uma terceira exceção precisa do mesmo tipo de justificativa: um problema que
  não se resolve de outro jeito, e a conta da manutenção paga por quem publica
  a biblioteca.
- Ao atualizar o código, atualizar este documento se a mudança afetar arquitetura, protocolo de comandos ou API pública. Mudanças no shell (Kotlin) vão em `../CLAUDE.md`.
- **Todo código novo precisa continuar rodando no navegador.** Caminhos
  específicos do nativo entram sempre como `if (!window.__NATIVE__) { …web… }`
  — nunca o inverso: o comportamento de navegador é o padrão, e o nativo é a
  exceção que se declara. Os pontos onde os dois divergem (autoplay, pastas do
  dispositivo, compartilhamento, fullscreen, atualização) estão tabelados em
  `../CLAUDE.md`, "Divergências entre o caminho web e o nativo".
- **A cada atualização de código, incrementar a versão visual do Controle** em
  **três lugares que precisam bater**:
  1. `version` em `assets/web/version.json` — **a fonte da verdade**. É este
     valor que o `WebUpdater` compara e que dispara (ou não) a atualização por
     OTA nos aparelhos.
  2. a constante `WEB_VERSION` em `controle/controle.js` — é ela que o rodapé
     de Configurações renderiza (`renderVersionLabel()`). Esquecê-la é o erro mais
     traiçoeiro dos três: o OTA entrega o bundle novo e o aparelho continua
     **exibindo a versão antiga**, que é exatamente a leitura que o indicador
     existe para dar.
  3. o fallback estático do `<span id="appVersion">` em `controle/index.html`
     — o que aparece antes de o JS rodar.

  Versionamento incremental simples (5.46, 5.47, 5.48…). **Este documento não
  registra a versão corrente**: um número fixo aqui é a 19ª cópia a
  desatualizar, e quem partisse dela escreveria em `version.json` um valor
  MENOR que o já publicado — caso em que `WebUpdater.compareVersions` ignora o
  bundle em silêncio. Para saber onde a base está, leia `version.json`.

  No app nativo o rótulo mostra os **dois índices** — `Web v5.86 · Shell v1.31`
  —, porque base web e shell atualizam por caminhos independentes (OTA ×
  instalar APK); no navegador sai só `Controle v<versão>`. **Ele mora no rodapé
  do popup de Configurações** desde a v5.49 (antes ficava no cabeçalho da lista,
  visível só na aba Cronograma): versão é metadado de diagnóstico, e o lugar
  onde se procura diagnóstico é junto do estado do telão e do alvo de
  espelhamento.

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
│   ├── tokens.css              # A PALETA — fonte única, carregada pelos DOIS apps
│   ├── native.js               # ponte AVNative (só existe no app; no-op no navegador)
│   ├── db.js                   # Camada comum: IndexedDB + OPFS + BroadcastChannel (+ relay nativo)
│   ├── stage.js                # Motor de renderização compartilhado
│   ├── material-symbols.css    # Font-face da fonte de ícones (subset offline; só o Controle usa)
│   └── fonts/
│       └── material-symbols.woff2  # ~2.2 KB — 30 glifos, todos em uso
├── vendor/                     # ÚNICO código de terceiro daqui — carregado sob demanda
│   ├── pptx-renderer.js        # desenha .pptx (Apache-2.0); ver o LEIA-ME da pasta
│   ├── LICENSE-pptx-renderer.txt
│   └── LEIA-ME.md              # por que a exceção existe, e como atualizar
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
por OTA (ver "Build, distribuição e instalação", no fim, e o `CLAUDE.md`).

`vendor/` é a única pasta aqui que não é código do projeto, e **nada fora do
caminho do `.pptx` a carrega**: ela entra por `import()` dinâmico, na hora em
que alguém importa uma apresentação. Um arquivo buildado de 1,5 MB no boot
custaria isso a todo culto, e a todo aparelho, para um recurso que a maioria
dos cultos não usa.

---

## Documento em cena: PDF, PowerPoint, Google Apresentações

O que o operador tem na mão é um PDF, um PowerPoint ou um Google
Apresentações. O que o app guarda é **uma imagem por página** — e é essa
tradução que torna o recurso pequeno: a partir dela a apresentação é mídia
comum, com o fade, a cortina, o telão e a `MediaSession` que já existem há
dezenas de versões.

**Não é um recurso de "apresentação", é um TIPO DE ARQUIVO a mais.** Não há
botão próprio, nem aba, nem fluxo separado (a v5.98 teve um, e ele saiu na
v5.99): o operador escolhe o ARQUIVO, e o app decide o que fazer com ele. Um
PDF comum — um roteiro, uma partitura, um comunicado — entra do mesmo jeito
que um de apresentação, porque para o app não há diferença entre os dois.

**Cada formato pelo caminho que existe para ele:**

- **PDF → o shell.** O Android traz um renderizador de PDF **na plataforma**
  (`PdfRenderer`, API 21+): fidelidade total e zero dependência. Ver
  `SlideDeck.kt`. É também o caminho do **Google Apresentações**, que tem uma
  URL de exportação em PDF (`/presentation/d/<id>/export/pdf`) — o shell a monta
  a partir do link e baixa, sem o operador exportar nada. Precisa estar
  compartilhada por link, que é como um roteiro de culto circula.
- **`.pptx` → o próprio WebView.** Aqui o Android não ajuda: não existe na
  plataforma quem desenhe OOXML. O renderizador é a única dependência do lado
  web (`assets/web/vendor/pptx-renderer.js`, Apache-2.0 — o levantamento que
  justifica a exceção está no `LEIA-ME.md` daquela pasta), e ele entra por
  `import()` **dinâmico**: é 1,5 MB que só interessa a quem importar um `.pptx`,
  e carregá-lo no boot custaria isso a todo culto.
- **`.ppt` (anterior a 2007) e `.odp` ficam de fora**, no `accept` do seletor e
  nos `intent-filter`: ninguém sabe desenhá-los, e aceitar para depois falhar é
  pior do que não aceitar.

**O `.pptx` produz DOM; o app projeta IMAGEM.** A ponte entre os dois é
`elementoParaPng`, sem biblioteca nenhuma: o slide vai para dentro de um
`<foreignObject>` de SVG, que o navegador desenha como imagem, e daí para um
canvas. Dois detalhes que não são opcionais:

- **As `<img>` do slide são `blob:`, e uma URL blob NÃO carrega dentro do
  `foreignObject`** (o SVG é um documento à parte). Cada uma é redesenhada num
  canvas e vira `data:` antes da serialização — sem esse passo a foto do slide
  simplesmente não aparece, e o defeito é silencioso.
- **Fundo branco antes de desenhar**, como no lado nativo: o slide pode não
  pintar o próprio papel, e transparente, no telão, é o preto do palco — o texto
  escuro sumiria.

O palco de renderização fica `position:fixed; left:-99999px`, e não
`display:none`: sem layout não há o que rasterizar.

**As portas de entrada são as mesmas de qualquer arquivo:**

- **"Importar arquivos"**, no rodapé fixo do Cronograma. No app (shell ≥ 21) esse botão
  abre o seletor do SISTEMA (`AVNative.pickDoc`, com a lista de mimes), e não o
  `<input type="file">`: aquele devolve um `File` — bytes já lidos —, e quem
  desenha o PDF é o shell, que precisa do ARQUIVO; devolver os bytes pela ponte
  inverteria o princípio dela ("URLs servíveis, nunca bytes") e faria um vídeo
  de 2 GB passar pela memória do WebView. O seletor do sistema entrega
  `content://` para TUDO — a mesma porta por onde as pastas do dispositivo já
  entram —, então a importação inteira passou a ser uma coisa só. No navegador
  (e num shell antigo) continua o `<input type="file">` de sempre, com o `.pptx`
  no `accept`; ali o PDF é o único que não tem como funcionar.
- **Compartilhar** um PDF, um `.pptx` ou o link do Google com o app.
- **Um arquivo ilegível avisa** (PDF com senha, `.pptx` corrompido): diálogo, e
  não um aviso que some sozinho — o operador acabou de escolher um arquivo, e
  silêncio ali leria como "importou". É o uso do diálogo em modo AVISO
  (`cancelText: null` esconde o botão de cancelar: ele não pergunta nada), e o
  texto é um só (`avisarNaoAbriu`) para as duas portas de entrada.
- **E o aviso diz POR QUE** (v5.100), num parêntese no fim: `deckUltimoErro`
  carrega o motivo do ponto que falhou até o diálogo — inclusive o do lado
  Kotlin, já que `deckPages` passou a devolver `{ erro }` em vez de `null`.
  Sem isso, todo defeito deste caminho chegava como a mesma frase, e a primeira
  causa real (o ramo de `https` que engolia o `/saf/`, ver o CLAUDE.md)
  sobreviveu a duas versões parecendo "PDF com senha". Este código roda no
  aparelho do operador, num domingo de manhã, e quem desenvolve não tem o
  aparelho na mão: o diagnóstico precisa caber na tela.

**O registro** é `kind: 'deck'` com `pages: [Blob]` — as páginas ficam DENTRO
do próprio registro de mídia, não em arquivos soltos no OPFS, para que o gc que
já existe as leve junto quando o item sai da última lista. Páginas no OPFS
pediriam uma faxina paralela, que é o tipo de bookkeeping duplicado que vaza
espaço em silêncio. O IndexedDB guarda Blob por referência: ler o registro não
traz os bytes de dezenas de páginas para a memória.

**O nome e o eixo dos botões descrevem a MESMA cena** — e por isso andam
juntos (v5.101). Tudo o que muda a resposta de `slideTarget()` precisa chamar
`renderSlideNav()`, não só `renderNowPlaying()`. O nome tem muito mais caminhos
de atualização que o eixo, então a divergência aparece sempre igual: cabeçalho
certo, botões errados. Foi o defeito da v5.100 — projetar o **cronômetro** ou o
**sorteio** sobre uma apresentação derruba o alvo para `null`, e ao tirá-los o
nome voltava a dizer "1/9" com ⏮/⏭ apagados. Numa mídia com tempo o pulso de
`timeupdate` repunha os limites sozinho e o defeito passava despercebido; **um
deck é imagem parada**, então nada mais rodava e ele ficava permanente. Só uma
importação consertava, por acidente: ela termina em `load()`, que chama
`renderSlideNav()`.

**A navegação é o par ⏮/⏭ que já passa estrofe** (`slideTarget()` devolve
`'deck'`): cada toque passa uma página, e os botões desabilitam nos extremos
como em qualquer outro alvo de slide. O comando é um `page` próprio, e não um
`load` novo — recarregar a mídia para trocar uma imagem que já está na mão
faria o telão piscar preto a cada slide. A `MediaSession` acompanha: o rótulo
dos botões diz "(página)" em vez de "(estrofe)" quando é uma apresentação que
está no ar (`slideLabel`).

> **O `slideLabel` só chegou de fato à notificação na v5.102.** Ele nasceu na
> v5.97 no `pushNowPlaying` e o `SessionService` já o lia desde então — mas
> `shared/native.js` monta o objeto da ponte **campo a campo**, e este ficou de
> fora: a notificação escreveu "(estrofe)" durante toda a rodada das
> apresentações, sem erro em lugar nenhum. É a forma de falhar típica dessa
> função — um campo esquecido ali some em silêncio, e o lado nativo lê o
> `optString` vazio como "use o padrão". Ao acrescentar um campo em
> `pushNowPlaying`, acrescente-o também em `AVNative.nowPlaying`.
>
> Na mesma versão a palavra passou a sair da tabela `SLIDE_AXIS_NAME` — a
> mesma que nomeia os botões da tela —, em vez de um ternário local que
> respondia "estrofe" para versículo e para mensagem.

**A reconexão do telão volta na página certa**, pelo mesmo motivo do tempo de
uma mídia: um dongle que cai no meio da pregação não pode devolver o primeiro
slide na frente de todo mundo — o `load` do reenvio leva o `page`.

## Modelo de dados (`shared/db.js`)

### IndexedDB — banco `av-iasd` v3

| Object Store | Chave | Conteúdo |
|---|---|---|
| `media` | `id` (UUID), índice `youtubeId` | `{ id, blob, url, thumb, type, kind, name, youtubeId, pages, cue, data, createdAt }` |
| `files` | `id` (UUID), índice `folder` | catálogo OPFS: `{ id, folder, opfsPath, srcName, name, type, kind, size, mtime, thumb, addedAt }` |
| `state` | chave string | valor arbitrário (listas, estado atual, pastas dos Favoritos, transições…) |

Um registro de mídia tem **`blob`, `url`, `opfsPath` OU `pages`** (nunca mais
de um): blobs locais importados, itens de URL externa (link direto, YouTube),
arquivos sincronizados no OPFS ou as páginas de uma apresentação. `thumb` pode
ser um `Blob` (miniatura gerada via Canvas) ou uma **string URL** (ex:
thumbnail `hqdefault.jpg` do YouTube).

**E há um quinto caso, que não tem bytes nenhum: `kind: 'cue'`** — a cena de
roteiro (v5.103). Ver "Cenas de roteiro", logo abaixo do modelo de listas.

**A conexão é memorizada; a FALHA não.** `openDB()` guarda a promise da
conexão, mas zera esse cache no caminho de erro. Até a v5.47 a promise
**rejeitada** também ficava memorizada: uma única falha do `indexedDB.open`
(pressão de armazenamento, renderer se recuperando de um OOM) deixava o `AVDB`
inteiro rejeitando para sempre, e o app ficava sem dados até ser fechado e
reaberto — sem nenhum caminho de recuperação. Zerando o cache, a chamada
seguinte simplesmente tenta de novo. O `forget()` confere se o cache ainda é
*esta* promise antes de anulá-lo, senão um `openDB` posterior abriria uma
terceira conexão à toa.

**Os três eventos de ciclo de vida que faltavam**, e todos os três se resumem
a "não deixar o chamador pendurado":

- `db.onversionchange` — a **outra página** (Controle × Display, mesmo origin)
  pediu um upgrade. Sem fechar a conexão daqui, ela bloqueia o upgrade de lá e
  aquela página fica esperando para sempre, com a tela montada e sem dado
  nenhum. Hoje o caso não chega a acontecer no app (o `beginSession` do shell
  fixa um único bundle por sessão, logo um único `DB_VERSION`) — mas o dia em
  que `DB_VERSION` subir de 2 para 3 é exatamente o dia em que ninguém vai
  lembrar disto.
- `req.onblocked` — a ponta oposta: se ALGUÉM não fechar a conexão velha, este
  é o único aviso que existe. Sem ele o `open` não resolve **nem** rejeita.
- `db.onclose` — o navegador pode fechar a conexão por fora numa falha de
  armazenamento; o handle memorizado está morto e precisa ser reaberto.

> **Atenção:** qualquer código que abra o banco fora de `db.js` deve usar
> `indexedDB.open('av-iasd')` **sem número de versão**, para não quebrar com
> `VersionError` quando o schema for atualizado — e precisa de um
> `onupgradeneeded` que crie ao menos o store `state`, senão numa instalação
> nova o banco nasceria sem nenhum object store e o `transaction('state')`
> lançaria `NotFoundError`. Hoje **não há** nenhum abridor externo (o service
> worker que gravava o share sumiu junto com os andaimes de PWA — ver
> "Compartilhamento"); a regra fica registrada porque o `if (!contains(...))`
> do upgrade 1→2 existe por causa dela.

### OPFS + catálogo (`files`)

Os **bytes** dos arquivos de pastas sincronizadas moram no **OPFS**
(`navigator.storage.getDirectory()`), em `folders/<folderId>/<arquivo>`. O
store `files` do IDB guarda apenas **metadados + thumbnail** — por isso listar
e buscar centenas de arquivos é instantâneo (nunca toca o disco); o arquivo só
é aberto na hora de reproduzir (`opfsGetFile` → `URL.createObjectURL`).

- OPFS pertence ao origin: **nenhuma permissão é pedida** para ler — nem no
  Controle, nem no Display (mesmo origin ⇒ mesmo OPFS).
- `getMedia(id)` procura em `media` e cai para `files` — assim IDs do catálogo
  entram em `playlist`/`imports`/pastas dos Favoritos **sem copiar bytes**.
- O `gc()` das listas só apaga do store `media`; registros de `files`
  pertencem à sua pasta OPFS e só são removidos pela exclusão na pasta.
- `renameMedia` cobre os dois stores (no catálogo, renomeia só a exibição;
  o `opfsPath` não muda).

**Três listas nomeadas** (arrays de IDs guardados em `state`): `imports`,
`playlist` e `avulsos`. Migração: `imports` herda o antigo state `order` se
`imports` ainda não existir. (A antiga lista `favorites` foi removida — ver
legado nas chaves de `state`.)

**`avulsos` (v5.87) é a única que o operador não vê.** Ela existe porque
"Tocar agora" num resultado do YouTube não tem nada a ver com o Cronograma —
o vídeo só precisa ir ao telão —, mas um registro em lista NENHUMA é
vazamento permanente: o gc só alcança o que alguma lista já segurou (ver a
nota das funções removidas na v5.48). `avulsos` é o detentor dessa mídia, e é uma
prateleira PEQUENA e de tamanho fixo (`AVULSO_MAX` = 3, no Controle): quem
entra empurra o mais ANTIGO para fora, e aí o `listRemove` decide sozinho — o
blob some se ninguém mais o quiser e fica inteiro se o Cronograma, a playlist
ou um Favorito também o tiverem.

O tamanho é a escolha entre dois extremos ruins. Com **um** lugar, voltar ao
vídeo anterior baixa tudo de novo — exatamente o desperdício que a v5.87
existe para acabar. **Sem limite**, a mídia que a tela não mostra vira uma
pilha de centenas de MB que o operador não tem como apagar (não existe tela de
liberar espaço; o rodapé de uso é só informativo). Três cobre o uso real —
alternar entre dois ou três vídeos num mesmo culto. O que ele quiser guardar,
guarda pelas outras duas opções da mesma folha.

**Subir o `DB_VERSION` tem um preço, e ele não é o upgrade — é a VOLTA.**
`open` com uma versão MENOR do que a do banco lança `VersionError`, e a base
web ANTERIOR é exatamente para onde o watchdog do OTA volta quando um bundle
não confirma (e é a que o APK instalado embute até a Release seguinte). Um
bundle que sobe o `DB_VERSION`, é servido uma vez e depois é descartado deixa a
base antiga sem conseguir ABRIR o banco: um lançamento inteiro sem playlist,
sem Cronograma e sem biblioteca. O caso se cura sozinho — o `check()` seguinte
rebaixa o bundle de novo —, mas o lançamento estragado é real, e num domingo
ele é o culto. Por isso a regra: só subir junto com uma Release, e só quando o
ganho não couber numa chave de `state`, que é onde uma estrutura auxiliar deve
morar.

**O índice `youtubeId` (v5.87)** responde "este vídeo já está no aparelho?"
sem desserializar blob nenhum (`getAllKeys` no índice). Registros com
`youtubeId: null` ficam de fora dele — `null` não é chave IDB válida —, então
o índice contém exatamente os vídeos vindos do YouTube. É ele que faz o
`ytArquivo` do Controle reaproveitar o arquivo em vez de baixar o mesmo vídeo
uma vez por destino escolhido.

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
| `favs` | array de IDs — **os FAVORITOS** (v5.103): a marcação de um toque, sem grupo nenhum. É uma das `LISTS` de `db.js`, e é isso que a torna um detentor de referência de verdade (favoritar segura o blob; desfavoritar deixa o gc decidir) |
| `folders` | `[{ id, name }]` — **pastas**: a organização OPCIONAL dentro dos Favoritos (as antigas "pastas virtuais"; até a v5.111 a UI as chamava de "atalhos") |
| `folder_<id>` | array de IDs de mídia da pasta. **É um detentor de referência**, como as listas — ver o gc abaixo. Escrito só por `listAdd`/`listRemove`/`folderDrop`, nunca por `setState` cru (ver "O furo do gc") |
| `downloadOk` | `true` depois que o operador autorizou o download sob demanda uma vez (modo simplificado — `ensureDownloadConsent`) |
| `messages` | `[{ id, text }]` — mensagens de texto puro da aba Mensagens (ver "Camada de Texto") |
| `opfs-folders` | `[{ id, name, count, syncedAt, handle? }]` — pastas sincronizadas no OPFS (`handle` acelera re-sync) |
| `coll:<id>` | `{ indexSyncedAt, songs: [{ id_music, track, name, duration, has_instrumental_music, fileIdFull, fileIdPlayback }] }` — índice offline de UMA coleção do LouvorJA (`coll:hymnal-2022`, `coll:hymnal-1996`, `coll:album-<id>`) — ver "Coleções de mídia (LouvorJA)" |
| `albumCatalog` | `{ categories: [{ id_category, name, order, albums: [{ id_album, subtitle, order }] }], albums: [{ id_album, name, color }] }` — a hierarquia categoria → álbum de `pt_categories` (ver "Classificação" nas Coleções). Formato antigo (array achatado) é migrado na leitura |
| `bibleVersions` | `[{ id, name }]` — versões/traduções da Bíblia (de `pt_bible_version`), baixadas na 1ª vez — ver "Bíblia" |
| `bibleBooks` | `[{ id, name }]` — livros da Bíblia (de `pt_bible_book`) para casar o `id_bible_book` real; a estrutura de exibição (abreviações/nº de capítulos) é offline em `bible.js` |
| `bibleVersion` | id da versão da Bíblia selecionada pelo operador |
| `bible:<v>_<b>_<c>` | `{ verses: [{ n, text }], syncedAt }` — texto de UM capítulo (`bible_{v}_{b}_{c}`); a versão inteira é baixada na 1ª vez que a aba é usada (e cada capítulo também sob demanda como fallback) |
| `bibleComplete:<v>` | `true` quando a versão `<v>` foi baixada por completo (todos os capítulos) — evita refazer o download em massa |
| `lyrics:<collId>` | acervo de LETRAS por coleção: `{ <id_music>: [{ a: rótulo\|null, l: [linhas] }] }`, ou `0` marcando "esta música não tem letra". É o que a BUSCA consome — ver "Acervo de LETRAS" |
| `chronoPrefs` | preferências do cronômetro/relógio/timer (modo, duração, formato, legenda, mais o campo `v` de versão do registro). A contagem em curso **não** é persistida |
| `drawPrefs` | sorteio: faixa/lista de opções, "não repetir", histórico e o último resultado — este **é** persistido (ver "Ferramentas: sorteio") |
| `migSemNumeroAlbuns` | marca de passagem única: os arquivos já baixados de coleções que não numeram tiveram o prefixo `N. ` removido (ver "O número é do HINÁRIO") |
| `hymnal2022` | legado — migrado para `coll:hymnal-2022` no `loadCollections()` (a chave antiga permanece, ignorada) |
| `pending-share` | legado — era o share que o service worker gravava aguardando processamento. O SW saiu; hoje o share chega pela ponte nativa, mas `checkPendingShare()` ainda **lê** esta chave, para não perder um share gravado por uma versão anterior |
| `order` | legado — lido apenas como fallback de `imports` |
| `favorites` | legado (recurso de favoritos removido) — array de IDs; não é mais lido nem gravado, ignorado |
| `linked-folders` | legado (pastas vinculadas por handle) — substituído por `opfs-folders`; ignorado |
| `louvorja-token` / `louvorja-hymnal` | legado (hinário online removido na v2.5); ignorados |

### API exposta (`window.AVDB`)

```js
setState, getState
stateKeys(prefix)             // chaves de `state` com esse prefixo, numa transação
                              // só e SEM ler valor nenhum — teste de presença em massa
addMedia(blob, meta)          // cria registro + adiciona a meta.list (padrão 'imports')
addUrlMedia(url, meta)        // item de URL externa (blob=null), idem
addDeck(pages, meta)          // apresentação: uma imagem por página
addCue(cue, data, meta)       // CENA DE ROTEIRO: item sem bytes (ver abaixo)
getMedia(id), renameMedia(id, name)
mediaByYoutube(youtubeId)     // o registro desse vídeo, ou null (prefere o que tem blob)
listIds, listSet, listItems, listHas, listAdd, listRemove, gc
folderDrop(folderId)          // apaga um ATALHO inteiro, coletando o que ficar sem dono
fileAdd, fileGet, fileDelete, filesByFolder, filesAll   // catálogo OPFS
opfsSupported, opfsGetFile, opfsWriteFile,              // Origin Private
opfsDeleteFile, opfsDeleteDir                           // File System
kindFromType, sendCommand, onCommand
```

**`listSet` tem duas formas, e a diferença entre elas é atomicidade:**

- `listSet(name, [ids])` grava o array como veio. O chamador leu a lista
  **antes**, fora de transação, então é um read-modify-write partido: um
  `listAdd` que comite entre a leitura e esta escrita é perdido — o item some
  da lista e o registro criado em `media` fica órfão para sempre, porque nunca
  esteve em lista nenhuma e o gc só roda dentro de `listRemove`. Hoje isso não
  acontece (nenhum escritor de fundo mexe em listas; a sincronização usa
  `fileAdd`), então é fragilidade estrutural, não defeito em operação.
- `listSet(name, fn)` é a forma **atômica**: `fn(listaAtual)` roda dentro da
  MESMA transação de `state` que grava o resultado. `fn` precisa ser SÍNCRONA
  — um `await` dentro dela deixaria a transação autocommitar antes do `put`.

Prefira a forma com função ao escrever código novo.

**O que saiu da superfície pública na v5.48**, e por quê:

- `openDB` — não tinha chamador fora do próprio `db.js`, e expor a conexão
  crua convida a montar transações por fora dos helpers, que é exatamente onde
  mora a atomicidade deste arquivo.
- `storeUrlTemp` / `storeMediaTemp` / `deleteMedia` — as duas primeiras
  gravavam em `media` **sem** entrar em lista nenhuma, e a terceira era a
  contrapartida manual ("limpar temp de pastas vinculadas" — recurso que não
  existe mais). As três estavam sem um único chamador. Pior que código morto:
  quem lesse o comentário concluiria que existe um caminho de limpeza de
  temporários, e voltar a usá-las criaria registros que **nenhum gc alcança**
  — vazamento permanente no IDB. Quem precisar de um registro usa
  `addMedia`/`addUrlMedia`, que já entram numa lista e portanto são
  coletáveis.

#### Garbage collection de blobs

Um registro só é excluído automaticamente quando **nada mais aponta para ele**
— nem lista, nem pasta dos Favoritos:

```
listRemove(listName, id)
  → isReferenced(id, exceto listName)?  → não; delete no store media (gc)
```

**`isReferenced` é o ponto único da pergunta "posso destruir este blob?"**, e
ela precisa cobrir mais do que as duas listas fixas. Até a v5.47 o gc só olhava
`LISTS` (`imports`/`playlist`/`avulsos`), e os **Favoritos ficavam de fora**: cada pasta
guarda seus ids em `state['folder_<id>']`, que são listas de mídia como
qualquer outra, só que em chaves dinâmicas que o gc não conhecia. O resultado
era destrutivo e silencioso — importar um vídeo, pô-lo num Favorito e depois
excluí-lo do Cronograma apagava o **blob**; o Favorito seguia com o id,
`getMedia` devolvia `undefined`, o `filter(Boolean)` do Controle descartava sem
avisar e o item sumia da pasta para sempre. Um blob importado não existe em
lugar nenhum além do IDB.

`isReferenced` recebe o objectStore de `state` **já aberto**, para decidir
dentro da transação de quem chamou — é isso que fecha o TOCTOU descrito abaixo.
O `gc(id)` avulso (hoje sem chamador; fica como válvula) usa a MESMA função de
propósito: foi a duplicação da regra em dois lugares que deixou os Favoritos de
fora. **Qualquer chave de `state` que passe a guardar ids de mídia precisa
entrar ali.**

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

##### O furo do gc: as pastas dos Favoritos escreviam por fora (corrigido na v5.103)

`isReferenced` conhecia essas pastas desde a v5.48 — mas **quem apagava uma pasta
não passava por ela**. O Controle fazia dois `setState` crus (tirava a entrada
de `folders`, gravava a lista vazia) e nada mais: uma mídia cujo ÚLTIMO
detentor era aquela pasta virava um registro que nenhuma lista aponta e que
**nenhum gc alcança** — o gc só roda dentro de `listRemove`. O blob ficava no
IndexedDB para sempre, invisível na tela e sem caminho de limpeza; um vídeo de
centenas de MB "sumia" e continuava ocupando o disco. Valia também para tirar
um item de dentro da pasta, pelo mesmo `setState` cru.

Três consertos, todos no sentido de "as pastas usam os mesmos helpers que as
listas":

- **`folderDrop(folderId)`** (novo, em `db.js`) apaga o índice, a lista e
  varre os ids numa transação só. A ordem importa: a pasta sai de `folders`
  **antes** da varredura, senão `isReferenced` o encontraria e ele seguraria os
  próprios ids.
- Tirar um item de uma pasta é `listRemove('folder_<id>', id)` — que já rodava
  o gc na própria transação, e já sabia excluir a chave da varredura.
- Pôr um item numa pasta é `listAdd('folder_<id>', id)`, atômico, no lugar do
  `setState` do array inteiro.

**Regra que fica:** chave de `state` que guarda ids de mídia se escreve por
`listAdd`/`listRemove`/`listSet(name, fn)`. `setState` cru numa dessas chaves é
um vazamento esperando acontecer.

#### Cenas de roteiro (`kind: 'cue'`, v5.103)

O Cronograma se chama "a lista do culto" desde sempre e, até a v5.102, só
guardava **mídia** — coisa com bytes. Metade de um culto real (a contagem
regressiva de abertura, a leitura bíblica, o aviso, a letra projetada sem
música) morava em OUTRAS abas, cada uma com a sua sessão, e a ordem do que vem
depois ficava só na cabeça do operador — que navegava entre abas ao vivo, no
domingo de manhã.

Um **cue** é um item de lista que aponta para uma CENA em vez de para bytes:

```js
{ kind: 'cue', cue: 'verse',      data: { versionId, bookIdx, chapter, verse } }
{ kind: 'cue', cue: 'message',    data: { msgId, text } }
{ kind: 'cue', cue: 'songlyrics', data: { collId, songId } }
{ kind: 'cue', cue: 'chrono',     data: { mode, durationMs, label, secs, h12 } }
{ kind: 'cue', cue: 'draw',       data: { kind, min, max, pool, label } }
{ kind: 'cue', cue: 'group',      data: { ids: [...] } }        // o "pacote"
```

Quatro propriedades desenham o resto:

1. **O Display não muda uma linha, e sequer sabe que cues existem.** Um cue
   NUNCA vira um comando `load`: projetá-lo chama a MESMA função que o botão da
   aba correspondente já chamava (`projectBibleVerse`, `projectMessage`,
   `projectChrono`, `projectDraw`, `projectSongLyricsOnly`), que manda o
   `text`/`chrono`/`draw` de sempre. É a invariante "não reimplementar o que já
   existe" aplicada aqui — só um ponteiro novo.
2. **A guarda mora em `send()`**, não no toque da lista: é por ali que passam o
   avanço automático da playlist, o ⏮/⏭ do transporte, a notificação nativa e o
   pacote. Um cue que chegasse ao `load` apagaria o telão (registro sem
   blob/url/pages cai no `clear()` do stage).
3. **A reconexão do telão vem de graça.** Projetar um cue deixa a SESSÃO
   correspondente montada, e `resendSceneToDisplay` já reenvia sessões. A única
   linha nova ali é a que evita dar `load` no próprio cue.
4. **O descritor é uma REFERÊNCIA, não uma cópia do conteúdo.** O versículo
   guarda `{versão, livro, capítulo, número}` e o texto vem do cache da Bíblia
   na hora de projetar; a mensagem guarda o `msgId` (com o texto como reserva,
   para o roteiro não ficar mudo se ela for apagada). Um cue não envelhece
   quando a mensagem é editada, nem duplica a Escritura no banco.

Duas decisões de comportamento que valem registrar:

- **O versículo projeta na versão EM USO HOJE**, com a guardada como reserva: a
  referência é do texto, não da tradução, e um roteiro montado há um mês não
  pode arrastar de volta uma versão trocada desde então (nem disparar o
  download dela no domingo). A reserva é o que salva o caso offline.
- **O sorteio guardado é a CONFIGURAÇÃO, nunca um resultado.** Projetar a cena
  arma o sorteio e espera o toque em "Sortear" — um ganhador que já aparece
  pronto ao entrar em cena tira do momento o que ele tem de público.

**Guardar uma cena é sempre o mesmo par de botões** (`cueSaveBtn`, v5.109): ⊞
para o Cronograma, ★ para os favoritos, sempre `.cue-save-btn` — a mesma caixa
dos botões de linha e da barra de seleção (`--hit`, `--surface-2`, ícone em
`--gold`). Até a v5.108 esse par aparecia **com rótulo** em dois lugares ("Ao
Cronograma"/"Favoritar" na Bíblia, "Cronograma"/"Favoritos" nas Ferramentas) e
**só com ícone** em todos os outros (linha da lista, barra de seleção, folha de
destinos das músicas): o mesmo par de ações desenhado de duas formas — e a forma
com texto era justamente a que não cabia na linha em que estava. O rótulo virou
`title` + `aria-label`, que é o que nomeia o botão para o leitor de tela e para
o toque longo. (A **folha de destinos** das músicas continua com texto: ali as
linhas são um MENU, não um par de botões, e cada uma diz uma coisa diferente —
"tocar", "playlist", "Cronograma".)

#### Vídeo × só áudio, no seletor que já existia (v5.112)

A folha de destinos de um resultado do YouTube ganhou no topo o **mesmo
segmentado de Cantada/Playback** das músicas do acervo (`.fit-seg`), com
**Vídeo** e **Só áudio**. É a mesma pergunta — "qual faixa deste item?" — e não
havia por que inventar um segundo desenho para ela; a escolha vale para as
quatro ações abaixo, em vez de dobrar a folha para oito linhas.

- **Baixar só o áudio não é uma versão degradada.** O YouTube guarda o áudio em
  faixa SEPARADA, e é justamente por isso que o vídeo progressivo tem teto de
  720p (as resoluções altas vêm sem som, e juntá-las exigiria um ffmpeg
  embarcado). Pedindo só o áudio, esse teto não existe.
- **O registro entra como `kind: 'audio'` e SEM miniatura.** Não é economia: a
  miniatura de um áudio seria a "capa" que não deve existir, e é o `kind` que
  faz o telão manter o wallpaper (ver `semVisual`, na seção do stage).
- **O nome ganha " (áudio)"** — a mesma convenção do "(Cantado)"/"(Playback)"
  do acervo. Sem o sufixo, o vídeo e o áudio do mesmo link viram duas linhas de
  nome idêntico na lista.
- **O reaproveitamento passou a ser por FORMA.** As duas convivem no banco com o
  mesmo `youtubeId`, então `mediaByYoutube(id, kind)` ganhou o filtro: quem
  pediu áudio não pode receber o vídeo de 80 MB que já estava aqui, e vice-versa.
- **Ponte:** método PRÓPRIO (`ytFetchAudio`), não um parâmetro a mais no
  `ytFetch`. A ponte casa o método por nome + aridade, e mudar a assinatura do
  `ytFetch` quebraria o download inteiro num shell antigo que recebesse este
  bundle por OTA — "sem YouTube nenhum" é muito pior que "sem a opção de áudio".
  O seletor só é desenhado com `__SHELL_VERSION__ >= 23`, pela mesma regra do
  botão de busca no YouTube.
- **A escolha viaja no FECHO de cada ação**, não em `songMenuFor`: o
  `songMenuItem` chama `closeSongMenu()` ANTES da ação, e `closeSongMenu` zera
  aquele objeto — consultá-lo lá dentro encontraria null e todo download sairia
  como vídeo. É o mesmo cuidado que a `variante` das músicas já tomava.

##### Por que a primeira versão não baixou nada (corrigido na v5.113)

Em aparelho, pedir só o áudio mostrava o cartão de download e terminava em
NADA: nem item, nem erro. A causa não estava no lado web — verificado com a
ponte simulada, o pedido chegava com `soAudio: true` e o registro nascia certo
(`kind: 'audio'`, sem miniatura, nome com " (áudio)"). Estava no shell: as
faixas de áudio são **adaptativas**, e adaptativo é exatamente o que o YouTube
protege com PO Token — que este app não monta de propósito (ver o cabeçalho de
`YoutubeGrab.kt`). Sem token, `audioStreams` volta vazio ou com URLs que o CDN
responde 403, enquanto o **progressivo**, que é o formato antigo, passa.

Três correções, e a terceira valia para todo download, não só para o áudio:

1. **Uma fila de tentativas, não uma escolha só**: AAC (m4a) → qualquer outro
   formato de áudio (Opus/WebM, que este mesmo Chromium toca) → **o vídeo
   progressivo**. Cair no progressivo não desmente a escolha do operador: quem
   decide que o telão não muda de imagem é o `kind: 'audio'` do registro, não o
   container do arquivo. Ele ouve o louvor no fundo do mesmo jeito; o que paga é
   o tamanho, e por isso essa é a ÚLTIMA tentativa.
2. **O `type` é o do arquivo que veio, nunca o que foi pedido** — anunciar um
   mp4 com vídeo como `audio/mp4` seria mentir para o decodificador. O shell
   manda também `audioOnly`, que a **UI não usa** (v5.114): quando o vídeo não
   oferece faixa separada, o que o operador pediu — tocar no fundo, sem imagem
   no telão — acontece do mesmo jeito, porque quem manda no telão é o `kind` do
   registro e não o container do arquivo. Anunciar a diferença seria contar um
   detalhe de implementação no meio de um culto. O campo continua no JSON
   porque é o que aparece no `Log.w` de quem for diagnosticar por que um vídeo
   específico não entregou o áudio.
3. **Um download que falha agora FALA.** `ytAcao` só apagava a marca de
   "baixando" e sumia — minutos de espera terminando em silêncio, para todos os
   destinos. Agora responde `erro` no botão (ou na faixa, quando o toque veio de
   uma folha que já fechou).

##### O diagnóstico da extração, no rodapé de Configurações (v5.115)

Em aparelho, o "só áudio" caiu no vídeo progressivo — e isso levanta a pergunta
seguinte, que é a do **1080p**: acima de 720p tudo mora nas faixas *video-only*,
a MESMA classe da faixa de áudio que não veio. Se elas não chegam a este
aparelho, implementar o remux (juntar vídeo e áudio com o `MediaMuxer` da
plataforma, sem recodificar) seria construir uma engrenagem que nunca gira.

A pergunta **não se responde lendo código**: sem `PoTokenProvider` a biblioteca
busca os streams pelo endpoint `reel/reel_item_watch`, cujo conjunto de formatos
varia por vídeo. Então o app passou a medir: `YoutubeGrab.diagnostico` guarda,
em uma linha, quantas faixas de cada tipo o extrator recebeu, a maior altura de
cada grupo e qual tentativa venceu —

```
áudio 0 · vídeo-só 0 · progressivo 2 (720p) → veio mp4 720p
```

— e `AVNative.ytDiag()` a entrega ao rodapé de **Configurações**, ao lado das
versões e do alvo de espelhamento, que é onde o resto do diagnóstico já mora. É
lido a cada ABERTURA do popup, não uma vez na carga: o valor muda a cada
download, e a graça é comparar antes e depois de um teste. Só aparece no app
(shell ≥ 24) e depois da primeira extração.

**A primeira medição em aparelho** (v1.42) devolveu:

```
áudio 0 · vídeo-só 0 · progressivo 1 (360p) → veio mp4 360p
```

Uma faixa só, a mais baixa que existe (itag 18). Não há adaptativas — logo não
há 1080p para juntar, e o remux não teria o que fazer — e **nem o progressivo de
720p está vindo**: o app baixava em 360p, não em 720p como se supunha. É o
conjunto reduzido do endpoint dos Shorts.

> **Esta frase dizia "e atualizar a biblioteca não resolve", e ela estava
> errada** — a v1.49 mostrou que era exatamente o que resolvia. A conferência da
> época olhou o *fallback sem token* (que de fato continuava igual) e concluiu
> sobre a biblioteca inteira; o que a v0.26.3 trouxe foi um **cliente novo**, que
> não passa por aquele fallback. Fica registrado como está: ler uma peça e
> concluir sobre o conjunto é o erro, não a conclusão. Ver "O cliente visionOS
> destrava o 1080p", no fim desta série.

A alavanca que sobrou antes do BotGuard é o **cliente iOS** (v1.43): ele vem
DESLIGADO na biblioteca (`private static boolean fetchIosClient;`, sem valor) e
é o único outro cliente consultado sem PO Token —
`YoutubeStreamExtractor.setFetchIosClient(true)` acrescenta uma segunda resposta
de player à mesma extração. A ressalva está na javadoc do próprio método: as
faixas do iOS vêm "especialmente" como **manifestos HLS**, e manifesto não é URL
de arquivo — o `isUrl` das nossas escolhas o descarta. Por isso o diagnóstico
passou a contar também o que veio SEM ser URL direta (`+N manif.`): é o que
separa "o YouTube não mandou nada" de "mandou, mas noutro formato", duas
leituras que levam a decisões opostas e que sem esse `+` apareceriam como o
mesmo zero. Custa uma requisição a mais por extração; se a medição seguinte não
mostrar ganho, a linha sai.

**A medição seguinte (v1.43) mudou tudo:**

```
áudio 5 · vídeo-só 12 (1080p) · progressivo 1 (360p) → veio mp4 360p
```

O cliente iOS destravou as faixas adaptativas — e todas como URL direta, sem
nenhum `+N manif.`. Ou seja: o 1080p e o áudio puro estavam disponíveis, e o app
baixava a pior cópia possível (o único progressivo, de 360p) porque era a única
que não precisava ser montada. A linha do iOS fica.

Daí o **remux** (`MuxMp4.kt`, v1.44): baixa a melhor faixa de vídeo até 1080p
(mp4/AVC) mais a melhor de áudio (m4a/AAC) e as junta com o `MediaMuxer` da
plataforma. É cópia de amostras comprimidas, não recodificação — os bits são os
mesmos que vieram do YouTube, não há perda e o processador quase não trabalha.
Três guardas que valem registrar:

- **Só monta se for MELHOR que o progressivo.** Um vídeo cuja faixa separada
  fosse 360p pagaria dois downloads e um muxer para entregar o mesmo de antes.
- **mp4 + m4a, não "o melhor" absoluto.** O 1080p costuma vir em AVC (mp4) e
  VP9 (WebM); só o primeiro entra num contêiner MP4. Escolher pelo bitrate e
  descobrir isso no fim seria baixar centenas de MB para falhar no muxer.
- **Uma barra só** para os dois downloads e a montagem (o vídeo pesa 90%, que é
  a proporção real): duas barras que voltam ao zero no meio são
  indistinguíveis de travamento.

Falhando qualquer etapa, a fila de tentativas de sempre continua valendo — o
progressivo é o piso, e um louvor em 360p é melhor que nenhum.

##### O diagnóstico que inventou um erro (v1.46)

A leitura seguinte trouxe `· mp4 423 · webm 423`, e **HTTP 423 nunca aconteceu**.
O `motivo()` procurava três dígitos começando em 4 ou 5 no TEXTO da exceção —
mas `conn.inputStream` lança `FileNotFoundException` cuja mensagem é só a URL, e
toda URL do googlevideo carrega `dur=423.061`, a duração do vídeo em segundos. O
regex leu a duração e a apresentou como código de erro.

Vale registrar porque é a falha mais cara que um diagnóstico pode ter: ele não
ficou em silêncio, ele **apontou para o lugar errado com confiança**. Hoje o
código vem de `conn.responseCode`, lido antes de abrir o fluxo, e a mensagem
("HTTP nnn") é escrita por nós — não há mais o que adivinhar.

Junto vieram as duas hipóteses do 403 nas faixas adaptativas, ambas baratas:
`Range: bytes=0-` (é assim que um player de verdade consome essas URLs, e o
googlevideo costuma recusar quem não pede faixa) e o **UA do cliente que emitiu
a URL** — elas vêm do cliente iOS, e pedi-las anunciando um Chrome de Android é
a incoerência que o CDN responde com 403. `baixarTentando` tenta os dois perfis
e registra no diagnóstico qual funcionou (`mp4/i` = MP4 baixado com o perfil
iOS).

##### O desfecho: 403, e o 1080p fica de fora (v1.47)

Com o código verdadeiro na tela, a resposta veio:

```
áudio 5 [m4a 2, webm 3] · vídeo-só 12 [mp4 6 (1080p), webm 6 (1080p)]
  · prog 1 [mp4 1 (360p)] · mp4 403 · webm 403 → veio mp4 360p
```

As faixas de 1080p **existem e são listadas**; o CDN responde **403** a todas —
com os dois pares de contêiner, com os dois perfis de cliente e com `Range`. É o
portão do PO Token, e ele não se abre por cabeçalho. A conclusão da época foi
que **1080p exigiria montar o desafio do BotGuard num WebView**, o que este
projeto decidiu não fazer quando o `YoutubeGrab` nasceu.

> A primeira metade estava certa e a segunda não: o portão era real, mas o
> BotGuard não era a chave — nem sequer serviria (ver a v1.49, no fim desta
> série). O 403 tem nome, **SABR enforcement**, e a correção veio da própria
> biblioteca.

O que fica no código, e por quê:

- **O remux (`MuxMp4`) fica.** Ele custa zero quando as faixas são recusadas
  (falha na primeira requisição, sem baixar nada) e entra em ação sozinho no dia
  em que o YouTube afrouxar — ou num vídeo cujas faixas não estejam protegidas,
  que é caso a caso.
- **O cliente iOS fica ligado.** É ele que faz as faixas aparecerem no
  diagnóstico; sem ele a linha voltaria a dizer `vídeo-só 0` e perderíamos a
  capacidade de PERCEBER uma mudança. *(Desligado de novo na v1.49: com o
  visionOS listando as faixas, ele só acrescenta candidatos que dão 403.)*
- **`adaptativoBloqueado` (por processo)**: depois do primeiro 403 da sessão, os
  downloads seguintes vão direto ao progressivo. Sem essa memória, cada download
  refazia quatro requisições condenadas antes de chegar à mesma conclusão. Não é
  persistido de propósito — reabrir o app tenta de novo, e um estado em disco
  transformaria a recusa de um dia numa desistência permanente. *(Na v1.49 ele
  passou a exigir unanimidade: com o pool de faixas misturado, desligar tudo no
  primeiro 403 seria o autogol.)*

O download seguiu em **360p** neste aparelho por mais duas versões: era o único
formato progressivo que o YouTube entregava sem token. Vale lembrar o que esse
caminho continua garantindo, que era o objetivo original e não mudou — o vídeo
vira ARQUIVO, com fade, playlist, `MediaSession` e segundo plano, **sem depender
da rede durante o culto**.

##### A fonte alternativa, e por que ela saiu (v1.48 → v1.49)

Depois do 403 confirmado, a v1.48 tentou o caminho barato: `InnerTube.kt`, **um
POST** para `youtubei/v1/player` anunciando-se como um cliente que não exige
token — o do **Quest** (`ANDROID_VR`) e, em seguida, um de **TV**. Sem executar
JavaScript ofuscado, sem atestação, sem decifrar assinatura.

Em aparelho:

```
· vr: 0 (LOGIN_REQUIRED) · tv: 0 (ERROR)
```

Nenhuma faixa, pelos dois. O arquivo inteiro **saiu na v1.49**, e não por ter
falhado uma vez: o que ele buscava a biblioteca passou a entregar sozinha (logo
abaixo), e mantê-lo seria manter superfície nossa contra um alvo que muda toda
semana — que é justamente o que a dependência existe para evitar. Fica a lição,
que vale para a próxima ideia do mesmo tipo: um cliente de dispositivo escolhido
por reputação de fórum envelhece em silêncio, e do lado de cá isso é um zero mudo
no diagnóstico.

##### O cliente visionOS destrava o 1080p, e a escolha vira uma FILA (v1.49)

O 403 tem nome — **SABR enforcement** — e a correção estava publicada havia
meses, do lado da biblioteca.

**Primeiro, o que NÃO era a saída.** O PO Token via WebView foi descartado com
verificação, não por preguiça: `PoTokenProvider.getWebClientPoToken()` **não tem
uma única chamada** em nenhuma versão do extrator (v0.26.0 → v0.26.4 e `dev`) —
o cliente web só serve para metadados, e o `onFetchPage` consome apenas os tokens
**ANDROID** e **iOS**. O próprio NewPipe implementa só o token web e devolve
`null` para os outros dois. E o token do cliente Android, que *seria* consumido,
exige o **DroidGuard** do Play Services, atrelado à assinatura do app oficial.
Um WebView rodando BotGuard aqui alimentaria um campo que ninguém lê.

**O que era a saída.** A issue NewPipe **#13320** ("Only MP4 360p / no separate
audio tracks available") descreve o nosso caso palavra por palavra, e o PR
**#1508** ("Workaround SABR enforcement by using another player client") a
corrigiu na **v0.26.3**: um cliente **visionOS**, buscado
incondicionalmente e **sem token nenhum** — a assinatura de
`fetchVisionOsClient(localization, contentCountry, videoId)` sequer recebe um
`PoTokenResult`. O app estava pinado na **v0.26.1**. O conserto foi **uma linha
de `build.gradle.kts`**.

Isso é a dependência fazendo o serviço pelo qual ela existe, e vale registrar do
jeito certo: sete versões de shell foram gastas medindo um portão, e quem o
abriu foi quem publica a biblioteca. Antes de reescrever extração à mão, olhar o
CHANGELOG dela.

###### A parte que o bump sozinho NÃO resolveria

Depois do bump, `StreamInfo` traz uma **mistura**: faixas do visionOS (que
baixam) ao lado das do cliente antigo (que respondem 403). A escolha anterior
pegava **uma** faixa por contêiner, a de maior altura — e com o pool misturado
essa pode ser justamente a envenenada. Seria perder o 1080p tendo um 1080p bom
na mesma lista: o bump entraria e não mudaria nada visível.

Por isso `tentarJuntar` virou uma **fila de candidatos**:

- **A ordem é cliente primeiro, altura depois.** Parece invertido e não é: as
  duas listas trazem 1080p, mas só a do visionOS baixa. Ordenar por altura
  intercalaria as duas e gastaria as tentativas no lado que o CDN recusa.
  Empatados, mp4 antes de WebM — o WebView toca H.264 em qualquer aparelho.
- **O áudio é a sonda barata, e vem primeiro.** Ele tem alguns MB contra
  centenas do vídeo: descobrir por ele que um contêiner não serve custa uma
  fração. O arquivo baixado fica **guardado por contêiner**, então um segundo
  candidato de vídeo mp4 reaproveita o m4a que já veio.
- **Tetos assimétricos.** Um 403 falha antes do primeiro byte, então um candidato
  de vídeo perdido custa uma requisição — daí caber quatro. Já uma **montagem**
  que falha custou o download inteiro do vídeo, e tem teto de dois. Isto roda na
  rede do chip do operador, possivelmente minutos antes do culto.
- **O UA acompanha a URL.** `baixarTentando` lê o `c=` da própria URL e tenta
  primeiro o perfil que combina com ela (visionOS, iOS ou Chrome/Android); os
  outros ficam atrás como rede de segurança. Antes a ordem era fixa, e a faixa
  boa podia ser perdida logo na primeira tentativa. A constante `UA_VISIONOS` é
  copiada caractere a caractere do que a biblioteca monta — **ao trocar a versão
  do extrator, conferir `ClientsConstants` e trazer os números novos junto**.
- **`adaptativoBloqueado` ficou muito mais difícil de levantar.** Antes, qualquer
  403 desligava o caminho adaptativo pelo resto da sessão. Com o pool misturado
  isso seria o autogol: um 403 isolado é o comportamento NORMAL de uma faixa
  envenenada com uma boa logo atrás. Agora exige **unanimidade** — todos os
  candidatos tentados, no mínimo dois, mortos com 403.
- **O cliente iOS voltou a ficar DESLIGADO.** Ele foi ligado à mão na v1.43 como
  a única alavanca disponível, e não resolveu (as faixas dele vêm como
  manifestos HLS, que o `isUrl` descarta). Agora ele atrapalha: cada faixa a mais
  é um candidato que a fila pode gastar uma requisição tentando.
- **O mesmo vale para o "só áudio"**, que deixou de ser "m4a → qualquer outro" e
  passou a ser três candidatos na mesma ordem de cliente.

###### O diagnóstico passou a dizer DE QUEM veio cada faixa

A linha do rodapé ganhou duas coisas, e as duas respondem a perguntas que as
sete versões anteriores não conseguiam responder:

```
… · clientes VISIONOS 16, ANDROID 1 · a:140@ANDROID 403 · v:137@VISIONOS/V
  → juntou 1080p (mp4, 137@VISIONOS/V)
```

- **`· clientes VISIONOS 16, ANDROID 1`** — de qual cliente veio cada faixa
  LISTADA. Sem isso, dezessete faixas parecem a mesma coisa vindo do cliente que
  funciona ou do que só entrega 403.
- **`itag@CLIENTE` em cada tentativa** (`a:` para áudio, `v:` para vídeo) — uma
  falha futura se correlaciona com o formato exato em vez de virar mais um zero
  mudo.

Os dois saem do **`c=` e do `itag=` da própria URL**, não de um campo da
biblioteca: é o CDN quem os carimba, e o que ele carimbou é o que ele vai cobrar
na hora do download. De quebra, o diagnóstico não acrescenta superfície de API
a uma dependência que acabou de ser atualizada.

###### A medição que fecha a série

Em aparelho, com o APK da v1.49:

```
áudio 5 [m4a 2, webm 3] · vídeo-só 12 [mp4 6 (1080p), webm 6 (1080p)]
  · prog 1 [mp4 1 (360p)] · clientes VISIONOS 17, ANDROID 1
  → juntou 1080p (mp4, 137@VISIONOS/V)
```

Cada pedaço confirma uma peça:

- **`VISIONOS 17, ANDROID 1`** — o cliente novo trouxe 17 das 18 faixas, e o
  único `ANDROID` é justamente o progressivo de 360p, que era tudo o que o app
  conseguia baixar antes. As contas fecham nos dois sentidos (5 + 12 + 1 = 18),
  o que também mostra que as três listas do `StreamInfo` não se sobrepõem.
- **`137@VISIONOS`** — itag 137 é o AVC de 1080p, e é EXATAMENTE a faixa que
  respondia 403 nas sete versões anteriores.
- **`/V`** — o perfil de UA que baixou foi o do visionOS, escolhido pelo `c=` da
  própria URL. O CDN serviu na primeira requisição.
- **Nenhum `403` na linha.** A fila não precisou de um segundo candidato: o
  primeiro áudio e o primeiro vídeo passaram direto. É a prova de que a ordem
  "cliente primeiro, altura depois" põe a faixa certa no topo — com a ordem
  antiga (só altura), uma das seis faixas de 1080p do pool poderia ter sido a do
  cliente errado.

O app passou de entregar a **pior cópia que o YouTube oferece** (itag 18, 360p)
para 1080p AVC remuxado pela plataforma, sem recodificar e sem perda.

> A linha só menciona o itag do ÁUDIO quando ele falha — no sucesso ela nomeia
> apenas o vídeo. É de propósito: um diagnóstico que narra o caminho feliz vira
> ruído, e o que interessa registrar é onde alguma coisa parou.

###### O que continua valendo

O progressivo segue como **piso**: falhando tudo, o app entrega o arquivo de
360p em vez de nada. Um caso conhecido em que o visionOS não extrai é o vídeo
marcado como "made for kids" — ali o app cai no progressivo sem quebrar nada.

##### Todo campo de log tem botão de copiar (v5.117)

O diagnóstico acima nasceu sem botão, e a primeira leitura chegou aqui como
FOTO DA TELA. Virou regra do projeto (está em `CLAUDE.md`): um campo de
diagnóstico existe para ser repassado, então ele vem com `.log-line` +
`.log-copy` — texto selecionável (contra o `user-select: none` que vale para o
app inteiro) e um botão que não encolhe, porque numa tela estreita quem some
primeiro não pode ser a saída. `copiarTexto` usa `navigator.clipboard` (o app
tem contexto seguro: a base é servida por `https://appassets.androidplatform.
net`) e cai no `execCommand('copy')` se o WebView negar — com o `<textarea>`
posicionado FORA da vista, nunca `display:none`, porque um campo fora do layout
não pode ser selecionado e sem seleção o `copy` copia nada, em silêncio. A
confirmação é o mesmo pulso do resto do app.

**Não exige subir o `DB_VERSION`** (nenhum índice novo; o IDB não tem esquema
por registro), e é isso que o mantém barato: ver o preço da VOLTA descrito em
`DB_VERSION`, em `db.js`. Um bundle anterior que encontre um cue o trata como
mídia sem fonte e cai no `clear()` — nada quebra, nada projeta.

### BroadcastChannel — canal `av-iasd`

Todos os comandos são objetos com um campo `type`.

**Um só ponto de entrega, com a lista de handlers por cima.** `onCommand` só
assina o canal (e o relay nativo) na **primeira** chamada; as seguintes apenas
entram numa lista. O motivo é o `alreadySeen`, que **testa e marca** o `__mid`
na mesma chamada: até a v5.47 cada `onCommand` criava seu próprio `deliver` e
todos compartilhavam o mesmo conjunto de mids, então com dois listeners na
mesma página o primeiro marcava o mid e o segundo via a mensagem como
repetida — o segundo **nunca receberia nada**. E só no app: no navegador não há
relay, não há `__mid`, e os dois funcionariam. Um recurso testado no navegador
que para de funcionar no aparelho é o pior modo de falhar deste projeto. Hoje
há exatamente um `onCommand` por página, então a armadilha estava latente — e é
justamente por isso que seria descoberta tarde, por quem só quisesse observar
`display-status` num módulo novo.

A entrega itera sobre uma **cópia** da lista (um handler que registre outro
durante a entrega não altera a rodada em curso) e envolve cada chamada em
`try/catch`: um handler que lança não pode calar os demais — no telão isso
significaria perder o comando seguinte no meio de um culto.

#### Controle → Display

| `type` | Campos extras | Descrição |
|---|---|---|
| `load` | `mediaId, view, muted, volume, time?, playing?` | Carrega e exibe uma mídia. `time` (segundos) e `playing` (bool) existem para a **reconexão do telão** — ver "Reenvio da cena" |
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
| `text` | `mode, view` + payload conforme o modo | Projeta/atualiza a **Camada de Texto** (ver a seção própria). `mode` = `'verse'` (Bíblia) \| `'message'` (aviso) \| `'chrono'` (relógio/cronômetro/timer) \| `'draw'` (sorteio). Nos dois primeiros o payload é `main` (texto principal) + `sub` (referência dourada abaixo; vazio nas mensagens); nos dois últimos é um **descritor** (`chrono` / `draw`) a partir do qual cada lado calcula o número localmente — ver as seções de Ferramentas. Um novo `text` troca o conteúdo em cena; `view` só liga/desliga a cortina compartilhada. **Independente do áudio**: um `text` NÃO para a mídia do stage — o áudio segue tocando por baixo |
| `text-hide` | — | Encerra a Camada de Texto (Bíblia/Mensagem) sem tocar na mídia de fundo |
| `mic` | `on` (bool) | **Microfone ao vivo** (push-to-talk): o Display abre o microfone e reproduz a voz na projeção. Camada de ÁUDIO independente — não toca na mídia, no texto nem na cortina. Enviado por `AVDB.sendCommand` direto, **nunca** por `cmd()`: a preview é o mesmo aparelho, a centímetros do microfone |
| `audio-retry` | — | Retentativa imediata de liberar o áudio bloqueado (botão de mudo do Controle no estado "sem áudio") |

#### Display → Controle

| `type` | Campos extras | Descrição |
|---|---|---|
| `display-ready` | — | Display pronto; o Controle reenvia a **cena inteira** (ver abaixo) |
| `display-status` | `mediaId, view, muted, volume, playing, currentTime, duration, audioBlocked` | Estado do Display a cada evento de tempo/estado (`audioBlocked`: navegador bloqueou som sem gesto; o Controle avisa o operador) |
| `media-ended` | `mediaId` | Vídeo/áudio chegou ao fim |
| `mic-status` | `on`, `error` | Resultado da abertura do microfone (permissão negada, sem microfone, em uso por outro app…) |

#### Reenvio da cena (`resendSceneToDisplay`)

O Display **sempre** abre no wallpaper e espera um comando — quem sabe o que
estava em cena é o Controle. Quando o dongle cai e volta, o Android destrói e
recria a `Presentation`, o WebView recarrega `/display/` e dispara
`display-ready`; é aí que o Controle reconstitui o telão. Três decisões
sustentam isso, e as duas primeiras nasceram de defeitos vistos em culto:

- **Cena é tudo que está no telão, não "mídia tocando".** A condição de reenvio
  é só `currentId` — qualquer mídia carregada. Ela já foi `playing || isImage`,
  e o que ficava de fora era justamente o caso mais comum de uma queda de
  dongle: o louvor de fundo **pausado** para a oração. Um vídeo pausado mostra
  o quadro congelado, um áudio pausado mantém a letra sincronizada em cena —
  nos dois casos havia algo projetado, e nos dois casos ele sumia para sempre.
- **O `load` leva a POSIÇÃO e o estado de reprodução** (`time`, `playing`). Sem
  eles o telão recarregava do zero: um hino aos 3:20 recomeçava do início na
  frente da congregação, e o `display-status` seguinte chegava com
  `currentTime` 0 e arrastava a preview do Controle junto — o operador perdia
  até a referência de onde estava. O tempo sai da **barra de progresso**
  (`#seek`), a mesma fonte que `pushNowPlaying` usa: é a única que cobre todos
  os tipos, inclusive YouTube, onde `preview.getTime()` não sabe de nada.
  Os campos viajam **dentro do próprio `load`**, e não como um `seek`/`pause`
  enviado logo depois, porque o `onCommand` do Display não serializa: o load é
  assíncrono (`getMedia` → `opfsGetFile` → `mediaReady`) e um comando seguinte
  chegaria a tempo de agir sobre o `<video>` **anterior**, antes de a fonte
  nova entrar.
- **A ordem é mídia primeiro, texto depois.** No Display um `load` **visual**
  encerra a Camada de Texto e um `load` de **áudio** a mantém — mandar o texto
  por último faz as duas combinações caírem no estado certo. Cronômetro e
  sorteio voltam pelo **descritor**, não por um valor: o telão recalcula o
  número a partir do mesmo `startAt`/`rollUntil`, então reaparecem no segundo
  certo (e no mesmo quadro do rolo), não no ponto em que a conexão caiu.

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
- **`computeCover()`**: `!current || ended || view === 'wallpaper' ||
  semVisual()` — a cortina deve cobrir sempre que não há mídia, ela "terminou"
  (`ended`, aguardando replay), o operador pediu `view='wallpaper'` — ou o que
  entrou **não tem imagem nenhuma para mostrar**.
  Repare que o primeiro, o segundo e o quarto termos **não dependem da view**:
  sem nada visível em cena a cortina cobre nos dois valores dela. É disso que
  sai a guarda de `setViewFaded` descrita abaixo.

##### `semVisual()`: áudio puro mantém o wallpaper (v5.112)

Um registro `kind: 'audio'` **sem letra sincronizada** — um mp3 importado, o
instrumental de fundo, o áudio baixado de um vídeo do YouTube — não põe nada no
`<img>` nem no `<video>` (ver `applyMedia`). Sem esta pergunta a cortina ABRIA
para ele: o telão saía do wallpaper e ficava no **preto do palco**, com o louvor
tocando por trás de um retângulo vazio. Não era uma capa errada — era a ausência
de qualquer coisa, e no meio de um culto isso se lê como projetor apagado.

A letra é a exceção que confirma a regra: quando o áudio TEM letra a cortina
precisa sair da frente, porque a `.lyrics-layer` fica **por baixo** dela (o
wallpaper tem `z-index` maior, e é assim que ele cobre/revela as camadas de
graça). Por isso a pergunta é feita ao PRÓPRIO registro (`current.lyrics`), que
é quem carrega a letra — a mesma condição que o `display.js` já usa para chamar
`showLyrics` —, e não à camada, que o stage não conhece.

Três pontos onde ela entra, e o terceiro é o que fecha o caso:

1. `computeCover()`, que governa `play()`, `setView()` e o `clear()`.
2. O fim do `load()`: `view === 'visual' && coveredNow && !semVisual()` — não
   abre a cortina para quem não tem o que mostrar.
3. O **caminho inverso**, que é o que quase escapou: uma IMAGEM em cena seguida
   de um áudio sem letra. Ali a cortina já estava aberta (havia o que ver) e
   ninguém a fecharia — o telão ficaria no preto. Daí o `if (semVisual() &&
   !coveredNow) await coverIn(false)` no fim do `load`.

E como a cortina é **compartilhada** (a Camada de Texto a abre por conta
própria para o cartão aparecer), o Display precisa da mesma regra ao devolvê-la
depois que o texto sai: `reconcileCover` pergunta `stage.shouldCover()` — o
`computeCover` exposto — em vez de reabrir cegamente. Só quando a cena é do
stage: com o player do YouTube no ar, `current` pode estar nulo e a pergunta
responderia "cobre" justamente sobre o vídeo que está tocando.

**Verificado em Chromium**, com Controle e Display na mesma origem trocando
comandos de verdade: imagem em cena → `wallpaper: none`; áudio sem letra logo em
seguida → `wallpaper: flex`, `<img>` e `<video>` ocultos; áudio COM letra →
`wallpaper: none` e a camada de letra visível.
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
stage.load(id, view, muted, volume, startAt, autoplay)
                       // startAt: posição inicial em segundos (opcional)
                       // autoplay: só `false` muda algo — a cena volta PAUSADA.
                       //   `undefined` mantém o comportamento de sempre (todo
                       //   load normal toca), então nenhum chamador antigo mudou.
                       // `handle({type:'load'})` os lê de cmd.time / cmd.playing
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

O valor é limitado a `[PV_AR_MIN, PV_AR_MAX]` = `[1.2, 2.4]`: acima disso a
largura calculada estoura a coluna e a preview passa a ser encolhida pelo
`max-width: 100%`, deixando a faixa com folga vertical em vez de ficar
proporcional. Telas reais de projeção ficam entre 4:3 e ~2,2:1, bem dentro da
faixa; um painel 32:9 bate no teto e deixa de ser proporcional — troca
deliberada. Verificado em 24 combinações (6 larguras de celular × 4 proporções
de telão): nada transborda a linha nem invade o mixer. (Até a v5.48 o limite
também protegia os dois botões de estrofe que dividiam a linha com a preview;
eles saíram na v5.49 — ver "Um par de botões, dois eixos" —, e a faixa subiu de
130px para 150px justamente porque a largura sobrando virou espaço morto.)

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

**Posição inicial e autoplay (`startAt`/`autoplay`)** existem para a
**reconexão do telão** (ver "Reenvio da cena"), e cada um tem uma sutileza:

- A posição só "gruda" **depois que a duração é conhecida** — escrever
  `currentTime` junto com o `src` é perdido em silêncio. Por isso ela é
  aplicada num listener `loadedmetadata` com `{ once: true }`: vale para ESTA
  fonte, e a próxima traz o seu próprio pedido. O listener reconfere `loadSeq`
  antes de escrever — outro `load` pode ter assumido durante a espera.
- `autoplay === false` **suprime o `play()`**, e só isso: quem revela a mídia
  continua sendo o `applyMedia()` + a cortina, no fim do mesmo `load`. Um vídeo
  pausado mostra o quadro congelado, que é exatamente o que o telão tinha antes
  de cair.

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

#### Sem nada em cena, trocar a view não transiciona (v5.69)

`setViewFaded` compara `computeCover()` **antes e depois** de trocar a view e
volta cedo quando o resultado é o mesmo. Sem mídia — ou com a que havia já
terminada — a cortina cobre nos dois valores da view (os termos `!current` e
`ended` não dependem dela), então não há transição nenhuma a fazer.

Fazer uma era o defeito: `coverOut()` esmaecia o wallpaper por 0,6 s sobre o
VAZIO, que é **preto**, e o `instantCover(computeCover())` do fim o recolocava.
Do lado de quem opera, descobrir o telão sem mídia nenhuma **"piscava preto e
voltava"** — uma reação forte para um botão que ali não muda nada do que está
projetado. Só a direção `wallpaper → visual` sofria: na oposta, `coverIn` já
voltava cedo por `coveredNow`.

A exceção é o parâmetro **`overlay`** (`stage.handle({ type:'view', overlay:true })`),
que o Display passa quando o cartão de texto está no ar: ali existe uma camada
por cima do stage, descobrir revela alguma coisa, e o fade tem de acontecer. O
stage sozinho não tem como saber disso — ele só enxerga o que ele mesmo desenha.

---

## Controle

### Modos de uso: "Modo Fácil" (padrão) × avançado

> **O nome na TELA é "Modo Fácil"** desde a v5.104 — antes era "Modo
> simplificado", o texto mais longo do cabeçalho, e encurtá-lo foi o que abriu
> espaço para o botão de Favoritos ganhar rótulo ali. No CÓDIGO o modo continua
> sendo `'simple'` (a classe `mode-simple`, o `appMode`, o `data-mode`): trocar
> a string interna não mudaria um pixel e esbarraria em dezenas de referências
> — a mesma razão pela qual a aba de Ferramentas segue com `activeTab === 'mic'`.

O app atende duas pessoas diferentes. Uma abre o celular para **conectar a
tela e tocar um louvor**; a outra opera o culto inteiro — Cronograma, álbuns,
Bíblia, Camada de Texto, playlist, letra sincronizada, microfone. A tela que
serve bem à segunda é excessiva para a primeira, e esconder recursos atrás de
uma configuração só empurraria a escolha para um lugar onde ninguém procura.

**O app abre no simplificado sem perguntar nada** — e, desde a v5.66, no
ÚLTIMO modo usado, para quem já escolheu. A versão anterior
(v5.23) mostrava um seletor de modo na abertura; ele saiu porque cobrava um
toque de todo mundo — inclusive de quem nem sabia que havia dois modos — antes
de mostrar qualquer coisa útil, e o caso comum é justamente o simplificado.
A classe `mode-simple` **já vem no `<body>` do HTML** (e `.open` no
`#simpleMode`), então a tela certa aparece sem esperar JS ou IndexedDB — era o
mesmo motivo pelo qual o seletor nascia visível no documento.

O **modo avançado** fica a um toque, no botão do cabeçalho ("Modo avançado"), e
**a volta é o mesmo botão ao contrário**: `#fullSimpleBtn` ("Modo simplificado"
— o rótulo completo, igual ao da ida; "Simplificado" sozinho, na v5.51, nomeava
o destino sem dizer que ele é um MODO, e o par só se lê como par quando as duas
metades falam a mesma língua), no
mesmo canto do cabeçalho da lista, mesmo componente (`.mode-switch`), seta
apontando para o outro lado. Até a v5.48 a volta só existia no segmento **Modo
do app** do popup de Exibição — hoje **Configurações** — (`#appModeSeg`, que
continua lá): quem tocasse em
"Modo avançado" por curiosidade caía na mesa de som completa e a saída estava
atrás de uma engrenagem sobre a preview — um caminho que ninguém adivinha. Sair
tem de custar o mesmo tanto que entrar.

#### O modo é LEMBRADO entre aberturas (v5.66)

A escolha valia só para a sessão, e o argumento era que quem abre o app hoje
pode não ser quem abre no próximo culto. Ele não se sustentou: o app é do
aparelho da igreja, e quem opera o culto TODA semana escolhia o avançado toda
semana. Um app que esquece uma preferência explícita a cada abertura cobra o
mesmo par de toques para sempre. O simplificado continua sendo o padrão — de
quem **nunca escolheu nada**, que é o caso que o argumento original de fato
descrevia.

O risco do outro lado (cair no avançado sem querer e reabrir nele) custa um
toque no "← Modo simplificado" do cabeçalho, que é o par visível do botão que
levou até lá (v5.49) — e é justamente por isso que aquela volta existe.

- **Fica em `localStorage`** (`av.appMode`), e não no IndexedDB como TODO o
  resto do estado. O motivo é único e decisivo: esta chave precisa ser lida
  **antes do primeiro quadro**. O `<body>` nasce `mode-simple` para a tela certa
  aparecer sem esperar JS, e uma leitura do IDB é assíncrona — ela volta depois
  de o app já ter pintado o simplificado, e quem tivesse deixado o avançado veria
  a tela errada trocar embaixo do dedo, no meio do primeiro toque.
  `localStorage` é síncrono e mora no mesmo `app_webview/` do IDB: mesma
  durabilidade, mesma regra de backup, some junto numa desinstalação.
- **UMA fonte, não duas.** Gravar nos dois lugares "por garantia" só cria o dia
  em que eles discordam e ninguém sabe qual vale.
- **A restauração é em duas metades.** No TOPO do `controle.js` vai só a
  pintura — a classe do `<body>` e o `.open` do `#simpleMode` —, que é a única
  parte que não pode esperar. O resto (`setAppMode(appMode)`) roda no `init()`,
  **depois do `load()`**: no avançado ele posiciona o vazado da faixa de abas
  (`moveTabIndicator`), e medir a faixa antes de `load()` desenhá-la daria zero.
- **A armadilha que isto criou:** havia um `setAppMode('simple')` literal no
  fim do módulo, para "fechar o ciclo com o HTML". Com a persistência ele passou
  a reescrever o `localStorage` para `simple` em toda abertura, e o avançado
  nunca sobrevivia a fechar o app — invisível na leitura do diff, porque a tela
  ainda pintava certo até aquela linha rodar. Hoje é `setAppMode(appMode)`.
- **`localStorage` pode LANÇAR** (armazenamento bloqueado). Leitura e escrita
  ficam em `try`; o padrão do app é o simplificado, então o `catch` já é a
  resposta certa e não há o que tratar.

**A seta não é enfeite**: o rótulo sozinho nomeia um destino sem dizer que o
toque TROCA de tela. Com ela o par se lê como ida e volta, que é o que ele é.

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

**Sem contorno, desde a v5.76.** As teclas (e a caixa da letra) tinham um
filete em `--line` "para parecer botão físico" — uma ideia de que o resto do
app já tinha desistido: cards, teclas e linhas de lista são superfícies sólidas.
Numa tela em que TUDO é tecla o filete não distinguia nada, só devolvia a grade
de molduras que a v5.71 tirou do acervo. Quem diz "isto é tocável" aqui é o
fundo mais claro que o do app e o `:active` que afunda. Os dois estados da tecla
grande (mudo, áudio bloqueado) já eram fundo-suave + cor e continuam legíveis
sem a borda — o mudo, aliás, passou ao vermelho **saturado**.

| Elemento | O que faz |
|---|---|
| **Conectar a tela** (`#simpleCastBtn`) | `AVNative.openCast()` — o seletor de espelhamento do Android. **Só existe SEM tela conectada**, e ali é o único botão da tela (ver o bloqueio abaixo); conectado, ele dá lugar à preview. No navegador vira o atalho para a tela do Display |
| **Preview** (`.simple-stage`) | a projeção em miniatura, **só com tela conectada** — ver "A preview no lugar do botão de conectar" |
| **Buscar música** (`#simpleSearchBtn`) | o MESMO popup de busca do acervo (`openHymnSearch`). Um toque na linha **toca a versão Cantada direto** (ver abaixo) |
| **Linha do tempo** (`#simpleTime`) | decorrido · barra · duração, só LEITURA — espelha a mesma `#seek` do modo avançado (que já é alimentada pela preview, pelo `display-status` e pelo polling do YouTube) e some quando o item não tem duração |
| **Letra** (`#simpleLyrics`) | a letra INTEIRA da música em cena, com o mesmo destaque e o mesmo acompanhamento da leitura auxiliar do modo avançado |
| **Play/pause, parar e mudo** | `.click()` em `#playpause` / `#stop` / `#muteToggle`. O **parar** entrou na v5.72, ao lado do play: é a outra metade do transporte, e sem ele tirar a mídia do telão obrigava a ir ao modo avançado — justamente o que se faz no fim de cada louvor. A fileira passou a ter três colunas |
| **Volume** (`#simpleVolDown` / `#simpleVolUp`) | teclas **−** e **+** com o número no meio (`.simple-vol-read`), não um slider |
| **Modo avançado** (`#simpleFullBtn`, `.mode-switch`) | `setAppMode('full')` — a tela completa de sempre. Era texto `--muted` sobre `--surface`: dentro do mínimo de contraste, mas lido como **legenda**, não como botão. Desde a v5.40 é texto pleno (`--text`) sobre `--surface-2` — **7,03:1** na paleta atual — e desde a v5.49 leva a **seta** e divide a classe `.mode-switch` com o gêmeo do modo avançado (`#fullSimpleBtn`). **A borda em `--accent` saiu na v5.76**: ela desenhava, nos dois cabeçalhos, a moldura mais forte da tela em volta do botão que menos se usa num culto — trocar de modo é decisão de configuração, não de operação. Quem separa o botão do fundo é a superfície; o accent ficou onde informa, na seta, que é o que diz para que lado se vai |

**Sem escolha de variante.** No simplificado o toque na linha da busca — e o
toque no ▶ dela — chamam `simplePlaySong()`, que toca o **Cantado** e pronto:
abrir a folha com cantada/playback/só a letra seria devolver ao operador
exatamente a decisão que este modo existe para poupar. O botão de adicionar some
(`body.mode-simple .hymn-add-btn`), porque playlist, Cronograma e favoritos são
do fluxo do sonoplasta; no modo avançado a mesma linha continua abrindo a letra
em acordeão.

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
  preenchido no accent (`--accent-fill`, ícone de 44px). Ele
  não podia continuar sendo a mesma tecla escura das outras: a única ação
  possível da tela não disputa atenção com o teclado embaçado atrás dela.
  **Sem halo desde a v5.75**: havia um `box-shadow` em `--accent-glow` para
  "separar o botão do fundo", mas quem separa é a CORTINA — o `backdrop-filter`
  já apaga tudo atrás, e o botão é a única coisa nítida e a única preenchida da
  tela. O halo não resolvia leitura nenhuma, só espalhava luz âmbar num salão
  escuro.
  **Ali ele é ícone e UMA frase** — "Toque para conectar uma tela" — e nada
  mais: o subtítulo repetia o rótulo e a mensagem que havia acima dele dizia
  pela terceira vez a mesma coisa, três textos para uma tela com uma ação só.
  Com tela conectada o rótulo volta a nomear a ação ("Conectar a tela") e o
  subtítulo volta a informar QUAL tela, que aí é notícia.
- **Modo avançado** (`#simpleFullBtn`), no cabeçalho. **Sem TV o app não fica
  inútil** — a projeção passa a ser a preview em tela cheia —, e trancar essa
  saída transformaria a falta de telão numa parede. O que se bloqueia é o modo
  simplificado, não o app.

**E não há mensagem separada.** Houve uma (`.simple-gate-msg`, pendurada acima
do botão); ela saiu porque a tela passou a ter **um texto só**: com o botão
dizendo "Toque para conectar uma tela", uma legenda por cima repetia o que o
próprio botão já dizia. Sem ela, `.simple-actions` pode simplesmente centralizar
o que sobrou — o botão fica no meio exato, sem ninguém precisar medir a altura
de um para posicionar o outro.

#### A preview no lugar do botão de conectar (v5.71)

Conectado, não há nada melhor a dizer sobre "está conectado?" do que **mostrar o
que a TV está exibindo**. O botão de conectar sai e a preview ocupa **a célula
dele** na grade de ações — mesma largura, mesma linha, ao lado de "Buscar
música", que continua onde sempre esteve. Os dois nunca coexistem, então
dividir a célula é o certo: a faixa segue com as duas colunas de sempre e nada
no resto da tela se move.

A preview não tem altura própria ali: a largura é a da coluna e a altura vem da
**proporção do telão**, que é o ponto de ela existir. Como a 16:9 nessa largura
ela sai um pouco mais baixa que a tecla ao lado (83px contra 94px, num aparelho
de 390px), a grade a centraliza verticalmente na célula — as bordas laterais
das duas ficam alinhadas, que é o que se vê. Esticá-la para preencher os 11px
que faltam custaria a fidelidade da proporção, e é justamente ela que faz a
miniatura valer como espelho do telão.

O ícone de **cast no canto** da preview faz os dois papéis que sobraram:

- **é a saída, e a cor diz isso** — conectado ele fica **vermelho**
  (`--danger-text`), porque ali o toque DESCONECTA. Quem já diz que há uma tela
  recebendo é a própria preview, que só existe aqui quando há; o que sobra para
  o ícone dizer é o que o toque faz. Vermelho **contornado** (a família de ação
  destrutiva) e nunca o `--danger` cheio: preenchido, o vermelho deste app
  significa "está no ar agora", e competiria com a mídia que a miniatura está
  justamente mostrando. Ele abre o seletor do Android, que é onde se troca de
  tela ou se desconecta; desconectado, `onDisplayChange` rebaixa a cortina
  sozinho e o botão de conectar volta ao centro, pelo caminho que já existia;
- **âmbar (`--warn`) na liberação de teste** — ali não há tela para desconectar,
  e o que o toque faz é trancar de volta.
- Na **liberação de teste** o toque simplesmente TRANCA de volta: não há tela
  real para desconectar, e o botão que hospedava o "segurar 5 s" some justamente
  quando a liberação fica ativa, porque a preview toma o lugar dele.

**A tela cheia (`#pvFullBtn`) não aparece aqui**: neste modo existe um telão
conectado — é o que faz esta faixa existir — e a projeção está nele.

**O nó da preview é O MESMO do modo avançado**, movido de um pai para o outro
(`hostPreview`), pelo mesmo padrão do `#selbar` e do `<input type=file>`: duas
previews divergiriam no primeiro ajuste, e dois `createStage` decodificariam o
MESMO vídeo duas vezes num aparelho que já roda dois WebViews. Três detalhes
que a mudança de pai obriga:

- **A troca acontece só na mudança de MODO**, não ao conectar/desconectar. Com
  a tela bloqueada a faixa some por CSS (`.simple.locked .simple-stage`), e um
  `display:none` não custa nada.
- **Um `<video>` sobrevive à mudança de pai**; um **iframe, não** — ele recarrega
  e leva o player do YouTube junto. Por isso `hostPreview` remonta a preview do
  YouTube depois de mover, e **no segundo em que ela estava**: `loadYtPreview`
  ganhou um `startAt`, mesmo nome e mesmo papel do `startAt` de `loadYoutube` no
  Display. Sem ele a miniatura voltaria ao início de um vídeo que segue tocando
  no telão.
- **`appendChild` de um nó já anexado é remoção e inserção atômicas**, então o
  "removido do documento" que pausaria o vídeo nunca chega a valer.

**E o cartão de "Baixando…" aparece aqui também** — é a mesma preview, então é o
mesmo `previewBusy`. A única condição que mudou: ele volta `visivel: false` no
simplificado **sem tela conectada**, quando a preview não está na tela e quem
avisa continua sendo o toast. O cartão foi desenhado para a preview do deck, que
é quase o dobro desta, então `.simple-stage` reduz as medidas dele (anel de
22px, fontes menores) e reserva à direita os 38px do `.pv-fab` — sem isso ele
transbordava a miniatura e passava por baixo do ícone de cast, que numa caixa de
~83px de altura cruza a faixa central onde o cartão fica.

**A única parte que muda por contexto é quem responde "há tela?"** — o resto do
mecanismo é o mesmo nos dois. No app são as telas de apresentação que a ponte
lista (`AVNative.displays()` + `onDisplayChange`), então o dongle que cai
rebaixa a cortina e o que volta a levanta, pelo caminho que já existia. No
navegador não existe `Presentation`: vale a **janela do Display** que o próprio
botão abre (`openWebDisplay`), e fechá-la equivale a desconectar. Como não há
evento de "janela fechada", um relógio de 1 s olha o `closed` — e ele só existe
enquanto a janela existe.

#### Liberação de TESTE: segurar 5 s o botão de conectar (v5.49)

Sem telão à mão **não há como olhar esta tela destravada** — e ela é a tela que
o app abre, ou seja, a que mais precisa ser vista enquanto se mexe no desenho
dela. Segurar `#simpleCastBtn` por **5 s** (`CAST_HOLD_MS`) destrava como se
houvesse tela conectada. Para **trancar** de volta basta um toque no ícone de
cast da preview (v5.71): o botão que hospedava o gesto de 5 s some assim que a
liberação fica ativa, porque é a preview que toma o lugar dele.

- **`castTestUnlocked` entra por `simpleDisplay()`**, que passa a devolver um
  descritor marcado (`{ name: 'Modo de teste', test: true }`). Um ponto só, e é
  o mesmo que a cortina, o rótulo do botão e o modo simplificado inteiro já
  consultavam — nada mais no app precisou saber que existe um modo de teste.
- **Não finge conexão.** O botão — e, destravado, o ícone de cast da preview —
  fica em `--warn` (`.simple-action.testing`/`.pv-fab.testing`),
  **nunca** no verde de `.connected`, e o subtítulo diz "Liberado para teste"
  (o subtítulo é de UMA linha e corta com reticências, então cabe o estado; a
  instrução de sair vai no `title`).
  Verde ali significaria uma TV recebendo a projeção, e não há nenhuma: quem
  pegar o aparelho nesse estado lê na tela o que está acontecendo em vez de
  procurar a tela que "conectou" sozinha.
- **A espera tem sinal.** 5 s sem resposta nenhuma é indistinguível de um toque
  que não pegou, então uma barra corre no pé do botão enquanto o dedo estiver
  lá (`.simple-key--holding::after`, `animation-fill-mode: forwards` — quem
  completou vê a barra cheia no instante em que a tela destrava).
- **5 s é longo de propósito**: o botão é a ÚNICA ação da tela bloqueada, e um
  limiar curto faria um toque hesitante virar um destravamento que ninguém
  pediu. O `holdFired` impede que o `click` seguinte abra o seletor de
  espelhamento por cima da tela recém-destravada.
- **Não é persistido**: cada abertura do app volta ao comportamento normal.

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
│  [← Modo Fácil]   CRONOGRAMA        [★ Favoritos]       │ ← .list-header (topo; sem appbar)
│    (o Modo Fácil fica VAGO nas outras abas — v5.111)     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  item 1                                           │  │  ← .lib-list
│  │  item 2                                           │  │     (área scrollável)
│  └───────────────────────────────────────────────────┘  │
│  [        + Importar arquivos        ]                  │ ← #listFoot (fixo, não rola)
│   ↑ na seleção múltipla, a #selbar ocupa esta mesma fatia │
├─────────────────────────────────────────────────────────┤
│ [Cronograma] [Bíblia] [Ferramentas] [🔍]                │  ← .tabs (dentro da barra)
│  ┌─────────────────────────────────────┬──────┐         │  ← .bottombar (base fixa)
│  │  Nome da mídia atual  [seek bar]    │ Cfg  │         │
│  │─────────────────────────────────────│ Wall │         │
│  │    Preview (proporção do telão)     │ Letra│         │
│  │─────────────────────────────────────│ Mudo │         │
│  │  🔁  ⏮  ▶/⏸  ⏹  ⏭  [Playlist]    │ Vol  │         │
│  └─────────────────────────────────────┴──────┘         │
│  [margem segura para navegação por gestos]              │
└─────────────────────────────────────────────────────────┘
```

**Sem barra de topo (`.appbar` removida):** o app começa direto no cabeçalho da
lista. `main` ganhou `padding-top` com `env(safe-area-inset-top)` (a antiga
appbar cuidava do notch/status bar).

**Cabeçalho da lista (`.list-header`):** QUATRO elementos, e a ordem é **saída ·
lugar · destino** (v5.107):

| Posição | Elemento | Papel |
|---|---|---|
| esquerda | `#backBtn` (só na navegação da Bíblia) + `#fullSimpleBtn` (**só no Cronograma**) | sair — desta tela, ou do modo |
| centro | `#listTitle` (`.list-title`) | onde eu estou |
| direita | `#favHeadBtn` | ir para os Favoritos |

**A troca de modo só existe no Cronograma** (v5.111, em `renderListTitle`). Ela
é a saída do modo avançado, e sair de um modo pelo MEIO dele — da grade de
livros da Bíblia, de dentro do sorteio — é pular dois degraus de uma vez. O
Cronograma é a tela inicial e é onde o voltar desemboca (a escada de `__avBack`
termina em "aba diferente do Cronograma → volta para ele"), então quem quer o
Modo Fácil já passa por ali de qualquer jeito; nas outras abas o botão era
sobretudo um alvo grande do lado esquerdo esperando um toque errado. Com a
gaveta de Favoritos aberta ele CONTINUA visível: o `activeTab` é `'folders'`,
mas a tela atrás da gaveta é o Cronograma.

Ele fica **vago, não removido** (`.mode-switch--vago`, `visibility: hidden`): a
caixa reservada é o que segura o título no mesmo lugar em todas as abas —
medido, o centro dele não sai de 212px numa tela de 412. Com `display: none` o
título pularia ~60px para a esquerda a cada deslize entre abas, e um nome de
tela que muda de lugar é o oposto do que ele existe para fazer. `visibility`
já tira o botão do toque, do foco e do leitor de tela.

Os dois botões ficam em cantos OPOSTOS porque levam a lugares opostos:
empilhados do mesmo lado (como estavam até a v5.106) liam-se como um par, e não
são. O botão de modo foi para a esquerda porque **a seta dele aponta para a
esquerda**, e um botão que aponta para fora da tela precisa estar do lado para
onde aponta — encostado à direita, ele apontava para o meio do próprio
cabeçalho. Por isso o `margin-left: auto` saiu do `.mode-switch` e passou a
valer só dentro da `.simple-head`, onde o botão é a seta INVERSA e continua à
direita.

O título é `.84rem` desde a v5.51 (em .72rem o único texto que responde "onde eu
estou" era menor que o subtítulo de qualquer linha da lista) e é centrado no
**espaço que sobra**, não na tela: os dois botões não têm a mesma largura, e
centrá-lo pelo eixo da tela exigiria tirá-lo do fluxo e arriscar sobreposição
justamente com o nome comprido de uma pasta. A folga que resta é de poucos
pixels. Em 360px "CRONOGRAMA" sai com reticências — a mesma troca já assumida
para a raiz dos Favoritos, e em 390px (e em qualquer outra tela do app) ele cabe
inteiro.

A faixa já teve seis: o campo de busca da pasta e o botão de sincronizar
**foram com os Favoritos para a gaveta** (v5.53) e o indicador de versão desceu
para Configurações (v5.49). Eram esses três que faziam dela a faixa mais
disputada do app — e o sintoma era objetivo: numa tela de 360px a raiz dos
Favoritos cortava o próprio título com reticências. O
**indicador de versão** morava aqui e foi para o rodapé de Configurações na
v5.49: o cabeçalho é navegação, o texto completo (`Web vX · Shell vY`) comia
quase metade da largura de um celular, e ele só aparecia numa das abas — o mesmo
metadado existindo ou não conforme a tela. Com a faixa liberada, a **aba Bíblia
voltou a ter título** (v5.50): ela era a única tela sem nome, e o título tinha
saído justamente para caber a versão — "onde eu estou" passava a depender de
reconhecer a grade de 66 ladrilhos.

**Controles (`.bottombar`):** fixados na base da tela, e desde a v5.54 eles
**começam na faixa de abas**: a barra é um `flex` em coluna com dois filhos — a
`.tabs` e o `.deck`. (A `.selbar` já morou aqui, no lugar da `.tabs`; desde a
v5.107 ela é do rodapé da lista, e a faixa de abas nunca mais some.) A
faixa era o último elemento do `<main>` e flutuava sobre o fundo do app,
encostada na barra mas separada dela por dois espaços (o `padding-bottom` do
main mais o `padding-top` da barra) e por um degrau de cor — duas superfícies
para duas coisas que o polegar usa no mesmo movimento. Juntas viram um bloco
só: mesma cor de fundo, mesma borda de cima, mesma sombra, e o trilho do
segmentado passa a ter exatamente a mesma superfície dos botões de transporte
logo abaixo (`--surface` é branco com ALFA, então acompanha a base nova
sozinho — o degrau vai de 1,38:1 sobre o fundo do app para 1,46:1 sobre a
barra). Ela **não tem mais `border-top` nem sombra** (v5.55 e v5.57): com a
fileira encostada no topo, as duas caíam justamente sobre a emenda entre a aba
ativa e o conteúdo, que é onde os dois precisam ser a mesma superfície. O `padding-bottom` da barra usa
`max(env(safe-area-inset-bottom), 12px)` para garantir margem segura contra
acionamentos acidentais pela navegação por gestos do Android/iOS.

**Grade real (CSS Grid), não flex aproximado:** `.deck` é um `display:grid` de
2 colunas (`minmax(0, 1fr)` / `56px` do mixer) × 3 linhas (`auto` /
`var(--deck-pv-h)` do preview / `auto`), com `.nowplaying`, `.preview-row` e
`.transport` como itens diretos
da grade (não há mais um `.deck-main` intermediário). O `#mixer` ocupa as 3
linhas (`grid-row: 1 / 4`) e usa `grid-template-rows: subgrid` para **herdar
exatamente essas mesmas 3 faixas de altura** — garante alinhamento pixel a
pixel entre a coluna do mixer e nowplaying/preview/transport, em vez de
depender de flex-basis calculado à parte (a fonte de um desalinhamento
antigo entre as duas colunas). `padding` do `#mixer` é **só horizontal** (`0
.35rem`): padding vertical deslocaria as linhas herdadas do subgrid,
reintroduzindo o desalinhamento.

A primeira coluna é `minmax(0, 1fr)`, **não** `1fr`: uma faixa `1fr` tem mínimo
automático igual ao min-content do conteúdo, e o título (`#npName`, com
`white-space: nowrap`) tem min-content do texto INTEIRO mesmo já sendo cortado
por `overflow`/ellipsis. Um nome de mídia longo inflava a coluna, esmagava a de
56px do mixer e fazia a largura da preview depender do título.

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
| `.mixer-top` | 1 (mesma de `.nowplaying`) | **Configurações** (`#settingsBtn`, engrenagem — `openFadePopup`), **sem caixa de botão** |
| `.mixer-mid` | 2 (mesma de `.preview-row`, `--deck-pv-h`) | **letra/texto completo** (`#lyricsViewBtn`, ícone de **folha com linhas** — SVG inline; abre a leitura auxiliar), **cortina do telão** (`#viewToggle`), **mudo** (`#muteToggle`) — empilhados, cada um com `flex:1` |
| `.mixer-bottom` | 3 (mesma de `.transport`) | **volume** (`#volToggle`/`#volClose`, recolhível) |

A coluna foi reorganizada na v5.49, quando a **mesa de som** deixou de ter botão
aqui (virou uma linha de Configurações — ver a seção dela) e o lugar vago virou
a porta de **Configurações**. A ordem que sobrou separa o que NÃO opera o culto
do que opera: a engrenagem no topo, sozinha, e abaixo dela o bloco de operação
(cortina → letra → mudo → volume), que é o que o polegar procura sem olhar.
Antes a mesa de som ficava no MEIO desse bloco, entre a leitura da letra e o
mudo, sendo a única ali que se decide uma vez e não se toca mais.
Dentro da fatia do meio a **leitura da letra vem primeiro** (v5.50, trocou de
lugar com a cortina): é o botão que se consulta o tempo todo enquanto o louvor
corre, e a cortina serve às transições — o mais frequente fica mais perto do
topo, onde o polegar já está.

**A engrenagem não tem caixa de botão** (`.settings-btn`, e por isso não é
`.ctl-btn`): a fatia do topo acompanha a altura de `.nowplaying`, que é bem
menor que a da preview, e um bloco achatado ao lado de quatro botões de altura
cheia lê como um botão mal encaixado. Sem a caixa, o ícone solto deixa de
competir com o grupo que opera o culto — que é justamente o que ele não é. É o
mesmo tratamento do `#backBtn` do cabeçalho: navegação/acesso é chapado,
operação é botão.

Cada botão tem `flex:1` dentro da própria fatia — top (1 botão) e bottom (1 de
cada vez) preenchem a fatia inteira; mid (3 botões) a divide em partes iguais.

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
(`@keyframes vol-slide-in/out`). O botão de volume é **preenchido em `--accent-fill`
com o ícone de mixer/faders em `--on-accent`** (SVG inline — o ícone não
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
(`--fader-cap`, 26px), então a conta desconta isso e a borda do preenchimento fica
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

**A linha da preview é só a preview** desde a v5.49: os dois botões de estrofe
que a flanqueavam (`#slidePrevBtn`/`#slideNextBtn`) saíram da tela e viraram o
toque curto em ⏮/⏭ — ver "Um par de botões, dois eixos" logo abaixo. Com a linha
livre, `--deck-pv-h` subiu de 130px para 150px: a preview é dimensionada pela
ALTURA (altura × `--pv-ar`), então a largura que os botões ocupavam teria virado
espaço morto dos dois lados dela. Em 150px o 16:9 dá ~267px numa coluna de
~291px, e a janela do operador para a projeção cresce junto. O botão de
**repetir** (`#repeat`) é o **primeiro** de `.transport` (à esquerda de ⏮ ▶/⏸ ⏹
⏭, com o de playlist por último à direita).

#### Um par de botões, dois eixos (⏮/⏭, v5.49)

Até a v5.48 a tela tinha **quatro** botões para duas ações vizinhas: estrofe
(flanqueando a preview) e mídia (no transporte). Quatro alvos disputando a mesma
faixa estreita — e os de estrofe passavam a maior parte do culto **desabilitados**,
porque sem letra, versículo ou mensagem no ar eles não fazem nada.

Agora é **um par**, com os eixos separados pelo TEMPO do toque
(`attachTransportStep`):

| Toque | O que faz |
|---|---|
| **curto** | o eixo da CENA: passa estrofe quando há estrofe a passar (letra, versículo ou mensagem no ar); passa de mídia quando não há |
| **longo** (`LONGPRESS`, 450 ms) | **sempre** mídia — a saída para trocar de música com uma letra em cena |

- **Quem decide o eixo é `slideTarget()`**, a MESMA função que a notificação
  nativa consulta (`slideMode` em `pushNowPlaying`) e que os gestos da tela
  cheia já usavam. A regra existia em um lugar só e continua assim.
- **Quem executa continua sendo `#slidePrevBtn`/`#slideNextBtn`**, agora ocultos
  no DOM (`.slide-anchor`): é neles que `applySlideLimits` guarda "dá para
  passar estrofe agora?", e um botão `disabled` é um no-op natural. O gesto da
  tela cheia e a notificação seguem chamando `.click()` neles, sem saber de
  nada. Tirá-los do DOM obrigaria a espalhar essa regra por quatro chamadores.
- **O limiar é o mesmo `LONGPRESS` dos itens da biblioteca**: dois tempos
  diferentes para "segurar" no mesmo app seriam duas coisas para o dedo
  aprender. O toque longo age **ao vencer o prazo**, não ao soltar — segurar e
  ver a música trocar é a resposta que o dedo espera —, e o `click` seguinte é
  descartado por uma flag, para a ação não sair duas vezes.
- **O botão diz em que eixo está** (`renderTransportAxis`): contorno em
  `--accent` (`.slide-mode`) e o `title` nomeando estrofe/versículo/mensagem/
  página. Na notificação esse papel é do rótulo; aqui não cabe rótulo, e sem
  sinal nenhum o eixo só se descobriria depois de tocar — errar isso no meio de
  um louvor custa a música inteira.
  - **As três tabelas de rótulo (`SLIDE_AXIS_NAME`/`_PREV`/`_NEXT`) precisam
    cobrir TODOS os alvos de `slideTarget()`.** Elas são indexadas pelo alvo, e
    um alvo ausente não dá erro: vira `undefined` e o `title` passa a dizer
    literalmente "undefined · segure para a próxima mídia". Faltavam `deck`
    (desde a v5.97) e `songlyrics` até a v5.102 — justamente o alvo em que ⏮/⏭
    são o ÚNICO jeito de passar página. Alvo novo em `slideTarget()` = três
    linhas novas aqui.
- **E diz quando o eixo ACABOU** (`.axis-end`, opacidade .55): na última estrofe
  o toque curto não tem para onde ir. Antes isso era óbvio, o botão de estrofe
  ficava cinza; como o mesmo botão ainda serve à mídia no toque longo, ele não
  pode ser `disabled` — esmaecer entrega a mesma leitura sem tirar a outra
  metade do ar.

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

**Controles sobre a preview** (`#pvFabs`, `setupPreviewGestures`): **dois**
ícones, um em cada canto da direita — **cast em cima, tela cheia embaixo** —,
sempre visíveis (ver "Layout de player", abaixo). Cada um ocupa uma caixa de
`--hit`, e o tamanho do ícone vem do CSS (`24px`), não do atributo do `<svg>`.

Passaram por três arranjos antes deste — e os dois primeiros foram **com quatro
botões**, que é o detalhe que explica por que eles não valem como precedente
contra o atual. Um **em cada canto**: dispersos, o olho procurava cada um num
lugar diferente, e um deles tampava a parte da miniatura onde costuma estar o
texto projetado. Uma **fileira na base**: sobrava vazio dos dois lados, já que
quatro botões não chegavam perto da largura da preview. Uma **coluna de vidro à
direita**, cada botão `flex:1` pela altura toda: com quatro, era a única forma
que cabia; com dois, virou uma barra de ferramentas grande demais para o que
tinha dentro.

Com **dois**, o canto voltou a ser a resposta certa (v5.67), e sem os dois
problemas de antes: não há dispersão com dois alvos na mesma borda, e o de cima
é o cast — não um botão qualquer no meio do caminho do texto, mas o mesmo canto
que todo player usa.

| Ordem (de cima) | Botão | Ação |
|---|---|---|
| 1 | `#pvCastBtn` (cast) | seletor de espelhamento do Android (`AVNative.openCast()`) — **só no app nativo**; oculto no navegador |
| 2 | `#pvFullBtn` (expandir) | **tela cheia** da preview (`requestFullscreen` + trava de paisagem) |

> Eram **três**: a engrenagem (`#pvSettingsBtn`) abria o popup de Exibição.
> Saiu na v5.49, quando Configurações ganhou um botão fixo no topo do mixer —
> duas portas para a mesma tela, uma delas escondível por um toque na preview,
> é espaço gasto sem informação nova (o mesmo argumento que aposentou a aba de
> Álbuns na v5.44). E uma **configuração** que some com um toque acidental na
> miniatura é a que ninguém acha.

> Havia um quarto (`#pvMsgBtn`, mensagem na tela). Ele saiu na v5.31: Mensagens
> virou uma seção da aba **Ferramentas**. Enquanto era a única ferramenta avulsa o
> FAB se justificava; com três delas, ter uma em cima da preview e duas numa aba
> era a mesma pergunta ("que aviso eu ponho na tela?") respondida em dois
> lugares — e o espaço sobre a preview é o que menos sobra.

São a única indicação de que essas ações existem, e a preview fica na base da
tela o tempo todo; escondê-los por omissão devolvia o problema dos gestos
invisíveis que eles substituíram (toque = tela cheia, toque longo = popup), que
nada na tela anunciava.

#### Layout de player: os cantos, sem moldura, permanentes (v5.67)

Eram dois retângulos de vidro (`--glass-bg` + borda + `backdrop-filter`)
**empilhados numa coluna** à direita, ocupando a altura inteira da miniatura em
partes iguais. Isso é desenho de barra de ferramentas, e ele compete com a
imagem justamente onde ela é pequena. Hoje são **só ícones**, um em cada canto
da direita: **cast em cima, tela cheia embaixo** — onde todo player os põe, e
fora do caminho do que está projetado.

- **A caixa continua sendo `--hit`** (o piso de alvo de toque do app). O que
  sumiu foi a moldura, não o alvo.
- **A tela cheia vai ao rodapé por `margin-top: auto`**, não por
  `justify-content: space-between`: no navegador o cast nem existe (`[hidden]`),
  e com um item só o `space-between` o jogaria de volta para o topo — o botão
  trocaria de canto conforme o contexto.
- **A legibilidade virou problema do ícone**, e a resposta é uma `drop-shadow`
  tripla no `<svg>`: ela acompanha o TRAÇO (uma `box-shadow` sombrearia a caixa
  vazia do botão). Duas sombras coladas e quase opacas empilham-se num contorno
  escuro — é o que salva o ícone branco sobre um slide branco, onde não há
  contraste nenhum —, e uma terceira, larga e difusa, o descola de uma textura
  movimentada. Contorno por sombra, e não `paint-order: stroke`, porque estes
  SVGs são desenhados a traço (`fill: none`) e não há preenchimento em volta do
  qual pintar um contorno. Os tokens `--glass-bg`/`--glass-line` saíram da
  paleta junto com a moldura: ninguém mais os usava.
- **O toque na preview não os esconde mais.** Esconder era resposta ao desenho
  errado — a coluna de vidro de fato tampava a miniatura. Sem ela não há o que
  atrapalhar, e o que sobrava era um estado escondido: uma preview sem botão
  nenhum não anuncia que basta tocar nela para trazê-los, que é o problema dos
  gestos invisíveis de volta, com um passo a mais. Errar o alvo por 2px também
  deixou de custar caro: antes o toque caía no reconhecedor de gestos e sumia
  com a coluna inteira, obrigando a tocar de novo só para recuperá-la. Fora da
  tela cheia a preview passou a **não ter ação própria**.

Ficam **sempre ocultos em tela cheia** (`.preview:fullscreen .pv-fabs {
display:none }`): sem TV conectada, a tela cheia É a projeção, e um botão
sobreposto iria junto para o telão. `.pv-fabs` é `pointer-events:none` (só os
botões recebem toque), senão a coluna cobriria parte da preview e o toque nunca
chegaria ao reconhecedor de gestos.

A **tela cheia** (`requestFullscreen` no `#preview` + `screen.orientation.lock
('landscape')`, permitida só já em fullscreen — padrão de player de vídeo,
destravada no `fullscreenchange`) é a **projeção quando não há telão
conectado**. CSS: `.preview:fullscreen` preenche a tela (cantos retos, sem
borda, `touch-action:none`; as camadas internas já são `inset:0` +
`object-fit`). O popup de **Configurações** (`#fadePopup`, aberto pelo
`#settingsBtn` no topo do mixer) guarda o **modo do app** (`#appModeSeg`), a
o seletor de **preenchimento da mídia**
(`#fitSeg` — Ajustar/Preencher/Esticar, ver `stage.setFit()`), as **imagens dos
slides** das músicas (`#lyricsBgSeg` — Mostrar/Remover, ver "Fundo preto vs.
imagens dos slides"), o **wallpaper do telão** e, no rodapé, o **estado do
telão**, o alvo de espelhamento e a **versão**. Chamava-se "Exibição" enquanto
guardava só como o telão se PARECE; com a mesa de som vinda do mixer, o que
reúne as linhas passou a ser "o que se decide uma vez, ao montar o culto" —
aparência do telão E roteamento do áudio. Nenhuma delas se opera durante o
culto, que é o critério de estar aqui e não na coluna do mixer. O `id` segue
`fadePopup` por herança (os controles de fade que lhe deram o nome saíram há
versões): renomeá-lo tocaria dezenas de referências sem mudar nada visível. As
transições (fade) **não têm controle ali** — são inerentes ao sistema (ver o
state `fade`).

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
gradiente padrão — em **Configurações** (engrenagem no topo do mixer):
*Escolher imagem* / *Padrão*.

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
`count - 1`), e o ícone só fica destacado em `--accent` (`.has-items`) nesse mesmo
caso: com apenas a mídia atual em fila, a playlist é só a reprodução avulsa
e não deve chamar atenção nem com um "1" enganoso nem com o ícone colorido —
fica neutro (branco).

### Feedback (sem alerta flutuante) — e a exceção do salvamento

Não há mais **toast flutuante**. As informações são transmitidas pela própria
interface (estados de botão, contadores, listas). `flash()`/`dismissFlash()` em
`controle.js` viraram **no-ops** — mantidos só para não mexer nos ~25 pontos de
chamada; qualquer mensagem que antes ia pro toast simplesmente não aparece mais.

#### O sinal nasce NO BOTÃO que foi tocado (v5.106)

O resultado de um salvamento é invisível justamente onde ele mais importa:
mandar algo ao Cronograma estando na Bíblia, favoritar de dentro do acervo,
guardar um preset das Ferramentas. O toque não produzia sinal nenhum e a única
forma de saber se funcionou era ir conferir — que é exatamente como se acaba
tocando duas vezes.

**O feedback é um pulso de 1,1 s no próprio botão** (`pulsar(btn, tipo)`), não
uma faixa no alto da tela. O motivo é o olhar: no instante do toque ele está no
botão, e é ali que a resposta tem de aparecer. Uma mensagem em outro canto exige
procurar o aviso, e num culto isso não acontece — o operador toca e segue.

```js
const PULSO_MS = 1100;
pulsar(btn, 'ok' | 'dup' | 'erro')   // → true se de fato pulsou
responder(btn, tipo, texto)          // pulsa; se o botão sumiu, avisa por texto
```

| `tipo` | Cor | Quando |
|---|---|---|
| `ok` | `--ok` | entrou |
| `dup` | `--warn` | **já estava lá** — é esta que impede o segundo toque |
| `erro` | `--danger` | não deu (sem rede, sem capítulo, item sumiu do acervo) |

Três detalhes que o mecanismo não pode dispensar:

- **`visivelNaTela(btn)` decide se o pulso VAI acontecer**, e `isConnected` não
  serve para isso: os bottom-sheets fecham por `opacity: 0`, o nó continua no
  documento. A pergunta certa é `offsetParent !== null` (nenhum ancestral em
  `display:none`) mais `!btn.closest('.popup-backdrop:not(.open)')` (a folha que
  o contém não está fechada). Pulsar um botão invisível é o mesmo que não dar
  feedback nenhum, e é por isso que `responder()` cai no texto nesse caso.
- **Quem re-renderiza a lista precisa ESPERAR o pulso.** `toggleFav` atualiza o
  próprio botão no lugar (classe `on`, `title`, `starSvg`) e adia o
  `renderLibrary` em `PULSO_MS` — chamar o render na hora destruiria o nó que
  está pulsando e o sinal duraria um quadro. Mesmo padrão em `refreshDiversos`,
  `exitSelection` (via `sairDaSelecaoDepois()`), `closeFolderPicker` e
  `closePlPopup`: a folha só fecha depois de o operador ver a cor.
- **As regras do pulso ficam no FIM de `controle.css`.** `.btn-pulso--ok` tem a
  mesma especificidade de `.row-btn`/`.sel-btn` (0-1-0), então quem decide é a
  ordem. Declaradas antes, elas simplesmente não pintam nada.

**Todo destino passa por `adicionarNaLista(lista, id, nome, btn)`**, que faz o
`listHas` antes do `listAdd` e escolhe entre `ok` e `dup`. Operações em lote
(seleção múltipla, pasta) resolvem o tipo em `tipoLote`/`textoLote` — um pulso
só na barra de seleção, em vez de quatro sinais piscando.

#### `avisar()`: o que sobra para o texto (v5.104)

`avisar(texto, tipo)` continua existindo, mas só onde o pulso não alcança, e o
que ele **não** é continua valendo: não é o toast de volta. Não flutua sobre os
controles (fica no TOPO da tela — a base é onde mora o transporte, e foi por
cobri-lo que o toast saiu), não pede toque para sair (`pointer-events: none`,
some em 2,4 s) e não é usado por nada que já tenha estado próprio na tela.

Dois casos, e só eles:

1. **O botão sumiu** antes de a resposta chegar (a folha fechou, a lista
   re-renderizou) — `responder()` detecta e cai no texto.
2. **O motivo não cabe num botão.** Guardar um pacote com menos de dois itens
   pulsa em vermelho **e** escreve "Monte a fila com dois ou mais itens antes de
   guardar": a cor diz que não deu, a frase diz por quê, e sem a frase o
   operador toca de novo esperando resultado diferente.

> **Armadilha do YouTube:** um vídeo baixado por `ytArquivo` **nasce na lista**
> (o `addMedia` lá dentro já recebe o destino), então perguntar `listHas`
> DEPOIS anunciaria todo download novo como "já estava lá". Em `ytAcao` a
> pergunta é feita ANTES, e só vale quando existe arquivo no aparelho — é esse
> o registro que será reaproveitado. As músicas do acervo não têm esse
> problema: elas vão para o catálogo `files`, não para uma lista.

#### Anti-duplicação (v5.104)

As listas são conjuntos de ids, então `listAdd` **já é idempotente para
mídia**: o mesmo vídeo não entra duas vezes na mesma lista, por construção. O
que não era idempotente é a **cena de roteiro** — cada uma cria um registro
novo, com id novo. Daí `cueChave(cue, data)`, a identidade de conteúdo de uma
cena (tipo + descritor), e duas regras diferentes por destino:

- **Favoritos não repetem.** Favoritar é marcar; dois "Salmo 23:1" na mesma
  gaveta são ruído puro e ninguém consegue distingui-los. O item existente é
  reaproveitado e o botão pulsa em `dup`.
- **O Cronograma PODE repetir.** O mesmo versículo pode ser lido na abertura e
  no apelo; a mesma contagem regressiva pode aparecer duas vezes. A duplicata é
  criada — mas o botão pulsa em `dup`, que é o que separa a repetição
  intencional do toque dado duas vezes.

A chave da MENSAGEM é só o `msgId`: o texto viaja no descritor como reserva
(para o roteiro não ficar mudo se ela for apagada), e compará-lo deixaria a
reserva decidir a identidade.
O único feedback migrado explicitamente para a UI é a **sincronização das
coleções**: `setCollStatus(id, text, autoClearMs?)` grava um subtítulo
no card da coleção (`renderCollectionCard`) — "Atualizando lista…", "Baixando N/T…",
"Já completo offline", "Sem internet — falha ao atualizar" etc. `autoClearMs`
limpa mensagens finais/erro sozinho; o progresso fica até a próxima chamada. O
`.toast` do CSS foi removido.

### Diálogo padrão do app (confirmações / prompts)

`confirm()`/`prompt()` **nativos foram substituídos** por um **modal no tema do
app** (`#appDialog`/`.dialog-*` no CSS + `openAppDialog`/`appConfirm`/`appPrompt`
em `controle.js`) — centralizado, com botão primário preenchido em `--accent-fill` e cancelar
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

**Ícone de alto-falante no canto INFERIOR ESQUERDO da preview**
(`#pvSoundBtn`, `.pv-fab--bl` — v5.82): liga um modo em que
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
  muda), evitando som inesperado saindo do celular numa sessão nova. Por isso
  `renderStandaloneSeg()` também roda na carga: sem ela o segmento abriria com
  os dois botões apagados, sem nenhuma escolha marcada.
- **Voltou a ser um ícone, e desta vez sobre a PREVIEW** (v5.82). Ela era a
  única preferência da lista de Configurações que se mexe DURANTE o culto —
  chega-se, liga-se a caixa de som, e ou há som no aparelho ou não —, e dois
  toques num popup para uma decisão dessa frequência é atrito puro. O lugar de
  decidir se há som no celular é olhando para a preview, que é onde o som está
  sendo julgado. O ícone carrega o ESTADO (alto-falante inteiro × riscado), pela
  mesma convenção da cortina e do mudo: o riscado é o corte; quem nomeia a ação
  é o `title`. Some em tela cheia junto com os outros `.pv-fab`.
- **Era um botão do mixer** (`#standaloneToggle`, ícone de fone de ouvido) até a
  v5.48. Virou linha de Configurações na v5.49 pelo mesmo critério que já havia
  mandado para lá as imagens dos slides e o preenchimento da mídia: é uma
  decisão de **roteamento de áudio** que se toma uma vez ao montar o culto — "o
  celular está ligado na caixa de som?" —, não um controle que se opera no meio
  dele. Na coluna do mixer ela ocupava o meio do bloco de operação (entre a
  leitura da letra e o mudo) sendo a única ali que não se toca mais depois de
  decidida. O lugar que ela deixou virou a porta de Configurações.

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
atual). Por isso o rodapé do popup de Configurações (`#openDisplayBtn`) é um
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

#### Como um item ENTRA no Cronograma

Todos os caminhos convergem para o mesmo modelo — `addMedia`/`addCue` (registro
+ lista na mesma transação) ou `listAdd('imports', id)` para o que já existe.
Não há uma segunda rota de importação: `importarPeloSistema` reusa
`importShare` de propósito, porque é lá que mora o roteamento por tipo.

| Origem | Caminho | Destino |
|---|---|---|
| "Importar arquivos" (seletor do sistema, shell ≥ 21) | `importarPeloSistema` → `importShare` | `imports` (simplificado: `avulsos`) |
| `<input type="file">` (navegador / shell antigo) | handler do `fileEl` | idem |
| Compartilhamento de outro app | `checkPendingShare` → `importShare` | idem |
| Música do acervo | folha de destinos → `addSongVariant` | `imports` |
| Resultado do YouTube | folha de destinos → `ytAcao` | `avulsos` \| `playlist` \| `imports` \| `favs` |
| Arquivo de pasta do sistema, item de pasta, favorito | botão `+` da linha | `imports` |
| Link YT já no Cronograma → arquivo | botão de download da linha | substitui **na mesma posição** |
| Versículo em leitura | botão ⊞ no rodapé da Bíblia | `imports` (cue `verse`) |
| Mensagem da aba Ferramentas | `+` na linha da mensagem | `imports` (cue `message`) |
| Letra de uma música do acervo | folha de destinos → "Só a letra" | `imports` (cue `songlyrics`) |
| Cronômetro/timer configurado | os dois botões de "Guardar esta contagem" | `imports` \| `favs` (cue `chrono`) |
| Sorteio configurado | os dois botões de "Guardar este sorteio" | `imports` \| `favs` (cue `draw`) |
| A fila da playlist | "Guardar como pacote" | `imports` (cue `group`) |

As seis últimas linhas são a v5.103 (ver "Cenas de roteiro"): antes delas, o
Cronograma só aceitava o que tem bytes.

As abas ficam **no alto da caixa de controles** (`.bottombar`, v5.54 — antes
eram o último elemento do `<main>`; ver "Layout geral") e são **abas de
verdade**: uma fileira SEM trilho, encostada na borda de cima da caixa e indo de
borda a borda (`margin: 0 -.7rem`, que desfaz o padding lateral dela). São
quatro alvos idênticos — **Cronograma** · **Bíblia** · **Ferramentas** (as
`.tab`) e o **acervo** (`#hymnSearchBtn`, `.tab-add`) —, todos `flex: 1` e
`--hit-nav` de altura, transparentes enquanto não estão escolhidos.

**A ativa é um VAZADO na cor do corpo** (v5.55): pintado com `--bg`, o mesmo
fundo das listas que estão logo acima dela na tela, e com raio só EMBAIXO.
Desde a v5.58 esse preenchimento é um ELEMENTO à parte (`.tab-ind`), não o
`background` do botão — ver "O vazado desliza", abaixo. Encostada no topo da caixa, a célula deixa de parecer um botão aceso e
passa a ser a continuação do conteúdo descendo até a fileira — a aba e a tela
que ela abre viram a mesma superfície, que é o que a palavra "aba" sempre
significou antes de virarem botões. Quem confirma o estado é o **ícone em
`--accent`**: o degrau `--bg` × `--bar` é 1,32:1, o piso das superfícies
grandes, e num salão escuro isso sozinho é pouco.

> A v5.56 experimentou o inverso — tinta nas NÃO escolhidas, vazio na escolhida
> — e a v5.57 voltou atrás. A silhueta é a mesma nos dois; o que muda é o que a
> mancha escura significa, e ela precisa acompanhar a aba EM USO.

A faixa passou por quatro formas antes desta, e o caminho é sempre o mesmo
defeito — cada versão desenhava uma caixa em volta da navegação:

| Versão | Forma | O que ela ainda cobrava |
|---|---|---|
| v5.31 | trilho de cartão (`--bar` + borda 1px), cada aba num botão | uma moldura fechada em volta de tudo |
| v5.49 | sem moldura, cada aba com fundo próprio sobre o fundo do app | quatro retângulos que se leem como quatro AÇÕES |
| v5.50 | segmentado (trilho raso em `--surface`, abas transparentes) | um trilho dizendo "isto é um grupo" — coisa que quatro ícones na base da tela já dizem |
| v5.54 | o mesmo segmentado, agora DENTRO da caixa de controles | idem, só que sobre `--bar` |

> A v5.49 resolveu de fato o desperdício do cartão, e o degrau foi medido na
> ocasião: uma aba sobre o fundo do app dá **1,38:1**, acima do piso de 1,30:1.
> O problema dela não era contraste, era gramática — fundo próprio em quatro
> células vizinhas é a forma de uma barra de ferramentas, não de uma navegação.

**O acervo continua SÓLIDO** (`--accent-fill`), dividindo a FORMA com as demais
(desce do topo, raio embaixo) e trocando só a tinta. Na fileira convivem um
ESTADO ("estou no Cronograma") e uma AÇÃO ("abrir o acervo"): sólido em accent é
o que o app já usa para "toque aqui e algo acontece" (`.misc-project`,
`.dialog-btn.primary`, `#volToggle`). A fileira inteira é lugar; ele é o único
que age — mesma forma, cor oposta, e a diferença se lê sem legenda.

#### O vazado desliza (v5.58)

O preenchimento da aba ativa é um `<span class="tab-ind">` absoluto dentro da
`.tabs`, e não o fundo do botão. A razão é uma só: **um elemento pode se MOVER
entre as abas; um fundo que troca de dono só pode piscar de lugar**. O
movimento é o que liga a aba nova à antiga — sem ele a faixa apenas "acende
noutro ponto", e num toque rápido não dá tempo de ver de onde para onde se foi.

- **Posição e largura são MEDIDAS**, não uma fração fixa: `moveTabIndicator()`
  lê `offsetLeft`/`offsetWidth` da célula ativa e escreve `--tab-x`/`--tab-w`
  em px. Um "25% por aba" dependeria de as quatro células terem sempre o mesmo
  tamanho — verdade hoje, e exatamente o tipo de suposição que quebra calada no
  dia em que um alvo mudar de tamanho ou sumir.
- **`moveTabIndicator(false)` POUSA em vez de viajar** (classe `no-anim` +
  reflow forçado antes de escrever os valores, senão o navegador agrupa as duas
  coisas na mesma passada e a transição roda assim mesmo). É o que se usa em
  dois momentos: ao ENTRAR no modo avançado — a caixa de controles fica oculta
  no simplificado, e medir um elemento escondido dá 0, então o vazado só pode
  ser posicionado quando a faixa aparece — e num `resize`, porque girar a tela
  não é trocar de aba: é a mesma aba num tamanho novo, e os pixels medidos
  mudaram.
- **Os botões precisam de `position: relative`.** O indicador é absoluto e, sem
  isso, seria pintado ACIMA dos botões estáticos: o vazado cobriria o ícone da
  aba ativa. Posicionados e depois dele no DOM, eles ficam por cima.
- **A duração e a curva são as MESMAS da lista** (`--tab-move` no CSS,
  `TAB_MOVE_MS`/`TAB_MOVE_EASE` no JS): o vazado deslizando e a lista entrando
  pelo lado são dois efeitos de UM gesto, e dois tempos diferentes os separam em
  dois eventos. Viver em dois lugares é inevitável (um é transição CSS, o outro
  é Web Animations) — quem mexer num tem de mexer no outro.
- A entrada da lista subiu de 22px para **44px** na mesma passada: 22px era
  curto demais para se ler como "veio de lá" — o conteúdo parecia só piscar.

**A caixa de controles perdeu o `border-top` E a sombra** por causa disso. As
duas existiam para marcar onde a caixa começa, e as duas passaram a atrapalhar
quando a fileira encostou no topo: a linha cortava o vazado da aba ativa, e a
sombra (`0 -2px 12px`) escurecia justamente a emenda entre o vazado e o
conteúdo — o ponto em que os dois têm de ser a MESMA superfície. Uma junta que
se quer invisível não pode ter um degradê por cima. O que separa as duas caixas
é o degrau de cor (fundo × barra, 1,32:1), e é ele que a aba ativa atravessa de
propósito.

As quatro células:

- **Cronograma** (`imports`) — itens importados; ficam até serem excluídos.
- **Bíblia** (`bible`) — seleção e projeção de textos bíblicos. Não é uma lista
  de mídia; ver a seção **"Bíblia"** abaixo. O cabeçalho mostra "Bíblia" nas
  três telas dela (livros, capítulo+versículo e leitura): as telas internas têm
  nome próprio no corpo (`.bible-book-head`), mas a faixa de cima responde "em
  que aba eu estou".
- **Ferramentas** (`activeTab` segue sendo `'mic'`, por herança) — as que **não
  são acervo**: **Mensagens**, **Tempo** (relógio/cronômetro/timer) e
  **Sorteio**, escolhidas num seletor no topo, mais o rodapé com **microfone** e
  **"Projetar no telão"**. Ver "Ferramentas" abaixo.
- **Acervo** (`#hymnSearchBtn`, a lupa) — **não é uma aba**, e por isso não tem
  `activeTab` nem entra em `TAB_ORDER`. Abre o popup que é, ao mesmo tempo, o
  navegador de coleções do LouvorJA (com o campo vazio) e a busca por
  nome/número/trecho de letra (ao digitar). É a única porta do acervo desde a
  v5.44, quando a aba de Álbuns saiu — ver "O acervo É o estado padrão da
  busca".

> A aba nasceu como **Microfone**, com uma ferramenta só. Ao ganhar a segunda,
> virou **Diversos** e o ícone deixou de ser o microfone: com mais de uma coisa
> dentro, um glifo que nomeia só uma delas esconde o resto. Na v5.51 o rótulo
> virou **Ferramentas**: "Diversos" nomeava a aba pelo que ela NÃO é (nem
> acervo, nem Bíblia, nem Cronograma), e o que está lá dentro tem um nome
> próprio. O `data-tab` continua `mic` e as funções continuam
> `renderDiversos`/`refreshDiversos`, os dois de propósito e pela mesma razão —
> renomeá-los não muda nada visível e esbarraria em `TAB_ORDER`, `scrollKey()`
> e nas guardas espalhadas que já falam essas strings.

**Duas telas saíram da faixa de abas**, cada uma por um motivo próprio:

- **Favoritos** (`activeTab` segue sendo `'folders'`) — pastas criadas pelo
  operador e pastas do dispositivo sincronizadas no OPFS. Continua sendo um
  `activeTab` (com toda a navegação interna: abrir, buscar, sincronizar), mas
  desde a v5.53 é uma **gaveta que desce do topo** (ver a seção própria),
  aberta pelo botão do **canto direito do cabeçalho** (v5.103 — antes era o
  botão ao lado de "Importar arquivos", no fim do Cronograma, e chegar lá
  exigia rolar a lista inteira). O voltar e o sincronizar moram no cabeçalho DA
  GAVETA; `renderTabs()` mantém o Cronograma aceso enquanto ela está aberta,
  porque é ele que está atrás.
- **Mensagens** — foi para a aba **Ferramentas** (v5.31), como seção do
  acordeão. Antes era um botão flutuante sobre a preview; ver abaixo.

#### O rodapé fixo da caixa da lista (`#listFoot`, v5.107)

`<main>` é uma coluna de três faixas: o cabeçalho, o `<ul id="library">` que
rola, e o **rodapé**, que não rola. O rodapé tem dois inquilinos e **nunca os
dois ao mesmo tempo**:

| Inquilino | Quem monta | Quando |
|---|---|---|
| **"Importar arquivos"** (`.import-row`) | `renderListFoot()` | aba Cronograma, fora de pasta, sem seleção |
| **barra de seleção múltipla** (`#selbar`) | `hostSelbar()` | seleção múltipla ligada, gaveta de Favoritos fechada |

Os dois vestem a MESMA moldura tracejada em `--accent` (v5.108): é uma fatia só,
com inquilinos diferentes, e o contorno é o que diz isso.

Os dois estavam em lugares errados, e cada um pelo seu motivo:

- **"Importar arquivos" era o último `<li>` do `<ul>`.** Com um culto montado
  — trinta itens, que é o normal — a ação mais frequente da tela exigia rolar
  a lista inteira para ser alcançada e rolar de volta depois. Ele continua
  junto do lugar onde os arquivos vão cair, só que sempre à vista.
- **A barra de seleção tomava o lugar da faixa de ABAS**, na caixa de
  controles. As ações são da LISTA; trocar a navegação de lugar para mostrá-las
  mexe no que não é da seleção, e some com as abas justamente quando o operador
  pode querer sair da tela. No rodapé ela ocupa a fatia do "Importar arquivos",
  que é a única coisa da tela que a seleção múltipla de fato substitui.

Três detalhes que o mecanismo exige:

- **Os dois medem `--hit-foot` (44px)**, e é por isso que a medida é token: com
  alturas diferentes a caixa da lista mudava de tamanho ao entrar e sair da
  seleção — e a lista dava um pulo debaixo do dedo que estava segurando o item
  que a abriu.
- **`renderListFoot()` reconstrói só o que é dela.** Um `innerHTML = ''` ali
  tiraria a `#selbar` do documento: o nó é UM só, movido entre o rodapé e a
  gaveta de Favoritos (mesmo padrão do `<input type="file">`), e perdê-lo é
  perder os listeners.
- **Quem esconde o rodapé vazio é o JS, não um `:empty`.** A `#selbar` mora
  ali mesmo fora da seleção (escondida pelo `hidden`), então o rodapé nunca
  fica de fato vazio — e um filho de altura zero ainda consome o `gap` do
  `<main>`, que viraria uma faixa de ar acima da caixa de controles em toda aba
  sem rodapé. E a chamada é **antes** do desvio por aba em `renderLibrary()`:
  Bíblia, Ferramentas e a raiz dos Favoritos saem por `return`, e deixada para
  o fim ela desenhava o "Importar arquivos" do Cronograma embaixo da grade de
  livros da Bíblia.

O `<input type="file" multiple>` continua sendo o mesmo elemento de sempre
(`#file`, com o listener de `change` já registrado) — ele mora solto no
`index.html` e é **movido** para dentro do `<label>` a cada render, porque
descartar a linha antiga destruiria um input criado ali.

**Navegação persistente:** trocar de aba **não** reseta a pasta aberta nem a
busca — voltar para os Favoritos retorna exatamente onde estava. A posição de scroll
é guardada por aba/pasta (`scrollPos`, chave `scrollKey()` = aba + id da pasta)
e restaurada ao fim de cada `load()`; `rememberScroll()` é chamado antes de
trocar de aba, abrir pasta ou voltar. (Memória por sessão, em RAM.)

**Deslizar troca de aba (carrossel, v5.49).** As três abas já eram um carrossel
na cabeça de quem usa Android — a animação de troca sempre desenhou a lista
ENTRANDO pelo lado —, mas o gesto que produz esse movimento em qualquer outro
app não existia aqui: só o toque no ícone. `setupTabCarousel` escuta o
`pointerdown`/`pointermove` no `<main>` e troca de aba quando o dedo anda
`TAB_SWIPE_MIN` (60px) na horizontal com o eixo X dominando o Y em 1,5×.

- **A ordem é a da FAIXA** (`SWIPE_TABS = ['imports','bible','mic']`), não a do
  `TAB_ORDER`: este inclui os Favoritos, que não têm botão na faixa — deslizar
  até uma tela que não aparece na navegação deixaria o operador num lugar sem
  indicação de onde ele está.
- **Age no meio do gesto**, não ao soltar: a aba nova entra deslizando enquanto
  o dedo ainda se move, que é o que faz o gesto parecer arrastar a tela.
- **Duas superfícies escutam**: o `<main>` e a própria `.tabs`. Desde a v5.54 a
  faixa mora na caixa de controles, fora do `<main>` — e deslizar sobre a
  fileira de abas é o gesto mais óbvio de todos, então ele passou a ser
  registrado explicitamente. O estado do gesto é compartilhado: é UM gesto, não
  dois.
- **Vale SOBRE A LISTA, inclusive sobre as linhas** (v5.50). Na v5.49 o gesto
  ignorava tudo o que começasse numa `.row`, porque a linha tinha deslize
  próprio (adicionar à playlist) — e como o Cronograma inteiro é feito de
  linhas, o carrossel não funcionava justamente na aba em que mais se tenta
  usá-lo. O deslize da linha saiu; o eixo horizontal ficou livre.
- **`touch-action: pan-y` NO SCROLLER, não num ancestral.** A regra de
  `touch-action` para de subir na árvore no elemento que IMPLEMENTA o gesto —
  ou seja, no contêiner que rola. Quem precisa da declaração, então, é cada
  scroller: a `.lib-list` (Cronograma, Favoritos, Bíblia) e, na aba
  **Ferramentas**, o `.misc-panel` e a `.msg-list`, porque ali a `.lib-list` é
  `overflow: hidden` e quem rola é o painel de dentro. Sem a declaração o
  navegador considera o gesto dele (`manipulation`, herdado do `*`) e o engole
  com um `pointercancel` ao primeiro movimento, muito antes dos 60px que a
  troca exige.
  **Foi esse detalhe que fez a aba Ferramentas travar por três versões.** A
  v5.52 tentou cobrir o buraco em JS; a v5.61 pôs a declaração na `.lib-list`
  — mas ela nunca chegava a valer, porque o toque começava dentro do
  `.misc-panel` e a caminhada parava ali. A mesma regra, lida do outro lado, é
  o que preserva o `pan-x` do histórico do sorteio (`.draw-hist`): um `pan-y`
  acima dele não o alcança. Verificado com toque real: o histórico rola de lado
  (`scrollLeft` 0 → 142) e a aba não muda.
- **O gesto de TOQUE tem ciclo próprio, independente dos `pointer*`** (v5.62).
  O navegador CANCELA o fluxo de ponteiro (`pointercancel`) assim que decide
  que o gesto é dele, e basta um scroller no caminho para ele decidir; enquanto
  o carrossel dependia do `pointerdown` para armar, um cancelamento matava o
  gesto antes de ele nascer — e o `touchmove` que deveria reivindicá-lo voltava
  cedo, porque não havia gesto armado. Agora `touchstart` arma, `touchmove`
  decide o eixo / reivindica / troca a aba e `touchend`/`touchcancel` encerram.
  Os `pointer*` ficaram só para o MOUSE (filtrados por `pointerType`), que é
  como se desenvolve no navegador de mesa.
- **Dois limiares, duas decisões**: o EIXO é decidido aos 12px
  (`TAB_CLAIM_MIN`) — cedo, antes de o navegador tomar a decisão dele — e a
  TROCA aos 60px (`TAB_SWIPE_MIN`), que é intenção. Uma vez reivindicado, o
  gesto continua nosso até o dedo levantar: soltar o controle no meio deixaria
  a página rolar de lado no fim do movimento. O `touchmove` é **não passivo**,
  que é o que faz o navegador esperar a decisão do handler antes de rolar; um
  movimento vertical nunca é tocado.
- **Nem em sub-tela** (pasta aberta, capítulo/leitura da Bíblia), reconhecida
  pelo `#backBtn` visível: ali o eixo horizontal pertence à navegação de dentro.
  Também ficam de fora campos de texto e trilhos que rolam na horizontal (o
  histórico do sorteio) e o modo de seleção múltipla.
- **O `click` do fim do gesto é engolido** por um listener de CAPTURA no
  `<main>`, senão deslizar sobre a grade de livros trocava de aba **e** abria um
  livro; sobre a faixa, trocava de aba e voltava para a do ícone que o dedo
  cruzou; e na ponta do carrossel (deslizar além da última aba, onde não há
  troca) um deslize sobre "+ Nova mensagem" abria o diálogo de mensagem nova —
  um gesto de navegação virando ação de conteúdo. A trava é uma **flag desarmada
  no `pointerdown` seguinte**, e não um listener com prazo: o prazo de 350 ms
  que havia primeiro mede o tempo errado — numa página em segundo plano o resto
  do gesto leva mais que isso e a trava expirava justamente antes do clique
  chegar (observado com a janela do Display aberta ao lado, no navegador).

#### A troca de aba é um DESLIZE INTEIRO (v5.59)

As duas telas se movem juntas, larguras inteiras, como um carrossel de verdade:
a que sai vai para `-100%`, a que entra vem de `+100%`, e em nenhum instante
elas se sobrepõem — são vizinhas, coladas, empurrando-se. Até a v5.58 só o
conteúdo NOVO se mexia (entrava de 44px com um fade, e o antigo simplesmente
sumia): isso é um sinal de direção, não um deslize, e o gesto que o dispara —
arrastar a lista para o lado — promete exatamente que a tela vai sair do lugar.

O truque para ter as DUAS telas ao mesmo tempo com uma lista só no DOM é o
**fantasma** (`makeTabGhost`): os nós antigos são MOVIDOS para um `<ul>`
absoluto posicionado exatamente sobre a área da lista, e a `#library` de
verdade fica livre para receber o conteúdo novo.

- **Mover, não CLONAR.** Um clone reinicia o download de cada miniatura por um
  `blob:` que o render seguinte revoga — as fotos sumiriam no meio do deslize.
  Movidos, os mesmos elementos seguem pintados.
- **O fantasma é feito ANTES do `load()`**, e é ele que o operador continua
  vendo enquanto a lista nova é montada (leituras de IndexedDB — poucos ms, mas
  não zero). Por isso `switchTab` virou `async` e o deslize dispara no
  `finally`: um `load()` que falhe não pode deixar o fantasma congelado sobre a
  lista para sempre.
- **O `<input type="file">` fica para trás de propósito.** Desde a v5.107 ele
  mora no RODAPÉ (`#listFoot`), que fica fora do `<ul>` e portanto fora do
  fantasma — mas a guarda continua: se um dia algo voltar a pendurá-lo dentro
  da lista, ele iria junto, sairia do documento quando o fantasma fosse
  descartado, e o `change` que importa arquivos deixaria de acontecer sem erro
  nenhum no console.
- **Um deslize novo mata o anterior** (`tabGhost`): dois toques rápidos
  deixariam dois retângulos empilhados sobre a lista.
- **`main` é `position: relative` + `overflow: hidden`**: é ele que ancora e
  RECORTA o fantasma — as duas telas atravessam a largura inteira e não podem
  aparecer fora da área da lista.
- **A regra do fantasma precisa das DUAS classes** (`.lib-list.lib-ghost`). Ele
  também é uma `.lib-list`, e aquela regra — que vem DEPOIS na folha — declara
  `position: relative`. Com uma classe só o empate de especificidade era
  decidido pela ordem: o `relative` vencia, o fantasma continuava no fluxo,
  virava um segundo item flex do `main` e DIVIDIA a altura com a lista de
  verdade. O sintoma era a aba de destino aparecer espremida durante o deslize
  e se corrigir sozinha ao fim dele (medido: 478px em repouso, 233px no meio da
  animação, 478px de novo depois que o fantasma sai).
- **Fechar a gaveta de Favoritos passa `semAnim`**: ali o movimento que o
  operador vê é a gaveta subindo, e um carrossel por baixo dela contaria outra
  história.

A **direção** vem da ordem das abas (`TAB_ORDER =
['imports','folders','bible','mic']` — inclui os Favoritos, que são um
`activeTab` sem botão na faixa): ir para uma aba à **direita** faz a nova entrar
pela direita, à esquerda o contrário. A duração e a curva são as MESMAS do
vazado que desliza na faixa (`TAB_MOVE_MS`/`TAB_MOVE_EASE` × `--tab-move`): os
dois são efeitos de UM gesto, e tempos diferentes os separariam em dois eventos.
Respeita `prefers-reduced-motion` — ali não há fantasma nem deslize, a lista
simplesmente troca.

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
| Segurar e arrastar (⠿) | Reordena o item na lista |
| Pressionar e segurar | Entra no modo de seleção múltipla |

**O deslize lateral da linha saiu na v5.50.** Ele adicionava o item à playlist
(`dx <= -SWIPE`), e a única pista de que existia era um ícone a 22% de opacidade
atrás da linha (`.swipe-bg`/`.swipe-hint`, removidos junto). Um atalho que quase
ninguém descobre não justifica reservar para si o eixo horizontal da maior parte
da tela — que é o que impedia o **carrossel de abas** de funcionar sobre a
lista. A playlist continua a um toque, pelo `+` de cada resultado do acervo e
pelo popup da playlist.

Com ele saiu também o `setPointerCapture` da linha: o `pointermove` agora só
CANCELA o gesto do item quando o dedo anda mais de 10px em qualquer direção —
sem tocar no evento, que segue subindo para o carrossel e para a rolagem, que
são de quem o dedo está falando naquele momento.

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
**acrescentar à playlist**, favoritar, adicionar a uma pasta, renomear (1 item)
e excluir.

> **A barra não tem preenchimento** (v5.105). Ela era um bloco em
> `--accent-soft` com contorno SÓLIDO em `--accent` — a mancha âmbar mais forte
> da tela, num app cuja regra é "âmbar é navegação e marca". E, preenchida e
> contornada, ela tinha exatamente a silhueta de um ITEM SELECIONADO da lista
> logo acima (`.lib-item.selected` também é borda accent + fundo), então lia-se
> como mais uma linha marcada em vez de como a barra de ações delas. Hoje é o
> fundo que já está atrás com os botões `--surface-2` flutuando. O sinal de
> "outro modo" fica no CONTADOR em accent: uma cor de texto, não uma placa.
>
> **No rodapé ela veste a moldura TRACEJADA do "Importar arquivos"** (v5.108) —
> mesma linha pontilhada em `--accent`, mesmo raio, mesma caixa. As duas são a
> mesma fatia do rodapé com inquilinos diferentes, e o contorno é o que diz
> isso. Não recria o problema acima: o que fazia a barra parecer um item
> selecionado era o CONJUNTO "preenchimento âmbar + contorno sólido"; uma linha
> pontilhada sobre o fundo do corpo não se parece com item nenhum da lista — é
> a convenção que o app já usa para "espaço a preencher". Na gaveta dos
> Favoritos ela segue sem moldura: ali a folha já é a moldura.
>
> **E ela saiu da caixa de controles** (v5.107): mora no rodapé fixo da lista
> (`#listFoot`), na fatia do "Importar arquivos" — as abas não somem mais para
> abrir espaço a ela. Ali ocupa `--hit-foot` (44px), a mesma altura do botão que
> substitui; os `.sel-btn` continuam em `--hit` (34px), e é a folga de 5px de
> cada lado que os faz parecer flutuando dentro da moldura em vez de
> preenchê-la. Ver "O rodapé fixo da caixa da lista".
>
> O primeiro é da v5.50 e é onde foi parar a função do deslize à
esquerda: para itens da biblioteca, o toque simples SUBSTITUI a fila, então sem
ele montar uma sequência dependeria de um gesto que a tela não anunciava. No
botão, a mesma ação ficou visível e passou a valer para vários itens de uma vez
(`addSelectedToPlaylist`). Os itens selecionados são
indicados **só pelo realce** (`.lib-item.selected` — borda `--accent` + fundo
`--panel-2`), sem
ícone de check; a miniatura fica sempre encostada à esquerda (não há coluna
reservada). Excluir dentro de pasta virtual só remove da pasta; nas demais abas
usa `listRemove` (com gc).

### Favoritos: a gaveta do topo (marcados + pastas + pastas do sistema)

> **"Atalho" virou "pasta" (v5.112).** O nome vinha do modelo antigo (as
> "pastas virtuais" renomeadas na v5.103) e descrevia errado o que a coisa é:
> um atalho é um ponteiro para algo que mora em outro lugar, e estas são
> agrupamentos que o operador CRIA aqui e enche com o que já marcou. A gaveta
> passou a ter dois títulos que dizem de quem é cada grupo — **"Minhas pastas"**
> e **"Pastas do sistema"** —, e é a segunda que de fato é um VÍNCULO: aponta
> para uma pasta do armazenamento do aparelho e existe para ser
> re-sincronizada, o que o `folder_open` e o botão de setas circulares já
> mostravam sem que o rótulo acompanhasse. ("Coleção" foi descartado de
> propósito: o acervo já chama de coleção os hinários e álbuns do LouvorJA, e
> o mesmo nome para duas coisas diferentes seria pior que o nome errado.)
>
> **E a listagem ficou densa** (`#favList` em controle.css). Ela herdava a
> métrica da lista do Cronograma, e as duas não fazem a mesma coisa: no
> Cronograma cada linha é um item que vai ao ar — ela é ALVO de toque no meio de
> um culto, e o espaço em volta é o que evita o toque errado. A gaveta é o
> oposto: o operador vem PROCURAR, dividido em cinco ou seis seções por tipo.
> Encolheu a MOLDURA (miniatura 40→32px, respiro, espaço entre linhas e o
> cabeçalho de seção), nunca o TEXTO nem os ALVOS — os botões da linha seguem em
> `--hit` (34px). É esse piso que limita o resto: com 34px de botão mais os 2px
> de borda de cada lado (a moldura do item selecionado), a gordura que sobrava
> era só o respiro. Medido: o passo de uma linha cai de ~57px para ~48px.

É o caminho curto para o que o operador usa toda semana. Desde a v5.53 ela é
uma **gaveta que desce do topo** (`#favPopup`).

#### O que a v5.103 corrigiu: era uma PASTA com nome de favorito

Até ali, "Favoritos" era o antigo recurso de **pastas virtuais** renomeado — o
estado prova (as chaves seguem sendo `folders`/`folder_<id>`, e há uma chave
`favorites` marcada como legado, do recurso que fora removido). Trocou-se o
rótulo e o ícone; o modelo continuou sendo pasta. Daí saíam, um a um, os três
incômodos que o operador relatava:

- **"sempre precisa de uma pasta"** — não existia o ato de *favoritar*. Não
  havia um bit no item, havia "pertencer a um grupo": com zero pastas criadas,
  marcar o primeiro favorito custava seleção → estrela → "Nenhuma pasta ainda"
  → criar → nomear → confirmar. Seis passos para o que devia ser um toque.
- **"não é um acesso rápido"** — a porta era o botão no **fim da lista do
  Cronograma**, e só ele: para chegar a uma pasta era preciso rolar o cronograma
  inteiro; da Bíblia, do acervo ou das Ferramentas não havia caminho nenhum; e
  no modo simplificado a gaveta não existia.
- **"não abrange tudo"** — `folder_<id>` é um array de ids de MÍDIA, então
  versículo, mensagem, cronômetro e sorteio não podiam ser favoritados.

As três respostas: a lista plana **`favs`** (uma das `LISTS`, portanto detentora
de referência de verdade), a **estrela em toda linha** e no cabeçalho fixo, e as
**cenas de roteiro** (`kind: 'cue'`), que deram identidade de item ao que antes
era só uma tela. As pastas continuam existindo — como **organização opcional**,
não como pré-requisito.

Detalhes que caem de A, e que valem lembrar ao mexer aqui:

- **A estrela é PREENCHIDA quando marcada e contornada quando não** (v5.104), a
  convenção universal de favorito. Por isso ela é **SVG e não glifo**: a fonte é
  um subset ESTÁTICO da família *Outlined* (sem o eixo `FILL` da variável), e o
  glifo `star` desenha sempre a mesma estrela vazada — cor sozinha deixava a
  dúvida de "dourada quer dizer marcado ou quer dizer que dá para marcar?". A
  desmarcada é `--line`, e não `--muted`: discreta o bastante para o olho passar
  batido pela lista inteira, forte o bastante para ser encontrada.
- **Estrela = favorito; pasta = grupo.** As pastas usavam estrela desde a
  v5.53 (quando "Favoritos" era só o nome novo das pastas virtuais). Com a
  estrela virando o marcador de cada linha, o mesmo símbolo passaria a dizer
  duas coisas na mesma gaveta — então as pastas, o seletor de pasta e o botão
  da seleção múltipla adotaram o glifo de pasta.
- **A porta é o cabeçalho FIXO, com rótulo** (v5.104). O botão do fim do
  Cronograma saiu: ele era a única porta, e uma porta no fim de uma lista
  rolável não é acesso rápido — com trinta itens era preciso rolar tudo. O
  espaço do rótulo saiu da troca de modo, que virou "Modo Fácil" (era "Modo
  simplificado", o texto mais longo da faixa).
- **Favoritar uma música do acervo continua BAIXANDO o arquivo.** É deliberado:
  o que se espera de um favorito num domingo de manhã é que ele TOQUE, inclusive
  com a rede da igreja fora do ar. O que mudou é o destino (a lista `favs`,
  direto), não o custo.
- **Fechar a gaveta devolve à aba de onde ela foi aberta** (`favVoltarPara`).
  Com a porta no cabeçalho fixo, ela é aberta de qualquer lugar — quem a abriu
  no meio de uma leitura bíblica não espera cair no Cronograma ao fechá-la.
- **Excluir na RAIZ da gaveta é desmarcar**, e isso precisa de um ramo próprio
  em `deleteSelected`: sem ele o `else` genérico caía em
  `listRemove('folders', id)` — a chave do ÍNDICE de pastas, que guarda objetos
  e não ids. Um no-op silencioso, com o operador vendo o item continuar na lista
  depois de mandar excluí-lo.

**Por que saiu da lista.** Era uma tela do `#library` como as outras, e por isso
disputava o cabeçalho com o resto do app: ela é a única que precisa de
**voltar + título + busca + sincronizar** ao mesmo tempo, numa faixa que também
carrega a troca de modo. Numa tela de 360px isso não cabia — o título saía com
reticências. Como gaveta ela traz o **próprio cabeçalho** (`renderFavHeader`) e
devolve o de baixo ao que ele é: um rótulo de aba com três elementos.

**O `activeTab` continua `'folders'` enquanto a gaveta está aberta**, e essa é a
decisão que mantém o custo baixo: abrir/fechar/navegar/selecionar/excluir
seguem sendo o mesmo código de sempre. O que mudou foi **o container em que a
lista é desenhada** — `listHost()` devolve `#favList` quando o `activeTab` é
`'folders'` e `#library` no resto. Uma segunda implementação da lista de
favoritos divergiria da primeira no primeiro ajuste.

Três consequências que só aparecem em uso, e as três estão tratadas:

- **A barra de seleção múltipla é MOVIDA para dentro da folha** (`hostSelbar`):
  ela vive na caixa de controles, atrás da gaveta, e selecionar itens dentro de
  uma pasta deixaria a barra invisível. É o mesmo padrão do
  `<input type="file">`, que já muda de casa a cada render — um nó só, movido,
  em vez de dois que divergem. Em casa o lugar dela é **antes do `.deck`**,
  porque é ali que fica a faixa de abas que ela substitui: daí o `insertBefore`
  e não um `appendChild`, que a jogaria para depois do transporte.
- **O voltar do aparelho tem a hierarquia de DENTRO primeiro** (`__avBack`,
  passo 1.5): seleção múltipla → pasta aberta → gaveta. A seleção vem antes da
  pasta porque ela é do conteúdo DELA: sair da pasta com a seleção de pé
  deixaria itens marcados numa lista que não é mais a deles.
- **Fechar volta para a RAIZ.** Uma gaveta reabre no topo; reaparecer dentro de
  uma pasta que o operador fechou há dois toques seria uma memória que ninguém
  pediu. A posição de ROLAGEM, essa sim, continua guardada por `scrollPos`.

O mecanismo por baixo continua usando as MESMAS chaves de state (renomear a
leitura não pode custar a biblioteca de ninguém) — o que mudou é o
enquadramento: não é "onde os arquivos moram", é "o que eu marquei".

A lista tem **três** origens, cada uma sob um cabeçalho próprio
(`appendFavSection`, `.fav-section`), porque todas se comportam igual ao toque e
só uma delas sincroniza:

1. **Favoritos** (`favItemRow`) — os itens marcados, em lista plana (`favs`),
   **separados por TIPO** (`FAV_GRUPOS`/`favGrupo`, v5.104): Músicas e áudios ·
   Vídeos · YouTube · Imagens · Apresentações · Versículos · Letras · Mensagens
   · Tempo · Sorteios · Pacotes · Outros. A ordem é FIXA e não segue o que tem
   mais itens: uma lista que se reordena sozinha obriga a procurar de novo a
   cada abertura, e o que se quer aqui é memória muscular. O tipo é a primeira
   coisa que o operador sabe sobre o que procura ("era um vídeo"), então é por
   ele que a lista se divide; o que não se encaixar cai em "Outros" em vez de
   sumir. Cada linha faz as três coisas que se quer de um favorito e nenhuma
   exige entrar em grupo: **tocar/projetar** (o mesmo `onTap` da biblioteca),
   **desmarcar** (a estrela) e **mandar ao Cronograma** (o `+`).
2. **Atalhos** (`renderVirtualFolders`) — grupos criados pelo operador, ícone de
   **estrela**. Recebem itens pela seleção múltipla (`#selFolder`, hoje com
   ícone de PASTA e rótulo "Adicionar a uma pasta" — a estrela ao lado dele
   virou o `favs` direto) e podem ser criados na própria tela, pelo botão "Novo
   pasta" (`appendNewFavoriteRow`). Excluir uma pasta não apaga mídia que tenha
   outro dono — e o que ficar sem dono nenhum agora é coletado (`folderDrop`).
3. **Pastas do dispositivo** — as pastas sincronizadas no OPFS, com o botão de
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
    (zero-cópia — `getMedia` resolve pelo fallback). Desde a v5.103 esse botão
    vale para **qualquer** item da gaveta, não só os de pasta do dispositivo:
    de dentro de uma pasta (ou dos favoritos) não havia como mandar nada para a
    lista do culto, que é justamente o que um favorito existe para fazer.
    Seleção múltipla permite renomear e excluir (exclui do OPFS + catálogo +
    remove das listas, `favs` incluída).
  - Excluir a pasta (com `appConfirm`, o diálogo do app — não há mais nenhum
    `confirm()` nativo na base) apaga o diretório OPFS inteiro, os registros do
    catálogo e as referências em listas.
- **Atalhos (pastas virtuais)** — criados pelo usuário (state `folders` +
  `folder_<id>`); recebem itens pelo botão "Adicionar a uma pasta" da seleção
  múltipla (funciona também com IDs do catálogo OPFS) e nascem vazios pelo
  botão "Nova pasta". Excluir a pasta não exclui mídia que tenha outro dono —
  e o que ficar sem dono nenhum é coletado na mesma transação (`folderDrop`;
  ver "O furo do gc").
- **Favoritos (`favs`)** — a lista plana, marcada pela estrela de cada linha ou
  pela estrela da seleção múltipla (`#selFav`). É onde as CENAS DE ROTEIRO
  também podem morar: um versículo, um preset de cronômetro ou um sorteio
  guardado é um id como qualquer outro.

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

**O navegador do acervo** (`renderCollectionsList(alvo, redesenhar, opts)`)
renderiza um card por coleção (`renderCollectionCard`), **agrupados por
categoria** — os dois hinários num grupo fixo no topo, depois cada categoria do
banco. Ele **não tem aba própria**: desde a v5.43 é o estado padrão do popup da
lupa, e desde a v5.44 é o único (ver "O acervo É o estado padrão da busca"). A
função recebe o elemento-alvo e o callback de redesenho justamente por isso —
duas cópias divergiriam no primeiro ajuste de categoria.

O card do Hinário **saiu da tela de pastas** (hoje os **Favoritos**, que voltou
a ser só pastas e pastas do sistema).

> **As pílulas de filtro saíram na v5.70.** Havia uma faixa rolável no topo
> (`.coll-filters`/`.coll-pill`: Todos · Hinários · uma por categoria do banco,
> guardada em `albumFilter`), pensada para cortar caminho até um grupo sem rolar
> a lista. Ela cobrava um recorte antes de mostrar o acervo, e o acervo já vem
> recortado: os cabeçalhos de categoria são o mesmo agrupamento, na mesma ordem
> do banco, e os cards são colapsados — a lista inteira cabe em pouquíssimas
> telas de rolagem. Quem sabe o nome digita, e o campo de busca fica logo acima.
>
> Tirá-las simplificou o render: `albumFilter` era o único motivo de três ramos
> em `renderCollectionsList` (ocultar os hinários, pular categorias, e um
> retorno antecipado que escondia os álbuns órfãos e trocava a mensagem de lista
> vazia), e do parâmetro `showName` do cabeçalho de grupo — que hoje só serve a
> "Todo o acervo", onde o nome já está dentro do botão. A faixa também era uma
> exceção no reconhecedor de deslize do carrossel de abas (um trilho horizontal
> dentro de uma área que troca de aba na horizontal); essa exceção saiu junto.

Os mecanismos abaixo (sincronização/download/letra/Wi-Fi/busca) valem **por
coleção**, exatamente como antes valiam só pro Hinário 2022.

#### Baixar a coleção COMPLETA (`syncGroup`)

O cabeçalho de cada grupo (`.coll-group`) deixou de ser só um rótulo: ele
carrega o **resumo do grupo inteiro** (`baixados/total`, somando todos os
álbuns dali) e o botão que **baixa a coleção completa** — "CDs Oficiais/Ano"
tem uma dúzia de álbuns, e sincronizar um a um pela engrenagem de cada card era
uma dúzia de idas ao popup. Vale para os três tipos de grupo: os hinários, cada
categoria do banco e os álbuns órfãos.

O cabeçalho pode **omitir o nome** e continuar existindo (`showName === false`)
— o que estava lá antes era redundante, o que está lá agora é uma ação. Hoje só
"Todo o acervo" usa isso, porque ali o nome já está dentro do próprio botão;
antes da v5.70 valia também para o grupo que a pílula de filtro selecionada já
nomeava.

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
- **Um álbum do LOTE não pode cancelar a si mesmo.** `syncCollection` interpreta
  uma segunda chamada com `syncBusy` ligado como "o operador tocou de novo" e
  **aborta** o download em curso — que é o comportamento certo para o botão, e
  desastroso para o laço: o lote pedia dois downloads e o efeito líquido era
  parar um. `opts.fromGroup` marca a chamada como programática, e aí o lote
  apenas **pula** o álbum que já está baixando por conta própria.
- **Sem rede, o cabeçalho conta as falhas.** `fetchCollectionIndex` lança em
  cada álbum e o laço inteiro termina em segundos sem baixar nada; anunciar
  "Coleção completa" em verde ali mandava o operador embora convencido de que o
  acervo estava no aparelho. O status por álbum existe, mas fica dentro de um
  card colapsado e se autolimpa — o cabeçalho, que é o que ele está olhando,
  agora diz "N álbum(ns) sem rede — tente de novo". Isso só é possível porque
  `syncCollection` passou a **devolver um resultado** (abaixo).

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
- **Um freio só (`BG_NOTIF_MIN_MS`, 700 ms), e ele vale apenas para a ROTINA**
  — a atualização em que só o contador andou (`bgTaskStep`). Tudo que precisa
  chegar na hora passa `force`. Houve um **segundo piso** (250 ms) "escolhido
  pelo chamador" por um parâmetro `destaque`: ele foi removido porque nenhum
  dos cinco chamadores o passava — era código morto, e mexer na constante não
  produzia efeito nenhum no aparelho. Quem de fato dá o ritmo do item que entra
  em download é o **compasso** (`bgPacerTick`, `BG_TICK_MS` = 250 ms), que
  envia com `force` sempre que o nome da linha troca. Repor o piso curto seria
  **pior** que o `force`: o primeiro nome de uma tarefa nasce a poucos ms do
  envio de abertura e ficaria retido até o batimento de 2 s.
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
- **`bgWorkEnd` é IDEMPOTENTE, e precisa ser.** Quando o último trabalho pesado
  termina, ele limpa o `bgTasks` como rede de segurança contra uma tarefa
  órfã — mas o `clear()` **sozinho** deixava o compasso ligado para sempre: com
  o Map já vazio, o `bgTaskEnd` que viesse depois não achava nada, o `delete`
  devolvia `false`, e nem o `bgPacerSync()` nem o envio final rodavam. O
  `setInterval` de 250 ms vazava pelo resto da sessão, batendo na ponte a cada
  2 s com uma tarefa vazia (notificação "Baixando mídias" **presa**) e, pior,
  fazendo o próximo `bgTaskStart` reusar um pacer órfão. Hoje `bgWorkEnd`
  sincroniza o compasso e envia o estado final ele mesmo — e a ordem entre ele
  e o `bgTaskEnd` deixa de importar.
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

**UI — o card É o álbum, e tocar nele ABRE o álbum**
(`renderCollectionCard()` + `.hymnal-card` no CSS). A barra do card
(`.coll-bar`) é uma **linha só**: símbolo + nome (+ subtítulo da categoria) +
**resumo de sincronização** (`baixados/total`, ou o progresso ao vivo enquanto
sincroniza) + **baixar/cancelar** (`.coll-bar-dl`) + a **seta de acordeão**
(`.coll-bar-chev`). Tocar na barra **expande o card ali mesmo**
(`ui(coll.id).expanded`), com a lista de músicas dentro; sem índice ainda, o
toque leva às **opções**, que é justamente onde está o sincronizar que resolve
isso.

> **Sem molduras, sem seta, sem faixa de cor (v5.71).** O card tinha um contorno
> de 1px em `--line`, uma faixa de 3px com a `color` do álbum no banco e uma
> seta de acordeão à direita. Numa lista de dezenas de álbuns, o que o olho via
> primeiro eram as linhas, não os nomes. Hoje o card é só **preenchimento
> sólido**: ele mora dentro da folha do popup, que é `--panel`, então sobe um
> degrau para `--panel-2` — um cartão da cor do que está atrás dele
> simplesmente não existe aos olhos, e sem a moldura era só isso que sobrava.
> As músicas dentro dele são `--panel` e passam a se ler como recessos, na mesma
> direção do resto do app.
> **Aberto se diz no NOME**, em accent (`.hymnal-card.expanded .coll-bar-name`)
> — o mesmo recurso com que o app marca "é este" em toda parte. Um segundo
> degrau de tom não cabia: o cartão já gastou um para existir, e as músicas
> ocupam o de baixo. A **seta** saiu porque numa lista em que TODO card abre ela
> dizia o mesmo em todas as linhas, e quem anuncia a abertura agora é o próprio
> movimento, animado desde a v5.63. O filete entre a barra e as músicas
> (`.coll-songs`, `border-top`) e os contornos do botão de baixar e da
> engrenagem saíram junto — sólidos, como o `.coll-group-btn` do cabeçalho com
> que eles dividem a coluna.
> O campo `color` continua no catálogo, de graça, se um dia a cor voltar como
> tinta do quadrado do ícone — que já existe e não acrescenta traço nenhum.

**O botão de baixar SAI da barra quando o álbum já está todo no aparelho**
(v5.63 — a condição é `u.syncBusy || !complete`). Ele dizia "Baixar esta
coleção" para uma coleção que não tem mais o que baixar: um alvo do tamanho de
`--hit` oferecendo uma ação sem efeito, repetido em cada linha de uma lista de
dezenas de álbuns. O que resta a fazer ali — re-sincronizar o índice, apagar o
baixado, ver o peso — é manutenção, e já mora na engrenagem DENTRO do card
aberto, que é onde se procura depois de abrir o álbum. Enquanto o download
**roda** o botão continua, porque ali ele é o cancelar. O botão de grupo (`.coll-group-btn`, no cabeçalho de categoria e em "Todo o acervo") **não**
segue a regra — ali não existe engrenagem, e sumir com ele tiraria a única rota
de re-sincronizar o grupo.

**O contador saiu na v5.70 e VOLTOU na v5.94 — em outra moeda.** O que saíra
era `24/24`: uma contagem de faixas que não pedia nada nem informava nada de
novo, repetida em cada linha de uma lista de dezenas de álbuns. O que está lá
agora é o **peso** (`fracaoPeso`), e ele responde a pergunta que se faz com o
dedo sobre o botão de baixar: *quanto isto vai me custar*. Quatro faixas podem
ser 8 MB ou 80 MB, e é essa diferença — não o número de faixas — que decide
esperar o Wi-Fi ou apagar um álbum para caber outro.

São quatro estados, e a leitura continua por eliminação:

| Estado | Barra |
|---|---|
| sem índice | `não sincron.` |
| nada baixado | `~230 MB` — só o que vai custar |
| parcial | `19/~249 MB` |
| completo | `2,3 GB`, exato (soma do catálogo, sem `~`) |

Enquanto o download roda, o resumo dá lugar ao progresso ao vivo. A contagem de
faixas não se perde: ela continua no chip **Sincronizados** das opções do
álbum, que é onde mora o detalhe. E os três contadores da tela — card,
cabeçalho de categoria e "Todo o acervo" — usam a MESMA função: um deles em
faixas e outro em MB seria a pior das versões.

O número é bem mais largo que o `2/4` de antes e divide a linha com o **nome**
do álbum, que é a informação principal — daí meio ponto de fonte a menos em
`.coll-bar-sync`, que devolve um caractere de nome sem comprometer a leitura de
um número secundário. (`.coll-bar-peso`, criado na v5.93 só para o álbum
completo, durou uma versão: com o resumo virando peso em todos os estados, ele
era a mesma coisa com outro nome.)

Os **contadores de GRUPO** (`.coll-group-count`, no cabeçalho de categoria e em
"Todo o acervo") ficam mesmo completos: eles somam várias coleções, e ali o
número ainda responde alguma coisa — é o único lugar que diz que o grupo inteiro
está no aparelho. Desde a v5.94 eles somam PESOS, pela mesma razão dos cards
(e "Todo o acervo" é onde a soma mais importa: são vários GB). É também o último uso do verde de "concluído" nesse contexto:
`.coll-bar-sync.done` saiu com o contador do card.

**Uma coleção aberta por vez** (abrir uma fecha as demais): duas listas de
centenas de faixas empurrariam o acervo para fora da tela e tirariam do lugar
exatamente o card que o operador estava mirando. Dentro do aberto vem a lista
**inteira** de músicas — sem teto, porque ali o operador está folheando um
álbum, não filtrando o acervo, e cortar em 60 esconderia o fim de qualquer
hinário. As linhas são as mesmas `hymnResultRow` da busca, com `semColecao`
ligado: repetir o nome do álbum nas dez faixas é ruído, o card em volta já diz
de quem elas são. Com as opções pedidas (abaixo), o painel delas vem ANTES da
lista.

#### …mas ela CHEGA em páginas de 100 (v5.74)

"Inteira" é sobre o que está disponível, não sobre o que é montado no toque.
Um hinário tem **613 hinos**, e cada linha é um `<li>` com miniatura, dois
botões e SVG inline dentro deles: montar as 613 de uma vez é um bloco de
JavaScript **síncrono** no meio do toque que abre o card — a animação de
abertura nasce engasgada e o toque parece não ter funcionado. E não é uma vez
só: o card é remontado a cada redesenho do acervo, que o progresso de um
download dispara a cada `COLL_REFRESH_MS`.

`fillSongList(lista, coll, u)` monta `COLL_PAGE` (100) linhas e pendura uma
**sentinela** (`.coll-more`) no fim. Quando ela entra na tela, a página seguinte
é anexada e a sentinela se remuda para o novo fim, até acabarem as faixas.

- **O gatilho é o SCROLL, não um botão.** Quem folheia um hinário está
  procurando um hino, não administrando uma lista: parar para pedir mais é
  atrito num gesto que já é contínuo. A sentinela **também** é um botão, para o
  caso de ela aparecer sem que a rolagem a tenha alcançado (uma lista curta
  demais para rolar dentro do popup) — mas o caminho normal não passa por ele.
- **`IntersectionObserver` com `root: null`.** A viewport resolve sozinha o
  problema de descobrir QUAL elemento rola (hoje `#hymnResults`, amanhã outro):
  a interseção com a viewport já vem recortada pelos `overflow` dos ancestrais,
  então a sentinela só "aparece" quando de fato aparece na tela. O
  `rootMargin: '300px'` adianta a página — o objetivo é que o operador **nunca
  chegue a ver** essa linha.
- **É INCREMENTAL.** A página nova é anexada às linhas que já estão no DOM, sem
  reconstruir as anteriores: reconstruir mexeria no scroll debaixo do dedo que
  acabou de pedir a página.
- **`u.shown` mora no estado de UI do card** (ao lado de `u.expanded`), então um
  redesenho por progresso de download reencontra o mesmo ponto — quem já rolou
  até o hino 400 continua vendo 400.
- **Fechar zera.** Reabrir um hinário que ficou rolado até o fim traria os 613
  de volta de uma vez, que é exatamente o custo que a paginação existe para
  evitar.

#### O canto da barra: de engrenagem a seta que FECHA (v5.72 → v5.95)

Aberto o card, aquele canto **toma a caixa do botão de baixar** na barra
(`.coll-bar-cfg`, herdando `.coll-bar-dl`): mesma coluna, mesmo alvo. Os dois
nunca fazem falta ao mesmo tempo — fechado, o que se decide é "baixo isto?";
aberto, já se está olhando o conteúdo. Foi uma **barra larga rotulada** dentro
do card por duas versões (`.coll-open-cfg`, "Sincronizar e opções"): uma linha
inteira gasta com o que cabe no canto que já existia. Virou **engrenagem** na
v5.72, e **seta para cima** quando o painel estava aberto (v5.73).

**Na v5.95 a engrenagem sumiu e sobrou só a seta — fechando o ÁLBUM.** Com as
duas ações encolhidas numa linha só (ver abaixo), as opções cabem SEMPRE que o
card está aberto, e um botão para revelar duas ações que já caberiam na tela é
cerimônia: some o estado `optsOpen`, some o `gearIconSvg` e some o
`.coll-bar-cfg.on`. O alvo continua o mesmo canto de sempre; o que ele faz
agora é o que a seta já dizia — recolher o que está abaixo dela. (O toque na
barra continua alternando: são dois gatilhos para o mesmo `alternarAcordeao`.)

**A exceção é o download EM CURSO.** Ali o botão da barra é o CANCELAR, e ele
continua lá mesmo com o card aberto — um álbum de centenas de faixas, uma vez
começado, precisa poder parar num toque. Nesse estado o álbum se fecha pelo
toque na barra.

### Os acordeões abrem animados

Um acordeão que troca `display` aparece **pronto**, e num toque a lista inteira
abaixo dá um salto — o operador perde de vista onde estava. Animar a altura
mostra de onde o conteúdo saiu, que é a única informação que o salto destrói.
Vale para os dois acordeões do acervo: o **card do álbum** e a **letra** de cada
linha de música.

- **A altura é MEDIDA e animada em JS** (`expandAccordion`/`collapseAccordion`,
  Web Animations API, `ACC_MS` = 220 ms). `auto` não é animável em CSS, e um
  teto fixo cortaria a letra de um hino de 40 linhas ou deixaria um vão enorme
  depois de um refrão de duas.
- **`offsetHeight`, não `scrollHeight`.** A caixa da letra tem teto
  (`max-height: 40vh`) e rola por dentro: o conteúdo de um hino longo passa
  muito do que ela de fato ocupa, e animar até lá abriria um vão e depois
  recuaria.
- **O `overflow: hidden` é devolvido no fim** (`finish` **e** `cancel`). Sem
  isso a lista de músicas ficaria presa à altura do instante em que a animação
  foi montada — e a letra que uma linha abrisse depois seria cortada.
- **O card ganhou um invólucro** (`.coll-open`, com o painel de opções e a lista
  dentro) só para a animação ter UM nó a recortar. O `overflow` não podia ir no
  card: a barra dele é `position: sticky`, e um ancestral com overflow recortado
  a prende. As margens negativas do invólucro repetem as de `.coll-songs` (que
  sangra até a borda do card para o filete do topo atravessar a largura toda) —
  o recorte acontece na borda do **padding**, então esse par margem/padding põe
  a linha de corte exatamente na borda do card.
- **A abertura do álbum é sinalizada pelo render, não pelo clique**
  (`ui(coll.id).animarAbertura`): o card só existe depois de `redesenharAcervo()`
  reconstruir a lista inteira, e a bandeira é consumida ali. Só o toque que
  ABRIU anima — um redesenho por outro motivo (o progresso de um download)
  reencontra o card já aberto, e vê-lo "abrir" sozinho leria como se algo
  tivesse acontecido.
- **Fechar anima ANTES de redesenhar**: o redesenho apaga o nó, e um nó apagado
  não tem como sair deslizando.
- **A letra é montada antes de a linha abrir.** `montarLetra()` é assíncrona, e
  uma caixa ainda vazia mediria zero. Quem rola até a linha que casou com a
  busca passou a ser o chamador, depois de abrir — `scrollIntoView` numa caixa
  `display:none` é no-op.
- **`prefers-reduced-motion: reduce` desliga tudo** (`semMovimento()`): quem
  pediu menos movimento no sistema pediu isso para o app inteiro. Sem animação o
  acordeão abre e fecha como antes, instantâneo.

> O card já foi um **acordeão de "check do sistema"**: expandia um painel de
> status, e as músicas só eram alcançáveis por um botão "Ver músicas" ou pela
> busca. O toque natural no álbum fazia a coisa menos útil. Depois virou um
> atalho para uma **segunda tela** com a lista (`openCollectionSongs`, com
> voltar próprio e um degrau em `__avBack`) — e entrar e sair para ver o que
> tem dentro é caro quando a pergunta é "em qual deles está aquela música?".
> Hoje o acordeão voltou, mas expandindo a **lista**, não o status: o mecanismo
> antigo com um conteúdo novo. `openCollectionSongs` e o `searchScope` que a
> acompanhava não existem mais.

> **Vocabulário: na TELA ela se chama "Biblioteca"** (v5.96). No código e neste
> documento ela continua sendo o **acervo** — `hymnSearchPopup`,
> `renderAcervoTotal`, `openHymnSearch` —, e renomear centenas de símbolos e
> parágrafos para acompanhar um rótulo seria um diff enorme sem nada em troca.
> A tradução é esta: *acervo* (código) = *Biblioteca* (rótulo). Cuidado com o
> outro sentido de "biblioteca" que já existia por aqui — o IndexedDB/OPFS com
> tudo o que o operador baixou (ver as regras de backup em CLAUDE.md); nos
> textos VISÍVEIS ele passou a ser chamado de "os dados do app", para as duas
> coisas não dividirem a mesma palavra na frente de quem usa.

**Opções da coleção** (`buildCollectionOptions` → painel `.coll-opts--inline`,
dentro do card): tudo que é manutenção — uma faixa de **dois chips**
(`.hymnal-stat`) e **dois botões lado a lado**. Não há "Ver músicas" aqui: a
lista é o **toque no card**. Desde a v5.95 elas aparecem **sempre** que o álbum
está aberto: não há mais botão para revelá-las.

- **`Sincronizados`** (`.hymnal-stat.sinc`) diz as duas coisas na mesma linha:
  quantas faixas estão no aparelho e o que isso significa — `4/4 · Completo
  offline` (com ✓, em verde), `1/4 · Parcial`, `— · Não sincronizado`.
- **`Peso`** (`medirColecao`), à direita (`.hymnal-stat.right`,
  `flex: 0 0 auto`): é o número curto e secundário da linha, e ancorá-lo na
  borda oposta dá ao chip de sincronização a largura de que ele precisa. Ele diz
  as DUAS medidas (v5.93) — `3,7 de ~18 MB`: só o que está no aparelho não
  responde "quanto isto vai custar", e só o total esconde o que já foi gasto.
  Completo, os dois seriam o mesmo número dito duas vezes, então fica um só e
  sem "~". A unidade aparece uma vez quando é a mesma nos dois (`fmtParBytes`);
  se divergirem (`800 KB de ~1,2 GB`), as duas ficam — "800 de ~1,2 GB" seria
  falso.
- **Os dois botões dividem UMA LINHA** (`.coll-opts-acoes`, v5.95). Empilhados,
  eram duas faixas largas para duas ações curtas — e era esse tamanho que
  obrigava a esconder o painel atrás de uma engrenagem. `flex: 1 1 0` nos dois:
  metade da linha para cada um, independentemente do comprimento do rótulo
  (duas larguras diferentes leriam como dois pesos diferentes, e a ação
  destrutiva não pode ser a maior das duas). O rótulo QUEBRA em duas linhas em
  vez de virar reticências — "Remover do disposi…" esconde justamente a palavra
  que diz o alcance da ação.
- **Sincronizar** (`syncCollection`), rotulado pelo que ESTE toque vai fazer
  neste álbum: **"Verificar atualizações"** com o álbum inteiro no aparelho
  (não há o que baixar — só conferir se o catálogo mudou), **"Baixar"** em
  qualquer outro caso, e **"Cancelar"** enquanto roda. Os dois últimos
  encurtaram na v5.95 junto com a linha: o card em volta já diz de que álbum se
  trata e a barra logo acima já mostra o progresso, então a palavra que sobrava
  era a que repetia o contexto.
- **"Remover do dispositivo"** (`deleteCollection`) — era "Excluir downloads do
  álbum". O que sai é o que ocupa espaço NESTE aparelho, e o álbum continua no
  acervo para baixar de novo; "excluir" prometia um dano maior do que o que a
  ação faz.

#### O que a v5.73 tirou daqui, e por quê

Eram **três chips e uma linha de status**, e três dos quatro repetiam algo que
já estava na tela:

- **A linha de status saiu.** Parada, ela dizia numa linha inteira o mesmo que o
  chip logo abaixo ("Completo offline", "Parcial", "Não sincronizado"); em
  movimento, repetia palavra por palavra o `Baixando 2 de 4…` que a **barra do
  card** mostra dois centímetros acima — e a barra é `sticky` no topo do aberto,
  logo nunca sai de vista enquanto se lê o painel. Com ela saíram
  `.hymnal-card-status` e suas variantes.
- **"Sincronizados" e "Completo offline" viraram um chip só.** Separados, `4/4`
  e "Completo offline" eram a mesma frase dita duas vezes — e a segunda ainda
  ocupava a largura toda.
- **O chip "Rede" saiu**, e com ele `wifiIconEl()`, seu único consumidor. A
  regra não mudou: quem decide se a sincronização em massa pergunta antes de
  usar dados móveis continua sendo `isConfirmedWifi()`, e ela o diz **na hora,
  no diálogo** — que é onde a informação tem consequência. Um chip permanente
  repetindo o estado da rede em cada álbum aberto era ruído entre dados sobre o
  ÁLBUM.

**Elas eram um bottom-sheet** (`#collPopup`, com degrau próprio de `z-index` e
uma linha em `POPUPS`). Viraram um painel DENTRO do card na v5.72: um popup
sobre o acervo — que já é um popup de tela cheia — era uma camada a mais para
ver o peso e o estado de um álbum **que já estava aberto na tela**. No painel,
fechar é o mesmo toque na engrenagem que abriu, e o `POPUPS`/`z-index` deixaram
de ser necessários — um painel não é uma camada.

- **`u.optsOpen`** é o estado, ao lado de `u.expanded`, em `ui(coll.id)`:
  transitório por sessão, como o resto do estado de UI do card.
- **Não há mais `refreshCollectionOptions`.** O painel é redesenhado junto com o
  acervo, e o progresso da sincronização já dispara
  `refreshCollectionsIfVisible` — não sobrou um popup com vida própria para
  sincronizar à parte.
- **Uma coleção SEM índice abre direto nas opções**: `openCollectionOptions`
  liga `expanded` **e** `optsOpen`. Ali não há lista para folhear, e o que
  resolve isso (sincronizar) está no painel — é para onde o toque na barra leva
  quando `total === 0`. Por isso a condição de abertura do card passou a ser
  `u.expanded && (total > 0 || u.optsOpen)`.

**O botão de sincronizar é o mesmo botão de CANCELAR.** Com o download em
curso ele vira ✕ ("Cancelar o download", em `--warn` e **sem
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

#### A medição do peso (v5.93)

São **duas perguntas**, e só uma tem resposta exata:

1. **quanto já está no aparelho** — soma dos `size` do catálogo OPFS da pasta da
   coleção. É EXATO, e cobre tudo que o download traz: os áudios Cantado e
   Playback, a capa e as imagens de fundo da letra.
2. **quanto pesa o álbum inteiro** — o que falta ainda não veio, então é
   ESTIMATIVA. O `~` na tela é parte da informação, não enfeite.

**A estimativa é por DURAÇÃO, não por contagem de faixas** — era por contagem
até a v5.92 (`bytes / baixados × pendentes`). Áudio é bytes por segundo: num
hinário, em que as faixas têm durações parecidas, os dois métodos empatam; num
álbum com um louvor de 2 min ao lado de um de 9, a média por faixa erra por um
fator de quatro, e erra logo na pergunta que decide um gasto de dados móveis. A
duração já está no índice (`duration`, `"HH:MM:SS"`).

**A taxa é MEDIDA no aparelho** — bytes no disco ÷ segundos baixados —, e não
uma constante de bitrate. Isso amortiza sozinho o que não é áudio (capas e
imagens de letra pesam, e as faixas que faltam trarão as suas) e acompanha o
bitrate real do acervo. A escada de fontes vai da mais específica à mais
genérica: a taxa **deste** álbum → a média de tudo o que já foi baixado no
aparelho → 128 kbps (`BPS_PADRAO`). Sem o último degrau, um álbum ainda vazio
não teria tamanho nenhum a mostrar — que é exatamente quando a informação mais
importa.

Duas ressalvas honestas: o **Playback** conta com a duração do Cantado (a lista
leve não traz `instrumental_duration`, e é a mesma música), e uma faixa **sem
duração** no índice entra por `SEG_PADRAO` (3min30) em vez de somar zero — que
faria o álbum parecer menor do que é.

**O peso medido PERSISTE** (`state['coll-bytes']`). `collUI` é estado de
sessão: até a v5.92 o peso de um álbum só existia depois de o operador abrir as
opções dele, e fechar o app o apagava. Agora ele aparece na barra de todo álbum
completo, e recontar o catálogo de cada um a cada abertura é caro pelo motivo
logo abaixo. A escrita é coalescida (o contador sobe a cada arquivo baixado; um
`setState` por música seria uma transação de IDB por download), e um álbum com
músicas no aparelho e peso zerado — quem baixou antes da v5.93 — é recontado
**uma vez por sessão** (`conferirPesoSeFaltar`, com um `Set` que impede o
`refreshCollectionsIfVisible` de dentro da recontagem de virar laço).

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

**`syncCollection` devolve `{ ok, baixados, falhou }`.** Ela já devolveu
`undefined` em todos os caminhos, e por isso uma queda de rede era **invisível
para o chamador** — o `syncGroup` varria dezenas de álbuns em segundos sem
baixar nada e ainda anunciava sucesso. Convenção: `ok:false` é "não deu para
baixar" (rede, armazenamento, erro); **cancelar ou já estar completo é
`ok:true`**, porque nos dois casos o sistema fez o que devia.

Na mesma linha, `downloadCollectionSong` devolve `false` quando nem os
metadados vieram, e o worker separa `done` (tentativas — é ele que move a
barra) de `falhou`. Sem essa separação, uma queda de rede fazia o rodapé
anunciar "Atualizado (60 baixado(s))" com **zero bytes no disco**: a falha era
engolida e o worker contava a música como baixada. Hoje o status final diz
"Atualizado (N baixado(s)) · M sem rede".

**A ordem entre `bgTaskEnd` e `withBgWork` importa**, e é a mesma nos quatro
fluxos de massa (`syncCollection`, `syncGroup`, `ensureBibleVersionDownloaded`,
`syncLyrics`): o `bgTaskEnd` fica **dentro** do `withBgWork`. Um `finally`
externo roda *depois* do `finally` do `withBgWork`, e é este último que solta o
serviço em primeiro plano e **limpa o registro de tarefas** — encerrar a tarefa
depois disso chegava sempre tarde demais, sem efeito nenhum. Encerrar a tarefa
primeiro e só então soltar o serviço é a ordem correta.

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
(`visibilitychange` — o mesmo handler único que também desliga o microfone ao
minimizar), buscam-se (fase 1) os **índices leves dos hinários** (id/número/nome/duração/
tem-playback — **sem** áudio nenhum) + o **catálogo de álbuns** (nomes dos
cards, via `fetchAlbumCatalog`); e (fase 2) o **índice leve de CADA álbum**
(`album_{id}.musics`, também só metadados), com concorrência limitada
(`runLimited` com `NET_CONCURRENCY`) e TTL (`ALBUM_INDEX_TTL`, 12 h — pula álbuns indexados há
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

**Busca/lista — um popup só, e O CAMPO É A CHAVE.** `#hymnSearchPopup` é
aberto exclusivamente pelo botão de lupa (`#hymnSearchBtn`, SVG inline, à
direita das abas), com o título fixo "Acervo". `searchIsBrowsing(q)` é
literalmente `!q`: **campo vazio** = o navegador de coleções (cabeçalhos de
categoria e cards, com as músicas de cada uma dentro do próprio acordeão); **com texto** = a lista de músicas que casam, varrendo **todas** as
coleções indexadas. Não existe mais um "modo coleção" separado — o escopo por
coleção (`searchScope`, com título próprio e um degrau de navegação) foi
substituído pelo acordeão do card, que mostra o álbum **sem perder o acervo de
vista em volta**.

`renderSearchResults` monta os resultados dos índices já em memória
(`collState`, filtro em memória), então funciona sem rede assim que os índices
tiverem sido buscados ao menos uma vez (hinários e álbuns entram sozinhos via
`autoRefreshCollections`); se o popup estiver aberto quando um índice atualiza,
a lista se re-renderiza na hora. Cada resultado carrega sua `coll` para
tocar/adicionar/baixar sob demanda, e o subtítulo mostra a coleção de origem.

**A busca mantém o teto de 60 resultados**, com uma linha final dizendo quantos
ficaram de fora: ela varre milhares de músicas de todos os álbuns e renderizar
tudo a cada tecla travaria o campo. Folhear uma coleção INTEIRA não passa por
aqui — é o acordeão do card, que lista tudo.

### "Pesquisar <texto> no YouTube", no fim da busca (v5.76)

O acervo é o LouvorJA, e ele não tem tudo: um louvor gravado pelo coral da
igreja, um clipe, um hino numa versão específica. Até aqui a saída era sair do
app, abrir o YouTube, **digitar tudo de novo** e compartilhar de volta — e o
"digitar tudo de novo" acontecia com o texto já digitado na tela em que se
acabou de descobrir que a música não está no acervo. `appendYoutubeSearch` fecha
esse caminho: leva a busca pronta e devolve o operador ao ponto em que o
`intent-filter` de share (`ShareIntake.kt`) já sabe receber o vídeo. A ida
passou a existir; a volta já existia.

- **Em todos os desfechos da busca**, inclusive (e principalmente) "Nenhuma
  música encontrada" — que é exatamente quando a pergunta "e agora?" aparece.
  Não aparece enquanto se FOLHEIA o acervo (sem texto não há o que pesquisar).
- **O texto vai entre aspas** porque é ele que diz que o toque leva ISTO, e não
  abre o YouTube na página inicial. Entra por `textContent`, nunca `innerHTML`:
  é texto digitado pelo operador. Termo comprido corta em reticências.
- **Uma LUPA, não o logotipo do YouTube.** O que o botão faz é uma busca;
  desenhar a marca de outro app promete que ele abre lá dentro em algum lugar
  específico. Quem nomeia o destino é o texto ao lado.
#### E, desde a v5.85, a BUSCA acontece aqui dentro

O botão continua sendo o mesmo, mas num shell ≥ 18 ele **não sai mais do app**:
`AVNative.ytSearch(termo)` devolve os resultados e eles entram **na mesma
lista**, abaixo do botão, com miniatura 16:9, título, canal e duração. O toque
num resultado **já baixa** — o aviso vai para a linha do Cronograma (v5.84) e a
linha do resultado fica marcada, porque o acervo continua aberto e sem essa
marca o operador toca de novo achando que não pegou.

Isso encurta um caminho que era absurdo: sair do app, abrir o YouTube,
pesquisar de novo, compartilhar de volta, esperar. Agora é digitar uma vez.

- **O pedido sai em português** — e o caminho para isso não é o óbvio.
  A localização padrão da biblioteca é **en-GB**, e o YouTube leva isso a
  sério: ele TRADUZ o título quando o canal publica traduções ou quando a
  tradução automática está ligada. O resultado era uma busca por louvor
  brasileiro voltando com títulos em inglês de vídeos cujo título original é em
  português — o operador procurava por um nome que não estava mais ali.
  - A v1.32 passou `Localization("pt","BR")` para o `NewPipe.init`, **e não
    adiantou**: `StreamingService.getLocalization()` FILTRA o pedido pela lista
    de idiomas suportados do serviço, e a do YouTube no `NewPipeExtractor`
    (v0.26.1 então, v0.26.4 hoje — segue igual) tem um item só — `"en-GB"`, com
    o resto da lista **comentado** no
    fonte. Qualquer outro idioma cai no `Localization.DEFAULT`, que é o mesmo
    en-GB, em silêncio e sem erro nenhum: o código PARECIA certo. O país
    escapava do filtro (a lista de países é completa e tem "BR"), então só
    metade do pedido chegava.
  - A saída (v1.33) é `forceLocalization`/`forceContentCountry` no próprio
    `Extractor`, que é a válvula que a biblioteca oferece para exatamente isto
    — `getExtractorLocalization()` lê o forçado ANTES da lista de suportados.
    Ela exige montar o extrator à mão nos dois caminhos (`getStreamExtractor` e
    `getSearchExtractor`) em vez dos atalhos `getInfo(service, …)`, e no da
    busca **chamar `fetchPage()`**: `SearchInfo.getInfo(extractor)` é o único
    dos `getInfo` que NÃO busca a página sozinho, e sem isso a lista volta
    vazia, sem erro.
  - O código é `"pt"`, não `"pt-BR"`: a lista (comentada) que a própria
    biblioteca guarda como os `hl` que o YouTube aceita tem "pt" e "pt-PT". Com
    o `gl=BR` do `ContentCountry`, "pt" é o português do Brasil.
  - `Accept-Language` acompanha no `NpDownloader`, fixo no mesmo código: quem
    manda de fato é o `hl` do corpo InnerTube, mas nem toda requisição da
    biblioteca é InnerTube, e nas páginas HTML é o cabeçalho que decide.
  - Fixo, e não herdado do `Locale` do aparelho: o que se quer é o título
    ORIGINAL, e um celular configurado em inglês traria a tradução de volta.
- **Quem pesquisa é o Kotlin** (`YoutubeGrab.pesquisar`, o mesmo
  `NewPipeExtractor` da extração), e não o WebView: ali não existe CORS, e a
  requisição sai do IP do aparelho. As duas alternativas não serviam — um
  `<iframe>` da página de resultados é recusado pelo `X-Frame-Options` do
  YouTube, e a API oficial exigiria uma chave embutida no APK com cota diária
  dividida por toda a frota.
- **Só vídeos** no filtro de conteúdo: canal e playlist não têm o que fazer numa
  lista cujo único destino é virar arquivo de mídia.
- **O nome do canal sai da frente do título** (`tituloLimpo`, v1.31). Meio
  YouTube publica como "Arautos do Rei - Firme nas Promessas", e no Cronograma
  isso vira uma lista em que a metade esquerda de toda linha é a mesma palavra —
  justamente a parte que não distingue um item do outro. O canal não se perde:
  ele continua no subtítulo do resultado da busca, que é onde ajuda a escolher.
  A remoção é conservadora — só corta quando o título COMEÇA exatamente com o
  nome do canal seguido de um separador, então "Hino 512 - Ao Deus de Abraão"
  fica inteiro. E o sufixo `- Topic` (canais que o YouTube gera sozinho para
  música) é descontado antes da comparação, senão ela nunca casaria justamente
  nos vídeos de louvor.
- **A miniatura é montada a partir do ID** (`i.ytimg.com/vi/<id>/mqdefault.jpg`)
  em vez de vir da biblioteca: é uma URL estável há mais de uma década, e assim
  o formato das imagens do extrator — que já mudou entre versões — deixa de ser
  algo capaz de quebrar a lista.
- **Digitar outro termo descarta os resultados anteriores**: uma lista de outra
  busca embaixo do campo é pior que nenhuma.
- **Chegar no fim da lista já pesquisa** (v5.86, `armarAutoBuscaYt`). Rolar até
  o fim do que o acervo tem É o gesto de quem não achou o que queria, e nesse
  ponto pedir mais um toque é cerimônia.
  A espera de 500 ms não é enfeite — a lista é reconstruída A CADA TECLA, e com
  poucos resultados a sentinela nasce visível: sem ela a busca dispararia com o
  termo pela metade ("Fir"), uma vez por letra. O termo é reconferido quando o
  prazo vence, porque ele pode ter mudado durante a espera. E a auto-busca
  **não** acontece num shell < 18, onde o botão abre o YouTube por fora: tirar o
  operador do app sem ele ter pedido seria outra coisa.
- **O botão manual SAIU onde o shell sabe pesquisar** (v5.91). Ele existia para
  quem decidisse antes de rolar; com a busca disparando sozinha ao chegar no
  fim, virou um botão que quase sempre era apertado depois de a busca já ter
  começado. No lugar dele fica um **cabeçalho de seção** (`.yt-head`), que faz
  os três papéis que ele fazia e nenhum a mais: é a SENTINELA que o observador
  vigia (por isso precisa de altura de verdade — um `li` de altura zero é uma
  aposta na forma como o navegador trata a interseção de área nula), é o sinal
  de que a busca está em curso (anel + "Procurando no YouTube…") e, depois, o
  rótulo que separa o acervo dos resultados ("Resultados do YouTube:", ou "Nada
  encontrado no YouTube."). O termo entre aspas saiu junto com o botão: ele
  dizia "vou levar ISTO para fora do app", e numa linha de estado logo abaixo
  do campo em que o operador acabou de digitar ele só quebrava a frase em duas
  linhas. **O botão continua onde é a única saída**: navegador e shell < 18, que
  não sabem pesquisar de dentro do app.
- **Cabeçalho, e não linha de aviso** (v5.92). O que vem abaixo dele não é mais
  o acervo, e até aqui a lista não dava esse degrau: as duas origens vinham
  coladas, com a mesma anatomia de linha, e só o nome do canal no subtítulo
  denunciava a troca. O filete em cima é a separação; o alinhamento à ESQUERDA
  e o peso são o que fazem ler como título de seção — centrado, lia como mais
  um item da lista. Pela mesma razão a frase do acervo vazio virou "Nenhuma
  música encontrada **no acervo**": com o cabeçalho do YouTube logo abaixo, uma
  negativa sem escopo parece negar a busca inteira.
- **O toque num resultado abre a MESMA folha de três escolhas das músicas do
  acervo** (v5.86): *Tocar agora* · *Adicionar à playlist* · *Adicionar ao
  Cronograma*. Antes o toque baixava direto — o operador não escolhia nada e o
  vídeo caía no Cronograma quisesse ele ou não.
  - **"Tocar agora" FECHA o acervo**, pela mesma regra de `playSongVariant`: o
    cartão de progresso mora na preview, e a preview está atrás desta bandeja.
  - **As duas de "adicionar" MANTÊM o acervo aberto** — quem está buscando
    provavelmente vai pegar mais de um. Ali o aviso é a própria linha, e ela
    termina marcada como **concluída** (✓ verde sobre a miniatura) em vez de
    voltar ao estado inicial: era essa volta silenciosa que fazia parecer que
    nada tinha acontecido.
  - O estado de cada linha vive num Map (`ytEstado`), não na classe do nó: a
    lista é reconstruída a cada tecla e a cada redesenho, e a marca sumiria com
    o download ainda correndo — mesma razão do `songRowBusy` das músicas.
  - Concluído fica APAGADO, não desabilitado: o mesmo vídeo pode ser querido de
    novo (uma vez na playlist, outra no Cronograma).
  - **Cada escolha vai só para o SEU lugar** (v5.87). Até a v5.86 as três caíam
    no Cronograma junto, porque quem escolhia a lista era o `addMedia` e ela era
    sempre `imports`: pedir "Tocar agora" enchia a lista do culto de vídeo que o
    operador só quis ver uma vez, e "Adicionar à playlist" deixava o item em
    dois lugares sem ninguém ter pedido. A lista de destino agora é decidida no
    `ytAcao` (`YT_LISTA`) e entregue ao `addMedia`, que continua gravando
    registro e entrada na lista na MESMA transação — a lista passou a ser
    escolhida, não dispensada, justamente para o registro nunca nascer órfão.
    "Tocar agora" vai para `avulsos` (ver o modelo de dados), e é por isso que o
    subtítulo dos dois primeiros itens diz "sem entrar no Cronograma": é a
    diferença entre as três opções, e ela não se adivinha pelo ícone.
  - **O mesmo vídeo não baixa duas vezes** (v5.87, `ytArquivo`). Escolher um
    destino e depois outro para o MESMO resultado eram dois downloads de dezenas
    de MB, provavelmente em rede de celular. O registro guarda o `youtubeId`
    desde que nasce, então a pergunta "já tenho isto?" é uma leitura do índice
    (`AVDB.mediaByYoutube`). Só vale para quem tem **blob**: um item de player
    carrega o mesmo `youtubeId` e é justamente o que o download existe para
    substituir — aceitá-lo faria o botão "baixar o vídeo" da linha do Cronograma
    devolver o próprio link e parecer que não fez nada. Vale também para o
    compartilhamento do mesmo link (`handleSharedUrl`).
  - **O resultado que já está no aparelho nasce marcado** (`marcarYtProntos`):
    o ✓ passa a dizer as duas coisas — "acabou de baixar" e "já estava aqui" —,
    que é o que o operador precisa saber antes de escolher o destino. É
    assíncrono: a lista não espera o IDB, e o estado mora no `ytEstado`, logo
    sobrevive ao próximo render.
  - **No SIMPLIFICADO não há folha nenhuma: o toque toca.** As outras duas
    opções são listas que aquela tela nem mostra, e abrir três escolhas seria
    devolver ao operador exatamente a decisão que esse modo poupa — é a mesma
    regra do toque numa música ali (`simplePlaySong`). Vale para TUDO o que é
    compartilhado com o app nesse modo — link e arquivo (v5.89): a tela não tem
    Cronograma nem playlist, e o que chega ali chega para ir ao telão.
    A prateleira nunca poda o LOTE que acabou de entrar: um share de cinco
    arquivos com o limite aplicado item a item faria o quinto expulsar o
    primeiro — e o primeiro é justamente o que vai ser projetado. Quem cede
    lugar é sempre o que já estava lá de antes, e a fixação é UMA só por share
    (duas chamadas fariam a segunda expulsar a primeira).
  - **Onde o aviso aparece tem TRÊS destinos, não dois.** Tocar: cartão sobre a
    preview. Cronograma: linha provisória na lista (a regra da v5.84). Playlist:
    **nenhum dos dois** — ela mora dentro de uma bandeja fechada, não há linha
    para marcar, e desenhar a provisória no Cronograma prometeria um item que
    nunca vai aparecer lá; ali quem mostra o andamento é a própria linha do
    resultado e a notificação do sistema.
- Num shell < 18 o botão volta a ser o que sempre foi: abre o YouTube por fora.


- **Ele exige shell ≥ 15** (`AVNative.openExternal`), e por isso **não é
  desenhado** num shell mais antigo: o WebView recusa navegar para fora do
  origin, então ali o toque não faria nada — nem erro no console. Um botão morto
  no meio de um culto é pior que botão nenhum. No navegador é `window.open`, sem
  condição nenhuma.

Diferente dos demais popups (bottom-sheets), a bandeja **desliza a partir do
TOPO** (CSS: `#hymnSearchPopup` com `align-items:flex-start`, `.popup-sheet` com
`translateY(-100%)` e cantos arredondados embaixo) — além de ser o pedido de UX,
casa com o teclado, que sobe da base sem cobrir os resultados. O campo de busca
usa `.lib-search`, hoje com `appearance:none` + supressão das pseudo-partes
`::-webkit-search-*` (mata o visual nativo do `type="search"`).

**Nome normalizado uma vez, não por tecla** (`s._norm`, gravado por
`fetchCollectionIndex` e preenchido sob demanda no filtro): `normalizeForSearch`
faz `normalize('NFD') + replace + toLowerCase` — três alocações de string sobre
um valor que nunca muda, antes repetidas para **cada música do acervo a cada
tecla digitada**. Os dois campos de busca (acervo e pasta) também passaram a ter
**debounce** (`SEARCH_DEBOUNCE_MS` = 130 ms): a busca dentro de uma pasta OPFS
refaz a lista inteira com `innerHTML=''` e um object URL novo por miniatura, e
numa pasta de centenas de arquivos isso acontecia a cada tecla, com a lista
ainda quase inteira nas primeiras letras.
**Linha compacta, DOIS botões** (`hymnResultRow`, v5.63): o resultado é
`[▶ 46px] [nome / subtítulo] [+]`. Tocar na **linha** abre a letra logo abaixo,
em **acordeão** (abrir uma fecha a anterior: duas abertas ao mesmo tempo
empurrariam a lista e tirariam do lugar o que o operador estava mirando). A
lista precisa ser legível de relance no meio do culto, e é por isso que a fonte
é maior que a do resto (`.hymn-name` em `1.02rem`); o subtítulo (`.hymn-sub`)
tem só a coleção de origem, na busca global.

Até a v5.62 as ações eram **seis botões mudos** revelados pelo toque — dois
grupos de três (Cantado e Playback), cada um com tocar, +Cronograma e
+Playlist. Seis ícones dividindo a largura de um celular não cabem com rótulo,
então nenhum tinha: a diferença entre "+ playlist" e "+ cronograma" era um
desenho de 19px, e a escolha errada no meio do culto só aparecia depois. Dois
alvos grandes, sempre à vista, com as opções **escritas** na folha que cada um
abre, trocam seis adivinhações por duas leituras.

- **O ▶ ocupa o lugar da miniatura** (`.hymn-play-thumb`, 46px, `accent-soft`).
  Ali havia um ícone decorativo — a mesma nota musical em todas as faixas do
  álbum — no maior alvo livre da linha, gasto com o único elemento que não
  informava nada.
- **A DURAÇÃO SAIU** (`.hymn-time`, removida). Ela ocupava a única sobra de
  largura da linha para dizer "3:47", que não decide nada: ninguém escolhe o
  louvor pelo tempo dele, e quem precisa do número o tem na barra de progresso
  assim que a música entra. Esse lugar é do botão de adicionar
  (`.hymn-add-btn`), que decide.
- Os dois botões dão `stopPropagation` — eles dividem a linha com o acordeão da
  letra. (Antes as ações eram **irmãs** de `.hymn-row` dentro do `<li>`, e por
  isso não borbulhavam; agora estão DENTRO da linha, que é o que as põe sempre
  à vista.)
- **O acordeão da letra fecha as irmãs no escopo da PRÓPRIA `<ul>`**, não em
  `hymnResultsEl`: as linhas de dentro do card de um álbum vivem noutra lista, e
  ali a regra simplesmente não valia — abrir a terceira faixa deixava as duas
  anteriores abertas.

**A folha rápida** (`openSongMenu(coll, s, modo)` → `#songMenuPopup`) é a mesma
para os dois botões, com listas diferentes (`renderSongMenu`):

| Botão | Opções |
|---|---|
| ▶ | **Tocar música cantada** · **Tocar playback** (só com `has_instrumental_music`) · **Apenas a letra** |
| ➕ | (seletor **Cantada \| Playback**, só com playback) · **Adicionar à playlist** · **Adicionar ao Cronograma** · **Adicionar aos favoritos** |

- A escolha Cantada/Playback do ➕ é um **seletor no topo** (`.fit-seg`) em vez
  de dobrar a lista de destinos: com playback, seis linhas diriam três coisas.
  Sem playback ele nem aparece — não há o que escolher.
- A variante é lida **no clique**, antes de `closeSongMenu()` zerar
  `songMenuFor` — uma ação que fosse consultá-lo depois encontraria `null`.
- **Favoritos reusa o seletor de pastas** da barra de seleção múltipla:
  `openFolderPicker([id])` passa o id explícito, e sem argumento ele age sobre
  `selected`, como sempre. Uma segunda lista de pastas só para o acervo
  divergiria da primeira no dia em que alguém criasse uma pasta nova.
- **Empilhamento:** `#songMenuPopup` em `z-index: 210` (abre de dentro do
  acervo) e `#folderPopup` em `220` (abre de dentro dela) —
  o seletor é declarado ANTES no documento, então sem o degrau a ordem do
  documento o deixaria por baixo. Na tabela `POPUPS` os dois entram nessa mesma
  ordem, porque o voltar a percorre de trás para a frente.
- No **simplificado** o ➕ some (`body.mode-simple .hymn-add-btn`) e o ▶ chama
  `simplePlaySong` direto: escolher variante e destino é justamente a decisão
  que este modo poupa.

Tocar (`playSongVariant`), +Cronograma (`addSongVariant` →
`AVDB.listAdd('imports', id)`), +Playlist (`addSongToPlaylist` →
`AVDB.listAdd('playlist', id)` + `renderPlaylist`) e +Favoritos
(`addSongToFavorites`) baixam a música na hora se ainda não estiver offline (ver
"Resolução do id de mídia por variante" abaixo). **"Apenas a letra"** baixa
também, mas só quando precisa: a letra costuma já estar no acervo de textos (ver
"Letra avulsa", na Camada de Texto).

### O download vira estado da tela (v5.64-65)

Tocar uma música que ainda não está no aparelho abre um download de dezenas de
segundos. Até a v5.63 o toque não mudava **nada** na tela: o acervo continuava
aberto na mesma lista — ele só fechava depois que o arquivo chegava — e o único
sinal era um toast na tela principal, **atrás** do popup. Do lado de quem opera,
"toquei e não aconteceu nada", e o reflexo é tocar de novo.

A correção tem duas metades, e a primeira é a que resolve o problema:

1. **A resposta é imediata e igual à de uma música já baixada.** `closeSongMenu()`
   e `closeHymnSearch()` passaram para o **começo** de `playSongVariant` (e de
   `projectSongLyricsOnly`), antes do `await`. O toque fecha o acervo na hora;
   se o download falhar, o erro chega por toast, que é o mesmo caminho de
   qualquer outra falha.
2. **A espera aparece na miniatura da preview**, não na tela principal
   (`previewBusy` → `#pvBusy`). É ali que a mídia vai aparecer, então é ali que
   se anuncia que ela está a caminho; um aviso na tela principal seria mais um
   cartaz avulso a interpretar.

Os detalhes que não são óbvios:

- **É um CARTÃO no meio, não uma cortina.** A preview espelha o telão e precisa
  continuar espelhando enquanto a próxima música baixa: o louvor de fundo segue
  tocando ali, e cobri-lo por trinta segundos tiraria a única janela para o que
  está no ar. O cartão é opaco por conta própria — com um véu translúcido a
  marca do wallpaper atravessava o texto.
- **Só acende depois de `PV_BUSY_DELAY_MS` (180 ms).** Uma música já baixada
  resolve em poucos milissegundos, e um cartão que pisca é pior que nenhum: lê-se
  como falha.
- **O contador é um número, não um booleano** (`pvBusyCount`). O operador pode
  disparar dois downloads (tocar um hino e, enquanto ele baixa, projetar a letra
  de outro) — o primeiro a terminar não pode apagar o indicador do outro.
- **A ação e o nome são campos separados** (`Baixando` em caixa alta miúda, o
  nome embaixo). Numa caixa de ~250px `Baixando "Ó Adorai o Senhor"…` vira uma
  linha que estoura; separados, a ação se lê de relance e o nome fica com a
  largura toda, com clamp de duas linhas.
- **O cartão desvia dos `.pv-fab`** (padding-right de 38px): tela cheia
  e cast continuam alcançáveis durante o download.
- **Fora da tela cheia** (mesma regra dos `.pv-fabs`): ali a preview **é** a
  projeção, e o cartão iria para o telão.
- **No simplificado o indicador não existe** — a preview não está na tela. Por
  isso `previewBusy` devolve `{ visivel, soltar }`: o chamador usa `visivel` para
  decidir se `ensureSongDownloaded` ainda deve mostrar o toast
  (`opts.toast`). Dois avisos para o mesmo download é ruído; **nenhum** é o
  defeito que isto conserta.

#### Adicionar a uma lista: a marca vai para a LINHA (v5.65)

Adicionar também pode disparar o download, e ali a preview é o lugar errado: o
acervo **continua aberto de propósito** (adicionar três músicas seguidas é o uso
normal) e nada vai para a preview. O indicador vai então para a miniatura da
própria música — o botão `.hymn-play-thumb`, que é o quadrado de 46px que era a
miniatura. O ▶ some e o anel entra no lugar; o botão segue clicável, porque
tocar uma faixa que já está baixando é legítimo e o download é o mesmo
(`songDownloadInFlight` dedupa).

- **É o MESMO anel** (`.dl-ring`, com `--dl-ring` dando o tamanho): um aro
  girando com a seta de download parada dentro. Dois spinners diferentes para a
  mesma espera fariam o operador perguntar se são coisas diferentes. Cada lugar
  só escolhe onde ele mora — a preview quando a mídia vai aparecer ali, a linha
  quando o que baixa é aquela faixa da lista.
- **Quem acende é `ensureSongDownloaded`**, logo DEPOIS da checagem
  `needsFull || needsPlayback` — o único ponto que já sabe que existe download de
  verdade. Acender no chamador exigiria repetir a checagem (e piscar em toda
  música já baixada, que é o defeito que o atraso de 180 ms evita na preview).
  Como efeito, **todo caminho que baixa sob demanda ganha a marca sem precisar
  lembrar dela**.
- **O estado vive num `Map`, não só na classe do botão** (`songRowBusy`, contado
  por música). A lista do acervo é **reconstruída** durante o download — o
  progresso redesenha a cada 400 ms —, e uma classe escrita no nó sumia no
  redesenho seguinte: a linha voltava a mostrar ▶ com o download ainda correndo.
  `hymnResultRow` relê o Map ao montar (a linha carrega `data-song`) e
  `setSongRowBusy` cuida das que já estão na tela. Contado, e não booleano:
  adicionar a mesma faixa à playlist e ao Cronograma abre dois pedidos, e o
  primeiro a terminar não pode apagar a marca do outro.
- **Os três caminhos de adicionar passam `toast: false`.** O toast que sobra é o
  do RESULTADO ("Adicionado à playlist"), que é outra informação.

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

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin em que
> a base roda — no aparelho, `https://appassets.androidplatform.net`, servida
> pelo `WebViewAssetLoader` do shell (ver "Build, distribuição e instalação"); no
> navegador, o que o servidor estático de desenvolvimento usar. Não verificado
> em produção: a rede das sessões de desenvolvimento não alcança
> `api.louvorja.com.br`. Se o `fetch` falhar por CORS, a sincronização e a
> busca ao vivo param de funcionar — mas não a busca no índice já baixado, que
> é toda em memória.

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

O diálogo mostra **quanto** falta: `estimatePendingBytes` devolve o mesmo
número que o painel do álbum (`medirColecao`), que é o ponto — a estimativa que
decide o gasto de dados móveis não pode divergir da que o operador acabou de
ler no card.

Um indicador (`.net-badge`, ícone de Wi-Fi inline — fora do subset da fonte)
aparece nas opções da coleção, atualizado ao vivo
(`connection.addEventListener('change', ...)`).

O download **individual** (tocar/adicionar uma música, `ensureSongDownloaded`)
não pergunta nada e é sempre permitido, em qualquer rede: é exatamente o hino
que o operador acabou de pedir — uma música, não um acervo —, e um diálogo a
cada toque seria só atrito. Na prática,
sem Wi-Fi o hinário vai sendo baixado aos poucos, só com o que de fato for
usado em cada culto, em vez de baixar tudo de uma vez usando dados móveis.

**Display** (`display/`): layer `#lyrics` (imagem de fundo
`object-fit:cover` + uma faixa central — `.lyrics-box`: no padrão visual de
"vídeo de louvor", cantos **retos** (`border-radius: 0`), **sem linha de
borda** (v5.42 — o contorno branco desenhava um retângulo que competia com a
letra; quem separa o texto da foto é a própria faixa escura) e sem
`box-shadow`; o fundo é `--lyrics-frame-bg` e **só existe no modo imagem**
(ver "Moldura só no modo imagem" abaixo), com `width`/`height` como fração do
container (`76cqw`/`32cqh`) — a legibilidade do texto vem da própria faixa,
não de um gradiente cobrindo a tela inteira, então funciona igual
independente da imagem por trás), inserido no DOM entre
`#video` e `#youtube`, mesmo `z-index:1` dos demais layers de mídia — a
cortina do wallpaper (hoje `z-index:3`, acima de toda mídia e do cartão de
texto) cobre/revela esse layer de
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

**Moldura só no modo imagem**: o fundo semitransparente da caixa
(`.lyrics-box`/`.pv-lyrics-box`) só existe para dar contraste/legibilidade
contra uma imagem de fundo de verdade — no modo preto puro seria só uma
zona escura flutuando à toa sobre uma tela já preta, sem função nenhuma.
`applyLyricsBgClass()` (Display) / `applyPvLyricsBgClass()` (Controle)
ligam a classe `.imgbg` em `.lyrics-content`/`.pv-lyrics-content` só quando
o modo é `'image'` — o `background` de `.lyrics-box`/`.pv-lyrics-box`
fica `transparent` por padrão e só recebe `--lyrics-frame-bg` via
`.lyrics-content.imgbg .lyrics-box`/`.pv-lyrics-content.imgbg .pv-lyrics-box`.
Chamado em `setLyricsBgMode()`/`restore()` (Display) e em
`showPvLyrics()`/`applyPvLyricsBg()` (Controle) — cobre tanto a troca ao
vivo do botão quanto o estado inicial ao abrir um item já com o modo salvo.

**Preview do Controle (mesma visualização, em miniatura)**: a preview
**sempre espelha o telão** — já vale pra imagem/vídeo (via `stage.js`
compartilhado) e pra YouTube (segundo player, ver seção própria); letra
sincronizada segue o mesmo princípio universal do sistema. `#pvLyrics`
dentro de `#preview` reproduz a mesma estrutura visual do Display (fundo +
faixa central) com **exatamente os mesmos números**, porque são unidades de
container (`cq*`) e não `vw`/`vh`: relativas ao próprio container, elas são
invariantes de escala e dão a mesma composição na caixinha da preview e no
telão (ver "Redimensionamento por Container Queries" abaixo). O que continua
duplicado é a **folha** — as regras `.pv-*` existem à parte porque o container
é outro —, no mesmo padrão da preview do YouTube.
`showPvLyrics`/`hidePvLyrics`/
`renderPvLyricSlide`/`updatePvLyricSlide` espelham exatamente as funções do
Display, chamadas nos mesmos pontos: `cmd()` (`load`/`stop`/`clear`, em vez
do tratamento de comando do Display) e `previewTick()` (em vez do
`sendStatus()`). Não existe mais uma legenda de texto solta na
`.nowplaying` (`#npLyric`, removida) — a miniatura visual da preview já
mostra a composição real (fundo + posição do texto), tornando a legenda
redundante.

**Controle**: a navegação manual de estrofe é o **toque curto em ⏮/⏭** do
transporte (ver "Um par de botões, dois eixos"); as âncoras
`#slidePrevBtn`/`#slideNextBtn` continuam existindo, ocultas, como o ponto único
de estado e execução. `stepSlide(delta)` reaproveita o
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
`.pv-lyrics-bg` têm `background: var(--stage-bg)` próprio (o preto de
verdade do palco, independente da `<img>`);
`applyLyricsImage`/`applyPvLyricsImage` alternam
`hidden` junto com `src` a cada troca de modo/slide. As duas folhas ganharam
`[hidden] { display: none !important }` no topo, o que torna essas regras
específicas redundantes — mas elas ficam, porque a regra genérica é a proteção
de fundo e a específica documenta o caso concreto que já falhou.

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

#### O que chegou fica NA FRENTE do operador (v5.77)

Um compartilhamento é um pedido explícito e imediato — ninguém manda um vídeo
para o app de projeção "para depois". Mas o app pode estar em qualquer lugar
quando ele chega: na aba Bíblia, com o acervo aberto em tela cheia, dentro de
uma pasta dos Favoritos, com a seleção múltipla ligada. Até aqui `importShare`
trocava a variável `activeTab` por baixo de tudo isso e chamava `load()` — o
operador voltava para o app e via exatamente a tela que tinha deixado, **sem
sinal nenhum de que algo entrou**.

`focarImportado(id)` roda depois de todo import bem-sucedido:

1. **Sai do que está por cima**, nos dois modos: `exitSelection()` e o
   fechamento de **todos** os popups abertos, percorrendo a MESMA tabela
   `POPUPS` que o ✕, o toque no fundo e o botão voltar já usam — um popup novo
   entra numa linha e passa a ser fechado também por aqui.
2. **A preview em tela cheia só sai quando há TELÃO.** Sem telão conectado ela
   **é** a projeção (ver "Divergências"), e derrubá-la para mostrar uma lista
   tiraria do ar o que estiver em cena. Caro demais para um import — ali o item
   simplesmente espera no Cronograma.
3. Então cada modo faz o que aquele modo quer dizer:
   - **Simplificado → PROJETA na hora** (`send(id)`). Esse modo existe para
     quem não vai operar nada, e a lista sequer aparece nele: "adicionei ao
     Cronograma" não significaria nada. Quem compartilha um louvor com o app já
     conectado à TV quer aquilo no telão.
   - **Avançado → leva para o Cronograma** (`switchTab('imports')`), que é onde
     o item entrou, e deixa a decisão de projetar com o operador — que pode
     estar com outra coisa no ar neste exato segundo.

O alvo é o **primeiro** item que entrou (um share pode trazer vários arquivos),
e para isso `addMedia`/`addUrlMedia` — que já devolviam o registro — passaram a
ter o retorno aproveitado; `handleSharedUrl` também devolve o seu.

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

O sistema serve **texto no telão** por seis provedores que compartilham um
**modelo padronizado** de camada paralela (mesmo padrão do YouTube: um layer
que a **cortina do wallpaper** — sempre por cima de tudo — cobre/revela "de
graça", sem tocar em `stage.js`). São eles:

| Provedor | Driver | Origem do texto | Camada física |
|---|---|---|---|
| **Bíblia** | manual (operador avança versículo) | banco LouvorJA | `#text` / `#pvText` |
| **Mensagens** | manual (operador avança mensagem) | `state.messages` (texto puro) | `#text` / `#pvText` |
| **Letra avulsa** | manual (operador avança estrofe) | acervo de letras (`songLyricStanzas`) | `#text` / `#pvText` |
| **Cronômetro/relógio/timer** | **derivado do relógio** (sem avanço) | o próprio tempo (`chronoReading`) | `#text` / `#pvText` |
| **Sorteio** | **derivado** (rolo até assentar) | faixa numérica ou lista de opções (`drawReading`) | `#text` / `#pvText` |
| **Letra sincronizada** | **temporizado** (segue o `currentTime` do áudio) | música do LouvorJA | `#lyrics` / `#pvLyrics` |

> **Mensagens vive na aba Ferramentas** (v5.31), como uma das ferramentas do
> seletor: lista de avisos salvos, "+ Nova mensagem" e — quando há uma
> projetada — "Tirar do telão" (`hideMessage` → `text-hide`, que encerra só a
> Camada de Texto; um áudio de fundo segue tocando). Tocar numa mensagem
> projeta e a linha fica marcada, então passar de um aviso a outro não exige
> reabrir nada — que era o atrito do bottom-sheet anterior. Com a mensagem fora
> do ar mas a sessão viva, os botões de slide só MOVEM a seleção (mesma regra
> da Bíblia).

### Letra avulsa (projetar a letra SEM tocar a música)

`lyricSession = { title, stanzas: [string], idx, projecting }`, aberta pela
folha rápida de uma música do acervo ("**Apenas a letra**" — ver
`hymnResultRow`). Serve o caso em que a congregação canta **ao vivo**
(instrumentistas na frente, ou hino sem gravação no aparelho): o telão precisa
da letra, e não pode ter um áudio tocando por cima nem trocar de estrofe sozinho
no tempo de uma gravação.

- **Não é uma terceira variante de `playSongVariant`.** Uma variante toca um
  arquivo, e aqui não há arquivo nenhum: a letra vem de `songLyricStanzas`, que
  lê o acervo de letras e funciona para músicas **nunca baixadas**.
- **Sem letra no aparelho, o caminho é o MESMO das outras duas opções da folha**
  (v5.64): baixar a música — que traz a letra junto — e tentar de novo, com o
  indicador na preview dizendo "Baixando a letra". Na v5.63 isto era um beco sem
  saída: "Letra ainda não baixada." e nada acontecia, num item que o operador
  acabara de escolher. Se ainda assim não vier letra, aí sim o aviso
  ("Letra indisponível para esta música").
- **Uma estrofe = um slide**, e o comando é `text` com `mode: 'message'` — o
  telão já sabe desenhar um bloco de texto centrado, que é exatamente o que uma
  estrofe é. Um modo novo no protocolo exigiria shell e bundle novos dos dois
  lados sem mudar um pixel do resultado.
- **A passagem é do operador**, pelos mesmos ⏮/⏭ que já passam mensagem e
  versículo: `slideTarget()` devolve `'songlyrics'` (à frente de `'message'` e
  `'bible'`), `stepSlide` cai em `lyricStep` e `applySlideLimits` desabilita nos
  extremos. É a **ausência** de passagem automática que o operador está pedindo
  ao escolher esta opção.
- **É texto manual como os outros:** `clearManualText()` a encerra junto com as
  demais, projetar Bíblia/Mensagem/cronômetro/sorteio a substitui, um `load` de
  áudio a mantém e um `load` visual a encerra. `resendSceneToDisplay` a reenvia
  na reconexão do telão, e `pushNowPlaying` conta ela como **cena** (o serviço de
  mídia sobe, e o processo com a `Presentation` deixa de ser descartável).
- O now-playing mostra `<nome da música> · <n>/<total>`: sem o número, duas
  estrofes seguidas dariam o mesmo cabeçalho e o operador perderia a única
  referência de onde está.

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

Então a abertura da busca passou a ser esse navegador: os mesmos cabeçalhos de
categoria e os mesmos cards. **É a mesma função** — `renderCollectionsList(alvo, redesenhar)` ganhou o elemento-alvo e o
callback de redesenho como parâmetros. Duas cópias divergiriam no primeiro
ajuste de categoria, e o operador veria dois acervos diferentes conforme por
onde entrou.

A busca ganha assim **dois níveis**, e isso muda três coisas:

- **Digitar troca o nível.** `searchIsBrowsing(q)` é `!q`: com
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
    *(Superado na v5.72: ela voltou para a barra, mas no lugar do botão de
    baixar — que aberto não tem o que decidir. Ver "A engrenagem volta para a
    barra".)*
  - **A barra da coleção aberta GRUDA no topo** (`position: sticky`). Sem isso,
    percorrer as 600 faixas de um hinário empurrava a própria barra — e a seta
    que fecha — para fora da tela: a única seta à vista passava a ser a de
    OUTRO card, e tocá-la abria aquele em vez de fechar este. Do lado de quem
    opera, "toquei na seta e não fechou". Grudada, a seta da coleção em que se
    está fica sempre ao alcance, e o nome dela também.
  - **Baixar/cancelar voltou para a barra** (`.coll-bar-dl`). Com a engrenagem
    dentro do aberto, baixar um hinário passava por expandir 600 linhas —
    caro para a ação mais comum do acervo.
- **O campo não rouba o foco na abertura — no AVANÇADO.** Enquanto ela era uma
  lista de músicas, o teclado subir junto era o certo: não havia mais nada a
  fazer ali. Hoje a abertura é um acervo para folhear, e o teclado cobriria
  metade dele antes de o operador decidir se vai digitar.
- **No SIMPLIFICADO ele sobe** (v5.90). Lá o acervo é aberto por um botão que se
  chama BUSCAR, e o modo inteiro existe para encurtar caminho — o toque na
  música já toca, sem folha de escolha. Quem entra por ali sabe o que quer e vai
  digitar; um toque a mais no campo é exatamente a cerimônia que esse modo tira.
  O `focus()` é SÍNCRONO, dentro do gesto do toque: adiado (um `setTimeout`) ele
  sai da interação, e aí o WebView aceita o foco mas **não abre o teclado** — o
  pior resultado possível, porque na leitura do código parece que funcionou.

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
  - **O chip de status do lote é ESTREITO, e as frases têm de caber nele**
    (v5.75). O cabeçalho é uma linha flex de cinco itens (ícone, título,
    status, baixar, ✕) em 390px: sobram ~180px para o texto. `.popup-total`
    tinha `flex-shrink: 0`, então uma frase comprida não encolhia — empurrava
    o **✕ para fora do sheet** e o acervo ficava sem saída. Duas correções, e
    as duas são necessárias:
    - **Estrutural:** `.popup-close` ganhou `flex-shrink: 0` (o ✕ é intocável),
      `.popup-total` passou a `flex: 0 1 auto; min-width: 0` (é ele quem cede,
      e o `.coll-group-count` dentro dele já corta em reticências) e um
      `max-width: 58%` para o TÍTULO não ser a próxima vítima.
    - **Textual:** as frases de `syncGroup` foram encurtadas até caberem sem
      reticências — "Álbum 3/12" (era `… · <nome do álbum>`, largura
      imprevisível e a causa direta do estouro), "OPFS indisponível",
      "Já completo", "3 álbuns sem rede", "Erro no download", "Completo",
      "Aguardando Wi-Fi". O nome do álbum em download não se perdeu: ele está
      no card do próprio álbum e na notificação do sistema.
- **O contador de itens saiu.** Na abertura ele contava coleções e durante a
  busca, resultados: o mesmo número dizendo coisas diferentes, ao lado de um
  título que já explica a tela. O contador que importa é o `N/M` de baixados,
  que está em cada card e agora também no cabeçalho.
- **Os botões de baixar formam UMA coluna** (v5.47). O do cabeçalho de grupo
  não tem seta de acordeão depois dele, então caía ~40px à direita do botão do
  card logo abaixo. `.coll-group` reserva à direita exatamente o que o card
  gasta depois do seu botão — borda (1px), padding (`.7rem`), seta (20px) e o
  gap antes dela (`.55rem`) — e os dois botões passaram a ter o mesmo alvo de
  34px, porque alinhados na coluna eles também precisam do mesmo tamanho,
  senão os centros discordam. Medido: todos com centro em x=351.
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
  *(O popup em si saiu na v5.72 — as opções viraram um painel dentro do card —,
  mas a ordenação de `POPUPS` que ele motivou ficou, e é a que o `#songMenuPopup`
  e o `#folderPopup` usam hoje.)*

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

Tocar num resultado da busca abre a **letra completa** da música em acordeão. É
o que fecha o ciclo da busca por trecho: achar o hino e conferir se é ele mesmo,
sem tocar nada e sem sair da lista. (Na v5.37 ela vinha abaixo de uma faixa de
seis botões de ação; desde a v5.63 esses botões viraram dois, moraram na própria
linha, e o acordeão guarda só a letra.)

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

### Ferramentas: o seletor de ferramenta

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
  qual é exigiria visitar cada uma. O ponto (`.misc-tab-live`, 7px) é
  `--live-text`, **não** `--live`: ele é um gráfico que carrega informação
  (piso de 3:1), e o vermelho cheio da paleta — escuro por construção, ver R2 —
  não chegava lá em fundo nenhum. Com o tom claro ele passa nos dois fundos que
  encontra (**7,08:1** sobre o trilho e **3,29:1** sobre o `--accent-fill` do
  segmento ativo), e o anel claro que existia só no segmento ativo saiu: sobre
  um ponto claro ele não separava nada.
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

### Ferramentas: cronômetro · relógio · timer

Terceiro provedor da Camada de Texto, na aba **Ferramentas** (junto do microfone).
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
- **Cronômetro e sorteio CONTAM como cena** para `pushNowPlaying` (o que
  alimenta a sessão de mídia e a notificação nativa — ver `CLAUDE.md`).
  Ficavam de fora: `renderNowPlaying` já os tratava como cena (escreve
  "Cronômetro" no título e chama a função), mas ali `active` dava `false` e o
  Kotlin derrubava a sessão. O efeito não é a projeção cair no meio — uma vez
  que qualquer mídia foi tocada, `currentId` nunca mais volta a `null` e a cena
  segue ativa —, é o caso da sessão **recém-aberta**: projetar a contagem
  regressiva de abertura sem ter selecionado mídia nenhuma **não levantava** o
  serviço em primeiro plano, e o processo (com a `Presentation` junto) seguia
  descartável sob pressão de memória exatamente durante os dez minutos em que o
  operador minimiza o app para esperar.
- **Só as PREFERÊNCIAS persistem** (`state.chronoPrefs`: modo, duração, formato
  do relógio, legenda). Uma contagem em curso não sobrevive ao fechamento do
  app de propósito: restaurar um cronômetro que "correu" com o app fechado
  mostraria um número sem significado.
- A ferramenta vive só no **modo avançado**, como o microfone: o simplificado
  existe para quem quer conectar a tela e tocar um louvor.

### Ferramentas: sorteio

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
  faria o fundo sumir por trás de um texto ainda esmaecendo. Mesma coisa em
  `hidePvLyrics(fade)`.
  - **O teardown é cancelado EXPLICITAMENTE quando a letra volta** (o timer
    fica guardado em `lyricTeardownTimer`, e `showLyrics` o limpa). A guarda de
    sequência sozinha **não bastava**: se a estrofe que volta usa a MESMA
    imagem (`key === lyricImgKey` — o caso normal quando um versículo entra e
    sai em menos de `LAYER_FADE_MS`, e também quando dois hinos compartilham o
    mesmo `imageOpfsPath`), `applyLyricsImage` devolve cedo e **não**
    incrementa a sequência; o teardown então disparava com o `seq` ainda
    válido, revogava a object URL em uso e apagava o fundo da letra que acabara
    de reaparecer, deixando-a sobre preto até a próxima troca de estrofe.
  - **A revogação vem ANTES da guarda de sequência**, e de propósito: quando o
    caminho de troca já zerou `lyricImgUrl`, aquela URL não é mais de ninguém —
    nenhum outro caminho vai revogá-la. Deixá-la atrás do guard significava que
    uma imagem nova entrando em menos de `LAYER_FADE_MS` (estrofe seguinte, ou
    o operador religando o fundo pelo comando `lyricsbg`) invalidava o callback
    e **o blob da foto ficava retido** até o WebView do telão morrer — uma vez
    a cada ocorrência, o culto inteiro. Só o `removeAttribute('src')` continua
    atrás do guard, porque aí o `src` já é de outra imagem.
- **`renderLyricSlide` só REGISTRA o índice depois de validá-lo.** Gravá-lo
  antes fazia um índice inexistente (`findSlideIndex` devolvendo -1 num tempo
  anterior ao primeiro slide, ou um `showLyrics` com a lista ainda vazia) ficar
  marcado como "já renderizado" — e se o mesmo índice voltasse a ser pedido, a
  guarda de topo devolvia cedo e o slide certo **nunca era pintado**.
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

**Excluir uma mensagem mexe na SESSÃO, não só no array** (`deleteMessage`), e
são dois casos distintos:

- **A projetada** precisa ser **tirada do ar antes** de a sessão morrer:
  `clearMsgSession()` sozinho zerava `msgSession` sem mandar `text-hide`, e o
  aviso apagado continuava projetado no telão e na preview. Como a sessão
  morria junto, o botão "Tirar do telão" ficava **desabilitado** e a linha
  sumia da lista — o operador não tinha mais nenhum caminho na aba para tirar o
  texto do ar, só ⏹ Parar ou projetar outra coisa por cima. Hoje é
  `hideMessage()` (que envia o `text-hide`) e **depois** `clearMsgSession()`.
- **Uma ACIMA da projetada** exige reindexar `msgSession.idx`. Sem isso ele
  passava a apontar para a vizinha errada — ou para fora do array: "Mensagem 3"
  numa lista de duas, nenhuma linha marcada como ativa, e "Projetar no telão"
  caindo no guard `idx >= messages.length` de `projectMessage`, ou seja, um
  botão que não faz nada e não explica por quê.

## Bíblia (aba `bible`)

Aba própria para **selecionar e projetar textos bíblicos**, com os dados vindos
do mesmo banco público do LouvorJA (ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.6).
O cliente é `controle/bible.js` (`window.Bible`, JS puro), que reaproveita
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
(pula o que já está em cache), concorrência limitada (`runLimited` com
`NET_CONCURRENCY`). O texto é leve (só versículos, sem mídia), então o volume total é modesto. O progresso
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

**A varredura é identificada por SEQUÊNCIA (`bibleDlSeq`), não pela versão.**
Cada invocação ganha um `runSeq` monotônico, e os workers comparam com ele.
Comparar `versionId` era **reversível**: trocar de versão e **voltar** fazia os
workers da varredura antiga, ainda em voo, passarem no teste de novo e
retomarem em paralelo com a nova. Pior, a antiga terminava primeiro e — como os
capítulos que ela pulava saíam por um `return` sem contar falha — gravava
`bibleComplete` sobre uma varredura incompleta: flag **persistida**, versão
nunca mais completada. Com a sequência, um worker superado sai contando falha,
que é o que impede a marca de completude indevida.

**Persistência offline (não some entre sessões)**: os capítulos ficam no
IndexedDB (`state`, durável por natureza — sobrevive a fechar/reabrir o app e à
troca de bundle por OTA, que só substitui arquivos servidos). Além
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
versão **não tem botão próprio**: ela é o primeiro segmento da barra de
referência da tela de leitura (`part('Versão', …)`, uma `.bible-ref-part` como
Livro/Capítulo/Versículo), e o toque abre o popup `#bibleVerPopup` com a lista
— que não fica mais toda exposta em chips. **É na tela de LEITURA**, não na de
livros: ali a grade precisa da altura inteira. Persistido em
`state.bibleVersion`.

`changeBibleVersion` recarrega o capítulo atual na nova versão (mantendo o
versículo) e dispara o download da nova versão inteira. Duas coisas que ela
precisa fazer, e ambas nasceram de defeito:

- **Invalidar o `bibleLoadSeq`.** Sem isso, um capítulo lento pedido *antes* da
  troca voltava *depois*, passava na guarda de sequência (que não havia mudado)
  e sobrescrevia `bibleChapterData` com os versículos do capítulo/versão
  **antigos sob o rótulo dos novos** — e `startBibleReading` monta a sessão a
  partir daí, projetando o versículo errado com a referência certa. É o mesmo
  papel do `loadSeq` do stage.
- **Zerar o estado de erro/carregamento da grade.** Uma falha antiga ("Não foi
  possível baixar este capítulo") continuava na metade de baixo da tela mesmo
  com o capítulo novo já carregado e no ar.

### Seleção em "tabela periódica" (três telas)

`renderBible()` despacha por `bibleScreen` (`'books'`|`'chapters'`|`'reading'`),
renderizando dentro de `#library` uma **grade de células no estilo de uma
tabela periódica** (`.bible-grid` + `.bible-cell`): cada célula é um "símbolo"
(a abreviação do livro, ou o número do capítulo/versículo). O grupo/divisão
canônica de cada livro vem do campo `g` em `bible.js`, concatenado numa classe
(`'bg-' + b.g`: `lei`, `historicos`, `poeticos`, `pmaiores`, `pmenores`,
`evangelhos`, `atos`, `paulinas`, `gerais`, `apocalipse`) — por isso essas
classes **não aparecem literais em lugar nenhum fora do CSS**, e não são código
morto. Cada ladrilho é **tinta escura + faixa lateral de 3px** com a matiz do
grupo, não mais um bloco saturado: ver "Ladrilhos da Bíblia" no Design System
para o porquê e as medições. Sem número de índice e **só a abreviação** (sem o
nome completo, fonte maior). A grade de livros (`.bible-grid--books`)
**preenche a altura disponível** (11 linhas em `1fr`) pra caber **sem scroll**.

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

As duas grades marcam a seleção atual (`.bible-cell--num.active`: preenchimento
em `--accent-fill`, texto em `--on-accent` e `outline` da mesma cor; na grade de
livros, `.bible-cell.active` marca só com um `outline` em `--text`, para não
apagar a tinta do grupo), e é isso que faz **voltar da
leitura mostrar de imediato o capítulo E o versículo que estão no ar**, sem o
operador ter que se localizar — e sem procurar, já que nada rola.

Capítulos e versículos mantêm **tons distintos** (`--cell-chapter` em tom frio,
`--cell-verse` em tom quente) pra separar bem os dois níveis: as duas grades
são iguais em forma e conteúdo (só números) e ficam uma sobre a outra na mesma
tela — sem a diferença de temperatura, o operador perde de vista em qual das
metades está tocando. Fluxo: **livros → capítulo+versículo → leitura**; o botão
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

**À direita da referência, na MESMA linha** (v5.109), os dois botões de guardar
(`.cue-save-btn`: ⊞ para o Cronograma, ★ para os favoritos). **Aqui eles são
maiores que a caixa padrão** (v5.112): em `--hit` (34px) ficavam 4px mais baixos
e 22px mais estreitos que as células de Livro/Capítulo/Versículo ao lado, e numa
linha só isso não se lê como "botão menor", se lê como desalinhado. A altura vem
de `align-items: stretch` no rodapé — eles acompanham a referência seja qual for
a altura dela, em vez de repetirem um número que precisaria ser mantido à mão nos
dois lugares. A v5.103 os pôs
numa segunda faixa porque com RÓTULO — "Ao Cronograma", "Favoritar" — eles
disputavam a largura com os quatro campos e empurravam a referência para
reticências. Sem rótulo o par mede ~74px e cabe: o que a segunda faixa custava
era ALTURA, e altura nesta tela sai da leitura, que é o conteúdo dela. É por
isso que a `.bible-ref-nav` ganhou `min-width: 0` — sem ele o padrão
`min-width: auto` a impediria de encolher, e "1 Tessalonicenses" empurraria os
botões para fora da tela em vez de virar reticências.

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
  versículo pro central. Enquanto `projecting` é `false`, **só move** — nada vai
  ao telão.
- Tocar no **central** (`.bible-vsec.cur`) → `activateBibleVerse` liga
  `projecting` e **exibe** o versículo. O central ganha a classe `.live`, que
  troca a borda e a referência para `--live-text` e prefixa o rótulo com
  "● No ar". Era **verde** até a v5.47, enquanto quatro outros lugares do app
  diziam "está no ar" em vermelho — duas cores opostas para a mesma mensagem,
  sem regra que o operador pudesse aprender (ver "As três famílias" no Design
  System).
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

Os **controles de slide** (o toque curto em ⏮/⏭, que aciona as âncoras
`#slidePrevBtn`/`#slideNextBtn`, e os gestos
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
`4`. Como `.layer` já traz `background: var(--stage-bg)`, o cartão é **opaco**: o texto
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
comandos trata a Camada de Texto como paralela (igual ao YouTube): `load` de
**áudio** mantém o texto (troca o som de fundo), `load` de
**visual**/`stop`/`clear` chamam `hideText(false)` e seguem o fluxo;
**transporte** (play/pause/seek/volume/mute) cai no fluxo do stage (áudio de
fundo).

**O `view` DELEGA a quem é dono do estado, em vez de mexer na cortina por
fora.** Com o cartão de texto no ar, o ramo de `view` chama `ytSetView(v)` (se
há YouTube) ou `stage.handle({type:'view', view:v})`. Ele já chamou
`coverIn`/`coverOut` direto, e isso movia a cortina deixando `stage.view` /
`yt.view` **congelados no valor antigo** — um estado inconsistente cujo estrago
só aparecia **depois** do `text-hide`, o que tornava o defeito difícil de
associar à causa:

- o `view` seguinte comparava com o valor velho, concluía que nada mudara e
  **retornava sem fazer nada**: o botão de cobrir/mostrar o telão ficava morto,
  e o operador precisava tocá-lo duas ou três vezes;
- na direção oposta era pior — com a cortina cobrindo e `stage.view` ainda
  `'visual'`, o `play` seguinte reavaliava `computeCover()` e **descobria o
  telão sozinho**, expondo a mídia que o operador tinha coberto de propósito.

Delegar tem uma contrapartida a corrigir: o cartão de texto é **independente da
mídia** — um versículo no ar sem nada carregado é o caso mais comum na pregação
—, mas para o stage "sem mídia" (ou mídia terminada) quer dizer cortina
fechada, e o `instantCover(computeCover())` no fim do `setViewFaded`
reengoliria o versículo logo depois do fade. Por isso, ao voltar de um
`view:'visual'`, o Display **reafirma a cortina aberta** — reconferindo
`textActive`, porque o fade dura 0,6 s e nesse intervalo o texto pode ter saído
de cena, caso em que quem manda é o `restoreSceneAfterText`.

E é pela mesma razão que essa chamada passa **`overlay: true`** (v5.69): o stage
só enxerga o que ele mesmo desenha, e sem mídia a cortina cobre nos dois valores
de view — a guarda de `setViewFaded` (abaixo) pularia a transição inteira e o
versículo apareceria seco, sem o fade. O `overlay` é o aviso de que existe uma
camada por cima do stage, então descobrir revela ALGUMA coisa.

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
áudio **atual**.

**E a última coisa que `restoreSceneAfterText` faz, para TODOS os tipos de
mídia, é reconciliar a cortina** (`reconcileCover(view)`: `coverIn(false)` se a
view é `'wallpaper'`, senão `coverOut()`). Antes só a letra era remontada e os
demais tipos devolviam cedo — mas o `showText` mexeu na cortina por conta
própria para o cartão aparecer, então sair de cena tem que devolvê-la ao que a
view vigente manda. Sem isso, um versículo tirado do ar com o telão coberto
deixava a cortina cobrindo uma mídia cuja view é `'visual'`, e o toque seguinte
no botão de visual não fazia nada — para o stage, nada havia mudado. O helper
existe porque a cortina é **compartilhada** (stage, YouTube e a camada de texto
mexem nela) enquanto o estado de view é de quem é dono da cena; `coverIn`/
`coverOut` devolvem cedo quando ela já está onde deveria, então chamá-lo à toa
não custa nem pisca nada no telão.

O texto (`.text-box`) usa o mesmo redimensionamento por Container Queries da
letra (`container-type:size` + `cq*`), mas em prosa (caixa-baixa) e **SEM
moldura, ocupando a tela inteira**. A moldura da letra sincronizada existe para
dar contraste contra a imagem de fundo da estrofe; aqui o texto é sempre
projetado sobre o preto, então a borda seria só uma caixa desenhada à toa — e,
pior, uma caixa FIXA e menor que a tela, que apertava textos bíblicos (bem mais
longos que uma estrofe) num espaço pequeno enquanto sobrava tela vazia em
volta. Agora o texto ocupa o que tiver: `.text-box` é `86cqw`/`86cqh` — o mesmo
espaço útil que o antigo `padding: 7cqh 7cqw` deixava, mas escrito como **fração
do container** em vez de padding percentual (ver "Redimensionamento por
Container Queries": unidades de container escritas no próprio container não se
referem a ele) — e a **fonte é bem maior** (`6.4cqmin`, contra
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
sozinho — `restore()` aplica as **preferências visuais** (fade, fundo da letra,
preenchimento, wallpaper) e envia `display-ready`; o Display abre sempre no
wallpaper (ponto inicial), esperando um comando explícito. A inicialização do
sistema precisa ser **controlada** (nenhuma mídia deve começar a tocar sozinha
ao abrir o app) — quem decide se retoma o que estava tocando é o **Controle**,
ao receber `display-ready` (com base no que ELE sabe que estava tocando, não em
algo persistido pelo próprio Display).

**`display-ready` sai num `finally`, e as preferências ficam num `try`.**
ANUNCIAR-SE não pode depender delas: toda a reconexão do sistema pende desse
comando (é ele que dispara o `resendSceneToDisplay`), então se uma leitura do
IDB rejeitasse — upgrade bloqueado, armazenamento despejado, transação
abortada — a `Presentation` recriada depois de um blip do espelhamento ficava
parada no wallpaper, sem nada no Controle explicando e sem outra saída além de
reiniciar o app. Perder o fundo da letra ou o wallpaper é um defeito visível e
recuperável; perder a reconexão, não. No `catch` o Display segue nos padrões
(preto na letra, `contain` no fit, gradiente no fundo).

**Não há service worker aqui.** Havia um bloco que registrava `sw.js` e
recarregava a página no `controllerchange` (adiando até o telão ficar idle),
mas o `sw.js` saiu do bundle junto com os andaimes dos dois PWAs: no navegador
o `register` devolvia 404 e a promise era engolida pelo `.catch`; no app o
bloco nem chegava a rodar. Código morto nos dois contextos, e ainda sugerindo
ao próximo leitor uma atualização que não existia. Quem atualiza a base agora é
o **OTA do shell**, aplicado no PRÓXIMO lançamento — justamente para nunca
recarregar o WebView do telão no meio de um culto. O mesmo bloco também saiu do
Controle, onde `swReg` ficava eternamente `null` e o ramo de "checar
atualização ao retomar" nunca executava.

**Toque único ao abrir (`#startBtn`, "Ligar Sistema") — só no navegador.**
No app ele fica **oculto** (`window.__NATIVE__`): o WebView roda com
`mediaPlaybackRequiresUserGesture = false`, e uma TV não recebe toque nenhum.
No navegador a área de toque cobre a tela inteira (z-index acima de tudo,
inclusive do wallpaper e do escudo do YouTube — qualquer toque serve) e some
para sempre após o primeiro toque; um `.start-pill` central (preenchido no
dourado da marca — `--gold` —, com o texto no escuro do app, cantos
arredondados e halo em `--accent-glow`) é só a pista visual de "isto é
clicável" — sem
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
gesto no WebView, qualquer detecção seria falso positivo. **E a guarda de
nativo fica no próprio `onBlocked`**, não só dentro do `beginAudioRecovery()`:
o handler mutava o stage *antes* de descobrir que era falso positivo, e como o
`beginAudioRecovery` devolve cedo no app, `audioBlocked` continuava `false` e
nem o `tryRestoreAudio` nem o comando `audio-retry` faziam qualquer coisa. O
telão ficava **sem som até o próximo load**, e o Controle não recebia sinal
nenhum — o `display-status` só carrega `audioBlocked`, que ali era falso.
No navegador, a primeira retentativa costuma resolver. **Nada é exibido no
telão**: o estado vai no campo `audioBlocked` do `display-status`; no
**Controle**, o
**botão de mudo do mixer** vira indicador (estado `.blocked`, âmbar pulsante,
ícone de volume off) e **atalho**: o clique envia `audio-retry` (retentativa
imediata) em vez de alternar o mudo. Qualquer gesto real no Display
(toque/tecla — `pointerdown`/`keydown` no documento) religa o áudio na hora. O
comando `mute` do operador encerra a recuperação. **Este mecanismo não se
aplica ao YouTube** — ver seção abaixo.

### Microfone ao vivo, no lado do Display

O operador segura o botão no Controle, o comando `mic` atravessa o canal e é o
**Display** que abre o microfone e o reproduz na projeção — um `MediaStream`
não é clonável e portanto **não atravessa o BroadcastChannel**, então quem
reproduz tem de ser quem captura. O caminho é `getUserMedia →
MediaStreamSource → GainNode → destination`, com rampa curta na entrada e na
saída (cortar no meio de uma palavra estala na caixa de som). A parte nativa
(permissão `RECORD_AUDIO`, `onPermissionRequest` do WebView) está em
[`CLAUDE.md`](../CLAUDE.md).

**A captura em voo tem um token (`micSeq`), e `micStream` não servia como
guarda.** Ele só existe DEPOIS de o `getUserMedia` resolver, e o primeiro
push-to-talk da sessão demora (permissão + `onPermissionRequest`). Um
on→off→on nesse intervalo — o operador aperta, não ouve nada, solta e aperta de
novo — disparava um **segundo** `getUserMedia` com o primeiro ainda pendente;
quando os dois resolviam, o segundo sobrescrevia as referências e o primeiro
ficava com as trilhas vivas e o ganho ligado ao `destination`, **sem ninguém
para pará-lo**: microfone aberto no telão (e o indicador de gravação do Android
aceso) até o WebView do telão ser recriado.

Três consequências disso, e cada uma cobre um `await` diferente:

- `stopMic()` **incrementa o token antes da saída antecipada**: com `micStream`
  ainda nulo não há nada a derrubar, mas é preciso registrar que o operador
  soltou o botão — senão o `getUserMedia` pendente vira um microfone aberto que
  nenhum comando desliga.
- `startMic()` reconfere o token **duas vezes**: depois do `getUserMedia` e
  depois do `micCtx.resume()`. O resume é outro `await`, e um `stopMic()` ali
  no meio passava batido — a continuação ligaria a fonte ao `destination`
  depois de o botão já ter sido solto.
- ao parar, o `AudioContext` é **suspenso, não fechado**: fechá-lo exigiria
  criar outro no aperto seguinte, e é justamente esse custo (e a latência de
  abertura) que se quer evitar num push-to-talk. Suspenso, ele para de segurar
  a saída de áudio — e só é suspenso se ninguém tiver reaberto o microfone
  nesse meio tempo.

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
  - **Não é "só um `<script>`", e isso está registrado de propósito.** Não é
    dependência de *build* (não entra npm nenhum, e o recurso já depende de
    rede/youtube.com para tocar o vídeo), mas ele executa **no mesmo
    documento** em que o shell publica `__AVBridge` via
    `addJavascriptInterface`, com acesso same-origin ao IndexedDB, ao OPFS e à
    ponte nativa. Não há CSP em nenhuma das duas páginas, então o risco de
    supply-chain neste endpoint é **aceito conscientemente**; a mitigação (um
    header `Content-Security-Policy` servido pelo `WebPathHandler`, ou o player
    dentro de um iframe de outro origin) está fora do alcance da base web e
    ainda não foi feita.

- **`loadYoutube(rec, view, muted, volume, startAt, autoplay)`** aceita os
  mesmos dois campos do `load` do stage, pelo mesmo motivo (reconexão do
  telão) — sem eles o vídeo recomeçava do zero **e tocando** depois de um blip
  do dongle. Duas diferenças em relação à mídia local:
  - a posição entra em `playerVars.start`, não num `seekTo` posterior: é o
    único jeito de o embed **abrir já na posição** — um `seekTo` depois do
    `onReady` aparece como salto no telão. Só aceita inteiro (segundos).
  - `autoplay === false` vira `playerVars.autoplay: 0` **e** um `pauseVideo()`
    no `onPlayerReady`, seguido de `ytShow()` + `ytStartTimeLoop()`: o quadro
    precisa aparecer, mas o vídeo não pode sair andando sozinho na frente da
    congregação. `ytWatchStart` também não corre nesse caminho — ele existe
    para empurrar um play que não pegou, e aqui não há play a empurrar.

- **`#youtube` é só um wrapper** (`<div class="layer yt-frame" hidden>`); a
  API cria o `<iframe>` real **dentro** dele a cada vídeo, via um elemento
  host descartável (`createYtHost()` — id incremental `yt-host-N`). O CSS
  (`.yt-frame iframe { width/height:100% }`) estiliza qualquer iframe filho,
  então o wrapper nunca precisa conhecer detalhes do iframe da API.
- **UI mínima**: `playerVars` pede `controls:0`, `disablekb:1`, `fs:0`,
  `iv_load_policy:3`, `rel:0` — sem barra de controles, teclado, fullscreen,
  anotações ou vídeos relacionados ao final.
- **LEGENDA NUNCA** (v5.77). Num telão de culto ela cobre a parte de baixo do
  vídeo — exatamente onde a Camada de Texto escreve — e vem no idioma e no
  gosto da CONTA logada no WebView, não numa escolha do operador.
  `cc_load_policy: 0` é só metade: ele diz "não force a legenda" e **perde**
  para o "sempre mostrar legendas" da conta. A outra metade é `ytKillCaptions`,
  que chama `unloadModule('cc')` (player HTML5) e `unloadModule('captions')`
  (o legado) — descarrega o módulo em vez de pedir educadamente. Roda no
  `onReady` **e de novo no primeiro `PLAYING`**: o módulo de legenda costuma
  entrar junto com a faixa de vídeo, ou seja, depois do ready — descarregar só
  ali deixava a legenda voltar no primeiro quadro.
- **O vídeo não para porque o app saiu da frente** (`ytWatchResume`, v5.77 —
  **não resolveu; ver "A via do arquivo baixado", abaixo**).
  Com o app minimizado o telão segue projetando (a `Presentation` não morre com
  a Activity) e um `<video>` local continua tocando; o embed do YouTube, não —
  o player dele **pausa sozinho** quando a página passa a "oculta", que é o que
  o Android reporta ao WebView quando o app vai para segundo plano. O louvor
  parava no meio.
  Aqui isso é sempre um engano, e dá para AFIRMAR: com `controls:0`,
  `disablekb:1`, `pointer-events:none` no wrapper e o escudo anti-UI,
  **ninguém pausa este vídeo pelo telão**. Então toda pausa que o app não pediu
  (`yt.wantPlaying`, a intenção de transporte, escrita pelos comandos
  `play`/`pause`) veio do próprio YouTube, e a resposta é mandar tocar de novo,
  700 ms depois, conferindo antes se ele já não saiu da pausa sozinho.
  **Limitado a 4 tentativas**, e não um laço eterno: se o vídeo parar por um
  motivo real e permanente (um erro do embed), insistir para sempre seria uma
  briga invisível com o player. A cota zera a cada `PLAYING`, então uma sessão
  longa com várias idas ao segundo plano é recuperada todas as vezes.
  **Em aparelho, não resolveu.** O `playVideo()` chega, e o player do YouTube
  pausa de novo — ele não obedece enquanto a página estiver oculta. O vigia
  ficou: ele não custa nada e continua sendo a resposta certa para uma pausa
  espúria por qualquer outro motivo. Mas a solução do problema é outra, abaixo.

### O telão parava ao minimizar o app — a causa real (v1.28)

Três versões atacaram isto por hipótese, e as três erraram, porque todas
supunham que o problema era do **YouTube**. A prova de que não era veio quando
uma mídia **local** — um arquivo baixado, tocando num `<video>` comum — parou
exatamente do mesmo jeito.

Com isso o alvo mudou: o que para é o **telão inteiro**, e as causas possíveis
são três, todas do lado nativo. A v1.28 fecha as três de uma vez, porque
distingui-las sem instrumentação já custou três tentativas:

1. **O WebView do telão era DESTRUÍDO ao minimizar.** `StagePresentation`
   chamava `release()` no `onStop()` — e `Presentation` é um `Dialog`, cujo
   `onStop()` chega em situações que não são "o telão acabou", entre elas o app
   sair da frente. Isso apagava a projeção inteira; ao voltar, o
   `syncPresentation` encontrava a Presentation fora do ar e criava OUTRA, com
   o telão recarregando do zero. Quem derruba o telão são os donos do ciclo de
   vida, e eles já faziam isso explicitamente.
2. **Metade da visibilidade continuava vazando.** O Chromium calcula a
   visibilidade a partir da janela **e** da View; a v1.26 mentia só sobre a
   primeira. `KeepVisibleWebView` agora cobre `onVisibilityChanged` também.
3. **A suspensão do renderer.** `WebView.onResume()`/`resumeTimers()` chamados
   do `onStop()` da Activity — o instante exato em que o sistema desaceleraria
   tudo —, mais `setRendererPriorityPolicy(IMPORTANT, waivedWhenNotVisible =
   false)`, que é literalmente "não abra mão da prioridade só porque esta View
   não está visível".

#### E o caso relatado era no CELULAR, não no telão (v1.29)

Depois de tudo acima, veio a informação que faltava: a pausa acontecia com a
**mesa de som** ligada — o áudio saindo pelo próprio aparelho. Nesse modo quem
toca é o `<video>` da **preview**, no WebView do **Controle**, e não o do telão.
As três correções anteriores protegiam o WebView errado.

E o Controle ser estrangulado em segundo plano é, normalmente, o comportamento
CERTO: ele é a mesa de comando, e o som está no telão. Deixa de ser certo
exatamente quando a mesa de som está ligada, porque aí o celular é a caixa de
som. Então a proteção virou **condicional e ligável em tempo de execução**:
`AVNative.keepAudioAlive(on)` (chamado por `setStandalone`) → `manterVisivel`
do `KeepVisibleWebView`, mais `onResume()`/`resumeTimers()` no `onStop()` da
Activity e a mesma política de prioridade de renderer do telão. Desligada a
mesa de som, tudo volta ao padrão.

**E, desta vez, uma CAIXA-PRETA.** `diag()` em `display.js` mantém um anel dos
últimos 60 eventos do telão (visibilidade, `pagehide`, `freeze`/`resume`, e cada
`play`/`pause` do `<video>` — separando a pausa COMANDADA da espontânea). O
Controle pede o despejo (`diag-ask` → `diag-dump`) ao abrir **Configurações**,
onde ele aparece como texto. É a única janela para o que acontece com a
projeção enquanto o celular está fora da frente: não há console, não há logcat,
e o Controle está estrangulado justamente nesse intervalo. Se voltar a parar,
o registro diz QUAL das três causas foi — em vez de mais uma rodada de palpite.

### Onde o aviso de download aparece (v5.84)

O cartão sobre a preview diz **"isto vai entrar em cena"**. É a mensagem certa
quando o toque foi TOCAR, e a errada quando ele foi só ADICIONAR: um vídeo
compartilhado que apenas entra no Cronograma não vai ao telão a seguir, e
anunciar o download ali insinua o contrário. A regra passou a ser **o aviso mora
onde o resultado vai aparecer**:

| O que o toque pediu | Onde o aviso aparece |
|---|---|
| Tocar uma música do acervo (cantada, playback, só a letra) | cartão sobre a **preview** (`previewBusy`) |
| Adicionar uma música do acervo a uma lista | miniatura da **linha do acervo** (`setSongRowBusy`) |
| Compartilhar um link do YouTube no **simplificado** | **preview** — ali o item vai direto ao telão |
| Compartilhar um link do YouTube no **avançado** | **linha do Cronograma** (`libBusy`) |
| Converter um item de player que já está na lista | **a própria linha** dele |

O caso novo é o do Cronograma, e ele tem um detalhe: enquanto o arquivo baixa,
**a linha ainda não existe**. Por isso ela é criada PROVISÓRIA — o operador vê o
item entrar na lista na hora, com o anel no lugar da miniatura e o percentual ao
lado, e ela vira o item de verdade quando os bytes chegam. Duas consequências
que o código trata explicitamente:

- **A lista vazia também desenha a provisória.** Sem isso, o primeiro vídeo
  importado num Cronograma vazio mostrava "Cronograma vazio." durante todo o
  download — a pior frase possível naquele momento.
- **O percentual repinta SÓ o texto**, sem refazer a lista: ele chega a cada
  megabyte, e um `load()` por atualização reconstruiria dezenas de linhas (com
  object URLs de miniatura) enquanto o operador rola a lista.
- Enquanto baixa, o botão de converter **sai da linha**: ele já ficava
  desabilitado, mas desenhar "baixar" ao lado de um anel girando é oferecer a
  ação que está em curso.

### A via do arquivo baixado — v5.78, e a extração NATIVA da v5.81

O embed do YouTube **pausa sozinho quando a página fica oculta**, e é isso que o
Android faz com o telão no instante em que o operador minimiza o app. A regra
roda dentro de um iframe de **outra origem**: nenhum código nosso a alcança.
Foram tentadas as duas únicas saídas de fora, e as duas falharam em aparelho:

1. **Mandar tocar de novo** (`ytWatchResume`, v5.77) — o comando chega, o player
   pausa outra vez.
2. **Impedir o WebView do telão de se declarar oculto**
   (`WebViewFactory.KeepVisibleWebView`, v1.26 do shell: `onWindowVisibilityChanged`
   sempre reporta `VISIBLE`). Ficou no código — é correto por si só e barato —,
   mas não bastou.

A resposta que não depende de vencer o player deles é **não usar o player
deles**: o link vira um **arquivo de vídeo no aparelho**, e daí em diante é uma
mídia como qualquer outra — o mesmo `<video>` dos arquivos importados, com fade,
seek, playlist, cortina, `MediaSession` e reprodução em segundo plano que já
funcionam há versões. De quebra: sem anúncio, sem legenda, sem UI de terceiro no
telão e **sem depender da rede durante o culto**, que num salão de igreja é o
ganho maior de todos.

#### Quem extrai é o APARELHO (v5.81)

A v5.78 pedia isso a um servidor [Cobalt](https://cobalt.tools). **Não
funcionou**, e o motivo não é o Cobalt — é a categoria: Cobalt, Invidious e
Piped rodam em **IP de datacenter**, que é exatamente o que o YouTube bloqueia.
Nenhuma lista de instâncias, por melhor que seja, muda isso; foi por isso que
nem a instância digitada à mão nem a descoberta automática (v5.80) entregaram o
vídeo.

Escrever o extrator à mão também não serve: os **PO Tokens** de hoje são
atrelados a cada vídeo e assinados por BotGuard/DroidGuard, e o atalho
`android_sdkless` que os dispensava foi removido. Seria manutenção semanal,
quebrando sempre num domingo.

O que funciona é extrair **no aparelho**: a requisição sai do IP do chip do
operador, que o YouTube não bloqueia — é por isso que o NewPipe funciona no
celular enquanto os servidores públicos apanham. `YoutubeGrab.kt` faz isso com
o `NewPipeExtractor` (a única dependência de terceiro do projeto, e a exceção
está declarada no `CLAUDE.md`), e `AVNative.ytFetch(url, onProgresso)` entrega
ao lado web uma **URL servível** (`/saf/<token>`) — daí para a frente o caminho
é o mesmo de um arquivo compartilhado: `fetch` + `Blob` + `addMedia`, e
`ytDiscard` apaga o intermediário para o vídeo não ficar duas vezes no aparelho.

- **Some o problema de CORS**: o `fetch` do WebView nunca alcançaria o
  `googlevideo.com`, que não manda os cabeçalhos — era por isso que o caminho do
  Cobalt precisava de `alwaysProxy`.
- **MP4 de até 1080p** (v1.44 para o remux, v1.49 para ele passar a funcionar de
  verdade). O YouTube reserva as resoluções altas para faixas separadas de vídeo
  e áudio; juntá-las é o `MediaMuxer` da plataforma (`MuxMp4.kt`), cópia de
  amostras e não recodificação — nada de ffmpeg embarcado. O progressivo segue
  como piso quando a montagem não sai; ver a série "O cliente visionOS destrava
  o 1080p" acima.
- **Sem `PoTokenProvider`, por enquanto.** O extrator faz "o melhor esforço"
  sem ele; montá-lo exige rodar o desafio do BotGuard num WebView — o app tem
  dois, então é factível, mas é outra empreitada. Se um vídeo resistir, o app
  cai no player embutido, que é o plano B de sempre.
- **Exige shell ≥ 16.** Num anterior a função devolve null na hora e o fluxo
  segue como antes.

#### O Cobalt saiu (v5.82)

Ele foi a tentativa das versões 5.78–5.80 e **não funcionou em aparelho**, pelo
motivo que está no começo desta seção: IP de datacenter. Ficar como "segunda
opção" seria manter uma tela de configuração que não leva a lugar nenhum e um
caminho de código que ninguém exercita — os dois envelhecem calados. O plano B
é o player embutido, que já existia e é honesto sobre o que faz.

### O que o watchdog do OTA exige DESTA base (`shared/native.js`)

O mecanismo do watchdog é do shell (`CLAUDE.md`, "OTA da base web"), mas o
sinal de "o bundle subiu inteiro" é dado **daqui**, e ele impõe um contrato
sobre o código do Controle que um refactor pode quebrar sem perceber.

Até a v5.47 a única condição era `window.AVDB` no evento `load`, e o
raciocínio registrado era sobre "um erro de sintaxe em `db.js`" — **o arquivo
menos provável de quebrar**. A ordem dos scripts é `native.js` → `db.js` →
`stage.js` → `louvorja.js` → `bible.js` → `controle.js`: um erro de sintaxe (ou
um `throw` de inicialização) em qualquer um dos quatro últimos aborta **só
aquele script**, o `load` dispara do mesmo jeito, `AVDB` continua lá — e o
bundle quebrado era carimbado como bom e servido **para sempre**, exatamente o
oposto do que o mecanismo existe para fazer. Como o OTA publica a cada push em
`main` e o `controle.js` é de longe o que mais muda, esse era justamente o caso
provável.

O sinal agora é "**o app está de pé**", e cada peça cobre um trecho da cadeia
que a anterior não cobre:

1. **papel `'controle'`** — o WebView do Display carrega bem menos código (não
   carrega `controle.js` nem `louvorja.js`), então deixá-lo confirmar validaria
   um bundle cujo Controle nunca chegou a rodar. E o Display é o caso **normal**
   de culto (TV conectada), ou seja, confirmaria quase sempre no lugar do
   outro. Sem TV o Display nem existe: quem confirma é sempre o Controle, que é
   quem precisa funcionar.
2. **`AVDB` e `createStage`** — os dois módulos compartilhados, cada um
   publicando seu global no fim do arquivo.
3. **`window.__avBack`** — só existe se o `controle.js` foi parseado por
   inteiro **e** executado até quase o fim. É a mesma função que o botão voltar
   do Android consulta, ou seja, um contrato que já existe, não um marcador
   inventado para o watchdog.
4. **um `<li>` dentro de `#playlist`** — o HTML entrega esse `<ul>` **vazio**;
   quem o preenche é `renderPlaylist()`, chamado por `load()` dentro do `init()`
   assíncrono. É o que prova que a inicialização terminou de verdade: `init()`
   começa por `loadCollections()` (louvorja.js) e só então monta a tela, então
   uma quebra em `louvorja.js` ou `bible.js` derruba o `init()` antes daqui e o
   marcador nunca aparece.

**Por polling, e não por uma checagem única no `load`:** o `init()` do Controle
é assíncrono (várias leituras de IndexedDB) e termina DEPOIS do `load`. Uma
checagem única rejeitaria todo bundle bom — o OTA pararia de funcionar por
inteiro, que é o defeito oposto e igualmente ruim. Não há risco de descompasso
de versão: `native.js` viaja **dentro** do bundle que valida, então esta função
e o `__avBack` que ela exige são sempre do mesmo commit.

O erro possível aqui é o **seguro**: a confirmação chega ~1 s depois do `load`,
então fechar o app nesse intervalo faz um bundle bom ser descartado — custo: o
app volta ao embutido e o OTA baixa de novo na abertura seguinte. O erro do
outro lado, carimbar um bundle quebrado, não tem volta sem publicar uma versão
nova.

> **Consequência prática:** mover `__avBack` para outro arquivo, renomear
> `#playlist` ou adiar a primeira renderização da playlist para depois de uma
> interação **quebra o watchdog** — o app deixa de confirmar e todo bundle OTA
> passa a ser descartado no lançamento seguinte, silenciosamente.

### Chamadas à ponte: época e prazo

Duas defesas em `shared/native.js`, ambas invisíveis no navegador:

- **O id de cada chamada é escopado ao CARREGAMENTO da página**, não um
  contador puro (`EPOCH` aleatório + sequência). O renderer pode morrer no meio
  de uma chamada em voo — é para isso que existe o `onRenderProcessGone` do
  shell: o WebView é destruído e recriado, a página recarrega e o contador
  volta a zero, mas o `resolve` do Kotlin aponta sempre para o WebView
  **atual**. Com ids "1", "2", "3", a resposta atrasada de um `listFolder` da
  página velha resolvia a promise homônima da página **nova** — uma lista de
  arquivos chegando onde se esperava o retorno de `displays()`. Com a época, a
  resposta velha não acha entrada no mapa e é descartada.
- **Prazo (`CALL_TIMEOUT_MS`, 60 s) nas chamadas que NÃO dependem de gente.**
  Se o lado nativo nunca responder, sem isso a promise fica pendente para
  sempre e o fluxo que a aguardava para no meio — sem erro, sem nada no
  console. É rede de segurança, não deadline de UX: generoso de propósito,
  porque varrer uma pasta enorme do SAF leva segundos. `pickFolder` e
  `requestMic` ficam **sem prazo**: ali quem responde é uma PESSOA (o seletor
  do SAF, o diálogo de permissão), e um timeout resolveria `null` com o
  operador ainda escolhendo a pasta.

---

## Design System — a paleta "Sala Escura" (âmbar)

Toda a UI sai de um conjunto fixo de **tokens** (variáveis CSS). **Regra: não
usar valor literal solto na folha; sempre referenciar um token.** Isso existe
porque o projeto acumulou muitas alterações estéticas pontuais (cores e medidas
repetidas à mão), que foram consolidadas nestes padrões.

### Por que a paleta mudou (v5.48)

O app é operado **no escuro**, e a paleta anterior falhava nos dois eixos ao
mesmo tempo:

- **Emitia luz demais.** `--text` (`#f2f2f2`) saía a **88,8%** de luminância
  relativa — hoje são 62,9% —, e o branco puro (`#fff`) aparecia **22 vezes**
  na folha do Controle como cor de ícone e de rótulo, **sem nenhum token que o
  nomeasse**. A tela de livros da Bíblia — 66 ladrilhos saturados preenchendo a
  altura — emitia **7× mais luz que uma lista comum** (16,3% de luminância
  média contra 2,3% de um painel), e é justamente a tela que o operador abre no
  meio da pregação.
- **Separava de menos.** `--bg` × `--bar` dava **1,19:1** e `--panel` ×
  `--panel-2` dava **1,22:1** — os dois abaixo do piso que o próprio design
  system declarava adotar, e ninguém percebeu (ver "Ao mexer em cor").

E, acima de tudo, **a mesma cor significava coisas diferentes em telas
diferentes**. Quatro estados eram pintados por duas famílias de cor cada:

| Estado | Antes | Onde divergia |
|---|---|---|
| está no telão agora | `--danger` ×4 e `--success` ×2 | vermelho em `.pv-fab.live`, `.mic-btn.live`, `.misc-project.live`, `.misc-tab-live`; **verde** em `.bible-vsec.cur.live` e `.msg-item.active` |
| selecionado / onde estou | `--accent` ×19 e `--success` ×2 | tudo accent, menos `.msg-item.active` |
| concluído / OK | `--success` ×8 e `--accent` ×1 | tudo verde, menos `.hymnal-stat.net.ok` (chip que saiu na v5.73) |
| baixando / ocupado | `--accent` ×5 e `--danger` ×2 | o texto do progresso numa cor e o botão de cancelar em outra, na mesma linha |

No sentido inverso, `--gold` acumulava **27 usos** cobrindo marca, aviso, erro,
cancelar, destaque de busca e rótulo de estrofe — não existia um `--warn`
separado da marca.

### As três famílias

A paleta tem **três matizes fazendo três trabalhos**, e nada além disso:

- **âmbar** — marca IASD, navegação, seleção, progresso. Uma família só: o
  accent **é** a marca (`--gold` e `--accent` têm o mesmo valor), então não há
  dois amarelos disputando significado. Os dois nomes coexistem para que a
  folha possa distinguir "isto é marca/metadado" de "isto é navegação/seleção"
  sem inventar uma segunda matiz.
- **vermelho** — atenção, e a **intensidade carrega o tipo**: preenchido =
  está no ar agora; contorno = ação destrutiva; suave = aviso/erro.
- **verde** — concluído, conectado. E **só** isso.

A contrapartida conhecida: âmbar (39°) e o laranja do aviso (27,5°) ficam a
~12° de matiz um do outro. Por isso o aviso **nunca é cor pura solta** —
sempre fundo suave + ícone. Um aviso que se anuncia só pela matiz não sobrevive
a um celular com brilho baixo, nem a quem não distingue as duas matizes quentes
do app.

### Onde ficam os tokens

- **`shared/tokens.css`** — **a paleta inteira**, e só ela. Carregada pelos
  **dois** apps, antes da folha de cada um (`<link rel="stylesheet"
  href="../shared/tokens.css">`).
- **`controle/controle.css`** — o `:root` do que **não é cor**: raio, escala de
  ícone, curva de toque e as duas medidas de layout que o JS também lê
  (`--deck-pv-h`, `--fader-cap`). São decisões da UI **densa** do Controle, e o
  Display (que não tem UI) não teria o que fazer com elas.
- **`display/display.css`** — **nenhum token de cor**. Ele consome de
  `tokens.css`: `--gold`, `--wallpaper`, `--lyrics-frame-bg`, os `--stage-*`,
  `--live-text`, `--bg` e `--accent-glow`. Essa lista está no topo da folha
  para ser conferida: se ela e um `grep var(--` divergirem, é a lista que está
  errada.

**Por que uma folha só.** Até a v5.47 os tokens de marca (`--gold`,
`--wallpaper`, `--lyrics-frame-bg`, `--danger`) eram mantidos **à mão nas duas
folhas**, e o comentário das duas admitia que "a sincronização é manual".
Sincronização manual entre dois arquivos é uma classe de bug, não um processo:
bastava um ajuste entrar só de um lado para o telão e a preview do Controle —
que existe justamente para **espelhar** o telão — passarem a mostrar coisas
diferentes. O precedente de folha compartilhada já existia
(`../shared/material-symbols.css`).

### Tokens

Os valores abaixo são de `shared/tokens.css`, que é a fonte; as razões são
medidas (luminância relativa WCAG, com as superfícies `rgba` compostas contra o
fundo real de cada contexto).

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#131211` | fundo do app |
| `--bar` | `#2c2b29` | bottombar / trilho de abas |
| `--panel` / `--panel-2` | `#343330` / `#44433f` | cartões e linhas de lista / o item ativo ou selecionado |
| `--line` | `#5a5854` | **todas** as bordas e separadores — 2,64:1 contra o fundo |
| `--surface` | `rgba(255,255,255,.12)` | fundo de botão/controle **sobre o fundo do app** (ver R1) |
| `--surface-2` | `rgba(255,255,255,.18)` | chip/campo/badge **sobre o fundo do app** |
| `--text` / `--muted` | `#d6cfc3` / `#b8b0a3` | texto (12,09:1 sobre o fundo · 8,17:1 sobre painel) / secundário (8,71:1 · 5,88:1) |
| `--accent` | `#dba849` | âmbar como **texto, ícone e borda** sobre fundo escuro — 8,65:1 sobre o fundo, 5,84:1 sobre painel |
| `--accent-fill` | `#7c5a17` | o âmbar como **fundo de elemento preenchido** (aba ativa, botão primário) |
| `--on-accent` | `#f6ecd6` | o que se escreve **em cima** de `--accent-fill` — 5,37:1 |
| `--accent-soft` | `rgba(219,168,73,.16)` | fundo suave de estado ativo |
| `--accent-glow` | `rgba(219,168,73,.32)` | halo do `.start-pill` do Display. Segue a MATIZ do accent, não o `--accent-fill`: um halo na cor do preenchimento (escuro por definição) sobre o fundo escuro do app seria invisível. **Saiu do botão de conectar do simplificado bloqueado na v5.75** — ali quem separa o botão do fundo é a cortina embaçada, e o halo só espalhava luz âmbar num salão escuro |
| `--gold` / `--gold-soft` / `--gold-text` | `#dba849` / `rgba(219,168,73,.16)` / `#eed9a8` | marca secundária ("IASD"): logo, capa da letra, pill "Ligar Sistema", rótulo de estrofe, destaque da busca por letra |
| `--live` | `#b34134` | **só** preenchimento/borda de "está no ar agora" |
| `--on-live` | `#f3e9e8` | o que se escreve sobre `--live` — 4,74:1 |
| `--live-text` | `#f0aaa2` | corrida de TEXTO de "no ar" quando ela pousa direto num painel elevado, sem fundo próprio — 9,78:1 sobre o fundo, 5,18:1 sobre `--panel-2`. É um salmão: legível em qualquer lugar, e por isso mesmo pouco vermelho |
| `--live-strong` / `--danger-strong` | `#f4564a` | **o vermelho que se lê como vermelho** (v5.76): ícone, borda e marca preenchida. Mesma matiz (~4°) de `--live`, com a saturação de volta. Medido: 5,59:1 sobre `--bg`, 4,68:1 sobre `--live-soft`/`--danger-soft`, 3,78:1 sobre `--panel`, **2,96:1 sobre `--panel-2`** — este reprova até o piso de borda, e é por isso que quem veste este vermelho veste junto o fundo suave da própria família |
| `--live-soft` | `rgba(179,65,52,.22)` | fundo suave de "no ar" |
| `--danger` / `--danger-text` / `--danger-soft` | mesmos valores do par `--live` | o destrutivo. `--danger` **não tem uso hoje, e isso é intencional**: pela regra R2 ação destrutiva é sempre CONTORNADA, e contorno/texto usam `--danger-text`. Ele fica para o dia em que existir uma superfície destrutiva preenchida — e para deixar explícito qual dos dois tons é o de fundo, que é a distinção que o código antigo não fazia |
| `--warn` / `--warn-text` / `--warn-soft` | `#e5aa78` / `#eec49a` / `rgba(218,135,64,.16)` | aviso: borda/ícone (4,89:1 sobre o próprio suave), texto (6,13:1), fundo |
| `--ok` / `--ok-soft` | `#a2be95` / `rgba(132,169,115,.18)` | concluído/conectado — 6,22:1 sobre painel, 9,21:1 sobre o fundo |
| `--yt` / `--yt-soft` | `#ffa199` / `rgba(255,0,0,.18)` | marca de terceiro. A MATIZ é informação (identifica a origem da mídia) e por isso não pode virar accent; o tom foi clareado até passar AA como texto pequeno sobre o próprio fundo suave, inclusive com a linha selecionada (5,00:1 no pior caso) |
| `--stage-bg` / `--stage-text` | `#000` / `#fff` | **o palco**, não a UI: o preto é preto de verdade (as barras do letterbox têm de sumir na moldura da TV) e o texto projetado é branco pleno — num telão a legibilidade vem de luminância máxima, não de um off-white calibrado para uma tela a 30 cm do rosto |
| `--stage-text-soft` / `--stage-text-dim` | `rgba(255,255,255,.9)` / `.72` | marca sobre o wallpaper / linha auxiliar da letra |
| `--scrim` | `rgba(0,0,0,.6)` | cortina de modal (bottom-sheets e diálogo) |
| `--veil` / `--veil-solid` | `rgba(19,18,17,.55)` / `.92` | cortina do bloqueio do modo simplificado. É o `--bg` com alfa, e os dois têm de andar **juntos**: senão o véu vira um retângulo mais escuro (ou mais claro) que o app inteiro, justamente na tela que abre por padrão sem TV conectada. A variante sólida cobre o caso sem `backdrop-filter` |
| `--wallpaper` | `radial-gradient(circle at 50% 35%, #14331f 0%, #0a1a10 55%, #050b07 100%)` | cortina do wallpaper (Display + preview) |
| `--lyrics-frame-bg` | `rgba(0,0,0,.62)` | fundo da faixa da letra (modo imagem). **Sem borda**: o contorno branco desenhava um retângulo que competia com a letra, e quem separa o texto da foto é a faixa. A densidade foi escolhida pelo PIOR caso — uma foto branca: `.40` deixava o fundo em ~`#999` (**2,85:1** com o texto branco, reprovado); `.62` põe em ~`#616161`, **6,2:1** |
| `--b-*` / `--bt-*` | dez pares | ladrilhos da Bíblia: tinta escura + a matiz da faixa lateral. Ver "Ladrilhos da Bíblia" |
| `--cell-chapter{,-text}` / `--cell-verse{,-text}` | `#2f3d54`/`#dbe6f5` · `#4a3f24`/`#f3e6c8` | células de número da Bíblia. Tons distintos **de propósito** — capítulo frio, versículo quente: as duas grades são iguais em forma e conteúdo (só números) e ficam uma sobre a outra na mesma tela |

Fora de `tokens.css`, no `:root` do Controle (não são cor):

| Token | Valor | Uso |
|---|---|---|
| `--radius-btn` / `--radius-card` / `--radius-pill` | `8px` / `10px` / `999px` | botões e controles / cartões e painéis / badges, chips, pills |
| `--radius-sheet` | `18px` | bottom-sheet — raio MAIOR que o de cartão, e só nos cantos voltados para dentro da tela. É o que lê como "folha que deslizou de fora" em vez de "cartão grande". Eram três `18px` literais, três chances de divergirem |
| `--radius-xs` | `4px` | marcas menores que um botão (badge de 1px de padding, realce de uma linha de letra, a linha-guia de arraste). Com `--radius-btn` elas viram cápsulas; sem raio nenhum, cortes secos no meio do texto |
| `--deck-pv-h` | `130px` | altura da faixa da preview na grade do `.deck` — é token porque a LARGURA da preview sai dela (altura × proporção do telão) |
| `--fader-cap` | `26px` | espessura do cap do fader — **dois** faders a usam (mixer e modo simplificado), e a posição do número sai dela |
| `--icon-sm` / `--icon-md` / `--icon-lg` | `20` / `22` / `24px` | escala dos **glifos de fonte** (`.msym`). Os SVGs inline trazem `width`/`height` no próprio HTML e nunca estiveram sob ela; o modo simplificado tem escala própria, porque ali o alvo é o polegar de quem está de pé |
| `--press` | `scale(.96)` | feedback de toque padrão: todo `:active` usa `transform: var(--press)` |
| `--kb` | `0px` | altura coberta pelo teclado virtual, escrita pelo JS (ver "Deslocamento com o teclado virtual") |

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
- **Tamanho de ícone:** três degraus — `--icon-sm` (20px, botões de
  linha/cabeçalho/popup), `--icon-md` (22px, abas e transporte) e `--icon-lg`
  (24px, miniatura-ícone, dicas de deslize e barras largas de ação). Antes havia
  oito tamanhos (19…27px), cinco deles usados uma única vez. **Desde a v5.49 a
  escala governa também os SVGs inline**, por dois `:is(...)` logo depois do
  bloco de feedback de toque: até ali ela valia só para os GLIFOS de fonte
  (`.msym`, via `font-size`), e os SVGs traziam `width`/`height` escritos no
  HTML e no JS — 14, 16, 17, 19, 20, 22, 26, 28, 30 e 44 px espalhados por dois
  arquivos. O efeito não era teórico: o `#addDirBtn` (19px, SVG) e o `#backBtn`
  (20px, glifo) são vizinhos no mesmo cabeçalho, com a mesma caixa de 34px, e o
  ícone de um saía menor que o do outro sem que nada na folha dissesse por quê.
  O atributo do elemento continua no HTML como valor de partida (vale antes de
  o CSS carregar), mas quem manda é a regra. **Duas exceções**, cada uma dita
  no lugar onde mora: os ícones nos cantos da preview (`.pv-fab`, 24px — sem
  moldura, o ícone É o botão) e o modo simplificado (28px nas teclas, 44px no botão de
  conectar), onde o alvo é o polegar de quem está de pé. "Três degraus **e só
  eles**" era a frase antiga, e ela era desmentida por dezenas de valores no
  HTML; agora ela é verificável.
- **Alvo de toque:** dois degraus, e desde a v5.49 são **tokens** — `--hit`
  (34px) e `--hit-nav` (38px, a faixa de navegação: `.tab` e `.tab-add`). O piso
  de 34px vale para `.row-btn`, `.row-handle`, `.popup-close`, `.back-btn`,
  `.add-dir-btn`, `.sel-btn`, `.coll-bar-dl`, `.coll-group-btn` e `.pv-fab`.
  Nada abaixo disso — o `.back-btn` já teve 20×20 px sendo a única saída da tela
  de Favoritos e da navegação da Bíblia, com o `#addDirBtn` (que abre o SAF)
  logo ao lado. Antes o 34 estava escrito literal em sete regras e, ainda assim,
  dois controles ficavam fora da escala por descuido: `.sel-btn` com 36px e o
  botão do acervo com 42×38 — sete literais é o que faz uma escala de duas
  medidas render quatro tamanhos na mesma tela. Os dois botões de baixar
  (`.coll-bar-dl` no card e `.coll-group-btn` no cabeçalho de grupo) têm o
  **mesmo** alvo de propósito: alinhados na mesma coluna, tamanhos diferentes
  fariam os centros discordarem.
- **Receita repetida vira seletor agrupado, não cópia:** os estados de cor são
  declarados por ESTADO (`.view-blocked`/`.muted`/`.danger` num bloco,
  `.active` noutro), a coluna "nome + subtítulo" das linhas de lista é uma regra
  para `.coll-bar-info, .bible-ver-main, .hymn-info`, e `.tab-add` divide a
  caixa de `.tab` (`flex:1`, `--hit-nav`, mesmo raio) em vez de reescrevê-la.
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
  pills/badges = `--radius-pill`; bottom-sheets = `--radius-sheet`; marcas
  menores que um botão = `--radius-xs`. Os dois últimos existem porque três
  `18px` e vários `4px` literais eram três (e vários) chances de divergirem no
  primeiro ajuste. **Quatro botões largos violavam a primeira metade da regra**
  e foram corrigidos na v5.49 (`.import-btn`, `.msg-add-btn`, `.new-folder-btn`
  e `.folder-pick-btn` usavam `--radius-card`): a maioria dos botões largos do
  app — `.misc-project`, `.mic-btn`, `.chrono-btn`, `.draw-go`
  — sempre usou `--radius-btn`, então eram esses quatro que destoavam, e dois
  deles ("Importar arquivos" e "+ Nova mensagem") são o mesmo tipo de botão
  tracejado em telas diferentes. Na mesma passada o tracejado de `.msg-add-btn`
  virou `--accent` como o de `.import-btn`: dois botões de "acrescentar" com
  bordas de cores diferentes. Casos especiais deliberados que continuam fora do
  sistema: `border-radius: 0` da faixa da letra ("vídeo de louvor", cantos
  retos) e `50%` do thumb do fader.
- **Cor literal fora do sistema: nenhuma.** As duas folhas não contêm `#fff`
  nem `#000` soltos — o preto do palco é `--stage-bg`, o branco projetado é
  `--stage-text`, e até o halo do `.start-pill` virou `--accent-glow`. É a
  regra R3.

### O RISCADO é o corte; a cor confirma; o rótulo nomeia a ação

Regra única para os dois cortes do app — o som e a imagem —, na tela **e** na
notificação do app nativo: **o ícone riscado significa CORTADO**. Alto-falante
riscado = mudo; imagem riscada = telão coberto. Na tela, quem reforça é a
**cor/borda** (`.view-blocked`, `.muted`, `.blocked`), que pinta o botão
inteiro; na notificação, onde não há cor de estado, quem nomeia a ação é o
**rótulo** ("Cobrir telão" / "Mostrar mídia").

A v5.47 tinha adotado o **oposto** — "o ícone é o que o toque vai fazer" — e o
problema que ela atacava era real: estado e ação conviviam misturados, o ▶/⏸
sendo ação enquanto cortina e mudo eram estado, e o mesmo gesto (olhar o ícone)
significava coisas opostas conforme o botão. Só que a saída escolhida gastava o
**riscado** — o símbolo universal de "cortado", o mesmo que o Android usa na
própria tecla de volume — para dizer justamente que NADA está cortado. Nada se
perde invertendo: a cor já carrega o estado sozinha, e a informação que o ícone
passa a dar é a que se lê sem aprender nada.

| Estado | Ícone | Cor |
|---|---|---|
| mídia no ar | imagem inteira | neutra |
| telão coberto | **imagem riscada** | vermelha (`.view-blocked`) |
| som ligado | alto-falante inteiro | neutra |
| mudo | **alto-falante riscado** | vermelha (`.muted`) |
| áudio bloqueado no Display | **alto-falante riscado** | âmbar pulsante (`.blocked`) |

Os dois últimos compartilham o ícone de propósito: nos dois **não sai som**, que
é o que o riscado diz; o que os distingue — mudo do operador × bloqueio do
navegador — é a cor, e a distinção só importa para saber o que o toque vai
tentar (mutar × pedir liberação), que é o que o `title` diz.

**O ▶/⏸ segue sendo AÇÃO**, e isso não é inconsistência: ali a convenção é de
plataforma (todo player do mundo mostra ▶ quando está pausado), o botão não tem
cor de estado, e o par não é "cortado/não cortado".

**A exceção é o `repeat`** (`renderRepeat`), e ela é de forma, não de gosto: o
botão CICLA por quatro modos (off → all → one → shuffle). Num ciclo o glifo só
cabe um, e mostrar o próximo apagaria da tela qual está valendo — a cor
distingue ligado de desligado, não qual dos três. Ali o ícone segue sendo o
modo atual, que é a informação que se perderia.

Botões de **função** (engrenagem de Configurações, folha da leitura auxiliar) e
**segmentados** (modo do app, mesa de som, preenchimento, imagens dos slides,
wallpaper) ficam fora da regra por natureza: não alternam duas ações opostas — o
ícone nomeia o recurso, e o segmento marcado diz o resto.

**⏮/⏭ são um terceiro caso**, e o único em que a cor não diz um estado do
sistema e sim o EIXO do botão: `.slide-mode` (contorno em accent) significa "o
toque curto passa estrofe", e `.axis-end` (esmaecido) significa "esse caminho
acabou; o toque longo ainda troca de mídia". Ver "Um par de botões, dois eixos".

### Escada de elevação, e a regra que faltava

O que separa duas camadas não é a cor de cada uma, é o **degrau** entre elas:
no celular, com brilho baixo no salão, uma escala quase plana faz botão e fundo
virarem a mesma mancha escura. Degraus da paleta atual:

| Par | Razão | Piso |
|---|---|---|
| fundo × barra de abas | **1,32:1** | 1,30 |
| fundo × painel | **1,48:1** | 1,30 |
| painel × painel ativo (`--panel-2`) | 1,28:1 | 1,30 — assumido, ver abaixo |
| fundo × `--surface` (botão sobre o fundo) | **1,38:1** | 1,30 |
| fundo × `--line` | **2,64:1** | 1,60 |
| painel × `--line` | **1,78:1** | 1,60 |
| painel × `--surface` recuada (botão DENTRO do cartão) | 1,18:1 | assumido |
| painel × `--surface-2` recuada (chip dentro do cartão) | 1,11:1 | assumido |

**`--panel` × `--panel-2` fica logo abaixo do piso, e isso é assumido**: ele
não carrega o estado sozinho em lugar nenhum. Quem diz "selecionado" é sempre a
**borda em `--accent`** (5,84:1 sobre o painel); o degrau de fundo é reforço,
não o sinal.

#### R1 — a superfície AFUNDA dentro de um cartão

O ponto estrutural desta versão. `--surface`/`--surface-2` são branco com alfa
**de propósito**: um botão mantém o mesmo degrau relativo esteja ele sobre o
fundo do app ou sobre a barra — três valores fixos divergiriam no primeiro
ajuste. Mas alfa **EMPILHA**: 12% de branco sobre `--bg` dá `#2f2e2e`, e o
MESMO token sobre `--panel` dá `#4c4b49` — os canais sobem 1,6× e a **luminância
relativa mais que dobra** (2,6×), que é o que o contraste enxerga.
Era essa a causa raiz do pior contraste do app — todo texto e ícone colorido
dentro de um cartão reprovava AA porque a base dele era muito mais clara do que
a folha supunha. O pior caso medido: o ícone de cancelar um download, **2,32:1**.

**Não existe alfa que resolva.** Para o botão manter degrau ≥ 1,30:1 contra o
fundo do app é preciso α ≥ .10; para o texto colorido passar AA dentro do
cartão é preciso α ≤ .08. São incompatíveis, porque um único overlay não pode
servir a duas bases.

A saída é **inverter o sinal dentro do cartão** — que também é a convenção
correta de UI escura (o cartão já está elevado, então o controle dentro dele é
**recesso**) e ainda emite menos luz, o que importa num salão no escuro:

```css
.row-item, .lib-item, .hymnal-card, .msg-item, .bible-vsec,
.dialog-card, .popup-sheet, .fade-row, .simple-lyrics, .simple-key {
  --surface:   rgba(0, 0, 0, .24);
  --surface-2: rgba(0, 0, 0, .14);
}
```

Como custom properties **herdam**, essa regra só precisa marcar os elementos
que de fato pintam `--panel` de fundo: toda a descendência vem junto, não há
componente a ajustar, e um componente novo nasce coberto.

**O preço, medido e assumido:** o degrau recuado contra o cartão cai para
1,18:1 (botão) e 1,11:1 (chip). Ali, diferente do fundo do app, o degrau não é
o que anuncia o controle — dentro de um cartão o botão tem ícone, e a linha em
`--line` do próprio cartão já o separa do resto. O que **não** era negociável
era o texto: nenhum par colorido dentro de cartão reprova AA depois desta
regra, e o ícone de cancelar download vai de 2,32:1 para **7,36:1**.

### Uma cor não serve aos dois papéis (accent / accent-fill / on-accent)

`--accent` já foi um valor único usado como **cor de texto** e como **fundo com
texto por cima**. Isso é contradição aritmética, não questão de gosto: para ser
legível COMO TEXTO sobre fundo escuro a cor precisa ser clara; para RECEBER
texto por cima precisa ser escura. Daí três tokens, um por papel:

- **`--accent-fill`** — fundo de elemento preenchido (aba ativa, botão
  primário). É o par **fundo/texto** que reprovava na paleta anterior, e não a
  cor como texto: o azul preenchido com branco por cima passava raspando
  (**4,63:1**), mas o mesmo desenho aplicado ao vermelho — o botão "no ar",
  `--danger` cheio com `#fff` — ficava em **4,23:1**, abaixo dos 4,5 exigidos.
  Separar o papel de fundo do papel de traço é o que torna esse par uma decisão
  em vez de um acidente.
- **`--on-accent`** — o que se escreve em cima de `--accent-fill`. Hoje
  **5,37:1**.
- **`--accent`** — texto, ícone e borda sobre fundo escuro: 8,65:1 sobre o
  fundo, 5,84:1 sobre painel. Elemento **decorativo** sem texto por cima (barra
  de progresso, linha de arraste, trilho de scroll) também usa este, que é o
  que os destaca.

> O texto normativo anterior citava um contraste de **2,66:1 para o azul como
> TEXTO**, e esse número não correspondia a medição nenhuma — o azul antigo
> (`#58a6ff`) dava 7,42:1 sobre o fundo. Ele fazia a régua da decisão parecer
> outra: sugeria que o problema estava no azul como texto, quando estava no
> par fundo/branco. Registrado aqui porque foi essa leitura errada que
> sobreviveu em três lugares da documentação.

### Regras do sistema

- **R1 — a superfície afunda dentro do cartão.** Acima.
- **R2 — `--live`/`--danger` NUNCA são cor de texto, ícone ou borda.** São
  escuros por construção: existem para receber `--on-live` por cima. Texto,
  ícone e borda de "no ar" ou de destrutivo usam `--live-text`/`--danger-text`.
  Usá-los como cor de traço é literalmente o defeito que produzia o 2,32:1.
- **R3 — branco literal não existe.** Sobre `--accent-fill` use `--on-accent`;
  sobre `--live` use `--on-live`; no resto, `--text`. Nenhuma das duas folhas
  contém `#fff` nem um `rgb(255,255,255)` opaco — as únicas ocorrências de
  branco são os `rgba` nomeados em `tokens.css` (`--surface`, `--stage-text*`).
- **R4 — um estado, uma cor.** A tabela de colisões acima é normativa: no ar =
  vermelho preenchido; selecionado = âmbar; concluído = verde; aviso = laranja
  suave + ícone.
- **R5 — os tokens de cor moram em `shared/tokens.css`**, carregado pelos dois
  apps. Não há mais o que dessincronizar.

### Contraste — o que foi medido

Todo par foi recalculado pelo algoritmo de luminância relativa da WCAG, com as
superfícies `rgba` **compostas contra o fundo real de cada contexto** — que é
justamente o passo que faltava antes. Pisos adotados: **4,5:1** para texto
pequeno, **3:1** para ícone/borda que carrega informação, **~1,30:1** para o
degrau entre duas superfícies grandes.

| Par | Antes | Agora |
|---|---|---|
| fundo × barra de abas | 1,19 ✕ | 1,32 |
| fundo × painel | 1,31 | 1,48 |
| painel × painel ativo | 1,22 ✕ | 1,28 (assumido) |
| fundo × borda | 1,95 | 2,64 |
| texto × fundo | 16,73 | 12,09 |
| rótulo apagado (`--muted`) sobre chip (`--surface-2`) no fundo do app | 4,31 ✕ | 5,06 |
| ícone de cancelar download (dentro do cartão) | 2,32 ✕ | 7,36 |
| rótulo sobre bloco de accent | 4,63 | 5,37 |
| rótulo sobre botão "no ar" | 4,23 ✕ | 4,74 |
| pior ladrilho da Bíblia | 3,94 ✕ | 8,66 |

Todas as combinações de **texto colorido contra todos os fundos do app** passam
AA, incluindo os oito fundos possíveis (fundo do app, cartão, cartão ativo,
botão e chip sobre o fundo, botão e chip dentro do cartão, botão no cartão
ativo).

### Ladrilhos da Bíblia

Deixaram de ser dez blocos saturados e passaram a ser **tinta escura + faixa
lateral de 3px com a matiz do grupo** (`--b-<grupo>` e `--bt-<grupo>`). Três
razões, e a primeira é a que motivou tudo:

- **Luz.** É a única tela do app que preenche o visor inteiro de cor, e é
  justamente a que o operador abre NO ESCURO no meio da pregação. Medida, ela
  emitia **16,3% de luminância média** contra 2,3% de um painel comum — 7×
  mais. Com a tinta são **2,8%**, ou seja **5,8× menos luz**.
- **Contraste.** Cinco dos dez grupos tinham o rótulo abaixo de AA, o pior em
  **3,94:1**. Com a tinta o pior rótulo vai a **8,66:1**, e a faixa mantém
  3,2:1 contra a própria tinta — suficiente para ela carregar a informação de
  agrupamento.
- **As matizes se sobrepunham.** `.bg-lei` e `.bg-evangelhos` ficavam a **1,4°
  de matiz** uma da outra: indistinguíveis. As novas foram redistribuídas com
  **18° de separação mínima**.

### Ao adicionar/alterar estilo

1. Existe token pro valor? Use-o. Não existe e o valor se repete? **Crie um
   token** — cor em `shared/tokens.css`, o resto no `:root` do Controle.
2. Fundo em accent? Escolha pelo **papel**: `--accent-fill` se houver texto por
   cima (e aí o texto é `--on-accent`), `--accent` se for texto/ícone/borda ou
   decoração.
3. Está pintando "no ar" ou "destrutivo"? R2: o traço é `--live-text` /
   `--danger-text`, nunca `--live` / `--danger`.
4. Botão novo → acrescentar o seletor à lista `:is(...)` do feedback de toque;
   nada de tap-highlight nem de `:active` próprio.
5. Botão que alterna → ícone = ação, cor = estado (ver acima).
6. Atualizar esta seção e incrementar a versão (os três lugares — ver "Regras
   de desenvolvimento").

### Ao mexer em cor: NÃO há teste automatizado

**Não existe teste medindo contraste neste repositório** — não há suíte de
testes nenhuma. O CI (`.github/workflows/apk.yml`) faz um `node --check` em
cada `.js` do bundle, valida o `version.json`, empacota a base web e compila/
assina o APK; nada ali mede cor, layout ou comportamento. A documentação
anterior afirmava que existia ("há teste medindo isso na
tela renderizada — mudar um token para baixo desses valores falha"), e essa
frase é exatamente o motivo pelo qual dois pares (`--bg`×`--bar` em 1,19 e
`--panel`×`--panel-2` em 1,22) ficaram abaixo do piso declarado sem ninguém
notar: quem confia no doc conclui que uma regressão seria barrada no CI e
ajusta um token sem medir.

Enquanto não houver o teste, **meça à mão** antes de mudar um token: luminância
relativa WCAG, com as superfícies `rgba` compostas contra o fundo real do
contexto — **inclusive o caso "dentro de um cartão"**, que é onde as regressões
aparecem (R1).

---

## Fonte de ícones (Material Symbols)

Versão subconjuntada (~2.2 KB woff2): peso 400, **29 glifos + o espaço, todos
usados** na UI — referenciados por codepoint via o mapa `ICON` em `controle.js`
**ou** direto como entidade HTML `&#x…;` no `controle/index.html`.
**Só o Controle carrega a fonte** — o Display é só wallpaper + mídia, sem
nenhum glifo (por isso `display/index.html` não inclui
`material-symbols.css`/`.woff2`).

**Codepoints no subset** (v5.112):
```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E145 E14C E150 E251 E2C7 E2C8 E2CC E3A1
E3AD E5C4 E5CA E616 E838 E872 E945 EA5D EB80 F116
```

`E5CA` (check) entrou na v5.112 para o **pulso de confirmação**: o `✓` e o `✕`
eram os caracteres Unicode, desenhados pela fonte do SISTEMA (num Android
qualquer, a Roboto) — traço de caneta, com entrada e saída afinando e a perna do
✓ curvando. Ao lado de vinte ícones geométricos de traço constante, o sinal de
confirmação era a única coisa "desenhada à mão" da tela. Agora são `check` e
`close`, retos e do mesmo peso — e o ✕ do erro passou a ser literalmente o mesmo
glifo do botão de fechar.

A v5.110 fez a primeira limpeza real do subset: **saíram** `E5CF`
(expand_more), `E86C` (check_circle) e `E8F5` (visibility_off) — os três
estavam no woff2 sem uma única referência no código, e a varredura por
codepoint (caractere literal, `&#x…;` e `\uXXXX`) confirmou — mais `E413`
(photo_library), aposentado com a troca do ícone da aba. **Entraram** `E616`
(event_note), `EA5D` (more_time) e `E145` (add), pelas razões da caixa abaixo.
Resultado: um terço menor e sem nenhum glifo morto.

#### Cronograma × playlist: dois destinos, dois símbolos (v5.110)

Três ícones eram a mesma pilha de linhas com uma marquinha diferente no canto —
e a marquinha é justamente o que não se lê num toque:

| Onde | Antes | Depois |
|---|---|---|
| aba **Cronograma** | `photo_library` (pilha de fotos) | **`event_note`** — a agenda |
| **adicionar ao Cronograma** | `playlist_add` | **`more_time`** — relógio com `+` |
| **acrescentar à playlist** | `playlist_add` | `playlist_add` (segue) |
| playlist (transporte, `#plBtn`) | `queue_music` | `queue_music` (segue) |

O caso mais grave era o mesmo glifo (`playlist_add`) servindo aos DOIS destinos:
o botão `+` de uma linha mandava para o Cronograma e o da barra de seleção,
idêntico, para a playlist. Agora o Cronograma é a família do **tempo** — sem
linha nenhuma, então se separa da pilha à distância — e diz o que a lista é: a
ORDEM do culto, não uma fila de reprodução. A pilha de fotos, além de parecida
com as outras, nomeava a lista pelo que ela era antes da v5.103: hoje o
Cronograma guarda versículo, mensagem e contagem, não só arquivos com bytes.

O botão de adicionar da linha do acervo (`.hymn-add-btn`) virou o **`add`
neutro**: ele não escolhe destino nenhum, abre a folha que pergunta qual — e
carregar o ícone de um dos três destinos era prometer um caminho que o toque
não faz.

#### Como regerar o subset

Não há dependência nova: o `.woff2` é versionado, e as ferramentas abaixo rodam
uma vez, à mão, na máquina de quem mexe.

```bash
npm pack material-symbols            # a fonte variável Outlined, do npm
pip install fonttools brotli
```

```python
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
f = TTFont('material-symbols-outlined.woff2')
# PRENDER OS EIXOS é o que faz os glifos antigos saírem idênticos aos do subset
# anterior — a família é variável, e um `wght` diferente redesenha TUDO.
f = instancer.instantiateVariableFont(f, {'FILL': 0, 'GRAD': 0, 'opsz': 24, 'wght': 400})
o = subset.Options(); o.flavor = 'woff2'; o.layout_features = []; o.notdef_outline = False
s = subset.Subsetter(options=o); s.populate(unicodes=CPS); s.subset(f)
f.flavor = 'woff2'; f.save('material-symbols.woff2')
```

Depois **compare o antigo e o novo lado a lado** antes de trocar o arquivo: é a
única forma de perceber que um eixo ficou solto e mexeu em vinte ícones que
ninguém pretendia tocar.

**Ícones fora do subset → SVG inline.** Quando um ícone necessário não está no
subset e re-gerar o woff2 não vale a pena (ou o ambiente não tem `fontTools`),
usa-se um `<svg>` inline direto no HTML, com `fill/stroke: currentColor` (herda
a cor do botão). Hoje: o botão de **volume** do mixer (`#volToggle`, ícone de
faders/mixer), a **lupa** da busca do acervo (`#hymnSearchBtn`), a antena de
**Wi-Fi** dos cards de coleção (`wifiIconEl`), o **fone de ouvido** da mesa de
som (`#pvSoundBtn`, hoje sobre a preview), a **folha com linhas** da leitura
auxiliar (`#lyricsViewBtn`, que substituiu a flor do antigo botão de fundo da
letra), a **engrenagem** de Configurações (`#settingsBtn`, no topo do mixer), as
**setas** do par de troca de modo (`.mode-switch`), o
ícone **"arquivos+"** (documento com `+`) do botão de importar no fim do
Cronograma (`.import-btn`), que diferencia importar ARQUIVOS de abrir os
FAVORITOS (estrela, no botão ao lado — e a mesma estrela na "Nova pasta"),
os dois botões flutuantes da preview (**cast** e
**expandir** — `#pvCastBtn`/`#pvFullBtn`),
e nos **cards de coleção** a **seta de baixar** (`downloadAllIconSvg`), o **✕**
de cancelar (`closeIconSvg`), as **setas circulares** de sincronizar
(`syncIconSvg`), o **check** de "completo offline" (`checkIconSvg`), a
**engrenagem** de opções (`gearIconSvg`) com a **seta para cima** que a
substitui enquanto elas estão à mostra (`chevronUpIconSvg`) e o ícone de
**lista** (`listIconSvg`); e nos resultados da busca os botões de tocar
**voz/microfone** (Cantado, `voiceIconSvg`) e **nota musical** (Playback,
`noteIconSvg`); e o **livro com uma cruz** da aba **Bíblia**
(`.tab[data-tab="bible"]`), mais a **grade de módulos** da aba **Ferramentas** —
que substituiu o microfone quando a aba deixou de ter uma ferramenta só.

> **Borda nativa dos `<button>`**: `.tab-add` e `.pv-fab` zeram
> `border`/`appearance` explicitamente — sem isso, um `<button>` (ex.:
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
