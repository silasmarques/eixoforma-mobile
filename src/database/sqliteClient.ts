export type SQLiteBindValue = string | number | null;

export interface SQLiteRunResult {
  lastInsertRowId: number;
  changes: number;
}

/**
 * Narrow port over the subset of expo-sqlite's async API the repositories use.
 * Kept separate from expo-sqlite so repository/migration logic can run against
 * a real SQLite engine in Jest (tests/support/nodeSqliteClient.ts), since
 * expo-sqlite has no native binding outside the app runtime.
 */
export interface SQLiteClient {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: readonly SQLiteBindValue[]): Promise<SQLiteRunResult>;
  getFirstAsync<T>(sql: string, params?: readonly SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: readonly SQLiteBindValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}
