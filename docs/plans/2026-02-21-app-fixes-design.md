# App Fixes Design — 2026-02-21

Four fixes across different screens: ranking chart, upper rank points, match history, and club leaderboard.

## 1. Ranking Evolution Chart

**Problem:** Chart shows CPPH points over time. Users want ranking position evolution.

**Solution:** Step chart with discrete rank levels on Y-axis.

- Y-axis: rank names (NC=0, P12=1, P11=2 ... N1=12) instead of CPPH
- Step interpolation: flat lines between data points, vertical jumps at rank changes
- Three discipline lines: Blue=Simple, Green=Double, Amber=Mixte (unchanged)
- Toggle disciplines on/off via legend (unchanged)
- Tooltip on tap shows rank name + date
- Y-axis range: only show ranks in player's data range, +1 rank padding above/below
- Data source: same `getRankingEvolution` API, use `Classement` field instead of `CPPH`

**Rank-to-number mapping:**

| Rank | Value | Rank | Value |
|------|-------|------|-------|
| N1   | 12    | D7   | 6     |
| N2   | 11    | D8   | 5     |
| N3   | 10    | D9   | 4     |
| R4   | 9     | P10  | 3     |
| R5   | 8     | P11  | 2     |
| R6   | 7     | P12  | 1     |
|      |       | NC   | 0     |

**Files to modify:**
- `src/utils/rankingChart.ts` — transform to rank values instead of CPPH
- `app/(app)/ranking-chart.tsx` — update chart config (Y-axis labels, step mode, tooltips)

## 2. Points Required for Upper Rank

**Problem:** Hardcoded `RANK_BOUNDARIES` thresholds are approximate/stale, and CPPH data pipeline may have mapping issues.

**Solution:**
1. Look up official FFBaD rank thresholds and update `RANK_BOUNDARIES` in `src/utils/rankings.ts`
2. Verify CPPH values from API are correctly mapped through the pipeline (`ffbad.ts` → hooks → dashboard)
3. Add defensive handling for missing/unexpected rank or CPPH values

**Files to modify:**
- `src/utils/rankings.ts` — update `RANK_BOUNDARIES` with correct FFBaD values
- `src/api/ffbad.ts` — verify `simpleRate`/`doubleRate`/`mixteRate` mapping

## 3. Match History — Competition-grouped cards

**Problem:** Match details (players, set scores) exist in API data but aren't fully displayed. Current UI uses expandable accordions.

**Solution:** Show full match details inline, grouped by competition.

**Layout per competition section:**
```
=== Tournament Name (DD/MM/YYYY) ================

[D] Double Hommes - 1/4 finale              [V]
  Paul D. + Marc L.
  vs Julien R. + Thomas B.
  21-15  18-21  21-17                    +43pts

[S] Simple Hommes - 1/2 finale              [D]
  Paul D.
  vs Antoine M.
  15-21  21-18  14-21                    -28pts
```

**Details:**
- Remove accordion — all details visible inline
- Competition = section header (tournament name + date)
- Each match card: discipline badge, round, result badge, player names, set scores, points
- Opponent names tappable (navigate to player profile)
- Keep existing: discipline filter chips, season selector, stats header

**Files to modify:**
- `app/(app)/(tabs)/matches.tsx` — refactor match card rendering

## 4. Club Leaderboard — Discipline filtering

**Problem:** API returns per-discipline rankings but app collapses to single "best rank". No discipline filtering.

**Solution:** Preserve per-discipline data, add filter chips.

**Filter chips:** `[All] [Simple] [Double] [Mixte]`
- "All" = sort by best rank across all disciplines (current behavior)
- Discipline filter = show + sort by that discipline's ranking
- NC players sink to bottom in filtered views

**Data model change — `LeaderboardEntry` gains:**
- `simpleRank`, `simpleCpph`
- `doubleRank`, `doubleCpph`
- `mixteRank`, `mixteCpph`

**Files to modify:**
- `src/utils/clubLeaderboard.ts` — preserve per-discipline data in normalization
- `app/(app)/(tabs)/club.tsx` — add filter chips, render discipline-specific rankings
- `app/(app)/club/[clubId].tsx` — same filter chips if applicable
