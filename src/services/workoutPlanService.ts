import {
  getPrescribedExerciseDetail,
  getWorkoutDayById,
  getWorkoutDaySummaries,
} from '@/repositories/workoutPlanRepository';
import type { SQLiteClient } from '@/database/sqliteClient';

export const workoutPlanService = {
  getWorkoutDaySummaries: (client: SQLiteClient, planVersionId: string) =>
    getWorkoutDaySummaries(client, planVersionId),
  getWorkoutDayById: (client: SQLiteClient, dayId: string) => getWorkoutDayById(client, dayId),
  getPrescribedExerciseDetail: (client: SQLiteClient, prescribedExerciseId: string) =>
    getPrescribedExerciseDetail(client, prescribedExerciseId),
};
