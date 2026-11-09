-- Série A e Série B (ADR-0017): 16 Times, a Série de cada Time em cada Temporada e a Série
-- de cada Partida, Candidato e voto. Temporadas sem linhas em serie_do_time (a Temporada 1)
-- são de uma Série só, a A.

ALTER TABLE time DROP CONSTRAINT IF EXISTS time_id_check;
ALTER TABLE time ADD CONSTRAINT time_id_check CHECK (id IN (
  'CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA',
  'JAC', 'SUC', 'LOB', 'CDM', 'BOT', 'PIR', 'COR', 'MOR'
));

-- Em que Série cada Time joga em cada Temporada (o Time muda de Série com Acesso e Rebaixamento).
CREATE TABLE serie_do_time (
  temporada_id  integer NOT NULL REFERENCES temporada (id),
  time_id       text NOT NULL REFERENCES time (id),
  serie         text NOT NULL CHECK (serie IN ('A', 'B')),
  PRIMARY KEY (temporada_id, time_id)
);

ALTER TABLE partida ADD COLUMN serie text NOT NULL DEFAULT 'A' CHECK (serie IN ('A', 'B'));

-- Candidatos a Craque por Série. O número continua único na Rodada: A de 1 a 5, B de 6 a 10
-- (o público vota "A3" ou "B3"; internamente B3 é o número 8).
ALTER TABLE candidato ADD COLUMN serie text NOT NULL DEFAULT 'A' CHECK (serie IN ('A', 'B'));

-- Um voto por @ por Rodada em cada Série.
ALTER TABLE voto ADD COLUMN serie text NOT NULL DEFAULT 'A' CHECK (serie IN ('A', 'B'));
ALTER TABLE voto DROP CONSTRAINT voto_pkey;
ALTER TABLE voto ADD PRIMARY KEY (rodada_id, ig_user_id, serie);

-- Título e Craque da Temporada da Série B (os da A continuam em campeao_id e craque_jogador_id).
ALTER TABLE temporada ADD COLUMN campeao_b_id text REFERENCES time (id);
ALTER TABLE temporada ADD COLUMN craque_b_jogador_id bigint REFERENCES jogador (id);
