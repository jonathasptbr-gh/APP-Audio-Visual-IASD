package br.org.iasd.av

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ServiceCompat

/**
 * Ponte de mão dupla entre o sistema (notificação, tela de bloqueio, botões de
 * mídia) e o Controle, que vive dentro do WebView. O toque entra por aqui e sai
 * como uma string de ação; quem executa continua sendo o JS.
 *
 * Deliberadamente burro: NÃO decide nada sobre playlist, letra ou transporte —
 * é a invariante 5 do projeto (não reimplementar em Kotlin o que já existe em
 * JS). O `onAction` só entrega a ação a `window.__avRemote`, que aciona os
 * MESMOS handlers dos botões da tela.
 *
 * É também por isso que nenhuma ação é desabilitada aqui: quem sabe se "estrofe
 * anterior" faz sentido agora é o lado web, e lá isso já é um no-op natural
 * (botão `disabled`, limite de lista, texto sem áudio de fundo). Desabilitar em
 * dois lugares seria duplicar a regra — e a cópia em Kotlin envelheceria.
 */
object SessionRemote {

    const val PLAY = "play"
    const val PAUSE = "pause"
    const val PLAY_PAUSE = "playpause"
    const val PREV = "prev"
    const val NEXT = "next"
    const val STOP = "stop"
    const val VIEW = "view"

    /** Definido pela [MainActivity] enquanto ela existe; nulo depois. */
    @Volatile
    var onAction: ((String) -> Unit)? = null

    fun send(action: String) {
        onAction?.invoke(action)
    }
}

/**
 * Sessão de mídia + notificação com controles de transporte.
 *
 * DOIS ganhos, e o segundo é o menos óbvio:
 *
 * 1. **Controlar sem abrir o app.** No modo "mesa de som" o celular está ligado
 *    na caixa de som e provavelmente bloqueado; abrir o app só para pausar é
 *    atrito real no meio de um culto. Com [MediaSession] os controles aparecem
 *    também na tela de bloqueio e nas configurações rápidas, de graça.
 *
 * 2. **A projeção deixa de ser descartável.** Antes disto, o único serviço em
 *    primeiro plano do app era o [SyncService], que só sobe DURANTE downloads.
 *    Num culto normal não havia nenhum: o `moveTaskToBack` do botão voltar
 *    mantém a Activity, mas o processo continuava candidato a ser morto sob
 *    pressão de memória — levando junto a `Presentation` na TV. Um serviço em
 *    primeiro plano do tipo `mediaPlayback`, ativo enquanto houver cena no ar,
 *    fecha esse buraco.
 *
 * O serviço vive enquanto houver CENA (mídia carregada, letra, versículo ou
 * mensagem no ar), não só enquanto estiver tocando — pausado, a notificação
 * precisa continuar lá para o operador poder dar play. Sem cena, ele para e a
 * notificação some.
 */
class SessionService : Service() {

    private var session: MediaSession? = null
    private var foregrounded = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        session = MediaSession(this, "AvIasd").apply {
            setCallback(object : MediaSession.Callback() {
                // onPlay/onPause chegam de fontes que SABEM o que querem (tela
                // de bloqueio, fone, Android Auto), então viram intenção
                // explícita. O botão da notificação, esse sim, é um alternador.
                override fun onPlay() = SessionRemote.send(SessionRemote.PLAY)
                override fun onPause() = SessionRemote.send(SessionRemote.PAUSE)
                override fun onStop() = SessionRemote.send(SessionRemote.STOP)
                override fun onSkipToPrevious() = SessionRemote.send(SessionRemote.PREV)
                override fun onSkipToNext() = SessionRemote.send(SessionRemote.NEXT)

                // Parar e a cortina do wallpaper chegam por aqui, não pelos
                // PendingIntent das Notification.Action — ver o comentário em
                // [publish] sobre quem desenha os botões no Android 13+.
                override fun onCustomAction(action: String, extras: android.os.Bundle?) =
                    SessionRemote.send(action)
            })
            isActive = true
        }
        instance = this
        running = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Publica SEMPRE, inclusive quando o intent é o toque de um botão: um
        // serviço iniciado por startForegroundService tem poucos segundos para
        // chamar startForeground, ou o sistema o derruba.
        publish()
        val action = intent?.action
        if (action != null && action.startsWith(ACTION_PREFIX)) {
            SessionRemote.send(action.removePrefix(ACTION_PREFIX))
        }
        // NOT_STICKY: sem o WebView vivo não há cena para controlar; recriar o
        // serviço sozinho só deixaria uma notificação órfã.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        session?.let {
            it.isActive = false
            it.release()
        }
        session = null
        instance = null
        running = false
        foregrounded = false
        super.onDestroy()
    }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

    /** Espelha a cena atual na sessão de mídia e na notificação. */
    private fun publish() {
        // `update` é chamado da thread do WebView (todo @JavascriptInterface
        // roda fora da main). `MediaSession` tem handler próprio e não promete
        // ser thread-safe — mexer nele de outra thread é o tipo de coisa que
        // funciona num aparelho e falha calado noutro.
        if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) {
            mainHandler.post { publish() }
            return
        }
        val s = scene ?: Scene()
        session?.let { ms ->
            ms.setMetadata(
                MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, s.title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, s.subtitle)
                    // Duração desconhecida vira -1: é assim que o sistema
                    // entende "sem barra de posição". Com 0 ele desenha uma
                    // barra zerada, que se lê como travada — e imagem, texto
                    // bíblico e mensagem não têm duração nenhuma.
                    .putLong(
                        MediaMetadata.METADATA_KEY_DURATION,
                        if (s.durationMs > 0) s.durationMs else -1L,
                    )
                    .build(),
            )
            // A partir do Android 13 o sistema DESENHA os controles a partir
            // deste PlaybackState — as `Notification.Action` abaixo são
            // ignoradas nessas versões. Por isso "Parar" e a cortina precisam
            // ser CUSTOM ACTIONS da sessão: como Notification.Action elas
            // simplesmente não apareciam, e só sobravam os botões nativos.
            ms.setPlaybackState(
                PlaybackState.Builder()
                    .setActions(
                        PlaybackState.ACTION_PLAY or
                            PlaybackState.ACTION_PAUSE or
                            PlaybackState.ACTION_PLAY_PAUSE or
                            PlaybackState.ACTION_STOP or
                            PlaybackState.ACTION_SKIP_TO_PREVIOUS or
                            PlaybackState.ACTION_SKIP_TO_NEXT,
                    )
                    .addCustomAction(
                        PlaybackState.CustomAction.Builder(
                            SessionRemote.VIEW,
                            if (s.wallpaper) "Mostrar mídia" else "Cobrir telão",
                            android.R.drawable.ic_menu_view,
                        ).build(),
                    )
                    .addCustomAction(
                        PlaybackState.CustomAction.Builder(
                            SessionRemote.STOP,
                            "Parar",
                            android.R.drawable.ic_menu_close_clear_cancel,
                        ).build(),
                    )
                    .setState(
                        if (s.playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
                        s.positionMs,
                        if (s.playing) 1f else 0f,
                    )
                    .build(),
            )
        }
        val notif = buildNotification(this, s, session)
        if (foregrounded) {
            getSystemService(NotificationManager::class.java)?.notify(NOTIF_ID, notif)
        } else {
            ServiceCompat.startForeground(
                this,
                NOTIF_ID,
                notif,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                } else {
                    0
                },
            )
            foregrounded = true
        }
    }

    private fun ensureChannel() {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        // IMPORTANCE_LOW: controles são um painel, não um alerta — nada de som
        // nem heads-up no meio de um culto.
        val ch = NotificationChannel(CHANNEL_ID, "Projeção", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Controles do que está no ar"
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        nm.createNotificationChannel(ch)
    }

    companion object {
        private const val TAG = "SessionService"
        private const val CHANNEL_ID = "session"
        private const val NOTIF_ID = 2   // 1 é do SyncService — as duas coexistem
        private const val ACTION_PREFIX = "br.org.iasd.av.remote."

        /**
         * O que está no ar, reportado pelo lado web (`pushNowPlaying` em
         * controle.js). `slideMode` decide o que ⏮/⏭ significam — ver
         * [buildNotification].
         */
        data class Scene(
            val title: String = "Nada em exibição",
            val subtitle: String = "",
            val playing: Boolean = false,
            val slideMode: Boolean = false,
            val wallpaper: Boolean = false,
            val positionMs: Long = 0,
            val durationMs: Long = 0,
        )

        @Volatile
        private var scene: Scene? = null

        @Volatile
        private var running = false

        @Volatile
        private var instance: SessionService? = null

        /** Há cena no ar: sobe o serviço (se preciso) e atualiza a notificação. */
        fun update(ctx: Context, s: Scene) {
            scene = s
            val inst = instance
            if (running && inst != null) {
                inst.publish()
                return
            }
            try {
                val i = Intent(ctx, SessionService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ctx.startForegroundService(i)
                } else {
                    ctx.startService(i)
                }
            } catch (e: Exception) {
                // Android 12+ recusa iniciar serviço em primeiro plano com o app
                // em segundo plano. Na prática a cena nasce de um toque na tela,
                // mas um avanço automático de playlist com o app minimizado e a
                // sessão já encerrada cairia aqui — sem notificação, e nada mais:
                // a projeção em si não depende deste serviço para funcionar.
                Log.w(TAG, "não foi possível iniciar a sessão", e)
            }
        }

        /** Sem cena: derruba o serviço, e a notificação vai junto. */
        fun stop(ctx: Context) {
            scene = null
            if (!running) return
            try {
                ctx.stopService(Intent(ctx, SessionService::class.java))
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível parar a sessão", e)
            }
        }

        private fun actionIntent(ctx: Context, action: String): PendingIntent {
            val i = Intent(ctx, SessionService::class.java).setAction(ACTION_PREFIX + action)
            return PendingIntent.getService(
                ctx,
                action.hashCode(),
                i,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        private fun acao(ctx: Context, icone: Int, rotulo: String, action: String): Notification.Action =
            Notification.Action.Builder(
                Icon.createWithResource(ctx, icone),
                rotulo,
                actionIntent(ctx, action),
            ).build()

        private fun buildNotification(ctx: Context, s: Scene, ms: MediaSession?): Notification {
            val abrir = PendingIntent.getActivity(
                ctx,
                0,
                Intent(ctx, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                },
                PendingIntent.FLAG_IMMUTABLE,
            )

            // ⏮/⏭ mudam de significado conforme o que está no ar. Na tela os dois
            // eixos têm botões próprios (mídia na linha de transporte, estrofe ao
            // lado da preview), mas aqui só cabem três no modo compacto — e com
            // uma letra, um versículo ou uma mensagem em cena é a estrofe que o
            // operador está passando. O rótulo diz qual é o modo, para não virar
            // adivinhação.
            val rotuloPrev = if (s.slideMode) "Anterior (estrofe)" else "Anterior"
            val rotuloNext = if (s.slideMode) "Próxima (estrofe)" else "Próxima"

            val b = Notification.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(s.title)
                .setContentText(s.subtitle)
                .setContentIntent(abrir)
                // O que está projetado já está numa TV à vista de todos —
                // esconder o título na tela de bloqueio não protegeria nada e
                // tiraria justamente a informação útil.
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                // Ongoing enquanto toca: evita que um deslize acidental tire o
                // painel de controle no meio do culto. Pausado ele é
                // dispensável, como manda o comportamento normal de um player.
                .setOngoing(s.playing)
                .addAction(acao(ctx, android.R.drawable.ic_media_previous, rotuloPrev, SessionRemote.PREV))
                .addAction(
                    acao(
                        ctx,
                        if (s.playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                        if (s.playing) "Pausar" else "Reproduzir",
                        SessionRemote.PLAY_PAUSE,
                    ),
                )
                .addAction(acao(ctx, android.R.drawable.ic_media_next, rotuloNext, SessionRemote.NEXT))
                .addAction(acao(ctx, android.R.drawable.ic_menu_close_clear_cancel, "Parar", SessionRemote.STOP))
                // Cortina do wallpaper: a ação mais usada num culto depois do
                // play/pause — tirar a mídia do telão sem parar o áudio.
                .addAction(
                    acao(
                        ctx,
                        android.R.drawable.ic_menu_view,
                        if (s.wallpaper) "Mostrar mídia" else "Cobrir telão",
                        SessionRemote.VIEW,
                    ),
                )

            val style = Notification.MediaStyle().setShowActionsInCompactView(0, 1, 2)
            if (ms != null) style.setMediaSession(ms.sessionToken)
            b.setStyle(style)
            return b.build()
        }
    }
}
