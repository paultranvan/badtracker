import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="player/[licence]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ranking-chart"
        options={{
          headerShown: true,
          headerTitle: t('ranking.title'),
          headerBackTitle: '',
        }}
      />
      <Stack.Screen
        name="club/[clubId]"
        options={{
          headerShown: true,
          headerTitle: t('club.title'),
          headerBackTitle: '',
        }}
      />
    </Stack>
  );
}
