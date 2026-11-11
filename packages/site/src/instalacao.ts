/**
 * Como instalar o App (ADR-0037): o site é uma PWA e cada aparelho instala de um jeito.
 * Regra pura, sem DOM, para ser testada.
 */

export type ComoInstalar =
  /** Já está aberto como App (tela cheia, pelo ícone): nada a oferecer. */
  | 'instalado'
  /** Navegador de dentro do Instagram ou do Facebook: não instala, precisa abrir no navegador. */
  | 'instagram'
  /** O navegador oferece o pedido nativo de instalação (Chrome no Android, Edge, Chrome no computador). */
  | 'botao'
  /** iPhone e iPad: Compartilhar → Adicionar à Tela de Início. */
  | 'ios'
  /** Android sem o pedido nativo (Samsung Internet, Firefox…): pelo menu do navegador. */
  | 'android'
  /** Computador sem pedido nativo: não vale a pena insistir. */
  | null;

export interface Aparelho {
  userAgent: string;
  /** display-mode: standalone, ou navigator.standalone no iOS. */
  abertoComoApp: boolean;
  /** Chegou o evento beforeinstallprompt. */
  temPedidoNativo: boolean;
  /** navigator.maxTouchPoints: o iPad com iPadOS se apresenta como Mac. */
  pontosDeToque: number;
}

const NAVEGADOR_DO_INSTAGRAM = /Instagram|FBAN|FBAV|FB_IAB/i;

export function ehIos(a: Pick<Aparelho, 'userAgent' | 'pontosDeToque'>): boolean {
  return /iPhone|iPad|iPod/i.test(a.userAgent) || (/Macintosh/i.test(a.userAgent) && a.pontosDeToque > 1);
}

export function comoInstalar(a: Aparelho): ComoInstalar {
  if (a.abertoComoApp) return 'instalado';
  if (NAVEGADOR_DO_INSTAGRAM.test(a.userAgent)) return 'instagram';
  if (a.temPedidoNativo) return 'botao';
  if (ehIos(a)) return 'ios';
  if (/Android/i.test(a.userAgent)) return 'android';
  return null;
}

/** O App estreia na Temporada 2: antes disso, nem manifesto, nem service worker, nem placa. */
export const TEMPORADA_DO_APP = 2;

export function appLiberado(numeroDaTemporada: number | null | undefined): boolean {
  return (numeroDaTemporada ?? 0) >= TEMPORADA_DO_APP;
}
