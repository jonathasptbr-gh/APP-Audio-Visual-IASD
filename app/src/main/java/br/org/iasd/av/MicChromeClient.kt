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
 * Duas regras:
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
 */
class MicChromeClient(private val ctx: Context) : WebChromeClient() {

    override fun onPermissionRequest(request: PermissionRequest) {
        val wanted = request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE }
        if (wanted.isEmpty() || !hasRecordAudio(ctx)) {
            Log.w(TAG, "permissão de mídia negada ao WebView: ${request.resources.joinToString()}")
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
