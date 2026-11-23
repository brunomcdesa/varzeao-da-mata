-- Loja (ADRs 0087 e 0101): os Itens que são de cada Jogador, os equipados agora e a cópia que a
-- Escalação guarda (o jogo mostra os Itens da época, mesmo que o dono troque depois).
CREATE TABLE item_do_jogador (
  jogador_id   bigint NOT NULL REFERENCES jogador (id),
  codigo       text NOT NULL,
  comprado_em  timestamptz NOT NULL,
  PRIMARY KEY (jogador_id, codigo)
);
ALTER TABLE jogador ADD COLUMN itens jsonb;
ALTER TABLE escalacao ADD COLUMN itens jsonb;
