/**
 * Plano do Capitão na página do Time (ADR-0086): quem tem Vínculo com um Jogador do Time vê a
 * Formação e a Postura que o Capitão escolheu para o próximo jogo. Os outros não veem: o
 * adversário não pode saber antes do Corte.
 */
import { CORTE_MINUTOS, DESCRICAO_DA_FORMACAO, FORMACAO_PADRAO, FORMACOES, POSTURAS, QUANTIDADE_DE_BATEDORES, ehFormacao, type Formacao, type Posicao, type Postura, type TimeId } from '@liga/shared';
import { desenhoDaFormacao } from './formacao.js';
import { contraO, quandoDoJogo } from './presenca.js';
import { html } from './ui.js';

/** Capitania e Presença do próximo jogo do Time (borda, `escolha/estado`). */
export interface Capitania {
  eu: boolean;
  capitao: string | null;
  postura: string;
  formacao?: string;
  presenca?: boolean;
  jogo?: { apito: string; adversario: TimeId } | null;
  /** T3 (ADR-0091): Batedores escolhidos (ids, em ordem) e o Elenco para escolher. */
  batedores?: string[];
  elenco?: { id: string; nome: string; posicao: Posicao }[];
}

/**
 * A capitania guardada no navegador só vale enquanto o jogo dela ainda é o próximo, antes do
 * Corte (ADR-0094). Depois disso o próximo jogo é outro, e a página espera a borda.
 */
export function capitaniaAindaVale(c: Capitania | null | undefined, agora = Date.now()): c is Capitania {
  return Boolean(c?.jogo && Date.parse(c.jogo.apito) - CORTE_MINUTOS * 60_000 > agora);
}

export const NOME_DA_POSTURA: Record<Postura, string> = { OFENSIVA: 'Ofensiva', EQUILIBRADA: 'Equilibrada', DEFENSIVA: 'Defensiva' };
export const DESCRICAO_DA_POSTURA: Record<Postura, string> = {
  OFENSIVA: 'O Time ataca mais e deixa a defesa mais exposta.',
  EQUILIBRADA: 'Sem mudar nada (é a Postura quando o Capitão não escolhe).',
  DEFENSIVA: 'O Time se fecha atrás e ataca menos.',
};

/** Batedores (ADR-0091): os nomes, em ordem, de quem o Capitão escolheu (só quem ainda está no Elenco). */
export function nomesDosBatedores(c: Capitania): string[] {
  return (c.batedores ?? []).flatMap((id) => c.elenco?.find((x) => x.id === id)?.nome ?? []);
}

const ORDEM_DA_LISTA: Posicao[] = ['ATA', 'MEI', 'ZAG', 'GOL'];
const SIGLA: Record<Posicao, string> = { ATA: 'ATA', MEI: 'MEI', ZAG: 'ZAG', GOL: 'GOL' };

/**
 * Os formulários do Capitão (ADRs 0020, 0044 e 0091): Postura, Formação e, a partir da T3,
 * Batedores. Os mesmos no painel do Jogador e na página do Time.
 */
export function formulariosDoCapitao(c: Capitania, time: string) {
  const atual: Postura = (POSTURAS as readonly string[]).includes(c.postura) ? (c.postura as Postura) : 'EQUILIBRADA';
  const formacao: Formacao = ehFormacao(c.formacao) ? c.formacao : FORMACAO_PADRAO;
  const radio = (valor: Postura) =>
    html`<label class="opcao-t2"><input type="radio" name="valor" value="${valor}" ${valor === atual ? 'checked' : ''} /><span><strong>${NOME_DA_POSTURA[valor]}</strong><small>${DESCRICAO_DA_POSTURA[valor]}</small></span></label>`;
  const opcaoFormacao = (f: Formacao) => {
    const d = DESCRICAO_DA_FORMACAO[f];
    return html`<label class="opcao-t2 opcao-formacao"><input type="radio" name="valor" value="${f}" ${f === formacao ? 'checked' : ''} />${desenhoDaFormacao(f)}<span><strong>${d.nome}${d.jogada ? html` <em class="jogada-formacao">${d.jogada}</em>` : ''}</strong><small>${d.linha}</small></span></label>`;
  };
  return html`<form class="escolha-t2" data-tipo="POSTURA">
      <p><strong>Você é o Capitão do ${time}</strong> no próximo jogo. Escolha como o Time joga; dá para mudar até o Corte.</p>
      <fieldset class="opcoes-t2">${POSTURAS.map(radio)}</fieldset>
      <p><button type="submit" class="botao">Escolher a Postura</button></p>
      <p class="estado-escolha" role="status" aria-live="polite"></p>
    </form>
    <form class="escolha-t2" data-tipo="FORMACAO">
      <p><strong>Formação</strong>: quantos jogam atrás, no meio e na frente. Quem ficar fora porque a Formação cortou a vaga passa na frente no jogo seguinte. Faltando gente numa Posição, alguém de outra joga fora de posição.</p>
      <fieldset class="opcoes-t2 formacoes">${FORMACOES.map(opcaoFormacao)}</fieldset>
      <p><button type="submit" class="botao">Escolher a Formação</button></p>
      <p class="estado-escolha" role="status" aria-live="polite"></p>
    </form>
    ${formularioDosBatedores(c)}`;
}

/** Batedores (ADR-0091): cinco listas em ordem; vazio é a ordem automática dali em diante. */
function formularioDosBatedores(c: Capitania) {
  if (!c.elenco) return html``;
  const elenco = [...c.elenco].sort((a, b) => ORDEM_DA_LISTA.indexOf(a.posicao) - ORDEM_DA_LISTA.indexOf(b.posicao) || a.nome.localeCompare(b.nome));
  const escolhidos = c.batedores ?? [];
  const lista = (k: number) =>
    html`<label class="batedor"><span>${k + 1}º</span><select name="batedor">
      <option value="">Automático</option>
      ${elenco.map((x) => html`<option value="${x.id}" ${escolhidos[k] === x.id ? 'selected' : ''}>${x.nome} (${SIGLA[x.posicao]})</option>`)}
    </select></label>`;
  return html`<form class="escolha-t2" data-tipo="BATEDORES">
    <p><strong>Batedores</strong>: quem bate os pênaltis na disputa, em ordem. Se alguém não estiver em campo, bate o próximo. Depois dos escolhidos, vale a ordem automática (atacantes, meias, zagueiros e goleiro).</p>
    <fieldset class="lista-batedores">${Array.from({ length: QUANTIDADE_DE_BATEDORES }, (_, k) => lista(k))}</fieldset>
    <p><button type="submit" class="botao">Salvar Batedores</button></p>
    <p class="estado-escolha" role="status" aria-live="polite"></p>
  </form>`;
}

/** O valor de um formulário do Capitão: os Batedores são uma lista (sem vazios nem repetidos). */
export function valorDoFormulario(form: HTMLFormElement): string | string[] | null {
  const dados = new FormData(form);
  if (form.dataset.tipo === 'BATEDORES') return [...new Set(dados.getAll('batedor').map(String).filter(Boolean))];
  const v = dados.get('valor');
  return v ? String(v) : null;
}

/** Postura e Formação valendo (sem escolha do Capitão: Equilibrada no 2-2-2). */
export function planoDaCapitania(c: Capitania): { postura: Postura; formacao: Formacao } {
  return {
    postura: (POSTURAS as readonly string[]).includes(c.postura) ? (c.postura as Postura) : 'EQUILIBRADA',
    formacao: ehFormacao(c.formacao) ? c.formacao : FORMACAO_PADRAO,
  };
}

/** O bloco do plano, para quem é do Time. `jogadorId`: o link do painel, quando é o Capitão. */
export function blocoDoPlano(c: Capitania, jogadorId: string, agora = new Date(), time = 'Time') {
  const { postura, formacao } = planoDaCapitania(c);
  const batedores = nomesDosBatedores(c);
  const d = DESCRICAO_DA_FORMACAO[formacao];
  const jogo = c.jogo ? `${quandoDoJogo(c.jogo.apito, agora)}, ${contraO(c.jogo.adversario)}` : null;
  const capitao = c.eu
    ? html`<strong>Você</strong> é o Capitão: mude aqui embaixo ou <a href="#/jogador/${jogadorId}">no seu painel</a>, até o Corte.`
    : c.capitao
      ? html`Escolha do Capitão <strong>@${c.capitao}</strong>; dá para mudar até o Corte.`
      : html`Ainda sem Capitão: vale o padrão até alguém escolher.`;
  return html`<section class="plano-do-capitao placa" aria-labelledby="titulo-plano">
    <h2 id="titulo-plano" class="secao">Plano do Capitão <small>só quem é do Time vê</small></h2>
    <div class="plano-corpo">
      ${desenhoDaFormacao(formacao)}
      <div>
        ${jogo ? html`<p class="plano-jogo">Próximo jogo: ${jogo}</p>` : ''}
        <p class="plano-escolha"><span>Formação <strong>${d.nome}</strong>${d.jogada ? html` <em class="jogada-formacao">${d.jogada}</em>` : ''}</span><span>Postura <strong>${NOME_DA_POSTURA[postura]}</strong></span></p>
        ${c.elenco ? html`<p class="plano-batedores">Batedores <strong>${batedores.length ? batedores.map((n, k) => `${k + 1}.\u00a0${n}`).join(' · ') : 'ordem automática'}</strong></p>` : ''}
        <p class="legenda">${capitao}</p>
      </div>
    </div>
    ${c.eu ? html`<details class="dobra escolhas-no-time" data-dobra="capitao-no-time"><summary>Mudar o plano <small>Postura, Formação${c.elenco ? ' e Batedores' : ''}</small></summary>${formulariosDoCapitao(c, time)}</details>` : ''}
  </section>`;
}
