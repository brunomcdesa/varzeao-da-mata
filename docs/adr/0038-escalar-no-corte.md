# Escalação no Corte, separada da gravação

No dia 11/11 as Escalações do jogo das 12h não saíram no Corte. O job `partida` fazia tudo em sequência: instalava o Chromium e o ffmpeg, esperava o Corte, escalava, simulava, gravava os Reels e só no fim publicava o site. A instalação travou (ADR-0037), e com ela a Escalação, o Ao Vivo e o site ficaram parados. Mesmo nos dias normais, o site só mostrava as Escalações uns 8 minutos depois do Corte, quando a gravação terminava.

**Decisão.** A etapa do Corte vira uma função só (`etapaDoCorte`), usada por dois jobs que a borda dispara no mesmo minuto (35 min antes do Apito):

- **`escalar`** (novo, leve): instala só as dependências do Node, sem vídeo. Espera o Corte, lê os comentários, os votos e os pedidos do site, escala e simula todas as Partidas do horário, guarda cada uma no bucket privado para o Ao Vivo e publica o site.
- **`partida`**: faz a etapa do Corte se ela ainda não foi feita e depois grava, sobe e agenda os Reels. Ele também publica o site logo depois da etapa do Corte, e não só no fim.

Os dois podem fazer a etapa ao mesmo tempo. A Escalação já travava a Partida no banco (`FOR UPDATE`), e a simulação passa a travar também. Quem chega depois espera e encontra a Partida já escalada e simulada, com o mesmo seed e o mesmo resultado. Ler os comentários duas vezes é seguro, porque o leitor ignora o que já processou.

**Consequência.** As Escalações e o Ao Vivo dependem só do Node e do banco, e saem no Corte mesmo se a instalação ou a gravação do vídeo falharem. O custo é um job a mais por horário, de cerca de 1 minuto além da espera pelo Corte, e uma leitura a mais dos comentários. Se o `escalar` falhar, o `partida` cobre como antes.
