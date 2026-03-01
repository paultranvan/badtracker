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

export interface DisciplineStats {
  simple: { wins: number; losses: number };
  double: { wins: number; losses: number };
  mixte: { wins: number; losses: number };
}

export interface MatchHistoryData {
  tournaments: TournamentSection[];
  allMatches: MatchItem[];
  stats: WinLossStats;
  /** Per-discipline W/L stats computed from the same detail-aware data as stats */
  disciplineStats: DisciplineStats;
  /** True once all tournament details have loaded and stats are accurate */
  isStatsSettled: boolean;
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
export function useMatchHistory(targetPersonId?: string): MatchHistoryData {
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
  const personId = targetPersonId ?? session?.personId;
  const hasCachedData = useRef(false);
  const prevConnected = useRef(isConnected);

  // ----------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!personId) {
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
        const cached = await cacheGetWithTTL<MatchItem[]>(`matches:${personId}`, RESULT_CACHE_TTL);
        if (cached) {
          setAllMatches(cached);
          // Restore raw items for lazy detail loading
          const cachedRaw = await cacheGetWithTTL<Array<Record<string, unknown>>>(`matches-raw:${personId}`, RESULT_CACHE_TTL);
          if (cachedRaw) rawResultItems.current = cachedRaw;
          hasCachedData.current = true;
          if (!isConnected) {
            setIsLoading(false);
            return;
          }
        } else if (!isConnected) {
          // Try non-TTL cache as fallback when offline
          const stale = await cacheGet<MatchItem[]>(`matches:${personId}`);
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
        const response = await getResultsByLicence(
          targetPersonId ? '' : (licence ?? ''),
          personId
        );
        const retour = response.Retour;

        if (Array.isArray(retour)) {
          const matches = retour.map((item, index) =>
            toFullMatchItem(item as Record<string, unknown>, index)
          );
          setAllMatches(matches);
          // Store raw API items for lazy detail loading
          rawResultItems.current = response._rawItems ?? [];
          // Update cache with TTL
          cacheSetWithTTL(`matches:${personId}`, matches);
          // Also cache raw items for detail loading after cache restore
          if (response._rawItems) {
            cacheSetWithTTL(`matches-raw:${personId}`, response._rawItems);
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
    [licence, personId, isConnected]
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
    if (!prevConnected.current && isConnected && personId) {
      fetchData(true);
    }
    prevConnected.current = isConnected;
  }, [isConnected, personId, fetchData]);

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

  // Compute stats using detail-level data when available.
  // Detail cache has individual match results (win/loss per match),
  // while allMatches has bracket-level results (aggregate winPoint per bracket).
  // A bracket with winPoint > 0 might still contain individual losses.
  const { stats, disciplineStats, isStatsSettled } = useMemo(() => {
    // Collect all detail-level matches for the current filter
    const detailMatches: MatchItem[] = [];
    const coveredBracketIds = new Set<string>();

    for (const tournament of tournaments) {
      const title = tournament.title;
      for (const disc of tournament.disciplines) {
        const cacheKey = `${title}:${disc.discipline}`;
        const cached = detailCache.get(cacheKey);
        if (cached && cached.length > 0) {
          // Use detail-level matches (individual wins/losses)
          detailMatches.push(...cached);
          // Mark bracket-level matches as covered
          for (const m of disc.matches) {
            coveredBracketIds.add(m.id);
          }
        }
      }
    }

    // Add bracket-level matches that don't have detail data yet
    const uncoveredMatches = filteredMatches.filter(
      (m) => !coveredBracketIds.has(m.id)
    );

    // Stats are settled when all brackets have detail data (no uncovered matches)
    const settled = uncoveredMatches.length === 0 && filteredMatches.length > 0;

    const allStatsMatches = [...detailMatches, ...uncoveredMatches];

    // Compute per-discipline W/L from the same detail-aware data
    const perDisc: DisciplineStats = {
      simple: { wins: 0, losses: 0 },
      double: { wins: 0, losses: 0 },
      mixte: { wins: 0, losses: 0 },
    };
    for (const m of allStatsMatches) {
      if (m.discipline && m.discipline in perDisc && m.isWin !== undefined) {
        if (m.isWin) perDisc[m.discipline].wins++;
        else perDisc[m.discipline].losses++;
      }
    }

    return {
      stats: computeWinLossStats(allStatsMatches),
      disciplineStats: perDisc,
      isStatsSettled: settled || filteredMatches.length === 0,
    };
  }, [filteredMatches, tournaments, detailCache]);

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

      // Deduplicate raw items by bracket identity (date + bracketId + disciplineId)
      // Multiple raw items can reference the same bracket, causing duplicate expansion
      const seen = new Set<string>();
      const uniqueRawItems = rawItems.filter((item) => {
        const date = (item.date as string) ?? '';
        const bracketId = String(item.bracketId ?? '');
        const disciplineId = String(item.disciplineId ?? '');
        const key = `${date}|${bracketId}|${disciplineId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniqueRawItems.length === 0) return discipline.matches;

      // Mark as loading
      setLoadingDetails((prev) => new Set(prev).add(detailKey));

      try {
        const detailed = await getMatchDetailsForBrackets(uniqueRawItems, personId);
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

  // Ref for auto-load tracking (declared before refresh so refresh can clear it)
  const autoLoadTriggered = useRef(new Set<string>());
  const loadDetailsRef = useRef(loadDetails);
  loadDetailsRef.current = loadDetails;

  const refresh = useCallback(async () => {
    // Clear detail cache on refresh
    setDetailCache(new Map());
    autoLoadTriggered.current.clear();
    await fetchData(true);
  }, [fetchData]);

  // ----------------------------------------------------------
  // Auto-load details for all visible tournaments (accurate stats)
  // Bracket-level data can classify a bracket as "win" even when
  // individual matches within it were lost. Auto-loading details
  // ensures stats reflect actual match-level win/loss.
  // ----------------------------------------------------------

  useEffect(() => {
    if (!personId || isLoading) return;
    for (const tournament of tournaments) {
      for (const disc of tournament.disciplines) {
        const key = `${tournament.title}:${disc.discipline}`;
        if (!autoLoadTriggered.current.has(key)) {
          autoLoadTriggered.current.add(key);
          loadDetailsRef.current(tournament.title, disc);
        }
      }
    }
  }, [tournaments, personId, isLoading]);

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
    disciplineStats,
    isStatsSettled,
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
