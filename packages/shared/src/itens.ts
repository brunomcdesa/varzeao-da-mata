/**
 * Itens da Loja (ADR-0087 e ADR-0101): peças visuais compradas com Moedas. Cada Item ocupa
 * um Encaixe do boneco (só um equipado por Encaixe), é do Jogador para sempre e pode ser
 * trocado sem pagar de novo. A primeira fase da T3 traz a Chuteira colorida e os Acessórios.
 */

export type Encaixe = 'CHUTEIRA' | 'MUNHEQUEIRA' | 'FAIXA' | 'LUVA';
export const ENCAIXES: readonly Encaixe[] = ['CHUTEIRA', 'MUNHEQUEIRA', 'FAIXA', 'LUVA'];
export const NOME_DO_ENCAIXE: Record<Encaixe, string> = {
  CHUTEIRA: 'Chuteira',
  MUNHEQUEIRA: 'Munhequeira',
  FAIXA: 'Faixa na cabeça',
  LUVA: 'Luva do goleiro',
};

export type Raridade = 'BASICO' | 'RARO';
export const PRECO_DO_ITEM: Record<Raridade, number> = { BASICO: 20, RARO: 100 };

export interface Item {
  codigo: string;
  encaixe: Encaixe;
  nome: string;
  cor: string;
  raridade: Raridade;
  /** Fase da T3 em que o Item entra na Loja (1 na abertura, 2 no meio da Temporada). */
  fase: 1 | 2;
}

const CORES_BASICAS: readonly [string, string][] = [
  ['PRETA', '#1E1E1E'],
  ['BRANCA', '#F2F2EE'],
  ['VERMELHA', '#D8322A'],
  ['AZUL', '#2F6FE0'],
  ['VERDE', '#7BD43A'],
  ['LARANJA', '#F08A1C'],
  ['ROSA', '#F06AB0'],
];
const NOME_DA_COR: Record<string, string> = {
  PRETA: 'preta', BRANCA: 'branca', VERMELHA: 'vermelha', AZUL: 'azul', VERDE: 'verde-limão', LARANJA: 'laranja', ROSA: 'rosa', DOURADA: 'dourada',
};
const DOURADO = '#E7B73C';
/** O nome do Encaixe é feminino (chuteira, munhequeira, faixa, luva): a cor concorda com ele. */
const nomeDoItem = (encaixe: Encaixe, cor: string) => `${NOME_DO_ENCAIXE[encaixe]} ${NOME_DA_COR[cor]}`;

export const ITENS: readonly Item[] = ENCAIXES.flatMap((encaixe) => [
  ...CORES_BASICAS.map(([cor, hex]): Item => ({ codigo: `${encaixe}_${cor}`, encaixe, nome: nomeDoItem(encaixe, cor), cor: hex, raridade: 'BASICO', fase: 1 })),
  { codigo: `${encaixe}_DOURADA`, encaixe, nome: nomeDoItem(encaixe, 'DOURADA'), cor: DOURADO, raridade: 'RARO', fase: 1 } as Item,
]);
export const ITEM_POR_CODIGO: ReadonlyMap<string, Item> = new Map(ITENS.map((i) => [i.codigo, i]));

/** Os Itens equipados, um código por Encaixe. A Escalação guarda uma cópia (ADR-0087). */
export type ItensEquipados = Partial<Record<Encaixe, string>>;

/** Só a Luva depende da Posição: ela aparece só no goleiro. */
export const ENCAIXE_SO_DO_GOLEIRO: Encaixe = 'LUVA';

/** Cores dos Itens equipados, prontas para o desenho. Códigos desconhecidos são ignorados. */
export function coresDosItens(itens: ItensEquipados | null | undefined, goleiro: boolean): Partial<Record<Encaixe, string>> {
  const cores: Partial<Record<Encaixe, string>> = {};
  if (!itens) return cores;
  for (const encaixe of ENCAIXES) {
    const item = ITEM_POR_CODIGO.get(itens[encaixe] ?? '');
    if (!item || item.encaixe !== encaixe) continue;
    if (encaixe === ENCAIXE_SO_DO_GOLEIRO && !goleiro) continue;
    cores[encaixe] = item.cor;
  }
  return cores;
}

/** Aceita só um código por Encaixe e só Itens que existem. */
export function itensValidos(v: unknown): v is ItensEquipados {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.entries(v as Record<string, unknown>).every(
    ([encaixe, codigo]) => (ENCAIXES as readonly string[]).includes(encaixe) && typeof codigo === 'string' && ITEM_POR_CODIGO.get(codigo)?.encaixe === encaixe,
  );
}
