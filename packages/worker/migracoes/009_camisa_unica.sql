-- Número da camisa sem repetir no Time (ADR-0013). O banco garante mesmo com duas coletas ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS jogador_camisa_unica ON jogador (time_id, numero) WHERE numero IS NOT NULL AND NOT banido;
