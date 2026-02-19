import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('common.home'),
          tabBarLabel: t('common.home'),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('matchHistory.title'),
          tabBarLabel: t('matchHistory.tab'),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('search.tab'),
          tabBarLabel: t('search.tab'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common.settings'),
          tabBarLabel: t('common.settings'),
        }}
      />
    </Tabs>
  );
}
