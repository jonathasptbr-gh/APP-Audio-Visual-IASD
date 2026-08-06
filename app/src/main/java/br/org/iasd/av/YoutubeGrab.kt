package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.os.Build
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
     * O UA do app do YouTube no iPhone.
     *
     * Uma URL emitida para um cliente costuma ser servida só a quem se anuncia
     * como ele — baixá-la com o UA errado é o tipo de incoerência que o CDN
     * responde com 403. O cliente iOS está desligado desde a v1.49 (ver
     * [garantirInit]), então na prática nenhuma URL sai por ele hoje; o perfil
     * fica na fila de [baixarTentando] como rede de segurança, e custa no
     * máximo uma requisição perdida.
     */
    private const val UA_IOS =
        "com.google.ios.youtube/21.03.2(iPhone16,2; U; CPU iOS 18_7_2 like Mac OS X; )"

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
     * TODA faixa adaptativa foi recusada (403) nesta execução do app.
     *
     * Enquanto a biblioteca só sabia pedir sem token, isso era a regra e não a
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
     * morreram com 403, e no mínimo dois.
     *
     * Por PROCESSO, e não persistido: se o YouTube afrouxar (ou se o vídeo
     * seguinte não for protegido), basta reabrir o app para tentar de novo — e
     * um estado gravado em disco transformaria uma recusa de um dia numa
     * desistência permanente.
     */
    @Volatile
    private var adaptativoBloqueado = false

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
     * O código HTTP é o que separa as duas causas possíveis: **403** é o YouTube
     * recusando a URL (é o que acontece com as faixas protegidas por PO Token,
     * e nesse caso não há o que fazer no app), qualquer outra coisa é rede ou
     * arquivo. `HttpURLConnection` não devolve o código quando o `inputStream`
     * lança — ele vai no texto da exceção —, daí a extração pelo regex.
     */
    private fun motivo(e: Exception): String {
        // A mensagem de "HTTP nnn" é NOSSA (ver `baixar`), então dá para usá-la
        // como está. Nada de procurar três dígitos no texto: a v1.45 fazia isso
        // e leu a duração de dentro da URL (`dur=423.061`) como se fosse um
        // código HTTP — o diagnóstico apontou para um erro que não existia.
        val msg = e.message.orEmpty()
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
                val destino = arquivoDestino(ctx, id, alvo.faixa.ext, alvo.soAudio)
                try {
                    baixarTentando(alvo.faixa.url, destino, onProgresso)
                } catch (e: Exception) {
                    Log.w(TAG, "falhou baixando ${alvo.faixa.etiqueta} de $link", e)
                    diagnostico += " · ${alvo.faixa.etiqueta} " + motivo(e)
                    destino.delete()
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
            null
        }
    }

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
            diagnostico = resumo(info)
            // A MESMA fila de candidatos do download, e não uma segunda regra:
            // a ordem por cliente (visionOS primeiro) é o que faz a faixa
            // escolhida ser uma que o CDN de fato serve.
            val v = candidatosVideo(info, 0, teto).firstOrNull { it.dash && !it.webm }
            val a = candidatosAudio(info, "m4a", TETO_AUDIO).firstOrNull { it.dash }
            if (v == null || a == null) {
                diagnostico += " · sem par DASH para transmitir"
                return null
            }
            diagnostico += " → transmitindo ${v.altura}p (${v.etiqueta} + ${a.etiqueta})"
            JSONObject()
                .put("name", tituloLimpo(info.name, info.uploaderName))
                .put("seconds", info.duration)
                .put("height", v.altura)
                .put("video", faixaJson(v))
                .put("audio", faixaJson(a))
        } catch (e: Exception) {
            Log.w(TAG, "não deu para montar o manifesto de $link", e)
            null
        }
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
        if (adaptativoBloqueado) {
            diagnostico += " · adaptativo bloqueado nesta sessão"
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
                        candidatosAudio(info, extAudio, TETO_AUDIO), onProgresso,
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

        // O DESLIGAMENTO DA SESSÃO EXIGE UNANIMIDADE — ver [adaptativoBloqueado].
        // Com o pool misturado, um 403 isolado é o comportamento NORMAL de uma
        // faixa envenenada com uma boa logo atrás na fila; desligar o caminho
        // inteiro por causa dele seria o autogol.
        if (tentados >= 2 && recusas403 == tentados) adaptativoBloqueado = true
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
        onProgresso: (Long, Long) -> Unit,
    ): File? {
        if (candidatos.isEmpty()) {
            diagnostico += " · $ext sem áudio"
            return null
        }
        val destino = File(pasta(ctx), "$id-a.$ext")
        for (a in candidatos) {
            try {
                // A BARRA É UMA SÓ. O áudio ocupa os primeiros 10% e o vídeo o
                // resto, que é a proporção real — em vez de duas barras que
                // voltam ao zero no meio, o que do lado do operador é
                // indistinguível de travamento.
                baixarTentando(a.url, destino) { lidos, total ->
                    if (total > 0) onProgresso(lidos * 10 / total, 100)
                }
                if (destino.length() > 0L) return destino
                diagnostico += " · a:${a.etiqueta} vazio"
            } catch (e: Exception) {
                Log.w(TAG, "falhou o áudio ${a.etiqueta} de $id", e)
                diagnostico += " · a:${a.etiqueta} " + motivo(e)
            }
            destino.delete()
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
            val perfil = baixarTentando(v.url, parteVideo) { lidos, total ->
                if (total > 0) onProgresso(10 + lidos * 88 / total, 100)
            }
            if (parteVideo.length() <= 0L) {
                diagnostico += " · v:${v.etiqueta} vazio"
                return Desfecho.NaoMontou
            }
            onProgresso(99, 100)
            if (!MuxMp4.juntar(parteVideo, parteAudio, saida, v.webm)) {
                diagnostico += " · v:${v.etiqueta} muxer falhou"
                return Desfecho.NaoMontou
            }
            if (saida.length() <= 0L) {
                diagnostico += " · v:${v.etiqueta} saída vazia"
                return Desfecho.NaoMontou
            }
            onProgresso(100, 100)
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

        /** Dá para transmitir esta faixa por MSE? */
        val dash: Boolean = idxFim > idxIni && initFim > initIni && tamanho > 0 && codec.isNotEmpty()

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
     */
    private fun candidatosVideo(info: StreamInfo, piso: Int, teto: Int): List<Faixa> =
        info.videoOnlyStreams
            .mapNotNull { faixaDe(it) }
            // O par WebM exige Android 10: o muxer só passou a escrever Opus
            // dentro de WebM na API 29. Abaixo disso ele nem entra na fila.
            .filter {
                it.ext == "mp4" ||
                    (it.webm && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            }
            .filter { it.altura in (piso + 1)..teto }
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
     * ("V" = visionOS, "i" = iOS, "A" = Android/Chrome) — o rótulo entra no
     * diagnóstico.
     *
     * **O perfil que COMBINA com a URL vem primeiro** (v1.49). Uma URL emitida
     * para um cliente costuma ser servida só a quem se anuncia como ele, e o
     * próprio `c=` da URL diz qual é — pedir uma faixa do visionOS anunciando um
     * Chrome de Android é o tipo de incoerência que o CDN responde com 403.
     * Antes disto a ordem era fixa (Android, depois iOS) e a faixa boa podia ser
     * perdida na primeira tentativa.
     *
     * Os outros perfis continuam atrás, como rede de segurança: no pior caso
     * custam uma requisição perdida, e um 403 falha antes do primeiro byte.
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
    fun uaPara(url: String): String = when (clienteDe(url)) {
        "VISIONOS" -> UA_VISIONOS
        "IOS" -> UA_IOS
        else -> UA
    }

    private fun baixarTentando(
        url: String,
        destino: File,
        onProgresso: (Long, Long) -> Unit,
    ): String {
        val combina = when (clienteDe(url)) {
            "VISIONOS" -> "V"
            "IOS" -> "i"
            else -> "A"
        }
        
        // `sortedBy` é estável, então os perfis que não combinam mantêm a ordem
        // em que estão escritos aqui.
        val perfis = listOf("V" to UA_VISIONOS, "i" to UA_IOS, "A" to UA)
            .sortedBy { if (it.first == combina) 0 else 1 }
        var erro: Exception? = null
        for ((rotulo, ua) in perfis) {
            try {
                baixar(url, destino, ua, onProgresso)
                if (destino.length() > 0L) return rotulo
            } catch (e: Exception) {
                erro = e
                destino.delete()
            }
        }
        throw erro ?: IOException("download vazio")
    }

    private fun baixar(
        url: String,
        destino: File,
        ua: String = UA,
        onProgresso: (Long, Long) -> Unit,
    ) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = CONECTA_MS
            readTimeout = LE_MS
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", ua)
            // `Range` DESDE O PRIMEIRO BYTE (v1.46). As URLs adaptativas do
            // googlevideo costumam recusar uma requisição sem faixa — é assim
            // que um player de verdade as consome (aos pedaços), e é a
            // diferença entre 403 e 206 em vários casos. Para o progressivo,
            // que já funcionava, pedir a faixa inteira não muda nada.
            setRequestProperty("Range", "bytes=0-")
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
                throw IOException("HTTP $codigo")
            }
            val total = conn.contentLengthLong.coerceAtLeast(0L)
            var lidos = 0L
            var ultimo = 0L
            conn.inputStream.use { entrada ->
                destino.outputStream().use { saida ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = entrada.read(buf)
                        if (n < 0) break
                        saida.write(buf, 0, n)
                        lidos += n
                        // Um aviso por MB: o WebView é acordado a cada um deles,
                        // e reportar a cada 64 KB seria mais trabalho de ponte do
                        // que de download.
                        if (lidos - ultimo >= 1024 * 1024) {
                            ultimo = lidos
                            onProgresso(lidos, total)
                        }
                    }
                }
            }
            onProgresso(lidos, total)
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
