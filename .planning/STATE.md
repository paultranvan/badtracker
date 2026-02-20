# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** French badminton players can instantly see their ranking evolution and match stats in a native mobile experience that makes myffbad.fr data actually useful.
**Current focus:** Phase 7 - Player Bookmarks

## Current Position

Phase: 7 of 8 (Player Bookmarks)
Plan: 2 of 2 in current phase — Phase 7 COMPLETE
Status: Phase 7 complete — all bookmark UI delivered
Last activity: 2026-02-20 — Phase 7 Plan 2 Bookmark UI integration complete

Progress: [█████████░] 87%

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: ~7 min/plan
- Total execution time: ~1h 50min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Foundation & Security | 4/4 | ~1 hr | ~15 min |
| 2 - Player Discovery | 2/2 | ~18 min | ~9 min |
| 3 - Personal Dashboard | 2/2 | ~10 min | ~5 min |
| 4 - Match History | 2/2 | ~10 min | ~5 min |
| 5 - Ranking Visualization | 2/2 | ~10 min | ~5 min |
| 6 - Club Features | 2/2 | ~5 min | ~2.5 min |

**Recent Trend:**
- Last 5 plans: 06-01, 06-02, 07-01, 07-02
- Trend: Accelerating

*Updated after each plan completion*

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 7 - Player Bookmarks | 2/2 | ~4 min | ~2 min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- React Native + Expo: Cross-platform with JS/TS, large ecosystem, quick setup
- No backend for v1: Keep architecture simple, direct FFBaD API + local cache
- Android-first: User's primary platform, iOS trivial to add later with RN
- FFBaD API direct access: Existing third-party apps confirm this works
- FFBaD API is RPC-over-REST: single endpoint, function name + params as JSON
- Credentials stored in SecureStore with AFTER_FIRST_UNLOCK accessibility
- i18n: French default, English alternative, via i18next + react-i18next
- Expo Router Stack.Protected for auth-gated navigation
- Single search bar auto-detects name vs licence number (Phase 2)
- Player profile route /player/[licence] outside tabs for universal access (Phase 2)
- 300ms debounce for search, minimum 3 characters (Phase 2)
- Promise.allSettled for parallel dashboard data fetching (Phase 3)
- CPPH boundaries as static lookup table — approximate values, easily updatable (Phase 3)
- Dashboard ranking cards: flex row, 3 equal-width cards with gap indicators (Phase 3)
- SectionList with stickySectionHeadersEnabled for tournament-grouped match display (Phase 4)
- Client-side filtering with useMemo chain for discipline and season filters (Phase 4)
- LayoutAnimation for accordion expand/collapse in match detail (Phase 4)
- Matches tab between Home and Search in bottom navigation (Phase 4)
- react-native-gifted-charts for ranking visualization — no Skia/Reanimated deps needed (Phase 5)
- dataSet prop for multi-line chart rendering with per-discipline colors (Phase 5)
- Milestone detection by comparing consecutive rank values — shown as colored badges on chart (Phase 5)
- Ranking chart as Stack screen outside tabs — accessible from dashboard ranking card tap (Phase 5)
- Tappable legend toggles discipline line visibility with useMemo filtering (Phase 5)
- [Phase 06-club-features]: Club list cached in memory + AsyncStorage (24h TTL) for fetch-once approach to ~3500-entry club list (Phase 6)
- [Phase 06-club-features]: normalizeToLeaderboard accepts unknown[] to decouple from Zod schema types; bestRank fallback: getBestRanking() -> classement string -> NC (Phase 6)
- [Phase 06-club-features]: Club tab fetches user's club via getPlayerProfile in useEffect — no new hook needed
- [Phase 06-club-features]: Dual-mode screen pattern for Club tab: leaderboard and search mode in single component with boolean flag
- [Phase 07]: react-native-toast-message installed with --legacy-peer-deps to resolve peer dependency conflicts
- [Phase 07]: Bookmarks tied to device not account — BookmarksProvider wraps outside of auth state awareness, loads on app mount regardless of login state
- [Phase 07-player-bookmarks]: @expo/vector-icons needs explicit install via expo install even when Expo SDK is used
- [Phase 07-player-bookmarks]: Settings tab folder pattern: settings/_layout.tsx + index.tsx maps to same tab route as settings.tsx

### Pending Todos

None.

### Blockers/Concerns

**Phase 1 (Foundation) — RESOLVED:**
- FFBaD API uses Login+Password in AuthJson param (not token-based) — validated
- FFBaD API rate limits still undocumented — exponential backoff implemented
- UTF-8 handling tested — axios defaults handle French characters correctly

**Phase 2 (Player Discovery) — RESOLVED:**
- Ranking fields in getLicenceInfo response may use different field names — .passthrough() + optional fields handle gracefully
- Profile shows "No ranking data" if fields aren't present — acceptable degradation

**Phase 3 (Personal Dashboard) — RESOLVED:**
- CPPH rank boundary values are approximate — will verify with real FFBaD data
- Match result API response shape uncertain — win/loss detection tries multiple field names
- Dashboard renders correctly with partial data (profile loads even if matches fail)

**Phase 4 (Match History) — RESOLVED:**
- FFBaD API response fields for match detail are uncertain — .passthrough() + optional fields with graceful fallbacks
- Season detection uses month >= 8 (September) threshold for French badminton calendar
- LayoutAnimation enabled experimentally on Android for accordion

**Phase 5 (Ranking Visualization) — RESOLVED:**
- FFBaD ranking evolution API response shape uncertain — expanded schema with .passthrough() + optional fields
- Date format handling: parser tries ISO then DD/MM/YYYY then fallback
- NC disciplines rendered as flat line at value 0 with "NC" label in legend

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 07-02-PLAN.md (bookmark UI integration complete — Phase 7 done)
Resume file: .planning/phases/08-polish (next phase)
