import { getVersionByStatus } from '@/repositories/planVersionRepository';
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

  /** Sessões só podem começar a partir da versão `active` do plano — nunca de um draft. */
  async startSession(client: SQLiteClient, params: { planId: string; dayId: string }) {
    const activeVersion = await getVersionByStatus(client, params.planId, 'active');
    if (!activeVersion) {
      throw new Error(`Plano ${params.planId} não tem uma versão active para iniciar um treino.`);
    }
    return createSession(client, {
      planId: params.planId,
      planVersionId: activeVersion.id,
      dayId: params.dayId,
    });
  },

  getSessionById: (client: SQLiteClient, sessionId: string) => getSessionById(client, sessionId),
  getSessionHistory: (client: SQLiteClient) => getSessionHistory(client),
  completeSession: (client: SQLiteClient, sessionId: string) => completeSession(client, sessionId),
  abandonSession: (client: SQLiteClient, sessionId: string) => abandonSession(client, sessionId),
  recordPerformedSet: (
    client: SQLiteClient,
    params: { performedSetId: string; reps: number; loadKg: number | null; note?: string | null }
  ) => recordPerformedSet(client, params),
};
