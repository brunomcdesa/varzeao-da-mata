/**
 * Formação (ADR-0044): o mini campo de cada Formação no painel do Capitão. O gol do Time fica
 * embaixo; cada bolinha é uma vaga (goleiro, zagueiros, meias e atacantes).
 */
import { VAGAS_DA_FORMACAO, type Formacao, type Posicao } from '@liga/shared';
import { Html, html } from './ui.js';

const LINHA_Y: Record<Posicao, number> = { GOL: 66, ZAG: 52, MEI: 34, ATA: 16 };

/** x de cada vaga numa linha com `n` vagas (campo de 48 de largura). */
const xs = (n: number): number[] => (n === 1 ? [24] : n === 2 ? [15, 33] : [10, 24, 38]);

export function desenhoDaFormacao(f: Formacao) {
  const v = VAGAS_DA_FORMACAO[f];
  const bolas = (['GOL', 'ZAG', 'MEI', 'ATA'] as const).flatMap((p) =>
    xs(v[p]).map((x) => `<rect x="${x - 3}" y="${LINHA_Y[p] - 3}" width="6" height="6" class="vaga vaga-${p.toLowerCase()}"/>`),
  );
  return html`<svg class="mini-campo" viewBox="0 0 48 76" width="48" height="76" aria-hidden="true">
    <rect x="1" y="1" width="46" height="74" class="gramado"/>
    <line x1="1" y1="38" x2="47" y2="38" class="risca"/>
    <rect x="14" y="62" width="20" height="13" class="risca-area"/>
    <rect x="14" y="1" width="20" height="13" class="risca-area"/>
    ${new Html(bolas.join(''))}
  </svg>`;
}
