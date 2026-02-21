---
phase: 02-player-discovery
plan: 02
subsystem: ui
tags: [react-native, expo-router, dynamic-routes, player-profile, rankings, zod]

requires:
  - phase: 02-player-discovery
    provides: Search screen with usePlayerSearch hook (Plan 01)
  - phase: 01-foundation-security
    provides: FFBaD API client (getLicenceInfo, callFFBaD)
provides:
  - Player profile screen with dynamic route /player/[licence]
  - getPlayerProfile normalized API function
  - Enriched LicenceInfoItem schema with ranking fields
  - PlayerProfile TypeScript interface
  - FR/EN player profile translations
affects: [03-personal-dashboard, 04-match-history, 07-player-bookmarks]

tech-stack:
  added: []
  patterns: [dynamic route with useLocalSearchParams, normalized API response, ranking card component]

key-files:
  created:
    - app/(app)/player/[licence].tsx
  modified:
    - app/(app)/_layout.tsx
    - src/api/schemas.ts
    - src/api/ffbad.ts
    - src/types/ffbad.ts
    - src/i18n/locales/fr.json
    - src/i18n/locales/en.json

key-decisions:
  - "Player route outside (tabs) — renders as Stack screen, accessible from any screen"
  - "getPlayerProfile normalizes API response to clean PlayerProfile interface"
  - "Ranking fields added as optional to schema — .passthrough() captures additional unknown fields"
  - "RankingCard sub-component for reusable discipline display"

patterns-established:
  - "Dynamic route pattern: app/(app)/entity/[param].tsx with useLocalSearchParams"
  - "Normalized API function: raw response -> clean domain type"
  - "fetchProfile with cancelled flag cleanup in useCallback + useEffect"

requirements-completed: [PLYR-03, PLYR-04]

duration: 10min
completed: 2026-02-17
---

# Plan 02-02 Summary: Player Profile Screen

**Player profile with rankings by discipline via dynamic /player/[licence] route, accessible from search and future match history**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-17
- **Completed:** 2026-02-17
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Enriched LicenceInfoItem Zod schema with ClassementSimple/Double/Mixte and CPPHSimple/Double/Mixte fields
- Created getPlayerProfile function normalizing raw API response to clean PlayerProfile interface
- Player profile screen with header (name, club, licence) and ranking cards per discipline
- Dynamic route app/(app)/player/[licence].tsx outside tabs for universal access
- Stack layout updated to show header with back button on player profile
- FR/EN translations for all player profile strings

## Task Commits

1. **Task 1: Enrich API schemas for player profile data** - `88dd102` (feat)
2. **Task 2: Create player profile screen with navigation** - `838054b` (feat)

## Files Created/Modified
- `app/(app)/player/[licence].tsx` - Player profile screen with rankings, loading/error states
- `app/(app)/_layout.tsx` - Stack with explicit (tabs) and player/[licence] screen config
- `src/api/schemas.ts` - Added ClassementX and CPPHX fields to LicenceInfoItem
- `src/api/ffbad.ts` - Added PlayerProfile interface, getPlayerProfile function, helper functions
- `src/types/ffbad.ts` - Re-exports PlayerProfile type
- `src/i18n/locales/fr.json` - Added player section with 10 keys
- `src/i18n/locales/en.json` - Added player section with 10 keys

## Decisions Made
- Player route placed outside (tabs) directory so it renders as a Stack screen on top of the tab navigator. This allows navigation from any screen (search, future match history, bookmarks).
- getPlayerProfile normalizes the raw FFBaD API response (with its inconsistent field types) into a clean PlayerProfile TypeScript interface. This isolates API quirks from UI code.
- Ranking fields are optional in the Zod schema. If the FFBaD API returns them with different field names than expected, .passthrough() preserves them and the profile gracefully shows "No ranking data" instead of crashing.
- IS_ACTIF normalization handles boolean, number, and string variants.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Player discovery flow complete: search -> results -> profile with rankings
- /player/[licence] route ready for Phase 4 opponent linking (match history -> player profile)
- /player/[licence] route ready for Phase 7 bookmarks (bookmarked player -> profile)
- Ranking fields may need verification against actual FFBaD API responses at runtime

---
*Phase: 02-player-discovery*
*Completed: 2026-02-17*
