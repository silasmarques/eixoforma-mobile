import {
  getActivePlanSummary,
  getWorkoutDayById,
  getWorkoutDaySummaries,
} from '@/repositories/workoutPlanRepository';
import type { SQLiteClient } from '@/database/sqliteClient';

export const workoutPlanService = {
  getActivePlanSummary: (client: SQLiteClient) => getActivePlanSummary(client),
  getWorkoutDaySummaries: (client: SQLiteClient) => getWorkoutDaySummaries(client),
  getWorkoutDayById: (client: SQLiteClient, dayId: string) => getWorkoutDayById(client, dayId),
};
