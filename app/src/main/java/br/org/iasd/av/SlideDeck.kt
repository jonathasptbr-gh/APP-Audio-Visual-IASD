package br.org.iasd.av

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Transforma uma APRESENTAÇÃO em imagens que o app já sabe projetar.
 *
 * ## Por que PDF, e por que aqui
 *
 * O que o operador tem na mão é um PowerPoint ou um Google Apresentações. Não
 * existe, no Android, nada que desenhe um `.pptx` — e escrever um renderizador
 * de OOXML (formas, SmartArt, fontes, gráficos) seria assinar um contrato de
 * manutenção enorme para produzir, no telão da igreja, um slide que se parece
 * com o que o pastor montou mas não é ele. Um slide errado na frente da
 * congregação é pior que slide nenhum.
 *
 * PDF é o formato em que os dois exportam com dois toques, é o que preserva o
 * desenho exatamente como foi feito — e o Android traz um renderizador de PDF
 * NA PLATAFORMA ([PdfRenderer], desde a API 21). Ou seja: fidelidade total e
 * **zero dependência nova**, que é a regra do projeto.
 *
 * O Google Apresentações entra pelo mesmo caminho sem o operador exportar nada:
 * toda apresentação tem uma URL de exportação em PDF
 * (`/presentation/d/<id>/export/pdf`), e é ela que o app baixa. Precisa estar
 * compartilhada por link — que é como um roteiro de culto costuma circular.
 *
 * ## O que ele entrega
 *
 * Uma imagem PNG por página, no cache, servida pelo mesmo `/saf/<token>` das
 * pastas do dispositivo: daqui para a frente o caminho é o de qualquer imagem
 * importada (`fetch` + `Blob`), e o lado web guarda as páginas no registro da
 * mídia. PNG, e não JPEG, porque slide é TEXTO sobre fundo chapado — é onde o
 * JPEG borra as bordas das letras, e é justamente o que vai ser lido de longe.
 *
 * **BLOQUEANTE**: disco, rede e rasterização. Só pode ser chamado da fila de IO
 * da ponte, nunca da thread principal.
 */
object SlideDeck {

    private const val TAG = "SlideDeck"

    /**
     * Lado maior de cada página, em pixels.
     *
     * O telão de uma igreja é 1080p; renderizar acima disso só engorda o
     * IndexedDB (são dezenas de páginas por apresentação) sem acrescentar um
     * pixel visível. Abaixo disso, texto pequeno de rodapé começa a esfarelar.
     */
    private const val LADO_MAX = 1920

    /** Teto de páginas. Um PDF de 500 páginas não é um roteiro de culto — é um
     *  livro, e rasterizá-lo inteiro encheria a memória do aparelho. */
    private const val MAX_PAGINAS = 300

    private const val CONECTA_MS = 15_000
    private const val LE_MS = 30_000

    private const val UA =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Mobile Safari/537.36"

    /**
     * `docs.google.com/presentation/d/<id>` em qualquer das formas que o botão
     * de compartilhar do Google produz (`/edit`, `/view`, `?usp=sharing`).
     */
    private val SLIDES_ID = Regex("docs\\.google\\.com/presentation/d/([A-Za-z0-9_-]{16,})")

    /** A apresentação do Google vira PDF por esta URL, ou `null` se não for uma. */
    fun urlDeExportacao(link: String): String? {
        val id = SLIDES_ID.find(link)?.groupValues?.get(1) ?: return null
        return "https://docs.google.com/presentation/d/$id/export/pdf"
    }

    /**
     * Rasteriza a apresentação e devolve `{ name, pages: [url] }`, ou `null` em
     * qualquer falha (quem chama volta ao comportamento de antes: o arquivo
     * entra como mídia comum, ou o link vira item de URL).
     *
     * `origem` aceita as duas portas de entrada:
     *  - `/saf/<token>` — o PDF que chegou por compartilhamento ou pelo seletor
     *    de arquivos, já registrado pela ponte;
     *  - `https://…` — a URL de exportação do Google Apresentações (ver
     *    [urlDeExportacao]), baixada aqui porque o `fetch` do WebView esbarra
     *    no CORS do Google e porque este download sai do IP do aparelho.
     */
    fun paginas(
        ctx: Context,
        origem: String,
        nomeSugerido: String?,
        onProgresso: (Int, Int) -> Unit,
    ): JSONObject? {
        var temporario: File? = null
        return try {
            val fd = if (origem.startsWith("https://")) {
                val baixado = baixar(ctx, origem) ?: return null
                temporario = baixado
                ParcelFileDescriptor.open(baixado, ParcelFileDescriptor.MODE_READ_ONLY)
            } else {
                val token = Uri.parse(origem).lastPathSegment ?: return null
                val uri = SafRegistry.get(token) ?: return null
                ctx.contentResolver.openFileDescriptor(uri, "r")
            } ?: return null

            fd.use { descritor ->
                PdfRenderer(descritor).use { pdf ->
                    val total = minOf(pdf.pageCount, MAX_PAGINAS)
                    if (total <= 0) return null
                    val destino = pasta(ctx, chaveDe(origem))
                    val urls = JSONArray()
                    for (i in 0 until total) {
                        val arquivo = File(destino, "%03d.png".format(i))
                        if (!renderizar(pdf, i, arquivo)) return null
                        urls.put(SafRegistry.urlFor(Uri.fromFile(arquivo)))
                        onProgresso(i + 1, total)
                    }
                    JSONObject()
                        .put("name", nomeSugerido?.ifBlank { null } ?: "Apresentação")
                        .put("pages", urls)
                }
            }
        } catch (e: Exception) {
            // PDF protegido por senha, arquivo corrompido, link sem permissão:
            // todos chegam aqui, e todos têm a mesma resposta.
            Log.w(TAG, "não deu para abrir a apresentação: $origem", e)
            null
        } finally {
            temporario?.delete()
        }
    }

    /**
     * Rasteriza UMA página. O bitmap é criado e reciclado dentro da função de
     * propósito: uma apresentação de 60 páginas em 1920px são ~8 MB por página,
     * e segurar todas até o fim estoura a memória de um aparelho modesto — o
     * lado web já copiou a anterior para o IndexedDB quando esta começa.
     */
    private fun renderizar(pdf: PdfRenderer, indice: Int, destino: File): Boolean {
        pdf.openPage(indice).use { pagina ->
            val escala = LADO_MAX.toFloat() / maxOf(pagina.width, pagina.height).toFloat()
            val w = maxOf(1, (pagina.width * escala).toInt())
            val h = maxOf(1, (pagina.height * escala).toInt())
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            try {
                // FUNDO BRANCO antes de desenhar. O `PdfRenderer` não pinta o
                // papel: ele desenha o CONTEÚDO sobre o que já estiver no
                // bitmap, e um bitmap novo é transparente. Sem isto, um slide
                // de texto preto sobre papel branco vira texto preto sobre
                // TRANSPARENTE — e a transparência, no telão, é o preto do
                // palco: o texto some.
                bmp.eraseColor(Color.WHITE)
                pagina.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                FileOutputStream(destino).use { saida ->
                    if (!bmp.compress(Bitmap.CompressFormat.PNG, 100, saida)) return false
                }
            } finally {
                bmp.recycle()
            }
        }
        return true
    }

    private fun baixar(ctx: Context, link: String): File? {
        val conn = (URL(link).openConnection() as HttpURLConnection).apply {
            connectTimeout = CONECTA_MS
            readTimeout = LE_MS
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", UA)
        }
        try {
            if (conn.responseCode !in 200..299) {
                Log.w(TAG, "exportação recusada (HTTP ${conn.responseCode}): $link")
                return null
            }
            val destino = File(pasta(ctx, "baixado"), "slides.pdf")
            conn.inputStream.use { entrada ->
                FileOutputStream(destino).use { saida -> entrada.copyTo(saida) }
            }
            return if (destino.length() > 0L) destino else null.also { destino.delete() }
        } catch (e: Exception) {
            Log.w(TAG, "falha ao baixar $link", e)
            return null
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Apaga as páginas depois que o lado web copiou os bytes para a biblioteca.
     * Sem isto a apresentação ficaria DUAS vezes no aparelho — uma no cache e
     * outra no IndexedDB —, e ninguém limpa o cache.
     */
    fun descartar(ctx: Context, url: String) {
        try {
            val token = Uri.parse(url).lastPathSegment ?: return
            val alvo = SafRegistry.get(token) ?: return
            val f = alvo.path?.let { File(it) } ?: return
            // Só dentro do NOSSO cache: um token de `/saf/` também aponta para
            // arquivos do operador (pastas do dispositivo), e apagar um deles
            // seria destruir o original em vez de um intermediário.
            if (f.parentFile?.parentFile == raiz(ctx)) f.parentFile?.deleteRecursively()
        } catch (_: Exception) { /* o cache some sozinho no pior caso */ }
    }

    private fun raiz(ctx: Context) = File(ctx.cacheDir, "slides").apply { mkdirs() }

    /** Uma subpasta por apresentação: o descarte apaga a pasta inteira. */
    private fun pasta(ctx: Context, chave: String) =
        File(raiz(ctx), chave).apply { deleteRecursively(); mkdirs() }

    private fun chaveDe(origem: String): String =
        origem.takeLast(24).replace(Regex("[^A-Za-z0-9_-]"), "_")
}
