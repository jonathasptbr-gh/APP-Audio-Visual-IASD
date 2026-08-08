#!/usr/bin/env node
/**
 * O ORÁCULO DO QR — Node puro, determinístico, sem navegador.
 *
 * `espelho/qr.js` desenha o código que a TELA mostra e o CELULAR lê. Ele é o
 * primeiro elo de um pareamento: um símbolo errado não dá erro nenhum, dá uma
 * câmera apontada para uma tela que não responde — que é indistinguível de
 * "a câmera não funciona", de "o app não sabe ler QR" e de "o roteador está
 * isolando os aparelhos". Exatamente a classe de falha muda que este projeto
 * já pagou três rodadas de APK para aprender a não deixar sem oráculo.
 *
 * **E ele DECODIFICA, não confere propriedades.** Um teste que só olhasse
 * localizadores e tamanho aprovaria um símbolo com os codewords intercalados na
 * ordem errada. O que está abaixo é um leitor de QR completo — informação de
 * formato (com o BCH conferido), remoção da máscara, leitura no zigue-zague,
 * desintercalação, verificação de síndromes de Reed-Solomon e decodificação do
 * modo byte — escrito no sentido INVERSO do codificador. É o mesmo molde do
 * `sidx.test.mjs` e do `fmp4.test.mjs`, e ele roda **sem `continue-on-error`**.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FONTE = join(AQUI, '..', 'app/src/main/assets/web/espelho/qr.js');

// O arquivo é um `<script>` clássico que pendura `AVQr` no global. Aqui o
// "global" é um objeto nosso — assim o teste carrega EXATAMENTE o arquivo que
// vai para o aparelho, sem uma cópia adaptada que possa divergir dele.
const escopo = {};
new Function('globalThis', readFileSync(FONTE, 'utf8')).call(escopo, escopo);
const AVQr = escopo.AVQr;

let falhas = 0;
function ok(condicao, titulo, detalhe) {
  if (condicao) {
    console.log(`  ok   ${titulo}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

// ---------------------------------------------------------------- GF(256)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

const VERSOES = { 1: [26, 10, 1], 2: [44, 16, 1], 3: [70, 26, 1], 4: [100, 18, 2], 5: [134, 24, 2], 6: [172, 16, 4] };
const ALINHAMENTO = { 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };
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

// ------------------------------------------------------ o leitor (inverso)

/** Marca os módulos que NÃO são dados: padrões fixos e informação de formato. */
function mapaDeFuncao(lado, versao) {
  const f = Array.from({ length: lado }, () => new Array(lado).fill(false));
  const bloco = (r0, c0, h, w) => {
    for (let r = r0; r < r0 + h; r++) {
      for (let c = c0; c < c0 + w; c++) {
        if (r >= 0 && r < lado && c >= 0 && c < lado) f[r][c] = true;
      }
    }
  };
  // Os três cantos incluem separador E informação de formato: 9×9 em cima à
  // esquerda, 9×8 em cima à direita, 8×9 embaixo à esquerda. Foi exatamente
  // aqui que a primeira versão deste leitor errou — sobrando a linha 8 e a
  // coluna 8 como se fossem dados, o que desloca o fluxo inteiro.
  bloco(0, 0, 9, 9);
  bloco(0, lado - 8, 9, 8);
  bloco(lado - 8, 0, 8, 9);
  for (let i = 0; i < lado; i++) { f[6][i] = true; f[i][6] = true; }
  const p = ALINHAMENTO[versao];
  if (p) bloco(p - 2, p - 2, 5, 5);
  return f;
}

/** Lê a informação de formato (cópia principal) e confere o BCH da norma. */
function lerFormato(m) {
  const lado = m.length;
  let dados = 0;
  for (let i = 0; i < 15; i++) {
    let bit;
    if (i < 6) bit = m[i][8];
    else if (i < 8) bit = m[i + 1][8];
    else bit = m[lado - 15 + i][8];
    if (bit) dados |= 1 << i;
  }
  const cru = dados ^ 0x5412;
  // Divisão pelo gerador do BCH(15,5): resto zero ou o formato não é válido.
  let r = cru;
  for (let i = 4; i >= 0; i--) if ((r >>> (i + 10)) & 1) r ^= 0x537 << i;
  return { nivel: (cru >>> 13) & 3, mascara: (cru >>> 10) & 7, restoBch: r & 0x3ff };
}

/** A segunda cópia da informação de formato, que precisa dizer o mesmo. */
function lerFormatoEspelho(m) {
  const lado = m.length;
  let dados = 0;
  for (let i = 0; i < 15; i++) {
    let bit;
    if (i < 8) bit = m[8][lado - 1 - i];
    else if (i === 8) bit = m[8][7];
    else bit = m[8][14 - i];
    if (bit) dados |= 1 << i;
  }
  return dados;
}

/** O zigue-zague, ao contrário: da matriz de volta para os codewords. */
function lerFluxo(m, versao, mascara) {
  const lado = m.length;
  const funcao = mapaDeFuncao(lado, versao);
  const teste = MASCARAS[mascara];
  const bits = [];
  let inc = -1;
  let linha = lado - 1;
  for (let coluna = lado - 1; coluna > 0; coluna -= 2) {
    if (coluna === 6) coluna -= 1;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const x = coluna - c;
        if (!funcao[linha][x]) {
          let v = m[linha][x];
          if (teste(linha, x)) v = !v;
          bits.push(v ? 1 : 0);
        }
      }
      linha += inc;
      if (linha < 0 || linha >= lado) { linha -= inc; inc = -inc; break; }
    }
  }
  const cw = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  return cw;
}

/** Desfaz a intercalação e devolve os blocos completos (dados + EC). */
function desintercalar(fluxo, versao) {
  const [total, ecPorBloco, blocos] = VERSOES[versao];
  const porBloco = (total - ecPorBloco * blocos) / blocos;
  const d = Array.from({ length: blocos }, () => []);
  let k = 0;
  for (let i = 0; i < porBloco; i++) for (let b = 0; b < blocos; b++) d[b].push(fluxo[k++]);
  const e = Array.from({ length: blocos }, () => []);
  for (let i = 0; i < ecPorBloco; i++) for (let b = 0; b < blocos; b++) e[b].push(fluxo[k++]);
  return d.map((dd, b) => ({ dados: dd, completo: dd.concat(e[b]) }));
}

/**
 * As síndromes de Reed-Solomon: o polinômio do bloco avaliado em α¹…α^ec.
 *
 * Zero em todas é a prova de que os codewords de correção batem com os dados —
 * e é uma conta DIFERENTE da divisão que os produziu, e não a mesma ao
 * contrário. É por isso que ela vale como oráculo.
 */
function sindromes(completo, quantos) {
  const s = [];
  for (let i = 0; i < quantos; i++) {
    let v = 0;
    for (let j = 0; j < completo.length; j++) v = mul(v, EXP[i]) ^ completo[j];
    s.push(v);
  }
  return s;
}

/** Modo byte, versões 1 a 9: 4 bits de modo, 8 de contagem, e os bytes. */
function decodificarByte(dados) {
  const bits = [];
  for (const b of dados) for (let i = 7; i >= 0; i--) bits.push((b >>> i) & 1);
  const tira = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits.shift(); return v; };
  const modo = tira(4);
  if (modo !== 0b0100) return { modo, texto: null };
  const n = tira(8);
  const bytes = [];
  for (let i = 0; i < n; i++) bytes.push(tira(8));
  const texto = decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
  return { modo, texto };
}

/** O leitor inteiro. Devolve o texto ou lança dizendo onde parou. */
function decodificar(m) {
  const lado = m.length;
  const versao = (lado - 17) / 4;
  if (!VERSOES[versao]) throw new Error(`lado ${lado} não é versão 1..6`);
  const fmt = lerFormato(m);
  if (fmt.restoBch !== 0) throw new Error('informação de formato com BCH inválido');
  if (fmt.nivel !== 0) throw new Error(`nível ${fmt.nivel} — esperado M (0)`);
  const fluxo = lerFluxo(m, versao, fmt.mascara);
  const blocos = desintercalar(fluxo, versao);
  const [, ecPorBloco] = VERSOES[versao];
  blocos.forEach((b, i) => {
    const s = sindromes(b.completo, ecPorBloco);
    if (s.some((v) => v !== 0)) throw new Error(`bloco ${i} com síndrome não-nula: ${s.join(',')}`);
  });
  const dados = blocos.flatMap((b) => b.dados);
  const { modo, texto } = decodificarByte(dados);
  if (texto === null) throw new Error(`modo ${modo} — esperado byte (4)`);
  return { texto, versao, mascara: fmt.mascara };
}

function lerFormatoBruto(m) {
  const lado = m.length;
  let dados = 0;
  for (let i = 0; i < 15; i++) {
    let bit;
    if (i < 6) bit = m[i][8];
    else if (i < 8) bit = m[i + 1][8];
    else bit = m[lado - 15 + i][8];
    if (bit) dados |= 1 << i;
  }
  return dados;
}

// -------------------------------------------------------------------- casos

console.log('QR — o codificador do pareamento do espelho');

// 1. A CARGA DE VERDADE: `AVE1:` + um id de 22 caracteres base64url, que é
//    exatamente o que o `EspelhoPares.novoToken()` produz.
const ID = 'aB3-_xY9zQ1kLmNoPqRsTu';
const CARGA = `AVE1:${ID}`;
ok(CARGA.length === 27, 'a carga real tem 27 bytes', `tem ${CARGA.length}`);

let lido;
try {
  lido = decodificar(AVQr.matriz(CARGA));
  ok(lido.texto === CARGA, 'o QR da carga real volta idêntico na leitura', `voltou ${lido.texto}`);
  ok(lido.versao === 3, 'e cabe na versão 3', `versão ${lido.versao}`);
} catch (e) {
  ok(false, 'o QR da carga real volta idêntico na leitura', e.message);
}

// 2. Cada versão de 1 a 6, no maior texto que ela comporta — é onde a
//    intercalação de blocos e o preenchimento se exercitam de verdade.
const MAIOR = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106 };
for (const v of [1, 2, 3, 4, 5, 6]) {
  const texto = 'A'.repeat(MAIOR[v]);
  try {
    const r = decodificar(AVQr.matriz(texto));
    ok(r.texto === texto && r.versao === v, `versão ${v} no limite (${MAIOR[v]} bytes)`,
      `voltou versão ${r.versao} com ${r.texto.length} bytes`);
  } catch (e) {
    ok(false, `versão ${v} no limite (${MAIOR[v]} bytes)`, e.message);
  }
}

// 3. Cargas variadas, inclusive acentuada (UTF-8 multibyte) e com os caracteres
//    que o base64url usa.
for (const texto of ['a', 'AVE1:', '0123456789', '-_-_-_-_-_-_', 'Tela do espelho — ç ã õ', 'x'.repeat(60)]) {
  try {
    const r = decodificar(AVQr.matriz(texto));
    ok(r.texto === texto, `ida e volta: ${JSON.stringify(texto).slice(0, 32)}`, `voltou ${JSON.stringify(r.texto)}`);
  } catch (e) {
    ok(false, `ida e volta: ${JSON.stringify(texto).slice(0, 32)}`, e.message);
  }
}

// 4. As DUAS cópias da informação de formato dizem a mesma coisa. Um leitor
//    real usa a segunda quando a primeira está danificada; se elas divergirem,
//    o símbolo lê num aparelho e não lê noutro.
{
  const m = AVQr.matriz(CARGA);
  ok(lerFormatoBruto(m) === lerFormatoEspelho(m),
    'as duas cópias da informação de formato batem',
    `${lerFormatoBruto(m).toString(2)} × ${lerFormatoEspelho(m).toString(2)}`);
}

// 5. Estrutura: localizadores, separadores, padrão de tempo e módulo escuro.
{
  const m = AVQr.matriz(CARGA);
  const lado = m.length;
  const cantoOk = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const borda = r === 0 || r === 6 || c === 0 || c === 6;
        const miolo = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (m[r0 + r][c0 + c] !== (borda || miolo)) return false;
      }
    }
    return true;
  };
  ok(cantoOk(0, 0) && cantoOk(0, lado - 7) && cantoOk(lado - 7, 0), 'os três localizadores estão corretos');
  let tempoOk = true;
  for (let i = 8; i < lado - 8; i++) {
    if (m[6][i] !== (i % 2 === 0) || m[i][6] !== (i % 2 === 0)) tempoOk = false;
  }
  ok(tempoOk, 'o padrão de tempo alterna a partir do módulo 8');
  ok(m[lado - 8][8] === true, 'o módulo escuro está aceso');
  let nulos = 0;
  for (let i = 0; i < lado; i++) for (let j = 0; j < lado; j++) if (m[i][j] === null) nulos += 1;
  ok(nulos === 0, 'nenhum módulo ficou sem decidir', `${nulos} nulos`);
}

// 6. O padrão de alinhamento da versão 3, no lugar que a norma manda.
{
  const m = AVQr.matriz(CARGA);
  const p = ALINHAMENTO[3];
  let alvo = true;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      if (m[p + r][p + c] !== (Math.max(Math.abs(r), Math.abs(c)) !== 1)) alvo = false;
    }
  }
  ok(alvo, `o padrão de alinhamento da versão 3 está em (${ALINHAMENTO[3]}, ${ALINHAMENTO[3]})`);
}

// 7. Estabilidade: o mesmo texto sempre dá o mesmo símbolo. Não é curiosidade —
//    é o que permite que a tela redesenhe o QR sem ele "piscar" diferente, e é
//    o que faria uma regressão futura aparecer neste teste em vez de no culto.
{
  const a = AVQr.matriz(CARGA).map((l) => l.map((v) => (v ? 1 : 0)).join('')).join('|');
  const b = AVQr.matriz(CARGA).map((l) => l.map((v) => (v ? 1 : 0)).join('')).join('|');
  ok(a === b, 'o codificador é determinístico');
}

// 8. E ele RECUSA o que não cabe, em vez de devolver um símbolo truncado.
{
  let lancou = false;
  try { AVQr.matriz('z'.repeat(200)); } catch (_) { lancou = true; }
  ok(lancou, 'carga acima da versão 6 lança em vez de truncar');
}

console.log(falhas === 0 ? '\nQR: tudo certo.' : `\nQR: ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
