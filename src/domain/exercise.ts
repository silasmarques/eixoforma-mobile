import type { Equipment } from './equipment';
import type { ExerciseCategory } from './exerciseCategory';
import type { MuscleGroup } from './muscleGroup';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups: MuscleGroup[];
  equipment: Equipment;
  imagePlaceholder: string;
  instruction: string;
  coachNote: string | null;
}
