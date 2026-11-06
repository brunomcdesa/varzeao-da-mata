/**
 * Ponto de entrada dos jobs no GitHub Actions (e para testar na mão):
 *
 *   pnpm job coletar
 *   pnpm job partida [--sem-esperar]
 *   pnpm job resumo
 *
 * Precisa de DATABASE_URL, do Instagram (IG_USER_ID, IG_ACCESS_TOKEN) e do Cloudflare
 * (veja .env.example). Sem Cloudflare, grava em .cache/nuvem-local; sem Instagram, não agenda.
 */
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgendaNaMemoria, Instagram, PastaLocal, conectar, jobColetar, jobPartida, jobResumo, nuvemDoAmbiente, prepararBanco, tokenGuardado, type ContextoDoJob } from '../src/index.js';
import { bancoLocal } from './banco-local.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* no Actions as variáveis vêm dos segredos */
}

const [qual, ...flags] = process.argv.slice(2);
if (!['coletar', 'partida', 'resumo'].includes(qual ?? '')) {
  console.log('Uso: pnpm job coletar | partida [--sem-esperar] | resumo');
  process.exit(1);
}

const banco = process.env.DATABASE_URL ? conectar() : await bancoLocal(join(raizRepo, '.cache/liga-local'));
try {
  await prepararBanco(banco);
  const nuvem = nuvemDoAmbiente();
  if (!nuvem) console.log('Cloudflare não configurado: gravando em .cache/nuvem-local.');
  const token = (await tokenGuardado(banco))?.token ?? process.env.IG_ACCESS_TOKEN;
  const ig = process.env.IG_USER_ID && token ? new Instagram({ userId: process.env.IG_USER_ID, token }) : null;
  if (!ig) console.log('Instagram não configurado: não lê comentários nem agenda Reels.');

  const precisaGravar = qual !== 'coletar';
  const gravacao = precisaGravar ? await import('@liga/renderer/gravacao') : null;
  const ctx: ContextoDoJob = {
    banco,
    armazenamento: nuvem?.armazenamento ?? new PastaLocal(join(raizRepo, '.cache/nuvem-local')),
    agenda: nuvem?.agenda ?? new AgendaNaMemoria(),
    ig,
    ...(gravacao
      ? {
          gravarReels: (d, saida) => gravacao.gravarReels(d, { saida }).then(() => {}),
          gravarResumo: (d, saida) => gravacao.gravarResumo(d, { saida }).then(() => {}),
        }
      : {}),
  };
  if (qual === 'coletar') await jobColetar(ctx);
  else if (qual === 'partida') await jobPartida(ctx, { esperarCorte: !flags.includes('--sem-esperar') });
  else await jobResumo(ctx);
} finally {
  await banco.fechar();
}
