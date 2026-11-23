/**
 * Loja no painel do dono (ADR-0087 e ADR-0101): os Itens por Encaixe, com o boneco de prévia.
 * Tocar num Item mostra no boneco; o botão compra (se ainda não é do Jogador), equipa ou tira.
 */
import { ENCAIXES, ENCAIXE_SO_DO_GOLEIRO, ITENS, ITEM_POR_CODIGO, NOME_DO_ENCAIXE, PRECO_DO_ITEM, type Encaixe, type Item, type ItensEquipados } from '@liga/shared';
import { html } from './ui.js';

export interface EstadoDaLoja {
  /** null sem Vínculo: o saldo não aparece e nada se compra. */
  saldo: number | null;
  /** Códigos dos Itens que já são do Jogador. */
  donos: readonly string[];
  equipados: ItensEquipados;
  goleiro: boolean;
  /** Fase da Loja aberta agora (1 na abertura da T3, 2 no meio). */
  fase: 1 | 2;
}

/** Encaixes que aparecem: a Luva só para o goleiro, e só os que já têm Item na fase aberta. */
export const encaixesDaLoja = (goleiro: boolean, fase: 1 | 2 = 1): Encaixe[] =>
  ENCAIXES.filter((e) => (goleiro || e !== ENCAIXE_SO_DO_GOLEIRO) && ITENS.some((i) => i.encaixe === e && i.fase <= fase));

/** O que o botão faz com o Item selecionado. */
export type AcaoDaLoja = { tipo: 'COMPRAR'; preco: number; podePagar: boolean } | { tipo: 'EQUIPAR' } | { tipo: 'TIRAR' };
export function acaoDoItem(item: Item, e: EstadoDaLoja): AcaoDaLoja {
  if (e.equipados[item.encaixe] === item.codigo) return { tipo: 'TIRAR' };
  if (e.donos.includes(item.codigo)) return { tipo: 'EQUIPAR' };
  const preco = PRECO_DO_ITEM[item.raridade];
  return { tipo: 'COMPRAR', preco, podePagar: e.saldo !== null && e.saldo >= preco };
}

export function textoDoBotao(item: Item, a: AcaoDaLoja): string {
  if (a.tipo === 'TIRAR') return `Tirar ${item.nome.toLowerCase()}`;
  if (a.tipo === 'EQUIPAR') return `Equipar ${item.nome.toLowerCase()}`;
  return a.podePagar ? `Comprar por ${a.preco} Moedas` : `Custa ${a.preco} Moedas`;
}

export function corpoDaLoja(e: EstadoDaLoja, selecionado: string | null) {
  const item = selecionado ? ITEM_POR_CODIGO.get(selecionado) ?? null : null;
  const acao = item ? acaoDoItem(item, e) : null;
  const faltam = acao?.tipo === 'COMPRAR' && !acao.podePagar && e.saldo !== null ? acao.preco - e.saldo : 0;
  return html`<div class="loja-grade">
      <div class="loja-vitrine">
        <canvas class="pixel previa-boneco" width="96" height="128" aria-label="Como o boneco fica com o Item"></canvas>
        ${e.saldo === null ? '' : html`<p class="saldo-moedas"><span class="moeda" aria-hidden="true"></span><strong>${e.saldo}</strong> Moedas</p>`}
      </div>
      <div class="loja-encaixes">
        ${encaixesDaLoja(e.goleiro, e.fase).map(
          (encaixe) => html`<fieldset><legend>${NOME_DO_ENCAIXE[encaixe]}</legend><div class="amostras">${ITENS.filter((i) => i.encaixe === encaixe && i.fase <= e.fase).map((i) => {
            const meu = e.donos.includes(i.codigo);
            const usando = e.equipados[encaixe] === i.codigo;
            const rotulo = `${i.nome}${usando ? ', equipado' : meu ? ', já é seu' : `, ${PRECO_DO_ITEM[i.raridade]} Moedas`}`;
            // Itens de desenho (corte, barba, comemoração) são botões com o nome; os de cor, amostras.
            return i.estilo
              ? html`<button type="button" class="item-nome item ${i.raridade === 'RARO' ? 'raro' : ''} ${meu ? 'meu' : ''} ${usando ? 'usando' : ''}" data-item="${i.codigo}" aria-pressed="${String(i.codigo === selecionado)}" aria-label="${rotulo}" title="${rotulo}">${i.nome}</button>`
              : html`<button type="button" class="amostra item ${i.raridade === 'RARO' ? 'raro' : ''} ${meu ? 'meu' : ''} ${usando ? 'usando' : ''}" data-item="${i.codigo}" style="--amostra:${i.cor}" aria-pressed="${String(i.codigo === selecionado)}" aria-label="${rotulo}" title="${rotulo}"></button>`;
          })}</div></fieldset>`,
        )}
      </div>
    </div>
    ${item && acao
      ? html`<div class="loja-escolha">
          <p><strong>${item.nome}</strong> <small>${item.raridade === 'RARO' ? 'Item raro' : 'Item básico'}${acao.tipo === 'COMPRAR' ? ` · ${acao.preco} Moedas` : acao.tipo === 'TIRAR' ? ' · equipado' : ' · já é seu'}</small></p>
          <button type="button" class="botao" data-acao-loja="${acao.tipo}" ${acao.tipo === 'COMPRAR' && !acao.podePagar ? 'disabled' : ''}>${textoDoBotao(item, acao)}</button>
          ${faltam ? html`<p class="legenda">Faltam ${faltam} Moedas: o Salário entra todo dia de jogo.</p>` : ''}
        </div>`
      : html`<p class="legenda">Toque num Item para ver no boneco. Básico custa ${PRECO_DO_ITEM.BASICO} Moedas e raro (dourado${e.fase >= 2 ? ' e comemoração' : ''}), ${PRECO_DO_ITEM.RARO}. O Item é seu para sempre e dá para trocar sem pagar de novo. A Escalação guarda o que estava equipado no Corte.</p>`}
    <p class="estado-loja" role="status" aria-live="polite"></p>`;
}
