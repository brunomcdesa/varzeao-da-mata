/**
 * Desenha um EstadoQuadro num canvas 9:16 (1080×1920 no vídeo; qualquer tamanho no site,
 * pois tudo é proporcional à largura).
 */
import { IDENTIDADE, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';
import type { EstadoQuadro, Ponto } from './timeline.js';

export interface OpcoesDesenho {
  times: Record<Lado, TimeId>;
  /** @ de cada lugar da Escalação; null = Jogador da Base. */
  nomes: Record<Lado, (string | null)[]>;
  /** Família tipográfica do placar e dos letreiros (precisa estar carregada na página). */
  fonteDisplay?: string;
  fonteTexto?: string;
}

const GRAMA_A = '#2F7D3A';
const GRAMA_B = '#2A7334';
const LINHA = 'rgba(255,255,255,0.82)';
const FUNDO = '#10241A';

export function desenharQuadro(ctx: CanvasRenderingContext2D, estado: EstadoQuadro, o: OpcoesDesenho): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const u = W / 1080; // unidade: 1px no vídeo de 1080 de largura
  const display = o.fonteDisplay ?? 'sans-serif';
  const texto = o.fonteTexto ?? 'sans-serif';

  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, W, H);

  const campo = { x: 70 * u, y: 250 * u, w: W - 140 * u, h: H - 330 * u };
  const P = (p: Ponto) => ({ x: campo.x + p.x * campo.w, y: campo.y + p.y * campo.h });

  desenharCampo(ctx, campo, u);

  // Jogadores (visitante primeiro, mandante por cima: o mandante "joga em casa").
  const ordem = [...estado.jogadores].sort((a, b) => (a.slot.lado === b.slot.lado ? 0 : a.slot.lado === 'visitante' ? -1 : 1));
  for (const j of ordem) {
    const id = IDENTIDADE[o.times[j.slot.lado]];
    const { x, y } = P(j.pos);
    const r = (j.posicao === 'GOL' ? 30 : 27) * u;
    ctx.beginPath();
    ctx.arc(x, y + 5 * u, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = j.posicao === 'GOL' ? id.secundaria : id.primaria;
    ctx.fill();
    ctx.lineWidth = 6 * u;
    ctx.strokeStyle = j.posicao === 'GOL' ? id.primaria : id.secundaria;
    ctx.stroke();

    const nome = o.nomes[j.slot.lado][j.slot.indice] ?? 'Base';
    ctx.font = `600 ${22 * u}px ${texto}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(nome, x, y + r + 6 * u);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(nome, x, y + r + 6 * u);
  }

  // Bola.
  const b = P(estado.bola);
  ctx.beginPath();
  ctx.arc(b.x, b.y + 4 * u, 13 * u, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(b.x, b.y, 13 * u, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 3 * u;
  ctx.strokeStyle = '#1B1B1B';
  ctx.stroke();

  desenharPlacar(ctx, estado, o, u, display);
  if (estado.destaque) desenharDestaque(ctx, estado, o, u, display, texto);
}

function desenharCampo(ctx: CanvasRenderingContext2D, c: { x: number; y: number; w: number; h: number }, u: number): void {
  const faixas = 10;
  for (let i = 0; i < faixas; i++) {
    ctx.fillStyle = i % 2 === 0 ? GRAMA_A : GRAMA_B;
    ctx.fillRect(c.x, c.y + (c.h / faixas) * i, c.w, c.h / faixas + 1);
  }
  ctx.strokeStyle = LINHA;
  ctx.lineWidth = 5 * u;
  ctx.strokeRect(c.x, c.y, c.w, c.h);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + c.h / 2);
  ctx.lineTo(c.x + c.w, c.y + c.h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w * 0.14, 0, Math.PI * 2);
  ctx.stroke();
  // Áreas e gols.
  const areaW = c.w * 0.5;
  const areaH = c.h * 0.12;
  const golW = c.w * 0.24;
  for (const topo of [true, false]) {
    const y = topo ? c.y : c.y + c.h - areaH;
    ctx.strokeRect(c.x + (c.w - areaW) / 2, y, areaW, areaH);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(c.x + (c.w - golW) / 2, topo ? c.y - 14 * u : c.y + c.h, golW, 14 * u);
  }
}

function desenharPlacar(ctx: CanvasRenderingContext2D, e: EstadoQuadro, o: OpcoesDesenho, u: number, display: string): void {
  const W = ctx.canvas.width;
  const m = IDENTIDADE[o.times.mandante];
  const v = IDENTIDADE[o.times.visitante];
  const y = 70 * u;
  const h = 120 * u;
  const largura = 820 * u;
  const x = (W - largura) / 2;

  ctx.fillStyle = '#0B1711';
  ctx.fillRect(x, y, largura, h);
  ctx.fillStyle = m.primaria;
  ctx.fillRect(x, y, 22 * u, h);
  ctx.fillStyle = v.primaria;
  ctx.fillRect(x + largura - 22 * u, y, 22 * u, h);

  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${64 * u}px ${display}`;
  ctx.textAlign = 'left';
  ctx.fillText(m.sigla, x + 50 * u, y + h / 2);
  ctx.textAlign = 'right';
  ctx.fillText(v.sigla, x + largura - 50 * u, y + h / 2);
  ctx.textAlign = 'center';
  ctx.font = `700 ${84 * u}px ${display}`;
  ctx.fillText(`${e.placar.mandante}  ${e.placar.visitante}`, W / 2, y + h / 2);

  ctx.font = `600 ${40 * u}px ${display}`;
  ctx.fillStyle = '#F5D547';
  ctx.fillText(e.encerrada ? 'FIM' : `${e.minuto}'`, W / 2, y + h + 40 * u);
}

function desenharDestaque(
  ctx: CanvasRenderingContext2D,
  e: EstadoQuadro,
  o: OpcoesDesenho,
  u: number,
  display: string,
  texto: string,
): void {
  const d = e.destaque!;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const id = IDENTIDADE[o.times[d.lado]];
  const nome = o.nomes[d.protagonista.lado][d.protagonista.indice] ?? 'Jogador da Base';
  const entrada = Math.min(1, d.progresso * 6);
  const saida = d.progresso > 0.85 ? (1 - d.progresso) / 0.15 : 1;
  const alpha = Math.min(entrada, saida);

  const titulo = d.tipo === 'GOL' ? 'GOOOL!' : d.tipo === 'DEFESA' ? 'DEFESAÇA' : d.tipo === 'DESARME' ? 'DESARME' : 'PRA FORA';
  const grande = d.tipo === 'GOL';
  const h = (grande ? 250 : 150) * u;
  const y = grande ? H * 0.42 - h / 2 : H - 260 * u;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grande ? id.primaria : 'rgba(11,23,17,0.88)';
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = id.secundaria;
  ctx.fillRect(0, y, W, 10 * u);
  ctx.fillRect(0, y + h - 10 * u, W, 10 * u);

  const corTexto = grande ? contrasteSobre(id.primaria) : '#FFFFFF';
  ctx.fillStyle = corTexto;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const escala = grande ? 1 + 0.08 * Math.sin(Math.min(1, d.progresso * 4) * Math.PI) : 1;
  ctx.font = `800 ${(grande ? 120 : 64) * u * escala}px ${display}`;
  ctx.fillText(titulo, W / 2, y + h * 0.4);
  ctx.font = `600 ${(grande ? 46 : 34) * u}px ${texto}`;
  ctx.fillText(nome, W / 2, y + h * 0.78);
  ctx.restore();
}

/** Preto ou branco, o que tiver mais contraste com a cor de fundo. */
function contrasteSobre(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luz = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luz > 0.6 ? '#111111' : '#FFFFFF';
}
