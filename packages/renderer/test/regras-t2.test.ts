import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { ehT2 } from '../src/clima.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr: 70, habilidades: habilidadesDoPerfil(posicao, 70) })),
});

describe('Partida com as regras da Temporada 2', () => {
  it('é reconhecida pela Postura guardada, não pelo número da versão (ADR-0027)', () => {
    const entrada = { mandante: esc('ARA'), visitante: esc('ONC'), seed: 7, fase: 'LIGA' as const };
    const t1 = simularPartida(entrada);
    const t2 = simularPartida({ ...entrada, t2: { postura: { mandante: 'EQUILIBRADA', visitante: 'OFENSIVA' } } });
    expect(t1.versaoSim).toBeGreaterThanOrEqual(6);
    expect(ehT2(t1)).toBe(false);
    expect(ehT2(t2)).toBe(true);
  });
});
