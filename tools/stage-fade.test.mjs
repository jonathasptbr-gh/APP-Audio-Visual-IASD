// A TRANSIÇÃO DE ENTRADA do palco (`shared/stage.js`), num Chromium de verdade.
//
// ## Por que este teste existe
//
// A troca de item tinha metade da transição: a mídia velha esmaecia até o preto
// e a nova entrava em opacidade CHEIA. Ninguém via porque um arquivo local vira
// primeiro quadro em milissegundos — o corte colava no fim do esmaecimento e
// lia-se como corte de vídeo. A transmissão direta escancarou a falta: entre o
// preto e o primeiro quadro há a rede inteira (init + índice + fragmento), e o
// vídeo aparecia do nada segundos depois.
//
// ## O que ele descobriu, e que vale mais que o próprio teste
//
// Para um VÍDEO a cortina do wallpaper nunca chega a esmaecer: `play()` chama
// `instantCover(computeCover())` e a arranca instantaneamente, ainda dentro do
// `load()`. Logo o fade de CONTEÚDO não é um detalhe do caminho sem cortina —
// ele é a única transição de entrada que um vídeo tem. Uma regressão aqui é
// invisível em `node --check` e na fumaça do Controle, e visível para a
// congregação inteira.
//
//   node tools/stage-fade.test.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const STAGE = fs.readFileSync(path.join(WEB, 'shared', 'stage.js'), 'utf8');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const pg = await (await navegador.newContext()).newPage();

// O palco mínimo: as três camadas que o `createStage` recebe. Nada de CSS do
// app — o que se mede é o `style.opacity` que o próprio stage escreve.
await pg.setContent(`<!doctype html><meta charset="utf-8">
  <div id="w"></div><img id="i" hidden><video id="v" playsinline muted hidden></video>
  <script>${STAGE}</script>`);

// O IndexedDB não entra aqui: o stage só chama `AVDB.getMedia`. Os vídeos têm
// blob VAZIO de propósito — sem um fMP4 de verdade não há primeiro quadro, e o
// `mediaReady` cai no prazo de socorro. É o caso PIOR e é o que interessa:
// mesmo sem quadro nenhum a transição tem de existir, em vez de a mídia
// aparecer no talo.
await pg.evaluate(() => {
  window.AVDB = {
    getMedia: async (id) => (id.startsWith('img')
      // 1×1 transparente: uma imagem que DECODIFICA de verdade, para o caminho
      // da cortina ser exercitado com `mediaReady` resolvendo de fato.
      ? { id, kind: 'image', name: id, url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }
      : { id, kind: 'video', name: id, blob: new Blob([], { type: 'video/mp4' }) }),
  };
  window.__v = document.getElementById('v');
  window.__i = document.getElementById('i');
  window.__stage = window.createStage({
    wallpaper: document.getElementById('w'),
    img: window.__i,
    video: window.__v,
  });
  // OS FADES NASCEM DESLIGADOS e quem os liga são os apps, na carga
  // (`preview.setFade` / `stage.setFade`, a partir de `createStage.FADE`). Sem
  // esta linha o teste mede um palco sem transição nenhuma e passa por engano —
  // foi o que aconteceu na primeira versão dele.
  window.__stage.setFade({
    fadeIn: window.createStage.FADE.in,
    fadeOut: window.createStage.FADE.out,
    time: window.createStage.FADE.time,
  });
  // Amostra a opacidade das duas camadas a cada quadro: é o único jeito de ver
  // uma transição acontecer, já que o valor final é sempre o mesmo.
  window.__amostras = { v: [], i: [] };
  const tick = () => {
    window.__amostras.v.push(window.__v.style.opacity);
    window.__amostras.i.push(window.__i.style.opacity);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const zerar = () => pg.evaluate(() => { window.__amostras.v.length = 0; window.__amostras.i.length = 0; });
const colher = () => pg.evaluate(() => ({ v: window.__amostras.v.slice(), i: window.__amostras.i.slice() }));

// A PROVA de que houve fade de ENTRADA, e não só o de saída: um `0` seguido, em
// ordem, de um `1` ESCRITO. Só o `runFadeIn` escreve o `1` — o `clearFadeStyle`
// devolve string vazia, e o `runFadeOut` (que também escreve `0`, no mesmo
// elemento, ao esmaecer a mídia anterior) nunca escreve `1`. Sem esta ordem, a
// asserção passaria vendo a saída e chamando-a de entrada.
function entrouComFade(amostras) {
  const ultimoZero = amostras.lastIndexOf('0');
  return ultimoZero >= 0 && amostras.slice(ultimoZero).includes('1');
}

// PRIMEIRO "Tocar agora", com o wallpaper em cena — o caso que o operador vê ao
// abrir o app e projetar um vídeo.
await zerar();
await pg.evaluate(() => window.__stage.handle({ type: 'load', mediaId: 'a', view: 'visual' }));
await pg.waitForTimeout(1200);
const abertura = await colher();
checar(entrouComFade(abertura.v),
  'vídeo entrando sobre o wallpaper: sobe de 0 até 1 (e não entra no talo)',
  'amostras: ' + JSON.stringify([...new Set(abertura.v)]));

// E ele SOBE: o fade não pode ser um zero que fica.
await pg.waitForTimeout(17000);
const depois = await pg.evaluate(() => ({
  op: window.__v.style.opacity, tr: window.__v.style.transition, escondido: window.__v.hidden,
}));
checar(depois.op === '' && depois.tr === '',
  'e termina com o estilo LIMPO — uma opacidade presa em 0 apagaria a projeção',
  JSON.stringify(depois));
checar(depois.escondido === false, 'com o <video> visível no fim', JSON.stringify(depois));

// TROCA DE ITEM com conteúdo já em cena: mesma regra.
await zerar();
await pg.evaluate(() => window.__stage.handle({ type: 'load', mediaId: 'b', view: 'visual' }));
await pg.waitForTimeout(2000);
const troca = await colher();
checar(entrouComFade(troca.v),
  'troca de vídeo para vídeo: o que entra também sobe de 0 até 1',
  'amostras: ' + JSON.stringify([...new Set(troca.v)]));

// A CORTINA continua sendo a transição de quem NÃO toca. Uma imagem carregada
// com o wallpaper cobrindo é revelada pelo `coverOut()`, e a camada não pode
// ganhar um segundo fade por baixo dele — seriam duas transições encaixadas.
await pg.evaluate(() => window.__stage.handle({ type: 'clear' }));
await pg.waitForTimeout(300);
await zerar();
await pg.evaluate(() => window.__stage.handle({ type: 'load', mediaId: 'img1', view: 'visual' }));
await pg.waitForTimeout(2000);
const comCortina = await colher();
checar(!comCortina.i.includes('0'),
  'imagem revelada pela cortina: sem um segundo fade por baixo dela',
  comCortina.i.filter((x) => x === '0').length + ' quadros em opacidade 0');

await navegador.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
