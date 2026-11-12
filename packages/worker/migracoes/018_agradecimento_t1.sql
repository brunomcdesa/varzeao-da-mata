-- Reels de agradecimento da Temporada 1 (ADR-0047), automático: sai no dia seguinte ao Resumo
-- da Temporada. Só a T1 usa.
ALTER TABLE temporada ADD COLUMN IF NOT EXISTS agradecimento_status text CHECK (agradecimento_status IN ('AGENDADO', 'PUBLICADO'));
ALTER TABLE temporada ADD COLUMN IF NOT EXISTS agradecimento_ig_media_id text;
