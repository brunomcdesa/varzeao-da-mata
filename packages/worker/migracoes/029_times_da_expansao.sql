-- Times da Expansão por lotação (ADR-0093): Gato, Rato, Escorpião e Aranha. Ficam cadastrados e
-- guardados até a Expansão os colocar na Série B.
ALTER TABLE time DROP CONSTRAINT IF EXISTS time_id_check;
ALTER TABLE time ADD CONSTRAINT time_id_check CHECK (id IN (
  'CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA',
  'JAC', 'SUC', 'LOB', 'LEA', 'BOT', 'TAR', 'COR', 'BES',
  'QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG',
  'GAT', 'RAT', 'ESC', 'ARN'
));

-- Gatilho da Expansão (ADR-0093): marcado no fim da Fase de Liga quando 90% das vagas estão
-- ocupadas. A Temporada seguinte nasce com os 4 Times novos na B e ninguém caindo da A.
ALTER TABLE temporada ADD COLUMN expansao boolean NOT NULL DEFAULT false;

-- Copa de 20 (ADR-0093): Fase do Clássico e Repescagem.
ALTER TABLE partida DROP CONSTRAINT IF EXISTS partida_copa_etapa_check;
ALTER TABLE partida ADD CONSTRAINT partida_copa_etapa_check
  CHECK (copa_etapa IN ('CLASSICO', 'OITAVAS', 'REPESCAGEM', 'QUARTAS', 'SEMIFINAL', 'FINAL'));
