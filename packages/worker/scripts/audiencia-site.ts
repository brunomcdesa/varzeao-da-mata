/**
 * Guarda a audiência do site (Cloudflare Web Analytics) dos últimos dias no banco (ADR-0119).
 *
 *   pnpm --filter @liga/worker exec tsx scripts/audiencia-site.ts
 *
 * Precisa de DATABASE_URL, CF_ACCOUNT_ID e CF_ANALYTICS_TOKEN (token só de leitura, com
 * Account Analytics: Read). CF_WEB_ANALYTICS_SITE_TAG é opcional.
 */
import { conectar, coletarAudienciaDoSite, prepararBanco } from '../src/index.js';

const { DATABASE_URL, CF_ACCOUNT_ID, CF_ANALYTICS_TOKEN, CF_WEB_ANALYTICS_SITE_TAG } = process.env;
if (!DATABASE_URL || !CF_ACCOUNT_ID || !CF_ANALYTICS_TOKEN) {
  console.error('Faltam DATABASE_URL, CF_ACCOUNT_ID ou CF_ANALYTICS_TOKEN.');
  process.exit(1);
}
const banco = conectar();
try {
  await prepararBanco(banco);
  const r = await coletarAudienciaDoSite(banco, { token: CF_ANALYTICS_TOKEN, contaId: CF_ACCOUNT_ID, ...(CF_WEB_ANALYTICS_SITE_TAG ? { siteTag: CF_WEB_ANALYTICS_SITE_TAG } : {}) });
  console.log(`audiência do site: ${r.linhas} linha(s) de ${r.de} a ${r.ate}`);
  for (const f of r.falhas) console.error(`falhou (${f.recorte}): ${f.erro}`);
  if (r.falhas.length) process.exitCode = 1;
} finally {
  await banco.fechar();
}
