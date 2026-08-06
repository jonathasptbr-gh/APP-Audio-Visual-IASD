// ============================================================================
// TRANSMISSÃO DIRETA — um player DASH mínimo sobre MediaSource (v5.120)
//
// ## O que ele resolve
//
// Um vídeo do YouTube tinha dois caminhos, e os dois cobravam caro:
//
// - **Baixar antes.** Centenas de MB de espera antes do primeiro quadro.
// - **O player embutido.** Ele traz a UI dele junto — a rodinha de
//   carregamento, o botão grande na pausa, a tela final —, e `controls: 0` não
//   desliga nada disso porque não são *controles*. Num telão de culto isso
//   aparece.
//
// Aqui o vídeo vira um `<video>` COMUM alimentado por `MediaSource`. Daí para a
// frente ele é mídia como qualquer outra do app: fade, cortina, `MediaSession`,
// barra de progresso, segundo plano — tudo o que já funciona, sem um pixel de
// YouTube no telão.
//
// ## Por que isto é nosso, contra a regra do projeto
//
// A regra diz para não reimplementar em casa o que uma biblioteca faz. Aqui não
// há alternativa aplicável: um player DASH de prateleira (dash.js, Shaka) é
// centenas de kB de terceiro para resolver um caso — duas faixas, um perfil,
// sem DRM, sem múltiplas qualidades, sem legenda. O que este arquivo faz é
// muito menos que um player DASH: **não** troca de qualidade, **não** lê MPD,
// **não** faz ABR. Ele lê um `sidx`, pede pedaços e os entrega ao navegador.
//
// O preço está declarado: isto é superfície NOSSA. Por isso cada ponto de falha
// avisa quem chamou (`onErro`), e quem chamou tem para onde cair — o download
// ou o player embutido continuam existindo, inteiros.
//
// ## O que ele NÃO faz
//
// Não busca as faixas (é o shell, com a mesma fila de candidatos do download) e
// não fala com o `googlevideo` (é o `StreamProxy`, no origin do app, com o UA
// que combina com a URL). Aqui só entram bytes que já chegaram.
// ============================================================================
(function (global) {
  'use strict';

  // Quantos segundos manter à frente do ponto tocado. Vinte cobre uma oscilação
  // de rede de igreja sem prender megabytes de um vídeo que o operador pode
  // trocar no segundo seguinte — e é o dobro do que um seek típico consome
  // antes de o pedido seguinte chegar.
  const ALVO_S = 20;
  // O compasso do abastecimento. `updateend` já dispara a maior parte dos
  // ciclos; este intervalo cobre o caso em que TUDO está satisfeito e nada mais
  // dispararia evento nenhum — sem ele, o player pararia de pedir ao encher o
  // buffer e só voltaria a acordar num seek.
  const TICK_MS = 400;
  // Quanto passado descartar quando o navegador reclamar de espaço. O MSE tem
  // cota, e num vídeo de 1080p ela é atingida antes do fim: descartar o que já
  // passou é o único jeito de continuar, e 30 s atrás do cursor é folga
  // suficiente para um retrocesso curto continuar instantâneo.
  const GUARDA_S = 30;

  function suportado(man) {
    if (!global.MediaSource || !man || !man.video || !man.audio) return false;
    try {
      return MediaSource.isTypeSupported(man.video.mime)
        && MediaSource.isTypeSupported(man.audio.mime);
    } catch (_) { return false; }
  }

  // --------------------------------------------------------------------------
  // O ÍNDICE (`sidx`) — o mapa de tempo → posição de cada fragmento.
  //
  // É ele que torna a coisa toda viável: com alguns kilobytes o player sabe
  // onde começa cada trecho do arquivo, e daí em diante pede só o que precisa.
  // Sem ele, "tocar aos 3:20" significaria baixar tudo até os 3:20.
  //
  // O formato é o do ISO/IEC 14496-12, e vale escrever o que cada campo é
  // porque um erro de deslocamento aqui não dá erro: dá vídeo que não toca.
  // --------------------------------------------------------------------------
  function lerSidx(buf, inicioDosDados) {
    const dv = new DataView(buf);
    // O box PROCURADO, e não assumido na posição 0: o `indexRange` do YouTube
    // costuma cobrir exatamente o `sidx`, mas nada no formato obriga isso — um
    // `styp` na frente é legal e deslocaria tudo em silêncio.
    let p = 0;
    while (p + 8 <= buf.byteLength) {
      const tam = dv.getUint32(p);
      const tipo = String.fromCharCode(
        dv.getUint8(p + 4), dv.getUint8(p + 5), dv.getUint8(p + 6), dv.getUint8(p + 7),
      );
      if (tipo === 'sidx') break;
      if (tam < 8) return null;
      p += tam;
    }
    if (p + 12 > buf.byteLength) return null;

    const versao = dv.getUint8(p + 8);
    // p+12 reference_ID (ignorado: uma faixa só)
    const escala = dv.getUint32(p + 16);
    if (!escala) return null;
    // `earliest_presentation_time` e `first_offset` mudam de 32 para 64 bits na
    // versão 1 — é o único ponto em que o tamanho do cabeçalho varia, e errá-lo
    // desloca TODAS as entradas.
    let q = p + 20;
    let primeiroDeslocamento = 0;
    if (versao === 0) {
      primeiroDeslocamento = dv.getUint32(q + 4);
      q += 8;
    } else {
      // Os 64 bits são lidos como Number: um deslocamento de vídeo cabe com
      // folga em 2^53, e `getBigUint64` obrigaria a converter em toda conta.
      primeiroDeslocamento = dv.getUint32(q + 8) * 4294967296 + dv.getUint32(q + 12);
      q += 16;
    }
    q += 2;                              // reserved
    const quantos = dv.getUint16(q); q += 2;
    if (!quantos || q + quantos * 12 > buf.byteLength) return null;

    const segs = [];
    let posicao = inicioDosDados + primeiroDeslocamento;
    let t = 0;
    for (let i = 0; i < quantos; i++) {
      // O bit mais alto de `referenced_size` é o `reference_type`: 1 significa
      // que a entrada aponta para OUTRO sidx, não para mídia. O YouTube não usa
      // sidx encadeado, mas mascarar o bit custa uma linha e evita um tamanho
      // absurdo caso um dia use.
      const bruto = dv.getUint32(q);
      const tamSeg = bruto & 0x7fffffff;
      const dur = dv.getUint32(q + 4) / escala;
      segs.push({ ini: posicao, fim: posicao + tamSeg - 1, t0: t, dur });
      posicao += tamSeg;
      t += dur;
      q += 12;
    }
    return segs;
  }

  // --------------------------------------------------------------------------

  function criar(video, man, opts) {
    const onErro = (opts && opts.onErro) || function () {};
    let morto = false;
    let tick = null;
    let objUrl = null;
    const ms = new MediaSource();
    const faixas = [];

    function morrer(porque) {
      if (morto) return;
      morto = true;
      clearInterval(tick);
      try { if (ms.readyState === 'open') ms.endOfStream(); } catch (_) {}
      // A URL do objeto é revogada SEMPRE, inclusive na falha: cada
      // `createObjectURL` que não é revogado prende o MediaSource e, por ele,
      // os buffers — num app que troca de mídia dezenas de vezes por culto isso
      // é vazamento de verdade.
      if (objUrl) { try { URL.revokeObjectURL(objUrl); } catch (_) {} objUrl = null; }
      if (porque) onErro(porque);
    }

    async function pegar(url, ini, fim) {
      const r = await fetch(url, { headers: { Range: 'bytes=' + ini + '-' + fim } });
      // 200 é aceito além do 206: um proxy pode responder a faixa inteira, e
      // recusar isso quebraria por preciosismo.
      if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }

    // Quanto já está bufferizado À FRENTE de `t`, na faixa dada.
    function adiante(sb, t) {
      try {
        for (let i = 0; i < sb.buffered.length; i++) {
          if (sb.buffered.start(i) <= t + 0.1 && sb.buffered.end(i) > t) {
            return sb.buffered.end(i) - t;
          }
        }
      } catch (_) {}
      return 0;
    }

    function indiceEm(segs, t) {
      for (let i = 0; i < segs.length; i++) {
        if (t < segs[i].t0 + segs[i].dur) return i;
      }
      return segs.length;
    }

    // Descarta o passado quando o navegador reclama de cota. Só isso: nada de
    // política de cache própria — quem sabe quando o espaço acabou é ele.
    function podar(f) {
      const t = video.currentTime - GUARDA_S;
      if (t <= 0) return false;
      try { f.sb.remove(0, t); return true; } catch (_) { return false; }
    }

    async function alimentar(f) {
      if (morto || f.ocupada || !f.segs) return;
      if (f.sb.updating) return;
      if (f.i >= f.segs.length) {
        // Todas as faixas no fim: o `endOfStream` é o que faz o `<video>`
        // conhecer a duração real e disparar `ended` — sem ele o vídeo trava no
        // último quadro, com o transporte achando que ainda está tocando.
        if (faixas.every((x) => x.segs && x.i >= x.segs.length && !x.sb.updating)) {
          try { if (ms.readyState === 'open') ms.endOfStream(); } catch (_) {}
        }
        return;
      }
      if (adiante(f.sb, video.currentTime) > ALVO_S) return;
      f.ocupada = true;
      try {
        const seg = f.segs[f.i];
        const buf = await pegar(f.url, seg.ini, seg.fim);
        if (morto || ms.readyState !== 'open') return;
        try {
          f.sb.appendBuffer(buf);
          f.i++;
        } catch (e) {
          // QuotaExceededError é ESPERADO num vídeo longo, e não é falha: poda o
          // passado e tenta de novo no próximo compasso. Qualquer outro erro é
          // real e sobe.
          if (e && e.name === 'QuotaExceededError' && podar(f)) return;
          throw e;
        }
      } catch (e) {
        morrer((e && e.message) || 'append');
      } finally {
        f.ocupada = false;
      }
    }

    function bombear() { faixas.forEach(alimentar); }

    function aoAbrir() {
      try {
        // A DURAÇÃO vem do manifesto, não do sidx: ela é o que a barra de
        // progresso do app lê no `loadedmetadata`, e somar as durações dos
        // fragmentos daria um valor levemente diferente entre as duas faixas.
        if (man.seconds > 0) ms.duration = man.seconds;
        [['video', man.video], ['audio', man.audio]].forEach(([papel, t]) => {
          const sb = ms.addSourceBuffer(t.mime);
          sb.mode = 'segments';
          const f = { papel, sb, url: t.url, meta: t, segs: null, i: 0, ocupada: false };
          sb.addEventListener('updateend', bombear);
          sb.addEventListener('error', () => morrer(papel + ' sourcebuffer'));
          faixas.push(f);
        });
      } catch (e) {
        morrer('addSourceBuffer: ' + ((e && e.message) || '?'));
        return;
      }
      iniciar();
    }

    async function iniciar() {
      try {
        for (const f of faixas) {
          // O SEGMENTO DE INICIALIZAÇÃO (`ftyp` + `moov`) primeiro: ele descreve
          // a faixa, e um fragmento de mídia entregue antes dele é rejeitado.
          const init = await pegar(f.url, f.meta.initStart, f.meta.initEnd);
          if (morto) return;
          await aplicar(f, init);
          const idx = await pegar(f.url, f.meta.indexStart, f.meta.indexEnd);
          if (morto) return;
          f.segs = lerSidx(idx, f.meta.indexEnd + 1);
          if (!f.segs || !f.segs.length) { morrer('sidx ' + f.papel); return; }
        }
        bombear();
        tick = setInterval(bombear, TICK_MS);
      } catch (e) {
        morrer((e && e.message) || 'início');
      }
    }

    // `appendBuffer` é assíncrono e só UM por SourceBuffer por vez — daí a
    // espera explícita no caminho de inicialização, que é sequencial por
    // natureza (init antes de índice, índice antes de mídia).
    function aplicar(f, buf) {
      return new Promise((resolve, reject) => {
        const ok = () => { f.sb.removeEventListener('updateend', ok); resolve(); };
        f.sb.addEventListener('updateend', ok);
        try { f.sb.appendBuffer(buf); } catch (e) { f.sb.removeEventListener('updateend', ok); reject(e); }
      });
    }

    // Um seek NÃO limpa o buffer: os fragmentos carregam o próprio tempo, então
    // um append fora de ordem cai no lugar certo sozinho. Limpar seria jogar
    // fora o que já está lá — inclusive quando o operador volta dois segundos.
    function aoBuscar() {
      const t = video.currentTime;
      faixas.forEach((f) => {
        if (!f.segs) return;
        if (adiante(f.sb, t) > 0.5) return;   // já temos este ponto
        f.i = indiceEm(f.segs, t);
      });
      bombear();
    }

    ms.addEventListener('sourceopen', aoAbrir, { once: true });
    video.addEventListener('seeking', aoBuscar);
    objUrl = URL.createObjectURL(ms);
    video.src = objUrl;

    return {
      destruir() {
        video.removeEventListener('seeking', aoBuscar);
        morrer(null);
      },
    };
  }

  global.AVStream = { suportado, criar, lerSidx };
})(window);
