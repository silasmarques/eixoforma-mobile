import {
  checkStructuralCompleteness,
  createDraftFromVersion,
  getVersionByStatus,
  hasSessions,
} from '@/repositories/planVersionRepository';
import { getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { createSession } from '@/repositories/workoutSessionRepository';
import { PLAN_ID, PLAN_VERSION_ID } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
import { wrapWithRunFailureAfter } from '../support/failingClientWrapper';
import type { SQLiteClient } from '@/database/sqliteClient';

describe('planVersionRepository', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('não há sessões para a versão seedada antes de qualquer treino ser iniciado', async () => {
    expect(await hasSessions(client, PLAN_VERSION_ID)).toBe(false);
  });

  it('detecta que a versão tem sessão depois de uma sessão criada', async () => {
    await createSession(client, { planId: PLAN_ID, planVersionId: PLAN_VERSION_ID, dayId: 'day_treino_a' });
    expect(await hasSessions(client, PLAN_VERSION_ID)).toBe(true);
  });

  it('createDraftFromVersion copia a árvore inteira com ids novos, incluindo weekdays', async () => {
    const draft = await createDraftFromVersion(client, PLAN_VERSION_ID);

    expect(draft.status).toBe('draft');
    expect(draft.versionNumber).toBe(2);
    expect(draft.planId).toBe(PLAN_ID);

    const originalDays = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
    const copiedDays = await getWorkoutDaySummaries(client, draft.id);

    expect(copiedDays).toHaveLength(originalDays.length);
    expect(copiedDays.map((d) => d.name)).toEqual(originalDays.map((d) => d.name));
    // ids diferentes — é uma cópia, não a mesma linha
    expect(copiedDays.map((d) => d.id)).not.toEqual(originalDays.map((d) => d.id));
    // weekdays preservados na cópia
    expect(copiedDays.map((d) => d.weekdays)).toEqual(originalDays.map((d) => d.weekdays));
  });

  it('editar a cópia não afeta a versão original (independência real, não referência compartilhada)', async () => {
    const draft = await createDraftFromVersion(client, PLAN_VERSION_ID);
    const copiedDays = await getWorkoutDaySummaries(client, draft.id);

    await client.runAsync('UPDATE workout_days SET name = ? WHERE id = ?;', [
      'Nome editado no draft',
      copiedDays[0].id,
    ]);

    const originalDays = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
    expect(originalDays[0].name).toBe('Treino A');
  });

  it('falha no meio da cópia faz rollback completo — nenhum draft parcial permanece', async () => {
    // Deixa passar a criação da linha da versão draft (1ª escrita) e falha a
    // partir da 2ª (a primeira cópia de dia) — simula quebra no meio da cópia.
    const failingClient = wrapWithRunFailureAfter(client, 1);

    await expect(createDraftFromVersion(failingClient, PLAN_VERSION_ID)).rejects.toThrow(
      'Falha simulada'
    );

    const draftAfterFailure = await getVersionByStatus(client, PLAN_ID, 'draft');
    expect(draftAfterFailure).toBeNull();

    // a versão active original continua intacta e com os 3 dias de sempre
    const active = await getVersionByStatus(client, PLAN_ID, 'active');
    expect(active?.id).toBe(PLAN_VERSION_ID);
    const days = await getWorkoutDaySummaries(client, PLAN_VERSION_ID);
    expect(days).toHaveLength(3);
  });

  it('checkStructuralCompleteness aprova a versão seedada (tem dias, exercícios e séries)', async () => {
    const result = await checkStructuralCompleteness(client, PLAN_VERSION_ID);
    expect(result).toEqual({ valid: true, reason: null });
  });

  it('checkStructuralCompleteness rejeita uma versão sem nenhum dia', async () => {
    const draft = await createDraftFromVersion(client, PLAN_VERSION_ID);
    // remove os dias copiados para simular um draft vazio recém-criado
    const days = await getWorkoutDaySummaries(client, draft.id);
    for (const day of days) {
      await client.runAsync('DELETE FROM prescribed_sets WHERE prescribed_exercise_id IN (SELECT id FROM prescribed_exercises WHERE day_id = ?);', [day.id]);
      await client.runAsync('DELETE FROM prescribed_exercises WHERE day_id = ?;', [day.id]);
      await client.runAsync('DELETE FROM workout_day_weekdays WHERE day_id = ?;', [day.id]);
      await client.runAsync('DELETE FROM workout_days WHERE id = ?;', [day.id]);
    }

    const result = await checkStructuralCompleteness(client, draft.id);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/nenhum dia/);
  });
});
