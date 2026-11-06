/**
 * Dados de mentira para desenvolver o site: 50 Jogadores, 3 Rodadas jogadas, "agora" no meio
 * da Partida das 16h da Rodada 3 (uma Ao Vivo, uma Agendada).
 *
 *   pnpm --filter @liga/worker site-demo <pasta-do-banco> <pasta-de-saida>
 */
import { TIMES } from '@liga/shared';
import { criarTemporada, processarComentario, rodarPartida, fecharRodada, exportarSite, escreverSite } from '../src/index.js';
import { bancoLocal } from './banco-local.js';
const nomes = ['rafa','ju.silva','tiaguinho','bia_fut','marcao','leleco','duda','pedrinho','carol.gol','zeca','nina','fabinho','gui','lari','beto','tati','vini','mari','caio','dani','kiko','lu','jojo','tete','nando','paty','rico','sol','theo','vava','zuza','ana.b','cris','dede','edu','fafa','gabi','hugo','iris','jao','kaka','lia','mano','nico','olga','pipo','quel','rubens','sara','toni'];
const pos = ['ATA','MEI','ZAG','GOL'];
const banco = await bancoLocal(process.argv[2]!);
await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 4 });
let i = 0;
for (const n of nomes) {
  const t = TIMES[i % 8]; const p = pos[(i * 3 + Math.floor(i / 8)) % 4];
  await processarComentario(banco, { igCommentId: 'c'+i, igMediaId: 'm', igUserId: 'u'+i, username: n, texto: `ENTRO ${t} ${p}`, comentadoEm: new Date('2026-11-06T12:00:00Z') }, { rodadaEmVotacao: null });
  i++;
}
for (const num of [1, 2, 3]) {
  const r = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE numero = $1`, [num])).rows[0]!.id;
  for (const { id } of (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE rodada_id = $1 ORDER BY apito_inicial`, [r])).rows) await rodarPartida(banco, id, { seed: id });
  await fecharRodada(banco, r);
}
// "agora": Rodada 3, durante a Partida das 16h
const ag = (await banco.query<{ apito_inicial: Date }>(`SELECT p.apito_inicial FROM partida p JOIN rodada r ON r.id=p.rodada_id WHERE r.numero=3 ORDER BY apito_inicial OFFSET 2 LIMIT 1`)).rows[0]!.apito_inicial;
const agora = new Date(new Date(ag).getTime() + 2 * 60000);
console.log(await escreverSite(await exportarSite(banco, agora), process.argv[3]!));
await banco.fechar();
