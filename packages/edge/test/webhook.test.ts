import { describe, expect, it } from 'vitest';
import { rotaDoWebhook } from '../src/webhook.js';

const env = { IG_WEBHOOK_TOKEN: 'meu-token', IG_APP_SECRET: 'segredo' };
const assinar = async (corpo: string) => {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('segredo'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `sha256=${[...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(corpo)))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
};

describe('Webhook de mensagens do Instagram (ADR-0083)', () => {
  it('a verificação devolve o desafio só com o token certo', async () => {
    const ok = await rotaDoWebhook(new Request('https://borda/webhook/instagram?hub.mode=subscribe&hub.verify_token=meu-token&hub.challenge=123'), env);
    expect(ok!.status).toBe(200);
    expect(await ok!.text()).toBe('123');
    expect((await rotaDoWebhook(new Request('https://borda/webhook/instagram?hub.mode=subscribe&hub.verify_token=outro&hub.challenge=123'), env))!.status).toBe(403);
    // Sem token configurado, nada é verificado.
    expect((await rotaDoWebhook(new Request('https://borda/webhook/instagram?hub.mode=subscribe&hub.verify_token=&hub.challenge=1'), {}))!.status).toBe(403);
  });

  it('aceita evento com a assinatura do app e recusa sem ela', async () => {
    const corpo = JSON.stringify({ object: 'instagram', entry: [] });
    const post = (sig?: string) => new Request('https://borda/webhook/instagram', { method: 'POST', body: corpo, headers: sig ? { 'x-hub-signature-256': sig } : {} });
    expect((await rotaDoWebhook(post(await assinar(corpo)), env))!.status).toBe(200);
    expect((await rotaDoWebhook(post('sha256=00'), env))!.status).toBe(401);
    expect((await rotaDoWebhook(post(), env))!.status).toBe(401);
  });

  it('outras rotas seguem adiante', async () => {
    expect(await rotaDoWebhook(new Request('https://borda/votos'), env)).toBeNull();
  });
});
