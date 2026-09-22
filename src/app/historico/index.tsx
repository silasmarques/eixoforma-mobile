import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { workoutSessionService } from '@/services/workoutSessionService';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

const STATUS_LABEL: Record<WorkoutSessionSummary['status'], string> = {
  in_progress: 'Em andamento',
  completed: 'Concluído',
  abandoned: 'Abandonado',
};

export default function HistoricoScreen() {
  const client = useDatabase();
  const [sessions, setSessions] = useState<WorkoutSessionSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      workoutSessionService.getSessionHistory(client).then((result) => {
        if (!cancelled) setSessions(result);
      });
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  if (sessions.length === 0) {
    return (
      <Screen>
        <Text style={styles.meta}>Nenhum treino concluído ainda.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      {sessions.map((session) => (
        <View key={session.id} style={styles.card}>
          <Text style={styles.title}>{session.dayName}</Text>
          <Text style={styles.meta}>
            {new Date(session.startedAt).toLocaleDateString('pt-BR')} · {STATUS_LABEL[session.status]}
          </Text>
        </View>
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
  title: { ...typography.subtitle, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary },
});
