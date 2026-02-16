import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '../src/auth/context';
import '../src/i18n'; // Initialize i18n as side-effect

function RootNavigator() {
  const { session, isLoading } = useSession();

  // Keep splash screen visible during auto-login check
  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
