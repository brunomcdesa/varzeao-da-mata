-- Narração do Ao Vivo do site: um áudio do jogo inteiro, gerado junto com o Reels.
ALTER TABLE partida ADD COLUMN IF NOT EXISTS narracao_url text;
