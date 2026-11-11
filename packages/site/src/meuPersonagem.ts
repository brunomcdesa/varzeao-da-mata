/**
 * "Este personagem é meu" (ADR-0013): quem é dono do Jogador manda um código na DM da Liga
 * e este navegador fica vinculado a ele. Vinculado, pede a Transferência (ou a troca de
 * posição) pelo site, com as mesmas regras do comentário (ADR-0012).
 *
 * A sessão é um segredo que só este navegador guarda (localStorage); a borda guarda o hash.
 */
import { CANTOS, DESCRICAO_DA_ESPECIALIZACAO, DESCRICAO_DA_FORMACAO, ESPECIALIZACOES, FORMACOES, FORMACAO_PADRAO, HABILIDADES, NOME_DA_ESPECIALIZACAO, NOME_DA_HABILIDADE, POSTURAS, ehFormacao, type Canto, type Especializacao, type Formacao, type HabilidadeId, type Postura } from '@liga/shared';
import { desenhoDaFormacao } from './formacao.js';
import { APELIDO_MAX, apelidoLiberaEm, podeTrocarApelido, CABELOS, NOME_DO_PENTEADO, validarApelido, PELES, PENTEADOS, TIMES, type Aparencia, type JogadorPublico, type Penteado, type Posicao, type TimeId } from '@liga/shared';
import { ALTURA_SPRITE, LARGURA_SPRITE, aparencia, sprite, visualDoJogador, type Pose } from '@liga/renderer';
import { BASE_API, INSTAGRAM, ajustarLocalmente } from './dados.js';
import { curto, html, NOME_DA_POSICAO, POSICOES_EM_ORDEM } from './ui.js';

const CHAVE = 'varzeao:vinculo';
/** Quais partes do painel a pessoa deixou abertas: o painel e a página são redesenhados depois de um pedido. */
const abertas = new Set<string>();
/** Mesma folga da Inscrição (FOLGA_DE_ELENCO no worker). */
const FOLGA = 5;

interface Guardado {
  sessao: string;
  jogadorId: string;
  username: string;
}
interface Pendente {
  codigo: string;
  sessao: string;
  jogadorId: string;
  expiraEm: string;
}
interface Pedido {
  time?: TimeId;
  posicao?: Posicao;
  pedidoEm?: string;
  resultado?: string;
  mensagem?: string;
  processadoEm?: string;
}

const ler = <T>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const gravar = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem armazenamento: o vínculo vale só enquanto a página estiver aberta */
  }
};

async function api<T>(caminho: string, corpo: unknown): Promise<{ status: number; dados: T }> {
  const r = await fetch(`${BASE_API}${caminho}`, { method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } });
  return { status: r.status, dados: (await r.json().catch(() => ({}))) as T };
}

/** O Jogador vinculado neste navegador, se houver (os Avisos já vêm com o Time dele marcado). */
export const jogadorVinculado = (): string | null => ler<Guardado>(CHAVE)?.jogadorId ?? null;

export const vinculoDisponivel = () => Boolean(BASE_API);

/** Lugar na página do Jogador; `ligarMeuPersonagem` preenche. */
export const blocoDoDono = () => (vinculoDisponivel() ? html`<section class="meu-personagem placa" aria-live="polite"></section>` : html``);

/**
 * `t2`: a Temporada atual tem as regras da Temporada 2 (ADRs 0020 a 0024). Sem ela, o painel
 * é exatamente o da T1: nada de Presença, Postura, Especialização, Treino ou Canto.
 */
export function ligarMeuPersonagem(raiz: HTMLElement, j: JogadorPublico, todos: JogadorPublico[], ativos: readonly TimeId[] = TIMES, t2 = false): () => void {
  const achada = raiz.querySelector<HTMLElement>('.meu-personagem');
  if (!achada) return () => {};
  const caixa: HTMLElement = achada;
  const timers: number[] = [];
  const parar = () => timers.splice(0).forEach((t) => clearTimeout(t));
  const dm = INSTAGRAM ? `https://ig.me/m/${INSTAGRAM}` : 'https://www.instagram.com/direct/inbox/';
  const conta = INSTAGRAM ? `@${INSTAGRAM}` : 'a Liga';

  const mostrar = (h: { s: string }) => {
    caixa.innerHTML = h.s;
  };

  // ---- sem vínculo: oferece vincular
  function convite(erro = '') {
    const pendente = ler<Pendente>(`${CHAVE}:pendente`);
    if (pendente && pendente.jogadorId === j.id && Date.parse(pendente.expiraEm) > Date.now()) return aguardando(pendente);
    mostrar(html`<h2 class="secao">Este personagem é seu?</h2>
      <p>Vincule o @${j.username} a este navegador para pedir a transferência ou trocar de posição por aqui. É rápido: você manda um código na DM da Liga.</p>
      ${erro ? html`<p class="erro">${erro}</p>` : ''}
      <p><button type="button" class="botao" data-acao="vincular">Vincular pela DM</button></p>`);
    caixa.querySelector('[data-acao="vincular"]')!.addEventListener('click', async (e) => {
      (e.currentTarget as HTMLButtonElement).disabled = true;
      const r = await api<{ codigo?: string; sessao?: string; expiraEm?: string; erro?: string }>('vinculo', { jogadorId: j.id }).catch(() => null);
      if (!r || !r.dados.codigo) return convite(r?.dados.erro ?? 'Não deu para gerar o código agora. Tente de novo em instantes.');
      const p: Pendente = { codigo: r.dados.codigo, sessao: r.dados.sessao!, jogadorId: j.id, expiraEm: r.dados.expiraEm! };
      gravar(`${CHAVE}:pendente`, p);
      aguardando(p);
    });
  }

  // ---- código gerado: espera a DM
  function aguardando(p: Pendente, aviso = '') {
    const minutos = Math.max(1, Math.round((Date.parse(p.expiraEm) - Date.now()) / 60_000));
    mostrar(html`<h2 class="secao">Mande este código na DM</h2>
      <p class="codigo-vinculo">${p.codigo}</p>
      <ol class="passos-vinculo">
        <li>Abra a <a href="${dm}" target="_blank" rel="noopener">DM do ${conta}</a> pela conta <strong>@${j.username}</strong>.</li>
        <li>Mande só o código acima. Ele vale por ${minutos} min.</li>
        <li>Volte aqui e toque em <strong>Já mandei</strong>.</li>
      </ol>
      ${aviso ? html`<p class="legenda">${aviso}</p>` : ''}
      <p><button type="button" class="botao" data-acao="conferir">Já mandei</button> <button type="button" class="botao secundario" data-acao="cancelar">Cancelar</button></p>`);
    caixa.querySelector('[data-acao="cancelar"]')!.addEventListener('click', () => {
      parar();
      gravar(`${CHAVE}:pendente`, null);
      convite();
    });
    caixa.querySelector('[data-acao="conferir"]')!.addEventListener('click', () => conferir(p, 0));
  }

  // Confere agora e, se ainda não chegou, de novo a cada 8 s por 2 minutos.
  async function conferir(p: Pendente, tentativa: number) {
    parar();
    const botao = caixa.querySelector<HTMLButtonElement>('[data-acao="conferir"]');
    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Conferindo a DM…';
    }
    const r = await api<{ vinculado?: boolean; expirado?: boolean; username?: string; erro?: string }>('vinculo/verificar', { codigo: p.codigo, sessao: p.sessao }).catch(() => null);
    if (r?.dados.vinculado) {
      gravar(`${CHAVE}:pendente`, null);
      gravar(CHAVE, { sessao: p.sessao, jogadorId: p.jogadorId, username: r.dados.username ?? j.username } satisfies Guardado);
      return seguir();
    }
    if (r?.dados.expirado || Date.parse(p.expiraEm) < Date.now()) {
      gravar(`${CHAVE}:pendente`, null);
      return convite('O código expirou. Gere outro.');
    }
    if (tentativa >= 15) return aguardando(p, `Ainda não achamos o código na DM do @${j.username}. Confira se mandou pela conta certa e toque de novo.`);
    timers.push(window.setTimeout(() => void conferir(p, tentativa + 1), 8000));
  }

  // ---- vinculado: transferência e posição
  /** Busca o estado do pedido, desenha e, se ainda está pendente, volta a olhar em 10 s. */
  async function seguir(mensagem = '', tentativa = 0) {
    parar();
    const g = ler<Guardado>(CHAVE);
    if (!g) return convite();
    const estado = (await api<Pedido>('transferencia/estado', { sessao: g.sessao }).catch(() => null))?.dados ?? {};
    painel(g, estado, mensagem);
    if (estado.resultado === 'TRANSFERIDO' && estado.processadoEm && !j.transferenciaUsada) {
      ajustarLocalmente(j.id, { ...(estado.time ? { time: estado.time } : {}), ...(estado.posicao ? { posicao: estado.posicao } : {}), transferenciaUsada: true });
      window.setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 2500);
    }
    if (estado.pedidoEm && !estado.processadoEm && tentativa < 40) timers.push(window.setTimeout(() => void seguir('', tentativa + 1), 10_000));
  }

  function painel(g: Guardado, estado: Pedido, mensagem = '') {
    const pendente = Boolean(estado.pedidoEm && !estado.processadoEm);
    // Elencos sem ele, para mostrar para onde dá para ir (a regra final é da Liga).
    const contagem = new Map<TimeId, number>(ativos.map((t) => [t, 0]));
    for (const x of todos) if (x.id !== j.id && contagem.has(x.time)) contagem.set(x.time, (contagem.get(x.time) ?? 0) + 1);
    const menor = Math.min(...contagem.values());
    const temVaga = (t: TimeId) => t === j.time || contagem.get(t)! < menor + FOLGA;
    const resultado = estado.processadoEm && estado.mensagem ? html`<p class="${estado.resultado === 'TRANSFERIDO' ? 'sucesso' : 'erro'}">${estado.mensagem}</p>` : '';

    // As duas partes ficam recolhidas (no celular ocupam muito); abrem sozinhas quando há
    // algo para mostrar, e lembram se a pessoa abriu.
    const abrirTransferencia = abertas.has('transferencia') || pendente || Boolean(mensagem) || Boolean(resultado);
    mostrar(html`<h2 class="secao">Seu personagem</h2>
      <p class="legenda">Vinculado a este navegador como @${g.username}. <button type="button" class="link" data-acao="sair">Desvincular</button></p>
      <details class="dobra" data-dobra="transferencia" ${abrirTransferencia ? 'open' : ''}>
      <summary>Transferência <small>${j.transferenciaUsada || estado.resultado === 'TRANSFERIDO' ? 'já usada nesta temporada' : '1 por temporada'}</small></summary>
      ${mensagem ? html`<p class="sucesso">${mensagem}</p>` : ''}
      ${resultado}
      ${pendente
        ? html`<p>Pedido enviado: ${estado.time ? html`ir para ${curto(estado.time)}` : ''}${estado.time && estado.posicao ? ' como ' : ''}${estado.posicao ? NOME_DA_POSICAO[estado.posicao].toLowerCase() : ''}. A Liga aplica em 1 ou 2 minutos.</p>`
        : j.transferenciaUsada || estado.resultado === 'TRANSFERIDO'
          ? estado.resultado === 'TRANSFERIDO'
            ? html`<p class="legenda">A página do Jogador atualiza na próxima publicação do site, em alguns minutos.</p>`
            : html`<p>Você já usou a transferência desta temporada. Dá para transferir de novo na próxima.</p>`
          : html`<form class="form-transferencia">
              <p>Uma vez por temporada, na Fase de Liga, você pode trocar de time, de posição ou dos dois. Vale a partir do próximo jogo escalado, e você leva as suas habilidades.</p>
              <label><span>Time</span><select name="time">
                ${ativos.map((t) => html`<option value="${t}" ${t === j.time ? 'selected' : ''} ${temVaga(t) ? '' : 'disabled'}>${curto(t)}${t === j.time ? ' (atual)' : temVaga(t) ? '' : ' (cheio)'}</option>`)}
              </select></label>
              <label><span>Posição</span><select name="posicao">
                ${POSICOES_EM_ORDEM.map((p) => html`<option value="${p}" ${p === j.posicao ? 'selected' : ''}>${NOME_DA_POSICAO[p]}${p === j.posicao ? ' (atual)' : ''}</option>`)}
              </select></label>
              <p><button type="submit" class="botao">Pedir transferência</button></p>
            </form>`}
      </details>`);

    if (t2) {
      caixa.insertAdjacentHTML('beforeend', blocoEscolhas().s);
      ligarEscolhas(g);
    }
    caixa.insertAdjacentHTML('beforeend', blocoApelido().s);
    ligarApelido(g);
    caixa.insertAdjacentHTML('beforeend', blocoVisual().s);
    ligarVisual(g);
    for (const d of caixa.querySelectorAll<HTMLDetailsElement>('details[data-dobra]')) {
      d.addEventListener('toggle', () => (d.open ? abertas.add(d.dataset.dobra!) : abertas.delete(d.dataset.dobra!)));
    }

    caixa.querySelector('[data-acao="sair"]')!.addEventListener('click', async () => {
      parar();
      await api('vinculo/sair', { sessao: g.sessao }).catch(() => null);
      gravar(CHAVE, null);
      convite();
    });
    const form = caixa.querySelector<HTMLFormElement>('.form-transferencia');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = new FormData(form);
      const time = dados.get('time') as TimeId;
      const posicao = dados.get('posicao') as Posicao;
      if (time === j.time && posicao === j.posicao) return painel(g, estado, 'Escolha um time ou uma posição diferente.');
      const destino = [time !== j.time ? curto(time) : '', posicao !== j.posicao ? NOME_DA_POSICAO[posicao].toLowerCase() : ''].filter(Boolean).join(', ');
      if (!confirm(`Confirmar a transferência (${destino})? Ela só pode ser feita uma vez por temporada.`)) return;
      const r = await api<{ ok?: boolean; erro?: string }>('transferencia', { sessao: g.sessao, ...(time !== j.time ? { time } : {}), ...(posicao !== j.posicao ? { posicao } : {}) }).catch(() => null);
      if (r?.status === 401) {
        gravar(CHAVE, null);
        return convite('O vínculo deste navegador expirou. Vincule de novo.');
      }
      if (!r?.dados.ok) return painel(g, estado, r?.dados.erro ?? 'Não deu para enviar agora. Tente de novo.');
      void seguir();
    });
  }

  // ---- Temporada 2: Presença, Postura e Formação (Capitão), Especialização, Treino e Canto
  let especializacao: Especializacao | null = j.especializacao ?? null;
  let treino: HabilidadeId | null = j.treino ?? null;
  let canto: Canto | null = null;
  const NOME_DA_POSTURA: Record<Postura, string> = { OFENSIVA: 'Ofensiva', EQUILIBRADA: 'Equilibrada', DEFENSIVA: 'Defensiva' };
  const DESCRICAO_DA_POSTURA: Record<Postura, string> = {
    OFENSIVA: 'O Time ataca mais e deixa a defesa mais exposta.',
    EQUILIBRADA: 'Sem mudar nada (é a Postura quando o Capitão não escolhe).',
    DEFENSIVA: 'O Time se fecha atrás e ataca menos.',
  };
  const NOME_DO_CANTO: Record<Canto, string> = { ESQUERDA: 'Esquerda', MEIO: 'Meio', DIREITA: 'Direita' };

  function blocoEscolhas() {
    const opcoes = ESPECIALIZACOES[j.posicao] as readonly Especializacao[];
    const radio = (nome: string, valor: string, atual: boolean, rotulo: string, ajuda = '') =>
      html`<label class="opcao-t2"><input type="radio" name="${nome}" value="${valor}" ${atual ? 'checked' : ''} /><span><strong>${rotulo}</strong>${ajuda ? html`<small>${ajuda}</small>` : ''}</span></label>`;
    return html`<details class="dobra" data-dobra="jogo" ${abertas.has('jogo') ? 'open' : ''}>
      <summary>Próximo jogo <small data-resumo-jogo>presença</small></summary>
      <div class="escolha-t2" data-tipo="PRESENCA">
        <p>Confirme que vai jogar: quem confirma entra antes no rodízio, logo depois do Craque. Vale até o Corte do próximo jogo do seu Time. Também dá para comentar <strong>CONFIRMO</strong> no post.</p>
        <p><button type="button" class="botao" data-enviar="PRESENCA">Confirmar presença</button></p>
        <p class="estado-escolha" role="status" aria-live="polite"></p>
      </div>
      <div data-capitania></div>
    </details>
    <details class="dobra" data-dobra="especializacao" ${abertas.has('especializacao') ? 'open' : ''}>
      <summary>Especialização <small>${especializacao ? NOME_DA_ESPECIALIZACAO[especializacao] : 'nenhuma'}</small></summary>
      <form class="escolha-t2" data-tipo="ESPECIALIZACAO">
        <p>Um jeito de jogar: melhora uma coisa e piora outra. Vale a partir do próximo jogo; dá para trocar uma vez por dia.</p>
        <fieldset class="opcoes-t2">
          ${opcoes.map((e) => radio('valor', e, e === especializacao, NOME_DA_ESPECIALIZACAO[e], DESCRICAO_DA_ESPECIALIZACAO[e]))}
          ${radio('valor', '', especializacao === null, 'Nenhuma', 'Joga sem Especialização.')}
        </fieldset>
        <p><button type="submit" class="botao">Salvar Especialização</button></p>
        <p class="estado-escolha" role="status" aria-live="polite"></p>
      </form>
    </details>
    <details class="dobra" data-dobra="treino" ${abertas.has('treino') ? 'open' : ''}>
      <summary>Treino <small>${treino ? NOME_DA_HABILIDADE[treino] : 'sem foco'}</small></summary>
      <form class="escolha-t2" data-tipo="TREINO">
        <p>A Habilidade em foco sobe 50% mais rápido quando você joga bem. Ela não cai mais devagar.</p>
        <label><span>Foco</span><select name="valor">
          <option value="" ${treino === null ? 'selected' : ''}>Sem foco</option>
          ${HABILIDADES.map((h) => html`<option value="${h}" ${h === treino ? 'selected' : ''}>${NOME_DA_HABILIDADE[h]}</option>`)}
        </select></label>
        <p><button type="submit" class="botao">Salvar Treino</button></p>
        <p class="estado-escolha" role="status" aria-live="polite"></p>
      </form>
    </details>
    <details class="dobra" data-dobra="canto" ${abertas.has('canto') ? 'open' : ''}>
      <summary>Canto do pênalti <small data-canto-atual>${canto ? NOME_DO_CANTO[canto] : 'sorteado'}</small></summary>
      <form class="escolha-t2" data-tipo="CANTO">
        <p>${j.posicao === 'GOL' ? 'Para onde você pula' : 'Onde você bate'} nos pênaltis, no jogo e na disputa. Só você vê. Sem escolha, o canto é sorteado a cada cobrança.</p>
        <fieldset class="opcoes-t2 cantos">
          ${CANTOS.map((c) => radio('valor', c, c === canto, NOME_DO_CANTO[c]))}
          ${radio('valor', '', canto === null, 'Sortear')}
        </fieldset>
        <p><button type="submit" class="botao">Salvar canto</button></p>
        <p class="estado-escolha" role="status" aria-live="polite"></p>
      </form>
    </details>`;
  }

  /** Só o Capitão vê a escolha de Postura e Formação; os outros veem quem ele é (ADRs 0020 e 0044). */
  function blocoCapitania(c: { eu: boolean; capitao: string | null; postura: string; formacao?: string } | null) {
    if (!c) return html``;
    const atual = (POSTURAS as readonly string[]).includes(c.postura) ? (c.postura as Postura) : 'EQUILIBRADA';
    const formacao: Formacao = ehFormacao(c.formacao) ? c.formacao : FORMACAO_PADRAO;
    if (!c.eu) {
      const agora = html`${NOME_DA_POSTURA[atual]}, no ${formacao}`;
      return html`<p class="legenda capitania">${c.capitao ? html`Capitão do ${curto(j.time)} no próximo jogo: <strong>@${c.capitao}</strong>. Só ele escolhe a Postura e a Formação (agora: ${agora}).` : html`Postura e Formação do ${curto(j.time)} no próximo jogo: ${agora}.`}</p>`;
    }
    const radio = (valor: Postura) =>
      html`<label class="opcao-t2"><input type="radio" name="valor" value="${valor}" ${valor === atual ? 'checked' : ''} /><span><strong>${NOME_DA_POSTURA[valor]}</strong><small>${DESCRICAO_DA_POSTURA[valor]}</small></span></label>`;
    const opcaoFormacao = (f: Formacao) => {
      const d = DESCRICAO_DA_FORMACAO[f];
      return html`<label class="opcao-t2 opcao-formacao"><input type="radio" name="valor" value="${f}" ${f === formacao ? 'checked' : ''} />${desenhoDaFormacao(f)}<span><strong>${d.nome}${d.jogada ? html` <em class="jogada-formacao">${d.jogada}</em>` : ''}</strong><small>${d.linha}</small></span></label>`;
    };
    return html`<form class="escolha-t2" data-tipo="POSTURA">
      <p><strong>Você é o Capitão do ${curto(j.time)}</strong> no próximo jogo. Escolha como o Time joga; dá para mudar até o Corte.</p>
      <fieldset class="opcoes-t2">${POSTURAS.map(radio)}</fieldset>
      <p><button type="submit" class="botao">Escolher a Postura</button></p>
      <p class="estado-escolha" role="status" aria-live="polite"></p>
    </form>
    <form class="escolha-t2" data-tipo="FORMACAO">
      <p><strong>Formação</strong>: quantos jogam atrás, no meio e na frente. Quem ficar fora porque a Formação cortou a vaga passa na frente no jogo seguinte. Faltando gente numa Posição, alguém de outra joga fora de posição.</p>
      <fieldset class="opcoes-t2 formacoes">${FORMACOES.map(opcaoFormacao)}</fieldset>
      <p><button type="submit" class="botao">Escolher a Formação</button></p>
      <p class="estado-escolha" role="status" aria-live="polite"></p>
    </form>`;
  }

  function ligarEscolhas(g: Guardado) {
    // O canto não é público: vem do último pedido deste navegador (borda).
    void api<Record<string, { escolha?: { valor?: Canto | null }; resultado?: string } | null> & { capitania?: { eu: boolean; capitao: string | null; postura: string; formacao?: string } | null }>('escolha/estado', { sessao: g.sessao })
      .then((r) => {
        const lugar = caixa.querySelector<HTMLElement>('[data-capitania]');
        if (lugar) {
          lugar.innerHTML = blocoCapitania(r.dados.capitania ?? null).s;
          for (const form of lugar.querySelectorAll<HTMLFormElement>('form.escolha-t2')) ligarBloco(form);
          const resumo = caixa.querySelector('[data-resumo-jogo]');
          if (resumo && r.dados.capitania?.eu) resumo.textContent = 'presença, Postura e Formação';
        }
        const c = r.dados.CANTO;
        if (c && c.resultado !== 'RECUSADO' && c.escolha) {
          canto = c.escolha.valor ?? null;
          const atual = caixa.querySelector('[data-canto-atual]');
          if (atual) atual.textContent = canto ? NOME_DO_CANTO[canto] : 'sorteado';
          for (const i of caixa.querySelectorAll<HTMLInputElement>('form[data-tipo="CANTO"] input[name="valor"]')) i.checked = i.value === (canto ?? '');
        }
      })
      .catch(() => null);
    const enviar = async (tipo: string, valor: string | null, estado: HTMLElement) => {
      estado.textContent = 'Enviando...';
      estado.className = 'estado-escolha';
      const r = await api<{ ok?: boolean; erro?: string; pedido?: { resultado?: string; mensagem?: string; processadoEm?: string } }>('escolha', { sessao: g.sessao, tipo, valor }).catch(() => null);
      if (r?.status === 401) {
        gravar(CHAVE, null);
        return convite('O vínculo deste navegador expirou. Vincule de novo.');
      }
      const p = r?.dados.pedido;
      if (!r?.dados.ok) {
        estado.textContent = r?.dados.erro ?? 'Não deu para enviar agora. Tente de novo.';
        estado.className = 'estado-escolha erro';
        return;
      }
      if (!p?.processadoEm) {
        estado.textContent = 'Enviado. A Liga aplica em 1 ou 2 minutos.';
        return;
      }
      const ok = p.resultado !== 'RECUSADO';
      estado.textContent = p.mensagem ?? (ok ? 'Pronto!' : 'Não deu.');
      estado.className = `estado-escolha ${ok ? 'sucesso' : 'erro'}`;
      if (!ok) return;
      if (tipo === 'ESPECIALIZACAO') especializacao = (valor as Especializacao | null) ?? null;
      if (tipo === 'TREINO') treino = (valor as HabilidadeId | null) ?? null;
      if (tipo === 'CANTO') canto = (valor as Canto | null) ?? null;
      if (tipo === 'ESPECIALIZACAO' || tipo === 'TREINO') ajustarLocalmente(j.id, { especializacao, treino });
      const resumo = caixa.querySelector(`details[data-dobra="${tipo === 'CANTO' ? 'canto' : tipo.toLowerCase()}"] summary small`);
      if (resumo && tipo === 'ESPECIALIZACAO') resumo.textContent = especializacao ? NOME_DA_ESPECIALIZACAO[especializacao] : 'nenhuma';
      if (resumo && tipo === 'TREINO') resumo.textContent = treino ? NOME_DA_HABILIDADE[treino] : 'sem foco';
      if (resumo && tipo === 'CANTO') resumo.textContent = canto ? NOME_DO_CANTO[canto] : 'sorteado';
    };
    function ligarBloco(bloco: HTMLElement) {
      const tipo = bloco.dataset.tipo!;
      const estado = bloco.querySelector<HTMLElement>('.estado-escolha')!;
      if (bloco instanceof HTMLFormElement) {
        bloco.addEventListener('submit', (e) => {
          e.preventDefault();
          const v = new FormData(bloco).get('valor');
          void enviar(tipo, v ? String(v) : null, estado);
        });
      } else bloco.querySelector('[data-enviar]')?.addEventListener('click', () => void enviar(tipo, null, estado));
    }
    for (const bloco of caixa.querySelectorAll<HTMLElement>('.escolha-t2')) ligarBloco(bloco);
  }

  // ---- apelido (ADR-0014): o nome que aparece no jogo, na narração e no site
  let apelido: string | null = j.apelido ?? null;
  let trocadoEm: string | null = j.apelidoTrocadoEm ?? null;
  const travado = () => !podeTrocarApelido(trocadoEm ? new Date(trocadoEm) : null, new Date());
  const liberaEm = () => apelidoLiberaEm(new Date(trocadoEm!)).toISOString();
  const horaDe = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit' });

  function blocoApelido() {
    return html`<details class="dobra" data-dobra="apelido" ${abertas.has('apelido') ? 'open' : ''}>
      <summary>Apelido <small>${apelido ?? 'nome no jogo'}</small></summary>
      <form class="form-apelido">
        <p>O nome que aparece no jogo, nos Reels, na narração e no site. O @${j.username} continua aparecendo pequeno no site.</p>
        <label><span>Apelido</span><input type="text" name="apelido" maxlength="${APELIDO_MAX}" autocomplete="off" spellcheck="false" value="${apelido ?? ''}" placeholder="Até ${APELIDO_MAX} letras" ${travado() ? 'disabled' : ''} /></label>
        <p class="legenda">${travado() ? `Você já trocou o apelido nesta rodada. Dá para trocar de novo ${horaDe(liberaEm())}.` : trocadoEm && Date.now() - Date.parse(trocadoEm) < 10 * 60_000 ? 'Errou alguma letra? Dá para corrigir nos próximos minutos; depois, só na próxima rodada.' : 'Uma troca por rodada. Não pode repetir o apelido de outro jogador nem usar palavrão.'}</p>
        <p><button type="submit" class="botao" ${travado() ? 'disabled' : ''}>Salvar apelido</button>${apelido && !travado() ? html` <button type="button" class="link" data-acao="tirar-apelido">Voltar a usar o @</button>` : ''}</p>
        <p class="estado-apelido" role="status" aria-live="polite"></p>
      </form>
    </details>`;
  }

  function ligarApelido(g: Guardado) {
    const form = caixa.querySelector<HTMLFormElement>('.form-apelido');
    if (!form) return;
    const estado = form.querySelector<HTMLElement>('.estado-apelido')!;
    const enviar = async (novo: string) => {
      if (novo) {
        const v = validarApelido(novo);
        if (!v.ok) {
          estado.textContent = v.erro;
          estado.className = 'estado-apelido erro';
          return;
        }
        novo = v.apelido;
      }
      estado.textContent = 'Salvando...';
      estado.className = 'estado-apelido';
      const r = await api<{ ok?: boolean; erro?: string; pedido?: { resultado?: string; mensagem?: string } }>('perfil', { sessao: g.sessao, apelido: novo }).catch(() => null);
      const p = r?.dados.pedido;
      if (!r?.dados.ok || (p?.resultado && p.resultado !== 'SALVO')) {
        estado.textContent = p?.mensagem ?? r?.dados.erro ?? 'Não deu para salvar agora. Tente de novo.';
        estado.className = 'estado-apelido erro';
        return;
      }
      apelido = novo || null;
      // Nos 10 minutos seguintes ainda dá para corrigir; o painel mostra quando trava.
      trocadoEm = new Date().toISOString();
      ajustarLocalmente(j.id, { apelido, apelidoTrocadoEm: trocadoEm });
      estado.textContent = p?.mensagem ?? 'Pronto!';
      estado.className = 'estado-apelido sucesso';
      window.setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 1500);
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void enviar((form.elements.namedItem('apelido') as HTMLInputElement).value);
    });
    form.querySelector('[data-acao="tirar-apelido"]')?.addEventListener('click', () => void enviar(''));
  }

  // ---- visual do boneco e número da camisa
  let escolha: Required<Aparencia> = { penteado: 'CURTO', ...aparencia(`@${j.username}`) } as Required<Aparencia>;
  let numero: number | null = j.numero;

  function blocoVisual() {
    const swatch = (grupo: string, cor: string, atual: string) =>
      html`<button type="button" class="amostra" data-${grupo}="${cor}" style="--amostra:${cor}" aria-pressed="${String(cor === atual)}" aria-label="${grupo === 'pele' ? 'Pele' : 'Cabelo'} ${cor}"></button>`;
    return html`<details class="dobra" data-dobra="visual" ${abertas.has('visual') ? 'open' : ''}>
      <summary>Visual e camisa <small>${numero ? `camisa ${numero}` : 'boneco e número'}</small></summary>
      <form class="form-visual">
      <div class="visual-grade">
        <canvas class="pixel previa-boneco" width="${LARGURA_SPRITE * 8}" height="${ALTURA_SPRITE * 8}" aria-label="Como o seu boneco vai ficar"></canvas>
        <div class="visual-opcoes">
          <fieldset><legend>Pele</legend><div class="amostras">${PELES.map((c) => swatch('pele', c, escolha.pele))}</div></fieldset>
          <fieldset><legend>Cabelo</legend><div class="amostras">${CABELOS.map((c) => swatch('cabelo', c, escolha.cabelo))}</div></fieldset>
          <fieldset><legend>Corte</legend><div class="cortes">${PENTEADOS.map((p) => html`<button type="button" class="corte" data-penteado="${p}" aria-pressed="${String(p === escolha.penteado)}">${NOME_DO_PENTEADO[p]}</button>`)}</div></fieldset>
          <label class="camisa"><span>Número da camisa</span><input type="number" name="numero" min="1" max="99" inputmode="numeric" value="${numero ?? ''}" placeholder="1 a 99" /></label>
        </div>
      </div>
      <p><button type="submit" class="botao">Salvar visual e camisa</button></p>
      <p class="estado-visual" role="status" aria-live="polite"></p>
    </form>
    </details>`;
  }

  function ligarVisual(g: Guardado) {
    // O painel é redesenhado enquanto um pedido está pendente: não acumula o giro do boneco.
    timersVisual.splice(0).forEach((t) => clearTimeout(t));
    const form = caixa.querySelector<HTMLFormElement>('.form-visual');
    if (!form) return;
    const canvas = form.querySelector<HTMLCanvasElement>('.previa-boneco')!;
    const estado = form.querySelector<HTMLElement>('.estado-visual')!;
    let quadro = 0;
    const desenhar = () => {
      const c = canvas.getContext('2d')!;
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, canvas.width, canvas.height);
      const pose: Pose = (['FRENTE_PARADO', 'FRENTE_COMEMORA', 'COSTAS_PARADO', 'LADO_PARADO'] as Pose[])[quadro % 4]!;
      c.drawImage(sprite(pose, { ...visualDoJogador(j.time, j.posicao, `@${j.username}`), ...escolha }) as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    };
    desenhar();
    // Gira o boneco devagar para mostrar o corte de frente, de costas e de lado.
    const girar = () => {
      quadro++;
      desenhar();
      timersVisual.push(window.setTimeout(girar, 1100));
    };
    timersVisual.push(window.setTimeout(girar, 1100));
    form.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-pele], button[data-cabelo], button[data-penteado]');
      if (!b) return;
      if (b.dataset.pele) escolha = { ...escolha, pele: b.dataset.pele };
      if (b.dataset.cabelo) escolha = { ...escolha, cabelo: b.dataset.cabelo };
      if (b.dataset.penteado) escolha = { ...escolha, penteado: b.dataset.penteado as Penteado };
      for (const x of form.querySelectorAll<HTMLButtonElement>('button[data-pele], button[data-cabelo], button[data-penteado]')) {
        const v = x.dataset.pele ?? x.dataset.cabelo ?? x.dataset.penteado;
        x.setAttribute('aria-pressed', String(v === escolha.pele || v === escolha.cabelo || v === escolha.penteado));
      }
      quadro = 0;
      desenhar();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = (form.elements.namedItem('numero') as HTMLInputElement).value.trim();
      const novoNumero = n ? Number(n) : null;
      if (novoNumero !== null && (!Number.isInteger(novoNumero) || novoNumero < 1 || novoNumero > 99)) {
        estado.textContent = 'O número da camisa vai de 1 a 99.';
        return;
      }
      estado.textContent = 'Salvando...';
      const r = await api<{ ok?: boolean; erro?: string }>('perfil', { sessao: g.sessao, visual: escolha, ...(novoNumero !== null && novoNumero !== numero ? { numero: novoNumero } : {}) }).catch(() => null);
      if (!r?.dados.ok) {
        estado.textContent = r?.dados.erro ?? 'Não deu para salvar agora. Tente de novo.';
        return;
      }
      estado.textContent = 'Enviado. A Liga confere em 1 ou 2 minutos...';
      const conferir = async (tentativa: number) => {
        const p = (await api<{ processadoEm?: string; resultado?: string; mensagem?: string }>('perfil/estado', { sessao: g.sessao }).catch(() => null))?.dados;
        if (p?.processadoEm) {
          estado.textContent = p.mensagem ?? '';
          estado.className = `estado-visual ${p.resultado === 'SALVO' ? 'sucesso' : 'erro'}`;
          if (p.resultado === 'SALVO') {
            if (novoNumero !== null) numero = novoNumero;
            ajustarLocalmente(j.id, { visual: escolha, ...(novoNumero !== null ? { numero: novoNumero } : {}) });
            // Redesenha a página: o card já mostra o boneco e a camisa novos.
            window.setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 1500);
          }
          return;
        }
        if (tentativa < 30) timersVisual.push(window.setTimeout(() => void conferir(tentativa + 1), 8000));
      };
      void conferir(0);
    });
  }
  const timersVisual: number[] = [];


  // ---- início
  const g = ler<Guardado>(CHAVE);
  if (g && g.jogadorId === j.id) {
    void api('vinculo/eu', { sessao: g.sessao })
      .then((r) => {
        if (r.status === 404) {
          gravar(CHAVE, null);
          convite('O vínculo deste navegador não vale mais. Vincule de novo.');
        } else void seguir();
      })
      .catch(() => void seguir());
  } else if (g) {
    // Este navegador já é de outro personagem: um por navegador.
    caixa.hidden = true;
  } else convite();
  return () => {
    parar();
    timersVisual.splice(0).forEach((t) => clearTimeout(t));
  };
}
