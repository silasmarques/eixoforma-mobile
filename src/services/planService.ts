import { getSelectedPlanId, setSelectedPlanId } from '@/repositories/appPreferencesRepository';
import { generatePlanId, getPlanById, insertPlan, listPlans } from '@/repositories/planRepository';
import {
  activateVersion,
  checkStructuralCompleteness,
  createInitialVersion,
  discardDraftVersion,
  getVersionById,
  getVersionByStatus,
  supersedeVersion,
} from '@/repositories/planVersionRepository';
import { DraftNotDiscardableError, IncompletePlanVersionError, ReadOnlyPlanError } from '@/domain/prescriptionErrors';
import type { PlanOrigin, WorkoutPlan, WorkoutPlanVersion } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';

export const planService = {
  listPlans: (client: SQLiteClient) => listPlans(client),
  getPlanById: (client: SQLiteClient, planId: string) => getPlanById(client, planId),
  getActiveVersion: (client: SQLiteClient, planId: string) => getVersionByStatus(client, planId, 'active'),
  getDraftVersion: (client: SQLiteClient, planId: string) => getVersionByStatus(client, planId, 'draft'),

  /**
   * Resolve a versão a EXIBIR ao abrir os detalhes de um plano — nunca cria
   * nada. Prefere o draft (reflete a edição mais recente) quando existir,
   * senão a active. `prescriptionService.getEditableVersion` é a única
   * função que pode criar um draft, e só deve ser chamada quando o usuário
   * toca explicitamente em "Editar plano".
   */
  async resolveViewableVersion(client: SQLiteClient, planId: string): Promise<WorkoutPlanVersion | null> {
    const draft = await getVersionByStatus(client, planId, 'draft');
    if (draft) return draft;
    return getVersionByStatus(client, planId, 'active');
  },

  /** createPlan → cria WorkoutPlan → cria versão 1 como draft. Sem versão active até activatePlanVersion(). */
  async createPlan(
    client: SQLiteClient,
    params: { name: string; goal?: string | null; origin: PlanOrigin; createdByUserId?: string | null }
  ): Promise<{ plan: WorkoutPlan; draftVersion: WorkoutPlanVersion }> {
    const plan = await insertPlan(client, {
      id: generatePlanId(),
      name: params.name,
      goal: params.goal ?? null,
      origin: params.origin,
      createdByUserId: params.createdByUserId ?? null,
    });
    const draftVersion = await createInitialVersion(client, plan.id);
    return { plan, draftVersion };
  },

  /**
   * Descarta um draft preservando a active intacta. Só para planos
   * personal com active + draft coexistindo — um plano que nunca foi
   * ativado (só tem a versão 1, em draft) não se qualifica: descartar essa
   * seria apagar o plano inteiro, uma operação diferente (não oferecida
   * neste checkpoint).
   */
  async discardDraft(client: SQLiteClient, planId: string): Promise<void> {
    const plan = await getPlanById(client, planId);
    if (!plan) throw new Error(`Plano não encontrado: ${planId}`);
    if (plan.origin !== 'personal') throw new ReadOnlyPlanError(planId);

    const draft = await getVersionByStatus(client, planId, 'draft');
    if (!draft) throw new DraftNotDiscardableError('este plano não tem nenhum draft para descartar.');

    const active = await getVersionByStatus(client, planId, 'active');
    if (!active) {
      throw new DraftNotDiscardableError(
        'este plano nunca foi ativado — descartar aqui apagaria a única versão existente.'
      );
    }

    await discardDraftVersion(client, draft.id);
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
