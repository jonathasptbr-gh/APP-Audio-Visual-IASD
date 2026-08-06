package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import org.schabi.newpipe.extractor.Extractor
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.Stream
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

    /**
     * O idioma do pedido, e não uma preferência de exibição.
     *
     * `NewPipe.init(downloader)` sozinho usa a localização padrão da
     * biblioteca — **en-GB**. O YouTube leva isso a sério: ele TRADUZ o título
     * (e a descrição) para o idioma pedido quando o canal publica traduções ou
     * quando a tradução automática está ligada, então uma busca por um louvor
     * brasileiro voltava com títulos em inglês de vídeos cujo título original é
     * em português — o operador procurava por um nome que não estava mais lá.
     *
     * Fixo no português do Brasil, e não herdado do `Locale` do aparelho: o que se quer aqui
     * é o título ORIGINAL do louvor, e um celular configurado em inglês (não é
     * raro) traria a tradução de volta. `ContentCountry` acompanha porque é ele
     * que decide o acervo regional dos resultados.
     *
     * **E passar isto ao `NewPipe.init` NÃO BASTA** — foi o que a v1.32 fez, e
     * os títulos continuaram chegando em inglês. `StreamingService.
     * getLocalization()` FILTRA o pedido pela lista de idiomas suportados do
     * serviço, e a do YouTube nesta versão da biblioteca (v0.26.1) tem um item
     * só: `en-GB` (o resto está comentado no fonte). Qualquer outro idioma cai
     * no `Localization.DEFAULT`, que é justamente o en-GB — em silêncio, sem
     * erro nenhum, e por isso o código anterior PARECIA certo. O país escapa
     * do filtro porque "BR" está na lista de países suportados, então só metade
     * do pedido chegava.
     *
     * A saída é o `forceLocalization`/`forceContentCountry` do próprio
     * `Extractor` ([aportuguesar]), que é a válvula que a biblioteca oferece
     * para exatamente isto: ele é lido ANTES da lista de suportados
     * (`getExtractorLocalization`).
     *
     * E o código é `pt`, não `pt-BR`: a lista (comentada) que a própria
     * biblioteca guarda como os `hl` que o YouTube aceita tem "pt" e "pt-PT" —
     * não tem "pt-BR". Com o `gl=BR` do [PAIS], "pt" É o português do Brasil;
     * pedir um código que o YouTube talvez não reconheça arriscaria voltar para
     * o inglês pela porta dos fundos, que é exatamente o defeito.
     */
    private val IDIOMA = Localization("pt")
    private val PAIS = ContentCountry("BR")

    /**
     * Português no extrator, por cima do filtro de idiomas suportados.
     * Todo caminho que fala com o YouTube passa por aqui — busca e extração —,
     * senão um deles volta a devolver título traduzido.
     */
    private fun aportuguesar(ex: Extractor) {
        ex.forceLocalization(IDIOMA)
        ex.forceContentCountry(PAIS)
    }

    /**
     * O que o extrator devolveu na ÚLTIMA extração, em uma linha — lido pela
     * ponte (`ytDiag`) e mostrado no rodapé de Configurações. É diagnóstico, não
     * recurso: a única forma de saber se as faixas adaptativas chegam a ESTE
     * aparelho é olhar o que chegou nele.
     *
     * `@Volatile` porque quem escreve é a fila de IO e quem lê é a thread do
     * WebView.
     */
    @Volatile
    var diagnostico: String = ""
        private set

    /** "áudio 2 · vídeo-só 5 (1080p) · progressivo 2 (720p)" */
    private fun resumo(info: StreamInfo): String {
        val aud = info.audioStreams.count { it.isUrl && !it.getContent().isNullOrBlank() }
        val vOnly = info.videoOnlyStreams.filter { it.isUrl && !it.getContent().isNullOrBlank() }
        val prog = info.videoStreams.filter {
            it.isUrl && !it.getContent().isNullOrBlank() && !it.isVideoOnly
        }
        val maiorVOnly = vOnly.maxOfOrNull { alturaDe(it.getResolution()) } ?: 0
        val maiorProg = prog.maxOfOrNull { alturaDe(it.getResolution()) } ?: 0
        return "áudio " + aud +
            " · vídeo-só " + vOnly.size + (if (maiorVOnly > 0) " (${maiorVOnly}p)" else "") +
            " · progressivo " + prog.size + (if (maiorProg > 0) " (${maiorProg}p)" else "")
    }

    /** `NewPipe.init` é global e só pode acontecer uma vez por processo. */
    @Volatile
    private var pronto = false

    @Synchronized
    private fun garantirInit() {
        if (pronto) return
        NewPipe.init(NpDownloader, IDIOMA, PAIS)
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
    fun buscar(
        ctx: Context,
        link: String,
        somenteAudio: Boolean,
        onProgresso: (Long, Long) -> Unit,
    ): JSONObject? {
        return try {
            garantirInit()
            // Pelo EXTRATOR, e não pelo atalho `getInfo(service, url)`: é o
            // único ponto em que dá para forçar o idioma antes do fetch.
            val ex = ServiceList.YouTube.getStreamExtractor(link)
            aportuguesar(ex)
            val info = StreamInfo.getInfo(ex)
            val nome = tituloLimpo(info.name, info.uploaderName)
            val id = info.id ?: "video"

            // AS TENTATIVAS, EM ORDEM. Pedindo só o áudio, as faixas de áudio
            // vêm primeiro — e o VÍDEO PROGRESSIVO fica como último recurso, em
            // vez de o download inteiro falhar.
            //
            // Isso não é zelo teórico: as faixas separadas (as "adaptativas")
            // são exatamente as que o YouTube protege com PO Token, e este app
            // não monta o desafio do BotGuard de propósito (ver o cabeçalho).
            // Sem token, `audioStreams` pode voltar vazio ou com URLs que o CDN
            // responde 403 — enquanto o progressivo, que é o formato antigo,
            // costuma passar. Era esse o buraco: a v5.112 tentava só a faixa de
            // áudio e, quando ela não vinha, devolvia `null` — do lado do
            // operador, um cartão de download que some sem dizer nada.
            //
            // E cair no progressivo NÃO desmente a escolha: quem decide que o
            // telão não muda de imagem é o `kind: 'audio'` do registro, lá no
            // lado web, não o container do arquivo. O operador ouve o louvor no
            // fundo do mesmo jeito; o que ele paga é o tamanho do arquivo, e é
            // por isso que esta é a ÚLTIMA tentativa, não a primeira.
            // DIAGNÓSTICO (v1.42). A pergunta que só o aparelho responde: o
            // extrator está recebendo as faixas ADAPTATIVAS (áudio separado e
            // vídeo-only, que é onde moram 1080p e o áudio puro) ou só o
            // progressivo? Sem PO Token a biblioteca busca os streams pelo
            // endpoint `reel/reel_item_watch`, e o que ele devolve varia por
            // vídeo — não dá para decidir por leitura de código se vale
            // implementar o remux para 1080p. Isto mede, uma vez, na mão de
            // quem opera.
            diagnostico = resumo(info)
            val tentativas = mutableListOf<Alvo>()
            if (somenteAudio) {
                // 1) AAC, a primeira escolha: o WebView decodifica em qualquer
                //    aparelho. 2) qualquer OUTRO formato de áudio (na prática
                //    Opus/WebM, que este mesmo Chromium toca) — e o `exceto`
                //    existe para a segunda tentativa não repetir a faixa que
                //    acabou de falhar. 3) o vídeo progressivo.
                melhorAudio(info, "m4a", null)?.let { tentativas += Alvo(it, true) }
                melhorAudio(info, null, "m4a")?.let { tentativas += Alvo(it, true) }
            }
            melhorProgressivo(info)?.let { tentativas += Alvo(it, false) }

            for (alvo in tentativas) {
                val url = alvo.stream.getContent()
                if (url.isNullOrBlank()) continue
                val destino = arquivoDestino(ctx, id, alvo.ext)
                try {
                    baixar(url, destino, onProgresso)
                } catch (e: Exception) {
                    Log.w(TAG, "falhou baixando ${alvo.ext} de $link", e)
                    destino.delete()
                    continue
                }
                if (destino.length() <= 0L) { destino.delete(); continue }
                diagnostico += " → veio " + alvo.ext +
                    (alvo.stream as? VideoStream)?.let { " " + (it.getResolution() ?: "?") }.orEmpty()
                return JSONObject()
                    .put("url", SafRegistry.urlFor(Uri.fromFile(destino)))
                    .put("name", nome)
                    .put("size", destino.length())
                    // O tipo é o do arquivo que de fato veio — nunca o que foi
                    // PEDIDO. Anunciar um mp4 com vídeo como `audio/mp4` seria
                    // mentir para o decodificador do WebView; quem transforma
                    // isto em "toca sem imagem" é o `kind` do registro, que o
                    // lado web escolhe a partir do que ele pediu.
                    .put("type", alvo.mime)
                    // ...e este campo diz se a faixa é MESMO só áudio, para o
                    // lado web poder avisar quando teve de cair no vídeo.
                    .put("audioOnly", alvo.soAudio)
            }
            diagnostico += " → NADA baixou"
            Log.w(TAG, "nenhum stream utilizável para $link ($diagnostico)")
            null
        } catch (e: Exception) {
            Log.w(TAG, "falhou em $link", e)
            null
        }
    }

    /**
     * Uma tentativa de download. O tipo e a extensão saem do PRÓPRIO formato da
     * faixa (`MediaFormat.getMimeType()`/`getSuffix()`), nunca de uma tabela
     * escrita à mão aqui: é a biblioteca que sabe se aquele itag é m4a, WebM ou
     * Opus, e uma segunda tabela envelheceria em silêncio na primeira vez que o
     * YouTube trocasse um formato.
     */
    private class Alvo(val stream: Stream, val soAudio: Boolean) {
        val mime: String = stream.getFormat()?.getMimeType()
            ?: (if (soAudio) "audio/mp4" else "video/mp4")
        val ext: String = stream.getFormat()?.getSuffix()
            ?: (if (soAudio) "m4a" else "mp4")
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
        val ex = svc.getSearchExtractor(q)
        aportuguesar(ex)
        // `SearchInfo.getInfo(extractor)` NÃO busca a página sozinho (ao
        // contrário do `getInfo(service, query)` e do `StreamInfo.getInfo`):
        // sem este `fetchPage` a lista volta vazia, sem erro.
        ex.fetchPage()
        val info = SearchInfo.getInfo(ex)
        for (item in info.relatedItems) {
            if (item !is StreamInfoItem) continue
            val url = item.getUrl() ?: continue
            val id = ID_NA_URL.find(url)?.groupValues?.get(1) ?: continue
            out.put(
                JSONObject()
                    .put("id", id)
                    .put("url", url)
                    .put("name", tituloLimpo(item.getName(), item.getUploaderName()))
                    .put("author", item.getUploaderName() ?: "")
                    .put("seconds", item.getDuration())
                    .put("thumb", "https://i.ytimg.com/vi/$id/mqdefault.jpg"),
            )
            if (out.length() >= max) break
        }
        return out
    }

    /**
     * Tira o nome do CANAL da frente do título.
     *
     * Meio YouTube publica como "Arautos do Rei - Firme nas Promessas", e no
     * Cronograma isso vira uma lista em que a metade esquerda de toda linha é a
     * mesma palavra — justamente a parte que não distingue um item do outro. O
     * canal não se perde: ele aparece no subtítulo do resultado da busca, que é
     * onde ele ajuda a escolher.
     *
     * A remoção é CONSERVADORA de propósito: só corta quando o começo do título
     * é exatamente o nome do canal seguido de um separador. Um título que
     * simplesmente contenha um travessão ("Hino 512 - Ao Deus de Abraão")
     * continua inteiro — cortar por "tem um traço" estragaria mais nomes do que
     * arrumaria.
     *
     * `- Topic` é o sufixo dos canais que o YouTube gera sozinho para música
     * ("Arautos do Rei - Topic"): sem tirá-lo, a comparação nunca casaria
     * justamente nos vídeos de louvor, que são o caso mais comum aqui.
     */
    private fun tituloLimpo(titulo: String?, canal: String?): String {
        val t = titulo?.trim().orEmpty()
        if (t.isEmpty()) return "Vídeo do YouTube"
        val c = canal?.trim()?.removeSuffix("- Topic")?.trim().orEmpty()
        if (c.isEmpty()) return t
        val re = Regex("^" + Regex.escape(c) + "\\s*[-–—|:]\\s*", RegexOption.IGNORE_CASE)
        val limpo = t.replace(re, "").trim()
        // Título que era SÓ o nome do canal continua como estava: uma linha
        // vazia no Cronograma seria pior que um nome repetido.
        return limpo.ifEmpty { t }
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
    /**
     * Nomes distintos para vídeo e áudio do MESMO id: baixar as duas formas do
     * mesmo link (o operador muda de ideia, ou quer as duas) não pode fazer uma
     * sobrescrever a outra enquanto a primeira ainda está sendo copiada para a
     * biblioteca.
     */
    private fun arquivoDestino(ctx: Context, id: String, ext: String): File =
        File(
            pasta(ctx),
            id.replace(Regex("[^A-Za-z0-9_-]"), "_")
                + (if (ext == "mp4") "" else "-audio") + "." + ext,
        )

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

    /**
     * A melhor faixa **só de áudio**, em M4A (AAC).
     *
     * `sufixo` = "m4a" pede AAC, a primeira escolha: é o que o WebView do
     * Android decodifica em qualquer aparelho. `null` aceita QUALQUER formato de
     * áudio (na prática, WebM/Opus) — que é a segunda tentativa, porque nem todo
     * vídeo oferece m4a sem PO Token, e um Opus que toca vale mais que um AAC
     * que não veio. O WebView é o mesmo Chromium do Chrome: ele toca Opus.
     *
     * Sem faixa de áudio nenhuma, quem chamou cai na tentativa seguinte (o
     * vídeo progressivo) — ver [buscar].
     */
    private fun melhorAudio(info: StreamInfo, sufixo: String?, exceto: String?): AudioStream? =
        info.audioStreams
            .asSequence()
            .filter { it.isUrl && !it.getContent().isNullOrBlank() }
            .filter { sufixo == null || it.getFormat()?.getSuffix()?.equals(sufixo, true) == true }
            .filter { exceto == null || it.getFormat()?.getSuffix()?.equals(exceto, true) != true }
            .maxByOrNull { it.averageBitrate }

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
                // O idioma do pedido também vai no CABEÇALHO. Quem manda de
                // fato é o `hl` do corpo InnerTube, mas nem toda requisição da
                // biblioteca é InnerTube (há páginas HTML no caminho), e é
                // justamente o `Accept-Language` que decide o idioma nelas —
                // que é o que fazem os downloaders de referência do NewPipe.
                // Sempre pt-BR, e não o `request.localization()`: é ele que
                // pode vir com o en-GB que o filtro de idiomas suportados da
                // biblioteca impõe (ver IDIOMA), e aí o cabeçalho desfaria
                // justamente o que o `forceLocalization` acabou de corrigir.
                if (conn.getRequestProperty("Accept-Language") == null) {
                    conn.setRequestProperty("Accept-Language", IDIOMA.localizationCode)
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
