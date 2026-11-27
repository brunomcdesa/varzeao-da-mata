# ADR-0118: Resumo de audiência do Ao Vivo (pico, média, entradas)

**Status:** proposto (26/11/2026), aguardando a aprovação do dono

## Contexto

Para buscar patrocínio precisamos de números de audiência que não se perdem. O Público do Ao Vivo
(ADR-0046) só existe na memória da sala e some quando ela se apaga no fim do jogo. É o dado mais
perecível que temos: se não for guardado na hora, não dá para recalcular depois.

## Decisão

- No fim do Ao Vivo, antes de apagar o que guardou, a sala (`SalaAoVivo`) grava **um resumo** no KV
  `AGENDA`, chave `audiencia/<partida>`: `pico` (máximo de conexões simultâneas), `entradas`
  (conexões abertas, reconexão conta), `media` (público médio entre a primeira conexão e o fim),
  `primeiraConexao` e `fim`. Validade de 45 dias no KV.
- A sala mede a cada entrada e saída (`medir`, função pura) e guarda o acumulador no storage do
  Durable Object, que sobrevive à hibernação.
- A rota da borda passa o id da Partida à sala pelo cabeçalho `x-partida-ao-vivo`.
- Se o KV falhar, o fim do Ao Vivo segue normalmente: só se perde a estatística daquele jogo.
- Só números agregados: nada de IP, id de conexão ou qualquer coisa que identifique alguém.

## Consequências

- **Muda o ADR-0046:** o Público continua fora do banco e do Replay, mas o resumo final passa a ser
  guardado. As Reações seguem sem ser guardadas.
- "Entradas" não é gente única (sem cookie, sem login): é uma medida de volume.
- O próximo PR (coleta) leva `audiencia/*` do KV para o Neon pelo mecanismo de pendências (ADR-0035),
  numa tabela `audiencia_ao_vivo`.
