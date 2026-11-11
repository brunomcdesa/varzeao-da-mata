-- Formação (ADR-0044): o Capitão escolhe a Formação junto da Postura, até o Corte.
-- Sem escolha, 2-2-2. A Postura ganha padrão para dar para escolher só a Formação.
ALTER TABLE postura ADD COLUMN IF NOT EXISTS formacao text NOT NULL DEFAULT '2-2-2'
  CHECK (formacao IN ('2-2-2', '2-3-1', '3-2-1', '3-1-2'));
ALTER TABLE postura ALTER COLUMN postura SET DEFAULT 'EQUILIBRADA';

-- Quem jogou fora de posição: a Posição de inscrição (a coluna `posicao` é a da vaga).
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS posicao_de_origem text
  CHECK (posicao_de_origem IN ('GOL', 'ZAG', 'MEI', 'ATA'));

-- Quem ficou fora porque a Formação cortou a vaga da Posição dele: no 2-2-2 teria entrado.
-- Ganha prioridade no rodízio do jogo seguinte do Time.
CREATE TABLE IF NOT EXISTS corte_da_formacao (
  partida_id  integer NOT NULL REFERENCES partida (id),
  jogador_id  bigint NOT NULL REFERENCES jogador (id),
  PRIMARY KEY (partida_id, jogador_id)
);
