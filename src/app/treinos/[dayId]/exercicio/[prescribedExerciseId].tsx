import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ExercisePlaceholder } from '@/components/ExercisePlaceholder';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { workoutPlanService } from '@/services/workoutPlanService';
import { EQUIPMENT_LABELS } from '@/domain/equipment';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { TECHNIQUE_LABELS } from '@/domain/technique';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { PrescribedExerciseDetail } from '@/repositories/workoutPlanRepository';

export default function ExerciseDetailScreen() {
  const { prescribedExerciseId } = useLocalSearchParams<{ prescribedExerciseId: string }>();
  const client = useDatabase();
  const [detail, setDetail] = useState<PrescribedExerciseDetail | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      workoutPlanService.getPrescribedExerciseDetail(client, prescribedExerciseId).then((result) => {
        if (!cancelled) setDetail(result);
      });
      return () => {
        cancelled = true;
      };
    }, [client, prescribedExerciseId])
  );

  if (!detail) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  const { exercise, prescribedExercise } = detail;

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      <View style={styles.header}>
        <ExercisePlaceholder name={exercise.name} muscleGroupSlug={exercise.imagePlaceholder} size={72} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{exercise.name}</Text>
          <View style={styles.tagRow}>
            <Tag label={MUSCLE_GROUP_LABELS[exercise.primaryMuscleGroup]} />
            {exercise.secondaryMuscleGroups.map((group) => (
              <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
            ))}
            <Tag label={EQUIPMENT_LABELS[exercise.equipment]} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Instrução</Text>
        <Text style={styles.body}>{exercise.instruction}</Text>
      </View>

      {(exercise.coachNote || prescribedExercise.coachNote) && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Observação do treinador</Text>
          {exercise.coachNote && <Text style={styles.body}>{exercise.coachNote}</Text>}
          {prescribedExercise.coachNote && <Text style={styles.body}>{prescribedExercise.coachNote}</Text>}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Séries prescritas</Text>
        {prescribedExercise.sets.map((set) => (
          <View key={set.id} style={styles.setRow}>
            <Text style={styles.setNumber}>{set.order}</Text>
            <View style={styles.setDetails}>
              <Text style={styles.body}>
                {set.targetReps ?? `${set.repRangeMin}-${set.repRangeMax}`} reps
                {set.targetLoadKg != null ? ` · ${set.targetLoadKg} kg` : ''}
              </Text>
              <Text style={styles.meta}>
                {set.restSeconds}s descanso
                {set.technique !== 'normal' ? ` · ${TECHNIQUE_LABELS[set.technique]}` : ''}
              </Text>
              {set.note && <Text style={styles.meta}>{set.note}</Text>}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  setRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  setNumber: { ...typography.subtitle, color: colors.textMuted, width: 24 },
  setDetails: { flex: 1, gap: 2 },
});
