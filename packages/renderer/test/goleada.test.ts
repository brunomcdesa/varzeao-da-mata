import { describe, expect, it } from 'vitest';
import { ehGoleada, habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { montarNarracao } from '../src/narracao.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) })),
});
const e = { mandante: esc('ARA', 72), visitante: esc('ONC', 68) };
const jogo = (seed: number) => {
  const resultado = simularPartida({ ...e, seed, fase: 'LIGA' });
  return { resultado, falas: montarNarracao(new Roteiro(new Timeline(resultado, e))) };
};
const falaDeGoleada = (texto: string) => /goleada|chocolate|passeio/i.test(texto);

describe('Goleada', () => {
  it('é o vencedor com 4 gols ou mais e 3 ou mais de vantagem', () => {
    expect(ehGoleada(4, 0)).toBe(true);
    expect(ehGoleada(4, 1)).toBe(true);
    expect(ehGoleada(5, 2)).toBe(true);
    expect(ehGoleada(5, 1)).toBe(true);
    expect(ehGoleada(4, 2)).toBe(false);
    expect(ehGoleada(4, 3)).toBe(false);
    expect(ehGoleada(3, 0)).toBe(false);
  });

  it('o narrador comemora uma vez no gol da Goleada e de novo no fim; sem Goleada, nem fala nisso', () => {
    let goleadas = 0;
    let normais = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const { resultado: r, falas } = jogo(seed);
      const v = r.gols.mandante >= r.gols.visitante ? 'mandante' : 'visitante';
      const p = v === 'mandante' ? 'visitante' : 'mandante';
      const noFim = falas.find((f) => f.id === 'fim')!.texto;
      const noJogo = falas.filter((f) => f.id !== 'fim' && falaDeGoleada(f.texto));
      if (ehGoleada(r.gols[v], r.gols[p])) {
        goleadas++;
        expect(noJogo).toHaveLength(1);
        expect(noJogo[0]!.id).toMatch(/^lance-\d+-c$/);
        expect(falaDeGoleada(noFim)).toBe(true);
        expect(noFim).not.toContain('Vitória');
      } else {
        normais++;
        expect(falaDeGoleada(noFim)).toBe(false);
        // O jogo pode ter passado por uma Goleada e o rival diminuído (4×1 → 4×3): aí só a fala do gol, uma vez.
        expect(noJogo.length).toBeLessThanOrEqual(1);
      }
    }
    expect(goleadas).toBeGreaterThan(5);
    expect(normais).toBeGreaterThan(100);
  });

  it('com apelido, o gol da Goleada fala o nome', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { resultado: r } = jogo(seed);
      const v = r.gols.mandante >= r.gols.visitante ? 'mandante' : 'visitante';
      const p = v === 'mandante' ? 'visitante' : 'mandante';
      if (!ehGoleada(r.gols[v], r.gols[p])) continue;
      const apelidos = { mandante: Array(7).fill('Bruninho'), visitante: Array(7).fill('Bruninho') };
      const falas = montarNarracao(new Roteiro(new Timeline(r, e)), apelidos);
      const gol = falas.find((f) => /^lance-\d+-c$/.test(f.id) && /goleada/i.test(f.texto))!;
      expect(gol.texto).toContain('Bruninho');
      return;
    }
    throw new Error('nenhuma Goleada nas seeds testadas');
  });
});
