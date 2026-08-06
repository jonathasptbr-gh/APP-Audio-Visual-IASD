// O CONTRATO DO `shouldInterceptRequest` — o defeito que custou três rodadas.
//
// ## O que este teste trava
//
// Num WebView, o `InputStream` devolvido por `shouldInterceptRequest` NÃO é "a
// resposta"; ele é lido como o RECURSO INTEIRO a partir do byte 0. Quem aplica
// o `Range` da requisição é o próprio Chromium, sobre o que o app entregou:
//
//   AndroidStreamReaderURLLoader::Start          → ParseRange(request.headers)
//   AndroidStreamReaderURLLoader::OnInputStreamOpened → InputStreamReader::Seek
//   InputStreamReader::Seek                      → VerifyRequestedRange + SkipToRequestedRange
//   net::HttpByteRange::ComputeBounds            → confere contra available()
//
// Devolver só a fatia pedida (o que o `StreamProxy` fazia até a v1.54) aplica o
// deslocamento DUAS vezes. E o mais cruel: a requisição que começa no byte 0 —
// o segmento de inicialização, sempre o primeiro — é a única em que pular é um
// no-op, então ela passa e esconde o defeito atrás dela.
//
// ## Por que um ORÁCULO transcrito, e não um teste de aparelho
//
// Porque a camada que falha só existe dentro do WebView: `tools/mse.test.mjs`
// roda num Chromium de mesa, onde `shouldInterceptRequest` não existe e um
// corpo que não corresponde ao `Range` pedido é aceito sem reclamar. Foi por
// isso que a suíte ficou verde com a transmissão quebrada desde a v5.120.
//
// A transcrição abaixo é a hipótese ficando EXPLÍCITA e versionada: se um dia o
// Chromium mudar essa regra, o lugar de descobrir isso é o CI, não o culto.
//
//   node tools/webview-range.test.mjs

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

// ---------------------------------------------------------------------------
// O ORÁCULO — transcrição do Chromium, com a origem de cada regra.
// ---------------------------------------------------------------------------

// net/http/http_byte_range.cc — HttpByteRange::ComputeBounds.
// Devolve os limites resolvidos, ou `null` quando a faixa é inatendível.
function computeBounds(faixa, tamanho) {
  if (tamanho < 0) return null;
  // "Empty values": requisição SEM cabeçalho Range. É o caminho da correção —
  // não há o que resolver, e o recurso inteiro é entregue.
  if (!faixa || (faixa.primeiro == null && faixa.ultimo == null)) {
    return { primeiro: 0, ultimo: tamanho - 1 };
  }
  if (tamanho === 0) return null;                       // corpo vazio + Range = inatendível
  if (faixa.primeiro != null && faixa.primeiro >= tamanho) return null;   // ← a falha observada
  const ultimo = (faixa.ultimo == null || faixa.ultimo >= tamanho) ? tamanho - 1 : faixa.ultimo;
  if (ultimo < (faixa.primeiro || 0)) return null;
  return { primeiro: faixa.primeiro || 0, ultimo };
}

// components/embedder_support/android/util/input_stream_reader.cc
// InputStreamReader::Seek = VerifyRequestedRange + SkipToRequestedRange.
// O erro é sempre devolvido ANTES de qualquer cabeçalho ser montado — daí o
// lado web ver um erro de rede SEM STATUS (`TypeError: Failed to fetch`) em vez
// de um HTTP legível.
function seek(stream, faixa) {
  const disponivel = stream.available();
  const b = computeBounds(faixa, disponivel);
  if (!b) return { erro: 'ERR_REQUEST_RANGE_NOT_SATISFIABLE' };
  // `first_byte_position() > 0` — literalmente a assimetria init/índice.
  if (b.primeiro > 0) {
    const pulado = stream.skip(b.primeiro);
    if (pulado !== b.primeiro) return { erro: 'ERR_FAILED (skip curto: ' + pulado + ')' };
  }
  return { tamanho: b.ultimo - b.primeiro + 1 };
}

// O que o renderer recebe: ou um erro de rede, ou os bytes lidos do stream.
function servir(stream, faixa) {
  const s = seek(stream, faixa);
  if (s.erro) return { erro: s.erro };
  const buf = Buffer.alloc(s.tamanho);
  let n = 0;
  while (n < s.tamanho) {
    const lido = stream.read(buf, n, s.tamanho - n);
    if (lido <= 0) break;
    n += lido;
  }
  return { corpo: buf.subarray(0, n) };
}

// ---------------------------------------------------------------------------
// OS DOIS MODELOS DE STREAM que o proxy pode devolver.
// ---------------------------------------------------------------------------

// Como era até a v1.54: um ByteArrayInputStream sobre a FATIA.
function fatiaCrua(corpo) {
  let pos = 0;
  return {
    available: () => corpo.length - pos,
    skip(n) { const k = Math.min(n, corpo.length - pos); pos += k; return k; },
    read(b, off, len) {
      if (pos >= corpo.length) return -1;
      const k = Math.min(len, corpo.length - pos);
      corpo.copy(b, off, pos, pos + k); pos += k; return k;
    },
  };
}

// O ramo de compatibilidade (StreamProxy.FatiaComoTodo): a fatia se comporta
// como o recurso inteiro, absorvendo o primeiro `skip`.
function fatiaComoTodo(corpo, deslocamento) {
  let fantasma = Math.max(0, deslocamento);
  let pos = 0;
  return {
    available: () => Math.min(fantasma + (corpo.length - pos), 2147483647),
    skip(n) {
      if (n <= 0) return 0;
      if (fantasma > 0) { const k = Math.min(n, fantasma); fantasma -= k; return k; }
      const k = Math.min(n, corpo.length - pos); pos += k; return k;
    },
    read(b, off, len) {
      fantasma = 0;
      if (pos >= corpo.length) return -1;
      const k = Math.min(len, corpo.length - pos);
      corpo.copy(b, off, pos, pos + k); pos += k; return k;
    },
  };
}

// ---------------------------------------------------------------------------
// O RECURSO SINTÉTICO. O byte `i` vale `i % 251` — primo, de propósito: assim
// um deslocamento errado sai como BYTES ERRADOS e não como tamanho errado, que
// é o único jeito de um teste enxergar a corrupção silenciosa do ramo em que a
// requisição "dá certo" e o vídeo simplesmente não toca.
// ---------------------------------------------------------------------------
const RECURSO = Buffer.alloc(200 * 1024);
for (let i = 0; i < RECURSO.length; i++) RECURSO[i] = i % 251;

const fatiaDe = (a, b) => RECURSO.subarray(a, b + 1);
const faixaDe = (a, b) => ({ primeiro: a, ultimo: b });

// Os casos, com nomes do domínio: é assim que o player pede.
const CASOS = [
  ['init            ', 0, 739],          // A = 0 — o único que funcionava
  ['índice curto    ', 740, 1200],       // A ≥ tamanho da fatia → erro sem status
  ['índice longo    ', 740, 3000],       // A < tamanho da fatia → corrupção silenciosa
  ['fragmento raso  ', 4096, 20000],
  ['fragmento fundo ', 150000, 199999],
];

console.log('— hoje (fatia crua + cabeçalho Range): o defeito ————————————————');
for (const [nome, a, b] of CASOS) {
  const r = servir(fatiaCrua(Buffer.from(fatiaDe(a, b))), faixaDe(a, b));
  const certo = !r.erro && r.corpo.equals(fatiaDe(a, b));
  if (a === 0) {
    checar(certo, nome + '→ a faixa que começa em 0 passa (e é por isso que o defeito se escondia)');
  } else {
    checar(!certo, nome + '→ NÃO entrega os bytes certos (erro de rede ou bytes trocados)',
      r.erro || 'entregou ' + r.corpo.length + ' bytes, o primeiro = ' + r.corpo[0]);
  }
}

console.log('\n— o ramo de compatibilidade (FatiaComoTodo + cabeçalho Range) ————');
for (const [nome, a, b] of CASOS) {
  const r = servir(fatiaComoTodo(Buffer.from(fatiaDe(a, b)), a), faixaDe(a, b));
  checar(!r.erro && r.corpo.equals(fatiaDe(a, b)), nome + '→ bytes exatos',
    r.erro || 'entregou ' + r.corpo.length + ' bytes, o primeiro = ' + r.corpo[0]);
}

console.log('\n— a correção (faixa na URL, SEM cabeçalho Range) ————————————————');
for (const [nome, a, b] of CASOS) {
  // Sem cabeçalho não há faixa a parsear: nenhum seek acontece.
  const r = servir(fatiaCrua(Buffer.from(fatiaDe(a, b))), null);
  checar(!r.erro && r.corpo.equals(fatiaDe(a, b)), nome + '→ bytes exatos',
    r.erro || 'entregou ' + r.corpo.length + ' bytes, o primeiro = ' + r.corpo[0]);
}

console.log('\n— o canal de ERRO (uma resposta 4xx/5xx do proxy) ————————————————');
{
  // Corpo vazio + faixa fora do zero: `ComputeBounds` reprova com `size == 0` e
  // a mensagem some. Era assim que TODA a tabela de erros da v5.125 ficava
  // indeliverável para qualquer requisição que não fosse a primeira.
  const vazio = servir(fatiaCrua(Buffer.alloc(0)), faixaDe(740, 1200));
  checar(!!vazio.erro, 'corpo VAZIO com faixa fora do zero: o erro do proxy nunca chega (era o caso até a v1.54)');

  // Com motivo no corpo e o fantasma do deslocamento, a resposta atravessa.
  const motivo = Buffer.from('googlevideo: Forbidden', 'ascii');
  const comTexto = servir(fatiaComoTodo(motivo, 740), faixaDe(740, 1200));
  checar(!comTexto.erro && comTexto.corpo.toString('ascii') === 'googlevideo: Forbidden',
    'com motivo no corpo, o erro do proxy CHEGA ao lado web', comTexto.erro);

  // E sem cabeçalho nenhum (o caminho novo) ele chega sempre.
  const semFaixa = servir(fatiaCrua(motivo), null);
  checar(!semFaixa.erro && semFaixa.corpo.toString('ascii') === 'googlevideo: Forbidden',
    'sem cabeçalho Range, o erro do proxy chega sem depender de nada', semFaixa.erro);
}

console.log('\n— a regra, escrita como asserção ————————————————————————————————');
{
  // Um pedido de 1 byte no MEIO do arquivo é o caso mais puro: com a fatia crua
  // ele é sempre inatendível, sem exceção e sem status.
  const r = servir(fatiaCrua(Buffer.from(fatiaDe(100000, 100000))), faixaDe(100000, 100000));
  checar(!!r.erro, 'fatia crua: um byte no meio do arquivo é INATENDÍVEL', r.erro);
  const ok = servir(fatiaCrua(Buffer.from(fatiaDe(100000, 100000))), null);
  checar(!ok.erro && ok.corpo[0] === 100000 % 251, 'sem faixa no cabeçalho: o mesmo byte chega certo');
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
