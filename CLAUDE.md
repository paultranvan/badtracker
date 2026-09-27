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

Caveat: `tsconfig.json`'s `include` only lists `nativewind-env.d.ts`, so `npx tsc --noEmit` currently type-checks nothing. To really check, use a throwaway config that extends it with `"include": ["nativewind-env.d.ts", "expo-env.d.ts", "src/**/*", "app/**/*"]`.

No test framework is configured. No linter is configured.

### Running locally

- Prereqs: `ANDROID_HOME=~/dev/sdk/android`, a JDK ≥ 17 on `JAVA_HOME` (JDK 20 works), AVD `Pixel_3a_API_34_extension_level_7_x86_64`.
- Boot the emulator first, then `npx expo run:android`: builds the debug APK (dev client), installs it, and starts Metro on :8081. Afterwards `npx expo start` is enough as long as native deps are unchanged.
- No test account: signing in requires a real myffbad.fr licence number + password.
- `.env` (see `.env.example`) holds Metro flags and `FIREBASE_APP_ID`, which is only needed for `npm run deploy` (release APK → Firebase App Distribution).

## Architecture

BadTracker is a React Native (Expo SDK 54) app for tracking French badminton (FFBaD) player rankings. It authenticates against myffbad.fr and displays player profiles, rankings, match history, and club data.

### API Layer: WebView Bridge Pattern

The app does **not** make direct HTTP calls to myffbad.fr. Instead, a hidden `<WebView>` loads myffbad.fr and runs requests from within that page context, so they are same-origin and carry the site's HttpOnly `jwt` session cookie.

The flow is:
1. `src/api/webview-bridge.tsx` — Renders a hidden WebView on myffbad.fr and injects a script serving three request types. Exports module-level functions (not hooks): `bridgeLogin` (signInAction + personId), `bridgeAction(name, args)` (Next.js Server Action by name), `bridgeRsc(path)` (RSC payload of a page).
2. `src/api/ffbad.ts` — High-level API functions (`getLicenceInfo`, `searchPlayersByKeywords`, `getResultsByLicence`, `getRankingEvolution`, `getClubInfo`, etc.) that call bridge functions and normalize myffbad.fr data to the app's internal (legacy-API-shaped) format.
3. `src/api/schemas.ts` — Zod schemas for all API response types. Responses use a `{ Retour: data | errorString }` wrapper pattern.
4. `src/api/client.ts` — Legacy axios client for the old FFBaD REST API (`api.ffbad.org`). Not used by current WebView-based API calls but kept for type definitions.

Key detail: The bridge maintains module-level state (`webViewRef`, `pendingRequests`, `bridgeReady`). The `WebViewBridgeProvider` component must be mounted in the component tree for API calls to work.

### Authentication

- `src/auth/context.tsx` — `SessionProvider` manages login/logout, auto-login from SecureStore, and exposes `useSession()`.
- `src/auth/storage.ts` — Persists credentials in `expo-secure-store`.
- Session info (personId, licence) is injected into `ffbad.ts` via `setSessionInfo()` at login time. There is no access token: the session is the `jwt` cookie inside the WebView.

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

## myffbad.fr API Reference

myffbad.fr is a Next.js App Router site (rewritten in 2026). The old `/api/*` REST endpoints (Verify-Token, `accessToken`/`currentpersonid` headers) **all return 404** — don't use them. Data comes from two mechanisms, both used from inside the WebView:

### Server Actions (`bridgeAction`)
- `POST /` (any page route) with headers `next-action: <id>`, `accept: text/x-component`, `content-type: text/plain;charset=UTF-8`; body = JSON array of arguments.
- Response is RSC text: row 0 is `{"a":"$@1",…}`, the return value is the row `1:<json>` (`"$undefined"` → null, `E{…}` → the action threw).
- Action IDs change on every myffbad.fr deploy. The bridge resolves them by name by scanning `/_next/static/chunks/*.js` for `createServerReference)("<id>",…,"<name>")` and caches them in the WebView's localStorage; a stale ID answers 404 + `x-nextjs-action-not-found`, which triggers rediscovery. `signInAction` only appears in the chunks of `/connexion` fetched **logged out** (`credentials: 'omit'`). Some actions are exported as `default` and can't be resolved by name.

| Action | Args | Returns |
|---|---|---|
| `signInAction` | `[{licence, password, rememberMe}]` — must be POSTed to `/connexion` (elsewhere it returns success without setting the cookie) | `{success, error?}` + `Set-Cookie: jwt=…` |
| `getCurrentPersonIdAction` | `[]` | personId string, or undefined when logged out |
| `getPlayerRankingAction` | `[personId]` | flat PascalCase: `SimpleSubLevel`, `SimpleRate`, `FederalSimpleRank`, `BestSimpleSubLevel`, `SimpleUpRate`/`SimpleDownRate`… (same for Double/Mixte) |
| `getPlayerEventResultsAction` | `[{personId, season: "Decade", isHistory: true}]` (`isHistory:false`, no season → current season) | `[{Date, EventName, SubName, DisciplineId, EventId, BracketId, WinPoints, MatchCount, Status, …}]` — interclub rows have `BracketId = -MatchId` |
| `getPlayerEventDetailsAction` | `[{personId, date: "YYYY-MM-DD", disciplineId, bracketId}]` | matches: `{Score, Set11, Set12, …, RoundName, RoundPositionName, Top/Bottom: {IsWinner: "0"/"1", Persons: [{PersonId, PersonName, PersonLicence, RankingSubLevel, WinPoints, …}]}}` |
| `getRankingSemesterEvolutionAction` | `[personId]` | `[{RankingDate, SimpleSubLevel, SimpleRate, SimpleRank, …}]` |
| `getClubsHistoryAction` | `[personId]` | `[{Season, InstanceId, Name, Sigle, City}]`, most recent first |

Also present, not used by the app yet: `getRankingEvolutionAction`, `getPlayerActualRateEvolutionAction`, `getPlayerStatisticsAction`, `getOpponentDetailsAction`, `getSeasonsAction`, `getFavoritePlayersAction`, `getMyClubAction`, `getClubStatisticsAction`.

`DisciplineId`: 1 Simple Hommes, 2 Simple Dames, 3 Double Hommes, 4 Double Dames, 5 Double Mixte, 6 Simple intergenre, 7 Double intergenre.

### RSC page payloads (`bridgeRsc`)
`GET <page>` with header `RSC: 1` returns the page's RSC stream; component props are plain JSON, so `ffbad.ts` lifts arrays out with `extractRscArray(payload, key)`.

| Page | Key | Content |
|---|---|---|
| `/recherche/joueur?search=<q>` | `results` | players: `PersonId, PersonName ("Paul TRAN-VAN"), PersonLicence, Simple/Double/MixteSubLevel, ClubId, ClubName, ClubAcronym` |
| `/recherche/club?search=<q>` | `results` | clubs: `InstanceId, Name, Acronym, Town, Departement, Phone1, Email, WebSiteUrl, LogoUrl, Gymnasiums` |
| `/recherche/les-tops?club=<id>&disciplineId=<1-6>&maxResults=500&isFirstLoad=false` | `results` | `Rank, Rate, SubLevel, PersonId, PersonName, PersonLicence, CategoryName, Club*` (1 SH, 2 SD, 3 DH, 4 DD, 5 Mx H, 6 Mx D) |
| `/joueur/<licence>/mes-adversaires` | `opponents` | logged-in user's opponents: `PersonId, PersonName, PersonLicence, MatchCount, LastDate, …` |
| `/seuils-de-classement` | `rankingLevels` | `SubLevel, MenSingleRate, WomenSingleRate, MenDoubleRate, …` |
| `/club/<id>` | — | markup only; the club name is the non-`401/403/404` `data-testid="hero-title"` |

### Common Pitfalls
- Every page's RSC payload also embeds the layout's 401/403/404 templates — don't take the first match of a test id blindly.
- `/deconnexion` (GET) does not log out; logging in again simply replaces the `jwt` cookie.
- There is no full club list endpoint anymore; club search is server-side per query.
