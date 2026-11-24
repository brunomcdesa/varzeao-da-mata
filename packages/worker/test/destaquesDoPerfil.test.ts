import { describe, expect, it } from 'vitest';
import { FALA_DO_TIME, GRUPOS_DA_A_DE_16 } from '@liga/shared';
import { EXEMPLO_DE_INSCRICAO, POSICOES_NO_DESTAQUE } from '@liga/renderer/destaquesDoPerfil';
import { interpretar } from '../src/comandos.js';

/** O que os Stories ensinam a escrever o leitor de comentários entende (ADR-0109). */
describe('Destaques do perfil: o que o Story ensina, o Varzeão entende', () => {
  it('o exemplo de Inscrição', () => {
    expect(interpretar(EXEMPLO_DE_INSCRICAO)).toEqual({ tipo: 'INSCRICAO', time: 'CAP', posicao: 'ATA' });
  });

  it('cada jeito de escrever a Posição', () => {
    for (const p of POSICOES_NO_DESTAQUE) for (const e of p.escreva) expect(interpretar(`ENTRO CAPIVARA ${e}`)).toEqual({ tipo: 'INSCRICAO', time: 'CAP', posicao: p.posicao });
  });

  it('o nome do bicho de cada Time, como aparece no Story', () => {
    for (const t of [...GRUPOS_DA_A_DE_16.CHAO, ...GRUPOS_DA_A_DE_16.COPA]) expect(interpretar(`ENTRO ${FALA_DO_TIME[t].curto.toUpperCase()} ATA`)).toEqual({ tipo: 'INSCRICAO', time: t, posicao: 'ATA' });
  });
});
