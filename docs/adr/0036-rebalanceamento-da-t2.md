# Rebalanceamento da Temporada 2

Na Pré-temporada da T2, os Elencos são rebalanceados entre a Série A e a Série B para que todos os inscritos joguem. Com 92 Jogadores em 8 Times, cada Elenco tem cerca de 11 Jogadores para 7 lugares, e o rodízio deixa parte deles fora de cada Partida. Os 8 Times novos da Série B começariam só com Jogadores da Base.

Este ADR muda o ADR-0017 (os Times da T1 ficam na A **com os seus Jogadores**) e o ADR-0022 (a B se povoa só pela Janela voluntária).

## Regras

1. **Primeiro, voluntários.** A Janela de Transferências abre com prazo de 2 a 3 dias. Quem pede para ir para a B escolhe o Time, por ordem de pedido, respeitando a regra de equilíbrio (ADR-0012).
2. **Tamanho da A.** Cada Time da Série A fica com 7 Jogadores, uma Escalação inteira sem rodízio (`TAMANHO_DA_A`, ajustável para 8). O resto vai para a B. Com 92 inscritos, ficam 56 na A e 36 na B.
3. **Remanejamento, se faltarem voluntários.** De cada Time da A acima do tamanho, sai o inscrito mais recente da Posição que mais sobra em relação à Escalação (no empate, a que o Time Primo mais precisa), até o Time chegar ao tamanho da regra 2. Assim a A fica com 1 goleiro, 2 zagueiros, 2 meias e 2 atacantes sempre que possível, e quem se inscreveu primeiro fica.
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
7. **Escolha da camisa.** O remanejado mantém o número se ele estiver livre no Time novo (no empate, fica com quem se inscreveu antes). Até a Temporada começar, só os Fundadores escolhem número no Time deles. Quem entra depois escolhe a partir do primeiro jogo.
8. **Volta grátis.** Na Janela seguinte, o Fundador pode voltar para qualquer Time com vaga sem gastar a Transferência da Temporada, como já vale para todos (ADR-0022).
9. **Aviso individual.** Cada remanejado recebe uma resposta explicando o motivo e o novo Time. O texto passa pela aprovação do dono antes de sair.

Motivo: na B, o Jogador joga todas as Partidas, com Reels próprio. A mudança é anunciada como "jogue todo jogo", e não como rebaixamento. Voluntários primeiro e um critério público e simples (ordem de Inscrição) reduzem a sensação de injustiça.

## Considered Options

- **Só a Janela voluntária (ADR-0022 como estava):** rejeitada. A A continuaria com rodízio pesado e a B com muitos Jogadores da Base.
- **Sorteio para escolher quem sai:** rejeitada. Pode tirar quem está desde a primeira hora, que costuma ser o mais apegado ao Time.
- **Sair quem tem menor OVR:** rejeitada. Soa como punição.
- **Divisão igual (cerca de 6 por Time):** rejeitada. A A passaria a ter mais Jogadores da Base do que hoje.
- **Destino livre entre os Times da B:** rejeitada. Espalha os Jogadores e quebra o laço com o Time antigo.

## Como rodar

O workflow manual `rebalancear` (ou `pnpm liga rebalancear`). Sem marcar "gravar", é a simulação: o log mostra quem sai, para onde, os Elencos depois e os rascunhos dos avisos. Com "gravar", aplica numa transação e republica o site. Os avisos não são enviados por ele. O comando recusa rodar na Temporada 1, fora da Pré-temporada, sem Série B ou numa Temporada já rebalanceada.

## Consequences

- O Rebalanceamento roda uma vez por Temporada (tabela `rebalanceamento`), e os Fundadores ficam na tabela `fundador` (migração 014).
- A página de Carreira ganha o selo de Fundador, nas cores do Time da B, no cabeçalho e no cartão da Temporada. Só aparece a partir da T2: `jogadores.json` só leva o campo `fundador` quando a Temporada atual tem as regras da T2.
- O Reels e o comentário de anúncio da Janela precisam de rascunho aprovado. Eles só são publicados depois do fim da Temporada 1, junto com o anúncio das novidades da T2 ou logo depois dele.
