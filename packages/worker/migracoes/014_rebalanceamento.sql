-- Rebalanceamento da Temporada 2 (ADR-0036). Nada daqui muda a Temporada 1: as tabelas só são
-- escritas pelo comando de Rebalanceamento, que exige uma Temporada com as regras da T2 na
-- Pré-temporada.

-- Uma linha por Temporada rebalanceada: o Rebalanceamento só pode ser gravado uma vez.
CREATE TABLE IF NOT EXISTS rebalanceamento (
  temporada_id  integer PRIMARY KEY REFERENCES temporada (id),
  feito_em      timestamptz NOT NULL,
  movidos       integer NOT NULL
);

-- Fundadores: quem começou a primeira Temporada de um Time da Série B no Elenco dele.
CREATE TABLE IF NOT EXISTS fundador (
  jogador_id    bigint NOT NULL REFERENCES jogador (id),
  time_id       text NOT NULL REFERENCES time (id),
  temporada_id  integer NOT NULL REFERENCES temporada (id),
  -- Veio pelo Rebalanceamento (true) ou foi para a B por vontade própria (false).
  remanejado    boolean NOT NULL DEFAULT false,
  PRIMARY KEY (jogador_id, time_id)
);
