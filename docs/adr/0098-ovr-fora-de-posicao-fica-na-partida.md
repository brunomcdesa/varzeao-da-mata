# 0098 — O OVR de quem joga fora de posição fica na Partida

- Status: aceito (aprovado pelo dono em 23/11/2026)
- Data: 2026-11-21

## Contexto

Pela ADR-0044, quem joga fora de posição joga a Partida com o OVR da vaga: as Habilidades são as dele, com os pesos da Posição da vaga. Um meia de OVR 65 que cobre uma vaga de zagueiro, por exemplo, joga com OVR 47.

O job `partida` gravava esse OVR da vaga como o OVR do Jogador. As Habilidades ficavam certas, mas o card e o gráfico "OVR jogo a jogo" mostravam a queda (65 → 47) como se ele tivesse jogado mal. O número voltava sozinho no próximo jogo na Posição dele, porque a simulação recalcula o OVR a partir das Habilidades.

A simulação não usa o OVR gravado: Duelos, evolução e Nota partem das Habilidades. O único efeito além da exibição é a Transferência com troca de posição (ADR-0030), que mantém o OVR e refaz as Habilidades a partir dele. Quem trocou de posição enquanto estava com o OVR da vaga ficou com Habilidades mais baixas.

## Decisão

1. Depois da Partida, o Jogador fica com o OVR das Habilidades novas com os pesos da **Posição dele**. O OVR da vaga continua na Escalação (`ovr_antes` e `ovr_depois`), porque é com ele que o Jogador jogou.
2. O gráfico "OVR jogo a jogo" e a lista de jogos do Jogador mostram o OVR na Posição dele, também nos jogos fora de posição já jogados.
3. Manutenção `corrigir-ovr-fora-de-posicao`: quem ainda está com o OVR da vaga volta ao da Posição dele. As Habilidades não mudam. O mesmo comando lista, sem mudar nada, quem trocou de posição logo depois de um jogo fora de posição, com o OVR certo. O ajuste desses casos é decisão do dono (OVR à mão, ADR-0079).

Não muda a simulação: a VERSAO_SIM continua a mesma e as Partidas já jogadas não mudam.
