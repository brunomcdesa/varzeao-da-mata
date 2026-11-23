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
  LEA: ['LEA', 'LEAO', 'LEOES', 'LION', 'LION CLUB', 'LEAO FC', 'LEAO FUTEBOL CLUBE'],
  BOT: ['BOT', 'BOTO', 'BOTOS', 'BOTO COR DE ROSA', 'BOTO ROSA', 'BOTO FC', 'BOTO FUTEBOL CLUBE'],
  TAR: ['TAR', 'TARTARUGA', 'TARTARUGAS', 'TURTUGAS', 'TURTUGAS FC', 'TARTARUGAS FC', 'TARTARUGAS FUTEBOL CLUBE'],
  COR: ['COR', 'CORUJA', 'CORUJAS', 'CORUJA EC', 'CORUJA ESPORTE CLUBE'],
  BES: ['BES', 'BESOURO', 'BESOUROS', 'BESOUROS CLUB', 'BESOURO FC', 'BESOUROS ESPORTE CLUBE'],
  QUA: ['QUA', 'QUATI', 'QUATIS', 'QUATI FC', 'QUATI FUTEBOL CLUBE'],
  GAM: ['GAM', 'GAMBA', 'GAMBAS', 'GAMBA EC', 'GAMBA ESPORTE CLUBE', 'SARUE', 'OPOSSUM'],
  JAB: ['JAB', 'JABUTI', 'JABUTIS', 'JABUTI AC', 'JABUTI ATLETICO CLUBE'],
  TEI: ['TEI', 'TEIU', 'TEIUS', 'TEJU', 'TEIU FC', 'TEIU FUTEBOL CLUBE'],
  ARI: ['ARI', 'ARIRANHA', 'ARIRANHAS', 'ARIRANHA SPORT CLUB'],
  ANT: ['ANT', 'ANTA', 'ANTAS', 'ASSOCIACAO ANTA'],
  // Sem "SER": é palavra de ligação ("quero SER goleiro").
  SER: ['SERIEMA', 'SERIEMAS', 'SERIEMA EC', 'SERIEMA ESPORTE CLUBE'],
  BUG: ['BUG', 'BUGIO', 'BUGIOS', 'BUGIO FC', 'BUGIO FUTEBOL CLUBE', 'GUARIBA'],
  // Expansão (ADR-0093): só valem quando os Times entram numa Série; antes, o pedido é recusado como o dos Times guardados.
  GAT: ['GAT', 'GATO', 'GATOS', 'GATO PRETO', 'GATO PRETO FC', 'GATO PRETO FUTEBOL CLUBE'],
  RAT: ['RAT', 'RATO', 'RATOS', 'RATO EC', 'RATO ESPORTE CLUBE'],
  ESC: ['ESC', 'ESCORPIAO', 'ESCORPIÃO', 'ESCORPIOES', 'ESCORPIÕES', 'ESCORPIAO AC', 'ESCORPIÃO ATLÉTICO CLUBE'],
  ARN: ['ARN', 'ARANHA', 'ARANHAS', 'ARANHA FC', 'ARANHA FUTEBOL CLUBE'],
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
