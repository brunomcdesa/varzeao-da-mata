/**
 * Job `partida` (docs/arquitetura.md): escalar → simular → renderizar, cada etapa marcada no
 * status da Partida. Reexecutar retoma de onde parou e nunca refaz uma etapa concluída:
 * uma Partida simulada nunca é simulada de novo (o resultado é o que está no banco).
 */
import { aparenciasEscolhidas } from './perfil.js';
import type { Aparencia, Estrelas, ItensEquipados } from '@liga/shared';
import { randomInt } from 'node:crypto';
import { mataMataDaPartida, type EtapaDaCopa, nomeDaEtapa, ovrDasHabilidades, perfilDoJuiz, temRegrasT3, type Posicao, type BrigaPeloMataMata, type Escalacao, type Grupo, grupoDoTime, type MataMataDaPartida, type Serie, type TimeId } from '@liga/shared';
import { brigaDe } from './briga.js';
import { estrelasNoBanco } from './mataMata.js';
import { simularPartida, type Desempenho, type Lado, type ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { FUSO_BRASILIA } from './calendario.js';
import { gruposDaTemporada, seriesDaTemporada } from './series.js';
import { escalarPartida, type PartidaEscalada } from './escalacao.js';
import { pagarPartida } from './moedas.js';
import { capitaoEmCampo, gritosDaPartida } from './planoDoTime.js';
import { beiraDaPartida, type BeiraDoCampo } from './beiraDoCampo.js';
import { batedoresDaPartida, formacoesDaPartida, partidaTemRegrasT2, posturasDaPartida, tamanhoDosElencos } from './temporada2.js';

/** O que o renderer precisa para gravar o Reels (mesmo formato de PartidaParaVideo). */
export interface DadosDoVideo {
  resultado: ResultadoPartida;
  escalacoes: Record<Lado, Escalacao>;
  nomes: Record<Lado, (string | null)[]>;
  /** Apelidos na hora da Escalação (ADR-0014). */
  apelidos?: Record<Lado, (string | null)[]>;
  /** Número da camisa na hora da Escalação (ADR-0075); null = camisa lisa. */
  numeros?: Record<Lado, (number | null)[]>;
  /** Itens equipados na hora da Escalação (ADR-0101). */
  itens?: Record<Lado, (ItensEquipados | null)[]>;
  subtitulo?: string;
  /** Aparências escolhidas pelos donos (ADR-0013), pelo @. */
  aparencias?: Record<string, Aparencia>;
  /** Estrelas de Título nos escudos (ADR-0060). */
  estrelas?: Partial<Record<TimeId, Estrelas>>;
  /** Temporada 2: tamanho de cada Elenco, para a Arquibancada (ADR-0019). Nunca na T1. */
  torcida?: Record<Lado, number>;
  gritos?: Partial<Record<Lado, string>>;
  tecnicos?: BeiraDoCampo['tecnicos'];
  /** Marcação individual (ADR-0112) pelos lugares na Escalação, para a fala do Narrador. */
  marcacoes?: Partial<Record<Lado, { marcador: number; alvo: number }>>;
  capitaes?: BeiraDoCampo['capitaes'];
  /** Mata-mata (ADR-0048): o Narrador e o fim do Reels falam da Semifinal ou da Final. */
  mataMata?: MataMataDaPartida | null;
  /** Última Rodada da Fase de Liga (ADR-0053): quem já está Garantido e o que vale a Partida. */
  briga?: BrigaPeloMataMata | null;
  /** Grupo da Partida na Fase de Liga com Grupos (T2), mostrado na capa do Reels (ADR-0106). */
  grupo?: Grupo | null;
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
  serie: Serie;
  temporada_id: number;
  temporada: number;
  copa_etapa: EtapaDaCopa | null;
}

async function lerPartida(b: Banco, id: number): Promise<LinhaPartida> {
  const p = (
    await b.query<LinhaPartida>(
      `SELECT p.id, p.status, p.mandante_id, p.visitante_id, p.apito_inicial, p.vantagem_do_empate, p.resultado, p.video_url,
              r.fase, r.numero AS rodada, p.serie, r.temporada_id, t.numero AS temporada, p.copa_etapa
       FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id WHERE p.id = $1`,
      [id],
    )
  ).rows[0];
  if (!p) throw new Error(`Partida ${id} não existe`);
  return p;
}

/** A Posição de inscrição do Jogador nesta Partida: a de origem quando jogou fora de posição. */
export function posicaoDeInscricao(d: Pick<Desempenho, 'jogadorId' | 'posicao' | 'posicaoDeOrigem'>, escalacao: Escalacao): Posicao {
  const linha = [...escalacao.jogadores, ...(escalacao.banco ?? [])].find((j) => j.jogadorId !== null && j.jogadorId === d.jogadorId);
  return linha?.posicaoDeOrigem ?? d.posicaoDeOrigem ?? linha?.posicao ?? d.posicao;
}

/**
 * OVR que fica no Jogador depois da Partida (ADR-0098): o das Habilidades novas com os pesos da
 * Posição dele. Fora de posição, o OVR da vaga (ADR-0044) vale só dentro da Partida.
 */
export function ovrQueFica(d: Pick<Desempenho, 'jogadorId' | 'posicao' | 'posicaoDeOrigem' | 'ovrDepois' | 'habilidadesDepois'>, escalacao: Escalacao): number {
  const posicao = posicaoDeInscricao(d, escalacao);
  return posicao === d.posicao ? d.ovrDepois : ovrDasHabilidades(posicao, d.habilidadesDepois);
}

/**
 * Simula a Partida já escalada e grava tudo numa transação: seed, resultado, Notas,
 * Habilidades e OVR novos de cada Jogador (Jogadores da Base não mudam). Status → SIMULADA.
 */
export async function simular(banco: Banco, partidaId: number, escalada: PartidaEscalada, o: { seed?: number } = {}): Promise<ResultadoPartida> {
  return banco.transacao(async (b) => {
    // Trava a Partida: o job escalar e o job partida podem simular ao mesmo tempo (ADR-0038);
    // o segundo espera o primeiro terminar e devolve o resultado dele.
    await b.query(`SELECT 1 FROM partida WHERE id = $1 FOR UPDATE`, [partidaId]);
    const p = await lerPartida(b, partidaId);
    if (passou(p.status, 'SIMULADA')) return p.resultado!;
    if (p.status !== 'ESCALADA') throw new Error(`Partida ${partidaId} precisa estar ESCALADA para simular (está ${p.status})`);

    const seed = o.seed ?? randomInt(0, 2 ** 31);
    // Regras da Temporada 2 só para Partidas de uma Temporada com elas (a T1 segue a versão 5).
    const t2 = (await partidaTemRegrasT2(b, partidaId))
      ? {
          postura: await posturasDaPartida(b, partidaId, p.mandante_id, p.visitante_id),
          // Formação (ADR-0044): a mesma que montou a Escalação.
          formacao: await formacoesDaPartida(b, partidaId, p.mandante_id, p.visitante_id),
        }
      : undefined;
    const resultado = simularPartida({
      mandante: escalada.escalacoes.mandante,
      visitante: escalada.escalacoes.visitante,
      seed,
      fase: p.fase,
      ...(p.vantagem_do_empate ? { vantagemDoEmpate: p.vantagem_do_empate } : {}),
      ...(t2 ? { t2 } : {}),
      // Regras da Temporada 3 (ADRs 0091 e 0094): Juiz sorteado pelo id da Partida e Batedores.
      // Capitão em campo (ADR-0112): cobradores de escanteio e Marcação individual.
      ...(t2 && temRegrasT3(p.temporada)
        ? { t3: { juiz: perfilDoJuiz(partidaId), batedores: await batedoresDaPartida(b, partidaId, p.mandante_id, p.visitante_id), ...(await capitaoEmCampo(b, partidaId, p.mandante_id, p.visitante_id)) } }
        : {}),
    });

    for (const d of resultado.desempenhos) {
      const time = resultado.times[d.slot.lado];
      // Substituição (ADR-0061): o reserva que entrou tem a sua linha no Banco (lugar depois
      // dos titulares); a do titular que saiu continua no lugar dele.
      const troca = d.substituicao === 'ENTROU' ? resultado.substituicoes?.find((x) => x.lado === d.slot.lado && x.lugar === d.slot.indice) : undefined;
      const lugar = troca ? escalada.escalacoes[d.slot.lado].jogadores.length + troca.banco : d.slot.indice;
      await b.query(
        `UPDATE escalacao SET nota = $4, ovr_depois = $5, habilidades_depois = $6, faltas = $7, amarelos = $8, expulso = $9,
                substituicao = $10, entrou = $11, lugar_em_campo = $12
         WHERE partida_id = $1 AND time_id = $2 AND lugar = $3`,
        [partidaId, time, lugar, d.nota, d.ovrDepois, JSON.stringify(d.habilidadesDepois), d.faltas ?? null, d.amarelos ?? null, d.expulso ?? false, d.substituicao ?? null, !!troca, troca ? d.slot.indice : null],
      );
      if (d.jogadorId !== null) {
        // Fora de posição, o OVR da vaga vale só na Partida: o Jogador fica com o da Posição dele (ADR-0098).
        const ovr = ovrQueFica(d, escalada.escalacoes[d.slot.lado]);
        await b.query(`UPDATE jogador SET ovr = $2, habilidades = $3 WHERE id = $1`, [d.jogadorId, ovr, JSON.stringify(d.habilidadesDepois)]);
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
    // Moedas (ADR-0087): gols, assistências, Palpites e Conquistas, visíveis no fim do Ao Vivo.
    await pagarPartida(b, partidaId);
    return resultado;
  });
}

/** Semifinal ou Final, com a Temporada e a Série (null na Fase de Liga). ADR-0048. */
async function mataMataDe(banco: Banco, p: LinhaPartida): Promise<MataMataDaPartida | null> {
  if (p.fase !== 'MATA_MATA') return null;
  const comSeries = (await seriesDaTemporada(banco, p.temporada_id)).B.length > 0;
  return mataMataDaPartida({ fase: p.fase, rodada: p.rodada, temporada: p.temporada, serie: p.serie, comSeries, copa: p.copa_etapa });
}

/** "Rodada 3, jogo das 14h" (ou "Semifinal…" no Mata-mata). `ultima`: última Rodada da Liga da Série. */
export function subtituloDaPartida(rodada: number, fase: 'LIGA' | 'MATA_MATA', apito: Date, ultima = false, copa: EtapaDaCopa | null = null): string {
  const hora = (apito.getUTCHours() + FUSO_BRASILIA + 24) % 24;
  const nome = nomeDaEtapa(fase, rodada, copa);
  if (fase === 'LIGA' && ultima) return `Última Rodada, jogo das ${hora}h`;
  return fase === 'LIGA' ? `${nome}, jogo das ${hora}h` : nome;
}

export interface OpcoesDoJob {
  /** Craque da Rodada anterior (id do Jogador), com lugar garantido na Escalação. */
  craque?: string | null;
  /** Jogadores com Vínculo (T2): a faixa de Capitão prefere quem tem (ADR-0020). */
  vinculos?: ReadonlySet<string>;
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
  const escalada = await escalarPartida(banco, partidaId, { craque: o.craque ?? null, ...(o.vinculos ? { vinculos: o.vinculos } : {}) });
  const resultado = await simular(banco, partidaId, escalada, o.seed !== undefined ? { seed: o.seed } : {});
  const p = await lerPartida(banco, partidaId);
  // Briga pelo Mata-mata (ADR-0053): só na última Rodada da Liga da Série.
  const briga = await brigaDe(banco, partidaId);
  const dados: DadosDoVideo = {
    resultado,
    escalacoes: escalada.escalacoes,
    // Banco (ADR-0061): os nomes dos reservas vêm depois dos titulares (o "ocupante" do lugar).
    nomes: { mandante: [...escalada.nomes.mandante, ...(escalada.banco?.mandante.map((x) => x.nome) ?? [])], visitante: [...escalada.nomes.visitante, ...(escalada.banco?.visitante.map((x) => x.nome) ?? [])] },
    apelidos: { mandante: [...escalada.apelidos.mandante, ...(escalada.banco?.mandante.map((x) => x.apelido) ?? [])], visitante: [...escalada.apelidos.visitante, ...(escalada.banco?.visitante.map((x) => x.apelido) ?? [])] },
    numeros: { mandante: [...escalada.numeros.mandante, ...(escalada.banco?.mandante.map((x) => x.numero) ?? [])], visitante: [...escalada.numeros.visitante, ...(escalada.banco?.visitante.map((x) => x.numero) ?? [])] },
    // Itens da Loja (ADR-0101): os equipados no Corte, do jeito que a Escalação guardou.
    itens: { mandante: [...escalada.itens.mandante, ...(escalada.banco?.mandante.map((x) => x.itens ?? null) ?? [])], visitante: [...escalada.itens.visitante, ...(escalada.banco?.visitante.map((x) => x.itens ?? null) ?? [])] },
    subtitulo: subtituloDaPartida(p.rodada, p.fase, new Date(p.apito_inicial), briga !== null, p.copa_etapa),
    aparencias: await aparenciasEscolhidas(banco),
    estrelas: await estrelasNoBanco(banco),
  };
  const mataMata = await mataMataDe(banco, p);
  if (mataMata) dados.mataMata = mataMata;
  if (briga) dados.briga = briga;
  // Capa do Reels (ADR-0106): o Grupo só existe na Fase de Liga com Grupos.
  if (p.fase === 'LIGA') {
    const grupo = grupoDoTime(await gruposDaTemporada(banco, p.temporada_id), p.mandante_id);
    if (grupo) dados.grupo = grupo;
  }
  if (resultado.postura != null) {
    const elencos = await tamanhoDosElencos(banco);
    dados.torcida = { mandante: elencos.get(p.mandante_id) ?? 0, visitante: elencos.get(p.visitante_id) ?? 0 };
  }
  // Grito da Temporada (ADR-0112) na faixa da Arquibancada.
  const gritos = await gritosDaPartida(banco, p.id);
  if (Object.keys(gritos).length) dados.gritos = gritos;
  // Beira do campo (ADRs 0111 e 0112): o Técnico e a Braçadeira do Capitão.
  // Marcação individual (ADR-0112): só com marcador e alvo em campo, pelos lugares.
  if (resultado.juiz !== undefined) {
    const { marcacao } = await capitaoEmCampo(banco, p.id, p.mandante_id, p.visitante_id);
    const marcacoes: Partial<Record<Lado, { marcador: number; alvo: number }>> = {};
    for (const lado of ['mandante', 'visitante'] as const) {
      const m = marcacao[lado];
      if (!m) continue;
      const rival = lado === 'mandante' ? 'visitante' : 'mandante';
      const marcador = escalada.escalacoes[lado].jogadores.findIndex((j) => j.jogadorId === m.marcador);
      const alvo = escalada.escalacoes[rival].jogadores.findIndex((j) => j.jogadorId === m.alvo);
      if (marcador >= 0 && alvo >= 0) marcacoes[lado] = { marcador, alvo };
    }
    if (Object.keys(marcacoes).length) dados.marcacoes = marcacoes;
  }
  const beira = await beiraDaPartida(banco, p.id);
  if (beira) {
    dados.tecnicos = beira.tecnicos;
    dados.capitaes = beira.capitaes;
  }

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
