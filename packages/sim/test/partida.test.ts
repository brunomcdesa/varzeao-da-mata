import { describe, expect, it } from 'vitest';
import {
  HABILIDADES,
  HABILIDADE_MAX,
  LIMITE_DELTA_HABILIDADE,
  LIMITE_DELTA_HABILIDADE_CLASSICO,
  ovrDasHabilidades,
  habilidadesDoPerfil,
} from '@liga/shared';
import { simularPartida, chanceDeFora, chanceDeDriblar, ritmoDaPartida } from '../src/partida.js';
import { notaDaPartida } from '../src/nota.js';
import { evoluir, fatorDeGanho, fatorDePerda, zeradas } from '../src/evolucao.js';
import { escalacao } from './fabricas.js';

const base = { fase: 'LIGA' as const };

describe('determinismo (ADR-0002)', () => {
  it('mesma entrada e mesmo seed geram exatamente o mesmo resultado', () => {
    const entrada = { ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 68), seed: 123 };
    expect(simularPartida(entrada)).toEqual(simularPartida(entrada));
  });

  it('seeds diferentes geram partidas diferentes', () => {
    const e = { ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70) };
    const resultados = new Set(
      [1, 2, 3, 4, 5].map((seed) => JSON.stringify(simularPartida({ ...e, seed }).lances)),
    );
    expect(resultados.size).toBe(5);
  });
});

describe('validação da Escalação', () => {
  it('recusa Escalação sem goleiro', () => {
    const semGoleiro = escalacao('CAP', 70);
    const jogadores = semGoleiro.jogadores.map((j) => (j.posicao === 'GOL' ? { ...j, posicao: 'ZAG' as const } : j));
    expect(() =>
      simularPartida({ ...base, mandante: { ...semGoleiro, jogadores }, visitante: escalacao('TAT', 70), seed: 1 }),
    ).toThrow(/GOL/);
  });

});

describe('placar e lances', () => {
  it('o placar bate com os lances de GOL e com os gols dos Jogadores', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('ARA', 72), visitante: escalacao('TUC', 66), seed });
      for (const lado of ['mandante', 'visitante'] as const) {
        const golsLances = r.lances.filter((l) => l.tipo === 'GOL' && l.ataque === lado).length;
        const golsJogadores = r.desempenhos.filter((d) => d.slot.lado === lado).reduce((s, d) => s + d.gols, 0);
        expect(golsLances).toBe(r.gols[lado]);
        expect(golsJogadores).toBe(r.gols[lado]);
      }
    }
  });

  it('marca Clássico só entre rivais fixos', () => {
    const r1 = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70), seed: 1 });
    const r2 = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70), seed: 1 });
    expect(r1.classico).toBe(true);
    expect(r2.classico).toBe(false);
  });
});

describe('Mata-mata', () => {
  it('empate vai para os pênaltis e sempre tem vencedor', () => {
    let disputas = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const r = simularPartida({ mandante: escalacao('PRE', 70), visitante: escalacao('SAG', 70), seed, fase: 'MATA_MATA' });
      expect(r.vencedor).not.toBeNull();
      if (r.penaltis) {
        disputas++;
        const { placar } = r.penaltis;
        expect(placar.mandante).not.toBe(placar.visitante);
        expect(r.decisivo).not.toBeNull();
        for (const c of r.penaltis.cobrancas) expect(c.convertida ? c.defendida : typeof c.defendida).toBe(c.convertida ? undefined : 'boolean');
      }
    }
    expect(disputas).toBeGreaterThan(0);
  });
});

describe('Habilidades (ADR-0010)', () => {
  it('o perfil acerta o OVR pedido em todas as Posições', () => {
    for (const p of ['GOL', 'ZAG', 'MEI', 'ATA'] as const) {
      for (const ovr of [45, 55, 62, 70, 88]) expect(ovrDasHabilidades(p, habilidadesDoPerfil(p, ovr, { FIN: 1, DRI: -1, PAS: 0.5 }))).toBe(ovr);
    }
  });

  it('nenhuma Habilidade muda mais que ±2 por Partida (±4 em Clássico)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const normal = simularPartida({ ...base, mandante: escalacao('CAP', 60), visitante: escalacao('TAT', 80), seed });
      const classico = simularPartida({ ...base, mandante: escalacao('CAP', 60), visitante: escalacao('ONC', 80), seed });
      for (const d of normal.desempenhos) for (const h of HABILIDADES) expect(Math.abs(d.deltaHabilidades[h])).toBeLessThanOrEqual(LIMITE_DELTA_HABILIDADE);
      for (const d of classico.desempenhos) for (const h of HABILIDADES) expect(Math.abs(d.deltaHabilidades[h])).toBeLessThanOrEqual(LIMITE_DELTA_HABILIDADE_CLASSICO);
    }
  });

  it('o OVR depois é o das Habilidades depois', () => {
    const r = simularPartida({ ...base, mandante: escalacao('CAP', 66), visitante: escalacao('TAT', 64), seed: 9 });
    for (const d of r.desempenhos) {
      expect(d.ovrDepois).toBe(ovrDasHabilidades(d.posicao, d.habilidadesDepois));
      expect(d.deltaOvr).toBe(d.ovrDepois - d.ovrAntes);
    }
  });

  it('Clássico conta as ações em dobro', () => {
    const antes = habilidadesDoPerfil('ATA', 60);
    const pontos = { ...zeradas(), FIN: 0.7 };
    const normal = evoluir(antes, pontos, false).delta.FIN;
    expect(evoluir(antes, pontos, true).delta.FIN).toBeCloseTo(normal * 2, 1);
  });

  it('ritmo: alto sobe devagar, baixo desce devagar', () => {
    expect(fatorDeGanho(95)).toBeLessThan(fatorDeGanho(60));
    expect(fatorDePerda(42)).toBeLessThan(fatorDePerda(70));
  });

  it('gol mexe na Finalização; desarme na Defesa; defesa no Goleiro', () => {
    let fin = 0, def = 0, gol = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('CAP', 65), visitante: escalacao('TAT', 65), seed });
      for (const d of r.desempenhos) {
        if (d.gols >= 2 && d.posicao === 'ATA') fin += Math.sign(d.deltaHabilidades.FIN);
        if (d.desarmes >= 3 && d.posicao === 'ZAG' && d.golsSofridos === 0) def += Math.sign(d.deltaHabilidades.DEF);
        if (d.defesas >= 3 && d.golsSofridos === 0) gol += Math.sign(d.deltaHabilidades.GOL);
      }
    }
    expect(fin).toBeGreaterThan(0);
    expect(def).toBeGreaterThan(0);
    expect(gol).toBeGreaterThan(0);
  });

  it('BLOQUEIO e drible aparecem nos lances, sempre com o marcador', () => {
    const tipos = new Set<string>();
    let dribles = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70), seed });
      for (const l of r.lances) {
        tipos.add(l.tipo);
        if (l.tipo === 'BLOQUEIO') expect(l.defensor).toEqual(l.marcador);
        if (l.drible && l.tipo !== 'DESARME') dribles++;
      }
    }
    expect(tipos).toContain('BLOQUEIO');
    expect(dribles).toBeGreaterThan(0);
  });

  it('quem finaliza melhor chuta pra fora menos; quem dribla melhor tenta mais o drible', () => {
    expect(chanceDeFora(90)).toBeCloseTo(0.22);
    expect(chanceDeFora(50)).toBeCloseTo(0.35);
    expect(chanceDeDriblar(80, 60)).toBeGreaterThan(0.5);
  });

  it('a mesma atuação vale mais Nota para quem tem OVR baixo (nota relativa)', () => {
    const atuacao = { posicao: 'ATA' as const, gols: 1, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0, resultado: 'empate' as const };
    expect(notaDaPartida(atuacao, 50)).toBeGreaterThan(notaDaPartida(atuacao, 90));
  });

  it('Jogador da Base não evolui', () => {
    const comBase = escalacao('CAP', 70);
    const jogadores = comBase.jogadores.map((j, i) => (i === 6 ? { ...j, jogadorId: null, ovr: 55, habilidades: habilidadesDoPerfil('ATA', 55) } : j));
    for (let seed = 1; seed <= 50; seed++) {
      const r = simularPartida({ ...base, mandante: { ...comBase, jogadores }, visitante: escalacao('TAT', 70), seed });
      const daBase = r.desempenhos.find((d) => d.jogadorId === null)!;
      expect(daBase.habilidadesDepois).toEqual(daBase.habilidadesAntes);
      expect(daBase.deltaOvr).toBe(0);
    }
  });

  it('Habilidade nunca passa de 99', () => {
    const r = simularPartida({ ...base, mandante: escalacao('CAP', 97), visitante: escalacao('TAT', 40), seed: 7 });
    for (const d of r.desempenhos) for (const h of HABILIDADES) expect(d.habilidadesDepois[h]).toBeLessThanOrEqual(HABILIDADE_MAX);
  });
});

describe('calibração', () => {
  const N = 4000;
  const taxaDoForte = (forte: number, fraco: number) => {
    let vitorias = 0;
    for (let seed = 1; seed <= N; seed++) {
      const emCasa = seed % 2 === 0;
      const r = simularPartida({
        ...base,
        mandante: escalacao(emCasa ? 'CAP' : 'TAT', emCasa ? forte : fraco),
        visitante: escalacao(emCasa ? 'TAT' : 'CAP', emCasa ? fraco : forte),
        seed,
      });
      if (r.vencedor === (emCasa ? 'mandante' : 'visitante')) vitorias++;
    }
    return vitorias / N;
  };

  it('gols por jogo ficam perto de 3,8 (3,5 dos lances + os de escanteio)', () => {
    let gols = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70), seed });
      gols += r.gols.mandante + r.gols.visitante;
    }
    expect(gols / N).toBeGreaterThan(3.5);
    expect(gols / N).toBeLessThan(4.1);
  });

  it('time bem mais forte (+15 de OVR) vence por volta de 60–65% das vezes', () => {
    const taxa = taxaDoForte(80, 65);
    expect(taxa).toBeGreaterThan(0.58);
    expect(taxa).toBeLessThan(0.7);
  });

  it('zebra existe: mesmo +25 de OVR perde de vez em quando', () => {
    expect(taxaDoForte(85, 60)).toBeLessThan(0.85);
  });
});

describe('bolas paradas (VERSAO_SIM 3)', () => {
  it('escanteio só depois de defesa ou bloqueio, do mesmo time; lateral nunca no primeiro lance nem depois de gol', () => {
    let escanteios = 0;
    let laterais = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const esc = { mandante: escalacao('CAP', 68), visitante: escalacao('TAT', 68) };
      const r = simularPartida({ ...base, ...esc, seed });
      r.lances.forEach((l, i) => {
        expect(l.numero).toBe(i + 1);
        if (l.bolaParada === 'ESCANTEIO') {
          escanteios++;
          const antes = r.lances[i - 1]!;
          expect(['DEFESA', 'BLOQUEIO']).toContain(antes.tipo);
          expect(antes.ataque).toBe(l.ataque);
          expect(['ATA', 'ZAG']).toContain(esc[l.finalizador!.lado].jogadores[l.finalizador!.indice]!.posicao);
          expect(esc[l.criador.lado].jogadores[l.criador.indice]!.posicao).toBe('MEI');
        }
        if (l.bolaParada === 'LATERAL') {
          laterais++;
          expect(i).toBeGreaterThan(0);
          expect(r.lances[i - 1]!.tipo).not.toBe('GOL');
          expect(l.cobrador).toBeDefined();
        }
      });
      // Os gols do placar batem com os lances de GOL (inclusive os de escanteio).
      const golsNosLances = r.lances.filter((l) => l.tipo === 'GOL').length;
      expect(golsNosLances).toBe(r.gols.mandante + r.gols.visitante);
    }
    expect(escanteios / 300).toBeGreaterThan(1);
    expect(laterais / 300).toBeGreaterThan(3.5);
    expect(laterais / 300).toBeLessThan(6.5);
  });
});

describe('contra-ataque (VERSAO_SIM 4)', () => {
  it('só logo depois de o rival perder a bola (desarme ou defesa); sem recompor, o 1º zagueiro some do lance', () => {
    let contras = 0;
    let naoRecompostos = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const esc = { mandante: escalacao('CAP', 68), visitante: escalacao('TAT', 68) };
      const r = simularPartida({ ...base, ...esc, seed });
      r.lances.forEach((l, i) => {
        if (!l.contraAtaque) return;
        contras++;
        const antes = r.lances[i - 1]!;
        expect(['DESARME', 'DEFESA']).toContain(antes.tipo);
        expect(antes.ataque).not.toBe(l.ataque);
        expect(l.contraAtaque.adiantados).toBe(antes.bolaParada === 'ESCANTEIO' ? 6 : l.contraAtaque.adiantados);
        if (!l.contraAtaque.recomposto) {
          naoRecompostos++;
          // O 1º zagueiro ficou para trás: não há desarme na criação.
          expect(l.tipo === 'DESARME' && !l.finalizador).toBe(false);
          if (l.contraAtaque.adiantados >= 5) expect(l.marcador).toBeUndefined();
        }
      });
    }
    expect(contras / 300).toBeGreaterThan(1.5);
    expect(contras / 300).toBeLessThan(3.5);
    expect(naoRecompostos).toBeGreaterThan(0);
  });
});

describe('Ritmo da Partida (ADR-0016)', () => {
  it('fica entre 6 e 34 lances, em sino com média perto de 20, e é o mesmo para o mesmo seed', () => {
    const ritmos = Array.from({ length: 5000 }, (_, i) => ritmoDaPartida(i + 1));
    expect(Math.min(...ritmos)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...ritmos)).toBeLessThanOrEqual(34);
    const media = ritmos.reduce((s, n) => s + n, 0) / ritmos.length;
    expect(media).toBeGreaterThan(19);
    expect(media).toBeLessThan(21);
    // Os extremos são raros: mais jogos perto do meio que nas pontas.
    expect(ritmos.filter((n) => n >= 16 && n <= 24).length).toBeGreaterThan(ritmos.filter((n) => n <= 10 || n >= 30).length * 2);
    expect(ritmoDaPartida(42)).toBe(ritmoDaPartida(42));
  });

  it('a Partida tem tantos lances de ataque quanto o Ritmo, distribuídos nos 90 minutos', () => {
    for (const seed of [1, 7, 99, 1234]) {
      const r = simularPartida({ mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70), seed, fase: 'LIGA' });
      const ataques = r.lances.filter((l) => l.bolaParada !== 'ESCANTEIO');
      expect(ataques).toHaveLength(ritmoDaPartida(seed));
      expect(Math.max(...r.lances.map((l) => l.minuto))).toBeLessThanOrEqual(90);
    }
  });

  it('a expectativa da Nota acompanha o Ritmo: as mesmas ações valem mais num jogo travado', () => {
    const acoes = { posicao: 'ATA' as const, gols: 1, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0, dribles: 1, bloqueios: 0, resultado: 'EMPATE' as const };
    const travado = notaDaPartida(acoes as never, 70, 8 / 20);
    const normal = notaDaPartida(acoes as never, 70, 1);
    const aberto = notaDaPartida(acoes as never, 70, 32 / 20);
    expect(travado).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(aberto);
  });
});
