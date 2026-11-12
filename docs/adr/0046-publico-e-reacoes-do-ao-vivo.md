# Público e Reações do Ao Vivo

O Ao Vivo mostra quantas pessoas estão assistindo (o **Público**) e deixa qualquer um mandar **Reações**: ⚽ Gol, 🔥 Fogo, 😱 Susto e 👏 Palmas. As Reações sobem por cima da metade direita do campo, para não esconder a jogada. Nada disso aparece no Replay nem no Reels, e nada vai para o banco.

## Por que Reações e não chat

Chat precisa de moderação, e a Liga é operada por uma pessoa só, que não está olhando a tela durante os jogos. As Reações não têm texto livre, então não há o que moderar. Elas já dão a sensação de arquibancada e servem para medir o interesse.

O chat fica para depois, com estas regras já decididas:

- só fala quem tem o personagem vinculado (código VZ pela DM, ADR-0013);
- as mensagens somem quando o Ao Vivo acaba.

## Como funciona

- **Sala:** um Durable Object `SalaAoVivo` por Partida (`idFromName("partida-<id>")`) no worker da borda.
- **Entrada:** o site abre um WebSocket em `GET /ao-vivo/:id`. A borda confere no arquivo privado da Partida que o Ao Vivo está acontecendo (fora dele: 425 antes, 410 depois) e passa à sala o instante do fim.
- **Público:** é o número de conexões abertas. A sala manda o número novo só quando ele muda.
- **Reações:** a sala junta as Reações e manda em lotes (no máximo um a cada 800 ms). Cada conexão recebe o lote sem as próprias Reações, porque essas já subiram na tela dela na hora do clique.
- **Limite:** uma Reação por segundo por conexão, no site e na sala. Mensagem que não é uma das quatro Reações é ignorada.
- **Fim:** no fim do Ao Vivo, um alarme fecha todas as conexões (código 1000) e apaga o que a sala guardou. O site não reconecta depois desse fechamento.
- **Hibernação:** a sala usa a API de hibernação do WebSocket, então não gasta duração enquanto ninguém reage.

## Custo

O plano grátis do Workers aceita Durable Objects com SQLite: 100 mil requisições por dia. Cada conexão conta como uma requisição, e as mensagens recebidas contam na proporção de 20 para 1. As mensagens enviadas pela sala não contam. Com 4 a 6 Partidas por dia de 5 a 7 minutos, sobra muita margem.

## Acessibilidade

Quem pede menos movimento no sistema (`prefers-reduced-motion`) vê o Público, mas não vê as Reações voando.

## Implantação

A configuração do Durable Object está no `wrangler.toml`: o binding `SALAS` e a migração `v1-salas-ao-vivo` com `new_sqlite_classes`. O `pnpm edge:deploy` cria a classe na primeira vez. Sem o binding, a rota responde 503 e o Ao Vivo continua funcionando, só sem Público e sem Reações.
