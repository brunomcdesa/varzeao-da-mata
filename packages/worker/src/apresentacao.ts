/** Legenda do Reels de apresentação da Liga (o primeiro post, onde a maioria vai se inscrever). */
import { FALA_DO_TIME, TIMES } from '@liga/shared';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function legendaDaApresentacao(estreia: string): string {
  const [a, m, d] = estreia.split('-').map(Number) as [number, number, number];
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!;
  const data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  return [
    '⚽ Chegou o Varzeão da Mata, a liga de futebol dos seguidores!',
    '',
    '8 times, jogos todo dia, narração e votação do Craque. Você vira jogador comentando:',
    '👉 ENTRO + TIME + POSIÇÃO',
    'Ex.: ENTRO ONÇA ATACANTE',
    '',
    `Times: ${TIMES.map((t) => FALA_DO_TIME[t].curto).join(', ')}`,
    'Posições: goleiro, zagueiro, meia ou atacante',
    `🏁 Estreia ${dia}, ${data}. Tabela e jogadores no link da bio.`,
    '',
    '#futebol #varzea #jogo #liga',
  ].join('\n');
}
