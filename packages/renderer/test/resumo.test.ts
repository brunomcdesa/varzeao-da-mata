import { describe, expect, it } from 'vitest';
import { RoteiroResumo, narracaoDoResumo, type DadosDoResumo } from '../src/resumo.js';
import { exigenciasDaNarracao } from '../src/narracao.js';

const base: DadosDoResumo = {
  temporada: 1,
  rodada: 1,
  fase: 'LIGA',
  placares: [
    { mandante: 'TAT', visitante: 'TAM', golsMandante: 0, golsVisitante: 2, penaltis: null, hora: 12 },
    { mandante: 'PRE', visitante: 'CAP', golsMandante: 2, golsVisitante: 2, penaltis: null, hora: 18 },
  ],
  tabela: [
    { time: 'TAM', jogos: 1, pontos: 3, vitorias: 1, saldo: 2 },
    { time: 'ONC', jogos: 1, pontos: 3, vitorias: 1, saldo: 1 },
    { time: 'TUC', jogos: 1, pontos: 3, vitorias: 1, saldo: 1 },
    { time: 'CAP', jogos: 1, pontos: 1, vitorias: 0, saldo: 0 },
  ],
  novosContratados: [{ username: 'rafa', time: 'CAP', posicao: 'ATA' }],
  totalNovos: 1,
  candidatos: [{ username: 'rafa', time: 'CAP', posicao: 'ATA', nota: 8.1, gols: 2 }],
};

describe('Resumo da Rodada', () => {
  it('tem as cartelas na ordem e pula as que não têm conteúdo', () => {
    expect(new RoteiroResumo(base).segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'PLACARES', 'TABELA', 'NOVOS', 'CANDIDATOS', 'CHAMADA', 'COMPARTILHE']);
    const semNovos = new RoteiroResumo({ ...base, novosContratados: [], totalNovos: 0, candidatos: [] });
    expect(semNovos.segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'PLACARES', 'TABELA', 'CHAMADA', 'COMPARTILHE']);
  });

  it('abre com o anúncio do Craque da Rodada anterior, narrado sem @', () => {
    const craqueDaRodada = { rodada: 2, fase: 'LIGA' as const, username: 'eofamoso__2k', apelido: 'Famoso', time: 'TUC' as const, posicao: 'MEI' as const, nota: 8.4, gols: 1, votos: 12 };
    const r = new RoteiroResumo({ ...base, craqueDaRodada });
    expect(r.segmentos.map((s) => s.cartela).slice(0, 3)).toEqual(['ABERTURA', 'CRAQUE', 'PLACARES']);
    const falas = narracaoDoResumo(r).map((f) => f.texto);
    expect(falas[1]).toBe('O Craque da Rodada 2, eleito pela torcida com 12 votos, é Famoso, meia do Tucano!');
    const semApelido = narracaoDoResumo(new RoteiroResumo({ ...base, craqueDaRodada: { ...craqueDaRodada, apelido: null, votos: 0 } })).map((f) => f.texto);
    expect(semApelido[1]).toBe('Ninguém votou, então o Craque da Rodada 2 ficou com a maior nota: o meia do Tucano!');
    expect(falas.join(' ')).not.toContain('@');
  });

  it('com Série B, anuncia o Craque da Rodada de cada Série (ADR-0017)', () => {
    const c = { rodada: 2, fase: 'LIGA' as const, username: 'eofamoso__2k', apelido: null, time: 'TUC' as const, posicao: 'MEI' as const, nota: 8.4, gols: 1, votos: 12 };
    const r = new RoteiroResumo({ ...base, tabelaB: [], craqueDaRodada: c, craqueDaRodadaB: { ...c, time: 'COR', votos: 3 } });
    expect(r.segmentos.filter((s) => s.cartela === 'CRAQUE').map((s) => s.serie)).toEqual(['A', 'B']);
    const falas = narracaoDoResumo(r).map((f) => f.texto);
    expect(falas[2]).toBe('Na Série B: O Craque da Rodada 2, eleito pela torcida com 3 votos, é o meia da Coruja!');
  });

  it('narra placares e a ponta da tabela, sem falar @', () => {
    const falas = narracaoDoResumo(new RoteiroResumo(base)).map((f) => f.texto);
    expect(falas[1]).toBe('Tamanduá venceu o Tatu por 2 a 0. Preguiça e Capivara empataram em 2 a 2.');
    expect(falas[2]).toBe('Na tabela, Tamanduá, Onça e Tucano dividem a ponta com 3 pontos.');
    expect(falas.join(' ')).not.toContain('@');
  });

  it('cada cartela estica para a fala caber', () => {
    const r = new RoteiroResumo(base);
    const falas = narracaoDoResumo(r);
    const minimos = exigenciasDaNarracao(r, falas, () => 9);
    const esticado = new RoteiroResumo(base, minimos);
    for (const s of esticado.segmentos) expect(s.fim - s.inicio).toBeGreaterThanOrEqual(9.3);
  });
});

describe('Destaques por Posição no Resumo (ADR-0041)', () => {
  const destaques: NonNullable<DadosDoResumo['destaques']> = [
    { posicao: 'GOL', username: 'muro', time: 'ONC', nota: 9.1, numero: { valor: 6, legenda: 'defesas' } },
    { posicao: 'ZAG', username: 'zaga', time: 'TAT', nota: 8.0, numero: { valor: 4, legenda: 'desarmes' } },
    { posicao: 'MEI', username: 'meio', time: 'CAP', nota: 7.7, numero: { valor: 2, legenda: 'assistências' } },
    { posicao: 'ATA', username: 'rafa', time: 'CAP', nota: 8.1, numero: { valor: 2, legenda: 'gols' } },
  ];

  it('sem Destaques (T1) o Resumo não muda', () => {
    expect(new RoteiroResumo(base).segmentos.some((s) => s.cartela === 'POSICOES')).toBe(false);
  });

  it('a cartela entra antes dos Candidatos, e o Narrador fala pela Posição e pelo Time, nunca pelo @', () => {
    const r = new RoteiroResumo({ ...base, destaques });
    const cartelas = r.segmentos.map((s) => s.cartela);
    expect(cartelas.indexOf('POSICOES')).toBe(cartelas.indexOf('CANDIDATOS') - 1);
    const fala = narracaoDoResumo(r).find((f) => r.segmentos[f.segmento!]!.cartela === 'POSICOES')!.texto;
    expect(fala).toContain('Muralha: o goleiro');
    expect(fala).toContain('Matador: o atacante');
    for (const d of destaques) expect(fala).not.toContain(d.username);
  });

  it('com Série B, uma cartela por Série', () => {
    const comB = [...destaques.map((d) => ({ ...d, serie: 'A' as const })), { ...destaques[0]!, serie: 'B' as const, time: 'JAC' as const }];
    const r = new RoteiroResumo({ ...base, tabelaB: base.tabela, destaques: comB });
    expect(r.segmentos.filter((s) => s.cartela === 'POSICOES').map((s) => s.serie)).toEqual(['A', 'B']);
  });

  it('no Resumo da Temporada, os Destaques da Temporada vêm depois do artilheiro', () => {
    const r = new RoteiroResumo({ ...base, placares: [], candidatos: [], fimDaTemporada: { artilheiro: { username: 'rafa', time: 'CAP', posicao: 'ATA', gols: 9 } }, destaques });
    const cartelas = r.segmentos.map((s) => s.cartela);
    expect(cartelas.indexOf('POSICOES')).toBe(cartelas.indexOf('DESTAQUES') + 1);
  });
});
