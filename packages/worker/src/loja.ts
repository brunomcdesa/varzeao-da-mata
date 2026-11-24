/**
 * Loja (ADRs 0087 e 0101): comprar, equipar e tirar Itens. Parte leve, usada também pela borda.
 * A compra é um lançamento negativo no extrato (referência = código do Item), então o mesmo Item
 * nunca é cobrado duas vezes. O equipado fica em `jogador.itens`; a Escalação guarda uma cópia.
 */
import { ENCAIXES, ENCAIXE_SO_DO_GOLEIRO, ITEM_POR_CODIGO, NOME_DO_ENCAIXE, PRECO_DO_ITEM, itensValidos, type Encaixe, type ItensEquipados, type LojaDoJogador, type Posicao } from '@liga/shared';
import type { Banco } from './banco.js';
import { ITEM_DE_APOIADOR } from '@liga/shared';
import { temItemDeApoiador } from './apoiador.js';
import { lancar, saldo } from './carteira.js';

/**
 * Fase da Loja aberta (ADRs 0087 e 0101): a segunda (cortes, barbas e comemorações) abre no dia da
 * Rodada 4 da Fase de Liga da T3 (horário de Brasília) e fica aberta dali em diante.
 */
export async function faseDaLoja(b: Banco, agora: Date): Promise<1 | 2> {
  const r = (
    await b.query<{ numero: number; dia: string | null }>(
      `SELECT t.numero, (SELECT to_char(r.data, 'YYYY-MM-DD') FROM rodada r WHERE r.temporada_id = t.id AND r.fase = 'LIGA' AND r.numero = 4) AS dia
         FROM temporada t WHERE t.numero >= 3 ORDER BY t.numero DESC LIMIT 1`,
    )
  ).rows[0];
  if (!r) return 1;
  if (r.numero > 3) return 2;
  const hoje = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  return r.dia !== null && r.dia <= hoje ? 2 : 1;
}

interface Resultado {
  ok: boolean;
  mensagem: string;
}

const lerEquipados = (v: unknown): ItensEquipados => {
  const x = typeof v === 'string' ? (JSON.parse(v) as unknown) : v;
  return itensValidos(x) ? x : {};
};

async function jogadorDaLoja(b: Banco, jogadorId: string, travar = false) {
  return (
    await b.query<{ posicao: Posicao; itens: unknown; banido: boolean }>(`SELECT posicao, itens, banido FROM jogador WHERE id = $1${travar ? ' FOR UPDATE' : ''}`, [jogadorId])
  ).rows[0];
}

/**
 * Os Itens que são do Jogador: os comprados e, a partir da fase do Item, o Item de Apoiador de
 * quem teve apoio de R$ 15 (ADR-0108). Esse não passa pelo extrato: é do Jogador enquanto o
 * histórico de apoio existir, e continua dele depois que o apoio acaba.
 */
async function donos(b: Banco, jogadorId: string, agora: Date): Promise<string[]> {
  const comprados = (await b.query<{ codigo: string }>(`SELECT codigo FROM item_do_jogador WHERE jogador_id = $1 ORDER BY comprado_em`, [jogadorId])).rows.map((r) => r.codigo);
  if ((await faseDaLoja(b, agora)) >= ITEM_DE_APOIADOR.fase && (await temItemDeApoiador(b, jogadorId))) comprados.push(ITEM_DE_APOIADOR.codigo);
  return comprados;
}

async function salvarEquipados(b: Banco, jogadorId: string, itens: ItensEquipados): Promise<void> {
  await b.query(`UPDATE jogador SET itens = $2 WHERE id = $1`, [jogadorId, Object.keys(itens).length ? JSON.stringify(itens) : null]);
}

/** Compra o Item e já equipa. Recusa sem Moedas, Item repetido, fora da fase e Luva de quem não é goleiro. */
export async function comprarItem(b: Banco, jogadorId: string, codigo: string, agora: Date): Promise<Resultado> {
  const item = ITEM_POR_CODIGO.get(codigo);
  if (!item || item.exclusivo || item.fase > (await faseDaLoja(b, agora))) return { ok: false, mensagem: 'Esse Item não está na Loja.' };
  return b.transacao(async (t) => {
    // Trava o Jogador: duas compras ao mesmo tempo não passam do saldo.
    const j = await jogadorDaLoja(t, jogadorId, true);
    if (!j || j.banido) return { ok: false, mensagem: 'Jogador não encontrado.' };
    if (item.encaixe === ENCAIXE_SO_DO_GOLEIRO && j.posicao !== 'GOL') return { ok: false, mensagem: 'A Luva é só para goleiro.' };
    if ((await donos(t, jogadorId, agora)).includes(codigo)) return { ok: false, mensagem: 'Esse Item já é seu. Dá para equipar sem pagar de novo.' };
    const preco = PRECO_DO_ITEM[item.raridade];
    const tem = await saldo(t, jogadorId, agora);
    if (tem < preco) return { ok: false, mensagem: `Faltam ${preco - tem} Moedas para esse Item.` };
    await t.query(`INSERT INTO item_do_jogador (jogador_id, codigo, comprado_em) VALUES ($1, $2, $3)`, [jogadorId, codigo, agora.toISOString()]);
    await lancar(t, { jogadorId, tipo: 'COMPRA', referencia: codigo, valor: -preco, descricao: item.nome, visivelEm: agora });
    await salvarEquipados(t, jogadorId, { ...lerEquipados(j.itens), [item.encaixe]: codigo });
    return { ok: true, mensagem: `Compra feita: ${item.nome}. Já está equipado e vale a partir do próximo jogo.` };
  });
}

/** Equipa um Item que já é do Jogador (troca o que estava no mesmo Encaixe). */
export async function equiparItem(b: Banco, jogadorId: string, codigo: string, agora: Date): Promise<Resultado> {
  const item = ITEM_POR_CODIGO.get(codigo);
  if (!item) return { ok: false, mensagem: 'Item desconhecido.' };
  const j = await jogadorDaLoja(b, jogadorId);
  if (!j || j.banido) return { ok: false, mensagem: 'Jogador não encontrado.' };
  if (!(await donos(b, jogadorId, agora)).includes(codigo)) return { ok: false, mensagem: 'Esse Item ainda não é seu.' };
  await salvarEquipados(b, jogadorId, { ...lerEquipados(j.itens), [item.encaixe]: codigo });
  return { ok: true, mensagem: `Equipado: ${item.nome}. Vale a partir do próximo jogo.` };
}

/** Tira o Item de um Encaixe (ele continua sendo do Jogador). */
export async function tirarItem(b: Banco, jogadorId: string, encaixe: string): Promise<Resultado> {
  if (!(ENCAIXES as readonly string[]).includes(encaixe)) return { ok: false, mensagem: 'Encaixe desconhecido.' };
  const j = await jogadorDaLoja(b, jogadorId);
  if (!j || j.banido) return { ok: false, mensagem: 'Jogador não encontrado.' };
  const itens = lerEquipados(j.itens);
  delete itens[encaixe as Encaixe];
  await salvarEquipados(b, jogadorId, itens);
  return { ok: true, mensagem: `Tirado: ${NOME_DO_ENCAIXE[encaixe as Encaixe].toLowerCase()}. Vale a partir do próximo jogo.` };
}

/** O que a Loja do dono mostra: Itens dele, os equipados, se é goleiro e a fase aberta. */
export async function lojaDoJogador(b: Banco, jogadorId: string, agora: Date): Promise<LojaDoJogador | null> {
  const j = await jogadorDaLoja(b, jogadorId);
  if (!j) return null;
  return { donos: await donos(b, jogadorId, agora), equipados: lerEquipados(j.itens), goleiro: j.posicao === 'GOL', fase: await faseDaLoja(b, agora) };
}

/** Itens equipados agora por @ (sem @, minúsculo), para os cards e o Resumo. */
export async function itensEquipadosAtuais(b: Banco): Promise<Record<string, ItensEquipados>> {
  const linhas = (await b.query<{ username: string; itens: unknown }>(`SELECT username, itens FROM jogador WHERE itens IS NOT NULL AND NOT banido`)).rows;
  return Object.fromEntries(linhas.map((l) => [l.username.toLowerCase(), lerEquipados(l.itens)]).filter(([, i]) => Object.keys(i as object).length));
}
