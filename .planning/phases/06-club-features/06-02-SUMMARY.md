---
phase: 06-club-features
plan: 02
subsystem: ui
tags: [react-native, expo-router, flatlist, club-leaderboard, navigation]

# Dependency graph
requires:
  - phase: 06-01
    provides: useClubLeaderboard hook, useClubSearch hook, ClubLeaderboard utility, i18n keys
provides:
  - Club tab screen (app/(app)/(tabs)/club.tsx) with leaderboard + search mode
  - Club stack route (app/(app)/club/[clubId].tsx) for deep navigation
  - Updated tab layout with Club tab between Search and Settings
  - Updated app layout with club/[clubId] stack screen
  - Tappable club name in player profile navigating to club leaderboard
affects: [phase-07, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual-mode screen: leaderboard view with inline search mode toggle
    - User row highlighting with borderLeft accent + background tint
    - FlatList with RefreshControl for pull-to-refresh on leaderboard
    - Club ID fetched from getPlayerProfile in useEffect to drive leaderboard hook
    - useCallback for stable renderItem functions passed to FlatList

key-files:
  created:
    - app/(app)/(tabs)/club.tsx
    - app/(app)/club/[clubId].tsx
  modified:
    - app/(app)/(tabs)/_layout.tsx
    - app/(app)/_layout.tsx
    - app/(app)/player/[licence].tsx

key-decisions:
  - "Club tab fetches user's own club ID via getPlayerProfile(session.licence) in useEffect — lightweight, reuses existing API function without new hook"
  - "Tappable club name in player profile is blue+underlined only when both nomClub and club fields present; degrades gracefully to plain text otherwise"
  - "Club tab search mode replaces the whole screen (not modal) for simplicity — cancel button returns to leaderboard view"
  - "club/[clubId] stack route is self-contained (no search) — targeted view for deep navigation from player profiles"

patterns-established:
  - "Dual-mode screen pattern: single component with boolean mode flag switching between leaderboard and search views"
  - "Row highlighting: backgroundColor eff6ff + borderLeftWidth 3 + borderLeftColor 2563eb for current user's row"
  - "Conditional tappable link: Pressable with text style combining base + link styles when navigation target available"

requirements-completed: [RANK-04]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 6 Plan 02: Club UI Layer Summary

**Club tab with leaderboard, search mode, and full navigation graph: tab bar -> club, player profile -> club/[clubId] -> player profile**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T06:45:23Z
- **Completed:** 2026-02-20T06:48:11Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Club tab screen with leaderboard (user's own club by default), search mode for browsing other clubs, pull-to-refresh, and highlighted user row
- Club stack route for deep navigation from player profiles — same leaderboard UI without search
- Full navigation graph wired: tab bar Club tab, player profile club link -> club/[clubId], leaderboard rows -> player/[licence]

## Task Commits

1. **Task 1: Create Club tab screen and club stack route** - `5f865ff` (feat)
2. **Task 2: Wire navigation — tab layout, app layout, player profile club link** - `f3b5a5d` (feat)

**Plan metadata:** (docs commit — next)

## Files Created/Modified
- `app/(app)/(tabs)/club.tsx` - Club tab screen: leaderboard view with user-row highlighting, inline search mode, pull-to-refresh, no-club empty state
- `app/(app)/club/[clubId].tsx` - Club stack route: targeted leaderboard without search, identical row layout and highlighting
- `app/(app)/(tabs)/_layout.tsx` - Added Club tab after Search (tab order: Home | Matches | Search | Club | Settings)
- `app/(app)/_layout.tsx` - Registered club/[clubId] stack screen with translated header title
- `app/(app)/player/[licence].tsx` - Made club name tappable (blue + underline) when club ID present, navigates to club/[clubId]

## Decisions Made
- Club tab fetches user's own club ID via `getPlayerProfile(session.licence)` in `useEffect` — reuses existing API function, no new hook needed
- Tappable club name degrades gracefully: only shown as link when both `nomClub` and `club` fields are present (fallback to plain text)
- Search mode replaces the whole screen rather than using a modal — simpler, consistent with search.tsx pattern
- `club/[clubId].tsx` is intentionally self-contained (no search) — it is a targeted deep-link destination, not a browsing surface

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RANK-04 requirement fully complete: club leaderboard accessible from tab bar and player profiles
- Phase 6 (Club Features) complete — all plans executed
- Ready for Phase 7 (next phase per roadmap)

## Self-Check: PASSED

- app/(app)/(tabs)/club.tsx: FOUND
- app/(app)/club/[clubId].tsx: FOUND
- 06-02-SUMMARY.md: FOUND
- Commit 5f865ff: FOUND
- Commit f3b5a5d: FOUND

---
*Phase: 06-club-features*
*Completed: 2026-02-20*
