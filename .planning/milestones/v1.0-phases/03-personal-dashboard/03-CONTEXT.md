# Phase 3: Personal Dashboard - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

User sees their own ranking and quick stats on app launch. Dashboard shows current CPPH ranking per discipline, recent matches preview, and quick stats summary. Navigation links to detailed sections (match history, ranking charts). Full match history and ranking charts are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- Scrollable vertical layout with distinct cards for each section
- Quick stats summary row at the top (most prominent)
- Personalized greeting in header ("Bonjour, Paul") that adapts based on recent activity (new ranking change, recent matches, etc.)
- Pull-to-refresh to update all data from FFBaD

### Quick stats content
- Row of 2-3 key stats at the top:
  1. Best ranking across disciplines (headline stat)
  2. Matches played this season
  3. Overall win rate
- Show trend indicators (up/down arrows, +/- changes) on stats

### Ranking display
- Side-by-side cards, one per discipline (Simple, Double, Mixte)
- Each card shows: category label (e.g., P11), point value, and gap to next rank in both directions (+15 pts to P10 / -8 pts to P12)
- Unranked disciplines shown as "NC" (Non Classe) — always display all 3 cards
- Tapping a ranking card navigates to the ranking evolution chart for that discipline (placeholder/stub until Phase 5 builds it)

### Recent matches preview
- Show the last 3 matches
- Each row shows: W/L badge ("V" or "D" for Victoire/Defaite), opponent name, and score (21-15, 21-18)
- "Voir tous les matchs" link at the bottom navigating to full match history (placeholder/stub until Phase 4 builds it)

### Claude's Discretion
- Exact card styling, spacing, and typography
- Loading states and skeleton screens
- Error handling when API data is unavailable
- Order of sections below the stats row (rankings vs matches first)
- Greeting message logic (what triggers which personalized message)

</decisions>

<specifics>
## Specific Ideas

- Ranking cards should clearly show the progression gap: how many points to go up AND how many points before dropping down — this is what players check most often
- Use French badminton terminology: "V" (Victoire) and "D" (Defaite) for match results, "NC" (Non Classe) for unranked
- Greeting should feel contextual, not generic — e.g., "Bravo pour ta victoire!" after a recent win

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-personal-dashboard*
*Context gathered: 2026-02-17*
