import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { workoutPlanService } from '@/services/workoutPlanService';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutDaySummary } from '@/domain/workoutPlan';

export default function MeusTreinosScreen() {
  const client = useDatabase();
  const router = useRouter();
  const [days, setDays] = useState<WorkoutDaySummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      workoutPlanService.getWorkoutDaySummaries(client).then((result) => {
        if (!cancelled) setDays(result);
      });
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  return (
    <Screen>
      {days.map((day) => (
        <Pressable
          key={day.id}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${day.name}`}
          style={styles.card}
          onPress={() => router.push(`/treinos/${day.id}`)}
        >
          <Text style={styles.title}>{day.name}</Text>
          <Text style={styles.meta}>{day.muscleGroups.join(', ')}</Text>
          <View style={styles.footer}>
            <Text style={styles.footerText}>{day.exerciseCount} exercícios</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { ...typography.title, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary },
  footer: { marginTop: spacing.xs },
  footerText: { ...typography.caption, color: colors.textMuted },
});
