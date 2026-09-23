import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from './StatusBadge';
import { WEEKDAY_ABBR_LABELS } from '@/utils/weekdayLabels';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { PlanHomeSummary } from '@/services/homeSnapshot';

interface PlanHomeCardProps {
  summary: PlanHomeSummary;
  highlighted?: boolean;
  onPress: () => void;
}

/**
 * Card de UM WorkoutPlan na Home — nunca de uma WorkoutPlanVersion. Mostra
 * até 3 rotinas como prévia, nunca a lista de exercícios (isso é da tela do
 * plano, não da Home).
 */
export function PlanHomeCard({ summary, highlighted, onPress }: PlanHomeCardProps) {
  const { plan, version, dayPreviews, totalDayCount } = summary;
  const originLabel = plan.origin === 'prescribed' ? 'Prescrito pelo treinador' : 'Criado por mim';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir plano ${plan.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        highlighted && styles.cardHighlighted,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{plan.name}</Text>
        {version && (version.status === 'active' || version.status === 'draft') && (
          <StatusBadge kind={version.status} />
        )}
      </View>
      <Text style={styles.origin}>{originLabel}</Text>

      {dayPreviews.length > 0 ? (
        <View style={styles.dayList}>
          {dayPreviews.map((day) => (
            <Text key={day.id} style={styles.dayLine} numberOfLines={1}>
              {day.name}
              {day.weekdays.length > 0 ? ` • ${WEEKDAY_ABBR_LABELS[day.weekdays[0]]}` : ''}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyMeta}>Sem rotinas ainda</Text>
      )}

      {totalDayCount > 0 && (
        <Text style={styles.footer}>
          {totalDayCount} {totalDayCount === 1 ? 'treino' : 'treinos'}
        </Text>
      )}
    </Pressable>
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
  cardHighlighted: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardPressed: { opacity: 0.85 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.subtitle, color: colors.textPrimary, flexShrink: 1 },
  origin: { ...typography.caption, color: colors.textMuted },
  dayList: { gap: 2, marginTop: spacing.xs },
  dayLine: { ...typography.body, color: colors.textSecondary },
  emptyMeta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  footer: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
