import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, estruturaDaLiga, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada, somarDias } from '../src/calendario.js';
import { processarComentario, transferirJogador, trocasFechadasAgora } from '../src/coletar.js';
import { legendaDoFimDaTemporada, legendaDoResumo } from '../src/jobs.js';
import { rodarPartida } from '../src/partida.js';
import { dadosDoResumo, fecharRodada } from '../src/resumo.js';
import { exportarSite } from '../src/site.js';
import { fecharSupercopaPendente, haveraSupercopa, supercopaDaTemporada } from '../src/supercopa.js';
import { penduradosAntesDa, suspensos } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };
let n = 0;
async function inscrever(quem: string, time: string, em: string): Promise<string> {
  await processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ATA`, comentadoEm: new Date(em) }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}

/**
 * T3 encerrada como na vida real: Final da Série A na sexta 11/12/2026 às 18h (ONC × TAT), campeão
 * da A e da Copa gravados. Devolve o id da T3.
 */
async function t3Encerrada(campeaoDaA: TimeId, campeaoDaCopa: TimeId): Promise<number> {
  const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
  const final = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', '2026-12-11') RETURNING id`, [t3, estruturaDaLiga(7).rodadaDaFinal])).rows[0]!.id;
  await banco.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie) VALUES ($1, 'ONC', 'TAT', '2026-12-11T21:00:00Z', 'A')`, [final]);
  await banco.query(`UPDATE temporada SET status = 'ENCERRADA', campeao_id = $2, campeao_copa_id = $3 WHERE id = $1`, [t3, campeaoDaA, campeaoDaCopa]);
  return t3;
}

/** A T4 nasce no sábado 12/12 (Craque da Temporada): Copa na terça 15/12, Supercopa no domingo 13/12. */
const criarT4 = () => criarTemporada(banco, { numero: 4, primeiraRodada: somarDias('2026-12-11', 4), seed: 5, series });

const jogoDaSupercopa = async (t4: number) =>
  (
    await banco.query<{ id: number; mandante: TimeId; visitante: TimeId; apito: Date; rodada: number; dia: string }>(
      `SELECT p.id, p.mandante_id AS mandante, p.visitante_id AS visitante, p.apito_inicial AS apito, r.numero AS rodada, to_char(r.data, 'YYYY-MM-DD') AS dia
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.copa_etapa = 'SUPERCOPA'`,
      [t4],
    )
  ).rows;

describe('Supercopa (ADR-0118)', () => {
  it('abre a T4: domingo 13/12 às 18h, campeão da Série A × campeão da Copa; Copa na terça 15/12 e Liga 3 dias depois', async () => {
    await t3Encerrada('ONC', 'TAT');
    expect(await haveraSupercopa(banco, 4)).toBe(true);
    const t4 = await criarT4();
    const [jogo, ...resto] = await jogoDaSupercopa(t4);
    expect(resto).toHaveLength(0);
    expect(jogo).toMatchObject({ mandante: 'ONC', visitante: 'TAT', rodada: 100, dia: '2026-12-13' });
    expect(new Date(jogo!.apito).toISOString()).toBe('2026-12-13T21:00:00.000Z');
    const dia = async (numero: number) => (await banco.query<{ d: string }>(`SELECT to_char(data, 'YYYY-MM-DD') AS d FROM rodada WHERE temporada_id = $1 AND numero = $2`, [t4, numero])).rows[0]?.d;
    expect(await dia(101)).toBe('2026-12-15');
    expect(await dia(1)).toBe('2026-12-18');
  });

  it('o mesmo Time ganhou a Série A e a Copa: entra o vice da Série A', async () => {
    await t3Encerrada('ONC', 'ONC');
    const [jogo] = await jogoDaSupercopa(await criarT4());
    expect(jogo).toMatchObject({ mandante: 'ONC', visitante: 'TAT' });
  });

  it('a T3 não tem Supercopa (só existe campeão da Copa no fim da T3)', async () => {
    const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    expect(await jogoDaSupercopa(t3)).toHaveLength(0);
    expect(await haveraSupercopa(banco, 3)).toBe(false);
  });

  it('a Janela fica fechada até a Supercopa terminar e abre depois dela', async () => {
    await t3Encerrada('ONC', 'TAT');
    const id = await inscrever('veterano', 'ONCA', '2026-12-01T12:00:00Z');
    await criarT4();
    // Sábado 12/12, 21h de Brasília: a T4 já nasceu, mas a Supercopa é amanhã.
    const antes = new Date('2026-12-13T00:00:00Z');
    expect(await trocasFechadasAgora(banco, antes)).toBe('SUPERCOPA');
    const r = await transferirJogador(banco, id, { times: ['CAP'] }, { quando: antes, ref: 't1' });
    expect(r.resultado).toBe('TRANSFERENCIA_FECHADA');
    expect(r.mensagem).toContain('depois da Supercopa');
    // Segunda 14/12, 9h: a Supercopa acabou e a Copa só começa amanhã. A Janela está aberta.
    const depois = new Date('2026-12-14T12:00:00Z');
    expect(await trocasFechadasAgora(banco, depois)).toBeNull();
    expect((await transferirJogador(banco, id, { times: ['CAP'] }, { quando: depois, ref: 't2' })).resultado).not.toBe('TRANSFERENCIA_FECHADA');
  });

  it('só joga o Elenco da Final da Série A; Cartões não valem nada; o campeão leva o Título e 20 Moedas', async () => {
    await t3Encerrada('ONC', 'TAT');
    const campeao = await inscrever('campeao', 'ONCA', '2026-12-01T12:00:00Z');
    const rival = await inscrever('rival', 'TATU', '2026-12-01T12:00:00Z');
    const t4 = await criarT4();
    // Sábado 12/12, depois da Final: entrou no Elenco, mas não joga a Supercopa.
    const novato = await inscrever('novato', 'ONCA', '2026-12-12T22:00:00Z');
    const [jogo] = await jogoDaSupercopa(t4);
    await rodarPartida(banco, jogo!.id, { seed: 11 });
    const escalados = (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM escalacao WHERE partida_id = $1 AND jogador_id IS NOT NULL`, [jogo!.id])).rows.map((x) => x.id);
    expect(escalados).toEqual(expect.arrayContaining([campeao, rival]));
    expect(escalados).not.toContain(novato);
    // Vermelho e amarelo na Supercopa: ninguém suspenso nem pendurado na Copa.
    await banco.query(`UPDATE escalacao SET expulso = true WHERE partida_id = $1 AND jogador_id = $2`, [jogo!.id, campeao]);
    await banco.query(`UPDATE escalacao SET amarelos = 1 WHERE partida_id = $1 AND jogador_id = $2`, [jogo!.id, rival]);
    const oitava = async (time: TimeId) =>
      (await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = 101 AND (p.mandante_id = $2 OR p.visitante_id = $2)`, [t4, time])).rows[0]!.id;
    expect([...(await suspensos(banco, 'ONC', await oitava('ONC')))]).toEqual([]);
    expect([...(await penduradosAntesDa(banco, await oitava('TAT'), [rival]))]).toEqual([]);
    // Título: campeão gravado e 20 Moedas para quem entrou em campo por ele (uma vez só).
    const vencedor = await fecharSupercopaPendente(banco);
    expect(vencedor === 'ONC' || vencedor === 'TAT').toBe(true);
    expect(await fecharSupercopaPendente(banco)).toBeNull();
    expect((await banco.query<{ c: TimeId }>(`SELECT campeao_supercopa_id AS c FROM temporada WHERE id = $1`, [t4])).rows[0]!.c).toBe(vencedor);
    const pagos = (await banco.query<{ id: string; valor: number }>(`SELECT jogador_id::text AS id, valor FROM lancamento_moedas WHERE tipo = 'TITULO_SUPERCOPA'`)).rows;
    const doCampeao = vencedor === 'ONC' ? campeao : rival;
    const doVice = vencedor === 'ONC' ? rival : campeao;
    expect(pagos).toContainEqual({ id: doCampeao, valor: 20 });
    expect(pagos.map((p) => p.id)).not.toContain(doVice);
    // Site: troféu da Supercopa na Carreira e a Supercopa na História da T4.
    const site = await exportarSite(banco, new Date('2026-12-14T12:00:00Z'));
    const jogadores = site.arquivos.get('jogadores.json') as { id: string; trofeus: { tipo: string }[] }[];
    expect(jogadores.find((j) => j.id === doCampeao)!.trofeus.map((t) => t.tipo)).toContain('CAMPEAO_SUPERCOPA');
    expect(jogadores.find((j) => j.id === doVice)!.trofeus.map((t) => t.tipo)).not.toContain('CAMPEAO_SUPERCOPA');
    const liga = site.arquivos.get('liga.json') as { temporadas: { numero: number; supercopa?: { campeao: TimeId | null } }[]; trocasFechadasAteASupercopa?: boolean };
    expect(liga.temporadas.find((t) => t.numero === 4)?.supercopa?.campeao).toBe(vencedor);
    expect(liga.trocasFechadasAteASupercopa).toBeUndefined();
    const antes = (await exportarSite(banco, new Date('2026-12-13T00:00:00Z'))).arquivos.get('liga.json') as { trocasFechadasAteASupercopa?: boolean };
    expect(antes.trocasFechadasAteASupercopa).toBe(true);
  });

  it('Resumo da Supercopa: Craque do jogo em lista única de 5 e o campeão na legenda', async () => {
    await t3Encerrada('ONC', 'TAT');
    for (const [k, time] of ['ONCA', 'ONCA', 'ONCA', 'TATU', 'TATU', 'TATU'].entries()) await inscrever(`j${k}`, time, '2026-12-01T12:00:00Z');
    const t4 = await criarT4();
    const [jogo] = await jogoDaSupercopa(t4);
    await rodarPartida(banco, jogo!.id, { seed: 7 });
    const rodada = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND numero = 100`, [t4])).rows[0]!.id;
    await fecharRodada(banco, rodada);
    const d = await dadosDoResumo(banco, rodada);
    expect(d.tabelaB).toBeUndefined();
    expect(d.candidatos.map((c) => c.rotulo)).toEqual(['1', '2', '3', '4', '5']);
    expect(d.campeaoSupercopa).toBeDefined();
    const legenda = legendaDoResumo(d);
    expect(legenda.split('\n')[0]).toBe('📋 Resumo da Supercopa da Temporada 4');
    expect(legenda).toContain('é campeão da Supercopa da Temporada 4!');
    expect(legenda).toContain('Quem é o Craque da Supercopa?');
    expect(legenda).toContain('#supercopa');
  });

  it('o Resumo da Temporada 3 anuncia a Supercopa que abre a T4', async () => {
    await t3Encerrada('ONC', 'TAT');
    await criarT4();
    const s = await supercopaDaTemporada(banco, 4);
    expect(s).toEqual({ mandante: 'ONC', visitante: 'TAT', dia: '2026-12-13' });
    const legenda = legendaDoFimDaTemporada(3, undefined, { username: 'craque', time: 'ONC', jogos: 9, gols: 5, media: 7.5, votos: 10 }, { numero: 4, inicio: '2026-12-15' }, null, false, s);
    expect(legenda).toContain('⚡ Supercopa: Onça × Tatu, domingo 13/12 às 18h, abrindo a Temporada 4. A Janela de Transferências abre depois dela.');
    expect(legenda).toContain('A Temporada 4 começa em 15/12, com a Copa.');
  });
});

describe('Supercopa e o Técnico que pendurou (ADR-0118 + ADR-0111)', () => {
  it('quem pendurou na T3 só volta a jogar na Janela da T4, que abre depois da Supercopa', async () => {
    const { aprovarTecnico } = await import('../src/tecnico.js');
    const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    await inscrever('bruninho', 'TATU', '2026-11-29T12:00:00Z');
    await aprovarTecnico(banco, { username: 'bruninho', time: 'TAT', agora: new Date('2026-12-05T12:00:00Z'), naJanela: false });
    const final = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', '2026-12-11') RETURNING id`, [t3, estruturaDaLiga(7).rodadaDaFinal])).rows[0]!.id;
    await banco.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie) VALUES ($1, 'ONC', 'TAT', '2026-12-11T21:00:00Z', 'A')`, [final]);
    await banco.query(`UPDATE temporada SET status = 'ENCERRADA', campeao_id = 'ONC', campeao_copa_id = 'SAG' WHERE id = $1`, [t3]);
    await criarT4();
    const comentar = (em: string) =>
      processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: 'bruninho', username: 'bruninho', texto: 'ENTRO TATU ATA', comentadoEm: new Date(em) }, { rodadaEmVotacao: null });
    // Sábado 12/12, 20h de Brasília: a T4 nasceu, mas a Janela só abre depois da Supercopa (domingo 18h).
    expect(await comentar('2026-12-12T23:00:00Z')).toBe('TECNICO_FORA');
    // Domingo 13/12, 19h: a Supercopa acabou, a Janela está aberta (fecha no Corte do 1º jogo da Copa, terça).
    expect(await comentar('2026-12-13T22:00:00Z')).not.toBe('TECNICO_FORA');
    expect((await banco.query(`SELECT 1 FROM jogador WHERE username = 'bruninho'`)).rows).toHaveLength(1);
  });
});
