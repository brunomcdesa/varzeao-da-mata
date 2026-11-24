import { describe, expect, it } from 'vitest';
import { DURACAO_DO_STORY, TAXA, trilha, trilhaDoStory } from '../src/audio.js';

describe('Stories dos destaques com a trilha dos Reels (ADR-0110)', () => {
  it('15 s: duas voltas inteiras do tema de 7,5 s (4 compassos a 128 BPM)', () => {
    expect(DURACAO_DO_STORY).toBe(2 * ((4 * 4 * 60) / 128));
    expect(trilhaDoStory().esq).toHaveLength(DURACAO_DO_STORY * TAXA);
  });

  it('é o tema das cartelas dos Reels, a 60%, com entrada e saída suaves', () => {
    const s = trilhaDoStory();
    const tema = trilha(DURACAO_DO_STORY, () => 1);
    const meio = 5 * TAXA;
    for (let i = meio; i < meio + 1000; i++) expect(s.esq[i]).toBeCloseTo(tema.esq[i]! * 0.6, 6);
    expect(Math.abs(s.esq[0]!)).toBe(0);
    expect(Math.abs(s.esq[s.esq.length - 1]!)).toBeLessThan(1e-3);
  });
});
