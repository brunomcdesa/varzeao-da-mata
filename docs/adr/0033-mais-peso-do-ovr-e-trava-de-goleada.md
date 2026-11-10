# Mais peso do OVR e trava de goleada

A Habilidade passa a pesar mais em cada Duelo (`forcaHabilidade` 0,35; era 0,20) e o Time que abre 2 gols ou mais de vantagem tira o pé (trava de goleada). Vale para as duas Temporadas a partir do próximo jogo escalado. Partidas já jogadas não mudam.

Motivo: o dono quer que o OVR decida mais que a sorte. A ideia inicial era "80% OVR, 20% sorte". Esse número não existe no motor: cada Duelo anda numa curva conforme a diferença de Habilidade. A decisão foi tomada pela medição com os Elencos reais.

## Versões

- Regras da Temporada 1: `VERSAO_SIM_T1` vai de 7 para 9. A trava da T1 (`test/regressao-t1.json`) foi refeita com a versão 9.
- Regras da Temporada 2: `VERSAO_SIM` vai de 8 para 10.

## A trava de goleada

Quando o Time que ataca tem `travaDesde` (2) gols de vantagem ou mais, cada gol de vantagem a partir daí tira `travaPasso` (0,06) da base da criação, do drible e do chute marcado: −0,06 com 2 gols de vantagem, −0,12 com 3, e assim por diante. Bola parada (escanteio, falta, pênalti) não muda. Quem está perdendo ataca normalmente.

## Medições

Times de OVR igual em todos os lugares, 8 mil Partidas por linha, regras da Temporada 1 (a versão 7 é a anterior):

| | Versão 7 | Versão 9 |
|---|---|---|
| Gols por jogo (70 × 70) | 3,1 | 3,0 |
| Goleada entre iguais | 9% | 7% |
| +10 de OVR (75 × 65): forte vence | 60% | 72% |
| +15 de OVR (80 × 65): forte vence | 70% | 84% |
| +25 de OVR (85 × 60): forte vence | 85% | 96% |
| Goleada com +10 de OVR | 14% | 17% |
| Goleada com +15 de OVR | 20% | 29% |

Com as regras da Temporada 2 (versão 8 → 10): gols por jogo 3,5 → 3,4; Goleada entre iguais 12% → 9%; +15 de OVR vence 70% → 85%.

Com os Elencos reais de 10/11/2026 (escalação provável dos 8 Times, todos contra todos, 28 mil Partidas por linha). A força dos Times ia de 58 a cerca de 67, e a diferença vinha quase toda de vagas com Jogador da Base. Os dados vieram do `jogadores.json` público, então são aproximados:

| Peso da Habilidade | Favorito vence | Zebra | Com 5+ de diferença de OVR: favorito / zebra | Goleada |
|---|---|---|---|---|
| 0,20, sem trava (versão 7) | 45% | 32% | 52% / 25% | 10% |
| 0,30 com trava | 48% | 29% | 60% / 20% | 9% |
| 0,35 com trava (escolhido) | 50% | 28% | 64% / 17% | 9% |
| 0,50 com trava | 54% | 24% | 73% / 11% | 11% |

## O que mais mudou

- **Nota da Partida:** as retas de expectativa foram recalculadas por `pnpm calibrar` (o mais forte agora contribui mais, então se espera mais dele).
- **Ações (ADR-0010):** não mudaram. Entre Times iguais, cada Habilidade continua perto de zero por Partida (a maior variação medida foi −0,15 na Defesa do meia com OVR 70).
- **Metas:** a do ADR-0004/0027 ("+15 de OVR vence 68–72%") passa a ser 82–87%. A zebra fica para as diferenças pequenas: com +10 de OVR, o mais forte ainda perde ou empata 28% das vezes.
- **Correção:** com três expulsos no mesmo Time (regras da T2), a Partida quebrava por falta de zagueiros ou meias. Agora os atacantes recuam. Só muda Partidas que antes não terminavam.

## Considered Options

- **0,50 (o "80/20" de verdade):** rejeitada. Com 10 pontos de diferença o jogo já sai decidido, e o Tamanduá (5 vagas com Jogador da Base) cairia de 1,08 para 0,67 ponto por jogo.
- **0,30:** efeito pequeno demais com as diferenças reais (favorito de 45% para 48%).
- **Subir o Jogador da Base de 55 para 58:** rejeitada pelo dono. A vaga vazia pesar mais é incentivo para chamar gente para o Time.
- **Sem trava:** com 0,35 e as regras da T2, metade dos jogos com +15 de OVR terminava com 3 gols ou mais de diferença.
- **Trava a partir de 3 gols:** segura menos (Goleada de 9% com passo 0,15, contra 8% com a trava a partir de 2 e passo 0,06) e muda o jogo de forma mais brusca.

## Consequences

- Time com vagas vazias perde mais. Com os Elencos de hoje, o Tamanduá vai de 1,08 para 0,85 ponto por jogo e a Onça de 1,20 para 1,07.
- Bola de neve: quem vence joga melhor e evolui. A Nota relativa ao OVR e o ritmo de ganho (ADR-0010) seguram isso, mas vale medir de novo no fim da Temporada.
- Pendência que continua (ADR-0027): a calibração das Ações com as regras da T2.
