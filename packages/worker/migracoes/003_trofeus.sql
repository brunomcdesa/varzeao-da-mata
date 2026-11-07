-- Troféus que atravessam Temporadas: campeão e Craque da Temporada (eleito pelo público
-- entre os 5 melhores, com votação aberta no Resumo da Final e resultado no dia seguinte).
ALTER TABLE temporada ADD COLUMN campeao_id text REFERENCES time (id);
ALTER TABLE temporada ADD COLUMN craque_jogador_id bigint REFERENCES jogador (id);
ALTER TABLE temporada ADD COLUMN craque_status text NOT NULL DEFAULT 'PENDENTE'
  CHECK (craque_status IN ('PENDENTE', 'AGENDADO', 'PUBLICADO'));
-- Quando o anúncio do Craque da Temporada vai ao ar: o site só mostra depois disso.
ALTER TABLE temporada ADD COLUMN craque_revelado_em timestamptz;
ALTER TABLE temporada ADD COLUMN craque_ig_media_id text;
