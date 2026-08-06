// Testa o parser de `sidx` de `shared/mse.js` — o índice DASH que a
// transmissão direta usa para mapear tempo → posição no arquivo.
//
// Ele existe porque um erro de deslocamento aqui NÃO dá erro: dá vídeo que não
// toca, no telão, no meio de um culto. E é a única peça daquele arquivo que dá
// para verificar sem aparelho: os boxes são construídos aqui, byte a byte, a
// partir da especificação (ISO/IEC 14496-12).
//
//   node tools/sidx.test.mjs
import fs from 'fs';
// carrega o módulo com um `window` falso
const src = fs.readFileSync(new URL('../app/src/main/assets/web/shared/mse.js', import.meta.url),'utf8');
const window = { MediaSource: undefined };
new Function('window', src)(window);
const { lerSidx } = window.AVStream;

// --- constrói um sidx sintético ---
function build({ version, timescale, firstOffset, entries, prefixStyp }) {
  const n = entries.length;
  const hdr = 12 + 8 + (version === 0 ? 8 : 16) + 4;
  const size = hdr + n * 12;
  const pre = prefixStyp ? 16 : 0;
  const b = Buffer.alloc(pre + size);
  let o = 0;
  if (prefixStyp) {
    b.writeUInt32BE(16, 0); b.write('styp', 4); o = 16;
  }
  b.writeUInt32BE(size, o);
  b.write('sidx', o + 4);
  b.writeUInt8(version, o + 8);           // version
  b.writeUInt32BE(1, o + 12);             // reference_ID
  b.writeUInt32BE(timescale, o + 16);     // timescale
  let q;
  if (version === 0) {
    b.writeUInt32BE(0, o + 20);           // EPT
    b.writeUInt32BE(firstOffset, o + 24); // first_offset
    q = o + 28;
  } else {
    b.writeUInt32BE(0, o + 20); b.writeUInt32BE(0, o + 24);            // EPT 64
    b.writeUInt32BE(0, o + 28); b.writeUInt32BE(firstOffset, o + 32);  // first_offset 64
    q = o + 36;
  }
  b.writeUInt16BE(0, q); q += 2;          // reserved
  b.writeUInt16BE(n, q); q += 2;          // reference_count
  for (const e of entries) {
    b.writeUInt32BE(((e.ref ? 0x80000000 : 0) | e.size) >>> 0, q);
    b.writeUInt32BE(e.dur, q + 4);
    b.writeUInt32BE(0, q + 8);
    q += 12;
  }
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

let falhas = 0;
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) { console.log('FALHOU  ' + msg + '\n  obtido:  ' + ja + '\n  esperado:' + jb); falhas++; }
  else console.log('ok      ' + msg);
}

const TS = 90000, INIDX = 1000;  // indexEnd+1

// 1) v0, três segmentos de 2s
eq(lerSidx(build({version:0,timescale:TS,firstOffset:0,entries:[
  {size:5000,dur:2*TS},{size:6000,dur:2*TS},{size:4000,dur:1*TS}]}), INIDX),
  [{ini:1000,fim:5999,t0:0,dur:2},{ini:6000,fim:11999,t0:2,dur:2},{ini:12000,fim:15999,t0:4,dur:1}],
  'v0: posições e tempos encadeiam');

// 2) v1 (campos de 64 bits) deve dar o MESMO resultado
eq(lerSidx(build({version:1,timescale:TS,firstOffset:0,entries:[
  {size:5000,dur:2*TS},{size:6000,dur:2*TS},{size:4000,dur:1*TS}]}), INIDX),
  lerSidx(build({version:0,timescale:TS,firstOffset:0,entries:[
  {size:5000,dur:2*TS},{size:6000,dur:2*TS},{size:4000,dur:1*TS}]}), INIDX),
  'v1 (64 bits) == v0');

// 3) first_offset desloca o primeiro segmento
eq(lerSidx(build({version:0,timescale:TS,firstOffset:48,entries:[{size:100,dur:TS}]}), INIDX)[0],
  {ini:1048,fim:1147,t0:0,dur:1}, 'first_offset desloca o início');

// 4) um styp na frente não desloca a leitura
eq(lerSidx(build({version:0,timescale:TS,firstOffset:0,prefixStyp:true,entries:[{size:100,dur:TS}]}), INIDX),
  [{ini:1000,fim:1099,t0:0,dur:1}], 'box anterior (styp) é pulado');

// 5) o bit de reference_type não vira tamanho gigante
eq(lerSidx(build({version:0,timescale:TS,firstOffset:0,entries:[{size:100,dur:TS,ref:true}]}), INIDX)[0].fim,
  1099, 'bit alto de referenced_size é mascarado');

// 6) lixo devolve null em vez de estourar
eq(lerSidx(new Uint8Array([1,2,3]).buffer, 0), null, 'buffer curto → null');
eq(lerSidx(new Uint8Array(64).buffer, 0), null, 'sem box sidx → null');

// 7) timescale 0 não vira divisão por zero
eq(lerSidx(build({version:0,timescale:0,firstOffset:0,entries:[{size:100,dur:1}]}), 0), null, 'timescale 0 → null');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas ? 1 : 0);
