import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, posicoesDaFormacao, type Escalacao, type Formacao, type TimeId } from '@liga/shared';
import { simularPartida, type Lado, type SlotRef } from '@liga/sim';
import { FISICA, Timeline, posicoesBase } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { montarNarracao } from '../src/narracao.js';

/** Formação (ADR-0044): o desenho em campo e as Jogadas da Formação. */
const esc = (f: Formacao, time: TimeId): Escalacao => ({
  time,
  jogadores: posicoesDaFormacao(f).map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr: 70, habilidades: habilidadesDoPerfil(posicao, 70) })),
});
const partida = (seed: number, a: Formacao, b: Formacao) => {
  const e = { mandante: esc(a, 'CAP'), visitante: esc(b, 'ONC') };
  const r = simularPartida({ ...e, seed, fase: 'LIGA', t2: { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' }, formacao: { mandante: a, visitante: b } } });
  return new Timeline(r, e);
};
const eh = (s: SlotRef, t: SlotRef) => s.lado === t.lado && s.indice === t.indice;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('Formação no desenho (ADR-0044)', () => {
  it('cada Formação põe os 7 em lugares diferentes, e o 3-2-1 tem três zagueiros abertos', () => {
    for (const f of ['2-2-2', '2-3-1', '3-2-1', '3-1-2'] as const) {
      const b = posicoesBase(esc(f, 'CAP'), 'mandante');
      for (let i = 0; i < b.length; i++) for (let k = i + 1; k < b.length; k++) expect(dist(b[i]!, b[k]!), `${f} ${i}-${k}`).toBeGreaterThan(0.08);
    }
    const z = posicoesBase(esc('3-2-1', 'CAP'), 'mandante').slice(1, 4);
    expect(z.map((p) => p.x)).toEqual([0.24, 0.5, 0.76]);
  });

  it('Tabela: o criador toca para o meia de apoio e recebe de volta', () => {
    let vistas = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const tl = partida(seed, '2-3-1', '2-2-2');
      tl.resultado.lances.forEach((l, i) => {
        if (!l.apoio || l.bolaParada) return;
        vistas++;
        const bola = tl.planos[i]!.bola;
        const ida = bola.findIndex((b) => b.tipo === 'VOO' && 'ator' in b.origem && eh(b.origem.ator, l.criador) && 'ator' in b.destino && eh(b.destino.ator, l.apoio!));
        expect(ida, `seed ${seed} lance ${l.numero}`).toBeGreaterThanOrEqual(0);
        const volta = bola[ida + 1]!;
        expect(volta.tipo === 'VOO' && 'ator' in volta.origem && eh(volta.origem.ator, l.apoio!), `seed ${seed} lance ${l.numero} ${l.tipo} ${tl.planos[i]!.estilo} ${JSON.stringify(volta)}`).toBe(true);
      });
    }
    expect(vistas).toBeGreaterThan(10);
  });

  it('Ligação direta: o zagueiro fica atrás e a bola sai por cima; interceptada, o rival corta no ar', () => {
    let vistas = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const tl = partida(seed, '3-1-2', '2-2-2');
      tl.resultado.lances.forEach((l, i) => {
        if (l.jogadaDaFormacao !== 'LIGACAO_DIRETA' || l.bolaParada) return;
        vistas++;
        const plano = tl.planos[i]!;
        const lancamento = plano.bola.find((b) => b.tipo === 'VOO' && 'ator' in b.origem && eh(b.origem.ator, l.criador));
        expect(lancamento && lancamento.tipo === 'VOO' && lancamento.altura).toBeGreaterThanOrEqual(0.45);
        const quadros = plano.atores.find((a) => eh(a.slot, l.criador))!.quadros;
        // Lá atrás: a 0,68 do gol atacado (o mandante ataca para y = 0).
        expect(quadros[1]![1]!.y).toBeCloseTo(0.02 + 0.68, 2);
        if (l.tipo === 'DESARME' && !l.finalizador) {
          expect(lancamento!.tipo === 'VOO' && 'ator' in lancamento!.destino && eh(lancamento!.destino.ator, l.defensor)).toBe(true);
        }
      });
    }
    expect(vistas).toBeGreaterThan(10);
  });

  it('Cobertura: o zagueiro da sobra entra na jogada; quando desarma, o marcador já tinha ficado para trás', () => {
    let vistas = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const tl = partida(seed, '2-2-2', '3-2-1');
      tl.resultado.lances.forEach((l, i) => {
        if (!l.cobertura || l.bolaParada) return;
        vistas++;
        const plano = tl.planos[i]!;
        expect(plano.atores.some((a) => eh(a.slot, l.cobertura!)), `seed ${seed} lance ${l.numero}`).toBe(true);
        expect(plano.acoes.some((a) => eh(a.slot, l.cobertura!) && a.acao === 'CARRINHO')).toBe(true);
        if (l.tipo === 'DESARME') expect(plano.acoes.some((a) => eh(a.slot, l.marcador!) && a.acao === 'CARRINHO')).toBe(true);
      });
    }
    expect(vistas).toBeGreaterThan(5);
  });

  it('ninguém teleporta com as Formações novas', () => {
    for (const [a, b] of [['2-3-1', '3-2-1'], ['3-1-2', '3-2-1']] as const) {
      const tl = partida(3, a, b);
      let antes = tl.estado(0).jogadores;
      for (let t = 0.5; t < 90 * 60; t += 0.5) {
        const agora = tl.estado(t).jogadores;
        agora.forEach((j, k) => expect(dist(j.pos, antes[k]!.pos) / 0.5, `${a}x${b} t ${t}`).toBeLessThanOrEqual(FISICA.sprint * 1.05));
        antes = agora;
      }
    }
  });

  it('o Narrador diz o nome da Jogada da Formação', () => {
    const textos = (a: Formacao, b: Formacao) => {
      const out: string[] = [];
      for (let seed = 1; seed <= 4; seed++) out.push(...montarNarracao(new Roteiro(partida(seed, a, b))).map((f) => f.texto));
      return out.join('\n');
    };
    expect(textos('2-3-1', '2-2-2')).toMatch(/[Tt]abel/);
    expect(textos('3-1-2', '2-2-2')).toMatch(/[Ll]igação direta/);
    expect(textos('2-2-2', '3-2-1')).toMatch(/[Cc]obertura/);
  });
});

export type { Lado };
