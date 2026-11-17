import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { agendarAoVivo, ancorasAoVivo, estimarDuracao, roteiroAoVivo } from '../src/aoVivo.js';
import { Timeline, VELOCIDADE_AO_VIVO } from '../src/timeline.js';

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

  it('memória da Partida: as falas de enchimento quase não se repetem (ADR-0045)', () => {
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

  describe('enchimento no momento certo (ADR-0070)', () => {
    /** A voz real não bate com a estimativa: cada fala sai de 20% mais rápida a 30% mais lenta. */
    const voz = (seed: number, texto: (id: string) => string) => {
      const fator = new Map<string, number>();
      return (id: string) => {
        if (!fator.has(id)) {
          let h = seed >>> 0;
          for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0;
          fator.set(id, 0.8 + 0.5 * (h / 2 ** 32));
        }
        return estimarDuracao(texto(id)) * fator.get(id)!;
      };
    };
    const NOMES = { Capivara: 'mandante', Onça: 'visitante' } as const;
    /** Frases em que um Time (ou um Jogador dele) está com a bola: "Bola com a Onça", "O meia da Capivara gira o jogo"... */
    const DONO = /^(?:Bola com [ao] |Toca de lado d[ao] |Troca de passes no campo de defesa d[ao] |Passe curto, o meia d[ao] |O (?:zagueiro|goleiro|meia) d[ao] |O atacante d[ao] (?=\S+ se movimenta)|[AO] (?=\S+ (?:tem paciência|tenta furar))|(?=\S+ (?:roda a bola|troca passes|vai ganhando|chega pela|tenta pela)))(Capivara|Onça)/;

    const casos = () =>
      Array.from({ length: 12 }, (_, i) => {
        const seed = i + 1;
        const e = { mandante: esc('CAP'), visitante: esc('ONC') };
        const tl = new Timeline(simularPartida({ ...e, seed, fase: 'LIGA' }), e);
        const ancoras = ancorasAoVivo(tl);
        const durA = voz(seed, (id) => ancoras.find((f) => f.id === id)!.texto);
        const falas = roteiroAoVivo(tl, undefined, {}, durA);
        const dur = voz(seed, (id) => falas.find((f) => f.id === id)!.texto);
        const agenda = agendarAoVivo(falas, dur).filter((a) => a.id.startsWith('enche-'));
        return { seed, tl, agenda, dur };
      });

    it('a frase de posse só sai com aquele Time na bola, do começo ao fim da fala', () => {
      let conferidas = 0;
      for (const { seed, tl, agenda, dur } of casos()) {
        for (const a of agenda) {
          const m = DONO.exec(a.texto);
          if (!m) continue;
          conferidas++;
          for (let k = 0; k <= 4; k++) {
            const t = (a.inicio + (dur(a.id) * k) / 4) * VELOCIDADE_AO_VIVO;
            expect(tl.bolaNoToque(t)?.lado, `seed ${seed} "${a.texto}" aos ${(t / 60).toFixed(1)}'`).toBe(NOMES[m[1] as keyof typeof NOMES]);
          }
        }
      }
      expect(conferidas).toBeGreaterThan(100);
    });

    it('minuto e placar falados são os da tela na hora da fala', () => {
      for (const { seed, tl, agenda } of casos()) {
        for (const a of agenda) {
          const t = a.inicio * VELOCIDADE_AO_VIVO;
          const min = /^(\d+) minutos de jogo/.exec(a.texto);
          if (min) expect(Math.abs(Number(min[1]) - t / 60), `seed ${seed} "${a.texto}"`).toBeLessThanOrEqual(2);
          const p = tl.placarEm(t);
          const placar = /Capivara (\d+), Onça (\d+)\./.exec(a.texto);
          if (placar) expect([Number(placar[1]), Number(placar[2])], `seed ${seed} "${a.texto}"`).toEqual([p.mandante, p.visitante]);
          if (/zero a zero|Tudo igual/.test(a.texto)) expect(p.mandante, `seed ${seed} "${a.texto}"`).toBe(p.visitante);
        }
      }
    });

    it('não narra o que o toque de bola não desenha (dividida, passe errado, lançamento afastado)', () => {
      for (const { agenda } of casos()) for (const a of agenda) expect(a.texto).not.toMatch(/Dividida|Passe errado|tenta o lançamento/);
    });

    it('a frase entra na hora para que foi escrita, ou no máximo 1 s depois', () => {
      for (const { seed, tl } of casos().slice(0, 4)) {
        const ancoras = ancorasAoVivo(tl);
        const durA = voz(seed, (id) => ancoras.find((f) => f.id === id)!.texto);
        const falas = roteiroAoVivo(tl, undefined, {}, durA);
        const dur = voz(seed, (id) => falas.find((f) => f.id === id)!.texto);
        for (const a of agendarAoVivo(falas, dur)) {
          const f = falas.find((x) => x.id === a.id)!;
          if (f.tipo === 'enchimento') expect(a.inicio - f.em!, a.texto).toBeLessThanOrEqual(1.0 + 1e-9);
        }
      }
    });
  });
});
