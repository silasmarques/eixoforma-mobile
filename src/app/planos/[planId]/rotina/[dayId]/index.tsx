import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ExerciseRowCompact } from '@/components/ExerciseRowCompact';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { getWorkoutDayById } from '@/repositories/workoutPlanRepository';
import { getAllExercises } from '@/repositories/exerciseRepository';
import { planService } from '@/services/planService';
import { prescriptionService } from '@/services/prescriptionService';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { colors, spacing, typography } from '@/theme/tokens';
import type { Exercise } from '@/domain/exercise';
import type { WorkoutDay, WorkoutPlan } from '@/domain/workoutPlan';

export default function RotinaDetailScreen() {
  const { planId, dayId } = useLocalSearchParams<{ planId: string; dayId: string }>();
  const client = useDatabase();
  const router = useRouter();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [day, setDay] = useState<WorkoutDay | null>(null);
  const [exercisesById, setExercisesById] = useState<Record<string, Exercise>>({});

  const load = useCallback(async () => {
    const [loadedPlan, loadedDay, exercises] = await Promise.all([
      planService.getPlanById(client, planId),
      getWorkoutDayById(client, dayId),
      getAllExercises(client),
    ]);
    setPlan(loadedPlan);
    setDay(loadedDay);
    setExercisesById(Object.fromEntries(exercises.map((e) => [e.id, e])));
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

  return (
    <Screen>
      <Stack.Screen options={{ title: day.name }} />
      <Text style={styles.title}>{day.name}</Text>
      <View style={styles.tagRow}>
        {day.muscleGroups.map((group) => (
          <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
        ))}
      </View>

      {day.exercises.length === 0 ? (
        <EmptyState
          title="Nenhum exercício ainda"
          description={isEditable ? 'Adicione o primeiro exercício desta rotina.' : undefined}
        />
      ) : (
        day.exercises.map((prescribedExercise, index) => {
          const exercise = exercisesById[prescribedExercise.exerciseId];
          if (!exercise) return null;
          return (
            <ExerciseRowCompact
              key={prescribedExercise.id}
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

      {isEditable && (
        <PrimaryButton
          label="+ Adicionar exercício"
          onPress={() => router.push(`/planos/${planId}/rotina/${dayId}/adicionar-exercicio`)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.body, color: colors.textSecondary },
  title: { ...typography.title, color: colors.textPrimary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
