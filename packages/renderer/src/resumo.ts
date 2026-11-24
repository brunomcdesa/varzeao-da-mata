/**
 * Reels do Resumo da Rodada (19h): placares, tabela, Novos Contratados, Candidatos a Craque
 * e a chamada para votar e jogar. Sequência de cartelas no mesmo estilo de várzea dos lances,
 * narrada pelo Locutor da Liga; cada cartela estica até a sua fala caber inteira.
 */
import { desenharCompartilhe } from './anuncio.js';
import { CLASSIFICAM_POR_GRUPO, DESTAQUE_DA_POSICAO, NOME_CURTO_DO_GRUPO, porcentagem, textoDaQueda, textoDaSemifinal, FALA_DO_TIME, IDENTIDADE, NOME_DO_GRUPO, TIMES_QUE_TROCAM_DE_SERIE, type Grupo, doTime, nomeDaRodada, type Posicao, type Serie, type TimeId, type Aparencia, type Estrelas, type ChancesDoTime, type ItensEquipados } from '@liga/shared';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, plaquinha } from './desenho.js';
import { apelidoFalavel, type Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste } from './pixel.js';
import type { Segmento } from './roteiro.js';
import { aparencia, itensDe, sprite } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDoResumo {
  temporada: number;
  rodada: number;
  fase: 'LIGA' | 'MATA_MATA';
  /** `serie`: em Temporadas com Série B, de qual Série é o placar (ADR-0017). */
  placares: { mandante: TimeId; visitante: TimeId; golsMandante: number; golsVisitante: number; penaltis: { mandante: number; visitante: number } | null; hora: number; serie?: Serie }[];
  /** Tabela da Série A (ou da Liga inteira, antes das Séries). */
  tabela: { time: TimeId; jogos: number; pontos: number; vitorias: number; saldo: number }[];
  /** Quantos Times da Série A caem no fim da Temporada (2 com Série B; 8 na T2, só com a A de 16, ADR-0062). */
  caem?: number;
  /** Com Grupos (T2, ADR-0064): a tabela de cada Grupo; os 2 primeiros vão às Semifinais e os `caem` últimos caem. */
  grupos?: { grupo: Grupo; tabela: { time: TimeId; jogos: number; pontos: number; vitorias: number; saldo: number }[] }[];
  /** Tabela da Série B, quando existe. */
  tabelaB?: { time: TimeId; jogos: number; pontos: number; vitorias: number; saldo: number }[];
  novosContratados: { username: string; time: TimeId; posicao: Posicao }[];
  totalNovos: number;
  /**
   * `numero`: o número interno do Candidato (ADR-0011); `rotulo`: o que se comenta para votar
   * ("3", ou "A3" e "B3" com duas Séries); `serie`: a Série do Candidato (ADR-0017).
   */
  candidatos: { numero?: number; rotulo?: string; serie?: Serie; username: string; apelido?: string | null; time: TimeId; posicao: Posicao; nota: number; gols: number }[];
  /**
   * Resumo das Semifinais (ADR-0048): o jogo da Final de cada Série, já marcado para o dia
   * seguinte. Ganha a cartela "A Final".
   */
  final?: { mandante: TimeId; visitante: TimeId; hora: number; serie?: Serie }[];
  /** Resumo da Final: o Time campeão ganha uma cartela própria. */
  campeao?: TimeId;
  /** Campeão da Série B, quando existe. */
  campeaoB?: TimeId;
  /** Na Final os Candidatos são da Temporada inteira (nota = nota média). */
  votacao?: 'RODADA' | 'TEMPORADA';
  /**
   * Resumo da Temporada (o dia seguinte à Final): campeão, Craque eleito, artilheiro, melhor
   * goleiro e quando começa a próxima. Junto com `craqueDaTemporada`.
   */
  fimDaTemporada?: {
    artilheiro?: { username: string; apelido?: string | null; time: TimeId; posicao: Posicao; gols: number };
    goleiro?: { username: string; time: TimeId; notaMedia: number };
    proxima?: { numero: number; inicio: string };
    /** Créditos (ADR-0108): os @ de quem apoiou a Liga na Temporada, sem valor. */
    apoiadores?: string[];
  };
  /** Anúncio do Craque da Temporada (o dia seguinte à Final): só essa cartela e a chamada. */
  craqueDaTemporada?: { username: string; apelido?: string | null; time: TimeId; posicao: Posicao; notaMedia: number; gols: number; jogos: number; votos: number };
  /** Craque da Temporada da Série B, quando há (ADR-0017): ganha a sua cartela depois do da A. */
  craqueDaTemporadaB?: { username: string; apelido?: string | null; time: TimeId; posicao: Posicao; notaMedia: number; gols: number; jogos: number; votos: number };
  /** Craque da Rodada anterior: a votação fechou no Corte do primeiro jogo e o anúncio abre o Resumo. */
  craqueDaRodada?: { rodada: number; fase: 'LIGA' | 'MATA_MATA'; username: string; apelido?: string | null; time: TimeId; posicao: Posicao; nota: number; gols: number; votos: number };
  /** Craque da Rodada anterior na Série B, quando há (ADR-0017). */
  craqueDaRodadaB?: { rodada: number; fase: 'LIGA' | 'MATA_MATA'; username: string; apelido?: string | null; time: TimeId; posicao: Posicao; nota: number; gols: number; votos: number };
  /**
   * Seleção da Rodada (ADR-0041), da T2 em diante: Muralha, Carrapato, Garçom e Matador,
   * um por Posição em cada Série. No Resumo da Temporada (`fimDaTemporada`), é a Seleção da Temporada.
   */
  destaques?: { posicao: Posicao; serie?: Serie; username: string; time: TimeId; nota: number; numero: { valor: number; legenda: string } }[];
  /**
   * Chances da reta final (ADR-0099): da metade da Fase de Liga até a penúltima Rodada, a
   * chance de cada Time ir às Semifinais e de cair, um bloco por Grupo (ou por Série), na ordem
   * da tabela. Ganha a cartela "Chances", logo depois da tabela.
   */
  chances?: { grupo?: Grupo; serie?: Serie; classificam: number; caem: number; times: ChancesDoTime[] }[];
  /** Resumo da última Rodada da Fase de Liga: a cartela das Chances vira "Fim da Fase de Liga", só com selos. */
  fimDaFaseDeLiga?: boolean;
  /** Aparências escolhidas pelos donos (ADR-0013), pelo @. */
  aparencias?: Record<string, Aparencia>;
  /** Itens equipados agora pelos donos (ADR-0101), pelo @. */
  itens?: Record<string, ItensEquipados>;
  /** Estrelas de Título nos escudos (ADR-0060). */
  estrelas?: Partial<Record<TimeId, Estrelas>>;
}

export type Cartela = 'ABERTURA' | 'PLACARES' | 'FINALISTAS' | 'CAMPEAO' | 'TABELA' | 'CHANCES' | 'NOVOS' | 'CANDIDATOS' | 'CRAQUE' | 'DESTAQUES' | 'POSICOES' | 'APOIADORES' | 'CHAMADA' | 'COMPARTILHE';

/**
 * Segmento do Roteiro com a cartela que ele mostra (tipo 'ABERTURA' = trilha cheia na mixagem).
 * `serie`: com Série B, placares, tabela e Candidatos ganham uma cartela por Série (ADR-0017).
 */
export type SegmentoResumo = Segmento & { cartela: Cartela; serie?: Serie };

/** Cartelas que se repetem por Série quando a Temporada tem Série B. */
const POR_SERIE: ReadonlySet<Cartela> = new Set(['PLACARES', 'TABELA', 'POSICOES', 'CANDIDATOS']);

/** Com Série B, os dados de uma cartela são só os da Série dela. */
export function dadosDaSerie(d: DadosDoResumo, serie: Serie | undefined): Pick<DadosDoResumo, 'placares' | 'tabela' | 'candidatos' | 'destaques'> {
  if (!serie) return d;
  return {
    destaques: (d.destaques ?? []).filter((x) => (x.serie ?? 'A') === serie),
    placares: d.placares.filter((p) => (p.serie ?? 'A') === serie),
    tabela: serie === 'B' ? (d.tabelaB ?? []) : d.tabela,
    candidatos: d.candidatos.filter((c) => (c.serie ?? 'A') === serie),
  };
}

const DURACAO_BASE: Record<Cartela, number> = { ABERTURA: 3, PLACARES: 5, FINALISTAS: 5, CAMPEAO: 6, TABELA: 6, CHANCES: 7, NOVOS: 4, CANDIDATOS: 7, CRAQUE: 7, DESTAQUES: 6, POSICOES: 7, APOIADORES: 6, CHAMADA: 5, COMPARTILHE: 6 };
const CORTE = 0.3;

export class RoteiroResumo {
  readonly segmentos: SegmentoResumo[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDoResumo,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    const cartelas: Cartela[] = ['ABERTURA'];
    if (dados.craqueDaTemporada || dados.fimDaTemporada) {
      // Resumo da Temporada: campeão, Craque eleito, artilheiro e goleiro.
      if (dados.fimDaTemporada && dados.campeao) cartelas.push('CAMPEAO');
      if (dados.craqueDaTemporada) cartelas.push('CRAQUE');
      if (dados.fimDaTemporada?.artilheiro || dados.fimDaTemporada?.goleiro) cartelas.push('DESTAQUES');
      if (dados.fimDaTemporada && dados.destaques?.length) cartelas.push('POSICOES');
      if (dados.fimDaTemporada?.apoiadores?.length) cartelas.push('APOIADORES');
    }
    else {
      if (dados.craqueDaRodada || dados.craqueDaRodadaB) cartelas.push('CRAQUE');
      if (dados.placares.length) cartelas.push('PLACARES');
      if (dados.final?.length) cartelas.push('FINALISTAS');
      if (dados.campeao) cartelas.push('CAMPEAO');
      if (dados.fase === 'LIGA') cartelas.push('TABELA');
      if (dados.fase === 'LIGA' && dados.chances?.length) cartelas.push('CHANCES');
      if (dados.totalNovos > 0) cartelas.push('NOVOS');
      if (dados.destaques?.length) cartelas.push('POSICOES');
      if (dados.candidatos.length) cartelas.push('CANDIDATOS');
    }
    cartelas.push('CHAMADA', 'COMPARTILHE');
    // Com Série B: cada cartela por Série vira duas, a da A e a da B (se a B tiver o que mostrar).
    const comSeries = !!dados.tabelaB || !!dados.destaques?.some((x) => x.serie === 'B');
    const lista: { cartela: Cartela; serie?: Serie }[] = cartelas.flatMap((cartela) => {
      if (!comSeries || !POR_SERIE.has(cartela)) return [{ cartela }];
      return (['A', 'B'] as const).filter((serie) => {
        const x = dadosDaSerie(dados, serie);
        return cartela === 'PLACARES' ? x.placares.length > 0 : cartela === 'TABELA' ? x.tabela.length > 0 : cartela === 'POSICOES' ? (x.destaques?.length ?? 0) > 0 : x.candidatos.length > 0;
      }).map((serie) => ({ cartela, serie }));
    });
    // Campeão e Craque da Temporada: com Série B, uma cartela para cada Série.
    const dupla = (cartela: Cartela, temB: boolean) => {
      const k = lista.findIndex((x) => x.cartela === cartela);
      if (k >= 0 && temB) lista.splice(k, 1, { cartela, serie: 'A' }, { cartela, serie: 'B' });
    };
    dupla('CAMPEAO', !!dados.campeaoB);
    dupla('CRAQUE', !!(dados.craqueDaTemporadaB || (dados.craqueDaRodada && dados.craqueDaRodadaB)));
    // Só a B tem Craque da Rodada (a A ficou sem Candidatos): a cartela é da B.
    if (!dados.craqueDaRodada && dados.craqueDaRodadaB && !dados.craqueDaTemporada) {
      const k = lista.findIndex((x) => x.cartela === 'CRAQUE');
      if (k >= 0) lista[k] = { cartela: 'CRAQUE', serie: 'B' };
    }
    let cursor = 0;
    this.segmentos = lista.map(({ cartela, serie }, i) => {
      const inicio = cursor;
      cursor += Math.max(DURACAO_BASE[cartela], minimos[i]?.antes ?? 0);
      return { tipo: 'ABERTURA', cartela, inicio, fim: cursor, ...(serie ? { serie } : {}) };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoResumo; indice: number; progresso: number; tempo: number; escurecer: number } {
    const t = Math.min(Math.max(tBruto, 0), this.duracao - 1e-9);
    const indice = Math.max(0, this.segmentos.findIndex((s) => t < s.fim));
    const segmento = this.segmentos[indice]!;
    const tempo = t - segmento.inicio;
    const progresso = tempo / (segmento.fim - segmento.inicio);
    const meio = CORTE / 2;
    const entrada = indice === 0 ? 1 : Math.min(1, tempo / meio);
    const saida = indice === this.segmentos.length - 1 ? 1 : Math.min(1, (segmento.fim - t) / meio);
    return { segmento, indice, progresso, tempo, escurecer: 1 - Math.min(entrada, saida) };
  }
}

// ---------------------------------------------------------------- narração

const POSICAO_FALADA: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };
const curto = (t: TimeId) => FALA_DO_TIME[t].curto;
/** "da Rodada 3", "das Semifinais". */
const daRodada = (r: { fase: 'LIGA' | 'MATA_MATA'; rodada: number }) => {
  const n = nomeDaRodada(r.fase, r.rodada);
  return n.startsWith('Rodada') ? `da ${n}` : n === 'Semifinais' ? 'das Semifinais' : `da ${n}`;
};

export function narracaoDoResumo(roteiro: RoteiroResumo): Fala[] {
  const d = roteiro.dados;
  const falas: Fala[] = [];
  roteiro.segmentos.forEach((s, i) => {
    let texto = '';
    // Com Série B, a fala de placares, tabela e Candidatos é só da Série da cartela.
    const x = dadosDaSerie(d, s.serie);
    const naSerie = s.serie ? `Na Série ${s.serie}, ` : '';
    switch (s.cartela) {
      case 'ABERTURA':
        texto = d.fimDaTemporada
          ? `Acabou a Temporada ${d.temporada} do Varzeão da Mata! Bora pro resumo!`
          : d.craqueDaTemporada
          ? `Chegou a hora! Quem é o Craque da Temporada ${d.temporada} do Varzeão da Mata?`
          : d.campeao
            ? 'Acabou a Final do Varzeão da Mata!'
            : d.final?.length
              ? 'Fim das Semifinais no Varzeão da Mata! Bora pro resumo!'
              : d.fase === 'LIGA'
              ? `Fim da Rodada ${d.rodada} no Varzeão da Mata! Bora pro resumo!`
              : 'Fim do dia de mata-mata no Varzeão da Mata!';
        break;
      case 'FINALISTAS': {
        const jogos = d.final ?? [];
        const confronto = (j: (typeof jogos)[number]) => `${curto(j.mandante)} contra ${curto(j.visitante)}`;
        const quando = `Amanhã, às ${jogos[0]!.hora} horas, no Varzeão!`;
        texto = jogos.length > 1
          ? `Tá definida a Final! Na Série A, ${confronto(jogos.find((j) => j.serie !== 'B') ?? jogos[0]!)}. Na Série B, ${confronto(jogos.find((j) => j.serie === 'B') ?? jogos[1]!)}. ${quando}`
          : `Tá definida a Final: ${confronto(jogos[0]!)}! ${quando}`;
        break;
      }
      case 'CAMPEAO': {
        const t = s.serie === 'B' ? d.campeaoB! : d.campeao!;
        texto = s.serie === 'B'
          ? `Na Série B, ${artigo(t)} ${curto(t)} é campeão! ${FALA_DO_TIME[t].bordao}`
          : `${artigo(t, true)} ${curto(t)} é campeão da Temporada ${d.temporada}! ${FALA_DO_TIME[t].bordao}`;
        break;
      }
      case 'CRAQUE': {
        const t = s.serie === 'B' ? d.craqueDaTemporadaB : d.craqueDaTemporada;
        const naSerieDoCraque = s.serie ? `Na Série ${s.serie}: ` : '';
        if (!t) {
          const c = (s.serie === 'B' ? d.craqueDaRodadaB : d.craqueDaRodada)!;
          const quem = apelidoFalavel(c.apelido) ? `${apelidoFalavel(c.apelido)}, ${POSICAO_FALADA[c.posicao]} ${doTime(c.time)}` : `o ${POSICAO_FALADA[c.posicao]} ${doTime(c.time)}`;
          texto = naSerieDoCraque + (c.votos > 0
            ? `O Craque ${daRodada(c)}, eleito pela torcida com ${c.votos} ${c.votos === 1 ? 'voto' : 'votos'}, é ${quem}!`
            : `Ninguém votou, então o Craque ${daRodada(c)} ficou com a maior nota: ${quem}!`);
          break;
        }
        texto = `${naSerieDoCraque}Com ${t.votos} ${t.votos === 1 ? 'voto' : 'votos'} da torcida, o Craque da Temporada é ${apelidoFalavel(t.apelido) ? `${apelidoFalavel(t.apelido)}, ${POSICAO_FALADA[t.posicao]} ${doTime(t.time)}` : `o ${POSICAO_FALADA[t.posicao]} ${doTime(t.time)}`}! Nota média ${t.notaMedia.toFixed(1).replace('.', ',')}.`;
        break;
      }
      case 'DESTAQUES': {
        const f = d.fimDaTemporada!;
        const partes: string[] = [];
        if (f.artilheiro) partes.push(`O artilheiro foi ${apelidoFalavel(f.artilheiro.apelido) ?? `o ${POSICAO_FALADA[f.artilheiro.posicao]} ${doTime(f.artilheiro.time)}`}, com ${f.artilheiro.gols} ${f.artilheiro.gols === 1 ? 'gol' : 'gols'}.`);
        if (f.goleiro) partes.push(`E o melhor goleiro foi o ${doTime(f.goleiro.time)}, nota média ${f.goleiro.notaMedia.toFixed(1).replace('.', ',')}.`);
        texto = partes.join(' ');
        break;
      }
      case 'POSICOES': {
        // Pela Posição e pelo Time, nunca pelo @ (o apelido fica para gols e Craque).
        const quem = (x.destaques ?? []).map((j) => `${DESTAQUE_DA_POSICAO[j.posicao]}: o ${POSICAO_FALADA[j.posicao]} ${doTime(j.time)}`);
        texto = `${s.serie ? `Na Série ${s.serie}, a` : 'A'} Seleção ${d.fimDaTemporada ? 'da Temporada' : 'da Rodada'}, a maior nota de cada posição! ${quem.join('. ')}.`;
        break;
      }
      case 'APOIADORES': {
        // O Narrador agradece sem falar @ nem valor: os nomes estão na tela.
        const n = d.fimDaTemporada!.apoiadores!.length;
        texto = `Valeu ${n === 1 ? 'a quem apoiou' : `aos ${n} apoiadores que bancaram`} o Varzeão nessa Temporada! Quer apoiar também? O link está na bio.`;
        break;
      }
      case 'PLACARES':
        texto =
          naSerie +
          x.placares
            .map((p) => {
              const [a, b, ga, gb] = p.golsMandante >= p.golsVisitante ? [p.mandante, p.visitante, p.golsMandante, p.golsVisitante] : [p.visitante, p.mandante, p.golsVisitante, p.golsMandante];
              if (ga === gb) return p.penaltis ? `${curto(a)} e ${curto(b)} empataram, e a decisão foi nos pênaltis` : `${curto(a)} e ${curto(b)} empataram em ${ga} a ${gb}`;
              return `${curto(a)} venceu ${artigo(b)} ${curto(b)} por ${ga} a ${gb}`;
            })
            .join('. ') + '.';
        break;
      case 'TABELA': {
        if (!s.serie && d.grupos?.length) {
          // Com Grupos (ADR-0064): quem lidera cada um.
          texto = d.grupos
            .map((g) => {
              const g1 = g.tabela[0]!;
              const naPonta = g.tabela.filter((l) => l.pontos === g1.pontos).map((l) => curto(l.time));
              const no = NOME_DO_GRUPO[g.grupo].replace(/^Grupo d/, 'No Grupo d');
              if (naPonta.length === g.tabela.length) return `${no}, tudo igual.`;
              if (naPonta.length > 1) return `${no}, ${naPonta.slice(0, -1).join(', ')} e ${naPonta.at(-1)} dividem a ponta com ${g1.pontos} pontos.`;
              return `${no}, ${artigo(g1.time)} ${curto(g1.time)} lidera com ${g1.pontos} ${g1.pontos === 1 ? 'ponto' : 'pontos'}.`;
            })
            .join(' ');
          break;
        }
        const l1 = x.tabela[0]!;
        const ponta = x.tabela.filter((l) => l.pontos === l1.pontos).map((l) => curto(l.time));
        const lista = ponta.length > 1 ? `${ponta.slice(0, -1).join(', ')} e ${ponta[ponta.length - 1]}` : '';
        const naTabela = s.serie ? `Na tabela da Série ${s.serie}` : 'Na tabela';
        texto =
          ponta.length === x.tabela.length
            ? `${naTabela}, tudo igual: todo mundo com ${l1.pontos} ${l1.pontos === 1 ? 'ponto' : 'pontos'}.`
            : ponta.length > 1
              ? `${naTabela}, ${lista} dividem a ponta com ${l1.pontos} pontos.`
              : `${naTabela}, ${artigo(l1.time)} ${curto(l1.time)} lidera com ${l1.pontos} ${l1.pontos === 1 ? 'ponto' : 'pontos'}.`;
        break;
      }
      case 'CHANCES':
        texto = d.fimDaFaseDeLiga ? falaDoFimDaFaseDeLiga(d.chances ?? []) : falaDasChances(d.chances ?? []);
        break;
      case 'NOVOS':
        texto = d.totalNovos === 1 ? 'Chegou um novo contratado na Liga. Seja bem-vindo!' : `Chegaram ${d.totalNovos} novos contratados na Liga. Sejam bem-vindos!`;
        break;
      case 'CANDIDATOS': {
        const [melhor] = x.candidatos;
        texto = `${s.serie ? `Na Série ${s.serie}, esses` : 'Esses'} são os candidatos a Craque ${d.votacao === 'TEMPORADA' ? 'da Temporada, os melhores do campeonato' : 'da Rodada'}.${melhor ? ` A maior nota foi ${apelidoFalavel(melhor.apelido) ? `de ${apelidoFalavel(melhor.apelido)}` : `do ${POSICAO_FALADA[melhor.posicao]} ${doTime(melhor.time)}`}.` : ''}`;
        break;
      }
      case 'CHAMADA':
        texto = d.fimDaTemporada?.proxima
          ? `A Temporada ${d.fimDaTemporada.proxima.numero} começa ${diaFalado(d.fimDaTemporada.proxima.inicio)}. Quer jogar? Comente ENTRO, o time e a posição!`
          : d.candidatos.length
          ? `Vote no seu Craque${d.votacao === 'TEMPORADA' ? ' da Temporada' : ''} ${d.tabelaB ? 'de cada série comentando a letra e o número, como A3 ou B3' : 'comentando só o número dele'}, ou pelo site.${d.votacao === 'TEMPORADA' ? ' O resultado sai amanhã às sete da noite!' : ''}`
          : 'A próxima Temporada vem aí. Quer jogar? Comente ENTRO, o time e a posição!';
        break;
      case 'COMPARTILHE':
        texto = 'Curtiu? Compartilha com a galera e chama mais gente pro Varzeão! Pra entrar, é só comentar ENTRO, o time e a posição.';
        break;
    }
    falas.push({ id: `resumo-${i}`, texto, inicio: s.inicio + 0.35, limite: s.fim, tom: s.cartela === 'ABERTURA' ? 'animado' : 'normal', segmento: i, parte: 'antes' });
  });
  return falas;
}

/** Nome de um bloco das Chances na fala: "No Grupo do Barro", "Na Série A", ou nada. */
function noBloco(b: NonNullable<DadosDoResumo['chances']>[number], varios: boolean): string {
  if (b.grupo) return NOME_DO_GRUPO[b.grupo].replace(/^Grupo d/, 'No Grupo d');
  return varios && b.serie ? `Na Série ${b.serie}` : '';
}

/** "67", "menos de 1", "mais de 99" (o "por cento" vai só no último número da lista). */
function numeroFalado(p: number): string {
  const x = porcentagem(p);
  return x === '<1%' ? 'menos de 1' : x === '>99%' ? 'mais de 99' : x.slice(0, -1);
}

/** "a Arara", "o Lobo-guará, com 67" ... "e a Sucuri, com 53 por cento". */
function listaComChances(itens: { time: TimeId; certo: string | null; p: number }[]): string {
  const ultimoNumero = itens.map((i) => i.certo === null).lastIndexOf(true);
  const partes = itens.map((i, k) => `${artigo(i.time)} ${curto(i.time)}, ${i.certo ?? `com ${numeroFalado(i.p)}${k === ultimoNumero ? ' por cento' : ''}`}`);
  return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')}, e ${partes.at(-1)}`;
}

/**
 * Fala da cartela das Chances (ADR-0099): só o que está na tela. Em cada bloco, todos os Times
 * com mais chance de Semifinal (tantos quantas são as vagas) e todos com mais risco de cair
 * (tantos quantos caem), com a porcentagem ou o selo, quando já é certo.
 */
export function falaDasChances(blocos: NonNullable<DadosDoResumo['chances']>): string {
  const partes = ['Hora da matemática! Simulamos os jogos que faltam.'];
  const garantido = (t: TimeId) => (FALA_DO_TIME[t].artigo === 'a' ? 'já garantida' : 'já garantido');
  for (const b of blocos) {
    const no = noBloco(b, blocos.length > 1);
    const frase: string[] = [];
    const semi = b.times
      .filter((c) => c.certezaSemifinal !== 'ELIMINADO')
      .sort((x, y) => y.semifinal - x.semifinal)
      .slice(0, b.classificam)
      .map((c) => ({ time: c.time, p: c.semifinal, certo: c.certezaSemifinal === 'GARANTIDO' ? garantido(c.time) : null }));
    if (semi.length) frase.push(`com mais chances de semifinal, ${listaComChances(semi)}`);
    if (b.caem > 0) {
      const cair = b.times
        .filter((c) => c.certezaQueda !== 'SALVO')
        .sort((x, y) => y.queda - x.queda)
        .slice(0, b.caem)
        .map((c) => ({ time: c.time, p: c.queda, certo: c.certezaQueda === 'CAIU' ? 'que já caiu' : null }));
      if (cair.length) frase.push(`com mais risco de cair, ${listaComChances(cair)}`);
    }
    if (!frase.length) continue;
    const texto = frase.join('. E ');
    partes.push(no ? `${no}, ${texto}.` : `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`);
  }
  return partes.join(' ');
}

/** "o Lobo-guará e a Capivara", "o Tamanduá, o Leão, a Sucuri e o Tatu". */
function comArtigos(ts: readonly TimeId[]): string {
  const nomes = ts.map((t) => `${artigo(t)} ${curto(t)}`);
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/**
 * Fala da cartela "Fim da Fase de Liga" (ADR-0099), no Resumo da última Rodada: em cada bloco,
 * quem foi à Semifinal e quem caiu, na ordem da tabela.
 */
export function falaDoFimDaFaseDeLiga(blocos: NonNullable<DadosDoResumo['chances']>): string {
  const partes = ['Fim da Fase de Liga! A conta fechou.'];
  for (const b of blocos) {
    const no = noBloco(b, blocos.length > 1);
    const frase: string[] = [];
    const semi = b.times.filter((c) => c.certezaSemifinal === 'GARANTIDO').map((c) => c.time);
    const caem = b.times.filter((c) => c.certezaQueda === 'CAIU').map((c) => c.time);
    if (semi.length) frase.push(`na semifinal, ${comArtigos(semi)}`);
    if (caem.length) frase.push(`${caem.length > 1 ? 'caem' : 'cai'} para a Série B ${comArtigos(caem)}`);
    if (!frase.length) continue;
    const texto = frase.join('. E ');
    partes.push(no ? `${no}, ${texto}.` : `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`);
  }
  return partes.join(' ');
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "no domingo, dia 8" / "na segunda, dia 16". */
function diaFalado(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dia = DIAS_DA_SEMANA[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!;
  return `${dia === 'sábado' || dia === 'domingo' ? 'no' : 'na'} ${dia}, dia ${d}`;
}

/** "08/11". */
function diaCurto(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "a" / "o" (ou "A" / "O" no começo da frase). */
function artigo(t: TimeId, maiuscula = false): string {
  const a = FALA_DO_TIME[t].artigo;
  return maiuscula ? a.toUpperCase() : a;
}

// ---------------------------------------------------------------- desenho

export interface OpcoesResumo {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

export function desenharQuadroResumo(ctx: CanvasRenderingContext2D, roteiro: RoteiroResumo, tVideo: number, o: OpcoesResumo = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);

  // Entrada escalonada dos itens: o item k aparece em `aparece(k)` segundos.
  const aparece = (k: number, passo = 0.35, atraso = 0.5) => entre(q.tempo, atraso + k * passo, atraso + k * passo + 0.35);
  const serie = q.segmento.serie;
  const ds = dadosDaSerie(d, serie);
  const titulo = (t: string) => {
    pin.tabua(COLUNAS / 2 - 90, 34, 180, 34);
    pin.texto(t, COLUNAS / 2, 51, pin.caber(t, 160, 24, display), display, COR.amarelo, { contorno: COR.contorno });
    // Plaquinha da Série pendurada embaixo do título (ADR-0017).
    if (serie) {
      pin.placa(COLUNAS / 2 - 34, 64, 68, 20, { fundo: serie === 'A' ? COR.amarelo : COR.placa, sombra: COR.contorno, degrau: 2 });
      pin.texto(`Série ${serie}`, COLUNAS / 2, 74, 15, display, COR.tinta);
    }
  };

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 150 - (1 - entre(q.tempo, 0, 0.6)) * 12, 120);
      pin.ctx.globalAlpha = entre(q.tempo, 0.3, 0.8);
      const [linha1, linha2] = d.fimDaTemporada ? ['Resumo da', `Temporada ${d.temporada}`] : d.craqueDaTemporada ? ['O Craque da', 'Temporada'] : ['Resumo da', nomeDaRodada(d.fase, d.rodada)];
      pin.texto(linha1, COLUNAS / 2, 245, 26, display, COR.placa, { contorno: COR.mata });
      pin.texto(linha2, COLUNAS / 2, 280, pin.caber(linha2, 230, 48, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      if (!d.fimDaTemporada) pin.texto(`Temporada ${d.temporada}`, COLUNAS / 2, 314, 10, texto, COR.placa, { peso: 600 });
      pin.ctx.globalAlpha = 1;
      break;
    }
    case 'PLACARES': {
      titulo('Placares');
      // Até 4 jogos, um por placa grande; com 8 (a Série A com 16 Times, ADR-0058), placas compactas.
      const compacto = ds.placares.length > 4;
      const alto = compacto ? 44 : 86;
      ds.placares.forEach((p, k) => {
        const a = aparece(k, compacto ? 0.22 : 0.35);
        if (a <= 0) return;
        const y = (compacto ? 90 : 92) + k * alto;
        const dx = (1 - a) * -COLUNAS;
        pin.ctx.save();
        pin.ctx.translate(dx * pin.px, 0);
        if (compacto) {
          pin.tabua(14, y, 242, alto - 4);
          pin.texto(`${p.hora}h`, 30, y + 20, 8, texto, COR.placaSombra, { peso: 600 });
          desenharEscudo(pin, p.mandante, 44, y + 7, 1.1);
          desenharEscudo(pin, p.visitante, 204, y + 7, 1.1);
          pin.texto(IDENTIDADE[p.mandante].sigla, 92, y + 21, 15, display, COR.placa);
          pin.texto(IDENTIDADE[p.visitante].sigla, 178, y + 21, 15, display, COR.placa);
          // Placas do placar simétricas em torno do centro, com o "x" no meio delas.
          plaquinha(pin, COLUNAS / 2 - 18, y + 8, 18, 24, String(p.golsMandante), display);
          plaquinha(pin, COLUNAS / 2 + 18, y + 8, 18, 24, String(p.golsVisitante), display);
          pin.texto('x', COLUNAS / 2, y + 20, 10, display, COR.placa);
          if (p.penaltis) pin.texto(`pên. ${p.penaltis.mandante} x ${p.penaltis.visitante}`, COLUNAS / 2, y + 36, 6, texto, COR.amarelo, { peso: 600 });
          pin.ctx.restore();
          return;
        }
        pin.tabua(16, y, 238, 70);
        pin.texto(`${p.hora}h`, COLUNAS / 2, y + 12, 8, texto, COR.placaSombra, { peso: 600 });
        desenharEscudo(pin, p.mandante, 24, y + 20, 1.6);
        desenharEscudo(pin, p.visitante, 214, y + 20, 1.6);
        pin.texto(IDENTIDADE[p.mandante].sigla, 78, y + 40, 18, display, COR.placa);
        pin.texto(IDENTIDADE[p.visitante].sigla, 192, y + 40, 18, display, COR.placa);
        plaquinha(pin, 113, y + 24, 22, 28, String(p.golsMandante), display);
        plaquinha(pin, 157, y + 24, 22, 28, String(p.golsVisitante), display);
        pin.texto('x', COLUNAS / 2, y + 39, 12, display, COR.placa);
        if (p.penaltis) pin.texto(`pênaltis ${p.penaltis.mandante} x ${p.penaltis.visitante}`, COLUNAS / 2, y + 62, 7, texto, COR.amarelo, { peso: 600 });
        pin.ctx.restore();
      });
      break;
    }
    case 'TABELA': {
      titulo('Tabela');
      const x = 14;
      const w = 242;
      pin.tabua(x, 84, w, 360);
      if (!serie && d.grupos?.length) {
        // Dois Grupos de 8 (ADR-0064): um bloco por Grupo, com o nome e o cabeçalho.
        const caemNoGrupo = d.caem ?? 0;
        d.grupos.forEach((g, n) => {
          const topo = 92 + n * 176;
          pin.texto(NOME_DO_GRUPO[g.grupo], x + 12, topo + 8, 13, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          for (const [rotulo, cx] of [['P', 180], ['J', 204], ['V', 224], ['SG', 244]] as const) pin.texto(rotulo, cx, topo + 8, 9, texto, COR.placaSombra, { peso: 700 });
          g.tabela.forEach((l, k) => {
            const a = aparece(n * g.tabela.length + k, 0.09, 0.4);
            if (a <= 0) return;
            const y = topo + 26 + k * 19;
            pin.ctx.globalAlpha = a;
            const lider = k === 0;
            const caindo = caemNoGrupo > 0 && k >= g.tabela.length - caemNoGrupo;
            const classifica = k < CLASSIFICAM_POR_GRUPO;
            pin.placa(x + 6, y - 6, w - 12, 17, { fundo: lider ? COR.amarelo : caindo ? '#7A2A22' : classifica ? '#3E5A2E' : COR.madeiraEscura, sombra: lider ? '#C99500' : COR.contorno, degrau: 1 });
            const cor = lider ? COR.tinta : COR.placa;
            pin.texto(`${k + 1}`, x + 17, y + 3, 10, display, cor);
            desenharEscudo(pin, l.time, x + 28, y - 4, 0.56);
            pin.texto(curto(l.time), x + 46, y + 3, pin.caber(curto(l.time), 110, 10, display), display, cor, { alinhar: 'left' });
            pin.texto(String(l.pontos), 180, y + 3, 11, display, cor);
            pin.texto(String(l.jogos), 204, y + 3, 9, display, cor);
            pin.texto(String(l.vitorias), 224, y + 3, 9, display, cor);
            pin.texto(l.saldo > 0 ? `+${l.saldo}` : String(l.saldo), 244, y + 3, 9, display, cor);
            pin.ctx.globalAlpha = 1;
          });
        });
        pin.ctx.globalAlpha = aparece(2 * 8, 0.09, 0.4);
        const regra = `2 primeiros: semifinal · ${caemNoGrupo} últimos: Série B`;
        pin.texto(regra, COLUNAS / 2, 458, pin.caber(regra, 236, 10, texto, 600), texto, COR.placa, { peso: 600 });
        pin.ctx.globalAlpha = 1;
        break;
      }
      const cab = 100;
      for (const [rotulo, cx] of [['P', 180], ['J', 204], ['V', 224], ['SG', 244]] as const) pin.texto(rotulo, cx, cab, 9, texto, COR.placaSombra, { peso: 700 });
      // Até 8 Times, uma placa de 40 por linha; com 16 (Série A, ADR-0058), linhas de 21.
      const compacta = ds.tabela.length > 8;
      // Zona de queda: os 2 últimos da A com Série B (ADR-0017).
      const caem = serie === 'B' ? 0 : (d.caem ?? (serie === 'A' ? TIMES_QUE_TROCAM_DE_SERIE : 0));
      const linha = compacta ? 21 : 40;
      ds.tabela.forEach((l, k) => {
        const a = aparece(k, compacta ? 0.09 : 0.18, 0.4);
        if (a <= 0) return;
        const y = 112 + k * linha;
        if (compacta) {
          pin.ctx.globalAlpha = a;
          const lider = k === 0;
          const caindo = caem > 0 && k >= ds.tabela.length - caem;
          const classifica = k < 4;
          pin.placa(x + 6, y - 6, w - 12, 19, { fundo: lider ? COR.amarelo : caindo ? '#7A2A22' : classifica ? '#3E5A2E' : COR.madeiraEscura, sombra: lider ? '#C99500' : COR.contorno, degrau: 1 });
          const cor = lider ? COR.tinta : COR.placa;
          pin.texto(`${k + 1}`, x + 17, y + 4, 11, display, cor);
          desenharEscudo(pin, l.time, x + 28, y - 4, 0.62);
          pin.texto(curto(l.time), x + 46, y + 4, pin.caber(curto(l.time), 110, 11, display), display, cor, { alinhar: 'left' });
          pin.texto(String(l.pontos), 180, y + 4, 12, display, cor);
          pin.texto(String(l.jogos), 204, y + 4, 10, display, cor);
          pin.texto(String(l.vitorias), 224, y + 4, 10, display, cor);
          pin.texto(l.saldo > 0 ? `+${l.saldo}` : String(l.saldo), 244, y + 4, 10, display, cor);
          pin.ctx.globalAlpha = 1;
          return;
        }
        pin.ctx.globalAlpha = a;
        const lider = k === 0;
        const caindo = caem > 0 && k >= ds.tabela.length - caem;
        pin.placa(x + 6, y, w - 12, 34, { fundo: lider ? COR.amarelo : caindo ? '#7A2A22' : COR.madeiraEscura, sombra: lider ? '#C99500' : COR.contorno, degrau: 2 });
        const cor = lider ? COR.tinta : COR.placa;
        pin.texto(`${k + 1}`, x + 18, y + 18, 16, display, cor);
        desenharEscudo(pin, l.time, x + 30, y + 5, 1);
        pin.texto(curto(l.time), x + 56, y + 18, pin.caber(curto(l.time), 100, 16, display), display, cor, { alinhar: 'left' });
        pin.texto(String(l.pontos), 180, y + 18, 18, display, cor);
        pin.texto(String(l.jogos), 204, y + 18, 14, display, cor);
        pin.texto(String(l.vitorias), 224, y + 18, 14, display, cor);
        pin.texto(l.saldo > 0 ? `+${l.saldo}` : String(l.saldo), 244, y + 18, 14, display, cor);
        pin.ctx.globalAlpha = 1;
      });
      if (serie) {
        pin.ctx.globalAlpha = aparece(ds.tabela.length, compacta ? 0.09 : 0.18, 0.4);
        const regra = serie === 'A' ? 'Os 2 últimos caem para a Série B' : 'Os 2 finalistas do mata-mata sobem';
        pin.texto(regra, COLUNAS / 2, 458, pin.caber(regra, 236, 10, texto, 600), texto, COR.placa, { peso: 600 });
        pin.ctx.globalAlpha = 1;
      }
      break;
    }
    case 'CHANCES': {
      titulo(d.fimDaFaseDeLiga ? 'Fim da Fase de Liga' : 'Chances');
      const blocos = d.chances ?? [];
      const x = 14;
      const w = 242;
      pin.tabua(x, 84, w, 360);
      const linhasPorBloco = Math.max(...blocos.map((b) => b.times.length), 1);
      // Até 2 blocos de 8 (os Grupos da T2, ou A e B): 19 por linha; um bloco só, linhas maiores.
      const passo = blocos.length > 1 ? 19 : Math.min(36, Math.floor(320 / linhasPorBloco));
      const temQueda = blocos.some((b) => b.caem > 0);
      const colSemi = temQueda ? 184 : 222;
      const colQueda = 226;
      let item = 0;
      blocos.forEach((b, n) => {
        const topo = 92 + n * 176;
        const nome = b.grupo ? NOME_DO_GRUPO[b.grupo] : b.serie ? `Série ${b.serie}` : 'Tabela';
        pin.texto(nome, x + 12, topo + 8, 13, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
        pin.texto('Semi', colSemi, topo + 8, 9, texto, COR.placaSombra, { peso: 700 });
        if (b.caem > 0) pin.texto('Cai', colQueda, topo + 8, 9, texto, COR.placaSombra, { peso: 700 });
        b.times.forEach((c, k) => {
          const a = aparece(item++, 0.09, 0.4);
          if (a <= 0) return;
          const y = topo + 26 + k * passo;
          pin.ctx.globalAlpha = a;
          pin.placa(x + 6, y - 6, w - 12, passo - 2, { fundo: COR.madeiraEscura, sombra: COR.contorno, degrau: 1 });
          pin.texto(`${k + 1}`, x + 17, y + 3, 10, display, COR.placa);
          desenharEscudo(pin, c.time, x + 28, y - 4, 0.56);
          pin.texto(curto(c.time), x + 46, y + 3, pin.caber(curto(c.time), 100, 10, display), display, COR.placa, { alinhar: 'left' });
          celulaDaChance(pin, colSemi, y, textoDaSemifinal(c), c.semifinal, c.certezaSemifinal === 'GARANTIDO' ? 'bom' : c.certezaSemifinal === 'ELIMINADO' ? 'apagado' : null, '#4E8A3A', display);
          if (b.caem > 0) celulaDaChance(pin, colQueda, y, textoDaQueda(c), c.queda, c.certezaQueda === 'CAIU' ? 'ruim' : c.certezaQueda === 'SALVO' ? 'bom' : null, '#A33A2C', display);
          pin.ctx.globalAlpha = 1;
        });
      });
      pin.ctx.globalAlpha = aparece(item, 0.09, 0.4);
      const vagas = blocos[0]?.classificam ?? 0;
      const caemNoBloco = blocos.find((b) => b.caem > 0)?.caem ?? 0;
      const regra = d.fimDaFaseDeLiga
        ? `${vagas} primeiros: semifinal${caemNoBloco ? ` · ${caemNoBloco} últimos: Série B` : ''}`
        : 'Jogos que faltam simulados 20 mil vezes, todos com chances iguais';
      pin.texto(regra, COLUNAS / 2, 458, pin.caber(regra, 236, 9, texto, 600), texto, COR.placa, { peso: 600 });
      pin.ctx.globalAlpha = 1;
      break;
    }
    case 'NOVOS': {
      titulo('Novos Contratados');
      pin.texto(d.totalNovos === 1 ? '1 jogador chegou à Liga' : `${d.totalNovos} jogadores chegaram à Liga`, COLUNAS / 2, 84, 10, texto, COR.placa, { peso: 600 });
      d.novosContratados.forEach((n, k) => {
        const a = aparece(k, 0.12, 0.4);
        if (a <= 0) return;
        const col = k % 2;
        const lin = Math.floor(k / 2);
        const x = 14 + col * 124;
        const y = 100 + lin * 46;
        pin.ctx.globalAlpha = a;
        pin.placa(x, y, 118, 38, { fundo: COR.madeira, luz: COR.madeiraLuz, sombra: COR.madeiraEscura, degrau: 2 });
        desenharEscudo(pin, n.time, x + 5, y + 7, 1);
        const nome = `@${n.username}`;
        pin.texto(nome, x + 30, y + 14, pin.caber(nome, 84, 8, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
        pin.texto(`${POSICAO_FALADA[n.posicao]}, ${curto(n.time)}`, x + 30, y + 27, 6.5, texto, COR.placaSombra, { alinhar: 'left', peso: 500 });
        pin.ctx.globalAlpha = 1;
      });
      if (d.totalNovos > d.novosContratados.length) {
        pin.texto(`e mais ${d.totalNovos - d.novosContratados.length}!`, COLUNAS / 2, 100 + Math.ceil(d.novosContratados.length / 2) * 46 + 10, 16, display, COR.amarelo, { contorno: COR.contorno });
      }
      break;
    }
    case 'CANDIDATOS': {
      titulo(d.votacao === 'TEMPORADA' ? 'Craque da Temporada?' : 'Candidatos a Craque');
      const fase = Math.floor(tVideo * 3);
      ds.candidatos.forEach((c, k) => {
        const a = aparece(k, 0.45, 0.5);
        if (a <= 0) return;
        const y = 84 + k * 72;
        const dx = (1 - a) * COLUNAS;
        const id = IDENTIDADE[c.time];
        pin.ctx.save();
        pin.ctx.translate(dx * pin.px, 0);
        pin.tabua(12, y, 246, 64);
        // Figurinha: fundo claro, boneco do Jogador, escudo no canto.
        pin.placa(18, y + 6, 46, 52, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.r(21, y + 42, 40, 13, '#7FB069');
        const goleiro = c.posicao === 'GOL';
        const visual = {
          camisa: goleiro ? id.secundaria : id.primaria,
          detalhe: goleiro ? id.primaria : id.secundaria,
          calcao: goleiro ? '#2B2B2B' : id.secundaria,
          meiao: goleiro ? id.secundaria : id.primaria,
          ...aparencia(`@${c.username}`),
          ...itensDe(`@${c.username}`, goleiro),
        };
        const pose = k === 0 && fase % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        pin.ctx.drawImage(sprite(pose, visual), 23 * pin.px, (y + 8) * pin.px, 36 * pin.px, 48 * pin.px);
        desenharEscudo(pin, c.time, 50, y + 4, 0.7);
        const nome = c.apelido || `@${c.username}`;
        pin.texto(nome, 72, y + 20, pin.caber(nome, 128, 11, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
        const info = `${POSICAO_FALADA[c.posicao]}, ${curto(c.time)}${c.gols ? `, ${c.gols} gol${c.gols > 1 ? 's' : ''}` : ''}`;
        pin.texto(info, 72, y + 38, pin.caber(info, 128, 7.5, texto, 500), texto, COR.placaSombra, { alinhar: 'left', peso: 500 });
        plaquinha(pin, 228, y + 14, 34, 30, c.nota.toFixed(1), display);
        // Número do voto, grande, no canto da figurinha: é o que se comenta ("3", ou "A3"/"B3").
        const voto = c.rotulo ?? String(c.numero ?? k + 1);
        const larguraVoto = voto.length > 1 ? 34 : 24;
        pin.placa(8, y - 2, larguraVoto, 26, { fundo: COR.amarelo, luz: '#FFE07A', sombra: '#B88600' });
        pin.texto(voto, 8 + larguraVoto / 2, y + 12, pin.caber(voto, larguraVoto - 6, 22, display), display, COR.tinta);
        if (d.votacao === 'TEMPORADA' && k === 0) pin.texto('média', 245, y + 52, 6, texto, COR.placaSombra, { peso: 600 });
        pin.ctx.restore();
        // a cor do Time numa faixinha embaixo do card
        pin.r(12 + dx + 4, y + 61, 238, 2, contraste(id.primaria) === '#FFFFFF' ? id.primaria : id.secundaria);
      });
      break;
    }
    case 'FINALISTAS': {
      // A Final de cada Série: os dois escudos frente a frente e o horário (ADR-0048).
      const jogos = d.final ?? [];
      titulo('A Final');
      const alto = jogos.length > 1 ? 150 : 190;
      jogos.forEach((j, k) => {
        const a = aparece(k, 0.6, 0.4);
        if (a <= 0) return;
        const y = (jogos.length > 1 ? 96 : 120) + k * (alto + 16);
        pin.ctx.save();
        pin.ctx.globalAlpha = a;
        pin.tabua(16, y, 238, alto);
        if (j.serie && jogos.length > 1) {
          pin.placa(COLUNAS / 2 - 30, y + 6, 60, 18, { fundo: j.serie === 'A' ? COR.amarelo : COR.placa, sombra: COR.contorno, degrau: 2 });
          pin.texto(`Série ${j.serie}`, COLUNAS / 2, y + 15, 13, display, COR.tinta);
        }
        const escala = jogos.length > 1 ? 3 : 4;
        const topo = y + (jogos.length > 1 ? 32 : 26) - (1 - a) * 12;
        const larg = 20 * escala;
        desenharEscudo(pin, j.mandante, 70 - larg / 2, topo, escala);
        desenharEscudo(pin, j.visitante, 200 - larg / 2, topo, escala);
        pin.texto('x', COLUNAS / 2, topo + 12 * escala, 26, display, COR.amarelo, { contorno: COR.contorno });
        const yNome = topo + 24 * escala + 14;
        pin.texto(curto(j.mandante), 70, yNome, pin.caber(curto(j.mandante), 110, 18, display), display, COR.placa);
        pin.texto(curto(j.visitante), 200, yNome, pin.caber(curto(j.visitante), 110, 18, display), display, COR.placa);
        pin.texto(`Amanhã, ${j.hora}h`, COLUNAS / 2, y + alto - 12, 10, texto, COR.amarelo, { peso: 700 });
        pin.ctx.restore();
      });
      break;
    }
    case 'CAMPEAO': {
      const t = serie === 'B' ? d.campeaoB! : d.campeao!;
      const id = IDENTIDADE[t];
      const a = entre(q.tempo, 0.2, 0.9);
      // Confete nas cores do Time, caindo devagar (determinístico pelo tempo).
      for (let k = 0; k < 60; k++) {
        const x = (k * 97) % COLUNAS;
        const y = ((k * 53 + q.tempo * (30 + (k % 5) * 8)) % (LINHAS + 20)) - 10;
        pin.r(x, y, 3, 3, k % 3 === 0 ? COR.amarelo : k % 3 === 1 ? id.primaria : id.secundaria);
      }
      pin.ctx.globalAlpha = a;
      pin.texto('Campeão!', COLUNAS / 2, 96, 44, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      if (serie) pin.texto(`Série ${serie}`, COLUNAS / 2, 60, 16, display, COR.placa, { contorno: COR.contorno });
      desenharEscudo(pin, t, COLUNAS / 2 - 50, 130 - (1 - a) * 20, 5, { estrelas: false }); // o título fica logo acima
      pin.texto(curto(t), COLUNAS / 2, 280, pin.caber(curto(t), 220, 40, display), display, COR.placa, { contorno: COR.contorno });
      pin.texto(`Temporada ${d.temporada}`, COLUNAS / 2, 312, 11, texto, COR.placa, { peso: 600 });
      pin.ctx.globalAlpha = entre(q.tempo, 1.2, 1.8);
      pin.tabua(30, 340, 210, 44);
      pin.texto(`“${FALA_DO_TIME[t].bordao}”`, COLUNAS / 2, 362, pin.caber(`“${FALA_DO_TIME[t].bordao}”`, 190, 12, texto, 600), texto, COR.placa, { peso: 600 });
      pin.ctx.globalAlpha = 1;
      break;
    }
    case 'CRAQUE': {
      const t = serie === 'B' ? d.craqueDaTemporadaB : d.craqueDaTemporada;
      const r = serie === 'B' ? d.craqueDaRodadaB : d.craqueDaRodada;
      const c = (t ?? r)!;
      const id = IDENTIDADE[c.time];
      const a = entre(q.tempo, 0.3, 1.1);
      // Figurinha grande do eleito sobre a grama.
      pin.ctx.globalAlpha = a;
      pin.placa(55, 70, 160, 196, { fundo: id.primaria, sombra: COR.contorno });
      pin.placa(63, 92, 144, 120, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
      pin.r(66, 176, 138, 33, '#7FB069');
      const visual = {
        camisa: c.posicao === 'GOL' ? id.secundaria : id.primaria,
        detalhe: c.posicao === 'GOL' ? id.primaria : id.secundaria,
        calcao: c.posicao === 'GOL' ? '#2B2B2B' : id.secundaria,
        meiao: c.posicao === 'GOL' ? id.secundaria : id.primaria,
        ...aparencia(`@${c.username}`),
        ...itensDe(`@${c.username}`, c.posicao === 'GOL'),
      };
      const pose = Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
      pin.ctx.drawImage(sprite(pose, visual), 105 * pin.px, (100 - (1 - a) * 10) * pin.px, 60 * pin.px, 80 * pin.px);
      desenharEscudo(pin, c.time, 182, 74, 1);
      const cor = contraste(id.primaria);
      pin.texto(t ? 'Craque da Temporada' : `Craque ${daRodada(r!)}`, COLUNAS / 2, 82, 9, texto, cor, { peso: 700 });
      if (serie) pin.texto(`Série ${serie}`, COLUNAS / 2, 58, 16, display, COR.placa, { contorno: COR.contorno });
      const nome = c.apelido || `@${c.username}`;
      pin.texto(nome, COLUNAS / 2, 232, pin.caber(nome, 150, 18, display), display, cor);
      pin.texto(`${POSICAO_FALADA[c.posicao]}, ${curto(c.time)}`, COLUNAS / 2, 252, 8, texto, cor, { peso: 600 });
      pin.ctx.globalAlpha = entre(q.tempo, 1.4, 2.0);
      const numeros: [string, string][] = t
        ? [
            ['jogos', String(t.jogos)],
            ['gols', String(t.gols)],
            ['média', t.notaMedia.toFixed(1)],
            ['votos', String(t.votos)],
          ]
        : [
            ['gols', String(r!.gols)],
            ['nota', r!.nota.toFixed(1)],
            ['votos', String(r!.votos)],
          ];
      const x0 = (COLUNAS - (numeros.length * 58 - 6)) / 2;
      numeros.forEach(([rotulo, valor], k) => {
        const x = x0 + k * 58;
        pin.tabua(x, 290, 52, 56);
        pin.texto(valor, x + 26, 314, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto(rotulo, x + 26, 336, 7, texto, COR.placa, { peso: 600 });
      });
      pin.ctx.globalAlpha = 1;
      break;
    }
    case 'DESTAQUES': {
      titulo('Destaques');
      const f = d.fimDaTemporada!;
      const cartao = (k: number, rotulo: string, j: { username: string; time: TimeId; posicao: Posicao }, valor: string, legenda: string) => {
        const a = aparece(k, 0.8, 0.4);
        if (a <= 0) return;
        const y = 92 + k * 170;
        const id = IDENTIDADE[j.time];
        pin.ctx.save();
        pin.ctx.globalAlpha = a;
        pin.ctx.translate(0, (1 - a) * 12 * pin.px);
        pin.tabua(14, y, 242, 156);
        pin.texto(rotulo, COLUNAS / 2, y + 16, 18, display, COR.amarelo, { contorno: COR.contorno });
        pin.placa(26, y + 30, 92, 112, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.r(29, y + 112, 86, 27, '#7FB069');
        const goleiro = j.posicao === 'GOL';
        const visual = {
          camisa: goleiro ? id.secundaria : id.primaria,
          detalhe: goleiro ? id.primaria : id.secundaria,
          calcao: goleiro ? '#2B2B2B' : id.secundaria,
          meiao: goleiro ? id.secundaria : id.primaria,
          ...aparencia(`@${j.username}`),
          ...itensDe(`@${j.username}`, goleiro),
        };
        const pose = Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        pin.ctx.drawImage(sprite(pose, visual), 48 * pin.px, (y + 38) * pin.px, 48 * pin.px, 64 * pin.px);
        desenharEscudo(pin, j.time, 98, y + 32, 0.8);
        const nome = `@${j.username}`;
        pin.texto(nome, 186, y + 58, pin.caber(nome, 124, 14, display), display, '#FFFFFF', { contorno: COR.contorno });
        pin.texto(`${POSICAO_FALADA[j.posicao]}, ${curto(j.time)}`, 186, y + 76, 8, texto, COR.placaSombra, { peso: 600 });
        pin.texto(valor, 186, y + 108, 34, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto(legenda, 186, y + 132, 8, texto, COR.placa, { peso: 600 });
        pin.ctx.restore();
      };
      let k = 0;
      if (f.artilheiro) cartao(k++, 'Artilheiro', f.artilheiro, String(f.artilheiro.gols), f.artilheiro.gols === 1 ? 'gol' : 'gols');
      if (f.goleiro) cartao(k++, 'Melhor goleiro', { ...f.goleiro, posicao: 'GOL' }, f.goleiro.notaMedia.toFixed(1).replace('.', ','), 'nota média');
      break;
    }
    case 'APOIADORES': {
      // Créditos (ADR-0108): os @ em duas colunas, como os créditos de um filme, sem valor.
      titulo('Apoiadores');
      const nomes = d.fimDaTemporada!.apoiadores!;
      const porColuna = Math.ceil(Math.min(nomes.length, 36) / (nomes.length > 12 ? 2 : 1));
      const colunas = nomes.length > 12 ? [COLUNAS / 2 - 62, COLUNAS / 2 + 62] : [COLUNAS / 2];
      const largura = nomes.length > 12 ? 118 : 220;
      const passo = Math.min(22, 300 / Math.max(porColuna, 1));
      // A tábua cresce com a lista e fica centrada entre o título e o rodapé.
      const altura = 46 + porColuna * passo;
      const topo = Math.round(92 + (330 - altura) / 2);
      pin.tabua(14, topo, 242, altura);
      pin.texto('Obrigado por bancar a Liga!', COLUNAS / 2, topo + 18, 9, texto, COR.placa, { peso: 600 });
      nomes.slice(0, 36).forEach((u, k) => {
        const a = aparece(k, 0.08, 0.4);
        if (a <= 0) return;
        const x = colunas[Math.floor(k / porColuna)]!;
        const y = topo + 42 + (k % porColuna) * passo;
        pin.ctx.globalAlpha = a;
        const nome = `@${u}`;
        pin.texto(nome, x, y, pin.caber(nome, largura, 11, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      pin.ctx.globalAlpha = 1;
      if (nomes.length > 36) pin.texto(`e mais ${nomes.length - 36}`, COLUNAS / 2, topo + altura - 8, 9, texto, COR.amarelo, { peso: 600 });
      pin.texto('Apoie também: link na bio', COLUNAS / 2, 440, 11, display, COR.amarelo, { contorno: COR.contorno });
      break;
    }
    case 'POSICOES': {
      titulo(d.fimDaTemporada ? 'Seleção da Temporada' : 'Seleção da Rodada');
      const fase = Math.floor(tVideo * 3);
      (ds.destaques ?? []).forEach((j, k) => {
        const a = aparece(k, 0.5, 0.5);
        if (a <= 0) return;
        const y = 88 + k * 86;
        const dx = (1 - a) * COLUNAS;
        const id = IDENTIDADE[j.time];
        pin.ctx.save();
        pin.ctx.translate(dx * pin.px, 0);
        pin.tabua(12, y, 246, 78);
        // Nome do Destaque em cima, como uma faixa.
        pin.placa(18, y - 6, 92, 20, { fundo: COR.amarelo, luz: '#FFE07A', sombra: '#B88600' });
        pin.texto(DESTAQUE_DA_POSICAO[j.posicao], 64, y + 4, pin.caber(DESTAQUE_DA_POSICAO[j.posicao], 84, 15, display), display, COR.tinta);
        pin.placa(18, y + 16, 46, 56, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.r(21, y + 56, 40, 13, '#7FB069');
        const goleiro = j.posicao === 'GOL';
        const visual = {
          camisa: goleiro ? id.secundaria : id.primaria,
          detalhe: goleiro ? id.primaria : id.secundaria,
          calcao: goleiro ? '#2B2B2B' : id.secundaria,
          meiao: goleiro ? id.secundaria : id.primaria,
          ...aparencia(`@${j.username}`),
          ...itensDe(`@${j.username}`, goleiro),
        };
        const pose = (fase + k) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        pin.ctx.drawImage(sprite(pose, visual), 23 * pin.px, (y + 19) * pin.px, 36 * pin.px, 48 * pin.px);
        desenharEscudo(pin, j.time, 50, y + 14, 0.7);
        const nome = `@${j.username}`;
        pin.texto(nome, 72, y + 31, pin.caber(nome, 112, 11, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
        const info = `${POSICAO_FALADA[j.posicao]}, ${curto(j.time)}`;
        pin.texto(info, 72, y + 46, pin.caber(info, 112, 7.5, texto, 500), texto, COR.placaSombra, { alinhar: 'left', peso: 500 });
        const nota = `nota ${j.nota.toFixed(1).replace('.', ',')}${d.fimDaTemporada ? ' média' : ''}`;
        pin.texto(nota, 72, y + 61, 7.5, texto, COR.placa, { alinhar: 'left', peso: 600 });
        // O número da Posição, grande, à direita.
        pin.texto(String(j.numero.valor), 222, y + 37, 30, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto(j.numero.legenda, 222, y + 60, pin.caber(j.numero.legenda, 66, 8, texto, 600), texto, COR.placa, { peso: 600 });
        pin.ctx.restore();
        pin.r(12 + dx + 4, y + 75, 238, 2, contraste(id.primaria) === '#FFFFFF' ? id.primaria : id.secundaria);
      });
      break;
    }
    case 'COMPARTILHE':
      desenharCompartilhe(pin, q.tempo, tVideo, o);
      break;
    case 'CHAMADA': {
      const proxima = d.fimDaTemporada?.proxima;
      if (proxima) {
        pin.ctx.globalAlpha = entre(q.tempo, 0.1, 0.5);
        pin.tabua(22, 110, 226, 116);
        pin.texto(`Temporada ${proxima.numero}`, COLUNAS / 2, 134, 24, display, COR.placa, { contorno: COR.contorno });
        pin.texto('começa', COLUNAS / 2, 160, 10, texto, COR.placa, { peso: 600 });
        pin.texto(diaCurto(proxima.inicio), COLUNAS / 2, 196, 40, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.ctx.globalAlpha = entre(q.tempo, 0.6, 1.0);
        pin.tabua(22, 240, 226, 96);
        pin.texto('Quer jogar? Comente', COLUNAS / 2, 260, 10, texto, COR.placa, { peso: 600 });
        pin.texto('ENTRO + time + posição', COLUNAS / 2, 286, pin.caber('ENTRO + time + posição', 200, 26, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('Ex.: ENTRO CAPIVARA ATA', COLUNAS / 2, 312, 7, texto, COR.placaSombra, { peso: 500 });
        if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 400, 70);
        pin.ctx.globalAlpha = 1;
        break;
      }
      if (!d.candidatos.length) {
        pin.ctx.globalAlpha = entre(q.tempo, 0.1, 0.5);
        pin.tabua(22, 150, 226, 120);
        pin.texto('A próxima Temporada', COLUNAS / 2, 172, 14, display, COR.placa, { contorno: COR.contorno });
        pin.texto('vem aí. Quer jogar?', COLUNAS / 2, 192, 14, display, COR.placa, { contorno: COR.contorno });
        pin.texto('ENTRO + time + posição', COLUNAS / 2, 228, pin.caber('ENTRO + time + posição', 200, 26, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('Ex.: ENTRO CAPIVARA ATA', COLUNAS / 2, 254, 7, texto, COR.placaSombra, { peso: 500 });
        if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 360, 80);
        pin.ctx.globalAlpha = 1;
        break;
      }
      pin.ctx.globalAlpha = entre(q.tempo, 0.1, 0.5);
      // Só o voto: entrar na Liga e compartilhar ficam na tela seguinte (COMPARTILHE).
      pin.tabua(22, 160, 226, 120);
      const chamada = d.votacao === 'TEMPORADA' ? 'Craque da Temporada' : 'Vote no Craque';
      pin.texto(chamada, COLUNAS / 2, 184, pin.caber(chamada, 200, 22, display), display, COR.amarelo, { contorno: COR.contorno });
      const porSerie = !!d.tabelaB;
      pin.texto(porSerie ? 'comente a letra e o número' : 'comente só o número', COLUNAS / 2, 208, 10, texto, COR.placa, { peso: 600 });
      const da = (s: Serie) => d.candidatos.filter((c) => (c.serie ?? 'A') === s).length;
      const exemplo = porSerie ? [da('A') ? `A1 a A${da('A')}` : '', da('B') ? `B1 a B${da('B')}` : ''].filter(Boolean).join(' · ') : `1 a ${d.candidatos.length}`;
      pin.texto(exemplo, COLUNAS / 2, 240, pin.caber(exemplo, 200, 34, display), display, '#FFFFFF', { contorno: COR.contorno });
      pin.texto('ou vote no site, link na bio', COLUNAS / 2, 266, 8, texto, COR.placaSombra, { peso: 500 });
      pin.ctx.globalAlpha = 1;
      break;
    }
  }

  if (q.escurecer > 0) {
    ctx.save();
    ctx.globalAlpha = q.escurecer;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
}

const SELO: Record<'bom' | 'ruim' | 'apagado', { fundo: string; tinta: string }> = {
  bom: { fundo: '#3E5A2E', tinta: COR.placa },
  ruim: { fundo: '#7A2A22', tinta: COR.placa },
  apagado: { fundo: '#3A2A1E', tinta: COR.placaSombra },
};

/**
 * Uma célula da cartela das Chances: o selo, quando é certo, ou a porcentagem sobre uma
 * barrinha da cor da coluna (verde na Semifinal, vermelha na Queda), do tamanho da chance.
 */
function celulaDaChance(pin: Pincel, cx: number, y: number, rotulo: string, p: number, selo: 'bom' | 'ruim' | 'apagado' | null, cor: string, display: string): void {
  const largura = 38;
  if (selo) {
    pin.placa(cx - largura / 2, y - 4, largura, 13, { fundo: SELO[selo].fundo, sombra: COR.contorno, degrau: 1 });
    pin.texto(rotulo, cx, y + 3, pin.caber(rotulo, largura - 4, 9, display), display, SELO[selo].tinta);
    return;
  }
  pin.ctx.fillStyle = COR.contorno;
  pin.ctx.fillRect((cx - largura / 2) * pin.px, (y - 4) * pin.px, largura * pin.px, 13 * pin.px);
  pin.ctx.fillStyle = cor;
  pin.ctx.fillRect((cx - largura / 2) * pin.px, (y - 4) * pin.px, Math.max(1, Math.round(largura * p)) * pin.px, 13 * pin.px);
  pin.texto(rotulo, cx, y + 3, 10, display, COR.placa, { contorno: COR.contorno });
}
