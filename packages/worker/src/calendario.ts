/**
 * Calendário da Temporada (GLOSSARY: Fase de Liga, Rodada, Apito Inicial).
 * Turno único entre os 8 Times em 7 Rodadas, uma por dia, com Partidas às 12h, 14h, 16h e 18h.
 * O Mata-mata é criado depois, quando a Fase de Liga termina.
 */
import { TIMES, type TimeId } from '@liga/shared';
import { criarRng } from '@liga/sim';
import type { Banco } from './banco.js';

export const HORARIOS = [12, 14, 16, 18] as const;
/** Brasília é UTC−3, sem horário de verão. */
export const FUSO_BRASILIA = -3;

export interface Confronto {
  mandante: TimeId;
  visitante: TimeId;
}

/**
 * Turno único pelo método do círculo: em cada Rodada todo Time joga uma vez, cada par se
 * enfrenta uma única vez e os mandos ficam equilibrados (3 ou 4 em casa). A ordem dos Times
 * e dos horários é sorteada pelo seed, então os Clássicos caem em qualquer Rodada.
 */
export function faseDeLiga(seed: number): Confronto[][] {
  // A escolha gulosa dos mandos falha em raros sorteios; aí tenta uma variação do seed.
  for (let tentativa = 0; ; tentativa++) {
    const rodadas = gerarTurno((seed + tentativa * 7919) >>> 0);
    const emCasa = new Map<TimeId, number>();
    for (const jogos of rodadas) for (const j of jogos) emCasa.set(j.mandante, (emCasa.get(j.mandante) ?? 0) + 1);
    if (emCasa.size === TIMES.length && [...emCasa.values()].every((n) => n === 3 || n === 4)) return rodadas;
  }
}

function gerarTurno(seed: number): Confronto[][] {
  const rng = criarRng(seed);
  const times = [...TIMES];
  for (let i = times.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [times[i], times[j]] = [times[j]!, times[i]!];
  }
  const n = times.length;
  const rodadas: Confronto[][] = [];
  const emCasa = new Map<TimeId, number>(times.map((t) => [t, 0]));
  const ultimoEmCasa = new Map<TimeId, boolean>();
  let roda = times.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const atual = [times[0]!, ...roda];
    const jogos: Confronto[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = atual[i]!;
      const b = atual[n - 1 - i]!;
      // Manda quem tem menos jogos em casa; empate: quem jogou fora na Rodada anterior.
      const ca = emCasa.get(a)!;
      const cb = emCasa.get(b)!;
      const aEmCasa = ca !== cb ? ca < cb : ultimoEmCasa.get(a) === ultimoEmCasa.get(b) ? rng.next() < 0.5 : !ultimoEmCasa.get(a);
      const [m, v] = aEmCasa ? [a, b] : [b, a];
      emCasa.set(m, emCasa.get(m)! + 1);
      ultimoEmCasa.set(m, true);
      ultimoEmCasa.set(v, false);
      jogos.push({ mandante: m, visitante: v });
    }
    // Ordem dos horários sorteada.
    for (let i = jogos.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [jogos[i], jogos[j]] = [jogos[j]!, jogos[i]!];
    }
    rodadas.push(jogos);
    roda = [roda[roda.length - 1]!, ...roda.slice(0, -1)];
  }
  return rodadas;
}

/** Apito Inicial em UTC para um dia (AAAA-MM-DD) e uma hora de Brasília. */
export function apitoInicial(dia: string, horaBrasilia: number): Date {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d, horaBrasilia - FUSO_BRASILIA));
}

export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Cria a Temporada com as 7 Rodadas da Fase de Liga a partir de `primeiraRodada`. */
export async function criarTemporada(banco: Banco, o: { numero: number; primeiraRodada: string; seed: number }): Promise<number> {
  return banco.transacao(async (b) => {
    const temporadaId = (
      await b.query<{ id: number }>(`INSERT INTO temporada (numero, inicio) VALUES ($1, $2) RETURNING id`, [o.numero, o.primeiraRodada])
    ).rows[0]!.id;
    for (const [r, jogos] of faseDeLiga(o.seed).entries()) {
      const dia = somarDias(o.primeiraRodada, r);
      const rodadaId = (
        await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'LIGA', $3) RETURNING id`, [temporadaId, r + 1, dia])
      ).rows[0]!.id;
      for (const [k, j] of jogos.entries()) {
        await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial) VALUES ($1, $2, $3, $4)`, [
          rodadaId,
          j.mandante,
          j.visitante,
          apitoInicial(dia, HORARIOS[k]!).toISOString(),
        ]);
      }
    }
    return temporadaId;
  });
}
