import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { simularPartida } from '@liga/sim';
import type { Banco } from '../src/banco.js';
import { processarComentario } from '../src/coletar.js';
import { escalarPartida } from '../src/escalacao.js';
import { OVR_BASE } from '../src/regras.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let rodadaId: number;
let n = 0;
const DIA = Date.UTC(2026, 10, 6);
const hora = (h: number, m = 0) => new Date(DIA + (h + 3) * 3600_000 + m * 60_000); // horário de Brasília

async function inscrever(id: string, texto: string, quando = hora(9)) {
  return processarComentario(
    banco,
    { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: id, username: id, texto, comentadoEm: quando },
    { rodadaEmVotacao: null },
  );
}
async function novaPartida(mandante: string, visitante: string, apito: Date): Promise<number> {
  return (
    await banco.query<{ id: number }>(
      `INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial) VALUES ($1, $2, $3, $4) RETURNING id`,
      [rodadaId, mandante, visitante, apito.toISOString()],
    )
  ).rows[0]!.id;
}

beforeEach(async () => {
  banco = await bancoDeTeste();
  const t = (await banco.query<{ id: number }>(`INSERT INTO temporada (numero, inicio) VALUES (1, '2026-11-06') RETURNING id`)).rows[0]!;
  rodadaId = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, 1, 'LIGA', '2026-11-06') RETURNING id`, [t.id])).rows[0]!.id;
});
afterEach(async () => {
  await banco.fechar();
});

describe('Escalação', () => {
  it('sem inscritos, o Time joga só com Jogadores da Base', async () => {
    const p = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(12)));
    expect(p.escalacoes.mandante.jogadores.map((j) => j.posicao)).toEqual(['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA']);
    expect(p.escalacoes.mandante.jogadores.every((j) => j.jogadorId === null && j.ovr === OVR_BASE)).toBe(true);
    expect(p.nomes.mandante.every((x) => x === null)).toBe(true);
  });

  it('põe os inscritos na Posição deles e completa com a Base', async () => {
    await inscrever('goleira', 'ENTRO CAPIVARA GOL');
    await inscrever('artilheiro', 'ENTRO CAPIVARA ATA');
    const p = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(12)));
    expect(p.nomes.mandante).toEqual(['@goleira', null, null, null, null, '@artilheiro', null]);
  });

  it('quem se inscreveu depois do Corte fica para a próxima Partida', async () => {
    await inscrever('cedo', 'ENTRO CAPIVARA ATA', hora(11, 29));
    await inscrever('tarde', 'ENTRO CAPIVARA ATA', hora(11, 31)); // Corte das 12h é 11h30
    const p = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(12)));
    expect(p.nomes.mandante.filter(Boolean)).toEqual(['@cedo']);
  });

  it('faz rodízio: quem não jogou entra na próxima', async () => {
    for (const a of ['a1', 'a2', 'a3']) await inscrever(a, 'ENTRO CAPIVARA ATA');
    const p1 = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(12)));
    expect(p1.nomes.mandante.slice(5)).toEqual(['@a1', '@a2']);
    const p2 = await escalarPartida(banco, await novaPartida('TAT', 'CAP', hora(16)));
    expect(p2.nomes.visitante.slice(5)).toEqual(['@a3', '@a1']);
  });

  it('o Craque da Rodada anterior tem lugar garantido', async () => {
    for (const a of ['a1', 'a2', 'a3']) await inscrever(a, 'ENTRO CAPIVARA ATA');
    await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(12)));
    const craque = (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE username = 'a1'`)).rows[0]!.id;
    const p2 = await escalarPartida(banco, await novaPartida('CAP', 'TAT', hora(16)), { craque });
    expect(p2.nomes.mandante.slice(5)).toEqual(['@a1', '@a3']);
  });

  it('banido não é escalado', async () => {
    await inscrever('a1', 'ENTRO CAPIVARA ATA');
    await banco.query(`UPDATE jogador SET banido = true`);
    const p = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(12)));
    expect(p.nomes.mandante.filter(Boolean)).toEqual([]);
  });

  it('escalar de novo devolve a mesma Escalação (retoma de onde parou)', async () => {
    await inscrever('a1', 'ENTRO CAPIVARA ATA');
    const id = await novaPartida('CAP', 'ONC', hora(12));
    const primeira = await escalarPartida(banco, id);
    await inscrever('a2', 'ENTRO CAPIVARA ATA');
    expect(await escalarPartida(banco, id)).toEqual(primeira);
    const [s] = (await banco.query<{ status: string }>(`SELECT status FROM partida WHERE id = $1`, [id])).rows;
    expect(s!.status).toBe('ESCALADA');
  });

  it('a Escalação montada roda na simulação', async () => {
    for (const [u, t] of [['g', 'ENTRO CAPIVARA GOL'], ['z', 'ENTRO CAPIVARA ZAG'], ['m', 'ENTRO ONCA MEI'], ['a', 'ENTRO ONCA ATA']] as const) await inscrever(u, t);
    const p = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(12)));
    const r = simularPartida({ ...p.escalacoes, seed: 42, fase: 'LIGA' });
    expect(r.desempenhos).toHaveLength(14);
    expect(r.desempenhos.filter((d) => d.jogadorId !== null)).toHaveLength(4);
  });
});

describe('Resenha (ADR-0034)', () => {
  const comentar = (id: string, midia: string, quando: Date, texto = 'que jogo!') =>
    processarComentario(banco, { igCommentId: `r${++n}`, igMediaId: midia, igUserId: id, username: id, texto, comentadoEm: quando }, { rodadaEmVotacao: null });
  const publicar = (partidaId: number, midia: string) => banco.query(`UPDATE partida SET status = 'PUBLICADA', ig_media_id = $2 WHERE id = $1`, [partidaId, midia]);
  const resenhaDe = (p: Awaited<ReturnType<typeof escalarPartida>>, lado: 'mandante' | 'visitante') =>
    p.escalacoes[lado].jogadores.map((j, i) => (j.resenha ? p.nomes[lado][i] : null)).filter(Boolean);

  it('quem comentou no Reels do último jogo do próprio Time, até o Corte, entra com Resenha', async () => {
    for (const a of ['a1', 'a2']) await inscrever(a, 'ENTRO CAPIVARA ATA');
    await inscrever('o1', 'ENTRO ONCA ATA');
    await inscrever('t1', 'ENTRO TATU ATA');
    const p1 = await novaPartida('CAP', 'ONC', hora(12));
    expect(resenhaDe(await escalarPartida(banco, p1), 'mandante')).toEqual([]); // primeiro jogo: não há Reels anterior
    await publicar(p1, 'reels1');
    await comentar('a1', 'reels1', hora(13));
    await comentar('a2', 'outro-post', hora(13)); // post que não é o do jogo
    await comentar('o1', 'reels1', hora(13)); // o jogo também era da Onça
    await comentar('t1', 'reels1', hora(13)); // jogo de outros Times: não vale para o Tatu
    const p2 = await escalarPartida(banco, await novaPartida('CAP', 'TAT', hora(16)));
    expect(resenhaDe(p2, 'mandante')).toEqual(['@a1']);
    expect(resenhaDe(p2, 'visitante')).toEqual([]);
    const p3 = await escalarPartida(banco, await novaPartida('ONC', 'TUC', hora(18)));
    expect(resenhaDe(p3, 'mandante')).toEqual(['@o1']);
    // Fica gravada: reler a Escalação devolve a mesma coisa.
    expect(await escalarPartida(banco, p2.partidaId)).toEqual(p2);
    expect((await banco.query(`SELECT 1 FROM escalacao WHERE resenha`)).rows).toHaveLength(2);
  });

  it('comentário depois do Corte não vale, e só conta o Reels do jogo mais recente', async () => {
    await inscrever('a1', 'ENTRO CAPIVARA ATA');
    const p1 = await novaPartida('CAP', 'ONC', hora(10));
    await escalarPartida(banco, p1);
    await publicar(p1, 'reels1');
    const p2 = await novaPartida('CAP', 'TAT', hora(12));
    await escalarPartida(banco, p2);
    await publicar(p2, 'reels2');
    await comentar('a1', 'reels1', hora(13)); // Reels antigo
    await comentar('a1', 'reels2', hora(15, 31)); // Corte das 16h é 15h30
    expect(resenhaDe(await escalarPartida(banco, await novaPartida('CAP', 'TUC', hora(16))), 'mandante')).toEqual([]);
    await comentar('a1', 'reels2', hora(17));
    expect(resenhaDe(await escalarPartida(banco, await novaPartida('CAP', 'ARA', hora(18))), 'mandante')).toEqual(['@a1']);
  });

  it('no Clássico, quem tem Resenha passa na frente no rodízio da Posição (ADR-0039)', async () => {
    for (const a of ['a1', 'a2', 'a3']) await inscrever(a, 'ENTRO CAPIVARA ATA');
    const p1 = await novaPartida('CAP', 'TAT', hora(12));
    expect((await escalarPartida(banco, p1)).nomes.mandante.slice(5)).toEqual(['@a1', '@a2']);
    await publicar(p1, 'reels1');
    // Sem Resenha, o rodízio poria a3 e a1. a2 comentou e passa na frente de a1 no Clássico.
    await comentar('a2', 'reels1', hora(13));
    const p2 = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(16)));
    expect(p2.nomes.mandante.slice(5)).toEqual(['@a2', '@a3']);
    expect(resenhaDe(p2, 'mandante')).toEqual(['@a2']);
  });

  it('fora do Clássico, a Resenha não mexe no rodízio (só na evolução)', async () => {
    for (const a of ['a1', 'a2', 'a3']) await inscrever(a, 'ENTRO CAPIVARA ATA');
    const p1 = await novaPartida('CAP', 'TAT', hora(12));
    await escalarPartida(banco, p1);
    await publicar(p1, 'reels1');
    await comentar('a2', 'reels1', hora(13));
    const p2 = await escalarPartida(banco, await novaPartida('CAP', 'TUC', hora(16)));
    expect(p2.nomes.mandante.slice(5)).toEqual(['@a3', '@a1']);
    expect(resenhaDe(p2, 'mandante')).toEqual([]); // a2 ficou fora e não guarda o bônus
  });

  it('no Clássico, entre os que têm Resenha vale o rodízio, e o Craque continua na frente', async () => {
    for (const a of ['a1', 'a2', 'a3', 'a4']) await inscrever(a, 'ENTRO CAPIVARA ATA');
    const p1 = await novaPartida('CAP', 'TAT', hora(12));
    await escalarPartida(banco, p1); // a1 e a2 jogam
    await publicar(p1, 'reels1');
    for (const a of ['a1', 'a2', 'a3']) await comentar(a, 'reels1', hora(13));
    // a1, a2 e a3 comentaram: entre eles, a3 (jogou menos) primeiro, depois a1.
    const p2 = await escalarPartida(banco, await novaPartida('CAP', 'ONC', hora(16)));
    expect(p2.nomes.mandante.slice(5)).toEqual(['@a3', '@a1']);
    // O Craque da Rodada anterior (a4, sem Resenha) continua garantido antes de todos.
    await publicar(p2.partidaId, 'reels2');
    for (const a of ['a1', 'a2', 'a3']) await comentar(a, 'reels2', hora(17));
    const craque = (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE username = 'a4'`)).rows[0]!.id;
    const p3 = await escalarPartida(banco, await novaPartida('ONC', 'CAP', hora(18)), { craque });
    expect(p3.nomes.visitante[5]).toBe('@a4');
  });

  it('na simulação, quem tem Resenha evolui pelo menos tanto quanto sem ela', async () => {
    await inscrever('a1', 'ENTRO CAPIVARA ATA');
    const p1 = await novaPartida('CAP', 'ONC', hora(12));
    await escalarPartida(banco, p1);
    await publicar(p1, 'reels1');
    await comentar('a1', 'reels1', hora(13));
    const p = await escalarPartida(banco, await novaPartida('CAP', 'TAT', hora(16)));
    const sem = { ...p.escalacoes.mandante, jogadores: p.escalacoes.mandante.jogadores.map(({ resenha: _, ...j }) => j) };
    let maior = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const com = simularPartida({ ...p.escalacoes, seed, fase: 'LIGA' }).desempenhos.find((d) => d.jogadorId !== null)!;
      const base = simularPartida({ mandante: sem, visitante: p.escalacoes.visitante, seed, fase: 'LIGA' }).desempenhos.find((d) => d.jogadorId !== null)!;
      expect(com.deltaHabilidades.FIN).toBeGreaterThanOrEqual(base.deltaHabilidades.FIN);
      if (com.deltaHabilidades.FIN > base.deltaHabilidades.FIN) maior++;
    }
    expect(maior).toBeGreaterThan(0);
  });
});
