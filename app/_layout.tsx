import { Stack } from 'expo-router';
import '../src/i18n'; // Initialize i18n as side-effect

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
