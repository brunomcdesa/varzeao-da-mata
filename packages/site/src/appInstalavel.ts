/**
 * O App (ADR-0040): registra o service worker e mostra, no topo do site, a placa
 * "Tenha o Varzeão no celular" com o jeito certo de instalar em cada aparelho.
 * Some quando o site já está aberto como App ou quando a pessoa dispensa (volta em 7 dias).
 */
import { liga } from './dados.js';
import { appLiberado, comoInstalar, type ComoInstalar } from './instalacao.js';
import { suporteAosAvisos, timesComAviso } from './avisosApp.js';
import { html, type Html } from './ui.js';

const CHAVE_DISPENSA = 'varzeao:instalar-dispensado';
const CHAVE_DISPENSA_AVISOS = 'varzeao:avisos-dispensado';
const VOLTA_EM_MS = 7 * 24 * 60 * 60 * 1000;

interface PedidoDeInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pedido: PedidoDeInstalacao | null = null;

const abertoComoApp = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function dispensadoRecente(chave = CHAVE_DISPENSA): boolean {
  try {
    const quando = Number(localStorage.getItem(chave) ?? 0);
    return Date.now() - quando < VOLTA_EM_MS;
  } catch {
    return false;
  }
}

function dispensar(chave = CHAVE_DISPENSA): void {
  try {
    localStorage.setItem(chave, String(Date.now()));
  } catch {
    /* sem armazenamento: some só nesta visita */
  }
}

/** Ícone de Compartilhar do Safari (quadrado com seta para cima), em pixel. */
const COMPARTILHAR = html`<svg class="instalar-icone" viewBox="0 0 12 14" width="15" height="18" aria-label="Compartilhar" role="img" shape-rendering="crispEdges"><path fill="currentColor" d="M5 0h2v1h1v1h1v1H7v6H5V3H3V2h1V1h1zM1 5h3v2H2v5h8V7H8V5h3v9H1z"/></svg>`;

function conteudo(modo: Exclude<ComoInstalar, 'instalado' | null>): Html {
  switch (modo) {
    case 'botao':
      return html`<p>Os jogos Ao Vivo, a tabela e o seu Card direto da tela inicial, em tela cheia.</p>
        <div class="instalar-acoes"><button type="button" class="botao" data-instalar>Instalar o App</button><button type="button" class="botao secundario" data-dispensar>Agora não</button></div>`;
    case 'ios':
      return html`<ol class="instalar-passos">
          <li>Toque em ${COMPARTILHAR} <b>Compartilhar</b> (no iOS mais novo, ele fica no menu <b>⋯</b>).</li>
          <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
          <li>Abra o Varzeão pelo ícone novo.</li>
        </ol>
        <div class="instalar-acoes"><button type="button" class="botao secundario" data-dispensar>Agora não</button></div>`;
    case 'android':
      return html`<p>No menu <b>⋮</b> do navegador, toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>
        <div class="instalar-acoes"><button type="button" class="botao secundario" data-dispensar>Agora não</button></div>`;
    case 'instagram':
      return html`<p>O navegador do Instagram não instala apps. Toque no menu <b>⋯</b> do canto e abra esta página no navegador do celular. Lá aparece o jeito de instalar.</p>
        <div class="instalar-acoes"><button type="button" class="botao secundario" data-dispensar>Agora não</button></div>`;
  }
}

function desenhar(): void {
  const lugar = document.getElementById('instalar');
  if (!lugar) return;
  const modo = comoInstalar({
    userAgent: navigator.userAgent,
    abertoComoApp: abertoComoApp(),
    temPedidoNativo: pedido !== null,
    pontosDeToque: navigator.maxTouchPoints ?? 0,
  });
  const naPaginaDosAvisos = location.hash.startsWith('#/avisos');
  if (modo === 'instalado' && !naPaginaDosAvisos && suporteAosAvisos() === 'ok' && timesComAviso() === null && !dispensadoRecente(CHAVE_DISPENSA_AVISOS)) {
    // Já no App: o convite agora é para os Avisos de jogo.
    lugar.innerHTML = html`<section class="placa instalar" aria-labelledby="instalar-titulo">
      <div class="instalar-topo"><img src="icones/icone-192.png" alt="" width="44" height="44" /><h2 id="instalar-titulo">Avisos de jogo</h2></div>
      <p>Saiba na hora quando sai a Escalação, quando começa o jogo e cada gol do seu Time.</p>
      <div class="instalar-acoes"><a class="botao" href="#/avisos">Ativar avisos</a><button type="button" class="botao secundario" data-dispensar>Agora não</button></div>
    </section>`.s;
    lugar.hidden = false;
    lugar.querySelector('[data-dispensar]')?.addEventListener('click', () => {
      dispensar(CHAVE_DISPENSA_AVISOS);
      desenhar();
    });
    return;
  }
  if (modo === null || modo === 'instalado' || dispensadoRecente()) {
    lugar.hidden = true;
    lugar.innerHTML = '';
    return;
  }
  lugar.innerHTML = html`<section class="placa instalar" aria-labelledby="instalar-titulo">
    <div class="instalar-topo"><img src="icones/icone-192.png" alt="" width="44" height="44" /><h2 id="instalar-titulo">Tenha o Varzeão no celular</h2></div>
    ${conteudo(modo)}
  </section>`.s;
  lugar.hidden = false;
  lugar.querySelector('[data-dispensar]')?.addEventListener('click', () => {
    dispensar();
    desenhar();
  });
  lugar.querySelector('[data-instalar]')?.addEventListener('click', () => {
    const p = pedido;
    if (!p) return;
    void p.prompt();
    void p.userChoice.then((r) => {
      pedido = null;
      if (r.outcome === 'dismissed') dispensar();
      desenhar();
    });
  });
}

export async function prepararApp(): Promise<void> {
  const l = await liga().catch(() => null);
  if (!appLiberado(l?.temporada?.numero)) return;
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.append(link);
  }
  // Link fixo para os Avisos no rodapé.
  const rodape = document.querySelector('.rodape');
  if (rodape && !rodape.querySelector('.rodape-avisos')) {
    rodape.insertAdjacentHTML('afterbegin', html`<p class="rodape-avisos"><a href="#/avisos">Avisos de jogo no celular</a></p>`.s);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker não registrou', e));
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedido = e as PedidoDeInstalacao;
    desenhar();
  });
  // Na página dos Avisos o convite some; ao voltar (ou depois de ativar), ele se recalcula.
  window.addEventListener('hashchange', () => desenhar());
  window.addEventListener('appinstalled', () => {
    pedido = null;
    desenhar();
  });
  desenhar();
}
