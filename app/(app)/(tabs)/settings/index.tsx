import { View, Text, Alert, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSession } from '../../../../src/auth/context';
import { cacheClear } from '../../../../src/cache/storage';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { signOut } = useSession();
  const currentLanguage = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLanguage === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const handleClearCache = () => {
    Alert.alert(
      t('settings.clearCacheTitle'),
      t('settings.clearCacheConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearCacheOk'),
          style: 'destructive',
          onPress: async () => {
            await cacheClear();
            Toast.show({ type: 'success', text1: t('settings.cacheCleared'), visibilityTime: 2000 });
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logoutTitle'),
      t('settings.logoutConfirm'),
      [
        { text: t('settings.logoutCancel'), style: 'cancel' },
        {
          text: t('settings.logoutOk'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-white px-5 pt-6">
      {/* Preferences Section */}
      <Text className="text-caption text-muted uppercase tracking-wider mb-3 mt-2">
        {t('settings.language')}
      </Text>

      {/* Language Toggle */}
      <View className="flex-row items-center justify-between py-3 border-b border-gray-100 mb-2">
        <Text className="text-body text-gray-800">{t('settings.language')}</Text>
        <View className="flex-row bg-gray-100 rounded-full p-1">
          <Pressable
            className={`px-4 py-2 rounded-full items-center ${currentLanguage === 'fr' ? 'bg-primary' : ''}`}
            onPress={() => i18n.changeLanguage('fr')}
          >
            <Text className={`text-body font-medium ${currentLanguage === 'fr' ? 'text-white' : 'text-gray-600'}`}>
              {t('settings.french')}
            </Text>
          </Pressable>
          <Pressable
            className={`px-4 py-2 rounded-full items-center ${currentLanguage === 'en' ? 'bg-primary' : ''}`}
            onPress={() => i18n.changeLanguage('en')}
          >
            <Text className={`text-body font-medium ${currentLanguage === 'en' ? 'text-white' : 'text-gray-600'}`}>
              {t('settings.english')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Data Section */}
      <Text className="text-caption text-muted uppercase tracking-wider mb-3 mt-6">
        Data
      </Text>

      {/* Bookmarks row */}
      <Pressable
        className="flex-row items-center justify-between py-4 border-b border-gray-100 active:bg-gray-50"
        onPress={() => router.push('/settings/bookmarks')}
      >
        <View className="flex-row items-center">
          <Ionicons name="star" size={20} color="#f59e0b" style={{ marginRight: 12 }} />
          <Text className="text-body text-gray-800">{t('bookmarks.settingsRow')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
      </Pressable>

      {/* Clear cache row */}
      <Pressable
        className="flex-row items-center justify-between py-4 border-b border-gray-100 active:bg-gray-50"
        onPress={handleClearCache}
      >
        <View className="flex-row items-center">
          <Ionicons name="trash-outline" size={20} color="#6b7280" style={{ marginRight: 12 }} />
          <Text className="text-body text-gray-800">{t('settings.clearCache')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
      </Pressable>

      {/* Logout */}
      <View className="mt-auto mb-10">
        <Pressable
          className="py-4 items-center active:opacity-60"
          onPress={handleLogout}
        >
          <Text className="text-body font-semibold text-loss">{t('common.logout')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
