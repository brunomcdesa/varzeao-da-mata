/**
 * "Este personagem é meu" (ADR-0013): quem é dono do Jogador manda um código na DM da Liga
 * e este navegador fica vinculado a ele. Vinculado, pede a Transferência (ou a troca de
 * posição) pelo site, com as mesmas regras do comentário (ADR-0012).
 *
 * A sessão é um segredo que só este navegador guarda (localStorage); a borda guarda o hash.
 */
import { CABELOS, NOME_DO_PENTEADO, PELES, PENTEADOS, TIMES, type Aparencia, type JogadorPublico, type Penteado, type Posicao, type TimeId } from '@liga/shared';
import { ALTURA_SPRITE, LARGURA_SPRITE, aparencia, sprite, visualDoJogador, type Pose } from '@liga/renderer';
import { BASE_API, INSTAGRAM, ajustarLocalmente } from './dados.js';
import { curto, html, NOME_DA_POSICAO, POSICOES_EM_ORDEM } from './ui.js';

const CHAVE = 'varzeao:vinculo';
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

export const vinculoDisponivel = () => Boolean(BASE_API);

/** Lugar na página do Jogador; `ligarMeuPersonagem` preenche. */
export const blocoDoDono = () => (vinculoDisponivel() ? html`<section class="meu-personagem placa" aria-live="polite"></section>` : html``);

export function ligarMeuPersonagem(raiz: HTMLElement, j: JogadorPublico, todos: JogadorPublico[]): () => void {
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
    const contagem = new Map<TimeId, number>(TIMES.map((t) => [t, 0]));
    for (const x of todos) if (x.id !== j.id) contagem.set(x.time, (contagem.get(x.time) ?? 0) + 1);
    const menor = Math.min(...contagem.values());
    const temVaga = (t: TimeId) => t === j.time || contagem.get(t)! < menor + FOLGA;
    const resultado = estado.processadoEm && estado.mensagem ? html`<p class="${estado.resultado === 'TRANSFERIDO' ? 'sucesso' : 'erro'}">${estado.mensagem}</p>` : '';

    mostrar(html`<h2 class="secao">Seu personagem</h2>
      <p class="legenda">Vinculado a este navegador como @${g.username}. <button type="button" class="link" data-acao="sair">Desvincular</button></p>
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
                ${TIMES.map((t) => html`<option value="${t}" ${t === j.time ? 'selected' : ''} ${temVaga(t) ? '' : 'disabled'}>${curto(t)}${t === j.time ? ' (atual)' : temVaga(t) ? '' : ' (cheio)'}</option>`)}
              </select></label>
              <label><span>Posição</span><select name="posicao">
                ${POSICOES_EM_ORDEM.map((p) => html`<option value="${p}" ${p === j.posicao ? 'selected' : ''}>${NOME_DA_POSICAO[p]}${p === j.posicao ? ' (atual)' : ''}</option>`)}
              </select></label>
              <p><button type="submit" class="botao">Pedir transferência</button></p>
            </form>`}`);

    caixa.insertAdjacentHTML('beforeend', blocoVisual().s);
    ligarVisual(g);

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

  // ---- visual do boneco e número da camisa
  let escolha: Required<Aparencia> = { penteado: 'CURTO', ...aparencia(`@${j.username}`) } as Required<Aparencia>;
  let numero: number | null = j.numero;

  function blocoVisual() {
    const swatch = (grupo: string, cor: string, atual: string) =>
      html`<button type="button" class="amostra" data-${grupo}="${cor}" style="--amostra:${cor}" aria-pressed="${String(cor === atual)}" aria-label="${grupo === 'pele' ? 'Pele' : 'Cabelo'} ${cor}"></button>`;
    return html`<form class="form-visual">
      <h3 class="secao">Visual e camisa</h3>
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
    </form>`;
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
