/**
 * Navegação de app no celular (ADR-0103): barra de abas embaixo (Rodada, Jogos, Tabela, Times,
 * Mais), barra de cima com o título da tela e Voltar nas telas de detalhe. No computador fica o
 * menu de sempre, no topo.
 */
import { Html, html } from './ui.js';

export type AbaDoApp = 'inicio' | 'jogos' | 'tabela' | 'times' | 'mais';

/** Pixel art 11×11 dos ícones da barra de abas ('x' = pixel aceso). */
const ICONES: Record<AbaDoApp | 'sino' | 'voltar', string[]> = {
  // Bola
  inicio: ['...xxxxx...', '..x.....x..', '.x..xxx..x.', 'x..x...x..x', 'x.x.....x.x', 'x.x.....x.x', 'x.x.....x.x', 'x..x...x..x', '.x..xxx..x.', '..x.....x..', '...xxxxx...'],
  // Calendário
  jogos: ['.x.....x...', 'xxxxxxxxxxx', 'x.........x', 'xxxxxxxxxxx', 'x.........x', 'x.x.x.x.x.x', 'x.........x', 'x.x.x.x.x.x', 'x.........x', 'x.x.x......', 'xxxxxxxxxxx'],
  // Tabela (linhas de classificação)
  tabela: ['xxxxxxxxxxx', 'x.........x', 'x.xx.xxxx.x', 'x.........x', 'x.xx.xxx..x', 'x.........x', 'x.xx.xx...x', 'x.........x', 'x.xx.x....x', 'x.........x', 'xxxxxxxxxxx'],
  // Escudo
  times: ['xxxxxxxxxxx', 'x.........x', 'x..xx.xx..x', 'x..xxxxx..x', 'x...xxx...x', 'x....x....x', 'x.........x', '.x.......x.', '..x.....x..', '...x...x...', '....xxx....'],
  // Três pontos
  mais: ['...........', '...........', '...........', '...........', 'xx..xx..xx.', 'xx..xx..xx.', '...........', '...........', '...........', '...........', '...........'],
  sino: ['.....x.....', '....xxx....', '...x...x...', '..x.....x..', '..x.....x..', '..x.....x..', '.x.......x.', 'x.........x', 'xxxxxxxxxxx', '....x.x....', '.....x.....'],
  voltar: ['.....x.....', '....xx.....', '...xx......', '..xx.......', '.xxxxxxxxxx', 'xxxxxxxxxxx', '.xxxxxxxxxx', '..xx.......', '...xx......', '....xx.....', '.....x.....'],
};

export function iconePixel(nome: keyof typeof ICONES, tamanho = 22): Html {
  const desenho = ICONES[nome];
  const rects = desenho.flatMap((linha, y) => [...linha].map((c, x) => (c === 'x' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('');
  return new Html(`<svg class="icone-pixel" viewBox="0 0 11 11" width="${tamanho}" height="${tamanho}" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor">${rects}</svg>`);
}

/** Em qual aba de baixo cada seção do site mora. */
export function abaDaSecao(secao: string): AbaDoApp {
  if (secao === 'inicio' || secao === 'jogos' || secao === 'tabela' || secao === 'times') return secao;
  return 'mais';
}

/**
 * Para onde o Voltar leva quando não há tela anterior no app (link aberto direto do Instagram):
 * a lista de onde a tela de detalhe saiu. `null` = tela principal, sem Voltar.
 */
export function paiDaTela(caminho: string): string | null {
  const c = caminho.replace(/^\/?/, '/');
  if (/^\/time\//.test(c)) return '/times';
  if (/^\/(jogador|comparar|vincular)\b/.test(c)) return '/jogadores';
  if (/^\/carreira\/(\d+)/.test(c)) return `/jogador/${c.match(/^\/carreira\/(\d+)/)![1]}`;
  if (/^\/partida\//.test(c)) return '/jogos';
  if (/^\/avisos$/.test(c)) return '/';
  return null;
}

/** As telas que ficam no "Mais". */
export const ITENS_DO_MAIS: { href: string; secao: string; rotulo: string; dica: string }[] = [
  { href: '#/jogadores', secao: 'jogadores', rotulo: 'Jogadores', dica: 'Busca, Card e comparação' },
  { href: '#/temporada', secao: 'temporada', rotulo: 'Temporada', dica: 'Artilharia, Notas e números' },
  { href: '#/historia', secao: 'historia', rotulo: 'História', dica: 'Campeões e Craques de cada Temporada' },
  { href: '#/avisos', secao: 'avisos', rotulo: 'Avisos de jogo', dica: 'Escalação, apito e gols no celular' },
];

const ABAS: { aba: AbaDoApp; href: string; rotulo: string }[] = [
  { aba: 'inicio', href: '#/', rotulo: 'Rodada' },
  { aba: 'jogos', href: '#/jogos', rotulo: 'Jogos' },
  { aba: 'tabela', href: '#/tabela', rotulo: 'Tabela' },
  { aba: 'times', href: '#/times', rotulo: 'Times' },
];

let navegacoesInternas = 0;

export function prepararNavegacaoApp(opcoes: { meuJogador: () => string | null }): void {
  const barra = document.querySelector<HTMLElement>('[data-abas-app]');
  const folha = document.querySelector<HTMLElement>('[data-folha-mais]');
  if (!barra || !folha) return;
  barra.innerHTML = html`${ABAS.map((a) => html`<a href="${a.href}" data-aba-app="${a.aba}">${iconePixel(a.aba)}<span>${a.rotulo}</span></a>`)}
    <button type="button" data-aba-app="mais" aria-expanded="false" aria-controls="folha-mais">${iconePixel('mais')}<span>Mais</span></button>`.s;
  folha.id = 'folha-mais';
  // As subabas grudam logo abaixo da barra de cima, que muda de altura com a área segura do iPhone.
  const topo = document.querySelector<HTMLElement>('.topo');
  if (topo) {
    const medir = () => document.documentElement.style.setProperty('--altura-topo', `${topo.offsetHeight}px`);
    medir();
    new ResizeObserver(medir).observe(topo);
  }
  const sino = document.querySelector<HTMLElement>('.barra-app-sino');
  if (sino) sino.innerHTML = iconePixel('sino').s;
  const voltar = document.querySelector<HTMLButtonElement>('[data-voltar]');
  if (voltar) voltar.innerHTML = iconePixel('voltar', 20).s;

  const fechar = () => {
    folha.hidden = true;
    document.body.classList.remove('com-folha');
    barra.querySelector('[data-aba-app="mais"]')?.setAttribute('aria-expanded', 'false');
  };
  const abrir = () => {
    const meu = opcoes.meuJogador();
    folha.innerHTML = html`<div class="folha-fundo" data-fechar></div>
      <div class="folha" role="dialog" aria-modal="true" aria-label="Mais">
        <span class="folha-alca" aria-hidden="true"></span>
        <ul class="folha-lista">
          ${meu ? html`<li><a href="#/jogador/${meu}"><b>Meu Jogador</b><small>O Card do seu Jogador vinculado</small></a></li>` : ''}
          ${ITENS_DO_MAIS.map((i) => html`<li><a href="${i.href}" data-secao="${i.secao}"><b>${i.rotulo}</b><small>${i.dica}</small></a></li>`)}
        </ul>
      </div>`.s;
    folha.hidden = false;
    document.body.classList.add('com-folha');
    barra.querySelector('[data-aba-app="mais"]')?.setAttribute('aria-expanded', 'true');
    folha.querySelector<HTMLElement>('.folha-lista a')?.focus();
  };
  barra.querySelector('[data-aba-app="mais"]')!.addEventListener('click', () => (folha.hidden ? abrir() : fechar()));
  folha.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-fechar], a')) fechar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !folha.hidden) fechar();
  });
  window.addEventListener('hashchange', () => {
    navegacoesInternas++;
    fechar();
  });
  voltar?.addEventListener('click', () => {
    const pai = paiDaTela(decodeURIComponent(location.hash.replace(/^#/, '')));
    if (navegacoesInternas > 0) history.back();
    else location.hash = pai ?? '/';
  });
}

/** A cada tela: marca a aba de baixo, mostra Voltar nas telas de detalhe e troca o título. */
export function atualizarNavegacaoApp(secao: string, caminho: string, titulo: string): void {
  const aba = abaDaSecao(secao);
  for (const a of document.querySelectorAll<HTMLElement>('[data-aba-app]')) {
    if (a.dataset.abaApp === aba) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const detalhe = paiDaTela(caminho) !== null;
  const voltar = document.querySelector<HTMLElement>('[data-voltar]');
  const escudo = document.querySelector<HTMLElement>('.barra-app-escudo');
  if (voltar) voltar.hidden = !detalhe;
  if (escudo) escudo.hidden = detalhe;
  const t = document.querySelector('.barra-app-titulo');
  if (t) t.textContent = titulo || 'Varzeão da Mata';
}
