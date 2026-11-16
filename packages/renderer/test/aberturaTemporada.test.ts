import { describe, expect, it } from 'vitest';
import { DADOS_DA_ABERTURA_T2, RoteiroAberturaDaTemporada, narracaoDaAbertura } from '../src/aberturaTemporada.js';

const roteiro = (extra: Partial<typeof DADOS_DA_ABERTURA_T2> = {}) => new RoteiroAberturaDaTemporada({ ...DADOS_DA_ABERTURA_T2, ...extra, estreia: '2026-11-19' });

describe('Reels de Abertura da Temporada', () => {
  it('tem as sete cartelas, na ordem', () => {
    expect(roteiro().segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'SERIES', 'ACESSO', 'NOVIDADES', 'ENTRAR', 'AGENDA', 'CHAMADA']);
  });

  it('fala os 24 Times (8 chegam na A, 8 estreiam a B), a estreia e os horários, B antes da A (ADR-0058)', () => {
    const falas = narracaoDaAbertura(roteiro()).map((f) => f.texto).join(' ');
    for (const nome of ['Jacaré', 'Sucuri', 'Lobo-guará', 'Cachorro-do-mato', 'Boto', 'Pirarucu', 'Coruja', 'Morcego']) expect(falas).toContain(nome);
    for (const nome of ['Quati', 'Gambá', 'Jabuti', 'Teiú', 'Ariranha', 'Anta', 'Seriema', 'Bugio']) expect(falas).toContain(nome);
    expect(falas).toContain('vinte e quatro times');
    expect(falas).toContain('Ninguém que jogou a Temporada 1 cai');
    expect(falas).toContain('até dois goleiros e quatro jogadores em cada posição. Posição cheia, você vai para outro time da Série A. Só se não tiver vaga em nenhum, você começa na Série B');
    expect(falas).toContain('na quinta, dia dezenove');
    expect(falas).toContain('A Série B joga das onze da manhã às duas da tarde, um jogo por hora. E a Série A, das três às seis da tarde, com dois jogos em cada horário');
    expect(falas).toContain('Temporada 2');
    expect(falas).not.toContain('@');
  });

  it('só anuncia o Rebalanceamento quando há hora marcada', () => {
    const com = narracaoDaAbertura(roteiro({ horaDoRebalanceamento: 16 }))[3]!.texto;
    const sem = narracaoDaAbertura(roteiro({ horaDoRebalanceamento: null }))[3]!.texto;
    expect(com).toContain('hoje, às quatro da tarde');
    expect(sem).not.toContain('hoje');
  });

  it('estica a cartela até a fala caber', () => {
    expect(roteiro().segmentos[1]!.fim - roteiro().segmentos[1]!.inicio).toBe(9);
    const longo = new RoteiroAberturaDaTemporada({ ...DADOS_DA_ABERTURA_T2, estreia: '2026-11-19' }, { 1: { antes: 12 } });
    expect(longo.segmentos[1]!.fim - longo.segmentos[1]!.inicio).toBeCloseTo(12.6);
  });
});
