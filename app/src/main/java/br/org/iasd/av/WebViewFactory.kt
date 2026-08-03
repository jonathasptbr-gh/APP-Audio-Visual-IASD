package br.org.iasd.av

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/**
 * Criação e configuração dos dois WebViews (Controle e Display).
 *
 * INVARIANTES (não quebrar — são o que sustenta toda a arquitetura web):
 *
 *  1. Servir por `https://appassets.androidplatform.net/`, JAMAIS por `file://`.
 *     É o contexto seguro que faz OPFS e IndexedDB funcionarem.
 *  2. Um ÚNICO origin para os dois WebViews — é o que preserva IndexedDB,
 *     OPFS e BroadcastChannel compartilhados entre Controle e Display,
 *     exatamente como os dois PWAs compartilham no navegador.
 *  3. Um único processo/perfil de WebView. Nada de processo isolado.
 *  4. `mediaPlaybackRequiresUserGesture = false` — é o que aposenta o
 *     overlay "Ligar Sistema" e toda a recuperação de áudio bloqueado.
 */
object WebViewFactory {

    private const val TAG = "WebViewFactory"

    /**
     * Host do origin servido. Fica separado de [ORIGIN] porque toda checagem de
     * origem tem de comparar o HOST do `Uri`, nunca o prefixo da string da URL
     * — `appassets.androidplatform.net.evil.com` começa com o origin e não tem
     * nada a ver com ele.
     */
    const val ORIGIN_HOST = "appassets.androidplatform.net"
    const val ORIGIN = "https://$ORIGIN_HOST"
    const val URL_CONTROLE = "$ORIGIN/web/controle/index.html"
    const val URL_DISPLAY = "$ORIGIN/web/display/index.html"

    /**
     * Loader dos WebViews.
     *
     * Ordem dos handlers importa: `/saf/` é avaliado ANTES de `/`, senão o
     * handler da base web (registrado na raiz) engoliria as requisições de
     * arquivos do dispositivo.
     *
     * A base web vem do bundle OTA da sessão quando existe um, senão dos
     * assets do APK — nos dois casos pelo MESMO origin, então IndexedDB,
     * OPFS e a ponte nativa não notam diferença nenhuma.
     *
     * @param withSaf registra o handler `/saf/`. Só o **Controle** precisa
     *   dele: os dois consumidores de arquivo do dispositivo são `importShare`
     *   e `syncDeviceFolder`, e os dois copiam os bytes para o OPFS antes de
     *   qualquer coisa chegar ao telão — o Display nunca busca um `/saf/`.
     *   Deixá-lo fora do loader da `Presentation` é higiene: aquele WebView
     *   carrega script de terceiro por design (a IFrame Player API), e não há
     *   motivo para dar a ele um servidor de bytes de todas as pastas que o
     *   operador já concedeu.
     */
    fun assetLoader(ctx: Context, withSaf: Boolean = true): WebViewAssetLoader =
        WebViewAssetLoader.Builder()
            .apply {
                if (withSaf) addPathHandler("/saf/", SafPathHandler(ctx.applicationContext))
            }
            .addPathHandler("/", WebPathHandler(ctx.applicationContext))
            .build()

    /**
     * @param onRendererGone chamado quando o processo do renderer morre. O
     *   WebView já foi desligado do barramento e destruído; cabe ao dono
     *   construir um novo no lugar. Sem callback, a página simplesmente some
     *   — mas o app continua vivo, que é o ponto.
     */
    @SuppressLint("SetJavaScriptEnabled")
    /**
     * WebView que NUNCA se declara oculto ao Chromium.
     *
     * O Chromium marca a página como `hidden` quando a janela da View some — e
     * é isso que acontece com o telão no instante em que o operador minimiza o
     * app. Um `<video>` local não liga para isso e continua tocando, mas o
     * **embed do YouTube pausa sozinho** ao ver `document.hidden`: é regra do
     * player deles, roda dentro de um iframe de outra origem e nenhum código
     * nosso alcança. O louvor parava no meio do culto.
     *
     * Reportar sempre `VISIBLE` tira o gatilho: a página do telão nunca fica
     * oculta, então nada tem por que se pausar. Vale SÓ para o WebView da
     * [StagePresentation] — ele é a projeção, e a projeção continua no ar com o
     * app minimizado de propósito (é para isso que existe o [SessionService]).
     * O WebView do Controle segue o ciclo normal: ali ser estrangulado em
     * segundo plano é o comportamento correto, e é justamente o que o
     * `snoopDisplayStatus` da ponte existe para contornar.
     *
     * O efeito colateral é o desejado e já era verdade: o renderer do telão não
     * é desacelerado quando o app sai da frente.
     */
    private class KeepVisibleWebView(ctx: Context) : WebView(ctx) {
        override fun onWindowVisibilityChanged(visibility: Int) {
            super.onWindowVisibilityChanged(View.VISIBLE)
        }

        /**
         * A visibilidade que o Chromium calcula tem DOIS componentes — a da
         * janela e a da View —, e mentir só sobre o primeiro deixava o segundo
         * derrubar a página do mesmo jeito. Foi por isso que a v1.26 não
         * resolveu nada: a metade que faltava é esta.
         */
        override fun onVisibilityChanged(changedView: View, visibility: Int) {
            super.onVisibilityChanged(changedView, View.VISIBLE)
        }
    }

    /**
     * @param keepVisible ver [KeepVisibleWebView] — só o telão usa.
     */
    fun create(
        ctx: Context,
        loader: WebViewAssetLoader,
        keepVisible: Boolean = false,
        onRendererGone: (() -> Unit)? = null,
    ): WebView {
        val web = if (keepVisible) KeepVisibleWebView(ctx) else WebView(ctx)
        if (keepVisible) {
            // O renderer do telão NÃO pode ser rebaixado quando o app sai da
            // frente: `waivedWhenNotVisible = false` é literalmente "não abra
            // mão da prioridade só porque esta View não está visível", e é a
            // diferença entre um vídeo que continua e um que engasga ou morre
            // sob pressão de memória — com a `Presentation` ainda no ar na TV.
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        }
        web.setBackgroundColor(Color.BLACK)
        // O telão e a UI do operador nunca rolam a página inteira — o layout
        // web já é 100vh com áreas roláveis próprias.
        web.overScrollMode = WebView.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true

            // Autoplay com som liberado: no APK não existe a política de
            // gesto do navegador, então o Display toca sozinho ao receber
            // um comando — sem overlay de destrave.
            mediaPlaybackRequiresUserGesture = false

            // Os assets vêm todos pelo asset loader; acesso direto a
            // file:// e content:// fica desligado por segurança.
            allowFileAccess = false
            allowContentAccess = false

            useWideViewPort = true
            loadWithOverviewMode = false
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT

            // O embed do YouTube trata "; wv" (marca de WebView) de forma
            // mais restritiva que um Chrome comum. Remover o marcador mantém
            // o mesmo motor, mas evita degradações do player.
            userAgentString = userAgentString.replace("; wv", "")
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? = loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val url = request.url
                // Navegação dentro do app (os dois "PWAs" e seus assets)
                // segue no WebView; qualquer outra coisa é link externo e
                // não deve sequestrar a tela de projeção.
                //
                // A comparação é por COMPONENTE do Uri, nunca por prefixo da
                // string: `https://appassets.androidplatform.net.evil.com/x`
                // começa com o origin, é um domínio que qualquer um registra, e
                // com um `startsWith` a navegação era autorizada — dentro de um
                // WebView que injeta `__AVBridge` em TODA página que carregar
                // (o `addJavascriptInterface` é por-WebView, não por-origem).
                // Este é o único ponto que impede conteúdo estranho de entrar
                // aqui, então ele não pode falhar ABERTO.
                return !(url.scheme == "https" && url.host == ORIGIN_HOST)
            }

            /**
             * A implementação padrão devolve `false` — e aí o framework MATA o
             * processo do app. Com dois WebViews no mesmo processo, `largeHeap`,
             * um vídeo grande no telão e um player do YouTube, uma morte do
             * renderer por OOM levaria junto o Controle na mão do operador e a
             * projeção na TV, no meio do culto.
             *
             * Devolver `true` diz ao framework que o app tratou a perda: o
             * WebView morto sai do barramento e é destruído, e o dono recria a
             * página — o mesmo caminho que a reconexão do dongle já usa.
             */
            override fun onRenderProcessGone(
                view: WebView,
                detail: RenderProcessGoneDetail,
            ): Boolean {
                Log.w(TAG, "renderer morreu (crash=${detail.didCrash()}) — recriando o WebView")
                MessageBus.detach(view)
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                onRendererGone?.invoke()
                return true
            }
        }

        return web
    }

    /** Resposta 404 curta, usada quando um recurso do dispositivo sumiu. */
    fun notFound(): WebResourceResponse = WebResourceResponse(
        "text/plain",
        "utf-8",
        404,
        "Not Found",
        emptyMap(),
        ByteArrayInputStream(ByteArray(0)),
    )
}
