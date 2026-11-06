/** Banco de teste: um Postgres embutido (PGlite) em memória, já migrado. */
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
      db === raiz
        ? (raiz.transaction((tx) => fn(adaptar(tx as unknown as Executor, raiz))) as ReturnType<typeof fn>)
        : fn(b),
    fechar: () => raiz.close(),
  };
  return b;
}

export async function bancoDeTeste(): Promise<Banco> {
  const db = await PGlite.create();
  const banco = adaptar(db, db);
  await prepararBanco(banco);
  return banco;
}
