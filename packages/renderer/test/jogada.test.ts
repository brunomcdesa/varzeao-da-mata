import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { DURACAO_JOGO, FISICA, Timeline } from '../src/timeline.js';
import { cobradorDaBolaParada } from '../src/jogada.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) })),
});
const timeline = (seed: number) => {
  const e = { mandante: esc('CAP', 72), visitante: esc('ONC', 68) };
  return new Timeline(simularPartida({ ...e, seed, fase: 'LIGA' }), e);
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('Jogadas', () => {
  it('usam todos os estilos ao longo de várias Partidas', () => {
    const vistos = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) for (const p of timeline(seed).planos) vistos.add(p.estilo);
    expect([...vistos].sort()).toEqual(['CHUTE_DE_LONGE', 'CRUZAMENTO', 'DESARME', 'ESCANTEIO', 'INDIVIDUAL', 'LANCAMENTO', 'TABELA']);
  });

  it('ninguém teleporta: nenhum boneco passa da velocidade de disparada, nem na troca de lance', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const tl = timeline(seed);
      let antes = tl.estado(0).jogadores;
      for (let t = 0.5; t < 90 * 60; t += 0.5) {
        const agora = tl.estado(t).jogadores;
        agora.forEach((j, k) => expect(dist(j.pos, antes[k]!.pos) / 0.5, `seed ${seed} t ${t}`).toBeLessThanOrEqual(FISICA.sprint * 1.05));
        antes = agora;
      }
    }
  });

  it('bola parada só é cobrada com o cobrador já na bola (escanteio e lateral)', () => {
    let vistos = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const tl = timeline(seed);
      tl.planos.forEach((p, i) => {
        const l = tl.janelas[i]!.lance;
        if (!l.bolaParada) return;
        const parada = p.bola[0]!;
        const voo = p.bola[1]!;
        if (parada.tipo !== 'PARADA' || voo.tipo !== 'VOO') return;
        const cobrador = l.bolaParada === 'ESCANTEIO' ? l.criador : cobradorDaBolaParada(l, (tl as any).bases, (tl as any).escalacoes);
        const j = tl.janelas[i]!;
        const t = j.inicio + voo.de * (j.fim - j.inicio);
        const pe = tl.estado(t).jogadores.find((x) => x.slot.lado === cobrador.lado && x.slot.indice === cobrador.indice)!.pos;
        expect(dist(pe, parada.ponto), `seed ${seed} lance ${i} ${l.bolaParada}`).toBeLessThan(0.04);
        vistos++;
      });
    }
    expect(vistos).toBeGreaterThan(20);
  });

  it('são as mesmas para a mesma Partida', () => {
    expect(timeline(11).planos).toEqual(timeline(11).planos);
  });

  it('a bola não teleporta', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const tl = timeline(seed);
      let anterior = tl.estado(0).bola;
      for (let t = 0.5; t <= DURACAO_JOGO; t += 0.5) {
        const b = tl.estado(t).bola;
        expect(dist(b, anterior)).toBeLessThan(0.06);
        anterior = b;
      }
    }
  });

  it('o chute sai do pé do finalizador', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const tl = timeline(seed);
      tl.planos.forEach((plano, i) => {
        const chute = plano.bola.find((b) => b.tipo === 'VOO' && b.chute);
        if (!chute) return;
        const j = tl.janelas[i]!;
        const t = j.inicio + (chute.de + 0.001) * (j.fim - j.inicio);
        const e = tl.estado(t);
        const f = j.lance.finalizador!;
        const fin = e.jogadores.find((x) => x.slot.lado === f.lado && x.slot.indice === f.indice)!;
        expect(dist(e.bola, fin.pos)).toBeLessThan(0.04);
      });
    }
  });

  it('chute de longe sai de fora da área', () => {
    const tl = timeline(4);
    let achou = false;
    for (let seed = 1; seed <= 30 && !achou; seed++) {
      const t2 = timeline(seed);
      t2.planos.forEach((plano, i) => {
        if (plano.estilo !== 'CHUTE_DE_LONGE') return;
        const chute = plano.bola.find((b) => b.tipo === 'VOO' && b.chute)!;
        const j = t2.janelas[i]!;
        const e = t2.estado(j.inicio + chute.de * (j.fim - j.inicio));
        const alvo = j.lance.ataque === 'mandante' ? 0.02 : 0.98;
        expect(Math.abs(e.bola.y - alvo)).toBeGreaterThan(0.2); // a área tem 0,12 de profundidade
        achou = true;
      });
    }
    expect(achou).toBe(true);
    expect(tl).toBeTruthy();
  });

  it('marca ações especiais (chute, mergulho, comemoração)', () => {
    const acoes = new Set<string>();
    const tl = timeline(7);
    for (let t = 0; t <= DURACAO_JOGO; t += 1) for (const j of tl.estado(t).jogadores) acoes.add(j.acao);
    for (const a of ['CORRENDO', 'PASSE', 'CHUTE', 'MERGULHO']) expect(acoes).toContain(a);
  });

  it('no BLOQUEIO a bola para no marcador, e o drible certo é jogada individual', () => {
    let bloqueios = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const tl = timeline(seed);
      tl.janelas.forEach((j, i) => {
        if (j.lance.drible === true && j.lance.tipo !== 'DESARME') expect(tl.planos[i]!.estilo).toBe('INDIVIDUAL');
        if (j.lance.tipo !== 'BLOQUEIO') return;
        bloqueios++;
        const e = tl.estado(j.resolucao);
        const m = j.lance.marcador!;
        const marcador = e.jogadores.find((x) => x.slot.lado === m.lado && x.slot.indice === m.indice)!;
        expect(dist(e.bola, marcador.pos)).toBeLessThan(0.04);
      });
    }
    expect(bloqueios).toBeGreaterThan(0);
  });

  it('marcação dupla: os dois zagueiros chegam junto em quem recebeu a dobra (ADR-0043)', () => {
    let vistos = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const tl = timeline(seed);
      tl.janelas.forEach((j) => {
        const l = j.lance;
        if (!l.dobra) return;
        const def = l.ataque === 'mandante' ? 'visitante' : 'mandante';
        // Com o passe, o cerco é antes do passe; sem passe, no duelo (perto da resolução).
        const f = l.dobra.passe ? 0.6 : l.tipo === 'DESARME' ? 0.6 : 0.7;
        const e = tl.estado(j.inicio + f * (j.fim - j.inicio));
        const alvo = e.jogadores.find((x) => x.slot.lado === l.dobra!.sobre.lado && x.slot.indice === l.dobra!.sobre.indice)!.pos;
        const zags = e.jogadores.filter((x) => x.slot.lado === def && x.posicao === 'ZAG');
        if (zags.length < 2) return;
        for (const z of zags) expect(dist(z.pos, alvo), `seed ${seed} lance ${l.numero}`).toBeLessThan(0.12);
        vistos++;
      });
    }
    expect(vistos).toBeGreaterThan(20);
  });
});

