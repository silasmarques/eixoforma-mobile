import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tag } from './Tag';
import { MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { WEEKDAY_ABBR_LABELS } from '@/utils/weekdayLabels';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { MuscleGroup } from '@/domain/muscleGroup';

interface RotinaCardProps {
  name: string;
  muscleGroups: MuscleGroup[];
  weekdays: number[];
  exerciseCount: number;
  /** Nomes dos primeiros exercícios, pra prévia (ex.: tela do plano) — omitido nas listas que não precisam disso. */
  exercisePreview?: string[];
  onPress: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

export function RotinaCard({
  name,
  muscleGroups,
  weekdays,
  exerciseCount,
  exercisePreview,
  onPress,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  readOnly,
}: RotinaCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.weekdays}>
        {weekdays.length > 0
          ? [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_ABBR_LABELS[d].toUpperCase()).join(' / ')
          : 'Sem dia fixo'}
      </Text>
      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <View style={styles.tagRow}>
        {muscleGroups.map((group) => (
          <Tag key={group} label={MUSCLE_GROUP_LABELS[group]} />
        ))}
      </View>
      <Text style={styles.meta}>
        {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
      </Text>

      {exercisePreview && exercisePreview.length > 0 && (
        <View style={styles.previewList}>
          {exercisePreview.map((exerciseName) => (
            <Text key={exerciseName} style={styles.previewLine} numberOfLines={1}>
              {exerciseName}
            </Text>
          ))}
          {exerciseCount > exercisePreview.length && (
            <Text style={styles.previewMore}>+{exerciseCount - exercisePreview.length}</Text>
          )}
        </View>
      )}

      {!readOnly && (onMoveUp || onMoveDown || onDuplicate || onDelete) && (
        <View style={styles.actions}>
          {onMoveUp && (
            <Pressable accessibilityLabel="Mover para cima" hitSlop={8} onPress={onMoveUp} style={styles.actionButton}>
              <Text style={styles.actionText}>▲</Text>
            </Pressable>
          )}
          {onMoveDown && (
            <Pressable accessibilityLabel="Mover para baixo" hitSlop={8} onPress={onMoveDown} style={styles.actionButton}>
              <Text style={styles.actionText}>▼</Text>
            </Pressable>
          )}
          {onDuplicate && (
            <Pressable accessibilityLabel="Duplicar rotina" hitSlop={8} onPress={onDuplicate} style={styles.actionButton}>
              <Text style={styles.actionText}>Duplicar</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable accessibilityLabel="Excluir rotina" hitSlop={8} onPress={onDelete} style={styles.actionButton}>
              <Text style={[styles.actionText, styles.destructive]}>Excluir</Text>
            </Pressable>
          )}
        </View>
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
  cardPressed: { opacity: 0.85 },
  weekdays: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.title, color: colors.textPrimary },
  chevron: { ...typography.title, color: colors.textMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { ...typography.body, color: colors.textSecondary },
  previewList: { gap: 2 },
  previewLine: { ...typography.caption, color: colors.textSecondary },
  previewMore: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: { minHeight: minTouchTarget, justifyContent: 'center' },
  actionText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  destructive: { color: colors.danger },
});
