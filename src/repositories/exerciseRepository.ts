import type { Equipment } from '@/domain/equipment';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseCategory } from '@/domain/exerciseCategory';
import type { MuscleGroup } from '@/domain/muscleGroup';
import type { SQLiteClient } from '@/database/sqliteClient';

interface ExerciseRow {
  id: string;
  name: string;
  category: string;
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
    category: row.category as ExerciseCategory,
    primaryMuscleGroup: row.primary_muscle_group as MuscleGroup,
    secondaryMuscleGroups: JSON.parse(row.secondary_muscle_groups) as MuscleGroup[],
    equipment: row.equipment as Equipment,
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

export interface ExerciseSearchFilters {
  query?: string;
  category?: ExerciseCategory;
  muscleGroup?: MuscleGroup;
  equipment?: Equipment;
}

/** Alimenta a futura tela "Adicionar exercício" (busca + Todos/Grupos/Equipamentos). */
export async function searchExercises(
  client: SQLiteClient,
  filters: ExerciseSearchFilters
): Promise<Exercise[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.query) {
    conditions.push('name LIKE ?');
    params.push(`%${filters.query}%`);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.muscleGroup) {
    conditions.push('(primary_muscle_group = ? OR secondary_muscle_groups LIKE ?)');
    params.push(filters.muscleGroup, `%"${filters.muscleGroup}"%`);
  }
  if (filters.equipment) {
    conditions.push('equipment = ?');
    params.push(filters.equipment);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await client.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises ${where} ORDER BY name;`,
    params
  );
  return rows.map(toExercise);
}
