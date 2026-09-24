import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { getWorkoutDaySummaries } from '@/repositories/workoutPlanRepository';
import { planService } from '@/services/planService';
import { useStartWorkout } from '@/hooks/useStartWorkout';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { WEEKDAY_ABBR_LABELS } from '@/utils/weekdayLabels';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutDaySummary } from '@/domain/workoutPlan';

/**
 * "Qual treino você quer fazer?" — só é aberta quando
 * `resolveWorkoutStartAction` resolve `choose` (mais de um treino elegível
 * pra hoje, ou nenhum, numa rotina com vários treinos). Sempre lista os
 * treinos da versão ACTIVE (nunca draft). Ao escolher, reaproveita
 * `useStartWorkout` — mesmo fluxo de sempre, sem criar sessão manualmente
 * aqui.
 */
export default function EscolherTreinoScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const client = useDatabase();
  const { startWorkout, starting } = useStartWorkout();
  const [days, setDays] = useState<WorkoutDaySummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const activeVersion = await planService.getActiveVersion(client, planId);
        const summaries = activeVersion ? await getWorkoutDaySummaries(client, activeVersion.id) : [];
        if (!cancelled) {
          setDays(summaries);
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [client, planId])
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Escolher treino' }} />
      <Text style={styles.title}>Qual treino você quer fazer?</Text>

      {loaded && days.length === 0 && (
        <EmptyState title="Nenhum treino disponível nesta rotina no momento." />
      )}

      {days.map((day) => (
        <Pressable
          key={day.id}
          accessibilityRole="button"
          accessibilityLabel={`Começar ${day.name}`}
          disabled={starting}
          onPress={() => startWorkout({ id: day.id, planId, name: day.name })}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Text style={styles.cardTitle}>{day.name}</Text>
          <View style={styles.tagRow}>
            {day.muscleGroups.map((group) => (
              <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
            ))}
          </View>
          {day.weekdays.length > 0 && (
            <Text style={styles.weekdays}>
              {[...day.weekdays]
                .sort((a, b) => a - b)
                .map((d) => WEEKDAY_ABBR_LABELS[d].toUpperCase())
                .join(' • ')}
            </Text>
          )}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardPressed: { opacity: 0.85 },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  weekdays: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
