import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useDatabase } from '@/database/DatabaseProvider';
import { DuplicateActiveSessionError } from '@/repositories/workoutSessionRepository';
import { workoutSessionService } from '@/services/workoutSessionService';
import { decideStartAction } from '@/services/workoutStartDecision';

/**
 * Orquestra "Iniciar treino" em qualquer tela: verifica sessão ativa,
 * oferece a escolha continuar/cancelar quando já existe uma, e só cria uma
 * sessão nova quando não há conflito — nunca duas em silêncio.
 */
export function useStartWorkout() {
  const client = useDatabase();
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const startWorkout = useCallback(
    async (day: { id: string; planId: string; name: string }) => {
      setStarting(true);
      try {
        const activeSession = await workoutSessionService.findActiveSession(client);
        const decision = decideStartAction(activeSession);

        if (decision.kind === 'blocked') {
          Alert.alert('Treino em andamento', `Você já está treinando: ${decision.activeSession.dayName}.`, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Continuar treino',
              onPress: () => router.push(`/sessao/${decision.activeSession.id}`),
            },
          ]);
          return;
        }

        const session = await workoutSessionService.startSession(client, {
          planId: day.planId,
          dayId: day.id,
        });
        router.push(`/sessao/${session.id}`);
      } catch (error) {
        if (error instanceof DuplicateActiveSessionError) {
          Alert.alert('Treino em andamento', error.message);
        } else {
          Alert.alert('Erro', 'Não foi possível iniciar o treino.');
        }
      } finally {
        setStarting(false);
      }
    },
    [client, router]
  );

  return { startWorkout, starting };
}
