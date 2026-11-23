import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, habilidadesDoPerfil, ovrDasHabilidades, type Escalacao, type Habilidades, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { corrigirOvrForaDePosicao, ovrCorrigido, trocasDepoisDeJogoFora } from '../src/foraDePosicao.js';
import { ovrQueFica, posicaoDeInscricao, rodarPartida } from '../src/partida.js';
import { ovrNoHistorico } from '../src/site.js';
import { bancoDeTeste } from './banco-de-teste.js';

const meia: Habilidades = habilidadesDoPerfil('MEI', 65);
const escalacao = (jogadores: Escalacao['jogadores'], banco?: Escalacao['jogadores']): Escalacao =>
  ({ time: 'ONC', jogadores, ...(banco ? { banco } : {}) }) as unknown as Escalacao;

describe('OVR de quem jogou fora de posição (ADR-0098)', () => {
  it('o titular fora de posição fica com o OVR da Posição dele, não o da vaga', () => {
    const e = escalacao([{ jogadorId: 'm1', posicao: 'ZAG', ovr: ovrDasHabilidades('ZAG', meia), habilidades: meia, posicaoDeOrigem: 'MEI' }]);
    const d = { jogadorId: 'm1', posicao: 'ZAG' as const, ovrDepois: ovrDasHabilidades('ZAG', meia), habilidadesDepois: meia };
    expect(ovrDasHabilidades('ZAG', meia)).toBeLessThan(65);
    expect(posicaoDeInscricao(d, e)).toBe('MEI');
    expect(ovrQueFica(d, e)).toBe(65);
  });

  it('o reserva que entrou fora de posição também fica com o OVR da Posição dele', () => {
    const e = escalacao([], [{ jogadorId: 'm2', posicao: 'MEI', ovr: 65, habilidades: meia }]);
    const d = { jogadorId: 'm2', posicao: 'ATA' as const, posicaoDeOrigem: 'MEI' as const, ovrDepois: ovrDasHabilidades('ATA', meia), habilidadesDepois: meia };
    expect(ovrQueFica(d, e)).toBe(65);
  });

  it('na Posição dele, nada muda', () => {
    const e = escalacao([{ jogadorId: 'm3', posicao: 'MEI', ovr: 65, habilidades: meia }]);
    expect(ovrQueFica({ jogadorId: 'm3', posicao: 'MEI', ovrDepois: 66, habilidadesDepois: meia }, e)).toBe(66);
  });

  it('o histórico do site usa o OVR da Posição dele', () => {
    const d = { jogadorId: '7', posicao: 'ZAG' as const, ovrDepois: ovrDasHabilidades('ZAG', meia), habilidadesDepois: meia };
    expect(ovrNoHistorico(d, [{ jogador_id: '7', posicao: 'ZAG', posicao_de_origem: 'MEI' }])).toBe(65);
    expect(ovrNoHistorico({ ...d, posicao: 'MEI', ovrDepois: 65 }, [{ jogador_id: '7', posicao: 'MEI', posicao_de_origem: null }])).toBe(65);
  });

  it('a correção só mexe em quem está com o OVR errado', () => {
    expect(ovrCorrigido('MEI', ovrDasHabilidades('ZAG', meia), meia)).toBe(65);
    expect(ovrCorrigido('MEI', 65, meia)).toBeNull();
  });
});

describe('OVR fora de posição no banco (ADR-0098)', () => {
  let banco: Banco;
  beforeEach(async () => {
    banco = await bancoDeTeste();
  });
  afterEach(async () => {
    await banco.fechar();
  });

  const direto = async (time: TimeId, posicao: string, quem: string) =>
    (
      await banco.query<{ id: string }>(
        `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, habilidades, inscrito_em) VALUES ($1, $1, $2, $3, 65, NULL, '2026-11-12T12:00:00Z') RETURNING id::text AS id`,
        [quem, time, posicao],
      )
    ).rows[0]!.id;

  it('depois do jogo, o meia que jogou de zagueiro fica com o OVR de meia; a correção conserta o OVR antigo', async () => {
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
    const p = (
      await banco.query<{ id: number; mandante_id: TimeId }>(
        `SELECT p.id, p.mandante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial LIMIT 1`,
        [t2],
      )
    ).rows[0]!;
    // Três meias e mais ninguém: o 3º cobre uma vaga de zagueiro no 2-2-2 da T2.
    for (const q of ['fm1', 'fm2', 'fm3']) await direto(p.mandante_id, 'MEI', q);
    await rodarPartida(banco, p.id, { seed: 21 });

    const fora = (
      await banco.query<{ id: string; ovr: number; habilidades: Habilidades; ovr_depois: number }>(
        `SELECT j.id::text AS id, j.ovr, j.habilidades, e.ovr_depois FROM escalacao e JOIN jogador j ON j.id = e.jogador_id
          WHERE e.partida_id = $1 AND e.posicao_de_origem = 'MEI'`,
        [p.id],
      )
    ).rows;
    expect(fora).toHaveLength(1);
    const f = fora[0]!;
    // A Escalação guarda o OVR da vaga (é o da Partida); o Jogador fica com o da Posição dele.
    expect(f.ovr_depois).toBe(ovrDasHabilidades('ZAG', f.habilidades));
    expect(f.ovr).toBe(ovrDasHabilidades('MEI', f.habilidades));
    expect(f.ovr).not.toBe(f.ovr_depois);

    // Como ficava antes da correção: o OVR da vaga no Jogador. A manutenção devolve o da Posição.
    await banco.query(`UPDATE jogador SET ovr = $2 WHERE id = $1`, [f.id, f.ovr_depois]);
    const feitas = await corrigirOvrForaDePosicao(banco);
    expect(feitas.map((x) => [x.id, x.antes, x.depois])).toEqual([[f.id, f.ovr_depois, f.ovr]]);
    const depois = (await banco.query<{ ovr: number; habilidades: Habilidades }>(`SELECT ovr, habilidades FROM jogador WHERE id = $1`, [f.id])).rows[0]!;
    expect(depois.ovr).toBe(f.ovr);
    expect(depois.habilidades).toEqual(f.habilidades);
    // Rodar de novo não muda nada.
    expect(await corrigirOvrForaDePosicao(banco)).toEqual([]);
  });

  it('aponta quem trocou de posição logo depois de jogar fora de posição', async () => {
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
    const p = (
      await banco.query<{ id: number; mandante_id: TimeId; apito_inicial: Date }>(
        `SELECT p.id, p.mandante_id, p.apito_inicial FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial LIMIT 1`,
        [t2],
      )
    ).rows[0]!;
    for (const q of ['tm1', 'tm2', 'tm3']) await direto(p.mandante_id, 'MEI', q);
    await rodarPartida(banco, p.id, { seed: 21 });
    const f = (
      await banco.query<{ id: string; username: string; habilidades_depois: Habilidades; ovr_depois: number }>(
        `SELECT j.id::text AS id, j.username, e.habilidades_depois, e.ovr_depois FROM escalacao e JOIN jogador j ON j.id = e.jogador_id
          WHERE e.partida_id = $1 AND e.posicao_de_origem = 'MEI'`,
        [p.id],
      )
    ).rows[0]!;
    expect(await trocasDepoisDeJogoFora(banco)).toEqual([]);
    // Trocou de meia para atacante depois do jogo.
    const depois = new Date(new Date(p.apito_inicial).getTime() + 86_400_000);
    await banco.query(
      `INSERT INTO transferencia (jogador_id, temporada_id, de_time, para_time, de_posicao, para_posicao, ig_comment_id, feita_em) VALUES ($1, $2, $3, $3, 'MEI', 'ATA', 'x', $4)`,
      [f.id, t2, p.mandante_id, depois],
    );
    expect(await trocasDepoisDeJogoFora(banco)).toEqual([
      { username: f.username, de: 'MEI', para: 'ATA', ovrNaTroca: f.ovr_depois, ovrCerto: ovrDasHabilidades('MEI', f.habilidades_depois) },
    ]);
  });
});

describe('OVR da Escalação no site (ADR-0099)', () => {
  it('quem foi escalado com o OVR da vaga gravado aparece com o das Habilidades', async () => {
    const { ovrPelasHabilidades } = await import('../src/site.js');
    const ata = habilidadesDoPerfil('ATA', 65);
    expect(ovrPelasHabilidades('ATA', 47, ata)).toBe(65);
    expect(ovrPelasHabilidades('ATA', 47, JSON.stringify(ata))).toBe(65);
  });

  it('fora de posição de verdade continua com o OVR da vaga', async () => {
    const { ovrPelasHabilidades } = await import('../src/site.js');
    const meia2 = habilidadesDoPerfil('MEI', 65);
    expect(ovrPelasHabilidades('ZAG', ovrDasHabilidades('ZAG', meia2), meia2)).toBe(ovrDasHabilidades('ZAG', meia2));
  });

  it('sem Habilidades gravadas, fica o OVR gravado', async () => {
    const { ovrPelasHabilidades } = await import('../src/site.js');
    expect(ovrPelasHabilidades('MEI', 60, null)).toBe(60);
  });
});
