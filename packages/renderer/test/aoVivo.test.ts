import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { agendarAoVivo, estimarDuracao, roteiroAoVivo } from '../src/aoVivo.js';
import { Timeline } from '../src/timeline.js';

const FORMACAO: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId): Escalacao => ({ time, jogadores: FORMACAO.map((posicao, i) => ({ jogadorId: `${time}${i}`, posicao, ovr: 65, habilidades: habilidadesDoPerfil(posicao, 65) })) });

describe('narração do Ao Vivo', () => {
  it('nunca atrasa: a resolução de cada lance entra na hora, cortando o que estiver no ar', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const e = { mandante: esc('CAP'), visitante: esc('ONC') };
      const tl = new Timeline(simularPartida({ ...e, seed, fase: 'LIGA' }), e);
      const falas = roteiroAoVivo(tl);
      // A voz real costuma ser mais lenta que a estimativa: testa com 30% a mais.
      const dur = (id: string) => estimarDuracao(falas.find((f) => f.id === id)!.texto) * 1.3;
      const agenda = agendarAoVivo(falas, dur);
      // Ninguém fala por cima de ninguém.
      for (let i = 1; i < agenda.length; i++) {
        const a = agenda[i - 1]!;
        expect(a.fim ?? a.inicio + dur(a.id), `seed ${seed} ${a.id}`).toBeLessThanOrEqual(agenda[i]!.inicio + 1e-6);
      }
      // Resoluções, intervalo e fim, quando entram, entram no horário.
      for (const f of falas) {
        if (f.tipo !== 'ancora' || f.modo === 'ate' || f.id.endsWith('-c')) continue;
        const a = agenda.find((x) => x.id === f.id);
        if (a) expect(a.inicio).toBeCloseTo(f.em!, 6);
      }
      // Quase todas as resoluções entram (só sai a que ficaria grudada em outra).
      const res = falas.filter((f) => f.tipo === 'ancora' && f.modo === 'de' && /^lance-\d+-b$/.test(f.id));
      expect(res.filter((f) => agenda.some((a) => a.id === f.id)).length / res.length).toBeGreaterThan(0.9);
    }
  });

  it('memória da Partida: as falas de enchimento quase não se repetem (ADR-0043)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const e = { mandante: esc('CAP'), visitante: esc('ONC') };
      const tl = new Timeline(simularPartida({ ...e, seed, fase: 'LIGA' }), e);
      const falas = roteiroAoVivo(tl);
      const dur = (id: string) => estimarDuracao(falas.find((f) => f.id === id)!.texto);
      const ditas = agendarAoVivo(falas, dur)
        .map((a) => falas.find((f) => f.id === a.id)!)
        .filter((f) => f.tipo === 'enchimento')
        // As de placar e minuto e as curtas de tapa-buraco mudam pouco e podem voltar.
        .map((f) => f.texto)
        .filter((t) => !/\d/.test(t) && !/^(Segue o jogo|Bola rolando|Vamos lá|Que partida!)/.test(t) && !/zero a zero|Tudo igual,/.test(t));
      const vezes = new Map<string, number>();
      for (const t of ditas) vezes.set(t, (vezes.get(t) ?? 0) + 1);
      const repetidas = [...vezes.values()].filter((n) => n > 1).length;
      expect(repetidas / vezes.size, `seed ${seed}`).toBeLessThan(0.15);
    }
  });
});

