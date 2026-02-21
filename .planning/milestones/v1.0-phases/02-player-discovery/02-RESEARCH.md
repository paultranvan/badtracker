# Phase 2: Player Discovery - Research

**Researched:** 2026-02-17
**Domain:** React Native search UX, FFBaD player API integration, Expo Router navigation
**Confidence:** HIGH

## Summary

Phase 2 builds the player search and profile viewing experience on top of the existing FFBaD API client from Phase 1. The API functions (`searchPlayersByKeywords`, `searchPlayersByName`, `getLicenceInfo`) and Zod schemas are already implemented in `src/api/ffbad.ts` and `src/api/schemas.ts`. The work is primarily UI screens, search state management, and Expo Router navigation with dynamic routes.

The key technical challenge is live-search debouncing with proper cleanup (cancelling stale API calls), and structuring the Expo Router file-based routing to support a player profile detail screen accessible from both search results and future match history opponent links (Phase 4 requirement PLYR-04).

**Primary recommendation:** Use React Native's built-in `TextInput` + `FlatList` for search, a custom `useDebounce` hook for input debouncing, and Expo Router's `[licence]` dynamic route for player profiles. No additional libraries needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single search bar that handles both name and license number queries (auto-detect based on input)
- Live search with debounce — results update as user types, no submit button
- Minimum 3 characters before search fires (avoids noisy API calls)
- Empty results: simple "No players found" message, no extra guidance

### Claude's Discretion
- Results display: layout, information density per result, ordering, number of results shown
- Player profile screen: layout, sections, how ranking data is organized by discipline
- Navigation flow: how search is accessed, transitions between results and profiles, back navigation
- Loading states and error handling during search and profile loading

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLYR-01 | User can search for players by name | `searchPlayersByName` and `searchPlayersByKeywords` already exist in `src/api/ffbad.ts`; auto-detect input type (numeric = licence, alpha = name) |
| PLYR-02 | User can search for players by license number | `searchPlayersByKeywords` handles licence number lookup; detect numeric-only input to route to licence search |
| PLYR-03 | User can view player profile with name, club, rankings by discipline | `getLicenceInfo` returns name/club; rankings require additional API call or schema enrichment for discipline-level CPPH data |
| PLYR-04 | User can tap opponent in match history to navigate to profile | Expo Router dynamic route `player/[licence]` supports deep-linking from any screen; Phase 4 will add the match history screen that links here |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.81.5 | TextInput, FlatList, ActivityIndicator, Pressable | Built-in, no extra dependencies |
| expo-router | ~6.0.23 | File-based routing with `[licence]` dynamic segments | Already used for auth flow, extends naturally |
| zod | ^4.3.6 | Response validation schemas | Already used in Phase 1 API client |
| i18next + react-i18next | ^25.8.10 / ^16.5.4 | FR/EN translations for search UI strings | Already configured with language detection |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios (via client.ts) | ^1.13.5 | HTTP calls through existing `callFFBaD` | All API requests go through existing client |

### No New Dependencies Required

Phase 2 needs zero new npm packages. Everything is achievable with:
- React Native built-in components (TextInput, FlatList, View, Text, Pressable, ActivityIndicator)
- Expo Router (already installed) for dynamic routes
- Existing API client + Zod schemas (already built in Phase 1)
- Custom hooks for debounce (trivial, no library needed)

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/
│   ├── client.ts          # (exists) API client with retry
│   ├── ffbad.ts           # (exists) search + profile functions
│   └── schemas.ts         # (exists, extend) add player profile schema
├── hooks/
│   ├── useDebounce.ts     # NEW: debounce hook for search input
│   └── usePlayerSearch.ts # NEW: search state management hook
├── types/
│   └── ffbad.ts           # (exists, extend) add player profile types
└── i18n/
    └── locales/
        ├── fr.json        # (extend) add search/profile strings
        └── en.json        # (extend) add search/profile strings

app/
└── (app)/
    ├── (tabs)/
    │   ├── _layout.tsx    # (extend) add search tab
    │   ├── index.tsx      # Home (existing)
    │   ├── search.tsx     # NEW: search screen
    │   └── settings.tsx   # (existing)
    └── player/
        └── [licence].tsx  # NEW: player profile (dynamic route)
```

### Pattern 1: Live Search with Debounce
**What:** Custom `useDebounce` hook delays API calls until user stops typing, combined with AbortController for request cancellation.
**When to use:** Any TextInput that triggers API calls on change.
**Example:**
```typescript
// Source: Standard React pattern
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
```

### Pattern 2: Search State Hook
**What:** Encapsulates search query, debounce, API call, loading/error/results state.
**When to use:** Search screen — keeps component clean, logic testable.
**Example:**
```typescript
// Source: React hooks pattern
function usePlayerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setResults([]);
      return;
    }
    // Detect input type: all digits = licence number, otherwise = name
    const isLicence = /^\d+$/.test(debouncedQuery);
    // Call appropriate API function...
  }, [debouncedQuery]);

  return { query, setQuery, results, isLoading, error };
}
```

### Pattern 3: Expo Router Dynamic Routes
**What:** File `app/(app)/player/[licence].tsx` creates a route accessible via `router.push({ pathname: '/player/[licence]', params: { licence: '12345678' } })`.
**When to use:** Player profile screen — licence number in URL enables deep linking.
**Example:**
```typescript
// Source: Context7 - Expo Router SDK 55 docs
import { useLocalSearchParams } from 'expo-router';

export default function PlayerProfile() {
  const { licence } = useLocalSearchParams<{ licence: string }>();
  // Fetch player data using licence...
}
```

### Pattern 4: Input Type Auto-Detection
**What:** Determine if user is searching by name or licence number based on input content.
**When to use:** The single search bar (locked decision) needs to route to different API endpoints.
**Example:**
```typescript
function detectSearchType(query: string): 'licence' | 'name' {
  // Pure digits (possibly with spaces) → licence search
  if (/^\d[\d\s]*$/.test(query.trim())) return 'licence';
  return 'name';
}
```

### Anti-Patterns to Avoid
- **Calling API on every keystroke:** Must debounce. Without it, typing "dupont" fires 7 API calls. Use 300ms debounce.
- **Not cancelling stale requests:** If user types "dup" then "dupont", the "dup" response may arrive after "dupont". Use a stale-check (compare query at response time vs current query).
- **Nesting Stack inside Tabs for profiles:** Player profile should be a Stack screen ABOVE the tab layout, not a screen inside a tab. This avoids losing the tab bar context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce | Custom setTimeout management scattered in components | `useDebounce` hook (10 lines) | Centralizes cleanup, reusable, testable |
| Request cancellation | Manual boolean flags | Compare debouncedQuery at response time | Simpler than AbortController for this use case |
| List rendering | ScrollView with map() | FlatList | FlatList virtualizes — handles 100+ results without memory issues |
| Navigation params | Global state / context for selected player | Expo Router `[licence]` dynamic route params | URL-based, deep-linkable, no extra state management |

**Key insight:** This phase is mostly UI assembly. The hard infrastructure (API client, auth, error handling, retry logic) is already built. Don't over-engineer what is essentially "TextInput → API → FlatList → navigate to detail."

## Common Pitfalls

### Pitfall 1: Race Conditions in Search Results
**What goes wrong:** Fast typing causes multiple concurrent API calls; responses arrive out of order, showing stale results.
**Why it happens:** Network latency varies — "dup" request may resolve after "dupont" request.
**How to avoid:** Track the query that triggered each request. On response, only update state if the query still matches the current debouncedQuery.
**Warning signs:** Results flickering or showing wrong data briefly after typing.

### Pitfall 2: Excessive API Calls on Mount/Unmount
**What goes wrong:** Search fires on mount with empty string, or fires after component unmounts (React state update on unmounted component).
**Why it happens:** useEffect runs on mount; debounce timer may fire after navigation away.
**How to avoid:** Guard with `query.length >= 3` check; cleanup timer in useEffect return; use `cancelled` flag pattern (already used in auth context).
**Warning signs:** Console warnings about state updates on unmounted components.

### Pitfall 3: FFBaD API Returns String on No Results
**What goes wrong:** Schema validation fails because `Retour` is a string message instead of an empty array.
**Why it happens:** FFBaD API returns `{"Retour": "No Result"}` or similar string when no matches found, not `{"Retour": []}`.
**How to avoid:** The existing Zod schemas already handle `z.union([z.array(...), z.string()])` — this is correct. But the search hook must check if `Retour` is a string and treat it as "no results" rather than an error.
**Warning signs:** "No players found" never appears; instead users see an error message.

### Pitfall 4: Player Profile Not Accessible from Non-Tab Screens
**What goes wrong:** Player profile route only works from the search tab; navigating from match history (Phase 4) fails or loses navigation context.
**Why it happens:** Profile route placed inside `(tabs)/` directory, making it tab-specific.
**How to avoid:** Place `player/[licence].tsx` under `app/(app)/` (outside tabs), so it renders as a Stack screen on top of the tab navigator. This makes it accessible from any screen.
**Warning signs:** Back button from player profile doesn't return to the correct screen.

### Pitfall 5: Search Input Not Handling French Characters
**What goes wrong:** Searching for "André" or "François" returns no results or incorrect results.
**Why it happens:** Encoding issues in URL parameters.
**How to avoid:** Phase 1 already validated UTF-8 handling — axios defaults handle French characters correctly. No special handling needed, but verify in testing.
**Warning signs:** Searches with accented characters return fewer results than expected.

## Code Examples

### Search Screen with FlatList
```typescript
// Source: React Native FlatList docs (Context7)
<FlatList
  data={results}
  keyExtractor={(item) => item.Licence}
  renderItem={({ item }) => (
    <Pressable onPress={() => router.push({
      pathname: '/player/[licence]',
      params: { licence: item.Licence }
    })}>
      <Text>{item.Nom} {item.Prenom}</Text>
      <Text>{item.NomClub}</Text>
    </Pressable>
  )}
  ListEmptyComponent={
    query.length >= 3 && !isLoading ? (
      <Text>{t('search.noResults')}</Text>
    ) : null
  }
/>
```

### Dynamic Route for Player Profile
```typescript
// Source: Context7 - Expo Router docs
// File: app/(app)/player/[licence].tsx
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { getLicenceInfo } from '../../../src/api/ffbad';

export default function PlayerProfile() {
  const { licence } = useLocalSearchParams<{ licence: string }>();
  const [player, setPlayer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!licence) return;
    setIsLoading(true);
    getLicenceInfo(licence)
      .then(response => {
        if (Array.isArray(response.Retour) && response.Retour.length > 0) {
          setPlayer(response.Retour[0]);
        }
      })
      .finally(() => setIsLoading(false));
  }, [licence]);

  // Render player info...
}
```

### Auto-Detect Search Type
```typescript
function usePlayerSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 3) return;

    const isLicenceSearch = /^\d+$/.test(debouncedQuery.trim());

    if (isLicenceSearch) {
      searchPlayersByKeywords(debouncedQuery).then(handleResults);
    } else {
      searchPlayersByName(debouncedQuery).then(handleResults);
    }
  }, [debouncedQuery]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| lodash.debounce | Custom useDebounce hook (3 lines with useEffect) | React hooks (2019+) | No lodash dependency needed |
| React Navigation with manual config | Expo Router file-based routing | expo-router v2+ (2023+) | Dynamic routes via `[param]` file naming |
| Class component lifecycle for cleanup | useEffect cleanup function | React 16.8+ (2019) | Simpler cancellation pattern |

**Deprecated/outdated:**
- `componentWillUnmount` for cleanup: Use useEffect return function
- Manual route configuration: File-based routing is standard with Expo Router

## Open Questions

1. **Player ranking data by discipline**
   - What we know: `getLicenceInfo` returns basic info (name, club, active status). Rankings by discipline (simple, double, mixte) may need additional API functions or enriched schema.
   - What's unclear: Which FFBaD API function returns per-discipline CPPH rankings. The existing schemas don't include ranking fields.
   - Recommendation: Explore the API response from `getLicenceInfo` with `.passthrough()` — the actual response likely includes ranking fields not yet captured in the Zod schema. If not, may need `ws_getrankingevolutionbylicence` or similar. Plan should include a task to inspect and document the actual API response shape.

2. **Search result limit**
   - What we know: FFBaD API likely returns all matches (could be 50+ for common names like "Martin").
   - What's unclear: Whether the API supports pagination or limits.
   - Recommendation: Use FlatList (handles large lists efficiently). Consider showing first 50 results with a "showing first 50" message if results are very large.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/reactnative_dev` - FlatList renderItem, TextInput, component patterns
- Context7 `/websites/expo_dev_versions_v55_0_0` - Expo Router dynamic routes, useLocalSearchParams, router.push, Link with params
- Codebase inspection - `src/api/ffbad.ts`, `src/api/schemas.ts`, `src/api/client.ts` (existing API functions)

### Secondary (MEDIUM confidence)
- React hooks patterns for debounce - widely documented, standard approach
- FFBaD API behavior (string vs array Retour) - inferred from existing Zod schemas that already handle both cases

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and working from Phase 1
- Architecture: HIGH - Expo Router dynamic routes verified via Context7 official docs
- Pitfalls: HIGH - race conditions and FFBaD API quirks documented from Phase 1 experience

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable — no fast-moving dependencies)
