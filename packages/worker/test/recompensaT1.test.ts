import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PISO_DA_TEMPORADA_1,
  POSICOES,
  PRINCIPAL,
  TIMES_FUNDADORES,
  TIMES_NOVOS,
  habilidadesDoPerfil,
  ovrDasHabilidades,
  temBonusT1,
  type JogadorPublico,
  type Posicao,
  type TimeId,
} from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { escalarPartida } from '../src/escalacao.js';
import { aplicarPiso, numerosDaTemporada1, recompensarT1 } from '../src/recompensaT1.js';
import { exportarSite } from '../src/site.js';
import { bancoDeTeste } from './banco-de-teste.js';

describe('Piso da Temporada 1 (ADR-0047)', () => {
  it('abaixo do piso: só a Habilidade principal sobe, e o OVR chega exatamente no piso', () => {
    for (const posicao of POSICOES) {
      for (const ovr of [55, 59, 60, 62]) {
        const antes = habilidadesDoPerfil(posicao, ovr);
        const depois = aplicarPiso(posicao, antes);
        expect(ovrDasHabilidades(posicao, depois)).toBe(PISO_DA_TEMPORADA_1);
        for (const [hab, valor] of Object.entries(depois)) {
          if (hab === PRINCIPAL[posicao]) expect(valor).toBeGreaterThan(antes[hab as keyof typeof antes]);
          else expect(valor).toBe(antes[hab as keyof typeof antes]);
        }
      }
    }
  });

  it('no piso ou acima: nada muda', () => {
    for (const posicao of POSICOES) {
      for (const ovr of [63, 64, 72]) {
        const antes = habilidadesDoPerfil(posicao, ovr);
        expect(aplicarPiso(posicao, antes)).toEqual(antes);
      }
    }
  });
});

describe('Bônus da Temporada 1 (ADR-0047)', () => {
  it('vale só nas 3 primeiras Rodadas da Fase de Liga da Temporada 2', () => {
    expect([1, 2, 3].every((r) => temBonusT1(2, r, 'LIGA'))).toBe(true);
    expect(temBonusT1(2, 4, 'LIGA')).toBe(false);
    expect(temBonusT1(2, 1, 'MATA_MATA')).toBe(false);
    expect(temBonusT1(1, 1, 'LIGA')).toBe(false);
    expect(temBonusT1(3, 1, 'LIGA')).toBe(false);
  });
});

describe('recompensarT1 no banco', () => {
  let banco: Banco;
  beforeEach(async () => {
    banco = await bancoDeTeste();
  });
  afterEach(async () => {
    await banco.fechar();
  });

  let n = 0;
  async function jogador(time: TimeId, posicao: Posicao, ovr: number, em: string): Promise<string> {
    const u = `j${++n}`;
    return (
      await banco.query<{ id: string }>(
        `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, habilidades, inscrito_em) VALUES ($1, $1, $2, $3, $4, $5, $6) RETURNING id::text AS id`,
        [u, time, posicao, ovr, JSON.stringify(habilidadesDoPerfil(posicao, ovr)), em],
      )
    ).rows[0]!.id;
  }
  const t1 = () => criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
  const t2 = async () => {
    await banco.query(`UPDATE temporada SET status = 'ENCERRADA' WHERE numero = 1`);
    return criarTemporada(banco, { numero: 2, primeiraRodada: '2026-12-01', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
  };
  const ovrDe = async (id: string) => (await banco.query<{ ovr: number; habilidades: Record<string, number> }>(`SELECT ovr, habilidades FROM jogador WHERE id = $1`, [id])).rows[0]!;

  it('não roda na Temporada 1', async () => {
    await t1();
    await jogador('ONC', 'ATA', 60, '2026-11-06T12:00:00Z');
    await expect(recompensarT1(banco, { gravar: true })).rejects.toThrow('Pré-temporada da Temporada 2');
  });

  it('a simulação não grava nada', async () => {
    await t1();
    const baixo = await jogador('ONC', 'ATA', 60, '2026-11-06T12:00:00Z');
    await t2();
    const r = await recompensarT1(banco, { gravar: false });
    expect(r.gravado).toBe(false);
    expect(r.recompensados.find((x) => x.id === baixo)?.ovrDepois).toBe(63);
    expect((await ovrDe(baixo)).ovr).toBe(60);
    expect((await banco.query(`SELECT 1 FROM selo_temporada1`)).rows).toHaveLength(0);
  });

  it('gravado: Selo para quem se inscreveu na T1, Piso só para quem estava abaixo, e uma vez só', async () => {
    await t1();
    const baixo = await jogador('ONC', 'ZAG', 59, '2026-11-06T12:00:00Z');
    const alto = await jogador('CAP', 'MEI', 68, '2026-11-08T12:00:00Z');
    const novato = await jogador('TAT', 'ATA', 60, '2026-11-30T12:00:00Z'); // depois do último jogo da T1
    const id = await t2();
    const r = await recompensarT1(banco, { gravar: true, agora: new Date('2026-11-29T12:00:00Z') });
    expect(r.recompensados.map((x) => x.id).sort()).toEqual([baixo, alto].sort());
    expect((await ovrDe(baixo)).ovr).toBe(63);
    expect((await ovrDe(alto)).ovr).toBe(68);
    expect((await ovrDe(novato)).ovr).toBe(60);
    const selos = (await banco.query<{ jogador_id: string; ovr_antes: number; ovr_depois: number }>(`SELECT jogador_id::text AS jogador_id, ovr_antes, ovr_depois FROM selo_temporada1 ORDER BY jogador_id`)).rows;
    expect(selos).toEqual(expect.arrayContaining([{ jogador_id: baixo, ovr_antes: 59, ovr_depois: 63 }, { jogador_id: alto, ovr_antes: 68, ovr_depois: 68 }]));
    await expect(recompensarT1(banco, { gravar: true })).rejects.toThrow('já foi aplicada');

    // O site da T2 mostra o Selo só para quem tem.
    const site = (await exportarSite(banco, new Date('2026-12-01T15:00:00Z'))).arquivos.get('jogadores.json') as JogadorPublico[];
    const doSite = (jid: string) => site.find((j) => j.id === jid)!;
    expect(doSite(baixo).seloT1).toBe(true);
    expect(doSite(novato).seloT1).toBeUndefined();

    // Escalação: Bônus nas 3 primeiras Rodadas da T2, não na 4ª.
    const partidaDaRodada = async (rodada: number, time: TimeId) =>
      (
        await banco.query<{ id: number }>(
          `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = $2 AND (p.mandante_id = $3 OR p.visitante_id = $3)`,
          [id, rodada, time],
        )
      ).rows[0]!.id;
    const comBonus = async (partida: number) =>
      (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM escalacao WHERE partida_id = $1 AND bonus_t1`, [partida])).rows.map((x) => x.id).sort();
    const p1 = await partidaDaRodada(1, 'ONC');
    const e1 = await escalarPartida(banco, p1);
    expect(await comBonus(p1)).toEqual([baixo]);
    expect(Object.values(e1.escalacoes).flatMap((e) => e.jogadores).filter((j) => j.bonusT1).map((j) => j.jogadorId)).toEqual([baixo]);
    // Relida do banco (reexecução do job), continua com o Bônus.
    const relida = await escalarPartida(banco, p1);
    expect(Object.values(relida.escalacoes).flatMap((e) => e.jogadores).filter((j) => j.bonusT1).map((j) => j.jogadorId)).toEqual([baixo]);
    const p4 = await partidaDaRodada(4, 'ONC');
    await escalarPartida(banco, p4);
    expect(await comBonus(p4)).toEqual([]);
  });

  it('números do Reels de agradecimento: inscritos da T1, jogos e gols jogados', async () => {
    const id = await t1();
    await jogador('ONC', 'ZAG', 59, '2026-11-06T12:00:00Z');
    await jogador('CAP', 'MEI', 68, '2026-11-08T12:00:00Z');
    await jogador('TAT', 'ATA', 60, '2026-11-30T12:00:00Z'); // depois do último jogo da T1
    await expect(numerosDaTemporada1(banco)).rejects.toThrow('ainda não tem jogos');
    const ps = (await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial DESC`, [id])).rows;
    // O último jogo e um do meio, com 3 e 2 gols.
    await banco.query(`UPDATE partida SET gols_mandante = 2, gols_visitante = 1 WHERE id = $1`, [ps[0]!.id]);
    await banco.query(`UPDATE partida SET gols_mandante = 0, gols_visitante = 2 WHERE id = $1`, [ps[5]!.id]);
    expect(await numerosDaTemporada1(banco)).toEqual({ inscritos: 2, jogos: 2, gols: 5 });
  });
});
