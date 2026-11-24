-- Avisos pessoais (ADR-0110): a fila do que avisar a cada pessoa com Vínculo e Avisos ligados
-- (Pedido para o Técnico, Convite, Troca casada, resposta do Pedido, Chamada da Presença).
-- Só entra quem tem aparelho ligado; a borda manda e marca enviado_em.
CREATE TABLE IF NOT EXISTS aviso_pessoal (
  id          bigserial PRIMARY KEY,
  jogador_id  bigint NOT NULL,
  tipo        text NOT NULL,
  titulo      text NOT NULL,
  corpo       text NOT NULL,
  url         text NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  enviado_em  timestamptz
);
CREATE INDEX IF NOT EXISTS aviso_pessoal_pendente ON aviso_pessoal (criado_em) WHERE enviado_em IS NULL;
CREATE INDEX IF NOT EXISTS aviso_aparelho_jogador ON aviso_aparelho (jogador_id) WHERE jogador_id IS NOT NULL;
