/**
 * Pedidos feitos pelo site por quem vinculou o personagem pela DM (ADR-0013). A borda grava
 * cada pedido no KV em `pedido-site/<jogadorId>`; a coleta aplica com as mesmas regras do
 * comentário e devolve o resultado no próprio item, para o site mostrar.
 */
import type { Posicao, TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { transferirJogador, type Resultado } from './coletar.js';
import type { Agenda } from './nuvem.js';

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

/** Aplica os pedidos pendentes. Devolve quantos foram processados. */
export async function processarPedidosDoSite(banco: Banco, agenda: Agenda, agora: Date): Promise<number> {
  let n = 0;
  for (const chave of await agenda.listar(PREFIXO_PEDIDO_SITE)) {
    const p = await agenda.ler<PedidoDoSite>(chave);
    if (!p || p.processadoEm || p.tipo !== 'TRANSFERENCIA') continue;
    const r = await banco.transacao((b) =>
      transferirJogador(b, p.jogadorId, { times: p.time ? [p.time] : [], ...(p.posicao ? { posicao: p.posicao } : {}) }, { quando: agora, ref: `site:${p.jogadorId}:${p.pedidoEm}` }),
    );
    const msg = r.mensagem ? r.mensagem.charAt(0).toUpperCase() + r.mensagem.slice(1) : 'Pedido não entendido.';
    await agenda.gravar(chave, { ...p, resultado: r.resultado, mensagem: msg, processadoEm: agora.toISOString() });
    n++;
  }
  return n;
}
