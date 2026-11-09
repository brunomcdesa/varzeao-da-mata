import { describe, expect, it } from 'vitest';
import type { JogadorPublico } from '@liga/shared';
import { temporadasDaCarreira } from '../src/carreira.js';

const jogo = (temporada: number, o: Partial<JogadorPublico['historico'][number]>): JogadorPublico['historico'][number] => ({
  partidaId: 1, temporada, rodada: 1, fase: 'LIGA', nota: 6, ovr: 60, habilidades: { FIN: 60, PAS: 60, DRI: 60, DEF: 30, GOL: 10 }, gols: 0, rival: 'ONC', emCasa: true, pro: 1, contra: 0, ...o,
});

describe('Página de Carreira', () => {
  it('agrupa por Temporada, a mais recente primeiro, com Times, números, OVR e cartões', () => {
    const j = {
      ovrInicial: 55,
      historico: [
        jogo(1, { time: 'CAP', ovr: 57, gols: 2, assistencias: 1, nota: 7 }),
        jogo(1, { time: 'CAP', ovr: 59, pro: 0, contra: 2, nota: 5 }),
        jogo(2, { time: 'CAP', serie: 'A', ovr: 61, amarelos: 1 }),
        jogo(2, { time: 'LOB', serie: 'B', ovr: 62, pro: 1, contra: 1, expulso: true }),
      ],
      trofeus: [{ tipo: 'CRAQUE_RODADA', temporada: 1, time: 'CAP' }, { tipo: 'CRAQUE_RODADA', temporada: 1, time: 'CAP' }],
    } as unknown as JogadorPublico;
    const [t2, t1] = temporadasDaCarreira(j);
    expect(t1).toMatchObject({ numero: 1, times: [{ time: 'CAP' }], jogos: 2, vitorias: 1, derrotas: 1, gols: 2, assistencias: 1, notaMedia: 6, ovrInicio: 55, ovrFim: 59, amarelos: 0, expulsoes: 0, trofeus: [['CRAQUE_RODADA', 2]] });
    expect(t2).toMatchObject({ numero: 2, times: [{ time: 'CAP', serie: 'A' }, { time: 'LOB', serie: 'B' }], jogos: 2, empates: 1, ovrInicio: 59, ovrFim: 62, amarelos: 1, expulsoes: 1 });
  });
});
