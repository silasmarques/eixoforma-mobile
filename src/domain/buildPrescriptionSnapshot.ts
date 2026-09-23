import type { Exercise } from './exercise';
import { PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION, type PrescriptionSnapshot } from './prescriptionSnapshot';
import type { WorkoutDay } from './workoutPlan';

/** Congela a árvore prescrita + os dados do catálogo no instante da criação da sessão. */
export function buildPrescriptionSnapshot(
  day: WorkoutDay,
  exercisesById: ReadonlyMap<string, Exercise>
): PrescriptionSnapshot {
  return {
    schemaVersion: PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION,
    planVersionId: day.planVersionId,
    dayId: day.id,
    dayName: day.name,
    dayDescription: day.description,
    muscleGroups: day.muscleGroups,
    exercises: day.exercises.map((prescribedExercise) => {
      const exercise = exercisesById.get(prescribedExercise.exerciseId);
      if (!exercise) {
        throw new Error(`Exercício do catálogo não encontrado: ${prescribedExercise.exerciseId}`);
      }
      return {
        prescribedExerciseId: prescribedExercise.id,
        exerciseId: prescribedExercise.exerciseId,
        order: prescribedExercise.order,
        coachNote: prescribedExercise.coachNote,
        exercise: {
          name: exercise.name,
          category: exercise.category,
          primaryMuscleGroup: exercise.primaryMuscleGroup,
          secondaryMuscleGroups: exercise.secondaryMuscleGroups,
          equipment: exercise.equipment,
          imagePlaceholder: exercise.imagePlaceholder,
          instruction: exercise.instruction,
          coachNote: exercise.coachNote,
        },
        sets: prescribedExercise.sets.map((set) => ({
          prescribedSetId: set.id,
          order: set.order,
          targetReps: set.targetReps,
          repRangeMin: set.repRangeMin,
          repRangeMax: set.repRangeMax,
          targetLoadKg: set.targetLoadKg,
          restSeconds: set.restSeconds,
          technique: set.technique,
          note: set.note,
        })),
      };
    }),
  };
}
