export type ExerciseCategory = 'strength' | 'mobility' | 'warmup' | 'core' | 'cardio' | 'stretching';

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: 'Força',
  mobility: 'Mobilidade',
  warmup: 'Aquecimento',
  core: 'Core',
  cardio: 'Cardio',
  stretching: 'Alongamento',
};

export const EXERCISE_CATEGORIES = Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[];

export function isExerciseCategory(value: unknown): value is ExerciseCategory {
  return typeof value === 'string' && (EXERCISE_CATEGORIES as string[]).includes(value);
}
