# Claude Code — APP Áudio Visual IASD (Android nativo)

App Android nativo do sistema de projeção de mídia para culto (IASD). É uma
**casca em Kotlin** que hospeda a base web do projeto em dois WebViews e usa
`android.app.Presentation` para mandar **só o Display** para a TV — sem
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
7. [Notificação de controles (sessão de mídia)](#notificação-de-controles-sessão-de-mídia)
8. [OTA da base web (atualização sem APK)](#ota-da-base-web-atualização-sem-apk)
9. [A paleta](#a-paleta)
10. [Divergências entre o caminho web e o nativo](#divergências-entre-o-caminho-web-e-o-nativo)
11. [Build e distribuição](#build-e-distribuição)
12. [Regras de desenvolvimento](#regras-de-desenvolvimento)

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
protocolo de comandos seguem praticamente inalterados.

**Sem TV conectada o app continua útil:** nenhuma Presentation é criada e a
projeção volta a ser a preview do Controle em tela cheia (o mesmo fallback do
PWA, incluindo os gestos invisíveis).

---

## Estrutura do repositório

```
app/src/main/
├── AndroidManifest.xml          # intent-filter de share, portrait, <queries>, regras de backup
├── assets/web/                  # ← a base web (cópia própria, versionada aqui)
│   ├── version.json             #   identidade do bundle (version + minShell)
│   ├── shared/tokens.css        #   PALETA — fonte única, carregada pelos dois apps
│   ├── shared/native.js         #   ponte AVNative + watchdog do OTA (NÃO existe no PWA)
│   ├── shared/mse.js            #   player DASH mínimo: transmissão direta sem baixar
│   ├── shared/db.js             #   + relay nativo no canal de comandos
│   ├── shared/stage.js          #   motor de mídia (compartilhado Controle/Display)
│   ├── vendor/                  #   ÚNICO código de terceiro do lado web:
│   │                            #   o renderizador de .pptx (ver o LEIA-ME de lá)
│   ├── controle/                #   (sem sw.js / manifest / icons — ver abaixo)
│   └── display/                 #   (idem)
├── java/br/org/iasd/av/
│   ├── MainActivity.kt          # Activity + WebView do Controle + Presentation + voltar/volume/cast
│   ├── StagePresentation.kt     # Presentation + WebView do Display (o telão)
│   ├── WebViewFactory.kt        # asset loader + settings comuns (invariantes 1-4)
│   ├── NativeBridge.kt          # @JavascriptInterface — a ponte
│   ├── SafPathHandler.kt        # serve arquivos do dispositivo em /saf/<token>
│   ├── ShareIntake.kt           # intent ACTION_SEND → formato do share web
│   ├── SyncService.kt           # foreground service: downloads com o app minimizado
│   ├── SessionService.kt        # MediaSession + notificação com os controles de transporte
│   ├── WebUpdater.kt            # OTA da base web (watchdog, minShell, sha256)
│   ├── WebPathHandler.kt        # serve o bundle OTA, com fallback pro APK
│   ├── YoutubeGrab.kt           # extrai e baixa o vídeo do YouTube NO APARELHO
│   ├── MuxMp4.kt                # junta as faixas de vídeo e áudio (1080p) — MediaMuxer
│   ├── StreamProxy.kt           # /stream/<token>: serve o googlevideo pelo NOSSO origin
│   ├── SlideDeck.kt             # apresentação (PDF/Google) → uma imagem por página
│   ├── MicChromeClient.kt       # onPermissionRequest: microfone no WebView do telão
│   └── MessageBus.kt            # relay de comandos entre os dois WebViews
└── res/
    ├── drawable/                # ic_image{,_off} — a cortina, na notificação
    │                            #  + ic_launcher_{foreground,mono} — o ÍCONE, em vetor
    ├── mipmap-anydpi-v26/       # ic_launcher{,_round}: o adaptativo (o único, minSdk 26)
    ├── values/colors.xml        # app_bg e ic_launcher_background: ESPELHAM tokens da base web
    ├── values/themes.xml        # tema sem action bar; tema preto da Presentation
    └── xml/                     # backup_rules + data_extraction_rules (ver "Build")
docs/
├── ARQUITETURA-WEB.md           # arquitetura completa da base web
└── FONTE-DE-DADOS-LOUVORJA.md   # referência do banco LouvorJA (hinos/Bíblia)
```

**Dezesseis arquivos Kotlin, uma dependência de terceiros no shell** — o resto é
AndroidX oficial (`core-ktx`, `activity-ktx`, `webkit`). Medido agora (`wc -l`):
**5.959 linhas de Kotlin** contra **16.648 linhas de JavaScript** em
`assets/web/` (sem contar `vendor/`, que é código buildado de terceiro) — a
proporção é o argumento, não o número absoluto. Manter o nativo pequeno respeita
a filosofia do projeto muito melhor que Capacitor/Cordova, que arrastariam npm e
um build system inteiro e ainda assim exigiriam código nativo próprio para a
Presentation.

> Esses números envelhecem a cada commit. Meça antes de citá-los:
> ```bash
> wc -l app/src/main/java/br/org/iasd/av/*.kt
> find app/src/main/assets/web -name '*.js' -not -path '*/vendor/*' | xargs wc -l
> ```

---

## Invariantes do shell (não quebrar)

São o que sustenta a base web. Cada uma mora num lugar diferente, e é preciso
saber qual para conferi-las:

**Em `WebViewFactory.kt`** (o KDoc do arquivo lista estas quatro):

1. **Servir por `https://appassets.androidplatform.net/`, JAMAIS por
   `file://`.** O contexto seguro é o que faz OPFS e IndexedDB funcionarem.
   Não é opcional.
2. **Um único origin para os dois WebViews.** É o que preserva IDB/OPFS/
   BroadcastChannel compartilhados. Origens distintas destroem a arquitetura.
   O origin é comparado por **componente do `Uri`** (`url.host == ORIGIN_HOST`),
   nunca por prefixo de string: `appassets.androidplatform.net.evil.com` começa
   com o origin, é um domínio que qualquer um registra, e um `startsWith`
   autorizaria a navegação — dentro de um WebView que injeta `__AVBridge` em
   toda página que carregar (`addJavascriptInterface` é por-WebView, não
   por-origem). Este ponto não pode falhar ABERTO.
3. **Um único processo/perfil de WebView.** Nada de processo isolado para o
   Display.
4. `mediaPlaybackRequiresUserGesture = false`, `domStorageEnabled`,
   `javaScriptEnabled` — mais `allowFileAccess`/`allowContentAccess`
   **desligados**: tudo entra pelo asset loader.

**Regra de projeto, não de código:**

5. **Não reimplementar em Kotlin nada que já exista em JS.** Transporte,
   playlist, letra sincronizada, Bíblia, Camada de Texto e fades permanecem no
   web. É de longe a maior parte do sistema (ver a contagem acima).

**Em `MainActivity.ControleChromeClient`** — e é justamente por estarem aqui,
e não na factory, que um segundo `WebChromeClient` criado sem elas as perde em
silêncio:

6. **`onShowFileChooser`.** Um WebView **ignora `<input type="file">` por
   completo** sem esse override: o toque não faz nada, sem erro nenhum no
   console. No navegador o seletor é da plataforma; aqui é o app que precisa
   abri-lo. Dele dependem a importação para o Cronograma e a escolha do
   wallpaper.
7. **`onShowCustomView`/`onHideCustomView`.** Sem eles, `requestFullscreen()`
   falha silenciosamente — e a preview em tela cheia é a projeção quando não
   há TV conectada. É aqui que mora a trava de paisagem nativa.

**No `shouldInterceptRequest` (`WebViewFactory.create`)** — a que custou três
rodadas de APK para ser aprendida:

8. **O `InputStream` que você devolve é o RECURSO INTEIRO a partir do byte 0.**
   Não é "a resposta": quem aplica o `Range` da requisição é o **próprio
   WebView**, sobre o que o app entregou
   (`AndroidStreamReaderURLLoader::Start` → `ParseRange` → `InputStreamReader::
   Seek` → `ComputeBounds` contra `available()`), incondicionalmente e para toda
   resposta interceptada. Devolver só a fatia pedida aplica o deslocamento DUAS
   vezes — e a requisição que começa no byte 0 é a única em que isso é um no-op,
   então ela passa e esconde o defeito atrás de si. **Corolário: um erro com
   corpo VAZIO não chega** quando a requisição tem faixa fora do zero
   (`ComputeBounds` reprova com `size == 0`), o que apaga a mensagem inteira e
   deixa só um erro de rede sem status. Ver `StreamProxy.kt` e
   `tools/webview-range.test.mjs`, que trava a regra no CI.

**No `AndroidManifest.xml`:** `android:hardwareAccelerated="true"` e
`android:largeHeap="true"` — os dois WebViews, um vídeo grande e o player do
YouTube dividem o mesmo processo.

> O WebView do telão usa outro `WebChromeClient` (`MicChromeClient`, para o
> microfone), **não recebe** o handler `/saf/` e é a única instância criada com
> `keepVisible = true` — ver "Microfone ao vivo" e "A ponte".

**`KeepVisibleWebView` (só o telão).** O Chromium marca a página como `hidden`
quando a janela da View some, e é isso que acontece com a `Presentation` no
instante em que o app é minimizado. Um `<video>` local não liga; o **embed do
YouTube pausa sozinho** ao ver `document.hidden`. `onWindowVisibilityChanged`
reporta sempre `VISIBLE` para tirar esse gatilho. **Não bastou** para o YouTube
(a solução real é baixar o vídeo — ver a tabela de divergências), mas fica: o
telão é a projeção, ele continua no ar com o app minimizado de propósito, e não
há razão para o renderer dele ser desacelerado. O WebView do **Controle** segue
o ciclo normal — ali ser estrangulado em segundo plano é o comportamento certo,
e é justamente o que o `snoopDisplayStatus` existe para contornar.

**Reconexão vem de graça:** quando o dongle cai e volta, o Android destrói e
recria a Presentation, o WebView recarrega `/display/` e dispara
`display-ready` — e o Controle reenvia a cena ao receber isso
(`resendSceneToDisplay` em `controle.js`). Não invente um mecanismo paralelo.

A **cena** é mais do que "mídia tocando":

- Reenvia **toda mídia carregada**, não só a que está tocando. A condição
  anterior (`playing || isImage`) deixava de fora justamente o caso mais comum
  de uma queda de dongle: o louvor de fundo PAUSADO para a oração. Um vídeo
  pausado mostra o quadro congelado no telão e um áudio pausado mantém a letra
  em cena — nos dois casos há algo projetado, e nos dois casos ele sumia.
- O `load` leva **posição e estado de reprodução** (ver a seção do barramento).
- Reenvia também o `text` do sorteio, do cronômetro, do versículo ou da
  mensagem que estiverem projetados — nessa ordem, já que no Display um `load`
  visual encerra a Camada de Texto e um `load` de áudio a mantém. Cronômetro e
  sorteio voltam pelo **descritor** (`startAt`), não por um valor: o telão
  recalcula o número a partir do mesmo instante de origem e reaparece no segundo
  certo, não no ponto em que a conexão caiu.

**Morte do renderer também é recuperável:** `WebViewFactory.create` recebe um
callback `onRendererGone` e o `WebViewClient` devolve `true` em
`onRenderProcessGone`. Sem isso o padrão do framework é matar o processo — um
OOM do renderer derrubaria o Controle e a projeção juntos. Cada dono
(`MainActivity`, `StagePresentation`) remonta o próprio WebView, e o telão
recarregado dispara `display-ready`, caindo no mesmo caminho de reconexão
acima.

O que morre com o renderer **não se limita à página**: os `fetch` em voo morrem
junto e o `finally` de `withBgWork()` nunca roda, então ninguém mais chamaria
`keepAlive(false)`. `buildControleWebView` zera o estado de trabalho em segundo
plano ao remontar — senão sobravam para sempre o foreground service, a
notificação congelada no último progresso e um wake lock de 2 h, e a guarda de
`setBackgroundWork` transformava o próximo download real em no-op.

---

## A ponte `window.AVNative`

Definida em `shared/native.js` (lado web) sobre `__AVBridge` (lado Kotlin,
`NativeBridge.kt`). **Só existe quando `window.__AVBridge` existe** — no
navegador a IIFE retorna logo na entrada e nada é definido, nem `__NATIVE__`.

```js
window.AVNative = {
  pickFolder(),        // → { id, name, uri }   (SAF ACTION_OPEN_DOCUMENT_TREE)
  pickDoc(mimes),      // → [{ url, name, type }]: o SELETOR DE ARQUIVOS do aparelho
  listFolder(uri),     // → [{ name, size, mtime, type, url }]   (só no Controle)
  onShare(cb),         // cb({ files:[{name,type,size,url}], url, title })
  displays(),          // → [{ id, name, w, h, density }]
  onDisplayChange(cb),
  openCast(),          // seletor de ESPELHAMENTO DE TELA do Android (≠ Google Cast)
  castTarget(),        // → string: rótulo do alvo de espelhamento deste aparelho
  openExternal(url),   // abre uma URL https FORA do app (só o Controle)
  ytFetch(url, onProg, soAudio, altura), // → { url, name, size, type, height, seconds }
                       //   `soAudio` traz só a faixa de áudio (m4a) — exige shell 23
                       //   `altura` é o TETO de resolução — exige shell 25 abaixo de 1080
  ytDiscard(url),      //   e apaga o arquivo depois que os bytes foram copiados
  ytCancel(url),       // PARA o download em curso deste link — exige shell 28
  otaPending(),        // → versão da base web já baixada que espera (ou '')
  otaApply(),          // APLICA-a agora: as duas páginas recarregam — shell 29
  ytDiag(),            // → string: o que o extrator recebeu na última extração
                       //   (diagnóstico do rodapé de Configurações)
  keepAudioAlive(bool),// mesa de som ligada: este WebView não pode ser suspenso
  ytStream(url, altura), // → manifesto DASH { video, audio, seconds, height } ou null
                       //   TRANSMITIR sem baixar — exige shell 26
  ytSearch(termo),     // → [{ id, url, name, author, seconds, thumb }] do YouTube
  deckPages(origem, nome, onProg), // → { name, pages:[url] } ou { erro }: PDF em imagens
  deckExportUrl(link), // → URL de exportação PDF de um link do Google Apresentações
  deckDiscard(url),    //   e apaga as páginas depois da cópia
  captureVolumeKeys(bool), // botões físicos de volume vão para o app
  systemVolume(step),  // devolve um passo ao volume do sistema (fader no limite)
  requestMic(),        // → bool: permissão RECORD_AUDIO (push-to-talk)
  keepAlive(bool),     // download em curso — ver "Trabalho em segundo plano"
  bgProgress({label, done, total, etaMs, items, idleMs, bytes}), // progresso na notificação
  nowPlaying({active, title, subtitle, playing, slideMode, slideLabel, wallpaper, positionMs, durationMs}),
  onRemote(cb),        // cb('play'|'pause'|'playpause'|'prev'|'next'|'stop'|'view')
}
```

São **vinte e oito métodos**, e essa é a superfície inteira que o resto do lado web
tem direito de usar: fora do `native.js`, tocar em `__AVBridge` direto é
acoplamento indevido. O próprio `native.js` chama mais sete coisas no
`__AVBridge`, e nenhuma delas é API para o app — a sexta e a sétima são
`ytFetchAudio` e `ytFetchAte`, que não são métodos a mais da ponte web e sim os
outros dois DESTINOS do `ytFetch`: um quando se pede só o áudio, outro quando se
pede um teto de resolução menor que o padrão (ver "Divergências") — `shellVersion()`, `role()` e
`appVersion()` viram as globais logo abaixo, `busPost()` é o relay do barramento
e `otaConfirm()` é o watchdog do OTA.

Além disso, `native.js` publica **quatro globais** lidas direto (sem Promise):
`window.__NATIVE__`, `__AV_ROLE__` (`'controle'`/`'display'`),
`__SHELL_VERSION__` (o inteiro do contrato, ver abaixo) e **`__SHELL_NAME__`** —
o `versionName` do APK, que é o **índice de versão do shell exibido ao
operador**. Ele não se confunde com `__SHELL_VERSION__`: base web e shell
atualizam por caminhos independentes (OTA × instalar APK), então o rodapé de
**Configurações** mostra os dois (`Web v5.98 · Shell v<versionName do APK>`,
montado em `renderVersionLabel`; até a v5.48 ficava no cabeçalho do Cronograma —
saiu de lá porque metadado de diagnóstico pertence à mesma tela do estado do
telão, não a uma faixa de navegação). Num shell antigo (sem
`appVersion()`) a string vem vazia e a UI cai em só a versão web — mesma
degradação do navegador.

**Princípio: a ponte entrega URLs SERVÍVEIS, não bytes.** Arquivos do
dispositivo e compartilhamentos chegam como
`https://appassets.androidplatform.net/saf/<token>` e o lado web usa `fetch()`
+ `Blob` exatamente como já faz com o OPFS — nenhuma função de importação
precisou ser reescrita, e **um vídeo de 2 GB nunca passa por base64**.

Sobre o token (`SafRegistry`, em `SafPathHandler.kt`):

- Ele é **opaco**, e não o URI codificado, porque o `PathHandler` recebe o
  caminho já decodificado: um `content://` com barras viraria segmentos de rota
  e quebraria o roteamento.
- É **aleatório** (128 bits em base64url, `SecureRandom`), e não um contador.
  Um contador é adivinhável por construção, e as entradas **nunca expiram** —
  não custa nada deixar `/saf/1..N` fora do alcance de quem enumerar.
- **`/saf/<token>` é uma URL `https://`** — `https://appassets.androidplatform.
  net/saf/<token>`, o mesmo origin da base web. Parece óbvio escrito assim, e
  não é: quem recebe uma dessas de parâmetro e pergunta
  `origem.startsWith("https://")` para decidir "é da rede ou é local?" acerta a
  pergunta errada e manda **todo arquivo do aparelho** para o caminho de
  download. Foi exatamente isso que deixou o PDF sem funcionar da v5.97 à
  v5.99 — falha silenciosa, indistinguível de "PDF com senha". A pergunta certa
  é pelo **host** (`u.host == ORIGIN_HOST`), como manda a invariante 2.
- O mesmo URI devolve **sempre o mesmo token**. Sem esse reaproveitamento, cada
  `listFolder` de uma pasta de 500 arquivos acrescentava 500 entradas novas para
  os MESMOS arquivos, a cada re-sincronização, num processo mantido vivo de
  propósito durante todo o culto.

**Superfície nativa é privilégio do Controle.** O WebView do telão recebe a
ponte com `host = null` justamente para não ter poderes de Activity, e o loader
dele é montado **sem** o handler `/saf/`. `listFolder` honra a mesma regra e
devolve lista vazia sem host: era a exceção, porque lê o `ContentResolver`
direto, e sem a guarda qualquer script rodando no documento do Display (que
carrega a IFrame Player API de terceiro **por design**) lia o índice inteiro —
nome, tamanho e token servível — de toda pasta que o operador já concedeu. Os
dois consumidores de arquivo do dispositivo (`importShare` e `syncDeviceFolder`)
rodam no Controle e copiam os bytes para o OPFS antes de qualquer coisa chegar
ao telão; o Display nunca busca um `/saf/`.

**As Promises têm época por carregamento.** O id de chamada é
`EPOCH + ':' + seq`, com `EPOCH` aleatório a cada carga da página. O renderer
pode morrer com uma chamada em voo: a página recarrega, o contador volta a zero,
mas o `resolve` do Kotlin aponta para o WebView ATUAL — com ids "1", "2", "3" a
resposta atrasada de um `listFolder` da página velha resolvia a promise homônima
da página NOVA. As chamadas que dependem de **máquina** têm prazo de 60 s (rede
de segurança contra promise pendente para sempre); `pickFolder` e `requestMic`
esperam uma **pessoa** e ficam sem prazo, porque um timeout ali resolveria null
com o operador ainda escolhendo a pasta.

`NativeBridge.SHELL_VERSION` identifica a versão da casca — **subir sempre que
a superfície da ponte mudar**. Hoje vale **29** — a v5.132 acrescentou
`otaPending`/`otaApply` (o aviso de atualização e o "aplicar agora"). A v5.131 acrescentou
`ytCancel` (parar o download em curso). Ele é o único método da ponte que **não
vai para a fila de IO**, e não poderia: a fila é de uma thread só e está ocupada
justamente pelo download que se quer parar. Ele escreve um campo `@Volatile` e
volta; quem responde é o laço de cópia do `YoutubeGrab`, que o consulta a cada
bloco de 64 kB. A v5.127 não acrescentou
método nenhum, mas mudou o **contrato das URLs que o `ytStream` devolve**: a
faixa de bytes passou a viajar na QUERY (`/stream/<token>?r=<ini>-<fim>`) e o
cabeçalho `Range` sumiu do caminho nativo, porque dentro de um WebView ele é
fatal (invariante 8). Contrato mudado é superfície mudada, e sem o bump o lado
web não teria como perguntar por onde a faixa deve ir. A v5.120 acrescentou `ytStream`
(o manifesto da transmissão direta), a v5.118 acrescentou
`ytFetchAte` (teto de resolução escolhido pelo operador) e o campo `bytes` do
`bgProgress` (que sozinho não exigiria bump, porque só acrescenta um campo a um
JSON, mas o lado Kotlin passou a formatá-lo e a web precisa saber se ele o
entende), a v5.115 acrescentou `ytDiag`
(diagnóstico da extração do YouTube), a v5.112 acrescentou
`ytFetchAudio` (só a faixa de áudio de um vídeo do YouTube), a v5.100 fez `deckPages`
devolver o MOTIVO da falha (`{ erro }`) em vez de `null`, a v5.99 mudou a ASSINATURA do
`pickDoc` (que passou a receber os mimes e a devolver uma LISTA, porque virou a
importação inteira do app e não só o seletor de PDF), a v5.98 o acrescentou, a
v5.97 os três métodos da
APRESENTAÇÃO (`deckPages`/`deckExportUrl`/`deckDiscard`), a v5.85 acrescentou
`ytSearch`, a v5.83 `keepAudioAlive`, a v5.81 `ytFetch`/`ytDiscard` e a v5.76
`openExternal`. (A v5.48 não a mexeu: nenhum método foi acrescentado ou teve
assinatura alterada, e as mudanças do lote foram restrições de quem pode chamar
o quê, que nunca exigem shell mais novo.)

**Um método novo NÃO chega por OTA.** O bundle segue com `minShell: 2` de
propósito — subi-lo recusaria a atualização inteira em todo aparelho com shell
antigo, que é muito pior do que um recurso a menos. Quem depende de um método
novo pergunta antes: `appendYoutubeSearch` não desenha o botão quando
`__SHELL_VERSION__ < 15`, porque um botão que não faz nada no meio de um culto é
pior que botão nenhum. Ele aparece sozinho depois que o APK novo for instalado.

---

## Barramento de comandos e o plano B do BroadcastChannel

`BroadcastChannel` entre dois WebViews same-origin no mesmo processo **deve**
funcionar — mas o isolamento de sites do WebView pode surpreender, e uma falha
aí derrubaria o comando do telão no meio de um culto.

Em vez de detectar a falha (handshake com janela de corrida), o **relay nativo
roda SEMPRE em paralelo**: cada comando sai pelos dois caminhos
(`BroadcastChannel` + `MessageBus` nativo) e a cópia repetida é descartada em
`shared/db.js` pelo campo `__mid`. O resto do sistema não sabe de nada —
`sendCommand`/`onCommand` mantêm exatamente a mesma assinatura. O custo é
desprezível: os comandos são objetos JSON pequenos.

### O `load` carrega o ponto e o estado da mídia

O comando `load` leva, além de `mediaId`/`view`/`muted`/`volume`, dois campos
que existem **para a reconexão do telão**:

| campo | significado |
|---|---|
| `time` | segundo em que a mídia deve entrar (0 = do começo) |
| `playing` | `false` = a cena voltou PAUSADA; ausente/`true` = toca, como sempre |

Até a v5.47 a reconexão mandava só o `load`, então a mídia recomeçava do ZERO e
no estado "tocando": um hino aos 3:20 voltava do início na frente da
congregação, e um louvor pausado para a oração voltava tocando. Pior, o
`display-status` seguinte chegava com `currentTime` 0 e arrastava a preview do
Controle junto — o operador perdia até a referência de onde estava.

**Por que os campos viajam no próprio `load`, e não como um `seek`/`pause`
enviado logo depois:** o `onCommand` do Display **não serializa**. O `load` é
assíncrono (`getMedia` → `opfsGetFile` → `mediaReady`, mais o fade de saída), e
um comando que chegasse em seguida agiria sobre o `<video>` **anterior**, antes
de a fonte nova entrar — o seek seria aplicado à mídia errada e depois perdido.
Levá-los no mesmo comando é o que garante que a decisão chegue junto com a
mídia a que ela pertence.

Do lado do Display os dois caminhos honram os campos:

- `stage.js` → `load(id, v, m, vol, startAt, autoplay)`. A posição só "gruda"
  depois que a duração é conhecida — escrever `currentTime` junto com o `src` é
  perdido em silêncio —, então o `startAt` entra num `loadedmetadata` com
  `{ once: true }`, protegido pelo `loadSeq` (outro load pode ter assumido
  durante a espera). `autoplay === false` é a cena que voltou pausada;
  `undefined` mantém o comportamento de sempre, e por isso nenhum outro chamador
  precisou mudar.
- `display.js` → `loadYoutube(rec, v, m, vol, startAt, autoplay)`, que passa o
  `startAt` como `playerVars.start` (segundos inteiros — é o que a API aceita).

O comando mais frequente do barramento é o `display-status`, emitido pelo telão
a cada `timeupdate` do vídeo (além de `play`, `pause`, `loadedmetadata`,
`ended` e `volumechange`). Ele é a fonte de sincronização enquanto existir — ver
`snoopDisplayStatus`, na seção da sessão de mídia.

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

Pontos cobertos: `syncGroup` (o lote de coleções), `syncCollection` (massa),
`ensureSongDownloaded` (avulso), `syncLyrics`, `ensureBibleVersionDownloaded`
(1189 capítulos) e `syncDeviceFolder` (pastas — o único que chama
`bgWorkBegin`/`bgWorkEnd` direto, em vez de passar por `withBgWork`; o `finally`
dele já existia para outra coisa). O wake lock tem timeout de 2 h, para um
download travado nunca consumir bateria indefinidamente. No navegador tudo isso
é no-op.

### O download RETOMA de onde parou (v1.58)

Enquanto o app estiver vivo — na frente ou em segundo plano —, um download só
deve terminar de duas formas: concluído, ou cancelado pelo operador. Faltava a
parte da rede.

Até aqui, uma oscilação de 20 segundos no meio de um louvor de 380 MB derrubava
o download inteiro: a tentativa seguinte recomeçava do **byte zero** (com outro
perfil de UA), e esgotados os três perfis ele falhava. Numa rede de igreja isso
é indistinguível de "o app não baixa".

Agora `YoutubeGrab.baixar` é um laço de retomada:

- **`Range: bytes=<o que já está no disco>-`**, e o arquivo é aberto em modo
  APÊNDICE. Uma queda custa os segundos da reconexão, não o download.
- **Oito tentativas com espera crescente** (1 s → 30 s, ~2 min de tolerância).
  A espera acorda a cada 250 ms para ver se o operador cancelou — um cancelar
  que só fosse notado 30 s depois não seria um cancelar.
- **4xx não é retentado** (`RecusaDoCdn`): a URL expirou ou a faixa foi negada,
  e insistir nela é perder tempo — quem tem outras cartas é a fila de
  candidatos de quem chamou.
- **O servidor que ignora a faixa** (responde 200 em vez de 206 a um pedido com
  `Range`) faz o arquivo recomeçar do zero em vez de acrescentar: continuar
  daria um arquivo com o começo repetido no meio — corrupção que só apareceria
  na hora de tocar.

### E o download SOBREVIVE À MORTE DA PÁGINA (v1.59)

O download roda no shell; quem o espera é um `fetch` da PÁGINA. Quando o
renderer morre — dois WebViews, um vídeo grande e o player do YouTube dividem o
mesmo processo, e o OOM é evento conhecido —, o arquivo terminava de baixar e
não sobrava ninguém para recebê-lo. Dez minutos viravam nada, sem explicação.

A recuperação é uma dobradiça de duas metades, e nenhuma funciona sozinha:

- **O shell guarda o desfecho** (`YoutubeGrab.resgatar`) num slot único — a fila
  de IO é de uma thread só, então há no máximo um download por vez, a mesma
  premissa do cancelamento. Ele é conferido por link **e pela forma** (só áudio,
  teto): devolver o m4a para quem pediu o vídeo seria pior que não guardar nada.
  Quem o descarta é o `descartar()`, o mesmo ponto em que os bytes já foram
  copiados para a biblioteca.
- **A página registra a INTENÇÃO** antes do primeiro byte, no `state` do banco
  (o único lugar que sobrevive à morte dela), e a apaga no `finally`. Uma
  intenção que sobrevive a um lançamento é, por definição, um download que
  ninguém recebeu.

Reclamar é **pedir o mesmo download outra vez**: o shell devolve o resultado
guardado na hora, sem rede. Se o processo inteiro tiver morrido (e com ele o
slot), o pedido vira um download normal — que agora retoma do parcial em disco,
se ele for da mesma faixa. O destino original é honrado: quem pediu "para o
Cronograma" recebe no Cronograma.

Intenção com mais de 6 h é descartada: as URLs do YouTube expiram, e reviver na
manhã de domingo o download de anteontem é gastar rede por algo que ninguém
está esperando.

**A retomada só vale para a MESMA faixa**, e isso é uma trava, não um detalhe: o
arquivo de destino é nomeado por vídeo + contêiner, então dois itags do mesmo
contêiner (137 e 136, ambos mp4) escrevem no mesmo caminho. Sem a conferência
(`parciais`, um mapa em memória de caminho → URL), um parcial do 137 deixado por
um app morto seria "retomado" por um download do 136 — e o arquivo teria dois
vídeos emendados, sem erro nenhum, aparecendo só na hora de projetar. O mapa
morre com o processo de propósito: retomar entre execuções exigiria gravar qual
faixa era, e o ganho não paga o risco de errar essa conta.

### O ciclo de vida do serviço tem duas armadilhas, e as duas matam o app

- **`startForeground` SEMPRE, antes de qualquer decisão de parar.** Um serviço
  iniciado por `startForegroundService` que morre sem ter chamado
  `startForeground` faz o sistema derrubar o app inteiro ("did not then call
  Service.startForeground()") — e o processo é o dos dois WebViews e da
  `Presentation` na TV. Publicar primeiro custa uma notificação de alguns
  milissegundos; a alternativa custa o culto. Só depois disso o
  `onStartCommand` verifica se o download já acabou enquanto o serviço subia
  (um item já baixado liga e desliga a proteção em poucos ms) e se despede
  sozinho com `stopSelf(startId)`.
- **A notificação segue o serviço, e não o contrário.** `updateProgress` usa
  `NotificationManager.notify`, que é independente do ciclo de vida de um
  `Service`: sem a guarda de `running`, um cartão "Baixando mídias" com
  `setOngoing(true)` ficava na gaveta para sempre, sem download nenhum por
  trás. O `onDestroy` zera a flag antes de tudo e cancela o cartão
  explicitamente.
- **Cota de FGS do Android 15** (`onTimeout`): com `targetSdk` 35 um serviço
  `dataSync` tem teto de 6 h acumuladas em 24 h, e o acumulado não é
  hipotético — configurar um aparelho novo soma hinário completo, uma versão da
  Bíblia e a cópia de pastas de vídeo. Atingido o teto, o sistema dá poucos
  segundos para parar, ou derruba o processo por ANR. Parar é a única resposta
  possível, mas o lado Kotlin precisa **esquecer** que estava protegendo
  (`SyncService.onGone` → `backgroundWork = false`): senão o
  `if (on == backgroundWork)` da Activity trata o próximo `keepAlive(true)` como
  repetido e o download seguinte fica sem proteção nenhuma, calado.

### A notificação mostra o progresso real

Com o app minimizado ela é a ÚNICA janela para o download, e era um texto fixo
("Baixando mídias") — não dizia quanto falta nem se ainda anda. Quem sabe o
progresso é o lado web, então é ele que reporta, por
`AVNative.bgProgress({label, done, total, etaMs, items, idleMs, bytes})`:
`bgTaskStart`/`bgTaskStep` em `controle.js` alimentam
`SyncService.updateProgress`, que refaz a notificação com barra, "N de M",
percentual e o tempo restante.

- **A unidade pode ser BYTES, e não itens** (`bytes`, v5.118). O registro nasceu
  contando itens — 54 músicas, 1189 capítulos —, e para um lote é a unidade
  certa. Mas o download de UM vídeo do YouTube abria a tarefa com `total = 1`, e
  aí os dois números que a notificação existe para dar simplesmente não
  existiam: a barra ficava em 0% do começo ao fim e a ETA era **zero**, porque
  `bgTaskEta` precisa de pelo menos um item concluído para ter média. Ou seja, o
  caso em que a notificação é a ÚNICA janela — app minimizado, centenas de MB,
  minutos de espera — era o caso em que ela não dizia nada. Os bytes sempre
  estiveram à mão (o shell os reporta a cada MB); faltava um canal. Como
  percentual e ETA são RAZÕES, toda a matemática vale sem mudar uma linha —
  trocar a unidade é só isto, e o que muda é a APRESENTAÇÃO (`formatBytes` no
  `SyncService`). A bandeira mora no REGISTRO da tarefa, não no envio: um lote
  de músicas pode estar rodando ao lado de um download de vídeo, e a unidade é
  de cada tarefa.
- `Long`, e não `Int`, do `optLong` da ponte até o `Progress`: um vídeo de 1080p
  passa dos 2 GB que o `Int` comporta, e o estouro sairia como uma barra andando
  para trás. Pelo mesmo motivo `setProgress` recebe **milésimos** em vez das
  unidades cruas — ele é `Int` por assinatura, e 1/1000 é muito além do que uma
  barra de notificação distingue.
- **O nome do que está baixando vale também para um item só.** `ytArquivo` chama
  `bgItemOnly` com o título do vídeo: "Baixando vídeo" sozinho não diz QUAL, e
  com o app minimizado não há outra tela para perguntar.
- **`(lidos, total)` é BYTES, e o caminho de 1080p mentia** (corrigido na
  v1.58). Ele reportava uma escala de 0 a 100 (`lidos * 10 / total, 100` no
  áudio, `10 + lidos * 88 / total` no vídeo) para ter uma barra só que não
  voltava ao zero entre as duas faixas. Só que o outro lado trata os dois
  números como bytes: a notificação anunciava **"0 B de 100 B"** para um vídeo
  de 380 MB — que se lê como CEM ITENS. Agora as duas fases reportam bytes de
  verdade (o vídeo somando o áudio já baixado), e o preço é a barra recuar UMA
  vez, quando o total cresce da faixa de áudio para a soma das duas. É o preço
  certo: os dois números passam a ser sempre verdadeiros, que é a única coisa
  que essa notificação existe para dizer.

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
  fila consome cada nome UMA vez, em ordem.
- **O ritmo é MEDIDO, não chutado** (`bgSpinMs`): `decorrido / concluídos` é
  o tempo médio por item — exatamente o X/6. Se a fila acumula (a rede
  acelerou), o escoamento acelera junto, para a lista não ficar exibindo um
  passado cada vez mais velho.
- **Sem o buffer a lista engasgava.** Os 6 workers andam em lockstep — entram
  e saem quase juntos —, então os eventos chegam em rajada (meia dúzia em
  poucos ms) seguida de segundos de silêncio. Sem fila, a rajada rendia UMA
  troca de nome e o resto era descartado: o nome ficava parado até a rajada
  seguinte, que é exatamente a sensação de travado.
- **O compasso PARA quando o download trava.** Animar durante uma queda de
  rede esconderia justamente o que precisa ser visto — e ali não há novidade
  nenhuma a mostrar, só passado. Passando `BG_STALL_MS` (90 s) sem nenhum
  evento real, a lista congela e o `idleMs` cresce na tela: os dois sinais
  concordam.
- **`idleMs` separa "travado" de "esta faixa é grande"**, que na tela são a
  mesma coisa parada. Passado o limiar, a notificação **para de prometer
  tempo restante** e passa a dizer "sem resposta há X": uma ETA calculada
  sobre um ritmo que não existe mais é a promessa mais enganosa que essa
  notificação pode fazer. E `formatIdle` não usa degraus (ao contrário de
  `formatEta`) — aqui o número PRECISA subir a cada atualização, é vê-lo
  crescer que diz "isto não está andando".
- **O freio é UM só, e vale só para a rotina.** O Android limita a taxa de
  updates de notificação e passa a descartar o excesso — sem freio a barra
  PARECE travada. `BG_NOTIF_MIN_MS` (700 ms) segura a atualização de rotina
  (`bgTaskStep`, em que só o contador andou); tudo o que precisa chegar na hora
  passa `force`: o primeiro nome de uma tarefa, cada troca de nome na linha e o
  estado final. Houve um segundo piso ("250 ms para o item que acabou de entrar
  em download", escolhido pelo chamador num parâmetro `destaque`); ele saiu na
  v5.48 porque **nenhum chamador o passava** — era código morto, e
  mexer na constante não produzia efeito nenhum no aparelho. Quem de fato dá o
  ritmo do item que entra é o compasso (`bgPacerTick`, `BG_TICK_MS` = 250 ms),
  que envia com `force` sempre que o nome troca. Repor o piso curto seria pior
  que o `force`: o primeiro nome nasce a poucos ms do envio de abertura da
  tarefa e ficaria retido até o batimento de reenvio (`BG_REENVIO_MS`, 2 s).
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
- **⏮/⏭ mudam de eixo conforme a cena.** Na notificação só cabem três botões no
  modo compacto — e com letra, versículo ou mensagem em cena é a estrofe que o
  operador está passando. `slideMode` (de `slideTarget()`) decide, e o rótulo do
  botão diz qual é o modo para não virar adivinhação. **Desde a v5.49 a TELA
  segue a mesma regra**: os botões de estrofe que flanqueavam a preview saíram,
  e o par ⏮/⏭ do transporte passa estrofe no toque curto e mídia no toque longo
  (ver `attachTransportStep` em `controle.js`). O que a notificação já fazia por
  falta de espaço virou a convenção dos dois lados — e o `slideMode` que ela
  envia deixou de ser a única leitura dessa regra na tela.
- **A PALAVRA do rótulo é `slideLabel`, e ela viaja campo a campo.** "Estrofe"
  não serve para tudo: numa APRESENTAÇÃO o que ⏮/⏭ passam é página. O campo
  nasceu na v5.97 e o `SessionService` sempre o leu — mas até a v5.102
  `AVNative.nowPlaying` **não o copiava para o JSON da ponte**, e a notificação
  escreveu "(estrofe)" durante toda a rodada das apresentações. É a forma de
  falhar dessa função: ela remonta o objeto campo a campo, um campo esquecido
  desaparece em silêncio e o `optString` do Kotlin lê vazio como "use o
  padrão". **Campo novo em `pushNowPlaying` = campo novo em
  `AVNative.nowPlaying`**, sempre — e sem subir `SHELL_VERSION`, porque o lado
  Kotlin não muda.
- **`play`/`pause` e `playpause` são coisas diferentes.** Tela de bloqueio, fone
  e Android Auto sabem o que querem e mandam intenção explícita; o botão da
  notificação é alternador. Tratar tudo como alternador faria um `onPlay`
  recebido com o áudio já tocando PAUSAR o louvor.
- **O estado sai de `pushNowPlaying`**, que lê o título do próprio
  `#npNameInner` já renderizado, e a posição/duração da própria **barra de
  progresso** (`#seek`) — em vez de
  reconstruir as origens (mídia/letra/versículo/mensagem) ou recalcular o tempo
  por fora. Duplicar essas árvores era garantir divergência; e a barra é a única
  fonte que cobre todos os tipos, inclusive YouTube (`preview.getDuration()` é do
  `<video>` do stage e não sabe nada de um vídeo do YouTube). Barra desabilitada
  (imagem, versículo, mensagem) zera os dois campos, para o sistema não desenhar
  uma linha do tempo que não significa nada.
- **CENA é tudo que está no telão, não só mídia.** `active` inclui `currentId`,
  mensagem, versículo, **cronômetro e sorteio** projetando. Os dois últimos
  ficavam de fora: o efeito não é a projeção cair no meio (uma vez que qualquer
  mídia tocou, `currentId` nunca mais volta a null), é o caso da sessão
  RECÉM-ABERTA — projetar a contagem regressiva de abertura sem ter selecionado
  mídia nenhuma não levantava o serviço, e o processo, com a `Presentation`
  junto, seguia descartável exatamente durante os dez minutos em que o operador
  minimiza o app para esperar.
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
- O serviço vive enquanto houver **cena**, não só enquanto toca: pausado, o
  operador ainda precisa do botão de play. Sem cena, ele para e a notificação
  some.
- **A cena pode acabar enquanto o serviço sobe.** `nowPlaying` e `stop` chegam
  da thread do WebView: publicar uma cena dispara `startForegroundService`, e o
  `active:false` que vem logo atrás chega ANTES de o serviço existir. Sem a
  guarda, o serviço nascia depois disso e ficava de pé com "Nada em exibição" —
  e nada mais chamaria `stop()`, porque o lado web deduplica por chave e não
  reenvia o `active:false`. `stopSelf(startId)`, e não `stopSelf()`, para um
  comando mais novo já enfileirado (uma cena nova) cancelar a parada, como manda
  o contrato do `Service`. Pelo mesmo motivo, `stop()` só chama `stopService`
  quando o serviço **já** está em primeiro plano: derrubá-lo com um
  `startForegroundService` pendente é o caminho conhecido para o app ser morto.
  Perder a notificação de controles seria um arranhão; perder a projeção, não.
- **Ícones são os do sistema** (`android.R.drawable.*`: `ic_media_previous`,
  `ic_media_play`/`ic_media_pause`, `ic_media_next` e, para Parar,
  `ic_menu_close_clear_cancel`) — carregar um conjunto próprio no `res/` só para
  cinco botões não se paga, e o `MediaStyle` os tinge conforme o tema.
  **Exceção: a cortina**, que usa
  `ic_image`/`ic_image_off` (vetores próprios). O sistema não tem imagem
  riscada, e o que havia até a v1.18 (`ic_menu_view`) é um OLHO — sugere
  "esconder a vista", quando o que sai do telão é a MÍDIA. São os mesmos dois
  símbolos que o botão do app já usa nesse par de estados.
- **O ícone da cortina mostra o ESTADO; o rótulo, a ação** (v5.50 — a regra
  virou "o riscado é o corte", ver `docs/ARQUITETURA-WEB.md`). Telão coberto =
  imagem riscada; mídia no ar = imagem inteira. O rótulo ("Cobrir telão" /
  "Mostrar mídia") continua nomeando o que o toque faz, e é ele que a
  notificação tem de sobra em relação à tela — onde quem carrega o estado é a
  cor. Até a v5.49 o ícone daqui era a AÇÃO, junto com a tela; a base web
  inverteu, e deixar a notificação para trás faria o MESMO símbolo significar
  coisas opostas nos dois lugares.
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
- **E esse salto de thread abre uma janela, que `running` fecha.** `update()`
  confere na thread do WebView que o serviço existe e enfileira o `publish` na
  main; entre uma coisa e a outra, o `onDestroy` de um `stopSelf` anterior pode
  rodar. Sem a guarda a continuação publicava numa instância já destruída — um
  `notify` que ninguém mais cancela (o cartão eterno que o `SyncService` já
  aprendera a evitar) ou um `startForeground` de um serviço que não existe
  mais. Como o lado web deduplica por chave e não reenvia o mesmo estado, essa
  notificação órfã ficaria de pé, com os botões mortos, até o app ser fechado.
  Pelo mesmo motivo o `onDestroy` **cancela a notificação explicitamente**: o
  sistema só recolhe sozinho a que veio de `startForeground`.
- **A notificação NÃO pode depender do JS do Controle estar rodando.** Com o
  app minimizado e sem áudio audível no celular (mesa de som desligada), o
  sistema estrangula aquele WebView: `pushNowPlaying` para de ser chamado e a
  notificação congela — botão em "play", barra parada — enquanto o telão segue
  projetando. Ligar a mesa de som fazia o defeito sumir porque áudio audível
  isenta a página do estrangulamento, o que foi justamente a pista.
  `NativeBridge.snoopDisplayStatus` lê de passagem o `display-status` que o
  telão já emite pelo `busPost` e corrige play/pause, posição e duração
  (`SessionService.updateFromDisplay`). A `Presentation` não é estrangulada —
  é uma fonte que continua viva quando a outra não está. Não é decisão de
  transporte: copia campos que o web já calculou, e sem cena publicada não
  inventa nada. Republica com a mesma economia do lado web (só em troca de
  play/pause, de duração, ou salto de posição além de `POS_TOL_MS`).
  **Sem telão conectado o caso não se aplica**: ali a projeção É a preview em
  tela cheia, que exige o app na frente — minimizar já encerra a projeção.
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
`assets/web/` num `web-assets.zip` e publica, junto com um `version.json`, na
release de tag fixa **`web-latest`** — URL estável, porque está compilada no
shell. O app consulta esse `version.json` na abertura, baixa quando há versão
nova e passa a servi-la. (O tamanho do zip sai no log do próprio job, no
`echo "Bundle: …"` — número no doc envelhece a cada push.)

> **O nome do repositório aparece nos DOIS lados, e eles têm de bater**: o
> workflow escreve a URL do zip a partir de `$GITHUB_REPOSITORY`, e o
> `WebUpdater.REPO` é digitado à mão. Depois que o repositório foi renomeado,
> a constante ficou apontando para o nome antigo e o OTA só continuou
> funcionando por causa do redirecionamento do GitHub — corrigida na v1.39.
> Renomear o repositório de novo exige mexer nesta constante **e** publicar um
> APK, porque a URL está compilada no shell; e o modo de falhar é mudo: o
> `check()` engole tudo em `Log.i`, então um OTA morto não dá sinal nenhum no
> aparelho.

**A identidade do bundle é `assets/web/version.json`** (`version` +
`minShell`), versionado no repositório: o bundle carrega a própria versão,
seja ele o embutido ou o baixado. O workflow só acrescenta `sha256` e a URL.
**Atualizar esse arquivo junto com os outros dois lugares de versão** — ver
"Regras de desenvolvimento" — é o que dispara (ou não) uma atualização nos
aparelhos.

**O OTA não muda o acesso ao nativo.** A ponte é injetada no WebView pelo
Kotlin (`addJavascriptInterface`), não vem nos arquivos web: um bundle
baixado enxerga `__AVBridge` exatamente como o embutido, e o
`WebViewAssetLoader` serve os dois pelo mesmo origin — logo IndexedDB, OPFS,
SAF, Presentation e o serviço de segundo plano seguem idênticos.

### As três garantias (isto roda em culto)

1. **Nunca troca a base no meio de uma sessão.** O download é em segundo
   plano, mas o bundle novo só entra no **próximo lançamento** — o WebView do
   telão jamais recarrega ao vivo. "Por lançamento" é literal: `beginSession()`
   decide uma única vez por **PROCESSO** (`sessionStarted`), e não por
   `onCreate`. A garantia tinha sido escrita supondo o contrário: uma recriação
   da Activity no meio do culto rearmava o watchdog e rodava o `cleanup`, que
   APAGA o diretório servido ao vivo pelos dois WebViews. Por isso a faxina de
   bundles antigos preserva tanto o alvo novo quanto o `sessionRoot` em uso, e
   recolhe o resto no `beginSession()` seguinte — o único ponto em que nenhum
   WebView existe ainda. Sem essa ressalva, ativar uma versão nova durante o
   culto fazia todo recurso ainda não carregado (e qualquer recarga do telão)
   cair no fallback do APK: versão mais antiga, no meio da projeção.

   **A ÚNICA exceção é o operador pedindo** (v5.132 / shell 29). O que esta
   garantia protege é ele, não o mecanismo: a troca proibida é a ACIDENTAL. O
   app agora AVISA quando há uma base baixada esperando e oferece aplicá-la na
   hora (`otaPending`/`otaApply` → `WebUpdater.applyNow`, que troca o
   `sessionRoot` e recarrega as duas páginas). Três guardas mantêm o espírito
   intacto: a pergunta **não aparece com cena no ar nem com download em curso**;
   recusar vale para a sessão inteira (aviso repetido é ruído, e ruído em culto
   é pior que a versão antiga); e o watchdog arma igual, então um bundle que não
   confirme o boot é descartado no lançamento seguinte, exatamente como no
   caminho automático. **Nada é apagado ao aplicar**: o diretório antigo pode ter
   requisições em voo durante a recarga, e quem o recolhe continua sendo o
   `beginSession()` seguinte. Sem o pedido, o comportamento automático é o
   mesmo de sempre — o bundle entra só no próximo lançamento.
2. **Válvula `minShell`.** Se o bundle exigir uma ponte mais nova que
   `NativeBridge.SHELL_VERSION`, é recusado: o app continua no que já tinha,
   funcionando, até um APK novo chegar. **É por isso que `SHELL_VERSION`
   precisa subir toda vez que a superfície da ponte mudar** — sem isso a
   válvula não protege nada.
3. **Watchdog de boot.** Servir um bundle arma um `pending`; o lado web o
   desarma (`AVNative` → `otaConfirm`). Um bundle que não confirme é descartado
   no lançamento seguinte e o app volta ao embutido no APK. Sem isso, um bundle
   quebrado inutilizaria o app até reinstalar.

O `pending` guarda o **NOME do subdiretório**, não um booleano: com um booleano
a confirmação de um bundle perdoava outro, porque qualquer escrita de `false`
desarmava o que estivesse armado. E a chave é nova de propósito — ler um
`Boolean` como `String` em `SharedPreferences` lança `ClassCastException`,
dentro do `onCreate`, o que deixaria o app sem abrir depois de atualizar o APK.

#### Por que "`AVDB` existe" não bastava como confirmação

Até a v5.47 a única condição era `window.AVDB` no evento `load`, e o comentário
raciocinava sobre "um erro de sintaxe em `db.js`" — o arquivo MENOS provável de
quebrar. A ordem dos scripts do Controle é `native.js` → `db.js` → `stage.js` →
`louvorja.js` → `bible.js` → `controle.js`: um erro de sintaxe (ou um `throw` de
inicialização) em qualquer um dos QUATRO últimos aborta só AQUELE script, o
`load` dispara do mesmo jeito, `AVDB` continua lá — e o bundle quebrado era
carimbado como bom e servido PARA SEMPRE, o oposto exato do que o mecanismo
existe para fazer. Como o OTA publica a cada push em `main` e o `controle.js` é
de longe o que mais muda, esse era justamente o caso provável.

O sinal agora é "o app está DE PÉ" (`otaAppIsUp`, em `shared/native.js`), e cada
peça cobre um trecho da cadeia que a anterior não cobre:

1. **papel `controle`.** O WebView do Display carrega bem menos código (não
   carrega `controle.js` nem `louvorja.js`), então deixá-lo confirmar validaria
   um bundle cujo Controle nunca chegou a rodar — e o Display é o caso NORMAL de
   culto, ou seja, confirmaria quase sempre no lugar do outro. Sem TV ele nem
   existe: quem confirma é sempre o Controle, que é quem precisa funcionar. A
   regra é imposta **nos dois lados**: o laço nem começa no Display, e
   `NativeBridge.otaConfirm` recusa a chamada quando `role != "controle"`.
2. **`AVDB` (db.js) e `createStage` (stage.js)** — os dois módulos
   compartilhados, cada um publicando seu global no fim do arquivo.
3. **`__avBack` (controle.js, perto do fim do arquivo)** — só existe se o
   `controle.js` foi parseado por inteiro e executado até quase o fim. É a mesma
   função que `MainActivity.handleBack()` consulta: um contrato que já existe,
   não um marcador inventado para o watchdog.
4. **um `<li>` dentro de `#playlist`** — o HTML entrega esse `<ul>` VAZIO; quem
   o preenche é `renderPlaylist()`, chamado dentro do `init()` assíncrono. É o
   que prova que a inicialização terminou de verdade: `init()` começa por
   `loadCollections()` (louvorja.js), então uma quebra em `louvorja.js` ou
   `bible.js` derruba o `init()` antes daqui e o marcador nunca aparece.

**Por polling, e não uma checagem única no `load`:** o `init()` do Controle é
assíncrono (várias leituras de IndexedDB) e termina DEPOIS do `load`. Uma
checagem única rejeitaria todo bundle bom — o OTA pararia de funcionar por
inteiro, que é o defeito oposto e igualmente ruim. São 250 ms de intervalo e
30 s de desistência, em silêncio (sem confirmação, o `WebUpdater` descarta o
bundle no lançamento seguinte).

**O erro possível aqui é o SEGURO.** A confirmação só chega quando o `init()`
termina, isto é, algum tempo depois do `load` — fechar o app nesse intervalo faz
um bundle bom ser descartado; custo: o app volta ao embutido e o OTA baixa de
novo na abertura seguinte. O erro do outro lado — carimbar um bundle quebrado — não tem volta sem
publicar uma versão nova. E não há risco de descompasso: `native.js` viaja
DENTRO do bundle que ele valida, então a função e o `__avBack` que ela exige são
sempre do mesmo commit.

#### As outras defesas do caminho de download

- **Uma verificação por vez** (`checking`, um `AtomicBoolean`). `checkAsync`
  roda em todo `onCreate`, e o `android:configChanges` não cobre `fontScale`
  nem `locale`: mudar o tamanho da fonte durante um download disparava um
  segundo `check()` em paralelo, e os dois escreviam nos MESMOS caminhos
  temporários — podia sair um diretório INCOMPLETO ativado como bundle bom. Os
  caminhos temporários também levam um sufixo único por execução.
- **Host travado** (`github.com`, `objects.githubusercontent.com`) e **`https`
  obrigatório**. Não dá autenticidade (quem escreve o `version.json` escreve o
  zip), mas impede que um único campo alterado aponte o download para um
  servidor qualquer — e esse JS rodaria no origin privilegiado, com a ponte
  inteira à disposição.
- **`sha256` obrigatório.** Aceitar um `version.json` sem o campo era instalar
  um bundle sem verificação nenhuma. O workflow sempre o emite.
- **Zip slip** (entradas com `..` que escapariam do diretório) e um teto de
  tamanho na extração.
- **Reprovação antes de ativar:** falta do `web/controle/index.html` descarta o
  staging.
- Um APK novo com base web mais recente também descarta um OTA antigo. A
  comparação é **numérica por componente**, não lexical (`4.9` < `4.82` como
  string), por isso `compareVersions` compara cada componente como inteiro.
- O fallback é **por arquivo**: o que faltar no bundle baixado é servido do APK.

---

## A paleta

A paleta "Sala Escura" (âmbar) mora em **`assets/web/shared/tokens.css`**, fonte
única carregada pelos dois `index.html` **antes** da folha do app. Até a v5.47 os
tokens de marca eram mantidos à mão em DUAS folhas (`controle.css` e
`display.css`), e o comentário das duas admitia que "a sincronização é manual" —
sincronização manual entre dois arquivos é uma classe de bug, não um processo:
basta um ajuste entrar só num lado para o telão e a preview do Controle, que
existe justamente para ESPELHAR o telão, mostrarem coisas diferentes.

O essencial para não quebrar nada aqui:

- **Só cor entra em `tokens.css`.** Raio, escala de ícone, curva de toque e
  medidas de layout ficam no `:root` de `controle.css`: são decisões da UI densa
  do Controle, e o Display (que não tem UI) não teria o que fazer com elas.
- **Três matizes, com papéis que não se misturam.** Âmbar é a marca IASD **e** o
  accent (navegação, seleção, progresso) — `--gold` e `--accent` têm o mesmo
  valor de propósito, e os dois nomes existem para distinguir na folha "isto é
  marca" de "isto é navegação". Vermelho é atenção, em dois papéis separados:
  **preenchido = está no ar agora** (`--live`), **contornado = ação destrutiva**
  (`--danger-text`) — nunca preenchida, para não competir com o que está de fato
  no telão. Verde (`--ok`) é **só** concluído/conectado; antes ele também dizia
  "está no ar" em dois lugares enquanto outros quatro diziam o mesmo em
  vermelho, duas cores opostas para a mesma mensagem na mesma tela.
- **A superfície AFUNDA dentro de um cartão** (a regra no topo de
  `controle.css`). `--surface`/`--surface-2` são branco com alfa, então
  EMPILHAM: o mesmo token sobre `--panel` produz uma base bem mais clara do que
  sobre `--bg`, e era essa a causa raiz do pior contraste do app. Não existe
  alfa que resolva os dois casos, então dentro do cartão o sinal se INVERTE (o
  overlay passa a ser preto) — que também é a convenção certa de UI escura: o
  cartão já está elevado, logo o controle dentro dele é recesso, e ainda emite
  menos luz num salão escuro. Como custom properties HERDAM, a regra só precisa
  marcar os elementos que de fato pintam `--panel`.
- **Nunca escrever branco literal.** Nenhum `#fff` sobrou como valor de cor em
  `controle.css`/`display.css`: o branco pleno era a maior fonte isolada de luz
  emitida do app, e o off-white da paleta (`--text`) é o que se usa. As únicas
  exceções são **o palco**: `--stage-text: #fff`, porque num telão a
  legibilidade vem de luminância máxima, não de um off-white calibrado para uma
  tela a 30 cm do rosto.
- **O ÍCONE DO APP também é a paleta** (v1.34). Ele era um PNG com o botão AZUL
— sobra da paleta azul que a base web abandonou na v5.47 — sobre um fundo verde
copiado do wallpaper, que é a cortina da TV e nunca aparece no celular: nenhuma
das duas cores existia na tela que o operador vê ao tocar no ícone. Agora é o
mesmo mixer de três faixas em `--text` (trilha) e `--accent` (botão) sobre
`--bg`, o mesmo preto que o sistema desenha antes de o WebView carregar. Ele
virou VETOR (`res/drawable/ic_launcher_foreground.xml`) porque com `minSdk` 26 o
adaptativo é o único ícone que chega a ser desenhado: os cinco PNGs por
densidade eram peso morto e mais cinco lugares para a cor divergir. A camada
`monochrome` (ícones temáticos do Android 13+) ganhou vetor próprio — ela
apontava para o PNG do primeiro plano, que tinha fundo opaco, e o ícone temático
virava um quadrado cheio.

**`res/values/colors.xml` espelha `--bg` à mão.** É o preto das barras de
  status e navegação e o `windowBackground` (o que aparece ANTES de o WebView
  carregar). Nada no build detecta a divergência, e o OTA pode trocar a base web
  sem trocar o APK — se o token mudar, este valor muda junto.

**Não há teste automatizado de contraste no repositório.** Os números nos
comentários de `tokens.css` são medições feitas à mão, e os pares que ficam
abaixo do piso estão declarados como tais no próprio comentário. Ao mexer num
token, meça — nada no CI vai barrar uma regressão.

O raciocínio completo (cada par medido, os pisos adotados, os ladrilhos da
Bíblia e as células de capítulo/versículo) está na seção de paleta de
`docs/ARQUITETURA-WEB.md`.

---

## Divergências entre o caminho web e o nativo

**Regra de escrita:** toda guarda é `if (!window.__NATIVE__) { …web… }`, nunca
o inverso como caminho principal. O comportamento de navegador é o padrão; o
nativo é a exceção que se declara. Assim a base continua rodando nos dois
contextos.

| Ponto | Navegador | App nativo |
|---|---|---|
| Service workers (`sw.js`) | — | **o arquivo não existe no bundle e o registro saiu dos DOIS apps** (v5.48): os assets já são locais, e recarregar o WebView do telão no meio de um culto é justamente o que não pode acontecer. Atualizar a base é papel do OTA |
| `#startBtn` "Ligar Sistema" | destrava autoplay de terceiros | **oculto** — `mediaPlaybackRequiresUserGesture = false`; uma TV não recebe toque |
| Recuperação de áudio bloqueado | segue tocando mudo + retentativas | **desativada já no `onBlocked`** — sem política de gesto, qualquer `NotAllowedError` só pode ser falso positivo, e mutar antes de descobrir isso deixava o telão sem som sem armar recuperação nenhuma |
| Pastas do dispositivo | `showDirectoryPicker()` | **SAF** — a File System Access API **não existe no Android**; este recurso era letra morta no celular e passa a funcionar |
| Compartilhamento | **não existe mais** — vinha do `share_target` do manifest com o POST interceptado pelo SW, e os dois saíram do bundle; sobra a leitura do estado `pending-share`, que hoje ninguém escreve | **`intent-filter` nativo** (`ShareIntake.kt`), que só aceita `content://` de outro app (ver abaixo) |
| Onde o share ATERRISSA | idem ao nativo (o caminho é o mesmo `importShare`) | **`focarImportado`** (v5.77): fecha os popups abertos e a seleção, e então **projeta na hora** no simplificado ou **vai para o Cronograma** no avançado — e no simplificado o item NÃO entra em lista visível nenhuma (v5.89: vai para a prateleira `avulsos`), porque aquela tela não tem Cronograma nem playlist. A preview em tela cheia só é encerrada se houver telão — sem ele, ela É a projeção |
| Estado do telão (rodapé de Configurações) | atalho `window.open('../display/')`, útil só para desenvolver | **indicador ao vivo** (desabilitado como botão) — a Presentation é criada sozinha |
| Botão de cast da preview | oculto | `AVNative.openCast()` → seletor de **espelhamento de tela** (ver abaixo) |
| PDF, PowerPoint, Google Apresentações | **PDF não existe** (não há quem o desenhe); o `.pptx` funciona, e é o MESMO caminho do app | **viram UMA IMAGEM POR PÁGINA**, cada formato pelo caminho que existe para ele: o **PDF** pelo `PdfRenderer` da PLATAFORMA (`SlideDeck.kt` + `AVNative.deckPages`) — fidelidade total, zero dependência; o **`.pptx`** pelo renderizador de OOXML em `assets/web/vendor/` (`pptxParaPaginas`, em `controle.js`), carregado por `import()` dinâmico e rasterizado com `<foreignObject>` + canvas. Daí para a frente é mídia comum: fade, cortina, telão e `MediaSession` que já existem, com ⏮/⏭ passando página. **Não há botão de "apresentação"**: uma apresentação é um arquivo como outro qualquer, e entra pelo mesmo "Importar arquivos" (que no app abre o seletor do SISTEMA, `pickDoc` — o `<input type="file">` devolve bytes, e o PDF precisa que o shell abra o ARQUIVO) ou pelo compartilhamento. O `.ppt` anterior a 2007 e o `.odp` ficam de fora: ninguém sabe desenhá-los, e aceitar para depois falhar é pior que não aceitar. O link do Google entra sozinho pela URL de exportação |
| **Tocar agora** de um vídeo do YouTube | player embutido (IFrame API) | **TRANSMISSÃO DIRETA** (v5.120/shell 26; **funcionando só do shell 27 em diante**): o shell monta o manifesto das duas faixas adaptativas (`ytStream`), o `StreamProxy` as serve pelo NOSSO origin com o UA que combina com a URL, e o `MediaSource` de `shared/mse.js` as vira um `<video>` COMUM — fade, cortina, `MediaSession`, barra e segundo plano de graça, **e zero pixel de YouTube no telão**. Sem esperar o download. A faixa de bytes viaja na QUERY (`?r=<ini>-<fim>`), nunca no cabeçalho `Range` — ver a invariante 8, que é a razão de o recurso ter passado três versões sem tocar um único vídeo. Só em "Tocar agora": as outras três ações GUARDAM o item, e um manifesto expira em horas. Falhando qualquer coisa (shell < 27, vídeo sem par adaptativo, WebView sem o codec) cai no download, calado — o operador pediu o louvor, não o método |
| Vídeo do YouTube | player embutido (IFrame API) | **arquivo de vídeo baixado PELO APARELHO** (`YoutubeGrab.kt` + `AVNative.ytFetch`) — o embed pausa sozinho com o app minimizado, e a extração no próprio celular sai do IP do chip, que é o que o YouTube não bloqueia. Sem configurar nada. Cobalt continua como segunda opção para quem já mantém uma instância; falhando os dois, o link vira item de player |
| Qualidade do download | — | **o operador escolhe o teto** (1080p · 720p · 480p, v5.118/shell 25), no mesmo seletor de Vídeo/Só áudio da folha. Ele nasce no padrão A CADA ITEM, e isso é deliberado: um teto que grudasse faria quem escolheu 480p numa rede ruim receber, sem aviso, o vídeo principal do domingo seguinte em 480p no telão — o atrito de dois toques é visível, a regressão silenciosa não seria. Pedir 1080p continua saindo pelo `ytFetch` de sempre (nenhum shell novo exigido); só um teto MENOR usa o método novo. O progressivo respeita o teto, mas nunca ao ponto de não entregar nada: não cabendo nenhum, vale o menor que existir |
| Resolução do download | — | **até 1080p, montando as duas faixas** (v1.44; pares por contêiner na v1.45). Acima de 720p o YouTube só entrega vídeo SEM som, com o som à parte — e por isso o app baixava a pior cópia: só sabia pegar o progressivo, que neste aparelho é UM, de 360p. `MuxMp4.kt` junta as duas com o `MediaMuxer` da PLATAFORMA: é cópia de amostras, não recodificação, então não há perda nem espera. Teto de 1080p de propósito (o telão da igreja é 1080p) e só quando o resultado for melhor que o progressivo — senão dois downloads e um muxer entregariam o mesmo de antes. Os pares são do MESMO contêiner (mp4+m4a → MP4, webm+webm → WebM, este só na API 29+): "a melhor de cada lado" produziria VP9 dentro de MP4, que o muxer recusa depois de tudo baixado. Falhando qualquer etapa, o progressivo segue como piso. **Da v1.44 à v1.48 isso não saía do papel: as faixas eram listadas (1080p) e o CDN respondia 403 a todas** — com os dois pares, os dois perfis de UA e `Range`. Era o SABR, que o YouTube passou a exigir de quem pede sem PO Token. A saída não era montar o token (o `getWebClientPoToken` da biblioteca não tem uma única chamada em versão nenhuma, e o token do cliente Android — o que ela de fato consome — exige o DroidGuard do Play Services): foi **atualizar o extrator para a v0.26.4** (v1.49), que busca o cliente **visionOS** sem token nenhum e volta a entregar as adaptativas. Como as listas passaram a chegar MISTURADAS (visionOS + o cliente antigo), a escolha virou uma **fila de candidatos** — ver "O cliente visionOS destrava o 1080p" em `docs/ARQUITETURA-WEB.md`. **CONFIRMADO em aparelho:** `clientes VISIONOS 17, ANDROID 1 → juntou 1080p (mp4, 137@VISIONOS/V)`, sem uma única recusa na fila. Diagnóstico no rodapé de Configurações, agora com o itag, o cliente e o motivo de cada tentativa |
| **Só o ÁUDIO** em "Tocar agora" | player embutido | **TRANSMITIDO também** (v5.130): o manifesto do shell já traz o par, e o lado web simplesmente DESCARTA a faixa de vídeo (`man.video = null`) — nenhum método novo, nenhum byte de 1080p baixado para ser jogado fora, e por isso chega por OTA. Entra como `kind: 'audio'` (o telão mantém o wallpaper) e o fallback, se a transmissão morrer, baixa a MESMA forma. O download de um m4a é rápido, mas "rápido" não é o pedido: o pedido é não esperar |
| **Só o ÁUDIO** guardado (playlist · Cronograma · Favoritos) | — | **`ytFetchAudio`** (v5.112, shell ≥ 23; **exige o APK v1.41+** — ver abaixo): a faixa de áudio, sem vídeo. A escolha é o MESMO seletor de Cantada/Playback das músicas, no topo da folha de destinos, e vale para as quatro ações. Entra como `kind: 'audio'` e **sem miniatura** — é o kind que faz o telão manter o wallpaper em vez de trocar de imagem. É também o único caminho em que o teto de 720p do progressivo não existe: o áudio do YouTube já vem em faixa separada, então aqui ele vem inteiro. **E é justamente por ser faixa separada que ele pode não vir**: adaptativo é o que o YouTube protegeu com SABR quando o app pedia sem PO Token. Daí a fila de tentativas do shell — que na v1.49 deixou de ser "m4a → qualquer outro → progressivo" e passou a ser **três candidatos de áudio na ordem do cliente que funciona** (visionOS primeiro), com o progressivo ainda no fim. **CONFIRMADO em aparelho:** `→ veio m4a 140@VISIONOS` (AAC-LC 128 kbps, primeiro candidato, primeira requisição) — até a v1.48 este caminho caía no vídeo de 360p inteiro. O registro entra como `kind: 'audio'` em todos os casos: quem decide que o telão não muda de imagem é o kind, não o container |
| Buscar no YouTube | não existe: o botão abre o YouTube numa aba | **a busca acontece DENTRO do acervo** — a tela que o rótulo chama de **Biblioteca** desde a v5.96, e que no código segue sendo o acervo — (`AVNative.ytSearch`, `YoutubeGrab.pesquisar`, em **português** — no padrão en-GB da biblioteca o YouTube devolve o título TRADUZIDO de vídeos que são originalmente em português, e passar a localização ao `NewPipe.init` NÃO resolve: o serviço filtra o idioma por uma lista de suportados que hoje só tem `en-GB`. Quem resolve é o `forceLocalization` do próprio `Extractor`): os resultados entram na mesma lista e o toque abre a mesma folha de três escolhas das músicas (tocar · playlist · Cronograma), cada uma indo só para o seu lugar. Um iframe da página de resultados é recusado pelo `X-Frame-Options` do YouTube, e a API oficial exigiria chave com cota compartilhada pela frota |
| Link para fora do app ("Pesquisar … no YouTube") | `window.open` numa aba nova | **`AVNative.openExternal(url)`** → `ACTION_VIEW` numa tarefa própria. O WebView RECUSA navegar para outro origin (invariante 2), então sem esse método um link externo não faz absolutamente nada — nem erro no console |
| "Conectar a tela" (modo simplificado) | abre a tela do Display (`window.open`) — e é ela que conta como "conectado" | mesmo `AVNative.openCast()`, com o nome da tela conectada no subtítulo |
| Simplificado sem tela conectada | mesmo bloqueio, com a janela do Display no lugar da `Presentation` | **modo bloqueado**: cortina embaçada sobre tudo, só o botão de conectar — preenchido no accent, no centro da tela — e a saída para o avançado na frente |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation API | idem, com trava de paisagem **nativa** (`onShowCustomView`) |
| Botões físicos de volume | o navegador não os recebe | **interceptados** e ligados ao fader do app (ver abaixo) |
| Microfone (`getUserMedia`) | o navegador pergunta | `MicChromeClient` + permissão `RECORD_AUDIO` (ver abaixo) |
| Botão voltar | — | **fecha o que estiver aberto** (popup, sub-tela, aba) e só então manda a tarefa para segundo plano (ver abaixo) |
| Controles fora do app | — | **notificação + tela de bloqueio + botões de mídia** via `MediaSession` (ver seção acima) |
| Download com o app minimizado | a aba continua baixando | **foreground service + wake lock** — sem isso o processo é congelado (ver seção acima) |
| Atualização da base web | recarregar a página | **OTA** — bundle publicado em `web-latest`, aplicado no próximo lançamento (ver seção acima) |

### Compartilhamento: um ponto de entrada exportado valida o que recebe

O `intent-filter` de `ACTION_SEND` é público e qualquer app instalado pode
dispará-lo. `ShareIntake` só aceita `content://`: `openInputStream` também atende
`file://` e `android.resource://`, e a leitura acontece com o uid DESTE app — um
app malicioso com `targetSdk` antigo podia compartilhar
`file:///data/data/br.org.iasd.av/shared_prefs/…` e o conteúdo virava item de
mídia do Cronograma, projetável na TV. A autoridade do próprio app também cai
fora. Não há canal de volta para quem compartilhou (o dano demonstrável é nulo),
mas um ponto de entrada exportado que não valida o que recebe é dívida gratuita.

O intent é **consumido** depois de lido (`consumeShareIntent`), e o parse só roda
com `savedInstanceState == null`. A única saída do app é `moveTaskToBack`, então
a Activity nunca é finalizada e `getIntent()` devolveria o mesmo `ACTION_SEND`
para sempre: qualquer recriação (mudar o tamanho da fonte ou o idioma — nenhum
dos dois está em `android:configChanges` — ou voltar pelo Recentes) importaria
uma segunda cópia integral do arquivo, sem aviso e sem desfazer.

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
  do `onShowFileChooser` (invariante 6). Três regras: concede **só**
  `RESOURCE_AUDIO_CAPTURE` (o sistema de projeção não tem uso para câmera, MIDI
  ou proteção de conteúdo); **só se o app já tiver `RECORD_AUDIO`** — conceder
  ao WebView uma permissão que o processo não tem apenas adiaria a falha para um
  ponto sem sinal claro; e **só da própria origem**. A terceira é defesa em
  profundidade: este client é do WebView do TELÃO, que carrega conteúdo de
  terceiro por design, e o `grant()` é silencioso — não há prompt nem sinal na
  tela. Uma origem AUSENTE não é negada (nunca foi observada aqui, e recusar por
  um campo vazio tiraria o push-to-talk sem ganho conhecido).
- **`requestMicPermission`** (`AVNative.requestMic()`), pedido **sob demanda**,
  no primeiro toque no botão. Não na abertura do app: um pedido de gravar áudio
  sem contexto, no primeiro lançamento, é o tipo de coisa que se nega por
  reflexo — e aí o recurso fica quebrado sem motivo.

O caminho de áudio no Display é `getUserMedia → MediaStreamSource → GainNode →
destination`, com rampa na entrada e na saída (cortar no meio de uma palavra
estala na caixa de som). `echoCancellation` fica **ligado**: num culto um ganho
realimentado é um estrago imediato e público, e vale mais que a fidelidade extra
de desligar o processamento. Ainda assim, se a saída de áudio for o próprio
celular e não a TV, o risco de microfonia continua — é do formato, não do
código. A latência do WebView é inerente.

O microfone fecha sozinho ao soltar o botão, ao **trocar de aba** e quando o
app vai para **segundo plano**: push-to-talk que sobrevive ao botão vira um
microfone esquecido ligado.

### Botão voltar: fecha antes de minimizar

Sair do app por engano durante um culto derrubaria a projeção, então o voltar
**nunca** encerra a Activity — no fim da fila ele apenas manda a tarefa para
segundo plano, com a sessão e a `Presentation` vivas. Isso não mudou.

O que faltava era a **fila**: com um popup aberto, uma pasta aberta ou a preview
em tela cheia, o gesto que todo usuário de Android conhece para "fechar isto"
minimizava o app inteiro.

**Quem decide é o lado web** (`window.__avBack`, em `controle.js`) — invariante
5: a hierarquia de navegação já existe lá, e reimplementá-la em Kotlin seria
duplicar o que `navigateBack()` faz. `MainActivity.handleBack()` só pergunta e
obedece. A ordem vai do mais efêmero ao mais permanente, que é a ordem em que
as coisas foram abertas:

1. diálogo modal (cancela, como o botão Cancelar)
2. dentro da gaveta de Favoritos: seleção múltipla, depois a pasta aberta — a
   hierarquia de DENTRO vem antes da gaveta, e a seleção antes da pasta porque
   ela é do conteúdo dela
3. bottom-sheet aberto (o de cima, se houver mais de um — a gaveta de Favoritos
   é um deles)
4. preview em tela cheia — que, sem telão conectado, **é** a projeção
5. coluna do mixer aberta no fader
6. seleção múltipla (a da lista de baixo, sem gaveta aberta)
7. sub-tela com voltar próprio (telas da Bíblia) → `navigateBack()`
8. aba diferente do Cronograma → volta para ele
9. nada aberto → `moveTaskToBack`

A tabela de popups é **a mesma** que registra o ✕ e o toque no fundo
(`POPUPS`): um popup novo entra numa linha e já é fechável pelos três caminhos.
Duas listas divergiriam no primeiro que alguém esquecesse de acrescentar.

**A resposta é assíncrona, e por isso há um prazo** (`BACK_JS_TIMEOUT_MS`,
350 ms). `evaluateJavascript` responde por callback; se o renderer morreu, está
travado, ou o bundle é antigo demais para ter `__avBack`, esse callback pode
nunca chegar — e um botão voltar que não faz **nada** é pior que um que
minimiza. O `postDelayed` garante a resposta padrão.

O que o `AtomicBoolean` garante, exatamente: que `moveTaskToBack` roda no
**máximo uma vez** por toque. Ele **não** garante que o app não minimize depois
de o web já ter fechado um popup — `__avBack()` executa a ação de forma síncrona
e só então retorna, então o que chega tarde é a RESPOSTA, não a ação. Com o
renderer ocupado, o prazo pode vencer com o popup já fechado e o operador vê as
duas coisas num toque só. Fechar isso de verdade exige um token de corrida
devolvido pelo lado web (`__avBack(token)` → `__avResolve`), o que é mudança de
contrato da ponte; enquanto não existe, o prazo é curto justamente para o caso
comum nunca chegar perto dele.

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

**A tecla mostra o fader por alguns segundos.** Interceptar o botão resolveu
*onde* o volume muda, mas o deixou **invisível**: com a coluna do mixer no
estado normal, o operador apertava e não via quanto ficou. `peekVolume()` (lado
web, `VOL_PEEK_MS` = 2,8 s) abre a MESMA visualização do toque no botão de
volume — reusando `openVolume()`/`closeVolume()`, não uma segunda UI — e a
recolhe sozinha. Vale inclusive quando a tecla vai para o sistema (fader no
máximo/zero): ver o fader no fim do curso é justamente a resposta para "por que
o volume do app não muda?". Detalhes das três regras de convivência com o toque
(só recolhe o que ela abriu; o toque nos botões cancela; mexer no fader
reinicia a contagem) em `docs/ARQUITETURA-WEB.md`, seção do Mixer.

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

**Só num aparelho SAMSUNG** (`isSamsung()`, v1.24):

1. **as activities exportadas do Smart View** — `com.samsung.android.
   smartmirroring` e `com.samsung.android.app.smartmirroring`
2. `com.samsung.wfd.LAUNCH_WFD_PICKER`

**Em qualquer aparelho**, e o único alvo nos que não são Samsung:

3. `android.settings.WIFI_DISPLAY_SETTINGS` (AOSP, ação legada — e a que **não**
   é reivindicada pelo Play Services, ao contrário de `CAST_SETTINGS`)

A cadeia nasceu no aparelho em que o app é operado (um S24 Ultra) e foi escrita
em volta dele — mas **"Smart View primeiro" é regra de UM fabricante, não do
Android**. Noutra marca esses pacotes simplesmente não existem, então a cadeia
já caía no alvo universal sozinha; o que a guarda acrescenta é **dizer isso** em
vez de deixar por acaso, não varrer as activities de dois pacotes ausentes a
cada toque no botão (e a cada abertura de Configurações, que chama
`describeCastTarget`), e fechar o caso em que o acaso não bastava — um pacote de
outro fabricante com o mesmo nome, ou uma ROM que carregue os apps da Samsung,
entraria na frente do alvo AOSP sem que nada no código tivesse decidido isso.

`isSamsung()` aceita `Build.MANUFACTURER` **ou** `Build.BRAND`: os dois dizem
"samsung" num aparelho de fábrica, mas uma ROM alternativa (ou um emulador) mexe
num e esquece o outro — e aqui errar para o lado do "não é Samsung" custaria o
Smart View justamente no aparelho em que o app é usado. Comparação sem caixa,
porque o valor não é normalizado por contrato.

Para o Smart View o nome da activity **não é adivinhado**: `exportedActivities()`
pergunta ao `PackageManager` quais o pacote expõe (`GET_ACTIVITIES`) e enfileira
as exportadas. A primeira tentativa usava um nome chutado — um palpite errado
simplesmente não resolve, a cadeia cai no fallback e o botão abre o Google Cast,
que é o oposto do pedido. Perguntar ao sistema elimina o chute.

**Nada disso é API documentada.** Se um alvo não existir (ou não for
exportado), `resolveActivity` devolve null / `startActivity` lança, e a cadeia
segue sem quebrar nada. Por isso `resolveActivity` precisa enxergá-los: daí o
bloco `<queries>` no `AndroidManifest.xml` (visibilidade de pacotes do Android
11+) — sem ele tudo resolveria para null e a cadeia cairia direto no fallback.
E o fallback abre a tela de **Tela** antes da de **Cast**, justamente porque o
Google Cast é o que não se quer aqui.

Como isso é território de fabricante, `describeCastTarget()` devolve o rótulo
do alvo escolhido **com o componente real** e o **popup de Configurações mostra
"Espelhar abre: …"**. O operador vê o que o aparelho ofereceu antes de tocar —
e, quando o botão abre a tela errada, essa string é o que diz qual candidato
pegou, sem depender de logcat.

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
- **`controle/icons/` e `display/icons/`** — só o manifest e os
  `<link rel="icon">` os usavam. Os ícones do app estão em `res/`.
- **`sw.js` e os dois blocos que o registravam** (v5.48). O último uso era o
  auto-reload quando um SW novo assumisse; a base web atualiza por OTA, e um
  reload do WebView do telão no meio de um culto é o que não pode acontecer.
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

**O `web-ota` roda com fila, sem cancelamento** (`concurrency: web-ota`,
`cancel-in-progress: false`). Os dois assets da release `web-latest` (o zip e o
`version.json` que carrega o `sha256` dele) são substituídos um a um, sem
transação: duas execuções em paralelo — o merge da branch seguido de um push de
correção é o caso normal — podem intercalar e deixar o zip de uma com o `sha256`
da outra, e a partir daí todo aparelho baixa, confere o hash e o OTA fica INERTE
até o próximo push em `main`, sem nenhum sinal. Cancelar no meio do upload
produziria exatamente o mesmo estado, por isso a fila espera.

**Antes de publicar, o job confere a sanidade do bundle:** `node --check` em
todo `.js` de `assets/web`, uma validação de `version.json`, os testes de
`tools/` — o parser `sidx`, o **oráculo do contrato de `shouldInterceptRequest`**
(`webview-range.test.mjs`, que trava a invariante 8: Node puro, determinístico,
sem `continue-on-error`) e cinco testes **em Chromium de verdade**, todos em
`continue-on-error`: a **fumaça** que sobe a base web e usa a tela
(`smoke.mjs`), as **mensagens de falha** da transmissão direta
(`mse.test.mjs`), a **transição de entrada do palco** (`stage-fade.test.mjs`),
o **coletor de lixo do banco** (`db-gc.test.mjs` — o único código do app que
apaga mídia do operador) e as **contas da biblioteca** (`acervo.test.mjs`:
"completa?" e "quanto ocupa?", que eram respondidas por fórmulas diferentes na
mesma tela).
Eles existem porque `node --check` prova que o arquivo é
PARSEÁVEL, não que o app funciona — a v5.121 saiu com um botão chamando uma
função apagada, sintaxe perfeita e CI verde. O canal OTA publica
direto para a frota, e o watchdog de boot **não evita o primeiro estrago** —
`beginSession()` arma o `pending` e SERVE o bundle; só o lançamento seguinte o
descarta. Ou seja: um lançamento quebrado por aparelho, garantido, e se for o do
culto o operador fica sem sistema até fechar e reabrir o app. Não substitui teste
de comportamento; garante que o bundle carrega.

**Assinatura.** As Releases saem **assinadas com keystore fixa**, guardada nos
secrets do repositório (`KEYSTORE_B64` — o `.jks` em base64 —, `KEY_ALIAS` e
`KEY_PASSWORD`). É isso que permite **atualizar por cima sem desinstalar**, e
por consequência **sem perder a biblioteca do app**: o Cronograma, as pastas
sincronizadas, os hinos do LouvorJA e a Bíblia baixada vivem em IndexedDB/OPFS,
que o Android apaga junto com o app numa desinstalação.

- O `.jks` **nunca é versionado** (`.gitignore`); o build o materializa a
  partir do secret e o descarta com o runner. A decodificação usa
  `Base64.getMimeDecoder()`, e não o BASIC: o `base64` do GNU coreutils quebra a
  linha a cada 76 caracteres por padrão, e quem for rotacionar a keystore cola
  exatamente essa saída no secret — o decodificador BASIC lança diante de
  qualquer `\n`, e `trim()` só limpa as pontas.
- Sem os secrets (build local, PR de terceiro, clone), o `build.gradle.kts` cai
  na assinatura de **debug** e tudo continua compilando — só não serve para
  atualizar por cima.
- **Publicar exige a chave, e agora isso é dito em vez de deduzido.** O passo de
  Release passa `-PrequireSigning=true`, e o próprio Gradle reprova a ausência da
  keystore: quem sabe se ela existe é ele. A guarda anterior era **código
  morto** — deduzia da existência de `app-release.apk`, mas o AGP só acrescenta
  o sufixo `-unsigned` quando a variante não tem signingConfig NENHUM, e o
  fallback de debug atribui um. O arquivo existia sempre, a etapa era pulada, e
  o que saía era uma Release assinada com a `debug.keystore` gerada pelo runner
  **naquela execução** — chave diferente a cada run,
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE` no aparelho, e como única saída
  desinstalar, apagando IndexedDB/OPFS.
- **Cinto e suspensório:** depois do build, o CI pergunta ao `apksigner` QUEM
  assinou o APK que vai ser publicado e falha se encontrar `CN=Android Debug`
  (que é fixo na chave de debug do Android, então o teste é exato e não depende
  de conhecer o CN da keystore de produção).
- **`versionCode` vem da CONTAGEM DE COMMITS** (`git rev-list --count HEAD`),
  mais um deslocamento de 100000 — daí o `fetch-depth: 0` no checkout, senão um
  clone raso devolveria 1. Não vem mais do número da execução: `github.run_number`
  conta por WORKFLOW, e renomear o `apk.yml` reinicia a contagem em 1, o que
  derrubaria o `versionCode` e forçaria desinstalar. O deslocamento existe para o
  primeiro APK desta regra ficar acima do último publicado pela regra antiga —
  se um dia um `versionCode` já publicado chegar perto dele, **aumente** o
  deslocamento, nunca o diminua. O `versionName` vem da tag.
- **Num disparo manual com `release_tag` o checkout usa `main`.** A tag nasce lá
  (`target_commitish: main`), e sem isso o APK podia ser compilado de uma branch
  de trabalho enquanto a tag apontava para `main`: binário publicado ≠ commit da
  tag. Vale a ressalva: `target_commitish` só é usado pela API do GitHub para
  CRIAR a ref quando ela ainda não existe — no fluxo documentado
  (`git tag && git push --tags`) a tag já existe e o campo não faz nada. Quem
  garante a coerência no disparo manual é o `ref: main` do checkout.
- O input **`retag`** (desligado por padrão) apaga a Release e a tag antes de
  recriá-las — é o único jeito de MOVER uma tag já publicada, já que o
  `action-gh-release` não move tag existente. Fica atrás de um input próprio de
  propósito: mover tag é destrutivo e não pode ser efeito colateral de uma
  publicação comum.
- Perder a keystore é irreversível: sem ela, toda atualização futura volta a
  exigir desinstalação. Guarde com backup.

**Backup com regras** (`res/xml/backup_rules.xml` e
`res/xml/data_extraction_rules.xml`). `allowBackup="true"` sozinho leva tudo o
que está no diretório de dados, e duas coisas não podem ir:

- `files/web-ota/` e `shared_prefs/web-ota.xml` são o bundle OTA extraído e o
  ponteiro para ele — **CÓDIGO** que roda no origin privilegiado, com acesso a
  `__AVBridge`. Restaurar um backup adulterado plantaria JavaScript arbitrário
  sem passar por nenhuma das três garantias: não há download, não há conferência
  de `sha256`, e a válvula `minShell` só existe no caminho do download. Nada ali
  precisa sobreviver à troca de aparelho — o APK traz a base web embutida e o
  `check()` seguinte rebaixa o bundle de novo.
- `app_webview/` é IndexedDB/OPFS, a biblioteca do app, que passa facilmente de
  gigabytes.

A diferença entre os dois destinos é deliberada: o backup em **nuvem** tem cota
de 25 MB por app, então com `app_webview` dentro ele não protegia a biblioteca
(não cabe) e ainda arriscava reprovar o backup inteiro; a **transferência direta**
entre aparelhos não tem essa cota, e ali copiar a biblioteca é justamente o que o
operador quer ao trocar de celular. Por isso `app_webview` só sai da nuvem. São
**dois arquivos porque o Android mudou o formato** (o antigo vale da API 26 à 30,
o novo da 31 em diante), não porque as decisões sejam diferentes — qualquer
exclusão nova precisa entrar nos dois.

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

- **SEMPRE gerar uma Release quando o SHELL mudar.** O merge em `main` só
  entrega a **base web** — o OTA carrega `assets/web/` e mais nada. Tudo o que
  está fora dela (`app/src/main/java/`, `AndroidManifest.xml`, `res/`,
  `build.gradle.kts`, os workflows) **só chega ao aparelho instalando um APK**.
  Sem a Release, a mudança fica publicada no repositório e ausente do celular —
  e o pior caso é silencioso: um método novo da ponte faz o lado web se
  comportar de um jeito no código e de outro no culto, porque lá o
  `SHELL_VERSION` ainda é o antigo.

  Então o fluxo acima ganha uma última linha quando o diff tocou o shell:

  ```bash
  # depois do push em main, com o Actions → "Build APK" → Run workflow,
  # input `release_tag` = a próxima tag (v1.24 → v1.25 → v1.26 …)
  ```

  A tag é criada pelo próprio workflow a partir de `main` (ver "Build"), então
  não é preciso empurrar tag à mão. **Não esperar o operador pedir**: mudou o
  shell, sai Release — e a mensagem que anuncia a mudança precisa dizer que ela
  exige instalar o APK, porque o OTA não vai levá-la.

- **Nunca perder funcionalidades existentes ao refatorar.** A base web tem
  todo o sistema de culto (coleções LouvorJA, letra sincronizada, Bíblia,
  Camada de Texto, playlist, fades) — ver `docs/ARQUITETURA-WEB.md`.
- **Todo código novo em `assets/web/` precisa continuar rodando no navegador.**
  Caminhos nativos entram sempre como `if (!window.__NATIVE__) { …web… }`.
- Não introduzir dependências externas — Kotlin puro + AndroidX oficial no
  shell; JavaScript puro no web. **Três exceções, e as três são declaradas:** a
  IFrame Player API do YouTube (carregada em runtime), o
  **`@aiden0z/pptx-renderer`** (v5.99, em `assets/web/vendor/`, Apache-2.0,
  carregado por `import()` dinâmico só quando alguém importa um `.pptx`), que
  existe porque o Android **não desenha PowerPoint** — a plataforma só traz o
  `PdfRenderer`, as bibliotecas nativas que fazem isso são comerciais ou
  limitadas a três páginas, converter num servidor mandaria o material do culto
  para fora do aparelho, e escrever DrawingML à mão produziria um slide PARECIDO
  com o que o pastor montou, que na frente da congregação é pior que slide
  nenhum (o levantamento inteiro está no `LEIA-ME.md` daquela pasta) — e o
  **`NewPipeExtractor`** (v5.81), que existe porque extrair a URL de um vídeo do
  YouTube significa acompanhar as defesas deles — os PO Tokens de hoje são
  atrelados a cada vídeo e assinados por BotGuard/DroidGuard, e escrever isso à
  mão seria assinar um contrato de manutenção semanal que quebraria sempre num
  domingo. A alternativa sem dependência era um servidor público, e ela FALHOU
  em aparelho: eles rodam em IP de datacenter, que é exatamente o que o YouTube
  bloqueia. E a v1.49 é a prova de que a conta está sendo paga por quem
  publica: o SABR que derrubou o 1080p foi resolvido do lado deles (cliente
  visionOS, v0.26.3) e chegou aqui como **um bump de versão** — daí a regra
  prática de manter o pin explícito e olhar o CHANGELOG antes de reescrever
  extração à mão. Ver `YoutubeGrab.kt`. Uma quarta exceção precisa do mesmo tipo
  de justificativa: um problema que não se resolve de outro jeito, e a conta da
  manutenção paga por quem publica a biblioteca.
- Toda operação IDB multi-passo que precise de atomicidade usa `storeTx()`.
- Ao mudar a superfície da ponte, subir `NativeBridge.SHELL_VERSION` **e**
  atualizar a seção "A ponte" acima.
- **O diagnóstico é UM só, e mora numa caixa que ROLA** (`#diagBox`, o
  "Registro" de Configurações). Um log em espaço fixo esconde o fim quando o
  texto cresce — e o fim é onde está o desfecho. Diagnóstico novo entra como
  mais um BLOCO ali, nunca como uma faixa nova em outro canto.
- **Todo campo de LOG nasce com um botão de copiar** (`.log-line`/`.log-copy`,
  ver `copiarTexto` em `controle.js`). Diagnóstico existe para ser REPASSADO, e
  sem o botão a alternativa é transcrever números à mão ou fotografar a tela —
  que foi exatamente o que aconteceu com a primeira versão do diagnóstico do
  YouTube. A confirmação é o mesmo pulso do resto do app.
- Cor nova entra em `assets/web/shared/tokens.css`, nunca literal na folha do
  app — e nunca branco pleno fora do palco (ver "A paleta").
- Ao atualizar o código, atualizar este `CLAUDE.md` se a mudança afetar
  arquitetura, protocolo de comandos ou a ponte. Mudanças dentro de
  `assets/web/` que afetem a arquitetura web vão em `docs/ARQUITETURA-WEB.md`.

### A versão mora em TRÊS lugares, e os três precisam andar juntos

| Onde | O quê | Para quê |
|---|---|---|
| `assets/web/version.json` | `"version"` | **é o que faz a atualização chegar aos aparelhos**: o OTA compara este campo (`compareVersions`) e ignora, em silêncio, um bundle cuja versão não for maior que a instalada |
| `assets/web/controle/controle.js` | `WEB_VERSION` | **é o que a UI de fato mostra**: `renderVersionLabel()` sobrescreve o span do rodapé de Configurações na carga |
| `assets/web/controle/index.html` | o texto do `<span id="appVersion">` | o que aparece antes do primeiro render — e a única versão visível num shell sem `appVersion()` |

Esquecer o `WEB_VERSION` é o erro silencioso: o OTA distribui o bundle novo, mas
o aparelho exibe a versão ANTIGA — e essa leitura é exatamente o que o indicador
existe para dar, inclusive para quem estiver diagnosticando remotamente se o OTA
chegou. Esquecer o `version.json` é o erro mudo do outro lado: nada chega a
aparelho nenhum.

O `versionCode`/`versionName` do APK vêm do CI (ver "Build") e não se tocam à
mão.

**Versão atual: v5.135** (base web) · `SHELL_VERSION` **30**, e o bundle segue com
`minShell: 2` — ele funciona igual num shell antigo, só sem os recursos que são
nativos por construção (a escada do voltar, os botões de volume, a notificação de
controles), que **só chegam instalando o APK novo**, não pelo OTA.

> **A transmissão direta exige o APK v1.55.** A v5.127 corrigiu o defeito que a
> mantinha quebrada desde a v5.120 — a faixa de bytes viajava no cabeçalho
> `Range` e o WebView aplicava o deslocamento uma segunda vez sobre a fatia (ver
> a invariante 8 e, em `docs/ARQUITETURA-WEB.md`, "A segunda requisição que
> morria — e o contrato que ninguém tinha lido"). **A correção é metade Kotlin:
> o OTA sozinho não a leva.** Num shell < 27 o bundle novo nem tenta transmitir
> e vai direto ao download — o que é melhor que o comportamento anterior, em que
> ele projetava uma cena que morria, abria a cortina sobre o preto e ainda pagava
> uma re-extração antes de baixar. O rodapé de Configurações passou a dizer por
> onde a faixa viaja, justamente para essa leitura não depender de adivinhação:
> `faixa na URL` (funcionando) × `DESLIGADA: shell N < 27`.
>
> **CONFIRMADO em aparelho** (S24 Ultra, Android 16, WebView 150): `Transmissão:
> MediaSource ok (avc1+aac) · faixa na URL` e `transmitindo 1080p
> (137@VISIONOS + 140@VISIONOS)` **sem nenhuma linha de falha atrás** — o vídeo
> entra no telão sem download. Três rodadas de APK (v1.52 → v1.54) foram gastas
> num diagnóstico plausível e errado; o que fechou o caso foi ler a fonte do
> Chromium em vez de deduzir por eliminação de mensagens que, como se descobriu,
> nem chegavam.
>
> A v5.128 tirou o resto que aparecia na estreia: o `<video>` fica segundos em
> cena sem um quadro (init + índice + primeiro fragmento vêm da rede) e o
> WebView pintava ali o **pôster padrão** dele — o retângulo cinza com o play
> preto gigante. O `stage` já escondia o elemento enquanto não houvesse `src`;
> com a transmissão, "sem `src`" virou "sem dados". Agora ele carrega um pôster
> 1×1 transparente enquanto espera (ver `POSTER_VAZIO` em `shared/stage.js`) e o
> devolve ao normal no primeiro quadro.
>
> E a v5.129 fechou o que estava embaixo do placeholder: **a transição de
> entrada existia pela metade.** A mídia velha esmaecia até o preto e a nova
> entrava no talo — invisível com arquivo local (o corte colava no fim do
> esmaecimento), gritante com a transmissão. `runFadeIn` espelha o `runFadeOut`
> que já existia, esperando o primeiro quadro e levando a rampa de volume junto.
> Ao escrever o teste apareceu o motivo de a cortina nunca ter coberto esse
> caso: **para um vídeo ela não esmaece** — `play()` chama
> `instantCover(computeCover())` e a arranca instantaneamente —, então o fade de
> conteúdo é a única transição de entrada que um vídeo tem. Detalhes em
> `docs/ARQUITETURA-WEB.md`.
