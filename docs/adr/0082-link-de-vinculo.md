# 0082 — Link de Vínculo pela DM

- Status: aceito
- Data: 2026-11-17

## Contexto

O Vínculo (ADR-0013) fica no navegador, e cada navegador tem um único personagem. Na página de outro Jogador, a caixa "Este personagem é seu?" some. Quem já vinculou outro Jogador no mesmo navegador fica sem saída se não souber qual é. O navegador interno do Instagram divide o mesmo armazenamento entre todas as contas logadas no app, então isso acontece com quem tem mais de uma conta. Foi o caso do @wagno_santos21. O dono não tinha como vincular alguém por fora: a sessão é um segredo que só o navegador guarda.

## Decisão

- Novo workflow manual **link-de-vinculo** (`pnpm liga link-de-vinculo`), com o @ e, opcionalmente, o id do Jogador.
- O workflow cria um token aleatório (32 bytes, base64url) e grava em `vinculo/link/<sha256 do token>` no KV: o Jogador, o @, quando foi criado e quando vence. O link vale 24 horas, com TTL no próprio KV.
- A Liga manda na DM do Jogador o link `<site>/#/vincular/<token>`. O texto está em `mensagemDoLink`. O workflow é a aprovação do dono para essa DM.
- Abrir o link chama `POST /vinculo/link` na borda. A borda confere o token e cria uma sessão nova para o navegador. O link é apagado, então funciona uma vez só. Se o navegador mandar a sessão antiga, ela também é apagada: o Vínculo anterior é trocado, e um navegador continua com um personagem só.
- O site tira o token do endereço na hora e vai para a página do Jogador, que mostra "Pronto! Este navegador agora está vinculado ao seu Jogador.". Link usado, vencido ou inventado leva a uma tela que manda pedir outro link ou vincular pelo código.

## Segurança

- O link nunca aparece no log do workflow (o repositório é público). No KV fica só o hash.
- Só o dono do @ lê a DM dele. É a mesma prova do código, ao contrário: em vez de a pessoa mandar o código para a Liga, a Liga manda o link para a pessoa.
- Se a DM não sair, o link é apagado na hora.

## Consequências

- A Meta só deixa a Liga escrever para quem mandou mensagem na DM nas últimas 24 horas. Sem conversa recente, o workflow falha e pede que a pessoa mande uma mensagem antes.
- Ter Vínculo conta para o Capitão (ADR-0079): trocar o Vínculo antigo de um navegador pode tirar o Vínculo do outro Jogador.

## Considered Options

- Desvincular pelo KV, à mão: não resolvia, porque o site esconde a caixa só olhando o armazenamento do navegador.
- Mostrar na página de outro Jogador a qual @ o navegador está vinculado: continua possível e complementa este, mas depende de a pessoa agir sozinha.
