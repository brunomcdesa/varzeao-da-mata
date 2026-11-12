# 0044 — Formação

## Contexto
Na Temporada 2 o Capitão já escolhe a Postura (ADR-0020). Todos os Times jogavam no mesmo desenho, 2-2-2 (goleiro, 2 zagueiros, 2 meias, 2 atacantes), e a Escalação tinha vagas fixas por Posição. A ideia é o Capitão também escolher o desenho, com as formações mais usadas no futebol 7, sem que nenhuma seja melhor que as outras.

## Decisão
- **Formações**: 2-2-2 (padrão), 2-3-1, 3-2-1 e 3-1-2. O Capitão escolhe pelo site junto da Postura, com a mesma regra: só ele, até o Corte, e a escolha fica valendo para a Partida inteira. Sem escolha, 2-2-2. Só na Temporada 2.
- **Vagas**: a Escalação segue as vagas da Formação, pela fila de cada Posição (rodízio de sempre). Vaga sem ninguém da Posição: entra quem sobrou de outra Posição, **fora de posição**, pela Posição vizinha primeiro (zagueiro ← meia ← atacante; meia ← zagueiro ← atacante; atacante ← meia ← zagueiro). O OVR dele na Partida sai pelos pesos da vaga (as Habilidades são as dele) e ele joga sem Especialização. Goleiro só joga no gol, e ninguém de linha vai para o gol. Sem ninguém, Jogador da Base. Vale também no 2-2-2 da T2.
- **Corte da Formação**: quem teria entrado no 2-2-2 e ficou fora pela Formação escolhida ganha **prioridade no rodízio** no jogo seguinte do Time, no mesmo nível da Presença.
- **Limite por Posição** continua 2 goleiros e 4 por Posição (14 por Time).
- **Jogada da Formação** (sorteio próprio; o 2-2-2 sai igual à VERSAO_SIM 10):
  - 2-3-1, **Tabela**: em 35% dos ataques o criador tabela com outro meia (+0,07 na criação); com três meias, um deles finaliza mais (chute de fora). Custo: +0,04 para quem ataca contra ele.
  - 3-2-1, **Cobertura**: um dos três zagueiros fica na sobra; quando o atacante dribla o marcador, em 70% das vezes a sobra chega para mais um Duelo (Drible × Defesa, base 0,55). Custo: −0,05 no ataque.
  - 3-1-2, **Ligação direta**: em 35% dos ataques (fora do contra-ataque) um zagueiro lança direto: o lançamento é um Duelo Passe × Defesa (base 0,62) contra o 1º zagueiro rival, só atacante finaliza, e o 2 contra 1 soma +0,12 contra o marcador. Interceptado é desarme (nunca falta). Custo: −0,01 na posse.
- **Postura e Formação somam**, com limite de ±0,06 no lado de quem ataca e no de quem defende.
- **Equilíbrio**: entre Times iguais, nenhuma Formação ganha mais de ~3 pontos percentuais de vitória a mais que outra (script `packages/sim/scripts/formacoes.ts`, com teste). O 3-2-1 deixa o jogo mais travado, o 2-3-1 mais aberto.
- **No vídeo**: três numa linha abrem e o do meio fica um pouco atrás; um sozinho fica no meio. A Tabela mostra o toque e volta com o apoio, a Ligação direta mostra o zagueiro lançando lá de trás (e o corte no ar quando interceptada), e a Cobertura mostra o zagueiro da sobra chegando depois do drible. O Narrador diz o nome da jogada (ele só comenta o que aparece na tela).
- **Banco**: quando a Substituição da T2 for feita, o Banco são os 2 primeiros da fila (só linha), e o reserva entra na vaga de quem saiu (fora de posição, se for de outra).
- Simulação na **VERSAO_SIM 11**; vale a partir da próxima Partida escalada.

## Consequências
- Migração 016: `postura.formacao`, `escalacao.posicao_de_origem` e a tabela `corte_da_formacao`.
- A escolha do Capitão muda quem joga mais: numa Formação com 1 atacante, os atacantes do Time revezam uma vaga só (o corte dá prioridade no jogo seguinte).
- Times com muita gente numa Posição e pouca em outra passam a pôr inscritos em campo fora de posição em vez do Jogador da Base.
