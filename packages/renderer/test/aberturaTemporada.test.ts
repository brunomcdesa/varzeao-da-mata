import { describe, expect, it } from 'vitest';
import { DADOS_DA_ABERTURA_T2, RoteiroAberturaDaTemporada, narracaoDaAbertura } from '../src/aberturaTemporada.js';

const roteiro = (extra: Partial<typeof DADOS_DA_ABERTURA_T2> = {}) => new RoteiroAberturaDaTemporada({ ...DADOS_DA_ABERTURA_T2, ...extra, estreia: '2026-11-19' });

describe('Reels de Abertura da Temporada', () => {
  it('tem as sete cartelas, na ordem', () => {
    expect(roteiro().segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'SERIES', 'ACESSO', 'NOVIDADES', 'ENTRAR', 'AGENDA', 'CHAMADA']);
  });

  it('T2 só com a Série A de 16: fala os 8 que chegam, que os 8 piores caem e formam a B da T3, e um jogo por hora (ADR-0062)', () => {
    const falas = narracaoDaAbertura(roteiro()).map((f) => f.texto).join(' ');
    for (const nome of ['Jacaré', 'Sucuri', 'Lobo-guará', 'Cachorro-do-mato', 'Boto', 'Pirarucu', 'Coruja', 'Morcego']) expect(falas).toContain(nome);
    for (const nome of ['Quati', 'Gambá', 'Jabuti', 'Teiú', 'Ariranha', 'Anta', 'Seriema', 'Bugio']) expect(falas).not.toContain(nome);
    expect(falas).toContain('A Série A cresce para dezesseis times');
    expect(falas).toContain('Todo mundo começa na Série A');
    expect(falas).toContain('os oito piores caem e formam a Série B, que estreia na Temporada 3');
    expect(falas).toContain('até dois goleiros e quatro jogadores em cada posição. Posição cheia, você vai para outro time.');
    expect(falas).not.toContain('começa na Série B');
    expect(falas).toContain('na quinta, dia dezenove');
    expect(falas).toContain('oito jogos por dia, um por hora, das onze da manhã às seis da tarde');
    expect(falas).toContain('Temporada 2');
    expect(falas).not.toContain('@');
  });

  it('com Série B na Temporada, segue o texto das duas Séries', () => {
    const falas = narracaoDaAbertura(roteiro({ serieB: ['QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG'], caem: 0, horarios: { B: [11, 12, 13, 14], A: [15, 16, 17, 18] }, jogosPorHorarioDaA: 2 }))
      .map((f) => f.texto)
      .join(' ');
    expect(falas).toContain('vinte e quatro times');
    expect(falas).toContain('A Série B joga das onze da manhã às duas da tarde');
  });

  it('só anuncia o Rebalanceamento quando há hora marcada', () => {
    const comB = { serieB: ['QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG'] as const, caem: 0 };
    const com = narracaoDaAbertura(roteiro({ ...comB, horaDoRebalanceamento: 16 }))[3]!.texto;
    const sem = narracaoDaAbertura(roteiro({ ...comB, horaDoRebalanceamento: null }))[3]!.texto;
    expect(com).toContain('hoje, às quatro da tarde');
    expect(sem).not.toContain('hoje');
  });

  it('estica a cartela até a fala caber', () => {
    expect(roteiro().segmentos[1]!.fim - roteiro().segmentos[1]!.inicio).toBe(9);
    const longo = new RoteiroAberturaDaTemporada({ ...DADOS_DA_ABERTURA_T2, estreia: '2026-11-19' }, { 1: { antes: 12 } });
    expect(longo.segmentos[1]!.fim - longo.segmentos[1]!.inicio).toBeCloseTo(12.6);
  });
});
