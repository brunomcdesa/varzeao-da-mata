# Técnico e Interesse

A partir da Janela da T3, cada Time pode ter um Técnico: um seguidor que não joga, aprovado pelo dono da Liga, que cuida do Elenco e da Escalação. O Jogador declara Interesse num Time pedindo a Transferência, e o Técnico aceita ou recusa; o Time declara Interesse num Jogador com um Convite. Para a Posição cheia, existem a Troca casada e a Fila de espera. Sem Técnico, quem decide é o Capitão; sem Capitão com Vínculo, valem as regras automáticas de antes.

## Técnico

- **Quem é:** um seguidor sem Jogador inscrito. Pede um Time na DM da Liga, ou um Jogador pede pelo site para pendurar as chuteiras e treinar um Time. O primeiro pedido de cada Time fica, e só vale depois da aprovação do dono, que libera um código de Vínculo de Técnico. Um Técnico por Time e um Time por Técnico.
- **Pendurar as chuteiras:** o Jogador sai do Elenco só quando o dono aprova. Leva o boneco, a Carreira, a carteira de Moedas e os Itens, que ficam guardados. Pode voltar a jogar na Janela seguinte, com o OVR e as Habilidades de quando parou, entrando pelo Limite por Posição ou pela Fila.
- **Técnico que se inscreve:** se o Técnico comentar ENTRO, a Inscrição vale, ele perde o cargo e é avisado.
- **O que decide:** Postura, Formação e até 3 titulares fixados para o próximo jogo. Os fixados entram mesmo sem Presença, travam no Corte e contam no rodízio normal; suspenso não pode ser fixado. Se a Formação não tiver vaga para a Posição de um fixado, ele volta para o rodízio. Decide também os Pedidos de Transferência, os Convites, a sua parte das Trocas casadas e a Fila do Time.
- **Prazos:** o Técnico tem 24 horas, ou até o Corte do próximo jogo do Time se vier antes, para responder a um Pedido ou à sua parte de uma Troca casada. O silêncio vale como aceito.
- **Perde o cargo:** se ficar 3 jogos seguidos do Time sem decidir nada, se pedir para sair ou se o dono tirar. O cargo continua de uma Temporada para a outra e acompanha o Time se ele subir ou cair.
- **Muda de Time:** só na Janela, para um Time sem Técnico, com a aprovação do dono.
- **Moedas:** Salário de 10 por Rodada, 3 por vitória do Time (inclusive na Copa) e os Títulos iguais aos dos Jogadores (A 50, B 30, Copa 40). Quem não joga ganha uma carteira própria.
- **Boneco e Loja (Rodada 4 da Liga da T3):** boneco à beira do campo, perto do Banco, no Ao Vivo, no Replay e nos Reels, congelado na Escalação. Vibra no gol a favor, põe a mão na cabeça no gol sofrido e reclama nos cartões contra o Time. O visual se monta como o de um Jogador. Começa com o agasalho do Time; a Loja tem Boné, Óculos escuros, Prancheta e Apito no pescoço (básicos, 20) e Terno (raro, 100). Time sem Técnico fica com a beira do campo vazia. Como ficou: a área técnica de cada Time (chão de terra e Banco de madeira) toma um pedaço da Arquibancada logo abaixo da faixa do Time, à esquerda o mandante e à direita o visitante; ela aparece em toda Partida escalada a partir do dia da Rodada 4 da Liga da T3, e o Técnico fica congelado na Escalação (`tecnico_na_partida`) com os Itens dele. O Boné sai na cor do Time. Na cartela da Escalação do site aparecem o Técnico, o selo "fixo" nos titulares fixados e, depois do Apito, a Marcação individual.
- **Público:** nome na página do Time e na cartela da Escalação, que também marca os titulares fixados. O Narrador fala do Técnico na Escalação e quando ele vibra no gol, como "o Técnico do Tatu", ou pelo Apelido, se ele tiver.

## Capitão com Técnico

O Capitão continua sendo o Jogador com mais Partidas pelo Time. Com Técnico ativo, ele fica com:

- a Braçadeira no boneco em campo e o selo na Carreira (com ou sem Técnico);
- os Batedores, e com eles o pênalti durante a Partida (bate o primeiro Batedor em campo);
- os cobradores de escanteio (1 e 1 reserva), a Chamada da Presença, a Marcação individual e o Grito da Temporada (ADR-0112);
- as Sugestões: Postura, Formação e até 3 titulares (nunca ele mesmo), que o Técnico vê antes de decidir. Se o Técnico não decidir até o Corte, vale a Sugestão.

Sem Técnico, o Capitão com Vínculo decide tudo o que seria do Técnico, com os mesmos prazos, com duas travas: Pedido ou Troca casada na Posição dele não passa por ele (vale o prazo e depois o aceite), e ele nunca fixa a si mesmo como titular.

## Interesse

- **Pedido de Transferência:** o TRANSFERIR de sempre ou o botão "Quero jogar aqui" na página do Time (com Vínculo). Com Técnico ou Capitão com Vínculo no destino, vira Pedido; sem nenhum dos dois, a troca é direta como antes. Recusar não tem limite, e o Pedido recusado não gasta a troca. A Inscrição de novato continua direta.
- **Quem caiu na T2:** na Janela da T3, a troca para um Time da Série A é direta (ADR-0062), respeitando o Limite por Posição e o equilíbrio de Elencos.
- **Convite:** o Técnico (ou o Capitão sem Técnico) convida um Jogador de outro Time, até 3 Convites abertos, cada um valendo 24 horas ou até o Corte. Só vai para Jogador com Vínculo. Se o Jogador aceitar, troca na hora, gastando a troca da Janela ou da Temporada.
- **Posição cheia:** o Pedido nem chega ao Técnico, não gasta a troca e a resposta lista os Times com vaga. No site, a Posição aparece travada, e ninguém convida para ela.
- **Troca casada:** dois Jogadores da mesma Posição, em Times diferentes, trocam de lugar sem precisar de vaga. Propõe o Jogador ou o Técnico. Os dois Jogadores precisam aceitar de forma explícita, e os Técnicos (ou Capitães) têm o prazo, com silêncio valendo como aceito. Só com Vínculo, até 3 propostas abertas por pessoa, cada uma valendo 24 horas ou até o Corte. Gasta a troca de cada um; quem já gastou não pode propor nem receber.
- **Fila de espera:** quem pede uma Posição cheia entra na fila do Time e da Posição, em ordem de chegada, numa fila por vez. Novato e veterano dividem a mesma fila. Quando abre a vaga, o novato entra direto e o veterano vira Pedido; se o Técnico recusar, sobe o próximo. A fila vale até o fim da Janela ou da Temporada, e cada um vê a sua vez no site.
- **Avisos:** Aviso no App para o Técnico (Pedido novo) e para o Jogador (Convite, Troca casada e resposta), quando o aparelho tem Vínculo e Avisos ligados; tudo também fica no painel. Pedido feito por comentário é respondido no comentário. Como funciona: o aparelho ganha o dono quando os Avisos são ligados com Vínculo (ou na abertura do App, se o Vínculo veio depois); cada Aviso entra na fila `aviso_pessoal` e o worker marca `aviso/pessoal` no KV; o cron da borda só abre o banco quando há a marca (o banco não acorda a cada minuto). Os pessoais não se substituem na bandeja. A Chamada da Presença do Capitão (ADR-0112) usa a mesma fila.

## Ajustes

- No aceite, inclusive o automático, o sistema confere tudo de novo: vaga na Posição, equilíbrio, troca ainda não gasta e Janela aberta. Se algo falhar, o Pedido cai sem gastar a troca, com aviso.
- Se a faixa de Capitão muda durante um prazo, o Pedido passa para o novo Capitão. Se o Técnico sai, o que estava aberto passa para o Capitão.
- O Pedido feito na Janela que vence no Corte conta como troca da Janela, pela hora do Pedido (ADR-0096).
- Times da Expansão sem Técnico nem Capitão: a troca de graça continua direta. Com Técnico, vira Pedido, e continua de graça (ADR-0093).
- O Apelido do Técnico passa pelo mesmo filtro do Apelido dos Jogadores.
- O Plano do Capitão vira Plano do Time: o Técnico e o Capitão veem e mexem; os Jogadores com Vínculo continuam vendo.

## Entrega

Tudo na Janela da T3, menos o boneco do Técnico, a Braçadeira, os gestos e a Loja do Técnico, que entram na Rodada 4 junto da Loja fase 2. O Reels "Técnico e Interesse" sai domingo, 29/11, às 10h, para dar tempo de pedirem na DM antes do Corte. Se a Janela apertar, o núcleo (Técnico, Capitão como reserva e Pedido com prazo) entra nela e o resto vai para a Rodada 4.

## Considered Options

- **Técnico como Jogador do Elenco:** rejeitada; um Jogador decidindo Escalação e Pedidos da própria Posição tem interesse próprio. Quem joga pode virar Técnico pendurando as chuteiras.
- **Técnico automático da Liga:** rejeitada; o papel é para dar mais uma forma de participar.
- **Transferência só como sinal:** rejeitada; o pedido de aceitar ou recusar a contratação era o ponto.
- **Inscrição de novato pelo Técnico:** rejeitada; ninguém fica de fora da Liga por decisão de um Técnico.
- **Dispensa pelo Técnico e vaga de inativo:** rejeitadas para destravar Posição cheia; ficaram a Troca casada e a Fila.
