import { mockExercises } from './exercises';
import { mockPlan, mockPlanVersion, mockWorkoutDays } from './workoutPlanSeed';
import type { SQLiteClient } from '@/database/sqliteClient';

/** Insere o catálogo e o plano de demonstração (origin='prescribed') uma única vez (idempotente). */
export async function seedDemoData(client: SQLiteClient): Promise<void> {
  const existingPlan = await client.getFirstAsync<{ id: string }>(
    'SELECT id FROM workout_plans LIMIT 1;'
  );
  if (existingPlan) {
    return;
  }

  await client.withTransactionAsync(async () => {
    for (const exercise of mockExercises) {
      await client.runAsync(
        `INSERT INTO exercises
          (id, name, category, primary_muscle_group, secondary_muscle_groups, equipment, image_placeholder, instruction, coach_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          exercise.id,
          exercise.name,
          exercise.category,
          exercise.primaryMuscleGroup,
          JSON.stringify(exercise.secondaryMuscleGroups),
          exercise.equipment,
          exercise.imagePlaceholder,
          exercise.instruction,
          exercise.coachNote,
        ]
      );
    }

    await client.runAsync(
      'INSERT INTO workout_plans (id, name, origin, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
      [
        mockPlan.id,
        mockPlan.name,
        mockPlan.origin,
        mockPlan.createdByUserId,
        mockPlan.createdAt,
        mockPlan.updatedAt,
      ]
    );

    await client.runAsync(
      'INSERT INTO workout_plan_versions (id, plan_id, version_number, status, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?);',
      [
        mockPlanVersion.id,
        mockPlanVersion.planId,
        mockPlanVersion.versionNumber,
        mockPlanVersion.status,
        mockPlanVersion.createdAt,
        mockPlanVersion.activatedAt,
      ]
    );

    for (const day of mockWorkoutDays) {
      await client.runAsync(
        // plan_id é coluna legada (ver migration 003) — mantida populada só por compatibilidade
        // com a constraint NOT NULL original; nenhuma leitura nova depende dela.
        'INSERT INTO workout_days (id, plan_id, plan_version_id, "order", name, description, muscle_groups) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [
          day.id,
          day.planId,
          day.planVersionId,
          day.order,
          day.name,
          day.description,
          JSON.stringify(day.muscleGroups),
        ]
      );

      for (const weekday of day.weekdays) {
        await client.runAsync('INSERT INTO workout_day_weekdays (day_id, weekday) VALUES (?, ?);', [
          day.id,
          weekday,
        ]);
      }

      for (const prescribedExercise of day.exercises) {
        await client.runAsync(
          `INSERT INTO prescribed_exercises (id, day_id, exercise_id, "order", coach_note)
           VALUES (?, ?, ?, ?, ?);`,
          [
            prescribedExercise.id,
            day.id,
            prescribedExercise.exerciseId,
            prescribedExercise.order,
            prescribedExercise.coachNote,
          ]
        );

        for (const set of prescribedExercise.sets) {
          await client.runAsync(
            `INSERT INTO prescribed_sets
              (id, prescribed_exercise_id, "order", target_reps, rep_range_min, rep_range_max, target_load_kg, rest_seconds, technique, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              set.id,
              prescribedExercise.id,
              set.order,
              set.targetReps,
              set.repRangeMin,
              set.repRangeMax,
              set.targetLoadKg,
              set.restSeconds,
              set.technique,
              set.note,
            ]
          );
        }
      }
    }
  });
}
