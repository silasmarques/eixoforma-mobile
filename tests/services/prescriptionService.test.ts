import { getVersionByStatus } from '@/repositories/planVersionRepository';
import { getWorkoutDayById, getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { createSession } from '@/repositories/workoutSessionRepository';
import { planService } from '@/services/planService';
import { getEditableVersion, prescriptionService } from '@/services/prescriptionService';
import { ReadOnlyPlanError, StaleVersionReferenceError } from '@/domain/prescriptionErrors';
import { PLAN_ID, PLAN_VERSION_ID } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
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
});
