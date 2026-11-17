# 0078 — Capitão à mão e OVR à mão

- Status: proposto (aguarda aprovação do dono)
- Data: 2026-11-17

## Contexto

O Capitão é sempre quem tem mais Partidas pelo Time (ADR-0020), e o OVR só muda pelas Habilidades nas Partidas. O dono quer poder escolher o Capitão de um Time e acertar o OVR de um Jogador sem mexer no banco à mão.

## Decisão

Dois workflows manuais (Actions → Run workflow), no molde do `mover-jogador` e do `recompensa-t1`. Os dois começam com "gravar" desmarcado: a primeira rodada é a simulação e só mostra no log o antes e o depois.

### Capitão à mão (workflow `capitao`, `pnpm liga capitao`)

1. Com o @, o Jogador vai para a frente da ordem da faixa do Time dele, na frente de quem tem mais Partidas.
2. Vale em toda Partida do Time até o dono tirar (o mesmo workflow, sem @ e com o Time) ou até o Jogador mudar de Time (Transferência, `mover-jogador` ou Rebalanceamento). Se ele voltar ao Time depois, a faixa à mão não volta.
3. Um por Time: escolher outro substitui o anterior.
4. Suspenso ou sem Vínculo num jogo, a faixa segue a regra de sempre naquele jogo (o próximo da ordem). No jogo seguinte, ele volta a ser o Capitão.

### OVR à mão (workflow `ovr`, `pnpm liga ovr`)

1. Todas as Habilidades sobem ou descem na mesma proporção até o OVR (arredondado) dar o número pedido. O perfil do Jogador continua o mesmo; o acerto fino do arredondamento fica na Habilidade principal da Posição.
2. Habilidades ficam entre 1 e 99. OVR fora de 1 a 99, ou que não cabe nesses limites, é recusado.
3. Depois disso, o Jogador evolui normalmente nas Partidas: o OVR não fica travado.
4. Vale a partir da próxima Escalação. Partidas já jogadas não mudam.

## Considered Options

- **Capitão só na próxima Partida, ou até o fim da Temporada:** rejeitadas pelo dono; ficou "fixo até tirar".
- **Capitão forçado leva a faixa mesmo suspenso ou sem Vínculo:** rejeitada; deixaria o Time sem escolha de Postura e Formação.
- **OVR subindo só a Habilidade principal (como o Piso, ADR-0047):** rejeitada; num ajuste grande deforma o Jogador.
- **OVR travado:** rejeitada; tiraria a evolução pelas Partidas.

## Consequences

- Migração 024: tabelas `capitao_a_mao` (um por Time) e `ovr_a_mao` (histórico de cada ajuste, com Habilidades antes e depois).
- `ordemDoCapitao` põe o Capitão à mão na frente; o resto da regra (suspensão, Vínculo, Capitão em campo) não muda.
- Com "gravar", os workflows rodam a coleta para republicar o site.
- Não muda a simulação: a VERSAO_SIM continua a mesma.
