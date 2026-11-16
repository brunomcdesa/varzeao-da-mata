import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida, type Lado } from '@liga/sim';
import { Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { comPreposicao, montarNarracao, resolverApelidos } from '../src/narracao.js';
import { roteiroAoVivo } from '../src/aoVivo.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) })),
});
const e = { mandante: esc('CAP', 70), visitante: esc('ONC', 70) };
const POSTURA = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const;
const NOMES = ['Muralha', 'Zezão', 'Tiquinho', 'Bruninho', 'Lelê', 'Dadá', 'Fumaça'];
const apelidos: Record<Lado, (string | null)[]> = {
  mandante: NOMES.map((n) => `${n}C`),
  visitante: NOMES.map((n) => `${n}O`),
};
const todos = [...apelidos.mandante, ...apelidos.visitante] as string[];
const timeline = (seed: number, t2: boolean) => new Timeline(simularPartida({ ...e, seed, fase: 'LIGA', ...(t2 ? { t2: POSTURA } : {}) }), e);
const POSICAO = /\b(goleiro|zagueiro|meia|atacante) d[aoe]s? /;

describe('apelido na narração (ADR-0059)', () => {
  it('T2: toda fala de Jogador usa o apelido; a primeira vez vem com a posição e o Time', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const falas = montarNarracao(new Roteiro(timeline(seed, true)), apelidos);
      const vistos = new Set<string>();
      for (const f of falas) {
        expect(f.texto, `seed ${seed}`).not.toMatch(/[\u0001\u0002\u0003]/);
        expect(f.texto, `seed ${seed}`).not.toMatch(/,,|, [.!?]/);
        for (const nome of todos) {
          const i = f.texto.indexOf(nome);
          if (i < 0) continue;
          const depois = f.texto.slice(i + nome.length);
          if (!vistos.has(nome)) expect(depois, `seed ${seed}: "${f.texto}"`).toMatch(/^, (o )?(goleiro|zagueiro|meia|atacante)/);
          else expect(depois, `seed ${seed}: "${f.texto}"`).not.toMatch(/^, (o )?(goleiro|zagueiro|meia|atacante)/);
          vistos.add(nome);
        }
      }
      expect(vistos.size, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('T2: sem apelido (ou com apelido que não dá para falar), continua pela posição e pelo Time', () => {
    const semNome: Record<Lado, (string | null)[]> = { mandante: ['123', null, null, null, null, '__', null], visitante: Array(7).fill(null) };
    let porPosicao = 0;
    for (let seed = 1; seed <= 10; seed++) {
      for (const f of montarNarracao(new Roteiro(timeline(seed, true)), semNome)) {
        expect(f.texto).not.toMatch(/123|__/);
        if (POSICAO.test(f.texto)) porPosicao++;
      }
    }
    expect(porPosicao).toBeGreaterThan(10);
  });

  it('T1: o apelido continua só nos gols', () => {
    for (let seed = 1; seed <= 15; seed++) {
      for (const f of montarNarracao(new Roteiro(timeline(seed, false)), apelidos)) {
        if (todos.some((n) => f.texto.includes(n))) expect(f.id, f.texto).toMatch(/^lance-\d+-c$/);
      }
    }
  });

  it('Ao Vivo da T2 também fala o apelido', () => {
    const falas = roteiroAoVivo(timeline(3, true), apelidos);
    expect(falas.some((f) => todos.some((n) => f.texto.includes(n)))).toBe(true);
    expect(falas.every((f) => !/[\u0001\u0002\u0003]/.test(f.texto))).toBe(true);
  });

  it('preposições sem artigo para o apelido e vírgula só onde cabe', () => {
    expect(comPreposicao('o goleiro da Onça', 'do')).toBe('do goleiro da Onça');
    expect(comPreposicao('o atacante', 'pro')).toBe('pro atacante');
    const dados = () => ({ nome: 'Bruninho', posicao: 'goleiro', time: 'da Onça' });
    const marca = '\u0001mandante.0.T.\u0002';
    const ap = new Set<string>();
    expect(resolverApelidos(`Que defesa ${comPreposicao(marca, 'do')}!`, ap, dados)).toBe('Que defesa de Bruninho, goleiro da Onça!');
    expect(resolverApelidos(`Espalmou ${marca}!`, ap, dados)).toBe('Espalmou Bruninho!');
    expect(resolverApelidos(`Olha ${marca}, de fora da área!`, new Set(), dados)).toBe('Olha Bruninho, goleiro da Onça, de fora da área!');
    expect(resolverApelidos(`${marca} segura.`, new Set(), dados)).toBe('Bruninho, goleiro da Onça, segura.');
    expect(resolverApelidos(`Tocou ${comPreposicao('\u0001mandante.0.P.\u0002', 'pro')}, livre!`, new Set(), dados)).toBe('Tocou pra Bruninho, o goleiro, livre!');
  });
});
