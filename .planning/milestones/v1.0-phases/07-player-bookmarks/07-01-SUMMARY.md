---
phase: 07-player-bookmarks
plan: 01
subsystem: ui
tags: [react-native, asyncstorage, context, i18n, toast]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AsyncStorage already installed, i18n infrastructure in place
  - phase: 06-club-features
    provides: fire-and-forget AsyncStorage pattern established in useClubSearch
provides:
  - BookmarkedPlayer type with licence, nom, prenom, rankings, bookmarkedAt
  - AsyncStorage persistence layer for bookmarks (badtracker_bookmarks key)
  - BookmarksProvider context with add/remove/isBookmarked/updateStoredRankings
  - useBookmarks hook for consuming bookmark state in any component
  - Toast component mounted at root for imperative feedback calls
  - FR and EN i18n strings for all bookmark UI labels
affects: [07-02-player-bookmarks-ui]

# Tech tracking
tech-stack:
  added: [react-native-toast-message@2.3.3]
  patterns:
    - fire-and-forget AsyncStorage persist (saveBookmarks called without await in callbacks)
    - device-tied persistence (bookmarks survive logout, not tied to account)
    - createContext/useContext pattern matching SessionProvider

key-files:
  created:
    - src/bookmarks/storage.ts
    - src/bookmarks/context.tsx
  modified:
    - app/_layout.tsx
    - src/i18n/locales/fr.json
    - src/i18n/locales/en.json
    - package.json

key-decisions:
  - "react-native-toast-message installed with --legacy-peer-deps to resolve peer dependency conflicts"
  - "Bookmarks persist across logout (device-tied, not account-tied) per prior user decision"

patterns-established:
  - "BookmarksProvider pattern: createContext null, useContext guard with throw, useState + useEffect load on mount, useCallback for all mutations"
  - "Fire-and-forget saveBookmarks: called inside setState updater function, no await needed"

requirements-completed:
  - PLYR-05
  - PLYR-07

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 7 Plan 01: Bookmark Data Layer Summary

**AsyncStorage-backed bookmark persistence with React context/hook, imperative Toast at root, and FR/EN i18n strings — complete data foundation for bookmark UI screens**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T09:14:16Z
- **Completed:** 2026-02-20T09:15:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `src/bookmarks/storage.ts` with `BookmarkedPlayer` type and three exported functions: `loadBookmarks`, `saveBookmarks`, `updateBookmarkRankings`
- Created `src/bookmarks/context.tsx` with `BookmarksProvider` and `useBookmarks` hook following the exact `SessionProvider` pattern
- Wired `BookmarksProvider` and `<Toast />` into `app/_layout.tsx` root layout
- Added `"bookmarks"` section to both FR and EN i18n locale files with all 5 required keys

## Task Commits

Each task was committed atomically:

1. **Task 1: Install toast library, create bookmark storage and context** - `d6c0981` (feat)
2. **Task 2: Wire BookmarksProvider and Toast into root layout, add i18n strings** - `8dc0632` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/bookmarks/storage.ts` - BookmarkedPlayer interface, loadBookmarks/saveBookmarks/updateBookmarkRankings
- `src/bookmarks/context.tsx` - BookmarksProvider with full state management and useBookmarks hook
- `app/_layout.tsx` - Added BookmarksProvider wrapping + Toast component at root
- `src/i18n/locales/fr.json` - Added bookmarks section (Favoris, ajout/suppression/vide/settings)
- `src/i18n/locales/en.json` - Added bookmarks section (Bookmarks, added/removed/empty/settingsRow)
- `package.json` - Added react-native-toast-message@2.3.3

## Decisions Made
- Used `--legacy-peer-deps` for toast library install due to React Native peer dependency version conflicts — library works correctly at runtime
- Bookmarks stored under device (not account): `BookmarksProvider` is placed inside `SessionProvider` for clean import tree, but loads independently of auth state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm install react-native-toast-message` failed without `--legacy-peer-deps` — peer dependency conflict with React Native version. Resolved with `--legacy-peer-deps` flag. Library functions correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete bookmark data layer ready for UI consumption in plan 07-02
- `useBookmarks()` hook available in any screen below `BookmarksProvider`
- `Toast.show()` callable imperatively from any screen for bookmark feedback
- All i18n keys ready for use in bookmark screens

---
*Phase: 07-player-bookmarks*
*Completed: 2026-02-20*
