import { describe, expect, it } from 'vitest';
import { escalacaoProvavel, habilidadesDoPerfil, ovrDasHabilidades, type Posicao } from '@liga/shared';
import { blocoDoPlano, capitaniaAindaVale, planoDaCapitania } from '../src/planoDoTime.js';
import { xDoCampinho } from '../src/ui.js';

const j = (id: string, posicao: Posicao, ovr = 66, jogos = 0) => ({ id, posicao, ovr, jogos, inscritoEm: `2026-11-0${id.length}T00:00:00.000Z`, habilidades: habilidadesDoPerfil(posicao, ovr) });
const elenco = [j('g', 'GOL'), j('z1', 'ZAG'), j('z2', 'ZAG'), j('m1', 'MEI'), j('m2', 'MEI'), j('m3', 'MEI'), j('a1', 'ATA'), j('a2', 'ATA')];

describe('campinho em qualquer Formação (ADR-0044)', () => {
  it('cada linha se espalha pelo número de Jogadores nela', () => {
    expect(xDoCampinho('MEI', 1)).toEqual([0.5]);
    expect(xDoCampinho('ATA', 1)).toEqual([0.5]);
    expect(xDoCampinho('ZAG', 2)).toEqual([0.28, 0.72]);
    expect(xDoCampinho('ZAG', 3)).toEqual([0.2, 0.5, 0.8]);
  });
});

describe('escalação provável na Formação (ADR-0086)', () => {
  it('sem Formação, segue o 2-2-2', () => {
    expect(escalacaoProvavel(elenco).map((l) => l.posicao)).toEqual(['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA']);
  });

  it('no 2-3-1, entram os três meias e um atacante', () => {
    const p = escalacaoProvavel(elenco, null, '2-3-1');
    expect(p.map((l) => l.jogador?.id)).toEqual(['g', 'z1', 'z2', 'm1', 'm2', 'm3', 'a1']);
  });

  it('no 3-1-2 com só dois zagueiros, um meia cobre a vaga fora de posição, com o OVR da vaga', () => {
    const p = escalacaoProvavel(elenco, null, '3-1-2');
    const terceiro = p[3]!;
    expect(terceiro).toMatchObject({ posicao: 'ZAG', posicaoDeOrigem: 'MEI' });
    expect(terceiro.ovr).toBe(ovrDasHabilidades('ZAG', terceiro.jogador!.habilidades));
    expect(p.filter((l) => !l.jogador)).toHaveLength(0);
  });

  it('ninguém de linha vai para o gol: sem goleiro, a vaga é da Base', () => {
    const p = escalacaoProvavel(elenco.slice(1), null, '3-2-1');
    expect(p[0]).toMatchObject({ posicao: 'GOL', jogador: null, ovr: null });
  });
});

describe('Plano do Capitão na página do Time (ADR-0086)', () => {
  const agora = new Date('2026-11-19T12:00:00.000Z');
  const jogo = { apito: '2026-11-19T18:00:00.000Z', adversario: 'ONC' as const };

  it('mostra a Formação, a jogada, a Postura e o Capitão', () => {
    const s = blocoDoPlano({ eu: false, capitao: 'fulano', postura: 'OFENSIVA', formacao: '2-3-1', jogo }, 'x', agora).s;
    expect(s).toContain('<strong>2-3-1</strong>');
    expect(s).toContain('Tabela');
    expect(s).toContain('Postura <strong>Ofensiva</strong>');
    expect(s).toContain('@fulano');
    expect(s).toContain('hoje às 15h, contra a Onça');
  });

  it('sem escolha vale Equilibrada no 2-2-2; o Capitão ganha o link do painel', () => {
    expect(planoDaCapitania({ eu: true, capitao: null, postura: '?', formacao: undefined })).toEqual({ postura: 'EQUILIBRADA', formacao: '2-2-2' });
    const s = blocoDoPlano({ eu: true, capitao: 'eu', postura: 'EQUILIBRADA' }, 'abc', agora).s;
    expect(s).toContain('href="#/jogador/abc"');
  });
});

describe('capitania guardada no navegador (ADR-0094)', () => {
  const apito = '2026-11-21T14:00:00.000Z';
  const c = { eu: true, capitao: 'eu', postura: 'OFENSIVA', formacao: '3-2-1', jogo: { apito, adversario: 'ONC' as const } };
  it('vale até o Corte do jogo dela (30 min antes do Apito Inicial)', () => {
    expect(capitaniaAindaVale(c, Date.parse('2026-11-21T13:29:00Z'))).toBe(true);
    expect(capitaniaAindaVale(c, Date.parse('2026-11-21T13:30:00Z'))).toBe(false);
    expect(capitaniaAindaVale(c, Date.parse('2026-11-21T15:00:00Z'))).toBe(false);
  });
  it('sem jogo ou sem capitania, não vale', () => {
    expect(capitaniaAindaVale({ ...c, jogo: null }, 0)).toBe(false);
    expect(capitaniaAindaVale(null, 0)).toBe(false);
  });
});
