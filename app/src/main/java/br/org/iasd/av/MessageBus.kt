package br.org.iasd.av

import android.webkit.WebView
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Relay nativo do canal de comandos (`av-iasd`) entre os dois WebViews.
 *
 * Por que existe: `BroadcastChannel` entre dois WebViews same-origin no mesmo
 * processo **deve** funcionar, mas o isolamento de sites do WebView pode
 * surpreender — e uma falha aí derrubaria o sistema inteiro (o Controle
 * deixaria de comandar o telão) no meio de um culto.
 *
 * Em vez de detectar a falha (o que exigiria um handshake e teria janela de
 * corrida), o relay roda **sempre, em paralelo** ao BroadcastChannel: cada
 * comando sai pelos dois caminhos e o lado web descarta a cópia repetida
 * (dedupe por `__mid` em `shared/db.js`). Assim o sistema funciona
 * identicamente com ou sem BroadcastChannel, sem nenhuma detecção.
 *
 * O custo é desprezível: os comandos são objetos JSON pequenos, e o mais
 * frequente (`display-status`) já roda a 2 Hz.
 */
object MessageBus {

    private val clients = CopyOnWriteArrayList<WebView>()

    fun attach(web: WebView) {
        // `addIfAbsent` é atômico; o par `contains`+`add` tinha uma janela de
        // duplicata entre a pergunta e a resposta.
        clients.addIfAbsent(web)
    }

    fun detach(web: WebView) {
        clients.remove(web)
    }

    /**
     * Entrega [json] a todos os WebViews registrados, menos quem enviou.
     *
     * `evaluateJavascript` exige a thread da UI de cada WebView — daí o
     * `post` em cada cliente (a Presentation vive na mesma thread principal,
     * mas o `post` também garante ordem estável na fila de mensagens).
     */
    fun post(from: WebView?, json: String) {
        if (clients.isEmpty()) return
        val literal = JSONObject.quote(json)
        val js = "window.__avBusDeliver && window.__avBusDeliver($literal);"
        for (client in clients) {
            if (client === from) continue
            client.post { client.evaluateJavascript(js, null) }
        }
    }
}
