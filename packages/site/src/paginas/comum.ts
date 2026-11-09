/** Blocos usados em várias páginas: linha de Partida, tabela, chamadas para comentar. */
import { TIMES_QUE_TROCAM_DE_SERIE, etapaDa, nomeDaEtapa, type LigaPublica, type LinhaTabelaPublica, type PartidaNoCalendario, type Serie } from '@liga/shared';
import { INSTAGRAM, contagem, diaCurto, hora, situacaoAgora, timesAtivos } from '../dados.js';
import { curto, escudoImg, html, rotuloClassico, type Html } from '../ui.js';

export function linhaDePartida(p: PartidaNoCalendario, o: { comDia?: boolean; destaque?: boolean } = {}): Html {
  const s = situacaoAgora(p);
  const classico = rotuloClassico(p.mandante, p.visitante);
  const placar =
    s === 'ENCERRADA' && p.placar
      ? html`<span class="gols">${p.placar.mandante}</span><span class="x">×</span><span class="gols">${p.placar.visitante}</span>`
      : s === 'AO_VIVO'
        ? html`<span class="ao-vivo-selo">Ao vivo</span>`
        : html`<span class="x">×</span>`;
  const penaltis = s === 'ENCERRADA' && p.placar?.penaltis ? html`<span class="penaltis">pênaltis ${p.placar.penaltis.mandante}–${p.placar.penaltis.visitante}</span>` : '';
  const quando = o.comDia ? html`<span class="data">${diaCurto(p.apito)}</span>${hora(p.apito)}` : html`${hora(p.apito)}`;
  return html`<li>
    <a class="partida-linha situacao-${s.toLowerCase()} ${p.classico ? 'classico' : ''} ${o.destaque ? 'em-destaque' : ''}" href="#/partida/${p.id}" ${o.destaque ? 'aria-current="true"' : ''}>
      <span class="quando">${quando}</span>
      <span class="lado mandante"><span class="nome">${curto(p.mandante)}</span>${escudoImg(p.mandante, 1.5)}</span>
      <span class="placar">${placar}${penaltis}</span>
      <span class="lado visitante">${escudoImg(p.visitante, 1.5)}<span class="nome">${curto(p.visitante)}</span></span>
      <span class="extra">${p.fase === 'MATA_MATA' ? html`<span class="etapa">${nomeDaEtapa(p.fase, p.rodada)}</span>` : ''}${
        p.fase === 'MATA_MATA' && s !== 'ENCERRADA' ? html`<span>empate vai para os pênaltis</span>` : ''
      }${s === 'ENCERRADA' && p.classificado ? html`<span class="avanca">${curto(p.classificado)} ${p.placar?.penaltis ? 'venceu nos pênaltis' : ''}${p.placar?.penaltis ? ', ' : ''}${etapaDa(p.fase, p.rodada) === 'FINAL' ? 'campeão' : 'na final'}</span>` : ''}${classico ? html`<span class="classico-nome">${classico}</span>` : ''}${
        s === 'AGENDADA' ? html`<span class="falta">${p.escalada ? 'Escalação saiu' : contagem(p.apito)}</span>` : ''
      }</span>
    </a>
  </li>`;
}

/**
 * Tabela da Fase de Liga. `serie`: com Série B, a A marca os 2 últimos (Rebaixamento) e a
 * legenda diz a regra de cada Série (ADR-0015).
 */
export function tabelaDeClassificacao(linhas: LinhaTabelaPublica[], o: { compacta?: boolean; destaque?: string; semLegenda?: boolean; serie?: Serie } = {}): Html {
  const caem = o.serie === 'A' ? linhas.length - TIMES_QUE_TROCAM_DE_SERIE : Infinity;
  return html`<table class="classificacao ${o.compacta ? 'compacta' : ''}">
    <thead><tr>
      <th scope="col" class="pos"><span class="sr">Posição</span></th>
      <th scope="col" class="time">Time</th>
      <th scope="col" title="Pontos">P</th>
      <th scope="col" title="Jogos">J</th>
      ${o.compacta ? '' : html`<th scope="col" title="Vitórias">V</th><th scope="col" title="Empates">E</th><th scope="col" title="Derrotas">D</th><th scope="col" title="Gols pró">GP</th><th scope="col" title="Gols contra">GC</th>`}
      <th scope="col" title="Saldo de gols">SG</th>
    </tr></thead>
    <tbody>${linhas.map(
      (l, i) => html`<tr class="${l.time === o.destaque ? 'destaque' : ''} ${i < 4 ? 'classifica' : ''} ${i >= caem ? 'rebaixamento' : ''}">
        <td class="pos">${i + 1}</td>
        <th scope="row" class="time"><a href="#/time/${l.time}">${escudoImg(l.time, 1)}<span>${curto(l.time)}</span></a></th>
        <td class="pontos">${l.pontos}</td>
        <td>${l.jogos}</td>
        ${o.compacta ? '' : html`<td>${l.vitorias}</td><td>${l.empates}</td><td>${l.derrotas}</td><td>${l.golsPro}</td><td>${l.golsContra}</td>`}
        <td>${l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
      </tr>`,
    )}</tbody>
  </table>
  ${o.semLegenda
    ? ''
    : html`<p class="legenda">Os 4 primeiros vão para o Mata-mata (1º × 4º e 2º × 3º); empate no Mata-mata vai para os pênaltis.${
        o.serie === 'A' ? ' Os 2 últimos caem para a Série B.' : o.serie === 'B' ? ' Os 2 finalistas do Mata-mata sobem para a Série A.' : ''
      } Desempate na tabela: vitórias, saldo e gols pró.</p>`}`;
}

const perfil = () => (INSTAGRAM ? html`<a href="https://www.instagram.com/${INSTAGRAM}/" rel="noopener">@${INSTAGRAM}</a>` : html`nosso Instagram`);

export function comoEntrar(l: LigaPublica): Html {
  return html`<section class="placa como-entrar" aria-labelledby="titulo-entrar">
    <h2 id="titulo-entrar">Quer jogar?</h2>
    <p>Comente num post do ${perfil()} o seu Time e a sua posição:</p>
    <p class="comando">ENTRO ONÇA ATACANTE</p>
    <p>Você ganha um OVR entre 60 e 70 e entra na escalação do seu Time no próximo jogo. Joga bem, o OVR sobe.</p>
    <details>
      <summary>Times e apelidos que valem</summary>
      <ul class="times-validos">${timesAtivos(l).map((t) => html`<li>${escudoImg(t, 1)} ${curto(t)}</li>`)}</ul>
      <p>Posições: goleiro, zagueiro, meia ou atacante (GOL, ZAG, MEI, ATA também valem).</p>
    </details>
  </section>`;
}

/** O que se comenta para votar: o número (ADR-0011), ou "A3"/"B3" com duas Séries (ADR-0015). */
export function chamadaDeVoto(rotulo: string | number): Html {
  return html`<span class="comando pequeno">${rotulo}</span>`;
}

export { perfil };
