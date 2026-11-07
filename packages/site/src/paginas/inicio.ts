/** Início: a Partida da vez (ao vivo ou a próxima), a Rodada, a votação do Craque e a tabela. */
import { IDENTIDADE, nomeDaRodada, type LigaPublica, type PartidaNoCalendario, type Posicao, type TimeId } from '@liga/shared';
import { contagem, diaLongo, hora, liga, partida, partidasDaRodada, rodadaAtual, situacaoAgora } from '../dados.js';
import { montarTimeline, transmitir } from '../transmissao.js';
import { bonecoImg, curto, escudoImg, html, jogadorLink, nota, rotuloClassico, type Html } from '../ui.js';
import { chamadaDeVoto, comoEntrar, linhaDePartida, perfil, tabelaDeClassificacao } from './comum.js';
import { votar, votoGuardado, votoNoSiteDisponivel } from '../voto.js';
import type { Pagina } from './tipos.js';

/** A Partida que merece o destaque: a que está rolando, senão a próxima. */
function partidaDaVez(l: LigaPublica): PartidaNoCalendario | null {
  return (
    l.calendario.find((p) => situacaoAgora(p) === 'AO_VIVO') ??
    l.calendario.find((p) => situacaoAgora(p) === 'AGENDADA') ??
    null
  );
}

/** Lado esquerdo do painel: o jogo da vez (confronto ou transmissão) ou o campeão. */
function destaque(l: LigaPublica, p: PartidaNoCalendario | null): Html {
  if (!p && l.campeao) {
    const t = l.campeao;
    const final = l.calendario.find((x) => x.fase === 'MATA_MATA' && x.classificado === t && !x.vantagemDoEmpate) ?? l.calendario.at(-1)!;
    const vice = final.mandante === t ? final.visitante : final.mandante;
    return html`<div class="destaque destaque-campeao">
      <p class="destaque-rotulo">Campeão da Temporada ${l.temporada?.numero ?? ''}</p>
      <a class="campeao-time" href="#/time/${t}">${escudoImg(t, 6)}<span>${IDENTIDADE[t].nome}</span></a>
      <p class="destaque-nota">Venceu a Final contra ${curto(vice)}</p>
      <a class="botao" href="#/time/${t}">Ver o elenco campeão</a>
    </div>`;
  }
  if (!p) {
    return html`<div class="destaque"><p class="destaque-rotulo">Temporada encerrada</p><p class="destaque-nota">A próxima começa em breve. Acompanhe no ${perfil()}.</p></div>`;
  }
  const s = situacaoAgora(p);
  const classico = rotuloClassico(p.mandante, p.visitante);
  return html`<div class="destaque ${s === 'AO_VIVO' ? 'rolando' : ''}">
    <p class="destaque-rotulo">${s === 'AO_VIVO' ? 'Rolando agora' : `Próximo jogo ${contagem(p.apito)}`}</p>
    <div class="destaque-confronto">
      <a class="destaque-time" href="#/time/${p.mandante}">${escudoImg(p.mandante, 4)}<span>${curto(p.mandante)}</span></a>
      <span class="destaque-hora">${hora(p.apito)}</span>
      <a class="destaque-time" href="#/time/${p.visitante}">${escudoImg(p.visitante, 4)}<span>${curto(p.visitante)}</span></a>
    </div>
    <div class="destaque-transmissao" hidden><canvas width="540" height="960" aria-label="Transmissão ao vivo"></canvas></div>
    ${classico ? html`<span class="classico-nome">${classico}</span>` : ''}
    <a class="botao" href="#/partida/${p.id}">${s === 'AO_VIVO' ? 'Assistir em tela cheia' : p.escalada ? 'Ver as escalações' : 'Ver o jogo'}</a>
    ${s === 'AGENDADA' && !p.escalada ? html`<p class="destaque-nota">As escalações saem 30 minutos antes do apito.</p>` : ''}
  </div>`;
}

function figurinha(titulo: string, c: { jogadorId: string; username: string; time: TimeId; posicao?: Posicao }, info: string): Html {
  return html`<section class="placa votacao" aria-labelledby="titulo-votacao">
    <h2 id="titulo-votacao">${titulo}</h2>
    <a class="craque" href="#/jogador/${c.jogadorId}">
      <span class="craque-boneco">${c.posicao ? bonecoImg(c.time, c.posicao, c.username, 7, 'FRENTE_COMEMORA') : ''}</span>
      <span class="craque-nome">@${c.username}</span>
      <span class="craque-info">${info}</span>
    </a>
  </section>`;
}

function votacao(l: LigaPublica): Html {
  // Rodada com Candidatos e sem Craque: votação aberta. Na Final, a votação é a Craque da
  // Temporada, que fica aberta até o anúncio. Senão, mostra o último Craque.
  if (l.craqueDaTemporada) {
    return figurinha(`Craque da Temporada ${l.temporada?.numero ?? ''}`, l.craqueDaTemporada, `${curto(l.craqueDaTemporada.time)}, eleito pelos seguidores`);
  }
  const aberta = [...l.rodadas].reverse().find((r) => r.candidatos.length && !r.craque);
  const ultimoCraque = [...l.rodadas].reverse().find((r) => r.craque);
  if (aberta) {
    const temporada = aberta.votacao === 'TEMPORADA';
    const noSite = votoNoSiteDisponivel();
    const meu = votoGuardado(aberta.id);
    return html`<section class="placa votacao" aria-labelledby="titulo-votacao" data-rodada="${aberta.id}">
      <h2 id="titulo-votacao">${temporada ? 'Quem é o Craque da Temporada?' : `Craque ${aberta.fase === 'LIGA' ? `da Rodada ${aberta.numero}` : 'das Semifinais'}`}</h2>
      <p>${
        temporada
          ? html`Os 5 com a maior nota média da Temporada. ${noSite ? 'Vote aqui ou comente' : 'Comente'} só o número do seu escolhido no post do Resumo da Final no ${perfil()}, até amanhã às 18h. O resultado sai às 19h.`
          : html`${noSite ? 'Vote aqui ou comente' : 'Comente'} só o número do seu escolhido no post do Resumo da Rodada no ${perfil()}. O resultado sai no primeiro jogo do dia seguinte.`
      }</p>
      <ol class="candidatos">${aberta.candidatos.map(
        (c) => html`<li class="${meu === c.numero ? 'meu-voto' : ''}">
          <span class="numero-voto" aria-hidden="true">${c.numero}</span>
          ${bonecoImg(c.time, c.posicao, c.username, 3)}
          <span class="quem">${jogadorLink(c.jogadorId, c.username)}<small>${curto(c.time)} · ${temporada ? 'média' : 'nota'} ${nota(c.nota)}</small></span>
          ${noSite
            ? html`<button type="button" class="botao-voto" data-numero="${c.numero}" ${meu ? 'disabled' : ''} aria-label="Votar no número ${c.numero}, @${c.username}">${meu === c.numero ? 'Seu voto' : `Votar no ${c.numero}`}</button>`
            : chamadaDeVoto(c.numero)}
        </li>`,
      )}</ol>
      ${noSite
        ? html`<div class="voto-desafio" hidden></div>
            <p class="voto-aviso" role="status" aria-live="polite">${meu ? `Você votou no ${meu} por este aparelho. Um voto por aparelho.` : 'Um voto por aparelho no site. Pelo Instagram, um por perfil.'}</p>`
        : ''}
    </section>`;
  }
  if (ultimoCraque?.craque) {
    const c = ultimoCraque.craque;
    const cand = ultimoCraque.candidatos.find((x) => x.jogadorId === c.jogadorId);
    return figurinha(
      `Craque ${ultimoCraque.fase === 'LIGA' ? `da Rodada ${ultimoCraque.numero}` : 'das Semifinais'}`,
      { ...c, ...(cand ? { posicao: cand.posicao } : {}) },
      `${curto(c.time)}${cand ? ` · nota ${nota(cand.nota)}` : ''}, escolhido pelos seguidores`,
    );
  }
  return html``;
}

function ligarVotacao(main: HTMLElement): void {
  const secao = main.querySelector<HTMLElement>('.votacao[data-rodada]');
  if (!secao) return;
  const rodada = Number(secao.dataset.rodada);
  const aviso = secao.querySelector<HTMLElement>('.voto-aviso');
  const desafio = secao.querySelector<HTMLElement>('.voto-desafio');
  const botoes = [...secao.querySelectorAll<HTMLButtonElement>('.botao-voto')];
  for (const b of botoes) {
    b.addEventListener('click', async () => {
      const numero = Number(b.dataset.numero);
      for (const x of botoes) x.disabled = true;
      if (aviso) aviso.textContent = 'Registrando o voto...';
      try {
        const r = await votar(rodada, numero, desafio!);
        if (desafio) desafio.hidden = true;
        for (const x of botoes) {
          const meu = Number(x.dataset.numero) === r.numero;
          x.textContent = meu ? 'Seu voto' : `Votar no ${x.dataset.numero}`;
          x.closest('li')?.classList.toggle('meu-voto', meu);
        }
        if (aviso) aviso.textContent = r.jaVotou ? `Este aparelho já tinha votado no ${r.numero}. Vale o primeiro voto.` : `Voto registrado no ${r.numero}. Valeu!`;
      } catch (e) {
        for (const x of botoes) x.disabled = false;
        if (aviso) aviso.textContent = (e as Error).message;
      }
    });
  }
}

export const inicio: Pagina = async (main) => {
  const l = await liga(true);
  const daVez = partidaDaVez(l);
  const n = rodadaAtual(l);
  const jogos = n ? partidasDaRodada(l, n) : [];
  const titulo = jogos.length ? nomeDaRodada(jogos[0]!.fase, n!) : `Temporada ${l.temporada?.numero ?? ''}`;
  const novaTemporada = l.proximaTemporada;
  main.innerHTML = html`
    ${novaTemporada
      ? html`<p class="placa aviso-temporada"><strong>Temporada ${novaTemporada.numero} começa ${new Date(`${novaTemporada.inicio}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}.</strong> Inscrições abertas: comente ENTRO + time + posição em qualquer post do ${perfil()}.</p>`
      : ''}
    <section class="painel" aria-labelledby="titulo-painel">
      <header class="painel-cabeca">
        <h1 id="titulo-painel">${titulo}</h1>
        ${jogos.length ? html`<p>${diaLongo(jogos[0]!.apito)}</p>` : ''}
      </header>
      <div class="painel-corpo">
        ${destaque(l, daVez)}
        <div class="painel-lado">
          ${jogos.length ? html`<ul class="placas" aria-label="Jogos do dia">${jogos.map((p) => linhaDePartida(p, { destaque: p.id === daVez?.id }))}</ul>` : ''}
          ${jogos.length && jogos[0]!.fase === 'MATA_MATA' ? html`<p class="tabela-link"><a href="#/jogos">Ver o chaveamento do Mata-mata</a></p>` : ''}
          <section class="quadro-negro tabela-bloco" aria-labelledby="titulo-tabela">
            <h2 id="titulo-tabela">Tabela</h2>
            ${tabelaDeClassificacao(l.tabela, { compacta: true, semLegenda: true })}
            <p class="tabela-link"><a href="#/tabela">Tabela completa e critérios</a></p>
          </section>
        </div>
      </div>
    </section>
    <div class="inicio-grade">
      ${votacao(l)}
      ${comoEntrar(l)}
    </div>`.s;

  ligarVotacao(main);

  // Ao vivo: a tábua vira a transmissão.
  let parar = () => {};
  if (daVez && situacaoAgora(daVez) === 'AO_VIVO') {
    const p = await partida(daVez.id, true);
    const timeline = p && montarTimeline(p);
    const caixa = main.querySelector<HTMLElement>('.destaque-transmissao');
    if (p && timeline && caixa) {
      caixa.hidden = false;
      main.querySelector('.destaque-confronto')?.setAttribute('hidden', '');
      parar = transmitir(caixa, p, timeline, { aoVivo: true, aoAcabar: () => setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 4000) }).parar;
    }
  }
  // Recarrega quando a próxima Partida começa.
  const proxima = daVez && situacaoAgora(daVez) === 'AGENDADA' ? Date.parse(daVez.apito) - Date.now() : null;
  const relogio = proxima !== null && proxima < 2 ** 31 - 1 ? setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), proxima + 500) : 0;
  return () => {
    parar();
    clearTimeout(relogio);
  };
};
