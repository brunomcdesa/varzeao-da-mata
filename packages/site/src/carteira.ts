/**
 * Moedas no painel do dono (ADRs 0087, 0089 e 0090): saldo, últimos lançamentos, Conquistas e
 * Palpites. Só pelo Vínculo; o saldo nunca aparece para os outros.
 */
import { CONQUISTA_POR_CODIGO, MOEDAS_DO_NIVEL, type Carteira } from '@liga/shared';
import { html } from './ui.js';

export const blocoDaCarteira = (aberta: boolean) =>
  html`<details class="dobra carteira" data-dobra="carteira" ${aberta ? 'open' : ''}>
    <summary>Moedas <small data-saldo>…</small></summary>
    <div data-carteira><p class="legenda">Carregando...</p></div>
  </details>`;

const sinal = (v: number) => (v > 0 ? `+${v}` : String(v));
const quando = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function corpoDaCarteira(c: Carteira) {
  const pendentes = c.palpites.filter((p) => p.pontos === null).length;
  return html`<p class="saldo-moedas"><span class="moeda" aria-hidden="true"></span><strong>${c.saldo}</strong> Moedas</p>
    <p class="legenda">Salário todo dia de jogo, prêmio por gol, assistência, Seleção, Craque e Título, acerto no Palpite e Conquistas. Só compram visual na Loja.</p>
    ${c.extrato.length
      ? html`<h3 class="subsecao">Últimos lançamentos</h3><ul class="extrato">${c.extrato.slice(0, 12).map(
          (l) => html`<li><span class="extrato-dia">${quando(l.em)}</span><span>${l.descricao}</span><strong class="${l.valor < 0 ? 'saida' : 'entrada'}">${sinal(l.valor)}</strong></li>`,
        )}</ul>`
      : html`<p class="legenda">Ainda não entrou nada. O primeiro Salário chega no fim do primeiro dia de jogo.</p>`}
    ${c.conquistas.length
      ? html`<h3 class="subsecao">Conquistas <small>${c.conquistas.length}</small></h3><p class="selos-conquista">${c.conquistas.map((x) => {
          const q = CONQUISTA_POR_CODIGO.get(x.codigo);
          return q ? html`<span class="selo-conquista nivel-${q.nivel.toLowerCase()}" title="${q.descricao}">${q.nome}${x.pagou ? html` <small>+${MOEDAS_DO_NIVEL[q.nivel]}</small>` : ''}</span>` : '';
        })}</p>`
      : ''}
    ${c.palpites.length ? html`<p class="legenda">Palpites: ${c.palpites.length} feitos${pendentes ? `, ${pendentes} esperando o jogo` : ''}. Dá para palpitar na página de cada Partida até o Corte.</p>` : html`<p class="legenda">Palpite na página de cada Partida, até o Corte: resultado vale 2, placar exato vale 5 (até 10 por dia).</p>`}`;
}

export async function ligarCarteira(caixa: HTMLElement, buscar: () => Promise<{ status: number; dados: Carteira & { erro?: string } }>): Promise<void> {
  const lugar = caixa.querySelector<HTMLElement>('[data-carteira]');
  const resumo = caixa.querySelector<HTMLElement>('[data-saldo]');
  if (!lugar) return;
  const r = await buscar().catch(() => null);
  if (!r || r.status !== 200 || typeof r.dados.saldo !== 'number') {
    lugar.innerHTML = html`<p class="legenda">Não deu para abrir a Carteira agora.</p>`.s;
    return;
  }
  lugar.innerHTML = corpoDaCarteira(r.dados).s;
  if (resumo) resumo.textContent = `${r.dados.saldo}`;
}
