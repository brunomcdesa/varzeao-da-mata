/**
 * Reels de Abertura de uma Temporada nova (a partir da T2): anuncia as Séries, o Acesso e o
 * Rebaixamento, avisa que as novidades saem em Reels próprios e chama para a Inscrição. Na T2
 * (ADR-0062) só há a Série A de 16: o Reels conta que os 8 piores caem e formam a Série B da T3.
 * Mesmo estilo e mesmos ajudantes do Reels de apresentação da Liga (apresentacao.ts).
 */
import { FALA_DO_TIME, GRUPOS_DA_A_DE_16, IDENTIDADE, MOEDAS, NOME_DO_GRUPO, OITAVAS_DE_CLASSICO, TIMES_FUNDADORES, TIMES_NOVOS, type Estrelas, type Posicao, type TimeId } from '@liga/shared';
import { boneco, dataDa, entre, horaFalada, lista, NUMERO_FALADO, POSICAO_ESCRITA, POSICAO_FALADA, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, plaquinha } from './desenho.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';
import { desenharEstrelaSolta } from './escudos.js';

export interface DadosDaAberturaDaTemporada {
  temporada: number;
  /** Estrelas de Título nos escudos (ADR-0060). */
  estrelas?: Partial<Record<TimeId, Estrelas>>;
  /** Dia da Rodada 1, AAAA-MM-DD. */
  estreia: string;
  /** A Série B antes da A (ADR-0050); com 16 Times, a A tem dois jogos em cada horário (ADR-0058). */
  horarios: { B: number[]; A: number[] };
  jogosPorHorarioDaA: number;
  /** Rodadas da Fase de Liga: a A em turno único, a B em turno e returno (ADR-0058). */
  rodadas: { A: number; B: number };
  horaDoResumo: number;
  serieA: readonly TimeId[];
  /** Os Times da A que chegam nesta Temporada (ADR-0058). */
  chegamNaA: readonly TimeId[];
  serieB: readonly TimeId[];
  /**
   * Quantos Times da A caem no fim da Temporada quando ela só tem a Série A de 16 (T2, ADR-0062):
   * os 8 piores formam a Série B da Temporada seguinte. 0 quando a Temporada já tem Série B.
   */
  caem: number;
  /**
   * Grupos da Série A de 16 (T2, ADR-0064): turno único dentro de cada um, os 2 primeiros vão às
   * Semifinais (cruzadas) e os `caem` últimos de cada Grupo formam a Série B da Temporada seguinte.
   */
  grupos: { nome: string; times: readonly TimeId[] }[];
  /** Limite por Posição de cada Time da A (o dobro das vagas): cheia, o novato vai para outro Time. */
  limiteNaA: { goleiros: number; porPosicao: number };
  /** Hora (no mesmo dia do post) do Reels que conta quem vai para a Série B; null se não houver. */
  horaDoRebalanceamento: number | null;
  exemplo: { time: TimeId; posicao: Posicao; username: string };
  /**
   * T3 em diante (ADR-0088): a Copa abre a Temporada, com as duas Séries de 8 formadas no fim da
   * anterior. `estreia` passa a ser o 1º dia da Copa; a Rodada 1 da Fase de Liga é `estreiaDaLiga`.
   */
  copa?: { oitavas: readonly (readonly [TimeId, TimeId])[]; estreiaDaLiga: string; moedas: number };
  /** Quando saem os Reels de cada novidade ("Amanhã", "Hoje"). Padrão: amanhã. */
  quandoSaemAsNovidades?: 'Hoje' | 'Amanhã';
}

export const DADOS_DA_ABERTURA_T2: Omit<DadosDaAberturaDaTemporada, 'estreia'> = {
  temporada: 2,
  // T2 só com a Série A de 16, em dois Grupos de 8 (ADR-0062 e ADR-0064): um jogo por hora, das
  // 11h às 18h, 7 Rodadas.
  horarios: { B: [], A: [11, 12, 13, 14, 15, 16, 17, 18] },
  jogosPorHorarioDaA: 1,
  rodadas: { A: 7, B: 0 },
  horaDoResumo: 19,
  serieA: [...TIMES_FUNDADORES, ...TIMES_NOVOS],
  chegamNaA: TIMES_NOVOS,
  serieB: [],
  caem: 4,
  grupos: (['CHAO', 'COPA'] as const).map((g) => ({ nome: NOME_DO_GRUPO[g], times: GRUPOS_DA_A_DE_16[g] })),
  limiteNaA: { goleiros: 2, porPosicao: 4 },
  // O Rebalanceamento sai antes da Abertura, junto com o Agradecimento: sem aviso aqui.
  horaDoRebalanceamento: null,
  exemplo: { time: 'JAC', posicao: 'ATA', username: 'voce' },
};

/**
 * Dados da Abertura da T3 (ADR-0088): as Séries de 8 saem do fim da T2 (o worker lê do banco),
 * a Copa abre a Temporada e a Fase de Liga começa depois dos dias dela.
 */
export function dadosDaAberturaT3(o: { serieA: readonly TimeId[]; serieB: readonly TimeId[]; estreia: string; estreiaDaLiga: string; estrelas?: Partial<Record<TimeId, Estrelas>>; quandoSaemAsNovidades?: 'Hoje' | 'Amanhã' }): DadosDaAberturaDaTemporada {
  return {
    temporada: 3,
    estreia: o.estreia,
    ...(o.estrelas ? { estrelas: o.estrelas } : {}),
    horarios: { B: [11, 12, 13, 14], A: [15, 16, 17, 18] },
    jogosPorHorarioDaA: 1,
    rodadas: { A: 7, B: 7 },
    horaDoResumo: 19,
    serieA: o.serieA,
    chegamNaA: [],
    serieB: o.serieB,
    caem: 0,
    grupos: [],
    limiteNaA: { goleiros: 2, porPosicao: 4 },
    horaDoRebalanceamento: null,
    exemplo: { time: 'CAP', posicao: 'ATA', username: 'voce' },
    copa: { oitavas: OITAVAS_DE_CLASSICO, estreiaDaLiga: o.estreiaDaLiga, moedas: MOEDAS.TITULO_COPA },
    ...(o.quandoSaemAsNovidades ? { quandoSaemAsNovidades: o.quandoSaemAsNovidades } : {}),
  };
}

export type CartelaAbertura = 'ABERTURA' | 'SERIES' | 'ACESSO' | 'COPA' | 'NOVIDADES' | 'ENTRAR' | 'AGENDA' | 'CHAMADA';
export type SegmentoAbertura = Segmento & { cartela: CartelaAbertura };

const ORDEM: CartelaAbertura[] = ['ABERTURA', 'SERIES', 'ACESSO', 'NOVIDADES', 'ENTRAR', 'AGENDA', 'CHAMADA'];
/** Da T3 em diante, a Copa entra logo depois do Sobe e desce (ADR-0088). */
const ORDEM_COM_COPA: CartelaAbertura[] = ['ABERTURA', 'SERIES', 'ACESSO', 'COPA', 'NOVIDADES', 'ENTRAR', 'AGENDA', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaAbertura, number> = { ABERTURA: 4.5, SERIES: 9, ACESSO: 6.5, COPA: 9, NOVIDADES: 8, ENTRAR: 8.5, AGENDA: 7, CHAMADA: 6 };
const CORTE = 0.3;

export class RoteiroAberturaDaTemporada {
  readonly segmentos: SegmentoAbertura[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDaAberturaDaTemporada,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    let cursor = 0;
    this.segmentos = (dados.copa ? ORDEM_COM_COPA : ORDEM).map((cartela, i) => {
      const inicio = cursor;
      cursor += Math.max(DURACAO_BASE[cartela], (minimos[i]?.antes ?? 0) + 0.6);
      return { tipo: 'ABERTURA', cartela, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoAbertura; indice: number; tempo: number; escurecer: number } {
    const t = Math.min(Math.max(tBruto, 0), this.duracao - 1e-9);
    const indice = Math.max(0, this.segmentos.findIndex((s) => t < s.fim));
    const segmento = this.segmentos[indice]!;
    const tempo = t - segmento.inicio;
    const meio = CORTE / 2;
    const entrada = indice === 0 ? 1 : Math.min(1, tempo / meio);
    const saida = indice === this.segmentos.length - 1 ? 1 : Math.min(1, (segmento.fim - t) / meio);
    return { segmento, indice, tempo, escurecer: 1 - Math.min(entrada, saida) };
  }
}

// ---------------------------------------------------------------- narração

const curto = (t: TimeId) => FALA_DO_TIME[t].curto;
/** "onze da manhã", "duas da tarde", "meio-dia". */
const horaComPeriodo = (h: number) => (h === 12 ? 'meio-dia' : h < 12 ? `${horaFalada(h, false)} da manhã` : horaFalada(h, true));
/** "das onze da manhã às duas da tarde", "do meio-dia às três da tarde". */
const faixa = (hs: number[]) => {
  const ini = hs[0]!;
  const fim = hs[hs.length - 1]!;
  const de = ini === 12 ? 'do meio-dia' : ini > 12 && fim > 12 ? `das ${horaFalada(ini, false)}` : `das ${horaComPeriodo(ini)}`;
  return `${de} às ${horaComPeriodo(fim)}`;
};

export function narracaoDaAbertura(roteiro: RoteiroAberturaDaTemporada): Fala[] {
  const d = roteiro.dados;
  const { dia, semana } = dataDa(d);
  const ex = d.exemplo;
  const n = d.temporada;
  const soA = d.serieB.length === 0;
  const limite = `${NUMERO_FALADO[d.limiteNaA.goleiros] ?? d.limiteNaA.goleiros} goleiros e ${NUMERO_FALADO[d.limiteNaA.porPosicao] ?? d.limiteNaA.porPosicao} jogadores em cada posição`;
  const quando = d.quandoSaemAsNovidades ?? 'Amanhã';
  const textoT3 = (): Record<CartelaAbertura, string> => {
    const c = d.copa!;
    const liga = dataDa({ estreia: c.estreiaDaLiga });
    const [p1, p2] = c.oitavas;
    return {
      ABERTURA: `Acabou a Temporada ${n - 1}. E já vem aí a Temporada ${n} do Varzeão da Mata!`,
      SERIES: `Agora são duas séries de oito times. Na Série A: ${lista(d.serieA.map(curto))}. E estreia a Série B, com ${lista(d.serieB.map(curto))}.`,
      ACESSO: `Em cada série, todos contra todos, em ${NUMERO_FALADO[d.rodadas.A] ?? d.rodadas.A} rodadas. Os quatro primeiros vão pra semifinal. E no fim, os dois últimos da Série A caem, e os dois finalistas da Série B sobem.`,
      COPA: `Mas antes, tem Copa! Os dezesseis times juntos, das duas séries, em mata-mata, em três dias. As oitavas são clássicos, como ${curto(p1![0])} contra ${curto(p1![1])}, e ${curto(p2![0])} contra ${curto(p2![1])}. Jogo único, com pênaltis no empate. E o campeão ganha a estrela de bronze no escudo e ${NUMERO_FALADO[c.moedas] ?? c.moedas} moedas pra cada jogador que entrou em campo.`,
      NOVIDADES: `E tem muita novidade: o técnico, dentro de campo, salário e loja, palpite e conquistas, e pro capitão. ${quando} sai um Reels explicando cada uma.`,
      ENTRAR: `Quer jogar? Comenta ENTRO, o time e a posição. Tipo: ENTRO ${curto(ex.time)} ${POSICAO_FALADA[ex.posicao]}. Vale qualquer time, da Série A ou da B. E quem já joga continua com o seu jogador.`,
      AGENDA: `A Copa começa ${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${NUMERO_FALADO[dia] ?? dia}. E a fase de liga começa ${liga.semana === 'sábado' || liga.semana === 'domingo' ? 'no' : 'na'} ${liga.semana}, dia ${NUMERO_FALADO[liga.dia] ?? liga.dia}: a Série B joga ${faixa(d.horarios.B)}, e a Série A, ${faixa(d.horarios.A)}. Um jogo por hora.`,
      CHAMADA: `As inscrições estão abertas. Comenta aí e garante a sua vaga na Temporada ${n}!`,
    };
  };
  return roteiro.segmentos.map((s, i): Fala => {
    const texto: Record<CartelaAbertura, string> = d.copa ? textoT3() : soA
      ? {
          ABERTURA: `Acabou a Temporada ${n - 1}. E já vem aí a Temporada ${n} do Varzeão da Mata!`,
          SERIES: d.grupos.length
            ? `A Série A cresce para ${NUMERO_FALADO[d.serieA.length] ?? d.serieA.length} times, em dois grupos. ${d.grupos.map((g) => `${g.nome.replace(/^Grupo d/, 'No Grupo d')}: ${lista(g.times.map(curto))}.`).join(' ')} Os clássicos ficam juntos.`
            : `A Série A cresce para ${NUMERO_FALADO[d.serieA.length] ?? d.serieA.length} times: os oito da Temporada ${n - 1}, e mais oito que chegam: ${lista(d.chegamNaA.map(curto))}.`,
          ACESSO: d.grupos.length
            ? `Cada time enfrenta os outros sete do seu grupo. Os dois primeiros de cada grupo vão pra semifinal: o primeiro de um contra o segundo do outro. E os ${NUMERO_FALADO[d.caem] ?? d.caem} últimos de cada grupo caem e formam a Série B, que estreia na Temporada ${n + 1}.`
            : `Todo mundo começa na Série A. Mas no fim desta temporada, os ${NUMERO_FALADO[d.caem] ?? d.caem} piores caem e formam a Série B, que estreia na Temporada ${n + 1}. Daí em diante, dois sobem e dois descem.`,
          NOVIDADES: 'E tem muita novidade: dentro de campo, pro capitão, pro seu jogador e no site. Amanhã sai um Reels explicando cada uma.',
          ENTRAR: `Quer jogar? Comenta ENTRO, o time e a posição. Tipo: ENTRO ${curto(ex.time)} ${POSICAO_FALADA[ex.posicao]}. Cada time recebe até ${limite}. Posição cheia, você vai para outro time. E quem já joga continua com o seu jogador.`,
          AGENDA: `A estreia é ${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${NUMERO_FALADO[dia] ?? dia}. São oito jogos por dia, um por hora, ${faixa(d.horarios.A)}. ${NUMERO_FALADO[d.rodadas.A] ?? d.rodadas.A} rodadas, depois semifinal e final.`.replace('. sete', '. Sete'),
          CHAMADA: `As inscrições estão abertas. Comenta aí e garante a sua vaga na Temporada ${n}!`,
          COPA: '',
        }
      : {
      ABERTURA: `Acabou a Temporada ${n - 1}. E já vem aí a Temporada ${n} do Varzeão da Mata!`,
      SERIES: `Agora são ${NUMERO_FALADO[d.serieA.length + d.serieB.length] ?? d.serieA.length + d.serieB.length} times, em duas séries. A Série A cresce: os oito times da Temporada ${n - 1}, e mais oito que chegam: ${lista(d.chegamNaA.map(curto))}. E estreia a Série B, com ${lista(d.serieB.map(curto))}.`,
      ACESSO: `Ninguém que jogou a Temporada ${n - 1} cai: todo mundo segue na Série A. No fim desta temporada, os dois últimos da Série A caem, e os dois finalistas da Série B sobem.`,
      NOVIDADES:
        'E tem muita novidade: dentro de campo, pro capitão, pro seu jogador e no site. Amanhã sai um Reels explicando cada uma.' +
        (d.horaDoRebalanceamento ? ` E hoje, às ${horaFalada(d.horaDoRebalanceamento, true)}: quem vai jogar a Série B.` : ''),
      ENTRAR: `Quer jogar? Comenta ENTRO, o time e a posição. Tipo: ENTRO ${curto(ex.time)} ${POSICAO_FALADA[ex.posicao]}. Cada time da Série A recebe até ${NUMERO_FALADO[d.limiteNaA.goleiros] ?? d.limiteNaA.goleiros} goleiros e ${NUMERO_FALADO[d.limiteNaA.porPosicao] ?? d.limiteNaA.porPosicao} jogadores em cada posição. Posição cheia, você vai para outro time da Série A. Só se não tiver vaga em nenhum, você começa na Série B. E quem já joga continua com o seu jogador.`,
      AGENDA: `A estreia é ${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${NUMERO_FALADO[dia] ?? dia}. A Série B joga ${faixa(d.horarios.B)}, um jogo por hora. E a Série A, ${faixa(d.horarios.A)}, com ${NUMERO_FALADO[d.jogosPorHorarioDaA] ?? d.jogosPorHorarioDaA} jogos em cada horário.`,
      CHAMADA: `As inscrições estão abertas. Comenta aí e garante a sua vaga na Temporada ${n}!`,
      COPA: '',
        };
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA' || s.cartela === 'ENTRAR' || s.cartela === 'COPA';
    return { id: `abertura-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesAbertura {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

/** Seta em pixel, para cima (subir) ou para baixo (cair). */
function seta(pin: Pincel, cx: number, y: number, paraCima: boolean, cor: string): void {
  const corpo = paraCima ? y + 10 : y;
  pin.r(cx - 3, corpo, 7, 14, COR.contorno);
  pin.r(cx - 2, corpo + 1, 5, 12, cor);
  for (let k = 0; k < 6; k++) {
    const w = 2 + k * 2;
    const yy = paraCima ? y + k * 2 : y + 22 - k * 2;
    pin.r(cx - w / 2 - 1, yy, w + 3, 2, COR.contorno);
    pin.r(cx - w / 2, yy, w + 1, 2, cor);
  }
}

export function desenharQuadroAbertura(ctx: CanvasRenderingContext2D, roteiro: RoteiroAberturaDaTemporada, tVideo: number, o: OpcoesAbertura = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const passo = Math.floor(tVideo * 4);
  // T2 só com a Série A de 16 (ADR-0062).
  const soA = d.serieB.length === 0;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);

  const titulo = (txt: string, y = 34) => {
    const a = entre(t, 0, 0.35);
    pin.ctx.globalAlpha = a;
    pin.tabua(COLUNAS / 2 - 110, y - (1 - a) * 8, 220, 34);
    pin.texto(txt, COLUNAS / 2, y + 17 - (1 - a) * 8, pin.caber(txt, 200, 24, display), display, COR.amarelo, { contorno: COR.contorno });
    pin.ctx.globalAlpha = 1;
  };
  const surge = (a: number, desenhar: () => void, dy = 10) => {
    if (a <= 0) return;
    pin.ctx.save();
    pin.ctx.globalAlpha = a;
    pin.ctx.translate(0, (1 - a) * dy * pin.px);
    desenhar();
    pin.ctx.restore();
  };
  /** Grade de escudos com o nome curto embaixo, 4 por linha. */
  const grade = (times: readonly TimeId[], y: number, inicio: number, passoT: number) => {
    times.forEach((time, k) => {
      const x = 22 + (k % 4) * 58;
      const yy = y + Math.floor(k / 4) * 58;
      surge(entre(t, inicio + k * passoT, inicio + 0.3 + k * passoT), () => {
        desenharEscudo(pin, time, x + 9, yy, 1.4);
        const nome = curto(time);
        pin.texto(nome, x + 26, yy + 44, pin.caber(nome, 54, 9, texto, 700), texto, COR.placa, { peso: 700 });
      }, 8);
    });
  };

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      const a = entre(t, 0, 0.7);
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 130 - (1 - a) * 30, 110 * (0.7 + 0.3 * a));
      surge(entre(t, 0.5, 1.0), () => {
        pin.texto('Temporada', COLUNAS / 2, 228, 34, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        const pulso = 1 + 0.05 * Math.sin(Math.max(0, t - 1) * 5);
        pin.texto(String(d.temporada), COLUNAS / 2, 290, 84 * pulso, display, COR.amarelo, { contorno: COR.contorno, espessura: 2 });
      });
      surge(entre(t, 1.2, 1.7), () => {
        pin.tabua(60, 334, 150, 30);
        pin.texto('vem aí!', COLUNAS / 2, 349, 18, display, COR.placa, { contorno: COR.contorno });
      });
      // Todos os escudos no pé da tela, 8 por fileira.
      surge(entre(t, 1.6, 2.2), () => {
        const todos = [...d.serieA, ...d.serieB];
        const y0 = todos.length > 16 ? 374 : 386;
        todos.forEach((time, k) => desenharEscudo(pin, time, 15 + (k % 8) * 31, y0 + Math.floor(k / 8) * 32, 1.1));
      });
      break;
    }
    case 'SERIES': {
      if (d.copa) {
        // T3 (ADR-0050): A e B de 8, uma tábua por Série.
        titulo('2 Séries de 8');
        ([['Série A', d.serieA, 0.3], ['Série B', d.serieB, 3.6]] as const).forEach(([nome, times, de], n) => {
          const topo = 76 + n * 172;
          surge(entre(t, de, de + 0.4), () => {
            pin.tabua(12, topo, 246, 162);
            pin.texto(nome, COLUNAS / 2, topo + 18, 20, display, COR.amarelo, { contorno: COR.contorno });
          });
          grade(times, topo + 34, de + 0.3, 0.12);
        });
        break;
      }
      if (soA && d.grupos.length) {
        // Dois Grupos de 8 (ADR-0064): uma tábua por Grupo, com os escudos em duas fileiras de 4.
        titulo(`${d.serieA.length} Times, 2 Grupos`);
        d.grupos.forEach((g, n) => {
          const topo = 76 + n * 160;
          surge(entre(t, 0.3 + n * 1.6, 0.7 + n * 1.6), () => {
            pin.tabua(12, topo, 246, 150);
            pin.texto(g.nome, COLUNAS / 2, topo + 18, 18, display, COR.amarelo, { contorno: COR.contorno });
          });
          g.times.forEach((time, k) => {
            const inicio = 0.6 + n * 1.6 + k * 0.1;
            surge(entre(t, inicio, inicio + 0.3), () => {
              const x = 22 + (k % 4) * 58;
              const y = topo + 32 + Math.floor(k / 4) * 56;
              desenharEscudo(pin, time, x + 11, y, 1.2);
              const nome = curto(time);
              pin.texto(nome, x + 26, y + 44, pin.caber(nome, 56, 8, texto, 700), texto, COR.placa, { peso: 700 });
            }, 8);
          });
        });
        surge(entre(t, 4.4, 4.8), () => {
          pin.placa(24, 400, 222, 16, { fundo: '#7FD36B', sombra: COR.contorno, degrau: 1 });
          pin.texto('Clássicos no mesmo Grupo', COLUNAS / 2, 408, pin.caber('Clássicos no mesmo Grupo', 214, 10, texto, 700), texto, COR.tinta, { peso: 700 });
        });
        break;
      }
      titulo(soA ? `${d.serieA.length} Times na Série A` : `${d.serieA.length + d.serieB.length} Times, 2 Séries`);
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(12, 78, 246, 160);
        pin.texto('Série A', COLUNAS / 2, 96, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto(`os 8 da Temporada ${d.temporada - 1} + 8 que chegam`, COLUNAS / 2, 113, 8, texto, COR.placaSombra, { peso: 600 });
      });
      // A: os 8 da Temporada anterior em cima e os que chegam embaixo, 8 por fileira.
      const veteranos = d.serieA.filter((x) => !d.chegamNaA.includes(x));
      [veteranos, d.chegamNaA].forEach((linha, l) => {
        linha.forEach((time, k) => {
          const inicio = l === 0 ? 0.6 + k * 0.08 : 1.8 + k * 0.22;
          surge(entre(t, inicio, inicio + 0.3), () => desenharEscudo(pin, time, 15 + k * 31, 124 + l * 52, 1.1), 8);
        });
      });
      if (t > 1.8) {
        pin.ctx.globalAlpha = entre(t, 1.8, 2.1);
        pin.placa(COLUNAS / 2 - 30, 156, 60, 14, { fundo: COR.placa, sombra: COR.contorno, degrau: 1 });
        pin.texto('chegam', COLUNAS / 2, 163, 9, texto, COR.tinta, { peso: 700 });
        pin.ctx.globalAlpha = 1;
      }
      if (soA) {
        // Sem Série B nesta Temporada: ela nasce na próxima, com quem cair (ADR-0062).
        surge(entre(t, 4.0, 4.4), () => {
          pin.tabua(12, 250, 246, 150);
          pin.texto('E a Série B?', COLUNAS / 2, 274, 20, display, COR.amarelo, { contorno: COR.contorno });
          pin.texto(`começa na Temporada ${d.temporada + 1}`, COLUNAS / 2, 310, pin.caber(`começa na Temporada ${d.temporada + 1}`, 226, 18, display), display, COR.placa, { contorno: COR.contorno });
          pin.texto(`com os ${d.caem} que caírem agora`, COLUNAS / 2, 338, pin.caber(`com os ${d.caem} que caírem agora`, 226, 11, texto, 700), texto, COR.placaSombra, { peso: 700 });
          const pula = Math.round(Math.sin(t * 5) * 2);
          seta(pin, COLUNAS / 2, 356 + pula, false, '#FF6B5B');
        });
        break;
      }
      surge(entre(t, 4.0, 4.4), () => {
        pin.tabua(12, 250, 246, 160);
        pin.texto('Série B', COLUNAS / 2, 268, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('8 times novos', COLUNAS / 2, 285, 8, texto, COR.placaSombra, { peso: 600 });
      });
      grade(d.serieB, 296, 4.4, 0.45);
      // Selo "novos" piscando sobre a Série B.
      if (t > 4.4) {
        const piscar = Math.floor(t * 3) % 2 === 0;
        pin.ctx.globalAlpha = entre(t, 4.4, 4.7);
        pin.placa(196, 252, 54, 18, { fundo: piscar ? COR.amarelo : '#FFE07A', luz: '#FFE07A', sombra: '#B88600' });
        pin.texto('NOVOS', 223, 261, 10, display, COR.tinta);
        pin.ctx.globalAlpha = 1;
      }
      break;
    }
    case 'ACESSO': {
      if (soA && d.grupos.length) {
        titulo('Como funciona');
        surge(entre(t, 0.2, 0.6), () => {
          pin.tabua(12, 76, 246, 64);
          pin.texto('em cada Grupo', COLUNAS / 2, 94, 12, texto, COR.placa, { peso: 700 });
          pin.texto('todos contra todos', COLUNAS / 2, 118, pin.caber('todos contra todos', 226, 18, display), display, COR.amarelo, { contorno: COR.contorno });
        });
        // Semifinais cruzadas: 1º Barro × 2º Galho, 1º Galho × 2º Barro.
        surge(entre(t, 1.4, 1.8), () => {
          pin.tabua(12, 150, 246, 118);
          pin.texto('2 primeiros: semifinal', COLUNAS / 2, 168, pin.caber('2 primeiros: semifinal', 226, 16, display), display, '#7FD36B', { contorno: COR.contorno });
          // A fonte não tem "º": líder e vice, como se fala no futebol.
          const [a, b] = d.grupos.map((g) => g.nome.replace(/^Grupo d[oa] /, ''));
          const placa = (cx: number, y: number, rotulo: string) => {
            pin.placa(cx - 46, y, 92, 26, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
            pin.texto(rotulo, cx, y + 14, pin.caber(rotulo, 84, 15, display), display, COR.tinta);
          };
          [[`Líder ${a}`, `Vice ${b}`], [`Líder ${b}`, `Vice ${a}`]].forEach(([m, v], k) => {
            const y = 186 + k * 36;
            placa(70, y, m!);
            pin.texto('x', COLUNAS / 2, y + 14, 12, display, COR.placa);
            placa(200, y, v!);
          });
        });
        surge(entre(t, 3.0, 3.4), () => {
          pin.tabua(12, 278, 246, 108);
          const cai = `${d.caem} últimos de cada Grupo`;
          pin.texto(cai, COLUNAS / 2, 296, pin.caber(cai, 226, 14, display), display, COR.placa, { contorno: COR.contorno });
          pin.texto('caem', COLUNAS / 2, 326, 26, display, '#FF6B5B', { contorno: COR.contorno, espessura: 1.5 });
          seta(pin, 210, 312 + Math.round(Math.sin(t * 5) * 2), false, '#FF6B5B');
          seta(pin, 60, 312 + Math.round(Math.sin(t * 5 + 1) * 2), false, '#FF6B5B');
          const forma = `e formam a Série B da Temporada ${d.temporada + 1}`;
          pin.texto(forma, COLUNAS / 2, 364, pin.caber(forma, 226, 11, texto, 700), texto, COR.amarelo, { peso: 700 });
        });
        surge(entre(t, 4.4, 4.8), () => {
          pin.texto('o Jogador vai junto com o Time', COLUNAS / 2, 404, pin.caber('o Jogador vai junto com o Time', 230, 11, texto, 700), texto, COR.placa, { peso: 700 });
        });
        break;
      }
      if (soA) {
        titulo('Quem cai?');
        surge(entre(t, 0.1, 0.4), () => {
          pin.placa(24, 69, 222, 12, { fundo: '#7FD36B', sombra: COR.contorno, degrau: 1 });
          const aviso = 'Todo mundo começa na Série A';
          pin.texto(aviso, COLUNAS / 2, 75, pin.caber(aviso, 214, 9, texto, 700), texto, COR.tinta, { peso: 700 });
        });
        surge(entre(t, 0.4, 0.8), () => {
          pin.tabua(12, 88, 246, 186);
          const cab = `os ${d.caem} últimos da Fase de Liga`;
          pin.texto(cab, COLUNAS / 2, 106, pin.caber(cab, 226, 12, texto, 700), texto, COR.placa, { peso: 700 });
        });
        // As posições da zona de queda (9º a 16º), duas fileiras de 4, cada uma com a seta.
        const primeira = d.serieA.length - d.caem + 1;
        for (let k = 0; k < d.caem; k++) {
          // plaquinha centrada em x; a seta logo à direita, sem encostar na próxima.
          const x = 34 + (k % 4) * 60;
          const y = 124 + Math.floor(k / 4) * 62;
          surge(entre(t, 1.0 + k * 0.15, 1.3 + k * 0.15), () => {
            plaquinha(pin, x, y, 30, 26, String(primeira + k), display);
            seta(pin, x + 24, y + 2 + Math.round(Math.sin(t * 5 + k) * 2), false, '#FF6B5B');
          }, 6);
        }
        surge(entre(t, 2.6, 3.0), () => pin.texto('caem', COLUNAS / 2, 258, 26, display, '#FF6B5B', { contorno: COR.contorno, espessura: 1.5 }));
        surge(entre(t, 3.2, 3.6), () => {
          pin.tabua(12, 286, 246, 82);
          pin.texto('e formam a Série B', COLUNAS / 2, 308, pin.caber('e formam a Série B', 226, 18, display), display, COR.amarelo, { contorno: COR.contorno });
          pin.texto(`da Temporada ${d.temporada + 1}`, COLUNAS / 2, 334, pin.caber(`da Temporada ${d.temporada + 1}`, 226, 18, display), display, COR.amarelo, { contorno: COR.contorno });
          pin.texto('o Jogador vai junto com o Time', COLUNAS / 2, 356, pin.caber('o Jogador vai junto com o Time', 226, 10, texto, 700), texto, COR.placa, { peso: 700 });
        });
        surge(entre(t, 4.6, 5.0), () => {
          pin.texto('depois: 2 sobem e 2 descem', COLUNAS / 2, 392, pin.caber('depois: 2 sobem e 2 descem', 230, 12, texto, 700), texto, COR.placa, { peso: 700 });
        });
        break;
      }
      titulo('Sobe e desce');
      // Antes de tudo: quem jogou a Temporada anterior não cai agora (ADR-0058). Na T3, o aviso
      // é o formato: todos contra todos e os 4 primeiros na semifinal.
      surge(entre(t, 0.1, 0.4), () => {
        pin.placa(24, 69, 222, 12, { fundo: '#7FD36B', sombra: COR.contorno, degrau: 1 });
        const aviso = d.copa ? 'Todos contra todos · 4 primeiros na semi' : `Ninguém da Temporada ${d.temporada - 1} cai agora`;
        pin.texto(aviso, COLUNAS / 2, 75, pin.caber(aviso, 214, 9, texto, 700), texto, COR.tinta, { peso: 700 });
      });
      const pula = (k: number) => Math.round(Math.sin(t * 5 + k) * 2);
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(12, 82, 246, 140);
        pin.texto('Série A', 70, 104, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('os 2 últimos da', 70, 128, 9, texto, COR.placa, { peso: 600 });
        pin.texto('Fase de Liga', 70, 141, 9, texto, COR.placa, { peso: 600 });
        pin.texto('caem', 70, 172, 26, display, '#FF6B5B', { contorno: COR.contorno, espessura: 1.5 });
        [String(d.serieA.length - 1), String(d.serieA.length)].forEach((pos, k) => {
          const y = 104 + k * 50;
          plaquinha(pin, 150, y, 30, 26, pos, display);
          pin.texto('lugar', 165, y + 36, 7, texto, COR.placa, { peso: 700 });
          seta(pin, 210, y + pula(k), false, '#FF6B5B');
        });
      });
      surge(entre(t, 2.4, 2.8), () => {
        pin.tabua(12, 238, 246, 140);
        pin.texto('Série B', 70, 260, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('os 2 finalistas', 70, 284, 9, texto, COR.placa, { peso: 600 });
        pin.texto('do Mata-mata', 70, 297, 9, texto, COR.placa, { peso: 600 });
        pin.texto('sobem', 70, 328, 26, display, '#7FD36B', { contorno: COR.contorno, espessura: 1.5 });
        [0, 1].forEach((k) => {
          const y = 260 + k * 50;
          plaquinha(pin, 150, y, 30, 26, '?', display);
          seta(pin, 210, y + pula(k + 2), true, '#7FD36B');
        });
      });
      surge(entre(t, 4.2, 4.6), () => {
        pin.texto('no fim desta temporada', COLUNAS / 2, 396, pin.caber('no fim desta temporada', 230, 11, texto, 700), texto, COR.placa, { peso: 700 });
        pin.texto('o Jogador vai junto com o Time', COLUNAS / 2, 412, pin.caber('o Jogador vai junto com o Time', 230, 11, texto, 700), texto, COR.placa, { peso: 700 });
      });
      break;
    }
    case 'COPA': {
      // A Copa (ADR-0088): as 8 Oitavas de Clássico, o calendário em 3 dias e o prêmio.
      titulo('Copa do Varzeão');
      const oitavas = d.copa?.oitavas ?? [];
      surge(entre(t, 0.2, 0.6), () => pin.tabua(12, 74, 246, 222));
      surge(entre(t, 0.3, 0.6), () => pin.texto('Oitavas de Clássico', COLUNAS / 2, 90, 15, display, COR.amarelo, { contorno: COR.contorno }));
      oitavas.forEach(([a, b], k) => {
        const x = 20 + (k % 2) * 118;
        const y = 102 + Math.floor(k / 2) * 46;
        const de = 0.6 + k * 0.35;
        surge(entre(t, de, de + 0.3), () => {
          desenharEscudo(pin, a, x + 6, y, 1.05);
          pin.texto('x', x + 52, y + 17, 12, display, COR.placa);
          desenharEscudo(pin, b, x + 66, y, 1.05);
        }, 6);
      });
      surge(entre(t, 4.2, 4.6), () => {
        pin.tabua(12, 304, 246, 54);
        pin.texto('3 dias · jogo único', COLUNAS / 2, 322, 15, display, COR.placa, { contorno: COR.contorno });
        pin.texto('oitavas · quartas e semis · final', COLUNAS / 2, 342, pin.caber('oitavas · quartas e semis · final', 226, 10, texto, 700), texto, COR.placaSombra, { peso: 700 });
      });
      surge(entre(t, 6.2, 6.6), () => {
        pin.tabua(12, 366, 246, 64);
        // Num quadrinho claro: o bronze some na madeira.
        pin.placa(22, 374, 38, 48, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        desenharEstrelaSolta(pin.ctx as CanvasRenderingContext2D, 'bronze', 27 * pin.px, 384 * pin.px, 4 * pin.px);
        pin.texto('Estrela de bronze', 66, 386, pin.caber('Estrela de bronze', 180, 16, display), display, '#E0A060', { alinhar: 'left', contorno: COR.contorno });
        const premio = `+ ${d.copa?.moedas ?? 40} Moedas para quem jogou`;
        pin.texto(premio, 66, 410, pin.caber(premio, 184, 11, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
      });
      break;
    }
    case 'NOVIDADES': {
      titulo('Muita novidade');
      const moeda = (x: number, y: number) => {
        pin.r(x - 11, y - 11, 22, 22, COR.contorno);
        pin.r(x - 10, y - 10, 20, 20, '#F2C230');
        pin.r(x - 10, y + 6, 20, 4, '#C9962A');
        pin.texto('$', x, y - 1, 14, display, '#8A5A12');
      };
      const celularzinho = (x: number, y: number) => {
        pin.r(x - 8, y - 13, 16, 26, COR.contorno);
        pin.r(x - 7, y - 12, 14, 22, '#8FD3FF');
        pin.r(x - 7, y + 9, 14, 1, COR.contorno);
        pin.r(x - 4, y - 8, 8, 3, COR.amarelo);
        pin.r(x - 4, y - 3, 8, 2, '#FFFFFF');
        pin.r(x - 4, y + 1, 6, 2, '#FFFFFF');
      };
      const blocosT2: [string, (x: number, y: number) => void][] = [
        ['Dentro de campo', (x, y) => {
          // cartão amarelo e apito
          pin.r(x - 9, y - 12, 14, 20, COR.contorno);
          pin.r(x - 8, y - 11, 12, 18, COR.amarelo);
          pin.r(x + 8, y + 1, 12, 7, COR.contorno);
          pin.r(x + 9, y + 2, 10, 5, '#C9C9C9');
        }],
        ['Capitão', (x, y) => {
          pin.r(x - 12, y - 8, 24, 16, COR.contorno);
          pin.r(x - 11, y - 7, 22, 14, '#1F4FD1');
          pin.texto('C', x, y, 14, display, '#FFFFFF');
        }],
        ['Seu Jogador', (x, y) => boneco(pin, (passo % 2 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO') as Pose, uniforme('ARA', 'MEI', 'novidade'), x - 9, y - 13, 1.5)],
        ['Site e App', (x, y) => {
          pin.r(x - 8, y - 13, 16, 26, COR.contorno);
          pin.r(x - 7, y - 12, 14, 22, '#8FD3FF');
          pin.r(x - 7, y + 9, 14, 1, COR.contorno);
          pin.r(x - 4, y - 8, 8, 3, COR.amarelo);
          pin.r(x - 4, y - 3, 8, 2, '#FFFFFF');
          pin.r(x - 4, y + 1, 6, 2, '#FFFFFF');
        }],
      ];
      const blocos: [string, (x: number, y: number) => void][] = d.copa
        ? [
            blocosT2[0]!,
            ['Salário e Loja', moeda],
            ['Palpite e Conquistas', celularzinho],
            ['Técnico e Capitão', blocosT2[1]![1]],
          ]
        : blocosT2;
      blocos.forEach(([nome, icone], k) => {
        const x = 14 + (k % 2) * 124;
        const y = 80 + Math.floor(k / 2) * 92;
        surge(entre(t, 0.4 + k * 0.5, 0.75 + k * 0.5), () => {
          pin.tabua(x, y, 118, 84);
          icone(x + 59, y + 30);
          pin.texto(nome, x + 59, y + 64, pin.caber(nome, 106, 15, display), display, COR.amarelo, { contorno: COR.contorno });
        }, 12);
      });
      surge(entre(t, 2.8, 3.2), () => {
        pin.tabua(14, 274, 242, 54);
        pin.texto(d.quandoSaemAsNovidades ?? 'Amanhã', COLUNAS / 2, 292, 18, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('um Reels explicando cada uma', COLUNAS / 2, 312, 9, texto, COR.placa, { peso: 700 });
      });
      if (d.horaDoRebalanceamento) {
        surge(entre(t, 4.6, 5.0), () => {
          pin.tabua(14, 340, 242, 54);
          pin.texto(`Hoje, ${d.horaDoRebalanceamento}h`, COLUNAS / 2, 358, 18, display, COR.amarelo, { contorno: COR.contorno });
          pin.texto('quem vai jogar a Série B', COLUNAS / 2, 378, 12, display, COR.placa, { contorno: COR.contorno });
        });
      }
      break;
    }
    case 'ENTRAR': {
      titulo('Como entrar');
      const ex = d.exemplo;
      const comando = `ENTRO ${curto(ex.time).toUpperCase()} ${POSICAO_ESCRITA[ex.posicao]}`;
      surge(entre(t, 0.2, 0.5), () => {
        pin.placa(14, 82, 242, 58, { fundo: '#FFFFFF', luz: '#FFFFFF', sombra: '#C9C9C9' });
        const av = IDENTIDADE[ex.time];
        pin.r(24, 94, 18, 18, av.primaria);
        pin.r(24, 94, 18, 2, COR.contorno);
        boneco(pin, 'FRENTE_PARADO', uniforme(ex.time, ex.posicao, `@${ex.username}`), 27, 93, 1);
        pin.texto(`@${ex.username}`, 50, 99, 9, texto, COR.tinta, { alinhar: 'left', peso: 700 });
        const letras = Math.floor(entre(t, 0.7, 2.4) * comando.length);
        const cursor = Math.floor(t * 3) % 2 === 0 && letras < comando.length ? '|' : '';
        pin.texto(comando.slice(0, letras) + cursor, 50, 120, pin.caber(comando, 196, 16, display), display, COR.tinta, { alinhar: 'left' });
      }, 0);
      if (d.copa) {
        surge(entre(t, 2.8, 3.2), () => {
          pin.tabua(14, 156, 242, 96);
          pin.texto('Qualquer Time', COLUNAS / 2, 176, 20, display, COR.amarelo, { contorno: COR.contorno });
          desenharEscudo(pin, d.serieA[0]!, 52, 190, 1.0);
          pin.texto('A', 96, 206, 18, display, COR.placa, { contorno: COR.contorno });
          desenharEscudo(pin, d.serieB[0]!, 156, 190, 1.0);
          pin.texto('B', 200, 206, 18, display, COR.placa, { contorno: COR.contorno });
          pin.texto('da Série A ou da Série B', COLUNAS / 2, 238, pin.caber('da Série A ou da Série B', 226, 11, texto, 700), texto, COR.placa, { peso: 700 });
        });
      }
      if (!d.copa) surge(entre(t, 2.8, 3.2), () => {
        pin.tabua(14, 156, 242, 96);
        const limite = soA ? `Cada Time: ${d.limiteNaA.goleiros} goleiros, ${d.limiteNaA.porPosicao} por posição` : `Série A: ${d.limiteNaA.goleiros} goleiros, ${d.limiteNaA.porPosicao} por posição`;
        pin.texto(limite, COLUNAS / 2, 174, pin.caber(limite, 226, 15, display), display, COR.amarelo, { contorno: COR.contorno });
        // Posição cheia no Time pedido -> outro Time da A com vaga: escudo, seta, escudo.
        desenharEscudo(pin, d.serieA[0]!, 56, 186, 1.2);
        pin.texto('cheia', 69, 222, 8, texto, '#FF6B5B', { peso: 700 });
        pin.r(98, 197, 58, 8, COR.contorno);
        pin.r(99, 198, 56, 6, '#FFB84D');
        // Ponta: triângulo cheio, contorno primeiro e o miolo por cima.
        for (let k = 0; k <= 12; k++) pin.r(152 + k, 189 + k, 1, 24 - 2 * k, COR.contorno);
        for (let k = 0; k <= 10; k++) pin.r(153 + k, 191 + k, 1, 20 - 2 * k, '#FFB84D');
        desenharEscudo(pin, d.serieA[1]!, 186, 186, 1.2);
        pin.texto(soA ? 'outro Time' : 'outro da A', 199, 222, 8, texto, COR.placa, { peso: 700 });
        const rodape = soA ? 'na mesma posição que você pediu' : 'sem vaga em nenhum? aí, Série B';
        pin.texto(rodape, COLUNAS / 2, 238, pin.caber(rodape, 226, 11, texto, 700), texto, COR.placa, { peso: 700 });
      });
      surge(entre(t, 5.0, 5.4), () => {
        pin.tabua(14, 266, 242, 140);
        pin.texto('Já joga?', COLUNAS / 2, 286, 18, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('seu Jogador continua', COLUNAS / 2, 306, 10, texto, COR.placa, { peso: 700 });
        pin.texto('com OVR e carreira', COLUNAS / 2, 320, 10, texto, COR.placa, { peso: 700 });
        const pose: Pose = Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        boneco(pin, pose, uniforme('CAP', 'ATA', 'veterano'), COLUNAS / 2 - 18, 330, 3);
        plaquinha(pin, COLUNAS / 2 + 26, 340, 28, 24, '71', display);
      });
      break;
    }
    case 'AGENDA': {
      titulo(`Temporada ${d.temporada}`);
      const { dia, mes, semana } = dataDa(d);
      if (d.copa) {
        const liga = dataDa({ estreia: d.copa.estreiaDaLiga });
        const data = (rotulo: string, x: { dia: number; mes: string; semana: string }, y: number, de: number) =>
          surge(entre(t, de, de + 0.4), () => {
            pin.tabua(22, y, 226, 70);
            pin.texto(rotulo, COLUNAS / 2, y + 18, 13, texto, COR.placa, { peso: 700 });
            const txt = `${x.semana}, ${x.dia} de ${x.mes}`;
            pin.texto(txt, COLUNAS / 2, y + 46, pin.caber(txt, 206, 24, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
          });
        data('A Copa começa', { dia, mes, semana }, 80, 0.3);
        data('A Fase de Liga começa', liga, 160, 2.0);
        surge(entre(t, 3.6, 4.0), () => {
          pin.tabua(14, 240, 242, 96);
          (['B', 'A'] as const).forEach((serie, linha) => {
            const y = 252 + linha * 38;
            pin.texto(`Série ${serie}`, 44, y + 13, 12, display, COR.amarelo, { contorno: COR.contorno });
            d.horarios[serie].forEach((h, k) => plaquinha(pin, 80 + k * 44, y, 38, 26, `${h}h`, display));
          });
        });
        surge(entre(t, 5.0, 5.4), () => {
          pin.tabua(22, 346, 226, 48);
          pin.texto(`${d.horaDoResumo}h: Resumo e votação`, COLUNAS / 2, 370, pin.caber(`${d.horaDoResumo}h: Resumo e votação`, 206, 18, display), display, COR.placa, { contorno: COR.contorno });
        });
        break;
      }
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(22, 84, 226, 100);
        pin.texto('Estreia', COLUNAS / 2, 102, 14, texto, COR.placa, { peso: 700 });
        pin.texto(`${semana}, ${dia} de ${mes}`, COLUNAS / 2, 132, pin.caber(`${semana}, ${dia} de ${mes}`, 206, 28, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('uma rodada por dia', COLUNAS / 2, 162, 10, texto, COR.placaSombra, { peso: 600 });
      });
      surge(entre(t, 1.2, 1.6), () => {
        pin.tabua(14, 196, 242, 124);
        pin.texto('Horários', COLUNAS / 2, 212, 12, texto, COR.placa, { peso: 700 });
        if (soA) {
          // Um jogo por hora, das 11h às 18h: duas fileiras de 4 placas.
          d.horarios.A.forEach((h, k) => plaquinha(pin, COLUNAS / 2 - 75 + (k % 4) * 50, 226 + Math.floor(k / 4) * 36, 42, 26, `${h}h`, display));
          pin.texto('Um jogo por hora', COLUNAS / 2, 304, 10, texto, COR.placaSombra, { peso: 700 });
          return;
        }
        (['B', 'A'] as const).forEach((serie, linha) => {
          const y = 226 + linha * 38;
          pin.texto(`Série ${serie}`, 44, y + 13, 12, display, COR.amarelo, { contorno: COR.contorno });
          d.horarios[serie].forEach((h, k) => plaquinha(pin, 80 + k * 44, y, 38, 26, `${h}h`, display));
        });
        const linhas = d.jogosPorHorarioDaA > 1 ? `B: 1 jogo por hora · A: ${d.jogosPorHorarioDaA} jogos por horário` : 'Um jogo por hora';
        pin.texto(linhas, COLUNAS / 2, 304, pin.caber(linhas, 226, 9, texto, 700), texto, COR.placaSombra, { peso: 700 });
      });
      surge(entre(t, 3.4, 3.8), () => {
        pin.tabua(22, 328, 226, 48);
        pin.texto(`${d.horaDoResumo}h: Resumo e votação`, COLUNAS / 2, 352, pin.caber(`${d.horaDoResumo}h: Resumo e votação`, 206, 18, display), display, COR.placa, { contorno: COR.contorno });
      });
      surge(entre(t, 4.0, 4.4), () => {
        pin.tabua(22, 386, 226, 52);
        const formato = soA ? (d.grupos.length ? `${d.rodadas.A} rodadas, todos do Grupo` : `${d.rodadas.A} rodadas, todos contra todos`) : `A: ${d.rodadas.A} rodadas · B: ${d.rodadas.B}, ida e volta`;
        pin.texto(formato, COLUNAS / 2, 406, pin.caber(formato, 206, 14, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('depois, semifinal e final', COLUNAS / 2, 424, 10, texto, COR.placa, { peso: 700 });
      });
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Inscrições', COLUNAS / 2, 66, 36, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      pin.texto('abertas!', COLUNAS / 2, 100, 44, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.5, 0.9), () => {
        pin.tabua(14, 130, 242, 132);
        pin.texto('Comente aqui embaixo', COLUNAS / 2, 150, 11, texto, COR.placa, { peso: 700 });
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto('ENTRO', COLUNAS / 2, 184, 34 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('+ TIME + POSIÇÃO', COLUNAS / 2, 216, pin.caber('+ TIME + POSIÇÃO', 220, 24, display), display, COR.amarelo, { contorno: COR.contorno });
        const ex = `Ex.: ENTRO ${curto(d.exemplo.time).toUpperCase()} ${POSICAO_ESCRITA[d.exemplo.posicao]}`;
        pin.texto(ex, COLUNAS / 2, 244, pin.caber(ex, 220, 9, texto, 600), texto, COR.placaSombra, { peso: 600 });
      });
      surge(entre(t, 1.2, 1.6), () => {
        pin.texto('tabela, jogadores e votação', COLUNAS / 2, 284, 10, texto, COR.placa, { peso: 600 });
        pin.texto('no site: link na bio', COLUNAS / 2, 300, 10, texto, COR.placa, { peso: 600 });
      });
      if (o.escudo) surge(entre(t, 1.6, 2.2), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 380, 96));
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
