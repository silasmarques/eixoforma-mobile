import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ExerciseRowCompact } from '@/components/ExerciseRowCompact';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { getWorkoutDayById, getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { getAllExercises } from '@/repositories/exerciseRepository';
import { planService } from '@/services/planService';
import { prescriptionService } from '@/services/prescriptionService';
import { workoutSessionService } from '@/services/workoutSessionService';
import { useStartWorkout } from '@/hooks/useStartWorkout';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { WEEKDAY_ABBR_LABELS } from '@/utils/weekdayLabels';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { Exercise } from '@/domain/exercise';
import type { WorkoutDay, WorkoutPlan } from '@/domain/workoutPlan';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

export default function RotinaDetailScreen() {
  const { planId, dayId } = useLocalSearchParams<{ planId: string; dayId: string }>();
  const client = useDatabase();
  const router = useRouter();
  const { startWorkout, starting } = useStartWorkout();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [day, setDay] = useState<WorkoutDay | null>(null);
  const [exercisesById, setExercisesById] = useState<Record<string, Exercise>>({});
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(null);
  const [isActiveVersion, setIsActiveVersion] = useState(false);
  const [activeSession, setActiveSession] = useState<WorkoutSessionSummary | null>(null);

  const load = useCallback(async () => {
    const [loadedPlan, loadedDay, exercises] = await Promise.all([
      planService.getPlanById(client, planId),
      getWorkoutDayById(client, dayId),
      getAllExercises(client),
    ]);
    setPlan(loadedPlan);
    setDay(loadedDay);
    setExercisesById(Object.fromEntries(exercises.map((e) => [e.id, e])));

    if (loadedDay) {
      const summaries = await getWorkoutDaySummaries(client, loadedDay.planVersionId);
      const summary = summaries.find((s) => s.id === loadedDay.id);
      setEstimatedDurationMinutes(summary?.estimatedDurationMinutes ?? null);

      const activeVersion = await planService.getActiveVersion(client, planId);
      setIsActiveVersion(activeVersion?.id === loadedDay.planVersionId);
    }

    const session = await workoutSessionService.findActiveSession(client);
    setActiveSession(session && session.planId === planId ? session : null);
  }, [client, planId, dayId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().then(() => {
        if (cancelled) return;
      });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const isEditable = plan?.origin === 'personal';

  async function handleMoveExercise(prescribedExerciseId: string, direction: -1 | 1) {
    if (!day) return;
    const index = day.exercises.findIndex((e) => e.id === prescribedExerciseId);
    const target = index + direction;
    if (target < 0 || target >= day.exercises.length) return;
    const reordered = [...day.exercises];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await prescriptionService.reorderPrescribedExercises(client, planId, dayId, reordered.map((e) => e.id));
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível reordenar os exercícios.');
    }
  }

  async function handleRemoveExercise(prescribedExerciseId: string) {
    Alert.alert('Remover exercício?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await prescriptionService.removePrescribedExercise(client, planId, prescribedExerciseId);
            await load();
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o exercício.');
          }
        },
      },
    ]);
  }

  if (!day || !plan) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

  function handleStartWorkout() {
    startWorkout({ id: dayId, planId, name: day!.name });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: day.name }} />
      <Text style={styles.title}>{day.name}</Text>
      {day.weekdays.length > 0 && (
        <Text style={styles.weekdays}>
          {[...day.weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_ABBR_LABELS[d].toUpperCase()).join(' • ')}
        </Text>
      )}
      <View style={styles.tagRow}>
        {day.muscleGroups.map((group) => (
          <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
        ))}
      </View>

      {day.exercises.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{estimatedDurationMinutes ?? '—'}</Text>
            <Text style={styles.summaryLabel}>min · duração estimada</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{day.exercises.length}</Text>
            <Text style={styles.summaryLabel}>{day.exercises.length === 1 ? 'exercício' : 'exercícios'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalSets}</Text>
            <Text style={styles.summaryLabel}>{totalSets === 1 ? 'série' : 'séries'}</Text>
          </View>
        </View>
      )}

      {activeSession ? (
        <PrimaryButton
          label="Continuar treino"
          onPress={() => router.push(`/sessao/${activeSession.id}`)}
        />
      ) : (
        isActiveVersion &&
        day.exercises.length > 0 && (
          <PrimaryButton label="Iniciar treino" onPress={handleStartWorkout} disabled={starting} />
        )
      )}

      <Text style={styles.sectionTitle}>Exercícios</Text>

      {day.exercises.length === 0 ? (
        <EmptyState
          title="Adicione exercícios para montar este treino."
          actionLabel={isEditable ? '+ Adicionar exercícios' : undefined}
          onAction={isEditable ? () => router.push(`/planos/${planId}/rotina/${dayId}/adicionar-exercicio`) : undefined}
        />
      ) : (
        day.exercises.map((prescribedExercise, index) => {
          const exercise = exercisesById[prescribedExercise.exerciseId];
          if (!exercise) return null;
          return (
            <ExerciseRowCompact
              key={prescribedExercise.id}
              exerciseId={exercise.id}
              name={exercise.name}
              primaryMuscleGroup={exercise.primaryMuscleGroup}
              imagePlaceholder={exercise.imagePlaceholder}
              sets={prescribedExercise.sets}
              onPress={() =>
                router.push(`/planos/${planId}/rotina/${dayId}/exercicio/${prescribedExercise.id}/editar`)
              }
              onMoveUp={isEditable && index > 0 ? () => handleMoveExercise(prescribedExercise.id, -1) : undefined}
              onMoveDown={
                isEditable && index < day.exercises.length - 1
                  ? () => handleMoveExercise(prescribedExercise.id, 1)
                  : undefined
              }
              onRemove={isEditable ? () => handleRemoveExercise(prescribedExercise.id) : undefined}
            />
          );
        })
      )}

      {isEditable && day.exercises.length > 0 && (
        <PrimaryButton
          label="+ Adicionar exercícios"
          variant="secondary"
          onPress={() => router.push(`/planos/${planId}/rotina/${dayId}/adicionar-exercicio`)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.body, color: colors.textSecondary },
  title: { ...typography.title, color: colors.textPrimary },
  weekdays: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { ...typography.title, color: colors.textPrimary },
  summaryLabel: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
