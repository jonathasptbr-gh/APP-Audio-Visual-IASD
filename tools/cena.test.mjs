// A CENA: o que o telão mostra, o que o operador ajusta nela e o que ele LÊ
// sobre ela (v5.142 — o lote de relatos de 08/08).
//
// ## Por que ele existe
//
// A reconexão do dongle é o caminho menos testável do app à mão: exige uma TV,
// um dongle e o timing de derrubá-lo no momento certo. E é um caminho que roda
// na frente da congregação, sozinho, sem ninguém pedindo — o que ele fizer de
// errado aparece projetado.
//
// A regra que este teste trava é a que faltava: **`currentId` não é "está em
// cena"**. Ele sobrevive de propósito ao stop e ao fim natural (é o que permite
// repetir a faixa com o ▶), então reenviar a cena por ele fazia o telão acordar
// tocando o que o operador tinha parado, ou ressuscitar a música que acabou —
// os dois relatos de 08/08. Quem responde a pergunta certa é `midiaNoAr`.
//
// O mesmo estado corrige o ▶ depois do stop: ele decidia por
// `preview.getCurrent()`, que só fica nulo no FIM do fade de saída — o `play`
// dado antes disso era apagado pelo `clear` que terminava atrás, e o operador
// aprendeu a tocar em stop duas vezes para "destravar".
//
//   node tools/reconexao.test.mjs
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
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function',
    null, { timeout: 20000 },
  );
  await pg.evaluate(() => setAppMode('full'));

  // O barramento é o único observador honesto: é por ele que o telão recebe a
  // cena, e é exatamente o que um telão que reconecta veria.
  await pg.evaluate(() => {
    window.__espiao = [];
    const original = AVDB.sendCommand;
    AVDB.sendCommand = (m) => { window.__espiao.push(m); return original(m); };
  });

  // A espera existe porque nem toda ação do app é síncrona: o `▶` cai em
  // `send()`, que lê o registro do IndexedDB ANTES de mandar o `load`. Ler o
  // espião no retorno do clique pegaria a lista vazia — e o teste passaria a
  // afirmar o contrário do que quer verificar.
  const cena = async (fn) => pg.evaluate(async (corpo) => {
    window.__espiao.length = 0;
    // eslint-disable-next-line no-new-func
    await new Function('return (' + corpo + ')()')();
    await new Promise((r) => setTimeout(r, 200));
    return window.__espiao.map((m) => m.type);
  }, fn.toString());

  // ---- Uma mídia de verdade em cena ----
  const id = await pg.evaluate(async () => {
    const rec = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }), {
      name: 'Louvor de teste', type: 'video/mp4', kind: 'video', list: 'imports',
    });
    await load();
    await send(rec.id);
    return rec.id;
  });
  checar(await pg.evaluate(() => midiaNoAr), 'projetar uma mídia marca que há cena no telão');

  let tipos = await cena(async () => { resendSceneToDisplay('telao-1'); });
  checar(tipos.includes('load'), 'e um telão que reconecta agora RECEBE a cena de volta');

  // ---- STOP: o telão está vazio, e a reconexão não pode ressuscitar nada ----
  await pg.evaluate(() => stopClear());
  checar(!(await pg.evaluate(() => midiaNoAr)), 'o stop marca o telão como vazio NA HORA (não no fim do fade)');
  checar(await pg.evaluate(() => currentId) === id,
    'e o item continua SELECIONADO — é o que permite repetir com o ▶');
  tipos = await cena(async () => { resendSceneToDisplay('telao-2'); });
  checar(!tipos.includes('load'),
    'reconectar depois do stop NÃO reenvia a mídia (era o "vídeo engatilhado" no telão)');

  // ---- O ▶ logo depois do stop, com o fade ainda correndo ----
  // É o defeito dos "dois toques no stop": `preview.getCurrent()` ainda devolve
  // o registro durante todo o esmaecimento do `clearFaded`.
  const aindaTemPreview = await pg.evaluate(() => !!preview.getCurrent());
  const acao = await cena(async () => { playPauseEl.click(); });
  checar(acao.includes('load'),
    'o ▶ logo depois do stop RECARREGA (um só toque), mesmo com o fade em curso'
    + (aindaTemPreview ? '' : ' [preview já limpa neste ambiente]'));
  checar(!acao.includes('play'),
    'e não manda um "play" que o clear em curso apagaria — era isso que parecia botão morto');

  // ---- FIM NATURAL: mesma regra ----
  await pg.evaluate(async () => { await send(currentId); });
  checar(await pg.evaluate(() => midiaNoAr), 'tocar de novo recoloca a cena no ar');
  await pg.evaluate(() => { repeat = 'off'; resetAfterEnd(); });
  checar(!(await pg.evaluate(() => midiaNoAr)),
    'a música que ACABA também deixa o telão vazio (o wallpaper é o repouso)');
  tipos = await cena(async () => { resendSceneToDisplay('telao-3'); });
  checar(!tipos.includes('load'),
    'e reconectar depois do fim não traz a faixa de volta (a "primeira tela/thumbnail" do relato)');

  // ---- GIRAR ----
  // O giro é preferência de EXIBIÇÃO: ele precisa chegar ao telão que reconecta
  // antes do conteúdo, senão a mídia aparece deitada e endireita na frente de
  // todos.
  await pg.evaluate(async () => { await send(currentId); await applyRotate(90); });
  checar(await pg.evaluate(() => mediaRot) === 90, 'girar guarda o ângulo');
  checar(await pg.evaluate(() => preview.getRotate()) === 90, 'e a preview gira junto com o telão');
  tipos = await cena(async () => { resendSceneToDisplay('telao-4'); });
  checar(tipos.indexOf('rotate') === 0 && tipos.indexOf('rotate') < tipos.indexOf('load'),
    'e a reconexão manda o giro ANTES da mídia');
  const voltas = await pg.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 4; i++) { await applyRotate(mediaRot + 90); out.push(mediaRot); }
    return out;
  });
  checar(JSON.stringify(voltas) === JSON.stringify([180, 270, 0, 90]),
    'o botão avança 90° por toque e dá a volta (ninguém pensa em "270°")');
  await pg.evaluate(() => applyRotate(0));

  // ---- "ESTICAR" saiu, e o valor guardado é migrado ----
  const fitDepois = await pg.evaluate(() => [...document.querySelectorAll('#fitSeg .fit-opt')].map((b) => b.dataset.fit));
  checar(JSON.stringify(fitDepois) === JSON.stringify(['contain', 'cover']),
    'o seletor de preenchimento ficou com duas opções — "Esticar" distorcia a proporção');
  const migrou = await pg.evaluate(async () => {
    await AVDB.setState('fit', 'fill');
    await load();
    return { atual: mediaFit, guardado: await AVDB.getState('fit') };
  });
  checar(migrou.atual === 'contain' && migrou.guardado === 'contain',
    'e quem já tinha "Esticar" guardado é migrado — senão a mídia ficaria distorcida sem controle na tela');

  // ---- A barra de tempo do simplificado ----
  const barra = await pg.evaluate(() => {
    const hit = document.getElementById('simpleTimeHit');
    return { existe: !!hit, papel: hit && hit.getAttribute('role') };
  });
  checar(barra.existe && barra.papel === 'slider',
    'a linha do tempo do modo fácil virou um controle, não um indicador');

  // E ela SALTA de verdade. O toque no meio de uma faixa de 200 s tem de mandar
  // um `seek` para perto de 100 s — o `pointerup` é quem comanda, porque um
  // `seek` por quadro de movimento faria a mídia engasgar durante todo o gesto.
  const saltou = await pg.evaluate(async () => {
    setAppMode('simple');
    seekEl.max = '200'; seekEl.value = '10'; seekEl.disabled = false;
    renderSimpleTime();
    const hit = document.getElementById('simpleTimeHit');
    const r = hit.getBoundingClientRect();
    const meio = r.left + r.width / 2;
    const ev = (t, x) => hit.dispatchEvent(new PointerEvent(t, {
      bubbles: true, pointerId: 1, clientX: x, clientY: r.top + r.height / 2,
    }));
    window.__espiao.length = 0;
    ev('pointerdown', meio);
    const durante = window.__espiao.map((m) => m.type);
    ev('pointermove', meio);
    ev('pointerup', meio);
    await new Promise((res) => setTimeout(res, 50));
    const seeks = window.__espiao.filter((m) => m.type === 'seek');
    setAppMode('full');
    return { durante, tempo: seeks.length ? seeks[seeks.length - 1].time : null, quantos: seeks.length };
  });
  checar(!saltou.durante.includes('seek'), 'arrastar não manda um seek por quadro (a mídia não engasga)');
  checar(saltou.quantos === 1 && Math.abs(saltou.tempo - 100) < 12,
    'e soltar no meio da barra salta para o meio da faixa (um seek, no ponto certo)');

  // ---- A DIVISÃO DAS ESTROFES no visualizador de letra ----
  //
  // Um slide da API pode trazer mais de uma estrofe separadas por LINHA EM
  // BRANCO, e o `white-space: pre-line` do CSS COLAPSA `\n\n` numa quebra só:
  // as duas encostavam e a letra parecia um bloco indivisível. É por isso que
  // cada bloco precisa ser um nó próprio — e é isso que se verifica aqui, não a
  // aparência.
  const estrofes = await pg.evaluate(() => {
    const alvo = document.createElement('div');
    const salvo = currentItem;
    currentItem = {
      lyrics: [
        { cover: true },
        { text: 'Primeira estrofe linha um\nlinha dois\n\nSegunda estrofe linha um\nlinha dois', auxText: 'Estrofe' },
        { text: 'Bloco único, sem divisão' },
      ],
    };
    lvBuildSong(alvo, 1);
    currentItem = salvo;
    const linhas = [...alvo.querySelectorAll('.lv-row')];
    return {
      linhas: linhas.length,
      blocosNaPrimeira: linhas[1].querySelectorAll('.lv-text').length,
      blocosNaSegunda: linhas[2].querySelectorAll('.lv-text').length,
      destaque: linhas[1].classList.contains('current'),
      textos: [...linhas[1].querySelectorAll('.lv-text')].map((n) => n.textContent),
    };
  });
  checar(estrofes.linhas === 3, 'o visualizador mantém UMA linha por slide (a posição no tempo não muda)');
  checar(estrofes.blocosNaPrimeira === 2,
    'e um slide com duas estrofes separadas por linha em branco vira DOIS parágrafos');
  checar(estrofes.blocosNaSegunda === 1, 'um slide de estrofe única continua sendo um parágrafo só');
  checar(estrofes.destaque, 'e o destaque da estrofe no ar continua na LINHA, não no parágrafo');
  checar(estrofes.textos[0].includes('\n') && !estrofes.textos[0].includes('Segunda'),
    'as quebras DENTRO da estrofe continuam intactas — só a divisão entre elas foi separada');
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
