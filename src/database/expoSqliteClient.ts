import type { SQLiteDatabase } from 'expo-sqlite';

import type { SQLiteClient } from './sqliteClient';

export function createExpoSqliteClient(db: SQLiteDatabase): SQLiteClient {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params = []) => db.runAsync(sql, params as (string | number | null)[]),
    getFirstAsync: (sql, params = []) => db.getFirstAsync(sql, params as (string | number | null)[]),
    getAllAsync: (sql, params = []) => db.getAllAsync(sql, params as (string | number | null)[]),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
    closeAsync: () => db.closeAsync(),
  };
}
