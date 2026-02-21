# Phase 4: Match History - Research

**Researched:** 2026-02-19
**Domain:** React Native list rendering, data filtering, collapsible headers, accordion UI
**Confidence:** HIGH

## Summary

Phase 4 builds a full match history screen with tournament-grouped matches, discipline filtering, season selection, win/loss statistics, and inline match detail expansion. The existing codebase already provides the API layer (`getResultsByLicence` in `src/api/ffbad.ts`), Zod schema validation (`ResultByLicenceSchema`), navigation structure (Expo Router tabs + stack), and i18n patterns. The match data is already fetched and previewed on the dashboard (Phase 3) via `useDashboardData`.

The primary technical decisions involve: using React Native's `SectionList` for tournament-grouped rendering, `Animated.event` with scroll interpolation for the collapsible stats header, `LayoutAnimation` for accordion expand/collapse, and local state filtering (no new API calls for discipline/season filters since all data is fetched at once).

**Primary recommendation:** Use `SectionList` for the tournament-grouped match list, `Animated.Value` with scroll-driven interpolation for the collapsible header, and `LayoutAnimation` for accordion expansion. No new dependencies needed -- everything is built into React Native.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Matches grouped by tournament (tournament name + date as section headers)
- Full info per match row: W/L badge (V/D), opponent name, score, discipline icon, round, date, points gained/lost
- Tapping opponent name navigates to /player/[licence] (Phase 2 player profile)
- For doubles/mixed: show partner name ("avec Paul Dupont") alongside opponent pair
- Pull-to-refresh to update match data from FFBaD
- Horizontal tappable chips: Tous | Simple | Double | Mixte with match counts
- Filtering updates both the match list AND the win/loss stats section
- Season picker (dropdown/selector) to choose season
- Collapsible header that shrinks as you scroll down the match list
- Stats show: win percentage + colored progress bar + total wins / total losses
- Stats follow the active discipline filter
- Tap match row to expand inline (accordion style, no navigation)
- Expanded view: set scores, tournament name (tappable), points impact, duration if available
- Tapping tournament name in expanded view filters to that tournament's matches

### Claude's Discretion
- Exact accordion animation and expand/collapse behavior
- Loading states and skeleton screens
- Error handling when match data is unavailable
- Collapsible header animation details
- How season picker is presented (dropdown, bottom sheet, etc.)
- Handling matches with missing data (no score, no tournament info)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MTCH-01 | User can view full match history from FFBaD | `getResultsByLicence` API already exists; SectionList for grouped rendering; season picker for historical data |
| MTCH-02 | User can filter by discipline (simple, double, mixte) | Horizontal chip filters with client-side filtering on discipline field from API response |
| MTCH-03 | Match details: date, opponent, score, tournament, round | `ResultItem` schema has Date, Adversaire, Score, Epreuve, Tour fields; accordion expand for set scores and points impact |
| MTCH-04 | Pull-to-refresh to update match data | RefreshControl on SectionList (same pattern as dashboard) |
| MTCH-05 | Win/loss breakdown statistics per discipline | Computed from filtered match data; displayed in collapsible header with progress bar |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| React Native SectionList | Tournament-grouped match list | Built-in, performant virtualized list with section headers |
| React Native Animated | Collapsible header scroll animation | Built-in, supports native driver for smooth 60fps scroll tracking |
| React Native LayoutAnimation | Accordion expand/collapse | Built-in, simple API for layout changes without manual measurement |
| Expo Router | Match history route + navigation | Already used for tabs and player profile |
| react-i18next | FR/EN translation strings | Already used throughout app |
| Zod | Response validation | Already used; ResultByLicenceSchema exists but needs field expansion |

### No New Dependencies Required
This phase uses only built-in React Native APIs and existing project dependencies. No `npm install` needed.

## Architecture Patterns

### Recommended File Structure
```
src/
├── hooks/
│   └── useMatchHistory.ts         # Data fetching, filtering, grouping logic
├── utils/
│   └── matchHistory.ts            # Pure functions: grouping, filtering, stats computation
app/(app)/
├── (tabs)/
│   └── matches.tsx                # Match history tab screen (new tab)
```

### Pattern 1: SectionList with Tournament Grouping
**What:** Group matches by tournament name + date into SectionList sections
**When to use:** When displaying categorized list data with headers

```typescript
// Group matches by tournament
interface MatchSection {
  title: string;      // Tournament name
  date: string;       // Tournament date
  data: MatchItem[];  // Matches in this tournament
}

// SectionList usage
<SectionList
  sections={filteredSections}
  renderItem={({ item }) => <MatchRow match={item} />}
  renderSectionHeader={({ section }) => <TournamentHeader section={section} />}
  stickySectionHeadersEnabled={true}
  keyExtractor={(item, index) => `${item.date}-${index}`}
  refreshControl={<RefreshControl ... />}
/>
```

### Pattern 2: Animated Collapsible Header
**What:** Stats header that shrinks/collapses as user scrolls down the match list
**When to use:** When header content should yield space to list content on scroll

```typescript
const scrollY = useRef(new Animated.Value(0)).current;
const HEADER_MAX_HEIGHT = 160;
const HEADER_MIN_HEIGHT = 0;

const headerHeight = scrollY.interpolate({
  inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
  outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
  extrapolate: 'clamp',
});

const headerOpacity = scrollY.interpolate({
  inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) / 2],
  outputRange: [1, 0],
  extrapolate: 'clamp',
});

// Attach to SectionList onScroll
onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
  { useNativeDriver: false } // height animation can't use native driver
)}
```

### Pattern 3: Accordion Expand/Collapse with LayoutAnimation
**What:** Tap a match row to expand inline showing set scores and details
**When to use:** When expanding content in-place without navigation

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);

const toggleExpand = (matchId: string) => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpandedId(prev => prev === matchId ? null : matchId);
};
```

Note: On Android, `UIManager.setLayoutAnimationEnabledExperimental(true)` must be called. This can be done once in the app entry point.

### Pattern 4: Client-Side Filtering
**What:** Filter matches by discipline and season without re-fetching from API
**When to use:** When all data is already loaded and filters are local transformations

```typescript
// All matches loaded once, filter is a derived computation
const filteredMatches = useMemo(() => {
  let matches = allMatches;
  if (activeDiscipline !== 'all') {
    matches = matches.filter(m => m.discipline === activeDiscipline);
  }
  if (activeSeason) {
    matches = matches.filter(m => matchInSeason(m, activeSeason));
  }
  return matches;
}, [allMatches, activeDiscipline, activeSeason]);
```

### Anti-Patterns to Avoid
- **FlatList for grouped data:** Use SectionList, not FlatList with manual section headers
- **Re-fetching on every filter change:** Load all data once, filter client-side
- **Animated.event with useNativeDriver for height:** Height/layout animations cannot use native driver; only transform and opacity can
- **ScrollView wrapping SectionList:** Nested scrollable views cause gesture conflicts; use ListHeaderComponent instead
- **Inline styles in renderItem:** Create StyleSheet once outside component, not inline objects that cause re-renders

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualized grouped lists | Custom scroll view with manual recycling | `SectionList` | Built-in virtualization, memory management, sticky headers |
| Scroll-driven animation | onScroll event handler with setState | `Animated.event` with interpolation | Native thread performance, no JS bridge bottleneck |
| Layout expand/collapse | Manual height measurement + animation | `LayoutAnimation` | Handles all affected siblings automatically |
| Pull-to-refresh | Custom gesture detection | `RefreshControl` | Platform-native behavior, consistent UX |

## Common Pitfalls

### Pitfall 1: SectionList Re-rendering on Every Filter Change
**What goes wrong:** Entire list re-renders when filter state changes, causing scroll position loss and jank
**Why it happens:** New sections array reference created on every render
**How to avoid:** Memoize sections computation with `useMemo`, memoize row components with `React.memo`
**Warning signs:** Visible flicker when switching discipline filters

### Pitfall 2: LayoutAnimation on Android Without Enablement
**What goes wrong:** Accordion expand/collapse has no animation on Android
**Why it happens:** `LayoutAnimation` is experimental on Android and disabled by default
**How to avoid:** Call `UIManager.setLayoutAnimationEnabledExperimental(true)` in app entry
**Warning signs:** Layout changes are instant (no animation) on Android

### Pitfall 3: Collapsible Header with useNativeDriver
**What goes wrong:** App crashes or animation doesn't work
**Why it happens:** `useNativeDriver: true` cannot animate `height` or `maxHeight` -- only `transform` and `opacity`
**How to avoid:** Use `useNativeDriver: false` for height interpolation, or use transform translateY + opacity only
**Warning signs:** Yellow box warning about native driver and non-supported style property

### Pitfall 4: FFBaD API ResultItem Schema Too Loose
**What goes wrong:** Missing fields cause runtime errors when accessing match data
**Why it happens:** Current `ResultItem` schema has all optional fields -- real API may return additional fields needed (discipline, partner, points impact, set scores)
**How to avoid:** Inspect real API response during development, expand schema with `.passthrough()` to capture extras, access via type assertion on raw data
**Warning signs:** Matches display with many "-" placeholders

### Pitfall 5: Season Detection from Match Dates
**What goes wrong:** Matches assigned to wrong season
**Why it happens:** French badminton season runs September to August (not calendar year); date parsing needs to account for this
**How to avoid:** Season boundary = September 1. A match on 2025-10-15 belongs to season 2025-2026. Parse date correctly.
**Warning signs:** Matches disappear when selecting a season

## Code Examples

### Tournament Grouping Function
```typescript
interface MatchItem {
  id: string;
  date?: string;
  opponent?: string;
  opponentLicence?: string;
  partner?: string;
  score?: string;
  discipline?: 'simple' | 'double' | 'mixte';
  round?: string;
  tournament?: string;
  tournamentDate?: string;
  isWin?: boolean;
  pointsImpact?: number;
  setScores?: string[];
  duration?: string;
}

interface MatchSection {
  title: string;
  date: string;
  data: MatchItem[];
}

function groupByTournament(matches: MatchItem[]): MatchSection[] {
  const groups = new Map<string, MatchItem[]>();

  for (const match of matches) {
    const key = match.tournament ?? 'unknown';
    const existing = groups.get(key) ?? [];
    existing.push(match);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([tournament, data]) => ({
    title: tournament,
    date: data[0]?.tournamentDate ?? data[0]?.date ?? '',
    data,
  }));
}
```

### Win/Loss Stats Computation
```typescript
interface WinLossStats {
  wins: number;
  losses: number;
  total: number;
  winPercentage: number;
}

function computeWinLossStats(matches: MatchItem[]): WinLossStats {
  const withResult = matches.filter(m => m.isWin !== undefined);
  const wins = withResult.filter(m => m.isWin === true).length;
  const losses = withResult.filter(m => m.isWin === false).length;
  const total = withResult.length;
  const winPercentage = total > 0 ? Math.round((wins / total) * 100) : 0;

  return { wins, losses, total, winPercentage };
}
```

### Season Detection
```typescript
// French badminton season: September 1 to August 31
function getSeasonFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  // September (8) through December (11) -> current year to next year
  // January (0) through August (7) -> previous year to current year
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

function getAvailableSeasons(matches: MatchItem[]): string[] {
  const seasons = new Set<string>();
  for (const match of matches) {
    if (match.date) {
      seasons.add(getSeasonFromDate(match.date));
    }
  }
  return Array.from(seasons).sort().reverse();
}
```

## Existing Codebase Integration Points

### Already Built (can reuse directly)
| Component | Location | Reuse |
|-----------|----------|-------|
| `getResultsByLicence()` | `src/api/ffbad.ts` | Fetches match data from FFBaD API |
| `ResultByLicenceSchema` | `src/api/schemas.ts` | Zod validation (needs field expansion) |
| `toMatchPreview()` | `src/hooks/useDashboardData.ts` | Match data normalization (extend for full detail) |
| `useSession()` | `src/auth/context.tsx` | Get current user's licence number |
| Error classes | `src/api/errors.ts` | NetworkError, ServerError for error handling |
| Navigation | `app/(app)/_layout.tsx` | Stack layout for modal/screen routes |
| Tab layout | `app/(app)/(tabs)/_layout.tsx` | Add matches tab |
| Dashboard link | `app/(app)/(tabs)/index.tsx` | "Voir tous les matchs" stub at line ~202 |
| Rankings utils | `src/utils/rankings.ts` | CPPH rank labels for reference |

### Needs Modification
| What | Why |
|------|-----|
| `ResultItem` schema in `schemas.ts` | Add discipline, partner, points impact, set scores fields (with .passthrough() as safety net) |
| Dashboard "Voir tous les matchs" button | Wire up navigation to match history tab/screen |
| Tab layout `_layout.tsx` | Add "Matchs" tab between Home and Search |
| App layout `_layout.tsx` | No change needed if matches is a tab (not a stack screen) |

### Navigation Decision
The match history should be a **tab** (not a stack screen) because:
1. It's a primary destination the user will access frequently
2. The dashboard has a "Voir tous les matchs" link that should navigate to it
3. It's a peer to Home, Search, and Settings
4. Add it between Home and Search in the tab bar

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FlatList + manual section headers | SectionList (built-in) | React Native 0.43+ | Native section support, sticky headers, better performance |
| Animated API only | LayoutAnimation for simple cases | Always available | Simpler API for expand/collapse, no manual height tracking |
| ScrollView + manual scroll tracking | Animated.event with scroll mapping | React Native 0.46+ | Native thread animation, no JS bridge overhead |

## Open Questions

1. **FFBaD API response fields for match detail**
   - What we know: `ResultItem` has Date, Adversaire, Score, Epreuve, Tour (all optional)
   - What's unclear: Whether API returns discipline type, partner name, set scores, points impact, tournament date as separate fields, or if these are embedded in other fields
   - Recommendation: Use `.passthrough()` on schema, inspect raw response in development, parse available fields gracefully with fallbacks. The dashboard `toMatchPreview` already handles this pattern.

2. **Season parameter in API call**
   - What we know: `getResultsByLicence` currently sends only licence number
   - What's unclear: Whether `ws_getresultbylicence` accepts a season parameter, or returns all seasons
   - Recommendation: Try API without season param first (may return current season only). If it returns all data, filter client-side. If it returns only current season, check if API accepts additional params array for season filtering.

## Sources

### Primary (HIGH confidence)
- React Native official docs (reactnative.dev) - SectionList, Animated, LayoutAnimation APIs
- Existing codebase analysis - all integration points verified by reading source files

### Secondary (MEDIUM confidence)
- FFBaD API response shape - based on existing schema stubs and dashboard implementation, not verified against live API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all built-in React Native APIs, no new dependencies
- Architecture: HIGH - patterns match existing codebase conventions
- Pitfalls: HIGH - well-documented React Native issues
- API response shape: MEDIUM - schema stubs exist but full response not verified

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable -- React Native core APIs)
