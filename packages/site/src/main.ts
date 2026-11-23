/** Site da Liga: roteamento por hash (funciona em qualquer hospedagem estática). */
import { ErroDeDados, jogadores, liga } from './dados.js';
import { inicio } from './paginas/inicio.js';
import { paginaComparar, paginaJogador, paginaJogadores } from './paginas/jogadores.js';
import { paginaJogos, paginaTabela, paginaTime, paginaTimes } from './paginas/liga.js';
import { paginaHistoria } from './paginas/historia.js';
import { paginaPartida } from './paginas/partida.js';
import { paginaCarreira } from './paginas/carreira.js';
import { paginaTemporada } from './paginas/temporada.js';
import { paginaAvisos } from './paginas/avisos.js';
import { paginaLoja } from './paginas/loja.js';
import { mostrarCarteiraDoTopo } from './carteiraDoTopo.js';
import { temMoedas } from '@liga/shared';
import { temporadaDoApp } from './instalacao.js';
import { adiantarEstadoDasEscolhas, carteiraDoVinculo, jogadorVinculado, paginaVincular } from './meuPersonagem.js';
import type { Pagina } from './paginas/tipos.js';
import { html } from './ui.js';
import { prepararApp } from './appInstalavel.js';
import { centralizarAbas, ligarAbas } from './abas.js';
import { atualizarNavegacaoApp, prepararNavegacaoApp } from './navegacaoApp.js';

const ROTAS: { padrao: RegExp; pagina: Pagina; secao: string; titulo: string }[] = [
  { padrao: /^\/?$/, pagina: inicio, secao: 'inicio', titulo: '' },
  { padrao: /^\/temporada$/, pagina: paginaTemporada, secao: 'temporada', titulo: 'Temporada' },
  { padrao: /^\/jogos(?:\/(liga|copa))?$/, pagina: paginaJogos, secao: 'jogos', titulo: 'Jogos' },
  { padrao: /^\/tabela$/, pagina: paginaTabela, secao: 'tabela', titulo: 'Tabela' },
  { padrao: /^\/times$/, pagina: paginaTimes, secao: 'times', titulo: 'Times' },
  { padrao: /^\/time\/([A-Za-z]{3})$/, pagina: paginaTime, secao: 'times', titulo: 'Time' },
  { padrao: /^\/jogadores$/, pagina: paginaJogadores, secao: 'jogadores', titulo: 'Jogadores' },
  { padrao: /^\/jogador\/(\d+)$/, pagina: paginaJogador, secao: 'jogadores', titulo: 'Jogador' },
  { padrao: /^\/carreira\/(\d+)$/, pagina: paginaCarreira, secao: 'jogadores', titulo: 'Carreira' },
  { padrao: /^\/comparar\/(\d+)\/(\d+)$/, pagina: paginaComparar, secao: 'jogadores', titulo: 'Comparar' },
  { padrao: /^\/partida\/(\d+)$/, pagina: paginaPartida, secao: 'jogos', titulo: 'Partida' },
  { padrao: /^\/historia$/, pagina: paginaHistoria, secao: 'historia', titulo: 'História' },
  { padrao: /^\/avisos$/, pagina: paginaAvisos, secao: 'avisos', titulo: 'Avisos de jogo' },
  { padrao: /^\/loja$/, pagina: paginaLoja, secao: 'loja', titulo: 'Loja' },
  { padrao: /^\/vincular(?:\/([A-Za-z0-9_-]+))?$/, pagina: paginaVincular, secao: 'jogadores', titulo: 'Vincular' },
];

const main = document.getElementById('conteudo')!;
let limpar: (() => void) | void;
let versao = 0;

/** Os visuais escolhidos pelos donos chegam com jogadores.json: espera antes de desenhar bonecos. */
const aparenciasProntas = jogadores().catch(() => null);
/** As estrelas de Título dos escudos chegam com liga.json: espera antes de desenhar escudos. */
const estrelasProntas = liga().catch(() => null);

async function navegar(): Promise<void> {
  const caminho = decodeURIComponent(location.hash.replace(/^#/, ''));
  const rota = ROTAS.find((r) => r.padrao.test(caminho));
  limpar?.();
  limpar = undefined;
  const minha = ++versao;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.menu a, .carteira-topo')) {
    if (rota && a.dataset.secao === rota.secao) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (!rota) {
    atualizarNavegacaoApp('inicio', caminho, '');
    main.innerHTML = html`<section class="placa vazio"><h1>Página não encontrada</h1><p><a href="#/">Voltar para a Rodada</a></p></section>`.s;
    return;
  }
  try {
    const params = caminho.match(rota.padrao)!.slice(1);
    await Promise.all([aparenciasProntas, estrelasProntas]);
    const fim = await rota.pagina(main, params);
    if (minha !== versao) fim?.();
    else limpar = fim;
    const h1 = main.querySelector('h1')?.textContent?.trim();
    document.title = rota.titulo ? `${h1 || rota.titulo} · Varzeão da Mata` : 'Varzeão da Mata';
    // Celular (ADR-0103): título curto na barra de cima; a tela de detalhe usa o nome da coisa.
    const nomeNaBarra = rota.titulo === 'Time' ? h1 : rota.titulo === 'Partida' && main.querySelectorAll('.tabua-time span').length === 2 ? [...main.querySelectorAll('.tabua-time span')].map((e) => e.textContent).join(' × ') : rota.titulo === 'Jogador' ? main.querySelector('h1')?.textContent?.trim().split(' (@')[0] : rota.titulo;
    atualizarNavegacaoApp(rota.secao, caminho, nomeNaBarra || rota.titulo);
    centralizarAbas(main);
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
ligarAbas(main);
prepararNavegacaoApp({ meuJogador: jogadorVinculado });
// Quem tem Vínculo: a capitania começa a vir junto com os dados da página (ADR-0094).
adiantarEstadoDasEscolhas();
void navegar();
void prepararApp();

// Loja (ADR-0101): a sacola no canto do topo, a partir da T3; com Vínculo, o saldo junto.
void liga()
  .then(async (l) => {
    if (!temMoedas(temporadaDoApp(l) ?? 0)) return;
    mostrarCarteiraDoTopo(null);
    if (!jogadorVinculado()) return;
    const c = await carteiraDoVinculo();
    if (c) mostrarCarteiraDoTopo(c.saldo);
  })
  .catch(() => {});

// Rodapé: quando os dados foram gerados.
void liga()
  .then((l) => {
    const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(l.atualizadoEm));
    document.getElementById('atualizado')!.textContent = `Temporada ${l.temporada?.numero ?? '–'} · dados de ${quando}. Liga fictícia: os Jogadores são seguidores e os jogos são simulados.`;
  })
  .catch(() => {});
