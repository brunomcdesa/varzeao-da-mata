-- Apoiador (ADR-0108): cada período de apoio pelo Apoia-se, ligado pelo @ (minúsculo, sem @).
-- O dono abre e fecha os períodos pelo workflow apoiador. Trocar de nível fecha um período e abre
-- outro. Só um período aberto por @. O valor em reais nunca aparece em lugar público: o nível só
-- decide se há Item de Apoiador.
CREATE TABLE apoio (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username          text NOT NULL CHECK (username = lower(username) AND username !~ '^@'),
  nivel             integer NOT NULL CHECK (nivel IN (5, 15)),
  inicio            timestamptz NOT NULL,
  fim               timestamptz,
  temporada_inicio  integer NOT NULL,
  temporada_fim     integer,
  CHECK ((fim IS NULL) = (temporada_fim IS NULL))
);
CREATE UNIQUE INDEX apoio_aberto ON apoio (username) WHERE fim IS NULL;
