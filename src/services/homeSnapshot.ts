import { findActiveSession, getSessionHistory } from '@/repositories/workoutSessionRepository';
import { getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { planService } from './planService';
import type { WorkoutDaySummary, WorkoutPlan } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

export interface HomeSnapshot {
  selectedPlan: WorkoutPlan | null;
  suggestedDay: WorkoutDaySummary | null;
  activeSession: WorkoutSessionSummary | null;
  lastSession: WorkoutSessionSummary | null;
  weeklyCompleted: number;
  weeklyTotal: number;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0 = domingo
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day);
  return result;
}

/**
 * Conta dias distintos da semana atual com ao menos um treino concluído,
 * limitado ao número de treinos do plano (não conta duas sessões do mesmo
 * dia como progresso duplo).
 */
export function computeWeeklyProgress(
  history: readonly WorkoutSessionSummary[],
  totalDaysInPlan: number,
  referenceDate: Date = new Date()
): { completed: number; total: number } {
  const weekStart = startOfWeek(referenceDate);
  const completedDayIds = new Set(
    history
      .filter(
        (session) =>
          session.status === 'completed' &&
          session.completedAt !== null &&
          new Date(session.completedAt) >= weekStart
      )
      .map((session) => session.dayId)
  );

  return {
    completed: Math.min(completedDayIds.size, totalDaysInPlan),
    total: totalDaysInPlan,
  };
}

/**
 * Home é sempre relativa ao plano selecionado (ver planService.getSelectedPlan,
 * que já resolve fallback sem assumir singleton). Sem plano com versão
 * active, a Home simplesmente não tem o que sugerir — estado válido, não erro.
 */
export async function getHomeSnapshot(client: SQLiteClient): Promise<HomeSnapshot> {
  const selectedPlan = await planService.getSelectedPlan(client);

  const [activeSession, history] = await Promise.all([
    findActiveSession(client),
    getSessionHistory(client),
  ]);

  if (!selectedPlan) {
    return {
      selectedPlan: null,
      suggestedDay: null,
      activeSession,
      lastSession: history[0] ?? null,
      weeklyCompleted: 0,
      weeklyTotal: 0,
    };
  }

  const activeVersion = await planService.getActiveVersion(client, selectedPlan.id);
  const days = activeVersion ? await getWorkoutDaySummaries(client, activeVersion.id) : [];
  const planHistory = history.filter((session) => session.planId === selectedPlan.id);
  const weekly = computeWeeklyProgress(planHistory, days.length);

  return {
    selectedPlan,
    suggestedDay: days[0] ?? null,
    activeSession,
    lastSession: planHistory[0] ?? null,
    weeklyCompleted: weekly.completed,
    weeklyTotal: weekly.total,
  };
}
