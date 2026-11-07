/**
 * Chaveamento do Mata-mata: Semifinais (1º × 4º, 2º × 3º) levando à Final e ao campeão.
 * Antes das Semifinais existirem, mostra quem estaria lá se a Fase de Liga acabasse hoje.
 */
import { etapaDa, type LigaPublica, type PartidaNoCalendario, type TimeId } from '@liga/shared';
import { dia, hora, situacaoAgora } from '../dados.js';
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

export function chaveamento(l: LigaPublica, o: { titulo?: boolean } = {}): Html {
  const mm = l.calendario.filter((p) => p.fase === 'MATA_MATA');
  const semis = mm.filter((p) => etapaDa(p.fase, p.rodada) === 'SEMIFINAL').sort((a, b) => a.apito.localeCompare(b.apito));
  const final = mm.find((p) => etapaDa(p.fase, p.rodada) === 'FINAL');
  const ordem = l.tabela.map((x) => x.time);
  const semente = (t: TimeId) => (ordem.indexOf(t) >= 0 ? `${ordem.indexOf(t) + 1}º` : null);
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
  const t = (i: number) => (ordem[i] ?? null) as TimeId | null;
  const [a1, b1] = vagasDe(s1, s1?.mandante ?? t(0), s1?.visitante ?? t(3), ['1º colocado', '4º colocado']);
  const [a2, b2] = vagasDe(s2, s2?.mandante ?? t(1), s2?.visitante ?? t(2), ['2º colocado', '3º colocado']);
  const v1 = encerrou(s1) ? s1!.classificado! : null;
  const v2 = encerrou(s2) ? s2!.classificado! : null;
  const [fa, fb] = vagasDe(final, final?.mandante ?? v1, final?.visitante ?? v2, ['Vencedor da Semi 1', 'Vencedor da Semi 2']);
  const campeao = encerrou(final) ? final!.classificado! : null;
  const ligaCorrendo = l.tabela.some((x) => x.jogos > 0) && projetado;

  return html`<section class="chave-bloco" aria-labelledby="titulo-chave">
    ${o.titulo === false ? '' : html`<h2 id="titulo-chave" class="secao">Mata-mata ${ligaCorrendo ? html`<small>se a Fase de Liga acabasse hoje</small>` : ''}</h2>`}
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
          ${campeao ? html`<a href="#/time/${campeao}">${escudoImg(campeao, 2)}<span>${curto(campeao)}</span></a>` : html`<span class="trofeu-espera">Campeão</span>`}
          ${campeao ? html`<span class="trofeu-espera">Campeão</span>` : ''}
        </div>
      </div>
    </div>
  </section>`;
}
