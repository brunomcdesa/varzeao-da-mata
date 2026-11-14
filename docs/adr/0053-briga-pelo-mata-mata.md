# Briga pelo Mata-mata na última Rodada

Na última Rodada da Fase de Liga, o Narrador não dizia o que cada Partida valia. Agora a Partida da última Rodada carrega `briga` (`BrigaPeloMataMata`: a classificação da Série antes do Apito Inicial e as Partidas que ainda faltam depois dela), no `DadosDoVideo` e na `PartidaPublica`, e o Narrador e a tela usam isso.

## A regra: só o que é certo de verdade

`situacoesNaBriga` testa todos os resultados (vitória, empate, derrota) das Partidas que faltam. Um Time é **Garantido** se em todos ele fica entre os 4 primeiros e **Eliminado** se em nenhum fica; senão, "depende". O desempate é o da tabela (pontos, vitórias, saldo, gols, sigla). Saldo e gols de quem ainda vai jogar não são conhecidos: nesse empate, conta como "pode passar na frente". Assim nunca erra; no pior caso diz "depende" quando a conta exata daria Garantido.

Conta só o que foi jogado antes do Apito Inicial da Partida. A Partida de horário mais tarde, mesmo já simulada, conta como "falta": o Narrador não sabe o futuro.

`necessidadeNaBriga` faz a mesma conta fixando só quem vence esta Partida: "Empate basta", "Vencendo, classifica", "Vence e torce" (mesmo vencendo, depende dos outros) e "Depende dos outros".

## Na tela (o Narrador só fala do que aparece)

- **Abertura do Reels:** subtítulo "Última Rodada, jogo das 14h", placa "Vale vaga no Mata-mata", linha "Já garantidos: Arara, Capivara" (os que não jogam esta Partida) e uma plaquinha embaixo da faixa de cada Time com o que ele precisa ("Empate basta", "Já garantido"…).
- **Jogo (Reels, Ao Vivo e Replay):** uma viga no topo, de onde a tábua do placar pende, com "Última Rodada · Garantidos: Arara, Capivara" e uma plaquinha embaixo de cada sigla. Até os 10 minutos, com 0 × 0, ela diz do que o Time precisa; depois segue o placar: "Assim: classifica / fora / depende" (verde, vermelho, amarelo). No apito final: "Classificado", "Eliminado" ou "Depende das 18h". Quem já estava decidido fica "Já garantido" ou "Já eliminado".
- **Fim do Reels:** embaixo de "Fim de jogo", "Tatu no Mata-mata! · Onça depende dos outros jogos".

## O que o Narrador fala

- **Abertura:** "Última Rodada da Fase de Liga, valendo vaga no Mata-mata!"
- **Começo:** "A Arara e a Capivara já estão garantidas no Mata-mata! Será que Onça e Tatu também garantem?", "Um empate já basta pra Onça!", "O Tatu precisa vencer e ainda torcer pelos outros resultados!", "O Tatu já está fora, joga pela honra." No Reels, na cartela de abertura; no Ao Vivo, no começo do jogo.
- **Gol que muda a situação (Reels) / depois de gol e reta final (Ao Vivo):** "Se terminar assim, o Tatu está no Mata-mata, e a Onça ainda depende dos outros jogos!"
- **Fim:** "O Tatu está no Mata-mata e vai brigar pelo título!", "A Onça agora depende do jogo das 18h.", "O Tamanduá está fora do Mata-mata."

Com duas Séries, as falas dizem a Série ("valendo vaga no Mata-mata da Série B").

## Por que não sobe a versão da simulação

Nada disso mexe na simulação. Partidas já gravadas não são regravadas; vale a partir da próxima Partida da última Rodada gravada.
