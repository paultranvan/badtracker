# Phase 2: Player Discovery - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can search for any FFBaD player by name or license number and view their profile showing name, club, and current rankings by discipline. Tapping an opponent in match history navigates to their profile. Bookmarking players is a separate phase (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Search experience
- Single search bar that handles both name and license number queries (auto-detect based on input)
- Live search with debounce — results update as user types, no submit button
- Minimum 3 characters before search fires (avoids noisy API calls)
- Empty results: simple "No players found" message, no extra guidance

### Claude's Discretion
- Results display: layout, information density per result, ordering, number of results shown
- Player profile screen: layout, sections, how ranking data is organized by discipline
- Navigation flow: how search is accessed, transitions between results and profiles, back navigation
- Loading states and error handling during search and profile loading

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for results display, profile layout, and navigation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-player-discovery*
*Context gathered: 2026-02-17*
