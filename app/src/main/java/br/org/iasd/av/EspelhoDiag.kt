package br.org.iasd.av

import android.content.Context
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.SystemClock
import android.util.Log
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream

/**
 * O anel de diagnóstico do espelho de pixels — e ele **devolve DADO, nunca
 * frase**.
 *
 * ## O invariante único deste arquivo
 *
 * **O Kotlin entrega JSON; quem monta a frase é o `controle.js`.** É o que o
 * resto do projeto já faz (`otaDiag`, `ytDiag` — os dois nasceram string e são
 * exceção histórica, não modelo), é o que respeita a invariante 5 do
 * `CLAUDE.md` ("não reimplementar em Kotlin nada que já exista em JS") e é o
 * que torna a sanitização de texto vindo da rede auditável **num ponto só**.
 * Um `EspelhoDiag` que formata parágrafos é UI de diagnóstico escrita em
 * Kotlin, e este projeto faz o contrário.
 *
 * Corolário prático: a linha "ritmo" do Registro (§7.5 da especificação) NÃO é
 * decidida aqui. Este arquivo entrega `kbps` e `fps` medidos; quem os cruza com
 * a cena — "tem vídeo tocando?", "a cortina está aberta?" — é o `controle.js`,
 * que é o único lado que sabe o que é uma cena. O Kotlin não pode opinar sobre
 * conteúdo, e um alarme falso disparado durante uma oração com a cortina
 * fechada iria parar num Registro **com botão de copiar**, para ser repassado.
 * Diagnóstico que mente é pior que diagnóstico nenhum.
 *
 * ## Por que um anel, e por que com carimbo de relógio de parede
 *
 * O espelho pode ficar horas no ar; guardar tudo seria vazamento de memória
 * lento num processo que também hospeda dois WebViews e a projeção. [TETO_LINHAS]
 * cobre com folga a janela que interessa (ligar → parear → falhar), e o que sai
 * é o mais velho.
 *
 * Cada linha carrega `em` = `System.currentTimeMillis()` porque o Registro
 * mostra hora de parede ("última desconexão: tela C · 12:41"), e `System
 * .currentTimeMillis` é a única fonte disso. As MEDIÇÕES de intervalo, ao
 * contrário, usam [SystemClock.elapsedRealtime] — que não anda para trás quando
 * o relógio do aparelho é ajustado, e é a mesma disciplina já escrita no
 * `WebUpdater`.
 *
 * ## Thread-safety não é opcional aqui
 *
 * As escritas chegam de pelo menos três threads diferentes: a main (ciclo de
 * vida da tela virtual), a thread de dreno do `MediaCodec` (as amostras, a
 * ~30 Hz) e, a partir do P5, uma thread por cliente do servidor. A leitura
 * (`paraJson`) chega de uma quarta: a thread do WebView que atende
 * `@JavascriptInterface`. Um `ArrayDeque` sem lock aqui daria
 * `ConcurrentModificationException` dentro da ponte — isto é, um diagnóstico
 * que quebra justamente quando alguém foi olhá-lo.
 */
class EspelhoDiag {

    private val trava = Any()

    /** Anel de linhas. Ver o KDoc da classe: o mais velho sai. */
    private val linhas = ArrayDeque<Linha>()

    /**
     * Fatos estruturados (tela virtual, readback, encoder, térmica…), por
     * chave. `LinkedHashMap` para a ordem de inserção sobreviver ao JSON — ela
     * não muda o significado de nada, mas mantém o objeto legível quando
     * alguém abre o Registro copiado num editor.
     */
    private val fatos = LinkedHashMap<String, Any?>()

    // ---------- o ritmo (bytes e quadros por segundo, janela deslizante) ----------

    private val bytesPorSeg = LongArray(JANELA_S)
    private val quadrosPorSeg = IntArray(JANELA_S)
    private var segundoAtual = -1L

    private data class Linha(val em: Long, val txt: String)

    /**
     * Registra uma linha do diário do espelho.
     *
     * [linha] é **saneada aqui também**, e isso é defesa em profundidade, não
     * duplicação: o texto que vem da rede (o `ua` de um cliente, por exemplo) já
     * é saneado no `EspelhoPares` antes de chegar perto daqui, mas um `\n` que
     * escapasse injetaria **linhas falsas** num artefato que o projeto manda
     * copiar e repassar (`copiarTexto`, no `controle.js`). O custo de sanear
     * duas vezes é um laço sobre 240 caracteres; o custo de não sanear é um
     * Registro forjado.
     */
    fun registrar(linha: String) {
        val txt = sanear(linha)
        if (txt.isEmpty()) return
        synchronized(trava) {
            linhas.addLast(Linha(System.currentTimeMillis(), txt))
            while (linhas.size > TETO_LINHAS) linhas.removeFirst()
        }
    }

    /**
     * Uma amostra de saída: [bytes] entregues e [quadros] produzidos.
     *
     * Chamada uma vez por quadro que sai do encoder (ou do compressor JPEG, no
     * modo imagem). Os dois números alimentam a MESMA janela porque a pergunta
     * do §7.5 é uma só — "isto aqui está se movendo?" — e ela precisa dos dois:
     * um retângulo preto produz quadros minúsculos **e** raros, e cada número
     * sozinho tem uma explicação inocente (cena parada; faixa grande).
     *
     * `quadros = 0` é legítimo e é o caso do quadro de `csd`: ele gasta bytes e
     * não é imagem nenhuma.
     */
    fun amostra(bytes: Int, quadros: Int) {
        synchronized(trava) {
            val s = SystemClock.elapsedRealtime() / 1000L
            avancar(s)
            val i = (s % JANELA_S).toInt()
            bytesPorSeg[i] += bytes.toLong()
            quadrosPorSeg[i] += quadros
        }
    }

    /**
     * Publica um fato estruturado. `null` apaga a chave — é assim que o
     * `desligar()` faz o readback e a tela virtual sumirem do Registro em vez de
     * ficarem lá descrevendo um estado que não existe mais.
     *
     * Não está no esboço da especificação porque lá o §3.8 lista só as três
     * operações; sem esta, cada campo do §7.6 (`tela virtual: … @ … dpi`,
     * `readback: …`, `encoder: …`) teria de virar texto pré-formatado — que é
     * exatamente o que o invariante deste arquivo proíbe.
     *
     * [valor] tem de ser algo que o `JSONObject` saiba serializar: `String`,
     * `Int`, `Long`, `Double`, `Boolean`, `JSONObject` ou `JSONArray`. Um objeto
     * qualquer viraria `toString()` silenciosamente, que é a forma de falhar
     * preferida deste projeto — daí o filtro explícito.
     */
    fun fato(chave: String, valor: Any?) {
        synchronized(trava) {
            if (valor == null) {
                fatos.remove(chave)
            } else {
                fatos[chave] = when (valor) {
                    is String -> sanear(valor)
                    is Int, is Long, is Double, is Float, is Boolean,
                    is JSONObject, is JSONArray -> valor
                    // Nunca `toString()` calado: um tipo inesperado aqui é um
                    // erro de quem chamou, e ele precisa aparecer no Registro.
                    else -> "?" + valor.javaClass.simpleName
                }
            }
        }
    }

    /**
     * O JSON inteiro, pronto para o `espelhoDiag()` da ponte devolver.
     *
     * Formato:
     * ```json
     * { "linhas": [ {"em": 1765..., "txt": "…"} ],
     *   "ritmo":  { "kbps": 340, "fps": 1.2, "janelaMs": 10000 },
     *   "…fatos": … }
     * ```
     * Os fatos entram na RAIZ, não num objeto aninhado: o consumidor é uma
     * função de montagem de texto no `controle.js`, e um nível a menos de
     * indireção ali é uma linha a menos que pode errar o caminho em silêncio.
     * As duas chaves reservadas são `linhas` e `ritmo` — um `fato("ritmo", …)`
     * seria sobrescrito, e por isso o nome está dito aqui.
     */
    fun paraJson(): JSONObject = synchronized(trava) {
        val o = JSONObject()
        val arr = JSONArray()
        for (l in linhas) arr.put(JSONObject().put("em", l.em).put("txt", l.txt))
        o.put("linhas", arr)

        avancar(SystemClock.elapsedRealtime() / 1000L)
        var bytes = 0L
        var quadros = 0
        for (i in 0 until JANELA_S) {
            bytes += bytesPorSeg[i]
            quadros += quadrosPorSeg[i]
        }
        o.put(
            "ritmo",
            JSONObject()
                // kbps é *quilo*bit por segundo decimal (1000), como todo
                // número de rede — não KiB. A conta é bytes×8÷1000÷janela.
                .put("kbps", Math.round(bytes * 8.0 / 1000.0 / JANELA_S).toInt())
                .put("fps", Math.round(quadros * 10.0 / JANELA_S) / 10.0)
                .put("janelaMs", JANELA_S * 1000),
        )

        for ((k, v) in fatos) o.put(k, v)
        // Última EXPRESSÃO do bloco, e não `return o`: `synchronized` é inline,
        // então um `return` aqui seria um retorno não-local de uma função de
        // corpo-expressão — que o compilador recusa.
        o
    }

    /**
     * Move a janela para o segundo [s], zerando os baldes que ficaram para
     * trás.
     *
     * Sem esta limpeza a janela nunca esvaziaria: um espelho que parou de
     * produzir há dez minutos continuaria exibindo o bitrate do último segundo
     * em que produziu, **para sempre** — e é justamente o estado que a linha
     * "ritmo" existe para denunciar (a `MirrorPresentation` morta com o encoder
     * vivo). Um detector que mostra o passado como se fosse o presente é pior
     * que nenhum.
     */
    private fun avancar(s: Long) {
        if (segundoAtual < 0L) {
            segundoAtual = s
            return
        }
        if (s <= segundoAtual) return
        val passos = minOf(s - segundoAtual, JANELA_S.toLong()).toInt()
        for (k in 1..passos) {
            val i = ((segundoAtual + k) % JANELA_S).toInt()
            bytesPorSeg[i] = 0L
            quadrosPorSeg[i] = 0
        }
        segundoAtual = s
    }

    private fun sanear(s: String): String {
        val sb = StringBuilder()
        for (ch in s) {
            if (sb.length >= TETO_TEXTO) break
            val c = ch.code
            sb.append(if (c < 0x20 || c == 0x7F) ' ' else ch)
        }
        return sb.toString().trim()
    }

    companion object {
        /** Linhas guardadas. Ver o KDoc da classe. */
        private const val TETO_LINHAS = 60

        /** Corte duro de cada linha e de cada fato de texto. */
        private const val TETO_TEXTO = 240

        /**
         * 10 s de janela. É o mesmo horizonte que a especificação usa na linha
         * "ritmo", e ele é curto o bastante para o operador ver o número reagir
         * enquanto olha, e longo o bastante para uma cena parada (um quadro por
         * segundo, por causa do batimento) render mais de uma amostra.
         */
        private const val JANELA_S = 10
    }
}

/**
 * O CLIPE DA SONDA, produzido pelo próprio aparelho.
 *
 * ## Por que ele não é um arquivo no bundle
 *
 * A `sonda.html` pede um `sonda.mp4`: dois segundos de magenta puro (`#FF00FF`)
 * em 320×180, uma cor que não existe em lugar nenhum da paleta — lê-la de volta
 * num pixel do framebuffer só pode significar que a camada de vídeo entrou na
 * composição. O KDoc daquele arquivo manda produzi-lo com `ffmpeg`.
 *
 * **Versionar o binário seria peso morto que ninguém saberia regenerar**: um
 * arquivo opaco em `assets/web/`, fora de qualquer teste, cuja receita mora num
 * comentário. O aparelho já tem as duas metades para fazê-lo sozinho — o
 * `MediaCodec` que o [EspelhoCodec] usa para encodar H.264 e o `MediaMuxer` que
 * o [MuxMp4] usa para escrever MP4 —, e o resultado são alguns kB no cache,
 * gerados uma vez.
 *
 * ## E isto NÃO é circular
 *
 * A pergunta que a sonda existe para responder é sobre o **decodificador** e a
 * composição: *o vídeo decodificado chega ao framebuffer de um `VirtualDisplay`
 * privado?* Que o **encoder** funciona é pressuposto do recurso inteiro (sem
 * ele não há espelho nenhum) e falha ruidosamente muito antes — no `ligar()`,
 * com frase. Usar um para testar o outro é usar a metade provada para
 * interrogar a metade em dúvida.
 *
 * ## A falha tem frase PRÓPRIA, e é o ponto mais importante daqui
 *
 * Se a geração falhar, o `<video>` não carrega e o centro da tela fica preto —
 * **indistinguível de "o vídeo sai preto"**, que é justamente o veredito grave.
 * Por isso [ultimoErro] existe e por isso a `sonda.html` publica
 * `__sondaEstado().arquivo` (`ok|erro|esperando`): o `EspelhoDisplay` cruza os
 * dois e rebaixa o veredito a `INDEFINIDO` com o motivo escrito. "Não consegui
 * gerar o clipe" nunca pode ser lido como "a composição está quebrada".
 *
 * ## Por que ele mora neste arquivo
 *
 * Porque é INSTRUMENTO, não mecanismo — a mesma família do anel de diagnóstico
 * acima. Nada do espelho de produção depende de uma linha daqui: apagar este
 * objeto tira a sonda e não tira um quadro do telão.
 */
object SondaClipe {

    private const val TAG = "SondaClipe"

    /** O nome que a `sonda.html` pede, ao lado dela. */
    const val ARQUIVO = "sonda.mp4"

    private const val LARG = 320
    private const val ALT = 180
    private const val FPS = 15
    private const val SEGUNDOS = 2
    private const val BITRATE = 400_000
    private const val ESPERA_US = 10_000L

    /** Teto de tempo da geração. Ver [gerar]. */
    private const val PRAZO_MS = 10_000L

    /**
     * `#FF00FF` em YUV 4:2:0, BT.601 faixa limitada — a conversão que um
     * encoder de aparelho assume por padrão nesta resolução.
     *
     * O valor exato importa pouco de propósito: quem confere o pixel do outro
     * lado pergunta pela FAMÍLIA da cor (vermelho e azul altos, verde baixo), e
     * não por igualdade — entre este byte e o pixel lido há um decodificador de
     * hardware e uma conversão de volta cuja matriz ninguém negocia. Exigir
     * igualdade seria a sonda medindo a própria imprecisão.
     */
    private const val Y_MAGENTA = 107
    private const val U_MAGENTA = 202
    private const val V_MAGENTA = 222

    /**
     * A frase da última falha de geração, ou vazio. Lida pelo `EspelhoDisplay`
     * ao montar o veredito — ver o KDoc do objeto.
     */
    @Volatile
    var ultimoErro: String = ""
        private set

    /**
     * O clipe, gerando-o se ainda não existir no cache. `null` = não deu, e
     * [ultimoErro] diz por quê.
     *
     * `@Synchronized` porque há dois chamadores concorrentes por construção: o
     * pré-aquecimento disparado pelo `EspelhoDisplay.sonda()` e a requisição do
     * `<video>`, que chega numa thread do WebView. Sem a trava, os dois
     * gerariam ao mesmo tempo, para o mesmo arquivo, com duas instâncias de
     * encoder — e o segundo poderia servir um MP4 pela metade.
     */
    @Synchronized
    fun garantir(ctx: Context): File? {
        val pasta = File(ctx.applicationContext.cacheDir, "av-espelho")
        val destino = File(pasta, ARQUIVO)
        // O cache é do sistema: ele pode sumir a qualquer momento, e a resposta
        // certa é gerar de novo, não guardar um ponteiro para o que não existe.
        if (destino.isFile && destino.length() > 0L) return destino

        pasta.mkdirs()
        val tmp = File(pasta, "sonda-${System.nanoTime()}.tmp")
        return try {
            gerar(tmp)
            check(tmp.length() > 0L) { "o muxer não escreveu nada" }
            // Publicação atômica: nenhum leitor pode encontrar um MP4 pela
            // metade em `sonda.mp4`.
            check(tmp.renameTo(destino)) { "não deu para publicar no cache" }
            ultimoErro = ""
            Log.i(TAG, "clipe da sonda gerado (${destino.length()} B)")
            destino
        } catch (e: Throwable) {
            ultimoErro = "o aparelho não gerou o clipe da sonda " +
                "(${e.javaClass.simpleName}: ${e.message})"
            Log.w(TAG, ultimoErro, e)
            try { tmp.delete() } catch (_: Exception) { }
            null
        }
    }

    /**
     * Encoda [SEGUNDOS] segundos de magenta e escreve o MP4 em [saida].
     *
     * Entrada por **ByteBuffer**, não por Surface: a *input surface* de um
     * `MediaCodec` é um produtor de BufferQueue para a GPU, e desenhar nela com
     * `lockCanvas` é território não suportado. Preencher planos YUV à mão não
     * depende de EGL, de GLES nem de nada além do que já está aqui — e a imagem
     * é uma cor sólida, então "desenhar" é escrever um byte.
     *
     * O laço tem **prazo** ([PRAZO_MS]): ele roda numa thread do WebView
     * atendendo a requisição de um `<video>`, e um encoder que nunca devolve
     * buffer travaria o carregamento da página para sempre — sem erro, que é o
     * pior desfecho.
     */
    private fun gerar(saida: File) {
        val fmt = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, LARG, ALT).apply {
            // FLEXIBLE + `getInputImage`: é o par que dispensa saber se o
            // encoder deste aparelho quer planar ou semi-planar. Escolher um
            // formato concreto é a receita clássica de um clipe com as cores
            // trocadas em metade dos aparelhos.
            setInteger(
                MediaFormat.KEY_COLOR_FORMAT,
                MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible,
            )
            setInteger(MediaFormat.KEY_BIT_RATE, BITRATE)
            setInteger(MediaFormat.KEY_FRAME_RATE, FPS)
            // 1 s: o clipe tem 2 s e toca em laço, então ele precisa de
            // quadro-chave cedo — um `loop` que volte para um P-frame não
            // desenha nada.
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }

        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        var muxer: MediaMuxer? = null
        var trilha = -1
        var iniciado = false
        var fechou = false
        try {
            codec.configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            codec.start()
            // Um `val` não-nulo para o laço usar, e o `var` só para o `finally`
            // alcançar: assim nenhuma linha daqui para baixo depende de smart
            // cast sobre variável mutável.
            val m = MediaMuxer(saida.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            muxer = m

            val info = MediaCodec.BufferInfo()
            val total = FPS * SEGUNDOS
            var enviados = 0
            var fim = false
            val limite = SystemClock.elapsedRealtime() + PRAZO_MS

            while (!fim) {
                check(SystemClock.elapsedRealtime() < limite) { "o encoder não respondeu a tempo" }

                if (enviados <= total) {
                    val ie = codec.dequeueInputBuffer(ESPERA_US)
                    if (ie >= 0) {
                        if (enviados == total) {
                            codec.queueInputBuffer(
                                ie, 0, 0, ptsDe(enviados),
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                            )
                        } else {
                            val bytes = pintar(codec, ie)
                            codec.queueInputBuffer(ie, 0, bytes, ptsDe(enviados), 0)
                        }
                        enviados++
                    }
                }

                val os = codec.dequeueOutputBuffer(info, ESPERA_US)
                when {
                    os == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        // O `csd` entra pelo FORMATO, não como amostra: é por
                        // isso que o buffer com CODEC_CONFIG é descartado
                        // abaixo. Escrevê-lo como amostra produz um MP4 que
                        // alguns decodificadores recusam.
                        trilha = m.addTrack(codec.outputFormat)
                        m.start()
                        iniciado = true
                    }
                    os < 0 -> Unit
                    else -> {
                        val buf = codec.getOutputBuffer(os)
                        val ehConfig = (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                        if (buf != null && info.size > 0 && !ehConfig && iniciado) {
                            buf.position(info.offset)
                            buf.limit(info.offset + info.size)
                            m.writeSampleData(trilha, buf, info)
                        }
                        codec.releaseOutputBuffer(os, false)
                        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) fim = true
                    }
                }
            }
            check(iniciado) { "o encoder não publicou o formato de saída" }
            fechou = true
        } finally {
            try { codec.stop() } catch (_: Exception) { }
            try { codec.release() } catch (_: Exception) { }
            if (muxer != null) {
                // `stop()` é o que escreve o `moov`. Sem ele o arquivo existe,
                // tem bytes, e nenhum tocador abre — a falha mais cara possível
                // aqui, porque o `length() > 0` do chamador passaria.
                if (iniciado && fechou) {
                    try { muxer.stop() } catch (e: Exception) { Log.w(TAG, "muxer não fechou", e) }
                }
                try { muxer.release() } catch (_: Exception) { }
            }
        }
    }

    private fun ptsDe(quadro: Int): Long = quadro * 1_000_000L / FPS

    /**
     * Pinta o quadro [idx] de magenta e devolve o tamanho em bytes de um quadro
     * YUV 4:2:0.
     */
    private fun pintar(codec: MediaCodec, idx: Int): Int {
        val img = codec.getInputImage(idx)
            ?: throw IllegalStateException("o encoder não aceitou YUV flexível")
        preencher(img.planes[0], img.width, img.height, Y_MAGENTA, croma = false)
        preencher(img.planes[1], img.width, img.height, U_MAGENTA, croma = true)
        preencher(img.planes[2], img.width, img.height, V_MAGENTA, croma = true)
        return LARG * ALT * 3 / 2
    }

    /**
     * Escreve [valor] em todo o plano, **honrando `rowStride` e `pixelStride`**.
     *
     * Os dois não são decoração: o driver alinha as linhas, e num formato
     * semi-planar (NV12) os planos U e V são o MESMO buffer intercalado, com
     * `pixelStride = 2`. Escrever linearmente produziria faixas coloridas em
     * metade dos aparelhos — e, pior, funcionaria neste.
     */
    private fun preencher(plano: Image.Plane, w: Int, h: Int, valor: Int, croma: Boolean) {
        val buf = plano.buffer
        val linhas = if (croma) (h + 1) / 2 else h
        val colunas = if (croma) (w + 1) / 2 else w
        val b = valor.toByte()
        for (y in 0 until linhas) {
            var off = y * plano.rowStride
            for (x in 0 until colunas) {
                if (off >= buf.limit()) break
                buf.put(off, b)
                off += plano.pixelStride
            }
        }
    }
}

/**
 * Serve `/web/espelho/` **para o documento da sonda, e só para ele**.
 *
 * Existe por um motivo só: `sonda.mp4` não está no bundle nem nunca vai estar —
 * ele é gerado no aparelho ([SondaClipe]) e vive no cache, que nenhum
 * `PathHandler` do projeto alcança. O resto do caminho é delegado ao
 * [WebPathHandler] de sempre, então a `sonda.html` continua vindo do bundle OTA
 * com fallback para o APK, como todo o resto.
 *
 * **Só a [MirrorPresentation] da sonda monta um loader com este handler.** O
 * espelho de produção e o telão seguem com o loader normal: um handler a mais
 * no caminho deles seria superfície nova em código que roda em culto, para
 * servir um arquivo que só o instrumento pede.
 *
 * **Invariante 8 do `CLAUDE.md`, e aqui ela morde:** o `InputStream` devolvido é
 * o RECURSO INTEIRO a partir do byte 0 — quem aplica o `Range` é o próprio
 * WebView, sobre o que este handler entregou. Um `<video>` faz requisição por
 * faixa **por construção**, então devolver "só o pedaço pedido" aplicaria o
 * deslocamento duas vezes e o clipe simplesmente não tocaria. Um
 * `FileInputStream` do arquivo todo é o certo, e é o único certo.
 */
class SondaPathHandler(ctx: Context) : WebViewAssetLoader.PathHandler {

    private val app: Context = ctx.applicationContext
    private val bundle = WebPathHandler(app)

    override fun handle(path: String): WebResourceResponse? {
        if (path == SondaClipe.ARQUIVO) {
            val f = SondaClipe.garantir(app) ?: return WebViewFactory.notFound()
            return try {
                WebResourceResponse("video/mp4", null, FileInputStream(f))
            } catch (e: Exception) {
                Log.w("SondaPathHandler", "clipe da sonda não abriu", e)
                WebViewFactory.notFound()
            }
        }
        // O prefixo registrado é `/web/espelho/`, então o que chega aqui é o
        // nome do arquivo; o bundle quer o caminho inteiro de volta.
        return bundle.handle("web/espelho/$path")
    }
}
