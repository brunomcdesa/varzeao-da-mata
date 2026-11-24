/**
 * Liga o Técnico e o Interesse nas páginas (ADR-0106): na página do Time, o Plano do Time e a
 * aba Contratações para quem é do Time, ou "Jogar no Time" e "Trazer do Time" para quem é de
 * outro; no painel do Jogador, os Convites e as Trocas casadas que chegaram.
 */
import { type JogadorPublico, type LigaPublica, type Posicao, type TimeId } from '@liga/shared';
import { enviarEscolhaDoVinculo, painelDoVinculo, painelGuardado, pedirTransferenciaDoVinculo, type TipoDeEscolha } from './meuPersonagem.js';
import { abaContratacoes, blocoDoMercado, blocoDoOutroTime, blocoDoPlanoT3, blocoSerTecnico, valorDoPainel, type MercadoDoJogador, type PainelDoTime } from './painelDoTime.js';
import { html } from './ui.js';

const LIMITE: Record<Posicao, number> = { GOL: 2, ZAG: 4, MEI: 4, ATA: 4 };

/** Responde no lugar do formulário ou do botão e, se deu certo, redesenha com o painel novo. */
async function enviar(alvo: HTMLElement, tipo: TipoDeEscolha | 'JOGAR_AQUI', valor: string | string[] | null, time: TimeId | undefined, depois: () => void): Promise<void> {
  const estado = alvo.querySelector<HTMLElement>('.estado-escolha') ?? alvo.parentElement?.querySelector<HTMLElement>('.estado-escolha') ?? null;
  if (estado) {
    estado.textContent = 'Enviando...';
    estado.className = 'estado-escolha';
  }
  const r =
    tipo === 'JOGAR_AQUI'
      ? await pedirTransferenciaDoVinculo(time!, String(valor ?? ''))
      : await enviarEscolhaDoVinculo(tipo, valor).then((x) => ({ ok: x.ok, mensagem: x.mensagem }));
  if (estado) {
    estado.textContent = r.mensagem;
    estado.className = `estado-escolha ${r.ok ? 'sucesso' : 'erro'}`;
  }
  if (r.ok) setTimeout(depois, 1200);
}

/** Formulários e botões com `data-tipo` / `data-acao` dentro de `raiz`. */
function ligarAcoes(raiz: HTMLElement, depois: () => void): void {
  for (const form of raiz.querySelectorAll<HTMLFormElement>('form.escolha-t2[data-tipo]')) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void enviar(form, form.dataset.tipo as TipoDeEscolha | 'JOGAR_AQUI', valorDoPainel(form), form.dataset.time as TimeId | undefined, depois);
    });
  }
  for (const b of raiz.querySelectorAll<HTMLButtonElement>('button[data-acao]')) {
    b.addEventListener('click', () => {
      b.disabled = true;
      void enviar(b.closest<HTMLElement>('.cartao-mercado, .placa, .escolha-t2, details') ?? raiz, b.dataset.acao as TipoDeEscolha, b.dataset.valor ?? null, undefined, depois).finally(() => (b.disabled = false));
    });
  }
}

/**
 * Página do Time (T3). `lugarDoPlano`: o `[data-plano]` da aba Escalação; `antesDasAbas`: onde
 * entra o "Jogar no Time" para quem é de outro Time.
 */
export function ligarPainelDoTime(main: HTMLElement, o: { time: TimeId; l: LigaPublica; elenco: JogadorPublico[]; todos: JogadorPublico[]; aoMudarFormacao: (f: string | null) => void }): void {
  const pagina = main.querySelector('.pagina-time');
  let mostrado = '';
  const desenhar = (r: { jogadorId: string; painel: PainelDoTime | null; mercado: MercadoDoJogador | null } | null) => {
    if (!r || !pagina?.isConnected) return;
    const chave = JSON.stringify(r.painel);
    if (chave === mostrado) return;
    mostrado = chave;
    const p = r.painel;
    const doTime = p?.time === o.time;
    // Do Time (Técnico, Capitão ou Jogador): o Plano do Time e, para quem decide, Contratações.
    const lugar = main.querySelector<HTMLElement>('[data-plano]');
    if (lugar) {
      lugar.hidden = !doTime;
      lugar.innerHTML = doTime && p ? blocoDoPlanoT3(p).s : '';
      if (doTime) ligarAcoes(lugar, () => void painelDoVinculo(true).then(desenhar));
    }
    if (doTime && p) o.aoMudarFormacao(p.plano?.formacao ?? null);
    const grupo = main.querySelector<HTMLElement>('.subabas[data-subabas="time"]');
    grupo?.querySelector('[data-aba="contratacoes"]')?.remove();
    grupo?.querySelector('[data-painel="contratacoes"]')?.remove();
    main.querySelector('.time-colunas')?.querySelectorAll('.contratacoes-sem-abas').forEach((x) => x.remove());
    if (doTime && p?.pedidos !== undefined) {
      const conteudo = abaContratacoes(p).s;
      if (grupo) {
        const n = (p.pedidos?.length ?? 0) + (p.trocas?.length ?? 0);
        grupo.querySelector('.subabas-barra [data-aba="escalacao"]')?.insertAdjacentHTML(
          'afterend',
          html`<button type="button" role="tab" aria-selected="false" tabindex="-1" data-aba="contratacoes" id="aba-time-contratacoes" aria-controls="painel-time-contratacoes">Contratações${n ? ` (${n})` : ''}</button>`.s,
        );
        grupo.querySelector('[data-painel="escalacao"]')?.insertAdjacentHTML(
          'afterend',
          `<div class="subaba-painel" role="tabpanel" id="painel-time-contratacoes" aria-labelledby="aba-time-contratacoes" data-painel="contratacoes">${conteudo}</div>`,
        );
        ligarAcoes(grupo.querySelector<HTMLElement>('[data-painel="contratacoes"]')!, () => void painelDoVinculo(true).then(desenhar));
      }
    }
    // De outro Time: "Jogar no Time" (Jogador) e "Trazer do Time" (quem decide no Time dele).
    main.querySelector('.painel-outro-time')?.remove();
    if (!doTime) {
      const eu = o.todos.find((x) => x.id === r.jogadorId) ?? null;
      const tecnico = o.l.times.find((x) => x.id === o.time)?.tecnico;
      const bloco = html`<div class="painel-outro-time">${blocoDoOutroTime(o.time, eu, p, o.elenco, o.l.times.find((x) => x.id === o.time)?.fila ?? {}, tecnico ? (tecnico.apelido ?? `@${tecnico.username}`) : null, LIMITE)}${
        eu && !tecnico ? blocoSerTecnico(o.time) : ''
      }</div>`;
      main.querySelector('.time-colunas')?.insertAdjacentHTML('beforebegin', bloco.s);
      const novo = main.querySelector<HTMLElement>('.painel-outro-time');
      if (novo) ligarAcoes(novo, () => void painelDoVinculo(true).then(desenhar));
    } else if (p && p.papel !== 'TECNICO' && !p.tecnico) {
      // Do Time sem Técnico: o Jogador pode pedir para ser o Técnico.
      main.querySelector('.time-colunas')?.insertAdjacentHTML('beforebegin', `<div class="painel-outro-time">${blocoSerTecnico(o.time).s}</div>`);
      const novo = main.querySelector<HTMLElement>('.painel-outro-time');
      if (novo) ligarAcoes(novo, () => void painelDoVinculo(true).then(desenhar));
    }
  };
  desenhar(painelGuardado());
  void painelDoVinculo().then(desenhar);
}

/** Painel do Jogador: os Convites e Trocas casadas que chegaram, e os pedidos dele. */
export function ligarMercado(lugar: HTMLElement, jogadorId: string): void {
  const desenhar = (r: { jogadorId: string; mercado: MercadoDoJogador | null } | null) => {
    if (!r || r.jogadorId !== jogadorId || !lugar.isConnected) return;
    lugar.innerHTML = r.mercado ? blocoDoMercado(r.mercado).s : '';
    ligarAcoes(lugar, () => void painelDoVinculo(true).then(desenhar));
  };
  desenhar(painelGuardado());
  void painelDoVinculo().then(desenhar);
}
