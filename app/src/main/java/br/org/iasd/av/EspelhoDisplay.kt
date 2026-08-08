package br.org.iasd.av

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.MediaCodec
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.SystemClock
import android.util.DisplayMetrics
import android.util.Log
import android.view.Display
import android.view.PixelCopy
import android.view.Surface
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/**
 * Como os pixels do espelho são produzidos.
 *
 * **VÍDEO** é o modo de produção (H.264 pelo `MediaCodec`, cliente com
 * `MediaSource`); **IMAGEM** é o degrau de baixo — JPEG a ~10 fps, que cobre
 * letra, versículo, mensagem e cronômetro (90% de um culto) e cujo modo de
 * falha é binário e visível.
 *
 * **O modo é escolhido em [EspelhoDisplay.ligar] e não muda durante a sessão.**
 * Isso é consequência direta de `VirtualDisplay.setSurface` estar proibido em
 * todo o desenho: *"Detaching the surface that backs a virtual display has a
 * similar effect to **turning off the screen**"*, e o consumidor novo não
 * recebe nada até a janela redesenhar — o que numa cena estática pode ser um
 * segundo inteiro de tela preta na frente da congregação. Trocar de modo é
 * `desligar()` + `ligar(outroModo)`: um rebuild de ~1 s, iniciado pelo
 * operador, anunciado na folha. Simples, honesto, e apaga a classe de bug
 * inteira.
 */
enum class Modo { VIDEO, IMAGEM }

/** O desfecho de [EspelhoDisplay.ligar]. */
sealed class Resultado {
    data class Ok(
        val displayId: Int,
        val dpi: Int,
        val alvoCss: Int,
        val modo: Modo,
    ) : Resultado()

    /**
     * [motivo] é uma frase **para o operador**, e é a única saída de um espelho
     * que não subiu: a especificação proíbe degradar calado em todos os pontos
     * desta classe ("recusa ligar, ruidosamente").
     */
    data class Recusado(val motivo: String) : Resultado()
}

/**
 * O que a sonda mediu. Cores em `0xRRGGBB` (sem alfa).
 *
 * [pixelCopy] só é preenchido quando o veredito é [Veredito.VIDEO_PRETO]: ali a
 * pergunta seguinte é "o buffer daquela janela também está preto?".
 */
data class Sonda(
    val veredito: Veredito,
    val fora: Int,
    val dentro: Int,
    val preto: Int,
    val branco: Int,
    val canto: Int,
    val quadros: Int,
    val pixelCopy: Int?,
    val nota: String,
) {
    fun paraJson(): JSONObject = JSONObject()
        .put("veredito", veredito.name)
        .put("fora", hex(fora))
        .put("dentro", hex(dentro))
        .put("preto", hex(preto))
        .put("branco", hex(branco))
        .put("canto", hex(canto))
        .put("quadros", quadros)
        .put("pixelCopy", pixelCopy?.let { hex(it) } ?: JSONObject.NULL)
        .put("nota", nota)

    private fun hex(c: Int) = String.format("#%06X", c and 0xFFFFFF)

    /**
     * O que a sonda de readback concluiu.
     *
     * **Aninhado em [Sonda] de propósito:** o `EspelhoPares` já tem um
     * `Veredito` (o do pareamento de uma tela), e dois tipos com o mesmo nome
     * no mesmo pacote é a classe de confusão que só aparece quando alguém
     * escreve `Veredito.OK` no arquivo errado e o compilador aceita.
     */
    enum class Veredito {
        OK,
        OK_ESCURO,
        VIDEO_PRETO,
        TUDO_PRETO,
        SEM_QUADRO,

        /**
         * Mediu alguma coisa que não é nenhum dos casos catalogados.
         *
         * **Existe porque a sonda é instrumento, não juiz.** Sem este valor, um
         * aparelho fora dos casos previstos seria forçado a um dos quatro
         * vereditos — provavelmente "TELA INTEIRA PRETA" —, e o próximo leitor
         * caçaria um defeito que não existe. Os RGB medidos vão no JSON de
         * qualquer forma, e é o que responde.
         */
        INDEFINIDO,
    }
}

/**
 * Dono do `VirtualDisplay`, da [MirrorPresentation], da densidade e da sonda de
 * readback. **É o único arquivo do projeto que fala com o `DisplayManager` do
 * espelho**, e o único que decide o que fazer quando o encoder morre.
 *
 * ## O que este arquivo cria, e por que a cadeia inteira é API pública
 *
 * ```
 * MediaCodec.configure(…, CONFIGURE_FLAG_ENCODE)
 *   → createInputSurface()                       ← só depois de configure, antes de start
 *     → DisplayManager.createVirtualDisplay(…, flags = 0)
 *       → codec.start()
 *         → MirrorPresentation(act, vd.display).show()   ← SEMPRE na main thread
 * ```
 *
 * `DisplayManagerService.createVirtualDisplayInternal` só confere permissão
 * para `AUTO_MIRROR`, `SECURE`, `TRUSTED`, `OWN_DISPLAY_GROUP` e
 * `ALWAYS_UNLOCKED`; um display privado sem nenhuma dessas passa direto, e a
 * própria mensagem de erro do framework aponta para o caminho certo (*"please
 * use the flag VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY"*). E uma `Presentation`
 * num display privado do próprio app tem tipo de janela dedicado
 * (`TYPE_PRIVATE_PRESENTATION`), que o `PhoneWindowManager` devolve como
 * `ADD_OKAY` sem permissão nenhuma. É o mesmo "virtual display mode" que o
 * `webview_flutter` embarca em milhões de apps, com `flags = 0` literal.
 *
 * ## INVARIANTES
 *
 * **1. `flags = 0`. Nunca `VIRTUAL_DISPLAY_FLAG_PUBLIC`, nunca
 * `FLAG_PRESENTATION`.** `OWN_CONTENT_ONLY` *"is implied whenever neither
 * PUBLIC nor AUTO_MIRROR have been set"*, então ele não precisa ser pedido. E
 * as duas flags que alguém tentaria acrescentar são as duas que quebram algo:
 * `FLAG_PRESENTATION` põe a nossa tela virtual em
 * `DISPLAY_CATEGORY_PRESENTATION`, e daí o `syncPresentation` do
 * [MainActivity] criaria uma `StagePresentation` **dentro do nosso próprio
 * espelho** — um terceiro `/display/`, com `MicChromeClient` instalado, isto é,
 * habilitado a abrir o microfone do templo numa tela que ninguém vê. E `PUBLIC`
 * implica `AUTO_MIRROR` (que exige `CAPTURE_VIDEO_OUTPUT`) **e remove
 * `FLAG_NEVER_BLANK`** — perde-se de uma vez a permissão e a sobrevivência à
 * tela do celular apagada. Quem um dia perseguir um `InvalidDisplayException`
 * acrescentando `PUBLIC` perde as duas coisas juntas.
 *
 * **2. Se `show()` lançar, o espelho RECUSA LIGAR** e registra a classe e a
 * mensagem. **Não existe "tentar de novo com `FLAG_PRESENTATION`"**: o ramo do
 * `WindowManagerService` que confere aquela flag é o de `TYPE_PRESENTATION`
 * (público), inalcançável para uma janela `TYPE_PRIVATE_PRESENTATION` — que é a
 * que `Presentation` escolhe sozinha para display privado. Se `show()` falhar,
 * a causa é outra (token, contexto), e trocar a flag compraria o desastre do
 * invariante 1 em troca de nada.
 *
 * **3. A resolução é IMUTÁVEL durante a sessão.** Degradar por térmica mudando
 * a resolução mudaria a densidade, e a densidade define o viewport CSS: o
 * `/display/` refaria a quebra de estrofe **na frente da congregação**.
 * Degrade por bitrate (ver `EspelhoCodec.ajustarBitrate`).
 *
 * **4. `VirtualDisplay.setSurface` não é usado em lugar nenhum** — ver o KDoc
 * de [Modo] e o da [sonda].
 *
 * **5. A janela renasce com a Activity.** O `AndroidManifest.xml` não inclui
 * `fontScale` nem `locale` em `android:configChanges`, e este repositório já
 * documenta duas vezes que isso recria a Activity e que já causou defeito real.
 * Com o serviço mantendo o processo vivo, a Activity pode morrer sozinha
 * enquanto o `VirtualDisplay` e o `MediaCodec` continuam: **o resultado seria
 * H.264 impecável de um retângulo preto, com todos os contadores subindo e nada
 * no Registro.** Por isso [sincronizarJanela] existe e é chamada do `onCreate`,
 * ao lado do `syncPresentation()` — e por isso o `desligar()` do `onDestroy`
 * precisa ser guardado por `!isChangingConfigurations`, senão a mudança de
 * fonte do sistema derruba o espelho no meio do culto.
 *
 * ## Threading
 *
 * Tudo que mexe em janela é **main thread**, sem exceção: `Presentation` é um
 * `Dialog` e exige uma thread com `Looper`, enquanto a fila `io` da ponte é uma
 * `Thread` daemon **sem Looper** — um `io.execute { MirrorPresentation(...) }`
 * dá `Can't create handler inside thread that has not called Looper.prepare()`
 * no primeiro toque, na frente do operador. Isto está escrito porque é o erro
 * que alguém comete. [ligar] e [sincronizarJanela] exigem a main e recusam fora
 * dela; [ligarAsync] e [desligar] podem ser chamados de qualquer thread; a
 * drenagem do encoder roda em thread dedicada e só volta à main por `post`.
 */
object EspelhoDisplay {

    private const val TAG = "EspelhoDisplay"

    /** Resolução do espelho. NÃO muda durante a sessão — ver o invariante 3. */
    const val LARG = 1280
    const val ALT = 720

    /**
     * O viewport CSS que a TV desenha quando não há TV para perguntar.
     *
     * 960 é o que a fórmula do AOSP dá para qualquer 16:9 externo — ver
     * [dpiPara]. Sem TV conectada não há como medir, e chutar 1280 (o "óbvio")
     * daria um espelho com layout diferente do telão no primeiro domingo em que
     * a TV voltasse.
     */
    const val ALVO_CSS_PADRAO = 960

    private const val NOME_VD = "av-espelho"
    private const val NOME_VD_SONDA = "av-espelho-sonda"

    /**
     * Duas remontagens dentro desta janela ⇒ o espelho desliga com frase.
     * Ver [tratarReclaim].
     */
    private const val RECLAIM_JANELA_MS = 5 * 60_000L
    private const val RECLAIM_ESPERA_MS = 1_500L

    /**
     * Modo imagem: ~10 fps. A especificação promete 8–12, e o número exato não
     * importa — o que importa é que o teto exista, porque uma cena com vídeo
     * produziria 30 comprimindo JPEG de 720p na CPU do aparelho que está
     * projetando o culto.
     */
    private const val INTERVALO_JPEG_MS = 100L
    private const val QUALIDADE_JPEG = 60

    /** O anel de diagnóstico. Devolve JSON; quem monta a frase é o web. */
    val diag = EspelhoDiag()

    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var ligado = false

    @Volatile
    private var codec: EspelhoCodec? = null

    private var vd: VirtualDisplay? = null
    private var janela: MirrorPresentation? = null
    private var leitor: ImageReader? = null
    private var leitorThread: HandlerThread? = null
    private var dreno: Thread? = null
    private var dono: WeakReference<Activity>? = null

    /**
     * `@Volatile` porque quem o LÊ é a thread de dreno (ou a do JPEG) e quem o
     * ESCREVE é a main. Sem isso, o dreno pode continuar enxergando o
     * `onQuadro` da sessão anterior por tempo indeterminado depois de um
     * `desligar()` — entregando quadros a um servidor que já saiu do ar.
     */
    @Volatile
    private var onQuadro: ((Quadro) -> Unit)? = null

    @Volatile
    private var modo = Modo.VIDEO

    /** Escrito na thread do JPEG, zerado na main em [ligar]. */
    @Volatile
    private var ultimoJpegEm = 0L

    /**
     * Token de geração, no molde do que a `MainActivity` já usa para o trabalho
     * em segundo plano: uma continuação em voo (o `post` da thread de dreno, o
     * `postDelayed` da remontagem) que chegue **depois** de um desligamento não
     * pode agir sobre a sessão seguinte.
     */
    private var geracao = 0

    private var reclaimsTotal = 0
    private var reclaimsNaJanela = 0
    private var ultimoReclaimEm = 0L

    /** O espelho está no ar? */
    val estaLigado: Boolean get() = ligado

    /**
     * `displayId` da nossa tela virtual, ou -1.
     *
     * Existe para o filtro `telasExternas()` da [MainActivity] poder excluí-la
     * **por id**, além de excluí-la por `Display.FLAG_PRIVATE`. Cinto e
     * suspensório declarado: com `flags = 0` a tela nunca ganha
     * `FLAG_PRESENTATION`, logo `getDisplays(DISPLAY_CATEGORY_PRESENTATION)`
     * não a enxerga hoje. Sem esta explicação, o próximo leitor apagaria o
     * filtro como código morto e a proteção sumiria junto.
     */
    val displayId: Int get() = vd?.display?.displayId ?: -1

    /**
     * Desfaz a suspensão que o Chromium aplica ao WebView do espelho quando o
     * app sai da frente. Chamado do `onStop` da Activity, ao lado do
     * `presentation?.keepPlaying()` do telão — o espelho é projeção pela mesma
     * razão que o telão é, e o que ele protege a mais é o **batimento de 1 Hz**
     * (ver [MirrorPresentation.keepPlaying]).
     *
     * No-op sem espelho no ar.
     */
    fun keepPlaying() {
        janela?.keepPlaying()
    }

    /**
     * A densidade da tela virtual, derivada do viewport CSS alvo.
     *
     * **O espelho precisa desenhar no MESMO viewport CSS que a TV, e a conta não
     * é sobre dpi: é sobre viewport.** O viewport CSS é
     * `pixels / (densityDpi / 160)` (`useWideViewPort` mais o
     * `<meta viewport width=device-width>` que o `display/index.html` já traz).
     *
     * E uma TV Miracast **não reporta 160 dpi**: o AOSP calcula
     * `densityDpi = min(w,h) * DENSITY_XHIGH / 1080` para display externo
     * (`DisplayDeviceInfo.setAssumedDensityForExternalDisplay`), logo uma TV
     * 1080p reporta **320 dpi** e o `/display/` que a congregação vê hoje é
     * desenhado em **960×540 CSS** — não em 1920×1080. A 160 dpi o espelho
     * teria viewport 1280×720: outra quebra de estrofe, outro tamanho relativo
     * de letra, outro enquadramento. Deixaria de ser espelho, e ninguém veria a
     * diferença olhando o celular.
     *
     * Com `LARG` 1280 e alvo 960 o resultado é **213 dpi**, que devolve 961,5 px
     * CSS. **Não prometemos identidade de pixel** — 213,33 não é inteiro e nunca
     * vai ser. Prometemos o mesmo viewport com meio ponto percentual de folga, o
     * que não muda uma quebra de linha; e o diagnóstico imprime os DOIS números
     * para que essa leitura nunca dependa de fé.
     */
    fun dpiPara(alvoCss: Int): Int {
        val alvo = if (alvoCss <= 0) ALVO_CSS_PADRAO else alvoCss
        return Math.round(LARG * 160f / alvo)
    }

    /**
     * Liga o espelho. **Main thread** (ver "Threading" no KDoc do objeto).
     *
     * [onQuadro] recebe cada quadro pronto para o fio, **na thread de
     * drenagem** — quem o implementa não pode bloquear: um `offer()` numa fila
     * limitada é o contrato do lado do servidor, e um `put()` ali dentro
     * pararia o encoder do aparelho que está projetando o culto por causa de um
     * tablet no fundo do salão.
     */
    fun ligar(act: Activity, modo: Modo, onQuadro: (Quadro) -> Unit): Resultado {
        if (!naMain()) {
            // Nunca lançar: uma exceção subindo por um `@JavascriptInterface`
            // vira crash do app na mão do operador. Falhar com frase é o
            // contrato de todo este arquivo.
            Log.w(TAG, "ligar() fora da main thread")
            return Resultado.Recusado("erro interno: o espelho foi ligado da thread errada")
        }
        if (ligado) {
            return Resultado.Recusado("o espelho já está ligado")
        }
        this.modo = modo
        this.onQuadro = onQuadro
        this.dono = WeakReference(act)
        // O relógio da SESSÃO nasce aqui, e só aqui: uma remontagem por
        // `ERROR_RECLAIMED` não pode rebobinar a base, senão o `tfdt` do
        // cliente anda para trás e a MediaSource quebra em silêncio.
        EspelhoCodec.abrirSessao()
        reclaimsNaJanela = 0
        ultimoReclaimEm = 0L
        ultimoJpegEm = 0L

        val r = montar(act)
        if (r is Resultado.Recusado) {
            this.onQuadro = null
            this.dono = null
            diag.registrar("espelho não ligou: ${r.motivo}")
            return r
        }
        ligado = true
        diag.registrar("espelho ligado em ${if (modo == Modo.VIDEO) "vídeo" else "imagem"}")
        return r
    }

    /**
     * [ligar] chamado de qualquer thread, com o desfecho por callback.
     *
     * Existe pelo mesmo motivo do `WebUpdater.checkAsync`: quem chama é um
     * `@JavascriptInterface`, que roda numa thread do WebView — e a criação da
     * janela **tem** de ser na main. Esperar o resultado com um latch a partir
     * da thread do WebView seria pedir um travamento no dia em que a main
     * estiver ocupada; o lado web já fala em Promise, então o assíncrono é o
     * formato natural.
     */
    fun ligarAsync(act: Activity, modo: Modo, onQuadro: (Quadro) -> Unit, aoTerminar: (Resultado) -> Unit) {
        main.post { aoTerminar(ligar(act, modo, onQuadro)) }
    }

    /**
     * Desliga o espelho. **Pode ser chamado de qualquer thread** — é o que o
     * `espelhoDesligar()` da ponte precisa: ele escreve um `@Volatile` e volta,
     * sem entrar na fila `io` (que pode estar ocupada por um download de
     * 380 MB).
     *
     * A ordem importa e está em [desmontar]. A escrita em `ligado` acontece
     * **antes** do `post`, para que o laço de dreno e o servidor parem de
     * produzir no mesmo instante em que o operador tocou no botão.
     */
    fun desligar() {
        ligado = false
        codec?.parar()
        if (naMain()) desmontar() else main.post { desmontar() }
    }

    /**
     * Garante que a janela do espelho está de pé **sobre a tela virtual que já
     * existe**, e ligada à Activity ATUAL. Chamada do `onCreate` da
     * [MainActivity], ao lado do `syncPresentation()`.
     *
     * É o invariante 5 do KDoc do objeto: a Activity morre e renasce por coisas
     * banais (fonte do sistema, idioma, Recentes) enquanto o `VirtualDisplay` e
     * o `MediaCodec` seguem vivos no serviço. Sem isto, o espelho continuaria
     * "funcionando" — codificando um retângulo preto.
     *
     * A troca de dono é detectada por **identidade da Activity**, não por
     * `isShowing`: uma `Presentation` construída com o `Context` de uma
     * Activity destruída pode continuar exibida e mesmo assim estar amarrada a
     * recursos mortos.
     */
    fun sincronizarJanela(act: Activity) {
        if (!naMain()) {
            main.post { sincronizarJanela(act) }
            return
        }
        if (!ligado) return
        val vdd = vd ?: return
        val atual = janela
        if (atual != null && dono?.get() === act && atual.isShowing) return
        dono = WeakReference(act)
        derrubarJanela()
        if (!criarJanela(act, vdd)) {
            diag.registrar("a janela do espelho não voltou — espelho desligado")
            desligar()
            return
        }
        diag.registrar("janela do espelho remontada")
    }

    /**
     * Pede um quadro-chave. Sem efeito no modo imagem — lá **todo** quadro é
     * completo por construção, e é justamente por isso que o modo imagem não
     * tem a classe de bug do "cliente que entrou antes do IDR".
     */
    fun pedirIdr() {
        codec?.pedirIdr()
    }

    /** Ajuste térmico: só bitrate, nunca resolução. Ver o invariante 3. */
    fun ajustarBitrate(bps: Int) {
        codec?.ajustarBitrate(bps)
    }

    // ---------- montagem e desmontagem ----------

    /**
     * Cria encoder (ou leitor de imagens), tela virtual e janela, nesta ordem —
     * que é a ordem que a API impõe (ver o diagrama no KDoc do objeto).
     *
     * Devolve [Resultado.Recusado] em vez de lançar, e **limpa o que já tinha
     * criado antes de devolver**: um `MediaCodec` configurado e abandonado
     * retém uma instância de hardware, e o `ligar()` seguinte falharia por causa
     * do anterior — a falha mais confusa possível, porque a segunda tentativa
     * culpa o aparelho.
     */
    private fun montar(act: Activity): Resultado {
        val dm = act.getSystemService(DisplayManager::class.java)
            ?: return Resultado.Recusado("o sistema não expôs o DisplayManager")

        val alvo = alvoCssDaTv(dm)
        val dpi = dpiPara(alvo)
        geracao++
        val ger = geracao

        var vdNovo: VirtualDisplay? = null
        var codecNovo: EspelhoCodec? = null
        try {
            if (modo == Modo.VIDEO) {
                val c = EspelhoCodec { q -> quadroSaiu(q) }
                // `iniciar` chama de volta com a input surface entre o
                // `configure` e o `start` — é a única janela em que a API
                // permite criar o consumidor.
                c.iniciar { surface ->
                    vdNovo = criarTelaVirtual(dm, dpi, surface)
                }
                codecNovo = c
            } else {
                val surface = abrirLeitor()
                vdNovo = criarTelaVirtual(dm, dpi, surface)
            }
        } catch (e: MediaCodec.CodecException) {
            limparParcial(vdNovo, codecNovo)
            Log.w(TAG, "encoder recusou", e)
            val motivo = if (e.errorCode == MediaCodec.CodecException.ERROR_INSUFFICIENT_RESOURCE) {
                "o aparelho não tem encoder livre agora — tente sem a TV conectada"
            } else {
                "o encoder recusou (${e.javaClass.simpleName}: ${e.message})"
            }
            return Resultado.Recusado(motivo)
        } catch (e: Throwable) {
            limparParcial(vdNovo, codecNovo)
            Log.w(TAG, "montagem do espelho falhou", e)
            return Resultado.Recusado("a tela virtual não subiu (${e.javaClass.simpleName}: ${e.message})")
        }

        val vdd = vdNovo
        if (vdd == null) {
            limparParcial(null, codecNovo)
            return Resultado.Recusado("o sistema não criou a tela virtual")
        }

        vd = vdd
        codec = codecNovo
        if (!criarJanela(act, vdd)) {
            // Invariante 2: recusa, com a classe e a mensagem já registradas
            // por `criarJanela`. Nunca tentar de novo com outra flag.
            vd = null
            codec = null
            limparParcial(vdd, codecNovo)
            return Resultado.Recusado("a janela do espelho foi recusada pelo sistema")
        }

        publicarFatos(vdd, dpi, alvo, codecNovo)
        if (codecNovo != null) abrirDreno(codecNovo, ger)
        return Resultado.Ok(vdd.display.displayId, dpi, alvo, modo)
    }

    /**
     * **`flags = 0`.** A linha mais importante deste arquivo — ver o
     * invariante 1. Fica numa função só para que exista **um** lugar onde o
     * zero pode ser lido, e para que qualquer alteração dele apareça no diff
     * como o que é.
     */
    private fun criarTelaVirtual(dm: DisplayManager, dpi: Int, surface: Surface): VirtualDisplay? =
        dm.createVirtualDisplay(NOME_VD, LARG, ALT, dpi, surface, 0)

    /** Cria e exibe a janela. `false` = recusada (a frase já foi registrada). */
    private fun criarJanela(act: Activity, vdd: VirtualDisplay): Boolean {
        val p = MirrorPresentation(act, vdd.display)
        p.setOnDismissListener {
            // Dismiss ESPONTÂNEO: só anular a referência deixaria o WebView do
            // espelho vivo no MessageBus — recebendo comandos e, com autoplay
            // liberado, tocando áudio numa janela que ninguém vê. É a mesma
            // lição que o `syncPresentation` da MainActivity já pagou.
            if (janela === p) {
                janela = null
                p.release()
            }
        }
        return try {
            p.show()
            janela = p
            true
        } catch (e: Exception) {
            // `show()` roda o `onCreate` ANTES do addView que lança: o WebView
            // já existe, já entrou no MessageBus e já pediu a URL. Liberar é
            // obrigatório.
            Log.w(TAG, "janela do espelho recusada", e)
            diag.registrar("janela do espelho recusada — ${e.javaClass.simpleName}: ${e.message}")
            p.release()
            try { p.dismiss() } catch (_: Exception) { }
            false
        }
    }

    private fun derrubarJanela() {
        val p = janela
        janela = null
        if (p != null) {
            p.release()
            try { p.dismiss() } catch (_: Exception) { }
        }
    }

    /**
     * Solta as peças mantendo a sessão (o relógio, o modo, o `onQuadro`) — é o
     * meio da remontagem por `ERROR_RECLAIMED`.
     *
     * **A ordem não é arbitrária:**
     *  1. a janela sai primeiro. `VirtualDisplay.release()` *"forcibly removes
     *     all remaining windows on the virtual display"*, e deixar o framework
     *     arrancar a janela derrubaria o WebView por um caminho que não passa
     *     pelo `MessageBus.detach`;
     *  2. depois a tela virtual, que é quem alimenta a Surface;
     *  3. o laço de dreno é avisado e **esperado** — chamar `stop()` enquanto
     *     outra thread está em `dequeueOutputBuffer` é o caminho conhecido para
     *     `IllegalStateException` (e, em alguns fornecedores, para travar o
     *     driver);
     *  4. e só então o encoder e a Surface de entrada.
     */
    private fun soltarPecas() {
        geracao++
        derrubarJanela()
        try { vd?.release() } catch (e: Exception) { Log.w(TAG, "tela virtual não soltou", e) }
        vd = null

        val c = codec
        codec = null
        c?.parar()
        val t = dreno
        dreno = null
        if (t != null && t !== Thread.currentThread()) {
            try { t.join(500) } catch (_: InterruptedException) { Thread.currentThread().interrupt() }
        }
        c?.soltar()

        val r = leitor
        leitor = null
        try { r?.close() } catch (_: Exception) { }
        val ht = leitorThread
        leitorThread = null
        ht?.quitSafely()
    }

    /** Desmontagem completa. Idempotente. Main thread. */
    private fun desmontar() {
        soltarPecas()
        onQuadro = null
        dono = null
        diag.fato("telaVirtual", null)
        diag.fato("viewport", null)
        diag.fato("encoder", null)
        diag.fato("modo", null)
        diag.registrar("espelho desligado")
    }

    private fun limparParcial(vdd: VirtualDisplay?, c: EspelhoCodec?) {
        try { vdd?.release() } catch (_: Exception) { }
        c?.soltar()
        val r = leitor
        leitor = null
        try { r?.close() } catch (_: Exception) { }
        val ht = leitorThread
        leitorThread = null
        ht?.quitSafely()
    }

    // ---------- a drenagem e o que fazer quando ela acaba ----------

    private fun abrirDreno(c: EspelhoCodec, ger: Int) {
        dreno = thread(name = "av-espelho-encoder", isDaemon = true) {
            val fim = try {
                c.drenar()
            } catch (e: Throwable) {
                Log.w(TAG, "dreno do encoder morreu", e)
                EspelhoCodec.Fim.ERRO
            }
            main.post { tratarFim(fim, ger) }
        }
    }

    private fun tratarFim(fim: EspelhoCodec.Fim, ger: Int) {
        // Desligamento em ordem, ou sessão já trocada: nada a fazer. É para
        // isto que o token de geração existe.
        if (!ligado || ger != geracao) return
        when (fim) {
            EspelhoCodec.Fim.NORMAL -> Unit
            EspelhoCodec.Fim.RECLAMADO -> tratarReclaim()
            EspelhoCodec.Fim.SEM_RECURSO -> {
                diag.registrar("o aparelho ficou sem encoder — espelho desligado")
                desligar()
            }
            EspelhoCodec.Fim.ERRO -> {
                diag.registrar("o encoder falhou — espelho desligado")
                desligar()
            }
        }
    }

    /**
     * `ERROR_RECLAIMED`: o sistema tomou o encoder — o modo de falha do app
     * **minimizado**, que é o estado normal deste app no meio do culto.
     *
     * **Uma remontagem, com espera; a segunda em 5 minutos desliga com frase.
     * Nunca um laço.** A remontagem não é barata nem local: a Surface morreu
     * com o codec, então a tela virtual vai junto, e `release()` *"forcibly
     * removes all remaining windows"* — o WebView do espelho morre e é
     * reconstruído inteiro. Um laço que aloca um WebView sob pressão de memória
     * (que é exatamente a condição que causou o reclaim), no mesmo processo da
     * projeção, é o único caminho deste desenho capaz de **derrubar o culto por
     * causa de um recurso auxiliar**.
     */
    private fun tratarReclaim() {
        val agora = SystemClock.elapsedRealtime()
        if (ultimoReclaimEm > 0L && agora - ultimoReclaimEm > RECLAIM_JANELA_MS) {
            reclaimsNaJanela = 0
        }
        ultimoReclaimEm = agora
        reclaimsNaJanela++
        reclaimsTotal++
        diag.fato("reclaims", reclaimsTotal)

        if (reclaimsNaJanela >= 2) {
            diag.registrar("encoder tomado pelo sistema 2× — espelho desligado")
            desligar()
            return
        }
        diag.registrar("encoder tomado pelo sistema — remontando")
        val ger = geracao
        main.postDelayed({ if (ligado && ger == geracao) remontar() }, RECLAIM_ESPERA_MS)
    }

    private fun remontar() {
        val act = dono?.get()
        if (act == null || act.isFinishing || act.isDestroyed) {
            diag.registrar("sem tela para remontar o espelho — desligado")
            desligar()
            return
        }
        soltarPecas()
        // O fluxo recomeça: o cliente precisa saber que as NALUs anteriores não
        // continuam nestas. O relógio, não — ele é da sessão.
        EspelhoCodec.marcarDescontinuidade()
        val r = montar(act)
        if (r is Resultado.Recusado) {
            diag.registrar("remontagem falhou: ${r.motivo}")
            desligar()
        } else {
            diag.registrar("encoder e tela virtual remontados")
        }
    }

    /**
     * Cada quadro que sai passa por aqui antes de ir ao fio: é o ponto único
     * onde o ritmo é medido, e é ele que sustenta o alarme do §7.5 (bitrate e
     * fps cruzados, no `controle.js`, com a cena que o `nowPlaying` já
     * declarou).
     *
     * O `csd` conta bytes e **não conta quadro**: ele gasta rede e não é
     * imagem nenhuma.
     */
    private fun quadroSaiu(q: Quadro) {
        val ehImagem = q.tipo == EspelhoCodec.TIPO_VIDEO || q.tipo == EspelhoCodec.TIPO_JPEG
        diag.amostra(q.bytes.size, if (ehImagem) 1 else 0)
        onQuadro?.invoke(q)
    }

    // ---------- modo imagem ----------

    /**
     * Abre o `ImageReader` do modo imagem e devolve a Surface que a tela
     * virtual vai desenhar.
     *
     * `maxImages = 3`, **nunca 1**: `createVirtualDisplay` rejeita uma Surface
     * *single-buffered*. O consumo roda numa `HandlerThread` própria pelo mesmo
     * motivo do dreno do encoder — comprimir JPEG de 720p na main thread
     * competiria com a `Presentation` que está na TV.
     */
    private fun abrirLeitor(): Surface {
        val r = ImageReader.newInstance(LARG, ALT, PixelFormat.RGBA_8888, 3)
        val ht = HandlerThread("av-espelho-jpeg").apply { start() }
        val h = Handler(ht.looper)
        r.setOnImageAvailableListener({ origem ->
            val img = try {
                origem.acquireLatestImage()
            } catch (e: Exception) {
                Log.w(TAG, "imagem não adquirida", e)
                null
            }
            // Sem `return@` rotulado: o fluxo é uma condição, e o `finally` que
            // FECHA a imagem é obrigatório — um `Image` não fechado esgota o
            // `maxImages` do leitor em três quadros e a tela virtual para de
            // produzir, calada.
            if (img != null) {
                try {
                    val agora = SystemClock.elapsedRealtime()
                    if (agora - ultimoJpegEm >= INTERVALO_JPEG_MS) {
                        ultimoJpegEm = agora
                        comprimir(img)?.let { bytes ->
                            quadroSaiu(
                                Quadro(
                                    tipo = EspelhoCodec.TIPO_JPEG,
                                    // Todo JPEG é completo: no modo imagem não
                                    // existe "quadro que depende do anterior".
                                    chave = true,
                                    descontinuidade = false,
                                    ptsUs = EspelhoCodec.carimbar(img.timestamp / 1000L),
                                    bytes = bytes,
                                ),
                            )
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "quadro JPEG descartado", e)
                } finally {
                    img.close()
                }
            }
        }, h)
        leitor = r
        leitorThread = ht
        return r.surface
    }

    private fun comprimir(img: Image): ByteArray? {
        val bmp = paraBitmap(img) ?: return null
        return try {
            val saida = ByteArrayOutputStream(64 * 1024)
            bmp.compress(Bitmap.CompressFormat.JPEG, QUALIDADE_JPEG, saida)
            saida.toByteArray()
        } catch (e: Exception) {
            Log.w(TAG, "JPEG não comprimiu", e)
            null
        } finally {
            bmp.recycle()
        }
    }

    /**
     * `Image` RGBA_8888 → `Bitmap`.
     *
     * O `rowStride` de um `ImageReader` **quase nunca** é `largura ×
     * pixelStride`: o driver alinha as linhas. Copiar o buffer direto num
     * bitmap da largura pedida produz a imagem enviesada em diagonal — o
     * defeito clássico, e um que passa despercebido em resoluções onde o
     * alinhamento por acaso bate. Daí o bitmap intermediário mais largo e o
     * recorte.
     */
    private fun paraBitmap(img: Image): Bitmap? = try {
        val plano = img.planes[0]
        val buffer = plano.buffer
        buffer.rewind()
        val pixelStride = if (plano.pixelStride > 0) plano.pixelStride else 4
        val largComPadding = plano.rowStride / pixelStride
        val cheio = Bitmap.createBitmap(largComPadding, img.height, Bitmap.Config.ARGB_8888)
        cheio.copyPixelsFromBuffer(buffer)
        if (largComPadding > img.width) {
            val cortado = Bitmap.createBitmap(cheio, 0, 0, img.width, img.height)
            cheio.recycle()
            cortado
        } else {
            cheio
        }
    } catch (e: Exception) {
        Log.w(TAG, "bitmap não saiu da imagem", e)
        null
    }

    // ---------- a densidade ----------

    /**
     * O viewport CSS que a TV desenha hoje — ou [ALVO_CSS_PADRAO] quando não há
     * TV para medir. Ver [dpiPara].
     *
     * A tela virtual do espelho é excluída **por `FLAG_PRIVATE` e por id**: é o
     * predicado estrutural, nunca por nome. E `getRealMetrics` está depreciado
     * desde a API 31 sem substituto para *outra* tela — `getCurrentWindowMetrics`
     * só fala da janela atual —, então ele fica, dentro de um `try`.
     */
    @Suppress("DEPRECATION")
    private fun alvoCssDaTv(dm: DisplayManager): Int {
        val candidata: Display? = try {
            dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).firstOrNull {
                (it.flags and Display.FLAG_PRIVATE) == 0 && it.displayId != displayId
            }
        } catch (e: Exception) {
            Log.w(TAG, "não deu para consultar as telas", e)
            null
        }
        val tv = candidata ?: return ALVO_CSS_PADRAO

        return try {
            val m = DisplayMetrics()
            tv.getRealMetrics(m)
            if (m.densityDpi <= 0 || m.widthPixels <= 0) {
                ALVO_CSS_PADRAO
            } else {
                val css = m.widthPixels * 160 / m.densityDpi
                // Um valor absurdo (dpi mentiroso de dongle) daria um espelho
                // ilegível; o padrão é sempre defensável.
                if (css < 480 || css > 3840) ALVO_CSS_PADRAO else css
            }
        } catch (e: Exception) {
            Log.w(TAG, "métricas da TV indisponíveis", e)
            ALVO_CSS_PADRAO
        }
    }

    private fun publicarFatos(vdd: VirtualDisplay, dpi: Int, alvo: Int, c: EspelhoCodec?) {
        val d = vdd.display
        diag.fato(
            "telaVirtual",
            JSONObject()
                .put("larg", LARG)
                .put("alt", ALT)
                .put("dpi", dpi)
                .put("flags", d.flags)
                .put("privada", (d.flags and Display.FLAG_PRIVATE) != 0)
                // NÃO é medido: não existe getter público de FLAG_NEVER_BLANK
                // (ela é do `DisplayDeviceInfo`, interno). É DERIVADO de não
                // termos passado PUBLIC, e o nome do campo diz isso para o
                // Registro não afirmar o que ninguém leu.
                .put("neverBlankDerivado", (d.flags and Display.FLAG_PRIVATE) != 0)
                .put("id", d.displayId),
        )
        diag.fato(
            "viewport",
            JSONObject()
                .put("css", LARG * 160 / dpi)
                .put("cssExato", Math.round(LARG * 1600.0 / dpi) / 10.0)
                .put("alvo", alvo),
        )
        diag.fato("modo", if (modo == Modo.VIDEO) "video" else "imagem")
        if (c != null) {
            diag.fato(
                "encoder",
                JSONObject()
                    .put("nome", c.nome)
                    .put("maxInstancias", c.maxInstancias)
                    .put("reclaims", reclaimsTotal),
            )
        }
    }

    // ---------- a sonda de readback ----------

    /**
     * A sonda de readback: **o R1 respondido na primeira vez que o operador
     * liga**, sem build de debug e sem ninguém abrir um console.
     *
     * A pergunta que ela responde é a única que este desenho inteiro não pode
     * responder por leitura de código: *a camada de vídeo entra na composição
     * de um `VirtualDisplay` privado, neste aparelho?* Duas issues abertas do
     * Flutter apontam para o mesmo lugar (imagem escura demais em Samsung;
     * `SurfaceView` preto depois de bloquear/desbloquear), e a Samsung é o
     * aparelho do operador.
     *
     * ## Três decisões, e as três são o que a torna útil
     *
     *  1. **Ela roda num `VirtualDisplay` SEPARADO E DESCARTÁVEL**, jamais no de
     *     produção. Não é economia: `setSurface` está proibido (ver [Modo]), e
     *     medir no display que está no ar exigiria justamente isso.
     *  2. **Comparação com TOLERÂNCIA, e os RGB medidos SEMPRE impressos** —
     *     nunca só o veredito. Num aparelho com a imagem escurecida, uma
     *     comparação exata falharia nos dois pontos e imprimiria "TELA INTEIRA
     *     PRETA": um diagnóstico falso, que manda o próximo leitor caçar um
     *     defeito que não existe.
     *  3. **Prazo, com veredito próprio.** Sem ele,
     *     `acquireLatestImage()` devolve `null` para sempre e a sonda nunca
     *     termina — justamente no caso que ela existe para detectar.
     *
     * ## O contrato de layout que a `sonda.html` tem de honrar
     *
     * Estes pontos são amostrados em fração da tela, e a página tem de pintar
     * exatamente isto (fundo `--accent` chapado; um `<video>` de magenta puro
     * centrado, ocupando ~40% × 40%; uma faixa preta no topo e uma branca
     * embaixo, ambas centradas horizontalmente):
     *
     * | amostra | ponto | esperado |
     * |---|---|---|
     * | fora    | (10%, 50%) | `--accent` |
     * | dentro  | (50%, 50%) | `#FF00FF` |
     * | preto   | (50%, 5%)  | `#000000` |
     * | branco  | (50%, 95%) | `#FFFFFF` |
     * | canto   | (2%, 2%)   | `--accent` |
     *
     * Preto e branco existem para responder em NÚMERO o que o
     * `KEY_COLOR_RANGE` não garante (ver a armadilha 5 do [EspelhoCodec]).
     *
     * **Enquanto a `sonda.html` não existir no bundle** (ela é entrega do lado
     * web), o WebView carrega a página de erro do próprio Chromium: a sonda
     * medirá as cores dela e dirá `INDEFINIDO` com os RGB à vista. Isso é o
     * comportamento certo — instrumento não inventa.
     *
     * ## Quem a chama
     *
     * A ligação da ponte (`espelhoLigar`, P5): **depois de [ligar] e antes de
     * aceitar o primeiro cliente**. Ela não é chamada de dentro de [ligar] de
     * propósito — `ligar` é síncrona e a sonda leva segundos; embutir uma na
     * outra faria o operador esperar a medição para o espelho subir, e faria a
     * medição virar pré-requisito do recurso em vez de diagnóstico dele.
     *
     * @param aoTerminar chamado **na main thread**. A assinatura da
     *   especificação (`fun sonda(): Sonda`) era síncrona; ela não sobrevive ao
     *   encontro de duas exigências deste mesmo documento — a janela nasce na
     *   main, e a espera pelo primeiro quadro tem prazo de 5 s. Bloquear a main
     *   por 5 s é ANR; bloquear outra thread esperando a main é o travamento do
     *   dia em que ela estiver ocupada.
     */
    @Suppress("DEPRECATION")
    fun sonda(act: Activity, aoTerminar: (Sonda) -> Unit) {
        if (!naMain()) {
            main.post { sonda(act, aoTerminar) }
            return
        }
        val dm = act.getSystemService(DisplayManager::class.java)
        if (dm == null) {
            aoTerminar(vazia("o sistema não expôs o DisplayManager"))
            return
        }

        val ht = HandlerThread("av-espelho-sonda").apply { start() }
        val h = Handler(ht.looper)
        val leitorS = ImageReader.newInstance(SONDA_LARG, SONDA_ALT, PixelFormat.RGBA_8888, 3)
        var vdS: VirtualDisplay? = null
        var janelaS: MirrorPresentation? = null

        val fechado = AtomicBoolean(false)

        /**
         * O veredito é dado UMA vez. Sem esta trava, o desfecho antecipado
         * dispararia a cada quadro que chega enquanto o `PixelCopy` do quadro
         * anterior ainda não voltou — vários bitmaps de 640×360 alocados para
         * responder a mesma pergunta.
         */
        val decidido = AtomicBoolean(false)
        val quadros = AtomicInteger(0)
        val ultima = AtomicReference<IntArray?>(null)
        val inicio = SystemClock.elapsedRealtime()

        fun encerrar(s: Sonda) {
            if (!fechado.compareAndSet(false, true)) return
            main.post {
                val p = janelaS
                if (p != null) {
                    p.release()
                    try { p.dismiss() } catch (_: Exception) { }
                }
                try { vdS?.release() } catch (_: Exception) { }
                try { leitorS.close() } catch (_: Exception) { }
                ht.quitSafely()
                diag.fato("readback", s.paraJson())
                diag.registrar("readback: ${s.veredito.name} · ${s.nota}")
                aoTerminar(s)
            }
        }

        // O `PixelCopy` só entra no caso em que "deu preto" seria
        // indistinguível: ele copia APENAS o buffer daquela janela, então preto
        // aqui e colorido no VirtualDisplay é camada `SurfaceControl` irmã
        // (normal), e preto nos dois é buffer protegido. É o único código deste
        // lote que ninguém neste repositório jamais exercitou — daí o `try` e o
        // prazo próprio.
        fun concluir(s: Sonda) {
            if (!decidido.compareAndSet(false, true)) return
            if (s.veredito != Sonda.Veredito.VIDEO_PRETO) {
                encerrar(s)
                return
            }
            val win = janelaS?.window
            if (win == null) {
                encerrar(s)
                return
            }
            try {
                val bmp = Bitmap.createBitmap(SONDA_LARG, SONDA_ALT, Bitmap.Config.ARGB_8888)
                // A sobrecarga `request(Window, …)` está depreciada desde a API
                // 34 (a supressão é da função inteira, no cabeçalho). Ela
                // funciona, e é o ÚNICO jeito público de ler o buffer de uma
                // janela — `request(Surface, …)` não serve: a Surface aqui é a
                // do ImageReader, que é justamente o que já foi medido.
                PixelCopy.request(
                    win,
                    bmp,
                    { res ->
                        val cor = if (res == PixelCopy.SUCCESS) {
                            bmp.getPixel(SONDA_LARG / 2, SONDA_ALT / 2) and 0xFFFFFF
                        } else {
                            null
                        }
                        bmp.recycle()
                        encerrar(s.copy(pixelCopy = cor))
                    },
                    h,
                )
                // Se o callback nunca vier, o veredito sai sem ele. `encerrar` é
                // idempotente.
                h.postDelayed({ encerrar(s) }, PRAZO_PIXELCOPY_MS)
            } catch (e: Throwable) {
                Log.w(TAG, "PixelCopy indisponível", e)
                encerrar(s)
            }
        }

        leitorS.setOnImageAvailableListener({ origem ->
            val img = try { origem.acquireLatestImage() } catch (_: Exception) { null }
            if (img != null) {
                try {
                    quadros.incrementAndGet()
                    ultima.set(
                        intArrayOf(
                            amostrar(img, 0.10f, 0.50f),
                            amostrar(img, 0.50f, 0.50f),
                            amostrar(img, 0.50f, 0.05f),
                            amostrar(img, 0.50f, 0.95f),
                            amostrar(img, 0.02f, 0.02f),
                        ),
                    )
                } catch (e: Exception) {
                    Log.w(TAG, "amostragem falhou", e)
                } finally {
                    // Fechar SEMPRE: três imagens não fechadas esgotam o
                    // `maxImages` e a tela virtual para de produzir, calada.
                    img.close()
                }
                // Desfecho antecipado: só depois de a página ter tido tempo de
                // pintar, e só quando o fundo já bate. Antes disso um quadro
                // preto é o carregamento, não um defeito.
                if (SystemClock.elapsedRealtime() - inicio >= ESPERA_PINTAR_MS) {
                    val a = ultima.get()
                    if (a != null && proximo(a[0], FUNDO)) {
                        concluir(julgar(a, quadros.get()))
                    }
                }
            }
        }, h)

        try {
            vdS = dm.createVirtualDisplay(
                NOME_VD_SONDA,
                SONDA_LARG,
                SONDA_ALT,
                dpiPara(ALVO_CSS_PADRAO),
                leitorS.surface,
                // `flags = 0` também aqui: a sonda mede o MESMO tipo de tela
                // que a produção usa. Medir noutra configuração responderia
                // outra pergunta.
                0,
            )
        } catch (e: Exception) {
            Log.w(TAG, "tela virtual da sonda não subiu", e)
        }
        val vdd = vdS
        if (vdd == null) {
            encerrar(vazia("a tela virtual da sonda não subiu"))
            return
        }
        val p = MirrorPresentation(act, vdd.display, URL_SONDA)
        try {
            p.show()
            janelaS = p
        } catch (e: Exception) {
            Log.w(TAG, "janela da sonda recusada", e)
            p.release()
            try { p.dismiss() } catch (_: Exception) { }
            encerrar(vazia("a janela da sonda foi recusada — ${e.javaClass.simpleName}"))
            return
        }

        h.postDelayed({ concluir(julgar(ultima.get(), quadros.get())) }, PRAZO_SONDA_MS)
    }

    private fun vazia(nota: String) =
        Sonda(Sonda.Veredito.SEM_QUADRO, 0, 0, 0, 0, 0, 0, null, nota)

    private fun julgar(a: IntArray?, quadros: Int): Sonda {
        if (a == null || quadros == 0) {
            return vazia("nenhum quadro em ${PRAZO_SONDA_MS / 1000} s")
        }
        val fora = a[0]
        val dentro = a[1]
        val v = when {
            proximo(fora, FUNDO) && proximo(dentro, MAGENTA) -> Sonda.Veredito.OK
            proximo(fora, FUNDO) && proximo(dentro, PRETO) -> Sonda.Veredito.VIDEO_PRETO
            proximo(fora, PRETO) && proximo(dentro, PRETO) -> Sonda.Veredito.TUDO_PRETO
            escurecido(fora, FUNDO) && (escurecido(dentro, MAGENTA) || proximo(dentro, MAGENTA)) ->
                Sonda.Veredito.OK_ESCURO
            else -> Sonda.Veredito.INDEFINIDO
        }
        return Sonda(v, fora, dentro, a[2], a[3], a[4], quadros, null, "$quadros quadros")
    }

    /**
     * Lê um pixel direto do buffer, sem `Bitmap` no meio — são cinco pixels por
     * quadro, e alocar um bitmap de 640×360 a cada um seria trabalho de sobra
     * numa thread que existe para medir.
     */
    private fun amostrar(img: Image, fx: Float, fy: Float): Int {
        val plano = img.planes[0]
        val buf = plano.buffer
        val x = ((img.width - 1) * fx).toInt().coerceIn(0, img.width - 1)
        val y = ((img.height - 1) * fy).toInt().coerceIn(0, img.height - 1)
        val off = y * plano.rowStride + x * plano.pixelStride
        if (off + 2 >= buf.limit()) return 0
        val r = buf.get(off).toInt() and 0xFF
        val g = buf.get(off + 1).toInt() and 0xFF
        val b = buf.get(off + 2).toInt() and 0xFF
        return (r shl 16) or (g shl 8) or b
    }

    private fun canal(c: Int, desl: Int) = (c ushr desl) and 0xFF

    private fun proximo(medido: Int, esperado: Int, tol: Int = TOLERANCIA): Boolean {
        for (d in intArrayOf(16, 8, 0)) {
            if (Math.abs(canal(medido, d) - canal(esperado, d)) > tol) return false
        }
        return true
    }

    /**
     * "A mesma cor, mais escura" — o caso da issue do Flutter, e o único em que
     * o espelho **vale mesmo assim** (a folha do operador passa a dizer que as
     * cores da rede saem mais escuras que o telão).
     *
     * Nenhum canal pode estar mais claro que o esperado, e a razão de
     * luminância tem de cair numa faixa que exclui tanto "igual" quanto
     * "preto" — os dois já têm veredito próprio.
     */
    private fun escurecido(medido: Int, esperado: Int): Boolean {
        for (d in intArrayOf(16, 8, 0)) {
            if (canal(medido, d) > canal(esperado, d) + TOLERANCIA) return false
        }
        val lm = luz(medido)
        val le = luz(esperado)
        if (le <= 0.0) return false
        val razao = lm / le
        return razao in 0.15..0.85
    }

    private fun luz(c: Int) =
        0.2126 * canal(c, 16) + 0.7152 * canal(c, 8) + 0.0722 * canal(c, 0)

    private fun naMain() = Looper.myLooper() === Looper.getMainLooper()

    // ---------- constantes da sonda ----------

    private const val URL_SONDA = "${WebViewFactory.ORIGIN}/web/espelho/sonda.html"

    /**
     * A sonda não precisa da resolução de produção — ela mede cor, e o layout
     * dela é todo em porcentagem. Menor custa menos memória e sobe mais rápido.
     */
    private const val SONDA_LARG = 640
    private const val SONDA_ALT = 360

    private const val PRAZO_SONDA_MS = 5_000L
    private const val PRAZO_PIXELCOPY_MS = 1_500L
    private const val ESPERA_PINTAR_MS = 1_200L

    /** ±28 por canal. Ver a decisão 2 do KDoc da [sonda]. */
    private const val TOLERANCIA = 28

    /**
     * `--accent` de `assets/web/shared/tokens.css`.
     *
     * **Espelhado à mão**, exatamente como `res/values/colors.xml` já espelha
     * `--bg`: nada no build detecta a divergência, e o OTA pode trocar a base
     * web sem trocar o APK. Se o token mudar, este valor muda junto — e o único
     * sintoma de esquecer seria a sonda dizer `INDEFINIDO` com o RGB certo
     * impresso ao lado, que é o modo de falhar mais barato disponível.
     */
    private const val FUNDO = 0xDBA849

    /**
     * Magenta puro. Ele é INSTRUMENTO, não cor de marca: existe justamente por
     * não pertencer à paleta — nenhum pixel legítimo do sistema é esta cor, e
     * por isso ele não entra em `tokens.css`.
     */
    private const val MAGENTA = 0xFF00FF

    private const val PRETO = 0x000000
}
