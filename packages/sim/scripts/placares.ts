/**
 * Distribuição dos placares (ADR-0022): quantos jogos saem 0 a 0, quantas goleadas, o maior
 * placar e a Nota média por Ritmo, em milhares de Partidas por confronto.
 *
 *   pnpm --filter @liga/sim exec tsx scripts/placares.ts   (ADR-0016)
 */
import { ritmoDaPartida, simularPartida } from '../src/partida.js';
import { escalacao } from '../test/fabricas.js';

const N = 20000;
for (const [a, b] of [[70, 70], [80, 65], [85, 60]] as const) {
  const total = new Map<number, number>();
  let soma = 0, dif5 = 0, max = 0, maxPlacar = '', forteVence = 0;
  for (let seed = 1; seed <= N; seed++) {
    const r = simularPartida({ mandante: escalacao('CAP', a), visitante: escalacao('ONC', b), seed, fase: 'LIGA' });
    const g = r.gols.mandante + r.gols.visitante;
    soma += g;
    total.set(g, (total.get(g) ?? 0) + 1);
    if (Math.abs(r.gols.mandante - r.gols.visitante) >= 5) dif5++;
    if (r.gols.mandante > r.gols.visitante) forteVence++;
    if (g > max) (max = g), (maxPlacar = `${r.gols.mandante}x${r.gols.visitante}`);
  }
  const pct = (f: (k: number) => boolean) => ((100 * [...total].filter(([k]) => f(k)).reduce((s, [, v]) => s + v, 0)) / N).toFixed(1);
  console.log(
    `OVR ${a}x${b}: média ${(soma / N).toFixed(2)} · 0 gols ${pct((k) => k === 0)}% · até 1 ${pct((k) => k <= 1)}% · 7+ ${pct((k) => k >= 7)}% · diferença 5+ ${((100 * dif5) / N).toFixed(1)}% · ${a > b ? `forte vence ${((100 * forteVence) / N).toFixed(1)}% · ` : ''}maior ${maxPlacar}`,
  );
}

// Nota média por faixa de Ritmo, entre Times iguais: deve ficar parecida em todas.
const porRitmo = new Map<string, { soma: number; n: number }>();
for (let seed = 1; seed <= N; seed++) {
  const r = simularPartida({ mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70), seed, fase: 'LIGA' });
  const ritmo = ritmoDaPartida(seed);
  const faixa = ritmo <= 15 ? 'travado (até 15 lances)' : ritmo <= 24 ? 'normal (16-24)' : 'aberto (25+)';
  const x = porRitmo.get(faixa) ?? { soma: 0, n: 0 };
  for (const d of r.desempenhos) (x.soma += d.nota), x.n++;
  porRitmo.set(faixa, x);
}
console.log('Nota média por Ritmo:', [...porRitmo].map(([f, x]) => `${f} ${(x.soma / x.n).toFixed(2)}`).join(' · '));
