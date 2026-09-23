import { generateId } from '@/utils/id';
import type {
  PrescribedExercise,
  PrescribedSet,
  WorkoutDay,
  WorkoutDaySummary,
} from '@/domain/workoutPlan';
import type { Exercise } from '@/domain/exercise';
import type { MuscleGroup } from '@/domain/muscleGroup';
import { ReorderValidationError } from '@/domain/prescriptionErrors';
import type { Technique } from '@/domain/technique';
import type { SQLiteClient } from '@/database/sqliteClient';
import { getExerciseById } from './exerciseRepository';

const SECONDS_PER_SET_ESTIMATE = 40;

interface DayRow {
  id: string;
  plan_id: string;
  plan_version_id: string;
  order: number;
  name: string;
  description: string;
  muscle_groups: string;
}

interface DaySummaryRow extends DayRow {
  exercise_count: number;
  total_rest_seconds: number;
  total_sets: number;
  last_performed_at: string | null;
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

function toPrescribedExercise(row: PrescribedExerciseRow, sets: PrescribedSetRow[]): PrescribedExercise {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    order: row.order,
    coachNote: row.coach_note,
    sets: sets.map(toSet),
  };
}

async function getWeekdaysForDay(client: SQLiteClient, dayId: string): Promise<number[]> {
  const rows = await client.getAllAsync<{ weekday: number }>(
    'SELECT weekday FROM workout_day_weekdays WHERE day_id = ? ORDER BY weekday;',
    [dayId]
  );
  return rows.map((row) => row.weekday);
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function getWorkoutDaySummaries(
  client: SQLiteClient,
  planVersionId: string
): Promise<WorkoutDaySummary[]> {
  const rows = await client.getAllAsync<DaySummaryRow>(
    `SELECT
       d.*,
       v.plan_id as plan_id,
       COUNT(DISTINCT pe.id) as exercise_count,
       COALESCE(SUM(ps.rest_seconds), 0) as total_rest_seconds,
       COUNT(ps.id) as total_sets,
       (SELECT MAX(s.completed_at) FROM workout_sessions s
          WHERE s.day_id = d.id AND s.status = 'completed') as last_performed_at
     FROM workout_days d
     JOIN workout_plan_versions v ON v.id = d.plan_version_id
     LEFT JOIN prescribed_exercises pe ON pe.day_id = d.id
     LEFT JOIN prescribed_sets ps ON ps.prescribed_exercise_id = pe.id
     WHERE d.plan_version_id = ?
     GROUP BY d.id
     ORDER BY d."order";`,
    [planVersionId]
  );

  const summaries: WorkoutDaySummary[] = [];
  for (const row of rows) {
    summaries.push({
      id: row.id,
      planId: row.plan_id,
      planVersionId: row.plan_version_id,
      order: row.order,
      name: row.name,
      description: row.description,
      muscleGroups: JSON.parse(row.muscle_groups) as MuscleGroup[],
      weekdays: await getWeekdaysForDay(client, row.id),
      exerciseCount: row.exercise_count,
      estimatedDurationMinutes: Math.round(
        (row.total_rest_seconds + row.total_sets * SECONDS_PER_SET_ESTIMATE) / 60
      ),
      lastPerformedAt: row.last_performed_at,
    });
  }
  return summaries;
}

export async function getWorkoutDayById(
  client: SQLiteClient,
  dayId: string
): Promise<WorkoutDay | null> {
  const dayRow = await client.getFirstAsync<DayRow>(
    `SELECT d.*, v.plan_id as plan_id
     FROM workout_days d
     JOIN workout_plan_versions v ON v.id = d.plan_version_id
     WHERE d.id = ?;`,
    [dayId]
  );
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
    exercises.push(toPrescribedExercise(exerciseRow, setRows));
  }

  return {
    id: dayRow.id,
    planId: dayRow.plan_id,
    planVersionId: dayRow.plan_version_id,
    order: dayRow.order,
    name: dayRow.name,
    description: dayRow.description,
    muscleGroups: JSON.parse(dayRow.muscle_groups) as MuscleGroup[],
    weekdays: await getWeekdaysForDay(client, dayId),
    exercises,
  };
}

export interface PrescribedExerciseDetail {
  dayId: string;
  dayName: string;
  prescribedExercise: PrescribedExercise;
  exercise: Exercise;
}

export async function getPrescribedExerciseDetail(
  client: SQLiteClient,
  prescribedExerciseId: string
): Promise<PrescribedExerciseDetail | null> {
  const exerciseRow = await client.getFirstAsync<PrescribedExerciseRow>(
    'SELECT * FROM prescribed_exercises WHERE id = ?;',
    [prescribedExerciseId]
  );
  if (!exerciseRow) return null;

  const [setRows, dayRow, exercise] = await Promise.all([
    client.getAllAsync<PrescribedSetRow>(
      'SELECT * FROM prescribed_sets WHERE prescribed_exercise_id = ? ORDER BY "order";',
      [prescribedExerciseId]
    ),
    client.getFirstAsync<DayRow>('SELECT * FROM workout_days WHERE id = ?;', [exerciseRow.day_id]),
    getExerciseById(client, exerciseRow.exercise_id),
  ]);

  if (!dayRow || !exercise) return null;

  return {
    dayId: dayRow.id,
    dayName: dayRow.name,
    prescribedExercise: toPrescribedExercise(exerciseRow, setRows),
    exercise,
  };
}

/** Confirma que um dayId pertence a uma versão específica — usado pelo service para detectar ids obsoletos. */
export async function dayBelongsToVersion(
  client: SQLiteClient,
  dayId: string,
  planVersionId: string
): Promise<boolean> {
  const row = await client.getFirstAsync<{ found: number }>(
    'SELECT 1 as found FROM workout_days WHERE id = ? AND plan_version_id = ?;',
    [dayId, planVersionId]
  );
  return row !== null;
}

/** Confirma que um prescribedExerciseId pertence (via o dia) a uma versão específica. */
export async function prescribedExerciseBelongsToVersion(
  client: SQLiteClient,
  prescribedExerciseId: string,
  planVersionId: string
): Promise<boolean> {
  const row = await client.getFirstAsync<{ found: number }>(
    `SELECT 1 as found FROM prescribed_exercises pe
     JOIN workout_days d ON d.id = pe.day_id
     WHERE pe.id = ? AND d.plan_version_id = ?;`,
    [prescribedExerciseId, planVersionId]
  );
  return row !== null;
}

/** Confirma que um prescribedSetId pertence (via exercício e dia) a uma versão específica. */
export async function prescribedSetBelongsToVersion(
  client: SQLiteClient,
  prescribedSetId: string,
  planVersionId: string
): Promise<boolean> {
  const row = await client.getFirstAsync<{ found: number }>(
    `SELECT 1 as found FROM prescribed_sets ps
     JOIN prescribed_exercises pe ON pe.id = ps.prescribed_exercise_id
     JOIN workout_days d ON d.id = pe.day_id
     WHERE ps.id = ? AND d.plan_version_id = ?;`,
    [prescribedSetId, planVersionId]
  );
  return row !== null;
}

// ---------------------------------------------------------------------------
// Escrita — mecânica pura, sem política de versionamento/origem (isso é do
// prescriptionService; ver src/services/prescriptionService.ts)
// ---------------------------------------------------------------------------

export interface AddDayInput {
  planVersionId: string;
  order: number;
  name: string;
  description: string;
  muscleGroups: MuscleGroup[];
  weekdays: number[];
}

export async function addDay(client: SQLiteClient, input: AddDayInput): Promise<WorkoutDay> {
  const id = generateId('day');
  await client.runAsync(
    // plan_id (coluna legada) resolvido via subquery — só para satisfazer a
    // constraint NOT NULL original; nenhuma leitura nova depende dela.
    `INSERT INTO workout_days (id, plan_id, plan_version_id, "order", name, description, muscle_groups)
     VALUES (?, (SELECT plan_id FROM workout_plan_versions WHERE id = ?), ?, ?, ?, ?, ?);`,
    [id, input.planVersionId, input.planVersionId, input.order, input.name, input.description, JSON.stringify(input.muscleGroups)]
  );
  await setDayWeekdays(client, id, input.weekdays);
  const day = await getWorkoutDayById(client, id);
  if (!day) throw new Error('Falha ao criar dia de treino.');
  return day;
}

export interface UpdateDayInput {
  name?: string;
  description?: string;
  muscleGroups?: MuscleGroup[];
  order?: number;
}

export async function updateDay(client: SQLiteClient, dayId: string, input: UpdateDayInput): Promise<void> {
  const current = await client.getFirstAsync<DayRow>('SELECT * FROM workout_days WHERE id = ?;', [dayId]);
  if (!current) throw new Error(`Dia não encontrado: ${dayId}`);

  await client.runAsync(
    'UPDATE workout_days SET name = ?, description = ?, muscle_groups = ?, "order" = ? WHERE id = ?;',
    [
      input.name ?? current.name,
      input.description ?? current.description,
      input.muscleGroups ? JSON.stringify(input.muscleGroups) : current.muscle_groups,
      input.order ?? current.order,
      dayId,
    ]
  );
}

export async function removeDay(client: SQLiteClient, dayId: string): Promise<void> {
  await client.withTransactionAsync(async () => {
    const exerciseRows = await client.getAllAsync<{ id: string }>(
      'SELECT id FROM prescribed_exercises WHERE day_id = ?;',
      [dayId]
    );
    for (const exerciseRow of exerciseRows) {
      await client.runAsync('DELETE FROM prescribed_sets WHERE prescribed_exercise_id = ?;', [
        exerciseRow.id,
      ]);
    }
    await client.runAsync('DELETE FROM prescribed_exercises WHERE day_id = ?;', [dayId]);
    await client.runAsync('DELETE FROM workout_day_weekdays WHERE day_id = ?;', [dayId]);
    await client.runAsync('DELETE FROM workout_days WHERE id = ?;', [dayId]);
  });
}

/** Substitui todos os dias da semana do dia (delete+insert atômico). */
export async function setDayWeekdays(
  client: SQLiteClient,
  dayId: string,
  weekdays: number[]
): Promise<void> {
  await client.withTransactionAsync(async () => {
    await client.runAsync('DELETE FROM workout_day_weekdays WHERE day_id = ?;', [dayId]);
    for (const weekday of weekdays) {
      await client.runAsync('INSERT INTO workout_day_weekdays (day_id, weekday) VALUES (?, ?);', [
        dayId,
        weekday,
      ]);
    }
  });
}

export interface AddPrescribedExerciseInput {
  dayId: string;
  exerciseId: string;
  order: number;
  coachNote: string | null;
}

export async function addPrescribedExercise(
  client: SQLiteClient,
  input: AddPrescribedExerciseInput
): Promise<PrescribedExercise> {
  const id = generateId('pex');
  await client.runAsync(
    'INSERT INTO prescribed_exercises (id, day_id, exercise_id, "order", coach_note) VALUES (?, ?, ?, ?, ?);',
    [id, input.dayId, input.exerciseId, input.order, input.coachNote]
  );
  return { id, exerciseId: input.exerciseId, order: input.order, coachNote: input.coachNote, sets: [] };
}

export interface UpdatePrescribedExerciseInput {
  coachNote?: string | null;
  order?: number;
}

export async function updatePrescribedExercise(
  client: SQLiteClient,
  prescribedExerciseId: string,
  input: UpdatePrescribedExerciseInput
): Promise<void> {
  const current = await client.getFirstAsync<PrescribedExerciseRow>(
    'SELECT * FROM prescribed_exercises WHERE id = ?;',
    [prescribedExerciseId]
  );
  if (!current) throw new Error(`Exercício prescrito não encontrado: ${prescribedExerciseId}`);

  await client.runAsync('UPDATE prescribed_exercises SET coach_note = ?, "order" = ? WHERE id = ?;', [
    input.coachNote !== undefined ? input.coachNote : current.coach_note,
    input.order ?? current.order,
    prescribedExerciseId,
  ]);
}

export async function removePrescribedExercise(
  client: SQLiteClient,
  prescribedExerciseId: string
): Promise<void> {
  await client.withTransactionAsync(async () => {
    await client.runAsync('DELETE FROM prescribed_sets WHERE prescribed_exercise_id = ?;', [
      prescribedExerciseId,
    ]);
    await client.runAsync('DELETE FROM prescribed_exercises WHERE id = ?;', [prescribedExerciseId]);
  });
}

export interface AddPrescribedSetInput {
  prescribedExerciseId: string;
  order: number;
  targetReps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  targetLoadKg: number | null;
  restSeconds: number;
  technique: Technique;
  note: string | null;
}

export async function addPrescribedSet(
  client: SQLiteClient,
  input: AddPrescribedSetInput
): Promise<PrescribedSet> {
  const id = generateId('pset');
  await client.runAsync(
    `INSERT INTO prescribed_sets
      (id, prescribed_exercise_id, "order", target_reps, rep_range_min, rep_range_max, target_load_kg, rest_seconds, technique, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      input.prescribedExerciseId,
      input.order,
      input.targetReps,
      input.repRangeMin,
      input.repRangeMax,
      input.targetLoadKg,
      input.restSeconds,
      input.technique,
      input.note,
    ]
  );
  return {
    id,
    order: input.order,
    targetReps: input.targetReps,
    repRangeMin: input.repRangeMin,
    repRangeMax: input.repRangeMax,
    targetLoadKg: input.targetLoadKg,
    restSeconds: input.restSeconds,
    technique: input.technique,
    note: input.note,
  };
}

export type UpdatePrescribedSetInput = Partial<Omit<AddPrescribedSetInput, 'prescribedExerciseId'>>;

export async function updatePrescribedSet(
  client: SQLiteClient,
  prescribedSetId: string,
  input: UpdatePrescribedSetInput
): Promise<void> {
  const current = await client.getFirstAsync<PrescribedSetRow>(
    'SELECT * FROM prescribed_sets WHERE id = ?;',
    [prescribedSetId]
  );
  if (!current) throw new Error(`Série prescrita não encontrada: ${prescribedSetId}`);

  await client.runAsync(
    `UPDATE prescribed_sets SET
       "order" = ?, target_reps = ?, rep_range_min = ?, rep_range_max = ?,
       target_load_kg = ?, rest_seconds = ?, technique = ?, note = ?
     WHERE id = ?;`,
    [
      input.order ?? current.order,
      input.targetReps !== undefined ? input.targetReps : current.target_reps,
      input.repRangeMin !== undefined ? input.repRangeMin : current.rep_range_min,
      input.repRangeMax !== undefined ? input.repRangeMax : current.rep_range_max,
      input.targetLoadKg !== undefined ? input.targetLoadKg : current.target_load_kg,
      input.restSeconds ?? current.rest_seconds,
      input.technique ?? current.technique,
      input.note !== undefined ? input.note : current.note,
      prescribedSetId,
    ]
  );
}

export async function removePrescribedSet(client: SQLiteClient, prescribedSetId: string): Promise<void> {
  await client.runAsync('DELETE FROM prescribed_sets WHERE id = ?;', [prescribedSetId]);
}

// ---------------------------------------------------------------------------
// Reorder — valida permutação completa antes de persistir; nunca funciona
// como delete (ids ausentes do array são rejeitados, não removidos).
// ---------------------------------------------------------------------------

/**
 * `orderedIds` precisa ser exatamente uma permutação de `currentIds`: mesmo
 * tamanho, sem duplicatas, todos pertencentes ao pai. Como tamanho e
 * pertencimento já garantem isso, não sobra espaço para "faltar" um id.
 */
function validatePermutation(currentIds: string[], orderedIds: string[]): void {
  if (orderedIds.length !== currentIds.length) {
    throw new ReorderValidationError(
      `esperado ${currentIds.length} ids, recebido ${orderedIds.length} — reorder não pode funcionar como delete.`
    );
  }
  const currentSet = new Set(currentIds);
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!currentSet.has(id)) {
      throw new ReorderValidationError(`id não pertence a este pai: ${id}`);
    }
    if (seen.has(id)) {
      throw new ReorderValidationError(`id duplicado: ${id}`);
    }
    seen.add(id);
  }
}

export async function reorderDays(
  client: SQLiteClient,
  planVersionId: string,
  orderedDayIds: string[]
): Promise<void> {
  const currentRows = await client.getAllAsync<{ id: string }>(
    'SELECT id FROM workout_days WHERE plan_version_id = ?;',
    [planVersionId]
  );
  validatePermutation(
    currentRows.map((r) => r.id),
    orderedDayIds
  );

  await client.withTransactionAsync(async () => {
    for (let i = 0; i < orderedDayIds.length; i += 1) {
      await client.runAsync('UPDATE workout_days SET "order" = ? WHERE id = ?;', [i + 1, orderedDayIds[i]]);
    }
  });
}

export async function reorderPrescribedExercises(
  client: SQLiteClient,
  dayId: string,
  orderedIds: string[]
): Promise<void> {
  const currentRows = await client.getAllAsync<{ id: string }>(
    'SELECT id FROM prescribed_exercises WHERE day_id = ?;',
    [dayId]
  );
  validatePermutation(
    currentRows.map((r) => r.id),
    orderedIds
  );

  await client.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.runAsync('UPDATE prescribed_exercises SET "order" = ? WHERE id = ?;', [i + 1, orderedIds[i]]);
    }
  });
}

export async function reorderPrescribedSets(
  client: SQLiteClient,
  prescribedExerciseId: string,
  orderedIds: string[]
): Promise<void> {
  const currentRows = await client.getAllAsync<{ id: string }>(
    'SELECT id FROM prescribed_sets WHERE prescribed_exercise_id = ?;',
    [prescribedExerciseId]
  );
  validatePermutation(
    currentRows.map((r) => r.id),
    orderedIds
  );

  await client.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.runAsync('UPDATE prescribed_sets SET "order" = ? WHERE id = ?;', [i + 1, orderedIds[i]]);
    }
  });
}

// ---------------------------------------------------------------------------
// Duplicar rotina — copia um WorkoutDay inteiro (weekdays, exercícios,
// séries) dentro da MESMA versão, com ids novos, ao final da lista.
// ---------------------------------------------------------------------------

export async function duplicateDay(client: SQLiteClient, dayId: string): Promise<WorkoutDay> {
  const source = await client.getFirstAsync<DayRow>('SELECT * FROM workout_days WHERE id = ?;', [dayId]);
  if (!source) throw new Error(`Dia não encontrado: ${dayId}`);

  const siblingCount = await client.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workout_days WHERE plan_version_id = ?;',
    [source.plan_version_id]
  );
  const newOrder = (siblingCount?.count ?? 0) + 1;
  const newDayId = generateId('day');

  await client.withTransactionAsync(async () => {
    await client.runAsync(
      `INSERT INTO workout_days (id, plan_id, plan_version_id, "order", name, description, muscle_groups)
       VALUES (?, (SELECT plan_id FROM workout_plan_versions WHERE id = ?), ?, ?, ?, ?, ?);`,
      [
        newDayId,
        source.plan_version_id,
        source.plan_version_id,
        newOrder,
        `${source.name} (cópia)`,
        source.description,
        source.muscle_groups,
      ]
    );

    const weekdayRows = await client.getAllAsync<{ weekday: number }>(
      'SELECT weekday FROM workout_day_weekdays WHERE day_id = ?;',
      [dayId]
    );
    for (const weekdayRow of weekdayRows) {
      await client.runAsync('INSERT INTO workout_day_weekdays (day_id, weekday) VALUES (?, ?);', [
        newDayId,
        weekdayRow.weekday,
      ]);
    }

    const exerciseRows = await client.getAllAsync<PrescribedExerciseRow>(
      'SELECT * FROM prescribed_exercises WHERE day_id = ? ORDER BY "order";',
      [dayId]
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
  });

  const duplicated = await getWorkoutDayById(client, newDayId);
  if (!duplicated) throw new Error('Falha ao duplicar rotina.');
  return duplicated;
}
