/**
 * Perfil do Jogador escolhido pelo dono no site (ADR-0013): visual do boneco (pele, cor e
 * corte do cabelo) e número da camisa. Os valores possíveis são os do desenho do boneco.
 */
import { aparenciaValida, type Aparencia } from '@liga/shared';
import type { Banco } from './banco.js';

type Visual = Required<Aparencia>;

/** Aparências escolhidas, pelo @ (para o vídeo desenhar o boneco como o dono quis). */
export async function aparenciasEscolhidas(banco: Banco): Promise<Record<string, Visual>> {
  const linhas = (await banco.query<{ username: string; visual: Visual | string }>(`SELECT username, visual FROM jogador WHERE visual IS NOT NULL AND NOT banido`)).rows;
  return Object.fromEntries(linhas.map((l) => [l.username.toLowerCase(), typeof l.visual === 'string' ? (JSON.parse(l.visual) as Visual) : l.visual]));
}

/**
 * Aplica visual e/ou número. O número não pode repetir no Time (de quem não foi banido).
 * Devolve a mensagem para o dono.
 */
export async function aplicarPerfil(b: Banco, jogadorId: string, p: { visual?: unknown; numero?: unknown }): Promise<{ ok: boolean; mensagem: string }> {
  const j = (await b.query<{ time_id: string }>(`SELECT time_id FROM jogador WHERE id = $1`, [jogadorId])).rows[0];
  if (!j) return { ok: false, mensagem: 'Jogador não encontrado.' };
  const feitos: string[] = [];
  if (p.visual !== undefined) {
    if (!aparenciaValida(p.visual)) return { ok: false, mensagem: 'Visual inválido.' };
    await b.query(`UPDATE jogador SET visual = $2 WHERE id = $1`, [jogadorId, JSON.stringify({ pele: p.visual.pele, cabelo: p.visual.cabelo, penteado: p.visual.penteado })]);
    feitos.push('visual');
  }
  if (p.numero !== undefined) {
    const n = Number(p.numero);
    if (!Number.isInteger(n) || n < 1 || n > 99) return { ok: false, mensagem: 'O número da camisa vai de 1 a 99.' };
    const dono = (await b.query<{ username: string }>(`SELECT username FROM jogador WHERE time_id = $1 AND numero = $2 AND id <> $3 AND NOT banido`, [j.time_id, n, jogadorId])).rows[0];
    if (dono) return { ok: false, mensagem: `A camisa ${n} já é de @${dono.username} no seu time. Escolha outro número.` };
    await b.query(`UPDATE jogador SET numero = $2 WHERE id = $1`, [jogadorId, n]);
    feitos.push(`camisa ${n}`);
  }
  return { ok: true, mensagem: `Pronto! ${feitos.length ? `Salvo: ${feitos.join(' e ')}.` : ''} Aparece no site na próxima publicação, em alguns minutos.` };
}
