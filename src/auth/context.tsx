import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react';
import { validateCredentials } from '../api/ffbad';
import { setCredentials } from '../api/client';
import {
  storeCredentials,
  getStoredCredentials,
  clearCredentials,
} from './storage';
import { AuthError, NetworkError, FFBaDError } from '../api/errors';
import { cacheClear } from '../cache/storage';
import type { UserSession } from '../types/ffbad';

// ============================================================
// Types
// ============================================================

interface SessionContextType {
  /** Current user session, or null if not authenticated */
  session: UserSession | null;
  /** True while checking stored credentials on app startup */
  isLoading: boolean;
  /** Sign in with FFBaD credentials. Throws on failure. */
  signIn: (
    licence: string,
    password: string,
    remember: boolean
  ) => Promise<void>;
  /** Sign out and clear stored credentials */
  signOut: () => Promise<void>;
}

// ============================================================
// Context
// ============================================================

const SessionContext = createContext<SessionContextType | null>(null);

/**
 * Hook to access session state. Must be used within SessionProvider.
 */
export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}

// ============================================================
// Provider
// ============================================================

const AUTO_LOGIN_TIMEOUT_MS = 5000;

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ----------------------------------------------------------
  // Auto-login on mount: check stored credentials
  // ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function tryAutoLogin() {
      try {
        const stored = await getStoredCredentials();
        if (!stored || cancelled) {
          setIsLoading(false);
          return;
        }

        // Inject credentials into API client immediately
        setCredentials(stored);

        // Try to validate credentials with a timeout
        const validationPromise = validateCredentials(
          stored.licence,
          stored.password
        );

        const timeoutPromise = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), AUTO_LOGIN_TIMEOUT_MS)
        );

        const result = await Promise.race([validationPromise, timeoutPromise]);

        if (cancelled) return;

        if (result === 'timeout') {
          // Timeout: proceed with stored credentials anyway
          // (offline tolerance — per Pitfall #5 from research)
          setSession({
            licence: stored.licence,
            nom: '',
            prenom: '',
          });
        } else {
          // Validation succeeded
          setSession(result);
        }
      } catch (error) {
        if (cancelled) return;

        if (error instanceof AuthError) {
          // Credentials no longer valid — clear and show login
          await clearCredentials();
          setCredentials(null);
          setSession(null);
        } else if (error instanceof NetworkError) {
          // Network error: proceed with stored credentials (offline tolerance)
          const stored = await getStoredCredentials();
          if (stored) {
            setSession({
              licence: stored.licence,
              nom: '',
              prenom: '',
            });
          } else {
            setSession(null);
          }
        } else {
          // Unknown error — show login
          setCredentials(null);
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    tryAutoLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  // ----------------------------------------------------------
  // Sign in
  // ----------------------------------------------------------
  const signIn = useCallback(
    async (licence: string, password: string, remember: boolean) => {
      // Validate credentials against FFBaD API
      const userInfo = await validateCredentials(licence, password);

      // Persist credentials in SecureStore
      await storeCredentials(licence, password, remember);

      // Keep credentials in API client
      setCredentials({ licence, password });

      // Set session
      setSession(userInfo);
    },
    []
  );

  // ----------------------------------------------------------
  // Sign out
  // ----------------------------------------------------------
  const signOut = useCallback(async () => {
    // Clear cached data first — clean slate for next login
    await cacheClear();

    // Clear stored credentials
    await clearCredentials();

    // Clear API client credentials
    setCredentials(null);

    // Clear session — triggers route guard → login screen
    setSession(null);
  }, []);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <SessionContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
