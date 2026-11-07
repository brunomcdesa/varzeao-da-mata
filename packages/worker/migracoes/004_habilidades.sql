-- Habilidades (ADR-0010): cinco notas de 1 a 99 por Jogador; o OVR passa a ser derivado delas.
-- Jogadores antigos (habilidades nulas) ganham o perfil da Posição no próximo uso.
ALTER TABLE jogador ADD COLUMN habilidades jsonb;
ALTER TABLE escalacao ADD COLUMN habilidades_antes jsonb;
ALTER TABLE escalacao ADD COLUMN habilidades_depois jsonb;
