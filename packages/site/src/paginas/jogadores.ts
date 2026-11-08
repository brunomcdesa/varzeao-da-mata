/** Jogadores: busca e ranking, o Card de cada um e a comparação lado a lado. */
import { IDENTIDADE, NOME_DA_HABILIDADE, PESOS_OVR, TIMES, nomeDaEtapa, type HabilidadeId, type Habilidades, type Estatisticas, type TipoTrofeu, type Trofeu, type JogadorPublico, type Posicao, type TimeId } from '@liga/shared';
import { jogadores, liga } from '../dados.js';
import { bonecoImg, curto, escudoImg, esc, html, nota, NOME_DA_POSICAO, POSICOES_EM_ORDEM, taca, tintaSobre, type Html } from '../ui.js';
import type { Pagina } from './tipos.js';
import { blocoDoDono, ligarMeuPersonagem } from '../meuPersonagem.js';

type Criterio = 'ovr' | 'gols' | 'assistencias' | 'notaMedia' | 'jogos' | 'desarmes' | 'defesas' | 'dribles' | 'bloqueios' | 'titulos' | 'craqueDaRodada' | 'craqueDaTemporada';
const CRITERIOS: Record<Criterio, string> = {
  ovr: 'OVR',
  gols: 'Gols',
  assistencias: 'Assistências',
  notaMedia: 'Nota média',
  jogos: 'Jogos',
  desarmes: 'Desarmes',
  defesas: 'Defesas',
  dribles: 'Dribles',
  bloqueios: 'Bloqueios',
  titulos: 'Títulos',
  craqueDaRodada: 'Craque da Rodada',
  craqueDaTemporada: 'Craque da Temporada',
};
type Periodo = 'temporada' | 'carreira';
const DA_TEMPORADA = new Set<Criterio>(['gols', 'assistencias', 'notaMedia', 'jogos', 'desarmes', 'defesas', 'dribles', 'bloqueios']);
/** Números de estatística seguem o período; OVR e conquistas são sempre da carreira. */
function valor(j: JogadorPublico, c: Criterio, p: Periodo): number | null {
  if (DA_TEMPORADA.has(c) && p === 'temporada') return j.nestaTemporada[c as keyof Estatisticas] as number | null;
  return j[c] as number | null;
}

/** Filtros guardados só nesta aba, para voltar do Card sem perder a busca. */
const filtros = { busca: '', time: '' as TimeId | '', posicao: '' as Posicao | '', criterio: 'ovr' as Criterio, periodo: 'temporada' as Periodo, marcados: [] as string[] };

export const paginaJogadores: Pagina = async (main) => {
  const todos = await jogadores();
  main.innerHTML = html`<h1 class="titulo-pagina">Jogadores <small>${todos.length} inscritos</small></h1>
    <form class="filtros" role="search">
      <label class="busca"><span class="sr">Buscar pelo @</span><input type="search" name="busca" placeholder="Buscar @" autocomplete="off" value="${filtros.busca}" /></label>
      <label><span>Time</span><select name="time"><option value="">Todos</option>${TIMES.map((t) => html`<option value="${t}" ${filtros.time === t ? 'selected' : ''}>${curto(t)}</option>`)}</select></label>
      <label><span>Posição</span><select name="posicao"><option value="">Todas</option>${POSICOES_EM_ORDEM.map((p) => html`<option value="${p}" ${filtros.posicao === p ? 'selected' : ''}>${NOME_DA_POSICAO[p]}</option>`)}</select></label>
      <label><span>Período</span><select name="periodo"><option value="temporada" ${filtros.periodo === 'temporada' ? 'selected' : ''}>Esta Temporada</option><option value="carreira" ${filtros.periodo === 'carreira' ? 'selected' : ''}>Carreira</option></select></label>
      <label><span>Ordenar por</span><select name="criterio">${(Object.keys(CRITERIOS) as Criterio[]).map((c) => html`<option value="${c}" ${filtros.criterio === c ? 'selected' : ''}>${CRITERIOS[c]}</option>`)}</select></label>
    </form>
    <p class="legenda">Marque dois Jogadores para comparar.</p>
    <div class="ranking-caixa"><table class="ranking">
      <thead><tr><th scope="col"><span class="sr">Comparar</span></th><th scope="col" class="num">#</th><th scope="col">Jogador</th><th scope="col" title="OVR">OVR</th><th scope="col" title="Jogos">J</th><th scope="col" title="Gols">G</th><th scope="col" title="Assistências">A</th><th scope="col" title="Nota média">Nota</th><th scope="col" class="extra-col" data-extra></th></tr></thead>
      <tbody></tbody>
    </table></div>
    <p class="vazio-pequeno" hidden data-nada>Ninguém com esse filtro.</p>
    <div class="barra-comparar" hidden><span data-quem></span><a class="botao" data-ir href="#/">Comparar</a></div>`.s;

  const form = main.querySelector('form')!;
  const corpo = main.querySelector('tbody')!;
  const barra = main.querySelector<HTMLElement>('.barra-comparar')!;
  const nada = main.querySelector<HTMLElement>('[data-nada]')!;

  function desenhar(): void {
    const termo = filtros.busca.trim().replace(/^@/, '').toLowerCase();
    const c = filtros.criterio;
    const lista = todos
      .filter((j) => (!termo || j.username.toLowerCase().includes(termo)) && (!filtros.time || j.time === filtros.time) && (!filtros.posicao || j.posicao === filtros.posicao))
      .sort((a, b) => (valor(b, c, filtros.periodo) ?? -1) - (valor(a, c, filtros.periodo) ?? -1) || b.ovr - a.ovr || a.username.localeCompare(b.username));
    const e = (j: JogadorPublico) => (filtros.periodo === 'temporada' ? j.nestaTemporada : j);
    nada.hidden = lista.length > 0;
    const extra = main.querySelector<HTMLElement>('[data-extra]')!;
    extra.textContent = ['ovr', 'jogos', 'gols', 'assistencias', 'notaMedia'].includes(c) ? '' : CRITERIOS[c];
    corpo.innerHTML = lista
      .slice(0, 300)
      .map(
        (j, i) => html`<tr>
          <td><input type="checkbox" data-id="${j.id}" aria-label="Comparar @${j.username}" ${filtros.marcados.includes(j.id) ? 'checked' : ''} /></td>
          <td class="num">${i + 1}</td>
          <th scope="row"><a class="jogador-celula" href="#/jogador/${j.id}">${bonecoImg(j.time, j.posicao, j.username, 2)}<span><span class="arroba">@${j.username}</span><small>${escudoImg(j.time, 0.75)} ${curto(j.time)} · ${j.posicao}</small></span></a></th>
          <td class="ovr ${c === 'ovr' ? 'ordem' : ''}">${j.ovr}</td>
          <td class="${c === 'jogos' ? 'ordem' : ''}">${e(j).jogos}</td>
          <td class="${c === 'gols' ? 'ordem' : ''}">${e(j).gols}</td>
          <td class="${c === 'assistencias' ? 'ordem' : ''}">${e(j).assistencias}</td>
          <td class="${c === 'notaMedia' ? 'ordem' : ''}">${nota(e(j).notaMedia)}</td>
          ${!['ovr', 'jogos', 'gols', 'assistencias', 'notaMedia'].includes(c) ? html`<td class="ordem extra-col">${valor(j, c, filtros.periodo) ?? '–'}</td>` : html`<td class="extra-col"></td>`}
        </tr>`.s,
      )
      .join('');
    atualizarBarra();
  }
  function atualizarBarra(): void {
    const m = filtros.marcados.map((id) => todos.find((j) => j.id === id)).filter(Boolean) as JogadorPublico[];
    barra.hidden = m.length === 0;
    barra.querySelector('[data-quem]')!.textContent = m.length === 1 ? `@${m[0]!.username}: marque mais um` : m.map((j) => `@${j.username}`).join(' × ');
    const ir = barra.querySelector<HTMLAnchorElement>('[data-ir]')!;
    ir.hidden = m.length < 2;
    if (m.length === 2) ir.href = `#/comparar/${m[0]!.id}/${m[1]!.id}`;
  }
  form.addEventListener('input', () => {
    const d = new FormData(form);
    filtros.busca = String(d.get('busca') ?? '');
    filtros.time = String(d.get('time') ?? '') as TimeId | '';
    filtros.posicao = String(d.get('posicao') ?? '') as Posicao | '';
    filtros.criterio = String(d.get('criterio') ?? 'ovr') as Criterio;
    filtros.periodo = String(d.get('periodo') ?? 'temporada') as Periodo;
    desenhar();
  });
  corpo.addEventListener('change', (e) => {
    const cb = e.target as HTMLInputElement;
    const id = cb.dataset.id!;
    filtros.marcados = cb.checked ? [...filtros.marcados.filter((x) => x !== id), id].slice(-2) : filtros.marcados.filter((x) => x !== id);
    for (const outro of corpo.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) outro.checked = filtros.marcados.includes(outro.dataset.id!);
    atualizarBarra();
  });
  desenhar();
};

// ---------------------------------------------------------------- Card

/** Conquistas da carreira, da mais rara para a mais comum. */
function medalhas(j: JogadorPublico): [string, number][] {
  const lista: [string, number][] = [
    ['Campeão', j.titulos],
    ['Craque da Temporada', j.craqueDaTemporada],
    ['Craque da Rodada', j.craqueDaRodada],
    ['Rei do Clássico', j.reiDoClassico],
  ];
  return lista.filter(([, n]) => n > 0);
}

const NOME_DO_TROFEU: Record<TipoTrofeu, string> = {
  CAMPEAO: 'Campeão',
  CRAQUE_TEMPORADA: 'Craque da Temporada',
  CRAQUE_RODADA: 'Craque da Rodada',
  REI_DO_CLASSICO: 'Rei do Clássico',
};

function salaDeTrofeus(j: JogadorPublico): Html {
  if (!j.trofeus.length) return html``;
  const tipos = (['CAMPEAO', 'CRAQUE_TEMPORADA', 'CRAQUE_RODADA', 'REI_DO_CLASSICO'] as TipoTrofeu[]).filter((t) => j.trofeus.some((x) => x.tipo === t));
  const quando = (t: Trofeu) =>
    t.tipo === 'CAMPEAO' || t.tipo === 'CRAQUE_TEMPORADA' ? `Temporada ${t.temporada}` : `${t.rodada && t.fase ? nomeDaEtapa(t.fase, t.rodada) : ''}, T${t.temporada}`;
  return html`<section class="sala" aria-labelledby="titulo-sala">
    <h2 id="titulo-sala" class="secao">Sala de troféus</h2>
    <ul class="sala-lista">${tipos.map((tipo) => {
      const deste = j.trofeus.filter((t) => t.tipo === tipo);
      return html`<li class="sala-item sala-${tipo.toLowerCase()}">
        <span class="sala-icone">${tipo === 'CAMPEAO' ? taca(30, 'trofeu') : html`<span class="estrela" aria-hidden="true"></span>`}</span>
        <span class="sala-nome">${NOME_DO_TROFEU[tipo]}<b>${deste.length}</b></span>
        <span class="sala-quando">${deste.map((t) => (t.partidaId ? html`<a href="#/partida/${t.partidaId}">${quando(t)}</a>` : html`<span>${quando(t)}</span>`))}</span>
      </li>`;
    })}</ul>
  </section>`;
}

/** Habilidades que pesam no OVR da Posição, da mais importante para a menos. */
export function habilidadesDaPosicao(posicao: Posicao): HabilidadeId[] {
  return (Object.entries(PESOS_OVR[posicao]) as [HabilidadeId, number][]).sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

/** Barras de Habilidade em gomos (cada gomo = 10 pontos), como num jogo de futebol antigo. */
export function barrasDeHabilidade(posicao: Posicao, h: Habilidades, antes?: Habilidades): Html {
  return html`<dl class="habilidades">${habilidadesDaPosicao(posicao).map((id) => {
    const v = Math.round(h[id]);
    const d = antes ? v - Math.round(antes[id]) : 0;
    return html`<div class="hab" title="${NOME_DA_HABILIDADE[id]}: ${v}${d ? ` (${d > 0 ? '+' : ''}${d} desde a estreia)` : ''}">
      <dt><span class="hab-nome">${NOME_DA_HABILIDADE[id]}</span><abbr class="hab-sigla" title="${NOME_DA_HABILIDADE[id]}">${id}</abbr></dt>
      <dd><span class="hab-barra" style="--v:${v}" aria-hidden="true"></span><b>${v}</b>${d ? html`<small class="${d > 0 ? 'sobe' : 'desce'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</small>` : ''}</dd>
    </div>`;
  })}</dl>`;
}

export function card(j: JogadorPublico, o: { pequeno?: boolean } = {}): Html {
  const id = IDENTIDADE[j.time];
  const delta = j.ovr - j.ovrInicial;
  return html`<div class="card ${o.pequeno ? 'pequeno' : ''}" style="--cor:${id.primaria};--cor2:${id.secundaria};--sobre:${tintaSobre(id.primaria)}">
    <div class="card-topo">
      <span class="card-ovr">${j.ovr}</span>
      <span class="card-pos">${j.posicao}</span>
      ${escudoImg(j.time, o.pequeno ? 1 : 1.5, 'card-escudo')}
    </div>
    <div class="card-boneco">${bonecoImg(j.time, j.posicao, j.username, o.pequeno ? 6 : 9)}</div>
    <p class="card-nome">@${j.username}</p>
    <p class="card-time">${curto(j.time)} · ${NOME_DA_POSICAO[j.posicao]}</p>
    ${barrasDeHabilidade(j.posicao, j.habilidades, o.pequeno ? undefined : j.habilidadesIniciais)}
    <dl class="card-numeros">
      <div><dt>Jogos</dt><dd>${j.jogos}</dd></div>
      <div><dt>${j.posicao === 'GOL' ? 'Defesas' : j.posicao === 'ZAG' ? 'Desarmes' : 'Gols'}</dt><dd>${j.posicao === 'GOL' ? j.defesas : j.posicao === 'ZAG' ? j.desarmes : j.gols}</dd></div>
      <div><dt>Nota</dt><dd>${nota(j.notaMedia)}</dd></div>
    </dl>
    ${delta ? html`<p class="card-delta ${delta > 0 ? 'sobe' : 'desce'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} desde a estreia</p>` : ''}
    ${medalhas(j).length ? html`<p class="card-titulos">${medalhas(j).map(([rotulo, n]) => html`<span class="titulo">${rotulo}${n > 1 ? ` ×${n}` : ''}</span>`)}</p>` : ''}
  </div>`;
}

/** OVR ao longo dos jogos (um ou dois Jogadores), em SVG. */
function graficoOvr(series: { j: JogadorPublico; cor: string; tracejado?: boolean }[]): Html {
  const w = 560;
  const h = 160;
  const m = { e: 28, d: 12, t: 12, b: 22 };
  const pontos = series.map((s) => [s.j.ovrInicial, ...s.j.historico.map((x) => x.ovr)]);
  const n = Math.max(2, ...pontos.map((p) => p.length));
  const todos = pontos.flat();
  const min = Math.min(...todos) - 2;
  const max = Math.max(...todos) + 2;
  const x = (i: number) => m.e + (i / (n - 1)) * (w - m.e - m.d);
  const y = (v: number) => m.t + (1 - (v - min) / (max - min || 1)) * (h - m.t - m.b);
  const marcas = [...new Set([min + 2, Math.round((min + max) / 2), max - 2])];
  return html`<svg class="grafico" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(series.map((s) => `@${s.j.username}: OVR de ${s.j.ovrInicial} para ${s.j.ovr} em ${s.j.historico.length} jogos`).join('; '))}">
    ${marcas.map((v) => html`<line x1="${m.e}" x2="${w - m.d}" y1="${y(v)}" y2="${y(v)}" class="grade" /><text x="${m.e - 6}" y="${y(v) + 4}" text-anchor="end" class="eixo">${v}</text>`)}
    <text x="${m.e}" y="${h - 4}" class="eixo">estreia</text><text x="${w - m.d}" y="${h - 4}" text-anchor="end" class="eixo">${n - 1}º jogo</text>
    ${series.map((s, k) => {
      const p = pontos[k]!;
      const d = p.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      return html`<path d="${d}" fill="none" stroke="${s.cor}" stroke-width="2.5" ${s.tracejado ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" />
        ${p.map((v, i) => html`<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${s.cor}"><title>@${s.j.username}: OVR ${v}${i ? ` depois do ${i}º jogo` : ' na estreia'}</title></circle>`)}`;
    })}
  </svg>`;
}

export const paginaJogador: Pagina = async (main, [id]) => {
  const [todos, l] = await Promise.all([jogadores(), liga()]);
  const j = todos.find((x) => x.id === id);
  if (!j) {
    main.innerHTML = html`<p class="placa vazio">Jogador não encontrado. <a href="#/jogadores">Buscar Jogadores</a>.</p>`.s;
    return;
  }
  const rankOvr = [...todos].sort((a, b) => b.ovr - a.ovr).findIndex((x) => x.id === j.id) + 1;
  const daPosicao = todos.filter((x) => x.posicao === j.posicao);
  const rankPos = [...daPosicao].sort((a, b) => b.ovr - a.ovr).findIndex((x) => x.id === j.id) + 1;
  const outros = todos.filter((x) => x.id !== j.id).sort((a, b) => a.username.localeCompare(b.username));
  main.innerHTML = html`<article class="pagina-jogador">
    ${card(j)}
    <div class="jogador-detalhes">
      <h1 class="sr">@${j.username}</h1>
      <p class="ranking-frase">${rankOvr}º maior OVR da Liga · ${rankPos}º entre ${daPosicao.length} ${NOME_DA_POSICAO[j.posicao].toLowerCase()}s</p>
      ${salaDeTrofeus(j)}
      ${blocoDoDono()}
      <section aria-labelledby="titulo-numeros">
        <div class="numeros-cabeca">
          <h2 id="titulo-numeros" class="secao">Números</h2>
          ${j.temporadas > 1 || (l.temporada && j.nestaTemporada.jogos !== j.jogos)
            ? html`<div class="alternar" role="group" aria-label="Período">
                <button type="button" data-periodo="temporada" aria-pressed="true">Temporada ${l.temporada?.numero ?? ''}</button>
                <button type="button" data-periodo="carreira" aria-pressed="false">Carreira${j.temporadas > 1 ? ` (${j.temporadas} temporadas)` : ''}</button>
              </div>`
            : ''}
        </div>
        <div data-numeros="temporada">${numeros(j.nestaTemporada, j)}</div>
        <div data-numeros="carreira" hidden>${numeros(j, j)}</div>
      </section>
      <section aria-labelledby="titulo-ovr"><h2 id="titulo-ovr" class="secao">OVR jogo a jogo</h2>
        ${j.historico.length ? graficoOvr([{ j, cor: 'var(--amarelo)' }]) : html`<p class="vazio-pequeno">Ainda não estreou. Cada jogada mexe numa Habilidade, e o OVR é a média delas com os pesos da Posição.</p>`}
      </section>
      ${j.historico.length
        ? html`<section aria-labelledby="titulo-hist"><h2 id="titulo-hist" class="secao">Jogos</h2>
            <ol class="historico">${[...j.historico].reverse().map(
              (h) => {
                const res = h.pro > h.contra ? 'v' : h.pro < h.contra ? 'd' : 'e';
                return html`<li><a href="#/partida/${h.partidaId}">
                  <span class="hist-etapa">${nomeDaEtapa(h.fase, h.rodada)}${j.temporadas > 1 ? html`<small>T${h.temporada}</small>` : ''}</span>
                  <span class="hist-jogo">${h.emCasa ? 'em casa, contra' : 'fora, contra'} ${escudoImg(h.rival, 0.75)} ${curto(h.rival)}
                    <span class="hist-placar res-${res}">${h.pro}×${h.contra}</span></span>
                  <span class="hist-gols" title="Gols">${h.gols ? '●'.repeat(h.gols) : ''}</span>
                  <span class="nota-chip" title="Nota">${nota(h.nota)}</span>
                  <span class="ovr" title="OVR depois do jogo">${h.ovr}</span>
                </a></li>`;
              },
            )}</ol></section>`
        : ''}
      <form class="comparar-com">
        <label><span>Comparar com</span>
          <select name="outro"><option value="">Escolha um Jogador</option>${outros.map((o) => html`<option value="${o.id}">@${o.username} (${curto(o.time)}, ${o.ovr})</option>`)}</select>
        </label>
      </form>
    </div>
  </article>`.s;
  for (const b of main.querySelectorAll<HTMLButtonElement>('[data-periodo]')) {
    b.addEventListener('click', () => {
      for (const x of main.querySelectorAll<HTMLButtonElement>('[data-periodo]')) x.setAttribute('aria-pressed', String(x === b));
      for (const d of main.querySelectorAll<HTMLElement>('[data-numeros]')) d.hidden = d.dataset.numeros !== b.dataset.periodo;
    });
  }
  main.querySelector<HTMLSelectElement>('select[name="outro"]')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v) location.hash = `#/comparar/${j.id}/${v}`;
  });
  return ligarMeuPersonagem(main, j, todos);
};

function numeros(e: Estatisticas, j: JogadorPublico): Html {
  return html`<dl class="numeros-grade">
    <div><dt>Jogos</dt><dd>${e.jogos}</dd></div>
    <div><dt>Gols</dt><dd>${e.gols}</dd></div>
    <div><dt>Assistências</dt><dd>${e.assistencias}</dd></div>
    ${j.posicao === 'GOL' ? html`<div><dt>Defesas</dt><dd>${e.defesas}<small>${e.golsSofridos} sofridos</small></dd></div>` : html`<div><dt>Desarmes</dt><dd>${e.desarmes}</dd></div>`}
    <div><dt>Vitórias</dt><dd>${e.vitorias}<small>${e.empates}E ${e.derrotas}D</small></dd></div>
    <div><dt>Nota média</dt><dd>${nota(e.notaMedia)}</dd></div>
    <div><dt>Melhor nota</dt><dd>${nota(e.melhorNota)}</dd></div>
    ${j.posicao === 'ZAG'
      ? html`<div><dt>Bloqueios</dt><dd>${e.bloqueios ?? 0}</dd></div>`
      : j.posicao === 'GOL'
        ? html`<div><dt>Sofridos por jogo</dt><dd>${e.jogos ? (e.golsSofridos / e.jogos).toFixed(1).replace('.', ',') : '–'}</dd></div>`
        : html`<div><dt>Dribles</dt><dd>${e.dribles ?? 0}</dd></div>`}
  </dl>`;
}

// ---------------------------------------------------------------- Comparar

const LINHAS: { rotulo: string; v: (j: JogadorPublico) => number | null; fmt?: (n: number | null) => string }[] = [
  { rotulo: 'OVR', v: (j) => j.ovr },
  { rotulo: 'Jogos', v: (j) => j.jogos },
  { rotulo: 'Gols', v: (j) => j.gols },
  { rotulo: 'Assistências', v: (j) => j.assistencias },
  { rotulo: 'Desarmes', v: (j) => j.desarmes },
  { rotulo: 'Defesas', v: (j) => j.defesas },
  { rotulo: 'Dribles', v: (j) => j.dribles ?? 0 },
  { rotulo: 'Bloqueios', v: (j) => j.bloqueios ?? 0 },
  { rotulo: 'Nota média', v: (j) => j.notaMedia, fmt: nota },
  { rotulo: 'Melhor nota', v: (j) => j.melhorNota, fmt: nota },
  { rotulo: 'Vitórias', v: (j) => j.vitorias },
  { rotulo: 'Títulos', v: (j) => j.titulos },
  { rotulo: 'Craque da Temporada', v: (j) => j.craqueDaTemporada },
  { rotulo: 'Craque da Rodada', v: (j) => j.craqueDaRodada },
  { rotulo: 'Rei do Clássico', v: (j) => j.reiDoClassico },
];

/** Habilidades que pesam para pelo menos um dos dois, na ordem de importância. */
function linhasDeHabilidade(a: JogadorPublico, b: JogadorPublico): typeof LINHAS {
  const ids = [...new Set([...habilidadesDaPosicao(a.posicao), ...habilidadesDaPosicao(b.posicao)])];
  return ids.map((id) => ({ rotulo: NOME_DA_HABILIDADE[id], v: (j: JogadorPublico) => Math.round(j.habilidades[id]) }));
}

export const paginaComparar: Pagina = async (main, [a, b]) => {
  const todos = await jogadores();
  const ja = todos.find((x) => x.id === a);
  const jb = todos.find((x) => x.id === b);
  if (!ja || !jb) {
    main.innerHTML = html`<p class="placa vazio">Escolha dois Jogadores na <a href="#/jogadores">lista</a> para comparar.</p>`.s;
    return;
  }
  main.innerHTML = html`<article class="pagina-comparar">
    <h1 class="titulo-pagina">@${ja.username} <span class="x">×</span> @${jb.username}</h1>
    <div class="dupla">${card(ja, { pequeno: true })}${card(jb, { pequeno: true })}</div>
    <table class="duelo">
      <caption class="sr">Estatísticas lado a lado</caption>
      <thead><tr><th scope="col">@${ja.username}</th><th scope="col"><span class="sr">Estatística</span></th><th scope="col">@${jb.username}</th></tr></thead>
      <tbody>${[...linhasDeHabilidade(ja, jb), ...LINHAS].map((l) => {
        const va = l.v(ja);
        const vb = l.v(jb);
        const max = Math.max(va ?? 0, vb ?? 0) || 1;
        const fmt = l.fmt ?? ((n: number | null) => String(n ?? '–'));
        const ganha = (x: number | null, y: number | null) => (x ?? -1) > (y ?? -1);
        return html`<tr>
          <td class="lado-a ${ganha(va, vb) ? 'ganha' : ''}"><span class="barra" style="--p:${((va ?? 0) / max) * 100}%"></span><span class="valor">${fmt(va)}</span></td>
          <th scope="row">${l.rotulo}</th>
          <td class="lado-b ${ganha(vb, va) ? 'ganha' : ''}"><span class="barra" style="--p:${((vb ?? 0) / max) * 100}%"></span><span class="valor">${fmt(vb)}</span></td>
        </tr>`;
      })}</tbody>
    </table>
    <section aria-labelledby="titulo-ovr-dupla"><h2 id="titulo-ovr-dupla" class="secao">OVR jogo a jogo</h2>
      <p class="legenda-grafico"><span class="amostra a"></span>@${ja.username} <span class="amostra b"></span>@${jb.username}</p>
      ${graficoOvr([{ j: ja, cor: 'var(--amarelo)' }, { j: jb, cor: 'var(--cal)', tracejado: true }])}
    </section>
  </article>`.s;
};
