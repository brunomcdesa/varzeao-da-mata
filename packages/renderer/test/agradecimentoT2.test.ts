import { describe, expect, it } from 'vitest';
import { MOEDAS } from '@liga/shared';
import { FORMATO_DA_T2, NARRADOR_DO_AGRADECIMENTO, RoteiroAgradecimentoT2, TIMES_DA_T2, diaDaCopa, narracaoDoAgradecimentoT2, type DadosDoAgradecimentoT2 } from '../src/agradecimentoT2.js';
import { NARRADORES } from '../src/narradores.js';

const dados: DadosDoAgradecimentoT2 = { jogadores: 184, jogos: 59, gols: 231, aberturaAs: 21, copaEm: '2026-11-30' };

describe('Reels de Fim da Temporada 2 (ADR-0117)', () => {
  it('cartelas na ordem, sem a do campeão (ele está no Resumo da Temporada)', () => {
    const roteiro = new RoteiroAgradecimentoT2(dados);
    expect(roteiro.segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'NUMEROS', 'OBRIGADO', 'MOEDAS', 'CHAMADA']);
    expect(narracaoDoAgradecimentoT2(roteiro).map((f) => f.texto).join(' ')).not.toMatch(/campeão|@/i);
  });

  it('o formato e os escudos vêm da divisão de verdade: 16 Times em 2 Grupos', () => {
    expect(FORMATO_DA_T2).toBe('16 Times em 2 Grupos');
    expect(TIMES_DA_T2).toHaveLength(16);
    expect(new Set(TIMES_DA_T2).size).toBe(16);
  });

  it('fala os números e o presente com os valores das regras', () => {
    const textos = narracaoDoAgradecimentoT2(new RoteiroAgradecimentoT2(dados)).map((f) => f.texto);
    expect(textos[1]).toContain('184 jogadores em campo, 59 jogos e 231 gols');
    expect(MOEDAS.BONUS_POR_TEMPORADA).toBe(20);
    expect(textos[3]).toContain('vinte moedas por temporada jogada');
    expect(textos[3]).toContain('quarenta moedas');
  });

  it('a chamada diz que a Abertura é hoje e que a Copa começa na segunda', () => {
    expect(diaDaCopa('2026-11-30')).toEqual({ semana: 'segunda', dia: '30/11' });
    const fim = narracaoDoAgradecimentoT2(new RoteiroAgradecimentoT2(dados)).at(-1)!.texto;
    expect(fim).toContain('hoje, às nove da noite, sai a abertura da temporada três');
    expect(fim).toContain('a Copa começa segunda');
    const sem = narracaoDoAgradecimentoT2(new RoteiroAgradecimentoT2({ jogadores: 1, jogos: 1, gols: 0 })).at(-1)!.texto;
    expect(sem).not.toMatch(/hoje|Copa|undefined/);
  });

  it('uma fala por cartela, dentro do trecho dela; estica quando a fala é longa', () => {
    const roteiro = new RoteiroAgradecimentoT2(dados);
    const falas = narracaoDoAgradecimentoT2(roteiro);
    expect(falas).toHaveLength(roteiro.segmentos.length);
    falas.forEach((f, i) => {
      expect(f.inicio).toBeGreaterThanOrEqual(roteiro.segmentos[i]!.inicio);
      expect(f.limite).toBe(roteiro.segmentos[i]!.fim);
    });
    const longo = new RoteiroAgradecimentoT2(dados, { 3: { antes: 15 } });
    expect(longo.segmentos[3]!.fim - longo.segmentos[3]!.inicio).toBeCloseTo(15.6);
  });

  it('é narrado pelo Seu Dito, como o agradecimento da T1', () => {
    expect(NARRADORES.find((n) => n.id === NARRADOR_DO_AGRADECIMENTO)?.nome).toBe('Seu Dito');
  });
});
