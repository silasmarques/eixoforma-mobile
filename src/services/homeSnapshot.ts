import { getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { findActiveSession, getSessionHistory } from '@/repositories/workoutSessionRepository';
import { planService } from './planService';
import { currentWeekday } from '@/utils/weekdayLabels';
import type { WorkoutDaySummary, WorkoutPlan, WorkoutPlanVersion } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

const RECENT_PLANS_LIMIT = 3;
const DAY_PREVIEW_LIMIT = 3;

/**
 * O que a Home mostra de um WorkoutPlan — nunca uma WorkoutPlanVersion.
 * `version` é resolvida por `planService.resolveViewableVersion` (leitura
 * pura, nunca cria draft): prefere o draft em edição quando existe, senão a
 * active. `superseded` nunca aparece aqui, então um plano com v1 superseded
 * + v2 active continua sendo UM card — a versão é só o que decide qual
 * status/prévia mostrar dentro dele.
 */
export interface PlanHomeSummary {
  plan: WorkoutPlan;
  version: WorkoutPlanVersion | null;
  dayPreviews: WorkoutDaySummary[];
  totalDayCount: number;
}

export interface TodayWorkout {
  day: WorkoutDaySummary;
  planId: string;
  planName: string;
}

export interface HomeSnapshot {
  selectedPlan: PlanHomeSummary | null;
  todayWorkout: TodayWorkout | null;
  recentPlans: PlanHomeSummary[];
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

async function buildPlanHomeSummary(client: SQLiteClient, plan: WorkoutPlan): Promise<PlanHomeSummary> {
  const version = await planService.resolveViewableVersion(client, plan.id);
  if (!version) {
    return { plan, version: null, dayPreviews: [], totalDayCount: 0 };
  }
  const days = await getWorkoutDaySummaries(client, version.id);
  return { plan, version, dayPreviews: days.slice(0, DAY_PREVIEW_LIMIT), totalDayCount: days.length };
}

/**
 * Home é sempre relativa ao plano selecionado (ver planService.getSelectedPlan,
 * que já resolve fallback sem assumir singleton). Sem plano com versão
 * active, a Home simplesmente não tem "treino de hoje" pra sugerir — estado
 * válido, não erro; nunca inventamos um treino.
 */
export async function getHomeSnapshot(
  client: SQLiteClient,
  referenceDate: Date = new Date()
): Promise<HomeSnapshot> {
  const [selectedPlanEntity, allPlans, activeSession, history] = await Promise.all([
    planService.getSelectedPlan(client),
    planService.listPlans(client),
    findActiveSession(client),
    getSessionHistory(client),
  ]);

  const selectedPlan = selectedPlanEntity ? await buildPlanHomeSummary(client, selectedPlanEntity) : null;

  const recentPlanEntities = allPlans
    .filter((plan) => plan.id !== selectedPlanEntity?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_PLANS_LIMIT);
  const recentPlans = await Promise.all(
    recentPlanEntities.map((plan) => buildPlanHomeSummary(client, plan))
  );

  // "Treino de hoje" só existe a partir da versão active — nunca do draft,
  // mesmo que seja o que a Home está mostrando como prévia do plano.
  const activeVersion = selectedPlanEntity
    ? await planService.getActiveVersion(client, selectedPlanEntity.id)
    : null;
  const activeDays = activeVersion ? await getWorkoutDaySummaries(client, activeVersion.id) : [];
  const weekday = currentWeekday(referenceDate);
  const todayDay = activeDays.find((day) => day.weekdays.includes(weekday)) ?? null;
  const todayWorkout: TodayWorkout | null =
    todayDay && selectedPlanEntity
      ? { day: todayDay, planId: selectedPlanEntity.id, planName: selectedPlanEntity.name }
      : null;

  const planHistory = selectedPlanEntity
    ? history.filter((session) => session.planId === selectedPlanEntity.id)
    : [];
  const weekly = computeWeeklyProgress(planHistory, activeDays.length, referenceDate);

  return {
    selectedPlan,
    todayWorkout,
    recentPlans,
    activeSession,
    lastSession: planHistory[0] ?? history[0] ?? null,
    weeklyCompleted: weekly.completed,
    weeklyTotal: weekly.total,
  };
}
