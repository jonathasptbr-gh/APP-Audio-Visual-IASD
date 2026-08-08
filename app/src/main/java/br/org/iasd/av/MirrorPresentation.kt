package br.org.iasd.av

import android.app.Presentation
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.Display
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout

/**
 * O ESPELHO — uma segunda `Presentation`, na tela virtual privada que este app
 * cria para si (ver [EspelhoDisplay]). Ela desenha o MESMO `/web/display/` que
 * a TV desenha, e o framebuffer dela é o que vai para a rede.
 *
 * É **cópia do molde** ([StagePresentation]), e não uma parametrização dele. O
 * `StagePresentation` é o telão de verdade — o que a congregação vê —, e o
 * `CLAUDE.md` o lista entre as peças que o espelho não pode tocar: misturar os
 * dois faria uma mudança feita para o recurso auxiliar poder derrubar a
 * projeção. Duplicação assumida, com o motivo escrito.
 *
 * ## TRÊS PEÇAS COPIADAS DO MOLDE, e sem nenhuma delas o espelho morre ao
 * minimizar o app — que é o estado normal deste app no meio do culto
 *
 *  1. **`onStop()` NÃO DERRUBA NADA.** `Presentation` é um `Dialog`, e
 *     `Dialog.onStop()` chega quando o app sai da frente — não quando a tela
 *     acabou. Destruir o WebView aí apagava a projeção toda vez que o operador
 *     minimizava o app (a lição que a v1.28 documentou no molde).
 *  2. **[keepPlaying]**, chamado do `onStop` da Activity, desfaz a suspensão
 *     que o Chromium aplica quando o app sai da frente.
 *  3. **`keepVisible = true`** (`KeepVisibleWebView`): sem ele o renderer se
 *     declara `hidden`, e o **batimento de 1 Hz** — a peça que mantém a tela
 *     virtual produzindo quadros numa cena parada — é a primeira coisa a ser
 *     estrangulada pelo orçamento de timers.
 *
 * ## O QUE **NÃO** SE COPIA DO MOLDE, e cada omissão tem dono
 *
 *  - **`FLAG_KEEP_SCREEN_ON` fica de fora.** No `WindowManager` esse flag
 *    alimenta o *holding screen wake lock*, que é do **DISPOSITIVO**, não da
 *    tela em que a janela mora: copiá-lo manteria a tela do celular acesa por
 *    duas horas — um AMOLED de 6,8" é uma ordem de grandeza acima dos ~200 mW
 *    do núcleo do encoder. E ele **não é necessário**: um display virtual
 *    criado sem `VIRTUAL_DISPLAY_FLAG_PUBLIC` ganha `FLAG_NEVER_BLANK` no
 *    `VirtualDisplayAdapter`, e `DisplayManagerService.updateDisplayStateLocked`
 *    retorna sem fazer nada para displays com essa flag. O espelho continua
 *    produzindo quadros com o celular bloqueado, **por construção**.
 *  - **`MicChromeClient` fica de fora.** Instalá-lo daria DOIS `getUserMedia`
 *    no mesmo processo e dois `GainNode` no mesmo destino: realimentação
 *    pública, no meio de um culto. A ausência dele faz o WebView negar
 *    `getUserMedia` **em silêncio** — e é por isso que o `display.js` também
 *    precisa recusar `startMic` no papel espelho: a negativa silenciosa
 *    emitiria `mic-status:{on:false}` e apagaria, no Controle, o estado do
 *    microfone VERDADEIRO.
 *  - **O handler `/saf/` fica de fora** (`assetLoader(ctx, withSaf = false)`),
 *    pela mesma razão do telão: este documento nunca busca arquivo do
 *    dispositivo, e servir o índice das pastas concedidas a um WebView que
 *    hospeda script de terceiro seria dívida gratuita.
 *
 * ## E a linha que decide se isto é um espelho ou um comprometimento do aparelho
 *
 * A ponte nasce com **`host = null`**. Este documento hospeda a IFrame Player
 * API do YouTube **por design**; com `host != null`, qualquer script de
 * terceiro ali dentro ganharia `pickFolder`, `listFolder`, `pickDoc`,
 * `openExternal` — e, a partir do P5, também `espelhoLigar`. É a mesma decisão
 * que o `StagePresentation.buildWebView` já toma, agravada por haver agora dois
 * desses documentos no processo.
 *
 * O papel é **`"espelho"`**, o terceiro valor de `__AV_ROLE__`. Ele é seguro por
 * construção: as duas leituras existentes no bundle comparam `!== 'controle'`,
 * e **nenhum caminho testa `=== 'display'`** — então o papel novo herda
 * exatamente as guardas do telão sem precisar de nenhuma edição defensiva.
 *
 * @param url o que este documento carrega. O padrão é o telão
 *   (`/web/display/index.html`); a sonda de readback ([EspelhoDisplay.sonda])
 *   passa `/web/espelho/sonda.html`, e **só o telão entra no barramento** — uma
 *   página de instrumento não pode receber comandos de cena nem responder
 *   `display-ready`, sob pena de o Controle achar que há um segundo telão.
 */
class MirrorPresentation(
    outerContext: Context,
    display: Display,
    private val url: String = WebViewFactory.URL_DISPLAY,
) : Presentation(outerContext, display, R.style.Theme_AvIasd_Presentation) {

    var web: WebView? = null
        private set

    /** Depois de [release] nada mais é remontado (ex.: renderer morto no fim). */
    private var released = false

    /** Só o documento do telão participa do barramento. Ver o `@param url`. */
    private val noBarramento = url == WebViewFactory.URL_DISPLAY

    // `systemUiVisibility` está depreciado desde a API 30. A supressão é da
    // FUNÇÃO, e não da linha: anotar um `statement` de atribuição é território
    // cinzento do compilador, e este arquivo não pode depender disso.
    @Suppress("DEPRECATION")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fundo preto e SEM `FLAG_KEEP_SCREEN_ON` — ver o KDoc da classe.
        window?.setBackgroundDrawableResource(android.R.color.black)

        val root = FrameLayout(context)
        root.setBackgroundColor(Color.BLACK)
        root.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )

        // Nenhuma barra do sistema entra no framebuffer que vai para a rede.
        // (É o que o molde usa; trocar por `WindowInsetsController` só neste
        // arquivo faria as duas telas de projeção divergirem sem ninguém
        // decidir isso.)
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
     * Monta (ou remonta) o WebView do espelho dentro de [root].
     *
     * A remontagem por morte de renderer é o mesmo caminho do telão, e ela se
     * conserta sozinha: recarregar `/display/` dispara `display-ready`, e o
     * Controle reenvia a cena. É por causa **disto** que o dreno do barramento
     * no papel espelho é uma lista de permissão de UM item em vez de um dreno
     * total: drenado por inteiro, um espelho remontado ficaria no wallpaper até
     * alguém tocar em alguma coisa.
     */
    private fun buildWebView(root: FrameLayout) {
        if (released) return
        val loader = WebViewFactory.assetLoader(context, withSaf = false)
        val w = WebViewFactory.create(context, loader, keepVisible = true) {
            web = null
            root.post { buildWebView(root) }
        }
        // SEM `MicChromeClient` — ver o KDoc da classe. E sem qualquer outro
        // `WebChromeClient`: um segundo client criado aqui perderia em silêncio
        // as invariantes 6 e 7 (que moram no client do Controle), e nenhuma das
        // duas tem sentido numa tela sem operador.

        // O espelho não recebe toque nenhum. Ele nem tem por onde: a tela
        // virtual não tem fonte de entrada. A linha fica pelo mesmo motivo do
        // telão — o que projeta nunca é comandado por engano.
        w.isFocusable = false
        w.isFocusableInTouchMode = false

        val bridge = NativeBridge(
            ctx = context.applicationContext,
            role = "espelho",
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
        if (noBarramento) MessageBus.attach(w)
        w.loadUrl(url)
    }

    /**
     * **NÃO derruba o WebView aqui** — ver a peça 1 do KDoc da classe.
     *
     * Quem derruba o espelho são os donos do ciclo de vida
     * ([EspelhoDisplay.desligar], a remontagem por `ERROR_RECLAIMED` e a morte
     * do renderer). `onStop` não é nenhum deles: ele chega quando o operador
     * minimiza o app, que é justamente quando o espelho precisa continuar.
     */
    override fun onStop() {
        super.onStop()
    }

    /**
     * Desfaz a suspensão que o Chromium aplica quando o app sai da frente.
     *
     * Mesma função do molde, e aqui ela protege algo a mais: além da mídia, o
     * **batimento de 1 Hz** do papel espelho. Um `setInterval` estrangulado
     * significa tela virtual sem composição, encoder sem entrada e clientes
     * congelados no último quadro — sem erro em lugar nenhum.
     */
    fun keepPlaying() {
        val w = web ?: return
        try {
            w.onResume()
            w.resumeTimers()
        } catch (_: Exception) { /* WebView já destruído */ }
    }

    /**
     * Avalia [js] neste documento e devolve o resultado (JSON, como o
     * `evaluateJavascript` sempre devolve; `"null"` quando não há valor).
     *
     * **Só diagnóstico.** Nada de comando de cena por aqui: o caminho de
     * comando é o barramento, e um segundo canal para a mesma coisa seria uma
     * segunda regra para envelhecer. O `post` existe porque
     * `evaluateJavascript` exige a thread do WebView, e os chamadores prováveis
     * (a ponte, o serviço) estão noutra.
     */
    fun avaliar(js: String, cb: (String) -> Unit) {
        val w = web ?: run { cb(""); return }
        w.post {
            try {
                w.evaluateJavascript(js) { r -> cb(r ?: "") }
            } catch (_: Exception) {
                cb("")
            }
        }
    }

    /**
     * Derruba o WebView do espelho sem deixar o barramento com cliente morto.
     * Idempotente — na segunda chamada `web` já é `null`, e é por isso que o
     * `setOnDismissListener` do dono pode chamá-la sem conferir nada.
     */
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
