/**
 * A Timeline de uma Partida como ela sai no JSON público (Ao Vivo, Replay e os Avisos do App).
 * Fica aqui para o site e a borda montarem exatamente os mesmos instantes de lance.
 */
import { duracaoAoVivoMs, habilidadesDoPerfil, type Escalacao, type EscalacaoPublica, type MomentosDoAoVivo, type PartidaPublica } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import { Timeline, VELOCIDADE_AO_VIVO } from './timeline.js';

export const paraEscalacao = (e: EscalacaoPublica): Escalacao => ({
  time: e.time,
  jogadores: [...e.jogadores]
    .sort((a, b) => a.lugar - b.lugar)
    .map((j) => ({ jogadorId: j.jogadorId, posicao: j.posicao, ovr: j.ovr, habilidades: j.habilidades ?? habilidadesDoPerfil(j.posicao, j.ovr) })),
});

export function timelineDaPartida(p: Pick<PartidaPublica, 'resultado' | 'escalacoes' | 'torcida'>): Timeline | null {
  if (!p.resultado || !p.escalacoes) return null;
  return new Timeline(p.resultado as ResultadoPartida, { mandante: paraEscalacao(p.escalacoes.mandante), visitante: paraEscalacao(p.escalacoes.visitante) }, p.torcida ? { torcida: p.torcida } : {});
}

/**
 * Em que instante do Ao Vivo cada gol aparece na tela, o fim do Ao Vivo e o placar final.
 * É o que a borda usa para os Avisos do App (ADR-0041).
 */
export function momentosDoAoVivo(p: Pick<PartidaPublica, 'resultado' | 'escalacoes' | 'torcida' | 'fase'>): MomentosDoAoVivo | null {
  const tl = timelineDaPartida(p);
  if (!tl) return null;
  const placar = { mandante: 0, visitante: 0 };
  const gols: MomentosDoAoVivo['gols'] = [];
  for (const j of [...tl.janelas].sort((a, b) => a.resolucao - b.resolucao)) {
    if (j.lance.tipo !== 'GOL') continue;
    placar[j.lance.ataque]++;
    gols.push({ lado: j.lance.ataque, emMs: Math.round((j.resolucao / VELOCIDADE_AO_VIVO) * 1000), placar: { ...placar } });
  }
  const r = p.resultado as ResultadoPartida;
  return {
    gols,
    fimMs: duracaoAoVivoMs(p.fase),
    placar: { mandante: r.gols.mandante, visitante: r.gols.visitante },
    ...(r.penaltis ? { penaltis: { mandante: r.penaltis.placar.mandante, visitante: r.penaltis.placar.visitante } } : {}),
  };
}
