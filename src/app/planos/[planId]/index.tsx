import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RotinaCard } from '@/components/RotinaCard';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { useDatabase } from '@/database/DatabaseProvider';
import { getVersionByStatus } from '@/repositories/planVersionRepository';
import {
  duplicateDay,
  getWorkoutDayById,
  getWorkoutDaySummaries,
} from '@/repositories/workoutPlanRepository';
import { getAllExercises } from '@/repositories/exerciseRepository';
import { planService } from '@/services/planService';
import { prescriptionService } from '@/services/prescriptionService';
import { workoutSessionService } from '@/services/workoutSessionService';
import { useStartWorkout } from '@/hooks/useStartWorkout';
import { DraftNotDiscardableError, IncompletePlanVersionError } from '@/domain/prescriptionErrors';
import { currentWeekday } from '@/utils/weekdayLabels';
import { resolveWorkoutStartAction } from '@/utils/resolveWorkoutStartAction';
import { colors, spacing, typography } from '@/theme/tokens';
import type { WorkoutDaySummary, WorkoutPlan, WorkoutPlanVersion } from '@/domain/workoutPlan';
import type { WorkoutSessionSummary } from '@/domain/workoutSession';

const EXERCISE_PREVIEW_LIMIT = 3;

export default function PlanMontagemScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const client = useDatabase();
  const router = useRouter();
  const { startWorkout, starting } = useStartWorkout();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [version, setVersion] = useState<WorkoutPlanVersion | null>(null);
  const [hasActiveVersion, setHasActiveVersion] = useState(false);
  const [activeDays, setActiveDays] = useState<WorkoutDaySummary[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSessionSummary | null>(null);
  const [days, setDays] = useState<WorkoutDaySummary[]>([]);
  const [previewsByDayId, setPreviewsByDayId] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const loadedPlan = await planService.getPlanById(client, planId);
    if (!loadedPlan) return;
    setPlan(loadedPlan);

    const viewable = await planService.resolveViewableVersion(client, planId);
    setVersion(viewable);
    const active = await getVersionByStatus(client, planId, 'active');
    setHasActiveVersion(!!active);
    setActiveDays(active ? await getWorkoutDaySummaries(client, active.id) : []);

    const session = await workoutSessionService.findActiveSession(client);
    setActiveSession(session && session.planId === planId ? session : null);

    if (viewable) {
      const summaries = await getWorkoutDaySummaries(client, viewable.id);
      setDays(summaries);

      const exercises = await getAllExercises(client);
      const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));
      const fullDays = await Promise.all(summaries.map((s) => getWorkoutDayById(client, s.id)));
      const previews: Record<string, string[]> = {};
      fullDays.forEach((fullDay) => {
        if (!fullDay) return;
        previews[fullDay.id] = fullDay.exercises
          .slice(0, EXERCISE_PREVIEW_LIMIT)
          .map((pe) => exerciseNameById.get(pe.exerciseId) ?? pe.exerciseId);
      });
      setPreviewsByDayId(previews);
    } else {
      setDays([]);
      setPreviewsByDayId({});
    }
  }, [client, planId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().then(() => {
        if (cancelled) return;
      });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const isPersonal = plan?.origin === 'personal';
  // Editável quando já existe um draft (edição em curso) — nunca antes disso, sem toque explícito.
  const isEditable = isPersonal && version?.status === 'draft';

  async function handleEnterEditMode() {
    setBusy(true);
    try {
      await prescriptionService.getEditableVersion(client, planId);
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a edição deste plano.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscardDraft() {
    Alert.alert('Descartar alterações?', 'As mudanças feitas neste rascunho serão perdidas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await planService.discardDraft(client, planId);
            await load();
          } catch (error) {
            if (error instanceof DraftNotDiscardableError) {
              Alert.alert('Não foi possível descartar', error.message);
            } else {
              Alert.alert('Erro', 'Não foi possível descartar as alterações.');
            }
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function handleActivate() {
    if (!version) return;
    setBusy(true);
    try {
      await planService.activatePlanVersion(client, { planId, versionId: version.id });
      Alert.alert('Rotina ativada', 'Esta rotina já pode ser usada para treinar.');
      await load();
    } catch (error) {
      if (error instanceof IncompletePlanVersionError) {
        Alert.alert('Plano incompleto', error.message);
      } else {
        Alert.alert('Erro', 'Não foi possível ativar o plano.');
      }
    } finally {
      setBusy(false);
    }
  }

  function handleStartWorkout() {
    const action = resolveWorkoutStartAction(activeDays, currentWeekday());
    if (action.kind === 'direct') {
      startWorkout({ id: action.dayId, planId, name: action.dayName });
    } else {
      router.push(`/planos/${planId}/escolher-treino`);
    }
  }

  async function handleMoveDay(dayId: string, direction: -1 | 1) {
    const index = days.findIndex((d) => d.id === dayId);
    const target = index + direction;
    if (target < 0 || target >= days.length) return;
    const reordered = [...days];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await prescriptionService.reorderDays(client, planId, reordered.map((d) => d.id));
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível reordenar as rotinas.');
    }
  }

  async function handleDuplicateDay(dayId: string) {
    try {
      const editable = await prescriptionService.getEditableVersion(client, planId);
      const belongs = days.some((d) => d.id === dayId) && version?.id === editable.id;
      if (!belongs) {
        Alert.alert('Recarregando', 'A tela precisou atualizar — tente duplicar de novo.');
        await load();
        return;
      }
      await duplicateDay(client, dayId);
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível duplicar a rotina.');
    }
  }

  async function handleDeleteDay(dayId: string) {
    Alert.alert('Excluir rotina?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await prescriptionService.removeDay(client, planId, dayId);
            await load();
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir a rotina.');
          }
        },
      },
    ]);
  }

  if (!plan) {
    return (
      <Screen>
        <Text style={styles.meta}>Carregando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: plan.name }} />
      <View style={styles.header}>
        <Text style={styles.title}>{plan.name}</Text>
        {plan.origin === 'prescribed' && <StatusBadge kind="prescribed" />}
        {version && <StatusBadge kind={version.status} />}
      </View>
      {plan.goal && <Text style={styles.goal}>{plan.goal}</Text>}

      {plan.origin === 'prescribed' && (
        <Text style={styles.readOnlyBanner}>Somente leitura — prescrito pelo treinador.</Text>
      )}

      {activeSession ? (
        <PrimaryButton
          label="Continuar treino"
          onPress={() => router.push(`/sessao/${activeSession.id}`)}
        />
      ) : (
        hasActiveVersion &&
        activeDays.length > 0 && (
          <PrimaryButton label="Iniciar treino" onPress={handleStartWorkout} disabled={starting} />
        )
      )}

      {isPersonal && !isEditable && (
        <PrimaryButton label="Editar rotina" onPress={handleEnterEditMode} disabled={busy} />
      )}

      <Text style={styles.sectionTitle}>Treinos da rotina</Text>

      {isEditable && (
        <PrimaryButton
          label="+ Adicionar treino"
          onPress={() => router.push(`/planos/${planId}/rotina/nova`)}
        />
      )}

      {days.length === 0 ? (
        <EmptyState
          title="Nenhum treino ainda"
          description={
            isEditable ? 'Crie seus treinos por dia da semana ou por grupos musculares.' : undefined
          }
        />
      ) : (
        days.map((day, index) => (
          <RotinaCard
            key={day.id}
            name={day.name}
            muscleGroups={day.muscleGroups}
            weekdays={day.weekdays}
            exerciseCount={day.exerciseCount}
            exercisePreview={previewsByDayId[day.id]}
            readOnly={!isEditable}
            onPress={() => router.push(`/planos/${planId}/rotina/${day.id}`)}
            onMoveUp={isEditable && index > 0 ? () => handleMoveDay(day.id, -1) : undefined}
            onMoveDown={isEditable && index < days.length - 1 ? () => handleMoveDay(day.id, 1) : undefined}
            onDuplicate={isEditable ? () => handleDuplicateDay(day.id) : undefined}
            onDelete={isEditable ? () => handleDeleteDay(day.id) : undefined}
          />
        ))
      )}

      {isEditable && hasActiveVersion && (
        <Text style={styles.draftHint}>
          Suas alterações ficam em rascunho até você ativar a nova versão.
        </Text>
      )}
      {isEditable && (
        <PrimaryButton label="Ativar rotina" onPress={handleActivate} disabled={busy} />
      )}
      {isEditable && hasActiveVersion && (
        <PrimaryButton
          label="Descartar alterações"
          variant="secondary"
          onPress={handleDiscardDraft}
          disabled={busy}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.body, color: colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...typography.title, color: colors.textPrimary },
  goal: { ...typography.body, color: colors.textSecondary },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary },
  draftHint: { ...typography.caption, color: colors.textMuted },
  readOnlyBanner: {
    ...typography.caption,
    color: colors.textMuted,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.sm,
    borderRadius: 8,
  },
});
