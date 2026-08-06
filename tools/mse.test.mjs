// As MENSAGENS DE FALHA do player de transmissão direta (`shared/mse.js`),
// contra um servidor de mentira que responde o que se pedir.
//
// ## Por que testar mensagem de erro
//
// Porque neste recurso ela é o produto. A transmissão roda no aparelho do
// operador, num WebView, contra URLs que expiram — não há como depurar de fora.
// A única coisa que atravessa essa distância é a linha do Registro, e ela só
// serve se disser em QUE PASSO morreu e COM QUE RESPOSTA. "Não deu" já custou
// duas rodadas de APK nesta funcionalidade.
//
// E há um motivo mecânico: uma refatoração deixou `pegar()` com três parâmetros
// enquanto três chamadas passavam quatro. O rótulo do passo virava `undefined`
// silenciosamente — `node --check` não vê aridade, e a fumaça do Controle não
// exercita streaming. Este teste vê.
//
//   node tools/mse.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MSE = fs.readFileSync(path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web', 'shared', 'mse.js'), 'utf8');

// O que o servidor deve responder na próxima requisição de faixa. Trocado por
// cenário, de fora.
let modo = 'ok';

// O que o servidor VIU: [url, cabeçalho Range]. É por aqui que se verifica o
// contrato entre o player e o `StreamProxy` — o proxy repassa este `Range` ao
// googlevideo, e um formato diferente do esperado quebraria tudo do lado de lá,
// onde não há teste possível.
const vistos = [];

const servidor = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><video id="v" muted></video><script>' + MSE + '</script>');
    return;
  }
  if (req.url.startsWith('/stream/')) vistos.push([req.url, req.headers.range]);
  if (modo === '404') { res.writeHead(404, 'token desconhecido'); res.end(); return; }
  if (modo === '403') { res.writeHead(403, 'googlevideo: Forbidden'); res.end(); return; }
  if (modo === 'vazio') { res.writeHead(206, { 'Content-Length': '0' }); res.end(); return; }
  // 'lixo': bytes que não são um `moov` — o decodificador tem de recusar.
  res.writeHead(206, { 'Content-Type': 'video/webm' });
  res.end(Buffer.alloc(64, 7));
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const pg = await (await navegador.newContext()).newPage();
await pg.goto(base + '/', { waitUntil: 'domcontentloaded' });

// VP9 + Opus, e NÃO o avc1 + aac que o aparelho usa. O Chromium do Playwright é
// o build open-source, que não traz os codecs proprietários — `addSourceBuffer`
// recusaria `avc1` e todo cenário morreria antes do que se quer medir. O motor
// não sabe a diferença: ele repassa a string ao navegador e busca byte-ranges.
// Quem confere o suporte REAL do aparelho é o próprio Registro, no bloco
// "Transmissão".
const MANIFESTO = {
  seconds: 100,
  video: {
    url: base + '/stream/v', mime: 'video/webm; codecs="vp9"',
    initStart: 0, initEnd: 739, indexStart: 740, indexEnd: 1200,
  },
  audio: {
    url: base + '/stream/a', mime: 'audio/webm; codecs="opus"',
    initStart: 0, initEnd: 631, indexStart: 632, indexEnd: 900,
  },
};

checar(await pg.evaluate((m) => window.AVStream.suportado(m), MANIFESTO),
  'o manifesto de referência é aceito');
checar(!(await pg.evaluate((m) => window.AVStream.suportado(
  Object.assign({}, m, { video: Object.assign({}, m.video, { mime: 'video/nada; codecs="x"' }) }),
), MANIFESTO)), 'e um codec inventado é RECUSADO (a guarda não passa qualquer coisa)');

// Roda um cenário e devolve a mensagem que chegou ao `onErro`.
async function motivo(qual, man) {
  modo = qual;
  return pg.evaluate((m) => new Promise((resolve) => {
    const v = document.getElementById('v');
    const t = setTimeout(() => resolve('(nenhum erro em 6s)'), 6000);
    window.AVStream.criar(v, m, { onErro: (p) => { clearTimeout(t); resolve(p); } });
  }), man || MANIFESTO);
}

const casos = [
  ['404', /^init vídeo: HTTP 404 \(token desconhecido\) pedindo bytes 0-739$/,
    'o 404 do proxy chega com o motivo, o passo e a faixa de bytes'],
  ['403', /^init vídeo: HTTP 403 \(googlevideo: Forbidden\) pedindo bytes 0-739$/,
    'o 403 do googlevideo é repassado com o texto dele'],
  ['vazio', /^init vídeo: resposta vazia \(HTTP 206, pedidos 740 bytes\)$/,
    'status bom com zero bytes é FALHA, não silêncio'],
  // A recusa pode chegar como exceção do `appendBuffer` OU como evento de erro
  // do SourceBuffer, dependendo de quando o navegador percebe. As duas dizem a
  // mesma coisa, de propósito — quem lê o log não deve precisar saber a
  // diferença.
  ['lixo', /o decodificador recusou.* — mime video\/webm/,
    'bytes que não são mídia: o erro nomeia o decodificador e o mime'],
];

for (const [qual, esperado, msg] of casos) {
  const m = await motivo(qual);
  checar(esperado.test(m), msg, m);
}

// A armadilha da aridade, dita em voz alta: nenhuma mensagem pode conter
// `undefined`. É o que aparece quando um rótulo deixa de ser passado.
const todos = [];
for (const [qual] of casos) todos.push(await motivo(qual));
checar(!todos.some((m) => /undefined/.test(m)),
  'nenhuma mensagem contém "undefined" (rótulo de passo perdido)',
  todos.find((m) => /undefined/.test(m)));

// O PRIMEIRO pedido de todos é o segmento de inicialização do VÍDEO, com a
// faixa fechada que o manifesto declarou. Fechada importa: uma faixa aberta
// (`bytes=0-`) traria o arquivo inteiro pelo proxy, que é o oposto de transmitir.
checar(vistos.length > 0 && vistos[0][0] === '/stream/v' && vistos[0][1] === 'bytes=0-739',
  'o primeiro pedido é o init do vídeo, com Range fechado',
  vistos.length ? vistos[0].join(' ') : '(nenhum pedido)');

// ---------------------------------------------------------------------------
// SÓ ÁUDIO — o "Tocar agora · Só áudio" (v5.130).
//
// O shell monta sempre o PAR no mesmo manifesto; quem quer só o som descarta a
// faixa de vídeo no lado web. Exigir as duas, como o `suportado` fazia, barrava
// a transmissão justamente no caso mais leve — o que menos deveria esperar por
// download. As duas asserções abaixo são o contrato inteiro: aceita, e não pede
// um único byte de vídeo.
// ---------------------------------------------------------------------------
const SO_AUDIO = Object.assign({}, MANIFESTO, { video: null });
checar(await pg.evaluate((m) => window.AVStream.suportado(m), SO_AUDIO),
  'um manifesto SÓ COM ÁUDIO é aceito');
checar(!(await pg.evaluate((m) => window.AVStream.suportado(
  Object.assign({}, m, { audio: null }),
), SO_AUDIO)), 'e um manifesto sem faixa NENHUMA é recusado');

const marcaAudio = vistos.length;
await motivo('404', SO_AUDIO);
const pedidosAudio = vistos.slice(marcaAudio);
checar(pedidosAudio.length > 0 && pedidosAudio.every(([u]) => u.startsWith('/stream/a')),
  'e nenhuma requisição de VÍDEO é feita (o 1080p não é baixado para ser jogado fora)',
  JSON.stringify(pedidosAudio.map((x) => x[0])));

// ---------------------------------------------------------------------------
// O TRANSPORTE DA FAIXA — o contrato que a v1.55 conserta.
//
// Dentro de um WebView o cabeçalho `Range` é FATAL: o Chromium o aplica ele
// mesmo sobre o `InputStream` que o `StreamProxy` devolve, e o deslocamento sai
// somado duas vezes (a mecânica está travada em `tools/webview-range.test.mjs`;
// aqui trava-se o que sai pelo fio). As duas asserções abaixo são NEGATIVAS de
// propósito: elas quebram no segundo em que alguém reintroduzir o cabeçalho.
// ---------------------------------------------------------------------------
const marcaNativo = vistos.length;
await pg.evaluate(() => { window.__NATIVE__ = true; window.__SHELL_VERSION__ = 27; });
await motivo('404');
const noApp = vistos.slice(marcaNativo);
checar(noApp.length > 0 && noApp[0][0] === '/stream/v?r=0-739' && noApp[0][1] === undefined,
  'no app (shell 27) a faixa vai na URL e NENHUM cabeçalho Range é enviado',
  noApp.length ? noApp[0][0] + ' · Range: ' + noApp[0][1] : '(nenhum pedido)');

const marcaAntigo = vistos.length;
await pg.evaluate(() => { window.__SHELL_VERSION__ = 26; });
const recusa = await motivo('404');
checar(/exige o shell 27/.test(recusa) && vistos.length === marcaAntigo,
  'num shell antigo ele desiste na hora, sem uma única requisição (o dono cai no download)',
  recusa + ' · pedidos: ' + (vistos.length - marcaAntigo));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
