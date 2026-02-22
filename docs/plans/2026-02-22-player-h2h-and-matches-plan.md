# Player Head-to-Head & Full Match History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add head-to-head stats (against + together) and full match history viewing for any player, accessible from the player profile screen.

**Architecture:** New `getPlayerOpposition` API function fetches H2H data. Refactored `getResultsByLicence` accepts a `personId` param to fetch any player's matches. New `useHeadToHead` hook parses opposition data into against/together buckets. Match history screen reuses the existing accordion UI with a parameterized `useMatchHistory(personId)` hook.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, NativeWind, i18next, AsyncStorage cache, expo-router

---

### Task 1: Refactor `getResultsByLicence` to accept `personId`

**Files:**
- Modify: `src/api/ffbad.ts:407-447`

**Step 1: Update the function signature and body**

Replace the current `getResultsByLicence` function (lines 407-447) with:

```typescript
/**
 * Fetches match results for a player.
 *
 * Uses myffbad.fr /api/person/{personId}/result/Decade endpoint which returns
 * 10 years of results with all IDs populated (eventId, disciplineId, bracketId, roundId)
 * and discipline names like "SIMPLE HOMMES", "DOUBLE HOMMES", "MIXTE".
 *
 * Returns raw result items WITHOUT detail enrichment — details are fetched lazily.
 * Also returns _rawItems for lazy detail loading later.
 *
 * @param licence - Player's licence number
 * @param knownPersonId - Optional personId. Required for non-current-user players.
 */
export async function getResultsByLicence(
  licence: string,
  knownPersonId?: string
): Promise<ResultByLicenceResponse & { _rawItems?: Array<Record<string, unknown>> }> {
  const session = requireSession();

  // Use provided personId, or derive from session if this is the current user
  const personId = knownPersonId ?? (licence === session.licence ? session.personId : null);

  if (!personId) {
    return { Retour: [] };
  }

  try {
    const data = await bridgeGet(
      `/api/person/${personId}/result/Decade`,
      session.accessToken,
      session.personId  // currentpersonid header is always the logged-in user
    );

    if (!data) {
      return { Retour: 'No results' };
    }

    const results = Array.isArray(data) ? data : ((data as Record<string, unknown>).results ?? data);

    if (!Array.isArray(results)) {
      return { Retour: 'No results' };
    }

    const rawItems = results as Array<Record<string, unknown>>;
    const items = rawItems.map(transformResultItem);

    return { Retour: items, _rawItems: rawItems };
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Error fetching results' };
  }
}
```

Key change: Added `knownPersonId?: string` param. When provided, uses it directly. The `currentpersonid` header (3rd arg to `bridgeGet`) stays as `session.personId` (the logged-in user, per API requirements).

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (existing callers pass only `licence`, so the new optional param is backward compatible)

**Step 3: Commit**

```bash
git add src/api/ffbad.ts
git commit -m "refactor: add optional personId param to getResultsByLicence"
```

---

### Task 2: Add `getPlayerOpposition` API function

**Files:**
- Modify: `src/api/ffbad.ts` (add new function after `getClubTops`, around line 1000)

**Step 1: Add the function**

After the `getClubTops` function (around line 999), add:

```typescript
/**
 * Fetch head-to-head data between the logged-in user and another player.
 *
 * GET /api/person/{myPersonId}/playerOpposition/{theirPersonId}
 *
 * Response shape is discovered at runtime — returned as raw data.
 */
export async function getPlayerOpposition(
  theirPersonId: string
): Promise<unknown> {
  const session = requireSession();

  try {
    const data = await bridgeGet(
      `/api/person/${session.personId}/playerOpposition/${theirPersonId}`,
      session.accessToken,
      session.personId
    );

    return data;
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return null;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/api/ffbad.ts
git commit -m "feat: add getPlayerOpposition API function for head-to-head data"
```

---

### Task 3: Refactor `useMatchHistory` to accept optional `personId`

**Files:**
- Modify: `src/hooks/useMatchHistory.ts`

**Step 1: Update the hook signature (line 68)**

Change:
```typescript
export function useMatchHistory(): MatchHistoryData {
```

To:
```typescript
export function useMatchHistory(targetPersonId?: string): MatchHistoryData {
```

**Step 2: Update the personId/licence resolution (around lines 89-90)**

Find:
```typescript
  const licence = session?.licence;
```

And the line where `personId` is derived from session (around line 90):
```typescript
  const personId = session?.personId;
```

Replace both with:
```typescript
  const licence = session?.licence;
  const personId = targetPersonId ?? session?.personId;
```

**Step 3: Update the `getResultsByLicence` call (around line 142)**

Find the call to `getResultsByLicence(licence)` and change it to:
```typescript
const response = await getResultsByLicence(licence!, personId);
```

This passes the `personId` (which may be the target player's, not the session user's) to the refactored API function.

**Step 4: Update cache keys to be personId-scoped**

The existing cache keys use `licence` (e.g., `matches:${licence}`). When viewing another player, we need the keys to differ. Find all cache key references using `licence` in this file and ensure they use `personId` instead for uniqueness:

Find (around line 107):
```typescript
      const cached = await cacheGet<...>(`matches:${licence}`);
```

Replace with:
```typescript
      const cached = await cacheGet<...>(`matches:${personId}`);
```

Similarly for `matches-raw:${licence}` → `matches-raw:${personId}` and any other licence-based cache keys. There should be about 3-4 occurrences.

Also update the `cacheSet` calls to match:
- `matches:${personId}` for the result list
- `matches-raw:${personId}` for raw items

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (existing callers call `useMatchHistory()` with no args — backward compatible)

**Step 6: Commit**

```bash
git add src/hooks/useMatchHistory.ts
git commit -m "refactor: add optional personId param to useMatchHistory hook"
```

---

### Task 4: Create `useHeadToHead` hook

**Files:**
- Create: `src/hooks/useHeadToHead.ts`

**Step 1: Create the hook file**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getPlayerOpposition } from '../api/ffbad';
import { useSession } from '../auth/context';
import { cacheGet, cacheSet } from '../cache/storage';

// ============================================================
// Types
// ============================================================

interface DisciplineRecord {
  wins: number;
  losses: number;
}

export interface H2HStats {
  wins: number;
  losses: number;
  winRate: number;
  byDiscipline: {
    simple: DisciplineRecord;
    double: DisciplineRecord;
    mixte: DisciplineRecord;
  };
  lastPlayed: string | null;
  matchCount: number;
}

export interface H2HMatch {
  date: string;
  tournament: string;
  discipline: 'simple' | 'double' | 'mixte';
  isWin: boolean;
  score: string;
  points: number | null;
  relation: 'against' | 'together';
  opponents?: string;
}

export interface HeadToHeadData {
  against: H2HStats | null;
  together: H2HStats | null;
  againstMatches: H2HMatch[];
  togetherMatches: H2HMatch[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// Helpers
// ============================================================

function parseDiscipline(raw: string): 'simple' | 'double' | 'mixte' {
  const lower = (raw ?? '').toLowerCase();
  if (lower.includes('simple')) return 'simple';
  if (lower.includes('double')) return 'double';
  if (lower.includes('mixte')) return 'mixte';
  return 'simple';
}

function computeStats(matches: H2HMatch[]): H2HStats {
  const wins = matches.filter((m) => m.isWin).length;
  const losses = matches.length - wins;
  const byDiscipline = {
    simple: { wins: 0, losses: 0 },
    double: { wins: 0, losses: 0 },
    mixte: { wins: 0, losses: 0 },
  };

  for (const m of matches) {
    if (m.isWin) {
      byDiscipline[m.discipline].wins++;
    } else {
      byDiscipline[m.discipline].losses++;
    }
  }

  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));

  return {
    wins,
    losses,
    winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
    byDiscipline,
    lastPlayed: sorted[0]?.date ?? null,
    matchCount: matches.length,
  };
}

/**
 * Parse the raw /playerOpposition response into H2H matches.
 *
 * The API response shape is discovered at runtime. This function
 * handles the most likely format: an array of match objects.
 * If the format is unexpected, returns empty arrays.
 */
function parseOppositionResponse(
  data: unknown,
  myPersonId: string
): { against: H2HMatch[]; together: H2HMatch[] } {
  const against: H2HMatch[] = [];
  const together: H2HMatch[] = [];

  if (!data || typeof data !== 'object') {
    return { against, together };
  }

  // Handle array response (list of matches)
  const items = Array.isArray(data) ? data : [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;

    const date = String(raw.date ?? raw.Date ?? raw.matchDate ?? '');
    const tournament = String(raw.name ?? raw.tournamentName ?? raw.eventName ?? '');
    const discipline = parseDiscipline(String(raw.discipline ?? raw.Discipline ?? ''));
    const score = String(raw.score ?? raw.Score ?? '');
    const points = typeof raw.winPoint === 'number' ? raw.winPoint
      : typeof raw.WinPoint === 'number' ? raw.WinPoint
      : null;

    // Determine if this was a win for the current user
    const isWin = raw.isWin === true || raw.IsWinner === '1' || raw.isWinner === true
      || String(raw.status ?? '').toLowerCase() === 'green';

    // Determine if opponent was partner or opponent
    // If the target player appears in "top" side with us, it's "together"
    // If they appear on the opposite side, it's "against"
    // Default to "against" if we can't determine
    const relation: 'against' | 'together' =
      raw.relation === 'partner' || raw.isPartner === true
        ? 'together'
        : 'against';

    const opponents = raw.opponents ? String(raw.opponents) : undefined;

    const match: H2HMatch = {
      date,
      tournament,
      discipline,
      isWin,
      score,
      points: points as number | null,
      relation,
      opponents,
    };

    if (relation === 'together') {
      together.push(match);
    } else {
      against.push(match);
    }
  }

  return { against, together };
}

// ============================================================
// Hook
// ============================================================

const H2H_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useHeadToHead(theirPersonId: string | null): HeadToHeadData {
  const { session } = useSession();
  const [against, setAgainst] = useState<H2HStats | null>(null);
  const [together, setTogether] = useState<H2HStats | null>(null);
  const [againstMatches, setAgainstMatches] = useState<H2HMatch[]>([]);
  const [togetherMatches, setTogetherMatches] = useState<H2HMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!theirPersonId || !session?.personId) return;

    setIsLoading(true);
    setError(null);

    const cacheKey = `h2h:${session.personId}:${theirPersonId}`;

    try {
      // Check cache first
      const cached = await cacheGet<{ against: H2HMatch[]; together: H2HMatch[] }>(cacheKey);
      if (cached) {
        setAgainstMatches(cached.against);
        setTogetherMatches(cached.together);
        setAgainst(cached.against.length > 0 ? computeStats(cached.against) : null);
        setTogether(cached.together.length > 0 ? computeStats(cached.together) : null);
        setIsLoading(false);
        return;
      }

      // Fetch from API
      const data = await getPlayerOpposition(theirPersonId);
      const parsed = parseOppositionResponse(data, session.personId);

      setAgainstMatches(parsed.against);
      setTogetherMatches(parsed.together);
      setAgainst(parsed.against.length > 0 ? computeStats(parsed.against) : null);
      setTogether(parsed.together.length > 0 ? computeStats(parsed.together) : null);

      // Cache the result
      cacheSet(cacheKey, parsed, H2H_CACHE_TTL);
    } catch {
      setError('Unable to load head-to-head data');
    } finally {
      setIsLoading(false);
    }
  }, [theirPersonId, session?.personId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    against,
    together,
    againstMatches,
    togetherMatches,
    isLoading,
    error,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useHeadToHead.ts
git commit -m "feat: add useHeadToHead hook for player opposition data"
```

---

### Task 5: Pass `personId` from club leaderboard and search navigation

**Files:**
- Modify: `app/(app)/(tabs)/club.tsx:208-213`

**Step 1: Update the club leaderboard navigation to pass `personId`**

Find the `renderLeaderboardRow` callback (around line 202-217). Replace the `router.push` params:

```typescript
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: {
              licence: item.licence,
              personId: String(item.personId),
              nom: item.name,
            },
          })
        }
```

This passes `personId` and `nom` (name) as route params so the player profile can use them for H2H and match history without an extra lookup.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add app/\(app\)/\(tabs\)/club.tsx
git commit -m "feat: pass personId and name in club leaderboard navigation"
```

---

### Task 6: Add i18n keys for H2H and match history

**Files:**
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

**Step 1: Add English keys**

In `en.json`, after the `"player"` section's `"retry"` key (around line 117), add these keys inside the `"player"` object:

```json
"h2h": "Head-to-Head",
"h2hAgainst": "Against",
"h2hTogether": "Together",
"h2hWins": "{{count}}W",
"h2hLosses": "{{count}}L",
"h2hNeverFaced": "You've never faced each other",
"h2hNeverTeamed": "You've never teamed up",
"h2hLastPlayed": "Last played: {{date}}",
"seeAllMatches": "See all matches",
"matchesTitle": "{{name}} · Matches"
```

**Step 2: Add French keys**

In `fr.json`, same location inside `"player"`:

```json
"h2h": "Face à face",
"h2hAgainst": "Adversaire",
"h2hTogether": "Partenaire",
"h2hWins": "{{count}}V",
"h2hLosses": "{{count}}D",
"h2hNeverFaced": "Vous ne vous êtes jamais affrontés",
"h2hNeverTeamed": "Vous n'avez jamais joué ensemble",
"h2hLastPlayed": "Dernier match : {{date}}",
"seeAllMatches": "Voir tous les matchs",
"matchesTitle": "{{name}} · Matchs"
```

**Step 3: Commit**

```bash
git add src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat: add i18n keys for head-to-head and player match history"
```

---

### Task 7: Add Head-to-Head section to player profile

**Files:**
- Modify: `app/(app)/player/[licence].tsx`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { useHeadToHead, type H2HStats, type H2HMatch } from '../../../src/hooks/useHeadToHead';
```

**Step 2: Add state for H2H tab and hook call**

Inside `PlayerProfileScreen`, after the existing state declarations (around line 108), add:

```typescript
  const [h2hTab, setH2hTab] = useState<'against' | 'together'>('against');

  // Head-to-head: only fetch when viewing someone else's profile
  const h2h = useHeadToHead(
    !isOwnProfile && personId ? personId : null
  );
```

**Step 3: Create the H2H sub-components**

Before the `PlayerProfileScreen` component (after `RankingCardItem`, around line 67), add:

```typescript
// ============================================================
// H2H Win Rate Bar
// ============================================================

function WinRateBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) return null;
  const winPct = (wins / total) * 100;

  return (
    <View className="flex-row h-2 rounded-full overflow-hidden bg-gray-100 mt-2">
      <View style={{ width: `${winPct}%` }} className="bg-win rounded-l-full" />
      <View style={{ width: `${100 - winPct}%` }} className="bg-loss rounded-r-full" />
    </View>
  );
}

// ============================================================
// H2H Discipline Mini-Card
// ============================================================

function DisciplineMiniCard({
  label,
  wins,
  losses,
  color,
}: {
  label: string;
  wins: number;
  losses: number;
  color: string;
}) {
  if (wins === 0 && losses === 0) return null;

  return (
    <View
      className="rounded-lg px-3 py-2 items-center border-t-[3px]"
      style={{ borderTopColor: color, backgroundColor: `${color}10` }}
    >
      <Text className="text-caption font-bold text-gray-700">{label}</Text>
      <Text className="text-body font-semibold text-gray-900 mt-0.5">
        {wins}-{losses}
      </Text>
    </View>
  );
}

// ============================================================
// H2H Match Row
// ============================================================

function H2HMatchRow({ match }: { match: H2HMatch }) {
  const borderColor = match.isWin ? '#16a34a' : '#dc2626';
  const icon = match.isWin ? '✓' : '✗';
  const iconColor = match.isWin ? 'text-win' : 'text-loss';
  const discColor = match.discipline === 'simple' ? '#3b82f6'
    : match.discipline === 'double' ? '#10b981' : '#f59e0b';

  return (
    <View
      className="flex-row items-center py-2.5 border-l-[3px] pl-3"
      style={{ borderLeftColor: borderColor }}
    >
      <Text className={`text-body font-bold ${iconColor} w-5`}>{icon}</Text>
      <View className="flex-1 ml-1">
        <Text className="text-body text-gray-900" numberOfLines={1}>
          {match.tournament}
        </Text>
        <Text className="text-caption text-muted mt-0.5">
          {match.date}
          {match.opponents ? ` · vs ${match.opponents}` : ''}
        </Text>
      </View>
      <View className="items-end ml-2">
        {match.score ? (
          <Text className="text-caption font-medium text-gray-700">{match.score}</Text>
        ) : null}
        {match.points != null ? (
          <Text className={`text-caption font-bold ${match.points >= 0 ? 'text-win' : 'text-loss'}`}>
            {match.points >= 0 ? '+' : ''}{match.points}
          </Text>
        ) : null}
      </View>
      <View
        className="w-1.5 h-1.5 rounded-full ml-2"
        style={{ backgroundColor: discColor }}
      />
    </View>
  );
}

// ============================================================
// H2H Section
// ============================================================

function HeadToHeadSection({
  playerName,
  h2hTab,
  setH2hTab,
  against,
  together,
  againstMatches,
  togetherMatches,
  isLoading,
  t,
}: {
  playerName: string;
  h2hTab: 'against' | 'together';
  setH2hTab: (tab: 'against' | 'together') => void;
  against: H2HStats | null;
  together: H2HStats | null;
  againstMatches: H2HMatch[];
  togetherMatches: H2HMatch[];
  isLoading: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const activeStats = h2hTab === 'against' ? against : together;
  const activeMatches = h2hTab === 'against' ? againstMatches : togetherMatches;
  const againstCount = againstMatches.length;
  const togetherCount = togetherMatches.length;

  return (
    <View className="mb-6">
      <Text className="text-[18px] font-semibold text-gray-900 mb-3">
        {t('player.h2h')}
      </Text>

      {/* Segment control */}
      <View className="flex-row gap-2 mb-4">
        <Pressable
          className={`flex-1 py-2.5 rounded-full items-center border ${
            h2hTab === 'against' ? 'bg-primary border-primary' : 'bg-white border-gray-200'
          }`}
          onPress={() => setH2hTab('against')}
        >
          <Text className={`text-body font-medium ${h2hTab === 'against' ? 'text-white' : 'text-gray-700'}`}>
            ⚔️ {t('player.h2hAgainst')} ({againstCount})
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-2.5 rounded-full items-center border ${
            h2hTab === 'together' ? 'bg-primary border-primary' : 'bg-white border-gray-200'
          }`}
          onPress={() => setH2hTab('together')}
        >
          <Text className={`text-body font-medium ${h2hTab === 'together' ? 'text-white' : 'text-gray-700'}`}>
            🤝 {t('player.h2hTogether')} ({togetherCount})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color="#2563eb" />
      ) : activeStats ? (
        <Card className="p-4">
          {/* Summary */}
          <Text className="text-body text-gray-500 mb-1">
            {h2hTab === 'against' ? `⚔️ ${t('player.h2hAgainst')}` : `🤝 ${t('player.h2hTogether')}`} {playerName}
          </Text>
          <View className="flex-row items-baseline gap-2">
            <Text className="text-[22px] font-bold text-win">
              {t('player.h2hWins', { count: activeStats.wins })}
            </Text>
            <Text className="text-[18px] text-gray-400">·</Text>
            <Text className="text-[22px] font-bold text-loss">
              {t('player.h2hLosses', { count: activeStats.losses })}
            </Text>
          </View>
          <WinRateBar wins={activeStats.wins} losses={activeStats.losses} />
          <Text className="text-caption text-muted mt-1 text-right">{activeStats.winRate}%</Text>

          {/* Per-discipline */}
          <View className="flex-row gap-2 mt-3">
            {h2hTab === 'against' && (
              <DisciplineMiniCard label="S" wins={activeStats.byDiscipline.simple.wins} losses={activeStats.byDiscipline.simple.losses} color="#3b82f6" />
            )}
            <DisciplineMiniCard label="D" wins={activeStats.byDiscipline.double.wins} losses={activeStats.byDiscipline.double.losses} color="#10b981" />
            <DisciplineMiniCard label="M" wins={activeStats.byDiscipline.mixte.wins} losses={activeStats.byDiscipline.mixte.losses} color="#f59e0b" />
          </View>

          {/* Last played */}
          {activeStats.lastPlayed && (
            <Text className="text-caption text-muted mt-3">
              {t('player.h2hLastPlayed', { date: activeStats.lastPlayed })}
            </Text>
          )}

          {/* Match list */}
          {activeMatches.length > 0 && (
            <View className="mt-3 pt-3 border-t border-gray-100">
              {activeMatches.map((match, i) => (
                <H2HMatchRow key={`${match.date}-${i}`} match={match} />
              ))}
            </View>
          )}
        </Card>
      ) : (
        <Card className="p-4 items-center">
          <Text className="text-body text-gray-400">
            {h2hTab === 'against' ? `⚔️ ${t('player.h2hNeverFaced')}` : `🤝 ${t('player.h2hNeverTeamed')}`}
          </Text>
        </Card>
      )}
    </View>
  );
}
```

**Step 4: Add the H2H section and "See all matches" button to the profile JSX**

In the `return` statement of `PlayerProfileScreen` (around line 267), find the ranking evolution link (lines 346-354):

```typescript
      {/* Ranking evolution link */}
      {hasRankings && (
        <Pressable
          className="flex-row items-center justify-center py-3 mt-2 active:opacity-60"
          onPress={() => router.push('/ranking-chart')}
        >
          <Ionicons name="trending-up" size={18} color="#2563eb" />
          <Text className="text-body font-medium text-primary ml-2">Ranking evolution</Text>
        </Pressable>
      )}
```

After it (before the closing `</ScrollView>`), add:

```typescript
      {/* Head-to-Head section (only for other players) */}
      {!isOwnProfile && personId && (
        <HeadToHeadSection
          playerName={player.nom ?? ''}
          h2hTab={h2hTab}
          setH2hTab={setH2hTab}
          against={h2h.against}
          together={h2h.together}
          againstMatches={h2h.againstMatches}
          togetherMatches={h2h.togetherMatches}
          isLoading={h2h.isLoading}
          t={t}
        />
      )}

      {/* See all matches button */}
      {personId && (
        <Pressable
          className="flex-row items-center justify-center py-3.5 mx-0 mb-6 rounded-xl bg-primary-bg active:opacity-70"
          onPress={() => {
            if (isOwnProfile) {
              router.push('/(app)/(tabs)/matches');
            } else {
              router.push({
                pathname: '/player/[licence]/matches',
                params: {
                  licence: player.licence,
                  personId,
                  nom: player.nom,
                },
              });
            }
          }}
        >
          <Text className="text-body font-medium text-primary">📋 {t('player.seeAllMatches')} ›</Text>
        </Pressable>
      )}
```

Also add the `ActivityIndicator` import if not already present (it should be — check line 7).

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add app/\(app\)/player/\[licence\].tsx
git commit -m "feat: add head-to-head section and see-all-matches button to player profile"
```

---

### Task 8: Create player match history screen

**Files:**
- Create: `app/(app)/player/[licence]/matches.tsx`
- Modify: `app/(app)/_layout.tsx` (add route)

**Step 1: Create the route file**

The expo-router file-based routing means `app/(app)/player/[licence]/matches.tsx` maps to `/player/:licence/matches`. Since this creates a nested directory under `[licence]`, we also need a layout file.

Create `app/(app)/player/[licence]/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function PlayerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Rename the existing `app/(app)/player/[licence].tsx` to `app/(app)/player/[licence]/index.tsx` (same content, just moved to support nested routing).

**Step 2: Create the matches screen**

Create `app/(app)/player/[licence]/matches.tsx`. This reuses the match history UI from `matches.tsx` tab but parameterized with a different player's `personId`:

```typescript
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useMatchHistory } from '../../../../src/hooks/useMatchHistory';
import { DetailMatchCard } from '../../../../src/components';
import type { MatchItem, TournamentSection, DisciplineGroup } from '../../../../src/utils/matchHistory';

// Re-use the same inline sub-components from the main matches.tsx tab.
// These are copied here since they're defined inline in the tab file.
// In a future refactor, they could be extracted to shared components.

type DisciplineFilterKey = 'all' | 'simple' | 'double' | 'mixte';

// ============================================================
// Stats Header
// ============================================================

function StatsHeader({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <View className="mx-4 mt-4 mb-3 p-4 bg-primary-bg rounded-xl">
      <Text className="text-caption font-semibold text-gray-500 mb-1">Statistics</Text>
      <Text className="text-display text-primary">{winRate}% win rate</Text>
      <View className="flex-row h-2.5 rounded-full overflow-hidden bg-white mt-2">
        {wins > 0 && (
          <View style={{ flex: wins }} className="bg-win rounded-l-full" />
        )}
        {losses > 0 && (
          <View style={{ flex: losses }} className="bg-loss rounded-r-full" />
        )}
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-caption font-semibold text-win">{wins} W</Text>
        <Text className="text-caption font-semibold text-loss">{losses} L</Text>
      </View>
    </View>
  );
}

// ============================================================
// Tournament Header
// ============================================================

function TournamentHeader({
  title,
  date,
  points,
  isExpanded,
  onToggle,
}: {
  title: string;
  date: string;
  points: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const pointsStr = points >= 0 ? `+${points.toFixed(1)} pts` : `${points.toFixed(1)} pts`;
  const pointsColor = points >= 0 ? 'text-win' : 'text-loss';

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 bg-white border-l-[3px] border-l-primary"
      onPress={onToggle}
    >
      <View className="flex-1">
        <Text className="text-body font-semibold text-gray-900" numberOfLines={1}>{title}</Text>
      </View>
      <Text className="text-caption text-muted mx-2">{date}</Text>
      <Text className={`text-caption font-bold ${pointsColor} mr-1`}>{pointsStr}</Text>
      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
    </Pressable>
  );
}

// ============================================================
// Discipline Row
// ============================================================

function DisciplineRow({
  discipline,
  wins,
  losses,
  points,
  isExpanded,
  isLoading,
  onToggle,
}: {
  discipline: 'simple' | 'double' | 'mixte';
  wins: number;
  losses: number;
  points: number;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) {
  const letter = discipline === 'simple' ? 'S' : discipline === 'double' ? 'D' : 'M';
  const color = discipline === 'simple' ? '#3b82f6' : discipline === 'double' ? '#10b981' : '#f59e0b';
  const bgColor = discipline === 'simple' ? '#dbeafe' : discipline === 'double' ? '#d1fae5' : '#fef3c7';
  const pointsStr = points >= 0 ? `+${points.toFixed(1)} pts` : `${points.toFixed(1)} pts`;
  const pointsColor = points >= 0 ? 'text-win' : 'text-loss';

  return (
    <Pressable
      className="flex-row items-center px-4 py-2.5 ml-3 bg-white"
      onPress={onToggle}
    >
      <View className="w-7 h-7 rounded-md items-center justify-center mr-2.5" style={{ backgroundColor: bgColor }}>
        <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{letter}</Text>
      </View>
      <Text className="text-body text-gray-700 capitalize">{discipline === 'mixte' ? 'Mixed' : discipline === 'double' ? 'Doubles' : 'Singles'}</Text>
      <View className="flex-row items-center ml-2 gap-1">
        <View className="bg-win-bg rounded-full px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-win">{wins}W</Text>
        </View>
        <View className="bg-loss-bg rounded-full px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-loss">{losses}L</Text>
        </View>
      </View>
      <View className="flex-1" />
      <Text className={`text-caption font-bold ${pointsColor} mr-1`}>{pointsStr}</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color="#9ca3af" />
      ) : (
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#9ca3af" />
      )}
    </Pressable>
  );
}

// ============================================================
// Main Screen
// ============================================================

export default function PlayerMatchesScreen() {
  const { licence, personId, nom } = useLocalSearchParams<{
    licence: string;
    personId: string;
    nom?: string;
  }>();
  const { t } = useTranslation();
  const playerName = nom ?? licence ?? '';

  const {
    tournaments,
    detailCache,
    loadingDetails,
    loadDetails,
    activeDiscipline,
    setDiscipline,
    activeSeason,
    setSeason,
    availableSeasons,
    totalWins,
    totalLosses,
    isLoading,
    isRefreshing,
    refresh,
  } = useMatchHistory(personId);

  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  const toggleTournament = useCallback((title: string) => {
    setExpandedTournaments((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
        // Pre-load all disciplines
        const tournament = tournaments.find((t) => t.title === title);
        if (tournament) {
          for (const dg of tournament.disciplines) {
            const key = `${title}:${dg.discipline}`;
            if (!detailCache.has(key)) {
              loadDetails(title, dg.discipline);
            }
          }
        }
      }
      return next;
    });
  }, [tournaments, detailCache, loadDetails]);

  const toggleDiscipline = useCallback((key: string, tournamentTitle: string, discipline: string) => {
    setExpandedDisciplines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!detailCache.has(key)) {
          loadDetails(tournamentTitle, discipline);
        }
      }
      return next;
    });
  }, [detailCache, loadDetails]);

  // Build flat render items
  const renderItems = useMemo(() => {
    const items: Array<{ type: string; key: string; data: unknown }> = [];

    for (const tournament of tournaments) {
      items.push({ type: 'tournament', key: `t:${tournament.title}`, data: tournament });

      if (expandedTournaments.has(tournament.title)) {
        for (const dg of tournament.disciplines) {
          const dKey = `${tournament.title}:${dg.discipline}`;
          items.push({ type: 'discipline', key: `d:${dKey}`, data: { ...dg, tournamentTitle: tournament.title, dKey } });

          if (expandedDisciplines.has(dKey)) {
            const detailMatches = detailCache.get(dKey);
            if (detailMatches) {
              for (const match of detailMatches) {
                items.push({ type: 'match', key: `m:${match.id}`, data: { match } });
              }
            } else if (loadingDetails.has(dKey)) {
              items.push({ type: 'loading', key: `l:${dKey}`, data: null });
            }
          }
        }
      }
    }

    return items;
  }, [tournaments, expandedTournaments, expandedDisciplines, detailCache, loadingDetails]);

  const renderItem = useCallback(({ item }: { item: { type: string; key: string; data: unknown } }) => {
    switch (item.type) {
      case 'tournament': {
        const t = item.data as TournamentSection;
        return (
          <TournamentHeader
            title={t.title}
            date={t.date}
            points={t.totalPoints}
            isExpanded={expandedTournaments.has(t.title)}
            onToggle={() => toggleTournament(t.title)}
          />
        );
      }
      case 'discipline': {
        const d = item.data as DisciplineGroup & { tournamentTitle: string; dKey: string };
        return (
          <DisciplineRow
            discipline={d.discipline}
            wins={d.wins}
            losses={d.losses}
            points={d.points}
            isExpanded={expandedDisciplines.has(d.dKey)}
            isLoading={loadingDetails.has(d.dKey)}
            onToggle={() => toggleDiscipline(d.dKey, d.tournamentTitle, d.discipline)}
          />
        );
      }
      case 'match': {
        const { match } = item.data as { match: MatchItem };
        return <DetailMatchCard match={match} playerName={playerName} />;
      }
      case 'loading':
        return (
          <View className="py-4 items-center">
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        );
      default:
        return null;
    }
  }, [expandedTournaments, expandedDisciplines, loadingDetails, toggleTournament, toggleDiscipline, playerName]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={renderItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <StatsHeader wins={totalWins} losses={totalLosses} />
            {/* Discipline filters */}
            <View className="flex-row gap-2 px-4 pt-2 pb-2">
              {(['all', 'simple', 'double', 'mixte'] as DisciplineFilterKey[]).map((key) => {
                const isActive = activeDiscipline === key;
                return (
                  <Pressable
                    key={key}
                    className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                    onPress={() => setDiscipline(key)}
                  >
                    <Text className={`text-[13px] font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                      {key === 'all' ? 'All' : key === 'simple' ? 'Singles' : key === 'double' ? 'Doubles' : 'Mixed'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        }
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100" />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      />
    </View>
  );
}
```

**Step 3: Update the stack navigator**

In `app/(app)/_layout.tsx`, the route `player/[licence]` now becomes a directory with a `_layout.tsx`. Expo-router should pick this up automatically — the existing `<Stack.Screen name="player/[licence]">` will still work. But we need to add the matches screen:

Add after the existing `player/[licence]` screen definition:

```typescript
<Stack.Screen
  name="player/[licence]/matches"
  options={{
    headerShown: true,
    headerTitle: '',
    headerBackTitle: '',
  }}
/>
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May have issues with `useMatchHistory` return type — the hook needs to export `totalWins`, `totalLosses`, `availableSeasons`, `setDiscipline`, `setSeason`, `activeDiscipline`, `activeSeason`. Check that these are already in the hook's return type. If not, add them.

**Step 5: Commit**

```bash
git add app/\(app\)/player/\[licence\]/ app/\(app\)/_layout.tsx
git commit -m "feat: add player match history screen with full accordion UI"
```

---

### Task 9: Visual verification on device

**Step 1: Start dev server and test**

Navigate to Club tab → tap a player → verify:

1. **Player profile** shows rankings as before
2. **H2H section** appears below rankings with ⚔️ Against / 🤝 Together tabs
3. **Against tab**: shows W-L stats, per-discipline breakdown, match list
4. **Together tab**: shows W-L stats for doubles/mixed partnerships
5. **Empty states**: shows emoji messages when no data
6. **"See all matches" button**: navigates to full accordion match history
7. **Match history screen**: loads that player's matches with tournament/discipline accordion
8. **Lazy loading**: detail spinners appear, then matches populate
9. **Back navigation**: returns to player profile

**Step 2: Fix any issues found**

```bash
git add -A
git commit -m "fix: address visual testing findings"
```
