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

        // O fallback para o `clipData` só vale para as DUAS ações de share: um
        // intent já consumido (a ação vira ACTION_MAIN, mas o clipData fica no
        // objeto) não pode ressuscitar o conteúdo por esta porta. E as URIs de
        // lá passam pelas MESMAS validações (`aceitavel`) das do extra.
        val uris: List<Uri> = when (action) {
            Intent.ACTION_SEND ->
                listOfNotNull(extraStream(intent)).ifEmpty { clipUris(intent) }
            Intent.ACTION_SEND_MULTIPLE ->
                extraStreams(intent).ifEmpty { clipUris(intent) }
            else -> emptyList()
        }.filter { aceitavel(ctx, it) }

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

    /**
     * Validação de entrada de um ponto EXPORTADO: o `intent-filter` de
     * ACTION_SEND é público e qualquer app instalado pode dispará-lo.
     *
     * Só `content://` passa. `ContentResolver.openInputStream` também atende
     * `file://` e `android.resource://`, e a leitura acontece com o uid DESTE
     * app — um app malicioso com `targetSdk` antigo podia compartilhar
     * `file:///data/data/br.org.iasd.av/shared_prefs/…` e o conteúdo virava
     * item de mídia do Cronograma, projetável na TV. Não há canal de volta
     * para quem compartilhou (o dano demonstrável é nulo), mas um ponto de
     * entrada exportado que não valida o que recebe é dívida gratuita.
     *
     * A autoridade do próprio app também cai fora, pelo mesmo motivo: hoje o
     * app não declara nenhum provider, e se um dia declarar, um share não é a
     * porta por onde ele deve ser lido.
     */
    private fun aceitavel(ctx: Context, uri: Uri): Boolean {
        if (uri.scheme != "content") return false
        val autoridade = uri.authority ?: return false
        return autoridade != ctx.packageName && !autoridade.startsWith(ctx.packageName + ".")
    }

    /**
     * URIs do `clipData` — o transporte MODERNO do share, que alguns apps usam
     * sozinho, sem preencher o `EXTRA_STREAM` legado. Sem este fallback, um
     * share desses chegava como vazio e o app parecia ignorar o arquivo.
     */
    private fun clipUris(intent: Intent): List<Uri> {
        val clip = intent.clipData ?: return emptyList()
        return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
    }

    private fun describe(ctx: Context, uri: Uri): JSONObject? = try {
        var name: String? = null
        var size = 0L
        // Projeção com SÓ as colunas usadas: `null` pede ao provedor todas as
        // que ele tiver, à toa — e provedor de terceiro é código de terceiro.
        val projecao = arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        ctx.contentResolver.query(uri, projecao, null, null, null)?.use { c ->
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
            // Pontuação de FECHAMENTO colada ao link é da frase, não da URL
            // ("veja https://youtu.be/x)." — o `\S+` a captura junto), e um
            // `)` a mais é o bastante para o YouTube não reconhecer o vídeo.
            ?.trimEnd(')', '.', ',', ';', ']')

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
