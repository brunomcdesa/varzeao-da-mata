/**
 * "Este personagem é meu" (ADR-0013): quem é dono do Jogador manda um código na DM da Liga
 * e este navegador fica vinculado a ele. Vinculado, pede a Transferência (ou a troca de
 * posição) pelo site, com as mesmas regras do comentário (ADR-0012).
 *
 * A sessão é um segredo que só este navegador guarda (localStorage); a borda guarda o hash.
 */
import { CANTOS, DESCRICAO_DA_ESPECIALIZACAO, ESPECIALIZACOES, FORMACAO_PADRAO, HABILIDADES, NOME_DA_ESPECIALIZACAO, NOME_DA_HABILIDADE, POSTURAS, ehFormacao, type Canto, type Especializacao, type Formacao, type HabilidadeId, type Postura } from '@liga/shared';
import type { Carteira } from '@liga/shared';
import { blocoDaCarteira, ligarCarteira } from './carteira.js';
import { NOME_DA_POSTURA, capitaniaAindaVale, formulariosDoCapitao, nomesDosBatedores, valorDoFormulario, type Capitania } from './planoDoTime.js';
import { linhaDaPresenca } from './presenca.js';
import { pedidoValido } from './pedidoDoSite.js';
import { APELIDO_MAX, apelidoLiberaEm, podeTrocarApelido, CABELOS, NOME_DO_PENTEADO, validarApelido, PELES, PENTEADOS, TIMES, type Aparencia, type JogadorPublico, type Penteado, type Posicao, type TimeId } from '@liga/shared';
import { ALTURA_SPRITE, LARGURA_SPRITE, aparencia, sprite, visualDoJogador, type Pose } from '@liga/renderer';
import { BASE_API, INSTAGRAM, ajustarLocalmente } from './dados.js';
import { curto, html, NOME_DA_POSICAO, POSICOES_EM_ORDEM } from './ui.js';
import type { MercadoDoJogador, PainelDoTime } from './painelDoTime.js';
import type { Pagina } from './paginas/tipos.js';

const CHAVE = 'varzeao:vinculo';
/** Jogador recém-vinculado pelo Link de Vínculo (ADR-0082): a página dele mostra o "Pronto!" uma vez. */
const CHAVE_RECEM = 'varzeao:vinculo:recem';
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

/** O último estado das escolhas visto neste navegador (ADR-0094): a página mostra na hora e confere depois. */
const CHAVE_ESTADO = 'varzeao:escolhas';
type EscolhaGuardada = { escolha?: { valor?: string | null }; resultado?: string } | null;
type EstadoDasEscolhas = Record<string, EscolhaGuardada | Capitania | PainelDoTime | MercadoDoJogador | null | undefined> & { capitania?: Capitania | null; painel?: PainelDoTime | null; mercado?: MercadoDoJogador | null };
interface EstadoGuardado {
  jogadorId: string;
  estado: EstadoDasEscolhas;
}

/** Estado guardado deste Jogador, sem a capitania se o jogo dela já passou do Corte. */
export function estadoGuardado(jogadorId: string): EstadoDasEscolhas | null {
  const e = ler<EstadoGuardado>(CHAVE_ESTADO);
  if (!e || e.jogadorId !== jogadorId) return null;
  return capitaniaAindaVale(e.estado.capitania) ? e.estado : { ...e.estado, capitania: null };
}

/** Um pedido só por vez para `escolha/estado`: o boot, o painel e a página do Time dividem a resposta. */
let pedidoDoEstado: { sessao: string; em: number; p: Promise<{ status: number; dados: EstadoDasEscolhas } | null> } | null = null;
/** Resposta recente serve para quem chegar logo depois (navegar entre páginas não pede de novo). */
const ESTADO_FRESCO_MS = 20_000;

function pedirEstado(g: Guardado, novo = false) {
  if (!novo && pedidoDoEstado && pedidoDoEstado.sessao === g.sessao && Date.now() - pedidoDoEstado.em < ESTADO_FRESCO_MS) return pedidoDoEstado.p;
  const p = api<EstadoDasEscolhas>('escolha/estado', { sessao: g.sessao })
    .then((r) => {
      if (r.status === 200) gravar(CHAVE_ESTADO, { jogadorId: g.jogadorId, estado: r.dados } satisfies EstadoGuardado);
      else if (r.status === 401) gravar(CHAVE_ESTADO, null);
      return r;
    })
    .catch(() => null);
  pedidoDoEstado = { sessao: g.sessao, em: Date.now(), p };
  return p;
}

/** Guarda o que o próprio navegador acabou de salvar, para a próxima página já abrir certo. */
function ajustarEstadoGuardado(jogadorId: string, f: (e: EstadoDasEscolhas) => void) {
  const e = ler<EstadoGuardado>(CHAVE_ESTADO);
  if (!e || e.jogadorId !== jogadorId) return;
  f(e.estado);
  gravar(CHAVE_ESTADO, e);
  pedidoDoEstado = null;
}

/** Começa a buscar o estado assim que o site abre (ADR-0094), para a página já achar pronto. */
export function adiantarEstadoDasEscolhas() {
  const g = ler<Guardado>(CHAVE);
  if (g && BASE_API) void pedirEstado(g);
}

/** Capitania guardada neste navegador, para mostrar na hora (null sem Vínculo ou se o jogo já mudou). */
/** Tudo o que se escolhe pela borda (`/escolha`). */
export type TipoDeEscolha =
  | 'POSTURA' | 'FORMACAO' | 'BATEDORES' | 'PALPITE' | 'COMPRA' | 'EQUIPAR' | 'TIRAR'
  | 'FIXADOS' | 'ESCANTEIO' | 'PEDIDO' | 'CONVIDAR' | 'CONVITE' | 'TROCA_PROPOR' | 'TROCA' | 'SER_TECNICO' | 'MARCACAO' | 'GRITO' | 'SAIR_DO_CARGO' | 'CHAMADA';

export function capitaniaGuardada(): { jogadorId: string; capitania: Capitania } | null {
  const g = ler<Guardado>(CHAVE);
  const c = g ? estadoGuardado(g.jogadorId)?.capitania : null;
  return g && c ? { jogadorId: g.jogadorId, capitania: c } : null;
}

/**
 * Capitania do próximo jogo do Time de quem tem Vínculo neste navegador (borda,
 * `escolha/estado`). Sem Vínculo, ou com ele expirado, devolve null.
 */
export async function capitaniaDoVinculo(): Promise<{ jogadorId: string; capitania: Capitania } | null> {
  const g = ler<Guardado>(CHAVE);
  if (!g || !BASE_API) return null;
  const r = await pedirEstado(g);
  return r?.status === 200 && r.dados.capitania ? { jogadorId: g.jogadorId, capitania: r.dados.capitania } : null;
}

/**
 * Escolha do Capitão feita fora do painel (página do Time, ADR-0091): manda pela borda e, se a
 * Liga aplicou na hora, guarda no estado deste navegador para a página já mostrar o plano novo.
 */
export async function enviarEscolhaDoVinculo(tipo: TipoDeEscolha, valor: string | string[] | null): Promise<{ ok: boolean; aplicada: boolean; mensagem: string }> {
  const g = ler<Guardado>(CHAVE);
  if (!g || !BASE_API) return { ok: false, aplicada: false, mensagem: 'Vincule o seu personagem para escolher.' };
  const r = await api<{ ok?: boolean; erro?: string; pedido?: { resultado?: string; mensagem?: string; processadoEm?: string } }>('escolha', { sessao: g.sessao, tipo, valor }).catch(() => null);
  if (r?.status === 401) return { ok: false, aplicada: false, mensagem: 'O vínculo deste navegador expirou. Vincule de novo no seu painel.' };
  const p = r?.dados.pedido;
  if (!r?.dados.ok) return { ok: false, aplicada: false, mensagem: r?.dados.erro ?? 'Não deu para enviar agora. Tente de novo.' };
  if (!p?.processadoEm) return { ok: true, aplicada: false, mensagem: 'Enviado. A Liga aplica em 1 ou 2 minutos.' };
  const ok = p.resultado !== 'RECUSADO';
  if (ok) {
    ajustarEstadoGuardado(g.jogadorId, (e) => {
      if (!e.capitania) return;
      if (tipo === 'POSTURA' && typeof valor === 'string') e.capitania.postura = valor;
      if (tipo === 'FORMACAO' && typeof valor === 'string') e.capitania.formacao = valor;
      if (tipo === 'BATEDORES' && Array.isArray(valor)) e.capitania.batedores = valor;
    });
  }
  return { ok, aplicada: ok, mensagem: p.mensagem ?? (ok ? 'Pronto!' : 'Não deu.') };
}

/**
 * Painel do Time e Mercado (ADR-0110) de quem tem Vínculo neste navegador: o guardado na hora
 * (`guardado`) e a resposta da borda depois. `novo`: pede de novo, sem a resposta recente.
 */
export function painelGuardado(): { jogadorId: string; painel: PainelDoTime | null; mercado: MercadoDoJogador | null } | null {
  const g = ler<Guardado>(CHAVE);
  const e = g ? estadoGuardado(g.jogadorId) : null;
  return g && e ? { jogadorId: g.jogadorId, painel: e.painel ?? null, mercado: e.mercado ?? null } : null;
}
export async function painelDoVinculo(novo = false): Promise<{ jogadorId: string; painel: PainelDoTime | null; mercado: MercadoDoJogador | null } | null> {
  const g = ler<Guardado>(CHAVE);
  if (!g || !BASE_API) return null;
  const r = await pedirEstado(g, novo);
  return r?.status === 200 ? { jogadorId: g.jogadorId, painel: r.dados.painel ?? null, mercado: r.dados.mercado ?? null } : null;
}

/** Pedido de Transferência pelo site (o botão "Quero jogar aqui"); a regra é a do TRANSFERIR. */
export async function pedirTransferenciaDoVinculo(time: TimeId, posicao: string): Promise<{ ok: boolean; mensagem: string }> {
  const g = ler<Guardado>(CHAVE);
  if (!g || !BASE_API) return { ok: false, mensagem: 'Vincule o seu personagem para pedir.' };
  const r = await api<{ ok?: boolean; erro?: string; pedido?: { mensagem?: string; processadoEm?: string } }>('transferencia', { sessao: g.sessao, time, posicao }).catch(() => null);
  if (r?.status === 401) return { ok: false, mensagem: 'O vínculo deste navegador expirou. Vincule de novo no seu painel.' };
  if (!r?.dados.ok) return { ok: false, mensagem: r?.dados.erro ?? 'Não deu para enviar agora. Tente de novo.' };
  pedidoDoEstado = null;
  return { ok: true, mensagem: r.dados.pedido?.processadoEm ? (r.dados.pedido.mensagem ?? 'Pronto!') : 'Enviado. A Liga responde em 1 ou 2 minutos.' };
}

/** A Carteira (e a Loja) do Jogador vinculado neste navegador; null sem Vínculo ou sem resposta. */
export async function carteiraDoVinculo(): Promise<(Carteira & { jogadorId: string }) | null> {
  const g = ler<Guardado>(CHAVE);
  if (!g || !BASE_API) return null;
  const r = await api<Carteira & { erro?: string }>('carteira', { sessao: g.sessao }).catch(() => null);
  return r?.status === 200 && typeof r.dados.saldo === 'number' ? { ...r.dados, jogadorId: g.jogadorId } : null;
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
export function ligarMeuPersonagem(raiz: HTMLElement, j: JogadorPublico, todos: JogadorPublico[], ativos: readonly TimeId[] = TIMES, t2 = false, moedas = false): () => void {
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
  // Chegou agora pelo Link de Vínculo: o painel abre com a confirmação.
  const recemVinculado = ler<string>(CHAVE_RECEM) === j.id;
  if (recemVinculado) gravar(CHAVE_RECEM, null);

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
    // Pedido antigo (de outra Temporada, por exemplo) não conta: o Time vem do jogadores.json.
    const estado: Pedido = pedidoValido((await api<Pedido>('transferencia/estado', { sessao: g.sessao }).catch(() => null))?.dados, new Date());
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
      ${recemVinculado ? html`<p class="sucesso">Pronto! Este navegador agora está vinculado ao seu Jogador.</p>` : ''}
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

    // Moedas (ADR-0087): saldo e extrato só para o dono, a partir da T3.
    if (moedas) {
      caixa.insertAdjacentHTML('beforeend', blocoDaCarteira(abertas.has('carteira')).s);
      void ligarCarteira(caixa, () => api<Carteira & { erro?: string }>('carteira', { sessao: g.sessao }));
    }
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
  const NOME_DO_CANTO: Record<Canto, string> = { ESQUERDA: 'Esquerda', MEIO: 'Meio', DIREITA: 'Direita' };

  function blocoEscolhas() {
    const opcoes = ESPECIALIZACOES[j.posicao] as readonly Especializacao[];
    const radio = (nome: string, valor: string, atual: boolean, rotulo: string, ajuda = '') =>
      html`<label class="opcao-t2"><input type="radio" name="${nome}" value="${valor}" ${atual ? 'checked' : ''} /><span><strong>${rotulo}</strong>${ajuda ? html`<small>${ajuda}</small>` : ''}</span></label>`;
    return html`<details class="dobra" data-dobra="jogo" ${abertas.has('jogo') ? 'open' : ''}>
      <summary>Próximo jogo <small data-resumo-jogo>presença</small></summary>
      <div class="escolha-t2" data-tipo="PRESENCA">
        <p data-presenca-convite>Confirme que vai jogar: quem confirma entra antes no rodízio, logo depois do Craque. Vale até o Corte do próximo jogo do seu Time. Também dá para comentar <strong>CONFIRMO</strong> no post.</p>
        <p data-presenca-convite><button type="button" class="botao" data-enviar="PRESENCA">Confirmar presença</button></p>
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
  function blocoCapitania(c: Capitania | null) {
    if (!c) return html``;
    const atual = (POSTURAS as readonly string[]).includes(c.postura) ? (c.postura as Postura) : 'EQUILIBRADA';
    const formacao: Formacao = ehFormacao(c.formacao) ? c.formacao : FORMACAO_PADRAO;
    if (!c.eu) {
      const agora = html`${NOME_DA_POSTURA[atual]}, no ${formacao}`;
      // T3 (ADR-0091): quem é do Time também vê os Batedores.
      const batedores = c.elenco ? nomesDosBatedores(c) : null;
      return html`<p class="legenda capitania">${c.capitao ? html`Capitão do ${curto(j.time)} no próximo jogo: <strong>@${c.capitao}</strong>. Só ele escolhe a Postura e a Formação (agora: ${agora}).` : html`Postura e Formação do ${curto(j.time)} no próximo jogo: ${agora}.`}${batedores ? html` Batedores: ${batedores.length ? batedores.join(', ') : 'ordem automática'}.` : ''}</p>`;
    }
    return formulariosDoCapitao(c, curto(j.time));
  }

  /** O próximo jogo do Time (vem com a capitania), para a linha do selo de Presença. */
  let jogo: Capitania['jogo'] = null;
  let souCapitao = false;
  /** Presença confirmada (pelo site ou com CONFIRMO): o botão dá lugar ao selo. */
  function mostrarPresenca() {
    const bloco = caixa.querySelector<HTMLElement>('.escolha-t2[data-tipo="PRESENCA"]');
    if (!bloco) return;
    for (const p of bloco.querySelectorAll<HTMLElement>('[data-presenca-convite]')) p.hidden = true;
    const estado = bloco.querySelector<HTMLElement>('.estado-escolha');
    if (estado) {
      estado.textContent = '';
      estado.className = 'estado-escolha';
    }
    bloco.querySelector('.selo-presenca')?.remove();
    bloco.querySelector('.linha-presenca')?.remove();
    bloco.insertAdjacentHTML(
      'afterbegin',
      html`<span class="selo-presenca"><span class="visto" aria-hidden="true">✓</span>Presença confirmada</span><p class="legenda linha-presenca">${linhaDaPresenca(jogo)}</p>`.s,
    );
    const resumo = caixa.querySelector<HTMLElement>('[data-resumo-jogo]');
    if (resumo) {
      resumo.textContent = souCapitao ? '✓ presença confirmada, Postura e Formação' : '✓ presença confirmada';
      resumo.classList.add('presenca-ok');
    }
  }

  function ligarEscolhas(g: Guardado) {
    // O canto não é público: vem do último pedido deste navegador (borda). O último estado
    // visto aparece na hora; a resposta da borda só redesenha se algo mudou (ADR-0094).
    let mostrado: string | null = null;
    const aplicarEstado = (dados: EstadoDasEscolhas) => {
      const chave = JSON.stringify(dados);
      if (chave === mostrado) return;
      mostrado = chave;
      const r = { dados: dados as Record<string, { escolha?: { valor?: Canto | null }; resultado?: string } | null> & { capitania?: Capitania | null } };
      {
        const lugar = caixa.querySelector<HTMLElement>('[data-capitania]');
        if (lugar) {
          lugar.innerHTML = blocoCapitania(r.dados.capitania ?? null).s;
          for (const form of lugar.querySelectorAll<HTMLFormElement>('form.escolha-t2')) ligarBloco(form);
          const resumo = caixa.querySelector('[data-resumo-jogo]');
          if (resumo && r.dados.capitania?.eu) resumo.textContent = 'presença, Postura e Formação';
          jogo = r.dados.capitania?.jogo ?? null;
          souCapitao = Boolean(r.dados.capitania?.eu);
          if (r.dados.capitania?.presenca) mostrarPresenca();
        }
        const c = r.dados.CANTO;
        if (c && c.resultado !== 'RECUSADO' && c.escolha) {
          canto = c.escolha.valor ?? null;
          const atual = caixa.querySelector('[data-canto-atual]');
          if (atual) atual.textContent = canto ? NOME_DO_CANTO[canto] : 'sorteado';
          for (const i of caixa.querySelectorAll<HTMLInputElement>('form[data-tipo="CANTO"] input[name="valor"]')) i.checked = i.value === (canto ?? '');
        }
      }
    };
    const guardado = estadoGuardado(g.jogadorId);
    if (guardado) aplicarEstado(guardado);
    void pedirEstado(g).then((r) => {
      if (r?.status === 200) aplicarEstado(r.dados);
    });
    const enviar = async (tipo: string, valor: string | string[] | null, estado: HTMLElement) => {
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
      // A próxima página (a do Time, por exemplo) já abre com o que acabou de ser salvo.
      ajustarEstadoGuardado(g.jogadorId, (e) => {
        if (e.capitania && tipo === 'POSTURA' && typeof valor === 'string') e.capitania.postura = valor;
        if (e.capitania && tipo === 'FORMACAO' && typeof valor === 'string') e.capitania.formacao = valor;
        if (e.capitania && tipo === 'BATEDORES' && Array.isArray(valor)) e.capitania.batedores = valor;
        if (e.capitania && tipo === 'PRESENCA') e.capitania.presenca = true;
        if (tipo === 'CANTO') e.CANTO = { escolha: { valor: typeof valor === 'string' ? valor : null }, resultado: p.resultado ?? 'SALVO' };
      });
      if (tipo === 'PRESENCA') return mostrarPresenca();
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
          void enviar(tipo, valorDoFormulario(bloco), estado);
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

/**
 * Link de Vínculo (ADR-0082): a Liga manda na DM um link `#/vincular/<token>`. Abrir troca o
 * token por uma sessão na borda e vincula este navegador ao Jogador, no lugar de qualquer
 * Vínculo anterior. O token sai do endereço na hora (não fica no histórico).
 */
export const paginaVincular: Pagina = async (main, [token]) => {
  if (token) history.replaceState(null, '', `${location.pathname}${location.search}#/vincular`);
  const desenhar = (corpo: { s: string }) => {
    main.innerHTML = html`<section class="placa vincular meu-personagem" aria-live="polite">${corpo}</section>`.s;
  };
  const falhou = (erro: string, deNovo: (() => Promise<void>) | null) => {
    desenhar(html`<h1 class="secao">Não deu para vincular</h1>
      <p class="erro">${erro}</p>
      ${deNovo
        ? html`<p><button type="button" class="botao" data-acao="tentar">Tentar de novo</button></p>`
        : html`<p>Peça um link novo na DM da Liga. Ou vincule pela página do seu Jogador, mandando um código na DM.</p>
            <p><a class="botao" href="#/jogadores">Buscar o meu Jogador</a></p>`}`);
    main.querySelector('[data-acao="tentar"]')?.addEventListener('click', () => void deNovo?.());
  };
  type Resposta = { vinculado?: boolean; sessao?: string; jogadorId?: string; username?: string; erro?: string };

  // 1. Só olha o link: o navegador do Instagram pré-carrega a página, e isso não pode gastá-lo.
  async function conferir(): Promise<void> {
    if (!token || !vinculoDisponivel()) return falhou('Este link está incompleto.', null);
    desenhar(html`<h1 class="secao">Abrindo o seu link…</h1><p>Só um instante.</p>`);
    const r = await api<Resposta>('vinculo/link/ver', { token }).catch(() => null);
    if (!r) return falhou('Sem conexão com a Liga agora. Confira a internet e tente de novo.', conferir);
    if (!r.dados.username) return falhou(r.dados.erro ?? 'Este link já foi usado ou venceu.', r.status >= 500 ? conferir : null);
    const atual = ler<Guardado>(CHAVE);
    desenhar(html`<h1 class="secao">Vincular o @${r.dados.username}?</h1>
      <p>Toque em <strong>Vincular</strong> para ligar este navegador ao seu Jogador. Depois dá para cuidar dele por aqui: transferência, apelido, visual e o voto no Craque.</p>
      ${atual && atual.jogadorId !== r.dados.jogadorId ? html`<p class="legenda">Este navegador hoje está vinculado ao @${atual.username}. Esse vínculo será trocado.</p>` : ''}
      <p><button type="button" class="botao" data-acao="vincular">Vincular</button></p>`);
    main.querySelector('[data-acao="vincular"]')!.addEventListener('click', () => void vincular());
  }

  // 2. A pessoa tocou: agora o link é gasto.
  async function vincular(): Promise<void> {
    desenhar(html`<h1 class="secao">Vinculando o seu Jogador…</h1><p>Só um instante.</p>`);
    const antiga = ler<Guardado>(CHAVE)?.sessao;
    const r = await api<Resposta>('vinculo/link', { token, ...(antiga ? { sessaoAntiga: antiga } : {}) }).catch(() => null);
    if (!r) return falhou('Sem conexão com a Liga agora. Confira a internet e tente de novo.', conferir);
    const d = r.dados;
    if (!d.vinculado || !d.sessao || !d.jogadorId) return falhou(d.erro ?? 'Este link já foi usado ou venceu.', r.status >= 500 ? conferir : null);
    gravar(CHAVE, { sessao: d.sessao, jogadorId: d.jogadorId, username: d.username ?? '' } satisfies Guardado);
    gravar(`${CHAVE}:pendente`, null);
    gravar(CHAVE_RECEM, d.jogadorId);
    location.replace(`#/jogador/${d.jogadorId}`);
  }
  await conferir();
};
