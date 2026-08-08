package br.org.iasd.av

import android.content.Context
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.SystemClock
import android.util.Log
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream

/**
 * O anel de diagnóstico do espelho de pixels — e ele **devolve DADO, nunca
 * frase**.
 *
 * ## O invariante único deste arquivo
 *
 * **O Kotlin entrega JSON; quem monta a frase é o `controle.js`.** É o que o
 * resto do projeto já faz (`otaDiag`, `ytDiag` — os dois nasceram string e são
 * exceção histórica, não modelo), é o que respeita a invariante 5 do
 * `CLAUDE.md` ("não reimplementar em Kotlin nada que já exista em JS") e é o
 * que torna a sanitização de texto vindo da rede auditável **num ponto só**.
 * Um `EspelhoDiag` que formata parágrafos é UI de diagnóstico escrita em
 * Kotlin, e este projeto faz o contrário.
 *
 * Corolário prático: a linha "ritmo" do Registro (§7.5 da especificação) NÃO é
 * decidida aqui. Este arquivo entrega `kbps` e `fps` medidos; quem os cruza com
 * a cena — "tem vídeo tocando?", "a cortina está aberta?" — é o `controle.js`,
 * que é o único lado que sabe o que é uma cena. O Kotlin não pode opinar sobre
 * conteúdo, e um alarme falso disparado durante uma oração com a cortina
 * fechada iria parar num Registro **com botão de copiar**, para ser repassado.
 * Diagnóstico que mente é pior que diagnóstico nenhum.
 *
 * ## Por que um anel, e por que com carimbo de relógio de parede
 *
 * O espelho pode ficar horas no ar; guardar tudo seria vazamento de memória
 * lento num processo que também hospeda dois WebViews e a projeção. [TETO_LINHAS]
 * cobre com folga a janela que interessa (ligar → parear → falhar), e o que sai
 * é o mais velho.
 *
 * Cada linha carrega `em` = `System.currentTimeMillis()` porque o Registro
 * mostra hora de parede ("última desconexão: tela C · 12:41"), e `System
 * .currentTimeMillis` é a única fonte disso. As MEDIÇÕES de intervalo, ao
 * contrário, usam [SystemClock.elapsedRealtime] — que não anda para trás quando
 * o relógio do aparelho é ajustado, e é a mesma disciplina já escrita no
 * `WebUpdater`.
 *
 * ## Thread-safety não é opcional aqui
 *
 * As escritas chegam de pelo menos três threads diferentes: a main (ciclo de
 * vida da tela virtual), a thread de dreno do `MediaCodec` (as amostras, a
 * ~30 Hz) e, a partir do P5, uma thread por cliente do servidor. A leitura
 * (`paraJson`) chega de uma quarta: a thread do WebView que atende
 * `@JavascriptInterface`. Um `ArrayDeque` sem lock aqui daria
 * `ConcurrentModificationException` dentro da ponte — isto é, um diagnóstico
 * que quebra justamente quando alguém foi olhá-lo.
 */
class EspelhoDiag {

    private val trava = Any()

    /** Anel de linhas. Ver o KDoc da classe: o mais velho sai. */
    private val linhas = ArrayDeque<Linha>()

    /**
     * Fatos estruturados (tela virtual, readback, encoder, térmica…), por
     * chave. `LinkedHashMap` para a ordem de inserção sobreviver ao JSON — ela
     * não muda o significado de nada, mas mantém o objeto legível quando
     * alguém abre o Registro copiado num editor.
     */
    private val fatos = LinkedHashMap<String, Any?>()

    // ---------- o ritmo (bytes e quadros por segundo, janela deslizante) ----------

    private val bytesPorSeg = LongArray(JANELA_S)
    private val quadrosPorSeg = IntArray(JANELA_S)
    private var segundoAtual = -1L

    private data class Linha(val em: Long, val txt: String)

    /**
     * Registra uma linha do diário do espelho.
     *
     * [linha] é **saneada aqui também**, e isso é defesa em profundidade, não
     * duplicação: o texto que vem da rede (o `ua` de um cliente, por exemplo) já
     * é saneado no `EspelhoPares` antes de chegar perto daqui, mas um `\n` que
     * escapasse injetaria **linhas falsas** num artefato que o projeto manda
     * copiar e repassar (`copiarTexto`, no `controle.js`). O custo de sanear
     * duas vezes é um laço sobre 240 caracteres; o custo de não sanear é um
     * Registro forjado.
     */
    fun registrar(linha: String) {
        val txt = sanear(linha)
        if (txt.isEmpty()) return
        synchronized(trava) {
            linhas.addLast(Linha(System.currentTimeMillis(), txt))
            while (linhas.size > TETO_LINHAS) linhas.removeFirst()
        }
    }

    /**
     * Uma amostra de saída: [bytes] entregues e [quadros] produzidos.
     *
     * Chamada uma vez por quadro que sai do encoder (ou do compressor JPEG, no
     * modo imagem). Os dois números alimentam a MESMA janela porque a pergunta
     * do §7.5 é uma só — "isto aqui está se movendo?" — e ela precisa dos dois:
     * um retângulo preto produz quadros minúsculos **e** raros, e cada número
     * sozinho tem uma explicação inocente (cena parada; faixa grande).
     *
     * `quadros = 0` é legítimo e é o caso do quadro de `csd`: ele gasta bytes e
     * não é imagem nenhuma.
     */
    fun amostra(bytes: Int, quadros: Int) {
        synchronized(trava) {
            val s = SystemClock.elapsedRealtime() / 1000L
            avancar(s)
            val i = (s % JANELA_S).toInt()
            bytesPorSeg[i] += bytes.toLong()
            quadrosPorSeg[i] += quadros
        }
    }

    /**
     * Publica um fato estruturado. `null` apaga a chave — é assim que o
     * `desligar()` faz o readback e a tela virtual sumirem do Registro em vez de
     * ficarem lá descrevendo um estado que não existe mais.
     *
     * Não está no esboço da especificação porque lá o §3.8 lista só as três
     * operações; sem esta, cada campo do §7.6 (`tela virtual: … @ … dpi`,
     * `readback: …`, `encoder: …`) teria de virar texto pré-formatado — que é
     * exatamente o que o invariante deste arquivo proíbe.
     *
     * [valor] tem de ser algo que o `JSONObject` saiba serializar: `String`,
     * `Int`, `Long`, `Double`, `Boolean`, `JSONObject` ou `JSONArray`. Um objeto
     * qualquer viraria `toString()` silenciosamente, que é a forma de falhar
     * preferida deste projeto — daí o filtro explícito.
     */
    fun fato(chave: String, valor: Any?) {
        synchronized(trava) {
            if (valor == null) {
                fatos.remove(chave)
            } else {
                fatos[chave] = when (valor) {
                    is String -> sanear(valor)
                    is Int, is Long, is Double, is Float, is Boolean,
                    is JSONObject, is JSONArray -> valor
                    // Nunca `toString()` calado: um tipo inesperado aqui é um
                    // erro de quem chamou, e ele precisa aparecer no Registro.
                    else -> "?" + valor.javaClass.simpleName
                }
            }
        }
    }

    /**
     * O JSON inteiro, pronto para o `espelhoDiag()` da ponte devolver.
     *
     * Formato:
     * ```json
     * { "linhas": [ {"em": 1765..., "txt": "…"} ],
     *   "ritmo":  { "kbps": 340, "fps": 1.2, "janelaMs": 10000 },
     *   "…fatos": … }
     * ```
     * Os fatos entram na RAIZ, não num objeto aninhado: o consumidor é uma
     * função de montagem de texto no `controle.js`, e um nível a menos de
     * indireção ali é uma linha a menos que pode errar o caminho em silêncio.
     * As duas chaves reservadas são `linhas` e `ritmo` — um `fato("ritmo", …)`
     * seria sobrescrito, e por isso o nome está dito aqui.
     */
    fun paraJson(): JSONObject = synchronized(trava) {
        val o = JSONObject()
        val arr = JSONArray()
        for (l in linhas) arr.put(JSONObject().put("em", l.em).put("txt", l.txt))
        o.put("linhas", arr)

        avancar(SystemClock.elapsedRealtime() / 1000L)
        var bytes = 0L
        var quadros = 0
        for (i in 0 until JANELA_S) {
            bytes += bytesPorSeg[i]
            quadros += quadrosPorSeg[i]
        }
        o.put(
            "ritmo",
            JSONObject()
                // kbps é *quilo*bit por segundo decimal (1000), como todo
                // número de rede — não KiB. A conta é bytes×8÷1000÷janela.
                .put("kbps", Math.round(bytes * 8.0 / 1000.0 / JANELA_S).toInt())
                .put("fps", Math.round(quadros * 10.0 / JANELA_S) / 10.0)
                .put("janelaMs", JANELA_S * 1000),
        )

        for ((k, v) in fatos) o.put(k, v)
        // Última EXPRESSÃO do bloco, e não `return o`: `synchronized` é inline,
        // então um `return` aqui seria um retorno não-local de uma função de
        // corpo-expressão — que o compilador recusa.
        o
    }

    /**
     * Move a janela para o segundo [s], zerando os baldes que ficaram para
     * trás.
     *
     * Sem esta limpeza a janela nunca esvaziaria: um espelho que parou de
     * produzir há dez minutos continuaria exibindo o bitrate do último segundo
     * em que produziu, **para sempre** — e é justamente o estado que a linha
     * "ritmo" existe para denunciar (a `MirrorPresentation` morta com o encoder
     * vivo). Um detector que mostra o passado como se fosse o presente é pior
     * que nenhum.
     */
    private fun avancar(s: Long) {
        if (segundoAtual < 0L) {
            segundoAtual = s
            return
        }
        if (s <= segundoAtual) return
        val passos = minOf(s - segundoAtual, JANELA_S.toLong()).toInt()
        for (k in 1..passos) {
            val i = ((segundoAtual + k) % JANELA_S).toInt()
            bytesPorSeg[i] = 0L
            quadrosPorSeg[i] = 0
        }
        segundoAtual = s
    }

    private fun sanear(s: String): String {
        val sb = StringBuilder()
        for (ch in s) {
            if (sb.length >= TETO_TEXTO) break
            val c = ch.code
            sb.append(if (c < 0x20 || c == 0x7F) ' ' else ch)
        }
        return sb.toString().trim()
    }

    companion object {
        /** Linhas guardadas. Ver o KDoc da classe. */
        private const val TETO_LINHAS = 60

        /** Corte duro de cada linha e de cada fato de texto. */
        private const val TETO_TEXTO = 240

        /**
         * 10 s de janela. É o mesmo horizonte que a especificação usa na linha
         * "ritmo", e ele é curto o bastante para o operador ver o número reagir
         * enquanto olha, e longo o bastante para uma cena parada (um quadro por
         * segundo, por causa do batimento) render mais de uma amostra.
         */
        private const val JANELA_S = 10
    }
}
