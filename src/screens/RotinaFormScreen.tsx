import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import { useDatabase } from '@/database/DatabaseProvider';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { getWorkoutDayById } from '@/repositories/workoutPlanRepository';
import { prescriptionService } from '@/services/prescriptionService';
import { workoutPlanService } from '@/services/workoutPlanService';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { MuscleGroup } from '@/domain/muscleGroup';

interface RotinaFormScreenProps {
  planId: string;
  dayId?: string;
}

function sameGroups(a: MuscleGroup[], b: MuscleGroup[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((g) => setB.has(g));
}

function sameWeekdays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((d) => setB.has(d));
}

export function RotinaFormScreen({ planId, dayId }: RotinaFormScreenProps) {
  const client = useDatabase();
  const router = useRouter();
  const isEdit = !!dayId;

  const [name, setName] = useState('');
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [initial, setInitial] = useState<{ name: string; muscleGroups: MuscleGroup[]; weekdays: number[] } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isEdit) return;
      let cancelled = false;
      getWorkoutDayById(client, dayId!).then((day) => {
        if (cancelled || !day) return;
        setName(day.name);
        setMuscleGroups(day.muscleGroups);
        setWeekdays(day.weekdays);
        setInitial({ name: day.name, muscleGroups: day.muscleGroups, weekdays: day.weekdays });
      });
      return () => {
        cancelled = true;
      };
    }, [client, dayId, isEdit])
  );

  const isDirty = isEdit
    ? initial !== null &&
      (name !== initial.name ||
        !sameGroups(muscleGroups, initial.muscleGroups) ||
        !sameWeekdays(weekdays, initial.weekdays))
    : name.trim() !== '' || muscleGroups.length > 0 || weekdays.length > 0;

  useUnsavedChangesGuard(isDirty && !saving);

  function toggleGroup(group: MuscleGroup) {
    setMuscleGroups((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome pra essa rotina.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await prescriptionService.updateDay(client, planId, dayId!, {
          name: name.trim(),
          muscleGroups,
        });
        await prescriptionService.setDayWeekdays(client, planId, dayId!, weekdays);
      } else {
        const editableVersion = await prescriptionService.getEditableVersion(client, planId);
        const existing = await workoutPlanService.getWorkoutDaySummaries(client, editableVersion.id);
        await prescriptionService.addDay(client, planId, {
          order: existing.length + 1,
          name: name.trim(),
          description: '',
          muscleGroups,
          weekdays,
        });
      }
      router.back();
    } catch {
      setSaving(false);
      Alert.alert('Erro', 'Não foi possível salvar a rotina.');
    }
  }

  return (
    <Screen>
      <Text style={styles.label}>Nome da rotina</Text>
      <TextInput
        accessibilityLabel="Nome da rotina"
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Treino A"
      />

      <Text style={styles.label}>Grupos musculares</Text>
      <View style={styles.chipsRow}>
        {MUSCLE_GROUPS.map((group) => {
          const selected = muscleGroups.includes(group);
          return (
            <Pressable
              key={group}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggleGroup(group)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {MUSCLE_GROUP_LABELS[group]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Dias da semana (opcional)</Text>
      <WeekdayPicker value={weekdays} onChange={setWeekdays} />

      <PrimaryButton label="Salvar" onPress={handleSave} disabled={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textMuted },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.textPrimary,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelSelected: { color: colors.onPrimary },
});
