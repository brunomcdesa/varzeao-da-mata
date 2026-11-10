# Resenha: comentar no Reels do jogo faz o Jogador evoluir mais rápido

O Jogador que comentou no Reels do último jogo do próprio Time entra na Partida seguinte com Resenha: os ganhos de Habilidade dele naquela Partida valem 50% a mais (`multiplicadorResenha` 1,5). Vale nas duas Temporadas, a partir da próxima Escalação.

Motivo: o dono quer premiar quem interage com os Reels, e já nesta Temporada.

## Regras

- **Qual Reels:** o da Partida mais recente do Time que já foi ao ar no Instagram, antes da Partida que está sendo escalada.
- **Qual comentário:** qualquer um, feito pela conta do Jogador (pelo id do Instagram, então trocar de @ não atrapalha), até o Corte da Partida. Um comentário basta, e mais comentários não dão mais bônus.
- **O bônus:** só os ganhos sobem; as perdas ficam iguais. O limite por Partida (2 pontos por Habilidade, 4 no Clássico) continua. Com Treino (T2), os dois bônus somam na Habilidade de foco (dobro).
- **Só vale para quem é escalado.** Quem comentou e ficou fora do rodízio não guarda o bônus.
- A Escalação guarda quem tinha Resenha (`escalacao.resenha`), então o Replay e o histórico não mudam depois.

## Considered Options

- **Bônus por curtida:** impossível. A API do Instagram só devolve a contagem de curtidas, não quem curtiu.
- **OVR direto por comentário:** rejeitada. Infla o OVR sem jogar, favorece Times com mais gente ativa e incentiva spam (mesmo motivo do "+1 fixo" rejeitado no ADR-0023).
- **Moral (+2 na Habilidade principal só no próximo jogo):** oferecida, o dono preferiu a evolução mais rápida.
- **Contar comentários em qualquer post:** rejeitada. O objetivo é movimentar o Reels do jogo do Time.

## Consequences

- Não muda nenhum lance: a Partida de quem tem Resenha é a mesma, só a evolução depois dela muda. Entra junto com a versão 9/10 da simulação (ADR-0032).
- Quem sempre comenta evolui mais rápido que quem não comenta. O limite por Partida e o ritmo de ganho (perto de 99 o ganho encolhe) seguram o exagero.
- O bônus depende de a coleta ter lido o comentário antes da Escalação. A coleta do job `partida` roda logo depois do Corte e lê os posts do último dia.
- Ainda não aparece no site nem no Reels. Mostrar a Resenha no painel do personagem ou na Partida é mudança visual e precisa de prévia.
