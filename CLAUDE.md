# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server
npx expo start

# Run on Android emulator
npx expo run:android

# TypeScript check
npx tsc --noEmit
```

No test framework is configured. No linter is configured.

## Architecture

BadTracker is a React Native (Expo SDK 54) app for tracking French badminton (FFBaD) player rankings. It authenticates against myffbad.fr and displays player profiles, rankings, match history, and club data.

### API Layer: WebView Bridge Pattern

The app does **not** make direct HTTP calls to myffbad.fr. Instead, a hidden `<WebView>` loads myffbad.fr and executes API requests from within that page context. This is necessary because myffbad.fr requires a `Verify-Token` header generated via CryptoJS (AES + SHA256) using the page's origin.

The flow is:
1. `src/api/webview-bridge.tsx` — Renders a hidden WebView on myffbad.fr, injects JS that handles fetch requests and Verify-Token generation. Exports `bridgeGet`, `bridgePost`, `bridgeLogin` as module-level functions (not hooks).
2. `src/api/ffbad.ts` — High-level API functions (`getLicenceInfo`, `searchPlayersByKeywords`, `getResultsByLicence`, `getRankingEvolution`, `getClubInfo`, etc.) that call bridge functions and transform myffbad.fr responses to the app's internal format.
3. `src/api/schemas.ts` — Zod schemas for all API response types. Responses use a `{ Retour: data | errorString }` wrapper pattern.
4. `src/api/client.ts` — Legacy axios client for the old FFBaD REST API (`api.ffbad.org`). Not used by current WebView-based API calls but kept for type definitions.

Key detail: The bridge maintains module-level state (`webViewRef`, `pendingRequests`, `bridgeReady`). The `WebViewBridgeProvider` component must be mounted in the component tree for API calls to work.

### Authentication

- `src/auth/context.tsx` — `SessionProvider` manages login/logout, auto-login from SecureStore, and exposes `useSession()`.
- `src/auth/storage.ts` — Persists credentials in `expo-secure-store`.
- Session info (personId, accessToken, licence) is injected into `ffbad.ts` via `setSessionInfo()` at login time.
- The `currentpersonid` header must always be the **logged-in user's** personId, not the target player's.

### Routing (expo-router)

```
app/
  _layout.tsx          — Root: providers + AuthGate (redirects based on session)
  sign-in.tsx          — Login screen
  (app)/
    _layout.tsx        — Stack navigator
    (tabs)/
      _layout.tsx      — Tab bar: Home, Matches, Search, Club, Settings
      index.tsx        — Dashboard (current user's rankings)
      matches.tsx      — Match history
      search.tsx       — Player search
      club.tsx         — Club info & leaderboard
      settings/        — Settings screens with bookmarks
    player/[licence].tsx  — Player profile (from search results)
    ranking-chart.tsx     — Ranking evolution chart
    club/[clubId].tsx     — Club detail page
```

### Provider Nesting Order (root _layout.tsx)

`ConnectivityProvider` > `WebViewBridgeProvider` > `SessionProvider` > `BookmarksProvider`

### Data Hooks

Custom hooks in `src/hooks/` encapsulate API calls with caching: `useDashboardData`, `usePlayerSearch`, `useMatchHistory`, `useRankingEvolution`, `useClubSearch`, `useClubLeaderboard`.

### Other Key Modules

- `src/cache/storage.ts` — AsyncStorage-based caching layer
- `src/bookmarks/context.tsx` — Player bookmarks (stored locally)
- `src/connectivity/context.tsx` — Network status monitoring + `OfflineBar` component
- `src/i18n/` — i18next with French (`fr.json`) and English (`en.json`) locales
- `src/utils/` — Pure utility functions for ranking display, chart data, match history formatting
- `src/types/ffbad.ts` — Shared TypeScript types (re-exports from schemas)

### Error Handling

`src/api/errors.ts` defines a hierarchy: `FFBaDError` base class with `NetworkError`, `ServerError`, `RateLimitError`, `AuthError`, `SchemaValidationError`. Each has an i18n `userMessageKey` and `isRetryable` flag.

## Key Conventions

- Path alias: `@/*` maps to `./src/*`
- React Compiler enabled (`experiments.reactCompiler: true` in app.json)
- New Architecture enabled (`newArchEnabled: true`)
- All API response schemas use `.passthrough()` to tolerate unknown fields from myffbad.fr
- The hidden WebView must use `top: -1000, left: -1000` positioning (not just `width:0, height:0`) to avoid intercepting touches
- Discipline codes: `S` = Singles, `D` = Doubles, `M` = Mixed
