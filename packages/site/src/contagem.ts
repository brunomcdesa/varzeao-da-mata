/** Contagem até o Apito: "em 1h 12min", "em 8 min", "amanhã", "em 2 dias", "agora". */

const FUSO = 'America/Sao_Paulo';
const fmtChave = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

export function contagem(iso: string, agora = Date.now()): string {
  const ms = Date.parse(iso) - agora;
  if (ms <= 0) return 'agora';
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `em ${h}h${min % 60 ? ` ${min % 60}min` : ''}`;
  // Dias de calendário em Brasília, e não horas arredondadas: terça 23h39 para quinta 11h são
  // 35h, mas é daqui a 2 dias, não "amanhã".
  const chave = (t: number) => Date.parse(`${fmtChave.format(new Date(t))}T00:00:00Z`);
  const d = Math.round((chave(Date.parse(iso)) - chave(agora)) / 86_400_000);
  return d <= 1 ? 'amanhã' : `em ${d} dias`;
}
