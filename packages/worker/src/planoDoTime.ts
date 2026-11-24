/**
 * Plano do Time (ADRs 0110 e 0111): o que o Técnico decide (Postura, Formação e titulares
 * fixados), a Sugestão do Capitão (vale nos campos que o Técnico não decidiu até o Corte) e o
 * que fica sempre com o Capitão (Batedores, cobradores de escanteio, Marcação individual,
 * Grito da Temporada e Chamada da Presença).
 */
import { FALA_DO_TIME, FORMACAO_PADRAO, POSTURAS, ehFormacao, gritoDoTime, type Formacao, type Postura, type TimeId } from '@liga/shared';
import { avisarPessoas } from './avisosPessoais.js';
import type { Banco } from './banco.js';
import { MAXIMO_DE_FIXADOS, cargoDe, marcarDecisao, quemDecide, tecnicoDoTime } from './tecnico.js';
import { capitaoDaPartida, proximaPartidaDoTime, suspensos } from './temporada2.js';

export interface LinhaDoPlano {
  postura: Postura;
  formacao: Formacao;
  fixados: string[];
  escanteio: string[];
  marcacao: { marcador: string; alvo: string } | null;
}

type Campo = 'postura' | 'formacao' | 'fixados';
interface Sugestao {
  postura?: Postura;
  formacao?: Formacao;
  fixados?: string[];
}

/**
 * O Plano que vale na Escalação: o campo que o Técnico decidiu; senão a Sugestão do Capitão
 * (quando o Time tem Técnico); senão o que foi escolhido antes (Capitão sem Técnico) ou o padrão.
 */
export async function planosDaPartida(b: Banco, partidaId: number): Promise<Map<TimeId, LinhaDoPlano>> {
  const linhas = (
    await b.query<{ time_id: TimeId; postura: Postura | null; formacao: Formacao | null; fixados: string[] | null; escanteio: string[] | null; marcacao: { marcador: string; alvo: string } | null; sugestao: Sugestao | null; do_tecnico: Campo[] | null }>(
      `SELECT time_id, postura, formacao, fixados, escanteio, marcacao, sugestao, do_tecnico FROM postura WHERE partida_id = $1`,
      [partidaId],
    )
  ).rows;
  const r = new Map<TimeId, LinhaDoPlano>();
  for (const l of linhas) {
    const doTecnico = new Set(l.do_tecnico ?? []);
    const sug = l.sugestao ?? {};
    const vale = <K extends Campo>(c: K, coluna: LinhaDoPlano[K] | null | undefined): LinhaDoPlano[K] | undefined =>
      doTecnico.has(c) ? (coluna ?? undefined) : ((sug[c] as LinhaDoPlano[K] | undefined) ?? coluna ?? undefined);
    r.set(l.time_id, {
      postura: vale('postura', l.postura) ?? 'EQUILIBRADA',
      formacao: vale('formacao', l.formacao) ?? FORMACAO_PADRAO,
      fixados: (vale('fixados', l.fixados) ?? []).map(String),
      escanteio: (l.escanteio ?? []).map(String),
      marcacao: l.marcacao ?? null,
    });
  }
  return r;
}

const iso = (d: Date) => d.toISOString();

/** Quem pode mexer no Plano do Time e em quais campos, no próximo jogo. */
async function papelNoTime(
  b: Banco,
  pessoaId: string,
  agora: Date,
  comVinculo: ReadonlySet<string>,
): Promise<{ time: TimeId; partidaId: number; tecnico: boolean; capitao: boolean; temTecnico: boolean } | null> {
  const cargo = await cargoDe(b, pessoaId);
  const time = cargo?.time ?? (await b.query<{ time_id: TimeId }>(`SELECT time_id FROM jogador WHERE id = $1 AND NOT banido`, [pessoaId])).rows[0]?.time_id;
  if (!time) return null;
  const p = await proximaPartidaDoTime(b, time, agora);
  if (!p) return null;
  const temTecnico = !!(await tecnicoDoTime(b, time));
  const capitao = !cargo && (await capitaoDaPartida(b, p.id, time, comVinculo)) === pessoaId;
  return { time, partidaId: p.id, tecnico: !!cargo, capitao, temTecnico };
}

async function gravar(b: Banco, partidaId: number, time: TimeId, coluna: string, valor: unknown, quem: string, agora: Date, doTecnico?: Campo): Promise<void> {
  await b.query(
    `INSERT INTO postura (partida_id, time_id, ${coluna}, capitao_id, escolhida_em${doTecnico ? ', do_tecnico' : ''}) VALUES ($1, $2, $3, $4, $5${doTecnico ? `, '["${doTecnico}"]'::jsonb` : ''})
     ON CONFLICT (partida_id, time_id) DO UPDATE SET ${coluna} = EXCLUDED.${coluna}, escolhida_em = EXCLUDED.escolhida_em${
       doTecnico ? `, do_tecnico = (SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements_text(postura.do_tecnico || '["${doTecnico}"]'::jsonb) x)` : ''
     }`,
    [partidaId, time, typeof valor === 'string' ? valor : JSON.stringify(valor), quem, iso(agora)],
  );
}

async function gravarSugestao(b: Banco, partidaId: number, time: TimeId, campo: Campo, valor: unknown, agora: Date): Promise<void> {
  await b.query(
    `INSERT INTO postura (partida_id, time_id, sugestao, escolhida_em) VALUES ($1, $2, jsonb_build_object($3::text, $4::jsonb), $5)
     ON CONFLICT (partida_id, time_id) DO UPDATE SET sugestao = coalesce(postura.sugestao, '{}'::jsonb) || jsonb_build_object($3::text, $4::jsonb)`,
    [partidaId, time, campo, JSON.stringify(valor), iso(agora)],
  );
}

export interface ResultadoDoPlano {
  ok: boolean;
  mensagem: string;
}

/**
 * Postura, Formação ou titulares fixados: o Técnico decide; com Técnico, o Capitão sugere;
 * sem Técnico, o Capitão decide (nunca fixa a si mesmo).
 */
export async function decidirPlano(
  b: Banco,
  pessoaId: string,
  campo: Campo,
  valor: unknown,
  agora: Date,
  comVinculo: ReadonlySet<string>,
): Promise<ResultadoDoPlano> {
  const papel = await papelNoTime(b, pessoaId, agora, comVinculo);
  if (!papel) return { ok: false, mensagem: 'Não há jogo do seu Time aberto para escolher agora.' };
  if (!papel.tecnico && !papel.capitao) return { ok: false, mensagem: 'Só o Técnico ou o Capitão do Time mexem no plano.' };
  let v: unknown = valor;
  if (campo === 'postura' && !(POSTURAS as readonly string[]).includes(String(valor))) return { ok: false, mensagem: 'Postura desconhecida.' };
  if (campo === 'formacao' && !ehFormacao(String(valor))) return { ok: false, mensagem: 'Formação desconhecida.' };
  if (campo === 'fixados') {
    const ids = Array.isArray(valor) ? [...new Set(valor.map(String))] : [];
    if (ids.length > MAXIMO_DE_FIXADOS) return { ok: false, mensagem: `Fixe no máximo ${MAXIMO_DE_FIXADOS} titulares.` };
    if (papel.capitao && ids.includes(pessoaId)) return { ok: false, mensagem: 'O Capitão não fixa a si mesmo.' };
    if (ids.length) {
      const doTime = (await b.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE time_id = $1 AND NOT banido AND id::text = ANY($2)`, [papel.time, ids])).rows;
      if (doTime.length !== ids.length) return { ok: false, mensagem: 'Só dá para fixar Jogadores do Time.' };
      const fora = await suspensos(b, papel.time, papel.partidaId);
      if (ids.some((id) => fora.has(id))) return { ok: false, mensagem: 'Jogador suspenso não pode ser fixado.' };
    }
    v = ids;
  }
  const nome = campo === 'postura' ? 'Postura' : campo === 'formacao' ? 'Formação' : 'Titulares fixados';
  if (papel.tecnico) {
    await gravar(b, papel.partidaId, papel.time, campo, v, pessoaId, agora, campo);
    await marcarDecisao(b, pessoaId, agora);
    return { ok: true, mensagem: `${nome} salvo para o próximo jogo.` };
  }
  if (papel.temTecnico) {
    await gravarSugestao(b, papel.partidaId, papel.time, campo, v, agora);
    return { ok: true, mensagem: `Sugestão enviada ao Técnico. Se ele não decidir até o Corte, vale a sua.` };
  }
  await gravar(b, papel.partidaId, papel.time, campo, v, pessoaId, agora);
  return { ok: true, mensagem: `${nome} salvo para o próximo jogo.` };
}

/** Cobradores de escanteio (ADR-0111): 1 e 1 reserva, só o Capitão. */
export async function decidirEscanteio(b: Banco, pessoaId: string, ids: string[], agora: Date, comVinculo: ReadonlySet<string>): Promise<ResultadoDoPlano> {
  const papel = await papelNoTime(b, pessoaId, agora, comVinculo);
  if (!papel?.capitao) return { ok: false, mensagem: 'Só o Capitão escolhe os cobradores.' };
  const lista = [...new Set(ids.map(String))].slice(0, 2);
  if (lista.length) {
    const linha = (await b.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE time_id = $1 AND NOT banido AND posicao <> 'GOL' AND id::text = ANY($2)`, [papel.time, lista])).rows;
    if (linha.length !== lista.length) return { ok: false, mensagem: 'Escolha Jogadores de linha do Time.' };
  }
  await gravar(b, papel.partidaId, papel.time, 'escanteio', lista, pessoaId, agora);
  return { ok: true, mensagem: lista.length ? 'Cobradores de escanteio salvos.' : 'Escanteio volta ao sorteio.' };
}

/** Marcação individual (ADR-0111): um zagueiro ou meia do Time num rival de linha, em segredo. */
export async function decidirMarcacao(b: Banco, pessoaId: string, valor: string, agora: Date, comVinculo: ReadonlySet<string>): Promise<ResultadoDoPlano> {
  const papel = await papelNoTime(b, pessoaId, agora, comVinculo);
  if (!papel?.capitao) return { ok: false, mensagem: 'Só o Capitão escolhe a Marcação.' };
  if (!valor) {
    await gravar(b, papel.partidaId, papel.time, 'marcacao', null, pessoaId, agora);
    return { ok: true, mensagem: 'Sem Marcação individual no próximo jogo.' };
  }
  const [marcador, alvo] = valor.split(':');
  const rival = (await b.query<{ mandante_id: TimeId; visitante_id: TimeId }>(`SELECT mandante_id, visitante_id FROM partida WHERE id = $1`, [papel.partidaId])).rows[0]!;
  const adversario = rival.mandante_id === papel.time ? rival.visitante_id : rival.mandante_id;
  const m = (await b.query<{ posicao: string }>(`SELECT posicao FROM jogador WHERE id::text = $1 AND time_id = $2 AND NOT banido`, [marcador ?? '', papel.time])).rows[0];
  if (!m || (m.posicao !== 'ZAG' && m.posicao !== 'MEI')) return { ok: false, mensagem: 'O marcador tem que ser um zagueiro ou meia do Time.' };
  const a = (await b.query<{ posicao: string }>(`SELECT posicao FROM jogador WHERE id::text = $1 AND time_id = $2 AND NOT banido`, [alvo ?? '', adversario])).rows[0];
  if (!a || a.posicao === 'GOL') return { ok: false, mensagem: 'O alvo tem que ser um Jogador de linha do adversário.' };
  await gravar(b, papel.partidaId, papel.time, 'marcacao', { marcador, alvo }, pessoaId, agora);
  return { ok: true, mensagem: 'Marcação individual salva. Fica em segredo até o jogo.' };
}

/** Grito da Temporada (ADR-0111): o Capitão escolhe 1 das 3 opções, na Janela. */
export async function escolherGrito(b: Banco, pessoaId: string, opcao: number, agora: Date, comVinculo: ReadonlySet<string>): Promise<ResultadoDoPlano> {
  if (![0, 1, 2].includes(opcao)) return { ok: false, mensagem: 'Opção de Grito desconhecida.' };
  const papel = await papelNoTime(b, pessoaId, agora, comVinculo);
  if (!papel?.capitao) return { ok: false, mensagem: 'Só o Capitão escolhe o Grito.' };
  const t = (
    await b.query<{ id: number; primeiro: Date | string | null }>(
      `SELECT t.id, (SELECT min(p.apito_inicial) FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = t.id) AS primeiro
         FROM temporada t WHERE t.status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY t.status = 'EM_ANDAMENTO' DESC, t.numero LIMIT 1`,
    )
  ).rows[0];
  if (!t || (t.primeiro && agora.getTime() >= new Date(t.primeiro).getTime() - 20 * 60_000)) return { ok: false, mensagem: 'O Grito se escolhe na Janela, antes do primeiro jogo.' };
  await b.query(
    `INSERT INTO grito_da_temporada (temporada_id, time_id, opcao, capitao_id, escolhido_em) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (temporada_id, time_id) DO UPDATE SET opcao = EXCLUDED.opcao, capitao_id = EXCLUDED.capitao_id, escolhido_em = EXCLUDED.escolhido_em`,
    [t.id, papel.time, opcao, pessoaId, iso(agora)],
  );
  return { ok: true, mensagem: 'Grito da Temporada escolhido.' };
}

/** Chamada da Presença (ADR-0111): uma por jogo; quem manda os Avisos é o job (`chamadasPendentes`). */
export async function chamarPresenca(b: Banco, pessoaId: string, agora: Date, comVinculo: ReadonlySet<string>): Promise<ResultadoDoPlano> {
  const papel = await papelNoTime(b, pessoaId, agora, comVinculo);
  if (!papel?.capitao) return { ok: false, mensagem: 'Só o Capitão faz a Chamada da Presença.' };
  const r = await b.query(`INSERT INTO chamada_da_presenca (partida_id, time_id, capitao_id, feita_em) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING partida_id`, [
    papel.partidaId,
    papel.time,
    pessoaId,
    iso(agora),
  ]);
  if (!r.rows.length) return { ok: false, mensagem: 'A Chamada deste jogo já foi feita.' };
  // Aviso pessoal para o Elenco (quem tem Vínculo e Avisos ligados).
  const elenco = (await b.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE time_id = $1 AND NOT banido AND id::text <> $2`, [papel.time, pessoaId])).rows.map((j) => j.id);
  const jogo = (await b.query<{ mandante_id: TimeId; visitante_id: TimeId }>(`SELECT mandante_id, visitante_id FROM partida WHERE id = $1`, [papel.partidaId])).rows[0];
  const rival = jogo ? (jogo.mandante_id === papel.time ? jogo.visitante_id : jogo.mandante_id) : null;
  await avisarPessoas(b, elenco, (id) => ({
    tipo: 'CHAMADA',
    titulo: 'Chamada da Presença',
    corpo: `O Capitão chamou o Elenco${rival ? ` para o jogo contra ${FALA_DO_TIME[rival].artigo} ${FALA_DO_TIME[rival].curto}` : ''}. Confirme a Presença antes do Corte.`,
    url: `#/jogador/${id}`,
  }));
  return { ok: true, mensagem: 'Chamada feita: o Elenco recebe o Aviso para confirmar a Presença.' };
}

/** Quem decide no Time de uma pessoa (para o painel do site). */
export { quemDecide };

/**
 * Capitão em campo na Partida (ADR-0111): cobradores de escanteio e Marcação individual de cada
 * lado, para a simulação (VERSAO_SIM_T3 22). Sem escolha, o lado fica de fora e vale o sorteio.
 */
export async function capitaoEmCampo(
  b: Banco,
  partidaId: number,
  mandante: TimeId,
  visitante: TimeId,
): Promise<{ escanteio: Partial<Record<'mandante' | 'visitante', string[]>>; marcacao: Partial<Record<'mandante' | 'visitante', { marcador: string; alvo: string }>> }> {
  const planos = await planosDaPartida(b, partidaId);
  const escanteio: Partial<Record<'mandante' | 'visitante', string[]>> = {};
  const marcacao: Partial<Record<'mandante' | 'visitante', { marcador: string; alvo: string }>> = {};
  for (const [lado, time] of [['mandante', mandante], ['visitante', visitante]] as const) {
    const p = planos.get(time);
    if (p?.escanteio.length) escanteio[lado] = p.escanteio;
    if (p?.marcacao) marcacao[lado] = { marcador: String(p.marcacao.marcador), alvo: String(p.marcacao.alvo) };
  }
  return { escanteio, marcacao };
}

/** Grito da Temporada de cada lado da Partida (ADR-0111), já em texto; lado sem escolha fica de fora. */
export async function gritosDaPartida(b: Banco, partidaId: number): Promise<Partial<Record<'mandante' | 'visitante', string>>> {
  const linhas = (
    await b.query<{ mandante_id: TimeId; visitante_id: TimeId; time_id: TimeId; opcao: number }>(
      `SELECT p.mandante_id, p.visitante_id, g.time_id, g.opcao
         FROM partida p JOIN rodada r ON r.id = p.rodada_id
         JOIN grito_da_temporada g ON g.temporada_id = r.temporada_id AND g.time_id IN (p.mandante_id, p.visitante_id)
        WHERE p.id = $1`,
      [partidaId],
    )
  ).rows;
  const r: Partial<Record<'mandante' | 'visitante', string>> = {};
  for (const l of linhas) r[l.time_id === l.mandante_id ? 'mandante' : 'visitante'] = gritoDoTime(l.time_id, l.opcao);
  return r;
}
