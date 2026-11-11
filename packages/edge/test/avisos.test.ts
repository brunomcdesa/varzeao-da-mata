import { describe, expect, it } from 'vitest';
import { generateVAPIDKeys } from 'web-push-neo';
import type { MomentosDoAoVivo, PartidaNoCalendario } from '@liga/shared';
import {
  CHAVE_FILA,
  ENVIOS_POR_MINUTO,
  avisosDoMinuto,
  endpointValido,
  janelaDoMinuto,
  lerAtivacao,
  pertoDeUmJogo,
  rodarAvisos,
  type AmbienteDosAvisos,
} from '../src/avisos.js';

// Apito às 14h de Brasília (17h UTC).
const APITO = '2026-11-21T17:00:00.000Z';
const em = (min: number, s = 5) => new Date(Date.parse(APITO) + min * 60_000 + s * 1000);

const partida = (o: Partial<PartidaNoCalendario> = {}): PartidaNoCalendario => ({
  id: 7,
  rodada: 1,
  fase: 'LIGA',
  apito: APITO,
  mandante: 'CAP',
  visitante: 'ONC',
  situacao: 'AGENDADA',
  classico: true,
  escalada: true,
  ...o,
});

const momentos: MomentosDoAoVivo = {
  gols: [
    { lado: 'visitante', emMs: 75_000, placar: { mandante: 0, visitante: 1 } },
    { lado: 'mandante', emMs: 200_000, placar: { mandante: 1, visitante: 1 } },
  ],
  fimMs: 300_000,
  placar: { mandante: 1, visitante: 1 },
};

describe('avisosDoMinuto', () => {
  it('avisa a Escalação uma vez, entre o Corte e o Apito', () => {
    const [a] = avisosDoMinuto([partida()], em(-29), new Map(), new Set());
    expect(a).toMatchObject({ tipo: 'ESCALACAO', times: ['CAP', 'ONC'], titulo: 'Saiu a Escalação', url: '#/partida/7' });
    expect(a!.corpo).toBe('Capivara × Onça, às 14h. Veja quem entra em campo.');
    expect(avisosDoMinuto([partida()], em(-28), new Map(), new Set([7]))).toEqual([]);
    expect(avisosDoMinuto([partida({ escalada: false })], em(-28), new Map(), new Set())).toEqual([]);
    expect(avisosDoMinuto([partida()], em(-45), new Map(), new Set())).toEqual([]);
  });

  it('avisa o jogo 5 min antes do Apito, para pegar o Ao Vivo desde o começo', () => {
    const avisos = avisosDoMinuto([partida()], em(-5), new Map(), new Set([7]));
    expect(avisos.map((a) => a.tipo)).toEqual(['APITO']);
    expect(avisos[0]!.titulo).toBe('Daqui a 5 min: Capivara × Onça');
    expect(avisosDoMinuto([partida()], em(-4), new Map(), new Set([7]))).toEqual([]);
    expect(avisosDoMinuto([partida()], em(0), new Map(), new Set([7]))).toEqual([]);
  });

  it('avisa o gol no minuto seguinte ao que ele aparece no Ao Vivo, nunca antes', () => {
    const m = new Map([[7, momentos]]);
    // Gol da Onça aos 1:15 do Ao Vivo: no minuto 1 ainda não apareceu.
    expect(avisosDoMinuto([partida()], em(1), m, new Set()).map((a) => a.tipo)).toEqual([]);
    const [gol] = avisosDoMinuto([partida()], em(2), m, new Set());
    expect(gol).toMatchObject({ tipo: 'GOL', titulo: 'GOL da Onça!', corpo: 'Capivara 0 × 1 Onça' });
    expect(avisosDoMinuto([partida()], em(4), m, new Set())[0]).toMatchObject({ titulo: 'GOL da Capivara!', corpo: 'Capivara 1 × 1 Onça' });
  });

  it('avisa o fim do Ao Vivo com o placar e os pênaltis', () => {
    const comPenaltis = new Map([[7, { ...momentos, fimMs: 420_000, penaltis: { mandante: 4, visitante: 3 } }]]);
    const [fim] = avisosDoMinuto([partida({ fase: 'MATA_MATA' })], em(7), comPenaltis, new Set());
    expect(fim).toMatchObject({ tipo: 'FIM', titulo: 'Fim de jogo', corpo: 'Capivara 1 × 1 Onça (pênaltis 4 × 3)' });
  });

  it('a janela é o minuto que acabou de fechar', () => {
    const j = janelaDoMinuto(new Date('2026-11-21T17:02:30.000Z'));
    expect(new Date(j.fim).toISOString()).toBe('2026-11-21T17:02:00.000Z');
    expect(j.fim - j.inicio).toBe(60_000);
  });
});

describe('pertoDeUmJogo', () => {
  it('só perto dos horários de jogo (Brasília)', () => {
    expect(pertoDeUmJogo(em(-30))).toBe(true);
    expect(pertoDeUmJogo(em(8))).toBe(true);
    expect(pertoDeUmJogo(em(60))).toBe(false);
    expect(pertoDeUmJogo(new Date('2026-11-21T06:00:00.000Z'))).toBe(false);
  });
});

describe('ativação dos Avisos', () => {
  const assinatura = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BPx', auth: 'Ax' } };
  it('aceita um endereço https e Times que existem', () => {
    expect(lerAtivacao({ assinatura, times: ['ONC', 'ONC', 'MOR'] })?.times).toEqual(['ONC', 'MOR']);
  });
  it('recusa sem Time, com Time inventado ou endereço estranho', () => {
    expect(lerAtivacao({ assinatura, times: [] })).toBeNull();
    expect(lerAtivacao({ assinatura, times: ['XXX'] })).toBeNull();
    expect(lerAtivacao({ assinatura: { ...assinatura, endpoint: 'http://fcm.googleapis.com/x' }, times: ['ONC'] })).toBeNull();
    expect(endpointValido('https://localhost/x')).toBe(false);
    expect(endpointValido('https://web.push.apple.com/abc')).toBe(true);
  });
});

// ------------------------------------------------------------------ cron, com cifra de verdade

const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url');

async function chaves() {
  const vapid = await generateVAPIDKeys();
  const aparelho = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  return {
    publica: vapid.publicKey,
    privada: vapid.privateKey,
    p256dh: b64url((await crypto.subtle.exportKey('raw', aparelho.publicKey)) as ArrayBuffer),
    auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

function kv() {
  const m = new Map<string, string>();
  return {
    m,
    async get(k: string, tipo?: string) {
      const v = m.get(k);
      return v === undefined ? null : tipo === 'json' ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) {
      m.set(k, v);
    },
    async delete(k: string) {
      m.delete(k);
    },
  };
}
const r2 = (objs: Record<string, unknown>) => ({
  async get(k: string) {
    return k in objs ? { json: async () => structuredClone(objs[k]) } : null;
  },
});

describe('rodarAvisos', () => {
  it('manda o gol para quem segue os Times, esquece quem sumiu e enfileira o excesso', async () => {
    const c = await chaves();
    const AGENDA = kv();
    const env = {
      AGENDA,
      PUBLICO: r2({ 'dados/liga.json': { calendario: [partida()] } }),
      PRIVADO: r2({ 'partidas/7.json': { momentos } }),
      DATABASE_URL: 'postgres://x',
      VAPID_PUBLICA: c.publica,
      VAPID_PRIVADA: c.privada,
    } as unknown as AmbienteDosAvisos;
    const total = ENVIOS_POR_MINUTO + 5;
    const aparelhos = Array.from({ length: total }, (_, i) => ({ endpoint: `https://push.exemplo.com/${String(i).padStart(3, '0')}`, p256dh: c.p256dh, auth: c.auth }));
    const consultas: { sql: string; params: unknown[] }[] = [];
    const banco = {
      async query(sql: string, params: unknown[] = []) {
        consultas.push({ sql, params });
        return { rows: sql.startsWith('SELECT') ? aparelhos : [] };
      },
    };
    const enviados: { url: string; headers: Headers }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      enviados.push({ url, headers: new Headers(init.headers) });
      return new Response(null, { status: url.endsWith('/000') ? 410 : 201 });
    }) as unknown as typeof fetch;

    const feitos = await rodarAvisos(env, em(2), (fn) => fn(banco as never), f);

    expect(consultas[0]!.params[0]).toEqual(['CAP', 'ONC']);
    expect(enviados).toHaveLength(ENVIOS_POR_MINUTO);
    expect(feitos).toBe(ENVIOS_POR_MINUTO - 1);
    expect(enviados[0]!.headers.get('content-encoding')).toBe('aes128gcm');
    expect(enviados[0]!.headers.get('authorization')).toMatch(/^vapid t=/);
    expect(consultas.some((q) => q.sql.startsWith('DELETE') && q.params[0] === 'https://push.exemplo.com/000')).toBe(true);
    expect(JSON.parse(AGENDA.m.get(CHAVE_FILA)!)).toHaveLength(5);

    // No minuto seguinte, sem gol novo, esvazia a fila.
    enviados.length = 0;
    await rodarAvisos(env, em(3), (fn) => fn(banco as never), f);
    expect(enviados).toHaveLength(5);
    expect(AGENDA.m.has(CHAVE_FILA)).toBe(false);
  });

  it('sem a chave VAPID, fica desligado', async () => {
    const env = { AGENDA: kv(), PUBLICO: r2({}), PRIVADO: r2({}) } as unknown as AmbienteDosAvisos;
    expect(await rodarAvisos(env, em(2), async () => [] as never)).toBe(0);
  });
});
