/**
 * Subabas (ADR-0103): no celular, uma tela comprida vira abas (Escalação | Elenco | Jogos…),
 * mostrando uma de cada vez. No computador a barra some e tudo aparece como antes.
 */
import { html, type Html } from './ui.js';

export interface Aba {
  id: string;
  rotulo: string;
  conteudo: Html | string;
}

const LEMBRADAS = 'varzeao:abas';

/** Qual aba abrir: a escolhida antes nesta tela, senão a `padrao`, senão a primeira. */
export function abaInicial(ids: string[], lembrada: string | null | undefined, padrao?: string): string | undefined {
  if (lembrada && ids.includes(lembrada)) return lembrada;
  if (padrao && ids.includes(padrao)) return padrao;
  return ids[0];
}

function lembradas(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(LEMBRADAS) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function lembrar(chave: string, id: string): void {
  try {
    sessionStorage.setItem(LEMBRADAS, JSON.stringify({ ...lembradas(), [chave]: id }));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/** Chave da tela atual: a mesma aba volta aberta quando se volta para esta tela. */
const chaveDaTela = (nome: string) => `${location.hash.replace(/^#/, '') || '/'}::${nome}`;

/** As subabas. `nome` separa dois grupos na mesma tela; `padrao` é a aba da primeira visita. */
export function abas(nome: string, itens: Aba[], padrao?: string): Html {
  const vale = itens.filter((i) => String(i.conteudo).trim());
  if (vale.length < 2) return html`${vale.map((i) => i.conteudo)}`;
  const ativa = abaInicial(vale.map((i) => i.id), lembradas()[chaveDaTela(nome)], padrao);
  return html`<div class="subabas" data-subabas="${nome}">
    <div class="subabas-barra" role="tablist" aria-label="Partes da tela">${vale.map(
      (i) => html`<button type="button" role="tab" id="aba-${nome}-${i.id}" aria-controls="painel-${nome}-${i.id}" aria-selected="${String(i.id === ativa)}" tabindex="${i.id === ativa ? 0 : -1}" data-aba="${i.id}">${i.rotulo}</button>`,
    )}</div>
    ${vale.map((i) => html`<div class="subaba-painel${i.id === ativa ? ' ativa' : ''}" role="tabpanel" id="painel-${nome}-${i.id}" aria-labelledby="aba-${nome}-${i.id}" data-painel="${i.id}">${i.conteudo}</div>`)}
  </div>`;
}

/** Abre uma aba (por clique, teclado ou de dentro da página, como o lance que leva ao campo). */
export function mostrarAba(grupo: Element, id: string, foco = false): void {
  const botoes = [...grupo.querySelectorAll<HTMLButtonElement>(':scope > .subabas-barra [data-aba]')];
  if (!botoes.some((b) => b.dataset.aba === id)) return;
  for (const b of botoes) {
    const sim = b.dataset.aba === id;
    b.setAttribute('aria-selected', String(sim));
    b.tabIndex = sim ? 0 : -1;
    if (sim) {
      b.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (foco) b.focus();
    }
  }
  for (const p of grupo.querySelectorAll<HTMLElement>(':scope > [data-painel]')) p.classList.toggle('ativa', p.dataset.painel === id);
  lembrar(chaveDaTela((grupo as HTMLElement).dataset.subabas ?? ''), id);
}

/** Liga os cliques e as setas do teclado uma vez só, para todas as telas. */
export function ligarAbas(raiz: HTMLElement): void {
  raiz.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.subabas-barra [data-aba]');
    const grupo = b?.closest('.subabas');
    if (!b || !grupo) return;
    mostrarAba(grupo, b.dataset.aba!);
    // A barra fica presa no alto: a aba nova começa do começo, sem perder o lugar da barra.
    const topo = grupo.getBoundingClientRect().top + window.scrollY - (document.querySelector('.topo')?.getBoundingClientRect().height ?? 0);
    if (window.scrollY > topo) window.scrollTo({ top: topo });
  });
  raiz.addEventListener('keydown', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.subabas-barra [data-aba]');
    if (!b || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const todos = [...b.parentElement!.querySelectorAll<HTMLButtonElement>('[data-aba]')];
    const k = (todos.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1) + todos.length) % todos.length;
    mostrarAba(b.closest('.subabas')!, todos[k]!.dataset.aba!, true);
    e.preventDefault();
  });
}

/** Ao abrir uma tela, a aba ativa aparece na barra (com muitas Rodadas, ela rola). */
export function centralizarAbas(raiz: HTMLElement): void {
  for (const b of raiz.querySelectorAll<HTMLElement>('.subabas-barra [aria-selected="true"]')) {
    const barra = b.parentElement!;
    barra.scrollLeft = b.offsetLeft - (barra.clientWidth - b.offsetWidth) / 2;
  }
}
