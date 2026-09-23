import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { FilterChips } from '@/components/FilterChips';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { searchExercises } from '@/repositories/exerciseRepository';
import { EQUIPMENT_LABELS, EQUIPMENT_LIST } from '@/domain/equipment';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { buildQueueSearch } from '@/utils/exerciseQueue';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { Equipment } from '@/domain/equipment';
import type { Exercise } from '@/domain/exercise';
import type { MuscleGroup } from '@/domain/muscleGroup';

const EQUIPMENT_OPTIONS = EQUIPMENT_LIST.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }));

export default function BibliotecaScreen() {
  const { planId, dayId } = useLocalSearchParams<{ planId: string; dayId: string }>();
  const client = useDatabase();
  const router = useRouter();

  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [results, setResults] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!muscleGroup) return;
    let cancelled = false;
    searchExercises(client, {
      query: query.trim() || undefined,
      muscleGroup,
      equipment: equipment ?? undefined,
    }).then((found) => {
      if (!cancelled) setResults(found);
    });
    return () => {
      cancelled = true;
    };
  }, [client, query, muscleGroup, equipment]);

  function toggleSelected(exerciseId: string) {
    setSelectedIds((current) =>
      current.includes(exerciseId) ? current.filter((id) => id !== exerciseId) : [...current, exerciseId]
    );
  }

  function handleTrocarGrupamento() {
    setMuscleGroup(null);
    setQuery('');
    setEquipment(null);
    setSelectedIds([]);
    setResults([]);
  }

  function handleAdicionar() {
    if (selectedIds.length === 0) return;
    const [first, ...rest] = selectedIds;
    const search = buildQueueSearch(rest, selectedIds.length);
    router.replace(
      `/planos/${planId}/rotina/${dayId}/adicionar-exercicio/${first}/configurar${search ? `?${search}` : ''}`
    );
  }

  // Etapa 1 — escolher o grupamento muscular antes de listar exercícios.
  if (!muscleGroup) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Adicionar exercícios' }} />
        <Text style={styles.stepTitle}>Escolha um grupamento</Text>
        <View style={styles.groupGrid}>
          {MUSCLE_GROUPS.map((group) => (
            <Pressable
              key={group}
              accessibilityRole="button"
              onPress={() => setMuscleGroup(group)}
              style={({ pressed }) => [styles.groupCard, pressed && styles.groupCardPressed]}
            >
              <Text style={styles.groupLabel}>{MUSCLE_GROUP_LABELS[group]}</Text>
            </Pressable>
          ))}
        </View>
      </Screen>
    );
  }

  // Etapa 2 — seleção múltipla de exercícios dentro do grupamento escolhido.
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Adicionar exercícios' }} />
      <Pressable accessibilityRole="button" onPress={handleTrocarGrupamento} hitSlop={8}>
        <Text style={styles.backLink}>← {MUSCLE_GROUP_LABELS[muscleGroup]}</Text>
      </Pressable>

      <TextInput
        accessibilityLabel="Buscar exercício por nome"
        style={styles.searchInput}
        placeholder="Buscar exercício…"
        value={query}
        onChangeText={setQuery}
      />

      <Text style={styles.filterLabel}>Equipamento</Text>
      <FilterChips options={EQUIPMENT_OPTIONS} selected={equipment} onSelect={setEquipment} />

      {results.length === 0 ? (
        <EmptyState title="Nenhum exercício encontrado" description="Tente outro termo ou filtro." />
      ) : (
        results.map((exercise) => {
          const selected = selectedIds.includes(exercise.id);
          return (
            <Pressable
              key={exercise.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${selected ? 'Remover' : 'Selecionar'} ${exercise.name}`}
              onPress={() => toggleSelected(exercise.id)}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
            >
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <ExerciseMedia
                exerciseId={exercise.id}
                name={exercise.name}
                muscleGroupSlug={exercise.imagePlaceholder}
                variant="thumbnail"
              />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{exercise.name}</Text>
                <Text style={styles.rowMeta}>
                  {MUSCLE_GROUP_LABELS[exercise.primaryMuscleGroup]} · {EQUIPMENT_LABELS[exercise.equipment]}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      {selectedIds.length > 0 && (
        <PrimaryButton
          label={`Adicionar ${selectedIds.length} ${selectedIds.length === 1 ? 'exercício' : 'exercícios'}`}
          onPress={handleAdicionar}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepTitle: { ...typography.subtitle, color: colors.textPrimary },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupCard: {
    minWidth: '47%',
    flexGrow: 1,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  groupCardPressed: { opacity: 0.85 },
  groupLabel: { ...typography.subtitle, color: colors.textPrimary },
  backLink: { ...typography.body, color: colors.primary, fontWeight: '700' },
  searchInput: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.textPrimary,
  },
  filterLabel: { ...typography.caption, color: colors.textMuted },
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
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceRaised },
  rowPressed: { opacity: 0.85 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.onPrimary, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { ...typography.subtitle, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
