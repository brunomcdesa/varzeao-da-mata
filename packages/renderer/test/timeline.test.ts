import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { DURACAO_JOGADA, DURACAO_JOGO, Timeline } from '../src/timeline.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) })),
});

function partida(seed: number) {
  const escalacoes = { mandante: esc('CAP', 72), visitante: esc('ONC', 68) };
  const resultado = simularPartida({ ...escalacoes, seed, fase: 'LIGA' });
  return { resultado, timeline: new Timeline(resultado, escalacoes) };
}

/** Partida desenhada como as antigas (VERSAO_SIM 10 ou menos, antes do ADR-0045). */
function partidaAntiga(seed: number) {
  const escalacoes = { mandante: esc('CAP', 72), visitante: esc('ONC', 68) };
  const resultado = { ...simularPartida({ ...escalacoes, seed, fase: 'LIGA' }), versaoSim: 9 };
  return { resultado, timeline: new Timeline(resultado, escalacoes) };
}

describe('Timeline', () => {
  it('termina com o mesmo placar da sim', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { resultado, timeline } = partida(seed);
      expect(timeline.estado(DURACAO_JOGO).placar).toEqual(resultado.gols);
    }
  });

  it('o placar nunca diminui ao longo do jogo', () => {
    const { timeline } = partida(9);
    let anterior = 0;
    for (let t = 0; t <= DURACAO_JOGO; t += 15) {
      const { placar } = timeline.estado(t);
      const total = placar.mandante + placar.visitante;
      expect(total).toBeGreaterThanOrEqual(anterior);
      anterior = total;
    }
  });

  it('é função pura de t: pular direto para um instante dá o mesmo quadro que chegar lá', () => {
    const a = partida(5).timeline;
    const b = partida(5).timeline;
    for (let t = 0; t < DURACAO_JOGO; t += 60) b.estado(t);
    expect(a.estado(3210)).toEqual(b.estado(3210));
  });

  it('bola e Jogadores ficam dentro do campo', () => {
    const { timeline } = partida(3);
    for (let t = 0; t <= DURACAO_JOGO; t += 7) {
      const e = timeline.estado(t);
      for (const p of [e.bola, ...e.jogadores.map((j) => j.pos)]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('nas partidas antigas, as janelas dos lances são contíguas e cabem nos 90 minutos', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { timeline } = partidaAntiga(seed);
      expect(timeline.novo).toBe(false);
      let cursor = 0;
      for (const j of timeline.janelas) {
        expect(j.inicio).toBe(cursor);
        expect(j.fim).toBeGreaterThan(j.inicio);
        cursor = j.fim;
      }
      expect(cursor).toBeLessThanOrEqual(DURACAO_JOGO);
    }
  });

  it('mostra destaque de GOL no instante em que o gol sai', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { resultado, timeline } = partida(seed);
      const i = resultado.lances.findIndex((l) => l.tipo === 'GOL');
      if (i < 0) continue;
      const e = timeline.estado(timeline.instanteDoLance(i) + 1);
      expect(e.destaque?.tipo).toBe('GOL');
      return;
    }
    throw new Error('nenhum gol em 50 seeds');
  });

  describe('ritmo novo (ADR-0045)', () => {
    type Faixa = { inicio: number; fim: number; indiceLance: number; plano: { bola: { de: number; ate: number; tipo: string; ponto?: { x: number; y: number } }[] } };
    const faixas = (tl: Timeline) => (tl as unknown as { faixas: Faixa[] }).faixas;

    it('jogadas e toque de bola cobrem os 90 minutos, sem buraco', () => {
      for (let seed = 1; seed <= 40; seed++) {
        const { timeline } = partida(seed);
        expect(timeline.novo).toBe(true);
        let cursor = 0;
        for (const f of faixas(timeline)) {
          expect(f.inicio).toBeCloseTo(cursor, 6);
          expect(f.fim).toBeGreaterThan(f.inicio);
          cursor = f.fim;
        }
        expect(cursor).toBeCloseTo(DURACAO_JOGO, 6);
      }
    });

    it('toda jogada dura no máximo o tempo fixo (ritmo do Reels), e a sobra vira toque de bola', () => {
      let toques = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { timeline } = partida(seed);
        for (const j of timeline.janelas) expect(j.fim - j.inicio).toBeLessThanOrEqual(DURACAO_JOGADA + 1e-6);
        toques += faixas(timeline).filter((f) => f.indiceLance < 0).length;
      }
      expect(toques).toBeGreaterThan(200);
    });

    it('do último lance até o apito a bola segue com alguém (nada de bola parada no meio)', () => {
      for (let seed = 1; seed <= 40; seed++) {
        const { timeline } = partida(seed);
        const ultima = faixas(timeline)[faixas(timeline).length - 1]!;
        // A última faixa termina no apito; se é toque de bola, a bola termina com um Jogador.
        expect(ultima.fim).toBeCloseTo(DURACAO_JOGO, 6);
        if (ultima.indiceLance < 0) expect(ultima.plano.bola[ultima.plano.bola.length - 1]!.tipo).toBe('POSSE');
      }
    });

    it('saída de bola: a bola espera no meio até um Jogador do Time que sofreu tocar nela', () => {
      let saidas = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { resultado, timeline } = partida(seed);
        const lista = faixas(timeline);
        lista.forEach((f, k) => {
          const anterior = lista[k - 1];
          if (f.indiceLance >= 0 || !anterior || anterior.indiceLance < 0) return;
          const gol = resultado.lances[anterior.indiceLance]!;
          if (gol.tipo !== 'GOL') return;
          const parada = f.plano.bola.find((b) => b.tipo === 'PARADA' && b.ponto?.x === 0.5 && b.ponto?.y === 0.5)!;
          expect(parada, `seed ${seed}`).toBeDefined();
          const toque = f.inicio + parada.ate * (f.fim - f.inicio);
          const sofreu = gol.ataque === 'mandante' ? 'visitante' : 'mandante';
          const perto = timeline.estado(toque).jogadores.filter((j) => j.slot.lado === sofreu && Math.hypot(j.pos.x - 0.5, j.pos.y - 0.5) < 0.035);
          expect(perto.length, `seed ${seed} t ${toque}`).toBeGreaterThan(0);
          saidas++;
        });
      }
      expect(saidas).toBeGreaterThan(30);
    });

    it('sai gol entre o 82\' e o 90\' no relógio da tela', () => {
      let golsNoFim = 0;
      for (let seed = 1; seed <= 80; seed++) {
        const { resultado, timeline } = partida(seed);
        resultado.lances.forEach((l, i) => {
          if (l.tipo === 'GOL' && timeline.estado(timeline.instanteDoLance(i)).minuto >= 82) golsNoFim++;
        });
      }
      expect(golsNoFim).toBeGreaterThan(5);
    });

    it('o 2º zagueiro sai da posição na jogada (cobertura), em vez de ficar parado', () => {
      let andaram = 0;
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const { resultado, timeline } = partida(seed);
        timeline.janelas.forEach((j, i) => {
          const l = resultado.lances[i]!;
          if (l.bolaParada || !l.marcador) return;
          const def = l.ataque === 'mandante' ? 'visitante' : 'mandante';
          const outro = timeline.escalacoes[def].jogadores.findIndex((x, k) => x.posicao === 'ZAG' && k !== l.marcador!.indice && k !== l.dobra?.zagueiro.indice);
          if (outro < 0) return;
          const pos = (t: number) => timeline.estado(t).jogadores.find((x) => x.slot.lado === def && x.slot.indice === outro)?.pos;
          const a = pos(j.inicio);
          const b = pos(j.resolucao);
          if (!a || !b) return;
          total++;
          if (Math.hypot(a.x - b.x, a.y - b.y) > 0.02) andaram++;
        });
      }
      expect(andaram / total).toBeGreaterThan(0.6);
    });
  });
});

