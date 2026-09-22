import {
  abandonSession,
  completeSession,
  createSession,
  findActiveSession,
  getSessionById,
  getSessionHistory,
  recordPerformedSet,
} from '@/repositories/workoutSessionRepository';
import type { SQLiteClient } from '@/database/sqliteClient';

export const workoutSessionService = {
  findActiveSession: (client: SQLiteClient) => findActiveSession(client),
  startSession: (client: SQLiteClient, params: { planId: string; dayId: string }) =>
    createSession(client, params),
  getSessionById: (client: SQLiteClient, sessionId: string) => getSessionById(client, sessionId),
  getSessionHistory: (client: SQLiteClient) => getSessionHistory(client),
  completeSession: (client: SQLiteClient, sessionId: string) => completeSession(client, sessionId),
  abandonSession: (client: SQLiteClient, sessionId: string) => abandonSession(client, sessionId),
  recordPerformedSet: (
    client: SQLiteClient,
    params: { performedSetId: string; reps: number; loadKg: number | null; note?: string | null }
  ) => recordPerformedSet(client, params),
};
