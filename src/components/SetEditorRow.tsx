import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TECHNIQUE_LABELS, TECHNIQUES } from '@/domain/technique';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { Technique } from '@/domain/technique';

export interface SetDraft {
  clientKey: string;
  dbId?: string;
  useRange: boolean;
  reps: string;
  repRangeMin: string;
  repRangeMax: string;
  loadKg: string;
  restSeconds: string;
  technique: Technique;
  note: string;
}

interface SetEditorRowProps {
  order: number;
  value: SetDraft;
  onChange: (value: SetDraft) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function SetEditorRow({
  order,
  value,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: SetEditorRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.orderLabel}>Série {order}</Text>
        <View style={styles.headerActions}>
          {onMoveUp && (
            <Pressable accessibilityLabel="Mover série para cima" hitSlop={8} onPress={onMoveUp} style={styles.iconButton}>
              <Text style={styles.iconText}>▲</Text>
            </Pressable>
          )}
          {onMoveDown && (
            <Pressable accessibilityLabel="Mover série para baixo" hitSlop={8} onPress={onMoveDown} style={styles.iconButton}>
              <Text style={styles.iconText}>▼</Text>
            </Pressable>
          )}
          <Pressable accessibilityLabel="Duplicar série" hitSlop={8} onPress={onDuplicate} style={styles.iconButton}>
            <Text style={styles.iconText}>⧉</Text>
          </Pressable>
          <Pressable accessibilityLabel="Excluir série" hitSlop={8} onPress={onRemove} style={styles.iconButton}>
            <Text style={[styles.iconText, styles.destructive]}>✕</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.fieldsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange({ ...value, useRange: !value.useRange })}
          style={styles.repsToggle}
        >
          <Text style={styles.toggleLabel}>{value.useRange ? 'Faixa' : 'Fixa'}</Text>
        </Pressable>

        {value.useRange ? (
          <>
            <TextInput
              accessibilityLabel="Reps mínimas"
              style={styles.input}
              keyboardType="number-pad"
              placeholder="min"
              value={value.repRangeMin}
              onChangeText={(text) => onChange({ ...value, repRangeMin: text })}
            />
            <Text style={styles.dash}>–</Text>
            <TextInput
              accessibilityLabel="Reps máximas"
              style={styles.input}
              keyboardType="number-pad"
              placeholder="max"
              value={value.repRangeMax}
              onChangeText={(text) => onChange({ ...value, repRangeMax: text })}
            />
          </>
        ) : (
          <TextInput
            accessibilityLabel="Repetições"
            style={styles.input}
            keyboardType="number-pad"
            placeholder="reps"
            value={value.reps}
            onChangeText={(text) => onChange({ ...value, reps: text })}
          />
        )}

        <TextInput
          accessibilityLabel="Carga em quilos"
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="kg"
          value={value.loadKg}
          onChangeText={(text) => onChange({ ...value, loadKg: text })}
        />

        <TextInput
          accessibilityLabel="Descanso em segundos"
          style={styles.input}
          keyboardType="number-pad"
          placeholder="seg"
          value={value.restSeconds}
          onChangeText={(text) => onChange({ ...value, restSeconds: text })}
        />
      </View>

      <View style={styles.techniqueRow}>
        {TECHNIQUES.map((technique) => {
          const selected = value.technique === technique;
          return (
            <Pressable
              key={technique}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange({ ...value, technique })}
              style={[styles.techniqueChip, selected && styles.techniqueChipSelected]}
            >
              <Text style={[styles.techniqueLabel, selected && styles.techniqueLabelSelected]}>
                {TECHNIQUE_LABELS[technique]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function createEmptySetDraft(clientKey: string, defaults?: Partial<SetDraft>): SetDraft {
  return {
    clientKey,
    useRange: false,
    reps: '10',
    repRangeMin: '',
    repRangeMax: '',
    loadKg: '',
    restSeconds: '60',
    technique: 'normal',
    note: '',
    ...defaults,
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  headerActions: { flexDirection: 'row' },
  iconButton: {
    width: minTouchTarget * 0.65,
    height: minTouchTarget * 0.65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { ...typography.body, color: colors.textSecondary },
  destructive: { color: colors.danger },
  fieldsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  repsToggle: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  toggleLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  input: {
    minWidth: 52,
    minHeight: minTouchTarget * 0.75,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    ...typography.body,
    color: colors.textPrimary,
  },
  dash: { ...typography.body, color: colors.textMuted },
  techniqueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  techniqueChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  techniqueChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  techniqueLabel: { ...typography.caption, color: colors.textSecondary },
  techniqueLabelSelected: { color: colors.onPrimary },
});
