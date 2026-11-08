-- Transferência no meio da Temporada (ADR-0012): uma por Jogador por Temporada.
CREATE TABLE IF NOT EXISTS transferencia (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id     bigint NOT NULL REFERENCES jogador (id),
  temporada_id   integer NOT NULL REFERENCES temporada (id),
  de_time        text NOT NULL REFERENCES time (id),
  para_time      text NOT NULL REFERENCES time (id),
  de_posicao     text NOT NULL,
  para_posicao   text NOT NULL,
  ig_comment_id  text NOT NULL,
  feita_em       timestamptz NOT NULL,
  UNIQUE (jogador_id, temporada_id)
);

ALTER TABLE comando DROP CONSTRAINT IF EXISTS comando_tipo_check;
ALTER TABLE comando ADD CONSTRAINT comando_tipo_check CHECK (tipo IN ('INSCRICAO', 'VOTO', 'INVALIDO', 'IGNORADO', 'TRANSFERENCIA'));
