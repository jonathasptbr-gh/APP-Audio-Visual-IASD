package br.org.iasd.av

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.security.SecureRandom

/**
 * O oráculo do [EspelhoPares] — PIN, aprovação, token, prazo e bloqueio.
 *
 * A outra metade da justificativa da QUARTA EXCEÇÃO (o JUnit; ver
 * `app/build.gradle.kts`). Aqui um erro não vira pixel errado: vira uma tela
 * desconhecida projetando o culto, ou o operador trancado para fora do próprio
 * recurso.
 *
 * **Todo relógio entra por parâmetro.** Nenhum caso deste arquivo espera um
 * segundo de verdade — é por isso que dá para testar prazo de seis horas e
 * bloqueio de um minuto no mesmo CI que roda em segundos.
 */
class EspelhoParesTest {

    private val t0 = 1_000_000L
    private val origem = "192.168.0.77"
    private lateinit var pin: String

    @Before
    fun ligar() {
        pin = EspelhoPares.ligar(t0)
    }

    /**
     * O [EspelhoPares] é um `object` — estado de processo. Desligar depois de
     * cada caso é o que garante que um teste não veja a sessão do anterior (o
     * [ligar] já zeraria, mas depender disso seria depender da ordem).
     */
    @After
    fun desligar() {
        EspelhoPares.desligar()
    }

    private fun relato(ua: String = "Chrome/141") = EspelhoPares.Relato(
        ua = ua,
        w = 1920,
        h = 1080,
        seguro = false,
        mse = true,
        mms = false,
        fetchStream = true,
        videoDecoder = false,
        wakeLock = false,
        telaAcesaMin = 0,
    )

    private fun pinErrado() = if (pin == "000000") "111111" else "000000"

    /** Pareia e aprova, devolvendo a sessão. */
    private fun parear(de: String = origem, agora: Long = t0): EspelhoPares.Sessao {
        val v = EspelhoPares.tentar(pin, de, relato(), agora)
        val id = (v as EspelhoPares.Veredito.Espera).id
        return EspelhoPares.aprovar(id, agora)!!
    }

    // --------------------------------------------------------------------- PIN

    @Test
    fun pinTemSeisDigitos() {
        assertTrue(pin, Regex("^[0-9]{6}$").matches(pin))
        // E os zeros à esquerda sobrevivem — um PIN de 5 dígitos na tela seria
        // impossível de digitar num campo que espera 6.
        val rnd = SecureRandom()
        repeat(500) {
            val p = EspelhoPares.novoPin(rnd)
            assertTrue(p, Regex("^[0-9]{6}$").matches(p))
        }
    }

    /**
     * Invariante 6, a metade que quase ninguém escreve: o PIN **não rotaciona**
     * por tentativa errada. Rotacionar seria negação de serviço contra o
     * pareamento legítimo — o atacante erra de propósito e o visitante que está
     * digitando recebe "PIN inválido" para sempre.
     */
    @Test
    fun pinNaoRotacionaComTentativaErrada() {
        repeat(ERRADAS) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertEquals(pin, EspelhoPares.pin())
    }

    @Test
    fun trocarPinEAcaoDoOperadorENaoDerrubaSessao() {
        val s = parear()
        // Três trocas: um PIN sorteado pode repetir o anterior (1 em 1 milhão), e
        // um teste que reprova por azar é pior que teste nenhum. Quatro valores
        // todos iguais é 1 em 1e18 — isso não acontece.
        val vistos = (1..3).map { EspelhoPares.trocarPin() }.toSet() + pin
        assertTrue(vistos.size > 1)
        for (p in vistos) assertTrue(p, Regex("^[0-9]{6}$").matches(p))
        // E trocar o PIN não derruba quem já entrou — é isso que o separa de
        // desligar.
        assertNotNull(EspelhoPares.validar("Bearer ${s.token}", t0))
    }

    // -------------------------------------------------------------- pareamento

    /** Acertar o PIN dá vaga na fila do operador, não acesso (invariante 5). */
    @Test
    fun pinCertoEntraNaFilaDoOperador() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        assertTrue(v is EspelhoPares.Veredito.Espera)
        val id = (v as EspelhoPares.Veredito.Espera).id
        assertSame(EspelhoPares.Consulta.Aguardando, EspelhoPares.consultar(id, t0))
        assertEquals(1, EspelhoPares.pendentes().size)
        assertEquals(id, EspelhoPares.pendentes()[0].id)
    }

    @Test
    fun aprovarEntregaOTokenAoDonoDaEspera() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val s = EspelhoPares.aprovar(id, t0)
        assertNotNull(s)
        val consulta = EspelhoPares.consultar(id, t0)
        assertTrue(consulta is EspelhoPares.Consulta.Pronta)
        assertEquals(s, (consulta as EspelhoPares.Consulta.Pronta).sessao)
        // Aprovada, some da fila do operador.
        assertEquals(0, EspelhoPares.pendentes().size)
    }

    /** Dois toques no botão não podem cunhar dois tokens (e consumir dois slots). */
    @Test
    fun aprovarDuasVezesDevolveAMesmaSessao() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val a = EspelhoPares.aprovar(id, t0)!!
        val b = EspelhoPares.aprovar(id, t0)!!
        assertEquals(a.token, b.token)
        assertEquals(1, EspelhoPares.sessoes().size)
    }

    @Test
    fun recusarDerrubaAEsperaEASessao() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val s = EspelhoPares.aprovar(id, t0)!!
        EspelhoPares.recusar(id)
        assertSame(EspelhoPares.Consulta.Recusada, EspelhoPares.consultar(id, t0))
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0))
    }

    @Test
    fun esperaExpiraEViraDesconhecida() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val depois = t0 + EspelhoPares.PRAZO_ESPERA_MS + 1
        assertSame(EspelhoPares.Consulta.Desconhecida, EspelhoPares.consultar(id, depois))
        assertNull(EspelhoPares.aprovar(id, depois))
    }

    @Test
    fun idDeEsperaDesconhecidoNaoVazaNada() {
        assertSame(EspelhoPares.Consulta.Desconhecida, EspelhoPares.consultar("nao-existe", t0))
        assertNull(EspelhoPares.aprovar("nao-existe", t0))
    }

    @Test
    fun aprovarAutomaticamenteEntregaSemOperador() {
        EspelhoPares.definirAutoAprovar(true)
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        assertTrue(EspelhoPares.consultar(id, t0) is EspelhoPares.Consulta.Pronta)
    }

    @Test
    fun aprovarAutomaticamenteNasceDesligadoEMorreComODesligar() {
        assertFalse(EspelhoPares.autoAprovando())
        EspelhoPares.definirAutoAprovar(true)
        EspelhoPares.desligar()
        EspelhoPares.ligar(t0)
        assertFalse(EspelhoPares.autoAprovando())
    }

    @Test
    fun filaDoOperadorTemTeto() {
        repeat(EspelhoPares.MAX_ESPERAS) {
            assertTrue(EspelhoPares.tentar(pin, origem, relato(), t0) is EspelhoPares.Veredito.Espera)
        }
        assertSame(
            EspelhoPares.Veredito.Lotada,
            EspelhoPares.tentar(pin, origem, relato(), t0),
        )
    }

    // -------------------------------------------------- bloqueio por origem

    /**
     * Invariante 6: cinco erros da MESMA origem e o sexto não é nem lido — nem
     * quando ele traz o PIN certo. Um atacante que acertasse na sexta continua
     * de fora.
     */
    @Test
    fun cincoPinsErradosBloqueiamOSexto() {
        repeat(ERRADAS) {
            assertSame(
                EspelhoPares.Veredito.Recusada,
                EspelhoPares.tentar(pinErrado(), origem, relato(), t0),
            )
        }
        val sexto = EspelhoPares.tentar(pin, origem, relato(), t0)
        assertTrue("o 6º com o PIN CERTO ainda tem de ser bloqueado", sexto is EspelhoPares.Veredito.Bloqueada)
        assertEquals(EspelhoPares.BLOQUEIO_MS, (sexto as EspelhoPares.Veredito.Bloqueada).restaMs)
    }

    /** O bloqueio é da ORIGEM: o vizinho continua conseguindo parear. */
    @Test
    fun bloqueioNaoAtingeOutraOrigem() {
        repeat(ERRADAS) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertTrue(
            EspelhoPares.tentar(pin, "192.168.0.90", relato(), t0) is EspelhoPares.Veredito.Espera
        )
    }

    @Test
    fun bloqueioVenceEACotaVolta() {
        repeat(ERRADAS) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        val depois = t0 + EspelhoPares.BLOQUEIO_MS + 1
        assertTrue(EspelhoPares.tentar(pin, origem, relato(), depois) is EspelhoPares.Veredito.Espera)
    }

    @Test
    fun contadorDeRecusasAlimentaORegistro() {
        repeat(3) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertEquals(3, EspelhoPares.recusas())
        assertEquals(0, EspelhoPares.origensEmBloqueio(t0))
        repeat(2) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertEquals(1, EspelhoPares.origensEmBloqueio(t0))
    }

    // ------------------------------------------------------------------ token

    @Test
    fun tokenValidaSoComOEsquemaBearer() {
        val s = parear()
        assertEquals(s, EspelhoPares.validar("Bearer ${s.token}", t0))
        // O esquema é insensível a caixa (RFC 7235); o token, não.
        assertEquals(s, EspelhoPares.validar("bearer ${s.token}", t0))
        assertNull(EspelhoPares.validar(s.token, t0))
        assertNull(EspelhoPares.validar("Basic ${s.token}", t0))
        assertNull(EspelhoPares.validar("Bearer ", t0))
        assertNull(EspelhoPares.validar(null, t0))
    }

    @Test
    fun tokenInventadoNaoVale() {
        parear()
        assertNull(EspelhoPares.validar("Bearer AAAAAAAAAAAAAAAAAAAAAA", t0))
        assertNull(EspelhoPares.validar("Bearer ", t0))
    }

    @Test
    fun tokenExpiraNoPrazo() {
        val s = parear()
        assertNotNull(EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS - 1))
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS))
        assertEquals(0, EspelhoPares.sessoes().size)
    }

    /**
     * O prazo NÃO desliza com o uso: uma janela que se renova sozinha nunca
     * expira enquanto alguém a estiver usando — que é exatamente a situação do
     * token vazado sendo usado por outro.
     */
    @Test
    fun usarOTokenNaoEstendeOPrazo() {
        val s = parear()
        EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS - 10)
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS))
    }

    @Test
    fun doisPareamentosDaoTokensDiferentes() {
        val a = parear("192.168.0.10")
        val b = parear("192.168.0.11")
        assertNotEquals(a.token, b.token)
        assertEquals(22, a.token.length) // 128 bits em base64url, sem padding
        assertFalse(a.token.contains('='))
        assertFalse(a.token.contains('/'))
        assertFalse(a.token.contains('+'))
    }

    @Test
    fun tetoDeTresSessoes() {
        val ids = (1..4).map {
            (EspelhoPares.tentar(pin, "192.168.0.$it", relato(), t0) as EspelhoPares.Veredito.Espera).id
        }
        val primeira = EspelhoPares.aprovar(ids[0], t0)!!
        EspelhoPares.aprovar(ids[1], t0)!!
        EspelhoPares.aprovar(ids[2], t0)!!
        assertNull("a quarta tela não entra sem o operador liberar uma", EspelhoPares.aprovar(ids[3], t0))
        EspelhoPares.encerrar(primeira.token)
        assertNotNull(EspelhoPares.aprovar(ids[3], t0))
        assertEquals(EspelhoPares.MAX_SESSOES, EspelhoPares.sessoes().size)
    }

    @Test
    fun encerrarTiraATelaDoAr() {
        val s = parear()
        EspelhoPares.encerrar(s.token)
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0))
    }

    /** Não há token que sobreviva ao culto (invariante 3). */
    @Test
    fun desligarZeraTudo() {
        val s = parear()
        EspelhoPares.desligar()
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0))
        assertEquals(0, EspelhoPares.sessoes().size)
        assertEquals(0, EspelhoPares.pendentes().size)
        assertEquals("", EspelhoPares.pin())
        assertFalse(EspelhoPares.estaLigado())
        assertSame(
            EspelhoPares.Veredito.Desligado,
            EspelhoPares.tentar("000000", origem, relato(), t0),
        )
    }

    /**
     * Com o espelho desligado o PIN guardado é vazio — e um PIN vazio vindo da
     * rede não pode casar com ele. É a guarda de string vazia da comparação em
     * tempo constante.
     */
    @Test
    fun pinVazioNaoCasaComEspelhoDesligado() {
        // Ligado, o PIN vazio é só um PIN errado.
        assertSame(EspelhoPares.Veredito.Recusada, EspelhoPares.tentar("", origem, relato(), t0))
        // Desligado, o PIN guardado É vazio — e é aí que a guarda de string vazia
        // da comparação em tempo constante impede o casamento de dois nadas.
        EspelhoPares.desligar()
        assertSame(EspelhoPares.Veredito.Desligado, EspelhoPares.tentar("", origem, relato(), t0))
    }

    // -------------------------------------------------------------- saneamento

    /**
     * Invariante 9. O `ua` vai para o **Registro**, que tem botão de copiar e
     * existe para ser repassado: um `\n` ali injeta uma linha inteira de
     * diagnóstico falso, e um diagnóstico que mente é pior que diagnóstico
     * nenhum.
     */
    @Test
    fun saneamentoTiraQuebraDeLinhaEAspas() {
        val sujo = "Mozilla/5.0\r\nservidor: ligado em 10.0.0.1:8787\ttab\u0000nul \"aspas\" \\barra"
        val limpo = EspelhoPares.sanear(sujo)
        assertFalse(limpo.contains('\n'))
        assertFalse(limpo.contains('\r'))
        assertFalse(limpo.contains('\t'))
        assertFalse(limpo.contains('\u0000'))
        assertFalse(limpo.contains('"'))
        assertFalse(limpo.contains('\\'))
        assertTrue(limpo.startsWith("Mozilla/5.0servidor: ligado"))
    }

    @Test
    fun saneamentoCortaNoTeto() {
        val limpo = EspelhoPares.sanear("z".repeat(1000))
        assertEquals(EspelhoPares.TETO_TEXTO, limpo.length)
    }

    @Test
    fun saneamentoDerrubaAcentoEEmoji() {
        // Fora de [\x20-\x7E] não entra nada — inclusive o que é inofensivo. O
        // "ã" cai junto com o emoji (que são dois surrogates, os dois fora da
        // faixa), e sobram só os ASCII: "N", "o" e o espaço.
        assertEquals("No ", EspelhoPares.sanear("Não 🙂"))
    }

    /** E o relato guardado já vem saneado — não é o JS que limpa. */
    @Test
    fun oRelatoGuardadoJaVemSaneado() {
        val v = EspelhoPares.tentar(
            pin,
            origem,
            relato("Firefox\ntelas: 99 conectadas").copy(w = -5, telaAcesaMin = -1),
            t0,
        )
        val id = (v as EspelhoPares.Veredito.Espera).id
        val s = EspelhoPares.aprovar(id, t0)!!
        assertFalse(s.relato.ua.contains('\n'))
        assertTrue(s.relato.ua.length <= EspelhoPares.TETO_TEXTO)
        assertEquals(0, s.relato.w)
        assertEquals(0, s.relato.telaAcesaMin)
    }

    /**
     * O `token` e o `id` são PORTADORES: quem os tem entra. Eles não podem sair
     * numa interpolação distraída — e o Registro é copiado e repassado.
     */
    @Test
    fun oSegredoNaoApareceNoToString() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val pendente = EspelhoPares.pendentes()[0]
        assertFalse(pendente.toString().contains(id))
        val s = EspelhoPares.aprovar(id, t0)!!
        assertFalse(s.toString().contains(s.token))
    }

    private companion object {
        /** Legibilidade: o número que a invariante 6 fixa. */
        const val ERRADAS = EspelhoPares.ERROS_ATE_BLOQUEIO
    }
}
