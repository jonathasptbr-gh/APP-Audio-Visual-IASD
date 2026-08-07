# Auditoria completa do código — agosto/2026

Varredura integral do repositório (shell Kotlin, base web, CSS/HTML, CI e
documentação) feita por nove frentes de revisão paralelas e com os achados de
maior severidade re-verificados individualmente contra o código. **O código foi
tratado como a verdade; a documentação como referência.** Cada achado traz
arquivo:linha, severidade e confiança (confirmado = relido no código;
provável = dedução forte por leitura; suspeita = registrado por dever).

Base auditada: `main`/branch de auditoria em v5.138 (web) · shell 31 · APK v1.62.

---

## 1. Bugs — severidade ALTA

### 1.1 `flash()` é no-op, mas código NOVO depende dele como único canal de aviso
`controle.js:10988` (definição vazia) × chamadores `199`, `218`, `9030`, `9064`,
`7299`, `7333-7334`, `7406-7408`, `9600/9788` — **confirmado (re-verificado)**

O toast foi removido numa reforma antiga e `flash()`/`dismissFlash()` viraram
no-ops de propósito ("qualquer mensagem que antes ia pro toast simplesmente não
aparece mais"). Mas as versões **v5.136 e v5.137 voltaram a usá-lo como canal
ativo**:

- `controle.js:9030` (v5.137): a falha do download de um link compartilhado sem
  linha visível — o comentário imediatamente acima diz "a faixa flutuante é o
  **único canal que resta**" e que "um download de minutos que termina em nada é
  o silêncio que este app não pode ter". A mensagem nunca aparece: o silêncio
  que o comentário condena é exatamente o que acontece.
- `controle.js:9064` (v5.137): o desfecho BOM do share ("Adicionado no
  Cronograma.") também é engolido.
- `controle.js:199/218` (v5.136): tocar no rótulo de versão para forçar a
  procura de OTA deveria responder "Procurando atualização…" / "Você já está na
  versão mais recente." — nada aparece; o operador toca e, sem versão nova,
  nada visível acontece.
- `syncDeviceFolder`/`openFolderSource` (`7299`, `7333-7334`, `7406-7408`):
  "Erro na sincronização", "N arquivo(s) sincronizado(s)", "Pasta já em dia" —
  todos mudos.
- `ensureSongDownloaded` (`9600`, `9788`, `9793/9827`): o contrato `toast:`
  documentado em 9582-9584 ("sem ele o toque ficaria mudo") pressupõe um toast
  que não existe; a cadeia `opts.toast`/`dismissFlash` é letra morta.

Correção natural: religar esses pontos a `avisar()` (o save-hint, `11056`) — e
atenção ao parâmetro `avisar` de `atualizarProcura` (`211`), que **sombreia a
função global** e provavelmente contribuiu para a escolha do `flash` morto ali.

### 1.2 O `ended` do vídeo cancela um `load` em voo
`stage.js:842-853` (handler) × checkpoints `581`/`597` — **confirmado
(re-verificado)**

O handler de `ended` faz `const seq = ++loadSeq` síncrono no instante do
evento. Um `load()` em curso (o fade de saída dura ~0,6 s e o vídeo anterior
segue tocando durante ele; ou a janela do `await AVDB.getMedia`) é descartado em
silêncio no próximo checkpoint. Cenário real: o operador toca o próximo hino nos
últimos ~600 ms do vídeo atual → o vídeo termina durante o fade → o load novo
morre calado, o `ended` cobre com wallpaper e envia `media-ended`; sem repeat, o
item pedido nunca entra. O `loadSeq` foi desenhado para "só ações exclusivas
cancelam um load" — o fim natural não é uma ação do operador e não deveria
ganhar dele. Nenhum teste cobre (o `stage-fade.test.mjs` nunca deixa um vídeo
terminar durante um load).

---

## 2. Bugs — severidade MÉDIA

### 2.1 Seek durante fetch em voo perde um segmento e trava a transmissão
`mse.js:300-333` (`alimentar`) × `429-437` (`aoBuscar`) — **confirmado
(re-verificado)**

`alimentar()` lê `const seg = f.segs[f.i]` **antes** do `await pegar(...)` e faz
`f.i++` **depois**; `aoBuscar()` (evento `seeking`) escreve
`f.i = indiceEm(f.segs, t)` no meio desse await, sem checar `f.ocupada`. O
append do segmento velho cai no lugar certo (fragmentos carregam o próprio
tempo), mas o `f.i++` incrementa o **índice novo do seek** — o segmento do ponto
buscado nunca é pedido, fica um buraco no buffer e o vídeo trava no ponto do
seek enquanto a bomba segue baixando os segmentos seguintes. Janela: qualquer
seek enquanto o buffer ainda enche. `mse.test.mjs` não exercita seek.

### 2.2 O `StreamProxy` não confere se o upstream honrou o `Range`
`StreamProxy.kt:299-384` — **confirmado o gap (re-verificado); impacto provável**

`conectar()` sempre envia `Range`, mas `responder()` só trata `codigo >= 400`;
não exige 206 nem valida `Content-Range`. Se o googlevideo (ou um proxy
transparente da rede — cenário que o próprio projeto trata como real em
`YoutubeGrab.baixarUmaVez:1574-1580`) responder 200 com o recurso inteiro:

- caminho da query: um recurso ≤ 24 MB (um m4a de áudio tem ~4 MB) é devolvido
  inteiro rotulado como a fatia pedida — o `mse.js` appenda bytes errados;
  acima de 24 MB vira 502 com a mensagem enganosa "pedaço acima de 24 MB";
- caminho de compatibilidade: `FatiaComoTodo(corpo, fantasma)` supõe que o corpo
  começa no byte `fantasma`; com 200 ele começa no 0 — corrupção silenciosa, a
  mesma classe de defeito que a v1.55 consertou.

Correção barata: quando um `Range` foi enviado, exigir 206 (ou `Content-Range`
coerente), senão `erro(502, …)`.

### 2.3 `MuxMp4` devolve sucesso com arquivo sem `moov` quando o `stop()` falha
`MuxMp4.kt:104-123` — **confirmado (re-verificado)**

`return true` é computado antes do `finally`; se `muxer.stop()` lançar ali (por
exemplo trilha sem amostras), a exceção é engolida e a função devolve `true`
com um MP4 sem índice — que passa no teste `saida.length() > 0` de `montar()` e
só falha na projeção. O `saida.delete()` do finally só roda `if (!iniciado)`,
então o arquivo quebrado sobrevive. O próprio comentário do arquivo diz "um MP4
sem índice é pior que arquivo nenhum" — a guarda só cobre metade dos casos.
Correlato (`YoutubeGrab.kt:976-979`): um `juntar()` que devolve `false` com
`iniciado == true` também deixa a `saida` quebrada no cache sem `delete()`.

### 2.4 `nowPlaying`/`bgProgress` sem guarda de `host` — o telão pode derrubar o serviço da projeção
`NativeBridge.kt:300-326` (`bgProgress`), `:338-357` (`nowPlaying`) —
**confirmado o gap (re-verificado); exploração provável**

O WebView do Display recebe o mesmo `__AVBridge` (com `host = null`) e carrega a
IFrame Player API de terceiro por design — e `addJavascriptInterface` injeta o
objeto em todos os frames. Onze outros métodos recusam com `host == null`
(`otaApply`, `otaCheck`, `listFolder`, `pickDoc`…); estes dois não: um script no
documento do telão pode chamar `__AVBridge.nowPlaying('{"active":false}')` e
parar o `SessionService` — justamente o serviço `mediaPlayback` que impede o
processo (e a Presentation) de ser morto — ou falsificar a notificação de
download via `bgProgress`. Como o lado web deduplica por chave e não reenvia
estado igual, o serviço derrubado fica derrubado. Menor, no mesmo bloco:
`otaPending` (`:167-172`) também responde a qualquer papel, ao contrário dos
três irmãos.

### 2.5 Cancelamento do YouTube não curto-circuita as filas de candidatos
`YoutubeGrab.kt:509-546`, `830-861`, `897-937` — **confirmado**

Após o cancel, `baixarTentando` lança — mas o `catch` de `baixarAudio` não
distingue cancel de falha e segue para o próximo candidato; idem os laços de
`tentarJuntar` e `buscarInterno`. Cada candidato ainda abre conexão real (o
`cancelado()` só é consultado depois de `conn.responseCode`, até 15 s de
connect). Um cancel no meio de `tentarJuntar` pode custar meia dúzia de conexões
"depois de pedir para parar" — o que o comentário de `1422-1425` diz evitar, mas
só evita dentro de um `baixarTentando`. Relacionados:

- `:371-379`/`:657`/`:1594` — o KDoc de `CANCELADO` promete que ele "aparece no
  diagnóstico", mas `motivo()` só reconhece `HTTP nnn`: um cancelamento é
  registrado como `IOException`, indistinguível de queda de rede. (confirmado)
- `:553-560` — um `cancelar(link)` que chega após o teste do `finally` fica
  armado e mata instantaneamente o **próximo** download do mesmo link.
  (provável, janela estreita)

### 2.6 Diagnóstico do YouTube fica OBSOLETO quando a extração falha
`YoutubeGrab.kt:443-560` (`buscarInterno`), `686-722` (`manifesto`) —
**confirmado**

Se `StreamInfo.getInfo` lançar (vídeo removido, geo-block), o `catch` devolve
`null` sem tocar em `diagnostico` — o rodapé de Configurações continua exibindo
o resumo do vídeo **anterior**, com desfecho de sucesso. Para o instrumento cuja
razão de existir é "a única forma de saber é olhar o que chegou", mostrar a
extração de ontem para a falha de hoje é o pior modo de falhar.

### 2.7 `take`-antes-do-filtro perde candidatos e faz o diagnóstico mentir
`YoutubeGrab.kt:1152` (`candidatosVideo`), `702-706` (`manifesto`) —
**confirmado**

`candidatosVideo` faz `take(TETO_VIDEO)` **antes** de o `manifesto()` filtrar
`!webm`; `candidatosAudio` faz `take(2)` antes do `.firstOrNull { it.dash }`.
Um mp4-dash na 3ª posição por bitrate é descartado por dois candidatos
inelegíveis à frente — "SEM PAR DASH, caindo no download" com par bom na lista —
e `porQueNaoDash` conta só a janela pós-take, respondendo a pergunta errada.
O filtro deveria vir antes do teto.

### 2.8 `SessionService`: janela em que a cena se perde e nada a republica
`SessionService.kt:342-348` + `:192` — **confirmado por construção; ocorrência
rara**

`nowPlaying(active:false)` → `stop()`; logo em seguida `nowPlaying(active:true)`
chega antes de o `onDestroy` rodar → `update()` vê `running == true` e chama
`inst.publish()`, que se enfileira na main **atrás** do `onDestroy` e é
descartado pelo `if (!running) return`. `scene` fica preenchida, não há serviço,
e nenhum caminho o ressuscita (o web deduplica por chave e não reenvia; o
`updateFromDisplay` faz `instance?.publish()` sobre null). A notificação some
até a próxima troca de chave. Em `publish()`, o ramo `!running` com
`scene != null` poderia redisparar o start. Nota: o parâmetro `ctx` de
`updateFromDisplay` (`:387`) é morto — e é exatamente o que permitiria religar.

### 2.9 Wake lock de 2 h nunca renovado durante download legítimo
`SyncService.kt:144-151`, `182` — **provável**

`acquire(WAKELOCK_TIMEOUT_MS)` acontece uma vez no `onStartCommand`. O projeto
documenta sincronizações que somam horas (hinário + Bíblia + pastas; a cota FGS
fala em 6 h). Passadas 2 h de download andando, o lock expira em silêncio; com a
tela apagada a CPU pode cochilar e a rede estagnar — que aparece como o
`idleMs`/"sem resposta" que a notificação existe para denunciar. O timeout
contra download *travado* é correto; falta renovar quando há progresso real
(`updateProgress` chega continuamente e seria o ponto natural).

### 2.10 Callbacks de picker/permissão sobrescritos sem resolver o anterior
`MainActivity.kt:571-582`, `584-595`, `857-869` — **confirmado**

`pendingFolderPick = onResult` atropela um callback anterior em voo. O próprio
arquivo conhece o padrão correto: `onShowFileChooser` (`:907`) encerra o
pendente com `onReceiveValue(null)` antes de abrir o novo. Como `pickFolder` e
`requestMic` não têm prazo ("esperam uma pessoa"), a Promise da primeira chamada
fica pendurada para sempre.

### 2.11 Console do telão não é logado
`MicChromeClient.kt` (sem `onConsoleMessage`) vs `MainActivity.kt:948-951` —
**confirmado**

Um erro de JS no telão — a metade que roda na frente da congregação, carrega
script de terceiro e é a única que o watchdog do OTA **não** valida — some sem
rastro, só visível com remote debugging.

### 2.12 Cabeçalho do grupo "Hinários" usa a régua de "completo" abolida na v5.134
`controle.js:5284-5293` vs `5256` — **confirmado**

O ramo com botão usa `grupoCompleto(colls)` (conta **variantes**); o ramo sem
botão calcula `done` com `countDownloaded >= songsBaixaveis.length` (conta
músicas com `fileIdFull`, ignorando Playbacks). É a divergência que os
comentários de `776-788` e `5361` declaram eliminada: um hinário com Playbacks
faltando fica verde no cabeçalho e incompleto no card logo abaixo.

### 2.13 CI: `node --check` cobre `vendor/` e é gate do canal OTA
`.github/workflows/apk.yml:61-62` — **confirmado**

`vendor/pptx-renderer.js` é ESM (`export` top-level); `node --check` só o aceita
pela detecção automática de módulo do Node ≥ 22.7. Uma regressão de Node no
runner reprova o passo — **sem** `continue-on-error` — por causa de um arquivo
de terceiro buildado, bloqueando todo o canal OTA. O `find` do CI deveria
excluir `vendor/`, como o `wc -l` do CLAUDE.md já faz.

### 2.14 CI: a regra dos "três lugares de versão" não tem guarda
`apk.yml:63-68` — **confirmado**

O CLAUDE.md chama o `WEB_VERSION` esquecido de "o erro silencioso" e o
`version.json` esquecido de "o erro mudo" — e o CI valida só o `version.json`
isolado. Hoje os três batem (5.138×3, verificado); a única defesa é disciplina.
Um grep+assert de três linhas no passo de sanidade fecharia a classe.

### 2.15 Feedback de toque ausente em 6 botões criados depois da "regra única"
`controle.css:161-171` — **confirmado**

A regra `:active { transform: var(--press) }` promete "um botão novo nasce
coberto por omissão", mas não cobre `.head-fav-btn`, `.cue-save-btn`,
`.pl-pack`, `.yt-search-btn`, `.coll-more-btn` e `.log-copy`. Como o `*` zera
`-webkit-tap-highlight-color`, esses botões são totalmente mudos ao toque — o
defeito que a regra existe para impedir.

### 2.16 `bytesPorSegundo` é O(coleções × músicas), por card, a cada 400 ms
`controle.js:842-855` → `fracaoPeso` → cada card → `renderCollectionsList`
redisparada a cada `COLL_REFRESH_MS` (400 ms) durante sincronizações —
**estrutura confirmada; impacto provável**

Para todo álbum sem taxa própria, a função varre todas as coleções chamando
`levantarColecao` (que varre todas as músicas). Com dezenas de álbuns e milhares
de faixas, cada redesenho faz centenas de milhares de iterações para recomputar
uma taxa global que não mudou. Memoizar por passada de render resolve. Correlato:
`levantarColecao` sem cache é recomputada 3-4× por card por render (`789-812`).

### 2.17 Varredura de pendências do `syncCollection` é serial: ~2 `fileGet` por música
`controle.js:7714-7719`, `9559-9573` — **confirmado**

Num hinário de ~600 músicas são ~1200 leituras de IDB em série antes do primeiro
byte de download. Um `getAll` único indexado (como `buildLyricIndex` já faz) ou
um `runLimited` reduz a espera em ordem de grandeza.

### 2.18 `gcOrfaos`/`isReferenced` relê todas as listas por id (quadrático)
`db.js:647-662` — **confirmado**

Cada id varrido dispara leitura de todas as listas + `folders` + cada
`folder_<id>` de novo, dentro da mesma transação. Ler os detentores uma vez e
montar um `Set` reduz a passadas lineares. Além disso, o comentário do `gc()`
(`db.js:746-751`) diz "HOJE NÃO TEM CHAMADOR" — **falso**: `controle.js:4910` o
chama (troca link→arquivo no Cronograma). O comentário orienta manutenção sobre
premissa errada.

### 2.19 Prefetch incondicional da IFrame API no telão nativo
`display.js:1412` — **confirmado**

`restore()` injeta `youtube.com/iframe_api` (script de terceiro, origin
privilegiado, sem CSP — risco declarado nas linhas 737-743) em toda sessão,
mesmo no app nativo onde o embed é fallback raro. Condicionar a
`!window.__NATIVE__` (ou à existência de item YouTube no Cronograma) reduziria a
superfície sem custo.

### 2.20 `#seek` sem nome acessível
`controle/index.html:320` — **confirmado**

A barra de seek principal não tem `aria-label`; o gêmeo `#volSlider` tem. Menor,
mesma família: `#appDialog` (`:843`) tem `role="dialog"` sem
`aria-labelledby`/`aria-describedby` apontando para os IDs que já existem.

---

## 3. Bugs — severidade BAIXA (resumo)

| Onde | O quê | Conf. |
|---|---|---|
| `MainActivity.kt:508-510` | dismiss espontâneo da Presentation não faz `release()` — WebView do telão pode vazar vivo no MessageBus (hoje protegido só pela ordem de registro dos listeners) | suspeita |
| `MainActivity.kt:336-354` | `onRendererGone` zera `backgroundWork` mas não `captureVolumeKeys`/`audioAlive` — se a recarga falhar, o aparelho fica sem controle de volume | confirmado |
| `MainActivity.kt:80/885` + `NativeBridge.kt:720` | `pendingShare` lido da thread do WebView sem `@Volatile`/lock — visibilidade por sorte, não por contrato | confirmado (corrida) |
| `MainActivity.kt:717` | rótulo do fallback de cast diz "Google Cast" mas o toque abre `DISPLAY_SETTINGS` primeiro | confirmado |
| `SyncService.kt:137-142` | corrida `onTimeout` × `keepAlive(true)` simultâneo pode deixar serviço+lock até o timeout de 2 h | suspeita |
| `WebUpdater.kt:645-646` | `compareVersions` concatena dígitos de sufixo: `"5.138-rc1"` → 1381 > 138 — risco latente para versão publicada à mão | confirmado |
| `WebUpdater.kt:685-689/736-754` | `fetchText` sem teto; `unzip` sem teto de nº de entradas (defesa em profundidade) | confirmado |
| `WebUpdater.kt:427-431` | pisos da vigilância em `currentTimeMillis` — acerto de relógio para trás cala gatilhos; `elapsedRealtime` seria imune | confirmado |
| `ShareIntake.kt:106-119` | sem fallback para `ClipData` — app que compartilha só por lá produz share vazio | provável |
| `ShareIntake.kt:102-103` | `firstUrl` captura pontuação de fechamento (`)`/`.` finais) | confirmado |
| `SessionService.kt:418-426` | `stop()` não zera `lastPub*` — extrapolação da cena seguinte pode comparar com marcos da anterior | suspeita |
| `SessionService.kt:466` | smallIcon fixo em `ic_media_play`, não segue `playing` | confirmado |
| `WebViewFactory.kt:255-262` | `notFound()` com corpo vazio — o corolário da invariante 8: um 404 de `/saf/` com Range fora do zero evapora (teórico hoje; um corpo de 1 byte imuniza) | confirmado |
| `YoutubeGrab.kt:1087/1117-1120` | `dash` aceita `initIni = -1` (faixa `?r=-1-500` → 400) se a lib um dia preencher só metade | suspeita |
| `apk.yml:238` | tag empurrada para commit atrás do tip produz `versionCode` menor → downgrade recusado no aparelho | suspeita (fora do fluxo documentado) |
| `display.js:948-949` | falha do `loadYtApi` deixa o telão no preto sem fallback nem aviso (relevante no navegador) | provável |
| `display.js:550-554` | captura de mic abortada antes do grant não emite `mic-status` | suspeita |
| `bible.js:180-188` | `&amp;` decodificado antes de `&lt;`/`&gt;` — dupla-desescapada (cosmético, sem XSS) | confirmado |
| `mse.js:139-148` | âncora do `first_offset` correta por convenção do YouTube, não pela spec (box extra pós-sidx quebraria em silêncio) | suspeita |
| `controle.js:2066-2097` | ramos Bíblia/letra do `renderNowPlaying` forçam ▶ e desabilitam seek mesmo com áudio de fundo — pisca até o próximo tick (5 tratamentos, 3 regras) | confirmado |
| `controle.js:1417` | guarda do `previewTick` esquece `chronoSession`/`drawSession` (conjunto canônico tem 5) | confirmado |
| `controle.js:8618-8624` | `ytEstado` "pronto" nunca invalidado após exclusão da mídia — ✓ falso na busca | provável |
| `controle.js:6878/11645` | Parar via `stopEl` entra no diário como "PAUSA ESPONTÂNEA" (só o ▶ arma `pausaEm`) | provável |
| `controle.js:10879-10886` | `importShare` conta `ok++` mesmo com `addMedia` falho no ramo genérico | confirmado |
| `controle.js:10970` | `AVNative.onShare(importShare)` sem `.catch` — share que rejeita vira unhandled rejection e o intent (já consumido no Kotlin) se perde | confirmado |
| `controle.js:11556-11567` | comentário promete Esc no `appConfirm`; só `appPrompt` tem handler | confirmado |
| `controle.js:13133` | `AVNative.otaCheck` chamado sob guarda `>= 29` mas só existe no 31 — lança e é engolido a cada minuto nos shells 29-30 | confirmado |
| `controle.css:2396` | `#collPopup` não existe (saiu na v5.72) — metade do seletor é órfã | confirmado |
| `controle.css:931` | `.save-hint--erro` usa `--danger` (escuro) como borda sobre `--panel` — a própria folha (863-868) manda `--danger-strong`; o aviso de FALHA sai com a moldura mais fraca do trio | confirmado |
| `controle.css:1305` | `.sel-btn.danger` com `--danger-strong` sem fundo da família no rodapé da lista — possivelmente < 3:1 | suspeita |
| `native.js:532-533` | `\| 0` (truncagem Int32) sobrevive em `positionMs`/`durationMs` do `nowPlaying` — o "defeito irmão" que a v5.137 matou no `bgProgress` com `inteiro()`, a 30 linhas dali | confirmado |
| `native.js:249-261` | `__avShareArrived` durante pump em voo não re-agenda — share raro pode esperar o próximo gatilho | provável |
| `NativeBridge.kt:519` | no `ytStream`, `altura=0` vira teto **144p** (`coerceIn`) — o oposto da convenção "0 = padrão" do `ytFetch`; inócuo hoje, armadilha para o próximo chamador | confirmado |
| `native.js:331-333` | `ytStream` sem `CALL_TIMEOUT_MS`, ao contrário do gêmeo `ytSearch` — `tentarTransmitir` pode ficar em await para sempre | confirmado |
| `tools/ponte.test.mjs` | 4 campos remontados sem assert (`idleMs`, `wallpaper`, `title`, `subtitle`) — a regressão do `slideLabel`/`bytes` pode se repetir neles sem o CI acusar | confirmado |

---

## 4. Código morto (todos confirmados por grep)

**Kotlin/manifest/build:**
- `SessionService.kt:387` — parâmetro `ctx` de `updateFromDisplay` nunca usado.
- `YoutubeGrab.kt:1487` — default `ua: String = UA` sem uso; `:1298` —
  `resgate?.link != null` ≡ `resgate != null`; `:1221` — parâmetro `max` de
  `pesquisar` sempre 20; `:148-149/1179-1184` — perfil iOS inalcançável com
  `setFetchIosClient(false)` (morto **declarado** no KDoc, mas cada falha real
  paga uma requisição extra com UA que o CDN nunca pediu).
- `WebViewFactory.kt:158` — `databaseEnabled = true` é a chave do WebSQL,
  removido do Chromium (M119+): no-op.
- `AndroidManifest.xml:47-48` — `<queries>` de `CAST_SETTINGS`/`DISPLAY_SETTINGS`
  nunca são resolvidos (`startActivity` direto é isento do filtro).
- `build.gradle.kts:145` — `noCompress` de png/jpg/webp sem nenhum arquivo
  desses tipos em assets (só o woff2 faz algo).

**Base web:**
- `controle.js:10973-10976` — leitura de `pending-share` que ninguém escreve
  desde a v5.48 (rastro dos dois PWAs, admitido no CLAUDE.md).
- `controle.js:1901` — `activeTab === 'playlist'`: nenhum caminho produz esse
  valor (`TAB_ORDER` não o contém; a playlist é popup desde que virou `#plPopup`).
- `controle.js:443/2442` — `bibleMetaLoaded` escrito e nunca lido.
- `controle.js:5113-5118` — `listIconSvg()` sem chamador.
- `controle.js:266-309` — 8 entradas mortas na tabela `ICON` (`prev`, `stop`,
  `next`, `edit`, `close`, `plAdd`, `schedule`, `back`) — `plAdd` carrega dez
  linhas de justificativa de um glifo que o JS nunca desenha.
- `controle.js:11866` — `[volSliderEl].forEach` (array de um elemento).
- `stage.js:878/897/898` — `getPage`, `getFit`, `isForceMuted` exportados sem
  chamador; `:1030` — `formatSpan` exposto com uso só interno.
- `bible.js:102-107/192` — `Bible.GROUPS` sem uso; `parseChapter`, `stripHtml`,
  `chapterFile`, `LOCALE` públicos com uso só interno.
- `display/index.html:5-6` — `theme-color` e `maximum-scale`/`user-scalable`
  numa Presentation de TV (herança de PWA instalável).

**CSS (grep cobrindo HTML + todos os .js):**
- `controle.css:1399` `.url-badge`, `:1404` `.yt-badge`, `:1446` `.cue-badge`
  (selos substituídos pela `.row-sub` na v5.118) — e com eles os tokens
  `--yt`/`--yt-soft` (`tokens.css:156-157`) ficaram transitivamente órfãos.
- `controle.css:2741-2744` `.fade-hint` + variantes (diagnóstico consolidado no
  `#diagBox` na v5.121).
- `controle.css:3121-3133` `.log-line`/`.log-text` — só `.log-copy` vive; o
  CLAUDE.md ainda manda usar `.log-line` (instrução aponta para classe morta).
- `controle.css:2745` — padding base de `.coll-opts` sempre sobrescrito.
- `display.css:394` — `[hidden]` redundante sem justificativa; `:367` —
  `object-fit` num `<div>` (sem efeito).
- `tokens.css:117-127` — inventário de consumidores **errado**: diz que
  `--danger-text`/`--danger` não têm uso (têm 3 e 1); só `--live-text` está
  órfão de fato. Como a paleta é o documento normativo de contraste, o
  inventário errado derruba a verificabilidade que ela reivindica.
- Comentários apontando para elementos extintos: `#standaloneSeg`
  (`controle.css:858`, `index.html:471`), rationale do `#collPopup`
  (`controle.css:2371-2395`).

---

## 5. Inconsistências e padronização

**Duplicações que os próprios comentários condenam:**
- `controle.js:9465-9477` — `renderSongMenu` reescreve linha a linha o seletor
  que `ytSegRow` (`8716-8728`) existe para unificar ("escrevê-lo duas vezes era
  garantir que a segunda divergisse").
- `controle.js:5680-5708` × `5251-5283` — `renderAcervoTotal` duplica o bloco
  `header()` de `renderCollectionsList` (contador, regra de sumiço, botão),
  compartilhando até o mesmo estado.
- `controle.js:7013-7021` × `7429-7437` — ramo OPFS de `deleteSelected` duplica
  `purgeCatalogRecords` (lista nova de detentores precisa entrar em 2 pontos).
- `controle.css:990-1004` × `1033-1041` — `.mode-switch` ≡ `.head-fav-btn`
  propriedade a propriedade — e **já divergiram**: só `.mode-switch` tem
  feedback `:active`, e os ícones saem 20px × 18px na mesma faixa.
- `MainActivity.kt:413-419` × `StagePresentation.kt:169-175` — `keepPlaying`
  duplicado (e `resumeTimers()` é global ao processo: chamar nos dois é
  redundante por definição); idem as 6 flags imersivas (`:956-962` × `:56-63`).
- Rampa de mudo do YouTube em 3 cópias (`stage.setMute`, `display.js:842-846`,
  preview em `controle.js:1245-1301`) — a curva é compartilhada, a coreografia
  não.
- `stage.js:262-267` — `visibleEl()` duplica o mapeamento kind→elemento de
  `elDe()` (o comentário de `elDe` reconhece; divergirão no primeiro kind novo).
- SVGs duplicados byte a byte no HTML (engrenagem em `493` e `590`; "texto
  corrido" em `510-515` e `702-707`) — sem `<use>`/sprite.

**Dois padrões para a mesma coisa:**
- `fmtDur` (`9140`) × `fmtTime` (`1714`); `fmtFracBytes` (`913`) ×
  `fmtParBytes` (`6116`) — miolo copiado.
- `ytLinhaVisivel` (`8672`) usa seletor-de-atributo que o comentário de `9536`
  proíbe; 3 outras funções usam o padrão loop+dataset.
- `loadFolderMediaItems` (`7083`) lê `folder_<id>` por `getState` cru; todo o
  resto usa a API de listas.
- Duas receitas para "erro sobre fundo suave" (`--danger-text` × `--danger-strong`)
  quando `tokens.css:121` declara o padrão.
- `Notification.Builder` cru no `SessionService` × `NotificationCompat` no
  `SyncService` (meio justificado pelo MediaStyle; o par ficou meio a meio).
- Duas convenções de TAG de log (`"AvIasd"` × nome da classe) — filtrar o app
  no logcat exige conhecer a lista de cor.

**Tokens que faltam (CSS):**
- ~30 corpos de fonte distintos com vizinhos a 0,01-0,02rem sem papel
  (`.84`×`.85`, `.72`×`.73`×`.74`…) — a folha tokenizou raios/alvos/ícones, não
  tipografia.
- 7 alfas de sombra preta diferentes sem token; durações de transição divergindo
  por 50 ms entre papéis idênticos (scrim .25s × .2s); `44px` literal repetindo
  `--hit-foot`; o par `56px` de `.mic-btn`/`.misc-project` que *precisa* medir
  igual mantido por coincidência.
- px × rem sem critério nos paddings de campos de texto.

**Miudezas:** shadowing de `opts` (`controle.js:5229`×`5242`) e de `avisar`
(`:211`); `selFolderEl` passa `MouseEvent` como `ids` (`12556` — funciona por
acidente); sorteio remapeia `'texto'`→`'text'` com ternário (`4478`);
`MessageBus.attach` podia ser `addIfAbsent`; `@SuppressLint` e KDoc de
`create()` anexados à declaração errada (`WebViewFactory.kt:75-103`); sugestão
de nome do pacote pode citar cue que não está nele (`11578-11587`).

---

## 6. Restrições herdadas / suposições envelhecidas

- **`adaptativoBloqueado` vale a sessão inteira por causa de UM vídeo**
  (`YoutubeGrab.kt:276-277/871`) — nasceu quando o 403 era sistêmico
  (pré-visionOS); hoje dois 403 de um vídeo específico desligam o 1080p de todos
  os downloads até reiniciar o app. Um bloqueio por vídeo, ou com expiração,
  seria coerente com a tese da v1.49. Correlato: 403 de **áudio** nunca alimenta
  a bandeira (`855-871`) — se todo áudio adaptativo levar 403, a sessão refaz as
  sondas condenadas a cada download.
- **Trocar de perfil de UA apaga o parcial** (`1420-1421`) — joga fora bytes que
  a retomada da mesma URL reaproveitaria; a v1.58 já confia que "mesma URL ⇒
  mesmos bytes".
- **`mozConnection`/`webkitConnection`** (`controle.js:934-936`) — prefixo
  Firefox num bundle que só roda em Chromium.
- **`statusBarColor`/`navigationBarColor`** (`themes.xml:13-14`) — ignorados com
  targetSdk 35 em Android 15+; funciona por coincidência (o body pinta o mesmo
  `#131211`); o comentário de `colors.xml` descreve um mecanismo que não é mais
  o que acontece.
- **Guardas de `__SHELL_VERSION__`: todas racionais.** Cada uma foi conferida
  contra a cronologia (15=openExternal, 16, 17, 18=ytSearch, 19, 21, 23, 24,
  25, 27 — deliberadamente acima do 26 quebrado —, 28, 29, 30, 31) e está com o
  número certo. Não há restrição de shell irracional: `minShell: 2` e as guardas
  por recurso são a política correta para uma frota com APKs de idades mistas.

---

## 7. Documentação desatualizada (o código é internamente coerente; o doc não)

- **CLAUDE.md pula o degrau shell 30** (resgate de downloads, v5.133): a
  cronologia salta de 29 para 31, mas `controle.js:10324` guarda `>= 30` e o
  código do resgate existe. Quem datar guardas pela lista erra.
- **"Sete coisas no `__AVBridge`" são oito** — falta `takeShare`
  (`native.js:253`).
- **Ordem de scripts sem o `mse.js`** (real: native → db → **mse** → stage →
  louvorja → bible → controle, `index.html:856-865`). Consequência real: nenhuma
  das quatro peças do watchdog `otaAppIsUp` depende de `AVStream` — um bundle
  com `mse.js` quebrado é carimbado como bom (degradação suave: a transmissão
  cai no download).
- **"Cinco testes em Chromium" são seis** (a própria lista do doc tem seis).
- **Contagens defasadas**: 7.101 linhas de Kotlin (não 5.959) e 17.807 de JS
  (não 16.648) — o doc manda medir antes de citar, e está certo em mandar.
- **CLAUDE.md manda usar `.log-line`/`.log-copy`** — `.log-line`/`.log-text`
  estão mortas; o markup atual é `.log-head` + `.diag-box`.
- Comentários internos defasados: `db.js:746` ("gc sem chamador" — tem);
  `db.js:781` ("2 Hz" — só vale para YouTube); `controle.js:726-730` (recontagem
  "do catálogo" — é `opfsFolderSize` desde a v5.134); `controle.js:5676` (chave
  `grp:Todo o acervo` — real é `grp:Toda a biblioteca`); `controle.js:13011`
  (metade "service worker" de um comentário sobre código que saiu na v5.48);
  `YoutubeGrab.kt:365-370` (KDoc do regex extinto); `tokens.css:79-83`
  (`--accent-glow` descrito pelo halo removido na v5.75); KDoc de `CANCELADO`
  (promete um diagnóstico que `motivo()` não entrega — item 2.5).

---

## 8. O que foi verificado e está CORRETO (para não re-auditar)

- **As 8 invariantes do shell**: origin por `url.host == ORIGIN_HOST`;
  `allowFileAccess`/`allowContentAccess` desligados; handler `/saf/` só no
  Controle; `onRenderProcessGone` recria; `keepVisible` só no telão; streams do
  byte 0 com status 200; `MicChromeClient` compara origem inteira e falha
  fechado.
- **Os três lugares de versão batem** (5.138 × 3) e `colors.xml` espelha
  `--bg: #131211` corretamente (inclusive os `theme-color` dos dois HTML).
- **Protocolo de comandos fechado**: 17 comandos do Controle todos tratados;
  5 do Display todos tratados; snoop nativo só no `display-status`, como
  documentado. Campos emissor↔receptor conferidos par a par, sem divergência.
- **A superfície da ponte**: 30 métodos, todos com chamador; todos os
  `@JavascriptInterface` com chamador; 10 callbacks globais com emissor e
  receptor; zero uso de `__AVBridge` fora do `native.js`; campos do
  `bgProgress`/`nowPlaying`/`display-status` batem nos dois lados (hoje).
- **OTA**: contrato workflow↔`WebUpdater` fechado (nomes, campos, prefixo
  `web/`); `REPO` bate com o remote real; watchdog `pending` por nome;
  zip-slip coberto; nenhum caminho apaga diretório em uso.
- **Dedup `__mid`**: sem vazamento (janela de 400 com poda correta) e sem
  colisão prática. Caminho do microfone (rampas, `micSeq`, suspensão) correto.
- **`node --check`** passa em todos os .js do bundle; `sidx.test.mjs` e
  `webview-range.test.mjs` passam localmente; nenhum teste ficou tautológico
  (todos carregam os arquivos reais — com a ressalva de que o
  `webview-range.test.mjs` valida um **modelo** do pipeline, não o
  `StreamProxy.kt`, o que é deliberado e documentado).
- **Sem vazamento de descriptor/socket** nos caminhos de exceção do pipeline de
  mídia; aritmética de retomada (206/200) correta; pares itag/contêiner
  consistentes; escape de conteúdo do usuário uniforme (`textContent`); zero
  branco literal fora do palco; escala de raios respeitada; z-index coerente;
  IDs do HTML sem duplicata; nenhum handler órfão.

---

## 9. Sugestão de priorização

1. **Religar o feedback**: trocar os `flash()` novos por `avisar()` (1.1) — é o
   maior ganho por linha alterada; puro OTA.
2. **As duas corridas de reprodução**: `ended`×`load` (1.2) e o seek do MSE
   (2.1) — ambas em arquivos compartilhados, puro OTA, com teste possível.
3. **Endurecer o shell** (exige APK): guarda de `host` em
   `nowPlaying`/`bgProgress` (2.4), 206 no `StreamProxy` (2.2), flag de falha no
   `MuxMp4` (2.3), pickers pendentes (2.10), `onConsoleMessage` no telão (2.11).
4. **CI**: excluir `vendor/` do `node --check` e travar os três lugares de
   versão (2.13/2.14) — três linhas cada.
5. **Higiene em lote**: código morto da seção 4 e duplicações da seção 5 podem
   sair num commit mecânico de limpeza; a documentação da seção 7 num commit de
   doc.
