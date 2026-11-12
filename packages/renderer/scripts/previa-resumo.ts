/**
 * Prévia do Resumo da Rodada com dados de exemplo, sem voz e sem vídeo (só quadros-chave).
 *
 *   pnpm --filter @liga/renderer exec tsx scripts/previa-resumo.ts <pasta> [--series]
 *
 * Com --series, a Rodada tem Série A e Série B (ADR-0017). Com --fim, mostra o anúncio do fim
 * da Temporada (campeão e Craque, e os da Série B com --series).
 */
import { resolve } from 'node:path';
import { TIMES_FUNDADORES, TIMES_NOVOS, rotuloDoCandidato, type Posicao, type Serie, type TimeId } from '@liga/shared';
import { RoteiroResumo, type DadosDoResumo } from '../src/resumo.js';
import { gravarResumo } from './gravacao.js';

const pasta = resolve(process.cwd(), process.argv[2] ?? 'previa-resumo');
const comSeries = process.argv.includes('--series');

const linhas = (times: readonly TimeId[]) =>
  times.map((time, i) => ({ time, jogos: 3, pontos: 9 - i, vitorias: 3 - Math.floor(i / 3), saldo: 5 - i }));
const placares = (times: readonly TimeId[], serie: Serie) =>
  [12, 14, 16, 18].map((hora, k) => ({ mandante: times[k * 2]!, visitante: times[k * 2 + 1]!, golsMandante: (k + 2) % 4, golsVisitante: k % 3, penaltis: null, hora, serie }));
const nomes = ['rafa.gol', 'bia_mata', 'duda10', 'leo.varzea', 'malu_fc', 'gui_oficial', 'nanda.jr', 'pedrinho', 'lari_gol', 'thiago.10'];
const posicoes: Posicao[] = ['ATA', 'MEI', 'GOL', 'ZAG', 'ATA'];
const candidatos = (times: readonly TimeId[], serie: Serie, base: number) =>
  posicoes.map((posicao, k) => {
    const numero = base + k + 1;
    return { numero, rotulo: rotuloDoCandidato(numero, comSeries), serie, username: nomes[numero - 1]!, time: times[k]!, posicao, nota: 9.1 - k * 0.4, gols: posicao === 'ATA' ? 2 : 0 };
  });

// Destaques por Posição (ADR-0041): um por Posição em cada Série.
const destaques = (times: readonly TimeId[], serie: Serie): NonNullable<DadosDoResumo['destaques']> => [
  { posicao: 'GOL', serie, username: serie === 'A' ? 'muralha_da_onca' : 'goleirao.jac', time: times[1]!, nota: 9.3, numero: { valor: 7, legenda: 'defesas' } },
  { posicao: 'ZAG', serie, username: serie === 'A' ? 'ze.zagueiro' : 'xandao_zag', time: times[2]!, nota: 8.4, numero: { valor: 5, legenda: 'desarmes' } },
  { posicao: 'MEI', serie, username: serie === 'A' ? 'bia_mata' : 'meio.campo', time: times[0]!, nota: 7.9, numero: { valor: 2, legenda: 'assistências' } },
  { posicao: 'ATA', serie, username: serie === 'A' ? 'rafa.gol' : 'fa_do_jacare', time: times[4]!, nota: 8.8, numero: { valor: 3, legenda: 'gols' } },
];

const dados: DadosDoResumo = {
  temporada: 2,
  rodada: 3,
  fase: 'LIGA',
  placares: [...placares(TIMES_FUNDADORES, 'A'), ...(comSeries ? placares(TIMES_NOVOS, 'B') : [])],
  tabela: linhas(TIMES_FUNDADORES),
  ...(comSeries ? { tabelaB: linhas(TIMES_NOVOS) } : {}),
  novosContratados: [
    { username: 'fa_do_jacare', time: 'JAC', posicao: 'ATA' },
    { username: 'coruja.noturna', time: 'COR', posicao: 'GOL' },
  ],
  totalNovos: 2,
  candidatos: [...candidatos(TIMES_FUNDADORES, 'A', 0), ...(comSeries ? candidatos(TIMES_NOVOS, 'B', 5) : [])],
  destaques: [...destaques(TIMES_FUNDADORES, 'A'), ...(comSeries ? destaques(TIMES_NOVOS, 'B') : [])],
};

const craque = (username: string, time: TimeId, posicao: Posicao) => ({ username, time, posicao, notaMedia: 8.4, gols: 9, jogos: 9, votos: 41 });
const fim: DadosDoResumo = {
  temporada: 2,
  rodada: 9,
  fase: 'MATA_MATA',
  placares: [],
  tabela: [],
  novosContratados: [],
  totalNovos: 0,
  candidatos: [],
  campeao: 'ONC',
  ...(comSeries ? { campeaoB: 'COR' as TimeId, craqueDaTemporadaB: craque('coruja.noturna', 'COR', 'ATA') } : {}),
  craqueDaTemporada: craque('rafa.gol', 'CAP', 'MEI'),
  fimDaTemporada: { artilheiro: { username: 'rafa.gol', time: 'PRE', posicao: 'ATA', gols: 11 }, proxima: { numero: 3, inicio: '2026-12-01' } },
  destaques: [...destaques(TIMES_FUNDADORES, 'A'), ...(comSeries ? destaques(TIMES_NOVOS, 'B') : [])].map((d) => ({ ...d, nota: d.nota - 1.2 })),
};

const escolhidos = process.argv.includes('--fim') ? fim : dados;
// Um quadro no fim de cada cartela (as do Resumo têm todas o mesmo tipo de segmento).
const fimDasCartelas = new RoteiroResumo(escolhidos).segmentos.map((s) => Math.round((s.inicio + (s.fim - s.inicio) * 0.85) * 10) / 10);
await gravarResumo(escolhidos, { saida: resolve(pasta, 'resumo.mp4'), previa: pasta, instantes: [2, ...fimDasCartelas] } /* t-002.0 = capa do Reels (CAPA_DO_RESUMO_MS) */);
