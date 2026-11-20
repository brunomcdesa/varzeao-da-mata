# 0094 — Capitania rápida: o plano aparece na hora

- Status: aceito
- Data: 2026-11-20

## Contexto

As escolhas do Capitão (painel do Jogador) e o Plano do Capitão (página do Time, ADR-0086) demoravam a aparecer. As duas telas esperam o `escolha/estado` da borda, e ele era lento por três motivos:

- **Lista de quem tem Vínculo**: para saber quem é o Capitão, a borda listava as sessões do KV e lia **uma por uma, em sequência**. Quanto mais gente vinculada, mais lento.
- **Banco**: a capitania abria uma conexão por WebSocket com o Neon e fazia cerca de 11 consultas uma depois da outra (Temporada, Jogador, próximo jogo, ordem do Capitão, três da suspensão, @ do Capitão, escolha, lados, Presença). Cada ida vai da borda até o banco e volta.
- **Site**: o pedido só saía depois de a página montar, e nada ficava guardado; toda visita esperava do zero, e o painel e a página do Time pediam a mesma coisa duas vezes.

## Decisão

- **Sessões com metadados**: a sessão do Vínculo é gravada com o `jogadorId` nos metadados da chave. A lista de Vínculos sai de uma listagem só, sem ler sessão por sessão. As sessões antigas são regravadas uma vez pelo cron (marca `vinculo/metadados-v1`); até lá, são lidas todas ao mesmo tempo.
- **Menos idas ao banco**: a capitania lê pelo driver HTTP do Neon (`bancoDeLeitura`, sem abrir WebSocket) e junta o que não depende de nada: Temporada e Jogador juntos; depois o próximo jogo; depois ordem, suspensão, @s, escolha, lados, Presença e a lista de Vínculos, tudo ao mesmo tempo. A suspensão vira uma consulta só. Escrita continua pelo `comBanco`, com transação.
- **`escolha/estado` em paralelo**: as seis escolhas guardadas no KV e a capitania são buscadas juntas.
- **Site mostra na hora e confere depois**: o último estado visto fica no navegador (`varzeao:escolhas`). Ao abrir o painel ou a página do Time, ele aparece na hora e a resposta da borda só redesenha se algo mudou. A capitania guardada só vale enquanto o jogo dela ainda não passou do Corte. Ao salvar Postura, Formação, Presença ou Canto, o guardado é ajustado na hora.
- **Pedido antecipado e único**: quem tem Vínculo começa a pedir o estado assim que o site abre; o painel e a página do Time dividem o mesmo pedido (e uma resposta de até 20 s atrás).

## Consequências

- A regra do Capitão não muda (mesma ordem, mesma suspensão, mesmo Vínculo); só o caminho até ela. Não sobe VERSAO_SIM.
- O que fica guardado no navegador é só da própria pessoa (o plano do Time dela), como o Vínculo.
- Se o Capitão mudar a escolha em outro aparelho, a página mostra a versão guardada por um instante e se corrige quando a borda responde.
- Se ainda for pouco, o próximo passo é o Smart Placement do Worker (rodar perto do banco), que corta a distância de cada ida ao Neon.
