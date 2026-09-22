export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  equipment: string;
  imagePlaceholder: string;
  instruction: string;
  coachNote: string | null;
}
