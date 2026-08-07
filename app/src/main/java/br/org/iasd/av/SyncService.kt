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
import java.util.Locale

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
 * decide nada por conta própria — com UMA exceção que não é escolha dele: a
 * cota de 6 h/24 h de FGS `dataSync` do Android 15, em que o sistema manda
 * parar e o serviço obedece (ver `onTimeout`).
 *
 * A notificação segue o serviço, e não o contrário: `updateProgress` publica
 * apenas enquanto ele existir. `NotificationManager.notify` é independente do
 * ciclo de vida de um Service, então sem essa guarda um cartão "Baixando
 * mídias" com `setOngoing(true)` ficava na gaveta para sempre, sem download
 * nenhum por trás.
 */
class SyncService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        // `running` é o que autoriza [updateProgress] a publicar. Marcado aqui,
        // no onCreate, e não no onStartCommand: a notificação só pode existir
        // enquanto ESTE serviço existir, e é a existência do serviço (não a
        // entrega de um comando) que define isso.
        running = true
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()
        // `startForeground` SEMPRE, antes de qualquer decisão de parar: um
        // serviço iniciado por `startForegroundService` que morre sem ter
        // chamado isto faz o sistema derrubar o app inteiro ("did not then call
        // Service.startForeground()") — e o processo é o dos dois WebViews e da
        // `Presentation` na TV.
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
        foregrounded = true
        // O DOWNLOAD PODE TER ACABADO ENQUANTO O SERVIÇO SUBIA: um item já
        // baixado faz `withBgWork()` ligar e desligar a proteção em poucos
        // milissegundos, e o `keepAlive(false)` chega antes do `onStartCommand`
        // do `keepAlive(true)`. Ali o [stop] não tem serviço para derrubar (ver
        // a explicação lá), então quem se despede é o próprio serviço — depois
        // do `startForeground` acima, e sem tomar o wake lock de 2 h que
        // ninguém mais liberaria.
        if (!wanted) {
            Log.i(TAG, "download encerrado antes de o serviço subir — parando")
            stopSelf(startId)
            return START_NOT_STICKY
        }
        acquireWakeLock()
        // NOT_STICKY: se o sistema matar o serviço, não faz sentido recriá-lo
        // sozinho — sem o WebView vivo não há download para acompanhar.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        // Antes de qualquer outra coisa: com `running` já falso, uma chamada de
        // `updateProgress` que chegue durante a destruição não republica um
        // cartão que ninguém mais vai cancelar.
        running = false
        foregrounded = false
        instance = null
        releaseWakeLock()
        // O sistema remove a notificação do serviço em primeiro plano ao
        // destruí-lo, mas o cancelamento explícito cobre o caso em que ela foi
        // postada por `updateProgress` — que usa `notify`, não `startForeground`,
        // e portanto não está amarrada ao ciclo de vida por construção.
        try {
            getSystemService(NotificationManager::class.java)?.cancel(NOTIF_ID)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível remover a notificação", e)
        }
        super.onDestroy()
    }

    /**
     * Cota de FGS do Android 15: um app com `targetSdk` 35 tem teto de 6 h
     * acumuladas em 24 h para serviços do tipo `dataSync`. Atingido o teto, o
     * sistema chama isto e dá poucos segundos para o serviço parar — sem o
     * override, ele derruba o processo por ANR, e esse processo é o dos DOIS
     * WebViews e da `Presentation` na TV.
     *
     * O acumulado não é hipotético: configurar um aparelho novo soma hinário
     * completo, uma versão da Bíblia (1189 capítulos) e a cópia de pastas de
     * vídeo, tudo numa rede de igreja.
     *
     * Parar aqui é a única resposta possível — mas o lado Kotlin precisa
     * ESQUECER que estava protegendo, senão o `if (on == backgroundWork)` da
     * Activity trata o próximo `keepAlive(true)` como repetido e o download
     * seguinte fica sem proteção nenhuma, calado. Daí o [onGone].
     *
     * O método só existe a partir da API 35; em aparelhos anteriores este
     * override é código morto (o sistema nunca o chama), que é exatamente o
     * comportamento desejado — lá não há cota.
     */
    override fun onTimeout(startId: Int, fgsType: Int) {
        Log.w(TAG, "cota de foreground service esgotada — encerrando a proteção")
        releaseWakeLock()
        stopSelf()
        // O outro lado (o hook da MainActivity) compara um token de geração
        // antes de zerar `backgroundWork`: um `keepAlive(true)` novo que entre
        // entre este aviso e o runnable dele não pode ser apagado por um estado
        // que já era de outro download.
        onGone?.invoke()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        // `setReferenceCounted(false)` não é enfeite: é o que permite ao
        // [renewWakeLock] repetir o `acquire` sem acumular uma contagem que um
        // único `release` não devolveria.
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AvIasd:sync").apply {
            setReferenceCounted(false)
            acquire(WAKELOCK_TIMEOUT_MS)
        }
        lastRenewMs = android.os.SystemClock.elapsedRealtime()
    }

    /** Última renovação do wake lock (elapsedRealtime). Só [updateProgress]
     *  (sempre a mesma thread do WebView) escreve depois do acquire. */
    @Volatile
    private var lastRenewMs = 0L

    /**
     * RENOVA o wake lock enquanto há progresso REAL chegando.
     *
     * O timeout de 2 h é a defesa contra download TRAVADO — e continua sendo.
     * Mas um download legítimo maior que isso (hinário + Bíblia + pastas na
     * rede da igreja) perdia a proteção em silêncio: o lock expirava, a CPU
     * cochilava com a tela apagada e a rede estagnava — exatamente o
     * "sem resposta há X" que a notificação existe para denunciar, só que
     * fabricado por nós. Quem chama é [updateProgress], que É o sinal de
     * progresso; o piso de [WAKELOCK_RENEW_MIN_MS] evita reacionar o
     * PowerManager a cada tick de notificação. Com `setReferenceCounted(false)`
     * o `acquire` repetido apenas reinicia o cronômetro — nada vaza.
     */
    private fun renewWakeLock() {
        val wl = wakeLock ?: return
        val agora = android.os.SystemClock.elapsedRealtime()
        if (agora - lastRenewMs < WAKELOCK_RENEW_MIN_MS) return
        lastRenewMs = agora
        try {
            wl.acquire(WAKELOCK_TIMEOUT_MS)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível renovar o wake lock", e)
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
        /** Piso entre renovações do wake lock (ver [renewWakeLock]). */
        private const val WAKELOCK_RENEW_MIN_MS = 10 * 60 * 1000L // 10 min

        /**
         * O que está baixando agora, reportado pelo lado web. `items` traz UM
         * nome em destaque: são 6 downloads simultâneos, mas o lado web os
         * serializa numa FILA (FIFO) — cada nome sai uma única vez, na ordem em
         * que entrou em download, escoado no ritmo MÉDIO medido por item (ver
         * `bgItemStart`/`bgSpinMs` em controle.js). Não é rodízio: um nome
         * nunca reaparece, e a lista não espelha o que está no ar agora.
         * Quando a tarefa passa de 90 s sem evento real (o mesmo [STALL_MS]
         * daqui) a fila CONGELA de propósito — animar durante uma queda de rede
         * esconderia justamente o que precisa ser visto.
         *
         * `idleMs` é há quanto tempo nada acontece.
         */
        data class Progress(
            val label: String,
            val done: Long,
            val total: Long,
            val etaMs: Long,
            val items: List<String> = emptyList(),
            val idleMs: Long = 0,
            /**
             * `done`/`total` são BYTES, e não uma contagem de itens.
             *
             * O registro de tarefas do lado web nasceu contando ITENS (54
             * músicas, 1189 capítulos), e para um lote isso é a unidade certa.
             * Mas o download de UM vídeo do YouTube abria a tarefa com
             * `total = 1`: a barra ficava em 0% do início ao fim e a estimativa
             * era literalmente zero, porque ela precisa de pelo menos um item
             * concluído para ter uma média. Ou seja, o único caso em que a
             * notificação é a ÚNICA janela para o download — app minimizado,
             * centenas de MB — era o caso em que ela não dizia nada.
             *
             * Os bytes sempre foram conhecidos (o `onProgresso` do shell os
             * reporta a cada MB); faltava um canal para eles. Como toda a
             * matemática de percentual e de ETA é uma razão, ela funciona
             * igual nas duas unidades — só a APRESENTAÇÃO muda, e é isso que
             * esta bandeira decide.
             */
            val bytes: Boolean = false,
        )

        /**
         * A partir daqui a notificação para de prometer um tempo restante e
         * passa a dizer que nada acontece. 90 s é bem mais que a faixa mais
         * pesada do acervo e que qualquer reconexão normal de Wi-Fi — abaixo
         * disso o aviso apareceria no uso saudável e viraria ruído.
         */
        private const val STALL_MS = 90_000L

        @Volatile
        private var progress: Progress? = null

        /**
         * O serviço existe AGORA (entre `onCreate` e `onDestroy`).
         *
         * `NotificationManager.notify` não tem relação nenhuma com o ciclo de
         * vida de um Service: o canal sobrevive ao serviço, e um `notify` com
         * `setOngoing(true)` publica um cartão que ninguém mais cancela. Sem
         * este flag, uma única chamada de [updateProgress] fora de uma janela de
         * `keepAlive` deixava um "Baixando mídias" permanente e não-dispensável
         * na gaveta, sem download nenhum por trás — no meio do culto.
         */
        @Volatile
        private var running = false

        /**
         * O lado web QUER a proteção agora (entre [start] e [stop]).
         *
         * Separado de [running] porque responde a outra pergunta: `running` diz
         * se o serviço existe, `wanted` diz se ele ainda deveria existir. É o
         * que permite ao `onStartCommand` descobrir que o download já acabou
         * enquanto ele subia — e se despedir sozinho, em vez de o [stop] tentar
         * derrubar um serviço que ainda nem chamou `startForeground`.
         */
        @Volatile
        private var wanted = false

        /**
         * `startForeground` já foi chamado por este serviço.
         *
         * Enquanto for falso existe um `startForegroundService` PENDENTE, e
         * derrubar o serviço nessa janela é o que faz o sistema matar o app por
         * "did not then call Service.startForeground()". `running` não serve
         * para isso: é marcado no `onCreate`, que roda ANTES do
         * `onStartCommand` onde o `startForeground` de fato acontece.
         */
        @Volatile
        private var foregrounded = false

        /** A instância viva (entre `onCreate` e `onDestroy`) — é por ela que
         *  [updateProgress] renova o wake lock quando há progresso real. */
        @Volatile
        private var instance: SyncService? = null

        /**
         * Avisa que o serviço morreu por conta própria (cota de FGS do
         * Android 15 — ver `onTimeout`). Definido pela [MainActivity], que é
         * quem guarda o espelho desse estado em Kotlin — e que compara um
         * token de geração antes de zerá-lo (ver o hook lá).
         */
        @Volatile
        var onGone: (() -> Unit)? = null

        /**
         * Atualiza a notificação com o progresso real (ver
         * `NativeBridge.bgProgress`). Chamado de uma thread do WebView, então
         * não toca em nada de UI — `NotificationManager.notify` é seguro.
         *
         * Não chama `startForeground`: quando o serviço está de pé ele já é o
         * dono da notificação (quem o liga é `keepAlive`, antes de qualquer
         * progresso existir), e aqui só se refaz o conteúdo.
         *
         * **Com o serviço parado nada é publicado** — e uma sobra de cartão é
         * cancelada. Isto é uma GUARDA, não uma consequência: a chamada vem do
         * lado web, que pode reportar progresso fora de qualquer janela de
         * trabalho (um pacer que vazou, um bundle antigo, uma tarefa que
         * terminou entre o último tick e este). Publicar nesse estado criava um
         * download eterno na tela do operador.
         *
         * O progresso é guardado ANTES da guarda de propósito: entre o
         * `startForegroundService` e o `onCreate` do serviço existe uma janela
         * real, e o que chegar nela precisa aparecer no primeiro
         * `startForeground`, não ser jogado fora.
         */
        fun updateProgress(
            ctx: Context,
            label: String,
            done: Long,
            total: Long,
            etaMs: Long,
            items: List<String> = emptyList(),
            idleMs: Long = 0,
            bytes: Boolean = false,
        ) {
            progress = Progress(label, done, total, etaMs, items, idleMs, bytes)
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            try {
                if (!running) {
                    nm.cancel(NOTIF_ID)
                    return
                }
                nm.notify(NOTIF_ID, buildNotification(ctx, progress))
                // Progresso real chegando = download vivo: renova o wake lock,
                // para um download LEGÍTIMO de mais de 2 h não perder a
                // proteção em silêncio (ver [renewWakeLock]).
                instance?.renewWakeLock()
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível atualizar a notificação", e)
            }
        }

        /**
         * Tempo restante, arredondado EM DEGRAUS crescentes — de 1 min perto
         * do fim a 10 min quando falta mais de uma hora.
         *
         * Isso não é cosmético: a estimativa tem uma incerteza que cresce com
         * o horizonte, e mostrar "2h03" quando o erro real é de meia hora
         * promete uma precisão que não existe. Pior, ao minuto o número muda a
         * cada atualização e a leitura vira ruído — dois valores seguidos
         * diferentes parecem instabilidade mesmo quando a estimativa está
         * convergindo. Com degraus, ele fica parado enquanto a estimativa não
         * muda de verdade. A suavização do lado web (`bgTaskEta`) cuida da
         * outra metade: variar devagar; aqui é só variar de forma legível.
         *
         * "resta/restam" resolve a concordância em todos os casos, inclusive
         * "restam 1h30" — que com "cerca de … restante(s)" saía errado.
         */
        private fun formatEta(ms: Long): String {
            if (ms <= 0) return ""
            val s = ms / 1000
            if (s < 45) return "resta menos de 1 min"
            var min = Math.round(s / 60.0).toInt()
            val degrau = when {
                min < 10 -> 1
                min < 60 -> 5
                else -> 10
            }
            min = Math.max(degrau, (min / degrau) * degrau)
            if (min < 60) return if (min == 1) "resta 1 min" else "restam $min min"
            val h = min / 60
            val r = min % 60
            return "restam ${h}h" + (if (r > 0) String.format("%02d", r) else "")
        }

        /**
         * Há quanto tempo nada acontece. Sem degraus, ao contrário do
         * [formatEta]: aqui o número PRECISA subir a cada atualização — é
         * justamente vê-lo crescer que diz "isto não está andando".
         */
        private fun formatIdle(ms: Long): String {
            val min = ms / 60_000
            if (min < 1) return "${ms / 1000} s"
            if (min < 60) return "$min min"
            val h = min / 60
            return "${h}h" + String.format("%02d", min % 60)
        }

        /**
         * "284 MB", "1,4 GB" — o tamanho como o operador o reconhece.
         *
         * Uma casa decimal só a partir de GB: "284,3 MB" muda de dígito a cada
         * atualização e vira ruído numa linha que já tem percentual e tempo,
         * enquanto em GB a casa é a diferença entre "1 GB" e "1,9 GB", que é
         * grande demais para esconder. Vírgula porque a notificação está em
         * português; o resto do app escreve assim.
         */
        private fun formatBytes(n: Long): String {
            val kb = 1024.0
            val mb = kb * 1024
            val gb = mb * 1024
            return when {
                n >= gb -> String.format(Locale("pt", "BR"), "%.1f GB", n / gb)
                n >= mb -> "${Math.round(n / mb)} MB"
                n >= kb -> "${Math.round(n / kb)} kB"
                else -> "$n B"
            }
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
            val feito = p.done.coerceIn(0, p.total)
            val pct = ((feito * 100) / p.total).toInt()
            val parado = p.idleMs >= STALL_MS

            // Com o download parado, o tempo restante vira ficção: ele foi
            // calculado sobre um ritmo que não existe mais, e continuar
            // mostrando "restam 40 min" enquanto nada anda é a promessa mais
            // enganosa que esta notificação pode fazer. Melhor dizer o que de
            // fato se sabe — que faz X sem novidade.
            val cauda = if (parado) "sem resposta há ${formatIdle(p.idleMs)}" else formatEta(p.etaMs)
            val quanto = if (p.bytes) {
                "${formatBytes(feito)} de ${formatBytes(p.total)}"
            } else {
                "${p.done} de ${p.total}"
            }
            // O PERCENTUAL NA FRENTE (v1.61). Ele vinha no fim de uma linha que
            // já trazia dois tamanhos e um tempo restante, dentro do subtexto —
            // que é o pedaço que o Android encurta primeiro, e é curto de
            // qualquer jeito. Ou seja: o número que responde "quanto falta?" em
            // uma leitura era o primeiro a sumir. Ele é a resposta mais barata
            // que esta notificação dá; os tamanhos são o detalhe que a
            // qualifica, não o contrário.
            val contagem = "$pct% · $quanto" + (if (cauda.isNotEmpty()) " · $cauda" else "")

            // A LINHA PRINCIPAL é o nome do que está baixando agora, não o
            // número: "23 de 54" é abstrato, "002. Ó Adorai o Senhor" é o que o
            // operador reconhece — e vê-lo TROCAR é o que mostra que a coisa
            // anda. São 6 downloads ao mesmo tempo, mas passam por aqui um de
            // cada vez, numa FILA do lado web (cada nome sai uma única vez, em
            // ordem, no ritmo médio medido por item): seis nomes parados lado a
            // lado não transmitiam a troca, e serializados os mesmos 6 rendem
            // seis vezes mais movimento na linha. A contagem e o tempo vão para
            // o subtexto (cabeçalho da notificação), sempre visíveis.
            val atual = p.items.firstOrNull()
            b.setContentTitle(if (p.label.isNotEmpty()) p.label else "Baixando mídias")
                .setContentText(atual ?: contagem)
                // Sem repetir: quando não há nome de item, a linha principal já
                // É a contagem — e ela começa pelo percentual.
                .setSubText(if (atual != null) contagem else "$pct%")
                // EM MILÉSIMOS, e não nas unidades cruas: `setProgress` recebe
                // `Int`, e um total em bytes passa de 2 GB num vídeo de 1080p —
                // o estouro faria a barra andar para trás. A resolução de 1/1000
                // é muito além do que uma barra de notificação distingue.
                .setProgress(1000, ((feito * 1000) / p.total).toInt(), false)
            return b.build()
        }

        fun start(ctx: Context) {
            wanted = true
            val intent = Intent(ctx, SyncService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        /**
         * O `wanted = false` é a parte que sempre acontece — é ele que fecha a
         * janela do serviço que ainda está SUBINDO: o `onStartCommand` o lê e
         * se despede sozinho, depois de cumprir o `startForeground` que o
         * sistema exige.
         *
         * `stopService` só entra quando o serviço JÁ está em primeiro plano.
         * Chamá-lo com um `startForegroundService` pendente é o caminho
         * conhecido para o app ser morto por "did not then call
         * Service.startForeground()" — e uma sincronização de item já baixado
         * liga e desliga a proteção em poucos milissegundos, que é exatamente
         * essa janela.
         */
        fun stop(ctx: Context) {
            wanted = false
            progress = null
            if (foregrounded) ctx.stopService(Intent(ctx, SyncService::class.java))
            // `stopService` é assíncrono e, quando o serviço nem chegou a
            // existir, não há `onDestroy` nenhum para limpar. Cancelar aqui
            // também é o que remove um cartão postado por [updateProgress] —
            // que usa `notify` e portanto NÃO desaparece junto com o serviço.
            try {
                ctx.getSystemService(NotificationManager::class.java)?.cancel(NOTIF_ID)
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível remover a notificação", e)
            }
        }
    }
}
