package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import org.schabi.newpipe.extractor.Extractor
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.services.youtube.ItagItem
import org.schabi.newpipe.extractor.services.youtube.extractors.YoutubeStreamExtractor
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.Stream
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import org.schabi.newpipe.extractor.stream.VideoStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Baixa um vídeo do YouTube **no próprio aparelho**, para o app usar o arquivo
 * em vez do player embutido.
 *
 * ## Por que isto existe
 *
 * O embed do YouTube pausa sozinho quando a página fica oculta — e é isso que o
 * Android faz com o telão no instante em que o operador minimiza o app. A regra
 * roda num iframe de outra origem e nenhum código nosso a alcança. Foram
 * tentadas, e falharam em aparelho, as duas saídas de fora: mandar tocar de
 * novo ([`ytWatchResume`] no Display) e impedir o WebView de se declarar oculto
 * ([WebViewFactory.KeepVisibleWebView]).
 *
 * Com o vídeo virando ARQUIVO, ele passa a ser mídia comum: o mesmo `<video>`
 * dos importados, com fade, seek, playlist, `MediaSession` e segundo plano que
 * já funcionam há versões — e sem anúncio, sem legenda e **sem depender da rede
 * durante o culto**.
 *
 * ## Por que AQUI, e não num servidor
 *
 * A versão anterior pedia uma instância [Cobalt](https://cobalt.tools). Não
 * funcionou, e o motivo não é o Cobalt: servidores públicos rodam em **IP de
 * datacenter**, que é exatamente o que o YouTube bloqueia. Extrair no aparelho
 * sai do IP do chip do operador — é por isso que o NewPipe funciona no celular
 * enquanto as instâncias públicas apanham. De quebra, aqui não existe CORS: o
 * `fetch` do WebView nunca chegaria ao `googlevideo.com`, que não manda os
 * cabeçalhos, e por isso o caminho anterior precisava de um túnel.
 *
 * ## O que ele entrega
 *
 * Um **MP4 de até 1080p**, montado das duas faixas que o YouTube guarda
 * separadas acima de 720p (o vídeo sem som de um lado, o áudio do outro) e
 * juntadas pelo `MediaMuxer` da plataforma — cópia de amostras, não
 * recodificação, ver [MuxMp4]. Quando a montagem não sai, o **progressivo**
 * segue como piso: um arquivo pior é infinitamente melhor que um vídeo que
 * para de tocar no meio do culto.
 *
 * ## Sem PO Token — e desde a v1.49 isso deixou de custar o 1080p
 *
 * O extrator aceita um `PoTokenProvider` e este app não monta nenhum. Durante
 * sete versões isso custou caro: o YouTube passou a exigir **SABR** de quem
 * pede sem token, as faixas adaptativas eram LISTADAS mas respondiam 403 a
 * todo download, e o que sobrava era o único progressivo deste aparelho —
 * 360p.
 *
 * **Montar o token não era a saída**, e isso foi verificado antes de desistir
 * dele: o `getWebClientPoToken()` da biblioteca não tem uma única chamada em
 * versão nenhuma (o cliente web só serve para metadados), e o token que ela de
 * fato consome — o do cliente Android — exige o **DroidGuard** do Play
 * Services, atrelado à assinatura do app oficial. Um WebView rodando o BotGuard
 * aqui alimentaria um campo que ninguém lê.
 *
 * Quem resolveu foi a própria biblioteca, na v0.26.3: um cliente **visionOS**,
 * buscado sem token nenhum, que volta a entregar as adaptativas — que é
 * exatamente o motivo de esta dependência existir no projeto (a manutenção do
 * gato-e-rato fica com quem a publica). O preço é que as listas agora vêm
 * MISTURADAS, faixas boas do visionOS ao lado das envenenadas do cliente
 * antigo, e é por isso que a escolha aqui virou uma FILA de candidatos
 * ([tentarJuntar]) em vez de "a de maior altura".
 */
object YoutubeGrab {

    private const val TAG = "YoutubeGrab"

    /**
     * UA de navegador comum. O extrator já manda o seu em várias requisições,
     * mas o download do arquivo é NOSSO, e um `User-Agent` vazio é o tipo de
     * detalhe que faz um CDN devolver 403 sem explicar.
     */
    private const val UA =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Mobile Safari/537.36"

    /**
     * Teto de resolução PADRÃO do download. Ver [tentarJuntar]: o telão da
     * igreja é 1080p, e subir daí é pagar tamanho por uma diferença que aquela
     * tela não mostra.
     *
     * Desde a v1.50 ele é só o padrão: o operador escolhe o teto na folha de
     * download (1080p · 720p · 480p) e o valor chega por parâmetro em [buscar].
     * O motivo é o de sempre neste app — rede de celular, minutos antes do
     * culto, e um louvor em 720p que TERMINA vale mais que um 1080p que não.
     * `public` porque a ponte precisa dele como valor de omissão.
     */
    const val TETO_ALTURA = 1080

    /**
     * Quantos candidatos de cada tipo a fila de [tentarJuntar] chega a tentar.
     *
     * Eles existem porque a lista de faixas chega MISTURADA desde a v1.49 (ver
     * o cabeçalho) e a primeira pode ser a envenenada — mas isto roda na rede do
     * chip do operador, possivelmente minutos antes do culto, então "tentar
     * todas" não é opção.
     *
     * Os números não são arbitrários: um 403 falha antes do primeiro byte, então
     * um candidato de vídeo perdido custa **uma requisição** — daí caber quatro.
     * Já uma MONTAGEM que falha custou o download inteiro do vídeo, e por isso
     * ela tem o teto mais apertado de todos. O áudio é pequeno e serve de sonda,
     * então dois bastam para separar "este contêiner não tem áudio" de "esta
     * faixa específica não veio"; no download **só áudio** ele sobe para três,
     * porque ali não há vídeo nenhum para pagar e a faixa é o produto inteiro.
     */
    private const val TETO_VIDEO = 4
    private const val TETO_AUDIO = 2
    private const val TETO_MONTAGENS = 2
    private const val TETO_AUDIO_SO = 3

    /**
     * O UA do app do YouTube no Apple Vision Pro — o cliente que a biblioteca
     * passou a buscar na v0.26.3 e que é quem entrega as faixas adaptativas sem
     * PO Token (ver o cabeçalho).
     *
     * É o perfil MAIS importante da fila justamente porque é dele que vêm as
     * URLs boas: [baixarTentando] lê o `c=` da própria URL e tenta primeiro o UA
     * que combina com ela.
     *
     * **Copiado caractere a caractere do que a biblioteca monta** (`v0.26.4`,
     * `YoutubeParsingHelper` + `ClientsConstants`), incluindo a falta de espaço
     * antes do parêntese e o país vazio no fim — o [IDIOMA] daqui é só a língua,
     * então o `getCountryCode()` que fecha a string não tem o que escrever.
     * Divergir num detalhe desses é pedir uma faixa anunciando um cliente que
     * não existe, que é como se ganha um 403 de graça.
     *
     * As duas constantes envelhecem com o bump: ao trocar a versão do extrator,
     * confira `ClientsConstants` e traga os números novos junto.
     */
    private const val UA_VISIONOS =
        "com.google.visionos.youtube/1.02(RealityDevice14,1; U; CPU visionOS 25_6_0 " +
            "like Mac OS X; )"

    private const val CONECTA_MS = 15_000
    private const val LE_MS = 30_000

    /**
     * O idioma do pedido, e não uma preferência de exibição.
     *
     * `NewPipe.init(downloader)` sozinho usa a localização padrão da
     * biblioteca — **en-GB**. O YouTube leva isso a sério: ele TRADUZ o título
     * (e a descrição) para o idioma pedido quando o canal publica traduções ou
     * quando a tradução automática está ligada, então uma busca por um louvor
     * brasileiro voltava com títulos em inglês de vídeos cujo título original é
     * em português — o operador procurava por um nome que não estava mais lá.
     *
     * Fixo no português do Brasil, e não herdado do `Locale` do aparelho: o que se quer aqui
     * é o título ORIGINAL do louvor, e um celular configurado em inglês (não é
     * raro) traria a tradução de volta. `ContentCountry` acompanha porque é ele
     * que decide o acervo regional dos resultados.
     *
     * **E passar isto ao `NewPipe.init` NÃO BASTA** — foi o que a v1.32 fez, e
     * os títulos continuaram chegando em inglês. `StreamingService.
     * getLocalization()` FILTRA o pedido pela lista de idiomas suportados do
     * serviço, e a do YouTube nesta versão da biblioteca (v0.26.4) tem um item
     * só: `en-GB` (o resto está comentado no fonte). Qualquer outro idioma cai
     * no `Localization.DEFAULT`, que é justamente o en-GB — em silêncio, sem
     * erro nenhum, e por isso o código anterior PARECIA certo. O país escapa
     * do filtro porque "BR" está na lista de países suportados, então só metade
     * do pedido chegava.
     *
     * A saída é o `forceLocalization`/`forceContentCountry` do próprio
     * `Extractor` ([aportuguesar]), que é a válvula que a biblioteca oferece
     * para exatamente isto: ele é lido ANTES da lista de suportados
     * (`getExtractorLocalization`).
     *
     * E o código é `pt`, não `pt-BR`: a lista (comentada) que a própria
     * biblioteca guarda como os `hl` que o YouTube aceita tem "pt" e "pt-PT" —
     * não tem "pt-BR". Com o `gl=BR` do [PAIS], "pt" É o português do Brasil;
     * pedir um código que o YouTube talvez não reconheça arriscaria voltar para
     * o inglês pela porta dos fundos, que é exatamente o defeito.
     */
    private val IDIOMA = Localization("pt")
    private val PAIS = ContentCountry("BR")

    /**
     * Português no extrator, por cima do filtro de idiomas suportados.
     * Todo caminho que fala com o YouTube passa por aqui — busca e extração —,
     * senão um deles volta a devolver título traduzido.
     */
    private fun aportuguesar(ex: Extractor) {
        ex.forceLocalization(IDIOMA)
        ex.forceContentCountry(PAIS)
    }

    /**
     * O que o extrator devolveu na ÚLTIMA extração, em uma linha — lido pela
     * ponte (`ytDiag`) e mostrado no rodapé de Configurações. É diagnóstico, não
     * recurso: a única forma de saber se as faixas adaptativas chegam a ESTE
     * aparelho é olhar o que chegou nele.
     *
     * `@Volatile` porque quem escreve é a fila de IO e quem lê é a thread do
     * WebView.
     */
    @Volatile
    var diagnostico: String = ""
        private set

    /**
     * O mesmo, para a TRANSMISSÃO DIRETA — e separado de propósito.
     *
     * Quando o `manifesto()` desiste, quem chama cai no [buscar], e o `buscar`
     * começa com `diagnostico = resumo(info)`: o motivo da desistência era
     * APAGADO pela linha do download que veio logo atrás. Na prática o log
     * nunca conseguia dizer por que a transmissão não entrou — só mostrava o
     * download que a substituiu, o que parecia "nem tentou".
     *
     * Dois campos, dois caminhos, nenhum sobrescreve o outro. [ytDiag] entrega
     * os dois.
     */
    @Volatile
    var diagnosticoStream: String = ""
        private set

    /**
     * QUANDO toda faixa adaptativa foi recusada (403) pela última vez — `0` =
     * nunca. Enquanto a marca é recente ([adaptativoBloqueado]), o caminho
     * adaptativo nem tenta.
     *
     * Enquanto a biblioteca só sabia pedir sem token, o 403 era a regra e não a
     * exceção: as doze faixas de vídeo-só e as cinco de áudio eram listadas e o
     * CDN recusava todas. Sem esta memória, todo download refazia as mesmas
     * requisições condenadas antes de cair no progressivo — alguns segundos de
     * espera, por download, para chegar sempre à mesma conclusão.
     *
     * **Com o cliente visionOS (v1.49) a bandeira ficou muito mais difícil de
     * levantar, e tinha de ficar.** A lista agora é MISTA: uma faixa
     * envenenada pode ter uma boa logo atrás na fila, e desligar o caminho
     * inteiro por causa do primeiro 403 seria jogar fora justamente o 1080p que
     * o bump veio buscar. Só liga quando **todos** os candidatos tentados
     * morreram com 403, e no mínimo dois — e o caminho do ÁUDIO alimenta a
     * marca com a mesma régua ([baixarAudio]): antes só a montagem de vídeo
     * contava, e com todo áudio adaptativo recusado a sessão refazia as sondas
     * condenadas a cada download.
     *
     * Com PRAZO ([BLOQUEIO_ADAPTATIVO_MS]), e não pela execução inteira: uma
     * recusa unânime é evidência sobre UM vídeo agora, não sobre o YouTube até
     * o app fechar — sem a expiração, dois 403 do vídeo problemático da manhã
     * desligavam o 1080p de todos os downloads do dia. Por `elapsedRealtime`,
     * imune a acerto de relógio; em memória e não persistido, porque um estado
     * em disco transformaria uma recusa de um dia numa desistência permanente.
     */
    @Volatile
    private var adaptativoBloqueadoEm = 0L

    /** Quanto tempo a recusa unânime vale. Quinze minutos cobrem o "tentar de
     *  novo em seguida" sem condenar o download seguinte do culto. */
    private const val BLOQUEIO_ADAPTATIVO_MS = 15 * 60 * 1000L

    /** O caminho adaptativo está em quarentena agora? */
    private fun adaptativoBloqueado(): Boolean {
        val em = adaptativoBloqueadoEm
        return em > 0L && SystemClock.elapsedRealtime() - em < BLOQUEIO_ADAPTATIVO_MS
    }

    /**
     * "áudio 2 · vídeo-só 5 (1080p) · progressivo 2 (720p)"
     *
     * Cada grupo conta primeiro o que dá para BAIXAR (URL direta de arquivo) e,
     * entre parênteses com `+`, o que veio mas NÃO é URL — manifesto HLS/DASH,
     * que precisaria de um caminho de download próprio. A distinção é o que
     * separa "o YouTube não mandou nada" de "mandou, mas noutro formato": as
     * duas leituras levam a decisões opostas, e sem o `+` elas apareceriam aqui
     * como o mesmo zero.
     */
    private fun resumo(info: StreamInfo): String {
        fun parte(nome: String, todos: List<Stream>, altura: (Stream) -> Int): String {
            val baixaveis = todos.filter { it.isUrl && !it.getContent().isNullOrBlank() }
            val outros = todos.size - baixaveis.size
            // POR CONTÊINER, e não só o total (v1.45). "vídeo-só 12 (1080p)"
            // parecia resposta suficiente e não era: se os doze forem VP9/WebM,
            // nenhum deles entra num MP4 — e a linha dizia exatamente o mesmo
            // que diria se fossem doze AVC. Era a diferença entre "o formato
            // não serve" e "o download foi recusado", que é a única pergunta
            // que ainda restava.
            val porTipo = baixaveis
                .groupBy { it.getFormat()?.getSuffix()?.lowercase() ?: "?" }
                .map { (ext, lista) ->
                    val h = lista.maxOfOrNull(altura) ?: 0
                    ext + " " + lista.size + (if (h > 0) " (${h}p)" else "")
                }
                .sorted()
                .joinToString(", ")
            return nome + " " + baixaveis.size +
                (if (porTipo.isNotEmpty()) " [$porTipo]" else "") +
                (if (outros > 0) " +$outros manif." else "")
        }
        val semAltura = { _: Stream -> 0 }
        return parte("áudio", info.audioStreams, semAltura) +
            " · " + parte("vídeo-só", info.videoOnlyStreams) {
                alturaDe((it as? VideoStream)?.getResolution())
            } +
            " · " + parte("prog", info.videoStreams.filter { !it.isVideoOnly }) {
                alturaDe((it as? VideoStream)?.getResolution())
            } +
            porCliente(info)
    }

    /**
     * "· clientes VISIONOS 16, ANDROID 1" — de QUAL cliente veio cada faixa
     * listada.
     *
     * Nasceu na v1.49 e é a linha que responde à única pergunta que interessa
     * depois do bump: **o visionOS chegou a este aparelho?** Sem ela, uma lista
     * de dezessete faixas parece a mesma coisa vindo do cliente que funciona ou
     * do que só entrega 403 — que foi exatamente o que aconteceu durante sete
     * versões de diagnóstico.
     *
     * Lido do `c=` da própria URL do `googlevideo`, e não de um campo da
     * biblioteca: é o CDN quem carimba, e o que ele carimbou é o que ele vai
     * cobrar na hora do download.
     */
    private fun porCliente(info: StreamInfo): String {
        val todas: List<Stream> =
            info.audioStreams + info.videoOnlyStreams + info.videoStreams
        val contagem = todas
            .filter { it.isUrl }
            .mapNotNull { s -> s.getContent()?.takeIf { it.isNotBlank() } }
            .map { clienteDe(it) }
            .groupingBy { it }
            .eachCount()
        if (contagem.isEmpty()) return ""
        return " · clientes " + contagem.entries
            .sortedByDescending { it.value }
            .joinToString(", ") { "${it.key} ${it.value}" }
    }

    /**
     * O cliente que o YouTube carimbou na URL, no parâmetro `c=`
     * (`…&c=VISIONOS&…`). "?" quando não há carimbo — o progressivo antigo às
     * vezes vem sem.
     */
    private fun clienteDe(url: String): String =
        CLIENTE_NA_URL.find(url)?.groupValues?.get(1)?.uppercase() ?: "?"

    private val CLIENTE_NA_URL = Regex("[?&]c=([A-Za-z0-9_]+)")

    /**
     * Por que uma tentativa morreu, em duas ou três palavras — para caber na
     * linha do diagnóstico.
     *
     * Três desfechos, porque levam a leituras opostas: o CÓDIGO HTTP (**403**
     * é o YouTube recusando a URL — faixa protegida por PO Token, não há o que
     * fazer no app), o CANCELAMENTO (o operador desistiu, e registrá-lo como
     * `IOException` mandaria caçar uma queda de rede que não existiu — é o que
     * o KDoc de [CANCELADO] promete ao diagnóstico) e o resto, que é rede ou
     * arquivo e sai como o nome da exceção.
     */
    private fun motivo(e: Exception): String {
        // As mensagens de "HTTP nnn" e de cancelamento são NOSSAS (ver
        // `baixar`), então dá para usá-las como estão. Nada de procurar três
        // dígitos no texto: a v1.45 fazia isso e leu a duração de dentro da URL
        // (`dur=423.061`) como se fosse um código HTTP — o diagnóstico apontou
        // para um erro que não existia.
        val msg = e.message.orEmpty()
        if (msg == CANCELADO) return "cancelado"
        if (msg.startsWith("HTTP ")) return msg.removePrefix("HTTP ")
        return e.javaClass.simpleName.ifEmpty { "erro" }
    }

    /** `NewPipe.init` é global e só pode acontecer uma vez por processo. */
    @Volatile
    private var pronto = false

    @Synchronized
    private fun garantirInit() {
        if (pronto) return
        NewPipe.init(NpDownloader, IDIOMA, PAIS)
        // O CLIENTE iOS, DE VOLTA AO DESLIGADO (v1.49). Ele foi ligado à mão na
        // v1.43 como a única coisa que dava para tentar sem assinar o contrato
        // de manutenção do BotGuard: o extrator caía no conjunto reduzido do
        // `reel/reel_item_watch` e o aparelho só via UM progressivo de 360p.
        // Medido depois disso, o iOS não resolveu — as faixas dele vêm
        // "especialmente" como manifestos HLS (é a própria javadoc do método que
        // avisa), e manifesto não é URL de arquivo: o `isUrl` das nossas
        // escolhas o descarta.
        //
        // Agora ele ATRAPALHA. Quem destrava o 1080p é o cliente visionOS que a
        // biblioteca busca sozinha desde a v0.26.3, e as listas chegam
        // misturadas: cada faixa iOS a mais é um candidato envenenado que a fila
        // de [tentarJuntar] pode gastar uma requisição tentando. Somado a isso,
        // ele custa uma requisição por extração e a própria biblioteca registra
        // que o iOS passou a ter exigência de token própria.
        //
        // `false` explícito, e não a omissão da linha: o valor é ESTÁTICO na
        // biblioteca e sobrevive a qualquer reconfiguração — dizer o estado que
        // se quer é o que torna esta decisão reversível numa linha.
        try {
            YoutubeStreamExtractor.setFetchIosClient(false)
        } catch (e: Throwable) {
            Log.w(TAG, "não deu para desligar o cliente iOS", e)
        }
        pronto = true
    }

    /**
     * Extrai, baixa e devolve o resultado pronto para o lado web:
     * `{ url, name, size, type }`, com `url` servível pelo mesmo `/saf/` que
     * as pastas do dispositivo já usam — o lado web faz `fetch` + `Blob`
     * exatamente como faz com um arquivo compartilhado, sem saber de onde veio.
     *
     * **BLOQUEANTE**: rede e parsing. Só pode ser chamado da fila de IO da
     * ponte, nunca da thread principal.
     *
     * Devolve `null` em qualquer falha — quem chama cai no player embutido.
     */
    fun buscar(
        ctx: Context,
        link: String,
        somenteAudio: Boolean,
        teto: Int = TETO_ALTURA,
        onProgresso: (Long, Long) -> Unit,
    ): JSONObject? {
        val r = buscarInterno(ctx, link, somenteAudio, teto, onProgresso)
        // O DESFECHO FICA GUARDADO até alguém reclamá-lo (ver [resgatar]). Aqui,
        // e não em cada `return` lá dentro: o corpo tem dois caminhos de sucesso
        // (o par juntado e a fila de candidatos), e um deles ficaria de fora no
        // primeiro ajuste que alguém fizesse.
        if (r != null) guardarResgate(link, somenteAudio, teto, r)
        return r
    }

    private fun buscarInterno(
        ctx: Context,
        link: String,
        somenteAudio: Boolean,
        teto: Int,
        onProgresso: (Long, Long) -> Unit,
    ): JSONObject? {
        baixandoLink = link
        // Um cancel só vale para download EM VOO. Um que sobrou de um download
        // já terminado — chegou depois do teste do `finally` — ficaria armado e
        // mataria ESTE no primeiro bloco copiado, que é justamente o download
        // que o operador pediria em seguida.
        cancelarLink = null
        return try {
            garantirInit()
            // Pelo EXTRATOR, e não pelo atalho `getInfo(service, url)`: é o
            // único ponto em que dá para forçar o idioma antes do fetch.
            val ex = ServiceList.YouTube.getStreamExtractor(link)
            aportuguesar(ex)
            val info = StreamInfo.getInfo(ex)
            val nome = tituloLimpo(info.name, info.uploaderName)
            val id = info.id ?: "video"

            // DIAGNÓSTICO (v1.42, ampliado na v1.45). A pergunta que só o
            // aparelho responde: quais faixas o extrator recebeu, em que
            // contêiner, e — quando alguma coisa dá errado — em que ponto. Sem
            // PO Token a biblioteca busca os streams por um endpoint de
            // conjunto reduzido, e o que cabe nele varia por vídeo.
            diagnostico = resumo(info)

            // 1080p: BAIXAR AS DUAS FAIXAS E JUNTAR (v1.44).
            //
            // Acima de 720p o YouTube só entrega vídeo SEM som, com o som à
            // parte — e é por isso que baixar "o vídeo" dava 360p: o app só
            // sabia pegar o progressivo, e o único progressivo deste aparelho é
            // o pior deles. Juntar é cópia, não conversão (ver MuxMp4).
            //
            // Falhando qualquer etapa, a fila abaixo continua valendo.
            if (!somenteAudio) {
                val juntado = tentarJuntar(ctx, info, id, teto, onProgresso)
                if (juntado != null) return juntado
            }

            // A FILA DE TENTATIVAS, EM ORDEM. Pedindo só o áudio, as faixas de
            // áudio vêm primeiro — e o VÍDEO PROGRESSIVO fica como último
            // recurso, em vez de o download inteiro falhar.
            //
            // Isso não é zelo teórico: as faixas separadas são as que o YouTube
            // protege com PO Token, e este app não monta o desafio do BotGuard
            // de propósito (ver o cabeçalho). Sem token elas podem vir vazias ou
            // com URLs que o CDN responde 403 — enquanto o progressivo, que é o
            // formato antigo, costuma passar. Era esse o buraco da v5.112: ela
            // tentava só a faixa de áudio e devolvia `null`, e do lado do
            // operador isso era um cartão de download que some sem dizer nada.
            //
            // E cair no progressivo NÃO desmente a escolha de "só áudio": quem
            // decide que o telão não muda de imagem é o `kind: 'audio'` do
            // registro, lá no lado web, não o contêiner do arquivo.
            val tentativas = mutableListOf<Alvo>()
            if (somenteAudio) {
                // VÁRIOS CANDIDATOS, e não "o melhor m4a e mais um" (v1.49). A
                // lista chega misturada — faixas do visionOS ao lado das do
                // cliente antigo —, então a melhor por bitrate pode ser
                // justamente uma que o CDN recusa. [candidatosAudio] já entrega
                // na ordem certa: cliente que funciona primeiro, AAC antes de
                // Opus (o WebView decodifica os dois, mas o AAC em qualquer
                // aparelho), maior bitrate por último critério.
                candidatosAudio(info, null, TETO_AUDIO_SO).forEach { tentativas += Alvo(it, true) }
            }
            faixaDe(melhorProgressivo(info, teto))?.let { tentativas += Alvo(it, false) }

            for (alvo in tentativas) {
                // O cancelamento pode ter chegado na fase da montagem: entrar
                // na fila do progressivo depois dele seria abrir mais conexões
                // para um download que o operador já recusou.
                if (cancelado()) return null
                val destino = arquivoDestino(ctx, id, alvo.faixa.ext, alvo.soAudio)
                try {
                    baixarTentando(alvo.faixa.url, destino, onProgresso)
                } catch (e: Exception) {
                    Log.w(TAG, "falhou baixando ${alvo.faixa.etiqueta} de $link", e)
                    diagnostico += " · ${alvo.faixa.etiqueta} " + motivo(e)
                    destino.delete()
                    // CANCELAMENTO ABORTA A FILA, não só esta tentativa: o
                    // próximo candidato custaria outra conexão real depois do
                    // pedido de parar. O registro acima já disse "cancelado".
                    if (foiCancelado(e)) return null
                    continue
                }
                if (destino.length() <= 0L) { destino.delete(); continue }
                diagnostico += " → veio ${alvo.faixa.ext} ${alvo.faixa.etiqueta}" +
                    (if (alvo.faixa.altura > 0) " (${alvo.faixa.altura}p)" else "")
                return JSONObject()
                    .put("url", SafRegistry.urlFor(Uri.fromFile(destino)))
                    .put("name", nome)
                    .put("size", destino.length())
                    // O tipo é o do arquivo que de fato veio — nunca o que foi
                    // PEDIDO. Anunciar um mp4 com vídeo como `audio/mp4` seria
                    // mentir para o decodificador do WebView; quem transforma
                    // isto em "toca sem imagem" é o `kind` do registro, que o
                    // lado web escolhe a partir do que ele pediu.
                    .put("type", alvo.faixa.mime)
                    // ...e este campo diz se a faixa é MESMO só áudio, para o
                    // lado web poder avisar quando teve de cair no vídeo.
                    .put("audioOnly", alvo.soAudio)
                    // A ALTURA REAL do que veio (0 para áudio). O lado web a
                    // grava no registro e a mostra no subtítulo do Cronograma:
                    // com o teto agora escolhido pelo operador, "Vídeo" sozinho
                    // deixou de dizer o que ele tem na mão — e adivinhar a
                    // resolução depois exigiria decodificar o arquivo.
                    .put("height", alvo.faixa.altura)
                    // ...e a DURAÇÃO, em segundos, que o extrator já traz de
                    // graça. Ela completa o subtítulo do Cronograma ("Áudio ·
                    // 4:32") — e para uma faixa de áudio é o único detalhe que
                    // existe, já que altura ali é sempre 0.
                    .put("seconds", info.duration)
            }
            diagnostico += " → NADA baixou"
            Log.w(TAG, "nenhum stream utilizável para $link ($diagnostico)")
            null
        } catch (e: Exception) {
            Log.w(TAG, "falhou em $link", e)
            // O RODAPÉ NÃO PODE FICAR COM O VÍDEO ANTERIOR: quando a extração
            // lança (vídeo removido, geo-block, rede), `diagnostico` ainda era
            // o resumo — com desfecho de SUCESSO — da extração passada. Para o
            // instrumento cuja razão de existir é "olhar o que chegou", mostrar
            // a de ontem para a falha de hoje é o pior modo de falhar.
            diagnostico = "extração falhou: " + motivo(e) + " · " + link
            null
        } finally {
            baixandoLink = null
            // O pedido de cancelamento morre com o download que ele cancelou.
            // Sem isto, um "cancelar" chegando tarde (o download já tinha
            // terminado) ficaria armado e mataria o PRÓXIMO download do mesmo
            // vídeo — que é justamente o que o operador faria em seguida.
            if (cancelarLink == link) cancelarLink = null
        }
    }

    // ------------------------------------------------------------------------
    // CANCELAR O DOWNLOAD EM CURSO
    //
    // Um sinalizador, e não uma interrupção de thread: o laço de cópia em
    // [baixar] o consulta a cada bloco de 64 kB e desiste sozinho. Interromper a
    // thread mataria também a extração e o `HttpURLConnection` no meio, com
    // socket meio fechado e um arquivo parcial sem dono conhecido.
    //
    // UM download por vez, e isso não é suposição: a fila de IO da ponte é
    // `newSingleThreadExecutor` (ver `NativeBridge`), então o `diagnostico`
    // deste mesmo arquivo já depende dessa serialização. Daí dois campos
    // simples bastarem, sem registro por chave.
    //
    // A comparação é pelo LINK do YouTube — o que o lado web conhece —, nunca
    // pela URL do googlevideo, que ele nem vê.
    // ------------------------------------------------------------------------
    @Volatile private var baixandoLink: String? = null
    @Volatile private var cancelarLink: String? = null

    /** Pede que o download deste link pare. Barato: só escreve um campo. */
    fun cancelar(link: String) { cancelarLink = link }

    // ------------------------------------------------------------------------
    // O DOWNLOAD ÓRFÃO (v1.59)
    //
    // O download roda aqui, no processo; quem o espera é um `fetch` da PÁGINA.
    // Quando o renderer morre (OOM — dois WebViews, um vídeo grande e o player
    // do YouTube dividem o mesmo processo), a página é recriada e o `fetch`
    // morre com ela: o arquivo termina de baixar e não sobra ninguém para
    // recebê-lo. Do lado do operador, dez minutos de download viram nada — e
    // nada explica o que houve.
    //
    // A saída é o shell GUARDAR o desfecho até alguém reclamá-lo. Um slot só,
    // e não um registro por link: a fila de IO da ponte é de uma thread só,
    // então existe no máximo um download por vez (é a mesma premissa do
    // cancelamento e do `diagnostico`).
    //
    // Quem reclama é a página nova, pedindo o MESMO download de novo: o
    // resultado guardado é devolvido na hora, sem rede. E quem o descarta é o
    // `descartar()` — o mesmo ponto em que os bytes já foram copiados para a
    // biblioteca e o arquivo intermediário deixa de existir.
    // ------------------------------------------------------------------------
    private class Resgate(
        val link: String,
        val soAudio: Boolean,
        val teto: Int,
        val json: JSONObject,
        val arquivo: String,
    )

    @Volatile private var resgate: Resgate? = null

    /**
     * O desfecho guardado deste MESMO pedido, se houver.
     *
     * A conferência inclui a forma (`soAudio`) e o teto de resolução: devolver
     * o m4a de ontem para quem hoje pediu o vídeo seria pior que não guardar
     * nada — o operador receberia silenciosamente o formato errado.
     */
    fun resgatar(link: String, soAudio: Boolean, teto: Int): JSONObject? {
        val r = resgate ?: return null
        if (r.link != link || r.soAudio != soAudio || r.teto != teto) return null
        // O arquivo pode ter sumido (faxina do sistema, cache limpo): um
        // resultado apontando para um arquivo que não existe é pior que
        // resultado nenhum, porque o lado web tentaria copiá-lo e falharia sem
        // saber por quê.
        if (!File(r.arquivo).isFile) { resgate = null; return null }
        Log.i(TAG, "resgatando download concluído de $link")
        return r.json
    }

    private fun guardarResgate(link: String, soAudio: Boolean, teto: Int, json: JSONObject) {
        val caminho = caminhoDe(json.optString("url")) ?: return
        resgate = Resgate(link, soAudio, teto, json, caminho)
    }

    /** O arquivo por trás de uma URL `/saf/<token>` — a mesma leitura do [descartar]. */
    private fun caminhoDe(url: String): String? = try {
        Uri.parse(url).lastPathSegment?.let { SafRegistry.get(it)?.path }
    } catch (_: Exception) { null }

    /** O download em curso foi cancelado? Consultado dentro do laço de cópia. */
    private fun cancelado(): Boolean {
        val alvo = cancelarLink ?: return false
        return alvo == baixandoLink
    }

    /**
     * Esta falha É o cancelamento? Consultada pelos laços de candidatos: uma
     * fila que segue para o próximo candidato depois do pedido de parar abre
     * conexão real de novo — espera DEPOIS de o operador pedir para parar.
     *
     * As duas condições, porque o cancelamento tem dois jeitos de aparecer: a
     * exceção com a mensagem de [CANCELADO] (o laço de cópia saiu por ela) e a
     * exceção de REDE que estava em voo quando o pedido chegou — nesse caso a
     * mensagem é outra, mas `cancelado()` ainda responde.
     */
    private fun foiCancelado(e: Exception): Boolean =
        e.message == CANCELADO || cancelado()

    /**
     * A marca do cancelamento nas mensagens.
     *
     * O lado web não a lê (ele sabe que pediu, e a ponte devolve `null` como em
     * qualquer falha), mas ela aparece no diagnóstico do rodapé — e ali a
     * diferença entre "o CDN recusou" e "o operador desistiu" é tudo.
     */
    const val CANCELADO = "cancelado pelo operador"

    /**
     * O MANIFESTO da transmissão direta: as duas melhores faixas adaptativas,
     * com URLs já servíveis pelo nosso origin ([StreamProxy]) e com os
     * byte-ranges que o `MediaSource` do lado web precisa.
     *
     * ## Por que isto existe ao lado do [buscar]
     *
     * Baixar resolve a projeção mas cobra a ESPERA: um louvor de 1080p são
     * centenas de MB antes do primeiro quadro. O caminho alternativo era o
     * player embutido do YouTube, e ele traz a UI dele junto — o rodinha de
     * carregamento, o botão grande na pausa, a tela final — coisas que
     * `controls: 0` não desliga porque não são controles.
     *
     * Transmitindo, o vídeo vira um `<video>` COMUM alimentado por MSE: fade,
     * cortina, `MediaSession`, barra de progresso e segundo plano continuam
     * sendo os mesmos que já funcionam, e não há um pixel de YouTube no telão.
     *
     * ## Só mp4/AVC + m4a/AAC
     *
     * O par WebM (VP9 + Opus) existe e o Chromium o toca, mas o `MediaSource`
     * de um WebView é território de fabricante e o AVC/AAC é o que decodifica
     * em qualquer aparelho. Aqui a recusa é barata — quem não achar par
     * transmissível cai no download, que aceita os dois contêineres.
     *
     * **BLOQUEANTE** — rede e parsing, como todo o resto deste arquivo.
     * `null` quando não há par adaptativo: quem chamou cai no caminho de antes.
     */
    fun manifesto(link: String, teto: Int = TETO_ALTURA): JSONObject? {
        return try {
            garantirInit()
            val ex = ServiceList.YouTube.getStreamExtractor(link)
            aportuguesar(ex)
            val info = StreamInfo.getInfo(ex)
            // NO CAMPO DA TRANSMISSÃO, não no do download. Escrever em
            // `diagnostico` aqui fazia o Registro exibir uma linha "download:"
            // para uma extração em que download NENHUM aconteceu — e ela vinha
            // sem desfecho, o que se lê como um download travado.
            diagnosticoStream = resumo(info) + " · "
            // A MESMA fila de candidatos do download, e não uma segunda regra:
            // a ordem por cliente (visionOS primeiro) é o que faz a faixa
            // escolhida ser uma que o CDN de fato serve.
            //
            // A ELEGIBILIDADE (mp4/m4a) VEM ANTES DO TETO de candidatos: um
            // par transmissível na 3ª posição por ordem era descartado por
            // dois inelegíveis à frente do `take` — "SEM PAR DASH" com par bom
            // na lista. No áudio não há teto nenhum: o teto é orçamento de
            // TENTATIVA de download, e aqui não se tenta nada — escolhe-se UM.
            // O filtro de `dash` fica DEPOIS, e as contas saem das listas que
            // o `firstOrNull` de fato varre: é a diferença entre elas e o que
            // sobra que diz o que faltou.
            val videos = candidatosVideo(info, 0, teto) { !it.webm }
            val audios = candidatosAudio(info, "m4a", Int.MAX_VALUE)
            val v = videos.firstOrNull { it.dash }
            val a = audios.firstOrNull { it.dash }
            val contas = porQueNaoDash("vídeo mp4", videos) + " · " + porQueNaoDash("áudio m4a", audios)
            if (v == null || a == null) {
                diagnosticoStream += contas + " → SEM PAR DASH, caindo no download"
                return null
            }
            diagnosticoStream += contas + " → transmitindo ${v.altura}p (${v.etiqueta} + ${a.etiqueta})" +
                " · v=${v.mime};${v.codec} a=${a.mime};${a.codec}"
            JSONObject()
                .put("name", tituloLimpo(info.name, info.uploaderName))
                .put("seconds", info.duration)
                .put("height", v.altura)
                .put("video", faixaJson(v))
                .put("audio", faixaJson(a))
        } catch (e: Exception) {
            Log.w(TAG, "não deu para montar o manifesto de $link", e)
            // Mesma regra do download: uma extração que lança não pode deixar
            // no rodapé o resumo — bem-sucedido — do vídeo anterior.
            diagnosticoStream = "extração falhou: " + motivo(e) + " · " + link
            null
        }
    }

    /**
     * "vídeo mp4 6 (init 6 · índice 0 · codec 6)" — quantas faixas passam em
     * CADA pré-requisito da transmissão.
     *
     * Existe porque "sem par DASH" é um diagnóstico inútil: ele diz que não deu,
     * não o que faltou. Com as contas separadas, uma leitura em aparelho
     * responde de uma vez se o problema é o YouTube não mandar os byte-ranges,
     * a biblioteca não preencher o codec, ou simplesmente não haver faixa mp4.
     */
    private fun porQueNaoDash(nome: String, fs: List<Faixa>): String {
        if (fs.isEmpty()) return "$nome 0"
        val init = fs.count { it.initFim > it.initIni }
        val idx = fs.count { it.idxFim > it.idxIni }
        val cod = fs.count { it.codec.isNotEmpty() }
        return "$nome ${fs.size} (init $init · índice $idx · codec $cod)"
    }

    /**
     * Uma faixa do manifesto. O `mime` sai COMPLETO (`video/mp4;
     * codecs="avc1.640028"`) porque é assim que o `MediaSource.isTypeSupported`
     * e o `addSourceBuffer` o exigem — sem o `codecs`, o navegador recusa.
     */
    private fun faixaJson(f: Faixa): JSONObject = JSONObject()
        .put("url", StreamProxy.urlFor(f.url))
        .put("mime", f.mime + "; codecs=\"" + f.codec + "\"")
        .put("initStart", f.initIni)
        .put("initEnd", f.initFim)
        .put("indexStart", f.idxIni)
        .put("indexEnd", f.idxFim)
        .put("size", f.tamanho)
        .put("itag", f.etiqueta)

    /**
     * Baixa uma faixa de vídeo (até 1080p) mais a de áudio do mesmo contêiner e
     * as junta. Devolve o JSON pronto, ou `null` quando este caminho não serve —
     * e aí quem chamou cai no progressivo de sempre.
     *
     * ## Uma FILA de candidatos, e não "a melhor" (v1.49)
     *
     * Até a v1.48 isto escolhia UM par por contêiner (o vídeo de maior altura) e
     * desistia se ele falhasse. Funcionava enquanto todas as faixas vinham do
     * mesmo cliente. Com o visionOS da v0.26.3 elas passaram a chegar
     * MISTURADAS — as boas dele ao lado das do cliente antigo, que o CDN recusa
     * com 403 —, e "a de maior altura" pode ser justamente uma envenenada. Um
     * par único significaria perder o 1080p tendo um 1080p bom na mesma lista,
     * que é exatamente o defeito que o bump da biblioteca veio corrigir.
     *
     * ## O áudio primeiro, porque ele é a sonda barata
     *
     * O áudio de um louvor tem alguns MB e o vídeo tem centenas. Descobrir pelo
     * áudio que um contêiner não serve custa uma fração do que custaria
     * descobrir pelo vídeo — e o arquivo baixado fica guardado por contêiner,
     * então um segundo candidato de vídeo mp4 reaproveita o m4a que já veio em
     * vez de baixá-lo de novo.
     *
     * ## Os tetos, e por que a montagem tem um bem menor
     *
     * Isto roda na rede do chip do operador, possivelmente minutos antes do
     * culto. Um 403 falha antes do primeiro byte, então um candidato perdido
     * custa uma requisição — mas uma MONTAGEM que falha custou o download
     * inteiro do vídeo, e por isso ela tem teto próprio ([TETO_MONTAGENS]), bem
     * mais apertado que o número de candidatos.
     *
     * **Teto de 1080p de propósito.** O telão de um salão é 1080p, e 1440p/4K
     * custariam três a dez vezes o tamanho por uma diferença que ninguém vê
     * naquela tela — num aparelho que também guarda hinário e Bíblia.
     *
     * **Pares do MESMO contêiner.** As faixas de 1080p costumam vir em duas
     * versões, AVC (mp4) e VP9 (WebM); o muxer aceita AVC/AAC num MP4 e VP9/Opus
     * num WebM, e recusa a mistura (ver [MuxMp4]) — depois de tudo baixado, que
     * é o pior momento possível para descobrir.
     */
    private fun tentarJuntar(
        ctx: Context,
        info: StreamInfo,
        id: String,
        teto: Int,
        onProgresso: (Long, Long) -> Unit,
    ): JSONObject? {
        if (adaptativoBloqueado()) {
            diagnostico += " · adaptativo em quarentena (403 em série há pouco)"
            return null
        }

        // O progressivo que já temos de graça é o PISO: montar só compensa se o
        // resultado for melhor. Sem esta conta, um vídeo cuja faixa separada
        // fosse 360p pagaria dois downloads e um muxer para entregar o mesmo.
        val piso = melhorProgressivo(info, teto)?.let { alturaDe(it.getResolution()) } ?: 0
        val candidatos = candidatosVideo(info, piso, teto)
        if (candidatos.isEmpty()) {
            diagnostico += " · sem vídeo-só acima de ${piso}p"
            return null
        }
        val nome = tituloLimpo(info.name, info.uploaderName)
        val segundos = info.duration

        // O áudio JÁ BAIXADO de cada contêiner. Um `null` guardado é memória de
        // que aquele contêiner não tem áudio utilizável: insistir nele com outro
        // candidato de vídeo seria baixar centenas de MB para esbarrar no mesmo
        // lado que falhou.
        val audioDe = mutableMapOf<String, File?>()
        var tentados = 0
        var recusas403 = 0
        var montagens = 0
        try {
            for (v in candidatos) {
                // O CANCELAMENTO ABORTA A FILA INTEIRA, não só a tentativa em
                // que o pedido chegou (ele aparece aqui vindo do áudio, que
                // devolve null, ou da montagem, que devolve Recusado): cada
                // candidato seguinte abriria conexão real de novo — espera
                // DEPOIS de o operador pedir para parar.
                if (cancelado()) {
                    diagnostico += " · cancelado, fila abortada"
                    break
                }
                // O teto é conferido ANTES de qualquer byte: parar depois de já
                // ter baixado o áudio do contêiner seguinte seria pagar por uma
                // tentativa que nunca vai acontecer.
                if (montagens >= TETO_MONTAGENS) {
                    diagnostico += " · montagens no teto"
                    break
                }
                val extAudio = if (v.webm) "webm" else "m4a"
                // `containsKey`, e não `getOrPut`: este último re-executa o bloco
                // quando o valor guardado é `null`, que é justamente o caso que
                // esta memória existe para lembrar — seriam downloads repetidos
                // de um áudio que já se provou ausente.
                if (!audioDe.containsKey(extAudio)) {
                    audioDe[extAudio] = baixarAudio(
                        ctx, id, extAudio,
                        candidatosAudio(info, extAudio, TETO_AUDIO),
                        // O TAMANHO DO VÍDEO QUE VEM A SEGUIR, para a fase do
                        // áudio já contar a conta inteira — ver [baixarAudio].
                        // Pode ser -1 (o YouTube nem sempre informa), e lá isso
                        // é tratado como "não sei".
                        v.tamanho,
                        onProgresso,
                    )
                }
                val parteAudio = audioDe[extAudio] ?: continue
                tentados++
                when (val d = montar(ctx, id, nome, v, segundos, parteAudio, onProgresso)) {
                    is Desfecho.Pronto -> return d.json
                    is Desfecho.Recusado -> if (d.motivo == "403") recusas403++
                    Desfecho.NaoMontou -> montagens++
                }
            }
        } finally {
            audioDe.values.forEach { it?.delete() }
        }

        // A QUARENTENA EXIGE UNANIMIDADE — ver [adaptativoBloqueadoEm]. Com o
        // pool misturado, um 403 isolado é o comportamento NORMAL de uma faixa
        // envenenada com uma boa logo atrás na fila; desligar o caminho
        // inteiro por causa dele seria o autogol.
        if (tentados >= 2 && recusas403 == tentados) {
            adaptativoBloqueadoEm = SystemClock.elapsedRealtime()
        }
        return null
    }

    /**
     * Baixa a primeira faixa de [candidatos] que de fato vier e devolve o
     * arquivo; `null` quando nenhuma veio — e aí o contêiner inteiro está fora,
     * porque sem áudio não há o que montar.
     *
     * Ela é a SONDA de [tentarJuntar], e vem antes do vídeo justamente por ser
     * pequena. Quem apaga o arquivo é quem chamou: ele é reaproveitado entre os
     * candidatos de vídeo do mesmo contêiner.
     */
    private fun baixarAudio(
        ctx: Context,
        id: String,
        ext: String,
        candidatos: List<Faixa>,
        previsaoVideo: Long,
        onProgresso: (Long, Long) -> Unit,
    ): File? {
        if (candidatos.isEmpty()) {
            diagnostico += " · $ext sem áudio"
            return null
        }
        val destino = File(pasta(ctx), "$id-a.$ext")
        var tentadas = 0
        var recusas403 = 0
        for (a in candidatos) {
            try {
                // BYTES DE VERDADE, e não uma escala de 0 a 100 (v1.58).
                //
                // Este caminho reportava porcentagem (`lidos * 10 / total`,
                // `100`) enquanto o lado web trata os dois números como BYTES —
                // e a notificação, que é a única janela do download com o app
                // minimizado, anunciava "0 de 100" para um vídeo de 380 MB. Do
                // lado do operador isso se lê como CEM ITENS.
                //
                // E O TOTAL JÁ É O DAS DUAS FAIXAS (v1.62).
                //
                // Até aqui a fase do áudio reportava o tamanho DELE, e o total
                // só crescia para a soma real quando o vídeo entrava (ver
                // `montar`). Os dois números eram verdadeiros e mesmo assim a
                // tela mentia: o áudio são poucos MB e baixa em segundos, então
                // o download começava marcando **100%** por alguns instantes —
                // o fim da primeira fase — para só então recomeçar do zero. Era
                // a primeira coisa que o operador via, e ela dizia o oposto do
                // que estava acontecendo.
                //
                // A previsão vem do `contentLength` da faixa de vídeo, que o
                // extrator já entrega antes do primeiro byte. Ela pode faltar
                // (o YouTube nem sempre informa, e aí o campo vem -1 ou 0): sem
                // ela nada muda, e o comportamento é o de antes. Com ela, o
                // total da fase do áudio já é a conta inteira e a barra sobe de
                // 0 a 100 uma vez só.
                baixarTentando(a.url, destino) { lidos, total ->
                    onProgresso(
                        lidos,
                        if (total > 0 && previsaoVideo > 0) total + previsaoVideo else total,
                    )
                }
                if (destino.length() > 0L) return destino
                diagnostico += " · a:${a.etiqueta} vazio"
                tentadas++
            } catch (e: Exception) {
                Log.w(TAG, "falhou o áudio ${a.etiqueta} de $id", e)
                diagnostico += " · a:${a.etiqueta} " + motivo(e)
                // CANCELAMENTO ABORTA A FILA: cada candidato seguinte abriria
                // conexão real depois do pedido de parar. O registro acima já
                // disse "cancelado".
                if (foiCancelado(e)) {
                    destino.delete()
                    return null
                }
                tentadas++
                if (motivo(e) == "403") recusas403++
            }
            destino.delete()
        }
        // O 403 EM SÉRIE DO ÁUDIO também alimenta a quarentena, com a MESMA
        // unanimidade do vídeo ([adaptativoBloqueadoEm]): sem isto, um vídeo
        // com todo áudio adaptativo recusado fazia a sessão refazer as sondas
        // condenadas a cada download.
        if (tentadas >= 2 && recusas403 == tentadas) {
            adaptativoBloqueadoEm = SystemClock.elapsedRealtime()
        }
        return null
    }

    /**
     * Baixa a faixa de vídeo [v], junta com o áudio já baixado em [parteAudio] e
     * devolve o desfecho.
     *
     * [parteAudio] **não** é apagado aqui: ele pertence a [tentarJuntar], que o
     * reaproveita entre candidatos do mesmo contêiner.
     */
    private fun montar(
        ctx: Context,
        id: String,
        nome: String,
        v: Faixa,
        segundos: Long,
        parteAudio: File,
        onProgresso: (Long, Long) -> Unit,
    ): Desfecho {
        val parteVideo = File(pasta(ctx), "$id-v.${v.ext}")
        val saida = arquivoDestino(ctx, id, v.ext, false)
        try {
            // O ÁUDIO JÁ BAIXADO é a base da conta: daqui para a frente os dois
            // números são a soma real das duas faixas (ver `baixarAudio`).
            val base = parteAudio.length()
            val perfil = baixarTentando(v.url, parteVideo) { lidos, total ->
                onProgresso(base + lidos, if (total > 0) base + total else 0L)
            }
            if (parteVideo.length() <= 0L) {
                diagnostico += " · v:${v.etiqueta} vazio"
                return Desfecho.NaoMontou
            }
            // BAIXOU TUDO: os dois números se encontram. A junção (MuxMp4) que
            // vem a seguir é cópia de amostras, rápida e sem rede — não há
            // progresso honesto a reportar nela, e inventar um seria voltar ao
            // que esta versão está consertando.
            val baixado = base + parteVideo.length()
            onProgresso(baixado, baixado)
            if (!MuxMp4.juntar(parteVideo, parteAudio, saida, v.webm)) {
                diagnostico += " · v:${v.etiqueta} muxer falhou"
                return Desfecho.NaoMontou
            }
            if (saida.length() <= 0L) {
                diagnostico += " · v:${v.etiqueta} saída vazia"
                return Desfecho.NaoMontou
            }
            // Fim: o arquivo montado é o que o operador vai ter no aparelho, e
            // ele é o número honesto para fechar a barra.
            onProgresso(saida.length(), saida.length())
            diagnostico += " → juntou ${v.altura}p (${v.ext}, ${v.etiqueta}/$perfil)"
            return Desfecho.Pronto(
                JSONObject()
                    .put("url", SafRegistry.urlFor(Uri.fromFile(saida)))
                    .put("name", nome)
                    .put("size", saida.length())
                    .put("type", if (v.webm) "video/webm" else "video/mp4")
                    .put("audioOnly", false)
                    .put("height", v.altura)
                    .put("seconds", segundos),
            )
        } catch (e: Exception) {
            Log.w(TAG, "não deu para juntar ${v.etiqueta} de $id", e)
            val porque = motivo(e)
            diagnostico += " · v:${v.etiqueta} " + porque
            saida.delete()
            return Desfecho.Recusado(porque)
        } finally {
            // A parte de vídeo não serve para mais nada — nem em caso de sucesso
            // (o arquivo final já a contém) nem em caso de falha. Deixá-la no
            // cache dobraria o espaço de cada download.
            parteVideo.delete()
        }
    }

    /**
     * Como terminou uma tentativa de montagem.
     *
     * Existe porque "não deu" e "foi RECUSADO" levam a decisões diferentes: só a
     * recusa (403) conta para desligar o caminho adaptativo pelo resto da sessão
     * — um muxer que falhou, ou um arquivo vazio, é característica daquele
     * formato e não do portão do YouTube.
     */
    private sealed class Desfecho {
        class Pronto(val json: JSONObject) : Desfecho()
        class Recusado(val motivo: String) : Desfecho()
        object NaoMontou : Desfecho()
    }

    /**
     * Uma faixa candidata, com tudo o que a decisão precisa e nada que exija
     * perguntar de novo à biblioteca no meio do laço.
     *
     * O tipo e a extensão saem do PRÓPRIO formato da faixa
     * (`MediaFormat.getMimeType()`/`getSuffix()`), nunca de uma tabela escrita à
     * mão aqui: é a biblioteca que sabe se aquele itag é m4a, WebM ou Opus, e
     * uma segunda tabela envelheceria em silêncio na primeira vez que o YouTube
     * trocasse um formato.
     *
     * Já o `itag` e o `cliente` saem da URL, e isso é deliberado: é o CDN quem
     * os carimba, e o que ele carimbou é o que ele vai cobrar na hora do
     * download.
     */
    private class Faixa(
        val url: String,
        val ext: String,
        val mime: String,
        val altura: Int,
        val bitrate: Int,
        itag: Int,
        val cliente: String,
        /**
         * Os byte-ranges do DASH, quando o YouTube os informa: o segmento de
         * INICIALIZAÇÃO (`ftyp`+`moov`, o cabeçalho que descreve a faixa) e o
         * ÍNDICE (`sidx`, o mapa de tempo → posição de cada fragmento).
         *
         * São eles que tornam a transmissão direta possível: com os dois, o
         * player do lado web monta a linha do tempo inteira lendo alguns
         * kilobytes, e daí em diante pede só os pedaços de que precisa. Sem
         * eles, "tocar" significaria baixar o arquivo todo primeiro — que é
         * exatamente o que se quer evitar.
         *
         * Zerados quando a faixa não é adaptativa (o progressivo não tem sidx).
         */
        val initIni: Int = 0,
        val initFim: Int = 0,
        val idxIni: Int = 0,
        val idxFim: Int = 0,
        /** O tamanho total da faixa, para o player saber onde ela acaba. */
        val tamanho: Long = 0,
        /** `avc1.640028`, `mp4a.40.2` — o que o `MediaSource` exige saber. */
        val codec: String = "",
    ) {
        val webm: Boolean = ext == "webm"

        /**
         * Dá para transmitir esta faixa por MSE?
         *
         * São só DUAS exigências, e as duas são de fato indispensáveis: o
         * segmento de inicialização (sem ele o `SourceBuffer` rejeita qualquer
         * mídia) e o índice (sem ele não há como saber onde cada fragmento
         * começa).
         *
         * O `tamanho` NÃO entra, e essa era a v5.120: o `contentLength` do
         * `ItagItem` nasce em **-1** quando o YouTube não o informa, e exigi-lo
         * derrubava a transmissão inteira por um campo que o player nem usa —
         * quem diz onde a faixa acaba é o próprio `sidx`, que lista todos os
         * fragmentos. Era uma condição a mais para dar errado, sem nada em
         * troca.
         *
         * Os começos precisam ser NÃO NEGATIVOS além de menores que os fins: o
         * `ItagItem` usa -1 para "não sei", e se a biblioteca um dia preencher
         * só metade do par, um `initIni = -1` viraria `?r=-1-500` na query do
         * proxy — 400 garantido, depois de anunciar a faixa como transmissível.
         */
        val dash: Boolean = initIni >= 0 && idxIni >= 0 &&
            idxFim > idxIni && initFim > initIni && codec.isNotEmpty()

        /** "137@VISIONOS" — o formato exato e de quem ele veio. */
        val etiqueta: String = (if (itag > 0) itag.toString() else ext) + "@" + cliente
    }

    /**
     * A [Faixa] de um stream que seja URL direta de arquivo, ou `null`.
     *
     * Manifesto HLS/DASH cai fora aqui (`isUrl`): ele precisaria de um caminho
     * de download próprio, e é o que o diagnóstico conta à parte, com `+`.
     */
    private fun faixaDe(s: Stream?): Faixa? {
        if (s == null || !s.isUrl) return null
        val url = s.getContent()
        if (url.isNullOrBlank()) return null
        val fmt = s.getFormat() ?: return null
        val ext = fmt.getSuffix()?.lowercase() ?: return null
        val mime = fmt.getMimeType() ?: return null
        // O `ItagItem` é NULO fora do YouTube e pode faltar mesmo dentro dele;
        // a faixa continua valendo para DOWNLOAD, só não serve para transmitir.
        val it: ItagItem? = try { s.getItagItem() } catch (_: Exception) { null }
        return Faixa(
            url = url,
            ext = ext,
            mime = mime,
            altura = alturaDe((s as? VideoStream)?.getResolution()),
            bitrate = (s as? AudioStream)?.averageBitrate ?: 0,
            itag = itagDe(url),
            cliente = clienteDe(url),
            initIni = it?.getInitStart() ?: 0,
            initFim = it?.getInitEnd() ?: 0,
            idxIni = it?.getIndexStart() ?: 0,
            idxFim = it?.getIndexEnd() ?: 0,
            tamanho = it?.getContentLength() ?: 0L,
            codec = it?.getCodec().orEmpty(),
        )
    }

    /**
     * Os candidatos de VÍDEO-SÓ, já na ordem em que serão tentados.
     *
     * A ordem é **cliente primeiro, altura depois**. Parece invertido e não é —
     * é a lição da v1.49: as duas listas trazem 1080p, mas só a do visionOS
     * baixa, e ordenar por altura intercalaria as duas, gastando as tentativas
     * em faixas que o CDN recusa. Empatados, mp4 vem antes de WebM, porque o
     * WebView toca H.264 em qualquer aparelho.
     *
     * [piso] é a altura do progressivo que já temos de graça: igual ou abaixo
     * dela, montar não compensa.
     *
     * [filtro] é a elegibilidade EXTRA de quem chama (o manifesto recusa WebM),
     * aplicada ANTES do `take`: o teto é orçamento de candidatos ELEGÍVEIS, e
     * um filtro depois dele deixaria um candidato bom fora da janela por causa
     * de dois inelegíveis à frente. O padrão aceita tudo — o caminho de
     * DOWNLOAD continua exatamente como era.
     */
    private fun candidatosVideo(
        info: StreamInfo,
        piso: Int,
        teto: Int,
        filtro: (Faixa) -> Boolean = { true },
    ): List<Faixa> =
        info.videoOnlyStreams
            .mapNotNull { faixaDe(it) }
            // O par WebM exige Android 10: o muxer só passou a escrever Opus
            // dentro de WebM na API 29. Abaixo disso ele nem entra na fila.
            .filter {
                it.ext == "mp4" ||
                    (it.webm && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            }
            .filter { it.altura in (piso + 1)..teto }
            .filter(filtro)
            .sortedWith(
                compareBy<Faixa>({ ordemCliente(it.cliente) }, { -it.altura })
                    .thenBy { if (it.webm) 1 else 0 },
            )
            .take(TETO_VIDEO)

    /**
     * Os candidatos de ÁUDIO, na mesma lógica de ordem. [ext] fixa o contêiner
     * (é o que o muxer exige quando há vídeo do outro lado); `null` aceita
     * qualquer um, que é o caso do download "só áudio" — ali um Opus que toca
     * vale mais que um AAC que não veio.
     */
    private fun candidatosAudio(info: StreamInfo, ext: String?, teto: Int): List<Faixa> =
        info.audioStreams
            .mapNotNull { faixaDe(it) }
            .filter { ext == null || it.ext.equals(ext, true) }
            .sortedWith(
                compareBy<Faixa>({ ordemCliente(it.cliente) }, { if (it.ext == "m4a") 0 else 1 })
                    .thenByDescending { it.bitrate },
            )
            .take(teto)

    /**
     * Quem primeiro.
     *
     * **VISIONOS** é o cliente que a biblioteca passou a buscar na v0.26.3 e o
     * único cujas URLs adaptativas este aparelho conseguiu baixar; **ANDROID** é
     * o do conjunto reduzido, que lista tudo e responde 403. Um cliente
     * desconhecido (ou uma URL sem carimbo) vai para o fim **sem ser
     * descartado**: ele pode ser o próximo que funciona, e a fila é barata.
     */
    private fun ordemCliente(cliente: String): Int = when (cliente) {
        "VISIONOS" -> 0
        "ANDROID" -> 1
        "IOS" -> 2
        else -> 3
    }

    /**
     * O itag que o YouTube carimbou na URL (`…&itag=137&…`); 0 quando não há.
     *
     * Da URL, e não de `getItagItem()`: é o mesmo lugar de onde sai o cliente
     * ([clienteDe]), é o que o CDN de fato leu, e não acrescenta superfície da
     * biblioteca a um ponto que só existe para o diagnóstico.
     */
    private fun itagDe(url: String): Int =
        ITAG_NA_URL.find(url)?.groupValues?.get(1)?.toIntOrNull() ?: 0

    private val ITAG_NA_URL = Regex("[?&]itag=(\\d+)")

    /** Uma tentativa de download DIRETO (sem montagem): a faixa e o que ela é. */
    private class Alvo(val faixa: Faixa, val soAudio: Boolean)

    /**
     * BUSCA no YouTube, de dentro do app.
     *
     * A mesma biblioteca que extrai o vídeo também pesquisa, e a busca sai do
     * IP do aparelho como tudo o mais aqui. Isso resolve um caminho que era
     * absurdo: para achar um louvor, o operador saía do app, abria o YouTube,
     * pesquisava, compartilhava de volta e esperava. Agora ele digita uma vez,
     * na tela do acervo, e toca no resultado.
     *
     * As duas alternativas não serviam: um `<iframe>` da página de resultados é
     * recusado pelo `X-Frame-Options` do YouTube, e a API oficial exigiria uma
     * chave embutida no APK com cota diária dividida por toda a frota.
     *
     * **BLOQUEANTE** — fila de IO da ponte, como [buscar].
     *
     * A miniatura é montada a partir do ID (`i.ytimg.com/vi/<id>/mqdefault.jpg`)
     * em vez de vir da biblioteca: é uma URL estável há mais de uma década, e
     * assim o formato das imagens do extrator (que já mudou de forma entre
     * versões) deixa de ser algo que pode quebrar a lista.
     */
    fun pesquisar(termo: String, max: Int = 20): JSONArray {
        val out = JSONArray()
        if (termo.isBlank()) return out
        garantirInit()
        val svc = ServiceList.YouTube
        // Só VÍDEOS: canais e playlists não têm o que fazer numa lista cujo
        // único destino é virar um arquivo de mídia.
        val q = svc.getSearchQHFactory().fromQuery(termo, listOf("videos"), "")
        val ex = svc.getSearchExtractor(q)
        aportuguesar(ex)
        // `SearchInfo.getInfo(extractor)` NÃO busca a página sozinho (ao
        // contrário do `getInfo(service, query)` e do `StreamInfo.getInfo`):
        // sem este `fetchPage` a lista volta vazia, sem erro.
        ex.fetchPage()
        val info = SearchInfo.getInfo(ex)
        for (item in info.relatedItems) {
            if (item !is StreamInfoItem) continue
            val url = item.getUrl() ?: continue
            val id = ID_NA_URL.find(url)?.groupValues?.get(1) ?: continue
            out.put(
                JSONObject()
                    .put("id", id)
                    .put("url", url)
                    .put("name", tituloLimpo(item.getName(), item.getUploaderName()))
                    .put("author", item.getUploaderName() ?: "")
                    .put("seconds", item.getDuration())
                    .put("thumb", "https://i.ytimg.com/vi/$id/mqdefault.jpg"),
            )
            if (out.length() >= max) break
        }
        return out
    }

    /**
     * Tira o nome do CANAL da frente do título.
     *
     * Meio YouTube publica como "Arautos do Rei - Firme nas Promessas", e no
     * Cronograma isso vira uma lista em que a metade esquerda de toda linha é a
     * mesma palavra — justamente a parte que não distingue um item do outro. O
     * canal não se perde: ele aparece no subtítulo do resultado da busca, que é
     * onde ele ajuda a escolher.
     *
     * A remoção é CONSERVADORA de propósito: só corta quando o começo do título
     * é exatamente o nome do canal seguido de um separador. Um título que
     * simplesmente contenha um travessão ("Hino 512 - Ao Deus de Abraão")
     * continua inteiro — cortar por "tem um traço" estragaria mais nomes do que
     * arrumaria.
     *
     * `- Topic` é o sufixo dos canais que o YouTube gera sozinho para música
     * ("Arautos do Rei - Topic"): sem tirá-lo, a comparação nunca casaria
     * justamente nos vídeos de louvor, que são o caso mais comum aqui.
     */
    private fun tituloLimpo(titulo: String?, canal: String?): String {
        val t = titulo?.trim().orEmpty()
        if (t.isEmpty()) return "Vídeo do YouTube"
        val c = canal?.trim()?.removeSuffix("- Topic")?.trim().orEmpty()
        if (c.isEmpty()) return t
        val re = Regex("^" + Regex.escape(c) + "\\s*[-–—|:]\\s*", RegexOption.IGNORE_CASE)
        val limpo = t.replace(re, "").trim()
        // Título que era SÓ o nome do canal continua como estava: uma linha
        // vazia no Cronograma seria pior que um nome repetido.
        return limpo.ifEmpty { t }
    }

    /** `watch?v=<id>`, `youtu.be/<id>`, `/shorts/<id>` — o id tem 11 caracteres. */
    private val ID_NA_URL = Regex("(?:[?&]v=|/)([A-Za-z0-9_-]{11})(?:[?&#]|\\z)")

    /**
     * Apaga o arquivo depois que o lado web já copiou os bytes para a
     * biblioteca. Sem isto, cada vídeo ficaria DUAS vezes no aparelho — uma no
     * cache e outra no IndexedDB — e o cache não é limpo por ninguém.
     */
    fun descartar(ctx: Context, url: String) {
        // O DESFECHO GUARDADO MORRE AQUI, e este é o ponto certo: quem chama
        // acabou de copiar os bytes para a biblioteca, ou seja, o download foi
        // reclamado. Guardá-lo além disso apontaria para um arquivo que este
        // mesmo método está apagando.
        if (resgate != null && caminhoDe(url) == resgate?.arquivo) resgate = null
        try {
            val token = Uri.parse(url).lastPathSegment ?: return
            val alvo = SafRegistry.get(token) ?: return
            val f = alvo.path?.let { File(it) } ?: return
            if (f.parentFile == pasta(ctx)) f.delete()
        } catch (_: Exception) { /* o cache some sozinho no pior caso */ }
    }

    private fun pasta(ctx: Context) = File(ctx.cacheDir, "yt").apply { mkdirs() }

    /**
     * No CACHE, não em `files/`: estes arquivos são intermediários (viram um
     * blob no IndexedDB em seguida) e o cache é o único lugar que o Android
     * limpa sozinho sob pressão de espaço — e que as regras de backup já
     * ignoram sem precisar de linha nova em `backup_rules.xml`.
     */
    /**
     * Nomes distintos para vídeo e áudio do MESMO id: baixar as duas formas do
     * mesmo link (o operador muda de ideia, ou quer as duas) não pode fazer uma
     * sobrescrever a outra enquanto a primeira ainda está sendo copiada para a
     * biblioteca.
     *
     * O sufixo segue o PROPÓSITO ([soAudio]), não o contêiner. Enquanto ele
     * seguia o contêiner ("tudo que não é mp4 é áudio"), um download só-áudio em
     * WebM e uma montagem em WebM do mesmo vídeo disputavam exatamente o mesmo
     * nome — que é o caso que este sufixo existe para impedir.
     */
    private fun arquivoDestino(ctx: Context, id: String, ext: String, soAudio: Boolean): File =
        File(
            pasta(ctx),
            id.replace(Regex("[^A-Za-z0-9_-]"), "_")
                + (if (soAudio) "-audio" else "") + "." + ext,
        )

    /**
     * O melhor MP4 **progressivo** (vídeo + áudio no mesmo arquivo).
     *
     * `videoStreams` já são os muxados — `videoOnlyStreams` é a outra lista, e é
     * justamente a que não serve aqui. O filtro por MP4 não é preciosismo: o
     * WebView do Android toca H.264/MP4 em qualquer aparelho, e um `.webm` em
     * VP9/AV1 depende do modelo. Um vídeo que não abre no telão no meio do culto
     * é pior que um arquivo maior.
     *
     * **[teto] respeitado, mas nunca ao ponto de não entregar nada.** O maior
     * que couber; se NENHUM couber (o operador pediu 480p e este vídeo só tem
     * progressivo de 720p), vale o MENOR que existe. Devolver `null` ali seria
     * transformar "quero economizar dados" em "não baixa" — e o operador que
     * escolheu 480p quer o louvor, não a recusa. O menor é o que menos
     * desrespeita a escolha.
     */
    private fun melhorProgressivo(info: StreamInfo, teto: Int): VideoStream? {
        val mp4 = info.videoStreams
            .filter { it.isUrl && !it.getContent().isNullOrBlank() }
            .filter { !it.isVideoOnly }
            .filter { it.getFormat()?.getSuffix()?.equals("mp4", true) == true }
        if (mp4.isEmpty()) return null
        return mp4.filter { alturaDe(it.getResolution()) <= teto }
            .maxByOrNull { alturaDe(it.getResolution()) }
            ?: mp4.minByOrNull { alturaDe(it.getResolution()) }
    }

    /** "1080p60" → 1080. Resolução ilegível vira 0: ela nunca ganha do resto. */
    private fun alturaDe(res: String?): Int =
        Regex("(\\d+)").find(res ?: "")?.groupValues?.get(1)?.toIntOrNull() ?: 0

    /**
     * Baixa em streaming, reportando o andamento. Um louvor tem centenas de MB
     * e o percentual é a única coisa que separa "baixando" de "travado" na tela
     * do operador.
     */
    /**
     * Baixa tentando os perfis de cliente, e devolve o que funcionou
     * ("V" = visionOS, "A" = Android/Chrome) — o rótulo entra no diagnóstico.
     *
     * **O perfil que COMBINA com a URL vem primeiro** (v1.49). Uma URL emitida
     * para um cliente costuma ser servida só a quem se anuncia como ele, e o
     * próprio `c=` da URL diz qual é — pedir uma faixa do visionOS anunciando um
     * Chrome de Android é o tipo de incoerência que o CDN responde com 403.
     *
     * O outro perfil continua atrás, como rede de segurança: no pior caso custa
     * uma requisição perdida, e um 403 falha antes do primeiro byte. O perfil
     * iOS SAIU da fila: com o cliente iOS desligado no extrator
     * ([garantirInit]) nenhuma URL sai carimbada com ele, e mantê-lo fazia toda
     * falha real pagar uma requisição extra com um UA que o CDN nunca pediu.
     */
    /**
     * O `User-Agent` que combina com esta URL, lido do `c=` que o CDN carimbou
     * nela.
     *
     * Público porque o [StreamProxy] precisa exatamente da mesma decisão: ele
     * serve as MESMAS URLs, e pedi-las anunciando outro cliente é o caminho
     * conhecido para um 403. Uma segunda tabela lá envelheceria em silêncio na
     * primeira vez que a biblioteca trocasse de cliente.
     */
    fun uaPara(url: String): String =
        if (clienteDe(url) == "VISIONOS") UA_VISIONOS else UA

    private fun baixarTentando(
        url: String,
        destino: File,
        onProgresso: (Long, Long) -> Unit,
    ): String {
        val combina = if (clienteDe(url) == "VISIONOS") "V" else "A"

        // `sortedBy` é estável, então os perfis que não combinam mantêm a ordem
        // em que estão escritos aqui.
        val perfis = listOf("V" to UA_VISIONOS, "A" to UA)
            .sortedBy { if (it.first == combina) 0 else 1 }
        var erro: Exception? = null
        for ((rotulo, ua) in perfis) {
            try {
                baixar(url, destino, ua, onProgresso)
                if (destino.length() > 0L) return rotulo
            } catch (e: Exception) {
                erro = e
                // O PARCIAL FICA para o próximo perfil: trocar o UA muda o
                // CABEÇALHO, não a URL — mesma URL ⇒ mesmos bytes, a premissa
                // da retomada (v1.58) — e a conferência de [parciais] já
                // garante que o que está no disco é DESTA URL. Apagar aqui
                // jogava fora os MB que a tentativa seguinte retomaria.
                //
                // CANCELAR não é "este perfil de UA não deu": tentar o outro em
                // seguida faria o operador esperar mais DEPOIS de pedir para
                // parar. Só aqui o parcial sai: sem download à vista, ele é
                // lixo no cache.
                if (cancelado()) {
                    destino.delete()
                    break
                }
            }
        }
        throw erro ?: IOException("download vazio")
    }

    /**
     * QUANTAS VEZES insistir quando a rede oscila, e o intervalo entre elas.
     *
     * O download de um louvor de 1080p leva minutos numa rede de igreja, e uma
     * queda de 20 segundos no meio dele derrubava a coisa inteira: a tentativa
     * seguinte recomeçava do byte ZERO, e depois de três perfis de UA o
     * download simplesmente falhava. Do lado do operador isso é indistinguível
     * de "o app não baixa".
     *
     * Oito tentativas com espera crescente cobrem ~2 min de oscilação — e, com
     * a retomada abaixo, elas continuam de onde pararam em vez de recomeçar.
     * Passado isso, falhar é honesto: quem decide se tenta de novo é o
     * operador, que tem a linha do resultado para tocar outra vez.
     */
    private const val MAX_RETENTATIVAS = 8
    private val ESPERAS_MS = longArrayOf(1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 30_000, 30_000)

    /**
     * Baixa [url] em [destino], **retomando de onde parou** e insistindo quando
     * a rede oscila.
     *
     * ## Por que retomar, e não só repetir
     *
     * Repetir do zero num arquivo de 380 MB não é uma segunda chance: é uma
     * aposta de que a rede vai aguentar a corrida inteira desta vez. Retomar
     * transforma uma queda de rede em alguns segundos perdidos — e as URLs do
     * googlevideo aceitam faixa de bytes por construção (é assim que um player
     * de verdade as consome).
     *
     * ## O que NÃO é retentado
     *
     * - **Cancelamento** (ver [cancelar]): o operador pediu para parar.
     * - **Recusa do CDN** (4xx): a URL expirou ou a faixa foi negada, e insistir
     *   nela é só perder tempo — quem decide o que fazer é a fila de candidatos
     *   de quem chamou, que tem outras URLs para tentar.
     */
    /**
     * De qual URL é cada arquivo parcial no disco — a trava que impede a
     * retomada de emendar faixas DIFERENTES.
     *
     * O destino é nomeado por vídeo + contêiner (`arquivoDestino`), não por
     * faixa: dois itags do mesmo contêiner (137 e 136, ambos mp4) escrevem no
     * MESMO caminho. Sem esta conferência, um parcial do 137 deixado por um app
     * morto seria "retomado" por um download do 136 — e o arquivo resultante
     * teria dois vídeos emendados, sem erro nenhum, aparecendo só na hora de
     * projetar.
     *
     * Em memória de propósito: ela morre com o processo, e é isso que se quer.
     * Retomar entre execuções exigiria gravar qual faixa era, e o ganho (o
     * parcial de um app que foi morto) não paga o risco de errar a conta.
     */
    private val parciais = java.util.concurrent.ConcurrentHashMap<String, String>()

    private fun baixar(
        url: String,
        destino: File,
        ua: String,
        onProgresso: (Long, Long) -> Unit,
    ) {
        var tentativa = 0
        while (true) {
            // O QUE JÁ ESTÁ NO DISCO é o ponto de retomada — e só quando ele for
            // COMPROVADAMENTE desta mesma URL (ver [parciais]). Lido a cada
            // volta, e não uma vez só: a tentativa anterior pode ter avançado
            // bastante antes de cair, e é esse avanço que não se quer perder.
            val meu = parciais[destino.path] == url
            val jaTem = if (meu && destino.isFile) destino.length() else 0L
            parciais[destino.path] = url
            try {
                baixarUmaVez(url, destino, ua, jaTem, onProgresso)
                // COMPLETO: a marca sai. Deixá-la faria a chamada seguinte pedir
                // `Range` a partir do fim do arquivo, e o CDN responderia 416 —
                // um download que falha porque já tinha dado certo.
                parciais.remove(destino.path)
                return
            } catch (e: IOException) {
                if (cancelado()) throw e
                if (e is RecusaDoCdn) throw e
                if (++tentativa > MAX_RETENTATIVAS) throw e
                val espera = ESPERAS_MS[(tentativa - 1).coerceAtMost(ESPERAS_MS.size - 1)]
                Log.i(TAG, "queda no download (${e.message}) — tentativa $tentativa em ${espera}ms, retomando de $jaTem")
                if (!dormir(espera)) throw e   // cancelado durante a espera
            }
        }
    }

    /** Uma exceção que NÃO se retenta: o CDN recusou (URL expirada, 403…). */
    private class RecusaDoCdn(msg: String) : IOException(msg)

    /**
     * Espera [ms], acordando a cada 250 ms para ver se o operador cancelou.
     * Devolve `false` quando o cancelamento chegou — aí não há o que esperar.
     */
    private fun dormir(ms: Long): Boolean {
        var restante = ms
        while (restante > 0) {
            if (cancelado()) return false
            val fatia = minOf(250L, restante)
            try { Thread.sleep(fatia) } catch (_: InterruptedException) { return false }
            restante -= fatia
        }
        return !cancelado()
    }

    private fun baixarUmaVez(
        url: String,
        destino: File,
        ua: String,
        jaTem: Long,
        onProgresso: (Long, Long) -> Unit,
    ) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = CONECTA_MS
            readTimeout = LE_MS
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", ua)
            // `Range` SEMPRE (v1.46). As URLs adaptativas do googlevideo
            // costumam recusar uma requisição sem faixa — é assim que um player
            // de verdade as consome (aos pedaços), e é a diferença entre 403 e
            // 206 em vários casos. Para o progressivo, que já funcionava, pedir
            // a faixa inteira não muda nada.
            //
            // E é ele que RETOMA: começando no que já está no disco, uma queda
            // de rede custa os segundos da reconexão, não o download inteiro.
            setRequestProperty("Range", "bytes=$jaTem-")
        }
        try {
            // O CÓDIGO LIDO DA CONEXÃO, e não adivinhado depois na mensagem da
            // exceção: `conn.inputStream` lança `FileNotFoundException` cuja
            // mensagem é só a URL, e uma URL do googlevideo tem `dur=423.061`
            // dentro. Foi assim que o diagnóstico da v1.45 anunciou um "HTTP
            // 423" que nunca existiu — ele leu a DURAÇÃO do vídeo e chamou de
            // código de erro. Diagnóstico que inventa número é pior que
            // diagnóstico nenhum: manda consertar o que não está quebrado.
            val codigo = conn.responseCode
            // 206 é a resposta ESPERADA agora que pedimos `Range`.
            if (codigo != HttpURLConnection.HTTP_OK && codigo != HttpURLConnection.HTTP_PARTIAL) {
                // 4xx é RECUSA, não oscilação: a URL expirou ou a faixa foi
                // negada. Insistir nela é perder tempo — quem tem outras cartas
                // é a fila de candidatos de quem chamou.
                if (codigo in 400..499) throw RecusaDoCdn("HTTP $codigo")
                throw IOException("HTTP $codigo")
            }
            // O SERVIDOR IGNOROU A FAIXA. Pedimos a partir de `jaTem` e ele
            // mandou o arquivo inteiro (200 em vez de 206): continuar
            // acrescentando produziria um arquivo com o começo repetido no meio
            // — corrupção silenciosa, que só apareceria na hora de tocar. Aqui o
            // certo é começar de novo, do zero.
            val retomando = jaTem > 0 && codigo == HttpURLConnection.HTTP_PARTIAL
            val base = if (retomando) jaTem else 0L
            // `contentLengthLong` num 206 é o que FALTA, não o tamanho total.
            val total = conn.contentLengthLong.coerceAtLeast(0L).let { if (it > 0) base + it else 0L }
            var lidos = 0L
            var ultimo = 0L
            conn.inputStream.use { entrada ->
                java.io.FileOutputStream(destino, retomando).use { saida ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        // O PEDIDO DE CANCELAMENTO é consultado aqui, a cada
                        // bloco: é o único ponto do download que roda com
                        // frequência suficiente para responder na hora, e sair
                        // por exceção reaproveita a limpeza que já existe (o
                        // `destino.delete()` de quem chamou).
                        if (cancelado()) throw IOException(CANCELADO)
                        val n = entrada.read(buf)
                        if (n < 0) break
                        saida.write(buf, 0, n)
                        lidos += n
                        // Um aviso por MB: o WebView é acordado a cada um deles,
                        // e reportar a cada 64 KB seria mais trabalho de ponte do
                        // que de download.
                        if (lidos - ultimo >= 1024 * 1024) {
                            ultimo = lidos
                            // ABSOLUTO, contando o que já estava no disco: uma
                            // retomada que reportasse só o pedaço desta conexão
                            // faria a barra voltar ao começo a cada queda de
                            // rede — que é exatamente a sensação que a retomada
                            // existe para eliminar.
                            onProgresso(base + lidos, total)
                        }
                    }
                }
            }
            onProgresso(base + lidos, total)
        } finally {
            conn.disconnect()
        }
    }

    /**
     * O [Downloader] que o extrator usa para tudo. `HttpURLConnection` e nada
     * mais — acrescentar um cliente HTTP de terceiro para servir a uma única
     * biblioteca seria trocar uma exceção por duas.
     */
    private object NpDownloader : Downloader() {

        override fun execute(request: Request): Response {
            val conn = (URL(request.url()).openConnection() as HttpURLConnection).apply {
                connectTimeout = CONECTA_MS
                readTimeout = LE_MS
                instanceFollowRedirects = true
                requestMethod = request.httpMethod()
            }
            try {
                for ((chave, valores) in request.headers()) {
                    if (chave == null) continue
                    for (v in valores) conn.addRequestProperty(chave, v)
                }
                if (conn.getRequestProperty("User-Agent") == null) {
                    conn.setRequestProperty("User-Agent", UA)
                }
                // O idioma do pedido também vai no CABEÇALHO. Quem manda de
                // fato é o `hl` do corpo InnerTube, mas nem toda requisição da
                // biblioteca é InnerTube (há páginas HTML no caminho), e é
                // justamente o `Accept-Language` que decide o idioma nelas —
                // que é o que fazem os downloaders de referência do NewPipe.
                // Sempre pt-BR, e não o `request.localization()`: é ele que
                // pode vir com o en-GB que o filtro de idiomas suportados da
                // biblioteca impõe (ver IDIOMA), e aí o cabeçalho desfaria
                // justamente o que o `forceLocalization` acabou de corrigir.
                if (conn.getRequestProperty("Accept-Language") == null) {
                    conn.setRequestProperty("Accept-Language", IDIOMA.localizationCode)
                }
                request.dataToSend()?.let { corpo ->
                    conn.doOutput = true
                    conn.setFixedLengthStreamingMode(corpo.size)
                    conn.outputStream.use { it.write(corpo) }
                }

                val code = conn.responseCode
                // 429 é o "confirme que você não é um robô" do YouTube. O
                // extrator sabe tratar essa exceção; um 429 devolvido como
                // resposta normal viraria um erro de parsing sem sentido.
                if (code == 429) throw ReCaptchaException("reCaptcha", request.url())

                val corpo = (if (code >= 400) conn.errorStream else conn.inputStream)
                    ?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""

                // `headerFields` traz a linha de status numa entrada de chave
                // NULA. Repassá-la é um NullPointerException dentro da
                // biblioteca, num ponto que não tem nada a ver com a causa.
                val cabecalhos = LinkedHashMap<String, List<String>>()
                for ((chave, valores) in conn.headerFields) {
                    if (chave != null) cabecalhos[chave] = valores
                }

                return Response(code, conn.responseMessage, cabecalhos, corpo, conn.url.toString())
            } catch (e: ReCaptchaException) {
                throw e
            } catch (e: Exception) {
                throw IOException(e)
            } finally {
                conn.disconnect()
            }
        }
    }
}
