package br.org.iasd.av

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.hardware.display.DisplayManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
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

    /**
     * Callback do `<input type="file">` em andamento.
     *
     * Um WebView **ignora `<input type="file">` por completo** sem
     * `onShowFileChooser` — o toque simplesmente não faz nada. No navegador o
     * seletor é nativo da plataforma; aqui é o app que precisa abri-lo. É
     * disso que dependem a importação para o Cronograma e a escolha do
     * wallpaper.
     */
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooser = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val cb = filePathCallback
        filePathCallback = null
        // parseResult devolve null quando o operador cancela — entregar esse
        // null é o que destrava o input para uma próxima tentativa.
        cb?.onReceiveValue(
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
        )
    }

    /** Share recebido por intent, aguardando o lado web consumir. */
    private var pendingShare: JSONObject? = null

    /** Há download em curso? (evita start/stop repetido do serviço) */
    private var backgroundWork = false

    // Android 13+ exige permissão para MOSTRAR a notificação do serviço de
    // sincronização. Negá-la não impede o serviço de rodar — só esconde o
    // indicador —, por isso o pedido é feito uma vez e sem bloquear nada.
    private val notifPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* concedida ou não, o app segue igual */ }

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

        // Decide a base web ANTES de qualquer WebView existir, para Controle e
        // Display servirem sempre o mesmo bundle nesta sessão (e para o
        // watchdog do OTA armar uma única vez).
        WebUpdater.beginSession(this)

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notifPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }

        // Procura uma base web nova em segundo plano. O que for baixado só
        // entra em cena no PRÓXIMO lançamento — nunca troca a base no meio de
        // uma projeção.
        WebUpdater.checkAsync(this)

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
        // Sem o WebView não há download para proteger — o serviço não pode
        // sobreviver à Activity segurando um wake lock à toa.
        if (backgroundWork) {
            backgroundWork = false
            try { SyncService.stop(this) } catch (_: Exception) { }
        }
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

    override fun setBackgroundWork(on: Boolean) {
        runOnUiThread {
            if (on == backgroundWork) return@runOnUiThread
            backgroundWork = on
            try {
                if (on) SyncService.start(this) else SyncService.stop(this)
            } catch (e: Exception) {
                // Um serviço recusado (política do fabricante, app em
                // background na hora do start) não pode derrubar a
                // sincronização: ela continua, só sem a proteção extra.
                Log.w(TAG, "serviço de sincronização indisponível", e)
                backgroundWork = false
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

    /**
     * Seletor de espelhamento. O Android **não expõe** o popup das
     * configurações rápidas (o painel de Transmitir/Smart View) a apps de
     * terceiros — `Settings.Panel` só cobre internet, wifi, nfc e volume. O
     * mais próximo em API pública é a tela de Cast das Configurações, que
     * lista as mesmas telas e é para onde o próprio Smart View leva. A cadeia
     * de fallback existe porque fabricantes remontam essas telas: sem a de
     * Cast, cai na de Tela; sem ela, nas Configurações.
     */
    override fun openCastPicker() {
        runOnUiThread {
            val candidates = listOf(
                Settings.ACTION_CAST_SETTINGS,
                Settings.ACTION_DISPLAY_SETTINGS,
                Settings.ACTION_SETTINGS,
            )
            for (action in candidates) {
                try {
                    startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    return@runOnUiThread
                } catch (e: Exception) {
                    Log.w(TAG, "seletor de cast indisponível: $action", e)
                }
            }
        }
    }

    override fun takePendingShare(): JSONObject? {
        val s = pendingShare
        pendingShare = null
        return s
    }

    // ---------- fullscreen HTML5 ----------

    private inner class ControleChromeClient : WebChromeClient() {

        /**
         * Abre o seletor de arquivos do sistema para um `<input type="file">`.
         * O intent vem pronto de [FileChooserParams.createIntent], já
         * respeitando o `accept` e o `multiple` declarados no HTML.
         */
        override fun onShowFileChooser(
            webView: WebView,
            callback: ValueCallback<Array<Uri>>,
            params: FileChooserParams,
        ): Boolean {
            // Um seletor anterior sem resposta deixaria o input travado para
            // sempre — encerra o pendente antes de abrir o novo.
            filePathCallback?.onReceiveValue(null)
            filePathCallback = callback
            return try {
                fileChooser.launch(params.createIntent())
                true
            } catch (e: Exception) {
                Log.w(TAG, "seletor de arquivos indisponível", e)
                filePathCallback = null
                callback.onReceiveValue(null)
                false
            }
        }

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
