import type { SQLiteClient } from '@/database/sqliteClient';

/**
 * Envolve um SQLiteClient real para que a N-ésima chamada de `runAsync` em
 * diante falhe — usado para provar que operações que deveriam ser atômicas
 * (ex.: copy-on-write de versão) realmente fazem rollback completo em vez de
 * deixar um estado parcial.
 */
export function wrapWithRunFailureAfter(client: SQLiteClient, callsBeforeFailure: number): SQLiteClient {
  let calls = 0;
  return {
    ...client,
    async runAsync(sql, params) {
      calls += 1;
      if (calls > callsBeforeFailure) {
        throw new Error('Falha simulada de escrita (teste).');
      }
      return client.runAsync(sql, params);
    },
  };
}
