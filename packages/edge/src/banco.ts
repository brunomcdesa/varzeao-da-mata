/**
 * Banco na borda (Neon pelo driver serverless, por WebSocket): a mesma interface do worker,
 * para a borda aplicar a Transferência e o perfil na hora, com as mesmas regras (ADR-0013).
 */
import { Pool } from '@neondatabase/serverless';
import type { Banco } from '../../worker/src/banco.js';

/** Roda `fn` com um banco aberto só para este pedido. */
export async function comBanco<T>(url: string, fn: (b: Banco) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url });
  const deCliente = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) => ({
    query: async <R>(sql: string, params?: unknown[]) => ({ rows: (await c.query(sql, params)).rows as R[] }),
    executar: async (sql: string) => {
      await c.query(sql);
    },
  });
  const banco: Banco = {
    ...deCliente(pool),
    async transacao(f) {
      const cliente = await pool.connect();
      const b: Banco = { ...deCliente(cliente), transacao: (g) => g(b), fechar: async () => {} };
      try {
        await cliente.query('BEGIN');
        const r = await f(b);
        await cliente.query('COMMIT');
        return r;
      } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
      } finally {
        cliente.release();
      }
    },
    fechar: () => pool.end(),
  };
  try {
    return await fn(banco);
  } finally {
    await pool.end();
  }
}
