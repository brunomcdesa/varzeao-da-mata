import { describe, expect, it } from 'vitest';
import { DESTAQUE_DA_POSICAO, destaquesDaRodada, destaquesDaTemporada, numeroDoDestaque, type DesempenhoParaDestaque, type Posicao } from '@liga/shared';

const d = (jogadorId: string | null, posicao: Posicao, nota: number, extra: Partial<DesempenhoParaDestaque> = {}): DesempenhoParaDestaque => ({
  jogadorId, posicao, nota, gols: 0, assistencias: 0, desarmes: 0, bloqueios: 0, defesas: 0, golsSofridos: 0, ...extra,
});

describe('Destaques por Posição (ADR-0041)', () => {
  it('escolhe a maior Nota de cada Posição, inclusive goleiro e zagueiro', () => {
    const r = destaquesDaRodada([
      d('1', 'ATA', 8.9, { gols: 2 }),
      d('2', 'ATA', 6.0, { gols: 1 }),
      d('3', 'GOL', 9.2, { defesas: 5 }),
      d('4', 'ZAG', 7.5, { desarmes: 3, bloqueios: 1 }),
      d('5', 'MEI', 7.1, { assistencias: 2 }),
    ]);
    expect(r.map((x) => [x.posicao, x.jogadorId])).toEqual([['GOL', '3'], ['ZAG', '4'], ['MEI', '5'], ['ATA', '1']]);
    expect(r.find((x) => x.posicao === 'ZAG')!.numero).toEqual({ valor: 4, legenda: 'desarmes' });
  });

  it('o Jogador da Base não concorre', () => {
    const r = destaquesDaRodada([d(null, 'GOL', 9.9), d('7', 'GOL', 6.2)]);
    expect(r).toEqual([expect.objectContaining({ posicao: 'GOL', jogadorId: '7' })]);
  });

  it('desempata pelo número-chave e depois por quem se inscreveu antes', () => {
    expect(destaquesDaRodada([d('9', 'ATA', 8, { gols: 1 }), d('8', 'ATA', 8, { gols: 2 })])[0]!.jogadorId).toBe('8');
    expect(destaquesDaRodada([d('12', 'MEI', 7), d('11', 'MEI', 7)])[0]!.jogadorId).toBe('11');
  });

  it('com Série B, cada Série tem os seus Destaques', () => {
    const r = destaquesDaRodada([d('1', 'GOL', 7, { serie: 'A' }), d('2', 'GOL', 9, { serie: 'B' })]);
    expect(r.map((x) => [x.serie, x.jogadorId])).toEqual([['A', '1'], ['B', '2']]);
  });

  it('na Temporada, vale a Nota média com pelo menos 3 jogos na Posição', () => {
    const r = destaquesDaTemporada([
      d('1', 'GOL', 9.8), d('1', 'GOL', 9.8),
      d('2', 'GOL', 7), d('2', 'GOL', 8), d('2', 'GOL', 9, { defesas: 4 }),
    ]);
    expect(r).toEqual([expect.objectContaining({ jogadorId: '2', nota: 8, jogos: 3, numero: { valor: 4, legenda: 'defesas' } })]);
  });

  it('quem jogou em duas Posições concorre em cada uma separadamente', () => {
    const r = destaquesDaRodada([d('1', 'MEI', 8), d('1', 'ATA', 6)]);
    expect(r.map((x) => x.posicao)).toEqual(['MEI', 'ATA']);
  });

  it('os nomes não repetem os das Especializações', () => {
    expect(Object.values(DESTAQUE_DA_POSICAO)).toEqual(['Muralha', 'Carrapato', 'Garçom', 'Matador']);
    for (const n of ['Xerife', 'Paredão', 'Artilheiro', 'Armador']) expect(Object.values(DESTAQUE_DA_POSICAO)).not.toContain(n);
  });

  it('legenda no singular', () => {
    expect(numeroDoDestaque('ATA', { gols: 1, assistencias: 0, desarmes: 0, defesas: 0 }).legenda).toBe('gol');
  });
});
