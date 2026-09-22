import { getAllExercises, getExerciseById } from '@/repositories/exerciseRepository';
import type { SQLiteClient } from '@/database/sqliteClient';

export const exerciseService = {
  getAllExercises: (client: SQLiteClient) => getAllExercises(client),
  getExerciseById: (client: SQLiteClient, id: string) => getExerciseById(client, id),
};
