import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WEEKDAY_ABBR_LABELS } from '@/utils/weekdayLabels';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';

// Abreviação de 3 letras (DOM/SEG/TER/QUA/QUI/SEX/SÁB) — letra única (D S T Q Q S S)
// é ambígua entre quarta/quinta e sexta/sábado.
const WEEKDAY_LABELS = WEEKDAY_ABBR_LABELS.map((label) => label.toUpperCase());

interface WeekdayPickerProps {
  value: number[];
  onChange: (weekdays: number[]) => void;
}

export function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  function toggle(day: number) {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort());
    }
  }

  return (
    <View style={styles.row} accessibilityRole="none">
      {WEEKDAY_LABELS.map((label, day) => {
        const selected = value.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`Dia da semana ${label}`}
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => toggle(day)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minWidth: minTouchTarget,
    height: minTouchTarget,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  chipLabelSelected: { color: colors.onPrimary },
});
