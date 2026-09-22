import { runMigrations } from '@/database/migrate';
import type { SQLiteClient } from '@/database/sqliteClient';
import { seedDemoData } from '@/mocks/seedDemoData';
import { createNodeSqliteClient } from './nodeSqliteClient';

export async function setupTestDatabase(
  options: { seeded?: boolean; path?: string } = {}
): Promise<SQLiteClient> {
  const client = createNodeSqliteClient(options.path);
  await client.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(client);
  if (options.seeded !== false) {
    await seedDemoData(client);
  }
  return client;
}
