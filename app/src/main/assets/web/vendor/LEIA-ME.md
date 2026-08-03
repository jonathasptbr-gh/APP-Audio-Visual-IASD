# `vendor/` — código de terceiro, copiado aqui de propósito

## `pptx-renderer.js` — `@aiden0z/pptx-renderer` 1.2.4 (Apache-2.0)

Renderiza um `.pptx` (Office Open XML) como DOM, no próprio navegador. O app o
usa **só na importação**, para transformar cada slide numa IMAGEM — daí para a
frente a apresentação é a mesma mídia `deck` que um PDF vira (ver
`docs/ARQUITETURA-WEB.md`).

**Por que uma dependência**, sendo que o projeto não aceita dependências:
porque não havia outro jeito. Levantamento feito antes de decidir:

- O Android **não desenha `.pptx`** — a plataforma só traz `PdfRenderer`.
- As bibliotecas nativas que fazem isso são comerciais (Aspose) ou limitadas a
  3 páginas na versão gratuita (Spire). Nenhuma serve.
- Converter num servidor exige conta, chave ou instância de terceiro, e mandar
  o material do culto para fora do aparelho. Contra tudo o que o app é.
- Escrever o renderizador aqui significaria implementar DrawingML (formas,
  herança de layout/master, autofit, tabelas, SmartArt). O resultado realista
  seria um slide PARECIDO com o que o pastor montou, e slide parecido na frente
  da congregação é pior que slide nenhum.

Esta biblioteca é a única saída que roda no aparelho, é livre (Apache-2.0) e
publica **452 casos de regressão visual** comparados com a saída do PowerPoint.
A conta da manutenção é de quem a publica, que é o critério do projeto para uma
exceção (ver "Regras de desenvolvimento" no CLAUDE.md).

**Carregada sob demanda** (`import()` dinâmico), nunca no boot: são 1,5 MB que
só interessam a quem importar um `.pptx`.

Atualizar: baixe o `dist/aiden0z-pptx-renderer.browser.es.js` da versão nova no
npm, substitua este arquivo e rode a conversão de um `.pptx` de teste antes de
publicar. O arquivo é **buildado**, não editável — nunca corrija nada aqui.
