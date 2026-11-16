# Quem se inscreve no Mata-mata estreia na próxima Temporada

Antes, a Inscrição valia para a próxima Partida do Time em qualquer fase. No Mata-mata isso
não fazia sentido: o novato chega com 0 jogos, fica no topo do rodízio e pode estrear numa
Semifinal ou na Final, passando à frente de quem jogou a Fase de Liga toda.

## A regra

No Mata-mata, só é escalado quem **já podia jogar o último jogo do Time na Fase de Liga**, ou
seja, quem se inscreveu até o Corte desse jogo (`fimDaInscricaoNoMataMata`). Não importa se ele
foi escalado nesse jogo ou ficou fora pelo rodízio: estava no Elenco, joga o Mata-mata.

- O limite é o último jogo **de cada Time**, não o último jogo da Liga.
- A Inscrição continua aberta: a pessoa entra no Elenco, recebe a resposta e aparece no site.
  Ela só não entra nas Escalações do Mata-mata e estreia na próxima Temporada.
- Na Fase de Liga nada muda: vale o Corte da Partida.

## Por que não sobe a versão da simulação

A regra mexe na Escalação, não na simulação. Escalações já feitas continuam como estão; vale
a partir da próxima Partida escalada.

## No site

A Escalação provável e a Força do Time seguem a mesma regra: quando o próximo jogo do Time é do
Mata-mata (ou ele venceu a Semifinal e a Final ainda não foi criada), quem se inscreveu depois
do Corte do último jogo dele na Fase de Liga sai da conta (`inscritosAteNoProximoJogo`, no
shared). No Elenco, essas pessoas ganham o selo "estreia na T2" e uma linha embaixo do campinho
explica por quê. O "Quer jogar?" também avisa que, durante o Mata-mata, quem entra estreia na
próxima Temporada. O Corte (`CORTE_MINUTOS`) passou a morar no shared, para o site e a
Escalação usarem o mesmo número.
