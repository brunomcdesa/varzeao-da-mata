import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { coletarAudienciaDoSite, consulta } from '../src/audienciaSite.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

/** Cloudflare de mentira: responde conforme o recorte pedido na consulta. */
function cloudflare(respostas: Record<string, unknown[] | 'erro'>) {
  const pedidos: { query: string; variables: Record<string, string>; auth: string }[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    const corpo = JSON.parse(init.body as string);
    pedidos.push({ ...corpo, auth: (init.headers as Record<string, string>).authorization });
    const recorte = ['requestPath', 'countryName', 'refererHost'].find((d) => corpo.query.includes(d)) ?? 'total';
    const r = respostas[recorte];
    if (r === 'erro') return new Response(JSON.stringify({ data: null, errors: [{ message: 'campo desconhecido' }] }), { status: 200 });
    return new Response(JSON.stringify({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: r ?? [] }] } }, errors: null }), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, pedidos };
}
const g = (date: string, count: number, visits: number, extra: Record<string, string> = {}) => ({ count, sum: { visits }, dimensions: { date, ...extra } });
const agora = new Date('2026-11-27T05:30:00Z');
const base = { token: 'tok', contaId: 'conta', agora };

describe('audiência do site no banco (ADR-0119)', () => {
  it('guarda total, páginas, países e origens por dia', async () => {
    const { f, pedidos } = cloudflare({
      total: [g('2026-11-26', 900, 170)],
      requestPath: [g('2026-11-26', 500, 100, { requestPath: '/' }), g('2026-11-26', 400, 90, { requestPath: '/tabela' })],
      countryName: [g('2026-11-26', 880, 168, { countryName: 'BR' })],
      refererHost: [g('2026-11-26', 300, 120, { refererHost: 'l.instagram.com' })],
    });
    const r = await coletarAudienciaDoSite(banco, { ...base, fetch: f });
    expect(r).toMatchObject({ linhas: 5, de: '2026-11-24', ate: '2026-11-26', falhas: [] });
    const l = (await banco.query<{ recorte: string; valor: string; paginas: number; visitas: number }>(`SELECT recorte, valor, paginas, visitas FROM audiencia_site_dia ORDER BY recorte, valor`)).rows;
    expect(l).toContainEqual({ recorte: 'total', valor: '', paginas: 900, visitas: 170 });
    expect(l).toContainEqual({ recorte: 'origem', valor: 'l.instagram.com', paginas: 300, visitas: 120 });
    expect(pedidos).toHaveLength(4);
    expect(pedidos[0]).toMatchObject({ auth: 'Bearer tok', variables: { conta: 'conta', de: '2026-11-24', ate: '2026-11-26' } });
  });

  it('refazer atualiza o dia aberto e não mexe no dia já fechado', async () => {
    const r1 = cloudflare({ total: [g('2026-11-25', 100, 10), g('2026-11-26', 100, 10)] });
    await coletarAudienciaDoSite(banco, { ...base, fetch: r1.f });
    const r2 = cloudflare({ total: [g('2026-11-25', 999, 99), g('2026-11-26', 120, 12)] });
    await coletarAudienciaDoSite(banco, { ...base, fetch: r2.f });
    const l = (await banco.query<{ dia: string; paginas: number; fechado: boolean }>(`SELECT dia::text, paginas, fechado FROM audiencia_site_dia WHERE recorte = 'total' ORDER BY dia`)).rows;
    expect(l).toEqual([
      { dia: '2026-11-25', paginas: 100, fechado: true }, // fechado: imutável
      { dia: '2026-11-26', paginas: 120, fechado: false }, // ontem ainda pode mudar
    ]);
  });

  it('um recorte com erro não derruba os outros e é avisado', async () => {
    const { f } = cloudflare({ total: [g('2026-11-26', 10, 2)], countryName: 'erro' });
    const r = await coletarAudienciaDoSite(banco, { ...base, fetch: f });
    expect(r.falhas).toEqual([{ recorte: 'pais', erro: 'Cloudflare: campo desconhecido' }]);
    expect((await banco.query(`SELECT 1 FROM audiencia_site_dia WHERE recorte = 'total'`)).rows).toHaveLength(1);
  });

  it('erro de HTTP vira falha, sem gravar nada', async () => {
    const f = (async () => new Response('no', { status: 403 })) as unknown as typeof fetch;
    const r = await coletarAudienciaDoSite(banco, { ...base, fetch: f });
    expect(r.falhas).toHaveLength(4);
    expect(r.falhas[0]!.erro).toContain('403');
    expect((await banco.query(`SELECT 1 FROM audiencia_site_dia`)).rows).toHaveLength(0);
  });

  it('o filtro de site entra na consulta só com caracteres seguros', () => {
    expect(consulta('total')).not.toContain('siteTag');
    expect(consulta('total', 'abc123')).toContain('siteTag: "abc123"');
    expect(consulta('total', 'x" }) { evil')).toContain('siteTag: "xevil"');
  });
});
