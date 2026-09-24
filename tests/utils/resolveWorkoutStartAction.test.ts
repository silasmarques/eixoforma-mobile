import { resolveWorkoutStartAction } from '@/utils/resolveWorkoutStartAction';
import type { WorkoutDaySummary } from '@/domain/workoutPlan';

function day(overrides: Partial<WorkoutDaySummary>): WorkoutDaySummary {
  return {
    id: 'day_x',
    planId: 'plan_x',
    planVersionId: 'version_x',
    order: 1,
    name: 'Treino X',
    description: '',
    muscleGroups: [],
    weekdays: [],
    exerciseCount: 1,
    estimatedDurationMinutes: 30,
    lastPerformedAt: null,
    ...overrides,
  };
}

describe('resolveWorkoutStartAction', () => {
  it('lista vazia → choose (nunca inventa treino)', () => {
    expect(resolveWorkoutStartAction([], 1)).toEqual({ kind: 'choose' });
  });

  it('exatamente 1 treino → direct, esse treino, independente do weekday', () => {
    const d = day({ id: 'a', name: 'Único', weekdays: [3] });
    expect(resolveWorkoutStartAction([d], 1)).toEqual({ kind: 'direct', dayId: 'a', dayName: 'Único' });
  });

  it('vários treinos, exatamente 1 bate com hoje → direct, esse treino', () => {
    const a = day({ id: 'a', name: 'Treino A', weekdays: [2] });
    const b = day({ id: 'b', name: 'Treino B', weekdays: [1] });
    const c = day({ id: 'c', name: 'Treino C', weekdays: [5] });
    expect(resolveWorkoutStartAction([a, b, c], 1)).toEqual({
      kind: 'direct',
      dayId: 'b',
      dayName: 'Treino B',
    });
  });

  it('vários treinos, nenhum bate com hoje → choose (não escolhe o primeiro por order)', () => {
    const a = day({ id: 'a', order: 1, weekdays: [2] });
    const b = day({ id: 'b', order: 2, weekdays: [5] });
    expect(resolveWorkoutStartAction([a, b], 1)).toEqual({ kind: 'choose' });
  });

  it('vários treinos, mais de 1 bate com hoje → choose (não escolhe arbitrariamente)', () => {
    const a = day({ id: 'a', weekdays: [1] });
    const b = day({ id: 'b', weekdays: [1] });
    expect(resolveWorkoutStartAction([a, b], 1)).toEqual({ kind: 'choose' });
  });

  it('draft nunca é usado — função só opera sobre o array que o chamador passar (documentado, não testável aqui)', () => {
    // resolveWorkoutStartAction é agnóstico a versão: quem garante "só active"
    // é o chamador (homeSnapshot.ts / tela da rotina), coberto nos testes deles.
    const d = day({ id: 'a', weekdays: [1] });
    expect(resolveWorkoutStartAction([d], 1).kind).toBe('direct');
  });
});
