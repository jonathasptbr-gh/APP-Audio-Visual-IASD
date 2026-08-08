/**
 * Codificador de QR Code — JavaScript puro, sem dependência, ~modo byte, nível M.
 *
 * ## Por que este arquivo existe
 *
 * O pareamento do espelho era SEIS DÍGITOS lidos na tela do celular e digitados
 * na tela de destino. Isso é uma TV do outro lado do salão, um teclado de
 * controle remoto e um operador atravessando o santuário no meio do culto — e
 * um segredo curto exposto o tempo todo, que é justamente o motivo de a
 * aprovação automática nascer desligada.
 *
 * A inversão que o QR permite é o ponto inteiro: **quem mostra o código é a
 * TELA, e quem lê é o CELULAR**. Como o celular É o servidor, o código não
 * precisa carregar segredo nenhum — ele carrega só o `id` da espera que aquela
 * tela acabou de criar, que é público por construção (o servidor o devolveu
 * para quem pediu). Ler o QR é o operador dizendo "esta tela, a que está na
 * minha frente, pode entrar" — que é exatamente a decisão que a invariante 5 do
 * `EspelhoPares` exige que ele tome, e agora sem digitar nada e sem um segredo
 * em cartaz.
 *
 * ## Por que escrever um codificador em vez de usar uma biblioteca
 *
 * A regra do projeto é não introduzir dependências, e as três (hoje quatro)
 * exceções são declaradas uma a uma com a justificativa de que o problema não
 * se resolve de outro jeito. Um QR de 27 bytes se resolve de outro jeito: são
 * as ~330 linhas abaixo, a norma é de 2000 e não muda, e o resultado é
 * verificável por um teste que DECODIFICA o que este arquivo produziu
 * (`tools/qr.test.mjs`, Node puro, sem `continue-on-error`). Uma biblioteca
 * aqui seria manutenção emprestada para um problema fechado.
 *
 * ## O que ele NÃO faz, de propósito
 *
 * - **Só nível M e só as versões 1 a 6.** A carga é fixa (`AVE1:` + 22
 *   caracteres = 27 bytes, que cabem na versão 3), e parar na 6 elimina o bloco
 *   de informação de VERSÃO, que só existe da 7 em diante. Menos código é menos
 *   lugar para errar num arquivo que ninguém vai reler.
 * - **Só modo byte.** Numérico e alfanumérico comprimiriam mais; o `id` é
 *   base64url (caixa mista), então não caberiam nem se quisessem.
 * - **Não desenha.** Devolve uma matriz de booleanos. Quem pinta é o
 *   `cliente.js`, que é quem sabe o tamanho da tela e a zona de silêncio.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- tabelas
  //
  // Por versão (nível M): [total de codewords, EC por bloco, blocos].
  // Os dados saem da subtração — e nas seis versões abaixo os blocos têm todos
  // o MESMO tamanho, o que dispensa a divisão em dois grupos que a norma prevê
  // para versões maiores. É outra razão para parar na 6.
  const VERSOES = {
    1: [26, 10, 1],
    2: [44, 16, 1],
    3: [70, 26, 1],
    4: [100, 18, 2],
    5: [134, 24, 2],
    6: [172, 16, 4],
  };

  // A coordenada do ÚNICO padrão de alinhamento das versões 2 a 6. A norma dá
  // uma lista de coordenadas e o padrão é desenhado em cada cruzamento delas —
  // aqui a lista é [6, x], e das quatro combinações três caem em cima dos
  // localizadores e são puladas. Sobra uma.
  const ALINHAMENTO = { 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };

  const EC_M = 0; // os dois bits do nível M na informação de formato

  // GF(256) com o polinômio primitivo 0x11D, o da norma.
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function tabelas() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  }());

  function mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /** O polinômio gerador de grau [grau]: (x-α⁰)(x-α¹)…(x-α^(grau-1)). */
  function gerador(grau) {
    let g = [1];
    for (let i = 0; i < grau; i++) {
      const novo = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        novo[j] ^= mul(g[j], 1);
        novo[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = novo;
    }
    return g;
  }

  /** O resto da divisão do bloco de dados pelo gerador — os codewords de EC. */
  function corrigir(dados, quantos) {
    const g = gerador(quantos);
    const r = new Array(dados.length + quantos).fill(0);
    for (let i = 0; i < dados.length; i++) r[i] = dados[i];
    for (let i = 0; i < dados.length; i++) {
      const f = r[i];
      if (f === 0) continue;
      for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], f);
    }
    return r.slice(dados.length);
  }

  // ------------------------------------------------------------ codificação

  /** Os bytes UTF-8 de uma string. Sem `TextEncoder`: ele é de contexto seguro
   *  em alguns motores antigos, e esta página roda em `http://` por construção. */
  function bytesDe(texto) {
    const s = unescape(encodeURIComponent(String(texto)));
    const b = new Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    return b;
  }

  /** A menor versão (1..6) que comporta [n] bytes em modo byte, nível M. */
  function versaoPara(n) {
    for (let v = 1; v <= 6; v++) {
      const [total, ec, blocos] = VERSOES[v];
      const dados = total - ec * blocos;
      // 4 bits de modo + 8 de contagem + os dados, arredondado para cima.
      if (Math.ceil((4 + 8 + n * 8) / 8) <= dados) return v;
    }
    return 0;
  }

  /** Modo byte + contagem + dados + terminador + preenchimento, em codewords. */
  function codewordsDeDados(bytes, capacidade) {
    const bits = [];
    const empurrar = (valor, quantos) => {
      for (let i = quantos - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
    };
    empurrar(0b0100, 4);          // modo byte
    empurrar(bytes.length, 8);    // contagem (versões 1 a 9)
    for (let i = 0; i < bytes.length; i++) empurrar(bytes[i], 8);
    // Terminador: até quatro zeros, e nem um a mais do que couber.
    const sobra = capacidade * 8 - bits.length;
    empurrar(0, Math.min(4, sobra));
    while (bits.length % 8 !== 0) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    // Preenchimento alternado da norma. Não é enfeite: uma cauda de zeros
    // produziria um símbolo com uma mancha uniforme enorme, que é o que a
    // penalidade de máscara existe para evitar.
    const PAD = [0xec, 0x11];
    let k = 0;
    while (cw.length < capacidade) cw.push(PAD[k++ % 2]);
    return cw;
  }

  /** Divide em blocos, calcula a EC de cada um e INTERCALA, como manda a norma. */
  function fluxoFinal(dados, versao) {
    const [, ecPorBloco, blocos] = VERSOES[versao];
    const porBloco = dados.length / blocos;
    const d = [];
    const e = [];
    for (let i = 0; i < blocos; i++) {
      const bloco = dados.slice(i * porBloco, (i + 1) * porBloco);
      d.push(bloco);
      e.push(corrigir(bloco, ecPorBloco));
    }
    const saida = [];
    for (let i = 0; i < porBloco; i++) for (let b = 0; b < blocos; b++) saida.push(d[b][i]);
    for (let i = 0; i < ecPorBloco; i++) for (let b = 0; b < blocos; b++) saida.push(e[b][i]);
    return saida;
  }

  // ----------------------------------------------------------------- matriz

  function novaMatriz(lado) {
    const m = new Array(lado);
    for (let i = 0; i < lado; i++) m[i] = new Array(lado).fill(null);
    return m;
  }

  function localizador(m, linha, coluna) {
    const lado = m.length;
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = linha + r;
        const x = coluna + c;
        if (y < 0 || y >= lado || x < 0 || x >= lado) continue;
        const borda = (r >= 0 && r <= 6 && (c === 0 || c === 6))
          || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const miolo = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[y][x] = borda || miolo;
      }
    }
  }

  function alinhamento(m, versao) {
    const p = ALINHAMENTO[versao];
    if (!p) return;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        m[p + r][p + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      }
    }
  }

  function tempo(m) {
    const lado = m.length;
    for (let i = 8; i < lado - 8; i++) {
      const claro = i % 2 === 0;
      if (m[6][i] === null) m[6][i] = claro;
      if (m[i][6] === null) m[i][6] = claro;
    }
  }

  /** Reserva (com `false` provisório) as duas cópias da informação de formato. */
  function reservarFormato(m) {
    const lado = m.length;
    for (let i = 0; i < 9; i++) {
      if (m[i][8] === null) m[i][8] = false;
      if (m[8][i] === null) m[8][i] = false;
    }
    for (let i = 0; i < 8; i++) {
      m[lado - 1 - i][8] = m[lado - 1 - i][8] === null ? false : m[lado - 1 - i][8];
      m[8][lado - 1 - i] = m[8][lado - 1 - i] === null ? false : m[8][lado - 1 - i];
    }
    m[lado - 8][8] = true; // o módulo escuro, que é fixo e sempre preto
  }

  const MASCARAS = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
  ];

  /**
   * Escreve os codewords no zigue-zague da norma, já mascarados.
   *
   * A coluna 6 é pulada porque é a do padrão de tempo — e o `null` é o que diz
   * "este módulo é livre": os padrões todos já foram escritos, então não há
   * como um bit de dado cair em cima de um localizador.
   */
  function escreverDados(m, fluxo, mascara) {
    const lado = m.length;
    const teste = MASCARAS[mascara];
    let inc = -1;
    let linha = lado - 1;
    let bit = 7;
    let byte = 0;
    for (let coluna = lado - 1; coluna > 0; coluna -= 2) {
      if (coluna === 6) coluna -= 1;
      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (m[linha][coluna - c] !== null) continue;
          let escuro = false;
          if (byte < fluxo.length) escuro = ((fluxo[byte] >>> bit) & 1) === 1;
          if (teste(linha, coluna - c)) escuro = !escuro;
          m[linha][coluna - c] = escuro;
          bit -= 1;
          if (bit === -1) { byte += 1; bit = 7; }
        }
        linha += inc;
        if (linha < 0 || linha >= lado) { linha -= inc; inc = -inc; break; }
      }
    }
  }

  /** BCH(15,5) da informação de formato, com a máscara fixa da norma. */
  function bitsDeFormato(nivel, mascara) {
    let d = ((nivel << 3) | mascara) << 10;
    for (let i = 4; i >= 0; i--) {
      if ((d >>> (i + 10)) & 1) d ^= 0x537 << i;
    }
    return ((((nivel << 3) | mascara) << 10) | d) ^ 0x5412;
  }

  function escreverFormato(m, mascara) {
    const lado = m.length;
    const dados = bitsDeFormato(EC_M, mascara);
    for (let i = 0; i < 15; i++) {
      const bit = ((dados >>> i) & 1) === 1;
      // A cópia VERTICAL (coluna 8), pulando a linha do padrão de tempo.
      if (i < 6) m[i][8] = bit;
      else if (i < 8) m[i + 1][8] = bit;
      else m[lado - 15 + i][8] = bit;
      // E a HORIZONTAL (linha 8), lida do outro lado.
      if (i < 8) m[8][lado - 1 - i] = bit;
      else if (i === 8) m[8][7] = bit;
      else m[8][14 - i] = bit;
    }
    m[lado - 8][8] = true;
  }

  // ------------------------------------------------------------- penalidade
  //
  // As quatro regras da norma, e elas existem para escolher a máscara: a
  // diferença entre um símbolo que o celular lê de primeira e um que exige três
  // tentativas com a mão firme está quase toda aqui.

  function penalidade(m) {
    const lado = m.length;
    let p = 0;

    // 1. Corridas de cinco ou mais da mesma cor, em linha e em coluna.
    for (let a = 0; a < lado; a++) {
      for (let eixo = 0; eixo < 2; eixo++) {
        let corrida = 1;
        let anterior = eixo === 0 ? m[a][0] : m[0][a];
        for (let b = 1; b < lado; b++) {
          const v = eixo === 0 ? m[a][b] : m[b][a];
          if (v === anterior) {
            corrida += 1;
          } else {
            if (corrida >= 5) p += 3 + (corrida - 5);
            corrida = 1;
            anterior = v;
          }
        }
        if (corrida >= 5) p += 3 + (corrida - 5);
      }
    }

    // 2. Todo bloco 2×2 de uma cor só.
    for (let i = 0; i < lado - 1; i++) {
      for (let j = 0; j < lado - 1; j++) {
        const v = m[i][j];
        if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) p += 3;
      }
    }

    // 3. O desenho que imita um localizador (1:1:3:1:1 com folga de quatro
    //    claros de um dos lados) — é o que faz o leitor procurar um canto onde
    //    não há canto nenhum.
    const A = [true, false, true, true, true, false, true, false, false, false, false];
    const B = [false, false, false, false, true, false, true, true, true, false, true];
    const casa = (pega, molde) => {
      for (let k = 0; k < 11; k++) if (pega(k) !== molde[k]) return false;
      return true;
    };
    for (let i = 0; i < lado; i++) {
      for (let j = 0; j + 10 < lado; j++) {
        if (casa((k) => m[i][j + k], A) || casa((k) => m[i][j + k], B)) p += 40;
        if (casa((k) => m[j + k][i], A) || casa((k) => m[j + k][i], B)) p += 40;
      }
    }

    // 4. O desequilíbrio entre claro e escuro.
    let escuros = 0;
    for (let i = 0; i < lado; i++) for (let j = 0; j < lado; j++) if (m[i][j]) escuros += 1;
    const proporcao = (escuros * 100) / (lado * lado);
    p += Math.floor(Math.abs(proporcao - 50) / 5) * 10;

    return p;
  }

  // -------------------------------------------------------------------- API

  /**
   * Devolve a matriz do QR de [texto] — `matriz[linha][coluna] === true` é um
   * módulo escuro — SEM a zona de silêncio, que é de quem desenha.
   *
   * Lança quando o texto não cabe na versão 6 (108 bytes). Lançar, e não
   * devolver `null`: quem chama aqui tem uma carga de tamanho conhecido, e um
   * `null` silencioso viraria um QR que simplesmente não aparece.
   */
  function matriz(texto) {
    const bytes = bytesDe(texto);
    const versao = versaoPara(bytes.length);
    if (!versao) throw new Error('carga grande demais para um QR nível M versão 6');
    const [total, ec, blocos] = VERSOES[versao];
    const fluxo = fluxoFinal(codewordsDeDados(bytes, total - ec * blocos), versao);
    const lado = 17 + versao * 4;

    let melhor = null;
    let melhorNota = Infinity;
    for (let mascara = 0; mascara < 8; mascara++) {
      const m = novaMatriz(lado);
      localizador(m, 0, 0);
      localizador(m, 0, lado - 7);
      localizador(m, lado - 7, 0);
      alinhamento(m, versao);
      tempo(m);
      reservarFormato(m);
      escreverDados(m, fluxo, mascara);
      escreverFormato(m, mascara);
      const nota = penalidade(m);
      if (nota < melhorNota) { melhorNota = nota; melhor = m; }
    }
    return melhor;
  }

  /**
   * Pinta a matriz num `<canvas>`, com a zona de silêncio de quatro módulos que
   * a norma exige.
   *
   * **Módulos inteiros, sempre.** O canvas nasce com um pixel por módulo e é a
   * folha de estilo que o estica (com `image-rendering: pixelated`): desenhar
   * retângulos de 7,3 px produz bordas cinzas que arruínam a leitura numa TV,
   * e o navegador amplia melhor do que este arquivo arredondaria.
   */
  function pintar(canvas, texto, escuro, claro) {
    const m = matriz(texto);
    const q = 4;
    const lado = m.length + q * 2;
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = claro || '#ffffff';
    ctx.fillRect(0, 0, lado, lado);
    ctx.fillStyle = escuro || '#000000';
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m.length; j++) {
        if (m[i][j]) ctx.fillRect(j + q, i + q, 1, 1);
      }
    }
    return m.length;
  }

  global.AVQr = { matriz, pintar };
}(typeof globalThis !== 'undefined' ? globalThis : self));
