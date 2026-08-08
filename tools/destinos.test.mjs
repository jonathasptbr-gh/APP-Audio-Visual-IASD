// UM ITEM, VÁRIOS DESTINOS — o multi-destino das folhas de escolha (v5.141).
//
// ## Por que ele existe
//
// Toda porta de entrada do app (acervo, busca do YouTube, link compartilhado,
// importação de arquivos) pergunta "para onde?" numa folha em que cada linha é
// uma ação completa: o toque executa e a folha fecha. O multi-destino
// acrescentou uma CAIXA DE MARCAÇÃO a cada linha de destino sem tirar nada
// daquilo — e é justamente esse "sem tirar nada" que precisa de trava:
//
//  - a linha continua sendo UM toque quando nada está marcado (o caminho de
//    sempre, e o mais usado durante um culto);
//  - a caixa NÃO pode disparar a ação da linha (era o defeito óbvio: ela vive
//    DENTRO do botão, e sem `stopPropagation` marcar fecharia a folha);
//  - o que está marcado tem de VIAJAR até a ação — e ela roda DEPOIS de
//    `closeSongMenu()`, que zera o conjunto. Um `destUniao()` lido tarde demais
//    devolveria só a linha tocada, calado: o item iria para um destino em vez
//    de dois, e ninguém veria erro nenhum. É a mesma classe de falha muda do
//    `slideLabel` no `nowPlaying` e do `bytes` no `bgProgress`.
//
// O teste roda em Chromium de verdade, sobre a base web servida como no
// aparelho — mas SEM `__AVBridge`, então é o caminho de navegador. Ele opera a
// folha do acervo (a única que não precisa de rede) e confere o que entrou no
// IndexedDB, que é o único lugar onde a resposta é verificável.
//
//   node tools/destinos.test.mjs
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
  // O app ABRE no simplificado (ver `storedAppMode`), e as folhas de destino são
  // do avançado — é lá que existem Cronograma e playlist para escolher.
  await pg.evaluate(() => setAppMode('full'));

  // ---- A TABELA é a fonte única dos destinos ----
  // Ela existe para que uma porta nova não invente uma segunda lista de
  // destinos — foi o que aconteceu com o `YT_LISTA`, que duplicava as MESMAS
  // três listas só para o YouTube.
  const tabela = await pg.evaluate(() => (typeof DESTINOS === 'undefined' ? null : DESTINOS.map((d) => [d.chave, d.lista])));
  checar(!!tabela && tabela.length === 3, 'a tabela de destinos existe e tem os três lugares');
  checar(JSON.stringify(tabela) === JSON.stringify([
    ['playlist', 'playlist'], ['cronograma', 'imports'], ['favoritos', 'favs'],
  ]), 'e cada chave aponta para a lista certa do banco');

  // ---- Uma mídia de mentira, para ter o que mandar ----
  // O acervo LouvorJA precisa de rede; o que se testa aqui é o TRANSPORTE dos
  // destinos, não o download. Uma mídia criada direto no banco basta — é o
  // mesmo id que `addSongToDestinos` entregaria a `adicionarNasListas`.
  const idMidia = await pg.evaluate(async () => {
    const rec = await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }), {
      name: 'Louvor de teste', type: 'audio/mpeg', kind: 'audio', list: 'avulsos',
    });
    return rec.id;
  });

  // ---- O caminho de UM destino continua igual ----
  await pg.evaluate((id) => adicionarNaLista('imports', id, 'Louvor de teste', null), idMidia);
  let onde = await pg.evaluate(async (id) => ({
    imports: await AVDB.listHas('imports', id),
    playlist: await AVDB.listHas('playlist', id),
    favs: await AVDB.listHas('favs', id),
  }), idMidia);
  checar(onde.imports && !onde.playlist && !onde.favs, 'um destino só continua indo para um lugar só');

  // ---- VÁRIOS de uma vez ----
  await pg.evaluate((id) => adicionarNasListas(['playlist', 'favs'], id, 'Louvor de teste', null), idMidia);
  onde = await pg.evaluate(async (id) => ({
    imports: await AVDB.listHas('imports', id),
    playlist: await AVDB.listHas('playlist', id),
    favs: await AVDB.listHas('favs', id),
  }), idMidia);
  checar(onde.playlist && onde.favs, 'e dois destinos num pedido só chegam aos dois');
  checar(onde.imports, 'sem tirar o item de onde ele já estava');

  // ---- A frase do aviso nomeia TODOS os destinos ----
  // "adicionado à playlist" para um item que foi a três lugares é o app
  // contando metade da verdade — e é a metade que o operador usaria para
  // decidir se precisa repetir o toque.
  const frase = await pg.evaluate(() => ondeDe(['playlist', 'imports', 'favs'], 'para'));
  checar(/playlist/.test(frase) && /Cronograma/.test(frase) && /favoritos/.test(frase),
    'o aviso nomeia os três destinos');
  checar(/ e /.test(frase), 'e os junta como se fala ("… e …"), não como lista de código');

  // ---- A UNIÃO: o marcado + a linha tocada ----
  const uniao = await pg.evaluate(() => {
    destMarcados.clear();
    destMarcados.add('favoritos');
    return destUniao('cronograma');
  });
  checar(JSON.stringify(uniao) === JSON.stringify(['cronograma', 'favoritos']),
    'tocar numa linha leva junto o que já estava marcado');
  const ordem = await pg.evaluate(() => {
    destMarcados.clear();
    destMarcados.add('favoritos');
    destMarcados.add('playlist');
    return destUniao('cronograma');
  });
  checar(JSON.stringify(ordem) === JSON.stringify(['playlist', 'cronograma', 'favoritos']),
    'e a ordem é a da tabela, não a ordem em que o operador marcou');
  const comTocar = await pg.evaluate(() => {
    destMarcados.clear();
    destMarcados.add('cronograma');
    return destUniao('tocar');
  });
  checar(JSON.stringify(comTocar) === JSON.stringify(['cronograma', 'tocar']),
    '"Tocar agora" honra o que está marcado (projeta E guarda), com o telão por último');
  await pg.evaluate(() => destLimpar());

  // ---- A FOLHA, operada de verdade ----
  // Daqui em diante o teste toca nos elementos como o operador tocaria: é o
  // único jeito de pegar o `stopPropagation` da caixa e o `destUniao` lido
  // tarde demais, que são defeitos do DOM, não da lógica.
  await pg.evaluate(() => {
    // A folha do YouTube não precisa de rede para ser MONTADA — só a ação
    // precisa. `openYtMenu` com um resultado de mentira dá as quatro linhas
    // (tocar + os três destinos) numa tela só.
    openYtMenu({ id: 'zzzzzzzzzzz', url: 'https://youtu.be/zzzzzzzzzzz', name: 'Vídeo de teste' });
  });
  await pg.waitForSelector('#songMenuPopup.open', { timeout: 5000 });
  const caixas = await pg.$$eval('#songMenuList .song-menu-check', (els) => els.length);
  checar(caixas === 3, 'a folha do YouTube tem uma caixa por DESTINO — e nenhuma no "Tocar agora"');

  // Marcar NÃO fecha a folha: se a caixa deixasse o clique borbulhar, o botão
  // da linha executaria e a folha fecharia no primeiro toque.
  await pg.evaluate(() => document.querySelectorAll('#songMenuList .song-menu-check')[0].click());
  const aberta = await pg.$eval('#songMenuPopup', (el) => el.classList.contains('open'));
  checar(aberta, 'marcar uma caixa NÃO dispara a ação da linha (a folha continua aberta)');
  const marcado = await pg.evaluate(() => [...destMarcados]);
  checar(marcado.length === 1 && marcado[0] === 'playlist', 'e o destino marcado é o da linha em que se tocou');
  const pintou = await pg.$eval('#songMenuList .song-menu-check', (el) => el.classList.contains('on'));
  checar(pintou, 'e a caixa mostra que está marcada');

  // Com algo marcado aparece a linha de confirmação — a saída para quando já
  // não sobrou linha a tocar (todos os destinos desejados marcados).
  const temGo = await pg.$$eval('#songMenuList .song-menu-go', (els) => els.length);
  checar(temGo === 1, 'e a linha de confirmação aparece');

  // Fechar a folha ZERA o conjunto: uma marcação que atravessasse itens
  // mandaria para os Favoritos, sem aviso, o vídeo seguinte.
  await pg.evaluate(() => closeSongMenu());
  const zerou = await pg.evaluate(() => destMarcados.size);
  checar(zerou === 0, 'fechar a folha zera as marcações (elas são da folha, não do item)');

  // ---- A folha do ACERVO passa pelo mesmo caminho ----
  const alvos = await pg.evaluate(async () => {
    // O executor é substituído para capturar o que a folha ENTREGA: rodar o
    // verdadeiro exigiria baixar a música do LouvorJA, e o que se verifica aqui
    // é o transporte da escolha até a ação — o ponto em que ela se perdia.
    const coll = { id: 'teste', name: 'Coleção' };
    const s = { id_music: 1, name: 'Hino', has_instrumental_music: false };
    openSongMenu(coll, s, 'add');
    document.querySelectorAll('#songMenuList .song-menu-check')[2].click();  // Favoritos
    let capturado = null;
    const original = window.addSongToDestinos;
    window.addSongToDestinos = (c, m, v, destinos) => { capturado = destinos; };
    // A LINHA do Cronograma (a segunda das três com caixa), pelo corpo do botão.
    const linhas = [...document.querySelectorAll('#songMenuList .song-menu-btn')]
      .filter((b) => b.querySelector('.song-menu-check'));
    linhas[1].click();
    window.addSongToDestinos = original;
    return capturado;
  });
  checar(JSON.stringify(alvos) === JSON.stringify(['cronograma', 'favoritos']),
    'no acervo, a ação recebe a união MESMO rodando depois de a folha fechar');

  checar(await pg.$eval('#songMenuPopup', (el) => !el.classList.contains('open')),
    'e o toque na linha fecha a folha, como sempre fez');

  // ---- A SELEÇÃO MÚLTIPLA SOBREVIVE AO DESTINO ----
  // Os três botões da barra (playlist, favoritos, pasta) já eram destinos lado a
  // lado; o que os separava era a barra sumindo no primeiro toque. Mandar cinco
  // louvores para a playlist E para os Favoritos exigia selecioná-los duas vezes.
  const selecao = await pg.evaluate(async (id) => {
    enterSelection(id);
    await favoritarSelecionados();
    await new Promise((r) => setTimeout(r, 500));   // além do PULSO_MS
    const vivo = selectionMode && selected.has(id);
    exitSelection();
    return { vivo, saiu: !selectionMode };
  }, idMidia);
  checar(selecao.vivo, 'mandar a seleção a um destino NÃO a encerra (dá para mandar a outro)');
  checar(selecao.saiu, 'e o ✕ / voltar continua encerrando-a');

  // ---- A MESMA FOLHA COMO PERGUNTA (importação e compartilhamento) ----
  // O SIMPLIFICADO não pergunta, e é a resposta certa: ali não existe
  // Cronograma nem playlist, e uma folha com destinos que a tela não tem seria
  // pior que folha nenhuma (a mesma regra do link compartilhado naquele modo).
  const noSimples = await pg.evaluate(async () => {
    setAppMode('simple');
    const r = await escolherDestinos('Importar', ['cronograma']);
    setAppMode('full');
    return r;
  });
  checar(noSimples === null, 'no modo simplificado a pergunta nem chega a ser feita');

  // Aqui não há ação por trás da linha: a folha É a pergunta, e a resposta é a
  // promessa que ela resolve. Fechar sem responder não pode deixá-la pendente
  // para sempre — seria um share que nunca chega à lista.
  const escolhido = await pg.evaluate(async () => {
    const p = escolherDestinos('Importar', ['cronograma']);
    await new Promise((r) => setTimeout(r, 50));
    // A linha dos Favoritos, pelo CORPO dela: nesta folha a linha inteira marca.
    const linhas = [...document.querySelectorAll('#songMenuList .song-menu-btn')];
    linhas[2].click();
    await new Promise((r) => setTimeout(r, 50));
    document.querySelector('#songMenuList .song-menu-go').click();
    return p;
  });
  checar(JSON.stringify(escolhido) === JSON.stringify(['cronograma', 'favoritos']),
    'a pergunta da importação abre com o Cronograma marcado e aceita um segundo destino');
  const desistiu = await pg.evaluate(async () => {
    const p = escolherDestinos('Importar', ['cronograma']);
    await new Promise((r) => setTimeout(r, 50));
    closeSongMenu();   // o ✕, o toque no fundo e o voltar do aparelho caem todos aqui
    return p;
  });
  checar(desistiu === null, 'e desistir resolve em vez de deixar a importação pendurada');

  // ---- O SOM DA PREVIEW SOME COM TELÃO CONECTADO ----
  // Ligar o som da preview com o telão projetando faz o `<video>` do Controle
  // tomar o foco de áudio do Android e INTERROMPER o player do telão. O botão só
  // faz sentido quando o celular é a caixa de som — isto é, sem telão.
  const som = await pg.evaluate(() => {
    // No navegador o "telão" é a janela do Display; um objeto com `closed:false`
    // é exatamente o que `telaoConectado()` lê dela.
    webDisplayWin = null;
    pushTelaoNoSom();
    const semTelao = !pvSoundBtn.hidden;
    setStandalone(true);
    const ligouSemTelao = standalone;
    webDisplayWin = { closed: false };
    pushTelaoNoSom();
    return { semTelao, ligouSemTelao, comTelao: pvSoundBtn.hidden, desligou: !standalone };
  });
  checar(som.semTelao, 'sem telão, o botão da mesa de som está na preview');
  checar(som.ligouSemTelao, 'e ele liga o som local, como sempre');
  checar(som.comTelao, 'com telão conectado ele SOME — o som da preview cortaria o player do telão');
  checar(som.desligou, 'e conectar a tela com o som já ligado DESLIGA o som, em vez de deixá-lo sem controle');
  await pg.evaluate(() => { webDisplayWin = null; pushTelaoNoSom(); });
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
