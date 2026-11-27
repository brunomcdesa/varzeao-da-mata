/**
 * Sala do Ao Vivo (ADR-0046): um Durable Object por Partida. Conta quem está assistindo e
 * repassa as Reações, em lotes. Usa a API de hibernação do WebSocket: parada, a sala não
 * gasta duração. Quando o Ao Vivo acaba, fecha todas as conexões.
 *
 * As Reações não vão para o banco nem para o Replay: valem só enquanto a sala existe.
 * O Público também some com a sala, mas no fim ela deixa UM resumo (pico, média, entradas) no
 * KV `audiencia/<partida>`, só números agregados, sem ninguém identificável (ADR-0118).
 */
import { INTERVALO_REACAO_MS, LOTE_REACOES_MS, lerMensagemParaSala, type ContagemDeReacoes, type MensagemDaSala } from '@liga/shared';

/** Cabeçalho com que a rota da borda diz à sala quando o Ao Vivo acaba (ms desde 1970). */
export const CABECALHO_FIM = 'x-fim-ao-vivo';
/** Cabeçalho com o id da Partida, para o resumo de audiência saber onde se gravar. */
export const CABECALHO_PARTIDA = 'x-partida-ao-vivo';
/** Por quanto tempo o resumo fica no KV até a coleta levá-lo ao banco. */
export const VALIDADE_AUDIENCIA_S = 45 * 24 * 3600;
/** Fechamento normal, com o motivo que o site entende. */
export const FIM_DO_AO_VIVO = { codigo: 1000, motivo: 'fim do Ao Vivo' };

/** O que cada conexão carrega (sobrevive à hibernação). */
export interface Assento {
  id: string;
  /** Instante da última Reação aceita, para o limite de uma por segundo. */
  ultima: number;
}

/** O mínimo do WebSocket que a sala usa (o do Workers tem isso e mais). */
export interface Conexao {
  send(m: string): void;
  close(codigo?: number, motivo?: string): void;
  serializeAttachment(a: unknown): void;
  deserializeAttachment(): unknown;
}

/** O mínimo do DurableObjectState que a sala usa. */
export interface EstadoDaSala {
  acceptWebSocket(ws: Conexao): void;
  getWebSockets(): Conexao[];
  storage: {
    get<T>(k: string): Promise<T | undefined>;
    put(k: string, v: unknown): Promise<void>;
    getAlarm(): Promise<number | null>;
    setAlarm(t: number): Promise<void>;
    deleteAll(): Promise<void>;
  };
}

/** Acumulador do público da sala: guardado no storage, sobrevive à hibernação. */
export interface Medicao {
  /** Maior número de conexões ao mesmo tempo. */
  pico: number;
  /** Quantas conexões entraram ao todo (reconexões contam; não é gente única). */
  entradas: number;
  /** Primeira conexão. */
  primeiro: number;
  /** Instante e valor da última mudança de público. */
  desde: number;
  atual: number;
  /** Soma de público × milissegundos até `desde`. */
  area: number;
}

/** Registra uma mudança de público em `agora`. Pura: devolve a nova medição. */
export function medir(m: Medicao | undefined, agora: number, publico: number, entrou: boolean): Medicao {
  if (!m) return { pico: publico, entradas: entrou ? 1 : 0, primeiro: agora, desde: agora, atual: publico, area: 0 };
  return {
    pico: Math.max(m.pico, publico),
    entradas: m.entradas + (entrou ? 1 : 0),
    primeiro: m.primeiro,
    desde: agora,
    atual: publico,
    area: m.area + m.atual * Math.max(0, agora - m.desde),
  };
}

/** O resumo gravado no fim: média = público médio entre a primeira conexão e o fim. */
export interface ResumoDeAudiencia {
  partidaId: string;
  pico: number;
  entradas: number;
  media: number;
  primeiraConexao: number;
  fim: number;
}

export function resumir(m: Medicao, partidaId: string, fim: number): ResumoDeAudiencia {
  const fechada = medir(m, fim, 0, false);
  const duracao = fim - m.primeiro;
  return {
    partidaId,
    pico: m.pico,
    entradas: m.entradas,
    media: duracao > 0 ? Math.round((fechada.area / duracao) * 100) / 100 : m.pico,
    primeiraConexao: m.primeiro,
    fim,
  };
}

/** A Reação vale se passou o intervalo desde a última da mesma conexão. */
export const aceitaReacao = (a: Assento, agora: number) => agora - a.ultima >= INTERVALO_REACAO_MS;

/** O lote para uma conexão: tudo o que chegou, menos o que ela mesma mandou (já subiu na tela dela). */
export function loteSem(total: ContagemDeReacoes, proprias: ContagemDeReacoes | undefined): ContagemDeReacoes | null {
  const r: ContagemDeReacoes = {};
  let algo = false;
  for (const [id, n] of Object.entries(total) as [keyof ContagemDeReacoes, number][]) {
    const resto = n - (proprias?.[id] ?? 0);
    if (resto > 0) {
      r[id] = resto;
      algo = true;
    }
  }
  return algo ? r : null;
}

const assentoDe = (ws: Conexao): Assento => (ws.deserializeAttachment() as Assento | null) ?? { id: '', ultima: 0 };
const enviar = (ws: Conexao, m: MensagemDaSala) => {
  try {
    ws.send(JSON.stringify(m));
  } catch {
    /* conexão caindo: o close chega depois */
  }
};

export class SalaAoVivo {
  /** Reações do lote em formação, por conexão. Na memória: se a sala hibernar no meio, o lote se perde (aceitável). */
  private pendentes = new Map<string, ContagemDeReacoes>();
  /** Último público mandado, para só avisar quando muda. */
  private publicoAvisado = -1;

  constructor(
    private readonly ctx: EstadoDaSala,
    private readonly env?: { AGENDA?: { put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> } },
    private readonly relogio: () => number = Date.now,
  ) {}

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('esperava WebSocket', { status: 426 });
    const fim = Number(req.headers.get(CABECALHO_FIM));
    const agora = this.relogio();
    if (!Number.isFinite(fim) || agora >= fim) return new Response('o Ao Vivo acabou', { status: 410 });
    if (!(await this.ctx.storage.get<number>('fim'))) await this.ctx.storage.put('fim', fim);
    const partida = req.headers.get(CABECALHO_PARTIDA);
    if (partida && !(await this.ctx.storage.get<string>('partida'))) await this.ctx.storage.put('partida', partida);

    const { 0: cliente, 1: servidor } = new WebSocketPair();
    const ws = servidor as unknown as Conexao;
    ws.serializeAttachment({ id: crypto.randomUUID(), ultima: 0 } satisfies Assento);
    this.ctx.acceptWebSocket(ws);
    await this.contar(agora, this.ctx.getWebSockets().length, true);
    await this.agendar(agora);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  /** Para os testes (sem WebSocketPair): entra uma conexão já pronta. */
  async entrar(ws: Conexao, fim: number, partida?: string): Promise<void> {
    if (!(await this.ctx.storage.get<number>('fim'))) await this.ctx.storage.put('fim', fim);
    if (partida) await this.ctx.storage.put('partida', partida);
    ws.serializeAttachment({ id: crypto.randomUUID(), ultima: 0 } satisfies Assento);
    this.ctx.acceptWebSocket(ws);
    const agora = this.relogio();
    await this.contar(agora, this.ctx.getWebSockets().length, true);
    await this.agendar(agora);
  }

  async webSocketMessage(ws: Conexao, mensagem: string | ArrayBuffer): Promise<void> {
    const m = lerMensagemParaSala(mensagem);
    if (!m) return;
    const a = assentoDe(ws);
    const agora = this.relogio();
    if (!aceitaReacao(a, agora)) return;
    ws.serializeAttachment({ ...a, ultima: agora } satisfies Assento);
    const minhas = this.pendentes.get(a.id) ?? {};
    minhas[m.r] = (minhas[m.r] ?? 0) + 1;
    this.pendentes.set(a.id, minhas);
    await this.agendar(agora);
  }

  async webSocketClose(ws: Conexao): Promise<void> {
    try {
      ws.close(1000, 'tchau');
    } catch {
      /* já fechada */
    }
    const agora = this.relogio();
    await this.contar(agora, this.ctx.getWebSockets().filter((c) => c !== ws).length, false);
    await this.agendar(agora);
  }

  async webSocketError(ws: Conexao): Promise<void> {
    await this.webSocketClose(ws);
  }

  private async contar(agora: number, publico: number, entrou: boolean): Promise<void> {
    await this.ctx.storage.put('medicao', medir(await this.ctx.storage.get<Medicao>('medicao'), agora, publico, entrou));
  }

  /** Deixa o resumo no KV antes de a sala se apagar. Falhar aqui nunca pode travar o fim do Ao Vivo. */
  private async gravarResumo(fim: number): Promise<void> {
    try {
      const m = await this.ctx.storage.get<Medicao>('medicao');
      const partida = await this.ctx.storage.get<string>('partida');
      if (!m || !partida || !this.env?.AGENDA) return;
      await this.env.AGENDA.put(`audiencia/${partida}`, JSON.stringify(resumir(m, partida, fim)), { expirationTtl: VALIDADE_AUDIENCIA_S });
    } catch {
      /* só se perde a estatística daquele jogo */
    }
  }

  /** O próximo lote sai em até LOTE_REACOES_MS; não adia um alarme que já vem antes. */
  private async agendar(agora: number): Promise<void> {
    const atual = await this.ctx.storage.getAlarm();
    const quando = agora + LOTE_REACOES_MS;
    if (atual === null || atual > quando) await this.ctx.storage.setAlarm(quando);
  }

  async alarm(): Promise<void> {
    const agora = this.relogio();
    const fim = (await this.ctx.storage.get<number>('fim')) ?? 0;
    const conexoes = this.ctx.getWebSockets();
    if (agora >= fim) {
      for (const ws of conexoes) {
        try {
          ws.close(FIM_DO_AO_VIVO.codigo, FIM_DO_AO_VIVO.motivo);
        } catch {
          /* já fechada */
        }
      }
      this.pendentes.clear();
      await this.gravarResumo(fim);
      await this.ctx.storage.deleteAll();
      return;
    }

    const publico = conexoes.length;
    if (publico !== this.publicoAvisado) {
      for (const ws of conexoes) enviar(ws, { t: 'publico', n: publico });
      this.publicoAvisado = publico;
    }

    if (this.pendentes.size) {
      const total: ContagemDeReacoes = {};
      for (const c of this.pendentes.values()) for (const [id, n] of Object.entries(c) as [keyof ContagemDeReacoes, number][]) total[id] = (total[id] ?? 0) + n;
      for (const ws of conexoes) {
        const lote = loteSem(total, this.pendentes.get(assentoDe(ws).id));
        if (lote) enviar(ws, { t: 'reacoes', r: lote });
      }
      this.pendentes.clear();
    }

    // Sem nada para mandar, o próximo alarme é o do fim, que fecha a sala e apaga o que ela guardou.
    await this.ctx.storage.setAlarm(fim);
  }
}
