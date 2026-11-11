import { describe, expect, it } from 'vitest';
import { LIMITE_DELTA_HABILIDADE, PESOS_OVR } from '@liga/shared';
import { ACOES, PARAMETROS } from '@liga/sim';
import { O_QUE_SOBE, RoteiroExplicacaoOvr, bonusDaResenha, narracaoDaExplicacaoOvr, principalDa, type DadosDaExplicacaoOvr } from '../src/explicacaoOvr.js';

const dados: DadosDaExplicacaoOvr = { time: 'CAP', multiplicadorResenha: PARAMETROS.multiplicadorResenha, corteMinutos: 30 };

describe('Reels que explica o OVR', () => {
  it('mostra a Habilidade que mais pesa em cada Posição, com o peso das regras', () => {
    expect(principalDa('ATA')).toEqual({ habilidade: 'Finalização', peso: 55 });
    expect(principalDa('MEI')).toEqual({ habilidade: 'Passe', peso: 45 });
    expect(principalDa('ZAG')).toEqual({ habilidade: 'Defesa', peso: 75 });
    expect(principalDa('GOL')).toEqual({ habilidade: 'Goleiro', peso: 90 });
    for (const p of ['ATA', 'MEI', 'ZAG', 'GOL'] as const) expect(Math.max(...Object.values(PESOS_OVR[p]))).toBe(principalDa(p).peso / 100);
  });

  it('o que o vídeo diz que sobe cada Habilidade é o que as regras fazem', () => {
    const sobe = (acao: keyof typeof ACOES, hab: string) => ACOES[acao].hab === hab && ACOES[acao].valor > 0;
    expect(O_QUE_SOBE.map(([, h]) => h)).toEqual(['FIN', 'PAS', 'DRI', 'DEF', 'GOL']);
    expect(sobe('gol', 'FIN') && sobe('assistencia', 'PAS') && sobe('driblou', 'DRI') && sobe('desarme', 'DEF') && sobe('bloqueio', 'DEF') && sobe('defesa', 'GOL')).toBe(true);
    for (const a of ['chuteFora', 'chuteDefendido', 'chuteBloqueado', 'perdeuPosse', 'foiDriblado', 'golSofridoGoleiro'] as const) expect(ACOES[a].valor).toBeLessThan(0);
  });

  it('a Resenha aparece com o bônus das regras', () => {
    expect(bonusDaResenha(PARAMETROS.multiplicadorResenha)).toBe(50);
    const falas = narracaoDaExplicacaoOvr(new RoteiroExplicacaoOvr(dados));
    expect(falas.find((f) => f.texto.includes('resenha'))!.texto).toContain('cinquenta por cento');
    expect(falas.find((f) => f.texto.includes('resenha'))!.texto).toContain('meia hora antes');
    expect(falas.find((f) => f.texto.includes('máximo'))!.texto).toContain(LIMITE_DELTA_HABILIDADE === 2 ? 'dois pontos' : String(LIMITE_DELTA_HABILIDADE));
  });

  it('tem uma fala por cartela, dentro do trecho dela, e não fala de nada da Temporada 2', () => {
    const roteiro = new RoteiroExplicacaoOvr(dados);
    const falas = narracaoDaExplicacaoOvr(roteiro);
    expect(falas).toHaveLength(roteiro.segmentos.length);
    falas.forEach((f, i) => {
      expect(f.inicio).toBeGreaterThanOrEqual(roteiro.segmentos[i]!.inicio);
      expect(f.limite).toBe(roteiro.segmentos[i]!.fim);
      expect(f.texto).not.toMatch(/@|treino|especializa|presença|capitão|postura/i);
    });
    expect(roteiro.duracao).toBeLessThan(60);
  });

  it('estica a cartela quando a fala é mais longa que ela', () => {
    const curto = new RoteiroExplicacaoOvr(dados);
    const longo = new RoteiroExplicacaoOvr(dados, { 1: { antes: 15 } });
    expect(longo.segmentos[1]!.fim - longo.segmentos[1]!.inicio).toBeCloseTo(15.6);
    expect(longo.duracao).toBeGreaterThan(curto.duracao);
    expect(longo.em(longo.duracao + 5).segmento.cartela).toBe('CHAMADA');
  });
});
