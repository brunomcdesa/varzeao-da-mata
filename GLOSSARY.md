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
O resumo da força do Jogador: a média das suas Habilidades com pesos da Posição (ATA 55% Finalização, 25% Drible, 15% Passe, 5% Defesa; MEI 45% Passe, 20% Drible, 20% Defesa, 15% Finalização; ZAG 75% Defesa, 15% Passe, 5% Drible, 5% Finalização; GOL 90% Goleiro, 10% Passe). Não muda por si: muda quando as Habilidades mudam. Na Inscrição, o OVR é sorteado entre 60 e 70 durante a T1 e entre 60 e 65 depois dela (ADR-0056). O dono pode acertar o OVR à mão: todas as Habilidades mudam na mesma proporção, e o OVR ajustado vira a base do Jogador no site (ADR-0079).
_Avoid_: overall, nível, rating, força

**Habilidade**:
Cada uma das cinco notas de 1 a 99 que descrevem o Jogador: Finalização, Passe, Drible, Defesa e Goleiro. São elas que decidem os Duelos e sobem ou descem com as ações do próprio Jogador na Partida (um gol sobe Finalização, ser driblado desce Defesa), no máximo 2 pontos por Habilidade por Partida (4 no Clássico); quem está alto sobe mais devagar e quem está baixo desce mais devagar. Quem não joga não perde nada.
_Avoid_: atributo, status, stat

**Proteção**:
A partir da T2, as ações principais da Posição em que o Jogador jogou cancelam perdas de Habilidade da mesma Partida: gol e assistência (atacante, meia e zagueiro), desarme e bloqueio (zagueiro), defesa, pênalti pego e jogo sem sofrer gol (goleiro). A Proteção só apaga perdas, nunca vira ganho, e gasta primeiro na Habilidade que mais pesa no OVR da Posição (ADR-0105).
_Avoid_: escudo, seguro

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

**Link de Vínculo**:
Link de uso único, válido por 24 horas, que a Liga manda na DM de um Jogador quando o dono roda o workflow link-de-vinculo. Abrir o link faz o Vínculo daquele navegador com o Jogador, no lugar de qualquer Vínculo anterior. ADR-0082.
_Avoid_: link mágico, convite, login por link

**Novos Contratados**:
Os Jogadores que fizeram Inscrição desde a Rodada anterior, apresentados no Resumo da Rodada como confirmação de que entraram na Liga.
_Avoid_: novatos, novos inscritos, reforços

**Comando**:
Comentário reconhecido pelo sistema em qualquer Reels da Liga: "ENTRO" faz uma Inscrição (um comentário curto só com Time e posição, como "Onça, atacante", também vale; quem diz só o Time, como "ENTRO ARARA" ou "eu sou da arara", entra na posição mais vazia dele; Time e posição em dois comentários da mesma pessoa, em até 24 h, são juntados); "CRAQUE 3" vota no Candidato número 3. No post do Resumo, o número sozinho ("3") também vale como voto. O voto nunca usa @, para os comentários não marcarem ninguém. Os demais comentários são ignorados.
_Avoid_: palavra-chave, hashtag

**Corte**:
O momento, 30 minutos antes do Apito Inicial de cada Partida, até o qual Inscrições contam para a Escalação dos dois Times daquela Partida. No Mata-mata, vale o Corte do último jogo do Time na Fase de Liga (ADR-0057). A votação para Craque da Rodada fecha no Corte da primeira Partida do dia seguinte.
_Avoid_: deadline, prazo, fechamento

**Apito Inicial**:
O horário marcado de uma Partida (12h, 14h, 16h ou 18h). Antes dele, o resultado é secreto; a partir dele, a Partida pode ser vista Ao Vivo.
_Avoid_: kickoff, início, horário do jogo

**Ao Vivo**:
A exibição de uma Partida no site a partir do Apito Inicial, com o relógio de jogo correndo 15 vezes mais rápido, de modo que os 90 minutos passam em cerca de 6.
_Avoid_: live, transmissão, tempo real

**Público**:
Quantas pessoas estão assistindo a um Ao Vivo naquele momento, mostrado no placar da página da Partida ("37 assistindo"). Só existe durante o Ao Vivo (ADR-0046).
_Avoid_: audiência, viewers, espectadores online

**Reação**:
Um emoji que qualquer pessoa assistindo ao Ao Vivo pode mandar (⚽ Gol, 🔥 Fogo, 😱 Susto, 👏 Palmas). Sobe por cima do campo na tela de todo mundo; uma por segundo por pessoa. Não fica no Replay (ADR-0046).
_Avoid_: like, curtida, emoji

**Replay**:
A reexibição, no site, de qualquer Partida já terminada, lance a lance.
_Avoid_: reprise, VT, gravação

### Competição

**Liga**:
A competição inteira, disputada entre 24 Times, divididos em Série A (16) e Série B (8), ao longo de uma Temporada. Na Temporada 1, eram só os 8 fundadores, numa Série só.
_Avoid_: campeonato, torneio

**Time**:
Um dos 24 clubes fictícios, com identidade própria do projeto, que disputam a Liga. Cada Time está numa Série e tem rivais fixos, com quem faz o Clássico (dois rivais para cada Time da Série A de 16, desde a T2).
_Avoid_: equipe, clube, lado, seleção

**Perfil do Time**:
O Instagram que um Jogador criou para o Time e que o dono reconheceu como oficial, a pedido pela DM. É um por Time: fica o primeiro que pediu. Precisa ter @varzeao_da_mata na bio, usar o nome e o bicho do Time (o escudo pode ser próprio), não se passar pela Liga e respeitar os rivais. Ganha link na página do Time, é seguido pela Liga, pode ter artes repostadas nos Stories e entra como colaborador em todo Reels de Partida do Time. ADR-0100.
_Avoid_: perfil oficial da Liga, conta do time, página do time

**Perfil de Torcida**:
Qualquer outro Instagram sobre um Time que não seja o Perfil do Time, como um segundo perfil do mesmo Time. Pode existir à vontade, mas não ganha nenhum dos benefícios do Perfil do Time. ADR-0100.
_Avoid_: perfil falso, fã-clube

**Elenco**:
Todos os Jogadores inscritos num Time. A Inscrição fica aberta durante toda a Temporada, então o Elenco cresce ao longo dela.
_Avoid_: plantel, grupo, squad

**Banco**:
Os reservas de um Time numa Partida da T2: todos que sobraram da Escalação, na ordem da fila do rodízio. Podem entrar no intervalo, pela Substituição. ADR-0061.
_Avoid_: reservas, suplentes

**Substituição**:
A troca do intervalo, só na T2: sai quem tem Nota parcial abaixo de 5 (até 2 por Time) e entra um reserva do Banco da mesma Posição. Goleiro só por goleiro; na linha, sem reserva da Posição, entra um de outra Posição de linha. O reserva que entrou conta jogo. ADR-0061.
_Avoid_: troca de jogador, mudança

**Escalação**:
Os 7 Jogadores de um Time que entram em campo numa Partida, escolhidos do Elenco por rodízio. As Partidas são de futebol society.
_Avoid_: titulares, time titular, onze

**Candidatos a Craque**:
Os 5 Jogadores com maior Nota da Partida numa Rodada, em cada Série, exibidos no Resumo da Rodada como as únicas opções de voto.
_Avoid_: indicados, finalistas, top 5

**Craque da Rodada**:
O Candidato a Craque mais votado pelo público em cada Série, revelado no Reels da primeira Partida do dia seguinte. Cada Candidato tem a letra da Série e um número (A1 a A5 e B1 a B5, da maior Nota para a menor). Vota-se comentando o número no Resumo da Rodada (um voto por @, vale o último, inclusive em si mesmo) ou clicando no site (um voto por aparelho, vale o primeiro). Os dois somam.
_Avoid_: MVP, melhor em campo, destaque (e não confundir com a Seleção da Rodada, que é por Posição e não tem voto)

**Seleção da Rodada**:
O time ideal da Rodada em cada Série: o Jogador de maior Nota em cada Posição, chamado de Muralha (goleiro), Carrapato (zagueiro), Garçom (meia) e Matador (atacante). Sai automática no Resumo da Rodada, sem voto, e não mexe na Escalação: vira troféu na Carreira. A Seleção da Temporada usa a maior Nota média (com pelo menos 3 jogos na Posição) e sai no Resumo da Temporada. Desde a Temporada 2. ADR-0041.
_Avoid_: destaque da rodada, time da rodada, melhores da posição

**Craque da Temporada**:
O melhor Jogador da Temporada em cada Série, eleito pelo público entre os 5 da Série com a maior nota média (com pelo menos 3 jogos). A votação abre no Resumo da Final e fecha às 18h do dia seguinte; o anúncio sai às 19h, num Reels próprio.
_Avoid_: craque do campeonato, MVP da temporada, bola de ouro

**Título**:
A conquista da Temporada. Conta para o Time campeão e para cada Jogador dele que entrou em campo pelo menos uma vez naquela Temporada.
_Avoid_: taça, troféu (troféu é o nome genérico de qualquer conquista no Card)

**Estrela de Título**:
A estrela acima do escudo do Time, uma por Título: dourada para a Série A (ou a Liga da T1), prata para a Série B e bronze para a Copa (ADR-0088). A da Série aparece quando a Temporada seguinte é criada (ADR-0060).
_Avoid_: estrelinha, selo (Selo é o da Temporada 1, do Jogador)

**Temporada**:
Um ciclo completo da Liga, com duração de 7 a 10 dias.
_Avoid_: edição, season

**Rodada**:
O conjunto de Partidas disputadas num mesmo dia da Temporada; há exatamente uma Rodada por dia. Na Temporada 1, às 12h, 14h, 16h e 18h. Da T2 em diante, a Série B joga das 11h às 14h, um jogo por hora, e a Série A das 15h às 18h, com dois jogos em cada horário (ADR-0058). No Mata-mata, as Partidas ocupam os últimos horários do dia.
_Avoid_: jornada, dia de jogo

**Resumo da Rodada**:
O Reels das 19h que fecha o dia: placares e tabelas das duas Séries, Novos Contratados e Candidatos a Craque de cada Série. Nenhuma Partida da Rodada acontece depois dele.
_Avoid_: compacto, melhores momentos, recap

**Pré-temporada**:
Os dias antes da primeira Rodada de uma Temporada, dedicados a apresentar os Times, captar Inscrições e abrir a Janela de Transferências. Até a T2, sem Partidas; a partir da T3, termina com os 3 dias da Copa, depois que a Janela fecha (ADR-0088).
_Avoid_: aquecimento, lançamento

**Clássico**:
Partida entre os dois Times de um par de rivais fixos. Desde a T2, cada Time da Série A de 16 tem dois Clássicos, os dois no seu Grupo (ADR-0066). Na T3 em diante, só acontece na Fase de Liga se os dois estiverem na mesma Série; os segundos Clássicos também abrem a Copa (ADR-0088). Cai no calendário por sorteio, como qualquer Partida, mas ganha abertura especial no Reels e as ações valem o dobro para as Habilidades (e o limite por Partida também dobra).
_Avoid_: derby, rivalidade, jogo grande

**Goleada**:
Vitória em que o vencedor faz 4 gols ou mais e abre 3 ou mais de vantagem (4×0, 4×1, 5×2; um 4×3 não é). O narrador comemora no gol que confirma a Goleada (uma vez por Partida) e no Fim de jogo. ADR-0026.
_Avoid_: lavada, surra, massacre

**Rei do Clássico**:
O Jogador que decidiu um Clássico; o título fica registrado no seu Card.
_Avoid_: herói do clássico, decisivo

**Fase de Liga**:
A primeira parte da Temporada. Na Temporada 1, turno único entre os 8 Times em 7 Rodadas. Da T2 em diante, a Série A (16 Times) faz turno único em 15 Rodadas e a Série B (8 Times) faz turno e returno em 14, para as duas terminarem juntas; o Mata-mata vem nas Rodadas 16 e 17 (ADR-0058).
_Avoid_: fase de grupos, classificatória, pontos corridos

**Mata-mata**:
A parte final da Temporada, disputada em cada Série, com semifinais (1º × 4º e 2º × 3º) e final entre os 4 melhores da Fase de Liga. Na Série B, os dois finalistas ganham o Acesso. Empate vai para a Disputa de pênaltis. Só joga o Mata-mata quem já podia jogar o último jogo do Time na Fase de Liga; quem se inscreve depois entra no Elenco e estreia na próxima Temporada. ADR-0057.
_Avoid_: playoffs, eliminatórias

**Copa**:
O Mata-mata com os 16 Times das duas Séries, a partir da T3, nos 3 últimos dias da Pré-temporada: Oitavas de Clássico, Quartas e Semifinais, Final. Jogo único, com Disputa de pênaltis no empate. Habilidade, Cartões e Moedas valem; a Suspensão da Copa só vale dentro dela (ADR-0088).
_Avoid_: copinha, torneio, taça

**Oitavas de Clássico**:
As oitavas da Copa, formadas pelos 8 segundos Clássicos (Onça×Leão, Capivara×Sucuri etc.), que cobrem os 16 Times. Valem como Clássico completo (ADR-0088).
_Avoid_: oitavas, primeira fase

**Título da Copa**:
A conquista da Copa. Conta para o Time campeão e para cada Jogador dele que entrou em campo na Copa; dá a Estrela de Título bronze e 40 Moedas (ADR-0088).
_Avoid_: taça da Copa, Título (sozinho é o da Série)

**Expansão**:
A entrada de 4 Times novos na Série B quando 90% das vagas da Liga estão ocupadas no fim da Fase de Liga. Naquela virada ninguém cai da A e 2 sobem, e as Séries ficam com 10 Times cada (ADR-0093).
_Avoid_: ampliação, inchaço

**Fase do Clássico**:
O primeiro dia da Copa com 20 Times: os 10 primeiros Clássicos, um por Time (ADR-0093). Com 16 Times, são as Oitavas de Clássico.
_Avoid_: primeira fase, preliminar

**Repescagem**:
Na Copa com 20 Times, os 2 jogos entre os 4 vencedores da Fase do Clássico com pior campanha na Temporada anterior; os 2 vencedores vão às Quartas (ADR-0093).
_Avoid_: playoff, preliminar

**Supercopa**:
Jogo único entre o campeão da Série A e o campeão da Copa, abrindo a Temporada. Planejado para a T4 (ADR-0092).
_Avoid_: superfinal, desafio dos campeões

**Briga pelo Mata-mata**:
Na última Rodada da Fase de Liga, a situação de cada Time em relação às 4 vagas do Mata-mata: **Garantido** (nenhum resultado que falta o tira dos 4 primeiros, contando os desempates), **Eliminado** (nenhum resultado o coloca entre os 4) ou "depende" (ainda depende de outros resultados). O Narrador e as plaquinhas embaixo do placar mostram também do que o Time precisa e o que acontece "se terminar assim". ADR-0053.
_Avoid_: classificado matematicamente, G4

**Chances**:
Cartela do Resumo da Rodada, da metade da Fase de Liga (a Rodada 4 de 7) até a penúltima Rodada: a chance de cada Time ir às Semifinais e de cair, por Grupo (ou por Série). Os jogos que faltam são simulados 20 mil vezes, todos com chances iguais, com os desempates da tabela. Quando é certo de verdade, aparece o selo **Na semi**, **Fora**, **Caiu** ou **Salvo**; sem certeza, nunca 0% nem 100% ("<1%", ">99%"). No Resumo da última Rodada, vira a cartela **Fim da Fase de Liga**, só com os selos. ADR-0099.
_Avoid_: probabilidade, previsão, palpite (o Palpite é outra coisa)

**Disputa de pênaltis**:
Como se decide um jogo do Mata-mata (Semifinal ou Final) que termina empatado nos 90 minutos. Aparece cobrança por cobrança no Ao Vivo, no Replay e no Reels; o Ao Vivo do Mata-mata dura até 8 minutos para caber a disputa.
Também decide os jogos empatados da Copa. A ordem é a dos Batedores escolhidos pelo Capitão; sem escolha, ATA, ATA, MEI, MEI, ZAG, ZAG, GOL (ADR-0091).
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
A voz que narra a Partida, no Reels e no Ao Vivo: uma de cinco, sorteada pela semente da Partida. Cada Narrador tem a sua voz e o seu jeito de narrar (ADR-0032). Nunca fala o @ e só comenta o que aparece na tela. Na T1, fala dos Jogadores pela Posição e pelo Time e diz o apelido só nos gols; a partir da T2, diz o apelido em toda fala de Jogador (na primeira vez, junto com a Posição e o Time) e fica pela Posição e pelo Time só com quem não tem apelido falável (ADR-0059).
_Avoid_: Locutor da Liga, locutor, comentarista, voz

**Toque de bola**:
O trecho entre um lance e outro, em que o Time que vai atacar troca passes até a jogada começar (ADR-0045). Depois de gol, começa com a saída de bola. No Ao Vivo, o Narrador preenche esse trecho com frases de jogo corrido, e as frases de posse só entram quando o toque de bola mostra aquilo na tela (ADR-0070).
_Avoid_: enchimento (é o nome das frases, não do trecho), posse de bola, troca de passes

**Série**:
Cada uma das duas divisões da Liga: a Série A, de cima, e a Série B. A T2 tem só a Série A, com 16 Times em dois Grupos; da T3 em diante, cada Série tem 8 (ADR-0062 e ADR-0064). Cada Série tem a sua Fase de Liga, o seu Mata-mata, o seu Título e os seus Craques.
_Avoid_: divisão, grupo, chave

**Grupo**:
Na T2, cada uma das duas metades da Série A de 16: o Grupo do Barro e o Grupo do Galho, com 8 Times cada e os Clássicos juntos. Cada Time joga contra os outros 7 do seu Grupo; os 2 primeiros vão às Semifinais (1º de um contra o 2º do outro) e os 4 últimos caem para a Série B da T3 (ADR-0064).
_Avoid_: chave, conferência, divisão

**Acesso**:
A subida de um Time da Série B para a Série A no fim da Temporada. Ganham o Acesso os dois finalistas do Mata-mata da Série B.
_Avoid_: promoção, subida

**Rebaixamento**:
A descida de um Time da Série A para a Série B no fim da Temporada. Os Jogadores descem com o Time. No fim da T2, caem os quatro últimos de cada Grupo e formam a Série B da T3; da T3 em diante, caem os dois últimos (ADR-0062 e ADR-0064).
_Avoid_: descenso, queda, degola

**Capitão**:
O Jogador com mais Partidas por um Time, que escolhe a Postura e a Formação antes de cada Partida. Se não tiver Vínculo ou estiver suspenso, a faixa passa para o próximo com Vínculo. O dono pode pôr a faixa à mão num Jogador, que fica na frente da ordem até o dono tirar ou ele mudar de Time (ADR-0079). A partir da T3, com Técnico ativo, fica com os Batedores, os cobradores, a Chamada da Presença, a Marcação individual, o Grito da Temporada, a Braçadeira e as Sugestões; sem Técnico, decide também tudo o que seria do Técnico (ADR-0110, ADR-0111).
_Avoid_: líder, dono do time

**Técnico**:
O seguidor que não joga e cuida de um Time a partir da T3: decide a Postura, a Formação, até 3 titulares fixados, os Pedidos de Transferência, os Convites e a Fila. Precisa da aprovação do dono e de um Vínculo de Técnico. Um Jogador vira Técnico pendurando as chuteiras (ADR-0110).
_Avoid_: treinador, professor, comandante

**Pendurar as chuteiras**:
Deixar de jogar para virar Técnico. O Jogador sai do Elenco quando o dono aprova, guarda o boneco, a Carreira, as Moedas e os Itens, e pode voltar a jogar na Janela seguinte (ADR-0110).
_Avoid_: aposentar, parar

**Titular fixado**:
Um dos até 3 Jogadores que o Técnico (ou o Capitão, sem Técnico) garante no próximo jogo, mesmo sem Presença; as outras vagas seguem o rodízio (ADR-0110).
_Avoid_: titular absoluto, intocável

**Sugestão do Capitão**:
A Postura, a Formação e até 3 titulares que o Capitão sugere ao Técnico. Vale se o Técnico não decidir até o Corte (ADR-0110).
_Avoid_: recomendação, palpite

**Pedido de Transferência**:
A Transferência que, a partir da T3, espera o aceite do Técnico (ou do Capitão) do Time de destino: 24 horas ou até o Corte, e o silêncio vale como aceito. Recusado, não gasta a troca (ADR-0110).
_Avoid_: proposta, solicitação

**Convite**:
O Interesse de um Time por um Jogador de outro Time, mandado pelo Técnico (ou pelo Capitão). Aceito, o Jogador troca na hora (ADR-0110).
_Avoid_: proposta, sondagem, oferta

**Troca casada**:
Dois Jogadores da mesma Posição, em Times diferentes, trocando de lugar sem precisar de vaga. Os dois precisam aceitar (ADR-0110).
_Avoid_: permuta, troca simples

**Fila de espera**:
A ordem de chegada de quem quer uma Posição cheia num Time, novato ou veterano. Quando abre a vaga, o primeiro entra ou vira Pedido (ADR-0110).
_Avoid_: lista de espera, reserva

**Marcação individual**:
O rival de linha que o Capitão manda um zagueiro ou meia seu marcar de perto, em segredo até o Corte: mais vantagem nos duelos contra ele, mais faltas (ADR-0111).
_Avoid_: marcação homem a homem, encaixe

**Chamada da Presença**:
O Aviso que o Capitão manda, uma vez por jogo, para o Elenco confirmar a Presença antes do Corte (ADR-0111).
_Avoid_: convocação

**Grito da Temporada**:
O Grito de guerra que o Capitão escolhe na Janela entre 3 opções, valendo a Temporada toda (ADR-0111).
_Avoid_: hino, música

**Braçadeira**:
A faixa de Capitão no braço do boneco em campo (ADR-0111).
_Avoid_: faixa, tarja

**Postura**:
A atitude do Time numa Partida (Ofensiva, Equilibrada ou Defensiva), escolhida em segredo pelo Capitão até o Corte. Sem escolha, é Equilibrada.
_Avoid_: tática, estratégia, esquema

**Batedores**:
A ordem dos 5 primeiros cobradores da Disputa de pênaltis, escolhida pelo Capitão junto com a Formação e a Postura, a partir da T3. Quem não está em campo é pulado; depois dos 5, vale a ordem automática (ADR-0091).
_Avoid_: cobradores, lista de pênaltis

**Plano do Time**:
A Formação, a Postura e, a partir da T3, os Batedores, os titulares fixados, os cobradores e a Marcação escolhidos para o próximo jogo, mostrados na página do Time para o Técnico e para quem tem Vínculo com um Jogador daquele Time (a Marcação fica em segredo para o rival). O Técnico e o Capitão fazem as escolhas ali. A escalação provável dessa página sai na Formação do plano. ADR-0086, ADR-0091 e ADR-0110. Antes da T3, Plano do Capitão.

**Formação**:
O desenho do Time em campo na Temporada 2: quantos zagueiros, meias e atacantes jogam (2-2-2, 2-3-1, 3-2-1 ou 3-1-2; o goleiro é sempre um). Escolhida pelo Capitão junto da Postura, até o Corte; sem escolha, 2-2-2. As vagas da Escalação seguem a Formação. ADR-0044.
_Avoid_: esquema tático, sistema, escalação (a Escalação é quem joga)

**Fora de posição**:
O Jogador que ocupa a vaga de outra Posição porque a Formação pediu mais gente numa Posição do que o Time tinha disponível. Joga com o OVR calculado pelos pesos da vaga. ADR-0044.
_Avoid_: improvisado, adaptado

**Jogada da Formação**:
O lance próprio de cada Formação, que aparece no vídeo e o Narrador chama pelo nome: Tabela (2-3-1), Cobertura (3-2-1) e Ligação direta (3-1-2). O 2-2-2 não tem. ADR-0044.
_Avoid_: jogada ensaiada (é a cobrança de falta curta)

**Tabela**:
Jogada da Formação do 2-3-1: o meia que cria toca para outro meia (o apoio) e recebe de volta antes de criar, o que deixa a criação mais fácil.
_Avoid_: tabelinha, parede, um-dois

**Cobertura**:
Jogada da Formação do 3-2-1: quando o atacante dribla o marcador, o zagueiro da sobra (o terceiro zagueiro) chega para mais um desarme.
_Avoid_: sobra, segundo homem

**Ligação direta**:
Jogada da Formação do 3-1-2: um zagueiro lança direto para os atacantes, sem passar pela criação do meia. Ele leva a assistência; se o rival corta, é desarme.
_Avoid_: chutão, bola longa, lançamento (o lançamento é só um estilo do desenho)

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
O período da Pré-temporada, até o Corte do primeiro jogo da Temporada, em que qualquer Jogador pode trocar para qualquer Time, de qualquer Série, desde que o destino não fique desequilibrado. Conta a hora do pedido. Não gasta a Transferência da Temporada (ADR-0022, ADR-0096).
_Avoid_: mercado, janela de inverno

**Rebalanceamento**:
A redistribuição dos Elencos quando a T2 nasce, para que todos os inscritos joguem. Acontece dentro da Série A: cada Time fundador fica com os 7 primeiros inscritos, e os mais recentes vão para o Time Primo, um dos 8 Times que chegaram na T2 direto na A. Ninguém vai para a Série B (ADR-0036 e ADR-0058).
_Avoid_: rebaixamento, corte, remoção

**Time Primo**:
O Time que forma par fixo com outro. No Rebalanceamento, cada fundador tem como Primo um dos Times que chegaram na T2 (exemplo: Onça → Jacaré). Os pares com os Times guardados para a Série B (exemplo: Jacaré → Teiú) não valem enquanto esses Times não jogarem (ADR-0058 e ADR-0062).
_Avoid_: time irmão, time filial

**Fundador**:
O título de quem começa a primeira Temporada de um Time novo no Elenco dele (na T2, os 8 Times que chegaram na Série A; na Expansão, quem entra num dos 4 Times novos, pela Inscrição ou pela troca de graça, até o Corte do primeiro jogo da Temporada). Aparece na página de Carreira e dá prioridade na escolha da camisa.
_Avoid_: pioneiro, membro original

**Selo da Temporada 1**:
O selo de quem se inscreveu na Liga até o último jogo da Temporada 1. Aparece na página de Carreira e dá o Piso e o Bônus da Temporada 1 (ADR-0047). Não é o título de Fundador.
_Avoid_: fundador, veterano, OG

**Piso da Temporada 1**:
O OVR mínimo (65) dado uma vez, na Pré-temporada da T2, a quem tem o Selo da Temporada 1. Só a Habilidade principal da Posição sobe (ADR-0047).
_Avoid_: nivelamento, bônus de OVR

**Bônus da Temporada 1**:
Os ganhos de Habilidade 1,5 vez maiores, nas 2 primeiras Rodadas da T2, para quem tem o Selo da Temporada 1. Soma com a Resenha e respeita o teto por Partida (ADR-0047).
_Avoid_: buff, boost

**Partida**:
Um confronto simulado entre dois Times, com Apito Inicial marcado. Pode ser vista Ao Vivo ou em Replay no site e ganha um Reels próprio assim que termina.
_Avoid_: jogo, match

**Contra-ataque**:
Lance logo depois de o rival perder a bola com gente adiantada. Se a defesa não recompõe, o 1º zagueiro (ou, depois de escanteio, também o marcador) fica fora do lance (ADR-0015).
_Evite_: contragolpe

**Saída de bola**:
O recomeço depois de um gol: um Jogador do Time que sofreu toca a bola no meio de campo. Quem sofreu fica com a bola na maioria das vezes, mas pode perdê-la no Duelo de Posse logo depois. ADR-0045.

**Marcação dupla**:
Quando os dois zagueiros vão juntos no mesmo finalizador. O Duelo fica mais difícil para quem ataca, mas um companheiro fica livre; se o passe sai, ele chuta sem marcador. ADR-0045.

### Espetáculo

**App**:
O site da Liga instalado no celular (PWA), com ícone na tela inicial e tela cheia. É o mesmo site, não um aplicativo de loja (ADR-0040).
_Avoid_: aplicativo, app nativo, baixar da loja

**Abas do App**:
A barra de baixo do site no celular: Rodada, Jogos, Tabela, Times e Mais (Jogadores, Temporada, História, Avisos). No computador fica o menu no topo (ADR-0103).
_Avoid_: menu inferior, tab bar, rodapé de navegação

**Subaba**:
Cada parte de uma tela comprida no celular, escolhida na barra logo abaixo do topo: Escalação, Elenco, Jogos e Troféus no Time; Números, OVR e Jogos no Jogador; Replay ou Ao Vivo, Escalações e Lance a lance na Partida; uma por Rodada e o Mata-mata em Jogos; um Grupo (ou Série) por vez na Tabela. No computador a tela mostra tudo, como antes (ADR-0103).
_Avoid_: aba interna, guia, tab

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
O boneco que apita as Partidas desde a T2: acompanha o lance, apita a falta e mostra o Cartão. Na T2 é só visual; a partir da T3, o Perfil do Juiz muda a chance de Falta e de Cartão (ADR-0094). Não tem nome escrito.
_Avoid_: árbitro, apitador

**Perfil do Juiz**:
O jeito de apitar do Juiz, a partir da T3: Rigoroso, Normal ou Deixa jogar, sorteado para cada Partida. Muda a chance de Falta e de Cartão; aparece na Escalação e o Narrador comenta no Apito Inicial (ADR-0094).
_Avoid_: humor do juiz, critério

**Clima**:
O tempo da Partida (sol, chuva ou lama), sorteado para cada Partida. Muda o visual e a fala do Narrador, e não decide nenhum lance.
_Avoid_: tempo, condição do campo

**Segundo uniforme**:
A camisa alternativa que um Time usa quando as suas cores se confundem com as do adversário.
_Avoid_: camisa reserva, uniforme dois

**Número da camisa**:
O número de 1 a 99 que o Jogador escolhe no site, único dentro do Time. Aparece nas costas do boneco, no Reels, no Ao Vivo e no Replay. A Escalação guarda o número da época do jogo; quem não escolheu joga de camisa lisa (ADR-0075).
_Avoid_: dorsal, número do jogador

**Aparência**:
A pele, a cor do cabelo e o penteado do boneco do Jogador, que o dono escolhe de graça no site. Sem escolha, vale a sorteada pelo @ (sempre a mesma).
_Avoid_: visual, skin, avatar

### Economia

**Moedas**:
O dinheiro da Liga, ganho com o Salário e os prêmios e gasto só na Loja. Não compra OVR, Habilidade, vaga na Escalação nem Transferência. Começa a contar na Pré-temporada da T3, com a Copa (ADR-0087 e ADR-0092).
_Avoid_: dinheiro, coins, pontos, bufunfa

**Salário**:
As Moedas que todo Jogador do Elenco recebe a cada Rodada, jogando ou não, iguais na Série A e na B. Somam-se os prêmios por gol, assistência, Seleção da Rodada, Craque da Rodada e Título (ADR-0087).
_Avoid_: pagamento, recompensa, renda

**Loja**:
A página do site e do App onde o Jogador com Vínculo gasta Moedas em Itens para o boneco. Abre pela sacola no canto do topo, que mostra o saldo a quem tem Vínculo. A Aparência e o Número da camisa continuam grátis e não estão na Loja (ADR-0087 e ADR-0101).
_Avoid_: shop, mercado, vitrine

**Item**:
Peça visual comprada na Loja (Chuteira colorida, Acessório, penteado ou barba novos, Comemoração de gol), básica ou rara. É do Jogador para sempre e pode ser trocada sem pagar de novo. A Escalação guarda os Itens da época do jogo (ADR-0087).
_Avoid_: skin, cosmético, acessório (para o conjunto)

**Encaixe**:
O lugar do boneco onde vai um Item: Chuteira, Munhequeira, Faixa na cabeça e Luva do goleiro (Itens de cor) e, na segunda fase, Penteado, Barba e Comemoração de gol (Itens de desenho). Só um Item equipado por Encaixe; a Luva só aparece no goleiro (ADR-0101).
_Avoid_: slot, espaço, categoria

**Comemoração de gol**:
O Item raro que dá ao boneco uma animação curta (cerca de 1 s) quando ele marca, no Reels, no Ao Vivo e no Replay (ADR-0087).
_Avoid_: dancinha, celebração, emote

**Palpite**:
O placar que o Jogador com Vínculo aposta para uma Partida, pelo site, até o Corte. Acertar o resultado vale 2 Moedas e o placar exato vale 5, com teto de 10 Moedas de Palpite por dia; o que passa do teto conta só no ranking de Palpites. Na Disputa de pênaltis, vale o placar dos 90 minutos (ADR-0089).
_Avoid_: aposta, bolão, chute

**Conquista**:
Marco da Carreira ganho uma vez só (primeiro gol, hat-trick, 20 gols etc.), que vira selo na página de Carreira e paga 5, 10 ou 20 Moedas conforme a dificuldade. O que foi feito na T1 e na T2 dá só o selo (ADR-0090).
_Avoid_: troféu, medalha, achievement, Título

**Trave**:
O chute que bate no poste ou no travessão e não entra, a partir da T3 (ADR-0094).
_Avoid_: poste, bola no ferro

**Rebote**:
A bola que o goleiro defende e solta, a partir da T3. Um atacante disputa com um zagueiro: se o atacante vence, chuta de novo; se o zagueiro vence, afasta (ADR-0094).
_Avoid_: sobra, segunda bola

**Chute de longe**:
O chute de fora da área do meia ou, mais raro, do zagueiro, sem Duelo com o zagueiro rival: Finalização contra Goleiro. Existe de verdade a partir da T3; antes era só um jeito de desenhar o lance (ADR-0094).
_Avoid_: bomba, chute de fora

**Pressão final**:
Nos últimos 15 minutos, o Time que perde por 1 ou 2 gols (ou, no Mata-mata e na Copa, está empatado) se lança ao ataque: mais lances dele e mais Contra-ataques do rival. A partir da T3 (ADR-0094).
_Avoid_: abafa, blitz, desespero

**Acréscimos**:
Os 1 a 4 minutos a mais no fim do segundo tempo, a partir da T3, mostrados na tela e anunciados pelo Narrador (ADR-0094).
_Avoid_: tempo extra, prorrogação

**Gol de placa**:
O gol com drible no marcador que ainda vence a Cobertura, ou o Chute de longe muito acima do Goleiro, a partir da T3. Ganha câmera lenta e fala especial; o primeiro de cada Jogador é uma Conquista (ADR-0094).
_Avoid_: golaço, pintura
