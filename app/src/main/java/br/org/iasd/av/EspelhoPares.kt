package br.org.iasd.av

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * O controle de acesso do espelho de pixels: PIN, aprovação pelo operador,
 * tokens, prazo e limitação de taxa. **ZERO import de Android**, pelo mesmo
 * motivo do [EspelhoHttp] — este e aquele são as duas peças em que um erro não
 * vira pixel errado, e sim porta aberta, e são as duas que o JUnit cobre (ver a
 * QUARTA EXCEÇÃO declarada no `dependencies` de `app/build.gradle.kts`).
 *
 * O `EspelhoServidor` (P5) faz sockets e threads e **não decide nada que este
 * arquivo decida**: ele pergunta e obedece, exatamente como o
 * `MainActivity.handleBack()` pergunta ao `window.__avBack`.
 *
 * ## As nove invariantes
 *
 * 1. **Token de 128 bits em base64url, `SecureRandom`** — aleatório, não
 *    contador, opaco. É o mesmo desenho do `SafRegistry`
 *    (`SafPathHandler.kt`), e o mesmo motivo: um contador é adivinhável por
 *    construção. Vale igual para o `id` da espera, que também é um portador (quem
 *    o tem recebe o token quando o operador aprovar).
 * 2. **O token NUNCA viaja numa URL.** Nem em `?t=`, nem em fragmento, nem no QR.
 *    Ele vive no `sessionStorage` do cliente e sobe em `Authorization: Bearer` —
 *    e é por isso que [validar] recebe o cabeçalho CRU e faz ela mesma a leitura
 *    do esquema: deixar o servidor fatiar uma string vinda da rede é exatamente o
 *    tipo de decisão que esta separação existe para impedir. URL vaza para
 *    histórico, para cache, para captura de tela e para compartilhamento de tela;
 *    é por isso que até o modo imagem busca os quadros por `fetch`, e não por
 *    `<img src>` (um `<img>` não manda `Authorization`).
 * 3. **O token tem prazo e morre com a sessão.** [desligar] zera tudo; não existe
 *    token que sobreviva ao culto. O prazo é FIXO a partir da aprovação
 *    ([PRAZO_SESSAO_MS]) e **não é renovado pelo uso**: uma janela deslizante
 *    nunca expira enquanto alguém a usar, o que é precisamente o caso do token
 *    vazado sendo usado por outro.
 * 4. **Comparação em tempo constante** (`MessageDigest.isEqual`) para PIN, token
 *    e id de espera. E, pelo mesmo motivo, as sessões vivem numa LISTA percorrida
 *    inteira: um `HashMap[token]` compara por hash e sai na primeira diferença —
 *    seria jogar fora, no lookup, o cuidado tomado na comparação. Com teto de
 *    três sessões, percorrer é de graça.
 * 5. **O operador fica no laço.** PIN correto ⇒ a tela entra como PENDENTE, e a
 *    folha do espelho no Controle mostra `tela pendente — aprovar?`. Há um
 *    interruptor "aprovar automaticamente nesta sessão", que **nasce desligado**
 *    ([definirAutoAprovar]) e morre com o [desligar]. Um PIN de seis dígitos
 *    visível na tela do celular durante todo o culto é fraco demais para ser o
 *    único controle.
 * 6. **Bloqueio por ORIGEM antes de qualquer rotação global.** Cinco tentativas
 *    erradas do mesmo endereço ⇒ [BLOQUEIO_MS] de espera **para aquele
 *    endereço**. **O PIN NÃO ROTACIONA por tentativa errada** — isso seria negação
 *    de serviço contra o pareamento legítimo: um atacante erra dez vezes de
 *    propósito e o visitante que está digitando recebe "PIN inválido" para
 *    sempre, e numa rede com AP isolation o operador culparia a rede. O PIN muda
 *    só em [ligar] ou por [trocarPin] (ação do operador).
 * 7. **A página de pareamento é ANÔNIMA** — sem versão do app, sem nome do
 *    aparelho, sem SSID, sem nome da igreja. Este arquivo colabora não tendo nada
 *    disso para dar: o único dado que ele devolve a quem não provou nada é um id
 *    opaco.
 * 8. **Teto de [MAX_SESSOES] sessões.** Atingido, [aprovar] devolve `null` e o
 *    operador precisa [encerrar] uma — o recurso é auxiliar e finito de
 *    propósito. (O teto de CONEXÕES em voo, e a regra de que um `GET /v` com
 *    token repetido fecha a conexão anterior, são do servidor: são sobre sockets,
 *    não sobre pareamento.)
 * 9. **Todo texto vindo da rede é saneado AQUI**, não no JS: `[\x20-\x7E]`, corte
 *    duro em [TETO_TEXTO] caracteres, `\n`/`\r` impossíveis, aspas trocadas. O
 *    `ua` do relato vai para o **Registro** — que é justamente o artefato que o
 *    projeto manda copiar e repassar (`copiarTexto`, em `controle.js`) —, e um
 *    `\n` ali injetaria linhas falsas num diagnóstico. **Um diagnóstico que mente
 *    é pior que diagnóstico nenhum.** *(E vale registrar por escrito: o
 *    `controle.js` monta o Registro com `textContent`, não `innerHTML`. Aquela
 *    linha é a diferença entre um espelho e a execução de JavaScript de um
 *    desconhecido no origin privilegiado que injeta `__AVBridge`. Ela passa a ser
 *    load-bearing.)*
 *
 * ## Por que um `object` com estado, e não uma classe
 *
 * A especificação o desenha como `object` e o servidor é único por processo, mas
 * a razão de ficar assim é outra: [ligar] **zera tudo** e é o único ponto em que
 * o PIN nasce, o que torna "há exatamente um espelho, e ele começa limpo" uma
 * propriedade verificável em vez de uma convenção. Todo método público é
 * `@Synchronized` (o servidor é multithread — uma thread por cliente) e **todo
 * relógio entra por parâmetro** (`agora: Long`): nada aqui chama
 * `System.currentTimeMillis()`, que é o que torna prazo, bloqueio e expiração
 * testáveis sem esperar um minuto de verdade.
 */
object EspelhoPares {

    /**
     * Prazo do token, a partir da aprovação. Seis horas cobrem qualquer culto com
     * folga e não cobrem o domingo seguinte — que é exatamente a divisão certa.
     */
    const val PRAZO_SESSAO_MS = 6L * 60 * 60 * 1000

    /**
     * Prazo de uma espera (aprovada ou não). Cinco minutos: acima disso o
     * visitante já desistiu ou fechou a aba, e uma fila de pendências velhas na
     * folha do Controle é ruído no meio do culto. Uma espera que morre não leva a
     * sessão junto — a sessão tem prazo próprio.
     */
    const val PRAZO_ESPERA_MS = 5L * 60 * 1000

    /** Erros de PIN da MESMA origem antes do bloqueio. */
    const val ERROS_ATE_BLOQUEIO = 5

    /** Duração do bloqueio de uma origem. */
    const val BLOQUEIO_MS = 60_000L

    /** Teto de sessões vivas (invariante 8). */
    const val MAX_SESSOES = 3

    /**
     * Teto de esperas simultâneas. Sem ele, quem descobriu o PIN pode encher a
     * folha do operador com pendências no meio do culto — e a folha é onde ele
     * decide. Nada a ver com o teto de conexões em voo do servidor.
     */
    const val MAX_ESPERAS = 8

    /** Corte duro de todo texto vindo da rede (invariante 9). */
    const val TETO_TEXTO = 120

    /**
     * O que o cliente conta de si no pareamento, uma vez, e depois a cada 5 min
     * (só o `telaAcesaMin`). Responde, **sem ninguém abrir console em TV
     * nenhuma**: a tela apaga? qual navegador roda ali? `WebCodecs` vale como
     * degrau algum dia?
     *
     * Todo campo aqui **veio da rede** e não vale nada até passar por [sanear] —
     * o que [tentar] faz com o relato inteiro antes de guardá-lo.
     */
    data class Relato(
        val ua: String,
        val w: Int,
        val h: Int,
        val seguro: Boolean,
        val mse: Boolean,
        val mms: Boolean,
        val fetchStream: Boolean,
        val videoDecoder: Boolean,
        val wakeLock: Boolean,
        val telaAcesaMin: Int,
    )

    /**
     * Uma tela que acertou o PIN e espera o operador.
     *
     * [id] é PORTADOR: quem o tem recebe o token quando a aprovação sair. Ele
     * fica fora do `toString` de propósito — este objeto vai para a folha do
     * Controle e daí, num dia ruim, para uma linha de log.
     */
    data class Pendente(val id: String, val relato: Relato, val desde: Long) {
        override fun toString(): String = "Pendente(id=<oculto>, ua=${relato.ua}, desde=$desde)"
    }

    /**
     * Uma tela aprovada.
     *
     * **Nunca imprima [token] no Registro** — o Registro tem botão de copiar e
     * existe para ser repassado. O `toString` já o esconde; a regra é para quem
     * for escrever `"...${sessao.token}..."` à mão.
     */
    data class Sessao(val token: String, val relato: Relato, val expiraEm: Long) {
        override fun toString(): String =
            "Sessao(token=<oculto>, ua=${relato.ua}, expiraEm=$expiraEm)"
    }

    /** O que [tentar] responde. Na rede, tudo que não é [Veredito.Espera] é 403. */
    sealed class Veredito {
        /** PIN certo: a tela entrou na fila do operador com este id opaco. */
        data class Espera(val id: String) : Veredito()

        /** PIN errado. */
        object Recusada : Veredito()

        /** Origem bloqueada por tentativas erradas — [restaMs] até liberar. */
        data class Bloqueada(val restaMs: Long) : Veredito()

        /** PIN certo, mas a fila do operador está cheia ([MAX_ESPERAS]). */
        object Lotada : Veredito()

        /** O espelho não está ligado. */
        object Desligado : Veredito()
    }

    /** O que o cliente recebe ao consultar a própria espera (`POST /par`). */
    sealed class Consulta {
        object Aguardando : Consulta()
        data class Pronta(val sessao: Sessao) : Consulta()
        object Recusada : Consulta()

        /** Id desconhecido — ou expirado, e os dois têm a mesma resposta. */
        object Desconhecida : Consulta()
    }

    private enum class Estado { AGUARDANDO, APROVADA, RECUSADA }

    private class Espera(
        val id: String,
        val relato: Relato,
        val desde: Long,
    ) {
        var estado: Estado = Estado.AGUARDANDO
        var sessao: Sessao? = null
    }

    private class Tentativas {
        var erros = 0
        var bloqueadoAte = 0L
        var visto = 0L
    }

    private var noAr = false
    private var pinAtual = ""
    private var autoOn = false
    private var rnd: SecureRandom = SecureRandom()
    private var recusados = 0

    private val esperas = ArrayList<Espera>()
    private val vivas = ArrayList<Sessao>()
    private val erros = HashMap<String, Tentativas>()

    // ------------------------------------------------------------ interruptor

    /**
     * Liga o pareamento e devolve o PIN novo.
     *
     * Zera TUDO antes: sessões, esperas, bloqueios e o interruptor de aprovação
     * automática. Ligar o espelho é começar do zero, e é isso que faz o token não
     * sobreviver ao culto anterior.
     *
     * [aleatorio] entra por parâmetro para o teste poder fixar a fonte; em
     * produção é um `SecureRandom` novo, como no `SafRegistry` e no [StreamProxy].
     */
    @Synchronized
    fun ligar(agora: Long, aleatorio: SecureRandom = SecureRandom()): String {
        zerar()
        rnd = aleatorio
        noAr = true
        pinAtual = novoPin(rnd)
        // `agora` não é usado hoje — o estado nasce vazio, sem nada a expirar.
        // Ele está na assinatura porque toda porta deste arquivo recebe o relógio
        // de fora, e uma que não recebesse convidaria a próxima a chamar o
        // relógio por dentro.
        return pinAtual
    }

    /** Desliga e apaga tudo. Não há token que sobreviva a isto. */
    @Synchronized
    fun desligar() = zerar()

    @Synchronized
    fun estaLigado(): Boolean = noAr

    /** O PIN em cartaz, para a folha do Controle e para o QR. */
    @Synchronized
    fun pin(): String = pinAtual

    /**
     * Troca o PIN por ação do operador (invariante 6 — e só por ela).
     *
     * Não derruba sessão nem espera: quem já foi aprovado continua vendo, e é
     * isso que separa "trocar o PIN" de "desligar".
     */
    @Synchronized
    fun trocarPin(): String {
        if (!noAr) return ""
        pinAtual = novoPin(rnd)
        return pinAtual
    }

    @Synchronized
    fun definirAutoAprovar(ligado: Boolean) {
        autoOn = ligado
    }

    @Synchronized
    fun autoAprovando(): Boolean = autoOn

    /**
     * Seis dígitos, com os zeros à esquerda preservados.
     *
     * `nextInt(1_000_000)` não tem viés de módulo (o `Random.nextInt(bound)` do
     * JDK descarta o resto do intervalo), e o `SecureRandom` é o mesmo gerador do
     * token — um PIN previsível derrubaria o pareamento inteiro sem que nada
     * parecesse quebrado.
     */
    fun novoPin(aleatorio: SecureRandom): String =
        aleatorio.nextInt(1_000_000).toString().padStart(6, '0')

    // ------------------------------------------------------------- pareamento

    /**
     * Uma tentativa de PIN, vinda de [origem] (o endereço do socket).
     *
     * A ordem importa e é esta: bloqueio da origem primeiro, PIN depois. Um
     * atacante que acertasse o PIN na sexta tentativa **continua bloqueado** — e o
     * visitante legítimo que errou cinco vezes espera um minuto, que é o preço
     * combinado.
     *
     * Acertar o PIN **não** dá acesso: dá uma vaga na fila do operador
     * (invariante 5). Com "aprovar automaticamente" ligado, a aprovação sai aqui
     * mesmo — e se o teto de sessões estiver cheio ela simplesmente não sai, e a
     * espera fica na fila para o operador decidir. Degradar para o manual é o
     * comportamento certo: o interruptor existe para poupar toques, não para
     * inventar vaga.
     */
    @Synchronized
    fun tentar(pin: String, origem: String, relato: Relato, agora: Long): Veredito {
        limpar(agora)
        if (!noAr) return Veredito.Desligado

        val chave = sanear(origem, 64)
        val t = erros.getOrPut(chave) { Tentativas() }
        t.visto = agora
        if (t.bloqueadoAte > agora) return Veredito.Bloqueada(t.bloqueadoAte - agora)
        if (t.bloqueadoAte != 0L) {
            // O bloqueio venceu: a origem volta com a cota inteira. Sem isto, a
            // sexta tentativa de sempre seria bloqueada para sempre.
            t.bloqueadoAte = 0L
            t.erros = 0
        }

        if (!igual(pin, pinAtual)) {
            t.erros++
            recusados++
            if (t.erros >= ERROS_ATE_BLOQUEIO) t.bloqueadoAte = agora + BLOQUEIO_MS
            return Veredito.Recusada
        }

        erros.remove(chave)
        if (esperas.size >= MAX_ESPERAS) return Veredito.Lotada

        val e = Espera(novoToken(), sanear(relato), agora)
        esperas.add(e)
        if (autoOn) aprovarEspera(e, agora)
        return Veredito.Espera(e.id)
    }

    /**
     * O poll do cliente: "a minha espera saiu?".
     *
     * Id desconhecido e id expirado dão a MESMA resposta, pelo mesmo motivo do
     * 404 uniforme do [EspelhoHttp]. E a espera aprovada continua respondendo
     * [Consulta.Pronta] até vencer o prazo dela — se a resposta se perdeu na rede
     * (que é o cenário deste recurso: rede ruim), o cliente repete o poll e
     * recebe o mesmo token, em vez de ser mandado de volta ao PIN.
     */
    @Synchronized
    fun consultar(id: String, agora: Long): Consulta {
        limpar(agora)
        val e = acharEspera(id) ?: return Consulta.Desconhecida
        return when (e.estado) {
            Estado.APROVADA -> e.sessao?.let { Consulta.Pronta(it) } ?: Consulta.Desconhecida
            Estado.RECUSADA -> Consulta.Recusada
            Estado.AGUARDANDO -> Consulta.Aguardando
        }
    }

    /** As telas que esperam o operador — é o que a folha do Controle mostra. */
    @Synchronized
    fun pendentes(): List<Pendente> = esperas
        .filter { it.estado == Estado.AGUARDANDO }
        .map { Pendente(it.id, it.relato, it.desde) }

    /**
     * O operador aprova. Devolve `null` quando não há espera com esse id, quando
     * ela já foi recusada, ou quando o teto de [MAX_SESSOES] está cheio.
     *
     * É **idempotente**: dois toques no botão devolvem a MESMA sessão, em vez de
     * cunhar um segundo token para a mesma tela e consumir dois dos três slots.
     */
    @Synchronized
    fun aprovar(id: String, agora: Long): Sessao? {
        limpar(agora)
        val e = acharEspera(id) ?: return null
        return aprovarEspera(e, agora)
    }

    /**
     * O operador recusa — e se a tela já estava aprovada, a sessão dela cai
     * junto. "Recusar" depois de aprovar é o operador mudando de ideia sobre a
     * TELA, não sobre a fila.
     */
    @Synchronized
    fun recusar(id: String) {
        val e = acharEspera(id) ?: return
        val s = e.sessao
        if (s != null) vivas.removeAll { igual(s.token, it.token) }
        e.sessao = null
        e.estado = Estado.RECUSADA
    }

    // --------------------------------------------------------------- sessões

    /**
     * Valida o cabeçalho `Authorization` CRU (`Bearer <token>`) e devolve a
     * sessão viva, ou `null`.
     *
     * Recebe o cabeçalho inteiro, e não o token já fatiado, de propósito: quem
     * conhece o esquema é quem guarda o segredo (invariante 2). O esquema é
     * comparado sem caixa porque o RFC 7235 assim o define; o token, não —
     * base64url distingue caixa e "quase igual" aqui é igual a errado.
     *
     * Expiração é conferida ANTES da comparação (o [limpar] já removeu as
     * vencidas), então um token expirado é indistinguível de um inventado — que é
     * o que se quer.
     */
    @Synchronized
    fun validar(autorizacao: String?, agora: Long): Sessao? {
        limpar(agora)
        val cru = autorizacao ?: return null
        if (!cru.startsWith("Bearer ", ignoreCase = true)) return null
        val token = cru.substring(7).trim()
        if (token.isEmpty()) return null
        for (s in vivas) if (igual(token, s.token)) return s
        return null
    }

    /** Encerra UMA sessão (o operador tirando uma tela do ar, ou o teto). */
    @Synchronized
    fun encerrar(token: String) {
        vivas.removeAll { igual(token, it.token) }
        for (e in esperas) {
            val s = e.sessao
            if (s != null && igual(token, s.token)) {
                e.sessao = null
                e.estado = Estado.RECUSADA
            }
        }
    }

    /** As sessões vivas, para a folha do Controle e para o Registro. */
    @Synchronized
    fun sessoes(): List<Sessao> = ArrayList(vivas)

    /**
     * Recolhe o que venceu: sessões, esperas e contadores de erro parados.
     *
     * Público porque o servidor a chama de tempos em tempos (um espelho ligado
     * sem cliente nenhum não teria quem passasse por aqui), e chamada no começo
     * de toda porta deste arquivo — assim nenhuma decisão é tomada sobre estado
     * podre, mesmo que ninguém varra nada.
     */
    @Synchronized
    fun limpar(agora: Long) {
        vivas.removeAll { it.expiraEm <= agora }
        esperas.removeAll { agora - it.desde > PRAZO_ESPERA_MS }
        val iter = erros.entries.iterator()
        while (iter.hasNext()) {
            val t = iter.next().value
            if (t.bloqueadoAte <= agora && agora - t.visto > BLOQUEIO_MS) iter.remove()
        }
    }

    // ------------------------------------------------------------ diagnóstico

    /** Quantos PINs foram recusados desde o [ligar] — linha do Registro. */
    @Synchronized
    fun recusas(): Int = recusados

    /** Quantas origens estão de castigo agora — a outra metade da mesma linha. */
    @Synchronized
    fun origensEmBloqueio(agora: Long): Int = erros.values.count { it.bloqueadoAte > agora }

    // ---------------------------------------------------------- saneamento

    /**
     * O funil por onde passa TODO texto vindo da rede (invariante 9).
     *
     * Fora de `[\x20-\x7E]` nada entra: `\n` e `\r` (que injetariam linhas falsas
     * no Registro), tabulação, NUL e qualquer byte alto. Corte duro em [teto].
     *
     * Aspas e contrabarra viram apóstrofo em vez de serem **escapadas**, e isso é
     * deliberado: esta string atravessa três contextos — o JSON do `espelhoDiag`,
     * o `textContent` do Registro e o texto que o operador copia — e não existe
     * um escape que esteja certo nos três (escapar para JSON e depois deixar o
     * `org.json` escapar de novo produz `\\"` na tela do operador). Remover é a
     * única codificação correta em todos.
     */
    fun sanear(texto: String, teto: Int = TETO_TEXTO): String {
        val sb = StringBuilder()
        for (c in texto) {
            if (sb.length >= teto) break
            if (c < ' ' || c > '~') continue
            sb.append(if (c == '"' || c == '\\') '\'' else c)
        }
        return sb.toString()
    }

    /**
     * O relato inteiro, saneado.
     *
     * Os números também são domados: eles vêm do mesmo JSON que o `ua`, e um
     * `w: -2000000000` no Registro não é um ataque, é ruído que faz o operador
     * duvidar da linha inteira.
     */
    private fun sanear(r: Relato): Relato = r.copy(
        ua = sanear(r.ua),
        w = r.w.coerceIn(0, 20_000),
        h = r.h.coerceIn(0, 20_000),
        telaAcesaMin = r.telaAcesaMin.coerceIn(0, 100_000),
    )

    // ---------------------------------------------------------------- interno

    private fun zerar() {
        noAr = false
        pinAtual = ""
        autoOn = false
        recusados = 0
        esperas.clear()
        vivas.clear()
        erros.clear()
    }

    private fun aprovarEspera(e: Espera, agora: Long): Sessao? {
        if (e.estado == Estado.RECUSADA) return null
        e.sessao?.let { return it }
        if (vivas.size >= MAX_SESSOES) return null
        val s = Sessao(novoToken(), e.relato, agora + PRAZO_SESSAO_MS)
        vivas.add(s)
        e.estado = Estado.APROVADA
        e.sessao = s
        return s
    }

    private fun acharEspera(id: String): Espera? {
        for (e in esperas) if (igual(id, e.id)) return e
        return null
    }

    /**
     * 128 bits em base64url sem padding — 22 caracteres, sem `/` nem `=`, os
     * mesmos do `SafRegistry` e do [StreamProxy].
     */
    private fun novoToken(): String {
        val b = ByteArray(16)
        rnd.nextBytes(b)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b)
    }

    /**
     * Comparação em tempo constante (invariante 4).
     *
     * O `MessageDigest.isEqual` do JDK não sai na primeira diferença. Vazio nunca
     * é igual a vazio aqui: sem essa guarda, um PIN vazio casaria com o
     * [pinAtual] vazio de um espelho desligado — o caso em que o segredo não
     * existe é o caso em que ele não pode valer.
     */
    private fun igual(a: String, b: String): Boolean {
        if (a.isEmpty() || b.isEmpty()) return false
        return MessageDigest.isEqual(a.toByteArray(Charsets.UTF_8), b.toByteArray(Charsets.UTF_8))
    }
}
