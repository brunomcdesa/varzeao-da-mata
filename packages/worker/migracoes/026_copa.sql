-- Copa A+B (ADR-0088): Mata-mata dos 16 Times nos 3 últimos dias da Pré-temporada, a partir da
-- T3. Usa Rodadas do Mata-mata com números 101 a 103; a etapa fica em cada Partida, porque
-- Quartas e Semifinais caem no mesmo dia. O campeão ganha a estrela bronze.
ALTER TABLE partida ADD COLUMN IF NOT EXISTS copa_etapa text CHECK (copa_etapa IN ('OITAVAS', 'QUARTAS', 'SEMIFINAL', 'FINAL'));
ALTER TABLE temporada ADD COLUMN IF NOT EXISTS campeao_copa_id text REFERENCES time (id);
