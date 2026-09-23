import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ExerciseMedia } from '@/components/ExerciseMedia';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { workoutSessionService } from '@/services/workoutSessionService';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutSession } from '@/domain/workoutSession';

/**
 * Placeholder mínimo do Mobile 1.1: prova que sessão é criada e persistida no
 * SQLite. Cronômetro de descanso, edição de reps/carga e navegação série a
 * série entram no Mobile 1.3.
 */
export default function WorkoutSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const client = useDatabase();
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    workoutSessionService.getSessionById(client, sessionId).then((result) => {
      if (!cancelled) setSession(result);
    });
    return () => {
      cancelled = true;
    };
  }, [client, sessionId]);

  useFocusEffect(
    useCallback(() => reload(), [reload])
  );

  if (!session) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  const totalSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = session.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.status === 'completed').length,
    0
  );

  return (
    <Screen>
      <Text style={styles.title}>Sessão em andamento</Text>
      <Text style={styles.meta}>
        {completedSets} de {totalSets} séries concluídas
      </Text>

      {session.exercises.map((exercise) => {
        const snapshotExercise = session.prescriptionSnapshot?.exercises.find(
          (e) => e.prescribedExerciseId === exercise.prescribedExerciseId
        );
        return (
        <View key={exercise.id} style={styles.card}>
          {snapshotExercise && (
            <ExerciseMedia
              exerciseId={snapshotExercise.exerciseId}
              name={snapshotExercise.exercise.name}
              muscleGroupSlug={snapshotExercise.exercise.imagePlaceholder}
              variant="hero"
            />
          )}
          <Text style={styles.exerciseTitle}>{snapshotExercise?.exercise.name ?? exercise.id}</Text>
          {exercise.sets.map((set) => (
            <Text key={set.id} style={styles.setLine}>
              {set.status === 'completed'
                ? `Concluída — ${set.reps} reps${set.loadKg != null ? ` · ${set.loadKg} kg` : ''}`
                : 'Pendente'}
            </Text>
          ))}
        </View>
        );
      })}

      <PrimaryButton
        label="Concluir treino"
        onPress={async () => {
          await workoutSessionService.completeSession(client, session.id);
          router.replace('/');
        }}
      />
      <PrimaryButton
        label="Abandonar treino"
        variant="secondary"
        onPress={async () => {
          await workoutSessionService.abandonSession(client, session.id);
          router.replace('/');
        }}
      />
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
  exerciseTitle: { ...typography.subtitle, color: colors.textPrimary },
  setLine: { ...typography.body, color: colors.textSecondary },
});
