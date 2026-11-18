import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Instagram } from '../src/instagram.js';
import { chaveDoLink, criarLinkDeVinculo, mensagemDoLink, novoToken, VALIDADE_DO_LINK_S } from '../src/linkDeVinculo.js';
import { AgendaNaMemoria, KV } from '../src/nuvem.js';

const agora = new Date('2026-11-17T23:00:00Z');

describe('Link de Vínculo (ADR-0082)', () => {
  it('grava só o hash do token, com validade de 24 h, e monta o link do site', async () => {
    const agenda = new AgendaNaMemoria();
    const token = novoToken();
    // O formato que a borda aceita (sessaoValida).
    expect(token).toMatch(/^[A-Za-z0-9_-]{30,60}$/);
    const r = await criarLinkDeVinculo(agenda, { id: '125', username: 'wagno_santos21' }, { site: 'https://varzeao.pages.dev/', agora, token });
    expect(r.url).toBe(`https://varzeao.pages.dev/#/vincular/${token}`);
    expect(r.expiraEm).toBe('2026-11-18T23:00:00.000Z');
    const chave = `vinculo/link/${createHash('sha256').update(token).digest('hex')}`;
    expect(r.chave).toBe(chave);
    expect(chaveDoLink(token)).toBe(chave);
    expect(await agenda.ler(chave)).toEqual({ jogadorId: '125', username: 'wagno_santos21', criadoEm: agora.toISOString(), expiraEm: r.expiraEm });
    expect(agenda.validades.get(chave)).toBe(VALIDADE_DO_LINK_S);
    expect([...agenda.itens.values()].join()).not.toContain(token);
  });

  it('cada link tem um token novo', () => {
    expect(novoToken()).not.toBe(novoToken());
  });

  it('a mensagem fala com o @ e leva o link', () => {
    const m = mensagemDoLink('wagno_santos21', 'https://site/#/vincular/abc');
    expect(m).toContain('@wagno_santos21');
    expect(m).toContain('https://site/#/vincular/abc');
    expect(m).toContain('24 horas');
  });

  it('o KV da Cloudflare recebe a validade como expiration_ttl', async () => {
    const urls: string[] = [];
    const kv = new KV({ contaId: 'c', namespaceId: 'n', token: 't', fetch: (async (u: string) => (urls.push(String(u)), new Response('{}'))) as unknown as typeof fetch });
    await kv.gravar('vinculo/link/x', { a: 1 }, { validadeS: 86400 });
    await kv.gravar('outra', { a: 1 });
    expect(urls[0]).toMatch(/values\/vinculo%2Flink%2Fx\?expiration_ttl=86400$/);
    expect(urls[1]).toMatch(/values\/outra$/);
  });

  it('a DM sai pela conta da Liga para o id da conversa', async () => {
    const corpos: string[] = [];
    const f = (async (u: URL, init: RequestInit) => {
      expect(String(u)).toContain('/LIGA/messages');
      corpos.push(String(init.body));
      return Response.json({ message_id: 'm1' });
    }) as unknown as typeof fetch;
    expect(await new Instagram({ userId: 'LIGA', token: 'EAAteste', fetch: f }).enviarDm('123', 'oi')).toBe('m1');
    const p = new URLSearchParams(corpos[0]);
    expect(JSON.parse(p.get('recipient')!)).toEqual({ id: '123' });
    expect(JSON.parse(p.get('message')!)).toEqual({ text: 'oi' });
  });
});

describe('Última mensagem na DM (destino do Link de Vínculo)', () => {
  const conversas = {
    data: [
      { participants: { data: [{ id: 'LIGA', username: 'varzeao_da_mata' }, { id: 'conv-1', username: 'outro' }] }, messages: { data: [{ from: { id: 'rem-1', username: 'outro' }, created_time: '2026-11-17T23:00:00+0000' }] } },
      {
        participants: { data: [{ id: 'LIGA', username: 'varzeao_da_mata' }, { id: 'conv-2', username: 'Bruno_X' }] },
        messages: {
          data: [
            { from: { id: 'LIGA', username: 'varzeao_da_mata' }, created_time: '2026-11-17T23:30:00+0000' },
            { from: { id: 'rem-2', username: 'bruno_x' }, created_time: '2026-11-17T23:13:00+0000' },
            { from: { id: 'rem-2', username: 'bruno_x' }, created_time: '2026-11-16T10:00:00+0000' },
          ],
        },
      },
    ],
  };
  const ig = (dados: unknown) => new Instagram({ userId: 'LIGA', token: 'EAAteste', fetch: (async () => Response.json(dados)) as unknown as typeof fetch });

  it('usa o id do remetente e a hora da última mensagem dele (não a da Liga)', async () => {
    expect(await ig(conversas).ultimaMensagemDe('@bruno_x')).toEqual({ id: 'rem-2', em: new Date('2026-11-17T23:13:00Z'), idNaConversa: 'conv-2' });
  });

  it('sem mensagem dele na DM, não há destino', async () => {
    expect(await ig(conversas).ultimaMensagemDe('ninguem')).toBeNull();
  });
});

describe('Inscrição no webhook de mensagens (ADR-0083)', () => {
  it('inscreve a conta no campo messages e lê as inscrições', async () => {
    const pedidos: string[] = [];
    const f = (async (u: URL, init: RequestInit) => {
      pedidos.push(`${init.method} ${u.pathname} ${init.body ? String(init.body) : ''}`);
      return init.method === 'POST' ? Response.json({ success: true }) : Response.json({ data: [{ name: 'Varzeão', subscribed_fields: ['messages'] }] });
    }) as unknown as typeof fetch;
    const ig = new Instagram({ userId: 'LIGA', token: 'EAAteste', fetch: f });
    expect(await ig.inscreverMensagens()).toBe(true);
    expect(pedidos[0]).toMatch(/^POST \/v[\d.]+\/LIGA\/subscribed_apps .*subscribed_fields=messages/);
    expect(await ig.inscricoesDoWebhook()).toEqual([{ app: 'Varzeão', campos: ['messages'] }]);
  });
});
