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

/** Força um created_at determinístico — insertPlan usa `new Date().toISOString()` no momento da criação. */
async function setCreatedAt(client: SQLiteClient, planId: string, isoDate: string): Promise<void> {
  await client.runAsync('UPDATE workout_plans SET created_at = ? WHERE id = ?;', [isoDate, planId]);
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
    expect(snapshot.orderedPlans[0]?.plan.id).toBe(PLAN_ID);
    // PlanHomeSummary não tem nenhum campo de versão "solto" fora de `version`
    expect(snapshot.orderedPlans[0]).not.toHaveProperty('versionId');
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

    const snapshot = await getHomeSnapshot(client, MONDAY);
    const matches = snapshot.orderedPlans.filter((summary) => summary.plan.id === plan.id);
    expect(matches).toHaveLength(1);
  });

  it('3. dois WorkoutPlan distintos aparecem como dois planos', async () => {
    const { plan: planA } = await buildActivatedPersonalPlan(client, 'Plano A');
    const { plan: planB } = await buildActivatedPersonalPlan(client, 'Plano B');

    const snapshot = await getHomeSnapshot(client, MONDAY);
    const ids = snapshot.orderedPlans.map((s) => s.plan.id);
    expect(ids).toContain(planA.id);
    expect(ids).toContain(planB.id);
    expect(new Set(ids).size).toBe(ids.length); // sem duplicata
  });

  it('4. selected_plan_id recebe destaque correto (selectedPlanId)', async () => {
    const { plan } = await buildActivatedPersonalPlan(client, 'Meu plano');
    await planService.selectPlan(client, plan.id);

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.selectedPlanId).toBe(plan.id);
  });

  it('5. plano prescribed aparece com origin correto (read-only na UI)', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    const demo = snapshot.orderedPlans.find((s) => s.plan.id === PLAN_ID);
    expect(demo?.plan.origin).toBe('prescribed');
  });

  it('6. plano personal expõe origin correto (caminho de edição na UI)', async () => {
    const { plan } = await buildActivatedPersonalPlan(client, 'Editável');

    const snapshot = await getHomeSnapshot(client, MONDAY);
    const found = snapshot.orderedPlans.find((s) => s.plan.id === plan.id);
    expect(found?.plan.origin).toBe('personal');
  });

  it('8 e 9. treino de hoje (da rotina mais recente) só considera a versão active — nunca um draft', async () => {
    // plano ativo com a rotina de segunda (weekday=1) — mais recente que o seed
    const { plan } = await buildActivatedPersonalPlan(client, 'Plano com draft por cima', 'Treino V1', [1]);

    // cria um draft por cima (copy-on-write) e muda o weekday dessa MESMA rotina pra terça
    const editable = await prescriptionService.getEditableVersion(client, plan.id);
    const draftDays = await getWorkoutDaySummaries(client, editable.id);
    await prescriptionService.setDayWeekdays(client, plan.id, draftDays[0].id, [2]);

    // segunda: a active (não o draft) ainda tem weekday=1 pra essa rotina — deveria aparecer hoje
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.topPlan?.plan.id).toBe(plan.id);
    // plano tem só 1 treino → resolução direct, sem precisar de weekday. O
    // dayId deve ser o da versão ACTIVE, não o do draft (ids diferentes por
    // causa do copy-on-write) — por isso comparamos só kind/dayName aqui.
    expect(snapshot.topPlanStartAction?.kind).toBe('direct');
    expect(snapshot.topPlanStartAction).toMatchObject({ dayName: 'Treino V1' });
    if (snapshot.topPlanStartAction?.kind === 'direct') {
      expect(snapshot.topPlanStartAction.dayId).not.toBe(draftDays[0].id);
    }
  });

  it('10. weekday correto resolve o treino de hoje da rotina mais recente (segunda → Treino A, terça → Treino B)', async () => {
    // seed é o único plano — é o "mais recente" por definição; 3 treinos, 1 match por dia → direct
    const monday = await getHomeSnapshot(client, MONDAY);
    expect(monday.topPlanStartAction).toMatchObject({ kind: 'direct', dayId: DAY_A });

    const tuesday = await getHomeSnapshot(client, TUESDAY);
    expect(tuesday.topPlanStartAction).toMatchObject({ kind: 'direct', dayId: DAY_B });
  });

  it('11. sem treino pra hoje (domingo não tem rotina no seed) e vários treinos → choose, nunca escolhe arbitrariamente', async () => {
    const snapshot = await getHomeSnapshot(client, SUNDAY);
    expect(snapshot.topPlanStartAction).toEqual({ kind: 'choose' });
  });

  it('21. mais de um treino bate com o weekday de hoje → choose (fim a fim, não só na função pura)', async () => {
    const { plan, draftVersion } = await planService.createPlan(client, {
      name: 'Dois treinos na segunda',
      origin: 'personal',
    });
    const dayA = await prescriptionService.addDay(client, plan.id, {
      order: 1,
      name: 'Treino A',
      description: '',
      muscleGroups: ['chest'],
      weekdays: [1],
    });
    const dayB = await prescriptionService.addDay(client, plan.id, {
      order: 2,
      name: 'Treino B',
      description: '',
      muscleGroups: ['back'],
      weekdays: [1],
    });
    for (const day of [dayA, dayB]) {
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
    }
    await planService.activatePlanVersion(client, { planId: plan.id, versionId: draftVersion.id });

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.topPlan?.plan.id).toBe(plan.id);
    expect(snapshot.topPlanStartAction).toEqual({ kind: 'choose' });
  });

  it('19. plano só com draft (nunca ativado) não vira topPlan, mesmo sendo mais recente que um plano active', async () => {
    const { plan: activePlan } = await buildActivatedPersonalPlan(client, 'Ativo mais antigo');
    // plano criado DEPOIS, mas nunca ativado (fica só com a v1 draft)
    const { plan: draftPlan } = await planService.createPlan(client, {
      name: 'Rascunho mais recente',
      origin: 'personal',
    });
    await setCreatedAt(client, activePlan.id, '2026-09-10T09:00:00.000Z');
    await setCreatedAt(client, draftPlan.id, '2026-09-24T09:00:00.000Z');

    const snapshot = await getHomeSnapshot(client, MONDAY);
    // aparece em "Meus Treinos" (orderedPlans não filtra por status)...
    expect(snapshot.orderedPlans.map((s) => s.plan.id)).toContain(draftPlan.id);
    expect(snapshot.orderedPlans[0]?.plan.id).toBe(draftPlan.id); // é o mais recente da lista
    // ...mas NUNCA no destaque do topo, mesmo sendo o mais recente
    expect(snapshot.topPlan?.plan.id).toBe(activePlan.id);
    expect(snapshot.topPlan?.plan.id).not.toBe(draftPlan.id);
  });

  it('20. nenhum plano tem versão active → topPlan é null (card do topo não aparece)', async () => {
    const emptyClient = await setupTestDatabase({ seeded: false });
    await planService.createPlan(emptyClient, { name: 'Só rascunho', origin: 'personal' });

    const snapshot = await getHomeSnapshot(emptyClient, MONDAY);
    expect(snapshot.topPlan).toBeNull();
    expect(snapshot.topPlanStartAction).toBeNull();
    expect(snapshot.orderedPlans).toHaveLength(1); // continua em Meus Treinos
  });

  it('12. Home funciona com zero planos', async () => {
    const emptyClient = await setupTestDatabase({ seeded: false });
    const snapshot = await getHomeSnapshot(emptyClient, MONDAY);

    expect(snapshot.orderedPlans).toEqual([]);
    expect(snapshot.selectedPlanId).toBeNull();
    expect(snapshot.topPlan).toBeNull();
    expect(snapshot.topPlanStartAction).toBeNull();
    expect(snapshot.weeklyTotal).toBe(0);
  });

  it('13. Home funciona com um único plano (seed padrão)', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.orderedPlans).toHaveLength(1);
    expect(snapshot.topPlan?.plan.id).toBe(PLAN_ID);
  });

  it('14. Home funciona com múltiplos planos', async () => {
    await buildActivatedPersonalPlan(client, 'Plano extra 1');
    await buildActivatedPersonalPlan(client, 'Plano extra 2');

    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.orderedPlans.length).toBeGreaterThanOrEqual(3);
  });

  it('17. Meus Treinos ordenado por criação, mais recente primeiro — independente de selected_plan_id', async () => {
    const { plan: planOld } = await buildActivatedPersonalPlan(client, 'Rotina 10/09');
    const { plan: planMid } = await buildActivatedPersonalPlan(client, 'Rotina 20/09');
    const { plan: planNew } = await buildActivatedPersonalPlan(client, 'Rotina 24/09');
    await setCreatedAt(client, planOld.id, '2026-09-10T09:00:00.000Z');
    await setCreatedAt(client, planMid.id, '2026-09-20T09:00:00.000Z');
    await setCreatedAt(client, planNew.id, '2026-09-24T09:00:00.000Z');

    // seleciona a mais ANTIGA — não deve mudar a ordem visual
    await planService.selectPlan(client, planOld.id);

    const snapshot = await getHomeSnapshot(client, MONDAY);
    const ids = snapshot.orderedPlans.map((s) => s.plan.id);
    const posNew = ids.indexOf(planNew.id);
    const posMid = ids.indexOf(planMid.id);
    const posOld = ids.indexOf(planOld.id);

    expect(posNew).toBeLessThan(posMid);
    expect(posMid).toBeLessThan(posOld);
    expect(snapshot.selectedPlanId).toBe(planOld.id); // seleção preservada...
    expect(snapshot.orderedPlans[0]?.plan.id).toBe(planNew.id); // ...mas não afeta a ordem
    expect(snapshot.topPlan?.plan.id).toBe(planNew.id); // destaque = mais recente, não o selecionado
  });

  it('18. rotina recém-criada aparece imediatamente como primeiro card', async () => {
    const before = await getHomeSnapshot(client, MONDAY);
    const beforeFirstId = before.orderedPlans[0]?.plan.id;

    const { plan } = await buildActivatedPersonalPlan(client, 'Recém-criada');

    const after = await getHomeSnapshot(client, MONDAY);
    expect(after.orderedPlans[0]?.plan.id).toBe(plan.id);
    expect(after.orderedPlans[0]?.plan.id).not.toBe(beforeFirstId);
    expect(after.topPlan?.plan.id).toBe(plan.id);
  });

  it('sem sessão ativa: activeSession é null', async () => {
    const snapshot = await getHomeSnapshot(client, MONDAY);
    expect(snapshot.activeSession).toBeNull();
    expect(snapshot.lastSession).toBeNull();
  });

  it('com sessão ativa: activeSession reflete a sessão em andamento (dado preservado no snapshot mesmo sem banner na Home)', async () => {
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
    const demo = snapshot.orderedPlans.find((s) => s.plan.id === PLAN_ID) as { dayPreviews: unknown[]; totalDayCount: number };
    expect(demo.dayPreviews.length).toBeLessThanOrEqual(3);
    expect(demo.totalDayCount).toBe(3);
  });
});
