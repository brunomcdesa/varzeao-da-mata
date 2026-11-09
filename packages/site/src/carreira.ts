/**
 * Página de Carreira (ADR-0025): agrupa o histórico do Jogador por Temporada. Sem DOM, para
 * ser testado.
 */
import type { JogadorPublico, TimeId, TipoTrofeu } from '@liga/shared';

type Jogo = JogadorPublico['historico'][number];

export interface TemporadaDaCarreira {
  numero: number;
  /** Times pelos quais jogou, na ordem (mais de um quando houve Transferência). */
  times: { time: TimeId; serie?: 'A' | 'B' | undefined }[];
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols: number;
  assistencias: number;
  notaMedia: number | null;
  ovrInicio: number | null;
  ovrFim: number | null;
  amarelos: number;
  expulsoes: number;
  trofeus: [TipoTrofeu, number][];
}

/** Agrupa o histórico por Temporada (a mais recente primeiro). Exportada para os testes. */
export function temporadasDaCarreira(j: JogadorPublico): TemporadaDaCarreira[] {
  const porNumero = new Map<number, Jogo[]>();
  for (const h of j.historico) porNumero.set(h.temporada, [...(porNumero.get(h.temporada) ?? []), h]);
  const numeros = new Set([...porNumero.keys(), ...j.trofeus.map((t) => t.temporada)]);
  return [...numeros]
    .sort((a, b) => b - a)
    .map((numero) => {
      const jogos = porNumero.get(numero) ?? [];
      const times: TemporadaDaCarreira['times'] = [];
      for (const h of jogos) {
        const time = h.time;
        if (time && times.at(-1)?.time !== time) times.push({ time, serie: h.serie });
      }
      // Antes de existir o campo `time` no histórico, a Temporada fica com o Time dos troféus.
      if (!times.length) {
        const t = j.trofeus.find((x) => x.temporada === numero);
        if (t) times.push({ time: t.time });
      }
      // OVR do começo: o primeiro jogo menos o que ele mexeu não existe no histórico; usa o
      // OVR inicial da Carreira na primeira Temporada e o fim da anterior nas outras.
      const anteriores = j.historico.filter((h) => h.temporada < numero);
      const ovrInicio = jogos.length ? (anteriores.at(-1)?.ovr ?? j.ovrInicial) : null;
      const notas = jogos.map((h) => h.nota);
      const contagem = new Map<TipoTrofeu, number>();
      for (const t of j.trofeus) if (t.temporada === numero) contagem.set(t.tipo, (contagem.get(t.tipo) ?? 0) + 1);
      return {
        numero,
        times,
        jogos: jogos.length,
        vitorias: jogos.filter((h) => h.pro > h.contra).length,
        empates: jogos.filter((h) => h.pro === h.contra).length,
        derrotas: jogos.filter((h) => h.pro < h.contra).length,
        gols: jogos.reduce((s, h) => s + h.gols, 0),
        assistencias: jogos.reduce((s, h) => s + (h.assistencias ?? 0), 0),
        notaMedia: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
        ovrInicio,
        ovrFim: jogos.at(-1)?.ovr ?? null,
        amarelos: jogos.reduce((s, h) => s + (h.amarelos ?? 0), 0),
        expulsoes: jogos.filter((h) => h.expulso).length,
        trofeus: (['CAMPEAO', 'CRAQUE_TEMPORADA', 'CRAQUE_RODADA', 'REI_DO_CLASSICO'] as TipoTrofeu[]).filter((t) => contagem.has(t)).map((t) => [t, contagem.get(t)!]),
      };
    });
}

