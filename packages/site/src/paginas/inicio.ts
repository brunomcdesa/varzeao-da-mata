/** Início: a Partida da vez (ao vivo ou a próxima), a Rodada, a votação do Craque e a tabela. */
import { IDENTIDADE, duracaoAoVivoMs, nomeDaRodada, type LigaPublica, type PartidaNoCalendario, type Posicao, type Serie, type TimeId } from '@liga/shared';
import { contagem, diaLongo, hora, liga, partida, partidasDaRodada, rodadaAtual, serieDaPartida, seriesDaLiga, situacaoAgora, tabelaDaSerie, temSeries } from '../dados.js';
import { montarTimeline, transmitir } from '../transmissao.js';
import { bonecoImg, curto, escudoImg, html, jogadorLink, nota, rotuloClassico, type Html } from '../ui.js';
import { chamadaDeVoto, comoEntrar, linhaDePartida, perfil, tabelaDeClassificacao } from './comum.js';
import { arrobaVinculado, votar, votoGuardado, votoNoSiteDisponivel } from '../voto.js';
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
      ${l.campeaoB ? html`<p class="destaque-nota">Na Série B, deu <a href="#/time/${l.campeaoB}">${curto(l.campeaoB)}</a>.</p>` : ''}
    </div>`;
  }
  if (!p) {
    return html`<div class="destaque"><p class="destaque-rotulo">Temporada encerrada</p><p class="destaque-nota">A próxima começa em breve. Acompanhe no ${perfil()}.</p></div>`;
  }
  const s = situacaoAgora(p);
  const classico = rotuloClassico(p.mandante, p.visitante);
  // Com Série B, há outra Partida no mesmo horário (ADR-0017): fica um atalho para ela.
  const outra = temSeries(l) ? l.calendario.find((x) => x.id !== p.id && x.apito === p.apito) : undefined;
  return html`<div class="destaque ${s === 'AO_VIVO' ? 'rolando' : ''}">
    <p class="destaque-rotulo">${s === 'AO_VIVO' ? 'Rolando agora' : `Próximo jogo ${contagem(p.apito)}`}${temSeries(l) ? ` · Série ${serieDaPartida(p)}` : ''}</p>
    <div class="destaque-confronto">
      <a class="destaque-time" href="#/time/${p.mandante}">${escudoImg(p.mandante, 4)}<span>${curto(p.mandante)}</span></a>
      <span class="destaque-hora">${hora(p.apito)}</span>
      <a class="destaque-time" href="#/time/${p.visitante}">${escudoImg(p.visitante, 4)}<span>${curto(p.visitante)}</span></a>
    </div>
    <div class="destaque-transmissao" hidden><canvas width="540" height="960" aria-label="Transmissão ao vivo"></canvas></div>
    ${classico ? html`<span class="classico-nome">${classico}</span>` : ''}
    <a class="botao" href="#/partida/${p.id}">${s === 'AO_VIVO' ? 'Assistir em tela cheia' : p.escalada ? 'Ver as escalações' : 'Ver o jogo'}</a>
    ${s === 'AGENDADA' && !p.escalada ? html`<p class="destaque-nota">As escalações saem 30 minutos antes do apito.</p>` : ''}
    ${outra
      ? html`<a class="destaque-outra" href="#/partida/${outra.id}">${s === 'AO_VIVO' ? 'Também agora' : 'No mesmo horário'}, na Série ${serieDaPartida(outra)}: ${escudoImg(outra.mandante, 1)} ${curto(outra.mandante)} × ${curto(outra.visitante)} ${escudoImg(outra.visitante, 1)}</a>`
      : ''}
  </div>`;
}

function figurinha(titulo: string, c: { jogadorId: string; username: string; apelido?: string | null; time: TimeId; posicao?: Posicao }, info: string, id = 'titulo-votacao'): Html {
  return html`<section class="placa votacao" aria-labelledby="${id}">
    <h2 id="${id}">${titulo}</h2>
    <a class="craque" href="#/jogador/${c.jogadorId}">
      <span class="craque-boneco">${c.posicao ? bonecoImg(c.time, c.posicao, c.username, 7, 'FRENTE_COMEMORA') : ''}</span>
      <span class="craque-nome">${c.apelido || `@${c.username}`}</span>
      <span class="craque-info">${info}</span>
    </a>
  </section>`;
}

/** O que se comenta para votar num Candidato: "3", ou "A3"/"B3" com duas Séries. */
const rotuloDe = (c: { numero: number; rotulo?: string }) => c.rotulo ?? String(c.numero);

function votacao(l: LigaPublica): Html {
  const comSeries = temSeries(l);
  const daSerie = (s: Serie) => (comSeries ? ` · Série ${s}` : '');
  // Rodada com Candidatos e sem Craque: votação aberta. Na Final, a votação é a Craque da
  // Temporada, que fica aberta até o anúncio. Senão, mostra o último Craque.
  if (l.craqueDaTemporada) {
    const a = figurinha(`Craque da Temporada ${l.temporada?.numero ?? ''}${daSerie('A')}`, l.craqueDaTemporada, `${curto(l.craqueDaTemporada.time)}, eleito pelos seguidores`);
    const b = comSeries && l.craqueDaTemporadaB ? figurinha(`Craque da Temporada ${l.temporada?.numero ?? ''}${daSerie('B')}`, l.craqueDaTemporadaB, `${curto(l.craqueDaTemporadaB.time)}, eleito pelos seguidores`, 'titulo-votacao-b') : '';
    return html`${a}${b}`;
  }
  const aberta = [...l.rodadas].reverse().find((r) => r.candidatos.length && !r.craque && !r.craqueB);
  const ultimoCraque = [...l.rodadas].reverse().find((r) => r.craque || r.craqueB);
  if (aberta) {
    const temporada = aberta.votacao === 'TEMPORADA';
    const noSite = votoNoSiteDisponivel();
    // Personagem vinculado (ADR-0013): vota como o @, e pode mudar o voto (vale o último).
    const arroba = arrobaVinculado();
    const series = seriesDaLiga(l).filter((s) => aberta.candidatos.some((c) => (c.serie ?? 'A') === s));
    const meus = series.map((s) => ({ s, numero: votoGuardado(aberta.id, s) })).filter((m) => m.numero !== null);
    const rotuloDoNumero = (n: number) => rotuloDe(aberta.candidatos.find((c) => c.numero === n) ?? { numero: n });
    const comoComentar = comSeries ? 'a letra e o número (A3, B3) do seu escolhido' : 'só o número do seu escolhido';
    return html`<section class="placa votacao" aria-labelledby="titulo-votacao" data-rodada="${aberta.id}">
      <h2 id="titulo-votacao">${temporada ? 'Quem é o Craque da Temporada?' : `Craque ${aberta.fase === 'LIGA' ? `da Rodada ${aberta.numero}` : 'das Semifinais'}`}</h2>
      <p>${
        temporada
          ? html`Os 5 com a maior nota média da Temporada${comSeries ? ', em cada Série' : ''}. ${noSite ? 'Vote aqui ou comente' : 'Comente'} ${comoComentar} no post do Resumo da Final no ${perfil()}, até amanhã às 18h. O resultado sai às 19h.`
          : html`${noSite ? 'Vote aqui ou comente' : 'Comente'} ${comoComentar} no post do Resumo da Rodada no ${perfil()}.${comSeries ? ' Dá para votar uma vez em cada Série.' : ''} O resultado sai no primeiro jogo do dia seguinte.`
      }</p>
      ${series.map((s) => {
        const meu = votoGuardado(aberta.id, s);
        return html`${comSeries ? html`<h3 class="subsecao-serie"><span class="selo-serie serie-${s.toLowerCase()}">Série ${s}</span></h3>` : ''}
        <ol class="candidatos" data-serie="${s}">${aberta.candidatos
          .filter((c) => (c.serie ?? 'A') === s)
          .map(
            (c) => html`<li class="${meu === c.numero ? 'meu-voto' : ''}">
              <span class="numero-voto ${rotuloDe(c).length > 1 ? 'largo' : ''}" aria-hidden="true">${rotuloDe(c)}</span>
              ${bonecoImg(c.time, c.posicao, c.username, 3)}
              <span class="quem">${jogadorLink(c.jogadorId, c.username, c.apelido)}<small>${curto(c.time)} · ${temporada ? 'média' : 'nota'} ${nota(c.nota)}</small></span>
              ${noSite
                ? html`<button type="button" class="botao-voto" data-numero="${c.numero}" data-rotulo="${rotuloDe(c)}" ${meu && !arroba ? 'disabled' : ''} aria-label="Votar no ${rotuloDe(c)}, @${c.username}">${meu === c.numero ? 'Seu voto' : `Votar no ${rotuloDe(c)}`}</button>`
                : chamadaDeVoto(rotuloDe(c))}
            </li>`,
          )}</ol>`;
      })}
      ${noSite
        ? html`<div class="voto-desafio" hidden></div>
            <p class="voto-aviso" role="status" aria-live="polite">${
              arroba
                ? `Votando como @${arroba}: um voto por pessoa${comSeries ? ' em cada Série' : ''}, junto com o do Instagram. Vale o último, então dá para mudar.${meus.length ? ` Seu voto: ${meus.map((m) => rotuloDoNumero(m.numero!)).join(' e ')}.` : ''}`
                : meus.length
                  ? `Você votou no ${meus.map((m) => rotuloDoNumero(m.numero!)).join(' e no ')} por este aparelho. Um voto por aparelho${comSeries ? ' em cada Série' : ''}.`
                  : `Um voto por aparelho${comSeries ? ' em cada Série' : ''} no site. Pelo Instagram, um por perfil${comSeries ? ' em cada Série' : ''}.`
            }</p>`
        : ''}
    </section>`;
  }
  if (ultimoCraque) {
    const nome = `Craque ${ultimoCraque.fase === 'LIGA' ? `da Rodada ${ultimoCraque.numero}` : 'das Semifinais'}`;
    const cartao = (c: NonNullable<typeof ultimoCraque.craque>, s: Serie, id: string) => {
      const cand = ultimoCraque.candidatos.find((x) => x.jogadorId === c.jogadorId);
      return figurinha(`${nome}${daSerie(s)}`, { ...c, ...(cand ? { posicao: cand.posicao } : {}) }, `${curto(c.time)}${cand ? ` · nota ${nota(cand.nota)}` : ''}, escolhido pelos seguidores`, id);
    };
    return html`${ultimoCraque.craque ? cartao(ultimoCraque.craque, 'A', 'titulo-votacao') : ''}${ultimoCraque.craqueB ? cartao(ultimoCraque.craqueB, 'B', 'titulo-votacao-b') : ''}`;
  }
  return html``;
}

function ligarVotacao(main: HTMLElement): void {
  const secao = main.querySelector<HTMLElement>('.votacao[data-rodada]');
  if (!secao) return;
  const rodada = Number(secao.dataset.rodada);
  const aviso = secao.querySelector<HTMLElement>('.voto-aviso');
  const desafio = secao.querySelector<HTMLElement>('.voto-desafio');
  const todos = [...secao.querySelectorAll<HTMLButtonElement>('.botao-voto')];
  // Cada Série é um voto à parte (ADR-0017): votar na A não mexe nos botões da B.
  for (const lista of secao.querySelectorAll<HTMLElement>('.candidatos')) {
    const botoes = [...lista.querySelectorAll<HTMLButtonElement>('.botao-voto')];
    for (const b of botoes) {
      b.addEventListener('click', async () => {
        const numero = Number(b.dataset.numero);
        for (const x of todos) x.disabled = true;
        if (aviso) aviso.textContent = 'Registrando o voto...';
        try {
          const r = await votar(rodada, numero, desafio!);
          if (desafio) desafio.hidden = true;
          const rotulo = botoes.find((x) => Number(x.dataset.numero) === r.numero)?.dataset.rotulo ?? String(r.numero);
          for (const x of botoes) {
            const meu = Number(x.dataset.numero) === r.numero;
            x.textContent = meu ? 'Seu voto' : `Votar no ${x.dataset.rotulo}`;
            x.closest('li')?.classList.toggle('meu-voto', meu);
          }
          const arroba = arrobaVinculado();
          // Libera os botões das outras Séries (e desta, se o voto é do @ e pode mudar).
          for (const x of todos) x.disabled = !arroba && (botoes.includes(x) || x.closest('ol')?.querySelector('.meu-voto') !== null);
          if (aviso) aviso.textContent = arroba ? `Voto de @${arroba} no ${rotulo}. Vale o último: dá para mudar até a votação fechar.` : r.jaVotou ? `Este aparelho já tinha votado no ${rotulo}. Vale o primeiro voto.` : `Voto registrado no ${rotulo}. Valeu!`;
        } catch (e) {
          for (const x of todos) x.disabled = !arrobaVinculado() && x.closest('ol')?.querySelector('.meu-voto') !== null;
          if (aviso) aviso.textContent = (e as Error).message;
        }
      });
    }
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
          ${jogos.length
            ? temSeries(l)
              ? seriesDaLiga(l).map((s: Serie) => {
                  const da = jogos.filter((p) => serieDaPartida(p) === s);
                  return da.length ? html`<h3 class="subsecao-serie"><span class="selo-serie serie-${s.toLowerCase()}">Série ${s}</span></h3><ul class="placas" aria-label="Jogos do dia da Série ${s}">${da.map((p) => linhaDePartida(p, { destaque: p.id === daVez?.id }))}</ul>` : '';
                })
              : html`<ul class="placas" aria-label="Jogos do dia">${jogos.map((p) => linhaDePartida(p, { destaque: p.id === daVez?.id }))}</ul>`
            : ''}
          ${jogos.length && jogos[0]!.fase === 'MATA_MATA' ? html`<p class="tabela-link"><a href="#/jogos">Ver o chaveamento do Mata-mata</a></p>` : ''}
          <section class="quadro-negro tabela-bloco" aria-labelledby="titulo-tabela">
            <h2 id="titulo-tabela">Tabela</h2>
            ${temSeries(l)
              ? seriesDaLiga(l).map((s: Serie) => html`<h3 class="subsecao-serie"><span class="selo-serie serie-${s.toLowerCase()}">Série ${s}</span></h3>${tabelaDeClassificacao(tabelaDaSerie(l, s), { compacta: true, semLegenda: true, serie: s })}`)
              : tabelaDeClassificacao(l.tabela, { compacta: true, semLegenda: true })}
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
      parar = transmitir(caixa, p, timeline, { aoVivo: true }).parar;
    }
  }
  // Recarrega quando a próxima Partida começa, ou quando o Ao Vivo acaba (placar, Card e
  // tabela atualizam na hora: veja completarLiga).
  const sd = daVez && situacaoAgora(daVez);
  const proxima = !daVez ? null : sd === 'AGENDADA' ? Date.parse(daVez.apito) - Date.now() : sd === 'AO_VIVO' ? Date.parse(daVez.apito) + duracaoAoVivoMs(daVez.fase) - Date.now() : null;
  const relogio = proxima !== null && proxima < 2 ** 31 - 1 ? setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), proxima + 500) : 0;
  return () => {
    parar();
    clearTimeout(relogio);
  };
};
