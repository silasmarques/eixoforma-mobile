import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  DuplicateActiveSessionError,
  abandonSession,
  completeSession,
  createSession,
  findActiveSession,
  getSessionById,
  getSessionHistory,
  recordPerformedSet,
} from '@/repositories/workoutSessionRepository';
import { getWorkoutDayById } from '@/repositories/workoutPlanRepository';
import { setupTestDatabase } from '../support/setupTestDatabase';
import type { SQLiteClient } from '@/database/sqliteClient';

const PLAN_ID = 'plan_eixoforma_demo';
const DAY_A = 'day_treino_a';
const DAY_B = 'day_treino_b';

describe('workoutSessionRepository', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('cria a sessão e materializa performed_exercises/performed_sets pendentes', async () => {
    const session = await createSession(client, { planId: PLAN_ID, dayId: DAY_A });
    const day = await getWorkoutDayById(client, DAY_A);

    expect(session.status).toBe('in_progress');
    expect(session.exercises).toHaveLength(day!.exercises.length);
    expect(session.exercises[0].sets).toHaveLength(day!.exercises[0].sets.length);
    expect(session.exercises[0].sets.every((set) => set.status === 'pending')).toBe(true);
  });

  it('impede duas sessões in_progress simultâneas', async () => {
    await createSession(client, { planId: PLAN_ID, dayId: DAY_A });

    await expect(createSession(client, { planId: PLAN_ID, dayId: DAY_B })).rejects.toBeInstanceOf(
      DuplicateActiveSessionError
    );
  });

  it('libera para uma nova sessão depois que a anterior é concluída ou abandonada', async () => {
    const first = await createSession(client, { planId: PLAN_ID, dayId: DAY_A });
    await completeSession(client, first.id);

    await expect(createSession(client, { planId: PLAN_ID, dayId: DAY_B })).resolves.toBeTruthy();
  });

  it('encontra a sessão ativa', async () => {
    const created = await createSession(client, { planId: PLAN_ID, dayId: DAY_A });

    const active = await findActiveSession(client);
    expect(active?.id).toBe(created.id);
    expect(active?.dayName).toBe('Treino A');
  });

  it('não encontra sessão ativa quando não há nenhuma em andamento', async () => {
    const active = await findActiveSession(client);
    expect(active).toBeNull();
  });

  it('registra uma série realizada sem alterar a prescrição', async () => {
    const session = await createSession(client, { planId: PLAN_ID, dayId: DAY_A });
    const day = await getWorkoutDayById(client, DAY_A);
    const prescribedSet = day!.exercises[0].sets[0];
    const performedSet = session.exercises[0].sets[0];

    // Realizado diverge do prescrito de propósito, para provar que não há sobrescrita.
    await recordPerformedSet(client, {
      performedSetId: performedSet.id,
      reps: (prescribedSet.targetReps ?? 0) + 2,
      loadKg: (prescribedSet.targetLoadKg ?? 0) + 2.5,
    });

    const reloaded = await getSessionById(client, session.id);
    const reloadedSet = reloaded!.exercises[0].sets[0];
    expect(reloadedSet.status).toBe('completed');
    expect(reloadedSet.reps).toBe((prescribedSet.targetReps ?? 0) + 2);
    expect(reloadedSet.loadKg).toBe((prescribedSet.targetLoadKg ?? 0) + 2.5);

    const dayAfter = await getWorkoutDayById(client, DAY_A);
    expect(dayAfter!.exercises[0].sets[0]).toEqual(prescribedSet);
  });

  it('finaliza a sessão marcando completed e completedAt', async () => {
    const session = await createSession(client, { planId: PLAN_ID, dayId: DAY_A });
    await completeSession(client, session.id);

    const reloaded = await getSessionById(client, session.id);
    expect(reloaded?.status).toBe('completed');
    expect(reloaded?.completedAt).not.toBeNull();
  });

  it('abandona a sessão marcando abandoned', async () => {
    const session = await createSession(client, { planId: PLAN_ID, dayId: DAY_A });
    await abandonSession(client, session.id);

    const reloaded = await getSessionById(client, session.id);
    expect(reloaded?.status).toBe('abandoned');
  });

  it('lista o histórico só com sessões finalizadas ou abandonadas', async () => {
    const completed = await createSession(client, { planId: PLAN_ID, dayId: DAY_A });
    await completeSession(client, completed.id);

    const active = await createSession(client, { planId: PLAN_ID, dayId: DAY_B });

    const history = await getSessionHistory(client);
    expect(history.map((s) => s.id)).toEqual([completed.id]);
    expect(history.map((s) => s.id)).not.toContain(active.id);
  });

  it('persiste a sessão em disco e sobrevive à reabertura do repository', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eixoforma-sqlite-'));
    const dbPath = join(dir, 'test.db');

    try {
      const firstOpen = await setupTestDatabase({ path: dbPath });
      const created = await createSession(firstOpen, { planId: PLAN_ID, dayId: DAY_A });
      await firstOpen.closeAsync();

      const secondOpen = await setupTestDatabase({ path: dbPath, seeded: false });
      const active = await findActiveSession(secondOpen);
      expect(active?.id).toBe(created.id);
      await secondOpen.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
