import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExercisePlaceholder } from './ExercisePlaceholder';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { TECHNIQUE_LABELS } from '@/domain/technique';
import { formatRestSeconds } from '@/utils/parseDecimalInput';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { MuscleGroup } from '@/domain/muscleGroup';
import type { PrescribedSet } from '@/domain/workoutPlan';

interface ExerciseRowCompactProps {
  name: string;
  primaryMuscleGroup: MuscleGroup;
  imagePlaceholder: string;
  sets: PrescribedSet[];
  onPress: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}

function summarizeSets(sets: PrescribedSet[]): string {
  if (sets.length === 0) return 'sem séries';
  const first = sets[0];
  const reps = first.targetReps ?? `${first.repRangeMin}-${first.repRangeMax}`;
  const load = first.targetLoadKg != null ? ` · ${first.targetLoadKg} kg` : '';
  const technique = first.technique !== 'normal' ? ` · ${TECHNIQUE_LABELS[first.technique]}` : '';
  return `${sets.length} séries · ${reps} reps${load} · ${formatRestSeconds(first.restSeconds)}${technique}`;
}

export function ExerciseRowCompact({
  name,
  primaryMuscleGroup,
  imagePlaceholder,
  sets,
  onPress,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ExerciseRowCompactProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Editar ${name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <ExercisePlaceholder name={name} muscleGroupSlug={imagePlaceholder} size={44} />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{MUSCLE_GROUP_LABELS[primaryMuscleGroup]}</Text>
        <Text style={styles.summary}>{summarizeSets(sets)}</Text>
      </View>
      <View style={styles.actions}>
        {onMoveUp && (
          <Pressable accessibilityLabel="Mover exercício para cima" hitSlop={8} onPress={onMoveUp} style={styles.iconButton}>
            <Text style={styles.iconText}>▲</Text>
          </Pressable>
        )}
        {onMoveDown && (
          <Pressable accessibilityLabel="Mover exercício para baixo" hitSlop={8} onPress={onMoveDown} style={styles.iconButton}>
            <Text style={styles.iconText}>▼</Text>
          </Pressable>
        )}
        {onRemove && (
          <Pressable accessibilityLabel="Remover exercício" hitSlop={8} onPress={onRemove} style={styles.iconButton}>
            <Text style={[styles.iconText, styles.destructive]}>✕</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rowPressed: { opacity: 0.85 },
  info: { flex: 1, gap: 2 },
  name: { ...typography.subtitle, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
  summary: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: 'row' },
  iconButton: {
    width: minTouchTarget * 0.7,
    height: minTouchTarget * 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { ...typography.body, color: colors.textSecondary, fontWeight: '700' },
  destructive: { color: colors.danger },
});
