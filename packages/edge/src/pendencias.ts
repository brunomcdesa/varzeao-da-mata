/**
 * A borda marca o que mudou no KV para a coleta listar só isso (ADR-0035). Ler a chave é
 * barato; ela só é gravada quando o tipo ainda não estava marcado.
 */
import { CHAVE_PENDENCIAS, comPendencia, type Pendencias, type TipoDePendencia } from '@liga/shared';

export async function marcarPendencia(kv: KVNamespace, tipo: TipoDePendencia, agora: Date): Promise<void> {
  const nova = comPendencia(await kv.get<Pendencias>(CHAVE_PENDENCIAS, 'json'), tipo, agora);
  if (nova) await kv.put(CHAVE_PENDENCIAS, JSON.stringify(nova));
}
