package br.org.iasd.av

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InputStream

/**
 * O oráculo do [EspelhoHttp] — o parser que encara a rede.
 *
 * Este arquivo é metade da justificativa da QUARTA EXCEÇÃO à regra de zero
 * dependência (o JUnit; ver `app/build.gradle.kts`). O outro lado do argumento
 * está escrito no KDoc do próprio [EspelhoHttp]: o documento que desenhou o
 * espelho recusou o RFC 6455 por ser "protocolo sem oráculo", e um parser HTTP
 * com controle de acesso é exatamente a mesma coisa. Ou o parser tem teste, ou o
 * argumento se aplica contra ele.
 *
 * O que cada bloco protege está dito no nome do caso e no comentário — e há três
 * que valem por todos os outros: [leituraGotejandoUmByteDaOMesmoResultado] (o
 * `read()` parcial, que só falharia com a rede ruim, no domingo),
 * [oQuatrocentosEQuatroEIdenticoNosQuatroCasos] (não vazar existência) e
 * [chunkVazioERecusado] (um chunk de tamanho zero ENCERRA o corpo, em silêncio,
 * para sempre).
 */
class EspelhoHttpTest {

    private val hosts = setOf("192.168.0.42:8787")

    // ------------------------------------------------------------- ferramentas

    /**
     * Um `InputStream` que entrega no máximo [porRead] bytes por chamada.
     *
     * É o instrumento do caso mais importante do arquivo: `read()` promete UM
     * byte, não a mensagem. Com [porRead] = 1 todo laço de leitura do parser é
     * exercitado no pior caso possível.
     */
    private class Gotejante(private val dados: ByteArray, private val porRead: Int) : InputStream() {
        private var pos = 0

        override fun read(): Int = if (pos >= dados.size) -1 else dados[pos++].toInt() and 0xFF

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (len == 0) return 0
            if (pos >= dados.size) return -1
            val n = minOf(len, porRead, dados.size - pos)
            System.arraycopy(dados, pos, b, off, n)
            pos += n
            return n
        }
    }

    /** Monta uma requisição crua. O corpo entra literal, sem `Content-Length`. */
    private fun cru(
        linha: String = "GET /v HTTP/1.1",
        cabecalhos: List<String> = listOf("Host: 192.168.0.42:8787"),
        corpo: String = "",
    ): String = (listOf(linha) + cabecalhos).joinToString("\r\n") + "\r\n\r\n" + corpo

    private fun ler(
        texto: String,
        aceitos: Set<String> = hosts,
        porRead: Int = Int.MAX_VALUE,
    ): Result<EspelhoHttp.Req> = EspelhoHttp.lerRequisicao(
        // ISO-8859-1 para que cada caractere do teste seja exatamente um byte no
        // fio, inclusive os de controle que os casos negativos injetam.
        Gotejante(texto.toByteArray(Charsets.ISO_8859_1), porRead),
        aceitos,
    )

    private fun passa(texto: String, aceitos: Set<String> = hosts): EspelhoHttp.Req =
        ler(texto, aceitos).getOrThrow()

    private fun falha(texto: String, aceitos: Set<String> = hosts): Throwable? =
        ler(texto, aceitos).exceptionOrNull()

    private fun texto(bytes: ByteArray): String = String(bytes, Charsets.ISO_8859_1)

    // ------------------------------------------------------------------ básico

    @Test
    fun getSimplesPassa() {
        val r = passa(
            cru(
                linha = "GET /v HTTP/1.1",
                cabecalhos = listOf(
                    "Host: 192.168.0.42:8787",
                    "Authorization: Bearer abc123",
                    "User-Agent: Mozilla/5.0",
                ),
            )
        )
        assertEquals("GET", r.metodo)
        assertEquals("/v", r.caminho)
        assertEquals("192.168.0.42:8787", r.host)
        assertEquals("Bearer abc123", r.autorizacao)
        assertEquals(null, r.origem)
        assertEquals(0, r.corpo.size)
    }

    @Test
    fun postComCorpoPassa() {
        val corpo = "{\"pin\":\"418302\"}"
        val r = passa(
            cru(
                linha = "POST /par HTTP/1.1",
                cabecalhos = listOf(
                    "Host: 192.168.0.42:8787",
                    "Origin: http://192.168.0.42:8787",
                    "Content-Type: application/json",
                    "Content-Length: ${corpo.length}",
                ),
                corpo = corpo,
            )
        )
        assertEquals("POST", r.metodo)
        assertEquals("/par", r.caminho)
        assertEquals(corpo, texto(r.corpo))
    }

    /**
     * A invariante 2, medida: byte a byte, o resultado tem de ser IDÊNTICO ao da
     * leitura de uma tacada só. Um parser que trate `read()` como "a mensagem
     * inteira" passa em toda bancada e desanda com a rede ruim — o pior modo de
     * falha possível, porque é o que só acontece no salão.
     */
    @Test
    fun leituraGotejandoUmByteDaOMesmoResultado() {
        val corpo = "{\"do\":\"alive\",\"telaAcesaMin\":18}"
        val bruto = cru(
            linha = "POST /r HTTP/1.1",
            cabecalhos = listOf(
                "Host: 192.168.0.42:8787",
                "Authorization: Bearer abc123",
                "Content-Length: ${corpo.length}",
            ),
            corpo = corpo,
        )
        val inteiro = ler(bruto).getOrThrow()
        for (porRead in intArrayOf(1, 2, 3, 7, 64)) {
            val picado = ler(bruto, porRead = porRead).getOrThrow()
            assertEquals(inteiro.metodo, picado.metodo)
            assertEquals(inteiro.caminho, picado.caminho)
            assertEquals(inteiro.host, picado.host)
            assertEquals(inteiro.autorizacao, picado.autorizacao)
            assertArrayEquals(inteiro.corpo, picado.corpo)
        }
    }

    // ------------------------------------------------------------------- tetos

    @Test
    fun linhaNoTetoPassa() {
        // "GET /" + recheio + " HTTP/1.1" = exatamente TETO_LINHA bytes.
        val recheio = "a".repeat(EspelhoHttp.TETO_LINHA - "GET / HTTP/1.1".length)
        val r = passa(cru(linha = "GET /$recheio HTTP/1.1"))
        assertEquals("/$recheio", r.caminho)
    }

    @Test
    fun linhaAcimaDoTetoRecusada() {
        val recheio = "a".repeat(EspelhoHttp.TETO_LINHA - "GET / HTTP/1.1".length + 1)
        assertSame(EspelhoHttp.Erro.LinhaLonga, falha(cru(linha = "GET /$recheio HTTP/1.1")))
    }

    @Test
    fun cabecalhoNoTetoPassa() {
        val valor = "a".repeat(EspelhoHttp.TETO_CABECALHO - "X-Cheio: ".length)
        passa(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "X-Cheio: $valor")))
    }

    @Test
    fun cabecalhoAcimaDoTetoRecusado() {
        val valor = "a".repeat(EspelhoHttp.TETO_CABECALHO - "X-Cheio: ".length + 1)
        assertSame(
            EspelhoHttp.Erro.CabecalhoLongo,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "X-Cheio: $valor"))),
        )
    }

    @Test
    fun cabecalhosNoTetoPassam() {
        // O `Host` conta: 1 + 31 = TETO_CABECALHOS.
        val lista = listOf("Host: 192.168.0.42:8787") +
            (1..EspelhoHttp.TETO_CABECALHOS - 1).map { "X-$it: v" }
        passa(cru(cabecalhos = lista))
    }

    @Test
    fun cabecalhosDemaisRecusados() {
        val lista = listOf("Host: 192.168.0.42:8787") +
            (1..EspelhoHttp.TETO_CABECALHOS).map { "X-$it: v" }
        assertSame(EspelhoHttp.Erro.CabecalhosDemais, falha(cru(cabecalhos = lista)))
    }

    @Test
    fun corpoNoTetoPassa() {
        val corpo = "b".repeat(EspelhoHttp.TETO_CORPO)
        val r = passa(
            cru(
                linha = "POST /par HTTP/1.1",
                cabecalhos = listOf("Host: 192.168.0.42:8787", "Content-Length: ${corpo.length}"),
                corpo = corpo,
            )
        )
        assertEquals(EspelhoHttp.TETO_CORPO, r.corpo.size)
    }

    /**
     * E o teto do corpo é conferido ANTES de ler um byte: a requisição anuncia
     * 4 MB e não manda nenhum. Se o parser lesse primeiro para reclamar depois,
     * este caso ficaria pendurado até o timeout do socket — que é justamente o
     * ataque de graça contra um servidor de uma thread por cliente.
     */
    @Test
    fun corpoAcimaDoTetoRecusadoSemLerOsBytes() {
        assertSame(
            EspelhoHttp.Erro.CorpoLongo,
            falha(
                cru(
                    linha = "POST /par HTTP/1.1",
                    cabecalhos = listOf("Host: 192.168.0.42:8787", "Content-Length: 4000000"),
                )
            ),
        )
    }

    // ----------------------------------------------------------- host e origin

    @Test
    fun hostForaDaAllowlistRecusado() {
        assertSame(
            EspelhoHttp.Erro.HostRecusado,
            falha(cru(cabecalhos = listOf("Host: evil.com"))),
        )
        // O caso do DNS rebinding: o endereço é o nosso, o NOME não é.
        assertSame(
            EspelhoHttp.Erro.HostRecusado,
            falha(cru(cabecalhos = listOf("Host: rebind.evil.com:8787"))),
        )
        // E nem localhost, nem a porta trocada.
        assertSame(
            EspelhoHttp.Erro.HostRecusado,
            falha(cru(cabecalhos = listOf("Host: localhost:8787"))),
        )
        assertSame(
            EspelhoHttp.Erro.HostRecusado,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8080"))),
        )
    }

    @Test
    fun hostAusenteRecusado() {
        assertSame(EspelhoHttp.Erro.HostRecusado, falha(cru(cabecalhos = listOf("X-Nada: 1"))))
    }

    @Test
    fun hostIgnoraCaixa() {
        passa(cru(cabecalhos = listOf("HOST: 192.168.0.42:8787")), setOf("192.168.0.42:8787"))
    }

    /** Falha segura: servidor que ainda não sabe onde subiu não atende ninguém. */
    @Test
    fun allowlistVaziaRecusaTudo() {
        assertSame(EspelhoHttp.Erro.HostRecusado, falha(cru(), emptySet()))
    }

    @Test
    fun origemPropriaPassa() {
        val r = passa(
            cru(
                cabecalhos = listOf(
                    "Host: 192.168.0.42:8787",
                    "Origin: http://192.168.0.42:8787",
                )
            )
        )
        assertEquals("http://192.168.0.42:8787", r.origem)
    }

    @Test
    fun origemAusentePassa() {
        // É o caso NORMAL: navegador não manda `Origin` em GET same-origin.
        assertEquals(null, passa(cru()).origem)
    }

    @Test
    fun origemEstranhaRecusada() {
        assertSame(
            EspelhoHttp.Erro.OrigemEstranha,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "Origin: http://evil.com"))),
        )
        // Prefixo que parece o nosso e não é — a armadilha do `startsWith` que o
        // CLAUDE.md documenta na invariante 2 do shell.
        assertSame(
            EspelhoHttp.Erro.OrigemEstranha,
            falha(
                cru(
                    cabecalhos = listOf(
                        "Host: 192.168.0.42:8787",
                        "Origin: http://192.168.0.42:8787.evil.com",
                    )
                )
            ),
        )
    }

    /** Origem opaca (iframe sandbox, `data:`): nenhum cliente legítimo tem uma. */
    @Test
    fun origemNulaRecusada() {
        assertSame(
            EspelhoHttp.Erro.OrigemEstranha,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "Origin: null"))),
        )
    }

    // ------------------------------------------------------------ 404 uniforme

    /**
     * A invariante 5, medida byte a byte: rota inexistente, token inválido,
     * `Host` recusado e `Origin` estranha respondem a MESMA coisa. Quem sonda
     * não descobre nada — nem o que existe, nem por que não passou.
     */
    @Test
    fun oQuatrocentosEQuatroEIdenticoNosQuatroCasos() {
        val rotaOuToken = EspelhoHttp.naoEncontrado()
        assertArrayEquals(rotaOuToken, EspelhoHttp.respostaDeErro(EspelhoHttp.Erro.HostRecusado))
        assertArrayEquals(rotaOuToken, EspelhoHttp.respostaDeErro(EspelhoHttp.Erro.OrigemEstranha))
        assertTrue(texto(rotaOuToken).startsWith("HTTP/1.1 404 Not Found\r\n"))
    }

    // -------------------------------------------------------------- malformado

    @Test
    fun metodoForaDoProtocoloRecusado() {
        for (m in listOf("HEAD", "PUT", "DELETE", "OPTIONS", "TRACE", "CONNECT")) {
            assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "$m /v HTTP/1.1")))
        }
    }

    @Test
    fun versaoEstranhaRecusada() {
        assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "GET /v HTTP/2.0")))
        assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "GET /v")))
    }

    /** Não existe upload em chunks aqui — e `TE` + `CL` é o smuggling clássico. */
    @Test
    fun transferEncodingRecusado() {
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(
                cru(
                    linha = "POST /par HTTP/1.1",
                    cabecalhos = listOf(
                        "Host: 192.168.0.42:8787",
                        "Transfer-Encoding: chunked",
                    ),
                )
            ),
        )
    }

    @Test
    fun camposDuplicadosRecusados() {
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "Host: evil.com"))),
        )
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(
                cru(
                    linha = "POST /par HTTP/1.1",
                    cabecalhos = listOf(
                        "Host: 192.168.0.42:8787",
                        "Content-Length: 0",
                        "Content-Length: 5",
                    ),
                    corpo = "abcde",
                )
            ),
        )
    }

    @Test
    fun formaDeCabecalhoInvalidaRecusada() {
        // Espaço antes do dois-pontos.
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(cabecalhos = listOf("Host : 192.168.0.42:8787"))),
        )
        // Continuação de linha (obs-fold).
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", " continuando"))),
        )
        // Linha sem dois-pontos nenhum.
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "lixo"))),
        )
    }

    @Test
    fun byteDeControleNoCabecalhoRecusado() {
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "X-Mau: a\u0000b"))),
        )
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(cabecalhos = listOf("Host: 192.168.0.42:8787", "X-Mau: a\tb"))),
        )
    }

    /** Forma absoluta traria uma SEGUNDA fonte de "host" para dentro do parser. */
    @Test
    fun formaAbsolutaRecusada() {
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(linha = "GET http://192.168.0.42:8787/v HTTP/1.1")),
        )
    }

    @Test
    fun traversalNoCaminhoRecusado() {
        assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "GET /../shared/native.js HTTP/1.1")))
        // E o mesmo escondido em percent-encoding, que é como ele chega de verdade.
        assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "GET /e%2e%2e/native.js HTTP/1.1")))
    }

    @Test
    fun escapePorCentoQuebradoRecusado() {
        assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "GET /e%zz HTTP/1.1")))
        assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "GET /e%2 HTTP/1.1")))
    }

    @Test
    fun caminhoDecodificadoNaoAceitaControle() {
        // `%0A` no caminho seria linha falsa em log.
        assertSame(EspelhoHttp.Erro.Malformado, falha(cru(linha = "GET /e%0Ax HTTP/1.1")))
    }

    @Test
    fun getComCorpoRecusado() {
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(
                cru(
                    linha = "GET /v HTTP/1.1",
                    cabecalhos = listOf("Host: 192.168.0.42:8787", "Content-Length: 5"),
                    corpo = "abcde",
                )
            ),
        )
    }

    @Test
    fun postSemContentLengthRecusado() {
        assertSame(
            EspelhoHttp.Erro.Malformado,
            falha(cru(linha = "POST /par HTTP/1.1")),
        )
    }

    @Test
    fun truncadoNoMeioDosCabecalhos() {
        assertSame(
            EspelhoHttp.Erro.Truncado,
            EspelhoHttp.lerRequisicao(
                Gotejante("GET /v HTTP/1.1\r\nHost: 192.168.0.42:87".toByteArray(), 4),
                hosts,
            ).exceptionOrNull(),
        )
    }

    @Test
    fun truncadoNoMeioDoCorpo() {
        assertSame(
            EspelhoHttp.Erro.Truncado,
            falha(
                cru(
                    linha = "POST /par HTTP/1.1",
                    cabecalhos = listOf("Host: 192.168.0.42:8787", "Content-Length: 10"),
                    corpo = "abc",
                )
            ),
        )
    }

    /** RFC 7230 §3.5: uma linha em branco antes da requisição é tolerada. */
    @Test
    fun crlfSobrandoAntesDaRequisicaoEtolerado() {
        passa("\r\n" + cru())
    }

    // --------------------------------------------------------- caminho e query

    @Test
    fun caminhoEQueryDecodificados() {
        val r = passa(cru(linha = "GET /par?a=oi%20mundo&b=1&c&d=a+b HTTP/1.1"))
        assertEquals("/par", r.caminho)
        assertEquals("oi mundo", r.query["a"])
        assertEquals("1", r.query["b"])
        assertEquals("", r.query["c"])
        assertEquals("a b", r.query["d"])
    }

    // --------------------------------------------------------------- respostas

    @Test
    fun todaRespostaTemOsCabecalhosDeSempre() {
        val amostras = listOf(
            texto(EspelhoHttp.resposta(200, "application/json", "{}".toByteArray())),
            texto(EspelhoHttp.cabecalhoChunked(200, "application/octet-stream")),
            texto(EspelhoHttp.naoEncontrado()),
            texto(EspelhoHttp.respostaDeErro(EspelhoHttp.Erro.CorpoLongo)),
        )
        for (r in amostras) {
            for (c in EspelhoHttp.CABECALHOS_SEMPRE) {
                assertTrue("faltou \"$c\" em:\n$r", r.contains("$c\r\n"))
            }
        }
    }

    /**
     * A invariante 4, na forma em que ela pode ser medida: **nenhuma** resposta
     * deste arquivo libera CORS. O precedente publicado do modo de falhar exato
     * existe (o servidor local que "descarta a allowlist e reflete qualquer
     * origem"), e o custo de conferir é uma busca por substring.
     */
    @Test
    fun nenhumaRespostaLiberaCors() {
        val amostras = listOf(
            EspelhoHttp.resposta(200, "text/html", "<p>x</p>".toByteArray(), EspelhoHttp.CABECALHOS_PAGINA),
            EspelhoHttp.cabecalhoChunked(200, "application/octet-stream"),
            EspelhoHttp.naoEncontrado(),
            EspelhoHttp.resposta(403, "application/json", "{}".toByteArray()),
        )
        for (bytes in amostras) {
            assertFalse(texto(bytes).lowercase().contains("access-control"))
        }
    }

    @Test
    fun respostaDeclaraOTamanhoDoCorpo() {
        val corpo = "0123456789".toByteArray()
        val r = texto(EspelhoHttp.resposta(200, "text/plain", corpo))
        assertTrue(r.contains("Content-Length: 10\r\n"))
        assertTrue(r.endsWith("\r\n\r\n0123456789"))
    }

    @Test
    fun paginaLevaCspEFrameDeny() {
        val r = texto(
            EspelhoHttp.resposta(200, "text/html", "<p>x</p>".toByteArray(), EspelhoHttp.CABECALHOS_PAGINA)
        )
        assertTrue(r.contains("frame-ancestors 'none'"))
        assertTrue(r.contains("base-uri 'none'"))
        assertTrue(r.contains("X-Frame-Options: DENY\r\n"))
        // As duas diretivas que a especificação não escreveu e sem as quais o
        // cliente nasceria morto: `blob:` é como o JPEG e a MediaSource entram.
        assertTrue(r.contains("img-src 'self' blob:"))
        assertTrue(r.contains("media-src 'self' blob:"))
    }

    @Test
    fun chunkedNaoDeclaraTamanho() {
        val r = texto(EspelhoHttp.cabecalhoChunked(200, "application/octet-stream"))
        assertTrue(r.contains("Transfer-Encoding: chunked\r\n"))
        assertFalse(r.contains("Content-Length"))
        assertFalse(r.contains("Content-Encoding"))
    }

    @Test
    fun chunkTemTamanhoEmHex() {
        val quadro = ByteArray(256) { 0x41 }
        val c = EspelhoHttp.chunk(quadro, 0, 256)
        assertEquals("100\r\n", texto(c).substring(0, 5))
        assertEquals(5 + 256 + 2, c.size)
        assertEquals("\r\n", texto(c).substring(c.size - 2))
    }

    @Test
    fun chunkRespeitaAFatia() {
        val quadro = byteArrayOf(1, 2, 3, 4, 5)
        val c = EspelhoHttp.chunk(quadro, 1, 3)
        assertEquals("3\r\n", texto(c).substring(0, 3))
        assertArrayEquals(byteArrayOf(2, 3, 4), c.copyOfRange(3, 6))
    }

    /**
     * Um chunk de tamanho zero **é** o terminador do corpo. Ele não daria erro em
     * lugar nenhum: encerraria o fluxo educadamente e o telão do cliente
     * congelaria para sempre, sem uma linha de log nos dois lados.
     */
    @Test(expected = IllegalArgumentException::class)
    fun chunkVazioERecusado() {
        EspelhoHttp.chunk(ByteArray(4), 0, 0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun chunkForaDoArrayERecusado() {
        EspelhoHttp.chunk(ByteArray(4), 2, 3)
    }

    @Test
    fun chunkFinalEOTerminador() {
        assertEquals("0\r\n\r\n", texto(EspelhoHttp.chunkFinal()))
    }

    /**
     * Injeção de cabeçalho só pode vir de código NOSSO (nada vindo da rede é
     * ecoado numa resposta), então ela sai como defeito de programação e não como
     * 400 — mas sai.
     */
    @Test(expected = IllegalArgumentException::class)
    fun cabecalhoExtraComQuebraDeLinhaERecusado() {
        EspelhoHttp.resposta(
            200,
            "text/plain",
            "x".toByteArray(),
            listOf("X-Bom: 1\r\nAccess-Control-Allow-Origin: *"),
        )
    }
}
