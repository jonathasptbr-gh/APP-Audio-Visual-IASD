// O QUE A PONTE DE FATO ENTREGA ao Kotlin.
//
// ## Por que ele existe
//
// `shared/native.js` não repassa os objetos que recebe: ele os REMONTA campo a
// campo antes de serializar. É a forma certa (o outro lado é um
// `@JavascriptInterface` e nada garante que o objeto seja serializável), e tem
// um modo de falhar próprio: **um campo esquecido some em silêncio**. Do lado
// Kotlin, `optBoolean`/`optLong` leem ausente como `false`/`0`, que são valores
// legítimos — não há exceção, não há log, não há nada.
//
// Já aconteceu duas vezes:
//
//  - `slideLabel` ficou de fora do `nowPlaying` da v5.97 à v5.102, e a
//    notificação escreveu "(estrofe)" durante toda a rodada das apresentações,
//    onde ⏮/⏭ passam PÁGINA.
//  - `bytes` ficou de fora do `bgProgress` desde a v5.118 — a versão que o
//    criou. O Kotlin leu `false` e apresentou bytes como se fossem ITENS: um
//    vídeo de 380 MB virava "0 de 398458880" na notificação, que se lê como
//    quatrocentos milhões de músicas. O recurso inteiro nunca funcionou.
//
// E o `| 0` da mesma função tem o defeito irmão: ele trunca para Int32 COM
// SINAL, então qualquer tamanho acima de 2 GB — um vídeo de 1080p — vira
// negativo e o `Math.max(0, …)` o zera.
//
// Este teste roda o `native.js` de verdade contra um `__AVBridge` de mentira e
// confere o JSON que chegaria ao Kotlin.
//
//   node tools/ponte.test.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const NATIVE = fs.readFileSync(path.join(RAIZ, 'shared', 'native.js'), 'utf8');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const pg = await navegador.newPage();

try {
  // O `__AVBridge` DE MENTIRA precisa existir ANTES do script: a IIFE do
  // native.js volta na entrada quando ele falta, e nada é definido.
  await pg.addInitScript(() => {
    window.__recebido = {};
    window.__AVBridge = {
      shellVersion: () => 99,
      role: () => 'controle',
      appVersion: () => 'v9.9',
      bgProgress: (json) => { window.__recebido.bgProgress = json; },
      nowPlaying: (json) => { window.__recebido.nowPlaying = json; },
      otaConfirm: () => {},
    };
  });
  await pg.goto('about:blank');
  await pg.addScriptTag({ content: NATIVE });

  // ---- bgProgress: a UNIDADE viaja? --------------------------------------
  const p = await pg.evaluate(() => {
    AVNative.bgProgress({
      label: 'Baixando vídeo', done: 12_000_000, total: 380_000_000,
      etaMs: 90_000, items: ['Hino 471'], idleMs: 0, bytes: true,
    });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(p.bytes === true,
    'bgProgress leva a bandeira `bytes` — sem ela o Kotlin mostra bytes como ITENS',
    JSON.stringify(p));
  checar(p.done === 12_000_000 && p.total === 380_000_000,
    'e os números chegam inteiros', p.done + '/' + p.total);
  checar(p.label === 'Baixando vídeo' && p.items[0] === 'Hino 471' && p.etaMs === 90_000,
    'com rótulo, item e estimativa');

  // Um vídeo de 1080p passa dos 2 GB: é ONDE o `| 0` quebrava.
  const g = await pg.evaluate(() => {
    AVNative.bgProgress({ label: 'x', done: 2_600_000_000, total: 3_100_000_000, bytes: true });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(g.done === 2_600_000_000 && g.total === 3_100_000_000,
    'acima de 2 GB os números NÃO viram negativos (o `| 0` é Int32 com sinal)',
    g.done + '/' + g.total);

  // Sem a bandeira, a unidade é ITEM — o caso do lote de músicas.
  const i = await pg.evaluate(() => {
    AVNative.bgProgress({ label: 'Hinário', done: 23, total: 54, items: [] });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(i.bytes === false, 'sem a bandeira, a unidade continua sendo ITEM', i.bytes);

  // ---- nowPlaying: o outro objeto remontado campo a campo -----------------
  const n = await pg.evaluate(() => {
    AVNative.nowPlaying({
      active: true, title: 'Hino 471', subtitle: 'Hinário', playing: true,
      slideMode: true, slideLabel: 'página', wallpaper: false,
      positionMs: 12_000, durationMs: 240_000,
    });
    return JSON.parse(window.__recebido.nowPlaying);
  });
  checar(n.slideLabel === 'página',
    'nowPlaying leva o `slideLabel` — foi ele que ficou de fora da v5.97 à v5.102',
    JSON.stringify(n));
  checar(n.active === true && n.playing === true && n.slideMode === true,
    'e as três bandeiras de estado');
  checar(n.positionMs === 12_000 && n.durationMs === 240_000,
    'e a posição na linha do tempo', n.positionMs + '/' + n.durationMs);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
