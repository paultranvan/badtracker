# BadTracker

## What This Is

A mobile app for French badminton players (FFBaD-licensed) to track their match history, visualize ranking progression, and follow other players. It pulls all data from the FFBaD API (`api.ffbad.org`) and presents it in a clean, native mobile experience — something myffbad.fr fails to deliver on phones.

## Core Value

French badminton players can instantly see their ranking evolution and match stats in a native mobile experience that makes myffbad.fr data actually useful.

## Requirements

### Validated

- Authenticate via FFBaD license number — Phase 1
- Search for other players by name or license number — Phase 2
- View subscribed players' profiles and stats — Phase 2 (profile view; bookmarking in Phase 7)
- View personal dashboard (ranking, recent matches, quick stats) — Phase 3
- View full match history from FFBaD with filters — Phase 4
- See win/loss breakdown by discipline (simple, double, mixte) — Phase 4
- See ranking/points evolution over time as a visual chart — Phase 5
- See ranking milestones (when rank changed) — Phase 5
- View club leaderboards with ranked club members — Phase 6
- Subscribe to (bookmark) other players for quick access — Phase 7
- All FFBaD disciplines tracked (simple, double, mixte) — Phase 4/5
- Local caching for performance and offline access to recent data — Phase 8
- Offline indicator bar when no connection — Phase 8
- Auto-refresh cached data when connectivity returns — Phase 8

### Active

<!-- Current scope. Building toward these. -->

_All v1 requirements have been validated._

### Out of Scope

- Live match scoring — app consumes FFBaD data, does not create it
- Push notifications — requires backend, deferred to future version
- Head-to-head comparisons — nice to have, not v1
- iOS build — Android-first, iOS later (React Native makes this easy to add)
- Backend server — direct FFBaD API access with local storage
- Non-FFBaD players — only licensed French federation players

## Context

- **FFBaD API** exists at `api.ffbad.org` with REST/JSON and SOAP/JSON endpoints. 70+ functions covering player info (`ws_getlicenceinfobylicence`, `ws_getlicenceinfobykeywords`), rankings (`ws_getrankingbyarrayoflicence`, `ws_getrankingevolutionbylicence`), match results (`ws_getresult`), and tournaments (`ws_gettourneybyid`). Authentication requires login/password credentials passed as JSON.
- **Poona** is FFBaD's central database for player rankings and match data. Rankings are recalculated weekly (CPPH system).
- **myffbad.fr** is the existing web app — functional but poor mobile experience. It's a JavaScript SPA hitting the same API.
- Third-party apps like **Ebad** and **BadNet** already consume FFBaD data, confirming API access is feasible for third-party apps.
- The ranking system uses a points system per discipline, with points earned/lost based on match results.

## Constraints

- **Tech stack**: React Native with Expo — cross-platform, JavaScript/TypeScript
- **Data source**: FFBaD API only — no scraping, no alternative data sources
- **Platform**: Android first, iOS deferred
- **No backend**: Direct API calls from app + local storage (AsyncStorage/SQLite) for caching
- **Auth**: FFBaD license number required — app is only for affiliated players
- **API access**: Need to understand FFBaD API authentication requirements and any rate limits

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native + Expo | Cross-platform with JS/TS, large ecosystem, quick setup | Validated Phase 1 |
| No backend for v1 | Keep architecture simple, direct FFBaD API + local cache | Validated Phase 1 |
| Android-first | User's primary platform, iOS trivial to add later with RN | Validated Phase 1 |
| FFBaD API direct access | Existing third-party apps confirm this works | Validated Phase 1 |
| FFBaD API is RPC-over-REST | Single endpoint, function name + params as JSON | Validated Phase 1 |
| SecureStore for credentials | Hardware-backed encryption, AFTER_FIRST_UNLOCK accessibility | Validated Phase 1 |
| i18n with i18next | French default, English alternative, device detection | Validated Phase 1 |
| Single search bar auto-detect | Name vs licence number detection by input content | Validated Phase 2 |
| Player route outside tabs | /player/[licence] accessible from any screen | Validated Phase 2 |
| 300ms debounce, 3-char minimum | Balances responsiveness vs API load | Validated Phase 2 |
| Promise.allSettled for dashboard | Parallel fetch with graceful partial failure | Validated Phase 3 |
| CPPH boundaries as static lookup | Approximate values, easily updatable | Validated Phase 3 |
| SectionList for match history | Tournament-grouped display with sticky headers | Validated Phase 4 |
| LayoutAnimation for accordion | Native animation for expand/collapse | Validated Phase 4 |
| react-native-gifted-charts | No Skia/Reanimated deps, SVG-based, sufficient for 52-point charts | Validated Phase 5 |
| dataSet prop for multi-line chart | Cleanly handles 1-3 discipline lines without data/data2/data3 | Validated Phase 5 |
| Ranking chart outside tabs | Stack screen accessible from dashboard ranking card tap | Validated Phase 5 |
| Club list cached with 24h TTL | Memory + AsyncStorage for ~3500-entry club list | Validated Phase 6 |
| Dual-mode Club screen | Leaderboard and search in single component with boolean flag | Validated Phase 6 |
| Subscriptions = bookmarks only (v1) | Push notifs need backend, defer complexity | Validated Phase 7 |
| Bookmarks tied to device not account | Persist across logout, BookmarksProvider outside auth | Validated Phase 7 |
| react-native-toast-message for feedback | Lightweight toast notifications for bookmark actions | Validated Phase 7 |
| @react-native-community/netinfo | Real-time connectivity detection with null-safe initial state | Validated Phase 8 |
| Cache-first-then-fetch pattern | cacheGet before API, cacheSet after success, instant UI | Validated Phase 8 |
| Cache prefix namespacing | 'badtracker_cache:' avoids collision with bookmarks/language keys | Validated Phase 8 |
| Sign-out clears cache | Clean slate for next login, cacheClear before clearCredentials | Validated Phase 8 |

---
*Last updated: 2026-02-20 after Phase 8*
