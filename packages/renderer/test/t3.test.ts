import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type PerfilDoJuiz, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida, type ResultadoPartida } from '@liga/sim';
import { DURACAO_JOGO, Timeline, ehT3 } from '../src/timeline.js';
import { Roteiro, CAMERA_LENTA_DO_GOL_DE_PLACA } from '../src/roteiro.js';
import { montarNarracao } from '../src/narracao.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr: 70, habilidades: habilidadesDoPerfil(posicao, 70) })),
});
const entrada = (seed: number) => ({ mandante: esc('CAP'), visitante: esc('ONC'), seed, fase: 'LIGA' as const, t2: { postura: { mandante: 'OFENSIVA' as const, visitante: 'EQUILIBRADA' as const } } });
const t3 = (seed: number, juiz: PerfilDoJuiz = 'NORMAL') => simularPartida({ ...entrada(seed), t3: { juiz } });
const achar = (f: (r: ResultadoPartida) => boolean, juiz: PerfilDoJuiz = 'NORMAL') => {
  for (let s = 1; s < 3000; s++) {
    const r = t3(s, juiz);
    if (f(r)) return r;
  }
  throw new Error('nenhuma Partida');
};

describe('Partida com as regras da Temporada 3 (ADR-0094)', () => {
  it('é reconhecida pelo Juiz guardado', () => {
    expect(ehT3(simularPartida(entrada(7)))).toBe(false);
    expect(ehT3(t3(7))).toBe(true);
  });

  it('o estilo "chute de longe" só aparece no Chute de longe de verdade; na T2, continua sorteado', () => {
    for (let s = 1; s <= 30; s++) {
      const r = t3(s);
      const tl = new Timeline(r, { mandante: esc('CAP'), visitante: esc('ONC') });
      r.lances.forEach((l, i) => {
        if (tl.planos[i]!.estilo === 'CHUTE_DE_LONGE') expect(l.chuteDeLonge).toBe(true);
        if (l.chuteDeLonge) expect(tl.planos[i]!.estilo).toBe('CHUTE_DE_LONGE');
      });
    }
    const antigos = Array.from({ length: 30 }, (_, s) => simularPartida(entrada(s + 1)));
    const estilos = antigos.flatMap((r) => new Timeline(r, { mandante: esc('CAP'), visitante: esc('ONC') }).planos.map((p) => p.estilo));
    expect(estilos).toContain('CHUTE_DE_LONGE');
  });

  it('o Rebote começa com a bola parada onde a defesa a deixou', () => {
    const r = achar((x) => x.lances.some((l) => l.rebote && l.tipo === 'GOL'));
    const tl = new Timeline(r, { mandante: esc('CAP'), visitante: esc('ONC') });
    const i = r.lances.findIndex((l) => l.rebote && l.tipo === 'GOL');
    const defesa = tl.planos[i - 1]!;
    const rebote = tl.planos[i]!;
    expect(rebote.estilo).toBe('REBOTE');
    const fimDaDefesa = defesa.bola[defesa.bola.length - 1]!;
    const inicioDoRebote = rebote.bola[0]!;
    expect(fimDaDefesa.tipo).toBe('PARADA');
    expect(inicioDoRebote.tipo).toBe('PARADA');
    if (fimDaDefesa.tipo === 'PARADA' && inicioDoRebote.tipo === 'PARADA') expect(inicioDoRebote.ponto).toEqual(fimDaDefesa.ponto);
  });

  it('o relógio chega aos 90 no começo dos Acréscimos e mostra 90+n com a placa levantada', () => {
    const r = t3(11);
    const tl = new Timeline(r, { mandante: esc('CAP'), visitante: esc('ONC') });
    const ini = tl.inicioDosAcrescimos!;
    expect(ini).toBeGreaterThan(80 * 60);
    expect(tl.estado(ini - 30).acrescimo).toBeUndefined();
    const dentro = tl.estado(ini + 5);
    expect(dentro.minuto).toBe(90);
    expect(dentro.acrescimo).toBe(1);
    expect(dentro.placaDosAcrescimos?.minutos).toBe(r.acrescimos);
    expect(tl.estado(DURACAO_JOGO - 1).acrescimo).toBe(r.acrescimos);
  });

  it('a placa do Juiz aparece no começo, com o Perfil dele', () => {
    const tl = new Timeline(t3(3, 'RIGOROSO'), { mandante: esc('CAP'), visitante: esc('ONC') });
    expect(tl.estado(5).placaDoJuiz?.perfil).toBe('RIGOROSO');
    expect(tl.estado(200).placaDoJuiz).toBeUndefined();
  });

  it('Narrador: Juiz na abertura, Trave, Rebote, Gol de placa e Acréscimos', () => {
    const r = achar((x) => x.lances.some((l) => l.golDePlaca) && x.lances.some((l) => l.rebote && l.tipo === 'GOL'), 'DEIXA_JOGAR');
    const tl = new Timeline(r, { mandante: esc('CAP'), visitante: esc('ONC') });
    const falas = montarNarracao(new Roteiro(tl));
    const texto = falas.map((f) => f.texto).join(' | ');
    expect(falas[0]!.texto).toContain('deixa o jogo correr');
    expect(texto).toMatch(/Gol de placa|Que pintura/);
    expect(texto).toMatch(/rebote|sobra/i);
    // O Gol de placa nunca vem com a fala de Goleada se o placar não for de Goleada.
    const i = falas.findIndex((f) => /Gol de placa|Que pintura/.test(f.texto));
    expect(falas[i + 1]!.texto).not.toMatch(/[Gg]oleada/);
    const comTrave = achar((x) => x.lances.some((l) => l.trave));
    const tlT = new Timeline(comTrave, { mandante: esc('CAP'), visitante: esc('ONC') });
    const aoVivo = montarNarracao(new Roteiro(tlT, { duracaoLance: { DESARME: 3 }, duracaoMaxima: 10_000, bolasParadas: true }), undefined, { aoVivo: true });
    expect(aoVivo.map((f) => f.texto).join(' ')).toMatch(/trave|poste|ferro/i);
  });

  it('no Reels o Gol de placa passa em câmera lenta e o Rebote vem junto com a defesa', () => {
    const r = achar((x) => x.lances.some((l) => l.golDePlaca) && x.lances.some((l) => l.rebote && l.tipo === 'GOL'));
    const ro = new Roteiro(new Timeline(r, { mandante: esc('CAP'), visitante: esc('ONC') }));
    const placa = ro.segmentos.find((s) => s.tipo === 'LANCE' && r.lances[s.lance!]!.golDePlaca)!;
    expect(placa.resolucao! - placa.inicio).toBeGreaterThan(8 * 0.55 * (CAMERA_LENTA_DO_GOL_DE_PLACA - 0.1));
    const rebote = ro.segmentos.find((s) => s.tipo === 'LANCE' && r.lances[s.lance!]!.rebote)!;
    expect(ro.segmentos.some((s) => s.lance === rebote.lance! - 1)).toBe(false);
  });
});
