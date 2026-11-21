/**
 * Regras da Temporada 3 (ADR-0094 e ADR-0091): novidades de campo e Batedores. Valem a partir da
 * T3; a T1 e a T2 continuam com as suas versões da simulação.
 */
export const PRIMEIRA_TEMPORADA_COM_REGRAS_T3 = 3;
export function temRegrasT3(numeroDaTemporada: number): boolean {
  return numeroDaTemporada >= PRIMEIRA_TEMPORADA_COM_REGRAS_T3;
}

/** Perfil do Juiz (ADR-0094): muda a chance de Falta e de Cartão. */
export const PERFIS_DO_JUIZ = ['RIGOROSO', 'NORMAL', 'DEIXA_JOGAR'] as const;
export type PerfilDoJuiz = (typeof PERFIS_DO_JUIZ)[number];
export const NOME_DO_PERFIL_DO_JUIZ: Record<PerfilDoJuiz, string> = {
  RIGOROSO: 'Rigoroso',
  NORMAL: 'Normal',
  DEIXA_JOGAR: 'Deixa jogar',
};

/**
 * O Perfil do Juiz de uma Partida, sorteado pelo id dela: sai igual na Escalação (antes da
 * simulação, que sorteia a própria semente) e na simulação. Normal na metade das Partidas.
 */
export function perfilDoJuiz(partidaId: number): PerfilDoJuiz {
  let h = (partidaId >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  const x = h % 4;
  return x === 0 ? 'RIGOROSO' : x === 1 ? 'DEIXA_JOGAR' : 'NORMAL';
}

/** Batedores (ADR-0091): quantos o Capitão escolhe, em ordem. */
export const QUANTIDADE_DE_BATEDORES = 5;
