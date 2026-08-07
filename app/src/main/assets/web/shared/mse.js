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
  // Prazo de um `appendBuffer` do caminho de inicialização. Generoso de
  // propósito: ele não existe para apertar o aparelho, existe para que uma
  // resposta que nunca vem vire ERRO em vez de silêncio eterno.
  const APPEND_MS = 15000;

  // AS FAIXAS QUE ESTE MANIFESTO TEM — uma ou duas.
  //
  // O manifesto do shell traz sempre o par (vídeo + áudio), mas o "Tocar agora ·
  // Só áudio" descarta a de vídeo antes de chegar aqui: quem pediu só o som não
  // tem por que baixar 1080p para jogar fora. Exigir as duas, como esta função
  // fazia, barrava a transmissão justamente no caso mais leve — o que menos
  // deveria esperar por download.
  //
  // Os papéis em PORTUGUÊS porque eles vão parar no Registro, que o operador lê
  // e repassa.
  function faixasDe(man) {
    if (!man) return [];
    return [['vídeo', man.video], ['áudio', man.audio]].filter((par) => par[1] && par[1].url);
  }

  function suportado(man) {
    if (!global.MediaSource) return false;
    const faixas = faixasDe(man);
    if (!faixas.length) return false;
    try {
      return faixas.every((par) => MediaSource.isTypeSupported(par[1].mime));
    } catch (_) { return false; }
  }

  // --------------------------------------------------------------------------
  // A FAIXA VIAJA NA URL, NÃO NO CABEÇALHO (v5.127, shell 27)
  //
  // Num WebView, o `InputStream` devolvido por `shouldInterceptRequest` é lido
  // pelo Chromium como o recurso INTEIRO a partir do byte 0: é ELE quem aplica
  // o `Range` da requisição, pulando `first_byte_position` bytes do que o app
  // entregou. Como o `StreamProxy` entrega só a fatia pedida, o deslocamento
  // saía aplicado duas vezes — e a única requisição que podia funcionar era a
  // que começa em 0, porque ali pular é um no-op. Era exatamente o que o
  // aparelho reportava: o `init` passava, o `índice` morria com "Failed to
  // fetch", sem status nenhum.
  //
  // Pedindo `?r=<ini>-<fim>` SEM cabeçalho `Range`, não há o que parsear e não
  // há seek: a fatia chega inteira. No navegador nada disso existe (não há
  // interceptador), então lá o `Range` continua sendo o jeito certo — e é o
  // caminho padrão, como manda a regra do projeto.
  // --------------------------------------------------------------------------
  const FAIXA_NA_URL_DESDE = 27;

  function faixaNaUrl() {
    return !!(global.__NATIVE__ && (global.__SHELL_VERSION__ | 0) >= FAIXA_NA_URL_DESDE);
  }

  // Este aparelho consegue transmitir? No navegador, sempre. No app, só com o
  // shell que entende a faixa na URL — num shell antigo a transmissão está
  // quebrada por construção (ver acima), e tentar assim mesmo projeta uma cena
  // morta em vez de cair no download.
  function disponivel() {
    return !global.__NATIVE__ || faixaNaUrl();
  }

  // Devolve [url, opções] do `fetch`. Guarda na ordem da regra: o navegador é o
  // padrão, o nativo é a exceção declarada.
  function pedido(url, ini, fim) {
    if (!faixaNaUrl()) return [url, { headers: { Range: 'bytes=' + ini + '-' + fim } }];
    return [url + (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + ini + '-' + fim, {}];
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
    // SHELL ANTIGO: desistir AQUI, e nunca calado. O chamador já entrou no ramo
    // de stream, e um registro de stream não tem blob, opfsPath nem url — sair
    // em silêncio deixaria o telão preto sem fallback nenhum. O erro sai
    // assíncrono de propósito: quem chamou ainda não recebeu o retorno.
    if (!disponivel()) {
      const porque = 'a transmissão exige o shell 27 (instale o APK novo) — este é o '
        + (global.__SHELL_VERSION__ | 0);
      global.AVStream.ultimoErro = porque;
      setTimeout(() => { try { onErro(porque); } catch (_) {} }, 0);
      return { destruir() {} };
    }
    let morto = false;
    let tick = null;
    let objUrl = null;
    const ms = new MediaSource();
    const faixas = [];
    // Os fetches EM VOO agora (um AbortController por requisição — as duas
    // faixas podem buscar ao mesmo tempo, então não é um controller só).
    // Existe para `morrer`/`destruir`: sem o abort, os bytes de um telão que
    // já saiu de cena continuavam trafegando até o fim do segmento — rede
    // gasta por um vídeo que ninguém mais vai ver.
    const emVoo = new Set();

    function morrer(porque) {
      if (morto) return;
      morto = true;
      clearInterval(tick);
      // Derruba as requisições em voo. Quem estava no `await` recebe um
      // AbortError, cai no catch de quem chamou e esbarra no `morto` já
      // ligado — nenhuma segunda mensagem de erro sai daqui.
      for (const ctl of emVoo) { try { ctl.abort(); } catch (_) {} }
      emVoo.clear();
      // NADA DE `endOfStream()` AQUI. Ele existe para dizer "a mídia acabou", e
      // num MediaSource que nunca recebeu um byte isso é mentira com
      // consequência: o `<video>` dispara `ended`, o stage cobre com o
      // wallpaper e o `autoAdvance` do Controle pula para o próximo item da
      // playlist — um segundo depois do "Tocar agora", sem ninguém entender
      // por quê. Quem sinaliza fim de verdade é `alimentar()`, quando todos os
      // fragmentos entraram. Aqui só se solta o que foi alocado.
      // A URL do objeto é revogada SEMPRE, inclusive na falha: cada
      // `createObjectURL` que não é revogado prende o MediaSource e, por ele,
      // os buffers — num app que troca de mídia dezenas de vezes por culto isso
      // é vazamento de verdade.
      if (objUrl) { try { URL.revokeObjectURL(objUrl); } catch (_) {} objUrl = null; }
      if (porque) {
        global.AVStream.ultimoErro = porque;
        onErro(porque);
      }
    }

    // O `passo` viaja junto do erro porque "não deu" não leva a lugar nenhum:
    // este player busca três coisas por faixa — inicialização, índice e mídia —
    // e cada uma falha por um motivo diferente, com um conserto diferente.
    async function pegar(url, ini, fim, passo) {
      const alvo = pedido(url, ini, fim);
      // Abortável: o controller entra no conjunto `emVoo` enquanto a
      // requisição vive, e `morrer` derruba todos de uma vez. O finally o
      // tira do conjunto em QUALQUER desfecho — sucesso, erro HTTP, abort.
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      if (ctl) { alvo[1].signal = ctl.signal; emVoo.add(ctl); }
      try {
        let r;
        try {
          r = await fetch(alvo[0], alvo[1]);
        } catch (e) {
          // A FAIXA VAI JUNTO, e isto não é enfeite: este era o único dos três
          // ramos de `pegar()` que não imprimia os números, e foi justamente ele
          // que falhou em aparelho. A investigação inteira teve de deduzir por
          // aritmética o que uma linha de log teria dito.
          throw new Error(passo + ': a requisição não completou (' + ((e && e.message) || '?')
            + ') pedindo bytes ' + ini + '-' + fim);
        }
        // 200 é aceito além do 206: um proxy pode responder a faixa inteira, e
        // recusar isso quebraria por preciosismo.
        if (!r.ok && r.status !== 206) {
          // O `statusText` carrega o MOTIVO quando quem respondeu foi o nosso
          // proxy (ver `StreamProxy.erro`): "token desconhecido", "googlevideo:
          // Forbidden", o texto de uma falha de rede. Sem ele sobra um número, e
          // um 404 do proxy e um 404 do asset loader se leem igual — apontando
          // para lugares opostos.
          throw new Error(passo + ': HTTP ' + r.status
            + (r.statusText ? ' (' + r.statusText + ')' : '')
            + ' pedindo bytes ' + ini + '-' + fim);
        }
        const buf = await r.arrayBuffer();
        // ZERO BYTES com status bom é o caso mais traiçoeiro: o `appendBuffer`
        // aceita sem reclamar e o vídeo simplesmente nunca começa. Melhor falhar
        // aqui, com o número na mão.
        if (!buf.byteLength) {
          throw new Error(passo + ': resposta vazia (HTTP ' + r.status + ', pedidos '
            + (fim - ini + 1) + ' bytes)');
        }
        return buf;
      } finally {
        if (ctl) emVoo.delete(ctl);
      }
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
      // Um seek reposicionou o índice enquanto o fetch corria (ver abaixo):
      // este compasso não appendou nada, e o próximo precisa vir logo.
      let reposicionada = false;
      try {
        // O índice é CAPTURADO antes do await: `aoBuscar` (evento `seeking`)
        // escreve `f.i` no meio dele, e o `f.i++` cego de antes incrementava o
        // índice NOVO do seek — o segmento do ponto buscado nunca era pedido,
        // ficava um buraco no buffer e o vídeo travava ali enquanto a bomba
        // seguia baixando os seguintes.
        const idx = f.i;
        let buf;
        if (f.pendenteBuf && f.pendenteIdx === idx) {
          // Segmento já baixado que a cota devolveu (ver o Quota abaixo):
          // tenta o append dele antes de gastar rede de novo.
          buf = f.pendenteBuf;
        } else {
          // Se havia um pendente de OUTRO índice, um seek moveu o alvo desde
          // que ele foi guardado: o buf é de outro ponto e reaproveitá-lo
          // incrementaria o índice errado — descarta e busca o certo.
          f.pendenteBuf = null;
          const seg = f.segs[idx];
          buf = await pegar(f.url, seg.ini, seg.fim, 'mídia ' + f.papel + ' #' + idx);
        }
        if (morto || ms.readyState !== 'open') return;
        if (f.i !== idx) {
          // O seek moveu o alvo durante o await: descartar é o certo — o
          // append cairia no lugar certo (fragmentos carregam o próprio
          // tempo), mas o incremento pularia o segmento do ponto buscado.
          // O próximo compasso pede o segmento certo.
          reposicionada = true;
          return;
        }
        try {
          f.sb.appendBuffer(buf);
          f.pendenteBuf = null;
          f.i++;
        } catch (e) {
          // QuotaExceededError é ESPERADO num vídeo longo, e não é falha: poda
          // o passado e tenta de novo no próximo compasso. O segmento já
          // baixado fica GUARDADO para essa retentativa — jogá-lo fora, como
          // era, pagava a rede duas vezes pelo mesmo pedaço, justamente no
          // vídeo grande em que a cota aperta. Qualquer outro erro é real e
          // sobe.
          if (e && e.name === 'QuotaExceededError' && podar(f)) {
            f.pendenteBuf = buf;
            f.pendenteIdx = idx;
            return;
          }
          throw e;
        }
      } catch (e) {
        morrer((e && e.message) || ('mídia ' + f.papel + ': append falhou'));
      } finally {
        f.ocupada = false;
        // O `bombear` do seek bateu na porta com `ocupada` ligada e foi
        // embora; sem este reengate, quem re-alimentaria a faixa seria só o
        // compasso de TICK_MS — um respiro visível a cada seek à toa.
        if (reposicionada && !morto) bombear();
      }
    }

    function bombear() { faixas.forEach(alimentar); }

    function aoAbrir() {
      try {
        // A DURAÇÃO vem do manifesto, não do sidx: ela é o que a barra de
        // progresso do app lê no `loadedmetadata`, e somar as durações dos
        // fragmentos daria um valor levemente diferente entre as duas faixas.
        if (man.seconds > 0) ms.duration = man.seconds;
        // UMA OU DUAS faixas, conforme o manifesto (ver `faixasDe`): o "Só
        // áudio" chega aqui com a de vídeo já descartada, e um `addSourceBuffer`
        // de vídeo para uma faixa que não existe lançaria antes de qualquer byte
        // ser pedido.
        faixasDe(man).forEach(([papel, t]) => {
          const sb = ms.addSourceBuffer(t.mime);
          sb.mode = 'segments';
          // `pendenteBuf`/`pendenteIdx`: segmento baixado que um
          // QuotaExceededError devolveu — retentado no próximo compasso em
          // vez de rebaixado da rede (ver `alimentar`).
          const f = {
            papel, sb, url: t.url, meta: t, segs: null, i: 0, ocupada: false,
            pendenteBuf: null, pendenteIdx: 0,
          };
          sb.addEventListener('updateend', bombear);
          // MESMA REDAÇÃO do erro de `appendBuffer`, e é o mesmo defeito visto
          // de outro ângulo: os bytes chegaram e o navegador não os quis. Ele
          // dispara por evento (e não por exceção) quando a recusa acontece
          // depois do append aceitar o buffer — e "vídeo sourcebuffer", que era
          // o texto antigo, não dizia nada a ninguém.
          sb.addEventListener('error', () => morrer(
            papel + ': o decodificador recusou os dados — mime ' + t.mime,
          ));
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
          const init = await pegar(f.url, f.meta.initStart, f.meta.initEnd, 'init ' + f.papel);
          if (morto) return;
          try {
            await aplicar(f, init);
          } catch (e2) {
            morrer('init ' + f.papel + ': o decodificador recusou (' + ((e2 && e2.message) || '?')
              + ') — mime ' + f.meta.mime);
            return;
          }
          const idx = await pegar(f.url, f.meta.indexStart, f.meta.indexEnd, 'índice ' + f.papel);
          if (morto) return;
          f.segs = lerSidx(idx, f.meta.indexEnd + 1);
          if (!f.segs || !f.segs.length) {
            morrer('índice ' + f.papel + ': sidx não reconhecido ('
              + idx.byteLength + ' bytes em ' + f.meta.indexStart + '-' + f.meta.indexEnd + ')');
            return;
          }
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
        let prazo = null;
        const limpar = () => {
          clearTimeout(prazo);
          f.sb.removeEventListener('updateend', ok);
          f.sb.removeEventListener('error', ruim);
        };
        const ok = () => { limpar(); resolve(); };
        const ruim = () => { limpar(); reject(new Error('o SourceBuffer recusou por evento')); };
        f.sb.addEventListener('updateend', ok);
        f.sb.addEventListener('error', ruim);
        // PRAZO. Sem ele, um `updateend` que não vem deixa `iniciar()`
        // pendurado para SEMPRE: a transmissão para sem erro nenhum, que é o
        // único desfecho pior que falhar — ninguém avisa o dono da cena e o
        // download nem chega a ser acionado.
        prazo = setTimeout(() => {
          limpar();
          reject(new Error('o append não respondeu em ' + (APPEND_MS / 1000) + ' s'));
        }, APPEND_MS);
        try { f.sb.appendBuffer(buf); } catch (e) { limpar(); reject(e); }
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

  // O ÚLTIMO erro de transmissão, para o Registro de Configurações. Um
  // `console.warn` não chega a quem opera o culto — e é justamente quem opera
  // que vê a falha acontecer.
  global.AVStream = { suportado, disponivel, criar, lerSidx, ultimoErro: '' };
})(window);
