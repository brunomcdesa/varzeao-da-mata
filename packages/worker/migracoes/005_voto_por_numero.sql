-- Voto do Craque por número (ADR-0011): cada Candidato tem um número (1 a 5), e o voto
-- também pode vir do site, um por aparelho. voto_total junta os dois para a contagem.
ALTER TABLE candidato ADD COLUMN numero integer;
UPDATE candidato c SET numero = x.n
FROM (SELECT rodada_id, jogador_id, row_number() OVER (PARTITION BY rodada_id ORDER BY nota DESC, jogador_id) AS n FROM candidato) x
WHERE x.rodada_id = c.rodada_id AND x.jogador_id = c.jogador_id;

CREATE TABLE voto_site (
  rodada_id    integer NOT NULL REFERENCES rodada (id),
  dispositivo  text NOT NULL,
  jogador_id   bigint NOT NULL REFERENCES jogador (id),
  votado_em    timestamptz NOT NULL,
  PRIMARY KEY (rodada_id, dispositivo)
);

CREATE VIEW voto_total AS
  SELECT rodada_id, jogador_id, 'ig:' || ig_user_id AS eleitor FROM voto
  UNION ALL
  SELECT rodada_id, jogador_id, 'site:' || dispositivo AS eleitor FROM voto_site;
