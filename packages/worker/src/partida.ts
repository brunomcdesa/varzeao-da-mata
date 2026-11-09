/**
 * Job `partida` (docs/arquitetura.md): escalar → simular → renderizar, cada etapa marcada no
 * status da Partida. Reexecutar retoma de onde parou e nunca refaz uma etapa concluída:
 * uma Partida simulada nunca é simulada de novo (o resultado é o que está no banco).
 */
import { aparenciasEscolhidas } from './perfil.js';
import type { Aparencia } from '@liga/shared';
import { randomInt } from 'node:crypto';
import { nomeDaEtapa, type Escalacao, type TimeId } from '@liga/shared';
import { simularPartida, type Lado, type ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { HORARIOS, FUSO_BRASILIA } from './calendario.js';
import { escalarPartida, type PartidaEscalada } from './escalacao.js';

/** O que o renderer precisa para gravar o Reels (mesmo formato de PartidaParaVideo). */
export interface DadosDoVideo {
  resultado: ResultadoPartida;
  escalacoes: Record<Lado, Escalacao>;
  nomes: Record<Lado, (string | null)[]>;
  /** Apelidos na hora da Escalação (ADR-0014). */
  apelidos?: Record<Lado, (string | null)[]>;
  subtitulo?: string;
  /** Aparências escolhidas pelos donos (ADR-0013), pelo @. */
  aparencias?: Record<string, Aparencia>;
}

/** Grava o MP4 da Partida em `saida`. Injetado para os testes não dependerem do navegador. */
export type Gravador = (dados: DadosDoVideo, saida: string) => Promise<void>;

const ORDEM_STATUS = ['PENDENTE', 'ESCALADA', 'SIMULADA', 'RENDERIZADA', 'AGENDADA', 'PUBLICADA'] as const;
type Status = (typeof ORDEM_STATUS)[number];
const passou = (status: Status, etapa: Status) => ORDEM_STATUS.indexOf(status) >= ORDEM_STATUS.indexOf(etapa);

interface LinhaPartida {
  id: number;
  status: Status;
  mandante_id: TimeId;
  visitante_id: TimeId;
  apito_inicial: string | Date;
  vantagem_do_empate: Lado | null;
  fase: 'LIGA' | 'MATA_MATA';
  rodada: number;
  resultado: ResultadoPartida | null;
  video_url: string | null;
}

async function lerPartida(b: Banco, id: number): Promise<LinhaPartida> {
  const p = (
    await b.query<LinhaPartida>(
      `SELECT p.id, p.status, p.mandante_id, p.visitante_id, p.apito_inicial, p.vantagem_do_empate, p.resultado, p.video_url,
              r.fase, r.numero AS rodada
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE p.id = $1`,
      [id],
    )
  ).rows[0];
  if (!p) throw new Error(`Partida ${id} não existe`);
  return p;
}

/**
 * Simula a Partida já escalada e grava tudo numa transação: seed, resultado, Notas,
 * Habilidades e OVR novos de cada Jogador (Jogadores da Base não mudam). Status → SIMULADA.
 */
export async function simular(banco: Banco, partidaId: number, escalada: PartidaEscalada, o: { seed?: number } = {}): Promise<ResultadoPartida> {
  return banco.transacao(async (b) => {
    const p = await lerPartida(b, partidaId);
    if (passou(p.status, 'SIMULADA')) return p.resultado!;
    if (p.status !== 'ESCALADA') throw new Error(`Partida ${partidaId} precisa estar ESCALADA para simular (está ${p.status})`);

    const seed = o.seed ?? randomInt(0, 2 ** 31);
    const resultado = simularPartida({
      mandante: escalada.escalacoes.mandante,
      visitante: escalada.escalacoes.visitante,
      seed,
      fase: p.fase,
      ...(p.vantagem_do_empate ? { vantagemDoEmpate: p.vantagem_do_empate } : {}),
    });

    for (const d of resultado.desempenhos) {
      const time = resultado.times[d.slot.lado];
      await b.query(
        `UPDATE escalacao SET nota = $4, ovr_depois = $5, habilidades_depois = $6 WHERE partida_id = $1 AND time_id = $2 AND lugar = $3`,
        [partidaId, time, d.slot.indice, d.nota, d.ovrDepois, JSON.stringify(d.habilidadesDepois)],
      );
      if (d.jogadorId !== null) {
        await b.query(`UPDATE jogador SET ovr = $2, habilidades = $3 WHERE id = $1`, [d.jogadorId, d.ovrDepois, JSON.stringify(d.habilidadesDepois)]);
      }
    }
    await b.query(
      `UPDATE partida SET status = 'SIMULADA', seed = $2, versao_sim = $3, gols_mandante = $4, gols_visitante = $5,
              penaltis = $6, lances = $7, resultado = $8 WHERE id = $1`,
      [
        partidaId,
        seed,
        resultado.versaoSim,
        resultado.gols.mandante,
        resultado.gols.visitante,
        resultado.penaltis ? JSON.stringify(resultado.penaltis) : null,
        JSON.stringify(resultado.lances),
        JSON.stringify(resultado),
      ],
    );
    return resultado;
  });
}

/** "Rodada 3, jogo das 14h" (ou "Semifinal…" no Mata-mata). */
export function subtituloDaPartida(rodada: number, fase: 'LIGA' | 'MATA_MATA', apito: Date): string {
  const hora = (apito.getUTCHours() + FUSO_BRASILIA + 24) % 24;
  const nome = nomeDaEtapa(fase, rodada);
  return HORARIOS.includes(hora as (typeof HORARIOS)[number]) ? `${nome}, jogo das ${hora}h` : nome;
}

export interface OpcoesDoJob {
  /** Craque da Rodada anterior (id do Jogador), com lugar garantido na Escalação. */
  craque?: string | null;
  /** Seed fixo (testes); em produção é sorteado e salvo. */
  seed?: number;
  /** Se informado, grava o Reels (status → RENDERIZADA). */
  gravar?: { gravador: Gravador; saida: string };
}

export interface ResultadoDoJob {
  partidaId: number;
  status: Status;
  resultado: ResultadoPartida;
  dados: DadosDoVideo;
  video: string | null;
}

/** Roda as etapas que faltam de uma Partida, na ordem, e devolve onde ela parou. */
export async function rodarPartida(banco: Banco, partidaId: number, o: OpcoesDoJob = {}): Promise<ResultadoDoJob> {
  const escalada = await escalarPartida(banco, partidaId, { craque: o.craque ?? null });
  const resultado = await simular(banco, partidaId, escalada, o.seed !== undefined ? { seed: o.seed } : {});
  const p = await lerPartida(banco, partidaId);
  const dados: DadosDoVideo = {
    resultado,
    escalacoes: escalada.escalacoes,
    nomes: escalada.nomes,
    apelidos: escalada.apelidos,
    subtitulo: subtituloDaPartida(p.rodada, p.fase, new Date(p.apito_inicial)),
    aparencias: await aparenciasEscolhidas(banco),
  };

  let video = p.video_url;
  let status = p.status;
  if (o.gravar && !passou(p.status, 'RENDERIZADA')) {
    await o.gravar.gravador(dados, o.gravar.saida);
    // O link público (R2) entra na etapa de publicação; por enquanto, o arquivo local.
    video = `file://${o.gravar.saida}`;
    await banco.query(`UPDATE partida SET status = 'RENDERIZADA', video_url = $2 WHERE id = $1`, [partidaId, video]);
    status = 'RENDERIZADA';
  }
  return { partidaId, status, resultado, dados, video };
}
