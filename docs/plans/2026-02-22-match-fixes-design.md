# Match History Fixes — Design Document

## Problem Statement

Four issues in the match history tab after the two-level accordion was restored:

1. **Mixed discipline shown as Double** — API returns "DOUBLE HOMMES" for mixed doubles brackets. `mapDisciplineCode()` checks `includes('DOUBLE')` before `includes('MIXTE')`, so mixed never matches.
2. **Incorrect match counts** — `DisciplineGroup.wins/losses` are computed at grouping time from bracket-level items (1 item per bracket). After expansion via `loadDetails()`, the actual individual matches are available but counts aren't recomputed.
3. **Duplicated matches** — `loadDetails()` filters `rawResultItems` by tournament name + discipline, but multiple raw items can share the same bracket. `getMatchDetailsForBrackets()` expands each independently, producing duplicates.
4. **Match card UI too verbose** — Cards take too much vertical space and don't match the compact layout users expect from myffbad.fr.

## Design

### Section 1: Discipline Re-classification

**Where:** `src/api/ffbad.ts` — `expandWithDetail()`

After expanding a bracket into individual matches via the detail API, detect actual discipline from player data:
- If opponents include mixed-gender pairs (one male, one female name pattern), classify as `mixte`
- Add `_detailDiscipline` field to each expanded match item

**Where:** `src/api/ffbad.ts` — `transformResultItem()`

Prefer `_detailDiscipline` over the raw `Discipline` field when present.

**Fallback:** If gender detection is unreliable, use the detail API's own discipline field if it differs from the bracket-level classification.

### Section 2: Win/Loss Count After Expansion

**Where:** `app/(app)/(tabs)/matches.tsx` — `DisciplineRow` component

Don't rely on static `disc.wins`/`disc.losses` from `DisciplineGroup`. Instead, compute on-the-fly:
- If `detailCache` has data for this tournament+discipline key, count wins/losses from cached detailed matches
- Otherwise, fall back to `disc.wins`/`disc.losses` (bracket-level counts)

This avoids modifying the grouping utility and keeps the fix localized to the UI layer.

### Section 3: Match De-duplication

**Where:** `src/hooks/useMatchHistory.ts` — `loadDetails()`

After filtering raw items for a tournament+discipline, deduplicate by composite key: `date + bracketId + disciplineId`. This prevents the same bracket from being expanded multiple times.

### Section 4: Compact Match Card

**Where:** `app/(app)/(tabs)/matches.tsx` — `MatchCard` component

myffbad.fr-inspired compact layout:

```
┌─green/red border─────────────────────────────────┐
│                                        ~+20.0pts │
│  D8  Partner Name  /  User Name    21  21        │
│  D9  Opponent1  /  Opponent2       17  18     👍 │
│                                       45min      │
└──────────────────────────────────────────────────┘
```

Key elements:
- **Two rows** stacked: user's team on top, opponents on bottom
- **Winner row in bold** (not always the user — bold tracks who won)
- **Win/loss indicator:** 👍 (green) for win, 👎 (red) for loss — replaces W/L badge
- **Rank badges** (D8, D9) before player names in muted pill style
- **Club name** after player name in muted smaller text
- **Scores right-aligned**, one column per set
- **Points** top-right with `~` prefix, green (positive) / red (negative) colored
- **Duration** bottom-right if available, muted text
- **Left border strip** green (win) / red (loss)
- **Current user marker** (small dot) next to user's name
- **No heavy container** — just a subtle bottom separator between cards

For singles: user's team row shows just the user (no partner). For doubles/mixed: shows "Partner / User".

## Files to Modify

1. `src/api/ffbad.ts` — Discipline re-classification in `expandWithDetail()` and `transformResultItem()`
2. `src/hooks/useMatchHistory.ts` — De-duplication in `loadDetails()`
3. `src/utils/matchHistory.ts` — Potentially add dedup helper
4. `app/(app)/(tabs)/matches.tsx` — Dynamic win/loss counts in `DisciplineRow`, compact `MatchCard` redesign
