import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PlanHomeCard } from '@/components/PlanHomeCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useDatabase } from '@/database/DatabaseProvider';
import { useStartWorkout } from '@/hooks/useStartWorkout';
import { getHomeSnapshot, type HomeSnapshot } from '@/services/homeSnapshot';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';

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

  const { selectedPlan, todayWorkout, recentPlans, activeSession, lastSession, weeklyCompleted, weeklyTotal } =
    snapshot;

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

      {!activeSession && todayWorkout && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Hoje</Text>
          <Text style={styles.cardTitle}>{todayWorkout.day.name}</Text>
          <View style={styles.tagRow}>
            {todayWorkout.day.muscleGroups.map((group) => (
              <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
            ))}
          </View>
          <Text style={styles.cardMeta}>
            {todayWorkout.day.exerciseCount} exercícios · ~{todayWorkout.day.estimatedDurationMinutes} min
          </Text>
          <PrimaryButton
            label="Iniciar treino"
            disabled={starting}
            onPress={() =>
              startWorkout({
                id: todayWorkout.day.id,
                planId: todayWorkout.planId,
                name: todayWorkout.day.name,
              })
            }
          />
        </View>
      )}

      {!activeSession && !todayWorkout && selectedPlan && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Hoje</Text>
          <Text style={styles.cardMeta}>Nenhuma rotina marcada pra hoje.</Text>
          <PrimaryButton
            label="Ver plano atual"
            variant="secondary"
            onPress={() => router.push(`/planos/${selectedPlan.plan.id}`)}
          />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Meus treinos</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cadastrar treino"
          hitSlop={8}
          onPress={() => router.push('/planos/novo')}
          style={styles.sectionAddButton}
        >
          <Text style={styles.sectionAddLabel}>+</Text>
        </Pressable>
      </View>

      {selectedPlan ? (
        <PlanHomeCard
          summary={selectedPlan}
          highlighted
          onPress={() => router.push(`/planos/${selectedPlan.plan.id}`)}
        />
      ) : (
        <EmptyState
          title="Nenhum plano ainda"
          description="Cadastre seu primeiro treino pra começar."
          actionLabel="+ Cadastrar treino"
          onAction={() => router.push('/planos/novo')}
        />
      )}

      {recentPlans.map((summary) => (
        <PlanHomeCard
          key={summary.plan.id}
          summary={summary}
          onPress={() => router.push(`/planos/${summary.plan.id}`)}
        />
      ))}

      <PrimaryButton label="Ver todos" variant="secondary" onPress={() => router.push('/planos')} />
      <PrimaryButton label="+ Cadastrar treino" variant="secondary" onPress={() => router.push('/planos/novo')} />

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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary },
  sectionAddButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAddLabel: { ...typography.title, color: colors.primary },
});
