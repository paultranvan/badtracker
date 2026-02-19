# Phase 4: Match History - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Full match history from FFBaD with discipline filters, season selection, match details, pull-to-refresh, and win/loss breakdown statistics. The dashboard (Phase 3) already shows a 3-match preview with a "Voir tous les matchs" link that navigates here. Ranking charts are Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Match list display
- Matches grouped by tournament (tournament name + date as section headers)
- Full info per match row: W/L badge (V/D), opponent name, score, discipline icon, round (e.g., "1/4 finale"), date, points gained/lost
- Tapping opponent name navigates to /player/[licence] (Phase 2 player profile)
- For doubles/mixed: show partner name ("avec Paul Dupont") alongside opponent pair
- Pull-to-refresh to update match data from FFBaD

### Discipline filtering
- Horizontal tappable chips: Tous | Simple | Double | Mixte
- Each chip shows match count: "Simple (12)" | "Double (8)" | "Mixte (3)"
- Filtering updates both the match list AND the win/loss stats section
- Season picker (dropdown/selector) to choose season: 2025-2026, 2024-2025, etc.

### Win/loss statistics
- Collapsible header that shrinks as you scroll down the match list
- Shows: win percentage + colored progress bar + total wins / total losses (e.g., "15V - 8D")
- Stats follow the active discipline filter (selecting "Double" shows doubles-only stats)
- No cross-season comparison — just current filtered stats

### Match detail view
- Tap a match row to expand inline (accordion style, no navigation)
- Expanded view shows: individual set scores (21-15, 18-21, 21-12), tournament name (tappable), points impact on CPPH ranking ("+12.5 pts" or "-3.2 pts"), match duration if available
- Tapping tournament name filters the match list to show only matches from that tournament

### Claude's Discretion
- Exact accordion animation and expand/collapse behavior
- Loading states and skeleton screens
- Error handling when match data is unavailable
- Collapsible header animation details
- How season picker is presented (dropdown, bottom sheet, etc.)
- Handling matches with missing data (no score, no tournament info)

</decisions>

<specifics>
## Specific Ideas

- Use French terminology: "V" (Victoire) and "D" (Defaite) for match results, consistent with dashboard
- Tournament grouping makes the list feel structured — badminton players think in tournaments, not individual matches
- Points impact per match is highly valued by competitive players — shows how each result moves their ranking
- Partner display for doubles is important — players want to see who they played with, not just against

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-match-history*
*Context gathered: 2026-02-19*
