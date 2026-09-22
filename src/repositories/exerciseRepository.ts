import type { Exercise } from '@/domain/exercise';
import type { SQLiteClient } from '@/database/sqliteClient';

interface ExerciseRow {
  id: string;
  name: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string;
  equipment: string;
  image_placeholder: string;
  instruction: string;
  coach_note: string | null;
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    primaryMuscleGroup: row.primary_muscle_group,
    secondaryMuscleGroups: JSON.parse(row.secondary_muscle_groups) as string[],
    equipment: row.equipment,
    imagePlaceholder: row.image_placeholder,
    instruction: row.instruction,
    coachNote: row.coach_note,
  };
}

export async function getAllExercises(client: SQLiteClient): Promise<Exercise[]> {
  const rows = await client.getAllAsync<ExerciseRow>('SELECT * FROM exercises ORDER BY name;');
  return rows.map(toExercise);
}

export async function getExerciseById(client: SQLiteClient, id: string): Promise<Exercise | null> {
  const row = await client.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?;', [id]);
  return row ? toExercise(row) : null;
}
