import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PlanHomeCard } from '@/components/PlanHomeCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { useStartWorkout } from '@/hooks/useStartWorkout';
import { getHomeSnapshot, type HomeSnapshot } from '@/services/homeSnapshot';
import { WEEKDAY_ABBR_LABELS } from '@/utils/weekdayLabels';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';

const CARD_PEEK = 28;

export default function HomeScreen() {
  const client = useDatabase();
  const router = useRouter();
  const { startWorkout, starting } = useStartWorkout();
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - spacing.md * 2 - CARD_PEEK;

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

  const { orderedPlans, selectedPlanId, topPlan, topPlanStartAction, lastSession, weeklyCompleted, weeklyTotal } =
    snapshot;

  function handleComecarTreino() {
    if (!topPlan || !topPlanStartAction) return;
    if (topPlanStartAction.kind === 'direct') {
      startWorkout({ id: topPlanStartAction.dayId, planId: topPlan.plan.id, name: topPlanStartAction.dayName });
    } else {
      router.push(`/planos/${topPlan.plan.id}/escolher-treino`);
    }
  }

  return (
    <Screen>
      <Text style={styles.greeting}>Olá! Bora treinar?</Text>

      {topPlan && topPlanStartAction && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sua rotina mais recente</Text>
          <Text style={styles.cardTitle}>{topPlan.plan.name}</Text>
          <Text style={styles.cardMeta}>
            {topPlan.totalDayCount} {topPlan.totalDayCount === 1 ? 'treino' : 'treinos'}
            {topPlan.weekdays.length > 0
              ? ` · ${topPlan.weekdays.map((d) => WEEKDAY_ABBR_LABELS[d].toUpperCase()).join(' • ')}`
              : ''}
          </Text>
          <PrimaryButton label="Começar treino" disabled={starting} onPress={handleComecarTreino} />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Meus treinos</Text>
          <Text style={styles.sectionSubtitle}>Crie suas próprias rotinas de treino</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Criar rotina"
          hitSlop={8}
          onPress={() => router.push('/planos/novo')}
          style={styles.sectionAddButton}
        >
          <Text style={styles.sectionAddLabel}>+</Text>
        </Pressable>
      </View>

      {orderedPlans.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + spacing.sm}
          snapToAlignment="start"
          contentContainerStyle={styles.horizontalList}
        >
          {orderedPlans.map((summary) => (
            <View key={summary.plan.id} style={{ width: cardWidth }}>
              <PlanHomeCard
                summary={summary}
                highlighted={summary.plan.id === selectedPlanId}
                onPress={() => router.push(`/planos/${summary.plan.id}`)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <EmptyState
          title="Nenhuma rotina ainda"
          description="Crie sua primeira rotina de treino pra começar."
          actionLabel="+ Criar rotina"
          onAction={() => router.push('/planos/novo')}
        />
      )}

      <PrimaryButton label="Ver todos" variant="secondary" onPress={() => router.push('/planos')} />

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

      <PrimaryButton label="Histórico" variant="secondary" onPress={() => router.push('/historico')} />
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
  rowCards: { flexDirection: 'row', gap: spacing.md },
  halfCard: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary },
  sectionSubtitle: { ...typography.caption, color: colors.textMuted },
  horizontalList: { gap: spacing.sm, paddingRight: spacing.md },
  sectionAddButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAddLabel: { ...typography.title, color: colors.primary },
});
