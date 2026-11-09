import { duracaoAoVivoMs, type LigaPublica, type SituacaoPartida } from '@liga/shared';

// Regras do calendário que não dependem da página (testáveis fora do navegador).
const fmtChave = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const mesmoDia = (a: string, b: string) => fmtChave.format(new Date(a)) === fmtChave.format(new Date(b));

/** Situação calculada pelo relógio de quem está vendo (o JSON pode ter até 1 h). */
export function situacaoAgora(p: { apito: string; fase: 'LIGA' | 'MATA_MATA' }, agora = Date.now()): SituacaoPartida {
  const t = Date.parse(p.apito);
  if (agora < t) return 'AGENDADA';
  return agora < t + duracaoAoVivoMs(p.fase) ? 'AO_VIVO' : 'ENCERRADA';
}

/** Rodada "da vez": a que tem Partida ao vivo ou a próxima a jogar; senão a última. */
export function rodadaAtual(l: LigaPublica, agora = Date.now()): number | null {
  const viva = l.calendario.find((p) => situacaoAgora(p, agora) === 'AO_VIVO');
  if (viva) return viva.rodada;
  const proxima = l.calendario.find((p) => situacaoAgora(p, agora) === 'AGENDADA');
  if (proxima) {
    // A Rodada que terminou hoje ainda é a "da vez" até o Resumo dela sair no Instagram
    // (ou até a meia-noite, se o Resumo atrasar); depois, a próxima.
    const anterior = l.calendario.filter((p) => p.rodada === proxima.rodada - 1).at(-1);
    const resumoSaiu = l.rodadas.find((r) => r.numero === anterior?.rodada)?.resumoPublicado === true;
    if (anterior && !resumoSaiu && mesmoDia(anterior.apito, new Date(agora).toISOString())) return anterior.rodada;
    return proxima.rodada;
  }
  return l.calendario.at(-1)?.rodada ?? null;
}

