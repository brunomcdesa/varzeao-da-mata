import { describe, expect, it } from 'vitest';
import { INTERVALO_REACAO_MS, LOTE_REACOES_MS, lerMensagemParaSala, textoDoPublico, type MensagemDaSala } from '@liga/shared';
import { FIM_DO_AO_VIVO, SalaAoVivo, aceitaReacao, loteSem, type Conexao, type EstadoDaSala } from '../src/salaAoVivo.js';
import { responder, type Env } from '../src/index.js';

class ConexaoFalsa implements Conexao {
  recebidas: MensagemDaSala[] = [];
  fechada: { codigo: number | undefined; motivo: string | undefined } | null = null;
  private anexo: unknown = null;
  send(m: string) {
    this.recebidas.push(JSON.parse(m) as MensagemDaSala);
  }
  close(codigo?: number, motivo?: string) {
    this.fechada = { codigo, motivo };
  }
  serializeAttachment(a: unknown) {
    this.anexo = structuredClone(a);
  }
  deserializeAttachment() {
    return this.anexo;
  }
}

function estado() {
  const conexoes: ConexaoFalsa[] = [];
  const guardado = new Map<string, unknown>();
  let alarme: number | null = null;
  const e: EstadoDaSala & { conexoes: ConexaoFalsa[]; alarme: () => number | null; guardado: Map<string, unknown> } = {
    conexoes,
    guardado,
    alarme: () => alarme,
    acceptWebSocket: (ws) => void conexoes.push(ws as ConexaoFalsa),
    getWebSockets: () => conexoes.filter((c) => !c.fechada),
    storage: {
      get: async <T>(k: string) => guardado.get(k) as T | undefined,
      put: async (k, v) => void guardado.set(k, v),
      getAlarm: async () => alarme,
      setAlarm: async (t) => void (alarme = t),
      deleteAll: async () => guardado.clear(),
    },
  };
  return e;
}

const FIM = 1_000_000;
const reacao = (r: string) => JSON.stringify({ r });

describe('regras da sala', () => {
  it('uma Reação por segundo por conexão', () => {
    expect(aceitaReacao({ id: 'a', ultima: 0 }, 5000)).toBe(true);
    expect(aceitaReacao({ id: 'a', ultima: 5000 }, 5000 + INTERVALO_REACAO_MS - 1)).toBe(false);
    expect(aceitaReacao({ id: 'a', ultima: 5000 }, 5000 + INTERVALO_REACAO_MS)).toBe(true);
  });

  it('o lote de cada um não traz as Reações que ele mesmo mandou', () => {
    expect(loteSem({ gol: 3, fogo: 1 }, { gol: 1 })).toEqual({ gol: 2, fogo: 1 });
    expect(loteSem({ gol: 1 }, { gol: 1 })).toBeNull();
    expect(loteSem({ susto: 2 }, undefined)).toEqual({ susto: 2 });
  });

  it('só aceita as quatro Reações, em JSON curto', () => {
    expect(lerMensagemParaSala(reacao('palmas'))).toEqual({ r: 'palmas' });
    expect(lerMensagemParaSala(reacao('xingamento'))).toBeNull();
    expect(lerMensagemParaSala('não é json')).toBeNull();
    expect(lerMensagemParaSala(JSON.stringify({ r: 'gol', lixo: 'x'.repeat(80) }))).toBeNull();
    expect(lerMensagemParaSala(new ArrayBuffer(4))).toBeNull();
  });

  it('texto do público', () => {
    expect(textoDoPublico(1)).toBe('1 assistindo');
    expect(textoDoPublico(37)).toBe('37 assistindo');
    expect(textoDoPublico(1234)).toBe('1,2 mil assistindo');
    expect(textoDoPublico(5000)).toBe('5 mil assistindo');
  });
});

describe('SalaAoVivo', () => {
  it('conta quem está assistindo e avisa só quando muda', async () => {
    let agora = 1000;
    const e = estado();
    const sala = new SalaAoVivo(e, undefined, () => agora);
    const [a, b] = [new ConexaoFalsa(), new ConexaoFalsa()];
    await sala.entrar(a, FIM);
    await sala.entrar(b, FIM);
    expect(e.alarme()).toBe(1000 + LOTE_REACOES_MS);
    agora = e.alarme()!;
    await sala.alarm();
    expect(a.recebidas).toEqual([{ t: 'publico', n: 2 }]);
    expect(b.recebidas).toEqual([{ t: 'publico', n: 2 }]);
    // Sem mudança, não repete; o próximo alarme é o do fim.
    await sala.alarm();
    expect(a.recebidas).toHaveLength(1);
    expect(e.alarme()).toBe(FIM);

    b.close();
    await sala.webSocketClose(b);
    agora = e.alarme()!;
    await sala.alarm();
    expect(a.recebidas.at(-1)).toEqual({ t: 'publico', n: 1 });
  });

  it('junta as Reações num lote, sem devolver a de quem mandou', async () => {
    let agora = 1000;
    const e = estado();
    const sala = new SalaAoVivo(e, undefined, () => agora);
    const [a, b] = [new ConexaoFalsa(), new ConexaoFalsa()];
    await sala.entrar(a, FIM);
    await sala.entrar(b, FIM);
    await sala.webSocketMessage(a, reacao('gol'));
    await sala.webSocketMessage(b, reacao('fogo'));
    agora += LOTE_REACOES_MS;
    await sala.alarm();
    expect(a.recebidas).toContainEqual({ t: 'reacoes', r: { fogo: 1 } });
    expect(b.recebidas).toContainEqual({ t: 'reacoes', r: { gol: 1 } });
  });

  it('ignora Reação repetida antes de 1 segundo e mensagem estranha', async () => {
    let agora = 1000;
    const e = estado();
    const sala = new SalaAoVivo(e, undefined, () => agora);
    const [a, b] = [new ConexaoFalsa(), new ConexaoFalsa()];
    await sala.entrar(a, FIM);
    await sala.entrar(b, FIM);
    await sala.webSocketMessage(a, reacao('gol'));
    agora += 200;
    await sala.webSocketMessage(a, reacao('gol'));
    await sala.webSocketMessage(a, reacao('palavrao'));
    agora += LOTE_REACOES_MS;
    await sala.alarm();
    expect(b.recebidas).toContainEqual({ t: 'reacoes', r: { gol: 1 } });
  });

  it('no fim do Ao Vivo fecha todo mundo e apaga o que guardou', async () => {
    let agora = 1000;
    const e = estado();
    const sala = new SalaAoVivo(e, undefined, () => agora);
    const a = new ConexaoFalsa();
    await sala.entrar(a, FIM);
    agora = FIM;
    await sala.alarm();
    expect(a.fechada).toEqual({ codigo: FIM_DO_AO_VIVO.codigo, motivo: FIM_DO_AO_VIVO.motivo });
    expect(e.guardado.size).toBe(0);
  });

  it('recusa quem chega depois do fim ou sem WebSocket', async () => {
    const sala = new SalaAoVivo(estado(), undefined, () => FIM + 1);
    const ws = { upgrade: 'websocket', 'x-fim-ao-vivo': String(FIM) };
    expect((await sala.fetch(new Request('https://e/ao-vivo/1', { headers: ws }))).status).toBe(410);
    expect((await sala.fetch(new Request('https://e/ao-vivo/1'))).status).toBe(426);
  });
});

describe('rota /ao-vivo/:id', () => {
  const r2 = (objs: Record<string, unknown>) => ({
    async get(k: string) {
      return k in objs ? { json: async () => structuredClone(objs[k]) } : null;
    },
  });
  const pedidos: Request[] = [];
  const env = {
    PRIVADO: r2({ 'partidas/7.json': { id: 7, apito: '2026-11-07T15:00:00.000Z', fase: 'LIGA' } }),
    SALAS: {
      idFromName: (n: string) => n,
      get: () => ({
        fetch: async (req: Request) => {
          pedidos.push(req);
          return new Response('ok-sala');
        },
      }),
    },
  } as unknown as Env;
  const ws = { headers: { upgrade: 'websocket' } };

  it('só abre durante o Ao Vivo e passa o fim para a sala', async () => {
    expect((await responder(new Request('https://e/ao-vivo/7', ws), env, new Date('2026-11-07T14:59:00Z'))).status).toBe(425);
    const r = await responder(new Request('https://e/ao-vivo/7', ws), env, new Date('2026-11-07T15:02:00Z'));
    expect(await r.text()).toBe('ok-sala');
    expect(pedidos.at(-1)!.headers.get('x-fim-ao-vivo')).toBe(String(Date.parse('2026-11-07T15:05:00Z')));
    expect((await responder(new Request('https://e/ao-vivo/7', ws), env, new Date('2026-11-07T15:05:00Z'))).status).toBe(410);
  });

  it('Partida que não existe, ou pedido sem WebSocket', async () => {
    expect((await responder(new Request('https://e/ao-vivo/8', ws), env, new Date('2026-11-07T15:02:00Z'))).status).toBe(404);
    expect((await responder(new Request('https://e/ao-vivo/7'), env, new Date('2026-11-07T15:02:00Z'))).status).toBe(426);
  });
});
