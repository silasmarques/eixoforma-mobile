import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/database/DatabaseProvider';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'EixoForma' }} />
          <Stack.Screen name="treinos/index" options={{ title: 'Meus Treinos' }} />
          <Stack.Screen name="treinos/[dayId]" options={{ title: 'Detalhe do treino' }} />
          <Stack.Screen name="sessao/[sessionId]" options={{ title: 'Treino em execução' }} />
          <Stack.Screen name="historico/index" options={{ title: 'Histórico' }} />
        </Stack>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
