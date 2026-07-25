package br.org.iasd.av

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.hardware.display.DisplayManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
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

    /**
     * O lado web pediu para receber os botões físicos de volume.
     *
     * Ligado por `AVNative.captureVolumeKeys(true)` só depois que o Controle
     * carrega: se a Activity interceptasse as teclas desde o `onCreate`, uma
     * falha no JS deixaria o aparelho sem NENHUM controle de volume enquanto o
     * app estivesse aberto.
     */
    private var captureVolumeKeys = false

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

        // Volume desta Activity = mídia, sempre. Sem isto o Android escolhe a
        // stream pelo contexto e, com espelhamento ativo, os botões podem cair
        // na saída remota (o volume da TV) em vez do áudio do app.
        volumeControlStream = AudioManager.STREAM_MUSIC

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

    // ---------- botões físicos de volume ----------

    /**
     * Os botões de volume passam a mexer no **fader do app**, não na saída do
     * sistema.
     *
     * Era esse o problema durante o espelhamento: o Android roteia os botões
     * para a saída em uso, e com Miracast/Smart View ativo isso vira o volume
     * da TV — o operador mexia no botão e o fader do app não saía do lugar.
     * Consumindo a tecla aqui (`return true`, também no `onKeyUp`, senão o
     * sistema ainda reage ao evento de soltura) nada disso acontece: o evento
     * vira um passo no `#volSlider`, exatamente como arrastar o fader.
     *
     * **Válvula de escape:** com o fader já no máximo (ou no zero), o lado web
     * devolve a tecla via `adjustSystemVolume()` e ela volta a valer para o
     * sistema, com a UI de volume do Android. Sem isso, um aparelho com o
     * volume de mídia baixo ficaria sem jeito de subir enquanto o app
     * estivesse aberto.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (captureVolumeKeys && isVolumeKey(keyCode)) {
            val step = if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) 1 else -1
            web?.evaluateJavascript("window.__avVolumeKey && window.__avVolumeKey($step);", null)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (captureVolumeKeys && isVolumeKey(keyCode)) return true
        return super.onKeyUp(keyCode, event)
    }

    private fun isVolumeKey(keyCode: Int) =
        keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN

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
     * Seletor de **espelhamento de tela** (Smart View / Screen mirroring /
     * Wireless display) — não o Google Cast.
     *
     * Os dois convivem no Android e são coisas diferentes: o Google Cast envia
     * uma URL para o dispositivo tocar sozinho; o espelhamento manda a imagem
     * da tela, que é o que este app precisa quando não há Presentation. A ação
     * pública `Settings.ACTION_CAST_SETTINGS` cai no **Google Cast** em vários
     * aparelhos (foi o que aconteceu na Samsung testada) — por isso ela é o
     * último recurso, não o primeiro.
     *
     * Não existe API pública para o *popup* das configurações rápidas: o
     * `Settings.Panel` só cobre internet, wifi, nfc e volume. O que dá para
     * fazer é procurar, entre alvos conhecidos, o primeiro que **existe neste
     * aparelho e não é o Google Cast** — daí a ordem abaixo e o filtro por
     * pacote resolvido. As entradas da Samsung não são API documentada; se o
     * aparelho não as tiver, `resolveActivity` devolve null e a cadeia segue.
     *
     * `resolveActivity` só enxerga esses alvos por causa do bloco `<queries>`
     * no AndroidManifest (visibilidade de pacotes do Android 11+).
     */
    override fun openCastPicker() {
        runOnUiThread {
            val chosen = pickCastIntent()
            if (chosen != null) {
                try {
                    startActivity(chosen.first.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    return@runOnUiThread
                } catch (e: Exception) {
                    Log.w(TAG, "espelhamento recusou abrir: ${chosen.second}", e)
                }
            }
            // Nada de espelhamento neste aparelho: melhor abrir o seletor de
            // Cast (ou as Configurações) do que o botão não fazer nada.
            // Sem nenhum alvo de espelhamento: a tela de Tela vem ANTES da de
            // Cast — abrir o Google Cast é justamente o que não se quer aqui.
            for (action in listOf(Settings.ACTION_DISPLAY_SETTINGS, Settings.ACTION_CAST_SETTINGS, Settings.ACTION_SETTINGS)) {
                try {
                    startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    return@runOnUiThread
                } catch (e: Exception) {
                    Log.w(TAG, "seletor indisponível: $action", e)
                }
            }
        }
    }

    /**
     * Para onde o botão de cast vai abrir, em texto — mostrado no popup de
     * Exibição. Como os alvos de espelhamento variam por fabricante e não são
     * API documentada, o operador (e quem for depurar) precisa poder VER o que
     * o aparelho ofereceu, em vez de descobrir só ao tocar.
     */
    override fun describeCastTarget(): String {
        val chosen = pickCastIntent() ?: return "Google Cast (sem espelhamento neste aparelho)"
        return chosen.second
    }

    /**
     * Primeiro alvo de espelhamento que existe neste aparelho e **não é** o
     * Google Cast. Devolve o intent e um rótulo legível, ou null.
     */
    private fun shortComponent(pkg: String, cls: String): String =
        if (cls.startsWith("$pkg.")) pkg + "/" + cls.removePrefix(pkg) else "$pkg/$cls"

    private fun pickCastIntent(): Pair<Intent, String>? {
        for (intent in castCandidates()) {
            val target = packageManager.resolveActivity(intent, 0)?.activityInfo ?: continue
            // O alvo do Google Cast mora no Play Services. Pular aqui é o que
            // impede a cadeia de "resolver" num seletor de Cast quando ainda há
            // um de espelhamento a tentar depois.
            if (target.packageName == GMS_PACKAGE) continue
            // O componente entra no rótulo de propósito: os alvos variam por
            // fabricante e não são documentados, então quando o botão abre a
            // tela errada essa string é o que permite saber qual candidato
            // pegou, sem depender de logcat.
            return intent to (castLabel(target.packageName) + " (" + shortComponent(target.packageName, target.name) + ")")
        }
        return null
    }

    private fun castLabel(pkg: String): String = when {
        pkg.startsWith("com.samsung.android.smartmirroring") -> "Smart View"
        pkg.startsWith("com.samsung") -> "Espelhamento (Samsung)"
        pkg.startsWith("com.android.settings") -> "Espelhamento (Configurações)"
        else -> pkg
    }

    /**
     * Alvos de espelhamento, do mais específico ao mais genérico.
     *
     * Para o Smart View da Samsung o nome da activity **não é adivinhado**: o
     * `PackageManager` é consultado sobre quais activities o pacote expõe
     * (`GET_ACTIVITIES`) e as exportadas entram na fila. Adivinhar o nome era
     * frágil — um palpite errado simplesmente não resolvia, a cadeia caía no
     * fallback e o botão abria o Google Cast, que é o oposto do pedido.
     *
     * Os nomes de pacote e as ações abaixo não são API documentada; nada aqui
     * quebra se não existirem (resolveActivity devolve null / startActivity
     * lança, e a cadeia segue).
     */
    private fun castCandidates(): List<Intent> {
        val out = mutableListOf<Intent>()
        for (pkg in SAMSUNG_MIRROR_PACKAGES) {
            for (cls in exportedActivities(pkg)) {
                out.add(Intent().setClassName(pkg, cls))
            }
        }
        out.add(Intent("com.samsung.wfd.LAUNCH_WFD_PICKER"))
        // AOSP: a tela de "Wireless display / Transmitir tela". Ação legada,
        // ainda declarada pelo app de Configurações em muitos aparelhos — e a
        // que NÃO é reivindicada pelo Play Services (ao contrário de
        // CAST_SETTINGS, que na Samsung testada abre o Google Cast).
        out.add(Intent("android.settings.WIFI_DISPLAY_SETTINGS"))
        return out
    }

    /** Activities EXPORTADAS de um pacote, ou vazio se ele não existir. */
    private fun exportedActivities(pkg: String): List<String> = try {
        @Suppress("DEPRECATION")
        packageManager.getPackageInfo(pkg, PackageManager.GET_ACTIVITIES)
            .activities.orEmpty()
            .filter { it.exported }
            .map { it.name }
    } catch (_: Exception) {
        emptyList()
    }

    override fun setCaptureVolumeKeys(on: Boolean) {
        runOnUiThread { captureVolumeKeys = on }
    }

    override fun adjustSystemVolume(step: Int) {
        runOnUiThread {
            val am = getSystemService(AudioManager::class.java) ?: return@runOnUiThread
            val dir = if (step > 0) AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER
            // FLAG_SHOW_UI: aqui a mudança é do SISTEMA, não do app — o
            // operador precisa ver que saiu do fader e entrou no volume geral.
            am.adjustStreamVolume(AudioManager.STREAM_MUSIC, dir, AudioManager.FLAG_SHOW_UI)
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
        private const val GMS_PACKAGE = "com.google.android.gms"
        /** Pacotes do Smart View conhecidos (varia por versão do One UI). */
        private val SAMSUNG_MIRROR_PACKAGES = listOf(
            "com.samsung.android.smartmirroring",
            "com.samsung.android.app.smartmirroring",
        )
    }
}
