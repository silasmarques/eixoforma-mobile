import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { planService } from '@/services/planService';
import { workoutPlanService } from '@/services/workoutPlanService';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutDaySummary , WorkoutPlan } from '@/domain/workoutPlan';

export default function MeusTreinosScreen() {
  const client = useDatabase();
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [days, setDays] = useState<WorkoutDaySummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      planService.getSelectedPlan(client).then(async (selectedPlan) => {
        if (cancelled) return;
        setPlan(selectedPlan);
        if (!selectedPlan) {
          setDays([]);
          return;
        }
        const activeVersion = await planService.getActiveVersion(client, selectedPlan.id);
        if (cancelled) return;
        if (!activeVersion) {
          setDays([]);
          return;
        }
        const result = await workoutPlanService.getWorkoutDaySummaries(client, activeVersion.id);
        if (!cancelled) setDays(result);
      });
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  if (!plan) {
    return (
      <Screen>
        <Text style={styles.meta}>Nenhum plano disponível ainda.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.planLabel}>Plano atual</Text>
      <Text style={styles.planName}>{plan.name}</Text>

      {days.map((day) => (
        <Pressable
          key={day.id}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${day.name}`}
          hitSlop={8}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push(`/treinos/${day.id}`)}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{day.name}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.tagRow}>
            {day.muscleGroups.map((group) => (
              <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
            ))}
          </View>
          <Text style={styles.meta}>
            {day.exerciseCount} exercícios · ~{day.estimatedDurationMinutes} min
          </Text>
          <Text style={styles.metaMuted}>
            {day.lastPerformedAt
              ? `Última vez: ${new Date(day.lastPerformedAt).toLocaleDateString('pt-BR')}`
              : 'Ainda não realizado'}
          </Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  planLabel: { ...typography.caption, color: colors.textMuted },
  planName: { ...typography.title, color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: minTouchTarget * 2,
  },
  cardPressed: { opacity: 0.85 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.title, color: colors.textPrimary },
  chevron: { ...typography.title, color: colors.textMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { ...typography.body, color: colors.textSecondary },
  metaMuted: { ...typography.caption, color: colors.textMuted },
});
