/** Placa do Mata-mata no apito final (ADR-0048): quem foi pra Final, ou o campeão. */
import { FALA_DO_TIME, type PartidaPublica, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';

/** "Onça está na Final!" ou "🏆 Capivara campeão da Temporada 1"; null fora do Mata-mata. */
export function desfechoDoMataMata(p: Pick<PartidaPublica, 'mataMata'>, r: { vencedor?: Lado | null; times: Record<Lado, TimeId> }): string | null {
  const m = p.mataMata;
  if (!m || !r.vencedor) return null;
  const quem = FALA_DO_TIME[r.times[r.vencedor]].curto;
  const serie = m.serie ? ` da Série ${m.serie}` : '';
  return m.etapa === 'SEMIFINAL' ? `${quem} está na Final${serie}!` : `🏆 ${quem} campeão${serie} da Temporada ${m.temporada}`;
}
