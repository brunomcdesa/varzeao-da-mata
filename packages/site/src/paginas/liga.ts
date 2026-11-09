/** Jogos (calendário), Tabela, Times e a página de cada Time. */
import { FALA_DO_TIME, IDENTIDADE, TIMES, nomeDaRodada, type JogadorPublico, type LigaPublica, type TimeId } from '@liga/shared';
import { diaLongo, jogadores, liga, rodadaAtual } from '../dados.js';
import { bonecoImg, curto, escudoImg, html, nota, NOME_DA_POSICAO, POSICOES_EM_ORDEM, taca, tintaSobre, comCamisa } from '../ui.js';
import { chaveamento } from './chave.js';
import { linhaDePartida, tabelaDeClassificacao } from './comum.js';
import type { Pagina } from './tipos.js';

/** Temporadas que o Time ganhou. */
function titulosDo(l: LigaPublica, t: TimeId): number[] {
  return l.temporadas.filter((x) => x.campeao === t).map((x) => x.numero).sort((a, b) => a - b);
}

/** Conquistas do Time em todas as Temporadas, no mesmo formato da sala do Jogador. */
function salaDoTime(l: LigaPublica, t: TimeId): ReturnType<typeof html> {
  const itens: { tipo: string; nome: string; icone: 'taca' | 'estrela'; quando: ReturnType<typeof html>[] }[] = [];
  const titulos = l.temporadas.filter((x) => x.campeao === t).sort((a, b) => b.numero - a.numero);
  const vices = l.temporadas.filter((x) => x.vice === t).sort((a, b) => b.numero - a.numero);
  const lideres = l.temporadas.filter((x) => x.campeao && x.tabela[0]?.time === t).sort((a, b) => b.numero - a.numero);
  const craques = l.temporadas.filter((x) => x.craque?.time === t).sort((a, b) => b.numero - a.numero);
  const final = (x: (typeof l.temporadas)[number]) => (x.final ? html`<a href="#/partida/${x.final.partidaId}">Temporada ${x.numero}</a>` : html`<span>Temporada ${x.numero}</span>`);
  if (titulos.length) itens.push({ tipo: 'campeao', nome: 'Campeão', icone: 'taca', quando: titulos.map(final) });
  if (vices.length) itens.push({ tipo: 'vice', nome: 'Vice-campeão', icone: 'estrela', quando: vices.map(final) });
  if (lideres.length) itens.push({ tipo: 'lider', nome: 'Melhor da Fase de Liga', icone: 'estrela', quando: lideres.map((x) => html`<span>Temporada ${x.numero}</span>`) });
  if (craques.length) {
    itens.push({ tipo: 'craque_temporada', nome: 'Craque da Temporada no elenco', icone: 'estrela', quando: craques.map((x) => html`<a href="#/jogador/${x.craque!.jogadorId}">${x.craque!.apelido || `@${x.craque!.username}`}, T${x.numero}</a>`) });
  }
  if (!itens.length) return html``;
  const contagem = (i: (typeof itens)[number]) => i.quando.length;
  return html`<section class="sala sala-do-time" aria-labelledby="titulo-sala-time">
    <h2 id="titulo-sala-time" class="secao">Sala de troféus</h2>
    <ul class="sala-lista">${itens.map(
      (i) => html`<li class="sala-item sala-${i.tipo}">
        <span class="sala-icone">${i.icone === 'taca' ? taca(30, 'trofeu') : html`<span class="estrela" aria-hidden="true"></span>`}</span>
        <span class="sala-nome">${i.nome}<b>${contagem(i)}</b></span>
        <span class="sala-quando">${i.quando}</span>
      </li>`,
    )}</ul>
  </section>`;
}

export const paginaJogos: Pagina = async (main) => {
  const l = await liga();
  // O Mata-mata aparece só no chaveamento; a lista é da Fase de Liga.
  const rodadas = [...new Set(l.calendario.filter((p) => p.fase === 'LIGA').map((p) => p.rodada))];
  const atual = rodadaAtual(l);
  main.innerHTML = html`<h1 class="titulo-pagina">Jogos da Temporada ${l.temporada?.numero ?? ''}</h1>
    ${rodadas.length ? chaveamento(l) : ''}
    ${rodadas.length
      ? html`<div class="grade-rodadas">${rodadas.map((n) => {
          const jogos = l.calendario.filter((p) => p.rodada === n);
          return html`<section class="rodada-bloco ${n === atual ? 'atual' : ''}" id="rodada-${n}" aria-labelledby="t-rodada-${n}">
            <h2 id="t-rodada-${n}" class="secao">${nomeDaRodada(jogos[0]!.fase, n)} <small>${diaLongo(jogos[0]!.apito)}</small></h2>
            <ul class="lista-partidas">${jogos.map((p) => linhaDePartida(p))}</ul>
          </section>`;
        })}</div>`
      : html`<p class="placa vazio">A Temporada ainda não tem jogos marcados.</p>`}`.s;
  main.querySelector('.rodada-bloco.atual')?.scrollIntoView({ block: 'start' });
};

export const paginaTabela: Pagina = async (main) => {
  const l = await liga();
  main.innerHTML = html`<h1 class="titulo-pagina">Tabela da Fase de Liga</h1>
    <div class="quadro-negro tabela-grande">${tabelaDeClassificacao(l.tabela)}</div>
    <p class="legenda"><a href="#/jogos">Ver o chaveamento do Mata-mata em Jogos</a></p>`.s;
};

export const paginaTimes: Pagina = async (main) => {
  const [l, js] = await Promise.all([liga(), jogadores()]);
  main.innerHTML = html`<h1 class="titulo-pagina">Os 8 Times</h1>
    <ul class="grade-times">${TIMES.map((t) => {
      const elenco = js.filter((j) => j.time === t);
      const pos = l.tabela.findIndex((x) => x.time === t) + 1;
      const id = IDENTIDADE[t];
      return html`<li><a class="cartaz-time" href="#/time/${t}" style="--cor:${id.primaria};--cor2:${id.secundaria};--sobre:${tintaSobre(id.primaria)}">
        ${escudoImg(t, 3)}
        <span class="nome">${id.nome}</span>
        <span class="bordao">“${FALA_DO_TIME[t].bordao}”</span>
        ${titulosDo(l, t).length ? html`<span class="tacas">${titulosDo(l, t).map(() => taca(16, 'trofeu'))}</span>` : ''}
        <span class="numeros"><span>${pos}º</span><span>${elenco.length} ${elenco.length === 1 ? 'jogador' : 'jogadores'}</span></span>
      </a></li>`;
    })}</ul>`.s;
};

function linhaDoElenco(j: JogadorPublico): ReturnType<typeof html> {
  return html`<li><a href="#/jogador/${j.id}" class="elenco-linha">
    ${bonecoImg(j.time, j.posicao, j.username, 2)}
    <span class="quem">${comCamisa(j.apelido || `@${j.username}`, j.numero)}</span>
    <span class="dado" title="Jogos">${j.jogos} j</span>
    <span class="dado" title="Gols">${j.gols} g</span>
    <span class="dado" title="Nota média">${nota(j.notaMedia)}</span>
    <span class="ovr">${j.ovr}</span>
  </a></li>`;
}

export const paginaTime: Pagina = async (main, [idTexto]) => {
  const t = (idTexto ?? '').toUpperCase() as TimeId;
  if (!TIMES.includes(t)) {
    main.innerHTML = html`<p class="placa vazio">Esse Time não existe. <a href="#/times">Ver os 8 Times</a>.</p>`.s;
    return;
  }
  const [l, js] = await Promise.all([liga(), jogadores()]);
  const id = IDENTIDADE[t];
  const elenco = js.filter((j) => j.time === t).sort((a, b) => b.ovr - a.ovr || a.username.localeCompare(b.username));
  const linha = l.tabela.find((x) => x.time === t);
  const pos = l.tabela.findIndex((x) => x.time === t) + 1;
  const jogos = l.calendario.filter((p) => p.mandante === t || p.visitante === t);
  main.innerHTML = html`<article class="pagina-time" style="--cor:${id.primaria};--cor2:${id.secundaria};--sobre:${tintaSobre(id.primaria)}">
    <header class="faixa-time">
      ${escudoImg(t, 5)}
      <div>
        <h1>${id.nome}</h1>
        <p class="bordao">“${FALA_DO_TIME[t].bordao}”</p>
        ${titulosDo(l, t).length
          ? html`<p class="titulos-time">${titulosDo(l, t).map(() => taca(20, 'trofeu'))}<span>${titulosDo(l, t).length === 1 ? 'Campeão' : `${titulosDo(l, t).length} vezes campeão`}: ${titulosDo(l, t).map((n) => `Temporada ${n}`).join(', ')}</span></p>`
          : ''}
        ${linha ? html`<p class="campanha">${pos}º lugar · ${linha.pontos} pontos · ${linha.vitorias}V ${linha.empates}E ${linha.derrotas}D · saldo ${linha.saldo > 0 ? '+' : ''}${linha.saldo}</p>` : ''}
      </div>
    </header>
    ${salaDoTime(l, t)}
    <div class="time-colunas">
      <section aria-labelledby="titulo-elenco">
        <h2 id="titulo-elenco" class="secao">Elenco <small>${elenco.length} inscritos · ordenado por OVR</small></h2>
        ${elenco.length
          ? POSICOES_EM_ORDEM.map((pos) => {
              const da = elenco.filter((j) => j.posicao === pos);
              return html`<div class="grupo-posicao"><h3>${NOME_DA_POSICAO[pos]}s <small>${da.length}</small></h3>
                ${da.length ? html`<ul class="elenco">${da.map(linhaDoElenco)}</ul>` : html`<p class="vazio-pequeno">Ninguém ainda: a Base completa a vaga.</p>`}</div>`;
            })
          : html`<p class="placa vazio">Ninguém inscrito ainda. Comente <span class="comando pequeno">ENTRO ${curto(t).toUpperCase()} ATACANTE</span> para ser o primeiro.</p>`}
      </section>
      <section aria-labelledby="titulo-jogos-time">
        <h2 id="titulo-jogos-time" class="secao">Jogos</h2>
        <ul class="lista-partidas">${jogos.map((p) => linhaDePartida(p, { comDia: true }))}</ul>
      </section>
    </div>
  </article>`.s;
};
