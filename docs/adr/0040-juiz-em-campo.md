# Juiz em campo

As Partidas da Temporada 2 mostram um Juiz em campo. Ele acompanha o lance na diagonal da bola, corre até a falta, levanta o braço no apito e mostra o cartão na mão, e volta ao meio depois do gol. Na disputa de pênaltis, fica parado ao lado da área.

Motivo: a T2 trouxe faltas e cartões (ADRs 0021 e 0024), mas o apito existia só no som e o cartão aparecia flutuando em cima de quem fez a falta. Com o Juiz, o que se ouve e o que se lê no letreiro passam a ter quem faça na tela. Ele também prepara a Substituição, que vai usar a placa do Juiz.

## Regras

- **Só visual:** a corrida e os gestos do Juiz são calculados na Timeline, a partir dos lances que já existem. Não muda placar, Nota nem OVR e não sobe a `VERSAO_SIM`, como a Arquibancada (ADR-0019).
- **Só na T2:** as Partidas da T1 seguem sem Juiz.
- **Uniforme:** preto, como na várzea. Quando o preto se confunde com alguma camisa em campo (de linha, do goleiro ou o segundo uniforme), vira amarelo ou vermelho, o que se destacar mais.
- **Rosto:** pele e cabelo sorteados pela semente da Partida. É o mesmo Juiz o jogo todo.
- **Sem nome:** o Juiz não tem nome escrito embaixo, o que também o separa dos Jogadores.
- **Gestos:** na falta, apita com o braço levantado. Com cartão, levanta o cartão quando chega perto de quem fez (ou logo depois, se demorar), e o abaixa antes de o expulso sair.

## Considered Options

- **Juiz com estilo (rigoroso ou "deixa jogar") mudando a chance de falta e de cartão:** adiado. Mexeria na simulação e na calibração de gols outra vez.
- **Juiz também nas Partidas da T1:** rejeitado por ora. A T1 não tem falta nem cartão, então o Juiz só correria.

## Consequences

- O cartão deixa de aparecer em cima de quem fez a falta: quem o levanta é o Juiz.
- O Narrador pode citar o Juiz, já que ele aparece na tela.
- Antes de ir para o master, o visual passa por prévia e aprovação.
