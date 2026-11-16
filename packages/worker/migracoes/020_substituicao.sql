-- Substituição (ADR-0061): o Banco (até 2 reservas de linha) fica na própria Escalação, nos
-- lugares depois dos titulares (7 e 8), com `reserva`. Só conta como jogo para quem `entrou`.
-- `lugar_em_campo`: o lugar de quem saiu, onde o reserva jogou. `substituicao`: SAIU (titular
-- que deixou o campo no intervalo) ou ENTROU (reserva que jogou o 2º tempo).
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS reserva boolean NOT NULL DEFAULT false;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS entrou boolean NOT NULL DEFAULT false;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS lugar_em_campo integer;
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS substituicao text CHECK (substituicao IN ('SAIU', 'ENTROU'));
