# 0102 — Badge dos Avisos: silhueta do símbolo

- Status: aceito (aprovado pelo dono em 23/11/2026)
- Data: 2026-11-23

## Contexto

Os Avisos do App (ADR-0042) usavam o escudo colorido (`icones/icone-192.png`) como `icon` e também como `badge`. No Android, o `badge` é o ícone pequeno: ele aparece no círculo da esquerda da notificação e na barra de status. O sistema usa só o canal alfa dessa imagem e ignora as cores. Como o escudo é um círculo sem nenhuma parte transparente, o badge aparecia como um círculo branco cheio.

Não dá para pôr o escudo colorido nesse lugar. No Android, a cor do ícone pequeno é escolhida pelo sistema.

## Decisão

1. O badge passa a ser `icones/badge-96.png`: a silhueta branca do símbolo (folhas + bola, com os gomos da bola e os veios das folhas vazados) em fundo transparente, 96×96. O dono escolheu essa versão, entre bola sozinha, folhas sozinhas e folhas + bola, por ser a mais fiel ao escudo.
2. A fonte do desenho fica em `docs/marca/badge.svg`, feita a partir de `docs/marca/simbolo.svg`.
3. O escudo colorido continua como `icon`, à direita da notificação.
4. Um teste garante que o badge não é o ícone do App e que é branco com fundo transparente.
