package br.org.iasd.av

import android.app.Presentation
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.Display
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebView
import android.widget.FrameLayout

/**
 * O telão. Uma `Presentation` desenha numa tela secundária (Miracast/Smart
 * View, MiraScreen, cabo HDMI) **sem espelhar o celular** — é exatamente o
 * ganho que justifica o app existir: a TV recebe só o Display, na resolução
 * nativa dela, enquanto o celular continua mostrando o Controle.
 *
 * O WebView aqui é irmão do WebView do Controle: mesmo processo, mesmo
 * origin, portanto mesmo IndexedDB, mesmo OPFS e mesmo canal de comandos.
 * Nada em `shared/db.js` ou `shared/stage.js` precisou mudar por causa disso.
 *
 * RECONEXÃO VEM DE GRAÇA: quando o dongle cai e volta, o Android destrói e
 * recria a Presentation, o WebView recarrega `/display/` e dispara
 * `display-ready` — e o Controle já reenvia o estado atual ao receber isso
 * (comportamento que existe desde o PWA). Não há mecanismo paralelo aqui.
 */
class StagePresentation(
    outerContext: Context,
    display: Display,
) : Presentation(outerContext, display, R.style.Theme_AvIasd_Presentation) {

    var web: WebView? = null
        private set

    /** Depois de [release] nada mais é remontado (ex.: renderer morto no fim). */
    private var released = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window?.apply {
            setBackgroundDrawableResource(android.R.color.black)
            addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        val root = FrameLayout(context)
        root.setBackgroundColor(Color.BLACK)
        root.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )

        // A tela de projeção não tem barras do sistema, nunca.
        root.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )

        setContentView(root)
        buildWebView(root)
    }

    /**
     * Monta (ou remonta) o WebView do telão dentro de [root]. É chamado de novo
     * quando o renderer morre: recarregar `/display/` dispara `display-ready` e
     * o Controle reenvia a cena — o mesmo caminho da reconexão do dongle.
     */
    private fun buildWebView(root: FrameLayout) {
        if (released) return
        // Sem o handler `/saf/`: o telão nunca busca arquivo do dispositivo —
        // `importShare` e `syncDeviceFolder` (os dois consumidores) rodam no
        // Controle e copiam tudo para o OPFS antes de o telão ver qualquer
        // coisa. Ver [WebViewFactory.assetLoader].
        val loader = WebViewFactory.assetLoader(context, withSaf = false)
        // `keepVisible = true`: o telão não pode se declarar oculto quando o
        // app é minimizado — é o que fazia o embed do YouTube pausar sozinho.
        // Ver WebViewFactory.KeepVisibleWebView.
        val w = WebViewFactory.create(context, loader, keepVisible = true) {
            web = null
            root.post { buildWebView(root) }
        }
        // O microfone (push-to-talk) é capturado AQUI, no telão, não no
        // Controle: é a projeção que deve reproduzi-lo, e no navegador — onde
        // Display e Controle são páginas separadas — essa é a única escolha
        // correta. Sem este client o WebView nega getUserMedia em silêncio.
        w.webChromeClient = MicChromeClient(context)
        // O telão não recebe toques (o Miracast não propaga toque, e um
        // toque acidental jamais pode alterar a projeção).
        w.isFocusable = false
        w.isFocusableInTouchMode = false

        val bridge = NativeBridge(
            ctx = context.applicationContext,
            role = "display",
            host = null,
            webRef = { web },
        )
        w.addJavascriptInterface(bridge, "__AVBridge")

        root.addView(
            w,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )

        web = w
        MessageBus.attach(w)
        w.loadUrl(WebViewFactory.URL_DISPLAY)
    }

    /**
     * Recarrega a página do telão — usado quando o operador aplica uma
     * atualização da base web AO VIVO (ver `WebUpdater.applyNow`).
     *
     * `clearCache(true)` antes: a recarga precisa buscar os arquivos do bundle
     * NOVO, e uma cópia em cache do JS antigo faria o telão voltar com metade
     * de cada versão — o pior desfecho possível, porque tudo *parece* ter
     * funcionado. Os assets são locais, então o custo é desprezível.
     *
     * A cena volta sozinha: a página do Display dispara `display-ready` ao
     * carregar, e o Controle reenvia o que estava no ar (`resendSceneToDisplay`)
     * — o mesmo caminho da reconexão do dongle, que já existe e já é testado em
     * culto.
     */
    fun recarregar() {
        val w = web ?: return
        w.clearCache(true)
        w.loadUrl(WebViewFactory.URL_DISPLAY)
    }

    /**
     * **NÃO derruba mais o WebView aqui** (v1.28).
     *
     * `Presentation` é um `Dialog`, e `Dialog.onStop()` chega em situações que
     * NÃO são "o telão acabou" — entre elas o app sair da frente. Destruir o
     * WebView nesse momento apagava a projeção inteira toda vez que o operador
     * minimizava o app: nada tocava até ele voltar, e ao voltar o
     * `syncPresentation` encontrava a Presentation fora do ar, criava OUTRA, e
     * o telão recarregava do zero. Era isso que se via como "o vídeo pausa ao
     * minimizar" — inclusive com mídia LOCAL, que é o que provou que o problema
     * nunca foi do YouTube.
     *
     * Quem derruba o telão são os donos do ciclo de vida, e eles já faziam
     * isso explicitamente: `syncPresentation` (tela trocou ou sumiu),
     * `onDestroy` da Activity e a morte do renderer. `onStop` não é nenhum
     * deles.
     */
    override fun onStop() {
        super.onStop()
    }

    /**
     * Desfaz a suspensão que o Chromium aplica quando o app sai da frente.
     *
     * `WebView.onResume()`/`resumeTimers()` não são só "o inverso de pausar":
     * são o único jeito, pela API pública, de dizer ao motor que ESTE WebView
     * deve continuar trabalhando com o app em segundo plano. Chamado do
     * `onStop` da Activity — o instante exato em que o sistema decidiria
     * desacelerar tudo. Vale só para o telão: ele É a projeção.
     */
    fun keepPlaying() {
        val w = web ?: return
        try {
            w.onResume()
            w.resumeTimers()
        } catch (_: Exception) { /* WebView já destruído */ }
    }

    /** Derruba o WebView do telão sem deixar o barramento com cliente morto. */
    fun release() {
        released = true
        val w = web ?: return
        web = null
        MessageBus.detach(w)
        w.loadUrl("about:blank")
        (w.parent as? ViewGroup)?.removeView(w)
        w.destroy()
    }
}
