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

## myffbad.fr API Reference

### Verify-Token Algorithm
- Uses SHA-256 (64 hex chars), NOT MD5
- Salt: `93046758d21048ae10e9fa249537aa79`
- `serviceBaseURL` = `origin + /api/{service}/` (e.g., `https://myffbad.fr/api/person/`)
- Generation: `t = Date.now()` → `encrypted = AES.encrypt(t, salt)` → `hash = SHA256(encrypted + '.' + serviceBaseURL + '.' + salt)` → `token = hash + '.' + encrypted`

### Required Headers
- `Verify-Token`: generated token
- `Caller-URL`: same as serviceBaseURL
- `Content-Type: application/json`
- `accessToken`: from login response
- `currentpersonid`: logged-in user's personId (always the current user, not the target player)
- `apiseasonid`: seasonId from login response's `currentSeason.seasonId` (for some endpoints)

### Authentication (`/api/auth/`)

| Endpoint | Method | Body / Notes |
|---|---|---|
| `/api/auth/login` | POST | `{login, password, isEncrypted: false}` → `{personId, firstName, lastName, accessToken, licence, currentSeason: {seasonId}}` |
| `/api/auth/connectUserByToken` | POST | `{token}` |
| `/api/auth/resetPassword` | POST | `{login, url: "https://myffbad.fr/motdepasse"}` |
| `/api/auth/updatePassword` | POST | |
| `/api/auth/updateLogin` | POST | |
| `/api/auth/{personId}/getUserLogin` | GET | |

### Player Rankings & Info (`/api/person/`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/person/{personId}/rankings` | GET | Flat object: `simpleSubLevel`, `simpleRate`, `doubleSubLevel`, `doubleRate`, `mixteSubLevel`, `mixteRate`, `bestXxxSubLevel`, etc. |
| `/api/person/{personId}/informations/` | GET | Player personal info |
| `/api/person/{personId}/informationsLicence/{licence}` | GET | Player info by licence |
| `/api/person/{personId}/statistics` | GET | Current season stats |
| `/api/person/{personId}/statistics/{season}` | GET | Stats by season (e.g., `"Decade"`, `"2024-2025"`) |
| `/api/person/{personId}/lastCLub/` | GET | Last club (note: capital `CL`) |
| `/api/person/{personId}/club/history` | GET | Club transfer history |
| `/api/person/{personId}/coach` | GET | Coaching info |
| `/api/person/{personId}/officials` | GET | Official roles |
| `/api/person/{personId}/leaders` | GET | Leadership roles |
| `/api/person/{personId}/sanctions` | GET | |
| `/api/person/{personId}/handicap` | GET/POST | |

### Match Results (`/api/person/`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/person/{personId}/result` | GET | Sparse results (IDs null) — **avoid** |
| `/api/person/{personId}/result/actual` | GET | Rich results with all IDs — **use this** |
| `/api/person/{personId}/result/{season}` | GET | By season (e.g., `"Decade"`, `"2024-2025"`) |
| `/api/person/{personId}/result/detail` | POST | `{date: "YYYY-MM-DD", discipline: <number>, bracketId: <number>}` |

**`/result/actual` response** — each item: `date`, `name`, `subName`, `winPoint`, `discipline` (`"SIMPLE HOMMES"`/`"DOUBLE HOMMES"`/`"MIXTE"`), `eventId`, `resultId`, `disciplineId`, `bracketId`, `roundId`, `matchCount`, `inRating`, `isValidated`, `integrationDate`, `status` (`"green"`/`"orange"`), `isInternational`

**`/result/detail` response** — array of matches per bracketId. Each: `{score, scoreWinner[], scoreLoser[], winSet, lostSet, roundName, roundPositionName, top: {IsWinner, Persons: {[personId]: {PersonName, PersonLicence, Rate, RankingSubLevel, ClubAcronym, WinPoints}}}, bottom: {...}}`. Field `discipline` (not `disciplineId`). Date must be `YYYY-MM-DD`. `IsWinner` is string `"0"`/`"1"`.

### Opponents (`/api/person/`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/person/{personId}/opponentList` | GET | All opponents: `PersonId`, `PersonName`, `PersonLicence`, `PersonSex`, `SimpleSubLevel`, `DoubleSubLevel`, `MixteSubLevel`, `ClubId`, `ClubAcronym`, `ClubName`, `MatchCount`, `LastDate` |
| `/api/person/{personId}/playerOpposition/{opponentPersonId}` | GET | Head-to-head stats |

### Ranking Evolution (`/api/person/` and `/api/players/`)

| Endpoint | Method | Base URL | Notes |
|---|---|---|---|
| `/api/person/{personId}/rankingSemester/evolution` | POST (empty body) | `/api/person/` | By semester: `{RankingDate, SimpleSubLevel, SimpleRate, DoubleSubLevel, DoubleRate, MixteSubLevel, MixteRate}` |
| `/api/players/{personId}/rateEvolution` | GET | `/api/players/` | CPPH rate evolution |
| `/api/players/{personId}/rateEvolution/decade` | GET | `/api/players/` | CPPH rate evolution (10 years) |

### Search (`/api/search/`)

| Endpoint | Method | Body / Notes |
|---|---|---|
| `/api/search/` | POST | `{type: "PERSON"\|"CLUB"\|"TOURNAMENT", text, page}` → `{persons, currentPage, totalPage}` |
| `/api/search/tops` | POST | `{discipline?, dateFrom?, top?, instanceId?, categories?, subLevels?, isFirstLoad, sort?}` |

**Search person response**: `{personId, sex, name, licence, category: {name, acronym}, rank: {simpleSubLevel, doubleSubLevel, mixteSubLevel}, club: {id, name, acronym}}` — nested objects, no CPPH. `sex`: `"HOMME"`/`"FEMME"`.

### Club (`/api/club/`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/club/{clubId}/informations/` | GET | Club info (name, address, initials, city, department, etc.) |

No dedicated club members endpoint — use search with club initials via `/api/search/`.

### Extended Service (`/api/players/`)

Direct GET to `/api/players/` returns HTML. Use sub-paths only.

| Endpoint | Method | Notes |
|---|---|---|
| `/api/players/{personId}/LastPartnerList/{discipline}/{limit}` | GET | Recent partners (limit default: 5) |
| `/api/players/{personId}/isCompetitive` | GET | |
| `/api/players/{personId}/personalFiles` | GET | |
| `/api/players/{personId}/files/list` | GET | |
| `/api/players/seasons` | GET | List seasons |
| `/api/players/search/{query}` | POST | Search within players service |

### Tournament (`/api/players/`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/players/{competitionId}/informations` | POST | `{seasonId}` — tournament details |
| `/api/players/{competitionId}/brackets` | GET | Tournament draw/brackets |
| `/api/players/{competitionId}/matchs` | GET | Tournament matches |
| `/api/players/{competitionId}/evaluations/{id}` | GET | Tournament evaluation |

### Reference Data (`/api/common/`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/common/sublevels` | GET | All ranking sublevels |
| `/api/common/leagues` | GET | All leagues |
| `/api/common/committees` | GET | All committees |
| `/api/common/committees/{id}/clubs/` | GET | Clubs by committee |
| `/api/common/leagues/{id}/committees/` | GET | Committees by league |
| `/api/common/leagues/{id}/clubs/` | GET | Clubs by league |
| `/api/common/category` | GET | All categories |
| `/api/common/clubs` | GET | All clubs |
| `/api/common/rankingLevel` | GET | Ranking level thresholds |

### Charts (`/api/chart/`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/chart/statistics/{type}` | GET | Pie chart data |
| `/api/chart/statistics/{type}/{season}` | GET | Pie chart history |
| `/api/chart/progress/{type}` | GET | Progress chart |
| `/api/chart/evolution/real/{type}` | GET | Real evolution chart |
| `/api/chart/evolution/category/{type}` | GET | Category evolution |
| `/api/chart/rank/{type}/{param}` | GET | Chart by rank |
| `/api/chart/category/{type}/{param}` | GET | Chart by category |
| `/api/chart/gender/{type}/{param}` | GET | Chart by gender |
| `/api/chart/pyramid/age/{type}/{param}` | GET | Age pyramid |

### Common Pitfalls
- MD5 instead of SHA-256 → 403
- `/api/players/` direct GET → HTML (use sub-paths)
- Missing `Caller-URL` → 403
- `currentpersonid` must be the **logged-in user**, not the target
- Search results have **nested** `rank` and `club` objects
- `LastPartnerList` uses capital L's, lives on `/api/players/`
- `lastCLub` has unusual casing (capital CL)
- `rateEvolution` is on `/api/players/`, `rankingSemester/evolution` is on `/api/person/`
- Tournament endpoints use `competitionId` and live on `/api/players/`
