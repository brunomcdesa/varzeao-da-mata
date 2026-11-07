/**
 * Calibração da sim: roda milhares de Partidas e imprime as métricas que importam.
 * Uso: pnpm calibrar [N]
 */
import { HABILIDADES, POSICOES, type Escalacao, type Posicao } from '@liga/shared';
import { contribuicao } from '../src/nota.js';
import { simularPartida } from '../src/partida.js';
import { criarRng } from '../src/rng.js';
import { escalacao, FORMACAO_ORDEM, jogador } from '../test/fabricas.js';

const N = Number(process.argv[2] ?? 20_000);

function taxaVitoria(ovrForte: number, ovrFraco: number) {
  let vitorias = 0, empates = 0, gols = 0;
  const tipos: Record<string, number> = {};
  for (let seed = 1; seed <= N; seed++) {
    const forteEmCasa = seed % 2 === 0;
    const forte = escalacao('CAP', ovrForte);
    const fraco = escalacao('TAT', ovrFraco);
    const r = simularPartida({ mandante: forteEmCasa ? forte : fraco, visitante: forteEmCasa ? fraco : forte, seed, fase: 'LIGA' });
    const ladoForte = forteEmCasa ? 'mandante' : 'visitante';
    if (r.vencedor === ladoForte) vitorias++;
    if (r.vencedor === null) empates++;
    gols += r.gols.mandante + r.gols.visitante;
    for (const l of r.lances) tipos[l.tipo + (l.tipo === 'DESARME' && l.drible ? '_DRIBLE' : '')] = (tipos[l.tipo + (l.tipo === 'DESARME' && l.drible ? '_DRIBLE' : '')] ?? 0) + 1;
  }
  return { vitorias: vitorias / N, empates: empates / N, mediaGols: gols / N, tipos };
}

console.log('== Força x resultado (Fase de Liga) ==');
for (const [forte, fraco] of [[70, 70], [75, 65], [80, 65], [85, 60]] as const) {
  const t = taxaVitoria(forte, fraco);
  console.log(`OVR ${forte} x ${fraco}: forte vence ${(t.vitorias * 100).toFixed(1)}%, empate ${(t.empates * 100).toFixed(1)}%, gols/jogo ${t.mediaGols.toFixed(2)}`);
  if (forte === 70) console.log('   lances/jogo:', Object.entries(t.tipos).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(', '));
}

console.log('\n== Variação média por Habilidade, times iguais (OVR 60, 65, 70) ==');
for (const ovr of [60, 65, 70]) {
  const soma: Record<string, number> = {};
  for (let seed = 1; seed <= N / 4; seed++) {
    const r = simularPartida({ mandante: escalacao('CAP', ovr), visitante: escalacao('TAT', ovr), seed, fase: 'LIGA' });
    for (const d of r.desempenhos) for (const h of HABILIDADES) if (d.deltaHabilidades[h]) soma[`${d.posicao} ${h}`] = (soma[`${d.posicao} ${h}`] ?? 0) + d.deltaHabilidades[h];
  }
  const div = (k: string) => (N / 4) * (k.startsWith('GOL') ? 2 : 4);
  console.log(`OVR ${ovr}: ` + Object.entries(soma).sort().map(([k, v]) => `${k} ${(v / div(k)).toFixed(3)}`).join(' · '));
}

const sorteio = criarRng(42);
const ovrAleatorio = () => 40 + sorteio.int(56);
const ruido = () => Object.fromEntries(HABILIDADES.map((h) => [h, sorteio.next() * 2 - 1]));
const escalacaoAleatoria = (time: 'CAP' | 'TAT'): Escalacao => ({
  time,
  jogadores: FORMACAO_ORDEM.map((p, i) => jogador(`${time}-${i}`, p, ovrAleatorio(), ruido())),
});

console.log('\n== Contribuição média por OVR (base das retas de EXPECTATIVA) ==');
const amostras: Record<Posicao, { x: number; y: number }[]> = { GOL: [], ZAG: [], MEI: [], ATA: [] };
for (let seed = 1; seed <= N; seed++) {
  const r = simularPartida({ mandante: escalacaoAleatoria('CAP'), visitante: escalacaoAleatoria('TAT'), seed, fase: 'LIGA' });
  for (const d of r.desempenhos) {
    const resultado = r.vencedor === null ? 'empate' : r.vencedor === d.slot.lado ? 'vitoria' : 'derrota';
    amostras[d.posicao].push({ x: d.ovrAntes - 65, y: contribuicao({ ...d, resultado }) });
  }
}
for (const posicao of POSICOES) {
  const pts = amostras[posicao];
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const inclinacao = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  console.log(`${posicao}: { intercepto: ${(my - inclinacao * mx).toFixed(3)}, inclinacao: ${inclinacao.toFixed(4)} }`);
}

// Bola de neve: variação média de OVR exato por faixa e Posição, em Partidas aleatórias.
console.log('\n== Variação média de OVR por faixa e Posição (deve ficar perto de 0) ==');
const faixas = new Map<string, { soma: number; n: number }>();
const porHab = new Map<string, { soma: number; n: number }>();
for (let seed = 1; seed <= N; seed++) {
  const r = simularPartida({ mandante: escalacaoAleatoria('CAP'), visitante: escalacaoAleatoria('TAT'), seed: seed + 1_000_000, fase: 'LIGA' });
  for (const d of r.desempenhos) {
    const chave = `${d.posicao} ${Math.floor(d.ovrAntes / 10) * 10}`;
    const f = faixas.get(chave) ?? { soma: 0, n: 0 };
    f.soma += d.deltaOvr;
    f.n++;
    faixas.set(chave, f);
    for (const h of HABILIDADES) {
      const k = `${d.posicao} ${h}`;
      const g = porHab.get(k) ?? { soma: 0, n: 0 };
      g.soma += d.deltaHabilidades[h];
      g.n++;
      porHab.set(k, g);
    }
  }
}
for (const p of POSICOES) {
  const linhas = [...faixas].filter(([k]) => k.startsWith(p)).sort();
  console.log(`${p}: ` + linhas.map(([k, f]) => `${k.split(' ')[1]}s ${(f.soma / f.n).toFixed(2)}`).join(' · '));
  console.log('    por Habilidade: ' + HABILIDADES.map((h) => `${h} ${(porHab.get(`${p} ${h}`)!.soma / porHab.get(`${p} ${h}`)!.n).toFixed(3)}`).join(' '));
}
