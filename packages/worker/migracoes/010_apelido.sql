-- Apelido do Jogador (ADR-0014): escolhido pelo dono no site, único na Liga (pela chave sem
-- acento/espaço), uma troca por rodada. A Escalação guarda o apelido da época do jogo.
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS apelido text CHECK (char_length(apelido) BETWEEN 2 AND 14);
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS apelido_chave text;
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS apelido_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS jogador_apelido_unico ON jogador (apelido_chave) WHERE apelido_chave IS NOT NULL AND NOT banido;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS apelido text;
