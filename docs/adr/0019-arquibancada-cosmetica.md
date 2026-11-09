# Arquibancada cosmética nas laterais

Toda Partida mostra uma Arquibancada de madeira nas duas laterais do campo, nos 18 px de cada lado que hoje são mata. A torcida reage aos lances: comemora o gol, levanta numa defesa ou num chute perigoso, fica cabisbaixa quando o Time sofre gol e prende a respiração nos pênaltis. A cada gol, há um close rápido na torcida de quem marcou.

Os torcedores são genéricos, nas cores do Time. A torcida de cada lado cresce com o tamanho do Elenco: quanto mais Jogadores, maior a torcida. Depois do gol, a torcida canta o grito de guerra do Time, que aparece escrito numa faixa e soa como um coro gerado no próprio áudio, sem o Gemini.

Motivo: hoje a torcida existe só no som e na faixa que aparece no gol. O Ao Vivo chega a falar que "a arquibancada de madeira treme" sem haver arquibancada na tela, e o Narrador só deve comentar o que aparece.

## Regras

- **Só visual:** a reação é calculada no `renderer`, a partir dos eventos que a Timeline já tem. Não muda placar, Nota nem OVR e não sobe a `VERSAO_SIM`, como as jogadas do ADR-0007.
- **O campo não muda:** a Arquibancada usa só as margens. A coreografia das jogadas continua igual.
- **Clima e segundo uniforme:** entram no mesmo pacote visual, também sem mexer na simulação. O clima (chuva, lama ou sol) é sorteado pela semente da Partida, e o Narrador pode comentá-lo. O segundo uniforme entra quando as cores dos dois Times se confundem em campo.

## Considered Options

- **Encolher o campo para abrir uma arquibancada em cima ou embaixo:** rejeitada. Mexeria em todas as trilhas do `jogada.ts`.
- **Só no site, ou só num plano de reação:** rejeitadas. A torcida precisa estar no Reels, que é onde está o público.
- **Torcedores reais, com um Comando "TORÇO":** adiada. Pede um conceito novo, um Comando novo e dados novos.

## Consequences

- O Replay de Partidas antigas passa a mostrar a Arquibancada. O resultado delas não muda (ADR-0007).
- Antes de ir para o master, o visual passa por prévia e aprovação.
