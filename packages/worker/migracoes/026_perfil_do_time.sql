-- Perfil do Time (ADR-0100): o Instagram que um Jogador criou para o Time e que o dono
-- reconheceu como oficial. Um por Time (fica o primeiro que pediu pela DM) e um Time por perfil.
CREATE TABLE IF NOT EXISTS perfil_do_time (
  time_id        text PRIMARY KEY REFERENCES time (id),
  usuario        text NOT NULL,
  oficial_desde  timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS perfil_do_time_usuario ON perfil_do_time (lower(usuario));
