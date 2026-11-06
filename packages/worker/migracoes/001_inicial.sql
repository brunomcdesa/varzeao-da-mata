-- Esquema inicial do Varzeão da Mata (docs/arquitetura.md, "Modelo de dados").

CREATE TABLE temporada (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero      integer NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'PRE_TEMPORADA' CHECK (status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO', 'ENCERRADA')),
  inicio      date NOT NULL
);

CREATE TABLE time (
  id          text PRIMARY KEY CHECK (id IN ('CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA')),
  nome        text NOT NULL,
  apelidos    text[] NOT NULL DEFAULT '{}',
  primaria    text NOT NULL,
  secundaria  text NOT NULL
);

-- O Jogador pertence à conta do Instagram (ig_user_id), não ao @ (GLOSSARY: Jogador).
CREATE TABLE jogador (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ig_user_id   text NOT NULL UNIQUE,
  username     text NOT NULL,
  time_id      text NOT NULL REFERENCES time (id),
  posicao      text NOT NULL CHECK (posicao IN ('GOL', 'ZAG', 'MEI', 'ATA')),
  ovr          integer NOT NULL CHECK (ovr BETWEEN 1 AND 99),
  banido       boolean NOT NULL DEFAULT false,
  inscrito_em  timestamptz NOT NULL
);
CREATE INDEX jogador_time ON jogador (time_id, posicao) WHERE NOT banido;
CREATE INDEX jogador_username ON jogador (lower(username));

-- Todo comentário com Comando vira uma linha; ig_comment_id único garante idempotência.
CREATE TABLE comando (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ig_comment_id  text NOT NULL UNIQUE,
  ig_media_id    text NOT NULL,
  ig_user_id     text NOT NULL,
  username       text NOT NULL,
  texto          text NOT NULL,
  comentado_em   timestamptz NOT NULL,
  tipo           text CHECK (tipo IN ('INSCRICAO', 'VOTO', 'INVALIDO', 'IGNORADO')),
  resultado      text
);

CREATE TABLE rodada (
  id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  temporada_id        integer NOT NULL REFERENCES temporada (id),
  numero              integer NOT NULL,
  fase                text NOT NULL CHECK (fase IN ('LIGA', 'MATA_MATA')),
  data                date NOT NULL,
  resumo_status       text NOT NULL DEFAULT 'PENDENTE' CHECK (resumo_status IN ('PENDENTE', 'RENDERIZADO', 'AGENDADO', 'PUBLICADO')),
  resumo_ig_media_id  text,
  UNIQUE (temporada_id, numero)
);

CREATE TABLE partida (
  id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rodada_id           integer NOT NULL REFERENCES rodada (id),
  mandante_id         text NOT NULL REFERENCES time (id),
  visitante_id        text NOT NULL REFERENCES time (id),
  apito_inicial       timestamptz NOT NULL,
  vantagem_do_empate  text CHECK (vantagem_do_empate IN ('mandante', 'visitante')),
  status              text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ESCALADA', 'SIMULADA', 'RENDERIZADA', 'AGENDADA', 'PUBLICADA')),
  seed                bigint,
  versao_sim          integer,
  gols_mandante       integer,
  gols_visitante      integer,
  penaltis            jsonb,
  lances              jsonb,
  video_url           text,
  ig_container_id     text,
  ig_media_id         text,
  CHECK (mandante_id <> visitante_id)
);
CREATE INDEX partida_apito ON partida (apito_inicial);

-- Uma linha por lugar na Escalação; jogador_id nulo = Jogador da Base.
CREATE TABLE escalacao (
  partida_id  integer NOT NULL REFERENCES partida (id),
  time_id     text NOT NULL REFERENCES time (id),
  lugar       integer NOT NULL,
  jogador_id  bigint REFERENCES jogador (id),
  posicao     text NOT NULL CHECK (posicao IN ('GOL', 'ZAG', 'MEI', 'ATA')),
  ovr_antes   integer NOT NULL,
  nota        numeric(4, 2),
  ovr_depois  integer,
  PRIMARY KEY (partida_id, time_id, lugar)
);
CREATE INDEX escalacao_jogador ON escalacao (jogador_id) WHERE jogador_id IS NOT NULL;

CREATE TABLE candidato (
  rodada_id   integer NOT NULL REFERENCES rodada (id),
  jogador_id  bigint NOT NULL REFERENCES jogador (id),
  nota        numeric(4, 2) NOT NULL,
  PRIMARY KEY (rodada_id, jogador_id)
);

-- Um voto por @ por Rodada; o último antes do fechamento vale (GLOSSARY: Craque da Rodada).
CREATE TABLE voto (
  rodada_id   integer NOT NULL REFERENCES rodada (id),
  ig_user_id  text NOT NULL,
  jogador_id  bigint NOT NULL REFERENCES jogador (id),
  votado_em   timestamptz NOT NULL,
  PRIMARY KEY (rodada_id, ig_user_id)
);

CREATE TABLE config (
  chave          text PRIMARY KEY,
  valor          jsonb NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
