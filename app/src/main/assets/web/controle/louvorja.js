// Cliente mínimo da API pública do LouvorJA (app-ja), usado só pelo Controle
// para sincronizar as coleções de mídia — hinários e álbuns (ver seção
// "Coleções de mídia (LouvorJA)" no CLAUDE.md). Mesmas credenciais já
// públicas no bundle do app-ja (VITE_URL_DATABASE/VITE_URL_FILES/VITE_API_TOKEN
// de produção) — não é um segredo protegido, só reaproveitado aqui.
//
// Exposto como window.Louvorja.

(function (global) {
  'use strict';

  const DB_URL = 'https://api.louvorja.com.br/json_db';
  const FILE_URL = 'https://api.louvorja.com.br/file';
  const TOKEN = '02@v2nFB2Dc';

  // Nomes de arquivos de lista usados pelo sistema de coleções (ver seção
  // "Coleções de mídia (LouvorJA)" no CLAUDE.md e docs/FONTE-DE-DADOS-LOUVORJA.md).
  // Os hinários são módulos "hymnal"/"hymnal_1996"; os álbuns são descobertos
  // via "pt_categories". fetchList aceita qualquer nome — estas constantes são
  // só conveniência/documentação.
  const HYMNAL_2022_FILE = 'pt_hymnal';       // Hinário Adventista 2022
  const HYMNAL_1996_FILE = 'pt_hymnal_1996';  // Hinário Adventista 1996
  const CATEGORIES_FILE = 'pt_categories';    // catálogo de coletâneas → álbuns

  // Busca um arquivo do "banco" do LouvorJA (lista ou registro individual,
  // ex: "pt_hymnal" ou "music_123"). Mesmo formato do Database.js do app-ja:
  // header Api-Token + query string de cache-busting diário.
  async function fetchList(file) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch(`${DB_URL}/${file}?${date}`, {
      headers: { 'Api-Token': TOKEN },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // Resolve o caminho de um arquivo de mídia (áudio/imagem) vindo de um campo
  // do banco (ex: url_music) para a URL completa de download.
  function fileUrl(path) {
    return FILE_URL + path;
  }

  global.Louvorja = { fetchList, fileUrl, HYMNAL_2022_FILE, HYMNAL_1996_FILE, CATEGORIES_FILE };
})(this);
