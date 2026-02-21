import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
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

  const isLoginDisabled = isLoading || !licence.trim() || !password.trim();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-10">
          <Text className="text-[32px] font-bold text-gray-900 mb-2">
            {t('auth.title')}
          </Text>
          <Text className="text-body text-muted">{t('auth.subtitle')}</Text>
        </View>

        {/* Form */}
        <View className="w-full">
          {/* Licence Number */}
          <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-4">
            {t('auth.licence')}
          </Text>
          <TextInput
            className={`bg-gray-50 border rounded-xl px-4 py-3.5 text-base text-gray-900 ${
              errorKey ? 'border-loss' : 'border-gray-300'
            }`}
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
          <Text className="text-sm font-semibold text-gray-700 mb-1.5 mt-4">
            {t('auth.password')}
          </Text>
          <TextInput
            className={`bg-gray-50 border rounded-xl px-4 py-3.5 text-base text-gray-900 ${
              errorKey ? 'border-loss' : 'border-gray-300'
            }`}
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
          <View className="flex-row items-center justify-between mt-5 py-1">
            <Text className="text-body text-gray-700">{t('auth.rememberMe')}</Text>
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
            <View className="mt-4 bg-loss-bg border border-loss/30 rounded-lg p-3">
              <Text className="text-sm text-loss text-center">{t(errorKey)}</Text>
            </View>
          )}

          {/* Login Button */}
          <Pressable
            className={`mt-6 py-4 rounded-xl items-center ${
              isLoginDisabled
                ? 'bg-primary-light'
                : 'bg-primary active:bg-primary-dark'
            }`}
            onPress={handleLogin}
            disabled={isLoginDisabled}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[17px] font-semibold text-white">
                {t('auth.login')}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
