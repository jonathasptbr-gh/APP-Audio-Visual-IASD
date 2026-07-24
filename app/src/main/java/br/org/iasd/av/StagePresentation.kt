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

        val loader = WebViewFactory.assetLoader(context)
        val w = WebViewFactory.create(context, loader)
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
        setContentView(root)

        web = w
        MessageBus.attach(w)
        w.loadUrl(WebViewFactory.URL_DISPLAY)
    }

    override fun onStop() {
        super.onStop()
        release()
    }

    /** Derruba o WebView do telão sem deixar o barramento com cliente morto. */
    fun release() {
        val w = web ?: return
        web = null
        MessageBus.detach(w)
        w.loadUrl("about:blank")
        (w.parent as? ViewGroup)?.removeView(w)
        w.destroy()
    }
}
