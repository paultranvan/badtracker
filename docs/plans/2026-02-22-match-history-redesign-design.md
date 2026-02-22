# Match History Redesign — Design

## Goal

Redesign the Matches tab with a two-level accordion (Tournament → Discipline → Matches), better sorting, lazy-loaded details, caching, and sensible default filters.

## Problems Solved

1. Tournaments not sorted by date (interclubs span multiple months)
2. Matches shown by default — too much visual noise
3. No per-discipline breakdown within a tournament
4. No total points on tournament headers
5. Past years missing (using `/result/actual` which only returns ~29 current items)
6. Season filter defaults to "All" instead of current season
7. Mixed discipline filter shows 0 matches incorrectly
8. No caching — every tab visit re-fetches all detail data

## Data Model

### New types in `matchHistory.ts`

```typescript
interface TournamentSection {
  title: string;              // "CLERYBAD 10"
  date: string;               // "30/11/2025" (latest match date for interclubs)
  totalPoints: number;        // Sum of all winPoints across all disciplines
  disciplines: DisciplineGroup[];
}

interface DisciplineGroup {
  discipline: 'simple' | 'double' | 'mixte';
  wins: number;
  losses: number;
  points: number;             // Sum of winPoints for this discipline
  matches: MatchItem[];       // Detail-enriched when expanded, basic when collapsed
}
```

### Grouping logic

`groupByTournament` produces `TournamentSection[]`:
- Each tournament contains 1-3 `DisciplineGroup` entries (only disciplines the player participated in)
- Disciplines always ordered: Simple, Double, Mixed (fixed order)
- Tournaments sorted by date descending
- Interclub detection: `name` contains "Interclub" (case-insensitive)
- For interclubs, sort date = `max(all match dates in that tournament)`

## API Layer

### Switch to `/result/Decade`

Replace `/result/actual` (29 items, current season) with `/result/Decade` (71+ items, 10 years). Same response shape — date, eventId, disciplineId, discipline, name, subName, bracketId, winPoint, etc. All IDs populated.

### Lazy detail loading

Split the current flow:
1. `getResultsByLicence()` — fetches `/result/Decade`, returns raw result items (NO detail enrichment). Fast, single API call.
2. New `getMatchDetailsForBrackets(items)` — fetches `/result/detail` for a subset of items on demand (when a discipline group is expanded).

## Caching

Two-level caching using existing `src/cache/storage.ts`:

**Level 1 — Result list:** Key `results-{personId}`, TTL 5 minutes. Stores the `/result/Decade` response. Bypassed on pull-to-refresh.

**Level 2 — Match detail:** Key `detail-{personId}-{date}-{disciplineId}-{bracketId}`, TTL 24 hours. Match details never change once recorded. On discipline expand, only uncached brackets are fetched from API.

## UI Design

### Tournament Headers (collapsed by default)

```
┌──────────────────────────────────────────────────────┐
│ ▸ CLERYBAD 10          30/11/2025        +112 pts  ▾ │
└──────────────────────────────────────────────────────┘
```

- Blue left border
- Tournament name (bold, truncated)
- Date (latest for interclubs)
- Total points (green positive, red negative, grey zero)
- Chevron

### Discipline Sub-Headers (level 2, on tournament tap)

```
│ ▾ CLERYBAD 10          30/11/2025        +112 pts  ▴ │
├───────────────────────────────────────────────────────┤
│   (S) Singles       2W  0L                  +27 pts   │
│   (D) Doubles       5W  1L                  +85 pts   │
└───────────────────────────────────────────────────────┘
```

- Discipline badge (colored circle S/D/M)
- Discipline name (translated)
- W/L badges (green/red, same style as current)
- Points sum (right-aligned, colored)
- Fixed order: Singles, Doubles, Mixed
- Multiple disciplines expandable simultaneously

### Match Cards (level 3, on discipline tap)

Current compact card style: opponent name, set scores, W/L badge. Expanded card style available when section is in expanded mode.

### Filters

**Season:** Defaults to current season ("2025-2026"). "All" chip available. Season computed from today's date (Sep-Aug cycle).

**Discipline chips:** Always show all three (Singles, Doubles, Mixed). Chips with 0 matches greyed out and non-tappable. Counts update based on active season. If active discipline has 0 matches after season switch, auto-reset to "All".

**Filter interaction:** Season applies first, then discipline on top.

## Loading States

1. **Initial load:** Spinner while `/result/Decade` fetches. Tournament headers appear immediately after (no detail calls needed — winPoint is in result items).
2. **Tournament expand:** Instant — discipline rows computed from result-level data.
3. **Discipline expand:** Inline spinner while detail data fetches for that discipline's brackets. Cached expands are instant.
4. **Detail fallback:** If detail fetch fails, show compact fallback (team codes / subName, "+X pts").
5. **Pull-to-refresh:** Clears result list cache, re-fetches `/result/Decade`. Detail cache preserved.
