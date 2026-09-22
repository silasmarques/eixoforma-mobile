import type { PrescribedSet, WorkoutDay, WorkoutPlan } from '@/domain/workoutPlan';
import type { Technique } from '@/domain/technique';

const PLAN_ID = 'plan_eixoforma_demo';
const PLAN_CREATED_AT = '2026-09-01T12:00:00.000Z';

function buildSets(
  exerciseId: string,
  restSeconds: number,
  sets: { reps: number; loadKg: number | null; technique?: Technique }[]
): PrescribedSet[] {
  return sets.map((set, index) => ({
    id: `pset_${exerciseId}_${index + 1}`,
    order: index + 1,
    targetReps: set.reps,
    repRangeMin: null,
    repRangeMax: null,
    targetLoadKg: set.loadKg,
    restSeconds,
    technique: set.technique ?? 'normal',
    note: null,
  }));
}

const dayA: WorkoutDay = {
  id: 'day_treino_a',
  planId: PLAN_ID,
  order: 1,
  name: 'Treino A',
  muscleGroups: ['Peito', 'Ombros', 'Tríceps'],
  exercises: [
    {
      id: 'pex_a_supino_reto',
      exerciseId: 'ex_supino_reto_barra',
      order: 1,
      coachNote: 'Aquecer bem os ombros antes da primeira série de carga.',
      sets: buildSets('a_supino_reto', 90, [
        { reps: 12, loadKg: 20, technique: 'warmup' },
        { reps: 10, loadKg: 40 },
        { reps: 8, loadKg: 45 },
        { reps: 8, loadKg: 45 },
      ]),
    },
    {
      id: 'pex_a_supino_inclinado',
      exerciseId: 'ex_supino_inclinado_halteres',
      order: 2,
      coachNote: null,
      sets: buildSets('a_supino_inclinado', 75, [
        { reps: 10, loadKg: 16 },
        { reps: 10, loadKg: 16 },
        { reps: 8, loadKg: 18 },
      ]),
    },
    {
      id: 'pex_a_crucifixo_cabo',
      exerciseId: 'ex_crucifixo_cabo',
      order: 3,
      coachNote: null,
      sets: buildSets('a_crucifixo_cabo', 60, [
        { reps: 12, loadKg: 10 },
        { reps: 12, loadKg: 10 },
        { reps: 12, loadKg: 10, technique: 'drop_set' },
      ]),
    },
    {
      id: 'pex_a_desenvolvimento_militar',
      exerciseId: 'ex_desenvolvimento_militar',
      order: 4,
      coachNote: null,
      sets: buildSets('a_desenvolvimento_militar', 75, [
        { reps: 10, loadKg: 20 },
        { reps: 8, loadKg: 22 },
        { reps: 8, loadKg: 22 },
      ]),
    },
    {
      id: 'pex_a_elevacao_lateral',
      exerciseId: 'ex_elevacao_lateral',
      order: 5,
      coachNote: null,
      sets: buildSets('a_elevacao_lateral', 45, [
        { reps: 15, loadKg: 6 },
        { reps: 15, loadKg: 6 },
        { reps: 12, loadKg: 6, technique: 'rest_pause' },
      ]),
    },
    {
      id: 'pex_a_triceps_corda',
      exerciseId: 'ex_triceps_corda_pulley',
      order: 6,
      coachNote: null,
      sets: buildSets('a_triceps_corda', 45, [
        { reps: 12, loadKg: 15 },
        { reps: 12, loadKg: 15 },
        { reps: 10, loadKg: 17 },
      ]),
    },
  ],
};

const dayB: WorkoutDay = {
  id: 'day_treino_b',
  planId: PLAN_ID,
  order: 2,
  name: 'Treino B',
  muscleGroups: ['Costas', 'Bíceps'],
  exercises: [
    {
      id: 'pex_b_puxada_frente',
      exerciseId: 'ex_puxada_frente',
      order: 1,
      coachNote: null,
      sets: buildSets('b_puxada_frente', 90, [
        { reps: 12, loadKg: 30, technique: 'warmup' },
        { reps: 10, loadKg: 45 },
        { reps: 8, loadKg: 50 },
        { reps: 8, loadKg: 50 },
      ]),
    },
    {
      id: 'pex_b_remada_curvada',
      exerciseId: 'ex_remada_curvada',
      order: 2,
      coachNote: 'Manter coluna neutra durante toda a série.',
      sets: buildSets('b_remada_curvada', 90, [
        { reps: 10, loadKg: 35 },
        { reps: 8, loadKg: 40 },
        { reps: 8, loadKg: 40 },
      ]),
    },
    {
      id: 'pex_b_remada_unilateral',
      exerciseId: 'ex_remada_unilateral_halter',
      order: 3,
      coachNote: null,
      sets: buildSets('b_remada_unilateral', 60, [
        { reps: 12, loadKg: 18 },
        { reps: 12, loadKg: 18 },
        { reps: 10, loadKg: 20 },
      ]),
    },
    {
      id: 'pex_b_face_pull',
      exerciseId: 'ex_face_pull',
      order: 4,
      coachNote: null,
      sets: buildSets('b_face_pull', 45, [
        { reps: 15, loadKg: 12 },
        { reps: 15, loadKg: 12 },
        { reps: 15, loadKg: 12 },
      ]),
    },
    {
      id: 'pex_b_rosca_direta',
      exerciseId: 'ex_rosca_direta_barra',
      order: 5,
      coachNote: null,
      sets: buildSets('b_rosca_direta', 60, [
        { reps: 10, loadKg: 15 },
        { reps: 10, loadKg: 15 },
        { reps: 8, loadKg: 17 },
      ]),
    },
    {
      id: 'pex_b_rosca_alternada',
      exerciseId: 'ex_rosca_alternada_halteres',
      order: 6,
      coachNote: null,
      sets: buildSets('b_rosca_alternada', 45, [
        { reps: 12, loadKg: 8 },
        { reps: 12, loadKg: 8 },
        { reps: 10, loadKg: 9, technique: 'drop_set' },
      ]),
    },
  ],
};

const dayC: WorkoutDay = {
  id: 'day_treino_c',
  planId: PLAN_ID,
  order: 3,
  name: 'Treino C',
  muscleGroups: ['Pernas'],
  exercises: [
    {
      id: 'pex_c_agachamento',
      exerciseId: 'ex_agachamento_livre',
      order: 1,
      coachNote: 'Priorizar técnica antes de progredir carga.',
      sets: buildSets('c_agachamento', 120, [
        { reps: 12, loadKg: 20, technique: 'warmup' },
        { reps: 10, loadKg: 50 },
        { reps: 8, loadKg: 60 },
        { reps: 8, loadKg: 60 },
      ]),
    },
    {
      id: 'pex_c_leg_press',
      exerciseId: 'ex_leg_press_45',
      order: 2,
      coachNote: null,
      sets: buildSets('c_leg_press', 90, [
        { reps: 12, loadKg: 100 },
        { reps: 10, loadKg: 120 },
        { reps: 10, loadKg: 120 },
      ]),
    },
    {
      id: 'pex_c_cadeira_extensora',
      exerciseId: 'ex_cadeira_extensora',
      order: 3,
      coachNote: null,
      sets: buildSets('c_cadeira_extensora', 60, [
        { reps: 15, loadKg: 30 },
        { reps: 12, loadKg: 35 },
        { reps: 12, loadKg: 35, technique: 'drop_set' },
      ]),
    },
    {
      id: 'pex_c_mesa_flexora',
      exerciseId: 'ex_mesa_flexora',
      order: 4,
      coachNote: null,
      sets: buildSets('c_mesa_flexora', 60, [
        { reps: 12, loadKg: 25 },
        { reps: 12, loadKg: 25 },
        { reps: 10, loadKg: 28 },
      ]),
    },
    {
      id: 'pex_c_stiff',
      exerciseId: 'ex_stiff_barra',
      order: 5,
      coachNote: 'Interromper se houver perda da curvatura lombar.',
      sets: buildSets('c_stiff', 90, [
        { reps: 10, loadKg: 30 },
        { reps: 10, loadKg: 35 },
        { reps: 8, loadKg: 35 },
      ]),
    },
    {
      id: 'pex_c_panturrilha',
      exerciseId: 'ex_panturrilha_em_pe',
      order: 6,
      coachNote: null,
      sets: buildSets('c_panturrilha', 45, [
        { reps: 15, loadKg: 40 },
        { reps: 15, loadKg: 40 },
        { reps: 12, loadKg: 45, technique: 'rest_pause' },
      ]),
    },
  ],
};

export const mockWorkoutPlan: WorkoutPlan = {
  id: PLAN_ID,
  name: 'Plano EixoForma — Demonstração',
  createdAt: PLAN_CREATED_AT,
  updatedAt: PLAN_CREATED_AT,
  days: [dayA, dayB, dayC],
};
