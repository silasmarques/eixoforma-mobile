export type WorkoutSessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type PerformedSetStatus = 'pending' | 'completed' | 'skipped';
export type PerformedExerciseStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

/**
 * Realizado. Referencia a prescrição por id (prescribedSetId) sem nunca
 * modificá-la — reps/carga prescritas continuam legíveis via o repository de
 * prescrição mesmo depois de a série ser concluída com valores diferentes.
 */
export interface PerformedSet {
  id: string;
  performedExerciseId: string;
  prescribedSetId: string;
  reps: number | null;
  loadKg: number | null;
  completedAt: string | null;
  status: PerformedSetStatus;
  note: string | null;
}

export interface PerformedExercise {
  id: string;
  sessionId: string;
  prescribedExerciseId: string;
  order: number;
  status: PerformedExerciseStatus;
  sets: PerformedSet[];
}

export interface WorkoutSession {
  id: string;
  planId: string;
  dayId: string;
  status: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  exercises: PerformedExercise[];
}

export interface WorkoutSessionSummary {
  id: string;
  planId: string;
  dayId: string;
  dayName: string;
  status: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
}
