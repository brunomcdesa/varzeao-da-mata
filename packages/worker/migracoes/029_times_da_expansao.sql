-- Times da Expansão por lotação (ADR-0093): Gato, Rato, Escorpião e Aranha. Ficam cadastrados e
-- guardados até a Expansão os colocar na Série B.
ALTER TABLE time DROP CONSTRAINT IF EXISTS time_id_check;
ALTER TABLE time ADD CONSTRAINT time_id_check CHECK (id IN (
  'CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA',
  'JAC', 'SUC', 'LOB', 'LEA', 'BOT', 'TAR', 'COR', 'BES',
  'QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG',
  'GAT', 'RAT', 'ESC', 'ARN'
));
