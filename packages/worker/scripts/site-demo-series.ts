/**
 * Dados de mentira com Série A e Série B (ADR-0017), para desenvolver o site: a Temporada 1
 * inteira, a Temporada 2 com Jogadores nas duas Séries, 2 Rodadas jogadas e "agora" durante
 * os jogos das 16h da Rodada 3 (dois Ao Vivo ao mesmo tempo).
 *
 *   pnpm --filter @liga/worker site-demo-series <pasta-do-banco> <pasta-de-saida>
 */
import { criarTemporada, processarComentario, rodarPartida, fecharRodada, exportarSite, escreverSite } from '../src/index.js';
import { avancarMataMata } from '../src/mataMata.js';
import { seriesDaTemporada } from '../src/series.js';
import { bancoLocal } from './banco-local.js';

const nomes = ['rafa','ju.silva','tiaguinho','bia_fut','marcao','leleco','duda','pedrinho','carol.gol','zeca','nina','fabinho','gui','lari','beto','tati','vini','mari','caio','dani','kiko','lu','jojo','tete','nando','paty','rico','sol','theo','vava','zuza','ana.b','cris','dede','edu','fafa','gabi','hugo','iris','jao','kaka','lia','mano','nico','olga','pipo','quel','rubens','sara','toni','uli','vivi','wes','xuxa','yago','zara','abel','bela','cadu','dora','enzo','fê','gabs','hel'];
const pos = ['ATA', 'MEI', 'ZAG', 'GOL'];
const banco = await bancoLocal(process.argv[2]!);

const jogar = async (temporadaId: number, numero: number, ate?: number) => {
  const r = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND numero = $2`, [temporadaId, numero])).rows[0]!.id;
  const ps = (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE rodada_id = $1 ORDER BY apito_inicial, serie`, [r])).rows;
  for (const { id } of ps.slice(0, ate)) await rodarPartida(banco, id, { seed: id });
  if (ate === undefined) {
    await fecharRodada(banco, r);
    await avancarMataMata(banco, temporadaId);
  }
};

const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 4 });
for (let n = 1; n <= 9; n++) await jogar(t1, n);
const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 6 });
const s = await seriesDaTemporada(banco, t2);
let i = 0;
for (const n of nomes) {
  const times = [...s.A, ...s.B];
  const t = times[i % 16]!;
  const p = pos[(i * 3 + Math.floor(i / 16)) % 4];
  await processarComentario(banco, { igCommentId: 'c' + i, igMediaId: 'm', igUserId: 'u' + i, username: n, texto: `ENTRO ${t} ${p}`, comentadoEm: new Date('2026-11-17T12:00:00Z') }, { rodadaEmVotacao: null });
  i++;
}
for (const n of [1, 2]) await jogar(t2, n);
// Rodada 3: até os jogos das 16h (A e B), que estão Ao Vivo.
await jogar(t2, 3, 6);
const agora = new Date('2026-11-20T19:02:00Z'); // 16h02 em Brasília
console.log(await escreverSite(await exportarSite(banco, agora), process.argv[3]!));
await banco.fechar();
