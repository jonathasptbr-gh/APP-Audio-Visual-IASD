package br.org.iasd.av

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

/**
 * OTA da base web: atualiza `assets/web/` sem gerar APK novo.
 *
 * O QUE ISTO DEVOLVE: no PWA, um push em `main` chegava sozinho ao aparelho.
 * Empacotada num APK, cada ajuste de JS/CSS/HTML passaria a exigir baixar e
 * instalar à mão. Aqui o app consulta um `version.json` publicado, baixa o
 * bundle novo e passa a servi-lo — só mudanças no shell Kotlin (raras) ainda
 * exigem APK.
 *
 * O QUE ISTO **NÃO** MUDA: o acesso ao nativo. A ponte é injetada no WebView
 * pelo Kotlin (`addJavascriptInterface`), não vem nos arquivos web — um
 * bundle baixado enxerga `__AVBridge` exatamente como o embutido, e o
 * `WebViewAssetLoader` serve os dois pelo mesmo origin.
 *
 * TRÊS GARANTIAS, porque isto roda em culto:
 *
 *  1. **Nunca troca a base no meio de uma sessão.** O download acontece em
 *     segundo plano, mas o bundle novo só entra em cena no PRÓXIMO
 *     lançamento do app — jamais recarrega o WebView do telão ao vivo. "Por
 *     lançamento" é literal: [beginSession] decide uma única vez por PROCESSO,
 *     e uma recriação da Activity no meio do culto não redecide nada.
 *  2. **Válvula de compatibilidade** (`minShell`): se o bundle exigir uma
 *     ponte mais nova que a do shell instalado, ele é recusado e o app
 *     continua no que já tinha, funcionando, até um APK novo chegar.
 *  3. **Watchdog de boot.** Um bundle que o CONTROLE não confirme ter
 *     carregado é descartado no lançamento seguinte, voltando ao embutido no
 *     APK. Sem isso, um bundle quebrado deixaria o app inutilizável até
 *     reinstalar. A confirmação do telão não vale (ver [confirmBoot]).
 *
 * As três continuam valendo. O que mudou na v1.60 foi a PROCURA: ela era uma
 * só, no `onCreate`, e um app aberto o dia inteiro — o normal aqui — nunca
 * ficava sabendo do que fosse publicado depois. Ver "vigilância", mais abaixo.
 */
object WebUpdater {

    private const val TAG = "AvIasd/OTA"

    /**
     * O repositório de onde o canal OTA é lido. **Precisa ser o nome ATUAL**,
     * o mesmo que o workflow escreve no campo `assets` do `version.json`
     * (`$GITHUB_REPOSITORY`).
     *
     * Ficou apontando para o nome ANTIGO (`APP-Audio-Visual-IASD`) depois que
     * o repositório foi renomeado, e continuou funcionando por um acaso: o
     * GitHub redireciona o nome antigo para o novo. É um acaso frágil, e o
     * modo de falhar é o pior possível — se alguém criar um repositório com o
     * nome antigo nesta conta, o redirecionamento morre e o app passa a
     * buscar `version.json` num repositório de outra pessoa; se o
     * redirecionamento simplesmente sumir, o `check()` engole o erro em
     * `Log.i` e o OTA fica INERTE, sem sinal nenhum no aparelho.
     */
    private const val REPO = "jonathasptbr-gh/Audio-Visual-IASD"
    private const val VERSION_URL =
        "https://github.com/$REPO/releases/download/web-latest/version.json"

    private const val PREFS = "web-ota"
    private const val KEY_ACTIVE = "active"   // subdiretório servido agora

    /**
     * Bundle cujo boot ainda não foi confirmado — o NOME do subdiretório, não
     * um booleano.
     *
     * Com um booleano, a confirmação de um bundle perdoava outro: qualquer
     * escrita de `false` desarmava o watchdog do que estivesse armado, sem
     * relação com quem confirmou. Guardando o nome, o watchdog só dispara
     * quando o pendente é EXATAMENTE o que está sendo servido.
     *
     * Chave nova de propósito: a antiga guardava um `Boolean`, e ler um
     * booleano como String em `SharedPreferences` lança `ClassCastException` —
     * dentro do `onCreate`, o que deixaria o app sem abrir depois de atualizar
     * o APK. A antiga é apenas removida.
     */
    private const val KEY_PENDING = "pending-bundle"
    private const val KEY_PENDING_LEGACY = "pending"

    private const val CONNECT_TIMEOUT = 10_000
    private const val READ_TIMEOUT = 30_000
    private const val MAX_ZIP_BYTES = 64L * 1024 * 1024 // teto de sanidade

    /**
     * Hosts de onde um bundle pode vir. A URL do zip sai do `version.json`, que
     * viaja pelo mesmo canal — travar o host não dá autenticidade nenhuma
     * (quem escreve o `version.json` também escreve o zip), mas impede que um
     * único campo alterado aponte o download para um servidor qualquer, e o
     * `sha256` deixa de ser a única barreira.
     */
    private val ALLOWED_ASSET_HOSTS = setOf(
        "github.com",
        "objects.githubusercontent.com",
    )

    /**
     * Uma verificação por vez. `checkAsync` roda em todo `onCreate`, e o
     * `android:configChanges` do manifesto não cobre `fontScale` nem `locale`:
     * mudar o tamanho da fonte ou o idioma durante um download disparava um
     * segundo `check()` em paralelo ao primeiro. As duas execuções escreviam
     * nos MESMOS caminhos temporários — uma apagava o staging que a outra
     * estava extraindo, e podia sair um diretório INCOMPLETO ativado como
     * bundle bom (com `index.html` novo e `controle.js` do APK antigo pelo
     * fallback por arquivo, sem o watchdog perceber, porque a página carrega).
     */
    private val checking = AtomicBoolean(false)

    /**
     * A base desta sessão já foi decidida neste processo.
     *
     * `beginSession` roda uma vez por `onCreate`, não uma vez por lançamento —
     * e a garantia 1 ("nunca troca a base no meio de uma sessão") foi escrita
     * supondo o contrário. Uma recriação da Activity durante o culto fazia o
     * método rearmar o watchdog e rodar o `cleanup`, que APAGA o diretório do
     * bundle que os dois WebViews estão servindo ao vivo — e, se o boot ainda
     * não tivesse sido confirmado, descartava um bundle sem defeito nenhum.
     * Por processo, isso não acontece: recriações apenas reencontram a decisão.
     */
    @Volatile
    private var sessionStarted = false

    /**
     * Raiz do bundle servido nesta sessão — `null` = o embutido no APK.
     * Definida uma única vez por [beginSession], antes de qualquer WebView
     * existir, para que Controle e Display sirvam SEMPRE o mesmo bundle.
     */
    @Volatile
    var sessionRoot: File? = null
        private set

    /**
     * Decide o que servir nesta sessão e arma o watchdog. Chamar no início do
     * `onCreate`, antes de criar os WebViews.
     *
     * **Idempotente por processo** (ver [sessionStarted]): numa recriação da
     * Activity a decisão já está tomada e nada é rearmado nem apagado.
     */
    fun beginSession(ctx: Context): File? {
        if (sessionStarted) return sessionRoot
        sessionStarted = true
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val active = p.getString(KEY_ACTIVE, null)
        if (active == null) {
            sessionRoot = null
            return null
        }
        val dir = File(baseDir(ctx), active)

        // O boot anterior serviu ESTE bundle (a comparação é por nome — ver
        // [KEY_PENDING]) e nunca confirmou que carregou: trata-se como quebrado
        // e volta ao embutido.
        val pendente = try {
            p.getString(KEY_PENDING, null)
        } catch (_: ClassCastException) {
            null
        }
        if (pendente == active) {
            Log.w(TAG, "bundle $active não confirmou o boot anterior — descartando")
            dir.deleteRecursively()
            p.edit().remove(KEY_ACTIVE).remove(KEY_PENDING).remove(KEY_PENDING_LEGACY).apply()
            cleanup(ctx, keep = emptySet())
            sessionRoot = null
            return null
        }

        // Um APK novo pode trazer uma base web mais recente que o OTA guardado
        // (ex.: atualizou o app depois de já ter recebido um bundle antigo).
        val embedded = embeddedVersion(ctx)
        val installed = versionOf(File(dir, "web/version.json").takeIf { it.isFile })
        if (!dir.isDirectory || installed == null || compareVersions(embedded, installed) >= 0) {
            dir.deleteRecursively()
            p.edit().remove(KEY_ACTIVE).remove(KEY_PENDING).remove(KEY_PENDING_LEGACY).apply()
            cleanup(ctx, keep = emptySet())
            sessionRoot = null
            return null
        }

        // Arma o watchdog PARA ESTE bundle, e aproveita para varrer a chave
        // booleana antiga (ver [KEY_PENDING_LEGACY]).
        p.edit().putString(KEY_PENDING, active).remove(KEY_PENDING_LEGACY).apply()
        sessionRoot = dir
        // Ponto único e seguro para recolher bundles antigos: nenhum WebView
        // existe ainda, então nada está sendo servido. É aqui que sai o diretório
        // que o `check()` da sessão anterior preservou de propósito.
        cleanup(ctx, keep = setOf(dir.name))
        Log.i(TAG, "servindo bundle OTA $installed (embutido: $embedded)")
        return dir
    }

    /**
     * O lado web carregou com sucesso (ver `shared/native.js`): desarma o
     * watchdog para este bundle.
     *
     * Quem tem direito de confirmar é só o WebView do **Controle** — a filtragem
     * está em `NativeBridge.otaConfirm`, que é quem conhece o papel. O Display
     * carrega uma fração do código, então uma confirmação vinda dele não diz
     * nada sobre o Controle estar de pé.
     */
    fun confirmBoot(ctx: Context) {
        // Confirma o bundle QUE ESTÁ SENDO SERVIDO, e só ele: se o watchdog
        // pendente for de outro (o `check()` desta sessão já ativou um bundle
        // novo, por exemplo), não há nada a desarmar aqui.
        val servido = sessionRoot?.name ?: return
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pendente = try {
            p.getString(KEY_PENDING, null)
        } catch (_: ClassCastException) {
            null
        }
        if (pendente == servido) {
            p.edit().remove(KEY_PENDING).apply()
            Log.i(TAG, "bundle $servido confirmado")
        }
    }

    /**
     * A versão mais nova que o aparelho JÁ TEM: a servida agora ou a que está
     * baixada esperando o próximo lançamento, o que for maior. É contra ela que
     * uma publicação é comparada — ver o porquê em [check].
     */
    private fun versaoJaTemos(ctx: Context): String {
        val atual = currentVersion(ctx)
        val esperando = pendingVersion(ctx) ?: return atual
        return if (compareVersions(esperando, atual) > 0) esperando else atual
    }

    /** Versão web em uso agora (do bundle OTA servido, ou do embutido). */
    fun currentVersion(ctx: Context): String {
        val root = sessionRoot ?: return embeddedVersion(ctx)
        return versionOf(File(root, "web/version.json")) ?: embeddedVersion(ctx)
    }

    /**
     * A versão do bundle que já está BAIXADO e esperando o próximo lançamento —
     * `null` quando não há nada além do que esta sessão já serve.
     *
     * Existe para o app poder AVISAR (ver `NativeBridge.otaPending`). Até aqui a
     * atualização era invisível por completo: ela chegava calada e entrava na
     * abertura seguinte, então quem quisesse a correção do dia tinha de saber,
     * por fora, que precisava fechar e reabrir o app.
     */
    fun pendingVersion(ctx: Context): String? {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val active = p.getString(KEY_ACTIVE, null) ?: return null
        // Já é o desta sessão: não há o que oferecer.
        if (active == sessionRoot?.name) return null
        val dir = File(baseDir(ctx), active)
        val v = versionOf(File(dir, "web/version.json").takeIf { it.isFile }) ?: return null
        return if (compareVersions(v, currentVersion(ctx)) > 0) v else null
    }

    /**
     * APLICA AGORA o bundle que esperava o próximo lançamento, devolvendo a
     * versão aplicada (ou `null` se não havia nada a aplicar).
     *
     * ## Isto flexiona a garantia 1, e por isso só acontece a PEDIDO
     *
     * "Nunca troca a base no meio de uma sessão" existe porque uma troca
     * ACIDENTAL no meio de um culto recarrega o telão e derruba a projeção. O
     * que ela protege é o operador, não o mecanismo: quando é ele quem pede,
     * sabendo o que vai acontecer e com a tela livre (quem oferece é o lado
     * web, e só sem cena no ar), a troca deixa de ser um acidente e passa a ser
     * uma escolha. O caminho automático continua intocado — sem este pedido,
     * o bundle novo segue entrando só no lançamento seguinte.
     *
     * O que NÃO muda aqui, de propósito:
     *
     * - **O watchdog arma igual.** Se o bundle recém-servido não confirmar o
     *   boot, o lançamento seguinte o descarta e volta ao embutido — a mesma
     *   rede de proteção do caminho normal, e ela é justamente o que torna
     *   seguro aplicar ao vivo.
     * - **Nada é apagado.** O diretório antigo continua no disco: os dois
     *   WebViews ainda podem ter requisições em voo contra ele durante a
     *   recarga. Quem recolhe é o `beginSession()` do próximo lançamento, o
     *   único ponto em que nenhum WebView existe.
     *
     * Recarregar os dois WebViews é com quem os tem (ver `MainActivity`): este
     * objeto não conhece View nenhuma.
     */
    fun applyNow(ctx: Context): String? {
        val versao = pendingVersion(ctx) ?: return null
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val active = p.getString(KEY_ACTIVE, null) ?: return null
        val dir = File(baseDir(ctx), active)
        // A MESMA reprovação do caminho de download: um bundle sem o index do
        // Controle não vale ser servido. Aqui ela é ainda mais barata que lá, e
        // o custo de não fazê-la seria um app que não abre.
        if (!File(dir, "web/controle/index.html").isFile) {
            Log.w(TAG, "bundle $active sem index do Controle — não aplicado ao vivo")
            return null
        }
        p.edit().putString(KEY_PENDING, active).remove(KEY_PENDING_LEGACY).apply()
        sessionRoot = dir
        Log.i(TAG, "base web $versao aplicada AO VIVO, a pedido do operador")
        return versao
    }

    // ---------- vigilância: procurar de verdade, e não uma vez só ----------
    //
    // ATÉ A v1.60 A PROCURA ERA UMA SÓ, no `onCreate`. O lado web pergunta de
    // minuto em minuto se há bundle esperando (`otaPending`), mas essa pergunta
    // só lê o que já está no DISCO — quem põe alguma coisa lá é o `check()`, e
    // ele rodava uma vez por lançamento. Ou seja: **o web enquetava um valor
    // que ninguém atualizava.** Com o app aberto (que é o normal: ele fica
    // aberto o culto inteiro, e no dia a dia por horas), uma versão publicada
    // depois da abertura simplesmente não existia para o aparelho — nenhum
    // aviso, nenhuma demora, ausência total. E se a única tentativa caísse sem
    // rede (o Wi-Fi da igreja demorando a associar é o caso comum), nada era
    // retentado até o próximo lançamento.
    //
    // Agora há QUATRO gatilhos, e eles cobrem coisas diferentes de propósito:
    //
    //  1. **abertura** — o de sempre;
    //  2. **ronda periódica** enquanto o processo viver ([RONDA_MS]);
    //  3. **retomada do app** — o operador voltando à tela é justamente quando
    //     ele agiria sobre o aviso, e é quando a rede costuma estar de volta;
    //  4. **a rede voltando** ([vigiarRede]) — fecha o caso do lançamento sem
    //     internet, que antes custava o resto da sessão.
    //
    // E uma falha não espera a ronda: ela é retentada com espera crescente
    // ([ESPERAS_FALHA_MS]), porque "sem rede agora" quase nunca significa "sem
    // rede daqui a meio minuto".

    /** Intervalo da ronda com tudo indo bem. */
    private const val RONDA_MS = 5L * 60_000

    /**
     * Piso entre duas verificações BEM-SUCEDIDAS. Os gatilhos de evento
     * (retomada, rede) podem vir em rajada — alternar entre dois apps dispara
     * `onResume` a cada toque —, e sem o piso cada um viraria uma requisição.
     * Não vale para um pedido explícito (`forcar`), que é o operador esperando
     * resposta.
     */
    private const val MIN_ENTRE_CHECKS_MS = 45_000

    /** Espera crescente depois de uma falha: ~30 s, 1 min, 2 min, 5 min. */
    private val ESPERAS_FALHA_MS = longArrayOf(30_000, 60_000, 120_000, 300_000)

    @Volatile private var ultimoOk = 0L
    @Volatile private var ultimoResultado = "ainda não verificou"
    @Volatile private var ultimoInstante = 0L
    @Volatile private var falhasSeguidas = 0
    @Volatile private var proximaEm = 0L
    @Volatile private var vigiando = false

    /**
     * Avisado quando um bundle NOVO acaba de ficar pronto no disco. É o que
     * permite o aviso aparecer no segundo em que a atualização chega, em vez de
     * esperar a enquete de um minuto do lado web (ver `MainActivity`).
     */
    @Volatile
    var aoChegar: ((String) -> Unit)? = null

    private val rondas by lazy {
        java.util.concurrent.Executors.newSingleThreadScheduledExecutor { r ->
            Thread(r, "web-ota-ronda").apply { isDaemon = true }
        }
    }

    /**
     * Liga a ronda e o vigia de rede. Idempotente — chamar do `onCreate`.
     *
     * O executor é daemon e o processo é o dono: quando o app morre, tudo isto
     * morre junto, que é o comportamento certo. Não há `WorkManager` nem alarme
     * aqui de propósito — atualizar a base web de um app FECHADO não serve para
     * nada (ela entra ao abrir, e ao abrir a procura acontece de qualquer jeito)
     * e custaria bateria e uma dependência.
     */
    fun iniciarVigilancia(ctx: Context) {
        if (vigiando) return
        vigiando = true
        val app = ctx.applicationContext
        // `Runnable { }` explícito: `schedule`/`scheduleWithFixedDelay` têm
        // sobrecarga para `Callable`, e uma lambda que devolve `Unit` serve para
        // as duas — deixar o compilador escolher é convite a resolver para a
        // errada num refactor futuro.
        rondas.scheduleWithFixedDelay(
            Runnable { checkAsync(app, "ronda") },
            RONDA_MS, RONDA_MS, java.util.concurrent.TimeUnit.MILLISECONDS,
        )
        vigiarRede(app)
    }

    /**
     * A REDE VOLTANDO é um gatilho, não um detalhe. O lançamento sem internet
     * — Wi-Fi da igreja ainda associando, dados móveis desligados — era o modo
     * de falhar mais comum: a única tentativa da sessão morria em segundos e
     * ninguém tentava de novo.
     */
    private fun vigiarRede(app: Context) {
        try {
            val cm = app.getSystemService(android.net.ConnectivityManager::class.java) ?: return
            cm.registerDefaultNetworkCallback(object : android.net.ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) {
                    checkAsync(app, "rede voltou")
                }
            })
        } catch (e: Exception) {
            // Sem permissão ou sem serviço: os outros três gatilhos continuam.
            Log.i(TAG, "sem vigia de rede: ${e.message}")
        }
    }

    /**
     * Procura e baixa uma base web nova, em segundo plano. Silencioso por
     * natureza: sem rede, o app simplesmente segue com o que já tem.
     *
     * `forcar` pula o piso de [MIN_ENTRE_CHECKS_MS] — é o pedido explícito do
     * operador (o botão "Procurar atualização"), e fazer um botão não fazer
     * nada porque um relógio interno acha que é cedo demais é pior que a
     * requisição extra.
     */
    fun checkAsync(ctx: Context, motivo: String = "abertura", forcar: Boolean = false) {
        val app = ctx.applicationContext
        val agora = System.currentTimeMillis()
        // Depois de uma falha, a espera crescente segura os gatilhos de rotina —
        // e só eles: a retentativa agendada vem com `forcar` e passa por cima.
        if (!forcar && agora < proximaEm) return
        if (!forcar && ultimoOk > 0 && agora - ultimoOk < MIN_ENTRE_CHECKS_MS) return
        // Uma recriação da Activity chamaria isto de novo com o download
        // anterior ainda em curso — ver [checking].
        if (!checking.compareAndSet(false, true)) {
            Log.i(TAG, "verificação já em curso — ignorando a de $motivo")
            return
        }
        thread(name = "web-ota", isDaemon = true) {
            try {
                // `check` escreve o [ultimoResultado] em cada desfecho seu —
                // "nada novo" e "exige shell 32" são respostas diferentes, e
                // carimbá-las aqui por fora apagaria a segunda.
                val nova = check(app)
                ultimoOk = System.currentTimeMillis()
                ultimoInstante = ultimoOk
                falhasSeguidas = 0
                proximaEm = 0
                if (nova != null) aoChegar?.invoke(nova)
            } catch (e: Exception) {
                ultimoInstante = System.currentTimeMillis()
                ultimoResultado = "falhou (${e.message})"
                // RETENTAR SOZINHO, com espera crescente. Sem isto, uma falha
                // custava a sessão inteira: a ronda de 5 min ainda viria, mas
                // "sem rede agora" quase nunca significa "sem rede daqui a
                // meio minuto", e o custo de perguntar de novo é um JSON.
                val i = minOf(falhasSeguidas, ESPERAS_FALHA_MS.size - 1)
                val espera = ESPERAS_FALHA_MS[i]
                falhasSeguidas++
                proximaEm = System.currentTimeMillis() + espera
                Log.i(TAG, "sem atualização ($motivo): ${e.message} — de novo em ${espera / 1000}s")
                try {
                    val n = falhasSeguidas
                    rondas.schedule(
                        Runnable { checkAsync(app, "retentativa $n", forcar = true) },
                        espera, java.util.concurrent.TimeUnit.MILLISECONDS,
                    )
                } catch (_: Exception) { /* executor encerrado */ }
            } finally {
                checking.set(false)
            }
        }
    }

    /**
     * O estado da procura, em uma linha, para o Registro de Configurações.
     *
     * Existe porque "não apareceu aviso nenhum" tem pelo menos quatro causas
     * indistinguíveis da tela: não há versão nova, a procura falhou, o bundle
     * exige um shell mais novo, ou a pergunta está esperando o telão esvaziar.
     * Sem isto, a única resposta possível era um palpite.
     */
    fun diag(ctx: Context): String {
        val agora = System.currentTimeMillis()
        val quando = if (ultimoInstante == 0L) "nunca"
        else "há " + ((agora - ultimoInstante) / 1000) + "s"
        val pend = pendingVersion(ctx)
        return "web v" + currentVersion(ctx) +
            (pend?.let { " · v$it esperando" } ?: "") +
            " · última busca $quando: $ultimoResultado" +
            (if (falhasSeguidas > 0) " · $falhasSeguidas falha(s) seguida(s)" else "")
    }

    /** Devolve a versão baixada agora, ou `null` se não havia nada novo. */
    private fun check(ctx: Context): String? {
        val meta = JSONObject(fetchText(versionUrl()))
        val version = meta.getString("version")
        val minShell = meta.optInt("minShell", 0)

        // Válvula: um web que exige uma ponte mais nova que a do shell
        // instalado quebraria recursos no aparelho — melhor não atualizar.
        if (minShell > NativeBridge.SHELL_VERSION) {
            Log.w(TAG, "bundle $version exige shell $minShell (temos ${NativeBridge.SHELL_VERSION}) — ignorado")
            ultimoResultado = "v$version exige shell $minShell (temos ${NativeBridge.SHELL_VERSION})"
            return null
        }

        // CONTRA O QUE JÁ TEMOS, e não contra o que estamos SERVINDO (v1.60).
        // Enquanto a procura era uma por lançamento, os dois eram a mesma coisa.
        // Com a ronda, não: um bundle baixado fica esperando o próximo
        // lançamento, `currentVersion` continua sendo o da sessão, e a ronda
        // seguinte concluiria de novo que há versão nova — baixando o MESMO
        // zip a cada cinco minutos, para sempre, e apagando com
        // `deleteRecursively` um diretório que o operador pode ter acabado de
        // mandar aplicar ao vivo.
        val current = versaoJaTemos(ctx)
        if (compareVersions(version, current) <= 0) {
            ultimoResultado = "nada novo (publicada: v$version)"
            return null
        }

        val url = meta.getString("assets")

        // O host do zip é travado: um `version.json` alterado não pode mandar o
        // app buscar JavaScript em qualquer servidor — e esse JS rodaria no
        // origin privilegiado, com a ponte inteira à disposição.
        val alvo = try { java.net.URI(url) } catch (_: Exception) { null }
        val host = alvo?.host ?: ""
        if (alvo?.scheme != "https" || host !in ALLOWED_ASSET_HOSTS) {
            Log.w(TAG, "bundle $version aponta para destino não permitido ($url) — ignorado")
            ultimoResultado = "v$version aponta para destino não permitido"
            return null
        }

        // sha256 OBRIGATÓRIO. Ele não dá autenticidade (viaja no mesmo canal do
        // zip), mas é a única checagem de integridade que existe: aceitar um
        // `version.json` sem o campo era instalar um bundle sem verificação
        // nenhuma. O workflow sempre o emite, então exigi-lo não fecha nenhuma
        // porta legítima.
        val sha256 = meta.optString("sha256", "")
        if (sha256.isBlank()) {
            Log.w(TAG, "bundle $version sem sha256 — ignorado")
            ultimoResultado = "v$version publicada sem sha256"
            return null
        }
        Log.i(TAG, "baixando base web $version (atual: $current)")

        // Caminhos temporários ÚNICOS por execução: dois `check()` sobrepostos
        // (ver [checking]) escrevendo no mesmo zip e no mesmo staging podiam
        // ativar um diretório pela metade. O `checking` já serializa; os nomes
        // únicos garantem que nem um resto de execução anterior interfira, e o
        // `cleanup` recolhe os `staging-*` órfãos.
        val stamp = UUID.randomUUID().toString().take(8)
        val tmpZip = File(ctx.cacheDir, "web-$version-$stamp.zip")
        try {
            download(url, tmpZip)
            val got = sha256Of(tmpZip)
            if (!got.equals(sha256, ignoreCase = true)) {
                Log.w(TAG, "sha256 não confere — descartando download")
                ultimoResultado = "v$version com sha256 que não confere"
                return null
            }

            val staging = File(baseDir(ctx), "staging-$version-$stamp")
            staging.deleteRecursively()
            unzip(tmpZip, staging)

            // Um bundle sem o index do Controle é inútil: não vale ativar.
            if (!File(staging, "web/controle/index.html").isFile) {
                Log.w(TAG, "bundle sem web/controle/index.html — descartando")
                staging.deleteRecursively()
                ultimoResultado = "v$version sem o Controle dentro"
                return null
            }

            val target = File(baseDir(ctx), "v$version")
            // NUNCA apagar o que está no ar. A comparação acima já torna isto
            // inalcançável (só se chega aqui com uma versão maior que a
            // servida), mas o custo de errar aqui é o app perdendo os arquivos
            // debaixo dos dois WebViews no meio de um culto.
            if (target == sessionRoot) {
                staging.deleteRecursively()
                ultimoResultado = "v$version já é a que está no ar"
                return null
            }
            target.deleteRecursively()
            if (!staging.renameTo(target)) {
                staging.deleteRecursively()
                Log.w(TAG, "não foi possível ativar o bundle $version")
                ultimoResultado = "v$version não pôde ser ativada"
                return null
            }

            val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            // KEY_PENDING não é tocado aqui: ele nomeia o bundle DESTA sessão,
            // que continua sendo servido e ainda pode confirmar. O watchdog do
            // bundle novo só arma quando ele for de fato servido, no próximo
            // lançamento — e é lá que a entrada antiga é sobrescrita.
            p.edit().putString(KEY_ACTIVE, target.name).apply()
            // Preserva TAMBÉM o bundle que esta sessão está servindo agora: os dois
            // WebViews leem dele ao vivo, e apagá-lo faria todo recurso ainda não
            // carregado (e qualquer recarga do telão, que é evento esperado quando o
            // dongle reconecta) cair no fallback do APK — versão mais antiga, no meio
            // do culto. O diretório velho sai no `beginSession()` do próximo
            // lançamento, que é o único ponto que decide o que a sessão vai servir.
            cleanup(ctx, keep = setOfNotNull(target.name, sessionRoot?.name))
            Log.i(TAG, "base web $version pronta — entra no próximo lançamento")
            ultimoResultado = "v$version baixada"
            return version
        } finally {
            tmpZip.delete()
        }
    }

    // ---------- armazenamento ----------

    private fun baseDir(ctx: Context): File =
        File(ctx.filesDir, "web-ota").apply { mkdirs() }

    private fun cleanup(ctx: Context, keep: Set<String>) {
        baseDir(ctx).listFiles()?.forEach { if (it.name !in keep) it.deleteRecursively() }
    }

    // ---------- versões ----------

    private fun embeddedVersion(ctx: Context): String = try {
        ctx.assets.open("web/version.json").use {
            JSONObject(it.readBytes().decodeToString()).getString("version")
        }
    } catch (e: Exception) {
        Log.w(TAG, "version.json embutido ilegível", e)
        "0"
    }

    private fun versionOf(file: File?): String? = try {
        file?.takeIf { it.isFile }?.let { JSONObject(it.readText()).getString("version") }
    } catch (_: Exception) {
        null
    }

    /** Compara "4.82" com "4.9" numericamente por componente (não lexical). */
    fun compareVersions(a: String, b: String): Int {
        val pa = a.split('.')
        val pb = b.split('.')
        for (i in 0 until maxOf(pa.size, pb.size)) {
            val x = pa.getOrNull(i)?.filter { it.isDigit() }?.toIntOrNull() ?: 0
            val y = pb.getOrNull(i)?.filter { it.isDigit() }?.toIntOrNull() ?: 0
            if (x != y) return if (x > y) 1 else -1
        }
        return 0
    }

    // ---------- rede ----------

    private fun open(url: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = CONNECT_TIMEOUT
        conn.readTimeout = READ_TIMEOUT
        conn.instanceFollowRedirects = true // releases/download redireciona
        conn.setRequestProperty("Accept", "*/*")
        // NADA DE CÓPIA GUARDADA para o `version.json` (v1.60). O asset da
        // release `web-latest` é SUBSTITUÍDO no lugar — mesma URL, conteúdo
        // novo —, que é exatamente o caso em que um cache intermediário devolve
        // o de ontem com toda a razão do mundo. Uma resposta guardada aqui não
        // atrasa a atualização: ela a torna INVISÍVEL pelo tempo que o cache
        // durar, sem nenhum sinal no aparelho. O zip leva os mesmos cabeçalhos
        // porque ele muda pelo mesmo mecanismo.
        conn.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
        conn.setRequestProperty("Pragma", "no-cache")
        return conn
    }

    /**
     * A URL do `version.json` com um parâmetro que muda a cada consulta.
     *
     * Cinto e suspensório junto com os cabeçalhos acima: um cache que ignora
     * `no-cache` (e eles existem) ainda assim não tem essa chave guardada. O
     * `releases/download/...` do GitHub trata a query como enfeite e redireciona
     * igual, então o custo é zero.
     */
    private fun versionUrl(): String = VERSION_URL + "?t=" + System.currentTimeMillis()

    private fun fetchText(url: String): String {
        val conn = open(url)
        try {
            if (conn.responseCode !in 200..299) error("HTTP ${conn.responseCode}")
            return conn.inputStream.use { it.readBytes().decodeToString() }
        } finally {
            conn.disconnect()
        }
    }

    private fun download(url: String, to: File) {
        val conn = open(url)
        try {
            if (conn.responseCode !in 200..299) error("HTTP ${conn.responseCode}")
            conn.inputStream.use { input ->
                FileOutputStream(to).use { out -> copyLimited(input, out, MAX_ZIP_BYTES) }
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun copyLimited(input: InputStream, out: java.io.OutputStream, limit: Long): Long {
        val buf = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            total += n
            if (total > limit) error("bundle grande demais")
            out.write(buf, 0, n)
        }
        return total
    }

    private fun sha256Of(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                md.update(buf, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    // ---------- extração ----------

    private fun unzip(zip: File, dest: File) {
        dest.mkdirs()
        val destPath = dest.canonicalPath + File.separator
        var written = 0L
        ZipInputStream(zip.inputStream().buffered()).use { zin ->
            while (true) {
                val entry = zin.nextEntry ?: break
                val out = File(dest, entry.name)
                // Zip slip: uma entrada com ".." escaparia do diretório de
                // destino e poderia sobrescrever arquivos do app.
                if (!out.canonicalPath.startsWith(destPath)) {
                    error("entrada suspeita no bundle: ${entry.name}")
                }
                if (entry.isDirectory) {
                    out.mkdirs()
                } else {
                    out.parentFile?.mkdirs()
                    FileOutputStream(out).use { o ->
                        written += copyLimited(zin, o, MAX_ZIP_BYTES - written)
                    }
                }
                zin.closeEntry()
            }
        }
    }
}
