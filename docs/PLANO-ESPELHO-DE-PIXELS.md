# Espelho de pixels — o telão INTEGRAL no navegador da rede

> **Estado:** proposta. Nada implementado. Substitui a recomendação de
> [`PLANO-TELAO-NA-REDE.md`](PLANO-TELAO-NA-REDE.md) (que propunha um espelho *de comandos*, parcial e
> faseado) pelo pedido real do operador: **o conteúdo integral do Display, no primeiro release.**
> As seções daquele documento sobre **bootstrap do endereço**, **AP isolation**, **HTTP em claro** e
> **banda** continuam valendo palavra por palavra — nada aqui as melhora.
>
> Convenção de confiança: *(confirmado no código)* · *(conhecido da plataforma)* ·
> *(precisa de verificação em aparelho)*.

---

## 1. O método

**Renderizar o Display numa tela virtual privada nossa → codificar com `MediaCodec` (H.264) → mandar
as NALUs cruas por WebSocket → montar o contêiner fMP4 no cliente, em JavaScript → `MediaSource`.**

É o pipeline padrão de espelhamento Android→navegador (`scrcpy`/`ws-scrcpy` são a referência
pública). A novidade é a fonte: não é a tela do celular, é **uma tela que o app cria só para isso**.

```
 ┌──────────────────── celular ────────────────────┐     ┌──── navegador na LAN ────┐
 │  MirrorPresentation → o MESMO /web/display/     │     │                          │
 │         ↓ renderiza em                          │     │                          │
 │  VirtualDisplay PRIVADO ──Surface──→ MediaCodec ──WS──→ fmp4.js → MediaSource → <video>
 └─────────────────────────────────────────────────┘     └──────────────────────────┘
```

**A peça que faz isto valer a pena:** o cliente não reimplementa nada e o Kotlin não decide nada.
O telão de verdade roda no celular — com o `stage.js`, os fades, a cortina, a Camada de Texto, o
`mse.js` e até o embed do YouTube — e o que atravessa a rede são **pixels**. A invariante 5 sai
ilesa, e o espelho **não tem como ser parcial**: ele copia quadros, não sabe o que eles significam.

---

## 2. As três correções ao plano aprovado (e por que elas mudam o desenho)

### 2.1 WebCodecs **não existe** em `http://` — o cliente é MSE, não `VideoDecoder`

`VideoDecoder` é `[SecureContext]`: só existe em HTTPS ou `localhost`. Um telão da rede é servido em
`http://192.168.0.42:8787`, que **não** é contexto seguro — logo WebCodecs está fora, e a pergunta que
o operador respondeu ("Chrome/Edge atualizados → WebCodecs") tinha premissa errada. *(confirmado na
especificação do W3C; é o mesmo motivo pelo qual o `ws-scrcpy` só oferece WebCodecs rodando em
`localhost`.)*

`MediaSource` **não** é gated por contexto seguro. Então o caminho é: **montar o fMP4 no
JavaScript do cliente** e alimentar o `SourceBuffer` — exatamente o que o decodificador MSE do
`ws-scrcpy` faz.

**E isso é melhor, não pior.** O pedaço binário grande e delicado (~350 linhas de boxes
ISO/IEC 14496-12) sai do Kotlin e vai para `assets/web/`, que é o único lado deste projeto com:

- **oráculo determinístico em Node** — `tools/sidx.test.mjs` já constrói e parseia boxes byte a byte,
  sem `continue-on-error`;
- **OTA** — um erro de deslocamento no `trun` se conserta **sem publicar APK**.

O histórico aqui são três rodadas de APK por **uma** regra de contrato binário (a invariante 8). Daí
o corolário de projeto: **empurre toda fronteira binária que puder para o lado JS.** O que fica em
Kotlin é o framing do RFC 6455 (25 linhas de escrita, 60 de leitura com teto duro) e o laço do
`MediaCodec` — pequeno e de contrato estável.

### 2.2 O espelho é uma SEGUNDA instância de `/display/` no mesmo barramento broadcast

Este é o defeito que quebraria o culto, e o plano aprovado não o previa. Com dois `/display/` vivos:

| O que duplica | Consequência |
|---|---|
| `media-ended` | o Controle **pula uma faixa da playlist**, sem erro nenhum |
| `display-status` (4 Hz) | duas fontes com `currentTime` quase igual: a barra do Controle treme, o `snoopDisplayStatus` e a `SessionService` republicam em looping |
| `mic-status:{on:false}` | o espelho nega `getUserMedia` e **apaga o estado do microfone real** |
| `displayActive()` | passa a ser sempre verdadeiro sem TV, invertendo a fonte de verdade da UI do operador |

**O conserto é o dreno, e ele mora inteiro em `shared/native.js`** — que já é dono do `__AVBus` e já
roda antes do `db.js`. Fecha-se **nos dois caminhos, na fonte**: o `post` do `__AVBus` vira dreno
(o `recv` continua vivo, é por ele que os comandos chegam) **e** a propriedade `BroadcastChannel` é
apagada do global — zerar não basta, porque `db.js` pergunta `'BroadcastChannel' in global`.

`db.js`, `stage.js` e `display.js` **não mudam uma vírgula**: `channel = null` já é o caminho previsto
para o navegador. E o quinto candidato a duplicata — o `display-ready` — **já foi pago pela v5.140**
(`__de`/`__para` endereçado, travado por `tools/display-smoke.mjs`).

### 2.3 O filtro do display virtual é por `FLAG_PRIVATE`, nunca por id ou nome

O plano aprovado propunha filtrar pelo `displayId` conhecido. **Isso tem janela de corrida:**
`onDisplayAdded` chega na main thread para o display que acabamos de criar e pode chegar **antes** de
`createVirtualDisplay` retornar e o campo ser atribuído — e nesse instante `syncPresentation()` roda
com o filtro desarmado e **move a Presentation da TV para a tela virtual, no meio do culto**.

O predicado sem corrida é a propriedade estrutural: displays privados só são enumeráveis pelo UID que
os criou, e o único que este processo enxerga é o nosso. Um helper de cinco linhas
(`telasExternas()`, filtrando `Display.FLAG_PRIVATE`) alimenta **os dois** pontos que fazem a
pergunta — `syncPresentation` e `listDisplays`. Duas linhas trocadas.

E como `lastDisplays` tem **um único escritor** (`renderDisplayStatus`, alimentado por
`listDisplays()`), filtrar na fonte faz os outros oito pontos do mapa continuarem vendo exatamente o
que veem hoje. Hoje o helper é no-op verificável: sem espelho, não há display privado nenhum.

**Bônus:** o "terceiro conceito" que o plano anterior dizia ser preciso inventar ("há projeção, mas
não é uma TV") **já existe no código** — `castTestUnlocked`, com descritor marcado, cor âmbar em vez
do verde de conectado, e um comentário dizendo que "não finge conexão nenhuma". A UI do espelho no
modo simplificado é uma linha em `simpleDisplay()`.

---

## 3. As duas chaves do encoder que decidem "funciona" × "congela no culto"

```kotlin
setInteger(KEY_COLOR_FORMAT, COLOR_FormatSurface)
setInteger(KEY_BIT_RATE, 3_000_000)                    // 720p
setInteger(KEY_FRAME_RATE, 30)
setInteger(KEY_I_FRAME_INTERVAL, 2)                    // segundos
setInteger(KEY_REPEAT_PREVIOUS_FRAME_AFTER, 500_000)   // µs  ← a chave crítica
```

**`KEY_REPEAT_PREVIOUS_FRAME_AFTER` é sobre o caso COMUM, não sobre o raro.** Um `VirtualDisplay` só
produz buffer quando algum pixel muda — e o estado normal de um telão de igreja é **imagem parada**:
uma estrofe, um versículo, o cronômetro entre dois segundos. Sem essa chave o encoder fica minutos
sem emitir quadro, o `SourceBuffer` do cliente para de receber, o `<video>` stalla, o `currentTime`
congela, o Chromium solta a tela e **a tela do coral apaga**. Repetir o quadro anterior a cada 500 ms
dá um piso de 2 fps de P-frames quase vazios — custo desprezível.

**Densidade fixa em 160 dpi**, e é a linha que ninguém escreve certo na primeira vez: o viewport CSS
é `largura / density`. Passando o `densityDpi` do celular (420 num aparelho comum), o `/display/`
desenharia num viewport de **487 px** — layout de celular, letra gigante, wallpaper cortado, e só na
tela do coral. Com 160, 1 px CSS = 1 px físico, que é o que um dongle reporta e o que se vê no
Chromium. **Verificável sem aparelho** (viewport 1280×720 no `display-smoke.mjs`).

**Cliente novo:** o servidor guarda o último `csd` (SPS+PPS) e **não manda byte nenhum antes do
próximo IDR** (`PARAMETER_KEY_REQUEST_SYNC_FRAME` sob demanda). Mandar P-frames antes disso produz
lixo verde que ninguém liga à causa. **Cliente lento:** fila cheia → **esvaziar a fila inteira** e
voltar a esperar IDR (pisca uma vez e volta certo), nunca descartar quadro a quadro — isso degrada
para lixo permanente. `difundir()` usa `offer()`, não `put()`: um cliente lento jamais segura os
outros nem a thread de drenagem.

---

## 4. Áudio — o que a decisão do operador implica

O operador escolheu **com som, aceitando um diálogo por sessão**. Isso é viável e é a única via que o
Android oferece (`AudioPlaybackCapture`, API 29+, exige `MediaProjection` + `RECORD_AUDIO`, com
`addMatchingUid(Process.myUid())` para capturar só o próprio app). Duas consequências que precisam
estar ditas:

1. **O celular vai emitir o som.** Não existe "tocar em silêncio e capturar": a captura é do que o app
   **reproduz**. Sem TV conectada, hoje não há Display nenhum e o celular só emite som se a mesa de som
   estiver ligada — com o espelho, ele passa a emitir. Se o celular está na PA, é o que se quer; se
   não está, é som inesperado no salão. **Spike:** com o volume de mídia em zero, o PCM capturado
   ainda tem sinal? Se sim, existe "celular mudo, espelho com som" e o problema evapora.
2. **O cliente nasce MUDO, com um botão de som.** Os clientes estão dentro da igreja, a 100–300 ms da
   PA: três telas desmutadas são três alto-falantes com eco. Quem estiver em outra sala aperta o botão.

**Transporte do áudio: PCM 16 bits cru** (48 kHz mono ≈ 770 kbps, irrelevante ao lado dos 3 Mbps do
vídeo numa LAN). Elimina o encoder AAC no Kotlin, o `AudioSpecificConfig`, a segunda faixa no muxer e
a sincronia de duas linhas de tempo independentes. O `AudioRecord` já entrega PCM; o cliente empilha
num `AudioWorklet`.

---

## 5. Fases

### Fase 0 — o degrau de derrisco (build de debug, não vai a Release)

**VirtualDisplay privado + `MirrorPresentation` + `ImageReader` + JPEG + `multipart/x-mixed-replace`.**
Um `<img>` no cliente: zero muxer, zero WebSocket, zero `MediaCodec`. ~250 linhas, das quais ~80
sobrevivem como o **fallback MJPEG permanente**.

Responde numa tarde, com um quarto do código, as perguntas que decidem tudo:

| # | Pergunta | Como | O que decide |
|---|---|---|---|
| **R0** | O roteador da igreja tem **AP isolation**? | Dois aparelhos na mesma SSID, um servindo uma porta | 5 min, e **mata qualquer variante** deste recurso sem nenhum sinal do lado do servidor |
| **R1** | O `<video>` decodificado por hardware **aparece no readback, ou sai retângulo preto**? | Projetar em sequência e salvar PNG: (a) wallpaper · (b) imagem · (c) versículo · (d) vídeo do OPFS · (e) blob do IndexedDB · **(f) transmissão direta pelo `mse.js`** · (g) embed do YouTube. Não-preto em (a)–(c) e preto em (d)–(g) é a assinatura exata da falha | **Preto ⇒ o espelho de pixels morre** e a conversa volta ao espelho de comandos. O caso (f) é o que ninguém pensa em testar e é o mais importante |
| **R2** | O segundo `/display/` **fala no barramento**? | Playlist de três faixas curtas rodando com o espelho de pé | **Se pular faixa, é o `media-ended` dobrado** (§2.2). Com o dreno, o comportamento tem de ser idêntico ao de hoje |
| **R3** | Volume de mídia em zero ainda captura PCM? | §4 | Decide se existe "celular mudo, espelho com som" |
| **R4** | Quantos encoders/decoders o SoC aguenta? | Com Miracast ligado e vídeo tocando, tentar subir o encoder e **contar frame drops olhando a TV** | Decide se o espelho degrada de resolução com TV ou recusa ligar |
| **R5** | A tela do cliente apaga? | Tablet e notebook, 15 min sem toque, cronometrado | `wakeLock` não existe em `http://`; a hipótese é que um `<video>` tocando segure a tela |

**Prognóstico do R1**, para calibrar expectativa: num display **virtual** não há overlay de hardware
nem plano de DPU, então o SurfaceFlinger é obrigado a compor por GPU — e composição por GPU inclui as
camadas de vídeo. As exceções conhecidas são buffer protegido (Widevine L1) e `FLAG_SECURE`, e **nem
um nem outro existe neste app**. *(conhecido da plataforma, confiança média-alta — mas medir custa
uma tarde e supor custou três rodadas de APK da última vez.)*

### Fase 1 — o espelho (a entrega)

`MediaCodec` + WebSocket + muxer fMP4 no cliente + pareamento por PIN + a UI. Tudo o que o telão
pinta chega ao navegador. **Uma Release · `SHELL_VERSION` 31 → 32 · `version.json` 5.141 com
`minShell` ficando em 2.**

### Fase 2 — áudio

`MediaProjection` + `AudioRecord` (PCM) + `AudioWorklet`, com o FGS tipo `mediaProjection`
(obrigatório no Android 14+) e o cliente nascendo mudo.

---

## 6. O que nasce e o que muda

**Kotlin novo:** `EspelhoDisplay.kt` (VirtualDisplay + MediaCodec + drenagem em thread própria + `csd`
guardado + IDR sob demanda, 280–350) · `EspelhoServidor.kt` (ServerSocket, HTTP de 5 rotas sem `Range`
e sem keep-alive, upgrade + framing RFC 6455, fan-out com fila limitada, pareamento por PIN, 390–550) ·
`MirrorPresentation.kt` (irmã de `StagePresentation`: **sem `MicChromeClient`**, `keepVisible`,
`role="espelho"`, 90–120) · `EspelhoService.kt` (FGS `connectedDevice` — **sem a cota de 6 h do
`dataSync`** —, 120–160). Fase 2 acrescenta `EspelhoAudio.kt`.

**Kotlin alterado:** `MainActivity.kt` (~70 — `telasExternas()` e as duas chamadas, os métodos do
`BridgeHost`, o desligamento no `onDestroy`) · `NativeBridge.kt` (~90 — cinco métodos guardados por
`host != null`, **todos na fila de IO**; `SHELL_VERSION` 32) · `WebPathHandler.kt` (~2 — `internal`,
para o servidor reusar a resolução OTA→APK e a tabela MIME) · `AndroidManifest.xml` (~8).

**JS novo (`assets/web/espelho/`):** `fmp4.js` (~350) · `espelho.js` (~250: WebSocket, fila de append
serializada — `appendBuffer` concorrente lança `InvalidStateError` —, poda do passado pela cota do
MSE, reconexão com backoff, queda para MJPEG) · a página de pareamento **anônima** e o CSS (~200).

**JS alterado:** `shared/native.js` (~60 — o dreno + os cinco métodos **remontados campo a campo**,
com `tools/ponte.test.mjs` na mesma entrega) · `display/display.js` (**~6** — `forceMuted` por papel) ·
`controle/controle.js` (~250 — a linha em Configurações, o bottom-sheet **na tabela `POPUPS`**, o bloco
novo no `#diagBox` com botão de copiar, `simpleDisplay()` reconhecendo rede) · `controle/index.html`
(~60) · os três lugares de versão.

**Intocados:** `shared/db.js`, `shared/stage.js`, `shared/mse.js`, `display/display.css`,
`shared/tokens.css`, `WebViewFactory.kt`, `StagePresentation.kt`, `MessageBus.kt` — o motor de
renderização inteiro **e o Display de verdade**.

**Testes:** `tools/fmp4.test.mjs` (~180, oráculo em Node puro, boxes byte a byte, **sem
`continue-on-error`**, no molde do `sidx.test.mjs`) · `tools/espelho-ws.test.mjs` (~150, servidor WS em
Node alimentando o cliente num Chromium com NALUs gravadas) · `ponte.test.mjs` +40 ·
`display-smoke.mjs` +5 (o viewport 720p, que trava o layout em 1280×720 sem aparelho).

---

## 7. O preço, dito sem maquiagem

1. **Dois renders com TV conectada.** A `Presentation` da TV não pode ser reaproveitada e ler o
   framebuffer do display do Miracast exige permissão de assinatura. Com TV: 2 WebViews de `/display/`,
   3 `<video>` do mesmo arquivo, **3 `YT.Player`** e 2 encodes. O terceiro `YT.Player` é literalmente o
   problema que a `Presentation` foi criada para matar, voltando pela porta dos fundos. Por isso o
   operador escolheu **espelho só quando não há TV** — e é a escolha certa até o R4 dizer o contrário.
2. **Instâncias de decoder de hardware.** Um SoC de faixa média expõe 2–4 decoders AVC concorrentes;
   estourado, o Chromium cai para software **em silêncio**, e o que degrada pode ser **a TV**. Medível
   (R4). O encoder, ao contrário, falha **ruidosamente** — `configure` lança, e aí o espelho recusa
   ligar com a frase certa no Registro em vez de degradar calado.
3. **Sem oráculo para o framing do WebSocket.** Este repositório não tem `app/src/test` e o CI não
   executa uma linha de Kotlin. Contrapeso: o framer de escrita são 25 linhas com três casos; o de
   leitura tem teto duro de 4 kB e fecha com 1002 o que não couber. O que é grande e delicado — o
   muxer — está em JS, com oráculo e com OTA.
4. **Bootstrap, HTTP em claro, AP isolation e a tela que apaga** continuam exatamente como no
   documento anterior. O que passa legível na rede deixou de ser JSON de cena e passou a ser **a
   imagem do telão** — o pareamento é uma fechadura numa parede de vidro.
5. **Teto rígido de 3 clientes**, com o quarto recebendo uma frase. O celular é **cliente** do AP:
   cada byte cruza o ar duas vezes, e o *airtime fairness* de um cliente ruim derruba todo mundo.
