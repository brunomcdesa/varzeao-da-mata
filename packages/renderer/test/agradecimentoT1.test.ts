import { describe, expect, it } from 'vitest';
import { PISO_DA_TEMPORADA_1, RODADAS_DO_BONUS_T1 } from '@liga/shared';
import { PARAMETROS_T2 } from '@liga/sim';
import { NARRADOR_DO_AGRADECIMENTO, RoteiroAgradecimentoT1, horaFalada, narracaoDoAgradecimentoT1, type DadosDoAgradecimentoT1 } from '../src/agradecimentoT1.js';
import { NARRADORES } from '../src/narradores.js';

const dados: DadosDoAgradecimentoT1 = { inscritos: 100, jogos: 31, gols: 116, piso: PISO_DA_TEMPORADA_1, rodadasDoBonus: RODADAS_DO_BONUS_T1, multiplicadorDoBonus: PARAMETROS_T2.multiplicadorBonusT1 };

describe('Reels de agradecimento da Temporada 1 (ADR-0047)', () => {
  it('não tem cartela do campeão: ele já está no Resumo da Temporada', () => {
    const roteiro = new RoteiroAgradecimentoT1(dados);
    expect(roteiro.segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'NUMEROS', 'OBRIGADO', 'SELO', 'PISO', 'BONUS', 'CHAMADA']);
    expect(narracaoDoAgradecimentoT1(roteiro).map((f) => f.texto).join(' ')).not.toMatch(/campeão|@/i);
  });

  it('fala os números da Temporada e a Recompensa com os valores das regras', () => {
    const textos = narracaoDoAgradecimentoT1(new RoteiroAgradecimentoT1(dados)).map((f) => f.texto);
    expect(textos[1]).toContain('100 jogadores inscritos, 31 jogos e 116 gols');
    expect(textos.find((t) => t.includes('OVR abaixo'))).toContain('sessenta e cinco');
    expect(textos.find((t) => t.includes('rodadas'))).toContain('nas duas primeiras rodadas');
    expect(textos.find((t) => t.includes('rodadas'))).toContain('cinquenta por cento');
    expect(textos.find((t) => t.includes('rodadas'))).toContain('resenha');
  });

  it('uma fala por cartela, dentro do trecho dela; estica quando a fala é longa', () => {
    const roteiro = new RoteiroAgradecimentoT1(dados);
    const falas = narracaoDoAgradecimentoT1(roteiro);
    expect(falas).toHaveLength(roteiro.segmentos.length);
    falas.forEach((f, i) => {
      expect(f.inicio).toBeGreaterThanOrEqual(roteiro.segmentos[i]!.inicio);
      expect(f.limite).toBe(roteiro.segmentos[i]!.fim);
    });
    const longo = new RoteiroAgradecimentoT1(dados, { 2: { antes: 14 } });
    expect(longo.segmentos[2]!.fim - longo.segmentos[2]!.inicio).toBeCloseTo(14.6);
    expect(longo.em(longo.duracao + 5).segmento.cartela).toBe('CHAMADA');
  });

  it('é narrado pelo Seu Dito', () => {
    expect(NARRADORES.find((n) => n.id === NARRADOR_DO_AGRADECIMENTO)?.nome).toBe('Seu Dito');
  });

  it('não fala do Rebalanceamento nem do Fundador (ADR-0058); chama para a Abertura do mesmo dia', () => {
    const roteiro = new RoteiroAgradecimentoT1({ ...dados, aberturaAs: 21 });
    expect(roteiro.segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'NUMEROS', 'OBRIGADO', 'SELO', 'PISO', 'BONUS', 'CHAMADA']);
    const textos = narracaoDoAgradecimentoT1(roteiro).map((f) => f.texto);
    expect(textos.join(' ')).not.toMatch(/Série B|Fundador|time primo/i);
    expect(textos[6]).toContain('hoje, às nove da noite, sai a abertura');
    expect(textos.join(' ')).not.toMatch(/@/);
  });

  it('fala a hora do jeito do Narrador', () => {
    expect(horaFalada(21)).toBe('às nove da noite');
    expect(horaFalada(16)).toBe('às quatro da tarde');
    expect(horaFalada(12)).toBe('ao meio-dia');
    expect(horaFalada(10)).toBe('às dez da manhã');
  });
});
