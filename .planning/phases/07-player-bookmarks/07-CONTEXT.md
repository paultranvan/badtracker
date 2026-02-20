# Phase 7: Player Bookmarks - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Bookmark other players from their profile for quick access. View a list of all bookmarked players, remove bookmarks. Bookmarks persist across app restarts. No ranking change notifications, no ranking comparison, no bookmark syncing across devices.

</domain>

<decisions>
## Implementation Decisions

### Bookmark action & location
- Star icon (filled/outline toggle) in the top-right of player profile header bar
- Not shown on user's own profile
- Brief toast message on toggle: "Player bookmarked" / "Bookmark removed"
- No confirmation needed for removing — instant toggle, can always re-add

### Bookmarks list display
- Each row shows: player name + ranking for each discipline (simple, double, mixte)
- Sorted alphabetically by name
- Tapping a bookmarked player navigates to their profile (reuse /player/[licence])
- Empty state: simple "No bookmarks" message, no call to action

### Bookmark persistence
- Stored locally (AsyncStorage) — no backend sync
- Bookmarks persist even after logout (tied to device, not account)
- No limit on number of bookmarks
- No pull-to-refresh on list — rankings show stored data, update when visiting each profile

### Search integration
- Small star icon shown next to already-bookmarked players in search results
- No bookmark indicators on dashboard

### Claude's Discretion
- Where the bookmarks list lives in navigation (dedicated tab vs sub-screen — note: already 5 tabs: Home, Matches, Search, Club, Settings)
- Toast implementation approach
- Exact row layout and spacing for bookmark list items

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-player-bookmarks*
*Context gathered: 2026-02-20*
