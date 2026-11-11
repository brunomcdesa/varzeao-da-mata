/**
 * Pedidos feitos pelo site por quem vinculou o personagem pela DM (ADR-0013). A borda grava
 * cada pedido no KV em `pedido-site/<jogadorId>`; a coleta aplica com as mesmas regras do
 * comentário e devolve o resultado no próprio item, para o site mostrar.
 */
import type { TipoDePendencia } from '@liga/shared';
import { TUDO_PENDENTE, type Pendente } from './pendencias.js';
import type { Posicao, TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { transferirJogador, type Resultado } from './coletar.js';
import type { Agenda } from './nuvem.js';
import { aplicarPerfil } from './perfil.js';
import { aplicarEscolha, jogadoresComVinculo, type Escolha } from './temporada2.js';

/** Temporada 2 (ADRs 0020 e 0023): escolhas do site, em `escolha-site/<jogadorId>/<tipo>`. */
export const PREFIXO_ESCOLHA_SITE = 'escolha-site/';

export interface EscolhaDoSite {
  jogadorId: string;
  escolha: Escolha;
  pedidoEm: string;
  resultado?: 'SALVO' | 'RECUSADO';
  mensagem?: string;
  processadoEm?: string;
}

export const PREFIXO_PEDIDO_SITE = 'pedido-site/';

export interface PedidoDoSite {
  tipo: 'TRANSFERENCIA';
  jogadorId: string;
  /** Time de destino; ausente = só troca de posição. */
  time?: TimeId;
  posicao?: Posicao;
  pedidoEm: string;
  /** Preenchidos pela coleta. */
  resultado?: Resultado;
  mensagem?: string;
  processadoEm?: string;
}

export const PREFIXO_PERFIL_SITE = 'perfil-site/';

export interface PerfilDoSite {
  jogadorId: string;
  visual?: { pele: string; cabelo: string; penteado: string };
  numero?: number;
  /** Apelido (ADR-0014); vazio = voltar ao @. */
  apelido?: string;
  pedidoEm: string;
  resultado?: 'SALVO' | 'RECUSADO';
  mensagem?: string;
  processadoEm?: string;
}

/** Aplica os pedidos pendentes (Transferência e perfil). Devolve quantos foram processados. */
export async function processarPedidosDoSite(banco: Banco, agenda: Agenda, agora: Date, pendente: Pendente = TUDO_PENDENTE): Promise<number> {
  let n = 0;
  // Só lista os prefixos que a borda marcou (ADR-0035); a lista vazia não gasta listagem.
  const listar = (tipo: TipoDePendencia, prefixo: string) => (pendente(tipo) ? agenda.listar(prefixo) : Promise.resolve([] as string[]));
  // Quem pediu primeiro é atendido primeiro (vale para a camisa disputada).
  const perfis = (await Promise.all((await listar('perfis', PREFIXO_PERFIL_SITE)).map(async (chave) => ({ chave, p: await agenda.ler<PerfilDoSite>(chave) })))).filter((x) => x.p && !x.p.processadoEm).sort((a, b) => a.p!.pedidoEm.localeCompare(b.p!.pedidoEm));
  for (const { chave, p: lido } of perfis) {
    const p = lido!;
    const r = await banco.transacao((b) => aplicarPerfil(b, p.jogadorId, { ...(p.visual ? { visual: p.visual } : {}), ...(p.numero !== undefined ? { numero: p.numero } : {}), ...(p.apelido !== undefined ? { apelido: p.apelido } : {}) }, new Date(p.pedidoEm)));
    await agenda.gravar(chave, { ...p, resultado: r.ok ? 'SALVO' : 'RECUSADO', mensagem: r.mensagem, processadoEm: agora.toISOString() });
    n++;
  }
  // Temporada 2: Postura, Presença, Especialização, Treino e Canto (o Vínculo só pesa na Postura).
  const escolhas = (await Promise.all((await listar('escolhas', PREFIXO_ESCOLHA_SITE)).map(async (chave) => ({ chave, p: await agenda.ler<EscolhaDoSite>(chave) })))).filter((x) => x.p && !x.p.processadoEm).sort((a, b) => a.p!.pedidoEm.localeCompare(b.p!.pedidoEm));
  let vinculos: Promise<Set<string>> | null = null;
  for (const { chave, p: lido } of escolhas) {
    const p = lido!;
    const r = await banco.transacao((b) => aplicarEscolha(b, p.jogadorId, p.escolha, new Date(p.pedidoEm), () => (vinculos ??= jogadoresComVinculo(agenda))));
    await agenda.gravar(chave, { ...p, resultado: r.ok ? 'SALVO' : 'RECUSADO', mensagem: r.mensagem, processadoEm: agora.toISOString() });
    n++;
  }
  const pedidos = (await Promise.all((await listar('pedidos', PREFIXO_PEDIDO_SITE)).map(async (chave) => ({ chave, p: await agenda.ler<PedidoDoSite>(chave) })))).filter((x) => x.p && !x.p.processadoEm && x.p.tipo === 'TRANSFERENCIA').sort((a, b) => a.p!.pedidoEm.localeCompare(b.p!.pedidoEm));
  for (const { chave, p: lido } of pedidos) {
    const p = lido!;
    const r = await banco.transacao((b) =>
      transferirJogador(b, p.jogadorId, { times: p.time ? [p.time] : [], ...(p.posicao ? { posicao: p.posicao } : {}) }, { quando: agora, ref: `site:${p.jogadorId}:${p.pedidoEm}` }),
    );
    const msg = r.mensagem ? r.mensagem.charAt(0).toUpperCase() + r.mensagem.slice(1) : 'Pedido não entendido.';
    await agenda.gravar(chave, { ...p, resultado: r.resultado, mensagem: msg, processadoEm: agora.toISOString() });
    n++;
  }
  return n;
}
