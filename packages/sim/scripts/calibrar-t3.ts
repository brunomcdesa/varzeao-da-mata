/**
 * Calibração das novidades de campo da Temporada 3 (ADR-0094): a média de gols e de Goleadas
 * deve ficar perto da T2. Mostra também quantas vezes cada novidade aparece por Partida.
 *
 *   pnpm --filter @liga/sim exec tsx scripts/calibrar-t3.ts
 */
import type { Escalacao, PerfilDoJuiz, Postura } from '@liga/shared';
import { simularPartida } from '../src/partida.js';
import type { Fase } from '../src/tipos.js';
import { escalacao } from '../test/fabricas.js';

const N = 6000;
const postura = (m: Postura = 'EQUILIBRADA', v: Postura = 'EQUILIBRADA') => ({ postura: { mandante: m, visitante: v } });

function medir(rotulo: string, a: Escalacao, b: Escalacao, o: { t3?: PerfilDoJuiz; fase?: Fase; m?: Postura; v?: Postura } = {}) {
  let gols = 0, goleadas = 0, empates = 0, faltas = 0, cartoes = 0, traves = 0, rebotes = 0, golsRebote = 0, longe = 0, golsLonge = 0, placa = 0, pressao = 0, golsPressao = 0, acr = 0, golsAcr = 0, viradas = 0;
  for (let seed = 1; seed <= N; seed++) {
    const r = simularPartida({ mandante: a, visitante: b, seed, fase: o.fase ?? 'LIGA', t2: postura(o.m, o.v), ...(o.t3 ? { t3: { juiz: o.t3 } } : {}) });
    const gm = r.gols.mandante, gv = r.gols.visitante;
    gols += gm + gv;
    if (Math.max(gm, gv) >= 4 && Math.abs(gm - gv) >= 3) goleadas++;
    if (gm === gv) empates++;
    let placar = { mandante: 0, visitante: 0 };
    let perdiaAos75: string | null = null;
    for (const l of r.lances) {
      if (l.minuto > 75 && perdiaAos75 === null) perdiaAos75 = placar.mandante < placar.visitante ? 'mandante' : placar.visitante < placar.mandante ? 'visitante' : '';
      if (l.tipo === 'FALTA') { faltas++; if (l.falta?.cartao) cartoes++; }
      if (l.trave) traves++;
      if (l.rebote) { rebotes++; if (l.tipo === 'GOL') golsRebote++; }
      if (l.chuteDeLonge) { longe++; if (l.tipo === 'GOL') golsLonge++; }
      if (l.golDePlaca) placa++;
      if (l.pressao) { pressao++; if (l.tipo === 'GOL') golsPressao++; }
      if (l.acrescimo) { acr++; if (l.tipo === 'GOL') golsAcr++; }
      if (l.tipo === 'GOL') placar = { ...placar, [l.ataque]: placar[l.ataque] + 1 };
    }
    if (perdiaAos75 && r.vencedor === perdiaAos75) viradas++;
  }
  const m = (x: number) => (x / N).toFixed(2);
  const p = (x: number) => ((100 * x) / N).toFixed(1) + '%';
  console.log(
    `${rotulo.padEnd(30)} gols ${m(gols)} · goleadas ${p(goleadas)} · empates ${p(empates)} · viradas pós-75' ${p(viradas)} · faltas ${m(faltas)} · cartões ${m(cartoes)}` +
      (o.t3 ? ` | trave ${m(traves)} · rebote ${m(rebotes)} (gols ${m(golsRebote)}) · longe ${m(longe)} (gols ${m(golsLonge)}) · placa ${m(placa)} · pressão ${m(pressao)} (gols ${m(golsPressao)}) · acréscimos ${m(acr)} (gols ${m(golsAcr)})` : ''),
  );
}

for (const [rot, a, b] of [
  ['70 × 70', escalacao('CAP', 70), escalacao('ONC', 70, 'R')],
  ['80 × 65', escalacao('CAP', 80), escalacao('ONC', 65, 'R')],
] as const) {
  medir(`T2, ${rot}`, a, b);
  medir(`T3, ${rot}`, a, b, { t3: 'NORMAL' });
}
const igual = escalacao('CAP', 70), rival = escalacao('ONC', 70, 'R');
medir('T3, Juiz Rigoroso', igual, rival, { t3: 'RIGOROSO' });
medir('T3, Juiz Deixa jogar', igual, rival, { t3: 'DEIXA_JOGAR' });
medir('T3, Ofensiva × Ofensiva', igual, rival, { t3: 'NORMAL', m: 'OFENSIVA', v: 'OFENSIVA' });
medir('T2, Mata-mata', igual, rival, { fase: 'MATA_MATA' });
medir('T3, Mata-mata', igual, rival, { t3: 'NORMAL', fase: 'MATA_MATA' });
