package br.org.iasd.av

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.io.SequenceInputStream
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.KeyStore
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket

/**
 * O SERVIDOR DO ESPELHO — sockets, threads, roteamento e fan-out.
 *
 * Ele é o cano por onde os pixels do telão saem para os navegadores da rede
 * local. **Não decide nada** que os dois arquivos puros já decidam: quem lê a
 * requisição é o [EspelhoHttp] e quem diz se aquela tela pode entrar é o
 * [EspelhoPares]. Aqui moram só as três coisas que exigem o Android e um
 * `ServerSocket`: **onde o socket liga**, **quantas threads existem** e **o que
 * cada cliente recebe**.
 *
 * ## Onde o socket liga — a linha mais importante deste arquivo
 *
 * `ServerSocket(porta)` liga em **0.0.0.0**: toda interface do aparelho,
 * inclusive a `rmnet` da operadora. E o enunciado deste projeto diz que a
 * igreja pode não ter internet, cujo desfecho normal é o celular em dados
 * móveis — onde as operadoras brasileiras entregam **IPv6 globalmente
 * roteável**, sem NAT e sem firewall implícito. O resultado seria o culto em
 * H.264 numa porta alcançável do mundo, protegida por seis dígitos, e ninguém
 * no prédio teria como perceber.
 *
 * Por isso, e não é negociável:
 *
 * 1. o bind é **explícito, ao IPv4 da rede ativa** (`ServerSocket().bind(...)`),
 *    nunca pelo construtor de porta e nunca em `::` — os endereços IPv6
 *    temporários do Android rotacionam, e ligar em `::` reintroduz o problema
 *    por outra porta;
 * 2. **recusa ligar** quando a rede ativa não tem `TRANSPORT_WIFI`, ou tem
 *    `TRANSPORT_CELLULAR` ou `TRANSPORT_VPN` — com a frase no Registro, nunca
 *    em silêncio (ver [redeDaWifi] e [Recusa]);
 * 3. a rede que some **desliga o servidor** (`registerDefaultNetworkCallback`).
 *    Um endereço que sumiu não pode continuar escutando.
 *
 * ## O transporte é `Transfer-Encoding: chunked`, não WebSocket
 *
 * O servidor HTTP tem de existir de qualquer jeito — a página, o CSS, o JS, e
 * o próprio handshake do WebSocket **é** uma requisição HTTP. A comparação
 * honesta não é "HTTP contra WS": é "HTTP" contra "HTTP **mais** o RFC 6455",
 * isto é, mais ~150 linhas de framing, unmasking obrigatório, frames de
 * controle e três casos de comprimento (o de 8 bytes falhando só acima de
 * 64 kB, ou seja **exatamente no IDR**) — tudo isso sem oráculo. `chunked` é
 * `tamanho-em-hex CRLF bytes CRLF`, para sempre.
 *
 * ## O que este servidor NÃO serve, e é a diferença entre um espelho e um
 * vazamento
 *
 * Nenhum arquivo do acervo, nenhum id, nenhuma listagem; **nunca `/saf/`** (os
 * tokens do SAF não expiram e indexam arquivos pessoais); e **nada que venha da
 * rede entra no barramento de comandos** — não há uma única referência a
 * [MessageBus] neste arquivo, de propósito. O upstream inteiro é
 * `key` / `alive` / `audio` / `relato`, e o cliente é **somente-leitura de
 * pixels**.
 *
 * Os estáticos saem do [WebPathHandler] (a mesma resolução OTA→APK e a mesma
 * tabela MIME dos WebViews) por um **mapa fixo** de rota → caminho, nunca por
 * concatenação: `handle("espelho/" + nome)` com `nome` vindo da URL serviria
 * `/controle/controle.js` e `/shared/native.js` para quem estiver na rede. A
 * contenção por `canonicalPath` daquele arquivo, descrita lá como "defesa em
 * profundidade", passa a ser **load-bearing** por causa deste.
 *
 * ## A invariante 8 do `CLAUDE.md` se INVERTE aqui
 *
 * Num `shouldInterceptRequest` quem aplica o `Range` é o próprio WebView, sobre
 * o que o app devolveu. **Num `ServerSocket` de verdade quem aplicaria seria o
 * servidor** — e aqui não há `Range` nenhum: as rotas de mídia são fluxos
 * infinitos, sem keep-alive e sem `Content-Encoding`. Copiar o [StreamProxy]
 * seria o erro exato.
 *
 * @param registrar linha crua para o diário do espelho (`EspelhoDiag`). O
 *   Kotlin devolve DADO; quem monta a frase é o `controle.js` — por isso o
 *   parâmetro é uma função e não uma dependência de UI. Padrão vazio: a
 *   assinatura de dois parâmetros da especificação continua válida.
 * @param pedirIdr pede um quadro-chave ao encoder (é o `EspelhoDisplay` quem
 *   sabe fazer isso). Todo `GET /v` novo é, por construção, um cliente novo.
 * @param aoPerderRede a Wi-Fi sumiu com o espelho no ar: além de desligar o
 *   servidor (que este arquivo faz sozinho), o dono precisa soltar a tela
 *   virtual e o encoder.
 */
class EspelhoServidor(
    private val ctx: Context,
    private val bundle: WebPathHandler,
    private val registrar: (String) -> Unit = {},
    private val pedirIdr: () -> Unit = {},
    private val aoPerderRede: () -> Unit = {},
) {

    private val app: Context = ctx.applicationContext

    // ---------- estado da sessão de servidor ----------

    @Volatile private var servidor: ServerSocket? = null
    @Volatile private var ligadoEm = 0L
    @Volatile private var endereco = ""
    @Volatile private var ipServido = ""
    @Volatile private var portaServida = 0
    @Volatile private var comTls = false
    @Volatile private var ssl: SSLContext? = null
    @Volatile private var hostsAceitos: Set<String> = emptySet()

    /**
     * O `csd` mais recente de cada faixa, JÁ ENQUADRADO.
     *
     * Toda conexão começa por ele (§5.3) e um encoder remontado emite outro —
     * guardá-lo aqui é o que permite servir um cliente que chegou no meio do
     * culto sem esperar o próximo `INFO_OUTPUT_FORMAT_CHANGED`, que numa cena
     * parada pode não vir nunca.
     */
    @Volatile private var csdVideo: ByteArray? = null
    @Volatile private var csdAudio: ByteArray? = null

    /** As telas conectadas, **indexadas pelo TOKEN** — ver [servirFluxo]. */
    private val telas = ConcurrentHashMap<String, Tela>()

    private val emVoo = AtomicInteger(0)
    private val conexoesTotais = AtomicInteger(0)
    private val proximoRotulo = AtomicInteger(0)
    private val desligando = AtomicBoolean(false)

    @Volatile private var ultimoIdrGlobalMs = 0L
    @Volatile private var ultimaSaida: JSONObject? = null

    private var cm: ConnectivityManager? = null
    private var callbackRede: ConnectivityManager.NetworkCallback? = null

    // ---------- ligar / desligar ----------

    /**
     * Sobe o servidor e devolve o endereço servido (`http://192.168.0.42:8787`).
     *
     * @param ipv4 o IPv4 da Wi-Fi, obtido em [redeDaWifi]. Ele é **reconferido**
     *   aqui contra a rede ativa: é barato, e a alternativa é um bind num
     *   endereço que já não é o da Wi-Fi.
     * @param tls o `PKCS12` do operador, quando existir (P8). Nulo = HTTP em
     *   claro, que é o transporte de produção — ver a §2.4 da especificação.
     * @throws Recusa quando não há Wi-Fi, quando a rede ativa é celular/VPN, ou
     *   quando o socket não sobe. **Nunca falha em silêncio**: a mensagem é a
     *   frase que o operador lê.
     */
    fun ligar(porta: Int, ipv4: InetAddress, tls: KeyStore?, senha: CharArray?): String {
        // SÓ desliga se havia um servidor de pé (religar sem desligar duplicaria
        // as threads). A guarda não é economia: [desligar] ZERA O PAREAMENTO, e
        // quem liga o espelho acabou de sortear o PIN — chamá-lo aqui sempre
        // apagaria o PIN que já está desenhado na tela do operador.
        if (servidor != null) desligar()
        val rede = redeDaWifi(app)
        if (ipv4 !is Inet4Address || rede.ip.hostAddress != ipv4.hostAddress) {
            throw Recusa("o endereco pedido nao e o da Wi-Fi atual")
        }
        ssl = tls?.let { montarTls(it, senha) }
        comTls = ssl != null

        val ss = ServerSocket()
        try {
            // Sem isto, religar o espelho logo depois de desligá-lo esbarra no
            // TIME_WAIT do socket anterior e o operador vê "endereço em uso"
            // por um motivo que não é dele.
            ss.reuseAddress = true
            ss.bind(InetSocketAddress(ipv4, porta), 8)
        } catch (e: IOException) {
            fecharQuieto(ss)
            throw Recusa("nao foi possivel abrir a porta $porta: ${e.message}")
        }
        servidor = ss
        desligando.set(false)
        ipServido = ipv4.hostAddress ?: ""
        portaServida = ss.localPort
        endereco = (if (comTls) "https://" else "http://") + ipServido + ":" + portaServida
        // ALLOWLIST EXATA DE `Host` — é a defesa contra DNS rebinding: uma
        // página qualquer da internet, aberta por um visitante na rede da
        // igreja, pode fazer `evil.com` resolver para o nosso IP e passar a ser
        // same-origin com este servidor. Quem confere é o [EspelhoHttp]; quem
        // monta a lista, em runtime, é este ponto.
        hostsAceitos = setOf("$ipServido:$portaServida", ipServido)
        ligadoEm = SystemClock.elapsedRealtime()
        conexoesTotais.set(0)
        proximoRotulo.set(0)

        Thread({ aceitarConexoes(ss) }, "av-espelho-accept").apply { isDaemon = true }.start()
        Thread({ vigiar() }, "av-espelho-vigia").apply { isDaemon = true }.start()
        observarRede()
        registrar("servidor ligado em $endereco" + if (comTls) " (TLS)" else " (HTTP)")
        Log.i(TAG, "espelho servindo em $endereco")
        return endereco
    }

    /** Idempotente, e chamável de QUALQUER thread — inclusive de dentro do
     *  callback de rede que o derruba. */
    fun desligar() {
        if (servidor == null && telas.isEmpty()) {
            pararDeObservarRede()
            return
        }
        if (!desligando.compareAndSet(false, true)) return
        val ss = servidor
        servidor = null
        pararDeObservarRede()
        fecharQuieto(ss)
        for (t in telas.values) fechar(t, "espelho desligado")
        telas.clear()
        csdVideo = null
        csdAudio = null
        endereco = ""
        ipServido = ""
        portaServida = 0
        comTls = false
        ssl = null
        hostsAceitos = emptySet()
        ligadoEm = 0
        // "O token tem prazo e MORRE COM A SESSÃO" (§3.5, invariante 3): não há
        // token que sobreviva ao culto.
        zerarPares()
    }

    val ligado: Boolean get() = servidor != null

    // ---------- o fan-out ----------

    /**
     * Entrega um quadro a todas as telas que têm direito a ele.
     *
     * Chamado da thread de drenagem do [MediaCodec][android.media.MediaCodec]
     * (ou do `ImageReader`, no modo imagem), e por isso **nunca bloqueia**:
     * `offer()`, jamais `put()`. Um tablet no fundo do salão não pode segurar o
     * encoder do aparelho que está projetando o culto.
     *
     * **Fila cheia ⇒ esvaziar a fila INTEIRA e esperar o próximo IDR.** Nunca
     * descartar quadro a quadro: um fluxo H.264 sem os quadros intermediários
     * degrada para lixo verde permanente, enquanto assim o cliente pisca uma
     * vez e volta certo.
     */
    fun difundir(q: Quadro) {
        if (servidor == null) return
        val bytes = enquadrar(q)
        when (q.tipo) {
            EspelhoCodec.TIPO_CSD_VIDEO -> csdVideo = bytes
            EspelhoCodec.TIPO_CSD_AUDIO -> csdAudio = bytes
        }
        for (t in telas.values) {
            if (!temDireito(t, q)) continue
            entregar(t, q, bytes)
        }
    }

    /**
     * Uma mensagem de controle (`0x30`) para todas as telas — "esta cena vai
     * muda porque é o embed do YouTube", "adeus, o operador desligou".
     *
     * Ela é JSON e vai pelo MESMO fio, com o MESMO cabeçalho de 16 bytes: o
     * cliente já sabe desmontar isso, e um segundo canal seria um segundo
     * parser no navegador.
     */
    fun avisar(json: JSONObject) {
        difundir(
            Quadro(
                tipo = EspelhoCodec.TIPO_CONTROLE,
                chave = true,
                descontinuidade = false,
                // O último carimbo do vídeo, e não zero: o cabeçalho do fio tem
                // um campo de tempo só, e um aviso datado no passado remoto
                // seria a única coisa fora do eixo da sessão.
                ptsUs = EspelhoCodec.ultimoCarimbo(),
                bytes = json.toString().toByteArray(Charsets.UTF_8),
            ),
        )
    }

    private fun temDireito(t: Tela, q: Quadro): Boolean = when (q.tipo) {
        // ÁUDIO É ESTRITAMENTE POR CLIENTE (§3.6, invariante 10). Quem decide
        // é o servidor, a partir do `POST /r {"do":"audio"}` daquela tela — e
        // nada que venha da rede liga o grafo de áudio ou o encoder AAC.
        EspelhoCodec.TIPO_CSD_AUDIO, EspelhoCodec.TIPO_AUDIO -> t.audio
        // Enquanto a tela espera um quadro-chave, um delta só produziria lixo
        // verde. Ver a §5.3: "mandar bytes antes do IDR é a falha que ninguém
        // liga à causa".
        EspelhoCodec.TIPO_VIDEO -> !t.esperandoIdr || q.chave
        else -> true
    }

    private fun entregar(t: Tela, q: Quadro, bytes: ByteArray) {
        val ehVideo = q.tipo == EspelhoCodec.TIPO_VIDEO
        if (t.fila.offer(bytes)) {
            if (ehVideo && q.chave) t.esperandoIdr = false
            return
        }
        // A FILA ENCHEU: o cliente não escoa. Esvazia tudo, conta o descarte e
        // recomeça do próximo quadro-chave — que também é pedido aqui, porque
        // numa cena parada o próximo IDR natural pode estar a dez segundos.
        t.fila.clear()
        t.descartes++
        t.esperandoIdr = true
        val recomeco = !ehVideo || q.chave
        if (recomeco && t.fila.offer(bytes) && ehVideo && q.chave) {
            t.esperandoIdr = false
        }
        pedirIdrComFreio(t)
    }

    /**
     * O cabeçalho de 16 bytes da §5.2, seguido do payload.
     *
     * O PTS viaja como **dois uint32 BE**, e não um uint64: é o que evita
     * `BigInt` no cliente, e 2^53 µs ainda são 285 anos de folga. O comprimento
     * é NOSSO e não do `chunked` porque os limites de chunk do HTTP não
     * coincidem com os limites de mensagem para quem lê de um `ReadableStream`.
     */
    private fun enquadrar(q: Quadro): ByteArray {
        val n = q.bytes.size
        val saida = ByteArray(CABECALHO + n)
        saida[0] = q.tipo
        var flags = 0
        if (q.chave) flags = flags or 0x01
        if (q.descontinuidade) flags = flags or 0x02
        saida[1] = flags.toByte()
        // 2..3 ficam zerados: reservado, alinhamento.
        escreverU32(saida, 4, n.toLong())
        val pts = if (q.ptsUs < 0) 0L else q.ptsUs
        escreverU32(saida, 8, (pts ushr 32) and 0xFFFFFFFFL)
        escreverU32(saida, 12, pts and 0xFFFFFFFFL)
        System.arraycopy(q.bytes, 0, saida, CABECALHO, n)
        return saida
    }

    private fun escreverU32(dest: ByteArray, off: Int, v: Long) {
        dest[off] = ((v ushr 24) and 0xFF).toByte()
        dest[off + 1] = ((v ushr 16) and 0xFF).toByte()
        dest[off + 2] = ((v ushr 8) and 0xFF).toByte()
        dest[off + 3] = (v and 0xFF).toByte()
    }

    /**
     * Pedido de IDR com freio: 1 por 2 s por tela **e** um piso global.
     *
     * Sem isso, um cliente pareado pede IDR em laço a ~20 bytes por pedido e
     * consome encoder, airtime e bateria durante o culto inteiro.
     */
    private fun pedirIdrComFreio(t: Tela?) {
        val agora = SystemClock.elapsedRealtime()
        if (t != null) {
            if (agora - t.ultimoIdrMs < IDR_POR_TELA_MS) return
            t.ultimoIdrMs = agora
        }
        if (agora - ultimoIdrGlobalMs < IDR_GLOBAL_MS) return
        ultimoIdrGlobalMs = agora
        try {
            pedirIdr()
        } catch (e: Exception) {
            Log.w(TAG, "falhou pedindo IDR", e)
        }
    }

    // ---------- sockets ----------

    private fun aceitarConexoes(ss: ServerSocket) {
        while (!ss.isClosed && servidor === ss) {
            val cru = try {
                ss.accept()
            } catch (e: IOException) {
                break
            }
            // TETO DE CONEXÕES EM VOO, separado do teto de telas: três TCPs
            // mudos não podem consumir os três slots de sessão nem uma thread
            // por socket sem limite.
            if (emVoo.get() >= TETO_EM_VOO) {
                fecharQuieto(cru)
                continue
            }
            emVoo.incrementAndGet()
            val t = Thread({
                try {
                    aceitar(cru)
                } catch (e: Throwable) {
                    Log.w(TAG, "conexão terminou com erro", e)
                } finally {
                    emVoo.decrementAndGet()
                    fecharQuieto(cru)
                }
            }, "av-espelho-cli")
            t.isDaemon = true
            try {
                t.start()
            } catch (e: Throwable) {
                // Sem thread não há atendimento — e o contador não pode ficar
                // devendo, senão o teto se fecha sozinho para sempre.
                emVoo.decrementAndGet()
                fecharQuieto(cru)
                Log.w(TAG, "não foi possível atender a conexão", e)
            }
        }
        Log.i(TAG, "laço de aceite encerrado")
    }

    private fun aceitar(cru: Socket) {
        // 2 s para completar a linha de requisição (§3.5, invariante 8). O
        // [EspelhoHttp] tem o prazo dele para o corpo; este é o que impede um
        // socket mudo de segurar uma thread.
        cru.soTimeout = PRAZO_LINHA_MS
        // Nagle atrasaria cada quadro pequeno em dezenas de ms esperando
        // companhia — e este fluxo é feito de quadros pequenos.
        cru.tcpNoDelay = true
        val (socket, entrada) = envelopar(cru)
        val r = EspelhoHttp.lerRequisicao(entrada, hostsAceitos)
        val req = r.getOrNull()
        if (req == null) {
            // A RESPOSTA é do [EspelhoHttp] (`HostRecusado` e `OrigemEstranha`
            // saem como o 404 idêntico); a LINHA do Registro, essa sim,
            // distingue — senão o operador não teria como saber que alguém
            // tentou rebinding contra o aparelho dele.
            val erro = r.exceptionOrNull()
            Log.i(TAG, "requisição recusada: ${erro?.message ?: "malformada"}")
            if (erro is EspelhoHttp.Erro) {
                if (erro is EspelhoHttp.Erro.HostRecusado || erro is EspelhoHttp.Erro.OrigemEstranha) {
                    registrar("recusada: ${erro.message}")
                }
                responder(socket.getOutputStream(), EspelhoHttp.respostaDeErro(erro))
            } else {
                responder(socket.getOutputStream(), naoAchei())
            }
            return
        }
        val saida = socket.getOutputStream()
        val sessao = validarToken(req.autorizacao)
        rotear(req, saida, sessao, socket, cru)
    }

    /**
     * TLS envolve um `Socket` **CRU** — nunca um `SSLServerSocket`.
     *
     * Com um `SSLSocket` vindo de um `SSLServerSocket` não se tem o socket cru,
     * e `SSLSocket.close()` tenta emitir `close_notify` — isto é, tenta
     * **escrever**, numa conexão que pode estar justamente travada em escrita.
     * O vigia de [TETO_ESCRITA_MS] deixaria de funcionar exatamente quando é
     * necessário, e o teto de três telas seria consumido por fantasmas.
     *
     * Feito assim, **uma porta só**: espia o primeiro byte (`0x16` = handshake
     * TLS) e envolve ou não. "TLS: ligado" passa a ser propriedade da CONEXÃO,
     * não da URL que o operador lembrou.
     *
     * A espiada é um `read()` de UM byte no stream cru (nunca um
     * `BufferedInputStream`, que encheria o buffer dele com o começo do
     * handshake e o perderia), e o byte é devolvido: ao TLS pela sobrecarga
     * `createSocket(Socket, InputStream, boolean)`, que existe exatamente para
     * isso, e ao HTTP por um [SequenceInputStream].
     */
    private fun envelopar(cru: Socket): Pair<Socket, InputStream> {
        val contexto = ssl ?: return cru to BufferedInputStream(cru.getInputStream())
        val bruto = cru.getInputStream()
        val b0 = bruto.read()
        if (b0 < 0) throw IOException("conexão fechada antes do primeiro byte")
        val consumido = ByteArrayInputStream(byteArrayOf(b0.toByte()))
        if (b0 != 0x16) {
            return cru to BufferedInputStream(SequenceInputStream(consumido, bruto))
        }
        val s = contexto.socketFactory.createSocket(cru, consumido, true) as SSLSocket
        s.useClientMode = false
        s.soTimeout = PRAZO_LINHA_MS
        return s to BufferedInputStream(s.inputStream)
    }

    private fun montarTls(ks: KeyStore, senha: CharArray?): SSLContext? = try {
        val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
        kmf.init(ks, senha ?: CharArray(0))
        SSLContext.getInstance("TLS").apply { init(kmf.keyManagers, null, null) }
    } catch (e: Exception) {
        // O degrau que não sobe não pode derrubar o chão: sem TLS o espelho
        // serve HTTP, que é o transporte de produção.
        registrar("TLS: RECUSADO — ${e.message}")
        Log.w(TAG, "TLS não subiu; seguindo em HTTP", e)
        null
    }

    // ---------- roteamento ----------

    /**
     * As cinco rotas da §5.1, e nada mais.
     *
     * **404 IDÊNTICO** para token inválido, rota inexistente, `Host` fora da
     * allowlist e `Origin` estranha: não vazar existência. O único desvio é o
     * `403` do pareamento (rota que existe, credencial errada) e o `503` do
     * quarto cliente, que precisa de uma FRASE em vez de silêncio.
     */
    private fun rotear(
        r: EspelhoHttp.Req,
        saida: OutputStream,
        sessao: EspelhoPares.Sessao?,
        socket: Socket,
        cru: Socket,
    ) {
        val rota = r.caminho
        when {
            r.metodo == "GET" && ESTATICOS.containsKey(rota) -> servirEstatico(rota, saida)
            r.metodo == "POST" && rota == "/par" -> parear(r, saida, cru)
            r.metodo == "GET" && rota == "/v" -> {
                if (sessao == null) responder(saida, naoAchei()) else servirFluxo(socket, cru, saida, sessao)
            }
            r.metodo == "POST" && rota == "/r" -> {
                if (sessao == null) responder(saida, naoAchei()) else retorno(r, saida, sessao)
            }
            else -> responder(saida, naoAchei())
        }
    }

    private fun servirEstatico(rota: String, saida: OutputStream) {
        val caminho = ESTATICOS[rota] ?: return responder(saida, naoAchei())
        val corpo = lerDoBundle(caminho)
        if (corpo == null) {
            registrar("faltou no bundle: $caminho")
            return responder(saida, naoAchei())
        }
        val nome = caminho.substringAfterLast('/')
        val tipo = bundle.mimeOf(nome) + (bundle.encodingOf(nome)?.let { "; charset=$it" } ?: "")
        // A PÁGINA leva CSP e `X-Frame-Options`; os outros cabeçalhos de higiene
        // (`no-store`, `nosniff`, `no-referrer`, `Connection: close`) o
        // [EspelhoHttp] põe em toda resposta.
        val extra = if (rota == "/") EspelhoHttp.CABECALHOS_PAGINA else emptyList()
        responder(saida, EspelhoHttp.resposta(200, tipo, corpo, extra))
    }

    /**
     * Os estáticos vêm do MESMO lugar que os WebViews leem — bundle OTA da
     * sessão, caindo para os assets do APK, arquivo a arquivo.
     *
     * Reusar o [WebPathHandler] em vez de abrir os assets à mão não é economia
     * de linhas: é o que faz uma correção de JS do espelho chegar por OTA como
     * chega qualquer outra, e é o que impede uma segunda tabela MIME de existir
     * e divergir no primeiro `.woff2` novo.
     */
    private fun lerDoBundle(caminho: String): ByteArray? = try {
        bundle.handle(caminho)?.data?.use { it.readBytes() }
    } catch (e: Exception) {
        Log.w(TAG, "falhou lendo $caminho do bundle", e)
        null
    }

    private fun parear(r: EspelhoHttp.Req, saida: OutputStream, cru: Socket) {
        val corpo = try {
            JSONObject(String(r.corpo, Charsets.UTF_8))
        } catch (e: Exception) {
            return responder(saida, naoAchei())
        }
        // A ORIGEM DO BLOQUEIO É O ENDEREÇO DO PAR, e não o cabeçalho `Origin`:
        // cinco PINs errados bloqueiam **aquele aparelho** por 60 s, e um
        // cabeçalho é escrito por quem tenta. O PIN, esse, NÃO rotaciona por
        // tentativa errada — seria negação de serviço contra o visitante
        // legítimo que está digitando.
        val origem = enderecoDe(cru)
        val (status, json) = when {
            corpo.has("pin") -> {
                val relato = relatoDe(corpo)
                respostaDoVeredito(tentarPin(corpo.optString("pin"), origem, relato))
            }
            corpo.has("espera") -> respostaDoVeredito(consultarEspera(corpo.optString("espera")))
            else -> 403 to RECUSADA
        }
        responder(saida, EspelhoHttp.resposta(status, "application/json", json.toByteArray(Charsets.UTF_8)))
    }

    /**
     * O canal de volta do cliente. Três verbos, todos inertes por construção:
     * `key` pede um quadro-chave (com freio), `alive` só atualiza um número que
     * vai para o Registro, e `audio` liga a entrega de AAC **para aquela tela**.
     */
    private fun retorno(r: EspelhoHttp.Req, saida: OutputStream, sessao: EspelhoPares.Sessao) {
        val corpo = try {
            JSONObject(String(r.corpo, Charsets.UTF_8))
        } catch (e: Exception) {
            return responder(saida, naoAchei())
        }
        val tela = telas[sessao.token]
        when (corpo.optString("do")) {
            "key" -> pedirIdrComFreio(tela)
            "alive" -> tela?.telaAcesaMin = corpo.optInt("telaAcesaMin", 0).coerceIn(0, 24 * 60)
            "audio" -> if (tela != null) {
                val quer = corpo.optBoolean("on", false)
                tela.audio = quer
                if (quer) csdAudio?.let { tela.fila.offer(it) }
            }
        }
        responder(saida, EspelhoHttp.resposta(200, "application/json", OK_CURTO))
    }

    /**
     * `GET /v` — a partir daqui esta thread é a ESCRITORA desta tela, e ela não
     * volta enquanto o cliente estiver conectado. Uma thread por cliente, uma
     * fila limitada por cliente.
     *
     * **O slot é do TOKEN, não do socket.** Um `GET /v` com um token que já tem
     * conexão fecha a anterior antes de contar; sem isso, três recarregamentos
     * de página trancariam o operador para fora do próprio recurso.
     */
    private fun servirFluxo(
        socket: Socket,
        cru: Socket,
        saida: OutputStream,
        sessao: EspelhoPares.Sessao,
    ) {
        val tela = Tela(rotuloNovo(), cru, sessao)
        var anterior: Tela? = null
        var lotado = false
        // A ADMISSÃO é a única decisão deste arquivo que precisa ser atômica:
        // duas conexões novas chegando juntas passariam as duas pelo teto se
        // ele fosse conferido fora de um monitor.
        synchronized(telas) {
            val atual = telas[sessao.token]
            if (atual == null && telas.size >= TETO_TELAS) {
                lotado = true
            } else {
                anterior = atual
                telas[sessao.token] = tela
            }
        }
        if (lotado) {
            // FRASE, e não silêncio: o quarto cliente precisa saber que o
            // limite é do espelho e que alguém tem de fechar uma página.
            responder(saida, EspelhoHttp.resposta(503, "application/json", LOTADO))
            return
        }
        anterior?.let { fechar(it, "a mesma tela reabriu a página") }

        // O socket sai do prazo curto da linha de requisição: daqui em diante
        // ele é um fluxo que pode ficar minutos sem nada a dizer (cena parada).
        // Quem vigia escrita travada é o [vigiar], porque `setSoTimeout` NÃO
        // cobre escrita.
        try {
            socket.soTimeout = 0
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível zerar o soTimeout", e)
        }
        conexoesTotais.incrementAndGet()
        registrar("tela ${tela.rotulo} conectada")
        EspelhoService.telasMudaram(app, telas.size)
        try {
            saida.write(EspelhoHttp.cabecalhoChunked(200, "application/octet-stream"))
            saida.flush()
            // A ABERTURA DE TODA CONEXÃO (§5.3): csd, depois nada até o próximo
            // IDR. O `csd` guardado é o que faz um cliente que chegou numa cena
            // parada não esperar o próximo `INFO_OUTPUT_FORMAT_CHANGED`.
            csdVideo?.let { tela.fila.offer(it) }
            pedirIdrComFreio(tela)
            escrever(tela, saida)
        } catch (e: IOException) {
            Log.i(TAG, "tela ${tela.rotulo} caiu: ${e.message}")
        } finally {
            telas.remove(sessao.token, tela)
            anotarSaida(tela)
            registrar("tela ${tela.rotulo} desconectada")
            EspelhoService.telasMudaram(app, telas.size)
        }
    }

    private fun escrever(tela: Tela, saida: OutputStream) {
        while (tela.viva && servidor != null) {
            val q = tela.fila.poll(1, TimeUnit.SECONDS) ?: continue
            if (q === FIM) break
            tela.escritaIniciadaMs = SystemClock.elapsedRealtime()
            try {
                saida.write(EspelhoHttp.chunk(q, 0, q.size))
                saida.flush()
            } finally {
                tela.escritaIniciadaMs = 0
            }
            tela.bytes += q.size
            tela.ultimaEscritaMs = SystemClock.elapsedRealtime()
            // PROGRESSO REAL — é ele, e não um tique de relógio, que renova o
            // wake lock do serviço: um espelho morto não pode segurar o lock
            // até a bateria acabar.
            EspelhoService.progresso()
        }
        try {
            saida.write(EspelhoHttp.chunkFinal())
            saida.flush()
        } catch (e: IOException) {
            // O cliente já foi: o fim de chunked é cortesia, não obrigação.
        }
    }

    // ---------- vigia ----------

    /**
     * Um segundo de por vez: escrita travada, sessão vencida e a contagem de
     * telas na notificação.
     *
     * **Teto de tempo de ESCRITA** é o que este laço existe para impor.
     * `setSoTimeout` não cobre escrita, e um cliente que dormiu sem FIN prende
     * a thread por minutos — o retry do TCP não é curto. Estourado o teto, o
     * socket é fechado **de fora**, o que faz o `write()` bloqueado lançar.
     */
    private fun vigiar() {
        while (servidor != null) {
            try {
                Thread.sleep(1_000)
            } catch (e: InterruptedException) {
                return
            }
            val agora = SystemClock.elapsedRealtime()
            for (t in telas.values) {
                val inicio = t.escritaIniciadaMs
                if (inicio != 0L && agora - inicio > TETO_ESCRITA_MS) {
                    fechar(t, "sem escrita ha ${(agora - inicio) / 1000} s (cliente dormiu)")
                    continue
                }
                if (validarTokenCru(t.sessao.token) == null) {
                    fechar(t, "sessao expirada")
                }
            }
            limparPares()
        }
    }

    /**
     * Fecha uma tela **de fora**, que é a única forma de destravar um `write()`
     * bloqueado.
     *
     * E fecha o socket **CRU**, nunca o `SSLSocket` que possa estar por cima
     * dele: `SSLSocket.close()` tenta emitir `close_notify`, isto é, tenta
     * ESCREVER — exatamente o que já está travado. Fechar o cru derruba os dois.
     */
    private fun fechar(t: Tela, motivo: String) {
        if (!t.viva) return
        t.viva = false
        t.motivoDaSaida = motivo
        t.fila.clear()
        t.fila.offer(FIM)
        fecharQuieto(t.cru)
        Log.i(TAG, "tela ${t.rotulo} fechada: $motivo")
    }

    private fun anotarSaida(t: Tela) {
        ultimaSaida = JSONObject()
            .put("rotulo", t.rotulo)
            .put("motivo", t.motivoDaSaida)
            // Relógio de PAREDE, e não `elapsedRealtime`: esta linha vira
            // "última desconexão: tela C · 12:41" na tela do operador, e não há
            // como converter tempo desde o boot em hora do culto.
            .put("quando", System.currentTimeMillis())
            .put("bytes", t.bytes)
            .put("descartes", t.descartes)
    }

    // ---------- rede ----------

    private fun observarRede() {
        val gerente = app.getSystemService(ConnectivityManager::class.java) ?: return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onLost(network: Network) = conferir(null)

            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                conferir(caps)
            }

            override fun onLinkPropertiesChanged(network: Network, lp: LinkProperties) {
                // O ENDEREÇO PODE TROCAR SEM A REDE CAIR (renovação de DHCP, ou
                // o roteador reiniciando): o socket continua ligado a um IP que
                // já não é o do aparelho, e nenhuma conexão nova chega — sem
                // um único erro em lugar nenhum.
                val temIp = lp.linkAddresses.any { it.address.hostAddress == ipServido }
                if (!temIp && servidor != null) queda("o endereço da Wi-Fi mudou")
            }

            private fun conferir(caps: NetworkCapabilities?) {
                if (servidor == null) return
                val c = caps ?: gerente.activeNetwork?.let { gerente.getNetworkCapabilities(it) }
                val ok = c != null &&
                    c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                    !c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) &&
                    !c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
                if (!ok) queda("a rede sumiu")
            }
        }
        try {
            gerente.registerDefaultNetworkCallback(cb)
            cm = gerente
            callbackRede = cb
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível observar a rede", e)
        }
    }

    private fun pararDeObservarRede() {
        val cb = callbackRede ?: return
        callbackRede = null
        try {
            cm?.unregisterNetworkCallback(cb)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível parar de observar a rede", e)
        }
        cm = null
    }

    private fun queda(motivo: String) {
        registrar("$motivo — espelho desligado")
        desligar()
        try {
            aoPerderRede()
        } catch (e: Exception) {
            Log.w(TAG, "falhou avisando a queda de rede", e)
        }
    }

    // ---------- diagnóstico ----------

    /**
     * O estado, **em JSON e sem uma frase sequer**.
     *
     * O Kotlin devolve DADO; quem monta o parágrafo do Registro é o
     * `controle.js`, como já acontece com `otaDiag` e `ytDiag`. Um servidor que
     * formata texto é UI de diagnóstico escrita em Kotlin, e este projeto faz o
     * contrário.
     *
     * `semConexaoMs` é a linha mais importante do diagnóstico inteiro: servidor
     * de pé, porta escutando e **nenhum SYN chegando** é a assinatura de AP
     * isolation, que não tem conserto do lado do app — e sem este número a
     * única resposta possível seria um palpite.
     */
    fun estado(): JSONObject {
        val agora = SystemClock.elapsedRealtime()
        val lista = JSONArray()
        for (t in telas.values) {
            lista.put(
                relatoJson(t.sessao.relato)
                    .put("rotulo", t.rotulo)
                    .put("telaAcesaMin", t.telaAcesaMin)
                    .put("audio", t.audio)
                    .put("bytes", t.bytes)
                    .put("descartes", t.descartes)
                    .put("ultimaEscritaMs", agora - t.ultimaEscritaMs),
            )
        }
        val pend = JSONArray()
        for (p in pendentes()) {
            pend.put(
                relatoJson(p.relato)
                    .put("id", p.id)
                    .put("desde", p.desde),
            )
        }
        return JSONObject()
            .put("ligado", servidor != null)
            .put("url", endereco)
            .put("ip", ipServido)
            .put("porta", portaServida)
            .put("tls", comTls)
            .put("noArMs", if (ligadoEm == 0L) 0L else agora - ligadoEm)
            .put("telas", lista)
            .put("teto", TETO_TELAS)
            .put("pendentes", pend)
            .put("conexoesTotais", conexoesTotais.get())
            .put("semConexaoMs", if (conexoesTotais.get() == 0 && ligadoEm != 0L) agora - ligadoEm else 0L)
            .put("ultimaSaida", ultimaSaida ?: JSONObject.NULL)
    }

    // ---------- PONTE COM O EspelhoPares ----------
    //
    // Todo contato com [EspelhoPares] passa por aqui, e por nenhum outro lugar
    // (fora as menções ao TIPO `Sessao`/`Pendente`/`Relato` nas assinaturas).
    // Se a implementação dele divergir, é ESTE bloco que se conserta — o resto
    // do arquivo não sabe que ele existe.
    //
    // A §3.5 declara sete funções e duas data classes; o que ESTE arquivo
    // consome, e portanto o contrato que aquele arquivo precisa cumprir, é:
    //
    //   object EspelhoPares {
    //       data class Relato(
    //           val ua: String, val w: Int, val h: Int, val seguro: Boolean,
    //           val mse: Boolean, val mms: Boolean, val fetchStream: Boolean,
    //           val videoDecoder: Boolean, val wakeLock: Boolean,
    //       )                                              // os nomes da §5.5
    //       data class Pendente(val id: String, val relato: Relato, val desde: Long)
    //       data class Sessao(val token: String, val relato: Relato, val expiraEm: Long)
    //       sealed class Veredito {
    //           data class Espera(val id: String) : Veredito()    // PIN certo, aguarda o operador
    //           data class Aprovada(val sessao: Sessao) : Veredito()
    //           object Pendente : Veredito()                      // consulta: ainda esperando
    //           object Nao : Veredito()                           // errado, recusado ou bloqueado
    //       }
    //       fun novoPin(rnd: SecureRandom): String
    //       fun relatoDe(json: JSONObject): Relato       // SANEIA o texto da rede — invariante 9
    //       fun tentar(pin: String, origem: String, relato: Relato, agora: Long): Veredito
    //       fun consultar(id: String, agora: Long): Veredito
    //       fun aprovar(id: String, agora: Long): Sessao?         // ação do OPERADOR
    //       fun recusar(id: String)                               // ação do OPERADOR
    //       fun validar(token: String?, agora: Long): Sessao?
    //       fun encerrar(token: String)
    //       fun pendentes(): List<Pendente>
    //       fun limpar(agora: Long)
    //       fun zerar()
    //   }
    //
    // (`aprovar`, `recusar`, `novoPin` e `encerrar` não são chamados daqui: os
    // dois primeiros são do `espelhoAprovar` da ponte, e os outros dois do dono
    // que liga e desliga o espelho.)
    //
    // O relógio entregue a ele é `System.currentTimeMillis()`, e não o
    // `elapsedRealtime` que este arquivo usa internamente: [EspelhoPares] é
    // PURO (zero import de Android) e precisa de um "agora" que um JUnit sem
    // aparelho também tenha.

    private fun agoraMs(): Long = System.currentTimeMillis()

    private fun tokenDe(autorizacao: String?): String? {
        val v = autorizacao?.trim() ?: return null
        if (!v.regionMatches(0, "Bearer ", 0, 7, ignoreCase = true)) return null
        return v.substring(7).trim().ifEmpty { null }
    }

    private fun validarToken(autorizacao: String?): EspelhoPares.Sessao? =
        EspelhoPares.validar(tokenDe(autorizacao), agoraMs())

    /** O mesmo, para um token que já está guardado (o vigia, que não tem
     *  cabeçalho nenhum na mão). */
    private fun validarTokenCru(token: String): EspelhoPares.Sessao? =
        EspelhoPares.validar(token, agoraMs())

    private fun tentarPin(pin: String, origem: String, relato: EspelhoPares.Relato) =
        EspelhoPares.tentar(pin, origem, relato, agoraMs())

    private fun consultarEspera(id: String) = EspelhoPares.consultar(id, agoraMs())

    private fun relatoDe(json: JSONObject) = EspelhoPares.relatoDe(json)

    private fun pendentes(): List<EspelhoPares.Pendente> = EspelhoPares.pendentes()

    private fun limparPares() = EspelhoPares.limpar(agoraMs())

    private fun zerarPares() = EspelhoPares.zerar()

    /**
     * O veredito do pareamento vira status + corpo — e este é o ÚNICO ponto do
     * arquivo que conhece a forma dele.
     *
     * O corpo é o da §5.1, com o `else` valendo por recusa: um veredito que
     * este código não conheça **nega**, nunca autoriza. Falha fechada é a única
     * postura possível num controle de acesso.
     */
    private fun respostaDoVeredito(v: EspelhoPares.Veredito): Pair<Int, String> = when (v) {
        is EspelhoPares.Veredito.Espera ->
            202 to JSONObject().put("espera", v.id).toString()
        is EspelhoPares.Veredito.Aprovada ->
            200 to JSONObject().put("t", v.sessao.token).toString()
        is EspelhoPares.Veredito.Pendente ->
            202 to PENDENTE
        else -> 403 to RECUSADA
    }

    /**
     * O relato do cliente vira JSON, campo a campo e com os MESMOS nomes da
     * §5.5 — que são os nomes que o cliente mandou e os que o `controle.js`
     * espera ler.
     *
     * Ele é repassado, nunca reinterpretado: quem SANEIA o texto que veio da
     * rede é o [EspelhoPares] (§3.5, invariante 9), num ponto só e antes de
     * qualquer coisa chegar aqui. O `ua` termina no Registro, que é o artefato
     * que este projeto manda COPIAR e repassar — um `\n` ali injetaria linhas
     * falsas num diagnóstico, e um diagnóstico que mente é pior que
     * diagnóstico nenhum.
     */
    private fun relatoJson(r: EspelhoPares.Relato): JSONObject = JSONObject()
        .put("ua", r.ua)
        .put("w", r.w)
        .put("h", r.h)
        .put("seguro", r.seguro)
        .put("mse", r.mse)
        .put("mms", r.mms)
        .put("fetchStream", r.fetchStream)
        .put("videoDecoder", r.videoDecoder)
        .put("wakeLock", r.wakeLock)

    // ---------- utilidades ----------

    private fun responder(saida: OutputStream, bytes: ByteArray) {
        try {
            saida.write(bytes)
            saida.flush()
        } catch (e: IOException) {
            Log.i(TAG, "resposta não chegou: ${e.message}")
        }
    }

    /** O 404 canônico é do [EspelhoHttp] — rota inexistente, token inválido,
     *  `Host` recusado e `Origin` estranha respondem o MESMO, até no
     *  `Content-Length`. */
    private fun naoAchei(): ByteArray = EspelhoHttp.naoEncontrado()

    private fun rotuloNovo(): String {
        val n = proximoRotulo.getAndIncrement()
        return if (n < 26) ('A' + n).toString() else "T$n"
    }

    private fun enderecoDe(s: Socket): String =
        (s.inetAddress?.hostAddress ?: "?")

    private fun fecharQuieto(c: java.io.Closeable?) {
        try {
            c?.close()
        } catch (e: Exception) {
            // Fechar é o último ato: uma exceção aqui não muda nada.
        }
    }

    /**
     * Uma tela conectada.
     *
     * A fila é **limitada** de propósito (24 quadros ≈ 1 s de vídeo): é o
     * tamanho que separa "a rede engasgou por um instante" de "este cliente não
     * escoa", e o segundo caso tem tratamento próprio em [entregar].
     */
    private class Tela(
        val rotulo: String,
        /** O socket **CRU**, e não o `SSLSocket` que possa estar por cima — ver
         *  [fechar]. É por ele que o vigia destrava uma escrita presa. */
        val cru: Socket,
        val sessao: EspelhoPares.Sessao,
    ) {
        val fila = ArrayBlockingQueue<ByteArray>(FILA_QUADROS)

        @Volatile var esperandoIdr = true

        @Volatile var audio = false

        @Volatile var bytes = 0L

        @Volatile var descartes = 0

        @Volatile var telaAcesaMin = 0

        @Volatile var ultimaEscritaMs = SystemClock.elapsedRealtime()

        /** Quando a escrita ATUAL começou; 0 quando não há escrita em curso.
         *  É o único jeito de enxergar um `write()` travado — ver [vigiar]. */
        @Volatile var escritaIniciadaMs = 0L

        @Volatile var ultimoIdrMs = 0L

        @Volatile var viva = true

        @Volatile var motivoDaSaida = "fechou a página"
    }

    /** A rede recusou-se a servir, e a mensagem é a frase que o operador lê. */
    class Recusa(mensagem: String) : IOException(mensagem)

    /** O que [redeDaWifi] apurou: o IPv4 do aparelho na Wi-Fi. */
    data class Rede(val ip: Inet4Address)

    companion object {
        private const val TAG = "EspelhoServidor"

        const val PORTA_PADRAO = 8787

        /** Teto RÍGIDO de sessões — §3.5, invariante 8. */
        const val TETO_TELAS = 3

        /** Conexões em voo, contadas à parte do teto de telas: três TCPs mudos
         *  não podem consumir os três slots nem uma thread cada, para sempre. */
        private const val TETO_EM_VOO = 8

        private const val FILA_QUADROS = 24
        private const val PRAZO_LINHA_MS = 2_000
        private const val TETO_ESCRITA_MS = 20_000L
        private const val IDR_POR_TELA_MS = 2_000L
        private const val IDR_GLOBAL_MS = 1_000L
        private const val CABECALHO = 16

        // OS TIPOS DO FIO (§5.2) MORAM NO [EspelhoCodec], e este arquivo os lê
        // de lá. Uma segunda cópia dos mesmos seis números seria a forma mais
        // barata de fazer o servidor e o encoder discordarem sobre o que é um
        // quadro de áudio — e o sintoma apareceria no navegador de outra
        // pessoa, no meio de um culto.

        /**
         * MAPA FIXO de rota → caminho no bundle. **Nunca concatenação.**
         *
         * `/f.js` não está na tabela da §5.1 porque aquela tabela esqueceu o
         * `fmp4.js`, que a §3.11 lista como arquivo próprio. Uma rota fixa a
         * mais é inócua; um `handle("espelho/" + nome)` serviria o `controle.js`
         * inteiro para a rede. Se o cliente embutir o muxer no `cliente.js`,
         * esta linha simplesmente não é usada.
         */
        private val ESTATICOS = mapOf(
            "/" to "web/espelho/index.html",
            "/e.js" to "web/espelho/cliente.js",
            "/f.js" to "web/espelho/fmp4.js",
            "/e.css" to "web/espelho/espelho.css",
        )

        private val OK_CURTO = "{\"ok\":true}".toByteArray(Charsets.US_ASCII)
        private val RECUSADA = "{\"estado\":\"recusada\"}"
        private val PENDENTE = "{\"estado\":\"pendente\"}"
        private val LOTADO = "{\"estado\":\"lotado\"}".toByteArray(Charsets.US_ASCII)

        /** Sentinela de fim de fila: é `===` que o distingue, então ele não pode
         *  ser confundido com um quadro vazio de verdade. */
        private val FIM = ByteArray(0)

        /**
         * O IPv4 da Wi-Fi, ou uma [Recusa] com a frase pronta.
         *
         * Fica no companion porque quem liga o espelho precisa dela ANTES de
         * construir o servidor — para desenhar o endereço, o QR, e para não
         * oferecer o recurso num aparelho em dados móveis.
         */
        @JvmStatic
        fun redeDaWifi(ctx: Context): Rede {
            val cm = ctx.applicationContext.getSystemService(ConnectivityManager::class.java)
                ?: throw Recusa("sem acesso ao estado da rede")
            val net = cm.activeNetwork
                ?: throw Recusa("sem rede — o espelho so liga em Wi-Fi")
            val caps = cm.getNetworkCapabilities(net)
                ?: throw Recusa("sem rede — o espelho so liga em Wi-Fi")
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                throw Recusa("a rede ativa e uma VPN — o espelho so liga em Wi-Fi")
            }
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                throw Recusa("so liga em Wi-Fi — este aparelho esta em dados moveis")
            }
            if (!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                throw Recusa("a rede ativa nao e Wi-Fi — o espelho so liga em Wi-Fi")
            }
            val lp = cm.getLinkProperties(net)
                ?: throw Recusa("a Wi-Fi nao informou endereco a este aparelho")
            val ip = lp.linkAddresses
                .map { it.address }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress && !it.isAnyLocalAddress }
                ?: throw Recusa("a Wi-Fi nao deu endereco IPv4 a este aparelho")
            return Rede(ip)
        }
    }
}
