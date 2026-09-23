import { Stack, useLocalSearchParams } from 'expo-router';

import { RotinaFormScreen } from '@/screens/RotinaFormScreen';

export default function NovaRotinaRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Nova rotina' }} />
      <RotinaFormScreen planId={planId} />
    </>
  );
}
