package br.org.iasd.av

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.hardware.display.DisplayManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONArray
import org.json.JSONObject

/**
 * A tela do operador: hospeda o WebView do **Controle** e orquestra a
 * `StagePresentation` (o Display) na TV.
 *
 * O que esta classe NÃO faz — de propósito: transporte, playlist, letra
 * sincronizada, Bíblia, fades, coleções. Tudo isso é a base web madura em
 * `assets/web/`, e reimplementar qualquer parte disso em Kotlin seria
 * duplicar lógica que já funciona.
 */
class MainActivity : ComponentActivity(), BridgeHost {

    private lateinit var root: FrameLayout
    private lateinit var webContainer: FrameLayout
    private lateinit var fullscreenContainer: FrameLayout
    private var web: WebView? = null

    private var presentation: StagePresentation? = null
    private var displayManager: DisplayManager? = null

    /** Fullscreen HTML5 (a preview do Controle em tela cheia). */
    private var customView: View? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null

    /** Callback do `AVNative.pickFolder()` em andamento. */
    private var pendingFolderPick: ((Uri?) -> Unit)? = null

    /** Share recebido por intent, aguardando o lado web consumir. */
    private var pendingShare: JSONObject? = null

    private val folderPicker = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree(),
    ) { uri ->
        val cb = pendingFolderPick
        pendingFolderPick = null
        if (uri != null) {
            // Permissão PERSISTENTE: sem isso, o re-sync da pasta pediria o
            // seletor de novo a cada abertura do app.
            try {
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            } catch (e: SecurityException) {
                Log.w(TAG, "sem permissão persistente para $uri", e)
            }
        }
        cb?.invoke(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // A tela do operador não pode apagar no meio do culto.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)
        webContainer = FrameLayout(this)
        fullscreenContainer = FrameLayout(this)
        fullscreenContainer.setBackgroundColor(Color.BLACK)
        fullscreenContainer.visibility = View.GONE
        root.addView(webContainer, matchParent())
        root.addView(fullscreenContainer, matchParent())
        setContentView(root)

        val loader = WebViewFactory.assetLoader(this)
        val w = WebViewFactory.create(this, loader)
        w.webChromeClient = ControleChromeClient()
        val bridge = NativeBridge(
            ctx = applicationContext,
            role = "controle",
            host = this,
            webRef = { web },
        )
        w.addJavascriptInterface(bridge, "__AVBridge")
        webContainer.addView(w, matchParent())
        web = w
        MessageBus.attach(w)

        pendingShare = ShareIntake.parse(this, intent)

        w.loadUrl(WebViewFactory.URL_CONTROLE)

        displayManager = getSystemService(DisplayManager::class.java)
        displayManager?.registerDisplayListener(displayListener, null)

        onBackPressedDispatcher.addCallback(this) {
            // Sair do app por engano durante o culto derrubaria a projeção.
            // O botão voltar apenas manda a tarefa para segundo plano — a
            // sessão (e a Presentation na TV) continua viva.
            moveTaskToBack(true)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val share = ShareIntake.parse(this, intent) ?: return
        pendingShare = share
        // App já aberto: empurra o share na hora, sem esperar um novo init.
        web?.evaluateJavascript("window.__avShareArrived && window.__avShareArrived();", null)
    }

    override fun onResume() {
        super.onResume()
        syncPresentation()
    }

    override fun onDestroy() {
        displayManager?.unregisterDisplayListener(displayListener)
        presentation?.let {
            it.release()
            it.dismiss()
        }
        presentation = null
        web?.let {
            MessageBus.detach(it)
            webContainer.removeView(it)
            it.destroy()
        }
        web = null
        super.onDestroy()
    }

    // ---------- Presentation (o telão) ----------

    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = syncPresentation()
        override fun onDisplayRemoved(displayId: Int) = syncPresentation()
        override fun onDisplayChanged(displayId: Int) = syncPresentation()
    }

    /**
     * Mantém no ar exatamente uma Presentation na primeira tela de
     * apresentação disponível — e nenhuma quando não há TV conectada (aí o
     * app funciona como o PWA sozinho: a preview em tela cheia projeta).
     */
    private fun syncPresentation() {
        val dm = displayManager ?: return
        val target = dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).firstOrNull()
        val current = presentation

        if (target == null) {
            if (current != null) {
                current.release()
                current.dismiss()
                presentation = null
                notifyDisplayChange()
            }
            return
        }

        if (current != null) {
            if (current.display.displayId == target.displayId && current.isShowing) return
            current.release()
            current.dismiss()
            presentation = null
        }

        val p = StagePresentation(this, target)
        p.setOnDismissListener {
            if (presentation === p) presentation = null
        }
        try {
            p.show()
            presentation = p
        } catch (e: WindowManager.InvalidDisplayException) {
            // A tela sumiu entre a consulta e o show() (dongle instável).
            Log.w(TAG, "tela de apresentação sumiu antes do show()", e)
            presentation = null
        }
        notifyDisplayChange()
    }

    private fun notifyDisplayChange() {
        web?.evaluateJavascript("window.__avDisplaysChanged && window.__avDisplaysChanged();", null)
    }

    // ---------- BridgeHost ----------

    override fun requestFolderPick(onResult: (Uri?) -> Unit) {
        runOnUiThread {
            pendingFolderPick = onResult
            try {
                folderPicker.launch(null)
            } catch (e: Exception) {
                Log.w(TAG, "seletor de pasta indisponível", e)
                pendingFolderPick = null
                onResult(null)
            }
        }
    }

    override fun setKeepAwake(on: Boolean) {
        runOnUiThread {
            if (on) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }

    override fun listDisplays(): JSONArray {
        val out = JSONArray()
        val dm = displayManager ?: return out
        for (d in dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)) {
            val metrics = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            d.getRealMetrics(metrics)
            out.put(
                JSONObject()
                    .put("id", d.displayId)
                    .put("name", d.name ?: "")
                    .put("w", metrics.widthPixels)
                    .put("h", metrics.heightPixels)
                    .put("density", metrics.density.toDouble()),
            )
        }
        return out
    }

    override fun takePendingShare(): JSONObject? {
        val s = pendingShare
        pendingShare = null
        return s
    }

    // ---------- fullscreen HTML5 ----------

    private inner class ControleChromeClient : WebChromeClient() {

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (customView != null) {
                callback.onCustomViewHidden()
                return
            }
            customView = view
            customCallback = callback
            fullscreenContainer.addView(view, matchParent())
            fullscreenContainer.visibility = View.VISIBLE
            webContainer.visibility = View.GONE
            // A preview em tela cheia é 16:9 — o equivalente nativo do
            // `screen.orientation.lock('landscape')` que o PWA faz.
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            setSystemBarsHidden(true)
        }

        override fun onHideCustomView() {
            val v = customView ?: return
            fullscreenContainer.removeView(v)
            fullscreenContainer.visibility = View.GONE
            webContainer.visibility = View.VISIBLE
            customView = null
            customCallback?.onCustomViewHidden()
            customCallback = null
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            setSystemBarsHidden(false)
        }

        override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
            Log.d(TAG, "[web] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
            return true
        }
    }

    @Suppress("DEPRECATION")
    private fun setSystemBarsHidden(hidden: Boolean) {
        root.systemUiVisibility = if (hidden) {
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        } else {
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    private fun matchParent() = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
    )

    companion object {
        private const val TAG = "AvIasd"
    }
}
