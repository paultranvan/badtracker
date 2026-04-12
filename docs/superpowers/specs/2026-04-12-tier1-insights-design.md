# Tier 1 Insights: Ranking Projection, Season Comparison, Activity Calendar

**Date:** 2026-04-12
**Status:** Draft

## Overview

Add three new insight types to the existing Insights section on the dashboard. They follow the same pattern as the current 10 insights: computed in `src/utils/insights.ts`, returned as nullable fields in `InsightsData`, rendered as cards in `InsightsSection`, and tappable to a detail screen. Each insight returns `null` (and is not displayed) when there is insufficient data.

---

## 1. Ranking Projection

**What it shows:** How close the player is to reaching the next rank, and roughly how many wins it would take.

**Card appearance:**
- Grid card (same row as winStreak/recentForm)
- Icon: `🎯`
- Title: "Prochain classement" / "Next rank"
- Body: e.g. "D7 — ~3 victoires" (the next rank + estimated wins to get there)
- Subtitle: "+1.8 CPPH restants" (the gap)

**Data sources:**
- `PlayerProfile.rankings` (current CPPH per discipline) — already available via `useDashboardData`
- `RankingLevel[]` from `useRankingLevels()` — already provided via `RankingLevelsProvider`
- `allDetailMatches` — for computing average CPPH gain per win

**Computation (`computeRankingProjection`):**

```
Input: profile.rankings, rankingLevels, allDetailMatches
Output: { discipline, currentRank, nextRank, gap, avgPointsPerWin, estimatedWins } | null

1. For each discipline (simple, double, mixte):
   a. Get current CPPH and rank from profile.rankings
   b. Use getRankProgress() to find pointsToNext
   c. If pointsToNext is null or 0, skip (already at top or no data)
   d. Compute avgPointsPerWin: from allDetailMatches filtered to this discipline,
      take only wins with pointsImpact > 0, average the pointsImpact
   e. estimatedWins = ceil(pointsToNext / avgPointsPerWin)

2. Pick the discipline with the smallest gap (closest to ranking up) — most motivating

3. Return null if:
   - No rankings data at all
   - RankingLevels not loaded
   - pointsToNext is null for all disciplines
   - Fewer than 3 wins with points data (can't estimate avgPointsPerWin reliably)
```

**Minimum thresholds:**
- Ranking levels must be loaded
- At least one discipline with a next rank (not already N1)
- At least 3 wins with positive pointsImpact in the selected discipline (for estimation)

**Detail screen (tap):**
- Show all 3 disciplines with projections (or "Already top rank" / "Not enough data")
- Per discipline: current rank, CPPH, next rank threshold, gap, avg points per win, estimated wins
- List the wins used for the average calculation

**i18n keys:**
- `insights.rankingProjection` — "Prochain classement" / "Next rank"
- `insights.rankingProjectionGap` — "+{{gap}} CPPH restants" / "+{{gap}} CPPH to go"
- `insights.rankingProjectionWins` — "~{{count}} victoires" / "~{{count}} wins"
- `insights.rankingProjectionTop` — "Meilleur classement atteint" / "Top rank reached"
- `insights.rankingProjectionDetail` — detail screen labels

---

## 2. Season Comparison

**What it shows:** How this season compares to last season — win rate, matches played, CPPH change.

**Card appearance:**
- Grid card (same row as rankingProjection or biggestUpset/cpphMomentum)
- Icon: `📈` (ahead) or `📉` (behind)
- Title: "vs Saison dernière" / "vs Last season"
- Body: e.g. "+12% victoires" (biggest positive delta) or "-5% victoires" (if behind)
- Subtitle: "18 matchs vs 14" (match count comparison)

**Data sources:**
- `allDetailMatches` with `_rawDate` — already available, filtered by season dates
- No new API call needed: `getResultsByLicence` already fetches "Decade" (10 years of data), so both current and previous season matches are already loaded

**Computation (`computeSeasonComparison`):**

```
Input: allDetailMatches (date-desc sorted, all from Decade)
Output: { 
  currentWinRate, lastWinRate, winRateDelta,
  currentMatchCount, lastMatchCount,
  currentCpphChange, lastCpphChange, cpphDelta,
  isBetter (boolean — overall ahead or behind)
} | null

1. Determine season boundaries:
   - FFBaD seasons run September 1 — August 31
   - Current season start: Sept 1 of the relevant year
     (if today is Apr 2026 → current season = 2025-09-01 to 2026-08-31)
   - Last season: the 12 months before current season start

2. Split allDetailMatches by _rawDate into currentSeason and lastSeason arrays

3. For "same point in season" comparison:
   - Compute dayOfSeason = days since Sept 1 of the current season
   - Filter lastSeason matches to only those within the first dayOfSeason days
     (so we compare apples to apples — not a partial season vs a full season)

4. Compute per bucket:
   - winRate: wins / known results * 100
   - matchCount: total matches
   - cpphChange: sum of all pointsImpact

5. isBetter = winRateDelta >= 0

6. Return null if:
   - Fewer than 5 matches in current season (not enough data yet)
   - Fewer than 5 matches in the comparable window of last season
```

**Minimum thresholds:**
- At least 5 matches in current season
- At least 5 matches in the same date window of last season

**Detail screen (tap):**
- Side-by-side table: this season vs last season (at same point)
- Rows: Win rate, Matches played, Net CPPH change
- Per-discipline breakdown if enough data (3+ matches per discipline per season)
- Green/red coloring for better/worse

**i18n keys:**
- `insights.seasonComparison` — "vs Saison dernière" / "vs Last season"
- `insights.seasonAhead` — "En avance" / "Ahead"
- `insights.seasonBehind` — "En retard" / "Behind"
- `insights.seasonWinRateDelta` — "+{{delta}}% victoires" / "+{{delta}}% win rate"
- `insights.seasonMatchCount` — "{{current}} vs {{last}} matchs"
- `insights.seasonCpphDelta` — "+{{delta}} CPPH"

---

## 3. Activity Calendar

**What it shows:** Tournament participation streak and activity pattern over the past 12 months.

**Card appearance:**
- Grid card (paired with season comparison or ranking projection)
- Icon: `📅`
- Title: "Activité" / "Activity"
- Body: "3 mois consécutifs" (active streak) or "2 mois sans tournoi" (gap)
- Subtitle: mini 6-block row showing last 6 months as colored squares (green shades by intensity, gray for zero)

**Data sources:**
- `allDetailMatches` with `_rawDate` — already available
- No new API call needed

**Computation (`computeActivityCalendar`):**

```
Input: allDetailMatches
Output: {
  months: Array<{ month: string, year: number, tournamentCount: number }> (last 12),
  activeStreak: number (consecutive months with >= 1 tournament, ending at current/last active month),
  inactiveMonths: number (months since last tournament, 0 if played this month),
  isActive: boolean (played in current or previous month)
} | null

1. Group matches by year-month from _rawDate
2. Count distinct tournaments per month (by tournament name, not match count)
3. Build the 12-month window (current month back to 11 months ago)
4. Compute activeStreak: walk backward from the most recent active month,
   count consecutive months with tournamentCount > 0
5. Compute inactiveMonths: months since the most recent active month

6. Return null if:
   - Fewer than 3 total matches (not enough history)
   - No matches in the last 12 months
```

**Minimum thresholds:**
- At least 3 matches total
- At least 1 match in the last 12 months

**Card body logic:**
- If `activeStreak >= 2`: show streak message ("3 mois consécutifs")
- Else if `inactiveMonths >= 2`: show gap message ("2 mois sans tournoi")
- Else: show tournament count for current month or total last 3 months

**Mini heatmap on card:**
- 6 small squares (last 6 months, right = most recent)
- Color intensity: 0 tournaments = gray, 1 = light green, 2+ = darker green
- Simple View with fixed-size colored squares, no interactivity on the card itself

**Detail screen (tap):**
- Full 12-month grid (one row per month, newest at top)
- Per month: month name, tournament count, tournament names listed
- Current streak highlighted
- Total tournaments in 12 months

**i18n keys:**
- `insights.activityCalendar` — "Activité" / "Activity"
- `insights.activeStreak` — "{{count}} mois consécutifs" / "{{count}} months in a row"
- `insights.inactiveGap` — "{{count}} mois sans tournoi" / "{{count}} months without tournament"
- `insights.tournamentsThisMonth` — "{{count}} tournoi(s) ce mois" / "{{count}} tournament(s) this month"

---

## Integration Points

### `src/utils/insights.ts`

- Add 3 new fields to `InsightsData`: `rankingProjection`, `seasonComparison`, `activityCalendar`
- Add 3 new `compute*` functions
- Add 3 new entries to `InsightType` union and `INSIGHT_TYPES` array
- Add 3 new cases to `getMatchesForInsight`
- `computeRankingProjection` needs extra params: `rankings`, `rankingLevels`
- `computeAllInsights` signature expands to accept `rankings` and `rankingLevels`

### `src/hooks/useInsights.ts`

- Import `useRankingLevels` and `useSession` (for profile rankings)
- Pass `rankings` and `rankingLevels` to `computeAllInsights`
- The hook already receives `allDetailMatches` — no new data fetching needed

### `src/components/InsightsSection.tsx`

- Add 3 new card components: `RankingProjectionCard`, `SeasonComparisonCard`, `ActivityCalendarCard`
- Place them in the grid layout:
  - Row 1: winStreak + recentForm (existing)
  - Row 2: biggestUpset + cpphMomentum (existing)
  - Row 3: rankingProjection + seasonComparison (new)
  - Row 4: activityCalendar (new, or paired with another if available)
- Each wrapped in `InsightPressable` for navigation to detail screen

### `app/(app)/insight-matches/[type].tsx`

- Add rendering for the 3 new insight types
- `rankingProjection`: show per-discipline table, not a match list
- `seasonComparison`: show side-by-side comparison table + per-discipline breakdown
- `activityCalendar`: show 12-month grid with tournament names

### i18n

- Add all new keys to both `fr.json` and `en.json`

---

## Layout Rules

- New insight cards follow the same `GridRow` 2x2 layout as existing cards
- If only one card in a row has data, it still fills half the row (existing `GridRow` behavior handles this via `flex: 1` with an empty sibling)
- The `hasAny` check in `InsightsSection` must include the 3 new fields
- The overall order of insights remains: grid cards first (small cards), then full-width cards

---

## What Is NOT In Scope

- Interactive "what if" calculator (future enhancement)
- Fetching previous season data via separate API call (Decade data already covers it)
- New API endpoints
- Changes to the tab bar or navigation structure
- Changes to existing insight cards
