import { completeSession, createSession } from '@/repositories/workoutSessionRepository';
import { computeWeeklyProgress, getHomeSnapshot } from '@/services/homeSnapshot';
import { PLAN_VERSION_ID } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
import type { SQLiteClient } from '@/database/sqliteClient';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

const PLAN_ID = 'plan_eixoforma_demo';
const DAY_A = 'day_treino_a';
const DAY_B = 'day_treino_b';

function session(overrides: Partial<WorkoutSessionSummary>): WorkoutSessionSummary {
  return {
    id: 'session_x',
    planId: PLAN_ID,
    planVersionId: PLAN_VERSION_ID,
    dayId: DAY_A,
    dayName: 'Treino A',
    status: 'completed',
    startedAt: '2026-09-22T10:00:00.000Z',
    completedAt: '2026-09-22T11:00:00.000Z',
    ...overrides,
  };
}

describe('computeWeeklyProgress', () => {
  // 2026-09-22 é uma terça-feira; a semana (domingo-sábado) começa em 2026-09-20.
  const tuesday = new Date('2026-09-22T12:00:00.000Z');

  it('conta dias distintos concluídos dentro da semana atual', () => {
    const history = [
      session({ dayId: DAY_A, completedAt: '2026-09-21T11:00:00.000Z' }),
      session({ dayId: DAY_B, completedAt: '2026-09-20T11:00:00.000Z' }),
    ];

    expect(computeWeeklyProgress(history, 3, tuesday)).toEqual({ completed: 2, total: 3 });
  });

  it('ignora sessões de semanas anteriores', () => {
    const history = [session({ dayId: DAY_A, completedAt: '2026-09-10T11:00:00.000Z' })];
    expect(computeWeeklyProgress(history, 3, tuesday)).toEqual({ completed: 0, total: 3 });
  });

  it('ignora sessões abandonadas', () => {
    const history = [
      session({ dayId: DAY_A, status: 'abandoned', completedAt: '2026-09-21T11:00:00.000Z' }),
    ];
    expect(computeWeeklyProgress(history, 3, tuesday)).toEqual({ completed: 0, total: 3 });
  });

  it('não conta o mesmo dia duas vezes', () => {
    const history = [
      session({ dayId: DAY_A, completedAt: '2026-09-21T09:00:00.000Z' }),
      session({ dayId: DAY_A, completedAt: '2026-09-21T20:00:00.000Z' }),
    ];
    expect(computeWeeklyProgress(history, 3, tuesday)).toEqual({ completed: 1, total: 3 });
  });
});

describe('getHomeSnapshot', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('sem sessão ativa: activeSession é null e o treino sugerido vem do plano selecionado por fallback', async () => {
    const snapshot = await getHomeSnapshot(client);

    expect(snapshot.selectedPlan?.id).toBe(PLAN_ID);
    expect(snapshot.activeSession).toBeNull();
    expect(snapshot.suggestedDay?.name).toBe('Treino A');
    expect(snapshot.lastSession).toBeNull();
  });

  it('com sessão ativa: activeSession reflete a sessão em andamento', async () => {
    const created = await createSession(client, {
      planId: PLAN_ID,
      planVersionId: PLAN_VERSION_ID,
      dayId: DAY_A,
    });

    const snapshot = await getHomeSnapshot(client);

    expect(snapshot.activeSession?.id).toBe(created.id);
    expect(snapshot.activeSession?.dayName).toBe('Treino A');
  });

  it('último treino reflete a sessão concluída mais recente', async () => {
    const session1 = await createSession(client, {
      planId: PLAN_ID,
      planVersionId: PLAN_VERSION_ID,
      dayId: DAY_A,
    });
    await completeSession(client, session1.id);

    const snapshot = await getHomeSnapshot(client);
    expect(snapshot.lastSession?.id).toBe(session1.id);
  });
});
