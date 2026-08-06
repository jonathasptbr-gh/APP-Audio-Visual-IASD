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
 * ## Range é o ponto, e é por isso que isto NÃO é um `PathHandler`
 *
 * O `WebViewAssetLoader.PathHandler` recebe só o CAMINHO (`handle(path)`) — os
 * cabeçalhos da requisição não chegam lá. E o MSE é feito de requisições por
 * FAIXA DE BYTES: o segmento de inicialização, o índice, cada trecho de mídia.
 * Sem repassar o `Range`, cada pedido traria o arquivo inteiro e o player
 * baixaria centenas de MB para usar 200 kB.
 *
 * Daí este objeto ser chamado de dentro do `shouldInterceptRequest`, que recebe
 * o [WebResourceRequest] completo, ANTES de o asset loader ver a URL.
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
        // 404 = TOKEN DESCONHECIDO, e só isso. A distinção importa para quem lê
        // o log: um 404 aqui significa que o proxy foi alcançado e não achou o
        // token (registro velho, processo reiniciado), enquanto um 404 vindo do
        // asset loader significaria que o proxy nem foi consultado. Se os dois
        // saíssem com o mesmo código, a leitura apontaria para o lugar errado.
        val alvo = porToken[token] ?: return erro(404, "token desconhecido")
        return try {
            abrir(alvo, request.requestHeaders?.get("Range"))
        } catch (e: Exception) {
            Log.w(TAG, "falhou servindo $token", e)
            // 502 = O PROXY FALHOU FALANDO COM O CDN (DNS, timeout, TLS). Antes
            // isto virava 404 junto com o caso acima, e aí o log dizia "não
            // achei" para uma falha de REDE — a leitura mais enganosa possível,
            // porque manda procurar o defeito no roteamento.
            erro(502, (e.message ?: e.javaClass.simpleName).take(120))
        }
    }

    /**
     * Uma resposta de erro cujo MOTIVO viaja na razão HTTP.
     *
     * O lado web a lê em `response.statusText` e a escreve no Registro, então
     * uma falha de rede chega ao operador com o texto da exceção em vez de um
     * número solto.
     */
    private fun erro(codigo: Int, razao: String): WebResourceResponse = WebResourceResponse(
        "text/plain",
        "utf-8",
        codigo,
        razao.ifBlank { "erro" },
        mapOf("Cache-Control" to "no-store"),
        java.io.ByteArrayInputStream(ByteArray(0)),
    )

    private fun abrir(alvo: String, range: String?): WebResourceResponse =
        conectar(alvo, range).let { conn ->
            // `use` não serve num `HttpURLConnection` (ele não é Closeable), daí
            // o try/finally explícito: a conexão morre com este método, sempre.
            try { responder(conn) } finally { conn.disconnect() }
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

    private fun responder(conn: HttpURLConnection): WebResourceResponse {
        val codigo = conn.responseCode
        if (codigo >= 400) {
            // O código do YouTube é repassado COMO ESTÁ, e isso é deliberado: um
            // 403 aqui significa URL expirada ou faixa recusada, e é o lado web
            // que sabe o que fazer com essa distinção (pedir um manifesto novo,
            // ou cair no player embutido). Traduzir tudo para "não achei"
            // apagaria justamente o que diferencia os dois casos.
            return erro(codigo, "googlevideo: " + (conn.responseMessage ?: "?"))
        }
        val mime = conn.contentType?.substringBefore(';')?.trim().orEmpty()
            .ifEmpty { "application/octet-stream" }
        val faixaRespondida = conn.getHeaderField("Content-Range")
        // OS BYTES SÃO LIDOS AQUI, INTEIROS, e não entregues como um fluxo vivo.
        //
        // A primeira versão devolvia o `conn.inputStream` embrulhado, com a
        // conexão sendo solta no `close()` — ou seja, o WebView virava dono do
        // socket por tempo indeterminado. Em aparelho, a PRIMEIRA requisição
        // (o segmento de inicialização) passava e a SEGUNDA (o índice) morria
        // com "Failed to fetch": sem status, sem exceção do nosso lado, sem
        // nada para diagnosticar — porque a falha acontecia depois de este
        // método já ter retornado.
        //
        // Lendo aqui, três coisas ficam certas de uma vez:
        //
        // - **A conexão fecha quando este método termina**, sempre, no
        //   `finally`. Nenhum socket meio-lido volta para a piscina do
        //   `HttpURLConnection` para atrapalhar o pedido seguinte.
        // - **O `Content-Length` é exatamente o corpo entregue**, porque é o
        //   mesmo array. Um cabeçalho que discorde do corpo é uma das formas de
        //   o WebView abortar a resposta sem explicar.
        // - **Todo erro de IO vira um 502 com texto** (ver o `catch` de
        //   [tryHandle]), em vez de um "Failed to fetch" opaco do outro lado.
        //
        // O custo é a memória de UM pedaço, e ele é pequeno por construção: o
        // player pede o init (centenas de bytes), o índice (poucos kB) e um
        // fragmento por vez. Não há caminho em que isto segure um vídeo inteiro.
        val corpo = conn.inputStream.use { it.readBytes(TETO_PEDACO) }
        val cabecalhos = mutableMapOf(
            "Cache-Control" to "no-store",
            "Accept-Ranges" to "bytes",
            "Content-Length" to corpo.size.toString(),
        )
        // `Content-Range` REPASSADO: é por ele que o `fetch` do lado web sabe
        // que recebeu a faixa que pediu.
        faixaRespondida?.let { cabecalhos["Content-Range"] = it }
        return WebResourceResponse(
            mime,
            null,
            codigo,
            if (codigo == 206) "Partial Content" else "OK",
            cabecalhos,
            java.io.ByteArrayInputStream(corpo),
        )
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
