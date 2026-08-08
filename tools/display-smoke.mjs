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
// ## E ele prova a DECISÃO DE DENSIDADE do espelho de pixels, sem aparelho
//
// Ver docs/ESPELHO-DE-PIXELS.md §3.2. O espelho renderiza este mesmo
// `/display/` num `VirtualDisplay` de 1280×720, e o que a congregação compara
// não é resolução: é o VIEWPORT CSS, que é `pixels / (densityDpi / 160)`.
//
// Uma TV Miracast NÃO reporta 160 dpi. O AOSP calcula
// `densityDpi = min(w,h) × DENSITY_XHIGH / 1080` para display externo
// (`DisplayDeviceInfo.setAssumedDensityForExternalDisplay`), logo uma TV 1080p
// reporta 320 dpi e o telão que a congregação vê HOJE é desenhado em
// **960×540 CSS** — não em 1920×1080. Se o espelho nascesse a 160 dpi ele
// desenharia em 1280×720 CSS: outra quebra de estrofe, outro tamanho relativo
// de letra, outro enquadramento. Deixaria de ser espelho, e ninguém veria a
// diferença olhando o celular.
//
// Daí a densidade DERIVADA do alvo: `dpi = 1280 × 160 / 960 = 213`, e o
// viewport que sai dela é `1280 × 160 / 213 = 961,5` px CSS. Não é identidade
// de pixel — 213,33 não é inteiro e nunca vai ser —, é o mesmo viewport com
// meio ponto percentual de folga.
//
// Este arquivo rodava no default do Playwright (1280×720) POR ACIDENTE, por um
// `newContext()` sem viewport: um upgrade da biblioteca apagaria a garantia em
// silêncio. Fixado em 961×540, ele passa a MEDIR a decisão — e a última
// asserção compara com uma segunda janela em 960×540, que é o telão de
// verdade. É o único item das seções técnicas daquele documento que se prova
// sem aparelho nenhum.
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

// Os dois viewports, EXPLÍCITOS (ver o cabeçalho). Nunca deixar o Playwright
// escolher: o default dele é 1280×720, que é justamente o valor errado — o
// viewport que o espelho teria se alguém fixasse a densidade em 160 dpi.
const VP_ESPELHO = { width: 961, height: 540 }; // 1280 px a 213 dpi
const VP_TELAO = { width: 960, height: 540 };   // 1920 px a 320 dpi (a TV real)

// Piso de legibilidade do texto projetado. `.text-content.mode-message
// .text-main` é `7.4cqmin`, e o container de tamanho é a camada de texto
// inteira: a 540 px CSS de altura isso dá ~40 px. O piso é folgado de
// propósito — ele não existe para carimbar 40 px, e sim para pegar o dia em
// que a máquina de Container Queries parar de resolver (uma `container-type`
// perdida num refactor derruba a fonte para o default de 16 px) ou o viewport
// colapsar. Uma mensagem a menos de 5% da altura da tela não se lê do fundo do
// salão, que é o único consumidor deste número.
const PISO_FONTE_PX = 28;

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
//
// E com VIEWPORT EXPLÍCITO — ver o cabeçalho. O `newContext()` pelado herdava
// 1280×720 do Playwright, que é o valor que a decisão de densidade do espelho
// existe para EVITAR.
const ctx = await navegador.newContext({ viewport: VP_ESPELHO });

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

// A COBERTURA é medida AQUI, no boot, e conferida lá embaixo (§7): neste
// instante a cortina é o que está em cena, e o primeiro comando de texto a
// abre. Depois dele o `#wallpaper` some e não haveria mais o que medir.
//
// O `#video` é o caso oposto — ele nasce `hidden` e só aparece com mídia
// carregada, o que exigiria semear o IndexedDB. Então a medição o revela por
// um instante e devolve o estado: o que se pergunta é da FOLHA DE ESTILO
// ("quando esta camada aparecer, ela cobre a tela?"), não do `stage.js`.
const cobertura = await telao.evaluate(() => {
  const caixa = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
  const video = document.getElementById('video');
  const antes = video.hidden;
  video.hidden = false;
  const vid = caixa(video);
  video.hidden = antes;
  return { vw: innerWidth, vh: innerHeight, wallpaper: caixa(document.getElementById('wallpaper')), video: vid };
});

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

// 6. O VIEWPORT DO ESPELHO — a decisão de densidade, medida.
//
//    Com a mensagem de cima ainda em cena (é a única forma de o `#textMain`
//    ter tamanho), as quatro perguntas do §7.1 da spec: a janela é a que se
//    pediu, as camadas cobrem a tela, nada estoura, e a letra não encolheu.
checar(cobertura.vw === VP_ESPELHO.width && cobertura.vh === VP_ESPELHO.height,
  'a janela é a do ESPELHO (961×540 CSS) — explícita, não o default do Playwright',
  cobertura.vw + '×' + cobertura.vh);

const cobre = (c) => c[0] === 0 && c[1] === 0 && c[2] === cobertura.vw && c[3] === cobertura.vh;
checar(cobre(cobertura.wallpaper),
  'a cortina (#wallpaper) cobre a tela inteira — é ela que o espelho transmite entre as cenas',
  JSON.stringify(cobertura.wallpaper));
checar(cobre(cobertura.video),
  'e a camada de vídeo (#video) também — sem isso o espelho serviria uma tarja preta em volta',
  JSON.stringify(cobertura.video));

// NADA ESTOURA. As camadas são `position: fixed` e o `<body>` é
// `overflow: hidden`, então `scrollWidth` mentiria "cabe" para qualquer coisa:
// a pergunta tem de ser feita elemento a elemento, pelo retângulo de cada um.
// Quem estoura num viewport 25% mais estreito que o default é justamente o que
// foi desenhado em px fixo sem ninguém perceber.
const estouraram = await telao.evaluate(() => {
  const fora = [];
  for (const el of document.body.querySelectorAll('*')) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue; // camada oculta: nada a medir
    // Meio pixel de folga: subpixel de layout, não estouro.
    if (b.right > innerWidth + 0.5 || b.bottom > innerHeight + 0.5 || b.left < -0.5 || b.top < -0.5) {
      fora.push((el.id || el.className || el.tagName) + ' [' +
        [b.left, b.top, b.right, b.bottom].map((n) => Math.round(n)).join(',') + ']');
    }
  }
  return fora;
});
checar(estouraram.length === 0,
  'nenhum elemento estoura o viewport do espelho', estouraram.join(' · '));

const fonteEspelho = await telao.evaluate(
  () => parseFloat(getComputedStyle(document.getElementById('textMain')).fontSize),
);
checar(fonteEspelho >= PISO_FONTE_PX,
  'a mensagem projetada continua acima do piso de legibilidade (' + PISO_FONTE_PX + ' px)',
  fonteEspelho + 'px');

// 7. E A PROVA propriamente dita: o MESMO layout no viewport do TELÃO DE
//    VERDADE (960×540 CSS, que é o que uma TV 1080p a 320 dpi entrega). Se os
//    dois números baterem, o espelho não é uma segunda diagramação — é o
//    telão. É esta linha que dispensa o aparelho.
//
//    Contexto SEPARADO de propósito: viewport é propriedade do contexto, e um
//    perfil próprio ainda isola o BroadcastChannel desta página do espião lá
//    de cima (ela manda o comando para si mesma).
const ctxTv = await navegador.newContext({ viewport: VP_TELAO });
const tv = await ctxTv.newPage();
await tv.goto(base + '/display/');
await tv.waitForFunction(() => !!window.AVDB, null, { timeout: 15000 }).catch(() => {});
await tv.evaluate(() => new BroadcastChannel('av-iasd').postMessage({
  type: 'text', mode: 'message', main: 'PARA TODOS', sub: '', view: 'visual',
}));
await tv.waitForFunction(
  () => document.getElementById('textMain').textContent === 'PARA TODOS',
  null, { timeout: 4000 },
).catch(() => {});
const fonteTelao = await tv.evaluate(
  () => parseFloat(getComputedStyle(document.getElementById('textMain')).fontSize),
);
checar(fonteTelao > 0 && fonteEspelho === fonteTelao,
  'a letra do espelho (961×540) tem EXATAMENTE o tamanho da do telão (960×540) — a densidade 213 dpi está certa',
  fonteEspelho + 'px vs ' + fonteTelao + 'px');

// 8. E nada disso pode ter custado um erro de console — a mesma régua da
//    fumaça do Controle.
checar(erros.length === 0, 'nenhum erro de console no telão', erros.join(' · '));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
