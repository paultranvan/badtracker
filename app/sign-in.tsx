import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSession } from '../src/auth/context';
import { FFBaDError } from '../src/api/errors';

export default function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useSession();

  const [licence, setLicence] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true); // Defaults ON per user decision
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!licence.trim() || !password.trim()) return;

    setIsLoading(true);
    setErrorKey(null);

    try {
      // No client-side licence validation — let FFBaD API handle it (per user decision)
      await signIn(licence.trim(), password, rememberMe);
      // On success, Stack.Protected guard automatically navigates to (app)
    } catch (error) {
      if (error instanceof FFBaDError) {
        setErrorKey(error.userMessageKey);
      } else {
        setErrorKey('auth.serverError');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Clear error when user modifies input
  const clearError = () => {
    if (errorKey) setErrorKey(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Licence Number */}
          <Text style={styles.label}>{t('auth.licence')}</Text>
          <TextInput
            style={[styles.input, errorKey && styles.inputError]}
            value={licence}
            onChangeText={(text) => {
              setLicence(text);
              clearError();
            }}
            placeholder={t('auth.licence')}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            returnKeyType="next"
          />

          {/* Password */}
          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={[styles.input, errorKey && styles.inputError]}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              clearError();
            }}
            placeholder={t('auth.password')}
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {/* Remember Me Toggle */}
          <View style={styles.rememberRow}>
            <Text style={styles.rememberLabel}>{t('auth.rememberMe')}</Text>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              disabled={isLoading}
              trackColor={{ false: '#ddd', true: '#93c5fd' }}
              thumbColor={rememberMe ? '#2563eb' : '#f4f3f4'}
            />
          </View>

          {/* Error Message (per-action, inline — per user decision) */}
          {errorKey && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{t(errorKey)}</Text>
            </View>
          )}

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              isLoading && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading || !licence.trim() || !password.trim()}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>{t('auth.login')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 4,
  },
  rememberLabel: {
    fontSize: 15,
    color: '#374151',
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
