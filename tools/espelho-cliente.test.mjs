// O CLIENTE DO ESPELHO DE PIXELS num Chromium DE VERDADE — e, principalmente,
// **o navegador como oráculo do muxer**.
//
// ## A asserção que justifica o arquivo inteiro
//
//     sb.buffered.length === 1     e     end − start ≈ soma das durações
//
// Ela responde a pergunta que nenhuma leitura de especificação responde: os
// fragmentos que `fmp4.js` produz COLAM? `tools/fmp4.test.mjs` prova que cada
// byte está no lugar certo — mas um `data_offset` deslocado, um `tfdt` fora de
// escala ou uma `sample_duration` chutada continuam sendo bytes perfeitamente
// bem formados. Quem diz que aquilo vira UM intervalo bufferizado, e não dois
// com um buraco no meio, é o navegador; e navegador PARA em buraco (D3).
//
// Por isso o teste tem um PAR NEGATIVO: ele monta os mesmos quadros com a
// duração FIXA que o desenho anterior escrevia na hora, e exige que o
// `buffered` NÃO cubra o fluxo. Sem esse par, "deu 1" poderia ser sorte da
// coalescência do Chromium, e a asserção principal não valeria nada. Medido
// aqui, o estrago é ainda pior que o previsto — ver o comentário do par.
//
// ## Por que o codec pode não ser H.264
//
// O Chromium que o Playwright baixa (e é o do CI) é o build aberto, **sem
// codecs proprietários**: `isTypeSupported('video/mp4; codecs="avc1…"')` é
// `false`. É exatamente o buraco que a costura `AVFmp4.initCom` existe para
// tapar — todo o `moov` é agnóstico de codec, e só a *sample entry* não é.
// Havendo H.264 (um Chrome de verdade na máquina de quem desenvolve), o teste
// usa `avc1` com um SPS sintético e exercita o `avcC` junto; não havendo, ele
// monta uma *sample entry* `vp09` AQUI e mede a mesma coisa. O que se está
// medindo — a continuidade do `buffered` — não depende de qual é o codec.
//
// ## E a segunda metade: o cliente, ponta a ponta
//
// Um servidor de mentira implementa o §5 inteiro (o mapa de rotas, o
// pareamento com o operador no laço, o fluxo binário de 16 bytes de cabeçalho)
// e o teste percorre o caminho do visitante: PIN errado, PIN certo, espera,
// aprovação, modo imagem, queda do fluxo e reconexão. As duas asserções mais
// importantes desse trecho são NEGATIVAS: **o token não aparece em URL
// nenhuma** e **a página é anônima antes do pareamento**.
//
//   node tools/espelho-cliente.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const ESP = path.join(WEB, 'espelho');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

// ---------------------------------------------------------------------------
// O SERVIDOR DE MENTIRA — o §5 inteiro, e NADA além dele.
//
// O mapa de rotas é FIXO — CINCO entradas desde que o pareamento por QR
// entrou —, exatamente como o `EspelhoServidor` o implementa (§3.6, invariante
// 7): nunca por concatenação, senão `/controle/controle.js` e
// `/shared/native.js` sairiam para quem estiver na rede.
//
// **E ele precisa bater com o `ESTATICOS` do Kotlin, entrada por entrada.** Uma
// rota que exista lá e falte aqui não dá 404 no teste: dá um `<script>` servido
// com o tipo errado, que o Chromium RECUSA por `nosniff` — foi assim que este
// arquivo pegou a ausência do `/q.js` no primeiro minuto.
// ---------------------------------------------------------------------------
const MAPA = {
  '/': [path.join(ESP, 'index.html'), 'text/html; charset=utf-8'],
  '/e.css': [path.join(ESP, 'espelho.css'), 'text/css; charset=utf-8'],
  '/e.js': [path.join(ESP, 'cliente.js'), 'text/javascript; charset=utf-8'],
  '/f.js': [path.join(ESP, 'fmp4.js'), 'text/javascript; charset=utf-8'],
  '/q.js': [path.join(ESP, 'qr.js'), 'text/javascript; charset=utf-8'],
};

const PIN = '424242';
const TOKEN = 'Zm9vYmFyLXRva2VuLTEyOA';

const visto = { urls: [], autorizacoes: [], volta: [], gets: 0, qr: [] };
// O id de espera que o QR carrega. 22 caracteres base64url, como o
// `EspelhoPares.novoToken()` produz — é o tamanho que decide a versão do QR.
const ESPERA_QR = 'aB3-_xY9zQ1kLmNoPqRsTu';
let qrLiberado = true;       // o servidor aceita criar espera de QR?
let qrAprovado = false;      // e o "operador" já leu o código?
let pendencias = 0;          // quantos polls de `espera` ainda respondem "pendente"
let aprovar = true;
let fluxo = null;            // a resposta de /v em curso
let aoAbrirFluxo = null;

function corpoDe(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => { try { resolve(JSON.parse(s)); } catch (_) { resolve(null); } });
  });
}

function json(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj || {}));
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': b.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(b);
}

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  visto.urls.push(req.url);
  if (req.headers.authorization) visto.autorizacoes.push(req.headers.authorization);

  if (req.method === 'GET' && MAPA[u.pathname]) {
    const [arq, tipo] = MAPA[u.pathname];
    const b = fs.readFileSync(arq);
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': b.length, 'Cache-Control': 'no-store' });
    res.end(b);
    return;
  }

  // Página só do teste: o oráculo do muxer não é o cliente, é o `fmp4.js` nu.
  if (req.method === 'GET' && u.pathname === '/oraculo') {
    const b = Buffer.from('<!doctype html><meta charset="utf-8"><video id="t" muted></video>'
      + '<script src="/f.js"></script>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': b.length });
    res.end(b);
    return;
  }

  if (req.method === 'POST' && u.pathname === '/par') {
    const c = await corpoDe(req);
    if (c && c.pin) {
      if (c.pin !== PIN) { json(res, 403, {}); return; }
      json(res, 202, { espera: 'e1' });
      return;
    }
    // O QR: a tela pede um id SEM provar nada, e o id não vale nada até alguém
    // ler o desenho (§3.5, invariante 5b). `qrDado` guarda o corpo para o teste
    // conferir que ele cabe no teto de 256 B do `POST /par`.
    if (c && c.qr === true) {
      visto.qr.push(c);
      if (!qrLiberado) { json(res, 403, {}); return; }
      json(res, 202, { espera: ESPERA_QR });
      return;
    }
    if (c && c.espera) {
      // A espera do QR tem o seu próprio interruptor: enquanto o operador não
      // "lê o código", ela responde PENDENTE — o QR fica em cartaz sem
      // atravessar o percurso do PIN, que é o que o resto deste arquivo testa.
      if (c.espera === ESPERA_QR) {
        if (qrAprovado) { json(res, 200, { t: TOKEN }); return; }
        json(res, 202, { estado: 'pendente' });
        return;
      }
      if (!aprovar) { json(res, 403, { estado: 'recusada' }); return; }
      if (pendencias > 0) { pendencias--; json(res, 202, { estado: 'pendente' }); return; }
      json(res, 200, { t: TOKEN });
      return;
    }
    json(res, 404, {});
    return;
  }

  if (req.method === 'POST' && u.pathname === '/r') {
    if (req.headers.authorization !== 'Bearer ' + TOKEN) { json(res, 404, {}); return; }
    visto.volta.push(await corpoDe(req));
    json(res, 200, {});
    return;
  }

  if (req.method === 'GET' && u.pathname === '/v') {
    // 404 IDÊNTICO para token inválido — não vazar existência (§3.4, inv. 5).
    if (req.headers.authorization !== 'Bearer ' + TOKEN) { json(res, 404, {}); return; }
    visto.gets++;
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Connection': 'close',
    });
    fluxo = res;
    if (aoAbrirFluxo) { const f = aoAbrirFluxo; aoAbrirFluxo = null; f(res); }
    return;
  }

  json(res, 404, {});
});

// O quadro do fio (§5.2): 16 bytes de cabeçalho e a carga.
function quadro(tipo, flags, ptsUs, carga) {
  const h = Buffer.alloc(16);
  h[0] = tipo;
  h[1] = flags;
  h.writeUInt32BE(carga.length, 4);
  h.writeUInt32BE(Math.floor(ptsUs / 4294967296), 8);
  h.writeUInt32BE(ptsUs % 4294967296, 12);
  return Buffer.concat([h, carga]);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function aguardarFluxo() {
  if (fluxo) return fluxo;
  return new Promise((r) => { aoAbrirFluxo = r; });
}

await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
const pg = await ctx.newPage();
const errosConsole = [];
// "Failed to load resource" é filtrado pelo mesmo motivo de `tools/smoke.mjs`:
// aqui ele aparece para o `favicon.ico` que o navegador pede sozinho (e que a
// página não declara de propósito — §3.5, invariante 7) e para o **403 do PIN
// errado**, que é um caso do teste, não um defeito. O que interessa é exceção
// de página e erro de script: os dois passam por este filtro intactos.
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource/.test(t)) return;
  errosConsole.push(t);
});
pg.on('pageerror', (e) => errosConsole.push('pageerror: ' + e.message));

// ===========================================================================
// PARTE 1 — O NAVEGADOR COMO ORÁCULO DO MUXER
// ===========================================================================
console.log('— o muxer, medido pelo navegador ————————————————————————————————');

await pg.goto(base + '/oraculo', { waitUntil: 'domcontentloaded' });

// O oráculo roda inteiro dentro da página: monta o init, appenda N fragmentos e
// devolve o que o `buffered` virou. `fixa` troca a duração medida por uma
// constante — é o PAR NEGATIVO.
const medir = async (fixa) => pg.evaluate(async (op) => {
  const F = window.AVFmp4;

  // --- a *sample entry*, conforme o que este navegador aceita ---------------
  function b(...v) { return new Uint8Array(v); }
  function cabecalhoVisual(larg, alt) {
    const nome = new Uint8Array(32);
    return F.juntar([
      b(0, 0, 0, 0, 0, 0), F.b16(1), F.b16(0), F.b16(0),
      F.b32(0), F.b32(0), F.b32(0),
      F.b16(larg), F.b16(alt),
      F.b32(0x00480000), F.b32(0x00480000), F.b32(0),
      F.b16(1), nome, F.b16(0x0018), F.b16(0xffff),
    ]);
  }
  // Um SPS sintético mínimo, escrito bit a bit (H.264 §7.3.2.1.1): 80x45
  // macroblocos = 1280x720, perfil Baseline.
  function sps() {
    const bits = [];
    const u = (n, v) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
    const ue = (v) => {
      const n = v + 1;
      const w = Math.floor(Math.log2(n));
      for (let i = 0; i < w; i++) bits.push(0);
      u(w + 1, n);
    };
    u(8, 66); u(8, 0); u(8, 31);
    ue(0); ue(0); ue(0); ue(4); ue(1);
    bits.push(0);
    ue(79); ue(44);
    bits.push(1); bits.push(1); bits.push(0);
    bits.push(1);
    while (bits.length % 8) bits.push(0);
    const out = new Uint8Array(1 + bits.length / 8);
    out[0] = 0x67;
    for (let i = 0; i < bits.length; i++) if (bits[i]) out[1 + (i >> 3)] |= 1 << (7 - (i & 7));
    return out;
  }

  const MS = window.ManagedMediaSource || window.MediaSource;
  const AVC = 'video/mp4; codecs="avc1.42001F"';
  const VP9 = 'video/mp4; codecs="vp09.00.10.08"';
  let mime;
  let init;
  if (MS.isTypeSupported(AVC)) {
    mime = AVC;
    const pps = new Uint8Array([0x68, 0xce, 0x3c, 0x80]);
    const csd = F.juntar([new Uint8Array([0, 0, 0, 1]), sps(), new Uint8Array([0, 0, 0, 1]), pps]);
    const d = F.initVideo(csd);
    init = d.bytes;
    mime = d.mime;
  } else if (MS.isTypeSupported(VP9)) {
    mime = VP9;
    const vpcC = F.caixaCheia('vpcC', 1, 0, F.b8(0, 10, 0x82, 1, 1, 1), F.b16(0));
    const entrada = F.caixa('vp09', cabecalhoVisual(1280, 720), vpcC);
    init = F.initCom(entrada, 1280, 720);
  } else {
    return { erro: 'este navegador não aceita nem avc1 nem vp09 em MP4' };
  }

  // --- os fragmentos -------------------------------------------------------
  // Intervalos DESIGUAIS de propósito: 33 333 µs (cena em movimento) e
  // 125 000 µs (cena parada, só o batimento de 8 Hz). É a taxa variável que
  // torna a duração chutada um buraco.
  const passos = [33333, 33333, 1000000, 33333, 500000, 33333];
  const nalu = (n) => {
    const corpo = new Uint8Array(n).fill(0x41);
    return F.juntar([new Uint8Array([0, 0, 0, 1]), new Uint8Array([0x65]), corpo]);
  };

  // A BASE É DE CEM SEGUNDOS, e ela faz duas coisas de uma vez.
  //
  // A primeira é fidelidade: o carimbo do fio é ABSOLUTO desde o início da
  // sessão do celular (§5.2), então uma tela que entra 100 s depois recebe
  // fragmentos que começam em t = 100 s. Medir com base zero esconderia um
  // `tfdt` mal escrito atrás do caso mais fácil.
  //
  // A segunda é o que torna esta medição determinística: com o `buffered`
  // começando em 100 s e o elemento em `currentTime = 0`, o DECODIFICADOR
  // NUNCA COMEÇA — e as NALUs deste teste são sintéticas, então ele reprovaria.
  // Um `HTMLMediaElement` com `error` != null recusa todo `appendBuffer`
  // seguinte, e a medição morreria por um defeito do teste. O que se mede aqui
  // é o CONTÊINER; o bitstream é assunto do aparelho.
  const BASE = 100000000;
  let pts = BASE;
  const carimbos = [pts];
  for (const p of passos) { pts += p; carimbos.push(pts); }

  const frags = [];
  if (op.fixa) {
    // O DESENHO ANTERIOR: a duração escrita na hora, sem esperar o próximo PTS.
    for (let i = 0; i < carimbos.length - 1; i++) {
      frags.push(F.mediaSegment({
        seq: i + 1, dts: carimbos[i], dur: op.fixa, chave: i === 0,
        dados: F.anexoBParaAvcc(nalu(32)),
      }));
    }
  } else {
    // O MUXER DE VERDADE, com o atraso de um quadro.
    const m = F.criar();
    for (let i = 0; i < carimbos.length; i++) {
      const f = m.quadro({ ptsUs: carimbos[i], chave: i === 0, dados: nalu(32) });
      if (f) frags.push(f);
    }
  }
  const duracaoTotal = carimbos[frags.length] - carimbos[0];

  // --- a MediaSource -------------------------------------------------------
  // UM `<video>` NOVO A CADA MEDIÇÃO, e isto não é higiene: as NALUs deste
  // teste são sintéticas, então o decodificador REPROVA os dados depois que o
  // contêiner já foi aceito — e um `HTMLMediaElement` com `error` != null
  // recusa todo `appendBuffer` seguinte, em qualquer MediaSource. Reusar o
  // elemento faria a segunda medição falhar por um defeito do teste. O que se
  // mede aqui é o CONTÊINER; o bitstream é assunto do aparelho.
  const v = document.createElement('video');
  v.muted = true;
  document.body.appendChild(v);
  const ms = new MS();
  const pronto = new Promise((r) => ms.addEventListener('sourceopen', r, { once: true }));
  v.src = URL.createObjectURL(ms);
  await pronto;
  const sb = ms.addSourceBuffer(mime);
  sb.mode = 'segments';

  const appendar = (buf) => new Promise((resolve, reject) => {
    const ok = () => { limpar(); resolve(); };
    const ruim = () => { limpar(); reject(new Error('o SourceBuffer recusou')); };
    const limpar = () => {
      sb.removeEventListener('updateend', ok);
      sb.removeEventListener('error', ruim);
    };
    sb.addEventListener('updateend', ok);
    sb.addEventListener('error', ruim);
    sb.appendBuffer(buf);
  });

  try {
    await appendar(init);
    for (const f of frags) await appendar(f);
  } catch (e) {
    return { erro: (e && e.message) || 'append' };
  }

  const b2 = sb.buffered;
  const faixas = [];
  for (let i = 0; i < b2.length; i++) faixas.push([b2.start(i), b2.end(i)]);
  return { mime, faixas, duracaoTotal: duracaoTotal / 1e6, fragmentos: frags.length };
}, { fixa });

const bom = await medir(0);
checar(!bom.erro, 'o init + os fragmentos são aceitos por uma MediaSource de verdade', bom.erro);
if (!bom.erro) {
  console.log('        (codec usado neste navegador: ' + bom.mime + ')');
  checar(bom.faixas.length === 1,
    'sb.buffered.length === 1 — NENHUM BURACO, com taxa de quadros variável',
    JSON.stringify(bom.faixas));
  const dur = bom.faixas.length ? bom.faixas[0][1] - bom.faixas[0][0] : 0;
  checar(Math.abs(dur - bom.duracaoTotal) < 0.02,
    'end − start ≈ a soma das durações medidas (' + bom.duracaoTotal.toFixed(3) + ' s)',
    dur.toFixed(3) + ' s');
  checar(bom.faixas.length === 1 && Math.abs(bom.faixas[0][0] - 100) < 0.001,
    'e o intervalo começa em t = 100 s: o tfdt é o carimbo do fio, VERBATIM',
    JSON.stringify(bom.faixas));
}

// O PAR NEGATIVO. Sem ele a asserção acima poderia ser sorte da coalescência.
//
// E ele revelou algo PIOR que o buraco previsto pelo D3, que vale registrar
// porque muda o prognóstico: com a duração chutada, o Chromium não abre um
// segundo intervalo — ele DESCARTA os quadros que vêm depois do buraco. O
// processamento de quadros do MSE detecta a descontinuidade, liga
// `need random access point flag`, e daí em diante só aceita quadro-chave; como
// o servidor manda um IDR a cada 10 s (§3.3, invariante 3), a projeção
// congelaria por até dez segundos a cada cena parada, sem um único erro em
// lugar nenhum. Por isso a asserção é sobre COBRIR o fluxo, e não sobre contar
// intervalos: ela pega os dois modos de falhar.
const ruim = await medir(33333);
const cobre = ruim.faixas && ruim.faixas.length === 1
  && Math.abs((ruim.faixas[0][1] - ruim.faixas[0][0]) - ruim.duracaoTotal) < 0.02;
checar(!ruim.erro && !cobre,
  'e com a duração CHUTADA (o desenho anterior) o buffered NÃO cobre o fluxo — a asserção tem dentes',
  JSON.stringify(ruim.faixas || ruim.erro) + ' para ' + (ruim.duracaoTotal || 0).toFixed(3) + ' s de mídia');

// ===========================================================================
// PARTE 2 — O CLIENTE, PONTA A PONTA
// ===========================================================================
console.log('\n— o cliente, do PIN ao primeiro quadro ———————————————————————————');

// Um JPEG DE VERDADE, produzido pelo próprio navegador: um `Buffer` inventado
// à mão passaria pelo transporte e morreria no decodificador, e o teste diria
// "modo imagem não funciona" por um defeito do teste.
const JPEG = Buffer.from(await pg.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const g = c.getContext('2d');
  g.fillStyle = '#dba849';
  g.fillRect(0, 0, 64, 36);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}));
checar(JPEG.length > 100 && JPEG[0] === 0xff && JPEG[1] === 0xd8, 'o JPEG de teste é um JPEG');

pendencias = 2;
await pg.goto(base + '/', { waitUntil: 'domcontentloaded' });

// A PÁGINA É ANÔNIMA (§3.5, invariante 7). Nada de versão, nome de aparelho,
// SSID ou nome de igreja antes de o visitante provar alguma coisa.
{
  const t = await pg.title();
  const visivel = (await pg.$eval('#par', (e) => e.innerText)).replace(/\s+/g, ' ').trim();
  checar(t === 'Tela', 'o título não identifica nada', t);
  checar(!/\bv?\d+\.\d+/.test(visivel), 'e o texto visível não traz versão nenhuma', visivel);
  const jogaPlayer = await pg.$eval('#play', (e) => e.hidden);
  checar(jogaPlayer, 'a página abre no estado de PAREAMENTO');
}

// O QR NASCE COM A PÁGINA — sem toque, sem foco, sem nada a digitar. É o ponto
// inteiro do recurso: numa TV ninguém vai clicar em "gerar código".
{
  await pg.waitForFunction(() => !document.getElementById('qrBox').hidden,
    null, { timeout: 8000 }).catch(() => {});
  const visivel = await pg.$eval('#qrBox', (e) => !e.hidden);
  checar(visivel, 'o QR aparece sozinho ao abrir a página, sem nenhum toque');

  // E ele foi DESENHADO: um canvas em branco passaria na asserção acima.
  const desenho = await pg.evaluate(() => {
    const c = document.getElementById('qr');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let escuros = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) escuros += 1;
    return { lado: c.width, escuros, total: d.length / 4 };
  });
  // Versão 3 (29 módulos) + 4 de zona de silêncio de cada lado = 37.
  checar(desenho.lado === 37, 'com o tamanho da versão 3 mais a zona de silêncio', desenho.lado);
  checar(desenho.escuros > desenho.total * 0.2 && desenho.escuros < desenho.total * 0.6,
    'e com módulos escuros de verdade — não é um quadrado em branco',
    desenho.escuros + '/' + desenho.total);

  // O CORPO CABE NO TETO. O `POST /par` aceita 256 bytes e o servidor fecha a
  // conexão acima disso, o que na tela vira "não foi possível falar com o
  // celular" — uma falha sem causa visível. A conta é apertada e precisa de
  // guarda.
  const corpo = visto.qr[0];
  const bytes = Buffer.byteLength(JSON.stringify(corpo));
  checar(bytes <= 256, 'e o corpo do pedido de QR cabe nos 256 B do POST /par', bytes);
  checar(corpo && corpo.qr === true && !corpo.pin,
    'o pedido de QR não leva PIN nenhum — ele não prova nada, e não precisa');

  // O PIN continua existindo como plano B, e ISSO É O CONTRATO: a câmera pode
  // faltar, a leitura de QR pode não existir naquele WebView.
  checar(await pg.$('#pin') !== null, 'e os seis dígitos continuam na tela como plano B');
}

// PIN errado: mensagem, e o botão volta a funcionar.
// O campo mora num `<details>` fechado desde que o QR virou o caminho
// principal — abri-lo é o que o visitante faria, e é o que este teste faz.
await pg.click('#pinBox > summary');
await pg.fill('#pin', '000000');
await pg.click('#parBtn');
await pg.waitForFunction(() => document.getElementById('parMsg').textContent.length > 0
  && !document.getElementById('parBtn').disabled, null, { timeout: 5000 });
checar(/não confere/i.test(await pg.$eval('#parMsg', (e) => e.textContent)),
  'PIN errado diz que não confere, e destrava o botão para tentar de novo');

// PIN certo: o servidor põe a tela como PENDENTE e o operador aprova.
await pg.fill('#pin', PIN);
await pg.click('#parBtn');
await pg.waitForFunction(() => /Aguardando/.test(document.getElementById('parMsg').textContent),
  null, { timeout: 5000 });
checar(true, 'PIN certo entra em ESPERA — quem libera é o operador, não o PIN');

await pg.waitForFunction(() => !document.getElementById('play').hidden, null, { timeout: 15000 });
checar(true, 'aprovada, a MESMA página troca para o player (sem navegar)');

// AS DUAS ASSERÇÕES NEGATIVAS QUE MAIS IMPORTAM.
{
  const href = pg.url();
  checar(href === base + '/', 'a URL não mudou: nada de token em query nem em fragmento', href);
  checar(!visto.urls.some((u) => u.indexOf(TOKEN) >= 0),
    'e o servidor NUNCA viu o token numa URL',
    visto.urls.filter((u) => u.indexOf(TOKEN) >= 0).join(' '));
  const guardado = await pg.evaluate(() => sessionStorage.getItem('av-espelho'));
  checar(guardado === TOKEN, 'o token mora em sessionStorage');
  checar(visto.autorizacoes.some((a) => a === 'Bearer ' + TOKEN),
    'e sobe em Authorization: Bearer', JSON.stringify(visto.autorizacoes.slice(0, 3)));
}

// O FLUXO: modo imagem (Entrega 1), pelo MESMO transporte.
{
  const r = await aguardarFluxo();
  r.write(quadro(0x20, 0, 1000000, JPEG));
  r.write(quadro(0x20, 0, 2000000, JPEG));
  await pg.waitForFunction(() => window.__espelho.estado().quadros >= 2, null, { timeout: 10000 });
  const e = await pg.evaluate(() => window.__espelho.estado());
  checar(e.modoImagem, 'um quadro 0x20 liga o MODO IMAGEM sozinho, no mesmo fluxo /v');
  checar(/apagar sozinha/.test(e.aviso),
    'e a página DIZ que neste modo a tela do aparelho pode apagar (§3.10, P25)', e.aviso);
  const pintou = await pg.$eval('#foto', (c) => {
    const g = c.getContext('2d');
    const d = g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  checar(pintou[0] > 180 && pintou[1] > 120 && pintou[2] < 120,
    'o JPEG foi realmente desenhado no canvas (o pixel do meio é o âmbar)',
    JSON.stringify(pintou));
}

// A RECONEXÃO: o servidor fecha, o cliente volta sozinho.
{
  const antes = visto.gets;
  fluxo.end();
  fluxo = null;
  await pg.waitForFunction((n) => window.__espelho.estado().reconexoes > n, 0, { timeout: 15000 });
  const r = await aguardarFluxo();
  checar(visto.gets > antes, 'o fluxo caiu e o cliente abriu um GET /v novo, sozinho',
    antes + ' → ' + visto.gets);
  r.write(quadro(0x20, 0, 3000000, JPEG));
  await pg.waitForFunction(() => window.__espelho.estado().quadros >= 3, null, { timeout: 10000 });
  checar(true, 'e volta a desenhar depois da reconexão');
}

// O CSD DE VÍDEO num navegador sem H.264: o cliente NOMEIA o formato em vez de
// ficar preto. Num Chrome com codecs proprietários o caminho é o outro, e o que
// se exige é que ele NÃO reclame.
{
  const temAvc = await pg.evaluate(
    () => (window.ManagedMediaSource || window.MediaSource).isTypeSupported('video/mp4; codecs="avc1.42001F"'));
  const sps = Buffer.from([0x67, 0x42, 0x00, 0x1f, 0xe9, 0x00, 0xa0, 0x0b, 0x77, 0xfe, 0x00, 0x20]);
  const pps = Buffer.from([0x68, 0xce, 0x3c, 0x80]);
  const s4 = Buffer.from([0, 0, 0, 1]);
  fluxo.write(quadro(0x01, 0, 4000000, Buffer.concat([s4, sps, s4, pps])));
  await espera(600);
  const e = await pg.evaluate(() => window.__espelho.estado());
  if (temAvc) {
    checar(!/não decodifica/.test(e.aviso), 'com H.264 disponível, o csd é aceito sem reclamação', e.aviso);
  } else {
    checar(/não decodifica avc1\./.test(e.aviso),
      'sem H.264 o cliente NOMEIA o formato que falta, em vez de ficar preto', e.aviso);
  }
}

// A VOLTA (§5.1): três palavras, e nada que venha da rede entra no barramento.
{
  const tipos = new Set(visto.volta.filter(Boolean).map((x) => x.do));
  checar([...tipos].every((t) => t === 'key' || t === 'alive' || t === 'audio'),
    'o upstream do cliente é só key/alive/audio', JSON.stringify([...tipos]));

  // O `alive` conta o estado DA TELA para o Registro do operador (a frase que
  // está escrita nela, se a faixa de som nasceu, quantos recomeços). Ele
  // precisa CABER nos 256 B do `POST /r`: acima do teto o servidor fecha a
  // conexão seca, e do lado de cá isso vira "não foi possível falar com o
  // celular" — uma falha sem causa visível, justamente no canal que existe
  // para dar causa às falhas.
  const alives = visto.volta.filter((x) => x && x.do === 'alive');
  checar(alives.length > 0, 'o cliente relata o próprio estado por `alive`', alives.length);
  const maior = Math.max(0, ...alives.map((a) => Buffer.byteLength(JSON.stringify(a))));
  checar(maior <= 256, 'e o relato cabe nos 256 B do POST /r', maior);
  checar(alives.some((a) => 'aviso' in a && 'som' in a && 'recomecos' in a),
    'com a frase da tela, o estado do som e os recomeços',
    JSON.stringify(alives[0]));
}

// ---------------------------------------------------------------------------
// E O PERCURSO INTEIRO DO QR, numa aba limpa: abrir o endereço, o operador ler
// o código, e a tela entrar — SEM NINGUÉM DIGITAR NADA. É a promessa do
// recurso, e ela precisa estar travada por um caso e não por uma frase no doc.
//
// Aba nova (contexto novo) porque o `sessionStorage` da anterior já tem token:
// com ele a página vai direto ao player e o pareamento não acontece.
// ---------------------------------------------------------------------------
{
  const ctx2 = await navegador.newContext();
  const pg2 = await ctx2.newPage();
  await pg2.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await pg2.waitForFunction(() => window.__espelho && window.__espelho.estado().qr,
    null, { timeout: 8000 }).catch(() => {});
  const antes = await pg2.evaluate(() => window.__espelho.estado());
  checar(antes.qr && !antes.pareado, 'numa aba limpa a tela mostra o código e NÃO está pareada');

  // O "operador lê o código": no aparelho é a câmera do Controle chamando
  // `espelhoAprovar(id, true)`; aqui é o servidor de mentira aprovando a MESMA
  // espera que o QR carrega.
  qrAprovado = true;
  await pg2.waitForFunction(() => !document.getElementById('play').hidden,
    null, { timeout: 15000 });
  const depois = await pg2.evaluate(() => window.__espelho.estado());
  checar(depois.pareado, 'lido o código, a tela entra sozinha — nenhuma tecla foi digitada');
  checar(!depois.qr, 'e o código sai do ar assim que ela entra');
  await ctx2.close();
}

checar(errosConsole.length === 0, 'nenhum erro de console no percurso inteiro',
  errosConsole.join('\n        '));

await navegador.close();
try { if (fluxo) fluxo.end(); } catch (_) {}
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
