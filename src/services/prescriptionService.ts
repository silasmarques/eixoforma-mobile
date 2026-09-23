import { getPlanById } from '@/repositories/planRepository';
import { createDraftFromVersion, getVersionByStatus } from '@/repositories/planVersionRepository';
import {
  addDay as repoAddDay,
  addPrescribedExercise as repoAddPrescribedExercise,
  addPrescribedSet as repoAddPrescribedSet,
  dayBelongsToVersion,
  prescribedExerciseBelongsToVersion,
  prescribedSetBelongsToVersion,
  removeDay as repoRemoveDay,
  removePrescribedExercise as repoRemovePrescribedExercise,
  removePrescribedSet as repoRemovePrescribedSet,
  setDayWeekdays as repoSetDayWeekdays,
  updateDay as repoUpdateDay,
  updatePrescribedExercise as repoUpdatePrescribedExercise,
  updatePrescribedSet as repoUpdatePrescribedSet,
  type AddDayInput,
  type AddPrescribedExerciseInput,
  type AddPrescribedSetInput,
  type UpdateDayInput,
  type UpdatePrescribedExerciseInput,
  type UpdatePrescribedSetInput,
} from '@/repositories/workoutPlanRepository';
import { InvalidPlanStateError, ReadOnlyPlanError, StaleVersionReferenceError } from '@/domain/prescriptionErrors';
import type { WorkoutPlanVersion } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';

/**
 * Ponto único de decisão de política de versionamento — toda escrita de
 * prescrição passa por aqui antes de tocar o repository. Nunca edita
 * `active` em lugar: reaproveita um draft existente ou cria um novo
 * (copy-on-write atômico) a partir da versão `active`.
 */
export async function getEditableVersion(client: SQLiteClient, planId: string): Promise<WorkoutPlanVersion> {
  const plan = await getPlanById(client, planId);
  if (!plan) throw new Error(`Plano não encontrado: ${planId}`);
  if (plan.origin === 'prescribed') throw new ReadOnlyPlanError(planId);

  const draft = await getVersionByStatus(client, planId, 'draft');
  if (draft) return draft;

  const active = await getVersionByStatus(client, planId, 'active');
  if (!active) throw new InvalidPlanStateError(planId);

  return createDraftFromVersion(client, active.id);
}

async function assertDayEditable(client: SQLiteClient, planId: string, dayId: string) {
  const version = await getEditableVersion(client, planId);
  if (!(await dayBelongsToVersion(client, dayId, version.id))) {
    throw new StaleVersionReferenceError('WorkoutDay', dayId);
  }
  return version;
}

async function assertPrescribedExerciseEditable(
  client: SQLiteClient,
  planId: string,
  prescribedExerciseId: string
) {
  const version = await getEditableVersion(client, planId);
  if (!(await prescribedExerciseBelongsToVersion(client, prescribedExerciseId, version.id))) {
    throw new StaleVersionReferenceError('PrescribedExercise', prescribedExerciseId);
  }
  return version;
}

async function assertPrescribedSetEditable(client: SQLiteClient, planId: string, prescribedSetId: string) {
  const version = await getEditableVersion(client, planId);
  if (!(await prescribedSetBelongsToVersion(client, prescribedSetId, version.id))) {
    throw new StaleVersionReferenceError('PrescribedSet', prescribedSetId);
  }
  return version;
}

export const prescriptionService = {
  getEditableVersion,

  async addDay(client: SQLiteClient, planId: string, input: Omit<AddDayInput, 'planVersionId'>) {
    const version = await getEditableVersion(client, planId);
    return repoAddDay(client, { ...input, planVersionId: version.id });
  },

  async updateDay(client: SQLiteClient, planId: string, dayId: string, input: UpdateDayInput) {
    await assertDayEditable(client, planId, dayId);
    await repoUpdateDay(client, dayId, input);
  },

  async removeDay(client: SQLiteClient, planId: string, dayId: string) {
    await assertDayEditable(client, planId, dayId);
    await repoRemoveDay(client, dayId);
  },

  async setDayWeekdays(client: SQLiteClient, planId: string, dayId: string, weekdays: number[]) {
    await assertDayEditable(client, planId, dayId);
    await repoSetDayWeekdays(client, dayId, weekdays);
  },

  async addPrescribedExercise(
    client: SQLiteClient,
    planId: string,
    dayId: string,
    input: Omit<AddPrescribedExerciseInput, 'dayId'>
  ) {
    await assertDayEditable(client, planId, dayId);
    return repoAddPrescribedExercise(client, { ...input, dayId });
  },

  async updatePrescribedExercise(
    client: SQLiteClient,
    planId: string,
    prescribedExerciseId: string,
    input: UpdatePrescribedExerciseInput
  ) {
    await assertPrescribedExerciseEditable(client, planId, prescribedExerciseId);
    await repoUpdatePrescribedExercise(client, prescribedExerciseId, input);
  },

  async removePrescribedExercise(client: SQLiteClient, planId: string, prescribedExerciseId: string) {
    await assertPrescribedExerciseEditable(client, planId, prescribedExerciseId);
    await repoRemovePrescribedExercise(client, prescribedExerciseId);
  },

  async addPrescribedSet(
    client: SQLiteClient,
    planId: string,
    prescribedExerciseId: string,
    input: Omit<AddPrescribedSetInput, 'prescribedExerciseId'>
  ) {
    await assertPrescribedExerciseEditable(client, planId, prescribedExerciseId);
    return repoAddPrescribedSet(client, { ...input, prescribedExerciseId });
  },

  async updatePrescribedSet(
    client: SQLiteClient,
    planId: string,
    prescribedSetId: string,
    input: UpdatePrescribedSetInput
  ) {
    await assertPrescribedSetEditable(client, planId, prescribedSetId);
    await repoUpdatePrescribedSet(client, prescribedSetId, input);
  },

  async removePrescribedSet(client: SQLiteClient, planId: string, prescribedSetId: string) {
    await assertPrescribedSetEditable(client, planId, prescribedSetId);
    await repoRemovePrescribedSet(client, prescribedSetId);
  },
};
