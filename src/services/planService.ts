import { getSelectedPlanId, setSelectedPlanId } from '@/repositories/appPreferencesRepository';
import { generatePlanId, getPlanById, insertPlan, listPlans } from '@/repositories/planRepository';
import {
  activateVersion,
  checkStructuralCompleteness,
  createInitialVersion,
  getVersionById,
  getVersionByStatus,
  supersedeVersion,
} from '@/repositories/planVersionRepository';
import { IncompletePlanVersionError } from '@/domain/prescriptionErrors';
import type { PlanOrigin, WorkoutPlan, WorkoutPlanVersion } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';

export const planService = {
  listPlans: (client: SQLiteClient) => listPlans(client),
  getPlanById: (client: SQLiteClient, planId: string) => getPlanById(client, planId),
  getActiveVersion: (client: SQLiteClient, planId: string) => getVersionByStatus(client, planId, 'active'),
  getDraftVersion: (client: SQLiteClient, planId: string) => getVersionByStatus(client, planId, 'draft'),

  /** createPlan → cria WorkoutPlan → cria versão 1 como draft. Sem versão active até activatePlanVersion(). */
  async createPlan(
    client: SQLiteClient,
    params: { name: string; origin: PlanOrigin; createdByUserId?: string | null }
  ): Promise<{ plan: WorkoutPlan; draftVersion: WorkoutPlanVersion }> {
    const plan = await insertPlan(client, {
      id: generatePlanId(),
      name: params.name,
      origin: params.origin,
      createdByUserId: params.createdByUserId ?? null,
    });
    const draftVersion = await createInitialVersion(client, plan.id);
    return { plan, draftVersion };
  },

  /**
   * Ativa um draft: valida integridade estrutural mínima, arquiva a active
   * anterior (se houver) e ativa o draft — atomicamente. Se qualquer passo
   * falhar, a active anterior permanece active.
   */
  async activatePlanVersion(
    client: SQLiteClient,
    params: { planId: string; versionId: string }
  ): Promise<void> {
    const draft = await getVersionById(client, params.versionId);
    if (!draft || draft.planId !== params.planId) {
      throw new Error(`Versão ${params.versionId} não pertence ao plano ${params.planId}.`);
    }
    if (draft.status !== 'draft') {
      throw new Error(`Versão ${params.versionId} não está em draft (status atual: ${draft.status}).`);
    }

    const structural = await checkStructuralCompleteness(client, draft.id);
    if (!structural.valid) {
      throw new IncompletePlanVersionError(structural.reason ?? 'motivo desconhecido');
    }

    await client.withTransactionAsync(async () => {
      const currentActive = await getVersionByStatus(client, params.planId, 'active');
      if (currentActive) {
        await supersedeVersion(client, currentActive.id);
      }
      await activateVersion(client, draft.id);
    });
  },

  /**
   * Resolve o plano selecionado na UI, validando que ele ainda existe e tem
   * uma versão active — nunca assume singleton. Sem seleção válida, cai no
   * plano mais recente que já tenha versão active; se nenhum tiver, null.
   */
  async getSelectedPlan(client: SQLiteClient): Promise<WorkoutPlan | null> {
    const selectedId = await getSelectedPlanId(client);
    if (selectedId) {
      const plan = await getPlanById(client, selectedId);
      if (plan) {
        const active = await getVersionByStatus(client, plan.id, 'active');
        if (active) return plan;
      }
    }

    const plans = await listPlans(client);
    for (let i = plans.length - 1; i >= 0; i -= 1) {
      const active = await getVersionByStatus(client, plans[i].id, 'active');
      if (active) return plans[i];
    }
    return null;
  },

  async selectPlan(client: SQLiteClient, planId: string): Promise<void> {
    const plan = await getPlanById(client, planId);
    if (!plan) throw new Error(`Plano não encontrado: ${planId}`);
    await setSelectedPlanId(client, planId);
  },
};
