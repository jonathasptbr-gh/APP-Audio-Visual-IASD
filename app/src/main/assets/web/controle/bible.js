// Cliente da parte BÍBLICA do banco público do LouvorJA (ver
// docs/FONTE-DE-DADOS-LOUVORJA.md §5.6 e a seção "Bíblia" no CLAUDE.md).
// Reaproveita o transporte já pronto de louvorja.js (Louvorja.fetchList) —
// mesmas credenciais públicas. Exposto como window.Bible.
//
// Duas fontes de dados:
//  - ESTÁTICA (offline, sempre disponível): a estrutura canônica dos 66 livros
//    (abreviação + nome + nº de capítulos). É o que alimenta a "tabela
//    periódica" de seleção mesmo antes de qualquer download — abreviações e
//    contagens de capítulo são fatos fixos do cânon protestante/adventista.
//  - ONLINE (baixada na 1ª vez que for usada): a lista de versões
//    (pt_bible_version), a lista de livros (pt_bible_book — pra casar o
//    id_bible_book real) e o TEXTO de cada capítulo (bible_{v}_{b}_{c}).

(function (global) {
  'use strict';

  const LOCALE = 'pt';
  const VERSION_FILE = LOCALE + '_bible_version'; // pt_bible_version
  const BOOK_FILE = LOCALE + '_bible_book';       // pt_bible_book

  // Estrutura canônica dos 66 livros (ordem canônica = ordem do array). Assume
  // que pt_bible_book vem nessa mesma ordem, com id_bible_book = índice+1 —
  // usado só como fallback quando a lista online ainda não foi baixada (ver
  // bibleBookId em controle.js).
  //   `t`: 'ot' (Antigo Testamento) | 'nt' (Novo).
  //   `g`: grupo/divisão canônica (cor do bloco na tabela periódica — ver
  //        .bg-<g> em controle.css): lei, historicos, poeticos, pmaiores,
  //        pmenores, evangelhos, atos, paulinas, gerais, apocalipse.
  const BOOKS = [
    // ----- Antigo Testamento (39) -----
    { abbr: 'Gn', name: 'Gênesis', chapters: 50, t: 'ot', g: 'lei' },
    { abbr: 'Êx', name: 'Êxodo', chapters: 40, t: 'ot', g: 'lei' },
    { abbr: 'Lv', name: 'Levítico', chapters: 27, t: 'ot', g: 'lei' },
    { abbr: 'Nm', name: 'Números', chapters: 36, t: 'ot', g: 'lei' },
    { abbr: 'Dt', name: 'Deuteronômio', chapters: 34, t: 'ot', g: 'lei' },
    { abbr: 'Js', name: 'Josué', chapters: 24, t: 'ot', g: 'historicos' },
    { abbr: 'Jz', name: 'Juízes', chapters: 21, t: 'ot', g: 'historicos' },
    { abbr: 'Rt', name: 'Rute', chapters: 4, t: 'ot', g: 'historicos' },
    { abbr: '1Sm', name: '1 Samuel', chapters: 31, t: 'ot', g: 'historicos' },
    { abbr: '2Sm', name: '2 Samuel', chapters: 24, t: 'ot', g: 'historicos' },
    { abbr: '1Rs', name: '1 Reis', chapters: 22, t: 'ot', g: 'historicos' },
    { abbr: '2Rs', name: '2 Reis', chapters: 25, t: 'ot', g: 'historicos' },
    { abbr: '1Cr', name: '1 Crônicas', chapters: 29, t: 'ot', g: 'historicos' },
    { abbr: '2Cr', name: '2 Crônicas', chapters: 36, t: 'ot', g: 'historicos' },
    { abbr: 'Ed', name: 'Esdras', chapters: 10, t: 'ot', g: 'historicos' },
    { abbr: 'Ne', name: 'Neemias', chapters: 13, t: 'ot', g: 'historicos' },
    { abbr: 'Et', name: 'Ester', chapters: 10, t: 'ot', g: 'historicos' },
    { abbr: 'Jó', name: 'Jó', chapters: 42, t: 'ot', g: 'poeticos' },
    { abbr: 'Sl', name: 'Salmos', chapters: 150, t: 'ot', g: 'poeticos' },
    { abbr: 'Pv', name: 'Provérbios', chapters: 31, t: 'ot', g: 'poeticos' },
    { abbr: 'Ec', name: 'Eclesiastes', chapters: 12, t: 'ot', g: 'poeticos' },
    { abbr: 'Ct', name: 'Cânticos', chapters: 8, t: 'ot', g: 'poeticos' },
    { abbr: 'Is', name: 'Isaías', chapters: 66, t: 'ot', g: 'pmaiores' },
    { abbr: 'Jr', name: 'Jeremias', chapters: 52, t: 'ot', g: 'pmaiores' },
    { abbr: 'Lm', name: 'Lamentações', chapters: 5, t: 'ot', g: 'pmaiores' },
    { abbr: 'Ez', name: 'Ezequiel', chapters: 48, t: 'ot', g: 'pmaiores' },
    { abbr: 'Dn', name: 'Daniel', chapters: 12, t: 'ot', g: 'pmaiores' },
    { abbr: 'Os', name: 'Oseias', chapters: 14, t: 'ot', g: 'pmenores' },
    { abbr: 'Jl', name: 'Joel', chapters: 3, t: 'ot', g: 'pmenores' },
    { abbr: 'Am', name: 'Amós', chapters: 9, t: 'ot', g: 'pmenores' },
    { abbr: 'Ob', name: 'Obadias', chapters: 1, t: 'ot', g: 'pmenores' },
    { abbr: 'Jn', name: 'Jonas', chapters: 4, t: 'ot', g: 'pmenores' },
    { abbr: 'Mq', name: 'Miqueias', chapters: 7, t: 'ot', g: 'pmenores' },
    { abbr: 'Na', name: 'Naum', chapters: 3, t: 'ot', g: 'pmenores' },
    { abbr: 'Hc', name: 'Habacuque', chapters: 3, t: 'ot', g: 'pmenores' },
    { abbr: 'Sf', name: 'Sofonias', chapters: 3, t: 'ot', g: 'pmenores' },
    { abbr: 'Ag', name: 'Ageu', chapters: 2, t: 'ot', g: 'pmenores' },
    { abbr: 'Zc', name: 'Zacarias', chapters: 14, t: 'ot', g: 'pmenores' },
    { abbr: 'Ml', name: 'Malaquias', chapters: 4, t: 'ot', g: 'pmenores' },
    // ----- Novo Testamento (27) -----
    { abbr: 'Mt', name: 'Mateus', chapters: 28, t: 'nt', g: 'evangelhos' },
    { abbr: 'Mc', name: 'Marcos', chapters: 16, t: 'nt', g: 'evangelhos' },
    { abbr: 'Lc', name: 'Lucas', chapters: 24, t: 'nt', g: 'evangelhos' },
    { abbr: 'Jo', name: 'João', chapters: 21, t: 'nt', g: 'evangelhos' },
    { abbr: 'At', name: 'Atos', chapters: 28, t: 'nt', g: 'atos' },
    { abbr: 'Rm', name: 'Romanos', chapters: 16, t: 'nt', g: 'paulinas' },
    { abbr: '1Co', name: '1 Coríntios', chapters: 16, t: 'nt', g: 'paulinas' },
    { abbr: '2Co', name: '2 Coríntios', chapters: 13, t: 'nt', g: 'paulinas' },
    { abbr: 'Gl', name: 'Gálatas', chapters: 6, t: 'nt', g: 'paulinas' },
    { abbr: 'Ef', name: 'Efésios', chapters: 6, t: 'nt', g: 'paulinas' },
    { abbr: 'Fp', name: 'Filipenses', chapters: 4, t: 'nt', g: 'paulinas' },
    { abbr: 'Cl', name: 'Colossenses', chapters: 4, t: 'nt', g: 'paulinas' },
    { abbr: '1Ts', name: '1 Tessalonicenses', chapters: 5, t: 'nt', g: 'paulinas' },
    { abbr: '2Ts', name: '2 Tessalonicenses', chapters: 3, t: 'nt', g: 'paulinas' },
    { abbr: '1Tm', name: '1 Timóteo', chapters: 6, t: 'nt', g: 'paulinas' },
    { abbr: '2Tm', name: '2 Timóteo', chapters: 4, t: 'nt', g: 'paulinas' },
    { abbr: 'Tt', name: 'Tito', chapters: 3, t: 'nt', g: 'paulinas' },
    { abbr: 'Fm', name: 'Filemom', chapters: 1, t: 'nt', g: 'paulinas' },
    { abbr: 'Hb', name: 'Hebreus', chapters: 13, t: 'nt', g: 'gerais' },
    { abbr: 'Tg', name: 'Tiago', chapters: 5, t: 'nt', g: 'gerais' },
    { abbr: '1Pe', name: '1 Pedro', chapters: 5, t: 'nt', g: 'gerais' },
    { abbr: '2Pe', name: '2 Pedro', chapters: 3, t: 'nt', g: 'gerais' },
    { abbr: '1Jo', name: '1 João', chapters: 5, t: 'nt', g: 'gerais' },
    { abbr: '2Jo', name: '2 João', chapters: 1, t: 'nt', g: 'gerais' },
    { abbr: '3Jo', name: '3 João', chapters: 1, t: 'nt', g: 'gerais' },
    { abbr: 'Jd', name: 'Judas', chapters: 1, t: 'nt', g: 'gerais' },
    { abbr: 'Ap', name: 'Apocalipse', chapters: 22, t: 'nt', g: 'apocalipse' },
  ];

  // Rótulos legíveis dos grupos (para legenda/tooltip, se necessário).
  const GROUPS = {
    lei: 'Pentateuco', historicos: 'Históricos', poeticos: 'Poéticos',
    pmaiores: 'Profetas Maiores', pmenores: 'Profetas Menores',
    evangelhos: 'Evangelhos', atos: 'Atos', paulinas: 'Cartas Paulinas',
    gerais: 'Cartas Gerais', apocalipse: 'Apocalipse',
  };

  // Lista de versões/traduções disponíveis (pt_bible_version). Retorna
  // [{ id, name }] normalizado (o schema é 🔶 inferido — lê id_bible_version /
  // name com fallbacks, ver docs §5.6). Lança se a rede falhar.
  async function fetchVersions() {
    const raw = await Louvorja.fetchList(VERSION_FILE);
    const arr = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
    return arr
      .map((v) => ({
        id: v.id_bible_version != null ? v.id_bible_version : (v.id != null ? v.id : null),
        name: v.name || v.abbreviation || v.title || ('Versão ' + (v.id_bible_version || v.id || '')),
      }))
      .filter((v) => v.id != null);
  }

  // Lista de livros (pt_bible_book) — usada só pra casar o id_bible_book REAL
  // (a estrutura de exibição vem de BOOKS acima). Retorna [{ id, name }] na
  // ordem do array (assumida canônica). Lança se a rede falhar.
  async function fetchBooks() {
    const raw = await Louvorja.fetchList(BOOK_FILE);
    const arr = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
    return arr.map((b) => ({
      id: b.id_bible_book != null ? b.id_bible_book : (b.id != null ? b.id : null),
      name: b.name || '',
    }));
  }

  // Nome do arquivo de um capítulo (ver docs §3): bible_{v}_{b}_{c}.
  function chapterFile(versionId, bookId, chapter) {
    return 'bible_' + versionId + '_' + bookId + '_' + chapter;
  }

  // Baixa o texto de UM capítulo e devolve os versículos ordenados:
  // [{ n, text }]. O arquivo é um mapa { numeroDoVersiculo: textoHTML } (docs
  // §5.6); o texto pode conter marcação, então passa por stripHtml. Lança se a
  // rede falhar / arquivo inexistente.
  async function fetchChapter(versionId, bookId, chapter) {
    const raw = await Louvorja.fetchList(chapterFile(versionId, bookId, chapter));
    return parseChapter(raw);
  }

  // Normaliza a resposta de um capítulo em [{ n, text }] ordenado por número.
  // Aceita tanto o mapa { num: texto } quanto pequenas variações (valor objeto
  // com campo de texto), pra ser robusto ao schema 🔶 inferido.
  function parseChapter(raw) {
    if (!raw) return [];
    const out = [];
    const entries = Array.isArray(raw)
      ? raw.map((v, i) => [i + 1, v])
      : Object.entries(raw);
    for (const [k, v] of entries) {
      const n = parseInt(k, 10);
      if (!isFinite(n)) continue;
      let text = v;
      if (v && typeof v === 'object') text = v.text != null ? v.text : (v.verse != null ? v.verse : '');
      const clean = stripHtml(text);
      if (clean) out.push({ n, text: clean });
    }
    out.sort((a, b) => a.n - b.n);
    return out;
  }

  // Remove marcação HTML do texto de um versículo, deixando texto puro (o app
  // original renderiza com v-html; aqui NUNCA inserimos como HTML no DOM — só
  // extraímos o texto). É só troca de string (sem innerHTML), no mesmo espírito
  // do normalizeLyricText do Controle: <br> vira espaço, tags somem, algumas
  // entidades comuns são decodificadas.
  function stripHtml(s) {
    if (s == null) return '';
    let t = String(s);
    t = t.replace(/<\s*br\s*\/?\s*>/gi, ' ');
    t = t.replace(/<[^>]+>/g, '');
    t = t
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
    return t.replace(/\s+/g, ' ').trim();
  }

  global.Bible = { BOOKS, GROUPS, fetchVersions, fetchBooks, fetchChapter, parseChapter, stripHtml, chapterFile, LOCALE };
})(this);
