/**
 * Contrato da página de gravação (window.varzea): o que o gravador (Node) pode pedir à
 * página (navegador). Só tipos, para os dois lados compartilharem sem puxar código de tela.
 */
import type { TimeId } from '@liga/shared';
import type { DadosDoResumo } from '../src/resumo.js';
import type { DadosDaApresentacao } from '../src/apresentacao.js';
import type { DadosDaAberturaDaTemporada } from '../src/aberturaTemporada.js';
import type { PartidaParaVideo } from '../src/video.js';
import type { DadosDaExplicacao } from '../src/explicacaoEscalacao.js';
import type { DadosDaExplicacaoOvr } from '../src/explicacaoOvr.js';
import type { DadosDoAgradecimentoT1 } from '../src/agradecimentoT1.js';
import type { DadosDoAgradecimentoT2 } from '../src/agradecimentoT2.js';
import type { DadosDoRebalanceamentoT2 } from '../src/rebalanceamentoT2.js';
import type { DadosDasNovidades } from '../src/novidades.js';
import type { DadosDoPerfilDoTime } from '../src/perfilDoTime.js';
import type { CampeaoNoDestaque, Destaque, Story } from '../src/destaquesDoPerfil.js';

export interface VarzeaApi {
  preparar(dados: PartidaParaVideo, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararResumo(dados: DadosDoResumo, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararApresentacao(dados: DadosDaApresentacao, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararAberturaDaTemporada(dados: DadosDaAberturaDaTemporada, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararAnuncio(minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararExplicacao(dados: DadosDaExplicacao, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararExplicacaoOvr(dados: DadosDaExplicacaoOvr, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararAgradecimentoT1(dados: DadosDoAgradecimentoT1, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararAgradecimentoT2(dados: DadosDoAgradecimentoT2, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararRebalanceamentoT2(dados: DadosDoRebalanceamentoT2, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararNovidades(dados: DadosDasNovidades, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararPerfilDoTime(dados: DadosDoPerfilDoTime, minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  prepararMudancaDeEndereco(minimos?: Record<number, { antes?: number }>, fps?: number): Promise<{ duracao: number; totalQuadros: number }>;
  desenhar(n: number): void;
  /** Desenha `quantos` quadros a partir de `inicio` e devolve cada um como JPEG em base64. */
  capturar(inicio: number, quantos: number, qualidade?: number): string[];
  /** Capa do Reels da Partida preparada, em JPEG base64. */
  capa(qualidade?: number): string;
  segmentos(): { tipo: string; inicio: number; fim: number; resolucao?: number }[];
  escudoPng(time: TimeId, escala: number): string;
  /** Destaques do perfil (ADR-0109): capa (PNG 1080 × 1080) ou Story (JPEG 1080 × 1920), em base64. */
  capaDoDestaque(id: Destaque): Promise<string>;
  storyDoDestaque(story: Story, campeao?: CampeaoNoDestaque): Promise<string>;
  times(): TimeId[];
}

declare global {
  interface Window {
    varzea: VarzeaApi;
  }
}
