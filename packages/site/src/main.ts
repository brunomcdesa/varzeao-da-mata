/** Site da Liga: roteamento por hash (funciona em qualquer hospedagem estática). */
import { ErroDeDados, liga } from './dados.js';
import { inicio } from './paginas/inicio.js';
import { paginaComparar, paginaJogador, paginaJogadores } from './paginas/jogadores.js';
import { paginaJogos, paginaTabela, paginaTime, paginaTimes } from './paginas/liga.js';
import { paginaHistoria } from './paginas/historia.js';
import { paginaPartida } from './paginas/partida.js';
import type { Pagina } from './paginas/tipos.js';
import { html } from './ui.js';

const ROTAS: { padrao: RegExp; pagina: Pagina; secao: string; titulo: string }[] = [
  { padrao: /^\/?$/, pagina: inicio, secao: 'inicio', titulo: '' },
  { padrao: /^\/jogos$/, pagina: paginaJogos, secao: 'jogos', titulo: 'Jogos' },
  { padrao: /^\/tabela$/, pagina: paginaTabela, secao: 'tabela', titulo: 'Tabela' },
  { padrao: /^\/times$/, pagina: paginaTimes, secao: 'times', titulo: 'Times' },
  { padrao: /^\/time\/([A-Za-z]{3})$/, pagina: paginaTime, secao: 'times', titulo: 'Time' },
  { padrao: /^\/jogadores$/, pagina: paginaJogadores, secao: 'jogadores', titulo: 'Jogadores' },
  { padrao: /^\/jogador\/(\d+)$/, pagina: paginaJogador, secao: 'jogadores', titulo: 'Jogador' },
  { padrao: /^\/comparar\/(\d+)\/(\d+)$/, pagina: paginaComparar, secao: 'jogadores', titulo: 'Comparar' },
  { padrao: /^\/partida\/(\d+)$/, pagina: paginaPartida, secao: 'jogos', titulo: 'Partida' },
  { padrao: /^\/historia$/, pagina: paginaHistoria, secao: 'historia', titulo: 'História' },
];

const main = document.getElementById('conteudo')!;
let limpar: (() => void) | void;
let versao = 0;

async function navegar(): Promise<void> {
  const caminho = decodeURIComponent(location.hash.replace(/^#/, ''));
  const rota = ROTAS.find((r) => r.padrao.test(caminho));
  limpar?.();
  limpar = undefined;
  const minha = ++versao;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.menu a')) {
    if (rota && a.dataset.secao === rota.secao) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (!rota) {
    main.innerHTML = html`<section class="placa vazio"><h1>Página não encontrada</h1><p><a href="#/">Voltar para a Rodada</a></p></section>`.s;
    return;
  }
  try {
    const params = caminho.match(rota.padrao)!.slice(1);
    const fim = await rota.pagina(main, params);
    if (minha !== versao) fim?.();
    else limpar = fim;
    const h1 = main.querySelector('h1')?.textContent?.trim();
    document.title = rota.titulo ? `${h1 || rota.titulo} · Varzeão da Mata` : 'Varzeão da Mata';
  } catch (e) {
    console.error(e);
    const semDados = e instanceof ErroDeDados && e.status === 404;
    main.innerHTML = html`<section class="placa vazio"><h1>${semDados ? 'A Liga ainda não começou' : 'Não deu para carregar'}</h1>
      <p>${semDados ? 'Os dados aparecem aqui assim que a Temporada for criada.' : 'Confira a conexão e tente de novo.'}</p>
      <p><button type="button" class="botao" data-tentar>Tentar de novo</button></p></section>`.s;
    main.querySelector('[data-tentar]')?.addEventListener('click', () => void navegar());
  }
}

window.addEventListener('hashchange', () => {
  void navegar().then(() => {
    if (!location.hash.startsWith('#/jogos')) window.scrollTo(0, 0);
  });
});
document.addEventListener('submit', (e) => e.preventDefault());
void navegar();

// Rodapé: quando os dados foram gerados.
void liga()
  .then((l) => {
    const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(l.atualizadoEm));
    document.getElementById('atualizado')!.textContent = `Temporada ${l.temporada?.numero ?? '–'} · dados de ${quando}. Liga fictícia: os Jogadores são seguidores e os jogos são simulados.`;
  })
  .catch(() => {});
