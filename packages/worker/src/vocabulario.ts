/**
 * Como o público escreve Times e Posições nos comentários. Tudo já normalizado
 * (maiúsculas, sem acento), no formato que `normalizar` produz.
 */
import type { Posicao, TimeId } from '@liga/shared';

export const APELIDOS_DE_TIME: Record<TimeId, string[]> = {
  CAP: ['CAP', 'CAPIVARA', 'CAPIVARAS', 'CAPI', 'ESPORTE CLUBE CAPIVARA'],
  ONC: ['ONC', 'ONCA', 'ONCAS', 'ONCA FC', 'ONCA FUTEBOL CLUBE'],
  TAT: ['TAT', 'TATU', 'TATUS', 'ATLETICO TATU'],
  TAM: ['TAM', 'TAMANDUA', 'TAMANDUAS', 'TAMANDUA SPORT CLUB'],
  PRE: ['PRE', 'PREGUICA', 'PREGUICAS', 'ASSOCIACAO PREGUICA'],
  SAG: ['SAG', 'SAGUI', 'SAGUIS', 'MICO', 'SAGUI FC', 'SAGUI FUTEBOL CLUBE'],
  TUC: ['TUC', 'TUCANO', 'TUCANOS', 'TUCANO EC', 'TUCANO ESPORTE CLUBE'],
  ARA: ['ARA', 'ARARA', 'ARARAS', 'ARARA AZUL', 'ARARA AZUL FC', 'ARARA AZUL FUTEBOL CLUBE'],
  JAC: ['JAC', 'JACARE', 'JACARES', 'JACA', 'JACARE AC', 'JACARE ATLETICO CLUBE'],
  SUC: ['SUC', 'SUCURI', 'SUCURIS', 'SUCURI EC', 'SUCURI ESPORTE CLUBE', 'ANACONDA'],
  LOB: ['LOB', 'LOBO', 'LOBOS', 'LOBO GUARA', 'LOBOGUARA', 'GUARA', 'LOBO GUARA FC', 'LOBO GUARA FUTEBOL CLUBE'],
  CDM: ['CACHORRO', 'CACHORROS', 'CACHORRO DO MATO', 'CACHORRODOMATO', 'CAO', 'CACHORRO DO MATO SPORT CLUB'],
  BOT: ['BOT', 'BOTO', 'BOTOS', 'BOTO COR DE ROSA', 'BOTO ROSA', 'BOTO FC', 'BOTO FUTEBOL CLUBE'],
  PIR: ['PIR', 'PIRARUCU', 'PIRARUCUS', 'ASSOCIACAO PIRARUCU'],
  COR: ['COR', 'CORUJA', 'CORUJAS', 'CORUJA EC', 'CORUJA ESPORTE CLUBE'],
  MOR: ['MOR', 'MORCEGO', 'MORCEGOS', 'MORCEGO FC', 'MORCEGO FUTEBOL CLUBE'],
};

export const SINONIMOS_DE_POSICAO: Record<Posicao, string[]> = {
  GOL: ['GOL', 'GOLEIRO', 'GOLEIRA', 'GOLEIROS', 'ARQUEIRO', 'ARQUEIRA', 'GK', 'GOLQUIPER', 'GOLEIRAO'],
  ZAG: ['ZAG', 'ZAGUEIRO', 'ZAGUEIRA', 'ZAGA', 'BEQUE', 'DEFENSOR', 'DEFENSORA', 'DEFESA', 'ZAGUEIRAO', 'LATERAL'],
  MEI: ['MEI', 'MEIA', 'MEIO', 'MEIO CAMPO', 'MEIOCAMPO', 'MEIO DE CAMPO', 'VOLANTE', 'ARMADOR', 'ARMADORA', 'CAMISA 10', 'MEIA ATACANTE',
    'MEIO CAMPISTA', 'MEIOCAMPISTA', 'MEIO CAMPISTA CENTRAL', 'MEIA CENTRAL', 'MEIO CENTRAL'],
  ATA: ['ATA', 'ATACANTE', 'ATAQUE', 'CENTROAVANTE', 'ARTILHEIRO', 'ARTILHEIRA', 'PONTA', 'CAMISA 9', 'CA', 'FINALIZADOR', 'FINALIZADORA'],
};

/** Palavras de ligação que não mudam o sentido ("entro NA onça COMO goleiro"). */
export const PALAVRAS_DE_LIGACAO = new Set([
  'NA', 'NO', 'NAS', 'NOS', 'DA', 'DO', 'DAS', 'DOS', 'DE', 'COMO', 'PRO', 'PRA', 'PARA', 'O', 'A', 'OS', 'AS', 'E', 'EU',
  'TIME', 'POSICAO', 'JOGAR', 'JOGO', 'VOU', 'QUERO', 'SER', 'SOU', 'EM', 'UM', 'UMA', 'NESSA', 'NESSE', 'POR', 'FAVOR', 'PFV', 'PF',
  // "Arara FC", "Tucano EC": o sufixo do clube não muda o Time.
  'FC', 'EC',
]);

/**
 * Maiúsculas, sem acentos, sem emojis e pontuação; espaços simples. Preserva @, _ e .
 * dentro de palavras (usernames).
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9@_.\s]/g, ' ')
    .replace(/(^|\s)\.+|\.+(?=\s|$)/g, ' ') // pontos soltos ou no fim de palavra
    .replace(/\s+/g, ' ')
    .trim();
}
