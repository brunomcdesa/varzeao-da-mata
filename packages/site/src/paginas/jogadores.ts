/** Jogadores: busca e ranking, o Card de cada um e a comparação lado a lado. */
import { IDENTIDADE, TIMES, nomeDaEtapa, type JogadorPublico, type Posicao, type TimeId } from '@liga/shared';
import { jogadores, liga } from '../dados.js';
import { bonecoImg, curto, escudoImg, esc, html, nota, NOME_DA_POSICAO, POSICOES_EM_ORDEM, tintaSobre, type Html } from '../ui.js';
import type { Pagina } from './tipos.js';

type Criterio = 'ovr' | 'gols' | 'assistencias' | 'notaMedia' | 'jogos' | 'desarmes' | 'defesas';
const CRITERIOS: Record<Criterio, string> = {
  ovr: 'OVR',
  gols: 'Gols',
  assistencias: 'Assistências',
  notaMedia: 'Nota média',
  jogos: 'Jogos',
  desarmes: 'Desarmes',
  defesas: 'Defesas',
};

/** Filtros guardados só nesta aba, para voltar do Card sem perder a busca. */
const filtros = { busca: '', time: '' as TimeId | '', posicao: '' as Posicao | '', criterio: 'ovr' as Criterio, marcados: [] as string[] };

export const paginaJogadores: Pagina = async (main) => {
  const todos = await jogadores();
  main.innerHTML = html`<h1 class="titulo-pagina">Jogadores <small>${todos.length} inscritos</small></h1>
    <form class="filtros" role="search">
      <label class="busca"><span class="sr">Buscar pelo @</span><input type="search" name="busca" placeholder="Buscar @" autocomplete="off" value="${filtros.busca}" /></label>
      <label><span>Time</span><select name="time"><option value="">Todos</option>${TIMES.map((t) => html`<option value="${t}" ${filtros.time === t ? 'selected' : ''}>${curto(t)}</option>`)}</select></label>
      <label><span>Posição</span><select name="posicao"><option value="">Todas</option>${POSICOES_EM_ORDEM.map((p) => html`<option value="${p}" ${filtros.posicao === p ? 'selected' : ''}>${NOME_DA_POSICAO[p]}</option>`)}</select></label>
      <label><span>Ordenar por</span><select name="criterio">${(Object.keys(CRITERIOS) as Criterio[]).map((c) => html`<option value="${c}" ${filtros.criterio === c ? 'selected' : ''}>${CRITERIOS[c]}</option>`)}</select></label>
    </form>
    <p class="legenda">Marque dois Jogadores para comparar.</p>
    <div class="ranking-caixa"><table class="ranking">
      <thead><tr><th scope="col"><span class="sr">Comparar</span></th><th scope="col" class="num">#</th><th scope="col">Jogador</th><th scope="col" title="OVR">OVR</th><th scope="col" title="Jogos">J</th><th scope="col" title="Gols">G</th><th scope="col" title="Assistências">A</th><th scope="col" title="Nota média">Nota</th></tr></thead>
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
      .sort((a, b) => (b[c] ?? -1) - (a[c] ?? -1) || b.ovr - a.ovr || a.username.localeCompare(b.username));
    nada.hidden = lista.length > 0;
    corpo.innerHTML = lista
      .slice(0, 300)
      .map(
        (j, i) => html`<tr>
          <td><input type="checkbox" data-id="${j.id}" aria-label="Comparar @${j.username}" ${filtros.marcados.includes(j.id) ? 'checked' : ''} /></td>
          <td class="num">${i + 1}</td>
          <th scope="row"><a class="jogador-celula" href="#/jogador/${j.id}">${bonecoImg(j.time, j.posicao, j.username, 2)}<span><span class="arroba">@${j.username}</span><small>${escudoImg(j.time, 0.75)} ${curto(j.time)} · ${j.posicao}</small></span></a></th>
          <td class="ovr ${c === 'ovr' ? 'ordem' : ''}">${j.ovr}</td>
          <td class="${c === 'jogos' ? 'ordem' : ''}">${j.jogos}</td>
          <td class="${c === 'gols' ? 'ordem' : ''}">${j.gols}</td>
          <td class="${c === 'assistencias' ? 'ordem' : ''}">${j.assistencias}</td>
          <td class="${c === 'notaMedia' ? 'ordem' : ''}">${nota(j.notaMedia)}</td>
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
    <dl class="card-numeros">
      <div><dt>Jogos</dt><dd>${j.jogos}</dd></div>
      <div><dt>${j.posicao === 'GOL' ? 'Defesas' : j.posicao === 'ZAG' ? 'Desarmes' : 'Gols'}</dt><dd>${j.posicao === 'GOL' ? j.defesas : j.posicao === 'ZAG' ? j.desarmes : j.gols}</dd></div>
      <div><dt>Nota</dt><dd>${nota(j.notaMedia)}</dd></div>
    </dl>
    ${delta ? html`<p class="card-delta ${delta > 0 ? 'sobe' : 'desce'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} desde a estreia</p>` : ''}
    ${j.craqueDaRodada || j.reiDoClassico
      ? html`<p class="card-titulos">${j.craqueDaRodada ? html`<span class="titulo">Craque da Rodada${j.craqueDaRodada > 1 ? ` ×${j.craqueDaRodada}` : ''}</span>` : ''}${
          j.reiDoClassico ? html`<span class="titulo">Rei do Clássico${j.reiDoClassico > 1 ? ` ×${j.reiDoClassico}` : ''}</span>` : ''
        }</p>`
      : ''}
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
      <dl class="numeros-grade">
        <div><dt>Gols</dt><dd>${j.gols}</dd></div>
        <div><dt>Assistências</dt><dd>${j.assistencias}</dd></div>
        <div><dt>Desarmes</dt><dd>${j.desarmes}</dd></div>
        ${j.posicao === 'GOL' ? html`<div><dt>Defesas</dt><dd>${j.defesas}<small>${j.golsSofridos} gols sofridos</small></dd></div>` : html`<div><dt>Defesas</dt><dd>${j.defesas}</dd></div>`}
        <div><dt>Vitórias</dt><dd>${j.vitorias}<small>${j.empates}E ${j.derrotas}D</small></dd></div>
        <div><dt>Nota média</dt><dd>${nota(j.notaMedia)}</dd></div>
        <div><dt>Melhor nota</dt><dd>${nota(j.melhorNota)}</dd></div>
        <div><dt>Candidato a Craque</dt><dd>${j.vezesCandidato}</dd></div>
      </dl>
      <section aria-labelledby="titulo-ovr"><h2 id="titulo-ovr" class="secao">OVR jogo a jogo</h2>
        ${j.historico.length ? graficoOvr([{ j, cor: 'var(--amarelo)' }]) : html`<p class="vazio-pequeno">Ainda não estreou. O OVR muda depois de cada jogo, conforme a Nota.</p>`}
      </section>
      ${j.historico.length
        ? html`<section aria-labelledby="titulo-hist"><h2 id="titulo-hist" class="secao">Jogos</h2>
            <ol class="historico">${[...j.historico].reverse().map(
              (h) => {
                const p = l.calendario.find((x) => x.id === h.partidaId);
                const casa = p?.mandante === j.time;
                const rival = p ? (casa ? p.visitante : p.mandante) : null;
                const meus = p?.placar ? (casa ? p.placar.mandante : p.placar.visitante) : null;
                const deles = p?.placar ? (casa ? p.placar.visitante : p.placar.mandante) : null;
                const res = meus === null || deles === null ? '' : meus > deles ? 'v' : meus < deles ? 'd' : 'e';
                return html`<li><a href="#/partida/${h.partidaId}">
                  <span class="hist-etapa">${p ? nomeDaEtapa(p.fase, p.rodada) : `Rodada ${h.rodada}`}</span>
                  <span class="hist-jogo">${rival ? html`${casa ? 'em casa, contra' : 'fora, contra'} ${escudoImg(rival, 0.75)} ${curto(rival)}` : ''}${
                    meus !== null ? html` <span class="hist-placar res-${res}">${meus}×${deles}</span>` : ''
                  }</span>
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
  main.querySelector<HTMLSelectElement>('select[name="outro"]')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v) location.hash = `#/comparar/${j.id}/${v}`;
  });
};

// ---------------------------------------------------------------- Comparar

const LINHAS: { rotulo: string; v: (j: JogadorPublico) => number | null; fmt?: (n: number | null) => string }[] = [
  { rotulo: 'OVR', v: (j) => j.ovr },
  { rotulo: 'Jogos', v: (j) => j.jogos },
  { rotulo: 'Gols', v: (j) => j.gols },
  { rotulo: 'Assistências', v: (j) => j.assistencias },
  { rotulo: 'Desarmes', v: (j) => j.desarmes },
  { rotulo: 'Defesas', v: (j) => j.defesas },
  { rotulo: 'Nota média', v: (j) => j.notaMedia, fmt: nota },
  { rotulo: 'Melhor nota', v: (j) => j.melhorNota, fmt: nota },
  { rotulo: 'Vitórias', v: (j) => j.vitorias },
  { rotulo: 'Craque da Rodada', v: (j) => j.craqueDaRodada },
  { rotulo: 'Rei do Clássico', v: (j) => j.reiDoClassico },
];

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
      <tbody>${LINHAS.map((l) => {
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
