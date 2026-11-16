# Substituição no intervalo

Numerado antes como 0059 e 0060 no branch; renumerado porque o 0059 ficou com o apelido em toda fala e o 0060 com a Estrela de Título.

Status: decidido em 16/11/2026, para valer desde a estreia da T2. Só nas Partidas da T2 em diante.

## Banco

Todos que sobraram da Escalação ficam no Banco, inclusive goleiros, na ordem da fila do
rodízio (Craque, prioridades, quem jogou menos). Ficam na tabela `escalacao`, nos lugares
depois dos titulares (7 em diante), com `reserva = true`.

## Quem sai e quem entra

- Só no intervalo, antes do primeiro lance do 2º tempo.
- Sai quem tem Nota parcial abaixo de 5 no 1º tempo, até 2 por Time, piores primeiro. Nunca o
  lugar de um expulso (a expulsão não é compensada). Sem ninguém abaixo de 5, não há troca.
- Entra o primeiro reserva da mesma Posição. Goleiro só sai para outro goleiro: sem goleiro no
  Banco, ele fica em campo. Um de linha, sem reserva da mesma Posição, pode ser trocado pelo
  primeiro reserva de linha de outra Posição, fora de posição, com o OVR da vaga e sem a
  Especialização (como na Formação, ADR-0044). O goleiro reserva nunca entra na linha.
- Não usa sorteio: a Partida sem troca sai igual à de antes. Com o Banco cheio, cerca de 40%
  dos jogos têm troca (0,64 por jogo, 0,24 de goleiro), sem mudar a média de gols nem a chance
  de vitória.

## Números de cada um

- Quem saiu e quem entrou têm cada um o seu desempenho, no mesmo lugar em campo
  (`substituicao`: SAIU ou ENTROU). A Nota de cada um conta só a parte do jogo em que esteve em
  campo. A evolução segue pelas ações de cada um.
- O reserva que entrou conta jogo (rodízio, Capitão, Craque). Quem ficou no Banco sem entrar
  não conta jogo. Não ganha prioridade própria: com o Banco tendo todos que sobraram, isso
  viraria uma alternância jogo sim, jogo não. O rodízio (quem jogou menos) e o Limite de
  Partidas Fora (ADR-0043) já cuidam de quem ficou de fora.
- Cartões ficam com quem levou: o reserva não herda o amarelo de quem saiu.
- O "decisivo" (Rei do Clássico) passa a vir pelo Jogador (`decisivoJogadorId`), porque o
  lugar pode ter tido dois.
- Os gols dos Candidatos no Resumo passam a sair dos desempenhos, e não dos lances pelo lugar.

## Na tela

- No Reels, um trecho próprio antes do 2º tempo; no Ao Vivo, aos 45'. O Juiz levanta a placa
  (seta verde e vermelha), quem sai caminha para a lateral e o reserva entra correndo, sempre
  pela lateral da torcida do próprio Time (mandante à esquerda, visitante à direita), para não
  parecer que foi para o outro Time.
- Letreiro "Substituição" com quem sai (▼) e quem entra (▲), pelo nome escrito do jogo.
- O Narrador fala pela Posição e pelo Time, nunca pelo @: "Mexida no Tatu! Sai o zagueiro,
  entra o meia." Fora de posição: "entra o atacante, pra jogar de meia".
- O site mostra o Banco embaixo da Escalação: quem entrou (no lugar de quem, e se jogou fora de
  posição), quem não entrou, e "saiu no intervalo" em quem deixou o campo.

## Simulação

`VERSAO_SIM` 17. Vale a partir do próximo jogo escalado; Partidas já jogadas não mudam.
