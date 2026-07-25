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
 * Serviços que só a Activity pode prestar (SAF, telas, wake lock, share).
 * O Display não tem host — seu WebView só usa o barramento de mensagens.
 */
interface BridgeHost {
    /** Abre o seletor de pasta do sistema (ACTION_OPEN_DOCUMENT_TREE). */
    fun requestFolderPick(onResult: (Uri?) -> Unit)

    /** Mantém a tela ligada durante o culto. */
    fun setKeepAwake(on: Boolean)

    /**
     * Declara ao sistema que há download em andamento, para o processo não
     * ser congelado com o app minimizado (ver [SyncService]).
     */
    fun setBackgroundWork(on: Boolean)

    /** Telas de apresentação conectadas agora. */
    fun listDisplays(): JSONArray

    /** Abre o seletor de espelhamento/transmissão do Android. */
    fun openCastPicker()

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
        const val SHELL_VERSION = 5
    }

    private val io = Executors.newSingleThreadExecutor()

    // ---------- identidade ----------

    @JavascriptInterface
    fun shellVersion(): Int = SHELL_VERSION

    /** `"controle"` ou `"display"` — o web usa para saber qual papel executa. */
    @JavascriptInterface
    fun role(): String = role

    /** Versão da base web em uso (embutida no APK ou baixada por OTA). */
    @JavascriptInterface
    fun webVersion(): String = WebUpdater.currentVersion(ctx)

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
     */
    @JavascriptInterface
    fun otaConfirm() {
        WebUpdater.confirmBoot(ctx)
    }

    // ---------- barramento de comandos ----------

    @JavascriptInterface
    fun busPost(json: String) {
        MessageBus.post(webRef(), json)
    }

    // ---------- sessão de culto ----------

    @JavascriptInterface
    fun keepAwake(on: Boolean) {
        host?.setKeepAwake(on)
    }

    /**
     * Ligado enquanto houver QUALQUER download em curso (hinos, álbuns,
     * Bíblia, pastas). O lado web conta as tarefas ativas e só desliga na
     * última — ver `bgWorkBegin`/`bgWorkEnd` em `controle.js`.
     */
    @JavascriptInterface
    fun keepAlive(on: Boolean) {
        host?.setBackgroundWork(on)
    }

    // ---------- telas ----------

    @JavascriptInterface
    fun displays(callId: String) {
        val list = host?.listDisplays() ?: JSONArray()
        resolve(callId, list.toString())
    }

    /**
     * Botão de cast da preview: abre o seletor de espelhamento do Android.
     * Não há API pública para o *popup* das configurações rápidas — o que
     * existe é a tela de Cast das Configurações, que é o mesmo seletor de
     * telas usado pelo Smart View. Ver [BridgeHost.openCastPicker].
     */
    @JavascriptInterface
    fun openCast() {
        host?.openCastPicker()
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
     */
    @JavascriptInterface
    fun listFolder(callId: String, treeUri: String) {
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
