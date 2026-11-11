# Prioridade no Clássico por Resenha

Um seguidor respondeu um Stories dizendo que merecia vaga no Clássico do Time dele. Hoje quem comenta no Reels do jogo do Time ganha Resenha (ADR-0034), mas o bônus só vale para quem é escalado: quem comentou e ficou fora do rodízio não ganha nada.

**Decisão.** Quando a Partida que está sendo escalada é o Clássico do Time, o Jogador com Resenha passa na frente no rodízio da sua Posição. A ordem fica:

1. Craque da Rodada anterior;
2. quem tem prioridade: Resenha (só no Clássico) ou Presença (T2, ADR-0023), no mesmo nível;
3. o rodízio de sempre: quem jogou menos na Temporada, depois quem jogou há mais tempo, depois quem se inscreveu antes.

Entre os que têm prioridade, vale o rodízio de sempre. Nos outros jogos, a Resenha continua só acelerando a evolução. Vale nas duas Temporadas, a partir da próxima Escalação.

Motivo: premiar quem acompanha os Reels do Time no jogo que mais importa, sem quebrar a rotação dos outros jogos.

## Considered Options

- **Prioridade em todos os jogos:** rejeitada. Quem comenta sempre jogaria quase sempre, e a rotação perde o sentido.
- **Clássico e Mata-mata:** rejeitada por enquanto. O Clássico já é o jogo especial de cada Time.
- **Contar a quantidade de comentários ou de Reels comentados:** rejeitada. Premia spam e quem entrou cedo; o "último jogo" já pede constância.
- **Vaga garantida:** impossível quando mais Jogadores comentam do que há vagas; por isso o nome é prioridade.
- **Na T2, Presença na frente da Resenha:** rejeitada. Mesmo nível é mais fácil de explicar.

## Consequences

- Muda só a Escalação, não a simulação: não sobe a `VERSAO_SIM` e nenhuma Partida jogada muda.
- Como a Fase de Liga é turno único, cada Time tem um Clássico por Temporada; a rotação dos outros jogos fica intacta.
- No Clássico, quem tem Resenha soma a evolução do Clássico (dobro) com a da Resenha (+50%), dentro do limite de 4 pontos por Habilidade.
- A novidade é anunciada num Reels curto, com prévia aprovada pelo dono antes de publicar.
