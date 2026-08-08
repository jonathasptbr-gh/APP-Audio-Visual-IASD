package br.org.iasd.av

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.File

/**
 * Serve a base web: do bundle OTA da sessão quando há um, caindo para os
 * assets do APK.
 *
 * O fallback é por ARQUIVO, não por bundle: se um arquivo faltar no bundle
 * baixado, o do APK responde. Isso evita que um zip incompleto derrube a
 * aplicação inteira — a checagem de integridade em [WebUpdater] já rejeita o
 * caso grosseiro, e isto cobre o resto.
 *
 * **ESTE HANDLER PASSOU A TER UM SEGUNDO CONSUMIDOR, E ELE NÃO É UM WEBVIEW.**
 * O [EspelhoServidor] serve os estáticos do cliente do espelho por aqui, para
 * que uma correção deles chegue por OTA como qualquer outra e para não existir
 * uma segunda tabela MIME (que divergiria no primeiro `.woff2` novo). Duas
 * consequências, e as duas são obrigações:
 *
 *  - A contenção por `canonicalPath` em [fromFile] era descrita como "defesa em
 *    profundidade" enquanto o único chamador era o asset loader. Com um
 *    `ServerSocket` do outro lado ela é **load-bearing**: o caminho passa a
 *    poder vir de um desconhecido na rede.
 *  - Do lado do servidor, a rota é resolvida por um **mapa fixo** de rota →
 *    caminho, nunca por concatenação: [handle] resolve QUALQUER caminho do
 *    bundle, e um `handle("espelho/" + nome)` com `nome` vindo da URL entregaria
 *    `controle/controle.js` e `shared/native.js` para a rede.
 */
class WebPathHandler(private val ctx: Context) : WebViewAssetLoader.PathHandler {

    private val assets = WebViewAssetLoader.AssetsPathHandler(ctx)

    override fun handle(path: String): WebResourceResponse? {
        val root = WebUpdater.sessionRoot
        if (root != null) {
            fromFile(root, path)?.let { return it }
        }
        return assets.handle(path)
    }

    private fun fromFile(root: File, path: String): WebResourceResponse? = try {
        val file = File(root, path)
        // Defesa em profundidade: o bundle já é extraído com checagem de zip
        // slip, mas o caminho aqui vem da URL e nunca pode escapar da raiz.
        val rootPath = root.canonicalPath + File.separator
        if (file.isFile && file.canonicalPath.startsWith(rootPath)) {
            WebResourceResponse(mimeOf(file.name), encodingOf(file.name), file.inputStream())
        } else {
            null
        }
    } catch (_: Exception) {
        null
    }

    /** `internal` porque o [EspelhoServidor] monta o `Content-Type` das rotas
     *  estáticas dele com esta MESMA tabela — duplicá-la seria garantir que as
     *  duas divergissem. */
    internal fun mimeOf(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "html", "htm" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json", "webmanifest" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "ico" -> "image/x-icon"
        "woff2" -> "font/woff2"
        "woff" -> "font/woff"
        "ttf" -> "font/ttf"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        "mp3" -> "audio/mpeg"
        else -> "application/octet-stream"
    }

    /** Só texto declara charset; binário com encoding quebra a resposta.
     *  `internal` pela mesma razão do [mimeOf]. */
    internal fun encodingOf(name: String): String? =
        when (name.substringAfterLast('.', "").lowercase()) {
            "html", "htm", "js", "mjs", "css", "json", "webmanifest", "svg" -> "utf-8"
            else -> null
        }
}
