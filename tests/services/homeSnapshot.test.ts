import { getVersionByStatus } from '@/repositories/planVersionRepository';
import { getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { completeSession, createSession } from '@/repositories/workoutSessionRepository';
import { computeWeeklyProgress, getHomeSnapshot } from '@/services/homeSnapshot';
import { planService } from '@/services/planService';
import { prescriptionService } from '@/services/prescriptionService';
import { PLAN_VERSION_ID } from '@/mocks/workoutPlanSeed';
import { setupTestDatabase } from '../support/setupTestDatabase';
import type { SQLiteClient } from '@/database/sqliteClient';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

const PLAN_ID = 'plan_eixoforma_demo';
const DAY_A = 'day_treino_a';
const DAY_B = 'day_treino_b';

// 2026-09-20 = domingo, 2026-09-21 = segunda, 2026-09-22 = terça (semana de referência dos outros testes).
const SUNDAY = new Date('2026-09-20T12:00:00.000Z');
const MONDAY = new Date('2026-09-21T12:00:00.000Z');
const TUESDAY = new Date('2026-09-22T12:00:00.000Z');

function session(overrides: Partial<WorkoutSessionSummary>): WorkoutSessionSummary {
  return {
    id: 'session_x',
    planId: PLAN_ID,
    planVersionId: PLAN_VERSION_ID,
    dayId: DAY_A,
    dayName: 'Treino A',
    status: 'completed',
    startedAt: '2026-09-22T10:00:00.000Z',
    completedAt: '2026-09-22T11:00:00.000Z',
    ...overrides,
  };
}

async function buildActivatedPersonalPlan(
  client: SQLiteClient,
  name: string,
  dayName = 'Treino Único',
  weekdays: number[] = []
) {
  const { plan, draftVersion } = await planService.createPlan(client, { name, origin: 'personal' });
  const day = await prescriptionService.addDay(client, plan.id, {
    order: 1,
    name: dayName,
    description: '',
    muscleGroups: ['chest'],
    weekdays,
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
  await planService.activatePlanVersion(client, { planId: plan.id, versionId: draftVersion.id });
  return { plan, day };
}

describe('computeWeeklyProgress', () => {
  it('conta dias distintos concluídos dentro da semana atual', () => {
    const history = [
      session({ dayId: DAY_A, completedAt: '2026-09-21T11:00:00.000Z' }),
      session({ dayId: DAY_B, completedAt: '2026-09-20T11:00:00.000Z' }),
    ];
    expect(computeWeeklyProgress(history, 3, TUESDAY)).toEqual({ completed: 2, total: 3 });
  });

  it('ignora sessões de semanas anteriores', () => {
    const history = [session({ dayId: DAY_A, completedAt: '2026-09-10T11:00:00.000Z' })];
    expect(computeWeeklyProgress(history, 3, TUESDAY)).toEqual({ completed: 0, total: 3 });
  });

  it('ignora sessões abandonadas', () => {
    const history = [
      session({ dayId: DAY_A, status: 'abandoned', completedAt: '2026-09-21T11:00:00.000Z' }),
    ];
    expect(computeWeeklyProgress(history, 3, TUESDAY)).toEqual({ completed: 0, total: 3 });
  });

  it('não conta o mesmo dia duas vezes', () => {
    const history = [
      session({ dayId: DAY_A, completedAt: '2026-09-21T09:00:00.000Z' }),
      session({ dayId: DAY_A, completedAt: '2026-09-21T20:00:00.000Z' }),
    ];
    expect(computeWeeklyProgress(history, 3, TUESDAY)).toEqual({ completed: 1, total: 3 });
  });
});

describe('getHomeSnapshot', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('1. Home mostra WorkoutPlan, não WorkoutPlanVersion — um resumo por plano', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlan?.plan.id).toBe(PLAN_ID);
    // PlanHomeSummary não tem nenhum campo de versão "solto" fora de `version`
    expect(snapshot.selectedPlan).not.toHaveProperty('versionId');
  });

  it('2 e 16. plano com v1 superseded + v2 active aparece uma única vez', async () => {
    const { plan } = await buildActivatedPersonalPlan(client, 'Plano versionado');
    // força um segundo draft (copy-on-write regenera os ids — precisa reler a árvore editável antes de mexer nela)
    const editable = await prescriptionService.getEditableVersion(client, plan.id);
    const draftDays = await getWorkoutDaySummaries(client, editable.id);
    await prescriptionService.updateDay(client, plan.id, draftDays[0].id, { name: 'Renomeado' });
    const v2 = await getVersionByStatus(client, plan.id, 'draft');
    await planService.activatePlanVersion(client, { planId: plan.id, versionId: v2!.id });

    // confirma que existem mesmo 2 versões por baixo (1 active + 1 superseded)
    const versions = await client.getAllAsync('SELECT * FROM workout_plan_versions WHERE plan_id = ?;', [
      plan.id,
    ]);
    expect(versions).toHaveLength(2);

    await planService.selectPlan(client, plan.id);
    const snapshot = await getHomeSnapshot(client, MONDAY);

    const matches = [snapshot.selectedPlan, ...snapshot.recentPlans].filter(
      (summary) => summary?.plan.id === plan.id
    );
    expect(matches).toHaveLength(1);
  });

  it('3. dois WorkoutPlan distintos aparecem como dois planos', async () => {
    const { plan: planA } = await buildActivatedPersonalPlan(client, 'Plano A');
    const { plan: planB } = await buildActivatedPersonalPlan(client, 'Plano B');
    await planService.selectPlan(client, planA.id);

    const snapshot = await getHomeSnapshot(client, MONDAY);
    const ids = [snapshot.selectedPlan, ...snapshot.recentPlans].map((s) => s?.plan.id);
    expect(ids).toContain(planA.id);
    expect(ids).toContain(planB.id);
    expect(new Set(ids).size).toBe(ids.length); // sem duplicata
  });

  it('4. selected_plan_id recebe destaque correto (selectedPlan)', async () => {
    const { plan } = await buildActivatedPersonalPlan(client, 'Meu plano');
    await planService.selectPlan(client, plan.id);

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlan?.plan.id).toBe(plan.id);
  });

  it('5. plano prescribed aparece com origin correto (read-only na UI)', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlan?.plan.origin).toBe('prescribed');
  });

  it('6. plano personal expõe origin correto (caminho de edição na UI)', async () => {
    const { plan } = await buildActivatedPersonalPlan(client, 'Editável');
    await planService.selectPlan(client, plan.id);

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlan?.plan.origin).toBe('personal');
  });

  it('8 e 9. treino de hoje só considera a versão active — nunca um draft', async () => {
    // plano ativo com a rotina de segunda (weekday=1)
    const { plan } = await buildActivatedPersonalPlan(client, 'Plano com draft por cima', 'Treino V1', [1]);
    await planService.selectPlan(client, plan.id);

    // cria um draft por cima (copy-on-write) e muda o weekday dessa MESMA rotina pra terça
    const editable = await prescriptionService.getEditableVersion(client, plan.id);
    const draftDays = await getWorkoutDaySummaries(client, editable.id);
    await prescriptionService.setDayWeekdays(client, plan.id, draftDays[0].id, [2]);

    // segunda: a active (não o draft) ainda tem weekday=1 pra essa rotina — deveria aparecer hoje
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.todayWorkout?.planId).toBe(plan.id);
    expect(snapshot.todayWorkout?.day.name).toBe('Treino V1');
  });

  it('10. weekday correto resolve a rotina de hoje (segunda → Treino A, terça → Treino B)', async () => {
    const monday = await getHomeSnapshot(client, MONDAY);
    expect(monday.todayWorkout?.day.id).toBe(DAY_A);

    const tuesday = await getHomeSnapshot(client, TUESDAY);
    expect(tuesday.todayWorkout?.day.id).toBe(DAY_B);
  });

  it('11. plano sem rotina hoje não inventa treino (domingo não tem rotina no seed)', async () => {
    const snapshot = await getHomeSnapshot(client, SUNDAY);
    expect(snapshot.todayWorkout).toBeNull();
  });

  it('12. Home funciona com zero planos', async () => {
    const emptyClient = await setupTestDatabase({ seeded: false });
    const snapshot = await getHomeSnapshot(emptyClient, MONDAY);

    expect(snapshot.selectedPlan).toBeNull();
    expect(snapshot.todayWorkout).toBeNull();
    expect(snapshot.recentPlans).toEqual([]);
    expect(snapshot.weeklyTotal).toBe(0);
  });

  it('13. Home funciona com um único plano (seed padrão)', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlan).not.toBeNull();
    expect(snapshot.recentPlans).toEqual([]);
  });

  it('14. Home funciona com múltiplos planos (selecionado + recentes)', async () => {
    await buildActivatedPersonalPlan(client, 'Plano extra 1');
    await buildActivatedPersonalPlan(client, 'Plano extra 2');
    await planService.selectPlan(client, PLAN_ID); // seleção explícita — sem isso o fallback pega o mais recente

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlan?.plan.id).toBe(PLAN_ID);
    expect(snapshot.recentPlans.length).toBeGreaterThanOrEqual(2);
  });

  it('sem sessão ativa: activeSession é null', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.activeSession).toBeNull();
    expect(snapshot.lastSession).toBeNull();
  });

  it('com sessão ativa: activeSession reflete a sessão em andamento', async () => {
    const created = await createSession(client, {
      planId: PLAN_ID,
      planVersionId: PLAN_VERSION_ID,
      dayId: DAY_A,
    });

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.activeSession?.id).toBe(created.id);
    expect(snapshot.activeSession?.dayName).toBe('Treino A');
  });

  it('último treino reflete a sessão concluída mais recente', async () => {
    const session1 = await createSession(client, {
      planId: PLAN_ID,
      planVersionId: PLAN_VERSION_ID,
      dayId: DAY_A,
    });
    await completeSession(client, session1.id);

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.lastSession?.id).toBe(session1.id);
  });

  it('o plano selecionado traz até 3 rotinas como prévia, não a lista de exercícios', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlan?.dayPreviews.length).toBeLessThanOrEqual(3);
    expect(snapshot.selectedPlan?.totalDayCount).toBe(3);
  });
});
