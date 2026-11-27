-- Supercopa (ADR-0118): jogo único entre o campeão da Série A e o campeão da Copa da Temporada
-- anterior, abrindo a Temporada (a partir da T4). Mora na Rodada 100 do Mata-mata, com a etapa
-- SUPERCOPA na própria Partida. O campeão fica na Temporada em que o jogo acontece.
ALTER TABLE partida DROP CONSTRAINT IF EXISTS partida_copa_etapa_check;
ALTER TABLE partida ADD CONSTRAINT partida_copa_etapa_check
  CHECK (copa_etapa IN ('CLASSICO', 'OITAVAS', 'REPESCAGEM', 'QUARTAS', 'SEMIFINAL', 'FINAL', 'SUPERCOPA'));
ALTER TABLE temporada ADD COLUMN IF NOT EXISTS campeao_supercopa_id text REFERENCES time (id);
-- 20 Moedas para quem entrou em campo pelo campeão da Supercopa.
ALTER TABLE lancamento_moedas DROP CONSTRAINT IF EXISTS lancamento_moedas_tipo_check;
ALTER TABLE lancamento_moedas ADD CONSTRAINT lancamento_moedas_tipo_check
  CHECK (tipo IN ('SALARIO', 'GOL', 'ASSISTENCIA', 'SELECAO_RODADA', 'CRAQUE_RODADA', 'TITULO', 'TITULO_COPA', 'TITULO_SUPERCOPA', 'BONUS_LARGADA', 'PALPITE', 'CONQUISTA', 'COMPRA', 'VITORIA'));
