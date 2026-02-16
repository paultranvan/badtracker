import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLanguage === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
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

      {/* Logout button placeholder — functional logout added in Plan 03 */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          Alert.alert(
            t('settings.logoutTitle'),
            t('settings.logoutConfirm'),
            [
              { text: t('settings.logoutCancel'), style: 'cancel' },
              {
                text: t('settings.logoutOk'),
                style: 'destructive',
                onPress: () => {
                  // signOut() wired in Plan 03
                },
              },
            ]
          );
        }}
      >
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
