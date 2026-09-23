import { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Intercepta qualquer remoção da tela (botão de voltar, gesto de swipe do
 * iOS, navegação programática) enquanto `isDirty` for true, e pergunta antes
 * de descartar. Usa `navigation.addListener('beforeRemove', ...)` — o
 * mecanismo público do React Navigation por trás do `usePreventRemove` do
 * Expo Router (que só é exportado publicamente a partir do SDK 58; estamos
 * no 57, então implementamos o mesmo padrão diretamente).
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert('Descartar alterações?', 'Você tem alterações não salvas.', [
        { text: 'Continuar editando', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, isDirty]);
}
