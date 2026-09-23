import { isEquipment } from './equipment';
import { isExerciseCategory } from './exerciseCategory';
import { isMuscleGroup } from './muscleGroup';
import {
  PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION,
  type PrescriptionSnapshot,
  type PrescriptionSnapshotExercise,
  type PrescriptionSnapshotSet,
} from './prescriptionSnapshot';
import { isTechnique } from './technique';

export class InvalidPrescriptionSnapshotError extends Error {
  constructor(reason: string) {
    super(`Snapshot de prescrição inválido: ${reason}`);
    this.name = 'InvalidPrescriptionSnapshotError';
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidPrescriptionSnapshotError(`${path} deveria ser um objeto`);
  }
  return value as Record<string, unknown>;
}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new InvalidPrescriptionSnapshotError(`${path} deveria ser string`);
  return value;
}

function nullableStr(value: unknown, path: string): string | null {
  if (value === null) return null;
  return str(value, path);
}

function num(value: unknown, path: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new InvalidPrescriptionSnapshotError(`${path} deveria ser número`);
  }
  return value;
}

function nullableNum(value: unknown, path: string): number | null {
  if (value === null) return null;
  return num(value, path);
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new InvalidPrescriptionSnapshotError(`${path} deveria ser array`);
  return value;
}

function parseSet(raw: unknown, path: string): PrescriptionSnapshotSet {
  const s = record(raw, path);
  const technique = str(s.technique, `${path}.technique`);
  if (!isTechnique(technique)) {
    throw new InvalidPrescriptionSnapshotError(`${path}.technique valor desconhecido: ${technique}`);
  }
  return {
    prescribedSetId: str(s.prescribedSetId, `${path}.prescribedSetId`),
    order: num(s.order, `${path}.order`),
    targetReps: nullableNum(s.targetReps, `${path}.targetReps`),
    repRangeMin: nullableNum(s.repRangeMin, `${path}.repRangeMin`),
    repRangeMax: nullableNum(s.repRangeMax, `${path}.repRangeMax`),
    targetLoadKg: nullableNum(s.targetLoadKg, `${path}.targetLoadKg`),
    restSeconds: num(s.restSeconds, `${path}.restSeconds`),
    technique,
    note: nullableStr(s.note, `${path}.note`),
  };
}

function parseExercise(raw: unknown, path: string): PrescriptionSnapshotExercise {
  const e = record(raw, path);
  const exerciseInfo = record(e.exercise, `${path}.exercise`);

  const category = str(exerciseInfo.category, `${path}.exercise.category`);
  if (!isExerciseCategory(category)) {
    throw new InvalidPrescriptionSnapshotError(`${path}.exercise.category valor desconhecido: ${category}`);
  }
  const primaryMuscleGroup = str(exerciseInfo.primaryMuscleGroup, `${path}.exercise.primaryMuscleGroup`);
  if (!isMuscleGroup(primaryMuscleGroup)) {
    throw new InvalidPrescriptionSnapshotError(
      `${path}.exercise.primaryMuscleGroup valor desconhecido: ${primaryMuscleGroup}`
    );
  }
  const secondaryMuscleGroups = arr(
    exerciseInfo.secondaryMuscleGroups,
    `${path}.exercise.secondaryMuscleGroups`
  ).map((group, i) => {
    const g = str(group, `${path}.exercise.secondaryMuscleGroups[${i}]`);
    if (!isMuscleGroup(g)) {
      throw new InvalidPrescriptionSnapshotError(
        `${path}.exercise.secondaryMuscleGroups[${i}] valor desconhecido: ${g}`
      );
    }
    return g;
  });
  const equipment = str(exerciseInfo.equipment, `${path}.exercise.equipment`);
  if (!isEquipment(equipment)) {
    throw new InvalidPrescriptionSnapshotError(`${path}.exercise.equipment valor desconhecido: ${equipment}`);
  }

  return {
    prescribedExerciseId: str(e.prescribedExerciseId, `${path}.prescribedExerciseId`),
    exerciseId: str(e.exerciseId, `${path}.exerciseId`),
    order: num(e.order, `${path}.order`),
    coachNote: nullableStr(e.coachNote, `${path}.coachNote`),
    exercise: {
      name: str(exerciseInfo.name, `${path}.exercise.name`),
      category,
      primaryMuscleGroup,
      secondaryMuscleGroups,
      equipment,
      imagePlaceholder: str(exerciseInfo.imagePlaceholder, `${path}.exercise.imagePlaceholder`),
      instruction: str(exerciseInfo.instruction, `${path}.exercise.instruction`),
      coachNote: nullableStr(exerciseInfo.coachNote, `${path}.exercise.coachNote`),
    },
    sets: arr(e.sets, `${path}.sets`).map((set, i) => parseSet(set, `${path}.sets[${i}]`)),
  };
}

/** Nunca confia em JSON.parse cru — valida forma e vocabulário fechado antes de devolver. */
export function parsePrescriptionSnapshot(raw: string): PrescriptionSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidPrescriptionSnapshotError('JSON malformado');
  }

  const root = record(parsed, 'snapshot');
  const schemaVersion = num(root.schemaVersion, 'snapshot.schemaVersion');
  if (schemaVersion !== PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION) {
    throw new InvalidPrescriptionSnapshotError(`schemaVersion não suportado: ${schemaVersion}`);
  }

  const muscleGroups = arr(root.muscleGroups, 'snapshot.muscleGroups').map((group, i) => {
    const g = str(group, `snapshot.muscleGroups[${i}]`);
    if (!isMuscleGroup(g)) {
      throw new InvalidPrescriptionSnapshotError(`snapshot.muscleGroups[${i}] valor desconhecido: ${g}`);
    }
    return g;
  });

  return {
    schemaVersion: 1,
    planVersionId: str(root.planVersionId, 'snapshot.planVersionId'),
    dayId: str(root.dayId, 'snapshot.dayId'),
    dayName: str(root.dayName, 'snapshot.dayName'),
    dayDescription: str(root.dayDescription, 'snapshot.dayDescription'),
    muscleGroups,
    exercises: arr(root.exercises, 'snapshot.exercises').map((exercise, i) =>
      parseExercise(exercise, `snapshot.exercises[${i}]`)
    ),
  };
}
