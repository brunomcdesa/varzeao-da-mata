/**
 * Acesso ao PostgreSQL. A interface `Banco` é pequena de propósito: em produção é o `pg`
 * (Pool), nos testes é o PGlite (Postgres embutido), e o resto do worker não sabe qual é.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { IDENTIDADE, TIMES } from '@liga/shared';
import { APELIDOS_DE_TIME } from './vocabulario.js';

export interface Banco {
  /** Uma instrução com parâmetros $1, $2… */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Várias instruções sem parâmetros (migrações). */
  executar(sql: string): Promise<void>;
  /** Roda `fn` numa transação: commit se terminar, rollback se lançar erro. */
  transacao<T>(fn: (b: Banco) => Promise<T>): Promise<T>;
  fechar(): Promise<void>;
}

/** Banco de produção, a partir de DATABASE_URL. */
export function conectar(url = process.env.DATABASE_URL): Banco {
  if (!url) throw new Error('Defina DATABASE_URL');
  const pool = new pg.Pool({ connectionString: url, max: 3 });
  const deCliente = (c: pg.PoolClient | pg.Pool): Omit<Banco, 'transacao' | 'fechar'> => ({
    query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await c.query(sql, params)).rows as T[] }),
    executar: async (sql: string) => {
      await c.query(sql);
    },
  });
  return {
    ...deCliente(pool),
    async transacao(fn) {
      const cliente = await pool.connect();
      const b: Banco = {
        ...deCliente(cliente),
        transacao: (f) => f(b), // transações aninhadas reaproveitam a de fora
        fechar: async () => {},
      };
      try {
        await cliente.query('BEGIN');
        const r = await fn(b);
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
}

const PASTA_MIGRACOES = resolve(dirname(fileURLToPath(import.meta.url)), '../migracoes');

/** Aplica as migrações pendentes (arquivos .sql em ordem de nome) e cadastra os Times. */
export async function prepararBanco(banco: Banco): Promise<string[]> {
  await banco.executar(`CREATE TABLE IF NOT EXISTS migracao (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`);
  const feitas = new Set((await banco.query<{ nome: string }>('SELECT nome FROM migracao')).rows.map((r) => r.nome));
  const arquivos = (await readdir(PASTA_MIGRACOES)).filter((a) => a.endsWith('.sql')).sort();
  const aplicadas: string[] = [];
  for (const arquivo of arquivos) {
    if (feitas.has(arquivo)) continue;
    const sql = await readFile(join(PASTA_MIGRACOES, arquivo), 'utf8');
    await banco.transacao(async (b) => {
      await b.executar(sql);
      await b.query('INSERT INTO migracao (nome) VALUES ($1)', [arquivo]);
    });
    aplicadas.push(arquivo);
  }
  for (const id of TIMES) {
    const t = IDENTIDADE[id];
    await banco.query(
      `INSERT INTO time (id, nome, apelidos, primaria, secundaria) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, apelidos = EXCLUDED.apelidos, primaria = EXCLUDED.primaria, secundaria = EXCLUDED.secundaria`,
      [id, t.nome, APELIDOS_DE_TIME[id], t.primaria, t.secundaria],
    );
  }
  return aplicadas;
}
