import { buildPrescriptionSnapshot } from '@/domain/buildPrescriptionSnapshot';
import {
  InvalidPrescriptionSnapshotError,
  parsePrescriptionSnapshot,
} from '@/domain/parsePrescriptionSnapshot';
import type { Exercise } from '@/domain/exercise';
import type { WorkoutDay } from '@/domain/workoutPlan';

const exercise: Exercise = {
  id: 'ex_1',
  name: 'Supino reto com barra',
  category: 'strength',
  primaryMuscleGroup: 'chest',
  secondaryMuscleGroups: ['triceps'],
  equipment: 'barbell',
  imagePlaceholder: 'chest',
  instruction: 'Desça a barra até o peito.',
  coachNote: null,
};

const day: WorkoutDay = {
  id: 'day_1',
  planId: 'plan_1',
  planVersionId: 'plan_1_v1',
  order: 1,
  name: 'Treino A',
  description: 'Empurrar',
  muscleGroups: ['chest'],
  weekdays: [1],
  exercises: [
    {
      id: 'pex_1',
      exerciseId: 'ex_1',
      order: 1,
      coachNote: 'Aquecer bem',
      sets: [
        {
          id: 'pset_1',
          order: 1,
          targetReps: 10,
          repRangeMin: null,
          repRangeMax: null,
          targetLoadKg: 20,
          restSeconds: 60,
          technique: 'normal',
          note: null,
        },
      ],
    },
  ],
};

describe('parsePrescriptionSnapshot / buildPrescriptionSnapshot', () => {
  it('faz um round-trip completo preservando os ids relevantes', () => {
    const built = buildPrescriptionSnapshot(day, new Map([[exercise.id, exercise]]));
    const parsed = parsePrescriptionSnapshot(JSON.stringify(built));

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.planVersionId).toBe(day.planVersionId);
    expect(parsed.dayId).toBe(day.id);
    expect(parsed.exercises[0].prescribedExerciseId).toBe('pex_1');
    expect(parsed.exercises[0].exerciseId).toBe('ex_1');
    expect(parsed.exercises[0].sets[0].prescribedSetId).toBe('pset_1');
    expect(parsed.exercises[0].exercise.name).toBe('Supino reto com barra');
  });

  it('rejeita JSON malformado', () => {
    expect(() => parsePrescriptionSnapshot('{ isso não é json')).toThrow(
      InvalidPrescriptionSnapshotError
    );
  });

  it('rejeita schemaVersion não suportado', () => {
    const built = buildPrescriptionSnapshot(day, new Map([[exercise.id, exercise]]));
    const withWrongVersion = { ...built, schemaVersion: 99 };
    expect(() => parsePrescriptionSnapshot(JSON.stringify(withWrongVersion))).toThrow(
      /schemaVersion não suportado/
    );
  });

  it('rejeita valor de technique fora do vocabulário fechado', () => {
    const built = buildPrescriptionSnapshot(day, new Map([[exercise.id, exercise]]));
    const corrupted = {
      ...built,
      exercises: [
        {
          ...built.exercises[0],
          sets: [{ ...built.exercises[0].sets[0], technique: 'super_set_inventado' }],
        },
      ],
    };
    expect(() => parsePrescriptionSnapshot(JSON.stringify(corrupted))).toThrow(
      InvalidPrescriptionSnapshotError
    );
  });

  it('rejeita valor de muscleGroup fora do vocabulário fechado', () => {
    const built = buildPrescriptionSnapshot(day, new Map([[exercise.id, exercise]]));
    const corrupted = {
      ...built,
      exercises: [
        {
          ...built.exercises[0],
          exercise: { ...built.exercises[0].exercise, primaryMuscleGroup: 'perna_inventada' },
        },
      ],
    };
    expect(() => parsePrescriptionSnapshot(JSON.stringify(corrupted))).toThrow(
      InvalidPrescriptionSnapshotError
    );
  });

  it('rejeita quando um campo obrigatório não é do tipo esperado', () => {
    const built = buildPrescriptionSnapshot(day, new Map([[exercise.id, exercise]]));
    const corrupted = { ...built, dayName: 123 };
    expect(() => parsePrescriptionSnapshot(JSON.stringify(corrupted))).toThrow(
      InvalidPrescriptionSnapshotError
    );
  });
});
