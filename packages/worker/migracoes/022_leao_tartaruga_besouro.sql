-- Leão, Tartaruga e Besouro no lugar de Cachorro-do-mato, Pirarucu e Morcego (ADR-0065). Os três
-- nunca jogaram nem tiveram Jogador: só saem da tabela de Times.
DELETE FROM time WHERE id IN ('CDM', 'PIR', 'MOR');
ALTER TABLE time DROP CONSTRAINT IF EXISTS time_id_check;
ALTER TABLE time ADD CONSTRAINT time_id_check CHECK (id IN (
  'CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA',
  'JAC', 'SUC', 'LOB', 'LEA', 'BOT', 'TAR', 'COR', 'BES',
  'QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG'
));
