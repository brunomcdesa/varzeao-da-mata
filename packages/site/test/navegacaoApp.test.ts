import { describe, expect, it } from 'vitest';
import { abaInicial } from '../src/abas.js';
import { abaDaSecao, paiDaTela } from '../src/navegacaoApp.js';

describe('Navegação de app no celular (ADR-0103)', () => {
  it('cada seção acende a sua aba de baixo; o resto mora no Mais', () => {
    expect(abaDaSecao('inicio')).toBe('inicio');
    expect(abaDaSecao('jogos')).toBe('jogos');
    expect(abaDaSecao('tabela')).toBe('tabela');
    expect(abaDaSecao('times')).toBe('times');
    for (const s of ['jogadores', 'temporada', 'historia', 'avisos']) expect(abaDaSecao(s)).toBe('mais');
  });

  it('telas de detalhe têm Voltar para a lista de onde saíram', () => {
    expect(paiDaTela('/time/ONC')).toBe('/times');
    expect(paiDaTela('/jogador/12')).toBe('/jogadores');
    expect(paiDaTela('/comparar/1/2')).toBe('/jogadores');
    expect(paiDaTela('/carreira/12')).toBe('/jogador/12');
    expect(paiDaTela('/partida/40')).toBe('/jogos');
    expect(paiDaTela('/avisos')).toBe('/');
  });

  it('telas principais não têm Voltar', () => {
    for (const c of ['/', '', '/jogos', '/tabela', '/times', '/jogadores', '/temporada', '/historia']) expect(paiDaTela(c)).toBeNull();
  });
});

describe('Subabas (ADR-0103)', () => {
  const ids = ['escalacao', 'elenco', 'jogos'];
  it('volta na aba escolhida antes nesta tela', () => {
    expect(abaInicial(ids, 'jogos', 'elenco')).toBe('jogos');
  });
  it('sem escolha, abre a padrão; sem padrão válida, a primeira', () => {
    expect(abaInicial(ids, null, 'elenco')).toBe('elenco');
    expect(abaInicial(ids, 'trofeus', 'nada')).toBe('escalacao');
  });
});

describe('abas()', () => {
  it('com uma parte só (ou partes vazias), não desenha barra', async () => {
    const { abas } = await import('../src/abas.js');
    const s = abas('x', [{ id: 'a', rotulo: 'A', conteudo: '<p>oi</p>' }, { id: 'b', rotulo: 'B', conteudo: '' }]).s;
    expect(s).not.toContain('subabas-barra');
  });
});
