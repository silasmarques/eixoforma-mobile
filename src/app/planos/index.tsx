import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
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

/** Gerenciamento completo — criar, abrir a Montagem. Diferente do PlanSelectorSheet (seleção rápida). */
export default function PlanosScreen() {
  const client = useDatabase();
  const router = useRouter();
  const [personalPlans, setPersonalPlans] = useState<PlanRow[]>([]);
  const [prescribedPlans, setPrescribedPlans] = useState<PlanRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const plans = await planService.listPlans(client);
        const rows: PlanRow[] = [];
        for (const plan of plans) {
          const version = await planService.resolveViewableVersion(client, plan.id);
          rows.push({ plan, status: version?.status ?? null });
        }
        if (cancelled) return;
        setPersonalPlans(rows.filter((r) => r.plan.origin === 'personal'));
        setPrescribedPlans(rows.filter((r) => r.plan.origin === 'prescribed'));
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [client])
  );

  if (loaded && personalPlans.length === 0 && prescribedPlans.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Nenhum plano ainda"
          description="Crie seu primeiro plano de treino."
          actionLabel="+ Novo plano"
          onAction={() => router.push('/planos/novo')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PrimaryButton label="+ Novo plano" onPress={() => router.push('/planos/novo')} />

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
              onPress={() => router.push(`/planos/${plan.id}`)}
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
              onPress={() => router.push(`/planos/${plan.id}`)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
