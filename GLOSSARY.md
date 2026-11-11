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

**Página de Carreira**:
Página do site, a partir da Temporada 2, que mostra a Carreira de um Jogador Temporada por Temporada: Time e Série, números, OVR do começo ao fim, cartões e troféus (ADR-0025).
_Avoid_: perfil, ficha

**Página da Temporada**:
Página do site com o panorama da Temporada atual: placar da Temporada, líder de cada Série, últimos jogos, Artilharia, Assistências, Goleiros e Números dos Times. Vale desde a Temporada 1 e nunca mostra uma Temporada que ainda não começou (ADR-0031).
_Avoid_: estatísticas, resumo da temporada

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
Comentário feito pela própria pessoa num Reels da Liga que a transforma em Jogador, escolhendo Time e Posição. Só a própria pessoa pode se inscrever; marcar terceiros não inscreve ninguém. Cada @ tem um único Jogador; para trocar de Time durante a Temporada, só com a Transferência.
_Avoid_: cadastro, entrada, marcação

**Transferência**:
Troca de Time, de Posição ou dos dois que o Jogador pede comentando (por exemplo, "TRANSFERIR Preguiça"). Vale uma por Temporada, só na Fase de Liga, e só para um Time que não fique desequilibrado. O Jogador leva as Habilidades, e a mudança vale a partir do próximo Corte. ADR-0012.
_Avoid_: troca, mudança de time, empréstimo

**Vínculo**:
Ligação entre um navegador e um Jogador, feita pelo dono, que manda um código na DM da Liga. Com ele, o dono pede a Transferência pelo site. ADR-0013.
_Avoid_: login, conta, cadastro

**Novos Contratados**:
Os Jogadores que fizeram Inscrição desde a Rodada anterior, apresentados no Resumo da Rodada como confirmação de que entraram na Liga.
_Avoid_: novatos, novos inscritos, reforços

**Comando**:
Comentário reconhecido pelo sistema em qualquer Reels da Liga: "ENTRO" faz uma Inscrição (um comentário curto só com Time e posição, como "Onça, atacante", também vale; quem diz só o Time, como "ENTRO ARARA" ou "eu sou da arara", entra na posição mais vazia dele; Time e posição em dois comentários da mesma pessoa, em até 24 h, são juntados); "CRAQUE 3" vota no Candidato número 3. No post do Resumo, o número sozinho ("3") também vale como voto. O voto nunca usa @, para os comentários não marcarem ninguém. Os demais comentários são ignorados.
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
A competição inteira, disputada entre 16 Times, divididos em Série A e Série B, ao longo de uma Temporada.
_Avoid_: campeonato, torneio

**Time**:
Um dos 16 clubes fictícios, com identidade própria do projeto, que disputam a Liga. Cada Time está numa Série e tem um rival fixo, com quem faz o Clássico.
_Avoid_: equipe, clube, lado, seleção

**Elenco**:
Todos os Jogadores inscritos num Time. A Inscrição fica aberta durante toda a Temporada, então o Elenco cresce ao longo dela.
_Avoid_: plantel, grupo, squad

**Escalação**:
Os 7 Jogadores de um Time que entram em campo numa Partida, escolhidos do Elenco por rodízio. As Partidas são de futebol society.
_Avoid_: titulares, time titular, onze

**Candidatos a Craque**:
Os 5 Jogadores com maior Nota da Partida numa Rodada, em cada Série, exibidos no Resumo da Rodada como as únicas opções de voto.
_Avoid_: indicados, finalistas, top 5

**Craque da Rodada**:
O Candidato a Craque mais votado pelo público em cada Série, revelado no Reels da primeira Partida do dia seguinte. Cada Candidato tem a letra da Série e um número (A1 a A5 e B1 a B5, da maior Nota para a menor). Vota-se comentando o número no Resumo da Rodada (um voto por @, vale o último, inclusive em si mesmo) ou clicando no site (um voto por aparelho, vale o primeiro). Os dois somam.
_Avoid_: MVP, melhor em campo, destaque

**Craque da Temporada**:
O melhor Jogador da Temporada em cada Série, eleito pelo público entre os 5 da Série com a maior nota média (com pelo menos 3 jogos). A votação abre no Resumo da Final e fecha às 18h do dia seguinte; o anúncio sai às 19h, num Reels próprio.
_Avoid_: craque do campeonato, MVP da temporada, bola de ouro

**Título**:
A conquista da Temporada. Conta para o Time campeão e para cada Jogador dele que entrou em campo pelo menos uma vez naquela Temporada.
_Avoid_: taça, troféu (troféu é o nome genérico de qualquer conquista no Card)

**Temporada**:
Um ciclo completo da Liga, com duração de 7 a 10 dias.
_Avoid_: edição, season

**Rodada**:
O conjunto de Partidas disputadas num mesmo dia da Temporada, em horários escalonados (12h, 14h, 16h e 18h), com uma Partida de cada Série em cada horário; há exatamente uma Rodada por dia. No Mata-mata, as Partidas ocupam os últimos horários do dia.
_Avoid_: jornada, dia de jogo

**Resumo da Rodada**:
O Reels das 19h que fecha o dia: placares e tabelas das duas Séries, Novos Contratados e Candidatos a Craque de cada Série. Nenhuma Partida da Rodada acontece depois dele.
_Avoid_: compacto, melhores momentos, recap

**Pré-temporada**:
Os 2 a 3 dias antes da primeira Rodada de uma Temporada, dedicados a apresentar os Times e captar Inscrições, sem Partidas.
_Avoid_: aquecimento, lançamento

**Clássico**:
Partida entre os dois Times de um par de rivais fixos. Cai no calendário por sorteio, como qualquer Partida, mas ganha abertura especial no Reels e as ações valem o dobro para as Habilidades (e o limite por Partida também dobra).
_Avoid_: derby, rivalidade, jogo grande

**Goleada**:
Vitória em que o vencedor faz 4 gols ou mais e abre 3 ou mais de vantagem (4×0, 4×1, 5×2; um 4×3 não é). O narrador comemora no gol que confirma a Goleada (uma vez por Partida) e no Fim de jogo. ADR-0026.
_Avoid_: lavada, surra, massacre

**Rei do Clássico**:
O Jogador que decidiu um Clássico; o título fica registrado no seu Card.
_Avoid_: herói do clássico, decisivo

**Fase de Liga**:
A primeira parte da Temporada, em turno único: os 8 Times de cada Série se enfrentam uma vez cada, ao longo de 7 Rodadas.
_Avoid_: fase de grupos, classificatória, pontos corridos

**Mata-mata**:
A parte final da Temporada, disputada em cada Série, com semifinais (1º × 4º e 2º × 3º) e final entre os 4 melhores da Fase de Liga. Na Série B, os dois finalistas ganham o Acesso. Empate vai para a Disputa de pênaltis.
_Avoid_: playoffs, eliminatórias

**Disputa de pênaltis**:
Como se decide um jogo do Mata-mata (Semifinal ou Final) que termina empatado nos 90 minutos. Aparece cobrança por cobrança no Ao Vivo, no Replay e no Reels; o Ao Vivo do Mata-mata dura até 8 minutos para caber a disputa.
_Avoid_: penalidades, prorrogação (não existe)

**Duelo**:
O confronto entre Jogadores envolvidos num lance, decidido pelas Habilidades de cada um somadas a uma dose moderada de sorte. Uma jogada tem até quatro: posse (Passe do meia contra Defesa do meia rival), criação (Passe do meia contra Defesa de um zagueiro), atacante contra o outro zagueiro (Drible ou Finalização contra Defesa: Drible, Bloqueio, desarme ou chute marcado) e finalização (Finalização contra Goleiro). O pênalti é Finalização contra Goleiro.
_Avoid_: disputa, embate, lance

**Falta**:
Desarme feito de forma irregular, que dá bola parada ao Time que atacava: pênalti dentro da área, chute direto com Barreira na entrada da área, jogada ensaiada mais longe. Pode dar Cartão. ADR-0024.
_Avoid_: infração

**Barreira**:
Os jogadores do Time que defende enfileirados na frente do chute direto de Falta. O chute pode bater nela antes de chegar ao goleiro. ADR-0024.
_Avoid_: muralha

**Ritmo**:
Quantos lances de ataque uma Partida tem, sorteado para cada Partida e, a partir da Temporada 2, puxado um pouco pela Postura dos dois Times: jogo travado tem poucos, jogo aberto tem muitos. ADR-0016.
_Avoid_: intensidade, velocidade

**Nota da Partida**:
A avaliação de 0 a 10 de um Jogador escalado, calculada pelas ações típicas da sua Posição e pelo resultado do Time, em relação ao que se esperava do seu OVR. Escolhe os Candidatos a Craque e o Craque da Temporada; não mexe no OVR (quem mexe são as Habilidades).
_Avoid_: rating, avaliação, desempenho

**Narrador**:
A voz que narra a Partida, no Reels e no Ao Vivo: uma de cinco, sorteada pela semente da Partida. Cada Narrador tem a sua voz e o seu jeito de narrar (ADR-0032). Fala dos Jogadores pela Posição e pelo Time, nunca pelo @, e só comenta o que aparece na tela.
_Avoid_: Locutor da Liga, locutor, comentarista, voz

**Série**:
Cada uma das duas divisões da Liga, com 8 Times: a Série A, de cima, e a Série B. Cada Série tem a sua Fase de Liga, o seu Mata-mata, o seu Título e os seus Craques.
_Avoid_: divisão, grupo, chave

**Acesso**:
A subida de um Time da Série B para a Série A no fim da Temporada. Ganham o Acesso os dois finalistas do Mata-mata da Série B.
_Avoid_: promoção, subida

**Rebaixamento**:
A descida de um Time da Série A para a Série B no fim da Temporada. Caem os dois últimos da Fase de Liga da Série A. Os Jogadores descem com o Time.
_Avoid_: descenso, queda, degola

**Capitão**:
O Jogador com mais Partidas por um Time, que escolhe a Postura antes de cada Partida. Se não tiver Vínculo ou estiver suspenso, a faixa passa para o próximo com Vínculo.
_Avoid_: líder, técnico, dono do time

**Postura**:
A atitude do Time numa Partida (Ofensiva, Equilibrada ou Defensiva), escolhida em segredo pelo Capitão até o Corte. Sem escolha, é Equilibrada.
_Avoid_: tática, estratégia, esquema

**Cartão**:
Punição a um Jogador na Partida. O vermelho expulsa na hora, e o Time segue com um a menos. Dois amarelos na Temporada, ou um vermelho, dão Suspensão.
_Avoid_: advertência, punição

**Suspensão**:
Uma Partida em que o Jogador fica fora da Escalação por causa de Cartões.
_Avoid_: gancho, punição

**Presença**:
A confirmação, feita pelo site ou comentando CONFIRMO até o Corte, de que o Jogador quer jogar o próximo jogo do Time. Quem confirmou passa na frente no rodízio da Escalação. ADR-0023.
_Avoid_: check-in, convocação

**Partidas Fora**:
As Partidas seguidas do próprio Time em que o Jogador ficou fora da Escalação, contadas desde a última que jogou (ou desde a Inscrição). Quem chega a 2 Partidas Fora passa na frente no rodízio da Escalação, no mesmo nível da Presença. ADR-0043.
_Avoid_: banco, jejum, tempo parado

**Especialização**:
A função que o Jogador escolhe dentro da sua Posição (por exemplo Artilheiro, Volante, Xerife ou Paredão), que dá um bônus num Duelo e um custo pequeno em outro. São 3 por Posição, no máximo uma valendo em cada jogo, trocada uma vez por Rodada. ADR-0023.
_Avoid_: estilo, classe, perfil, função

**Treino**:
A Habilidade de foco que o Jogador escolhe pelo site; os ganhos dela sobem mais rápido. ADR-0023.
_Avoid_: foco, upgrade, boost

**Resenha**:
O comentário do Jogador no Reels do último jogo do próprio Time, feito até o Corte da Partida seguinte. Quem tem Resenha e é escalado ganha Habilidade 50% mais rápido naquela Partida. A partir da T2, se a Partida seguinte for o Clássico, quem tem Resenha também passa na frente no rodízio da Escalação, logo depois do Craque e no mesmo nível da Presença. ADRs 0034 e 0039.
_Avoid_: engajamento, bônus de comentário, interação

**Canto**:
O lado escolhido por batedor e goleiro na Disputa de pênaltis; quem não escolhe tem o canto sorteado. ADR-0023.
_Avoid_: lado, direção

**Janela de Transferências**:
O período da Pré-temporada em que qualquer Jogador pode trocar para qualquer Time, de qualquer Série, desde que o destino não fique desequilibrado. Não gasta a Transferência da Temporada.
_Avoid_: mercado, janela de inverno

**Rebalanceamento**:
A redistribuição dos Elencos entre a Série A e a Série B na Pré-temporada da T2, para que todos os inscritos joguem. Primeiro entram os voluntários. Se faltar gente, saem os inscritos mais recentes de cada Time da A (ADR-0036).
_Avoid_: rebaixamento, corte, remoção

**Time Primo**:
O Time da Série B que forma par fixo com um Time da Série A e recebe quem é remanejado dele no Rebalanceamento (exemplo: Onça → Jacaré).
_Avoid_: time irmão, time filial

**Fundador**:
O título de quem começa a primeira Temporada de um Time da Série B no Elenco dele. Aparece na página de Carreira e dá prioridade na escolha da camisa.
_Avoid_: pioneiro, membro original

**Partida**:
Um confronto simulado entre dois Times, com Apito Inicial marcado. Pode ser vista Ao Vivo ou em Replay no site e ganha um Reels próprio assim que termina.
_Avoid_: jogo, match

**Contra-ataque**:
Lance logo depois de o rival perder a bola com gente adiantada. Se a defesa não recompõe, o 1º zagueiro (ou, depois de escanteio, também o marcador) fica fora do lance (ADR-0015).
_Evite_: contragolpe

### Espetáculo

**App**:
O site da Liga instalado no celular (PWA), com ícone na tela inicial e tela cheia. É o mesmo site, não um aplicativo de loja (ADR-0040).
_Avoid_: aplicativo, app nativo, baixar da loja

**Avisos**:
As notificações de jogo que o App manda no celular para quem ativou e escolheu os Times: Escalação, aviso 5 min antes do Apito Inicial, gols e fim de jogo (ADR-0042).
_Avoid_: assinatura, push, inscrição nos avisos

**Arquibancada**:
A torcida de madeira nas laterais do campo, nas cores de cada Time, que reage aos lances da Partida. Cresce com o tamanho do Elenco. É só espetáculo: não decide nenhum lance.
_Avoid_: torcida virtual, plateia, galera

**Grito de guerra**:
O canto próprio de cada Time, que a Arquibancada entoa depois de um gol do Time.
_Avoid_: hino, música, cântico

**Juiz**:
O boneco que apita as Partidas da T2: acompanha o lance, apita a falta e mostra o Cartão. É só visual e não tem nome escrito.
_Avoid_: árbitro, apitador

**Clima**:
O tempo da Partida (sol, chuva ou lama), sorteado para cada Partida. Muda o visual e a fala do Narrador, e não decide nenhum lance.
_Avoid_: tempo, condição do campo

**Segundo uniforme**:
A camisa alternativa que um Time usa quando as suas cores se confundem com as do adversário.
_Avoid_: camisa reserva, uniforme dois
