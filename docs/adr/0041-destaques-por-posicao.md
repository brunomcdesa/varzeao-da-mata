# Destaques por Posição

O dono perguntou se quem faz gol deveria ganhar prioridade na Escalação. Isso premiaria só atacantes e meias. Goleiros e zagueiros, que já evitam gols, não teriam como ganhar.

O prêmio por desempenho na Escalação já existe e não favorece o ataque: a Nota da Partida conta defesas, desarmes, bloqueios e gols sofridos, e é medida contra o que se espera da Posição e do OVR (ADR-0004). As 5 maiores Notas viram Candidatos a Craque, e o Craque da Rodada anterior é o primeiro na fila do rodízio. O que faltava era visibilidade para quem defende.

**Decisão.** A partir da Temporada 2, cada Posição tem o seu Destaque, em cada Série:

- **Muralha** (goleiro), **Carrapato** (zagueiro), **Garçom** (meia) e **Matador** (atacante). Os nomes não repetem os das Especializações (ADR-0023).
- **Destaque da Rodada:** a maior Nota da Posição na Rodada. Desempate: o número da Posição (defesas; desarmes + bloqueios; assistências; gols), depois menos gols sofridos por jogo, depois quem se inscreveu antes. O Jogador da Base não concorre. Quem jogou em duas Posições concorre em cada uma.
- **Destaque da Temporada:** a maior Nota média da Posição, com pelo menos 3 jogos nela.
- **Onde aparece:** uma cartela por Série no Resumo da Rodada, antes dos Candidatos a Craque; outra no Resumo da Temporada, depois do artilheiro (com ela, o "melhor goleiro" sai, porque a Muralha da Temporada usa o mesmo critério). Na Carreira e na sala de troféus, como Destaque da Rodada e Destaque da Temporada, depois que o Reels foi ao ar.
- **Narração:** o Narrador fala pela Posição e pelo Time ("Muralha: o goleiro da Onça"), nunca pelo @.

## Considered Options

- **Prioridade na Escalação por gol:** rejeitada. Premia só o ataque e repete o que o Craque já faz pela Nota.
- **Prioridade pela maior Nota de cada Time:** rejeitada. Quem já é forte jogaria mais e evoluiria mais (bola de neve), e a fila da T2 já tem três níveis (Craque, Presença ou Resenha, rodízio).
- **Craque por Posição, com voto:** rejeitada. Quatro votações por Série deixariam o Resumo longo e dividiriam os votos.
- **Só o número da Posição, sem a Nota:** rejeitada. Premia quem jogou mais vezes e ignora a força do adversário.
- **Já na T1:** rejeitada. A T1 está no fim; entra no Reels de novidades da T2.

## Consequences

- Não muda a simulação nem a Escalação: não sobe a `VERSAO_SIM` e nenhuma Partida jogada muda.
- O Resumo da Rodada ganha uma cartela de 7 s por Série (cerca de 14 s com Série A e B).
- Os troféus são calculados na exportação do site, pelos desempenhos guardados; não há tabela nova.
- Entra como cartela no Reels das novidades da T2 (com prévia aprovada pelo dono).
