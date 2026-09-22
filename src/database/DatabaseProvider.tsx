import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';
import { getDatabase } from './db';
import type { SQLiteClient } from './sqliteClient';

const DatabaseContext = createContext<SQLiteClient | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SQLiteClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDatabase().then((db) => {
      if (!cancelled) setClient(db);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!client) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Carregando dados locais">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <DatabaseContext.Provider value={client}>{children}</DatabaseContext.Provider>;
}

/** Só retorna null enquanto o Provider ainda está inicializando (nunca depois). */
export function useDatabase(): SQLiteClient {
  const client = useContext(DatabaseContext);
  if (!client) {
    throw new Error('useDatabase() usado fora de DatabaseProvider, ou antes da inicialização.');
  }
  return client;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
