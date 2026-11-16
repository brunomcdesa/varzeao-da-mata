-- Grupos da Série A de 16 (T2, ADR-0064): cada Time da A fica no Grupo do Chão ou no Grupo da Copa.
ALTER TABLE serie_do_time ADD COLUMN IF NOT EXISTS grupo text CHECK (grupo IN ('CHAO', 'COPA'));
