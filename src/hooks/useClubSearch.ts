import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getClubList } from '../api/ffbad';
import type { ClubListItem } from '../api/schemas';
import { useDebounce } from './useDebounce';

// ============================================================
// Types
// ============================================================

export interface ClubSearchResult {
  id: string;
  name: string;
}

export interface ClubSearchState {
  clubs: ClubSearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => void;
}

// ============================================================
// Module-level club list cache
// ============================================================

/** In-memory cache: loaded once per app session, avoids repeated API calls */
let cachedClubList: ClubListItem[] | null = null;

const ASYNC_STORAGE_KEY = 'badtracker_club_list';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedClubData {
  timestamp: number;
  items: ClubListItem[];
}

// ============================================================
// Hook
// ============================================================

/**
 * Provides club search functionality with a cached full-list approach.
 *
 * Strategy:
 * - On first search() call, fetch the full club list via getClubList()
 * - Cache result in memory (module-level) and AsyncStorage (24h TTL)
 * - Filter client-side: match NomClub or Nom containing the query
 * - Only return results when query is 3+ characters (matches player search pattern)
 * - useDebounce (300ms) on the query to avoid excessive filtering
 *
 * The club list (~3500 entries) is fetched once and reused for all subsequent searches.
 */
export function useClubSearch(): ClubSearchState {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  const debouncedQuery = useDebounce(searchQuery, 300);

  /** Load club list from AsyncStorage cache if available and fresh */
  const loadFromCache = async (): Promise<ClubListItem[] | null> => {
    try {
      const raw = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
      if (!raw) return null;

      const parsed: CachedClubData = JSON.parse(raw);
      const age = Date.now() - parsed.timestamp;
      if (age > CACHE_TTL_MS) return null; // expired

      return parsed.items;
    } catch {
      return null;
    }
  };

  /** Save club list to AsyncStorage cache */
  const saveToCache = async (items: ClubListItem[]): Promise<void> => {
    try {
      const data: CachedClubData = { timestamp: Date.now(), items };
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Cache write failure is non-critical — continue without caching
    }
  };

  /** Fetch and cache the full club list, then trigger re-render */
  const loadClubList = async (): Promise<void> => {
    // Check in-memory cache first
    if (cachedClubList !== null) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try AsyncStorage cache before hitting the network
      const cached = await loadFromCache();
      if (cached !== null) {
        cachedClubList = cached;
        forceUpdate((n) => n + 1);
        return;
      }

      // Fetch from API
      const response = await getClubList();

      if (Array.isArray(response.Retour)) {
        cachedClubList = response.Retour;
        // Persist to AsyncStorage asynchronously (non-blocking)
        saveToCache(response.Retour);
        forceUpdate((n) => n + 1);
      } else {
        // API returned an error string
        cachedClubList = [];
        forceUpdate((n) => n + 1);
      }
    } catch {
      setError('club.loadError');
    } finally {
      setIsLoading(false);
    }
  };

  /** Called by the UI when the user types in the search input */
  const search = (query: string): void => {
    setSearchQuery(query);

    // Trigger list load on first search call
    if (cachedClubList === null) {
      loadClubList();
    }
  };

  // Ensure we kick off the load if a query is already set (edge case: re-mount)
  useEffect(() => {
    if (searchQuery.length >= 3 && cachedClubList === null) {
      loadClubList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Filter the cached club list client-side based on the debounced query */
  const clubs = useMemo((): ClubSearchResult[] => {
    if (debouncedQuery.length < 3) return [];
    if (!cachedClubList) return [];

    const lower = debouncedQuery.toLowerCase();

    return cachedClubList
      .filter((item) =>
        (item.NomClub ?? item.Nom ?? '').toLowerCase().includes(lower)
      )
      .map((item) => ({
        id: item.ID_Club ?? item.Club ?? '',
        name: item.NomClub ?? item.Nom ?? '',
      }));
    // forceUpdate trigger is intentionally omitted — cachedClubList is module-level,
    // and the forceUpdate() call in loadClubList() already re-runs this memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, isLoading]);

  return {
    clubs,
    isLoading,
    error,
    search,
  };
}
