package br.org.iasd.av

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.nio.ByteBuffer
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * O ÁUDIO DO ESPELHO — recebe PCM do WebView do espelho e entrega AAC ao fio.
 *
 * ## A observação que destrava tudo
 *
 * **O WebView do espelho JÁ É contexto seguro.** Ele carrega
 * `https://appassets.androidplatform.net/` (invariante 1 do projeto), logo
 * `AudioWorklet` — que é `[SecureContext]` — **existe lá dentro**, mesmo com o
 * cliente da rede em `http://`. Daí o princípio geral, que merece ficar
 * escrito: *tudo o que precisa de contexto seguro pode ser movido para DENTRO
 * do WebView; só o que obrigatoriamente roda no navegador do visitante fica
 * preso ao piso `http://`.*
 *
 * ```
 * <video> do stage ──createMediaElementSource()──┬─ GainNode(0) ─→ destination   (SALÃO MUDO)
 *                                                └─ AudioWorkletNode ─ GainNode(0) ─→ destination
 *                                                        │ postMessage(ArrayBuffer Int16, ~40 ms)
 *                                                        ↓ addWebMessageListener (androidx.webkit)
 *                                                   MediaCodec AAC-LC 96 kbps
 *                                                        ↓ [0x11] no mesmo fio
 *                                          2ª SourceBuffer da MESMA MediaSource
 * ```
 *
 * **Nada disto é `MediaProjection`.** O plano anterior capturava o áudio do app
 * com `AudioPlaybackCapture`, o que exigia diálogo de consentimento por sessão,
 * indicador de gravação de tela antes de projetar num culto — e, pior, o mesmo
 * documento mandava silenciar o espelho, de modo que capturaria silêncio. Aqui
 * o som some do salão pelo próprio ROTEAMENTO: criado o
 * `MediaElementAudioSourceNode`, o áudio do elemento passa a existir só dentro
 * do grafo. (`video.muted` **não** é o mecanismo: mutar o elemento zera também
 * a saída do nó de Web Audio.)
 *
 * ## O contrato com o lado web, e ele é de mão dupla
 *
 * O objeto injetado chama-se **`__avEspelhoAudio`** e aceita três formas:
 *
 * | o que o JS manda | o que acontece |
 * |---|---|
 * | `postMessage('{"sr":48000,"ch":2}')` | configura e liga o encoder; a resposta `{"ok":true}` volta pelo `onmessage` do próprio objeto |
 * | `postMessage(arrayBuffer)` | um bloco de PCM **Int16 little-endian intercalado** |
 * | `postMessage('{"fim":true}')` | solta o encoder (o operador fechou o áudio) |
 *
 * A ordem é à prova de falha e está desenhada assim de propósito: o espelho
 * nasce com `forceMuted: true` (silêncio garantido) e só chama
 * `stage.setForceMuted(false)` **depois** do `{"ok":true}`. Se qualquer passo
 * falhar, o espelho fica mudo, o cliente mostra *"esta tela está sem som"* e o
 * salão continua em silêncio. **Nunca o contrário.**
 *
 * ## Blocos de ~40 ms, e não um por quantum
 *
 * `WebViewCompat.WebMessageListener.onPostMessage` é anotado **`@UiThread`**, e
 * o `AudioWorklet` processa em quanta de 128 amostras (~2,7 ms a 48 kHz): um
 * `postMessage` por quantum seriam **~375 mensagens por segundo entregues na
 * main thread** do processo que hospeda o Controle *e* a `Presentation` na TV,
 * cada uma pagando JNI, alocação e GC. Acumulando ~40 ms no worklet e já
 * convertendo para Int16, são ~25 msg/s e metade dos bytes — e a conversão sai
 * da main thread de brinde. Este arquivo confia nisso, mas não depende: o que
 * chega é enfileirado e sai da main thread na linha seguinte.
 *
 * ## As duas exceções, nomeadas
 *
 *  - **O embed do YouTube.** É um iframe de outra origem; o Web Audio não
 *    alcança o áudio dele. Aquela cena vai muda para a rede, e o cliente diz
 *    isso por um quadro `0x30`.
 *  - **O microfone ao vivo.** Push-to-talk é `getUserMedia → MediaStreamSource
 *    → GainNode → destination`, um caminho **disjunto** do `<video>` — e é uma
 *    escolha, não um acidente: capturar o FIM do grafo mandaria o microfone do
 *    santuário em AAC para três navegadores desconhecidos, em HTTP claro.
 *
 * @param onQuadro para onde vão o `csd` (`0x10`) e os quadros AAC (`0x11`) —
 *   na prática, o `difundir` do [EspelhoServidor]. O servidor decide **a quem**
 *   entregar; áudio é estritamente por cliente.
 * @param registrar linha crua para o diário do espelho.
 */
class EspelhoAudio(
    private val onQuadro: (Quadro) -> Unit,
    private val registrar: (String) -> Unit = {},
) {

    private val main = Handler(Looper.getMainLooper())

    /**
     * A fila entre a main thread (que recebe) e a thread do encoder (que
     * trabalha). Limitada: um encoder travado não pode fazer a memória do
     * processo da projeção crescer sem teto.
     */
    private val fila = ArrayBlockingQueue<ByteArray>(FILA_BLOCOS)

    @Volatile private var codec: MediaCodec? = null
    @Volatile private var thread: Thread? = null
    @Volatile private var rodando = false
    @Volatile private var instalado = false

    @Volatile private var taxa = 0
    @Volatile private var canais = 0

    /**
     * Amostras (por canal) JÁ contabilizadas — inclusive as dos blocos
     * descartados, ver [aoReceberPcm]. É o eixo de tempo do áudio.
     *
     * `AtomicLong` porque tem DOIS escritores: a thread do encoder (o caminho
     * normal) e a main thread (quando a fila enche e o bloco é perdido). Um
     * `Long` volátil perderia um incremento na corrida, e o preço seria um
     * deslocamento permanente entre o áudio e o vídeo — pequeno, silencioso e
     * impossível de investigar depois.
     */
    private val amostras = AtomicLong(0)

    @Volatile private var ancoraUs = 0L
    @Volatile private var ancorado = false

    @Volatile private var csdEnviado = false
    @Volatile private var blocos = 0L
    @Volatile private var blocosDescartados = 0L
    @Volatile private var quadrosAac = 0L
    @Volatile private var marcoBlocos = 0L
    @Volatile private var blocosNaJanela = 0
    @Volatile private var blocosPorSegundo = 0

    val ativo: Boolean get() = rodando

    // ---------- instalação ----------

    /**
     * Abre o canal binário dentro do WebView do espelho.
     *
     * **Na MAIN THREAD**, como toda interação com um WebView — e chamado
     * ANTES de o `/display/` carregar, ou o objeto não existirá quando o script
     * do grafo de áudio for procurá-lo.
     *
     * **Precisa ser chamado de novo a cada remontagem do WebView** (morte do
     * renderer): o listener é por-instância, e a `MirrorPresentation` reconstrói
     * o WebView sozinha nesse caso.
     *
     * `allowedOriginRules` é a origem EXATA do app, nunca `"*"`: este WebView
     * hospeda a IFrame Player API do YouTube **por design**, e com o curinga um
     * script de terceiro ganharia um canal binário direto para o `MediaCodec`.
     * A documentação é explícita — *"avoid using the full wildcard unless
     * absolutely necessary"* —, e o `isMainFrame` do [onPostMessage] fecha a
     * outra metade: iframe nenhum fala por aqui.
     *
     * @return `false` quando a plataforma não entrega `ArrayBuffer` por este
     *   canal (WebView antigo). Falha segura: sem áudio na rede, e o salão
     *   segue em silêncio porque quem libera o `forceMuted` é a confirmação que
     *   nunca vai chegar.
     */
    fun instalar(web: WebView?): Boolean {
        val w = web ?: return false
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            registrar("audio: este WebView nao tem canal de mensagens — espelho sem som")
            return false
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)) {
            registrar("audio: este WebView nao entrega ArrayBuffer — espelho sem som")
            return false
        }
        return try {
            WebViewCompat.addWebMessageListener(
                w,
                OBJETO_JS,
                setOf(WebViewFactory.ORIGIN),
                ouvinte,
            )
            instalado = true
            true
        } catch (e: Exception) {
            registrar("audio: nao foi possivel abrir o canal (${e.javaClass.simpleName})")
            Log.w(TAG, "addWebMessageListener falhou", e)
            false
        }
    }

    /** Fecha o canal e solta o encoder. Idempotente, e chamável de qualquer
     *  thread — a remoção do listener volta para a main sozinha. */
    fun soltar(web: WebView?) {
        pararEncoder()
        val w = web
        if (w != null && instalado) {
            val remover = Runnable {
                try {
                    WebViewCompat.removeWebMessageListener(w, OBJETO_JS)
                } catch (e: Exception) {
                    Log.w(TAG, "removeWebMessageListener falhou", e)
                }
            }
            if (Looper.myLooper() == Looper.getMainLooper()) remover.run() else main.post(remover)
        }
        instalado = false
    }

    /**
     * O diagnóstico, em JSON e sem uma frase — quem escreve
     * "áudio: contexto running · 24 blocos de PCM/s · AAC 96 kbps" é o
     * `controle.js`.
     *
     * **Blocos por segundo é o número que importa**, e é por isso que ele
     * existe: o modo de falha clássico deste desenho (um `AudioWorkletNode` sem
     * caminho até o `destination`) é zero áudio na rede, **sem exceção, sem log
     * e com o grafo aparentemente saudável**. Um contador que fica em zero é a
     * única coisa que denuncia isso.
     */
    fun paraJson(): JSONObject = JSONObject()
        .put("ligado", rodando)
        .put("taxa", taxa)
        .put("canais", canais)
        .put("blocosPorSegundo", blocosPorSegundo)
        .put("blocos", blocos)
        .put("descartados", blocosDescartados)
        .put("quadros", quadrosAac)
        .put("bitrate", BITRATE)

    // ---------- o canal ----------

    private val ouvinte = object : WebViewCompat.WebMessageListener {
        override fun onPostMessage(
            view: WebView,
            message: WebMessageCompat,
            sourceOrigin: Uri,
            isMainFrame: Boolean,
            replyProxy: JavaScriptReplyProxy,
        ) {
            // DUAS GUARDAS, e nenhuma é redundante com o `allowedOriginRules`:
            // ele limita a ORIGEM, mas não distingue o documento do IFRAME dele
            // — e o iframe aqui é de terceiro por design (a IFrame Player API
            // do YouTube). Com `isMainFrame` falso, ninguém fala por este canal.
            if (!isMainFrame) return
            if (!daNossaOrigem(sourceOrigin)) return
            try {
                quandoChega(message, replyProxy)
            } catch (e: Exception) {
                Log.w(TAG, "mensagem de áudio ignorada", e)
            }
        }
    }

    private fun daNossaOrigem(origem: Uri?): Boolean =
        origem == null || origem.host == null || origem.host == WebViewFactory.ORIGIN_HOST

    /** Roda na MAIN THREAD (`@UiThread` do `onPostMessage`): tudo aqui é curto,
     *  e o trabalho de verdade acontece na thread do encoder. */
    private fun quandoChega(message: WebMessageCompat, replyProxy: JavaScriptReplyProxy) {
        if (message.type == WebMessageCompat.TYPE_ARRAY_BUFFER) {
            aoReceberPcm(message.arrayBuffer)
            return
        }
        val texto = message.data ?: return
        if (texto.length > TETO_TEXTO) return
        val json = try {
            JSONObject(texto)
        } catch (e: Exception) {
            return
        }
        if (json.optBoolean("fim", false)) {
            pararEncoder()
            return
        }
        val sr = json.optInt("sr", 0)
        val ch = json.optInt("ch", 0)
        val erro = ligarEncoder(sr, ch)
        val resposta = if (erro == null) {
            JSONObject().put("ok", true).put("sr", sr).put("ch", ch)
        } else {
            JSONObject().put("ok", false).put("erro", erro)
        }
        // A RESPOSTA É O QUE LIBERA O SOM DO SALÃO A SUMIR: só depois dela o
        // lado web chama `setForceMuted(false)`. Sem ela, o espelho fica mudo —
        // que é a falha segura.
        try {
            replyProxy.postMessage(resposta.toString())
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível responder ao grafo de áudio", e)
        }
    }

    private fun aoReceberPcm(bytes: ByteArray) {
        if (!rodando) return
        if (bytes.isEmpty() || bytes.size > TETO_BLOCO) return
        contarBloco()
        if (fila.offer(bytes)) return
        // A FILA ENCHEU: o encoder não escoa. O bloco é perdido, mas as
        // amostras dele **contam** — o eixo de tempo do áudio é o tempo real, e
        // não a soma do que coube. Descontá-las empurraria todo o resto do
        // culto para trás, um buraco de cada vez, e o desencontro com o vídeo
        // só cresceria.
        blocosDescartados++
        val quadro = 2 * canais
        if (quadro > 0) amostras.addAndGet((bytes.size / quadro).toLong())
    }

    private fun contarBloco() {
        blocos++
        val agora = SystemClock.elapsedRealtime()
        if (marcoBlocos == 0L) marcoBlocos = agora
        blocosNaJanela++
        val decorrido = agora - marcoBlocos
        if (decorrido >= 1_000) {
            blocosPorSegundo = ((blocosNaJanela * 1000L) / decorrido).toInt()
            blocosNaJanela = 0
            marcoBlocos = agora
        }
    }

    // ---------- encoder ----------

    /** @return `null` quando ligou; a razão, em texto, quando não. */
    private fun ligarEncoder(sr: Int, ch: Int): String? {
        if (rodando) {
            // Reconfigurar no meio do caminho mudaria o eixo de tempo do áudio
            // sem avisar o cliente. O grafo é criado UMA vez, na abertura do
            // espelho (`createMediaElementSource` é porta de mão única), então
            // uma segunda configuração é sinal de recarga da página — e aí o
            // caminho certo é soltar e instalar de novo.
            return if (sr == taxa && ch == canais) null else "encoder ja ligado em $taxa Hz"
        }
        if (sr !in TAXAS_AAC) return "taxa de amostragem nao suportada: $sr"
        if (ch !in 1..2) return "numero de canais invalido: $ch"
        val c = try {
            val fmt = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sr, ch).apply {
                setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                setInteger(MediaFormat.KEY_BIT_RATE, BITRATE)
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, TETO_BLOCO)
            }
            MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC).apply {
                configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
                start()
            }
        } catch (e: Exception) {
            registrar("audio: encoder AAC nao subiu (${e.javaClass.simpleName})")
            Log.w(TAG, "encoder AAC não subiu", e)
            return "encoder AAC nao subiu"
        }
        taxa = sr
        canais = ch
        amostras.set(0)
        ancorado = false
        csdEnviado = false
        quadrosAac = 0
        fila.clear()
        codec = c
        rodando = true
        thread = Thread({ laco(c) }, "av-espelho-aac").apply { isDaemon = true }
        thread?.start()
        registrar("audio: AAC-LC ${BITRATE / 1000} kbps, $sr Hz, $ch canal(is)")
        return null
    }

    private fun pararEncoder() {
        if (!rodando && codec == null) return
        rodando = false
        val t = thread
        thread = null
        try {
            t?.join(500)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        }
        val c = codec
        codec = null
        try {
            c?.stop()
        } catch (e: Exception) {
            // Um encoder em estado terminal recusa `stop`; o `release` abaixo é
            // o que de fato devolve o silício.
        }
        try {
            c?.release()
        } catch (e: Exception) {
            Log.w(TAG, "falhou soltando o encoder AAC", e)
        }
        fila.clear()
        taxa = 0
        canais = 0
        blocosPorSegundo = 0
    }

    /**
     * O laço do encoder, numa thread só dele.
     *
     * Alimenta e drena no mesmo giro: os dois lados do `MediaCodec` síncrono
     * dependem um do outro, e um laço que só alimentasse travaria assim que os
     * buffers de saída acabassem.
     */
    private fun laco(c: MediaCodec) {
        val info = MediaCodec.BufferInfo()
        while (rodando) {
            val bloco = try {
                fila.poll(50, TimeUnit.MILLISECONDS)
            } catch (e: InterruptedException) {
                break
            }
            if (bloco != null) alimentar(c, bloco)
            if (!drenar(c, info)) break
        }
    }

    private fun alimentar(c: MediaCodec, bloco: ByteArray) {
        val quadro = 2 * canais
        if (quadro <= 0) return
        var off = 0
        var tentativas = 0
        while (off < bloco.size && rodando) {
            val idx = try {
                c.dequeueInputBuffer(ESPERA_US)
            } catch (e: IllegalStateException) {
                return
            }
            if (idx < 0) {
                // Sem buffer de entrada agora: drena a saída (é o que os
                // libera) e tenta de novo, com teto. Insistir para sempre
                // seguraria a thread e a fila cresceria atrás.
                val info = MediaCodec.BufferInfo()
                if (!drenar(c, info)) return
                if (++tentativas > TENTATIVAS) {
                    blocosDescartados++
                    return
                }
                continue
            }
            tentativas = 0
            val buf = entrada(c, idx) ?: return
            buf.clear()
            val cabe = minOf(buf.remaining(), bloco.size - off)
            // ALINHADO AO QUADRO DE AMOSTRAS: partir uma amostra de 16 bits (ou
            // um par estéreo) ao meio troca os canais do resto do bloco e sai
            // como estalo na caixa de som do templo.
            val n = cabe - (cabe % quadro)
            if (n <= 0) {
                try {
                    c.queueInputBuffer(idx, 0, 0, ptsAgora(), 0)
                } catch (e: IllegalStateException) {
                    // nada a fazer: o encoder saiu de estado
                }
                return
            }
            buf.put(bloco, off, n)
            try {
                c.queueInputBuffer(idx, 0, n, ptsAgora(), 0)
            } catch (e: IllegalStateException) {
                return
            }
            amostras.addAndGet((n / quadro).toLong())
            off += n
        }
    }

    /** O buffer de entrada, ou `null` se o encoder saiu de estado. Existe como
     *  função para o `try` não se misturar com o elvis no ponto de uso. */
    private fun entrada(c: MediaCodec, idx: Int): ByteBuffer? = try {
        c.getInputBuffer(idx)
    } catch (e: IllegalStateException) {
        null
    }

    private fun saida(c: MediaCodec, idx: Int): ByteBuffer? = try {
        c.getOutputBuffer(idx)
    } catch (e: IllegalStateException) {
        null
    }

    /**
     * O PTS do próximo bloco, no MESMO eixo do vídeo.
     *
     * A âncora é `EspelhoCodec.ultimoCarimbo()` no instante do primeiro bloco —
     * e não um `System.nanoTime()`. O motivo é o mesmo que aquele arquivo já
     * escreve: os carimbos da *input surface* vêm do `BufferQueue`, e supor que
     * eles são o mesmo relógio lido noutro ponto do código é supor uma
     * igualdade que a plataforma não promete. Ancorar no último carimbo de
     * VÍDEO amarra as duas faixas ao mesmo eixo por construção, com o erro de
     * um intervalo de quadro (~33 ms), que é menor que a latência do próprio
     * grafo de áudio.
     *
     * Daí em diante o tempo anda por CONTAGEM DE AMOSTRAS, não por relógio: a
     * taxa do worklet é a do hardware de áudio, e é ela que manda. E **nunca há
     * reancoragem**: um `tfdt` que salte para a frente abre buraco no
     * `buffered`, e navegador **para em buraco**.
     */
    private fun ptsAgora(): Long {
        if (!ancorado) {
            ancoraUs = EspelhoCodec.ultimoCarimbo()
            ancorado = true
        }
        val t = taxa
        if (t <= 0) return ancoraUs
        return ancoraUs + amostras.get() * 1_000_000L / t
    }

    /** @return `false` quando o encoder saiu de estado e o laço deve parar. */
    private fun drenar(c: MediaCodec, info: MediaCodec.BufferInfo): Boolean {
        while (true) {
            // `CodecException` PRIMEIRO: ela herda de `IllegalStateException`,
            // e na ordem inversa o segundo `catch` seria código morto.
            val idx = try {
                c.dequeueOutputBuffer(info, 0)
            } catch (e: MediaCodec.CodecException) {
                Log.w(TAG, "encoder AAC caiu", e)
                return false
            } catch (e: IllegalStateException) {
                return false
            }
            if (idx == MediaCodec.INFO_TRY_AGAIN_LATER) return true
            if (idx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                csdDoFormato(c)
                continue
            }
            // INFO_OUTPUT_BUFFERS_CHANGED e qualquer outro negativo: ignorados
            // em silêncio, como manda a documentação do MediaCodec.
            if (idx < 0) continue
            val buf = saida(c, idx)
            if (buf != null && info.size > 0) {
                buf.position(info.offset)
                buf.limit(info.offset + info.size)
                val bytes = ByteArray(info.size)
                buf.get(bytes)
                if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                    enviarCsd(bytes)
                } else {
                    // Um quadro AAC é SEMPRE ponto de sincronismo — não existe
                    // "quadro AAC intermediário" —, e o cliente conta com isso
                    // para começar a tocar de onde entrou.
                    quadrosAac++
                    onQuadro(
                        Quadro(
                            tipo = EspelhoCodec.TIPO_AUDIO,
                            chave = true,
                            descontinuidade = false,
                            ptsUs = info.presentationTimeUs,
                            bytes = bytes,
                        ),
                    )
                }
            }
            try {
                c.releaseOutputBuffer(idx, false)
            } catch (e: IllegalStateException) {
                return false
            }
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return false
        }
    }

    private fun csdDoFormato(c: MediaCodec) {
        val f = try {
            c.outputFormat
        } catch (e: Exception) {
            return
        }
        val b = f.getByteBuffer("csd-0")?.duplicate() ?: return
        val bytes = ByteArray(b.remaining())
        b.get(bytes)
        enviarCsd(bytes)
    }

    /**
     * O `AudioSpecificConfig` — dois bytes, e o `MediaCodec` os entrega prontos.
     *
     * É por isso que a segunda `SourceBuffer` custa ~10 linhas de JS no cliente
     * em vez das 150–200 de um `AudioWorklet` com ring buffer, relógio e
     * deriva: a sincronia A/V é do NAVEGADOR, uma `MediaSource`, uma linha do
     * tempo. Vai uma vez por sessão; um `csd` repetido não faz mal (o cliente o
     * ignora), mas um `csd` que nunca chega deixa a faixa de áudio sem
     * `esds` — e sem `esds` não há o que tocar.
     */
    private fun enviarCsd(bytes: ByteArray) {
        if (bytes.isEmpty() || csdEnviado) return
        csdEnviado = true
        onQuadro(
            Quadro(
                tipo = EspelhoCodec.TIPO_CSD_AUDIO,
                chave = true,
                descontinuidade = false,
                ptsUs = ptsAgora(),
                bytes = bytes,
            ),
        )
    }

    companion object {
        private const val TAG = "EspelhoAudio"

        /** O nome do objeto injetado no `window` do WebView do espelho. */
        const val OBJETO_JS = "__avEspelhoAudio"

        /** 96 kbps AAC-LC: ~8× menos banda que PCM cru pelo canal lateral, e
         *  transparente para voz e louvor num salão. */
        const val BITRATE = 96_000

        private const val FILA_BLOCOS = 64

        /** ~40 ms de estéreo a 48 kHz são 7,7 kB; 64 kB é teto de sanidade, não
         *  de operação — e existe para que uma mensagem gigante não vire uma
         *  alocação gigante na main thread. */
        private const val TETO_BLOCO = 64 * 1024

        private const val TETO_TEXTO = 512
        private const val ESPERA_US = 10_000L
        private const val TENTATIVAS = 50

        /** As taxas que o AAC aceita. Um `AudioContext` de WebView entrega
         *  48000 (ou 44100 em alguns aparelhos); o resto está aqui para que um
         *  valor estranho vire uma RECUSA com texto em vez de um encoder que
         *  configura e não emite nada. */
        private val TAXAS_AAC = setOf(
            8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000, 88200, 96000,
        )
    }
}
