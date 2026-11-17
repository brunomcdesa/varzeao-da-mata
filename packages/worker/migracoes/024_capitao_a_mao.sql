-- Capitão à mão (ADR-0079): um Jogador escolhido pelo dono leva a faixa do Time, na frente da
-- ordem de mais Partidas, até o dono tirar ou o Jogador mudar de Time. Um por Time.
CREATE TABLE IF NOT EXISTS capitao_a_mao (
  time_id       text PRIMARY KEY REFERENCES time (id),
  jogador_id    bigint NOT NULL UNIQUE REFERENCES jogador (id),
  escolhido_em  timestamptz NOT NULL
);

-- OVR à mão (ADR-0079): histórico de cada ajuste, com o antes e o depois.
CREATE TABLE IF NOT EXISTS ovr_a_mao (
  id                  bigserial PRIMARY KEY,
  jogador_id          bigint NOT NULL REFERENCES jogador (id),
  ovr_antes           integer NOT NULL,
  ovr_depois          integer NOT NULL,
  habilidades_antes   jsonb NOT NULL,
  habilidades_depois  jsonb NOT NULL,
  feito_em            timestamptz NOT NULL
);
