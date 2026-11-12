import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ehGoleada,
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
import { escalacao, escalacaoNa } from './fabricas.js';
import { FORMACOES, type Formacao } from '@liga/shared';
import { validarEscalacao } from '../src/partida.js';
import { confronto } from '../scripts/formacoes.js';
import type { SlotRef } from '../src/tipos.js';

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
    expect(chanceDeFora(90)).toBeCloseTo(0.25);
    expect(chanceDeFora(50)).toBeCloseTo(0.38);
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

  it('gols por jogo ficam perto de 3,1 (ADR-0027)', () => {
    let gols = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70), seed });
      gols += r.gols.mandante + r.gols.visitante;
    }
    expect(gols / N).toBeGreaterThan(2.8);
    expect(gols / N).toBeLessThan(3.4);
  });

  it('time bem mais forte (+15 de OVR) vence por volta de 82–87% das vezes (ADR-0035)', () => {
    const taxa = taxaDoForte(80, 65);
    expect(taxa).toBeGreaterThan(0.8);
    expect(taxa).toBeLessThan(0.89);
  });

  it('diferença pequena (+4 de OVR) ainda deixa o jogo aberto: o mais forte vence menos de 60%', () => {
    const taxa = taxaDoForte(72, 68);
    expect(taxa).toBeGreaterThan(0.45);
    expect(taxa).toBeLessThan(0.6);
  });

  it('zebra existe: +10 de OVR ainda perde ou empata mais de 20% das vezes', () => {
    expect(taxaDoForte(75, 65)).toBeLessThan(0.8);
  });

  it('trava de goleada (ADR-0035): mesmo com +15 de OVR, a Goleada fica abaixo de 35%', () => {
    let goleadas = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('CAP', 80), visitante: escalacao('TAT', 65), seed });
      if (ehGoleada(Math.max(r.gols.mandante, r.gols.visitante), Math.min(r.gols.mandante, r.gols.visitante))) goleadas++;
    }
    expect(goleadas / N).toBeLessThan(0.35);
  });

  it('Goleada entre times iguais é rara (~7%)', () => {
    let goleadas = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70), seed });
      if (ehGoleada(Math.max(r.gols.mandante, r.gols.visitante), Math.min(r.gols.mandante, r.gols.visitante))) goleadas++;
    }
    expect(goleadas / N).toBeLessThan(0.1);
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

describe('trava da Temporada 1', () => {
  it('sem as regras da T2, a simulação dá exatamente os resultados da VERSAO_SIM_T1 (12)', async () => {
    const { CASOS, impressao } = await import('./regressao-t1.js');
    const esperado = JSON.parse(readFileSync(new URL('./regressao-t1.json', import.meta.url), 'utf8')) as string[];
    expect(CASOS.map(impressao)).toEqual(esperado);
  });
});

describe('regras da Temporada 2 (VERSAO_SIM 13)', () => {
  const neutra = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const;
  /** `t2`: null joga com as regras da T1. */
  const jogo = (seed: number, t2: Parameters<typeof simularPartida>[0]['t2'] | null = neutra, a = escalacao('CAP', 70), b = escalacao('ONC', 70, 'R')) =>
    simularPartida({ mandante: a, visitante: b, seed, fase: 'LIGA', ...(t2 ? { t2 } : {}) });

  it('com as regras da T2 a Partida é da versão 13, guarda Postura e Ritmo e é determinística', () => {
    const r = jogo(11);
    expect(r.versaoSim).toBe(13);
    expect(r.postura).toEqual(neutra.postura);
    expect(r.ritmo).toBeGreaterThanOrEqual(6);
    expect(jogo(11)).toEqual(r);
    expect(jogo(11, null).versaoSim).toBe(12);
  });

  it('na T1, Especialização, Treino e Canto não mudam nada', () => {
    const a = escalacao('CAP', 70);
    const com = { ...a, jogadores: a.jogadores.map((j) => ({ ...j, especializacao: j.posicao === 'ATA' ? ('ARTILHEIRO' as const) : undefined, treino: 'FIN' as const, canto: 'ESQUERDA' as const })) };
    for (const seed of [3, 4, 5]) expect(jogo(seed, null, com as never)).toEqual(jogo(seed, null, a));
  });

  it('a falta para a jogada e vem logo a cobrança: pênalti com Canto, chute direto com Barreira, jogada ensaiada', () => {
    const vistos = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const r = jogo(seed);
      r.lances.forEach((l, i) => {
        if (l.tipo !== 'FALTA') return;
        const cobranca = r.lances[i + 1]!;
        expect(cobranca.ataque).toBe(l.ataque);
        const esperado = { AREA: ['PENALTI'], ENTRADA: ['FALTA_DIRETA'], LONGE: ['FALTA_CRUZADA', 'FALTA_CURTA'] }[l.falta!.local];
        expect(esperado).toContain(cobranca.bolaParada);
        vistos.add(cobranca.bolaParada!);
        if (cobranca.bolaParada === 'PENALTI') expect(cobranca.canto).toBeDefined();
        if (cobranca.bolaParada === 'FALTA_DIRETA') expect(cobranca.barreira!.length).toBe(2);
      });
    }
    expect([...vistos].sort()).toEqual(['FALTA_CRUZADA', 'FALTA_CURTA', 'FALTA_DIRETA', 'PENALTI']);
  });

  it('o expulso não aparece em mais nenhum lance, e dois amarelos na Partida viram vermelho', () => {
    let expulsoes = 0;
    let segundos = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const r = jogo(seed);
      r.lances.forEach((l, i) => {
        if (l.falta?.cartao !== 'VERMELHO') return;
        expulsoes++;
        if (l.falta.segundoAmarelo) segundos++;
        const autor = l.falta.autor;
        const mesmo = (s?: SlotRef) => s && s.lado === autor.lado && s.indice === autor.indice;
        for (const depois of r.lances.slice(i + 1)) {
          expect([depois.criador, depois.finalizador, depois.defensor, depois.marcador, depois.cobrador, ...(depois.barreira ?? [])].some(mesmo)).toBe(false);
        }
        const d = r.desempenhos.find((x) => x.slot.lado === autor.lado && x.slot.indice === autor.indice)!;
        expect(d.expulso).toBe(true);
      });
    }
    expect(expulsoes).toBeGreaterThan(0);
    expect(segundos).toBeGreaterThan(0);
  });

  it('o Canto escolhido vale: o goleiro que sempre acerta o canto pega mais pênaltis', () => {
    const chutaEsquerda = (e: ReturnType<typeof escalacao>) => ({ ...e, jogadores: e.jogadores.map((j) => ({ ...j, canto: 'ESQUERDA' as const })) });
    let acertou = 0;
    let errou = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const igual = jogo(seed, neutra, chutaEsquerda(escalacao('CAP', 70)), chutaEsquerda(escalacao('ONC', 70, 'R')));
      for (const l of igual.lances) if (l.bolaParada === 'PENALTI') l.tipo === 'GOL' ? errou++ : acertou++;
    }
    // Com o goleiro sempre no canto certo, metade ou mais dos pênaltis não entram.
    expect(acertou / (acertou + errou)).toBeGreaterThan(0.45);
  });

  it('a disputa de pênaltis da T2 usa o Canto', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = simularPartida({ mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70, 'R'), seed, fase: 'MATA_MATA', t2: neutra });
      if (!r.penaltis) continue;
      expect(r.penaltis.cobrancas.every((c) => c.canto)).toBe(true);
      return;
    }
    throw new Error('nenhuma disputa de pênaltis em 300 jogos');
  });

  it('Treino: a Habilidade de foco sobe mais que sem Treino', () => {
    const pontos = { FIN: 1, PAS: 1, DRI: 0, DEF: 0, GOL: 0 };
    const antes = { FIN: 60, PAS: 60, DRI: 60, DEF: 60, GOL: 60 };
    const sem = evoluir(antes, pontos, false);
    const com = evoluir(antes, pontos, false, { hab: 'FIN', multiplicador: 1.5 });
    expect(com.delta.FIN).toBeGreaterThan(sem.delta.FIN);
    expect(com.delta.PAS).toBe(sem.delta.PAS);
  });

  it('Postura: dois Times Ofensivos têm mais lances e mais gols que dois Defensivos', () => {
    let golsOf = 0;
    let golsDef = 0;
    for (let seed = 1; seed <= 800; seed++) {
      const of = jogo(seed, { postura: { mandante: 'OFENSIVA', visitante: 'OFENSIVA' } });
      const de = jogo(seed, { postura: { mandante: 'DEFENSIVA', visitante: 'DEFENSIVA' } });
      expect(of.ritmo).toBeGreaterThanOrEqual(de.ritmo!);
      golsOf += of.gols.mandante + of.gols.visitante;
      golsDef += de.gols.mandante + de.gols.visitante;
    }
    expect(golsOf).toBeGreaterThan(golsDef * 1.4);
  });
});

describe('Resenha (ADR-0034)', () => {
  it('evoluir: os ganhos valem 50% a mais e as perdas não mudam', () => {
    const antes = { FIN: 60, PAS: 60, DRI: 60, DEF: 60, GOL: 60 };
    const pontos = { ...zeradas(), FIN: 1, DRI: -1 };
    const sem = evoluir(antes, pontos, false);
    const com = evoluir(antes, pontos, false, undefined, 1.5);
    expect(sem.delta.FIN).toBe(1);
    expect(com.delta.FIN).toBe(1.5);
    expect(com.delta.DRI).toBe(sem.delta.DRI);
  });

  it('evoluir: com Treino, os dois bônus somam na Habilidade de foco e o teto por Partida continua', () => {
    const antes = { FIN: 60, PAS: 60, DRI: 60, DEF: 60, GOL: 60 };
    const treino = { hab: 'FIN' as const, multiplicador: 1.5 };
    const os2 = evoluir(antes, { ...zeradas(), FIN: 1, PAS: 1 }, false, treino, 1.5);
    const nenhum = evoluir(antes, { ...zeradas(), FIN: 1, PAS: 1 }, false);
    expect(nenhum.delta.FIN).toBe(1);
    expect(os2.delta.FIN).toBe(2);
    expect(os2.delta.PAS).toBe(1.5);
    expect(evoluir(antes, { ...zeradas(), FIN: 5 }, false, treino, 1.5).delta.FIN).toBe(LIMITE_DELTA_HABILIDADE);
  });

  it('na Partida, vale com as regras da T1: mesmo jogo, e quem tem Resenha nunca evolui menos', () => {
    let subiuMais = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const a = escalacao('CAP', 66);
      const com = { ...a, jogadores: a.jogadores.map((j) => ({ ...j, resenha: true })) };
      const r0 = simularPartida({ ...base, mandante: a, visitante: escalacao('TAT', 66), seed });
      const r1 = simularPartida({ ...base, mandante: com, visitante: escalacao('TAT', 66), seed });
      expect(r1.lances).toEqual(r0.lances);
      expect(r1.gols).toEqual(r0.gols);
      r1.desempenhos.forEach((d, i) => {
        const d0 = r0.desempenhos[i]!;
        for (const h of HABILIDADES) {
          if (d.slot.lado === 'visitante') expect(d.deltaHabilidades[h]).toBe(d0.deltaHabilidades[h]);
          else {
            expect(d.deltaHabilidades[h]).toBeGreaterThanOrEqual(d0.deltaHabilidades[h]);
            if (d.deltaHabilidades[h] > d0.deltaHabilidades[h]) subiuMais++;
          }
        }
      });
    }
    expect(subiuMais).toBeGreaterThan(40);
  });
});

describe('expulsões em série (T2)', () => {
  it('com três expulsos no mesmo Time a Partida termina (os atacantes recuam)', () => {
    const neutra = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const;
    const r = simularPartida({ ...base, mandante: escalacao('TAT', 65), visitante: escalacao('CAP', 75), seed: 164685, t2: neutra });
    expect(r.desempenhos.filter((d) => d.expulso).length).toBeGreaterThanOrEqual(3);
  });
});

describe('saída de bola depois do gol (ADR-0045)', () => {
  const seeds = Array.from({ length: 400 }, (_, i) => 7 + i * 104729);
  /** Pares (gol, lance seguinte) sem bola parada no meio, em muitas Partidas. */
  const depoisDoGol = (t2?: { postura: { mandante: 'EQUILIBRADA'; visitante: 'EQUILIBRADA' } }) =>
    seeds.flatMap((seed) => {
      const r = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70), seed, ...(t2 ? { t2 } : {}) });
      return r.lances.flatMap((l, i) => (l.tipo === 'GOL' && r.lances[i + 1] && !r.lances[i + 1]!.bolaParada ? [{ gol: l, proximo: r.lances[i + 1]! }] : []));
    });

  it.each([
    ['T1', undefined],
    ['T2', { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const],
  ])('na %s, quem sofreu o gol quase sempre ataca no lance seguinte', (_, t2) => {
    const pares = depoisDoGol(t2);
    expect(pares.length).toBeGreaterThan(200);
    const deQuemSofreu = pares.filter((p) => p.proximo.ataque !== p.gol.ataque).length / pares.length;
    // Duelo de Posse com base 0,8 entre iguais: ~80%, e não os 50% de antes.
    expect(deQuemSofreu).toBeGreaterThan(0.7);
    expect(deQuemSofreu).toBeLessThan(0.9);
  });

  it('as versões da simulação subiram: T1 na 12 e T2 na 13', () => {
    const t1 = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70), seed: 1 });
    const t2 = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70), seed: 1, t2: { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } });
    expect(t1.versaoSim).toBe(12);
    expect(t2.versaoSim).toBe(13);
  });
});

describe('lances até o fim do jogo (ADR-0045)', () => {
  const partidas = Array.from({ length: 300 }, (_, i) =>
    simularPartida({ ...base, mandante: escalacao('TAT', 70), visitante: escalacao('TAM', 70), seed: 11 + i * 15485863 }),
  );
  it('o último lance de ataque cai perto do apito, mesmo nos jogos travados', () => {
    for (const r of partidas) {
      const ultimo = Math.max(...r.lances.map((l) => l.minuto));
      expect(ultimo).toBeGreaterThanOrEqual(ritmoDaPartida(r.seed) <= 8 ? 78 : 84);
      expect(r.lances.every((l) => l.minuto >= 1 && l.minuto <= 90)).toBe(true);
    }
  });
  it('sai gol entre o 82\' e o 90\'', () => {
    const golsNoFim = partidas.flatMap((r) => r.lances.filter((l) => l.tipo === 'GOL' && l.minuto >= 82)).length;
    const gols = partidas.flatMap((r) => r.lances.filter((l) => l.tipo === 'GOL')).length;
    // A fatia final (9 de 90 minutos) leva uma parte justa dos gols.
    expect(golsNoFim / gols).toBeGreaterThan(0.07);
  });
  it('os minutos dos lances de ataque nunca andam para trás', () => {
    for (const r of partidas) {
      const ataques = r.lances.filter((l) => !l.bolaParada);
      for (let i = 1; i < ataques.length; i++) expect(ataques[i]!.minuto).toBeGreaterThanOrEqual(ataques[i - 1]!.minuto);
    }
  });
});

describe('marcação dupla (ADR-0045)', () => {
  const partidas = Array.from({ length: 300 }, (_, i) =>
    simularPartida({ ...base, mandante: escalacao('PRE', 70), visitante: escalacao('SAG', 70), seed: 23 + i * 7907 }),
  );
  const lances = partidas.flatMap((r) => r.lances);
  const comDobra = lances.filter((l) => l.dobra);

  it('aparece em cerca de 1 a cada 4 lances que chegam ao duelo com a zaga', () => {
    const chegaram = lances.filter((l) => !l.bolaParada && l.finalizador && !l.contraAtaque);
    const taxa = chegaram.filter((l) => l.dobra).length / chegaram.length;
    expect(taxa).toBeGreaterThan(0.18);
    expect(taxa).toBeLessThan(0.32);
  });

  it('quem dobra é do time que defende e quem recebe a dobra é do time que ataca', () => {
    for (const l of comDobra) {
      expect(l.dobra!.zagueiro.lado).not.toBe(l.ataque);
      expect(l.dobra!.sobre.lado).toBe(l.ataque);
    }
  });

  it('com o passe, quem chuta é o companheiro livre, sem marcador e sem desarme ou bloqueio', () => {
    const passes = comDobra.filter((l) => l.dobra!.passe);
    expect(passes.length).toBeGreaterThan(30);
    for (const l of passes) {
      expect(l.finalizador!.indice).not.toBe(l.dobra!.sobre.indice);
      expect(l.marcador).toBeUndefined();
      expect(['GOL', 'DEFESA', 'FORA']).toContain(l.tipo);
    }
  });

  it('sem o passe, o finalizador encara os dois e para mais vezes na zaga', () => {
    const paradoNaZaga = (ls: typeof lances) => ls.filter((l) => l.tipo === 'DESARME' || l.tipo === 'BLOQUEIO').length / ls.length;
    const semPasse = comDobra.filter((l) => !l.dobra!.passe);
    const normais = lances.filter((l) => !l.dobra && !l.bolaParada && l.finalizador && !l.contraAtaque);
    expect(paradoNaZaga(semPasse)).toBeGreaterThan(paradoNaZaga(normais));
  });

  it('a média de gols segue a mesma faixa', () => {
    const media = partidas.reduce((s, r) => s + r.gols.mandante + r.gols.visitante, 0) / partidas.length;
    expect(media).toBeGreaterThan(2.5);
    expect(media).toBeLessThan(4.5);
  });
});

describe('Formação (ADR-0044)', () => {
  const postura = { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } as const;
  const jogo = (seed: number, a: Formacao, b: Formacao, ovrA = 70, ovrB = 70) =>
    simularPartida({ ...base, seed, mandante: escalacaoNa(a, 'CAP', ovrA), visitante: escalacaoNa(b, 'ONC', ovrB, 'R'), t2: { postura, formacao: { mandante: a, visitante: b } } });

  it('2-2-2 escolhido joga igual a não escolher: mesmos lances e placar', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const sem = simularPartida({ ...base, seed, mandante: escalacaoNa('2-2-2', 'CAP', 70), visitante: escalacaoNa('2-2-2', 'ONC', 70, 'R'), t2: { postura } });
      const com = jogo(seed, '2-2-2', '2-2-2');
      expect(com.lances).toEqual(sem.lances);
      expect(com.gols).toEqual(sem.gols);
      expect(com.formacao).toEqual({ mandante: '2-2-2', visitante: '2-2-2' });
    }
  });

  it('a Escalação tem que ter as vagas da Formação', () => {
    expect(() => validarEscalacao(escalacaoNa('3-2-1', 'CAP', 70), '3-2-1')).not.toThrow();
    expect(() => validarEscalacao(escalacaoNa('3-2-1', 'CAP', 70))).toThrow(/ZAG/);
    expect(() => simularPartida({ ...base, seed: 1, mandante: escalacaoNa('2-3-1', 'CAP', 70), visitante: escalacaoNa('2-2-2', 'ONC', 70), t2: { postura } })).toThrow();
  });

  it('todas as Formações jogam entre si sem quebrar, inclusive com expulsões', () => {
    for (const a of FORMACOES) for (const b of FORMACOES) for (let seed = 1; seed <= 150; seed++) {
      const r = jogo(seed, a, b, 60 + (seed % 20), 70);
      expect(r.lances.length).toBeGreaterThan(0);
    }
  });

  it('Tabela só no 2-3-1: o apoio é outro meia do Time que ataca', () => {
    let tabelas = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const l of jogo(seed, '2-3-1', '2-2-2').lances) {
        if (l.jogadaDaFormacao !== 'TABELA') continue;
        tabelas++;
        expect(l.ataque).toBe('mandante');
        expect(l.apoio).toBeDefined();
        expect(l.apoio!.indice).not.toBe(l.criador.indice);
        expect(escalacaoNa('2-3-1', 'CAP', 70).jogadores[l.apoio!.indice]!.posicao).toBe('MEI');
      }
    }
    expect(tabelas).toBeGreaterThan(200);
  });

  it('Ligação direta só no 3-1-2, fora do contra-ataque: quem lança é um zagueiro e quem finaliza é atacante', () => {
    const esc = escalacaoNa('3-1-2', 'CAP', 70);
    let ligacoes = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const l of jogo(seed, '3-1-2', '2-2-2').lances) {
        if (l.jogadaDaFormacao !== 'LIGACAO_DIRETA') continue;
        ligacoes++;
        expect(l.ataque).toBe('mandante');
        expect(l.contraAtaque).toBeUndefined();
        expect(esc.jogadores[l.criador.indice]!.posicao).toBe('ZAG');
        if (l.finalizador) expect(esc.jogadores[l.finalizador.indice]!.posicao).toBe('ATA');
      }
    }
    expect(ligacoes).toBeGreaterThan(200);
  });

  it('Cobertura só no 3-2-1 que defende: vem depois do drible, e o zagueiro da sobra não é o marcador', () => {
    const def = escalacaoNa('3-2-1', 'ONC', 70, 'R');
    let coberturas = 0;
    let desarmes = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (const l of jogo(seed, '2-2-2', '3-2-1').lances) {
        if (!l.cobertura) continue;
        coberturas++;
        expect(l.ataque).toBe('mandante');
        expect(l.jogadaDaFormacao).toBe('COBERTURA');
        expect(l.drible).toBe(true);
        expect(def.jogadores[l.cobertura.indice]!.posicao).toBe('ZAG');
        expect(l.cobertura.indice).not.toBe(l.marcador!.indice);
        if (l.tipo === 'DESARME') {
          desarmes++;
          expect(l.defensor).toEqual(l.cobertura);
        }
      }
    }
    expect(coberturas).toBeGreaterThan(150);
    expect(desarmes).toBeGreaterThan(0);
    expect(desarmes).toBeLessThan(coberturas);
  });

  it('jogador fora de posição joga a vaga: a Nota e o OVR saem pela Posição da vaga', () => {
    const a = escalacaoNa('3-2-1', 'CAP', 70);
    const meiaNaZaga = { ...a, jogadores: a.jogadores.map((j, i) => (i === 3 ? { ...j, posicaoDeOrigem: 'MEI' as const } : j)) };
    const r = simularPartida({ ...base, seed: 5, mandante: meiaNaZaga, visitante: escalacaoNa('2-2-2', 'ONC', 70), t2: { postura, formacao: { mandante: '3-2-1', visitante: '2-2-2' } } });
    expect(r.desempenhos.find((d) => d.slot.lado === 'mandante' && d.slot.indice === 3)!.posicao).toBe('ZAG');
  });

  it('equilíbrio: entre Times iguais, nenhuma Formação ganha mais de 3,5 pontos de vitória a mais que a outra', () => {
    for (const [a, b] of [['2-3-1', '2-2-2'], ['3-2-1', '2-2-2'], ['3-1-2', '2-2-2'], ['2-3-1', '3-2-1'], ['3-1-2', '3-2-1'], ['2-3-1', '3-1-2']] as const) {
      const r = confronto(a, b, 3000);
      expect(Math.abs(r.v - r.d), `${a} x ${b}`).toBeLessThan(0.035 * 2);
    }
  });

  it('o 3-2-1 deixa o jogo mais travado e o 2-3-1 mais aberto', () => {
    const espelho = (f: Formacao) => { const r = confronto(f, f, 2000); return r.golsA + r.golsB; };
    expect(espelho('3-2-1')).toBeLessThan(espelho('2-2-2') - 0.4);
    expect(espelho('2-3-1')).toBeGreaterThan(espelho('2-2-2') + 0.2);
  });
});
