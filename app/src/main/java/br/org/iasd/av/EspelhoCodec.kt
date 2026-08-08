package br.org.iasd.av

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.Surface

/**
 * Um quadro pronto para o fio.
 *
 * [tipo] segue a tabela do protocolo (§5.2 da especificação): `0x01` csd de
 * vídeo, `0x02` quadro de vídeo, `0x20` quadro JPEG (modo imagem). Os tipos de
 * áudio (`0x10`/`0x11`) chegam na Entrega 3 e não nascem aqui.
 *
 * [ptsUs] é **microssegundo do relógio da SESSÃO** — não do encoder, não do
 * `System.currentTimeMillis`. Ver [EspelhoCodec.carimbar]: é o único eixo de
 * tempo do sistema inteiro, e o cliente o escreve verbatim no `tfdt`.
 *
 * [descontinuidade] marca o primeiro quadro depois de uma remontagem do
 * encoder. Ele NÃO significa "o tempo voltou" (isso não pode acontecer, ver
 * [carimbar]): significa "o fluxo de NALUs recomeçou, o decodificador do
 * cliente precisa de um IDR antes de acreditar em qualquer coisa".
 *
 * *(É `data class` com `ByteArray` dentro, o que torna `equals`/`hashCode`
 * inúteis. Não há um único ponto do desenho que compare quadros — eles nascem,
 * viajam e morrem —, e a assinatura é a que a especificação fixou.)*
 */
data class Quadro(
    val tipo: Byte,
    val chave: Boolean,
    val descontinuidade: Boolean,
    val ptsUs: Long,
    val bytes: ByteArray,
)

/**
 * O encoder H.264 do espelho: configura o `MediaCodec`, entrega a *input
 * surface* que a tela virtual vai desenhar, e drena a saída **numa thread
 * própria**.
 *
 * ## Onde este código roda, e onde ele JAMAIS pode rodar
 *
 * O laço de [drenar] fica bloqueado até 10 ms por iteração e roda enquanto o
 * espelho estiver ligado — horas. Ele não pode estar na **main thread** (é a
 * thread da `Presentation` na TV e do Controle) nem na **fila `io` da ponte**
 * (`NativeBridge.io` é `newSingleThreadExecutor`, uma thread só, e é onde roda
 * o download do YouTube: um louvor de 380 MB a segura por minutos). Quem chama
 * [drenar] é uma thread dedicada criada pelo [EspelhoDisplay], e é só isso que
 * ela faz.
 *
 * ## As armadilhas de plataforma que este arquivo existe para não pisar
 *
 *  1. **`KEY_REPEAT_PREVIOUS_FRAME_AFTER` é `long`.** A documentação do
 *     `MediaFormat` diz *"The associated value is a **long**"*, e o `ACodec` a
 *     lê com `findInt64`. Escrita com `setInteger`, a chave simplesmente **não
 *     é encontrada**: sem exceção, sem log, sem nada. É o mesmo modo de falhar
 *     do `bytes` no `bgProgress` (v5.137) e do `slideLabel` no `nowPlaying`
 *     (v5.102) — a família de defeito mais cara deste repositório.
 *  2. **E ela repete UMA VEZ**, não continuamente: *"…will be repeated
 *     **(once)** if no new frame became available since"*. Ou seja, ela **não é
 *     piso de fps** e não mantém o pipeline vivo numa cena parada. Quem mantém
 *     o fluxo é o batimento do lado JS (papel `espelho`, no fim do
 *     `display/display.js`), que chega por OTA. Quem escrever aqui "com esta
 *     chave a taxa nunca cai a zero" está errado.
 *
 *     O papel que sobra para ela é preciso, e vale pelos dois quadros que
 *     entrega: garantir o primeiro quadro a um cliente que chega numa tela
 *     imóvel, e **destravar o quadro que o muxer do cliente está segurando**
 *     quando o batimento do JS for estrangulado. O muxer só emite o fragmento
 *     de N quando N+1 chega (o "atraso de um quadro" do `espelho/fmp4.js`), de
 *     modo que uma fonte que emudece deixa a última imagem retida no navegador
 *     — e é a repetição que a solta. Por isso [REPETIR_APOS_US] é ancorado no
 *     batimento (quatro batidas), e não num segundo redondo.
 *  3. **`PARAMETER_KEY_REQUEST_SYNC_FRAME` age sobre o próximo quadro
 *     PRODUZIDO.** Com a cena parada e a tela virtual sem compor nada, pedir
 *     IDR **não produz nada**. [pedirIdr] e o batimento são complementares, não
 *     alternativos.
 *  4. **`KEY_I_FRAME_INTERVAL = 5`, nem 2 nem 10.** Todo `GET /v` é por
 *     construção um cliente novo e o servidor pede IDR ali mesmo, então o
 *     intervalo espontâneo **não** é o caminho normal de um cliente pegar o
 *     primeiro quadro. Ele é o que sobra quando o pedido explícito é engolido
 *     pelo freio do `EspelhoServidor` (1 por tela a cada 2 s **e** um piso
 *     global de 1 s): duas telas que abrem juntas, ou — o caso que dói — uma
 *     fila que estourou e recomeçou com `esperandoIdr = true` no mesmo segundo
 *     em que outra já pediu. Nesse buraco o cliente fica **preto até o próximo
 *     IDR espontâneo**, e a 10 s isso são dez segundos de tela apagada no meio
 *     do culto por causa de um congestionamento de rede de meio segundo.
 *
 *     A conta do outro lado, com o número medido no aparelho: uma cena PARADA
 *     rodava a 156 kbps com ~1 IDR na janela de 10 s — isto é, o quadro-chave é
 *     quase toda a banda, porque um IDR de 720p de um wallpaper fotográfico
 *     custa dezenas a centenas de kB. Cair para 5 s **dobra esse piso**
 *     (~300 kbps por tela, ~0,9 Mbps com as três) e corta o pior caso pela
 *     metade. É o compromisso escolhido; 2 s multiplicaria o piso por cinco
 *     para ganhar mais três segundos. A linha "ritmo" do Registro agora separa
 *     `kbps de chaves` do resto justamente para esta conta poder ser refeita com
 *     medição em vez de estimativa — se o piso incomodar no AP da igreja, o
 *     número a mexer é este, e o efeito é visível na mesma linha.
 *  5. **`KEY_COLOR_RANGE` é DESCRITOR, não comando.** A doc o chama de
 *     *"optional key **describing** the range"*; ele não governa a conversão
 *     RGB→YUV do encoder em entrada por Surface e não há `isFormatSupported`
 *     para conferir. Ele é definido porque custa zero e o `scrcpy` o define —
 *     mas **a promessa "senão o preto sai cinza" não é garantia da
 *     plataforma**. Quem responde isso em número é a sonda de readback do
 *     [EspelhoDisplay], que mede uma faixa preta e uma branca.
 *  6. **Sem B-frames e sem `KEY_PROFILE`.** `KEY_MAX_B_FRAMES = 0` faz
 *     `DTS == PTS`, e é isso que dispensa o `composition_time_offset` no `trun`
 *     do muxer JS. Fixar o perfil High sem isso liga B-frames em alguns
 *     encoders Samsung — e o aparelho do operador é Samsung.
 *
 *     **E há uma segunda razão, que é de LATÊNCIA e não de contêiner:** um
 *     B-frame é codificado depois do quadro que ele referencia no futuro, ou
 *     seja, o encoder passa a segurar quadros para reordená-los. Numa gravação
 *     isso é grátis; aqui cada quadro retido é um quadro que o telão da rede
 *     não mostrou ainda, somado ao atraso de um quadro que o muxer do cliente
 *     já cobra por medir a duração. Ao vivo, reordenação é atraso pago em
 *     imagem parada — nunca ligar.
 *  7. **`ERROR_RECLAIMED` é o modo de falha do app MINIMIZADO**, que é o estado
 *     normal deste app no meio do culto. A doc é explícita: *"the codec must be
 *     released, as it has moved to terminal state"*. Este arquivo o
 *     **classifica** ([Fim.RECLAMADO]) e não decide nada; a política — uma
 *     remontagem com espera, e desligar com frase na segunda — é do
 *     [EspelhoDisplay], porque remontar o encoder implica remontar a tela
 *     virtual e a janela junto.
 *  8. **Valores negativos de `dequeueOutputBuffer` são ignorados em silêncio**,
 *     menos `INFO_OUTPUT_FORMAT_CHANGED` — que é onde se lê `csd-0`/`csd-1`.
 *     Tratar `INFO_OUTPUT_BUFFERS_CHANGED` como erro é o engano clássico.
 *  9. **`KEY_FRAME_RATE = 30` é DECLARAÇÃO, e `BITRATE_MODE_VBR` é o que a
 *     torna inofensiva.** A taxa real de uma tela virtual é variável por
 *     natureza (ela só produz quando a composição muda), e a chave é
 *     obrigatória no formato: o que o encoder faz com ela é dividir o bitrate
 *     alvo por 30 para orçar cada quadro. **Baixá-la para a cadência do
 *     batimento seria o erro**: no instante em que um vídeo entra em cena a
 *     fonte passa a 30 fps de verdade, e um encoder orçado para 8 fps gastaria
 *     quatro vezes o alvo ou esmagaria a qualidade — justamente na cena que
 *     mais importa. Ela fica em 30, que é o teto real.
 *
 *     E o modo tem de continuar **VBR**: `BITRATE_MODE_CBR` obriga o encoder a
 *     ENCHER 3 Mbps mesmo com o telão parado, isto é, enfiar bits de
 *     enchimento no rádio do AP da igreja durante uma oração. A prova de que o
 *     VBR está fazendo o trabalho está na medição do aparelho: 156 kbps numa
 *     cena parada contra o alvo de 3 Mbps. `BITRATE_MODE_CQ` seria defensável e
 *     não é usado por um motivo prático — sem alvo em bits não há o que ajustar
 *     em [ajustarBitrate], que é a única degradação térmica que existe aqui.
 *
 * ## O que este arquivo NÃO faz
 *
 * Não converte Annex-B para `avcC`: o `csd` sai como o `MediaCodec` o entrega
 * (SPS e PPS com *start code* `00 00 00 01`), porque o WebCodecs come Annex-B
 * direto e a conversão é orçamento do muxer JS. Não decide quem recebe o quê
 * (isso é do servidor). E não degrada nada sozinho.
 */
class EspelhoCodec(private val onQuadro: (Quadro) -> Unit) {

    /** Como o laço de [drenar] terminou. É o que decide a política do dono. */
    enum class Fim {
        /** [parar]/[soltar] pediram o fim. Nada a fazer. */
        NORMAL,

        /** `ERROR_RECLAIMED`: o sistema tomou o encoder. Estado terminal. */
        RECLAMADO,

        /** `ERROR_INSUFFICIENT_RESOURCE`: não há encoder livre agora. */
        SEM_RECURSO,

        /** Qualquer outra falha. O espelho desliga com a frase no Registro. */
        ERRO,
    }

    @Volatile
    private var codec: MediaCodec? = null

    @Volatile
    private var superficie: Surface? = null

    /** Enquanto `true`, [drenar] continua. Escrito de outra thread. */
    @Volatile
    private var rodando = false

    /**
     * SPS+PPS concatenados em Annex-B, como saíram do encoder.
     *
     * Guardado porque **todo cliente novo recebe o `csd` antes de qualquer
     * outra coisa** (§5.3), e um cliente que chega dez minutos depois de o
     * espelho ligar não estava lá quando o `INFO_OUTPUT_FORMAT_CHANGED`
     * aconteceu. Sem esta cópia, o fluxo dele começaria por um IDR que nenhum
     * decodificador sabe abrir.
     */
    @Volatile
    var csd: ByteArray? = null
        private set

    /** Nome do encoder escolhido pela plataforma — só diagnóstico. */
    @Volatile
    var nome: String = ""
        private set

    /**
     * `getMaxSupportedInstances()` do codec escolhido — só diagnóstico, e ele
     * responde de forma direta "cabe um segundo encode com a TV no ar?".
     */
    @Volatile
    var maxInstancias: Int = 0
        private set

    /**
     * Quadros por segundo **medidos na saída do encoder**.
     *
     * É a única forma de enxergar o estrangulamento de timer do Chromium no
     * WebView do espelho: numa cena parada este número **é** a frequência do
     * batimento (8 Hz), então vê-lo cair para ~1 ou ~0 com o app minimizado é
     * ver o orçamento de timers agindo apesar do `keepVisible`. O mesmo número
     * denuncia a janela morta com o encoder vivo (H.264 impecável de um
     * retângulo preto) — mas ali quem acusa é o **bitrate**, não ele: com o
     * batimento no ar a contagem de quadros continua bonita mesmo com a janela
     * morta. Ver a linha "ritmo" do Registro, montada no `controle.js`.
     */
    @Volatile
    var fpsMedido: Float = 0f
        private set

    /**
     * Constrói o `MediaFormat`. Separado de [iniciar] de propósito: ele é o
     * documento das decisões acima e precisa ser legível sem o laço em volta.
     */
    fun configurar(): MediaFormat =
        MediaFormat.createVideoFormat(MIME, EspelhoDisplay.LARG, EspelhoDisplay.ALT).apply {
            setInteger(
                MediaFormat.KEY_COLOR_FORMAT,
                MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface,
            )
            setInteger(MediaFormat.KEY_BIT_RATE, BITRATE_PADRAO)
            setInteger(
                MediaFormat.KEY_BITRATE_MODE,
                MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR,
            )
            // Obrigatório no formato, e é uma DECLARAÇÃO, não uma promessa: a
            // taxa real de uma tela virtual é variável por natureza (ela só
            // produz quando a composição muda). Fica no TETO real (30), nunca na
            // cadência do batimento — ver a armadilha 9.
            setInteger(MediaFormat.KEY_FRAME_RATE, 30)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, I_FRAME_S)
            // setLong. Ver a armadilha 1 do KDoc da classe — com setInteger
            // esta linha não faz absolutamente nada e ninguém percebe.
            setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, REPETIR_APOS_US)
            // Tempo real: o encoder pode gastar menos esforço para não atrasar.
            setInteger(MediaFormat.KEY_PRIORITY, 0)
            // "Quero latência de 1 quadro". É dica, não contrato.
            setInteger(MediaFormat.KEY_LATENCY, 1)
            setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
            // A chave só existe da API 29 em diante. Um `static final String` é
            // embutido pelo compilador, então referenciá-la não quebra em API
            // 26 — a guarda existe para dizer que a AUSÊNCIA dela num aparelho
            // antigo é conhecida e aceita (lá vale o padrão do encoder, que
            // para o perfil Baseline/Main não emite B-frames de qualquer forma).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
            }
            // NÃO definir KEY_PROFILE: ver a armadilha 6.
        }

    /**
     * Cria o encoder, configura, e entrega a *input surface* a
     * [surfaceRecebida] — que é onde o dono cria o `VirtualDisplay`.
     *
     * **A ordem é imposta pela API**, e é por isso que ela é um callback e não
     * um `return`: *"[createInputSurface] may only be called **after
     * configure** and **before start**"*. O `VirtualDisplay` precisa nascer com
     * a Surface já existente e o encoder precisa estar rodando antes do
     * primeiro quadro chegar — encaixar o dono no meio é a única forma de
     * cumprir as duas coisas sem espalhar a sequência por dois arquivos.
     *
     * Qualquer falha aqui **solta tudo antes de relançar**: um `MediaCodec`
     * configurado e abandonado retém uma instância de hardware, e o próximo
     * `ligar()` receberia `ERROR_INSUFFICIENT_RESOURCE` por causa do anterior.
     *
     * @throws MediaCodec.CodecException classificável por [classificar] — o
     *   caso interessante é `ERROR_INSUFFICIENT_RESOURCE`, que é o "ligar o
     *   espelho com a TV no ar e um vídeo tocando" falhando **ruidosamente**,
     *   como se quer.
     */
    fun iniciar(surfaceRecebida: (Surface) -> Unit) {
        check(codec == null) { "EspelhoCodec já iniciado" }
        val c = MediaCodec.createEncoderByType(MIME)
        var s: Surface? = null
        try {
            c.configure(configurar(), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            s = c.createInputSurface()
            surfaceRecebida(s)
            c.start()
        } catch (e: Throwable) {
            try { c.release() } catch (_: Exception) { }
            try { s?.release() } catch (_: Exception) { }
            throw e
        }
        superficie = s
        codec = c
        rodando = true
        // Depois do start: `getName`/`getCodecInfo` lançam em codec liberado, e
        // nenhum dos dois vale uma exceção — são linhas de diagnóstico.
        nome = try { c.name } catch (_: Exception) { "" }
        maxInstancias = try {
            c.codecInfo.getCapabilitiesForType(MIME).maxSupportedInstances
        } catch (_: Exception) {
            0
        }
        Log.i(TAG, "encoder $nome iniciado (máx $maxInstancias instâncias)")
    }

    /**
     * O laço de drenagem. **Bloqueia até [parar]/[soltar]**, e devolve como
     * terminou.
     *
     * Roda na thread dedicada do [EspelhoDisplay]. Cada iteração espera até
     * [ESPERA_US]; um tempo de espera longo demais atrasaria a saída depois de
     * [parar], e um tempo curto viraria espera ocupada num processo que também
     * está projetando.
     */
    fun drenar(): Fim {
        val c = codec ?: return Fim.ERRO
        val info = MediaCodec.BufferInfo()
        var contados = 0
        var marco = SystemClock.elapsedRealtime()

        while (rodando) {
            val idx = try {
                c.dequeueOutputBuffer(info, ESPERA_US)
            } catch (e: MediaCodec.CodecException) {
                Log.w(TAG, "encoder falhou no dequeue", e)
                return classificar(e)
            } catch (e: IllegalStateException) {
                // Acontece quando alguém soltou o codec debaixo do laço. Se foi
                // um desligamento em ordem, `rodando` já é false e o dono
                // ignora este desfecho.
                Log.w(TAG, "encoder em estado inválido no dequeue", e)
                return Fim.ERRO
            }

            when {
                idx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> lerCsd(c)
                // INFO_TRY_AGAIN_LATER, INFO_OUTPUT_BUFFERS_CHANGED e qualquer
                // negativo futuro: silêncio, por contrato.
                idx < 0 -> Unit
                else -> {
                    try {
                        if (emitir(c, idx, info)) contados++
                    } catch (e: Exception) {
                        Log.w(TAG, "quadro descartado", e)
                    } finally {
                        try { c.releaseOutputBuffer(idx, false) } catch (_: Exception) { }
                    }
                    if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        return Fim.NORMAL
                    }
                }
            }

            val agora = SystemClock.elapsedRealtime()
            val decorrido = agora - marco
            if (decorrido >= FPS_JANELA_MS) {
                fpsMedido = contados * 1000f / decorrido
                contados = 0
                marco = agora
            }
        }
        return Fim.NORMAL
    }

    /**
     * Copia o buffer [idx] para um [Quadro] e o entrega. Devolve `true` quando
     * o que saiu é imagem (conta para o fps); `csd` gasta bytes e não é quadro.
     */
    private fun emitir(c: MediaCodec, idx: Int, info: MediaCodec.BufferInfo): Boolean {
        if (info.size <= 0) return false
        val buf = c.getOutputBuffer(idx) ?: return false
        buf.position(info.offset)
        buf.limit(info.offset + info.size)
        val bytes = ByteArray(info.size)
        buf.get(bytes)

        // Alguns encoders entregam o csd como um buffer com esta bandeira em
        // vez de (ou além de) publicá-lo no formato. Ele NÃO é um quadro de
        // vídeo: mandado como `0x02`, o cliente tentaria decodificar SPS/PPS
        // como imagem.
        if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
            if (csd == null) {
                csd = bytes
                onQuadro(
                    Quadro(TIPO_CSD_VIDEO, true, consumirDescontinuidade(), ultimoCarimbo(), bytes),
                )
            }
            return false
        }

        val chave = (info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0
        onQuadro(
            Quadro(
                TIPO_VIDEO,
                chave,
                consumirDescontinuidade(),
                carimbar(info.presentationTimeUs),
                bytes,
            ),
        )
        return true
    }

    /** Lê `csd-0`/`csd-1` do formato de saída e emite o quadro `0x01`. */
    private fun lerCsd(c: MediaCodec) {
        val f = try { c.outputFormat } catch (e: Exception) {
            Log.w(TAG, "formato de saída indisponível", e)
            return
        }
        // `duplicate()`: o ByteBuffer é do formato, e consumi-lo aqui deixaria
        // o próximo leitor com um buffer no fim.
        val sps = f.getByteBuffer("csd-0")?.duplicate() ?: return
        val pps = f.getByteBuffer("csd-1")?.duplicate()
        val a = ByteArray(sps.remaining())
        sps.get(a)
        val b = if (pps != null) ByteArray(pps.remaining()).also { pps.get(it) } else ByteArray(0)
        val juntos = a + b
        csd = juntos
        onQuadro(
            Quadro(TIPO_CSD_VIDEO, true, consumirDescontinuidade(), ultimoCarimbo(), juntos),
        )
    }

    /**
     * Pede um quadro-chave ao encoder.
     *
     * Sem efeito garantido: ver a armadilha 3 do KDoc da classe. E **sem freio
     * aqui de propósito** — o freio (1 por 2 s por sessão, mais um piso global)
     * é do servidor, que é quem sabe quantos clientes estão pedindo.
     */
    fun pedirIdr() {
        val c = codec ?: return
        try {
            c.setParameters(
                Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0) },
            )
        } catch (e: Exception) {
            Log.w(TAG, "pedido de IDR recusado", e)
        }
    }

    /**
     * Muda o bitrate alvo em tempo de execução — a resposta a
     * `THERMAL_STATUS_SEVERE`.
     *
     * **E é só metade da degradação possível, sendo a outra metade impossível
     * daqui:** "cair a taxa de quadros" NÃO se faz descartando quadros
     * codificados. Um P-frame referencia os anteriores; jogar fora um quadro no
     * meio produz lixo verde no cliente até o IDR seguinte, que é pior que
     * bitrate alto. Reduzir taxa de quadros de verdade exige produzir menos na
     * FONTE (o batimento do lado JS), e por isso não existe um `ajustarFps`
     * aqui. E **nunca** a resolução: ela define a densidade, a densidade define
     * o viewport CSS, e o `/display/` refaria a quebra de estrofe na frente da
     * congregação.
     */
    fun ajustarBitrate(bps: Int) {
        val c = codec ?: return
        try {
            c.setParameters(
                Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_VIDEO_BITRATE, bps) },
            )
        } catch (e: Exception) {
            Log.w(TAG, "bitrate não ajustado", e)
        }
    }

    /**
     * Manda o laço terminar, **sem tocar no codec**.
     *
     * Existe porque `stop()`/`release()` enquanto outra thread está dentro de
     * `dequeueOutputBuffer` é o caminho conhecido para `IllegalStateException`
     * (e, em alguns fornecedores, para um travamento no driver). A sequência
     * correta é: [parar] → esperar a thread de dreno sair → [soltar].
     */
    fun parar() {
        rodando = false
    }

    /**
     * Solta o encoder e a *input surface*. Idempotente.
     *
     * **A tela virtual tem de ser liberada ANTES** (é o dono quem faz isso):
     * enquanto ela existir, o SurfaceFlinger continua entregando buffers a uma
     * Surface cujo consumidor está sendo desmontado.
     */
    fun soltar() {
        rodando = false
        val c = codec
        codec = null
        val s = superficie
        superficie = null
        if (c != null) {
            try { c.stop() } catch (_: Exception) { }
            try { c.release() } catch (_: Exception) { }
        }
        try { s?.release() } catch (_: Exception) { }
        fpsMedido = 0f
    }

    private fun classificar(e: MediaCodec.CodecException): Fim = when (e.errorCode) {
        MediaCodec.CodecException.ERROR_RECLAIMED -> Fim.RECLAMADO
        MediaCodec.CodecException.ERROR_INSUFFICIENT_RESOURCE -> Fim.SEM_RECURSO
        else -> Fim.ERRO
    }

    companion object {
        private const val TAG = "EspelhoCodec"

        private const val MIME = MediaFormat.MIMETYPE_VIDEO_AVC

        /** 3 Mbps a 720p. Ver o §2.4 da especificação para a conta de rede. */
        const val BITRATE_PADRAO = 3_000_000

        /** Segundos entre IDRs espontâneos. Ver a armadilha 4. */
        private const val I_FRAME_S = 5

        /**
         * O intervalo do **batimento do papel `espelho`**, em microssegundos —
         * repetido aqui porque as duas pontas são arquivos diferentes que
         * viajam por caminhos diferentes (este chega instalando um APK, aquele
         * chega por OTA) e não há como uma importar a outra.
         *
         * Ele NÃO governa nada: quem produz os quadros é o JS. Está aqui para
         * [REPETIR_APOS_US] ser expresso em batidas em vez de num número solto,
         * e para o próximo leitor saber onde está a outra metade
         * (`assets/web/display/display.js`, constante `ESPELHO_BATIMENTO_MS`).
         *
         * **Divergir não quebra nada**: um bundle antigo (batimento de 1 s) num
         * shell novo só faz a repetição de quadro disparar mais vezes — um
         * quadro minúsculo a mais de vez em quando, que é exatamente o
         * comportamento desejado quando a fonte está lenta.
         */
        private const val BATIMENTO_US = 125_000L

        /**
         * Quatro batidas. Ver as armadilhas 1 e 2 — **é `long`, e repete uma
         * vez**.
         *
         * Nem menos, nem mais, e os dois lados têm dono. **Menos** faria a
         * repetição correr junto com o batimento normal, duplicando quadros
         * numa cena parada por nada. **Mais** (o 1 s de antes) atrasa a única
         * coisa que ela ainda faz de útil: soltar, no cliente, a imagem que o
         * muxer segura por causa do atraso de um quadro, quando o batimento do
         * JS morre ou é estrangulado. Quatro batidas dizem "a fonte calou de
         * verdade" sem falso positivo.
         */
        private const val REPETIR_APOS_US = BATIMENTO_US * 4

        private const val ESPERA_US = 10_000L
        private const val FPS_JANELA_MS = 2_000L

        /**
         * Os tipos de fio que as FONTES produzem (§5.2) — vídeo e `csd` daqui,
         * JPEG do modo imagem no [EspelhoDisplay], áudio do `EspelhoAudio`.
         *
         * O `EspelhoServidor` tem a tabela **completa** no companion dele, que é
         * onde ela pertence: ele enquadra os bytes e é quem fala com o cliente
         * JS. A repetição destas cinco é deliberada e limitada às que uma FONTE
         * carimba — o produtor não pode depender do transporte, senão apagar o
         * servidor um dia levaria o encoder junto. **Os valores têm de bater com
         * os de lá**: são números de protocolo, e mudá-los sem mudar o cliente é
         * um fluxo que o navegador descarta em silêncio.
         */
        const val TIPO_CSD_VIDEO: Byte = 0x01
        const val TIPO_VIDEO: Byte = 0x02
        const val TIPO_CSD_AUDIO: Byte = 0x10
        const val TIPO_AUDIO: Byte = 0x11
        const val TIPO_JPEG: Byte = 0x20

        /**
         * Mensagem de controle servidor→cliente. Não é produzida por fonte
         * nenhuma — está aqui porque o `EspelhoServidor` a carimba num [Quadro]
         * como qualquer outro, e ter METADE da tabela num lugar e metade noutro
         * é pior que a repetição inteira.
         */
        const val TIPO_CONTROLE: Byte = 0x30

        /**
         * A base do relógio, e o motivo de ela morar no `companion` e não na
         * instância: **ela é da SESSÃO, nunca do encoder**.
         *
         * Um `ERROR_RECLAIMED` no meio do culto destrói este objeto e cria
         * outro. Se a base nascesse com o encoder, o quadro seguinte à
         * remontagem viria com PTS perto de zero — o `tfdt` do cliente andaria
         * **para trás** e a `MediaSource` quebraria em silêncio, que é o pior
         * desfecho catalogado deste desenho. Guardar a base fora da instância é
         * o que torna isso impossível por construção, e não por disciplina.
         *
         * A base é o PTS do PRIMEIRO quadro da sessão, e não um
         * `System.nanoTime()` colhido ao ligar: os carimbos de uma *input
         * surface* vêm do `BufferQueue`, e amarrá-los a um relógio lido noutro
         * ponto do código é supor uma igualdade que a plataforma não promete.
         * Assim o primeiro quadro sai em 0 por definição, e nada pode sair
         * negativo.
         */
        @Volatile
        private var baseUs = -1L

        /**
         * -1 = nenhum quadro carimbado ainda. Não é 0: com 0, o primeiro quadro
         * da sessão cairia na guarda de monotonicidade (`0 <= 0`) e sairia com
         * 1 µs em vez de 0. Um microssegundo não muda nada em cena nenhuma —
         * mas um relógio cuja origem não é a origem é a classe de detalhe que
         * volta como uma hora de depuração no dia em que o `tfdt` for
         * conferido à mão contra o `moov`.
         */
        @Volatile
        private var ultimoUs = -1L

        @Volatile
        private var descontinuidade = false

        /** Zera o relógio. Chamado UMA vez por sessão, ao ligar o espelho. */
        @Synchronized
        fun abrirSessao() {
            baseUs = -1L
            ultimoUs = -1L
            descontinuidade = false
        }

        /**
         * O próximo quadro leva a bandeira de descontinuidade. Chamado pelo
         * dono depois de remontar o encoder.
         */
        @Synchronized
        fun marcarDescontinuidade() {
            descontinuidade = true
        }

        /**
         * Converte um PTS bruto do encoder no eixo da sessão.
         *
         * **Estritamente crescente, sempre.** Dois quadros com o mesmo carimbo
         * (acontece com a repetição de quadro e com relógios de baixa
         * resolução) viram `t` e `t+1 µs`: um µs não existe para ninguém, e um
         * `tfdt` repetido faz o navegador tratar o fragmento como já
         * bufferizado e descartá-lo sem dizer nada.
         */
        @Synchronized
        fun carimbar(brutoUs: Long): Long {
            if (baseUs < 0L) baseUs = brutoUs
            var us = brutoUs - baseUs
            if (us <= ultimoUs) us = ultimoUs + 1L
            ultimoUs = us
            return us
        }

        /**
         * O último carimbo emitido — para quadros sem tempo próprio (`csd`).
         *
         * Nunca negativo: o `csd` é o PRIMEIRO quadro de toda conexão e
         * costuma sair antes de qualquer imagem, quando [ultimoUs] ainda é -1.
         */
        @Synchronized
        fun ultimoCarimbo(): Long = if (ultimoUs < 0L) 0L else ultimoUs

        @Synchronized
        private fun consumirDescontinuidade(): Boolean {
            val d = descontinuidade
            descontinuidade = false
            return d
        }
    }
}
