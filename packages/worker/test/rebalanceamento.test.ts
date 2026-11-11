import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type JogadorPublico, type Posicao, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { aplicarPerfil } from '../src/perfil.js';
import { TIME_PRIMO, avisoDoRemanejado, planejarRebalanceamento, rebalancear, type JogadorNoElenco } from '../src/rebalanceamento.js';
import { exportarSite } from '../src/site.js';
import { bancoDeTeste } from './banco-de-teste.js';

const SERIES = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };

/** Elenco de teste: `quantos` Jogadores no Time, na ordem GOL, ZAG, ZAG, MEI, MEI, ATA, ATA, e de novo. */
function elencoDe(time: TimeId, quantos: number, desde = 0): JogadorNoElenco[] {
  const ordem: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
  return Array.from({ length: quantos }, (_, i) => ({
    id: String(desde + i + 1),
    username: `${time.toLowerCase()}_${i + 1}`,
    time,
    posicao: ordem[i % ordem.length]!,
    inscritoEm: new Date(Date.UTC(2026, 10, 1, 12, i)).toISOString(),
    numero: null,
  }));
}

describe('planejarRebalanceamento (ADR-0036)', () => {
  it('cada Time da A fica com 7 e os mais recentes vão para o Time Primo, na mesma Posição', () => {
    const elenco = elencoDe('ONC', 11);
    const plano = planejarRebalanceamento(elenco, SERIES);
    expect(plano.elencos.ONC).toHaveLength(7);
    expect(plano.remanejados.map((r) => r.jogador.username).sort()).toEqual(['onc_10', 'onc_11', 'onc_8', 'onc_9']);
    expect(plano.remanejados.every((r) => r.para === 'JAC' && r.noPrimo)).toBe(true);
    // Fica uma Escalação inteira na A: 1 GOL, 2 ZAG, 2 MEI, 2 ATA.
    const conta = (p: Posicao) => plano.elencos.ONC!.filter((j) => j.posicao === p).length;
    expect([conta('GOL'), conta('ZAG'), conta('MEI'), conta('ATA')]).toEqual([1, 2, 2, 2]);
    // A Posição não muda.
    for (const r of plano.remanejados) expect(plano.elencos.JAC!.find((j) => j.id === r.jogador.id)?.posicao).toBe(r.jogador.posicao);
  });

  it('quem se inscreveu primeiro fica, mesmo com Posição sobrando', () => {
    // 3 goleiros: o mais recente dos que sobram sai primeiro.
    const elenco: JogadorNoElenco[] = [
      ...elencoDe('CAP', 7),
      { id: '50', username: 'gol_antigo', time: 'CAP', posicao: 'GOL', inscritoEm: '2026-10-01T00:00:00.000Z', numero: null },
      { id: '51', username: 'gol_novo', time: 'CAP', posicao: 'GOL', inscritoEm: '2026-11-10T00:00:00.000Z', numero: null },
    ];
    const plano = planejarRebalanceamento(elenco, SERIES);
    expect(plano.remanejados.map((r) => r.jogador.username)).toEqual(['gol_novo', 'cap_1']);
    expect(plano.elencos.CAP!.some((j) => j.username === 'gol_antigo')).toBe(true);
  });

  it('Time Primo cheio na Posição: vai para o Time da B com menos Jogadores nela', () => {
    const elenco = [...elencoDe('TUC', 8), ...elencoDe('BOT', 7, 100)];
    const plano = planejarRebalanceamento(elenco, SERIES);
    expect(plano.remanejados).toHaveLength(1);
    expect(plano.remanejados[0]!.noPrimo).toBe(false);
    expect(plano.remanejados[0]!.para).not.toBe('BOT');
    expect(TIMES_NOVOS).toContain(plano.remanejados[0]!.para);
  });

  it('Time com 7 ou menos não muda, e sem Série B nada acontece', () => {
    expect(planejarRebalanceamento(elencoDe('SAG', 7), SERIES).remanejados).toHaveLength(0);
    expect(planejarRebalanceamento(elencoDe('SAG', 12), { A: TIMES_FUNDADORES, B: [] }).remanejados).toHaveLength(0);
  });

  it('com 92 inscritos, todos os Times da A ficam com 7 e os outros 36 vão para a B', () => {
    const elenco = TIMES_FUNDADORES.flatMap((t, i) => elencoDe(t, i < 4 ? 12 : 11, i * 100));
    expect(elenco).toHaveLength(92);
    const plano = planejarRebalanceamento(elenco, SERIES);
    expect(plano.remanejados).toHaveLength(36);
    expect(TIMES_FUNDADORES.every((t) => plano.elencos[t]!.length === 7)).toBe(true);
    expect(TIMES_NOVOS.reduce((s, t) => s + plano.elencos[t]!.length, 0)).toBe(36);
  });

  it('todo Time fundador tem um Time Primo da B, e os Clássicos viram Clássicos', () => {
    expect(TIMES_FUNDADORES.map((t) => TIME_PRIMO[t]).sort()).toEqual([...TIMES_NOVOS].sort());
    expect([TIME_PRIMO.CAP, TIME_PRIMO.ONC].sort()).toEqual(['JAC', 'SUC']);
  });

  it('o aviso explica o motivo e o Time novo', () => {
    const [r] = planejarRebalanceamento(elencoDe('ONC', 8), SERIES).remanejados;
    expect(avisoDoRemanejado(r!)).toBe(
      '@onc_8 a Série B chegou e você vai jogar todas as partidas! Para todo mundo entrar em campo, a Onça ficou com os 7 primeiros inscritos e você virou Fundador do Jacaré, na mesma posição. OVR, apelido e Carreira vão junto, e na próxima Janela você pode voltar sem gastar a Transferência. ⚽',
    );
  });
});

describe('rebalancear no banco', () => {
  let banco: Banco;
  beforeEach(async () => {
    banco = await bancoDeTeste();
  });
  afterEach(async () => {
    await banco.fechar();
  });

  let n = 0;
  async function jogador(time: TimeId, posicao: Posicao, em: string, numero: number | null = null): Promise<string> {
    const u = `j${++n}`;
    return (
      await banco.query<{ id: string }>(
        `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, inscrito_em, numero) VALUES ($1, $1, $2, $3, 65, $4, $5) RETURNING id::text AS id`,
        [u, time, posicao, em, numero],
      )
    ).rows[0]!.id;
  }
  const novaT2 = () => criarTemporada(banco, { numero: 2, primeiraRodada: '2026-12-01', seed: 8, series: SERIES });
  const perfil = (id: string, p: { numero: number }) => banco.transacao((b) => aplicarPerfil(b, id, p));
  const timeDe = async (id: string) => (await banco.query<{ time_id: TimeId; numero: number | null }>(`SELECT time_id, numero FROM jogador WHERE id = $1`, [id])).rows[0]!;
  async function onca9(): Promise<string[]> {
    const ordem: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA', 'MEI'];
    const ids: string[] = [];
    for (const [i, p] of ordem.entries()) ids.push(await jogador('ONC', p, `2026-11-0${i + 1}T12:00:00Z`, i + 1));
    return ids;
  }

  it('não vale na Temporada 1', async () => {
    await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await onca9();
    await expect(rebalancear(banco, { gravar: true })).rejects.toThrow('só vale a partir da Temporada 2');
    expect((await banco.query(`SELECT 1 FROM fundador`)).rows).toHaveLength(0);
  });

  it('a simulação não grava nada', async () => {
    await novaT2();
    const ids = await onca9();
    const r = await rebalancear(banco, { gravar: false });
    expect(r.plano.remanejados).toHaveLength(2);
    expect(r.gravado).toBe(false);
    for (const id of ids) expect((await timeDe(id)).time_id).toBe('ONC');
    expect((await banco.query(`SELECT 1 FROM fundador`)).rows).toHaveLength(0);
    expect((await banco.query(`SELECT 1 FROM rebalanceamento`)).rows).toHaveLength(0);
  });

  it('gravado: move os mais recentes, marca os Fundadores (voluntários também) e só roda uma vez', async () => {
    await novaT2();
    const ids = await onca9();
    const voluntario = await jogador('JAC', 'GOL', '2026-11-20T12:00:00Z', 8);
    const r = await rebalancear(banco, { gravar: true, agora: new Date('2026-11-30T12:00:00Z') });
    expect(r.plano.remanejados.map((x) => x.jogador.id).sort()).toEqual([ids[7], ids[8]].sort());
    expect((await timeDe(ids[7]!)).time_id).toBe('JAC');
    // Camisa 8 já era do voluntário no Jacaré: o remanejado fica sem número; a 9 estava livre e fica.
    expect((await timeDe(ids[7]!)).numero).toBeNull();
    expect((await timeDe(ids[8]!)).numero).toBe(9);
    const f = (await banco.query<{ jogador_id: string; remanejado: boolean }>(`SELECT jogador_id::text AS jogador_id, remanejado FROM fundador ORDER BY jogador_id`)).rows;
    expect(f).toEqual(expect.arrayContaining([{ jogador_id: voluntario, remanejado: false }, { jogador_id: ids[7], remanejado: true }, { jogador_id: ids[8], remanejado: true }]));
    expect(f).toHaveLength(3);
    await expect(rebalancear(banco, { gravar: true })).rejects.toThrow('já foi rebalanceada');
  });

  it('na Pré-temporada, só os Fundadores escolhem a camisa no Time deles', async () => {
    await novaT2();
    const [fundador] = await Promise.all([jogador('JAC', 'GOL', '2026-11-20T12:00:00Z')]);
    await rebalancear(banco, { gravar: true });
    const depois = await jogador('JAC', 'ZAG', '2026-11-30T13:00:00Z');
    expect(await perfil(fundador!, { numero: 10 })).toMatchObject({ ok: true });
    expect(await perfil(depois, { numero: 11 })).toEqual({
      ok: false,
      mensagem: 'Na Pré-temporada, os Fundadores do Jacaré escolhem a camisa primeiro. Você escolhe a sua quando a Temporada começar.',
    });
    // Na A não muda nada.
    expect(await perfil(await jogador('CAP', 'ATA', '2026-11-30T13:00:00Z'), { numero: 11 })).toMatchObject({ ok: true });
    // Com a Temporada em andamento, todos escolhem.
    await banco.query(`UPDATE temporada SET status = 'EM_ANDAMENTO'`);
    expect(await perfil(depois, { numero: 11 })).toMatchObject({ ok: true });
  });

  it('o site da T2 mostra o Fundador; o da T1 não tem o campo', async () => {
    await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    const id = await jogador('ONC', 'ATA', '2026-11-01T12:00:00Z');
    const t1 = (await exportarSite(banco, new Date('2026-11-08T12:00:00Z'))).arquivos.get('jogadores.json') as JogadorPublico[];
    expect(t1.every((j) => !('fundador' in j))).toBe(true);

    await banco.query(`UPDATE temporada SET status = 'ENCERRADA'`);
    await novaT2();
    await banco.query(`UPDATE jogador SET time_id = 'JAC' WHERE id = $1`, [id]);
    await rebalancear(banco, { gravar: true });
    const t2 = (await exportarSite(banco, new Date('2026-12-01T15:00:00Z'))).arquivos.get('jogadores.json') as JogadorPublico[];
    expect(t2.find((j) => j.id === id)?.fundador).toEqual({ time: 'JAC', temporada: 2 });
  });
});
