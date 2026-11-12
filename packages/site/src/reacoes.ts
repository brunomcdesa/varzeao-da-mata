/**
 * Público e Reações do Ao Vivo: quantas pessoas estão assistindo e os emojis que sobem
 * por cima do campo. A sala é um Durable Object por Partida no worker da borda, ligado
 * por WebSocket; nada disso existe no Replay.
 */
import { INTERVALO_REACAO_MS, REACOES, ehReacao, textoDoPublico, type MensagemDaSala, type ReacaoId } from '@liga/shared';
import { BASE_API } from './dados.js';

export { REACOES };

/** Na tela, no máximo tantas Reações subindo ao mesmo tempo (o resto é descartado). */
const MAX_NA_TELA = 24;

export function urlDaSala(base: string, partidaId: number): string | null {
  if (!base) return null;
  const u = new URL(`ao-vivo/${partidaId}`, base);
  u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
  return u.toString();
}

export interface Sala {
  fechar(): void;
}

export function entrarNaSala(main: HTMLElement, partidaId: number, base = BASE_API): Sala {
  const url = urlDaSala(base, partidaId);
  const elPublico = main.querySelector<HTMLElement>('[data-publico]');
  const campo = main.querySelector<HTMLElement>('.campo-ao-vivo');
  const botoes = [...main.querySelectorAll<HTMLButtonElement>('[data-reacao]')];
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ws: WebSocket | null = null;
  let fechado = false;
  let tentativa = 0;
  let religar = 0;
  let ultimaReacao = 0;

  const subir = (id: ReacaoId, minha = false) => {
    if (!campo || reduzido || campo.querySelectorAll('.reacao-voando').length >= MAX_NA_TELA) return;
    const el = document.createElement('span');
    el.className = `reacao-voando${minha ? ' minha' : ''}`;
    el.textContent = REACOES.find((x) => x.id === id)!.emoji;
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--x', `${(minha ? 78 : 58 + Math.random() * 34).toFixed(1)}%`);
    el.style.setProperty('--deriva', `${(Math.random() * 40 - 20).toFixed(0)}px`);
    el.style.setProperty('--dur', `${(2.4 + Math.random() * 1.2).toFixed(2)}s`);
    el.addEventListener('animationend', () => el.remove());
    campo.append(el);
  };

  const ligar = () => {
    if (!url || fechado) return;
    ws = new WebSocket(url);
    ws.addEventListener('open', () => (tentativa = 0));
    ws.addEventListener('message', (ev) => {
      let m: MensagemDaSala;
      try {
        m = JSON.parse(String(ev.data)) as MensagemDaSala;
      } catch {
        return;
      }
      if (m.t === 'publico' && elPublico) {
        elPublico.hidden = false;
        elPublico.textContent = textoDoPublico(m.n);
      } else if (m.t === 'reacoes') {
        // Vem em lotes; cada emoji sai com um pequeno atraso para não subirem grudados.
        let k = 0;
        for (const [id, qtd] of Object.entries(m.r)) {
          if (!ehReacao(id)) continue;
          for (let i = 0; i < Math.min(qtd ?? 0, 6); i++) setTimeout(() => subir(id), 90 * k++);
        }
      }
    });
    ws.addEventListener('close', (ev) => {
      // 1000: a sala fechou porque o Ao Vivo acabou; não adianta tentar de novo.
      if (fechado || ev.code === 1000) return;
      religar = window.setTimeout(ligar, Math.min(30_000, 1000 * 2 ** tentativa++));
    });
  };

  for (const b of botoes) {
    b.addEventListener('click', () => {
      const id = b.dataset.reacao;
      const agora = Date.now();
      if (!ehReacao(id) || agora - ultimaReacao < INTERVALO_REACAO_MS) return;
      ultimaReacao = agora;
      subir(id, true);
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ r: id }));
      for (const x of botoes) x.disabled = true;
      setTimeout(() => botoes.forEach((x) => (x.disabled = false)), INTERVALO_REACAO_MS);
    });
  }

  ligar();
  return {
    fechar() {
      fechado = true;
      clearTimeout(religar);
      ws?.close();
    },
  };
}
