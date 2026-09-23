import { migration001Up } from './migrations/001_initial';
import { migration002Up } from './migrations/002_workout_day_description';
import { migration003Up } from './migrations/003_plan_versioning';
import { migration004Up } from './migrations/004_workout_day_weekdays';
import { migration005Up } from './migrations/005_exercise_taxonomy';
import { migration006Up } from './migrations/006_session_prescription_snapshot';
import { migration007Up } from './migrations/007_app_preferences';
import type { SQLiteClient } from './sqliteClient';

interface Migration {
  version: number;
  up: string;
}

// Migrations somam uma entrada aqui, nunca editam as anteriores — mesmo
// quando o conteúdo de uma migration específica é estrutural (ver 003).
// `PRAGMA user_version` guarda o progresso.
const migrations: Migration[] = [
  { version: 1, up: migration001Up },
  { version: 2, up: migration002Up },
  { version: 3, up: migration003Up },
  { version: 4, up: migration004Up },
  { version: 5, up: migration005Up },
  { version: 6, up: migration006Up },
  { version: 7, up: migration007Up },
];

export const CURRENT_SCHEMA_VERSION = migrations[migrations.length - 1].version;

export async function runMigrations(client: SQLiteClient): Promise<void> {
  const row = await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = row?.user_version ?? 0;

  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    // Cada migration (DDL + eventual backfill de dados) roda atômica: se
    // qualquer statement falhar, nem o schema nem o PRAGMA user_version
    // avançam — a próxima tentativa reencontra o banco no estado anterior.
    await client.withTransactionAsync(async () => {
      await client.execAsync(migration.up);
      await client.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}
