package br.org.iasd.av

import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

/**
 * Serve uma faixa do `googlevideo` **pelo nosso próprio origin**, em
 * `https://appassets.androidplatform.net/stream/<token>`.
 *
 * ## Por que um proxy, e não a URL direta
 *
 * O lado web precisa dos BYTES de faixas adaptativas para alimentar o
 * `MediaSource` (ver `shared/mse.js`) — e um `fetch()` direto ao googlevideo
 * falha por três motivos independentes, cada um suficiente sozinho:
 *
 * 1. **CORS.** O googlevideo não manda `Access-Control-Allow-Origin`, então o
 *    `fetch` do WebView nunca enxerga a resposta. É o mesmo muro que obrigava o
 *    caminho antigo do Cobalt a usar um túnel.
 * 2. **User-Agent.** Uma URL emitida para um cliente é servida a quem se anuncia
 *    como ele. O WebView manda o UA dele (um Chrome de Android) e a faixa do
 *    visionOS responde 403 — foi exatamente esse desencontro que custou sete
 *    versões até a v1.49.
 * 3. **A invariante 2.** O WebView RECUSA navegar/buscar fora do origin do app,
 *    e afrouxar isso é a última coisa que este projeto pode fazer.
 *
 * Passando por aqui, os três somem de uma vez: é o mesmo origin, o UA é o certo
 * e a invariante fica de pé.
 *
 * ## A FAIXA VIAJA NA URL, e essa é a regra que não pode cair (v1.55)
 *
 * O contrato do `shouldInterceptRequest` **não é** "devolva o que pediram": o
 * `InputStream` devolvido é lido pelo Chromium como **o recurso INTEIRO a
 * partir do byte 0**, e é o próprio WebView quem aplica o `Range` da
 * requisição em cima dele — `AndroidStreamReaderURLLoader::Start` chama
 * `ParseRange(resource_request_.headers)` incondicionalmente e manda
 * `InputStreamReader::Seek` pular `first_byte_position()` bytes do nosso
 * stream, conferindo antes com `available()`.
 *
 * Devolver só a fatia pedida, como esta classe fazia até a v1.54, faz o
 * deslocamento ser aplicado DUAS vezes:
 *
 * | faixa pedida | o que acontecia | o que o operador via |
 * |---|---|---|
 * | `bytes=0-739` (init) | pular 0 é no-op | funcionava — e escondia o resto |
 * | `bytes=A-B` com `A ≥ tamanho da fatia` | `ComputeBounds` reprova → `ERR_FAILED` **sem status** | "índice vídeo: a requisição não completou (Failed to fetch)" |
 * | `bytes=A-B` com `A < tamanho da fatia` | pula A DENTRO da fatia e entrega bytes do offset absoluto `2A` | pior: `fetch` resolve e o vídeo simplesmente não toca |
 *
 * Ou seja: só a primeira requisição de cada faixa podia funcionar, sempre — e
 * todo fragmento de mídia começa a megabytes do início do arquivo. Não existe
 * versão disto que funcione com a faixa viajando no CABEÇALHO.
 *
 * A correção é sair do contrato em vez de emulá-lo: o `shared/mse.js` do shell
 * 27 em diante pede `/stream/<token>?r=<ini>-<fim>` **sem cabeçalho `Range`
 * nenhum**. Sem cabeçalho, `ParseRange` não acha nada, o seek não acontece, e a
 * fatia sai inteira e correta. A resposta é um **200 seco**: nada de 206, de
 * `Content-Range` ou de `Accept-Ranges` — anunciar suporte a faixa nesta URL é
 * o oposto do que este caminho quer, e o `Content-Length` quem escreve é o
 * loader, a partir do `available()` do nosso array.
 *
 * O caminho do CABEÇALHO continua atendido (um bundle web antigo num shell
 * novo — a janela entre instalar o APK e o OTA chegar), mas embrulhado em
 * [FatiaComoTodo]: o stream mente o tamanho total e absorve o primeiro `skip`,
 * de modo que a maquinaria de faixa do próprio WebView produza o resultado
 * certo em vez do dobro do deslocamento.
 *
 * ## Por que isto NÃO é um `PathHandler`
 *
 * O `WebViewAssetLoader.PathHandler` recebe só o CAMINHO (`handle(path)`) — os
 * cabeçalhos da requisição não chegam lá, e sem eles o ramo de compatibilidade
 * acima seria impossível. Daí este objeto ser chamado de dentro do
 * `shouldInterceptRequest`, que recebe o [WebResourceRequest] completo, ANTES
 * de o asset loader ver a URL. (A query `?r=` sozinha caberia num
 * `PathHandler`; o `Range` do bundle antigo, não.)
 *
 * ## O que ele NÃO faz
 *
 * Não interpreta mídia, não decide qualidade e não guarda nada em disco: é um
 * cano. Quem escolhe as faixas é o [YoutubeGrab] (a mesma fila de candidatos do
 * download), e quem as monta em vídeo é o `MediaSource` do lado web.
 */
object StreamProxy {

    private const val TAG = "StreamProxy"

    /** O prefixo do caminho servido aqui. */
    const val ROTA = "/stream/"

    private const val CONECTA_MS = 15_000
    private const val LE_MS = 30_000

    /**
     * Token opaco → URL do googlevideo.
     *
     * As mesmas três razões do `SafRegistry`, e uma quarta que só existe aqui:
     *
     * - **Opaco**, e não a URL codificada: uma URL do googlevideo tem centenas
     *   de caracteres e barras dentro dos parâmetros, e o caminho chega
     *   DECODIFICADO ao interceptador.
     * - **Aleatório** (128 bits, `SecureRandom`), não um contador: um contador é
     *   adivinhável por construção.
     * - **Sem expiração própria.** A URL do googlevideo já expira sozinha (algumas
     *   horas), e é ela que manda: um token vivo apontando para uma URL morta
     *   falha com o 403 do próprio YouTube, que é a informação certa.
     * - **Reaproveita a mesma URL.** Um `load` do Controle e outro do Display
     *   pedem a mesma faixa; sem isso, cada projeção acrescentaria duas entradas
     *   novas num processo mantido vivo durante todo o culto.
     */
    private val porToken = ConcurrentHashMap<String, String>()
    private val porUrl = ConcurrentHashMap<String, String>()
    private val random = SecureRandom()

    fun registrar(url: String): String {
        porUrl[url]?.let { return it }
        val bytes = ByteArray(16)
        random.nextBytes(bytes)
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        porToken[token] = url
        porUrl[url] = token
        return token
    }

    /** A URL servível desta faixa, no origin do app. */
    fun urlFor(url: String): String = WebViewFactory.ORIGIN + ROTA + registrar(url)

    /**
     * Atende a requisição se ela for nossa; `null` deixa o asset loader seguir.
     *
     * **BLOQUEANTE** — roda na thread de carregamento de recursos do WebView,
     * que é exatamente onde um `PathHandler` também rodaria.
     */
    fun tryHandle(request: WebResourceRequest): WebResourceResponse? {
        val u = request.url
        // Pelo COMPONENTE do Uri, nunca por prefixo de string — a mesma regra da
        // invariante 2: `appassets.androidplatform.net.evil.com` começa com o
        // origin e é um domínio que qualquer um registra.
        if (u.scheme != "https" || u.host != WebViewFactory.ORIGIN_HOST) return null
        val caminho = u.path ?: return null
        if (!caminho.startsWith(ROTA)) return null
        val token = caminho.removePrefix(ROTA).trim('/')

        // O DESLOCAMENTO QUE O WEBVIEW VAI PULAR sozinho, e ele depende só do
        // CABEÇALHO — é `ParseRange(resource_request_.headers)` lá dentro que
        // decide, não a nossa query. Zero quando não há cabeçalho nenhum, que é
        // o caminho novo. Vale para TODA resposta, inclusive as de erro: um
        // corpo vazio com deslocamento > 0 é reprovado pelo `ComputeBounds`
        // (`size == 0` → false) e vira erro de rede SEM STATUS — foi assim que
        // toda a tabela de mensagens da v5.125 (404/403/502) ficou
        // indeliverável para qualquer requisição que não fosse a primeira, e a
        // investigação da v1.54 leu esse silêncio como "não é o CDN nem o
        // token".
        val cabecalho = rangeDoCabecalho(request)
        val fantasma = inicioDe(cabecalho)

        val naQuery = try { u.getQueryParameter("r") } catch (_: Exception) { null }
        // 400 = A FAIXA PEDIDA NÃO PRESTA. É um quarto caso, e por isso um
        // código próprio: 404 é token desconhecido, 502 é o proxy falhando com
        // o CDN, e o código do YouTube é repassado como está. Validar não é
        // preciosismo — este valor vira o `Range` enviado ao googlevideo.
        val daQuery = naQuery?.let { faixaDaQuery(it) ?: return erro(400, "faixa invalida: $it", fantasma) }

        // 404 = TOKEN DESCONHECIDO, e só isso. A distinção importa para quem lê
        // o log: um 404 aqui significa que o proxy foi alcançado e não achou o
        // token (registro velho, processo reiniciado), enquanto um 404 vindo do
        // asset loader significaria que o proxy nem foi consultado. Se os dois
        // saíssem com o mesmo código, a leitura apontaria para o lugar errado.
        val alvo = porToken[token] ?: return erro(404, "token desconhecido", fantasma)
        return try {
            val faixa = daQuery?.let { "bytes=${it.first}-${it.second}" } ?: cabecalho
            abrir(alvo, faixa, daQuery != null, fantasma)
        } catch (e: Throwable) {
            // `Throwable`, e não `Exception`: um `Error` (OutOfMemoryError num
            // pedaço grande, por exemplo) escaparia daqui pela thread de
            // recursos do WebView e chegaria ao lado web como mais um erro de
            // rede sem status — exatamente a forma de falha que este arquivo
            // inteiro existe para eliminar.
            Log.w(TAG, "falhou servindo $token", e)
            // 502 = O PROXY FALHOU FALANDO COM O CDN (DNS, timeout, TLS). Antes
            // isto virava 404 junto com o caso acima, e aí o log dizia "não
            // achei" para uma falha de REDE — a leitura mais enganosa possível,
            // porque manda procurar o defeito no roteamento.
            erro(502, redigir(e), fantasma)
        }
    }

    /**
     * O `Range` da requisição, procurado SEM CAIXA.
     *
     * O mapa do [WebResourceRequest] é sensível à caixa e o Fetch normaliza
     * nomes de cabeçalho para minúsculas. Hoje `get("Range")` funciona (o init
     * do bundle antigo prova), mas o modo de falhar seria mudo: sem enxergar o
     * cabeçalho, [conectar] pediria `bytes=0-` e a faixa de 1080p inteira
     * estouraria o teto de 24 MB.
     */
    private fun rangeDoCabecalho(request: WebResourceRequest): String? =
        request.requestHeaders?.entries?.firstOrNull { it.key.equals("Range", true) }?.value

    /** O primeiro byte de um `bytes=A-B`; 0 quando não há faixa ou ela não presta. */
    private fun inicioDe(range: String?): Long {
        val bruto = range?.substringAfter("bytes=", "")?.substringBefore('-')?.trim().orEmpty()
        return bruto.toLongOrNull()?.coerceAtLeast(0) ?: 0
    }

    /** `?r=<ini>-<fim>` → o par, ou `null` se estiver malformado ou for grande demais. */
    private fun faixaDaQuery(r: String): Pair<Long, Long>? {
        val m = FAIXA.matchEntire(r.trim()) ?: return null
        val ini = m.groupValues[1].toLongOrNull() ?: return null
        val fim = m.groupValues[2].toLongOrNull() ?: return null
        if (fim < ini) return null
        if (fim - ini + 1 > TETO_PEDACO) return null
        return ini to fim
    }

    private val FAIXA = Regex("""(\d{1,15})-(\d{1,15})""")

    /**
     * O texto de uma exceção, sem a URL do googlevideo e sem acento.
     *
     * Duas razões independentes, e as duas doem em produção:
     *
     * - A mensagem vai parar no Registro que o operador COPIA e repassa, e uma
     *   URL assinada do googlevideo não tem por que viajar junto.
     * - `WebResourceResponse` **lança `IllegalArgumentException`** para qualquer
     *   caractere fora de `0x20..0x7E` na razão HTTP. `IOException("pedaço acima
     *   de 24 MB")` tem cedilha: estourar o teto não produzia um 502 legível,
     *   produzia uma segunda exceção de dentro do `catch`.
     */
    private fun redigir(e: Throwable): String =
        (e.message ?: e.javaClass.simpleName).replace(Regex("""https?://\S+"""), "<url>")

    private fun ascii(s: String): String =
        s.map { if (it.code in 0x20..0x7e) it else '?' }.joinToString("").take(120)

    /**
     * Uma resposta de erro cujo MOTIVO viaja na razão HTTP.
     *
     * O lado web a lê em `response.statusText` e a escreve no Registro, então
     * uma falha de rede chega ao operador com o texto da exceção em vez de um
     * número solto.
     */
    private fun erro(codigo: Int, razao: String, fantasma: Long = 0): WebResourceResponse {
        val texto = ascii(razao).ifBlank { "erro" }
        // CORPO NÃO VAZIO, e isso é conserto e não enfeite: com `available() ==
        // 0` e um `Range` fora do zero, o `ComputeBounds` do WebView reprova
        // antes de qualquer cabeçalho ser montado e a resposta inteira vira um
        // erro de rede sem status. Um erro que não chega é igual a erro nenhum.
        val corpo = texto.toByteArray(Charsets.US_ASCII)
        return WebResourceResponse(
            "text/plain",
            "utf-8",
            codigo,
            texto,
            mapOf("Cache-Control" to "no-store"),
            corpoServivel(corpo, fantasma),
        )
    }

    /** O corpo pronto para o que o WebView vai fazer com ele (ver [FatiaComoTodo]). */
    private fun corpoServivel(corpo: ByteArray, fantasma: Long): InputStream =
        if (fantasma > 0) FatiaComoTodo(corpo, fantasma) else java.io.ByteArrayInputStream(corpo)

    private fun abrir(
        alvo: String,
        range: String?,
        daQuery: Boolean,
        fantasma: Long,
    ): WebResourceResponse =
        conectar(alvo, range).let { conn ->
            // `use` não serve num `HttpURLConnection` (ele não é Closeable), daí
            // o try/finally explícito: a conexão morre com este método, sempre.
            try { responder(conn, daQuery, fantasma) } finally { conn.disconnect() }
        }

    private fun conectar(alvo: String, range: String?): HttpURLConnection {
        val conn = (URL(alvo).openConnection() as HttpURLConnection).apply {
            connectTimeout = CONECTA_MS
            readTimeout = LE_MS
            instanceFollowRedirects = true
            // O UA QUE COMBINA COM A URL. É a mesma leitura do `c=` que o
            // download faz (ver `YoutubeGrab.baixarTentando`), e pela mesma
            // razão: pedir uma faixa do visionOS anunciando um Chrome de
            // Android é o caminho conhecido para um 403.
            setRequestProperty("User-Agent", YoutubeGrab.uaPara(alvo))
            // O `Range` do PLAYER, repassado como veio. Quando ele não manda
            // nenhum (o primeiro toque de alguns players), pedimos a partir do
            // byte zero: as URLs adaptativas do googlevideo costumam recusar
            // quem não pede faixa.
            setRequestProperty("Range", range ?: "bytes=0-")
        }
        return conn
    }

    private fun responder(
        conn: HttpURLConnection,
        daQuery: Boolean,
        fantasma: Long,
    ): WebResourceResponse {
        val codigo = conn.responseCode
        if (codigo >= 400) {
            // O código do YouTube é repassado COMO ESTÁ, e isso é deliberado: um
            // 403 aqui significa URL expirada ou faixa recusada, e é o lado web
            // que sabe o que fazer com essa distinção (pedir um manifesto novo,
            // ou cair no player embutido). Traduzir tudo para "não achei"
            // apagaria justamente o que diferencia os dois casos.
            return erro(codigo, "googlevideo: " + (conn.responseMessage ?: "?"), fantasma)
        }
        val mime = conn.contentType?.substringBefore(';')?.trim().orEmpty()
            .ifEmpty { "application/octet-stream" }
        val faixaRespondida = conn.getHeaderField("Content-Range")
        // OS BYTES SÃO LIDOS AQUI, INTEIROS, e não entregues como um fluxo vivo.
        //
        // ATENÇÃO À HISTÓRIA, porque ela já enganou uma rodada inteira: a v1.54
        // fez esta mudança acreditando que ela consertaria o "Failed to fetch"
        // da segunda requisição. NÃO CONSERTOU — a causa era o refatiamento do
        // WebView (ver o KDoc do arquivo), e o socket estava a montante dela. A
        // mudança trocou o RAMO da falha sem trocar o desfecho: `available()` de
        // um socket costuma ser 0 e reprovava no `SkipToRequestedRange`; o de um
        // `ByteArrayInputStream` é o tamanho da fatia e passou a reprovar no
        // `ComputeBounds`.
        //
        // Ela fica porque é certa por si — ler aqui deixa três coisas garantidas:
        //
        // - **A conexão fecha quando este método termina**, sempre, no
        //   `finally`. Nenhum socket meio-lido volta para a piscina do
        //   `HttpURLConnection` para atrapalhar o pedido seguinte.
        // - **O corpo é um array**, e não um fluxo que pode acabar no meio: é
        //   isso que faz o `available()` do stream devolvido bater com o que
        //   existe de verdade — e o `available()` é justamente o número que o
        //   WebView usa para decidir se atende a faixa.
        // - **Todo erro de IO vira um 502 com texto** (ver o `catch` de
        //   [tryHandle]), em vez de um "Failed to fetch" opaco do outro lado.
        //
        // O custo é a memória de UM pedaço, e ele é pequeno por construção: o
        // player pede o init (centenas de bytes), o índice (poucos kB) e um
        // fragmento por vez. Não há caminho em que isto segure um vídeo inteiro.
        val corpo = conn.inputStream.use { it.readBytes(TETO_PEDACO) }

        // CAMINHO NOVO (faixa na query, shell 27+): um 200 SECO.
        //
        // Sem `Content-Range` — ninguém o lê: o caminho de intercepção do
        // Chromium não tem uma única ocorrência de 206/Partial/Content-Range, e
        // o `mse.js` aceita 200 de propósito desde a v5.120. Sem
        // `Accept-Ranges` — anunciar suporte a faixa nesta URL é o oposto do que
        // este caminho quer. E sem `Content-Length` NOSSO: o loader escreve o
        // dele a partir do `available()` do array (com `SetHeader`), e o nosso
        // entraria depois com `AddHeader` — hoje saem DOIS `Content-Length` na
        // resposta do init, coincidindo por acaso.
        if (daQuery && fantasma == 0L) {
            return WebResourceResponse(
                mime,
                null,
                200,
                "OK",
                mapOf("Cache-Control" to "no-store"),
                java.io.ByteArrayInputStream(corpo),
            )
        }

        // CAMINHO DE COMPATIBILIDADE (a faixa veio no cabeçalho): o WebView VAI
        // pular `fantasma` bytes deste stream, então ele precisa se comportar
        // como o recurso inteiro — ver [FatiaComoTodo].
        val cabecalhos = mutableMapOf(
            "Cache-Control" to "no-store",
            "Accept-Ranges" to "bytes",
        )
        // `Content-Range` REPASSADO: é por ele que um consumidor fora do WebView
        // (o navegador, onde este ramo é o único que existe) sabe que recebeu a
        // faixa que pediu.
        faixaRespondida?.let { cabecalhos["Content-Range"] = it }
        return WebResourceResponse(
            mime,
            null,
            codigo,
            if (codigo == 206) "Partial Content" else "OK",
            cabecalhos,
            corpoServivel(corpo, fantasma),
        )
    }

    /**
     * Uma FATIA que se comporta como o recurso INTEIRO a partir do byte 0.
     *
     * Existe só para o ramo de compatibilidade: quando a requisição traz um
     * cabeçalho `Range`, o Chromium do WebView pula `first_byte_position()`
     * bytes do stream que devolvemos, conferindo antes com `available()`. Como
     * os nossos bytes JÁ começam nesse ponto, o deslocamento sairia aplicado
     * duas vezes.
     *
     * A saída é mentir exatamente o necessário: [available] soma o prefixo que
     * não existe, [skip] o absorve, e a primeira leitura real o zera — assim, se
     * um dia o WebView deixar de refatiar, a fatia sai crua e correta em vez de
     * curta.
     *
     * `Int` no [available] porque a assinatura é essa (e o Chromium a lê como
     * `int32`): saturar é o comportamento certo, um teto de ~2 GiB não muda
     * nada aqui, onde cada pedaço tem no máximo [TETO_PEDACO].
     */
    private class FatiaComoTodo(
        private val corpo: ByteArray,
        deslocamento: Long,
    ) : InputStream() {
        private var fantasma = deslocamento.coerceAtLeast(0)
        private var pos = 0

        override fun available(): Int =
            (fantasma + (corpo.size - pos)).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()

        override fun skip(n: Long): Long {
            if (n <= 0) return 0
            if (fantasma > 0) {
                val k = minOf(n, fantasma)
                fantasma -= k
                return k
            }
            val k = minOf(n, (corpo.size - pos).toLong())
            pos += k.toInt()
            return k
        }

        override fun read(): Int {
            fantasma = 0
            return if (pos < corpo.size) corpo[pos++].toInt() and 0xff else -1
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            fantasma = 0
            if (pos >= corpo.size) return -1
            val n = minOf(len, corpo.size - pos)
            System.arraycopy(corpo, pos, b, off, n)
            pos += n
            return n
        }
    }

    /**
     * Teto de um pedaço lido de uma vez.
     *
     * Ele não existe para economizar memória — o player pede fragmentos de
     * alguns kB a alguns MB. Existe como TRAVA: se algum dia alguém apontar
     * este proxy para uma requisição sem `Range` (ou com faixa aberta), sem o
     * teto ele carregaria um vídeo inteiro na memória do processo que também
     * hospeda os dois WebViews e a `Presentation`. Estourá-lo é uma exceção,
     * que vira um 502 legível — e não um OOM no meio do culto.
     */
    private const val TETO_PEDACO = 24 * 1024 * 1024

    /**
     * Lê o fluxo até o fim, recusando passar de [limite].
     *
     * `readBytes()` da biblioteca padrão não tem teto: é justamente o que esta
     * versão evita.
     */
    private fun InputStream.readBytes(limite: Int): ByteArray {
        val saida = java.io.ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = read(buf)
            if (n < 0) break
            if (saida.size() + n > limite) {
                throw java.io.IOException("pedaço acima de ${limite / (1024 * 1024)} MB")
            }
            saida.write(buf, 0, n)
        }
        return saida.toByteArray()
    }
}
