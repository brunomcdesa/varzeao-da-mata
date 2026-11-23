import type { LigaPublica } from '@liga/shared';
import { rodadaAtual } from './calendario.js';

/**
 * Com Copa na Temporada, Jogos tem duas sub-abas: Liga (Rodadas e Mata-mata das Séries) e
 * Copa (a chave). Sem aba na URL, abre a do jogo da vez.
 */
export function abaDosJogos(l: LigaPublica, pedida: string | undefined, agora = Date.now()): 'LIGA' | 'COPA' | null {
  if (!l.calendario.some((p) => p.copa)) return null;
  if (pedida === 'copa') return 'COPA';
  if (pedida === 'liga') return 'LIGA';
  const daVez = rodadaAtual(l, agora);
  return l.calendario.some((p) => p.rodada === daVez && p.copa) ? 'COPA' : 'LIGA';
}
