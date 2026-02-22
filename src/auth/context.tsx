import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react';
import { validateCredentials, setSessionInfo } from '../api/ffbad';
import {
  storeCredentials,
  getStoredCredentials,
  clearCredentials,
} from './storage';
import { AuthError, NetworkError, FFBaDError } from '../api/errors';
import { cacheClear } from '../cache/storage';
import { resetBridge, waitForBridge } from '../api/webview-bridge';
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

const AUTO_LOGIN_TIMEOUT_MS = 10000;

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

        // If we have stored personId/accessToken, set session info immediately
        if (stored.personId && stored.accessToken) {
          setSessionInfo({
            personId: stored.personId,
            accessToken: stored.accessToken,
            licence: stored.licence,
          });
        }

        // Wait for WebView bridge to be ready before attempting login
        const bridgeWait = waitForBridge();
        const timeoutPromise = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), AUTO_LOGIN_TIMEOUT_MS)
        );

        const bridgeResult = await Promise.race([bridgeWait, timeoutPromise]);

        if (cancelled) return;

        if (bridgeResult === 'timeout') {
          // Bridge not ready in time — use stored data if available
          if (stored.personId && stored.accessToken) {
            setSession({
              licence: stored.licence,
              nom: stored.nom ?? '',
              prenom: stored.prenom ?? '',
              personId: stored.personId,
              accessToken: stored.accessToken,
            });
          } else {
            setSession(null);
          }
          setIsLoading(false);
          return;
        }

        // Bridge is ready — try to validate credentials
        const validationPromise = validateCredentials(
          stored.licence,
          stored.password
        );

        const validationTimeout = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), AUTO_LOGIN_TIMEOUT_MS)
        );

        const result = await Promise.race([validationPromise, validationTimeout]);

        if (cancelled) return;

        if (result === 'timeout') {
          // Timeout: use stored session data if available
          if (stored.personId && stored.accessToken) {
            setSession({
              licence: stored.licence,
              nom: stored.nom ?? '',
              prenom: stored.prenom ?? '',
              personId: stored.personId,
              accessToken: stored.accessToken,
            });
          } else {
            setSession({
              licence: stored.licence,
              nom: stored.nom ?? '',
              prenom: stored.prenom ?? '',
              personId: '',
              accessToken: '',
            });
          }
        } else {
          // Validation succeeded — update session info
          setSessionInfo({
            personId: result.personId,
            accessToken: result.accessToken,
            licence: result.licence,
          });

          setSession(result);

          // Update stored credentials with fresh personId/accessToken/name
          await storeCredentials(
            stored.licence,
            stored.password,
            true,
            result.personId,
            result.accessToken,
            result.nom,
            result.prenom
          );
        }
      } catch (error) {
        if (cancelled) return;

        if (error instanceof AuthError) {
          // Credentials no longer valid — clear and show login
          await clearCredentials();
          setSessionInfo(null);
          setSession(null);
        } else if (error instanceof NetworkError) {
          // Network error: use stored session data if available
          const stored = await getStoredCredentials();
          if (stored?.personId && stored?.accessToken) {
            setSessionInfo({
              personId: stored.personId,
              accessToken: stored.accessToken,
              licence: stored.licence,
            });
            setSession({
              licence: stored.licence,
              nom: stored.nom ?? '',
              prenom: stored.prenom ?? '',
              personId: stored.personId,
              accessToken: stored.accessToken,
            });
          } else {
            setSession(null);
          }
        } else {
          // Unknown error — show login
          setSessionInfo(null);
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
      // Wait for bridge to be ready
      await waitForBridge();

      // Validate credentials via myffbad.fr
      const userInfo = await validateCredentials(licence, password);

      // Set session info for API calls
      setSessionInfo({
        personId: userInfo.personId,
        accessToken: userInfo.accessToken,
        licence: userInfo.licence,
      });

      // Persist credentials in SecureStore
      await storeCredentials(
        licence,
        password,
        remember,
        userInfo.personId,
        userInfo.accessToken,
        userInfo.nom,
        userInfo.prenom
      );

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

    // Clear API session info
    setSessionInfo(null);

    // Reset WebView bridge (clears cookies/session)
    resetBridge();

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
