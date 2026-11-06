/** Banco de teste: Postgres embutido (PGlite) em memória, já migrado. */
import { bancoLocal } from '../scripts/banco-local.js';

export const bancoDeTeste = () => bancoLocal();
