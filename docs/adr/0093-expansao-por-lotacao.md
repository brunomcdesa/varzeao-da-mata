# 0093 — Expansão por lotação: 10 Times por Série

- Status: aceito
- Data: 2026-11-20

## Contexto

Com o Limite por Posição (2 goleiros e 4 por posição, ADR-0080), cada Time tem 14 vagas, e os 16 Times da T3 somam 224. Se a Liga lotar, quem quiser entrar não terá Time nem Posição. A ideia é crescer só se a procura justificar.

## Decisão

- **Gatilho:** 90% das vagas ocupadas (cerca de 202 de 224 Jogadores) no fim da Fase de Liga. Conferido no fim de toda Temporada, a partir da T3; a expansão vale para a Temporada seguinte e é anunciada no Resumo da Temporada.
- **Como cresce:** entram 4 Times novos na Série B (nomes e temas a definir quando acontecer). Naquela virada ninguém cai da A e 2 sobem da B, e as duas Séries ficam com 10 Times. Depois, volta o 2 sobem e 2 descem.
- **Clássicos dos novos:** dois para cada Time, em quadrado entre eles (Novo1×Novo2 e Novo3×Novo4 como primeiros; Novo1×Novo3 e Novo2×Novo4 como segundos). Nenhum Time antigo ganha Clássico novo.
- **Elencos:** as novas Inscrições vão primeiro para os Times novos, respeitando o Limite por Posição. Veteranos podem trocar de graça para um Time novo na Janela, e quem começa num Time novo ganha o título de Fundador. Ninguém é remanejado à força.
- **Calendário:** turno único de 9 Rodadas por Série, 10 jogos por dia, um por hora das 9h às 18h.
- **Copa com 20 Times** (continua em 3 dias):
  - dia 1, Fase do Clássico: os 10 primeiros Clássicos (os 8 segundos Clássicos do ADR-0066 e os 2 primeiros pares dos novos);
  - dia 2, Repescagem e Quartas: os 4 vencedores com pior campanha na Temporada anterior (Time novo conta como o pior) fazem 2 jogos, e os 2 vencedores se juntam aos outros 6 nas Quartas, no mesmo dia;
  - dia 3, Semifinais e Final.

## Considered Options

- **Só 2 Times novos:** rejeitada. Com ninguém caindo e 2 subindo, a A ficaria com 10 e a B com 8.
- **Os 8 Times guardados (Quati, Gambá etc.):** rejeitada. O dono prefere Times novos, definidos na hora.
- **Rebalanceamento forçado, como na T2:** rejeitada. Mexe em quem não pediu.
- **Dois Grupos de 5 por Série:** rejeitada. Cada Time jogaria pouco.
- **Copa só com 16:** rejeitada. Deixaria 4 Times de fora.

## Consequências

- A Temporada passa de cerca de 9 para cerca de 11 dias, mais os 3 da Copa.
- 10 jogos por dia aumentam o uso diário da voz do Gemini em cerca de 25%; antes de implementar, é preciso conferir se o cache de falas mantém o uso dentro da cota.
- Os 8 Times guardados continuam guardados.
