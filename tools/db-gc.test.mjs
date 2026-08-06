// O COLETOR DE LIXO do banco (`shared/db.js`), contra um IndexedDB de verdade.
//
// ## Por que este teste existe
//
// Porque é o único código do app que APAGA mídia do operador. Um erro aqui não
// dá tela branca nem erro de console: some com o vídeo do domingo, em silêncio,
// e não há desfazer.
//
// E porque o buraco que ele fecha era real e chegou do aparelho: a busca do
// YouTube mostrava "download pronto" em vídeos que não estavam em seção nenhuma
// do app. A causa era o `listSet` — o outro escritor de listas — gravando a
// lista nova e indo embora, sem coletar o que saiu dela. `listSet('playlist',
// [rec.id])` substitui a playlist INTEIRA: cada item que ela tinha e que não
// estivesse no Cronograma ou nos Favoritos virava um registro que nenhuma lista
// aponta, que a busca ainda encontrava pelo índice `youtubeId`, e que nenhum gc
// alcançava.
//
//   node tools/db-gc.test.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DB = fs.readFileSync(
  path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web', 'shared', 'db.js'), 'utf8',
);

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
// IndexedDB exige um origin de verdade: `about:blank` não serve. Um servidor
// não é preciso — o `file:` do Playwright basta via `setContent` sobre uma
// página http fictícia interceptada.
const ctx = await navegador.newContext();
const pg = await ctx.newPage();
await pg.route('http://av.local/**', (rota) => rota.fulfill({
  status: 200, contentType: 'text/html; charset=utf-8',
  body: '<!doctype html><meta charset="utf-8"><script>' + DB + '</script>',
}));
await pg.goto('http://av.local/', { waitUntil: 'domcontentloaded' });

// Um registro de mídia por lista, com um blob minúsculo.
const semear = (lista, youtubeId) => pg.evaluate(async ([l, yt]) => {
  const rec = await window.AVDB.addMedia(new Blob(['x'], { type: 'video/mp4' }), {
    name: 'v-' + l, kind: 'video', list: l, youtubeId: yt || null,
  });
  return rec.id;
}, [lista, youtubeId]);

const existe = (id) => pg.evaluate(async (i) => !!(await window.AVDB.getMedia(i)), id);

// --- listSet que ESVAZIA uma lista coleta o que saiu ------------------------
const a = await semear('imports');
await pg.evaluate(() => window.AVDB.listSet('imports', []));
checar(!(await existe(a)), 'listSet esvaziando a lista COLETA o registro que ficou sem dono');

// --- ...mas não toca no que outro detentor ainda segura ---------------------
const b = await semear('playlist');
await pg.evaluate((id) => window.AVDB.listAdd('favs', id), b);
await pg.evaluate(() => window.AVDB.listSet('playlist', []));
checar(await existe(b), 'e NÃO apaga o que um Favorito (ou outra lista) ainda segura');

// --- reordenar não é remover ------------------------------------------------
// Na PLAYLIST de propósito: o passo seguinte esvazia o Cronograma para
// reproduzir o defeito, e semear aqui dentro dele faria estes dois virarem
// órfãos legítimos — a primeira versão deste teste caiu exatamente nisso e
// acusou o código por uma armadilha que ela mesma armou.
const c = await semear('playlist');
const d = await semear('playlist');
await pg.evaluate(() => window.AVDB.listSet('playlist', (ids) => ids.slice().reverse()));
checar((await existe(c)) && (await existe(d)),
  'reordenar (mesmo conjunto, outra ordem) não apaga nada');

// --- a FAXINA dos restos que os buracos antigos deixaram --------------------
// `setState` cru é exatamente o que o `listSet` fazia antes: grava a lista e
// vai embora. É assim que se reproduz um resto legítimo, do jeito que ele
// nasceu nos aparelhos.
const orfao = await semear('imports', 'YT-ORFAO');
await pg.evaluate(() => window.AVDB.setState('imports', []));
checar(await existe(orfao), 'um setState cru deixa o registro órfão (o defeito reproduzido)');
checar(!!(await pg.evaluate(() => window.AVDB.mediaByYoutube('YT-ORFAO'))),
  'e a busca do YouTube ainda o encontra — é o "download pronto" fantasma');

const removidos = await pg.evaluate(() => window.AVDB.gcOrfaos());
checar(removidos >= 1, 'a faxina remove o órfão', 'removidos: ' + removidos);
checar(!(await existe(orfao)), 'e ele some do banco');
checar(!(await pg.evaluate(() => window.AVDB.mediaByYoutube('YT-ORFAO'))),
  'e a busca deixa de anunciá-lo como pronto');
checar(await existe(b), 'a faxina PRESERVA o que tem dono (o favoritado continua lá)');
checar((await existe(c)) && (await existe(d)), 'e a playlist continua inteira');

// Rodar de novo não pode ter o que fazer: um gc que "acha" algo toda vez está
// apagando o que tem dono.
const segunda = await pg.evaluate(() => window.AVDB.gcOrfaos());
checar(segunda === 0, 'e a segunda passagem não acha mais nada', 'removidos: ' + segunda);

await navegador.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
