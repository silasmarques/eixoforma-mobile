import type { WorkoutDaySummary } from '@/domain/workoutPlan';

export type WorkoutStartAction =
  | { kind: 'direct'; dayId: string; dayName: string }
  | { kind: 'choose' };

/**
 * Decide se "Começar treino" / "Iniciar treino" pode ir direto pra sessão
 * ou se precisa perguntar qual treino ("Qual treino você quer fazer?").
 * Nunca escolhe arbitrariamente entre múltiplos treinos igualmente válidos —
 * só resolve `direct` quando não há ambiguidade real:
 *
 * - exatamente 1 treino na rotina → direct, esse treino;
 * - vários treinos, exatamente 1 bate com o weekday de hoje → direct, esse;
 * - vários treinos sem nenhum match de hoje → choose;
 * - vários treinos com mais de 1 match de hoje → choose.
 *
 * `days` deve vir sempre da versão ACTIVE (nunca draft) — quem garante isso
 * é o chamador.
 */
export function resolveWorkoutStartAction(
  days: readonly WorkoutDaySummary[],
  weekday: number
): WorkoutStartAction {
  if (days.length === 0) return { kind: 'choose' };
  if (days.length === 1) return { kind: 'direct', dayId: days[0].id, dayName: days[0].name };

  const todayMatches = days.filter((day) => day.weekdays.includes(weekday));
  if (todayMatches.length === 1) {
    return { kind: 'direct', dayId: todayMatches[0].id, dayName: todayMatches[0].name };
  }

  return { kind: 'choose' };
}
