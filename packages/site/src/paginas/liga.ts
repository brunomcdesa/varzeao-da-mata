/** Jogos (calendário), Tabela, Times e a página de cada Time. */
import { FALA_DO_TIME, GRUPOS, IDENTIDADE, NOME_DO_GRUPO, OVR_JOGADOR_DA_BASE, TIMES, escalacaoProvavel, foraDoMataMata, forcaProvavel, inscritosAteNoProximoJogo, nomeDaRodada, type Formacao, type JogadorPublico, type LigaPublica, type PartidaNoCalendario, type Serie, type TimeId } from '@liga/shared';
import { avisoDaPreTemporada, diaLongo, jogadores, liga, preTemporada, rodadaAtual, serieDaPartida, serieDoTime, seriesDaLiga, tabelaDaSerie, temSeries, timesAtivos, gruposAtivos, formaDosTimes } from '../dados.js';
import { bonecoImg, campinho, curto, escudoImg, forcaHtml, formaHtml, html, nota, NOME_DA_POSICAO, POSICOES_EM_ORDEM, taca, tintaSobre, comCamisa, comFaixa } from '../ui.js';
import { capitaniaDoVinculo, capitaniaGuardada, enviarEscolhaDoVinculo, jogadorVinculado } from '../meuPersonagem.js';
import { blocoDoPlano, planoDaCapitania, valorDoFormulario, type Capitania } from '../planoDoTime.js';
import { chaveDaCopa, chaveamento } from './chave.js';
import { abaDosJogos } from '../abaDosJogos.js';
import { linhaDePartida, tabelaDeClassificacao } from './comum.js';
import type { Pagina } from './tipos.js';
import { abas } from '../abas.js';

/** Temporadas que o Time ganhou (o título da Liga, que com Séries é o da A). */
function titulosDo(l: LigaPublica, t: TimeId): number[] {
  return l.temporadas.filter((x) => x.campeao === t).map((x) => x.numero).sort((a, b) => a - b);
}

/** Lista de Partidas de uma Rodada, separada por Série quando há Série B (ADR-0017). */
function partidasPorSerie(l: LigaPublica, jogos: PartidaNoCalendario[], linha: (p: PartidaNoCalendario) => ReturnType<typeof html>): ReturnType<typeof html> {
  if (!temSeries(l)) return html`<ul class="lista-partidas">${jogos.map(linha)}</ul>`;
  return html`${seriesDaLiga(l).map((s) => {
    const da = jogos.filter((p) => serieDaPartida(p) === s);
    return da.length ? html`<h3 class="subsecao-serie"><span class="selo-serie serie-${s.toLowerCase()}">Série ${s}</span></h3><ul class="lista-partidas">${da.map(linha)}</ul>` : '';
  })}`;
}

/** Conquistas do Time em todas as Temporadas, no mesmo formato da sala do Jogador. */
function salaDoTime(l: LigaPublica, t: TimeId): ReturnType<typeof html> {
  const itens: { tipo: string; nome: string; icone: 'taca' | 'estrela'; quando: ReturnType<typeof html>[] }[] = [];
  const titulos = l.temporadas.filter((x) => x.campeao === t).sort((a, b) => b.numero - a.numero);
  const titulosB = l.temporadas.filter((x) => x.serieB?.campeao === t).sort((a, b) => b.numero - a.numero);
  const vices = l.temporadas.filter((x) => x.vice === t).sort((a, b) => b.numero - a.numero);
  const lideres = l.temporadas.filter((x) => x.campeao && x.tabela[0]?.time === t).sort((a, b) => b.numero - a.numero);
  const craques = l.temporadas.filter((x) => x.craque?.time === t).sort((a, b) => b.numero - a.numero);
  const final = (x: (typeof l.temporadas)[number]) => (x.final ? html`<a href="#/partida/${x.final.partidaId}">Temporada ${x.numero}</a>` : html`<span>Temporada ${x.numero}</span>`);
  if (titulos.length) itens.push({ tipo: 'campeao', nome: 'Campeão', icone: 'taca', quando: titulos.map(final) });
  if (titulosB.length) {
    const finalB = (x: (typeof l.temporadas)[number]) => (x.serieB?.final ? html`<a href="#/partida/${x.serieB.final.partidaId}">Temporada ${x.numero}</a>` : html`<span>Temporada ${x.numero}</span>`);
    itens.push({ tipo: 'campeao', nome: 'Campeão da Série B', icone: 'taca', quando: titulosB.map(finalB) });
  }
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

export const paginaJogos: Pagina = async (main, params) => {
  const l = await liga();
  // O Mata-mata aparece só no chaveamento; a lista é da Fase de Liga.
  const rodadas = [...new Set(l.calendario.filter((p) => p.fase === 'LIGA' && !p.copa).map((p) => p.rodada))];
  const daVez = rodadaAtual(l);
  const aba = abaDosJogos(l, params[0]);
  const competicao = aba
    ? html`<nav class="sub-abas" aria-label="Competição">
        <a href="#/jogos/liga" ${aba === 'LIGA' ? html`aria-current="page"` : ''}>Liga</a>
        <a href="#/jogos/copa" ${aba === 'COPA' ? html`aria-current="page"` : ''}>Copa</a>
      </nav>`
    : '';
  if (aba === 'COPA') {
    main.innerHTML = html`<h1 class="titulo-pagina">Jogos da Temporada ${l.temporada?.numero ?? ''}</h1>
      ${preTemporada(l) ? html`<p class="placa aviso-temporada">${avisoDaPreTemporada(l)}</p>` : ''}
      ${competicao}
      ${chaveDaCopa(l)}`.s;
    return;
  }
  main.innerHTML = html`<h1 class="titulo-pagina">Jogos da Temporada ${l.temporada?.numero ?? ''}</h1>
    ${preTemporada(l) ? html`<p class="placa aviso-temporada">${avisoDaPreTemporada(l)}</p>` : ''}
    ${competicao}
    ${l.palpites?.length
      ? html`<section class="placa ranking-palpites" aria-labelledby="titulo-palpiteiros">
          <h2 id="titulo-palpiteiros" class="secao">Palpiteiros da Temporada <small>pontos dos Palpites</small></h2>
          <ol>${l.palpites.slice(0, 10).map((x) => html`<li><a href="#/jogador/${x.jogadorId}">${x.apelido || `@${x.username}`}</a><span>${x.acertos} ${x.acertos === 1 ? 'acerto' : 'acertos'}</span><strong>${x.pontos}</strong></li>`)}</ol>
        </section>`
      : ''}
    ${rodadas.length
      ? html`<div class="grade-rodadas">${abas(
          'jogos',
          [
            { id: 'chave', rotulo: 'Mata-mata', conteudo: html`${seriesDaLiga(l).map((serie) => chaveamento(l, { serie }))}` },
            ...rodadas.map((n) => {
              const jogos = l.calendario.filter((p) => p.rodada === n);
              return {
                id: `r${n}`,
                rotulo: `Rodada ${n}`,
                conteudo: html`<section class="rodada-bloco ${n === daVez ? 'atual' : ''}" id="rodada-${n}" aria-labelledby="t-rodada-${n}">
                  <h2 id="t-rodada-${n}" class="secao">${nomeDaRodada(jogos[0]!.fase, n)} <small>${diaLongo(jogos[0]!.apito)}</small></h2>
                  ${partidasPorSerie(l, jogos, (p) => linhaDePartida(p))}
                </section>`,
              };
            }),
          ],
          // Depois da Fase de Liga, o Mata-mata é o que importa; antes, a Rodada da vez.
          rodadas.includes(daVez ?? -1) ? `r${daVez}` : l.calendario.some((p) => p.fase === 'MATA_MATA') ? 'chave' : `r${rodadas[0]}`,
        )}</div>`
      : html`<p class="placa vazio">A Temporada ainda não tem jogos marcados.</p>`}`.s;
  // No computador, a página desce até a Rodada da vez (no celular, ela é a subaba aberta).
  if (matchMedia('(min-width: 720px)').matches) main.querySelector('.rodada-bloco.atual')?.scrollIntoView({ block: 'start' });
};

export const paginaTabela: Pagina = async (main) => {
  const l = await liga();
  main.innerHTML = temSeries(l)
    ? html`<h1 class="titulo-pagina">Tabela da Fase de Liga</h1>
        ${abas('tabela', seriesDaLiga(l).map((s) => ({
          id: s.toLowerCase(),
          rotulo: `Série ${s}`,
          conteudo: html`<section aria-labelledby="titulo-tabela-${s.toLowerCase()}">
            <h2 id="titulo-tabela-${s.toLowerCase()}" class="secao"><span class="selo-serie serie-${s.toLowerCase()}">Série ${s}</span></h2>
            <div class="quadro-negro tabela-grande">${tabelaDeClassificacao(tabelaDaSerie(l, s), { serie: s, forma: formaDosTimes(l) })}</div>
          </section>`,
        })))}
        <p class="legenda"><a href="#/jogos/liga">Ver o chaveamento do Mata-mata em Jogos</a></p>`.s
    : l.grupos?.length
      ? html`<h1 class="titulo-pagina">${preTemporada(l) ? `Tabela da Temporada ${l.temporada?.numero}` : 'Tabela da Fase de Liga'}</h1>
        ${preTemporada(l) ? html`<p class="placa aviso-temporada">${avisoDaPreTemporada(l)}</p>` : ''}
        ${abas('tabela', l.grupos.map((g) => ({
          id: g.grupo.toLowerCase(),
          rotulo: g.nome,
          // Cada Grupo é uma subaba no celular: cada um leva a sua legenda.
          conteudo: html`<section aria-labelledby="titulo-grupo-${g.grupo.toLowerCase()}">
            <h2 id="titulo-grupo-${g.grupo.toLowerCase()}" class="secao">${g.nome}</h2>
            <div class="quadro-negro tabela-grande">${tabelaDeClassificacao(g.tabela, { ...(preTemporada(l) ? {} : { forma: formaDosTimes(l) }), classificam: 2, porGrupo: true, caem: l.caem ?? 0 })}</div>
          </section>`,
        })))}
        ${preTemporada(l) ? '' : html`<p class="legenda"><a href="#/jogos/liga">Ver o chaveamento do Mata-mata em Jogos</a></p>`}`.s
    : html`<h1 class="titulo-pagina">Tabela da Fase de Liga</h1>
    <div class="quadro-negro tabela-grande">${tabelaDeClassificacao(l.tabela, { forma: formaDosTimes(l), ...(l.caem ? { caem: l.caem } : {}) })}</div>
    <p class="legenda"><a href="#/jogos/liga">Ver o chaveamento do Mata-mata em Jogos</a></p>`.s;
};

export const paginaTimes: Pagina = async (main) => {
  const [l, js] = await Promise.all([liga(), jogadores()]);
  const ativos = timesAtivos(l);
  const grade = (times: readonly TimeId[]) => html`<ul class="grade-times">${times.map((t) => {
      const elenco = js.filter((j) => j.time === t);
      const pos = tabelaDaSerie(l, serieDoTime(l, t)).findIndex((x) => x.time === t) + 1;
      const id = IDENTIDADE[t];
      return html`<li><a class="cartaz-time" href="#/time/${t}" style="--cor:${id.primaria};--cor2:${id.secundaria};--sobre:${tintaSobre(id.primaria)}">
        ${escudoImg(t, 3)}
        <span class="nome">${id.nome}</span>
        <span class="bordao">“${FALA_DO_TIME[t].bordao}”</span>
        ${titulosDo(l, t).length ? html`<span class="tacas">${titulosDo(l, t).map(() => taca(16, 'trofeu'))}</span>` : ''}
        ${forcaHtml(forcaProvavel(elenco, inscritosAteNoProximoJogo(l.calendario, t)))}
        <span class="numeros"><span>${pos ? `${pos}º` : 'estreante'}</span><span>${elenco.length} ${elenco.length === 1 ? 'jogador' : 'jogadores'}</span></span>
      </a></li>`;
    })}</ul>`;
  // Na T2, um bloco por Grupo (ADR-0068), na ordem da Abertura.
  const grupos = gruposAtivos(l);
  main.innerHTML = html`<h1 class="titulo-pagina">Os ${ativos.length} Times</h1>
    ${temSeries(l)
      ? seriesDaLiga(l).map((s: Serie) => html`<h2 class="secao"><span class="selo-serie serie-${s.toLowerCase()}">Série ${s}</span></h2>${grade(l.series![s])}`)
      : grupos
        ? GRUPOS.map((g) => html`<h2 class="secao">${NOME_DO_GRUPO[g]}</h2>${grade(grupos[g])}`)
        : grade(ativos)}`.s;
};

function linhaDoElenco(j: JogadorPublico, inscritosAte: string | null = null, proxima = 'próxima Temporada'): ReturnType<typeof html> {
  return html`<li><a href="#/jogador/${j.id}" class="elenco-linha">
    ${bonecoImg(j.time, j.posicao, j.username, 2)}
    <span class="quem">${comFaixa(comCamisa(j.apelido || `@${j.username}`, j.numero), j.capitao)}${foraDoMataMata(j, inscritosAte) ? html` <span class="selo-estreia" title="Chegou depois da Fase de Liga: não joga o Mata-mata">estreia na ${proxima}</span>` : ''}</span>
    <span class="dado" title="Jogos">${j.jogos} j</span>
    <span class="dado" title="Gols">${j.gols} g</span>
    <span class="dado" title="Nota média">${nota(j.notaMedia)}</span>
    <span class="ovr">${j.ovr}</span>
  </a></li>`;
}

/** Ícone do Instagram em traço, na cor do texto. */
function iconeInstagram(): ReturnType<typeof html> {
  return html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`;
}

export const paginaTime: Pagina = async (main, [idTexto]) => {
  const t = (idTexto ?? '').toUpperCase() as TimeId;
  if (!TIMES.includes(t)) {
    main.innerHTML = html`<p class="placa vazio">Esse Time não existe. <a href="#/times">Ver os Times</a>.</p>`.s;
    return;
  }
  const [l, js] = await Promise.all([liga(), jogadores()]);
  const id = IDENTIDADE[t];
  // Perfil do Time (ADR-0100): o Instagram que os Jogadores criaram e a Liga reconheceu.
  const perfil = l.times.find((x) => x.id === t)?.instagram ?? null;
  const elenco = js.filter((j) => j.time === t).sort((a, b) => b.ovr - a.ovr || a.username.localeCompare(b.username));
  const serie = serieDoTime(l, t);
  const tabela = tabelaDaSerie(l, serie);
  const linha = tabela.find((x) => x.time === t);
  const pos = tabela.findIndex((x) => x.time === t) + 1;
  const estreante = !timesAtivos(l).includes(t);
  const jogos = l.calendario.filter((p) => p.mandante === t || p.visitante === t);
  // Mata-mata (ADR-0057): quem se inscreveu depois do último jogo do Time na Fase de Liga estreia na próxima Temporada.
  const inscritosAte = inscritosAteNoProximoJogo(l.calendario, t);
  const novatos = elenco.filter((j) => foraDoMataMata(j, inscritosAte));
  // Com o Plano do Capitão (ADR-0086), a escalação provável sai na Formação escolhida.
  const provavel = (formacao: Formacao | null) =>
    html`<h2 class="secao">Escalação provável <small>${inscritosAte ? 'próximo jogo · Mata-mata' : 'próximo jogo'}${formacao ? ` · ${formacao}` : ''}</small></h2>
      ${campinho(
        escalacaoProvavel(elenco, inscritosAte, formacao).map((x) => ({
          posicao: x.posicao,
          time: t,
          username: x.jogador?.username ?? null,
          apelido: x.jogador?.apelido ?? null,
          ovr: x.ovr ?? OVR_JOGADOR_DA_BASE,
          ...(x.jogador ? { href: `#/jogador/${x.jogador.id}` } : {}),
        })),
      )}`;
  main.innerHTML = html`<article class="pagina-time" style="--cor:${id.primaria};--cor2:${id.secundaria};--sobre:${tintaSobre(id.primaria)}">
    <header class="faixa-time">
      ${escudoImg(t, 5)}
      <div>
        <h1>${id.nome}</h1>
        <p class="bordao">“${FALA_DO_TIME[t].bordao}”</p>
        ${perfil ? html`<p class="perfil-do-time"><a href="https://www.instagram.com/${perfil}/" target="_blank" rel="noopener">${iconeInstagram()}<span>@${perfil.split(/(?<=[._])/).map((parte, i) => (i ? html`<wbr>${parte}` : parte))}</span></a><small>Perfil oficial do Time</small></p>` : ''}
        ${titulosDo(l, t).length
          ? html`<p class="titulos-time">${titulosDo(l, t).map(() => taca(20, 'trofeu'))}<span>${titulosDo(l, t).length === 1 ? 'Campeão' : `${titulosDo(l, t).length} vezes campeão`}: ${titulosDo(l, t).map((n) => `Temporada ${n}`).join(', ')}</span></p>`
          : ''}
        ${linha ? html`<p class="campanha">${temSeries(l) ? `Série ${serie} · ` : ''}${pos}º lugar · ${linha.pontos} pontos · ${linha.vitorias}V ${linha.empates}E ${linha.derrotas}D · saldo ${linha.saldo > 0 ? '+' : ''}${linha.saldo}</p>` : ''}
        ${(formaDosTimes(l).get(t) ?? []).length ? html`<p class="forma-time">Últimos jogos ${formaHtml(formaDosTimes(l).get(t)!)}</p>` : ''}
        ${forcaHtml(forcaProvavel(elenco, inscritosAte))}
        <p class="legenda-forca">Força da escalação provável do próximo jogo (rodízio: entra quem jogou menos${inscritosAte ? '; no Mata-mata, só quem já estava no Elenco na Fase de Liga' : ''}).</p>
        ${estreante ? html`<p class="campanha">Estreia na próxima Temporada, na Série B. Quem comentar ENTRO ${curto(t).toUpperCase()} já entra quando ela começar.</p>` : ''}
      </div>
    </header>
    <div class="time-colunas">${abas(
      'time',
      [
        {
          id: 'escalacao',
          rotulo: 'Escalação',
          conteudo: estreante
            ? ''
            : html`<div data-plano hidden></div><section aria-label="Escalação provável"><div data-provavel>${provavel(null)}</div>
              ${novatos.length
                ? html`<p class="legenda aviso-mata-mata">${novatos.length === 1 ? 'Quem chegou' : `Os ${novatos.length} que chegaram`} depois do último jogo da Fase de Liga não ${novatos.length === 1 ? 'joga' : 'jogam'} o Mata-mata: ${novatos.length === 1 ? 'estreia' : 'estreiam'} na próxima Temporada.</p>`
                : ''}</section>`,
        },
        {
          id: 'elenco',
          rotulo: `Elenco (${elenco.length})`,
          conteudo: html`<section aria-labelledby="titulo-elenco">
        <h2 id="titulo-elenco" class="secao">Elenco <small>${elenco.length} inscritos · ordenado por OVR</small></h2>
        ${elenco.length
          ? POSICOES_EM_ORDEM.map((pos) => {
              const da = elenco.filter((j) => j.posicao === pos);
              return html`<div class="grupo-posicao"><h3>${NOME_DA_POSICAO[pos]}s <small>${da.length}</small></h3>
                ${da.length ? html`<ul class="elenco">${da.map((j) => linhaDoElenco(j, inscritosAte, l.temporada ? `T${l.temporada.numero + 1}` : undefined))}</ul>` : html`<p class="vazio-pequeno">Ninguém ainda: a Base completa a vaga.</p>`}</div>`;
            })
          : html`<p class="placa vazio">Ninguém inscrito ainda. Comente <span class="comando pequeno">ENTRO ${curto(t).toUpperCase()} ATACANTE</span> para ser o primeiro.</p>`}
      </section>`,
        },
        {
          id: 'jogos',
          rotulo: 'Jogos',
          conteudo: html`<section aria-labelledby="titulo-jogos-time">
        <h2 id="titulo-jogos-time" class="secao">Jogos</h2>
        <ul class="lista-partidas">${jogos.map((p) => linhaDePartida(p, { comDia: true }))}</ul>
      </section>`,
        },
        { id: 'trofeus', rotulo: 'Troféus', conteudo: salaDoTime(l, t) },
      ],
      estreante ? 'elenco' : 'escalacao',
    )}</div>
  </article>`.s;

  // Plano do Capitão (ADR-0086): só para quem tem Vínculo com um Jogador deste Time.
  const vinculado = jogadorVinculado();
  if (estreante || !vinculado || !elenco.some((j) => j.id === vinculado)) return;
  const pagina = main.querySelector('.pagina-time');
  // O último plano visto aparece na hora; a resposta da borda confere e só redesenha se mudou (ADR-0094).
  let mostrado: string | null = null;
  const mostrar = (r: { jogadorId: string; capitania: Capitania } | null) => {
    const lugar = main.querySelector<HTMLElement>('[data-plano]');
    if (!r || r.jogadorId !== vinculado || !lugar || !pagina?.isConnected) return;
    const chave = JSON.stringify(r.capitania);
    if (chave === mostrado) return;
    mostrado = chave;
    const aberto = lugar.querySelector<HTMLDetailsElement>('.escolhas-no-time')?.open ?? false;
    lugar.outerHTML = html`<div data-plano>${blocoDoPlano(r.capitania, r.jogadorId, new Date(), curto(t))}</div>`.s;
    const prov = main.querySelector<HTMLElement>('[data-provavel]');
    if (prov) prov.innerHTML = provavel(planoDaCapitania(r.capitania).formacao).s;
    // O Capitão também escolhe aqui (ADR-0091): Postura, Formação e Batedores.
    const novo = main.querySelector<HTMLElement>('[data-plano]');
    const dobra = novo?.querySelector<HTMLDetailsElement>('.escolhas-no-time');
    if (dobra) dobra.open = aberto;
    for (const form of novo?.querySelectorAll<HTMLFormElement>('form.escolha-t2') ?? []) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const estado = form.querySelector<HTMLElement>('.estado-escolha')!;
        estado.textContent = 'Enviando...';
        estado.className = 'estado-escolha';
        void enviarEscolhaDoVinculo(form.dataset.tipo as 'POSTURA' | 'FORMACAO' | 'BATEDORES', valorDoFormulario(form)).then((res) => {
          if (res.aplicada) {
            mostrado = null;
            mostrar(capitaniaGuardada());
            const depois = main.querySelector<HTMLElement>(`[data-plano] form[data-tipo="${form.dataset.tipo}"] .estado-escolha`);
            if (depois) {
              depois.textContent = res.mensagem;
              depois.className = 'estado-escolha sucesso';
            }
            return;
          }
          estado.textContent = res.mensagem;
          estado.className = `estado-escolha ${res.ok ? '' : 'erro'}`;
        });
      });
    }
  };
  mostrar(capitaniaGuardada());
  void capitaniaDoVinculo().then(mostrar);
};
