import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutPlanVersionStatus } from '@/domain/workoutPlan';

type BadgeKind = WorkoutPlanVersionStatus | 'prescribed';

const LABELS: Record<BadgeKind, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  superseded: 'Substituído',
  prescribed: 'Prescrito',
};

const BACKGROUNDS: Record<BadgeKind, string> = {
  draft: colors.surfaceRaised,
  active: '#E1F0E4',
  superseded: colors.surfaceRaised,
  prescribed: '#EFE6F5',
};

const TEXT_COLORS: Record<BadgeKind, string> = {
  draft: colors.textSecondary,
  active: colors.primary,
  superseded: colors.textMuted,
  prescribed: '#6B4A96',
};

interface StatusBadgeProps {
  kind: BadgeKind;
  /**
   * Sobrescreve o texto padrão — necessário porque este badge é
   * compartilhado por telas que chamam a entidade de "rotina" (feminino,
   * ex.: "Ativa") e telas que ainda dizem "plano" (masculino, "Ativo").
   * Sem isso, o rótulo fixo erra a concordância em um dos dois contextos.
   */
  label?: string;
}

export function StatusBadge({ kind, label }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: BACKGROUNDS[kind] }]}>
      <Text style={[styles.label, { color: TEXT_COLORS[kind] }]}>{label ?? LABELS[kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
  },
});
