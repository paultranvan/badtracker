# Phase 1: Foundation & Security - Research

**Researched:** 2026-02-16
**Domain:** React Native (Expo) API client, authentication, secure storage, FFBaD API integration
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 builds a secure, production-ready API client for the FFBaD (Federation Francaise de Badminton) web services, with authentication via license number and password. The FFBaD API is a SOAP/REST hybrid hosted at `api.ffbad.org` with 70+ endpoints covering player data, rankings, matches, and tournaments. Authentication uses Login/Password credentials passed as JSON parameters (not OAuth/JWT) — the API returns data directly without token-based sessions.

The standard stack is Expo SDK with expo-secure-store for credential persistence (backed by iOS Keychain / Android Keystore), expo-router for navigation with protected routes, Zod for runtime API response validation, and axios with interceptors for HTTP communication with retry/backoff logic. Internationalization uses i18next + react-i18next with expo-localization for FR/EN support.

**Primary recommendation:** Build a thin API client layer around axios that wraps every FFBaD call with: HTTPS enforcement, Zod response validation, exponential backoff retry, and credential injection from SecureStore. Use Expo Router's `Stack.Protected` pattern for auth-gated navigation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Login screen has 3 fields: license number, password, "remember me" toggle
- No client-side license number format validation — let the FFBaD API handle it
- French is the default language, with English as an option (FR/EN toggle)
- "Remember me" defaults to ON (most users want persistent login)
- With "remember me" ON: silent auto-login on app restart — go straight to dashboard, re-authenticate in background, show login only if it fails
- With "remember me" OFF: session persists until app is force-closed, but credentials are not stored across restarts
- Token expiry during use: silently refresh in background using stored credentials — only redirect to login if refresh fails
- No maximum session duration — stay logged in indefinitely as long as credentials work
- Per-action errors (not persistent banners) — show error only when a specific action fails
- Distinguish network errors from FFBaD server errors: "Pas de connexion internet" vs "Le serveur FFBaD est indisponible"
- Auto-retry silently 2-3 times on failure, then show manual "Reessayer" button if still failing
- Rate limiting is hidden from the user — silent exponential backoff, user just sees slightly slower loading
- Logout button lives in settings/profile screen (not in navigation drawer)
- After logout: redirect to login screen
- On logout: clear credentials from secure storage but keep cached data (matches, rankings) for faster reload if same user re-logs in

### Claude's Discretion
- Wrong credentials error feedback style (inline vs toast)
- Logout confirmation dialog (yes/no)
- Loading states and transitions during login
- Exact retry timing and backoff strategy
- Splash/loading screen design during auto-login

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in with FFBaD license number and password | FFBaD REST API accepts Login/Password as JSON params; `ws_getaccountpoona` takes Licence + Pwd; API client wrapper handles credential passing |
| AUTH-02 | User session persists across app restarts without re-entering credentials | expo-secure-store persists credentials in iOS Keychain / Android Keystore; silent auto-login on restart using stored credentials |
| AUTH-03 | User credentials are stored securely using device keychain (SecureStore) | expo-secure-store uses platform-native keychain services with hardware-backed encryption; AFTER_FIRST_UNLOCK accessibility for background re-auth |
| AUTH-04 | User can log out from any screen in the app | Clear SecureStore credentials on logout; Expo Router redirects to sign-in via Stack.Protected guard change |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | ~52 (latest SDK) | App framework | Official React Native framework with managed workflow |
| expo-router | ~4.x | File-based routing | Official Expo navigation with Stack.Protected for auth guards |
| expo-secure-store | ~14.x | Secure credential storage | Platform-native keychain (iOS) / keystore (Android), hardware-backed encryption |
| axios | ^1.7 | HTTP client | Interceptor support for auth injection, retry logic, error transformation |
| zod | ^3.24 | Runtime schema validation | TypeScript-first, safeParse for non-throwing validation, excellent error messages |
| i18next | ^24.x | Internationalization | Industry standard i18n with React hooks, lazy loading, interpolation |
| react-i18next | ^15.x | React bindings for i18next | useTranslation hook, Trans component, suspense support |
| expo-localization | ~16.x | Device locale detection | Detects device language for i18n default |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-native-async-storage/async-storage | ^2.x | Non-sensitive data persistence | Language preference, non-secret settings (NOT credentials) |
| expo-splash-screen | ~0.29 | Splash screen control | Keep visible during auto-login check on cold start |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| axios | fetch (built-in) | fetch lacks interceptors — would need manual wrapper for auth injection and retry; axios is more ergonomic |
| zod | io-ts, yup | zod has best TypeScript inference, smallest API surface, safeParse pattern fits API validation perfectly |
| i18next | i18n-js | i18n-js is simpler but i18next has better ecosystem, lazy loading, and React integration |

**Installation:**
```bash
npx create-expo-app@latest badtracker --template blank-typescript
cd badtracker
npx expo install expo-router expo-secure-store expo-localization expo-splash-screen @react-native-async-storage/async-storage
npm install axios zod i18next react-i18next
```

## Architecture Patterns

### Recommended Project Structure
```
app/
  _layout.tsx           # Root layout with SessionProvider + i18n init
  sign-in.tsx           # Login screen (unprotected)
  (app)/
    _layout.tsx         # Protected layout (requires auth)
    (tabs)/
      _layout.tsx       # Tab navigator
      index.tsx         # Dashboard (future phases)
      settings.tsx      # Settings with logout button
src/
  api/
    client.ts           # Axios instance with interceptors
    ffbad.ts            # FFBaD API function wrappers
    schemas.ts          # Zod schemas for API responses
    errors.ts           # Error types and classification
  auth/
    context.tsx         # SessionProvider + useSession hook
    storage.ts          # SecureStore helpers (get/set/clear credentials)
  i18n/
    index.ts            # i18next configuration
    locales/
      fr.json           # French translations (default)
      en.json           # English translations
  types/
    ffbad.ts            # TypeScript types derived from Zod schemas
```

### Pattern 1: Session Context with SecureStore
**What:** React Context providing session state backed by SecureStore
**When to use:** All auth state management across the app
**Example:**
```typescript
// Source: Expo Router official docs — authentication pattern
import { createContext, useContext, useEffect, useCallback, useReducer } from 'react';
import * as SecureStore from 'expo-secure-store';

interface SessionContextType {
  session: { licence: string; password: string } | null;
  isLoading: boolean;
  signIn: (licence: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
```

### Pattern 2: Expo Router Protected Routes (Stack.Protected)
**What:** Conditional route rendering based on auth state
**When to use:** Root layout to gate app access
**Example:**
```typescript
// Source: https://docs.expo.dev/router/advanced/authentication
import { Stack } from 'expo-router';
import { useSession } from '@/auth/context';

export default function RootLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return <SplashScreen />;

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
```

### Pattern 3: Axios Interceptors for Auth + Retry
**What:** Request interceptor injects credentials; response interceptor handles errors and retries
**When to use:** All FFBaD API calls
**Example:**
```typescript
// Source: axios docs + community patterns
import axios, { AxiosError } from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.ffbad.org/rest/',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inject credentials
apiClient.interceptors.request.use(async (config) => {
  const credentials = await getStoredCredentials();
  if (credentials) {
    config.params = {
      ...config.params,
      AuthJson: JSON.stringify({
        Login: credentials.licence,
        Password: credentials.password,
      }),
    };
  }
  return config;
});

// Response interceptor: classify errors, trigger retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Classify: network vs server vs auth
    if (!error.response) return Promise.reject(new NetworkError());
    if (error.response.status >= 500) return Promise.reject(new ServerError());
    // Auth failures handled by caller
    return Promise.reject(error);
  }
);
```

### Pattern 4: Zod Response Validation
**What:** Every API response parsed through Zod schema before use
**When to use:** All FFBaD API response handling
**Example:**
```typescript
import { z } from 'zod';

const LicenceInfoSchema = z.object({
  Retour: z.array(z.object({
    Licence: z.string(),
    Nom: z.string(),
    Prenom: z.string(),
    Club: z.string().optional(),
    IS_ACTIF: z.boolean().optional(),
  })),
});

type LicenceInfo = z.infer<typeof LicenceInfoSchema>;

async function getLicenceInfo(licence: string): Promise<LicenceInfo> {
  const response = await apiClient.get('', {
    params: {
      QueryJson: JSON.stringify({
        Fonction: 'ws_getlicenceinfobylicence',
        Param: [licence, false],
      }),
    },
  });
  const result = LicenceInfoSchema.safeParse(response.data);
  if (!result.success) {
    throw new SchemaValidationError(result.error);
  }
  return result.data;
}
```

### Anti-Patterns to Avoid
- **Storing credentials in AsyncStorage:** AsyncStorage is unencrypted on Android. MUST use expo-secure-store.
- **Building custom token refresh mechanism:** FFBaD API is credential-based (not JWT/OAuth). Re-authenticate using stored credentials, don't build token refresh flows that don't apply.
- **Client-side license validation:** User decided to let FFBaD API handle validation. No regex checks on license number format.
- **Global error banners:** User decided per-action errors only. Don't persist error state in global context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secure storage | Custom encryption + AsyncStorage | expo-secure-store | Platform keychain is hardware-backed; custom crypto is a security risk |
| HTTP retry with backoff | Custom retry loops | axios interceptors + retry counter | Interceptors handle retry transparently; manual loops leak into business logic |
| Schema validation | Manual if/typeof checks | Zod safeParse | Zod provides type inference, detailed errors, composable schemas |
| Route protection | Manual navigation guards | Expo Router Stack.Protected | Built-in guard pattern handles deep links, back navigation, edge cases |
| i18n | Custom translation objects | i18next + react-i18next | Handles pluralization, interpolation, lazy loading, React integration |
| Device locale detection | navigator.language | expo-localization | Cross-platform (iOS/Android/Web), returns structured locale data |

**Key insight:** In the React Native/Expo ecosystem, platform-integrated solutions (SecureStore, Router guards) are significantly more secure and reliable than custom implementations because they leverage OS-level security primitives.

## Common Pitfalls

### Pitfall 1: Credentials in Plain AsyncStorage
**What goes wrong:** Storing license/password in AsyncStorage exposes them in unencrypted storage on Android (accessible with root/adb backup)
**Why it happens:** AsyncStorage is simpler API; developers reach for it by default
**How to avoid:** Always use expo-secure-store for credentials; reserve AsyncStorage for non-sensitive preferences only
**Warning signs:** Any `AsyncStorage.setItem` call with credential-like keys

### Pitfall 2: FFBaD API is SOAP-Heritage, Not Standard REST
**What goes wrong:** Treating the API as RESTful (different endpoints per resource) when it's actually a single endpoint with function names as parameters
**Why it happens:** The API has a `/rest/` path but is structurally RPC-style (function name + params)
**How to avoid:** All calls go to the same base URL with `QueryJson` containing `Fonction` and `Param` array. Structure the client as function wrappers, not resource-based.
**Warning signs:** Trying to build separate axios instances per resource

### Pitfall 3: UTF-8 Encoding with French Characters
**What goes wrong:** Accented characters (e, a, c, etc.) in player names display as garbled text or cause comparison failures
**Why it happens:** FFBaD API returns UTF-8 but encoding can be lost in JSON parsing or string comparison
**How to avoid:** Ensure axios response encoding is UTF-8; test with French names containing accents (e.g., "Rene Lacoste"); normalize strings with `.normalize('NFC')` before comparison
**Warning signs:** Player names displaying `Ã©` instead of `e`

### Pitfall 4: No Rate Limit Documentation
**What goes wrong:** Aggressive polling triggers undocumented rate limits, resulting in temporary bans or 429 responses
**Why it happens:** FFBaD API has no published rate limit documentation
**How to avoid:** Implement conservative defaults (max 2 requests/second), exponential backoff on any error, request queuing for bulk operations
**Warning signs:** Sudden 429 or 503 responses after burst of requests

### Pitfall 5: Silent Auto-Login Blocking App Start
**What goes wrong:** App hangs on splash screen if FFBaD API is slow or down during auto-login
**Why it happens:** Awaiting network response before showing UI
**How to avoid:** Show app immediately with cached state; re-authenticate in background; set a timeout (5s) for auto-login — if exceeded, show app with stale data and retry later
**Warning signs:** App appearing frozen on cold start with poor network

### Pitfall 6: SecureStore Size Limits
**What goes wrong:** Attempting to store large objects (cached API responses) in SecureStore
**Why it happens:** Treating SecureStore as general-purpose storage
**How to avoid:** SecureStore is for credentials only (licence + password + remember preference). Use AsyncStorage for cached data.
**Warning signs:** SecureStore write failures on older Android devices

## Code Examples

Verified patterns from official sources:

### SecureStore Credential Management
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/securestore
import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'ffbad_credentials';
const REMEMBER_KEY = 'ffbad_remember';

interface StoredCredentials {
  licence: string;
  password: string;
}

export async function storeCredentials(
  credentials: StoredCredentials,
  remember: boolean
): Promise<void> {
  if (remember) {
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify(credentials),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }
    );
    await SecureStore.setItemAsync(REMEMBER_KEY, 'true');
  }
}

export async function getStoredCredentials(): Promise<StoredCredentials | null> {
  try {
    const remember = await SecureStore.getItemAsync(REMEMBER_KEY);
    if (remember !== 'true') return null;
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCredentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  await SecureStore.deleteItemAsync(REMEMBER_KEY);
}
```

### FFBaD API Client Wrapper
```typescript
// Source: FFBaD API test documentation (https://apitest.ffbad.org)
import axios from 'axios';
import { z } from 'zod';

const FFBAD_BASE_URL = 'https://api.ffbad.org/rest/';

interface FFBaDCallParams {
  fonction: string;
  params: (string | number | boolean)[];
}

export async function callFFBaD<T extends z.ZodType>(
  credentials: { licence: string; password: string },
  call: FFBaDCallParams,
  schema: T
): Promise<z.infer<T>> {
  const response = await axios.get(FFBAD_BASE_URL, {
    params: {
      AuthJson: JSON.stringify({
        Login: credentials.licence,
        Password: credentials.password,
      }),
      QueryJson: JSON.stringify({
        Fonction: call.fonction,
        Param: call.params,
      }),
    },
    timeout: 15000,
  });

  const result = schema.safeParse(response.data);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.message}`);
  }
  return result.data;
}
```

### Exponential Backoff Retry
```typescript
// Source: axios community patterns, adapted for user requirements (2-3 silent retries)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
```

### i18n Configuration (FR/EN)
```typescript
// Source: https://docs.expo.dev/guides/localization + i18next docs
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import fr from './locales/fr.json';
import en from './locales/en.json';

const deviceLanguage = getLocales()[0]?.languageCode ?? 'fr';

i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: deviceLanguage === 'fr' ? 'fr' : 'en', // Default to FR unless device is EN
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18next;
```

## FFBaD API Reference

### API Architecture
- **Base URL:** `https://api.ffbad.org/rest/`
- **Test URL:** `https://apitest.ffbad.org/rest/`
- **Style:** RPC-over-REST (single endpoint, function name as parameter)
- **Auth:** Login + Password passed as JSON in `AuthJson` query parameter
- **Response format:** JSON with `Retour` field containing results

### Authentication-Related Endpoints
| Function | Parameters | Purpose |
|----------|-----------|---------|
| `ws_getaccountpoona` | Licence, Pwd | Validate credentials / get account info |
| `ws_getlicenceinfobylicence` | Licence, NotLastSeasonOnly | Get player info by license number |
| `ws_getlicenceinfobykeywords` | Keywords, NotLastSeasonOnly | Search players by keyword |
| `ws_getlicenceinfobystartnom` | Nom, NotLastSeasonOnly | Search players by name prefix |

### Key Data Endpoints (for future phases)
| Function | Parameters | Purpose |
|----------|-----------|---------|
| `ws_getresultbylicence` | Licence | Match results |
| `ws_getrankingevolutionbylicence` | Licence | Ranking history |
| `ws_getrankingallbyarrayoflicence` | ArrayOfLicence | Multi-player rankings |
| `ws_getrankingallbyclub` | ID_Club | Club rankings |

### Call Pattern
```
GET https://api.ffbad.org/rest/?AuthJson={"Login":"12345678","Password":"xxx"}&QueryJson={"Fonction":"ws_getlicenceinfobylicence","Param":["12345678",false]}
```

**IMPORTANT:** Credentials are passed as URL query parameters. While the API uses HTTPS (encrypted in transit), credentials appear in server logs. This is the API's design — not something we can change. Ensure HTTPS is always enforced on the client side.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AsyncStorage for tokens | expo-secure-store for credentials | Expo SDK 48+ | Hardware-backed security on iOS/Android |
| Custom navigation guards with useEffect + redirect | Expo Router Stack.Protected | Expo Router v4 (SDK 52) | Declarative, handles deep links and edge cases |
| Manual route protection with Redirect component | Stack.Protected guard prop | 2025 | Cleaner API, no conditional rendering bugs |
| i18n-js | i18next + react-i18next | 2024 ecosystem shift | Better React integration, lazy loading, hooks |
| Zod v3 | Zod v3.24+ (v4 available) | 2025 | v3 is mature and stable; v4 exists but v3 is safer for production |

**Deprecated/outdated:**
- `expo-auth-session`: For OAuth flows only — not applicable to FFBaD's credential-based auth
- Redirect-based auth guards in Expo Router: Replaced by Stack.Protected in v4

## Open Questions

1. **FFBaD API rate limits**
   - What we know: No documented rate limits; API has been stable for existing apps
   - What's unclear: Exact requests/minute threshold before throttling
   - Recommendation: Start conservative (2 req/s), implement backoff, test empirically during development

2. **FFBaD API error response format**
   - What we know: Responses use `Retour` field; successful responses return data arrays
   - What's unclear: Exact error response structure for invalid credentials, expired sessions, server errors
   - Recommendation: Test with invalid credentials during Phase 1 development; build Zod schemas that handle both success and error shapes

3. **ws_getaccountpoona vs direct API calls**
   - What we know: `ws_getaccountpoona` takes Licence + Pwd — likely validates credentials
   - What's unclear: Whether this is the "login" endpoint or just account info retrieval; whether all API calls require credentials on every request or if there's a session mechanism
   - Recommendation: Test both approaches during implementation; if every call needs credentials, the "session" is just stored credentials reused per request

## Sources

### Primary (HIGH confidence)
- Context7 `/llmstxt/expo_dev_llms_txt` — expo-secure-store API, Expo Router authentication patterns, Stack.Protected guards
- Context7 `/colinhacks/zod` — Zod safeParse, schema composition, error handling
- Expo official docs: https://docs.expo.dev/versions/latest/sdk/securestore/ — SecureStore API
- Expo official docs: https://docs.expo.dev/router/advanced/authentication — Protected routes pattern
- Expo official docs: https://docs.expo.dev/guides/localization/ — i18n guide

### Secondary (MEDIUM confidence)
- FFBaD API test page: https://apitest.ffbad.org/ — Full endpoint listing, parameter documentation
- FFBaD API changelog: https://api.ffbad.org/Change_Log.php — Function modifications, field additions
- axios interceptor patterns: https://github.com/axios/axios/issues/4779 — Token refresh / retry strategies

### Tertiary (LOW confidence)
- FFBaD API authentication flow: Inferred from endpoint parameters (`AuthJson` with Login/Password) — needs empirical validation
- Rate limiting behavior: No documentation found — needs testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Expo + SecureStore + axios + Zod are well-documented, verified via Context7
- Architecture: HIGH — Expo Router Stack.Protected pattern verified in official docs
- FFBaD API integration: MEDIUM — Endpoint listing verified from test page; auth flow inferred from parameters; error handling needs empirical testing
- Pitfalls: MEDIUM — Common React Native security pitfalls well-documented; FFBaD-specific pitfalls (rate limits, encoding) need validation

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable ecosystem; FFBaD API rarely changes)
