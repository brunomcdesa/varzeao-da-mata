import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ITEM_DE_APOIADOR, ITENS_A_VENDA, TIMES_FUNDADORES, TIMES_NOVOS, type JogadorPublico, type TimeId } from '@liga/shared';
import { apoiadores, creditosDaTemporada, normalizarArroba, registrarApoio, selosDeApoiador } from '../src/apoiador.js';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { carteiraDoJogador, saldo } from '../src/carteira.js';
import { processarComentario } from '../src/coletar.js';
import { exportarSite } from '../src/site.js';
import { aplicarEscolha } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

describe('Selo de Apoiador (ADR-0108), puro', () => {
  it('apoio aberto: ativo; fechado: as Temporadas em que apoiou, sem repetir', () => {
    const selos = selosDeApoiador(
      [
        { username: 'ana', nivel: 5, temporada_inicio: 3, temporada_fim: 3 },
        { username: 'ana', nivel: 15, temporada_inicio: 3, temporada_fim: 4 },
        { username: 'bia', nivel: 5, temporada_inicio: 4, temporada_fim: null },
      ],
      5,
    );
    expect(selos.get('ana')).toEqual({ ativo: false, temporadas: [3, 4] });
    expect(selos.get('bia')).toEqual({ ativo: true, temporadas: [4, 5] });
  });

  it('o @ fica sem @, sem espaços e minúsculo', () => {
    expect(normalizarArroba('  @@Rafa.Gol ')).toBe('rafa.gol');
  });

  it('o Item de Apoiador não está à venda', () => {
    expect(ITEM_DE_APOIADOR.exclusivo).toBe('APOIADOR');
    expect(ITENS_A_VENDA.some((i) => i.codigo === ITEM_DE_APOIADOR.codigo)).toBe(false);
  });
});

describe('Apoiador no banco (ADR-0108)', () => {
  let banco: Banco;
  beforeEach(async () => {
    banco = await bancoDeTeste();
  });
  afterEach(async () => {
    await banco.fechar();
  });

  let n = 0;
  async function inscrever(time: TimeId, posicao: string, quem: string): Promise<string> {
    await processarComentario(banco, { igCommentId: `ap${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date('2026-11-10T12:00:00Z') }, { rodadaEmVotacao: null });
    return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
  }
  const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };
  const dia = (d: string) => new Date(`${d}T15:00:00Z`);

  it('sem gravar não muda nada; abre, troca de nível, repete sem efeito e encerra', async () => {
    await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    await inscrever('CAP', 'ATA', 'torcedor');
    const simulado = await registrarApoio(banco, { username: '@Torcedor', nivel: 5, agora: dia('2026-11-24'), gravar: false });
    expect(simulado).toMatchObject({ username: 'torcedor', acao: 'ABERTO', gravado: false, jogador: true });
    expect((await apoiadores(banco)).size).toBe(0);

    expect((await registrarApoio(banco, { username: 'torcedor', nivel: 5, agora: dia('2026-11-24'), gravar: true })).acao).toBe('ABERTO');
    expect((await registrarApoio(banco, { username: 'torcedor', nivel: 5, agora: dia('2026-11-25'), gravar: true })).acao).toBe('JA_ESTAVA');
    expect((await registrarApoio(banco, { username: 'torcedor', nivel: 15, agora: dia('2026-11-26'), gravar: true })).acao).toBe('TROCOU_DE_NIVEL');
    expect((await apoiadores(banco)).get('torcedor')).toEqual({ ativo: true, temporadas: [3] });
    expect((await registrarApoio(banco, { username: 'torcedor', nivel: null, agora: dia('2026-11-27'), gravar: true })).acao).toBe('ENCERRADO');
    expect((await registrarApoio(banco, { username: 'torcedor', nivel: null, agora: dia('2026-11-28'), gravar: true })).acao).toBe('SEM_APOIO');
    expect((await apoiadores(banco)).get('torcedor')).toEqual({ ativo: false, temporadas: [3] });
    expect((await banco.query(`SELECT 1 FROM apoio`)).rows).toHaveLength(2);
  });

  it('só vale a partir da T3: apoio aberto durante a T2 conta como da T3, e o Selo não aparece no site da T2', async () => {
    await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-19', seed: 4, series });
    await inscrever('CAP', 'ATA', 'adiantado');
    await registrarApoio(banco, { username: 'adiantado', nivel: 15, agora: dia('2026-11-24'), gravar: true });
    expect((await apoiadores(banco)).get('adiantado')).toEqual({ ativo: true, temporadas: [3] });
    expect(await creditosDaTemporada(banco, 2)).toEqual([]);
    expect(await creditosDaTemporada(banco, 3)).toEqual(['adiantado']);
    const { arquivos } = await exportarSite(banco, dia('2026-11-24'));
    expect((arquivos.get('jogadores.json') as JogadorPublico[]).find((x) => x.username === 'adiantado')!.apoiador).toBeUndefined();
  });

  it('recusa nível que não existe e @ inválido', async () => {
    await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    await expect(registrarApoio(banco, { username: 'x', nivel: 10 as 5, agora: dia('2026-11-24'), gravar: true })).rejects.toThrow('5 ou 15');
    await expect(registrarApoio(banco, { username: 'com espaço', nivel: 5, agora: dia('2026-11-24'), gravar: true })).rejects.toThrow('@ inválido');
  });

  it('quem não joga entra nos créditos da Temporada, em ordem alfabética', async () => {
    await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    await inscrever('CAP', 'ATA', 'zeca');
    const r = await registrarApoio(banco, { username: 'so_torce', nivel: 5, agora: dia('2026-11-24'), gravar: true });
    expect(r.jogador).toBe(false);
    await registrarApoio(banco, { username: 'zeca', nivel: 15, agora: dia('2026-11-24'), gravar: true });
    expect(await creditosDaTemporada(banco, 3)).toEqual(['so_torce', 'zeca']);
    expect(await creditosDaTemporada(banco, 2)).toEqual([]);
  });

  it('o Selo aparece no site a partir da T3, sem o valor do apoio', async () => {
    await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    await inscrever('CAP', 'ATA', 'selado');
    await registrarApoio(banco, { username: 'selado', nivel: 15, agora: dia('2026-11-24'), gravar: true });
    const { arquivos } = await exportarSite(banco, dia('2026-11-24'));
    const j = (arquivos.get('jogadores.json') as JogadorPublico[]).find((x) => x.username === 'selado')!;
    expect(j.apoiador).toEqual({ ativo: true, temporadas: [3] });
    const texto = JSON.stringify(j);
    expect(texto).not.toContain('nivel');
  });

  it('Item de Apoiador: não se compra; com apoio de R$ 15 é do Jogador só a partir da Rodada 4, e fica depois que o apoio acaba', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const fiel = await inscrever('CAP', 'ATA', 'fiel');
    const basico = await inscrever('ONC', 'ATA', 'basico');
    const rodada4 = (await banco.query<{ d: string }>(`SELECT to_char(data, 'YYYY-MM-DD') AS d FROM rodada WHERE temporada_id = $1 AND fase = 'LIGA' AND numero = 4`, [t])).rows[0]!.d;
    const antes = new Date('2026-11-29T12:00:00Z');
    const depois = new Date(`${rodada4}T13:00:00Z`);
    const codigo = ITEM_DE_APOIADOR.codigo;

    await registrarApoio(banco, { username: 'fiel', nivel: 15, agora: dia('2026-11-24'), gravar: true });
    await registrarApoio(banco, { username: 'basico', nivel: 5, agora: dia('2026-11-24'), gravar: true });
    expect((await carteiraDoJogador(banco, fiel, antes)).loja?.donos).not.toContain(codigo);

    // Encerrar o apoio não tira o Item.
    await registrarApoio(banco, { username: 'fiel', nivel: null, agora: dia('2026-11-28'), gravar: true });
    expect((await carteiraDoJogador(banco, fiel, depois)).loja?.donos).toContain(codigo);
    expect((await carteiraDoJogador(banco, basico, depois)).loja?.donos).not.toContain(codigo);

    const escolher = (id: string, tipo: 'COMPRA' | 'EQUIPAR', quando: Date) => aplicarEscolha(banco, id, { tipo, valor: codigo }, quando, async () => new Set());
    expect((await escolher(basico, 'COMPRA', depois)).mensagem).toBe('Esse Item não está na Loja.');
    expect((await escolher(basico, 'EQUIPAR', depois)).ok).toBe(false);
    expect((await escolher(fiel, 'EQUIPAR', antes)).ok).toBe(false);
    expect((await escolher(fiel, 'EQUIPAR', depois)).ok).toBe(true);
    expect((await carteiraDoJogador(banco, fiel, depois)).loja?.equipados).toEqual({ [ITEM_DE_APOIADOR.encaixe]: codigo });
    // Sem passar pelo extrato: nada é cobrado.
    expect(await saldo(banco, fiel, depois)).toBe(0);
  });
});
