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
 */
object WebUpdater {

    private const val TAG = "AvIasd/OTA"
    private const val REPO = "jonathasptbr-gh/APP-Audio-Visual-IASD"
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

    /** Versão web em uso agora (do bundle OTA servido, ou do embutido). */
    fun currentVersion(ctx: Context): String {
        val root = sessionRoot ?: return embeddedVersion(ctx)
        return versionOf(File(root, "web/version.json")) ?: embeddedVersion(ctx)
    }

    /**
     * Procura e baixa uma base web nova, em segundo plano. Silencioso por
     * natureza: sem rede, o app simplesmente segue com o que já tem.
     */
    fun checkAsync(ctx: Context) {
        val app = ctx.applicationContext
        // Uma recriação da Activity chamaria isto de novo com o download
        // anterior ainda em curso — ver [checking].
        if (!checking.compareAndSet(false, true)) {
            Log.i(TAG, "verificação já em curso — ignorando a segunda")
            return
        }
        thread(name = "web-ota", isDaemon = true) {
            try {
                check(app)
            } catch (e: Exception) {
                Log.i(TAG, "sem atualização: ${e.message}")
            } finally {
                checking.set(false)
            }
        }
    }

    private fun check(ctx: Context) {
        val meta = JSONObject(fetchText(VERSION_URL))
        val version = meta.getString("version")
        val minShell = meta.optInt("minShell", 0)

        // Válvula: um web que exige uma ponte mais nova que a do shell
        // instalado quebraria recursos no aparelho — melhor não atualizar.
        if (minShell > NativeBridge.SHELL_VERSION) {
            Log.w(TAG, "bundle $version exige shell $minShell (temos ${NativeBridge.SHELL_VERSION}) — ignorado")
            return
        }

        val current = currentVersion(ctx)
        if (compareVersions(version, current) <= 0) return

        val url = meta.getString("assets")

        // O host do zip é travado: um `version.json` alterado não pode mandar o
        // app buscar JavaScript em qualquer servidor — e esse JS rodaria no
        // origin privilegiado, com a ponte inteira à disposição.
        val alvo = try { java.net.URI(url) } catch (_: Exception) { null }
        val host = alvo?.host ?: ""
        if (alvo?.scheme != "https" || host !in ALLOWED_ASSET_HOSTS) {
            Log.w(TAG, "bundle $version aponta para destino não permitido ($url) — ignorado")
            return
        }

        // sha256 OBRIGATÓRIO. Ele não dá autenticidade (viaja no mesmo canal do
        // zip), mas é a única checagem de integridade que existe: aceitar um
        // `version.json` sem o campo era instalar um bundle sem verificação
        // nenhuma. O workflow sempre o emite, então exigi-lo não fecha nenhuma
        // porta legítima.
        val sha256 = meta.optString("sha256", "")
        if (sha256.isBlank()) {
            Log.w(TAG, "bundle $version sem sha256 — ignorado")
            return
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
                return
            }

            val staging = File(baseDir(ctx), "staging-$version-$stamp")
            staging.deleteRecursively()
            unzip(tmpZip, staging)

            // Um bundle sem o index do Controle é inútil: não vale ativar.
            if (!File(staging, "web/controle/index.html").isFile) {
                Log.w(TAG, "bundle sem web/controle/index.html — descartando")
                staging.deleteRecursively()
                return
            }

            val target = File(baseDir(ctx), "v$version")
            target.deleteRecursively()
            if (!staging.renameTo(target)) {
                staging.deleteRecursively()
                Log.w(TAG, "não foi possível ativar o bundle $version")
                return
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
        return conn
    }

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
