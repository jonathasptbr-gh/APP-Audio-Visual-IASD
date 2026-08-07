// A conta da BIBLIOTECA: "esta coleção está completa?" e "quanto ela ocupa?".
//
// ## Por que ele existe
//
// As duas perguntas eram respondidas por contas diferentes em lugares
// diferentes da MESMA TELA, e as respostas divergiam:
//
//   - "completa" era `countDownloaded(id) >= collSongs(id).length` — uma conta
//     de MÚSICAS —, enquanto o download busca VARIANTES (Cantado + Playback) e
//     a barra de peso já media variantes. Um Playback faltando deixava o card
//     com o botão de baixar ao lado de um chip dizendo "Completo offline".
//   - uma música cuja ORIGEM não tem áudio nunca ganhava id de arquivo, então
//     a coleção nunca ficava completa: o botão de baixar não sumia mais, e cada
//     sincronização voltava a buscar o metadado dela para redescobrir que não
//     há o que baixar.
//   - o peso somava o CATÁLOGO, e as imagens de fundo da letra vão para a mesma
//     pasta sem virar registro: centenas de MB fora de toda conta.
//
// Nenhum desses é erro de sintaxe, e nenhum aparece num `node --check`. São
// contas — e conta errada é exatamente o que um teste prende.
//
//   node tools/acervo.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
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
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
const pg = await ctx.newPage();

try {
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 20000 },
  );

  // ---- "esta coleção está completa?" ----------------------------------------
  // As músicas entram direto no `collState`, que é a mesma estrutura que o
  // `fetchCollectionIndex` preenche — o teste exercita a conta, não a rede.
  const r = await pg.evaluate(() => {
    collState.tudo = { songs: [
      { id_music: 1, name: 'a', fileIdFull: 'fa' },
      { id_music: 2, name: 'b', fileIdFull: 'fb', has_instrumental_music: true, fileIdPlayback: 'pb' },
    ] };
    collState.semPb = { songs: [
      { id_music: 1, name: 'a', fileIdFull: 'fa' },
      // Playback declarado na origem e AINDA NÃO baixado: a conta de músicas
      // dizia "completa", a de variantes diz que falta uma.
      { id_music: 2, name: 'b', fileIdFull: 'fb', has_instrumental_music: true },
    ] };
    collState.semFonte = { songs: [
      { id_music: 1, name: 'a', fileIdFull: 'fa' },
      // A origem NÃO TEM o áudio desta. Ela nunca vai virar arquivo.
      { id_music: 2, name: 'b', semAudio: true },
    ] };
    collState.vazia = { songs: [] };
    const q = (id) => ({
      completa: colecaoCompleta(id), falta: faltamNaColecao(id),
      baixaveis: songsBaixaveis(id).length,
    });
    return { tudo: q('tudo'), semPb: q('semPb'), semFonte: q('semFonte'), vazia: q('vazia') };
  });

  checar(r.tudo.completa && r.tudo.falta === 0, 'tudo baixado (com o Playback): completa');
  checar(!r.semPb.completa && r.semPb.falta === 1,
    'Playback declarado e ausente: NÃO é completa — a conta é de VARIANTES, não de músicas',
    JSON.stringify(r.semPb));
  checar(r.semFonte.completa && r.semFonte.falta === 0,
    'música sem áudio na origem: completa mesmo assim — "não existe" ≠ "não baixei"',
    JSON.stringify(r.semFonte));
  checar(r.semFonte.baixaveis === 1,
    'e ela sai do DENOMINADOR: o contador chega ao fim em vez de travar em 1/2',
    r.semFonte.baixaveis);
  checar(!r.vazia.completa,
    'sem índice não é completa — o botão ali serve para buscar a lista');

  // ---- e a mesma pergunta para um GRUPO ------------------------------------
  // O botão do cabeçalho de categoria ("CDs do ano") era desenhado SEMPRE — a
  // regra da barra do card nunca chegou até ele. Tocá-lo percorria álbum por
  // álbum, cada um buscando o índice na rede e conferindo variante por
  // variante, para terminar em "completo" e deixar o mesmo botão ali.
  const gr = await pg.evaluate(() => ({
    todosCompletos: grupoCompleto([{ id: 'tudo' }, { id: 'semFonte' }]),
    umIncompleto: grupoCompleto([{ id: 'tudo' }, { id: 'semPb' }]),
    // Um álbum SEM ÍNDICE mantém o grupo incompleto: pela contagem de
    // pendentes ele soma zero (não tem lista), e era assim que "Baixar toda a
    // biblioteca" respondia "Já completo" sem fazer nada.
    umSemIndice: grupoCompleto([{ id: 'tudo' }, { id: 'vazia' }]),
    vazio: grupoCompleto([]),
  }));
  checar(gr.todosCompletos, 'grupo com todas as coleções completas: completo');
  checar(!gr.umIncompleto, 'uma coleção incompleta basta para o grupo não estar');
  checar(!gr.umSemIndice,
    'e um álbum SEM ÍNDICE também — "nada pendente" não é "já completo"');
  checar(!gr.vazio, 'grupo vazio não é completo');

  // ---- "quanto ela ocupa?" -------------------------------------------------
  // O caso inteiro num teste: um arquivo que NÃO é registro do catálogo (uma
  // imagem de fundo de letra) na mesma pasta de um que é.
  const peso = await pg.evaluate(async () => {
    const bin = (n) => new Blob([new Uint8Array(n)]);
    await AVDB.opfsWriteFile('folders/pesoTeste/1-full.mp3', bin(1000));
    await AVDB.opfsWriteFile('folders/pesoTeste/1-img-0.jpg', bin(500));
    return AVDB.opfsFolderSize('folders/pesoTeste');
  });
  checar(peso === 1500,
    'o peso mede o DISCO: a imagem de fundo da letra conta, mesmo sem registro no catálogo',
    peso);

  const semPasta = await pg.evaluate(() => AVDB.opfsFolderSize('folders/naoExiste'));
  checar(semPasta === 0, 'pasta inexistente: 0, sem estourar', semPasta);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
