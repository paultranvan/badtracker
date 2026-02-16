# Architecture Research

**Domain:** Mobile app consuming REST API with local caching
**Researched:** 2026-02-16
**Confidence:** HIGH

## Standard Architecture

React Native apps that consume external REST APIs with local caching follow a layered architecture that separates UI, data fetching, state management, and persistence. The 2026 React Native ecosystem has converged on clear patterns that decouple UI from data access and embrace hybrid storage strategies combining local persistence with cloud APIs.

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer (Screens)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Dashboard │  │ Search   │  │ Profile  │  │Bookmarks │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴─────────────┴─────────────┘           │
│                         │                                    │
├─────────────────────────┼────────────────────────────────────┤
│             Component Layer (Reusable UI)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Charts  │  │  Cards   │  │  Lists   │  │ Buttons  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴─────────────┴─────────────┘           │
│                         │                                    │
├─────────────────────────┼────────────────────────────────────┤
│              Data Layer (Hooks/State Management)             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         TanStack Query (Server State)               │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │useQuery()│  │useMutation│  │QueryClient/Cache │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │      Zustand/Context (Client State)                 │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │Auth Store│  │UI State  │  │Bookmarks Store   │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │                                    │
├─────────────────────────┼────────────────────────────────────┤
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API Client  │  │ Auth Service │  │Cache Manager │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
├─────────┼─────────────────┼─────────────────┼───────────────┤
│    Persistence Layer      │                 │               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AsyncStorage │  │  TQ Persist  │  │expo-secure-  │      │
│  │ (settings)   │  │  (queries)   │  │store (token) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
              External REST API (FFBaD)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Screens** | Page-level UI composition, route handling | Feature-specific folders in `/src/screens/` or `/src/app/` (Expo Router) |
| **Components** | Reusable UI elements (buttons, cards, charts) | Shared components in `/src/components/`, isolated from business logic |
| **Data Hooks** | Encapsulate data fetching and mutations | Custom hooks wrapping TanStack Query (`usePlayerData`, `useRankings`) |
| **API Client** | Raw HTTP communication, request configuration | Abstracted Axios/Fetch service with base URL, headers, interceptors |
| **Auth Service** | Token management, authentication flow | Handles login/logout, token refresh, credential storage |
| **State Stores** | Client-side state (bookmarks, UI preferences) | Zustand stores or React Context for non-server state |
| **Cache Manager** | Query cache persistence and invalidation | TanStack Query persistence plugin + AsyncStorage |
| **Navigation** | Screen transitions and routing | React Navigation (stack, tabs, drawer) or Expo Router (file-based) |

## Recommended Project Structure

```
badtracker/
├── src/
│   ├── app/                    # Expo Router file-based routing
│   │   ├── (auth)/            # Auth flow screens (grouped route)
│   │   │   └── login.tsx
│   │   ├── (tabs)/            # Main app tabs (grouped route)
│   │   │   ├── _layout.tsx    # Tab navigator
│   │   │   ├── index.tsx      # Dashboard screen
│   │   │   ├── search.tsx     # Search screen
│   │   │   └── profile.tsx    # Profile screen
│   │   └── _layout.tsx        # Root layout
│   │
│   ├── components/            # Reusable UI components
│   │   ├── charts/           # Chart components
│   │   │   ├── RankingChart.tsx
│   │   │   └── MatchHistoryChart.tsx
│   │   ├── cards/            # Card layouts
│   │   │   ├── PlayerCard.tsx
│   │   │   └── MatchCard.tsx
│   │   ├── ui/               # Base UI elements
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── index.ts          # Barrel exports
│   │
│   ├── features/              # Feature-based modules (optional alternative)
│   │   ├── player-search/
│   │   │   ├── components/   # Feature-specific components
│   │   │   ├── hooks/        # Feature-specific hooks
│   │   │   └── screens/      # Feature screens
│   │   └── rankings/
│   │
│   ├── hooks/                 # Reusable custom hooks
│   │   ├── usePlayerData.ts  # TQ hook for player data
│   │   ├── useRankings.ts    # TQ hook for rankings
│   │   ├── useAuth.ts        # Auth state hook
│   │   └── useNetworkStatus.ts
│   │
│   ├── services/              # Business logic layer
│   │   ├── api/
│   │   │   ├── client.ts     # Axios/Fetch wrapper with config
│   │   │   ├── endpoints.ts  # API endpoint definitions
│   │   │   ├── player.api.ts # Player-related API calls
│   │   │   ├── ranking.api.ts
│   │   │   └── auth.api.ts
│   │   ├── storage/
│   │   │   ├── secure-storage.ts  # expo-secure-store wrapper
│   │   │   └── async-storage.ts   # AsyncStorage wrapper
│   │   └── cache/
│   │       └── query-persist.ts   # TanStack Query persistence config
│   │
│   ├── stores/                # Client state management
│   │   ├── authStore.ts      # Zustand store for auth state
│   │   ├── bookmarksStore.ts # Zustand store for bookmarked players
│   │   └── uiStore.ts        # Zustand store for UI preferences
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── api.types.ts      # API response types
│   │   ├── player.types.ts
│   │   └── ranking.types.ts
│   │
│   ├── utils/                 # Pure utility functions
│   │   ├── formatters.ts     # Date, number formatting
│   │   ├── validators.ts     # Input validation
│   │   └── constants.ts      # App constants
│   │
│   └── config/                # Configuration files
│       ├── query-client.ts   # TanStack Query setup
│       └── theme.ts          # UI theme configuration
│
├── assets/                    # Static assets (images, fonts)
├── app.json                   # Expo configuration
└── package.json
```

### Structure Rationale

- **`/src/app/`:** Expo Router's file-based routing system. Each file becomes a route automatically. Grouped routes like `(auth)` and `(tabs)` organize screens without affecting URL structure. Scales better than manual React Navigation configuration.

- **`/src/components/`:** Shared, reusable UI organized by type (charts, cards, ui). Completely decoupled from business logic or data fetching. Easy to test in isolation and use across features.

- **`/src/features/` (optional):** Alternative to flat structure for large apps. Each feature contains its own components, hooks, and screens. Prevents importing code between features (use `/src/components/` for shared UI). Better for multi-team development.

- **`/src/hooks/`:** Custom React hooks that encapsulate data fetching (TanStack Query) and business logic. Components consume hooks, never call API services directly. Makes components easier to test (mock hooks instead of API).

- **`/src/services/`:** Abstraction layer for external dependencies (API, storage). Provides clean interfaces that can be mocked for testing. Changes to API client (e.g., Axios → Fetch) don't affect rest of app.

- **`/src/stores/`:** Zustand stores for client-side state (not server data). Server state managed by TanStack Query. Keeps state management focused and performant.

- **`/src/types/`:** Centralized TypeScript definitions. API types derived from actual API responses. Shared across components, hooks, and services for type safety.

## Architectural Patterns

### Pattern 1: TanStack Query for Server State

**What:** TanStack Query (React Query) manages all server-side data with automatic caching, background refetching, and optimistic updates. It handles the complete lifecycle of fetching, caching, synchronizing, and updating server state.

**When to use:** For ALL data from external APIs (player data, rankings, matches, tournaments). Default pattern for any GET/POST/PUT/DELETE to FFBaD API.

**Trade-offs:**
- **Pros:** Automatic cache invalidation, background refetching, request deduplication, offline support via persistence, eliminates 80% of typical Redux boilerplate
- **Cons:** Learning curve for developers unfamiliar with declarative data fetching, requires understanding query keys and cache invalidation strategies

**Example:**
```typescript
// hooks/usePlayerData.ts
import { useQuery } from '@tanstack/react-query';
import { playerApi } from '@/services/api/player.api';

export function usePlayerData(licenseNumber: string) {
  return useQuery({
    queryKey: ['player', licenseNumber],
    queryFn: () => playerApi.getPlayer(licenseNumber),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,    // 30 minutes (formerly cacheTime)
    enabled: !!licenseNumber,   // Only fetch if license number exists
  });
}

// Screen usage
function PlayerScreen() {
  const { data: player, isLoading, error } = usePlayerData(licenseNumber);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorView error={error} />;

  return <PlayerProfile player={player} />;
}
```

### Pattern 2: Query Key Factory for Cache Organization

**What:** Centralized query key management using a factory pattern. Query keys determine cache entries and invalidation boundaries. Factory ensures consistency across the app.

**When to use:** Always. Required for scalable TanStack Query implementation. Prevents key mismatches that break cache invalidation.

**Trade-offs:**
- **Pros:** Single source of truth for keys, easier invalidation, prevents typos, self-documenting
- **Cons:** One more abstraction layer

**Example:**
```typescript
// services/api/query-keys.ts
export const queryKeys = {
  player: {
    all: ['players'] as const,
    detail: (licenseNumber: string) =>
      [...queryKeys.player.all, licenseNumber] as const,
    rankings: (licenseNumber: string, discipline: string) =>
      [...queryKeys.player.detail(licenseNumber), 'rankings', discipline] as const,
    matches: (licenseNumber: string) =>
      [...queryKeys.player.detail(licenseNumber), 'matches'] as const,
  },
  search: {
    all: ['search'] as const,
    players: (query: string) =>
      [...queryKeys.search.all, 'players', query] as const,
  },
};

// Usage in hook
export function usePlayerRankings(licenseNumber: string, discipline: string) {
  return useQuery({
    queryKey: queryKeys.player.rankings(licenseNumber, discipline),
    queryFn: () => rankingApi.getRankings(licenseNumber, discipline),
  });
}

// Invalidate all player data
queryClient.invalidateQueries({ queryKey: queryKeys.player.all });

// Invalidate specific player
queryClient.invalidateQueries({
  queryKey: queryKeys.player.detail(licenseNumber)
});
```

### Pattern 3: API Client with Interceptors

**What:** Centralized API client (Axios or Fetch wrapper) with request/response interceptors for authentication, error handling, and logging. Single configuration point for base URL, headers, timeouts.

**When to use:** Always. Required for consistent API communication and auth token injection.

**Trade-offs:**
- **Pros:** DRY (Don't Repeat Yourself), centralized auth logic, easy to add retry logic or logging
- **Cons:** Abstraction can make debugging harder if not logged properly

**Example:**
```typescript
// services/api/client.ts
import axios from 'axios';
import { getAuthToken, clearAuth } from '@/stores/authStore';
import { router } from 'expo-router';

const apiClient = axios.create({
  baseURL: 'https://api.ffbad.org',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear auth and redirect
      await clearAuth();
      router.replace('/login');
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// services/api/player.api.ts
import apiClient from './client';
import type { Player } from '@/types/player.types';

export const playerApi = {
  getPlayer: async (licenseNumber: string): Promise<Player> => {
    const { data } = await apiClient.get(`/players/${licenseNumber}`);
    return data;
  },

  searchPlayers: async (query: string): Promise<Player[]> => {
    const { data } = await apiClient.get('/players/search', {
      params: { q: query },
    });
    return data;
  },
};
```

### Pattern 4: Zustand for Client State

**What:** Lightweight state management for client-side state (bookmarks, UI preferences, non-server data). Simpler API than Redux, no boilerplate, works outside React components.

**When to use:** For client state that doesn't come from the server. NOT for API data (use TanStack Query). Examples: bookmarked players, theme preference, onboarding completion.

**Trade-offs:**
- **Pros:** Minimal boilerplate, easy to learn, can access outside React, no Context provider needed
- **Cons:** No built-in DevTools (though middleware exists), less structure than Redux (can be pro or con)

**Example:**
```typescript
// stores/bookmarksStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BookmarksStore {
  bookmarkedPlayers: string[]; // license numbers
  addBookmark: (licenseNumber: string) => void;
  removeBookmark: (licenseNumber: string) => void;
  isBookmarked: (licenseNumber: string) => boolean;
}

export const useBookmarksStore = create<BookmarksStore>()(
  persist(
    (set, get) => ({
      bookmarkedPlayers: [],

      addBookmark: (licenseNumber) =>
        set((state) => ({
          bookmarkedPlayers: [...state.bookmarkedPlayers, licenseNumber],
        })),

      removeBookmark: (licenseNumber) =>
        set((state) => ({
          bookmarkedPlayers: state.bookmarkedPlayers.filter(
            (id) => id !== licenseNumber
          ),
        })),

      isBookmarked: (licenseNumber) =>
        get().bookmarkedPlayers.includes(licenseNumber),
    }),
    {
      name: 'bookmarks-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Usage in component
function PlayerCard({ player }) {
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarksStore();
  const bookmarked = isBookmarked(player.licenseNumber);

  return (
    <View>
      <Text>{player.name}</Text>
      <Button
        onPress={() =>
          bookmarked
            ? removeBookmark(player.licenseNumber)
            : addBookmark(player.licenseNumber)
        }
      >
        {bookmarked ? 'Remove' : 'Bookmark'}
      </Button>
    </View>
  );
}
```

### Pattern 5: Offline-First with Query Persistence

**What:** Persist TanStack Query cache to AsyncStorage so data survives app restarts. Users see cached data immediately on app launch, then background refresh updates stale data.

**When to use:** For apps needing offline support or instant perceived performance. Critical for mobile apps where connectivity varies.

**Trade-offs:**
- **Pros:** Instant app startup with cached data, works fully offline, better UX on slow connections
- **Cons:** Adds storage overhead, requires cache invalidation strategy, can show stale data (mitigated with background refetch)

**Example:**
```typescript
// config/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (garbage collection time)
      staleTime: 1000 * 60 * 5,     // 5 minutes (consider data stale after)
      retry: 2,
      refetchOnMount: 'always',     // Refetch on mount if data is stale
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',  // Use cache even offline
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'TANSTACK_QUERY_CACHE',
  throttleTime: 1000, // Save to AsyncStorage at most once per second
});

// App.tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <YourApp />
    </PersistQueryClientProvider>
  );
}
```

### Pattern 6: Network-Aware Refetching

**What:** Monitor network status and adjust query behavior. Pause queries when offline, resume when online, show connectivity status to user.

**When to use:** For apps consuming external APIs where offline mode is expected. Prevents unnecessary error states when offline.

**Trade-offs:**
- **Pros:** Better UX (no error spam when offline), battery savings (no failed requests)
- **Cons:** Need to handle edge cases (slow connections, intermittent connectivity)

**Example:**
```typescript
// hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Sync TanStack Query's online manager with actual network status
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online);
      onlineManager.setOnline(online);
    });

    return () => unsubscribe();
  }, []);

  return { isOnline };
}

// App root
function AppRoot() {
  useNetworkStatus(); // Initialize network monitoring
  return <YourApp />;
}

// Show offline banner
function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={styles.offlineBanner}>
      <Text>You are offline. Showing cached data.</Text>
    </View>
  );
}
```

## Data Flow

### Request Flow (Online)

```
[User Action: Search Player]
    ↓
[SearchScreen] → calls usePlayerSearch(query) hook
    ↓
[TanStack Query] → checks cache with key ['search', 'players', query]
    ↓ (cache miss or stale)
[Query Function] → calls playerApi.searchPlayers(query)
    ↓
[API Client] → adds auth headers via interceptor
    ↓
[HTTP Request] → GET https://api.ffbad.org/players/search?q=query
    ↓
[API Response] → returns player array
    ↓
[TanStack Query] → caches result, notifies observers
    ↓
[SearchScreen] → re-renders with data
    ↓
[AsyncStorage] → persists cache in background (throttled)
```

### Request Flow (Offline)

```
[User Action: View Player Profile]
    ↓
[ProfileScreen] → calls usePlayerData(licenseNumber) hook
    ↓
[TanStack Query] → checks cache with key ['player', licenseNumber]
    ↓ (cache hit)
[TanStack Query] → returns cached data immediately
    ↓
[ProfileScreen] → renders with cached data
    ↓
[TanStack Query] → detects offline (via onlineManager)
    ↓
[Query Paused] → waits for connectivity to refetch
    ↓ (user goes back online)
[Network Detected] → automatic refetch triggered
    ↓
[API Request] → fetches fresh data
    ↓
[TanStack Query] → updates cache and UI
```

### Authentication Flow

```
[Login Screen] → user enters license number + password
    ↓
[useAuth hook] → calls authApi.login(credentials)
    ↓
[API Client] → POST /auth/login
    ↓
[API Response] → returns { token, user }
    ↓
[Auth Store] → saves user info to Zustand
    ↓
[expo-secure-store] → saves token securely
    ↓
[Navigation] → router.replace('/dashboard')
    ↓
[Subsequent Requests] → API client interceptor adds token
```

### State Management Split

```
Server State (TanStack Query)          Client State (Zustand/Context)
├── Player data                        ├── Auth status
├── Rankings                           ├── Bookmarked players
├── Match history                      ├── Theme preference
├── Tournament data                    ├── Onboarding completion
└── Search results                     └── UI state (modals, tabs)

         ↓                                      ↓
    AsyncStorage                          AsyncStorage
  (Query Persist)                    (Zustand Persist)
```

### Key Data Flows

1. **Cold Start (First Launch):** App loads → TanStack Query initializes → AsyncStorage checked for persisted cache → No cache found → Show loading state → Fetch data from API → Cache and persist → Render UI

2. **Warm Start (Subsequent Launch):** App loads → TanStack Query initializes → AsyncStorage returns persisted cache → Render UI immediately with cached data → Background refetch checks for updates → If stale, refetch and update UI seamlessly

3. **Mutation Flow (Bookmark Player):** User taps bookmark → Zustand store updated → AsyncStorage persisted → UI re-renders immediately → No API call needed (client-only state)

4. **Optimistic Update (Future Enhancement):** User action → TanStack Query updates cache optimistically → UI reflects change immediately → API mutation sent → On success, confirm cache → On error, rollback cache and show error

## Anti-Patterns

### Anti-Pattern 1: Mixing Server and Client State in Redux

**What people do:** Use Redux for both API data and client state. Manual actions/reducers for every API call. Loading/error state for each endpoint tracked manually.

**Why it's wrong:** Massive boilerplate (action types, action creators, reducers for every API). Manual cache invalidation logic prone to bugs. No automatic refetching, deduplication, or garbage collection. Forces synchronous worldview on asynchronous data.

**Do this instead:** TanStack Query for ALL server data (automatic caching, refetching, optimistic updates). Zustand or Context for lightweight client state (bookmarks, preferences). Reduce Redux to complex shared client state only (or eliminate entirely).

### Anti-Pattern 2: API Calls Directly in Components

**What people do:** Components import API client and call endpoints directly in useEffect. No abstraction layer between UI and data fetching.

```typescript
// BAD
function PlayerScreen({ licenseNumber }) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.ffbad.org/players/${licenseNumber}`)
      .then(res => res.json())
      .then(setPlayer)
      .finally(() => setLoading(false));
  }, [licenseNumber]);

  return loading ? <Loading /> : <PlayerView player={player} />;
}
```

**Why it's wrong:** Duplicates fetching logic across components. No caching (same data fetched multiple times). Manual loading/error state management. Hard to test (must mock fetch). Race conditions (component unmounts before fetch completes).

**Do this instead:** Custom hooks wrapping TanStack Query. Components consume hooks, never call APIs directly.

```typescript
// GOOD
function usePlayerData(licenseNumber: string) {
  return useQuery({
    queryKey: ['player', licenseNumber],
    queryFn: () => playerApi.getPlayer(licenseNumber),
  });
}

function PlayerScreen({ licenseNumber }) {
  const { data: player, isLoading } = usePlayerData(licenseNumber);
  return isLoading ? <Loading /> : <PlayerView player={player} />;
}
```

### Anti-Pattern 3: Over-Optimizing with Complex Local Databases

**What people do:** Immediately reach for SQLite, Realm, or WatermelonDB for local storage even with simple data requirements. Normalize data manually, write complex queries, manage migrations.

**Why it's wrong:** Over-engineering for simple use cases. TanStack Query persistence + AsyncStorage handles most needs. SQLite/Realm add bundle size, migration complexity, platform-specific bugs. Premature optimization before proving need.

**Do this instead:** Start with TanStack Query persistence (automatically handles cache). Use AsyncStorage for simple key-value data (bookmarks, preferences, small datasets). Only add SQLite/Realm if you need: complex relational queries, massive datasets (1000s+ records locally), offline-first CRUD with conflict resolution. For BadTracker's use case (fetching API data, caching responses), TanStack Query + AsyncStorage is sufficient.

### Anti-Pattern 4: Not Handling Network State Changes

**What people do:** Ignore network connectivity changes. Show error states when offline. Retry requests infinitely when there's no connection.

**Why it's wrong:** Poor UX (user sees errors they can't fix). Battery drain (failed requests continue). Confusing (user doesn't understand why data isn't loading).

**Do this instead:** Monitor network status with NetInfo. Sync with TanStack Query's onlineManager. Show offline banner/indicator. Pause queries when offline. Auto-resume when online. Use cached data gracefully.

### Anti-Pattern 5: Storing Sensitive Data in AsyncStorage

**What people do:** Store auth tokens, passwords, or sensitive user data in AsyncStorage.

**Why it's wrong:** AsyncStorage is unencrypted. On rooted/jailbroken devices, data is easily accessible. Security risk for authentication tokens.

**Do this instead:** Use expo-secure-store or react-native-keychain for sensitive data (tokens, credentials). AsyncStorage only for non-sensitive data (preferences, bookmarks, cached public data).

```typescript
// BAD
await AsyncStorage.setItem('authToken', token);

// GOOD
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('authToken', token);
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **FFBaD REST API** | Axios client with interceptors, abstracted behind service layer | 70+ endpoints. Base URL: `https://api.ffbad.org`. Auth via Bearer token. Weekly ranking updates (cache invalidation on Mondays). |
| **Expo Router** | File-based routing in `/src/app/` | Typed routes with `href` prop. Grouped routes for auth/tabs. Layout files for shared UI (tab bar). |
| **TanStack Query** | QueryClientProvider wrapping app root, persisted to AsyncStorage | Centralized queryClient config. Query key factories. Optimistic updates for mutations (future). |
| **NetInfo** | Network status monitoring, synced with TanStack Query online manager | Detects offline/online transitions. Pauses queries when offline. Shows user-facing connectivity indicator. |
| **expo-secure-store** | Secure storage for auth token | iOS: Keychain. Android: EncryptedSharedPreferences. Max 2KB per item. |
| **AsyncStorage** | Non-sensitive persistent storage (query cache, bookmarks, preferences) | 6MB total limit, 2MB per item. Serialize objects to JSON. Throttle writes to avoid performance issues. |
| **Chart Library** | Victory Native or react-native-gifted-charts | Ranking progression over time. Match win/loss charts. Expo-compatible. Performant with Skia rendering (Victory Native XL). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Screens ↔ Hooks** | React hooks (usePlayerData, useAuth, etc.) | Screens never call services directly. Hooks encapsulate data fetching and business logic. |
| **Hooks ↔ Services** | Function calls (playerApi.getPlayer()) | Hooks call API services, manage loading/error state via TanStack Query. |
| **Services ↔ API** | HTTP requests via Axios client | Centralized client with interceptors. All requests go through single client for consistency. |
| **Stores ↔ Components** | Zustand hooks (useBookmarksStore()) | Direct subscription. No provider needed (unlike Context). Can access outside React (e.g., in interceptors). |
| **TanStack Query ↔ AsyncStorage** | Persistence plugin (async write throttling) | Automatic background sync. Query cache serialized to AsyncStorage. Max write once per second to avoid performance hit. |
| **Components ↔ Navigation** | Expo Router hooks (useRouter, useLocalSearchParams) | Type-safe navigation. Screen params passed via URL search params. |

## Build Order Recommendations

Based on architectural dependencies, recommended implementation order for roadmap phases:

### Phase 1: Foundation
1. **Project setup:** Expo + TypeScript + folder structure
2. **API client:** Axios with interceptors, base configuration
3. **TanStack Query setup:** QueryClient, provider, basic config (no persistence yet)
4. **Navigation:** Expo Router structure (auth + tabs layout)
5. **Basic API service:** One endpoint (e.g., player search) to validate pattern

**Rationale:** Establishes core architecture. All future features build on these foundations. Cannot proceed without data fetching and navigation.

### Phase 2: Authentication
1. **Auth service:** Login/logout API calls
2. **Secure storage:** expo-secure-store for token
3. **Auth store:** Zustand store for auth state
4. **Auth interceptor:** Add token to requests
5. **Protected routes:** Auth guard in Expo Router layout

**Rationale:** Required before accessing most API endpoints. Blocks all features needing authenticated requests.

### Phase 3: Core Features (Parallel Development Possible)
1. **Dashboard screen:** Player info, basic stats
2. **Search functionality:** Player search with TanStack Query
3. **Ranking display:** Fetch and display rankings
4. **Match history:** List view of match results

**Rationale:** Can be built in parallel once foundation is complete. No dependencies between features.

### Phase 4: Enhanced UX
1. **Chart integration:** Victory Native for ranking progression
2. **Offline support:** TanStack Query persistence + AsyncStorage
3. **Network monitoring:** NetInfo integration, offline banner
4. **Bookmarks:** Zustand store with persistence

**Rationale:** Builds on working features. Charts require data from Phase 3. Offline support is enhancement, not blocker.

### Phase 5: Polish
1. **Error boundaries:** Graceful error handling
2. **Loading states:** Skeletons, spinners
3. **Optimistic updates:** For bookmarks, future mutations
4. **Performance optimization:** Memoization, lazy loading

**Rationale:** Refinements after core functionality works. User-facing polish that improves but doesn't block usage.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **MVP (100 users)** | Current architecture sufficient. TanStack Query + AsyncStorage handles all caching needs. No backend needed. Expo Router for navigation. Single Zustand store for client state. |
| **Growth (1K-10K users)** | Monitor API rate limits from FFBaD. Add request throttling if needed. Consider pagination for large result sets (match history). Evaluate chart performance with large datasets (100+ matches). May need virtualization for long lists (FlashList). |
| **Scale (10K+ users)** | Unlikely to reach given niche domain (French badminton players). If reached: Add backend for push notifications (match results, ranking changes). Implement background sync for rankings (weekly updates). Consider analytics (crash reporting, performance monitoring). Caching remains client-side (no need for server-side cache). |

### Scaling Priorities

1. **First bottleneck:** Large list rendering (search results, match history). **Fix:** Replace FlatList with FlashList for virtualization. Implement pagination in TanStack Query infinite queries.

2. **Second bottleneck:** Chart rendering with large datasets (years of ranking history). **Fix:** Limit data points rendered (e.g., last 52 weeks only). Use Victory Native XL (Skia-based) for better performance. Lazy load chart data (don't fetch on initial screen load).

3. **Third bottleneck:** AsyncStorage size limits (6MB total). **Fix:** Implement cache eviction strategy (remove oldest queries first). Reduce gcTime for less critical data. Compress cached data (though adds CPU overhead).

## Sources

**Architecture & Patterns:**
- [React Native Offline First App Development](https://relevant.software/blog/react-native-offline-first/)
- [Implementing Offline-First Architecture with Local Databases in React Native](https://www.innovationm.com/blog/react-native-offline-first-architecture-sqlite-local-database-guide/)
- [Local-first architecture with Expo](https://docs.expo.dev/guides/local-first/)
- [How to Structure Large-Scale React Native Applications](https://oneuptime.com/blog/post/2026-01-15-structure-react-native-applications/view)
- [React Native App Architecture Patterns: Complete Guide](https://reactnativeexample.com/react-native-app-architecture-patterns-complete-guide-2025/)

**State Management & Data Fetching:**
- [TanStack Query Overview](https://tanstack.com/query/latest/docs/framework/react/overview)
- [State Management Nx React Native/Expo Apps with TanStack Query and Redux](https://nx.dev/blog/state-management-nx-react-native-expo-apps-with-tanstack-query-and-redux)
- [How to Use React Query (TanStack Query) for Server State in React Native](https://oneuptime.com/blog/post/2026-01-15-react-native-tanstack-query/view)
- [React State Management in 2025: What You Actually Need](https://www.developerway.com/posts/react-state-management-2025)

**React Native Best Practices:**
- [React Native's New Architecture - Expo Documentation](https://docs.expo.dev/guides/new-architecture/)
- [25 React Native Best Practices for High Performance Apps 2026](https://www.esparkinfo.com/blog/react-native-best-practices)
- [How to organize Expo app folder structure for clarity and scalability](https://expo.dev/blog/expo-app-folder-structure-best-practices)
- [React Native Networking](https://reactnative.dev/docs/network)

**Storage & Persistence:**
- [How to Persist State with AsyncStorage and MMKV in React Native](https://oneuptime.com/blog/post/2026-01-15-react-native-asyncstorage-mmkv/view)
- [Best Practices of using Offline Storage in React Native Projects](https://medium.com/@tusharkumar27864/best-practices-of-using-offline-storage-asyncstorage-sqlite-in-react-native-projects-dae939e28570)

**Navigation & Routing:**
- [Navigation in Expo and React Native apps](https://docs.expo.dev/develop/app-navigation/)
- [Architecting Seamless Navigation for React Native Apps](https://www.techaheadcorp.com/blog/architecting-seamless-navigation-for-react-native-apps-patterns-libraries-best-practices/)

**Charts & Visualization:**
- [My Top 10 React Native Chart Libraries Heading Into 2026](https://blog.stackademic.com/my-top-10-react-native-chart-libraries-heading-into-2026-46e115e3be38)
- [The top 10 React Native charts libraries for 2025](https://blog.logrocket.com/top-react-native-chart-libraries/)

**API Architecture:**
- [Learn Clean Code Architecture for React Native Projects](https://medium.com/@tusharkumar27864/learn-clean-code-architecture-for-react-native-projects-c0d2dd720dfe)
- [Separate API Layers In React Apps](https://profy.dev/article/react-architecture-api-layer)

**Project Structure:**
- [4 folder structures to organize your React & React Native project](https://reboot.studio/blog/folder-structures-to-organize-react-project)
- [React Native folder structure](https://medium.com/@nitishprasad/react-native-folder-structure-e9ceab3150f3)

---
*Architecture research for: BadTracker - React Native mobile app consuming FFBaD REST API*
*Researched: 2026-02-16*
*Confidence: HIGH (verified with official docs, multiple authoritative sources, current 2026 patterns)*
