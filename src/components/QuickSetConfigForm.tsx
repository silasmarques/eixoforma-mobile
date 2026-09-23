import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from './PrimaryButton';
import { TECHNIQUE_LABELS, TECHNIQUES } from '@/domain/technique';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { Technique } from '@/domain/technique';

export interface QuickSetConfigValues {
  count: number;
  reps: string;
  loadKg: string;
  restSeconds: string;
  technique: Technique;
}

interface QuickSetConfigFormProps {
  onApply: (values: QuickSetConfigValues) => void;
}

/**
 * Preenche N séries de uma vez. Quem decide como mesclar isso com séries já
 * existentes (preservando dbId por posição) é a tela que chama `onApply` —
 * este componente só coleta os valores.
 */
export function QuickSetConfigForm({ onApply }: QuickSetConfigFormProps) {
  const [count, setCount] = useState('3');
  const [reps, setReps] = useState('10-12');
  const [loadKg, setLoadKg] = useState('');
  const [restSeconds, setRestSeconds] = useState('90');
  const [technique, setTechnique] = useState<Technique>('normal');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Configuração rápida</Text>
      <View style={styles.fieldsRow}>
        <View style={styles.field}>
          <Text style={styles.label}>Séries</Text>
          <TextInput
            accessibilityLabel="Número de séries"
            style={styles.input}
            keyboardType="number-pad"
            value={count}
            onChangeText={setCount}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Reps</Text>
          <TextInput
            accessibilityLabel="Repetições (ex.: 10 ou 10-12)"
            style={styles.input}
            value={reps}
            onChangeText={setReps}
            placeholder="10 ou 10-12"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Carga (kg)</Text>
          <TextInput
            accessibilityLabel="Carga em quilos"
            style={styles.input}
            keyboardType="decimal-pad"
            value={loadKg}
            onChangeText={setLoadKg}
            placeholder="30 ou 32,5"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Descanso (s)</Text>
          <TextInput
            accessibilityLabel="Descanso em segundos"
            style={styles.input}
            keyboardType="number-pad"
            value={restSeconds}
            onChangeText={setRestSeconds}
          />
        </View>
      </View>

      <View style={styles.techniqueRow}>
        {TECHNIQUES.map((t) => {
          const selected = technique === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setTechnique(t)}
              style={[styles.techniqueChip, selected && styles.techniqueChipSelected]}
            >
              <Text style={[styles.techniqueLabel, selected && styles.techniqueLabelSelected]}>
                {TECHNIQUE_LABELS[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton
        label="Aplicar"
        variant="secondary"
        onPress={() => onApply({ count: Number(count) || 0, reps, loadKg, restSeconds, technique })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.subtitle, color: colors.textPrimary },
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { gap: 4, minWidth: 80, flexGrow: 1 },
  label: { ...typography.caption, color: colors.textMuted },
  input: {
    minHeight: minTouchTarget * 0.8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.textPrimary,
  },
  techniqueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  techniqueChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  techniqueChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  techniqueLabel: { ...typography.caption, color: colors.textSecondary },
  techniqueLabelSelected: { color: colors.onPrimary },
});
