package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * Registro de URIs do Storage Access Framework expostas ao lado web.
 *
 * PRINCÍPIO DA PONTE: entregamos ao JavaScript **URLs servíveis**, nunca
 * bytes. O lado web continua usando `fetch()` + `Blob` exatamente como já faz
 * com o OPFS — nenhuma função de importação precisou ser reescrita, e um
 * vídeo de 2 GB nunca passa por base64.
 *
 * O token é opaco (e não o próprio URI codificado) porque o `PathHandler`
 * recebe o caminho JÁ decodificado: um `content://` com barras viraria
 * segmentos de caminho e quebraria o roteamento. Ele é **aleatório**, e não um
 * contador: um contador é adivinhável por construção, e as entradas nunca
 * expiram (ver abaixo) — não custa nada não deixar `/saf/1..N` enumerável.
 *
 * TEMPO DE VIDA: as entradas vivem até o processo morrer; não há remoção. É
 * por isso que o reaproveitamento por URI importa de verdade — sem ele, cada
 * `listFolder` de uma pasta de 500 arquivos acrescentava 500 entradas novas
 * para os MESMOS arquivos, a cada re-sincronização, num processo que é mantido
 * vivo de propósito durante todo o culto.
 */
object SafRegistry {
    private val byToken = ConcurrentHashMap<String, Uri>()
    private val byUri = ConcurrentHashMap<Uri, String>()
    private val rnd = SecureRandom()

    /**
     * Registra (ou reaproveita) um URI e devolve a URL servível pelo loader.
     *
     * "Reaproveita" é literal: o mesmo URI devolve sempre o mesmo token. O
     * `putIfAbsent` resolve a corrida entre duas listagens simultâneas — quem
     * perde descarta o token que cunhou (ele nunca chegou a ser registrado em
     * [byToken], então não vira lixo servível).
     */
    fun urlFor(uri: Uri): String {
        val token = byUri[uri] ?: run {
            val fresh = newToken()
            val prev = byUri.putIfAbsent(uri, fresh)
            if (prev == null) {
                byToken[fresh] = uri
                fresh
            } else {
                prev
            }
        }
        return "${WebViewFactory.ORIGIN}/saf/$token"
    }

    fun get(token: String): Uri? = byToken[token]

    /**
     * 128 bits em base64url — sem `/` nem `=`, para caber num segmento de
     * caminho sem escapar nada (o `PathHandler` recebe o caminho decodificado).
     */
    private fun newToken(): String {
        val b = ByteArray(16)
        rnd.nextBytes(b)
        return Base64.encodeToString(b, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
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
