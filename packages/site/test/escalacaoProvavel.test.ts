import { describe, expect, it } from 'vitest';
import { escalacaoProvavel, forcaProvavel, inscritosAteNoProximoJogo, type PartidaNoCalendario } from '@liga/shared';
import { noMataMata } from '../src/mataMata.js';

const jogo = (o: Partial<PartidaNoCalendario> & Pick<PartidaNoCalendario, 'fase' | 'apito' | 'mandante' | 'visitante'>): PartidaNoCalendario => ({
  id: 0,
  rodada: 1,
  situacao: 'ENCERRADA',
  classico: false,
  escalada: true,
  ...o,
});

// Fase de Liga: último jogo da Onça no dia 13 às 18h (Corte 17h30, horário UTC aqui).
const liga = [
  jogo({ fase: 'LIGA', rodada: 6, apito: '2026-11-12T18:00:00.000Z', mandante: 'ONC', visitante: 'CAP' }),
  jogo({ fase: 'LIGA', rodada: 7, apito: '2026-11-13T18:00:00.000Z', mandante: 'TAT', visitante: 'ONC' }),
];
const semis = [
  jogo({ fase: 'MATA_MATA', rodada: 8, apito: '2026-11-14T14:00:00.000Z', mandante: 'ONC', visitante: 'TAT', situacao: 'AGENDADA', escalada: false }),
  jogo({ fase: 'MATA_MATA', rodada: 8, apito: '2026-11-14T16:00:00.000Z', mandante: 'CAP', visitante: 'JAB', situacao: 'AGENDADA', escalada: false }),
];

describe('escalação provável no Mata-mata (ADR-0057)', () => {
  it('na Fase de Liga vale o Elenco todo', () => {
    expect(inscritosAteNoProximoJogo([liga[0]!, { ...liga[1]!, situacao: 'AGENDADA' }], 'ONC')).toBeNull();
  });

  it('com o próximo jogo no Mata-mata, o limite é o Corte do último jogo do Time na Fase de Liga', () => {
    expect(inscritosAteNoProximoJogo([...liga, ...semis], 'ONC')).toBe('2026-11-13T17:30:00.000Z');
  });

  it('quem venceu a Semifinal continua no Mata-mata antes de a Final ser criada', () => {
    const jogadas = semis.map((s) => ({ ...s, situacao: 'ENCERRADA' as const, classificado: s.mandante }));
    expect(inscritosAteNoProximoJogo([...liga, ...jogadas], 'ONC')).toBe('2026-11-13T17:30:00.000Z');
    // Eliminado: não há próximo jogo nesta Temporada, vale o Elenco todo.
    expect(inscritosAteNoProximoJogo([...liga, ...jogadas], 'TAT')).toBeNull();
  });

  it('depois da Final, vale o Elenco todo', () => {
    const jogadas = semis.map((s) => ({ ...s, situacao: 'ENCERRADA' as const, classificado: s.mandante }));
    const final = jogo({ fase: 'MATA_MATA', rodada: 9, apito: '2026-11-15T18:00:00.000Z', mandante: 'ONC', visitante: 'CAP', classificado: 'ONC' });
    expect(inscritosAteNoProximoJogo([...liga, ...jogadas, final], 'ONC')).toBeNull();
  });

  it('o novato fica fora e o próximo da fila (ou a Base) entra no lugar', () => {
    const elenco = [
      { id: 'a', posicao: 'ATA' as const, ovr: 70, jogos: 6, inscritoEm: '2026-11-01T10:00:00.000Z' },
      { id: 'b', posicao: 'ATA' as const, ovr: 66, jogos: 5, inscritoEm: '2026-11-02T10:00:00.000Z' },
      { id: 'novo', posicao: 'ATA' as const, ovr: 60, jogos: 0, inscritoEm: '2026-11-14T09:00:00.000Z' },
      { id: 'no-corte', posicao: 'GOL' as const, ovr: 64, jogos: 0, inscritoEm: '2026-11-13T17:30:00.000Z' },
    ];
    const atacantes = (lim: string | null) => escalacaoProvavel(elenco, lim).filter((l) => l.posicao === 'ATA').map((l) => l.jogador?.id ?? null);
    expect(atacantes(null)).toEqual(['novo', 'b']);
    expect(atacantes('2026-11-13T17:30:00.000Z')).toEqual(['b', 'a']);
    // Quem se inscreveu exatamente no Corte ainda joga.
    expect(escalacaoProvavel(elenco, '2026-11-13T17:30:00.000Z')[0]!.jogador?.id).toBe('no-corte');
    expect(forcaProvavel(elenco, '2026-11-13T17:30:00.000Z').ataque).toBe(68);
  });
});

describe('Quer jogar? durante o Mata-mata', () => {
  it('liga só enquanto falta a Final', () => {
    expect(noMataMata({ calendario: liga })).toBe(false);
    expect(noMataMata({ calendario: [...liga, ...semis] })).toBe(true);
    const jogadas = semis.map((s) => ({ ...s, situacao: 'ENCERRADA' as const }));
    expect(noMataMata({ calendario: [...liga, ...jogadas] })).toBe(true);
    const final = jogo({ fase: 'MATA_MATA', rodada: 9, apito: '2026-11-15T18:00:00.000Z', mandante: 'ONC', visitante: 'CAP' });
    expect(noMataMata({ calendario: [...liga, ...jogadas, final] })).toBe(false);
  });
});
