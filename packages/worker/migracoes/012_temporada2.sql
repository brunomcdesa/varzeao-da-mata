-- Regras da Temporada 2 (ADRs 0020 a 0024). Nada daqui muda a Temporada 1: as colunas e
-- tabelas novas só são lidas e escritas quando a Temporada tem as regras da T2.

-- Escolhas do Jogador pelo site (ADR-0023). Especialização: uma troca por dia da Liga.
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS especializacao text;
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS especializacao_em timestamptz;
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS treino text CHECK (treino IN ('FIN', 'PAS', 'DRI', 'DEF', 'GOL'));
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS canto text CHECK (canto IN ('ESQUERDA', 'MEIO', 'DIREITA'));

-- A Escalação guarda as escolhas da hora (o Replay é sempre a mesma Partida) e os cartões.
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS especializacao text;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS treino text;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS canto text;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS faltas integer;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS amarelos integer;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS expulso boolean NOT NULL DEFAULT false;

-- Presença (ADR-0023): quem confirmou que quer jogar o próximo jogo do Time.
CREATE TABLE IF NOT EXISTS presenca (
  partida_id     integer NOT NULL REFERENCES partida (id),
  jogador_id     bigint NOT NULL REFERENCES jogador (id),
  confirmado_em  timestamptz NOT NULL,
  PRIMARY KEY (partida_id, jogador_id)
);

-- Postura (ADR-0020): escolhida pelo Capitão até o Corte; sem escolha, Equilibrada.
CREATE TABLE IF NOT EXISTS postura (
  partida_id    integer NOT NULL REFERENCES partida (id),
  time_id       text NOT NULL REFERENCES time (id),
  postura       text NOT NULL CHECK (postura IN ('OFENSIVA', 'EQUILIBRADA', 'DEFENSIVA')),
  capitao_id    bigint REFERENCES jogador (id),
  escolhida_em  timestamptz,
  PRIMARY KEY (partida_id, time_id)
);

-- Janela de Transferências (ADR-0022): a troca na Pré-temporada não gasta a da Temporada.
ALTER TABLE transferencia ADD COLUMN IF NOT EXISTS janela boolean NOT NULL DEFAULT false;
ALTER TABLE transferencia DROP CONSTRAINT IF EXISTS transferencia_jogador_id_temporada_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS transferencia_uma_por_temporada ON transferencia (jogador_id, temporada_id, janela);

ALTER TABLE comando DROP CONSTRAINT IF EXISTS comando_tipo_check;
ALTER TABLE comando ADD CONSTRAINT comando_tipo_check CHECK (tipo IN ('INSCRICAO', 'VOTO', 'INVALIDO', 'IGNORADO', 'TRANSFERENCIA', 'PRESENCA'));
