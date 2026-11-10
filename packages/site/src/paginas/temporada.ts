/** Temporada: o panorama da Temporada atual — líder, últimos jogos, artilharia, assistências, goleiros e números dos Times. */
import { IDENTIDADE, nomeDaRodada, type LigaPublica, type Serie } from '@liga/shared';
import { formaDosTimes, jogadores, liga, rodadaAtual, serieDaPartida, serieDoTime, seriesDaLiga, tabelaDaSerie, temSeries } from '../dados.js';
import { aproveitamento, artilharia, assistencias, ataqueEDefesa, encerradas, goleiros, maiorGoleada, panorama, MIN_JOGOS_GOLEIRO, type Lider } from '../temporada.js';
import { bonecoImg, curto, escudoImg, formaHtml, html, nota, type Html } from '../ui.js';
import { linhaDePartida } from './comum.js';
import type { Pagina } from './tipos.js';

const selo = (s: Serie) => html`<span class="selo-serie serie-${s.toLowerCase()}">Série ${s}</span>`;

/** "Fase de Liga · Rodada 5 de 7", "Semifinais", "Encerrada". */
function andamento(l: LigaPublica, agora: number): string {
  if (l.campeao || l.temporada?.status === 'ENCERRADA') return 'Encerrada';
  const n = rodadaAtual(l, agora);
  const p = l.calendario.find((x) => x.rodada === n);
  if (!p) return '';
  if (p.fase === 'MATA_MATA') return `Mata-mata · ${nomeDaRodada(p.fase, n!)}`;
  const total = new Set(l.calendario.filter((x) => x.fase === 'LIGA').map((x) => x.rodada)).size;
  return `Fase de Liga · Rodada ${n} de ${total}`;
}

/** O Time que lidera (ou o campeão) de uma Série, com os números dele. */
function lider(l: LigaPublica, s: Serie, forma: ReturnType<typeof formaDosTimes>): Html {
  const tabela = tabelaDaSerie(l, s);
  const t = tabela[0];
  if (!t || !t.jogos) return html``;
  const campeao = s === 'A' ? l.campeao : l.campeaoB;
  const time = campeao ?? t.time;
  const linha = tabela.find((x) => x.time === time) ?? t;
  const ap = aproveitamento(linha);
  return html`<a class="lider-time" href="#/time/${time}" style="--cor:${IDENTIDADE[time].primaria}">
    <span class="lider-rotulo">${campeao ? 'Campeão' : 'Líder'}${temSeries(l) ? html` ${selo(s)}` : ''}</span>
    <span class="lider-escudo">${escudoImg(time, 4)}</span>
    <span class="lider-nome">${curto(time)}</span>
    <span class="lider-pontos">${linha.pontos} pontos</span>
    <dl class="lider-numeros">
      <div><dt>V–E–D</dt><dd>${linha.vitorias}–${linha.empates}–${linha.derrotas}</dd></div>
      <div><dt>Gols</dt><dd>${linha.golsPro}:${linha.golsContra}</dd></div>
      <div><dt>Aprov.</dt><dd>${ap === null ? '–' : `${ap}%`}</dd></div>
    </dl>
    ${formaHtml(forma.get(time) ?? [])}
  </a>`;
}

function ranking(titulo: string, id: string, lideres: Lider[], valor: (x: Lider) => Html, l: LigaPublica, vazio: string, rodape = ''): Html {
  return html`<section class="placa ranking-temporada" aria-labelledby="${id}">
    <h2 id="${id}">${titulo}</h2>
    ${lideres.length
      ? html`<ol class="lideres">${lideres.map(
          (x, i) => html`<li class="${i === 0 ? 'primeiro' : ''}">
            <span class="lideres-pos">${i + 1}</span>
            <span class="lideres-boneco">${bonecoImg(x.jogador.time, x.jogador.posicao, x.jogador.username, i === 0 ? 3 : 2, i === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO')}</span>
            <span class="lideres-quem">
              <a href="#/jogador/${x.jogador.id}">${x.jogador.apelido || `@${x.jogador.username}`}</a>
              <small>${escudoImg(x.jogador.time, 0.75)} ${curto(x.jogador.time)}${temSeries(l) ? ` · Série ${serieDoTime(l, x.jogador.time)}` : ''} · ${x.jogos} ${x.jogos === 1 ? 'jogo' : 'jogos'}</small>
            </span>
            <span class="lideres-valor">${valor(x)}</span>
          </li>`,
        )}</ol>`
      : html`<p class="vazio-pequeno">${vazio}</p>`}
    ${rodape ? html`<p class="legenda">${rodape}</p>` : ''}
  </section>`;
}

/** Melhor ataque, melhor defesa e maior goleada (de cada Série). */
function numerosDosTimes(l: LigaPublica, agora: number): Html {
  const fatos = seriesDaLiga(l).flatMap((s) => {
    const ad = ataqueEDefesa(tabelaDaSerie(l, s));
    const g = maiorGoleada(l, temSeries(l) ? s : undefined, agora);
    const daSerie = temSeries(l) ? html` ${selo(s)}` : '';
    const itens: Html[] = [];
    if (ad) {
      itens.push(html`<div><dt>Melhor ataque${daSerie}</dt><dd><a class="time-link" href="#/time/${ad.ataque.time}">${escudoImg(ad.ataque.time, 1)} ${curto(ad.ataque.time)}</a><small>${ad.ataque.golsPro} gols em ${ad.ataque.jogos} jogos</small></dd></div>`);
      itens.push(html`<div><dt>Melhor defesa${daSerie}</dt><dd><a class="time-link" href="#/time/${ad.defesa.time}">${escudoImg(ad.defesa.time, 1)} ${curto(ad.defesa.time)}</a><small>${ad.defesa.golsContra} gols sofridos em ${ad.defesa.jogos} jogos</small></dd></div>`);
    }
    if (g?.placar) {
      itens.push(html`<div><dt>Maior goleada${daSerie}</dt><dd><a href="#/partida/${g.id}">${curto(g.mandante)} ${g.placar.mandante} × ${g.placar.visitante} ${curto(g.visitante)}</a><small>${nomeDaRodada(g.fase, g.rodada)}</small></dd></div>`);
    }
    return itens;
  });
  const craques = l.rodadas.filter((r) => r.craque || r.craqueB);
  if (!fatos.length && !craques.length) return html``;
  return html`<section class="quadro-negro numeros-temporada" aria-labelledby="titulo-numeros">
    <h2 id="titulo-numeros">Números dos Times</h2>
    ${fatos.length ? html`<dl class="fatos fatos-temporada">${fatos}</dl>` : ''}
    ${craques.length
      ? html`<h3 class="subtitulo-giz">Craques das Rodadas</h3>
        <ul class="craques-rodadas">${craques.flatMap((r) =>
          [r.craque, r.craqueB]
            .filter((c) => c)
            .map(
              (c) => html`<li><span class="craques-rodadas-quando">${r.fase === 'LIGA' ? `R${r.numero}` : 'Semi'}</span>
                <a href="#/jogador/${c!.jogadorId}">${escudoImg(c!.time, 0.75)} ${c!.apelido || `@${c!.username}`}</a></li>`,
            ),
        )}</ul>`
      : ''}
  </section>`;
}

export const paginaTemporada: Pagina = async (main) => {
  const [l, js] = await Promise.all([liga(), jogadores()]);
  const agora = Date.now();
  const p = panorama(l, agora);
  const forma = formaDosTimes(l, 5, agora);
  const series = seriesDaLiga(l);
  const porSerie = temSeries(l) ? 4 : 6; // ADR-0031
  const ultimos = encerradas(l, agora);
  const numero = l.temporada?.numero ?? '';
  const fmt1 = (n: number) => n.toFixed(1).replace('.', ',');

  main.innerHTML = html`
    <section class="painel painel-temporada" aria-labelledby="titulo-temporada">
      <header class="painel-cabeca">
        <h1 id="titulo-temporada">Temporada ${numero}</h1>
        <p>${andamento(l, agora)}</p>
      </header>
      <dl class="placar-temporada">
        <div><dt>Jogos</dt><dd>${p.jogos}<small>/${p.totalDeJogos}</small></dd></div>
        <div><dt>Gols</dt><dd>${p.gols}</dd></div>
        <div><dt>Média por jogo</dt><dd>${p.mediaDeGols === null ? '–' : fmt1(p.mediaDeGols)}</dd></div>
        <div><dt>Rodadas</dt><dd>${p.rodadasJogadas}<small>/${p.totalDeRodadas}</small></dd></div>
      </dl>
      <div class="painel-corpo">
        <div class="lideres-times">${series.map((s) => lider(l, s, forma))}</div>
        <div class="painel-lado">
          <section aria-labelledby="titulo-ultimos">
            <h2 id="titulo-ultimos" class="painel-subtitulo">Últimos jogos</h2>
            ${ultimos.length
              ? series.map((s) => {
                  const da = ultimos.filter((x) => serieDaPartida(x) === s).slice(0, porSerie);
                  return da.length ? html`${temSeries(l) ? html`<h3 class="subsecao-serie">${selo(s)}</h3>` : ''}<ul class="placas">${da.map((x) => linhaDePartida(x, { comDia: true }))}</ul>` : '';
                })
              : html`<p class="destaque-nota">Ainda não teve jogo nesta Temporada.</p>`}
            <p class="tabela-link"><a href="#/jogos">Todos os jogos</a> · <a href="#/tabela">Tabela completa</a></p>
          </section>
        </div>
      </div>
    </section>
    <div class="temporada-grade">
      ${ranking('Artilharia', 'titulo-artilharia', artilharia(js), (x) => html`${x.valor}<small>${x.valor === 1 ? 'gol' : 'gols'}</small>`, l, 'Ninguém marcou ainda.')}
      ${ranking('Assistências', 'titulo-assistencias', assistencias(js), (x) => html`${x.valor}<small>${x.valor === 1 ? 'assist.' : 'assists.'}</small>`, l, 'Nenhuma assistência ainda.')}
      ${ranking(
        'Goleiros',
        'titulo-goleiros',
        goleiros(js),
        (x) => html`${nota(x.valor)}<small>sofridos/jogo</small>`,
        l,
        `Aparece quando algum goleiro tiver ${MIN_JOGOS_GOLEIRO} jogos.`,
        `Menos gols sofridos por jogo, com pelo menos ${MIN_JOGOS_GOLEIRO} jogos. Desempate: maior nota média.`,
      )}
    </div>
    ${numerosDosTimes(l, agora)}`.s;
};
