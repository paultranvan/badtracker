# Phase 3: Personal Dashboard - Research

**Researched:** 2026-02-17
**Domain:** React Native dashboard UI, FFBaD data aggregation, pull-to-refresh
**Confidence:** HIGH

## Summary

Phase 3 transforms the placeholder home screen (`app/(app)/(tabs)/index.tsx`) into a personal dashboard showing the authenticated user's ranking data, recent matches preview, and quick stats. The existing codebase already has all the API infrastructure needed: `getPlayerProfile()` returns ranking data per discipline, `getResultsByLicence()` returns match history, and `useSession()` provides the authenticated user's licence number.

The main work is UI composition (cards, stats row, greeting) and a custom hook to orchestrate multiple API calls on mount and pull-to-refresh. No new libraries are needed — React Native's built-in `ScrollView` + `RefreshControl` handles pull-to-refresh, and the existing pattern from `[licence].tsx` provides a solid template for data fetching with loading/error states.

**Primary recommendation:** Build a `useDashboardData` hook that calls `getPlayerProfile` + `getResultsByLicence` in parallel using `Promise.all`, exposes loading/error/refresh state, and powers a card-based ScrollView layout. Reuse existing API functions, error classes, and i18n patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Scrollable vertical layout with distinct cards for each section
- Quick stats summary row at the top (most prominent)
- Personalized greeting in header ("Bonjour, Paul") that adapts based on recent activity (new ranking change, recent matches, etc.)
- Pull-to-refresh to update all data from FFBaD
- Row of 2-3 key stats at the top: 1) Best ranking across disciplines (headline stat), 2) Matches played this season, 3) Overall win rate
- Show trend indicators (up/down arrows, +/- changes) on stats
- Side-by-side cards, one per discipline (Simple, Double, Mixte)
- Each card shows: category label (e.g., P11), point value, and gap to next rank in both directions (+15 pts to P10 / -8 pts to P12)
- Unranked disciplines shown as "NC" (Non Classe) — always display all 3 cards
- Tapping a ranking card navigates to the ranking evolution chart for that discipline (placeholder/stub until Phase 5 builds it)
- Show the last 3 matches
- Each row shows: W/L badge ("V" or "D" for Victoire/Defaite), opponent name, and score (21-15, 21-18)
- "Voir tous les matchs" link at the bottom navigating to full match history (placeholder/stub until Phase 4 builds it)

### Claude's Discretion
- Exact card styling, spacing, and typography
- Loading states and skeleton screens
- Error handling when API data is unavailable
- Order of sections below the stats row (rankings vs matches first)
- Greeting message logic (what triggers which personalized message)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User sees a personal dashboard on app launch showing current ranking, recent matches, and quick stats | Dashboard replaces placeholder index.tsx; useDashboardData hook fetches profile + matches on mount |
| DASH-02 | User can navigate to detailed sections (matches, rankings, bookmarks) from dashboard | Ranking cards tap → ranking detail stub; "Voir tous les matchs" → match history stub; both use expo-router navigation |
| RANK-01 | User can see their current CPPH ranking value and category per discipline | getPlayerProfile() already returns rankings.simple/double/mixte with classement + cpph fields |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.81.5 | ScrollView, RefreshControl, View, Text, Pressable | Built-in pull-to-refresh support via RefreshControl |
| expo-router | ~6.0.23 | Navigation (router.push for stubs) | Already used for tabs and player profile routes |
| react-i18next | ^16.5.4 | FR/EN translations | Existing pattern for all user-facing strings |
| zod | ^4.3.6 | Schema validation | Already validates all FFBaD API responses |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | ^1.13.5 | HTTP client (via api/client.ts) | All FFBaD API calls go through callFFBaD() |

### New Dependencies
**None required.** The dashboard can be built entirely with existing packages. No charting libraries needed (that's Phase 5).

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/
│   ├── ffbad.ts          # getPlayerProfile, getResultsByLicence (exist)
│   └── schemas.ts        # ResultItem schema with .passthrough() (exists)
├── hooks/
│   └── useDashboardData.ts  # NEW: orchestrates dashboard API calls
├── types/
│   └── ffbad.ts          # PlayerProfile type (exists)
└── i18n/
    └── locales/
        ├── fr.json       # Add dashboard.* keys
        └── en.json       # Add dashboard.* keys

app/
└── (app)/
    └── (tabs)/
        └── index.tsx     # REPLACE: dashboard screen
```

### Pattern 1: Parallel Data Fetching Hook
**What:** Single hook that fetches profile + matches in parallel, manages loading/error/refresh state.
**When to use:** Dashboard mount and pull-to-refresh.
**Example:**
```typescript
// src/hooks/useDashboardData.ts
import { useState, useEffect, useCallback } from 'react';
import { getPlayerProfile, getResultsByLicence } from '../api/ffbad';
import type { PlayerProfile } from '../api/ffbad';
import type { ResultByLicenceResponse } from '../api/schemas';

interface DashboardData {
  profile: PlayerProfile | null;
  recentMatches: ResultMatch[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboardData(licence: string): DashboardData {
  // Fetch both in parallel with Promise.all
  // Expose refresh() for pull-to-refresh (sets isRefreshing, not isLoading)
}
```

### Pattern 2: Pull-to-Refresh with ScrollView
**What:** React Native ScrollView with RefreshControl for pull-to-refresh.
**When to use:** Dashboard screen (vertical scrollable content).
**Example:**
```typescript
// From React Native docs (verified via Context7)
import { ScrollView, RefreshControl } from 'react-native';

<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      colors={['#2563eb']}  // Android spinner color
      tintColor="#2563eb"    // iOS spinner color
    />
  }
>
  {/* Dashboard cards */}
</ScrollView>
```

### Pattern 3: Existing Data Fetching (from [licence].tsx)
**What:** The player profile screen already demonstrates the correct pattern for fetching data with loading/error states.
**When to use:** As reference for the dashboard hook structure.
**Key elements:**
- `useCallback` for fetch function (reusable for refresh)
- `useEffect` with cleanup cancellation
- Separate loading vs error vs data states
- Retry capability

### Pattern 4: Stub Navigation for Future Phases
**What:** Navigation targets that don't exist yet need placeholder handling.
**When to use:** Ranking card tap (Phase 5) and "Voir tous les matchs" (Phase 4).
**Example:**
```typescript
import { router } from 'expo-router';

// Ranking card tap → stub for Phase 5
const handleRankingPress = (discipline: string) => {
  // Phase 5 will add /ranking/[discipline] route
  // For now, navigate to player profile as fallback
  // OR show a "coming soon" toast
};
```

### Anti-Patterns to Avoid
- **Fetching sequentially:** Don't await profile then matches. Use `Promise.allSettled` to fetch in parallel and handle partial failures gracefully.
- **Loading the entire match history:** Only need last 3 matches for preview. Fetch all but slice to 3 in the hook (API doesn't support pagination).
- **Hardcoding French strings:** All text must go through i18next, including "V"/"D" badges and "NC" label.
- **Duplicating PlayerProfile type:** Reuse the existing `PlayerProfile` interface from `src/api/ffbad.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pull-to-refresh | Custom gesture handler | ScrollView + RefreshControl | Built into React Native, handles all platform differences |
| Data fetching state | Manual boolean flags everywhere | Custom hook (useDashboardData) | Single source of truth, consistent loading/error handling |
| Navigation | Manual screen switching | expo-router (router.push) | Already configured, typed routes |

**Key insight:** The entire dashboard is UI composition + a data hook. No new abstractions or libraries needed. The codebase already has every building block.

## Common Pitfalls

### Pitfall 1: Ranking Gap Calculation
**What goes wrong:** The FFBaD API returns CPPH points per discipline but does NOT return the gap to next/previous rank.
**Why it happens:** Ranking boundaries are defined by FFBaD's classification system and aren't in the API response.
**How to avoid:** Define a static lookup table of CPPH boundaries per rank (NC, P12, P11, P10, D9, D8, D7, R6, R5, R4, N3, N2, N1). These boundaries are publicly known from FFBaD rules. Calculate gap as: `nextRankThreshold - currentCPPH` and `currentCPPH - previousRankThreshold`.
**Warning signs:** If ranking card shows no gap data, the lookup table is missing or CPPH value is undefined.

### Pitfall 2: Match Result Data Shape Uncertainty
**What goes wrong:** The `ResultItem` schema uses `.passthrough()` and all fields are optional. The actual field names from the FFBaD API for match results (win/loss indicator, opponent name, score format) may differ from the stub schema.
**Why it happens:** Phase 2 only validated `getPlayerProfile`, not `getResultsByLicence`. The result schema is a stub.
**How to avoid:** When calling `getResultsByLicence()`, log the raw response to understand the actual data shape. Use optional chaining and fallbacks. The schema already uses `.passthrough()` so unknown fields won't break validation.
**Warning signs:** Match rows showing "undefined" or empty data.

### Pitfall 3: Empty/NC Rankings Display
**What goes wrong:** Not displaying ranking cards for disciplines where user has no ranking.
**Why it happens:** `getPlayerProfile()` returns `undefined` for rankings.simple/double/mixte when unranked.
**How to avoid:** CONTEXT.md specifies: "always display all 3 cards." For undefined rankings, show "NC" (Non Classe) with no CPPH value. The gap calculation shows distance to first ranked category (P12).

### Pitfall 4: Session Race Condition on Mount
**What goes wrong:** Dashboard tries to fetch data before session/credentials are ready.
**Why it happens:** `SessionProvider` has async auto-login. Dashboard `useEffect` may fire before session is set.
**How to avoid:** Dashboard hook should check `session.licence` is available before fetching. The `(app)` route guard (via `Stack.Protected`) already prevents rendering when not authenticated, so this should be safe. But add a guard in the hook regardless.

### Pitfall 5: Win/Loss Determination
**What goes wrong:** FFBaD result API may not have an explicit win/loss field.
**Why it happens:** Match results might only include scores, requiring parsing to determine winner.
**How to avoid:** Check if the API returns a result indicator (e.g., "V"/"D" or a boolean). If not, parse scores to determine win/loss. Document the actual API response shape during implementation.

## Code Examples

### Dashboard Data Hook Pattern
```typescript
// src/hooks/useDashboardData.ts
export function useDashboardData(licence: string | undefined) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matches, setMatches] = useState<ResultMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!licence) return;

    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [profileResult, matchesResult] = await Promise.allSettled([
        getPlayerProfile(licence),
        getResultsByLicence(licence),
      ]);

      // Handle partial success
      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value);
      }
      if (matchesResult.status === 'fulfilled') {
        // Slice to last 3 for preview
        const allMatches = matchesResult.value.Retour;
        if (Array.isArray(allMatches)) {
          setMatches(allMatches.slice(0, 3));
        }
      }

      setError(null);
    } catch (err) {
      setError(/* i18n error key */);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [licence]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { profile, matches, isLoading, isRefreshing, error, refresh };
}
```

### CPPH Ranking Boundaries (French Badminton)
```typescript
// Static lookup — from FFBaD classification rules
// These are approximate boundaries and may need verification
const RANK_BOUNDARIES: { rank: string; minCpph: number }[] = [
  { rank: 'N1', minCpph: 2000 },
  { rank: 'N2', minCpph: 1500 },
  { rank: 'N3', minCpph: 1000 },
  { rank: 'R4', minCpph: 700 },
  { rank: 'R5', minCpph: 500 },
  { rank: 'R6', minCpph: 300 },
  { rank: 'D7', minCpph: 200 },
  { rank: 'D8', minCpph: 100 },
  { rank: 'D9', minCpph: 50 },
  { rank: 'P10', minCpph: 25 },
  { rank: 'P11', minCpph: 10 },
  { rank: 'P12', minCpph: 1 },
  { rank: 'NC', minCpph: 0 },
];

function getRankGaps(cpph: number | undefined, currentRank: string) {
  if (cpph == null) return { toNext: null, toPrev: null };

  const currentIdx = RANK_BOUNDARIES.findIndex(b => b.rank === currentRank);
  const nextRank = currentIdx > 0 ? RANK_BOUNDARIES[currentIdx - 1] : null;
  const prevRank = currentIdx < RANK_BOUNDARIES.length - 1 ? RANK_BOUNDARIES[currentIdx + 1] : null;

  return {
    toNext: nextRank ? nextRank.minCpph - cpph : null,
    toPrev: prevRank ? cpph - prevRank.minCpph : null,
  };
}
```

### Quick Stats Computation
```typescript
function computeQuickStats(profile: PlayerProfile, matches: ResultMatch[]) {
  // Best ranking: find highest-ranked discipline
  const rankings = [
    profile.rankings.simple,
    profile.rankings.double,
    profile.rankings.mixte,
  ].filter(Boolean);

  const bestRanking = rankings.length > 0
    ? rankings.reduce((best, r) => (r!.cpph ?? 0) > (best!.cpph ?? 0) ? r : best)
    : null;

  // Matches played this season
  const matchCount = matches.length; // Note: full history needed for accurate count

  // Win rate
  const wins = matches.filter(m => /* determine win */).length;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  return { bestRanking, matchCount, winRate };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FlatList for dashboard | ScrollView for non-list dashboards | N/A | ScrollView is correct for finite card-based layouts (not virtualized lists) |
| Separate loading per section | Promise.allSettled for parallel fetch | Standard practice | Faster load, graceful partial failure |

**Deprecated/outdated:**
- None relevant — the project uses current React Native 0.81.5 and Expo 54.

## Open Questions

1. **Exact CPPH rank boundaries**
   - What we know: French badminton uses NC, P12-P10, D9-D7, R6-R4, N3-N1 classification
   - What's unclear: The exact CPPH thresholds for each boundary. The values in code examples above are approximate.
   - Recommendation: Verify boundaries from FFBaD official documentation or by examining real player data. Make the lookup table easily updatable. LOW confidence on exact values.

2. **Match result API response shape**
   - What we know: `getResultsByLicence()` exists with a `ResultItem` schema (Date, Adversaire, Score, Epreuve, Tour — all optional)
   - What's unclear: Whether the API returns a win/loss indicator, how scores are formatted, whether "Adversaire" is a name or licence number
   - Recommendation: During implementation, log the actual response from `getResultsByLicence()` to confirm field names and formats. Handle missing fields gracefully.

3. **Season definition for "matches this season"**
   - What we know: FFBaD season typically runs September-June
   - What's unclear: Whether the API filters by season or returns all historical results
   - Recommendation: If API returns all results, filter by date (current September-June window). If this gets complex, show "total matches" instead of "this season" for v1.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/api/ffbad.ts`, `src/api/schemas.ts`, `src/api/client.ts` — existing API layer
- Codebase analysis: `app/(app)/player/[licence].tsx` — data fetching pattern reference
- Codebase analysis: `src/auth/context.tsx` — session/auth pattern
- Context7 `/websites/reactnative_dev` — RefreshControl, ScrollView documentation

### Secondary (MEDIUM confidence)
- FFBaD ranking system (publicly documented classification: NC through N1)

### Tertiary (LOW confidence)
- Exact CPPH boundary values (approximated from general knowledge, needs verification)
- Match result API response fields (schema exists but uses .passthrough() and optional fields)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, everything exists in codebase
- Architecture: HIGH — follows established patterns from Phase 2
- Pitfalls: MEDIUM — rank boundaries and match result shape need runtime verification

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable — no fast-moving dependencies)
