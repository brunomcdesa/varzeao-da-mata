import { describe, expect, it } from 'vitest';
import type { Estatisticas, JogadorPublico, LigaPublica, PartidaNoCalendario } from '@liga/shared';
import { artilharia, assistencias, ataqueEDefesa, encerradas, goleiros, maiorGoleada, panorama } from '../src/temporada.js';

const est = (e: Partial<Estatisticas>): Estatisticas => ({ jogos: 0, gols: 0, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0, dribles: 0, bloqueios: 0, notaMedia: null, melhorNota: null, vitorias: 0, empates: 0, derrotas: 0, ...e });
const jog = (id: string, posicao: JogadorPublico['posicao'], e: Partial<Estatisticas>) => ({ id, username: `j${id}`, time: 'CAP', posicao, nestaTemporada: est(e) }) as unknown as JogadorPublico;

const jogo = (id: number, rodada: number, apito: string, m: number | null, v: number | null): PartidaNoCalendario => ({
  id, rodada, fase: 'LIGA', apito, mandante: 'CAP', visitante: 'ONC', situacao: m === null ? 'AGENDADA' : 'ENCERRADA', classico: false, escalada: true,
  ...(m !== null && v !== null ? { placar: { mandante: m, visitante: v } } : {}),
});
const liga = (calendario: PartidaNoCalendario[]) => ({ calendario, rodadas: [], tabela: [] }) as unknown as LigaPublica;
const depois = Date.parse('2026-11-10T12:00:00Z');

describe('Líderes da Temporada', () => {
  it('artilharia: mais gols; empate vai para quem tem menos jogos, depois quem se inscreveu antes', () => {
    const js = [jog('5', 'ATA', { gols: 4, jogos: 4 }), jog('3', 'ATA', { gols: 4, jogos: 3 }), jog('2', 'MEI', { gols: 4, jogos: 4 }), jog('9', 'ATA', { gols: 6, jogos: 5 }), jog('1', 'ZAG', { gols: 0, jogos: 5 })];
    expect(artilharia(js).map((l) => l.jogador.id)).toEqual(['9', '3', '2', '5']);
  });
  it('assistências: quem não deu nenhuma fica de fora', () => {
    const js = [jog('1', 'MEI', { assistencias: 2, jogos: 3 }), jog('2', 'ATA', { assistencias: 0, jogos: 3 })];
    expect(assistencias(js).map((l) => [l.jogador.id, l.valor])).toEqual([['1', 2]]);
  });
  it('goleiros: só GOL com pelo menos 3 jogos; empate na nota vai para menos gols sofridos por jogo', () => {
    const js = [
      jog('1', 'GOL', { jogos: 3, notaMedia: 7.2, golsSofridos: 3 }),
      jog('2', 'GOL', { jogos: 4, notaMedia: 7.2, golsSofridos: 2 }),
      jog('3', 'GOL', { jogos: 2, notaMedia: 9 }),
      jog('4', 'ZAG', { jogos: 5, notaMedia: 8 }),
    ];
    expect(goleiros(js).map((l) => l.jogador.id)).toEqual(['2', '1']);
  });
});

describe('Panorama da Temporada', () => {
  const cal = [
    jogo(1, 1, '2026-11-08T15:00:00Z', 2, 1),
    jogo(2, 1, '2026-11-08T17:00:00Z', 4, 0),
    jogo(3, 2, '2026-11-09T15:00:00Z', 1, 1),
    jogo(4, 2, '2026-11-10T21:00:00Z', null, null),
  ];
  it('conta só o que já acabou pelo relógio, e as Rodadas completas', () => {
    const p = panorama(liga(cal), depois);
    expect(p).toMatchObject({ jogos: 3, totalDeJogos: 4, gols: 9, mediaDeGols: 3, rodadasJogadas: 1, totalDeRodadas: 2 });
  });
  it('não revela um jogo que ainda está Ao Vivo', () => {
    const aoVivo = [jogo(1, 1, '2026-11-10T11:58:00Z', 3, 0)];
    expect(encerradas(liga(aoVivo), depois)).toEqual([]);
  });
  it('últimos jogos vêm do mais recente para o mais antigo', () => {
    expect(encerradas(liga(cal), depois).map((p) => p.id)).toEqual([3, 2, 1]);
  });
  it('maior goleada: maior diferença, com pelo menos 2 gols', () => {
    expect(maiorGoleada(liga(cal), undefined, depois)?.id).toBe(2);
    expect(maiorGoleada(liga([cal[0]!, cal[2]!]), undefined, depois)).toBeNull();
  });
});

describe('Números dos Times', () => {
  it('melhor ataque e melhor defesa ignoram quem ainda não jogou', () => {
    const linha = (time: string, jogos: number, golsPro: number, golsContra: number) => ({ time, jogos, golsPro, golsContra, pontos: 0, vitorias: 0, empates: 0, derrotas: 0, saldo: golsPro - golsContra }) as never;
    const r = ataqueEDefesa([linha('CAP', 3, 8, 4), linha('ONC', 3, 5, 2), linha('TAT', 0, 0, 0)]);
    expect([r?.ataque.time, r?.defesa.time]).toEqual(['CAP', 'ONC']);
  });
});
