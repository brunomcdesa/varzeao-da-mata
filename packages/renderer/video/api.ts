/**
 * Contrato da página de gravação (window.varzea): o que o gravador (Node) pode pedir à
 * página (navegador). Só tipos, para os dois lados compartilharem sem puxar código de tela.
 */
import type { TimeId } from '@liga/shared';
import type { DadosDoResumo } from '../src/resumo.js';
import type { DadosDaApresentacao } from '../src/apresentacao.js';
import type { PartidaParaVideo } from '../src/video.js';
import type { DadosDaExplicacao } from '../src/explicacaoEscalacao.js';
import type { DadosDaExplicacaoOvr } from '../src/explicacaoOvr.js';
import type { DadosDoAgradecimentoT1 } from '../src/agradecimentoT1.js';

export interface VarzeaApi {
  preparar(dados: PartidaParaVideo, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararResumo(dados: DadosDoResumo, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararApresentacao(dados: DadosDaApresentacao, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararAnuncio(minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararExplicacao(dados: DadosDaExplicacao, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararExplicacaoOvr(dados: DadosDaExplicacaoOvr, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararAgradecimentoT1(dados: DadosDoAgradecimentoT1, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  desenhar(n: number): void;
  /** Desenha `quantos` quadros a partir de `inicio` e devolve cada um como JPEG em base64. */
  capturar(inicio: number, quantos: number, qualidade?: number): string[];
  /** Capa do Reels da Partida preparada, em JPEG base64. */
  capa(qualidade?: number): string;
  segmentos(): { tipo: string; inicio: number; fim: number; resolucao?: number }[];
  escudoPng(time: TimeId, escala: number): string;
  times(): TimeId[];
}

declare global {
  interface Window {
    varzea: VarzeaApi;
  }
}
