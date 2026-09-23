import type { WorkoutSessionSummary } from '@/domain/workoutSession';

export type StartDecision =
  | { kind: 'start' }
  | { kind: 'blocked'; activeSession: WorkoutSessionSummary };

/**
 * Decide o que "Iniciar treino" deve fazer, sem tocar em UI nem no banco —
 * mantém a regra ("nunca criar sessão duplicada, sempre oferecer escolha
 * clara") testável isoladamente do fluxo de navegação.
 */
export function decideStartAction(activeSession: WorkoutSessionSummary | null): StartDecision {
  return activeSession ? { kind: 'blocked', activeSession } : { kind: 'start' };
}
