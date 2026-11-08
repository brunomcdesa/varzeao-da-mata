/**
 * Voto do Craque pelo site (ADR-0011). A borda grava cada voto no KV, um por aparelho, em
 * `voto-site/<rodada>/<aparelho>` com o número nos metadados; aqui eles entram no banco
 * (voto_site) e somam com os votos dos comentários. A borda só aceita voto para a Rodada
 * que está em `votacao-aberta`, que este módulo mantém em dia.
 */
import type { Banco } from './banco.js';
import type { Contexto } from './coletar.js';
import type { Agenda } from './nuvem.js';
import { rodadaEmVotacao } from './resumo.js';

export const CHAVE_VOTACAO = 'votacao-aberta';
export const PREFIXO_VOTO_SITE = 'voto-site/';

export interface VotacaoAberta {
  rodada: number;
  candidatos: number;
}

export interface MetadadosDoVoto {
  numero: number;
  em: string;
}

/** Rodada em votação e o post do Resumo dela (onde vale comentar só o número). */
export async function contextoDaVotacao(banco: Banco): Promise<Contexto> {
  const rodada = await rodadaEmVotacao(banco);
  if (rodada === null) return { rodadaEmVotacao: null, postDaVotacao: null };
  const r = (await banco.query<{ resumo_ig_media_id: string | null }>(`SELECT resumo_ig_media_id FROM rodada WHERE id = $1`, [rodada])).rows[0];
  return { rodadaEmVotacao: rodada, postDaVotacao: r?.resumo_ig_media_id ?? null };
}

/** Traz para o banco os votos do site de uma Rodada. Devolve quantos eram novos. */
export async function importarVotosDoSite(banco: Banco, agenda: Agenda, rodada: number): Promise<number> {
  const chaves = await agenda.listarComMetadados<MetadadosDoVoto>(`${PREFIXO_VOTO_SITE}${rodada}/`);
  let novos = 0;
  for (const { nome, metadados } of chaves) {
    if (!metadados) continue;
    const dispositivo = nome.slice(`${PREFIXO_VOTO_SITE}${rodada}/`.length);
    const r = await banco.query(
      `INSERT INTO voto_site (rodada_id, dispositivo, jogador_id, votado_em)
       SELECT $1, $2, jogador_id, $4 FROM candidato WHERE rodada_id = $1 AND numero = $3
       ON CONFLICT DO NOTHING RETURNING dispositivo`,
      [rodada, dispositivo, metadados.numero, metadados.em],
    );
    novos += r.rows.length;
  }
  return novos + (await importarVotosVinculados(banco, agenda, rodada));
}

/**
 * Votos de quem vinculou o personagem (ADR-0013): contam como o voto do @, junto com os
 * comentados; vale o último, como no comentário.
 */
export async function importarVotosVinculados(banco: Banco, agenda: Agenda, rodada: number): Promise<number> {
  const prefixo = `voto-vinculado/${rodada}/`;
  let novos = 0;
  for (const { nome, metadados } of await agenda.listarComMetadados<MetadadosDoVoto>(prefixo)) {
    if (!metadados) continue;
    const jogadorId = nome.slice(prefixo.length);
    const r = await banco.query(
      `INSERT INTO voto (rodada_id, ig_user_id, jogador_id, votado_em)
       SELECT $1, j.ig_user_id, c.jogador_id, $4 FROM jogador j JOIN candidato c ON c.rodada_id = $1 AND c.numero = $3 WHERE j.id = $2
       ON CONFLICT (rodada_id, ig_user_id) DO UPDATE SET jogador_id = EXCLUDED.jogador_id, votado_em = EXCLUDED.votado_em
       WHERE voto.votado_em < EXCLUDED.votado_em
       RETURNING ig_user_id`,
      [rodada, jogadorId, metadados.numero, metadados.em],
    );
    novos += r.rows.length;
  }
  return novos;
}

/**
 * Importa os votos do site da votação aberta e avisa a borda qual votação está aberta agora
 * (só grava no KV quando muda: o plano grátis tem 1.000 gravações por dia).
 */
export async function sincronizarVotacao(banco: Banco, agenda: Agenda): Promise<{ rodada: number | null; importados: number }> {
  const rodada = await rodadaEmVotacao(banco);
  const importados = rodada === null ? 0 : await importarVotosDoSite(banco, agenda, rodada);
  const atual = await agenda.ler<VotacaoAberta>(CHAVE_VOTACAO);
  if (rodada === null) {
    if (atual) await agenda.apagar(CHAVE_VOTACAO);
  } else {
    const n = Number((await banco.query<{ n: string }>(`SELECT count(*) AS n FROM candidato WHERE rodada_id = $1`, [rodada])).rows[0]!.n);
    if (!atual || atual.rodada !== rodada || atual.candidatos !== n) await agenda.gravar(CHAVE_VOTACAO, { rodada, candidatos: n } satisfies VotacaoAberta);
  }
  return { rodada, importados };
}
