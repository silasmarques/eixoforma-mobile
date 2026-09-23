import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { FilterChips } from '@/components/FilterChips';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { searchExercises } from '@/repositories/exerciseRepository';
import { EQUIPMENT_LABELS, EQUIPMENT_LIST } from '@/domain/equipment';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '@/domain/muscleGroup';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme/tokens';
import type { Equipment } from '@/domain/equipment';
import type { Exercise } from '@/domain/exercise';
import type { MuscleGroup } from '@/domain/muscleGroup';

const MUSCLE_GROUP_OPTIONS = MUSCLE_GROUPS.map((g) => ({ value: g, label: MUSCLE_GROUP_LABELS[g] }));
const EQUIPMENT_OPTIONS = EQUIPMENT_LIST.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }));

export default function BibliotecaScreen() {
  const { planId, dayId } = useLocalSearchParams<{ planId: string; dayId: string }>();
  const client = useDatabase();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [results, setResults] = useState<Exercise[]>([]);

  useEffect(() => {
    let cancelled = false;
    searchExercises(client, {
      query: query.trim() || undefined,
      muscleGroup: muscleGroup ?? undefined,
      equipment: equipment ?? undefined,
    }).then((found) => {
      if (!cancelled) setResults(found);
    });
    return () => {
      cancelled = true;
    };
  }, [client, query, muscleGroup, equipment]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Adicionar exercício' }} />
      <TextInput
        accessibilityLabel="Buscar exercício por nome"
        style={styles.searchInput}
        placeholder="Buscar exercício…"
        value={query}
        onChangeText={setQuery}
      />

      <Text style={styles.filterLabel}>Grupo muscular</Text>
      <FilterChips options={MUSCLE_GROUP_OPTIONS} selected={muscleGroup} onSelect={setMuscleGroup} />

      <Text style={styles.filterLabel}>Equipamento</Text>
      <FilterChips options={EQUIPMENT_OPTIONS} selected={equipment} onSelect={setEquipment} />

      {results.length === 0 ? (
        <EmptyState title="Nenhum exercício encontrado" description="Tente outro termo ou filtro." />
      ) : (
        results.map((exercise) => (
          <Pressable
            key={exercise.id}
            accessibilityRole="button"
            accessibilityLabel={`Configurar ${exercise.name}`}
            onPress={() =>
              router.push(`/planos/${planId}/rotina/${dayId}/adicionar-exercicio/${exercise.id}/configurar`)
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
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
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  rowPressed: { opacity: 0.85 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { ...typography.subtitle, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
