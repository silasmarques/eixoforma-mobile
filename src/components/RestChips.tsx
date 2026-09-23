import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';

const PRESETS = [
  { label: '30s', seconds: '30' },
  { label: '45s', seconds: '45' },
  { label: '60s', seconds: '60' },
  { label: '90s', seconds: '90' },
  { label: '2min', seconds: '120' },
];

interface RestChipsProps {
  value: string;
  onChange: (seconds: string) => void;
}

/**
 * Descanso entre séries — opções rápidas (30s/45s/60s/90s/2min) mais
 * "Personalizado" para qualquer outro valor. `value` continua sendo apenas
 * o número de segundos em texto (mesmo campo que já existia); este
 * componente só decide como apresentar a escolha.
 */
export function RestChips({ value, onChange }: RestChipsProps) {
  const matchesPreset = PRESETS.some((preset) => preset.seconds === value);
  const [customMode, setCustomMode] = useState(!matchesPreset && value !== '');

  const showCustomInput = customMode || (!matchesPreset && value !== '');

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {PRESETS.map((preset) => {
          const selected = !showCustomInput && value === preset.seconds;
          return (
            <Pressable
              key={preset.seconds}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setCustomMode(false);
                onChange(preset.seconds);
              }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{preset.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: showCustomInput }}
          onPress={() => setCustomMode(true)}
          style={[styles.chip, showCustomInput && styles.chipSelected]}
        >
          <Text style={[styles.chipLabel, showCustomInput && styles.chipLabelSelected]}>Personalizado</Text>
        </Pressable>
      </View>
      {showCustomInput && (
        <TextInput
          accessibilityLabel="Descanso personalizado, em segundos"
          style={styles.customInput}
          keyboardType="number-pad"
          placeholder="segundos"
          value={value}
          onChangeText={onChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minHeight: minTouchTarget * 0.75,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  chipLabelSelected: { color: colors.onPrimary },
  customInput: {
    minHeight: minTouchTarget * 0.75,
    maxWidth: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.textPrimary,
  },
});
