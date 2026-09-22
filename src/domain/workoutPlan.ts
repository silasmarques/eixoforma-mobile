import type { Technique } from './technique';

/**
 * Prescrição. Imutável do ponto de vista da execução: WorkoutSession referencia
 * estes ids, nunca sobrescreve estes valores.
 */
export interface PrescribedSet {
  id: string;
  order: number;
  targetReps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  targetLoadKg: number | null;
  restSeconds: number;
  technique: Technique;
  note: string | null;
}

export interface PrescribedExercise {
  id: string;
  exerciseId: string;
  order: number;
  coachNote: string | null;
  sets: PrescribedSet[];
}

export interface WorkoutDay {
  id: string;
  planId: string;
  order: number;
  name: string;
  muscleGroups: string[];
  exercises: PrescribedExercise[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  days: WorkoutDay[];
}

/** Resumo sem a árvore completa de exercícios — usado em listagens (cards). */
export interface WorkoutDaySummary {
  id: string;
  planId: string;
  order: number;
  name: string;
  muscleGroups: string[];
  exerciseCount: number;
}
