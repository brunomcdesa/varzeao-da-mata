/**
 * Prévia da cartela das Chances (ADR-0099) com uma tabela da T2 depois da Rodada 4 e os jogos
 * que faltam: só os quadros-chave, sem voz.
 *
 *   pnpm --filter @liga/renderer exec tsx scripts/previa-chances.ts <pasta>
 */
import { resolve } from 'node:path';
import { CAEM_POR_GRUPO, CLASSIFICAM_POR_GRUPO, chancesDaTabela, type Grupo, type TimeId } from '@liga/shared';
import { RoteiroResumo, narracaoDoResumo, type DadosDoResumo } from '../src/resumo.js';
import { gravarResumo } from './gravacao.js';

const pasta = resolve(process.cwd(), process.argv[2] ?? 'previa-chances');
type L = [TimeId, number, number, number, number, number];
// time, jogos, pontos, vitórias, gols marcados, saldo (Grupos do Barro e do Galho depois da Rodada 4 da T2).
const TABELAS: Record<Grupo, L[]> = {
  CHAO: [['LOB', 4, 10, 3, 15, 8], ['CAP', 4, 10, 3, 11, 6], ['ONC', 4, 9, 3, 9, 2], ['JAC', 4, 6, 2, 10, 1], ['SUC', 4, 6, 2, 9, -2], ['TAM', 4, 3, 1, 8, -4], ['LEA', 4, 3, 1, 6, -6], ['TAT', 4, 0, 0, 3, -5]],
  COPA: [['ARA', 4, 12, 4, 7, 7], ['BOT', 4, 9, 3, 9, 3], ['COR', 4, 9, 3, 9, 3], ['PRE', 4, 7, 2, 7, 3], ['SAG', 4, 6, 2, 12, 2], ['TUC', 4, 4, 1, 5, -5], ['TAR', 4, 0, 0, 3, -6], ['BES', 4, 0, 0, 2, -7]],
};
const FALTAM = 'LEA CAP,BES SAG,JAC TAM,ARA COR,TAT LOB,PRE BOT,ONC SUC,TUC TAR,LEA TAT,TAR PRE,TAM LOB,BOT BES,SUC CAP,COR TUC,JAC ONC,SAG ARA,LOB ONC,BOT SAG,SUC LEA,BES TAR,TAT TAM,ARA TUC,CAP JAC,PRE COR'
  .split(',')
  .map((s) => {
    const [mandante, visitante] = s.split(' ') as [TimeId, TimeId];
    return { mandante, visitante };
  });

const grupos = (['CHAO', 'COPA'] as const).map((grupo) => ({
  grupo,
  tabela: TABELAS[grupo].map(([time, jogos, pontos, vitorias, golsPro, saldo]) => ({ time, jogos, pontos, vitorias, golsPro, saldo })),
}));
const dados: DadosDoResumo = {
  temporada: 2,
  rodada: 4,
  fase: 'LIGA',
  placares: [],
  tabela: [],
  caem: CAEM_POR_GRUPO,
  grupos,
  chances: grupos.map((g) => {
    const times = new Set(g.tabela.map((l) => l.time));
    const faltam = FALTAM.filter((j) => times.has(j.mandante));
    return { grupo: g.grupo, classificam: CLASSIFICAM_POR_GRUPO, caem: CAEM_POR_GRUPO, times: chancesDaTabela(g.tabela, faltam, { classificam: CLASSIFICAM_POR_GRUPO, caem: CAEM_POR_GRUPO }) };
  }),
  novosContratados: [],
  totalNovos: 0,
  candidatos: [],
};

const roteiro = new RoteiroResumo(dados);
const k = roteiro.segmentos.findIndex((s) => s.cartela === 'CHANCES');
const s = roteiro.segmentos[k]!;
console.log('Fala:', narracaoDoResumo(roteiro)[k]!.texto);
await gravarResumo(dados, { saida: resolve(pasta, 'resumo.mp4'), previa: pasta, instantes: [s.inicio + 1.2, s.inicio + (s.fim - s.inicio) * 0.9, s.inicio - 1] });
