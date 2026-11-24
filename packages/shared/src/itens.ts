/**
 * Itens da Loja (ADR-0087 e ADR-0101): peças visuais compradas com Moedas. Cada Item ocupa
 * um Encaixe do boneco (só um equipado por Encaixe), é do Jogador para sempre e pode ser
 * trocado sem pagar de novo. A primeira fase da T3 traz a Chuteira colorida e os Acessórios.
 */

export type Encaixe = 'CHUTEIRA' | 'MUNHEQUEIRA' | 'FAIXA' | 'LUVA' | 'CORTE' | 'BARBA' | 'COMEMORACAO';
export const ENCAIXES: readonly Encaixe[] = ['CHUTEIRA', 'MUNHEQUEIRA', 'FAIXA', 'LUVA', 'CORTE', 'BARBA', 'COMEMORACAO'];
/** Encaixes de cor (o Item pinta uma parte do boneco); os outros mudam o desenho. */
export const ENCAIXES_DE_COR: readonly Encaixe[] = ['CHUTEIRA', 'MUNHEQUEIRA', 'FAIXA', 'LUVA'];
export const NOME_DO_ENCAIXE: Record<Encaixe, string> = {
  CHUTEIRA: 'Chuteira',
  MUNHEQUEIRA: 'Munhequeira',
  FAIXA: 'Faixa na cabeça',
  LUVA: 'Luva do goleiro',
  CORTE: 'Penteado',
  BARBA: 'Barba',
  COMEMORACAO: 'Comemoração de gol',
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
  /** Itens de desenho (corte, barba, comemoração): qual. A `cor` é só a da amostra na Loja. */
  estilo?: string;
  /** Segunda cor, no centro da peça (a folha verde da Faixa da Mata, ADR-0108). */
  detalhe?: string;
  /** Item exclusivo (ADR-0108): não está à venda; só aparece na Loja para quem já é dono. */
  exclusivo?: 'APOIADOR';
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

const ITENS_DE_COR: readonly Item[] = ENCAIXES_DE_COR.flatMap((encaixe) => [
  ...CORES_BASICAS.map(([cor, hex]): Item => ({ codigo: `${encaixe}_${cor}`, encaixe, nome: nomeDoItem(encaixe, cor), cor: hex, raridade: 'BASICO', fase: 1 })),
  { codigo: `${encaixe}_DOURADA`, encaixe, nome: nomeDoItem(encaixe, 'DOURADA'), cor: DOURADO, raridade: 'RARO', fase: 1 } as Item,
]);
/** Segunda fase (ADR-0101): cortes e barbas básicos, comemorações raras. */
export type CorteDaLoja = 'LONGO' | 'RASPADO' | 'TRANCAS' | 'TOPETE';
export type BarbaDaLoja = 'BIGODE' | 'CAVANHAQUE' | 'CHEIA';
export type ComemoracaoDaLoja = 'AVIAOZINHO' | 'MORTAL' | 'JOELHADA' | 'DANCINHA';
const deDesenho = (encaixe: Encaixe, estilo: string, nome: string, raridade: Raridade): Item => ({
  codigo: `${encaixe}_${estilo}`,
  encaixe,
  nome,
  cor: raridade === 'RARO' ? DOURADO : '#4A2E19',
  raridade,
  fase: 2,
  estilo,
});
const ITENS_DE_DESENHO: readonly Item[] = [
  deDesenho('CORTE', 'LONGO', 'Cabelo longo', 'BASICO'),
  deDesenho('CORTE', 'RASPADO', 'Raspado', 'BASICO'),
  deDesenho('CORTE', 'TRANCAS', 'Tranças', 'BASICO'),
  deDesenho('CORTE', 'TOPETE', 'Topete', 'BASICO'),
  deDesenho('BARBA', 'BIGODE', 'Bigode', 'BASICO'),
  deDesenho('BARBA', 'CAVANHAQUE', 'Cavanhaque', 'BASICO'),
  deDesenho('BARBA', 'CHEIA', 'Barba cheia', 'BASICO'),
  deDesenho('COMEMORACAO', 'AVIAOZINHO', 'Aviãozinho', 'RARO'),
  deDesenho('COMEMORACAO', 'MORTAL', 'Mortal', 'RARO'),
  deDesenho('COMEMORACAO', 'JOELHADA', 'Joelhada', 'RARO'),
  deDesenho('COMEMORACAO', 'DANCINHA', 'Dancinha', 'RARO'),
];
/**
 * Item de Apoiador (ADR-0108): de quem teve apoio de R$ 15 pelo Apoia-se. Faixa dourada com a
 * folha verde-mata no centro, para não confundir com a Faixa dourada da Loja. Fora da venda e
 * sem preço em Moedas. Sai com a segunda fase da Loja (Rodada 4 da T3).
 */
export const ITEM_DE_APOIADOR: Item = {
  codigo: 'FAIXA_DA_MATA',
  encaixe: 'FAIXA',
  nome: 'Faixa da Mata',
  cor: DOURADO,
  detalhe: '#1F7A3A',
  raridade: 'RARO',
  fase: 2,
  exclusivo: 'APOIADOR',
};
export const ITENS: readonly Item[] = [...ITENS_DE_COR, ...ITENS_DE_DESENHO, ITEM_DE_APOIADOR];
/** Os Itens que a Loja vende (sem os exclusivos). */
export const ITENS_A_VENDA: readonly Item[] = ITENS.filter((i) => !i.exclusivo);
export const ITEM_POR_CODIGO: ReadonlyMap<string, Item> = new Map(ITENS.map((i) => [i.codigo, i]));

/** Os Itens equipados, um código por Encaixe. A Escalação guarda uma cópia (ADR-0087). */
export type ItensEquipados = Partial<Record<Encaixe, string>>;

/** Só a Luva depende da Posição: ela aparece só no goleiro. */
export const ENCAIXE_SO_DO_GOLEIRO: Encaixe = 'LUVA';

/** Cores dos Itens equipados, prontas para o desenho. Códigos desconhecidos são ignorados. */
export function coresDosItens(itens: ItensEquipados | null | undefined, goleiro: boolean): Partial<Record<Encaixe, string>> {
  const cores: Partial<Record<Encaixe, string>> = {};
  if (!itens) return cores;
  for (const encaixe of ENCAIXES_DE_COR) {
    const item = ITEM_POR_CODIGO.get(itens[encaixe] ?? '');
    if (!item || item.encaixe !== encaixe) continue;
    if (encaixe === ENCAIXE_SO_DO_GOLEIRO && !goleiro) continue;
    cores[encaixe] = item.cor;
  }
  return cores;
}

/** Segundas cores dos Itens equipados (o centro da Faixa da Mata). Códigos desconhecidos são ignorados. */
export function detalhesDosItens(itens: ItensEquipados | null | undefined, goleiro: boolean): Partial<Record<Encaixe, string>> {
  const detalhes: Partial<Record<Encaixe, string>> = {};
  if (!itens) return detalhes;
  for (const encaixe of ENCAIXES_DE_COR) {
    const item = ITEM_POR_CODIGO.get(itens[encaixe] ?? '');
    if (!item?.detalhe || item.encaixe !== encaixe) continue;
    if (encaixe === ENCAIXE_SO_DO_GOLEIRO && !goleiro) continue;
    detalhes[encaixe] = item.detalhe;
  }
  return detalhes;
}

/** Aceita só um código por Encaixe e só Itens que existem. */
export function itensValidos(v: unknown): v is ItensEquipados {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.entries(v as Record<string, unknown>).every(
    ([encaixe, codigo]) => (ENCAIXES as readonly string[]).includes(encaixe) && typeof codigo === 'string' && ITEM_POR_CODIGO.get(codigo)?.encaixe === encaixe,
  );
}

/** Os Itens de desenho equipados: o corte (que troca o penteado), a barba e a comemoração. */
export function estilosDosItens(itens: ItensEquipados | null | undefined): { corte?: CorteDaLoja; barba?: BarbaDaLoja; comemoracao?: ComemoracaoDaLoja } {
  const de = (e: Encaixe) => {
    const item = ITEM_POR_CODIGO.get(itens?.[e] ?? '');
    return item && item.encaixe === e ? item.estilo : undefined;
  };
  const corte = de('CORTE') as CorteDaLoja | undefined;
  const barba = de('BARBA') as BarbaDaLoja | undefined;
  const comemoracao = de('COMEMORACAO') as ComemoracaoDaLoja | undefined;
  return { ...(corte ? { corte } : {}), ...(barba ? { barba } : {}), ...(comemoracao ? { comemoracao } : {}) };
}
