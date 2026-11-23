/**
 * A parte leve das Moedas (ADRs 0087 e 0089), usada também pela borda: lançar no extrato, saldo,
 * Palpite e a Carteira que o dono vê pelo Vínculo. Os pagamentos ficam em moedas.ts.
 */
import { CORTE_MINUTOS, NOME_DO_LANCAMENTO, duracaoAoVivoMs, lerPalpite, temMoedas, type Carteira, type TimeId, type TipoDeLancamento } from '@liga/shared';
import type { Banco } from './banco.js';
import { lojaDoJogador } from './loja.js';

export interface Lancamento {
  jogadorId: string;
  tipo: TipoDeLancamento;
  referencia: string;
  valor: number;
  descricao: string;
  dia?: string;
  visivelEm: Date;
}

/** Grava um lançamento; devolve false se ele já existia (mesmo Jogador, tipo e referência). */
export async function lancar(b: Banco, l: Lancamento): Promise<boolean> {
  const r = await b.query(
    `INSERT INTO lancamento_moedas (jogador_id, tipo, referencia, valor, descricao, dia, visivel_em) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (jogador_id, tipo, referencia) DO NOTHING RETURNING id`,
    [l.jogadorId, l.tipo, l.referencia, l.valor, l.descricao, l.dia ?? null, l.visivelEm.toISOString()],
  );
  return r.rows.length > 0;
}

/** O saldo que o Jogador vê (só o que já está visível). */
export async function saldo(b: Banco, jogadorId: string, agora: Date): Promise<number> {
  return Number(
    (await b.query<{ s: string | null }>(`SELECT sum(valor) AS s FROM lancamento_moedas WHERE jogador_id = $1 AND visivel_em <= $2`, [jogadorId, agora.toISOString()])).rows[0]?.s ?? 0,
  );
}


// ---------------------------------------------------------------- Palpite e Carteira

/** Registra (ou troca) o Palpite de um Jogador com Vínculo, até o Corte da Partida. */
export async function registrarPalpite(b: Banco, jogadorId: string, valor: string, agora: Date): Promise<{ ok: boolean; mensagem: string }> {
  const x = lerPalpite(valor);
  if (!x || x.mandante > 30 || x.visitante > 30) return { ok: false, mensagem: 'Palpite inválido.' };
  const p = (
    await b.query<{ apito: Date | string; temporada: number; mandante_id: TimeId; visitante_id: TimeId }>(
      `SELECT p.apito_inicial AS apito, t.numero AS temporada, p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id WHERE p.id = $1`,
      [x.partidaId],
    )
  ).rows[0];
  if (!p) return { ok: false, mensagem: 'Partida não encontrada.' };
  if (!temMoedas(p.temporada)) return { ok: false, mensagem: 'O Palpite chega na Temporada 3.' };
  if (agora.getTime() >= new Date(p.apito).getTime() - CORTE_MINUTOS * 60_000) return { ok: false, mensagem: 'Os Palpites desse jogo fecharam no Corte.' };
  await b.query(
    `INSERT INTO palpite (jogador_id, partida_id, mandante, visitante, feito_em) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (jogador_id, partida_id) DO UPDATE SET mandante = EXCLUDED.mandante, visitante = EXCLUDED.visitante, feito_em = EXCLUDED.feito_em`,
    [jogadorId, x.partidaId, x.mandante, x.visitante, agora.toISOString()],
  );
  return { ok: true, mensagem: `Palpite salvo: ${x.mandante} a ${x.visitante}.` };
}

/** A Carteira do Jogador (só pelo Vínculo): saldo, últimos lançamentos, Conquistas e Palpites. */
export async function carteiraDoJogador(b: Banco, jogadorId: string, agora: Date): Promise<Carteira> {
  const [extrato, conquistas, palpites] = await Promise.all([
    b.query<{ tipo: TipoDeLancamento; valor: number; descricao: string; em: Date | string }>(
      `SELECT tipo, valor, descricao, visivel_em AS em FROM lancamento_moedas WHERE jogador_id = $1 AND visivel_em <= $2 ORDER BY visivel_em DESC, id DESC LIMIT 40`,
      [jogadorId, agora.toISOString()],
    ),
    b.query<{ codigo: string; temporada: number; pagou: boolean }>(`SELECT codigo, temporada, pagou FROM conquista WHERE jogador_id = $1 AND em <= $2 ORDER BY em`, [jogadorId, agora.toISOString()]),
    // Palpites ainda sem resultado aparecem sem pontos; os pontos só depois do fim do Ao Vivo.
    b.query<{ partida_id: number; mandante: number; visitante: number; pontos: number | null; fim: Date | string; fase: 'LIGA' | 'MATA_MATA' }>(
      `SELECT x.partida_id, x.mandante, x.visitante, x.pontos, p.apito_inicial AS fim, r.fase FROM palpite x JOIN partida p ON p.id = x.partida_id JOIN rodada r ON r.id = p.rodada_id
       WHERE x.jogador_id = $1 ORDER BY p.apito_inicial DESC LIMIT 30`,
      [jogadorId],
    ),
  ]);
  const loja = await lojaDoJogador(b, jogadorId, agora);
  return {
    saldo: await saldo(b, jogadorId, agora),
    ...(loja ? { loja } : {}),
    extrato: extrato.rows.map((l) => ({ tipo: l.tipo, valor: l.valor, descricao: l.descricao || NOME_DO_LANCAMENTO[l.tipo], em: new Date(l.em).toISOString() })),
    conquistas: conquistas.rows,
    palpites: palpites.rows.map((x) => ({
      partidaId: x.partida_id,
      mandante: x.mandante,
      visitante: x.visitante,
      pontos: new Date(x.fim).getTime() + duracaoAoVivoMs(x.fase) <= agora.getTime() ? x.pontos : null,
    })),
  };
}
