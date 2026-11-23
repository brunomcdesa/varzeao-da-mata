/** Placa do Mata-mata no apito final (ADR-0048): quem foi pra Final, ou o campeão. */
import { FALA_DO_TIME, etapaDa, type LigaPublica, type PartidaPublica, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';

/** "Onça está na Final!" ou "🏆 Capivara campeão da Temporada 1"; null fora do Mata-mata. */
export function desfechoDoMataMata(p: Pick<PartidaPublica, 'mataMata'>, r: { vencedor?: Lado | null; times: Record<Lado, TimeId> }): string | null {
  const m = p.mataMata;
  if (!m || !r.vencedor) return null;
  const quem = FALA_DO_TIME[r.times[r.vencedor]].curto;
  const serie = m.serie ? ` da Série ${m.serie}` : '';
  if (m.copa) return m.copa === 'FINAL' ? `🏆 ${quem} campeão da Copa da Temporada ${m.temporada}` : m.copa === 'SEMIFINAL' ? `${quem} está na Final da Copa!` : `${quem} avança na Copa!`;
  return m.etapa === 'SEMIFINAL' ? `${quem} está na Final${serie}!` : `🏆 ${quem} campeão${serie} da Temporada ${m.temporada}`;
}

/** A Temporada está no Mata-mata (ADR-0057): já começou e falta a Final de alguma Série. */
export function noMataMata(l: Pick<LigaPublica, 'calendario'>): boolean {
  const mm = l.calendario.filter((p) => p.fase === 'MATA_MATA' && !p.copa);
  if (!mm.length) return false;
  const serie = (p: (typeof mm)[number]) => p.serie ?? 'A';
  return [...new Set(mm.map(serie))].some((s) => !mm.some((p) => serie(p) === s && etapaDa(p.fase, p.rodada) === 'FINAL' && p.situacao === 'ENCERRADA'));
}
