/**
 * Chaveamento do Mata-mata: Semifinais (1º × 4º, 2º × 3º) levando à Final e ao campeão.
 * Antes das Semifinais existirem, mostra quem estaria lá se a Fase de Liga acabasse hoje.
 */
import { NOME_DA_ETAPA_DA_COPA, FASE_DO_CLASSICO, OITAVAS_DE_CLASSICO, etapaDa, nomeDoClassico, semifinaisProjetadas, type EtapaDaCopa, type LigaPublica, type PartidaNoCalendario, type Serie, type TimeId } from '@liga/shared';
import { dia, hora, serieDaPartida, situacaoAgora, tabelaDaSerie, temSeries } from '../dados.js';
import { curto, escudoImg, html, taca, type Html } from '../ui.js';

interface Vaga {
  time: TimeId | null;
  /** "1º", "2º"… da Fase de Liga. */
  semente: string | null;
  gols: number | null;
  /** Gols na disputa de pênaltis, quando houve. */
  penaltis: number | null;
  vence: boolean;
  /** Texto no lugar do Time quando ele ainda não existe ("Vencedor da Semi 1"). */
  espera?: string;
}

function linhaDaVaga(v: Vaga, perdeu: boolean): Html {
  return html`<div class="vaga ${v.vence ? 'vence' : ''} ${perdeu ? 'perde' : ''} ${v.time ? '' : 'vazia'}">
    ${v.time ? escudoImg(v.time, 1) : html`<span class="escudo-vazio" aria-hidden="true"></span>`}
    <span class="vaga-nome">${v.time ? curto(v.time) : (v.espera ?? 'A definir')}</span>
    ${v.semente ? html`<span class="semente" title="Posição na Fase de Liga">${v.semente}</span>` : ''}
    <span class="vaga-gols">${v.gols ?? ''}${v.penaltis !== null ? html`<small title="Pênaltis">(${v.penaltis})</small>` : ''}</span>
  </div>`;
}

function jogo(o: { titulo: string; p?: PartidaNoCalendario; a: Vaga; b: Vaga; nota?: string; projetado?: boolean }): Html {
  const s = o.p ? situacaoAgora(o.p) : null;
  const acabou = s === 'ENCERRADA' && !!o.p?.placar;
  const pen = acabou && o.p!.placar!.penaltis && o.p!.classificado ? `${curto(o.p!.classificado)} nos pênaltis` : '';
  const corpo = html`
    <span class="jogo-titulo">${o.titulo}</span>
    ${linhaDaVaga(o.a, acabou && !o.a.vence)}
    ${linhaDaVaga(o.b, acabou && !o.b.vence)}
    <span class="jogo-rodape">${
      s === 'AO_VIVO' ? html`<span class="ao-vivo-selo">Ao vivo</span>` : acabou ? pen || o.nota || '' : o.p ? `${dia(o.p.apito)}, ${hora(o.p.apito)}` : (o.nota ?? '')
    }</span>`;
  return o.p
    ? html`<a class="jogo ${o.projetado ? 'projetado' : ''}" href="#/partida/${o.p.id}">${corpo}</a>`
    : html`<div class="jogo ${o.projetado ? 'projetado' : ''}">${corpo}</div>`;
}

/** Chaveamento de uma Série (sem Série B, o da Liga inteira). */
export function chaveamento(l: LigaPublica, o: { titulo?: boolean; serie?: Serie } = {}): Html {
  const serie = o.serie ?? 'A';
  const comSeries = temSeries(l);
  // A Copa (ADR-0088) tem chave própria (chaveDaCopa).
  const mm = l.calendario.filter((p) => p.fase === 'MATA_MATA' && !p.copa && serieDaPartida(p) === serie);
  const semis = mm.filter((p) => etapaDa(p.fase, p.rodada) === 'SEMIFINAL').sort((a, b) => a.apito.localeCompare(b.apito));
  const final = mm.find((p) => etapaDa(p.fase, p.rodada) === 'FINAL');
  const tabela = tabelaDaSerie(l, serie);
  // Com Grupos (T2, ADR-0064), as Semifinais cruzam os Grupos, e a posição é a do Grupo.
  const grupos = serie === 'A' && !comSeries && l.grupos?.length ? l.grupos : null;
  const projecao = semifinaisProjetadas(tabela, grupos);
  const sementes = new Map(projecao.flat().filter((v) => v.time).map((v) => [v.time!, v.semente]));
  const ordem = tabela.map((x) => x.time);
  const semente = (t: TimeId) => sementes.get(t) ?? (!grupos && ordem.indexOf(t) >= 0 ? `${ordem.indexOf(t) + 1}º` : null);
  const projetado = semis.length === 0;
  const encerrou = (p?: PartidaNoCalendario) => !!p && situacaoAgora(p) === 'ENCERRADA' && !!p.placar;

  const vagasDe = (p: PartidaNoCalendario | undefined, a: TimeId | null, b: TimeId | null, espera: [string, string]): [Vaga, Vaga] => {
    const fim = encerrou(p);
    const g = (lado: 'mandante' | 'visitante') => (fim ? p!.placar![lado] : null);
    const pen = (lado: 'mandante' | 'visitante') => (fim && p!.placar!.penaltis ? p!.placar!.penaltis[lado] : null);
    return [
      { time: a, semente: a ? semente(a) : null, gols: g('mandante'), penaltis: pen('mandante'), vence: fim && p!.classificado === a, espera: espera[0] },
      { time: b, semente: b ? semente(b) : null, gols: g('visitante'), penaltis: pen('visitante'), vence: fim && p!.classificado === b, espera: espera[1] },
    ];
  };

  const [s1, s2] = semis;
  const [[p1, p4], [p2, p3]] = projecao;
  const [a1, b1] = vagasDe(s1, s1?.mandante ?? p1.time, s1?.visitante ?? p4.time, [p1.espera, p4.espera]);
  const [a2, b2] = vagasDe(s2, s2?.mandante ?? p2.time, s2?.visitante ?? p3.time, [p2.espera, p3.espera]);
  const v1 = encerrou(s1) ? s1!.classificado! : null;
  const v2 = encerrou(s2) ? s2!.classificado! : null;
  const [fa, fb] = vagasDe(final, final?.mandante ?? v1, final?.visitante ?? v2, ['Vencedor da Semi 1', 'Vencedor da Semi 2']);
  const campeao = encerrou(final) ? final!.classificado! : null;
  const ligaCorrendo = (grupos ? grupos.some((g) => g.tabela.some((x) => x.jogos > 0)) : tabela.some((x) => x.jogos > 0)) && projetado;
  const id = `titulo-chave-${serie.toLowerCase()}`;
  const nomeCampeao = comSeries ? `Campeão da Série ${serie}` : 'Campeão';

  return html`<section class="chave-bloco" aria-labelledby="${id}">
    ${o.titulo === false ? '' : html`<h2 id="${id}" class="secao">Mata-mata${comSeries ? ` da Série ${serie}` : ''} ${ligaCorrendo ? html`<small>se a Fase de Liga acabasse hoje</small>` : ''}</h2>`}
    <div class="chave ${projetado ? 'chave-projetada' : ''}">
      <div class="chave-coluna chave-semis">
        ${jogo({ titulo: 'Semifinal 1', ...(s1 ? { p: s1 } : {}), a: a1, b: b1, nota: 'empate vai para os pênaltis', projetado })}
        ${jogo({ titulo: 'Semifinal 2', ...(s2 ? { p: s2 } : {}), a: a2, b: b2, nota: 'empate vai para os pênaltis', projetado })}
      </div>
      <div class="chave-ligacao" aria-hidden="true"><span></span><span></span></div>
      <div class="chave-coluna chave-final">
        ${jogo({ titulo: 'Final', ...(final ? { p: final } : {}), a: fa, b: fb, nota: 'empate vai para os pênaltis', projetado })}
      </div>
      <div class="chave-ligacao chave-ligacao-final" aria-hidden="true"><span></span></div>
      <div class="chave-coluna chave-campeao">
        <div class="trofeu-vaga ${campeao ? 'tem-campeao' : ''}">
          ${taca(40, 'trofeu')}
          ${campeao ? html`<a href="#/time/${campeao}">${escudoImg(campeao, 2)}<span>${curto(campeao)}</span></a>` : html`<span class="trofeu-espera">${nomeCampeao}</span>`}
          ${campeao ? html`<span class="trofeu-espera">${nomeCampeao}</span>` : ''}
        </div>
      </div>
    </div>
  </section>`;
}

/**
 * Chave da Copa A+B (ADR-0088): Oitavas de Clássico, Quartas, Semifinais e Final, com a chave
 * fixa desde o começo (as vagas seguintes esperam o vencedor do jogo anterior). Só aparece na
 * Temporada que tem Copa.
 */
export function chaveDaCopa(l: LigaPublica): Html {
  const copa = l.calendario.filter((p) => p.copa).sort((a, b) => a.apito.localeCompare(b.apito));
  if (!copa.length) return html``;
  const da = (e: EtapaDaCopa) => copa.filter((p) => p.copa === e);
  const encerrou = (p?: PartidaNoCalendario) => !!p && situacaoAgora(p) === 'ENCERRADA' && !!p.placar;
  const vaga = (p: PartidaNoCalendario | undefined, t: TimeId | null, lado: 'mandante' | 'visitante', espera: string): Vaga => {
    const fim = encerrou(p);
    return { time: t, semente: null, gols: fim ? p!.placar![lado] : null, penaltis: fim && p!.placar!.penaltis ? p!.placar!.penaltis[lado] : null, vence: fim && !!t && p!.classificado === t, espera };
  };
  /** Uma etapa: os jogos que já existem, ou as vagas esperando os vencedores da anterior. */
  /**
   * Uma etapa. Sem `rotulos`, cada jogo espera os vencedores de dois jogos da anterior; com eles
   * (Copa de 20, ADR-0093), as vagas esperam o que o texto diz (a ordem sai da campanha anterior).
   */
  const etapa = (e: EtapaDaCopa, n: number, anteriores: (PartidaNoCalendario | undefined)[], rotuloAnterior: string, rotulos?: readonly (readonly [string, string])[]) => {
    const jogos = da(e);
    return Array.from({ length: n }, (_, k) => {
      const p = jogos[k];
      const [ea, eb] = rotulos ? [undefined, undefined] : [anteriores[2 * k], anteriores[2 * k + 1]];
      const espera = (x: PartidaNoCalendario | undefined) => (encerrou(x) ? x!.classificado! : null);
      const ta = p?.mandante ?? espera(ea);
      const tb = p?.visitante ?? espera(eb);
      const titulo = e === 'FINAL' ? 'Final' : `${NOME_DA_ETAPA_DA_COPA[e].split(' ')[0]} ${k + 1}`;
      const [ra, rb] = rotulos?.[k] ?? [`Vencedor ${rotuloAnterior} ${2 * k + 1}`, `Vencedor ${rotuloAnterior} ${2 * k + 2}`];
      return { p, html: jogo({ titulo, ...(p ? { p } : {}), a: vaga(p, ta, 'mandante', ra), b: vaga(p, tb, 'visitante', rb), ...(encerrou(p) ? {} : { nota: 'empate vai para os pênaltis' }) }) };
    });
  };
  const vinte = da('CLASSICO').length > 0;
  const primeira = vinte ? 'CLASSICO' : 'OITAVAS';
  const oitavas = (vinte ? FASE_DO_CLASSICO : OITAVAS_DE_CLASSICO).map(([a, b], k) => {
    const p = da(primeira)[k];
    const nome = nomeDoClassico(a, b);
    return { p, html: jogo({ titulo: nome ?? `Oitavas ${k + 1}`, ...(p ? { p } : {}), a: vaga(p, p?.mandante ?? a, 'mandante', ''), b: vaga(p, p?.visitante ?? b, 'visitante', ''), ...(encerrou(p) ? {} : { nota: 'empate vai para os pênaltis' }) }) };
  });
  // Copa de 20: os 10 que passam do Clássico em ordem de campanha na Temporada anterior.
  const doClassico = (n: number) => `${n}º do Clássico`;
  const repescagem = vinte ? etapa('REPESCAGEM', 2, [], '', [[doClassico(7), doClassico(10)], [doClassico(8), doClassico(9)]]) : [];
  const quartas = vinte
    ? etapa('QUARTAS', 4, [], '', [[doClassico(1), 'Vencedor Rep. 1'], [doClassico(4), doClassico(5)], [doClassico(2), 'Vencedor Rep. 2'], [doClassico(3), doClassico(6)]])
    : etapa('QUARTAS', 4, oitavas.map((x) => x.p), 'Oitavas');
  const semis = etapa('SEMIFINAL', 2, quartas.map((x) => x.p), 'Quartas');
  const final = etapa('FINAL', 1, semis.map((x) => x.p), 'Semi');
  const campeao = encerrou(final[0]!.p) ? final[0]!.p!.classificado! : null;
  const coluna = (titulo: string, jogos: { html: Html }[]) => html`<div class="copa-etapa"><h3>${titulo}</h3><div class="copa-jogos">${jogos.map((j) => j.html)}</div></div>`;
  return html`<section class="chave-bloco chave-copa" aria-labelledby="titulo-copa">
    <h2 id="titulo-copa" class="secao">Copa do Varzeão <small>as duas Séries, jogo único</small></h2>
    ${coluna(vinte ? 'Fase do Clássico' : 'Oitavas de Clássico', oitavas)}
    ${vinte ? coluna('Repescagem', repescagem) : ''}
    ${coluna('Quartas de final', quartas)}
    ${coluna('Semifinais', semis)}
    ${coluna('Final', final)}
    <div class="trofeu-vaga ${campeao ? 'tem-campeao' : ''}">
      ${taca(40, 'trofeu')}
      ${campeao ? html`<a href="#/time/${campeao}">${escudoImg(campeao, 2)}<span>${curto(campeao)}</span></a>` : ''}
      <span class="trofeu-espera">Campeão da Copa</span>
    </div>
  </section>`;
}
