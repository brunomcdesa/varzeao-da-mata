# 0091 — Batedores escolhidos pelo Capitão e escolhas na página do Time

- Status: aceito
- Data: 2026-11-20

## Contexto

O ADR-0020 adiou a ideia de o Capitão escolher quem bate os pênaltis. Hoje a Disputa de pênaltis usa uma ordem automática por Posição (ATA, ATA, MEI, MEI, ZAG, ZAG, GOL). Com a Copa (ADR-0088), haverá mais Disputas. O Capitão escolhe Formação e Postura na página do próprio Jogador; a página do Time só mostra o Plano do Capitão a quem tem Vínculo com o Time (ADR-0086).

## Decisão

- **Batedores:** a ordem dos 5 primeiros batedores da Disputa de pênaltis, que o Capitão escolhe junto com a Formação e a Postura e que trava no mesmo momento. Na hora da Disputa, quem não está em campo é pulado e entra o próximo da lista; depois dos 5, segue a ordem automática. Sem escolha, vale a ordem automática.
- **Escolhas na página do Time:** o Capitão também pode escolher Formação, Postura e Batedores na página do Time. Os outros Jogadores com Vínculo do mesmo Time veem o plano, incluindo os Batedores; quem não tem Vínculo ou é de outro Time não vê nada.
- Começa na T3.

## Considered Options

- **Só o primeiro batedor:** rejeitada. Os outros seguiriam automáticos, e a escolha pesaria pouco.

## Consequências

- Muda a simulação: sobe a VERSAO_SIM e só vale para a próxima Partida escalada.
- O Batedor entra no Reels do Capitão da série de novidades da T3.
