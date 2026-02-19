# Phase 6: Club Features - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Club leaderboards showing rankings of players within a club. User can view their own club's leaderboard and browse other clubs. Pull-to-refresh to update. Club search and cross-navigation from player profiles are in scope. Advanced club stats, club comparison, or club management are not.

</domain>

<decisions>
## Implementation Decisions

### Leaderboard content
- Each player row shows: name + ranking category (P10, D7, NC, etc.)
- No CPPH score displayed — just the ranking category
- Combined view across disciplines — each player shows their best ranking
- Sorted by best ranking (N1 > R4 > P10 > D7 > NC)
- Tapping a player navigates to their profile (reuse existing /player/[licence] route)

### Club scope & access
- Default to user's own club leaderboard
- User can browse other clubs' leaderboards too
- Club search available on the Club tab (search by club name)
- Club name tappable in player profiles to navigate to that club's leaderboard
- Dedicated tab in bottom navigation for Club
- User's own row highlighted visually in their club's leaderboard

### Leaderboard display
- Numbered position indicators (#1, #2, #3...)
- Club header shows club name + total ranked member count
- Full scrollable list — show all club members, no pagination
- Pull-to-refresh to update leaderboard data

### Claude's Discretion
- Club search UX (inline vs overlay) — pick the cleanest approach
- Exact visual treatment for user's highlighted row
- Empty/edge state handling (club with few players, no ranking data, user has no club)
- Row layout and spacing details

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

*Phase: 06-club-features*
*Context gathered: 2026-02-20*
