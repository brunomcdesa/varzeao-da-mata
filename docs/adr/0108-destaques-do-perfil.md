# 0108 — Destaques do perfil do Instagram

- Status: aceito (prévia aprovada pelo dono em 24/11/2026)
- Data: 2026-11-24

## Contexto

O perfil tinha um único destaque, "Novidades", com capa ilegível (um pedaço do campo) e Stories que eram Reels compartilhados: no Story aparece só a cartela de título parada. Quem chegava ao perfil não achava como entrar, como o jogo funciona nem onde ver os jogos.

## Decisão

1. Seis Destaques, nesta ordem: Como entrar, Como funciona, Site e App, Times, Perfis dos Times e Campeões. O destaque Novidades sai do perfil: o que ele contava está nos outros, e as novidades seguem nos Reels.
2. Cada destaque tem uma capa própria (PNG 1080 × 1080, ícone em pixel art num anel dourado, legível no círculo) e Stories estáticos (JPEG 1080 × 1920) no estilo dos Reels: Como entrar (4), Como funciona (4), Site e App (3), Times (4: os dois Grupos e os Clássicos de cada um), Perfis dos Times (3) e Campeões (1 por Temporada).
3. O conteúdo fica entre a barra do Story e a caixa de resposta (linhas 70 a 405 da tela de 270 × 480). Sem rodapé com o @: o Story já mostra o perfil.
4. Os textos vêm das regras do código e dos Reels já aprovados. Um teste no worker confere que o exemplo de Inscrição, cada jeito de escrever a Posição e o nome de cada Time no Story são entendidos pelo leitor de comentários.
5. `pnpm --filter @liga/renderer destaques-do-perfil <pasta> [--campeao TIME --temporada N --craque nome]` gera tudo. Os campeões ficam na lista `CAMPEOES` (T1: Onça). A capa de Campeões é a taça; dentro do destaque, o Story do campeão de cada Temporada.
6. A API do Instagram não cria destaques nem troca capas: o dono posta os Stories, põe cada um no seu destaque e troca a capa pelo app.

## Consequências

- Quando a regra mudar (horários, Grupos da T3, Séries), os Stories precisam ser gerados e trocados de novo. Os de Times são da Temporada 2.
- Perfis dos Times mostra os perfis de exemplo do ADR-0100; a lista é atualizada à mão.
