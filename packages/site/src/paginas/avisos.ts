/** #/avisos — liga, troca os Times ou desliga os Avisos do App neste aparelho (ADR-0042). */
import type { TimeId } from '@liga/shared';
import { ativarAvisos, desativarAvisos, suporteAosAvisos, timesComAviso, type SuporteAosAvisos } from '../avisosApp.js';
import { jogadores, liga, timesAtivos } from '../dados.js';
import { appLiberado } from '../instalacao.js';
import { jogadorVinculado } from '../meuPersonagem.js';
import { curto, escudoImg, html, type Html } from '../ui.js';
import type { Pagina } from './tipos.js';

const AVISO_DO_SUPORTE: Record<Exclude<SuporteAosAvisos, 'ok'>, string> = {
  instalar: 'No iPhone, os Avisos só chegam com o App instalado. Instale pelo Compartilhar → Adicionar à Tela de Início e abra o Varzeão pelo ícone.',
  bloqueado: 'As notificações do Varzeão estão bloqueadas neste aparelho. Libere nos ajustes do navegador e volte aqui.',
  'sem-suporte': 'Este navegador não recebe Avisos. No Android, use o Chrome; no iPhone, instale o App.',
};

export const paginaAvisos: Pagina = async (main) => {
  const l = await liga();
  if (!appLiberado(l.temporada?.numero)) {
    main.innerHTML = html`<section class="placa vazio"><h1>Avisos de jogo</h1><p>Os Avisos chegam com o App, na Temporada 2.</p></section>`.s;
    return;
  }
  const todos = timesAtivos(l);
  const meu = await (async () => {
    const id = jogadorVinculado();
    if (!id) return null;
    return (await jogadores().catch(() => [])).find((j) => j.id === id)?.time ?? null;
  })();
  const ativos = timesComAviso();
  const marcados = new Set<TimeId>(ativos ?? (meu ? [meu] : []));
  const suporte = suporteAosAvisos();

  const botaoTime = (t: TimeId): Html =>
    html`<button type="button" class="aviso-time" data-time="${t}" aria-pressed="${String(marcados.has(t))}">${escudoImg(t, 2)}<span>${curto(t)}</span></button>`;

  function desenhar(status = ''): void {
    const ligado = timesComAviso() !== null;
    main.innerHTML = html`<section class="placa avisos">
      <h1>Avisos de jogo</h1>
      <p>Receba no celular a Escalação, um aviso 5 min antes do Apito Inicial, cada gol e o placar final dos Times que você segue.</p>
      ${suporte === 'ok' ? html`` : html`<p class="avisos-alerta">${AVISO_DO_SUPORTE[suporte]}</p>`}
      <fieldset class="avisos-times" ${suporte === 'ok' ? '' : 'disabled'}>
        <legend>Times que você segue</legend>
        <div class="avisos-grade">${todos.map(botaoTime)}</div>
      </fieldset>
      <div class="instalar-acoes">
        <button type="button" class="botao" data-ativar ${suporte === 'ok' ? '' : 'disabled'}>${ligado ? 'Salvar Times' : 'Ativar avisos'}</button>
        ${ligado ? html`<button type="button" class="botao secundario" data-desativar>Desativar</button>` : html``}
      </div>
      <p class="avisos-status" aria-live="polite">${status || (ligado ? 'Avisos ligados neste aparelho.' : '')}</p>
    </section>`.s;
    for (const b of main.querySelectorAll<HTMLButtonElement>('[data-time]')) {
      b.addEventListener('click', () => {
        const t = b.dataset.time as TimeId;
        if (marcados.has(t)) marcados.delete(t);
        else marcados.add(t);
        b.setAttribute('aria-pressed', String(marcados.has(t)));
      });
    }
    main.querySelector('[data-ativar]')?.addEventListener('click', (e) => {
      if (!marcados.size) return desenhar('Escolha pelo menos um Time.');
      (e.currentTarget as HTMLButtonElement).disabled = true;
      ativarAvisos([...marcados])
        .then(() => desenhar(`Pronto! Você recebe os Avisos de ${[...marcados].map(curto).join(', ')}.`))
        .catch((err: Error) => desenhar(err.message));
    });
    main.querySelector('[data-desativar]')?.addEventListener('click', () => {
      desativarAvisos()
        .then(() => desenhar('Avisos desligados neste aparelho.'))
        .catch((err: Error) => desenhar(err.message));
    });
  }
  desenhar();
};
