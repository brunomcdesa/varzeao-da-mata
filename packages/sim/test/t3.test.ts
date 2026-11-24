import { describe, expect, it } from 'vitest';
import { perfilDoJuiz, type PerfilDoJuiz } from '@liga/shared';
import { simularPartida } from '../src/partida.js';
import { PARAMETROS_T3, VERSAO_SIM, VERSAO_SIM_T3 } from '../src/parametros.js';
import type { EntradaPartida, Lance, ResultadoPartida } from '../src/tipos.js';
import { escalacao } from './fabricas.js';

const neutra = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const;
const a = escalacao('CAP', 70);
const b = escalacao('ONC', 70, 'R');

function entrada(seed: number, o: { juiz?: PerfilDoJuiz; fase?: 'LIGA' | 'MATA_MATA'; t3?: boolean; batedores?: Partial<Record<'mandante' | 'visitante', readonly string[]>> } = {}): EntradaPartida {
  return {
    mandante: a,
    visitante: b,
    seed,
    fase: o.fase ?? 'LIGA',
    t2: neutra,
    ...(o.t3 === false ? {} : { t3: { juiz: o.juiz ?? 'NORMAL', ...(o.batedores ? { batedores: o.batedores } : {}) } }),
  };
}

const varias = (n: number, o: Parameters<typeof entrada>[1] = {}): ResultadoPartida[] => Array.from({ length: n }, (_, i) => simularPartida(entrada(i + 1, o)));
const todos = (rs: ResultadoPartida[]): Lance[] => rs.flatMap((r) => r.lances);
const media = (rs: ResultadoPartida[], f: (r: ResultadoPartida) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;

describe('Temporada 3: novidades de campo (ADR-0094)', () => {
  const t3 = varias(1500);
  const t2 = varias(1500, { t3: false });

  it('sem `t3` a Partida continua na versão da T2; com ela, na VERSAO_SIM_T3, com Juiz e Acréscimos', () => {
    expect(t2[0]!.versaoSim).toBe(VERSAO_SIM);
    expect(t2[0]!.juiz).toBeUndefined();
    expect(t3[0]!.versaoSim).toBe(VERSAO_SIM_T3);
    for (const r of t3.slice(0, 200)) {
      expect(r.juiz).toBe('NORMAL');
      expect(r.acrescimos).toBeGreaterThanOrEqual(1);
      expect(r.acrescimos).toBeLessThanOrEqual(PARAMETROS_T3.acrescimosMaximo);
    }
  });

  it('é determinística: mesma entrada, mesmo resultado', () => {
    expect(simularPartida(entrada(42))).toEqual(simularPartida(entrada(42)));
  });

  it('mantém a média de gols da T2 (calibração)', () => {
    const g = (r: ResultadoPartida) => r.gols.mandante + r.gols.visitante;
    expect(Math.abs(media(t3, g) - media(t2, g))).toBeLessThan(0.2);
  });

  it('Trave só em chute para fora, e não muda o placar', () => {
    const traves = todos(t3).filter((l) => l.trave);
    expect(traves.length).toBeGreaterThan(100);
    expect(traves.every((l) => l.tipo === 'FORA')).toBe(true);
    for (const r of t3.slice(0, 300)) {
      const gols = r.lances.filter((l) => l.tipo === 'GOL');
      expect(gols.filter((l) => l.ataque === 'mandante').length).toBe(r.gols.mandante);
    }
  });

  it('Rebote vem logo depois de uma defesa do goleiro, com um atacante na sobra', () => {
    const lances = t3.flatMap((r) => r.lances.map((l, i) => ({ l, antes: r.lances[i - 1], r })));
    const rebotes = lances.filter((x) => x.l.rebote);
    expect(rebotes.length).toBeGreaterThan(500);
    expect(rebotes.some((x) => x.l.tipo === 'GOL')).toBe(true);
    for (const { l, antes } of rebotes) {
      expect(antes?.tipo).toBe('DEFESA');
      expect(antes?.ataque).toBe(l.ataque);
      expect(l.marcador).toBeDefined();
      // A bola está solta na área: o Rebote nunca começa com lateral.
      expect(l.bolaParada).toBeUndefined();
    }
  });

  it('Chute de longe é de um meia ou de um zagueiro, e só o improvável vira Gol de placa', () => {
    const longe = t3.flatMap((r) => r.lances.filter((l) => l.chuteDeLonge).map((l) => ({ l, r })));
    expect(longe.length).toBeGreaterThan(500);
    const posicao = (r: ResultadoPartida, l: Lance) => (l.ataque === 'mandante' ? a : b).jogadores[l.finalizador!.indice]!.posicao;
    expect(longe.every(({ l, r }) => ['MEI', 'ZAG'].includes(posicao(r, l)))).toBe(true);
    expect(longe.some(({ l, r }) => posicao(r, l) === 'ZAG')).toBe(true);
    expect(longe.filter(({ l }) => l.golDePlaca).every(({ l }) => l.tipo === 'GOL')).toBe(true);
  });

  it('Gol de placa é raro e só em gol', () => {
    const placas = todos(t3).filter((l) => l.golDePlaca);
    expect(placas.every((l) => l.tipo === 'GOL')).toBe(true);
    expect(placas.length / t3.length).toBeGreaterThan(0.05);
    expect(placas.length / t3.length).toBeLessThan(0.35);
  });

  it('Pressão final: só depois dos 75 minutos, e só de quem perdia por 1 ou 2', () => {
    let vistos = 0;
    for (const r of t3) {
      const placar = { mandante: 0, visitante: 0 };
      let minutoAntes = 0;
      let placarNoLance = { ...placar };
      for (const l of r.lances) {
        if (l.minuto !== minutoAntes) placarNoLance = { ...placar };
        minutoAntes = l.minuto;
        if (l.pressao) {
          vistos++;
          expect(l.minuto).toBeGreaterThan(PARAMETROS_T3.pressaoDesde);
          const outro = l.ataque === 'mandante' ? 'visitante' : 'mandante';
          const deficit = placarNoLance[outro] - placarNoLance[l.ataque];
          expect(deficit).toBeGreaterThanOrEqual(0);
          expect(deficit).toBeLessThanOrEqual(PARAMETROS_T3.pressaoDeficitMaximo);
        }
        if (l.tipo === 'GOL') placar[l.ataque]++;
      }
    }
    expect(vistos).toBeGreaterThan(500);
    expect(todos(t2).some((l) => l.pressao)).toBe(false);
  });

  it('no Mata-mata, quem está empatado também se lança', () => {
    const rs = varias(400, { fase: 'MATA_MATA' });
    const empatadosPressionando = rs.some((r) => {
      let m = 0, v = 0;
      return r.lances.some((l) => {
        const empatado = m === v;
        if (l.tipo === 'GOL') l.ataque === 'mandante' ? m++ : v++;
        return l.pressao && empatado;
      });
    });
    expect(empatadosPressionando).toBe(true);
  });

  it('Acréscimos: os lances deles ficam no minuto 90, com o minuto a mais', () => {
    for (const r of t3.slice(0, 400)) {
      const acr = r.lances.filter((l) => l.acrescimo);
      for (const l of acr) {
        expect(l.minuto).toBe(90);
        expect(l.acrescimo).toBeGreaterThanOrEqual(1);
        expect(l.acrescimo).toBeLessThanOrEqual(r.acrescimos!);
      }
      // Os lances dos Acréscimos são os últimos da Partida.
      const primeiro = r.lances.findIndex((l) => l.acrescimo);
      if (primeiro >= 0) expect(r.lances.slice(primeiro).every((l) => l.acrescimo)).toBe(true);
    }
  });

  it('Perfil do Juiz: o Rigoroso marca mais Faltas e Cartões que o Deixa jogar', () => {
    const conta = (rs: ResultadoPartida[], f: (l: Lance) => boolean) => todos(rs).filter(f).length;
    const rigoroso = varias(800, { juiz: 'RIGOROSO' });
    const deixa = varias(800, { juiz: 'DEIXA_JOGAR' });
    expect(conta(rigoroso, (l) => l.tipo === 'FALTA')).toBeGreaterThan(conta(deixa, (l) => l.tipo === 'FALTA') * 1.5);
    expect(conta(rigoroso, (l) => !!l.falta?.cartao)).toBeGreaterThan(conta(deixa, (l) => !!l.falta?.cartao) * 2.5);
    expect(rigoroso[0]!.juiz).toBe('RIGOROSO');
  });

  it('o Perfil do Juiz sai do id da Partida, sempre o mesmo, com os três aparecendo', () => {
    expect(perfilDoJuiz(123)).toBe(perfilDoJuiz(123));
    const perfis = new Set(Array.from({ length: 50 }, (_, i) => perfilDoJuiz(i + 1)));
    expect(perfis).toEqual(new Set(['RIGOROSO', 'NORMAL', 'DEIXA_JOGAR']));
  });
});

describe('Batedores escolhidos pelo Capitão (ADR-0091)', () => {
  const comPenaltis = (o: Parameters<typeof entrada>[1]) => {
    for (let seed = 1; seed < 2000; seed++) {
      const r = simularPartida(entrada(seed, { fase: 'MATA_MATA', ...o }));
      if (r.penaltis) return r;
    }
    throw new Error('nenhuma Disputa de pênaltis');
  };
  const quemBateu = (r: ResultadoPartida, lado: 'mandante' | 'visitante') =>
    r.penaltis!.cobrancas.filter((c) => c.lado === lado).map((c) => (lado === 'mandante' ? a : b).jogadores[c.cobrador.indice]!.jogadorId);

  it('a ordem escolhida vem primeiro', () => {
    const r = comPenaltis({ batedores: { mandante: ['CAP-0', 'CAP-1', 'CAP-2'] } });
    expect(quemBateu(r, 'mandante').slice(0, 3)).toEqual(['CAP-0', 'CAP-1', 'CAP-2']);
  });

  it('quem não está em campo é pulado, e ninguém bate duas vezes antes de todos baterem', () => {
    const r = comPenaltis({ batedores: { mandante: ['NAO-EXISTE', 'CAP-6', 'CAP-6', 'CAP-3'] } });
    const ordem = quemBateu(r, 'mandante');
    expect(ordem[0]).toBe('CAP-6');
    expect(ordem[1]).toBe('CAP-3');
    const primeiros = ordem.slice(0, 5);
    expect(new Set(primeiros).size).toBe(primeiros.length);
  });

  it('sem escolha, vale a ordem automática (ATA, ATA, MEI, MEI, ZAG)', () => {
    const r = comPenaltis({});
    expect(quemBateu(r, 'visitante').slice(0, 2)).toEqual(['R-5', 'R-6']);
  });
});

describe('Capitão em campo (ADR-0107)', () => {
  const com = (seed: number, t3: Omit<NonNullable<EntradaPartida['t3']>, 'juiz'>) => simularPartida({ ...entrada(seed), t3: { juiz: 'NORMAL', ...t3 } });
  const id = (r: ResultadoPartida, s: { lado: 'mandante' | 'visitante'; indice: number }) => (s.lado === 'mandante' ? a : b).jogadores[s.indice]!.jogadorId;

  it('o escanteio é do cobrador escolhido; fora de campo, vale o reserva', () => {
    const rs = Array.from({ length: 400 }, (_, i) => com(i + 1, { escanteio: { mandante: ['NAO-EXISTE', 'CAP-6'] } }));
    const cobrancas = rs.flatMap((r) => r.lances.filter((l) => l.bolaParada === 'ESCANTEIO' && l.ataque === 'mandante').map((l) => id(r, l.criador)));
    expect(cobrancas.length).toBeGreaterThan(20);
    expect(new Set(cobrancas)).toEqual(new Set(['CAP-6']));
  });

  it('o pênalti no jogo é do primeiro Batedor em campo', () => {
    const rs = Array.from({ length: 1500 }, (_, i) => com(i + 1, { batedores: { mandante: ['CAP-1', 'CAP-3'] } }));
    const cobradores = rs.flatMap((r) => r.lances.filter((l) => l.bolaParada === 'PENALTI' && l.ataque === 'mandante').map((l) => id(r, l.criador)));
    // Se o 1º foi expulso, bate o 2º Batedor.
    expect(cobradores.length).toBeGreaterThan(50);
    expect(cobradores.filter((c) => c === 'CAP-1').length).toBeGreaterThan(cobradores.length * 0.95);
    expect(cobradores.every((c) => c === 'CAP-1' || c === 'CAP-3')).toBe(true);
  });

  it('a Marcação individual tira gols do alvo e dá mais faltas ao marcador', () => {
    const n = 1500;
    const marcacao = { marcador: 'R-1', alvo: 'CAP-5' };
    const sem = Array.from({ length: n }, (_, i) => com(i + 1, {}));
    const comM = Array.from({ length: n }, (_, i) => com(i + 1, { marcacao: { visitante: marcacao } }));
    const golsDoAlvo = (rs: ResultadoPartida[]) => rs.reduce((s, r) => s + r.lances.filter((l) => l.tipo === 'GOL' && l.finalizador && id(r, l.finalizador) === 'CAP-5').length, 0);
    const faltasDoMarcador = (rs: ResultadoPartida[]) => rs.reduce((s, r) => s + r.lances.filter((l) => l.falta && id(r, l.falta.autor) === 'R-1').length, 0);
    expect(golsDoAlvo(comM)).toBeLessThan(golsDoAlvo(sem) * 0.99);
    expect(faltasDoMarcador(comM)).toBeGreaterThan(faltasDoMarcador(sem) * 1.05);
  });

  it('marcador ou alvo fora de campo: a Partida sai igual a sem Marcação', () => {
    expect(com(7, { marcacao: { visitante: { marcador: 'R-1', alvo: 'NAO-EXISTE' } } })).toEqual(com(7, {}));
  });
});
