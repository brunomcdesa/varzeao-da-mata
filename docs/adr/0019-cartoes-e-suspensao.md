# Cartões e Suspensão

As Partidas passam a ter cartões. O vermelho expulsa o Jogador, e o Time joga com 6 até o fim. Ele também suspende o Jogador por 1 Partida. Dois amarelos acumulados na Temporada suspendem 1 Partida.

Motivo: os cartões dão drama ao jogo e à Rodada seguinte, e fazem o rodízio da Escalação girar.

## Regras

- **Suspensão:** o Jogador suspenso não entra na Escalação. O rodízio escolhe outro do Elenco e, se não houver, a vaga fica com um Jogador da Base.
- **Simulação:** os cartões e a expulsão são decididos na simulação e sobem a `VERSAO_SIM` para 4, junto com a Postura (ADR-0018), a Especialização e o Pênalti com canto (ADR-0021).
- **Capitão suspenso:** a faixa de Capitão passa para o próximo (ADR-0018).

## Considered Options

- **Vermelho só suspende a próxima Partida, sem expulsar na hora:** rejeitado. Seria mais fácil de fazer, mas perderia o drama de jogar com um a menos.
- **Só amarelos:** rejeitado. Sem vermelho, os cartões quase não pesam.

## Consequences

- A simulação, a Timeline e o desenho precisam aceitar um Time com 6 em campo.
- A calibração de gols por jogo precisa ser conferida de novo depois da mudança.
