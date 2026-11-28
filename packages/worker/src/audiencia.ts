/**
 * Audiência do Ao Vivo (ADR-0118): a sala deixa um resumo no KV `audiencia/<partida>` no fim
 * do jogo; a coleta leva para o banco e apaga a chave. Reprocessar não duplica.
 */
import type { Banco } from './banco.js';
import type { Agenda } from './nuvem.js';

export const PREFIXO_AUDIENCIA = 'audiencia/';

interface ResumoNoKv {
  partidaId: string;
  pico: number;
  entradas: number;
  media: number;
  primeiraConexao: number;
  fim: number;
}

const inteiro = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Resumo válido: ids numéricos e números plausíveis. O que vier estranho é descartado. */
export function resumoValido(r: ResumoNoKv | null): r is ResumoNoKv {
  return !!r && /^\d+$/.test(String(r.partidaId)) && inteiro(r.pico) && inteiro(r.entradas) && typeof r.media === 'number' && r.media >= 0 && r.media <= r.pico && Number.isFinite(r.primeiraConexao) && Number.isFinite(r.fim);
}

/** Leva os resumos do KV para o banco. Devolve quantos entraram. */
export async function coletarAudiencia(banco: Banco, agenda: Agenda): Promise<number> {
  let n = 0;
  for (const chave of await agenda.listar(PREFIXO_AUDIENCIA)) {
    const r = await agenda.ler<ResumoNoKv>(chave);
    if (resumoValido(r)) {
      const entrou = await banco.query(
        `INSERT INTO audiencia_ao_vivo (partida_id, pico, entradas, media, primeira_conexao, fim)
         VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0))
         ON CONFLICT (partida_id) DO NOTHING RETURNING partida_id`,
        [Number(r.partidaId), r.pico, r.entradas, r.media, r.primeiraConexao, r.fim],
      );
      n += entrou.rows.length;
    }
    await agenda.apagar(chave);
  }
  return n;
}
