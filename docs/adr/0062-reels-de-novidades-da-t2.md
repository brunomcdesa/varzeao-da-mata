# Reels de Novidades da Temporada 2

Status: decidido em 16/11/2026, com a prévia aprovada pelo dono.

## Contexto

A Abertura da T2 (terça 17/11, 21h) avisa que "amanhã sai um Reels pra cada novidade". O dono
quis as novidades em Reels curtos por tema, em vez de um Reels gigante, e que todos saiam
sozinhos no horário, sem passo manual (ADR-0051).

## Decisão

- Quatro Reels Programados na quarta 18/11, um por tema, nos horários dos jogos da T1 (12h,
  14h, 16h e 18h de Brasília):
  1. **Dentro de campo**: Juiz, Falta e Cartão, pênalti, Barreira, escanteio, Arquibancada com
     Grito de guerra, Clima e Segundo uniforme, Substituição (ADR-0061) e os cinco Narradores.
  2. **Capitão**: quem é, Postura, Formação e as três Jogadas da Formação.
  3. **Seu Jogador**: Vínculo, Apelido, Especialização, Treino, Presença, Resenha, Canto e
     Seleção da Rodada.
  4. **Site e App**: App, Avisos, Público e Reações do Ao Vivo e Página de Carreira.
- O que acontece em campo aparece no próprio jogo: trechos de Partidas de exemplo da T2,
  simuladas com sementes fixas (o mesmo trecho sempre), com uma legenda embaixo. O resto vai em
  cartelas, no estilo dos outros Reels de anúncio.
- Os nomes em cima dos bonecos das Partidas de exemplo são apelidos inventados, nunca um @.
- Cada Reels tem o seu Narrador (Rita Rádio, Tiago Turbo, Beto Bola e Zé da Várzea); no de
  dentro de campo, cada um dos cinco se apresenta com a própria voz.
- Cada Reels termina com a estreia e chama o seguinte pelo horário; o último chama para o link
  da bio.
- As Reações aparecem com os emojis padrão (imagens guardadas no renderer), não em pixel art.

## Consequências

- O job `programados` grava os quatro sem depender do banco (só da data da estreia).
- Cota do Gemini: cerca de 40 falas no dia, numa quarta sem jogos.
- A reserva do GitHub (cron) cobre os quatro horários, 90 e 60 minutos antes. Com 2 h entre um
  e outro, a janela de gravação do seguinte já abre no disparo do anterior; a marca de
  "já agendado" evita gravar duas vezes.
