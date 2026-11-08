-- O dono escolhe o visual do boneco e o número da camisa pelo site (ADR-0013).
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS visual jsonb;
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS numero integer CHECK (numero BETWEEN 1 AND 99);
