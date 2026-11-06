import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { rodarPartida, subtituloDaPartida, type DadosDoVideo } from '../src/partida.js';
import { tabela } from '../src/tabela.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let temporada: number;
let n = 0;

async function inscrever(id: string, texto: string) {
  await processarComentario(
    banco,
    { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: id, username: id, texto, comentadoEm: new Date(Date.UTC(2026, 10, 6, 10)) },
    { rodadaEmVotacao: null },
  );
}
const partidasDaRodada = async (r: number) =>
  (
    await banco.query<{ id: number }>(
      `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = $2 ORDER BY p.apito_inicial`,
      [temporada, r],
    )
  ).rows.map((x) => x.id);

beforeEach(async () => {
  banco = await bancoDeTeste();
  temporada = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
});
afterEach(async () => {
  await banco.fechar();
});

describe('Job partida', () => {
  it('escala, simula e grava Notas e OVRs; a Base não muda de OVR', async () => {
    for (const [u, t] of [['g', 'GOL'], ['z', 'ZAG'], ['m', 'MEI'], ['a', 'ATA']]) await inscrever(u!, `ENTRO CAPIVARA ${t}`);
    const [id] = await partidasDaRodada(1);
    const r = await rodarPartida(banco, id!, { seed: 11 });
    expect(r.status).toBe('SIMULADA');

    const p = (await banco.query<{ seed: string; gols_mandante: number; gols_visitante: number; versao_sim: number }>(`SELECT * FROM partida WHERE id = $1`, [id])).rows[0]!;
    expect(Number(p.seed)).toBe(11);
    expect(p.gols_mandante).toBe(r.resultado.gols.mandante);

    const esc = (await banco.query<{ jogador_id: string | null; nota: string; ovr_antes: number; ovr_depois: number }>(`SELECT * FROM escalacao WHERE partida_id = $1`, [id])).rows;
    expect(esc).toHaveLength(14);
    expect(esc.every((e) => e.nota !== null && e.ovr_depois !== null)).toBe(true);
    expect(esc.filter((e) => e.jogador_id === null).every((e) => e.ovr_antes === e.ovr_depois)).toBe(true);

    // O OVR do Jogador no banco é o OVR depois da Partida.
    for (const e of esc.filter((x) => x.jogador_id !== null)) {
      const [j] = (await banco.query<{ ovr: number }>(`SELECT ovr FROM jogador WHERE id = $1`, [e.jogador_id])).rows;
      expect(j!.ovr).toBe(e.ovr_depois);
    }
  });

  it('reexecutar não simula de novo nem mexe no OVR outra vez', async () => {
    await inscrever('a', 'ENTRO CAPIVARA ATA');
    const ids = await partidasDaRodada(1);
    const primeira = await rodarPartida(banco, ids[0]!, { seed: 5 });
    const ovr1 = (await banco.query<{ ovr: number }>(`SELECT ovr FROM jogador`)).rows[0]!.ovr;
    const segunda = await rodarPartida(banco, ids[0]!, { seed: 999 });
    expect(segunda.resultado).toEqual(primeira.resultado);
    expect((await banco.query<{ ovr: number }>(`SELECT ovr FROM jogador`)).rows[0]!.ovr).toBe(ovr1);
  });

  it('grava o Reels uma única vez e marca RENDERIZADA', async () => {
    const [id] = await partidasDaRodada(1);
    const chamadas: DadosDoVideo[] = [];
    const gravador = async (d: DadosDoVideo) => {
      chamadas.push(d);
    };
    const r = await rodarPartida(banco, id!, { seed: 1, gravar: { gravador, saida: '/tmp/x.mp4' } });
    expect(r.status).toBe('RENDERIZADA');
    expect(r.video).toBe('file:///tmp/x.mp4');
    expect(chamadas[0]!.subtitulo).toBe('Rodada 1, jogo das 12h');
    await rodarPartida(banco, id!, { gravar: { gravador, saida: '/tmp/x.mp4' } });
    expect(chamadas).toHaveLength(1);
  });

  it('uma Rodada inteira atualiza a tabela', async () => {
    for (const id of await partidasDaRodada(1)) await rodarPartida(banco, id, { seed: id });
    const t = await tabela(banco, temporada);
    expect(t.every((l) => l.jogos === 1)).toBe(true);
    const pontos = t.reduce((s, l) => s + l.pontos, 0);
    expect(pontos).toBeGreaterThanOrEqual(8); // 4 jogos: entre 8 (4 empates) e 12 pontos
    expect(pontos).toBeLessThanOrEqual(12);
  });
});

describe('Subtítulo do Reels', () => {
  it('usa a Rodada e o horário de Brasília', () => {
    expect(subtituloDaPartida(3, 'LIGA', new Date('2026-11-09T17:00:00Z'))).toBe('Rodada 3, jogo das 14h');
  });
});
