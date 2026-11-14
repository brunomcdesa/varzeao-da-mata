# T2: ninguém da Série A desce na estreia das Séries

Status: decidido em 14/11/2026. Só o primeiro passo (desligar o Rebalanceamento automático) já
está no código; o resto vem num branch próprio.

Substitui, para a T2, o Rebalanceamento do ADR-0036 (quem sobrava num Time da A ia para o Time
Primo da B). Descer para a B logo na estreia soava como punição para quem jogou a T1.

## Decisões

- **Série A com 16 Times:** os 8 fundadores mais os 8 Times criados para a T2 (Jacaré, Sucuri,
  Lobo-guará, Cachorro-do-mato, Boto, Pirarucu, Coruja, Morcego).
- **Série B com 8 Times totalmente novos**, que ainda vão ser criados.
- **Rebalanceamento dentro da A:** os Times com Elenco maior passam os inscritos mais recentes
  para os Times da A com menos gente, na mesma Posição. Ninguém vai para a B.
- **Novatos:** entram na A até cada Time da A ter 8 e, depois disso, na B. Quem pede um Time da
  A já cheio vai para o Time Primo dele na B, com resposta explicando.
- **Calendário:** a A tem 15 Rodadas em turno único, e a B joga turno e returno (14 Rodadas)
  para as duas Séries terminarem juntas.
- **Acesso e Rebaixamento:** a partir do fim da T2, 2 sobem e 2 descem.

## Já aplicado

O Rebalanceamento do ADR-0036 não roda mais sozinho quando a T2 nasce. Sem ele, o Reels de
agradecimento da T1 (terça 17/11, 20h) sai sem as cartelas de Rebalanceamento e Fundador, que
já ficavam de fora quando ninguém tinha sido movido.
