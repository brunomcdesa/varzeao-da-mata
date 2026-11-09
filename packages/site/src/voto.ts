/**
 * Voto do Craque pelo site (ADR-0011): um por aparelho. O aparelho é um id aleatório
 * guardado neste navegador; a borda guarda o voto e limita quantos aparelhos votam da mesma
 * rede. Com Turnstile configurado, o voto passa antes pelo desafio anti-robô.
 */
import { serieDoCandidato, type Serie } from '@liga/shared';
import { BASE_API, TURNSTILE } from './dados.js';

/** Com duas Séries, o aparelho vota uma vez em cada (ADR-0017): a B fica numa chave à parte. */
const chaveDoVoto = (rodada: number, serie: Serie) => `varzeao:voto:${rodada}${serie === 'B' ? ':B' : ''}`;

const guardar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* navegador sem armazenamento: o voto vale do mesmo jeito */
  }
};
const lerGuardado = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const votoNoSiteDisponivel = () => Boolean(BASE_API);

/** Sessão do personagem vinculado neste navegador (meuPersonagem.ts), se houver. */
function sessaoVinculada(): string | null {
  try {
    return (JSON.parse(lerGuardado('varzeao:vinculo') ?? 'null') as { sessao?: string } | null)?.sessao ?? null;
  } catch {
    return null;
  }
}

/** @ do personagem vinculado, para o site dizer "votando como @fulano". */
export function arrobaVinculado(): string | null {
  try {
    return (JSON.parse(lerGuardado('varzeao:vinculo') ?? 'null') as { username?: string } | null)?.username ?? null;
  } catch {
    return null;
  }
}

function aparelho(): string {
  let id = lerGuardado('varzeao:aparelho');
  if (!id || !/^[a-z0-9-]{16,64}$/.test(id)) {
    id = crypto.randomUUID();
    guardar('varzeao:aparelho', id);
  }
  return id;
}

/** Número em que este aparelho já votou nessa Rodada (na Série), se votou. */
export function votoGuardado(rodada: number, serie: Serie = 'A'): number | null {
  const v = Number(lerGuardado(chaveDoVoto(rodada, serie)));
  return v >= 1 ? v : null;
}

declare global {
  interface Window {
    turnstile?: { render(el: HTMLElement, o: { sitekey: string; callback: (t: string) => void; 'error-callback'?: () => void; size?: string }): string };
  }
}

let script: Promise<void> | null = null;
function carregarTurnstile(): Promise<void> {
  script ??= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => erro(new Error('Não deu para carregar o anti-robô.'));
    document.head.append(s);
  });
  return script;
}

/** Desafio anti-robô; resolve com o token (ou vazio, se o Turnstile não está configurado). */
async function desafio(caixa: HTMLElement): Promise<string> {
  if (!TURNSTILE) return '';
  await carregarTurnstile();
  return new Promise((ok, erro) => {
    caixa.hidden = false;
    caixa.replaceChildren();
    window.turnstile!.render(caixa, { sitekey: TURNSTILE, callback: ok, 'error-callback': () => erro(new Error('O anti-robô não respondeu. Tente de novo.')) });
  });
}

export async function votar(rodada: number, numero: number, caixaDoDesafio: HTMLElement): Promise<{ numero: number; jaVotou: boolean }> {
  const turnstile = await desafio(caixaDoDesafio);
  const r = await fetch(`${BASE_API}votos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Com o personagem vinculado (ADR-0013), o voto é do @: um por pessoa, vale o último.
    body: JSON.stringify({ rodada, numero, aparelho: aparelho(), turnstile, ...(sessaoVinculada() ? { sessao: sessaoVinculada() } : {}) }),
  });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; numero?: number; jaVotou?: boolean; erro?: string };
  if (!r.ok || !j.ok) throw new Error(j.erro ?? 'Não deu para registrar o voto agora. Tente de novo.');
  guardar(chaveDoVoto(rodada, serieDoCandidato(j.numero!)), String(j.numero));
  return { numero: j.numero!, jaVotou: Boolean(j.jaVotou) };
}
