/**
 * Loja no painel do dono (ADR-0087 e ADR-0101): os Itens por Encaixe, com o boneco de prévia.
 * Tocar num Item mostra no boneco; o botão compra (se ainda não é do Jogador), equipa ou tira.
 */
import { ENCAIXES_DO_JOGADOR, ENCAIXES_DO_TECNICO, ENCAIXE_SO_DO_GOLEIRO, ITENS, ITEM_POR_CODIGO, NOME_DO_ENCAIXE, PRECO_DO_ITEM, type Encaixe, type Item, type ItensEquipados } from '@liga/shared';
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
  /** Técnico (ADR-0111): só os Itens do boneco do Técnico. */
  tecnico?: boolean;
}

/**
 * Itens que aparecem na prateleira: os à venda na fase aberta e, dos exclusivos (Item de
 * Apoiador, ADR-0108), só os que já são do Jogador.
 */
export const itensDaPrateleira = (fase: 1 | 2, donos: readonly string[] = [], tecnico = false): Item[] =>
  ITENS.filter((i) => i.fase <= fase && !!i.tecnico === tecnico && (!i.exclusivo || donos.includes(i.codigo)));

/** Encaixes que aparecem: a Luva só para o goleiro, e só os que já têm Item na fase aberta. */
export const encaixesDaLoja = (goleiro: boolean, fase: 1 | 2 = 1, donos: readonly string[] = [], tecnico = false): Encaixe[] =>
  (tecnico ? ENCAIXES_DO_TECNICO : ENCAIXES_DO_JOGADOR).filter((e) => (goleiro || e !== ENCAIXE_SO_DO_GOLEIRO) && itensDaPrateleira(fase, donos, tecnico).some((i) => i.encaixe === e));

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

/** O que vai na etiqueta pendurada na peça: o preço, "Seu" ou "Usando". */
export function etiquetaDoItem(item: Item, e: EstadoDaLoja): string {
  if (e.equipados[item.encaixe] === item.codigo) return 'Usando';
  if (e.donos.includes(item.codigo)) return 'Seu';
  return String(PRECO_DO_ITEM[item.raridade]);
}

/**
 * O vestiário: em cima, o provador (o boneco do Jogador vestindo o que foi tocado) e o balcão
 * com a peça escolhida; embaixo, uma prateleira por Encaixe, com cada peça desenhada e a
 * etiqueta de preço pendurada. Os ícones são desenhados depois, nos canvas `data-icone`.
 */
export function corpoDaLoja(e: EstadoDaLoja, selecionado: string | null) {
  const item = selecionado ? ITEM_POR_CODIGO.get(selecionado) ?? null : null;
  const acao = item ? acaoDoItem(item, e) : null;
  const faltam = acao?.tipo === 'COMPRAR' && !acao.podePagar && e.saldo !== null ? acao.preco - e.saldo : 0;
  return html`<div class="vestiario">
    <div class="provador-e-balcao">
      <div class="provador">
        <canvas class="pixel previa-boneco" width="96" height="128" aria-label="${item ? `O seu boneco com ${item.nome.toLowerCase()}` : 'O seu boneco'}"></canvas>
        ${e.saldo === null ? '' : html`<p class="saldo-moedas" aria-label="Saldo: ${e.saldo} Moedas"><span class="moeda" aria-hidden="true"></span><strong>${e.saldo}</strong></p>`}
      </div>
      <div class="balcao" aria-live="polite">
        ${item && acao
          ? html`<p class="balcao-peca">${item.nome}</p>
              <p class="balcao-detalhe">${item.raridade === 'RARO' ? 'Peça rara' : 'Peça básica'}${acao.tipo === 'COMPRAR' ? `, ${acao.preco} Moedas` : acao.tipo === 'TIRAR' ? ', no seu boneco agora' : ', já é sua'}</p>
              <button type="button" class="botao" data-acao-loja="${acao.tipo}" ${acao.tipo === 'COMPRAR' && !acao.podePagar ? 'disabled' : ''}>${textoDoBotao(item, acao)}</button>
              ${faltam ? html`<p class="balcao-falta">Faltam ${faltam} Moedas. O Salário entra a cada Rodada.</p>` : ''}`
          : html`<p class="balcao-peca">Escolha uma peça</p>
              <p class="balcao-detalhe">Toque numa peça para provar no boneco. A peça é sua para sempre e troca sem pagar de novo. Vale a partir do próximo jogo.</p>`}
        <p class="estado-loja" role="status" aria-live="polite"></p>
      </div>
    </div>
    <div class="prateleiras">
      ${encaixesDaLoja(e.goleiro, e.fase, e.donos, !!e.tecnico).map(
        (encaixe) => html`<section class="prateleira" aria-label="${NOME_DO_ENCAIXE[encaixe]}">
          <h2>${NOME_DO_ENCAIXE[encaixe]}</h2>
          <div class="estante">
            ${itensDaPrateleira(e.fase, e.donos, !!e.tecnico).filter((i) => i.encaixe === encaixe).map((i) => {
              const etiqueta = etiquetaDoItem(i, e);
              const rotulo = `${i.nome}${etiqueta === 'Usando' ? ', no seu boneco' : etiqueta === 'Seu' ? ', já é sua' : `, ${etiqueta} Moedas`}`;
              return html`<button type="button" class="peca ${i.raridade === 'RARO' ? 'rara' : ''} ${etiqueta === 'Usando' ? 'usando' : etiqueta === 'Seu' ? 'sua' : ''}" data-item="${i.codigo}" aria-pressed="${String(i.codigo === selecionado)}" aria-label="${rotulo}" title="${i.nome}">
                <canvas class="pixel icone" data-icone="${i.codigo}" width="60" height="48" aria-hidden="true"></canvas>
                <span class="etiqueta" aria-hidden="true">${etiqueta}</span>
              </button>`;
            })}
          </div>
        </section>`,
      )}
    </div>
  </div>`;
}
