---
phase: 08-offline-support
plan: 01
subsystem: infra
tags: [netinfo, asyncstorage, offline, connectivity, cache]

requires:
  - phase: 07-player-bookmarks
    provides: AsyncStorage bookmark storage pattern, BookmarksProvider context pattern
provides:
  - Cache utility (cacheGet, cacheSet, cacheClear, cacheClearForUser) with namespaced AsyncStorage keys
  - ConnectivityProvider context with useConnectivity hook and real-time online/offline detection
  - OfflineBar component (orange bar when offline, auto-dismisses when online)
  - FR/EN i18n strings for offline indicators and cache settings
affects: [08-offline-support]

tech-stack:
  added: [@react-native-community/netinfo]
  patterns:
    - "Cache prefix pattern: CACHE_PREFIX constant prevents key collision with bookmarks/language"
    - "ConnectivityProvider pattern: useNetInfo with null-safe isConnected (treats initial null as connected)"
    - "OfflineBar pattern: conditionally rendered orange bar based on connectivity state"

key-files:
  created:
    - src/cache/storage.ts
    - src/connectivity/context.tsx
  modified:
    - src/i18n/locales/fr.json
    - src/i18n/locales/en.json
    - app/_layout.tsx
    - package.json

key-decisions:
  - "@react-native-community/netinfo installed with --legacy-peer-deps (same peer dep conflict as Phase 7)"
  - "ConnectivityProvider is outermost provider in root layout (before SessionProvider)"
  - "OfflineBar rendered conditionally when session exists (not shown on login screen)"
  - "NetInfo null state treated as connected to prevent false offline flash on startup"

patterns-established:
  - "Cache prefix: all cache keys use 'badtracker_cache:' prefix to avoid collision with 'badtracker_bookmarks' and 'badtracker_language'"
  - "Connectivity context: useConnectivity() hook follows same pattern as useSession/useBookmarks"
  - "OfflineBar: simple conditional render (null when connected) — no animation needed"

requirements-completed: []

duration: 3min
completed: 2026-02-20
---

# Phase 8: Offline Support (Plan 01) Summary

**Cache utility + ConnectivityProvider with NetInfo + OfflineBar + FR/EN i18n for offline support infrastructure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Cache utility with namespaced AsyncStorage keys (get, set, clear, clearForUser) that preserves bookmarks/language
- ConnectivityProvider wrapping useNetInfo with safe null handling and reconnection detection
- OfflineBar component showing orange bar when offline, auto-dismissing when back online
- FR/EN i18n strings for offline indicators (noConnection, unavailable, retry, searchDisabled) and cache settings (clearCache, clearCacheConfirm, cacheCleared)

## Task Commits

1. **Task 1: Install NetInfo and create cache utility + connectivity provider** - `5fbe9cd` (feat)
2. **Task 2: Add i18n strings and wire providers into root layout** - `6184cbd` (feat)

## Files Created/Modified
- `src/cache/storage.ts` - Cache utility with cacheGet, cacheSet, cacheClear, cacheClearForUser
- `src/connectivity/context.tsx` - ConnectivityProvider, useConnectivity hook, OfflineBar component
- `src/i18n/locales/fr.json` - Added offline.* and settings.clearCache* strings
- `src/i18n/locales/en.json` - Added offline.* and settings.clearCache* strings
- `app/_layout.tsx` - Added ConnectivityProvider (outermost) + OfflineBar
- `package.json` - Added @react-native-community/netinfo dependency

## Decisions Made
- @react-native-community/netinfo installed with --legacy-peer-deps (same peer dependency conflict pattern as Phase 7's toast library)
- ConnectivityProvider placed as outermost provider, before SessionProvider — connectivity is needed regardless of auth state
- OfflineBar only rendered when session exists (not shown on login screen)
- NetInfo initial null state treated as "connected" to avoid false offline bar flash on app startup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- npm peer dependency conflict with react-dom@19.2.4 requiring react@^19.2.4 while project uses react@19.1.0 — resolved with --legacy-peer-deps flag (established pattern from Phase 7)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cache infrastructure ready for Plan 02 to integrate cache-first patterns into hooks
- ConnectivityProvider ready for hooks and screens to consume via useConnectivity()
- All i18n strings in place for Plan 02's UI additions

---
*Phase: 08-offline-support*
*Completed: 2026-02-20*
