/**
 * Apelido do Jogador: o nome que aparece no jogo, nos Reels, na narração e no site (o @ continua
 * sendo a identidade da conta e aparece pequeno no site). Escolhido pelo dono no site, depois
 * do vínculo (ADR-0014).
 */

export const APELIDO_MAX = 14;

/** Letras (com acento), números, espaço, ponto, hífen e sublinhado. */
const PERMITIDO = /^[\p{L}\p{N} ._'-]+$/u;

/**
 * Palavrões e ofensas (sem acento, em minúsculas). Comparados depois de tirar acentos, trocar
 * números parecidos com letras (4→a, 3→e, 1→i, 0→o, 5→s) e juntar letras repetidas, para
 * pegar "p0rr4", "caaaralho" e afins.
 */
const PROIBIDAS = [
  'porra', 'caralho', 'karalho', 'buceta', 'boceta', 'xoxota', 'xereca', 'piroca', 'pica', 'pau no', 'rola', 'cacete', 'merda', 'bosta',
  'puta', 'puto', 'putaria', 'foder', 'fodase', 'foda se', 'fuder', 'fudido', 'fodido', 'cu', 'cuzao', 'arrombado', 'arrombada', 'corno', 'corna',
  'viado', 'viadinho', 'veado', 'bicha', 'boiola', 'baitola', 'sapatao', 'traveco', 'macaco', 'crioulo', 'negrinho', 'retardado', 'mongol',
  'otario', 'babaca', 'idiota', 'imbecil', 'vagabundo', 'vagabunda', 'vadia', 'piranha', 'safada', 'safado', 'punheta', 'siririca', 'gozar',
  'porno', 'sexo', 'nazi', 'hitler', 'estupro', 'estuprador', 'pedofilo', 'fdp', 'pqp', 'vsf', 'tnc', 'krl', 'crl', 'prr', 'buct',
  'fuck', 'shit', 'bitch', 'dick', 'pussy', 'nigger', 'nigga', 'faggot', 'cock', 'cunt',
];

/** Palavras curtas que só contam sozinhas (senão "cu" barraria "cunha", "pica" barraria "picanha"). */
const SO_INTEIRAS = new Set(['cu', 'pica', 'rola', 'puto', 'puta', 'bicha', 'gozar', 'sexo', 'fdp', 'pqp', 'vsf', 'tnc', 'krl', 'crl', 'prr', 'dick', 'cock', 'shit', 'macaco', 'mongol']);

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a')
    .replace(/[._'-]+/g, ' ')
    .replace(/(.)\1+/g, '$1');
}

/** O apelido tem palavrão ou ofensa? */
export function apelidoOfensivo(texto: string): boolean {
  const n = normalizar(texto);
  const palavras = n.split(/\s+/).filter(Boolean);
  const junto = palavras.join('');
  return PROIBIDAS.some((p) => {
    const alvo = p.replace(/(.)\1+/g, '$1');
    if (SO_INTEIRAS.has(p)) return palavras.includes(alvo);
    return alvo.includes(' ') ? n.includes(alvo) : junto.includes(alvo);
  });
}

/** Valida e arruma (espaços) o apelido digitado. Devolve o apelido ou o motivo da recusa. */
export function validarApelido(bruto: unknown): { ok: true; apelido: string } | { ok: false; erro: string } {
  const apelido = String(bruto ?? '').replace(/\s+/g, ' ').trim();
  if (apelido.length < 2) return { ok: false, erro: 'O apelido precisa de pelo menos 2 letras.' };
  if ([...apelido].length > APELIDO_MAX) return { ok: false, erro: `O apelido pode ter até ${APELIDO_MAX} letras.` };
  if (!PERMITIDO.test(apelido)) return { ok: false, erro: 'Use só letras, números, espaço, ponto, hífen ou sublinhado.' };
  if (!/\p{L}/u.test(apelido)) return { ok: false, erro: 'O apelido precisa ter pelo menos uma letra.' };
  if (apelidoOfensivo(apelido)) return { ok: false, erro: 'Esse apelido não pode. Escolha outro.' };
  return { ok: true, apelido };
}

/** Chave para comparar apelidos (únicos na Liga): sem acento, sem espaço, minúsculo. */
export function chaveDoApelido(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** O nome que aparece: o apelido, ou o @ quando não há apelido. */
export function nomeVisivel(j: { apelido?: string | null; username: string }): string {
  return j.apelido || `@${j.username}`;
}

/** Folga para corrigir um erro de digitação logo depois de salvar. */
export const APELIDO_CORRECAO_MS = 10 * 60_000;

/** Meia-noite (Brasília) depois da troca: quando dá para trocar de novo (uma troca por Rodada, uma Rodada por dia). */
export function apelidoLiberaEm(trocouEm: Date): Date {
  const BRT = 3 * 3600_000;
  return new Date(Math.floor((trocouEm.getTime() - BRT) / 86_400_000 + 1) * 86_400_000 + BRT);
}

/** Pode trocar agora? Sim se nunca trocou, se já passou a meia-noite ou nos 10 minutos de correção. */
export function podeTrocarApelido(trocouEm: Date | null, agora: Date): boolean {
  if (!trocouEm) return true;
  return agora.getTime() - trocouEm.getTime() < APELIDO_CORRECAO_MS || agora.getTime() >= apelidoLiberaEm(trocouEm).getTime();
}
