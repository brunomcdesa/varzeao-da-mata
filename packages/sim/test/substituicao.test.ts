import { describe, expect, it } from 'vitest';
import type { Escalacao } from '@liga/shared';
import { simularPartida } from '../src/partida.js';
import { PARAMETROS_T2 } from '../src/parametros.js';
import { escalacao, jogador } from './fabricas.js';

const t2 = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } as const };
const comBanco = (e: Escalacao, ...banco: ReturnType<typeof jogador>[]): Escalacao => ({ ...e, banco });
const jogo = (seed: number, m: Escalacao, v: Escalacao, comT2 = true) =>
  simularPartida({ fase: 'LIGA', mandante: m, visitante: v, seed, ...(comT2 ? { t2 } : {}) });

describe('Substituição no intervalo (ADR-0061)', () => {
  it('sem Banco a Partida sai igual; com Banco, só muda depois do intervalo', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sem = jogo(seed, escalacao('CAP', 62), escalacao('ONC', 70));
      const com = jogo(seed, comBanco(escalacao('CAP', 62), jogador('cap-r1', 'ATA', 62), jogador('cap-r2', 'ZAG', 62)), escalacao('ONC', 70));
      const troca = com.substituicoes?.[0]?.antesDoLance ?? com.lances.length;
      // Até a troca, os lances são os mesmos.
      expect(com.lances.slice(0, troca)).toEqual(sem.lances.slice(0, troca));
      if (!com.substituicoes) expect(com).toEqual(sem);
    }
  });

  it('sai quem está com Nota parcial abaixo de 5, até 2; entra o da mesma Posição primeiro', () => {
    let trocas = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const m = comBanco(escalacao('CAP', 55), jogador('cap-r1', 'MEI', 60), jogador('cap-r2', 'ATA', 60));
      const r = jogo(seed, m, escalacao('ONC', 80));
      const s = r.substituicoes ?? [];
      expect(s.length).toBeLessThanOrEqual(PARAMETROS_T2.trocasPorTime);
      for (const x of s) {
        trocas++;
        expect(x.lado).toBe('mandante');
        expect(x.notaNoIntervalo).toBeLessThan(PARAMETROS_T2.notaParaSair);
        expect(x.minuto).toBe(45);
        const vaga = m.jogadores[x.lugar]!.posicao;
        // Sem goleiro no Banco, o goleiro fica em campo.
        expect(vaga).not.toBe('GOL');
        const reserva = m.banco![x.banco]!;
        // Fora de posição só quando nenhum reserva livre era da Posição da vaga.
        if (x.foraDePosicao) expect(m.banco!.filter((b, i) => b.posicao === vaga && !s.some((y) => y.banco === i && y !== x)).length === 0 || reserva.posicao !== vaga).toBe(true);
        else expect(reserva.posicao).toBe(vaga);
        // Os dois têm desempenho no mesmo lugar: um SAIU, o outro ENTROU.
        const d = r.desempenhos.filter((y) => y.slot.lado === 'mandante' && y.slot.indice === x.lugar);
        expect(d.map((y) => y.substituicao).sort()).toEqual(['ENTROU', 'SAIU']);
        expect(d.find((y) => y.substituicao === 'ENTROU')!.jogadorId).toBe(reserva.jogadorId);
        expect(d.find((y) => y.substituicao === 'ENTROU')!.posicao).toBe(vaga);
      }
      // Reserva que não entrou não tem desempenho.
      const entraram = new Set(s.map((x) => m.banco![x.banco]!.jogadorId));
      for (const b of m.banco!) expect(r.desempenhos.some((d) => d.jogadorId === b.jogadorId)).toBe(entraram.has(b.jogadorId));
    }
    // O Time bem mais fraco perde muito duelo: tem troca em boa parte dos jogos.
    expect(trocas).toBeGreaterThan(30);
  });

  it('o reserva que entra joga os lances do 2º tempo no lugar de quem saiu', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = comBanco(escalacao('CAP', 55), jogador('cap-r1', 'ATA', 75), jogador('cap-r2', 'MEI', 75));
      const r = jogo(seed, m, escalacao('ONC', 80));
      for (const x of r.substituicoes ?? []) {
        const saiu = r.desempenhos.find((d) => d.substituicao === 'SAIU' && d.slot.indice === x.lugar)!;
        const entrou = r.desempenhos.find((d) => d.substituicao === 'ENTROU' && d.slot.indice === x.lugar)!;
        // Gols e assistências do lugar no 2º tempo ficam com o reserva.
        const doLugar = (desde: number, ate: number) =>
          r.lances.slice(desde, ate).filter((l) => l.tipo === 'GOL' && l.ataque === 'mandante' && l.finalizador?.indice === x.lugar && !l.bolaParada).length;
        expect(saiu.gols).toBeGreaterThanOrEqual(doLugar(0, x.antesDoLance));
        expect(entrou.gols).toBeGreaterThanOrEqual(doLugar(x.antesDoLance, r.lances.length));
      }
    }
  });

  it('goleiro só sai para outro goleiro; reserva goleiro nunca entra na linha', () => {
    let golTrocado = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const m = comBanco(escalacao('CAP', 50), jogador('cap-g', 'GOL', 70));
      const r = jogo(seed, m, escalacao('ONC', 85));
      for (const x of r.substituicoes ?? []) {
        // O único reserva é goleiro: só pode entrar no gol.
        expect(m.jogadores[x.lugar]!.posicao).toBe('GOL');
        expect(x.foraDePosicao).toBeUndefined();
        golTrocado++;
      }
    }
    expect(golTrocado).toBeGreaterThan(0);
  });

  it('todos que não foram escalados ficam no Banco: a troca acha alguém da mesma Posição', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = comBanco(escalacao('CAP', 50), jogador('r-gol', 'GOL', 60), jogador('r-zag', 'ZAG', 60), jogador('r-mei', 'MEI', 60), jogador('r-ata', 'ATA', 60));
      const r = jogo(seed, m, escalacao('ONC', 85));
      const s = r.substituicoes ?? [];
      s.forEach((x, k) => {
        const vaga = m.jogadores[x.lugar]!.posicao;
        const usados = new Set(s.slice(0, k).map((y) => y.banco));
        const tinhaDaPosicao = m.banco!.some((b, i) => b.posicao === vaga && !usados.has(i));
        // Mesma Posição sempre que ainda havia; fora de posição, nunca com o goleiro reserva.
        if (tinhaDaPosicao) expect(m.banco![x.banco]!.posicao).toBe(vaga);
        else expect(m.banco![x.banco]!.posicao).not.toBe('GOL');
      });
    }
  });

  it('na T1 o Banco é ignorado', () => {
    const m = comBanco(escalacao('CAP', 50), jogador('cap-r1', 'ATA', 70));
    for (let seed = 1; seed <= 30; seed++) {
      const r = jogo(seed, m, escalacao('ONC', 80), false);
      expect(r.substituicoes).toBeUndefined();
      expect(r.desempenhos).toHaveLength(14);
    }
  });

  it('é determinística', () => {
    const m = comBanco(escalacao('CAP', 55), jogador('cap-r1', 'MEI', 60), jogador('cap-r2', 'ATA', 60));
    expect(jogo(7, m, escalacao('ONC', 80))).toEqual(jogo(7, m, escalacao('ONC', 80)));
  });
});
