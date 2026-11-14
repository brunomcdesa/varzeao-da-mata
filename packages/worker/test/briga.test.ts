import { describe, expect, it } from 'vitest';
import { brigaDaPartida, necessidadeNaBriga, situacoesNaBriga, textoDaNecessidade, type BrigaPeloMataMata, type PartidaParaBriga, type TimeId } from '@liga/shared';
import { desfechoDaBriga, falaDosGarantidos, falasDaNecessidade, seAcabarAssim } from '../../renderer/src/narracao.js';
import { plaquinhasDaBriga } from '../../renderer/src/desenho.js';

const linha = (time: TimeId, pontos: number, vitorias: number, saldo = 0) => ({ time, pontos, vitorias, saldo, golsPro: 10 + saldo });
/** Antes do jogo das 14h da última Rodada: Arara e Capivara já garantidas, Sagui e Tucano fora. */
const briga: BrigaPeloMataMata = {
  serie: null,
  tabela: [linha('ARA', 15, 5, 8), linha('CAP', 13, 4, 5), linha('ONC', 10, 3, 2), linha('TAT', 9, 3, 1), linha('TAM', 8, 2, 0), linha('PRE', 6, 2, -2), linha('SAG', 3, 1, -6), linha('TUC', 1, 0, -8)],
  depois: [
    { mandante: 'CAP', visitante: 'SAG', hora: 16 },
    { mandante: 'TAM', visitante: 'PRE', hora: 18 },
  ],
};
const times = { mandante: 'ONC', visitante: 'TAT' } as const;

describe('Briga pelo Mata-mata (ADR-0053)', () => {
  it('antes do Apito: garantidos, eliminados e quem ainda briga', () => {
    const s = situacoesNaBriga(briga, times, null);
    expect(s.get('ARA')).toBe('GARANTIDO');
    expect(s.get('CAP')).toBe('GARANTIDO');
    expect(s.get('ONC')).toBe('DEPENDE');
    expect(s.get('TAT')).toBe('DEPENDE');
    expect(s.get('TAM')).toBe('DEPENDE');
    expect(s.get('SAG')).toBe('ELIMINADO');
    expect(s.get('TUC')).toBe('ELIMINADO');
  });

  it('do que cada Time precisa', () => {
    expect(textoDaNecessidade(necessidadeNaBriga(briga, times, 'mandante'))).toBe('Empate basta');
    expect(textoDaNecessidade(necessidadeNaBriga(briga, times, 'visitante'))).toBe('Vencendo, classifica');
  });

  it('se acabar assim: com o placar exato desta Partida', () => {
    const s = situacoesNaBriga(briga, times, { mandante: 0, visitante: 1 });
    expect(s.get('TAT')).toBe('GARANTIDO');
    expect(s.get('ONC')).toBe('DEPENDE');
    expect(situacoesNaBriga(briga, times, { mandante: 1, visitante: 1 }).get('TAT')).toBe('DEPENDE');
  });

  it('nunca chama de garantido quem ainda pode cair pelo desempate', () => {
    // Duas vagas, três Times empatados em pontos e vitórias, e um deles ainda joga.
    const b: BrigaPeloMataMata = {
      serie: null,
      tabela: [linha('ARA', 12, 4, 9), linha('CAP', 9, 3, 1), linha('ONC', 9, 3, 2), linha('TAT', 9, 3, 3), linha('TAM', 9, 3, 4), linha('PRE', 0, 0)],
      depois: [{ mandante: 'TAM', visitante: 'PRE', hora: 18 }],
    };
    const s = situacoesNaBriga(b, { mandante: 'ONC', visitante: 'TAT' }, { mandante: 0, visitante: 0 });
    // ONC e TAT com 10: TAM pode chegar a 12 e ARA tem 12; os empatados em 10 não têm saldo conhecido de TAM.
    expect(s.get('ONC')).not.toBe('ELIMINADO');
    expect(s.get('CAP')).toBe('DEPENDE');
  });

  it('sem Partidas depois, o desempate por saldo é exato', () => {
    const b: BrigaPeloMataMata = {
      serie: null,
      tabela: [linha('ARA', 12, 4, 9), linha('CAP', 12, 4, 8), linha('ONC', 9, 3, 2), linha('TAT', 9, 3, 3), linha('TAM', 9, 3, 1), linha('PRE', 0, 0)],
      depois: [],
    };
    const s = situacoesNaBriga(b, { mandante: 'PRE', visitante: 'TAM' }, { mandante: 0, visitante: 0 });
    // TAM fica com 10 pontos, 3 vitórias; ONC e TAT com 9 → TAM é 3º.
    expect(s.get('TAM')).toBe('GARANTIDO');
    expect(s.get('TAT')).toBe('GARANTIDO');
    expect(s.get('ONC')).toBe('ELIMINADO');
  });

  it('só existe na última Rodada da Fase de Liga e conta só o que foi jogado antes', () => {
    const p = (id: number, rodada: number, m: TimeId, v: TimeId, hora: number, gols: [number, number] | null): PartidaParaBriga => ({
      id, fase: 'LIGA', rodada, mandante: m, visitante: v, apito: Date.UTC(2026, 10, rodada, hora + 3), hora, gols: gols ? { mandante: gols[0], visitante: gols[1] } : null,
    });
    const partidas = [p(1, 6, 'ARA', 'CAP', 12, [2, 0]), p(2, 7, 'ARA', 'ONC', 12, [1, 0]), p(3, 7, 'CAP', 'TAT', 14, [3, 3]), p(4, 7, 'ONC', 'TAM', 16, [0, 0])];
    const fundadores: TimeId[] = ['CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA'];
    expect(brigaDaPartida(partidas[0]!, partidas, fundadores, null)).toBeNull();
    const b = brigaDaPartida(partidas[2]!, partidas, fundadores, null)!;
    expect(b.tabela.find((l) => l.time === 'ARA')).toMatchObject({ pontos: 6, vitorias: 2 });
    // O jogo das 16h já simulado conta como "falta", não como resultado.
    expect(b.depois).toEqual([{ mandante: 'ONC', visitante: 'TAM', hora: 16 }]);
  });

  it('o Narrador fala dos garantidos, do que cada Time precisa e do desfecho', () => {
    expect(falaDosGarantidos(briga, times)).toBe('A Arara e a Capivara já estão garantidas no Mata-mata! Será que Onça e Tatu também garantem?');
    expect(falasDaNecessidade(briga, times)).toEqual(['Um empate já basta pra Onça!', 'O Tatu depende só de si: vencendo, está no Mata-mata!']);
    expect(seAcabarAssim(briga, times, { mandante: 0, visitante: 1 }, { mandante: 0, visitante: 0 })).toBe(
      'Se terminar assim, o Tatu está no Mata-mata, e a Onça ainda depende dos outros jogos!',
    );
    expect(desfechoDaBriga(briga, times, { mandante: 2, visitante: 0 })).toEqual(['A Onça está no Mata-mata e vai brigar pelo título!', 'O Tatu agora depende dos outros jogos.']);
    expect(desfechoDaBriga(briga, times, { mandante: 0, visitante: 1 })).toEqual(['O Tatu está no Mata-mata e vai brigar pelo título!', 'A Onça agora depende dos outros jogos.']);
  });

  it('as plaquinhas mostram o mesmo que o Narrador fala', () => {
    expect(plaquinhasDaBriga(briga, times, { mandante: 0, visitante: 0 }, false, true).mandante.texto).toBe('Empate basta');
    expect(plaquinhasDaBriga(briga, times, { mandante: 0, visitante: 1 }, false).visitante.texto).toBe('Assim: classifica');
    expect(plaquinhasDaBriga(briga, times, { mandante: 0, visitante: 1 }, true).mandante.texto).toBe('Depende dos outros');
  });
});
