/**
 * Página de Carreira (ADR-0025): a vida do Jogador Temporada por Temporada, com o Time (e a
 * Série) de cada uma, os números, o OVR do começo ao fim, os cartões e os troféus.
 * Só existe a partir da Temporada 2: na T1 a Carreira é uma Temporada só, e a página do
 * Jogador já mostra tudo.
 */
import { FALA_DO_TIME, IDENTIDADE, NOME_DA_ESPECIALIZACAO, NOME_DA_HABILIDADE, nomeVisivel, temRegrasT2, type JogadorPublico, type TipoTrofeu } from '@liga/shared';
import { jogadores, liga } from '../dados.js';
import { bonecoImg, curto, escudoImg, html, nota, NOME_DA_POSICAO, type Html } from '../ui.js';
import type { Pagina } from './tipos.js';
import { temporadasDaCarreira, type TemporadaDaCarreira } from '../carreira.js';

const NOME_DO_TROFEU: Record<TipoTrofeu, [string, string]> = {
  CAMPEAO: ['Título', 'Títulos'],
  CRAQUE_TEMPORADA: ['Craque da Temporada', 'Craque da Temporada'],
  SELECAO_TEMPORADA: ['Seleção da Temporada', 'vezes na Seleção da Temporada'],
  CRAQUE_RODADA: ['Craque da Rodada', 'Craques da Rodada'],
  SELECAO_RODADA: ['Seleção da Rodada', 'vezes na Seleção da Rodada'],
  REI_DO_CLASSICO: ['Rei do Clássico', 'Reis do Clássico'],
};

/** Selo de Fundador (ADR-0036), nas cores do Time. Só existe a partir da T2. */
function seloFundador(f: NonNullable<JogadorPublico['fundador']>, completo: boolean): Html {
  const id = IDENTIDADE[f.time];
  const nome = FALA_DO_TIME[f.time];
  return html`<span class="selo-fundador" style="--fundador-cor: ${id.primaria}; --fundador-borda: ${id.secundaria}">${escudoImg(f.time, 1)}<span>${completo ? `Fundador ${nome.artigo === 'a' ? 'da' : 'do'} ${nome.curto}` : 'Fundador'}</span></span>`;
}

function cartaoDaTemporada(t: TemporadaDaCarreira, atual: boolean, fundador?: JogadorPublico['fundador']): Html {
  const delta = t.ovrInicio !== null && t.ovrFim !== null ? t.ovrFim - t.ovrInicio : 0;
  return html`<li class="temporada-carreira placa">
    <header>
      <h2>Temporada ${t.numero}${atual ? html` <small>em andamento</small>` : ''}</h2>
      <p class="times-carreira">${t.times.map(
        (x, i) => html`${i ? html`<span class="seta" aria-label="transferido para">→</span>` : ''}<a href="#/time/${x.time}">${escudoImg(x.time, 1)} ${curto(x.time)}${x.serie ? html` <small>Série ${x.serie}</small>` : ''}</a>`,
      )}</p>
    </header>
    ${t.jogos
      ? html`<dl class="numeros-carreira">
          <div><dt>Jogos</dt><dd>${t.jogos}</dd></div>
          <div><dt>V-E-D</dt><dd>${t.vitorias}-${t.empates}-${t.derrotas}</dd></div>
          <div><dt>Gols</dt><dd>${t.gols}</dd></div>
          <div><dt>Assist.</dt><dd>${t.assistencias}</dd></div>
          <div><dt>Nota média</dt><dd>${nota(t.notaMedia)}</dd></div>
          <div><dt>OVR</dt><dd>${t.ovrInicio} → ${t.ovrFim}${delta ? html` <small class="${delta > 0 ? 'sobe' : 'desce'}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</small>` : ''}</dd></div>
          ${t.amarelos || t.expulsoes ? html`<div><dt>Cartões</dt><dd>${t.amarelos ? html`<span class="mini-cartao amarelo" aria-label="amarelos"></span>${t.amarelos}` : ''} ${t.expulsoes ? html`<span class="mini-cartao vermelho" aria-label="vermelhos"></span>${t.expulsoes}` : ''}</dd></div>` : ''}
        </dl>`
      : html`<p class="vazio-pequeno">Ainda não jogou nesta Temporada.</p>`}
    ${fundador?.temporada === t.numero ? html`<p class="trofeus-carreira">${seloFundador(fundador, true)}</p>` : ''}
    ${t.trofeus.length ? html`<p class="trofeus-carreira">${t.trofeus.map(([tipo, n]) => html`<span class="selo">${n > 1 ? `${n} ` : ''}${NOME_DO_TROFEU[tipo][n > 1 ? 1 : 0]}</span>`)}</p>` : ''}
  </li>`;
}

export const paginaCarreira: Pagina = async (main, [id]) => {
  const [todos, l] = await Promise.all([jogadores(), liga()]);
  const j = todos.find((x) => x.id === id);
  // Na Temporada 1 a página não existe (o site da T1 não mostra nada da T2).
  if (!j || !temRegrasT2(l.temporada?.numero ?? 0)) {
    main.innerHTML = html`<p class="placa vazio">Página não encontrada. <a href="#/jogadores">Buscar Jogadores</a>.</p>`.s;
    return;
  }
  const temporadas = temporadasDaCarreira(j);
  const atual = l.temporada?.numero;
  main.innerHTML = html`<article class="pagina-carreira">
    <header class="cabeca-carreira placa">
      ${bonecoImg(j.time, j.posicao, j.username, 4)}
      <div>
        <p class="tabua-titulo">Carreira</p>
        <h1><a href="#/jogador/${j.id}">${nomeVisivel(j)}</a></h1>
        ${j.fundador ? html`<p class="linha-fundador">${seloFundador(j.fundador, true)} <small>desde a Temporada ${j.fundador.temporada}</small></p>` : ''}
        <p>${NOME_DA_POSICAO[j.posicao]} do ${curto(j.time)} · OVR ${j.ovr} · ${j.temporadas} ${j.temporadas === 1 ? 'Temporada' : 'Temporadas'} · ${j.jogos} jogos, ${j.gols} gols</p>
        ${j.especializacao || j.treino
          ? html`<p class="legenda">${j.especializacao ? `Especialização: ${NOME_DA_ESPECIALIZACAO[j.especializacao]}` : ''}${j.especializacao && j.treino ? ' · ' : ''}${j.treino ? `Treino: ${NOME_DA_HABILIDADE[j.treino]}` : ''}</p>`
          : ''}
      </div>
    </header>
    <ol class="lista-carreira">${temporadas.map((t) => cartaoDaTemporada(t, t.numero === atual, j.fundador))}</ol>
  </article>`.s;
};
