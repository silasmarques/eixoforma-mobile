import { generateId } from '@/utils/id';
import type { WorkoutPlanVersion, WorkoutPlanVersionStatus } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';

interface VersionRow {
  id: string;
  plan_id: string;
  version_number: number;
  status: string;
  created_at: string;
  activated_at: string | null;
}

interface DayRow {
  id: string;
  plan_version_id: string;
  order: number;
  name: string;
  description: string;
  muscle_groups: string;
}

interface PrescribedExerciseRow {
  id: string;
  day_id: string;
  exercise_id: string;
  order: number;
  coach_note: string | null;
}

interface PrescribedSetRow {
  id: string;
  prescribed_exercise_id: string;
  order: number;
  target_reps: number | null;
  rep_range_min: number | null;
  rep_range_max: number | null;
  target_load_kg: number | null;
  rest_seconds: number;
  technique: string;
  note: string | null;
}

function toVersion(row: VersionRow): WorkoutPlanVersion {
  return {
    id: row.id,
    planId: row.plan_id,
    versionNumber: row.version_number,
    status: row.status as WorkoutPlanVersionStatus,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
  };
}

export async function getVersionById(
  client: SQLiteClient,
  versionId: string
): Promise<WorkoutPlanVersion | null> {
  const row = await client.getFirstAsync<VersionRow>(
    'SELECT * FROM workout_plan_versions WHERE id = ?;',
    [versionId]
  );
  return row ? toVersion(row) : null;
}

/** No máximo uma linha por (planId, status) — garantido pelos índices únicos parciais do schema. */
export async function getVersionByStatus(
  client: SQLiteClient,
  planId: string,
  status: WorkoutPlanVersionStatus
): Promise<WorkoutPlanVersion | null> {
  const row = await client.getFirstAsync<VersionRow>(
    'SELECT * FROM workout_plan_versions WHERE plan_id = ? AND status = ?;',
    [planId, status]
  );
  return row ? toVersion(row) : null;
}

export async function listVersionsByPlan(
  client: SQLiteClient,
  planId: string
): Promise<WorkoutPlanVersion[]> {
  const rows = await client.getAllAsync<VersionRow>(
    'SELECT * FROM workout_plan_versions WHERE plan_id = ? ORDER BY version_number;',
    [planId]
  );
  return rows.map(toVersion);
}

/** Só a linha da versão — usada pelo createPlan do service para a versão 1 (draft, sem árvore ainda). */
export async function createInitialVersion(
  client: SQLiteClient,
  planId: string
): Promise<WorkoutPlanVersion> {
  const version: WorkoutPlanVersion = {
    id: generateId('planver'),
    planId,
    versionNumber: 1,
    status: 'draft',
    createdAt: new Date().toISOString(),
    activatedAt: null,
  };
  await client.runAsync(
    'INSERT INTO workout_plan_versions (id, plan_id, version_number, status, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?);',
    [version.id, version.planId, version.versionNumber, version.status, version.createdAt, null]
  );
  return version;
}

async function copyVersionTree(
  client: SQLiteClient,
  fromVersionId: string,
  toVersionId: string
): Promise<void> {
  const dayRows = await client.getAllAsync<DayRow>(
    'SELECT * FROM workout_days WHERE plan_version_id = ? ORDER BY "order";',
    [fromVersionId]
  );

  for (const dayRow of dayRows) {
    const newDayId = generateId('day');
    await client.runAsync(
      // plan_id (coluna legada) resolvido via subquery — só para satisfazer a
      // constraint NOT NULL original; nenhuma leitura nova depende dela.
      `INSERT INTO workout_days (id, plan_id, plan_version_id, "order", name, description, muscle_groups)
       VALUES (?, (SELECT plan_id FROM workout_plan_versions WHERE id = ?), ?, ?, ?, ?, ?);`,
      [newDayId, toVersionId, toVersionId, dayRow.order, dayRow.name, dayRow.description, dayRow.muscle_groups]
    );

    const weekdayRows = await client.getAllAsync<{ weekday: number }>(
      'SELECT weekday FROM workout_day_weekdays WHERE day_id = ?;',
      [dayRow.id]
    );
    for (const weekdayRow of weekdayRows) {
      await client.runAsync('INSERT INTO workout_day_weekdays (day_id, weekday) VALUES (?, ?);', [
        newDayId,
        weekdayRow.weekday,
      ]);
    }

    const exerciseRows = await client.getAllAsync<PrescribedExerciseRow>(
      'SELECT * FROM prescribed_exercises WHERE day_id = ? ORDER BY "order";',
      [dayRow.id]
    );
    for (const exerciseRow of exerciseRows) {
      const newExerciseId = generateId('pex');
      await client.runAsync(
        'INSERT INTO prescribed_exercises (id, day_id, exercise_id, "order", coach_note) VALUES (?, ?, ?, ?, ?);',
        [newExerciseId, newDayId, exerciseRow.exercise_id, exerciseRow.order, exerciseRow.coach_note]
      );

      const setRows = await client.getAllAsync<PrescribedSetRow>(
        'SELECT * FROM prescribed_sets WHERE prescribed_exercise_id = ? ORDER BY "order";',
        [exerciseRow.id]
      );
      for (const setRow of setRows) {
        await client.runAsync(
          `INSERT INTO prescribed_sets
            (id, prescribed_exercise_id, "order", target_reps, rep_range_min, rep_range_max, target_load_kg, rest_seconds, technique, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            generateId('pset'),
            newExerciseId,
            setRow.order,
            setRow.target_reps,
            setRow.rep_range_min,
            setRow.rep_range_max,
            setRow.target_load_kg,
            setRow.rest_seconds,
            setRow.technique,
            setRow.note,
          ]
        );
      }
    }
  }
}

/**
 * Cria um draft novo copiando a árvore inteira de `sourceVersionId`, com ids
 * regenerados em cada nível. Atômico: se qualquer INSERT falhar no meio da
 * cópia, nada é persistido — nem a linha da versão nova, nem nenhum dia,
 * exercício ou série parcialmente copiados.
 */
export async function createDraftFromVersion(
  client: SQLiteClient,
  sourceVersionId: string
): Promise<WorkoutPlanVersion> {
  const source = await getVersionById(client, sourceVersionId);
  if (!source) {
    throw new Error(`Versão de origem não encontrada: ${sourceVersionId}`);
  }

  const draft: WorkoutPlanVersion = {
    id: generateId('planver'),
    planId: source.planId,
    versionNumber: source.versionNumber + 1,
    status: 'draft',
    createdAt: new Date().toISOString(),
    activatedAt: null,
  };

  await client.withTransactionAsync(async () => {
    await client.runAsync(
      'INSERT INTO workout_plan_versions (id, plan_id, version_number, status, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?);',
      [draft.id, draft.planId, draft.versionNumber, draft.status, draft.createdAt, null]
    );
    await copyVersionTree(client, sourceVersionId, draft.id);
  });

  return draft;
}

/**
 * Apaga a árvore inteira de uma versão (weekdays, séries, exercícios, dias)
 * e a própria linha da versão, atomicamente. Puramente mecânico — quem
 * decide SE isso pode acontecer (só draft, plano personal, active já
 * existe) é `planService.discardDraft`.
 */
export async function discardDraftVersion(client: SQLiteClient, versionId: string): Promise<void> {
  await client.withTransactionAsync(async () => {
    const dayRows = await client.getAllAsync<{ id: string }>(
      'SELECT id FROM workout_days WHERE plan_version_id = ?;',
      [versionId]
    );
    for (const dayRow of dayRows) {
      const exerciseRows = await client.getAllAsync<{ id: string }>(
        'SELECT id FROM prescribed_exercises WHERE day_id = ?;',
        [dayRow.id]
      );
      for (const exerciseRow of exerciseRows) {
        await client.runAsync('DELETE FROM prescribed_sets WHERE prescribed_exercise_id = ?;', [
          exerciseRow.id,
        ]);
      }
      await client.runAsync('DELETE FROM prescribed_exercises WHERE day_id = ?;', [dayRow.id]);
      await client.runAsync('DELETE FROM workout_day_weekdays WHERE day_id = ?;', [dayRow.id]);
      await client.runAsync('DELETE FROM workout_days WHERE id = ?;', [dayRow.id]);
    }
    await client.runAsync('DELETE FROM workout_plan_versions WHERE id = ?;', [versionId]);
  });
}

export async function activateVersion(client: SQLiteClient, versionId: string): Promise<void> {
  await client.runAsync(
    "UPDATE workout_plan_versions SET status = 'active', activated_at = ? WHERE id = ?;",
    [new Date().toISOString(), versionId]
  );
}

export async function supersedeVersion(client: SQLiteClient, versionId: string): Promise<void> {
  await client.runAsync("UPDATE workout_plan_versions SET status = 'superseded' WHERE id = ?;", [
    versionId,
  ]);
}

export async function hasSessions(client: SQLiteClient, versionId: string): Promise<boolean> {
  const row = await client.getFirstAsync<{ found: number }>(
    'SELECT 1 as found FROM workout_sessions WHERE plan_version_id = ? LIMIT 1;',
    [versionId]
  );
  return row !== null;
}

export interface VersionStructuralCheck {
  valid: boolean;
  reason: string | null;
}

/**
 * Validação estrutural mínima antes de ativar — não é regra clínica/de
 * treino, só garante que a versão tem o que uma sessão precisa pra existir.
 */
export async function checkStructuralCompleteness(
  client: SQLiteClient,
  versionId: string
): Promise<VersionStructuralCheck> {
  const days = await client.getAllAsync<{ id: string }>(
    'SELECT id FROM workout_days WHERE plan_version_id = ?;',
    [versionId]
  );
  if (days.length === 0) {
    return { valid: false, reason: 'A versão não tem nenhum dia de treino.' };
  }

  for (const day of days) {
    const exercises = await client.getAllAsync<{ id: string }>(
      'SELECT id FROM prescribed_exercises WHERE day_id = ?;',
      [day.id]
    );
    if (exercises.length === 0) {
      return { valid: false, reason: `O dia ${day.id} não tem nenhum exercício.` };
    }
    for (const exercise of exercises) {
      const sets = await client.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM prescribed_sets WHERE prescribed_exercise_id = ?;',
        [exercise.id]
      );
      if (!sets || sets.count === 0) {
        return { valid: false, reason: `O exercício ${exercise.id} não tem nenhuma série.` };
      }
    }
  }

  return { valid: true, reason: null };
}
