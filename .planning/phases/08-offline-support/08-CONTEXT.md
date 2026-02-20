# Phase 8: Offline Support - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Local caching for performance and offline access to previously loaded data. Clear indicator when displaying cached data. Auto-refresh when connectivity returns. No background sync, no push notifications, no server-side cache invalidation.

</domain>

<decisions>
## Implementation Decisions

### What gets cached
- User's own data: dashboard (profile, stats), match history, ranking evolution chart data
- User's own club leaderboard
- Bookmarked players' profiles and rankings
- NOT cached: non-bookmarked player profiles, other clubs' leaderboards, search results

### Staleness & refresh
- Auto-refresh on app open (foreground) if online — show cached immediately, update silently in background
- No "last updated" timestamp displayed on screens
- Auto-refresh silently when connectivity returns (no user prompt)
- Pull-to-refresh still works as before (overrides cache with fresh data)

### Offline indicators
- Subtle colored status bar below header when offline (e.g., orange bar, minimal text)
- Auto-dismiss immediately when back online (no "back online" transition)
- Non-cached data (e.g., non-bookmarked player profile) shows error screen: "You're offline and this data isn't available" with retry option
- Search disabled when offline: "Search requires an internet connection"

### Cache lifecycle
- Cache cleared on logout (clean slate for next login)
- "Clear cache" button in Settings with confirmation
- No auto-expiry — cache persists until manually cleared or logout
- Bookmarks list NOT cleared by cache clear (bookmarks are device-tied, separate storage per Phase 7)

### Claude's Discretion
- Cache storage mechanism (AsyncStorage keys structure, or a cache layer abstraction)
- Connectivity detection approach (NetInfo or similar)
- Exact offline bar styling and animation
- How to structure the cache-first-then-fetch pattern across existing hooks

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

*Phase: 08-offline-support*
*Context gathered: 2026-02-20*
