-- Audiência do Ao Vivo (ADR-0118): um resumo por Partida, trazido do KV `audiencia/<partida>`
-- pela coleta. Só números agregados; nada que identifique alguém. Sem chave estrangeira de
-- propósito: o resumo vale mesmo se a Partida for refeita ou apagada.
CREATE TABLE IF NOT EXISTS audiencia_ao_vivo (
  partida_id        integer PRIMARY KEY,
  pico              integer NOT NULL,
  entradas          integer NOT NULL,
  media             numeric(10, 2) NOT NULL,
  primeira_conexao  timestamptz NOT NULL,
  fim               timestamptz NOT NULL,
  coletado_em       timestamptz NOT NULL DEFAULT now()
);
