/**
 * Ponto de entrada dos jobs no GitHub Actions (e para testar na mão):
 *
 *   pnpm job coletar
 *   pnpm job partida [--sem-esperar]
 *   pnpm job resumo
 *   pnpm job boas-vindas [--enviar]   responde quem entrou antes das respostas automáticas
 *
 * Precisa de DATABASE_URL, do Instagram (IG_USER_ID, IG_ACCESS_TOKEN) e do Cloudflare
 * (veja .env.example). Sem Cloudflare, grava em .cache/nuvem-local; sem Instagram, não agenda.
 */
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgendaNaMemoria, Instagram, PastaLocal, conectar, jobBoasVindas, jobColetar, postsDeInscricao, jobPartida, jobResumo, nuvemDoAmbiente, prepararBanco, tokenGuardado, type ContextoDoJob } from '../src/index.js';
import { bancoLocal } from './banco-local.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* no Actions as variáveis vêm dos segredos */
}

const [qual, ...flags] = process.argv.slice(2);
if (!['coletar', 'partida', 'resumo', 'boas-vindas', 'procurar'].includes(qual ?? '')) {
  console.log('Uso: pnpm job coletar | partida [--sem-esperar] | resumo | boas-vindas [--enviar]');
  process.exit(1);
}

const banco = process.env.DATABASE_URL ? conectar() : await bancoLocal(join(raizRepo, '.cache/liga-local'));
try {
  await prepararBanco(banco);
  const nuvem = nuvemDoAmbiente();
  if (!nuvem) console.log('Cloudflare não configurado: gravando em .cache/nuvem-local.');
  const token = (await tokenGuardado(banco))?.token ?? process.env.IG_ACCESS_TOKEN;
  const ig = process.env.IG_USER_ID && token ? new Instagram({ userId: process.env.IG_USER_ID, token, ...(process.env.IG_APP_ID ? { appId: process.env.IG_APP_ID } : {}), ...(process.env.IG_APP_SECRET ? { appSecret: process.env.IG_APP_SECRET } : {}) }) : null;
  if (!ig) console.log('Instagram não configurado: não lê comentários nem agenda Reels.');

  const precisaGravar = qual === 'partida' || qual === 'resumo';
  const gravacao = precisaGravar ? await import('@liga/renderer/gravacao') : null;
  const ctx: ContextoDoJob = {
    banco,
    armazenamento: nuvem?.armazenamento ?? new PastaLocal(join(raizRepo, '.cache/nuvem-local')),
    agenda: nuvem?.agenda ?? new AgendaNaMemoria(),
    ig,
    ...(gravacao
      ? {
          gravarReels: (d, saida) => gravacao.gravarReels(d, { saida }).then(() => {}),
          gravarAoVivo: (d, saida) => gravacao.gravarNarracaoAoVivo(d, saida).then(() => {}),
          gravarResumo: (d, saida) => gravacao.gravarResumo(d, { saida }).then(() => {}),
        }
      : {}),
  };
  if (qual === 'procurar') {
    // Diagnóstico: onde está o comentário de USUARIO (em todos os posts da conta, cru da API).
    const quem = (process.env.USUARIO ?? '').replace(/^@/, '').toLowerCase();
    const midias = await ig!.midiasDesde(new Date(0));
    console.log(`${midias.length} post(s); inscrição: ${JSON.stringify(await postsDeInscricao(banco))}`);
    let total = 0;
    for (const m of midias) {
      const cs = await ig!.comentariosCrus(m.id).catch((e) => (console.log(`${m.id}: ${(e as Error).message}`), []));
      total += cs.length;
      const semAutor = cs.filter((c) => !c.from?.id).length;
      console.log(`${m.id} ${m.timestamp} ${m.media_product_type} ${m.permalink}: ${cs.length} comentário(s), ${semAutor} sem from`);
      for (const c of cs) {
        const nome = (c.from?.username ?? c.username ?? '').toLowerCase();
        if (nome.includes(quem) || (c.text ?? '').toLowerCase().includes(quem)) console.log(`  ACHEI ${JSON.stringify(c)}`);
      }
    }
    console.log(`${total} comentário(s) no total.`);
  } else if (qual === 'boas-vindas') await jobBoasVindas(ctx, { enviar: flags.includes('--enviar') });
  else if (qual === 'coletar') await jobColetar(ctx);
  else if (qual === 'partida') await jobPartida(ctx, { esperarCorte: !flags.includes('--sem-esperar') });
  else await jobResumo(ctx);
} finally {
  await banco.fechar();
}
