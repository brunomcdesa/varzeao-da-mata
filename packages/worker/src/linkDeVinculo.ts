/**
 * Link de Vínculo (ADR-0082): o dono roda o workflow "link-de-vinculo" com o @ e a Liga manda
 * na DM do Jogador um link de uso único. Abrir o link vincula aquele navegador ao Jogador, no
 * lugar de qualquer Vínculo anterior (a borda troca o token por uma sessão em /vinculo/link).
 *
 * O token só existe na DM: no KV fica o hash dele, e o log do workflow nunca mostra o link.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Agenda } from './nuvem.js';

/** O link vale por 24 horas (a pessoa pode demorar para abrir a DM). */
export const VALIDADE_DO_LINK_S = 24 * 3600;

/** O que a borda lê em `vinculo/link/<hash do token>` (mesmo formato de packages/edge). */
export interface LinkDeVinculo {
  jogadorId: string;
  username: string;
  criadoEm: string;
  expiraEm: string;
}

const hash = (texto: string) => createHash('sha256').update(texto).digest('hex');
export const chaveDoLink = (token: string) => `vinculo/link/${hash(token)}`;

/** 32 bytes aleatórios em base64url: 43 caracteres, o formato que a borda aceita. */
export const novoToken = () => randomBytes(32).toString('base64url');

export async function criarLinkDeVinculo(
  agenda: Agenda,
  jogador: { id: string; username: string },
  o: { site: string; agora: Date; token?: string },
): Promise<{ url: string; chave: string; expiraEm: string }> {
  const token = o.token ?? novoToken();
  const expiraEm = new Date(o.agora.getTime() + VALIDADE_DO_LINK_S * 1000).toISOString();
  const link: LinkDeVinculo = { jogadorId: jogador.id, username: jogador.username, criadoEm: o.agora.toISOString(), expiraEm };
  const chave = chaveDoLink(token);
  await agenda.gravar(chave, link, { validadeS: VALIDADE_DO_LINK_S });
  return { url: `${o.site.replace(/\/+$/, '')}/#/vincular/${token}`, chave, expiraEm };
}

/** A DM com o link. */
export const mensagemDoLink = (username: string, url: string) =>
  `Oi, @${username}! Este é o seu link para vincular o seu Jogador ao site do Varzeão da Mata:\n\n${url}\n\n` +
  'Abra no celular em que você usa o site. O link vale por 24 horas e funciona uma vez só. ' +
  'Se o navegador estava vinculado a outro Jogador, ele passa a ser vinculado ao seu.';
