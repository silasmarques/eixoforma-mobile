import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { DuplicateActiveSessionError } from '@/repositories/workoutSessionRepository';
import { exerciseService } from '@/services/exerciseService';
import { workoutPlanService } from '@/services/workoutPlanService';
import { workoutSessionService } from '@/services/workoutSessionService';
import { TECHNIQUE_LABELS } from '@/domain/technique';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { Exercise } from '@/domain/exercise';
import type { WorkoutDay } from '@/domain/workoutPlan';

export default function WorkoutDayDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const client = useDatabase();
  const router = useRouter();
  const [day, setDay] = useState<WorkoutDay | null>(null);
  const [exercisesById, setExercisesById] = useState<Record<string, Exercise>>({});
  const [starting, setStarting] = useState(false);

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

  const handleStart = async () => {
    if (!day) return;
    setStarting(true);
    try {
      const session = await workoutSessionService.startSession(client, {
        planId: day.planId,
        dayId: day.id,
      });
      router.replace(`/sessao/${session.id}`);
    } catch (error) {
      if (error instanceof DuplicateActiveSessionError) {
        Alert.alert('Treino em andamento', error.message);
      } else {
        Alert.alert('Erro', 'Não foi possível iniciar o treino.');
      }
    } finally {
      setStarting(false);
    }
  };

  if (!day) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{day.name}</Text>
      <Text style={styles.meta}>{day.muscleGroups.join(', ')}</Text>
      <Text style={styles.meta}>{day.exercises.length} exercícios</Text>

      <PrimaryButton label="Iniciar treino" onPress={handleStart} disabled={starting} />

      {day.exercises.map((prescribedExercise) => {
        const exercise = exercisesById[prescribedExercise.exerciseId];
        return (
          <View key={prescribedExercise.id} style={styles.card}>
            <Text style={styles.exerciseName}>{exercise?.name ?? prescribedExercise.exerciseId}</Text>
            {prescribedExercise.coachNote && (
              <Text style={styles.coachNote}>{prescribedExercise.coachNote}</Text>
            )}
            {prescribedExercise.sets.map((set) => (
              <Text key={set.id} style={styles.setLine}>
                Série {set.order} · {set.targetReps ?? `${set.repRangeMin}-${set.repRangeMax}`} reps
                {set.targetLoadKg != null ? ` · ${set.targetLoadKg} kg` : ''} ·{' '}
                {set.restSeconds}s descanso · {TECHNIQUE_LABELS[set.technique]}
              </Text>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  exerciseName: { ...typography.subtitle, color: colors.textPrimary },
  coachNote: { ...typography.caption, color: colors.textMuted },
  setLine: { ...typography.body, color: colors.textSecondary },
});
