# 0055 — Pontos por ação da Temporada 2

- Status: proposto (aguarda aprovação do dono)
- Data: 2026-11-14
- Resolve a pendência dos ADRs 0027 e 0033

## Contexto

Os pontos por ação (ADR-0010) foram calibrados com as regras da T1, para que, entre Times iguais, cada Habilidade fique perto de zero por Partida. As regras da T2 mudam quantas vezes cada ação acontece. Parte dos desarmes vira falta (ADR-0024), a barreira bloqueia chutes e o meia é desarmado menos vezes na criação. Os ADRs 0027 e 0033 deixaram essa calibração pendente.

Medição antes desta mudança: 2-2-2 e Postura Equilibrada dos dois lados, 3 mil Partidas por linha. Os números são a variação média por Partida, T1 → T2.

| OVR 65 | T1 | T2 |
|---|---|---|
| Defesa do zagueiro | +0,09 | −0,18 |
| Passe do meia | +0,05 | +0,17 |
| Finalização do atacante | −0,02 | −0,11 |
| OVR do zagueiro | +0,06 | −0,15 |

Sem ajuste, o zagueiro perderia cerca de 2 pontos de OVR numa Temporada só por jogar, sem ter jogado mal.

## Decisão

Com as regras da T2, quatro ações valem pontos próprios (`ACOES_T2` em `sim/src/evolucao.ts`). As outras e todas as da T1 não mudam.

| Ação | T1 | T2 | Motivo |
|---|---|---|---|
| Desarme (Defesa) | +0,42 | +0,50 | parte dos cortes vira falta, e o desarme limpo fica mais raro |
| Falta cometida (Defesa) | −0,25 | 0 | a falta já custa ao Time (bola parada e cartão) |
| Desarmado na criação (Passe) | −0,30 | −0,36 | a falta na criação poupa o meia de parte dos desarmes |
| Chute bloqueado (Finalização) | −0,48 | −0,30 | a barreira bloqueia muitos chutes de falta |

Depois da mudança, com OVR 60, 65 e 70, a Habilidade principal de cada Posição varia na T2 até 0,04 a mais ou a menos do que na T1. No OVR 65: zagueiro +0,10, meia +0,05, atacante −0,03, goleiro +0,01.

- Simulação na **VERSAO_SIM 15**, a partir do próximo jogo escalado com as regras da T2. A T1 continua na VERSAO_SIM_T1 12, e nenhuma Partida já jogada muda.
- Placar, lances e Nota não mudam: os pontos por ação só mexem na evolução das Habilidades.
- `pnpm calibrar [N] t2` mede tudo com as regras da T2. O teste "pontos por ação da T2" trava a diferença para a T1 abaixo de 0,08 por Partida.

## Considered Options

- **Mudar os pontos nas duas Temporadas:** rejeitada. A T1 está em andamento, e o problema só existe com as regras da T2.
- **Falta valendo pontos positivos (+0,35), sem mexer no desarme:** rejeitada. Fecharia a conta, mas premiaria quem faz falta.
- **Corrigir pela Nota ou pelo ritmo de ganho:** rejeitada. Mexeria em todas as Posições para corrigir duas.

## Consequences

- A Postura e a Formação continuam mudando a evolução (2-2-2, OVR 65, variação de OVR por Partida). É um efeito da escolha do Capitão, não um erro de calibração:

  | Escolha dos dois Times | Zagueiro | Meia | Atacante |
  |---|---|---|---|
  | Ofensiva | −0,20 | +0,10 | +0,07 |
  | Defensiva | +0,27 | −0,04 | 0,00 |
  | 2-3-1 | −0,13 | +0,08 | +0,07 |
  | 3-2-1 | +0,15 | −0,07 | −0,06 |

- A Defesa do meia cai cerca de 0,2 por Partida nas duas Temporadas. Ela pesa 0,2 no OVR do meia, e o efeito no OVR fica perto de zero. Não muda aqui.
