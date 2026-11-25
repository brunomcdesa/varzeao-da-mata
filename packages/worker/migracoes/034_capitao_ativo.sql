-- Capitão ativo (ADR-0114): a faixa é de quem mexe no Time. O Capitão que passa 3 jogos do Time
-- sem nenhuma escolha de Capitão perde a faixa e fica fora da ordem até a Temporada seguinte.
-- capitao_faixa: quem está com a faixa de cada Time e desde quando (a conta começa aí).
CREATE TABLE IF NOT EXISTS capitao_faixa (
  time_id     text PRIMARY KEY REFERENCES time (id),
  jogador_id  bigint NOT NULL,
  desde       timestamptz NOT NULL
);
-- A última escolha de Capitão de cada pessoa (Formação, Postura, fixados, Sugestão, Batedores,
-- escanteio, Marcação, Grito, Chamada).
CREATE TABLE IF NOT EXISTS capitao_escolha (
  jogador_id  bigint PRIMARY KEY,
  em          timestamptz NOT NULL
);
-- Quem perdeu a faixa por ficar parado, na Temporada em que perdeu.
CREATE TABLE IF NOT EXISTS capitao_inativo (
  temporada_id  integer NOT NULL REFERENCES temporada (id),
  time_id       text NOT NULL REFERENCES time (id),
  jogador_id    bigint NOT NULL,
  em            timestamptz NOT NULL,
  PRIMARY KEY (temporada_id, time_id, jogador_id)
);
-- A faixa à mão pode vir do dono (ADR-0079) ou da troca por atividade (ADR-0114).
ALTER TABLE capitao_a_mao ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'DONO';
