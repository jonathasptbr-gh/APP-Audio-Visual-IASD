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

    private fun mimeOf(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
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

    /** Só texto declara charset; binário com encoding quebra a resposta. */
    private fun encodingOf(name: String): String? =
        when (name.substringAfterLast('.', "").lowercase()) {
            "html", "htm", "js", "mjs", "css", "json", "webmanifest", "svg" -> "utf-8"
            else -> null
        }
}
