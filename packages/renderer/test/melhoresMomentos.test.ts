import type { MataMataDaPartida } from '@liga/shared';
import { describe, expect, it } from 'vitest';
import { partidaDeTeste } from '../scripts/gravacao.js';
import { roteiroAoVivo } from '../src/aoVivo.js';
import { ONDE_VER_O_JOGO, montarNarracao } from '../src/narracao.js';
import { Roteiro } from '../src/roteiro.js';
import { Timeline } from '../src/timeline.js';

const FINAL: MataMataDaPartida = { etapa: 'FINAL', temporada: 1, serie: null };

function falas(seed: number, t2 = false, mataMata: MataMataDaPartida | null = null, mandante: 'CAP' | 'SAG' = 'CAP', visitante: 'ONC' | 'TUC' = 'ONC') {
  const p = partidaDeTeste(seed, mandante, visitante, undefined, mataMata ? 'MATA_MATA' : 'LIGA', t2);
  const tl = new Timeline(p.resultado, p.escalacoes);
  const reels = montarNarracao(new Roteiro(tl), p.apelidos, { mataMata });
  const aoVivo = roteiroAoVivo(tl, p.apelidos, { mataMata });
  const de = (l: { id: string; texto: string }[], id: string) => l.find((f) => f.id === id)!.texto;
  return { reels: { abertura: de(reels, 'abertura'), fim: de(reels, 'fim') }, aoVivo: { abertura: de(aoVivo, 'abertura'), fim: de(aoVivo, 'fim') } };
}

describe('Reels como melhores momentos (ADR-0052)', () => {
  it('no Reels, a abertura diz que são os melhores momentos (Liga, Clássico e Mata-mata)', () => {
    expect(falas(5, false, null, 'SAG', 'TUC').reels.abertura).toContain('Melhores momentos do Varzeão da Mata!');
    expect(falas(42).reels.abertura).toContain('Melhores momentos do Clássico');
    expect(falas(7, false, FINAL).reels.abertura).toContain('Melhores momentos!');
  });

  it('no Reels, o fim chama para o jogo completo no site (T1) e no site e no app (T2)', () => {
    expect(falas(42).reels.fim).toContain(`Ao Vivo e no Replay, tá ${ONDE_VER_O_JOGO(false)}!`);
    expect(falas(42).reels.fim).not.toContain('app');
    expect(falas(42, true).reels.fim).toContain(`tá ${ONDE_VER_O_JOGO(true)}!`);
    expect(falas(42).reels.fim).not.toContain('Compartilha');
  });

  it('o Ao Vivo continua como antes: nada de "melhores momentos" nem chamada para o site', () => {
    for (const f of [falas(42), falas(42, true), falas(7, false, FINAL), falas(5, false, null, 'SAG', 'TUC')]) {
      expect(f.aoVivo.abertura).not.toMatch(/melhores momentos/i);
      expect(f.aoVivo.fim).not.toContain('jogo completo');
      expect(f.aoVivo.fim).toContain('Curtiu? Compartilha com a galera!');
    }
  });
});
