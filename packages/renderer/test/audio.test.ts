import { describe, expect, it } from 'vitest';
import type { Escalacao, Posicao, TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { montarEventos, montarNarracao } from '../src/narracao.js';
import { TAXA, agendarFalas, codificarWav, lerWavMono, mixar } from '../src/audio.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr })),
});
const roteiro = (seed: number, a: TimeId = 'CAP', b: TimeId = 'ONC') => {
  const e = { mandante: esc(a, 72), visitante: esc(b, 68) };
  return new Roteiro(new Timeline(simularPartida({ ...e, seed, fase: 'LIGA' }), e));
};

describe('Narração', () => {
  it('nunca fala @ e fica dentro do vídeo', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = roteiro(seed);
      for (const f of montarNarracao(r)) {
        expect(f.texto).not.toContain('@');
        expect(f.inicio).toBeGreaterThanOrEqual(0);
        expect(f.inicio).toBeLessThan(r.duracao);
        expect(f.limite).toBeGreaterThan(f.inicio);
      }
    }
  });

  it('narra todo gol e chama o Clássico pelo nome', () => {
    const r = roteiro(42);
    const falas = montarNarracao(r);
    const gols = r.timeline.resultado.gols.mandante + r.timeline.resultado.gols.visitante;
    expect(falas.filter((f) => f.tom === 'grito')).toHaveLength(gols);
    expect(falas[0]!.texto).toContain('Clássico da Margem');
    expect(montarNarracao(roteiro(42, 'SAG', 'TUC'))[0]!.texto).not.toContain('Clássico');
  });

  it('fala de Jogador por posição e Time', () => {
    const textos = montarNarracao(roteiro(5)).map((f) => f.texto).join(' ');
    expect(textos).toMatch(/(meia|atacante|goleiro|zagueiro) (da|do) (Capivara|Onça)/);
  });

  it('é a mesma para a mesma Partida', () => {
    expect(montarNarracao(roteiro(9))).toEqual(montarNarracao(roteiro(9)));
  });

  it('marca apitos, chutes e reação da torcida', () => {
    const tipos = new Set(montarEventos(roteiro(42)).map((e) => e.tipo));
    for (const t of ['APITO_INICIAL', 'APITO_FINAL', 'CHUTE', 'PASSE', 'GOL']) expect(tipos).toContain(t);
  });
});

describe('Agenda das falas', () => {
  it('não sobrepõe falas e respeita os limites', () => {
    const falas = montarNarracao(roteiro(42));
    const agenda = agendarFalas(falas, (id) => falas.find((f) => f.id === id)!.texto.length / 14);
    for (let i = 1; i < agenda.length; i++) {
      const anterior = agenda[i - 1]!;
      const dur = falas.find((f) => f.id === anterior.id)!.texto.length / 14 / anterior.velocidade;
      expect(agenda[i]!.inicio).toBeGreaterThanOrEqual(Math.min(anterior.inicio + dur, anterior.cortarEm ?? Infinity) - 1e-9);
    }
    for (const a of agenda) expect(a.velocidade).toBeLessThanOrEqual(1.3);
  });

  it('tira fala opcional que não cabe, mas nunca o grito de gol', () => {
    const falas = [
      { id: 'a', texto: '', inicio: 0, limite: 2, tom: 'normal' as const },
      { id: 'b', texto: '', inicio: 1, limite: 2.5, tom: 'normal' as const, opcional: true },
      { id: 'c', texto: '', inicio: 2, limite: 3, tom: 'grito' as const },
    ];
    const agenda = agendarFalas(falas, () => 1.9);
    expect(agenda.map((a) => a.id)).toEqual(['a', 'c']);
    expect(agenda[1]!.cortarEm).toBe(3);
  });
});

describe('Mixagem', () => {
  it('gera áudio com a duração do vídeo, sem estourar', () => {
    const r = roteiro(42);
    const voz = new Float32Array(TAXA).map((_, i) => Math.sin(i / 20) * 0.5);
    const { esq, dir } = mixar({ duracao: r.duracao, segmentos: r.segmentos, eventos: montarEventos(r), vozes: [{ inicio: 1, amostras: voz }] });
    expect(esq.length).toBe(Math.ceil(r.duracao * TAXA));
    let pico = 0;
    for (let i = 0; i < esq.length; i += 7) {
      expect(Number.isFinite(esq[i]!)).toBe(true);
      pico = Math.max(pico, Math.abs(esq[i]!), Math.abs(dir[i]!));
    }
    expect(pico).toBeLessThanOrEqual(1);
    expect(pico).toBeGreaterThan(0.1);
  });

  it('WAV: codifica e lê de volta', () => {
    const s = new Float32Array(480).map((_, i) => Math.sin(i / 10) * 0.8);
    const { amostras, taxa } = lerWavMono(codificarWav(s, s));
    expect(taxa).toBe(TAXA);
    expect(amostras.length).toBe(480);
    expect(Math.abs(amostras[100]! - s[100]!)).toBeLessThan(1e-3);
  });
});
