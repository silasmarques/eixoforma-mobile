import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RotinaCard } from '@/components/RotinaCard';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { planService } from '@/services/planService';
import { workoutPlanService } from '@/services/workoutPlanService';
import { colors, spacing, typography } from '@/theme/tokens';
import type { WorkoutDaySummary, WorkoutPlan } from '@/domain/workoutPlan';

export default function MeusTreinosScreen() {
  const client = useDatabase();
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [days, setDays] = useState<WorkoutDaySummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      planService.getSelectedPlan(client).then(async (selectedPlan) => {
        if (cancelled) return;
        setPlan(selectedPlan);
        if (!selectedPlan) {
          setDays([]);
          setLoaded(true);
          return;
        }
        const activeVersion = await planService.getActiveVersion(client, selectedPlan.id);
        if (cancelled) return;
        if (!activeVersion) {
          setDays([]);
          setLoaded(true);
          return;
        }
        const result = await workoutPlanService.getWorkoutDaySummaries(client, activeVersion.id);
        if (!cancelled) {
          setDays(result);
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  if (!loaded) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen>
        <EmptyState
          title="Nenhum plano disponível ainda"
          description="Crie seu primeiro plano de treino pra começar."
          actionLabel="+ Novo plano"
          onAction={() => router.push('/planos/novo')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Trocar plano"
        onPress={() => router.push('/planos/selecionar')}
        style={styles.planSelector}
      >
        <View>
          <Text style={styles.planLabel}>Plano atual</Text>
          <Text style={styles.planName}>{plan.name}</Text>
        </View>
        <Text style={styles.planSelectorChevron}>▾</Text>
      </Pressable>

      <PrimaryButton label="+ Novo plano" variant="secondary" onPress={() => router.push('/planos/novo')} />

      {days.length === 0 ? (
        <EmptyState
          title="Este plano ainda não tem rotinas ativas"
          description="Gerencie o plano para adicionar rotinas."
          actionLabel="Gerenciar planos"
          onAction={() => router.push('/planos')}
        />
      ) : (
        days.map((day) => (
          <RotinaCard
            key={day.id}
            name={day.name}
            muscleGroups={day.muscleGroups}
            weekdays={day.weekdays}
            exerciseCount={day.exerciseCount}
            readOnly
            onPress={() => router.push(`/treinos/${day.id}`)}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.body, color: colors.textSecondary },
  planSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  planLabel: { ...typography.caption, color: colors.textMuted },
  planName: { ...typography.subtitle, color: colors.textPrimary },
  planSelectorChevron: { ...typography.title, color: colors.textMuted },
});
