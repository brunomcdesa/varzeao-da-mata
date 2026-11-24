import { describe, expect, it } from 'vitest';
import { GRUPOS_DA_A_DE_16, TIMES_FUNDADORES, TIMES_NOVOS, ehClassico } from '@liga/shared';
import { DESTAQUES, POSICOES_NO_DESTAQUE, classicosDoGrupo, pastaDoDestaque } from '../src/destaquesDoPerfil.js';

describe('Destaques do perfil (ADR-0108)', () => {
  it('seis destaques, na ordem do perfil, e nenhum Story repetido', () => {
    expect(DESTAQUES.map((d) => d.nome)).toEqual(['Como entrar', 'Como funciona', 'Site e App', 'Times', 'Perfis dos Times', 'Campeões']);
    const stories = DESTAQUES.flatMap((d) => d.stories);
    expect(new Set(stories).size).toBe(stories.length);
  });

  it('as quatro Posições, na ordem do campo', () => {
    expect(POSICOES_NO_DESTAQUE.map((p) => p.posicao)).toEqual(['GOL', 'ZAG', 'MEI', 'ATA']);
  });

  it('os dois Grupos somam os 16 Times da Série A', () => {
    expect([...GRUPOS_DA_A_DE_16.CHAO, ...GRUPOS_DA_A_DE_16.COPA].sort()).toEqual([...TIMES_FUNDADORES, ...TIMES_NOVOS].sort());
  });

  it('cada Grupo tem os seus 8 Clássicos, todos com nome e cada Time em dois', () => {
    for (const g of ['CHAO', 'COPA'] as const) {
      const cs = classicosDoGrupo(g);
      expect(cs).toHaveLength(8);
      for (const c of cs) {
        expect(ehClassico(c.a, c.b)).toBe(true);
        expect(c.nome).toMatch(/^Clássico d/);
      }
      for (const t of GRUPOS_DA_A_DE_16[g]) expect(cs.filter((c) => c.a === t || c.b === t)).toHaveLength(2);
    }
  });

  it('nome da pasta sem acento nem espaço', () => {
    expect(pastaDoDestaque('Perfis dos Times')).toBe('perfis-dos-times');
    expect(pastaDoDestaque('Campeões')).toBe('campeoes');
  });
});

describe('Campeões no destaque', () => {
  it('a Onça é a campeã da Temporada 1', async () => {
    const { CAMPEOES } = await import('../src/destaquesDoPerfil.js');
    expect(CAMPEOES[0]).toEqual({ temporada: 1, time: 'ONC' });
  });
});
