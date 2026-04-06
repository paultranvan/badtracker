import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SessionProvider, useSession } from '../src/auth/context';
import { BookmarksProvider } from '../src/bookmarks/context';
import { ConnectivityProvider, OfflineBar } from '../src/connectivity/context';
import { WebViewBridgeProvider } from '../src/api/webview-bridge';
import { RankingLevelsProvider } from '../src/ranking-levels/context';
import Toast from 'react-native-toast-message';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import '../src/i18n';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    SplashScreen.hideAsync();

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
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-display text-primary mb-4">BadTracker</Text>
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
      <WebViewBridgeProvider>
        <SessionProvider>
          <RankingLevelsProvider>
            <BookmarksProvider>
              <AuthGate />
              <Toast />
            </BookmarksProvider>
          </RankingLevelsProvider>
        </SessionProvider>
      </WebViewBridgeProvider>
    </ConnectivityProvider>
  );
}
