/**
 * Os Narradores da Liga. Cada Partida sorteia um pela semente (o mesmo no Reels e no Ao
 * Vivo do site). As vozes novas foram criadas no Voice design do Gemini (scripts/narradores.ts);
 * o Beto Bola é a voz pronta original.
 *
 * Bordões são originais da Liga (nada de frase famosa de locutor de verdade).
 */
export interface Narrador {
  id: string;
  nome: string;
  /** Voz do Gemini TTS: pronta ("Lumi", "pt-br-...") ou criada no Voice design ("voice_..."). */
  voz: string;
  /** Jeito de narrar (ritmo e postura), somado à emoção do momento. Sem ele, o estilo padrão. */
  jeito?: string;
  /** Como ele se apresenta na abertura. */
  apresentacao: string;
  /** Grito de gol próprio; {time} vira "da Onça", "do Tatu"... */
  gol: string;
  /** Despedida no fim do jogo. */
  despedida: string;
}

export const NARRADORES: readonly Narrador[] = [
  { id: 'BETO', nome: 'Beto Bola', voz: 'Lumi', apresentacao: 'Aqui é o Beto Bola!', gol: 'Gooooool {time}! Que bola, que bola!', despedida: 'Beto Bola se despede. Até o próximo jogo!' },
  { id: 'DITO', nome: 'Seu Dito', voz: 'voice_afdapdv2g0zm', apresentacao: 'Boa tarde, torcida! Aqui fala Seu Dito.', gol: 'Gooooool {time}! Coisa linda de se ver!', despedida: 'Seu Dito encerra a transmissão. Um abraço, torcida!' },
  { id: 'TURBO', nome: 'Tiago Turbo', voz: 'voice_hi74dvlzb7go', apresentacao: 'Tiago Turbo na área!', gol: 'Gooooool {time}! Acelera, torcida!', despedida: 'Tiago Turbo saindo do ar. Valeu, galera!' },
  { id: 'ZE', nome: 'Zé da Várzea', voz: 'voice_vkljhx3z7pon', apresentacao: 'Zé da Várzea no alto-falante do campinho!', gol: 'Gooooool {time}! Balançou o barbante, sô!', despedida: 'Zé da Várzea desliga o alto-falante. Até mais, sô!' },
  { id: 'RITA', nome: 'Rita Rádio', voz: 'voice_g4hum8lb7gxb', apresentacao: 'Rita Rádio com vocês!', gol: 'Gooooool {time}! Que golaço, minha gente!', despedida: 'Rita Rádio se despede. Até a próxima!' },
];

/** O Narrador da Partida, pela semente (determinístico). */
export function narradorDa(seed: number): Narrador {
  // Mistura os bits da semente para não seguir o padrão de outros sorteios feitos com ela.
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return NARRADORES[((h ^ (h >>> 16)) >>> 0) % NARRADORES.length]!;
}
