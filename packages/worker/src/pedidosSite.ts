/**
 * Pedidos feitos pelo site por quem vinculou o personagem pela DM (ADR-0013). A borda grava
 * cada pedido no KV em `pedido-site/<jogadorId>`; a coleta aplica com as mesmas regras do
 * comentário e devolve o resultado no próprio item, para o site mostrar.
 */
import type { Posicao, TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { transferirJogador, type Resultado } from './coletar.js';
import type { Agenda } from './nuvem.js';
import { aplicarPerfil } from './perfil.js';

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
  pedidoEm: string;
  resultado?: 'SALVO' | 'RECUSADO';
  mensagem?: string;
  processadoEm?: string;
}

/** Aplica os pedidos pendentes (Transferência e perfil). Devolve quantos foram processados. */
export async function processarPedidosDoSite(banco: Banco, agenda: Agenda, agora: Date): Promise<number> {
  let n = 0;
  // Quem pediu primeiro é atendido primeiro (vale para a camisa disputada).
  const perfis = (await Promise.all((await agenda.listar(PREFIXO_PERFIL_SITE)).map(async (chave) => ({ chave, p: await agenda.ler<PerfilDoSite>(chave) })))).filter((x) => x.p && !x.p.processadoEm).sort((a, b) => a.p!.pedidoEm.localeCompare(b.p!.pedidoEm));
  for (const { chave, p: lido } of perfis) {
    const p = lido!;
    const r = await banco.transacao((b) => aplicarPerfil(b, p.jogadorId, { ...(p.visual ? { visual: p.visual } : {}), ...(p.numero !== undefined ? { numero: p.numero } : {}) }));
    await agenda.gravar(chave, { ...p, resultado: r.ok ? 'SALVO' : 'RECUSADO', mensagem: r.mensagem, processadoEm: agora.toISOString() });
    n++;
  }
  const pedidos = (await Promise.all((await agenda.listar(PREFIXO_PEDIDO_SITE)).map(async (chave) => ({ chave, p: await agenda.ler<PedidoDoSite>(chave) })))).filter((x) => x.p && !x.p.processadoEm && x.p.tipo === 'TRANSFERENCIA').sort((a, b) => a.p!.pedidoEm.localeCompare(b.p!.pedidoEm));
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
