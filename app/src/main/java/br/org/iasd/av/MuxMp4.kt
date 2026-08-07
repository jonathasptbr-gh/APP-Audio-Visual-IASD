package br.org.iasd.av

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.File
import java.nio.ByteBuffer

/**
 * Junta um arquivo **só de vídeo** e um **só de áudio** num MP4 único.
 *
 * ## Por que isto existe
 *
 * O YouTube guarda as resoluções altas em faixas SEPARADAS: acima de 720p o
 * vídeo vem sem som, e o som vem à parte. Medido no aparelho em que o app é
 * operado, o que chega hoje é `vídeo-só 12 (1080p)` e `áudio 5` — mas o único
 * formato progressivo (vídeo e áudio no mesmo arquivo, o que o app sabia baixar)
 * é **um, de 360p**. Ou seja: o material bom estava lá o tempo todo, e o app
 * baixava a pior cópia disponível porque era a única que não precisava ser
 * montada.
 *
 * ## Por que a plataforma basta
 *
 * Isto NÃO recodifica nada. `MediaExtractor` lê as amostras já comprimidas e
 * `MediaMuxer` as escreve noutro contêiner — os bits do vídeo e do áudio são os
 * mesmos que vieram do YouTube. É cópia, não conversão: não há perda de
 * qualidade, o processador quase não trabalha e um louvor de dez minutos é
 * questão de segundos.
 *
 * As duas classes são do **Android** desde a API 18, então não entra dependência
 * nova — é o mesmo argumento do `PdfRenderer` para as apresentações. Um ffmpeg
 * embarcado resolveria o mesmo problema custando dezenas de MB no APK e uma
 * biblioteca nativa para manter.
 *
 * ## O contêiner de saída acompanha o de entrada
 *
 * `MUXER_OUTPUT_MPEG_4` recebe H.264/H.265 no vídeo e AAC no áudio;
 * `MUXER_OUTPUT_WEBM` recebe VP8/VP9 com Vorbis ou Opus (este último a partir
 * da API 29). É por isso que quem escolhe as faixas ([YoutubeGrab]) forma PARES
 * do mesmo contêiner — mp4+m4a ou webm+webm — em vez de pegar "a melhor" de
 * cada lado: um VP9 dentro de um MP4 é justamente o que o muxer recusa, e a
 * recusa viria só no fim, depois de baixar tudo.
 *
 * Os dois tocam no WebView, que é o mesmo Chromium do Chrome.
 */
object MuxMp4 {

    private const val TAG = "MuxMp4"

    /**
     * Tamanho do balde de leitura de cada amostra. O formato costuma declarar o
     * seu em `KEY_MAX_INPUT_SIZE`; quando não declara, 2 MB cobre com folga um
     * quadro-chave de 1080p (a maior amostra que aparece aqui).
     *
     * Uma amostra maior que o balde faria `readSampleData` devolver -1 e o
     * arquivo sairia truncado — daí o `coerceAtLeast`, que impede um valor
     * declarado pequeno demais de virar corte no meio do louvor.
     */
    private const val BALDE_PADRAO = 2 * 1024 * 1024

    /**
     * Devolve `true` se o MP4 de [saida] foi escrito com as duas faixas.
     *
     * Em qualquer falha devolve `false` **sem lançar**: quem chama tem um plano
     * B (o progressivo), e uma exceção subindo daqui derrubaria um download que
     * ainda tem como terminar bem.
     */
    fun juntar(video: File, audio: File, saida: File, webm: Boolean = false): Boolean {
        val exVideo = MediaExtractor()
        val exAudio = MediaExtractor()
        var muxer: MediaMuxer? = null
        var iniciado = false
        // O desfecho é uma VARIÁVEL, e o `return` vem DEPOIS do finally: um
        // `return true` computado dentro do `try` era carimbado antes de o
        // `stop()` do finally rodar — e um `stop()` que lança (trilha sem
        // amostras) era engolido com a função já devolvendo sucesso, MP4 sem
        // `moov` entregue como bom.
        var ok = false
        try {
            exVideo.setDataSource(video.absolutePath)
            exAudio.setDataSource(audio.absolutePath)
            val trilhaVideo = acharTrilha(exVideo, "video/")
            val trilhaAudio = acharTrilha(exAudio, "audio/")
            if (trilhaVideo < 0 || trilhaAudio < 0) {
                Log.w(TAG, "faltou trilha (vídeo=$trilhaVideo, áudio=$trilhaAudio)")
            } else {
                exVideo.selectTrack(trilhaVideo)
                exAudio.selectTrack(trilhaAudio)
                val fmtVideo = exVideo.getTrackFormat(trilhaVideo)
                val fmtAudio = exAudio.getTrackFormat(trilhaAudio)

                // O contêiner de SAÍDA acompanha o de ENTRADA: AVC/AAC num MP4,
                // VP9/Opus num WebM. Misturar (VP9 dentro de MP4) é o que o muxer
                // recusa — e recusa só depois de tudo baixado, que é o pior momento.
                muxer = MediaMuxer(
                    saida.absolutePath,
                    if (webm) MediaMuxer.OutputFormat.MUXER_OUTPUT_WEBM
                    else MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4,
                )
                val destinoVideo = muxer.addTrack(fmtVideo)
                val destinoAudio = muxer.addTrack(fmtAudio)
                muxer.start()
                iniciado = true

                copiar(exVideo, muxer, destinoVideo, balde(fmtVideo))
                copiar(exAudio, muxer, destinoAudio, balde(fmtAudio))
                ok = true
            }
        } catch (e: Exception) {
            Log.w(TAG, "falhou ao juntar", e)
            ok = false
        } finally {
            // O `stop()` é o que fecha o índice do MP4 (o `moov`): sem ele o
            // arquivo existe, tem tamanho e NÃO ABRE. Ele mora aqui, e não no
            // fim do `try`, para valer também quando a cópia morre no meio — e
            // se ELE lançar, o arquivo saiu sem índice: o sucesso vira falha
            // aqui, nunca silêncio. Lançando ou não, o `release` acontece.
            if (muxer != null) {
                if (iniciado) {
                    try {
                        muxer.stop()
                    } catch (e: Exception) {
                        Log.w(TAG, "stop() falhou — saiu sem índice", e)
                        ok = false
                    }
                }
                try { muxer.release() } catch (_: Exception) {}
            }
            try { exVideo.release() } catch (_: Exception) {}
            try { exAudio.release() } catch (_: Exception) {}
            // Um MP4 sem índice é pior que arquivo nenhum: ele passaria no teste
            // de "tem bytes?" de quem chamou e só falharia na frente da
            // congregação. QUALQUER desfecho que não seja sucesso apaga a saída
            // — inclusive a cópia que morreu com o muxer já iniciado, que antes
            // deixava o arquivo quebrado no cache.
            if (!ok) saida.delete()
        }
        return ok
    }

    /** O índice da primeira trilha cujo mime começa com [prefixo], ou -1. */
    private fun acharTrilha(ex: MediaExtractor, prefixo: String): Int {
        for (i in 0 until ex.trackCount) {
            val mime = ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith(prefixo)) return i
        }
        return -1
    }

    private fun balde(fmt: MediaFormat): Int {
        val declarado = try {
            if (fmt.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                fmt.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
            } else 0
        } catch (_: Exception) { 0 }
        return declarado.coerceAtLeast(BALDE_PADRAO)
    }

    /**
     * Copia as amostras da trilha selecionada, uma a uma, preservando o tempo de
     * apresentação e a marca de quadro-chave.
     *
     * O `presentationTimeUs` vem do extrator e é escrito como está: as duas
     * faixas nasceram do MESMO vídeo, então as linhas do tempo já concordam —
     * não há nada a alinhar aqui, e inventar um deslocamento seria dessincronizar
     * o que já estava sincronizado.
     */
    private fun copiar(ex: MediaExtractor, muxer: MediaMuxer, trilha: Int, tamanhoBalde: Int) {
        val balde = ByteBuffer.allocate(tamanhoBalde)
        val info = MediaCodec.BufferInfo()
        while (true) {
            val lidos = ex.readSampleData(balde, 0)
            if (lidos < 0) break
            info.offset = 0
            info.size = lidos
            info.presentationTimeUs = ex.sampleTime
            // `sampleFlags` do extrator e `flags` do muxer são conjuntos
            // DIFERENTES de constantes; só o bit de sincronismo tem par nos dois,
            // e é o único que importa para um arquivo que vai ser tocado do
            // começo (é ele que marca onde o seek pode cair).
            info.flags = if (ex.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) {
                MediaCodec.BUFFER_FLAG_KEY_FRAME
            } else 0
            muxer.writeSampleData(trilha, balde, info)
            ex.advance()
        }
    }
}
