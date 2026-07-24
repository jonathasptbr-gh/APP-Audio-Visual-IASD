package br.org.iasd.av

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
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

    const val ORIGIN = "https://appassets.androidplatform.net"
    const val URL_CONTROLE = "$ORIGIN/web/controle/index.html"
    const val URL_DISPLAY = "$ORIGIN/web/display/index.html"

    /**
     * Loader compartilhado pelos dois WebViews.
     *
     * Ordem dos handlers importa: `/saf/` é avaliado ANTES de `/`, senão o
     * handler de assets (registrado na raiz) engoliria as requisições de
     * arquivos do dispositivo.
     */
    fun assetLoader(ctx: Context): WebViewAssetLoader =
        WebViewAssetLoader.Builder()
            .addPathHandler("/saf/", SafPathHandler(ctx.applicationContext))
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(ctx.applicationContext))
            .build()

    @SuppressLint("SetJavaScriptEnabled")
    fun create(ctx: Context, loader: WebViewAssetLoader): WebView {
        val web = WebView(ctx)
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
                return !(url.toString().startsWith(ORIGIN))
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
