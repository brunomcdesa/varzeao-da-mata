import { describe, expect, it } from 'vitest';
import { duracaoAoVivoMs, habilidadesDoPerfil, type EscalacaoPublica, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { momentosDoAoVivo, timelineDaPartida } from '../src/partidaPublica.js';
import { VELOCIDADE_AO_VIVO } from '../src/timeline.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const pub = (time: TimeId, ovr: number): EscalacaoPublica =>
  ({ time, jogadores: ORDEM.map((posicao, i) => ({ lugar: i, jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) })) }) as unknown as EscalacaoPublica;

function partida(seed: number, fase: 'LIGA' | 'MATA_MATA' = 'LIGA') {
  const escalacoes = { mandante: pub('CAP', 74), visitante: pub('ONC', 66) };
  const resultado = simularPartida({
    mandante: { time: 'CAP', jogadores: escalacoes.mandante.jogadores as never },
    visitante: { time: 'ONC', jogadores: escalacoes.visitante.jogadores as never },
    seed,
    fase,
  });
  return { resultado, escalacoes, fase, torcida: undefined };
}

describe('momentosDoAoVivo (Avisos do App)', () => {
  it('um gol por gol da sim, em ordem, com o placar que a tela mostra naquele instante', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const p = partida(seed);
      const m = momentosDoAoVivo(p)!;
      const tl = timelineDaPartida(p)!;
      expect(m.gols.length).toBe(p.resultado.gols.mandante + p.resultado.gols.visitante);
      expect(m.placar).toEqual(p.resultado.gols);
      for (let i = 0; i < m.gols.length; i++) {
        const g = m.gols[i]!;
        if (i) expect(g.emMs).toBeGreaterThanOrEqual(m.gols[i - 1]!.emMs);
        expect(g.emMs).toBeLessThan(m.fimMs);
        // No instante do aviso, o placar da tela já é o do aviso.
        expect(tl.placarEm((g.emMs / 1000) * VELOCIDADE_AO_VIVO + 0.01)).toEqual(g.placar);
      }
    }
  });

  it('o fim é o fim do Ao Vivo da fase', () => {
    expect(momentosDoAoVivo(partida(3))!.fimMs).toBe(duracaoAoVivoMs('LIGA'));
    expect(momentosDoAoVivo(partida(3, 'MATA_MATA'))!.fimMs).toBe(duracaoAoVivoMs('MATA_MATA'));
  });

  it('sem Escalação ou resultado, nada', () => {
    expect(momentosDoAoVivo({ resultado: null, escalacoes: null, fase: 'LIGA' })).toBeNull();
  });
});
