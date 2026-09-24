import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { PlanCard } from '@/components/PlanCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useDatabase } from '@/database/DatabaseProvider';
import { planService } from '@/services/planService';
import { colors, spacing, typography } from '@/theme/tokens';
import type { WorkoutPlan, WorkoutPlanVersionStatus } from '@/domain/workoutPlan';

interface PlanRow {
  plan: WorkoutPlan;
  status: WorkoutPlanVersionStatus | null;
}

/** Seleção rápida do plano dentro de Meus Treinos — não é a tela de gerenciamento. */
export default function PlanSelectorSheet() {
  const client = useDatabase();
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [personalPlans, setPersonalPlans] = useState<PlanRow[]>([]);
  const [prescribedPlans, setPrescribedPlans] = useState<PlanRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [plans, selected] = await Promise.all([
          planService.listPlans(client),
          planService.getSelectedPlan(client),
        ]);
        if (cancelled) return;
        setSelectedPlanId(selected?.id ?? null);

        const rows: PlanRow[] = [];
        for (const plan of plans) {
          const version = await planService.resolveViewableVersion(client, plan.id);
          rows.push({ plan, status: version?.status ?? null });
        }
        setPersonalPlans(rows.filter((r) => r.plan.origin === 'personal'));
        setPrescribedPlans(rows.filter((r) => r.plan.origin === 'prescribed'));
      })();
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  async function selectAndClose(planId: string) {
    await planService.selectPlan(client, planId);
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ presentation: 'modal', title: 'Selecionar plano' }} />

      {personalPlans.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Meus planos</Text>
          {personalPlans.map(({ plan, status }) => (
            <PlanCard
              key={plan.id}
              name={plan.name}
              goal={plan.goal}
              isPrescribed={false}
              status={status}
              isSelected={plan.id === selectedPlanId}
              onPress={() => selectAndClose(plan.id)}
              activeStatusLabel="Ativo"
            />
          ))}
        </>
      )}

      {prescribedPlans.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Prescritos pelo treinador</Text>
          {prescribedPlans.map(({ plan, status }) => (
            <PlanCard
              key={plan.id}
              name={plan.name}
              goal={plan.goal}
              isPrescribed
              status={status}
              isSelected={plan.id === selectedPlanId}
              onPress={() => selectAndClose(plan.id)}
              activeStatusLabel="Ativo"
            />
          ))}
        </>
      )}

      <PrimaryButton
        label="Gerenciar planos"
        variant="secondary"
        onPress={() => router.push('/planos')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
