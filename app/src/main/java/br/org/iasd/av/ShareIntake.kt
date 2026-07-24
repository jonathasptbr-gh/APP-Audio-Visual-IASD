package br.org.iasd.av

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject

/**
 * Compartilhamento recebido de outros apps (galeria, YouTube, navegador).
 *
 * Substitui o `share_target` do manifest do PWA — que dependia do service
 * worker interceptar um POST multipart e gravar `pending-share` no IDB, um
 * caminho notoriamente frágil em instalação nova. Aqui é um
 * `intent-filter` nativo: o Android entrega o conteúdo direto.
 *
 * O formato produzido é o MESMO que `checkPendingShare()` já consome
 * (`{ files:[…], url, title }`), com uma diferença deliberada: os arquivos
 * chegam como URL servível em vez de `File`, e o lado web faz `fetch()` para
 * materializar o Blob — nunca base64.
 */
object ShareIntake {

    fun parse(ctx: Context, intent: Intent?): JSONObject? {
        if (intent == null) return null
        val action = intent.action ?: return null

        val uris: List<Uri> = when (action) {
            Intent.ACTION_SEND -> listOfNotNull(extraStream(intent))
            Intent.ACTION_SEND_MULTIPLE -> extraStreams(intent)
            else -> emptyList()
        }

        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        val title = intent.getStringExtra(Intent.EXTRA_SUBJECT)

        if (uris.isEmpty() && text.isNullOrBlank()) return null

        val files = JSONArray()
        for (uri in uris) {
            files.put(describe(ctx, uri) ?: continue)
        }

        // O texto compartilhado pode vir com um link no meio de uma frase
        // (é como o YouTube compartilha). O lado web já sabe reconhecer e
        // classificar a URL — aqui só isolamos o primeiro link, se houver.
        val url = text?.let { firstUrl(it) }

        if (files.length() == 0 && url == null) return null

        return JSONObject()
            .put("files", files)
            .put("url", url ?: JSONObject.NULL)
            .put("title", title ?: JSONObject.NULL)
            .put("ts", System.currentTimeMillis())
    }

    private fun describe(ctx: Context, uri: Uri): JSONObject? = try {
        var name: String? = null
        var size = 0L
        ctx.contentResolver.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val iName = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val iSize = c.getColumnIndex(OpenableColumns.SIZE)
                if (iName >= 0 && !c.isNull(iName)) name = c.getString(iName)
                if (iSize >= 0 && !c.isNull(iSize)) size = c.getLong(iSize)
            }
        }
        JSONObject()
            .put("name", name ?: (uri.lastPathSegment ?: "arquivo"))
            .put("type", ctx.contentResolver.getType(uri) ?: "application/octet-stream")
            .put("size", size)
            .put("url", SafRegistry.urlFor(uri))
    } catch (_: Exception) {
        null
    }

    private fun firstUrl(text: String): String? =
        Regex("""https?://\S+""").find(text)?.value

    @Suppress("DEPRECATION")
    private fun extraStream(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }

    @Suppress("DEPRECATION")
    private fun extraStreams(intent: Intent): List<Uri> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java) ?: emptyList()
        } else {
            intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM) ?: emptyList()
        }
}
