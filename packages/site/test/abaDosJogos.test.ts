import { describe, expect, it } from 'vitest';
import type { LigaPublica, PartidaNoCalendario } from '@liga/shared';
import { abaDosJogos } from '../src/abaDosJogos.js';

const partida = (rodada: number, apito: string, copa?: 'OITAVAS'): PartidaNoCalendario =>
  ({ id: rodada * 10, rodada, fase: copa ? 'MATA_MATA' : 'LIGA', apito, mandante: 'ONC', visitante: 'LEA', situacao: 'AGENDADA', classico: true, escalada: false, ...(copa ? { copa } : {}) }) as PartidaNoCalendario;

describe('Sub-abas de Jogos: Liga e Copa', () => {
  const comCopa = { rodadas: [], calendario: [partida(101, '2026-11-30T14:00:00Z', 'OITAVAS'), partida(1, '2026-12-03T14:00:00Z')] } as unknown as LigaPublica;

  it('sem Copa na Temporada, não tem sub-aba', () => {
    expect(abaDosJogos({ rodadas: [], calendario: [partida(1, '2026-12-03T14:00:00Z')] } as unknown as LigaPublica, undefined)).toBeNull();
  });

  it('a aba pedida na URL manda', () => {
    expect(abaDosJogos(comCopa, 'copa', Date.parse('2026-12-05T12:00:00Z'))).toBe('COPA');
    expect(abaDosJogos(comCopa, 'liga', Date.parse('2026-11-29T12:00:00Z'))).toBe('LIGA');
  });

  it('sem aba na URL, abre a do jogo da vez', () => {
    expect(abaDosJogos(comCopa, undefined, Date.parse('2026-11-29T12:00:00Z'))).toBe('COPA');
    expect(abaDosJogos(comCopa, undefined, Date.parse('2026-12-02T12:00:00Z'))).toBe('LIGA');
  });
});
