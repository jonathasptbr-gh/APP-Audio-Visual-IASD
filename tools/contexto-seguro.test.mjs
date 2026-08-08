// O CONTEXTO SEGURO — a premissa em que o cliente do espelho de pixels se apoia.
//
// ## O que este teste trava
//
// O espelho de pixels serve o telão para os navegadores da rede local por
// **HTTP em claro** (`http://192.168.0.42:8787`), e isso não é provisório: a
// rede da igreja pode não ter internet num domingo, e todo caminho que dependa
// de um certificado válido — página, sinalização, ou até só o DNS de um nome —
// morre nesse dia de um jeito indistinguível de AP isolation. Ver
// docs/ESPELHO-DE-PIXELS.md §1.4: *"HTTP em claro na LAN é o transporte de
// produção. O site HTTPS é PLACA DE RUA, nunca cano. TLS é um degrau que se
// liga quando existe certificado — nunca o chão."*
//
// A consequência é uma classe inteira de APIs que **simplesmente não existe**
// na página do cliente: tudo que a IDL marca `[SecureContext]` vem `undefined`
// em `http://` para um host que não seja `localhost`. E o modo de falhar é o
// pior possível — `crypto.randomUUID is not a function` num navegador que a
// congregação está usando, num domingo, enquanto no celular do desenvolvedor
// (`https://appassets.androidplatform.net/`, invariante 1) tudo funciona.
//
// Daí a disciplina, que é a mesma do `if (!window.__NATIVE__)`: API de
// contexto seguro entra como
//
//     if (isSecureContext && 'X' in Y) { …o melhor… } else { …o piso… }
//
// **nunca como caminho principal**. Este arquivo varre `assets/web/espelho/`
// atrás de quem esqueceu a guarda.
//
// ## Por que ele também testa a si mesmo
//
// `assets/web/espelho/` nasce no P2 e só fica povoada no P5/P6. Um varredor de
// pasta vazia é verde por vácuo — e um verde por vácuo é indistinguível de um
// varredor quebrado, que é exatamente o que ninguém descobriria. Então o
// oráculo roda antes contra AMOSTRAS escritas aqui, com o veredito esperado ao
// lado de cada uma: se ele parar de acusar o que tem de acusar, a falha
// aparece hoje, não no dia em que a pasta encher.
//
//   node tools/contexto-seguro.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ALVO = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web', 'espelho');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

// ---------------------------------------------------------------------------
// A PREMISSA, escrita como tabela: o que NÃO existe em `http://`, e com o que
// se vive sem ele. Cada linha é uma decisão já tomada no documento — o piso
// não é "degradar", é o caminho que o recurso usa de verdade.
// ---------------------------------------------------------------------------
const PROIBIDOS = [
  {
    nome: 'VideoDecoder',
    achar: /\bVideoDecoder\b/,
    porque: 'WebCodecs é [SecureContext]; e mesmo com TLS está descartado — ele desenha num '
      + '<canvas>, e canvas NÃO segura a tela acesa (§3.10)',
    piso: 'MediaSource',
  },
  {
    nome: 'wakeLock',
    achar: /\bwakeLock\b/,
    porque: 'Screen Wake Lock é [SecureContext]. Entra como cinto e suspensório quando houver '
      + 'TLS, nunca como o único cinto',
    // O wake lock do vídeo do Chromium não pede permissão nem contexto seguro:
    // basta um <video> tocando, com vídeo, cobrindo a tela. É por isso que a
    // Entrega 2 (modo VÍDEO) segura a tela acesa e a Entrega 1 (modo IMAGEM,
    // <img>/<canvas> — nenhum é HTMLMediaElement) não segura.
    piso: 'o wake lock do <video> tocando',
  },
  {
    nome: 'audioWorklet',
    achar: /audioworklet/i,
    porque: 'AudioWorklet é [SecureContext] no CLIENTE. Ele existe dentro do WebView do espelho '
      + '(que é https://appassets.androidplatform.net/) — e é lá que ele é usado, §3.9',
    piso: 'a 2ª SourceBuffer com AAC',
  },
  {
    nome: 'randomUUID',
    achar: /\brandomUUID\b/,
    porque: 'crypto.randomUUID() é [SecureContext] na IDL do WebCrypto — a armadilha mais '
      + 'concreta da lista, porque parece uma função utilitária inofensiva',
    piso: 'crypto.getRandomValues',
  },
  {
    nome: 'crypto.subtle',
    achar: /\bcrypto\s*\.\s*subtle\b/,
    porque: 'SubtleCrypto é [SecureContext]. A comparação em tempo constante do pareamento é '
      + 'aritmética, não criptografia de navegador (§5.4)',
    piso: 'crypto.getRandomValues',
  },
];

// O que SOBREVIVE ao `http://`, e por isso pode ser piso. `getRandomValues`
// não é gated (só o `randomUUID` da mesma interface é), `MediaSource` nunca
// foi, e o wake lock do <video> é do compositor, não de uma API pedida.
const DISPONIVEIS = ['crypto.getRandomValues', 'MediaSource', 'the wake lock do <video> tocando'];

console.log('— a premissa é coerente consigo mesma ————————————————————————————');
// Um piso que também sumisse em `http://` não seria piso nenhum: seria o mesmo
// defeito com outro nome. Esta asserção é barata e impede que a tabela acima
// envelheça para dentro.
for (const p of PROIBIDOS) {
  const pisoTambemProibido = PROIBIDOS.some((q) => q.achar.test(p.piso));
  checar(!pisoTambemProibido && p.porque.length > 20,
    'o piso de `' + p.nome + '` (' + p.piso + ') existe sem contexto seguro, e o motivo está escrito');
}
checar(DISPONIVEIS.every((d) => !PROIBIDOS.some((q) => q.achar.test(d))),
  'e nenhuma das APIs listadas como disponíveis está na lista de proibidas');

// ---------------------------------------------------------------------------
// O VARREDOR
// ---------------------------------------------------------------------------

// Comentários, strings, templates e regex viram ESPAÇO — preservando as
// quebras de linha (para o número da linha continuar valendo) e as chaves de
// fora. Sem isso, um comentário que EXPLICA a regra ("randomUUID não existe em
// http://") seria acusado por ela, e o teste viraria ruído no primeiro dia.
function limpar(src) {
  let fora = '';
  let i = 0;
  let anterior = ''; // último caractere significativo — decide se `/` abre regex
  const branco = (c) => (c === '\n' ? '\n' : ' ');
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') { fora += ' '; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      fora += '  '; i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { fora += branco(src[i]); i++; }
      fora += '  '; i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      fora += ' '; i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { fora += ' '; i++; if (i < src.length) { fora += branco(src[i]); i++; } continue; }
        fora += branco(src[i]); i++;
      }
      fora += ' '; i++; anterior = 'x';
      continue;
    }
    // Regex literal. A heurística é a clássica: um `/` só abre expressão
    // regular depois de um caractere que não pode terminar um valor. Ela
    // existe porque um `/\{|'/` cru desalinharia o contador de chaves e o
    // scanner de aspas — e um regex NOMEANDO a API (num teste, num filtro) não
    // é uma chamada a ela.
    if (c === '/' && (anterior === '' || '(,=:[!&|?{};+-*%~^<>'.includes(anterior))) {
      fora += ' '; i++;
      let classe = false;
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === '\\') { fora += '  '; i += 2; continue; }
        if (src[i] === '[') classe = true;
        else if (src[i] === ']') classe = false;
        else if (src[i] === '/' && !classe) { fora += ' '; i++; break; }
        fora += ' '; i++;
      }
      anterior = 'x';
      continue;
    }
    fora += c;
    if (!/\s/.test(c)) anterior = c;
    i++;
  }
  return fora;
}

// A guarda vale para O BLOCO QUE ELA ABRE, e a conta é de chaves.
//
// Duas consequências que precisam estar escritas, porque as duas são
// deliberadas:
//
//  - `if (isSecureContext && …) { melhor } else { piso }` — o `}` antes do
//    `else` fecha a guarda, então o ramo do PISO é território desprotegido.
//    É exatamente o que se quer: o piso que usasse a API gated seria o defeito
//    inteiro, com um `if` decorativo em volta.
//  - a granularidade é a LINHA. Uma guarda e uma chamada espremidas na mesma
//    linha passam (é o caso do ternário, que é idioma legítimo aqui).
function varrer(src) {
  const linhas = limpar(src).split('\n');
  const achados = [];
  let profundidade = 0;
  const guardas = []; // profundidades em que uma guarda abriu bloco
  for (let n = 0; n < linhas.length; n++) {
    const linha = linhas[n];
    const guardaAqui = /\bisSecureContext\b/.test(linha);
    const protegida = guardaAqui || guardas.length > 0;
    if (!protegida) {
      for (const p of PROIBIDOS) {
        if (p.achar.test(linha)) achados.push({ linha: n + 1, nome: p.nome, texto: linha.trim() });
      }
    }
    const antes = profundidade;
    for (const ch of linha) {
      if (ch === '{') profundidade++;
      else if (ch === '}') {
        profundidade--;
        while (guardas.length && profundidade <= guardas[guardas.length - 1]) guardas.pop();
      }
    }
    if (guardaAqui && profundidade > antes) guardas.push(antes);
  }
  return achados;
}

// ---------------------------------------------------------------------------
// O AUTO-TESTE do varredor — o que impede o verde por vácuo.
// ---------------------------------------------------------------------------
console.log('\n— o varredor acusa o que tem de acusar ———————————————————————————');

const AMOSTRAS = [
  {
    nome: 'guarda canônica: o melhor guardado, o piso do lado de fora',
    fonte: `
      if (isSecureContext && 'wakeLock' in navigator) {
        trava = await navigator.wakeLock.request('screen');
      } else {
        // o piso: o wake lock do <video> tocando, que não pede nada
        video.play();
      }`,
    esperado: [],
  },
  {
    nome: 'ternário na mesma linha (idioma legítimo)',
    fonte: "const id = isSecureContext ? crypto.randomUUID() : hex(crypto.getRandomValues(new Uint8Array(16)));",
    esperado: [],
  },
  {
    nome: 'comentário, string e regex NOMEANDO a API não são chamadas a ela',
    fonte: `
      // randomUUID não existe em http:// — use getRandomValues
      const aviso = 'crypto.subtle indisponível sem TLS';
      const re = /randomUUID|wakeLock/;`,
    esperado: [],
  },
  {
    nome: 'chamada nua: é o defeito que este arquivo existe para pegar',
    fonte: 'const id = crypto.randomUUID();',
    esperado: ['randomUUID'],
  },
  {
    nome: 'guarda que não guarda: a API usada no ramo do PISO',
    fonte: `
      if (isSecureContext && 'wakeLock' in navigator) {
        trava = await navigator.wakeLock.request('screen');
      } else {
        trava = await navigator.wakeLock.request('screen');
      }`,
    esperado: ['wakeLock'],
  },
  {
    nome: 'DEPOIS do bloco guardado a proteção acaba',
    fonte: `
      if (isSecureContext) {
        const d = new VideoDecoder(cfg);
      }
      const outro = new VideoDecoder(cfg);`,
    esperado: ['VideoDecoder'],
  },
  {
    // Duas LINHAS de propósito: o varredor acusa uma vez por API por linha, e
    // o que se quer provar aqui são as duas grafias — o método (`audioWorklet`)
    // e o construtor (`AudioWorkletNode`), que é onde a caixa alta engana quem
    // procurar só a primeira.
    nome: 'AudioWorklet no cliente, nas duas grafias',
    fonte: `
      await ctx.audioWorklet.addModule('pcm.js');
      const no = new AudioWorkletNode(ctx, 'pcm');`,
    esperado: ['audioWorklet', 'audioWorklet'],
  },
];

for (const a of AMOSTRAS) {
  const achados = varrer(a.fonte).map((x) => x.nome);
  const bateu = achados.length === a.esperado.length && achados.every((x, k) => x === a.esperado[k]);
  checar(bateu, a.nome, JSON.stringify(achados) + ' ≠ ' + JSON.stringify(a.esperado));
}

// ---------------------------------------------------------------------------
// A VARREDURA DE VERDADE
// ---------------------------------------------------------------------------
console.log('\n— assets/web/espelho/ ————————————————————————————————————————————');

function arquivos(dir) {
  const saida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivos(p));
    else if (/\.(js|mjs|html)$/.test(e.name)) saida.push(p);
  }
  return saida;
}

if (!fs.existsSync(ALVO)) {
  // Não é falha. A pasta nasce no P2 e só fica povoada no P5/P6, e este
  // arquivo é do P3: durante essa janela ele roda com a pasta ausente, e a
  // ordem entre os passos não pode virar um vermelho. O que garante que ele
  // não é um verde VAZIO nessa janela é o auto-teste acima, que roda sempre.
  console.log('    (a pasta ainda não existe — o oráculo acima já roda; a varredura entra com o P2)');
} else {
  const lista = arquivos(ALVO);
  checar(lista.length > 0, 'há arquivos para varrer em assets/web/espelho/');
  for (const arq of lista) {
    const achados = varrer(fs.readFileSync(arq, 'utf8'));
    const rel = path.relative(path.join(AQUI, '..'), arq);
    checar(achados.length === 0,
      rel + ': nenhuma API de contexto seguro fora de guarda',
      achados.map((a) => a.nome + ' (linha ' + a.linha + '): ' + a.texto).join(' · '));
  }
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
