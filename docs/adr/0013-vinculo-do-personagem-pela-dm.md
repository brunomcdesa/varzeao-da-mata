# Vínculo do personagem pela DM

O dono de um Jogador pode vincular o próprio navegador ao personagem e, a partir daí, cuidar dele pelo site. Na página do Jogador, ele toca em **Vincular pela DM** e recebe um código (VZ-1234, válido por 15 minutos). Manda o código na DM da Liga pela própria conta e toca em **Já mandei**. A borda lê as conversas da DM e confere se a mensagem com o código veio do @ dono do Jogador. Se veio, o navegador recebe uma sessão. Nesta primeira entrega, o vinculado pode pedir a Transferência e a troca de posição, com as regras do ADR-0012.

Motivo: comentário é ambíguo. O pedido de um amigo vira pedido do próprio comentarista, e frases soltas viram comandos. O site deixa a pessoa escolher com clareza. Só a própria conta consegue mandar DM com o seu @, então o código prova quem é o dono sem login nem senha.

## Como funciona

- O token atual da Liga já tem `instagram_manage_messages` e lê as DMs de qualquer conta, não só das testadoras do app, sem App Review.
- A borda (`packages/edge/src/vinculo.ts`) guarda no KV:
  - o código pendente (`vinculo/codigo/<código>`, TTL 15 min);
  - a sessão (`vinculo/sessao/<hash>`, sem validade). Só o hash vai para o KV; o segredo fica no navegador (localStorage).
- A sessão vale até a pessoa desvincular ou limpar o navegador. Cada navegador fica vinculado a um único personagem.
- Ao vincular, a borda tenta responder na DM confirmando. Se a API recusar, o site mostra a confirmação mesmo assim.
- O pedido do site vai para `pedido-site/<jogadorId>` no KV. A borda dispara a coleta na hora, e a coleta aplica o pedido com o mesmo núcleo do comentário (`transferirJogador`). Ela grava o resultado e a mensagem no próprio item, e o site mostra. Um pedido por vez. O job da partida também processa os pedidos antes do Corte.
- Limites:
  - no máximo 8 códigos por rede (IP) por hora;
  - o site confere a DM a cada 8 s, por até 2 minutos depois de "Já mandei".

## Próximas entregas

Visual do boneco, número da camisa e voto no Craque como o próprio @ (um voto por pessoa, não por aparelho).

## Considered Options

- Código comentado num post: funciona sem a permissão de mensagens, mas deixa o código à vista de todos e polui os comentários.
- Login com o Instagram: a Meta desligou o login para contas pessoais (ADR-0011).
- Só por comentário: ambíguo (o caso do pedido "do meu amigo").
