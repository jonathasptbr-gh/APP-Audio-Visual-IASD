package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
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
        const val SHELL_VERSION = 15

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
            done = o.optInt("done"),
            total = o.optInt("total"),
            etaMs = o.optLong("etaMs"),
            items = itens,
            idleMs = o.optLong("idleMs"),
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

    /**
     * Para onde `openCast()` vai abrir, em texto. O popup de Exibição mostra
     * isso: os alvos de espelhamento variam por fabricante e não são API
     * documentada, então o operador precisa poder ver o que o aparelho tem.
     */
    @JavascriptInterface
    fun castTarget(callId: String) {
        resolve(callId, JSONObject().put("label", host?.describeCastTarget() ?: "").toString())
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
