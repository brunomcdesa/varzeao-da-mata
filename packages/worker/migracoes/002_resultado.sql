-- Resultado completo da simulação (desempenhos, decisivo, pênaltis), para retomar o job
-- `partida` de onde parou e montar o vídeo sem simular de novo.
ALTER TABLE partida ADD COLUMN resultado jsonb;
