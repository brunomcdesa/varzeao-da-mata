import { describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, type Posicao, type TimeId } from '@liga/shared';
import {
  RoteiroExplicacao,
  contarElencos,
  exemploPadrao,
  frequencia,
  maisDisputada,
  narracaoDaExplicacao,
  quandoEscrito,
  titularesFixos,
  vagasDaBase,
  type DadosDaExplicacao,
} from '../src/explicacaoEscalacao.js';

const j = (time: TimeId, posicao: Posicao, n = 1) => Array.from({ length: n }, () => ({ time, posicao }));

/** Os Elencos da Temporada 1 depois da Rodada 3 (10/11, 20h01). */
const jogadores = [
  ...j('CAP', 'GOL', 2), ...j('CAP', 'MEI', 3), ...j('CAP', 'ATA', 7),
  ...j('ONC', 'GOL', 3), ...j('ONC', 'ZAG', 2), ...j('ONC', 'MEI', 4), ...j('ONC', 'ATA', 4),
  ...j('TAT', 'GOL'), ...j('TAT', 'ZAG', 2), ...j('TAT', 'MEI'), ...j('TAT', 'ATA', 4),
  ...j('TAM', 'MEI', 3), ...j('TAM', 'ATA', 4),
  ...j('PRE', 'GOL'), ...j('PRE', 'ZAG', 2), ...j('PRE', 'MEI', 2), ...j('PRE', 'ATA', 5),
  ...j('SAG', 'GOL'), ...j('SAG', 'ZAG', 4), ...j('SAG', 'MEI', 4), ...j('SAG', 'ATA', 3),
  ...j('TUC', 'GOL', 2), ...j('TUC', 'ZAG'), ...j('TUC', 'MEI', 2), ...j('TUC', 'ATA', 5),
  ...j('ARA', 'GOL'), ...j('ARA', 'ZAG', 4), ...j('ARA', 'MEI', 4), ...j('ARA', 'ATA', 4),
];
const elencos = contarElencos(jogadores, TIMES_FUNDADORES);
const dados: DadosDaExplicacao = { temporada: 1, rodadas: 7, situacaoEm: '2026-11-10T23:01:50Z', elencos };

describe('Reels que explica a Escalação', () => {
  it('conta os inscritos de cada Time por Posição', () => {
    expect(elencos.CAP).toEqual({ GOL: 2, ZAG: 0, MEI: 3, ATA: 7 });
    expect(Object.values(elencos).reduce((s, e) => s + e.GOL + e.ZAG + e.MEI + e.ATA, 0)).toBe(85);
  });

  it('acha as vagas que vão para o Jogador da Base', () => {
    expect(vagasDaBase(elencos)).toEqual([
      { time: 'CAP', posicao: 'ZAG', faltam: 2 },
      { time: 'TAT', posicao: 'MEI', faltam: 1 },
      { time: 'TAM', posicao: 'GOL', faltam: 1 },
      { time: 'TAM', posicao: 'ZAG', faltam: 2 },
      { time: 'TUC', posicao: 'ZAG', faltam: 1 },
    ]);
  });

  it('acha quem é titular em todo jogo (um inscrito por vaga)', () => {
    expect(titularesFixos(elencos)).toContainEqual({ time: 'SAG', posicao: 'GOL' });
    expect(titularesFixos(elencos)).toContainEqual({ time: 'PRE', posicao: 'ZAG' });
    expect(titularesFixos(elencos)).not.toContainEqual({ time: 'TUC', posicao: 'ZAG' });
  });

  it('escolhe como exemplo o Time com Posição lotada e vaga para a Base', () => {
    expect(maisDisputada(elencos.CAP)).toEqual({ posicao: 'ATA', inscritos: 7, vagas: 2 });
    expect(exemploPadrao(elencos)).toBe('CAP');
  });

  it('diz quanto cada um joga pelo rodízio', () => {
    expect(frequencia(7, 2)).toBe('joga 2 de cada 7 Rodadas');
    expect(frequencia(2, 1)).toBe('joga 1 de cada 2 Rodadas');
    expect(frequencia(4, 2)).toBe('joga 1 de cada 2 Rodadas');
    expect(frequencia(1, 1)).toBe('joga todas as Rodadas');
    expect(frequencia(1, 2)).toBe('joga sempre (e entra Base)');
    expect(frequencia(0, 2)).toBe('vaga do Jogador da Base');
  });

  it('mostra a hora da foto dos Elencos no horário de Brasília', () => {
    expect(quandoEscrito('2026-11-10T23:01:50Z')).toBe('10/11 às 20h01');
  });

  it('narra uma fala por cartela, sem @ e com os números do exemplo', () => {
    const r = new RoteiroExplicacao(dados);
    const falas = narracaoDaExplicacao(r);
    expect(falas).toHaveLength(r.segmentos.length);
    for (const f of falas) expect(f.texto).not.toContain('@');
    expect(falas[4]!.texto).toContain('sete atacantes para duas vagas');
    expect(falas[5]!.texto).toContain('no momento deste vídeo');
  });

  it('estica a cartela quando a fala não cabe', () => {
    const curto = new RoteiroExplicacao(dados);
    const longo = new RoteiroExplicacao(dados, { 3: { antes: 20 } });
    expect(longo.duracao).toBeCloseTo(curto.duracao + 20.6 - 9);
  });
});
