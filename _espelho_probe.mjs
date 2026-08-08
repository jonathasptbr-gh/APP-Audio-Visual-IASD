// Prova de bancada do grafo de áudio do espelho, sem aparelho: finge o papel
// `espelho` e o objeto `__avEspelhoAudio` do Kotlin, e observa o que sai.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.join(process.cwd(), 'app/src/main/assets/web');
const T = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
const s = http.createServer((req,res)=>{ let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p.endsWith('/'))p+='index.html'; const f=path.join(RAIZ,p); if(!f.startsWith(RAIZ)||!fs.existsSync(f)){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res); });
await new Promise(r=>s.listen(0,r));
const base='http://127.0.0.1:'+s.address().port;

const b = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await b.newContext({ viewport: { width: 961, height: 540 } });
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('  EXCECAO:', e.message));
pg.on('console', m => { if (m.type()==='error') console.log('  console:', m.text()); });

const modo = process.argv[2] || 'ok';   // ok | recusa | ausente

await pg.addInitScript((modo) => {
  window.__AV_ROLE__ = 'espelho';
  window.__espiao = { config: null, blocos: [], bytes: 0 };
  if (modo === 'ausente') return;       // o canal nunca aparece
  const ouvintes = [];
  window.__avEspelhoAudio = {
    postMessage(m) {
      if (typeof m === 'string') {
        window.__espiao.config = JSON.parse(m);
        const r = modo === 'recusa'
          ? JSON.stringify({ ok: false, erro: 'encoder AAC nao subiu' })
          : JSON.stringify({ ok: true, sr: window.__espiao.config.sr, ch: window.__espiao.config.ch });
        setTimeout(() => ouvintes.forEach(f => f({ data: r })), 5);
        return;
      }
      window.__espiao.blocos.push(m.byteLength);
      window.__espiao.bytes += m.byteLength;
    },
    addEventListener(t, f) { if (t === 'message') ouvintes.push(f); },
    removeEventListener(t, f) { const i = ouvintes.indexOf(f); if (i >= 0) ouvintes.splice(i, 1); },
  };
}, modo);

await pg.goto(base + '/display/');
await pg.waitForFunction(() => !!window.AVDB, null, { timeout: 15000 }).catch(()=>{});
await pg.waitForTimeout(1200);

// Um WAV de 3 s, 48 kHz estéreo, senoide — o "áudio do palco".
await pg.evaluate(() => {
  const sr = 48000, seg = 3, n = sr * seg, ch = 2;
  const bytes = 44 + n * ch * 2;
  const dv = new DataView(new ArrayBuffer(bytes));
  const asc = (o, str) => { for (let i=0;i<str.length;i++) dv.setUint8(o+i, str.charCodeAt(i)); };
  asc(0,'RIFF'); dv.setUint32(4, bytes-8, true); asc(8,'WAVEfmt ');
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,ch,true);
  dv.setUint32(24,sr,true); dv.setUint32(28,sr*ch*2,true); dv.setUint16(32,ch*2,true); dv.setUint16(34,16,true);
  asc(36,'data'); dv.setUint32(40, n*ch*2, true);
  for (let i=0;i<n;i++) { const v = Math.round(Math.sin(2*Math.PI*440*i/sr)*20000);
    dv.setInt16(44+(i*ch)*2, v, true); dv.setInt16(44+(i*ch+1)*2, v, true); }
  const blob = new Blob([dv.buffer], { type: 'audio/wav' });
  const v = document.getElementById('video');
  v.src = URL.createObjectURL(blob);
  v.play().catch(e => console.log('play falhou', e.message));
});
await pg.waitForTimeout(2500);

const r = await pg.evaluate(() => {
  const v = document.getElementById('video');
  const d = (window.__avDiag && window.__avDiag()) || null;
  return {
    modo: window.__AV_ROLE__,
    config: window.__espiao.config,
    nBlocos: window.__espiao.blocos.length,
    tamanhos: [...new Set(window.__espiao.blocos)],
    bytes: window.__espiao.bytes,
    videoMuted: v.muted, videoVolume: v.volume, tocando: !v.paused, tempo: v.currentTime,
  };
});
console.log('MODO=' + modo, JSON.stringify(r, null, 1));
await b.close(); s.close();
