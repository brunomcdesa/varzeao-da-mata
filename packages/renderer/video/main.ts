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
import { ALTURA_ESCUDO, LARGURA_ESCUDO, definirEstrelas, escudo as escudoDoTime } from '../src/escudos.js';
import type { VarzeaApi } from './api.js';
import { RoteiroResumo, desenharQuadroResumo, type DadosDoResumo } from '../src/resumo.js';
import { RoteiroApresentacao, desenharQuadroApresentacao, type DadosDaApresentacao } from '../src/apresentacao.js';
import { RoteiroAberturaDaTemporada, desenharQuadroAbertura, type DadosDaAberturaDaTemporada } from '../src/aberturaTemporada.js';
import { definirAparencias, definirItens } from '../src/sprites.js';
import telaBusca from './telas/1-busca.png';
import telaConvite from './telas/2-convite.png';
import telaCodigo from './telas/3-codigo.png';
import telaVinculado from './telas/4-vinculado.png';
import telaTransferencia from './telas/5-transferencia.png';
import telaPedido from './telas/6-pedido.png';
import telaFeito from './telas/7-feito.png';
import telaVisual from './telas/8-visual.png';
import telaVisualEscolhido from './telas/8b-visual-escolhido.png';
import telaCamisa from './telas/9-visual-escolhido.png';
import telaCard from './telas/11-card.png';
import emojiGol from './emojis/gol.png';
import emojiFogo from './emojis/fogo.png';
import emojiSusto from './emojis/susto.png';
import emojiPalmas from './emojis/palmas.png';
import { RoteiroNovidades, desenharQuadroNovidades, type DadosDasNovidades } from '../src/novidades.js';
import { RoteiroAnuncio, desenharQuadroAnuncio, type TelaDoSite } from '../src/anuncio.js';
import { RoteiroExplicacao, desenharQuadroExplicacao, type DadosDaExplicacao } from '../src/explicacaoEscalacao.js';
import { RoteiroExplicacaoOvr, desenharQuadroExplicacaoOvr, type DadosDaExplicacaoOvr } from '../src/explicacaoOvr.js';
import { RoteiroAgradecimentoT1, desenharQuadroAgradecimentoT1, type DadosDoAgradecimentoT1 } from '../src/agradecimentoT1.js';
import { RoteiroRebalanceamentoT2, desenharQuadroRebalanceamentoT2, type DadosDoRebalanceamentoT2 } from '../src/rebalanceamentoT2.js';
import { RoteiroPerfilDoTime, desenharQuadroPerfilDoTime, type DadosDoPerfilDoTime } from '../src/perfilDoTime.js';
import { RoteiroMudancaDeEndereco, desenharQuadroMudancaDeEndereco } from '../src/mudancaDeEndereco.js';
import { desenharCapaDoDestaque, desenharStory, type CampeaoNoDestaque, type Destaque, type Story } from '../src/destaquesDoPerfil.js';
import { Roteiro, Timeline, desenharCapa, desenharQuadroVideo, type OpcoesVideo, type PartidaParaVideo } from '../src/index.js';

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
/** Quando preenchido, a página grava o Reels de apresentação da Liga. */
let apresentacao: RoteiroApresentacao | null = null;
let abertura: RoteiroAberturaDaTemporada | null = null;
let fps = 30;
/** Quando preenchido, a página grava o Reels de anúncio (vínculo pela DM). */
let anuncio: RoteiroAnuncio | null = null;
/** Quando preenchido, a página grava o Reels que explica a Escalação. */
let explicacao: RoteiroExplicacao | null = null;
/** Quando preenchido, a página grava o Reels que explica o OVR. */
let explicacaoOvr: RoteiroExplicacaoOvr | null = null;
let agradecimento: RoteiroAgradecimentoT1 | null = null;
let rebalanceamento: RoteiroRebalanceamentoT2 | null = null;
/** Quando preenchido, a página grava o Reels do Perfil do Time (ADR-0100). */
let perfilDoTime: RoteiroPerfilDoTime | null = null;
/** Quando preenchido, a página grava o Reels da Mudança de Endereço (ADR-0104). */
let mudancaDeEndereco: RoteiroMudancaDeEndereco | null = null;
/** Quando preenchido, a página grava um Reels de Novidades da T2 (ADR-0063). */
let novidades: RoteiroNovidades | null = null;
const emojis: HTMLImageElement[] = [emojiGol, emojiFogo, emojiSusto, emojiPalmas].map((src) => Object.assign(new Image(), { src }));
const emojisProntos = Promise.all(emojis.map((img) => img.decode()));
const URL_DAS_TELAS: Record<TelaDoSite, string> = { busca: telaBusca, convite: telaConvite, codigo: telaCodigo, vinculado: telaVinculado, transferencia: telaTransferencia, pedido: telaPedido, feito: telaFeito, visual: telaVisual, visualEscolhido: telaVisualEscolhido, camisa: telaCamisa, card: telaCard };
const telas: Partial<Record<TelaDoSite, HTMLImageElement>> = {};
const telasProntas = Promise.all(
  (Object.entries(URL_DAS_TELAS) as [TelaDoSite, string][]).map(
    ([nome, url]) =>
      new Promise<void>((ok, erro) => {
        const img = new Image();
        img.onload = () => ok();
        img.onerror = () => erro(new Error(`tela ${nome} não carregou`));
        img.src = url;
        telas[nome] = img;
      }),
  ),
);

async function prepararAnuncio(minimos: Record<number, { antes?: number }> = {}, quadrosPorSegundo = 30): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto, telasProntas]);
  fps = quadrosPorSegundo;
  novidades = null;
  resumo = null;
  apresentacao = null;
  abertura = null;
  explicacao = null;
  explicacaoOvr = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  anuncio = new RoteiroAnuncio(minimos);
  return { duracao: anuncio.duracao, totalQuadros: anuncio.totalQuadros(fps) };
}

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
  novidades = null;
  resumo = null;
  apresentacao = null;
  abertura = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  definirAparencias(dados.aparencias ?? {});
  definirItens(dados.itensAtuais ?? {});
  definirEstrelas(dados.estrelas ?? {});
  roteiro = new Roteiro(new Timeline(dados.resultado, dados.escalacoes), dados.roteiro);
  opcoes = {
    times: dados.resultado.times,
    nomes: dados.nomes,
    ...(dados.apelidos ? { apelidos: dados.apelidos } : {}),
    ...(dados.numeros ? { numeros: dados.numeros } : {}),
    ...(dados.itens ? { itens: dados.itens } : {}),
    ...(dados.gritos ? { gritos: dados.gritos } : {}),
    ...(dados.tecnicos ? { tecnicos: dados.tecnicos } : {}),
    ...(dados.capitaes ? { capitaes: dados.capitaes } : {}),
    ...(dados.suspensao ? { suspensao: dados.suspensao } : {}),
    escudo,
    ...(dados.subtitulo ? { subtitulo: dados.subtitulo } : {}),
    ...(dados.mataMata ? { mataMata: dados.mataMata } : {}),
    ...(dados.briga ? { briga: dados.briga } : {}),
    ...(dados.grupo ? { grupo: dados.grupo } : {}),
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
  novidades = null;
  apresentacao = null;
  abertura = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  definirAparencias(dados.aparencias ?? {});
  definirItens(dados.itens ?? {});
  definirEstrelas(dados.estrelas ?? {});
  resumo = new RoteiroResumo(dados, minimos);
  return { duracao: resumo.duracao, totalQuadros: resumo.totalQuadros(fps) };
}

async function prepararApresentacao(
  dados: DadosDaApresentacao,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  resumo = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  abertura = null;
  apresentacao = new RoteiroApresentacao(dados, minimos);
  return { duracao: apresentacao.duracao, totalQuadros: apresentacao.totalQuadros(fps) };
}

async function prepararAberturaDaTemporada(
  dados: DadosDaAberturaDaTemporada,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  resumo = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  apresentacao = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  definirEstrelas(dados.estrelas ?? {});
  roteiro = null;
  abertura = new RoteiroAberturaDaTemporada(dados, minimos);
  return { duracao: abertura.duracao, totalQuadros: abertura.totalQuadros(fps) };
}

async function prepararExplicacao(
  dados: DadosDaExplicacao,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  resumo = null;
  apresentacao = null;
  abertura = null;
  anuncio = null;
  explicacaoOvr = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  explicacao = new RoteiroExplicacao(dados, minimos);
  return { duracao: explicacao.duracao, totalQuadros: explicacao.totalQuadros(fps) };
}

async function prepararExplicacaoOvr(
  dados: DadosDaExplicacaoOvr,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  resumo = null;
  apresentacao = null;
  abertura = null;
  anuncio = null;
  explicacao = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  explicacaoOvr = new RoteiroExplicacaoOvr(dados, minimos);
  return { duracao: explicacaoOvr.duracao, totalQuadros: explicacaoOvr.totalQuadros(fps) };
}

async function prepararAgradecimentoT1(
  dados: DadosDoAgradecimentoT1,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  roteiro = null;
  resumo = null;
  apresentacao = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  abertura = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  agradecimento = new RoteiroAgradecimentoT1(dados, minimos);
  return { duracao: agradecimento.duracao, totalQuadros: agradecimento.totalQuadros(fps) };
}

async function prepararRebalanceamentoT2(
  dados: DadosDoRebalanceamentoT2,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  roteiro = null;
  resumo = null;
  apresentacao = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  abertura = null;
  agradecimento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  rebalanceamento = new RoteiroRebalanceamentoT2(dados, minimos);
  return { duracao: rebalanceamento.duracao, totalQuadros: rebalanceamento.totalQuadros(fps) };
}

async function prepararNovidades(
  dados: DadosDasNovidades,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto, emojisProntos]);
  fps = quadrosPorSegundo;
  novidades = null;
  roteiro = null;
  resumo = null;
  apresentacao = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  abertura = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = null;
  novidades = new RoteiroNovidades(dados, minimos);
  return { duracao: novidades.duracao, totalQuadros: novidades.totalQuadros(fps) };
}

async function prepararPerfilDoTime(
  dados: DadosDoPerfilDoTime,
  minimos: Record<number, { antes?: number }> = {},
  quadrosPorSegundo = 30,
): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  roteiro = null;
  resumo = null;
  apresentacao = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  abertura = null;
  agradecimento = null;
  rebalanceamento = null;
  mudancaDeEndereco = null;
  perfilDoTime = new RoteiroPerfilDoTime(dados, minimos);
  return { duracao: perfilDoTime.duracao, totalQuadros: perfilDoTime.totalQuadros(fps) };
}

async function prepararMudancaDeEndereco(minimos: Record<number, { antes?: number }> = {}, quadrosPorSegundo = 30): Promise<{ duracao: number; totalQuadros: number }> {
  await Promise.all([fontesProntas, escudoPronto]);
  fps = quadrosPorSegundo;
  novidades = null;
  roteiro = null;
  resumo = null;
  apresentacao = null;
  anuncio = null;
  explicacao = null;
  explicacaoOvr = null;
  abertura = null;
  agradecimento = null;
  rebalanceamento = null;
  perfilDoTime = null;
  mudancaDeEndereco = new RoteiroMudancaDeEndereco(minimos);
  return { duracao: mudancaDeEndereco.duracao, totalQuadros: mudancaDeEndereco.totalQuadros(fps) };
}

function desenhar(n: number): void {
  if (mudancaDeEndereco) return desenharQuadroMudancaDeEndereco(ctx, mudancaDeEndereco, n / fps, { escudo });
  if (perfilDoTime) return desenharQuadroPerfilDoTime(ctx, perfilDoTime, n / fps, { escudo });
  if (novidades) return desenharQuadroNovidades(ctx, novidades, n / fps, { escudo, emojis });
  if (agradecimento) return desenharQuadroAgradecimentoT1(ctx, agradecimento, n / fps, { escudo });
  if (rebalanceamento) return desenharQuadroRebalanceamentoT2(ctx, rebalanceamento, n / fps, { escudo });
  if (explicacaoOvr) return desenharQuadroExplicacaoOvr(ctx, explicacaoOvr, n / fps, { escudo });
  if (explicacao) return desenharQuadroExplicacao(ctx, explicacao, n / fps, { escudo });
  if (anuncio) return desenharQuadroAnuncio(ctx, anuncio, n / fps, { escudo, telas });
  if (abertura) return desenharQuadroAbertura(ctx, abertura, n / fps, { escudo });
  if (apresentacao) return desenharQuadroApresentacao(ctx, apresentacao, n / fps, { escudo });
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

function capa(qualidade = 0.95): string {
  if (!roteiro || !opcoes) throw new Error('chame varzea.preparar antes');
  desenharCapa(ctx, roteiro.timeline.resultado, opcoes);
  return canvas.toDataURL('image/jpeg', qualidade).slice('data:image/jpeg;base64,'.length);
}

/** Segmentos do roteiro (para a prévia escolher quadros-chave). */
function segmentos(): { tipo: string; inicio: number; fim: number; resolucao?: number }[] {
  if (mudancaDeEndereco) return mudancaDeEndereco.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (perfilDoTime) return perfilDoTime.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (novidades) return novidades.segmentos.map((s) => ({ tipo: s.cena.id, inicio: s.inicio, fim: s.fim }));
  if (agradecimento) return agradecimento.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (rebalanceamento) return rebalanceamento.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (explicacaoOvr) return explicacaoOvr.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (explicacao) return explicacao.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (anuncio) return anuncio.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (abertura) return abertura.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
  if (apresentacao) return apresentacao.segmentos.map((s) => ({ tipo: s.cartela, inicio: s.inicio, fim: s.fim }));
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

/** Capa de destaque num canvas quadrado próprio (o do vídeo é 9:16). */
async function capaDoDestaque(id: Destaque): Promise<string> {
  await Promise.all([fontesProntas, escudoPronto]);
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1080;
  desenharCapaDoDestaque(c.getContext('2d')!, id, { escudo });
  return c.toDataURL('image/png').slice('data:image/png;base64,'.length);
}

async function storyDoDestaque(story: Story, campeao?: CampeaoNoDestaque): Promise<string> {
  await Promise.all([fontesProntas, escudoPronto]);
  desenharStory(ctx, story, { escudo, ...(campeao ? { campeao } : {}) });
  return canvas.toDataURL('image/jpeg', 0.95).slice('data:image/jpeg;base64,'.length);
}

const api: VarzeaApi = { preparar, prepararResumo, prepararApresentacao, prepararAberturaDaTemporada, prepararAnuncio, prepararExplicacao, prepararExplicacaoOvr, prepararAgradecimentoT1, prepararRebalanceamentoT2, prepararNovidades, prepararPerfilDoTime, prepararMudancaDeEndereco, desenhar, capturar, capa, segmentos, escudoPng, capaDoDestaque, storyDoDestaque, times: () => [...TIMES] };
window.varzea = api;
