/** História da Liga: cada Temporada com campeão, vice, Final, Craque e artilheiro, e a galeria de títulos. */
import { IDENTIDADE, TIMES, type TemporadaNaHistoria, type TimeId } from '@liga/shared';
import { liga } from '../dados.js';
import { bonecoImg, curto, escudoImg, html, taca, type Html } from '../ui.js';
import { tabelaDeClassificacao } from './comum.js';
import type { Pagina } from './tipos.js';

function linhaDaTemporada(t: TemporadaNaHistoria): Html {
  const lider = t.tabela[0]?.time;
  const andamento = !t.campeao;
  const fatos: Html[] = [];
  if (t.final) {
    const pl = t.final.placar;
    fatos.push(html`<div><dt>Final</dt><dd><a href="#/partida/${t.final.partidaId}">${curto(t.final.mandante)} ${pl.mandante} × ${pl.visitante} ${curto(t.final.visitante)}</a>${
      pl.penaltis ? html`<small>pênaltis ${pl.penaltis.mandante}–${pl.penaltis.visitante}</small>` : ''
    }</dd></div>`);
  }
  if (t.vice) fatos.push(html`<div><dt>Vice</dt><dd><a class="time-link" href="#/time/${t.vice}">${escudoImg(t.vice, 0.75)} ${curto(t.vice)}</a></dd></div>`);
  if (t.craque) {
    fatos.push(html`<div><dt>Craque da Temporada</dt><dd><a class="fato-jogador" href="#/jogador/${t.craque.jogadorId}">${bonecoImg(t.craque.time, t.craque.posicao, t.craque.username, 1.5)} @${t.craque.username}</a><small>${curto(t.craque.time)}</small></dd></div>`);
  } else if (!andamento) {
    fatos.push(html`<div><dt>Craque da Temporada</dt><dd class="espera">votação aberta</dd></div>`);
  }
  if (t.artilheiro) {
    fatos.push(html`<div><dt>Artilheiro</dt><dd><a class="fato-jogador" href="#/jogador/${t.artilheiro.jogadorId}">${bonecoImg(t.artilheiro.time, t.artilheiro.posicao, t.artilheiro.username, 1.5)} @${t.artilheiro.username}</a><small>${t.artilheiro.gols} gols</small></dd></div>`);
  }
  if (lider) fatos.push(html`<div><dt>${andamento ? 'Líder agora' : 'Melhor da Fase de Liga'}</dt><dd><a class="time-link" href="#/time/${lider}">${escudoImg(lider, 0.75)} ${curto(lider)}</a><small>${t.tabela[0]!.pontos} pontos</small></dd></div>`);

  const inicio = new Date(`${t.inicio}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  return html`<li class="temporada ${andamento ? 'em-andamento' : ''}">
    <div class="temporada-campeao" style="${t.campeao ? `--cor:${IDENTIDADE[t.campeao].primaria}` : ''}">
      <p class="temporada-numero">Temporada ${t.numero}</p>
      ${t.campeao
        ? html`${taca(34, 'trofeu')}<a class="campeao-time" href="#/time/${t.campeao}">${escudoImg(t.campeao, 3)}<span>${curto(t.campeao)}</span></a><p class="temporada-data">começou em ${inicio}</p>`
        : html`<p class="temporada-andamento">Em andamento</p><p class="temporada-data">começou em ${inicio}</p>`}
    </div>
    <dl class="temporada-fatos">${fatos}</dl>
    ${t.tabela.some((l) => l.jogos > 0)
      ? html`<details class="temporada-tabela"><summary>Tabela da Fase de Liga</summary><div class="quadro-negro">${tabelaDeClassificacao(t.tabela, { compacta: true, semLegenda: true })}</div></details>`
      : ''}
  </li>`;
}

export const paginaHistoria: Pagina = async (main) => {
  const l = await liga();
  const titulos = new Map<TimeId, number[]>();
  for (const t of l.temporadas) if (t.campeao) titulos.set(t.campeao, [...(titulos.get(t.campeao) ?? []), t.numero]);
  const ranking = TIMES.filter((t) => titulos.has(t)).sort((a, b) => titulos.get(b)!.length - titulos.get(a)!.length || Math.min(...titulos.get(a)!) - Math.min(...titulos.get(b)!));
  main.innerHTML = html`<h1 class="titulo-pagina">História da Liga</h1>
    ${ranking.length
      ? html`<section class="galeria" aria-labelledby="titulo-galeria">
          <h2 id="titulo-galeria" class="secao">Títulos por Time</h2>
          <ul class="galeria-lista">${ranking.map(
            (t) => html`<li><a href="#/time/${t}">${escudoImg(t, 2)}<span class="galeria-nome">${curto(t)}</span>
              <span class="galeria-tacas">${titulos.get(t)!.map(() => taca(18, 'trofeu'))}</span>
              <small>${titulos.get(t)!.map((n) => `T${n}`).join(', ')}</small></a></li>`,
          )}</ul>
        </section>`
      : ''}
    <section aria-labelledby="titulo-temporadas">
      <h2 id="titulo-temporadas" class="secao">Temporadas</h2>
      ${l.temporadas.length ? html`<ol class="temporadas" reversed>${l.temporadas.map(linhaDaTemporada)}</ol>` : html`<p class="placa vazio">A primeira Temporada ainda não começou.</p>`}
    </section>`.s;
};
