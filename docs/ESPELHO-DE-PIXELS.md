# ESPELHO DE PIXELS — especificação de implementação

> **Estado:** especificação fechada. Nada implementado. **Substitui**
> [`PLANO-ESPELHO-DE-PIXELS.md`](PLANO-ESPELHO-DE-PIXELS.md) por inteiro — aquele documento
> passa a ser histórico e não deve ser consultado para decidir nada. De
> [`PLANO-TELAO-NA-REDE.md`](PLANO-TELAO-NA-REDE.md) sobrevivem a §7 (pareamento, que este
> documento REINSTALA depois de uma versão intermediária tê-la afrouxado) e as seções sobre
> AP isolation e bootstrap do endereço.
>
> Quem for escrever o código não precisa decidir mais nada. Onde há escolha, ela está tomada
> aqui, com o motivo. Onde o motivo é uma medição que ainda não existe, está dito qual medição e
> o que cada resposta decide — e o próprio recurso a produz na primeira vez que for ligado.
>
> **Convenção de confiança, usada em todo o texto:**
> **(código)** — li o arquivo, cito `arquivo:linha` ·
> **(AOSP)** — fonte da plataforma, com link ·
> **(doc)** — documentação oficial, com link ·
> **(spec)** — norma W3C/WHATWG/IETF ·
> **(prática)** — produto real que faz isso ·
> **(aparelho)** — não afirmo; digo qual experimento responde.

---

## Índice

1. [Resumo executivo](#1-resumo-executivo)
2. [Topologia e a escada de degradação](#2-topologia-e-a-escada-de-degradação)
3. [Arquivo por arquivo — o que nasce](#3-arquivo-por-arquivo--o-que-nasce)
4. [O que muda no código existente](#4-o-que-muda-no-código-existente)
5. [O protocolo do fio](#5-o-protocolo-do-fio)
6. [Ordem de implementação](#6-ordem-de-implementação)
7. [Verificação: o CI, o aparelho e o diagnóstico embutido](#7-verificação-o-ci-o-aparelho-e-o-diagnóstico-embutido)
8. [Os riscos que sobrevivem](#8-os-riscos-que-sobrevivem)
9. [Impacto na documentação](#9-impacto-na-documentação)
10. [O que NÃO fazer — nominalmente](#10-o-que-não-fazer--nominalmente)

---

## 1. RESUMO EXECUTIVO

### 1.1 O método, em uma frase

**O app cria uma tela virtual PRIVADA sua, hospeda nela uma segunda `Presentation` com o mesmo
`/web/display/`, codifica o framebuffer dessa tela com o `MediaCodec` do aparelho e serve as NALUs
por HTTP na rede local; o navegador remonta um fMP4 em JavaScript e entrega a uma `MediaSource`.**

```
 ┌────────────────────────── celular ──────────────────────────┐   ┌─── navegador na LAN ───┐
 │  MirrorPresentation → o MESMO /web/display/                  │   │                        │
 │        ↓ renderiza em                                        │   │                        │
 │  VirtualDisplay PRIVADO (flags = 0) ──Surface──→ MediaCodec ──HTTP chunked──→ fmp4.js → MSE → <video>
 └──────────────────────────────────────────────────────────────┘   └────────────────────────┘
```

A peça que faz isto valer a pena continua sendo a mesma do plano anterior, e ela não mudou: **o
cliente não reimplementa nada e o Kotlin não decide nada.** O telão de verdade roda no celular —
com o `stage.js`, os fades, a cortina, a Camada de Texto, o `mse.js` e até o embed do YouTube — e o
que atravessa a rede são **pixels**. A invariante 5 sai ilesa, e o espelho **não tem como ser
parcial**: ele copia quadros, não sabe o que eles significam.

### 1.2 Por que este é o caminho consolidado

- **A cadeia é API pública e não pede permissão nenhuma.** `DisplayManagerService.createVirtualDisplayInternal`
  só checa permissão para `AUTO_MIRROR`, `SECURE`, `TRUSTED`, `OWN_DISPLAY_GROUP` e
  `ALWAYS_UNLOCKED`; um display privado sem nenhuma dessas passa direto, e a própria mensagem de
  erro do framework aponta para o caminho certo
  (*"please use the flag VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY"*).
  **(AOSP — [DisplayManagerService.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/display/DisplayManagerService.java))**
- **Uma `Presentation` num display privado do próprio app é caminho de primeira classe**, com tipo
  de janela dedicado (`TYPE_PRIVATE_PRESENTATION`, público) que `PhoneWindowManager.checkAddPermission`
  devolve como `ADD_OKAY` sem permissão, e cuja única exigência no `WindowManagerService` é
  `displayContent.isPrivate()`. **(AOSP)**
- **Precedente em produção, com `flags = 0` literal:** é o "virtual display mode" do
  `webview_flutter` — um WebView numa `Presentation` num `VirtualDisplay` privado —, embarcado em
  milhões de apps. **(prática — [VirtualDisplayController.java](https://raw.githubusercontent.com/flutter/flutter/master/engine/src/flutter/shell/platform/android/io/flutter/plugin/platform/VirtualDisplayController.java))**
- **O `MediaCodec` alimentado por `createInputSurface` é o pipeline do `scrcpy`** e de todo gravador
  de tela do Android. **(prática)** *Ressalva importante: o `scrcpy` vale como referência do laço do
  encoder e de NADA mais — ele cria o display por API oculta, com `PUBLIC|TRUSTED`, porque roda com
  UID shell. Copiar as flags dele dá `SecurityException` num app comum.*
- **O readback de vídeo por hardware já acontece neste app todo domingo**, e é o argumento mais
  forte que existe a favor do R1: o Miracast do operador **é este mesmo pipeline** — o
  `WifiDisplayAdapter` cria o display do dongle e o framebuffer é lido e codificado em H.264 em
  tempo real. O `<video>` local, a transmissão direta do `mse.js` e o embed do YouTube **já
  atravessam esse readback**. **(AOSP)**

### 1.3 O que este documento corrige do plano anterior

Sete correções técnicas já levantadas, mais oito descobertas novas. Cada uma está desenvolvida na
seção indicada; a tabela existe para que ninguém "conserte" de volta o que foi consertado.

| # | O que o plano anterior dizia | O que é verdade | Onde |
|---|---|---|---|
| **C1** | `setInteger(KEY_REPEAT_PREVIOUS_FRAME_AFTER, …)` | **A chave é `long`.** *"The associated value is a **long** and gives the time in microseconds after which the frame previously submitted to the encoder will be repeated **(once)**"* — o `ACodec` a lê com `findInt64`, e um int32 simplesmente **não é encontrado**: sem exceção, sem log **(AOSP `MediaFormat.java`)** | §3.3 |
| **C2** | "repetir o quadro a cada 500 ms dá **piso de 2 fps**" | **Repete UMA vez.** O problema é real; a solução proposta não o resolve. O conserto é um batimento no JS, que chega por OTA | §3.3, §4.1 |
| **C3** | "densidade fixa em **160 dpi** — é o que um dongle reporta" | **Falso.** O AOSP usa `min(w,h) × DENSITY_XHIGH / 1080` para display externo ⇒ uma TV 1080p reporta **320 dpi** e o `/display/` de hoje é desenhado num viewport CSS de **960×540** **(AOSP `DisplayDeviceInfo.setAssumedDensityForExternalDisplay`)** | §3.2 |
| **C4** | criar com `PRESENTATION \| OWN_CONTENT_ONLY` | **`flags = 0` basta e é melhor.** `OWN_CONTENT_ONLY` *"is implied whenever neither PUBLIC nor AUTO_MIRROR have been set"*, e `FLAG_PRESENTATION` **não é conferido** no ramo `TYPE_PRIVATE_PRESENTATION` **(AOSP)** | §3.2 |
| **C5** | o risco do filtro de display é "janela de corrida" | **No Android 14+ é determinístico.** A ordenação por tipo foi removida: hoje é `getDisplays(displayIds, DisplayManager::isPresentationDisplay)` — ordem de `displayId` — enquanto o javadoc público continua prometendo "sorted by order of preference" **(AOSP)** | §4.1 |
| **C6** | drenar todo `post` do `__AVBus` no espelho | **Isso quebra o recurso.** `display.js:1500` emite `display-ready`, e é ele que faz o Controle mandar a cena. Drenado, o espelho fica no wallpaper para sempre **(código)** | §4.1 |
| **C7** | áudio por `MediaProjection` + `AudioPlaybackCapture` | **Três defeitos**, e o pior é que o desenho se contradizia: a §4 capturava o que o app reproduz e a §6 mandava silenciar o espelho ⇒ **capturava silêncio** | §3.9, §4.1 |
| **D1** | o espelho "desliga sozinho quando a TV conecta, porque a TV é o culto" | **Está invertido.** Com o interruptor "permitir com TV" nascendo desligado, o espelho **só existe sem TV** — e sem TV as telas da rede SÃO o que a congregação vê. A regra mata a projeção que está no ar | §2.1 |
| **D2** | o batimento existe porque "o wake lock do `<video>` cai no stall" | **Não cai.** `playing_` é limpo só por `kPause` e `kEmptied`; eventos de `waiting`/stall não são escutados **(Chromium `video_wake_lock.cc`)**. O batimento continua necessário por outros motivos. **Nasceu a 1 Hz e foi a 8 Hz na v5.144**, depois de a primeira rodada em aparelho mostrar que 1 Hz zera a margem do cliente (amostra de 1 s + o atraso de um quadro do muxer) | §3.3 |
| **D3** | fragmento de 1 quadro com duração escrita na hora | **Produz `buffered` fragmentado.** Com taxa variável, escrever a duração antes de conhecer o próximo PTS abre buracos, e navegador **para em buraco**. Muxer com **atraso de um quadro** | §3.11 |
| **D4** | `VirtualDisplay.setSurface` para trocar VÍDEO⇄IMAGEM, e a sonda rodando no display de produção | *"Detaching the surface that backs a virtual display has a **similar effect to turning off the screen**"* **(AOSP)**. `setSurface` sai do desenho inteiro | §3.2 |
| **D5** | `FLAG_KEEP_SCREEN_ON` copiado do molde do `StagePresentation` + Wi-Fi lock resolvendo latência | Um display privado ganha **`FLAG_NEVER_BLANK`** por não ser `PUBLIC` — ele **nunca entra no caminho de blank do PowerManager**, com a tela do celular apagada. E `WIFI_MODE_FULL` é *"deprecated and non-functional"*; `LOW_LATENCY` exige **app na frente e tela acesa**. As duas promessas eram incompatíveis | §3.1, §3.8 |
| **D6** | `ServerSocket(porta)` | Liga em **0.0.0.0**, inclusive `rmnet`. Operadoras brasileiras entregam **IPv6 globalmente roteável** ao aparelho. Bind explícito ao IPv4 da Wi-Fi, e recusa em celular/VPN | §2.3, §3.6 |
| **D7** | pareamento por PIN, token sem prazo, na URL, sem o operador | Regressão contra o `PLANO-TELAO-NA-REDE.md` §7, que era mais rigoroso. **Reinstalado**: operador no laço, token com prazo, **nunca na URL**, comparação em tempo constante, bloqueio por origem antes de qualquer rotação | §3.5, §5.4 |
| **D8** | "zero dependência nova" como resposta suficiente | Verdade e meia verdade: o único código novo que encara a rede seria também o único sem oráculo, **no mesmo documento que recusa o RFC 6455 por falta de oráculo**. `EspelhoHttp`/`EspelhoPares` viram funções **puras** e o JUnit entra como **quarta exceção declarada** | §3.4, §3.5, §7.1 |

### 1.4 O que o fato novo (o site HTTPS do operador) muda — e o que não muda

**Não muda a fundação.** O enunciado do projeto diz que *a rede da igreja é ruim e pode não ter
internet*, e todo caminho que passe pelo site — página, sinalização, ou até só o DNS de um nome com
certificado válido — morre num domingo sem internet, **de um jeito indistinguível de AP isolation**.
Um recurso de culto cuja disponibilidade depende do link da igreja não é um recurso de culto.

> **HTTP em claro na LAN é o transporte de produção. O site HTTPS é PLACA DE RUA, nunca cano. TLS é
> um degrau que se liga quando existe certificado — nunca o chão.**

O que o site resolve, e resolve bem, é o **bootstrap** — o problema que o `PLANO-TELAO-NA-REDE.md:45`
declarou sem solução elegante. Não buscando o IP privado (isso continua morto: mixed content, Local
Network Access, certificado impossível), mas sendo o **quadro de avisos**: `igreja.org.br/telao`
mostra o endereço do dia em corpo grande, um QR, e **um link de navegação de topo** para
`http://192.168.0.42:8787`. Navegação de topo `https:` → `http:` **não é mixed content** e **não passa
pelo prompt de LNA** (que gateia subrecursos e navegação de *subframe*), e o Chrome **isenta faixas
RFC1918 do HTTPS-First Mode** — não há interstício.
**(spec — [WICG/local-network-access](https://github.com/WICG/local-network-access/blob/main/explainer.md))**

E o que ele **não** compra:

- **WebCodecs continua fora**, e não por contexto seguro. Ver §3.10: `VideoDecoder` desenha num
  `<canvas>`, e canvas **não segura a tela acesa**; ele obrigaria a escrever a sincronia A/V que a
  `MediaSource` dá de graça; exclui Firefox Android e o navegador embarcado de TV (webOS 6.3.2 é
  Chromium 79, WebCodecs é Chrome 94+); e **não economiza o `fmp4.js`**, porque o piso continua
  obrigatório.
- **`AudioWorklet` no cliente continua fora** — é `[SecureContext]` **(spec)**. Mas ele **existe
  dentro do WebView do espelho**, que carrega `https://appassets.androidplatform.net/` (invariante 1).
  É essa observação que destrava o áudio inteiro — §3.9.
- **`navigator.wakeLock`** entra como cinto e suspensório quando houver TLS, **nunca como o único
  cinto** — porque o wake lock do `<video>` já resolve o caso, e só no modo vídeo (§2.2, §3.10).

### 1.5 A decisão de papel, que reordena tudo

O plano anterior tratava o espelho como auxiliar e ao mesmo tempo o restringia ao cenário em que ele
é a única imagem que alguém vê. **Isso está resolvido aqui, e é a decisão mais importante do
documento:**

> **O espelho é AUXILIAR por contrato, e por isso ele NUNCA se desliga sozinho.**
>
> Ele liga por ação do operador e desliga por ação do operador, pelo fechamento do app, ou por uma
> falha que o app **nomeia em texto**. Uma TV que conecta não o derruba. Um encoder tomado pelo
> sistema não o derruba em silêncio: ele tenta uma vez, e na segunda falha **desliga com uma
> frase**.
>
> Ligar com a TV já conectada exige **uma confirmação explícita** ("com a TV no ar isto dobra o
> trabalho do aparelho — ligar assim mesmo?"), lembrada pela sessão. Isso substitui o interruptor
> escondido em Configurações, que ninguém acharia e que expressava a decisão errada.

A justificativa: o custo real de rodar com TV (2 WebViews de `/display/`, até 3 `YT.Player`, 2
encodes) é medível e **falha ruidosamente** — `ERROR_INSUFFICIENT_RESOURCE` no `configure`,
`ERROR_RECLAIMED` no laço, `THERMAL_STATUS_SEVERE` no `PowerManager`. Um sistema que mede não
precisa de uma regra que adivinha. E o custo de adivinhar errado é apagar, no meio do louvor, a
imagem que a sala anexa está assistindo.

---

## 2. TOPOLOGIA E A ESCADA DE DEGRADAÇÃO

### 2.1 O desenho, ponta a ponta

```
┌───────────────────────────── celular (UM processo) ──────────────────────────────┐
│                                                                                   │
│  MainActivity ── WebView /web/controle/ ──────────────┐                           │
│       │                                                │ MessageBus + BroadcastChannel
│       │                                                │  (o barramento de sempre)│
│       │                            ┌───────────────────┴──────────────┐           │
│       │                            ↓                                  ↓           │
│       │              StagePresentation (só com TV)          MirrorPresentation     │
│       │              WebView /web/display/                  WebView /web/display/  │
│       │              papel "display"                        papel "espelho"        │
│       │              host = null                            host = null            │
│       │                     ↓                                    ↓                 │
│       │              Display do dongle                  VirtualDisplay PRIVADO     │
│       │              (FLAG_PRESENTATION,                 1280×720 @ 213 dpi         │
│       │               criado pelo sistema)               flags = 0 ⇒ FLAG_PRIVATE  │
│       │                                                          + FLAG_NEVER_BLANK│
│       │                                                        ↓ Surface           │
│       │                                                  MediaCodec H.264          │
│       │                                                  (createInputSurface)      │
│       │                                                        ↓ NALU + PTS(µs)    │
│       │        áudio (Entrega 3): Web Audio DENTRO do WebView do espelho            │
│       │        <video> ─MediaElementSource─┬─gain(0)─→ destination   (salão MUDO)  │
│       │                                    └─worklet─gain(0)─→ destination          │
│       │                                        └─ Int16 → WebMessageListener        │
│       │                                                  MediaCodec AAC-LC          │
│       └────────────────── EspelhoServidor (ServerSocket ligado ao IP da Wi-Fi) ────┤
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                    │ HTTP/1.1 chunked, corpo binário infinito
                                    │ [16 B de cabeçalho][payload] repetido
                   ┌────────────────┴────────────────┬─────────────────┐
                   ↓                                 ↓                 ↓
        navegador 1 (tablet)              navegador 2 (notebook)   navegador 3
        fmp4.js → MediaSource →           idem                     idem
        <video muted playsinline>         (teto rígido de 3 sessões)
```

### 2.2 O relógio mestre é o `MediaCodec` do celular

`bufferInfo.presentationTimeUs` da Surface do VirtualDisplay é **o único eixo de tempo do sistema**,
e ele viaja no fio em todo quadro. Consequências, e todas são economia de código:

- `timescale = 1 000 000` nas duas faixas do fMP4, e `tfdt.baseMediaDecodeTime =
  presentationTimeUs − base da sessão`, **verbatim**. Zero arredondamento, zero deriva.
- **A base é do PROCESSO, não do encoder.** Remontar o encoder **não** rebobina a base — se
  rebobinasse, o `tfdt` andaria para trás e a `MediaSource` quebraria em silêncio. É invariante, e
  está no KDoc de `EspelhoCodec`.
- **A sincronia A/V não é escrita por ninguém.** As duas faixas entram na **mesma `MediaSource`**,
  com carimbos do mesmo relógio, em `mode = 'segments'` — é literalmente para isso que a
  `MediaSource` existe. Qualquer relógio em JS aqui seria código novo para refazer, pior, o que o
  `<video>` já faz.
- **Sem B-frames** (`KEY_MAX_B_FRAMES = 0`; e não se define `KEY_PROFILE` para High) ⇒ `DTS == PTS`
  ⇒ o `trun` não precisa de `composition_time_offset`.
- O cliente **não tem relógio**: ele persegue a borda com `playbackRate` (idioma do `video-rtc.js`
  do go2rtc — **prática**) e mantém uma janela viva de ~5 s com `remove()` +
  `setLiveSeekableRange()`.
- **Nada de NTP caseiro, nada de handshake de latência.** A regra 12 da §10 do
  `PLANO-TELAO-NA-REDE.md` sobrevive palavra por palavra, e aqui é ainda mais forte, porque não
  existe segunda linha de tempo a reconciliar.

O `display-status` do barramento, o `SYNC_DRIFT = 1.6 s` (`controle.js:1177`) e o
`snoopDisplayStatus` **não participam disto de forma nenhuma** — e é justamente o que o dreno da
§4.1 garante.

### 2.3 A rede: onde o socket liga, e por que isso é a linha mais importante da seção

`ServerSocket(8787)` liga em **0.0.0.0** — toda interface do aparelho, inclusive `rmnet`. E o
enunciado deste projeto diz que a igreja pode não ter internet, cujo desfecho normal é o celular em
dados móveis. Operadoras brasileiras entregam **IPv6 globalmente roteável** ao aparelho, sem NAT e
sem firewall implícito. O resultado seria **o culto em H.264 numa porta alcançável do mundo,
protegida por seis dígitos** — e ninguém no prédio teria como perceber.

**A regra, e ela não é negociável:**

1. O socket é ligado ao **endereço IPv4 da rede ativa**, explicitamente
   (`ServerSocket().bind(InetSocketAddress(ipv4DaWifi, porta), backlog)`), **nunca** pelo construtor
   de porta e **nunca** em `::`. Os endereços IPv6 temporários do Android rotacionam, e um bind em
   `::` reintroduz o problema por outra porta.
2. **Recusa ligar** quando `NetworkCapabilities` não tiver `TRANSPORT_WIFI`, ou tiver
   `TRANSPORT_CELLULAR` ou `TRANSPORT_VPN` — com a frase no Registro, nunca em silêncio.
3. `registerNetworkCallback` → `onLost` / `onCapabilitiesChanged` que perca o Wi-Fi **desliga o
   servidor**. Um endereço que sumiu não pode continuar escutando.

Isto reinstala, com mais rigor, a regra do `PLANO-TELAO-NA-REDE.md:416` ("sem Wi-Fi, não desenhar o
endereço nem o QR"), que a versão intermediária tinha perdido.

### 2.4 TLS — o degrau, com as três condições que são do operador

Certificado público para IP privado **não existe e nunca vai existir**: a CA/Browser Forum proibiu
*Reserved IP Addresses* e *Internal Names* em 2015 e mandou revogar os remanescentes em 2016
**(doc — [CA/B Forum](https://cabforum.org/working-groups/server/internal-names/))**. A Let's Encrypt
passou a emitir para IP, **só IP público, só HTTP-01/TLS-ALPN-01**. Autoassinado com CA instalada no
cliente está **descartado**: desde o Android 7 apps com `targetSdk ≥ 24` não confiam em CA de
usuário, o Chrome do Android exige Certificate Transparency (`ERR_CERTIFICATE_TRANSPARENCY_REQUIRED`
numa CA própria), e o navegador de uma smart TV não tem UI para instalar CA. Trocaria uma limitação
silenciosa e previsível por **uma tela vermelha em cada culto, em cada aparelho**.

O que **funciona** é o modelo Plex/Tailscale: **um NOME que o operador controla, com registro `A`
apontando para o IP privado, e certificado emitido por DNS-01** **(prática — `*.plex.direct`,
`*.ts.net`)**. Do lado Kotlin custa ~40 linhas e **zero dependência**: `KeyStore.getInstance("PKCS12")`
→ `KeyManagerFactory` → `SSLContext.getInstance("TLS")`, e daí em diante os `InputStream`/`OutputStream`
são idênticos. O custo de CPU é irrelevante: 3 Mbps = 0,375 MB/s, e AES-GCM com as extensões ARMv8
roda em ~1,2 GB/s por núcleo — **~0,03% de um núcleo**.

**As três condições, e as três são do operador, não do código:**

1. um subdomínio dedicado com **wildcard por DNS-01** (`*.lan.igreja.org.br`), para trocar de IP sem
   reemitir;
2. **uma entrada estática de DNS no roteador da igreja** (`address=/telao.igreja.org.br/192.168.0.42`
   no dnsmasq). Sem ela o nome só resolve com internet, e a proteção contra DNS rebinding — ligada
   por padrão em pfSense e Fritz!Box, e o motivo nº 1 de suporte do próprio Plex — o quebra em
   silêncio;
3. renovação automática. O teto de validade já é **200 dias** e cai para 100 em 2027 e 47 em 2029
   **(doc — [Ballot SC-081v3](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/))**.

**A chave privada nunca vai no APK** (as Releases são públicas no GitHub) e **nunca vai no backup**
(mesma disciplina de `res/xml/backup_rules.xml` e `data_extraction_rules.xml`, que já existem para o
bundle OTA). O `.p12` chega por importação manual (`pickDoc`, que já existe), **com a senha digitada
à mão pelo operador** — senha no mesmo canal do arquivo anula o `sha256` e o TLS, coisa que o
próprio `WebUpdater.kt:558` já admite por escrito **(código)**.

**E a "placa de rua" NÃO leva credencial no APK.** A ideia de o celular publicar sozinho o IP no
site do operador exige um segredo compartilhado, e o segredo estaria num binário público — qualquer
pessoa reescreveria `igreja.org.br/telao` e a página oficial da igreja passaria a apontar para onde
o atacante quisesse, com o domínio da própria igreja. As duas formas aceitas são: o operador digita
o endereço no site à mão (uma vez por IP novo, e o IP é fixo por reserva de DHCP), ou uma credencial
**por aparelho**, digitada em Configurações — a mesma disciplina da senha do `.p12`. E a página fica
**atrás de login**, não "atrás de login *ou* com valor que expira": expirar não esconde nada de quem
olha durante o culto, que é a janela em que o valor é útil.

### 2.5 A escada de degradação, inteira

Cada linha diz **quem perde o quê**. O espelho é auxiliar: nenhuma linha aqui apaga a TV nem a
preview em tela cheia.

| Degrau | Quando | O que acontece | O que o operador vê |
|---|---|---|---|
| **Sem internet** | domingo comum na igreja | a placa de rua não abre; **o espelho funciona inteiro** | o endereço está na folha do espelho e na notificação · Registro: `sem internet — endereço só no app` |
| **Sem Wi-Fi** | celular em dados móveis | **o espelho RECUSA ligar** (§2.3) | `só liga em Wi-Fi — este aparelho está em dados móveis` |
| **Wi-Fi caiu com o espelho no ar** | AP reiniciou | o servidor desliga sozinho; a tela virtual e o encoder são soltos | `a rede sumiu — espelho desligado` |
| **Sem certificado** | o estado normal | serve só `http://IP:8787`. Perde `wakeLock`, `crypto.subtle`, `randomUUID` (nenhum é usado como caminho principal) | Registro: `TLS: desligado (sem certificado)` |
| **Certificado vencido** | renovação falhou | **o listener TLS não sobe**; só HTTP | `TLS: RECUSADO — certificado venceu em 12/03` · aviso 20 dias antes |
| **Relógio do cliente errado** | tablet meses na gaveta | o **cliente** reprova o certificado; o servidor está bem | a página de erro diz *"confira a data deste aparelho"* e oferece o `http://IP` no mesmo endereço |
| **Nome não resolve** | rebinding protection, ou sem internet | o cliente tenta `https://nome` e falha | Registro: `TLS ligado, mas 0 conexões por nome · 2 por IP` |
| **AP isolation** | roteador da igreja | servidor de pé, porta escutando, **o SYN nem chega** | **a linha mais importante do diagnóstico:** `nenhuma conexão desde que ligou (há 14 min) — se alguém abriu o endereço, o roteador está isolando os clientes` + a saída operacional (trocar de SSID / usar o hotspot do celular) |
| **Navegador sem MSE** (iPhone) ou **sem fetch streams** (TV velha) | por cliente | o cliente **se relata** no pareamento e recebe a página de modo imagem | folha do espelho: `Modo: Vídeo · Imagem` — a troca é do OPERADOR, nunca automática (§3.2) |
| **Modo imagem** | escolha do operador, ou Entrega 1 | 8–12 fps de JPEG; **a tela do cliente APAGA** (não há `<video>`) | dito na própria página do cliente: *"nesta modalidade a tela do aparelho pode apagar sozinha"* |
| **`ERROR_RECLAIMED`** | app minimizado, memória apertada | **uma** remontagem com backoff; segunda falha em 5 min ⇒ o espelho **desliga com frase** | `encoder tomado pelo sistema 2× — espelho desligado` |
| **`ERROR_INSUFFICIENT_RESOURCE`** | ligar com TV + vídeo tocando | **recusa ligar**, ruidosamente | `o aparelho não tem encoder livre agora — tente sem a TV conectada` |
| **`THERMAL_STATUS_SEVERE`** | 2 h de culto sem carregador | cai **bitrate e taxa de quadros**, nunca resolução (mudar resolução refluiria o layout — §3.2) | `aparelho quente — qualidade reduzida` |
| **TV conecta com o espelho no ar** | dongle reaparece | **nada acontece com o espelho** (D1). A TV sobe pelo caminho de sempre | Registro: `telão conectado com o espelho no ar — 2 encodes` |
| **Activity recriada** (fonte, idioma, Recentes) | comum, e já documentado neste repositório | a `MirrorPresentation` renasce pelo `syncEspelho()` sobre o MESMO VirtualDisplay | um piscar de ≤1 s; Registro: `janela do espelho remontada` |
| **Renderer do espelho morre** | OOM | `onRendererGone` remonta o WebView, que recarrega `/display/` e dispara `display-ready` ⇒ o Controle reenvia a cena | `renderer do espelho remontado` |
| **Cliente lento** | tablet no fundo do salão | fila cheia ⇒ **esvazia a fila inteira** e espera o próximo IDR | pisca uma vez e volta certo; contador `descartes` no Registro |
| **Cliente fantasma** (dormiu sem FIN) | comum | `write()` bloqueado por minutos; um teto de tempo fecha o socket **de fora** | `tela B: sem escrita há 47 s — desconectada` |
| **Quarto cliente** | teto rígido de 3 sessões | frase, não silêncio | `limite de 3 telas — peça a alguém para fechar a página` |

---

## 3. ARQUIVO POR ARQUIVO — O QUE NASCE

O estilo dos KDoc abaixo é o do repositório: eles explicam **por que**, não o que. Os trechos de
assinatura são contrato, não sugestão.

### 3.1 `MirrorPresentation.kt` (~120 linhas)

**Responsabilidade:** hospedar o WebView do espelho na tela virtual. É irmã de `StagePresentation`,
**cópia do molde e não parametrização da existente** — `StagePresentation` é o telão de verdade e o
`CLAUDE.md` a lista como intocada; misturar os dois faria uma mudança no espelho poder derrubar a
projeção.

```kotlin
/**
 * O ESPELHO — uma segunda `Presentation`, na tela virtual privada que este app
 * cria para si (ver [EspelhoDisplay]). Ela desenha o MESMO `/web/display/` que
 * a TV desenha, e o framebuffer dela é o que vai para a rede.
 *
 * TRÊS PEÇAS COPIADAS DO MOLDE, E SEM NENHUMA DELAS O ESPELHO MORRE AO
 * MINIMIZAR O APP — que é o estado normal deste app no meio do culto:
 *
 *  1. `onStop()` NÃO DERRUBA NADA. `Presentation` é um `Dialog`, e
 *     `Dialog.onStop()` chega quando o app sai da frente — não quando a tela
 *     acabou (ver `StagePresentation.onStop`, e a lição de v1.28 que o
 *     documentou).
 *  2. [keepPlaying] desfaz a suspensão que o Chromium aplica, chamado do
 *     `onStop` da Activity.
 *  3. `keepVisible = true` (`KeepVisibleWebView`): sem ele o renderer se
 *     declara `hidden` e o batimento de §3.3 é a primeira coisa a ser
 *     estrangulada.
 *
 * O QUE **NÃO** SE COPIA DO MOLDE, e cada omissão tem dono:
 *
 *  - **`FLAG_KEEP_SCREEN_ON` fica de fora.** Em WindowManager esse flag
 *    alimenta o *holding screen wake lock*, que é do DISPOSITIVO, não da tela
 *    em que a janela mora: copiá-lo manteria a tela do celular acesa por duas
 *    horas — AMOLED de 6,8", uma ordem de grandeza acima dos ~200 mW do núcleo
 *    do encoder. E ele não é necessário: um display virtual criado sem
 *    `VIRTUAL_DISPLAY_FLAG_PUBLIC` ganha `FLAG_NEVER_BLANK`
 *    (`VirtualDisplayAdapter`), e `DisplayManagerService.updateDisplayStateLocked`
 *    RETORNA SEM FAZER NADA para displays com essa flag. O espelho continua
 *    produzindo quadros com o celular bloqueado, por construção.
 *  - **`MicChromeClient` fica de fora.** Instalá-lo daria DOIS `getUserMedia`
 *    no mesmo processo e dois `GainNode` no mesmo destino: realimentação
 *    pública. A ausência dele faz o WebView negar `getUserMedia` em silêncio —
 *    e é por isso que `display.js` também recusa `startMic` no papel espelho
 *    (§4.1): a negativa silenciosa emitiria `mic-status:{on:false}` e apagaria
 *    o estado do microfone VERDADEIRO.
 *  - **O handler `/saf/` fica de fora** (`assetLoader(ctx, withSaf = false)`),
 *    pela mesma razão do telão.
 *
 * E a linha que decide se isto é um espelho ou um comprometimento do aparelho:
 * a ponte nasce com **`host = null`**. Este documento hospeda a IFrame Player
 * API do YouTube POR DESIGN; com `host != null`, qualquer script de terceiro
 * ali dentro ganharia `pickFolder`, `listFolder`, `pickDoc`, `openExternal` —
 * e agora também `espelhoLigar`. Ver `StagePresentation.buildWebView`, que já
 * faz exatamente isso, e `tools/ponte.test.mjs`, que passa a travá-lo.
 */
class MirrorPresentation(
    outerContext: Context,
    display: Display,
) : Presentation(outerContext, display, R.style.Theme_AvIasd_Presentation) {

    var web: WebView? = null
        private set

    override fun onCreate(savedInstanceState: Bundle?)   // fundo preto, immersive, buildWebView
    private fun buildWebView(root: FrameLayout)          // remonta em onRendererGone
    override fun onStop()                                // super, e nada mais
    fun keepPlaying()                                    // onResume + resumeTimers
    fun release()                                        // idempotente
    fun avaliar(js: String, cb: (String) -> Unit)        // só diagnóstico (§7.4)
}
```

**Invariantes que o código precisa respeitar:**

- **É criada e mostrada SEMPRE na main thread.** `Dialog` exige uma thread com `Looper`; a fila `io`
  do `NativeBridge` é `Executors.newSingleThreadExecutor` com uma `Thread` daemon **sem Looper**
  (`NativeBridge.kt:113-115` — **código**). Um `io.execute { MirrorPresentation(...) }` dá
  `Can't create handler inside thread that has not called Looper.prepare()` no primeiro toque, na
  frente do operador. Isto está dito porque é o erro que alguém comete.
- `role = "espelho"` na ponte. É o papel novo, e ele é seguro por construção: `__AV_ROLE__` aparece
  em três linhas do bundle inteiro (`shared/native.js:27,97,105`) e as duas leituras comparam
  `!== 'controle'` — **nenhum caminho testa `=== 'display'`** (**código**).
- `MessageBus.attach(w)` no fim, `detach` no `release`. Sem isso o barramento fica com cliente
  morto.

### 3.2 `EspelhoDisplay.kt` (~300 linhas)

**Responsabilidade:** dono do `VirtualDisplay`, da `MirrorPresentation`, da densidade e da sonda de
readback. É o único arquivo que fala com o `DisplayManager`.

```kotlin
object EspelhoDisplay {

    /** Resolução do espelho. NÃO muda durante a sessão — ver o invariante 3. */
    const val LARG = 1280
    const val ALT  = 720

    /**
     * O ESPELHO PRECISA DESENHAR NO MESMO VIEWPORT CSS QUE A TV, e a conta não
     * é sobre dpi: é sobre viewport.
     *
     * O viewport CSS é `pixels / (densityDpi / 160)` (`useWideViewPort` +
     * `<meta viewport width=device-width>`, que `display/index.html:9` já traz).
     * Uma TV Miracast NÃO reporta 160 dpi: o AOSP calcula
     * `densityDpi = min(w,h) * DENSITY_XHIGH / 1080` para display externo
     * (`DisplayDeviceInfo.setAssumedDensityForExternalDisplay`), logo uma TV
     * 1080p reporta 320 dpi e o `/display/` que a congregação vê HOJE é
     * desenhado em **960×540 CSS** — não em 1920×1080.
     *
     * A 160 dpi o espelho teria viewport 1280×720: outra quebra de estrofe,
     * outro tamanho relativo de letra, outro enquadramento. Deixaria de ser
     * espelho, e ninguém veria a diferença olhando o celular.
     *
     * Então a densidade é DERIVADA do alvo, nesta ordem:
     *   - com TV conectada: `alvoCss = tv.widthPixels * 160 / tv.densityDpi`
     *   - sem TV: 960 (o que a fórmula do AOSP dá para qualquer 16:9 externo)
     * e daí `dpi = LARG * 160 / alvoCss`, arredondado.
     *
     * Com LARG=1280 e alvo=960 o resultado é 213 dpi ⇒ 961,5 px CSS. NÃO
     * prometemos identidade de pixel — 213,33 não é inteiro e nunca vai ser.
     * Prometemos o mesmo viewport com meio ponto percentual de folga, o que não
     * muda uma quebra de linha. O diagnóstico imprime os DOIS números para que
     * essa leitura nunca dependa de fé.
     */
    fun dpiPara(alvoCss: Int): Int = Math.round(LARG * 160f / alvoCss)

    fun ligar(act: Activity, modo: Modo, onQuadro: (Quadro) -> Unit): Resultado
    fun desligar()
    fun sincronizarJanela(act: Activity)   // chamado do onCreate da Activity — invariante 5
    fun pedirIdr()
    fun sonda(): Sonda                     // §7.4 — display DESCARTÁVEL, nunca o de produção
    val diag: EspelhoDiag
}

enum class Modo { VIDEO, IMAGEM }
```

**Criação, na ordem que a API impõe** — *"[createInputSurface] may only be called **after configure**
and **before start**"* **(doc `MediaCodec`)**:

```kotlin
codec.configure(fmt, null, null, CONFIGURE_FLAG_ENCODE)
val surface = codec.createInputSurface()
vd = dm.createVirtualDisplay("av-espelho", LARG, ALT, dpi, surface, /* flags = */ 0)
codec.start()
// e SÓ ENTÃO, na main thread:
presentation = MirrorPresentation(act, vd.display).also { it.show() }
```

**Invariantes:**

1. **`flags = 0`. Nunca `VIRTUAL_DISPLAY_FLAG_PUBLIC`, nunca `FLAG_PRESENTATION`.**
   `OWN_CONTENT_ONLY` *"is implied whenever neither PUBLIC nor AUTO_MIRROR have been set"* **(AOSP)**,
   e `FLAG_PRESENTATION` só serviria para pôr o display em `DISPLAY_CATEGORY_PRESENTATION` — que é
   exatamente o problema que o filtro da §4.1 depois teria de consertar. E **`PUBLIC` é a flag
   proibida**: ela implica `AUTO_MIRROR` (que exige `CAPTURE_VIDEO_OUTPUT`) e **remove
   `FLAG_NEVER_BLANK`**, que é o que faz o espelho sobreviver à tela do celular apagada. Quem um dia
   perseguir um `InvalidDisplayException` acrescentando `PUBLIC` perde as duas coisas de uma vez.
2. **Se `presentation.show()` lançar, o espelho RECUSA LIGAR e registra a classe e a mensagem da
   exceção.** Não existe "tentar de novo com `FLAG_PRESENTATION`": o ramo do `WindowManagerService`
   que confere `FLAG_PRESENTATION` é o de `TYPE_PRESENTATION` (público) e está **inalcançável** para
   uma janela `TYPE_PRIVATE_PRESENTATION`, que é a que `Presentation.getWindowType()` escolhe
   sozinha para display privado **(AOSP)**. Se `show()` falhar, a causa é outra (token, contexto), e
   trocar a flag compraria o desastre da C5 em troca de nada.
3. **A resolução do VirtualDisplay é IMUTÁVEL durante a sessão.** Degradar térmica mudando a
   resolução mudaria a densidade, e a densidade define o viewport CSS: o `/display/` refaria a
   quebra de estrofe **na frente da congregação**. Degrade por bitrate e por taxa de quadros.
4. **`VirtualDisplay.setSurface` NÃO é usado — em lugar nenhum.** *"Detaching the surface that backs
   a virtual display has a similar effect to **turning off the screen**"* **(AOSP
   `VirtualDisplay.java`)**, e o novo consumidor não recebe nada até a janela redesenhar — o que numa
   cena estática pode ser um segundo inteiro. Consequências desta regra, e as três importam:
   - **O modo é escolhido em `ligar()`.** Trocar VÍDEO⇄IMAGEM é `desligar()` + `ligar(outroModo)`:
     um rebuild completo de ~1 s, iniciado pelo operador, anunciado na folha. Simples, honesto, e
     apaga a classe de bug inteira.
   - **A sonda roda num VirtualDisplay SEPARADO e descartável** (§7.4), nunca no de produção. Ela é
     diagnóstico; pode custar 200 ms a mais.
   - **`ERROR_RECLAIMED` remonta encoder E VirtualDisplay** (a Surface morreu junto), mas
     `release()` *"forcibly removes all remaining windows on the virtual display"* **(AOSP)** — o
     WebView do espelho morre junto e é reconstruído. Por isso a remontagem é **uma**, com backoff, e
     a segunda falha em 5 min **desliga o espelho**: um laço que aloca um WebView inteiro sob pressão
     de memória, no mesmo processo da projeção, é o único caminho deste desenho capaz de derrubar o
     culto por causa de um recurso auxiliar.
5. **A `MirrorPresentation` renasce com a Activity.** O `AndroidManifest.xml:99` **não** inclui
   `fontScale` nem `locale` em `android:configChanges` (**código**), e este repositório já documenta
   duas vezes que isso recria a Activity e que já causou defeito real. Com o serviço mantendo o
   processo vivo, a Activity pode morrer sozinha enquanto o `VirtualDisplay` e o `MediaCodec`
   continuam: **o resultado seria H.264 impecável de um retângulo preto, com todos os contadores
   subindo e nada no Registro.** `MainActivity.onCreate` chama `EspelhoDisplay.sincronizarJanela(this)`
   ao lado do `syncPresentation()`, e o gatilho é a existência do display, não a da Activity. A
   linha **"ritmo"** do diagnóstico (§7.5) é o único detector que existe para esse estado, e por isso
   ela é **alarme**, não enfeite.

### 3.3 `EspelhoCodec.kt` (~240 linhas)

**Responsabilidade:** configurar o encoder e drenar a saída numa thread própria — **nunca** na
thread do WebView, **nunca** na main.

```kotlin
class EspelhoCodec(private val onQuadro: (Quadro) -> Unit) {
    fun configurar(): MediaFormat
    fun iniciar(surfaceRecebida: (Surface) -> Unit)
    fun drenar()          // laço: dequeueOutputBuffer(info, 10_000)
    fun pedirIdr()
    fun soltar()
    val fpsMedido: Float  // §7.5 — a única forma de ver estrangulamento de timer
}

data class Quadro(
    val tipo: Byte,
    val chave: Boolean,
    val descontinuidade: Boolean,
    val ptsUs: Long,      // do relógio do PROCESSO, nunca do encoder — §2.2
    val bytes: ByteArray,
)
```

O formato, com as chaves que decidem "funciona" × "congela no culto":

```kotlin
MediaFormat.createVideoFormat(MIMETYPE_VIDEO_AVC, LARG, ALT).apply {
    setInteger(KEY_COLOR_FORMAT, COLOR_FormatSurface)
    setInteger(KEY_BIT_RATE, 3_000_000)
    setInteger(KEY_BITRATE_MODE, BITRATE_MODE_VBR)
    setInteger(KEY_FRAME_RATE, 30)          // obrigatório; a taxa real é variável
    setInteger(KEY_I_FRAME_INTERVAL, 5)     // ← 5 s (era 10; ver o invariante 3)
    setLong(KEY_REPEAT_PREVIOUS_FRAME_AFTER, 1_000_000)   // ← LONG, e 1 s
    setInteger(KEY_MAX_B_FRAMES, 0)         // API 29+ — DTS == PTS
    setInteger(KEY_PRIORITY, 0)             // tempo real
    setInteger(KEY_LATENCY, 1)              // API 26+
    setInteger(KEY_COLOR_RANGE, COLOR_RANGE_LIMITED)      // ← descritor, não comando
    // NÃO definir KEY_PROFILE: High + B-frames em alguns encoders Samsung
}
```

**Invariantes:**

1. **`setLong`, não `setInteger`, em `KEY_REPEAT_PREVIOUS_FRAME_AFTER`.** *"The associated value is
   a **long**"* **(AOSP `MediaFormat.java`)**, lido com `findInt64`. Um int32 não é encontrado — sem
   exceção, sem log, exatamente o modo de falha do `bytes` no `bgProgress` (v5.137) e do `slideLabel`
   no `nowPlaying` (v5.102). É chave de `configure`, imutável depois.
2. **Ela repete UMA vez, e não é piso de fps.** *"…will be repeated **(once)** if no new frame became
   available since"* **(AOSP)**. O papel que sobra para ela é **garantir o primeiro quadro a um
   cliente que chega numa cena parada**, e é por isso que 1 s basta — 200 ms só acrescentaria uma
   repetição a cada 200 ms em cima do batimento, para nada. Quem mantém o fluxo é o batimento de JS
   (§4.1), que chega por OTA.
3. **`KEY_I_FRAME_INTERVAL = 10`, não 2.** Todo `GET /v` novo é, por construção, um cliente novo, e o
   servidor pede IDR ali mesmo. Manter IDR a cada 2 s é 0,5 keyframe/s para sempre; numa cena
   estática de texto um IDR de 720p ainda custa dezenas de kB, ou seja **centenas de kbps de piso**
   durante o culto inteiro, ×3 clientes, no rádio de um AP de igreja. O `scrcpy` usa 10 s pelo mesmo
   motivo **(prática)**.
4. **`PARAMETER_KEY_REQUEST_SYNC_FRAME` age sobre o próximo quadro PRODUZIDO.** Com a cena parada e o
   encoder sem entrada, pedir IDR **não produz nada** — ele e o batimento são complementares, não
   alternativos. Quem escrever "já pedi IDR, o cliente vai receber" está errado.
5. **`KEY_COLOR_RANGE` é DESCRITOR, não comando.** *"An **optional** key describing the range of the
   component values… 0 if unspecified"* **(AOSP)** — ele não governa a conversão RGB→YUV do encoder em
   *surface-input* e não há `isFormatSupported` para conferir. O `scrcpy` o define **(prática)**, e o
   custo é zero, mas **a promessa "senão o preto sai cinza" não é garantia da plataforma**. Quem
   responde é a sonda, que imprime os valores medidos de uma faixa preta e de uma branca (§7.4).
6. **O `csd` chega em Annex-B.** Para AVC, `csd-0` = SPS e `csd-1` = PPS, *"each parameter set must
   start with a start code of `\x00\x00\x00\x01`"* **(doc `MediaCodec`)**. **A conversão Annex-B →
   `avcC` é trabalho do muxer JS** (§3.11) e é item de orçamento do `fmp4.js` — não do Kotlin.
7. **`ERROR_RECLAIMED = 1101` é o modo de falha do app MINIMIZADO**, que é o estado normal deste app
   no meio do culto: *"the resource manager reclaimed the media resource… the codec must be
   released, as it has moved to terminal state"* **(doc)**. Tratamento: §3.2, invariante 4.
   `ERROR_INSUFFICIENT_RESOURCE = 1100` no `ligar()` é o caso bom — falha ruidosamente, e o espelho
   recusa ligar com a frase certa em vez de degradar calado.
8. **Valores negativos de `dequeueOutputBuffer` são ignorados em silêncio** (`INFO_TRY_AGAIN_LATER`,
   `INFO_OUTPUT_BUFFERS_CHANGED`); `INFO_OUTPUT_FORMAT_CHANGED` é onde se lê `csd-0`/`csd-1`.

### 3.4 `EspelhoHttp.kt` (~200 linhas, **PURO**, zero import de Android)

**Responsabilidade:** transformar bytes em uma requisição validada, e uma decisão em bytes de
resposta. **É a fronteira com o desconhecido, e é a razão de este arquivo ser puro.**

```kotlin
/**
 * O parser HTTP do espelho. ZERO import de Android, de propósito: este é o
 * primeiro código do projeto que aceita entrada de um desconhecido, e é o único
 * lugar do projeto onde um erro vira controle de acesso quebrado em vez de
 * pixel errado.
 *
 * O documento que este substitui recusou o RFC 6455 com o argumento de que
 * seriam "~150 linhas de protocolo SEM ORÁCULO, num repositório sem
 * `app/src/test`". O argumento está certo — e vale igual contra um parser HTTP
 * com autenticação. Por isso o arquivo é puro e por isso o JUnit entra como a
 * QUARTA EXCEÇÃO declarada à regra de zero dependência (ver §7.1): ele não põe
 * um byte no APK, e paga por si na primeira vez que alguém mexer no limite de
 * cabeçalhos.
 */
object EspelhoHttp {
    data class Req(
        val metodo: String, val caminho: String, val query: Map<String, String>,
        val host: String?, val origem: String?, val autorizacao: String?,
        val corpo: ByteArray,
    )
    sealed class Erro { object LinhaLonga; object CabecalhosDemais; object CorpoLongo;
                        object Malformado; object Truncado }

    fun lerRequisicao(entrada: InputStream, hostsAceitos: Set<String>): Result<Req>
    fun resposta(status: Int, tipo: String, corpo: ByteArray, extra: List<String> = emptyList()): ByteArray
    fun cabecalhoChunked(status: Int, tipo: String): ByteArray
    fun chunk(bytes: ByteArray, ini: Int, tam: Int): ByteArray
    fun chunkFinal(): ByteArray
}
```

**Invariantes:**

1. **Tetos duros, todos:** linha de requisição ≤ 2 kB; ≤ 32 cabeçalhos; cada cabeçalho ≤ 4 kB; corpo
   de `POST` ≤ 256 B; `setSoTimeout(10_000)` na leitura. Fora do teto ⇒ resposta curta e `close`.
2. **`read()` NUNCA é tratado como se entregasse a mensagem inteira.** Laço de `readFully`. Sem isso
   o parser desanda **só quando a rede está ruim** — o pior modo de falha possível.
3. **Allowlist EXATA de `Host`**, montada em runtime (`<ip>:<porta>` e o nome TLS quando existir).
   Qualquer outro ⇒ `404`. Isto é a defesa contra **DNS rebinding**: uma página qualquer da internet,
   aberta por um visitante **na rede da igreja**, pode fazer `evil.com` resolver para
   `192.168.0.42` e passar a ser same-origin com o nosso servidor. Em Chromium ≥ 142 o LNA mitiga a
   partir de origem pública; **em Safari e Firefox, não** — e no navegador de uma smart TV, menos
   ainda. *"Validation of the Host header… is an effective mitigation"*, e *"even if the Host header
   is validated, the server must also validate the Origin header"*
   **(prática — [GitHub Security](https://github.blog/security/application-security/localhost-dangers-cors-and-dns-rebinding/))**.
4. **`Origin` ausente ou igual ao próprio.** Qualquer outro ⇒ `404`. E **nunca** emitir
   `Access-Control-Allow-Origin` — nem `*`, nem eco, nem nada. O precedente publicado do modo de
   falhar exato deste desenho existe: *"Binding the local API server to 0.0.0.0 silently discards the
   Trusted Hosts allowlist and reflects any CORS origin"* **(prática — [janhq/jan#8453](https://github.com/janhq/jan/issues/8453))**.
5. **404 IDÊNTICO** para token inválido, rota inexistente e Host recusado. Não vazar existência —
   regra do `PLANO-TELAO-NA-REDE.md:443`, reinstalada.
6. **Cabeçalhos em TODA resposta:** `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: no-referrer`, `Connection: close`. Na página: `Content-Security-Policy:
   default-src 'self'; frame-ancestors 'none'; base-uri 'none'` e `X-Frame-Options: DENY`.
7. **Sem keep-alive, sem `Range`, sem `Content-Encoding`.** E o `nosniff` não é enfeite: sem ele o
   navegador pode segurar os primeiros ~512 B do fluxo para adivinhar o tipo, o que atrasa o
   primeiro quadro.
8. **A invariante 8 do `CLAUDE.md` NÃO se aplica aqui, e a inversão precisa estar escrita.** Num
   `ServerSocket` de verdade quem aplicaria `Range` é o servidor, não o WebView. E aqui não há
   `Range` nenhum — as rotas são fluxos infinitos. **Copiar o `StreamProxy` seria o erro exato.**

### 3.5 `EspelhoPares.kt` (~160 linhas, **PURO**)

**Responsabilidade:** PIN, aprovação pelo operador, tokens, prazo, limitação de taxa. Puro pelo
mesmo motivo do anterior.

```kotlin
object EspelhoPares {
    data class Pendente(val id: String, val relato: Relato, val desde: Long)
    data class Sessao(val token: String, val relato: Relato, val expiraEm: Long)

    fun novoPin(rnd: SecureRandom): String                   // 6 dígitos
    fun tentar(pin: String, origem: String, relato: Relato, agora: Long): Veredito
    fun aprovar(id: String, agora: Long): Sessao?
    fun recusar(id: String)
    fun validar(token: String?, agora: Long): Sessao?
    fun encerrar(token: String)
    fun limpar(agora: Long)
}
```

**Invariantes:**

1. **Token de 128 bits em base64url, `SecureRandom`, exatamente como o `SafRegistry`
   (`SafPathHandler.kt:64-68` — código): aleatório, não contador, opaco.**
2. **O token NUNCA viaja numa URL.** Nem em `?t=`, nem em fragmento, nem no QR. Ele vive em
   `sessionStorage` do cliente e sobe em `Authorization: Bearer`. Isso é possível porque o cliente é
   **uma página só, com dois estados** (pareamento → player), sem navegação entre eles — e porque o
   modo imagem também busca por `fetch`, não por `<img src>` (§3.11). URL vaza para histórico, para
   cache, para captura de tela e para compartilhamento de tela. Regra do
   `PLANO-TELAO-NA-REDE.md:422`, reinstalada.
3. **O token tem prazo e morre com a sessão.** `desligar()` zera tudo. Não há token que sobreviva ao
   culto.
4. **Comparação em tempo constante** (`MessageDigest.isEqual`) para PIN e token.
5. **O operador fica no laço.** PIN correto ⇒ a tela entra como **pendente**, e a folha do espelho no
   Controle mostra `tela pendente — aprovar?`. Há um interruptor `aprovar automaticamente nesta
   sessão` (nasce **desligado**) para quando o operador estiver ocupado. Um PIN de seis dígitos
   visível na tela do celular durante todo o culto é fraco demais para ser o único controle.
6. **Bloqueio por ORIGEM antes de qualquer rotação global.** 5 tentativas erradas do mesmo endereço
   ⇒ 60 s de espera **para aquele endereço**. **O PIN NÃO ROTACIONA por tentativas erradas** — isso
   seria negação de serviço contra o pareamento legítimo: um atacante erra dez vezes de propósito e o
   visitante que está digitando recebe "PIN inválido" para sempre, e numa rede com AP isolation o
   operador culparia a rede. O PIN muda só em `ligar()` ou por ação do operador, e a mudança
   re-renderiza PIN e QR na hora.
7. **A página de pareamento é ANÔNIMA.** Sem versão do app, sem nome do aparelho, sem SSID, sem nome
   da igreja. Reconhecimento não se dá de graça a quem ainda não provou nada.
8. **Teto de 3 SESSÕES, e o slot é do TOKEN, não do socket.** Um `GET /v` com um token que já tem
   conexão **fecha a anterior** antes de contar. Sem isso, três recarregamentos de página trancam o
   operador para fora do próprio recurso. Conexões **em voo** têm teto próprio (8) e prazo de 2 s
   para completar a linha de requisição — separar os dois é o que impede a negação de serviço de
   três TCPs mudos.
9. **Todo texto vindo da rede é saneado AQUI**, não no JS: `[\x20-\x7E]`, corte duro em 120
   caracteres, `\n`/`\r` proibidos, aspas escapadas. O `ua` do relato cabe em 256 bytes e um `\n`
   injetaria linhas falsas no Registro — que é justamente o artefato que o projeto manda copiar e
   repassar (`copiarTexto`, `controle.js:10147` — código). Um diagnóstico que mente é pior que
   diagnóstico nenhum. *(E vale registrar por escrito: `controle.js:10118` usa `textContent`, não
   `innerHTML`. Aquela linha é a diferença entre um espelho e a execução de JavaScript de um
   desconhecido no origin privilegiado que injeta `__AVBridge`. Ela passa a ser load-bearing e o
   comentário tem de dizê-lo.)*

### 3.6 `EspelhoServidor.kt` (~400 linhas)

**Responsabilidade:** sockets, threads, roteamento, fan-out. Usa `EspelhoHttp` e `EspelhoPares`, e
não decide nada que eles decidam.

```kotlin
class EspelhoServidor(
    private val ctx: Context,
    private val bundle: WebPathHandler,
) {
    fun ligar(porta: Int, ipv4: InetAddress, tls: KeyStore?, senha: CharArray?): String
    fun desligar()
    fun difundir(q: Quadro)          // offer(), NUNCA put()
    fun estado(): JSONObject
    private fun aceitar(cru: Socket)
    private fun rotear(r: EspelhoHttp.Req, saida: OutputStream, sessao: EspelhoPares.Sessao?)
}
```

**Invariantes:**

1. **Bind explícito ao IPv4 da Wi-Fi** e recusa em celular/VPN — §2.3. É a coisa mais importante
   deste arquivo.
2. **O transporte é `Transfer-Encoding: chunked`, não WebSocket.** A economia é a decisão mais
   valiosa do desenho inteiro:

   | | RFC 6455 à mão | HTTP chunked |
   |---|---|---|
   | protocolo | handshake SHA-1 + framing + **unmasking obrigatório** + frames de controle + close handshake + os três casos de comprimento (e o de 8 bytes só falha **acima de 64 kB**, ou seja exatamente no IDR) | `tamanho-em-hex CRLF bytes CRLF`, para sempre |
   | linhas | **~150** (350–500 no estilo de KDoc daqui) | **~10** (~25 no estilo daqui) |
   | volta do cliente | mesmo socket | `POST /r`, corpo ≤ 256 B |
   | reconexão | à mão | à mão (~10 linhas de JS) |

   O servidor HTTP **tem de existir de qualquer jeito** — a página, o CSS, o JS, e o próprio
   handshake do WebSocket **é** uma requisição HTTP. A comparação honesta não é "HTTP vs WS": é
   "HTTP" contra "HTTP **mais** o RFC 6455". E o pedaço que se apaga é justamente a classe de código
   que este projeto já pagou três rodadas de APK para aprender a temer.
3. **Uma thread por cliente, uma fila LIMITADA por cliente (~24 quadros), `offer()` e nunca
   `put()`.** A thread de drenagem do `MediaCodec` **jamais** bloqueia por causa de um tablet no
   fundo do salão.
4. **Fila cheia ⇒ esvaziar a fila INTEIRA e esperar o próximo IDR.** Nunca descartar quadro a quadro
   — isso degrada para lixo verde permanente. O cliente pisca uma vez e volta certo.
5. **Teto de tempo de ESCRITA.** `setSoTimeout` **não cobre escrita**, e um cliente que dormiu sem
   FIN prende a thread por minutos (o retry do TCP não é curto). Estourado o teto, o socket é fechado
   **de fora**, o que faz o `write()` bloqueado lançar.
6. **TLS envolve um `Socket` CRU — nunca `SSLServerSocket`.** Com um `SSLSocket` vindo de um
   `SSLServerSocket` você **não tem o socket cru**, e `SSLSocket.close()` tenta emitir `close_notify`
   — isto é, tenta **escrever**, numa conexão já travada em escrita. O vigia do invariante 5 deixaria
   de funcionar exatamente quando é necessário, e o teto de 3 seria consumido por fantasmas. Uma
   linha de diferença:
   ```kotlin
   val ssl = sslContext.socketFactory.createSocket(cru, host, porta, /*autoClose=*/ true) as SSLSocket
   ```
   Feito assim, **uma porta só**: espia o primeiro byte (`0x16` = handshake TLS) e envolve ou não.
   "TLS: ligado" passa a ser propriedade **da conexão**, não da URL que o operador lembrou.
7. **Os estáticos saem do `WebPathHandler`, por um MAPA FIXO de rota → caminho — nunca por
   concatenação.** `WebPathHandler.handle(path)` resolve **qualquer** caminho do bundle
   (`WebPathHandler.kt:26-30` — código); um `handle("espelho/" + nome)` com `nome` vindo da URL
   serviria `/controle/controle.js`, `/shared/native.js` e o resto para quem estiver na rede. A
   contenção por `canonicalPath` (`WebPathHandler.kt:32-34`) é chamada ali de "defesa em
   profundidade" — **aqui ela passa a ser load-bearing, e o KDoc daquele arquivo precisa dizê-lo.**
8. **O que o servidor NÃO serve, e isto é a diferença entre um espelho e um vazamento:** nenhum
   arquivo do acervo, nenhum id, nenhuma listagem; **nunca `/saf/`** (os tokens do SAF não expiram e
   indexam arquivos pessoais); e **nada que venha da rede entra no barramento de comandos** — o
   upstream inteiro é `key` / `alive` / `audio` / `relato`. O cliente é **somente-leitura de pixels**.
9. **Pedido de IDR tem freio:** 1 por 2 s por sessão **e** um piso global. Sem isso um cliente
   pareado pede IDR em laço e consome encoder, airtime e bateria durante o culto inteiro, a ~20 bytes
   por pedido.
10. **`audio` é estritamente POR CLIENTE.** O servidor decide a quem manda `0x10`/`0x11`; **nada que
    venha da rede liga o grafo de áudio, o encoder AAC ou qualquer outra coisa no app.**

### 3.7 `EspelhoService.kt` (~170 linhas)

**Responsabilidade:** manter o processo vivo e visível ao sistema enquanto o espelho serve.

FGS tipo **`connectedDevice`** — *"Interactions with external devices that require a Bluetooth, NFC,
IR, USB, or **network** connection"* **(doc)** —, e ele **não tem cota**, ao contrário de `dataSync`
(que este app já gasta com hinário, Bíblia e pastas) e de `mediaProcessing`.

> **O pré-requisito que derruba a primeira Release:** `connectedDevice` exige, **além** de
> `FOREGROUND_SERVICE_CONNECTED_DEVICE`, pelo menos uma de `CHANGE_NETWORK_STATE` /
> `CHANGE_WIFI_STATE` / `CHANGE_WIFI_MULTICAST_STATE` / `NFC` / `TRANSMIT_IR` (ou uma de
> Bluetooth/UWB em runtime, ou `UsbManager.requestPermission()`). **`INTERNET` e
> `ACCESS_NETWORK_STATE` não estão na lista**, e são as duas que o app tem
> (`AndroidManifest.xml:6-7` — código). Declarar **`CHANGE_WIFI_MULTICAST_STATE`** — nível *normal*,
> sem diálogo, e a menos poderosa das cinco. Sem isso, `startForeground` lança `SecurityException`.
> **(doc — [service types](https://developer.android.com/develop/background-work/services/fgs/service-types), verificado nesta sessão)**

> **E a nota da mesma página, que precisa estar escrita para ninguém "consertar" daqui a dois anos:**
> *"If your app performs a **projection** or remote messaging operation, use the corresponding media
> projection or remote messaging type instead."* Um espelho de display é, em português claro, uma
> projeção. Hoje nada disso é imposto pelo sistema (a imposição é só a do pré-requisito de
> permissão), e `mediaProjection` é **inalcançável** para nós de propósito — não há token de
> `MediaProjection` neste desenho, e é isso que dispensa o diálogo de consentimento por sessão. Logo
> `connectedDevice` é a única escolha possível.

**As nove regras, todas herdadas de lições já pagas em `SyncService.kt`:**

1. **`startForeground` SEMPRE, antes de qualquer decisão de parar** (`SyncService.kt:64-80` — código).
   Este processo é o dos dois WebViews **e** da `Presentation` na TV.
2. Só ligar com o app **visível** — de graça, porque o interruptor mora na UI do Controle.
3. **`START_NOT_STICKY`**: morreu, morreu, e o operador precisa **ver** que morreu.
4. **`onGone` obrigatório**: o Kotlin tem de **esquecer** que estava servindo, senão o próximo
   `espelhoLigar()` vira no-op **calado** — o defeito exato que `MainActivity.kt:284-287` já corrige
   para o download, com token de geração e tudo (**código**). Copiar o padrão, inclusive o token.
5. Wake lock **parcial**, renovado por **progresso real** (um quadro entregue a um cliente), nunca
   por tique de relógio: um espelho morto não pode segurar o lock até a bateria acabar.
6. **Wi-Fi lock com a expectativa dita no KDoc, não prometida na UI.** `WIFI_MODE_FULL` é *"deprecated
   and non-functional with no impact"*; `WIFI_MODE_FULL_HIGH_PERF` é tratado como ele; e
   `WIFI_MODE_FULL_LOW_LATENCY` só é de fato aplicado quando o app está **em primeiro plano e a tela
   acesa** **(AOSP — Wi-Fi low-latency mode)**. Ou seja: a única API que poderia consertar "latência
   sobe com a tela apagada" **recusa-se a funcionar exatamente nessa situação**. Adquira o
   `LOW_LATENCY` (é barato e ajuda enquanto o operador tem o app aberto) **e escreva no KDoc que ele
   é um no-op com a tela apagada**, para ninguém tentar consertar latência confiando nele.
7. Notificação com **botão de desligar** e o endereço servido — é a única janela com o app
   minimizado.
8. Um serviço **novo**, nunca um campo a mais no `SyncService` ou no `SessionService`: ciclos de vida
   e regras de parada diferentes, e empilhar dono é o caminho para o cartão eterno que os dois já
   aprenderam a evitar.
9. `PowerManager.getCurrentThermalStatus()` a cada minuto: em `THERMAL_STATUS_SEVERE`, cair bitrate e
   taxa de quadros **com uma frase no Registro** — e nunca resolução (§3.2, invariante 3).

### 3.8 `EspelhoDiag.kt` (~140 linhas)

**Responsabilidade:** o anel de diagnóstico. **Devolve JSON, não texto.**

```kotlin
class EspelhoDiag {
    fun registrar(linha: String)
    fun amostra(bytes: Int, quadros: Int)
    fun paraJson(): JSONObject
}
```

**Invariante único e não negociável:** **o Kotlin devolve DADO; quem monta a frase é o
`controle.js`.** É o que o resto do projeto já faz (`otaDiag`, `ytDiag`), é o que respeita a
invariante 5, e é o que torna a sanitização do §3.5 auditável num ponto só. Um `EspelhoDiag.kt` que
formata parágrafos é UI de diagnóstico escrita em Kotlin, e este projeto faz o contrário.

Corolário: a linha "ritmo" (§7.5) **não decide sozinha** — ela cruza o bitrate medido com o que
`nowPlaying` **já mandou** do JS para o `SessionService`. O Kotlin não sabe o que é uma cena; ele lê
o título e a bandeira que o web calculou. Isso mantém a invariante 5 intacta.

### 3.9 `EspelhoAudio.kt` (~190 linhas, Entrega 3)

**Responsabilidade:** receber PCM do WebView do espelho e entregar AAC ao fio.

**A observação que destrava tudo, e que ninguém tinha feito: o WebView do espelho JÁ É contexto
seguro.** Ele carrega `https://appassets.androidplatform.net/` — invariante 1. Logo **`AudioWorklet`
existe lá dentro**, mesmo que o cliente esteja em `http://`. Isso é um princípio geral e merece
ficar escrito como tal:

> **Tudo que precisa de contexto seguro pode ser movido para DENTRO do WebView; só o que
> obrigatoriamente roda no navegador do visitante fica preso ao piso `http://`.**

```
<video> do stage ──createMediaElementSource()──┬── GainNode(gain=0) ──→ destination   → SALÃO MUDO
                                                └── AudioWorkletNode ── GainNode(0) ──→ destination
                                                        │ postMessage(ArrayBuffer Int16, ~40 ms)
                                                        ↓ addWebMessageListener (androidx.webkit)
                                                   MediaCodec AAC-LC 96 kbps
                                                        ↓ [0x11] no mesmo fio
                                          2ª SourceBuffer da MESMA MediaSource
```

**Invariantes:**

1. **O `AudioWorkletNode` PRECISA de caminho até o `destination`** — daí o segundo `GainNode(0)`. A
   spec cobre explicitamente o caso de **entrada** desconectada e **não** cobre o de **saída**
   (`WebAudio/web-audio-api#2566`, aberto: *"the spec text doesn't cover the case of unconnected
   output"* — **spec**), e o comportamento de Chrome depende do valor de retorno de `process()`
   combinado com o estado do nó. Um nó folha é a armadilha clássica do `ScriptProcessorNode`, e o
   modo de falha é **zero áudio na rede, sem exceção, sem log, com o grafo aparentemente saudável** —
   exatamente a assinatura que este projeto define como a pior. Um `GainNode(0)` custa nada e faz a
   pergunta nunca ser feita. E o diagnóstico imprime **blocos de PCM por segundo**.
2. **Acumular no worklet e enviar em blocos de ~40 ms, já em Int16.** `WebViewCompat.WebMessageListener.onPostMessage`
   é anotado **`@UiThread`** (**AndroidX**), e o `AudioWorklet` processa em quanta de 128 amostras
   (~2,7 ms a 48 kHz): um `postMessage` por quantum seriam **~375 mensagens por segundo entregues na
   main thread** do processo que hospeda o Controle **e** a `Presentation`, cada uma pagando JNI,
   alocação e GC. A ~25 msg/s e metade dos bytes, o custo desaparece — e a conversão para Int16 sai
   da main thread de brinde.
3. **`allowedOriginRules = setOf("https://appassets.androidplatform.net")`, e `isMainFrame == true`
   no `onPostMessage`.** *"When you specify a trusted origin… the WebView guarantees that it only
   exposes the injected JavaScript objects to web pages loaded from that exact origin"*, e *"Avoid
   using the full wildcard (`*`)… unless absolutely necessary"* **(doc — [JavaScript bridge](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge))**.
   Este WebView carrega a IFrame Player API do YouTube por design; com `"*"`, script de terceiro
   ganharia um canal binário direto para o `MediaCodec` AAC. Mais: teto de tamanho por mensagem, e o
   gate `WebViewFeature.isFeatureSupported(WEB_MESSAGE_ARRAY_BUFFER)`. `androidx.webkit:webkit:1.12.1`
   **já é dependência** (`app/build.gradle.kts:159` — código).
4. **Ordem de inicialização à prova de falha.** O espelho **nasce com `forceMuted: true`** (silêncio
   garantido); cria o `AudioContext`, `resume()`, `createMediaElementSource`, `gain(0) → destination`,
   carrega o worklet; **só então** chama `stage.setForceMuted(false)` (a função já existe —
   `controle.js:1319` a usa). Se qualquer passo falhar, fica mudo: o espelho não tem áudio na rede e
   o cliente mostra *"esta tela está sem som"*. **Nunca o contrário.**
5. **`createMediaElementSource` é porta de mão única e é chamado UMA vez**, na abertura do espelho,
   **nunca por `load`** — a segunda chamada no mesmo elemento lança `InvalidStateError`. Isso é
   viável porque `shared/stage.js` **nunca faz `createElement`**: usa o único `#video` de
   `display/index.html` (`display/display.js:3` — código). E, a partir dali, o áudio do elemento
   existe **só** dentro do grafo — por isso o `state` do `AudioContext` entra no diagnóstico: um
   contexto que volte a `suspended` depois de um `resume()` bem-sucedido deixa o espelho mudo no
   salão **e** na rede ao mesmo tempo.
6. **Por que `video.muted` NÃO é o mecanismo:** mutar o elemento zera **também** a saída do nó de Web
   Audio. O que tira o som do salão é o próprio roteamento — criado o `MediaElementAudioSourceNode`,
   o áudio vai para o grafo em vez de ir direto à saída.
7. **AAC numa segunda `SourceBuffer`, não PCM + `AudioWorklet` no cliente.** A frase do plano
   anterior — *"elimina a sincronia de duas linhas de tempo independentes"* — está **invertida**: PCM
   por canal lateral **é** a segunda linha do tempo. Comparação:

   | | PCM cru + `AudioWorklet` no cliente | **AAC na 2ª SourceBuffer** |
   |---|---|---|
   | existe em `http://`? | **não** (`[SecureContext]`) | **sim** |
   | banda | ~770 kbps | ~96 kbps |
   | sincronia A/V | **sua**: ring buffer, relógio, deriva, subfluxo — e o modo de falhar é **estalo na caixa de som do templo** | **do navegador** — uma `MediaSource`, uma linha do tempo |
   | código no cliente | 150–200 linhas | **~10** |
   | `AudioSpecificConfig` | não precisa | **o `MediaCodec` entrega pronto** em `csd-0` |

8. **As duas exceções, nomeadas:** o **embed do YouTube** (iframe cross-origin — o Web Audio não
   alcança o áudio dele; aquela cena vai muda para a rede e o cliente **diz isso** por um quadro
   `0x30`) e o **microfone ao vivo** (push-to-talk é `getUserMedia → MediaStreamSource → GainNode →
   destination`, um caminho **disjunto** do `<video>`). A segunda é uma escolha, não um acidente, e
   está no §10 item 21 para ninguém "melhorar" isso capturando o fim do grafo.
9. **Plano B, só se o A3 (§7.6) reprovar em aparelho:** `MediaProjection` + `AudioPlaybackCapture`
   com `addMatchingUid(Process.myUid())`, FGS `mediaProjection`, diálogo por sessão **e som no
   salão**. É o preço que o desenho anterior assumia desde o começo; este não cobra nada disso.

### 3.10 O cliente — a decisão de decodificador

**UM decodificador. WebCodecs está descartado nominalmente**, e o argumento decisivo **não** é o
contexto seguro (com TLS ele passaria a existir):

1. **WebCodecs desenha num `<canvas>`, e canvas não segura a tela acesa.** O wake lock de vídeo do
   Chromium exige `HTMLMediaElement` tocando com vídeo: `ShouldBeActive()` pede `playing_` ·
   `HasVideo()` · página visível · **razão de interseção > 0,75** (`kStrictVisibilityThreshold`) **e >
   0,2 do viewport** (`kSizeThreshold`) — *ou* PiP, *ou* áudio audível
   **(Chromium `video_wake_lock.cc`)**. Um `<video>` cobrindo a tela satisfaz os dois limiares com
   folga, **mudo e sem faixa de áudio nenhuma**. Ou seja: **o espelho segura a tela acesa sem
   `wakeLock` e sem contexto seguro.** Isso derruba a linha *"Sem contorno técnico — é um custo real
   do recurso"* do `PLANO-TELAO-NA-REDE.md:505`.
2. Ele obrigaria a escrever a **sincronia A/V** que a `MediaSource` dá de graça, e um relógio próprio.
3. Ele exclui Firefox Android e os navegadores embarcados de TV (webOS 6.3.2 é Chromium 79; WebCodecs
   é Chrome 94+).
4. E ele **não economiza trabalho**: o `fmp4.js` precisa existir de qualquer jeito para o piso. HTTPS
   não apaga o muxer — ele só acrescentaria um segundo caminho.

Num telão de igreja, 300 ms de latência **não têm consumidor** (ninguém está no salão comparando a TV
com o tablet quadro a quadro); a tela apagando no meio do hino tem consumidor imediato.
**`VideoDecoder` só volta à mesa se a medição reprovar a latência do MSE**, e então como segundo
decodificador **atrás do mesmo formato de fio** — que é o motivo de mandar Annex-B: o WebCodecs come
Annex-B **direto, sem `description`** **(spec — AVC codec registration)**, e o muxer converte para
`avcC`. Um formato de fio, dois decodificadores possíveis, um implementado.

**A correção honesta que precisa acompanhar essa decisão (P25):** o wake lock do `<video>` é
propriedade da **Entrega 2**. A Entrega 1 é modo imagem — `<img>`/`<canvas>`, nenhum deles
`HTMLMediaElement` — e nela **a tela do cliente apaga sozinha**. Isso tem de estar escrito na própria
página do cliente em modo imagem, ou a primeira coisa que chega ao operador vai gerar a conclusão
"não funciona" antes de a Entrega 2 existir.

### 3.11 JS novo — `assets/web/espelho/`

| Arquivo | Linhas | O que é |
|---|---|---|
| `index.html` | ~70 | **uma página, dois estados**: pareamento (PIN) e player. Não há navegação entre eles — é o que permite o token nunca entrar numa URL |
| `fmp4.js` | ~330 | o muxer: `ftyp`+`moov` (com `avcC` **construído a partir do Annex-B**) + `mvex/trex`, e por fragmento `moof(mfhd,traf(tfhd,tfdt,trun)) + mdat`. Faixa de áudio (`mp4a/esds`) na Entrega 3: +35 |
| `cliente.js` | ~280 | transporte, fila de append serializada, poda do passado, perseguição da borda, reconexão com espera crescente, o relato de capacidades, modo imagem |
| `espelho.css` | ~130 | preto, `object-fit: contain`, `cursor:none` depois do gesto |
| `sonda.html` + `sonda.mp4` | ~60 + ~40 kB | a sonda de readback (§7.4) |

**O caminho implementado:**

```
fetch('/v', { headers: { Authorization: 'Bearer ' + t } }) → response.body.getReader()
  → desmonta [16 B][payload]
  → 0x01: guarda SPS/PPS → monta avcC → ftyp+moov → addSourceBuffer('video/mp4; codecs="avc1.PPCCLL"')
  → 0x02: Annex-B → AVCC (prefixo de 4 bytes) → moof+mdat → fila de append
  → 0x11: AAC → moof+mdat na segunda SourceBuffer
  → 0x20: JPEG → createImageBitmap → canvas          (modo imagem, mesmo transporte)
```

**Invariantes do muxer e do cliente, cada um com a fonte:**

1. **ATRASO DE UM QUADRO — e é o invariante que decide se o cliente toca ou engasga.** Com fragmento
   de 1 quadro e taxa **variável**, escrever a `sample_duration` no `trun` antes de conhecer o PTS
   seguinte abre buraco no `buffered`: numa cena parada os intervalos reais alternam entre ~33 ms e
   ~1 s, e navegadores **param em buracos** de faixas bufferizadas até que sejam preenchidos (é o
   problema que dash.js e Shaka resolvem por gap-jumping em JS) **(prática —
   [Video-Dev/Fraunhofer](https://websites.fraunhofer.de/video-dev/being-trapped-in-a-gap-with-big-buck-bunny/))**.
   Então: **só emitir o fragmento de N quando N+1 chega**, escrevendo
   `sample_duration = pts(N+1) − pts(N)`. Custa até 1 s de latência numa cena parada (irrelevante) e
   zero numa cena em movimento. A alternativa — duração fixa e confiar no *fudge room* do Chromium —
   não funciona: a folga de coalescência é da ordem de um par de durações de quadro, não de 1 s. E é
   exatamente o que a asserção `sb.buffered.length === 1` de `tools/espelho-cliente.test.mjs`
   reprova.
2. **`appendBuffer` com `updating === true` lança `InvalidStateError`** **(spec MSE)** — fila
   serializada com acumulador. O `shared/mse.js:320-393` deste repositório já resolve isso com
   `f.ocupada` + `aplicar()`: **o idioma já existe na casa** (**código**).
3. **`QuotaExceededError` é ESPERADO, não é falha** — pode ativamente: `remove(0, currentTime − 2)`.
   Também já existe em `mse.js:312-318` (**código**).
4. **`mode = 'segments'`**, nunca `'sequence'`: nossos fragmentos carregam `tfdt` absoluto do relógio
   mestre; `'sequence'` mandaria o navegador inventar os tempos e destruiria a sincronia A/V de
   graça. `mse.js:409` já usa `'segments'` (**código**).
5. **Ao vivo NÃO se chama `endOfStream()` e NÃO se escreve `ms.duration`** — a janela navegável sai
   de `setLiveSeekableRange(start, end)`. É o oposto do que `mse.js:402` faz (ele *tem* duração), e é
   o ponto exato em que copiar aquele arquivo daria errado.
6. **Perseguição da borda por `playbackRate`**, nunca por `currentTime =` (que estala).
7. **`ManagedMediaSource || MediaSource`** e `video.disableRemotePlayback = true` — o
   `ManagedMediaSource` (iOS 17.1+) é API-compatível e é a única porta em iPhone, que **não tem
   `MediaSource`** **(MDN BCD; a mesma detecção que o go2rtc faz — prática)**.
8. **O cliente nasce MUDO e tocando.** *"Muted autoplay is always allowed"* **(doc — política de
   autoplay do Chrome)**. `playsinline` obrigatório.
9. **Um gesto, quatro efeitos.** `requestFullscreen()` exige ativação transitória e não há truque.
   Então: **um botão grande na montagem da tela** que faz `requestFullscreen()` + `video.muted = false`
   (se for a tela com som) + `audioCtx.resume()` + `wakeLock.request()` (se existir). Depois disso a
   ativação é *sticky* pela sessão. É o mesmo padrão do `#startBtn` do `/display/`
   (`display/display.js:1514-1536` — código).
10. **As telas nascem mudas por decisão, não só por política.** Elas estão dentro da igreja, a
    100–300 ms da PA: três telas desmutadas são três alto-falantes com eco. Quem está em outra sala
    aperta o botão.
11. **APIs de contexto seguro entram como `if (isSecureContext && 'X' in Y) { …melhor… } else
    { …piso… }`, nunca como caminho principal** — a mesma disciplina do `if (!window.__NATIVE__)`.
    Armadilha concreta: **`crypto.randomUUID()` não existe em `http://`** (`[SecureContext]` na IDL
    do WebCrypto); use `crypto.getRandomValues()`, que não é gated. `tools/contexto-seguro.test.mjs`
    varre a pasta atrás de `VideoDecoder`, `wakeLock`, `audioWorklet`, `randomUUID` e `crypto.subtle`
    fora de guarda (§7.1).
12. **O modo imagem usa o MESMO transporte** (quadros `0x20` no fluxo `/v`), não
    `multipart/x-mixed-replace`. Motivos: o Chrome removeu multipart como **documento** e o mantém só
    para **imagens**, o Safari é duvidoso, e — decisivo — um `<img src>` **não pode mandar o
    cabeçalho `Authorization`**, o que reintroduziria o token na URL. Mesmas ~40 linhas, um parser a
    menos no navegador, e o token continua fora de toda URL.

---

## 4. O QUE MUDA NO CÓDIGO EXISTENTE

### 4.1 OBRIGATÓRIO — sem isto o recurso nasce quebrado ou quebra o culto

| Arquivo:linha | O quê | Por quê |
|---|---|---|
| `shared/native.js:246-251` | **O dreno, como LISTA DE PERMISSÃO de um item.** `__AVBus.post` só deixa passar `msg.type === 'display-ready'` quando `__AV_ROLE__ === 'espelho'` | C6. `display.js:1500` emite `display-ready` com `__de`; `controle.js:13102` responde `resendSceneToDisplay(msg.__de)`; `controle.js:13031` carimba `__para` em todos os comandos do reenvio (**código**). Drenado por inteiro, o espelho fica no wallpaper até alguém tocar em alguma coisa — no espelho ligado no meio do culto, na morte do renderer e na recarga do OTA. É seguro deixar passar exatamente esse porque o reenvio é **endereçado** desde a v5.140: a TV ignora o que trouxer o `__para` do espelho |
| `shared/native.js` (mesmo bloco) | **Não apagar `BroadcastChannel` — neutralizar só o envio:** `global.BroadcastChannel = class extends Real { postMessage() {} }` | `db.js:800` pergunta `'BroadcastChannel' in global` (**código**). Apagando, o espelho fica com **um só caminho de recepção**, e a redundância dos dois caminhos foi decidida por escrito (`db.js:791-799`, `MessageBus.kt:14-19`). O que precisa morrer é o envio |
| `display/display.js` (bloco novo, papel espelho) | **o batimento**, `setInterval` de **1 s**, um elemento de 1×1 px alternando entre dois quase-pretos | C2/D2. Com a cena parada o `VirtualDisplay` não produz buffer e o encoder não emite; forçar o renderer a produzir quadro faz o SurfaceFlinger recompor. **`setInterval`, nunca `requestAnimationFrame`** — rAF é suspenso em página oculta e casado ao vsync, é a ferramenta errada. Guardado por papel: **não toca o telão de verdade**. Chega por OTA |
| `display/display.js:543` (`startMic`) | recusar no papel espelho | Sem `MicChromeClient` ele nega em silêncio e **apaga o estado do microfone real** via `mic-status:{on:false}` (`controle.js:13121-13126` aplica sem filtro — **código**). Com `MicChromeClient` seria pior: dois `getUserMedia` e realimentação pública |
| `display/display.js:93` | `forceMuted: __AV_ROLE__ === 'espelho'` **como estado inicial**, liberado só depois que o grafo de áudio estiver provado (§3.9) | Falha segura: se o grafo não subir, o salão fica em silêncio |
| `display/display.js:1077-1078, 1234-1250, 1529-1530` | forçar `mute()` no `YT.Player` no papel espelho | `yt.muted` é máquina de estados própria e **ignora `forceMuted` inteiramente** (**código**). O "~6 linhas" do plano anterior eram dois caminhos, não um |
| `MainActivity.kt:530` | `firstOrNull()` → `telasExternas().firstOrNull()` | Sem filtro **e sem TV**, `syncPresentation` acha o nosso display virtual e cria uma `StagePresentation` **dentro do próprio espelho** — um terceiro `/display/`, e (porque `StagePresentation.buildWebView` instala `MicChromeClient`, `StagePresentation.kt:92` — **código**) **habilitado a abrir o microfone do templo**, numa tela que o operador não vê |
| `MainActivity.kt:681` | mesmo filtro em `listDisplays()` | é o escritor único de `lastDisplays` (`controle.js:12882` — **código**); filtrar na fonte cobre `renderDisplayStatus`, `applyPreviewAspect` e `simpleDisplay` de uma vez |
| `MainActivity.kt` (helper novo) | `telasExternas()`: exclui `Display.FLAG_PRIVATE` **e** o `displayId` do nosso VirtualDisplay quando conhecido | **Escrever no KDoc que isto é cinto e suspensório para uma flag que NÃO estamos passando** — `isPresentationDisplay()` exige `FLAG_PRESENTATION`, que `flags = 0` nunca põe, logo os dois call sites não conseguem enxergar o espelho hoje. Sem essa explicação, o próximo leitor apaga o filtro como código morto e a proteção some junto |
| `MainActivity.kt` (`onCreate`, ao lado de `syncPresentation`) | `EspelhoDisplay.sincronizarJanela(this)` | §3.2, invariante 5 — a `MirrorPresentation` renasce com a Activity |
| `MainActivity.kt` (`onStop` / `onDestroy`) | `keepPlaying()` no espelho; `desligar()` no `onDestroy` | o espelho não sobrevive ao fechamento do app |
| `NativeBridge.kt:104` | `SHELL_VERSION = 31` → **32** | métodos novos na ponte |
| `NativeBridge.kt` (novo) | 5 métodos guardados por `host != null`. **`espelhoLigar`/`espelhoEstado`/`espelhoDiag`/`espelhoAprovar` FORA da fila `io`; `espelhoDesligar` escreve um `@Volatile` e volta** | A `io` é **uma thread única compartilhada** (`NativeBridge.kt:108-115`) e é onde roda o download do YouTube (`NativeBridge.kt:494`) — um download de 380 MB a segura por minutos. Ligar o espelho no meio de um download não faria nada, a Promise venceria pelo prazo de 60 s do `native.js` e resolveria `null`: "erro" sem causa. Mesmo raciocínio já publicado para o `ytCancel`. E mover a criação para a main thread **elimina de graça** a corrida do `onDisplayAdded` (o listener é registrado com handler `null` em `MainActivity.kt:232` — handler da thread do chamador, isto é, a main) |
| `WebPathHandler.kt:43-68` | `mimeOf`/`encodingOf` viram `internal`; o KDoc ganha a nota de que a contenção por `canonicalPath` passou a ser load-bearing | o servidor reusa a resolução OTA→APK e a tabela MIME. **Nunca duplicar a tabela** — ela diverge no primeiro `.woff2` novo |
| `AndroidManifest.xml:6-7, 20-30` | `FOREGROUND_SERVICE_CONNECTED_DEVICE` + **`CHANGE_WIFI_MULTICAST_STATE`** + o `<service>` | §3.7 — sem a segunda, `startForeground` lança |
| `res/xml/backup_rules.xml` + `res/xml/data_extraction_rules.xml` | excluir o `.p12`, se existir | **os dois**, porque o Android mudou o formato e as decisões são as mesmas |
| `controle/controle.js:12225-12231` | `simpleDisplay()` reconhece o espelho **depois** de `lastDisplays[0]`, não antes | `castTestUnlocked` está na **primeira** linha e venceria uma TV real (`controle.js:12226` antes de `:12230` — **código**) |
| `controle/controle.js:12141-12179` | terceiro estado visual com classe **própria** (`.mirror`), nunca reciclando `.testing` | o âmbar já significa "porta de desenvolvimento destravada". Mesmo símbolo com dois sentidos é o erro que o `CLAUDE.md` documenta ter cometido com o ícone da cortina |
| `controle/controle.js:12785` | o clique no cartão com o espelho ativo | hoje `if (castTestUnlocked) {...return;}` intercepta antes (**código**) |
| `controle/controle.js:12927` (`POPUPS`) | a folha do espelho entra na tabela | é o que a liga ao ✕, ao toque no fundo **e** ao botão voltar de uma vez |
| `controle/controle.js` (`otaPending`/aviso do OTA) | calar o aviso **também** com o espelho ativo; `WebUpdater.applyNow` recarrega **três** páginas | Hoje o aviso é suprimido "com cena no ar" e "com download em curso" — não com espelho no ar. Aplicar um bundle recarregaria Controle e telão e deixaria o espelho servindo o **bundle antigo**, de um diretório que o `beginSession()` seguinte vai apagar |
| `controle/controle.js:165` + `index.html#appVersion` + `version.json` | os três lugares de versão | o CI reprova se divergirem |

### 4.2 DESEJÁVEL

- `display.js` — um campo de origem (`__de`) no `display-status` e no `media-ended`. Hoje a
  arquitetura **supõe** um telão só, e o dreno mantém a suposição por convenção, não por construção.
- `controle.js:10124-10127` (`juntarDiag`) — `diagLinhas = diarioC.concat(doTelao)` **substitui**, não
  acumula: dois telões respondendo `diag-ask` fazem o Registro mostrar o diário de um dos dois,
  **sem dizer qual** (**código**). O dreno já cobre, mas o defeito é de hoje.
- `controle.js:1178-1180` (`displayActive`) — fica registrado que é o ponto único que decide "há
  projeção", e que **qualquer** futuro segundo `/display/` o inverte (e com ele `previewTick`,
  `preview.onEnded`, `authoritativeTime`, `pedirDiag` e o `document.fullscreenElement &&` de
  `:11068`).

### 4.3 Uma correção ao diagnóstico do plano anterior, para ninguém consertar a coisa errada

Aquele documento afirmava que o `media-ended` dobrado faz o Controle **pular uma faixa**. **Não faz**,
hoje: `controle.js:13162` descarta a segunda mensagem porque `currentId` já mudou — e mudou de forma
síncrona, porque `send()` curto-circuita o `await` quando o alvo está numa das três listas, que é
sempre o caso em `autoAdvance` (**código**). O efeito real da duplicata é: **nada** em
`repeat all/shuffle`; **um segundo `load` do mesmo item** (fade duplo, glitch visível) em
`repeat one`; nada em `off`. A guarda que salva foi escrita para outro caso e cobre este **por
acidente** — basta o alvo do `autoAdvance` deixar de estar nas listas para o pulo virar real.

O dreno continua obrigatório; o argumento **grave** é outro: o `displayActive()` invertido (que
desliga `previewTick`, `preview.onEnded`, `authoritativeTime` e muda `pedirDiag` de uma vez) e o
`snoopDisplayStatus` alimentando a notificação de mídia com duas fontes alternadas justamente quando
o app está minimizado — que é o cenário em que ela é a única janela.

---

## 5. O PROTOCOLO DO FIO

Completo o suficiente para duas implementações independentes conversarem.

### 5.1 As rotas — cinco, sem `Range`, sem keep-alive, sem token em URL

| Rota | Autenticação | Resposta |
|---|---|---|
| `GET /` | nenhuma | a página única (`index.html`), no estado de pareamento. **Anônima**: sem versão, sem nome de aparelho, sem SSID |
| `GET /e.js`, `GET /e.css` | nenhuma | estáticos, resolvidos por `WebPathHandler` (OTA→APK, por arquivo), por **mapa fixo** de rota→caminho |
| `POST /par` | nenhuma | corpo ≤ 256 B. Duas formas: `{"pin":"418302","ua":…,"w":…,…}` → `202 {"espera":"<id opaco>"}` ou `403`; e `{"espera":"<id>"}` → `202 {"estado":"pendente"}` \| `200 {"t":"<token base64url 128 bits>"}` \| `403 {"estado":"recusada"}` |
| `GET /v` | `Authorization: Bearer <token>` | `200`, `Transfer-Encoding: chunked`, `Content-Type: application/octet-stream`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`. **Corpo infinito.** Nunca `Content-Encoding` |
| `POST /r` | `Authorization: Bearer <token>` | corpo ≤ 256 B: `{"do":"key"}` · `{"do":"alive","telaAcesaMin":N}` · `{"do":"audio","on":true}` |

Qualquer outra coisa — rota inexistente, token inválido, `Host` fora da allowlist, `Origin`
estranha — responde **o mesmo `404`**, com o mesmo corpo e o mesmo tamanho.

### 5.2 O quadro binário de `/v` — 16 bytes de cabeçalho

```
 off  tam  campo
  0    1   tipo
  1    1   flags     bit0 = quadro-chave (IDR) · bit1 = descontinuidade (encoder remontado)
  2    2   zero      reservado, alinhamento
  4    4   tamanho   uint32 BE — bytes do payload
  8    4   pts_hi    uint32 BE  ┐ microssegundos desde o início da SESSÃO (base do PROCESSO)
 12    4   pts_lo    uint32 BE  ┘  (dois uint32, NÃO um uint64: evita BigInt no cliente,
                                    e 2^53 µs = 285 anos de folga)
 16    …   payload
```

| tipo | payload |
|---|---|
| `0x01` | **csd de vídeo** — SPS e PPS concatenados, **em Annex-B**, como o `MediaCodec` os entrega. Sempre o primeiro quadro de toda conexão |
| `0x02` | **quadro de vídeo** — NALUs em Annex-B. `flags bit0` diz se é IDR |
| `0x10` | **csd de áudio** — `AudioSpecificConfig` (2 bytes), como sai em `csd-0` do encoder AAC |
| `0x11` | **quadro AAC** — raw, sem ADTS |
| `0x20` | **quadro JPEG** — modo imagem, mesmo fluxo, mesmo cabeçalho |
| `0x30` | **JSON de controle servidor→cliente**, UTF-8: `{"m":"sem-audio","por":"youtube"}` · `{"m":"adeus","por":"operador"}` · `{"m":"modo","v":"imagem"}` |

**Por que o comprimento é nosso e não do `chunked`:** os limites de chunk do HTTP não coincidem com
os limites de mensagem para quem lê de um `ReadableStream`. O prefixo é obrigatório e custa 16 bytes
por quadro.

**Invariante do PTS:** a base é do **PROCESSO**, não do encoder. Remontar o encoder emite o quadro
seguinte com `flags bit1` (descontinuidade) e um PTS **maior** que o anterior — nunca menor. Um
`tfdt` que ande para trás quebra a `MediaSource` em silêncio.

### 5.3 A abertura de toda conexão

```
cliente → GET /v  (Authorization: Bearer …)
servidor → 200 chunked
servidor → pedirIdr()              (todo GET novo é, por construção, um cliente novo)
servidor → [0x01] csd de vídeo
servidor → [0x10] csd de áudio     (só se este cliente pediu áudio)
servidor → nada até o próximo IDR  ← mandar P-frames antes produz lixo verde
servidor → [0x02 flags=1] IDR
servidor → [0x02] delta … para sempre
```

**Mandar bytes antes do IDR é a falha que ninguém liga à causa.** A regra fica.

### 5.4 O pareamento, passo a passo

```
1. operador liga o espelho          → PIN de 6 dígitos (SecureRandom), na folha do Controle e no QR
2. QR contém APENAS  http://192.168.0.42:8787/     (sem PIN, sem token, sem fragmento)
3. visitante abre a página          → estado "pareamento", anônimo
4. POST /par {"pin":…, relato}      → 403 (com bloqueio por origem após 5 erros)
                                    → 202 {"espera": id}
5. a folha do Controle mostra       → "tela pendente — aprovar? [Aprovar] [Recusar]"
   (interruptor "aprovar automaticamente nesta sessão", nasce DESLIGADO)
6. POST /par {"espera": id} (poll)  → 202 pendente | 200 {"t": token} | 403 recusada
7. o token vive em sessionStorage e sobe em Authorization: Bearer — NUNCA numa URL
8. a mesma página troca para o estado "player" sem navegar
```

### 5.5 O relato do cliente

No pareamento, junto do PIN, uma vez:

```json
{"ua":"…","w":1920,"h":1080,"seguro":false,"mse":true,"mms":false,
 "fetchStream":true,"videoDecoder":false,"wakeLock":false,"telaAcesaMin":0}
```

e a cada 5 min um `alive` com `telaAcesaMin`. Isso responde, **sem ninguém abrir console em TV
nenhuma**: a tela apaga? qual Chromium roda na TV? WebCodecs vale como degrau algum dia? Todo campo
de texto é saneado no Kotlin (§3.5, invariante 9) antes de chegar ao Registro.

---

## 6. ORDEM DE IMPLEMENTAÇÃO

Cada passo termina em algo **verificável**, e os quatro primeiros não pedem aparelho.

| # | O que sai | Termina quando | Chega por |
|---|---|---|---|
| **P1** | `EspelhoHttp.kt` + `EspelhoPares.kt` (puros) + `app/src/test` com JUnit + `./gradlew testDebugUnitTest` no CI **sem `continue-on-error`** | o CI verde com casos de: linha longa, cabeçalho longo, corpo longo, `read()` parcial, `Host` fora da allowlist, `Origin` estranha, token inválido, 5 PINs errados, 6º PIN da mesma origem, token expirado, saneamento de `\n` no `ua` | — |
| **P2** | `assets/web/espelho/fmp4.js` + `tools/fmp4.test.mjs` (Node puro, **sem `continue-on-error`**) + `tools/espelho-cliente.test.mjs` (Chromium) | `sb.buffered.length === 1` e `end − start ≈ dur` num Chromium de verdade, com NALUs gravadas | OTA (mas inerte até P5) |
| **P3** | o dreno + `tools/ponte.test.mjs` (+caso `espelho` e o **par negativo** `display`) + `tools/display-smoke.mjs` com viewport **explícito** 961×540 + `tools/contexto-seguro.test.mjs` | CI verde; e o `display-smoke` no viewport novo **prova a decisão de densidade sem aparelho** | **OTA** — é inócuo sem o papel `espelho` |
| **P4** | `MirrorPresentation.kt` + `EspelhoDisplay.kt` + a **sonda** + o bloco do espelho no `#diagBox` | o operador liga o espelho e **lê o veredito de readback no Registro em 30 s** — sem servidor, sem cliente, sem encoder. É o R1 respondido em produção | **APK** |
| **P5** | `EspelhoServidor.kt` + `EspelhoService.kt` + modo **IMAGEM** + pareamento + a folha do Controle | um navegador da rede mostra o telão em JPEG | **APK** · `SHELL_VERSION` 32 · web 5.141 |
| **P6** | `EspelhoCodec.kt` + modo **VÍDEO** + o cliente MSE | o telão inteiro, com fades e cortina, num `<video>` | **APK** · web 5.142 |
| **P7** | `EspelhoAudio.kt` + o grafo Web Audio no espelho + 2ª `SourceBuffer` | som na rede, salão em silêncio | **APK** · web 5.143 |
| **P8** | TLS (`SSLServerSocket` **não** — envelopamento de `Socket` cru) + a placa de rua no site | cadeado verde, e o degrau caindo sozinho para `http://` quando o nome não resolve | **APK** |

**Entregas ao operador:** P1–P5 = Entrega 1 (o espelho em imagens); P6 = Entrega 2; P7 = 3; P8 = 4.

**Já é um espelho útil na Entrega 1:** 8–12 fps de slide cobrem letra, versículo, mensagem e
cronômetro — que é 90% de um culto. E o modo de falha do modo imagem é **binário e visível**, que é
exatamente o que se quer para um primeiro contato. Com a ressalva do §3.10, dita na própria página:
**em modo imagem a tela do cliente apaga**.

**E há uma regra de calendário que precisa estar escrita:** **o operador liga o espelho pela primeira
vez numa terça-feira, não no culto.** Um `ServerSocket` novo, um parser HTTP novo e um
`VirtualDisplay` novo dentro do processo da projeção, com o teste de aceitação sendo um domingo, é o
oposto da disciplina do resto do repositório.

---

## 7. VERIFICAÇÃO: O CI, O APARELHO E O DIAGNÓSTICO EMBUTIDO

### 7.1 O que entra em `tools/` e no CI

| Arquivo | O quê | `continue-on-error`? |
|---|---|---|
| `app/src/test/.../EspelhoHttpTest.kt` (novo, ~200) | o parser HTTP: tetos, `read()` parcial, `Host`, `Origin`, 404 uniforme | **não** |
| `app/src/test/.../EspelhoParesTest.kt` (novo, ~160) | PIN, prazo, bloqueio por origem, teto de sessões, saneamento | **não** |
| `tools/fmp4.test.mjs` (novo, ~180) | oráculo em Node puro, boxes byte a byte, molde do `sidx.test.mjs` | **não** |
| `tools/espelho-cliente.test.mjs` (novo, ~150) | Chromium de verdade: `MediaSource.isTypeSupported` → `appendBuffer(init+frag)` → afirmar `sb.buffered.length === 1` e `end − start ≈ dur`. **O navegador É o oráculo do muxer** — pega deslocamento no `trun` e `tfdt` errado, que nenhuma leitura de spec pega | sim |
| `tools/ponte.test.mjs` (+60) | caso `role: () => 'espelho'`: `busPost` recebe **só** `display-ready`; `BroadcastChannel.postMessage` é no-op; **e o par negativo com `role:'display'`**, senão o dreno pode vazar para o telão de verdade e ninguém vê. Mais: todo campo de `espelhoEstado`/`espelhoDiag` remontado | sim (mas é o teste mais barato do lote) |
| `tools/display-smoke.mjs` (+) | `newContext({ viewport: { width: 961, height: 540 } })` — **explícito**. Mais três asserções: nada estoura o viewport, `#textMain` acima de um piso de `font-size`, `#wallpaper`/`#video` cobrindo a tela | sim |
| `tools/contexto-seguro.test.mjs` (novo, ~60) | varre `assets/web/espelho/` atrás de `VideoDecoder`, `wakeLock`, `audioWorklet`, `randomUUID`, `crypto.subtle` **fora** de uma guarda `isSecureContext` | **não** |

> **O `display-smoke` hoje roda no default do Playwright (1280×720) POR ACIDENTE** (`newContext()`
> sem viewport, `tools/display-smoke.mjs:83` — **código**): um upgrade do Playwright apagaria a
> garantia em silêncio. Fixado em **961×540** (§3.2), ele passa a **provar a decisão de densidade sem
> aparelho** — o único item das seções técnicas deste documento que consegue isso.

### 7.2 JUnit como a QUARTA EXCEÇÃO à regra de zero dependência

O `CLAUDE.md` lista três exceções, cada uma justificada por escrito. Esta é a quarta, e a
justificativa é a mesma que este documento usa para recusar o RFC 6455:

> `testImplementation("junit:junit:4.13.2")` **não põe um byte no APK** — mas é uma declaração nova, e
> por isso merece o mesmo tratamento das outras três. Ela existe porque o espelho acrescenta ~1.600
> linhas de Kotlin (**+21%** sobre as 7.612 medidas hoje com `wc -l`, e 16 → 24 arquivos), e ~360
> delas são **a primeira fronteira de rede do projeto**: um parser HTTP com controle de acesso.
> Escrever isso no único lugar do repositório sem teste, no mesmo documento que recusa o RFC 6455 por
> falta de oráculo, é o argumento do documento aplicado contra ele mesmo — e um erro de parser aqui
> não vira pixel errado, vira controle de acesso quebrado. A conta da manutenção é do JUnit, que é
> estável há uma década e roda no runner que o CI já usa.

### 7.3 O que MUDA no `apk.yml`

Um passo novo, `./gradlew testDebugUnitTest`, **sem `continue-on-error`**, antes do
`assembleRelease`. Os testes de `tools/` novos entram nos blocos que já existem, com a classificação
da tabela acima.

### 7.4 A sonda de readback — R1 respondido na primeira vez que o operador liga

Substitui a "Fase 0 em build de debug" do plano anterior. O motivo é simples: o roteador da igreja,
as cenas reais e o aparelho do operador só existem **na mão do operador**. Um build de debug mede o
que já sabemos; a Release mede o que decide.

Ao ligar, **antes de aceitar cliente**, e num **VirtualDisplay separado e descartável** (§3.2,
invariante 4):

1. `EspelhoDisplay.sonda()` cria um VirtualDisplay com um `ImageReader` (`maxImages = 3`; **nunca 1**
   — `createVirtualDisplay` rejeita Surface single-buffered).
2. Uma `MirrorPresentation` descartável carrega `assets/web/espelho/sonda.html`: fundo `--accent`
   chapado; no centro um `<video autoplay loop muted playsinline>` de **`sonda.mp4`** (~40 kB, 2 s,
   **magenta puro `#FF00FF` 320×180 em H.264** — uma cor que não existe em lugar nenhum da paleta); e
   **uma faixa preta e uma faixa branca** chapadas nas bordas. **A `sonda.html` tem o batimento dela**
   — ela não é `/display/` e não herdaria o de lá.
3. Cinco amostras de pixel: fora do vídeo, dentro do vídeo, faixa preta, faixa branca, e um canto.

**A sonda é um INSTRUMENTO, não um juiz.** Isto é o que ela imprime, e é o que a torna útil:

- **comparação com TOLERÂNCIA, e o RGB medido SEMPRE impresso** — nunca só o veredito. Num aparelho
  com imagem escurecida (há issue aberta e 100% reproduzível exatamente nisto, §8), uma comparação
  exata falharia nos dois pontos e imprimiria **"TELA INTEIRA PRETA — a composição não chega"**: um
  diagnóstico falso, que manda o próximo leitor caçar um defeito que não existe;
- **prazo de 5 s com veredito próprio** — `nenhum quadro chegou`. Sem ele,
  `ImageReader.acquireLatestImage()` devolve `null` para sempre e `ligar()` não termina, justamente
  no caso que a sonda existe para detectar;
- **preto e branco medidos** respondem o `KEY_COLOR_RANGE` (§3.3, invariante 5) em número, não em fé.

| fora | dentro | veredito |
|---|---|---|
| ≈ `#E8A33D` | ≈ `#FF00FF` | **`readback: OK — o vídeo aparece`** |
| ≈ `#E8A33D` | ≈ `#000000` | **`readback: VÍDEO SAI PRETO`** + a linha do `PixelCopy` |
| ≈ `#000000` | ≈ `#000000` | **`readback: TELA INTEIRA PRETA — a composição não chega`** |
| tudo escurecido proporcionalmente | idem | **`readback: OK, porém ESCURO`** + os RGB medidos |
| nada em 5 s | — | **`readback: NENHUM QUADRO EM 5 s`** |

Se der preto no vídeo, uma segunda linha roda `PixelCopy.request(window, bitmap)` da janela da
`MirrorPresentation`: ele copia **apenas o buffer daquela janela** **(AOSP `PixelCopy.java`)**, então
preto no `PixelCopy` **e** colorido no VirtualDisplay é camada `SurfaceControl` irmã (normal), e
preto nos dois é buffer protegido. Sem isso, "deu preto" é indistinguível. *(A sobrecarga
`PixelCopy.request(Window, …)` está depreciada desde a API 34 — funciona, mas é o único código do
lote que ninguém neste repositório jamais exercitou, e por isso vive dentro de um `try`.)*

### 7.5 O detector que continua funcionando depois da sonda: **o ritmo**

Uma cena com vídeo em movimento produz P-frames grandes e variáveis; um retângulo preto produz
quadros minúsculos e constantes. O servidor cruza o **bitrate médio dos últimos 10 s** e o **fps
medido na saída do encoder** com o que `nowPlaying` já disse do lado web:

```
ritmo: 2,4 Mbps · 24 fps (10 s) · cena "hino 214" (vídeo, cortina aberta) — conteúdo se movendo
ritmo: 4 kbps · 1 fps (10 s) · cena "hino 214" (vídeo, cortina aberta) — ALARME: ISTO É UM RETÂNGULO PRETO
ritmo: 6 kbps · 1 fps (10 s) · cena "Salmo 23" (versículo) — imagem parada, normal
ritmo: 5 kbps · 1 fps (10 s) · cortina FECHADA — não conclusivo
```

**Invariantes do detector, e os dois são correções:**

1. **Ele só opina quando a cena declara vídeo TOCANDO e cortina ABERTA.** A cortina cobre o telão —
   por construção, tela preta com a mídia carregada. Durante uma oração com a cortina fechada e um
   louvor pausado atrás, um detector ingênuo acusaria uma falha que não existe, **no Registro, com
   botão de copiar, para ser repassado**. Vale o mesmo para vídeo pausado e para os fades.
2. **Ele é ALARME, não relatório.** É o único mecanismo do desenho inteiro que detecta a
   `MirrorPresentation` morta com o encoder vivo (§3.2, invariante 5) — H.264 impecável de um
   retângulo preto, com todos os contadores subindo e nenhuma exceção em lugar nenhum.

E o **fps medido** é a única forma de ver o estrangulamento de timer do Chromium no WebView do
espelho (§8, risco 4): se o batimento for estrangulado, o número cai de ~1 para ~0.

### 7.6 O bloco do Registro, inteiro

Um BLOCO no `#diagBox`, nunca uma caixa nova, **com o botão de copiar** (`copiarTexto`,
`controle.js:10147` — código). Montado pelo `controle.js` a partir do JSON de `espelhoDiag()`.

```
Espelho de pixels
servidor: ligado em 192.168.0.42:8787 (HTTP, ligado à Wi-Fi) · 18 min no ar
tela virtual: 1280x720 @ 213 dpi · flags=0 · privada: SIM · NEVER_BLANK: SIM · id 7
viewport do espelho: 961x540 CSS (alvo: 960x540 — a TV desenha assim)
readback: OK — fundo #E8A33D · vídeo #FF00FF · preto #000000 · branco #FFFFFF
encoder: OMX.qcom.video.encoder.avc · instâncias máx: 16 · reclaims: 0
ritmo: 340 kbps · 1 fps (10 s) · cena "hino 214" (áudio, cortina aberta) — imagem parada, normal
térmica: NONE (máx na sessão: LIGHT) · carregador: SIM
áudio: contexto running · 24 blocos de PCM/s · AAC 96 kbps
telas: 2 conectadas de 3 · 0 pendentes · 3 PINs recusados (2 origens)
  tela A  Chrome 141   MSE:sim  fetch-stream:sim  seguro:nao  wakeLock:nao  tela acesa 18 min
          12,4 MB · 0 descartes · ultimo write ha 0,2 s
  tela B  Chromium 79  MSE:sim  fetch-stream:sim  seguro:nao  wakeLock:nao  tela acesa 4 min
          11,9 MB · 2 descartes (fila cheia) · ultimo write ha 0,4 s
ultima desconexao: tela C · 12:41 · sem escrita ha 30 s (cliente dormiu)
```

### 7.7 O que SÓ o aparelho responde, e o que cada resposta decide

| # | Pergunta | Como | Decide |
|---|---|---|---|
| **A1** | AP isolation na rede da igreja | ligar o espelho e abrir de outro aparelho | **mata todas as topologias menos um relé externo**, que este documento recusa (§10). É o primeiro spike e continua sendo |
| **A2** | `presentation.show()` funciona com `flags = 0`? | a primeira execução; o `catch` já está escrito | se falhar, o espelho **recusa ligar com a classe e a mensagem no Registro** — nunca "tenta com `FLAG_PRESENTATION`" (§3.2, invariante 2) |
| **A3** | O `AudioContext` do WebView do espelho inicia sem gesto? | Entrega 3, primeira execução; falha ⇒ mudo, nunca som no salão | Provável, não moeda ao ar: `mediaPlaybackRequiresUserGesture = false` (invariante 4) mapeia para a política `no-user-gesture-required` do Chromium, que é a mesma que governa o estado inicial do `AudioContext`. Dizer isso importa, porque senão alguém constrói preventivamente o plano B com `MediaProjection` que o §10 proíbe |
| **A4** | O encoder é **reclaimed** com o app 10 min minimizado? | a linha `reclaims:` | já tratado no código; o número diz se precisa de mais |
| **A5** | O batimento sobrevive ao app minimizado **e à tela do celular apagada**? | espelho ligado, app minimizado, tela apagada, 10 min, ler o **fps** | o `KeepVisibleWebView` foi testado contra `document.hidden` de um `<video>` e o `CLAUDE.md` diz que *"não bastou para o YouTube"*; **nunca foi testado contra um timer**, que é máquina diferente |
| **A6** | Bloquear e desbloquear o celular com o espelho no ar quebra a composição? | 30 s do operador, e re-amostrar a sonda | é o experimento para o qual as duas issues do §8 apontam |
| **A7** | Com Smart View ligado, o nosso encoder sobrevive? A TV engasga? | ligar o espelho com TV conectada (a confirmação já pergunta) | mede o custo real da decisão D1 |
| **A8** | Bateria e térmica em 2 h | a linha `térmica:` + medir a bateria de 15 em 15 min, com e sem espelho | dado de silício: o núcleo do encoder AVC 1080p é **~176–242 mW** — ~2% de uma bateria de 19 Wh em 2 h. O que consome é o **segundo WebView renderizando**, a composição e o rádio. Regra prática: **celular no carregador**, 720p, degradar em `THERMAL_STATUS_SEVERE` |
| **A9** | O **embed do YouTube** sai preto? | projetar um vídeo pelo iframe e reler a sonda | o `<video>` local e o `mse.js` estão respondidos pela analogia do Miracast (§1.2); o embed servido com Widevine L1 é a única exceção plausível — e é rara por construção, porque o app baixa ou transmite por padrão |

---

## 8. OS RISCOS QUE SOBREVIVEM

**1. `VirtualDisplay` + camada de vídeo diverge na Samsung — e a Samsung é o aparelho do operador.**
Duas issues abertas, ativas e 100% reproduzíveis:
[flutter#141207](https://github.com/flutter/flutter/issues/141207) (*"Virtual Display renders **too
dark** on some Android phones"* — S20 FE, S23, S23 Ultra, Android 13/14; correto em Pixel e Nokia;
correto no mesmo aparelho em Hybrid Composition; **aberto, sem causa raiz**) e
[flutter#172641](https://github.com/flutter/flutter/issues/172641) (SurfaceView dentro de
VirtualDisplay **fica preto após bloquear/desbloquear a tela** — S20, S22, Android 13 e 15).
**Ressalva honesta:** o alvo do VirtualDisplay do Flutter é um `SurfaceTexture` e o nosso é a *input
surface* do `MediaCodec`; nenhuma das duas é prova contra nós. **Mas as duas apontam para o mesmo
lugar, e o prognóstico do §1.2 não cobre isso** — o display do dongle é criado por outro adapter
(`WifiDisplayAdapter`, com `FLAG_PRESENTATION` e **sem** `NEVER_BLANK`/`OWN_CONTENT_ONLY`), então a
analogia vale para "camada de vídeo entra na composição?" e **não** vale para "o SurfaceFlinger
gerencia a cor e o ciclo de vida deste display do mesmo jeito?".
**Quando se materializar:** a sonda diz qual dos quatro casos é (escuro, vídeo preto, tudo preto,
nenhum quadro), com os RGB medidos. Escuro ⇒ o espelho **vale mesmo assim**, e a folha diz "as cores
da rede saem mais escuras que o telão". Vídeo preto ⇒ o espelho de pixels morre para vídeo e o
recurso se reduz a letra/versículo/mensagem/cronômetro, que é 90% de um culto — e o modo imagem, que
passa pelo **mesmo** readback, morre junto, então não há para onde degradar. Preto depois de
bloquear/desbloquear ⇒ remontar o VirtualDisplay no `onDisplayChanged`, e o A6 é o teste.

**2. O readback do embed do YouTube com Widevine L1.** Aquele item, **e só ele**, sairia preto.
**Quando se materializar:** é raro por construção (o app baixa ou transmite por padrão, e o embed é
o último recurso), o `ritmo` o denuncia em campo, e a resposta operacional já existe: usar o download
ou a transmissão direta para aquele vídeo.

**3. `ERROR_RECLAIMED` frequente.** Se o número da linha `reclaims:` subir, o espelho vira
inutilizável com o app minimizado. **Quando se materializar:** o teto de duas remontagens já
desliga com frase; a resposta seguinte é baixar para 480p (bitrate e fps, nunca resolução) para
reduzir a pressão, e a resposta final é dizer ao operador que este aparelho não sustenta espelho com
o app em segundo plano.

**4. O batimento estrangulado.** O Chromium estrangula timers por orçamento, e a fonte de verdade é
a visibilidade da página. O `KeepVisibleWebView` e o `setRendererPriorityPolicy(RENDERER_PRIORITY_IMPORTANT)`
(`WebViewFactory.kt:106-107, 144` — **código**) são a mitigação, e nunca foram testados contra um
timer. **Quando se materializar:** o fps da linha `ritmo` cai para ~0 com o app minimizado. Resposta:
subir a frequência não adianta (o orçamento é por tempo, não por chamada); o conserto é do lado
Kotlin — um `evaluateJavascript` periódico do serviço para dentro do WebView do espelho, que é
trabalho *empurrado* em vez de agendado. É um plano B de ~15 linhas e não precisa ser escrito antes
da medição.

**5. AP isolation.** Sem conserto do lado do app. **Quando se materializar:** a linha `nenhuma
conexão desde que ligou` é o diagnóstico, e as saídas são operacionais — outro SSID, ou o hotspot do
celular. Um relé pelo site do operador resolveria, e está recusado (§10 item 12): exige 3 Mbps de
upload sustentados por 2 h — a direção escassa de qualquer link doméstico — e manda o material do
culto para fora do prédio.

**6. Zero dependência é verdade, e o volume não é pequeno.** ~1.600 linhas de Kotlin novas em 8
arquivos, sobre as **7.612** medidas hoje: **+21%**, 16 → 24 arquivos, num recurso só. O `CLAUDE.md`
usa a proporção como filosofia, não como regra, mas o número tem de estar dito e assumido. O
`EspelhoServidor.kt` continua sem oráculo (P1 cobre o parser e o pareamento, não o fan-out nem o
ciclo de vida do serviço) — e isso também tem de estar dito, em vez de se contabilizar só as linhas
economizadas com o `chunked`.

**7. O espelho inverte, sem apagar, uma propriedade de segurança decidida por escrito.**
`PLANO-TELAO-NA-REDE.md:377`, verbatim: *"um servidor LAN em Kotlin, sozinho, **não consegue vazar o
acervo**. Ele não tem os bytes."* Com o espelho de pixels ele passa a ter **a imagem contínua de tudo
que a igreja projeta**, e na Entrega 3 o áudio junto. Isto é uma **inversão deliberada**, e precisa
estar escrita como inversão, ou a próxima pessoa vai reler o plano antigo e achar que a propriedade
continua valendo. Em HTTP claro, o pareamento é uma fechadura numa parede de vidro, e a UI diz isso
em uma linha. Com TLS a parede fecha — é o único ganho de segurança real do degrau da §2.4.

**8. O espelho é um segundo contexto de terceiro no processo privilegiado.** Sem TV existe **um**
`/display/` carregando a IFrame Player API; com o espelho, **dois**, cada um com seu `YT.Player`. E a
transmissão direta passa a rodar duas vezes — dados móveis dobrados no exato ambiente descrito como
"rede ruim, pode não ter internet". Nenhuma das duas coisas é impeditiva; as duas precisam estar na
tabela de custos.

**9. A frase para o operador tem de dizer que o áudio é PARCIAL.** Falta o embed do YouTube (§3.9,
invariante 8) e, por decisão, falta o microfone ao vivo. Ele vai descobrir isso num domingo se não
estiver escrito antes.

---

## 9. IMPACTO NA DOCUMENTAÇÃO

### 9.1 `CLAUDE.md`

| Seção | O quê |
|---|---|
| **Estrutura do repositório** | oito arquivos Kotlin novos na árvore, e a contagem de linhas refeita (`wc -l`, com o lembrete que já existe de medir antes de citar). `assets/web/espelho/` na árvore web |
| **Invariantes do shell** | **uma invariante nova, a 9**: *"o WebView do espelho recebe a ponte com `host = null` e o loader sem `/saf/`, como o telão — e pela mesma razão, agravada: ele hospeda a IFrame API de terceiro e agora existe um `espelhoLigar` na ponte."* E uma nota na invariante 8 dizendo que **ela se INVERTE num `ServerSocket`** — quem aplica `Range` ali é o servidor, e no espelho não há `Range` nenhum |
| **A ponte `window.AVNative`** | de trinta para **trinta e cinco métodos**: `espelhoLigar`, `espelhoDesligar`, `espelhoEstado`, `espelhoDiag`, `espelhoAprovar`. `SHELL_VERSION` **32**, com o motivo. E a regra que já existe, repetida: um método novo **não chega por OTA**, e o cartão do espelho não é desenhado com `__SHELL_VERSION__ < 32` |
| **Barramento de comandos** | o parágrafo do **dreno**: por que ele é lista de permissão de um item, por que `display-ready` passa, e por que `BroadcastChannel` é neutralizado no envio em vez de apagado |
| **Trabalho em segundo plano** | o `EspelhoService` ao lado do `SyncService`: `connectedDevice` **sem cota**, o pré-requisito de `CHANGE_WIFI_MULTICAST_STATE`, e a nota da doc sobre `mediaProjection` (com o motivo de ele ser inalcançável de propósito) |
| **Divergências web × nativo** | **três linhas novas**: "espelho na rede local" (navegador: não existe; app: `VirtualDisplay` + `MediaCodec` + servidor HTTP); "papel `espelho`" (o terceiro valor de `__AV_ROLE__`, e as guardas que ele ativa); "batimento de 8 Hz" (só no papel espelho) |
| **Build e distribuição** | o passo `./gradlew testDebugUnitTest` no CI, **sem `continue-on-error`**, e os testes novos de `tools/` |
| **Regras de desenvolvimento** | **a quarta exceção** à regra de zero dependência (JUnit, §7.2), escrita no molde das outras três. E a regra que sai do §3.8: *"diagnóstico novo em Kotlin devolve JSON; quem monta a frase é o `controle.js`"* |
| **Versão atual** | 5.140 → 5.143 ao fim das entregas, `SHELL_VERSION` 31 → 32, `minShell` ficando em **2** |

### 9.2 `docs/ARQUITETURA-WEB.md`

| Seção | O quê |
|---|---|
| **Papéis** | `__AV_ROLE__` passa a ter **três** valores. Registrar que as duas leituras existentes comparam `!== 'controle'` e que por isso o papel novo é seguro por construção — é uma verificação que ninguém vai refazer |
| **O barramento** | o dreno, do lado web: o que passa, o que morre, e por que a exceção do `display-ready` é o que faz o reenvio endereçado da v5.140 valer a pena uma segunda vez |
| **Camada de áudio do Display** | o grafo do espelho (`MediaElementSource → gain(0) → destination` **e** `→ worklet → gain(0) → destination`), a ordem à prova de falha, e as duas exceções nomeadas (YouTube e microfone) |
| **Seção nova: `assets/web/espelho/`** | o muxer, o atraso de um quadro e por quê, a fila de append, a poda, a perseguição da borda, o gesto único, e a regra `isSecureContext &&` |
| **Paleta** | a `sonda.html` usa `--accent` e magenta `#FF00FF`; o magenta **não entra em `tokens.css`** — ele é instrumento, não cor de marca, e existe justamente por não pertencer à paleta |

### 9.3 Arquivos de plano

- `docs/PLANO-ESPELHO-DE-PIXELS.md` — marcar como **histórico**, com um cabeçalho apontando para cá e
  a lista das sete correções, para que ninguém o leia como fonte.
- `docs/PLANO-TELAO-NA-REDE.md` — marcar a §7 (pareamento) como **reinstalada por este documento** e
  a §7.4 item 1 como **corrigida**: *"não há saída dentro das regras do projeto"* está errado — o
  certificado é do NOME, não do IP (§2.4). E anotar que a §8 (*"a tela do cliente apaga, sem contorno
  técnico"*) foi **derrubada** pelo wake lock do `<video>` (§3.10), com a ressalva de que isso vale no
  modo vídeo e não no modo imagem.

---

## 10. O QUE NÃO FAZER — NOMINALMENTE

Esta seção existe para ninguém redescobrir nada daqui a seis meses.

1. **Não escrever RFC 6455 à mão.** ~150 linhas de protocolo (350–500 no estilo daqui) **sem
   oráculo**, para entregar o que `Transfer-Encoding: chunked` entrega em 10. Se um dia for preciso,
   os erros clássicos são: comprimento de 127 tem **8 bytes** (falha só acima de 64 kB, ou seja no
   IDR); o servidor **nunca** mascara; `read()` não entrega o frame inteiro; frames de controle
   intercalados exigem **lock de escrita por conexão**; e ignorar os pings do Chromium mata a
   conexão em minutos de cena parada.
2. **Não usar WebCodecs como caminho principal** — §3.10. Ele custa o wake lock do `<video>`, a
   sincronia A/V, e exclui TV e Firefox Android. E não economiza o `fmp4.js`.
3. **Não usar `VIRTUAL_DISPLAY_FLAG_PRESENTATION`** — ele é a **causa** do problema que o filtro
   depois teria de consertar.
4. **NUNCA usar `VIRTUAL_DISPLAY_FLAG_PUBLIC`.** Ele implica `AUTO_MIRROR` (que exige
   `CAPTURE_VIDEO_OUTPUT`) **e remove `FLAG_NEVER_BLANK`** — perde-se de uma vez a permissão e a
   sobrevivência à tela apagada.
5. **Não filtrar display por id ou por nome** — o predicado é `Display.FLAG_PRIVATE`, estrutural,
   mais a exclusão explícita do nosso id.
6. **Não drenar o `post` do `__AVBus` por inteiro** — C6. E **não apagar `BroadcastChannel`**:
   neutralizar só o `postMessage`.
7. **Não usar `setInteger` em `KEY_REPEAT_PREVIOUS_FRAME_AFTER`**, e não contar com ela como piso de
   fps — C1/C2.
8. **Não fixar `densityDpi = 160`** — C3. Não fixar `KEY_PROFILE` para High sem
   `KEY_MAX_B_FRAMES = 0`. **Não mudar a resolução do VirtualDisplay durante a sessão** — reflui o
   layout na frente da congregação.
9. **Não usar `VirtualDisplay.setSurface` em lugar nenhum** — D4. Trocar de modo é rebuild; a sonda
   roda em display descartável.
10. **Não copiar `FLAG_KEEP_SCREEN_ON` do molde do `StagePresentation`** — é wake lock do aparelho
    inteiro, e o `FLAG_NEVER_BLANK` já resolve o que importa. E **não prometer que o Wi-Fi lock
    resolve latência com a tela apagada**: `WIFI_MODE_FULL` é não-funcional e `LOW_LATENCY` exige o
    app na frente e a tela acesa.
11. **Não usar `MediaProjection`/`AudioPlaybackCapture` para o áudio** enquanto o caminho do §3.9 não
    for reprovado em aparelho. Diálogo de consentimento por sessão e indicador de gravação de tela
    **antes de projetar, num culto** — e som no salão de brinde.
12. **Não usar `AudioWorklet` no CLIENTE** em `http://` — é `[SecureContext]` e vem `undefined`.
    (Dentro do WebView do espelho, ele existe e é o caminho.) E **não deixar o `AudioWorkletNode`
    como folha** — sem caminho até o `destination`, o comportamento é subespecificado e o modo de
    falha é silêncio total.
13. **Não emitir certificado autoassinado com CA instalada nos clientes**, e **não tentar certificado
    para IP privado** — §2.4. Os dois estão fechados por regra normativa, não por dificuldade.
14. **Não pôr credencial da "placa de rua" no APK.** As Releases são públicas; a página oficial da
    igreja viraria phishing com o domínio da própria igreja.
15. **Não construir sobre WebRTC.** No Kotlin arrastaria `libwebrtc` (quinta dependência, morre pela
    regra). No WebView é elegante e apaga o servidor inteiro — **mas exige internet para a
    sinalização**, exige um **terceiro canal de distribuição** (a página no site, fora de APK e fora
    de OTA) e não resolve AP isolation. Fica registrado como avaliado.
16. **Não usar o relé do site como padrão.** Exige **3 Mbps de upload sustentados** do prédio por 2 h
    e manda o material do culto, inclusive o microfone ao vivo, para fora. É a **única** resposta a
    AP isolation, e só por isso.
17. **Não usar WebTransport** — exige servidor HTTP/3 sobre QUIC, que não existe na JDK nem no
    Android SDK. **Não usar `insertable streams`/Encoded Transform** para injetar H.264 pronto no
    WebRTC: não existe API de "fonte de quadros codificados" em spec nenhuma.
18. **Não inventar relógio mestre, NTP caseiro ou handshake de latência** — §2.2.
19. **Não manter uma allowlist de tipos de comando em Kotlin.** É a forma de falhar preferida deste
    projeto (`slideLabel`, `bytes`). O dreno é do lado JS, é de **um item**, e tem teste.
20. **Não servir arquivo do acervo, nem `/saf/`, nem listagem** — §3.6. **Não montar rota por
    concatenação** sobre o `WebPathHandler`.
21. **Não ligar o socket em `0.0.0.0` nem em `::`**, e não deixá-lo de pé sem Wi-Fi — §2.3. É a única
    falha desta lista cujo custo sai do prédio.
22. **Não pôr o token numa URL**, não rotacionar o PIN por tentativas erradas, e não tirar o operador
    do laço — §3.5.
23. **Não copiar o `StreamProxy`.** A invariante 8 **se inverte** num `ServerSocket`.
24. **Não capturar o áudio do FIM do grafo.** A fonte do áudio do espelho é o elemento de mídia e só
    ele. **O microfone ao vivo do santuário nunca atravessa a rede** — um
    `MediaStreamAudioDestinationNode` no fim do grafo o mandaria em AAC para três navegadores
    desconhecidos, em HTTP claro. Esta é a linha que impede a "melhoria" óbvia.
25. **Não deixar o espelho ligar sozinho, nem sobreviver ao fechamento do app.** E **não fazê-lo
    desligar sozinho** quando a TV conecta — §1.5.
26. **Não acrescentar uma quinta dependência.** `ServerSocket`, `KeyStore`, `SecureRandom`,
    `MessageDigest`, `Base64`, `MediaCodec`, `ImageReader`, `PixelCopy`, `ConnectivityManager` e o
    `androidx.webkit` já declarado cobrem tudo. Se algum passo exigir uma, **esse passo morre**.

---

## 11. A FRASE PARA O OPERADOR

> Dá para pôr o telão inteiro — inclusive vídeo, fades e cortina — em até três navegadores da rede da
> igreja, sem instalar nada nas telas e sem depender de internet. O celular vira o servidor; quem
> quiser assistir digita o endereço uma vez, vê um número de seis dígitos na sua tela, e **você
> aprova**.
>
> Quatro coisas precisam ser ditas antes: **o roteador da igreja pode bloquear isso sozinho**
> (isolamento de clientes) e não há conserto do lado do app — o próprio recurso vai dizer, em texto,
> quando for esse o caso; **o celular precisa ficar no carregador**; **o som não vai completo** (o
> vídeo do YouTube tocado pelo player embutido vai mudo, e o microfone ao vivo nunca sai na rede, de
> propósito); e **você liga isso pela primeira vez numa terça-feira, não no domingo**.
>
> O espelho é auxiliar: ele **não desliga a TV, não muda a projeção e não se desliga sozinho quando a
> TV conecta**. Se ele falhar, quem perde a imagem são as telas da rede — nunca o salão.
>
> O seu site HTTPS entra como **a placa de rua** — `igreja.org.br/telao` mostrando o endereço do dia
> e um QR —, e pode virar cadeado verde de verdade se você puser um nome do seu domínio apontando
> para o celular. Isso é um degrau: com internet fica melhor, sem internet volta a ser o que seria de
> qualquer forma — **e nunca menos que isso**.

---

**Fontes verificadas ao escrever este documento:**
[VirtualDisplayAdapter.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/display/VirtualDisplayAdapter.java) ·
[DisplayManagerService.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/display/DisplayManagerService.java) ·
[DisplayManager.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/java/android/hardware/display/DisplayManager.java) ·
[DisplayDeviceInfo.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/display/DisplayDeviceInfo.java) ·
[Presentation.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/java/android/app/Presentation.java) ·
[WindowManagerService.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/wm/WindowManagerService.java) ·
[VirtualDisplay.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/java/android/hardware/display/VirtualDisplay.java) ·
[MediaFormat.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/MediaFormat.java) ·
[PixelCopy.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/graphics/java/android/view/PixelCopy.java) ·
[Chromium video_wake_lock.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/html/media/video_wake_lock.cc) ·
[Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types) ·
[JavaScript bridge / WebMessageListener](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge) ·
[AOSP: Implement HWC](https://source.android.com/docs/core/graphics/implement-hwc) ·
[Flutter VirtualDisplayController.java](https://raw.githubusercontent.com/flutter/flutter/master/engine/src/flutter/shell/platform/android/io/flutter/plugin/platform/VirtualDisplayController.java) ·
[scrcpy SurfaceEncoder.java](https://raw.githubusercontent.com/Genymobile/scrcpy/master/server/src/main/java/com/genymobile/scrcpy/video/SurfaceEncoder.java) ·
[go2rtc video-rtc.js](https://raw.githubusercontent.com/AlexxIT/go2rtc/master/www/video-rtc.js) ·
[W3C Media Source Extensions](https://www.w3.org/TR/media-source-2/) ·
[W3C WebCodecs](https://www.w3.org/TR/webcodecs/) ·
[WebAudio/web-audio-api#2566 (saída desconectada)](https://github.com/WebAudio/web-audio-api/issues/2566) ·
[WICG Local Network Access](https://github.com/WICG/local-network-access/blob/main/explainer.md) ·
[CA/B Forum: Internal Names](https://cabforum.org/working-groups/server/internal-names/) ·
[CA/B Forum Ballot SC-081v3](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/) ·
[How Plex is doing HTTPS](https://words.filippo.io/how-plex-is-doing-https-for-all-its-users/) ·
[GitHub Blog: CORS and DNS rebinding](https://github.blog/security/application-security/localhost-dangers-cors-and-dns-rebinding/) ·
[janhq/jan#8453](https://github.com/janhq/jan/issues/8453) ·
[Video-Dev: gaps em buffered](https://websites.fraunhofer.de/video-dev/being-trapped-in-a-gap-with-big-buck-bunny/) ·
[flutter#141207](https://github.com/flutter/flutter/issues/141207) ·
[flutter#172641](https://github.com/flutter/flutter/issues/172641)
