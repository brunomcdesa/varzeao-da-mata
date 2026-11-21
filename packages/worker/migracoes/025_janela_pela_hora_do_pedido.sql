-- Janela pela hora do pedido (ADR-0096): troca pedida antes do Corte do primeiro jogo da
-- Temporada (T2 em diante) é da Janela e não gasta a Transferência da Temporada. Corrige quem
-- ficou marcado como Transferência da Temporada por ter sido processado depois da virada.
-- Quem já tem uma troca da Janela na mesma Temporada fica como está (uma de cada).
UPDATE transferencia t
   SET janela = true
  FROM temporada tp
 WHERE tp.id = t.temporada_id
   AND tp.numero >= 2
   AND NOT t.janela
   AND t.feita_em < (
         SELECT min(p.apito_inicial) - interval '30 minutes'
           FROM partida p JOIN rodada r ON r.id = p.rodada_id
          WHERE r.temporada_id = tp.id
       )
   AND NOT EXISTS (
         SELECT 1 FROM transferencia o
          WHERE o.jogador_id = t.jogador_id AND o.temporada_id = t.temporada_id AND o.janela
       );
