package br.org.iasd.av

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Mantém o app vivo enquanto há download em andamento.
 *
 * O PROBLEMA que isto resolve: ao minimizar o app, o Android trata o processo
 * como "cached" e pode congelá-lo — a sincronização de hinos, álbuns, Bíblia
 * ou pastas simplesmente parava no meio. Quem sincroniza um hinário inteiro
 * naturalmente sai do app enquanto espera, então isso acontecia justamente no
 * uso normal.
 *
 * A correção é declarar o trabalho ao sistema: enquanto este serviço estiver
 * em primeiro plano (com notificação visível, como o Android exige), o
 * processo não é congelado nem descartado, e o WebView continua baixando.
 *
 * O wake lock parcial complementa: impede que a CPU durma com a tela
 * apagada. Tem timeout de segurança — um download que trave nunca deve
 * consumir bateria indefinidamente.
 *
 * Ciclo de vida: quem liga e desliga é o LADO WEB (`AVNative.keepAlive`),
 * pelos pontos que sabem quando um download começa e termina. O serviço não
 * decide nada por conta própria.
 */
class SyncService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()
        ServiceCompat.startForeground(
            this,
            NOTIF_ID,
            buildNotification(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            } else {
                0
            },
        )
        acquireWakeLock()
        // NOT_STICKY: se o sistema matar o serviço, não faz sentido recriá-lo
        // sozinho — sem o WebView vivo não há download para acompanhar.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AvIasd:sync").apply {
            setReferenceCounted(false)
            acquire(WAKELOCK_TIMEOUT_MS)
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        // IMPORTANCE_LOW: a notificação precisa existir (exigência do sistema
        // para um serviço em primeiro plano), mas não deve tocar som nem
        // aparecer como alerta — é só um indicador discreto.
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Sincronização",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Mantém os downloads ativos com o app minimizado"
            setShowBadge(false)
        }
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification = buildNotification(this, progress)

    companion object {
        private const val TAG = "SyncService"
        private const val CHANNEL_ID = "sync"
        private const val NOTIF_ID = 1
        private const val WAKELOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000L // 2 h

        /** O que está baixando agora, reportado pelo lado web. */
        data class Progress(val label: String, val done: Int, val total: Int, val etaMs: Long)

        @Volatile
        private var progress: Progress? = null

        /**
         * Atualiza a notificação com o progresso real (ver
         * `NativeBridge.bgProgress`). Chamado de uma thread do WebView, então
         * não toca em nada de UI — `NotificationManager.notify` é seguro.
         *
         * Não chama `startForeground`: o serviço já está em primeiro plano
         * (quem o liga é `keepAlive`, antes de qualquer progresso existir).
         * Se ele não estiver rodando, a notificação simplesmente não aparece —
         * e não deve mesmo, porque não há trabalho declarado.
         */
        fun updateProgress(ctx: Context, label: String, done: Int, total: Int, etaMs: Long) {
            progress = Progress(label, done, total, etaMs)
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            try {
                nm.notify(NOTIF_ID, buildNotification(ctx, progress))
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível atualizar a notificação", e)
            }
        }

        /**
         * Tempo restante, arredondado para não fingir precisão que a
         * estimativa não tem (ela vem do ritmo médio, e faixas têm tamanhos
         * diferentes). "resta/restam" resolve a concordância em todos os
         * casos, inclusive "restam 1h30" — que com "cerca de … restante(s)"
         * saía errado em algum deles.
         */
        private fun formatEta(ms: Long): String {
            if (ms <= 0) return ""
            val s = ms / 1000
            if (s < 45) return "resta menos de 1 min"
            val min = Math.round(s / 60.0).toInt()
            if (min < 60) return if (min == 1) "resta 1 min" else "restam $min min"
            val h = min / 60
            val r = min % 60
            return "restam ${h}h" + (if (r > 0) String.format("%02d", r) else "")
        }

        private fun buildNotification(ctx: Context, p: Progress?): Notification {
            val open = Intent(ctx, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pending = android.app.PendingIntent.getActivity(
                ctx,
                0,
                open,
                android.app.PendingIntent.FLAG_IMMUTABLE,
            )
            val b = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pending)

            if (p == null || p.total <= 0) {
                // Antes de o primeiro progresso chegar (ou num bundle web mais
                // antigo que a ponte): o texto estático de sempre.
                return b
                    .setContentTitle("Baixando mídias")
                    .setContentText("A sincronização continua com o app minimizado.")
                    .build()
            }
            val pct = (p.done.coerceAtMost(p.total) * 100) / p.total
            val eta = formatEta(p.etaMs)
            val linha = "${p.done} de ${p.total}" + (if (eta.isNotEmpty()) " · $eta" else "")
            return b
                .setContentTitle(if (p.label.isNotEmpty()) p.label else "Baixando mídias")
                .setContentText(linha)
                .setSubText("$pct%")
                .setProgress(p.total, p.done.coerceAtMost(p.total), false)
                .build()
        }

        fun start(ctx: Context) {
            val intent = Intent(ctx, SyncService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        fun stop(ctx: Context) {
            progress = null
            ctx.stopService(Intent(ctx, SyncService::class.java))
        }
    }
}
