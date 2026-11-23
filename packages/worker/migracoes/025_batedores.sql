-- Batedores (ADR-0091): a ordem dos 5 primeiros cobradores da Disputa de pênaltis, escolhida pelo
-- Capitão junto com a Postura e a Formação (ids dos Jogadores, em ordem). Vale a partir da T3.
ALTER TABLE postura ADD COLUMN IF NOT EXISTS batedores jsonb;
