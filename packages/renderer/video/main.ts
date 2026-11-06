/**
 * Página de gravação do Reels (modo quadro a quadro). Não tem relógio nem animação própria:
 * quem controla é o script de gravação, que chama `varzea.preparar` e depois pede cada
 * quadro pelo número. O quadro N é sempre igual, então dá para regravar só um trecho.
 */
import jersey400 from '@fontsource/jersey-10/files/jersey-10-latin-400-normal.woff2';
import pixelify500 from '@fontsource/pixelify-sans/files/pixelify-sans-latin-500-normal.woff2';
import pixelify600 from '@fontsource/pixelify-sans/files/pixelify-sans-latin-600-normal.woff2';
import pixelify700 from '@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2';
import escudoDaLigaPng from '../../../docs/marca/escudo.png';
import { TIMES, type TimeId } from '@liga/shared';
import { ALTURA_ESCUDO, LARGURA_ESCUDO, escudo as escudoDoTime } from '../src/escudos.js';
import type { VarzeaApi } from './api.js';
import { RoteiroResumo, desenharQuadroResumo, type DadosDoResumo } from '../src/resumo.js';
import { Roteiro, Timeline, desenharQuadroVideo, type OpcoesVideo, type PartidaParaVideo } from '../src/index.js';

const FONTES: [string, string, string][] = [
  ['Jersey 10', '400', jersey400],
  ['Pixelify Sans', '500', pixelify500],
  ['Pixelify Sans', '600', pixelify600],
  ['Pixelify Sans', '700', pixelify700],
];

const canvas = document.getElementById('video') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let roteiro: Roteiro | null = null;
let opcoes: OpcoesVideo | null = null;
/** Quando preenchido, a página grava o Resumo da Rodada em vez de uma Partida. */
let resumo: RoteiroResumo | null = null;
let fps = 30;

const escudo = new Image();
const escudoPronto = new Promise<void>((ok, erro) => {
  escudo.onload = () => ok();
  escudo.onerror = () => erro(new Error('escudo não carregou'));
  escudo.src = escudoDaLigaPng;
});

const fontesProntas = Promise.all(
  FONTES.map(async ([familia, peso, url]) => {
    const f = new FontFace(familia, `url(${url})`, { weight: peso });
    await f.load();
    document.fonts.add(f);
  }),
);

async function preparar(dados: PartidaParaVideo, quadrosPorSegundo = 30): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  resumo = null;
  roteiro = new Roteiro(new Timeline(dados.resultado, dados.escalacoes), dados.roteiro);
  opcoes = {
    times: dados.resultado.times,
    nomes: dados.nomes,
    escudo,
    ...(dados.subtitulo ? { subtitulo: dados.subtitulo } : {}),
  };
  return { duracao: roteiro.duracao, totalQuadros: roteiro.totalQuadros(fps) };
}

async function prepararResumo(
  dados: DadosDoResumo,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  resumo = new RoteiroResumo(dados, minimos);
  return { duracao: resumo.duracao, totalQuadros: resumo.totalQuadros(fps) };
}

function desenhar(n: number): void {
  if (resumo) return desenharQuadroResumo(ctx, resumo, n / fps, { escudo });
  if (!roteiro || !opcoes) throw new Error('chame varzea.preparar antes');
  desenharQuadroVideo(ctx, roteiro, n / fps, opcoes);
}

/** Desenha `quantos` quadros a partir de `inicio` e devolve cada um como JPEG em base64. */
function capturar(inicio: number, quantos: number, qualidade = 0.92): string[] {
  const saida: string[] = [];
  for (let n = inicio; n < inicio + quantos; n++) {
    desenhar(n);
    saida.push(canvas.toDataURL('image/jpeg', qualidade).slice('data:image/jpeg;base64,'.length));
  }
  return saida;
}

/** Segmentos do roteiro (para a prévia escolher quadros-chave). */
function segmentos(): { tipo: string; inicio: number; fim: number; resolucao?: number }[] {
  if (resumo) return resumo.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (!roteiro) throw new Error('chame varzea.preparar antes');
  return roteiro.segmentos.map((s) => ({ tipo: s.tipo, inicio: s.inicio, fim: s.fim, ...(s.resolucao !== undefined ? { resolucao: s.resolucao } : {}) }));
}

/** Escudo de um Time ampliado, em PNG base64 (para exportar as artes). */
function escudoPng(time: TimeId, escala: number): string {
  const c = document.createElement('canvas');
  c.width = LARGURA_ESCUDO * escala;
  c.height = ALTURA_ESCUDO * escala;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(escudoDoTime(time), 0, 0, c.width, c.height);
  return c.toDataURL('image/png').slice('data:image/png;base64,'.length);
}

const api: VarzeaApi = { preparar, prepararResumo, desenhar, capturar, segmentos, escudoPng, times: () => [...TIMES] };
window.varzea = api;
