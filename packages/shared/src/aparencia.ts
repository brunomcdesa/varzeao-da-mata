/** Opções do visual do boneco (ADR-0013): o desenho (renderer), o site e o worker usam as mesmas. */
export const PELES = ['#F3CDA8', '#E2AE80', '#C68B59', '#9A6238', '#6E4426', '#4B2E1B'] as const;
/** As 7 primeiras são as do sorteio pelo @; as duas últimas (grisalho, loiro) só por escolha. */
export const CABELOS = ['#1C130D', '#2E1D12', '#4A2E19', '#7A4A22', '#B98A3E', '#111111', '#3A2A20', '#C9C9C9', '#E8C547'] as const;
export type Penteado = 'CURTO' | 'CARECA' | 'BLACK' | 'MOICANO';
export const PENTEADOS: readonly Penteado[] = ['CURTO', 'CARECA', 'BLACK', 'MOICANO'];
export const NOME_DO_PENTEADO: Record<Penteado, string> = { CURTO: 'Curto', CARECA: 'Careca', BLACK: 'Black', MOICANO: 'Moicano' };

export interface Aparencia {
  pele: string;
  cabelo: string;
  penteado?: Penteado;
}

export function aparenciaValida(v: unknown): v is Required<Aparencia> {
  const x = v as Partial<Aparencia> | null;
  return Boolean(x && (PELES as readonly string[]).includes(String(x.pele)) && (CABELOS as readonly string[]).includes(String(x.cabelo)) && PENTEADOS.includes(x.penteado as Penteado));
}
