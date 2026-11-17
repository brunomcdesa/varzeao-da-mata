import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HABILIDADES, TIMES_FUNDADORES, TIMES_NOVOS, habilidadesComOvr, habilidadesDoPerfil, ovrDasHabilidades, type Habilidades, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { forcarCapitao, forcarOvr, tirarCapitao } from '../src/aMao.js';
import { criarTemporada } from '../src/calendario.js';
import { moverJogador, processarComentario } from '../src/coletar.js';
import { capitaoDaPartida, ordemDoCapitao } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

let n = 0;
async function inscrever(time: TimeId, posicao: string, quem: string, em: string): Promise<string> {
  await processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date(em) }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}
const novaT2 = () => criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
const primeiraPartida = async (temporadaId: number, time: TimeId) =>
  (
    await banco.query<{ id: number }>(
      `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND (p.mandante_id = $2 OR p.visitante_id = $2) ORDER BY p.apito_inicial LIMIT 1`,
      [temporadaId, time],
    )
  ).rows[0]!;

describe('Capitão à mão (ADR-0078)', () => {
  it('sem gravar é só simulação; gravado, vai para a frente da ordem da faixa', async () => {
    await novaT2();
    const veterano = await inscrever('ONC', 'MEI', 'veterano', '2026-11-10T12:00:00Z');
    const novato = await inscrever('ONC', 'ATA', 'novato', '2026-11-12T12:00:00Z');
    const sim = await forcarCapitao(banco, '@novato', { gravar: false });
    expect(sim).toEqual({ time: 'ONC', antes: 'veterano', depois: 'novato', gravado: false });
    expect(await ordemDoCapitao(banco, 'ONC')).toEqual([veterano, novato]);
    expect((await forcarCapitao(banco, 'novato', { gravar: true })).depois).toBe('novato');
    expect(await ordemDoCapitao(banco, 'ONC')).toEqual([novato, veterano]);
  });

  it('sem Vínculo num jogo, a faixa segue a regra de sempre naquele jogo', async () => {
    const t2 = await novaT2();
    const veterano = await inscrever('ONC', 'MEI', 'veterano', '2026-11-10T12:00:00Z');
    const novato = await inscrever('ONC', 'ATA', 'novato', '2026-11-12T12:00:00Z');
    await forcarCapitao(banco, 'novato', { gravar: true });
    const p = await primeiraPartida(t2, 'ONC');
    expect(await capitaoDaPartida(banco, p.id, 'ONC', new Set([novato, veterano]))).toBe(novato);
    expect(await capitaoDaPartida(banco, p.id, 'ONC', new Set([veterano]))).toBe(veterano);
  });

  it('um por Time: o novo substitui o anterior; tirar devolve a faixa à regra de mais Partidas', async () => {
    await novaT2();
    const veterano = await inscrever('ONC', 'MEI', 'veterano', '2026-11-10T12:00:00Z');
    const a = await inscrever('ONC', 'ATA', 'atacante', '2026-11-11T12:00:00Z');
    const z = await inscrever('ONC', 'ZAG', 'zagueiro', '2026-11-12T12:00:00Z');
    await forcarCapitao(banco, 'atacante', { gravar: true });
    await forcarCapitao(banco, 'zagueiro', { gravar: true });
    expect(await ordemDoCapitao(banco, 'ONC')).toEqual([z, veterano, a]);
    expect(await tirarCapitao(banco, 'ONC', { gravar: false })).toEqual({ time: 'ONC', antes: 'zagueiro', depois: 'veterano', gravado: false });
    expect((await ordemDoCapitao(banco, 'ONC'))[0]).toBe(z);
    await tirarCapitao(banco, 'ONC', { gravar: true });
    expect(await ordemDoCapitao(banco, 'ONC')).toEqual([veterano, a, z]);
    await expect(tirarCapitao(banco, 'ONC', { gravar: true })).rejects.toThrow('não tem Capitão à mão');
  });

  it('quem muda de Time perde a faixa à mão, e ela não volta se ele voltar', async () => {
    await novaT2();
    const veterano = await inscrever('ONC', 'MEI', 'veterano', '2026-11-10T12:00:00Z');
    const novato = await inscrever('ONC', 'ATA', 'novato', '2026-11-12T12:00:00Z');
    await forcarCapitao(banco, 'novato', { gravar: true });
    await moverJogador(banco, 'novato', 'SAG');
    await moverJogador(banco, 'novato', 'ONC');
    expect(await ordemDoCapitao(banco, 'ONC')).toEqual([veterano, novato]);
    expect((await banco.query(`SELECT 1 FROM capitao_a_mao`)).rows).toEqual([]);
  });

  it('@ desconhecido é recusado', async () => {
    await novaT2();
    await expect(forcarCapitao(banco, 'ninguem', { gravar: true })).rejects.toThrow('Nenhum Jogador @ninguem');
  });
});

describe('OVR à mão (ADR-0078)', () => {
  it('escala todas as Habilidades juntas e bate o OVR pedido, para cima e para baixo', () => {
    for (const posicao of ['ATA', 'MEI', 'ZAG', 'GOL'] as const) {
      const antes = habilidadesDoPerfil(posicao, 64, { FIN: 0.3, PAS: -0.5, DRI: 0.8, DEF: -0.2, GOL: 0.1 });
      for (const alvo of [50, 63, 64, 72, 85, 99]) {
        const depois = habilidadesComOvr(posicao, antes, alvo);
        expect(ovrDasHabilidades(posicao, depois)).toBe(alvo);
        for (const h of HABILIDADES) {
          expect(depois[h]).toBeGreaterThanOrEqual(1);
          expect(depois[h]).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('mantém o perfil: a ordem das Habilidades não muda', () => {
    const antes: Habilidades = { FIN: 70, DRI: 66, PAS: 60, DEF: 48, GOL: 30 };
    const depois = habilidadesComOvr('ATA', antes, 75);
    const ordem = (h: Habilidades) => [...HABILIDADES].sort((x, y) => h[y] - h[x]);
    expect(ordem(depois)).toEqual(ordem(antes));
    expect(depois.DRI / antes.DRI).toBeCloseTo(depois.DEF / antes.DEF, 1);
  });

  it('recusa OVR fora de 1 a 99 ou quebrado', () => {
    const h = habilidadesDoPerfil('MEI', 64);
    expect(() => habilidadesComOvr('MEI', h, 100)).toThrow('inválido');
    expect(() => habilidadesComOvr('MEI', h, 0)).toThrow('inválido');
    expect(() => habilidadesComOvr('MEI', h, 70.5)).toThrow('inválido');
  });

  it('sem gravar não muda nada; gravado, muda o Jogador e guarda o histórico', async () => {
    await novaT2();
    const id = await inscrever('ONC', 'ATA', 'artilheiro', '2026-11-10T12:00:00Z');
    const ovrAntes = (await banco.query<{ ovr: number }>(`SELECT ovr FROM jogador WHERE id = $1`, [id])).rows[0]!.ovr;
    const sim = await forcarOvr(banco, 'artilheiro', 80, { gravar: false });
    expect(sim).toMatchObject({ ovrAntes, ovrDepois: 80, gravado: false });
    expect((await banco.query<{ ovr: number }>(`SELECT ovr FROM jogador WHERE id = $1`, [id])).rows[0]!.ovr).toBe(ovrAntes);
    await forcarOvr(banco, 'artilheiro', 80, { gravar: true });
    const j = (await banco.query<{ ovr: number; habilidades: Habilidades | string }>(`SELECT ovr, habilidades FROM jogador WHERE id = $1`, [id])).rows[0]!;
    const h = typeof j.habilidades === 'string' ? (JSON.parse(j.habilidades) as Habilidades) : j.habilidades;
    expect(j.ovr).toBe(80);
    expect(ovrDasHabilidades('ATA', h)).toBe(80);
    expect((await banco.query<{ ovr_antes: number; ovr_depois: number }>(`SELECT ovr_antes, ovr_depois FROM ovr_a_mao WHERE jogador_id = $1`, [id])).rows).toEqual([
      { ovr_antes: ovrAntes, ovr_depois: 80 },
    ]);
  });
});
