import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { carteiraDoJogador, lancar, saldo } from '../src/carteira.js';
import { processarComentario } from '../src/coletar.js';
import { escalarPartida } from '../src/escalacao.js';
import { itensEquipadosAtuais } from '../src/loja.js';
import { aplicarEscolha } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

let n = 0;
async function inscrever(time: TimeId, posicao: string, quem: string): Promise<string> {
  await processarComentario(banco, { igCommentId: `l${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date('2026-11-10T12:00:00Z') }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}
const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };
const agora = new Date('2026-11-29T12:00:00Z');
const escolher = (id: string, tipo: 'COMPRA' | 'EQUIPAR' | 'TIRAR', valor: string) => aplicarEscolha(banco, id, { tipo, valor }, agora, async () => new Set());
const dar = (id: string, valor: number) => lancar(banco, { jogadorId: id, tipo: 'BONUS_LARGADA', referencia: `teste${valor}`, valor, descricao: 'Teste', visivelEm: new Date('2026-11-28T00:00:00Z') });

describe('Loja (ADR-0101)', () => {
  it('compra com Moedas e equipa; não cobra duas vezes; troca e tira sem pagar', async () => {
    await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const id = await inscrever('CAP', 'ATA', 'comprador');
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).mensagem).toBe('Faltam 20 Moedas para esse Item.');
    await dar(id, 45);
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).ok).toBe(true);
    expect(await saldo(banco, id, agora)).toBe(25);
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).ok).toBe(false);
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_DOURADA')).mensagem).toBe('Faltam 75 Moedas para esse Item.');
    expect((await escolher(id, 'COMPRA', 'LUVA_ROSA')).mensagem).toBe('A Luva é só para goleiro.');
    expect((await escolher(id, 'COMPRA', 'FAIXA_BRANCA')).ok).toBe(true);
    expect(await saldo(banco, id, agora)).toBe(5);
    // Equipar só o que é seu; trocar e tirar não cobram.
    expect((await escolher(id, 'EQUIPAR', 'FAIXA_PRETA')).ok).toBe(false);
    expect((await escolher(id, 'TIRAR', 'CHUTEIRA')).ok).toBe(true);
    expect((await escolher(id, 'EQUIPAR', 'CHUTEIRA_AZUL')).ok).toBe(true);
    expect(await saldo(banco, id, agora)).toBe(5);
    const c = await carteiraDoJogador(banco, id, agora);
    expect(c.loja).toEqual({ donos: ['CHUTEIRA_AZUL', 'FAIXA_BRANCA'], equipados: { FAIXA: 'FAIXA_BRANCA', CHUTEIRA: 'CHUTEIRA_AZUL' }, goleiro: false, fase: 1 });
    expect(c.extrato.filter((l) => l.tipo === 'COMPRA').map((l) => l.valor)).toEqual([-20, -20]);
    expect(await itensEquipadosAtuais(banco)).toEqual({ comprador: { FAIXA: 'FAIXA_BRANCA', CHUTEIRA: 'CHUTEIRA_AZUL' } });
  });

  it('a segunda fase (cortes, barbas e comemorações) só abre no dia da Rodada 4 da Liga da T3', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const id = await inscrever('CAP', 'ATA', 'estiloso');
    await dar(id, 200);
    const dia = (await banco.query<{ d: string }>(`SELECT to_char(data, 'YYYY-MM-DD') AS d FROM rodada WHERE temporada_id = $1 AND fase = 'LIGA' AND numero = 4`, [t])).rows[0]!.d;
    const comprar = (codigo: string, quando: Date) => aplicarEscolha(banco, id, { tipo: 'COMPRA', valor: codigo }, quando, async () => new Set());
    expect((await comprar('CORTE_TRANCAS', agora)).mensagem).toBe('Esse Item não está na Loja.');
    // 10h de Brasília do dia da Rodada 4.
    const naRodada4 = new Date(`${dia}T13:00:00Z`);
    expect((await comprar('CORTE_TRANCAS', naRodada4)).ok).toBe(true);
    expect((await comprar('COMEMORACAO_MORTAL', naRodada4)).ok).toBe(true);
    expect(await saldo(banco, id, naRodada4)).toBe(80);
    expect((await carteiraDoJogador(banco, id, naRodada4)).loja?.fase).toBe(2);
  });

  it('antes da T3 a Loja não abre', async () => {
    await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-30', seed: 4, series });
    const id = await inscrever('CAP', 'ATA', 'cedo');
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).mensagem).toBe('A Loja abre na Temporada 3.');
  });

  it('a Escalação congela os Itens do Corte: trocar depois não muda o jogo', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const id = await inscrever('CAP', 'ATA', 'vaidoso');
    await dar(id, 40);
    await escolher(id, 'COMPRA', 'CHUTEIRA_VERDE');
    const p = (await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND (p.mandante_id = 'CAP' OR p.visitante_id = 'CAP') ORDER BY p.apito_inicial LIMIT 1`, [t])).rows[0]!;
    const e = await escalarPartida(banco, p.id);
    const lado = e.escalacoes.mandante.time === 'CAP' ? 'mandante' : 'visitante';
    const lugar = e.nomes[lado].indexOf('@vaidoso');
    expect(e.itens[lado][lugar]).toEqual({ CHUTEIRA: 'CHUTEIRA_VERDE' });
    await escolher(id, 'TIRAR', 'CHUTEIRA');
    // Reescalar devolve o que ficou gravado.
    const de = await escalarPartida(banco, p.id);
    expect(de.itens[lado][lugar]).toEqual({ CHUTEIRA: 'CHUTEIRA_VERDE' });
  });
});

describe('Limite por Posição com A e B de 8 (T3, ADR-0080)', () => {
  it('posição cheia no Time pedido: entra noutro da mesma Série, na mesma Posição', async () => {
    await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    // Enche os atacantes da Capivara (4) e dá gente aos outros para o equilíbrio não pesar.
    for (let k = 0; k < 4; k++) await inscrever('CAP', 'ATA', `ata${k}`);
    for (const t of [...TIMES_FUNDADORES, ...TIMES_NOVOS]) if (t !== 'CAP') for (let k = 0; k < 3; k++) await inscrever(t as TimeId, 'MEI', `mei_${t}_${k}`);
    const id = await inscrever('CAP', 'ATA', 'quinto');
    const j = (await banco.query<{ time_id: TimeId; posicao: string }>(`SELECT time_id, posicao FROM jogador WHERE id = $1`, [id])).rows[0]!;
    expect(j.posicao).toBe('ATA');
    expect(j.time_id).not.toBe('CAP');
    expect(TIMES_FUNDADORES.includes(j.time_id as never)).toBe(true);
    const naCap = (await banco.query<{ n: string }>(`SELECT count(*) AS n FROM jogador WHERE time_id = 'CAP' AND posicao = 'ATA'`)).rows[0]!.n;
    expect(Number(naCap)).toBe(4);
  });
});

describe('Loja do Técnico e beira do campo (ADR-0111)', () => {
  it('só o Técnico compra os Itens do boneco dele; o Técnico não compra Item de Jogador', async () => {
    const { aprovarTecnico } = await import('../src/tecnico.js');
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const dia = (await banco.query<{ d: string }>(`SELECT to_char(data, 'YYYY-MM-DD') AS d FROM rodada WHERE temporada_id = $1 AND fase = 'LIGA' AND numero = 4`, [t])).rows[0]!.d;
    const quando = new Date(`${dia}T15:00:00Z`);
    const tec = await aprovarTecnico(banco, { username: 'seu.tonho', time: 'CAP', agora: new Date('2026-11-28T12:00:00Z'), naJanela: true });
    const jog = await inscrever('CAP', 'ATA', 'jogadorx');
    await dar(tec.jogadorId, 200);
    await dar(jog, 200);
    const comprar = (id: string, codigo: string, q = quando) => aplicarEscolha(banco, id, { tipo: 'COMPRA', valor: codigo }, q, async () => new Set());
    expect((await comprar(tec.jogadorId, 'BONE_DO_TIME', agora)).mensagem).toBe('Esse Item não está na Loja.');
    expect((await comprar(tec.jogadorId, 'BONE_DO_TIME')).ok).toBe(true);
    expect((await comprar(tec.jogadorId, 'ROUPA_TERNO')).ok).toBe(true);
    expect(await saldo(banco, tec.jogadorId, quando)).toBe(80);
    expect((await comprar(tec.jogadorId, 'CHUTEIRA_AZUL')).mensagem).toBe('Esse Item é do boneco do Jogador.');
    expect((await comprar(jog, 'BONE_DO_TIME')).mensagem).toBe('Esse Item é do boneco do Técnico.');
    const c = await carteiraDoJogador(banco, tec.jogadorId, quando);
    expect(c.loja).toMatchObject({ tecnico: true, goleiro: false, equipados: { BONE: 'BONE_DO_TIME', ROUPA: 'ROUPA_TERNO' } });
  });

  it('a Escalação congela o Técnico a partir da Rodada 4; antes, a beira não aparece', async () => {
    const { aprovarTecnico } = await import('../src/tecnico.js');
    const { beiraDaPartida } = await import('../src/beiraDoCampo.js');
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    await aprovarTecnico(banco, { username: 'seu.tonho', time: 'CAP', agora: new Date('2026-11-28T12:00:00Z'), naJanela: true });
    const partidaDa = async (numero: number) =>
      (await banco.query<{ id: number; mandante_id: TimeId }>(`SELECT p.id, p.mandante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.fase = 'LIGA' AND r.numero = $2 AND 'CAP' IN (p.mandante_id, p.visitante_id) LIMIT 1`, [t, numero])).rows[0]!;
    const cedo = await partidaDa(1);
    await escalarPartida(banco, cedo.id);
    expect(await beiraDaPartida(banco, cedo.id)).toBeNull();
    const r4 = await partidaDa(4);
    await escalarPartida(banco, r4.id);
    const beira = (await beiraDaPartida(banco, r4.id))!;
    const lado = r4.mandante_id === 'CAP' ? 'mandante' : 'visitante';
    expect(beira.tecnicos[lado]).toMatchObject({ nome: 'seu.tonho' });
    expect(beira.tecnicos[lado === 'mandante' ? 'visitante' : 'mandante']).toBeUndefined();
  });
});
