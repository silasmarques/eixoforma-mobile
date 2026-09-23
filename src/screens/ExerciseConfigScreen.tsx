import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ExerciseMedia } from '@/components/ExerciseMedia';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuickSetConfigForm, type QuickSetConfigValues } from '@/components/QuickSetConfigForm';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { createEmptySetDraft, SetEditorRow, type SetDraft } from '@/components/SetEditorRow';
import { useDatabase } from '@/database/DatabaseProvider';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { getExerciseById } from '@/repositories/exerciseRepository';
import { getPrescribedExerciseDetail, getWorkoutDayById } from '@/repositories/workoutPlanRepository';
import { prescriptionService, type PrescribedSetDraftInput } from '@/services/prescriptionService';
import { EQUIPMENT_LABELS } from '@/domain/equipment';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { parseDecimalInput } from '@/utils/parseDecimalInput';
import { colors, spacing, typography } from '@/theme/tokens';
import type { Exercise } from '@/domain/exercise';

let clientKeySeq = 0;
function generateClientKey(): string {
  clientKeySeq += 1;
  return `set_${clientKeySeq}_${Date.now()}`;
}

interface ExerciseConfigScreenProps {
  planId: string;
  dayId: string;
  /** modo criar: id do exercício do catálogo escolhido na biblioteca */
  exerciseId?: string;
  /** modo editar: id do PrescribedExercise já existente */
  prescribedExerciseId?: string;
}

function serializeSets(sets: SetDraft[]): string {
  return JSON.stringify(sets.map(({ clientKey: _clientKey, ...rest }) => rest));
}

class SetValidationError extends Error {}

function parseSetDraft(draft: SetDraft, order: number): PrescribedSetDraftInput {
  const restSeconds = Number(draft.restSeconds);
  if (!Number.isInteger(restSeconds) || restSeconds < 0) {
    throw new SetValidationError(`Série ${order}: descanso inválido.`);
  }

  const loadKg = parseDecimalInput(draft.loadKg);
  if (Number.isNaN(loadKg)) {
    throw new SetValidationError(`Série ${order}: carga inválida.`);
  }

  if (draft.useRange) {
    const min = Number(draft.repRangeMin);
    const max = Number(draft.repRangeMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max < min) {
      throw new SetValidationError(`Série ${order}: faixa de reps inválida.`);
    }
    return {
      dbId: draft.dbId,
      targetReps: null,
      repRangeMin: min,
      repRangeMax: max,
      targetLoadKg: loadKg,
      restSeconds,
      technique: draft.technique,
      note: draft.note.trim() || null,
    };
  }

  const reps = Number(draft.reps);
  if (!Number.isInteger(reps) || reps <= 0) {
    throw new SetValidationError(`Série ${order}: repetições inválidas.`);
  }
  return {
    dbId: draft.dbId,
    targetReps: reps,
    repRangeMin: null,
    repRangeMax: null,
    targetLoadKg: loadKg,
    restSeconds,
    technique: draft.technique,
    note: draft.note.trim() || null,
  };
}

export function ExerciseConfigScreen({
  planId,
  dayId,
  exerciseId,
  prescribedExerciseId,
}: ExerciseConfigScreenProps) {
  const client = useDatabase();
  const router = useRouter();
  const isEdit = !!prescribedExerciseId;

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<SetDraft[]>([]);
  const [initialSerialized, setInitialSerialized] = useState<string>(serializeSets([]));
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (isEdit) {
        getPrescribedExerciseDetail(client, prescribedExerciseId!).then((detail) => {
          if (cancelled || !detail) return;
          setExercise(detail.exercise);
          const loadedSets: SetDraft[] = detail.prescribedExercise.sets.map((set) => ({
            clientKey: generateClientKey(),
            dbId: set.id,
            useRange: set.targetReps === null,
            reps: set.targetReps != null ? String(set.targetReps) : '',
            repRangeMin: set.repRangeMin != null ? String(set.repRangeMin) : '',
            repRangeMax: set.repRangeMax != null ? String(set.repRangeMax) : '',
            loadKg: set.targetLoadKg != null ? String(set.targetLoadKg) : '',
            restSeconds: String(set.restSeconds),
            technique: set.technique,
            note: set.note ?? '',
          }));
          setSets(loadedSets);
          setInitialSerialized(serializeSets(loadedSets));
        });
      } else {
        getExerciseById(client, exerciseId!).then((result) => {
          if (!cancelled) setExercise(result);
        });
      }
      return () => {
        cancelled = true;
      };
    }, [client, isEdit, prescribedExerciseId, exerciseId])
  );

  const isDirty = isEdit ? serializeSets(sets) !== initialSerialized : sets.length > 0;
  useUnsavedChangesGuard(isDirty && !saving);

  function applyQuickConfig(values: QuickSetConfigValues) {
    const useRange = values.reps.includes('-');
    let repMin = '';
    let repMax = '';
    let repsFixed = values.reps;
    if (useRange) {
      const [min, max] = values.reps.split('-').map((part) => part.trim());
      repMin = min;
      repMax = max;
      repsFixed = '';
    }

    setSets((current) => {
      const next: SetDraft[] = [];
      for (let i = 0; i < values.count; i += 1) {
        const existing = current[i]; // preserva dbId por posição, se existir
        next.push({
          clientKey: existing?.clientKey ?? generateClientKey(),
          dbId: existing?.dbId,
          useRange,
          reps: repsFixed,
          repRangeMin: repMin,
          repRangeMax: repMax,
          loadKg: values.loadKg,
          restSeconds: values.restSeconds,
          technique: values.technique,
          note: existing?.note ?? '',
        });
      }
      return next;
    });
  }

  function updateSet(index: number, value: SetDraft) {
    setSets((current) => current.map((s, i) => (i === index ? value : s)));
  }

  function removeSet(index: number) {
    setSets((current) => current.filter((_, i) => i !== index));
  }

  function duplicateSet(index: number) {
    setSets((current) => {
      const copy = { ...current[index], clientKey: generateClientKey(), dbId: undefined };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function moveSet(index: number, direction: -1 | 1) {
    setSets((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addEmptySet() {
    setSets((current) => [...current, createEmptySetDraft(generateClientKey())]);
  }

  async function handleSave() {
    if (sets.length === 0) {
      Alert.alert('Adicione ao menos uma série', 'Use a configuração rápida ou "+ Adicionar série".');
      return;
    }

    let parsed: PrescribedSetDraftInput[];
    try {
      parsed = sets.map((set, index) => parseSetDraft(set, index + 1));
    } catch (error) {
      if (error instanceof SetValidationError) {
        Alert.alert('Valor inválido', error.message);
      } else {
        Alert.alert('Erro', 'Não foi possível validar as séries.');
      }
      return;
    }

    setSaving(true);
    try {
      let targetExerciseId = prescribedExerciseId;
      if (!isEdit) {
        const day = await getWorkoutDayById(client, dayId);
        const created = await prescriptionService.addPrescribedExercise(client, planId, dayId, {
          exerciseId: exerciseId!,
          order: (day?.exercises.length ?? 0) + 1,
          coachNote: null,
        });
        targetExerciseId = created.id;
      }
      await prescriptionService.replacePrescribedSets(client, planId, targetExerciseId!, parsed);
      router.back();
    } catch {
      setSaving(false);
      Alert.alert('Erro', 'Não foi possível salvar o exercício.');
    }
  }

  if (!exercise) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ExerciseMedia
        exerciseId={exercise.id}
        name={exercise.name}
        muscleGroupSlug={exercise.imagePlaceholder}
        variant="hero"
      />
      <View style={styles.header}>
        <Text style={styles.title}>{exercise.name}</Text>
        <View style={styles.tagRow}>
          <Tag label={MUSCLE_GROUP_LABELS[exercise.primaryMuscleGroup]} />
          {exercise.secondaryMuscleGroups.map((group) => (
            <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
          ))}
          <Tag label={EQUIPMENT_LABELS[exercise.equipment]} />
        </View>
      </View>
      <Text style={styles.instruction}>{exercise.instruction}</Text>

      <QuickSetConfigForm onApply={applyQuickConfig} />

      <Text style={styles.sectionLabel}>Séries ({sets.length})</Text>
      {sets.map((set, index) => (
        <SetEditorRow
          key={set.clientKey}
          order={index + 1}
          value={set}
          onChange={(value) => updateSet(index, value)}
          onRemove={() => removeSet(index)}
          onDuplicate={() => duplicateSet(index)}
          onMoveUp={index > 0 ? () => moveSet(index, -1) : undefined}
          onMoveDown={index < sets.length - 1 ? () => moveSet(index, 1) : undefined}
        />
      ))}
      <PrimaryButton label="+ Adicionar série" variant="secondary" onPress={addEmptySet} />

      <PrimaryButton label="Salvar" onPress={handleSave} disabled={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.body, color: colors.textSecondary },
  header: { gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  instruction: { ...typography.body, color: colors.textSecondary },
  sectionLabel: { ...typography.subtitle, color: colors.textPrimary },
});
