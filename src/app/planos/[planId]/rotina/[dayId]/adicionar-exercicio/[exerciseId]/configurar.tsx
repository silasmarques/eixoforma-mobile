import { Stack, useLocalSearchParams } from 'expo-router';

import { ExerciseConfigScreen } from '@/screens/ExerciseConfigScreen';
import { parseQueueParam } from '@/utils/exerciseQueue';

export default function ConfigurarExercicioRoute() {
  const { planId, dayId, exerciseId, queue, batch } = useLocalSearchParams<{
    planId: string;
    dayId: string;
    exerciseId: string;
    queue?: string;
    batch?: string;
  }>();
  const queueIds = parseQueueParam(queue);
  const batchSize = batch ? Number(batch) : undefined;
  return (
    <>
      <Stack.Screen options={{ title: 'Configurar exercício' }} />
      <ExerciseConfigScreen
        key={exerciseId}
        planId={planId}
        dayId={dayId}
        exerciseId={exerciseId}
        queue={queueIds}
        batchSize={batchSize}
      />
    </>
  );
}
