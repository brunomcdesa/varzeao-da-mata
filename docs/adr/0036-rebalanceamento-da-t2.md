# Rebalanceamento da Temporada 2

Na Pré-temporada da T2, os Elencos são rebalanceados entre a Série A e a Série B para que todos os inscritos joguem. Com 92 Jogadores em 8 Times, cada Elenco tem cerca de 11 Jogadores para 7 lugares, e o rodízio deixa parte deles fora de cada Partida. Os 8 Times novos da Série B começariam só com Jogadores da Base.

Este ADR muda o ADR-0017 (os Times da T1 ficam na A **com os seus Jogadores**) e o ADR-0022 (a B se povoa só pela Janela voluntária).

## Regras

1. **Primeiro, voluntários.** A Janela de Transferências abre com prazo de 2 a 3 dias. Quem pede para ir para a B escolhe o Time, por ordem de pedido, respeitando a regra de equilíbrio (ADR-0012).
2. **Tamanho da A.** Cada Time da Série A fica com 7 ou 8 Jogadores. O resto vai para a B.
3. **Remanejamento, se faltarem voluntários.** Saem os inscritos mais recentes de cada Time da A, na Posição que o Time Primo precisa, até a A chegar ao tamanho da regra 2. Quem se inscreveu primeiro fica.
4. **Time Primo.** Cada Time da A tem um par fixo na B, e quem é remanejado vai para ele, na mesma Posição. Os Clássicos da A viram Clássicos da B, então as rivalidades se mantêm:

   | Série A | Time Primo na B |
   |---|---|
   | Capivara (CAP) | Sucuri (SUC) |
   | Onça (ONC) | Jacaré (JAC) |
   | Tatu (TAT) | Cachorro-do-mato (CDM) |
   | Tamanduá (TAM) | Lobo-guará (LOB) |
   | Preguiça (PRE) | Coruja (COR) |
   | Sagui (SAG) | Morcego (MOR) |
   | Tucano (TUC) | Boto (BOT) |
   | Arara Azul (ARA) | Pirarucu (PIR) |

   Se o Time Primo estiver cheio na Posição, o Jogador vai para o Time da B com mais vagas nela.
5. **A Carreira vai junto.** OVR, Habilidades, apelido e visual não mudam (ADR-0001).
6. **Fundador.** Quem começa a T2 num Time da B, por vontade própria ou remanejado, ganha o título de Fundador do Time na página de Carreira (ADR-0025).
7. **Escolha da camisa.** No Time novo, os Fundadores escolhem o número antes dos outros. Se o número atual estiver livre, ele é mantido.
8. **Volta grátis.** Na Janela seguinte, o Fundador pode voltar para qualquer Time com vaga sem gastar a Transferência da Temporada, como já vale para todos (ADR-0022).
9. **Aviso individual.** Cada remanejado recebe uma resposta explicando o motivo e o novo Time. O texto passa pela aprovação do dono antes de sair.

Motivo: na B, o Jogador joga todas as Partidas, com Reels próprio. A mudança é anunciada como "jogue todo jogo", e não como rebaixamento. Voluntários primeiro e um critério público e simples (ordem de Inscrição) reduzem a sensação de injustiça.

## Considered Options

- **Só a Janela voluntária (ADR-0022 como estava):** rejeitada. A A continuaria com rodízio pesado e a B com muitos Jogadores da Base.
- **Sorteio para escolher quem sai:** rejeitada. Pode tirar quem está desde a primeira hora, que costuma ser o mais apegado ao Time.
- **Sair quem tem menor OVR:** rejeitada. Soa como punição.
- **Divisão igual (cerca de 6 por Time):** rejeitada. A A passaria a ter mais Jogadores da Base do que hoje.
- **Destino livre entre os Times da B:** rejeitada. Espalha os Jogadores e quebra o laço com o Time antigo.

## Consequences

- É preciso um job de rebalanceamento que rode uma vez, ao fechar a Janela, com modo de simulação (lista quem sai e para onde) para o dono aprovar antes de gravar.
- A página de Carreira ganha o título de Fundador. É uma mudança visual e precisa de prévia.
- O número da camisa precisa de uma ordem de escolha na B durante a Pré-temporada.
- O Reels e o comentário de anúncio da Janela precisam de rascunho aprovado.
