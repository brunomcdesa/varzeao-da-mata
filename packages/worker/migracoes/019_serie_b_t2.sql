-- Série B da T2 (ADR-0058): a A passa a ter 16 Times (fundadores e os 8 que chegaram na T2) e
-- 8 Times novos estreiam a Série B.
ALTER TABLE time DROP CONSTRAINT IF EXISTS time_id_check;
ALTER TABLE time ADD CONSTRAINT time_id_check CHECK (id IN (
  'CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA',
  'JAC', 'SUC', 'LOB', 'CDM', 'BOT', 'PIR', 'COR', 'MOR',
  'QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG'
));
