import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from './StatusBadge';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { WorkoutPlanVersionStatus } from '@/domain/workoutPlan';

interface PlanCardProps {
  name: string;
  goal: string | null;
  isPrescribed: boolean;
  status: WorkoutPlanVersionStatus | null;
  isSelected?: boolean;
  onPress: () => void;
}

export function PlanCard({ name, goal, isPrescribed, status, isSelected, onPress }: PlanCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${name}`}
      accessibilityState={{ selected: !!isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isSelected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>
        {isSelected && <Text style={styles.selectedMark}>✓</Text>}
      </View>
      {goal && <Text style={styles.goal}>{goal}</Text>}
      <View style={styles.badges}>
        {isPrescribed && <StatusBadge kind="prescribed" />}
        {status && <StatusBadge kind={status} />}
      </View>
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
  cardSelected: { borderColor: colors.primary, borderWidth: 2 },
  cardPressed: { opacity: 0.85 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.subtitle, color: colors.textPrimary },
  selectedMark: { ...typography.subtitle, color: colors.primary },
  goal: { ...typography.caption, color: colors.textSecondary },
  badges: { flexDirection: 'row', gap: spacing.xs },
});
