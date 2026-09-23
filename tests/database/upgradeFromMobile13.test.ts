import { migration001Up } from '@/database/migrations/001_initial';
import { migration002Up } from '@/database/migrations/002_workout_day_description';
import { migration003Up } from '@/database/migrations/003_plan_versioning';
import { migration004Up } from '@/database/migrations/004_workout_day_weekdays';
import { migration005Up } from '@/database/migrations/005_exercise_taxonomy';
import { migration006Up } from '@/database/migrations/006_session_prescription_snapshot';
import { migration007Up } from '@/database/migrations/007_app_preferences';
import { runMigrations } from '@/database/migrate';
import { getPlanById } from '@/repositories/planRepository';
import { PLAN_ID } from '@/mocks/workoutPlanSeed';
import { createNodeSqliteClient } from '../support/nodeSqliteClient';
import type { SQLiteClient } from '@/database/sqliteClient';

const PLAN_VERSION_ID = `${PLAN_ID}_v1`;

/**
 * Reproduz exatamente o schema E os dados de um device que só rodou até o
 * Mobile 1.3 (migration 007) — sem a coluna `goal`, que só existe a partir
 * da 008. Não usa o `seedDemoData` atual (ele já assume `goal`).
 */
async function seedMobile13State(client: SQLiteClient): Promise<void> {
  await client.execAsync('PRAGMA foreign_keys = ON;');
  for (const migration of [
    migration001Up,
    migration002Up,
    migration003Up,
    migration004Up,
    migration005Up,
    migration006Up,
    migration007Up,
  ]) {
    await client.execAsync(migration);
  }
  await client.execAsync('PRAGMA user_version = 7;');

  const now = new Date().toISOString();
  await client.runAsync(
    'INSERT INTO workout_plans (id, name, origin, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?);',
    [PLAN_ID, 'Plano do Mobile 1.3', 'prescribed', now, now]
  );
  await client.runAsync(
    'INSERT INTO workout_plan_versions (id, plan_id, version_number, status, created_at, activated_at) VALUES (?, ?, 1, ?, ?, ?);',
    [PLAN_VERSION_ID, PLAN_ID, 'active', now, now]
  );
}

describe('upgrade de um banco do Mobile 1.3 (schema v7) para o Mobile 1.4 (v8)', () => {
  it('aplica só a migration 008 e preserva o plano já existente', async () => {
    const client = createNodeSqliteClient();
    await seedMobile13State(client);

    const beforeVersion = await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(beforeVersion?.user_version).toBe(7);

    await runMigrations(client);

    const afterVersion = await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(afterVersion?.user_version).toBe(8);

    const plan = await getPlanById(client, PLAN_ID);
    expect(plan).not.toBeNull();
    expect(plan?.goal).toBeNull(); // coluna nova, sem valor pra dado pré-existente — nullable, não quebra nada
  });

  it('é idempotente sobre um banco já no v8', async () => {
    const client = createNodeSqliteClient();
    await seedMobile13State(client);
    await runMigrations(client);
    await expect(runMigrations(client)).resolves.not.toThrow();
  });

  it('não deixa violação de integridade referencial depois do upgrade', async () => {
    const client = createNodeSqliteClient();
    await seedMobile13State(client);
    await runMigrations(client);

    const violations = await client.getAllAsync('PRAGMA foreign_key_check;');
    expect(violations).toEqual([]);
  });
});
