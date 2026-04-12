# Tier 1 Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new insight cards to the dashboard — Ranking Projection, Season Comparison, and Activity Calendar — each returning `null` when data is insufficient.

**Architecture:** Extend the existing insights pipeline (`src/utils/insights.ts` → `useInsights` hook → `InsightsSection` grid → `insight-matches/[type]` detail screen). No new API calls: ranking projection uses `PlayerProfile.rankings` + `RankingLevel[]` from `useRankingLevels()`; season comparison and activity calendar derive entirely from the existing 10-year match history.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, i18next, Tailwind (NativeWind). No test framework — verification uses `npx tsc --noEmit` + manual checks on emulator-5554.

**Spec:** [docs/superpowers/specs/2026-04-12-tier1-insights-design.md](../specs/2026-04-12-tier1-insights-design.md)

---

## File Structure

**Files to modify:**
- `src/utils/insights.ts` — add 3 new compute functions, expand `InsightsData`, expand `InsightType`, expand `computeAllInsights` signature, extend `getMatchesForInsight`
- `src/hooks/useInsights.ts` — expand hook signature to accept rankings + rankingLevels, wire into `computeAllInsights`
- `src/components/InsightsSection.tsx` — add 3 new card components, extend layout and `hasAny` check
- `app/(app)/(tabs)/index.tsx` — update `useInsights` call to pass rankings + levels
- `app/(app)/insight-matches/[type].tsx` — add header props + custom body rendering for the 3 new types
- `src/i18n/locales/fr.json` — new keys under `insights` + `insightMatches`
- `src/i18n/locales/en.json` — same keys in English

**No new files** — everything lives in existing modules. All compute logic colocated with existing insights in `src/utils/insights.ts`.

---

## Task 1: Ranking Projection (includes shared infrastructure)

This task introduces the first new insight AND expands the shared infrastructure (`computeAllInsights`, `useInsights`, `InsightType` union) that Tasks 2 and 3 will build on.

**Files:**
- Modify: `src/utils/insights.ts`
- Modify: `src/hooks/useInsights.ts`
- Modify: `app/(app)/(tabs)/index.tsx`
- Modify: `app/(app)/insight-matches/[type].tsx`
- Modify: `src/components/InsightsSection.tsx`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

---

### Step 1.1: Extend `InsightsData` and `InsightType` in `src/utils/insights.ts`

Add the `rankingProjection` field to the `InsightsData` interface (insert after `mostPlayed`):

```ts
  mostPlayed: {
    name: string;
    licence: string;
    matchCount: number;
    lastDate: string;
  } | null;
  rankingProjection: {
    discipline: 'simple' | 'double' | 'mixte';
    currentRank: string;
    currentCpph: number;
    nextRank: string;
    gap: number;           // CPPH to next rank, rounded 1 decimal
    avgPointsPerWin: number; // average pointsImpact across recent wins in this discipline
    estimatedWins: number;   // ceil(gap / avgPointsPerWin)
  } | null;
}
```

Add `'rankingProjection'` to the `InsightType` union and the `INSIGHT_TYPES` array (keep existing order, append at end):

```ts
export type InsightType =
  | 'winStreak'
  | 'recentForm'
  | 'biggestUpset'
  | 'cpphMomentum'
  | 'bestTournament'
  | 'bestPartner'
  | 'mostPlayedPartner'
  | 'nemesis'
  | 'mostDefeated'
  | 'mostPlayed'
  | 'rankingProjection';

export const INSIGHT_TYPES: readonly InsightType[] = [
  'winStreak',
  'recentForm',
  'biggestUpset',
  'cpphMomentum',
  'bestTournament',
  'bestPartner',
  'mostPlayedPartner',
  'nemesis',
  'mostDefeated',
  'mostPlayed',
  'rankingProjection',
];
```

- [ ] **Make the type additions above**

### Step 1.2: Add imports and write `computeRankingProjection` in `src/utils/insights.ts`

At the top of the file, add imports for `PlayerProfile`, `RankingLevel`, and `getRankProgress`:

```ts
import type { MatchItem } from './matchHistory';
import { RANK_BOUNDARIES, getRankProgress } from './rankings';
import type { OpponentListItem, PlayerProfile, RankingLevel } from '../api/ffbad';
```

Then add the compute function after `computeMostPlayed` and before `computeAllInsights`:

```ts
export function computeRankingProjection(
  matches: MatchItem[],
  rankings: PlayerProfile['rankings'] | null | undefined,
  levels: RankingLevel[] | null
): InsightsData['rankingProjection'] {
  if (!rankings || !levels || levels.length === 0) return null;

  const disciplines: Array<'simple' | 'double' | 'mixte'> = ['simple', 'double', 'mixte'];
  let best: InsightsData['rankingProjection'] = null;
  let smallestGap = Infinity;

  for (const disc of disciplines) {
    const r = rankings[disc];
    if (!r || r.cpph == null) continue;

    const progress = getRankProgress(r.cpph, r.classement, disc, levels);
    if (!progress || progress.nextRank == null || progress.pointsToNext == null) continue;
    if (progress.pointsToNext <= 0) continue;

    // Average points per win in this discipline, from detail matches
    const wins = matches.filter(
      (m) => m.discipline === disc && m.isWin === true && m.pointsImpact != null && m.pointsImpact > 0
    );
    if (wins.length < 3) continue;

    const avgPoints = wins.reduce((sum, m) => sum + (m.pointsImpact ?? 0), 0) / wins.length;
    if (avgPoints <= 0) continue;

    const estimatedWins = Math.ceil(progress.pointsToNext / avgPoints);

    if (progress.pointsToNext < smallestGap) {
      smallestGap = progress.pointsToNext;
      best = {
        discipline: disc,
        currentRank: r.classement,
        currentCpph: r.cpph,
        nextRank: progress.nextRank,
        gap: Math.round(progress.pointsToNext * 10) / 10,
        avgPointsPerWin: Math.round(avgPoints * 10) / 10,
        estimatedWins,
      };
    }
  }

  return best;
}
```

- [ ] **Add the imports and the `computeRankingProjection` function**

### Step 1.3: Expand `computeAllInsights` signature in `src/utils/insights.ts`

Change the signature to accept rankings and levels. Update the function:

```ts
export function computeAllInsights(
  matches: MatchItem[],
  opponents: OpponentListItem[],
  rankings: PlayerProfile['rankings'] | null | undefined,
  levels: RankingLevel[] | null
): InsightsData {
  return {
    winStreak: computeWinStreak(matches),
    recentForm: computeRecentForm(matches),
    biggestUpset: computeBiggestUpset(matches),
    cpphMomentum: computeCpphMomentum(matches),
    bestTournament: computeBestTournament(matches),
    bestPartner: computeBestPartner(matches),
    mostPlayedPartner: computeMostPlayedPartner(matches),
    nemesis: computeNemesis(matches),
    mostDefeated: computeMostDefeated(matches),
    mostPlayed: computeMostPlayed(opponents),
    rankingProjection: computeRankingProjection(matches, rankings, levels),
  };
}
```

- [ ] **Update `computeAllInsights` signature and body**

### Step 1.4: Extend `getMatchesForInsight` in `src/utils/insights.ts`

Add a `case 'rankingProjection'` that returns matches backing the projection (wins in the selected discipline used for the average). Insert inside the switch, after the `mostPlayed` case:

```ts
    case 'rankingProjection': {
      const rp = insights.rankingProjection;
      if (!rp) return [];
      return matches.filter(
        (m) =>
          m.discipline === rp.discipline &&
          m.isWin === true &&
          m.pointsImpact != null &&
          m.pointsImpact > 0
      );
    }
```

- [ ] **Add the `rankingProjection` case to `getMatchesForInsight`**

### Step 1.5: Update `useInsights` hook signature in `src/hooks/useInsights.ts`

Replace the entire file body (imports + hook) with:

```ts
import { useState, useEffect, useMemo } from 'react';
import { useSession } from '../auth/context';
import { getOpponentList, type OpponentListItem, type PlayerProfile } from '../api/ffbad';
import { cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';
import { computeAllInsights, type InsightsData } from '../utils/insights';
import type { MatchItem } from '../utils/matchHistory';
import { useRankingLevels } from '../ranking-levels/context';

const OPPONENT_LIST_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Computes all insights from settled detail match data + opponent list.
 *
 * Returns null while detail data is still loading.
 * Fetches opponent list (cached 10min) for the "Most Played" insight.
 */
export function useInsights(
  allDetailMatches: MatchItem[],
  detailsLoading: boolean,
  rankings?: PlayerProfile['rankings'] | null,
): InsightsData | null {
  const { session } = useSession();
  const rankingLevels = useRankingLevels();
  const [opponents, setOpponents] = useState<OpponentListItem[]>([]);

  // Fetch opponent list
  useEffect(() => {
    if (!session?.personId) return;
    let cancelled = false;

    (async () => {
      const cacheKey = `opponentList:${session.personId}`;
      let data = await cacheGetWithTTL<OpponentListItem[]>(cacheKey, OPPONENT_LIST_TTL);

      if (!data) {
        try {
          data = await getOpponentList();
          if (data.length > 0) {
            cacheSetWithTTL(cacheKey, data);
          }
        } catch {
          return;
        }
      }

      if (!cancelled && data) {
        setOpponents(data);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.personId]);

  // Compute insights only when details are settled
  const insights = useMemo(() => {
    if (detailsLoading || allDetailMatches.length === 0) return null;
    return computeAllInsights(allDetailMatches, opponents, rankings, rankingLevels);
  }, [allDetailMatches, detailsLoading, opponents, rankings, rankingLevels]);

  return insights;
}
```

- [ ] **Replace `src/hooks/useInsights.ts` with the above**

### Step 1.6: Update call sites — dashboard in `app/(app)/(tabs)/index.tsx`

Find the `useInsights` call and pass the rankings. The exact line is near the top of `DashboardScreen()`:

Before:
```ts
  const insights = useInsights(allDetailMatches, detailsLoading);
```

After:
```ts
  const insights = useInsights(allDetailMatches, detailsLoading, profile?.rankings);
```

- [ ] **Update the `useInsights` call in `app/(app)/(tabs)/index.tsx`**

### Step 1.7: Update call site — detail screen in `app/(app)/insight-matches/[type].tsx`

Find the `useInsights` call and update the same way.

Before:
```ts
  const { allDetailMatches, detailsLoading } = useDashboardData();
  const insights = useInsights(allDetailMatches, detailsLoading);
```

After:
```ts
  const { allDetailMatches, detailsLoading, profile } = useDashboardData();
  const insights = useInsights(allDetailMatches, detailsLoading, profile?.rankings);
```

- [ ] **Update `app/(app)/insight-matches/[type].tsx` to destructure `profile` and pass `profile?.rankings`**

### Step 1.8: Add i18n keys for Ranking Projection

Open `src/i18n/locales/fr.json`. In the `insights` object, after the existing `mostPlayedStats` line (at the end of the object), add a comma and these keys:

```json
    "mostPlayedStats": "{{count}} matchs · Dernier : {{date}}",
    "rankingProjection": "Prochain classement",
    "rankingProjectionTitle": "{{rank}} — ~{{wins}} V",
    "rankingProjectionGap": "+{{gap}} CPPH restants",
    "rankingProjectionTop": "Meilleur classement atteint",
    "rankingProjectionDetailTitle": "Projection de classement",
    "rankingProjectionDetailSubtitle": "Basé sur vos {{count}} dernières victoires en {{discipline}}"
```

Then in `src/i18n/locales/en.json`, same spot:

```json
    "mostPlayedStats": "{{count}} matches · Last: {{date}}",
    "rankingProjection": "Next Rank",
    "rankingProjectionTitle": "{{rank}} — ~{{wins}} wins",
    "rankingProjectionGap": "+{{gap}} CPPH to go",
    "rankingProjectionTop": "Top rank reached",
    "rankingProjectionDetailTitle": "Rank Projection",
    "rankingProjectionDetailSubtitle": "Based on your last {{count}} wins in {{discipline}}"
```

- [ ] **Add both French and English i18n keys for ranking projection**

### Step 1.9: Add `RankingProjectionCard` component in `src/components/InsightsSection.tsx`

Add this card component after `CpphMomentumCard` (before `FullWidthCard`):

```tsx
function RankingProjectionCard({
  nextRank,
  gap,
  estimatedWins,
  t,
}: {
  nextRank: string;
  gap: number;
  estimatedWins: number;
  t: TFunction;
}) {
  return (
    <Card className="w-full items-center py-3 px-2">
      <Text className="text-caption text-muted uppercase">{t('insights.rankingProjection')}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#2563eb', marginVertical: 2 }}>
        {'🎯 '}{t('insights.rankingProjectionTitle', { rank: nextRank, wins: estimatedWins })}
      </Text>
      <Text className="text-[11px] text-muted">
        {t('insights.rankingProjectionGap', { gap: gap.toFixed(1) })}
      </Text>
    </Card>
  );
}
```

- [ ] **Add `RankingProjectionCard` component**

### Step 1.10: Add Ranking Projection to the grid in `src/components/InsightsSection.tsx`

Update the `hasAny` check to include the new field:

Before:
```ts
  const hasAny =
    data.winStreak ||
    data.recentForm ||
    data.biggestUpset ||
    data.cpphMomentum ||
    data.bestTournament ||
    data.bestPartner ||
    data.mostPlayedPartner ||
    data.nemesis ||
    data.mostDefeated ||
    data.mostPlayed;
```

After:
```ts
  const hasAny =
    data.winStreak ||
    data.recentForm ||
    data.biggestUpset ||
    data.cpphMomentum ||
    data.bestTournament ||
    data.bestPartner ||
    data.mostPlayedPartner ||
    data.nemesis ||
    data.mostDefeated ||
    data.mostPlayed ||
    data.rankingProjection;
```

Then, after the second `GridRow` (which renders biggestUpset + cpphMomentum), add a third `GridRow` for rankingProjection (paired with `null` on the right for now — Task 2 will add seasonComparison there):

Find this block:
```tsx
        <GridRow
          left={
            data.biggestUpset ? (
              <InsightPressable type="biggestUpset">
                <BiggestUpsetCard
                  opponentRank={data.biggestUpset.opponentRank}
                  playerRank={data.biggestUpset.playerRank}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
          right={
            data.cpphMomentum ? (
              <InsightPressable type="cpphMomentum">
                <CpphMomentumCard
                  total={data.cpphMomentum.total}
                  matchCount={data.cpphMomentum.matchCount}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
        />
      </View>
```

And insert a new `GridRow` before the closing `</View>`:

```tsx
        <GridRow
          left={
            data.biggestUpset ? (
              <InsightPressable type="biggestUpset">
                <BiggestUpsetCard
                  opponentRank={data.biggestUpset.opponentRank}
                  playerRank={data.biggestUpset.playerRank}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
          right={
            data.cpphMomentum ? (
              <InsightPressable type="cpphMomentum">
                <CpphMomentumCard
                  total={data.cpphMomentum.total}
                  matchCount={data.cpphMomentum.matchCount}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
        />
        <GridRow
          left={
            data.rankingProjection ? (
              <InsightPressable type="rankingProjection">
                <RankingProjectionCard
                  nextRank={data.rankingProjection.nextRank}
                  gap={data.rankingProjection.gap}
                  estimatedWins={data.rankingProjection.estimatedWins}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
          right={null}
        />
      </View>
```

- [ ] **Extend `hasAny` and add the new `GridRow` for rankingProjection**

### Step 1.11: Add detail screen header for Ranking Projection in `app/(app)/insight-matches/[type].tsx`

Add `rankingProjection` to the `INSIGHT_BG` record:

```ts
const INSIGHT_BG: Record<InsightType, string> = {
  winStreak: '#fef3c7',
  recentForm: '#f1f5f9',
  biggestUpset: '#dcfce7',
  cpphMomentum: '#f1f5f9',
  bestTournament: '#fef3c7',
  bestPartner: '#dbeafe',
  mostPlayedPartner: '#e0e7ff',
  nemesis: '#fee2e2',
  mostDefeated: '#fef3c7',
  mostPlayed: '#f0fdf4',
  rankingProjection: '#dbeafe',
};
```

Add the `rankingProjection` case to `getHeaderProps` (inside the switch, before the closing brace):

```ts
    case 'rankingProjection': {
      const rp = insights.rankingProjection;
      return rp
        ? {
            emoji: '🎯',
            bgColor,
            label: t('insights.rankingProjectionDetailTitle'),
            title: t('insights.rankingProjectionTitle', {
              rank: rp.nextRank,
              wins: rp.estimatedWins,
            }),
            subtitle: t('insights.rankingProjectionDetailSubtitle', {
              count: matches.length > 0
                ? matches.filter(
                    (m) => m.discipline === rp.discipline && m.isWin === true && (m.pointsImpact ?? 0) > 0,
                  ).length
                : 0,
              discipline: t(`player.${rp.discipline}`),
            }),
          }
        : null;
    }
```

Note: `getHeaderProps` currently takes `(type, insights, t)` but the snippet above uses `matches`. Change the function signature to also receive `matches`:

Before:
```ts
function getHeaderProps(
  type: InsightType,
  insights: InsightsData,
  t: TFunction
): FullWidthCardProps | null {
```

After:
```ts
function getHeaderProps(
  type: InsightType,
  insights: InsightsData,
  matches: MatchItem[],
  t: TFunction
): FullWidthCardProps | null {
```

And also import `MatchItem` at the top if not already:

```ts
import type { MatchItem } from '../../../src/utils/matchHistory';
```

Finally update the call site at the bottom of the file:

Before:
```ts
  const headerProps = getHeaderProps(type, insights, t);
```

After:
```ts
  const headerProps = getHeaderProps(type, insights, filteredMatches, t);
```

- [ ] **Update `INSIGHT_BG`, `getHeaderProps` signature, add the `rankingProjection` case, update the call site, and import `MatchItem`**

### Step 1.12: Typecheck

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

If there are errors, fix them before moving on. The most likely issues are:
- Missing `PlayerProfile` import in `insights.ts`
- Missing `MatchItem` import in `insight-matches/[type].tsx`
- Call sites still using the old `useInsights` signature (search for `useInsights(` in the codebase)

- [ ] **Run typecheck and resolve any errors**

### Step 1.13: Manual verification on emulator

Start the dev server if not already running (`npx expo start`). Open the app on `emulator-5554`. Verify on the dashboard:

1. The Insights section still renders the existing cards.
2. If you have 3+ recent wins in any discipline AND are not at N1, a new "🎯 Prochain classement" card appears under CPPH Trend.
3. If you're NC or at N1 with no next rank, the card does not appear.
4. Tapping the card opens the detail screen with the `🎯` header + a list of the wins that contributed to the average.

- [ ] **Verify on emulator (manual check — describe what you see)**

### Step 1.14: Commit

```bash
git add src/utils/insights.ts src/hooks/useInsights.ts src/components/InsightsSection.tsx app/\(app\)/\(tabs\)/index.tsx "app/(app)/insight-matches/[type].tsx" src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat(insights): add ranking projection card"
```

- [ ] **Commit**

---

## Task 2: Season Comparison

**Files:**
- Modify: `src/utils/insights.ts`
- Modify: `src/components/InsightsSection.tsx`
- Modify: `app/(app)/insight-matches/[type].tsx`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

---

### Step 2.1: Extend `InsightsData` and `InsightType` for Season Comparison

In `src/utils/insights.ts`, add to the `InsightsData` interface (after `rankingProjection`):

```ts
  rankingProjection: {
    discipline: 'simple' | 'double' | 'mixte';
    currentRank: string;
    currentCpph: number;
    nextRank: string;
    gap: number;
    avgPointsPerWin: number;
    estimatedWins: number;
  } | null;
  seasonComparison: {
    currentWinRate: number;
    lastWinRate: number;
    winRateDelta: number;       // current - last, rounded to nearest integer
    currentMatchCount: number;
    lastMatchCount: number;
    currentCpphChange: number;  // rounded 1 decimal
    lastCpphChange: number;
    cpphDelta: number;
    isBetter: boolean;
  } | null;
}
```

Add `'seasonComparison'` to the `InsightType` union and `INSIGHT_TYPES` array (append after `rankingProjection`).

- [ ] **Add the type and union entries**

### Step 2.2: Add a season-boundary helper and `computeSeasonComparison` in `src/utils/insights.ts`

Insert these helpers and the compute function after `computeRankingProjection`:

```ts
/**
 * FFBaD seasons run September 1 — August 31.
 * Returns {start, end} dates for the season containing the given reference date.
 */
function getSeasonRange(ref: Date): { start: Date; end: Date } {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth(); // 0-indexed
  const seasonStartYear = m >= 8 ? y : y - 1; // Sept (month index 8) or later → current year; else previous year
  const start = new Date(Date.UTC(seasonStartYear, 8, 1));      // Sept 1
  const end = new Date(Date.UTC(seasonStartYear + 1, 8, 1));    // next Sept 1 (exclusive)
  return { start, end };
}

function parseRawDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  // _rawDate comes from FFBaD as YYYY-MM-DD
  const d = new Date(raw + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

export function computeSeasonComparison(
  matches: MatchItem[],
  now: Date = new Date()
): InsightsData['seasonComparison'] {
  const current = getSeasonRange(now);
  // Previous season = 12 months before current season start
  const previous = {
    start: new Date(Date.UTC(current.start.getUTCFullYear() - 1, 8, 1)),
    end: current.start,
  };

  // Days since current season start
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysIntoSeason = Math.floor((now.getTime() - current.start.getTime()) / msPerDay);
  const windowEndOfPrev = new Date(previous.start.getTime() + daysIntoSeason * msPerDay);

  const currentMatches: MatchItem[] = [];
  const lastMatches: MatchItem[] = [];

  for (const m of matches) {
    const d = parseRawDate(m._rawDate);
    if (!d) continue;
    if (d >= current.start && d < current.end) currentMatches.push(m);
    else if (d >= previous.start && d < windowEndOfPrev) lastMatches.push(m);
  }

  if (currentMatches.length < 5 || lastMatches.length < 5) return null;

  const computeWinRate = (ms: MatchItem[]) => {
    const known = ms.filter((m) => m.isWin !== undefined);
    if (known.length === 0) return 0;
    const wins = known.filter((m) => m.isWin === true).length;
    return Math.round((wins / known.length) * 100);
  };

  const computeCpphChange = (ms: MatchItem[]) =>
    Math.round(ms.reduce((s, m) => s + (m.pointsImpact ?? 0), 0) * 10) / 10;

  const currentWinRate = computeWinRate(currentMatches);
  const lastWinRate = computeWinRate(lastMatches);
  const currentCpphChange = computeCpphChange(currentMatches);
  const lastCpphChange = computeCpphChange(lastMatches);

  return {
    currentWinRate,
    lastWinRate,
    winRateDelta: currentWinRate - lastWinRate,
    currentMatchCount: currentMatches.length,
    lastMatchCount: lastMatches.length,
    currentCpphChange,
    lastCpphChange,
    cpphDelta: Math.round((currentCpphChange - lastCpphChange) * 10) / 10,
    isBetter: currentWinRate >= lastWinRate,
  };
}
```

- [ ] **Add `getSeasonRange`, `parseRawDate`, and `computeSeasonComparison`**

### Step 2.3: Wire into `computeAllInsights` and `getMatchesForInsight`

In `computeAllInsights`, add:

```ts
    rankingProjection: computeRankingProjection(matches, rankings, levels),
    seasonComparison: computeSeasonComparison(matches),
  };
```

In `getMatchesForInsight`, add a case that returns matches from the current season (used by the detail screen to populate the match list):

```ts
    case 'seasonComparison': {
      const sc = insights.seasonComparison;
      if (!sc) return [];
      const { start, end } = getSeasonRange(new Date());
      return matches.filter((m) => {
        const d = parseRawDate(m._rawDate);
        return d != null && d >= start && d < end;
      });
    }
```

- [ ] **Wire `seasonComparison` into `computeAllInsights` and add the `getMatchesForInsight` case**

### Step 2.4: Add i18n keys for Season Comparison

In `src/i18n/locales/fr.json`, inside `insights`, append after `rankingProjectionDetailSubtitle`:

```json
    "rankingProjectionDetailSubtitle": "Basé sur vos {{count}} dernières victoires en {{discipline}}",
    "seasonComparison": "vs Saison dernière",
    "seasonAhead": "En avance",
    "seasonBehind": "En retard",
    "seasonWinRateDelta": "{{delta}}% victoires",
    "seasonMatchCount": "{{current}} vs {{last}} matchs"
```

In `src/i18n/locales/en.json`:

```json
    "rankingProjectionDetailSubtitle": "Based on your last {{count}} wins in {{discipline}}",
    "seasonComparison": "vs Last Season",
    "seasonAhead": "Ahead",
    "seasonBehind": "Behind",
    "seasonWinRateDelta": "{{delta}}% win rate",
    "seasonMatchCount": "{{current}} vs {{last}} matches"
```

- [ ] **Add i18n keys in both locale files**

### Step 2.5: Add `SeasonComparisonCard` component in `src/components/InsightsSection.tsx`

Add this component after `RankingProjectionCard`:

```tsx
function SeasonComparisonCard({
  winRateDelta,
  currentMatchCount,
  lastMatchCount,
  isBetter,
  t,
}: {
  winRateDelta: number;
  currentMatchCount: number;
  lastMatchCount: number;
  isBetter: boolean;
  t: TFunction;
}) {
  const emoji = isBetter ? '📈' : '📉';
  const color = isBetter ? '#10b981' : '#ef4444';
  const sign = winRateDelta >= 0 ? '+' : '';
  return (
    <Card className="w-full items-center py-3 px-2">
      <Text className="text-caption text-muted uppercase">{t('insights.seasonComparison')}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color, marginVertical: 2 }}>
        {emoji} {t('insights.seasonWinRateDelta', { delta: `${sign}${winRateDelta}` })}
      </Text>
      <Text className="text-[11px] text-muted">
        {t('insights.seasonMatchCount', { current: currentMatchCount, last: lastMatchCount })}
      </Text>
    </Card>
  );
}
```

- [ ] **Add `SeasonComparisonCard`**

### Step 2.6: Place Season Comparison in the grid layout

Update the `hasAny` check in `InsightsSection` to include `data.seasonComparison`:

```ts
  const hasAny =
    data.winStreak ||
    data.recentForm ||
    data.biggestUpset ||
    data.cpphMomentum ||
    data.bestTournament ||
    data.bestPartner ||
    data.mostPlayedPartner ||
    data.nemesis ||
    data.mostDefeated ||
    data.mostPlayed ||
    data.rankingProjection ||
    data.seasonComparison;
```

Update the last `GridRow` (the one added in Task 1 for ranking projection) to put `seasonComparison` on the right:

Before:
```tsx
        <GridRow
          left={
            data.rankingProjection ? (
              <InsightPressable type="rankingProjection">
                <RankingProjectionCard
                  nextRank={data.rankingProjection.nextRank}
                  gap={data.rankingProjection.gap}
                  estimatedWins={data.rankingProjection.estimatedWins}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
          right={null}
        />
```

After:
```tsx
        <GridRow
          left={
            data.rankingProjection ? (
              <InsightPressable type="rankingProjection">
                <RankingProjectionCard
                  nextRank={data.rankingProjection.nextRank}
                  gap={data.rankingProjection.gap}
                  estimatedWins={data.rankingProjection.estimatedWins}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
          right={
            data.seasonComparison ? (
              <InsightPressable type="seasonComparison">
                <SeasonComparisonCard
                  winRateDelta={data.seasonComparison.winRateDelta}
                  currentMatchCount={data.seasonComparison.currentMatchCount}
                  lastMatchCount={data.seasonComparison.lastMatchCount}
                  isBetter={data.seasonComparison.isBetter}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
        />
```

- [ ] **Extend `hasAny` and update the last `GridRow` to include `seasonComparison`**

### Step 2.7: Add detail screen header for Season Comparison

In `app/(app)/insight-matches/[type].tsx`:

Add to `INSIGHT_BG`:

```ts
  rankingProjection: '#dbeafe',
  seasonComparison: '#dcfce7',
};
```

Add the `seasonComparison` case to `getHeaderProps`:

```ts
    case 'seasonComparison': {
      const sc = insights.seasonComparison;
      if (!sc) return null;
      const emoji = sc.isBetter ? '📈' : '📉';
      const sign = sc.winRateDelta >= 0 ? '+' : '';
      return {
        emoji,
        bgColor,
        label: t('insights.seasonComparison'),
        title: t('insights.seasonWinRateDelta', { delta: `${sign}${sc.winRateDelta}` }),
        subtitle: t('insights.seasonMatchCount', {
          current: sc.currentMatchCount,
          last: sc.lastMatchCount,
        }),
      };
    }
```

- [ ] **Add the `INSIGHT_BG` entry and the `seasonComparison` case to `getHeaderProps`**

### Step 2.8: Typecheck

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Run typecheck and resolve any errors**

### Step 2.9: Manual verification on emulator

Reload the app on `emulator-5554`. On the dashboard:

1. If you have 5+ matches in the current season AND 5+ matches in the same date window of last season, a new "📈 vs Saison dernière" card appears.
2. If you have fewer than 5 in either window, the card does not appear.
3. Tapping the card opens the detail screen with a header showing win rate delta + match count comparison. The match list below shows current-season matches.

- [ ] **Verify on emulator**

### Step 2.10: Commit

```bash
git add src/utils/insights.ts src/components/InsightsSection.tsx "app/(app)/insight-matches/[type].tsx" src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat(insights): add season comparison card"
```

- [ ] **Commit**

---

## Task 3: Activity Calendar

**Files:**
- Modify: `src/utils/insights.ts`
- Modify: `src/components/InsightsSection.tsx`
- Modify: `app/(app)/insight-matches/[type].tsx`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

---

### Step 3.1: Extend `InsightsData` and `InsightType` for Activity Calendar

In `src/utils/insights.ts`, add to the `InsightsData` interface (after `seasonComparison`):

```ts
  seasonComparison: {
    currentWinRate: number;
    lastWinRate: number;
    winRateDelta: number;
    currentMatchCount: number;
    lastMatchCount: number;
    currentCpphChange: number;
    lastCpphChange: number;
    cpphDelta: number;
    isBetter: boolean;
  } | null;
  activityCalendar: {
    months: Array<{
      yearMonth: string;           // "2026-03"
      year: number;
      month: number;               // 0-indexed
      tournamentCount: number;
      tournamentNames: string[];
    }>;
    activeStreak: number;
    inactiveMonths: number;
    isActive: boolean;
  } | null;
}
```

Add `'activityCalendar'` to `InsightType` and `INSIGHT_TYPES`.

- [ ] **Add the type and union entries**

### Step 3.2: Add `computeActivityCalendar` in `src/utils/insights.ts`

Insert after `computeSeasonComparison`:

```ts
export function computeActivityCalendar(
  matches: MatchItem[],
  now: Date = new Date()
): InsightsData['activityCalendar'] {
  if (matches.length < 3) return null;

  // Group tournament names by year-month from _rawDate
  const byYearMonth = new Map<string, Set<string>>();
  for (const m of matches) {
    const d = parseRawDate(m._rawDate);
    if (!d) continue;
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const set = byYearMonth.get(ym) ?? new Set();
    set.add(m.tournament ?? 'unknown');
    byYearMonth.set(ym, set);
  }

  // Build the last 12 months (including the current month), newest first
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  type MonthEntry = {
    yearMonth: string;
    year: number;
    month: number;
    tournamentCount: number;
    tournamentNames: string[];
  };
  const months: MonthEntry[] = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(nowYear, nowMonth - i, 1));
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth();
    const ym = `${y}-${String(mo + 1).padStart(2, '0')}`;
    const tournaments = byYearMonth.get(ym);
    months.push({
      yearMonth: ym,
      year: y,
      month: mo,
      tournamentCount: tournaments?.size ?? 0,
      tournamentNames: tournaments ? Array.from(tournaments) : [],
    });
  }

  // Ensure we have at least one match in the last 12 months
  const anyActive = months.some((m) => m.tournamentCount > 0);
  if (!anyActive) return null;

  // Active streak: walk from the most recent active month backward,
  // counting consecutive months with > 0 tournaments.
  let activeStreak = 0;
  let firstActiveIdx = -1;
  for (let i = 0; i < months.length; i++) {
    if (months[i].tournamentCount > 0) {
      firstActiveIdx = i;
      break;
    }
  }
  if (firstActiveIdx >= 0) {
    for (let i = firstActiveIdx; i < months.length; i++) {
      if (months[i].tournamentCount > 0) activeStreak++;
      else break;
    }
  }

  const inactiveMonths = firstActiveIdx;
  const isActive = firstActiveIdx <= 1; // active if played this month or last

  return { months, activeStreak, inactiveMonths, isActive };
}
```

- [ ] **Add `computeActivityCalendar`**

### Step 3.3: Wire into `computeAllInsights` and `getMatchesForInsight`

In `computeAllInsights`:

```ts
    seasonComparison: computeSeasonComparison(matches),
    activityCalendar: computeActivityCalendar(matches),
  };
```

In `getMatchesForInsight`, add:

```ts
    case 'activityCalendar': {
      const ac = insights.activityCalendar;
      if (!ac) return [];
      // Return matches from the last 12 months
      const oldestYm = ac.months[ac.months.length - 1].yearMonth;
      return matches.filter((m) => {
        const d = parseRawDate(m._rawDate);
        if (!d) return false;
        const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        return ym >= oldestYm;
      });
    }
```

- [ ] **Wire `activityCalendar` into `computeAllInsights` and add the `getMatchesForInsight` case**

### Step 3.4: Add i18n keys for Activity Calendar

In `src/i18n/locales/fr.json`, append inside `insights`:

```json
    "seasonMatchCount": "{{current}} vs {{last}} matchs",
    "activityCalendar": "Activité",
    "activityStreak": "{{count}} mois consécutifs",
    "activityInactiveGap": "{{count}} mois sans tournoi",
    "activityThisMonth": "{{count}} tournoi(s) ce mois",
    "activityDetailTitle": "Activité sur 12 mois",
    "activityDetailNoTournaments": "Aucun tournoi"
```

In `src/i18n/locales/en.json`:

```json
    "seasonMatchCount": "{{current}} vs {{last}} matches",
    "activityCalendar": "Activity",
    "activityStreak": "{{count}} months in a row",
    "activityInactiveGap": "{{count}} months without tournament",
    "activityThisMonth": "{{count}} tournament(s) this month",
    "activityDetailTitle": "12-month Activity",
    "activityDetailNoTournaments": "No tournaments"
```

- [ ] **Add i18n keys in both locale files**

### Step 3.5: Add `ActivityCalendarCard` component in `src/components/InsightsSection.tsx`

Add after `SeasonComparisonCard`:

```tsx
function ActivityCalendarCard({
  activeStreak,
  inactiveMonths,
  months,
  t,
}: {
  activeStreak: number;
  inactiveMonths: number;
  months: Array<{ tournamentCount: number }>;
  t: TFunction;
}) {
  // Body text: streak if 2+, else gap if 2+, else this-month count
  let bodyText: string;
  let bodyColor = '#2563eb';
  if (activeStreak >= 2) {
    bodyText = t('insights.activityStreak', { count: activeStreak });
    bodyColor = '#10b981';
  } else if (inactiveMonths >= 2) {
    bodyText = t('insights.activityInactiveGap', { count: inactiveMonths });
    bodyColor = '#f59e0b';
  } else {
    bodyText = t('insights.activityThisMonth', { count: months[0]?.tournamentCount ?? 0 });
  }

  // Mini heatmap: last 6 months, newest on the right (so reverse first 6 of months array)
  const recent = months.slice(0, 6).reverse();
  const intensityColor = (count: number): string => {
    if (count === 0) return '#e5e7eb';
    if (count === 1) return '#bbf7d0';
    return '#10b981';
  };

  return (
    <Card className="w-full items-center py-3 px-2">
      <Text className="text-caption text-muted uppercase">{t('insights.activityCalendar')}</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: bodyColor, marginVertical: 2 }}>
        {'📅 '}{bodyText}
      </Text>
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
        {recent.map((m, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              backgroundColor: intensityColor(m.tournamentCount),
            }}
          />
        ))}
      </View>
    </Card>
  );
}
```

- [ ] **Add `ActivityCalendarCard`**

### Step 3.6: Place Activity Calendar in the grid layout

Update `hasAny`:

```ts
  const hasAny =
    data.winStreak ||
    data.recentForm ||
    data.biggestUpset ||
    data.cpphMomentum ||
    data.bestTournament ||
    data.bestPartner ||
    data.mostPlayedPartner ||
    data.nemesis ||
    data.mostDefeated ||
    data.mostPlayed ||
    data.rankingProjection ||
    data.seasonComparison ||
    data.activityCalendar;
```

Add a new `GridRow` after the ranking projection / season comparison row, so the layout becomes:

```tsx
        <GridRow
          left={
            data.rankingProjection ? (
              <InsightPressable type="rankingProjection">
                <RankingProjectionCard
                  nextRank={data.rankingProjection.nextRank}
                  gap={data.rankingProjection.gap}
                  estimatedWins={data.rankingProjection.estimatedWins}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
          right={
            data.seasonComparison ? (
              <InsightPressable type="seasonComparison">
                <SeasonComparisonCard
                  winRateDelta={data.seasonComparison.winRateDelta}
                  currentMatchCount={data.seasonComparison.currentMatchCount}
                  lastMatchCount={data.seasonComparison.lastMatchCount}
                  isBetter={data.seasonComparison.isBetter}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
        />
        <GridRow
          left={
            data.activityCalendar ? (
              <InsightPressable type="activityCalendar">
                <ActivityCalendarCard
                  activeStreak={data.activityCalendar.activeStreak}
                  inactiveMonths={data.activityCalendar.inactiveMonths}
                  months={data.activityCalendar.months}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
          right={null}
        />
      </View>
```

- [ ] **Extend `hasAny` and add the new `GridRow` for `activityCalendar`**

### Step 3.7: Add detail screen header for Activity Calendar

In `app/(app)/insight-matches/[type].tsx`:

Add to `INSIGHT_BG`:

```ts
  seasonComparison: '#dcfce7',
  activityCalendar: '#e0e7ff',
};
```

Add the `activityCalendar` case to `getHeaderProps`:

```ts
    case 'activityCalendar': {
      const ac = insights.activityCalendar;
      if (!ac) return null;
      const totalTournaments = ac.months.reduce((s, m) => s + m.tournamentCount, 0);
      let title: string;
      if (ac.activeStreak >= 2) {
        title = t('insights.activityStreak', { count: ac.activeStreak });
      } else if (ac.inactiveMonths >= 2) {
        title = t('insights.activityInactiveGap', { count: ac.inactiveMonths });
      } else {
        title = t('insights.activityThisMonth', {
          count: ac.months[0]?.tournamentCount ?? 0,
        });
      }
      return {
        emoji: '📅',
        bgColor,
        label: t('insights.activityDetailTitle'),
        title,
        subtitle: t('insights.lastNMatches', { count: totalTournaments }),
      };
    }
```

- [ ] **Add the `INSIGHT_BG` entry and the `activityCalendar` case to `getHeaderProps`**

### Step 3.8: Typecheck

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Run typecheck and resolve any errors**

### Step 3.9: Manual verification on emulator

Reload the app on `emulator-5554`. On the dashboard:

1. If you have 3+ total matches AND at least one in the last 12 months, a new "📅 Activité" card appears.
2. The card shows either an active streak, an inactive gap, or this-month count — plus a 6-square mini heatmap (gray/light-green/green).
3. Tapping opens the detail screen with the header + a match list (all matches from the last 12 months).

- [ ] **Verify on emulator**

### Step 3.10: Commit

```bash
git add src/utils/insights.ts src/components/InsightsSection.tsx "app/(app)/insight-matches/[type].tsx" src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat(insights): add activity calendar card"
```

- [ ] **Commit**

---

## Final Verification

After all three tasks:

- [ ] **Run a final typecheck:** `npx tsc --noEmit` — expect no errors
- [ ] **Open the app on emulator-5554 and verify the full Insights section renders correctly:**
  - Existing cards still appear when their data is present
  - New cards appear only when their minimum thresholds are met
  - All cards are tappable and open detail screens
- [ ] **Pull-to-refresh on the dashboard** — verify nothing breaks after re-fetch
- [ ] **Switch language to English in Settings** — verify all new strings translate
