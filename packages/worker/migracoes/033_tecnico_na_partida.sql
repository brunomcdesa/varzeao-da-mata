-- Boneco do Técnico (ADR-0111, Rodada 4 da T3): quem era o Técnico de cada Time na hora da
-- Escalação e os Itens dele, congelados como os dos Jogadores. Vale a partir do dia da Rodada 4
-- da Fase de Liga da T3 (junto da Loja fase 2); daí em diante toda Partida escalada ganha uma linha
-- por Time, e o Time sem Técnico fica com jogador_id nulo (a beira do campo vazia).
CREATE TABLE IF NOT EXISTS tecnico_na_partida (
  partida_id  integer NOT NULL REFERENCES partida (id),
  time_id     text NOT NULL REFERENCES time (id),
  jogador_id  bigint,
  username    text,
  apelido     text,
  itens       jsonb,
  PRIMARY KEY (partida_id, time_id)
);
