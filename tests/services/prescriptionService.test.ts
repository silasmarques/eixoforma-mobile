import { getVersionByStatus } from '@/repositories/planVersionRepository';
import { getWorkoutDayById, getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { createSession } from '@/repositories/workoutSessionRepository';
import { planService } from '@/services/planService';
import { getEditableVersion, prescriptionService } from '@/services/prescriptionService';
import { ReadOnlyPlanError, StaleVersionReferenceError } from '@/domain/prescriptionErrors';
import { PLAN_ID, PLAN_VERSION_ID } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
import { wrapWithRunFailureAfter } from '../support/failingClientWrapper';
import type { SQLiteClient } from '@/database/sqliteClient';

describe('prescriptionService', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('origin=prescribed é somente leitura — toda escrita é rejeitada, mesmo a do repository não ter noção disso', async () => {
    await expect(getEditableVersion(client, PLAN_ID)).rejects.toBeInstanceOf(ReadOnlyPlanError);
    await expect(
      prescriptionService.addDay(client, PLAN_ID, {
        order: 1,
        name: 'x',
        description: '',
        muscleGroups: ['chest'],
        weekdays: [],
      })
    ).rejects.toBeInstanceOf(ReadOnlyPlanError);
    await expect(
      prescriptionService.updateDay(client, PLAN_ID, 'day_treino_a', { name: 'Hackeado' })
    ).rejects.toBeInstanceOf(ReadOnlyPlanError);
    await expect(
      prescriptionService.addPrescribedSet(client, PLAN_ID, 'pex_a_supino_reto', {
        order: 99,
        targetReps: 1,
        repRangeMin: null,
        repRangeMax: null,
        targetLoadKg: null,
        restSeconds: 30,
        technique: 'normal',
        note: null,
      })
    ).rejects.toBeInstanceOf(ReadOnlyPlanError);
  });

  it('getEditableVersion reaproveita o mesmo draft em chamadas seguidas (não cria dois)', async () => {
    const { plan } = await planService.createPlan(client, { name: 'Editável', origin: 'personal' });

    const first = await getEditableVersion(client, plan.id);
    const second = await getEditableVersion(client, plan.id);

    expect(second.id).toBe(first.id);
  });

  it('não é possível existir dois drafts para o mesmo plano (constraint de banco)', async () => {
    const { plan, draftVersion } = await planService.createPlan(client, {
      name: 'Único draft',
      origin: 'personal',
    });

    await expect(
      client.runAsync(
        'INSERT INTO workout_plan_versions (id, plan_id, version_number, status, created_at, activated_at) VALUES (?, ?, ?, ?, ?, NULL);',
        ['outro_draft', plan.id, draftVersion.versionNumber + 1, 'draft', new Date().toISOString()]
      )
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('editar a versão active (sem draft existente) cria um draft novo via copy-on-write — a active nunca é editada em lugar', async () => {
    const { plan, draftVersion: v1 } = await planService.createPlan(client, {
      name: 'Fluxo completo',
      origin: 'personal',
    });
    const day = await prescriptionService.addDay(client, plan.id, {
      order: 1,
      name: 'Treino Único',
      description: '',
      muscleGroups: ['chest'],
      weekdays: [],
    });
    const exercise = await prescriptionService.addPrescribedExercise(client, plan.id, day.id, {
      exerciseId: 'ex_supino_reto_barra',
      order: 1,
      coachNote: null,
    });
    await prescriptionService.addPrescribedSet(client, plan.id, exercise.id, {
      order: 1,
      targetReps: 10,
      repRangeMin: null,
      repRangeMax: null,
      targetLoadKg: 20,
      restSeconds: 60,
      technique: 'normal',
      note: null,
    });
    await planService.activatePlanVersion(client, { planId: plan.id, versionId: v1.id });

    // agora v1 é active — usar o dayId antigo (da v1) é stale por definição:
    // getEditableVersion cria a v2 com ids novos, e o id antigo não pertence
    // a ela. É o comportamento correto (evita editar silenciosamente a
    // versão errada) — o chamador deve reler a árvore da versão editável.
    await expect(
      prescriptionService.updateDay(client, plan.id, day.id, { name: 'Não deveria aplicar' })
    ).rejects.toBeInstanceOf(StaleVersionReferenceError);

    const v2 = await getVersionByStatus(client, plan.id, 'draft');
    expect(v2).not.toBeNull();
    expect(v2!.versionNumber).toBe(2);

    // o dia original (da v1, ainda active) não foi alterado
    const dayStillOnV1 = await getWorkoutDayById(client, day.id);
    expect(dayStillOnV1?.name).toBe('Treino Único');

    // o caminho correto: reler a árvore da versão editável e editar o id novo
    const daysOnDraft = await getWorkoutDaySummaries(client, v2!.id);
    await prescriptionService.updateDay(client, plan.id, daysOnDraft[0].id, { name: 'Nome atualizado' });
    const updatedDay = await getWorkoutDayById(client, daysOnDraft[0].id);
    expect(updatedDay?.name).toBe('Nome atualizado');
  });

  it('rejeita edição com um id que não pertence à versão editável (StaleVersionReferenceError)', async () => {
    const { plan } = await planService.createPlan(client, { name: 'Plano X', origin: 'personal' });
    const { plan: outroPlano } = await planService.createPlan(client, {
      name: 'Plano Y',
      origin: 'personal',
    });
    const dayDoOutroPlano = await prescriptionService.addDay(client, outroPlano.id, {
      order: 1,
      name: 'Dia de outro plano',
      description: '',
      muscleGroups: ['back'],
      weekdays: [],
    });

    await expect(
      prescriptionService.updateDay(client, plan.id, dayDoOutroPlano.id, { name: 'Tentativa inválida' })
    ).rejects.toBeInstanceOf(StaleVersionReferenceError);
  });

  it('PerformedSet criado numa sessão pode ser relacionado ao prescribedSetId correspondente', async () => {
    const session = await createSession(client, {
      planId: PLAN_ID,
      planVersionId: PLAN_VERSION_ID,
      dayId: 'day_treino_a',
    });
    const performedSet = session.exercises[0].sets[0];
    const day = await getWorkoutDayById(client, 'day_treino_a');
    const prescribedSetIds = day!.exercises[0].sets.map((s) => s.id);

    expect(prescribedSetIds).toContain(performedSet.prescribedSetId);
  });

  describe('replacePrescribedSets (editor de séries / configuração rápida)', () => {
    async function buildPersonalExerciseWithSets(client: SQLiteClient, count: number) {
      const { plan } = await planService.createPlan(client, { name: 'Plano de teste', origin: 'personal' });
      const day = await prescriptionService.addDay(client, plan.id, {
        order: 1,
        name: 'Treino',
        description: '',
        muscleGroups: ['chest'],
        weekdays: [],
      });
      const exercise = await prescriptionService.addPrescribedExercise(client, plan.id, day.id, {
        exerciseId: 'ex_supino_reto_barra',
        order: 1,
        coachNote: null,
      });
      for (let i = 0; i < count; i += 1) {
        await prescriptionService.addPrescribedSet(client, plan.id, exercise.id, {
          order: i + 1,
          targetReps: 10,
          repRangeMin: null,
          repRangeMax: null,
          targetLoadKg: 20,
          restSeconds: 60,
          technique: 'normal',
          note: null,
        });
      }
      return { plan, day, exercise };
    }

    it('preserva os dbId existentes quando a quantidade de séries não muda (configuração rápida: 4 → 4)', async () => {
      const { plan, day, exercise } = await buildPersonalExerciseWithSets(client, 4);
      const before = await getWorkoutDayById(client, day.id);
      const existingIds = before!.exercises[0].sets.map((s) => s.id);

      await prescriptionService.replacePrescribedSets(
        client,
        plan.id,
        exercise.id,
        existingIds.map((dbId) => ({
          dbId,
          targetReps: 12,
          repRangeMin: null,
          repRangeMax: null,
          targetLoadKg: 30,
          restSeconds: 90,
          technique: 'normal' as const,
          note: null,
        }))
      );

      const after = await getWorkoutDayById(client, before!.id);
      expect(after!.exercises[0].sets.map((s) => s.id)).toEqual(existingIds);
      expect(after!.exercises[0].sets.every((s) => s.targetReps === 12)).toBe(true);
    });

    it('adiciona só as séries a mais quando a quantidade aumenta (4 → 5)', async () => {
      const { plan, day, exercise } = await buildPersonalExerciseWithSets(client, 4);
      const dayId = day.id;
      const before = await getWorkoutDayById(client, dayId);
      const existingIds = before!.exercises[0].sets.map((s) => s.id);

      const draft = [
        ...existingIds.map((dbId) => ({
          dbId,
          targetReps: 10,
          repRangeMin: null,
          repRangeMax: null,
          targetLoadKg: 20,
          restSeconds: 60,
          technique: 'normal' as const,
          note: null,
        })),
        {
          targetReps: 8,
          repRangeMin: null,
          repRangeMax: null,
          targetLoadKg: 25,
          restSeconds: 60,
          technique: 'drop_set' as const,
          note: null,
        },
      ];
      await prescriptionService.replacePrescribedSets(client, plan.id, exercise.id, draft);

      const after = await getWorkoutDayById(client, dayId);
      const afterIds = after!.exercises[0].sets.map((s) => s.id);
      expect(afterIds).toHaveLength(5);
      expect(afterIds.slice(0, 4)).toEqual(existingIds); // os 4 primeiros preservam o id
      expect(afterIds[4]).not.toBe(''); // o 5º é novo
    });

    it('remove só as séries excedentes quando a quantidade diminui (4 → 3)', async () => {
      const { plan, day, exercise } = await buildPersonalExerciseWithSets(client, 4);
      const dayId = day.id;
      const before = await getWorkoutDayById(client, dayId);
      const existingIds = before!.exercises[0].sets.map((s) => s.id);

      await prescriptionService.replacePrescribedSets(
        client,
        plan.id,
        exercise.id,
        existingIds.slice(0, 3).map((dbId) => ({
          dbId,
          targetReps: 10,
          repRangeMin: null,
          repRangeMax: null,
          targetLoadKg: 20,
          restSeconds: 60,
          technique: 'normal' as const,
          note: null,
        }))
      );

      const after = await getWorkoutDayById(client, dayId);
      expect(after!.exercises[0].sets.map((s) => s.id)).toEqual(existingIds.slice(0, 3));
    });

    it('cancelar (nunca chamar replacePrescribedSets) não persiste nada — nenhum PrescribedExercise/PrescribedSet órfão', async () => {
      const { plan } = await planService.createPlan(client, { name: 'Plano cancelado', origin: 'personal' });
      const day = await prescriptionService.addDay(client, plan.id, {
        order: 1,
        name: 'Treino',
        description: '',
        muscleGroups: ['chest'],
        weekdays: [],
      });
      // usuário "abre configurar exercício" mas nunca confirma — nenhuma
      // chamada de serviço acontece, então não há nada a verificar além de
      // confirmar que a rotina continua sem exercícios.
      const reloaded = await getWorkoutDayById(client, day.id);
      expect(reloaded!.exercises).toHaveLength(0);
    });

    it('é transacional: falha no meio não deixa a lista de séries pela metade', async () => {
      const { plan, day, exercise } = await buildPersonalExerciseWithSets(client, 2);
      const dayId = day.id;
      const before = await getWorkoutDayById(client, dayId);
      const beforeIds = before!.exercises[0].sets.map((s) => s.id);

      const failingClient = wrapWithRunFailureAfter(client, 1);
      await expect(
        prescriptionService.replacePrescribedSets(failingClient, plan.id, exercise.id, [
          {
            targetReps: 10,
            repRangeMin: null,
            repRangeMax: null,
            targetLoadKg: 20,
            restSeconds: 60,
            technique: 'normal',
            note: null,
          },
          {
            targetReps: 10,
            repRangeMin: null,
            repRangeMax: null,
            targetLoadKg: 20,
            restSeconds: 60,
            technique: 'normal',
            note: null,
          },
          {
            targetReps: 10,
            repRangeMin: null,
            repRangeMax: null,
            targetLoadKg: 20,
            restSeconds: 60,
            technique: 'normal',
            note: null,
          },
        ])
      ).rejects.toThrow('Falha simulada');

      const after = await getWorkoutDayById(client, dayId);
      expect(after!.exercises[0].sets.map((s) => s.id)).toEqual(beforeIds);
    });
  });
});
