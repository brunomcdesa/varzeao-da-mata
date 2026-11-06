/**
 * Confere se as credenciais do .env funcionam, sem publicar nada:
 *
 *   pnpm verificar
 *
 * Instagram (token, conta, permissão de comentários), R2 (grava um arquivinho em cada
 * bucket) e KV (grava e lê uma chave). Nunca imprime segredos.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Instagram, KV, R2, nuvemDoAmbiente } from '../src/index.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* sem .env */
}

const ok = (m: string) => console.log(`  ✔ ${m}`);
const falha = (m: string) => {
  console.log(`  ✘ ${m}`);
  process.exitCode = 1;
};
const falta = (vars: string[]) => vars.filter((v) => !process.env[v]);

console.log('Instagram');
const igFalta = falta(['IG_USER_ID', 'IG_ACCESS_TOKEN']);
if (igFalta.length) falha(`faltam no .env: ${igFalta.join(', ')}`);
else {
  const ig = new Instagram({ userId: process.env.IG_USER_ID!, token: process.env.IG_ACCESS_TOKEN! });
  try {
    const eu = await ig.eu();
    ok(`token válido: @${eu.username} (${eu.account_type ?? 'tipo de conta não informado'})`);
    if (eu.user_id !== process.env.IG_USER_ID) falha(`IG_USER_ID (${process.env.IG_USER_ID}) não bate com o do token (${eu.user_id})`);
    const midias = await ig.midiasDesde(new Date(Date.now() - 30 * 86400_000), 5);
    ok(`${midias.length} post(s) nos últimos 30 dias`);
    if (midias[0]) {
      const cs = await ig.comentarios(midias[0].id);
      ok(`leu ${cs.length} comentário(s) do post mais recente, com o @ de quem comentou`);
    }
  } catch (e) {
    falha(String((e as Error).message));
  }
}

console.log('Cloudflare');
const cfFalta = falta(['CF_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_PUBLICO', 'R2_BUCKET_PRIVADO', 'R2_URL_PUBLICA', 'CF_API_TOKEN', 'CF_KV_NAMESPACE_ID']);
const nuvem = nuvemDoAmbiente();
if (!nuvem) falha(`faltam no .env: ${cfFalta.join(', ')}`);
else {
  const r2: R2 = nuvem.armazenamento;
  const kv: KV = nuvem.agenda;
  const marca = new Date().toISOString();
  for (const b of ['publico', 'privado'] as const) {
    try {
      await r2.enviar(b, 'verificacao.txt', `ok ${marca}`, { tipo: 'text/plain' });
      ok(`R2 ${b}: gravou verificacao.txt`);
    } catch (e) {
      falha(`R2 ${b}: ${(e as Error).message}`);
    }
  }
  try {
    const r = await fetch(r2.urlPublica('verificacao.txt'), { cache: 'no-store' });
    if (r.ok && (await r.text()).includes(marca)) ok(`bucket público acessível em ${process.env.R2_URL_PUBLICA}`);
    else falha(`bucket público não respondeu em ${r2.urlPublica('verificacao.txt')} (${r.status}). Ative o acesso público (r2.dev ou domínio).`);
  } catch (e) {
    falha(`bucket público: ${(e as Error).message}`);
  }
  try {
    await kv.gravar('verificacao', { marca });
    const lido = await kv.ler<{ marca: string }>('verificacao');
    if (lido?.marca === marca) ok('KV: gravou e leu');
    else falha('KV: gravou mas não leu de volta');
  } catch (e) {
    falha(`KV: ${(e as Error).message}`);
  }
}
console.log(process.exitCode ? '\nTem coisa para arrumar.' : '\nTudo certo.');
