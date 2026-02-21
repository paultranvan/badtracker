# App Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four broken/incomplete features: ranking evolution chart, upper rank points, match history details, and club leaderboard filtering.

**Architecture:** Each fix is self-contained and modifies utility functions + their consuming screens. No API layer changes needed — the data is already available, just not displayed correctly.

**Tech Stack:** React Native (Expo SDK 54), react-native-gifted-charts, TypeScript, i18next

---

## Task 1: Ranking Chart — Switch from CPPH to Rank Levels

Convert the ranking evolution chart from continuous CPPH points to a step chart showing discrete rank levels.

**Files:**
- Modify: `src/utils/rankingChart.ts` (full rewrite of `transformEvolutionData` and types)
- Modify: `app/(app)/ranking-chart.tsx` (chart config, Y-axis labels, tooltip)
- Modify: `src/i18n/locales/fr.json` (update subtitle text)
- Modify: `src/i18n/locales/en.json` (update subtitle text)

**Step 1: Add rank-to-numeric mapping in `src/utils/rankingChart.ts`**

Add this constant and helper after the `DISCIPLINE_COLORS` constant (line 57):

```typescript
/**
 * Map rank labels to numeric values for Y-axis positioning.
 * Higher value = better rank. NC=0, P12=1, ..., N1=12.
 */
export const RANK_VALUES: Record<string, number> = {
  NC: 0,
  P12: 1,
  P11: 2,
  P10: 3,
  D9: 4,
  D8: 5,
  D7: 6,
  R6: 7,
  R5: 8,
  R4: 9,
  N3: 10,
  N2: 11,
  N1: 12,
};

/**
 * Ordered rank labels from lowest (NC) to highest (N1).
 */
export const RANK_ORDER = ['NC', 'P12', 'P11', 'P10', 'D9', 'D8', 'D7', 'R6', 'R5', 'R4', 'N3', 'N2', 'N1'];

/**
 * Convert a rank string to its numeric value. Returns 0 for unknown ranks.
 */
export function rankToValue(rank: string): number {
  return RANK_VALUES[rank.toUpperCase().trim()] ?? 0;
}
```

**Step 2: Update `ChartDataPoint.value` to use rank value instead of CPPH**

In `transformEvolutionData`, change the point construction (around line 251) from:

```typescript
const point: ChartDataPoint = {
  value: cpph,
  ...
};
```

to:

```typescript
const point: ChartDataPoint = {
  value: rankToValue(rank),
  ...
};
```

**Step 3: Update `ChartData` value bounds computation**

Replace the `maxValue`/`minValue` calculation at lines 311-313 with range based on the actual ranks in the data, plus 1 rank of padding:

```typescript
// Compute value bounds from actual rank values present
const allValues = disciplineData.flatMap((d) => d.points.map((p) => p.value));
const dataMax = allValues.length > 0 ? Math.max(...allValues) : 0;
const dataMin = allValues.length > 0 ? Math.min(...allValues.filter((v) => v > 0)) : 0;
// Add 1 rank of padding above and below, clamped to valid range
const maxValue = Math.min(dataMax + 1, 12);
const minValue = Math.max((dataMin > 0 ? dataMin : 0) - 1, 0);
```

**Step 4: Update `buildFlatLineForNC` to use rank value 0**

No change needed — it already uses `value: 0` which maps to NC.

**Step 5: Update chart screen `app/(app)/ranking-chart.tsx`**

5a. Import `RANK_ORDER, rankToValue` from rankingChart utils.

5b. Replace `chartConfig` useMemo (lines 107-121) to compute Y-axis based on rank levels:

```typescript
const chartConfig = useMemo(() => {
  if (!chartData || dataSets.length === 0) {
    return { maxValue: 12, noOfSections: 12, spacing: 40, yAxisLabelTexts: RANK_ORDER };
  }

  const maxVal = chartData.maxValue;
  const minVal = chartData.minValue;

  // Build Y-axis labels for the visible range
  const yAxisLabelTexts = RANK_ORDER.slice(minVal, maxVal + 1);
  const noOfSections = maxVal - minVal || 1;

  // Calculate spacing
  const maxPoints = Math.max(...dataSets.map((ds) => ds.data.length), 1);
  const spacing = Math.max(20, Math.min(50, 300 / maxPoints));

  return { maxValue: maxVal, noOfSections, spacing, yAxisLabelTexts, yAxisOffset: minVal };
}, [chartData, dataSets]);
```

5c. Update the `LineChart` props to use step interpolation and rank labels:

- Add `stepChart={true}` prop
- Change `maxValue` to `chartConfig.maxValue - (chartConfig.yAxisOffset ?? 0)`
- Change `noOfSections` to `chartConfig.noOfSections`
- Add `yAxisLabelTexts={chartConfig.yAxisLabelTexts}`
- In `dataSets` mapping, offset values: `value: point.value - (chartConfig.yAxisOffset ?? 0)`

5d. Update tooltip to show rank name instead of CPPH value:

```typescript
pointerLabelComponent: (items: Array<{ value: number }>) => {
  const val = (items[0]?.value ?? 0) + (chartConfig.yAxisOffset ?? 0);
  const rankLabel = RANK_ORDER[val] ?? '';
  return (
    <View style={styles.tooltipContainer}>
      <Text style={styles.tooltipText}>{rankLabel}</Text>
    </View>
  );
},
```

5e. Remove milestone badge rendering from dataSets — rank changes are now visible as step jumps. Keep the milestone dot but remove the label overlay:

In the dataSets useMemo, simplify the milestone rendering to just show a colored dot (remove `dataPointLabelComponent`, `dataPointLabelShiftY`, `dataPointLabelShiftX`).

**Step 6: Update i18n strings**

In both `fr.json` and `en.json`, update:
- `ranking.subtitle`: "Progression du classement par discipline" / "Ranking progression by discipline"

**Step 7: Commit**

```bash
git add src/utils/rankingChart.ts app/\(app\)/ranking-chart.tsx src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat: ranking chart shows rank levels instead of CPPH points"
```

---

## Task 2: Fix Points Required for Upper Rank

The new FFBaD 2025-2026 system uses **percentile-based ranks** — there are no fixed CPPH thresholds. The rank label assigned by myffbad.fr is authoritative. Since we can't compute "points to next rank" from a fixed table, we should remove `RANK_BOUNDARIES` thresholds and instead compute the gap differently: show the difference between the player's current CPPH and the minimum CPPH of the next rank level that the API provides. Since we don't have that data from a single API call, the simplest correct fix is to **remove the misleading "points to next rank" display** and instead show just the current CPPH.

**However**, looking at the code more carefully: `getRankGaps()` is called with the player's `cpph` and `classement` from the API. The boundaries are used to compute the gap. Since FFBaD now assigns ranks by percentile, the thresholds are meaningless. The safest fix is to **remove the gap display entirely** from the dashboard cards, since showing wrong numbers is worse than showing nothing.

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx` — remove the gap display lines
- Modify: `src/utils/rankings.ts` — add a comment explaining why RANK_BOUNDARIES are kept only for sort order

**Step 1: Remove gap display from dashboard**

In `app/(app)/(tabs)/index.tsx`, remove lines 163-178 (the `gaps.toNext` and `gaps.toPrev` display blocks):

Replace:
```typescript
{gaps.toNext != null && gaps.nextRank ? (
  <Text style={styles.rankingGap}>
    {t('dashboard.pointsToNext', {
      points: Math.ceil(gaps.toNext),
      rank: gaps.nextRank,
    })}
  </Text>
) : null}
{gaps.toPrev != null && gaps.prevRank ? (
  <Text style={styles.rankingGapDown}>
    {t('dashboard.pointsAbovePrev', {
      points: Math.floor(gaps.toPrev),
      rank: gaps.prevRank,
    })}
  </Text>
) : null}
```

with nothing (remove these blocks entirely).

Also remove the `getRankGaps` import and the `const gaps = getRankGaps(cpph, classement);` line inside the map.

**Step 2: Clean up unused styles**

Remove `rankingGap` and `rankingGapDown` from styles in `index.tsx`.

**Step 3: Update `src/utils/rankings.ts` comment**

Update the comment on `RANK_BOUNDARIES` (lines 29-34) to:

```typescript
/**
 * French badminton ranking hierarchy, ordered highest to lowest.
 * Used ONLY for sort order (e.g., club leaderboard). NOT for computing
 * points-to-next-rank — the 2025-2026 FFBaD system uses percentile-based
 * rank assignment, so there are no fixed CPPH thresholds.
 */
```

**Step 4: Remove `getRankGaps` export if unused elsewhere**

Check if `getRankGaps` is used anywhere else (it shouldn't be after removing from dashboard). If unused, mark it with a comment but keep it in case it becomes useful later.

**Step 5: Commit**

```bash
git add app/\(app\)/\(tabs\)/index.tsx src/utils/rankings.ts
git commit -m "fix: remove misleading points-to-next-rank (FFBaD uses percentile ranks)"
```

---

## Task 3: Match History — Inline Competition-Grouped Cards

Refactor match display from accordion rows to inline detail cards grouped by competition.

**Files:**
- Modify: `app/(app)/(tabs)/matches.tsx` — rewrite `MatchRow` component
- Modify: `src/hooks/useMatchHistory.ts` — remove accordion expand state

**Step 1: Remove expand state from hook**

In `src/hooks/useMatchHistory.ts`:
- Remove `expandedMatchId` state (line 77)
- Remove `toggleMatchExpand` callback (lines 234-237)
- Remove them from the return object and from `MatchHistoryData` interface

**Step 2: Rewrite `MatchRow` to show inline details**

In `app/(app)/(tabs)/matches.tsx`, replace the entire `MatchRow` component (lines 316-454) with a new inline card:

```typescript
interface MatchCardProps {
  match: MatchItem;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function MatchCard({ match, t }: MatchCardProps) {
  const disciplineLetter =
    match.discipline === 'simple' ? 'S'
      : match.discipline === 'double' ? 'D'
        : match.discipline === 'mixte' ? 'M'
          : '';

  const resultBadge = match.isWin === true
    ? { style: styles.badgeWin, text: t('matchHistory.victory') }
    : match.isWin === false
      ? { style: styles.badgeLoss, text: t('matchHistory.defeat') }
      : { style: styles.badgeUnknown, text: '?' };

  // Points display
  const pointsText = match.pointsImpact != null
    ? (match.pointsImpact >= 0 ? `+${match.pointsImpact.toFixed(1)}` : match.pointsImpact.toFixed(1)) + ' pts'
    : null;
  const pointsStyle = match.pointsImpact != null && match.pointsImpact >= 0
    ? styles.pointsPositive
    : styles.pointsNegative;

  // Navigate to opponent profile
  const goToOpponent = (licence: string | undefined) => {
    if (licence) router.push(`/player/${licence}`);
  };

  return (
    <View style={styles.matchCard}>
      {/* Row 1: discipline badge + round + result badge */}
      <View style={styles.matchCardHeader}>
        <View style={styles.matchCardHeaderLeft}>
          {disciplineLetter ? (
            <View style={styles.disciplineBadge}>
              <Text style={styles.disciplineBadgeText}>{disciplineLetter}</Text>
            </View>
          ) : null}
          {match.round ? (
            <Text style={styles.matchRound} numberOfLines={1}>{match.round}</Text>
          ) : null}
        </View>
        <View style={[styles.badge, resultBadge.style]}>
          <Text style={styles.badgeText}>{resultBadge.text}</Text>
        </View>
      </View>

      {/* Row 2: Players */}
      <View style={styles.matchCardPlayers}>
        {match.partner ? (
          <Text style={styles.playerText} numberOfLines={1}>
            {match.partner}
          </Text>
        ) : null}
        {match.opponent ? (
          <View style={styles.vsRow}>
            <Text style={styles.vsText}>{t('matchHistory.vs')} </Text>
            <Pressable onPress={() => goToOpponent(match.opponentLicence)}>
              <Text
                style={match.opponentLicence ? styles.opponentLink : styles.opponentText}
                numberOfLines={1}
              >
                {match.opponent}
                {match.opponent2 ? ` / ${match.opponent2}` : ''}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Row 3: Scores + points */}
      <View style={styles.matchCardFooter}>
        {match.setScores && match.setScores.length > 0 ? (
          <Text style={styles.setScoresText}>{match.setScores.join('  ')}</Text>
        ) : match.score ? (
          <Text style={styles.setScoresText}>{match.score}</Text>
        ) : null}
        {pointsText ? (
          <Text style={pointsStyle}>{pointsText}</Text>
        ) : null}
      </View>
    </View>
  );
}
```

**Step 3: Update the SectionList to use `MatchCard`**

Replace the `renderItem` prop (line 207-213) to use `MatchCard` instead of `MatchRow`:

```typescript
renderItem={({ item }) => <MatchCard match={item} t={t} />}
```

Remove the `expandedMatchId` and `toggleMatchExpand` from the hook destructuring.

**Step 4: Add new styles, remove old expand styles**

Add these new styles and remove the accordion-related styles (`expandedDetail`, `detailText`, `detailPositive`, `detailNegative`, `detailTournament`, `detailDate`):

```typescript
// Match Card
matchCard: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#f3f4f6',
},
matchCardHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
},
matchCardHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  flex: 1,
},
matchCardPlayers: {
  marginBottom: 4,
},
playerText: {
  fontSize: 14,
  color: '#374151',
  fontWeight: '500',
},
vsRow: {
  flexDirection: 'row',
  alignItems: 'center',
},
vsText: {
  fontSize: 13,
  color: '#9ca3af',
},
opponentText: {
  fontSize: 14,
  color: '#374151',
},
opponentLink: {
  fontSize: 14,
  color: '#2563eb',
  fontWeight: '500',
},
matchCardFooter: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
setScoresText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#111',
  fontVariant: ['tabular-nums'],
},
pointsPositive: {
  fontSize: 13,
  fontWeight: '600',
  color: '#16a34a',
},
pointsNegative: {
  fontSize: 13,
  fontWeight: '600',
  color: '#dc2626',
},
```

**Step 5: Commit**

```bash
git add app/\(app\)/\(tabs\)/matches.tsx src/hooks/useMatchHistory.ts
git commit -m "feat: match history shows inline details with competition grouping"
```

---

## Task 4: Club Leaderboard — Per-Discipline Filtering

Add discipline filter chips and show discipline-specific rankings.

**Files:**
- Modify: `src/utils/clubLeaderboard.ts` — extend `LeaderboardEntry`, add filter/sort logic
- Modify: `app/(app)/(tabs)/club.tsx` — add filter chips, update row rendering
- Modify: `src/i18n/locales/fr.json` — add filter labels
- Modify: `src/i18n/locales/en.json` — add filter labels

**Step 1: Extend `LeaderboardEntry` type**

In `src/utils/clubLeaderboard.ts`, update the interface (lines 11-19):

```typescript
export interface LeaderboardEntry {
  licence: string;
  nom: string;
  prenom: string;
  bestRank: string;
  position: number;
  simpleRank: string;
  simpleCpph?: number;
  doubleRank: string;
  doubleCpph?: number;
  mixteRank: string;
  mixteCpph?: number;
}
```

**Step 2: Update `normalizeToLeaderboard` to preserve per-discipline data**

In the `.map()` callback (lines 80-111), add the per-discipline fields:

```typescript
.map((item) => {
  const rankings = {
    simple: buildRanking(
      item.ClassementSimple as string | undefined,
      item.CPPHSimple as string | number | undefined
    ),
    double: buildRanking(
      item.ClassementDouble as string | undefined,
      item.CPPHDouble as string | number | undefined
    ),
    mixte: buildRanking(
      item.ClassementMixte as string | undefined,
      item.CPPHMixte as string | number | undefined
    ),
  };

  const best = getBestRanking(rankings);
  const bestRank =
    best?.classement ??
    (item.ClassementSimple as string | undefined) ??
    (item.ClassementDouble as string | undefined) ??
    (item.ClassementMixte as string | undefined) ??
    'NC';

  return {
    licence: item.Licence as string,
    nom: (item.Nom as string | undefined) ?? '',
    prenom: (item.Prenom as string | undefined) ?? '',
    bestRank,
    simpleRank: rankings.simple?.classement ?? 'NC',
    simpleCpph: rankings.simple?.cpph,
    doubleRank: rankings.double?.classement ?? 'NC',
    doubleCpph: rankings.double?.cpph,
    mixteRank: rankings.mixte?.classement ?? 'NC',
    mixteCpph: rankings.mixte?.cpph,
  };
})
```

**Step 3: Add a discipline filter type and sort function**

Add after the exports in `src/utils/clubLeaderboard.ts`:

```typescript
export type ClubDisciplineFilter = 'all' | 'simple' | 'double' | 'mixte';

/**
 * Sort and re-position leaderboard entries by a specific discipline.
 * 'all' uses bestRank (default behavior).
 */
export function sortLeaderboardByDiscipline(
  entries: LeaderboardEntry[],
  discipline: ClubDisciplineFilter
): LeaderboardEntry[] {
  const getRank = (entry: LeaderboardEntry): string => {
    switch (discipline) {
      case 'simple': return entry.simpleRank;
      case 'double': return entry.doubleRank;
      case 'mixte': return entry.mixteRank;
      default: return entry.bestRank;
    }
  };

  const sorted = [...entries].sort(
    (a, b) => getRankSortIndex(getRank(a)) - getRankSortIndex(getRank(b))
  );

  return sorted.map((entry, index) => ({ ...entry, position: index + 1 }));
}

/**
 * Get the display rank for an entry based on the active discipline filter.
 */
export function getDisplayRank(entry: LeaderboardEntry, discipline: ClubDisciplineFilter): string {
  switch (discipline) {
    case 'simple': return entry.simpleRank;
    case 'double': return entry.doubleRank;
    case 'mixte': return entry.mixteRank;
    default: return entry.bestRank;
  }
}
```

**Step 4: Add filter state and chips in `app/(app)/(tabs)/club.tsx`**

4a. Import the new types/functions:

```typescript
import {
  type LeaderboardEntry,
  type ClubDisciplineFilter,
  sortLeaderboardByDiscipline,
  getDisplayRank,
} from '../../../src/utils/clubLeaderboard';
```

4b. Add filter state inside `ClubScreen`:

```typescript
const [disciplineFilter, setDisciplineFilter] = useState<ClubDisciplineFilter>('all');
```

4c. Add a `filteredMembers` derived value:

```typescript
const filteredMembers = useMemo(
  () => sortLeaderboardByDiscipline(members, disciplineFilter),
  [members, disciplineFilter]
);
```

(import `useMemo` at the top)

4d. Add filter chips above the FlatList, after the "My Club" button section and before the member list. Insert this JSX block:

```typescript
{/* Discipline filter chips */}
{hasMembers ? (
  <View style={styles.disciplineFiltersRow}>
    {(['all', 'simple', 'double', 'mixte'] as ClubDisciplineFilter[]).map((key) => {
      const isActive = disciplineFilter === key;
      const labelKey = key === 'all' ? 'club.filterAll' : `club.filter${key.charAt(0).toUpperCase() + key.slice(1)}`;
      return (
        <Pressable
          key={key}
          style={[styles.filterChip, isActive && styles.filterChipActive]}
          onPress={() => setDisciplineFilter(key)}
        >
          <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
            {t(labelKey)}
          </Text>
        </Pressable>
      );
    })}
  </View>
) : null}
```

4e. Update `renderLeaderboardRow` to use `filteredMembers` and `getDisplayRank`:

```typescript
const renderLeaderboardRow = useCallback(
  ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.licence === session?.licence;
    const displayRank = getDisplayRank(item, disciplineFilter);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          isCurrentUser && styles.rowHighlighted,
          pressed && styles.rowPressed,
        ]}
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: { licence: item.licence },
          })
        }
      >
        <Text style={styles.rowPosition}>#{item.position}</Text>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.nom} {item.prenom}
          </Text>
        </View>
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>{displayRank}</Text>
        </View>
      </Pressable>
    );
  },
  [session?.licence, disciplineFilter]
);
```

4f. Change the FlatList `data` prop from `members` to `filteredMembers`.

**Step 5: Add filter chip styles**

Add to the StyleSheet in `club.tsx`:

```typescript
disciplineFiltersRow: {
  flexDirection: 'row',
  gap: 8,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#f3f4f6',
},
filterChip: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#e5e7eb',
  backgroundColor: '#fff',
},
filterChipActive: {
  backgroundColor: '#2563eb',
  borderColor: '#2563eb',
},
filterChipText: {
  fontSize: 13,
  fontWeight: '500',
  color: '#374151',
},
filterChipTextActive: {
  color: '#fff',
},
```

**Step 6: Add i18n strings**

In `fr.json`, add to the `club` section:
```json
"filterAll": "Tous",
"filterSimple": "Simple",
"filterDouble": "Double",
"filterMixte": "Mixte"
```

In `en.json`, add to the `club` section:
```json
"filterAll": "All",
"filterSimple": "Singles",
"filterDouble": "Doubles",
"filterMixte": "Mixed"
```

**Step 7: Commit**

```bash
git add src/utils/clubLeaderboard.ts app/\(app\)/\(tabs\)/club.tsx src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat: club leaderboard with discipline filtering"
```

---

## Task 5: TypeScript Check + Visual Verification

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Start dev server and test on emulator**

```bash
npx expo start
```

Verify each screen:
1. Dashboard — no more "points to next rank" display, ranking cards still show rank + CPPH
2. Ranking chart — step chart with rank labels on Y-axis, tooltip shows rank name
3. Match history — inline cards with players, set scores, points per match
4. Club leaderboard — filter chips work, switching discipline shows correct rankings

**Step 3: Final commit if any fixes needed**

```bash
git commit -m "fix: address type errors and visual polish"
```
