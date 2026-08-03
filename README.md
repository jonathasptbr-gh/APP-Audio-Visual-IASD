# Áudio Visual IASD — app Android

App de projeção de mídia para culto. O celular do operador mostra o
**Controle**; a TV recebe **só o Display**, na resolução nativa dela — sem
espelhar a tela do celular.

Isso é possível porque o app usa `android.app.Presentation`: uma segunda tela
de verdade, e não um espelhamento. O sistema inteiro (playlist, transições,
letra sincronizada, Bíblia, mensagens, coleções do LouvorJA, YouTube) roda numa
base web hospedada em dois WebViews do mesmo processo e mesmo origin — que por
isso compartilham IndexedDB, OPFS e o canal de comandos.

**Documento também é mídia.** PDF, PowerPoint (`.pptx`) e Google Apresentações
entram pelo mesmo "Importar arquivos" (ou pelo compartilhamento) e viram uma
imagem por página — daí para a frente têm o fade, a cortina, o telão e os
botões ⏮/⏭ passando página, como qualquer outro item. Não há botão nem fluxo
separado para apresentação: é um arquivo como os outros.

## Instalar

1. Baixe o `.apk` mais recente em **[Releases](../../releases)** (link direto,
   instala pelo Chrome do celular) ou pelos *Artifacts* de uma execução do
   workflow **Build APK**.
2. Autorize "instalar apps de fontes desconhecidas" quando o Android pedir.
3. Conecte a TV (Smart View / MiraScreen / cabo USB-C→HDMI) e abra o app: o
   telão é detectado sozinho.

Sem TV conectada, o app funciona igual ao PWA: a preview do Controle em tela
cheia vira a projeção.

## Compilar

```bash
./gradlew assembleDebug     # exige Android SDK instalado
```

No CI, cada push gera um APK automaticamente; uma tag `v*` publica uma Release.

## Documentação

- [`CLAUDE.md`](CLAUDE.md) — arquitetura do shell nativo, a ponte `AVNative`,
  invariantes e as divergências entre o caminho web e o nativo.
- [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) — arquitetura completa
  da base web (`app/src/main/assets/web/`).
- [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md) —
  referência do banco público usado para hinos, álbuns e Bíblia.
