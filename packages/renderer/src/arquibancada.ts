/**
 * Temporada 2 (ADR-0019): Arquibancada de madeira nas laterais do campo, close na torcida no
 * gol com o Grito de guerra, Clima por cima do campo e cartão em cima de quem levou. Só
 * espetáculo: nada daqui decide lance. Só é desenhado nas Partidas da T2 (estado.t2).
 */
import { GRITO_DO_TIME, IDENTIDADE, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';
import { CAMPO } from './cenario.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste, ruido } from './pixel.js';
import type { EstadoQuadro } from './timeline.js';

const LARGURA = CAMPO.x; // 18 colunas de cada lado
const DEGRAUS = 3;
const PASSO = 5; // um torcedor a cada 5 linhas, em cada degrau
const PELES = ['#F1C9A5', '#D9A066', '#A86B3C', '#7A4A2A', '#5A3520'];

/** Humor de cada torcida no instante: festa, sofrendo, de pé (lance perigoso) ou normal. */
type Humor = 'FESTA' | 'SOFRENDO' | 'DE_PE' | 'NORMAL';

function humorDe(e: EstadoQuadro, lado: Lado): Humor {
  const d = e.destaque;
  if (d?.tipo === 'GOL') return d.lado === lado ? 'FESTA' : 'SOFRENDO';
  // Bola perto do gol que este lado ataca (mandante ataca o de cima): a torcida levanta.
  if (e.lanceAtual >= 0 && (lado === 'mandante' ? e.bola.y < 0.22 : e.bola.y > 0.78)) return 'DE_PE';
  return 'NORMAL';
}

/** Desenha as duas arquibancadas (esquerda: mandante; direita: visitante). */
export function desenharArquibancada(pin: Pincel, e: EstadoQuadro, times: Record<Lado, TimeId>): void {
  if (!e.t2) return;
  for (const lado of ['mandante', 'visitante'] as const) {
    const x0 = lado === 'mandante' ? 0 : COLUNAS - LARGURA;
    const espelho = lado === 'visitante';
    const id = IDENTIDADE[times[lado]];
    const humor = humorDe(e, lado);
    // Madeira: três degraus, o de fora mais alto (mais escuro).
    for (let k = 0; k < DEGRAUS; k++) {
      const x = espelho ? x0 + k * 6 : x0 + LARGURA - (k + 1) * 6;
      pin.r(x, CAMPO.y - 4, 6, CAMPO.h + 8, k % 2 ? COR.madeira : COR.madeiraEscura);
      pin.r(espelho ? x : x + 5, CAMPO.y - 4, 1, CAMPO.h + 8, COR.contorno);
    }
    // Torcedores: lugares preenchidos conforme o tamanho da torcida.
    const lugares = DEGRAUS * Math.floor(CAMPO.h / PASSO);
    const ocupacao = Math.min(1, 0.18 + e.t2.torcida[lado] / 70);
    for (let k = 0; k < DEGRAUS; k++) {
      for (let i = 0; i < Math.floor(CAMPO.h / PASSO); i++) {
        const sorte = ruido(k * 97 + i, lado === 'mandante' ? 11 : 23, 5);
        if (sorte > ocupacao) continue;
        const cx = (espelho ? x0 + k * 6 : x0 + LARGURA - (k + 1) * 6) + 1 + Math.floor(sorte * 7) % 3;
        const fase = e.t * 3.2 + i * 1.7 + k;
        let dy = 0;
        let bracos = false;
        if (humor === 'FESTA') {
          dy = -Math.round(Math.abs(Math.sin(fase)) * 2);
          bracos = true;
        } else if (humor === 'DE_PE') dy = -1;
        else if (humor === 'NORMAL' && Math.sin(fase * 0.25) > 0.96) dy = -1;
        const y = CAMPO.y + i * PASSO + 1 + dy + (humor === 'SOFRENDO' ? 1 : 0);
        const camisa = (i + k) % 3 === 0 ? id.secundaria : id.primaria;
        const pele = PELES[Math.floor(sorte * 97) % PELES.length]!;
        pin.r(cx, y, 2, 2, pele);
        pin.r(cx, y + 2, 2, 2, humor === 'SOFRENDO' ? escurecer(camisa) : camisa);
        if (bracos) {
          pin.r(cx - 1, y - 1, 1, 2, pele);
          pin.r(cx + 2, y - 1, 1, 2, pele);
        }
      }
    }
    // Faixa do Time pendurada na grade, no meio da arquibancada.
    const fy = CAMPO.y + CAMPO.h / 2 - 22;
    pin.r(espelho ? x0 + 1 : x0 + 2, fy, LARGURA - 3, 44, id.primaria);
    pin.r(espelho ? x0 + 1 : x0 + 2, fy + 3, LARGURA - 3, 2, id.secundaria);
    pin.r(espelho ? x0 + 1 : x0 + 2, fy + 39, LARGURA - 3, 2, id.secundaria);
    pin.ctx.save();
    pin.ctx.translate((x0 + LARGURA / 2) * pin.px, (fy + 22) * pin.px);
    pin.ctx.rotate(espelho ? Math.PI / 2 : -Math.PI / 2);
    pin.texto(id.sigla, 0, 0, 12, '"Jersey 10", sans-serif', contraste(id.primaria));
    pin.ctx.restore();
  }
}

/**
 * Close na torcida de quem marcou (T2): uma tábua com torcedores grandes pulando e a faixa
 * com o Grito de guerra, enquanto o letreiro do gol está na tela.
 */
export function desenharCloseDaTorcida(pin: Pincel, e: EstadoQuadro, times: Record<Lado, TimeId>, texto: string): void {
  const d = e.destaque;
  if (!e.t2 || !d || d.tipo !== 'GOL' || e.penaltis) return;
  const p = d.progresso;
  if (p < 0.24 || p > 0.88) return;
  const entra = Math.min(1, (p - 0.24) / 0.08);
  const sai = p > 0.8 ? (p - 0.8) / 0.08 : 0;
  const y0 = 330 + Math.round((1 - entra) * 140 + sai * 140);
  const id = IDENTIDADE[times[d.lado]];
  const w = 232;
  const x0 = (COLUNAS - w) / 2;
  pin.tabua(x0, y0, w, 72);
  // Torcedores grandes, pulando fora de compasso.
  for (let i = 0; i < 11; i++) {
    const x = x0 + 10 + i * 20;
    const pulo = Math.round(Math.abs(Math.sin(e.t * 4 + i * 1.3)) * 5);
    const y = y0 + 34 - pulo;
    const pele = PELES[i % PELES.length]!;
    pin.r(x + 2, y, 6, 6, pele);
    pin.r(x, y + 6, 10, 10, i % 3 === 0 ? id.secundaria : id.primaria);
    pin.r(x - 2, y - 3 + (i % 2), 2, 7, pele); // braço pra cima
    pin.r(x + 10, y - 3 + ((i + 1) % 2), 2, 7, pele);
  }
  // Faixa com o Grito de guerra, segurada por cima.
  const grito = GRITO_DO_TIME[times[d.lado]];
  pin.r(x0 + 8, y0 + 6, w - 16, 18, id.primaria);
  pin.r(x0 + 8, y0 + 6, w - 16, 2, id.secundaria);
  pin.r(x0 + 8, y0 + 22, w - 16, 2, id.secundaria);
  pin.texto(grito, COLUNAS / 2, y0 + 15, pin.caber(grito, w - 28, 11, texto, 700), texto, contraste(id.primaria), { peso: 700 });
}

/** Clima por cima do campo (T2): chuva caindo, céu fechado, sol, ou poças de lama no gramado. */
export function desenharClimaNoChao(pin: Pincel, e: EstadoQuadro): void {
  if (e.t2?.clima !== 'LAMA' && e.t2?.clima !== 'CHUVA') return;
  // Poças fixas no gramado (mais nas áreas, onde a grama já é gasta).
  const n = e.t2.clima === 'LAMA' ? 22 : 9;
  for (let i = 0; i < n; i++) {
    const x = CAMPO.x + 6 + ruido(i, 3, 41) * (CAMPO.w - 12);
    const perto = i % 2 === 0 ? (i % 4 === 0 ? 0.08 : 0.92) : ruido(i, 7, 43);
    const y = CAMPO.y + 6 + perto * (CAMPO.h - 12);
    const w = 6 + Math.round(ruido(i, 5, 47) * 10);
    const cor = e.t2.clima === 'LAMA' ? 'rgba(92,60,30,0.55)' : 'rgba(120,150,170,0.35)';
    pin.r(x - w / 2, y - 2, w, 4, cor);
    pin.r(x - w / 2 + 2, y - 3, w - 4, 6, cor);
  }
}

export function desenharClimaNoAr(pin: Pincel, e: EstadoQuadro): void {
  const clima = e.t2?.clima;
  if (!clima) return;
  if (clima === 'NUBLADO' || clima === 'CHUVA') pin.r(0, 0, COLUNAS, LINHAS, clima === 'CHUVA' ? 'rgba(30,40,55,0.18)' : 'rgba(40,48,60,0.1)');
  if (clima === 'SOL') pin.r(0, 0, COLUNAS, LINHAS, 'rgba(255,214,120,0.05)');
  if (clima !== 'CHUVA') return;
  // Pingos em diagonal, descendo com o tempo de jogo.
  for (let i = 0; i < 140; i++) {
    const x = (ruido(i, 1, 51) * COLUNAS + e.t * 9) % COLUNAS;
    const y = (ruido(i, 2, 53) * LINHAS + e.t * 70) % LINHAS;
    pin.r(x, y, 1, 4, 'rgba(200,220,235,0.45)');
  }
}

/** Cartão em cima de quem levou, enquanto o letreiro da falta está na tela. */
export function desenharCartao(pin: Pincel, e: EstadoQuadro, noCampo: (p: { x: number; y: number }) => { x: number; y: number }): void {
  const d = e.destaque;
  if (!d || d.tipo !== 'FALTA' || !d.cartao || d.progresso > 0.8) return;
  // Com o juiz em campo (ADR-0041), é ele quem levanta o cartão.
  if (e.juiz) return;
  const j = e.jogadores.find((x) => x.slot.lado === d.protagonista.lado && x.slot.indice === d.protagonista.indice);
  if (!j) return;
  const p = noCampo(j.pos);
  const sobe = Math.round(Math.min(1, d.progresso / 0.15) * 4);
  const x = p.x + 7;
  const y = p.y - 34 - sobe;
  pin.r(x - 1, y - 1, 7, 10, COR.contorno);
  pin.r(x, y, 5, 8, d.cartao === 'VERMELHO' ? '#D7263D' : '#F6D02F');
  pin.r(x, y, 5, 1, 'rgba(255,255,255,0.5)');
}

function escurecer(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  const f = (s: number) => Math.round(((v >> s) & 255) * 0.62);
  return `rgb(${f(16)},${f(8)},${f(0)})`;
}
