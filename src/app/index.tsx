import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { useStartWorkout } from '@/hooks/useStartWorkout';
import { getHomeSnapshot, type HomeSnapshot } from '@/services/homeSnapshot';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const client = useDatabase();
  const router = useRouter();
  const { startWorkout, starting } = useStartWorkout();
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getHomeSnapshot(client).then((result) => {
        if (!cancelled) setSnapshot(result);
      });
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  if (!snapshot) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  const { suggestedDay, activeSession, lastSession, weeklyCompleted, weeklyTotal } = snapshot;

  return (
    <Screen>
      <Text style={styles.greeting}>Olá! Bora treinar?</Text>

      {activeSession && (
        <View style={styles.bannerCard} accessibilityRole="summary">
          <Text style={styles.bannerTitle}>Você possui um treino em andamento</Text>
          <Text style={styles.bannerSubtitle}>{activeSession.dayName}</Text>
          <PrimaryButton
            label="Continuar treino"
            onPress={() => router.push(`/sessao/${activeSession.id}`)}
          />
        </View>
      )}

      {suggestedDay && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Treino sugerido de hoje</Text>
          <Text style={styles.cardTitle}>{suggestedDay.name}</Text>
          <View style={styles.tagRow}>
            {suggestedDay.muscleGroups.map((group) => (
              <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
            ))}
          </View>
          <Text style={styles.cardMeta}>
            {suggestedDay.exerciseCount} exercícios · ~{suggestedDay.estimatedDurationMinutes} min
          </Text>
          <PrimaryButton
            label={activeSession ? 'Ver Treino A' : 'Iniciar treino'}
            disabled={starting}
            onPress={() =>
              activeSession
                ? router.push(`/treinos/${suggestedDay.id}`)
                : startWorkout({
                    id: suggestedDay.id,
                    planId: suggestedDay.planId,
                    name: suggestedDay.name,
                  })
            }
          />
        </View>
      )}

      <View style={styles.rowCards}>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.cardLabel}>Último treino</Text>
          {lastSession ? (
            <>
              <Text style={styles.cardTitle}>{lastSession.dayName}</Text>
              <Text style={styles.cardMeta}>
                {new Date(lastSession.completedAt ?? lastSession.startedAt).toLocaleDateString(
                  'pt-BR'
                )}
              </Text>
            </>
          ) : (
            <Text style={styles.cardMeta}>Nenhum treino concluído ainda.</Text>
          )}
        </View>

        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.cardLabel}>Progresso semanal</Text>
          <Text style={styles.cardTitle}>
            {weeklyCompleted} de {weeklyTotal}
          </Text>
          <Text style={styles.cardMeta}>treinos concluídos</Text>
        </View>
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
  meta: { ...typography.body, color: colors.textSecondary },
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
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  bannerCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bannerTitle: { ...typography.subtitle, color: colors.textPrimary },
  bannerSubtitle: { ...typography.body, color: colors.textSecondary },
  rowCards: { flexDirection: 'row', gap: spacing.md },
  halfCard: { flex: 1 },
});
