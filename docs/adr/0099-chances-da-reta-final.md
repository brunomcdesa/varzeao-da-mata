# 0099 — Chances da reta final no Resumo da Rodada

- Status: aceito (aprovado pelo dono em 23/11/2026, com prévia; Fim da Fase de Liga e fala com todos os Times das zonas na mesma data)
- Data: 2026-11-23

## Contexto

Um seguidor pediu, pela DM, para o Resumo da Rodada mostrar "a matemática" de quem fica na A e quem vai para a B: as chances de cada Time, atualizadas conforme a Fase de Liga anda. Na T2, os 2 primeiros de cada Grupo vão às Semifinais e os 4 últimos caem (ADR-0064), então quase todo Time tem algo em jogo.

## Decisão

1. **Cartela "Chances"** no Reels do Resumo da Rodada, logo depois da Tabela, com duas colunas por Time: **Semi** (chance de terminar entre os que vão às Semifinais) e **Cai** (chance de terminar na zona de queda). Um bloco por Grupo na T2; da T3 em diante, um por Série (na B só a Semi, porque sobem os finalistas do Mata-mata); com Série única e ninguém caindo, só a Semi.
2. **Quando:** da metade da Fase de Liga (`ceil(Rodadas/2)`, a Rodada 4 de 7) até a penúltima Rodada. Na última, a cartela vira **Fim da Fase de Liga**: os mesmos blocos, só com os selos, e embaixo a regra ("2 primeiros: semifinal · 4 últimos: Série B").
3. **Conta:** os jogos que faltam são simulados 20 mil vezes, todo jogo com chances iguais e gols sorteados (Poisson) pela média de gols do Grupo ou da Série. A ordem usa os desempates de `classificar`. Semente fixa: o mesmo Resumo gravado de novo dá os mesmos números.
4. **Selos só com certeza de verdade:** **Na semi**, **Fora**, **Caiu** e **Salvo** saem da mesma conta exata da Briga pelo Mata-mata (ADR-0053), agora em `certezasNaTabela`, testando todos os resultados dos jogos que faltam (até 12 jogos; acima disso, sem selos). Sem certeza, o número nunca mostra 0% nem 100% ("<1%", ">99%").
5. **Narrador:** fala só o que está na tela. Em cada Grupo, todos os Times com mais chance de semifinal (tantos quantas são as vagas, 2) e todos com mais risco de cair (tantos quantos caem, 4), com a porcentagem ou "já garantido"/"que já caiu". No Fim da Fase de Liga, quem foi à semifinal e quem cai para a Série B, na ordem da tabela.
6. Vale já a partir do Resumo da Rodada 5 da T2 (23/11/2026).

## Considered Options

- **Pela Força do Time (OVR da escalação provável):** rejeitada; dá a impressão de previsão de quem é melhor. A "matemática" pura é mais fácil de explicar.
- **Só a coluna de Queda:** rejeitada; a Semifinal cabe na mesma cartela e interessa aos Times de cima.
- **Mostrar 0% e 100% sem selo:** rejeitada; um 0% que ainda pode acontecer seria um erro na tela.

## Consequences

- `@liga/shared`: `chancesDaTabela`, `resumoMostraChances`, `primeiraRodadaDasChances`, `porcentagem`, `textoDaSemifinal`, `textoDaQueda` (chances.ts); `certezasNaTabela` sai de `situacoesNaBriga` (briga.ts).
- Worker: `dadosDoResumo` ganha `chances` (`chancesDoResumo`). Renderer: cartela `CHANCES` e `falaDasChances`; prévia em `scripts/previa-chances.ts`.
- O Resumo fica cerca de 7 s mais longo nas Rodadas da reta final.
