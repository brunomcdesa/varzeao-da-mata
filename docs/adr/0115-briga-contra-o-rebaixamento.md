# Briga contra o Rebaixamento na última Rodada

Status: decidido em 25/11/2026. Com dúvida dupla (pode classificar e pode cair), o Mata-mata tem prioridade e a plaquinha segue o placar do momento. Complementa o ADR-0053.

Na última Rodada, as plaquinhas embaixo do placar só falavam do Mata-mata: quem já estava fora
ficava "Já eliminado" ou "Assim: fora", mesmo brigando para não cair. Na T2 caem 4 de cada Grupo
(ADR-0064), e o jogo entre dois Times da parte de baixo é justamente o mais tenso da Rodada.

## A regra: a mesma conta de "certo de verdade"

`situacoesNoRebaixamento` usa `certezasNaTabela` com as vagas de quem fica (Times da tabela menos
os que caem): **Salvo** (nenhum resultado o põe entre os que caem), **Rebaixado** (nenhum o tira)
ou ameaçado. `BrigaPeloMataMata.caem` diz quantos caem: 4 por Grupo na T2, 2 na Série A com Série
B e 0 na Série B e na T1 (`timesQueCaem`, as mesmas contas do Resumo e das Chances).

## De qual briga cada Time fala (`brigaDoTime`)

- Quem ainda briga pelo Mata-mata segue nele, como antes.
- Quem está fora do Mata-mata (antes do jogo, ou assim que o placar o tira) e ainda não está
  Salvo passa a falar do Rebaixamento.
- Quem está fora e Salvo segue "Já eliminado" / "Assim: fora".

## Na tela

- **Plaquinha:** "Já rebaixado"; no começo, "Empate salva", "Vencendo, se salva", "Vence e torce",
  "Risco de cair"; durante, "Assim: salvo / cai / ameaçado" (verde, vermelho, amarelo); no fim,
  "Salvo", "Rebaixado" ou "Ameaçado".
- **Jogo que só vale a permanência** (`valeAPermanencia`: nenhum dos dois briga pelo Mata-mata e
  pelo menos um pode cair): a capa troca "Vale a Semifinal" por "Vale a permanência" e
  "Já garantidos" por "Já rebaixados"; a viga diz "Caem os quatro últimos".
- **Fim do Reels:** "Tamanduá ameaçado · Sucuri rebaixada", "Onça salva!".

## O que o Narrador fala (só o que aparece na tela)

- Abertura do jogo que só vale a permanência: "valendo a permanência na Série A!".
- Quem está fora do Mata-mata e pode cair não "joga pela honra": "O Tamanduá está fora do
  Mata-mata e agora briga pra não cair!"; quem já caiu: "já está rebaixado, joga pela honra".
- Do que precisa, "se terminar assim" ("o Tamanduá ainda corre risco de cair, e a Sucuri cai pra
  Série B!") e o desfecho ("A Sucuri está rebaixada pra Série B.").

## Limite conhecido

A Expansão (ADR-0093) só é decidida no fim da Fase de Liga; numa Temporada em que ela acontece,
ninguém cai da A, mas a última Rodada ainda mostra a briga contra a queda (igual ao Resumo).

## Por que não sobe a versão da simulação

Nada disso mexe na simulação, só no desenho e na narração. Partidas já gravadas não mudam; vale a
partir da próxima Partida da última Rodada gravada.
