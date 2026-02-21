---
phase: 06-club-features
plan: 01
subsystem: api
tags: [react-native, zod, hooks, i18n, ffbad-api, asyncstorage]

# Dependency graph
requires:
  - phase: 05-ranking-visualization
    provides: RANK_BOUNDARIES and getBestRanking() from rankings.ts, hook patterns
  - phase: 03-personal-dashboard
    provides: useDashboardData hook pattern (isLoading/isRefreshing/error/refresh)
provides:
  - ClubRankingSchema and ClubListSchema Zod schemas for club API responses
  - getClubLeaderboard(clubId) and getClubList() API functions in ffbad.ts
  - normalizeToLeaderboard() utility sorting by RANK_BOUNDARIES index
  - getRankSortIndex() utility for rank comparison
  - useClubLeaderboard(clubId) hook with full loading/error/refresh state
  - useClubSearch() hook with AsyncStorage-cached club list, debounced client-side filter
  - FR + EN i18n strings for all Club tab UI (15 keys each)
affects:
  - 06-02 (club UI — Club tab screen consumes all these exports)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level in-memory cache + AsyncStorage TTL cache for large club list (~3500 entries)
    - getRankSortIndex via RANK_BOUNDARIES array index for deterministic rank ordering
    - useClubSearch: fetch-once-cache pattern, filter client-side with useDebounce

key-files:
  created:
    - src/utils/clubLeaderboard.ts
    - src/hooks/useClubLeaderboard.ts
    - src/hooks/useClubSearch.ts
  modified:
    - src/api/schemas.ts
    - src/api/ffbad.ts
    - src/i18n/locales/fr.json
    - src/i18n/locales/en.json

key-decisions:
  - "Club list cached in memory + AsyncStorage (24h TTL) — fetch once for all searches; ~3500 clubs manageable in memory"
  - "bestRank fallback chain: getBestRanking() result -> ClassementSimple/Double/Mixte -> NC; handles players with classement but no CPPH"
  - "normalizeToLeaderboard accepts unknown[] to decouple from schema type — cast internally to Record<string, unknown>"

patterns-established:
  - "fetch-once-cache: module-level variable + AsyncStorage TTL for large rarely-changing data"
  - "useClubSearch returns search() fn — caller controls when list is fetched, not useEffect on mount"

requirements-completed:
  - RANK-04

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 6 Plan 01: Club Features Data Layer Summary

**FFBaD club leaderboard data layer: Zod schemas, API functions, rank-sort utilities, two React Native hooks, and FR/EN i18n strings for club tab UI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T06:39:57Z
- **Completed:** 2026-02-20T06:42:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added permissive Zod schemas (ClubRankingSchema, ClubListSchema) with .passthrough() for unverified FFBaD API responses
- Implemented getClubLeaderboard() and getClubList() following existing callFFBaD patterns
- Created clubLeaderboard.ts with normalizeToLeaderboard() that reuses RANK_BOUNDARIES + getBestRanking() for correct rank ordering
- Created useClubLeaderboard hook mirroring useDashboardData pattern (useCallback + cancelled flag + isLoading/isRefreshing/error/refresh)
- Created useClubSearch hook with fetch-once-cache (memory + AsyncStorage 24h TTL), 300ms debounce, 3-char minimum
- Added 15-key club section to both fr.json and en.json covering all Plan 02 UI needs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add club API schemas and functions** - `5f9cdcb` (feat)
2. **Task 2: Create leaderboard utilities, data hooks, and i18n strings** - `5f15bac` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/api/schemas.ts` - Added ClubRankingSchema + ClubListSchema + ClubListItem type
- `src/api/ffbad.ts` - Added getClubLeaderboard() and getClubList() API functions
- `src/utils/clubLeaderboard.ts` - LeaderboardEntry interface, getRankSortIndex(), normalizeToLeaderboard()
- `src/hooks/useClubLeaderboard.ts` - Hook for club leaderboard state (members, clubName, rankedCount, loading, error, refresh)
- `src/hooks/useClubSearch.ts` - Hook for club list with cached fetch + debounced client-side filter
- `src/i18n/locales/fr.json` - Added "club" section (15 keys)
- `src/i18n/locales/en.json` - Added "club" section (15 keys)

## Decisions Made
- Club list cached in memory (module-level variable) + AsyncStorage (24h TTL): fetch-once approach avoids repeated ~3500-item API calls; club list changes rarely (new clubs join each season).
- bestRank fallback chain in normalizeToLeaderboard: getBestRanking() (needs CPPH) -> ClassementSimple/Double/Mixte (classement string only) -> 'NC'. Handles players with ranking category but no CPPH points recorded.
- normalizeToLeaderboard signature is `unknown[]` rather than typed schema array: decouples utility from Zod internals, allows direct pass of `response.Retour` array without casting at call site.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data layer for Club tab is complete and TypeScript-verified
- Plan 02 can immediately consume: useClubLeaderboard, useClubSearch, LeaderboardEntry type, and all i18n keys
- Open question for Plan 02: ws_getrankingallbyclub response field names are inferred (not confirmed from live API call) — .passthrough() on schema handles gracefully; Plan 02 UI should log first response in dev to confirm field names

---
*Phase: 06-club-features*
*Completed: 2026-02-20*
