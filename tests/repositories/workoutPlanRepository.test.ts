import {
  duplicateDay,
  getPrescribedExerciseDetail,
  getWorkoutDayById,
  getWorkoutDaySummaries,
  reorderDays,
  reorderPrescribedExercises,
  reorderPrescribedSets,
} from '@/repositories/workoutPlanRepository';
import { completeSession, createSession } from '@/repositories/workoutSessionRepository';
import { ReorderValidationError } from '@/domain/prescriptionErrors';
import { PLAN_ID, PLAN_VERSION_ID, mockWorkoutDays } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
import type { SQLiteClient } from '@/database/sqliteClient';

const DAY_A = 'day_treino_a';
const DAY_B = 'day_treino_b';
const DAY_C = 'day_treino_c';

describe('workoutPlanRepository', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('lista os dias de treino com a contagem de exercícios, descrição e duração estimada', async () => {
    const summaries = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);

    expect(summaries).toHaveLength(3);
    expect(summaries[0]).toMatchObject({
      name: 'Treino A',
      planId: PLAN_ID,
      description: mockWorkoutDays[0].description,
      exerciseCount: 6,
      lastPerformedAt: null,
      weekdays: [1, 4],
    });
    expect(summaries[0].estimatedDurationMinutes).toBeGreaterThan(0);
  });

  it('registra a última execução do dia depois de uma sessão concluída', async () => {
    const before = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
    expect(before[0].lastPerformedAt).toBeNull();

    const session = await createSession(client, {
      planId: PLAN_ID,
      planVersionId: PLAN_VERSION_ID,
      dayId: DAY_A,
    });
    await completeSession(client, session.id);

    const after = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
    expect(after[0].lastPerformedAt).not.toBeNull();
  });

  it('lê um dia com a árvore completa de exercícios em ordem e séries prescritas', async () => {
    const day = await getWorkoutDayById(client, DAY_A);

    expect(day).not.toBeNull();
    expect(day?.planId).toBe(PLAN_ID);
    expect(day?.exercises).toHaveLength(6);
    expect(day?.exercises.map((e) => e.order)).toEqual([1, 2, 3, 4, 5, 6]);

    const firstExercise = day!.exercises[0];
    const mockFirstExercise = mockWorkoutDays[0].exercises[0];
    expect(firstExercise.sets).toHaveLength(mockFirstExercise.sets.length);
    expect(firstExercise.sets.map((s) => s.order)).toEqual(
      mockFirstExercise.sets.map((s) => s.order)
    );
    expect(firstExercise.sets[1]).toMatchObject({
      targetReps: mockFirstExercise.sets[1].targetReps,
      targetLoadKg: mockFirstExercise.sets[1].targetLoadKg,
      restSeconds: mockFirstExercise.sets[1].restSeconds,
    });
  });

  it('preserva a técnica prescrita de cada série (aquecimento, normal, drop set)', async () => {
    const day = await getWorkoutDayById(client, DAY_A);
    const sets = day!.exercises[0].sets;

    expect(sets[0].technique).toBe('warmup');
    expect(sets[1].technique).toBe('normal');

    const crucifixo = day!.exercises[2];
    expect(crucifixo.sets[crucifixo.sets.length - 1].technique).toBe('drop_set');
  });

  it('retorna null para um dia inexistente', async () => {
    const day = await getWorkoutDayById(client, 'day_inexistente');
    expect(day).toBeNull();
  });

  it('lê o detalhe de um exercício prescrito com o catálogo e o dia associados', async () => {
    const detail = await getPrescribedExerciseDetail(client, 'pex_a_supino_reto');

    expect(detail).not.toBeNull();
    expect(detail?.dayId).toBe(DAY_A);
    expect(detail?.dayName).toBe('Treino A');
    expect(detail?.exercise.name).toBe('Supino reto com barra');
    expect(detail?.exercise.primaryMuscleGroup).toBe('chest');
    expect(detail?.prescribedExercise.sets).toHaveLength(4);
  });

  it('retorna null para um exercício prescrito inexistente', async () => {
    const detail = await getPrescribedExerciseDetail(client, 'pex_inexistente');
    expect(detail).toBeNull();
  });

  it('a leitura repetida do mesmo dia não altera a prescrição (navegação idempotente)', async () => {
    const first = await getWorkoutDayById(client, DAY_A);
    const second = await getWorkoutDayById(client, DAY_A);
    expect(second).toEqual(first);
  });

  it('a coluna legada workout_days.plan_id não é usada por nenhuma leitura nova', async () => {
    // corrompe deliberadamente a coluna legada com um plano-chamariz válido
    // (a FK exige um id existente) — se algum código novo ainda dependesse
    // dela, isso quebraria as leituras abaixo.
    const now = new Date().toISOString();
    await client.runAsync(
      'INSERT INTO workout_plans (id, name, origin, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?);',
      ['plano_chamariz', 'Chamariz', 'personal', now, now]
    );
    await client.runAsync("UPDATE workout_days SET plan_id = 'plano_chamariz';");

    const day = await getWorkoutDayById(client, DAY_A);
    expect(day?.planId).toBe(PLAN_ID); // veio do JOIN com workout_plan_versions, não da coluna legada

    const summaries = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
    expect(summaries.every((s) => s.planId === PLAN_ID)).toBe(true);
  });

  describe('reorderDays', () => {
    it('aceita uma permutação válida e normaliza para 1..N', async () => {
      await reorderDays(client, PLAN_VERSION_ID, [DAY_C, DAY_A, DAY_B]);
      const summaries = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
      const orderById = Object.fromEntries(summaries.map((s) => [s.id, s.order]));
      expect(orderById[DAY_C]).toBe(1);
      expect(orderById[DAY_A]).toBe(2);
      expect(orderById[DAY_B]).toBe(3);
    });

    it('rejeita id duplicado', async () => {
      await expect(
        reorderDays(client, PLAN_VERSION_ID, [DAY_A, DAY_A, DAY_B])
      ).rejects.toBeInstanceOf(ReorderValidationError);
    });

    it('rejeita array incompleto (id ausente)', async () => {
      await expect(reorderDays(client, PLAN_VERSION_ID, [DAY_A, DAY_B])).rejects.toBeInstanceOf(
        ReorderValidationError
      );
    });

    it('rejeita id de outro pai (estrangeiro)', async () => {
      await expect(
        reorderDays(client, PLAN_VERSION_ID, [DAY_A, DAY_B, 'id_que_nao_existe'])
      ).rejects.toBeInstanceOf(ReorderValidationError);
    });

    it('reorder nunca funciona como delete — uma tentativa rejeitada não altera nada', async () => {
      const before = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
      await expect(reorderDays(client, PLAN_VERSION_ID, [DAY_A, DAY_B])).rejects.toThrow();
      const after = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
      expect(after).toHaveLength(before.length);
    });
  });

  describe('reorderPrescribedExercises / reorderPrescribedSets', () => {
    it('reordena exercícios de um dia normalizando 1..N', async () => {
      const day = await getWorkoutDayById(client, DAY_A);
      const ids = day!.exercises.map((e) => e.id);
      const swapped = [ids[1], ids[0], ...ids.slice(2)];

      await reorderPrescribedExercises(client, DAY_A, swapped);

      const reloaded = await getWorkoutDayById(client, DAY_A);
      expect(reloaded!.exercises.map((e) => e.id)).toEqual(swapped);
      expect(reloaded!.exercises.map((e) => e.order)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('rejeita reorder de exercícios com id de outro dia', async () => {
      const dayB = await getWorkoutDayById(client, DAY_B);
      await expect(
        reorderPrescribedExercises(client, DAY_A, [dayB!.exercises[0].id])
      ).rejects.toBeInstanceOf(ReorderValidationError);
    });

    it('reordena séries de um exercício normalizando 1..N', async () => {
      const day = await getWorkoutDayById(client, DAY_A);
      const sets = day!.exercises[0].sets;
      const reversed = [...sets].reverse().map((s) => s.id);

      await reorderPrescribedSets(client, day!.exercises[0].id, reversed);

      const reloaded = await getWorkoutDayById(client, DAY_A);
      expect(reloaded!.exercises[0].sets.map((s) => s.id)).toEqual(reversed);
      expect(reloaded!.exercises[0].sets.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('duplicateDay', () => {
    it('copia a rotina inteira (exercícios, séries, weekdays) com ids novos ao final da lista', async () => {
      const original = await getWorkoutDayById(client, DAY_A);
      const duplicated = await duplicateDay(client, DAY_A);

      expect(duplicated.id).not.toBe(DAY_A);
      expect(duplicated.name).toBe('Treino A (cópia)');
      expect(duplicated.order).toBe(4); // ao final dos 3 dias existentes
      expect(duplicated.weekdays).toEqual(original!.weekdays);
      expect(duplicated.exercises).toHaveLength(original!.exercises.length);
      expect(duplicated.exercises[0].id).not.toBe(original!.exercises[0].id);
      expect(duplicated.exercises[0].sets).toHaveLength(original!.exercises[0].sets.length);
      expect(duplicated.exercises[0].sets[0].id).not.toBe(original!.exercises[0].sets[0].id);

      // a original continua intacta
      const originalAfter = await getWorkoutDayById(client, DAY_A);
      expect(originalAfter).toEqual(original);
    });

    it('editar a cópia não afeta a rotina original', async () => {
      const duplicated = await duplicateDay(client, DAY_A);
      await client.runAsync('UPDATE workout_days SET name = ? WHERE id = ?;', ['Editado', duplicated.id]);

      const original = await getWorkoutDayById(client, DAY_A);
      expect(original?.name).toBe('Treino A');
    });
  });
});
