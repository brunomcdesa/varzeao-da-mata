import { describe, expect, it } from 'vitest';
import { RoteiroRebalanceamentoT2, narracaoDoRebalanceamentoT2, type DadosDoRebalanceamentoT2 } from '../src/rebalanceamentoT2.js';

const dados: DadosDoRebalanceamentoT2 = {
  movidos: 61,
  ficaram: 56,
  primos: [['CAP', 'SUC'], ['ONC', 'JAC'], ['TAT', 'LEA'], ['TAM', 'LOB'], ['PRE', 'COR'], ['SAG', 'BES'], ['TUC', 'BOT'], ['ARA', 'TAR']],
  estreia: '2026-11-19',
  primeiroJogoAs: 11,
};

describe('Reels do Rebalanceamento da T2 (ADR-0066)', () => {
  it('conta a regra, os Primos, os números, o Fundador e chama para o site e a estreia', () => {
    const roteiro = new RoteiroRebalanceamentoT2(dados);
    expect(roteiro.segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'REGRA', 'PRIMOS', 'NUMEROS', 'FUNDADOR', 'CHAMADA']);
    const falas = narracaoDoRebalanceamentoT2(roteiro).map((f) => f.texto);
    expect(falas[1]).toContain('um goleiro, dois zagueiros, dois meias e dois atacantes. Ficam os mais antigos de cada posição');
    expect(falas[2]).toContain('time primo');
    expect(falas[3]).toBe('Foram 61 jogadores que mudaram de time, e 56 que ficaram onde estavam.');
    expect(falas[4]).toContain('selo de fundador');
    expect(falas[5]).toContain('trocar de time não gasta a sua transferência');
    expect(falas[5]).toContain('na quinta, dia 19, às onze da manhã');
    // Sem nomes nem @ de Jogadores (decisão do dono).
    expect(falas.join(' ')).not.toMatch(/@/);
  });

  it('a narração mais longa estica a cartela', () => {
    const curto = new RoteiroRebalanceamentoT2(dados);
    const longo = new RoteiroRebalanceamentoT2(dados, { 3: { antes: 20 } });
    expect(longo.duracao).toBeGreaterThan(curto.duracao);
  });
});
