# Phase 6: Club Features - Research

**Researched:** 2026-02-20
**Domain:** Club leaderboard with FFBaD API + Expo Router tab screen
**Confidence:** MEDIUM-HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Leaderboard content
- Each player row shows: name + ranking category (P10, D7, NC, etc.)
- No CPPH score displayed — just the ranking category
- Combined view across disciplines — each player shows their best ranking
- Sorted by best ranking (N1 > R4 > P10 > D7 > NC)
- Tapping a player navigates to their profile (reuse existing /player/[licence] route)

#### Club scope & access
- Default to user's own club leaderboard
- User can browse other clubs' leaderboards too
- Club search available on the Club tab (search by club name)
- Club name tappable in player profiles to navigate to that club's leaderboard
- Dedicated tab in bottom navigation for Club
- User's own row highlighted visually in their club's leaderboard

#### Leaderboard display
- Numbered position indicators (#1, #2, #3...)
- Club header shows club name + total ranked member count
- Full scrollable list — show all club members, no pagination
- Pull-to-refresh to update leaderboard data

### Claude's Discretion
- Club search UX (inline vs overlay) — pick the cleanest approach
- Exact visual treatment for user's highlighted row
- Empty/edge state handling (club with few players, no ranking data, user has no club)
- Row layout and spacing details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RANK-04 | User can view club leaderboards showing rankings of players in their club | `ws_getrankingallbyclub(ID_Club)` is the FFBaD API function; `Club` field on player profile is the ID_Club parameter; ranking sort uses existing `RANK_BOUNDARIES` array from `src/utils/rankings.ts` |
</phase_requirements>

---

## Summary

Phase 6 adds a Club tab to the bottom navigation. The core data challenge is: given a player's `Club` field (which comes back from `ws_getlicenceinfobylicence`), fetch all ranked members of that club using `ws_getrankingallbyclub`. The FFBaD API test console at apitest.ffbad.org confirms this function exists and takes `ID_Club` as its sole parameter, returning rankings for all three disciplines per player.

The "best ranking" per player logic already exists in the codebase — `getBestRanking()` and `RANK_BOUNDARIES` in `src/utils/rankings.ts`. This logic can be reused directly to both select the displayed ranking category and sort the leaderboard. The ranking sort order (N1 > N2 > N3 > R4 > R5 > R6 > D7 > D8 > D9 > P10 > P11 > P12 > NC) maps to `RANK_BOUNDARIES` array index: lower index = better rank.

Club search is the key unknown. `ws_getclublist()` returns all clubs (potentially thousands), making it impractical for inline filtering. The cleanest approach is to search by name using a debounced TextInput that filters a locally-fetched list. However, given the potentially large club list, a better strategy is a server-side search using `ws_getclublistbycodep` with a department code, or simply using `ws_getclublist` and filtering client-side (clubs number ~3500 in France — manageable for a single cached fetch). The tab should open with the user's own club pre-loaded, with a search bar available to browse others.

**Primary recommendation:** Use `ws_getrankingallbyclub(ID_Club)` for leaderboard data, derive `ID_Club` from `session.licence` player profile's `Club` field, reuse `getBestRanking()` and `RANK_BOUNDARIES` for sort logic, and implement club search as an inline TextInput that filters a cached `ws_getclublist()` result.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Native FlatList | Built-in (RN 0.81) | Scrollable leaderboard list with pull-to-refresh | Already used in search.tsx and matches.tsx; optimal for long lists |
| expo-router Tabs | ~6.0.23 | Add Club tab to bottom navigation | Already used; adding a tab is just adding a file + Tabs.Screen entry |
| Zod | ^4.3.6 | Schema validation for ws_getrankingallbyclub response | Already used for all API responses |
| react-i18next | ^16.5.4 | Translations for Club tab strings | Already configured |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| RefreshControl | Built-in (RN) | Pull-to-refresh on leaderboard FlatList | Same pattern as index.tsx (dashboard) |
| useDebounce | src/hooks/useDebounce.ts | Debounce club search input | Already in codebase, used by usePlayerSearch |
| AsyncStorage | 2.2.0 | Cache club list (ws_getclublist) to avoid repeated fetches | Already installed; club list changes rarely |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws_getclublist + client filter | ws_getclublistbycodep | Department filter adds UX complexity (user must know their département); club list ~3500 is manageable in memory |
| ws_getrankingallbyclub | ws_getrankingallbyclubdate | Date variant for historical data — not needed here (current rankings only) |
| Inline search bar in Club tab | Separate search modal | Modal adds navigation complexity; inline is simpler and matches the search.tsx pattern already in the app |

**Installation:** No new packages required. All needed libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
app/(app)/(tabs)/
├── club.tsx            # NEW: Club tab screen (leaderboard + search)

src/
├── api/
│   ├── ffbad.ts        # ADD: getClubLeaderboard(), getClubList()
│   └── schemas.ts      # ADD: ClubRankingSchema, ClubListSchema
├── hooks/
│   └── useClubLeaderboard.ts   # NEW: data hook for club leaderboard
```

### Pattern 1: New Tab Screen

**What:** Add `club.tsx` inside `app/(app)/(tabs)/` — Expo Router automatically picks it up.
**When to use:** Any new bottom-navigation tab.
**Example:**

```typescript
// app/(app)/(tabs)/_layout.tsx — add this Tabs.Screen entry:
<Tabs.Screen
  name="club"
  options={{
    title: t('club.tab'),
    tabBarLabel: t('club.tab'),
  }}
/>
```

The tab order in `_layout.tsx` determines visual order. Insert between "Matches" and "Search" or after "Search" per product decision.

### Pattern 2: Club Leaderboard Screen Layout

**What:** Two-mode screen — leaderboard view (default) and club search view.
**When to use:** When a tab has a primary view plus search capability.

```typescript
// Conceptual structure of app/(app)/(tabs)/club.tsx
export default function ClubScreen() {
  const [mode, setMode] = useState<'leaderboard' | 'search'>('leaderboard');
  const [targetClubId, setTargetClubId] = useState<string | null>(null);

  // Default: load user's own club on mount
  // On club select from search: switch targetClubId → triggers leaderboard reload
}
```

The screen manages two states: which club to display (defaults to user's own), and whether the search panel is visible.

### Pattern 3: useClubLeaderboard Hook

**What:** Custom hook following the same pattern as `useDashboardData.ts` and `useMatchHistory.ts`.
**When to use:** Any async data fetch that needs loading/error/refresh states.

```typescript
// src/hooks/useClubLeaderboard.ts — pattern mirrors useDashboardData
export function useClubLeaderboard(clubId: string | null) {
  const [members, setMembers] = useState<LeaderboardEntry[]>([]);
  const [clubName, setClubName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async (isRefresh = false) => {
    if (!clubId) return;
    // ... fetch ws_getrankingallbyclub, sort, normalize
  }, [clubId]);

  // Returns: { members, clubName, rankedCount, isLoading, isRefreshing, error, refresh }
}
```

### Pattern 4: Ranking Sort Using Existing RANK_BOUNDARIES

**What:** Sort leaderboard by best ranking using the existing ordered array.
**When to use:** Any time you need to order players by FFBaD rank category.

```typescript
// src/utils/rankings.ts already has RANK_BOUNDARIES (index 0 = N1, highest)
// Sort leaderboard entries: lower RANK_BOUNDARIES index = better rank

import { RANK_BOUNDARIES } from '../utils/rankings';

function getRankIndex(classement: string): number {
  const idx = RANK_BOUNDARIES.findIndex(
    (b) => b.rank.toUpperCase() === classement.toUpperCase()
  );
  return idx === -1 ? RANK_BOUNDARIES.length : idx; // NC/unknown goes last
}

// Sort: ascending rank index = better rank first
entries.sort((a, b) => getRankIndex(a.bestRank) - getRankIndex(b.bestRank));
```

### Pattern 5: Highlighted "Current User" Row in FlatList

**What:** Conditionally apply a background style when the rendered item matches the signed-in user's licence.
**When to use:** Any leaderboard or list where the current user appears.

```typescript
// In renderItem:
const isCurrentUser = item.licence === session?.licence;

<View style={[styles.memberRow, isCurrentUser && styles.memberRowHighlight]}>
  ...
</View>

// Styles:
memberRowHighlight: {
  backgroundColor: '#eff6ff',  // matches app's blue accent palette
  borderLeftWidth: 3,
  borderLeftColor: '#2563eb',
},
```

### Pattern 6: Tappable Club Name in Player Profile

**What:** Player profile screen already renders `player.nomClub`. Make it a `Pressable` that navigates to the Club tab with the club ID.
**When to use:** Any cross-navigation from player profile to club leaderboard.

```typescript
// In app/(app)/player/[licence].tsx — replace Text with Pressable:
{player.nomClub && player.club ? (
  <Pressable
    onPress={() => router.push({
      pathname: '/(app)/(tabs)/club',
      params: { clubId: player.club }
    })}
  >
    <Text style={styles.clubNameLink}>{player.nomClub}</Text>
  </Pressable>
) : player.nomClub ? (
  <Text style={styles.clubName}>{player.nomClub}</Text>
) : null}
```

Note: Expo Router tabs don't easily accept params. The cleanest pattern is to use a URL-based approach or a lightweight Zustand store (already in the tech stack) to pass `targetClubId` to the Club tab. Alternatively, expose the club screen as a stack route outside tabs (like `/player/[licence]` is done), using a route like `/(app)/club/[clubId]`. This is cleaner for deep-linking from player profiles.

### Anti-Patterns to Avoid

- **Fetching ws_getclublist on every search keystroke:** Cache the club list in memory or AsyncStorage on first fetch. It changes rarely (new clubs join each season).
- **Sorting leaderboard in the render function:** Sort once in the hook when data arrives, not on every render.
- **Displaying CPPH in the leaderboard:** Out of scope per user decision — show only the rank category string (e.g., "P10").
- **Pagination:** Out of scope — show all members in a single scrollable list.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rank ordering | Custom string comparison logic | `RANK_BOUNDARIES` array index from `src/utils/rankings.ts` | Already implemented and tested |
| Best ranking per player | Custom discipline picker | `getBestRanking()` from `src/utils/rankings.ts` | Already handles simple/double/mixte selection by CPPH |
| Debounced club search | Manual setTimeout | `useDebounce` hook from `src/hooks/useDebounce.ts` | Already in codebase |
| API error classification | Custom error types | `NetworkError`, `ServerError` from `src/api/errors.ts` | Already used across all hooks |
| Pull-to-refresh | Custom gesture handler | `RefreshControl` with `isRefreshing` flag | Same pattern already in index.tsx and matches.tsx |

**Key insight:** The ranking utilities, error types, and hook patterns are already established. Phase 6 is primarily wiring together existing pieces with one new API endpoint.

---

## Common Pitfalls

### Pitfall 1: Club ID vs Club Name Confusion

**What goes wrong:** The `Club` field returned by `ws_getlicenceinfobylicence` is the club ID (numeric or alphanumeric code), while `NomClub` is the human-readable name. Passing `NomClub` to `ws_getrankingallbyclub` will fail.
**Why it happens:** Both fields exist on the player profile; developers assume the name is the key.
**How to avoid:** Use `player.club` (the `Club` field) as `ID_Club`, display `player.nomClub` in the UI.
**Warning signs:** API returns empty or error response when club name is passed.

### Pitfall 2: User Has No Club

**What goes wrong:** A player may have no club affiliation (`Club` and `NomClub` both undefined/null), causing the leaderboard to be unfetchable.
**Why it happens:** Some licences are individual, not club-affiliated.
**How to avoid:** Check for null `club` in session profile data. Show a message: "You are not affiliated with a club" + offer club search.
**Warning signs:** `useClubLeaderboard` called with null `clubId` causing unhandled fetch.

### Pitfall 3: ws_getrankingallbyclub Response Schema is Unknown

**What goes wrong:** The exact field names in the `ws_getrankingallbyclub` response are not documented (unlike the other API functions which are verified). It likely returns the same `LicenceInfoItem` shape (Nom, Prenom, Licence, ClassementSimple, ClassementDouble, ClassementMixte, NomClub, Club) based on the change log notes ("returns rankings for all 3 disciplines"), but this is inference, not confirmed.
**Why it happens:** FFBaD API has no public OpenAPI spec; we must infer from changelog and analogous endpoints.
**How to avoid:** Use `.passthrough()` on the Zod schema (same pattern as all existing schemas). Start with a permissive schema, log the real response in development to verify fields. The most likely shape is an array of player-ranking objects with the same fields as `LicenceInfoItem`.
**Warning signs:** Zod validation errors on first API call; empty leaderboard despite API returning data.

### Pitfall 4: Large Club List Performance

**What goes wrong:** `ws_getclublist()` returns ~3500 clubs. Rendering all of them in a FlatList during search will cause jank.
**Why it happens:** JavaScript filtering + React rendering of 3500+ items is slow.
**How to avoid:** Filter the list in JavaScript (not render it all) — only pass `filteredClubs` to FlatList. Use `useMemo` for the filter. Show results only when query is 3+ characters (same pattern as `usePlayerSearch`).
**Warning signs:** UI lag when typing in club search; slow initial load.

### Pitfall 5: Tab Navigation with Club ID Parameter

**What goes wrong:** Navigating to the Club tab from a player profile with a specific `clubId` parameter doesn't work cleanly with Expo Router's tab navigation.
**Why it happens:** Tab screens don't naturally accept URL params in the same way stack screens do; params passed to a tab via `router.push` may not persist or may behave inconsistently.
**How to avoid:** Two clean options:
  1. Expose club leaderboard as a stack route: `/(app)/club/[clubId]` (outside tabs, like `/player/[licence]`). Navigate there from player profiles. The Club tab shows the user's own club by default.
  2. Use a lightweight state (e.g., a module-level variable or Zustand atom) to pass the `targetClubId` to the Club tab.
  Option 1 is architecturally cleaner and matches the existing player profile pattern.
**Warning signs:** Club ID not available when arriving at Club tab from player profile.

### Pitfall 6: "Best Ranking" When Player Has No Discipline Rankings

**What goes wrong:** Some club members may have a licence but no CPPH data (NC across all disciplines, or just joined). The leaderboard sort/display must handle this gracefully.
**Why it happens:** Not all players have competed; ranking data may be entirely absent.
**How to avoid:** Treat "no ranking data" the same as "NC" — index at the end of RANK_BOUNDARIES. Display "NC" for their category. These players should appear at the bottom of the leaderboard.
**Warning signs:** Null reference errors in sort comparator; crashes when accessing `bestRanking.classement` on null.

---

## Code Examples

Verified patterns from existing codebase and FFBaD API changelog:

### API Function: Get Club Leaderboard

```typescript
// src/api/ffbad.ts — add alongside existing functions

/**
 * Get rankings for all disciplines for all members of a club.
 * Uses ws_getrankingallbyclub with the club's ID (the Club field from player profile).
 *
 * NOTE: Response schema inferred from changelog description + analogy with LicenceInfoItem.
 * Use .passthrough() and log in dev to verify actual field names.
 */
export async function getClubLeaderboard(
  clubId: string
): Promise<ClubRankingResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getrankingallbyclub',
      params: [clubId],
    },
    ClubRankingSchema
  );
}

/**
 * Get all clubs list for club search.
 * Returns the full list of FFBaD-registered clubs (~3500 entries).
 */
export async function getClubList(): Promise<ClubListResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getclublist',
      params: [],
    },
    ClubListSchema
  );
}
```

### Zod Schema: Club Ranking (Permissive)

```typescript
// src/api/schemas.ts — add permissive schema until real response is verified

/**
 * Response item from ws_getrankingallbyclub.
 * Schema is inferred — use .passthrough() and verify in development.
 * Expected fields mirror LicenceInfoItem with ranking data for all 3 disciplines.
 */
const ClubRankingItem = z
  .object({
    Licence: z.string().optional(),
    Nom: z.string().optional(),
    Prenom: z.string().optional(),
    Club: z.string().optional(),
    NomClub: z.string().optional(),
    ClassementSimple: z.string().optional(),
    ClassementDouble: z.string().optional(),
    ClassementMixte: z.string().optional(),
    CPPHSimple: z.union([z.string(), z.number()]).optional(),
    CPPHDouble: z.union([z.string(), z.number()]).optional(),
    CPPHMixte: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough(); // Critical: captures unknown fields without validation failure

export const ClubRankingSchema = z.object({
  Retour: z.union([z.array(ClubRankingItem), z.string()]),
});

export type ClubRankingResponse = z.infer<typeof ClubRankingSchema>;

/**
 * Response item from ws_getclublist.
 * Schema inferred from ws_getclubbyclub description.
 */
const ClubItem = z
  .object({
    ID_Club: z.string().optional(),
    Club: z.string().optional(),
    NomClub: z.string().optional(),
    Nom: z.string().optional(),
  })
  .passthrough();

export const ClubListSchema = z.object({
  Retour: z.union([z.array(ClubItem), z.string()]),
});

export type ClubListResponse = z.infer<typeof ClubListSchema>;
```

### Leaderboard Sort: Best Rank per Player

```typescript
// Reuse RANK_BOUNDARIES from src/utils/rankings.ts
import { RANK_BOUNDARIES, getBestRanking } from '../utils/rankings';

export interface LeaderboardEntry {
  licence: string;
  nom: string;
  prenom: string;
  bestRank: string;       // e.g. "P10", "NC"
  position: number;       // 1-based after sort
}

function getRankSortIndex(classement: string): number {
  const upper = classement.toUpperCase().trim();
  const idx = RANK_BOUNDARIES.findIndex(
    (b) => b.rank.toUpperCase() === upper
  );
  return idx === -1 ? RANK_BOUNDARIES.length : idx;
}

function normalizeToLeaderboard(raw: ClubRankingItem[]): LeaderboardEntry[] {
  const entries = raw
    .filter((item) => item.Licence) // skip incomplete entries
    .map((item) => {
      // Build rankings object matching PlayerProfile shape
      const rankings = {
        simple: item.ClassementSimple
          ? { classement: item.ClassementSimple, cpph: parseCpph(item.CPPHSimple) }
          : undefined,
        double: item.ClassementDouble
          ? { classement: item.ClassementDouble, cpph: parseCpph(item.CPPHDouble) }
          : undefined,
        mixte: item.ClassementMixte
          ? { classement: item.ClassementMixte, cpph: parseCpph(item.CPPHMixte) }
          : undefined,
      };
      const best = getBestRanking(rankings);
      const bestRank = best?.classement ?? 'NC';

      return {
        licence: item.Licence!,
        nom: item.Nom ?? '',
        prenom: item.Prenom ?? '',
        bestRank,
      };
    });

  // Sort: lower index in RANK_BOUNDARIES = better rank = comes first
  entries.sort(
    (a, b) => getRankSortIndex(a.bestRank) - getRankSortIndex(b.bestRank)
  );

  // Add 1-based position after sorting
  return entries.map((entry, index) => ({ ...entry, position: index + 1 }));
}
```

### FlatList with Pull-to-Refresh and Highlighted Row

```typescript
// Follows existing pattern from app/(app)/(tabs)/index.tsx
<FlatList
  data={members}
  keyExtractor={(item) => item.licence}
  renderItem={({ item }) => (
    <LeaderboardRow
      entry={item}
      isCurrentUser={item.licence === session?.licence}
      onPress={() =>
        router.push({
          pathname: '/player/[licence]',
          params: { licence: item.licence },
        })
      }
    />
  )}
  refreshControl={
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={refresh}
      colors={['#2563eb']}
      tintColor="#2563eb"
    />
  }
  ListHeaderComponent={<ClubHeader name={clubName} count={members.length} />}
  contentContainerStyle={styles.listContent}
/>
```

### Club Search: Inline TextInput + Filtered List

```typescript
// Inline search pattern — mirrors search.tsx
const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 300);

const filteredClubs = useMemo(() => {
  if (debouncedQuery.length < 3) return [];
  const lower = debouncedQuery.toLowerCase();
  return allClubs.filter((c) =>
    (c.NomClub ?? c.Nom ?? '').toLowerCase().includes(lower)
  );
}, [allClubs, debouncedQuery]);
```

### Adding the Tab to Navigation

```typescript
// app/(app)/(tabs)/_layout.tsx — insert after 'matches', before 'search':
<Tabs.Screen
  name="club"
  options={{
    title: t('club.tab'),
    tabBarLabel: t('club.tab'),
  }}
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual fetch + useEffect | Custom hook pattern (as used in this codebase) | Established in Phase 3 | All data fetching goes through hooks with loading/error/refresh states |
| Direct API calls in components | Centralized in `src/api/ffbad.ts` | Phase 1 | New API function `getClubLeaderboard` belongs there |
| Sorting in render | Sort in hook on data arrival | Established in Phase 4 | `useMemo` or sort in `useCallback` when data arrives |

---

## Open Questions

1. **Exact fields returned by ws_getrankingallbyclub**
   - What we know: Changelog says "returns latest rankings for all 3 disciplines for a given club"; the function has existed since at least 2015 (per changelog)
   - What's unclear: Exact field names (ClassementSimple vs Classement_Simple vs SimpleClassement), whether Licence is always included, whether it includes NomClub
   - Recommendation: Use the permissive `.passthrough()` schema above; add a development `console.log` on first real API call to capture the actual response shape before building the UI

2. **ID_Club format from player profile**
   - What we know: The `Club` field on `LicenceInfoItem` is passed back as returned by `ws_getlicenceinfobylicence`; the changelog mentions club numbers and instance IDs; MyFFBaD URLs suggest sequential numeric club IDs
   - What's unclear: Whether `Club` field from player profile is exactly the ID_Club that `ws_getrankingallbyclub` accepts (it should be, but worth verifying with one test call)
   - Recommendation: Test with authenticated user's own `Club` field value immediately in development

3. **ws_getclublist response size and fields**
   - What we know: Function exists on apitest.ffbad.org; changelog confirms it exists
   - What's unclear: Size of response (is it ~3500 clubs as expected?), exact field names (NomClub, Nom, ID_Club format)
   - Recommendation: Cache the response in AsyncStorage with a 24-hour TTL; filter client-side

4. **Tab order in bottom navigation**
   - What we know: Current order is Home > Matches > Search > Settings
   - What's unclear: Where "Club" fits — user hasn't specified order
   - Recommendation: Insert after Search, before Settings (Home > Matches > Search > Club > Settings), or make it the second tab after Home. Given club features are a core differentiator, placing it prominently makes sense.

5. **Club leaderboard navigation from player profile**
   - What we know: Player profile renders `player.nomClub` as plain Text; routing to tab with param is awkward
   - What's unclear: Whether to expose `/club/[clubId]` as a stack route (outside tabs) or use a state bridge
   - Recommendation: Expose `/(app)/club/[clubId]` as a stack screen in `app/(app)/_layout.tsx`, mirroring how `player/[licence]` is done. The Club tab shows the user's own club by default; deep navigation from profiles uses the stack route. This is the cleanest pattern and consistent with the existing architecture.

---

## Sources

### Primary (HIGH confidence)
- `apitest.ffbad.org` — confirmed `ws_getrankingallbyclub(ID_Club)`, `ws_getclublist()`, `ws_getclubbyclub(ID_Club)` all exist
- `api.ffbad.org/Change_Log.php` — confirmed changelog entries for `ws_getrankingallbyclub` (2015 optimization notes), `ws_GetInstanceDetailByInstance` (takes N°Club or Instance ID)
- `/home/paul/dev/perso/sport/badtracker/src/api/ffbad.ts` — existing `PlayerProfile` interface; `Club` and `NomClub` fields come from `ws_getlicenceinfobylicence`
- `/home/paul/dev/perso/sport/badtracker/src/utils/rankings.ts` — `RANK_BOUNDARIES`, `getBestRanking()`, `getRankLabel()` all reusable
- `/home/paul/dev/perso/sport/badtracker/src/api/schemas.ts` — `.passthrough()` pattern established for all schemas
- `/home/paul/dev/perso/sport/badtracker/app/(app)/(tabs)/_layout.tsx` — existing tab layout structure; adding a tab is straightforward
- `/home/paul/dev/perso/sport/badtracker/src/hooks/useDashboardData.ts` — hook pattern with isLoading/isRefreshing/error/refresh to mirror

### Secondary (MEDIUM confidence)
- `growthhacking.fr` discussion — confirmed myffbad club IDs are sequential numeric values in URL paths
- `badiste.fr` partnership page — confirmed badiste uses FFBaD API with agreement; club data is sourced from FFBaD's Poona database
- React Native docs (reactnative.dev) — RefreshControl usage with FlatList confirmed

### Tertiary (LOW confidence)
- Inferred field names for `ws_getrankingallbyclub` response (ClassementSimple, ClassementDouble, ClassementMixte, CPPHSimple, etc.) — based on analogy with `ws_getlicenceinfobylicence` which returns the same fields; unverified until first API call

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already installed
- Architecture: HIGH — follows established patterns (hook + screen + FlatList + RefreshControl)
- FFBaD API function existence: HIGH — confirmed on apitest.ffbad.org and changelog
- FFBaD API response shape: LOW — inferred from analogy; must verify with a live call in development
- Ranking sort logic: HIGH — reuses existing RANK_BOUNDARIES
- Club search approach: MEDIUM — ws_getclublist exists; response fields and size unverified

**Research date:** 2026-02-20
**Valid until:** 2026-08-20 (stable APIs; Expo Router patterns are stable)
