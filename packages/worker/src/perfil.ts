/**
 * Perfil do Jogador escolhido pelo dono no site (ADR-0013): visual do boneco (pele, cor e
 * corte do cabelo) e número da camisa. Os valores possíveis são os do desenho do boneco.
 */
import { aparenciaValida, apelidoLiberaEm, chaveDoApelido, podeTrocarApelido, validarApelido, type Aparencia } from '@liga/shared';
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
export async function aplicarPerfil(b: Banco, jogadorId: string, p: { visual?: unknown; numero?: unknown; apelido?: unknown }, agora = new Date()): Promise<{ ok: boolean; mensagem: string }> {
  const j = (await b.query<{ time_id: string; username: string; apelido: string | null; apelido_em: Date | string | null }>(`SELECT time_id, username, apelido, apelido_em FROM jogador WHERE id = $1`, [jogadorId])).rows[0];
  if (!j) return { ok: false, mensagem: 'Jogador não encontrado.' };
  if (p.apelido !== undefined) {
    const r = await aplicarApelido(b, jogadorId, j, p.apelido, agora);
    if (!r.ok || (p.visual === undefined && p.numero === undefined)) return r;
  }
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
    try {
      await b.query(`SAVEPOINT camisa`);
      await b.query(`UPDATE jogador SET numero = $2 WHERE id = $1`, [jogadorId, n]);
      await b.query(`RELEASE SAVEPOINT camisa`);
    } catch {
      // Outra coleta deu esse número no mesmo instante (o índice único do banco segura).
      await b.query(`ROLLBACK TO SAVEPOINT camisa`);
      return { ok: false, mensagem: `A camisa ${n} acabou de ser escolhida por outra pessoa do seu time. Escolha outro número.` };
    }
    feitos.push(`camisa ${n}`);
  }
  return { ok: true, mensagem: `Pronto! ${feitos.length ? `Salvo: ${feitos.join(' e ')}.` : ''} Aparece no site na próxima publicação, em alguns minutos.` };
}

/**
 * Apelido (ADR-0014): até 14 letras, sem palavrão, único na Liga (sem acento e espaço) e sem
 * ser o @ de outra pessoa; uma troca por Rodada (com 10 minutos para corrigir). Vazio volta ao @.
 */
async function aplicarApelido(
  b: Banco,
  jogadorId: string,
  j: { username: string; apelido: string | null; apelido_em: Date | string | null },
  bruto: unknown,
  agora: Date,
): Promise<{ ok: boolean; mensagem: string }> {
  const trocouEm = j.apelido_em ? new Date(j.apelido_em) : null;
  if (!podeTrocarApelido(trocouEm, agora)) {
    const quando = apelidoLiberaEm(trocouEm!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit' });
    return { ok: false, mensagem: `Você já trocou o apelido nesta rodada. Dá para trocar de novo ${quando}.` };
  }
  const texto = String(bruto ?? '').trim();
  if (!texto) {
    if (!j.apelido) return { ok: true, mensagem: 'Você já aparece pelo @.' };
    await b.query(`UPDATE jogador SET apelido = NULL, apelido_chave = NULL, apelido_em = $2 WHERE id = $1`, [jogadorId, agora.toISOString()]);
    return { ok: true, mensagem: `Pronto! Você volta a aparecer como @${j.username} a partir do próximo jogo escalado.` };
  }
  const v = validarApelido(texto);
  if (!v.ok) return { ok: false, mensagem: v.erro };
  if (v.apelido === j.apelido) return { ok: true, mensagem: `Você já aparece como ${v.apelido}.` };
  const chave = chaveDoApelido(v.apelido);
  const outros = (await b.query<{ username: string; apelido_chave: string | null }>(`SELECT username, apelido_chave FROM jogador WHERE id <> $1 AND NOT banido`, [jogadorId])).rows;
  if (outros.some((o) => o.apelido_chave === chave)) return { ok: false, mensagem: `O apelido ${v.apelido} já é de outro jogador. Escolha outro.` };
  if (outros.some((o) => chaveDoApelido(o.username) === chave)) return { ok: false, mensagem: 'Esse apelido é o @ de outro jogador. Escolha outro.' };
  try {
    await b.query(`SAVEPOINT apelido`);
    await b.query(`UPDATE jogador SET apelido = $2, apelido_chave = $3, apelido_em = $4 WHERE id = $1`, [jogadorId, v.apelido, chave, agora.toISOString()]);
    await b.query(`RELEASE SAVEPOINT apelido`);
  } catch {
    await b.query(`ROLLBACK TO SAVEPOINT apelido`);
    return { ok: false, mensagem: `O apelido ${v.apelido} acabou de ser escolhido por outro jogador. Escolha outro.` };
  }
  return { ok: true, mensagem: `Pronto! Agora você aparece como ${v.apelido} a partir do próximo jogo escalado. No site, já na próxima publicação.` };
}
