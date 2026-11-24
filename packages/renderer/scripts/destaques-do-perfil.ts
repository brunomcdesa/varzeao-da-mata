/**
 * Exporta as capas e os Stories dos destaques do perfil (ADR-0109).
 *
 *   pnpm destaques-do-perfil <pasta> [--video] [--campeao CAP] [--temporada 1] [--craque apelido]
 *
 * Com --video, cada Story sai em MP4 de 15 s com a trilha dos Reels (ADR-0110).
 *
 * Sem --campeao, vale a lista CAMPEOES de src/destaquesDoPerfil.ts (T1: Onça).
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { TIMES, type TimeId } from '@liga/shared';
import { exportarDestaques } from './gravacao.js';

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: { video: { type: 'boolean' }, campeao: { type: 'string' }, temporada: { type: 'string', default: '1' }, craque: { type: 'string' } },
});
const time = a.campeao?.toUpperCase() as TimeId | undefined;
if (time && !TIMES.includes(time)) throw new Error(`Time desconhecido: ${time}`);
await exportarDestaques(resolve(process.cwd(), positionals[0] ?? 'destaques'), time ? { temporada: Number(a.temporada), time, ...(a.craque ? { craque: a.craque } : {}) } : undefined, a.video ?? false);
