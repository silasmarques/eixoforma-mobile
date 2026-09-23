import { Stack, useLocalSearchParams } from 'expo-router';

import { RotinaFormScreen } from '@/screens/RotinaFormScreen';

export default function EditarRotinaRoute() {
  const { planId, dayId } = useLocalSearchParams<{ planId: string; dayId: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Editar rotina' }} />
      <RotinaFormScreen planId={planId} dayId={dayId} />
    </>
  );
}
