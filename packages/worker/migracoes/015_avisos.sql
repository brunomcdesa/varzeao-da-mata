-- Avisos do App (ADR-0041): cada aparelho que ativou os Avisos, com os Times que segue.
-- O endpoint é o endereço que o próprio navegador criou para receber notificações; as chaves
-- servem para cifrar o conteúdo. Não há @ nem nada do Jogador aqui.
CREATE TABLE IF NOT EXISTS aviso_aparelho (
  endpoint     text PRIMARY KEY,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  times        text[] NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aviso_aparelho_times ON aviso_aparelho USING gin (times);
