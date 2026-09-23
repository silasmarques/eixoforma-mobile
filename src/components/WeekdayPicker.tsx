import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // 0=domingo..6=sábado

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
    <View style={styles.row}>
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
  row: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    width: minTouchTarget,
    height: minTouchTarget,
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
  chipLabel: { ...typography.subtitle, color: colors.textSecondary },
  chipLabelSelected: { color: colors.onPrimary },
});
