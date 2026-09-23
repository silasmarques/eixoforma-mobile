import type { Equipment } from './equipment';
import type { ExerciseCategory } from './exerciseCategory';
import type { MuscleGroup } from './muscleGroup';
import type { Technique } from './technique';

export const PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION = 1;

export interface PrescriptionSnapshotSet {
  prescribedSetId: string;
  order: number;
  targetReps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  targetLoadKg: number | null;
  restSeconds: number;
  technique: Technique;
  note: string | null;
}

export interface PrescriptionSnapshotExercise {
  prescribedExerciseId: string;
  exerciseId: string;
  order: number;
  coachNote: string | null;
  exercise: {
    name: string;
    category: ExerciseCategory;
    primaryMuscleGroup: MuscleGroup;
    secondaryMuscleGroups: MuscleGroup[];
    equipment: Equipment;
    imagePlaceholder: string;
    instruction: string;
    coachNote: string | null;
  };
  sets: PrescriptionSnapshotSet[];
}

/**
 * Congelado no instante da criação da sessão. Só para histórico — nunca é
 * fonte para editar a prescrição (isso vive exclusivamente em
 * prescribed_exercises/prescribed_sets da versão do plano).
 */
export interface PrescriptionSnapshot {
  schemaVersion: 1;
  planVersionId: string;
  dayId: string;
  dayName: string;
  dayDescription: string;
  muscleGroups: MuscleGroup[];
  exercises: PrescriptionSnapshotExercise[];
}
