-- Número da camisa nas costas dos bonecos (ADR-0075): a Escalação guarda o número da época do
-- jogo, como o apelido. Partidas escaladas antes desta migração ficam sem número (camisa lisa).
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS numero smallint CHECK (numero BETWEEN 1 AND 99);
