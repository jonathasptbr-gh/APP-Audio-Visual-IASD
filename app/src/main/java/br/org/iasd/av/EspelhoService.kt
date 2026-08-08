package br.org.iasd.av

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import org.json.JSONObject

/**
 * Mantém o processo vivo e VISÍVEL ao sistema enquanto o espelho serve.
 *
 * ## Por que um serviço NOVO, e não um campo a mais nos que já existem
 *
 * O [SyncService] existe enquanto há download e o [SessionService] enquanto há
 * cena no ar; o espelho não tem nada a ver com nenhum dos dois — ele liga por
 * ação do operador, desliga por ação do operador e vive por horas no meio.
 * Empilhar dono é o caminho conhecido para o cartão eterno que os dois já
 * aprenderam a evitar, e as regras de parada seriam três dentro de um `if`.
 *
 * ## O tipo é `connectedDevice`, e o pré-requisito dele derruba a primeira
 * Release de quem não o ler
 *
 * A documentação define `connectedDevice` como *"interactions with external
 * devices that require a Bluetooth, NFC, IR, USB, or **network** connection"* —
 * é exatamente isto — e ele **não tem cota**, ao contrário do `dataSync` (que
 * este app já gasta com hinário, Bíblia e pastas, com teto de 6 h/24 h) e do
 * `mediaProcessing`.
 *
 * **Mas ele exige, ALÉM de `FOREGROUND_SERVICE_CONNECTED_DEVICE`, pelo menos
 * uma de** `CHANGE_NETWORK_STATE` / `CHANGE_WIFI_STATE` /
 * `CHANGE_WIFI_MULTICAST_STATE` / `NFC` / `TRANSMIT_IR` (ou uma de Bluetooth/UWB
 * concedida em runtime, ou um `UsbManager.requestPermission()`). `INTERNET` e
 * `ACCESS_NETWORK_STATE` **não estão na lista**, e são justamente as duas que
 * este app tinha. Sem uma delas, `startForeground` lança `SecurityException` —
 * e o app morre com a projeção junto. O `AndroidManifest.xml` declara
 * **`CHANGE_WIFI_MULTICAST_STATE`**: nível *normal* (sem diálogo) e a menos
 * poderosa das cinco.
 *
 * E a nota da mesma página, escrita aqui para ninguém "consertar" isto daqui a
 * dois anos: *"if your app performs a **projection** … use the corresponding
 * media projection … type instead"*. Um espelho de display é, em português
 * claro, uma projeção — mas `mediaProjection` é **inalcançável de propósito**:
 * não existe token de `MediaProjection` neste desenho (a tela virtual é privada
 * e do próprio app), e é isso que dispensa o diálogo de consentimento por
 * sessão e o indicador de gravação de tela **antes de projetar, num culto**.
 * Nada disso é imposto pelo sistema hoje; a única imposição real é a do
 * pré-requisito de permissão acima.
 *
 * ## As lições que este arquivo herda inteiras do [SyncService]
 *
 *  1. **`startForeground` SEMPRE, antes de qualquer decisão de parar.** Um
 *     serviço iniciado por `startForegroundService` que morre sem ter chamado
 *     isto faz o sistema derrubar o app inteiro — e o processo é o dos dois
 *     WebViews, da `Presentation` na TV e da tela virtual do espelho.
 *  2. **`START_NOT_STICKY`**: morreu, morreu. Um espelho que ressuscita sozinho
 *     sem servidor, sem tela virtual e sem encoder seria uma notificação
 *     mentindo para o operador — e ele precisa **ver** que morreu.
 *  3. **[onGone] obrigatório.** O Kotlin tem de ESQUECER que estava servindo,
 *     senão o próximo `espelhoLigar()` vira no-op calado — é o defeito exato
 *     que a `MainActivity` já corrige para o download, com token de geração e
 *     tudo.
 *  4. **A notificação segue o serviço.** `NotificationManager.notify` é
 *     independente do ciclo de vida de um `Service`: sem a guarda de [running],
 *     um cartão `setOngoing(true)` fica na gaveta para sempre, sem espelho
 *     nenhum atrás.
 *
 * ## O Wi-Fi lock, com a expectativa DITA e não prometida
 *
 * `WIFI_MODE_FULL` é *"deprecated and non-functional with no impact"* e
 * `WIFI_MODE_FULL_HIGH_PERF` é tratado como ele. O `WIFI_MODE_FULL_LOW_LATENCY`
 * é real, **mas só é de fato aplicado com o app em primeiro plano e a tela
 * acesa** — ou seja, a única API que poderia consertar "a latência sobe com a
 * tela apagada" **recusa-se a funcionar exatamente nessa situação**. Ele é
 * adquirido aqui porque é barato e ajuda enquanto o operador está com o app
 * aberto; **não conserte latência confiando nele**, e não prometa nada disso na
 * UI.
 */
class EspelhoService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private val relogio = Handler(Looper.getMainLooper())

    /**
     * A ronda térmica. `PowerManager.getCurrentThermalStatus()` é uma leitura
     * barata, mas é IPC: a cada minuto é o suficiente para um aparelho que
     * esquenta em dezenas de minutos, e caro demais para ser feito por quadro.
     */
    private val rondaTermica = object : Runnable {
        override fun run() {
            medirTermica()
            if (running) relogio.postDelayed(this, TERMICA_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        // Marcado aqui, e não no `onStartCommand`: a notificação só pode existir
        // enquanto ESTE serviço existir, e é a existência dele (não a entrega de
        // um comando) que define isso.
        running = true
        instance = this
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // SEMPRE, e antes de qualquer decisão de parar — ver a lição 1.
        ServiceCompat.startForeground(
            this,
            NOTIF_ID,
            buildNotification(this),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            } else {
                0
            },
        )
        foregrounded = true

        // O ESPELHO PODE TER SIDO DESLIGADO ENQUANTO O SERVIÇO SUBIA: ligar e
        // desligar em poucos milissegundos é o que acontece quando o
        // `presentation.show()` lança e o `ligar()` desfaz tudo. Ali o [desligar]
        // não tem serviço para derrubar, então quem se despede é o próprio
        // serviço — depois do `startForeground` que o sistema exige, e sem tomar
        // um wake lock que ninguém mais liberaria.
        if (!wanted) {
            Log.i(TAG, "espelho encerrado antes de o serviço subir — parando")
            stopSelf(startId)
            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_DESLIGAR) {
            // O BOTÃO DA NOTIFICAÇÃO é a única forma de desligar o espelho com o
            // app minimizado, e é por isso que ele existe. Quem desmonta a tela
            // virtual, o encoder e o servidor é o DONO (o hook), não este
            // serviço: ele não sabe o que é um `VirtualDisplay`.
            Log.i(TAG, "desligar pedido pela notificação")
            val hook = onDesligar
            if (hook == null) {
                stopSelf(startId)
                return START_NOT_STICKY
            }
            relogio.post {
                try {
                    hook.invoke()
                } catch (e: Exception) {
                    Log.w(TAG, "falhou desligando o espelho pela notificação", e)
                }
            }
            return START_NOT_STICKY
        }

        acquireWakeLock()
        acquireWifiLock()
        relogio.removeCallbacks(rondaTermica)
        relogio.postDelayed(rondaTermica, TERMICA_MS)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        // `running` cai ANTES de tudo: uma publicação já enfileirada não pode
        // ressuscitar um cartão que ninguém mais cancela.
        running = false
        foregrounded = false
        instance = null
        relogio.removeCallbacks(rondaTermica)
        releaseWakeLock()
        releaseWifiLock()
        try {
            getSystemService(NotificationManager::class.java)?.cancel(NOTIF_ID)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível remover a notificação do espelho", e)
        }
        // MORREU SEM QUE NINGUÉM PEDISSE (memória, cota, `Force stop` parcial):
        // o dono precisa esquecer que estava servindo, senão o próximo
        // `espelhoLigar()` encontra o estado antigo e vira no-op CALADO. Quando
        // a parada foi pedida, [desligar] já zerou `wanted` e nada é avisado.
        if (wanted) {
            wanted = false
            try {
                onGone?.invoke()
            } catch (e: Exception) {
                Log.w(TAG, "falhou avisando a morte do serviço", e)
            }
        }
        super.onDestroy()
    }

    /**
     * `connectedDevice` **não tem cota** — este override existe pelo mesmo
     * motivo que o do [SyncService] existe em aparelhos antigos: se um dia o
     * sistema passar a cobrar, a resposta certa é parar com aviso, e não ser
     * morto por ANR levando os dois WebViews e a `Presentation` junto.
     */
    override fun onTimeout(startId: Int, fgsType: Int) {
        Log.w(TAG, "o sistema pediu o fim do serviço do espelho")
        releaseWakeLock()
        releaseWifiLock()
        stopSelf()
    }

    // ---------- energia ----------

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(POWER_SERVICE) as? PowerManager ?: return
        // `setReferenceCounted(false)` é o que permite ao [renovarWakeLock]
        // repetir o `acquire` sem acumular uma contagem que um único `release`
        // não devolveria.
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AvIasd:espelho").apply {
            setReferenceCounted(false)
            acquire(WAKELOCK_TIMEOUT_MS)
        }
        ultimaRenovacaoMs = SystemClock.elapsedRealtime()
    }

    /**
     * Renovado por **progresso REAL** — um quadro entregue a um cliente —, nunca
     * por tique de relógio. Um espelho morto (encoder tomado, cliente nenhum,
     * tela virtual apagada) não pode segurar a CPU acordada até a bateria
     * acabar; um culto de duas horas, esse sim, não pode perder a proteção no
     * meio porque o teto de 2 h venceu.
     */
    private fun renovarWakeLock() {
        val wl = wakeLock ?: return
        val agora = SystemClock.elapsedRealtime()
        if (agora - ultimaRenovacaoMs < WAKELOCK_RENEW_MIN_MS) return
        ultimaRenovacaoMs = agora
        try {
            wl.acquire(WAKELOCK_TIMEOUT_MS)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível renovar o wake lock do espelho", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível soltar o wake lock", e)
        }
        wakeLock = null
    }

    private fun acquireWifiLock() {
        if (wifiLock?.isHeld == true) return
        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                ?: return
            val modo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                WifiManager.WIFI_MODE_FULL_LOW_LATENCY
            } else {
                // Antes da API 29 não existe o modo de baixa latência, e os
                // outros dois são não-funcionais. Fica pelo custo zero.
                @Suppress("DEPRECATION")
                WifiManager.WIFI_MODE_FULL_HIGH_PERF
            }
            wifiLock = wm.createWifiLock(modo, "AvIasd:espelho").apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (e: Exception) {
            // Um Wi-Fi lock que não sobe não impede nada de funcionar — ver o
            // KDoc da classe: ele já é um no-op com a tela apagada.
            Log.w(TAG, "não foi possível tomar o Wi-Fi lock", e)
        }
    }

    private fun releaseWifiLock() {
        try {
            wifiLock?.let { if (it.isHeld) it.release() }
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível soltar o Wi-Fi lock", e)
        }
        wifiLock = null
    }

    /**
     * Térmica: quem decide o que fazer é o dono do encoder (cair bitrate e taxa
     * de quadros — **nunca** resolução, que mudaria a densidade e refluiria o
     * layout do `/display/` na frente da congregação). Este serviço só mede e
     * avisa quando o degrau muda.
     */
    private fun medirTermica() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val pm = getSystemService(POWER_SERVICE) as? PowerManager ?: return
        val agora = try {
            pm.currentThermalStatus
        } catch (e: Exception) {
            return
        }
        if (agora > termicoMaximo) termicoMaximo = agora
        if (agora == termico) return
        termico = agora
        try {
            onTermica?.invoke(agora)
        } catch (e: Exception) {
            Log.w(TAG, "falhou avisando a térmica", e)
        }
    }

    // ---------- notificação ----------

    private fun ensureChannel() {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        // IMPORTANCE_LOW: é um painel, não um alerta. Nada de som nem heads-up
        // no meio de um culto.
        val ch = NotificationChannel(CHANNEL_ID, "Espelho", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Telão espelhado para os navegadores da rede"
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        nm.createNotificationChannel(ch)
    }

    companion object {
        private const val TAG = "EspelhoService"
        private const val CHANNEL_ID = "espelho"

        /** 1 é do [SyncService], 2 do [SessionService] — as três coexistem. */
        private const val NOTIF_ID = 3

        private const val ACTION_DESLIGAR = "br.org.iasd.av.espelho.desligar"

        private const val WAKELOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000L // 2 h
        private const val WAKELOCK_RENEW_MIN_MS = 10 * 60 * 1000L // 10 min
        private const val TERMICA_MS = 60_000L

        /** Piso entre republicações da notificação. O Android descarta updates
         *  em excesso, e aqui a informação muda devagar (um endereço, um
         *  contador de telas). */
        private const val NOTIF_MIN_MS = 1_000L

        @Volatile
        private var running = false

        /**
         * O dono QUER o serviço agora (entre [ligar] e [desligar]).
         *
         * Separado de [running] porque responde a outra pergunta: `running` diz
         * se o serviço existe, `wanted` diz se ele ainda deveria existir. É o
         * que permite ao `onStartCommand` descobrir que o espelho já morreu
         * enquanto ele subia — e é o que distingue, no `onDestroy`, uma parada
         * PEDIDA de uma morte que o dono precisa saber ([onGone]).
         */
        @Volatile
        private var wanted = false

        /**
         * `startForeground` já foi chamado.
         *
         * Enquanto for falso existe um `startForegroundService` PENDENTE, e
         * derrubar o serviço nessa janela é o que faz o sistema matar o app por
         * "did not then call Service.startForeground()".
         */
        @Volatile
        private var foregrounded = false

        @Volatile
        private var instance: EspelhoService? = null

        @Volatile
        private var endereco = ""

        @Volatile
        private var telas = 0

        @Volatile
        private var ultimaRenovacaoMs = 0L

        @Volatile
        private var ultimaNotifMs = 0L

        @Volatile
        private var termico = 0

        @Volatile
        private var termicoMaximo = 0

        /**
         * O operador tocou em **Desligar** na notificação. Quem desmonta a tela
         * virtual, o encoder e o servidor é o dono — este serviço não sabe o que
         * é um `VirtualDisplay`, e a invariante 5 do projeto vale aqui como em
         * todo lugar. Definido pelo dono enquanto o espelho existir.
         */
        @Volatile
        var onDesligar: (() -> Unit)? = null

        /**
         * O serviço morreu SEM que ninguém pedisse. O dono tem de esquecer que
         * estava servindo — ver a lição 3 no KDoc da classe.
         */
        @Volatile
        var onGone: (() -> Unit)? = null

        /**
         * O degrau térmico mudou (`PowerManager.THERMAL_STATUS_*`). Em
         * `SEVERE` o dono cai bitrate e taxa de quadros, com uma frase no
         * Registro — e **nunca** resolução.
         */
        @Volatile
        var onTermica: ((Int) -> Unit)? = null

        /** Sobe o serviço. [endereco] é o que a notificação mostra: com o app
         *  minimizado ela é a única janela para o espelho. */
        fun ligar(ctx: Context, endereco: String) {
            this.endereco = endereco
            wanted = true
            termico = 0
            termicoMaximo = 0
            try {
                val i = Intent(ctx, EspelhoService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ctx.startForegroundService(i)
                } else {
                    ctx.startService(i)
                }
            } catch (e: Exception) {
                // Android 12+ recusa iniciar serviço em primeiro plano com o app
                // em segundo plano. Na prática o espelho nasce de um toque na
                // tela do Controle, então isto não deveria acontecer — e se
                // acontecer, o espelho ainda serve: o que se perde é a proteção
                // contra o congelamento do processo.
                Log.w(TAG, "não foi possível subir o serviço do espelho", e)
            }
        }

        /**
         * Sem espelho: derruba o serviço e a notificação vai junto.
         *
         * O `wanted = false` é a parte que sempre acontece — é ele que fecha a
         * janela do serviço que ainda está SUBINDO. `stopService` só entra
         * quando o serviço JÁ está em primeiro plano: chamá-lo com um
         * `startForegroundService` pendente é o caminho conhecido para o app ser
         * morto, e perder a notificação seria um arranhão enquanto perder a
         * projeção, não.
         */
        fun desligar(ctx: Context) {
            wanted = false
            endereco = ""
            telas = 0
            if (!foregrounded) return
            try {
                ctx.stopService(Intent(ctx, EspelhoService::class.java))
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível parar o serviço do espelho", e)
            }
        }

        /**
         * Um quadro foi ESCRITO para um cliente. Chamado das threads de escrita
         * do [EspelhoServidor], dezenas de vezes por segundo — por isso não faz
         * nada além de uma leitura volátil e um piso de tempo.
         */
        fun progresso() {
            instance?.renovarWakeLock()
        }

        /** Uma tela entrou ou saiu: a notificação é a única janela com o app
         *  minimizado, e o número de telas é a metade da resposta a "está
         *  funcionando?". */
        fun telasMudaram(ctx: Context, quantas: Int) {
            telas = quantas
            publicar(ctx)
        }

        /** O endereço mudou (religou noutra porta, ou o TLS subiu). */
        fun enderecoMudou(ctx: Context, novo: String) {
            endereco = novo
            publicar(ctx)
        }

        private fun publicar(ctx: Context) {
            if (!running) return
            val agora = SystemClock.elapsedRealtime()
            if (agora - ultimaNotifMs < NOTIF_MIN_MS) return
            ultimaNotifMs = agora
            try {
                ctx.getSystemService(NotificationManager::class.java)
                    ?.notify(NOTIF_ID, buildNotification(ctx))
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível atualizar a notificação do espelho", e)
            }
        }

        /**
         * O que só este arquivo sabe, em JSON e sem uma frase — o dono junta com
         * o resto do diagnóstico. O Kotlin devolve DADO; quem escreve
         * "térmica: NONE (máx na sessão: LIGHT) · carregador: SIM" é o
         * `controle.js`.
         */
        fun estado(ctx: Context): JSONObject = JSONObject()
            .put("servico", running)
            .put("url", endereco)
            .put("telas", telas)
            .put("termico", termico)
            .put("termicoMax", termicoMaximo)
            .put("carregando", carregando(ctx))

        private fun carregando(ctx: Context): Boolean = try {
            val bm = ctx.getSystemService(BatteryManager::class.java)
            bm?.isCharging ?: false
        } catch (e: Exception) {
            false
        }

        private fun buildNotification(ctx: Context): Notification {
            val abrir = PendingIntent.getActivity(
                ctx,
                0,
                Intent(ctx, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                },
                PendingIntent.FLAG_IMMUTABLE,
            )
            val desligar = PendingIntent.getService(
                ctx,
                1,
                Intent(ctx, EspelhoService::class.java).setAction(ACTION_DESLIGAR),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val quantas = telas
            val linha = when {
                endereco.isEmpty() -> "Preparando…"
                quantas == 0 -> "$endereco · nenhuma tela ainda"
                quantas == 1 -> "$endereco · 1 tela"
                else -> "$endereco · $quantas telas"
            }
            return NotificationCompat.Builder(ctx, CHANNEL_ID)
                // O mesmo símbolo que a cortina usa na outra notificação: aqui
                // ele diz "há imagem saindo deste aparelho".
                .setSmallIcon(R.drawable.ic_image)
                .setContentTitle("Espelho no ar")
                .setContentText(linha)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                // O endereço já está na tela do celular e num QR à vista de
                // quem estiver perto; escondê-lo na tela de bloqueio não
                // protegeria nada e tiraria a informação útil.
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(abrir)
                .addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    "Desligar",
                    desligar,
                )
                .build()
        }
    }
}
