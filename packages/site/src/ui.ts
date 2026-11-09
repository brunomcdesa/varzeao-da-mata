/** Peças pequenas de interface: HTML seguro, escudos e bonecos em pixel art, rótulos. */
import { ALTURA_ESCUDO, ALTURA_SPRITE, LARGURA_ESCUDO, LARGURA_SPRITE, escudo, sprite, visualDoJogador, type Pose } from '@liga/renderer';
import { FALA_DO_TIME, IDENTIDADE, nomeDoClassico, type ForcaDoTime, type Posicao, type TimeId } from '@liga/shared';

/** Trecho de HTML já escapado. */
export class Html {
  constructor(readonly s: string) {}
  toString(): string {
    return this.s;
  }
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]!);

function valor(v: unknown): string {
  if (v instanceof Html) return v.s;
  if (Array.isArray(v)) return v.map(valor).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}

/** html`<p>${texto}</p>`: interpolações são escapadas; Html e listas de Html entram como estão. */
export function html(partes: TemplateStringsArray, ...vals: unknown[]): Html {
  let s = partes[0]!;
  vals.forEach((v, i) => (s += valor(v) + partes[i + 1]!));
  return new Html(s);
}

const imagens = new Map<string, string>();
function paraDataUrl(chave: string, desenhar: () => HTMLCanvasElement | OffscreenCanvas, w: number, h: number): string {
  const pronta = imagens.get(chave);
  if (pronta) return pronta;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(desenhar(), 0, 0);
  const url = c.toDataURL('image/png');
  imagens.set(chave, url);
  return url;
}

/** Escudo em pixel art; `escala` multiplica os 20×24 pixels originais. */
export function escudoImg(time: TimeId, escala = 2, classe = ''): Html {
  const src = paraDataUrl(`escudo-${time}`, () => escudo(time), LARGURA_ESCUDO, ALTURA_ESCUDO);
  return html`<img class="pixel escudo ${classe}" src="${src}" width="${LARGURA_ESCUDO * escala}" height="${ALTURA_ESCUDO * escala}" alt="${IDENTIDADE[time].nome}" />`;
}

/** Boneco do Jogador com o uniforme do Time (o mesmo do vídeo, pelo @). */
export function bonecoImg(time: TimeId, posicao: Posicao, username: string | null, escala = 3, pose: Pose = 'FRENTE_PARADO', classe = ''): Html {
  const nome = username ? `@${username}` : `base-${time}-${posicao}`;
  const v = visualDoJogador(time, posicao, nome);
  const src = paraDataUrl(`boneco-${pose}-${time}-${posicao}-${nome}-${v.pele}-${v.cabelo}-${v.penteado ?? ''}`, () => sprite(pose, v), LARGURA_SPRITE, ALTURA_SPRITE);
  return html`<img class="pixel boneco ${classe}" src="${src}" width="${LARGURA_SPRITE * escala}" height="${ALTURA_SPRITE * escala}" alt="" />`;
}

export const NOME_DA_POSICAO: Record<Posicao, string> = { GOL: 'Goleiro', ZAG: 'Zagueiro', MEI: 'Meia', ATA: 'Atacante' };
export const POSICOES_EM_ORDEM: Posicao[] = ['GOL', 'ZAG', 'MEI', 'ATA'];

export const curto = (t: TimeId) => FALA_DO_TIME[t].curto;

export function timeLink(t: TimeId, escala = 1): Html {
  return html`<a class="time-link" href="#/time/${t}">${escudoImg(t, escala)}<span>${curto(t)}</span></a>`;
}

export function jogadorLink(id: string | null, username: string | null, apelido?: string | null): Html {
  if (!id || !username) return html`<span class="base" title="Jogador da Base: completa a vaga sem inscrito">Base</span>`;
  return apelido ? html`<a class="arroba" href="#/jogador/${id}" title="@${username}">${apelido}</a>` : html`<a class="arroba" href="#/jogador/${id}">@${username}</a>`;
}

export function rotuloClassico(a: TimeId, b: TimeId): string | null {
  return nomeDoClassico(a, b);
}

/** Cor de texto legível sobre a cor do Time. */
export function tintaSobre(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.58 ? '#24170E' : '#FFFFFF';
}

export const nota = (n: number | null) => (n === null ? '–' : n.toFixed(1).replace('.', ','));

/** Taça em pixel art (9×10), em SVG para escalar sem borrar. */
const TACA = ['.xxxxxxx.', 'xxxxxxxxx', 'x.xxxxx.x', 'x.xxxxx.x', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....', '...xxx...', '..xxxxx..'];
export function taca(tamanho = 36, classe = ''): Html {
  const rects = TACA.flatMap((linha, y) => [...linha].map((c, x) => (c === 'x' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('');
  return new Html(`<svg class="taca ${classe}" viewBox="0 0 9 10" width="${tamanho}" height="${Math.round((tamanho * 10) / 9)}" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor">${rects}</svg>`);
}

/** Número da camisa escolhido pelo dono (ADR-0013): um quadradinho logo depois do @. */
export function camisaNum(numero: number | null | undefined): Html {
  return numero ? html`<span class="camisa-num" title="Camisa ${numero}" aria-label="camisa ${numero}">${numero}</span>` : html``;
}

/** O @ com a camisa ao lado, sempre na mesma linha. */
/** Faixa de Capitão (T2, ADR-0020): um "C" ao lado do nome. */
export const faixaC = (capitao: boolean | undefined): Html => (capitao ? html`<abbr class="faixa-capitao" title="Capitão">C</abbr>` : html``);
/** O nome com a faixa "C" na mesma linha (dentro de listas em grade). */
export const comFaixa = (conteudo: Html, capitao: boolean | undefined): Html => (capitao ? html`<span class="com-faixa">${conteudo}${faixaC(true)}</span>` : conteudo);

export function comCamisa(conteudo: Html | string, numero: number | null | undefined): Html {
  return numero ? html`<span class="com-camisa"><span class="com-camisa-nome">${conteudo}</span>${camisaNum(numero)}</span>` : html`${conteudo}`;
}

/** Barra de 40 a 99 (a faixa de OVR da Liga), em %. */
const nivel = (v: number) => Math.round(Math.max(0, Math.min(1, (v - 40) / 59)) * 100);

/** Força do Time (ADR-0028): OVR grande e barras de Ataque, Meio e Defesa. */
export function forcaHtml(f: ForcaDoTime, rotulo = 'OVR do Time'): Html {
  const setores: [string, string, number][] = [
    ['ATA', 'Ataque', f.ataque],
    ['MEI', 'Meio', f.meio],
    ['DEF', 'Defesa', f.defesa],
  ];
  return html`<div class="forca" role="group" aria-label="${rotulo}: ${f.ovr}">
    <span class="forca-ovr"><b>${f.ovr}</b><small>OVR</small></span>
    <dl class="forca-setores">${setores.map(
      ([sigla, nome, v]) => html`<div><dt title="${nome}">${sigla}</dt><dd><span class="forca-barra" aria-hidden="true"><span style="width:${nivel(v)}%"></span></span><b>${v}</b></dd></div>`,
    )}</dl>
  </div>`;
}

/** Duas forças frente a frente (Partida): mandante à esquerda, visitante à direita. */
export function duelaDeForcas(m: ForcaDoTime, v: ForcaDoTime, nomes: [string, string]): Html {
  const linhas: [string, number, number][] = [
    ['OVR', m.ovr, v.ovr],
    ['Ataque', m.ataque, v.ataque],
    ['Meio', m.meio, v.meio],
    ['Defesa', m.defesa, v.defesa],
  ];
  return html`<table class="duelo-forca">
    <caption class="sr">Força em campo: ${nomes[0]} contra ${nomes[1]}</caption>
    <thead><tr><th scope="col" class="lado-nome m">${nomes[0]}</th><th></th><th scope="col" class="lado-nome v">${nomes[1]}</th></tr></thead>
    <tbody>${linhas.map(
      ([nome, a, b]) => html`<tr class="${nome === 'OVR' ? 'geral' : ''}">
        <td class="lado m ${a > b ? 'melhor' : ''}"><b>${a}</b><span class="forca-barra" aria-hidden="true"><span style="width:${nivel(a)}%"></span></span></td>
        <th scope="row">${nome}</th>
        <td class="lado v ${b > a ? 'melhor' : ''}"><span class="forca-barra" aria-hidden="true"><span style="width:${nivel(b)}%"></span></span><b>${b}</b></td>
      </tr>`,
    )}</tbody>
  </table>`;
}

/** Forma recente: os últimos jogos do Time (mais antigo à esquerda), V/E/D. */
export function formaHtml(forma: ('V' | 'E' | 'D')[]): Html {
  if (!forma.length) return html`<span class="forma vazia">–</span>`;
  const nome = { V: 'Vitória', E: 'Empate', D: 'Derrota' };
  return html`<span class="forma" role="img" aria-label="Últimos jogos: ${forma.map((r) => nome[r]).join(', ')}">${forma.map((r) => html`<span class="forma-${r.toLowerCase()}" title="${nome[r]}">${r}</span>`)}</span>`;
}

export interface NoCampinho {
  posicao: Posicao;
  time: TimeId;
  username: string | null;
  apelido?: string | null;
  ovr: number;
  href?: string;
}

/**
 * Escalação desenhada no campinho, na formação 1-2-2-2. `metade`: só um Time, de baixo para
 * cima; sem ela, dois Times frente a frente (o de cima ataca para baixo).
 */
export function campinho(baixo: NoCampinho[], cima?: NoCampinho[]): Html {
  const meia = !cima;
  // Dois Times: cada um no seu campo, sem se encostar no meio. Um Time: o campo inteiro dele.
  const linhas: Record<Posicao, number> = meia ? { GOL: 0.88, ZAG: 0.66, MEI: 0.44, ATA: 0.2 } : { GOL: 0.95, ZAG: 0.83, MEI: 0.71, ATA: 0.59 };
  const lugar = (j: NoCampinho, k: number, topo: boolean) => {
    const xs = j.posicao === 'GOL' ? [0.5] : j.posicao === 'ATA' ? [0.36, 0.64] : [0.28, 0.72];
    let y = linhas[j.posicao];
    if (topo) y = 1 - y;
    const x = xs[k] ?? 0.5;
    const nome = j.username ? j.apelido || `@${j.username}` : 'Base';
    const corpo = html`${bonecoImg(j.time, j.posicao, j.username, meia ? 2 : 1.5)}<span class="nc-rotulo"><span class="nc-nome">${nome}</span><span class="nc-ovr">${j.ovr}</span></span>`;
    return html`<li class="no-campinho" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%">${j.href ? html`<a href="${j.href}">${corpo}</a>` : corpo}</li>`;
  };
  const time = (js: NoCampinho[], topo: boolean) => {
    const vistos: Record<string, number> = {};
    return js.map((j) => lugar(j, (vistos[j.posicao] = (vistos[j.posicao] ?? -1) + 1), topo));
  };
  return html`<div class="campinho ${meia ? 'meio-campo' : ''}"><ul aria-label="Escalação no campo">${time(baixo, false)}${cima ? time(cima, true) : ''}</ul></div>`;
}
