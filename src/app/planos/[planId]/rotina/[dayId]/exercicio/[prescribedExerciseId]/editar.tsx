import { Stack, useLocalSearchParams } from 'expo-router';

import { ExerciseConfigScreen } from '@/screens/ExerciseConfigScreen';

export default function EditarExercicioRoute() {
  const { planId, dayId, prescribedExerciseId } = useLocalSearchParams<{
    planId: string;
    dayId: string;
    prescribedExerciseId: string;
  }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Editar exercício' }} />
      <ExerciseConfigScreen planId={planId} dayId={dayId} prescribedExerciseId={prescribedExerciseId} />
    </>
  );
}
