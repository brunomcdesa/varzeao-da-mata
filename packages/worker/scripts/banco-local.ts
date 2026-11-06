/**
 * Banco local sem servidor: PGlite (Postgres embutido). Em memória nos testes; em disco
 * (pasta) para o `pnpm liga`. Usa a mesma interface `Banco` do Postgres de produção.
 */
import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { prepararBanco, type Banco } from '../src/banco.js';

type Executor = Pick<PGlite, 'query' | 'exec'>;

function adaptar(db: Executor, raiz: PGlite): Banco {
  const b: Banco = {
    query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await db.query<T>(sql, params as unknown[])).rows }),
    executar: async (sql) => {
      await db.exec(sql);
    },
    transacao: (fn) =>
      db === raiz ? (raiz.transaction((tx) => fn(adaptar(tx as unknown as Executor, raiz))) as ReturnType<typeof fn>) : fn(b),
    fechar: () => raiz.close(),
  };
  return b;
}

/** `pasta` = onde guardar os dados; sem pasta, fica só em memória. */
export async function bancoLocal(pasta?: string): Promise<Banco> {
  if (pasta) mkdirSync(pasta, { recursive: true });
  const db = pasta ? await PGlite.create(pasta) : await PGlite.create();
  const banco = adaptar(db, db);
  await prepararBanco(banco);
  return banco;
}
