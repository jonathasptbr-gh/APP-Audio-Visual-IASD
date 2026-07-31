# Claude Code — APP Áudio Visual IASD (Android nativo)

App Android nativo do sistema de projeção de mídia para culto (IASD). É uma
**casca fina em Kotlin** que hospeda a base web do projeto em dois WebViews e
usa `android.app.Presentation` para mandar **só o Display** para a TV — sem
espelhar o celular.

> **Este repositório é autossuficiente.** A base web (`app/src/main/assets/web/`)
> foi copiada do PWA original e **agora vive aqui**: não há checkout cruzado,
> submódulo nem qualquer dependência de build do repositório do PWA. A
> arquitetura completa dessa base está em
> [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) — **leia antes de mexer
> em qualquer coisa dentro de `assets/web/`.**

## Índice

1. [O ganho: Presentation em vez de espelhamento](#o-ganho-presentation-em-vez-de-espelhamento)
2. [Estrutura do repositório](#estrutura-do-repositório)
3. [Invariantes do shell (não quebrar)](#invariantes-do-shell-não-quebrar)
4. [A ponte `window.AVNative`](#a-ponte-windowavnative)
5. [Barramento de comandos e o plano B do BroadcastChannel](#barramento-de-comandos-e-o-plano-b-do-broadcastchannel)
6. [Trabalho em segundo plano (downloads com o app minimizado)](#trabalho-em-segundo-plano-downloads-com-o-app-minimizado)
7. [OTA da base web (atualização sem APK)](#ota-da-base-web-atualização-sem-apk)
8. [Divergências entre o caminho web e o nativo](#divergências-entre-o-caminho-web-e-o-nativo)
9. [Build e distribuição](#build-e-distribuição)
10. [Regras de desenvolvimento](#regras-de-desenvolvimento)

---

## O ganho: Presentation em vez de espelhamento

O Miracast espelha **a tela do celular**. Foi essa limitação que gerou toda a
arquitetura web original: dois apps separados, comunicação por
BroadcastChannel, a preview como reimplementação do Display e dois players do
YouTube tocando ao mesmo tempo.

```
┌──────────────────────┐        ┌─────────────────────────────┐
│  Celular (Activity)  │        │  TV (Smart View/MiraScreen) │
│  WebView "controle"  │  ◄──►  │  Presentation + WebView     │
│  /web/controle/      │  IDB   │  /web/display/              │
│  portrait            │   +    │  resolução nativa da TV     │
└──────────────────────┘   BC   └─────────────────────────────┘
        MESMO PROCESSO · MESMO ORIGIN · MESMO IndexedDB/OPFS
```

Os dois WebViews rodam no mesmo processo e no mesmo origin
(`https://appassets.androidplatform.net/`), então **compartilham IndexedDB,
OPFS e BroadcastChannel exatamente como os dois PWAs compartilhavam no
navegador**. É por isso que `shared/db.js`, `shared/stage.js` e todo o
protocolo de comandos seguem inalterados.

**Sem TV conectada o app continua útil:** nenhuma Presentation é criada e a
projeção volta a ser a preview do Controle em tela cheia (o mesmo fallback do
PWA, incluindo os gestos invisíveis).

---

## Estrutura do repositório

```
app/src/main/
├── AndroidManifest.xml          # intent-filter de share, portrait, keep-awake
├── assets/web/                  # ← a base web (cópia própria, versionada aqui)
│   ├── version.json             #   identidade do bundle (version + minShell)
│   ├── shared/native.js         #   ponte AVNative (NOVO — não existe no PWA)
│   ├── shared/db.js             #   + relay nativo no canal de comandos
│   ├── controle/                #   (sem sw.js / manifest / icons — ver abaixo)
│   └── display/                 #   (idem)
├── java/br/org/iasd/av/
│   ├── MainActivity.kt          # Activity + WebView do Controle + Presentation
│   ├── StagePresentation.kt     # Presentation + WebView do Display (o telão)
│   ├── WebViewFactory.kt        # asset loader + settings comuns (invariantes)
│   ├── NativeBridge.kt          # @JavascriptInterface — a ponte
│   ├── SafPathHandler.kt        # serve arquivos do dispositivo em /saf/<token>
│   ├── ShareIntake.kt           # intent ACTION_SEND → formato do share web
│   ├── SyncService.kt           # foreground service: downloads com o app minimizado
│   ├── SessionService.kt        # MediaSession + notificação com os controles de transporte
│   ├── WebUpdater.kt            # OTA da base web (watchdog, minShell, sha256)
│   ├── WebPathHandler.kt        # serve o bundle OTA, com fallback pro APK
│   ├── MicChromeClient.kt       # onPermissionRequest: microfone no WebView do telão
│   └── MessageBus.kt            # relay de comandos entre os dois WebViews
└── res/                         # ícones do app + drawable/ic_image{,_off} (cortina), tema
docs/
├── ARQUITETURA-WEB.md           # arquitetura completa da base web
└── FONTE-DE-DADOS-LOUVORJA.md   # referência do banco LouvorJA (hinos/Bíblia)
```

**~800 linhas de Kotlin, zero dependências de terceiros** — só AndroidX oficial
(`core-ktx`, `activity-ktx`, `webkit`). Isso respeita a filosofia do projeto
muito melhor que Capacitor/Cordova, que arrastariam npm e um build system
inteiro e ainda assim exigiriam código nativo próprio para a Presentation.

---

## Invariantes do shell (não quebrar)

Estão codificadas em `WebViewFactory.kt` e são o que sustenta a base web:

1. **Servir por `https://appassets.androidplatform.net/`, JAMAIS por
   `file://`.** O contexto seguro é o que faz OPFS e IndexedDB funcionarem.
   Não é opcional.
2. **Um único origin para os dois WebViews.** É o que preserva IDB/OPFS/
   BroadcastChannel compartilhados. Origens distintas destroem a arquitetura.
3. **Um único processo/perfil de WebView.** Nada de processo isolado para o
   Display.
4. `mediaPlaybackRequiresUserGesture = false`, `domStorageEnabled`,
   `javaScriptEnabled`, aceleração de hardware ligada.
5. **Não reimplementar em Kotlin nada que já exista em JS.** Transporte,
   playlist, letra sincronizada, Bíblia, Camada de Texto e fades permanecem no
   web — são ~7.000 linhas de lógica madura.
6. **`onShowFileChooser` no `WebChromeClient`.** Um WebView **ignora
   `<input type="file">` por completo** sem esse override: o toque não faz
   nada, sem erro nenhum no console. No navegador o seletor é da plataforma;
   aqui é o app que precisa abri-lo. Dele dependem a importação para o
   Cronograma e a escolha do wallpaper.
7. **`onShowCustomView`/`onHideCustomView`.** Sem eles, `requestFullscreen()`
   falha silenciosamente — e a preview em tela cheia é a projeção quando não
   há TV conectada.

**Reconexão vem de graça:** quando o dongle cai e volta, o Android destrói e
recria a Presentation, o WebView recarrega `/display/` e dispara
`display-ready` — e o Controle reenvia a cena ao receber isso
(`resendSceneToDisplay` em `controle.js`). Não invente um mecanismo paralelo.

A **cena** é mais do que "mídia tocando": além do `load` da mídia (inclusive
uma imagem estática, que não tem `playing`), o Controle reenvia o comando
`text` do versículo ou da mensagem que estiverem projetados — nessa ordem, já
que no Display um `load` visual encerra a Camada de Texto e um `load` de áudio
a mantém. Até a v5.03 só mídia com `playing` era restaurada, e um versículo no
ar durante a pregação sumia do telão para sempre depois de um blip do
espelhamento, sem nenhum sinal no Controle.

**Morte do renderer também é recuperável:** `WebViewFactory.create` recebe um
callback `onRendererGone` e o `WebViewClient` devolve `true` em
`onRenderProcessGone`. Sem isso o padrão do framework é matar o processo — um
OOM do renderer (dois WebViews, vídeo grande e player do YouTube no mesmo
processo) derrubaria o Controle e a projeção juntos. Cada dono
(`MainActivity`, `StagePresentation`) remonta o próprio WebView, e o telão
recarregado dispara `display-ready`, caindo no mesmo caminho de reconexão
acima.

---

## A ponte `window.AVNative`

Definida em `shared/native.js` (lado web) sobre `__AVBridge` (lado Kotlin,
`NativeBridge.kt`). **Só existe quando `window.__NATIVE__`** — no navegador o
arquivo inteiro é um no-op.

```js
window.AVNative = {
  pickFolder(),        // → { id, name, uri }   (SAF ACTION_OPEN_DOCUMENT_TREE)
  listFolder(uri),     // → [{ name, size, mtime, type, url }]
  onShare(cb),         // cb({ files:[{name,type,url}], url, title })
  displays(),          // → [{ id, name, w, h, density }]
  onDisplayChange(cb),
  keepAlive(bool),     // download em curso — ver "Trabalho em segundo plano"
  bgProgress({label, done, total, etaMs, items, idleMs}), // progresso na notificação
  nowPlaying({active, title, subtitle, playing, slideMode, wallpaper, positionMs, durationMs}),
  onRemote(cb),        // cb('play'|'pause'|'playpause'|'prev'|'next'|'stop'|'view')
  openCast(),          // seletor de ESPELHAMENTO DE TELA do Android (≠ Google Cast)
  castTarget(),        // → rótulo do alvo de espelhamento deste aparelho
  captureVolumeKeys(bool), // botões físicos de volume vão para o app
  systemVolume(step),  // devolve um passo ao volume do sistema (fader no limite)
  requestMic(),        // → bool: permissão RECORD_AUDIO (push-to-talk)
}
```

Além disso, `native.js` publica três globais lidas direto (sem Promise):
`window.__NATIVE__`, `__AV_ROLE__` (`'controle'`/`'display'`), `__SHELL_VERSION__`
(o inteiro do contrato, ver abaixo) e **`__SHELL_NAME__`** — o `versionName` do
APK, que é o **índice de versão do shell exibido ao operador**. Ele não se
confunde com `__SHELL_VERSION__`: base web e shell atualizam por caminhos
independentes (OTA × instalar APK), então o cabeçalho do Cronograma mostra os
dois (`Web v5.18 · Shell v1.19`). Num shell antigo (sem `appVersion()`) a
string vem vazia e a UI cai em só a versão web — mesma degradação do navegador.

**Princípio: a ponte entrega URLs SERVÍVEIS, não bytes.** Arquivos do
dispositivo e compartilhamentos chegam como
`https://appassets.androidplatform.net/saf/<token>` e o lado web usa `fetch()`
+ `Blob` exatamente como já faz com o OPFS — nenhuma função de importação
precisou ser reescrita, e **um vídeo de 2 GB nunca passa por base64**.

O token é um contador opaco (`SafRegistry`), não o URI codificado: o
`PathHandler` recebe o caminho já decodificado, e um `content://` com barras
viraria segmentos de rota e quebraria o roteamento.

`NativeBridge.SHELL_VERSION` identifica a versão da casca — **subir sempre que
a superfície da ponte mudar**.

---

## Barramento de comandos e o plano B do BroadcastChannel

`BroadcastChannel` entre dois WebViews same-origin no mesmo processo **deve**
funcionar — mas o isolamento de sites do WebView pode surpreender, e uma falha
aí derrubaria o comando do telão no meio de um culto.

Em vez de detectar a falha (handshake com janela de corrida), o **relay nativo
roda SEMPRE em paralelo**: cada comando sai pelos dois caminhos
(`BroadcastChannel` + `MessageBus` nativo) e a cópia repetida é descartada em
`shared/db.js` pelo campo `__mid`. O resto do sistema não sabe de nada —
`sendCommand`/`onCommand` mantêm exatamente a mesma assinatura.

O custo é desprezível: os comandos são objetos JSON pequenos e o mais
frequente (`display-status`) já roda a 2 Hz.

---

## Trabalho em segundo plano (downloads com o app minimizado)

Ao minimizar o app, o Android trata o processo como descartável e pode
**congelá-lo** — a sincronização de hinos, álbuns, Bíblia ou pastas parava no
meio. Isso acontecia no uso normal, já que ninguém fica olhando a tela
enquanto um hinário inteiro baixa.

A correção declara o trabalho ao sistema: enquanto há download, o
[`SyncService`](app/src/main/java/br/org/iasd/av/SyncService.kt) roda em
primeiro plano (com a notificação que o Android exige) e segura um wake lock
parcial — o processo não é congelado e o WebView continua baixando.

**Quem liga e desliga é o lado web**, que é quem sabe o que está em curso:
`bgWorkBegin()`/`bgWorkEnd()` em `controle.js` contam as tarefas ativas e só
acionam `AVNative.keepAlive()` no **primeiro** início e no **último** término —
dois downloads simultâneos não podem fazer o primeiro a terminar desligar a
proteção do outro. O `finally` de `withBgWork()` é o ponto crítico: uma falha
de rede não pode deixar o serviço e o wake lock ligados.

Pontos cobertos: `syncCollection` (massa), `ensureSongDownloaded` (avulso),
`ensureBibleVersionDownloaded` (1189 capítulos) e `syncDeviceFolder` (pastas).
O wake lock tem timeout de 2 h, para um download travado nunca consumir
bateria indefinidamente. No navegador tudo isso é no-op.

**A notificação mostra o progresso real.** Com o app minimizado ela é a ÚNICA
janela para o download, e era um texto fixo ("Baixando mídias") — não dizia
quanto falta nem se ainda anda. Quem sabe o progresso é o lado web, então é ele
que reporta, por `AVNative.bgProgress({label, done, total, etaMs})`:
`bgTaskStart`/`bgTaskStep` em `controle.js` alimentam
`SyncService.updateProgress`, que refaz a notificação com barra, "N de M",
percentual e o tempo restante.

- **A notificação diz O QUE está baixando, não só quantos.** `bgItemStart`/
  `bgItemEnd` (e `bgItemOnly`, para fluxos sequenciais) registram os itens em
  voo — nome da música, "Gênesis 3", nome do arquivo. "23 de 54" é abstrato;
  "002. Ó Adorai o Senhor" é o que o operador reconhece, e vê-lo trocar é o
  que mostra movimento.
- **A lista é uma FILA, não um espelho do que está no ar.** A concorrência
  existe para reduzir o tempo PROPORCIONAL de cada item: se os 6 juntos levam
  X, cada um custou X/6 — e a exibição segue essa mesma conta, dando X/6 de
  tela a cada nome, um depois do outro. É deliberadamente **ilustrativo e não
  em tempo real**: os nomes saem de um buffer (`t.fila`) do que já entrou em
  download. O contador, a barra e a estimativa continuam sendo os números
  reais.
- **Fila, e não rodízio entre os itens em voo.** O rodízio trazia o mesmo
  nome de volta várias vezes — repetitivo, e a lista não ia a lugar nenhum. A
  fila consome cada nome UMA vez, em ordem. Medido (18 faixas, 6 em paralelo):
  **18 de 18 nomes exibidos, 0 repetidos, em ordem, fila zerada**.
- **O ritmo é MEDIDO, não chutado** (`bgSpinMs`): `decorrido / concluídos` é
  o tempo médio por item — exatamente o X/6. Medido: mediana de **500 ms em
  tela contra 521 ms de custo amortizado real**; com faixas de tamanho
  irregular, 750 contra 750. Se a fila acumula (a rede acelerou), o escoamento
  acelera junto, para a lista não ficar exibindo um passado cada vez mais
  velho.
- **Sem o buffer a lista engasgava.** Os 6 workers andam em lockstep — entram
  e saem quase juntos —, então os eventos chegam em rajada (meia dúzia em
  poucos ms) seguida de segundos de silêncio. Sem fila, a rajada rendia UMA
  troca de nome e o resto era descartado: o nome ficava parado até a rajada
  seguinte, que é exatamente a sensação de travado.
- **O compasso PARA quando o download trava.** Animar durante uma queda de
  rede esconderia justamente o que precisa ser visto — e ali não há novidade
  nenhuma a mostrar, só passado. Passando `BG_STALL_MS` (90 s) sem nenhum
  evento real, a lista congela e o `idleMs` cresce na tela: os dois sinais
  concordam. Verificado: 6 nomes distintos em operação normal, 1 só com a
  tarefa travada.
- **`idleMs` separa "travado" de "esta faixa é grande"**, que na tela são a
  mesma coisa parada. Passado o limiar, a notificação **para de prometer
  tempo restante** e passa a dizer "sem resposta há X": uma ETA calculada
  sobre um ritmo que não existe mais é a promessa mais enganosa que essa
  notificação pode fazer. E `formatIdle` não usa degraus (ao contrário de
  `formatEta`) — aqui o número PRECISA subir a cada atualização, é vê-lo
  crescer que diz "isto não está andando".
- **O freio da notificação é por PRIORIDADE, escolhida pelo chamador.** São
  dois pisos: 250 ms para um item que ENTROU em download (a notícia do
  momento) e 700 ms para rotina. A prioridade é explícita, e não deduzida de
  "o nome mudou", porque no laço do worker o fim de uma música e o início da
  seguinte acontecem a poucos ms um do outro: disputando o mesmo piso, o fim
  chegava primeiro e derrubava o início, que é o fato mais fresco.
- **É um REGISTRO de tarefas, não um slot único.** O app tem downloads
  simultâneos — é por isso que `bgWorkCount` conta em vez de ser um booleano —,
  e entrar na aba Bíblia enquanto um lote de álbuns baixa dispara os dois ao
  mesmo tempo. Com um slot só, as duas escreviam uma por cima da outra: o
  `done` de uma aparecia com o `total` e o `startedAt` da outra, e a estimativa
  pulava de 1h30 para 2h40 e voltava. Cada tarefa tem seu registro; a
  notificação mostra a **dominante** (maior tempo restante — é ela que decide
  quando tudo acaba) e sinaliza as outras com `(+N)`. Somar tarefas de
  naturezas diferentes (capítulos + músicas) num total único daria um número
  sem significado.
- **A estimativa vem do ritmo MÉDIO desde o PRIMEIRO item concluído** (não
  desde o `start`: antes dele corre o preparo — índice, varredura do que falta
  — e contá-lo como tempo de download inflava a primeira estimativa, que depois
  despencava). Média, não taxa instantânea: faixas têm tamanhos muito
  diferentes e a instantânea faria o número pular a cada música.
- **Suavização assimétrica e por CONSTANTE DE TEMPO** (`ETA_TAU_DOWN` 2,5 s /
  `ETA_TAU_UP` 10 s): cai rápido, sobe devagar — uma contagem regressiva que
  aumenta parece quebrada, mesmo quando o número novo está certo. Por tempo, e
  não por chamada, porque o compasso de 1 s pede a estimativa muito mais vezes
  que antes: um fator fixo por chamada colaria o valor exibido no bruto e o
  número voltaria a pular, que é o defeito que a suavização existe para
  evitar.
- **Arredondamento em degraus** no lado nativo (1 min perto do fim, 5 min
  abaixo de 1 h, 10 min acima): a incerteza cresce com o horizonte, e mostrar
  "2h03" quando o erro real é de meia hora promete uma precisão que não
  existe — além de fazer o número mudar a cada atualização, o que se lê como
  instabilidade mesmo quando a estimativa está convergindo.
- **Há um intervalo mínimo entre atualizações** (`BG_NOTIF_MIN_MS`, 700 ms). O
  Android limita a taxa de updates de notificação e passa a descartá-los — sem
  o freio, uma faixa curta atualizaria várias vezes por segundo e a barra
  pareceria travada. O estado final é enviado com `force`, ignorando o freio.
- **Num lote (`syncGroup`) a barra acompanha o LOTE**, não cada álbum: o total
  é a soma das músicas pendentes de todos eles, contada uma vez. Reiniciar a
  barra a cada álbum daria doze barras curtas em vez de uma que informa quanto
  falta de verdade.
- Num shell antigo `bgProgress` não existe; o `try` de `native.js` engole e a
  notificação segue estática — exatamente o comportamento anterior.

---

## Notificação de controles (sessão de mídia)

[`SessionService.kt`](app/src/main/java/br/org/iasd/av/SessionService.kt) publica
um `MediaSession` e uma notificação `MediaStyle` com os controles de transporte.
Dois ganhos, e o segundo é o menos óbvio:

1. **Controlar sem abrir o app.** No modo "mesa de som" o celular está ligado na
   caixa de som e provavelmente bloqueado; abrir o app só para pausar é atrito
   real no meio de um culto. Com o `MediaSession` os controles aparecem também
   na **tela de bloqueio** e nas configurações rápidas, de graça.
2. **A projeção deixa de ser descartável.** Antes disto o único serviço em
   primeiro plano era o `SyncService`, que só sobe DURANTE downloads: num culto
   normal não havia nenhum, e o processo seguia candidato a ser morto sob
   pressão de memória — levando junto a `Presentation` na TV. Um serviço
   `mediaPlayback` ativo enquanto houver cena fecha esse buraco.

- **Nenhuma decisão de transporte em Kotlin** (invariante 5). O sistema entrega
  uma string de ação, `SessionRemote` a repassa a `window.__avRemote`, e o lado
  web aciona os **mesmos botões da tela** por `.click()`. Os handlers já tratam
  todos os casos de borda (texto sem áudio de fundo, YouTube que precisa
  recarregar, limites da playlist) e um botão `disabled` é um no-op natural.
- **Por isso nenhuma ação é desabilitada no lado nativo.** Quem sabe se
  "estrofe anterior" faz sentido agora é o web; desabilitar nos dois lugares
  duplicaria a regra, e a cópia em Kotlin envelheceria.
- **⏮/⏭ mudam de eixo conforme a cena.** Na tela os dois eixos têm botões
  próprios (mídia no transporte, estrofe ao lado da preview), mas na notificação
  só cabem três no modo compacto — e com letra, versículo ou mensagem em cena é
  a estrofe que o operador está passando. `slideMode` (de `slideTarget()`)
  decide, e o rótulo do botão diz qual é o modo para não virar adivinhação.
- **`play`/`pause` e `playpause` são coisas diferentes.** Tela de bloqueio, fone
  e Android Auto sabem o que querem e mandam intenção explícita; o botão da
  notificação é alternador. Tratar tudo como alternador faria um `onPlay`
  recebido com o áudio já tocando PAUSAR o louvor.
- **O estado sai de `pushNowPlaying`**, que lê o título do próprio `#npName` já
  renderizado, e a posição/duração da própria **barra de progresso** — em vez de
  reconstruir as três origens (mídia/versículo/mensagem) ou recalcular o tempo
  por fora. Duplicar essas árvores era garantir divergência; e a barra é a única
  fonte que cobre todos os tipos, inclusive YouTube (`preview.getDuration()` é do
  `<video>` do stage e não sabe nada de um vídeo do YouTube).
- **A posição fica fora da chave de deduplicação**, porque a sessão extrapola o
  tempo sozinha (posição + decorrido × velocidade) — reenviar a cada segundo só
  para mexer o cursor seria desperdício. Mas um **seek é uma descontinuidade**
  que a extrapolação não adivinha: até a v1.18, pular uma estrofe deixava a
  barra contando a partir do ponto antigo e mostrando um tempo falso. Em vez de
  avisar em cada ponto que faz seek (slide, barra, gesto, re-sincronia com o
  Display), `pushNowPlaying` compara o tempo real com o que a sessão estaria
  extrapolando e republica quando diverge além de `POS_TOL_MS` (1,5 s — folga
  para o jitter do `display-status`). Um só lugar cobre todas as causas,
  inclusive as futuras. Durante um ARRASTE na barra não republica: ali o valor
  é a posição do dedo, não a da mídia.
- O serviço vive enquanto houver **cena** (mídia carregada, letra, versículo ou
  mensagem), não só enquanto toca: pausado, o operador ainda precisa do botão de
  play. Sem cena, ele para e a notificação some.
- **Ícones são os do sistema** (`android.R.drawable.ic_media_*`) — carregar um
  conjunto próprio no `res/` só para cinco botões não se paga, e o `MediaStyle`
  os tinge conforme o tema. **Exceção: a cortina**, que usa
  `ic_image`/`ic_image_off` (vetores próprios). O sistema não tem imagem
  riscada, e o que havia até a v1.18 (`ic_menu_view`) é um OLHO — sugere
  "esconder a vista", quando o que sai do telão é a MÍDIA. São os mesmos dois
  símbolos que o botão do app já usa nesse par de estados.
- **O ícone da cortina segue a AÇÃO, não o estado** — e desde a v5.18 essa é a
  regra de TODO botão de alternância do projeto, na notificação e na tela (ver
  "O ícone mostra a AÇÃO; a cor mostra o ESTADO" em `docs/ARQUITETURA-WEB.md`).
  Com a mídia no ar o ícone é a imagem riscada, porque é isso que o toque vai
  fazer; o rótulo ("Cobrir telão"/"Mostrar mídia") já dizia o mesmo.
- **A partir do Android 13 quem desenha os botões é o `PlaybackState`, não a
  notificação.** As `Notification.Action` viram decoração nessas versões: os
  controles saem das *actions* do estado (play/pause, ⏮/⏭) e os extras, de
  `PlaybackState.CustomAction`. Foi por isso que, na v1.17, "Parar" e a cortina
  simplesmente não apareciam e só restavam os botões nativos — as duas são
  custom actions desde a v1.18, entregues por `onCustomAction`.
- **`publish()` sempre roda na main thread.** Todo `@JavascriptInterface` é
  chamado de uma thread do WebView, e `MediaSession` tem handler próprio e não
  promete ser thread-safe — mexer nele de fora é o tipo de coisa que funciona
  num aparelho e falha calada noutro.
- **A verificar em aparelho:** se o WebView criar uma sessão de mídia própria ao
  tocar áudio, poderia aparecer uma notificação concorrente. Nada no código
  indica isso (o WebView não se comporta como o Chrome aqui), mas não foi
  observado rodando.

---

## OTA da base web (atualização sem APK)

No PWA, um push em `main` chegava sozinho ao aparelho. Empacotada num APK, a
base web passaria a exigir baixar e instalar à mão a cada ajuste de JS/CSS —
o OTA devolve o comportamento antigo, com mais controle.

**Como funciona:** o job `web-ota` (em todo push para `main`) empacota
`assets/web/` num `web-assets.zip` (~170 KB) e publica, junto com um
`version.json`, na release de tag fixa **`web-latest`** — URL estável, porque
está compilada no shell. O app consulta esse `version.json` na abertura,
baixa quando há versão nova e passa a servi-la.

**A identidade do bundle é `assets/web/version.json`** (`version` +
`minShell`), versionado no repositório: o bundle carrega a própria versão,
seja ele o embutido ou o baixado. O workflow só acrescenta `sha256` e a URL.
**Atualizar esse arquivo junto com `#appVersion`** — é o que dispara (ou não)
uma atualização nos aparelhos.

**O OTA não muda o acesso ao nativo.** A ponte é injetada no WebView pelo
Kotlin (`addJavascriptInterface`), não vem nos arquivos web: um bundle
baixado enxerga `__AVBridge` exatamente como o embutido, e o
`WebViewAssetLoader` serve os dois pelo mesmo origin — logo IndexedDB, OPFS,
SAF, Presentation e o serviço de segundo plano seguem idênticos.

### As três garantias (isto roda em culto)

1. **Nunca troca a base no meio de uma sessão.** O download é em segundo
   plano, mas o bundle novo só entra no **próximo lançamento** — o WebView do
   telão jamais recarrega ao vivo. Isso inclui **não apagar do disco o bundle
   que a sessão está servindo**: a faxina de bundles antigos preserva tanto o
   alvo novo quanto o `sessionRoot` em uso, e recolhe o resto no
   `beginSession()` seguinte, que é o único ponto em que nenhum WebView existe
   ainda. Sem essa ressalva, ativar uma versão nova durante o culto apagava o
   diretório vivo: todo recurso ainda não carregado, e qualquer recarga do
   telão, caíam no fallback do APK — versão mais antiga, no meio da projeção.
2. **Válvula `minShell`.** Se o bundle exigir uma ponte mais nova que
   `NativeBridge.SHELL_VERSION`, é recusado: o app continua no que já tinha,
   funcionando, até um APK novo chegar. **É por isso que `SHELL_VERSION`
   precisa subir toda vez que a superfície da ponte mudar** — sem isso a
   válvula não protege nada.
3. **Watchdog de boot.** Servir um bundle arma um `pending`; o lado web o
   desarma (`AVNative` → `otaConfirm`) no evento `load`, e **só se `AVDB`
   existir** — um erro de sintaxe em `db.js` deixaria a página "carregada"
   mas sem sistema. Um bundle que não confirme é descartado no lançamento
   seguinte e o app volta ao embutido no APK. Sem isso, um bundle quebrado
   inutilizaria o app até reinstalar.

Um APK novo com base web mais recente também descarta um OTA antigo
(comparação numérica por componente, não lexical: `4.9` < `4.82`... por isso
`compareVersions` compara `major.minor` como inteiros). A extração valida
**zip slip** (entradas com `..` que escapariam do diretório) e o download
confere o `sha256`; falta do `web/controle/index.html` reprova o bundle antes
de ativá-lo. O fallback é **por arquivo**: o que faltar no bundle baixado é
servido do APK.

---

## Divergências entre o caminho web e o nativo

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca
o inverso como caminho principal. O comportamento de navegador é o padrão; o
nativo é a exceção que se declara. Assim a base continua rodando nos dois
contextos.

| Ponto | Navegador | App nativo |
|---|---|---|
| Service workers (`sw.js`) | cache-first + auto-reload | **removidos** — assets já são locais; recarregar o WebView do telão no meio de um culto é justamente o que não pode acontecer |
| `#startBtn` "Ligar Sistema" | destrava autoplay de terceiros | **oculto** — `setMediaPlaybackRequiresUserGesture(false)`; uma TV não recebe toque |
| Recuperação de áudio bloqueado | retentativas de 5 s | **desativada** — sem política de gesto, qualquer detecção seria falso positivo |
| Pastas do dispositivo | `showDirectoryPicker()` | **SAF** — a File System Access API **não existe no Android**; este recurso era letra morta no celular e passa a funcionar |
| Compartilhamento | `share_target` + POST no SW | **`intent-filter` nativo** (`ShareIntake.kt`) |
| Estado do telão (rodapé de Exibição) | atalho `window.open('../display/')`, útil só para desenvolver | **indicador ao vivo** — a Presentation é criada sozinha |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de **espelhamento de tela** (ver abaixo) |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation API | idem, com trava de paisagem **nativa** (`onShowCustomView`) |
| Botões físicos de volume | o navegador não os recebe | **interceptados** e ligados ao fader do app (ver abaixo) |
| Microfone (`getUserMedia`) | o navegador pergunta | `MicChromeClient` + permissão `RECORD_AUDIO` (ver abaixo) |
| Botão voltar | — | manda a tarefa para segundo plano (sair por engano derrubaria a projeção) |
| Controles fora do app | — | **notificação + tela de bloqueio + botões de mídia** via `MediaSession` (ver seção acima) |
| Download com o app minimizado | a aba continua baixando | **foreground service + wake lock** — sem isso o processo é congelado (ver seção acima) |
| Atualização da base web | service worker (cache-first + reload) | **OTA** — bundle publicado em `web-latest`, aplicado no próximo lançamento (ver seção acima) |

### Microfone ao vivo (push-to-talk)

O operador segura um botão no Controle e a voz sai **na projeção**, ao vivo.

**A captura acontece no WebView do Display**, não no do Controle — e isso não é
detalhe de implementação: um `MediaStream` **não atravessa o
BroadcastChannel** (não é clonável), então mandar o áudio "pela ponte" não
existe como opção. O que atravessa é o comando `mic`; quem abre o microfone é
quem vai reproduzi-lo. No navegador, onde Display e Controle são páginas
separadas, essa também é a única escolha correta.

Do lado nativo, duas peças:

- **`MicChromeClient`** (usado pelo WebView da `StagePresentation`). Um WebView
  **nega `getUserMedia` em silêncio** se ninguém tratar `onPermissionRequest`:
  a promise é rejeitada e não há erro no console que explique. É o mesmo padrão
  do `onShowFileChooser` (invariante 6). Ele concede **só**
  `RESOURCE_AUDIO_CAPTURE` — qualquer outro recurso é negado, porque o sistema
  de projeção não tem uso para eles — e **só se o app já tiver `RECORD_AUDIO`**;
  conceder ao WebView uma permissão que o processo não tem apenas adiaria a
  falha para um ponto sem sinal claro.
- **`requestMicPermission`** (`AVNative.requestMic()`), pedido **sob demanda**,
  no primeiro toque no botão. Não na abertura do app: um pedido de gravar áudio
  sem contexto, no primeiro lançamento, é o tipo de coisa que se nega por
  reflexo — e aí o recurso fica quebrado sem motivo.

O caminho de áudio no Display é `getUserMedia → MediaStreamSource → GainNode →
destination`, com rampa de 0,12 s na entrada e na saída (cortar no meio de uma
palavra estala na caixa de som). `echoCancellation` fica **ligado**: num culto
um ganho realimentado é um estrago imediato e público, e vale mais que a
fidelidade extra de desligar o processamento. Ainda assim, se a saída de áudio
for o próprio celular e não a TV, o risco de microfonia continua — é do
formato, não do código. A latência do WebView (~0,1–0,3 s) é inerente.

O microfone fecha sozinho ao soltar o botão, ao **trocar de aba** e quando o
app vai para **segundo plano**: push-to-talk que sobrevive ao botão vira um
microfone esquecido ligado.

### Botões físicos de volume

O Android roteia os botões de volume para a **saída em uso** — e com
espelhamento ativo isso vira o volume da TV. O operador apertava o botão e o
fader do app não saía do lugar.

`MainActivity.onKeyDown` consome `KEYCODE_VOLUME_UP/DOWN` (e o `onKeyUp`
correspondente, senão o sistema ainda reage ao evento de soltura) e entrega o
passo ao Controle em `window.__avVolumeKey(±1)`, que o aplica em
`applyVolume()` — a mesma função do fader e do gesto de arrasto. Também
`volumeControlStream = AudioManager.STREAM_MUSIC`, para o caso de o sistema
chegar a tratar algum evento.

Duas salvaguardas:

- **Só intercepta depois que o lado web pede** (`AVNative.captureVolumeKeys
  (true)`, chamado no fim do carregamento do Controle). Se a Activity
  interceptasse desde o `onCreate`, uma falha no JS deixaria o aparelho sem
  **nenhum** controle de volume enquanto o app estivesse aberto.
- **Válvula de escape:** com o fader já no máximo (ou no zero), o lado web
  devolve o passo ao sistema (`AVNative.systemVolume`, que chama
  `adjustStreamVolume` com `FLAG_SHOW_UI`). Sem isso, um aparelho com o volume
  de mídia baixo ficaria sem como subir com o app aberto.

### Espelhamento de tela ≠ Google Cast

O botão de cast da preview precisa abrir o **espelhamento de tela** (Smart View
na Samsung, "Wireless display"/"Transmitir tela" no AOSP) — não o **Google
Cast**, que é outra coisa: o Cast manda uma URL para o dispositivo tocar
sozinho, o espelhamento manda a imagem da tela, que é o que serve aqui quando
não há `Presentation`.

A ação pública `Settings.ACTION_CAST_SETTINGS` **cai no Google Cast** em vários
aparelhos (foi o que aconteceu na Samsung testada), então ela é o último
recurso, não o primeiro. E não existe API pública para o *popup* das
configurações rápidas: `Settings.Panel` só cobre internet, wifi, nfc e volume.

`MainActivity.pickCastIntent()` percorre alvos conhecidos, do mais específico
ao mais genérico, e escolhe o primeiro que **existe neste aparelho e não
resolve para o Play Services** (`com.google.android.gms`) — é esse filtro, e
não só a ordem, que impede a cadeia de terminar no seletor de Cast enquanto
ainda há espelhamento a tentar:

1. **as activities exportadas do Smart View** — `com.samsung.android.
   smartmirroring` e `com.samsung.android.app.smartmirroring`
2. `com.samsung.wfd.LAUNCH_WFD_PICKER`
3. `android.settings.WIFI_DISPLAY_SETTINGS` (AOSP, ação legada — e a que **não**
   é reivindicada pelo Play Services, ao contrário de `CAST_SETTINGS`)

Para o Smart View o nome da activity **não é adivinhado**: `exportedActivities()`
pergunta ao `PackageManager` quais o pacote expõe (`GET_ACTIVITIES`) e enfileira
as exportadas. A primeira tentativa usava um nome chutado (`.CastDialog`) — um
palpite errado simplesmente não resolve, a cadeia cai no fallback e o botão abre
o Google Cast, que é o oposto do pedido. Perguntar ao sistema elimina o chute.

**Nada disso é API documentada.** Se um alvo não existir (ou não for
exportado), `resolveActivity` devolve null / `startActivity` lança, e a cadeia
segue sem quebrar nada. Por isso `resolveActivity` precisa enxergá-los: daí o
bloco `<queries>` no `AndroidManifest.xml` (visibilidade de pacotes do Android
11+) — sem ele tudo resolveria para null e a cadeia cairia direto no fallback.
E o fallback abre a tela de **Tela** antes da de **Cast**, justamente porque o
Google Cast é o que não se quer aqui.

Como isso é território de fabricante, `describeCastTarget()` devolve o rótulo
do alvo escolhido **com o componente real** (ex.: `Smart View
(com.samsung.android.smartmirroring/.CastDialog)`) e o **popup de Exibição
mostra "Espelhar abre: …"**. O operador vê o que o aparelho ofereceu antes de
tocar — e, quando o botão abre a tela errada, essa string é o que diz qual
candidato pegou, sem depender de logcat.

### Andaimes do modelo de dois PWAs, removidos

A base web nasceu como **dois PWAs instaláveis** que se comunicavam por
BroadcastChannel, porque o Miracast só espelha a tela inteira do celular. Com a
`Presentation` confirmada em aparelho real (o shell manda **só o Display** para
a TV), esse andaime não tem mais função e saiu do bundle:

- **`web/index.html`** — a página que oferecia "Abrir Controle / Abrir
  Display". O shell carrega `/web/controle/` e `/web/display/` direto.
- **`controle/manifest.json` e `display/manifest.json`** — instalação como
  WebAPK, `scope`, `orientation`, `share_target`. Nada disso existe num
  WebView: ícone, nome e orientação vêm do APK, e o share chega por
  `intent-filter`.
- **`controle/icons/` e `display/icons/`** (~96 KB) — só o manifest e os
  `<link rel="icon">` os usavam. Os ícones do app estão em `res/`.
- **"Abrir Display"** — virou indicador de estado (acima).

O que **fica**: a preview em tela cheia (a projeção quando não há TV
conectada, com os gestos invisíveis) e todas as guardas
`if (!window.__NATIVE__) { …web… }`. A base precisa continuar rodando no
navegador — é assim que se desenvolve e se testa fora do aparelho.

---

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android
SDK; nenhuma infraestrutura externa.

| Rota | Como | Observação |
|---|---|---|
| Artifact | Actions → run → *Artifacts* | vem como **.zip**; precisa descompactar no celular |
| **Release** ⭐ | `git tag v1.0 && git push --tags` | **link direto para o .apk**; instala pelo Chrome do celular |
| Release (sem push de tag) | Actions → *Build APK* → *Run workflow*, com `release_tag` | mesma coisa pelo disparo manual — a tag é criada pelo próprio workflow |

**A tag nasce em `main`** (`target_commitish: main`): sem isso ela seguia o SHA
que o runner tivesse em mãos e acabava apontando para o commit da branch de
trabalho. O input **`retag`** (desligado por padrão) apaga a Release e a tag
antes de recriá-las — é o único jeito de MOVER uma tag já publicada, já que o
`action-gh-release` não move tag existente. Fica atrás de um input próprio de
propósito: mover tag é destrutivo e não pode ser efeito colateral de uma
publicação comum.

**Assinatura.** As Releases saem **assinadas com keystore fixa**, guardada nos
secrets do repositório (`KEYSTORE_B64` — o `.jks` em base64 —, `KEY_ALIAS` e
`KEY_PASSWORD`). É isso que permite **atualizar por cima sem desinstalar**, e
por consequência **sem perder a biblioteca do app**: o Cronograma, as pastas
sincronizadas, os hinos do LouvorJA e a Bíblia baixada vivem em IndexedDB/OPFS,
que o Android apaga junto com o app numa desinstalação.

- O `.jks` **nunca é versionado** (`.gitignore`); o build o materializa a
  partir do secret e o descarta com o runner.
- Sem os secrets (build local, PR de terceiro, clone), o `build.gradle.kts` cai
  na assinatura de **debug** e tudo continua compilando — só não serve para
  atualizar por cima. Se uma Release for pedida nesse estado, o workflow
  **falha de propósito** em vez de publicar um APK que o Android recusaria.
- `versionCode` vem do número da execução do CI (sempre crescente) e
  `versionName` da tag — o Android recusa instalar sobre um `versionCode` igual
  ou maior, então isso não pode ser manual.
- Perder a keystore é irreversível: sem ela, toda atualização futura volta a
  exigir desinstalação. Guarde com backup.

Rodar local: `./gradlew assembleDebug` (exige Android SDK instalado).

---

## Regras de desenvolvimento

- **SEMPRE fazer merge com `main` ao terminar qualquer alteração.** Trabalhar
  na branch designada é o meio, não o fim: um commit que fica só na branch não
  chega a lugar nenhum — o OTA publica a partir de `main` (o job `web-ota` tem
  `if: github.ref == 'refs/heads/main'`) e as Releases nascem de `main`. O
  fluxo é sempre o mesmo, e a última linha não é opcional:

  ```bash
  git add <arquivos>
  git commit -m "vX.YZ: <descrição>"
  git push -u origin <branch>
  git checkout main
  git merge <branch> --no-ff -m "Merge: <resumo>"
  git push origin main          # ← sem isto, nada chega aos aparelhos
  ```

  As tags de Release apontam para `main` por construção
  (`target_commitish: main` no `apk.yml`) — não confie no SHA que o runner
  tiver em mãos.
- **Nunca perder funcionalidades existentes ao refatorar.** A base web tem
  todo o sistema de culto (coleções LouvorJA, letra sincronizada, Bíblia,
  Camada de Texto, playlist, fades) — ver `docs/ARQUITETURA-WEB.md`.
- **Todo código novo em `assets/web/` precisa continuar rodando no navegador.**
  Caminhos nativos entram sempre como `if (!window.__NATIVE__) { …web… }`.
- Não introduzir dependências externas — Kotlin puro + AndroidX oficial no
  shell; JavaScript puro no web. (Exceção já existente: a IFrame Player API do
  YouTube, carregada em runtime.)
- Toda operação IDB multi-passo que precise de atomicidade usa `storeTx()`.
- Ao mudar a superfície da ponte, subir `NativeBridge.SHELL_VERSION` **e**
  atualizar a seção "A ponte" acima.
- Ao atualizar o código, atualizar este `CLAUDE.md` se a mudança afetar
  arquitetura, protocolo de comandos ou a ponte. Mudanças dentro de
  `assets/web/` que afetem a arquitetura web vão em `docs/ARQUITETURA-WEB.md`.
- **A cada atualização, incrementar a versão visual do Controle**
  (`#appVersion` em `assets/web/controle/index.html`) **e `version` em
  `assets/web/version.json`** — é este último que faz a atualização chegar
  aos aparelhos por OTA. O `versionCode`/`versionName` do APK vêm do CI.
  **Versão atual: v5.18** (base web) · **shell 1.19** (`SHELL_VERSION` 13).
