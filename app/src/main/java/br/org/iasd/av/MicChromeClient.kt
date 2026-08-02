package br.org.iasd.av

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient

/**
 * Concede ao WebView o uso do microfone — e **só** o microfone.
 *
 * Um WebView nega `getUserMedia` em silêncio se ninguém tratar
 * `onPermissionRequest`: a promise é rejeitada e não há erro no console que
 * explique o motivo. É o mesmo padrão do `onShowFileChooser` (ver os
 * invariantes do shell): no navegador quem pergunta é a plataforma, aqui é o
 * app que precisa responder.
 *
 * Três regras:
 *
 * - **Só áudio.** Qualquer outro recurso pedido (câmera, MIDI, proteção de
 *   conteúdo) é negado. O sistema de projeção não tem nenhum uso para eles, e
 *   conceder "tudo que for pedido" transformaria um bug na base web num
 *   problema de privacidade.
 * - **Só se o APP já tiver a permissão do Android.** Sem `RECORD_AUDIO`
 *   concedido em runtime, `grant()` daria ao WebView uma permissão que o
 *   processo não tem — a captura falharia de qualquer forma, e mais adiante,
 *   sem sinal claro. Negar aqui devolve o erro na hora, e o lado web sabe
 *   pedir a permissão antes (`AVNative.requestMic()`).
 * - **Só da própria origem.** Defesa em profundidade: este client é do WebView
 *   do TELÃO, que carrega conteúdo de terceiro por design (o embed do
 *   YouTube), e o `grant()` é silencioso — não há prompt, não há sinal na tela.
 *   Hoje nenhum caminho conhecido exercita isso (o iframe do YouTube é barrado
 *   pela Permissions Policy, e um script no documento de topo passaria por esta
 *   checagem de qualquer jeito), mas a permissão que o operador concedeu para
 *   falar no telão não pode valer para qualquer página que aquele WebView
 *   venha a renderizar. Uma origem AUSENTE não é negada: nunca foi observada
 *   aqui, e recusar por causa de um campo vazio tiraria o push-to-talk sem
 *   nenhum ganho conhecido.
 */
class MicChromeClient(private val ctx: Context) : WebChromeClient() {

    override fun onPermissionRequest(request: PermissionRequest) {
        val origem = request.origin?.toString()?.trimEnd('/')
        val wanted = request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE }
        if (wanted.isEmpty() || !hasRecordAudio(ctx) ||
            (origem != null && origem != WebViewFactory.ORIGIN)
        ) {
            Log.w(
                TAG,
                "permissão de mídia negada ao WebView ($origem): ${request.resources.joinToString()}",
            )
            request.deny()
            return
        }
        request.grant(wanted.toTypedArray())
    }

    companion object {
        private const val TAG = "AvIasd"

        fun hasRecordAudio(ctx: Context): Boolean =
            ctx.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
    }
}
