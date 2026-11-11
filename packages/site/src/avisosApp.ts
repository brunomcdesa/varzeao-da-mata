/**
 * Avisos do App (ADR-0042): liga e desliga as notificações deste aparelho.
 * O navegador cria o endereço de notificação; a borda guarda o endereço e os Times escolhidos.
 */
import type { TimeId } from '@liga/shared';
import { BASE_API, VAPID_PUBLICA } from './dados.js';
import { ehIos } from './instalacao.js';

const CHAVE = 'varzeao:avisos';

export type SuporteAosAvisos =
  /** Pode ativar. */
  | 'ok'
  /** iPhone/iPad fora do App: só recebe aviso com o App instalado. */
  | 'instalar'
  /** A pessoa bloqueou as notificações do site. */
  | 'bloqueado'
  /** Navegador sem notificações, ou os Avisos ainda não estão ligados na Liga. */
  | 'sem-suporte';

export const abertoComoApp = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function suporteAosAvisos(): SuporteAosAvisos {
  if (!VAPID_PUBLICA || !BASE_API) return 'sem-suporte';
  if (ehIos({ userAgent: navigator.userAgent, pontosDeToque: navigator.maxTouchPoints ?? 0 }) && !abertoComoApp()) return 'instalar';
  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) return 'sem-suporte';
  return Notification.permission === 'denied' ? 'bloqueado' : 'ok';
}

/** Times que este aparelho segue (null: Avisos desligados). */
export function timesComAviso(): TimeId[] | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v ? ((JSON.parse(v) as { times: TimeId[] }).times ?? null) : null;
  } catch {
    return null;
  }
}

function guardar(times: TimeId[] | null): void {
  try {
    if (times) localStorage.setItem(CHAVE, JSON.stringify({ times }));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: a borda continua mandando; só a tela não lembra */
  }
}

function chave(base64url: string): Uint8Array<ArrayBuffer> {
  const b = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function postar(caminho: string, corpo: unknown): Promise<void> {
  const r = await fetch(`${BASE_API}${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as { erro?: string } | null;
    throw new Error(j?.erro ?? 'Não deu agora. Tente de novo daqui a pouco.');
  }
}

/** Liga (ou troca os Times). Precisa vir de um toque: o navegador pede a permissão aqui. */
export async function ativarAvisos(times: TimeId[]): Promise<void> {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Sem permissão, o celular não mostra os Avisos.');
  const reg = await navigator.serviceWorker.ready;
  const assinatura = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(VAPID_PUBLICA) }));
  await postar('avisos', { assinatura: assinatura.toJSON(), times });
  guardar(times);
}

export async function desativarAvisos(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const assinatura = await reg.pushManager.getSubscription();
  if (assinatura) {
    await postar('avisos/desativar', { endpoint: assinatura.endpoint });
    await assinatura.unsubscribe();
  }
  guardar(null);
}
