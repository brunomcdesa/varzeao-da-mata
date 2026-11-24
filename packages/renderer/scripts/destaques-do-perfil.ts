/**
 * Exporta as capas e os Stories dos destaques do perfil (ADR-0108).
 *
 *   pnpm destaques-do-perfil <pasta> [--campeao CAP] [--temporada 1] [--craque apelido]
 *
 * Sem --campeao, vale a lista CAMPEOES de src/destaquesDoPerfil.ts (T1: Onça).
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { TIMES, type TimeId } from '@liga/shared';
import { exportarDestaques } from './gravacao.js';

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: { campeao: { type: 'string' }, temporada: { type: 'string', default: '1' }, craque: { type: 'string' } },
});
const time = a.campeao?.toUpperCase() as TimeId | undefined;
if (time && !TIMES.includes(time)) throw new Error(`Time desconhecido: ${time}`);
await exportarDestaques(resolve(process.cwd(), positionals[0] ?? 'destaques'), time ? { temporada: Number(a.temporada), time, ...(a.craque ? { craque: a.craque } : {}) } : undefined);
