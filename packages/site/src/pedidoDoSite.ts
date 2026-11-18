/**
 * Pedido de Transferência feito pelo site (ADR-0013), como a borda devolve em
 * `transferencia/estado`. A borda guarda o último pedido por 7 dias, então ele pode ser de
 * uma Temporada que já acabou.
 */
export interface PedidoDoSite {
  time?: string;
  posicao?: string;
  pedidoEm?: string;
  resultado?: string;
  mensagem?: string;
  processadoEm?: string;
}

/**
 * Por quanto tempo um pedido já processado ainda vale para o painel: o tempo de o
 * jogadores.json ser republicado com a mudança (1 ou 2 minutos), com folga. Igual à validade
 * do ajuste local (`ajustarLocalmente`).
 */
export const JANELA_DO_PEDIDO_MS = 15 * 60_000;

/**
 * O pedido que o painel deve considerar. Pendente vale sempre; processado só dentro da
 * janela. Depois dela, quem manda é o jogadores.json (Time, Posição e `transferenciaUsada`):
 * um pedido antigo não pode trazer o Time de volta, nem dizer que a Transferência da
 * Temporada nova já foi usada (caso do Jogador remanejado no Rebalanceamento da T2, que tinha
 * se transferido pelo site na T1 e voltava a aparecer no Time antigo ao vincular).
 */
export function pedidoValido<T extends PedidoDoSite>(p: T | null | undefined, agora: Date): T | Record<string, never> {
  if (!p || !p.pedidoEm) return {};
  if (!p.processadoEm) return p;
  const quando = Date.parse(p.processadoEm);
  if (!Number.isFinite(quando) || agora.getTime() - quando > JANELA_DO_PEDIDO_MS) return {};
  return p;
}
