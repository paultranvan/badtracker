import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';

// ============================================================
// Types
// ============================================================

interface ConnectivityContextType {
  /** True when device has network connectivity. Defaults to true (treats null as connected). */
  isConnected: boolean;
}

// ============================================================
// Context
// ============================================================

const ConnectivityContext = createContext<ConnectivityContextType>({
  isConnected: true,
});

/**
 * Hook to access connectivity state. Must be used within ConnectivityProvider.
 */
export function useConnectivity(): ConnectivityContextType {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return ctx;
}

// ============================================================
// Provider
// ============================================================

interface ConnectivityProviderProps extends PropsWithChildren {
  /** Optional callback fired when connectivity transitions from offline to online */
  onReconnect?: () => void;
}

export function ConnectivityProvider({
  children,
  onReconnect,
}: ConnectivityProviderProps) {
  const netInfo = useNetInfo();

  // Treat initial null state as connected (Pitfall #1 from research:
  // netInfo.isConnected is null before first check completes).
  // Only consider offline when explicitly false.
  const isConnected =
    netInfo.isConnected !== false && netInfo.isInternetReachable !== false;

  // Track previous connectivity to detect reconnection
  const prevConnected = useRef(isConnected);

  useEffect(() => {
    if (!prevConnected.current && isConnected) {
      // Transitioned from offline to online
      onReconnect?.();
    }
    prevConnected.current = isConnected;
  }, [isConnected, onReconnect]);

  return (
    <ConnectivityContext.Provider value={{ isConnected }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

// ============================================================
// OfflineBar Component
// ============================================================

/**
 * Subtle orange status bar shown when device is offline.
 * Auto-dismisses immediately when back online (returns null).
 */
export function OfflineBar() {
  const { isConnected } = useConnectivity();
  const { t } = useTranslation();

  if (isConnected) return null;

  return (
    <View style={styles.offlineBar}>
      <Text style={styles.offlineText}>{t('offline.noConnection')}</Text>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  offlineBar: {
    backgroundColor: '#f97316',
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
