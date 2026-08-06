package br.org.iasd.av

import android.util.Log
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Um pedido DIRETO à API interna do YouTube (`youtubei/v1/player`), pedindo as
 * faixas como um cliente que **não exige PO Token**.
 *
 * ## Por que isto existe
 *
 * Medido neste aparelho, as faixas adaptativas que a biblioteca entrega são
 * listadas e o CDN responde **403** a todas — com os dois contêineres, os dois
 * perfis de UA e com `Range`. É o portão do PO Token, e ele fecha justamente o
 * que interessa: 1080p e o áudio puro moram lá.
 *
 * Montar o token exigiria rodar o BotGuard do Google num WebView, que é uma
 * empreitada permanente. **Este arquivo é a alternativa barata**: alguns
 * clientes do YouTube (os de dispositivo, como o do Quest e o de TV) recebem
 * URLs já assinadas, sem token e sem decifrar assinatura. Se um deles responder,
 * o 1080p sai por aqui e o BotGuard fica onde está.
 *
 * ## O que ele NÃO é
 *
 * Não substitui o `NewPipeExtractor`. Busca, títulos, idioma e todo o resto
 * continuam com a biblioteca — é ela que absorve as mudanças do YouTube, e esse
 * é o motivo de ela existir no projeto. Aqui há **um** pedido, de um formato
 * estável há anos, e o resultado é sempre opcional: falhando qualquer coisa,
 * quem chamou segue com o que já tinha.
 *
 * ## O risco, dito na cara
 *
 * Isto é superfície que passa a ser NOSSA. Um cliente pode ser fechado sem
 * aviso, e nesse dia o download volta ao progressivo — não quebra o app, mas
 * também não avisa ninguém além do diagnóstico do rodapé de Configurações. É
 * por isso que ele é a ÚLTIMA fonte tentada, nunca a primeira: o caminho que
 * funciona hoje não depende de nada disto.
 */
object InnerTube {

    private const val TAG = "InnerTube"

    private const val PLAYER = "https://www.youtube.com/youtubei/v1/player"

    /** A chave pública do InnerTube, a mesma que a página do YouTube usa. */
    private const val KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"

    private const val CONECTA_MS = 15_000
    private const val LE_MS = 20_000

    /**
     * Os clientes tentados, em ordem. Cada um traz o corpo do pedido e o
     * `User-Agent` que combina com ele — uma URL emitida para um cliente
     * costuma ser servida só a quem se anuncia como ele.
     *
     * **ANDROID_VR** (o app do YouTube no Quest) é o primeiro porque é o que a
     * comunidade de ferramentas de download aponta como o que ainda entrega
     * faixas adaptativas sem token. **TVHTML5** vem em seguida, pelo mesmo
     * motivo e por ser o mais antigo dos dois.
     *
     * Se os dois forem fechados, o app não perde nada: volta a ser o que é hoje.
     */
    private val CLIENTES = listOf(
        Cliente(
            nome = "vr",
            ua = "com.google.android.apps.youtube.vr.oculus/1.60.19 " +
                "(Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
            contexto = """
                {"client":{"clientName":"ANDROID_VR","clientVersion":"1.60.19",
                "deviceMake":"Oculus","deviceModel":"Quest 3","androidSdkVersion":32,
                "osName":"Android","osVersion":"12L","hl":"pt","gl":"BR"}}
            """.trimIndent().replace("\n", ""),
        ),
        Cliente(
            nome = "tv",
            ua = "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
            contexto = """
                {"client":{"clientName":"TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                "clientVersion":"2.0","clientScreen":"EMBED","hl":"pt","gl":"BR"},
                "thirdParty":{"embedUrl":"https://www.youtube.com"}}
            """.trimIndent().replace("\n", ""),
        ),
    )

    private class Cliente(val nome: String, val ua: String, val contexto: String)

    /**
     * Uma faixa utilizável: já com URL direta, sem assinatura a decifrar.
     *
     * `ext` é o contêiner ("mp4" ou "webm") e é o que decide com quem ela pode
     * ser pareada — ver `MuxMp4`.
     */
    class Faixa(
        val url: String,
        val ext: String,
        val altura: Int,
        val audio: Boolean,
        val ua: String,
        val cliente: String,
    )

    /** O resultado de uma consulta: as faixas e uma linha de diagnóstico. */
    class Resposta(val faixas: List<Faixa>, val log: String)

    /**
     * Consulta os clientes em ordem e devolve as faixas do PRIMEIRO que
     * responder com alguma coisa utilizável.
     *
     * **BLOQUEANTE** — fila de IO, como todo o resto do [YoutubeGrab].
     */
    fun faixas(videoId: String): Resposta {
        val notas = StringBuilder()
        for (c in CLIENTES) {
            try {
                val json = pedir(c, videoId)
                val estado = json.optJSONObject("playabilityStatus")?.optString("status").orEmpty()
                val lista = extrair(json, c)
                if (lista.isEmpty()) {
                    // O `status` explica a maioria dos vazios: LOGIN_REQUIRED,
                    // UNPLAYABLE, AGE_VERIFICATION_REQUIRED. Sem ele, "0 faixas"
                    // seria mais um zero mudo — o mesmo defeito que o
                    // diagnóstico do YouTube já teve uma vez.
                    notas.append(" · ${c.nome}: 0")
                        .append(if (estado.isNotEmpty() && estado != "OK") " ($estado)" else "")
                    continue
                }
                val maior = lista.filter { !it.audio }.maxOfOrNull { it.altura } ?: 0
                notas.append(" · ${c.nome}: ${lista.size}")
                    .append(if (maior > 0) " (${maior}p)" else "")
                return Resposta(lista, notas.toString())
            } catch (e: Exception) {
                Log.w(TAG, "cliente ${c.nome} falhou", e)
                notas.append(" · ${c.nome}: ").append(e.message ?: e.javaClass.simpleName)
            }
        }
        return Resposta(emptyList(), notas.toString())
    }

    private fun pedir(c: Cliente, videoId: String): JSONObject {
        val corpo = """{"context":${c.contexto},"videoId":"$videoId",""" +
            """"contentCheckOk":true,"racyCheckOk":true}"""
        val conn = (URL("$PLAYER?key=$KEY&prettyPrint=false").openConnection() as HttpURLConnection)
            .apply {
                requestMethod = "POST"
                connectTimeout = CONECTA_MS
                readTimeout = LE_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("User-Agent", c.ua)
                setRequestProperty("Accept-Language", "pt-BR,pt;q=0.9")
            }
        try {
            val bytes = corpo.toByteArray(Charsets.UTF_8)
            conn.setFixedLengthStreamingMode(bytes.size)
            conn.outputStream.use { it.write(bytes) }
            val codigo = conn.responseCode
            if (codigo != HttpURLConnection.HTTP_OK) throw IOException("HTTP $codigo")
            val texto = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            return JSONObject(texto)
        } finally {
            conn.disconnect()
        }
    }

    /**
     * As faixas adaptativas com **URL direta**.
     *
     * Um formato que venha com `signatureCipher` em vez de `url` fica de fora:
     * decifrar a assinatura exige interpretar o JavaScript do player, que é
     * exatamente o trabalho que a biblioteca faz e que este atalho não pretende
     * refazer. Se o cliente escolhido só devolver formatos cifrados, ele não
     * serve — e é melhor descobrir isso aqui do que na hora do download.
     */
    private fun extrair(json: JSONObject, c: Cliente): List<Faixa> {
        val out = mutableListOf<Faixa>()
        val dados = json.optJSONObject("streamingData") ?: return out
        val arr = dados.optJSONArray("adaptiveFormats") ?: return out
        for (i in 0 until arr.length()) {
            val f = arr.optJSONObject(i) ?: continue
            val url = f.optString("url")
            if (url.isNullOrBlank()) continue
            val mime = f.optString("mimeType").orEmpty()
            val audio = mime.startsWith("audio/")
            val ext = when {
                mime.contains("mp4") -> "mp4"
                mime.contains("webm") -> "webm"
                else -> continue
            }
            out += Faixa(
                url = url,
                // O áudio em contêiner mp4 é o m4a, que é como o resto do app o
                // chama — o nome tem de bater com o que o muxer e o cache
                // esperam.
                ext = if (audio && ext == "mp4") "m4a" else ext,
                altura = f.optInt("height", 0),
                audio = audio,
                ua = c.ua,
                cliente = c.nome,
            )
        }
        return out
    }
}
