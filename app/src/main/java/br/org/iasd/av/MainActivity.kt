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

    /**
     * Share recebido por intent, aguardando o lado web consumir.
     *
     * `AtomicReference`, e não um campo comum: quem escreve é a main thread
     * (`onCreate`/`onNewIntent`), mas quem lê é [takePendingShare], chamado da
     * thread do WebView pela ponte — sem uma aresta de visibilidade a leitura
     * podia enxergar `null` (ou um objeto pela metade) por sorte de cache. O
     * `getAndSet(null)` do take também fecha, de graça, a janela de consumo
     * duplo entre duas chamadas concorrentes.
     */
    private val pendingShare =
        java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)

    /** Há download em curso? (evita start/stop repetido do serviço) */
    private var backgroundWork = false

    /**
     * Geração do estado de [backgroundWork]. Incrementada a cada mudança aceita
     * em [setBackgroundWork]; o hook do `SyncService.onGone` captura o valor no
     * momento do aviso e só zera o espelho se ninguém mudou o estado no meio —
     * sem isso, um `keepAlive(true)` novo que cruzasse com o `onTimeout` da
     * cota de FGS era apagado pelo runnable atrasado, e o download seguinte
     * ficava sem proteção, calado.
     */
    @Volatile
    private var backgroundWorkGen = 0

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

    /**
     * Permissão do microfone (push-to-talk). Pedida **sob demanda**, quando o
     * operador abre a função — e não na abertura do app: um pedido de gravar
     * áudio logo no primeiro lançamento, sem contexto, é o tipo de coisa que
     * as pessoas negam por reflexo, e aí o recurso fica quebrado sem motivo.
     */
    private var pendingMicPermission: ((Boolean) -> Unit)? = null
    private val micPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val cb = pendingMicPermission
        pendingMicPermission = null
        cb?.invoke(granted)
    }

    /** Callback do `AVNative.pickDoc()` em andamento. */
    private var pendingDocPick: ((List<Uri>) -> Unit)? = null

    /**
     * Seletor de ARQUIVOS do sistema — a importação inteira do app passa por
     * aqui (imagem, vídeo, áudio, PDF e PPTX), não só documentos.
     *
     * O `<input type="file">` da página não serve para isto: ele devolve ao
     * JavaScript um `File` — bytes já lidos —, e quem desenha o PDF é o shell,
     * que precisa do ARQUIVO. Mandar os bytes de volta pela ponte inverteria o
     * princípio dela ("URLs servíveis, nunca bytes") e faria uma apresentação
     * de dezenas de MB passar pela memória do WebView à toa.
     *
     * `OpenDocument` (SAF), e não `GetContent`: só ele devolve um `content://`
     * que o `contentResolver` deste processo consegue abrir depois, que é
     * exatamente o que o [SlideDeck] faz.
     */
    private val docPicker = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        val cb = pendingDocPick
        pendingDocPick = null
        cb?.invoke(uris ?: emptyList())
    }

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

        // SÓ na primeira criação. A única saída do app é `moveTaskToBack`, então
        // a Activity nunca é finalizada e `getIntent()` continua devolvendo o
        // mesmo ACTION_SEND para sempre: qualquer recriação (mudar o tamanho da
        // fonte ou o idioma — nenhum dos dois está em `android:configChanges` —,
        // ou voltar pelo Recentes depois de o processo ser morto) reparsearia o
        // MESMO compartilhamento e o lado web importaria uma segunda cópia
        // integral do arquivo, sem aviso e sem desfazer. `savedInstanceState`
        // não-nulo é exatamente "isto é uma recriação".
        if (savedInstanceState == null) {
            pendingShare.set(ShareIntake.parse(this, intent))
        }
        // E marca o intent como consumido, para o caso de o sistema recriar a
        // Activity SEM estado salvo: um ACTION_SEND que já foi lido nunca mais
        // pode ser lido de novo.
        consumeShareIntent()

        buildControleWebView()

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
        // uma projeção (ou AGORA, se o operador aceitar o aviso).
        //
        // E a procura não é mais UMA: a ronda periódica, a retomada do app e a
        // rede voltando também disparam (ver `WebUpdater.iniciarVigilancia`).
        // Com o app aberto o dia inteiro — que é o normal —, uma única busca no
        // `onCreate` significava que uma versão publicada depois da abertura
        // não existia para o aparelho.
        WebUpdater.checkAsync(this, "abertura")
        WebUpdater.iniciarVigilancia(this)

        // E O AVISO APARECE NA HORA. O lado web enquete de minuto em minuto,
        // mas esperar até um minuto por algo que o shell JÁ SABE é atraso à
        // toa: quando o bundle fica pronto, o shell empurra. Um bundle antigo
        // (sem `__avOta`) simplesmente não tem a função e o empurrão vira
        // no-op — a enquete continua sendo o piso.
        WebUpdater.aoChegar = { versao ->
            val js = "window.__avOta && window.__avOta(${JSONObject.quote(versao)});"
            runOnUiThread { web?.evaluateJavascript(js, null) }
        }

        // Notificação de controles / tela de bloqueio / botões de mídia: o
        // sistema entrega a ação aqui e ela vai para o MESMO caminho dos botões
        // da tela (`window.__avRemote` → os handlers já existentes). Nada de
        // transporte é decidido em Kotlin — ver [SessionRemote].
        SessionRemote.onAction = { action ->
            val js = "window.__avRemote && window.__avRemote(${JSONObject.quote(action)});"
            runOnUiThread { web?.evaluateJavascript(js, null) }
        }

        // O serviço de sincronização pode morrer sem que ninguém aqui peça
        // (cota de FGS do Android 15). Se `backgroundWork` continuasse `true`, o
        // `if (on == backgroundWork)` de [setBackgroundWork] trataria o próximo
        // `keepAlive(true)` como repetido e o download seguinte ficaria sem
        // proteção nenhuma — em silêncio, que é a pior forma de perder isso.
        //
        // O TOKEN DE GERAÇÃO fecha a corrida do outro lado: entre o aviso do
        // `onTimeout` e o runnable rodar, um `keepAlive(true)` novo pode ter
        // mudado o estado (e subido o serviço de novo) — zerar por cima dele
        // recriava exatamente o defeito que este hook existe para evitar. A
        // geração é capturada NO MOMENTO do aviso; se ela mudou até a execução,
        // o estado já é de outro download e o runnable não toca em nada.
        SyncService.onGone = {
            val gen = backgroundWorkGen
            runOnUiThread {
                if (gen == backgroundWorkGen) backgroundWork = false
            }
        }

        onBackPressedDispatcher.addCallback(this) { handleBack() }
    }

    /**
     * Neutraliza o ACTION_SEND já lido.
     *
     * O intent da Activity é reentregue em toda recriação; sem apagar a ação e
     * os extras, um compartilhamento consumido volta a ser encontrado e o
     * arquivo é importado de novo. `setIntent` mantém `getIntent()` coerente
     * com o objeto mutado, para nenhum outro caminho (por exemplo um
     * `onNewIntent` que reuse o mesmo Intent) reencontrar o conteúdo.
     */
    private fun consumeShareIntent() {
        val i = intent ?: return
        if (i.action != Intent.ACTION_SEND && i.action != Intent.ACTION_SEND_MULTIPLE) return
        i.action = Intent.ACTION_MAIN
        i.removeExtra(Intent.EXTRA_STREAM)
        i.removeExtra(Intent.EXTRA_TEXT)
        i.removeExtra(Intent.EXTRA_SUBJECT)
        setIntent(i)
    }

    /**
     * Botão VOLTAR do aparelho.
     *
     * Sair do app por engano durante o culto derrubaria a projeção, então o
     * voltar **nunca** encerra a Activity — no fim da fila ele apenas manda a
     * tarefa para segundo plano, com a sessão (e a `Presentation` na TV) viva.
     *
     * O que mudou na v5.32 é o que vem ANTES disso: quem sabe se há um popup,
     * uma pasta aberta ou a preview em tela cheia é o lado web, então a decisão
     * é dele (`window.__avBack`, em `controle.js`) — invariante 5, nenhuma
     * hierarquia de navegação reimplementada aqui. Kotlin só pergunta e obedece.
     *
     * **A resposta é assíncrona, e por isso há um prazo.** `evaluateJavascript`
     * devolve pelo callback; se o renderer morreu, está travado ou o bundle é
     * antigo demais para ter `__avBack`, esse callback pode simplesmente nunca
     * chegar — e um botão voltar que não faz NADA é pior que um que minimiza.
     * O `postDelayed` garante a resposta padrão.
     *
     * O que o `AtomicBoolean` garante, exatamente: que `moveTaskToBack` roda no
     * MÁXIMO uma vez por toque. Ele **não** garante que o app não minimize
     * depois de o web já ter fechado um popup — `__avBack()` executa a ação de
     * forma síncrona e só então retorna, então o que chega tarde é a RESPOSTA,
     * não a ação. Com o renderer ocupado (sincronização pesada, decodificação
     * de vídeo), o prazo pode vencer com o popup já fechado e o operador vê as
     * duas coisas num toque só. Fechar isso de verdade exige um token de
     * corrida devolvido pelo lado web (`__avBack(token)` → `__avResolve`), o
     * que é mudança de contrato da ponte; enquanto não existe, o prazo é curto
     * justamente para o caso comum nunca chegar perto dele.
     */
    private fun handleBack() {
        val w = web
        if (w == null) { moveTaskToBack(true); return }
        val resolvido = java.util.concurrent.atomic.AtomicBoolean(false)
        val minimizar = Runnable {
            if (resolvido.compareAndSet(false, true)) moveTaskToBack(true)
        }
        // Um bundle web anterior à v5.32 não define `__avBack`; o `try` devolve
        // false e o comportamento volta a ser o de sempre, sem erro no console.
        val js = "(function(){try{return !!(window.__avBack && window.__avBack());}" +
            "catch(e){return false;}})();"
        w.evaluateJavascript(js) { r ->
            if (r == "true") resolvido.set(true) else minimizar.run()
        }
        w.postDelayed(minimizar, BACK_JS_TIMEOUT_MS)
    }

    /**
     * Monta (ou remonta) o WebView do Controle. A remontagem acontece quando o
     * renderer morre: sem isso o framework mataria o processo inteiro, levando
     * junto a projeção na TV.
     */
    private fun buildControleWebView() {
        if (isFinishing || isDestroyed) return
        val loader = WebViewFactory.assetLoader(this)
        val w = WebViewFactory.create(this, loader) {
            web = null
            // O estado de "download em curso" pertencia ao documento que acabou
            // de morrer: os `fetch` morreram com o renderer e o `finally` de
            // `withBgWork()` nunca vai rodar, então NINGUÉM mais chamaria
            // `keepAlive(false)`. Sem zerar aqui, sobravam para sempre o
            // foreground service, a notificação congelada no último progresso e
            // o wake lock parcial (2 h) — e, pior, a guarda de
            // [setBackgroundWork] fazia o próximo download real virar no-op.
            // A página nova recomeça a contagem do zero e volta a pedir a
            // proteção se ainda houver trabalho.
            if (backgroundWork) {
                backgroundWork = false
                try { SyncService.stop(this@MainActivity) } catch (e: Exception) {
                    Log.w(TAG, "serviço de sincronização não parou", e)
                }
            }
            // MESMA classe de estado do documento morto: os dois foram ligados
            // pela página que acabou de morrer, e a nova pede de novo ao
            // carregar. `captureVolumeKeys` órfão é o pior dos dois — com a
            // página morta (ou a recarga falhando), a Activity seguia
            // consumindo as teclas e entregando o passo a um `__avVolumeKey`
            // que não existe: o aparelho ficava sem NENHUM controle de volume.
            // `audioAlive` órfão manteria o WebView novo com prioridade de
            // renderer que ninguém pediu.
            captureVolumeKeys = false
            audioAlive = false
            webContainer.post { buildControleWebView() }
        }
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
        w.loadUrl(WebViewFactory.URL_CONTROLE)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val share = ShareIntake.parse(this, intent)
        // Consumido assim que lido — inclusive quando o parse devolve null, para
        // um intent inútil não ficar pendurado como o intent da Activity.
        consumeShareIntent()
        if (share == null) return
        pendingShare.set(share)
        // App já aberto: empurra o share na hora, sem esperar um novo init.
        web?.evaluateJavascript("window.__avShareArrived && window.__avShareArrived();", null)
    }

    override fun onResume() {
        super.onResume()
        syncPresentation()
        // VOLTAR AO APP É UM GATILHO. É quando o operador agiria sobre o aviso,
        // e é quando a rede costuma estar de volta (ele saiu, trocou de Wi-Fi,
        // ligou os dados). Rajadas de `onResume` — alternar entre dois apps
        // dispara um por toque — são absorvidas pelo piso do `checkAsync`.
        WebUpdater.checkAsync(this, "retomada")
    }

    /**
     * O app saiu da frente — e é AQUI que a projeção precisa ser defendida.
     *
     * O Chromium suspende o WebView quando o app vai para segundo plano, e o
     * telão é a única coisa do app que não pode parar: ele está na TV, na
     * frente da congregação. `keepPlaying()` desfaz essa suspensão no instante
     * exato em que ela aconteceria.
     *
     * O WebView do CONTROLE não recebe o mesmo tratamento de propósito: ali ser
     * desacelerado em segundo plano é o comportamento certo (é o celular na mão
     * de alguém), e é justamente o que o `snoopDisplayStatus` da ponte existe
     * para contornar.
     */
    override fun onStop() {
        super.onStop()
        presentation?.keepPlaying()
        // Mesa de som ligada: o áudio sai DESTE WebView, e ele também precisa
        // atravessar o segundo plano. Sem isso o louvor calava no instante em
        // que o operador saía do app — que é justamente o caso relatado, e o
        // que as três tentativas anteriores não cobriam, porque protegiam o
        // WebView do telão.
        if (audioAlive) {
            val w = web ?: return
            try {
                w.onResume()
                w.resumeTimers()
            } catch (_: Exception) { /* WebView já destruído */ }
        }
    }

    /** A mesa de som está ligada? (ver [setAudioAlive]) */
    private var audioAlive = false

    override fun setAudioAlive(on: Boolean) {
        runOnUiThread {
            audioAlive = on
            val w = web as? WebViewFactory.KeepVisibleWebView ?: return@runOnUiThread
            w.manterVisivel = on
            // Com o celular fazendo o som, o renderer do Controle não pode ser
            // rebaixado quando a View sai de vista — é a mesma política do
            // telão, e pelo mesmo motivo.
            // `waivedWhenNotVisible = !on`: com a mesa de som ligada NÃO se abre
            // mão da prioridade por a View sair de vista; desligada, volta ao
            // padrão de um WebView comum.
            w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, !on)
        }
    }

    override fun onDestroy() {
        // O hook sai antes de tudo: ele captura esta Activity, e uma chamada
        // depois daqui mexeria num campo de uma tela que não existe mais.
        SyncService.onGone = null
        // Sem o WebView não há download para proteger — o serviço não pode
        // sobreviver à Activity segurando um wake lock à toa.
        if (backgroundWork) {
            backgroundWork = false
            try { SyncService.stop(this) } catch (e: Exception) {
                Log.w(TAG, "serviço de sincronização não parou", e)
            }
        }
        // Idem para a sessão: sem WebView não há quem execute a ação, e a
        // notificação de controles viraria um painel de botões mortos.
        SessionRemote.onAction = null
        // E o empurrão do OTA, pelo mesmo motivo dos dois acima: ele captura
        // esta Activity, e a ronda do `WebUpdater` sobrevive à tela.
        WebUpdater.aoChegar = null
        try { SessionService.stop(this) } catch (_: Exception) { }
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
            }
            // NOTIFICA MESMO SEM PRESENTATION A DERRUBAR, e é este o defeito do
            // "ícone de cast continua vermelho depois de desconectar".
            //
            // Quando o dongle cai por distância, o sistema derruba a janela
            // sozinho: o `setOnDismissListener` abaixo zera `presentation` sem
            // avisar ninguém. O `onDisplayRemoved` que vem em seguida encontrava
            // `current == null`, entrava neste ramo e SAÍA SEM NOTIFICAR — o lado
            // web ficava com a última lista que recebeu, que ainda tinha a TV, e
            // o ícone seguia aceso. A saída antecipada estava dentro do `if`
            // errado: a notificação é sobre a TELA, não sobre a janela.
            notifyDisplayChange()
            return
        }

        if (current != null) {
            if (current.display.displayId == target.displayId && current.isShowing) {
                // A mesma tela, a mesma janela: nada mudou para o app — mas o
                // `onDisplayChanged` também chega quando a RESOLUÇÃO muda, e é
                // ela que o rodapé de Configurações exibe. Notificar aqui é um
                // `evaluateJavascript` com uma leitura de lista do outro lado; o
                // lado web já deduplica pelo que desenha.
                notifyDisplayChange()
                return
            }
            current.release()
            current.dismiss()
            presentation = null
        }

        val p = StagePresentation(this, target)
        p.setOnDismissListener {
            // Dismiss ESPONTÂNEO (o sistema derrubou a janela sem passar pelos
            // caminhos daqui): só anular a referência deixava o WebView do
            // telão vivo no MessageBus — recebendo comandos e, com autoplay
            // liberado, podendo TOCAR áudio numa janela que ninguém vê. O
            // `release()` é idempotente (na segunda chamada `web` já é null),
            // então os caminhos que já liberam antes do dismiss não pagam nada.
            if (presentation === p) {
                presentation = null
                p.release()
                // E AVISA O LADO WEB. Este é o caminho da queda por distância —
                // o sistema derruba a janela antes (ou sem) qualquer
                // `onDisplayRemoved` —, e sem esta linha o Controle só descobria
                // a desconexão no próximo evento do DisplayManager, que pode não
                // vir. `listDisplays` é reconsultado do outro lado, então se a
                // tela ainda estiver lá nada muda na tela do operador.
                notifyDisplayChange()
            }
        }
        try {
            p.show()
            presentation = p
        } catch (e: Exception) {
            // A tela sumiu entre a consulta e o show() (dongle instável), ou o
            // WindowManager recusou o token. `show()` roda `onCreate` ANTES do
            // addView que lança: o WebView do telão já existe, já entrou no
            // MessageBus e já pediu a URL. Descartar só a referência deixaria
            // esse WebView vivo recebendo comandos e — com autoplay liberado —
            // TOCANDO áudio numa janela que ninguém vê. Liberar é obrigatório.
            Log.w(TAG, "tela de apresentação sumiu antes do show()", e)
            p.release()
            try { p.dismiss() } catch (_: Exception) { /* nunca chegou a exibir */ }
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
            // Um pedido anterior ainda em voo é RESOLVIDO como cancelado antes
            // de ser sobrescrito — o mesmo padrão do `onShowFileChooser`. Esta
            // Promise não tem prazo no lado web (espera uma pessoa), então um
            // callback atropelado era uma Promise pendurada para sempre.
            pendingFolderPick?.invoke(null)
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

    override fun requestDocPick(mimes: Array<String>, onResult: (List<Uri>) -> Unit) {
        runOnUiThread {
            // Mesmo padrão do [requestFolderPick]: o pendente resolve vazio
            // antes de ser sobrescrito, senão a Promise sem prazo do lado web
            // fica pendurada para sempre.
            pendingDocPick?.invoke(emptyList())
            pendingDocPick = onResult
            try {
                docPicker.launch(mimes)
            } catch (e: Exception) {
                Log.w(TAG, "seletor de documento indisponível", e)
                pendingDocPick = null
                onResult(emptyList())
            }
        }
    }

    override fun setBackgroundWork(on: Boolean) {
        runOnUiThread {
            if (on == backgroundWork) return@runOnUiThread
            backgroundWork = on
            // Toda mudança aceita vira uma geração nova — é contra ela que o
            // runnable atrasado do `SyncService.onGone` confere se ainda fala
            // do mesmo estado (ver o hook no onCreate).
            backgroundWorkGen++
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
     * pacote resolvido. As entradas da Samsung não são API documentada; elas só
     * são tentadas num aparelho Samsung (ver `castCandidates`/`isSamsung`), e
     * mesmo lá, se não existirem, `resolveActivity` devolve null e a cadeia
     * segue.
     *
     * `resolveActivity` só enxerga esses alvos por causa do bloco `<queries>`
     * no AndroidManifest (visibilidade de pacotes do Android 11+).
     */
    /**
     * Abre uma URL fora do app. Hoje o único chamador é o "Pesquisar … no
     * YouTube" do fim da busca do acervo: o acervo é o LouvorJA e não tem
     * tudo, e o caminho de volta para uma música que falta já existe (o
     * `intent-filter` de share). Faltava a ida.
     *
     * `ACTION_VIEW` sem escolher pacote: quem reivindica `youtube.com` no
     * aparelho abre — o app do YouTube, se instalado; o navegador, se não. O
     * esquema já foi restringido a `https` em [NativeBridge.openExternal].
     *
     * `FLAG_ACTIVITY_NEW_TASK` porque isto sai de uma thread do WebView por
     * um `post`, e o alvo tem de virar tarefa própria: o app de projeção
     * continua na dele, com a `Presentation` viva na TV.
     */
    override fun openExternalUrl(url: String) {
        runOnUiThread {
            try {
                startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            } catch (e: Exception) {
                // Aparelho sem nada que abra http(s) é improvável, mas um
                // `ActivityNotFoundException` aqui derrubaria o app inteiro.
                Log.w(TAG, "nada abriu a URL externa", e)
            }
        }
    }

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
        // O rótulo do fallback tem de dizer o que o TOQUE de fato abre: sem
        // alvo de espelhamento, [openCastPicker] tenta DISPLAY_SETTINGS antes
        // de CAST_SETTINGS — anunciar "Google Cast" aqui era descrever o
        // último recurso como se fosse o primeiro.
        val chosen = pickCastIntent()
            ?: return "Configurações de tela (sem espelhamento neste aparelho)"
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
     * Alvos de espelhamento, do mais específico ao mais genérico — e o ramo
     * específico é **por fabricante**: as entradas do Smart View só entram na
     * fila num aparelho Samsung (ver `isSamsung`); em qualquer outro a fila
     * começa direto no alvo AOSP.
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
        // MEMOIZADO POR PROCESSO: o conjunto de activities exportadas de
        // pacotes de sistema não muda enquanto o processo vive, e este método
        // roda a cada toque no botão de cast E a cada abertura de Configurações
        // (`describeCastTarget`) — sem o cache, cada uma pagava as consultas ao
        // PackageManager de novo, pelo mesmo resultado.
        castCandidatesCache?.let { return it }
        val out = mutableListOf<Intent>()
        // O ramo do Smart View só entra na fila NUM APARELHO SAMSUNG. Ele
        // nasceu do aparelho em que o app é operado (um S24 Ultra), e a cadeia
        // toda foi escrita em volta dele — mas "Smart View primeiro" é uma
        // regra de UM fabricante, não do Android. Noutra marca esses pacotes
        // simplesmente não existem, então a cadeia já caía no caminho universal
        // sozinha; o que a guarda acrescenta é dizer isso em vez de deixar por
        // acaso, e não varrer as activities de dois pacotes ausentes a cada
        // toque no botão (e a cada abertura de Configurações, que chama
        // `describeCastTarget`).
        //
        // E há um caso em que o acaso não bastava: um pacote de OUTRO
        // fabricante com o mesmo nome (ou uma ROM que carregue os apps da
        // Samsung) entraria na frente do alvo AOSP sem que nada aqui tivesse
        // decidido isso.
        if (isSamsung()) {
            for (pkg in SAMSUNG_MIRROR_PACKAGES) {
                for (cls in exportedActivities(pkg)) {
                    out.add(Intent().setClassName(pkg, cls))
                }
            }
            out.add(Intent("com.samsung.wfd.LAUNCH_WFD_PICKER"))
        }
        // O caminho UNIVERSAL, e o único em qualquer aparelho que não seja
        // Samsung. AOSP: a tela de "Wireless display / Transmitir tela". Ação
        // legada, ainda declarada pelo app de Configurações em muitos aparelhos
        // — e a que NÃO é reivindicada pelo Play Services (ao contrário de
        // CAST_SETTINGS, que na Samsung testada abre o Google Cast).
        out.add(Intent("android.settings.WIFI_DISPLAY_SETTINGS"))
        castCandidatesCache = out
        return out
    }

    /**
     * `MANUFACTURER` **ou** `BRAND`: os dois costumam dizer "samsung" num
     * aparelho de fábrica, mas uma ROM alternativa (ou um emulador) mexe num e
     * esquece o outro, e aqui errar para o lado do "não é Samsung" custaria o
     * Smart View no aparelho em que o app é de fato operado. Comparação sem
     * caixa porque o valor não é normalizado por contrato — chega "samsung" na
     * maioria e "Samsung" em alguns.
     */
    private fun isSamsung(): Boolean =
        Build.MANUFACTURER.equals(SAMSUNG_VENDOR, ignoreCase = true) ||
            Build.BRAND.equals(SAMSUNG_VENDOR, ignoreCase = true)

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

    /**
     * Aplica a base web nova AO VIVO e recarrega as duas páginas.
     *
     * A ORDEM importa. O `resolve` da ponte é entregue por `evaluateJavascript`
     * na página do Controle — a mesma que está prestes a ser recarregada —,
     * então a recarga vai para o fim da fila da UI: assim a Promise do lado web
     * chega a resolver antes de o documento morrer. Não é essencial (quem pediu
     * a atualização vai ver a tela recarregar de qualquer jeito), mas um
     * `otaApply()` que nunca resolve deixaria um `await` pendurado para sempre
     * num caminho de erro futuro.
     *
     * O TELÃO PRIMEIRO, pelo mesmo motivo pelo qual a reconexão do dongle
     * funciona: ele carrega, dispara `display-ready`, e o Controle — já
     * recarregado ou recarregando — reenvia a cena por `resendSceneToDisplay`.
     */
    override fun applyWebUpdate(onResult: (String?) -> Unit) {
        runOnUiThread {
            val versao = WebUpdater.applyNow(this)
            onResult(versao)
            if (versao == null) return@runOnUiThread
            webContainer.post {
                try { presentation?.recarregar() } catch (e: Exception) {
                    Log.w(TAG, "telão não recarregou na atualização", e)
                }
                web?.let {
                    // Ver `StagePresentation.recarregar`: sem limpar o cache, a
                    // página nova pode ser montada com pedaços da antiga.
                    it.clearCache(true)
                    it.loadUrl(WebViewFactory.URL_CONTROLE)
                }
            }
        }
    }

    override fun requestMicPermission(onResult: (Boolean) -> Unit) {
        runOnUiThread {
            if (MicChromeClient.hasRecordAudio(this)) { onResult(true); return@runOnUiThread }
            // Mesmo padrão do [requestFolderPick]: o pedido anterior resolve
            // negado antes de ser sobrescrito — Promise sem prazo do lado web.
            pendingMicPermission?.invoke(false)
            pendingMicPermission = onResult
            try {
                micPermission.launch(android.Manifest.permission.RECORD_AUDIO)
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível pedir a permissão de microfone", e)
                pendingMicPermission = null
                onResult(false)
            }
        }
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

    override fun takePendingShare(): JSONObject? = pendingShare.getAndSet(null)

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
        /**
         * Prazo para o lado web responder ao botão voltar (ver [handleBack]).
         * Curto de propósito: acima disso o toque começa a parecer ignorado, e
         * a resposta padrão (minimizar) é sempre segura. Um WebView vivo
         * responde em poucos milissegundos.
         */
        private const val BACK_JS_TIMEOUT_MS = 350L
        /** `Build.MANUFACTURER`/`Build.BRAND` de um aparelho Samsung. */
        private const val SAMSUNG_VENDOR = "samsung"
        /** Pacotes do Smart View conhecidos (varia por versão do One UI). */
        private val SAMSUNG_MIRROR_PACKAGES = listOf(
            "com.samsung.android.smartmirroring",
            "com.samsung.android.app.smartmirroring",
        )

        /**
         * Cache de [castCandidates] — no companion porque a informação é do
         * PROCESSO (activities de pacotes de sistema), não desta Activity: uma
         * recriação de tela não a muda. Os `Intent` cacheados são reusados com
         * `addFlags`, o que é inócuo — a flag é sempre a mesma.
         */
        @Volatile
        private var castCandidatesCache: List<Intent>? = null
    }
}
