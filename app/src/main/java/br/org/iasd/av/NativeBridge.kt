package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Serviços que só a Activity pode prestar (SAF, telas, volume, mic, share).
 * O Display não tem host — seu WebView só usa o barramento de mensagens.
 */
interface BridgeHost {
    /** Abre o seletor de pasta do sistema (ACTION_OPEN_DOCUMENT_TREE). */
    fun requestFolderPick(onResult: (Uri?) -> Unit)

    /**
     * Abre o seletor de ARQUIVOS do sistema e devolve os `content://`
     * escolhidos (lista vazia se o operador desistir). Ver o porquê de não ser
     * o `<input type="file">` em `MainActivity.docPicker`.
     */
    fun requestDocPick(mimes: Array<String>, onResult: (List<Uri>) -> Unit)

    /**
     * Declara ao sistema que há download em andamento, para o processo não
     * ser congelado com o app minimizado (ver [SyncService]).
     */
    fun setBackgroundWork(on: Boolean)

    /** Telas de apresentação conectadas agora. */
    fun listDisplays(): JSONArray

    /** Abre o seletor de espelhamento de tela do Android. */
    fun openCastPicker()

    /** Rótulo do alvo de espelhamento disponível neste aparelho. */
    fun describeCastTarget(): String

    /**
     * Abre uma URL `https` FORA do app (navegador, ou o app que a reivindicar).
     * O WebView do Controle recusa navegar para outro origin — ver
     * [WebViewFactory] —, então sem esta rota um link externo não faz nada.
     */
    fun openExternalUrl(url: String)

    /**
     * A *mesa de som* está ligada: o áudio sai pelo CELULAR, do WebView do
     * Controle — que portanto não pode ser suspenso quando o app é minimizado.
     */
    fun setAudioAlive(on: Boolean)

    /** Interceptar os botões físicos de volume e mandá-los para o app. */
    fun setCaptureVolumeKeys(on: Boolean)

    /** Devolver um passo de volume ao SISTEMA (fader já no limite). */
    fun adjustSystemVolume(step: Int)

    /** Pede a permissão de microfone ao Android (push-to-talk). */
    fun requestMicPermission(onResult: (Boolean) -> Unit)

    /** Consome (uma única vez) um compartilhamento recebido por intent. */
    fun takePendingShare(): JSONObject?
}

/**
 * `window.__AVBridge` — a superfície nativa vista pelo JavaScript.
 *
 * O lado web nunca fala com esta classe diretamente: `shared/native.js`
 * embrulha tudo em Promises e publica a API pública `window.AVNative`
 * documentada no contrato. Aqui só existe o transporte.
 *
 * ATENÇÃO: todo método `@JavascriptInterface` é chamado numa thread própria
 * do WebView — nada aqui pode tocar a UI sem `post`/`runOnUiThread`.
 */
class NativeBridge(
    private val ctx: Context,
    private val role: String,
    private val host: BridgeHost?,
    private val webRef: () -> WebView?,
) {

    companion object {
        /**
         * Versão do shell nativo. Um bundle web declara em `minShell` a
         * versão mínima de que precisa, e o OTA recusa atualizações que
         * exijam mais do que o shell instalado oferece (ver [WebUpdater]).
         * Subir SEMPRE que a superfície da ponte mudar.
         */
        const val SHELL_VERSION = 28

        /**
         * Fila de IO da ponte, **compartilhada por todas as instâncias**.
         *
         * Um executor por instância vazava: `newSingleThreadExecutor` cria uma
         * thread de core sem timeout e não-daemon, viva até um `shutdown` que
         * nunca acontecia — e a ponte é reconstruída a cada morte de renderer e
         * a cada ciclo de desconexão/reconexão do dongle, cada uma retendo a
         * `NativeBridge` inteira (e, por ela, a Activity/Presentation antigas).
         * Nada nesta fila é por-WebView: é IO genérico. Daemon para nunca
         * segurar o encerramento do processo.
         */
        private val io = Executors.newSingleThreadExecutor { r ->
            Thread(r, "av-bridge-io").apply { isDaemon = true }
        }
    }

    // ---------- identidade ----------

    @JavascriptInterface
    fun shellVersion(): Int = SHELL_VERSION

    /** `"controle"` ou `"display"` — o web usa para saber qual papel executa. */
    @JavascriptInterface
    fun role(): String = role

    /**
     * `versionName` do APK instalado — o índice de versão do SHELL mostrado na
     * UI. É diferente de [SHELL_VERSION] (contrato interno da ponte, usado pela
     * válvula `minShell` do OTA): este é legível pelo operador e muda a cada
     * Release. Shell e base web atualizam por caminhos independentes (instalar
     * APK × OTA), então precisam ser legíveis à parte.
     */
    @JavascriptInterface
    fun appVersion(): String = try {
        ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: ""
    } catch (e: Exception) {
        ""
    }

    /**
     * A base web carregou por inteiro — desarma o watchdog de boot do OTA.
     * Sem esta confirmação, um bundle baixado que quebre é descartado no
     * lançamento seguinte e o app volta ao embutido no APK.
     *
     * **Só o Controle confirma.** O papel já chega aqui pelo construtor, e
     * aceitar a confirmação do telão furava o watchdog por um caminho
     * independente: o Display carrega uma fração do código (não tem playlist,
     * transporte, Bíblia, Cronograma), então um bundle que quebre SÓ o
     * `controle.js` — de longe o arquivo mais provável de quebrar — era
     * confirmado pela página do Display, que carregou bem, e adotado para
     * sempre. Confirmar por ele não prova nada sobre o Controle.
     */
    @JavascriptInterface
    fun otaConfirm() {
        if (role != "controle") return
        WebUpdater.confirmBoot(ctx)
    }

    // ---------- barramento de comandos ----------

    @JavascriptInterface
    fun busPost(json: String) {
        MessageBus.post(webRef(), json)
        snoopDisplayStatus(json)
    }

    /**
     * Lê de passagem o `display-status` que o telão emite a 2 Hz e mantém a
     * sessão de mídia em dia com ele.
     *
     * Existe porque a notificação NÃO pode depender do JS do Controle estar
     * rodando. Com o app minimizado e sem áudio audível no celular (modo "mesa
     * de som" desligado), o sistema estrangula/suspende aquele WebView — e
     * então `pushNowPlaying` para de ser chamado: a notificação congela no
     * último estado, com o botão em "play" e a barra parada, enquanto o telão
     * segue projetando normalmente. Ligar a mesa de som fazia o defeito sumir
     * justamente porque áudio audível isenta a página do estrangulamento.
     *
     * O status do telão, esse, já passa por aqui de qualquer jeito (o WebView
     * do Display o envia por `busPost`), e a `Presentation` não é
     * estrangulada — é uma fonte que continua viva quando a outra não está.
     *
     * NÃO é decisão de transporte (invariante 5): só copia dois campos que o
     * lado web já calculou. Título, subtítulo e modo de slide continuam vindo
     * de `nowPlaying`; sem cena publicada, nada é inventado aqui.
     */
    private fun snoopDisplayStatus(json: String) {
        if (!json.contains("display-status")) return   // barato antes de parsear
        val o = try { JSONObject(json) } catch (e: Exception) { return }
        if (o.optString("type") != "display-status") return
        SessionService.updateFromDisplay(
            ctx,
            playing = o.optBoolean("playing"),
            positionMs = (o.optDouble("currentTime", 0.0) * 1000).toLong(),
            durationMs = (o.optDouble("duration", 0.0) * 1000).toLong(),
        )
    }

    // ---------- sessão de culto ----------

    /**
     * Ligado enquanto houver QUALQUER download em curso (hinos, álbuns,
     * Bíblia, pastas). O lado web conta as tarefas ativas e só desliga na
     * última — ver `bgWorkBegin`/`bgWorkEnd` em `controle.js`.
     */
    @JavascriptInterface
    fun keepAlive(on: Boolean) {
        host?.setBackgroundWork(on)
    }

    /**
     * Progresso do download em curso, para a notificação do serviço em
     * primeiro plano. Com o app minimizado — o uso normal durante uma
     * sincronização — essa notificação é a única janela para o que está
     * acontecendo, e antes ela era um texto fixo.
     *
     * O JSON vem do lado web (`AVNative.bgProgress`), que é quem sabe o que
     * está baixando e a que ritmo:
     * `{ label, done, total, etaMs, items, idleMs }`.
     *
     * `items` traz UM nome em destaque. São 6 downloads simultâneos, mas o lado
     * web manda um de cada vez, tirado de uma FILA (FIFO) dos itens que já
     * entraram em download: cada nome sai uma ÚNICA vez, em ordem, escoado no
     * ritmo médio medido por item (`bgItemStart`/`bgSpinMs` em controle.js).
     * Não é rodízio entre os itens em voo — rodízio traria o mesmo nome de
     * volta várias vezes e a lista não iria a lugar nenhum. Também não é um
     * espelho do que está no ar agora: é deliberadamente ilustrativo, e
     * CONGELA quando a tarefa passa de 90 s sem evento real. A lista continua
     * sendo lista só por compatibilidade com bundles anteriores a v5.13.
     *
     * `idleMs` é há quanto tempo NADA acontece: é o que separa "travado" de
     * "esta faixa é grande", que na tela são a mesma coisa parada.
     */
    @JavascriptInterface
    fun bgProgress(json: String) {
        val o = try { JSONObject(json) } catch (e: Exception) { return }
        val arr = o.optJSONArray("items")
        val itens = buildList {
            for (i in 0 until (arr?.length() ?: 0)) {
                arr?.optString(i)?.takeIf { it.isNotBlank() }?.let { add(it) }
            }
        }
        SyncService.updateProgress(
            ctx,
            label = o.optString("label"),
            done = o.optLong("done"),
            total = o.optLong("total"),
            etaMs = o.optLong("etaMs"),
            items = itens,
            idleMs = o.optLong("idleMs"),
            // `bytes` (v5.118): quando ligado, `done`/`total` são BYTES e não
            // itens — é o que dá barra e estimativa a um download único, que é
            // justamente o caso em que a notificação é a única janela. Ver
            // `SyncService.formatBytes` e `bgTaskStart` no lado web.
            //
            // `Long` desde agora, e não `Int`: um vídeo de 1080p passa
            // folgadamente dos 2 GB que o `Int` comporta, e o estouro sairia
            // como uma barra andando para trás.
            bytes = o.optBoolean("bytes"),
        )
    }

    /**
     * O que está no ar, para a notificação de controles e a sessão de mídia
     * (ver [SessionService]). Vem do lado web porque é lá que o estado mora —
     * o mesmo princípio de [bgProgress].
     *
     * `active:false` significa "nada em cena": derruba o serviço, e a
     * notificação some junto. É o lado web que decide isso, não um palpite
     * daqui sobre o que seria "tocando".
     */
    @JavascriptInterface
    fun nowPlaying(json: String) {
        val o = try { JSONObject(json) } catch (e: Exception) { return }
        if (!o.optBoolean("active")) {
            SessionService.stop(ctx)
            return
        }
        SessionService.update(
            ctx,
            SessionService.Companion.Scene(
                title = o.optString("title").ifBlank { "Em exibição" },
                subtitle = o.optString("subtitle"),
                playing = o.optBoolean("playing"),
                slideMode = o.optBoolean("slideMode"),
                slideLabel = o.optString("slideLabel"),
                wallpaper = o.optBoolean("wallpaper"),
                positionMs = o.optLong("positionMs"),
                durationMs = o.optLong("durationMs"),
            ),
        )
    }

    // ---------- telas ----------

    @JavascriptInterface
    fun displays(callId: String) {
        val list = host?.listDisplays() ?: JSONArray()
        resolve(callId, list.toString())
    }

    /**
     * Botão de cast da preview: abre o seletor de **espelhamento de tela**
     * (Smart View / Wireless display), não o Google Cast — ver
     * [BridgeHost.openCastPicker], que explica por que os dois não são a mesma
     * coisa e como o alvo é escolhido.
     */
    @JavascriptInterface
    fun openCast() {
        host?.openCastPicker()
    }

    /**
     * Abre uma URL fora do app — hoje a busca do YouTube oferecida no fim da
     * busca do acervo, quando a música não está no LouvorJA.
     *
     * **Só `https`, e a decisão é aqui.** Este método é chamado de JavaScript,
     * e um `ACTION_VIEW` aceita muito mais do que web: `intent://`,
     * `content://`, esquemas de outros apps. Deixar o esquema livre
     * transformaria a ponte num disparador genérico de intents a partir de
     * qualquer script que rodasse no WebView. O `native.js` também filtra, mas
     * ali é conveniência — a guarda que vale é esta, porque `__AVBridge` é
     * alcançável sem passar por ele.
     *
     * O WebView do telão recebe a ponte com `host = null` e não chega aqui.
     */
    @JavascriptInterface
    fun openExternal(url: String) {
        val u = try { Uri.parse(url) } catch (_: Exception) { return }
        if (!u.scheme.equals("https", ignoreCase = true) || u.host.isNullOrBlank()) return
        host?.openExternalUrl(u.toString())
    }

    // ---------- vídeo do YouTube como ARQUIVO ----------

    /**
     * Baixa um vídeo do YouTube no aparelho e devolve
     * `{ url, name, size, type }` — com `url` servível pelo mesmo `/saf/` das
     * pastas do dispositivo. O lado web faz `fetch` + `Blob` sem saber de onde
     * veio; ver [YoutubeGrab] para o porquê de a extração ser NATIVA.
     *
     * Roda na fila de IO: é rede e parsing, e um vídeo leva minutos. O
     * andamento vai por `window.__avYtProgress(id, lidos, total)` — sem isso o
     * operador ficaria olhando um cartão parado durante todo o download.
     */
    @JavascriptInterface
    fun ytFetch(callId: String, url: String) = ytFetchInterno(callId, url, false)

    /**
     * PARA o download deste link, se ele for o que está em curso.
     *
     * **NÃO vai para a fila de IO** — e não poderia: a fila é de uma thread só e
     * está ocupada justamente pelo download que se quer parar. Enfileirar o
     * cancelamento o faria rodar depois de o download terminar, que é o oposto
     * de cancelar. Escrever um campo `@Volatile` da thread do WebView é seguro e
     * imediato; quem responde é o laço de cópia, que o consulta a cada bloco.
     *
     * Sem `callId`: não há o que devolver. O resultado chega pelo caminho de
     * sempre — a Promise do `ytFetch` resolve `null`, como em qualquer falha —,
     * e quem sabe que a causa foi um cancelamento é o lado web, que o pediu.
     *
     * Só o Controle (`host != null`): o telão não baixa nada, logo não tem o que
     * cancelar.
     */
    @JavascriptInterface
    fun ytCancel(url: String) {
        if (host == null) return
        YoutubeGrab.cancelar(url)
    }

    /**
     * O mesmo, mas baixando **só a faixa de áudio** (m4a) — o louvor de fundo,
     * o instrumental da oração, o que não tem por que ocupar o telão.
     *
     * MÉTODO SEPARADO, e não um parâmetro a mais no [ytFetch]: a ponte casa o
     * método pelo NOME e pela quantidade de argumentos, então mudar a assinatura
     * do `ytFetch` quebraria o download inteiro num shell antigo que recebesse o
     * bundle novo por OTA — e "sem YouTube nenhum" é muito pior que "sem a opção
     * de áudio". Assim o shell antigo continua baixando vídeo, e o lado web só
     * oferece a escolha quando `__SHELL_VERSION__` já a tem (ver `openYtMenu`).
     */
    @JavascriptInterface
    fun ytFetchAudio(callId: String, url: String) = ytFetchInterno(callId, url, true)

    /**
     * Vídeo com **teto de resolução escolhido pelo operador** (1080p · 720p ·
     * 480p, na folha de download).
     *
     * TERCEIRO MÉTODO, pelo mesmo motivo que existe o [ytFetchAudio]: a ponte
     * casa o método por nome **e aridade**, então acrescentar o parâmetro ao
     * [ytFetch] deixaria todo download quebrado num shell antigo que recebesse o
     * bundle novo por OTA. Aqui a degradação é a certa — sem este método o lado
     * web nem desenha o seletor e continua chamando o [ytFetch] de sempre, que
     * baixa no padrão de [YoutubeGrab.TETO_ALTURA].
     *
     * E é por isso que o lado web só usa este caminho quando o operador escolhe
     * um teto MENOR que o padrão: pedir 1080p pelo `ytFetch` comum funciona em
     * qualquer shell, então não há razão para exigir um APK novo de quem quer o
     * comportamento de sempre.
     */
    @JavascriptInterface
    fun ytFetchAte(callId: String, url: String, altura: Int) =
        ytFetchInterno(callId, url, false, altura)

    private fun ytFetchInterno(
        callId: String,
        url: String,
        somenteAudio: Boolean,
        teto: Int = YoutubeGrab.TETO_ALTURA,
    ) {
        if (host == null) { resolve(callId, "null"); return }   // telão não baixa nada
        io.execute {
            val r = try {
                // O teto é SANEADO aqui, não lá dentro: este parâmetro vem de
                // JavaScript, e um 0 (ou um negativo) esvaziaria a fila de
                // candidatos e derrubaria o download inteiro num caminho que
                // pareceria "vídeo indisponível".
                val alvo = teto.coerceIn(144, YoutubeGrab.TETO_ALTURA)
                YoutubeGrab.buscar(ctx, url, somenteAudio, alvo) { lidos, total ->
                    ytProgresso(callId, lidos, total)
                }
            } catch (_: Exception) { null }
            resolve(callId, r?.toString() ?: "null")
        }
    }

    /**
     * O MANIFESTO da transmissão direta de um vídeo do YouTube: as duas faixas
     * adaptativas e seus byte-ranges, com URLs servíveis pelo próprio origin do
     * app (ver [StreamProxy]).
     *
     * Devolve `null` quando não há par adaptativo transmissível — e aí o lado
     * web cai no que já existia (baixar, ou o player embutido). É esse `null`
     * que torna o recurso inteiro opcional: nenhum caminho que funciona hoje
     * depende dele.
     *
     * **Privilégio do Controle**, como toda a superfície com `host`. O telão
     * não monta manifesto: ele recebe o já montado pelo registro da mídia, do
     * mesmo IndexedDB compartilhado, e só CONSOME os `/stream/` — que é o que
     * ele precisa para projetar.
     */
    @JavascriptInterface
    fun ytStream(callId: String, url: String, altura: Int) {
        if (host == null) { resolve(callId, "null"); return }
        io.execute {
            val r = try {
                YoutubeGrab.manifesto(url, altura.coerceIn(144, YoutubeGrab.TETO_ALTURA))
            } catch (_: Exception) { null }
            resolve(callId, r?.toString() ?: "null")
        }
    }

    /**
     * Busca no YouTube, de dentro do app — devolve uma lista de
     * `{ id, url, name, author, seconds, thumb }`. Ver [YoutubeGrab.pesquisar]
     * para por que isto não pode ser um iframe nem a API oficial.
     */
    @JavascriptInterface
    fun ytSearch(callId: String, termo: String) {
        if (host == null) { resolve(callId, "[]"); return }
        io.execute {
            val r = try { YoutubeGrab.pesquisar(termo) } catch (_: Exception) { JSONArray() }
            resolve(callId, r.toString())
        }
    }

    /**
     * O QUE O EXTRATOR DEVOLVEU na última extração, em uma linha — para o
     * rodapé de Configurações. Diagnóstico, não recurso.
     *
     * A pergunta que ele responde não se responde lendo código: sem PO Token a
     * biblioteca busca os streams por um endpoint que devolve um conjunto
     * reduzido de formatos, e o que cabe nesse conjunto varia por vídeo. Saber
     * se as faixas ADAPTATIVAS (1080p e o áudio puro moram nelas) chegam a este
     * aparelho é o que decide se vale implementar o remux — e só o aparelho
     * responde.
     *
     * String vazia antes da primeira extração.
     */
    @JavascriptInterface
    fun ytDiag(callId: String) {
        // `JSONObject.quote` e não uma concatenação com aspas: o texto é montado
        // a partir do que o YouTube devolveu, e é ele que vai INLINE dentro de
        // um `evaluateJavascript` (ver `resolve`).
        // OS DOIS CAMINHOS, em linhas separadas. A transmissão direta e o
        // download escrevem em campos diferentes de propósito (ver
        // `diagnosticoStream`): quando a primeira desiste, o segundo roda em
        // seguida, e com um campo só o motivo da desistência era apagado pela
        // linha do download — o log dizia o que aconteceu depois, nunca por quê.
        //
        // Multi-linha não incomoda ninguém: do lado web isto vai para dentro de
        // um `<pre>` que rola (o "Registro" de Configurações).
        val texto = if (host == null) "" else buildString {
            YoutubeGrab.diagnosticoStream.takeIf { it.isNotEmpty() }?.let {
                append("transmissão: ").append(it)
            }
            YoutubeGrab.diagnostico.takeIf { it.isNotEmpty() }?.let {
                if (isNotEmpty()) append('\n')
                append("download: ").append(it)
            }
        }
        resolve(callId, JSONObject.quote(texto))
    }

    /**
     * Apaga o arquivo intermediário depois que o lado web copiou os bytes para
     * a biblioteca. Sem isto o vídeo ficaria duas vezes no aparelho.
     */
    @JavascriptInterface
    fun ytDiscard(url: String) {
        if (host == null) return
        io.execute { YoutubeGrab.descartar(ctx, url) }
    }

    // ---------- apresentação (PDF / Google Apresentações) como IMAGENS ----------

    /**
     * Rasteriza uma apresentação e devolve `{ name, pages: [url] }` — uma
     * imagem por página, servível pelo mesmo `/saf/` das pastas do dispositivo.
     * Ver [SlideDeck] para por que o caminho é o PDF e por que ele é nativo.
     *
     * `origem` é o `/saf/<token>` de um PDF que chegou ao app, ou a URL de
     * exportação de uma apresentação do Google (que o próprio Kotlin baixa: o
     * `fetch` do WebView esbarraria no CORS do Google).
     *
     * Roda na fila de IO — é disco, rede e rasterização —, e o andamento vai
     * por `window.__avDeckProgress(id, feitas, total)`: uma apresentação de
     * dezenas de páginas leva segundos, e um cartão parado não diz se está
     * andando.
     */
    @JavascriptInterface
    fun deckPages(callId: String, origem: String, nome: String) {
        if (host == null) { resolve(callId, "null"); return }   // telão não importa nada
        io.execute {
            // O motivo da falha viaja junto (`{ erro }`) — ver SlideDeck.paginas.
            val r = try {
                SlideDeck.paginas(ctx, origem, nome) { feitas, total ->
                    deckProgresso(callId, feitas, total)
                }
            } catch (e: Exception) {
                JSONObject().put("erro", "ponte: " + e.javaClass.simpleName)
            }
            resolve(callId, r.toString())
        }
    }

    /**
     * A URL de exportação em PDF de uma apresentação do Google, ou `""` se o
     * link não for uma. Quem decide é o Kotlin porque é ele que sabe o que
     * consegue abrir — o lado web só pergunta.
     */
    @JavascriptInterface
    fun deckExportUrl(link: String): String = SlideDeck.urlDeExportacao(link) ?: ""

    /**
     * Apaga as páginas intermediárias depois que o lado web as copiou para a
     * biblioteca. Mesmo motivo do [ytDiscard]: sem isto a apresentação ficaria
     * duas vezes no aparelho.
     */
    @JavascriptInterface
    fun deckDiscard(url: String) {
        if (host == null) return
        io.execute { SlideDeck.descartar(ctx, url) }
    }

    private fun deckProgresso(callId: String, feitas: Int, total: Int) {
        val web = webRef() ?: return
        val id = JSONObject.quote(callId)
        web.post {
            web.evaluateJavascript(
                "window.__avDeckProgress && window.__avDeckProgress($id, $feitas, $total);",
                null,
            )
        }
    }

    private fun ytProgresso(callId: String, lidos: Long, total: Long) {
        val web = webRef() ?: return
        val id = JSONObject.quote(callId)
        web.post {
            web.evaluateJavascript(
                "window.__avYtProgress && window.__avYtProgress($id, $lidos, $total);",
                null,
            )
        }
    }

    /**
     * Para onde `openCast()` vai abrir, em texto. O popup de Exibição mostra
     * isso: os alvos de espelhamento variam por fabricante e não são API
     * documentada, então o operador precisa poder ver o que o aparelho tem.
     */
    @JavascriptInterface
    fun castTarget(callId: String) {
        resolve(callId, JSONObject().put("label", host?.describeCastTarget() ?: "").toString())
    }

    /**
     * Mesa de som ligada/desligada. Com ela ligada o celular É a caixa de som, e
     * minimizar o app não pode calar o louvor — ver [BridgeHost.setAudioAlive].
     * Desligada, o WebView do Controle volta a ser estrangulado em segundo
     * plano, que é o certo quando ele é só a mesa de comando.
     */
    @JavascriptInterface
    fun keepAudioAlive(on: Boolean) {
        host?.setAudioAlive(on)
    }

    // ---------- botões físicos de volume ----------

    /**
     * Pede que a Activity intercepte os botões de volume e os entregue ao
     * Controle (`window.__avVolumeKey`). Ligado pelo lado web só depois de
     * carregar — ver [BridgeHost.setCaptureVolumeKeys].
     */
    @JavascriptInterface
    fun captureVolumeKeys(on: Boolean) {
        host?.setCaptureVolumeKeys(on)
    }

    /**
     * Válvula de escape: com o fader do app já no máximo (ou no zero), a
     * tecla volta a valer para o volume do sistema. Sem isto, um aparelho com
     * o volume de mídia baixo ficaria sem como subir com o app aberto.
     */
    @JavascriptInterface
    fun systemVolume(step: Int) {
        host?.adjustSystemVolume(step)
    }

    // ---------- microfone (push-to-talk) ----------

    /**
     * Garante a permissão `RECORD_AUDIO` do Android antes de o lado web
     * chamar `getUserMedia`. Sem ela, o [MicChromeClient] nega o pedido do
     * WebView de propósito — conceder ao WebView uma permissão que o processo
     * não tem só adiaria a falha para um ponto sem sinal claro.
     */
    @JavascriptInterface
    fun requestMic(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "false"); return }
        h.requestMicPermission { granted -> resolve(callId, if (granted) "true" else "false") }
    }

    // ---------- compartilhamento (substitui o share_target do SW) ----------

    @JavascriptInterface
    fun takeShare(callId: String) {
        val share = host?.takePendingShare()
        resolve(callId, share?.toString() ?: "null")
    }

    // ---------- pastas do dispositivo (SAF) ----------

    /**
     * Substitui `showDirectoryPicker()`, que **não existe no Android**. É o
     * que faz a sincronização de pastas funcionar no celular pela primeira
     * vez — no PWA esse recurso é letra morta em qualquer telefone.
     */
    @JavascriptInterface
    fun pickFolder(callId: String) {
        val h = host
        if (h == null) {
            resolve(callId, "null")
            return
        }
        h.requestFolderPick { uri ->
            if (uri == null) {
                resolve(callId, "null")
            } else {
                val obj = JSONObject()
                    .put("id", uri.toString())
                    .put("uri", uri.toString())
                    .put("name", folderName(uri))
                resolve(callId, obj.toString())
            }
        }
    }

    /**
     * Abre o seletor de ARQUIVOS do sistema (um ou vários) e devolve
     * `[{ url, name, type }]` — com `url` servível pelo mesmo `/saf/` das
     * pastas do dispositivo. É a importação INTEIRA do app no aparelho:
     * imagem, vídeo, áudio, PDF e PPTX pela mesma porta.
     *
     * Por que não o `<input type="file">` da página: ele entrega ao JavaScript
     * um `File` — bytes já lidos —, e o PDF precisa ser aberto pelo Kotlin
     * ([SlideDeck]), que só sabe abrir um ARQUIVO. Devolver os bytes pela ponte
     * inverteria o princípio dela e faria um vídeo de 2 GB passar pela memória
     * do WebView. Com o seletor do sistema, todo import chega como URL
     * servível — inclusive o que já chegava assim pelo compartilhamento.
     *
     * SEM PRAZO no lado web: quem responde aqui é uma PESSOA escolhendo um
     * arquivo, e um timeout resolveria null com o seletor ainda aberto — a
     * mesma regra do [pickFolder] e do [requestMic].
     */
    @JavascriptInterface
    fun pickDoc(callId: String, mimesCsv: String) {
        val h = host
        if (h == null) { resolve(callId, "[]"); return }
        val mimes = mimesCsv.split(',').map { it.trim() }.filter { it.isNotBlank() }
        h.requestDocPick(if (mimes.isEmpty()) arrayOf("*/*") else mimes.toTypedArray()) { uris ->
            val arr = JSONArray()
            for (uri in uris) {
                arr.put(
                    JSONObject()
                        .put("url", SafRegistry.urlFor(uri))
                        .put("name", nomeDoDocumento(uri))
                        .put("type", ctx.contentResolver.getType(uri) ?: "application/octet-stream"),
                )
            }
            resolve(callId, arr.toString())
        }
    }

    /** O nome de exibição do documento, ou "Apresentação" se o provedor não o der. */
    private fun nomeDoDocumento(uri: Uri): String {
        val nome = try {
            ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c ->
                    val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (i >= 0 && c.moveToFirst()) c.getString(i) else null
                }
        } catch (_: Exception) { null }
        return (nome ?: uri.lastPathSegment ?: "Apresentação").substringAfterLast('/')
    }

    /**
     * Lista os arquivos do primeiro nível da pasta — mesma profundidade do
     * `handle.entries()` usado no navegador (sem recursão), para o
     * comportamento ser idêntico nos dois contextos.
     *
     * Cada item traz uma `url` servível (`/saf/<token>`), nunca bytes.
     *
     * **Só com host** (ou seja, só no Controle). O WebView do telão recebe a
     * ponte com `host = null` justamente para não ter poderes de Activity, e
     * `pickFolder`/`requestMic` já honravam isso; esta era a exceção, porque lê
     * o `ContentResolver` direto. Sem a guarda, qualquer script rodando no
     * documento do Display (que carrega a IFrame Player API de terceiro por
     * design) lia o índice inteiro — nome, tamanho e token servível — de toda
     * pasta que o operador já concedeu, num WebView que por construção deveria
     * ter zero superfície nativa. Devolve lista vazia: o telão nunca chama
     * isto, e um erro seria pior de diagnosticar que um vazio.
     */
    @JavascriptInterface
    fun listFolder(callId: String, treeUri: String) {
        if (host == null) {
            resolve(callId, "[]")
            return
        }
        io.execute {
            val out = try {
                listChildren(Uri.parse(treeUri))
            } catch (_: Exception) {
                JSONArray()
            }
            resolve(callId, out.toString())
        }
    }

    private fun listChildren(treeUri: Uri): JSONArray {
        val out = JSONArray()
        val docId = if (DocumentsContract.isDocumentUri(ctx, treeUri)) {
            DocumentsContract.getDocumentId(treeUri)
        } else {
            DocumentsContract.getTreeDocumentId(treeUri)
        }
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId)
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        )
        ctx.contentResolver.query(children, projection, null, null, null)?.use { c ->
            val iId = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val iName = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            val iMime = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
            val iSize = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_SIZE)
            val iTime = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
            while (c.moveToNext()) {
                val mime = c.getString(iMime) ?: ""
                if (mime == DocumentsContract.Document.MIME_TYPE_DIR) continue
                val id = c.getString(iId) ?: continue
                val name = c.getString(iName) ?: continue
                val uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, id)
                out.put(
                    JSONObject()
                        .put("name", name)
                        .put("type", mime)
                        .put("size", if (c.isNull(iSize)) 0L else c.getLong(iSize))
                        .put("mtime", if (c.isNull(iTime)) 0L else c.getLong(iTime))
                        .put("url", SafRegistry.urlFor(uri)),
                )
            }
        }
        return out
    }

    /** Último segmento legível do tree URI, como nome sugerido da pasta. */
    private fun folderName(treeUri: Uri): String {
        val raw = try {
            DocumentsContract.getTreeDocumentId(treeUri)
        } catch (_: Exception) {
            treeUri.lastPathSegment ?: "Pasta"
        }
        val tail = raw.substringAfterLast(':').substringAfterLast('/')
        return if (tail.isBlank()) "Pasta" else tail
    }

    // ---------- resolução das Promises do lado web ----------

    /**
     * [jsonValue] é injetado como expressão JavaScript (já é JSON válido —
     * `JSONObject`/`JSONArray`/`null`), então o lado web recebe o valor
     * pronto, sem `JSON.parse` de string dupla.
     */
    private fun resolve(callId: String, jsonValue: String) {
        val web = webRef() ?: return
        val id = JSONObject.quote(callId)
        web.post {
            web.evaluateJavascript(
                "window.__avResolve && window.__avResolve($id, $jsonValue);",
                null,
            )
        }
    }
}
