import { mockExercises } from './exercises';
import { mockWorkoutPlan } from './workoutPlanSeed';
import type { SQLiteClient } from '@/database/sqliteClient';

/** Insere o catálogo e o plano de demonstração uma única vez (idempotente). */
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
          (id, name, primary_muscle_group, secondary_muscle_groups, equipment, image_placeholder, instruction, coach_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          exercise.id,
          exercise.name,
          exercise.primaryMuscleGroup,
          JSON.stringify(exercise.secondaryMuscleGroups),
          exercise.equipment,
          exercise.imagePlaceholder,
          exercise.instruction,
          exercise.coachNote,
        ]
      );
    }

    const plan = mockWorkoutPlan;
    await client.runAsync(
      'INSERT INTO workout_plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);',
      [plan.id, plan.name, plan.createdAt, plan.updatedAt]
    );

    for (const day of plan.days) {
      await client.runAsync(
        'INSERT INTO workout_days (id, plan_id, "order", name, muscle_groups) VALUES (?, ?, ?, ?, ?);',
        [day.id, day.planId, day.order, day.name, JSON.stringify(day.muscleGroups)]
      );

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
