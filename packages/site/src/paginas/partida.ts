/** Partida: escalações a partir do Corte, transmissão ao vivo ou replay, lances e Notas. */
import { IDENTIDADE, duracaoAoVivoMs, nomeDaEtapa, type EscalacaoPublica, type PartidaPublica } from '@liga/shared';
import type { Desempenho, Lado, ResultadoPartida, SlotRef } from '@liga/sim';
import { contagem, diaLongo, hora, jogadores, partida, situacaoAgora } from '../dados.js';
import { DURACAO_JOGO, resultadoDaCobranca } from '@liga/renderer';
import { montarTimeline, transmitir } from '../transmissao.js';
import { bonecoImg, curto, escudoImg, html, jogadorLink, nota, NOME_DA_POSICAO, rotuloClassico, type Html, comCamisa } from '../ui.js';
import type { Pagina } from './tipos.js';

const CORTE_MIN = 30;

function escalacao(e: EscalacaoPublica, lado: Lado, r: ResultadoPartida | null, camisas: Map<string, number>): Html {
  const desempenho = (lugar: number): Desempenho | undefined => r?.desempenhos.find((d) => d.slot.lado === lado && d.slot.indice === lugar);
  return html`<section class="escalacao placa" aria-labelledby="esc-${lado}">
    <h3 id="esc-${lado}">${escudoImg(e.time, 1.5)} ${curto(e.time)}</h3>
    <ol>${[...e.jogadores]
      .sort((a, b) => a.lugar - b.lugar)
      .map((j) => {
        const d = desempenho(j.lugar);
        const delta = d ? d.ovrDepois - d.ovrAntes : 0;
        return html`<li>
          ${bonecoImg(e.time, j.posicao, j.username, 2)}
          <span class="pos" title="${NOME_DA_POSICAO[j.posicao]}">${j.posicao}</span>
          <span class="quem">${comCamisa(jogadorLink(j.jogadorId, j.username), j.jogadorId ? camisas.get(j.jogadorId) : null)}</span>
          ${d && (d.gols || d.assistencias) ? html`<span class="feitos">${'●'.repeat(d.gols)}${d.assistencias ? html`<small>+${d.assistencias} assist.</small>` : ''}</span>` : html`<span class="feitos"></span>`}
          <span class="ovr" title="OVR antes do jogo">${j.ovr}${d && delta ? html`<small class="${delta > 0 ? 'sobe' : 'desce'}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</small>` : ''}</span>
          ${d ? html`<span class="nota-chip" title="Nota da Partida">${nota(d.nota)}</span>` : ''}
        </li>`;
      })}</ol>
  </section>`;
}

function textoDoLance(r: ResultadoPartida, nomes: Record<Lado, (string | null)[]>, i: number): string {
  const l = r.lances[i]!;
  const n = (s: SlotRef | undefined) => (s ? (nomes[s.lado][s.indice] ?? 'a Base') : '');
  const de = (s: SlotRef | undefined) => (n(s) === 'a Base' ? 'da Base' : `de ${n(s)}`);
  const inicio = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const driblou = l.drible && l.marcador ? `, depois de driblar ${n(l.marcador) === 'a Base' ? 'o zagueiro da Base' : n(l.marcador)}` : '';
  switch (l.tipo) {
    case 'GOL':
      return (n(l.criador) !== n(l.finalizador) || n(l.criador) === 'a Base' ? `Gol ${de(l.finalizador)}, passe ${de(l.criador)}` : `Gol ${de(l.finalizador)}`) + driblou;
    case 'DEFESA':
      return inicio(`${n(l.defensor)} defende o chute ${de(l.finalizador)}`) + driblou;
    case 'FORA':
      return inicio(`${n(l.finalizador)} manda para fora`) + driblou;
    case 'BLOQUEIO':
      return inicio(`${n(l.defensor)} bloqueia o chute ${de(l.finalizador)}`);
    case 'DESARME':
      return l.drible && l.finalizador
        ? inicio(`${n(l.finalizador)} tenta o drible e ${n(l.defensor)} desarma`)
        : inicio(`${n(l.defensor)} desarma ${n(l.criador)}`);
  }
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const ROTULO: Record<string, string> = { GOL: 'Gol', DEFESA: 'Defesa', BLOQUEIO: 'Bloqueio', FORA: 'Fora', DESARME: 'Desarme' };

export const paginaPartida: Pagina = async (main, [idTexto]) => {
  const id = Number(idTexto);
  const [p, todos] = await Promise.all([partida(id, true), jogadores().catch(() => [])]);
  const camisas = new Map(todos.filter((j) => j.numero).map((j) => [j.id, j.numero!]));
  if (!p) {
    main.innerHTML = html`<section class="placa vazio"><h1>Partida não encontrada</h1><p>Ela ainda não foi escalada ou não existe. <a href="#/jogos">Ver todos os jogos</a>.</p></section>`.s;
    return;
  }
  const s = situacaoAgora(p);
  const r = (p.resultado as ResultadoPartida | null) ?? null;
  const timeline = montarTimeline(p);
  const classico = rotuloClassico(p.mandante, p.visitante);
  const nomes: Record<Lado, (string | null)[]> = {
    mandante: [...(p.escalacoes?.mandante.jogadores ?? [])].sort((a, b) => a.lugar - b.lugar).map((j) => (j.username ? `@${j.username}` : null)),
    visitante: [...(p.escalacoes?.visitante.jogadores ?? [])].sort((a, b) => a.lugar - b.lugar).map((j) => (j.username ? `@${j.username}` : null)),
  };
  const mostrarFinal = s === 'ENCERRADA' && r;
  const placar = mostrarFinal
    ? html`<span class="gols">${r.gols.mandante}</span><span class="x">×</span><span class="gols">${r.gols.visitante}</span>`
    : s === 'AO_VIVO' && timeline
      ? html`<span class="gols" data-placar="mandante">0</span><span class="x">×</span><span class="gols" data-placar="visitante">0</span>`
      : html`<span class="x">×</span>`;

  main.innerHTML = html`
    <article class="pagina-partida">
      <header class="tabua tabua-partida ${s === 'AO_VIVO' ? 'rolando' : ''}">
        <p class="tabua-titulo">${nomeDaEtapa(p.fase, p.rodada)} · ${diaLongo(p.apito)}, ${hora(p.apito)}</p>
        <h1 class="sr">${IDENTIDADE[p.mandante].nome} contra ${IDENTIDADE[p.visitante].nome}</h1>
        <div class="tabua-confronto">
          <a class="tabua-time" href="#/time/${p.mandante}">${escudoImg(p.mandante, 3)}<span>${curto(p.mandante)}</span></a>
          <div class="tabua-meio">
            <span class="tabua-placar">${placar}</span>
            ${mostrarFinal && r.penaltis && r.vencedor
              ? html`<span class="penaltis-placa">${curto(r.times[r.vencedor])} venceu nos pênaltis, ${r.penaltis.placar[r.vencedor]} a ${r.penaltis.placar[r.vencedor === 'mandante' ? 'visitante' : 'mandante']}</span>`
              : ''}
            ${s === 'AO_VIVO' && timeline?.disputa ? html`<span class="penaltis-placa" data-penaltis hidden></span>` : ''}
            ${s === 'AO_VIVO' ? html`<span class="ao-vivo-selo">Ao vivo <span data-minuto>0'</span></span>` : ''}
            ${s === 'AGENDADA' ? html`<span class="falta">Apito ${contagem(p.apito)}</span>` : ''}
            ${classico ? html`<span class="classico-nome">${classico}</span>` : ''}
          </div>
          <a class="tabua-time" href="#/time/${p.visitante}">${escudoImg(p.visitante, 3)}<span>${curto(p.visitante)}</span></a>
        </div>
      </header>

      ${timeline && s !== 'AGENDADA'
        ? html`<section class="transmissao" aria-label="${s === 'AO_VIVO' ? 'Transmissão ao vivo' : 'Replay'}">
            <canvas width="540" height="960"></canvas>
            ${s === 'ENCERRADA'
              ? html`<div class="controles">
                  <button type="button" class="botao" data-acao="tocar" aria-pressed="true">Pausar</button>
                  <input type="range" min="0" step="1" value="0" aria-label="Minuto do jogo" />
                  <div class="velocidades" role="group" aria-label="Velocidade">
                    <button type="button" data-velocidade="20" aria-pressed="true">20×</button>
                    <button type="button" data-velocidade="45" aria-pressed="false">45×</button>
                    <button type="button" data-velocidade="120" aria-pressed="false">120×</button>
                  </div>
                </div>`
              : html`<p class="legenda">Ao vivo no tempo da Liga: 90 minutos em 4 e meio. Não dá para adiantar.</p>`}
            ${p.narracao
              ? html`<p><button type="button" class="botao" data-acao="narracao" aria-pressed="false">🔊 Ligar narração</button></p>`
              : ''}
            ${p.video ? html`<p><a class="botao secundario" href="${p.video}" rel="noopener">Melhores momentos (Reels)</a></p>` : ''}
          </section>`
        : ''}

      ${p.escalacoes
        ? html`<div class="escalacoes">${escalacao(p.escalacoes.mandante, 'mandante', mostrarFinal ? r : null, camisas)}${escalacao(p.escalacoes.visitante, 'visitante', mostrarFinal ? r : null, camisas)}</div>
            ${mostrarFinal ? html`<p class="legenda">● gol · ▲▼ OVR depois do jogo · Nota de 0 a 10, comparada ao que se espera do OVR.</p>` : html`<p class="legenda">OVR antes do jogo. Vaga sem inscrito é completada pela Base (OVR 55).</p>`}`
        : html`<section class="placa vazio"><p>A escalação sai no Corte, ${CORTE_MIN} minutos antes do apito: quem tem menos jogos entra primeiro.</p></section>`}

      ${mostrarFinal
        ? html`<section aria-labelledby="titulo-lances"><h2 id="titulo-lances" class="secao">Lance a lance</h2>
            <ol class="lances">${r.lances.map(
              (l, i) => html`<li><button type="button" class="lance tipo-${l.tipo.toLowerCase()}" data-indice="${i}">
                <span class="min">${l.minuto}'</span><span class="chip">${ROTULO[l.tipo]}</span>
                <span class="txt">${textoDoLance(r, nomes, i)}</span><span class="sig">${IDENTIDADE[r.times[l.ataque]].sigla}</span>
              </button></li>`,
            )}</ol></section>
            ${r.penaltis && timeline?.disputa
              ? html`<section aria-labelledby="titulo-pen"><h2 id="titulo-pen" class="secao">Disputa de pênaltis <small>${curto(r.times.mandante)} ${r.penaltis.placar.mandante} × ${r.penaltis.placar.visitante} ${curto(r.times.visitante)}</small></h2>
                  <ol class="lances cobrancas">${r.penaltis.cobrancas.map((c, k) => {
                    const res = resultadoDaCobranca(timeline.disputa!, k, r.seed);
                    const quem = nomes[c.cobrador.lado][c.cobrador.indice] ?? 'a Base';
                    const goleiro = nomes[c.goleiro.lado][c.goleiro.indice] ?? 'a Base';
                    return html`<li><button type="button" class="lance cobranca tipo-${res === 'GOL' ? 'gol' : 'perdeu'}" data-cobranca="${k}">
                      <span class="min">${k + 1}ª</span><span class="chip">${res === 'GOL' ? 'Gol' : res === 'DEFESA' ? 'Defesa' : 'Fora'}</span>
                      <span class="txt">${maiuscula(res === 'GOL' ? `${quem} converte` : res === 'DEFESA' ? `${goleiro} pega a cobrança de ${quem}` : `${quem} manda para fora`)}</span>
                      <span class="sig">${IDENTIDADE[r.times[c.lado]].sigla}</span>
                    </button></li>`;
                  })}</ol></section>`
              : ''}`
        : ''}
    </article>`.s;

  if (!timeline || s === 'AGENDADA') {
    if (s === 'AGENDADA') {
      // Atualiza quando sair a escalação (Corte) e quando a bola rolar.
      const corte = Date.parse(p.apito) - CORTE_MIN * 60_000;
      const espera = (p.escalacoes ? Date.parse(p.apito) : corte + 60_000) - Date.now();
      const id = espera > 0 && espera < 2 ** 31 - 1 ? setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), espera + 1000) : 0;
      return () => clearTimeout(id);
    }
    return;
  }
  const caixa = main.querySelector<HTMLElement>('.transmissao')!;
  const elPlacar = { mandante: main.querySelector('[data-placar="mandante"]'), visitante: main.querySelector('[data-placar="visitante"]') };
  const elMinuto = main.querySelector('[data-minuto]');
  const elPen = main.querySelector<HTMLElement>('[data-penaltis]');
  const botoes = [...main.querySelectorAll<HTMLButtonElement>('.lance')];
  const tx = transmitir(caixa, p, timeline, {
    aoVivo: s === 'AO_VIVO',
    aoMudar(t) {
      if (elPlacar.mandante) {
        const pl = timeline.placarEm(t);
        elPlacar.mandante.textContent = String(pl.mandante);
        elPlacar.visitante!.textContent = String(pl.visitante);
      }
      if (elMinuto) elMinuto.textContent = t > DURACAO_JOGO ? 'pênaltis' : `${Math.min(90, Math.floor(t / 60))}'`;
      if (elPen && timeline.disputa) {
        const e = timeline.estado(t).penaltis;
        elPen.hidden = !e;
        if (e) elPen.textContent = `pênaltis ${e.placar.mandante}–${e.placar.visitante}`;
      }
      for (const b of botoes) b.classList.toggle('futuro', t < timeline.instanteDoLance(Number(b.dataset.indice)));
    },
  });
  // No fim do Ao Vivo a página vira a da Partida encerrada (placar, Notas, lance a lance).
  const fimDoAoVivo = s === 'AO_VIVO' ? setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), Date.parse(p.apito) + duracaoAoVivoMs(p.fase) - Date.now() + 500) : 0;
  for (const b of botoes) {
    b.addEventListener('click', () => {
      tx.irPara(Math.max(0, timeline.instanteDoLance(Number(b.dataset.indice)) - 20));
      caixa.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  }
  for (const b of main.querySelectorAll<HTMLButtonElement>('[data-cobranca]')) {
    b.addEventListener('click', () => {
      tx.irPara(Math.max(0, timeline.instanteDaCobranca(Number(b.dataset.cobranca)) - 60));
      caixa.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  }
  return () => {
    tx.parar();
    clearTimeout(fimDoAoVivo);
  };
};
