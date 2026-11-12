/** Calibração da Formação (ADR-0044): cada Formação contra o 2-2-2 e entre si, Times iguais. */
import { FORMACOES, type Formacao } from '@liga/shared';
import { simularPartida } from '../src/partida.js';
import { escalacaoNa } from '../test/fabricas.js';

const N = Number(process.env.N ?? 6000);
const postura = { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } as const;

export function confronto(a: Formacao, b: Formacao, n = N) {
  let v = 0, e = 0, d = 0, golsA = 0, golsB = 0;
  const jogadas: Record<string, number> = {};
  for (let seed = 1; seed <= n; seed++) {
    const emCasa = seed % 2 === 0;
    const ladoA = emCasa ? 'mandante' : 'visitante';
    const r = simularPartida({
      fase: 'LIGA', seed,
      mandante: emCasa ? escalacaoNa(a, 'CAP', 70) : escalacaoNa(b, 'TAT', 70),
      visitante: emCasa ? escalacaoNa(b, 'TAT', 70) : escalacaoNa(a, 'CAP', 70),
      t2: { postura, formacao: emCasa ? { mandante: a, visitante: b } : { mandante: b, visitante: a } },
    });
    const ga = r.gols[ladoA], gb = r.gols[ladoA === 'mandante' ? 'visitante' : 'mandante'];
    golsA += ga; golsB += gb;
    if (ga > gb) v++; else if (ga === gb) e++; else d++;
    for (const l of r.lances) if (l.jogadaDaFormacao) jogadas[l.jogadaDaFormacao] = (jogadas[l.jogadaDaFormacao] ?? 0) + 1;
  }
  return { v: v / n, e: e / n, d: d / n, golsA: golsA / n, golsB: golsB / n, jogadas: Object.fromEntries(Object.entries(jogadas).map(([k, x]) => [k, +(x / n).toFixed(2)])) };
}

if (process.argv[1]?.endsWith('formacoes.ts')) {
  for (const a of FORMACOES) for (const b of FORMACOES) {
    if (b < a) continue;
    const r = confronto(a, b);
    console.log(`${a} x ${b}: V ${(r.v * 100).toFixed(1)} E ${(r.e * 100).toFixed(1)} D ${(r.d * 100).toFixed(1)} | gols ${r.golsA.toFixed(2)} x ${r.golsB.toFixed(2)} = ${(r.golsA + r.golsB).toFixed(2)} | ${JSON.stringify(r.jogadas)}`);
  }
}
