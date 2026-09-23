import { migration001Up } from '@/database/migrations/001_initial';
import { migration002Up } from '@/database/migrations/002_workout_day_description';
import { runMigrations } from '@/database/migrate';
import { getWorkoutDayById } from '@/repositories/workoutPlanRepository';
import { getExerciseById } from '@/repositories/exerciseRepository';
import { getSessionById } from '@/repositories/workoutSessionRepository';
import { createNodeSqliteClient } from '../support/nodeSqliteClient';
import type { SQLiteClient } from '@/database/sqliteClient';

/**
 * Simula um banco real de dispositivo que rodou o Mobile 1.1/1.2 (schema até
 * a migration 002 — sem plan_version, sem taxonomia fechada, sem
 * prescription_snapshot) e confirma que migrar para o schema do 1.3
 * preserva os dados existentes corretamente.
 */
async function seedLegacyMobile12Data(client: SQLiteClient): Promise<void> {
  await client.execAsync('PRAGMA foreign_keys = ON;');
  // Só até a migration 002 — reproduz exatamente o schema de um device 1.2 real.
  await client.execAsync(migration001Up);
  await client.execAsync(migration002Up);
  await client.execAsync('PRAGMA user_version = 2;');

  await client.runAsync(
    `INSERT INTO exercises
      (id, name, primary_muscle_group, secondary_muscle_groups, equipment, image_placeholder, instruction, coach_note)
     VALUES ('ex_supino_reto_barra', 'Supino reto com barra', 'Peito', '["Tríceps","Ombros"]', 'Barra', 'peito', 'Desça a barra.', NULL);`
  );

  await client.runAsync(
    "INSERT INTO workout_plans (id, name, created_at, updated_at) VALUES ('plan_eixoforma_demo', 'Plano legado', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');"
  );

  await client.runAsync(
    `INSERT INTO workout_days (id, plan_id, "order", name, description, muscle_groups)
     VALUES ('day_treino_a', 'plan_eixoforma_demo', 1, 'Treino A', 'Empurrar', '["Peito","Ombros","Tríceps"]');`
  );

  await client.runAsync(
    `INSERT INTO prescribed_exercises (id, day_id, exercise_id, "order", coach_note)
     VALUES ('pex_a_supino_reto', 'day_treino_a', 'ex_supino_reto_barra', 1, NULL);`
  );

  await client.runAsync(
    `INSERT INTO prescribed_sets
       (id, prescribed_exercise_id, "order", target_reps, rep_range_min, rep_range_max, target_load_kg, rest_seconds, technique, note)
     VALUES ('pset_a_1', 'pex_a_supino_reto', 1, 10, NULL, NULL, 40, 90, 'normal', NULL);`
  );

  await client.runAsync(
    `INSERT INTO workout_sessions (id, plan_id, day_id, status, started_at, completed_at)
     VALUES ('session_legado_1', 'plan_eixoforma_demo', 'day_treino_a', 'completed', '2026-02-01T10:00:00.000Z', '2026-02-01T11:00:00.000Z');`
  );

  await client.runAsync(
    `INSERT INTO performed_exercises (id, session_id, prescribed_exercise_id, "order", status)
     VALUES ('pfex_legado_1', 'session_legado_1', 'pex_a_supino_reto', 1, 'completed');`
  );

  await client.runAsync(
    `INSERT INTO performed_sets (id, performed_exercise_id, prescribed_set_id, reps, load_kg, completed_at, status, note)
     VALUES ('pfset_legado_1', 'pfex_legado_1', 'pset_a_1', 10, 42.5, '2026-02-01T10:05:00.000Z', 'completed', NULL);`
  );
}

describe('upgrade de um banco real do Mobile 1.2 para o Mobile 1.3', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = createNodeSqliteClient();
    await seedLegacyMobile12Data(client);
  });

  it('preserva os ids de dias, exercícios prescritos, séries e sessões', async () => {
    await runMigrations(client);

    const day = await getWorkoutDayById(client, 'day_treino_a');
    expect(day).not.toBeNull();
    expect(day!.id).toBe('day_treino_a');
    expect(day!.exercises[0].id).toBe('pex_a_supino_reto');
    expect(day!.exercises[0].sets[0].id).toBe('pset_a_1');

    const session = await getSessionById(client, 'session_legado_1');
    expect(session).not.toBeNull();
    expect(session!.exercises[0].id).toBe('pfex_legado_1');
    expect(session!.exercises[0].sets[0].id).toBe('pfset_legado_1');
    expect(session!.exercises[0].sets[0].reps).toBe(10);
    expect(session!.exercises[0].sets[0].loadKg).toBe(42.5);
  });

  it('cria a versão 1 (active) para o plano legado e aponta o dia para ela', async () => {
    await runMigrations(client);

    const version = await client.getFirstAsync<{ id: string; status: string }>(
      "SELECT id, status FROM workout_plan_versions WHERE plan_id = 'plan_eixoforma_demo';"
    );
    expect(version?.status).toBe('active');

    const day = await client.getFirstAsync<{ plan_version_id: string }>(
      "SELECT plan_version_id FROM workout_days WHERE id = 'day_treino_a';"
    );
    expect(day?.plan_version_id).toBe(version?.id);
  });

  it('a sessão legada ganha plan_version_id; sem snapshot reconstruível, prescriptionSnapshot é null (não quebra a leitura)', async () => {
    await runMigrations(client);

    const session = await getSessionById(client, 'session_legado_1');
    expect(session?.planVersionId).toBeTruthy();
    expect(session?.prescriptionSnapshot).toBeNull();
    // performed_sets continuam legíveis normalmente — só o enriquecimento do
    // snapshot é que não existe para sessões anteriores ao Mobile 1.3.
    expect(session?.exercises[0].sets[0].reps).toBe(10);
  });

  it('corrige a taxonomia do exercício conhecido (pt-BR solto → chave fechada)', async () => {
    await runMigrations(client);

    const exercise = await getExerciseById(client, 'ex_supino_reto_barra');
    expect(exercise?.primaryMuscleGroup).toBe('chest');
    expect(exercise?.secondaryMuscleGroups).toEqual(['triceps', 'shoulders']);
    expect(exercise?.equipment).toBe('barbell');
    expect(exercise?.category).toBe('strength');
  });

  it('não deixa nenhuma violação de integridade referencial depois da migração', async () => {
    await runMigrations(client);

    const violations = await client.getAllAsync('PRAGMA foreign_key_check;');
    expect(violations).toEqual([]);
  });

  it('é idempotente — rodar de novo sobre o banco já migrado não falha nem duplica', async () => {
    await runMigrations(client);
    await expect(runMigrations(client)).resolves.not.toThrow();

    const versions = await client.getAllAsync(
      "SELECT * FROM workout_plan_versions WHERE plan_id = 'plan_eixoforma_demo';"
    );
    expect(versions).toHaveLength(1);
  });
});
