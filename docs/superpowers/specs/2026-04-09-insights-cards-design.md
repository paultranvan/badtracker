# Insights Cards — Design Spec

## Overview

Add an "Insights" section to the Home page (below Recent Matches) that surfaces interesting stats computed from the player's all-time (Decade) match history. The section uses a mixed layout: a 2-column grid for compact stat cards and full-width cards for player/tournament-based insights.

## Insights

### Grid Cards (2-column)

| Card | Display | Computation | Data Source |
|---|---|---|---|
| **Longest Streak** | Streak count + fire emoji | Walk all matches chronologically, track max consecutive `isWin === true` | Match details (Decade) |
| **Recent Form** | Last 5 W/L as colored circles | Take last 5 matches sorted by date descending | Match details (Decade) |
| **Biggest Upset** | Opponent rank + player rank at time | Compare player rank vs opponent rank from detail data, find largest gap where player won | Match details with rank info (see note below) |
| **CPPH Momentum** | Sum of recent pointsImpact with arrow | Sum `pointsImpact` over last 10 validated matches | Match details (Decade) |
| **Discipline Balance** | Stacked bar (S/D/M) with counts | Count matches by `discipline` field | Match details (Decade) |

Discipline Balance spans both columns (full width within the grid).

### Full-Width Cards

| Card | Display | Computation | Data Source |
|---|---|---|---|
| **Best Tournament** | Tournament name + W/L + win% | Group by tournament name, compute W/L, pick highest win% (min 3 matches) | Match details (Decade) |
| **Best Partner** | Partner name + match count + win% | Group by `partnerLicence`, compute win rate, pick best (min 3 matches) | Match details (Decade) |
| **Nemesis** | Opponent name + loss record | Group by `opponentLicence`, count losses, pick most losses (min 2) | Match details (Decade) |
| **Most Played** | Opponent name + match count + last date | Pick opponent with highest `MatchCount` | Opponent list API |

## Architecture

### Files

- **`src/utils/insights.ts`** — Pure computation functions. Each insight is a standalone function. A top-level `computeAllInsights()` calls them all and returns an `InsightsData` object.
- **`src/hooks/useInsights.ts`** — Hook that takes personId + all detail matches + isSettled flag. When settled, computes insights. Also fetches `opponentList` for "Most Played". Memoizes the result.
- **`src/components/InsightsSection.tsx`** — Renders the grid + full-width card layout. Takes `InsightsData | null` as prop. Shows skeleton loading state when null.

### Data Flow

```
Dashboard mounts
  → useDashboardData() fetches profile + match brackets
    → auto-loads all match details in background (existing behavior)
  → useInsights(personId, allDetailMatches, isSettled)
    → when isSettled: computeAllInsights(matches)
    → fetches opponentList (10min cache)
    → returns InsightsData
  → <InsightsSection data={insightsData} />
```

### Types

```typescript
interface InsightsData {
  winStreak: { count: number } | null;
  recentForm: { results: boolean[] } | null; // last 5, true=win
  biggestUpset: {
    opponentRank: string;
    playerRank: string;
    opponentName: string;
    tournament: string;
    date: string;
  } | null;
  cpphMomentum: { total: number; matchCount: number } | null;
  disciplineBalance: {
    simple: number;
    double: number;
    mixte: number;
  } | null;
  bestTournament: {
    name: string;
    wins: number;
    losses: number;
    winRate: number;
  } | null;
  bestPartner: {
    name: string;
    matchCount: number;
    winRate: number;
  } | null;
  nemesis: {
    name: string;
    wins: number;
    losses: number;
  } | null;
  mostPlayed: {
    name: string;
    matchCount: number;
    lastDate: string;
  } | null;
}
```

### Biggest Upset — Rank Data

The `/result/detail` API returns `RankingSubLevel` per person in the `top.Persons` / `bottom.Persons` objects, but `expandBracketDetails()` in `ffbad.ts` does not currently extract it into `MatchItem`. Implementation must:

1. Extract `_detailOpponentRank` (and `_detailPlayerRank`) from the raw person entries during detail expansion
2. Map these through to `MatchItem` as `opponentRank` / `playerRank` fields
3. Use the rank hierarchy (N1 > N2 > ... > P12 > NC) to compute the "gap"

If rank data is missing from a match detail (some older entries may lack it), skip that match for upset computation.

### Thresholds

- Best tournament: minimum 3 matches at that tournament
- Best partner: minimum 3 matches together
- Nemesis: minimum 2 losses to same opponent
- CPPH momentum: last 10 validated matches (with non-null `pointsImpact`)
- Recent form: last 5 matches with known `isWin`

### Edge Cases

- **No match details yet (loading):** Show skeleton placeholders (animated gray rectangles)
- **Insight unavailable (not enough data):** Card is simply not rendered — no empty state per card
- **No insights at all:** Hide the entire section
- **Long names:** Truncate with ellipsis (single line)
- **No doubles/mixed played:** No "Best Partner" card
- **No losses:** No "Nemesis" card
- **Negative CPPH momentum:** Show red down arrow instead of green up arrow

## UI Design

### Layout

The section appears below "Recent Matches" with a `SectionHeader` ("Insights").

**Grid (2 columns):**
- Win Streak (left), Recent Form (right)
- Biggest Upset (left), CPPH Momentum (right)
- Discipline Balance (spans both columns)

**Full-width stack:**
- Best Tournament
- Best Partner
- Nemesis
- Most Played Opponent

### Card Styling

**Grid cards:** Centered text, icon/emoji at top, main value large and bold, subtitle small and muted. White background, subtle shadow, 10px border radius.

**Full-width cards:** Left-aligned with a 44x44 colored icon container (rounded square with emoji), title as uppercase caption, name/value bold, subtitle with stats. Same card styling as grid.

**Icon backgrounds:**
- Best Tournament: `#fef3c7` (warm yellow)
- Best Partner: `#dbeafe` (light blue)
- Nemesis: `#fee2e2` (light red)
- Most Played: `#f0fdf4` (light green)

### Loading State

When `data` is null (details still loading), render 2 skeleton rectangles in the grid area with a pulse animation. No text, just the placeholder shapes.

## i18n

All labels will use translation keys under `insights.*` namespace:
- `insights.title`, `insights.longestStreak`, `insights.recentForm`, `insights.biggestUpset`, `insights.cpphMomentum`, `insights.disciplineBalance`, `insights.bestTournament`, `insights.bestPartner`, `insights.nemesis`, `insights.mostPlayed`
- Plus sub-labels: `insights.consecutiveWins`, `insights.lastNMatches`, `insights.matches`, `insights.winRate`, `insights.lostXofY`, etc.
