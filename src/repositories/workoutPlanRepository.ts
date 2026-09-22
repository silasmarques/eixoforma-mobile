import type {
  PrescribedExercise,
  PrescribedSet,
  WorkoutDay,
  WorkoutDaySummary,
  WorkoutPlan,
} from '@/domain/workoutPlan';
import type { Technique } from '@/domain/technique';
import type { SQLiteClient } from '@/database/sqliteClient';

interface PlanRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface DayRow {
  id: string;
  plan_id: string;
  order: number;
  name: string;
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

function toSet(row: PrescribedSetRow): PrescribedSet {
  return {
    id: row.id,
    order: row.order,
    targetReps: row.target_reps,
    repRangeMin: row.rep_range_min,
    repRangeMax: row.rep_range_max,
    targetLoadKg: row.target_load_kg,
    restSeconds: row.rest_seconds,
    technique: row.technique as Technique,
    note: row.note,
  };
}

/** Retorna o único plano ativo do protótipo, ou null se ainda não houver dados. */
export async function getActivePlanSummary(
  client: SQLiteClient
): Promise<Pick<WorkoutPlan, 'id' | 'name' | 'createdAt' | 'updatedAt'> | null> {
  const row = await client.getFirstAsync<PlanRow>(
    'SELECT * FROM workout_plans ORDER BY created_at LIMIT 1;'
  );
  if (!row) return null;
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function getWorkoutDaySummaries(client: SQLiteClient): Promise<WorkoutDaySummary[]> {
  const rows = await client.getAllAsync<DayRow & { exercise_count: number }>(
    `SELECT d.*, COUNT(pe.id) as exercise_count
     FROM workout_days d
     LEFT JOIN prescribed_exercises pe ON pe.day_id = d.id
     GROUP BY d.id
     ORDER BY d."order";`
  );

  return rows.map((row) => ({
    id: row.id,
    planId: row.plan_id,
    order: row.order,
    name: row.name,
    muscleGroups: JSON.parse(row.muscle_groups) as string[],
    exerciseCount: row.exercise_count,
  }));
}

export async function getWorkoutDayById(
  client: SQLiteClient,
  dayId: string
): Promise<WorkoutDay | null> {
  const dayRow = await client.getFirstAsync<DayRow>('SELECT * FROM workout_days WHERE id = ?;', [
    dayId,
  ]);
  if (!dayRow) return null;

  const exerciseRows = await client.getAllAsync<PrescribedExerciseRow>(
    'SELECT * FROM prescribed_exercises WHERE day_id = ? ORDER BY "order";',
    [dayId]
  );

  const exercises: PrescribedExercise[] = [];
  for (const exerciseRow of exerciseRows) {
    const setRows = await client.getAllAsync<PrescribedSetRow>(
      'SELECT * FROM prescribed_sets WHERE prescribed_exercise_id = ? ORDER BY "order";',
      [exerciseRow.id]
    );
    exercises.push({
      id: exerciseRow.id,
      exerciseId: exerciseRow.exercise_id,
      order: exerciseRow.order,
      coachNote: exerciseRow.coach_note,
      sets: setRows.map(toSet),
    });
  }

  return {
    id: dayRow.id,
    planId: dayRow.plan_id,
    order: dayRow.order,
    name: dayRow.name,
    muscleGroups: JSON.parse(dayRow.muscle_groups) as string[],
    exercises,
  };
}
