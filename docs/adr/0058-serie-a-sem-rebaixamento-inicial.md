# T2: ninguém da Série A desce na estreia das Séries

Status: decidido em 14/11/2026 e 16/11/2026. Implementado no branch `t2-series-16-8`.

Substitui, para a T2, o Rebalanceamento do ADR-0036 (quem sobrava num Time da A ia para o Time
Primo da B). Descer para a B logo na estreia soava como punição para quem jogou a T1.

## Decisões

- **Série A com 16 Times:** os 8 fundadores mais os 8 Times criados para a T2 (Jacaré, Sucuri,
  Lobo-guará, Cachorro-do-mato, Boto, Pirarucu, Coruja, Morcego).
- **Série B com 8 Times totalmente novos:** Quati, Gambá, Jabuti, Teiú, Ariranha, Anta,
  Seriema e Bugio, em 4 Clássicos (do Quintal, do Sol, da Lagoa e do Grito).
- **Rebalanceamento dentro da A:** cada Time fundador fica com os 7 primeiros inscritos, e os
  mais recentes vão para o Time Primo (um dos 8 Times que chegaram na A), na mesma Posição.
  Ninguém vai para a B. Quem foi movido vira Fundador do Time novo.
- **Novatos:** entram na A pelo Limite por Posição (o dobro das vagas: 2 goleiros e 4 em cada
  Posição de linha). Posição cheia no Time pedido: vai para outro Time da A com vaga nela (o
  que tem menos gente na Posição). Só sem vaga em nenhum Time da A o novato começa na B, no
  Time Primo do pedido (cada Clássico da B é Primo de dois Clássicos da A), na mesma Posição.
  Nos dois casos, a resposta no comentário explica. Na B vale o equilíbrio de Elencos.
  Transferência compara o equilíbrio só com os Times da Série do destino.
- **Calendário:** uma Rodada por dia. A A tem 15 Rodadas em turno único, com 2 jogos em cada
  horário das 15h às 18h. A B joga turno e returno (14 Rodadas), das 11h às 14h, e folga no
  dia 15. Semifinais na Rodada 16 e Final na 17, com os 4 melhores de cada Série.
- **Acesso e Rebaixamento:** a partir do fim da T2, 2 sobem e 2 descem.

## Consequências

- São 12 jogos por dia (antes, 8): mais Reels e mais pedidos de voz ao Gemini. O cache de falas
  segura parte disso, mas a cota deve ser acompanhada na primeira semana.
- O workflow de Partida grava os dois jogos da A do mesmo horário em sequência. Hoje um jogo
  leva cerca de 14 minutos, então os dois cabem na janela antes do Apito, mas com pouca folga.
- O Reels de Abertura da T2 e o Resumo da Rodada (tabela de 16 e 8 placares em formato
  compacto) mudaram junto.

## Reels de agradecimento

O Reels de agradecimento da T1 (terça 17/11, 20h) não fala do Rebalanceamento: o formato novo
das Séries é contado na Abertura da T2, às 21h.
