import { describe, expect, it } from 'vitest';
import type { Escalacao, Posicao, TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { exigenciasDaNarracao, montarEventos, montarNarracao } from '../src/narracao.js';
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

describe('Falas completas', () => {
  const dur = (falas: ReturnType<typeof montarNarracao>) => (id: string) => falas.find((f) => f.id === id)!.texto.length / 12;

  it('o Roteiro esticado comporta todas as falas inteiras, sem sobreposição', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const base = roteiro(seed);
      const falas = montarNarracao(base);
      const minimos = exigenciasDaNarracao(base, falas, dur(falas));
      const e = { mandante: esc('CAP', 72), visitante: esc('ONC', 68) };
      const esticado = new Roteiro(new Timeline(simularPartida({ ...e, seed, fase: 'LIGA' }), e), { minimos });
      const falas2 = montarNarracao(esticado);
      expect(falas2.map((f) => f.texto)).toEqual(falas.map((f) => f.texto));
      const agenda = agendarFalas(falas2, dur(falas2));
      expect(agenda).toHaveLength(falas2.length);
      for (const a of agenda) {
        const f = falas2.find((x) => x.id === a.id)!;
        const s = esticado.segmentos[f.segmento]!;
        // termina dentro do próprio trecho
        expect(a.inicio + dur(falas2)(a.id)).toBeLessThanOrEqual(s.fim + 1e-6);
        // e a construção da jogada termina antes da resolução
        if (s.tipo === 'LANCE' && f.parte === 'antes') expect(a.inicio + dur(falas2)(a.id)).toBeLessThanOrEqual(s.resolucao! + 1e-6);
      }
      for (let i = 1; i < agenda.length; i++) {
        expect(agenda[i]!.inicio).toBeGreaterThanOrEqual(agenda[i - 1]!.inicio + dur(falas2)(agenda[i - 1]!.id) - 1e-9);
      }
      expect(esticado.duracao).toBeGreaterThanOrEqual(base.duracao);
    }
  });

  it('não estica o que já cabe', () => {
    const base = roteiro(42);
    const falas = montarNarracao(base);
    const minimos = exigenciasDaNarracao(base, falas, () => 0.1);
    const e = { mandante: esc('CAP', 72), visitante: esc('ONC', 68) };
    const igual = new Roteiro(new Timeline(simularPartida({ ...e, seed: 42, fase: 'LIGA' }), e), { minimos });
    expect(igual.duracao).toBeCloseTo(base.duracao, 6);
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
