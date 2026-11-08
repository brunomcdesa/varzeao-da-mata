# Transferência no meio da Temporada

O Jogador pode trocar de Time, de posição ou dos dois, uma vez por Temporada. Pede comentando em qualquer post da Liga: "TRANSFERIR Preguiça", "TRANSFERIR Preguiça zagueiro", ou um pedido curto como "quero ir pra Preguiça", "posso ir pro time da Preguiça pra equilibrar?" ou "quero virar zagueiro". A Liga responde o comentário dizendo se deu certo e por quê.

Motivo: os seguidores pediram, e a transferência é a forma mais natural de equilibrar Times que ficaram vazios. É o caso da Preguiça, que tinha 2 Jogadores reais quando a Onça tinha 6.

## Regras

- **Destino:** vale a mesma regra de equilíbrio da Inscrição. Contando os Elencos sem o Jogador que sai, o destino não pode ter `FOLGA_DE_ELENCO` (5) ou mais acima do Elenco mais vazio. A origem não é checada: sair nunca bloqueia, e as próximas Inscrições vão para o Time que esvaziou.
- **Quando vale:** o Jogador muda de Time na hora, mas as Escalações já feitas no Corte não mudam. Na prática, ele joga pelo Time novo a partir do próximo Corte.
- **Limite:** uma por Temporada (tabela `transferencia`, `UNIQUE (jogador_id, temporada_id)`). Trocar só de posição gasta a transferência da Temporada.
- **O que ele leva:** as Habilidades e as estatísticas pessoais. O OVR passa a ser o das Habilidades na posição nova. Os pontos e os jogos já disputados ficam com o Time antigo.
- **Mata-mata:** as transferências fecham no Corte do último jogo da Fase de Liga e reabrem na Temporada seguinte.
- **"ENTRO" de quem já joga:** não vira Transferência. A Liga responde explicando como pedir.
- **Quem ainda não joga:** se pede para ir para um Time ("quero ir pra Preguiça"), entra nele, como numa Inscrição.
- **Comentários antigos:** um pedido já lido como ignorado, feito depois da Inscrição, é lido de novo e vira Transferência. Foi assim que o primeiro pedido, de @its___mu_27, foi atendido.

## Considered Options

- Janela de transferências entre Rodadas: mais parecida com o futebol de verdade, mas difícil de explicar. Rejeitada; o Corte já protege os jogos montados.
- Transferência sem limite (ou uma por dia): estragaria os clássicos e a tabela com troca-troca.
- Só pelo site, com o personagem vinculado à conta: virá depois, com as mesmas regras. Por enquanto o comentário é o único jeito de provar quem é o dono do personagem sem depender de permissões novas da Meta.
