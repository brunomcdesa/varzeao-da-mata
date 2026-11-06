import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES, type JogadorPublico, type LigaPublica, type PartidaPublica } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { rodarPartida } from '../src/partida.js';
import { fecharRodada } from '../src/resumo.js';
import { DURACAO_AO_VIVO_MS, exportarSite } from '../src/site.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let n = 0;
let partidas: { id: number; apito: Date }[];
let rodada: number;

beforeEach(async () => {
  banco = await bancoDeTeste();
  await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 9 });
  for (const t of TIMES) {
    for (const pos of ['ATA', 'GOL', 'MEI']) {
      const id = `${t}-${pos}`.toLowerCase();
      await processarComentario(
        banco,
        { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: id, username: id, texto: `ENTRO ${t} ${pos}`, comentadoEm: new Date('2026-11-06T12:00:00Z') },
        { rodadaEmVotacao: null },
      );
    }
  }
  rodada = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE numero = 1`)).rows[0]!.id;
  partidas = (
    await banco.query<{ id: number; apito_inicial: string | Date }>(`SELECT id, apito_inicial FROM partida WHERE rodada_id = $1 ORDER BY apito_inicial`, [rodada])
  ).rows.map((p) => ({ id: p.id, apito: new Date(p.apito_inicial) }));
  for (const { id } of partidas) await rodarPartida(banco, id, { seed: id * 7 });
  await fecharRodada(banco, rodada);
});
afterEach(async () => {
  await banco.fechar();
});

const minuto = 60_000;

async function exportar(agora: Date) {
  const { arquivos } = await exportarSite(banco, agora);
  return {
    liga: arquivos.get('liga.json') as LigaPublica,
    jogadores: arquivos.get('jogadores.json') as JogadorPublico[],
    partida: (id: number) => arquivos.get(`partidas/${id}.json`) as PartidaPublica | undefined,
  };
}

describe('dados públicos do site', () => {
  it('antes do Apito: escalação aparece, resultado e OVR novo não', async () => {
    const p1 = partidas[0]!;
    const { liga, jogadores, partida } = await exportar(new Date(p1.apito.getTime() - 10 * minuto));
    expect(liga.calendario.every((p) => p.situacao === 'AGENDADA' && !p.placar)).toBe(true);
    expect(liga.tabela.every((l) => l.pontos === 0)).toBe(true);
    expect(liga.rodadas[0]!.candidatos).toEqual([]);
    const pub = partida(p1.id)!;
    expect(pub.escalacoes!.mandante.jogadores).toHaveLength(7);
    expect(pub.resultado).toBeNull();
    // Ninguém mostra estatística nem OVR diferente do inicial.
    for (const j of jogadores) {
      expect(j.jogos).toBe(0);
      expect(j.ovr).toBe(j.ovrInicial);
    }
    expect(JSON.stringify(liga) + JSON.stringify(jogadores) + JSON.stringify(pub)).not.toMatch(/"nota"|"lances"/);
  });

  it('durante o Ao Vivo só a Partida que começou é revelada', async () => {
    const p1 = partidas[0]!;
    const { liga, partida } = await exportar(new Date(p1.apito.getTime() + 2 * minuto));
    expect(liga.calendario.find((p) => p.id === p1.id)!.situacao).toBe('AO_VIVO');
    // O placar final não aparece no calendário enquanto o Ao Vivo roda; o lance a lance sim.
    expect(liga.calendario.filter((p) => p.placar)).toHaveLength(0);
    expect(liga.tabela.every((l) => l.jogos === 0)).toBe(true);
    expect(partida(p1.id)!.resultado).not.toBeNull();
    expect(partida(partidas[1]!.id)!.resultado).toBeNull();
  });

  it('depois da Rodada: tabela, estatísticas e Candidatos batem', async () => {
    const ultima = partidas[3]!;
    const { liga, jogadores } = await exportar(new Date(ultima.apito.getTime() + DURACAO_AO_VIVO_MS + minuto));
    expect(liga.calendario.filter((p) => p.situacao === 'ENCERRADA')).toHaveLength(4);
    const golsDaRodada = liga.calendario.reduce((s, p) => s + (p.placar ? p.placar.mandante + p.placar.visitante : 0), 0);
    const golsDaTabela = liga.tabela.reduce((s, l) => s + l.golsPro, 0);
    expect(golsDaTabela).toBe(golsDaRodada);
    expect(jogadores.reduce((s, j) => s + j.gols, 0)).toBeLessThanOrEqual(golsDaRodada);
    expect(liga.rodadas[0]!.candidatos).toHaveLength(5);
    expect(liga.rodadas[0]!.craque).toBeNull(); // votação ainda aberta
    const jogou = jogadores.filter((j) => j.jogos > 0);
    expect(jogou.length).toBe(24);
    for (const j of jogou) {
      expect(j.vitorias + j.empates + j.derrotas).toBe(j.jogos);
      expect(j.ovr).toBe(j.historico.at(-1)!.ovr);
    }
    expect(jogadores.reduce((s, j) => s + j.vezesCandidato, 0)).toBe(5);
  });
});
