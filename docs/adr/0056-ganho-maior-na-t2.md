# 0056 — Ganho maior na T2 e Piso da Temporada 1 em 65

- Status: proposto (aguarda aprovação do dono)
- Data: 2026-11-14
- Muda o ADR-0010 (ritmo, só na T2) e o ADR-0047 (Piso de 63 para 65)

## Contexto

Cada Temporada tem poucos jogos (cerca de 10 por Jogador). Com o ritmo do ADR-0010, quase todo Jogador termina a Temporada a 2 ou 3 pontos do OVR com que começou, e ninguém passava de 72. O dono quer que a evolução apareça mais rápido, sem desequilibrar os Times.

## Decisão

Com as regras da T2:

- **Ganho maior:** os ganhos de Habilidade de todo Jogador valem 1,5 vez (`multiplicadorGanho`). As perdas não mudam. Soma com a Resenha e o Bônus da T1, do mesmo jeito que eles somam entre si (1,5 e 1,5 viram 2). O limite por Partida continua: ±2, ou ±4 no Clássico.
- **O ganho encolhe só a partir de 70** (`referenciaGanho`; na T1, 62). Até 70, cada ação rende o valor cheio. Acima disso, encolhe até o teto de 99, como antes.
- **Piso da Temporada 1 em 65** (era 63, ADR-0047).
- Simulação na **VERSAO_SIM 16**. A T1 continua na VERSAO_SIM_T1 12, e nenhuma Partida já jogada muda. Placar, lances e Nota não mudam.

## Medições

300 Ligas simuladas: 8 Times de 7, OVR inicial sorteado entre 60 e 70 (média 65, desvio 3,2), 10 jogos por Temporada, regras da T2 (2-2-2, Equilibrada). Os números são do fim da T3 (duas Temporadas).

| | Média da Liga | Desvio | Maior OVR | Com OVR 75 ou mais | Distância entre o Time mais forte e o mais fraco |
|---|---|---|---|---|---|
| Como era | 65,3 | 4,8 | 76 | 3% | 5,8 |
| ×1,5 | 67,1 | 5,4 | 80 | 9% | 6,5 |
| **×1,5, encolhe a partir de 70 (escolhido)** | 67,9 | 5,9 | 81 | 14% | 7,1 |
| ×1,5, encolhe a partir de 75 | 68,2 | 6,3 | 83 | 16% | 7,6 |
| ×2 | 68,5 | 5,7 | 82 | 15% | 6,9 |

Entre Times iguais (OVR 65), a Habilidade principal de cada Posição passa a subir um pouco por Partida em todas as Posições, por igual (teste "Ganho maior").

## Considered Options

- **Só ×1,5, encolhendo a partir de 62:** distância menor entre os Times (6,5). O dono preferiu que os bons chegassem mais longe.
- **Encolher a partir de 75 ou 80:** ajuda mais quem já é forte e vence; a distância entre os Times passa de 7,5.
- **×2:** a Liga sobe cerca de 2 pontos por Temporada.
- **Teto de OVR (por exemplo, 80):** não foi preciso. Com essa combinação, o maior OVR fica perto de 80 depois de duas Temporadas.

## Consequences

- A Liga sobe cerca de 1,5 ponto de OVR por Temporada, e o Jogador da Base (55) fica mais longe. É de propósito: a vaga vazia é o incentivo para chamar gente (ADR-0033).
- A distância entre os Times cresce sozinha de uma Temporada para a outra (bola de neve). Com esta mudança, ela cresce cerca de 1 ponto a mais em duas Temporadas. Vale medir de novo no fim da T2.
- O Reels de agradecimento da T1 e a legenda dele passam a dizer 65 (eles leem `PISO_DA_TEMPORADA_1`).
