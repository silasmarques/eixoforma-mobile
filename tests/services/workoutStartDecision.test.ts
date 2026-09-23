import { decideStartAction } from '@/services/workoutStartDecision';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

const activeSession: WorkoutSessionSummary = {
  id: 'session_1',
  planId: 'plan_1',
  planVersionId: 'plan_1_v1',
  dayId: 'day_a',
  dayName: 'Treino A',
  status: 'in_progress',
  startedAt: '2026-09-22T10:00:00.000Z',
  completedAt: null,
};

describe('decideStartAction', () => {
  it('permite iniciar quando não há sessão ativa', () => {
    expect(decideStartAction(null)).toEqual({ kind: 'start' });
  });

  it('bloqueia e aponta a sessão ativa para continuar quando já existe uma', () => {
    expect(decideStartAction(activeSession)).toEqual({ kind: 'blocked', activeSession });
  });
});
