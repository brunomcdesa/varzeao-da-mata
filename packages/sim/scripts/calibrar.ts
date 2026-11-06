/**
 * Calibração da sim: roda milhares de Partidas e imprime as métricas que importam.
 * Uso: pnpm calibrar
 */
import { POSICOES, type Posicao } from '@liga/shared';
import { contribuicao } from '../src/nota.js';
import { simularPartida } from '../src/partida.js';
import { criarRng } from '../src/rng.js';
import { escalacao } from '../test/fabricas.js';

const N = 20_000;

function taxaVitoria(ovrForte: number, ovrFraco: number): { vitorias: number; empates: number; mediaGols: number } {
  let vitorias = 0;
  let empates = 0;
  let gols = 0;
  for (let seed = 1; seed <= N; seed++) {
    const forteEmCasa = seed % 2 === 0;
    const forte = escalacao('CAP', ovrForte);
    const fraco = escalacao('TAT', ovrFraco);
    const r = simularPartida({
      mandante: forteEmCasa ? forte : fraco,
      visitante: forteEmCasa ? fraco : forte,
      seed,
      fase: 'LIGA',
    });
    const ladoForte = forteEmCasa ? 'mandante' : 'visitante';
    if (r.vencedor === ladoForte) vitorias++;
    if (r.vencedor === null) empates++;
    gols += r.gols.mandante + r.gols.visitante;
  }
  return { vitorias: vitorias / N, empates: empates / N, mediaGols: gols / N };
}

console.log('== Força x resultado (Fase de Liga) ==');
for (const [forte, fraco] of [[70, 70], [75, 65], [80, 65], [85, 60]] as const) {
  const t = taxaVitoria(forte, fraco);
  console.log(
    `OVR ${forte} x ${fraco}: forte vence ${(t.vitorias * 100).toFixed(1)}%, empate ${(t.empates * 100).toFixed(1)}%, gols/jogo ${t.mediaGols.toFixed(2)}`,
  );
}

// Contribuição média por Posição e OVR, em Partidas com OVRs aleatórios (40–95).
console.log('\n== Contribuição média por OVR (base das retas de EXPECTATIVA) ==');
const amostras: Record<Posicao, { x: number; y: number }[]> = { GOL: [], ZAG: [], MEI: [], ATA: [] };
const sorteio = criarRng(42);
const ovrAleatorio = () => 40 + sorteio.int(56);
for (let seed = 1; seed <= N; seed++) {
  const r = simularPartida({
    mandante: escalacao('CAP', Array.from({ length: 7 }, ovrAleatorio)),
    visitante: escalacao('TAT', Array.from({ length: 7 }, ovrAleatorio)),
    seed,
    fase: 'LIGA',
  });
  for (const d of r.desempenhos) {
    const resultado = r.vencedor === null ? 'empate' : r.vencedor === d.slot.lado ? 'vitoria' : 'derrota';
    amostras[d.posicao].push({ x: d.ovrAntes - 65, y: contribuicao({ ...d, resultado }) });
  }
}
for (const posicao of POSICOES) {
  const pts = amostras[posicao];
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const inclinacao =
    pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const intercepto = my - inclinacao * mx;
  console.log(`${posicao}: { intercepto: ${intercepto.toFixed(3)}, inclinacao: ${inclinacao.toFixed(4)} }`);
}

// Bola de neve: variação média de OVR por faixa, com as retas atuais.
console.log('\n== Variação média de OVR por faixa (deve ficar perto de 0) ==');
const faixas = new Map<number, { soma: number; n: number }>();
for (let seed = 1; seed <= N; seed++) {
  const r = simularPartida({
    mandante: escalacao('CAP', Array.from({ length: 7 }, ovrAleatorio)),
    visitante: escalacao('TAT', Array.from({ length: 7 }, ovrAleatorio)),
    seed: seed + 1_000_000,
    fase: 'LIGA',
  });
  for (const d of r.desempenhos) {
    const faixa = Math.floor(d.ovrAntes / 10) * 10;
    const f = faixas.get(faixa) ?? { soma: 0, n: 0 };
    f.soma += d.deltaOvr;
    f.n++;
    faixas.set(faixa, f);
  }
}
for (const [faixa, f] of [...faixas].sort((a, b) => a[0] - b[0])) {
  console.log(`OVR ${faixa}–${faixa + 9}: ${(f.soma / f.n).toFixed(2)} por Partida`);
}
