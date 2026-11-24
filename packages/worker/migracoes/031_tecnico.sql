-- Técnico e Interesse (ADR-0110) e Capitão em campo (ADR-0111).
--
-- O Técnico é uma pessoa da tabela de Jogadores fora do Elenco (papel TECNICO): quem pendurou
-- as chuteiras guarda ali o boneco, a Carreira, as Moedas e os Itens, e quem nunca jogou ganha
-- uma linha com nunca_jogou. A tabela vira jogador_todos e "jogador" passa a ser a visão só do
-- Elenco (papel JOGADOR): todas as consultas de antes continuam vendo só quem joga.
-- Daqui em diante, ALTER TABLE vai em jogador_todos (a visão não muda de colunas sozinha).
ALTER TABLE jogador RENAME TO jogador_todos;
ALTER TABLE jogador_todos ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'JOGADOR' CHECK (papel IN ('JOGADOR', 'TECNICO'));
ALTER TABLE jogador_todos ADD COLUMN IF NOT EXISTS nunca_jogou boolean NOT NULL DEFAULT false;
-- Temporada em que pendurou as chuteiras: volta a jogar só numa Janela de Temporada seguinte.
ALTER TABLE jogador_todos ADD COLUMN IF NOT EXISTS pendurou_na_temporada integer;
CREATE VIEW jogador AS SELECT * FROM jogador_todos WHERE papel = 'JOGADOR';

CREATE TABLE IF NOT EXISTS tecnico (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id   bigint NOT NULL REFERENCES jogador_todos (id),
  time_id      text NOT NULL REFERENCES time (id),
  -- PEDIDO: Jogador que pediu pelo site para pendurar as chuteiras, esperando a aprovação.
  status       text NOT NULL CHECK (status IN ('PEDIDO', 'ATIVO', 'SAIU')),
  pedido_em    timestamptz NOT NULL,
  aprovado_em  timestamptz,
  saiu_em      timestamptz,
  motivo       text,
  -- Última decisão do Técnico (3 jogos do Time sem nenhuma: perde o cargo).
  decidiu_em   timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tecnico_ativo_por_time ON tecnico (time_id) WHERE status = 'ATIVO';
CREATE UNIQUE INDEX IF NOT EXISTS tecnico_aberto_por_pessoa ON tecnico (jogador_id) WHERE status IN ('PEDIDO', 'ATIVO');

-- Plano do Time: titulares fixados, Sugestão do Capitão, cobradores de escanteio e Marcação.
ALTER TABLE postura ADD COLUMN IF NOT EXISTS fixados jsonb;
ALTER TABLE postura ADD COLUMN IF NOT EXISTS tecnico_id bigint REFERENCES tecnico (id);
ALTER TABLE postura ADD COLUMN IF NOT EXISTS sugestao jsonb;
ALTER TABLE postura ADD COLUMN IF NOT EXISTS escanteio jsonb;
ALTER TABLE postura ADD COLUMN IF NOT EXISTS marcacao jsonb;
-- Campos do Plano que o Técnico decidiu (o resto vale a Sugestão do Capitão, se houver).
ALTER TABLE postura ADD COLUMN IF NOT EXISTS do_tecnico jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Quem fixou: a Escalação guarda que a vaga veio do Técnico (a cartela marca).
ALTER TABLE escalacao ADD COLUMN IF NOT EXISTS fixado boolean NOT NULL DEFAULT false;

-- Pedido de Transferência: espera o aceite do Técnico (ou do Capitão) do Time de destino.
CREATE TABLE IF NOT EXISTS pedido_transferencia (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id    bigint NOT NULL REFERENCES jogador_todos (id),
  temporada_id  integer NOT NULL REFERENCES temporada (id),
  de_time       text NOT NULL REFERENCES time (id),
  para_time     text NOT NULL REFERENCES time (id),
  posicao       text NOT NULL CHECK (posicao IN ('GOL', 'ZAG', 'MEI', 'ATA')),
  -- PEDIDO (o Jogador pediu), CONVITE (o Time convidou e o Jogador aceitou não passa por aqui), FILA (a vaga abriu).
  origem        text NOT NULL DEFAULT 'PEDIDO' CHECK (origem IN ('PEDIDO', 'FILA')),
  ref           text NOT NULL,
  pedido_em     timestamptz NOT NULL,
  prazo         timestamptz NOT NULL,
  -- Quem decide (Técnico ou Capitão); null: ninguém pode decidir e vale o prazo.
  decisor_id    bigint REFERENCES jogador_todos (id),
  status        text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'ACEITO', 'RECUSADO', 'CAIU')),
  decidido_em   timestamptz,
  motivo        text
);
CREATE UNIQUE INDEX IF NOT EXISTS pedido_aberto_por_jogador ON pedido_transferencia (jogador_id) WHERE status = 'ABERTO';

-- Convite: o Time chama um Jogador de outro Time (até 3 abertos por Time).
CREATE TABLE IF NOT EXISTS convite (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  time_id      text NOT NULL REFERENCES time (id),
  autor_id     bigint NOT NULL REFERENCES jogador_todos (id),
  jogador_id   bigint NOT NULL REFERENCES jogador_todos (id),
  posicao      text NOT NULL CHECK (posicao IN ('GOL', 'ZAG', 'MEI', 'ATA')),
  criado_em    timestamptz NOT NULL,
  expira_em    timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'ACEITO', 'RECUSADO', 'EXPIRADO', 'CAIU')),
  decidido_em  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS convite_aberto_por_par ON convite (time_id, jogador_id) WHERE status = 'ABERTO';

-- Troca casada: dois Jogadores da mesma Posição trocam de Time.
CREATE TABLE IF NOT EXISTS troca_casada (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  autor_id      bigint NOT NULL REFERENCES jogador_todos (id),
  jogador_a     bigint NOT NULL REFERENCES jogador_todos (id),
  jogador_b     bigint NOT NULL REFERENCES jogador_todos (id),
  time_a        text NOT NULL REFERENCES time (id),
  time_b        text NOT NULL REFERENCES time (id),
  posicao       text NOT NULL CHECK (posicao IN ('GOL', 'ZAG', 'MEI', 'ATA')),
  criada_em     timestamptz NOT NULL,
  expira_em     timestamptz NOT NULL,
  aceite_a      boolean NOT NULL DEFAULT false,
  aceite_b      boolean NOT NULL DEFAULT false,
  -- Os Times: true aceitou, false recusou, null ainda não respondeu (vale o prazo).
  time_a_ok     boolean,
  time_b_ok     boolean,
  status        text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'FEITA', 'RECUSADA', 'EXPIRADA', 'CAIU')),
  decidida_em   timestamptz
);

-- Fila de espera de uma Posição cheia num Time: novato (sem Jogador ainda) ou veterano.
CREATE TABLE IF NOT EXISTS fila_espera (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  time_id       text NOT NULL REFERENCES time (id),
  posicao       text NOT NULL CHECK (posicao IN ('GOL', 'ZAG', 'MEI', 'ATA')),
  jogador_id    bigint REFERENCES jogador_todos (id),
  ig_user_id    text NOT NULL,
  username      text NOT NULL,
  ref           text NOT NULL,
  entrou_em     timestamptz NOT NULL,
  temporada_id  integer NOT NULL REFERENCES temporada (id),
  status        text NOT NULL DEFAULT 'ESPERANDO' CHECK (status IN ('ESPERANDO', 'CHAMADO', 'SAIU'))
);
CREATE UNIQUE INDEX IF NOT EXISTS fila_uma_por_pessoa ON fila_espera (ig_user_id) WHERE status = 'ESPERANDO';

-- Avisos pessoais (ADR-0110): o aparelho com Vínculo e Avisos ligados guarda de quem é.
ALTER TABLE aviso_aparelho ADD COLUMN IF NOT EXISTS jogador_id bigint;

-- Grito da Temporada (ADR-0111): o que o Capitão escolheu entre as 3 opções do Time.
CREATE TABLE IF NOT EXISTS grito_da_temporada (
  temporada_id  integer NOT NULL REFERENCES temporada (id),
  time_id       text NOT NULL REFERENCES time (id),
  opcao         integer NOT NULL CHECK (opcao BETWEEN 0 AND 2),
  capitao_id    bigint REFERENCES jogador_todos (id),
  escolhido_em  timestamptz NOT NULL,
  PRIMARY KEY (temporada_id, time_id)
);

-- Chamada da Presença (ADR-0111): uma por jogo do Time.
CREATE TABLE IF NOT EXISTS chamada_da_presenca (
  partida_id  integer NOT NULL REFERENCES partida (id),
  time_id     text NOT NULL REFERENCES time (id),
  capitao_id  bigint REFERENCES jogador_todos (id),
  feita_em    timestamptz NOT NULL,
  PRIMARY KEY (partida_id, time_id)
);

-- Moedas do Técnico (ADR-0110): vitória do Time.
ALTER TABLE lancamento_moedas DROP CONSTRAINT IF EXISTS lancamento_moedas_tipo_check;
ALTER TABLE lancamento_moedas ADD CONSTRAINT lancamento_moedas_tipo_check
  CHECK (tipo IN ('SALARIO', 'GOL', 'ASSISTENCIA', 'SELECAO_RODADA', 'CRAQUE_RODADA', 'TITULO', 'TITULO_COPA', 'BONUS_LARGADA', 'PALPITE', 'CONQUISTA', 'COMPRA', 'VITORIA'));
