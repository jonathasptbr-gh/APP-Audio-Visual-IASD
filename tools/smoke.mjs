// Fumaça do Controle: abre a base web num Chromium de verdade, deixa o app
// inicializar, entra em Configurações e usa o botão de copiar o Registro.
//
// ## Por que ele existe
//
// O CI já roda `node --check` em todo o bundle, e isso NÃO É SUFICIENTE: ele
// prova que os arquivos são parseáveis, não que o app funciona. A v5.121 saiu
// com o botão de copiar chamando `copiarTexto`, uma função que uma limpeza
// tinha apagado junto com o bloco em que ela morava — sintaxe perfeita, botão
// morto, e o operador descobriu no aparelho.
//
// Este teste pega exatamente essa classe: referência a coisa que não existe,
// erro na inicialização, handler que estoura ao ser tocado. Ele falha se
// QUALQUER erro de console ou exceção de página aparecer no caminho.
//
// ## O que ele não é
//
// Não é teste de comportamento do culto. Sem `__AVBridge` a base roda em modo
// navegador — sem Presentation, sem ponte, sem YouTube nativo. É de propósito:
// o que se verifica aqui é o que vale nos dois contextos, e é justamente onde
// um erro derruba o app inteiro antes de qualquer recurso nativo entrar.
//
//   node tools/smoke.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  // Não servir nada fora da base web, mesmo num teste local.
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg); falhas.push(msg); }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
// `PW_CHROMIUM` aponta o binário quando ele não está onde o Playwright o
// procura (é o caso do ambiente de desenvolvimento deste projeto). Vazio ou
// ausente, vale o download que o próprio Playwright gerencia — que é o caso do
// runner do CI.
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
// `localhost` já é contexto seguro, então a Clipboard API está disponível — é o
// mesmo caminho que o app usa no aparelho (`https://appassets.…`).
try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); } catch (_) {}
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
// SÓ os erros que são NOSSOS. Um runner sem saída para a internet (e este
// ambiente é um) derruba a IFrame API do YouTube e o acervo LouvorJA, e isso
// não diz nada sobre o bundle — o app é feito para funcionar sem rede durante
// o culto. Requisições ao próprio servidor de teste, essas, contam.
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('response', (r) => {
  if (r.status() >= 400 && r.url().startsWith(base)) erros.push('HTTP ' + r.status() + ' ' + r.url());
});
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t)) return;
  // "Failed to load resource" sem URL: só conta se alguma resposta nossa falhou
  // (o `response` acima já a registra com o endereço).
  if (/Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

  // O MESMO MARCADOR que o watchdog do OTA usa para dizer "o app está de pé"
  // (ver `otaAppIsUp` em shared/native.js): um `<li>` dentro de `#playlist` só
  // existe depois que o `init()` assíncrono terminou. Reaproveitá-lo evita
  // inventar um segundo sinal que envelheceria à parte do primeiro.
  await pg.waitForFunction(
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function',
    null, { timeout: 20000 },
  );
  checar(true, 'a base web inicializa (AVDB + createStage + __avBack)');

  // `.click()` do DOM, não o do Playwright: o botão mora na coluna do mixer, que
  // nesta viewport pode estar recolhida — e o alvo do teste é o Registro, não a
  // geometria do mixer. O handler executado é o mesmo.
  await pg.evaluate(() => document.getElementById('settingsBtn').click());
  await pg.waitForSelector('#fadePopup.open', { timeout: 5000 });
  checar(true, 'Configurações abre');

  const temRegistro = await pg.$eval('#diagBox', (el) => (el.textContent || '').length > 0);
  checar(temRegistro, 'o Registro tem conteúdo');

  const rolaHorizontal = await pg.$eval('#diagBox', (el) => el.scrollWidth > el.clientWidth + 1);
  checar(!rolaHorizontal, 'o Registro não rola na horizontal');

  // O QUE A v5.121 QUEBROU: o clique chamava uma função apagada. Um handler que
  // estoura não muda nada na tela — daí conferir o efeito (o pulso de
  // confirmação), e não só a ausência de erro.
  await pg.evaluate(() => document.getElementById('diagCopy').click());
  await pg.waitForTimeout(300);
  const pulsou = await pg.$eval('#diagCopy', (el) => el.classList.contains('btn-pulso'));
  checar(pulsou, 'o botão de copiar o Registro responde ao toque');

  const copiado = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  checar(copiado.includes('Linha do tempo'), 'e o texto do Registro foi para a área de transferência');

  // ---- O EMPILHAMENTO DOS POPUPS ANINHADOS -------------------------------
  //
  // Um popup que abre DE DENTRO de outro precisa de um degrau próprio de
  // z-index: com o mesmo valor, quem decide é a ordem do documento, e esse
  // acaso já cobriu um popup por inteiro mais de uma vez neste arquivo. O
  // sintoma nunca é "está por baixo" — é "o toque não faz nada", ou, no caso
  // do leitor de QR, uma câmera acesa e imagem nenhuma na tela.
  //
  // O `controle.css` pedia atenção num comentário, e o comentário não bastou:
  // o leitor de QR nasceu no 200 padrão, um degrau ABAIXO da folha do espelho
  // que o abre. Por isso a regra virou asserção — ela custa três linhas e
  // pega uma classe inteira de defeito que só aparece em aparelho.
  const ANINHADOS = [
    ['fadePopup', 'mirrorPopup'],   // a folha do espelho abre de Configurações
    ['mirrorPopup', 'qrPopup'],     // e o leitor de QR abre da folha do espelho
    ['songMenuPopup', 'folderPopup'], // o seletor de pastas abre da folha da música
  ];
  const z = await pg.evaluate((pares) => pares.map(([pai, filho]) => {
    const v = (id) => {
      const e = document.getElementById(id);
      return e ? parseInt(getComputedStyle(e).zIndex, 10) || 0 : NaN;
    };
    return { pai, filho, zPai: v(pai), zFilho: v(filho) };
  }), ANINHADOS);
  z.forEach((p) => {
    checar(p.zFilho > p.zPai,
      'o popup `' + p.filho + '` fica ACIMA do `' + p.pai + '`, de onde ele abre'
      + ' (' + p.zFilho + ' > ' + p.zPai + ')');
  });
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
