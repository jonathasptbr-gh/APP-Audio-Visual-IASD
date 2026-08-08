// Fumaça do DISPLAY: abre `/web/display/` num Chromium de verdade, deixa o
// telão se anunciar e conversa com ele pelo barramento de comandos.
//
// ## Por que ele existe
//
// Até agora NENHUM arquivo de `tools/` carregava `/display/`. A fumaça
// (`smoke.mjs`) abre o Controle; `stage-fade` monta o palco à mão a partir de
// `shared/stage.js`; os demais carregam módulos isolados. Ou seja: a metade do
// sistema que roda NA FRENTE DA CONGREGAÇÃO era a metade que a CI nunca
// executou — e é a que menos rede de segurança tem, porque o watchdog do OTA
// também não a valida (quem confirma o bundle é o Controle, por decisão
// documentada). Um erro de inicialização no `display.js` passava por
// `node --check`, passava pela fumaça do Controle, e aparecia no telão.
//
// ## E ele trava o ENDEREÇAMENTO do reenvio de cena
//
// O barramento é broadcast. Até a v5.139 o `display-ready` não tinha remetente
// e o Controle respondia `resendSceneToDisplay()` para todo mundo: qualquer
// segunda instância de `/display/` que abrisse — uma aba de depuração, uma
// restaurada pelo navegador — fazia a TV rodar um `load` inteiro (fade de
// saída, releitura da mídia, re-seek, fade de entrada) na frente da
// congregação, por um evento que não era dela. Agora o telão assina o pedido
// (`__de`) e ignora comando endereçado a outro (`__para`).
//
// As três asserções abaixo são exatamente as três metades dessa regra: o
// pedido é assinado, o que é dos outros não entra, e o que não tem endereço
// continua valendo para todos (é assim que todo comando de operação viaja, e é
// o que mantém um Controle com bundle antigo funcionando).
//
//   node tools/display-smoke.mjs
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

// O ESPIÃO é uma página vazia servida pelo próprio teste, no MESMO origin do
// bundle — é o que dá a ele um BroadcastChannel que o telão enxerga. Ele faz o
// papel do Controle sem carregar o Controle: o que se testa aqui é o Display.
const ESPIAO = '/__espiao.html';

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === ESPIAO) {
    res.writeHead(200, { 'Content-Type': TIPOS['.html'] });
    res.end('<!doctype html><meta charset="utf-8"><title>espião</title>');
    return;
  }
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
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

await new Promise((r) => servidor.listen(0, r));
const base = 'http://127.0.0.1:' + servidor.address().port;

// `PW_CHROMIUM` aponta o binário quando ele não está onde o Playwright o
// procura (é o caso do ambiente de desenvolvimento deste projeto).
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
// UM contexto para as duas páginas: BroadcastChannel só atravessa páginas do
// mesmo origin no mesmo perfil — que é exatamente a premissa da arquitetura de
// dois WebViews, e por isso a montagem do teste espelha a do app.
const ctx = await navegador.newContext();

const erros = [];
const telao = await ctx.newPage();
// Erro de rede de TERCEIRO não conta, e isto não é indulgência: no modo
// navegador o Display PREFETCHA a IFrame API do YouTube de propósito
// (`if (!window.__NATIVE__) loadYtApi()`), então um runner sem internet — ou
// atrás de um proxy — sempre produziria um "Failed to load resource" que não
// diz nada sobre o bundle. Contar isso faria o teste falhar por infraestrutura,
// que é o modo mais rápido de um teste virar ruído e ser ignorado. O que conta
// é o que vem do NOSSO servidor: erro de script, de CSS, de asset do bundle.
telao.on('console', (m) => {
  if (m.type() !== 'error') return;
  const url = (m.location() && m.location().url) || '';
  if (url && !url.startsWith(base)) return;
  erros.push('console: ' + m.text());
});
// Exceção de página não tem essa ressalva: ela é sempre código nosso.
telao.on('pageerror', (e) => erros.push('exceção: ' + e.message));

const espiao = await ctx.newPage();
// O espião entra ANTES do telão e já fica ouvindo: o `display-ready` é enviado
// no fim do `init()`, e quem chegar depois dele perde o único anúncio que o
// telão faz.
await espiao.goto(base + ESPIAO);
await espiao.evaluate(() => {
  window.__vistos = [];
  window.__bc = new BroadcastChannel('av-iasd');
  window.__bc.addEventListener('message', (e) => window.__vistos.push(e.data));
  window.__mandar = (cmd) => window.__bc.postMessage(cmd);
});

await telao.goto(base + '/display/');

// 1. O TELÃO SOBE. Sem isto nada mais faz sentido — e é a asserção que
//    nenhum teste do repositório fazia.
await telao.waitForFunction(() => !!window.AVDB && !!document.getElementById('textMain'), null, { timeout: 15000 })
  .catch(() => {});
const subiu = await telao.evaluate(() => !!window.AVDB && !!window.createStage);
checar(subiu, 'o Display carrega e publica AVDB + createStage');

// 2. O PEDIDO É ASSINADO.
await espiao.waitForFunction(
  () => window.__vistos.some((c) => c && c.type === 'display-ready'),
  null, { timeout: 15000 },
).catch(() => {});
const pronto = await espiao.evaluate(() => window.__vistos.find((c) => c && c.type === 'display-ready') || null);
checar(!!pronto, 'o Display anuncia display-ready no barramento');
checar(!!pronto && typeof pronto.__de === 'string' && pronto.__de.length > 1,
  'e o anúncio vem ASSINADO (__de) — é o que permite endereçar o reenvio da cena',
  JSON.stringify(pronto));

const id = (pronto && pronto.__de) || 'sem-id';

// 3. O QUE É DOS OUTROS NÃO ENTRA. Esta é a asserção que trava a correção: sem
//    a guarda do `__para`, o texto de outra instância aparece no telão — que é
//    o defeito, com o sinal trocado (lá o telão obedecia um `load` que não era
//    dele).
await espiao.evaluate(() => window.__mandar({
  type: 'text', mode: 'message', main: 'CENA DE OUTRA TELA', sub: '', view: 'visual', __para: 'outra-instancia',
}));
await telao.waitForTimeout(400);
const alheio = await telao.evaluate(() => document.getElementById('textMain').textContent);
checar(alheio !== 'CENA DE OUTRA TELA',
  'comando endereçado a OUTRA instância é ignorado', JSON.stringify(alheio));

// 4. O QUE É DELE ENTRA.
await espiao.evaluate((para) => window.__mandar({
  type: 'text', mode: 'message', main: 'ESTA CENA E MINHA', sub: '', view: 'visual', __para: para,
}), id);
await telao.waitForFunction(
  () => document.getElementById('textMain').textContent === 'ESTA CENA E MINHA',
  null, { timeout: 4000 },
).catch(() => {});
const meu = await telao.evaluate(() => document.getElementById('textMain').textContent);
checar(meu === 'ESTA CENA E MINHA', 'comando endereçado a ELE é aplicado', JSON.stringify(meu));

// 5. E O SEM ENDEREÇO CONTINUA VALENDO PARA TODOS — todo comando de operação
//    viaja assim, e é o que mantém um Controle de bundle antigo funcionando.
await espiao.evaluate(() => window.__mandar({
  type: 'text', mode: 'message', main: 'PARA TODOS', sub: '', view: 'visual',
}));
await telao.waitForFunction(
  () => document.getElementById('textMain').textContent === 'PARA TODOS',
  null, { timeout: 4000 },
).catch(() => {});
const todos = await telao.evaluate(() => document.getElementById('textMain').textContent);
checar(todos === 'PARA TODOS', 'comando SEM endereço vale para todos (é o caso de sempre)', JSON.stringify(todos));

// 6. E nada disso pode ter custado um erro de console — a mesma régua da
//    fumaça do Controle.
checar(erros.length === 0, 'nenhum erro de console no telão', erros.join(' · '));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
