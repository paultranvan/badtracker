# Club Leaderboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the club leaderboard's search-based data source with `/api/search/tops` to display CPPH points, player categories, sex, and proper point-based sorting.

**Architecture:** New `getClubTops()` fetches all 6 gendered disciplines in parallel, merges by licence into rich `LeaderboardEntry` records. Hook keeps cache-first pattern with stale-while-revalidate. UI shows all 3 discipline ranks with points, category badges, sex emoji, and sort indicators.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, NativeWind (Tailwind CSS), i18next, AsyncStorage cache

---

### Task 1: New LeaderboardEntry type and merge logic

**Files:**
- Modify: `src/utils/clubLeaderboard.ts` (full rewrite)

**Step 1: Replace the entire file with new types and merge logic**

Replace `src/utils/clubLeaderboard.ts` with:

```typescript
// ============================================================
// Types
// ============================================================

export interface DisciplineRanking {
  subLevel: string;       // "D9", "P10", "-"
  rate: number | null;    // CPPH points, null if unranked
  rank: number;           // national position within this discipline
}

export interface LeaderboardEntry {
  licence: string;
  personId: number;
  name: string;           // full name from API ("Paul TRAN-VAN")
  category: string;       // "Senior", "Veteran 1", "Junior 2", etc.
  sex: 'M' | 'F';
  simple: DisciplineRanking | null;
  double: DisciplineRanking | null;
  mixte: DisciplineRanking | null;
  bestRate: number | null;
  bestSubLevel: string;
  bestDiscipline: 'simple' | 'double' | 'mixte' | null;
  position: number;       // assigned after sorting
}

export type ClubDisciplineFilter = 'all' | 'simple' | 'double' | 'mixte';
export type ClubGenderFilter = 'all' | 'M' | 'F';

// ============================================================
// Raw API item shape from /api/search/tops
// ============================================================

export interface TopsApiItem {
  rank: number;
  rate: number | null;
  realRate: number | null;
  subLevel: string;
  personId: number;
  name: string;
  licence: string;
  category: string;
  club: { id: number; name: string; acronym: string };
  frenchRank: number;
  federalRank: number;
  [key: string]: unknown;
}

// Discipline numbers: 1=SH, 2=SD, 3=DH, 4=DD, 5=MXH, 6=MXD
type DisciplineNumber = 1 | 2 | 3 | 4 | 5 | 6;

const DISCIPLINE_MAP: Record<DisciplineNumber, { field: 'simple' | 'double' | 'mixte'; sex: 'M' | 'F' }> = {
  1: { field: 'simple', sex: 'M' },
  2: { field: 'simple', sex: 'F' },
  3: { field: 'double', sex: 'M' },
  4: { field: 'double', sex: 'F' },
  5: { field: 'mixte', sex: 'M' },
  6: { field: 'mixte', sex: 'F' },
};

// ============================================================
// Merge logic
// ============================================================

interface PartialPlayer {
  licence: string;
  personId: number;
  name: string;
  category: string;
  sex: 'M' | 'F';
  simple: DisciplineRanking | null;
  double: DisciplineRanking | null;
  mixte: DisciplineRanking | null;
}

/**
 * Merge responses from all 6 /api/search/tops calls into a single LeaderboardEntry[].
 *
 * @param results - Array of 6 tuples: [disciplineNumber, items]
 */
export function mergeTopsResults(
  results: Array<[DisciplineNumber, TopsApiItem[]]>
): LeaderboardEntry[] {
  const byLicence = new Map<string, PartialPlayer>();

  for (const [discipline, items] of results) {
    const mapping = DISCIPLINE_MAP[discipline];
    if (!mapping) continue;

    for (const item of items) {
      if (!item.licence) continue;

      let player = byLicence.get(item.licence);
      if (!player) {
        player = {
          licence: item.licence,
          personId: item.personId,
          name: item.name,
          category: item.category,
          sex: mapping.sex,
          simple: null,
          double: null,
          mixte: null,
        };
        byLicence.set(item.licence, player);
      }

      // Update category/name if this entry has newer data
      if (item.category) player.category = item.category;
      if (item.name) player.name = item.name;

      player[mapping.field] = {
        subLevel: item.subLevel ?? '-',
        rate: item.rate ?? null,
        rank: item.rank,
      };
    }
  }

  // Compute bestRate + bestSubLevel + bestDiscipline, assign positions
  const entries: LeaderboardEntry[] = Array.from(byLicence.values()).map((p) => {
    let bestRate: number | null = null;
    let bestSubLevel = 'NC';
    let bestDiscipline: 'simple' | 'double' | 'mixte' | null = null;

    for (const disc of ['simple', 'double', 'mixte'] as const) {
      const ranking = p[disc];
      if (ranking?.rate != null && (bestRate === null || ranking.rate > bestRate)) {
        bestRate = ranking.rate;
        bestSubLevel = ranking.subLevel;
        bestDiscipline = disc;
      }
    }

    return { ...p, bestRate, bestSubLevel, bestDiscipline, position: 0 };
  });

  // Sort by bestRate descending, null last
  entries.sort((a, b) => {
    if (a.bestRate === null && b.bestRate === null) return 0;
    if (a.bestRate === null) return 1;
    if (b.bestRate === null) return -1;
    return b.bestRate - a.bestRate;
  });

  // Assign 1-based positions
  return entries.map((entry, i) => ({ ...entry, position: i + 1 }));
}

// ============================================================
// Sort and filter
// ============================================================

/**
 * Get the rate to sort by for a given entry and discipline+gender filter combo.
 * Returns null if no data for that discipline.
 */
function getSortRate(
  entry: LeaderboardEntry,
  discipline: ClubDisciplineFilter
): number | null {
  switch (discipline) {
    case 'simple': return entry.simple?.rate ?? null;
    case 'double': return entry.double?.rate ?? null;
    case 'mixte': return entry.mixte?.rate ?? null;
    default: return entry.bestRate;
  }
}

/**
 * Get the discipline key used for sorting, for sort indicator purposes.
 */
export function getSortDiscipline(
  entry: LeaderboardEntry,
  discipline: ClubDisciplineFilter
): 'simple' | 'double' | 'mixte' | null {
  switch (discipline) {
    case 'simple': return 'simple';
    case 'double': return 'double';
    case 'mixte': return 'mixte';
    default: return entry.bestDiscipline;
  }
}

/**
 * Sort leaderboard by the selected discipline's rate (descending).
 * Re-assigns 1-based positions after sorting.
 */
export function sortLeaderboardByDiscipline(
  entries: LeaderboardEntry[],
  discipline: ClubDisciplineFilter
): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const rateA = getSortRate(a, discipline);
    const rateB = getSortRate(b, discipline);
    if (rateA === null && rateB === null) return 0;
    if (rateA === null) return 1;
    if (rateB === null) return -1;
    return rateB - rateA;
  });

  return sorted.map((entry, i) => ({ ...entry, position: i + 1 }));
}

/**
 * Filter leaderboard entries by gender, then re-assign positions.
 */
export function filterByGender(
  entries: LeaderboardEntry[],
  gender: ClubGenderFilter
): LeaderboardEntry[] {
  if (gender === 'all') return entries;
  const filtered = entries.filter((e) => e.sex === gender);
  return filtered.map((entry, i) => ({ ...entry, position: i + 1 }));
}

// ============================================================
// Category abbreviation
// ============================================================

/**
 * Abbreviate a category string for compact display.
 * "Senior" -> "Sen", "Veteran 1" -> "V1", "Junior 2" -> "J2",
 * "Minime 1" -> "M1", "Cadet 2" -> "C2", "Benjamin 2" -> "B2",
 * "Poussin 2" -> "P2", "Minibad" -> "Mini"
 */
export function abbreviateCategory(category: string): string {
  if (!category) return '';
  const lower = category.toLowerCase();
  if (lower === 'senior') return 'Sen';
  if (lower === 'minibad') return 'Mini';

  // Pattern: "Type N" -> first letter + N
  const match = category.match(/^(\w+)\s+(\d+)$/);
  if (match) {
    const type = match[1].charAt(0).toUpperCase();
    return `${type}${match[2]}`;
  }

  // Fallback: first 3 chars
  return category.slice(0, 3);
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to clubLeaderboard.ts (other files that import from it will break — that's expected, fixed in later tasks)

**Step 3: Commit**

```bash
git add src/utils/clubLeaderboard.ts
git commit -m "refactor: rewrite clubLeaderboard types and merge logic for /api/search/tops"
```

---

### Task 2: New getClubTops API function

**Files:**
- Modify: `src/api/ffbad.ts:922-1038` (replace `getClubLeaderboard` with `getClubTops`)

**Step 1: Replace `getClubLeaderboard` with `getClubTops`**

Remove the `getClubLeaderboard` function (lines 922-1038) and replace with:

```typescript
/**
 * Discipline numbers for /api/search/tops endpoint.
 * 1=Simple Hommes, 2=Simple Dames, 3=Double Hommes,
 * 4=Double Dames, 5=Mixte Hommes, 6=Mixte Dames.
 */
const TOPS_DISCIPLINES = [1, 2, 3, 4, 5, 6] as const;

/**
 * Fetch club leaderboard using /api/search/tops for all 6 disciplines.
 * Returns raw arrays per discipline for merging by the caller.
 *
 * Each call: POST /api/search/tops with body:
 *   { discipline, dateFrom, top: 500, instanceId: clubId, isFirstLoad: false, sort: "nom-ASC" }
 *
 * Partial failures are tolerated — if some disciplines fail, the successful ones are returned.
 * Throws only if ALL 6 calls fail.
 */
export async function getClubTops(
  clubId: string
): Promise<Array<[number, Array<Record<string, unknown>>]>> {
  const session = requireSession();
  const instanceId = parseInt(clubId, 10);
  const dateFrom = new Date().toISOString();

  const results = await Promise.allSettled(
    TOPS_DISCIPLINES.map(async (discipline) => {
      const data = await bridgePost(
        '/api/search/tops',
        {
          discipline,
          dateFrom,
          top: 500,
          instanceId,
          isFirstLoad: false,
          sort: 'nom-ASC',
        },
        session.accessToken,
        session.personId
      );

      if (!data || !Array.isArray(data)) {
        return [discipline, []] as [number, Array<Record<string, unknown>>];
      }

      return [discipline, data as Array<Record<string, unknown>>] as [number, Array<Record<string, unknown>>];
    })
  );

  const successful = results
    .filter((r): r is PromiseFulfilledResult<[number, Array<Record<string, unknown>>]> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (successful.length === 0) {
    throw new NetworkError('All discipline fetches failed');
  }

  return successful;
}
```

Also update the import at the top of `ffbad.ts` — remove `ClubRankingResponse` from the schemas import (line 8) since it's no longer used by `getClubTops`. The type is still exported from schemas.ts so no schema file changes needed.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors in `useClubLeaderboard.ts` (it still imports `getClubLeaderboard`) — fixed in Task 3.

**Step 3: Commit**

```bash
git add src/api/ffbad.ts
git commit -m "feat: add getClubTops using /api/search/tops for all 6 disciplines"
```

---

### Task 3: Update useClubLeaderboard hook

**Files:**
- Modify: `src/hooks/useClubLeaderboard.ts` (rewrite fetch logic)

**Step 1: Rewrite the hook to use getClubTops + mergeTopsResults**

Replace the full file content:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getClubTops, getClubInfo, type ClubInfo } from '../api/ffbad';
import { NetworkError } from '../api/errors';
import { cacheGet, cacheSet } from '../cache/storage';
import { useConnectivity } from '../connectivity/context';
import {
  mergeTopsResults,
  type LeaderboardEntry,
  type TopsApiItem,
} from '../utils/clubLeaderboard';

// ============================================================
// Types
// ============================================================

export interface ClubLeaderboardData {
  members: LeaderboardEntry[];
  clubName: string;
  clubInfo: ClubInfo | null;
  rankedCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface CachedClubTops {
  members: LeaderboardEntry[];
  clubName: string;
  clubInfo: ClubInfo | null;
}

// ============================================================
// Hook
// ============================================================

/**
 * Fetches and manages club leaderboard using /api/search/tops.
 * Fetches all 6 disciplines in parallel, merges by licence.
 *
 * Cache-first: reads cached data immediately, refreshes in background
 * if online. Falls back to cache when offline.
 */
export function useClubLeaderboard(clubId: string | null): ClubLeaderboardData {
  const { t } = useTranslation();
  const { isConnected } = useConnectivity();

  const [members, setMembers] = useState<LeaderboardEntry[]>([]);
  const [clubName, setClubName] = useState('');
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [rankedCount, setRankedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCachedData = useRef(false);
  const prevConnected = useRef(isConnected);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!clubId) {
        setIsLoading(false);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Step 1: Read from cache
      if (!isRefresh) {
        const cached = await cacheGet<CachedClubTops>(`club-tops:${clubId}`);
        if (cached) {
          setMembers(cached.members);
          setClubName(cached.clubName);
          setClubInfo(cached.clubInfo ?? null);
          setRankedCount(cached.members.filter((m) => m.bestRate !== null).length);
          hasCachedData.current = true;
          if (!isConnected) {
            setIsLoading(false);
            return;
          }
        } else if (!isConnected) {
          setError(t('club.networkError'));
          setIsLoading(false);
          return;
        }
      }

      // Step 2: Fetch club info and tops in parallel
      try {
        const [info, topsResults] = await Promise.all([
          getClubInfo(clubId),
          getClubTops(clubId),
        ]);

        if (info) {
          setClubInfo(info);
          setClubName(info.name);
        }

        const merged = mergeTopsResults(
          topsResults as Array<[1 | 2 | 3 | 4 | 5 | 6, TopsApiItem[]]>
        );

        setMembers(merged);
        const ranked = merged.filter((m) => m.bestRate !== null).length;
        setRankedCount(ranked);

        // Step 3: Update cache
        cacheSet(`club-tops:${clubId}`, {
          members: merged,
          clubName: info?.name ?? '',
          clubInfo: info,
        });
        hasCachedData.current = true;
      } catch (err) {
        if (hasCachedData.current) {
          // Silently use cached data on error
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
        if (err instanceof NetworkError) {
          setError(t('club.networkError'));
        } else {
          setError(t('club.loadError'));
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [clubId, t, isConnected]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!cancelled) {
        await fetchData(false);
      }
    };

    if (clubId) {
      setIsLoading(true);
      load();
    } else {
      setMembers([]);
      setClubName('');
      setClubInfo(null);
      setRankedCount(0);
      setIsLoading(false);
      setError(null);
    }

    return () => {
      cancelled = true;
    };
  }, [clubId, fetchData]);

  // Auto-refresh when connectivity returns
  useEffect(() => {
    if (!prevConnected.current && isConnected && clubId) {
      fetchData(true);
    }
    prevConnected.current = isConnected;
  }, [isConnected, clubId, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    members,
    clubName,
    clubInfo,
    rankedCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors in `club.tsx` (it imports old types like `LeaderboardEntry` with old fields) — fixed in Task 4.

**Step 3: Commit**

```bash
git add src/hooks/useClubLeaderboard.ts
git commit -m "refactor: switch useClubLeaderboard to getClubTops with 6-discipline merge"
```

---

### Task 4: Update club.tsx UI — imports and ClubMemberRow

**Files:**
- Modify: `app/(app)/(tabs)/club.tsx`

**Step 1: Update imports**

Replace the current imports from clubLeaderboard (line 21-25):

```typescript
import {
  type LeaderboardEntry,
  type ClubDisciplineFilter,
  type ClubGenderFilter,
  sortLeaderboardByDiscipline,
  filterByGender,
  getSortDiscipline,
  abbreviateCategory,
} from '../../../src/utils/clubLeaderboard';
```

Remove the unused import of `getPlayerProfile` (line 18) — it was used to find the user's club, but we keep that for now.

Remove `Linking` from the react-native import (line 10) — it's only used in ClubInfoCard. Add it back only inside ClubInfoCard.

Actually, `Linking` is still needed by ClubInfoCard which stays, so keep it.

**Step 2: Rewrite ClubMemberRow component**

Replace lines 484-550 (ClubMemberRow + RankBadge) with:

```typescript
// ============================================================
// Club Member Row Component
// ============================================================

function ClubMemberRow({
  item,
  isCurrentUser,
  disciplineFilter,
  onPress,
}: {
  item: LeaderboardEntry;
  isCurrentUser: boolean;
  disciplineFilter: ClubDisciplineFilter;
  onPress: () => void;
}) {
  const sortDisc = getSortDiscipline(item, disciplineFilter);
  const displayRate = disciplineFilter === 'all'
    ? item.bestRate
    : item[disciplineFilter]?.rate ?? null;

  return (
    <Pressable
      className={`px-4 py-3 ${isCurrentUser ? 'bg-primary-bg border-l-[3px] border-l-primary' : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      {/* Line 1: Position, sex, name, category, points */}
      <View className="flex-row items-center">
        <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Text className="text-caption font-bold text-gray-600">
            {item.position}
          </Text>
        </View>
        <Text className="text-[15px] mr-1.5">
          {item.sex === 'F' ? '\u{1F469}' : '\u{1F468}'}
        </Text>
        <Text className="text-body font-semibold text-gray-900 flex-1 flex-shrink" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-[11px] text-gray-400 mx-2">
          {abbreviateCategory(item.category)}
        </Text>
        {displayRate != null ? (
          <Text className="text-body font-bold text-gray-800 tabular-nums">
            {displayRate}
          </Text>
        ) : (
          <Text className="text-body text-gray-300">-</Text>
        )}
      </View>

      {/* Line 2: 3 rank pills with points */}
      <View className="flex-row items-center gap-1.5 mt-1.5 ml-11">
        <RankPill
          ranking={item.simple}
          color="#3b82f6"
          bgColor="#dbeafe"
          isSort={sortDisc === 'simple'}
        />
        <RankPill
          ranking={item.double}
          color="#10b981"
          bgColor="#d1fae5"
          isSort={sortDisc === 'double'}
        />
        <RankPill
          ranking={item.mixte}
          color="#f59e0b"
          bgColor="#fef3c7"
          isSort={sortDisc === 'mixte'}
        />
      </View>
    </Pressable>
  );
}

// ============================================================
// Rank Pill Sub-component (shows subLevel + rate)
// ============================================================

function RankPill({
  ranking,
  color,
  bgColor,
  isSort,
}: {
  ranking: { subLevel: string; rate: number | null } | null;
  color: string;
  bgColor: string;
  isSort: boolean;
}) {
  if (!ranking || ranking.subLevel === '-') {
    return (
      <View className="rounded px-1.5 py-0.5 bg-gray-50">
        <Text className="text-[11px] text-gray-300">NC</Text>
      </View>
    );
  }

  const rateStr = ranking.rate != null ? ` \u00b7 ${ranking.rate}` : '';

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderLeftColor: color,
        borderLeftWidth: isSort ? 3 : 2,
      }}
      className={`rounded px-1.5 py-0.5 ${isSort ? 'opacity-100' : 'opacity-70'}`}
    >
      <Text style={{ color, fontSize: 11, fontWeight: isSort ? '700' : '500' }}>
        {ranking.subLevel}{rateStr}
      </Text>
    </View>
  );
}
```

**Step 3: Update the `renderLeaderboardRow` callback**

Replace lines 199-213 to pass `disciplineFilter`:

```typescript
  const renderLeaderboardRow = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <ClubMemberRow
        item={item}
        isCurrentUser={item.licence === session?.licence}
        disciplineFilter={disciplineFilter}
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: { licence: item.licence },
          })
        }
      />
    ),
    [session?.licence, disciplineFilter]
  );
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (all types should now align)

**Step 5: Commit**

```bash
git add app/\(app\)/\(tabs\)/club.tsx
git commit -m "feat: redesign club member row with points, category, sex emoji, sort indicator"
```

---

### Task 5: Update i18n strings

**Files:**
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

**Step 1: Add new i18n keys for points display**

In `fr.json`, update the `club` section (lines 118-142). Add a `"points"` key and update `"members"` to no longer mention "ranked" since we now count by rate:

Replace:
```json
"members": "{{count}} membres ({{ranked}} classés)",
```
With:
```json
"members": "{{count}} membres ({{ranked}} classés)",
"points": "pts",
```

In `en.json`, make the same addition:

After `"members": "{{count}} members ({{ranked}} ranked)",` add:
```json
"points": "pts",
```

**Step 2: Commit**

```bash
git add src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat: add i18n key for points label"
```

---

### Task 6: Clean up dead code

**Files:**
- Modify: `src/api/ffbad.ts` — remove `getClubLeaderboard` if not already removed in Task 2. Also remove the `ClubRankingResponse` import from schemas if unused.
- Modify: `src/utils/clubLeaderboard.ts` — verify old functions (`normalizeToLeaderboard`, `getRankSortIndex`, `getDisplayRank`, `getBestRanking` import) are gone (already done in Task 1)
- Modify: `src/api/schemas.ts` — keep `ClubRankingSchema`/`ClubRankingResponse` types (they're exported, may be used elsewhere). No changes needed.

**Step 1: Check for remaining references to old functions**

Search for: `normalizeToLeaderboard`, `getRankSortIndex`, `getDisplayRank`, `getClubLeaderboard` across the codebase. Remove any remaining imports or usages.

Check `src/api/ffbad.ts` line 8 — if `ClubRankingResponse` is imported but no longer used, remove it from the import.

**Step 2: Remove `getBestRanking` import from `clubLeaderboard.ts`**

The old file imported from `./rankings`. The new file in Task 1 doesn't need it. Verify it's gone.

**Step 3: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: PASS with no errors

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove dead code from old search-based leaderboard"
```

---

### Task 7: Manual verification on device

**Step 1: Start the dev server**

Run: `npx expo start`

**Step 2: Test on emulator (device emulator-5554)**

1. Open app, navigate to Club tab
2. Verify club loads with all members showing:
   - Position number
   - Sex emoji (man/woman)
   - Full name
   - Category abbreviation (Sen, V1, J2, etc.)
   - Points number right-aligned
   - 3 rank pills with subLevel + rate
3. Test discipline filter (All/Simple/Double/Mixte):
   - Position numbers recalculate
   - Sort order changes based on that discipline's rate
   - Sort indicator (bold pill) moves to the active discipline
4. Test gender filter (All/Hommes/Femmes):
   - Only matching players shown
   - Positions recalculate
5. Tap club name — info card toggles open/closed
6. Pull to refresh — should reload data
7. Tap a player row — navigates to player profile
8. Test "My Club" button when viewing another club
9. Verify current user row is highlighted with blue left border

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address manual testing findings"
```
