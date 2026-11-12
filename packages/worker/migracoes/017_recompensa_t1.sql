-- Recompensa da Temporada 1 (ADR-0047). Nada daqui muda a Temporada 1: a tabela só é escrita pelo
-- comando `recompensa-t1`, que exige a Temporada 2 na Pré-temporada.

-- Selo da Temporada 1: quem se inscreveu na T1. Guarda o OVR antes e depois do Piso da
-- Temporada 1 (iguais para quem já estava no piso ou acima).
CREATE TABLE IF NOT EXISTS selo_temporada1 (
  jogador_id      bigint PRIMARY KEY REFERENCES jogador (id),
  ovr_antes       integer NOT NULL,
  ovr_depois      integer NOT NULL,
  recompensado_em timestamptz NOT NULL
);

-- Bônus da Temporada 1: ganhos maiores nas primeiras Rodadas da T2 (como a Resenha).
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS bonus_t1 boolean NOT NULL DEFAULT false;
