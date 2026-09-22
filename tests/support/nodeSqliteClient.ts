import { DatabaseSync } from 'node:sqlite';

import type { SQLiteBindValue, SQLiteClient } from '@/database/sqliteClient';

/**
 * Adapter de teste: implementa o mesmo `SQLiteClient` que a app usa em
 * produção (expoSqliteClient.ts), mas sobre `node:sqlite` — um motor SQLite
 * real embutido no Node, não uma reimplementação em JS das regras de SQL.
 * Migrations e seeds rodam com o SQL literal de produção.
 */
export function createNodeSqliteClient(path: string = ':memory:'): SQLiteClient {
  const db = new DatabaseSync(path);

  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params: readonly SQLiteBindValue[] = []) {
      const result = db.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getFirstAsync<T>(sql: string, params: readonly SQLiteBindValue[] = []) {
      const row = db.prepare(sql).get(...(params as never[]));
      return (row ?? null) as T | null;
    },
    async getAllAsync<T>(sql: string, params: readonly SQLiteBindValue[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() {
      db.close();
    },
  };
}
