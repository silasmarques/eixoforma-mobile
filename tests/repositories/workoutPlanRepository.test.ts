import {
  getWorkoutDayById,
  getWorkoutDaySummaries,
} from '@/repositories/workoutPlanRepository';
import { mockWorkoutPlan } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
import type { SQLiteClient } from '@/database/sqliteClient';

describe('workoutPlanRepository', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('lista os dias de treino com a contagem de exercícios', async () => {
    const summaries = await getWorkoutDaySummaries(client);

    expect(summaries).toHaveLength(3);
    expect(summaries[0]).toMatchObject({ name: 'Treino A', exerciseCount: 6 });
  });

  it('lê um dia com a árvore completa de exercícios e séries prescritas', async () => {
    const day = await getWorkoutDayById(client, 'day_treino_a');

    expect(day).not.toBeNull();
    expect(day?.exercises).toHaveLength(6);

    const firstExercise = day!.exercises[0];
    const mockFirstExercise = mockWorkoutPlan.days[0].exercises[0];
    expect(firstExercise.sets).toHaveLength(mockFirstExercise.sets.length);
    expect(firstExercise.sets[1]).toMatchObject({
      targetReps: mockFirstExercise.sets[1].targetReps,
      targetLoadKg: mockFirstExercise.sets[1].targetLoadKg,
      restSeconds: mockFirstExercise.sets[1].restSeconds,
    });
  });

  it('retorna null para um dia inexistente', async () => {
    const day = await getWorkoutDayById(client, 'day_inexistente');
    expect(day).toBeNull();
  });
});
