import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPlayerProfile,
  getResultsByLicence,
  type PlayerProfile,
} from '../api/ffbad';
import { NetworkError, ServerError } from '../api/errors';
import { useSession } from '../auth/context';
import { getBestRanking } from '../utils/rankings';
import { cacheGet, cacheSet } from '../cache/storage';
import { useConnectivity } from '../connectivity/context';
import {
  toFullMatchItem,
  type MatchItem,
} from '../utils/matchHistory';

// ============================================================
// Types
// ============================================================

export interface QuickStats {
  bestRanking: {
    discipline: 'simple' | 'double' | 'mixte';
    classement: string;
    cpph: number;
  } | null;
  matchCount: number;
  winRate: number; // 0-100
}

export interface DashboardData {
  profile: PlayerProfile | null;
  recentMatches: MatchItem[];
  quickStats: QuickStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  rawItems: Array<Record<string, unknown>>;
  personId: string | null;
}

// Cache shape for dashboard data
interface CachedDashboard {
  profile: PlayerProfile;
  recentMatches: MatchItem[];
  quickStats: QuickStats | null;
  allMatches: MatchItem[];
  rawItems: Array<Record<string, unknown>>;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Compute quick stats from profile rankings and match data.
 */
function computeQuickStats(
  profile: PlayerProfile,
  allMatches: MatchItem[]
): QuickStats {
  const bestRanking = getBestRanking(profile.rankings);
  const matchCount = allMatches.length;

  // Compute win rate from matches with known results
  const knownResults = allMatches.filter((m) => m.isWin !== undefined);
  const wins = knownResults.filter((m) => m.isWin === true).length;
  const winRate =
    knownResults.length > 0 ? Math.round((wins / knownResults.length) * 100) : 0;

  return { bestRanking, matchCount, winRate };
}

// ============================================================
// Hook
// ============================================================

/**
 * Orchestrates dashboard data fetching: player profile + match results in parallel.
 *
 * Cache-first pattern: reads cached data immediately, then fetches from API
 * in background if online. Falls back to cache when offline.
 */
export function useDashboardData(): DashboardData {
  const { t } = useTranslation();
  const { session } = useSession();
  const { isConnected } = useConnectivity();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchItem[]>([]);
  const [allMatches, setAllMatches] = useState<MatchItem[]>([]);
  const [rawItems, setRawItems] = useState<Array<Record<string, unknown>>>([]);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const licence = session?.licence;
  const hasCachedData = useRef(false);
  const prevConnected = useRef(isConnected);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!licence) {
        setIsLoading(false);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Step 1: Read from cache (non-blocking, instant UI)
      if (!isRefresh) {
        const cached = await cacheGet<CachedDashboard>(`dashboard:${licence}`);
        if (cached) {
          setProfile(cached.profile);
          setRecentMatches(cached.recentMatches);
          setAllMatches(cached.allMatches);
          setRawItems(cached.rawItems ?? []);
          setQuickStats(cached.quickStats);
          hasCachedData.current = true;
          // If offline, stop here — use cached data only
          if (!isConnected) {
            setIsLoading(false);
            return;
          }
        } else if (!isConnected) {
          // No cache and offline
          setError('dashboard.networkError');
          setIsLoading(false);
          return;
        }
      }

      // Step 2: Fetch from API
      try {
        const [profileResult, matchesResult] = await Promise.allSettled([
          getPlayerProfile(licence),
          getResultsByLicence(licence),
        ]);

        // Handle profile result
        let loadedProfile: PlayerProfile | null = null;
        if (profileResult.status === 'fulfilled' && profileResult.value) {
          loadedProfile = profileResult.value;
          setProfile(loadedProfile);
        } else if (profileResult.status === 'rejected') {
          // If we have cached data, don't show error
          if (hasCachedData.current) {
            setIsLoading(false);
            setIsRefreshing(false);
            return;
          }
          const err = profileResult.reason;
          if (err instanceof NetworkError) {
            setError('dashboard.networkError');
          } else {
            setError('dashboard.loadError');
          }
        }

        // Handle matches result (non-critical — partial failure OK)
        let matchItems: MatchItem[] = [];
        let rawApiItems: Array<Record<string, unknown>> = [];
        if (matchesResult.status === 'fulfilled') {
          const retour = matchesResult.value.Retour;
          if (Array.isArray(retour)) {
            matchItems = retour.map((item, index) =>
              toFullMatchItem(item as Record<string, unknown>, index)
            );
            rawApiItems = matchesResult.value._rawItems ?? [];
          }
        }

        setAllMatches(matchItems);
        setRecentMatches(matchItems.slice(0, 3));
        setRawItems(rawApiItems);

        // Compute quick stats if we have profile data
        let stats: QuickStats | null = null;
        if (loadedProfile) {
          stats = computeQuickStats(loadedProfile, matchItems);
          setQuickStats(stats);
        }

        // Step 3: Update cache on success
        if (loadedProfile) {
          cacheSet(`dashboard:${licence}`, {
            profile: loadedProfile,
            recentMatches: matchItems.slice(0, 3),
            quickStats: stats,
            allMatches: matchItems,
            rawItems: rawApiItems,
          });
          hasCachedData.current = true;
        }
      } catch (err) {
        // If we have cached data, silently use it
        if (hasCachedData.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
        if (err instanceof NetworkError) {
          setError('dashboard.networkError');
        } else if (err instanceof ServerError) {
          setError('dashboard.loadError');
        } else {
          setError('dashboard.loadError');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [licence, isConnected]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await fetchData(false);
    };

    if (!cancelled) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  // Auto-refresh when connectivity returns
  useEffect(() => {
    if (!prevConnected.current && isConnected && licence) {
      fetchData(true);
    }
    prevConnected.current = isConnected;
  }, [isConnected, licence, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    profile,
    recentMatches,
    quickStats,
    isLoading,
    isRefreshing,
    error,
    refresh,
    rawItems,
    personId: session?.personId ?? null,
  };
}
