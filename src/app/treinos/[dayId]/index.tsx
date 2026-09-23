import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExercisePlaceholder } from '@/components/ExercisePlaceholder';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { useStartWorkout } from '@/hooks/useStartWorkout';
import { exerciseService } from '@/services/exerciseService';
import { workoutPlanService } from '@/services/workoutPlanService';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { TECHNIQUE_LABELS } from '@/domain/technique';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { Exercise } from '@/domain/exercise';
import type { WorkoutDay } from '@/domain/workoutPlan';

export default function WorkoutDayDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const client = useDatabase();
  const router = useRouter();
  const { startWorkout, starting } = useStartWorkout();
  const [day, setDay] = useState<WorkoutDay | null>(null);
  const [exercisesById, setExercisesById] = useState<Record<string, Exercise>>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        workoutPlanService.getWorkoutDayById(client, dayId),
        exerciseService.getAllExercises(client),
      ]).then(([dayResult, exercises]) => {
        if (cancelled) return;
        setDay(dayResult);
        setExercisesById(Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])));
      });
      return () => {
        cancelled = true;
      };
    }, [client, dayId])
  );

  if (!day) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: day.name }} />
      <Text style={styles.title}>{day.name}</Text>
      <Text style={styles.description}>{day.description}</Text>
      <View style={styles.tagRow}>
        {day.muscleGroups.map((group) => (
          <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
        ))}
      </View>
      <Text style={styles.meta}>{day.exercises.length} exercícios</Text>

      <PrimaryButton
        label="Iniciar treino"
        disabled={starting}
        onPress={() => startWorkout({ id: day.id, planId: day.planId, name: day.name })}
      />

      {day.exercises.map((prescribedExercise) => {
        const exercise = exercisesById[prescribedExercise.exerciseId];
        if (!exercise) return null;
        return (
          <Pressable
            key={prescribedExercise.id}
            accessibilityRole="button"
            accessibilityLabel={`Ver detalhes de ${exercise.name}`}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/treinos/${day.id}/exercicio/${prescribedExercise.id}`)}
          >
            <View style={styles.exerciseHeader}>
              <ExercisePlaceholder name={exercise.name} muscleGroupSlug={exercise.imagePlaceholder} />
              <View style={styles.exerciseHeaderText}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseMeta}>{MUSCLE_GROUP_LABELS[exercise.primaryMuscleGroup]}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
            {prescribedExercise.coachNote && (
              <Text style={styles.coachNote}>{prescribedExercise.coachNote}</Text>
            )}
            {prescribedExercise.sets.map((set) => (
              <Text key={set.id} style={styles.setLine}>
                Série {set.order} · {set.targetReps ?? `${set.repRangeMin}-${set.repRangeMax}`} reps
                {set.targetLoadKg != null ? ` · ${set.targetLoadKg} kg` : ''} ·{' '}
                {set.restSeconds}s descanso
                {set.technique !== 'normal' ? ` · ${TECHNIQUE_LABELS[set.technique]}` : ''}
              </Text>
            ))}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  description: { ...typography.body, color: colors.textSecondary },
  meta: { ...typography.body, color: colors.textSecondary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardPressed: { opacity: 0.85 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseHeaderText: { flex: 1, gap: 2 },
  exerciseName: { ...typography.subtitle, color: colors.textPrimary },
  exerciseMeta: { ...typography.caption, color: colors.textMuted },
  chevron: { ...typography.title, color: colors.textMuted },
  coachNote: { ...typography.caption, color: colors.textMuted },
  setLine: { ...typography.body, color: colors.textSecondary },
});
