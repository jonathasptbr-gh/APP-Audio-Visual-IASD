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
6. [Divergências entre o caminho web e o nativo](#divergências-entre-o-caminho-web-e-o-nativo)
7. [Build e distribuição](#build-e-distribuição)
8. [Regras de desenvolvimento](#regras-de-desenvolvimento)

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
  keepAwake(bool),
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

---

## Build e distribuição

`.github/workflows/apk.yml` — o runner `ubuntu-latest` já traz JDK e Android
SDK; nenhuma infraestrutura externa.

| Rota | Como | Observação |
|---|---|---|
| Artifact | Actions → run → *Artifacts* | vem como **.zip**; precisa descompactar no celular |
| **Release** ⭐ | `git tag v1.0 && git push --tags` | **link direto para o .apk**; instala pelo Chrome do celular |

**Assinatura:** hoje o APK sai com a keystore de **debug** — imediato, mas a
chave muda entre runners, então o Android pode recusar atualizar por cima
(desinstale e reinstale). Para uso contínuo, migrar para release assinado com
keystore única em secrets (`KEYSTORE_B64`, `KEY_ALIAS`, `KEY_PASSWORD`) —
atualiza por cima sem desinstalar.

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
  (`#appVersion` em `assets/web/controle/index.html`) e o `versionCode`/
  `versionName` em `app/build.gradle.kts` quando o shell mudar.
  **Versão atual: v4.79** (base web) · **shell 1.0** (`SHELL_VERSION` 1).
