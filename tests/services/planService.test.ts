import { getVersionByStatus } from '@/repositories/planVersionRepository';
import { planService } from '@/services/planService';
import { prescriptionService } from '@/services/prescriptionService';
import {
  DraftNotDiscardableError,
  IncompletePlanVersionError,
  ReadOnlyPlanError,
} from '@/domain/prescriptionErrors';
import { PLAN_ID, PLAN_VERSION_ID } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
import { wrapWithRunFailureAfter } from '../support/failingClientWrapper';
import type { SQLiteClient } from '@/database/sqliteClient';

async function buildMinimalDay(client: SQLiteClient, planId: string, name: string) {
  const day = await prescriptionService.addDay(client, planId, {
    order: 1,
    name,
    description: '',
    muscleGroups: ['chest'],
    weekdays: [],
  });
  const exercise = await prescriptionService.addPrescribedExercise(client, planId, day.id, {
    exerciseId: 'ex_supino_reto_barra',
    order: 1,
    coachNote: null,
  });
  await prescriptionService.addPrescribedSet(client, planId, exercise.id, {
    order: 1,
    targetReps: 10,
    repRangeMin: null,
    repRangeMax: null,
    targetLoadKg: 20,
    restSeconds: 60,
    technique: 'normal',
    note: null,
  });
  return day;
}

describe('planService', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('createPlan cria o plano e a versão 1 como draft (sem versão active)', async () => {
    const { plan, draftVersion } = await planService.createPlan(client, {
      name: 'Meu treino livre',
      origin: 'personal',
    });

    expect(plan.origin).toBe('personal');
    expect(draftVersion.status).toBe('draft');
    expect(draftVersion.versionNumber).toBe(1);
    expect(await getVersionByStatus(client, plan.id, 'active')).toBeNull();
  });

  it('rejeita ativar uma versão estruturalmente incompleta', async () => {
    const { plan, draftVersion } = await planService.createPlan(client, {
      name: 'Plano vazio',
      origin: 'personal',
    });

    await expect(
      planService.activatePlanVersion(client, { planId: plan.id, versionId: draftVersion.id })
    ).rejects.toBeInstanceOf(IncompletePlanVersionError);
  });

  it('ativa um draft estruturalmente completo e ele passa a ser a versão active', async () => {
    const { plan, draftVersion } = await planService.createPlan(client, {
      name: 'Plano completo',
      origin: 'personal',
    });
    await buildMinimalDay(client, plan.id, 'Treino Único');

    await planService.activatePlanVersion(client, { planId: plan.id, versionId: draftVersion.id });

    const active = await getVersionByStatus(client, plan.id, 'active');
    expect(active?.id).toBe(draftVersion.id);
  });

  it('rejeita ativar uma versão que não pertence ao plano informado', async () => {
    const { plan: planA } = await planService.createPlan(client, { name: 'A', origin: 'personal' });
    const { draftVersion: draftB } = await planService.createPlan(client, {
      name: 'B',
      origin: 'personal',
    });

    await expect(
      planService.activatePlanVersion(client, { planId: planA.id, versionId: draftB.id })
    ).rejects.toThrow(/não pertence ao plano/);
  });

  it('rejeita ativar uma versão que não está em draft (ex.: já superseded)', async () => {
    const { plan, draftVersion: v1 } = await planService.createPlan(client, {
      name: 'Plano versionado',
      origin: 'personal',
    });
    await buildMinimalDay(client, plan.id, 'Treino V1');
    await planService.activatePlanVersion(client, { planId: plan.id, versionId: v1.id });

    // força a criação de um segundo draft (copy-on-write da active)
    const v2 = await prescriptionService.getEditableVersion(client, plan.id);
    await planService.activatePlanVersion(client, { planId: plan.id, versionId: v2.id });
    // v1 agora está superseded — tentar ativá-la de novo deve ser rejeitado
    await expect(
      planService.activatePlanVersion(client, { planId: plan.id, versionId: v1.id })
    ).rejects.toThrow(/não está em draft/);
  });

  it('activatePlanVersion é transacional: falha no meio não deixa a active anterior órfã', async () => {
    const { plan, draftVersion: v1 } = await planService.createPlan(client, {
      name: 'Plano transacional',
      origin: 'personal',
    });
    await buildMinimalDay(client, plan.id, 'Treino V1');
    await planService.activatePlanVersion(client, { planId: plan.id, versionId: v1.id });

    const v2 = await prescriptionService.getEditableVersion(client, plan.id);

    // Deixa passar 1 escrita (supersede da v1) e falha na 2ª (ativar a v2).
    const failingClient = wrapWithRunFailureAfter(client, 1);
    await expect(
      planService.activatePlanVersion(failingClient, { planId: plan.id, versionId: v2.id })
    ).rejects.toThrow('Falha simulada');

    // Nada deveria ter mudado: v1 continua active, v2 continua draft.
    const active = await getVersionByStatus(client, plan.id, 'active');
    const draft = await getVersionByStatus(client, plan.id, 'draft');
    expect(active?.id).toBe(v1.id);
    expect(draft?.id).toBe(v2.id);
  });

  it('getSelectedPlan: sem seleção, cai no fallback do plano mais recente com versão active', async () => {
    const snapshot = await planService.getSelectedPlan(client);
    expect(snapshot?.id).toBe(PLAN_ID);
  });

  it('getSelectedPlan: seleção inválida (plano inexistente) cai no fallback', async () => {
    await client.runAsync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?);', [
      'selected_plan_id',
      'plano_que_nao_existe',
    ]);

    const snapshot = await planService.getSelectedPlan(client);
    expect(snapshot?.id).toBe(PLAN_ID);
  });

  it('getSelectedPlan: seleção válida mas sem versão active cai no fallback', async () => {
    const { plan } = await planService.createPlan(client, { name: 'Sem versão pronta', origin: 'personal' });
    await planService.selectPlan(client, plan.id);

    const snapshot = await planService.getSelectedPlan(client);
    expect(snapshot?.id).toBe(PLAN_ID);
  });

  it('selectPlan rejeita planId inexistente', async () => {
    await expect(planService.selectPlan(client, 'plano_fantasma')).rejects.toThrow(/não encontrado/);
  });

  describe('resolveViewableVersion (não cria draft por visualização)', () => {
    it('abrir os detalhes de um plano só active NÃO cria draft', async () => {
      const before = await getVersionByStatus(client, PLAN_ID, 'draft');
      expect(before).toBeNull();

      const viewed = await planService.resolveViewableVersion(client, PLAN_ID);
      expect(viewed?.id).toBe(PLAN_VERSION_ID);
      expect(viewed?.status).toBe('active');

      const after = await getVersionByStatus(client, PLAN_ID, 'draft');
      expect(after).toBeNull(); // continua sem draft — só visualizar não muta nada
    });

    it('tocar em "Editar" (getEditableVersion) cria/reaproveita o draft — aí sim', async () => {
      // com um plano personal já ativo (prescribed é somente leitura, nunca gera draft)
      const { plan, draftVersion: v1 } = await planService.createPlan(client, {
        name: 'Plano personal ativo',
        origin: 'personal',
      });
      await buildMinimalDay(client, plan.id, 'Treino Único');
      await planService.activatePlanVersion(client, { planId: plan.id, versionId: v1.id });

      expect(await getVersionByStatus(client, plan.id, 'draft')).toBeNull();

      const draft = await prescriptionService.getEditableVersion(client, plan.id);
      expect(draft.status).toBe('draft');

      const afterEdit = await getVersionByStatus(client, plan.id, 'draft');
      expect(afterEdit?.id).toBe(draft.id);

      // visualizar de novo agora mostra o draft (reflete a edição em curso)
      const viewed = await planService.resolveViewableVersion(client, plan.id);
      expect(viewed?.id).toBe(draft.id);
    });

    it('abrir os detalhes de um plano prescribed nunca cria draft (é sempre somente leitura)', async () => {
      const viewed = await planService.resolveViewableVersion(client, PLAN_ID);
      expect(viewed?.id).toBe(PLAN_VERSION_ID);
      await expect(prescriptionService.getEditableVersion(client, PLAN_ID)).rejects.toBeInstanceOf(
        ReadOnlyPlanError
      );
      expect(await getVersionByStatus(client, PLAN_ID, 'draft')).toBeNull();
    });
  });

  describe('discardDraft', () => {
    async function buildActivePlusDraft(client: SQLiteClient) {
      const { plan, draftVersion: v1 } = await planService.createPlan(client, {
        name: 'Plano com draft',
        origin: 'personal',
      });
      await buildMinimalDay(client, plan.id, 'Treino V1');
      await planService.activatePlanVersion(client, { planId: plan.id, versionId: v1.id });
      const v2 = await prescriptionService.getEditableVersion(client, plan.id);
      await prescriptionService.addDay(client, plan.id, {
        order: 2,
        name: 'Treino V2 extra',
        description: '',
        muscleGroups: ['back'],
        weekdays: [],
      });
      return { plan, v1, v2 };
    }

    it('descarta o draft preservando a active intacta', async () => {
      const { plan, v1 } = await buildActivePlusDraft(client);

      await planService.discardDraft(client, plan.id);

      expect(await getVersionByStatus(client, plan.id, 'draft')).toBeNull();
      const active = await getVersionByStatus(client, plan.id, 'active');
      expect(active?.id).toBe(v1.id);
    });

    it('o descarte remove toda a árvore do draft (dias, exercícios, séries)', async () => {
      const { plan, v2 } = await buildActivePlusDraft(client);

      await planService.discardDraft(client, plan.id);

      const remainingDays = await client.getAllAsync(
        'SELECT id FROM workout_days WHERE plan_version_id = ?;',
        [v2.id]
      );
      expect(remainingDays).toEqual([]);
      const remainingVersion = await getVersionByStatus(client, plan.id, 'draft');
      expect(remainingVersion).toBeNull();
    });

    it('rejeita descartar quando não há draft', async () => {
      const { plan } = await planService.createPlan(client, { name: 'Só ativo', origin: 'personal' });
      await buildMinimalDay(client, plan.id, 'Único');
      const v1 = await getVersionByStatus(client, plan.id, 'draft');
      await planService.activatePlanVersion(client, { planId: plan.id, versionId: v1!.id });

      await expect(planService.discardDraft(client, plan.id)).rejects.toBeInstanceOf(
        DraftNotDiscardableError
      );
    });

    it('rejeita descartar quando o plano nunca teve uma versão active (não é "descartar alterações", é outra operação)', async () => {
      const { plan } = await planService.createPlan(client, { name: 'Novo, nunca ativado', origin: 'personal' });
      await expect(planService.discardDraft(client, plan.id)).rejects.toBeInstanceOf(
        DraftNotDiscardableError
      );
    });

    it('rejeita descartar draft de plano prescribed', async () => {
      await expect(planService.discardDraft(client, PLAN_ID)).rejects.toBeInstanceOf(ReadOnlyPlanError);
    });
  });
});
