import type { MomentosDoAoVivo } from './avisos.js';
/**
 * Formato dos dados públicos do site (gerados pelo worker, lidos pelo site).
 * Regra: nada que revele o resultado de uma Partida antes do seu Apito Inicial.
 */
import type { Aparencia } from './aparencia.js';
import type { ItensEquipados } from './itens.js';
import type { Estrelas } from './estrelas.js';
import type { Especializacao, Grupo, Posicao, Serie, TimeId } from './index.js';
import { TIMES_FUNDADORES } from './index.js';
import type { HabilidadeId, Habilidades } from './habilidades.js';

export interface TimePublico {
  id: TimeId;
  nome: string;
  sigla: string;
  primaria: string;
  secundaria: string;
  /** Perfil do Time no Instagram, sem o @ (ADR-0100). Só os reconhecidos como oficiais. */
  instagram?: string;
  /** Técnico do Time (ADR-0106): o @ e o Apelido, quando tem. */
  tecnico?: { id: string; username: string; apelido: string | null };
  /** Fila de espera por Posição (ADR-0106): quantos esperam vaga. */
  fila?: Partial<Record<'GOL' | 'ZAG' | 'MEI' | 'ATA', number>>;
}

export interface LinhaTabelaPublica {
  time: TimeId;
  jogos: number;
  pontos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldo: number;
}

/** AGENDADA: antes do Apito. AO_VIVO: até ~5 min depois. ENCERRADA: daí em diante. */
export type SituacaoPartida = 'AGENDADA' | 'AO_VIVO' | 'ENCERRADA';

export interface PartidaNoCalendario {
  id: number;
  rodada: number;
  fase: 'LIGA' | 'MATA_MATA';
  apito: string;
  mandante: TimeId;
  visitante: TimeId;
  situacao: SituacaoPartida;
  classico: boolean;
  /** Só depois do Apito Inicial. */
  placar?: { mandante: number; visitante: number; penaltis?: { mandante: number; visitante: number } };
  /** Já existe Escalação (a partir do Corte). */
  escalada: boolean;
  /** Legado (regra antiga da Vantagem do Empate); hoje o Mata-mata vai para os pênaltis. */
  vantagemDoEmpate?: boolean;
  /** Mata-mata encerrado: quem avançou (ou foi campeão). */
  classificado?: TimeId;
  /** A Série da Partida (ADR-0017). Sem o campo, é a A. */
  serie?: Serie;
  /** Copa (ADR-0088): a etapa da Partida; sem o campo, não é da Copa. */
  copa?: import('./copa.js').EtapaDaCopa;
}

export interface RodadaPublica {
  /** Id da Rodada no banco: é o que o voto pelo site manda para a borda. */
  id: number;
  numero: number;
  fase: 'LIGA' | 'MATA_MATA';
  data: string;
  /** O Resumo da Rodada já saiu no Instagram: a partir daí o site mostra a próxima Rodada. */
  resumoPublicado?: boolean;
  /**
   * `numero`: o número interno, que o site manda para a borda ao votar. `rotulo`: o que se
   * comenta ("3", ou "A3" e "B3" com duas Séries). `serie`: a Série do Candidato (ADR-0017).
   */
  candidatos: { numero: number; rotulo?: string; serie?: Serie; jogadorId: string; username: string; apelido?: string | null; time: TimeId; posicao: Posicao; nota: number }[];
  /** RODADA: Craque da Rodada. TEMPORADA: na Final, os Candidatos são a Craque da Temporada (nota = média). */
  votacao: 'RODADA' | 'TEMPORADA';
  /** Definido quando a votação fecha. Com duas Séries, é o da A. */
  craque: { jogadorId: string; username: string; apelido?: string | null; time: TimeId } | null;
  /** Craque da Série B, quando a Rodada tem Série B. */
  craqueB?: { jogadorId: string; username: string; apelido?: string | null; time: TimeId } | null;
}

export interface LigaPublica {
  /** Ranking de Palpites da Temporada (ADR-0089): pontos somados, mesmo além do teto do dia. */
  palpites?: { jogadorId: string; username: string; apelido: string | null; pontos: number; acertos: number }[];
  atualizadoEm: string;
  temporada: { numero: number; status: string } | null;
  times: TimePublico[];
  /** Tabela da Série A (ou da Liga inteira, antes das Séries). */
  tabela: LinhaTabelaPublica[];
  /** Tabela da Série B, quando a Temporada tem Séries (ADR-0017). */
  tabelaB?: LinhaTabelaPublica[];
  /** Quantos Times caem no fim da Temporada atual: na T2, os 4 últimos de cada Grupo (ADR-0064). */
  caem?: number;
  /** Na T2, a tabela de cada Grupo da Série A (ADR-0064). */
  grupos?: { grupo: Grupo; nome: string; tabela: LinhaTabelaPublica[] }[];
  /** Os Times de cada Série na Temporada atual, quando ela tem Séries. */
  series?: Record<Serie, TimeId[]> | null;
  /**
   * A Temporada que aceita Inscrição agora (ADR-0068): a atual ou, na Pré-temporada, a próxima.
   * Traz os Times dela (os mesmos da Inscrição) e, na T2, os Grupos. O App libera por ela.
   */
  ativa?: { numero: number; times: TimeId[]; grupos?: Record<Grupo, TimeId[]> | null } | null;
  calendario: PartidaNoCalendario[];
  rodadas: RodadaPublica[];
  /** Só depois que o Ao Vivo da Final termina. Com duas Séries, é o campeão da A. */
  campeao: TimeId | null;
  campeaoB?: TimeId | null;
  /** Craque da Temporada atual, depois do anúncio (dia seguinte à Final, 19h). */
  craqueDaTemporada: JogadorResumido | null;
  craqueDaTemporadaB?: JogadorResumido | null;
  /** Todas as Temporadas, da mais recente para a mais antiga. */
  temporadas: TemporadaNaHistoria[];
  /** Estrelas de Título no escudo de cada Time (ADR-0060); Time sem Título fica de fora. */
  estrelas?: Partial<Record<TimeId, Estrelas>>;
  /** Temporada já criada que ainda não começou (o site a anuncia). */
  proximaTemporada?: { numero: number; inicio: string } | null;
}

export interface JogadorResumido {
  jogadorId: string;
  username: string;
  apelido?: string | null;
  time: TimeId;
  posicao: Posicao;
}

export interface TemporadaNaHistoria {
  numero: number;
  status: string;
  inicio: string;
  /** Só com a Final encerrada. */
  campeao: TimeId | null;
  vice: TimeId | null;
  final: { partidaId: number; mandante: TimeId; visitante: TimeId; placar: { mandante: number; visitante: number; penaltis?: { mandante: number; visitante: number } } } | null;
  craque: JogadorResumido | null;
  artilheiro: (JogadorResumido & { gols: number }) | null;
  /** Maior nota média entre os goleiros com pelo menos 3 jogos (desempate: menos gols sofridos por jogo). */
  goleiro: (JogadorResumido & { notaMedia: number; jogos: number; defesas: number; golsSofridos: number }) | null;
  /** Tabela da Fase de Liga (parcial enquanto a Temporada corre). Com duas Séries, a da A. */
  tabela: LinhaTabelaPublica[];
  /** Copa (ADR-0088): campeão, vice e Final. */
  copa?: {
    campeao: TimeId | null;
    vice: TimeId | null;
    final: { partidaId: number; mandante: TimeId; visitante: TimeId; placar: { mandante: number; visitante: number; penaltis?: { mandante: number; visitante: number } } } | null;
  };
  /** Série B (ADR-0017): campeão, vice, Final, Craque e tabela. */
  serieB?: {
    campeao: TimeId | null;
    vice: TimeId | null;
    final: { partidaId: number; mandante: TimeId; visitante: TimeId; placar: { mandante: number; visitante: number; penaltis?: { mandante: number; visitante: number } } } | null;
    craque: JogadorResumido | null;
    tabela: LinhaTabelaPublica[];
  };
}

export interface Estatisticas {
  jogos: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  dribles: number;
  bloqueios: number;
  notaMedia: number | null;
  melhorNota: number | null;
  vitorias: number;
  empates: number;
  derrotas: number;
}

export type TipoTrofeu = 'CAMPEAO' | 'CAMPEAO_COPA' | 'CRAQUE_TEMPORADA' | 'SELECAO_TEMPORADA' | 'CRAQUE_RODADA' | 'SELECAO_RODADA' | 'REI_DO_CLASSICO';
/** Ordem em que os troféus aparecem no site. */
export const ORDEM_DOS_TROFEUS: readonly TipoTrofeu[] = ['CAMPEAO', 'CAMPEAO_COPA', 'CRAQUE_TEMPORADA', 'SELECAO_TEMPORADA', 'CRAQUE_RODADA', 'SELECAO_RODADA', 'REI_DO_CLASSICO'];

export interface Trofeu {
  tipo: TipoTrofeu;
  temporada: number;
  /** Craque da Rodada: a Rodada (8 = Semifinais). Rei do Clássico: a Rodada do jogo. */
  rodada?: number;
  fase?: 'LIGA' | 'MATA_MATA';
  time: TimeId;
  partidaId?: number;
  /** Título e Craques da Série B (ADR-0017). Sem o campo, é da A. */
  serie?: Serie;
  /** Destaques por Posição (ADR-0041): a Posição do Destaque (Muralha, Carrapato, Garçom, Matador). */
  posicao?: Posicao;
}

export interface JogadorPublico {
  id: string;
  username: string;
  /** Nome escolhido pelo dono (ADR-0014); sem ele, aparece o @. */
  apelido?: string | null;
  /** Quando o apelido foi trocado pela última vez (uma troca por Rodada, ADR-0014). */
  apelidoTrocadoEm?: string | null;
  time: TimeId;
  posicao: Posicao;
  /** OVR visível: não muda antes do Apito da Partida que o alterou. */
  ovr: number;
  ovrInicial: number;
  /** Habilidades visíveis (mesma regra do OVR): uma casa decimal; o site mostra inteiros. */
  habilidades: Habilidades;
  habilidadesIniciais: Habilidades;
  inscritoEm: string;
  /** Já usou a Transferência da Temporada atual (ADR-0012). */
  transferenciaUsada: boolean;
  /** Visual do boneco escolhido pelo dono (ADR-0013); null = o sorteado pelo @. */
  visual: Aparencia | null;
  /** Número da camisa escolhido pelo dono. */
  numero: number | null;
  /** Itens da Loja equipados agora (ADR-0101); o saldo nunca aparece. */
  itens?: ItensEquipados;
  /** Fundador de um Time da Série B (ADR-0036): só existe a partir da Temporada 2. */
  fundador?: { time: TimeId; temporada: number };
  /** Selo da Temporada 1 (ADR-0047): se inscreveu na T1. Só aparece no site a partir da T2. */
  seloT1?: true;
  /** Conquistas (ADR-0090): selos da Carreira, a partir da T3 (código e Temporada em que saiu). */
  conquistas?: { codigo: string; temporada: number }[];
  /** Piso da Temporada 1 (ADR-0047): o OVR antes e depois, só para quem subiu. Marca o degrau no gráfico do OVR (ADR-0078). */
  pisoT1?: { antes: number; depois: number };
  /** Base do OVR (ADR-0079): o último ajuste do dono. O '+N' e as barras do card partem daqui. */
  base?: { ovr: number; habilidades: Habilidades };
  /** Degraus do gráfico do OVR (ADR-0079): o OVR novo logo depois do jogo `jogo` (0 = antes da estreia). */
  degraus?: { jogo: number; ovr: number }[];
  /** Números da carreira (todas as Temporadas); `nestaTemporada` só a atual. */
  jogos: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  dribles: number;
  bloqueios: number;
  notaMedia: number | null;
  melhorNota: number | null;
  vitorias: number;
  empates: number;
  derrotas: number;
  vezesCandidato: number;
  craqueDaRodada: number;
  craqueDaTemporada: number;
  titulos: number;
  reiDoClassico: number;
  temporadas: number;
  nestaTemporada: Estatisticas;
  trofeus: Trofeu[];
  /** OVR depois de cada Partida já revelada, em ordem (todas as Temporadas). */
  historico: {
    partidaId: number; temporada: number; rodada: number; fase: 'LIGA' | 'MATA_MATA'; nota: number; ovr: number; habilidades: Habilidades; gols: number; rival: TimeId; emCasa: boolean; pro: number; contra: number;
    /** Time pelo qual jogou e assistências (Página de Carreira, ADR-0025). */
    time?: TimeId;
    assistencias?: number;
    serie?: Serie;
    /** Temporada 2 (ADR-0021): cartões. Ausentes nas Partidas da T1. */
    amarelos?: number;
    expulso?: boolean;
  }[];
  /** Temporada 2 (ADR-0020): é o Capitão atual do Time. Ausente na T1 e para os outros. */
  capitao?: true;
  /** Temporada 2 (ADR-0023): Especialização e Treino escolhidos. Ausentes na T1. */
  especializacao?: Especializacao | null;
  treino?: HabilidadeId | null;
}

export interface EscalacaoPublica {
  time: TimeId;
  /** `capitao`: faixa de Capitão nesta Partida (só na T2, ADR-0020). */
  /** `numero`: número da camisa na hora da Escalação (ADR-0075); sem ele, camisa lisa. */
  jogadores: { lugar: number; posicao: Posicao; jogadorId: string | null; username: string | null; apelido?: string | null; numero?: number | null; itens?: ItensEquipados; ovr: number; habilidades: Habilidades; capitao?: true }[];
  /** Banco (T2, ADR-0061): os reservas, nos lugares depois dos titulares (7 e 8). */
  banco?: { lugar: number; posicao: Posicao; jogadorId: string | null; username: string | null; apelido?: string | null; numero?: number | null; itens?: ItensEquipados; ovr: number; habilidades: Habilidades }[];
}

export interface PartidaPublica {
  id: number;
  rodada: number;
  fase: 'LIGA' | 'MATA_MATA';
  apito: string;
  mandante: TimeId;
  visitante: TimeId;
  classico: boolean;
  situacao: SituacaoPartida;
  escalacoes: { mandante: EscalacaoPublica; visitante: EscalacaoPublica } | null;
  /** ResultadoPartida completo (lances, desempenhos), só depois do Apito Inicial. */
  resultado: unknown | null;
  video: string | null;
  /** Áudio da narração do Ao Vivo (o jogo inteiro, no tempo do Ao Vivo), depois do Apito. */
  narracao: string | null;
  /** Temporada 2: tamanho de cada Elenco, para a Arquibancada. Ausente nas Partidas da T1. */
  torcida?: Record<'mandante' | 'visitante', number>;
  /** Mata-mata (ADR-0048): Semifinal ou Final, Temporada e Série. No fim mostra quem foi pra Final ou o campeão. */
  mataMata?: import('./rodada.js').MataMataDaPartida;
  /** Última Rodada da Fase de Liga (ADR-0053): faixa e plaquinhas da Briga pelo Mata-mata no Ao Vivo e no Replay. */
  briga?: import('./briga.js').BrigaPeloMataMata;
  /** Só no arquivo privado (job partida): quando cada gol aparece no Ao Vivo, para os Avisos do App (ADR-0042). */
  momentos?: MomentosDoAoVivo;
  /** Copa (ADR-0088): a etapa da Partida. */
  copa?: import('./copa.js').EtapaDaCopa;
  /** T3 (ADR-0089): a Partida aceita Palpite (até o Corte, pelo Vínculo). */
  palpite?: true;
  /** T3 (ADR-0094): o Perfil do Juiz, que aparece junto com a Escalação. */
  juiz?: import('./temporada3.js').PerfilDoJuiz;
}

/**
 * Os Times da Temporada que aceita Inscrição (ADR-0068): na Pré-temporada, já os da próxima. Em
 * dados antigos (sem `ativa`), os das Séries ou os fundadores.
 */
export function timesDaLiga(l: Pick<LigaPublica, 'ativa' | 'series'>): TimeId[] {
  if (l.ativa?.times.length) return [...l.ativa.times];
  return l.series ? [...l.series.A, ...l.series.B] : [...TIMES_FUNDADORES];
}

/** A Temporada atual ainda é a Pré-temporada (ADR-0081): tabela zerada, antes do Apito Inicial da estreia. */
export function tabelaDaPreTemporada(l: Pick<LigaPublica, 'grupos'> & { temporada: { status: string } | null }): boolean {
  return Boolean(l.grupos?.length && l.temporada?.status === 'PRE_TEMPORADA');
}

/** Uma vaga projetada das Semifinais: o Time (quando a Fase de Liga já tem jogo), a posição e o texto de espera. */
export interface VagaProjetada {
  time: TimeId | null;
  semente: string;
  espera: string;
}

/**
 * Quem estaria nas Semifinais se a Fase de Liga acabasse hoje. Com Grupos (ADR-0064): 1º do Barro ×
 * 2º do Galho e 1º do Galho × 2º do Barro; sem: 1º × 4º e 2º × 3º. Antes do primeiro jogo, só as
 * posições, sem Time (ADR-0084): com tudo zerado, a ordem é só a do desempate por sigla.
 */
export function semifinaisProjetadas(tabela: LinhaTabelaPublica[], grupos?: { nome: string; tabela: LinhaTabelaPublica[] }[] | null): [[VagaProjetada, VagaProjetada], [VagaProjetada, VagaProjetada]] {
  if (grupos && grupos.length === 2) {
    const correndo = grupos.some((g) => g.tabela.some((x) => x.jogos > 0));
    const curto = (nome: string) => nome.replace(/^Grupo d[oa] /, '');
    const vaga = (g: number, pos: number): VagaProjetada => ({
      time: correndo ? (grupos[g]!.tabela[pos]?.time ?? null) : null,
      semente: `${pos + 1}º ${curto(grupos[g]!.nome)}`,
      espera: `${pos + 1}º do ${curto(grupos[g]!.nome)}`,
    });
    return [
      [vaga(0, 0), vaga(1, 1)],
      [vaga(1, 0), vaga(0, 1)],
    ];
  }
  const vaga = (pos: number): VagaProjetada => ({ time: tabela[pos]?.time ?? null, semente: `${pos + 1}º`, espera: `${pos + 1}º colocado` });
  return [
    [vaga(0), vaga(3)],
    [vaga(1), vaga(2)],
  ];
}

/** Os Grupos da Temporada que aceita Inscrição (T2, ADR-0064), ou null. */
export function gruposDaLiga(l: Pick<LigaPublica, 'ativa'>): Record<Grupo, TimeId[]> | null {
  return l.ativa?.grupos ?? null;
}
