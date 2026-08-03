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
        // Publica SEMPRE, e ANTES de qualquer decisão de parar: um serviço
        // iniciado por `startForegroundService` DEVE chamar `startForeground`.
        // Sair sem isso não satisfaz a exigência — o `bringDownServiceLocked`
        // do sistema ainda encontra o pedido pendente e derruba o app inteiro
        // ("Context.startForegroundService() did not then call
        // Service.startForeground()"), levando junto os dois WebViews e a
        // projeção. Publicar primeiro custa uma notificação de alguns
        // milissegundos; a alternativa custa o culto.
        publish()

        // A CENA PODE TER ACABADO ENQUANTO O SERVIÇO SUBIA. `nowPlaying` e
        // `stop` chegam da thread do WebView: publicar uma cena dispara
        // `startForegroundService`, e o `active:false` que vem logo atrás (o
        // operador toca em Parar, ou a cena esvazia) chega ANTES de o serviço
        // existir. Sem esta guarda o serviço nascia depois disso e ficava de pé
        // com "Nada em exibição" — e nada mais chamaria `stop()`, porque o lado
        // web deduplica por chave e não reenvia o `active:false`.
        //
        // `stopSelf(startId)` e não `stopSelf()`: se outro comando (uma cena
        // nova) já estiver na fila, ele tem `startId` maior e o pedido de
        // parada é ignorado, como manda o contrato do Service.
        if (scene == null) {
            Log.i(TAG, "sessão encerrada antes de o serviço subir — parando")
            stopSelf(startId)
            return START_NOT_STICKY
        }
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
                            // O ÍCONE diz o ESTADO (telão coberto = imagem
                            // riscada) e o RÓTULO diz a ação — a mesma divisão
                            // que a base web adotou na v5.50. Até lá o ícone
                            // também era a ação, e a inversão do lado web
                            // deixaria o MESMO símbolo significando coisas
                            // opostas na tela e na notificação, que é
                            // exatamente o defeito que a convenção existe para
                            // evitar. Na tela quem carrega o estado é a cor;
                            // aqui, onde não há cor de estado, é o ícone —
                            // e o rótulo, que a notificação tem e a tela não,
                            // continua nomeando o que o toque faz.
                            if (s.wallpaper) R.drawable.ic_image_off else R.drawable.ic_image,
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
        // Marco da extrapolação: é contra isto que `updateFromDisplay` decide
        // se o tempo do telão é um salto ou só o relógio andando.
        lastPubPosMs = s.positionMs
        lastPubAt = android.os.SystemClock.elapsedRealtime()
        lastPubPlaying = s.playing

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
            /** Como o operador CHAMA o que ⏮/⏭ passam agora: "estrofe" numa
             *  letra, "página" numa apresentação. Vazio = o padrão de sempre. */
            val slideLabel: String = "",
            val wallpaper: Boolean = false,
            val positionMs: Long = 0,
            val durationMs: Long = 0,
        )

        @Volatile
        private var scene: Scene? = null

        @Volatile
        private var running = false

        /**
         * `startForeground` já foi chamado por este serviço.
         *
         * Fica no companion (e não na instância) porque quem precisa dele é o
         * [stop]: enquanto ele for falso, existe um `startForegroundService`
         * PENDENTE, e derrubar o serviço nessa janela é o que faz o sistema
         * matar o app por "did not then call Service.startForeground()".
         * `running` não serve para isso — é marcado no `onCreate`, que roda
         * antes do `onStartCommand` onde o `startForeground` de fato acontece.
         */
        @Volatile
        private var foregrounded = false

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

        /**
         * Tolerância antes de republicar por causa da posição — mesma ideia (e
         * mesmo valor) do `POS_TOL_MS` do lado web: a sessão extrapola o tempo
         * sozinha, então só um SALTO precisa de reenvio. Absorve o jitter do
         * `display-status`, que chega com latência variável.
         */
        private const val POS_TOL_MS = 1500L

        @Volatile private var lastPubPosMs = 0L
        @Volatile private var lastPubAt = 0L
        @Volatile private var lastPubPlaying = false

        /**
         * Estado vindo do TELÃO (ver `NativeBridge.snoopDisplayStatus`). Só
         * corrige play/pause, posição e duração — o resto da cena continua
         * sendo do lado web.
         *
         * Sem cena publicada não faz nada: o telão pode estar emitindo status
         * de uma reprodução que o Controle ainda nem reportou, e a notificação
         * nasceria sem título nenhum.
         */
        fun updateFromDisplay(ctx: Context, playing: Boolean, positionMs: Long, durationMs: Long) {
            val s = scene ?: return
            val dur = if (durationMs > 0) durationMs else s.durationMs
            // Mesma economia do lado web: em reprodução contínua a sessão
            // extrapola sozinha, então só vale reenviar quando o play/pause
            // muda, a duração muda ou o tempo real destoa do extrapolado.
            val extrapolado = if (lastPubAt == 0L) null else {
                lastPubPosMs + if (lastPubPlaying) android.os.SystemClock.elapsedRealtime() - lastPubAt else 0L
            }
            val saltou = extrapolado == null || Math.abs(positionMs - extrapolado) > POS_TOL_MS
            if (playing == s.playing && dur == s.durationMs && !saltou) return
            scene = s.copy(playing = playing, positionMs = positionMs, durationMs = dur)
            instance?.publish()
        }

        /**
         * Sem cena: derruba o serviço, e a notificação vai junto.
         *
         * O `scene = null` é a parte que sempre acontece — é ele que fecha a
         * janela do serviço que ainda está SUBINDO: o `onStartCommand` lê a
         * cena, encontra `null` e se despede sozinho (depois de chamar
         * `startForeground`, como o sistema exige).
         *
         * `stopService` só entra quando o serviço JÁ está em primeiro plano.
         * Chamá-lo com um `startForegroundService` pendente é o caminho
         * conhecido para o app ser morto por "did not then call
         * Service.startForeground()" — o sistema derruba o serviço com o
         * pedido ainda armado e cobra a dívida do processo, que é o dos dois
         * WebViews e da `Presentation`. Perder a notificação de controles seria
         * um arranhão; perder a projeção, não.
         */
        fun stop(ctx: Context) {
            scene = null
            if (!foregrounded) return
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
            val unidade = s.slideLabel.ifBlank { "estrofe" }
            val rotuloPrev = if (s.slideMode) "Anterior ($unidade)" else "Anterior"
            val rotuloNext = if (s.slideMode) "Próxima ($unidade)" else "Próxima"

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
                        // Ícone = estado, rótulo = ação (ver a custom action
                        // acima). Estes `Notification.Action` são decoração a
                        // partir do Android 13, mas precisam concordar com ela.
                        if (s.wallpaper) R.drawable.ic_image_off else R.drawable.ic_image,
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
