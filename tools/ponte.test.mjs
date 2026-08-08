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

  // `idleMs` com valor de verdade: é ele que separa "travado" de "esta faixa é
  // grande" — sumindo, a notificação volta a prometer uma ETA que não existe.
  const t = await pg.evaluate(() => {
    AVNative.bgProgress({ label: 'x', done: 1, total: 54, items: [], idleMs: 95_000 });
    return JSON.parse(window.__recebido.bgProgress);
  });
  checar(t.idleMs === 95_000,
    'bgProgress leva o `idleMs` — sem ele o "sem resposta há X" nunca aparece',
    t.idleMs);

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
  checar(n.title === 'Hino 471' && n.subtitle === 'Hinário',
    'e o título e o subtítulo — é o que a notificação e a tela de bloqueio exibem',
    n.title + ' / ' + n.subtitle);
  checar(n.wallpaper === false, 'e a bandeira `wallpaper`', n.wallpaper);

  // O outro estado das bandeiras: `false`/ausente é o que o `optBoolean` lê
  // quando o campo NÃO viaja, então só o par true/false prova que ele viaja.
  const w = await pg.evaluate(() => {
    AVNative.nowPlaying({
      active: true, title: 'Cortina', subtitle: '', playing: false,
      slideMode: false, slideLabel: '', wallpaper: true,
      positionMs: 0, durationMs: 0,
    });
    return JSON.parse(window.__recebido.nowPlaying);
  });
  checar(w.wallpaper === true, 'wallpaper=true também chega (o par completo)', w.wallpaper);

  // Acima de 2³¹ ms: o `| 0` que a v5.137 matou no bgProgress com `inteiro()`
  // sobrevivia aqui — posição/duração viravam negativas e o `Math.max` zerava.
  const l = await pg.evaluate(() => {
    AVNative.nowPlaying({
      active: true, title: 'Maratona', subtitle: '', playing: true,
      positionMs: 2_500_000_000, durationMs: 3_100_000_000,
    });
    return JSON.parse(window.__recebido.nowPlaying);
  });
  checar(l.positionMs === 2_500_000_000 && l.durationMs === 3_100_000_000,
    'acima de 2³¹ ms a linha do tempo NÃO vira negativa (o defeito irmão do bgProgress)',
    l.positionMs + '/' + l.durationMs);

  // ---- o DRENO do ESPELHO DE PIXELS, e o PAR NEGATIVO ---------------------
  //
  // O espelho é uma segunda cópia de `/web/display/` (ver
  // docs/ESPELHO-DE-PIXELS.md). Ele não pode falar no barramento — a
  // arquitetura supõe um telão só —, MENOS por um comando: o `display-ready`,
  // que é o que faz o Controle reenviar a cena. Calado por inteiro, o espelho
  // fica no wallpaper para sempre; falando à vontade, ele envenena o
  // `display-status` que sincroniza a preview e a notificação de mídia.
  //
  // O par NEGATIVO é o que dá sentido ao positivo: um dreno que calasse TODO
  // MUNDO passaria no teste do espelho com louvor e derrubaria o telão de
  // verdade — em silêncio, e só no aparelho. Por isso as mesmas quatro
  // mensagens são enviadas nos dois papéis, e as duas asserções são opostas.
  //
  // `window.__CanalReal` é capturado no init script, ANTES de o native.js
  // trocar o construtor: é a única forma de o teste falar pelo barramento
  // "por fora" do dreno e observá-lo dos dois lados.
  async function paginaComPapel(papel) {
    const p = await navegador.newPage();
    await p.addInitScript((role) => {
      window.__CanalReal = window.BroadcastChannel;
      window.__busPost = [];
      window.__AVBridge = {
        shellVersion: () => 99,
        role: () => role,
        appVersion: () => 'v9.9',
        busPost: (json) => { window.__busPost.push(JSON.parse(json)); },
        otaConfirm: () => {},
      };
    }, papel);
    await p.goto('about:blank');
    await p.addScriptTag({ content: NATIVE });
    return p;
  }

  // As quatro mensagens são as do caso real: o anúncio que PRECISA sair, e
  // três dos emissores que precisam morrer (o de 4 Hz, o que faz o Controle
  // avançar a playlist e o que apagaria o estado do microfone de verdade).
  const percursoDoBarramento = async () => {
    window.__AVBus.post({ type: 'display-ready', __de: 'inst-1' });
    window.__AVBus.post({ type: 'display-status', currentTime: 12 });
    window.__AVBus.post({ type: 'media-ended', id: 'hino-471' });
    window.__AVBus.post({ type: 'mic-status', on: false });

    // O canal que o `db.js` criaria (`new BroadcastChannel(...)`), e um
    // ouvinte pelo construtor REAL para ver o que sai dele.
    const canal = new BroadcastChannel('av-iasd');
    const recebidos = [];
    canal.addEventListener('message', (ev) => recebidos.push(ev.data));
    const ouvinte = new window.__CanalReal('av-iasd');
    const saiu = [];
    ouvinte.addEventListener('message', (ev) => saiu.push(ev.data));

    canal.postMessage({ type: 'display-status', currentTime: 12 });
    // E alguém DE FORA manda: é o Controle falando com o telão. Isto tem de
    // chegar nos dois papéis — o dreno mata o envio, nunca a recepção.
    new window.__CanalReal('av-iasd').postMessage({ type: 'load', mediaId: 'x' });
    await new Promise((r) => setTimeout(r, 250));

    return {
      papel: window.__AV_ROLE__,
      bus: window.__busPost,
      temBC: 'BroadcastChannel' in window,   // a pergunta que o db.js faz
      construtorTrocado: window.BroadcastChannel !== window.__CanalReal,
      canalEhReal: canal instanceof window.__CanalReal,
      recebeu: recebidos.some((m) => m && m.type === 'load'),
      vazou: saiu.some((m) => m && m.type === 'display-status'),
    };
  };

  const pgEspelho = await paginaComPapel('espelho');
  const esp = await pgEspelho.evaluate(percursoDoBarramento);

  checar(esp.papel === 'espelho', 'o papel `espelho` chega ao lado web', esp.papel);
  checar(esp.bus.length === 1 && esp.bus[0].type === 'display-ready',
    'no espelho, o relay nativo deixa passar SÓ o display-ready (lista de permissão de um item)',
    JSON.stringify(esp.bus.map((m) => m.type)));
  checar(esp.bus.length === 1 && esp.bus[0].__de === 'inst-1',
    'e ele passa ASSINADO — é o `__de` que faz o reenvio da cena ser endereçado',
    JSON.stringify(esp.bus[0]));
  checar(esp.vazou === false,
    'e o BroadcastChannel do espelho não emite nada (postMessage é no-op)', esp.vazou);
  checar(esp.temBC === true,
    "mas a API CONTINUA existindo — o db.js decide o canal por `'BroadcastChannel' in global`",
    esp.temBC);
  checar(esp.construtorTrocado === true && esp.canalEhReal === true,
    'o canal criado é uma SUBCLASSE do real: só o envio morreu',
    'trocado=' + esp.construtorTrocado + ' real=' + esp.canalEhReal);
  checar(esp.recebeu === true,
    'e a RECEPÇÃO segue inteira — sem ela o espelho nunca receberia a cena de volta',
    esp.recebeu);

  // O PAR NEGATIVO. Mesmas quatro mensagens, papel do telão de verdade.
  const pgDisplay = await paginaComPapel('display');
  const dsp = await pgDisplay.evaluate(percursoDoBarramento);

  checar(dsp.bus.length === 4,
    'PAR NEGATIVO: no papel `display` as QUATRO mensagens saem — o dreno não vazou para o telão',
    JSON.stringify(dsp.bus.map((m) => m.type)));
  checar(dsp.construtorTrocado === false,
    'e o BroadcastChannel do telão não é tocado', dsp.construtorTrocado);
  checar(dsp.vazou === true,
    'e ele continua EMITINDO pelo canal (é o segundo caminho do relay)', dsp.vazou);
  checar(dsp.recebeu === true, 'e recebendo, como sempre', dsp.recebeu);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
