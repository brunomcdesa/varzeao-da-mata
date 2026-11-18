/**
 * Selo de Presença no painel do dono (ADR-0023): depois de confirmar, pelo site ou com
 * CONFIRMO, o botão dá lugar a "Presença confirmada" com o dia, a hora e o adversário.
 */
import { FALA_DO_TIME, type TimeId } from '@liga/shared';

const FUSO = 'America/Sao_Paulo';
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long' });
const fmtChave = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

const DIA_MS = 86_400_000;

/** "hoje às 15h", "amanhã às 11h", "sexta às 18h30" (horário de Brasília). */
export function quandoDoJogo(apito: string, agora = new Date()): string {
  const a = new Date(apito);
  const h = fmtHora.format(a).replace(':00', 'h').replace(':', 'h');
  const dia = fmtChave.format(a);
  if (dia === fmtChave.format(agora)) return `hoje às ${h}`;
  if (dia === fmtChave.format(new Date(agora.getTime() + DIA_MS))) return `amanhã às ${h}`;
  return `${fmtSemana.format(a).replace('-feira', '')} às ${h}`;
}

/** "contra o Jacaré", "contra a Onça". */
export function contraO(t: TimeId): string {
  const f = FALA_DO_TIME[t];
  return `contra ${f.artigo} ${f.curto}`;
}

/** A linha embaixo do selo: "Quinta às 15h, contra o Jacaré. Você entra antes no rodízio, logo depois do Craque." */
export function linhaDaPresenca(jogo: { apito: string; adversario: TimeId } | null | undefined, agora = new Date()): string {
  const fim = 'Você entra antes no rodízio, logo depois do Craque.';
  if (!jogo) return fim;
  const q = quandoDoJogo(jogo.apito, agora);
  return `${q[0]!.toUpperCase()}${q.slice(1)}, ${contraO(jogo.adversario)}. ${fim}`;
}
