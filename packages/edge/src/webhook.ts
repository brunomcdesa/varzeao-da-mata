/**
 * Webhook de mensagens do Instagram (ADR-0083). A Meta só deixa a Liga mandar DM pela API dentro
 * de 24 h da última mensagem da pessoa, e essa janela só abre para o app inscrito no campo
 * `messages`. A Liga continua lendo as DMs pela API de conversas; o webhook existe para a
 * inscrição valer, então aqui só se confirma a assinatura e se responde 200.
 *
 *   GET  /webhook/instagram  verificação da Meta (hub.mode, hub.verify_token, hub.challenge)
 *   POST /webhook/instagram  eventos (assinatura X-Hub-Signature-256 com a chave secreta do app)
 */
export interface EnvWebhook {
  /** Token de verificação inventado pelo dono e repetido no painel do app da Meta. */
  IG_WEBHOOK_TOKEN?: string;
  /** Chave secreta do app (Configurações do app → Básico): confere a assinatura dos eventos. */
  IG_APP_SECRET?: string;
}

const texto = (corpo: string, status = 200) => new Response(corpo, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

async function assinatura(segredo: string, corpo: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo));
  return `sha256=${[...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Comparação sem atalho (o tempo não revela quantos caracteres batem). */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function rotaDoWebhook(req: Request, env: EnvWebhook): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== '/webhook/instagram') return null;
  if (req.method === 'GET') {
    const p = url.searchParams;
    if (!env.IG_WEBHOOK_TOKEN || p.get('hub.mode') !== 'subscribe' || p.get('hub.verify_token') !== env.IG_WEBHOOK_TOKEN) return texto('Proibido', 403);
    return texto(p.get('hub.challenge') ?? '');
  }
  if (req.method === 'POST') {
    const corpo = await req.text();
    if (env.IG_APP_SECRET && !iguais(req.headers.get('x-hub-signature-256') ?? '', await assinatura(env.IG_APP_SECRET, corpo))) return texto('Assinatura inválida', 401);
    return texto('EVENT_RECEIVED');
  }
  return texto('Método não permitido', 405);
}
