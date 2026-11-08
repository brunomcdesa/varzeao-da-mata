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

## Segunda entrega: visual, camisa e voto

- **Visual do boneco:** pele (6 tons), cor do cabelo (9) e corte (curto, careca, black, moicano). As opções ficam em `@liga/shared` (aparencia.ts) e valem no site, no Reels, no Ao Vivo e no Resumo. Quem não escolheu continua com o visual sorteado pelo @.
- **Número da camisa:** de 1 a 99, sem repetir no Time. Aparece no card do site.
- Os dois vão para `perfil-site/<jogadorId>` no KV, a coleta valida e grava (`jogador.visual`, `jogador.numero`), e o resultado volta para o site.
- **Voto no Craque:** com o personagem vinculado, o voto do site vale como o voto do @, um por pessoa e junto com o comentado. Vale o último, então dá para mudar até a votação fechar. A borda grava em `voto-vinculado/<rodada>/<jogadorId>`, e a coleta junta na tabela `voto`.

## Considered Options

- Código comentado num post: funciona sem a permissão de mensagens, mas deixa o código à vista de todos e polui os comentários.
- Login com o Instagram: a Meta desligou o login para contas pessoais (ADR-0011).
- Só por comentário: ambíguo (o caso do pedido "do meu amigo").
