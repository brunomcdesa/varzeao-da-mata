# 0100 — Perfil do Time

- Status: aceito (aprovado pelo dono em 23/11/2026)
- Data: 2026-11-23

## Contexto

Jogadores criaram, por conta própria, perfis no Instagram para os seus Times (@jacareacc, @tamanduaofc e @esporte_clube_capivara). Eles postam os Reels das Partidas, artes de pré-jogo e o Elenco, e põem @varzeao_da_mata na bio. O dono quer incentivar outros Times a fazer o mesmo e definir quando um desses perfis conta como oficial.

## Decisão

1. **Quem cria:** qualquer Jogador inscrito no Time.
2. **Requisitos:**
   - @varzeao_da_mata na bio;
   - o nome e o bicho do Time do jogo (o escudo pode ser próprio, como os do Jacaré e do Tamanduá);
   - não se passar pela Liga: nada de selo de verificado desenhado nem de "perfil oficial da Liga";
   - respeito aos rivais. Provocação de Clássico pode; ofensa ou ataque a Jogador tira o status.
3. **Pedido:** pela DM do @varzeao_da_mata, e o dono aprova. Fica um perfil por Time, o primeiro que pediu pela DM (vale a hora da mensagem). Os outros são Perfis de Torcida. Um perfil não pode ser de dois Times.
4. **O que ganha:**
   - link na página do Time (site e App);
   - a Liga segue o perfil;
   - repost de artes nos Stories, com a aprovação do dono;
   - colaborador em todo Reels de Partida do Time. Se só um dos dois Times tem perfil, só ele é convidado. Isso substitui a ideia de pôr o @ do Time na cartela do Reels. O Narrador continua sem falar @.
5. **Reels de incentivo:** mostra os perfis que já existem como exemplo (os Times já autorizaram) e depois as regras.

## Como funciona

- Tabela `perfil_do_time` (migração 026): um perfil por Time, com o @ único entre os Times.
- Workflow `perfil-do-time` (`pnpm liga perfil-do-time`): com o @ reconhece o perfil, sem o @ tira. Sem "gravar" é a simulação. Se o Time já tem outro perfil, recusa, e "trocar" passa por cima disso.
- O job `partida` cria o Reels com `collaborators` (até 3 na API, aqui no máximo 2). Se o Instagram recusar o convite (@ trocado, perfil privado), o Reels é criado de novo sem colaboradores: a Partida nunca fica sem Reels.
- Cada Perfil do Time precisa aceitar o convite no próprio Reels. Pela API, o convite pode não gerar notificação, então o Time procura no Reels.
- A Meta só oferece colaboradores no Facebook Login (token `EAA…`). O workflow `testar-colaborador` cria um container com colaborador sem publicar nada e mostra se a conta da Liga consegue.

Não muda a simulação: a VERSAO_SIM continua a mesma.
