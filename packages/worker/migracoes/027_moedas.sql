-- Moedas (ADRs 0087, 0089 e 0090): o extrato de cada Jogador, os Palpites e as Conquistas.
-- O saldo é a soma do extrato. Cada lançamento tem uma referência única por Jogador e tipo, para
-- o pagamento poder rodar de novo sem pagar duas vezes. `visivel_em` esconde o que sai de uma
-- Partida até o fim do Ao Vivo (o saldo não pode estragar o resultado).
CREATE TABLE lancamento_moedas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id  bigint NOT NULL REFERENCES jogador (id),
  tipo        text NOT NULL CHECK (tipo IN ('SALARIO', 'GOL', 'ASSISTENCIA', 'SELECAO_RODADA', 'CRAQUE_RODADA', 'TITULO', 'TITULO_COPA', 'BONUS_LARGADA', 'PALPITE', 'CONQUISTA', 'COMPRA')),
  referencia  text NOT NULL,
  valor       integer NOT NULL,
  descricao   text NOT NULL,
  dia         date,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  visivel_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jogador_id, tipo, referencia)
);
CREATE INDEX lancamento_moedas_jogador ON lancamento_moedas (jogador_id, visivel_em);

CREATE TABLE palpite (
  jogador_id  bigint NOT NULL REFERENCES jogador (id),
  partida_id  integer NOT NULL REFERENCES partida (id),
  mandante    integer NOT NULL CHECK (mandante BETWEEN 0 AND 30),
  visitante   integer NOT NULL CHECK (visitante BETWEEN 0 AND 30),
  feito_em    timestamptz NOT NULL,
  pontos      integer,
  PRIMARY KEY (jogador_id, partida_id)
);

CREATE TABLE conquista (
  jogador_id  bigint NOT NULL REFERENCES jogador (id),
  codigo      text NOT NULL,
  partida_id  integer REFERENCES partida (id),
  temporada   integer NOT NULL,
  pagou       boolean NOT NULL,
  em          timestamptz NOT NULL,
  PRIMARY KEY (jogador_id, codigo)
);
