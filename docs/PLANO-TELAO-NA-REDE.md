# Telão na rede local — análise e plano

> **Estado:** proposta. Nada disto está implementado. O documento existe para decidir **se** e **em que ordem**, não para descrever o que existe.
> **Base de código lida:** `main`, base web v5.139, `SHELL_VERSION` 31, 7.612 linhas de Kotlin (`wc -l app/src/main/java/br/org/iasd/av/*.kt`, medido agora).
> **Convenção de confiança usada no texto inteiro:** *(confirmado no código)* — li o arquivo e cito a linha · *(conhecido da plataforma)* — comportamento documentado de Android/Chromium, com o grau de confiança dito · *(precisa de verificação em aparelho)* — não afirmo, e a §9 diz qual experimento responde.

---

## Índice

1. [O que se quer, e o que isso realmente significa](#1-o-que-se-quer-e-o-que-isso-realmente-significa)
2. [Veredito em uma página](#2-veredito-em-uma-página)
3. [O que o sistema já dá de graça](#3-o-que-o-sistema-já-dá-de-graça)
4. [As três arquiteturas avaliadas](#4-as-três-arquiteturas-avaliadas)
5. [O caminho recomendado, em fases](#5-o-caminho-recomendado-em-fases)
6. [O caminho dos bytes da mídia — o crux](#6-o-caminho-dos-bytes-da-mídia--o-crux)
7. [Pareamento, bootstrap e segurança](#7-pareamento-bootstrap-e-segurança)
8. [Modos de falha e o que o operador vê](#8-modos-de-falha-e-o-que-o-operador-vê)
9. [Spikes de derrisco, em ordem](#9-spikes-de-derrisco-em-ordem)
10. [O que NÃO fazer, e por quê](#10-o-que-não-fazer-e-por-quê)
11. [Impacto na documentação existente](#11-impacto-na-documentação-existente)

---

## 1. O que se quer, e o que isso realmente significa

O pedido, textual: *"transmitir o Display não só para uma tela conectada via Presentation, mas também para um NAVEGADOR de quem estiver na mesma rede local. Só entrar no site, ele mostra um QR code, eu escaneio com o celular e ele conecta aquela tela."*

Traduzindo para o que o sistema precisa fazer, são **quatro problemas independentes**, e eles têm dificuldades muito diferentes. Misturá-los é o que faz a conversa toda parecer um recurso só.

| # | Problema | Dificuldade real |
|---|---|---|
| **A** | **Bootstrap:** como o navegador da outra tela **chega** ao endereço do celular | O que a frase "só entrar no site" esconde. **Não tem solução elegante.** §7 |
| **B** | **Pareamento:** como aquela tela é autorizada depois de chegar | Fácil, e a UX imaginada está invertida. §7 |
| **C** | **Comandos:** como a cena (letra, versículo, cronômetro, cortina) chega à tela | **Quase de graça** — o sistema já é feito disso. §3, §5 |
| **D** | **Bytes:** como a mídia (imagem, apresentação, vídeo, áudio) chega à tela | **O crux.** É onde o projeto inteiro trava. §6 |

### 1.1 O que "só entrar no site" esconde

**O QR que a tela mostra não resolve o endereço — ele resolve a autorização.** Para a tela *desenhar* um QR, o navegador dela já precisa ter carregado uma página; ou seja, **já precisa saber o endereço**. É o padrão do YouTube na TV, e ele só funciona porque `youtube.com/tv` é um nome público, memorizado, servido pela internet.

Aqui esse nome não existe. O endereço é `http://192.168.0.42:8787`, que:

- não tem DNS;
- não pode ser servido por uma página pública que busque o IP privado — isso morre em **três barreiras independentes, cada uma bastando sozinha**: mixed content (`https://` buscando `http://`), Local Network Access (o Chromium passou a exigir permissão para requisições de contexto público a endereço local, e a política muda por versão do WebView, que se atualiza **fora do ciclo de APK deste projeto**), e a impossibilidade de obter certificado válido para IP privado — nenhuma CA pública emite. *(conhecido da plataforma, confiança alta)*
- não é resolvível por `.local`/mDNS nos aparelhos alvo: **o Android não tem resolvedor mDNS para `getaddrinfo`**, então o Chrome do celular do irmão não abre `culto.local` — e o celular é justamente quem escanearia o QR. *(conhecido da plataforma, confiança média-alta — spike nº 4)*

**Conclusão que precisa estar dita ao operador antes de qualquer código:** para uma TV, um projetor ou um notebook fixo, **alguém digita o endereço uma vez** e favorita. Com reserva de DHCP no roteador e uma etiqueta colada no rack. É feio, e é o que funciona. Para quem tem **celular**, o QR funciona — mas na direção invertida: o QR aparece **no Controle**, e o visitante usa a câmera nativa dele. §7 detalha.

### 1.2 O que "a tela mostra o Display" significa tecnicamente

O telão pinta **seis camadas** (`display/index.html:28-64`): `#wallpaper`, `#img`, `#video`, `#lyrics`, `#text`, `#youtube`. Cinco delas são **DOM**; uma é vídeo; a última é um **iframe cross-origin**.

Isso decide a arquitetura antes de qualquer discussão: **quem quiser "a TV no navegador" tem de aceitar que o navegador REDESENHA o que é DOM**, porque não há como capturar DOM em Android (não existe `getDisplayMedia` no WebView nem no Chrome para Android — *conhecido da plataforma, confiança alta*). E isso não é concessão: **a base web já roda em navegador por requisito** — é assim que se desenvolve e se testa. O cliente não precisa de um renderizador novo; ele precisa do `display.js` que já existe.

---

## 2. Veredito em uma página

**É possível. É útil. E o pedaço útil é muito mais barato do que o pedaço completo.**

**Caminho recomendado:** *espelho de comandos com cena por instantâneo*. O celular sobe um servidor HTTP mínimo em Kotlin puro (`java.net.ServerSocket`, **zero dependência nova**); o navegador da LAN carrega **o `/web/display/` de verdade**, servido a partir do mesmo bundle que o celular está rodando; a cena viaja como **JSON pelos comandos que já existem**, por SSE; e o cliente redesenha. O Kotlin transporta e pareia — **não decide semântica de culto** (invariante 5), **não lê o acervo**, e **não serve arquivo nenhum** na primeira fase.

**Esforço, em fases (cada uma entrega valor sozinha):**

| Fase | O que o operador ganha | Custo | Chega por |
|---|---|---|---|
| **0** | nada — mede o que decide tudo | 1 dia, 6 experimentos | — |
| **1** | segunda tela com **versículo, mensagem, cronômetro, sorteio, letra sincronizada, cortina, fades** | ~900–1.200 linhas Kotlin · ~700 JS · 1 Release | **APK** (`SHELL_VERSION` 31→32) |
| **2** | **imagem e página de apresentação** naquela tela | ~350 Kotlin · ~200 JS | **APK** |
| **3** | **vídeo e áudio** — e só quando **não há TV conectada** | ~400 Kotlin · ~150 JS | **APK** |

**Risco, honesto e em ordem:**

1. **Isolamento de clientes (AP isolation) no roteador da igreja.** Se estiver ligado, tráfego estação-a-estação é bloqueado na camada 2 e **o recurso inteiro é impossível** — servidor de pé, porta escutando, IP certo, e o SYN nem chega, **sem nenhum sinal do lado do servidor**. Não tem contorno pelo lado do app. É o spike nº 1 e custa cinco minutos.
2. **O acervo é invisível ao Kotlin** (OPFS/IndexedDB dentro do perfil do WebView). Isso não é limitação a contornar: é o que define o faseamento. §6.
3. **Um parser HTTP escrito à mão é o primeiro código deste projeto a aceitar entrada de um desconhecido.** Todos os pontos de entrada de hoje são locais. Exige teto de linha, teto de cabeçalhos, timeout, validação de `Host`, e um oráculo em `tools/` no formato determinístico e sem `continue-on-error` do `webview-range.test.mjs`.
4. **Contenção de rádio com o Miracast** (só nas fases 2 e 3, e só com TV conectada). O telão chega à TV por espelhamento, que é Wi-Fi Direct **no mesmo rádio** da associação ao AP. Servir megabytes pela LAN compete com o link que leva a projeção à TV, e a degradação seria **intermitente** — o pior modo de falha possível num culto. É a razão de a fase 3 nascer com a regra "vídeo só sem TV".

**O que foi descartado, nominalmente:** espelho de pixels (`VirtualDisplay` + `MediaCodec`), WebRTC como caminho principal, servidor de arquivos genérico por id, base64 pela ponte, leitura do `app_webview/` por trás do Chromium, e a página pública que busca o IP privado. §10 diz por quê, uma a uma, para ninguém tentar de novo daqui a seis meses.

**A frase para o operador:** dá para ter, com uma Release, uma segunda tela no navegador mostrando **a letra do hino, o versículo, a mensagem e o cronômetro**, ao vivo, sem tocar em nada do que já projeta. **Vídeo naquela tela é outro projeto**, mais caro, e ele precisa de uma medição na rede da igreja antes de valer a pena ser começado.

---

## 3. O que o sistema já dá de graça

Esta seção é o argumento inteiro do plano. Nada aqui é otimismo: cada linha foi lida.

### 3.1 O barramento já fala com um "bus" genérico

`shared/db.js:800-801`:

```js
const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;
const bus = global.__AVBus || null;
```

`sendCommand` usa `bus.post(msg)` (`:842`) e `onCommand` usa `bus.recv(deliverCommand)` (`:883`). **Um objeto de dois métodos publicado em `window.__AVBus` antes de `db.js` é adotado sem uma linha de mudança em `db.js`.** O relay nativo foi escrito para o `MessageBus` do Kotlin (`shared/native.js:246`) e saiu genérico por acidente feliz. *(confirmado no código)*

E a armadilha que estava latente ali **já foi fechada**: `cmdHandlers` (`db.js:860-884`) suporta **múltiplos `onCommand` na mesma página**, com o `alreadySeen` deduplicando **por mensagem**, não por listener — o próprio comentário do arquivo diz que a armadilha "seria descoberta tarde, por quem só quisesse observar `display-status` num módulo novo". É exatamente este recurso. *(confirmado no código)*

### 3.2 Todo comando já passa por um ponto único em Kotlin

`NativeBridge.kt:230-234`:

```kotlin
@JavascriptInterface
fun busPost(json: String) {
    MessageBus.post(webRef(), json)
    snoopDisplayStatus(json)
}
```

O shell **já vê a cena inteira passando**, e já lê de passagem (o `snoopDisplayStatus` que mantém a notificação em dia). Um observador a mais é o mesmo padrão, no mesmo ponto — **com uma ressalva que a §5 trata como requisito de código, não como detalhe**: `busPost` é o único `@JavascriptInterface` do arquivo que **não** empurra para a fila de IO (`Executors.newSingleThreadExecutor`, `NativeBridge.kt:113`, usado em `:173, :223, :494, :537, :559, :610, :632`), e pode não empurrar porque hoje só faz um `JSONObject` e dois campos. **Escrita de socket ali é síncrona do ponto de vista do JS e trava o telão.** *(confirmado no código)*

### 3.3 O gate de autoplay já existe, vivo, e paga integralmente

`display/display.js:1500`:

```js
if (window.__NATIVE__) startBtnEl.hidden = true;
```

Num cliente LAN `__NATIVE__` é `undefined` → **o overlay "Ligar Sistema" aparece exatamente como foi projetado**. E com ele vem, sem uma linha de trabalho:

- o `pointerdown` que borbulha para `onUserGesture` e desmuta o palco;
- a **ativação pegajosa** para o iframe do YouTube pelo resto da sessão;
- e a rede de segurança inteira: `onBlocked` (`display.js:87-107`) é guardado por `if (window.__NATIVE__) return`, ou seja, **roda no cliente**: muta, continua tocando (vídeo sem som em vez de tela preta) e arma a recuperação, que religa o áudio sozinha.

É a única parte do sistema em que o caminho de navegador foi mantido vivo **de propósito**, e ela é justamente a que este recurso precisa. *(confirmado no código)*

### 3.4 A Camada de Texto não toca o banco

`showText(cmd)` (`display.js:395-432`) lê **apenas campos do comando**: `mode`, `view`, `main`, `sub`, `chrono`, `draw`. Zero acesso a IndexedDB, zero acesso a OPFS. **Roda verbatim num navegador, sem adaptador nenhum.** Isso é versículo, mensagem, cronômetro, timer e sorteio — o grosso da fase 1. *(confirmado no código)*

### 3.5 Cronômetro e sorteio já são funções puras do relógio

`chronoReading(c, now)` (`stage.js:1006`) e `drawReading(d, now)` (`stage.js:1053`) **recebem o `now` por parâmetro**, e o único chamador que o fixa em `Date.now()` é `liveReading` (`display.js:348-352`). Uma tela que entre no meio da contagem cai **no mesmo quadro das demais**, sem transferência de estado e sem tráfego durante a contagem — o comentário de `stage.js:1057-1059` literalmente descreve este caso de uso.

O risco espelhado: o relógio é o **da máquina do cliente**. Um notebook 40 s adiantado mostra o timer 40 s à frente, em silêncio. O conserto é **uma linha**, porque o parâmetro já existe: carimbar cada quadro SSE com o `Date.now()` do celular, o cliente manter um `offset`, e `liveReading` passar `Date.now() + offset`. *(confirmado no código)*

### 3.6 A letra sincronizada tem um ponto de injeção limpo

`display.js:310` é `function updateLyricSlide(t)`, e `findSlideIndex` (`stage.js:104-110`, exposto em `display.js:147`) é função pura de `(lyrics, time)`. O único chamador em regime é o funil `sendStatus` (`display.js:66`):

```js
if (!stage.hasEnded()) updateLyricSlide(stage.isTimed() ? stage.getTime() : 0);
```

**Ou seja: para a letra avançar num cliente que não tem os bytes, basta chamar `updateLyricSlide(t)` com o `currentTime` que o telão já emite a 4 Hz.** Nenhuma mídia falsa, nenhum relógio inventado, nenhum WAV silencioso. É a diferença entre um truque e um encaixe. *(confirmado no código)*

### 3.7 O resto que se reusa sem escrever nada

- **`WebPathHandler.kt:21-27`** já resolve a base web **OTA→APK por arquivo**. O servidor precisa servir **os bytes que o celular está rodando**, não os do APK — e a função que faz isso já existe, junto com a tabela MIME (`:43-68`). *(confirmado no código)*
- **O padrão de token opaco**: 128 bits, `SecureRandom`, base64url, reaproveitado por recurso (`SafPathHandler.kt:62-68`). É o modelo de autorização do servidor LAN.
- **As sete lições de ciclo de vida** de `SyncService`/`SessionService` (`startForeground` sempre antes de qualquer decisão de parar; três flags distintas; `stopSelf(startId)`; `stopService` só com `foregrounded`; a guarda de `running` depois do salto de thread; cancelar a notificação no `onDestroy`; e o `onGone` que faz o Kotlin **esquecer** que estava protegendo). Nenhuma precisa ser redescoberta.
- **`INTERNET` e `ACCESS_NETWORK_STATE` já estão declaradas** (`AndroidManifest.xml:6-7`). `INTERNET` governa a criação de sockets, **não a direção do tráfego — não existe permissão de "escutar"**; e `ACCESS_NETWORK_STATE` já basta para descobrir o IPv4 pelo caminho moderno (`ConnectivityManager` → `LinkProperties`), que é o que `WebUpdater.kt:427` já usa. **Nenhuma permissão nova na fase 1.** *(conhecido da plataforma, confiança alta)*
- **O `mediaPlayback` já declarado** (`AndroidManifest.xml:27`) evita inventar um FGS — e, em particular, evita o `dataSync`, que com `targetSdk` 35 tem teto de **6 h acumuladas em 24 h** e cujo `onTimeout` (`SyncService.kt:139-148`) existe justamente porque esse acumulado "não é hipotético".

### 3.8 E a dívida que precisa ser paga antes de tudo

**Nenhum teste deste repositório jamais carregou `/display/`.** Medido: `tools/smoke.mjs:92` vai em `/controle/`; `acervo.test.mjs:61` em `/controle/`; `mse.test.mjs:64` em `/`; `db-gc.test.mjs:47` num HTML sintético em `http://av.local/`; `ponte.test.mjs:63` em `about:blank`. O que a CI garante do Display é `node --check` e mais nada — **a mesma classe de garantia que a v5.121 furou** (botão chamando função apagada, sintaxe perfeita, CI verde).

Este plano inteiro aposta que o Display roda num navegador. Um smoke do `/display/` custa ~10 linhas, **deveria existir independentemente deste recurso**, e é pré-requisito de higiene da fase 1.

---

## 4. As três arquiteturas avaliadas

Três desenhos foram feitos de forma independente e cada um passou por um crítico adversarial. Nenhum sobreviveu inteiro; dois contribuíram peças ao plano final.

### 4.1 Espelho de COMANDOS — cliente magro que re-renderiza

**A ideia.** O cliente não recebe pixels nem arquivos: recebe **os mesmos comandos JSON que o telão já recebe** e roda **o mesmo `display.js`**. Um shim publica `window.__AVBus` sobre SSE, um adaptador substitui as seis funções de `AVDB` que o Display consome, e o resto do bundle vai sem uma vírgula de mudança.

**Por que é a certa.** É a única que respeita a invariante 5 no seu caso mais forte — não se reimplementa o telão, usa-se o telão. Do lado do Display são **6 dos 8 arquivos servidos sem modificação** (151.098 de 268.121 bytes), incluindo o motor de renderização inteiro. E, crucialmente, **nada sobe do cliente**: o `post` do `__AVBus` do cliente é um dreno, o que mata por construção três defeitos que um cliente falante causaria — `display-status` concorrente fazendo a barra do Controle tremer entre duas fontes e a `SessionService.updateFromDisplay` republicar em looping (`NativeBridge.kt:256-267`), `media-ended` duplicado **pulando uma faixa** (`controle.js:13141-13156`), e `mic-status:{on:false}` **apagando o estado do microfone real** (`display.js:519` → `controle.js:13109-13114`). E o pior comando do barramento — `mic:true`, que abre o microfone do telão na caixa de som do templo (`display.js:1316`) — simplesmente não tem caminho de volta. Não há guarda a esquecer.

**O golpe do crítico, e ele é fatal para o desenho como estava escrito.** **O barramento carrega um PONTEIRO, não a cena.** O comando `load` é `{type, mediaId, view, muted, volume, page}` (`controle.js:6307`, confirmado); o Display faz `AVDB.getMedia(cmd.mediaId)` (`display.js:1371`) e de novo dentro de `stage.js:615`; e o que o v1 vende — a letra do hino para o coral — depende de `rec.lyrics`, `rec.hymnName`, `rec.hymnTrack` (`display.js:184-201`), que moram no registro do catálogo, **dentro do IndexedDB do WebView**. Um cache de comandos em Kotlin vê passar `{"type":"load","mediaId":"a7f3…"}` e **não tem como saber que aquilo é o hino 214 com 38 slides de letra**. O cliente faria `getMedia` contra um IndexedDB vazio e receberia `undefined` → `clear()` → wallpaper permanente, **sem erro nenhum**.

Somam-se: o cache "de tipos pegajosos" em Kotlin era, na prática, uma reimplementação de `resendSceneToDisplay` (`controle.js:13011-13072`) já nascida com menos regras que o original; a proposta de travá-lo com um teste que varre `sendCommand({ type: '` **encontraria 6 tipos de ~20**, porque quase todo comando de operação sai por `cmd(obj)`; o replay pós-reconexão seria **comido pela deduplicação** (`db.js:868`, `MID_LIMIT = 400`) justamente nas reconexões rápidas, que são o caso que o SSE existe para cobrir; e o relógio da letra dependia de um `rec.duration` que **não existe** — o campo é `seconds`, e é nulo para todo hino de coleção (`db.js` `makeMediaRecord`, confirmado agora).

**Veredito:** arquitetura certa, desenho errado. **O conserto é uma peça, e ela existe:** a cena precisa viajar **inteira**, montada em JS, em vez de ser reconstruída em Kotlin a partir de ponteiros. É o que a §5 chama de *instantâneo*.

### 4.2 Espelho de PIXELS — display virtual + codec

**A ideia.** `DisplayManager.createVirtualDisplay` com `OWN_CONTENT_ONLY|PRESENTATION`, uma `StagePresentation` hospedada nele, e o framebuffer saindo como JPEG (v1) ou H.264 (v2) para o navegador. O cliente é um `<img>` de 40 linhas.

**O que ela tem de melhor, e nenhuma outra tem.** **Nenhum byte do acervo atravessa a rede** e o problema do OPFS invisível ao Kotlin *não existe* — o `<video>` decodifica do OPFS como sempre, e o que sai é framebuffer, num bitrate escolhido. **Um só relógio** em todo o sistema (não há `startAt` em epoch para um notebook desalinhado errar). **Um cliente que entra no minuto 47 recebe um quadro que já é a cena inteira** — sem `display-ready`, sem handshake de versão, sem `__mid`, sem replay ordenado. E é a única que espelharia até o **embed do YouTube**.

**O que o crítico derrubou.** A linha de corte estava no lugar errado. O caso "sem TV", vendido como custando **zero linha de web**, custa pelo menos quatro coisas:

- **O áudio sai duplicado, na caixa de som do templo.** O áudio de um WebView não segue a janela para o display em que ela está: vai para a saída ativa do sistema. Hoje, sem TV, **não existe Display nenhum** e o celular só emite som se o operador ligar a mesa de som (`standalone` começa **falso** e não é persistido, `controle.js:985`, "evitando som inesperado saindo do celular numa sessão nova"). O espelho cria um Display que **toca**, e ele soma com a preview — que é `forceMuted: true` (`controle.js:993-994`) só porque hoje é a única fonte. *(mecanismo conhecido da plataforma; comportamento exato precisa de verificação)*
- **Dois players do YouTube voltam.** A preview do Controle **é um `YT.Player` real** (`controle.js:1022-1024`, confirmado). Hoje, sem TV, há um. Com o espelho, dois — que é literalmente o problema que a `Presentation` foi criada para matar.
- **Ligar o espelho INVERTE a fonte de verdade da UI do operador.** `displayActive()` (`controle.js:1178-1180`) é "recebi `display-status` há menos de 2,5 s"; hoje sem TV é sempre falso. Com o espelho passa a ser sempre verdadeiro, e `previewTick`, `onEnded` da preview, o caminho do YouTube e o `sairDasCamadas` mudam de comportamento **num caminho de código que só foi exercitado com TV conectada**.
- **A exclusão do display virtual de `getDisplays(DISPLAY_CATEGORY_PRESENTATION)` — obrigatória, senão `syncPresentation` (`MainActivity.kt:530`) move a `Presentation` da TV para a tela virtual no meio do culto — TRANCA o modo padrão do app**: `simpleDisplay()` lê `lastDisplays[0]`, alimentado por `listDisplays()` (`MainActivity.kt:679-694`), e `renderSimpleGate()` (`controle.js:12233-12240`) põe a cortina embaçada sobre tudo quando ele é nulo. As duas decisões são obrigatórias e incompatíveis; conciliá-las exige um **terceiro conceito** ("há projeção, mas não é uma TV") atravessando cinco funções do lado web.

Some-se o v2: `MediaMuxer` **não é muxer de streaming** — `MuxMp4.kt:115-118` diz isso por escrito ("sem ele o arquivo existe, tem tamanho e NÃO ABRE") —, então seria escrever fMP4 à mão, 400–600 linhas de boxes binários **num repositório que não tem `app/src/test`** (confirmado: `app/src` só tem `main`), cujo modo de falha é "o vídeo não toca", sem mensagem, e cujo precedente histórico é três rodadas de APK por **uma** regra de contrato binário. E o áudio exigiria `MediaProjection` — diálogo de consentimento **por sessão**, antes de projetar, num culto.

**Veredito:** descartada. Fica registrada uma incerteza que a mata sozinha se um dia for reconsiderada: **se o readback de um display virtual traz o `<video>` decodificado por hardware ou um retângulo preto** — em Android o decoder entrega a um `Surface` e o Chromium promove o vídeo a camada dedicada quando pode. *(precisa de verificação em aparelho)*

### 4.3 HÍBRIDO WebRTC — fluxo do `<video>` + comandos

**A ideia.** O WebView do telão vira um par WebRTC: `videoEl.captureStream()` entrega áudio e vídeo já sincronizados pelo RTP, enquanto letra, texto e cronômetro viajam como comandos. `RTCDataChannel` binário carrega imagens e páginas de deck — **o WebView pode ler o OPFS, o Kotlin não pode, e aqui é o WebView que entrega**.

**O que ela tem de melhor.** É a única em que **o Kotlin nunca vira um servidor de mídia**: não há `Range` a implementar, não há cópia dobrada em disco, não há base64 pela ponte. Um vídeo de 2 GB não é caso especial — o tamanho do arquivo não aparece em lugar nenhum do caminho, e o que viaja são ~30–90 MB adaptativos começando em ~1 s. E ela trouxe o **achado mais valioso de toda a rodada**, que vale independentemente de LAN: `display-ready` **não tem destinatário** (`display.js:1479` manda `{type:'display-ready'}` sem payload; `controle.js:13088` responde `resendSceneToDisplay()` incondicional — ambos confirmados), então **cada aba que abrisse, recarregasse ou fosse restaurada pelo navegador faria a TV rodar um `load` completo — fade de saída, releitura, re-seek, fade de entrada — na frente da congregação**.

**O que o crítico derrubou.** Não há golpe fatal, e sim uma **inversão de risco**: a fase "segura" (só DOM) é a que tem o furo estrutural sem contorno, e a fase "arriscada" é a que o resolveria.

- **A tela do coral apaga em 30 segundos.** `navigator.wakeLock` é `[SecureContext]` — em `http://` da LAN **não existe** *(conhecido da plataforma, confiança alta)*. Numa cena de letra não há vídeo tocando no cliente, e áudio não segura a tela do Android. Cada vez que apaga, volta pedindo um toque no overlay "Ligar Sistema" (handler `{ once: true }`).
- **Três celulares tocando o hino no mesmo salão.** O cliente é `/web/display/` de verdade, com `forceMuted: false`, e o `#startBtn` **desmuta explicitamente**. Os clientes estão **dentro da igreja**, a 100–300 ms de latência. Três visitantes curiosos = três alto-falantes com slapback contra a PA.
- **O encoder já está ocupado.** O Miracast **é** um encode H.264 1080p em tempo real, agora, neste celular. Somar N encodes de WebRTC ao lado tem número pequeno e fixo de sessões concorrentes; estourado, o WebRTC cai para software em silêncio, e a degradação aparece como queda de frame rate **na TV**. *(conhecido da plataforma, confiança média-alta; precisa de medição)*
- Mais três achados de posicionamento: o "sexto ramo" de `rec.mediaStream` proposto "antes de `rec.url`" cairia **depois de `rec.stream`**, e uma cena de transmissão direta entraria no ramo de MSE buscando `appassets.androidplatform.net`, que **só existe dentro do WebView** — falha de DNS → `onStreamErro` → `console.warn` **e nada mais** (`display.js:91`, confirmado): cortina aberta sobre preto, indefinidamente; o `lan-hello` compararia contra `WEB_VERSION`, que está em `controle.js:165` e **não existe no Display**; e a ordem dos scripts era impossível (o shim precisa publicar `__AVBus` **antes** de `db.js:801` e substituir `AVDB` **depois** de `db.js:889`).
- E duas incertezas de plataforma que não se resolvem lendo código: `RTCPeerConnection` em contexto inseguro (provável, não afirmável — e a política muda por versão do WebView), e `captureStream()` sobre um `<video>` decodificado por hardware dentro de uma `Presentation` que já vive sobre um display virtual de Miracast — o **pior caso** dessa família.

**Veredito:** não é o caminho principal, e **fica registrada como a porta de saída da fase 3** se a medição de banda reprovar o serviço de arquivo. Suas duas melhores peças são enxertadas no plano: **o `display-ready` endereçado** e **a regra de que o cliente nasce mudo**.

### 4.4 Tabela comparativa

| | **Comandos** (recomendada) | **Pixels** | **WebRTC** |
|---|---|---|---|
| Cobre letra / texto / cronômetro | **sim** | sim | sim |
| Cobre imagem / página de PDF | fase 2 (bytes) | sim | sim (DataChannel) |
| Cobre vídeo e áudio | fase 3, condicional | v2 (vídeo mudo) | sim, se `captureStream` passar |
| Cobre o **embed** do YouTube | **não, nunca** | **sim** | **não, nunca** |
| Mídia codificada no Kotlin | **nenhuma** | encoder + muxer fMP4 à mão | nenhuma |
| Dependência nova | **nenhuma** | **nenhuma** | **nenhuma** |
| Respeita a invariante 5 | **sim** | na letra sim, no espírito estica | sim |
| Um só relógio | não (offset por carimbo, 1 linha) | **sim, por construção** | não |
| Custo em CPU/térmico | **baixo** (fase 1: ~1 KB/s por cliente) | alto (render + encode) | médio-alto (encode ao lado do Miracast) |
| Reusa o `/display/` real | **sim, 6 de 8 arquivos** | sim, 100% (é o Display de verdade) | sim, 6 de 8 |
| Exige APK | fases 1–3, uma Release cada | v1 + v2 | v1 + v2 |
| **O que a mata** | o registro não viaja no barramento → **consertado por instantâneo** | áudio duplicado + o `simpleDisplay` trancado + fMP4 à mão sem infra de teste | tela do cliente apagando sem `wakeLock`; encoder já ocupado pelo Miracast |
| Estabilidade em culto (fase 1) | **4/5** | 3/5 | 2/5 |
| Complexidade (fase 1) | **3/5** | 4/5 | 4/5 |

---

## 5. O caminho recomendado, em fases

**Nome de trabalho: "Tela na rede".**

O que muda em relação ao desenho original de "espelho de comandos", e é a decisão central deste plano:

> **A cena viaja INTEIRA, num instantâneo montado em JavaScript pelo Controle — não é remontada em Kotlin a partir de ponteiros.**
> O Kotlin guarda **um slot opaco**: a última string do instantâneo. Não interpreta campo nenhum, não conhece tipos pegajosos, não decide ordem. Quem sabe o que é uma cena continua sendo o Controle (invariante 5), e o lugar onde essa regra mora continua sendo `controle.js`, ao lado do `resendSceneToDisplay` que já a implementa — que é onde ela vai envelhecer junto com o resto.

Isso apaga, de uma vez: o crux do §4.1 (o registro viaja no instantâneo), a reimplementação de `resendSceneToDisplay` em Kotlin, a lista de tipos pegajosos que divergiria em silêncio, o problema de ordem de replay, e o replay comido pela deduplicação de `__mid`.

### Fase 0 — Derrisco (nenhuma linha de produção)

Ver §9. Seis experimentos, um dia, e **os três primeiros podem cancelar o recurso inteiro** ou mudar a ordem das fases. Este projeto já perdeu três rodadas de APK com um diagnóstico plausível e errado; a fase 0 existe para que a próxima suposição errada custe meia hora.

**Critério de pronto:** as seis respostas escritas no `#diagBox` de um build de teste ou num arquivo de anotação, e a decisão de seguir/parar tomada com elas na mão.

---

### Fase 1 — Tela na rede: texto e letra

**O que o operador ganha.** Uma segunda tela num navegador da rede mostrando, ao vivo: **versículo, mensagem, cronômetro, timer, sorteio, letra sincronizada, a cortina, os fades, e o fundo do palco**. Uso real: uma tela para o coral com a letra do hino; uma no fundo do salão com o versículo e o cronômetro; a cabine de som acompanhando sem olhar por cima do ombro.

**E o que ela NÃO mostra, dito na própria tela:** imagem, apresentação e vídeo. Quando a cena for uma dessas, o cliente cai no fundo padrão e desenha uma faixa discreta: *"vídeo no telão — esta tela mostra letra e texto"*. Isso não é enfeite: "a tela ficou preta" e "esta tela não faz isso" são indistinguíveis, e falha silenciosa é o pior desfecho deste projeto.

**Nasce em Kotlin** (`app/src/main/java/br/org/iasd/av/`):

| Arquivo | Responsabilidade | Linhas (com o KDoc denso deste repo) |
|---|---|---|
| `LanServer.kt` | Bytes no fio e mais nada. `ServerSocket` em porta fixa (8787), accept loop com pool limitado, HTTP/1.1 mínimo com tetos duros de linha/cabeçalho/conexão, validação de `Host` (contra rebinding de DNS), decodificação-antes-de-canonicalizar no caminho, roteamento de cinco rotas, e o `text/event-stream`. Serve os estáticos reusando a resolução OTA→APK e a tabela MIME de `WebPathHandler.kt:21-68` (promovidas a `internal`). **Não conhece `SafRegistry`, não importa `StreamProxy`, não tem rota de listagem.** | 550–750 |
| `LanPares.kt` | Pareamento e ciclo de vida dos clientes: PIN de 6 dígitos (2 min, 3 tentativas, comparação em tempo constante), token de 128 bits (`SecureRandom`, base64url — o padrão de `SafPathHandler.kt:62-68`) com prazo, teto rígido de **3 clientes**, IP da LAN por `ConnectivityManager`/`LinkProperties`, e o texto do bloco de diagnóstico. | 180–250 |
| `LanCena.kt` | **Um slot.** Guarda a última string de instantâneo e a última de `display-status`, faz fan-out para os assinantes com **fila limitada por conexão e política de descarte**, e decima o `display-status` a 1 Hz. Não parseia campo nenhum além de `type`. | 120–180 |

**Muda em Kotlin:**

| Arquivo | Mudança |
|---|---|
| `NativeBridge.kt:230-234` | `busPost` ganha `LanCena.observe(json)` — **e ele precisa ser não-bloqueante e assíncrono, por contrato**. Um `write()` de socket ali trava o JS do telão (§3.2). Mais cinco métodos: `lanStart`, `lanStop`, `lanState`, `lanApprove`, `lanDiag`, todos guardados por `host != null` (só o Controle). **`SHELL_VERSION` 31 → 32.** |
| `MainActivity.kt` | Implementa os cinco no `BridgeHost`; derruba o servidor no `onDestroy`, ao lado dos outros desligamentos que já estão lá. |
| `shared/native.js` | Os cinco métodos, **remontados campo a campo** — e é aqui que mora a forma de falhar preferida deste projeto (`slideLabel` v5.97→v5.102, `bytes` v5.118→v5.137): um campo esquecido some em silêncio porque `optBoolean`/`optLong` leem ausente como `false`/`0`. **`tools/ponte.test.mjs` ganha os métodos novos na mesma entrega.** |
| `AndroidManifest.xml` | **nada.** §3.7. |

**Nasce e muda em `assets/web/`:**

| Arquivo | Mudança | Linhas |
|---|---|---|
| `shared/lan.js` **(novo)** | Duas metades num arquivo só, no idioma do `native.js` (a IIFE **retorna na entrada** quando não é o caso dela). **Metade CLIENTE** (detectada pelo prefixo `/l/<token>/` do próprio caminho): publica `window.__AVBus = {post, recv}` **antes** de `db.js`, com o `post` sendo **um dreno**; aplica o instantâneo; alimenta `updateLyricSlide(t)` com o `currentTime` relayado; mantém o `offset` de relógio; desenha a faixa de "esta tela não mostra X" e o watchdog de reconexão. **Metade CONTROLE**: monta o instantâneo. | 400–550 |
| `lan/index.html` + `lan/lan.css` **(novos)** | A página de pareamento: **anônima**. Um título, o PIN em corpo grande, "aguardando o operador…". Sem versão do app, sem nome do aparelho, sem nome do Wi-Fi, sem um byte do bundle do Display. | ~180 |
| `display/index.html` | **Dois** `<script src="../shared/lan.js">` — um antes de `db.js` (para o `__AVBus`) e um depois (para o adaptador de `AVDB`). O arquivo é idempotente e sabe em qual passagem está. Um `<script>` só naquela posição teria o `__AVBus` adotado e o adaptador **apagado em silêncio** por `db.js:889` (`global.AVDB = {…}`, incondicional) — e o sintoma seria wallpaper permanente, sem erro. | 2 |
| `display/display.js` | Quatro edições cirúrgicas, todas guardadas por modo LAN: (a) expor `updateLyricSlide` para o tique externo; (b) `liveReading` passa `Date.now() + offset`; (c) `createStage({ forceMuted: true })` — **o cliente nasce mudo**, com um botão de som explícito, porque os clientes estão dentro da igreja; (d) esconder o `#startBtn`, que sob `forceMuted` não destrava nada e é um **overlay de tela inteira** obstruindo a projeção. | ~14 |
| `controle/controle.js` | `resendSceneToDisplay(para)` — **o endereço** (abaixo); `buildLanScene()`, compartilhando a lógica com ele; a linha em Configurações; o bottom-sheet (na tabela `POPUPS`, para o botão voltar já fechá-lo pela escada que existe); o bloco novo no `#diagBox` (com o botão de copiar que a regra do projeto exige); `WEB_VERSION`. | ~330 |
| `controle/index.html` | A `fade-row fade-row--fit` e o markup do sheet. | ~60 |
| `version.json`, `#appVersion` | Os três lugares de versão. | 2 |

**O que NÃO é tocado:** `shared/db.js`, `shared/stage.js`, `shared/mse.js`, `shared/native.js`, `display/display.css`, `shared/tokens.css`. Isso inclui o motor de renderização inteiro.

#### O `display-ready` ganha endereço — e isto conserta um defeito que já existe hoje

Do jeito que está, `display.js:1479` envia `{type:'display-ready'}` sem destinatário e `controle.js:13088` responde `resendSceneToDisplay()` **incondicional**. Cada tela que abre faz **a TV** rodar um `load` completo na frente da congregação. A correção é pequena e vale por si:

- `resendSceneToDisplay(para)` acrescenta `__para: para` a cada comando que emite (`controle.js:13045-13070`) — `undefined` quando é o telão, e **o comportamento de hoje não muda em uma vírgula**;
- `display.js` (e o cliente) ignoram comando cujo `__para` esteja preenchido e não seja o seu id — duas linhas no topo do `onCommand`;
- `controle.js:13088` passa a ser `resendSceneToDisplay(msg.__de)`.

#### O instantâneo, em uma frase

`buildLanScene()` monta **um JSON autocontido** com: o registro da mídia **sem bytes** (`lyrics`, `kind`, `hymnName`, `hymnTrack`, `name`, `seconds`, `height` — e `blob`/`pages`/`opfsPath`/`stream`/`url` **explicitamente nulos**), mais `view`/`muted`/`volume`/`time`/`playing`/`page`, mais o descritor de texto/cronômetro/sorteio/versículo que estiver projetado. É emitido no `send()` e em toda mudança de cena, **e só quando há pelo menos um cliente LAN** (custo zero quando não há). Entre instantâneos, os comandos existentes viajam verbatim.

**Zerar `stream` no instantâneo não é higiene, é obrigatório.** `AVStream.disponivel()` devolve `true` num navegador comum e `suportado()` só testa codecs — um cliente que recebesse `rec.stream` entraria no ramo de MSE de `stage.js:657` e buscaria `appassets.androidplatform.net`, que **só existe dentro do WebView**: falha de DNS → `onStreamErro` → `console.warn` **e nada mais** (`display.js:91`, por decisão documentada). Cortina aberta sobre preto, indefinidamente, com uma linha de console que ninguém vê.

**Critério de pronto da fase 1:**
1. `tools/display-smoke.mjs` sobe `/display/` num Chromium **com um `__AVBus` falso e um instantâneo sintético** (`kind:'audio'` + `lyrics`), e verifica que a letra avança quando o `currentTime` avança. Sem `continue-on-error`? Não — este entra na família dos testes em Chromium, que são `continue-on-error`; o que **não** é são os dois abaixo.
2. `tools/lan-http.test.mjs` — oráculo do parser HTTP em Node puro, determinístico, **sem `continue-on-error`**, no formato de `webview-range.test.mjs`.
3. `tools/ponte.test.mjs` cobre os cinco métodos novos e cada campo do `lanState`.
4. Num domingo real: duas telas pareadas, 2 h, e o `#diagBox` respondendo às seis causas da tabela da §8.
5. **A TV não pisca quando alguém abre a página** — verificado com a TV conectada e um cliente recarregando a aba dez vezes.

---

### Fase 2 — Imagem e apresentação

**O que o operador ganha.** A tela da rede passa a mostrar **imagens e páginas de PDF/PPTX**, com ⏮/⏭ passando página como no telão.

**Por que é uma fase separada.** Uma imagem não é "vídeo menor": ela precisa exatamente do mesmo cano de bytes, com números menores. Uma foto de celular de 8 MB por base64 vira ~22 MB de string UTF-16 no renderer que o projeto já trata como propenso a OOM — não há atalho barato.

**Nasce:** `LanBytes.kt` (~300 linhas). O cliente pede `GET /l/<token>/m/<id>?p=<pagina>`; o `LanServer` pede a fatia ao WebView do **Controle** — é ele quem escreve o acervo, e o do Display **pode não existir** (`MainActivity.kt:528-530`) — e devolve.

**O transporte é `WebMessageListener` + `TYPE_ARRAY_BUFFER`**, com `JavaScriptReplyProxy.postMessage` na volta. `androidx.webkit` **já é dependência declarada** (`app/build.gradle.kts`), então **nenhuma dependência nova**. Isso elimina de uma vez mixed content, CORS, preflight, Local Network Access, base64, e um socket em loopback que qualquer app do celular alcançaria. Gate obrigatório por `WebViewFeature.isFeatureSupported(WEB_MESSAGE_LISTENER)` e `(WEB_MESSAGE_ARRAY_BUFFER)` — spike nº 5.

**Nunca por `evaluateJavascript`.** É o mecanismo do `MessageBus.post` (`MessageBus.kt:51`), que enfileira na **main thread — a mesma fila que entrega o comando ao telão**. Clientes puxando bytes por ali é atraso na projeção no meio do culto.

**Preço:** o WebView do Controle é estrangulado em segundo plano **de propósito** (`WebViewFactory.kt:99-118`, `MainActivity.kt:441-444`). A fase 2 liga `manterVisivel` enquanto houver cliente, reusando a forma exata de `setAudioAlive` (`MainActivity.kt:466-479`), com a mesma contagem e o mesmo `finally` de `bgWorkBegin`/`bgWorkEnd`, e desliga no último que sair.

**Critério de pronto:** um deck de 30 páginas passa slide na tela da rede sem engasgo perceptível; o adaptador **cacheia o registro** (`getMedia` é chamado **duas vezes por `load`** — `display.js:1371` e `stage.js:615` — e sem cache um deck viajaria duas vezes); pedidos em voo têm timeout → 404/503 com corpo, nunca 500 mudo; e um teto de fatias em voo mantém o pico de RAM abaixo do `TETO_PEDACO` de 24 MB que o `StreamProxy.kt:482` já aceita hoje.

---

### Fase 3 — Vídeo e áudio, e **só quando não há TV conectada**

**A regra, antes do desenho.** Servir megabytes pela LAN compete com o link Miracast que leva a projeção à TV — mesmo rádio, time-slicing. Quando **há** TV, a projeção principal é a TV, e um espelho auxiliar não pode ter como degradá-la de forma intermitente. Quando **não** há TV, o navegador da LAN **é** a projeção, não existe Miracast competindo, e a banda inteira está disponível.

Então:

- **Sem TV:** o cliente recebe o vídeo por HTTP com `Range` de verdade, servido do arquivo pela mesma cadeia da fase 2. Sem encode, sem transcodificação, sem WebRTC.
- **Com TV:** vídeo na tela da rede fica **desligado**, com a frase na UI. Se a medição do spike nº 3 mostrar folga confortável, o interruptor pode ser destravado depois — mas ele nasce fechado.

> ⚠ **A invariante 8 SE INVERTE aqui, e é o aviso mais caro deste documento.** Dentro do WebView, quem aplica o `Range` é o Chromium sobre o recurso **inteiro** que o app devolveu — é por isso que `SafPathHandler.kt:74-91` responde **sempre 200 com o stream inteiro** e mesmo assim um vídeo de 2 GB do SAF é seekável. Num `ServerSocket` **nós somos o servidor HTTP**: vale a RFC 7233, e um pedido `Range: bytes=a-b` exige **206 + `Content-Range: bytes a-b/T` + apenas a fatia**, com `Accept-Ranges: bytes` no 200 inicial e **416 + `Content-Range: bytes */T`** na faixa inválida. Copiar o idioma do `StreamProxy` (200 seco, faixa na query, `FatiaComoTodo`) produziria um `<video>` que **não busca** — o defeito de v5.120→v5.126 com o sinal trocado. Corolário: o truque do "corpo de erro nunca vazio" é artefato do Chromium e vira ruído aqui; num socket, um 404 com `Content-Length: 0` é perfeitamente legal.
>
> **`tools/lan-http.test.mjs` trava isto no CI**, sem `continue-on-error`.

**Se o spike nº 3 reprovar o serviço de arquivo mesmo sem TV** (rede que não sustenta o bitrate do arquivo original), a porta de saída é o WebRTC com `captureStream()` — que transcodifica para 1–4 Mbps adaptativos em vez de servir os 12–20 Mbps do arquivo. Ele fica registrado como alternativa, **não recomendado hoje**, com as duas verificações que o condicionam (spike nº 6).

**Critério de pronto:** um louvor de 380 MB toca na tela da rede sem stall por 5 minutos, com seek funcionando; o `<video>` do cliente busca de verdade (206 com `Content-Range` correto); e o Registro reporta a vazão sustentada.

---

## 6. O caminho dos bytes da mídia — o crux

Esta seção existe porque é aqui que todo desenho ingênuo morre, e a morte é silenciosa.

### 6.1 O acervo tem CINCO donos de bytes, não um

`stage.js:641-670` resolve a mídia numa cascata, e cada ramo tem um dono diferente *(confirmado no código, lido agora)*:

| # | Campo | Onde os bytes moram | Kotlin lê? |
|---|---|---|---|
| 1 | `rec.blob` | **IndexedDB**, store `media` | **não** |
| 2 | `rec.pages[]` (kind `deck`) | **IndexedDB**, array de Blobs dentro do próprio registro | **não** |
| 3 | `rec.opfsPath` | **OPFS**, `folders/<id>/<nome>` | **não** |
| 4 | `rec.stream` | **em lugar nenhum** — manifesto de URLs do googlevideo | sim (é ele quem as tem) |
| 5 | `rec.url` | externo | n/a |

Isso é decisivo, e é o fato que mais desmonta suposições: **um vídeo de 380 MB baixado do YouTube NÃO está no OPFS** — ele é um Blob no IndexedDB (`controle.js:10334-10343`: `fetch(r.url)` → `res.blob()` → `AVDB.addMedia`). O OPFS guarda o que veio de **coleção LouvorJA** e de **sincronização de pasta do dispositivo**. Qualquer solução que ataque "o OPFS" cobre metade do problema.

### 6.2 Por que o Kotlin não pode ler nada disso

`grep -rni "opfs|indexeddb|app_webview"` sobre o Kotlin devolve **só comentários** — nenhuma leitura. Não é falta de permissão (é o mesmo uid): é que **não há API pública**, o layout em disco é detalhe de implementação do Chromium, não há locking com o processo que tem os arquivos abertos, e **o WebView se atualiza pela Play Store independentemente do APK**. Falharia exatamente do jeito que este projeto mais teme: em silêncio, depois de uma atualização que ninguém fez.

**Propriedade de segurança que isso dá de graça, e que vale preservar deliberadamente:** um servidor LAN em Kotlin, sozinho, **não consegue vazar o acervo**. Ele não tem os bytes.

### 6.3 As quatro saídas, e o que sobra

| Saída | Veredito |
|---|---|
| **(a) base64 pela ponte** | **Fechada por princípio declarado.** `SafPathHandler.kt:13-18`: *"entregamos ao JavaScript URLs SERVÍVEIS, nunca bytes […] um vídeo de 2 GB nunca passa por base64."* Números: 380 MB → ~506 MB de base64 → como string JS é **UTF-16**, ~1 GB no renderer, mais a cópia na travessia. OOM garantido, e o OOM derruba a projeção junto. |
| **(b) o Kotlin lê o OPFS** | **Fechada.** §6.2. |
| **(c) segunda cópia em disco** | **Rejeitada, e o projeto já rejeitou isto por escrito no caso análogo** (`YoutubeGrab.kt:1386-1389`: *"sem isto, cada vídeo ficaria DUAS vezes no aparelho […] e o cache não é limpo por ninguém"*). Duplicar um acervo de gigabytes num celular é a diferença entre caber e não caber; e são 3–8 s (380 MB) a 15–40 s (2 GB) **antes do primeiro quadro** — exatamente a espera que a transmissão direta da v5.120 existe para acabar. Aceitável só como pré-aquecimento oportunista, nunca como regime. |
| **(d) o WebView entrega a fatia** | **É a saída.** `opfsGetFile` devolve um `File` **preguiçoso** (`db.js:477-483` faz `fh.getFile()` e nada mais), e `file.slice(a,b).arrayBuffer()` lê **só aquela janela**, sem materializar o resto. **O WebView já é, hoje, um servidor de byte-ranges capaz — falta só um cano para fora dele**, e o cano é o `WebMessageListener` binário do AndroidX que já é dependência. |

### 6.4 O achado barato que ninguém tinha notado

`syncDeviceFolder` copia os bytes para o OPFS e grava no catálogo `opfsPath`, `srcName`, `size`, `mtime` — **e não guarda de onde o arquivo veio** (`controle.js:7474-7486`). O `folder.uri` fica só no registro da **pasta**.

Ou seja: para toda mídia vinda de pasta do dispositivo — que é **exatamente a classe dos vídeos grandes**, de 380 MB a 2 GB — o arquivo original continua no aparelho, o Kotlin sabe abri-lo (`SafPathHandler.kt:79-81`, `contentResolver.openInputStream`), a permissão da árvore é persistida (`MainActivity.kt:170-176`), **e o app simplesmente não guardou o ponteiro**.

Guardar `srcUrl` no registro do catálogo é **uma linha de JS**, não muda o caminho de projeção em nada, e para essa classe **elimina o cano inteiro**: o `LanServer`, rodando no mesmo processo, resolve o token direto. Duas ressalvas honestas: o arquivo pode ter sido movido depois do sync, então é um *fast path* com fallback, nunca a única fonte; e os tokens morrem com o processo, então o miss é recuperável re-emitindo por `listFolder(folder.uri)` e recasando por `srcName` — que é o que o `bySrcName` do próprio `syncDeviceFolder` já faz.

### 6.5 A ordem de grandeza, para calibrar expectativa

Por cliente, 1080p H.264: um download do YouTube (itag 137) sustenta **0,4–0,75 MB/s**; um arquivo de celular ou WhatsApp original, **1,5–2,5 MB/s**. E o `<video>` **não consome no bitrate** — o Chromium bufferiza à frente e puxa o que o link permitir: **média = bitrate; pico = velocidade do link**.

O multiplicador que se esquece: **o celular é cliente do AP, não o AP.** Cada byte cruza o ar **duas vezes** (celular→AP, AP→cliente), então a capacidade útil é **metade** da do rádio. Numa 2,4 GHz doméstica com o salão cheio, isso é **1–2 clientes de 1080p, com engasgos**. Numa 5 GHz decente, 5–10. E o *airtime fairness* garante que um único cliente longe do AP negociando 6 Mbps derruba a vazão de todo mundo — numa igreja, esse cliente sempre existe. *(conhecido da plataforma; a rede específica precisa de medição — spike nº 3)*

Daí o **teto rígido de 3 clientes** desde a fase 1, e o quarto recebendo uma frase em vez de uma degradação silenciosa.

---

## 7. Pareamento, bootstrap e segurança

### 7.1 Bootstrap — a saída, sem maquiagem

| Quem vai assistir | Como chega |
|---|---|
| **TV, projetor, notebook fixo** | Digita `192.168.0.42:8787` **uma vez** e favorita. **Reserva de DHCP no roteador** (senão o IP muda) e **uma etiqueta colada no rack**. Feio, e é o que funciona. |
| **Celular ou tablet** (visitante, coral, cabine) | O **Controle** desenha um QR com `http://192.168.0.42:8787/p/<pin>` e o visitante usa a **câmera nativa dele**. Endereço e autorização num gesto, zero permissão nova nossa, zero `BarcodeDetector`. **É nisto que a UX pedida vira, e nessa direção ela é ótima.** |
| **mDNS (`av.local`)** | `NsdManager` publica sempre; **ninguém depende**. O Android não resolve `.local`, e o celular é justamente quem escaneia. Conveniência oportunista para um notebook macOS/Windows, nada mais. |

**Regra de código que vem do "falha silenciosa é o pior desfecho": sem Wi-Fi, NÃO desenhar o endereço nem o QR.** Se a rede ativa é celular ou VPN (`ConnectivityManager` → `NetworkCapabilities`, recusando `TRANSPORT_CELLULAR` e `TRANSPORT_VPN`), o lugar do endereço é substituído por *"o celular não está numa rede Wi-Fi"*. Um IP `10.x` de rede móvel escaneia perfeitamente e nunca conecta — indistinguível de AP isolation, de porta bloqueada e de servidor morto.

E o que **não** usar para descobrir o IP: `WifiManager.getConnectionInfo().ipAddress` (deprecado na API 31, `int` IPv4, devolve `0` em várias configurações) e `NetworkInterface.getNetworkInterfaces()` sozinho (lista `rmnet` e `tun0` sem dizer qual é a Wi-Fi — o uso legítimo dele é **cruzado**, enumerando só a interface que o `LinkProperties` nomeou).

### 7.2 Pareamento — PIN, não QR-na-tela

A tela remota abre `/`, recebe um `screenId` e mostra **"Digite este código no celular do operador: 4 7 1 9 0 3"** em corpo grande. O operador digita no Controle. Aprovado, o token vai **pela conexão SSE já aberta daquela tela** — nunca pela URL, nunca por QR, porque o QR está na frente da congregação inteira.

Direção invertida em relação ao que foi imaginado, e ela preserva o essencial: **quem autoriza é uma pessoa olhando fisicamente para a tela que está pedindo.**

Por que PIN e não QR-na-tela:

| | QR (tela mostra, celular escaneia) | PIN de 6 dígitos |
|---|---|---|
| Permissão nova | **CAMERA** — e o `ControleChromeClient` (`MainActivity.kt`) **não tem `onPermissionRequest`**: só `onShowFileChooser`, `onShowCustomView`, `onHideCustomView`, `onConsoleMessage`. `getUserMedia({video:true})` seria **negado em silêncio**, o mesmo modo de falhar que `MicChromeClient.kt:10-19` documenta | nenhuma |
| API incerta | `BarcodeDetector` em WebView (a implementação Android depende do módulo do Play Services) | nenhuma |
| Salão escuro, TV brilhando, operador a 8 m, glare | mal | sempre |
| Projetor desfocado | mal | sim |
| Degrada como | "não lê", e ninguém sabe por quê | "digite os seis números", e dá para ler em voz alta |

### 7.3 O que NUNCA é exposto pelo servidor LAN

Lista explícita. Cada item é regra de código, não preferência — e a regressão que apaga o desenho inteiro é alguém "só acrescentar um endpoint de listagem para facilitar".

1. **`/saf/` e qualquer coisa derivada.** Nem proxy, nem redirect, nem "só imagens". `pickFolder` concede uma **árvore inteira**, e `listFolder` (`NativeBridge.kt:844-898`) indexa nome, tamanho, mtime e um **token servível** de cada arquivo dela — se o operador concedeu "DCIM" ou "Download" uma vez, essa pasta está indexada, e os tokens **nunca expiram**. O projeto já tomou essa decisão uma vez, por escrito e por menos: o telão não recebe o handler `/saf/`.
2. **`/stream/<token>`.** Repassá-lo transforma o celular em proxy aberto de YouTube para a rede, com a URL assinada do CDN e o UA embutidos.
3. **Qualquer listagem ou enumeração**: catálogo, Cronograma, playlists, Favoritos, pastas, versões da Bíblia, nomes de arquivo. **Nenhum endpoint de índice. Nenhum.**
4. **Mídia por id arbitrário.** O único material servível é **a cena atual**, por uma allowlist de 1–2 ids que o **Controle** escreve no mesmo instante em que envia o `load`. Id fora da allowlist → 404 idêntico ao de token inválido (não vazar existência).
5. **O barramento, em qualquer direção de entrada.** Comandos saem; **nada entra**. Isso não é uma política a lembrar: o `post` do `__AVBus` do cliente é um dreno, então o `sendCommand` do `db.js` no cliente **não tem para onde ir**. Consequência direta e importante: **`mic:true` vindo da rede não existe** — o comando que abriria o microfone do telão na caixa de som do templo (`display.js:1316`) não tem caminho.
6. **Qualquer superfície de `__AVBridge`.** `pickDoc`, `listFolder`, `ytFetch`, `openExternal`, `otaApply` — nada ganha eco HTTP.
7. **Metadados de identificação** na página não autenticada: user agent, `versionName`, nome do Wi-Fi, nome do aparelho. Nem a versão do app.
8. **O token e o PIN no `#diagBox`.** A caixa tem botão de copiar e é feita para ser colada num WhatsApp: segredo ali é segredo publicado. IP de cliente entra com os dois últimos octetos mascarados.

### 7.4 O que este desenho protege — e o que não protege

**Protege:** contra quem passa na rede e faz um scan (token opaco de 128 bits no caminho); contra o navegador do operador ser usado para falar com o servidor por rebinding de DNS (validação de `Host`, e nenhum `Access-Control-Allow-Origin`); contra path traversal (decodificar antes de canonicalizar, e a contenção por `canonicalPath` que `WebPathHandler.kt:33-34` já tem na forma certa — hoje é defesa em profundidade, ali vira load-bearing); contra o acervo vazar (o servidor não tem os bytes, e na fase 2+ só tem a cena atual); e contra a rede comandar a projeção (não há caminho de subida).

**NÃO protege, e precisa estar escrito:**

1. **É HTTP em claro.** Numa rede aberta — ou numa WPA2-PSK com a senha compartilhada e o handshake capturado — **o token e o conteúdo passam legíveis**. O pareamento é uma fechadura numa parede de vidro: impede quem passa de entrar, não impede quem está olhando de ver. **Não há saída dentro das regras do projeto**: certificado válido para IP privado não existe, e autoassinado é uma tela vermelha de "sua conexão não é particular" a cada culto.
2. **Quem enxerga a tela do operador enxerga o PIN.** Vale 2 min e 3 tentativas; alguém ao lado o lê.
3. **Uma vez pareado, é confiança total até desconectar.** Não há revogação por conteúdo.
4. **ARP spoofing / MITM na LAN derrota a amarração por IP**, e nada aqui o detecta.
5. **Não impede DoS não autenticado.** Rate limit ajuda; um celular é um celular. Em particular: **a espera de pareamento não pode segurar uma thread** — um long-poll anônimo de 60 s com thread-por-conexão é um DoS de uma linha. Ela é servida pela mesma SSE, ou não existe.
6. **Não protege contra um bug nosso.** É o primeiro código deste projeto que aceita entrada de um desconhecido; o parser HTTP é a peça a ser mais testada.

### 7.5 A UI, seguindo as convenções do projeto

**Ligar** — mais uma `fade-row fade-row--fit` no popup de Configurações, na família de "Preenchimento da mídia" / "Wallpaper do telão":

```
Tela na rede local          [ Desligada ]  [ Ligada ]
```

**Desligada por padrão, sempre, e desligando ao fechar o app.** Um servidor que sobe sozinho num domingo é o oposto do que esta análise recomenda.

**Estado ao vivo** — no `popup-footer`, ao lado do estado do telão, reusando a classe `.connected` que já existe:

```
[ 📺 Telão: LG 55 conectado ]      [ 🖧 Rede: 2 telas ]
Espelhar abre: Smart View                    Web v5.140 · Shell v1.64
```

Tocar em "Rede" abre um bottom-sheet — **na tabela `POPUPS`**, para o botão voltar já fechá-lo pela escada que existe — com o endereço em corpo grande, o QR, o PIN em curso e a lista de telas com **Desconectar** na convenção destrutiva (contornado, `--danger-text`, nunca preenchido).

**Diagnóstico** — um **BLOCO novo no `#diagBox`**, nunca uma caixa nova, com o botão de copiar que a regra do projeto exige:

```
Tela na rede
servidor: ligado em 192.168.0.42:8787 · Wi-Fi "IASD-Membros"
telas: 2 pareadas · 0 pendentes · 4 PINs recusados
cena: instantâneo enviado há 12 s (hino 214, letra 38 slides)
tráfego: 1,2 MB · 38 min no ar
última batida: tela A há 2 s · tela B há 41 s
```

---

## 8. Modos de falha e o que o operador vê

| Situação | O que acontece tecnicamente | O que o operador vê / o que o Registro diz |
|---|---|---|
| **AP isolation no roteador** | Servidor de pé, porta escutando, IP certo — e o SYN **nem chega**. Do lado do servidor é indistinguível de "ninguém abriu". Não tem contorno no app | `nenhuma conexão desde que ligou (há 12 min)` → e a sugestão: trocar de SSID, ou usar o hotspot do celular |
| **Celular em dados móveis** | Sem IP de LAN | O endereço e o QR **não são desenhados**; no lugar, `celular em DADOS MÓVEIS — sem IP de rede local` |
| **IP mudou** (roteador reiniciou) | O favorito da TV aponta para nada | `IP mudou: era 192.168.0.42, agora 192.168.0.57` |
| **App minimizado, com cena no ar** | O `SessionService` (`mediaPlayback`) já está de pé — ele vive enquanto houver cena — e o processo não é congelado. A fase 1 continua funcionando mesmo com o WebView do Controle estrangulado, porque o instantâneo já foi capturado | nada muda na tela remota |
| **App minimizado, SEM cena** | O buraco real, e ele **não** se resolve fazendo "cliente conectado" contar como cena no `pushNowPlaying`: isso ressuscita a notificação órfã que `SessionService.kt:129-135` existe para impedir — cartão de pé com "Nada em exibição" e cinco botões mortos, **capturando a sessão de mídia do sistema** (o play do fone passa a apontar para um app que não toca nada). A resposta certa é um FGS próprio, tipo `connectedDevice`, **sem a cota de 6 h do `dataSync`** | notificação "Tela na rede: 1 conectada", com um botão de desligar |
| **Rede caindo** | A SSE morre; o `EventSource` **reconecta sozinho com backoff** — é por isso que o transporte é SSE e não RFC 6455. Ao reconectar, o servidor reemite o instantâneo (**e o `__mid` do replay é reescrito**, senão o `alreadySeen` de `db.js:868` o descarta em silêncio dentro da janela de 400 mids) | a tela escurece um instante e volta na cena certa · `sem conexão há 12 s` |
| **Cliente que dorme** (tampa do notebook, tela do celular) | O socket morre; o `EventSource` reconecta ao acordar. O ping SSE de 15 s existe para o caso oposto — **o NAT do roteador matando um socket ocioso, que parece vivo até a primeira escrita falhar** | volta sozinha |
| **A tela do cliente APAGA** | `navigator.wakeLock` é `[SecureContext]`: em `http://` **não existe**, e não há como o app impedir | dito na página e no Registro: *"configure esta tela para nunca apagar"*. **Sem contorno técnico — é um custo real do recurso** |
| **TV conectada ao mesmo tempo (fase 1)** | O caso normal, e onde o desenho é mais forte: a tela da rede é um **terceiro consumidor** de um barramento que já tem dois, e **nada sobe dela**. `resendSceneToDisplay` é endereçado, então abrir a página **não** faz a TV piscar | zero interferência · ~1 KB/s por cliente |
| **TV conectada + vídeo pela LAN (fase 3)** | Compete com o link Miracast. **Por isso a fase 3 nasce desligada com TV conectada** | `vídeo na rede indisponível com o telão conectado` |
| **Dongle caindo e voltando** | O Android recria a `Presentation`, o telão dispara `display-ready`, o Controle reenvia a cena, o instantâneo é reemitido e a tela da rede sincroniza junto. **De graça** | as duas telas voltam juntas |
| **Renderer do Controle morre (OOM)** | Fase 1: irrelevante (o instantâneo está no slot do Kotlin). Fase 2+: os pedidos em voo somem → timeout → 503; a página nova re-registra o canal no `load` | fase 2+: a imagem demora alguns segundos e volta |
| **Cena que a tela não mostra** (vídeo na fase 1, imagem antes da fase 2, **embed do YouTube sempre**) | O instantâneo diz o que é; o cliente não tenta e não fica preto | faixa discreta: *"vídeo do YouTube no telão — esta tela não espelha"* |
| **Muitos clientes** (o QR aparece e 60 pessoas escaneiam) | **Teto rígido de 3**; o quarto recebe uma página dizendo o limite | `recusada: 3 telas é o limite` |
| **Servidor derrubado pelo sistema** | O Kotlin precisa **esquecer** que estava servindo (`onGone` → zera o espelho de estado), senão o próximo `lanStart(true)` vira no-op **calado** — o defeito que `SyncService.onGone` existe para evitar | o botão volta a "Desligada" sozinho, e o Registro diz por quê |
| **Bundle servido sem `lan.js`** (OTA antigo, fallback por arquivo) | O `__AVBus` fica indefinido, nenhum comando chega, wallpaper para sempre, **sem erro** | o servidor **recusa parear** e diz: `a base web deste aparelho não suporta a tela na rede` |
| **Versão do cliente ≠ versão do celular** | Mismatch de esquema degrada para cena errada ou preto, **só na tela LAN**, indistinguível de "o Wi-Fi caiu" | o cliente busca `version.json` (que **já existe** e é a identidade do bundle — não se cria um quarto lugar de versão), compara, e **recusa parear** dizendo a diferença. Mesma filosofia da válvula `minShell` |

---

## 9. Spikes de derrisco, em ordem

Este projeto já gastou três rodadas de APK (v1.52→v1.55) num diagnóstico plausível e errado, e o que fechou o caso foi ler a fonte em vez de deduzir. Cada item abaixo tem um experimento exato e diz **o que cada resposta decide**.

### Spike 1 — Isolamento de clientes na rede da igreja *(5 minutos, mata o recurso)*

**Experimento:** dois celulares na mesma SSID. Num deles, `termux`/qualquer app servindo uma porta, ou simplesmente o hotspot desligado e um `ping` entre eles. No outro, abrir o endereço.
**Se falhar:** o recurso inteiro é impossível nessa rede. As saídas são operacionais, não de código: trocar de SSID (rede de membros em vez da de visitantes) ou usar o **hotspot do próprio celular** (os clientes entram numa rede que o aparelho controla, sem isolation, e no Android moderno o hotspot convive com dados móveis — o custo é o celular sair do Wi-Fi da igreja).
**Se passar:** segue. Nada mais importa antes disto.

### Spike 2 — O Display roda num navegador? *(30 minutos, dívida técnica que já existia)*

**Experimento:** `tools/display-smoke.mjs` — sobe a base num Chromium, injeta um `window.__AVBus` falso e um instantâneo sintético (`kind:'audio'` com `lyrics`), vai em `/display/`, e verifica quatro coisas de uma vez: (a) a página carrega sem exceção; (b) `updateLyricSlide` avança o slide quando o tempo avança; (c) o `#startBtn` aparece e o que ele obstrui; (d) `showText` desenha versículo e cronômetro.
**O que decide:** se algo aí quebrar, a fase 1 muda de tamanho **antes** de uma linha de Kotlin ser escrita. E o teste fica, independentemente do recurso — hoje **nenhum arquivo de `tools/` carrega `/display/`**, e o Display é a metade que a CI nunca executou.

### Spike 3 — Vazão real, com e sem o Smart View *(1 hora, decide as fases 2 e 3)*

**Experimento:** `iperf` (ou um download simples) do celular para um notebook na LAN, medido **duas vezes: com o espelhamento ligado para o dongle e sem**. Simultaneamente, olhar **frame drops na TV**, não no celular.
**O que decide:** se o Miracast derrubar a vazão para um dígito de Mbps, a fase 3 nasce restrita a "sem TV" (que é a recomendação padrão de qualquer jeito) e a fase 2 nasce com teto de banda. Se houver folga confortável, o interruptor de "vídeo com TV conectada" pode ser destravado depois.

### Spike 4 — O navegador alvo, em `http://192.168.x.x` *(15 minutos)*

**Experimento:** servir uma página de 5 linhas de um PC qualquer da rede e abrir, no aparelho que vai virar tela (o tablet do coral, a TV, o celular do visitante), com o console visível: `isSecureContext`, `typeof EventSource`, `typeof MediaSource`, `'wakeLock' in navigator`, e — o teste que ninguém pensa em fazer — **cronometrar quanto tempo a tela fica acesa** sem toque.
**O que decide:** confirma SSE (fase 1) e MSE (fase 3); confirma que `wakeLock` **não** existe (e portanto que a frase "configure esta tela para nunca apagar" é obrigatória na UI, não opcional); e mede o atrito real do overlay de autoplay recorrente. Se a tela apagar em 30 s num tablet que ninguém toca, isso muda o discurso ao operador sobre o que a fase 1 entrega.

### Spike 5 — O canal binário existe neste aparelho? *(20 minutos, decide a fase 2)*

**Experimento:** um build de teste que loga `WebViewFeature.isFeatureSupported(WEB_MESSAGE_LISTENER)` e `(WEB_MESSAGE_ARRAY_BUFFER)`, e mede a vazão de `file.slice(a,b).arrayBuffer()` → `postMessage` → Kotlin com fatias de 1 e 4 MB, anotando **em qual thread o `onPostMessage` chega**.
**O que decide:** se os dois derem `true`, a fase 2 é o desenho descrito e o loopback HTTP sai do plano inteiro. Se der `false`, a fase 2 precisa de outro cano — e o único restante que não viola regra é o `RTCDataChannel`, o que arrastaria WebRTC para dentro da fase 2 e mudaria a conta.

### Spike 6 — WebRTC, **só se a fase 3 precisar da porta de saída** *(20 minutos)*

**Experimento:** no cliente, `typeof RTCPeerConnection` em `http://192.168.x.x`. No WebView do telão (via `console.log`, que já vai para o logcat por `MicChromeClient.kt:68-71`): `typeof document.createElement('video').captureStream`, e depois `captureStream()` num `<video>` tocando **um arquivo local** e **um `MediaSource` do `mse.js` ativo** — conferindo se sai faixa de vídeo **com quadros** e se sai faixa de áudio.
**O que decide:** se `captureStream` entregar preto, a porta de saída da fase 3 não existe e a decisão volta a ser "servir arquivo, ou não fazer".

---

## 10. O que NÃO fazer, e por quê

Esta seção existe para que ninguém tente de novo daqui a seis meses achando que descobriu algo.

**1. Espelho de pixels (`createVirtualDisplay` + `ImageReader`/`MediaCodec`).** É a única resposta *completa* (captura até o embed do YouTube) e por isso é a armadilha. Custa: o áudio de uma segunda `Presentation` sai na **saída de áudio do sistema**, não no display virtual, então ele **soma com a preview na caixa de som do templo**; a preview do Controle **é um `YT.Player` real** (`controle.js:1022-1024`), então dois players do YouTube voltam; a exclusão do display virtual de `getDisplays(DISPLAY_CATEGORY_PRESENTATION)` é **obrigatória** (senão `syncPresentation` move a `Presentation` da TV, `MainActivity.kt:530`) **e trancaria o modo simplificado**, que é o padrão do app (`renderSimpleGate`, `controle.js:12233-12240`); e o v2 exigiria escrever fMP4 à mão (`MediaMuxer` não é muxer de streaming — `MuxMp4.kt:115-118`), 400–600 linhas de boxes binários **num repositório sem `app/src/test`**, cujo modo de falha é "o vídeo não toca", sem mensagem.

**2. `MediaProjection` + `AudioPlaybackCapture` para ter áudio no espelho de pixels.** Diálogo de consentimento do sistema **por sessão**, mais o indicador de "gravando a tela", antes de projetar, num culto. Não.

**3. WebRTC como caminho principal.** Descartado como fase 1/2, **preservado como porta de saída da fase 3**. As razões estão na §4.3: sem `wakeLock` a fase "segura" dele entrega um recurso irritante, o encoder de hardware **já está ocupado pelo Miracast**, os clientes estão dentro da igreja (três alto-falantes com slapback), e duas incertezas de plataforma o condicionam.

**4. Servidor de arquivos genérico por id.** `/l/<token>/m/<qualquer-id>` com listagem transforma o celular num servidor dos **arquivos pessoais** que `listFolder` indexa — e os tokens `/saf/` **nunca expiram**. A allowlist da cena atual não é cautela: é a diferença entre um espelho e um vazamento.

**5. base64 pela ponte para bytes de mídia.** Proibido por princípio declarado (`SafPathHandler.kt:13-18`) e por aritmética (§6.3). Sobrevive só no nicho que a ponte já ocupa: miniaturas e metadados — e nem lá, se o canal binário do spike 5 existir.

**6. Cópia integral antecipada para o cache do app.** O projeto já rejeitou isso por escrito no caso análogo (`YoutubeGrab.kt:1386-1389`). §6.3.

**7. Ler `app_webview/` por trás do Chromium.** O processo tem uid para isso; o formato é interno, não documentado, versionado pela Play Store, sem locking. Falharia em silêncio depois de uma atualização que ninguém fez. §6.2.

**8. Loopback HTTP (`http://127.0.0.1:PORTA`) como cano JS→Kotlin.** Funciona hoje (loopback é *potentially trustworthy*, não é mixed content; e o WebView concede Local Network Access incondicionalmente — *"currently"*). Quatro dependências fora do controle do projeto (mixed content, LNA, CORS/preflight, política futura do WebView, que se atualiza fora do ciclo de APK) mais uma superfície nova: **um socket em `127.0.0.1` no Android não é privado do app** — qualquer app com `INTERNET` conecta nele. Se o canal binário do AndroidX existir, isto sai do plano inteiro.

**9. Página pública na internet que busque o IP privado.** Morre em três barreiras independentes. §1.1.

**10. WebSocket (RFC 6455) escrito à mão.** SSE dá o mesmo para o tráfego que existe (servidor→cliente), custa ~30 linhas contra ~400 do pedaço mais arriscado (framing, unmasking, fragmentação, frames de controle intercalados, close handshake, validação de UTF-8), e **traz a reconexão automática do `EventSource` de graça** — que numa rede de igreja vale mais que a economia de linhas. O pouco que sobe é `POST` comum. Não escrever RFC 6455 antes de provar que SSE não basta.

**11. Copiar o `StreamProxy` para o servidor LAN.** A invariante 8 **se inverte** num socket. §5, fase 3.

**12. Um relógio mestre próprio, NTP caseiro, ou handshake de latência.** O `display-status` a 4 Hz já é uma âncora de tempo com muito mais resolução do que a projeção precisa, e o `SYNC_DRIFT = 1.6 s` (`controle.js:1177`) já foi calibrado. Um carimbo de `Date.now()` por quadro SSE resolve o desvio de relógio do cliente em uma linha.

**13. Uma allowlist de tipos de comando mantida à mão em Kotlin.** É a forma de falhar preferida deste projeto (`slideLabel`, `bytes`): comando novo chega ao telão e **não chega à tela da rede**, sem nenhum sinal. Se algum filtro for necessário, é **denylist** (`diag-ask`/`diag-dump` fora) — e o mecanismo principal é o instantâneo, montado em JS, onde a regra pertence.

**14. Uma quarta dependência externa.** Nada aqui exige uma. `ServerSocket`, `SecureRandom`, `MessageDigest`, `Base64`, `ConnectivityManager` e o `androidx.webkit` que já está declarado cobrem tudo. **Se algum passo deste plano exigir uma dependência, esse passo morre** — é o que aconteceu com WebRTC no lado Kotlin (`libwebrtc`) e é o que faria o QR virar biblioteca em vez de 300 linhas testáveis em Node no espírito de `tools/sidx.test.mjs`.

---

## 11. Impacto na documentação existente

Se isto for adiante, a documentação muda em quatro lugares, e a regra do projeto é clara sobre qual muda o quê: arquitetura, protocolo e ponte vão no `CLAUDE.md`; o que é interno a `assets/web/` vai em `docs/ARQUITETURA-WEB.md`.

### `CLAUDE.md`

- **"Estrutura do repositório"** — três a quatro arquivos Kotlin novos (`LanServer.kt`, `LanPares.kt`, `LanCena.kt`, e na fase 2 `LanBytes.kt`), com a linha de uma frase de cada; e `assets/web/lan/` + `shared/lan.js`. **A contagem de linhas do parágrafo "Dezesseis arquivos Kotlin" precisa ser refeita com `wc -l`** — hoje são 7.612, e a fase 1 acrescenta ~12% a ~16%. A proporção Kotlin×JS é o argumento, não o número absoluto, e ela se mantém.
- **Uma seção nova, "Tela na rede local"**, entre "Notificação de controles" e "OTA da base web". Ela precisa dizer, na ordem: que o cliente **é o `/web/display/` real** e por que isso é a invariante 5 aplicada; que **a cena viaja por instantâneo montado em JS**, e por que o Kotlin guarda um slot opaco em vez de remontar; que **nada sobe da LAN para o barramento**, com o `mic:true` nomeado; que **o bootstrap do endereço não tem saída mágica**; e que **HTTP em claro é o que é**.
- **"Invariantes do shell"** — ganha uma nona, e ela merece o mesmo tratamento que a oitava: **"num `ServerSocket` a invariante 8 SE INVERTE"**, com o `SafPathHandler.kt:74-91` citado como prova do lado de dentro e a RFC 7233 do lado de fora.
- **"A ponte `window.AVNative`"** — cinco métodos novos (`lanStart`, `lanStop`, `lanState`, `lanApprove`, `lanDiag`), a contagem "trinta métodos" atualizada, e **`SHELL_VERSION` 31 → 32** com a linha de histórico no parágrafo que já lista a v5.136, a v5.133 e as anteriores.
- **"Barramento de comandos"** — o `__para` do `display-ready` endereçado, e por que ele conserta um defeito que **já existe hoje** independentemente da LAN.
- **"Divergências entre o caminho web e o nativo"** — três linhas novas na tabela: *tela na rede* (não existe no navegador × servidor LAN), *`#startBtn`* (ganha a terceira coluna: no cliente LAN ele volta, e é escondido de propósito porque o cliente nasce mudo), e *`display-ready`* (passa a ser endereçado nos dois caminhos).
- **"Build e distribuição"** — os testes novos: `lan-http.test.mjs` (oráculo em Node puro, **sem `continue-on-error`**, ao lado do `webview-range.test.mjs`) e `display-smoke.mjs` (Chromium, `continue-on-error`, na família dos seis que já existem).
- **"Regras de desenvolvimento"** — uma linha: **nada que venha da LAN entra no barramento de comandos**, e o instantâneo é montado em JS, nunca remontado em Kotlin.

### `docs/ARQUITETURA-WEB.md`

- **Uma seção "O cliente da rede local"**: as duas metades de `shared/lan.js`, a ordem dos dois `<script>` em `display/index.html` e **por que ela não pode ser um só** (`db.js:801` lê `__AVBus` na avaliação; `db.js:889` sobrescreve `AVDB` incondicionalmente); o adaptador de `AVDB` — quais **6 das 30 funções** o Display consome e por que `opfsGetFile` só vale para a imagem da estrofe; e o instantâneo, campo a campo, com a regra **`stream` sempre nulo** e o porquê.
- **Na seção da letra sincronizada:** o tique externo (`updateLyricSlide` alimentado pelo `currentTime` relayado) e por que ele dispensa qualquer mídia falsa.
- **Na seção da Camada de Texto:** que `showText` não toca o banco, e que é por isso que ela é a primeira coisa a funcionar na rede.
- **No cronômetro/sorteio:** o `offset` de relógio, e por que o parâmetro `now` de `chronoReading`/`drawReading` já existia esperando por isto.

### `docs/AUDITORIA-2026-08.md`

Duas entradas que a auditoria pode registrar **antes** de qualquer implementação, porque são defeitos de hoje descobertos por esta análise:

1. **`display-ready` não tem destinatário** — qualquer segunda instância de `/display/` (hoje, uma aba aberta à mão para depurar) faz a TV rodar um `load` completo.
2. **Nenhum teste jamais carregou `/display/`** — a metade do sistema que a CI nunca executou.

### `README` / mensagem ao operador

Quando a fase 1 sair, a mensagem que a anuncia precisa dizer, nesta ordem: que **exige instalar o APK** (o OTA não leva o servidor); que **é preciso digitar o endereço uma vez** na TV e reservar o IP no roteador; que **a tela do cliente precisa ser configurada para não apagar**; e o que ela **não** mostra ainda — vídeo, imagem e apresentação —, porque um recurso que faz metade do que o nome sugere é aceitável, e um que faz metade em silêncio não é.
