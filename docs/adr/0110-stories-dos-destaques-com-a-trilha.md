# 0110 — Stories dos destaques com a trilha dos Reels

- Status: aceito (prévia aprovada pelo dono em 24/11/2026)
- Data: 2026-11-24

## Contexto

Os Stories dos destaques do perfil (ADR-0109) eram imagens paradas. O dono quis a mesma música dos Reels. No Instagram, música só entra pelo sticker de Música, que não tem a trilha da Liga, e conta Comercial só vê a biblioteca livre de direitos.

## Decisão

1. Com `pnpm --filter @liga/renderer destaques-do-perfil <pasta> --video`, cada Story sai em MP4 (1080 × 1920, H.264 + AAC) de 15 s: a imagem parada com a trilha chiptune dos Reels (ADR-0008).
2. A trilha é o tema completo das cartelas (`trilha` com intensidade 1), gerado pelo mesmo código, a 60% do volume, com entrada de 0,3 s e saída de 0,8 s (`trilhaDoStory`).
3. 15 s são duas voltas inteiras do tema (4 compassos a 128 BPM = 7,5 s), tempo para ler os Stories mais cheios.
4. As capas continuam em PNG. Sem `--video`, os Stories saem em JPEG como antes.

## Consequências

- Música própria: sem risco de áudio silenciado, mesmo em conta Comercial.
- Os Stories precisam de ffmpeg para gerar, como os Reels.
