import { Stack } from 'expo-router';

export default function AppLayout() {
  // Auth guard added in Plan 03 via SessionProvider + Stack.Protected
  return <Stack screenOptions={{ headerShown: false }} />;
}
