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
 *     lançamento do app — jamais recarrega o WebView do telão ao vivo.
 *  2. **Válvula de compatibilidade** (`minShell`): se o bundle exigir uma
 *     ponte mais nova que a do shell instalado, ele é recusado e o app
 *     continua no que já tinha, funcionando, até um APK novo chegar.
 *  3. **Watchdog de boot.** Um bundle que não confirme carregamento é
 *     descartado no lançamento seguinte, voltando ao embutido no APK. Sem
 *     isso, um bundle quebrado deixaria o app inutilizável até reinstalar.
 */
object WebUpdater {

    private const val TAG = "AvIasd/OTA"
    private const val REPO = "jonathasptbr-gh/APP-Audio-Visual-IASD"
    private const val VERSION_URL =
        "https://github.com/$REPO/releases/download/web-latest/version.json"

    private const val PREFS = "web-ota"
    private const val KEY_ACTIVE = "active"   // subdiretório servido agora
    private const val KEY_PENDING = "pending" // boot ainda não confirmou

    private const val CONNECT_TIMEOUT = 10_000
    private const val READ_TIMEOUT = 30_000
    private const val MAX_ZIP_BYTES = 64L * 1024 * 1024 // teto de sanidade

    /**
     * Raiz do bundle servido nesta sessão — `null` = o embutido no APK.
     * Definida uma única vez por [beginSession], antes de qualquer WebView
     * existir, para que Controle e Display sirvam SEMPRE o mesmo bundle.
     */
    @Volatile
    var sessionRoot: File? = null
        private set

    /**
     * Decide o que servir nesta sessão e arma o watchdog. Chamar uma vez, no
     * início do `onCreate`, antes de criar os WebViews.
     */
    fun beginSession(ctx: Context): File? {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val active = p.getString(KEY_ACTIVE, null)
        if (active == null) {
            sessionRoot = null
            return null
        }
        val dir = File(baseDir(ctx), active)

        // O boot anterior serviu este bundle e nunca confirmou que carregou:
        // trata-se como quebrado e volta ao embutido.
        if (p.getBoolean(KEY_PENDING, false)) {
            Log.w(TAG, "bundle $active não confirmou o boot anterior — descartando")
            dir.deleteRecursively()
            p.edit().remove(KEY_ACTIVE).remove(KEY_PENDING).apply()
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
            p.edit().remove(KEY_ACTIVE).remove(KEY_PENDING).apply()
            cleanup(ctx, keep = emptySet())
            sessionRoot = null
            return null
        }

        p.edit().putBoolean(KEY_PENDING, true).apply()
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
     */
    fun confirmBoot(ctx: Context) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (p.getBoolean(KEY_PENDING, false)) {
            p.edit().putBoolean(KEY_PENDING, false).apply()
            Log.i(TAG, "bundle confirmado")
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
        thread(name = "web-ota", isDaemon = true) {
            try { check(app) } catch (e: Exception) { Log.i(TAG, "sem atualização: ${e.message}") }
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
        val sha256 = meta.optString("sha256", "")
        Log.i(TAG, "baixando base web $version (atual: $current)")

        val tmpZip = File(ctx.cacheDir, "web-$version.zip")
        try {
            download(url, tmpZip)
            if (sha256.isNotBlank()) {
                val got = sha256Of(tmpZip)
                if (!got.equals(sha256, ignoreCase = true)) {
                    Log.w(TAG, "sha256 não confere — descartando download")
                    return
                }
            }

            val staging = File(baseDir(ctx), "staging-$version")
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
            // KEY_PENDING fica false: o watchdog só arma quando este bundle
            // for de fato servido, no próximo lançamento.
            p.edit().putString(KEY_ACTIVE, target.name).putBoolean(KEY_PENDING, false).apply()
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
