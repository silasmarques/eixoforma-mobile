import { Stack, useLocalSearchParams } from 'expo-router';

import { ExerciseConfigScreen } from '@/screens/ExerciseConfigScreen';

export default function ConfigurarExercicioRoute() {
  const { planId, dayId, exerciseId } = useLocalSearchParams<{
    planId: string;
    dayId: string;
    exerciseId: string;
  }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Configurar exercício' }} />
      <ExerciseConfigScreen planId={planId} dayId={dayId} exerciseId={exerciseId} />
    </>
  );
}
