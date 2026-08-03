package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import org.schabi.newpipe.extractor.stream.VideoStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Baixa um vídeo do YouTube **no próprio aparelho**, para o app usar o arquivo
 * em vez do player embutido.
 *
 * ## Por que isto existe
 *
 * O embed do YouTube pausa sozinho quando a página fica oculta — e é isso que o
 * Android faz com o telão no instante em que o operador minimiza o app. A regra
 * roda num iframe de outra origem e nenhum código nosso a alcança. Foram
 * tentadas, e falharam em aparelho, as duas saídas de fora: mandar tocar de
 * novo ([`ytWatchResume`] no Display) e impedir o WebView de se declarar oculto
 * ([WebViewFactory.KeepVisibleWebView]).
 *
 * Com o vídeo virando ARQUIVO, ele passa a ser mídia comum: o mesmo `<video>`
 * dos importados, com fade, seek, playlist, `MediaSession` e segundo plano que
 * já funcionam há versões — e sem anúncio, sem legenda e **sem depender da rede
 * durante o culto**.
 *
 * ## Por que AQUI, e não num servidor
 *
 * A versão anterior pedia uma instância [Cobalt](https://cobalt.tools). Não
 * funcionou, e o motivo não é o Cobalt: servidores públicos rodam em **IP de
 * datacenter**, que é exatamente o que o YouTube bloqueia. Extrair no aparelho
 * sai do IP do chip do operador — é por isso que o NewPipe funciona no celular
 * enquanto as instâncias públicas apanham. De quebra, aqui não existe CORS: o
 * `fetch` do WebView nunca chegaria ao `googlevideo.com`, que não manda os
 * cabeçalhos, e por isso o caminho anterior precisava de um túnel.
 *
 * ## O que ele entrega
 *
 * Um **MP4 progressivo** (vídeo e áudio no mesmo arquivo). O YouTube reserva as
 * resoluções altas para faixas separadas de vídeo e áudio, que só servem depois
 * de remuxadas — e remuxar exigiria um ffmpeg embarcado, muito além do que este
 * app se propõe. Na prática o teto costuma ser 720p; num telão de igreja isso é
 * suficiente, e é infinitamente melhor que um vídeo que para de tocar no meio.
 *
 * ## Sem PO Token, de propósito (por enquanto)
 *
 * O extrator aceita um `PoTokenProvider`, e sem ele "faz o melhor esforço:
 * alguns formatos podem não estar disponíveis". Montar o provedor exige rodar o
 * desafio do BotGuard num WebView — o app tem dois, então é factível, mas é
 * outra empreitada. Começar sem ele é a decisão certa: se algum vídeo resistir,
 * o app cai no player embutido, que é o comportamento de antes.
 */
object YoutubeGrab {

    private const val TAG = "YoutubeGrab"

    /**
     * UA de navegador comum. O extrator já manda o seu em várias requisições,
     * mas o download do arquivo é NOSSO, e um `User-Agent` vazio é o tipo de
     * detalhe que faz um CDN devolver 403 sem explicar.
     */
    private const val UA =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Mobile Safari/537.36"

    private const val CONECTA_MS = 15_000
    private const val LE_MS = 30_000

    /** `NewPipe.init` é global e só pode acontecer uma vez por processo. */
    @Volatile
    private var pronto = false

    @Synchronized
    private fun garantirInit() {
        if (pronto) return
        NewPipe.init(NpDownloader)
        pronto = true
    }

    /**
     * Extrai, baixa e devolve o resultado pronto para o lado web:
     * `{ url, name, size, type }`, com `url` servível pelo mesmo `/saf/` que
     * as pastas do dispositivo já usam — o lado web faz `fetch` + `Blob`
     * exatamente como faz com um arquivo compartilhado, sem saber de onde veio.
     *
     * **BLOQUEANTE**: rede e parsing. Só pode ser chamado da fila de IO da
     * ponte, nunca da thread principal.
     *
     * Devolve `null` em qualquer falha — quem chama cai no player embutido.
     */
    fun buscar(ctx: Context, link: String, onProgresso: (Long, Long) -> Unit): JSONObject? {
        return try {
            garantirInit()
            val info = StreamInfo.getInfo(ServiceList.YouTube, link)
            val stream = melhorProgressivo(info)
            if (stream == null) {
                Log.w(TAG, "nenhum stream progressivo para $link")
                return null
            }
            val nome = info.name?.takeIf { it.isNotBlank() } ?: "Vídeo do YouTube"
            val destino = arquivoDestino(ctx, info.id ?: "video")
            baixar(stream.getContent(), destino, onProgresso)
            if (destino.length() <= 0L) {
                destino.delete()
                return null
            }
            JSONObject()
                .put("url", SafRegistry.urlFor(Uri.fromFile(destino)))
                .put("name", nome)
                .put("size", destino.length())
                .put("type", "video/mp4")
        } catch (e: Exception) {
            Log.w(TAG, "falhou em $link", e)
            null
        }
    }

    /**
     * BUSCA no YouTube, de dentro do app.
     *
     * A mesma biblioteca que extrai o vídeo também pesquisa, e a busca sai do
     * IP do aparelho como tudo o mais aqui. Isso resolve um caminho que era
     * absurdo: para achar um louvor, o operador saía do app, abria o YouTube,
     * pesquisava, compartilhava de volta e esperava. Agora ele digita uma vez,
     * na tela do acervo, e toca no resultado.
     *
     * As duas alternativas não serviam: um `<iframe>` da página de resultados é
     * recusado pelo `X-Frame-Options` do YouTube, e a API oficial exigiria uma
     * chave embutida no APK com cota diária dividida por toda a frota.
     *
     * **BLOQUEANTE** — fila de IO da ponte, como [buscar].
     *
     * A miniatura é montada a partir do ID (`i.ytimg.com/vi/<id>/mqdefault.jpg`)
     * em vez de vir da biblioteca: é uma URL estável há mais de uma década, e
     * assim o formato das imagens do extrator (que já mudou de forma entre
     * versões) deixa de ser algo que pode quebrar a lista.
     */
    fun pesquisar(termo: String, max: Int = 20): JSONArray {
        val out = JSONArray()
        if (termo.isBlank()) return out
        garantirInit()
        val svc = ServiceList.YouTube
        // Só VÍDEOS: canais e playlists não têm o que fazer numa lista cujo
        // único destino é virar um arquivo de mídia.
        val q = svc.getSearchQHFactory().fromQuery(termo, listOf("videos"), "")
        val info = SearchInfo.getInfo(svc, q)
        for (item in info.relatedItems) {
            if (item !is StreamInfoItem) continue
            val url = item.getUrl() ?: continue
            val id = ID_NA_URL.find(url)?.groupValues?.get(1) ?: continue
            out.put(
                JSONObject()
                    .put("id", id)
                    .put("url", url)
                    .put("name", item.getName() ?: "")
                    .put("author", item.getUploaderName() ?: "")
                    .put("seconds", item.getDuration())
                    .put("thumb", "https://i.ytimg.com/vi/$id/mqdefault.jpg"),
            )
            if (out.length() >= max) break
        }
        return out
    }

    /** `watch?v=<id>`, `youtu.be/<id>`, `/shorts/<id>` — o id tem 11 caracteres. */
    private val ID_NA_URL = Regex("(?:[?&]v=|/)([A-Za-z0-9_-]{11})(?:[?&#]|\\z)")

    /**
     * Apaga o arquivo depois que o lado web já copiou os bytes para a
     * biblioteca. Sem isto, cada vídeo ficaria DUAS vezes no aparelho — uma no
     * cache e outra no IndexedDB — e o cache não é limpo por ninguém.
     */
    fun descartar(ctx: Context, url: String) {
        try {
            val token = Uri.parse(url).lastPathSegment ?: return
            val alvo = SafRegistry.get(token) ?: return
            val f = alvo.path?.let { File(it) } ?: return
            if (f.parentFile == pasta(ctx)) f.delete()
        } catch (_: Exception) { /* o cache some sozinho no pior caso */ }
    }

    private fun pasta(ctx: Context) = File(ctx.cacheDir, "yt").apply { mkdirs() }

    /**
     * No CACHE, não em `files/`: estes arquivos são intermediários (viram um
     * blob no IndexedDB em seguida) e o cache é o único lugar que o Android
     * limpa sozinho sob pressão de espaço — e que as regras de backup já
     * ignoram sem precisar de linha nova em `backup_rules.xml`.
     */
    private fun arquivoDestino(ctx: Context, id: String): File =
        File(pasta(ctx), id.replace(Regex("[^A-Za-z0-9_-]"), "_") + ".mp4")

    /**
     * O melhor MP4 **progressivo** (vídeo + áudio no mesmo arquivo).
     *
     * `videoStreams` já são os muxados — `videoOnlyStreams` é a outra lista, e é
     * justamente a que não serve aqui. O filtro por MP4 não é preciosismo: o
     * WebView do Android toca H.264/MP4 em qualquer aparelho, e um `.webm` em
     * VP9/AV1 depende do modelo. Um vídeo que não abre no telão no meio do culto
     * é pior que um arquivo maior.
     */
    private fun melhorProgressivo(info: StreamInfo): VideoStream? =
        info.videoStreams
            .asSequence()
            .filter { it.isUrl && !it.getContent().isNullOrBlank() }
            .filter { !it.isVideoOnly }
            .filter { it.getFormat()?.getSuffix()?.equals("mp4", true) == true }
            .maxByOrNull { alturaDe(it.getResolution()) }

    /** "1080p60" → 1080. Resolução ilegível vira 0: ela nunca ganha do resto. */
    private fun alturaDe(res: String?): Int =
        Regex("(\\d+)").find(res ?: "")?.groupValues?.get(1)?.toIntOrNull() ?: 0

    /**
     * Baixa em streaming, reportando o andamento. Um louvor tem centenas de MB
     * e o percentual é a única coisa que separa "baixando" de "travado" na tela
     * do operador.
     */
    private fun baixar(url: String, destino: File, onProgresso: (Long, Long) -> Unit) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = CONECTA_MS
            readTimeout = LE_MS
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", UA)
        }
        try {
            val total = conn.contentLengthLong.coerceAtLeast(0L)
            var lidos = 0L
            var ultimo = 0L
            conn.inputStream.use { entrada ->
                destino.outputStream().use { saida ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = entrada.read(buf)
                        if (n < 0) break
                        saida.write(buf, 0, n)
                        lidos += n
                        // Um aviso por MB: o WebView é acordado a cada um deles,
                        // e reportar a cada 64 KB seria mais trabalho de ponte do
                        // que de download.
                        if (lidos - ultimo >= 1024 * 1024) {
                            ultimo = lidos
                            onProgresso(lidos, total)
                        }
                    }
                }
            }
            onProgresso(lidos, total)
        } finally {
            conn.disconnect()
        }
    }

    /**
     * O [Downloader] que o extrator usa para tudo. `HttpURLConnection` e nada
     * mais — acrescentar um cliente HTTP de terceiro para servir a uma única
     * biblioteca seria trocar uma exceção por duas.
     */
    private object NpDownloader : Downloader() {

        override fun execute(request: Request): Response {
            val conn = (URL(request.url()).openConnection() as HttpURLConnection).apply {
                connectTimeout = CONECTA_MS
                readTimeout = LE_MS
                instanceFollowRedirects = true
                requestMethod = request.httpMethod()
            }
            try {
                for ((chave, valores) in request.headers()) {
                    if (chave == null) continue
                    for (v in valores) conn.addRequestProperty(chave, v)
                }
                if (conn.getRequestProperty("User-Agent") == null) {
                    conn.setRequestProperty("User-Agent", UA)
                }
                request.dataToSend()?.let { corpo ->
                    conn.doOutput = true
                    conn.setFixedLengthStreamingMode(corpo.size)
                    conn.outputStream.use { it.write(corpo) }
                }

                val code = conn.responseCode
                // 429 é o "confirme que você não é um robô" do YouTube. O
                // extrator sabe tratar essa exceção; um 429 devolvido como
                // resposta normal viraria um erro de parsing sem sentido.
                if (code == 429) throw ReCaptchaException("reCaptcha", request.url())

                val corpo = (if (code >= 400) conn.errorStream else conn.inputStream)
                    ?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""

                // `headerFields` traz a linha de status numa entrada de chave
                // NULA. Repassá-la é um NullPointerException dentro da
                // biblioteca, num ponto que não tem nada a ver com a causa.
                val cabecalhos = LinkedHashMap<String, List<String>>()
                for ((chave, valores) in conn.headerFields) {
                    if (chave != null) cabecalhos[chave] = valores
                }

                return Response(code, conn.responseMessage, cabecalhos, corpo, conn.url.toString())
            } catch (e: ReCaptchaException) {
                throw e
            } catch (e: Exception) {
                throw IOException(e)
            } finally {
                conn.disconnect()
            }
        }
    }
}
