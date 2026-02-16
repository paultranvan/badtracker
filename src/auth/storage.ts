import * as SecureStore from 'expo-secure-store';

/**
 * Secure credential storage using expo-secure-store.
 *
 * IMPORTANT: Credentials are NEVER stored in AsyncStorage.
 * SecureStore uses iOS Keychain / Android Keystore (hardware-backed encryption).
 *
 * AFTER_FIRST_UNLOCK accessibility allows background re-auth
 * before device is fully unlocked (needed for silent auto-login).
 */

const CREDENTIALS_KEY = 'ffbad_credentials';
const REMEMBER_KEY = 'ffbad_remember';

interface StoredCredentials {
  licence: string;
  password: string;
}

/**
 * Store credentials securely on device.
 *
 * @param licence - FFBaD licence number
 * @param password - Account password
 * @param remember - Whether to persist across app restarts
 */
export async function storeCredentials(
  licence: string,
  password: string,
  remember: boolean
): Promise<void> {
  if (remember) {
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify({ licence, password }),
      {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      }
    );
    await SecureStore.setItemAsync(REMEMBER_KEY, 'true', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } else {
    // Don't persist credentials, but mark remember as false
    await SecureStore.setItemAsync(REMEMBER_KEY, 'false');
    // Clean up any previously stored credentials
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  }
}

/**
 * Retrieve stored credentials from SecureStore.
 * Returns null if remember is off or no credentials stored.
 */
export async function getStoredCredentials(): Promise<StoredCredentials | null> {
  try {
    const remember = await SecureStore.getItemAsync(REMEMBER_KEY);
    if (remember !== 'true') {
      return null;
    }

    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredCredentials;
  } catch {
    // Any error reading SecureStore — treat as no stored credentials
    return null;
  }
}

/**
 * Clear all stored credentials from SecureStore.
 *
 * NOTE: Per user decision, this does NOT clear cached data
 * (matches, rankings) — only auth credentials.
 */
export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  await SecureStore.deleteItemAsync(REMEMBER_KEY);
}

/**
 * Check if "remember me" is currently enabled.
 */
export async function isRememberEnabled(): Promise<boolean> {
  try {
    const remember = await SecureStore.getItemAsync(REMEMBER_KEY);
    return remember === 'true';
  } catch {
    return false;
  }
}
