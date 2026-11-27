-- Audiência do site por dia (ADR-0119), vinda do Cloudflare Web Analytics.
-- Um dia (UTC) por linha e por recorte: 'total' (valor ''), 'pagina', 'pais' ou 'origem'.
-- Só agregados, nada pessoal. Os números do Cloudflare são amostrados (estimativas).
-- `fechado` fica falso enquanto o dia ainda pode mudar; a coleta refaz os últimos dias.
CREATE TABLE IF NOT EXISTS audiencia_site_dia (
  dia          date NOT NULL,
  recorte      text NOT NULL CHECK (recorte IN ('total', 'pagina', 'pais', 'origem')),
  valor        text NOT NULL DEFAULT '',
  paginas      integer NOT NULL,
  visitas      integer NOT NULL,
  fechado      boolean NOT NULL DEFAULT false,
  coletado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, recorte, valor)
);
