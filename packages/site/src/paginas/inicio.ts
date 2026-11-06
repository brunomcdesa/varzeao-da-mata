/** Início: a Partida da vez (ao vivo ou a próxima), a Rodada, a votação do Craque e a tabela. */
import type { LigaPublica, PartidaNoCalendario } from '@liga/shared';
import { contagem, diaLongo, hora, liga, partida, partidasDaRodada, rodadaAtual, situacaoAgora } from '../dados.js';
import { montarTimeline, transmitir } from '../transmissao.js';
import { bonecoImg, curto, escudoImg, html, jogadorLink, nota, rotuloClassico, type Html } from '../ui.js';
import { chamadaDeVoto, comoEntrar, linhaDePartida, perfil, tabelaDeClassificacao } from './comum.js';
import type { Pagina } from './tipos.js';

/** A Partida que merece a tábua: a que está rolando, senão a próxima. */
function partidaDaVez(l: LigaPublica): PartidaNoCalendario | null {
  return (
    l.calendario.find((p) => situacaoAgora(p.apito) === 'AO_VIVO') ??
    l.calendario.find((p) => situacaoAgora(p.apito) === 'AGENDADA') ??
    null
  );
}

function tabua(p: PartidaNoCalendario): Html {
  const s = situacaoAgora(p.apito);
  const classico = rotuloClassico(p.mandante, p.visitante);
  return html`<section class="tabua ${s === 'AO_VIVO' ? 'rolando' : ''}" aria-labelledby="titulo-tabua">
    <h2 id="titulo-tabua" class="tabua-titulo">${s === 'AO_VIVO' ? 'Rolando agora' : `Próximo jogo ${contagem(p.apito)}`}</h2>
    <div class="tabua-confronto">
      <a class="tabua-time" href="#/time/${p.mandante}">${escudoImg(p.mandante, 4)}<span>${curto(p.mandante)}</span></a>
      <div class="tabua-meio">
        <span class="tabua-hora">${hora(p.apito)}</span>
        ${classico ? html`<span class="classico-nome">${classico}</span>` : html`<span class="rodada-n">Rodada ${p.rodada}</span>`}
      </div>
      <a class="tabua-time" href="#/time/${p.visitante}">${escudoImg(p.visitante, 4)}<span>${curto(p.visitante)}</span></a>
    </div>
    <div class="tabua-transmissao" hidden>
      <canvas width="540" height="960" aria-label="Transmissão ao vivo"></canvas>
    </div>
    <p class="tabua-acao"><a class="botao" href="#/partida/${p.id}">${
      s === 'AO_VIVO' ? 'Assistir em tela cheia' : p.escalada ? 'Ver as escalações' : 'Escalações saem 30 min antes'
    }</a></p>
  </section>`;
}

function votacao(l: LigaPublica): Html {
  // Rodada com Candidatos e sem Craque: votação aberta. Senão, mostra o último Craque.
  const aberta = [...l.rodadas].reverse().find((r) => r.candidatos.length && !r.craque);
  const ultimoCraque = [...l.rodadas].reverse().find((r) => r.craque);
  if (aberta) {
    return html`<section class="placa votacao" aria-labelledby="titulo-votacao">
      <h2 id="titulo-votacao">Craque da Rodada ${aberta.numero}</h2>
      <p>Vote comentando no post do Resumo da Rodada no ${perfil()}. Vale o último voto de cada perfil; o resultado sai no primeiro jogo do dia seguinte.</p>
      <ol class="candidatos">${aberta.candidatos.map(
        (c) => html`<li>
          ${bonecoImg(c.time, c.posicao, c.username, 3)}
          <span class="quem">${jogadorLink(c.jogadorId, c.username)}<small>${curto(c.time)} · nota ${nota(c.nota)}</small></span>
          ${chamadaDeVoto(c.username)}
        </li>`,
      )}</ol>
    </section>`;
  }
  if (ultimoCraque?.craque) {
    const c = ultimoCraque.craque;
    const cand = ultimoCraque.candidatos.find((x) => x.jogadorId === c.jogadorId);
    return html`<section class="placa votacao" aria-labelledby="titulo-votacao">
      <h2 id="titulo-votacao">Craque da Rodada ${ultimoCraque.numero}</h2>
      <p class="craque">${cand ? bonecoImg(c.time, cand.posicao, c.username, 5, 'FRENTE_COMEMORA') : ''}
        <span>${jogadorLink(c.jogadorId, c.username)}<small>${curto(c.time)}, escolhido pelos seguidores</small></span></p>
    </section>`;
  }
  return html``;
}

export const inicio: Pagina = async (main) => {
  const l = await liga(true);
  const daVez = partidaDaVez(l);
  const n = rodadaAtual(l);
  const jogos = n ? partidasDaRodada(l, n) : [];
  main.innerHTML = html`
    <div class="inicio">
      <div class="coluna-principal">
        ${daVez ? tabua(daVez) : html`<section class="tabua"><h2 class="tabua-titulo">Temporada encerrada</h2><p>Logo tem mais. Acompanhe no ${perfil()}.</p></section>`}
        ${jogos.length
          ? html`<section aria-labelledby="titulo-rodada">
              <h2 id="titulo-rodada" class="secao">Rodada ${n} <small>${diaLongo(jogos[0]!.apito)}</small></h2>
              <ul class="lista-partidas">${jogos.map((p) => linhaDePartida(p))}</ul>
            </section>`
          : ''}
        ${votacao(l)}
      </div>
      <aside class="coluna-lado">
        <section aria-labelledby="titulo-tabela"><h2 id="titulo-tabela" class="secao">Tabela</h2>${tabelaDeClassificacao(l.tabela, { compacta: true })}</section>
        ${comoEntrar(l)}
      </aside>
    </div>`.s;

  // Ao vivo: a tábua vira a transmissão.
  let parar = () => {};
  if (daVez && situacaoAgora(daVez.apito) === 'AO_VIVO') {
    const p = await partida(daVez.id, true);
    const timeline = p && montarTimeline(p);
    const caixa = main.querySelector<HTMLElement>('.tabua-transmissao');
    if (p && timeline && caixa) {
      caixa.hidden = false;
      main.querySelector('.tabua-confronto')?.classList.add('escondido-telinha');
      parar = transmitir(caixa, p, timeline, { aoVivo: true, aoAcabar: () => setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 4000) }).parar;
    }
  }
  // Recarrega quando a próxima Partida começa.
  const proxima = daVez && situacaoAgora(daVez.apito) === 'AGENDADA' ? Date.parse(daVez.apito) - Date.now() : null;
  const relogio = proxima !== null && proxima < 2 ** 31 - 1 ? setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), proxima + 500) : 0;
  return () => {
    parar();
    clearTimeout(relogio);
  };
};
