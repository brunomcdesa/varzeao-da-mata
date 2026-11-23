/**
 * Atalho da Loja no canto do topo (ADR-0101): a sacola leva à #/loja. Com Vínculo, o saldo de
 * Moedas aparece ao lado (só o dono vê). Sem Vínculo, só a sacola. Antes da T3, nada.
 */
import { Html, html } from './ui.js';

const SACOLA = new Html(`<svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true"><path fill="#20140b" d="M3 0h4v1H3zM2 1h1v2H2zM7 1h1v2H7zM1 3h8v1H1zM0 4h1v6H0zM9 4h1v6H9zM1 9h8v1H1z"/><path fill="#a85d37" d="M1 4h8v5H1z"/><path fill="#f3e6c9" d="M3 5h1v1H3zM6 5h1v1H6z"/></svg>`);

export function conteudoDoAtalho(saldo: number | null): string {
  return saldo === null
    ? html`<span class="sacola">${SACOLA}</span>`.s
    : html`<span class="moeda" aria-hidden="true"></span><span data-saldo-topo>${saldo}</span><span class="sacola">${SACOLA}</span>`.s;
}

export const rotuloDoAtalho = (saldo: number | null) => (saldo === null ? 'Loja' : `Loja, ${saldo} Moedas`);

/** Mostra o atalho (com ou sem saldo). `null` esconde o saldo, `undefined` esconde tudo. */
export function mostrarCarteiraDoTopo(saldo: number | null | undefined): void {
  const a = document.querySelector<HTMLAnchorElement>('.carteira-topo');
  if (!a) return;
  a.hidden = saldo === undefined;
  if (saldo === undefined) return;
  a.innerHTML = conteudoDoAtalho(saldo);
  a.setAttribute('aria-label', rotuloDoAtalho(saldo));
}

/** Depois de uma compra: só troca o número. */
export function atualizarCarteiraDoTopo(saldo: number): void {
  const n = document.querySelector<HTMLElement>('[data-saldo-topo]');
  if (n) n.textContent = String(saldo);
  document.querySelector('.carteira-topo')?.setAttribute('aria-label', rotuloDoAtalho(saldo));
}
