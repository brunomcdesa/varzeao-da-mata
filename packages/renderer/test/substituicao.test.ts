import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida, type ResultadoPartida } from '@liga/sim';
import { Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { falaDaTroca, montarNarracao } from '../src/narracao.js';
import { roteiroAoVivo } from '../src/aoVivo.js';
import { DURACAO_TROCA, ocupanteDoDesempenho, ocupanteNoLance } from '../src/substituicao.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const jogador = (id: string, posicao: Posicao, ovr: number) => ({ jogadorId: id, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) });
const esc = (time: TimeId, ovr: number, banco = false): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => jogador(`${time}-${i}`, posicao, ovr)),
  ...(banco ? { banco: [jogador(`${time}-r0`, 'ZAG', 70), jogador(`${time}-r1`, 'ATA', 70)] } : {}),
});
const T2 = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const;

/** A primeira Partida (a partir da semente 1) em que o mandante troca no intervalo. */
function comTroca(): { r: ResultadoPartida; escalacoes: Record<'mandante' | 'visitante', Escalacao> } {
  const escalacoes = { mandante: esc('TAT', 52, true), visitante: esc('ONC', 78) };
  for (let seed = 1; ; seed++) {
    const r = simularPartida({ ...escalacoes, seed, fase: 'LIGA', t2: T2 });
    if (r.substituicoes?.length) return { r, escalacoes };
  }
}

describe('Substituição no vídeo (ADR-0061)', () => {
  it('o lugar muda de dono no intervalo: o reserva entra pela lateral, quem saiu caminha para fora, e o juiz levanta a placa', () => {
    const { r, escalacoes } = comTroca();
    const tl = new Timeline(r, escalacoes);
    const troca = tl.trocas[0]!;
    const slot = { lado: troca.lado, indice: troca.lugar };
    expect(tl.ocupanteEm(slot, troca.t - 1)).toBe(troca.lugar);
    expect(tl.ocupanteEm(slot, troca.t)).toBe(7 + r.substituicoes![0]!.banco);
    // No intervalo (45' ou logo depois do último lance do 1º tempo).
    expect(troca.t).toBeGreaterThanOrEqual(Math.min(45 * 60, tl.janelas[troca.antesDoLance - 1]!.fim));
    const meio = tl.estado(troca.t + DURACAO_TROCA * 0.4);
    expect(meio.juiz?.acao).toBe('PLACA');
    expect(meio.trocas?.lista.length).toBeGreaterThan(0);
    expect(meio.jogadores.some((j) => j.saindo && j.ocupante === troca.saiu)).toBe(true);
    const depois = tl.estado(troca.t + DURACAO_TROCA + 1);
    expect(depois.jogadores.some((j) => j.saindo)).toBe(false);
    expect(depois.jogadores.find((j) => j.slot.lado === troca.lado && j.slot.indice === troca.lugar)!.ocupante).toBe(troca.ocupante);
    expect(depois.juiz?.acao).not.toBe('PLACA');
  });

  it('nomes nos lances e nos desempenhos: no 2º tempo, o lugar é do reserva', () => {
    const { r } = comTroca();
    const x = r.substituicoes![0]!;
    expect(ocupanteNoLance(r, 7, x.lado, x.lugar, x.antesDoLance - 1)).toBe(x.lugar);
    expect(ocupanteNoLance(r, 7, x.lado, x.lugar, x.antesDoLance)).toBe(7 + x.banco);
    const entrou = r.desempenhos.find((d) => d.substituicao === 'ENTROU' && d.slot.indice === x.lugar && d.slot.lado === x.lado)!;
    expect(ocupanteDoDesempenho(r, 7, entrou)).toBe(7 + x.banco);
  });

  it('o Reels tem um trecho TROCA antes do 2º tempo e o Narrador fala pela Posição, nunca pelo @', () => {
    const { r, escalacoes } = comTroca();
    const tl = new Timeline(r, escalacoes);
    const roteiro = new Roteiro(tl);
    const i = roteiro.segmentos.findIndex((s) => s.tipo === 'TROCA');
    expect(i).toBeGreaterThan(0);
    // Todos os lances mostrados depois da troca são do 2º tempo.
    for (const s of roteiro.segmentos.slice(i + 1)) if (s.tipo === 'LANCE') expect(s.lance!).toBeGreaterThanOrEqual(tl.trocas[0]!.antesDoLance);
    const falas = montarNarracao(roteiro);
    const fala = falas.find((f) => f.id === 'troca')!;
    expect(fala.texto).toMatch(/^(Mexida|Duas mexidas) no Tatu!/);
    expect(fala.texto).not.toContain('@');
    // No Ao Vivo, a fala sai quando a troca aparece.
    expect(roteiroAoVivo(tl).some((f) => f.id === 'troca')).toBe(true);
  });

  it('T2 com apelidos (ADR-0059): a troca e os lances do 2º tempo falam o apelido de quem está no lugar', () => {
    const { r, escalacoes } = comTroca();
    const tl = new Timeline(r, escalacoes);
    const x = r.substituicoes![0]!;
    const apelidos = {
      mandante: [...escalacoes.mandante.jogadores.map((_, i) => `Titular${i}`), 'Reservao', 'Reservinha'],
      visitante: escalacoes.visitante.jogadores.map((_, i) => `Rival${i}`),
    };
    const reserva = apelidos.mandante[7 + x.banco]!;
    const titular = apelidos.mandante[x.lugar]!;
    const falas = montarNarracao(new Roteiro(tl), apelidos);
    const troca = falas.find((f) => f.id === 'troca')!.texto;
    expect(troca).toContain(`Sai ${titular}`);
    expect(troca).toContain(reserva);
    // Depois da troca, o lugar nunca é chamado pelo apelido de quem saiu.
    const doSegundoTempo = falas.filter((f) => /^lance-(\d+)/.test(f.id) && Number(/^lance-(\d+)/.exec(f.id)![1]) >= x.antesDoLance);
    expect(doSegundoTempo.length).toBeGreaterThan(0);
    for (const f of doSegundoTempo) expect(f.texto).not.toContain(titular);
  });

  it('fala fora de posição: "entra o atacante, pra jogar de meia"', () => {
    const e = { mandante: esc('TAT', 60, true), visitante: esc('ONC', 60) };
    const texto = falaDaTroca([{ lado: 'mandante', lugar: 3, ocupante: 8, saiu: 3, antesDoLance: 10, t: 2700, foraDePosicao: true }], e, (l) => e[l].time);
    expect(texto).toBe('Mexida no Tatu! Sai o meia, entra o atacante, pra jogar de meia.');
  });
});
