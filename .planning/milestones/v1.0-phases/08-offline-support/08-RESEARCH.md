# Phase 8: Offline Support - Research

**Researched:** 2026-02-20
**Domain:** React Native offline caching, network connectivity detection, cache-first data patterns
**Confidence:** HIGH

## Summary

Phase 8 adds offline support to BadTracker: caching previously loaded data for offline viewing, showing offline indicators, and auto-refreshing when connectivity returns. The project already uses AsyncStorage (for bookmarks, language prefs) and has a consistent hook pattern across all data features (useDashboardData, useMatchHistory, useRankingEvolution, useClubLeaderboard).

The core approach is a **cache layer** that wraps AsyncStorage with JSON serialization and sits between the existing hooks and the API. Each hook adopts a "cache-first-then-fetch" pattern: return cached data immediately, fetch in background, update cache on success. A **ConnectivityProvider** using `@react-native-community/netinfo` provides online/offline state app-wide, enabling the offline status bar and conditional behavior (disable search, show error screens for uncached data).

**Primary recommendation:** Add `@react-native-community/netinfo` for connectivity detection. Build a thin cache utility on top of the existing AsyncStorage. Modify each data hook to read-from-cache-first, then fetch-and-update. Add a ConnectivityProvider context and an OfflineBar component.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- User's own data cached: dashboard (profile, stats), match history, ranking evolution chart data
- User's own club leaderboard cached
- Bookmarked players' profiles and rankings cached
- NOT cached: non-bookmarked player profiles, other clubs' leaderboards, search results
- Auto-refresh on app open (foreground) if online — show cached immediately, update silently in background
- No "last updated" timestamp displayed on screens
- Auto-refresh silently when connectivity returns (no user prompt)
- Pull-to-refresh still works as before (overrides cache with fresh data)
- Subtle colored status bar below header when offline (e.g., orange bar, minimal text)
- Auto-dismiss immediately when back online (no "back online" transition)
- Non-cached data (e.g., non-bookmarked player profile) shows error screen: "You're offline and this data isn't available" with retry option
- Search disabled when offline: "Search requires an internet connection"
- Cache cleared on logout (clean slate for next login)
- "Clear cache" button in Settings with confirmation
- No auto-expiry — cache persists until manually cleared or logout
- Bookmarks list NOT cleared by cache clear (bookmarks are device-tied, separate storage per Phase 7)

### Claude's Discretion
- Cache storage mechanism (AsyncStorage keys structure, or a cache layer abstraction)
- Connectivity detection approach (NetInfo or similar)
- Exact offline bar styling and animation
- How to structure the cache-first-then-fetch pattern across existing hooks

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | App caches previously loaded data locally for offline viewing | Cache utility on AsyncStorage + cache-first pattern in each hook |
| INFR-02 | App shows a clear indicator when displaying cached/offline data vs live data | ConnectivityProvider + OfflineBar component using NetInfo |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-native-community/netinfo | ^11.x | Network connectivity detection | Standard RN community library, 86.5 benchmark score, useNetInfo hook + addEventListener, supports wifi/cellular/none detection |
| @react-native-async-storage/async-storage | 2.2.0 | Cache persistence | Already installed and used (bookmarks, i18n language). Key-value store, JSON serialization |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-toast-message | ^2.3.3 | Already installed | Not needed for offline — using status bar instead |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AsyncStorage | react-native-mmkv | 30x faster, sync API, encryption — but overkill for this use case. AsyncStorage already in project, data volume is small (single user's data), no perf bottleneck |
| @react-native-community/netinfo | expo-network | NetInfo is more mature, better documented, has useNetInfo hook. expo-network only provides fetch-once, no subscription |

**Installation:**
```bash
npx expo install @react-native-community/netinfo
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cache/
│   └── storage.ts          # Cache utility: get/set/clear/keys with JSON + AsyncStorage
├── connectivity/
│   └── context.tsx          # ConnectivityProvider with useNetInfo, OfflineBar component
├── hooks/                   # Existing hooks modified to use cache-first pattern
│   ├── useDashboardData.ts  # + cache read/write
│   ├── useMatchHistory.ts   # + cache read/write
│   ├── useRankingEvolution.ts # + cache read/write
│   └── useClubLeaderboard.ts  # + cache read/write
└── ...
```

### Pattern 1: Cache Utility Layer
**What:** A thin abstraction over AsyncStorage that handles JSON serialization, namespaced keys, and bulk clear operations.
**When to use:** All cache read/write operations.
**Example:**
```typescript
// Source: AsyncStorage docs + project patterns
const CACHE_PREFIX = 'badtracker_cache:';

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
  } catch {
    // Silently ignore — cache is best-effort
  }
}

export async function cacheClear(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Silently ignore
  }
}
```

### Pattern 2: Cache-First-Then-Fetch in Hooks
**What:** Each data hook reads from cache on mount (instant UI), then fetches from API in background, then updates cache on success.
**When to use:** All data hooks for cacheable data (dashboard, matches, rankings, club).
**Example:**
```typescript
// Inside useDashboardData fetchData:
const fetchData = useCallback(async (isRefresh = false) => {
  if (!licence) return;

  // 1. Load from cache immediately (non-blocking)
  if (!isRefresh) {
    const cached = await cacheGet<CachedDashboard>(`dashboard:${licence}`);
    if (cached) {
      setProfile(cached.profile);
      setRecentMatches(cached.recentMatches);
      setQuickStats(cached.quickStats);
      // Don't set isLoading=false yet — still fetching fresh data
      // But if offline, we'll stop here
    }
  }

  // 2. Check connectivity
  if (!isConnected) {
    setIsLoading(false);
    return; // Use cached data only
  }

  // 3. Fetch from API (background update)
  try {
    // ... existing fetch logic ...
    // 4. On success, update cache
    await cacheSet(`dashboard:${licence}`, { profile, recentMatches, quickStats });
  } catch (err) {
    // If we have cached data, don't show error — silently use cache
    if (hasCachedData) return;
    // Otherwise show error as before
  }
}, [licence, isConnected]);
```

### Pattern 3: ConnectivityProvider Context
**What:** React context that wraps the app and provides `isConnected` boolean from NetInfo.
**When to use:** Any component or hook that needs to know online/offline status.
**Example:**
```typescript
// Source: @react-native-community/netinfo docs
import { useNetInfo } from '@react-native-community/netinfo';

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const netInfo = useNetInfo();
  // isInternetReachable can be null initially — treat as connected until proven otherwise
  const isConnected = netInfo.isConnected !== false && netInfo.isInternetReachable !== false;

  return (
    <ConnectivityContext.Provider value={{ isConnected }}>
      {children}
    </ConnectivityContext.Provider>
  );
}
```

### Pattern 4: Offline Status Bar
**What:** A small colored bar below the header that appears when offline and auto-dismisses when back online.
**When to use:** App-level layout, visible on all screens.
**Example:**
```typescript
export function OfflineBar() {
  const { isConnected } = useConnectivity();

  if (isConnected) return null;

  return (
    <View style={styles.offlineBar}>
      <Text style={styles.offlineText}>{t('offline.noConnection')}</Text>
    </View>
  );
}
// Style: orange background, small height (~28px), centered white text
```

### Anti-Patterns to Avoid
- **Caching raw API responses:** Cache the normalized/transformed data (e.g., `PlayerProfile`, not raw FFBaD JSON). The hooks already transform data — cache the result.
- **Showing stale indicators:** User explicitly decided NO "last updated" timestamps. Don't add them.
- **Blocking UI on cache reads:** AsyncStorage reads are async but fast (~5ms). Show cached data as soon as available, don't wait for network.
- **Caching search results:** User explicitly excluded search results from cache. Search should show "offline" message when disconnected.
- **Clearing bookmarks with cache:** Bookmarks use a separate `badtracker_bookmarks` key (Phase 7). Cache clear MUST NOT touch bookmarks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network detection | Custom polling / fetch-based detection | @react-native-community/netinfo `useNetInfo` | Handles wifi/cellular/none, background transitions, has event subscription, handles edge cases (captive portals via isInternetReachable) |
| Cache key management | Manual string concatenation | Prefixed utility with `CACHE_PREFIX` constant | Prevents key collisions with bookmarks/i18n keys already in AsyncStorage |
| Bulk cache clear | Manual iteration over known keys | `getAllKeys()` + filter by prefix + `multiRemove()` | Catches any orphaned keys, future-proof as new cache entries are added |

**Key insight:** The cache layer is intentionally thin. AsyncStorage is already in the project and handles the hard problems (serialization, persistence, platform differences). The cache utility just adds namespacing and JSON convenience.

## Common Pitfalls

### Pitfall 1: NetInfo Initial State is null
**What goes wrong:** `netInfo.isConnected` and `netInfo.isInternetReachable` are `null` before the first check completes. Treating `null` as `false` = app thinks it's offline on launch.
**Why it happens:** NetInfo needs a moment to query the OS for network state.
**How to avoid:** Default to "connected" when state is null: `isConnected !== false && isInternetReachable !== false`. Only show offline bar when explicitly `false`.
**Warning signs:** Offline bar flashing on app startup.

### Pitfall 2: Cache-then-fetch Race Condition
**What goes wrong:** Cache read completes, sets state, then network fetch completes and sets state again — but if fetch fails, the error handler clears the data even though we had cached data.
**Why it happens:** Error handling doesn't account for the cache-first path.
**How to avoid:** Track whether we have cached data. In catch block, only show error if NO cached data was loaded. If cached data exists, silently swallow the network error.
**Warning signs:** Data disappearing briefly or showing error screens when offline despite having cache.

### Pitfall 3: Logout Cache Clear Timing
**What goes wrong:** SignOut clears session but cache clear runs async — user could log in as different user and see previous user's cached data.
**Why it happens:** AsyncStorage operations are async, and the signOut flow may redirect to login before cache clear completes.
**How to avoid:** Clear cache as part of signOut flow (before clearing session), or clear on login (before first fetch). The cleanest approach: clear in signOut and also ignore cache if licence doesn't match current session.
**Warning signs:** Seeing another user's data after re-login with different credentials.

### Pitfall 4: AsyncStorage Size Limits
**What goes wrong:** On Android, each AsyncStorage entry is limited to ~2MB by default (SQLite row limit). Club leaderboard with ~3500 members could approach this.
**Why it happens:** AsyncStorage uses SQLite on Android with default row size limits.
**How to avoid:** For this app, the data sizes are well within limits. A single club leaderboard serialized is ~200KB max. Profile, matches, and ranking data are all under 100KB. No action needed but worth noting.
**Warning signs:** AsyncStorage.setItem silently failing on very large payloads.

### Pitfall 5: Cache Keys for Bookmarked Players
**What goes wrong:** Caching data for bookmarked players requires dynamic keys per licence. If a player is un-bookmarked, their cached data becomes orphaned.
**Why it happens:** No cleanup mechanism when bookmarks change.
**How to avoid:** On cache clear (manual or logout), clear ALL cache-prefixed keys regardless. For un-bookmark, optionally clean up that player's cache entry.
**Warning signs:** Cache growing indefinitely for users who frequently bookmark/un-bookmark.

## Code Examples

### Cache Key Schema
```typescript
// Namespaced keys to avoid collision with existing AsyncStorage usage
// Existing keys: 'badtracker_bookmarks' (Phase 7), 'badtracker_language' (i18n)
const CACHE_PREFIX = 'badtracker_cache:';

// Key patterns:
// badtracker_cache:dashboard:{licence}     — user's dashboard data
// badtracker_cache:matches:{licence}       — user's match history
// badtracker_cache:ranking:{licence}       — user's ranking evolution
// badtracker_cache:club:{clubId}           — club leaderboard
// badtracker_cache:player:{licence}        — bookmarked player profile
```

### Connectivity Context + OfflineBar
```typescript
// Source: @react-native-community/netinfo docs
import { useNetInfo } from '@react-native-community/netinfo';

interface ConnectivityContextType {
  isConnected: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextType>({ isConnected: true });

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected !== false && netInfo.isInternetReachable !== false;

  return (
    <ConnectivityContext.Provider value={{ isConnected }}>
      {children}
    </ConnectivityContext.Provider>
  );
}
```

### Hook Modification Pattern (useDashboardData example)
```typescript
export function useDashboardData(): DashboardData {
  const { isConnected } = useConnectivity();
  // ... existing state ...
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!licence) { setIsLoading(false); return; }

    if (isRefresh) { setIsRefreshing(true); } else { setIsLoading(true); }
    setError(null);

    // Step 1: Read cache (instant)
    if (!isRefresh) {
      const cached = await cacheGet<CachedDashboard>(`dashboard:${licence}`);
      if (cached) {
        applyDashboardData(cached); // set all state from cache
        setIsFromCache(true);
        if (!isConnected) { setIsLoading(false); return; } // offline: stop here
      }
    }

    // Step 2: Fetch fresh data
    try {
      // ... existing Promise.allSettled fetch ...
      // Step 3: On success, update cache
      await cacheSet(`dashboard:${licence}`, { profile, recentMatches, quickStats });
      setIsFromCache(false);
    } catch (err) {
      if (isFromCache) return; // silently use cache
      // ... existing error handling ...
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [licence, isConnected]);
  // ...
}
```

### Cache Clear in Settings
```typescript
// In Settings screen
const handleClearCache = () => {
  Alert.alert(
    t('settings.clearCacheTitle'),
    t('settings.clearCacheConfirm'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.clearCacheOk'),
        style: 'destructive',
        onPress: async () => {
          await cacheClear(); // only clears badtracker_cache:* keys
          Toast.show({ type: 'success', text1: t('settings.cacheCleared') });
        },
      },
    ]
  );
};
```

### Auto-Refresh on Connectivity Return
```typescript
// In ConnectivityProvider or a dedicated hook
const prevConnected = useRef(isConnected);

useEffect(() => {
  if (!prevConnected.current && isConnected) {
    // Just came back online — trigger refresh
    // Emit event or set a "shouldRefresh" flag that hooks observe
    onConnectivityRestored?.();
  }
  prevConnected.current = isConnected;
}, [isConnected]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NetInfo from react-native core | @react-native-community/netinfo as separate package | RN 0.60+ (2019) | Must install separately, more features |
| AsyncStorage from react-native core | @react-native-async-storage/async-storage | RN 0.60+ (2019) | Already done in this project |
| Complex offline-first libraries (WatermelonDB, Realm) | Simple AsyncStorage cache for read-heavy apps | N/A | For this app's use case (read-only FFBaD data, single user), a simple cache layer is more appropriate than a full offline DB |

**Deprecated/outdated:**
- `react-native/Libraries/Network/NetInfo`: Removed from RN core. Use `@react-native-community/netinfo`.
- Expo's `expo-network`: Only provides fetch-once API (`getNetworkStateAsync`), no subscription. NetInfo is better for real-time connectivity monitoring.

## Open Questions

1. **Bookmarked player data refresh strategy**
   - What we know: Bookmarked players' profiles should be cached. Auto-refresh on app open for user's own data.
   - What's unclear: Should bookmarked players' data be refreshed in the background on app open too, or only when visiting their profile?
   - Recommendation: Refresh bookmarked player cache when visiting their profile (already happens — profile screen fetches data). On app open, only refresh user's own data. This avoids N+1 API calls for N bookmarks on every launch.

2. **Cache size monitoring**
   - What we know: AsyncStorage is fine for this volume of data.
   - What's unclear: Whether to expose cache size to the user in Settings.
   - Recommendation: Not needed for v1. The data volume is small enough (~500KB total max) that cache size is irrelevant to users.

## Sources

### Primary (HIGH confidence)
- /react-native-netinfo/react-native-netinfo (Context7) - useNetInfo hook, addEventListener, NetInfoState types, initial null state behavior
- /react-native-async-storage/async-storage (Context7) - setItem, getItem, multiGet, multiRemove, getAllKeys, useAsyncStorage patterns
- Project source code: src/hooks/*.ts, src/bookmarks/storage.ts, src/api/client.ts — existing patterns and conventions

### Secondary (MEDIUM confidence)
- NetInfo README on GitHub — installation instructions, Expo compatibility

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - both libraries are well-documented, NetInfo verified via Context7, AsyncStorage already in project
- Architecture: HIGH - cache-first pattern is well-understood, project's hook pattern is consistent and clear
- Pitfalls: HIGH - NetInfo null state documented in Context7, race conditions are standard async programming concerns

**Research date:** 2026-02-20
**Valid until:** 30 days (stable libraries, no breaking changes expected)
