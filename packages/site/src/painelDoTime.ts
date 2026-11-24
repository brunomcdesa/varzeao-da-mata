/**
 * Técnico e Interesse no site (ADRs 0110 e 0111), como nas prévias aprovadas: o Plano do Time
 * (quem decide, Formação, Postura, titulares fixados, a Sugestão do Capitão e a dobra "Do
 * Capitão"), a aba Contratações (vagas, Pedidos, Convites, Trocas casadas e Fila), "Jogar no
 * Time" para quem é de outro Time e o Convite recebido no painel do Jogador.
 *
 * Os dados vêm da borda (`escolha/estado`) só para quem tem Vínculo; cada botão manda uma
 * escolha (`/escolha`) e a regra fica no worker.
 */
import { DESCRICAO_DA_FORMACAO, FALA_DO_TIME, FORMACOES, GRITOS_DA_TEMPORADA, POSTURAS, doTime, gritoDoTime, type Formacao, type JogadorPublico, type Posicao, type Postura, type TimeId } from '@liga/shared';
import { desenhoDaFormacao } from './formacao.js';
import { NOME_DA_POSTURA } from './planoDoTime.js';
import { contraO, quandoDoJogo } from './presenca.js';
import { curto, escudoImg, html, NOME_DA_POSICAO, type Html } from './ui.js';

export interface PessoaNoPainel {
  id: string;
  nome: string;
  posicao: Posicao;
  ovr: number;
  time?: TimeId;
  vinculo?: boolean;
}

export interface PainelDoTime {
  papel: 'TECNICO' | 'CAPITAO' | 'JOGADOR';
  time: TimeId;
  tecnico: { username: string; apelido: string | null } | null;
  capitao: string | null;
  jogo: { apito: string; adversario: TimeId } | null;
  plano: {
    postura: Postura;
    formacao: Formacao;
    fixados: string[];
    escanteio: string[];
    marcacao: { marcador: string; alvo: string } | null;
    sugestao: { postura?: Postura; formacao?: Formacao; fixados?: string[] } | null;
  } | null;
  elenco: PessoaNoPainel[];
  adversarios?: PessoaNoPainel[];
  vagas: Record<Posicao, { ocupadas: number; limite: number; fila: number }>;
  pedidos?: { id: number; jogador: PessoaNoPainel & { de: TimeId }; prazo: string; peloPrazo: boolean }[];
  convites?: { id: number; jogador: PessoaNoPainel; expira: string }[];
  trocas?: { id: number; a: PessoaNoPainel; b: PessoaNoPainel; aceiteA: boolean; aceiteB: boolean; timeA: boolean | null; timeB: boolean | null; expira: string; euDecido: boolean }[];
  fila?: { posicao: Posicao; lista: { username: string; time: TimeId | null; ovr: number | null }[] }[];
  grito?: number | null;
}

export interface MercadoDoJogador {
  convites: { id: number; time: TimeId; autor: string; posicao: Posicao; expira: string }[];
  trocas: { id: number; comQuem: PessoaNoPainel; aceitei: boolean; outroAceitou: boolean; expira: string }[];
  pedido: { para: TimeId; posicao: Posicao; prazo: string } | null;
  fila: { time: TimeId; posicao: Posicao; vez: number } | null;
  serTecnico: TimeId | null;
}

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'MEI', 'ATA'];
/** "o Tatu" / "a Onça" e "no Tatu" / "na Onça". */
const oTime = (t: TimeId) => `${FALA_DO_TIME[t].artigo} ${FALA_DO_TIME[t].curto}`;
const noTime = (t: TimeId) => `${FALA_DO_TIME[t].artigo === 'a' ? 'na' : 'no'} ${FALA_DO_TIME[t].curto}`;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "em 18h", "em 40 min". */
export function faltaPara(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((Date.parse(iso) - agora) / 60_000));
  return min >= 60 ? `${Math.round(min / 60)}h` : `${min} min`;
}

const nomeDoTecnico = (p: PainelDoTime) => (p.tecnico ? (p.tecnico.apelido ?? `@${p.tecnico.username}`) : null);
const nomeDe = (p: PainelDoTime, id: string) => p.elenco.find((x) => x.id === id)?.nome ?? p.adversarios?.find((x) => x.id === id)?.nome ?? '?';
const estado = () => html`<p class="estado-escolha" role="status" aria-live="polite"></p>`;

/** Plano do Time (a placa da aba Escalação). */
export function blocoDoPlanoT3(p: PainelDoTime, agora = new Date()): Html {
  const pl = p.plano;
  const quemDecide =
    p.papel === 'TECNICO'
      ? html`<span class="cargo">Técnico</span><p><strong>Você</strong> decide${p.jogo ? html` · ${quandoDoJogo(p.jogo.apito, agora)}, ${contraO(p.jogo.adversario)}` : ''}</p>`
      : p.tecnico
        ? html`<span class="cargo">Técnico</span><p><strong>${nomeDoTecnico(p)}</strong> decide${p.jogo ? html` · ${quandoDoJogo(p.jogo.apito, agora)}, ${contraO(p.jogo.adversario)}` : ''}</p>`
        : html`<span class="cargo">Capitão</span><p><strong>${p.papel === 'CAPITAO' ? 'Você' : p.capitao ? `@${p.capitao}` : 'Ninguém ainda'}</strong> decide${p.jogo ? html` · ${quandoDoJogo(p.jogo.apito, agora)}, ${contraO(p.jogo.adversario)}` : ''}</p>`;
  if (!pl) {
    return html`<section class="plano-do-capitao placa"><h2 class="secao">Plano do Time <small>só quem é do Time vê</small></h2>
      <div class="quem-decide enxuto">${quemDecide}</div><p class="legenda">Sem jogo do Time aberto para escolher agora.</p></section>`;
  }
  const d = DESCRICAO_DA_FORMACAO[pl.formacao];
  const sug = pl.sugestao;
  const temSugestao = sug && (sug.postura || sug.formacao || sug.fixados?.length);
  const decide = p.papel === 'TECNICO' || (p.papel === 'CAPITAO' && !p.tecnico);
  const sugere = p.papel === 'CAPITAO' && !!p.tecnico;
  return html`<section class="plano-do-capitao placa" aria-labelledby="titulo-plano">
    <h2 id="titulo-plano" class="secao">Plano do Time <small>só quem é do Time vê</small></h2>
    <div class="quem-decide enxuto">${quemDecide}</div>
    <div class="plano-corpo">
      ${desenhoDaFormacao(pl.formacao)}
      <div><p class="plano-escolha"><span>Formação <strong>${d.nome}</strong>${d.jogada ? html` <em class="jogada-formacao">${d.jogada}</em>` : ''}</span><span>Postura <strong>${NOME_DA_POSTURA[pl.postura]}</strong></span></p></div>
    </div>
    <div class="fixados-do-plano"><span>Titulares fixados</span>${
      pl.fixados.length ? html`<span class="fixados">${pl.fixados.map((id) => html`<span class="fixado">${nomeDe(p, id)}</span>`)}</span>` : html`<span class="legenda">Nenhum: todos pelo rodízio.</span>`
    }</div>
    ${temSugestao && p.papel === 'TECNICO'
      ? html`<div class="sugestao-do-capitao enxuta"><p><strong>Capitão sugere:</strong> ${[sug!.formacao, sug!.postura ? NOME_DA_POSTURA[sug!.postura] : null, sug!.fixados?.length ? `fixar ${sug!.fixados.map((id) => nomeDe(p, id)).join(', ')}` : null].filter(Boolean).join(', ')}</p></div>`
      : ''}
    ${decide || sugere ? formulariosDoPlano(p, sugere) : ''}
    ${blocoDoCapitao(p)}
  </section>`;
}

/** Formação, Postura e titulares fixados (o Capitão com Técnico só sugere). */
function formulariosDoPlano(p: PainelDoTime, sugere: boolean): Html {
  const pl = p.plano!;
  const base = sugere ? pl.sugestao ?? {} : pl;
  const formacao = base.formacao ?? pl.formacao;
  const postura = base.postura ?? pl.postura;
  const fixados = new Set(base.fixados ?? (sugere ? [] : pl.fixados));
  const eu = sugere ? 'Sugerir' : 'Salvar';
  return html`<details class="dobra escolhas-no-time" data-dobra="plano-t3"><summary>${sugere ? 'Sugerir ao Técnico' : 'Mudar o plano'} <small>Formação, Postura e titulares</small></summary>
    <form class="escolha-t2" data-tipo="FORMACAO">
      <fieldset class="opcoes-t2 formacoes">${FORMACOES.map((f) => {
        const x = DESCRICAO_DA_FORMACAO[f];
        return html`<label class="opcao-t2 opcao-formacao"><input type="radio" name="valor" value="${f}" ${f === formacao ? 'checked' : ''} />${desenhoDaFormacao(f)}<span><strong>${x.nome}${x.jogada ? html` <em class="jogada-formacao">${x.jogada}</em>` : ''}</strong><small>${x.linha}</small></span></label>`;
      })}</fieldset>
      <p><button type="submit" class="botao">${eu} a Formação</button></p>${estado()}
    </form>
    <form class="escolha-t2" data-tipo="POSTURA">
      <fieldset class="opcoes-t2">${POSTURAS.map((x) => html`<label class="opcao-t2"><input type="radio" name="valor" value="${x}" ${x === postura ? 'checked' : ''} /><span><strong>${NOME_DA_POSTURA[x]}</strong></span></label>`)}</fieldset>
      <p><button type="submit" class="botao">${eu} a Postura</button></p>${estado()}
    </form>
    <form class="escolha-t2" data-tipo="FIXADOS">
      <p><strong>Titulares fixados</strong>: até 3 que entram mesmo sem Presença.${sugere ? ' O Capitão não sugere a si mesmo.' : ''}</p>
      <fieldset class="opcoes-t2">${ORDEM.flatMap((pos) =>
        p.elenco.filter((x) => x.posicao === pos).map((x) => html`<label class="opcao-t2"><input type="checkbox" name="valor" value="${x.id}" ${fixados.has(x.id) ? 'checked' : ''} /><span><strong>${x.nome}</strong><small>${NOME_DA_POSICAO[pos]} · OVR ${x.ovr}</small></span></label>`),
      )}</fieldset>
      <p><button type="submit" class="botao">${eu} os titulares</button></p>${estado()}
    </form>
  </details>`;
}

/** O que fica sempre com o Capitão (ADR-0111). Quem não é Capitão só vê. */
function blocoDoCapitao(p: PainelDoTime): Html {
  const pl = p.plano!;
  const capitao = p.papel === 'CAPITAO';
  const escanteio = pl.escanteio.length ? pl.escanteio.map((id, k) => (k ? `reserva ${nomeDe(p, id)}` : nomeDe(p, id))).join(', ') : 'sorteado';
  const marcacao = pl.marcacao ? html`${nomeDe(p, pl.marcacao.marcador)} em ${nomeDe(p, pl.marcacao.alvo)} <span class="segredo">segredo</span>` : html`sem Marcação`;
  const linha = p.elenco.filter((x) => x.posicao !== 'GOL');
  const marcadores = p.elenco.filter((x) => x.posicao === 'ZAG' || x.posicao === 'MEI');
  return html`<details class="dobra do-capitao" data-dobra="do-capitao"><summary>Do Capitão <small>escanteio, Marcação, Grito e Chamada</small></summary>
    <ul class="linhas-do-plano">
      <li><span>Escanteio</span><span>${escanteio}</span></li>
      <li><span>Marcação</span><span>${marcacao}</span></li>
      <li><span>Grito</span><span>${gritoDoTime(p.time, p.grito)}</span></li>
    </ul>
    ${capitao
      ? html`<form class="escolha-t2" data-tipo="ESCANTEIO">
          <label>Cobrador de escanteio<select name="valor"><option value="">Sorteado</option>${linha.map((x) => html`<option value="${x.id}" ${pl.escanteio[0] === x.id ? 'selected' : ''}>${x.nome}</option>`)}</select></label>
          <label>Reserva<select name="valor"><option value="">Nenhum</option>${linha.map((x) => html`<option value="${x.id}" ${pl.escanteio[1] === x.id ? 'selected' : ''}>${x.nome}</option>`)}</select></label>
          <p><button type="submit" class="botao">Salvar o escanteio</button></p>${estado()}
        </form>
        <form class="escolha-t2" data-tipo="MARCACAO">
          <label>Quem marca<select name="marcador"><option value="">Sem Marcação</option>${marcadores.map((x) => html`<option value="${x.id}" ${pl.marcacao?.marcador === x.id ? 'selected' : ''}>${x.nome} (${NOME_DA_POSICAO[x.posicao]})</option>`)}</select></label>
          <label>Quem é marcado${p.jogo ? ` (${curto(p.jogo.adversario)})` : ''}<select name="alvo"><option value="">—</option>${(p.adversarios ?? []).map((x) => html`<option value="${x.id}" ${pl.marcacao?.alvo === x.id ? 'selected' : ''}>${x.nome} (${NOME_DA_POSICAO[x.posicao]})</option>`)}</select></label>
          <p class="legenda">O marcador ganha vantagem nos duelos com ele, mas faz mais faltas. Fica em segredo até o jogo.</p>
          <p><button type="submit" class="botao">Salvar a Marcação</button></p>${estado()}
        </form>
        <form class="escolha-t2 grito" data-tipo="GRITO">
          <p><strong>Grito da Temporada</strong>: vai na faixa da torcida depois de cada gol. Escolha na Janela; vale a Temporada toda.</p>
          ${GRITOS_DA_TEMPORADA[p.time].map((g, k) => html`<label class="opcao-grito"><input type="radio" name="valor" value="${k}" ${p.grito === k ? 'checked' : ''}><span>${g}</span></label>`)}
          <p><button type="submit" class="botao">Salvar o Grito</button></p>${estado()}
        </form>
        <div class="escolha-t2"><p><strong>Chamada da Presença</strong>: avisa o Elenco no App para confirmar antes do Corte (uma por jogo).</p>
          <p><button type="button" class="botao secundario" data-acao="CHAMADA">Chamar o Elenco</button></p>${estado()}</div>`
      : html`<p class="legenda">Escolhas do Capitão${p.capitao ? ` @${p.capitao}` : ''}, mesmo com Técnico.</p>`}
  </details>`;
}

/** Aba Contratações (Técnico, ou Capitão sem Técnico). */
export function abaContratacoes(p: PainelDoTime, agora = Date.now()): Html {
  const pessoa = (x: PessoaNoPainel, sub: string) =>
    html`<div class="quem">${x.time ? escudoImg(x.time, 1) : ''}<p><strong>${x.nome}</strong><small>${sub}</small></p><span class="ovr">${x.ovr}</span></div>`;
  const botoes = (tipo: string, id: number) =>
    html`<div class="acoes-mercado"><button type="button" class="botao" data-acao="${tipo}" data-valor="ACEITAR:${id}">Aceitar</button><button type="button" class="botao secundario" data-acao="${tipo}" data-valor="RECUSAR:${id}">Recusar</button></div>${estado()}`;
  const convites = p.convites ?? [];
  return html`<section class="placa mesa-do-tecnico" aria-labelledby="titulo-vagas">
    <h2 id="titulo-vagas" class="secao">Vagas ${doTime(p.time)}</h2>
    <div class="vagas-posicao">${ORDEM.map((pos) => {
      const v = p.vagas[pos];
      const cheia = v.ocupadas >= v.limite;
      return html`<div class="vaga-posicao ${cheia ? 'cheia' : ''}"><small>${NOME_DA_POSICAO[pos]}</small><strong>${v.ocupadas}/${v.limite}</strong><small>${v.fila ? `fila: ${v.fila}` : cheia ? 'completo' : `${v.limite - v.ocupadas} vaga${v.limite - v.ocupadas > 1 ? 's' : ''}`}</small></div>`;
    })}</div>
    <h3>Pedidos para entrar <span class="contador-mercado">· ${p.pedidos?.length ?? 0}</span></h3>
    ${p.pedidos?.length
      ? html`<ul class="lista-mercado">${p.pedidos.map(
          (x) => html`<li class="cartao-mercado">${pessoa({ ...x.jogador, time: x.jogador.de }, `${NOME_DA_POSICAO[x.jogador.posicao]} · vem ${doTime(x.jogador.de)}`)}
            <p class="prazo">Sem resposta, vale como aceito em <strong>${faltaPara(x.prazo, agora)}</strong>.</p>
            ${x.peloPrazo ? html`<p class="legenda">É da sua Posição: o Capitão não decide, vale o prazo.</p>` : botoes('PEDIDO', x.id)}</li>`,
        )}</ul>`
      : html`<p class="legenda">Nenhum pedido agora.</p>`}
    <h3>Convites que você mandou <span class="contador-mercado">· ${convites.length} de 3</span></h3>
    ${convites.length
      ? html`<ul class="lista-mercado">${convites.map((x) => html`<li class="cartao-mercado">${pessoa(x.jogador, `${NOME_DA_POSICAO[x.jogador.posicao]}${x.jogador.time ? ` · ${curto(x.jogador.time)}` : ''}`)}<p class="prazo">Esperando a resposta · expira em <strong>${faltaPara(x.expira, agora)}</strong></p></li>`)}</ul>`
      : html`<p class="legenda">Para convidar, abra a página do Time do Jogador.</p>`}
    <h3>Trocas casadas <span class="contador-mercado">· ${p.trocas?.length ?? 0}</span></h3>
    ${p.trocas?.length
      ? html`<ul class="lista-mercado">${p.trocas.map(
          (x) => html`<li class="cartao-mercado"><div class="troca-casada">${pessoa(x.a, `${NOME_DA_POSICAO[x.a.posicao]}${x.a.time ? ` · ${curto(x.a.time)}` : ''}`)}<span class="seta">⇄</span>${pessoa(x.b, `${NOME_DA_POSICAO[x.b.posicao]}${x.b.time ? ` · ${curto(x.b.time)}` : ''}`)}</div>
            <ul class="aceites"><li class="${x.aceiteA ? 'ok' : ''}">${x.a.nome}</li><li class="${x.aceiteB ? 'ok' : ''}">${x.b.nome}</li><li class="${x.timeA ? 'ok' : ''}">${x.a.time ? curto(x.a.time) : 'Time'}</li><li class="${x.timeB ? 'ok' : ''}">${x.b.time ? curto(x.b.time) : 'Time'}</li></ul>
            <p class="prazo">Sem resposta dos Times, vale como aceito em <strong>${faltaPara(x.expira, agora)}</strong> (se os dois Jogadores aceitarem).</p>${botoes('TROCA', x.id)}</li>`,
        )}</ul>`
      : html`<p class="legenda">Nenhuma Troca casada agora.</p>`}
    <h3>Fila de espera</h3>
    ${p.fila?.length
      ? html`<div class="lista-mercado">${p.fila.map(
          (f) => html`<div class="cartao-mercado fila-posicao"><h4>${NOME_DA_POSICAO[f.posicao]}s</h4><ol>${f.lista.map((x, k) => html`<li><b>${k + 1}</b><span>@${x.username} <small>(${x.time ? `${curto(x.time)}, OVR ${x.ovr}` : 'novato'})</small></span></li>`)}</ol></div>`,
        )}</div><p class="legenda">Quando abrir vaga, o primeiro da Fila vira pedido para você (novato entra direto).</p>`
      : html`<p class="legenda">Ninguém na Fila.</p>`}
  </section>`;
}

/**
 * Para quem tem Vínculo e é de outro Time: as vagas por Posição e o pedido para jogar aqui; para
 * quem decide noutro Time, Convidar e propor Troca casada com o Elenco deste.
 */
export function blocoDoOutroTime(time: TimeId, eu: JogadorPublico | null, meuPainel: PainelDoTime | null, elenco: JogadorPublico[], filas: Partial<Record<Posicao, number>>, tecnico: string | null, limite: Record<Posicao, number>): Html {
  const n = (pos: Posicao) => elenco.filter((x) => x.posicao === pos).length;
  const decide = meuPainel && meuPainel.pedidos !== undefined;
  const pedir = eu
    ? html`<section class="placa jogar-aqui" aria-labelledby="titulo-jogar">
        <h2 id="titulo-jogar" class="secao">Jogar ${noTime(time)} <small>${tecnico ? `Técnico: ${tecnico}` : 'sem Técnico'}</small></h2>
        <p>Escolha a Posição.${tecnico ? ' O Técnico tem até 24h para responder; sem resposta, você entra.' : ''}</p>
        <form class="escolha-t2" data-tipo="JOGAR_AQUI" data-time="${time}">
          <fieldset class="opcoes-t2">${ORDEM.map((pos) => {
            const cheia = n(pos) >= limite[pos];
            const fila = filas[pos] ?? 0;
            return html`<label class="opcao-t2 ${cheia ? 'cheia' : ''}"><input type="radio" name="valor" value="${pos}" ${pos === eu.posicao ? 'checked' : ''} /><span><strong>${NOME_DA_POSICAO[pos]}</strong><small>${cheia ? `Cheio (${n(pos)}/${limite[pos]}) · entra na Fila${fila ? ` (${fila} esperando)` : ''}` : `${limite[pos] - n(pos)} vaga${limite[pos] - n(pos) > 1 ? 's' : ''}`}${pos === eu.posicao ? ' · sua Posição hoje' : ''}</small></span></label>`;
          })}</fieldset>
          <div class="acoes-mercado"><button type="submit" class="botao">Quero jogar aqui</button></div>${estado()}
        </form>
        <p class="legenda">Usa a sua troca. Recusado, não gasta.</p>
        ${elenco.some((x) => x.posicao === eu.posicao)
          ? html`<form class="escolha-t2" data-tipo="TROCA_PROPOR" data-eu="${eu.id}">
              <label>Ou proponha uma Troca casada com<select name="valor">${elenco.filter((x) => x.posicao === eu.posicao).map((x) => html`<option value="${x.id}">${x.apelido ?? `@${x.username}`} (OVR ${x.ovr})</option>`)}</select></label>
              <p><button type="submit" class="botao secundario">Propor Troca casada</button></p>${estado()}
            </form>`
          : ''}
      </section>`
    : html``;
  const convidar = decide
    ? html`<section class="placa jogar-aqui">
        <h2 class="secao">Trazer ${doTime(time)} <small>para ${oTime(meuPainel!.time)}</small></h2>
        <form class="escolha-t2" data-tipo="CONVIDAR">
          <label>Convidar<select name="valor">${elenco.map((x) => html`<option value="${x.id}">${x.apelido ?? `@${x.username}`} (${NOME_DA_POSICAO[x.posicao]}, OVR ${x.ovr})</option>`)}</select></label>
          <p class="legenda">Só chega para quem tem Vínculo. Até 3 Convites abertos, cada um vale 24h.</p>
          <p><button type="submit" class="botao">Convidar</button></p>${estado()}
        </form>
      </section>`
    : html``;
  return html`${pedir}${convidar}`;
}

/** Convites e Trocas casadas que chegaram para o Jogador, e o que ele pediu (no painel dele). */
export function blocoDoMercado(m: MercadoDoJogador, agora = Date.now()): Html {
  const nada = !m.convites.length && !m.trocas.length && !m.pedido && !m.fila && !m.serTecnico;
  if (nada) return html``;
  return html`${m.convites.map(
    (c) => html`<section class="placa convite-recebido">
      <div class="titulo-convite">${escudoImg(c.time, 2)}<div><h2 class="secao" style="margin:0">${maiuscula(oTime(c.time))} quer você!</h2><small>Convite de ${c.autor}</small></div></div>
      <p>Se aceitar, você vira <strong>${NOME_DA_POSICAO[c.posicao].toLowerCase()} ${doTime(c.time)}</strong> agora e usa a sua troca. Leva as Habilidades, o OVR e a camisa (se o número estiver livre).</p>
      <p class="prazo">Expira em <strong>${faltaPara(c.expira, agora)}</strong>.</p>
      <div class="acoes-mercado"><button type="button" class="botao" data-acao="CONVITE" data-valor="ACEITAR:${c.id}">Aceitar o convite</button><button type="button" class="botao secundario" data-acao="CONVITE" data-valor="RECUSAR:${c.id}">Agora não</button></div>${estado()}
    </section>`,
  )}${m.trocas.map(
    (t) => html`<section class="placa convite-recebido">
      <h2 class="secao" style="margin:0">Troca casada</h2>
      <p>Trocar de lugar com <strong>${t.comQuem.nome}</strong>${t.comQuem.time ? ` ${doTime(t.comQuem.time)}` : ''} (${NOME_DA_POSICAO[t.comQuem.posicao]}, OVR ${t.comQuem.ovr}). ${t.outroAceitou ? 'Ele já aceitou.' : 'Ele ainda não respondeu.'}</p>
      <p class="prazo">Expira em <strong>${faltaPara(t.expira, agora)}</strong>.</p>
      ${t.aceitei
        ? html`<p class="legenda">Você aceitou. Falta ${t.outroAceitou ? 'os Times (ou o prazo)' : 'ele'}.</p>`
        : html`<div class="acoes-mercado"><button type="button" class="botao" data-acao="TROCA" data-valor="ACEITAR:${t.id}">Aceitar a troca</button><button type="button" class="botao secundario" data-acao="TROCA" data-valor="RECUSAR:${t.id}">Recusar</button></div>${estado()}`}
    </section>`,
  )}${m.pedido || m.fila || m.serTecnico
    ? html`<section class="placa"><h2 class="secao">Seus pedidos</h2><ul class="linhas-do-plano">
        ${m.pedido ? html`<li><span>Transferência</span><span>${NOME_DA_POSICAO[m.pedido.posicao]} ${doTime(m.pedido.para)}: esperando o Time (até ${faltaPara(m.pedido.prazo, agora)})</span></li>` : ''}
        ${m.fila ? html`<li><span>Fila</span><span>${m.fila.vez}º para ${NOME_DA_POSICAO[m.fila.posicao].toLowerCase()} ${doTime(m.fila.time)}</span></li>` : ''}
        ${m.serTecnico ? html`<li><span>Técnico</span><span>Pedido para treinar ${oTime(m.serTecnico)}, esperando a aprovação da Liga</span></li>` : ''}
      </ul></section>`
    : ''}`;
}

/** Ser Técnico deste Time (Jogador com Vínculo, Time sem Técnico): pendura as chuteiras quando aprovado. */
export function blocoSerTecnico(time: TimeId): Html {
  return html`<details class="dobra placa ser-tecnico"><summary>Ser o Técnico ${doTime(time)} <small>pendurar as chuteiras</small></summary>
    <p>O Técnico cuida do Time: Formação, Postura, titulares, Pedidos e Convites. Para isso você deixa de jogar, mas guarda o boneco, a Carreira, as Moedas e os Itens, e pode voltar na Janela da próxima temporada.</p>
    <p><button type="button" class="botao secundario" data-acao="SER_TECNICO" data-valor="${time}">Pedir para ser o Técnico</button></p>${estado()}
  </details>`;
}

/** O valor de um formulário do painel. */
export function valorDoPainel(form: HTMLFormElement): string | string[] | null {
  const dados = new FormData(form);
  const tipo = form.dataset.tipo;
  if (tipo === 'FIXADOS') return dados.getAll('valor').map(String).slice(0, 3);
  if (tipo === 'ESCANTEIO') return [...new Set(dados.getAll('valor').map(String).filter(Boolean))];
  if (tipo === 'MARCACAO') {
    const m = String(dados.get('marcador') ?? '');
    const a = String(dados.get('alvo') ?? '');
    return m && a ? `${m}:${a}` : '';
  }
  if (tipo === 'TROCA_PROPOR') return `${form.dataset.eu}:${String(dados.get('valor') ?? '')}`;
  const v = dados.get('valor');
  return v ? String(v) : null;
}

/** Postura e Formação da Sugestão (ou do Plano) para a escalação provável. */
export const formacaoDoPainel = (p: PainelDoTime | null): Formacao | null => p?.plano?.formacao ?? null;
export type { Postura };
