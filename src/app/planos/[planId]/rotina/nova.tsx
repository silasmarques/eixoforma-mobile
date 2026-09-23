import { Stack, useLocalSearchParams } from 'expo-router';

import { RotinaFormScreen } from '@/screens/RotinaFormScreen';

export default function NovaRotinaRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Adicionar treino' }} />
      <RotinaFormScreen planId={planId} />
    </>
  );
}
