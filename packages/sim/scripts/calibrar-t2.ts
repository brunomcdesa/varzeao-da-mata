/**
 * Calibração das regras da Temporada 2 (ADRs 0020, 0021, 0023 e 0024): faltas, pênaltis, gols
 * de bola parada, cartões, Postura e Especializações.
 *
 *   pnpm --filter @liga/sim exec tsx scripts/calibrar-t2.ts
 */
import { ESPECIALIZACOES, type Escalacao, type Especializacao, type Postura } from '@liga/shared';
import { simularPartida } from '../src/partida.js';
import { escalacao } from '../test/fabricas.js';

const N = 8000;
const neutra = { postura: { mandante: 'EQUILIBRADA' as Postura, visitante: 'EQUILIBRADA' as Postura } };

function medir(rotulo: string, a: Escalacao, b: Escalacao, t2: typeof neutra | undefined) {
  let gols = 0, zero = 0, sete = 0, vence = 0, empate = 0, faltas = 0, pen = 0, direta = 0, ensaiada = 0, golBP = 0, amarelo = 0, vermelho = 0, lances = 0;
  for (let seed = 1; seed <= N; seed++) {
    const r = simularPartida({ mandante: a, visitante: b, seed, fase: 'LIGA', ...(t2 ? { t2 } : {}) });
    const g = r.gols.mandante + r.gols.visitante;
    gols += g; if (!g) zero++; if (g >= 7) sete++;
    if (r.vencedor === 'mandante') vence++; if (!r.vencedor) empate++;
    lances += r.ritmo ?? 0;
    for (const l of r.lances) {
      if (l.tipo === 'FALTA') { faltas++; if (l.falta?.cartao === 'AMARELO') amarelo++; if (l.falta?.cartao === 'VERMELHO') vermelho++; }
      if (l.bolaParada === 'PENALTI') pen++;
      if (l.bolaParada === 'FALTA_DIRETA') direta++;
      if (l.bolaParada === 'FALTA_CRUZADA' || l.bolaParada === 'FALTA_CURTA') ensaiada++;
      if (l.tipo === 'GOL' && l.bolaParada && l.bolaParada !== 'LATERAL' && l.bolaParada !== 'ESCANTEIO') golBP++;
    }
  }
  const m = (x: number) => (x / N).toFixed(2);
  const p = (x: number) => ((100 * x) / N).toFixed(1) + '%';
  console.log(`${rotulo.padEnd(34)} gols ${m(gols)} · 0 gols ${p(zero)} · 7+ ${p(sete)} · mandante vence ${p(vence)} · empate ${p(empate)}` +
    (t2 ? ` | faltas ${m(faltas)} · pên ${m(pen)} · direta ${m(direta)} · ensaiada ${m(ensaiada)} · gols de falta ${m(golBP)} · amarelos ${m(amarelo)} · vermelhos ${m(vermelho)}` : ''));
}

const igual = escalacao('CAP', 70), rival = escalacao('ONC', 70, 'R');
medir('T1, 70 × 70', igual, rival, undefined);
medir('T2, 70 × 70', igual, rival, neutra);
medir('T1, 80 × 65', escalacao('CAP', 80), escalacao('ONC', 65, 'R'), undefined);
medir('T2, 80 × 65', escalacao('CAP', 80), escalacao('ONC', 65, 'R'), neutra);
for (const [m, v] of [['OFENSIVA', 'EQUILIBRADA'], ['DEFENSIVA', 'EQUILIBRADA'], ['OFENSIVA', 'OFENSIVA'], ['DEFENSIVA', 'DEFENSIVA'], ['OFENSIVA', 'DEFENSIVA']] as const) {
  medir(`T2, Postura ${m} × ${v}`, igual, rival, { postura: { mandante: m, visitante: v } });
}
// Cada Especialização, no Jogador da Posição dela no mandante: deve mexer pouco no resultado.
const ordem = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'] as const;
for (const [posicao, lista] of Object.entries(ESPECIALIZACOES)) {
  for (const e of lista as readonly Especializacao[]) {
    const a = escalacao('CAP', 70);
    const i = ordem.indexOf(posicao as (typeof ordem)[number]);
    const com: Escalacao = { ...a, jogadores: a.jogadores.map((j, k) => (k === i ? { ...j, especializacao: e } : j)) };
    medir(`T2, ${e}`, com, rival, neutra);
  }
}
