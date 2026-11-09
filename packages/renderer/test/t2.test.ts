import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida, type Lado } from '@liga/sim';
import { DURACAO_JOGO, Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { montarEventos, montarNarracao } from '../src/narracao.js';
import { pontoDaFalta } from '../src/jogada.js';
import { climaDaPartida, quemUsaSegundoUniforme } from '../src/clima.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) })),
});
const POSTURA = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const;

function partida(seed: number, t2: boolean, times: [TimeId, TimeId] = ['CAP', 'ONC']) {
  const escalacoes = { mandante: esc(times[0], 72), visitante: esc(times[1], 68) };
  const resultado = simularPartida({ ...escalacoes, seed, fase: 'LIGA', ...(t2 ? { t2: POSTURA } : {}) });
  return { resultado, timeline: new Timeline(resultado, escalacoes, { torcida: { mandante: 12, visitante: 5 } }) };
}

/** Primeira Partida da T2 a partir de `seed` que tem o que o teste precisa. */
function partidaCom(cond: (p: ReturnType<typeof partida>) => boolean) {
  for (let seed = 1; seed < 2000; seed++) {
    const p = partida(seed, true);
    if (cond(p)) return p;
  }
  throw new Error('nenhuma partida encontrada');
}

describe('Temporada 2 no renderer', () => {
  it('Partida da T1 não mostra nada da T2 (sem Clima, Arquibancada nem falta)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { resultado, timeline } = partida(seed, false);
      expect(timeline.t2).toBeNull();
      expect(timeline.estado(DURACAO_JOGO / 2).t2).toBeNull();
      expect(resultado.lances.some((l) => l.tipo === 'FALTA')).toBe(false);
      const roteiro = new Roteiro(timeline);
      expect(montarEventos(roteiro).some((e) => e.tipo === 'APITO_FALTA' || e.tipo === 'CORO')).toBe(false);
    }
  });

  it('Partida da T2 traz Clima, segundo uniforme e torcida', () => {
    const { resultado, timeline } = partida(5, true);
    expect(timeline.t2).toEqual({ clima: climaDaPartida(resultado.seed), segundoUniforme: quemUsaSegundoUniforme(resultado.times), torcida: { mandante: 12, visitante: 5 } });
  });

  it('o clássico Capivara × Onça segue com as camisas de sempre; Capivara × Lobo-Guará troca', () => {
    expect(quemUsaSegundoUniforme({ mandante: 'CAP', visitante: 'ONC' })).toBeNull();
    expect(quemUsaSegundoUniforme({ mandante: 'CAP', visitante: 'LOB' })).toBe('visitante');
  });

  it('termina com o placar da sim e a bola da cobrança sai do lugar da falta', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { resultado, timeline } = partida(seed, true);
      expect(timeline.estado(DURACAO_JOGO).placar).toEqual(resultado.gols);
    }
  });

  it('o pênalti é cobrado na marca e a falta da área acontece dentro da área', () => {
    const { resultado, timeline } = partidaCom((p) => p.resultado.lances.some((l, i) => l.tipo === 'FALTA' && l.falta?.local === 'AREA' && p.resultado.lances[i + 1]?.bolaParada === 'PENALTI'));
    const i = resultado.lances.findIndex((l, k) => l.tipo === 'FALTA' && l.falta?.local === 'AREA' && resultado.lances[k + 1]?.bolaParada === 'PENALTI');
    const cobranca = resultado.lances[i + 1]!;
    const marca = pontoDaFalta(cobranca);
    const j = timeline.janelas[i]!;
    // No fim da janela da falta, a bola está parada na marca do pênalti.
    const fim = timeline.estado(j.fim - 0.01);
    expect(Math.abs(fim.bola.x - marca.x)).toBeLessThan(0.02);
    expect(Math.abs(fim.bola.y - marca.y)).toBeLessThan(0.02);
    // O bote é perto do gol (dentro da área: até ~16% do comprimento do campo).
    const bote = timeline.estado(j.resolucao);
    const gol = cobranca.ataque === 'mandante' ? 0.02 : 0.98;
    expect(Math.abs(bote.bola.y - gol)).toBeLessThan(0.18);
  });

  it('o expulso sai do campo depois do vermelho', () => {
    const { resultado, timeline } = partidaCom((p) => p.resultado.lances.some((l) => l.falta?.cartao === 'VERMELHO'));
    const i = resultado.lances.findIndex((l) => l.falta?.cartao === 'VERMELHO');
    const autor = resultado.lances[i]!.falta!.autor;
    const mesmo = (s: { lado: Lado; indice: number }) => s.lado === autor.lado && s.indice === autor.indice;
    expect(timeline.estado(timeline.janelas[i]!.inicio).jogadores.some((j) => mesmo(j.slot))).toBe(true);
    expect(timeline.estado(DURACAO_JOGO - 1).jogadores.some((j) => mesmo(j.slot))).toBe(false);
  });

  it('a falta com cartão aparece no Reels e a narração fala dela sem citar @', () => {
    const { timeline } = partidaCom((p) => p.resultado.lances.some((l, i) => l.falta?.cartao && p.resultado.lances[i + 1]?.tipo === 'GOL'));
    const roteiro = new Roteiro(timeline);
    const falta = roteiro.segmentos.find((s) => s.tipo === 'LANCE' && timeline.resultado.lances[s.lance!]!.tipo === 'FALTA');
    expect(falta).toBeDefined();
    const falas = montarNarracao(roteiro);
    expect(falas.some((f) => /amarelo|vermelho|cartão|falta|pênalti/i.test(f.texto))).toBe(true);
    expect(falas.every((f) => !f.texto.includes('@'))).toBe(true);
    expect(montarEventos(roteiro).some((e) => e.tipo === 'APITO_FALTA')).toBe(true);
  });
});
