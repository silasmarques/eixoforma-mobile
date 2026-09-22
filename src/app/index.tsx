import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { workoutPlanService } from '@/services/workoutPlanService';
import { workoutSessionService } from '@/services/workoutSessionService';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutDaySummary } from '@/domain/workoutPlan';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

export default function HomeScreen() {
  const client = useDatabase();
  const router = useRouter();
  const [suggestedDay, setSuggestedDay] = useState<WorkoutDaySummary | null>(null);
  const [activeSession, setActiveSession] = useState<WorkoutSessionSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        workoutPlanService.getWorkoutDaySummaries(client),
        workoutSessionService.findActiveSession(client),
      ]).then(([days, session]) => {
        if (cancelled) return;
        setSuggestedDay(days[0] ?? null);
        setActiveSession(session);
      });
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  return (
    <Screen>
      <Text style={styles.greeting}>Olá! Bora treinar?</Text>

      {activeSession && (
        <View style={styles.bannerCard} accessibilityRole="summary">
          <Text style={styles.bannerTitle}>Você possui um treino em andamento</Text>
          <Text style={styles.bannerSubtitle}>{activeSession.dayName}</Text>
          <View style={styles.bannerActions}>
            <PrimaryButton
              label="Continuar treino"
              onPress={() => router.push(`/sessao/${activeSession.id}`)}
            />
          </View>
        </View>
      )}

      {suggestedDay && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Treino sugerido de hoje</Text>
          <Text style={styles.cardTitle}>{suggestedDay.name}</Text>
          <Text style={styles.cardMeta}>
            {suggestedDay.muscleGroups.join(', ')} · {suggestedDay.exerciseCount} exercícios
          </Text>
          <PrimaryButton
            label="Iniciar treino"
            disabled={!!activeSession}
            onPress={() => router.push(`/treinos/${suggestedDay.id}`)}
          />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Progresso semanal</Text>
        <Text style={styles.cardTitle}>2 de 3 treinos concluídos</Text>
      </View>

      <PrimaryButton
        label="Meus Treinos"
        variant="secondary"
        onPress={() => router.push('/treinos')}
      />
      <PrimaryButton
        label="Histórico"
        variant="secondary"
        onPress={() => router.push('/historico')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.display, color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardLabel: { ...typography.caption, color: colors.textMuted },
  cardTitle: { ...typography.title, color: colors.textPrimary },
  cardMeta: { ...typography.body, color: colors.textSecondary },
  bannerCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bannerTitle: { ...typography.subtitle, color: colors.textPrimary },
  bannerSubtitle: { ...typography.body, color: colors.textSecondary },
  bannerActions: { marginTop: spacing.xs },
});
