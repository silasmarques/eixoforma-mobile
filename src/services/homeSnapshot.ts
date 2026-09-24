import { getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { findActiveSession, getSessionHistory } from '@/repositories/workoutSessionRepository';
import { planService } from './planService';
import { currentWeekday } from '@/utils/weekdayLabels';
import { resolveWorkoutStartAction, type WorkoutStartAction } from '@/utils/resolveWorkoutStartAction';
import { sortPlansByCreatedAtDesc } from '@/utils/sortPlansByCreatedAt';
import type { WorkoutDaySummary, WorkoutPlan, WorkoutPlanVersion } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

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
  /** Weekdays únicos cobertos por todos os treinos da rotina (versão exibida), ordenados. */
  weekdays: number[];
}

export interface HomeSnapshot {
  /** "Meus Treinos" — TODOS os WorkoutPlan exibíveis (ativos e rascunho), mais recente criado primeiro. Nunca ordenado por selected_plan_id. */
  orderedPlans: PlanHomeSummary[];
  /** Preferência/seleção atual (app_preferences.selected_plan_id) — só pra destaque visual em "Meus Treinos", não afeta a ordem nem o card do topo. */
  selectedPlanId: string | null;
  /**
   * Card de destaque do topo — a rotina mais recentemente criada QUE JÁ TEM
   * uma versão active (rascunhos nunca entram aqui, mesmo que sejam mais
   * recentes que a última rotina ativada). `null` quando nenhum plano tem
   * versão active.
   */
  topPlan: PlanHomeSummary | null;
  /**
   * Resolução de "Começar treino" a partir do `topPlan` — sempre calculada
   * sobre a versão active (nunca draft) via `resolveWorkoutStartAction`.
   * `direct` quando não há ambiguidade (1 treino só, ou exatamente 1 bate
   * com hoje); `choose` quando é preciso perguntar qual treino. `null`
   * apenas quando `topPlan` também é `null`.
   */
  topPlanStartAction: WorkoutStartAction | null;
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

function collectWeekdays(days: readonly WorkoutDaySummary[]): number[] {
  const unique = new Set<number>();
  for (const day of days) {
    for (const weekday of day.weekdays) unique.add(weekday);
  }
  return [...unique].sort((a, b) => a - b);
}

async function buildPlanHomeSummary(client: SQLiteClient, plan: WorkoutPlan): Promise<PlanHomeSummary> {
  const version = await planService.resolveViewableVersion(client, plan.id);
  if (!version) {
    return { plan, version: null, dayPreviews: [], totalDayCount: 0, weekdays: [] };
  }
  const days = await getWorkoutDaySummaries(client, version.id);
  return {
    plan,
    version,
    dayPreviews: days.slice(0, DAY_PREVIEW_LIMIT),
    totalDayCount: days.length,
    weekdays: collectWeekdays(days),
  };
}

/**
 * Primeira rotina (na ordem mais-recente-primeiro já calculada) que tem uma
 * versão active — pula rascunhos deliberadamente. Sequencial (não
 * Promise.all) pra parar assim que encontra a primeira, sem consultar
 * versão active de planos que nem vão ser usados.
 */
async function findMostRecentActivePlan(
  client: SQLiteClient,
  sortedPlans: readonly WorkoutPlan[]
): Promise<{ plan: WorkoutPlan; activeDays: WorkoutDaySummary[] } | null> {
  for (const plan of sortedPlans) {
    const activeVersion = await planService.getActiveVersion(client, plan.id);
    if (activeVersion) {
      const activeDays = await getWorkoutDaySummaries(client, activeVersion.id);
      return { plan, activeDays };
    }
  }
  return null;
}

/**
 * "Meus Treinos" é ordenado por criação (mais recente primeiro), critério
 * independente de app_preferences.selected_plan_id — que continua existindo
 * só como preferência/seleção (destaque visual em "Meus Treinos",
 * "Progresso semanal"), nunca como critério de ordem nem fonte do card do
 * topo. Um WorkoutPlan aparece uma única vez (WorkoutPlanVersion é só
 * detalhe interno de qual prévia mostrar).
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

  const sortedPlanEntities = sortPlansByCreatedAtDesc(allPlans);
  const orderedPlans = await Promise.all(
    sortedPlanEntities.map((plan) => buildPlanHomeSummary(client, plan))
  );

  const mostRecentActive = await findMostRecentActivePlan(client, sortedPlanEntities);
  const topPlan = mostRecentActive ? await buildPlanHomeSummary(client, mostRecentActive.plan) : null;
  const topPlanStartAction: WorkoutStartAction | null = mostRecentActive
    ? resolveWorkoutStartAction(mostRecentActive.activeDays, currentWeekday(referenceDate))
    : null;

  // Progresso semanal continua relativo ao plano SELECIONADO (preferência de
  // treino atual), não ao destaque do topo — são preocupações diferentes.
  const selectedActiveVersion = selectedPlanEntity
    ? await planService.getActiveVersion(client, selectedPlanEntity.id)
    : null;
  const selectedActiveDays = selectedActiveVersion
    ? await getWorkoutDaySummaries(client, selectedActiveVersion.id)
    : [];
  const planHistory = selectedPlanEntity
    ? history.filter((session) => session.planId === selectedPlanEntity.id)
    : [];
  const weekly = computeWeeklyProgress(planHistory, selectedActiveDays.length, referenceDate);

  return {
    orderedPlans,
    selectedPlanId: selectedPlanEntity?.id ?? null,
    topPlan,
    topPlanStartAction,
    activeSession,
    lastSession: planHistory[0] ?? history[0] ?? null,
    weeklyCompleted: weekly.completed,
    weeklyTotal: weekly.total,
  };
}
