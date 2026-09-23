import type { MuscleGroup } from './muscleGroup';
import type { Technique } from './technique';

export type PlanOrigin = 'prescribed' | 'personal';
export type WorkoutPlanVersionStatus = 'draft' | 'active' | 'superseded';

/** Identidade estável do plano — o que o usuário chama de "Hipertrofia Setembro". */
export interface WorkoutPlan {
  id: string;
  name: string;
  /**
   * Texto livre opcional do plano. Reaproveitado temporariamente pela UI de
   * autoria (feat/mobile-authoring-ux) como "Comentário da rotina" — é o
   * mesmo campo, só rótulo diferente, sem migration nova. Se "objetivo" e
   * "comentário" precisarem virar conceitos semanticamente distintos no
   * futuro (ex.: um editável a qualquer momento e outro fixado na criação),
   * aí sim separar em duas colunas.
   */
  goal: string | null;
  origin: PlanOrigin;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Uma árvore imutável de prescrição sob um WorkoutPlan. `draft` é editável em
 * lugar; `active` e `superseded` nunca são editadas — qualquer alteração
 * cria (ou reaproveita) um draft via `prescriptionService.getEditableVersion`.
 */
export interface WorkoutPlanVersion {
  id: string;
  planId: string;
  versionNumber: number;
  status: WorkoutPlanVersionStatus;
  createdAt: string;
  activatedAt: string | null;
}

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
  planVersionId: string;
  order: number;
  name: string;
  description: string;
  muscleGroups: MuscleGroup[];
  weekdays: number[];
  exercises: PrescribedExercise[];
}

/** Resumo sem a árvore completa de exercícios — usado em listagens (cards). */
export interface WorkoutDaySummary {
  id: string;
  planId: string;
  planVersionId: string;
  order: number;
  name: string;
  description: string;
  muscleGroups: MuscleGroup[];
  weekdays: number[];
  exerciseCount: number;
  estimatedDurationMinutes: number;
  lastPerformedAt: string | null;
}
