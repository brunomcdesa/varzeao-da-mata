/**
 * Capitão ativo (ADR-0114): o Capitão precisa mexer no Time. Quem fica com a faixa 3 jogos do
 * Time sem nenhuma escolha de Capitão perde a faixa (mesmo a posta à mão) e sai da ordem até a
 * Temporada seguinte. A faixa vai para o próximo da ordem que está ativo: com Vínculo e que
 * confirmou Presença (ou fez escolha de Capitão) nos últimos 3 jogos do Time; sem ninguém
 * assim, segue a ordem normal. Quem recebe e quem perdeu ganham Aviso no App. A Temporada
 * que conta é a em andamento (ou a mais nova, na Pré-temporada).
 */
import { FALA_DO_TIME, TIMES, type TimeId } from '@liga/shared';
import { avisarPessoas } from './avisosPessoais.js';
import type { Banco } from './banco.js';
import { capitaoDaPartida, ordemDoCapitao, proximaPartidaDoTime, suspensos } from './temporada2.js';

export const JOGOS_SEM_ESCOLHA_DO_CAPITAO = 3;

/** As escolhas que mostram um Capitão ativo. */
export const ESCOLHAS_DE_CAPITAO = new Set(['POSTURA', 'FORMACAO', 'FIXADOS', 'BATEDORES', 'ESCANTEIO', 'MARCACAO', 'GRITO', 'CHAMADA']);

const iso = (d: Date) => d.toISOString();

/** Guarda a última escolha de Capitão de uma pessoa. */
export async function marcarEscolhaDoCapitao(b: Banco, jogadorId: string, agora: Date): Promise<void> {
  await b.query(
    `INSERT INTO capitao_escolha (jogador_id, em) VALUES ($1, $2) ON CONFLICT (jogador_id) DO UPDATE SET em = GREATEST(capitao_escolha.em, EXCLUDED.em)`,
    [jogadorId, iso(agora)],
  );
}

/** Quem está ativo no Time: Presença ou escolha de Capitão desde o 3º último jogo terminado. */
async function ativosDoTime(b: Banco, time: TimeId): Promise<Set<string>> {
  const jogos = (
    await b.query<{ id: number; apito: Date | string }>(
      `SELECT id, apito_inicial AS apito FROM partida WHERE (mandante_id = $1 OR visitante_id = $1) AND resultado IS NOT NULL ORDER BY apito_inicial DESC LIMIT $2`,
      [time, JOGOS_SEM_ESCOLHA_DO_CAPITAO],
    )
  ).rows;
  if (!jogos.length) return new Set();
  const desde = new Date(jogos[jogos.length - 1]!.apito);
  const r = await b.query<{ id: string }>(
    `SELECT jogador_id::text AS id FROM presenca WHERE partida_id = ANY($1::int[])
     UNION SELECT c.jogador_id::text FROM capitao_escolha c JOIN jogador j ON j.id = c.jogador_id WHERE j.time_id = $2 AND c.em >= $3`,
    [jogos.map((j) => j.id), time, iso(new Date(desde.getTime() - 3 * 86_400_000))],
  );
  return new Set(r.rows.map((x) => x.id));
}

export interface TrocaDeFaixa {
  time: TimeId;
  saiu: string;
  entrou: string | null;
}

/**
 * Confere a faixa de cada Time (na coleta): registra quem está com ela e tira de quem ficou
 * 3 jogos do Time sem escolha de Capitão. Devolve as trocas feitas.
 */
export async function conferirCapitaes(b: Banco, agora: Date, comVinculo: ReadonlySet<string>): Promise<TrocaDeFaixa[]> {
  const temporada = (await b.query<{ id: number }>(`SELECT id FROM temporada ORDER BY (status = 'EM_ANDAMENTO') DESC, numero DESC LIMIT 1`)).rows[0]?.id;
  if (!temporada) return [];
  const trocas: TrocaDeFaixa[] = [];
  for (const time of TIMES) {
    const prox = await proximaPartidaDoTime(b, time, agora);
    if (!prox) continue;
    const atual = await capitaoDaPartida(b, prox.id, time, comVinculo);
    if (!atual) continue;
    const faixa = (await b.query<{ jogador_id: string; desde: Date | string }>(`SELECT jogador_id::text AS jogador_id, desde FROM capitao_faixa WHERE time_id = $1`, [time])).rows[0];
    if (!faixa || faixa.jogador_id !== atual) {
      await b.query(
        `INSERT INTO capitao_faixa (time_id, jogador_id, desde) VALUES ($1, $2, $3) ON CONFLICT (time_id) DO UPDATE SET jogador_id = EXCLUDED.jogador_id, desde = EXCLUDED.desde`,
        [time, atual, iso(agora)],
      );
      continue;
    }
    const escolha = (await b.query<{ em: Date | string }>(`SELECT em FROM capitao_escolha WHERE jogador_id = $1`, [atual])).rows[0]?.em;
    const desde = new Date(Math.max(new Date(faixa.desde).getTime(), escolha ? new Date(escolha).getTime() : 0));
    const jogos = Number(
      (
        await b.query<{ n: string }>(
          `SELECT count(*) AS n FROM partida WHERE (mandante_id = $1 OR visitante_id = $1) AND resultado IS NOT NULL AND apito_inicial > $2 AND apito_inicial <= $3`,
          [time, iso(desde), iso(agora)],
        )
      ).rows[0]!.n,
    );
    if (jogos < JOGOS_SEM_ESCOLHA_DO_CAPITAO) continue;
    // Perde a faixa (mesmo a posta à mão) até a Temporada seguinte.
    await b.query(`INSERT INTO capitao_inativo (temporada_id, time_id, jogador_id, em) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [temporada, time, atual, iso(agora)]);
    await b.query(`DELETE FROM capitao_a_mao WHERE time_id = $1 AND jogador_id = $2`, [time, atual]);
    // A faixa vai para o próximo ativo da ordem (com Vínculo e não suspenso).
    const [ordem, fora, ativos] = await Promise.all([ordemDoCapitao(b, time), suspensos(b, time, prox.id), ativosDoTime(b, time)]);
    const proximo = ordem.find((id) => !fora.has(id) && comVinculo.has(id) && ativos.has(id)) ?? null;
    const mao = (await b.query<{ jogador_id: string }>(`SELECT jogador_id::text AS jogador_id FROM capitao_a_mao WHERE time_id = $1`, [time])).rows[0];
    if (proximo && !mao) {
      await b.query(`DELETE FROM capitao_a_mao WHERE jogador_id = $1`, [proximo]);
      await b.query(`INSERT INTO capitao_a_mao (time_id, jogador_id, escolhido_em, origem) VALUES ($1, $2, $3, 'ATIVIDADE')`, [time, proximo, iso(agora)]);
    }
    const entrou = await capitaoDaPartida(b, prox.id, time, comVinculo);
    if (entrou) {
      await b.query(`UPDATE capitao_faixa SET jogador_id = $2, desde = $3 WHERE time_id = $1`, [time, entrou, iso(agora)]);
    } else {
      await b.query(`DELETE FROM capitao_faixa WHERE time_id = $1`, [time]);
    }
    const doTime = `d${FALA_DO_TIME[time].artigo} ${FALA_DO_TIME[time].curto}`;
    if (entrou) {
      await avisarPessoas(b, [entrou], {
        tipo: 'CAPITAO',
        titulo: 'A faixa é sua',
        corpo: `Você é o novo Capitão ${doTime}. Escolha a Formação e a Postura do próximo jogo antes do Corte.`,
        url: `#/time/${time}`,
      });
    }
    await avisarPessoas(b, [atual], {
      tipo: 'CAPITAO',
      titulo: 'Você perdeu a faixa',
      corpo: `Foram ${JOGOS_SEM_ESCOLHA_DO_CAPITAO} jogos sem escolhas de Capitão: a faixa ${doTime} passou para outro Jogador até o fim da Temporada.`,
      url: `#/time/${time}`,
    });
    trocas.push({ time, saiu: atual, entrou });
  }
  return trocas;
}
