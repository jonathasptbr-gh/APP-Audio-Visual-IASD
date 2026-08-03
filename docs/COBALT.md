# Baixar vídeos do YouTube (Cobalt)

Este documento existe por causa de uma pergunta que tem uma resposta
desagradável: **por que o app pede um endereço de instância em vez de já vir
com um?**

## Por que não dá para vir configurado

O Cobalt é software livre, mas **não existe uma API pública e gratuita** para
apontar. A documentação do próprio projeto (imput) é explícita:

> **IMPORTANT** — hosted api instances (such as `api.cobalt.tools`) use bot
> protection and are **not** intended to be used in other projects without
> explicit permission. if you want to use the cobalt api, you should
> [host your own instance](https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md)
> or ask an instance owner for access.

Ou seja: a instância oficial tem proteção antirrobô (Turnstile) e pede que não
seja usada por outros projetos. Instâncias da comunidade existem, mas vão e
voltam, quase todas passaram a exigir chave, e **nenhuma delas é nossa para
prometer** — embutir uma lista no APK é assinar embaixo de um serviço de
terceiro que pode sumir no meio de um culto.

> A biblioteca `stephanemoni/cobalt-api` (Node.js) **não** resolve isso: ela é
> um cliente, não um servidor. O construtor dela lança se faltar `API_URL` ou
> `API_KEY` — ou seja, também exige uma instância — e, sendo Node (`axios`,
> `fs`, `dotenv`, `ytdl-core`), não roda dentro do WebView do app.

## O app procura uma instância sozinho (v5.80)

Com o campo de endereço **em branco** — que é como ele vem —, a primeira
importação de um link do YouTube dispara uma busca automática: o app baixa a
lista pública da comunidade
([instances.cobalt.best](https://instances.cobalt.best/)), descarta as
candidatas que não servem e **sonda** as restantes em paralelo. Fica com a
primeira que responder, e guarda a escolha por 24 h.

**A desconfiança é o projeto.** O formato dessa lista não é contrato de
ninguém — o endpoint já mudou uma vez —, então ela serve para uma coisa só:
dar *nomes* de candidatas. Quem decide se uma candidata presta é o `GET /` do
próprio Cobalt, que é documentado: versão, `youtube` em `services` e **ausência
de `turnstileSitekey`**. Se a lista mudar de forma, a leitura devolve zero
candidatas, o link vira item de player e nada quebra.

Descartadas antes mesmo de sondar: `online: false`, instância sem CORS (o
`fetch` do WebView nem leria a resposta), instância com autenticação declarada
(não temos chave para ela), sem `youtube` nos serviços, e qualquer uma que não
seja `https` — o WebView roda em contexto seguro e não faz `fetch` para `http`.

- **A instância automática que falhar é descartada na hora.** Ela foi escolhida
  pelo app, não por você; insistir numa que não responde faria a importação
  seguinte falhar igual. A digitada à mão fica — ali a escolha é sua.
- **Uma varredura que não acha nada não se repete por 30 minutos.** São ~13 s
  de espera para chegar ao mesmo lugar; o segundo link não paga a conta do
  primeiro.
- **O que você digita vence sempre.** Preencher o campo desliga a busca
  automática.
- **"Procurar/testar instância"** faz as duas coisas: com o campo vazio,
  procura; com o campo preenchido, testa aquele endereço.

> Ainda assim, **subir a sua** continua sendo o único caminho que não depende
> de terceiros — as instâncias públicas vão e voltam, e várias limitam o número
> de downloads. Se um culto depende disso, veja a receita abaixo.

## O que o app faz com a instância

Achada (ou configurada à mão), todo o resto é automático e não se toca mais
nele:

- **compartilhar um link do YouTube com o app** já baixa o vídeo e cria o item
  no Cronograma como arquivo local — nenhum passo a mais;
- um item de player que já existe pode ser convertido pelo botão ao lado do
  selo `YT`;
- falhando qualquer coisa, o link vira item de player como antes e o motivo
  fica escrito na própria tela de Configurações.

**Testar instância** confere o endereço na hora (`GET /`, que não é autenticado
nem entra no limite de taxa) e separa os três motivos de falha que na tela
seriam o mesmo "não baixou": endereço errado, instância sem YouTube, e
instância com **Turnstile** — que o app não tem como resolver (não há widget
aqui), e cuja única saída é uma chave de API.

## Subir a sua própria (uma vez, para sempre)

É o único caminho que não depende de ninguém. Em qualquer VPS com Docker:

```yaml
# docker-compose.yml
services:
  cobalt-api:
    image: ghcr.io/imputnet/cobalt:11
    init: true
    restart: unless-stopped
    container_name: cobalt-api
    ports:
      - 9000:9000/tcp
    environment:
      # o endereço PÚBLICO da sua instância, com https e barra no fim
      API_URL: "https://cobalt.suaigreja.org/"
      # opcional, mas recomendado se ela ficar aberta na internet:
      # API_KEY_URL: "file:///keys.json"
    labels:
      - com.centurylinklabs.watchtower.scope=cobalt
```

```bash
docker compose up -d
```

Depois é só pôr `https://cobalt.suaigreja.org` no campo do app e tocar em
**Testar instância**.

- Ponha um proxy reverso com HTTPS na frente (Caddy resolve em três linhas). O
  app **exige `https://`** — o WebView roda num contexto seguro e não faz
  `fetch` para `http://`.
- Se a instância for pública, use `API_KEY_URL` e cole a chave no campo do app.
  **Turnstile não serve aqui** — prefira chave.
- A instância não precisa estar no ar durante o culto: ela só é usada no
  momento de baixar. Depois disso o vídeo é um arquivo no aparelho.

A documentação completa de operação está em
[run-an-instance.md](https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md).

## O que o app envia

`POST /` com `Accept: application/json`, `Content-Type: application/json` e,
quando há chave, `Authorization: Api-Key <chave>`:

```json
{
  "url": "https://www.youtube.com/watch?v=…",
  "videoQuality": "1080",
  "youtubeVideoCodec": "h264",
  "downloadMode": "auto",
  "filenameStyle": "basic",
  "alwaysProxy": true
}
```

- **`youtubeVideoCodec: "h264"`** — H.264 em MP4 é o que o WebView do Android
  toca em qualquer aparelho. AV1/VP9 num `.webm` depende do modelo, e um vídeo
  que não abre no telão no meio do culto é pior que um arquivo maior.
- **`alwaysProxy: true`** — os bytes vêm pelo túnel do Cobalt, que responde com
  CORS. Um redirect direto para o CDN do YouTube seria bloqueado no `fetch`.

A resposta esperada é `{ "status": "tunnel" | "redirect", "url": "…" }`;
`picker` (várias faixas) e o `stream` da API v7 também são aceitos.
