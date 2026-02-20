import { View, Text, StyleSheet, TouchableOpacity, Alert, Pressable } from 'react-native';
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
            // Stack.Protected guard automatically navigates to sign-in
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('settings.title')}</Text>

      {/* Language Toggle */}
      <View style={styles.row}>
        <Text style={styles.label}>{t('settings.language')}</Text>
        <TouchableOpacity style={styles.languageToggle} onPress={toggleLanguage}>
          <View
            style={[
              styles.languageOption,
              currentLanguage === 'fr' && styles.languageOptionActive,
            ]}
          >
            <Text
              style={[
                styles.languageText,
                currentLanguage === 'fr' && styles.languageTextActive,
              ]}
            >
              {t('settings.french')}
            </Text>
          </View>
          <View
            style={[
              styles.languageOption,
              currentLanguage === 'en' && styles.languageOptionActive,
            ]}
          >
            <Text
              style={[
                styles.languageText,
                currentLanguage === 'en' && styles.languageTextActive,
              ]}
            >
              {t('settings.english')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Bookmarks row */}
      <Pressable
        style={({ pressed }) => [styles.bookmarksRow, pressed && styles.rowPressed]}
        onPress={() => router.push('/settings/bookmarks')}
      >
        <View style={styles.rowContent}>
          <Ionicons name="star" size={20} color="#f59e0b" style={styles.rowIcon} />
          <Text style={styles.label}>{t('bookmarks.settingsRow')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </Pressable>

      {/* Clear cache row */}
      <Pressable
        style={({ pressed }) => [styles.bookmarksRow, pressed && styles.rowPressed]}
        onPress={handleClearCache}
      >
        <View style={styles.rowContent}>
          <Ionicons name="trash-outline" size={20} color="#6b7280" style={styles.rowIcon} />
          <Text style={styles.label}>{t('settings.clearCache')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </Pressable>

      {/* Logout Button — in settings screen per user decision */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t('common.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
    color: '#333',
  },
  languageToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  languageOptionActive: {
    backgroundColor: '#2563eb',
  },
  languageText: {
    fontSize: 14,
    color: '#333',
  },
  languageTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  bookmarksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 20,
  },
  rowPressed: {
    backgroundColor: '#f3f4f6',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 12,
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 40,
    padding: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});
