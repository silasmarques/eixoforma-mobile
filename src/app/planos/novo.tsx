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
    if (saving) return;
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome pra essa rotina.');
      return;
    }
    setSaving(true);
    try {
      const { plan } = await planService.createPlan(client, {
        name: name.trim(),
        goal: goal.trim() || null,
        origin: 'personal',
      });
      await planService.selectPlan(client, plan.id);
      router.replace(`/planos/${plan.id}`);
    } catch {
      setSaving(false);
      Alert.alert('Erro', 'Não foi possível criar a rotina.');
    }
  }

  return (
    <Screen>
      <Text style={styles.screenTitle}>Criar rotina</Text>

      <Text style={styles.label}>Nome da rotina</Text>
      <TextInput
        accessibilityLabel="Nome da rotina"
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Hipertrofia — Setembro"
      />

      <Text style={styles.label}>Comentário (opcional)</Text>
      <TextInput
        accessibilityLabel="Comentário da rotina"
        style={styles.input}
        value={goal}
        onChangeText={setGoal}
        placeholder="Foco em hipertrofia com prioridade em peitoral e pernas."
      />

      <PrimaryButton label="Criar rotina" onPress={handleCreate} disabled={saving} />
      <Text style={styles.hint}>
        Você adiciona os treinos (Treino A, B, C...) na próxima tela. Esta rotina só fica disponível
        pra treinar depois que você tocar em &ldquo;Usar esta rotina&rdquo;.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: { ...typography.title, color: colors.textPrimary },
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
