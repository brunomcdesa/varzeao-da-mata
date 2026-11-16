import { describe, expect, it } from 'vitest';
import { GRUPOS_DA_A_DE_16, brigaDaPartida, etapaDa, estruturaDaLiga, situacoesNaBriga, timesQueCaem, type PartidaParaBriga, type TimeId } from '@liga/shared';
import { faseDeGrupos, horariosDaLiga } from '../src/calendario.js';

describe('Estrutura da Temporada (ADR-0064)', () => {
  it('Fase de Liga de 7 Rodadas (T1, Grupos da T2 e Séries de 8): Semifinais na 8 e Final na 9', () => {
    expect(estruturaDaLiga(7)).toEqual({ rodadasDaLiga: 7, rodadaDasSemifinais: 8, rodadaDaFinal: 9 });
    expect([etapaDa('MATA_MATA', 8), etapaDa('MATA_MATA', 9)]).toEqual(['SEMIFINAL', 'FINAL']);
  });

  it('caem os 4 últimos de cada Grupo na T2, 2 com Série B e nenhum na T1', () => {
    expect(timesQueCaem({ temSerieB: false, porGrupo: true })).toBe(4);
    expect(timesQueCaem({ temSerieB: true, porGrupo: false })).toBe(2);
    expect(timesQueCaem({ temSerieB: false, porGrupo: false })).toBe(0);
  });

  it('os Grupos têm os Clássicos juntos e cada fundador com o seu Primo', () => {
    expect([...GRUPOS_DA_A_DE_16.CHAO].sort()).toEqual(['CAP', 'CDM', 'JAC', 'LOB', 'ONC', 'SUC', 'TAM', 'TAT']);
    expect([...GRUPOS_DA_A_DE_16.COPA].sort()).toEqual(['ARA', 'BOT', 'COR', 'MOR', 'PIR', 'PRE', 'SAG', 'TUC']);
  });

  it('turno único dentro de cada Grupo: 7 Rodadas de 8 jogos, alternando Chão e Copa', () => {
    const rodadas = faseDeGrupos(8, GRUPOS_DA_A_DE_16);
    expect(rodadas).toHaveLength(7);
    for (const jogos of rodadas) {
      expect(jogos).toHaveLength(8);
      jogos.forEach((j, k) => {
        const grupo = k % 2 === 0 ? GRUPOS_DA_A_DE_16.CHAO : GRUPOS_DA_A_DE_16.COPA;
        expect(grupo).toContain(j.mandante);
        expect(grupo).toContain(j.visitante);
      });
    }
    const pares = rodadas.flat().map((j) => [j.mandante, j.visitante].sort().join('-'));
    expect(new Set(pares).size).toBe(2 * 28);
  });

  it('8 jogos por dia, um por hora, das 11h às 18h', () => {
    expect(horariosDaLiga('A', false, 8)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    expect(horariosDaLiga('A', false, 4)).toEqual([12, 14, 16, 18]);
  });

  it('Briga da última Rodada com Grupo: 2 vagas', () => {
    const times: TimeId[] = ['CAP', 'ONC', 'TAT', 'TAM'];
    let id = 0;
    const jogo = (rodada: number, m: TimeId, v: TimeId, gm: number | null, gv = 0): PartidaParaBriga => ({ id: ++id, fase: 'LIGA', rodada, mandante: m, visitante: v, apito: rodada * 1000 + id, hora: 11, gols: gm === null ? null : { mandante: gm, visitante: gv } });
    const partidas = [jogo(1, 'CAP', 'ONC', 3), jogo(1, 'TAT', 'TAM', 3), jogo(2, 'CAP', 'TAT', 3), jogo(2, 'ONC', 'TAM', 3), jogo(3, 'CAP', 'TAM', null), jogo(3, 'ONC', 'TAT', null)];
    const b = brigaDaPartida(partidas[4]!, partidas, times, null, { grupo: 'CHAO', vagas: 2 })!;
    expect(b.vagas).toBe(2);
    // CAP com 6 pontos já está entre os 2 primeiros; TAM com 0 já está fora.
    const s = situacoesNaBriga(b, { mandante: 'CAP', visitante: 'TAM' }, null);
    expect(s.get('CAP')).toBe('GARANTIDO');
    expect(s.get('TAM')).toBe('ELIMINADO');
  });
});
