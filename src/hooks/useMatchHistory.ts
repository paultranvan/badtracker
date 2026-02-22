import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getResultsByLicence, getMatchDetailsForBrackets } from '../api/ffbad';
import { NetworkError, ServerError } from '../api/errors';
import { useSession } from '../auth/context';
import { cacheGet, cacheSet, cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';
import { useConnectivity } from '../connectivity/context';
import {
  toFullMatchItem,
  groupByTournamentNested,
  filterByDiscipline,
  filterBySeason,
  computeWinLossStats,
  getAvailableSeasons,
  getDisciplineCounts,
  getCurrentSeason,
  type MatchItem,
  type TournamentSection,
  type DisciplineGroup,
  type WinLossStats,
  type DisciplineFilter,
} from '../utils/matchHistory';

// ============================================================
// Constants
// ============================================================

const RESULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DETAIL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================
// Types
// ============================================================

export interface MatchHistoryData {
  tournaments: TournamentSection[];
  allMatches: MatchItem[];
  stats: WinLossStats;
  disciplineCounts: Record<DisciplineFilter, number>;
  availableSeasons: string[];
  activeDiscipline: DisciplineFilter;
  activeSeason: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  /** Map of "tournament-discipline" → MatchItem[] for lazily loaded details */
  detailCache: Map<string, MatchItem[]>;
  /** Set of keys currently being loaded */
  loadingDetails: Set<string>;
  setDiscipline: (d: DisciplineFilter) => void;
  setSeason: (s: string | null) => void;
  refresh: () => Promise<void>;
  loadDetails: (tournamentTitle: string, discipline: DisciplineGroup) => Promise<MatchItem[]>;
}

// Re-export types for convenience
export type { MatchItem, TournamentSection, DisciplineGroup, WinLossStats, DisciplineFilter };

// ============================================================
// Hook
// ============================================================

/**
 * Orchestrates match history data fetching, filtering, grouping, and stats.
 *
 * Two-level caching: result list (5 min TTL), match details (24h TTL).
 * Details are loaded lazily when a discipline group is expanded.
 */
export function useMatchHistory(): MatchHistoryData {
  const { session } = useSession();
  const { isConnected } = useConnectivity();

  // Core state
  const [allMatches, setAllMatches] = useState<MatchItem[]>([]);
  // Store raw API result items for lazy detail loading
  const rawResultItems = useRef<Array<Record<string, unknown>>>([]);
  const [activeDiscipline, setActiveDiscipline] =
    useState<DisciplineFilter>('all');
  const [activeSeason, setActiveSeason] = useState<string | null>(getCurrentSeason());

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail loading state
  const [detailCache, setDetailCache] = useState<Map<string, MatchItem[]>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  const licence = session?.licence;
  const personId = session?.personId;
  const hasCachedData = useRef(false);
  const prevConnected = useRef(isConnected);

  // ----------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------

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

      // Step 1: Read from cache (with TTL)
      if (!isRefresh) {
        const cached = await cacheGetWithTTL<MatchItem[]>(`matches:${licence}`, RESULT_CACHE_TTL);
        if (cached) {
          setAllMatches(cached);
          // Restore raw items for lazy detail loading
          const cachedRaw = await cacheGetWithTTL<Array<Record<string, unknown>>>(`matches-raw:${licence}`, RESULT_CACHE_TTL);
          if (cachedRaw) rawResultItems.current = cachedRaw;
          hasCachedData.current = true;
          if (!isConnected) {
            setIsLoading(false);
            return;
          }
        } else if (!isConnected) {
          // Try non-TTL cache as fallback when offline
          const stale = await cacheGet<MatchItem[]>(`matches:${licence}`);
          if (stale) {
            setAllMatches(stale);
            hasCachedData.current = true;
            setIsLoading(false);
            return;
          }
          setError('matchHistory.networkError');
          setIsLoading(false);
          return;
        }
      }

      // Step 2: Fetch from API (no detail enrichment — just result list)
      try {
        const response = await getResultsByLicence(licence);
        const retour = response.Retour;

        if (Array.isArray(retour)) {
          const matches = retour.map((item, index) =>
            toFullMatchItem(item as Record<string, unknown>, index)
          );
          setAllMatches(matches);
          // Store raw API items for lazy detail loading
          rawResultItems.current = response._rawItems ?? [];
          // Update cache with TTL
          cacheSetWithTTL(`matches:${licence}`, matches);
          // Also cache raw items for detail loading after cache restore
          if (response._rawItems) {
            cacheSetWithTTL(`matches-raw:${licence}`, response._rawItems);
          }
          hasCachedData.current = true;
        } else {
          setAllMatches([]);
        }
      } catch (err) {
        if (hasCachedData.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
        if (err instanceof NetworkError) {
          setError('matchHistory.networkError');
        } else if (err instanceof ServerError) {
          setError('matchHistory.loadError');
        } else {
          setError('matchHistory.loadError');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [licence, isConnected]
  );

  // Initial load
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

  // ----------------------------------------------------------
  // Derived state (memoized)
  // ----------------------------------------------------------

  // Season-filtered matches (used for discipline counts and grouping)
  const seasonFilteredMatches = useMemo(() => {
    if (activeSeason) {
      return filterBySeason(allMatches, activeSeason);
    }
    return allMatches;
  }, [allMatches, activeSeason]);

  // Discipline + season filtered matches for stats
  const filteredMatches = useMemo(() => {
    return filterByDiscipline(seasonFilteredMatches, activeDiscipline);
  }, [seasonFilteredMatches, activeDiscipline]);

  const tournaments = useMemo(
    () => groupByTournamentNested(filteredMatches),
    [filteredMatches]
  );

  const stats = useMemo(
    () => computeWinLossStats(filteredMatches),
    [filteredMatches]
  );

  // Counts from season-filtered matches (so they update with season)
  const disciplineCounts = useMemo(
    () => getDisciplineCounts(seasonFilteredMatches),
    [seasonFilteredMatches]
  );

  const availableSeasons = useMemo(
    () => getAvailableSeasons(allMatches),
    [allMatches]
  );

  // ----------------------------------------------------------
  // Lazy detail loading
  // ----------------------------------------------------------

  const loadDetails = useCallback(
    async (tournamentTitle: string, discipline: DisciplineGroup): Promise<MatchItem[]> => {
      const detailKey = `${tournamentTitle}:${discipline.discipline}`;

      // Check in-memory cache first
      const cached = detailCache.get(detailKey);
      if (cached) return cached;

      if (!personId) return discipline.matches;

      // Check persistent cache
      const persistKey = `detail:${personId}:${detailKey}`;
      const persisted = await cacheGetWithTTL<MatchItem[]>(persistKey, DETAIL_CACHE_TTL);
      if (persisted) {
        setDetailCache((prev) => new Map(prev).set(detailKey, persisted));
        return persisted;
      }

      // Find matching raw items for this tournament+discipline
      const rawItems = rawResultItems.current.filter((item) => {
        const name = item.name as string | undefined;
        const disc = item.discipline as string | undefined;
        if (!name || !disc) return false;
        const matchName = name === tournamentTitle || (tournamentTitle === '' && name === 'unknown');
        const discCode = disc.toUpperCase();
        const targetDisc = discipline.discipline;
        const matchDisc =
          (targetDisc === 'simple' && discCode.includes('SIMPLE')) ||
          (targetDisc === 'double' && discCode.includes('DOUBLE')) ||
          (targetDisc === 'mixte' && discCode.includes('MIXTE'));
        return matchName && matchDisc;
      });

      if (rawItems.length === 0) return discipline.matches;

      // Mark as loading
      setLoadingDetails((prev) => new Set(prev).add(detailKey));

      try {
        const detailed = await getMatchDetailsForBrackets(rawItems, personId);
        const matches = detailed.map((item, index) =>
          toFullMatchItem(item as Record<string, unknown>, index)
        );

        // Cache in memory and persisted storage
        setDetailCache((prev) => new Map(prev).set(detailKey, matches));
        cacheSetWithTTL(persistKey, matches);

        return matches;
      } catch {
        // On failure, return basic matches
        return discipline.matches;
      } finally {
        setLoadingDetails((prev) => {
          const next = new Set(prev);
          next.delete(detailKey);
          return next;
        });
      }
    },
    [personId, detailCache]
  );

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const setDiscipline = useCallback((d: DisciplineFilter) => {
    setActiveDiscipline(d);
  }, []);

  const setSeason = useCallback((s: string | null) => {
    setActiveSeason(s);
    // Auto-reset discipline if current discipline has 0 matches in new season
    // This is handled reactively via disciplineCounts check in the UI
  }, []);

  const refresh = useCallback(async () => {
    // Clear detail cache on refresh
    setDetailCache(new Map());
    await fetchData(true);
  }, [fetchData]);

  // ----------------------------------------------------------
  // Auto-reset discipline if it has 0 matches after season change
  // ----------------------------------------------------------
  useEffect(() => {
    if (activeDiscipline !== 'all' && disciplineCounts[activeDiscipline] === 0) {
      setActiveDiscipline('all');
    }
  }, [activeDiscipline, disciplineCounts]);

  // ----------------------------------------------------------
  // Return
  // ----------------------------------------------------------

  return {
    tournaments,
    allMatches,
    stats,
    disciplineCounts,
    availableSeasons,
    activeDiscipline,
    activeSeason,
    isLoading,
    isRefreshing,
    error,
    detailCache,
    loadingDetails,
    setDiscipline,
    setSeason,
    refresh,
    loadDetails,
  };
}
