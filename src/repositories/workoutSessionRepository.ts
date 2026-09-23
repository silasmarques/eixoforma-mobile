import { buildPrescriptionSnapshot } from '@/domain/buildPrescriptionSnapshot';
import { InvalidPrescriptionSnapshotError, parsePrescriptionSnapshot } from '@/domain/parsePrescriptionSnapshot';
import type { PrescriptionSnapshot } from '@/domain/prescriptionSnapshot';
import { generateId } from '@/utils/id';
import type {
  PerformedExercise,
  PerformedExerciseStatus,
  PerformedSet,
  PerformedSetStatus,
  WorkoutSession,
  WorkoutSessionStatus,
  WorkoutSessionSummary,
} from '@/domain/workoutSession';
import type { SQLiteClient } from '@/database/sqliteClient';
import { getAllExercises } from './exerciseRepository';
import { getWorkoutDayById } from './workoutPlanRepository';

export class DuplicateActiveSessionError extends Error {
  constructor() {
    super('Já existe uma sessão de treino em andamento.');
    this.name = 'DuplicateActiveSessionError';
  }
}

interface SessionRow {
  id: string;
  plan_id: string;
  plan_version_id: string;
  day_id: string;
  prescription_snapshot: string;
  status: string;
  started_at: string;
  completed_at: string | null;
}

interface PerformedExerciseRow {
  id: string;
  session_id: string;
  prescribed_exercise_id: string;
  order: number;
  status: string;
}

interface PerformedSetRow {
  id: string;
  performed_exercise_id: string;
  prescribed_set_id: string;
  reps: number | null;
  load_kg: number | null;
  completed_at: string | null;
  status: string;
  note: string | null;
}

/**
 * Sessões criadas antes do Mobile 1.3 têm `prescription_snapshot = '{}'`
 * (default do backfill da migration 006) — nunca existiu um snapshot de
 * verdade para elas. Tratamos isso como ausência de dado (null), não como
 * erro: a UI mostra o que tem (performed_sets) sem o enriquecimento do
 * snapshot para esse recorte legado.
 */
function parsePrescriptionSnapshotSafe(raw: string): PrescriptionSnapshot | null {
  try {
    return parsePrescriptionSnapshot(raw);
  } catch (error) {
    if (error instanceof InvalidPrescriptionSnapshotError) return null;
    throw error;
  }
}

function toPerformedSet(row: PerformedSetRow): PerformedSet {
  return {
    id: row.id,
    performedExerciseId: row.performed_exercise_id,
    prescribedSetId: row.prescribed_set_id,
    reps: row.reps,
    loadKg: row.load_kg,
    completedAt: row.completed_at,
    status: row.status as PerformedSetStatus,
    note: row.note,
  };
}

function toSummary(row: SessionRow & { day_name: string }): WorkoutSessionSummary {
  return {
    id: row.id,
    planId: row.plan_id,
    planVersionId: row.plan_version_id,
    dayId: row.day_id,
    dayName: row.day_name,
    status: row.status as WorkoutSessionStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/**
 * Cria a sessão a partir de uma versão `active` já resolvida pelo service
 * (esta função não decide qual versão usar — recebe planVersionId pronto),
 * congela o prescriptionSnapshot e já materializa performed_exercises/
 * performed_sets "pending" espelhando a prescrição do dia.
 */
export async function createSession(
  client: SQLiteClient,
  params: { planId: string; planVersionId: string; dayId: string }
): Promise<WorkoutSession> {
  const active = await findActiveSession(client);
  if (active) {
    throw new DuplicateActiveSessionError();
  }

  const day = await getWorkoutDayById(client, params.dayId);
  if (!day) {
    throw new Error(`Dia de treino não encontrado: ${params.dayId}`);
  }
  if (day.planVersionId !== params.planVersionId) {
    throw new Error(`Dia ${params.dayId} não pertence à versão ${params.planVersionId}.`);
  }

  const exercises = await getAllExercises(client);
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const snapshot = buildPrescriptionSnapshot(day, exercisesById);

  const sessionId = generateId('session');
  const startedAt = new Date().toISOString();

  try {
    await client.withTransactionAsync(async () => {
      await client.runAsync(
        `INSERT INTO workout_sessions
          (id, plan_id, plan_version_id, day_id, prescription_snapshot, status, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL);`,
        [
          sessionId,
          params.planId,
          params.planVersionId,
          params.dayId,
          JSON.stringify(snapshot),
          'in_progress',
          startedAt,
        ]
      );

      for (const prescribedExercise of day.exercises) {
        const performedExerciseId = generateId('pfex');
        await client.runAsync(
          'INSERT INTO performed_exercises (id, session_id, prescribed_exercise_id, "order", status) VALUES (?, ?, ?, ?, ?);',
          [performedExerciseId, sessionId, prescribedExercise.id, prescribedExercise.order, 'pending']
        );

        for (const prescribedSet of prescribedExercise.sets) {
          await client.runAsync(
            'INSERT INTO performed_sets (id, performed_exercise_id, prescribed_set_id, reps, load_kg, completed_at, status, note) VALUES (?, ?, ?, NULL, NULL, NULL, ?, NULL);',
            [generateId('pfset'), performedExerciseId, prescribedSet.id, 'pending']
          );
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      throw new DuplicateActiveSessionError();
    }
    throw error;
  }

  const session = await getSessionById(client, sessionId);
  if (!session) {
    throw new Error('Falha ao criar sessão de treino.');
  }
  return session;
}

export async function findActiveSession(client: SQLiteClient): Promise<WorkoutSessionSummary | null> {
  const row = await client.getFirstAsync<SessionRow & { day_name: string }>(
    `SELECT s.*, d.name as day_name
     FROM workout_sessions s
     JOIN workout_days d ON d.id = s.day_id
     WHERE s.status = 'in_progress'
     LIMIT 1;`
  );
  return row ? toSummary(row) : null;
}

export async function getSessionHistory(client: SQLiteClient): Promise<WorkoutSessionSummary[]> {
  const rows = await client.getAllAsync<SessionRow & { day_name: string }>(
    `SELECT s.*, d.name as day_name
     FROM workout_sessions s
     JOIN workout_days d ON d.id = s.day_id
     WHERE s.status != 'in_progress'
     ORDER BY s.started_at DESC;`
  );
  return rows.map(toSummary);
}

export async function getSessionById(
  client: SQLiteClient,
  sessionId: string
): Promise<WorkoutSession | null> {
  const sessionRow = await client.getFirstAsync<SessionRow>(
    'SELECT * FROM workout_sessions WHERE id = ?;',
    [sessionId]
  );
  if (!sessionRow) return null;

  const exerciseRows = await client.getAllAsync<PerformedExerciseRow>(
    'SELECT * FROM performed_exercises WHERE session_id = ? ORDER BY "order";',
    [sessionId]
  );

  const exercises: PerformedExercise[] = [];
  for (const exerciseRow of exerciseRows) {
    const setRows = await client.getAllAsync<PerformedSetRow>(
      'SELECT * FROM performed_sets WHERE performed_exercise_id = ?;',
      [exerciseRow.id]
    );
    exercises.push({
      id: exerciseRow.id,
      sessionId: exerciseRow.session_id,
      prescribedExerciseId: exerciseRow.prescribed_exercise_id,
      order: exerciseRow.order,
      status: exerciseRow.status as PerformedExerciseStatus,
      sets: setRows.map(toPerformedSet),
    });
  }

  return {
    id: sessionRow.id,
    planId: sessionRow.plan_id,
    planVersionId: sessionRow.plan_version_id,
    dayId: sessionRow.day_id,
    prescriptionSnapshot: parsePrescriptionSnapshotSafe(sessionRow.prescription_snapshot),
    status: sessionRow.status as WorkoutSessionStatus,
    startedAt: sessionRow.started_at,
    completedAt: sessionRow.completed_at,
    exercises,
  };
}

export async function completeSession(client: SQLiteClient, sessionId: string): Promise<void> {
  await client.runAsync(
    "UPDATE workout_sessions SET status = 'completed', completed_at = ? WHERE id = ?;",
    [new Date().toISOString(), sessionId]
  );
}

export async function abandonSession(client: SQLiteClient, sessionId: string): Promise<void> {
  await client.runAsync(
    "UPDATE workout_sessions SET status = 'abandoned', completed_at = ? WHERE id = ?;",
    [new Date().toISOString(), sessionId]
  );
}

export async function recordPerformedSet(
  client: SQLiteClient,
  params: { performedSetId: string; reps: number; loadKg: number | null; note?: string | null }
): Promise<void> {
  await client.runAsync(
    "UPDATE performed_sets SET reps = ?, load_kg = ?, status = 'completed', completed_at = ?, note = ? WHERE id = ?;",
    [params.reps, params.loadKg, new Date().toISOString(), params.note ?? null, params.performedSetId]
  );
}
