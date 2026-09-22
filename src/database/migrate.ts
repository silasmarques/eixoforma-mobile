import { migration001Up } from './migrations/001_initial';
import type { SQLiteClient } from './sqliteClient';

interface Migration {
  version: number;
  up: string;
}

// Migrations são somente-adição: uma nova versão do schema soma uma entrada
// aqui, nunca edita as anteriores. `PRAGMA user_version` guarda o progresso.
const migrations: Migration[] = [{ version: 1, up: migration001Up }];

export const CURRENT_SCHEMA_VERSION = migrations[migrations.length - 1].version;

export async function runMigrations(client: SQLiteClient): Promise<void> {
  const row = await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = row?.user_version ?? 0;

  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await client.execAsync(migration.up);
    await client.execAsync(`PRAGMA user_version = ${migration.version};`);
  }
}
