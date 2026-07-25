package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Registro de URIs do Storage Access Framework expostas ao lado web.
 *
 * PRINCÍPIO DA PONTE: entregamos ao JavaScript **URLs servíveis**, nunca
 * bytes. O lado web continua usando `fetch()` + `Blob` exatamente como já faz
 * com o OPFS — nenhuma função de importação precisou ser reescrita, e um
 * vídeo de 2 GB nunca passa por base64.
 *
 * O token é um contador opaco (e não o próprio URI codificado) porque o
 * `PathHandler` recebe o caminho JÁ decodificado: um `content://` com barras
 * viraria segmentos de caminho e quebraria o roteamento.
 */
object SafRegistry {
    private val byToken = ConcurrentHashMap<String, Uri>()
    private val seq = AtomicLong(0)

    /** Registra (ou reaproveita) um URI e devolve a URL servível pelo loader. */
    fun urlFor(uri: Uri): String {
        val token = seq.incrementAndGet().toString()
        byToken[token] = uri
        return "${WebViewFactory.ORIGIN}/saf/$token"
    }

    fun get(token: String): Uri? = byToken[token]

}

/** Serve os bytes de um documento do SAF em streaming, sob `/saf/<token>`. */
class SafPathHandler(private val ctx: Context) : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebResourceResponse? {
        val token = path.trim('/')
        if (token.isEmpty()) return WebViewFactory.notFound()
        val uri = SafRegistry.get(token) ?: return WebViewFactory.notFound()
        return try {
            val mime = ctx.contentResolver.getType(uri) ?: "application/octet-stream"
            val stream = ctx.contentResolver.openInputStream(uri)
                ?: return WebViewFactory.notFound()
            WebResourceResponse(
                mime,
                null,
                200,
                "OK",
                // Os bytes são copiados uma única vez para o OPFS; não há
                // motivo para o WebView guardar uma segunda cópia em cache.
                mapOf("Cache-Control" to "no-store"),
                stream,
            )
        } catch (_: Exception) {
            // Arquivo removido/movido no dispositivo depois de listado, ou
            // permissão revogada: o lado web trata como falha de leitura e
            // simplesmente pula o arquivo, como já faz no fluxo do OPFS.
            WebViewFactory.notFound()
        }
    }
}
