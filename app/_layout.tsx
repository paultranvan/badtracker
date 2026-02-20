import { Slot, useRouter, useSegments } from 'expo-router';
import { SessionProvider, useSession } from '../src/auth/context';
import { BookmarksProvider } from '../src/bookmarks/context';
import { ConnectivityProvider, OfflineBar } from '../src/connectivity/context';
import Toast from 'react-native-toast-message';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import '../src/i18n';

function AuthGate() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inApp = segments[0] === '(app)';

    if (!session && inApp) {
      // Not authenticated but trying to access app — redirect to sign-in
      router.replace('/sign-in');
    } else if (session && !inApp) {
      // Authenticated but on sign-in — redirect to app
      router.replace('/(app)/(tabs)');
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <>
      {session && <OfflineBar />}
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <ConnectivityProvider>
      <SessionProvider>
        <BookmarksProvider>
          <AuthGate />
          <Toast />
        </BookmarksProvider>
      </SessionProvider>
    </ConnectivityProvider>
  );
}
