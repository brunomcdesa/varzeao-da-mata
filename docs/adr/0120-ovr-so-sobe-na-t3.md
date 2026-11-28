# ADR-0120: Na T3, o OVR só sobe

**Status:** aceito (28/11/2026)

## Contexto

O ADR-0105 (Ações principais protegem) registrou a decisão do dono, de 23/11/2026: "na T3 a queda
de OVR sai de vez (ADR próprio quando a T3 for montada)". A T3 foi montada sem essa mudança: a
evolução das Habilidades (ADR-0010) continuava somando ações negativas, só amortecidas pela
Proteção da T2. A falta foi achada no sábado 28/11, antes do primeiro jogo da T3 (Copa, segunda
30/11, 11h).

## Decisão

- **Da T3 em diante, Habilidade não desce por Partida.** O saldo negativo de pontos de ação de uma
  Habilidade na Partida é descartado; o saldo positivo segue a regra de sempre (ritmo, teto por
  Partida, Clássico, Treino, Resenha, Ganho maior da T2). Como o OVR é calculado das Habilidades, o
  OVR também não cai.
- **Vale para todo jogo da T3:** Fase de Liga, Mata-mata, Copa e (na T4) Supercopa.
- **Fica igual:** a Proteção (ADR-0105) continua calculada, mas não tem mais efeito; o OVR à mão do
  dono (ADR-0079) pode descer; o OVR da vaga de quem joga fora de posição (ADR-0098) continua
  sendo só da Partida.
- **Implementação:** `evoluir(..., { semQueda })` em `packages/sim/src/evolucao.ts`, ligado quando a
  Partida tem as regras da T3 (`entrada.t3`). A VERSAO_SIM_T3 não muda porque nenhuma Partida da T3
  foi jogada antes da mudança.

## Consequências

- Os Jogadores só acumulam: a média de OVR da Liga sobe mais rápido que na T2. O ritmo (quem está
  alto sobe devagar) continua sendo o freio.
- Textos que dizem que o OVR "sobe e desce" (Reels de Explicação do OVR da T2, glossário) ficam
  históricos ou são atualizados.
