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
│   ├── controle/                #   (sem sw.js — ver "Divergências")
│   └── display/                 #   (sem sw.js)
├── java/br/org/iasd/av/
│   ├── MainActivity.kt          # Activity + WebView do Controle + Presentation
│   ├── StagePresentation.kt     # Presentation + WebView do Display (o telão)
│   ├── WebViewFactory.kt        # asset loader + settings comuns (invariantes)
│   ├── NativeBridge.kt          # @JavascriptInterface — a ponte
│   ├── SafPathHandler.kt        # serve arquivos do dispositivo em /saf/<token>
│   ├── ShareIntake.kt           # intent ACTION_SEND → formato do share web
│   ├── SyncService.kt           # foreground service: downloads com o app minimizado
│   ├── WebUpdater.kt            # OTA da base web (watchdog, minShell, sha256)
│   ├── WebPathHandler.kt        # serve o bundle OTA, com fallback pro APK
│   └── MessageBus.kt            # relay de comandos entre os dois WebViews
└── res/                         # ícones (rasterizados dos SVGs do PWA), tema
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
`display-ready` — e o Controle já reenvia o estado atual ao receber isso
(comportamento que existe desde o PWA). Não invente um mecanismo paralelo.

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
  keepAwake(bool),     // tela não apaga durante o culto
  keepAlive(bool),     // download em curso — ver "Trabalho em segundo plano"
}
```

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
   telão jamais recarrega ao vivo.
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
| "Abrir Display" | `window.open('../display/')` | **indicador de telão conectado** — a Presentation é criada sozinha |
| Fullscreen da preview | `requestFullscreen` + Screen Orientation API | idem, com trava de paisagem **nativa** (`onShowCustomView`) |
| Botão voltar | — | manda a tarefa para segundo plano (sair por engano derrubaria a projeção) |
| Download com o app minimizado | a aba continua baixando | **foreground service + wake lock** — sem isso o processo é congelado (ver seção acima) |
| Atualização da base web | service worker (cache-first + reload) | **OTA** — bundle publicado em `web-latest`, aplicado no próximo lançamento (ver seção acima) |

---

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android
SDK; nenhuma infraestrutura externa.

| Rota | Como | Observação |
|---|---|---|
| Artifact | Actions → run → *Artifacts* | vem como **.zip**; precisa descompactar no celular |
| **Release** ⭐ | `git tag v1.0 && git push --tags` | **link direto para o .apk**; instala pelo Chrome do celular |

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
  **Versão atual: v4.86** (base web) · **shell 1.3** (`SHELL_VERSION` 3).
