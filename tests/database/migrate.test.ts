import { CURRENT_SCHEMA_VERSION, runMigrations } from '@/database/migrate';
import { createNodeSqliteClient } from '../support/nodeSqliteClient';

describe('runMigrations', () => {
  it('cria as tabelas do schema e avança o user_version', async () => {
    const client = createNodeSqliteClient();
    await runMigrations(client);

    const version = await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(version?.user_version).toBe(CURRENT_SCHEMA_VERSION);

    const tables = await client.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'exercises',
        'workout_plans',
        'workout_days',
        'prescribed_exercises',
        'prescribed_sets',
        'workout_sessions',
        'performed_exercises',
        'performed_sets',
      ])
    );
  });

  it('é seguro rodar duas vezes (idempotente)', async () => {
    const client = createNodeSqliteClient();
    await runMigrations(client);
    await expect(runMigrations(client)).resolves.not.toThrow();

    const version = await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(version?.user_version).toBe(CURRENT_SCHEMA_VERSION);
  });
});
