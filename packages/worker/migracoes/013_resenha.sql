-- Resenha (ADR-0033): o Jogador escalado que comentou no Reels do último jogo do próprio Time
-- tem ganhos de Habilidade maiores nesta Partida. A Escalação guarda quem tinha.
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS resenha boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS comando_midia_usuario ON comando (ig_media_id, ig_user_id);
