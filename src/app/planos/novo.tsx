import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { planService } from '@/services/planService';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';

export default function NovoPlanoScreen() {
  const client = useDatabase();
  const router = useRouter();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  const isDirty = name.trim() !== '' || goal.trim() !== '';
  useUnsavedChangesGuard(isDirty && !saving);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome pro plano.');
      return;
    }
    setSaving(true);
    try {
      const { plan } = await planService.createPlan(client, {
        name: name.trim(),
        goal: goal.trim() || null,
        origin: 'personal',
      });
      router.replace(`/planos/${plan.id}`);
    } catch {
      setSaving(false);
      Alert.alert('Erro', 'Não foi possível criar o plano.');
    }
  }

  return (
    <Screen>
      <Text style={styles.label}>Nome do plano</Text>
      <TextInput
        accessibilityLabel="Nome do plano"
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Hipertrofia Setembro"
      />

      <Text style={styles.label}>Objetivo (opcional)</Text>
      <TextInput
        accessibilityLabel="Objetivo do plano"
        style={styles.input}
        value={goal}
        onChangeText={setGoal}
        placeholder="Ganho de massa"
      />

      <PrimaryButton label="Criar plano" onPress={handleCreate} disabled={saving} />
      <Text style={styles.hint}>
        Você adiciona as rotinas (Treino A, B, C...) na próxima tela. O plano só fica disponível pra
        treinar depois que você tocar em &ldquo;Usar este plano&rdquo;.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textMuted },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.textPrimary,
  },
  hint: { ...typography.caption, color: colors.textMuted },
});
