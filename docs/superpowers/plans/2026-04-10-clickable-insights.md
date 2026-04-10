# Clickable Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 8 dashboard insight cards clickable, each navigating to a filtered list of the matches that back that statistic. Move the Discipline Balance card from the dashboard to the Matches tab (where it respects the season filter).

**Architecture:** Add a `getMatchesForInsight` filter helper in `src/utils/insights.ts` that encapsulates all 8 insight→matches filter rules. A new dynamic route `app/(app)/insight-matches/[type].tsx` reads the insight type from URL params, calls `useDashboardData` + `useInsights` (both cached), and renders a header + `DetailMatchCard` list. Insights data gains a `licence` field on `bestPartner`, `nemesis`, and `mostPlayed` so entity-based filters don't rely on name matching.

**Tech Stack:** React Native (Expo SDK 54), expo-router (file-based dynamic routes), TypeScript, i18next. No test framework — verification is `npx tsc --noEmit` and manual runtime checks.

**Spec:** `docs/superpowers/specs/2026-04-10-clickable-insights-design.md`

---

## File Structure

**Modified files**
- `src/utils/insights.ts` — remove Discipline Balance compute+type, add `licence` fields, add `InsightType` + `getMatchesForInsight` helper
- `src/components/InsightsSection.tsx` — remove `DisciplineBalanceCard`, wrap remaining cards in a `Pressable` that navigates to the new route
- `app/(app)/_layout.tsx` — register `insight-matches/[type]` stack screen
- `app/(app)/(tabs)/matches.tsx` — add `DisciplineBalanceBar` inside `StatsHeader` (uses already-filtered `disciplineCounts`)
- `src/i18n/locales/fr.json` — add `insightMatches` block
- `src/i18n/locales/en.json` — add `insightMatches` block

**Created files**
- `app/(app)/insight-matches/[type].tsx` — new filtered match list screen

---

## Task 1: Update insights.ts — remove balance, add identifiers, add filter helper

**Files:**
- Modify: `src/utils/insights.ts`

- [ ] **Step 1: Remove `disciplineBalance` from the `InsightsData` interface**

Delete these lines from the interface in `src/utils/insights.ts`:

```ts
  disciplineBalance: {
    simple: number;
    double: number;
    mixte: number;
  } | null;
```

- [ ] **Step 2: Add `licence` identifier to bestPartner, nemesis, mostPlayed in `InsightsData`**

Change those three fields to:

```ts
  bestPartner: {
    name: string;
    licence: string;
    matchCount: number;
    winRate: number;
  } | null;
  nemesis: {
    name: string;
    licence: string;
    wins: number;
    losses: number;
  } | null;
  mostPlayed: {
    name: string;
    licence: string;
    matchCount: number;
    lastDate: string;
  } | null;
```

- [ ] **Step 3: Delete the `computeDisciplineBalance` function**

Remove the entire `computeDisciplineBalance` function (lines ~139-146 in the current file) and its `getDisciplineCounts` import if no longer used. Check: `getDisciplineCounts` is only referenced by `computeDisciplineBalance` inside this file, so remove the import as well:

```ts
import { getDisciplineCounts } from './matchHistory';
```

becomes:

```ts
// (import removed)
```

Keep `import type { MatchItem } from './matchHistory';`.

- [ ] **Step 4: Update `computeBestPartner` to populate `licence`**

Replace the function body so the accumulator tracks licence and the returned `best` includes it:

```ts
export function computeBestPartner(matches: MatchItem[]): InsightsData['bestPartner'] {
  const byPartner = new Map<string, { name: string; licence: string; wins: number; total: number }>();

  for (const m of matches) {
    if (!m.partnerLicence || !m.partner || m.isWin === undefined) continue;
    const stats = byPartner.get(m.partnerLicence) ?? { name: m.partner, licence: m.partnerLicence, wins: 0, total: 0 };
    stats.total++;
    if (m.isWin) stats.wins++;
    byPartner.set(m.partnerLicence, stats);
  }

  let best: InsightsData['bestPartner'] = null;
  let bestRate = 0;

  for (const [, stats] of byPartner) {
    if (stats.total < 3) continue;
    const winRate = Math.round((stats.wins / stats.total) * 100);
    if (winRate > bestRate || (winRate === bestRate && best && stats.total > best.matchCount)) {
      bestRate = winRate;
      best = { name: stats.name, licence: stats.licence, matchCount: stats.total, winRate };
    }
  }

  return best;
}
```

- [ ] **Step 5: Update `computeNemesis` to populate `licence`**

```ts
export function computeNemesis(matches: MatchItem[]): InsightsData['nemesis'] {
  const byOpponent = new Map<string, { name: string; licence: string; wins: number; losses: number }>();

  for (const m of matches) {
    if (!m.opponentLicence || !m.opponent || m.isWin === undefined) continue;
    const stats = byOpponent.get(m.opponentLicence) ?? { name: m.opponent, licence: m.opponentLicence, wins: 0, losses: 0 };
    if (m.isWin) stats.wins++;
    else stats.losses++;
    byOpponent.set(m.opponentLicence, stats);
  }

  let worst: InsightsData['nemesis'] = null;
  let mostLosses = 0;

  for (const [, stats] of byOpponent) {
    if (stats.losses < 2) continue;
    if (stats.losses > mostLosses) {
      mostLosses = stats.losses;
      worst = { name: stats.name, licence: stats.licence, wins: stats.wins, losses: stats.losses };
    }
  }

  return worst;
}
```

- [ ] **Step 6: Update `computeMostPlayed` to populate `licence`**

```ts
export function computeMostPlayed(opponents: OpponentListItem[]): InsightsData['mostPlayed'] {
  if (opponents.length === 0) return null;

  let top: OpponentListItem | null = null;
  for (const opp of opponents) {
    if (!top || opp.MatchCount > top.MatchCount) {
      top = opp;
    }
  }

  if (!top || top.MatchCount < 2) return null;

  return {
    name: top.PersonName,
    licence: top.PersonLicence,
    matchCount: top.MatchCount,
    lastDate: top.LastDate,
  };
}
```

- [ ] **Step 7: Remove `disciplineBalance` from `computeAllInsights`**

Delete the `disciplineBalance: computeDisciplineBalance(matches),` line from the returned object.

- [ ] **Step 8: Add `InsightType` + `getMatchesForInsight` at the bottom of the file**

Append to `src/utils/insights.ts`:

```ts
// ============================================================
// Filter: matches backing a given insight
// ============================================================

export type InsightType =
  | 'winStreak'
  | 'recentForm'
  | 'biggestUpset'
  | 'cpphMomentum'
  | 'bestTournament'
  | 'bestPartner'
  | 'nemesis'
  | 'mostPlayed';

export const INSIGHT_TYPES: readonly InsightType[] = [
  'winStreak',
  'recentForm',
  'biggestUpset',
  'cpphMomentum',
  'bestTournament',
  'bestPartner',
  'nemesis',
  'mostPlayed',
];

/**
 * Returns the subset of matches that back a given insight.
 * Input matches must be desc-sorted by date (same invariant as compute* functions).
 * Output preserves desc order (newest first).
 * Returns [] if the insight has no data.
 */
export function getMatchesForInsight(
  type: InsightType,
  matches: MatchItem[],
  insights: InsightsData
): MatchItem[] {
  switch (type) {
    case 'winStreak':
      return getWinStreakMatches(matches);
    case 'recentForm':
      return getRecentFormMatches(matches);
    case 'biggestUpset':
      return getBiggestUpsetMatches(matches);
    case 'cpphMomentum':
      return getCpphMomentumMatches(matches);
    case 'bestTournament':
      return insights.bestTournament
        ? matches.filter((m) => m.tournament === insights.bestTournament!.name)
        : [];
    case 'bestPartner':
      return insights.bestPartner
        ? matches.filter((m) => m.partnerLicence === insights.bestPartner!.licence)
        : [];
    case 'nemesis':
      return insights.nemesis
        ? matches.filter((m) => m.opponentLicence === insights.nemesis!.licence)
        : [];
    case 'mostPlayed':
      return insights.mostPlayed
        ? matches.filter((m) => m.opponentLicence === insights.mostPlayed!.licence)
        : [];
  }
}

function getWinStreakMatches(matches: MatchItem[]): MatchItem[] {
  // matches is desc-sorted. Walk oldest→newest; collect matches in longest streak.
  // Mirrors computeWinStreak: `undefined` neither extends nor resets.
  let maxStreakMatches: MatchItem[] = [];
  let curStreak: MatchItem[] = [];

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.isWin === true) {
      curStreak.push(m);
      if (curStreak.length > maxStreakMatches.length) {
        maxStreakMatches = curStreak.slice();
      }
    } else if (m.isWin === false) {
      curStreak = [];
    }
  }

  if (maxStreakMatches.length < 2) return [];
  // Collected oldest→newest; caller expects desc order (newest first)
  return maxStreakMatches.reverse();
}

function getRecentFormMatches(matches: MatchItem[]): MatchItem[] {
  const last5: MatchItem[] = [];
  for (const m of matches) {
    if (m.isWin !== undefined) {
      last5.push(m);
      if (last5.length === 5) break;
    }
  }
  if (last5.length < 3) return [];
  return last5;
}

function getBiggestUpsetMatches(matches: MatchItem[]): MatchItem[] {
  let bestGap = 0;
  let bestMatch: MatchItem | null = null;

  for (const m of matches) {
    if (m.isWin !== true) continue;
    const oppIdx = rankIndex(m.opponentRank);
    const playerIdx = rankIndex(m.playerRank);
    if (oppIdx === null || playerIdx === null) continue;

    const gap = playerIdx - oppIdx;
    if (gap > bestGap) {
      bestGap = gap;
      bestMatch = m;
    }
  }

  if (!bestMatch || bestGap < 2) return [];
  return [bestMatch];
}

function getCpphMomentumMatches(matches: MatchItem[]): MatchItem[] {
  const last10: MatchItem[] = [];
  for (const m of matches) {
    if (m.pointsImpact != null && m.pointsImpact !== 0) {
      last10.push(m);
      if (last10.length === 10) break;
    }
  }
  if (last10.length < 3) return [];
  return last10;
}
```

- [ ] **Step 9: Verify TypeScript compiles (expect errors in InsightsSection.tsx — that's Task 2)**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: errors only in `src/components/InsightsSection.tsx` referencing `disciplineBalance`. No errors in `insights.ts` itself. If there are errors in `insights.ts`, fix them before continuing.

- [ ] **Step 10: Don't commit yet — Task 2 must complete first to restore the TS build**

---

## Task 2: Remove DisciplineBalanceCard from InsightsSection

**Files:**
- Modify: `src/components/InsightsSection.tsx`

- [ ] **Step 1: Delete the `DisciplineBalanceCard` function**

Remove the entire `DisciplineBalanceCard` function definition (the one that takes `{ simple, double: dbl, mixte, t }`). Leave other card sub-components untouched.

- [ ] **Step 2: Remove `disciplineBalance` from the `hasAny` check**

In `InsightsSection`, the current `hasAny` computation is:

```ts
  const hasAny =
    data.winStreak ||
    data.recentForm ||
    data.biggestUpset ||
    data.cpphMomentum ||
    data.disciplineBalance ||
    data.bestTournament ||
    data.bestPartner ||
    data.nemesis ||
    data.mostPlayed;
```

Change to:

```ts
  const hasAny =
    data.winStreak ||
    data.recentForm ||
    data.biggestUpset ||
    data.cpphMomentum ||
    data.bestTournament ||
    data.bestPartner ||
    data.nemesis ||
    data.mostPlayed;
```

- [ ] **Step 3: Remove the `DisciplineBalanceCard` JSX block**

In the JSX, delete this block:

```tsx
        {data.disciplineBalance && (
          <DisciplineBalanceCard
            simple={data.disciplineBalance.simple}
            double={data.disciplineBalance.double}
            mixte={data.disciplineBalance.mixte}
            t={t}
          />
        )}
```

- [ ] **Step 4: Verify TypeScript passes**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit Tasks 1 + 2 together**

```bash
git add src/utils/insights.ts src/components/InsightsSection.tsx
git commit -m "refactor(insights): add licence IDs, drop discipline balance"
```

---

## Task 3: Add `insightMatches` i18n strings

**Files:**
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add `insightMatches` block to `fr.json`**

Insert before the closing `}` at end of file, after the `insights` block (add a comma after the closing brace of `insights`):

```json
  "insightMatches": {
    "title": "Matchs",
    "empty": "Aucun match à afficher"
  }
```

- [ ] **Step 2: Add `insightMatches` block to `en.json`**

Same structure with English strings:

```json
  "insightMatches": {
    "title": "Matches",
    "empty": "No matches to display"
  }
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/fr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"`

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "i18n: add insightMatches strings"
```

---

## Task 4: Create the `insight-matches/[type]` screen

**Files:**
- Create: `app/(app)/insight-matches/[type].tsx`

- [ ] **Step 1: Create the directory and file**

Create `app/(app)/insight-matches/[type].tsx` with this full contents:

```tsx
import { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSession } from '../../../src/auth/context';
import { useDashboardData } from '../../../src/hooks/useDashboardData';
import { useInsights } from '../../../src/hooks/useInsights';
import { DetailMatchCard } from '../../../src/components';
import {
  getMatchesForInsight,
  INSIGHT_TYPES,
  type InsightType,
  type InsightsData,
} from '../../../src/utils/insights';

interface HeaderInfo {
  emoji: string;
  label: string;
  title: string;
  subtitle: string;
}

function isValidInsightType(x: string | undefined): x is InsightType {
  return !!x && (INSIGHT_TYPES as readonly string[]).includes(x);
}

function getHeaderInfo(
  type: InsightType,
  insights: InsightsData,
  t: TFunction
): HeaderInfo | null {
  switch (type) {
    case 'winStreak':
      if (!insights.winStreak) return null;
      return {
        emoji: '🔥',
        label: t('insights.longestStreak'),
        title: `${insights.winStreak.count}`,
        subtitle: t('insights.consecutiveWins'),
      };
    case 'recentForm':
      if (!insights.recentForm) return null;
      return {
        emoji: '📊',
        label: t('insights.recentForm'),
        title: t('insights.lastNMatches', { count: insights.recentForm.results.length }),
        subtitle: '',
      };
    case 'biggestUpset':
      if (!insights.biggestUpset) return null;
      return {
        emoji: '💥',
        label: t('insights.biggestUpset'),
        title: t('insights.vsRank', { rank: insights.biggestUpset.opponentRank }),
        subtitle: t('insights.youWere', { rank: insights.biggestUpset.playerRank }),
      };
    case 'cpphMomentum': {
      if (!insights.cpphMomentum) return null;
      const total = insights.cpphMomentum.total;
      const sign = total >= 0 ? '+' : '';
      return {
        emoji: total >= 0 ? '↑' : '↓',
        label: t('insights.cpphMomentum'),
        title: `${sign}${total.toFixed(1)}`,
        subtitle: t('insights.lastNMatches', { count: insights.cpphMomentum.matchCount }),
      };
    }
    case 'bestTournament':
      if (!insights.bestTournament) return null;
      return {
        emoji: '🏆',
        label: t('insights.bestTournament'),
        title: insights.bestTournament.name,
        subtitle: t('insights.tournamentStats', {
          wins: insights.bestTournament.wins,
          losses: insights.bestTournament.losses,
          rate: insights.bestTournament.winRate,
        }),
      };
    case 'bestPartner':
      if (!insights.bestPartner) return null;
      return {
        emoji: '🤝',
        label: t('insights.bestPartner'),
        title: insights.bestPartner.name,
        subtitle: t('insights.partnerStats', {
          count: insights.bestPartner.matchCount,
          rate: insights.bestPartner.winRate,
        }),
      };
    case 'nemesis':
      if (!insights.nemesis) return null;
      return {
        emoji: '⚔️',
        label: t('insights.nemesis'),
        title: insights.nemesis.name,
        subtitle: t('insights.nemesisStats', {
          wins: insights.nemesis.wins,
          losses: insights.nemesis.losses,
        }),
      };
    case 'mostPlayed':
      if (!insights.mostPlayed) return null;
      return {
        emoji: '🔄',
        label: t('insights.mostPlayed'),
        title: insights.mostPlayed.name,
        subtitle: t('insights.mostPlayedStats', {
          count: insights.mostPlayed.matchCount,
          date: insights.mostPlayed.lastDate,
        }),
      };
  }
}

export default function InsightMatchesScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const params = useLocalSearchParams<{ type: string }>();
  const type = params.type;
  const isValid = isValidInsightType(type);

  const { allDetailMatches, detailsLoading } = useDashboardData();
  const insights = useInsights(allDetailMatches, detailsLoading);

  const playerName = session ? `${session.prenom} ${session.nom}` : undefined;

  const filteredMatches = useMemo(() => {
    if (!isValid || !insights) return [];
    return getMatchesForInsight(type as InsightType, allDetailMatches, insights);
  }, [isValid, type, allDetailMatches, insights]);

  const headerInfo = useMemo(() => {
    if (!isValid || !insights) return null;
    return getHeaderInfo(type as InsightType, insights, t);
  }, [isValid, type, insights, t]);

  if (!isValid) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Stack.Screen options={{ title: t('insightMatches.title') }} />
        <Text className="text-body text-gray-400 italic">{t('insightMatches.empty')}</Text>
      </View>
    );
  }

  if (!insights) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: t('insightMatches.title') }} />
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: t('insightMatches.title') }} />
      <FlatList
        data={filteredMatches}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          headerInfo ? (
            <View className="px-4 py-4 border-b border-gray-100">
              <Text className="text-caption text-muted uppercase mb-1">{headerInfo.label}</Text>
              <Text className="text-title font-bold text-gray-900 mb-0.5">
                {headerInfo.emoji} {headerInfo.title}
              </Text>
              {headerInfo.subtitle ? (
                <Text className="text-body text-muted">{headerInfo.subtitle}</Text>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text className="text-body text-gray-400 italic text-center py-10 px-6">
            {t('insightMatches.empty')}
          </Text>
        }
        renderItem={({ item }) => (
          <DetailMatchCard match={item} nested={false} playerName={playerName} />
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors. If `TFunction` import fails, try `import type { TFunction } from 'i18next';` (already present in `InsightsSection.tsx` — the same pattern).

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/insight-matches/\[type\].tsx
git commit -m "feat: add insight matches screen"
```

---

## Task 5: Register the new screen in the stack

**Files:**
- Modify: `app/(app)/_layout.tsx`

- [ ] **Step 1: Add the new `Stack.Screen` entry**

Inside the `<Stack>` children in `app/(app)/_layout.tsx`, after the `club/[clubId]` screen (or anywhere in the list), add:

```tsx
      <Stack.Screen
        name="insight-matches/[type]"
        options={{
          headerShown: true,
          headerTitle: t('insightMatches.title'),
          headerBackTitle: '',
        }}
      />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/_layout.tsx
git commit -m "feat: register insight matches route"
```

---

## Task 6: Make insight cards clickable

**Files:**
- Modify: `src/components/InsightsSection.tsx`

- [ ] **Step 1: Import `Pressable` and `router`**

At the top of `src/components/InsightsSection.tsx`, add `Pressable` to the existing `react-native` import, and add:

```tsx
import { router } from 'expo-router';
import type { InsightType } from '../utils/insights';
```

Change:

```tsx
import { View, Text } from 'react-native';
```

to:

```tsx
import { View, Text, Pressable } from 'react-native';
```

- [ ] **Step 2: Add a small wrapper helper inside the file**

Right before the `InsightsSection` function (near the bottom), add:

```tsx
function InsightPressable({
  type,
  children,
  style,
}: {
  type: InsightType;
  children: React.ReactNode;
  style?: { flex?: number };
}) {
  return (
    <Pressable
      onPress={() => router.push(`/insight-matches/${type}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, ...style })}
    >
      {children}
    </Pressable>
  );
}
```

This mirrors the press feedback pattern already used on the dashboard rankings cards (`opacity: pressed ? 0.7 : 1`).

- [ ] **Step 3: Wrap the 2-column grid cards in `InsightPressable`**

Replace the two `GridRow` blocks in the `InsightsSection` JSX:

```tsx
        <GridRow
          left={data.winStreak ? <WinStreakCard count={data.winStreak.count} t={t} /> : null}
          right={data.recentForm ? <RecentFormCard results={data.recentForm.results} t={t} /> : null}
        />
        <GridRow
          left={data.biggestUpset ? <BiggestUpsetCard opponentRank={data.biggestUpset.opponentRank} playerRank={data.biggestUpset.playerRank} t={t} /> : null}
          right={data.cpphMomentum ? <CpphMomentumCard total={data.cpphMomentum.total} matchCount={data.cpphMomentum.matchCount} t={t} /> : null}
        />
```

with:

```tsx
        <GridRow
          left={
            data.winStreak ? (
              <InsightPressable type="winStreak" style={{ flex: 1 }}>
                <WinStreakCard count={data.winStreak.count} t={t} />
              </InsightPressable>
            ) : null
          }
          right={
            data.recentForm ? (
              <InsightPressable type="recentForm" style={{ flex: 1 }}>
                <RecentFormCard results={data.recentForm.results} t={t} />
              </InsightPressable>
            ) : null
          }
        />
        <GridRow
          left={
            data.biggestUpset ? (
              <InsightPressable type="biggestUpset" style={{ flex: 1 }}>
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
              <InsightPressable type="cpphMomentum" style={{ flex: 1 }}>
                <CpphMomentumCard
                  total={data.cpphMomentum.total}
                  matchCount={data.cpphMomentum.matchCount}
                  t={t}
                />
              </InsightPressable>
            ) : null
          }
        />
```

- [ ] **Step 4: Wrap the 4 full-width cards**

Replace the second `<View style={{ gap: 10 }}>` block JSX:

```tsx
      <View style={{ gap: 10 }}>
        {data.bestTournament && (
          <FullWidthCard
            emoji="🏆"
            bgColor="#fef3c7"
            label={t('insights.bestTournament')}
            title={data.bestTournament.name}
            subtitle={t('insights.tournamentStats', {
              wins: data.bestTournament.wins,
              losses: data.bestTournament.losses,
              rate: data.bestTournament.winRate,
            })}
          />
        )}
        {data.bestPartner && (
          <FullWidthCard
            emoji="🤝"
            bgColor="#dbeafe"
            label={t('insights.bestPartner')}
            title={data.bestPartner.name}
            subtitle={t('insights.partnerStats', {
              count: data.bestPartner.matchCount,
              rate: data.bestPartner.winRate,
            })}
          />
        )}
        {data.nemesis && (
          <FullWidthCard
            emoji="⚔️"
            bgColor="#fee2e2"
            label={t('insights.nemesis')}
            title={data.nemesis.name}
            subtitle={t('insights.nemesisStats', {
              wins: data.nemesis.wins,
              losses: data.nemesis.losses,
            })}
          />
        )}
        {data.mostPlayed && (
          <FullWidthCard
            emoji="🔄"
            bgColor="#f0fdf4"
            label={t('insights.mostPlayed')}
            title={data.mostPlayed.name}
            subtitle={t('insights.mostPlayedStats', {
              count: data.mostPlayed.matchCount,
              date: data.mostPlayed.lastDate,
            })}
          />
        )}
      </View>
```

with:

```tsx
      <View style={{ gap: 10 }}>
        {data.bestTournament && (
          <InsightPressable type="bestTournament">
            <FullWidthCard
              emoji="🏆"
              bgColor="#fef3c7"
              label={t('insights.bestTournament')}
              title={data.bestTournament.name}
              subtitle={t('insights.tournamentStats', {
                wins: data.bestTournament.wins,
                losses: data.bestTournament.losses,
                rate: data.bestTournament.winRate,
              })}
            />
          </InsightPressable>
        )}
        {data.bestPartner && (
          <InsightPressable type="bestPartner">
            <FullWidthCard
              emoji="🤝"
              bgColor="#dbeafe"
              label={t('insights.bestPartner')}
              title={data.bestPartner.name}
              subtitle={t('insights.partnerStats', {
                count: data.bestPartner.matchCount,
                rate: data.bestPartner.winRate,
              })}
            />
          </InsightPressable>
        )}
        {data.nemesis && (
          <InsightPressable type="nemesis">
            <FullWidthCard
              emoji="⚔️"
              bgColor="#fee2e2"
              label={t('insights.nemesis')}
              title={data.nemesis.name}
              subtitle={t('insights.nemesisStats', {
                wins: data.nemesis.wins,
                losses: data.nemesis.losses,
              })}
            />
          </InsightPressable>
        )}
        {data.mostPlayed && (
          <InsightPressable type="mostPlayed">
            <FullWidthCard
              emoji="🔄"
              bgColor="#f0fdf4"
              label={t('insights.mostPlayed')}
              title={data.mostPlayed.name}
              subtitle={t('insights.mostPlayedStats', {
                count: data.mostPlayed.matchCount,
                date: data.mostPlayed.lastDate,
              })}
            />
          </InsightPressable>
        )}
      </View>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/InsightsSection.tsx
git commit -m "feat: make dashboard insights clickable"
```

---

## Task 7: Add Discipline Balance bar to Matches tab

**Files:**
- Modify: `app/(app)/(tabs)/matches.tsx`

- [ ] **Step 1: Pass `disciplineCounts` into `StatsHeader`**

In `app/(app)/(tabs)/matches.tsx`, find the `StatsHeader` usage inside the Animated header and its props interface.

Update the `StatsHeaderProps` interface to add `disciplineCounts`:

```tsx
interface StatsHeaderProps {
  stats: { wins: number; losses: number; total: number; winPercentage: number };
  isStatsSettled: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  disciplineStats: DisciplineStats;
  disciplineCounts: Record<DisciplineFilter, number>;
}
```

Update the `StatsHeader` call site:

```tsx
        <StatsHeader
          stats={stats}
          isStatsSettled={isStatsSettled}
          t={t}
          disciplineStats={disciplineStats}
          disciplineCounts={disciplineCounts}
        />
```

- [ ] **Step 2: Add a `DisciplineBalanceBar` sub-component**

Right before the `StatsHeader` function definition, add:

```tsx
function DisciplineBalanceBar({
  counts,
  t,
}: {
  counts: Record<DisciplineFilter, number>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const simple = counts.simple;
  const dbl = counts.double;
  const mixte = counts.mixte;
  const total = simple + dbl + mixte;
  if (total === 0) return null;

  const sPct = Math.round((simple / total) * 100);
  const dPct = Math.round((dbl / total) * 100);
  const mPct = 100 - sPct - dPct;

  return (
    <View style={{ marginTop: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          gap: 3,
          height: 18,
          borderRadius: 9,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {simple > 0 && (
          <View
            style={{
              flex: sPct,
              backgroundColor: DISC_SOLID_COLORS.simple,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>S {sPct}%</Text>
          </View>
        )}
        {dbl > 0 && (
          <View
            style={{
              flex: dPct,
              backgroundColor: DISC_SOLID_COLORS.double,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>D {dPct}%</Text>
          </View>
        )}
        {mixte > 0 && (
          <View
            style={{
              flex: mPct,
              backgroundColor: DISC_SOLID_COLORS.mixte,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>M {mPct}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Render `DisciplineBalanceBar` inside `StatsHeader`**

In the `StatsHeader` function, after the "Per-discipline pills" `<View>`, and still inside the outer padding `<View>`, add:

```tsx
        <DisciplineBalanceBar counts={disciplineCounts} t={t} />
```

Full updated `StatsHeader` body (for reference — the new line is the last child before the closing `</View>`s):

```tsx
function StatsHeader({ stats, isStatsSettled, t, disciplineStats, disciplineCounts }: StatsHeaderProps) {
  return (
    <LinearGradient colors={['#1e293b', '#0f172a']} style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 12, flex: 1 }}>
        {/* Top row: Donut + text stats */}
        {/* ...unchanged... */}

        {/* Per-discipline pills */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* ...unchanged... */}
        </View>

        {/* Discipline balance bar */}
        <DisciplineBalanceBar counts={disciplineCounts} t={t} />
      </View>
    </LinearGradient>
  );
}
```

The header height constant `HEADER_MAX_HEIGHT = 180` may need a small bump to fit the new 18px bar + 10px margin. Change:

```tsx
const HEADER_MAX_HEIGHT = 180;
```

to:

```tsx
const HEADER_MAX_HEIGHT = 210;
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/\(tabs\)/matches.tsx
git commit -m "feat: add discipline balance bar to matches tab"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 2: Check nothing references removed symbols**

Run a grep to confirm no stale references:

Use the Grep tool with pattern `disciplineBalance|computeDisciplineBalance|DisciplineBalanceCard` across the repo.

Expected: only matches in `docs/` (spec + this plan) and possibly `.claude/worktrees/`. Zero matches in `src/` or `app/`. If any appear, fix before moving on.

- [ ] **Step 3: Verify commits are in order**

Run: `git log --oneline -10`

Expected (most recent first):
```
feat: add discipline balance bar to matches tab
feat: make dashboard insights clickable
feat: register insight matches route
feat: add insight matches screen
i18n: add insightMatches strings
refactor(insights): add licence IDs, drop discipline balance
```

- [ ] **Step 4: Done**

Implementation complete. Notify the user and run `/simplify` on the changed files.
