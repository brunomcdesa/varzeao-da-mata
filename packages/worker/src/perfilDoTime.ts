/**
 * Perfil do Time (ADR-0099): o Instagram que um Jogador criou para o Time e que o dono
 * reconheceu como oficial pela DM. Ganha link na página do Time e entra como colaborador
 * em todo Reels de Partida do Time. Roda pelo workflow `perfil-do-time` (ou
 * `pnpm liga perfil-do-time`); sem `gravar`, é a simulação.
 */
import type { TimeId } from '@liga/shared';
import type { Banco } from './banco.js';

/** @ do Instagram: letras, números, ponto e sublinhado, até 30 (regra do Instagram). */
const USUARIO_VALIDO = /^[a-z0-9._]{1,30}$/i;

export function limparUsuario(texto: string): string {
  return texto.trim().replace(/^@/, '').trim();
}

/** Os Perfis do Time oficiais, por Time. */
export async function perfisDosTimes(b: Banco): Promise<Map<TimeId, string>> {
  const linhas = (await b.query<{ time_id: TimeId; usuario: string }>(`SELECT time_id, usuario FROM perfil_do_time`)).rows;
  return new Map(linhas.map((l) => [l.time_id, l.usuario]));
}

/** Os colaboradores do Reels de uma Partida: o Perfil do Time de cada lado que tiver um. */
export function colaboradoresDaPartida(perfis: Map<TimeId, string>, mandante: TimeId, visitante: TimeId): string[] {
  return [perfis.get(mandante), perfis.get(visitante)].filter((u): u is string => !!u);
}

export interface ResultadoDoPerfil {
  time: TimeId;
  antes: string | null;
  depois: string | null;
  gravado: boolean;
}

/**
 * Reconhece `usuario` como o Perfil do Time de `time`. Se o Time já tem outro perfil, recusa,
 * porque fica o primeiro que pediu; `trocar` passa por cima disso (decisão do dono).
 */
export async function definirPerfilDoTime(b: Banco, time: TimeId, usuario: string, o: { gravar: boolean; trocar?: boolean; agora?: Date }): Promise<ResultadoDoPerfil> {
  const u = limparUsuario(usuario);
  if (!USUARIO_VALIDO.test(u)) throw new Error(`"${usuario}" não é um @ válido do Instagram.`);
  const atual = (await b.query<{ usuario: string }>(`SELECT usuario FROM perfil_do_time WHERE time_id = $1`, [time])).rows[0]?.usuario ?? null;
  if (atual && atual.toLowerCase() !== u.toLowerCase() && !o.trocar) {
    throw new Error(`O ${time} já tem Perfil do Time: @${atual}. Fica o primeiro que pediu; para trocar mesmo assim, marque "trocar".`);
  }
  const outro = (await b.query<{ time_id: TimeId }>(`SELECT time_id FROM perfil_do_time WHERE lower(usuario) = lower($1) AND time_id <> $2`, [u, time])).rows[0];
  if (outro) throw new Error(`@${u} já é o Perfil do Time do ${outro.time_id}.`);
  if (o.gravar) {
    await b.query(
      `INSERT INTO perfil_do_time (time_id, usuario, oficial_desde) VALUES ($1, $2, $3)
       ON CONFLICT (time_id) DO UPDATE SET usuario = EXCLUDED.usuario,
         oficial_desde = CASE WHEN lower(perfil_do_time.usuario) = lower(EXCLUDED.usuario) THEN perfil_do_time.oficial_desde ELSE EXCLUDED.oficial_desde END`,
      [time, u, o.agora ?? new Date()],
    );
  }
  return { time, antes: atual, depois: u, gravado: o.gravar };
}

/** Tira o Perfil do Time (perdeu os requisitos ou o dono pediu). */
export async function tirarPerfilDoTime(b: Banco, time: TimeId, o: { gravar: boolean }): Promise<ResultadoDoPerfil> {
  const atual = (await b.query<{ usuario: string }>(`SELECT usuario FROM perfil_do_time WHERE time_id = $1`, [time])).rows[0]?.usuario ?? null;
  if (o.gravar) await b.query(`DELETE FROM perfil_do_time WHERE time_id = $1`, [time]);
  return { time, antes: atual, depois: null, gravado: o.gravar };
}
