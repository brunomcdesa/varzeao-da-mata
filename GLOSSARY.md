# Varzeão da Mata

Jogo de futebol interativo publicado no Instagram: seguidores se inscrevem pelos comentários, viram jogadores de uma liga com vários times e acompanham as partidas simuladas em Reels diários.

## Language

### Participação

**Jogador**:
Seguidor do Instagram que se inscreveu e passou a existir dentro da liga. Pertence à conta do Instagram, não ao @: se a pessoa trocar de @, continua sendo o mesmo Jogador.
_Avoid_: participante, atleta, usuário

**Jogador da Base**:
Jogador genérico, sem @, com OVR baixo, que completa a Escalação quando um Time não tem Jogadores suficientes para uma Posição.
_Avoid_: bot, NPC, reserva

**Carreira**:
A trajetória de um Jogador ao longo de várias Temporadas. Time e OVR persistem de uma Temporada para a seguinte.
_Avoid_: histórico, perfil

**Posição**:
A função do Jogador em campo, informada na Inscrição: GOL, ZAG, MEI ou ATA.
_Avoid_: função, papel

**OVR**:
O resumo da força do Jogador: a média das suas Habilidades com pesos da Posição (ATA 55% Finalização, 25% Drible, 15% Passe, 5% Defesa; MEI 45% Passe, 20% Drible, 20% Defesa, 15% Finalização; ZAG 75% Defesa, 15% Passe, 5% Drible, 5% Finalização; GOL 90% Goleiro, 10% Passe). Não muda por si: muda quando as Habilidades mudam.
_Avoid_: overall, nível, rating, força

**Habilidade**:
Cada uma das cinco notas de 1 a 99 que descrevem o Jogador: Finalização, Passe, Drible, Defesa e Goleiro. São elas que decidem os Duelos e sobem ou descem com as ações do próprio Jogador na Partida (um gol sobe Finalização, ser driblado desce Defesa), no máximo 2 pontos por Habilidade por Partida (4 no Clássico); quem está alto sobe mais devagar e quem está baixo desce mais devagar. Quem não joga não perde nada.
_Avoid_: atributo, status, stat

**Drible**:
A Habilidade de passar pelo zagueiro conduzindo a bola; também o lance em que o atacante (ou o meia que finaliza) vence o zagueiro e chuta livre.
_Avoid_: finta, jogada individual

**Bloqueio**:
O lance em que o zagueiro trava o chute do atacante antes de a bola chegar ao goleiro.
_Avoid_: corte, travada

**Card**:
A ficha visual de um Jogador, com @, Posição, Time e OVR atual.
_Avoid_: carta, ficha, figurinha

**Inscrição**:
Comentário feito pela própria pessoa num Reels da Liga que a transforma em Jogador, escolhendo Time e Posição. Só a própria pessoa pode se inscrever; marcar terceiros não inscreve ninguém. Cada @ tem um único Jogador e não troca de Time durante a Temporada.
_Avoid_: cadastro, entrada, marcação

**Novos Contratados**:
Os Jogadores que fizeram Inscrição desde a Rodada anterior, apresentados no Resumo da Rodada como confirmação de que entraram na Liga.
_Avoid_: novatos, novos inscritos, reforços

**Comando**:
Comentário reconhecido pelo sistema em qualquer Reels da Liga: "ENTRO" faz uma Inscrição (um comentário curto só com Time e posição, como "Onça, atacante", também vale); "CRAQUE 3" vota no Candidato número 3. No post do Resumo, o número sozinho ("3") também vale como voto. O voto nunca usa @, para os comentários não marcarem ninguém. Os demais comentários são ignorados.
_Avoid_: palavra-chave, hashtag

**Corte**:
O momento, 30 minutos antes do Apito Inicial de cada Partida, até o qual Inscrições contam para a Escalação dos dois Times daquela Partida. A votação para Craque da Rodada fecha no Corte da primeira Partida do dia seguinte.
_Avoid_: deadline, prazo, fechamento

**Apito Inicial**:
O horário marcado de uma Partida (12h, 14h, 16h ou 18h). Antes dele, o resultado é secreto; a partir dele, a Partida pode ser vista Ao Vivo.
_Avoid_: kickoff, início, horário do jogo

**Ao Vivo**:
A exibição de uma Partida no site a partir do Apito Inicial, com o relógio de jogo correndo 15 vezes mais rápido, de modo que os 90 minutos passam em cerca de 6.
_Avoid_: live, transmissão, tempo real

**Replay**:
A reexibição, no site, de qualquer Partida já terminada, lance a lance.
_Avoid_: reprise, VT, gravação

### Competição

**Liga**:
A competição inteira, disputada entre vários Times ao longo de uma Temporada.
_Avoid_: campeonato, torneio

**Time**:
Um dos oito clubes fictícios, com identidade própria do projeto, que disputam a Liga.
_Avoid_: equipe, clube, lado, seleção

**Elenco**:
Todos os Jogadores inscritos num Time. A Inscrição fica aberta durante toda a Temporada, então o Elenco cresce ao longo dela.
_Avoid_: plantel, grupo, squad

**Escalação**:
Os 7 Jogadores de um Time que entram em campo numa Partida, escolhidos do Elenco por rodízio. As Partidas são de futebol society.
_Avoid_: titulares, time titular, onze

**Candidatos a Craque**:
Os 5 Jogadores com maior Nota da Partida numa Rodada, exibidos no Resumo da Rodada como as únicas opções de voto.
_Avoid_: indicados, finalistas, top 5

**Craque da Rodada**:
O Candidato a Craque mais votado pelo público, revelado no Reels da primeira Partida do dia seguinte. Cada Candidato tem um número (1 a 5, da maior Nota para a menor). Vota-se comentando o número no Resumo da Rodada (um voto por @, vale o último, inclusive em si mesmo) ou clicando no site (um voto por aparelho, vale o primeiro). Os dois somam.
_Avoid_: MVP, melhor em campo, destaque

**Craque da Temporada**:
O melhor Jogador da Temporada, eleito pelo público entre os 5 com a maior nota média (com pelo menos 3 jogos). A votação abre no Resumo da Final e fecha às 18h do dia seguinte; o anúncio sai às 19h, num Reels próprio.
_Avoid_: craque do campeonato, MVP da temporada, bola de ouro

**Título**:
A conquista da Temporada. Conta para o Time campeão e para cada Jogador dele que entrou em campo pelo menos uma vez naquela Temporada.
_Avoid_: taça, troféu (troféu é o nome genérico de qualquer conquista no Card)

**Temporada**:
Um ciclo completo da Liga, com duração de 7 a 10 dias.
_Avoid_: edição, season

**Rodada**:
O conjunto de Partidas disputadas num mesmo dia da Temporada, em horários escalonados (12h, 14h, 16h e 18h); há exatamente uma Rodada por dia. No Mata-mata, as Partidas ocupam os últimos horários do dia.
_Avoid_: jornada, dia de jogo

**Resumo da Rodada**:
O Reels das 19h que fecha o dia: placares, tabela, Novos Contratados e Candidatos a Craque. Nenhuma Partida da Rodada acontece depois dele.
_Avoid_: compacto, melhores momentos, recap

**Pré-temporada**:
Os 2 a 3 dias antes da primeira Rodada de uma Temporada, dedicados a apresentar os Times e captar Inscrições, sem Partidas.
_Avoid_: aquecimento, lançamento

**Clássico**:
Partida entre os dois Times de um par de rivais fixos. Cai no calendário por sorteio, como qualquer Partida, mas ganha abertura especial no Reels e move o OVR 1,5 vez mais que o normal.
_Avoid_: derby, rivalidade, jogo grande

**Rei do Clássico**:
O Jogador que decidiu um Clássico; o título fica registrado no seu Card.
_Avoid_: herói do clássico, decisivo

**Fase de Liga**:
A primeira parte da Temporada, em turno único: os 8 Times se enfrentam uma vez cada, ao longo de 7 Rodadas.
_Avoid_: fase de grupos, classificatória, pontos corridos

**Mata-mata**:
A parte final da Temporada, com semifinais (1º × 4º e 2º × 3º) e final entre os 4 melhores da Fase de Liga. Empate vai para a Disputa de pênaltis.
_Avoid_: playoffs, eliminatórias

**Disputa de pênaltis**:
Como se decide um jogo do Mata-mata (Semifinal ou Final) que termina empatado nos 90 minutos. Aparece cobrança por cobrança no Ao Vivo, no Replay e no Reels; o Ao Vivo do Mata-mata dura até 8 minutos para caber a disputa.
_Avoid_: penalidades, prorrogação (não existe)

**Duelo**:
O confronto entre Jogadores envolvidos num lance, decidido pelas Habilidades de cada um somadas a uma dose moderada de sorte. Uma jogada tem até quatro: posse (Passe do meia contra Defesa do meia rival), criação (Passe do meia contra Defesa de um zagueiro), atacante contra o outro zagueiro (Drible ou Finalização contra Defesa: Drible, Bloqueio, desarme ou chute marcado) e finalização (Finalização contra Goleiro). O pênalti é Finalização contra Goleiro.
_Avoid_: disputa, embate, lance

**Nota da Partida**:
A avaliação de 0 a 10 de um Jogador escalado, calculada pelas ações típicas da sua Posição e pelo resultado do Time, em relação ao que se esperava do seu OVR. Escolhe os Candidatos a Craque e o Craque da Temporada; não mexe no OVR (quem mexe são as Habilidades).
_Avoid_: rating, avaliação, desempenho

**Locutor da Liga**:
A voz única e fixa que narra todos os Reels. Fala de Jogadores pela Posição e pelo Time, nunca pelo @.
_Avoid_: narrador, comentarista, voz

**Partida**:
Um confronto simulado entre dois Times, com Apito Inicial marcado. Pode ser vista Ao Vivo ou em Replay no site e ganha um Reels próprio assim que termina.
_Avoid_: jogo, match
