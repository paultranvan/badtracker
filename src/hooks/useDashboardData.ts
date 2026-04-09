import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPlayerProfile,
  getResultsByLicence,
  getMatchDetailsForBrackets,
  type PlayerProfile,
} from '../api/ffbad';
import { NetworkError, ServerError } from '../api/errors';
import { useSession } from '../auth/context';
import { getBestRanking } from '../utils/rankings';
import { cacheGet, cacheSet, cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';
import { useConnectivity } from '../connectivity/context';
import {
  toFullMatchItem,
  groupByTournamentNested,
  computeWinLossStats,
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
  /** Last 3 individual matches from detail data (sorted by date desc) */
  recentDetailMatches: MatchItem[];
  /** All individual matches from detail cache (sorted by date desc) */
  allDetailMatches: MatchItem[];
  /** True while detail data is still loading for recent matches */
  detailsLoading: boolean;
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

  // ----------------------------------------------------------
  // Detail-level stats (same approach as useMatchHistory)
  // Bracket-level winPoint can mask individual losses.
  // Auto-load details for all brackets and recompute stats.
  // ----------------------------------------------------------

  const [detailStatsCache, setDetailStatsCache] = useState<Map<string, MatchItem[]>>(new Map());
  const autoLoadTriggered = useRef(new Set<string>());

  const tournaments = useMemo(
    () => groupByTournamentNested(allMatches),
    [allMatches]
  );

  // Auto-load details for all tournaments
  useEffect(() => {
    if (!session?.personId || isLoading || allMatches.length === 0 || rawItems.length === 0) return;
    const pid = session.personId;

    for (const tournament of tournaments) {
      for (const disc of tournament.disciplines) {
        const key = `${tournament.title}:${disc.discipline}`;
        if (autoLoadTriggered.current.has(key)) continue;
        autoLoadTriggered.current.add(key);

        // Check persistent cache first, then fetch
        const persistKey = `detail:${pid}:${key}`;
        const DETAIL_TTL = 24 * 60 * 60 * 1000;

        (async () => {
          const persisted = await cacheGetWithTTL<MatchItem[]>(persistKey, DETAIL_TTL);
          if (persisted) {
            setDetailStatsCache((prev) => new Map(prev).set(key, persisted));
            return;
          }

          // Find matching raw items
          const matchingRaw = rawItems.filter((item) => {
            const name = item.name as string | undefined;
            const d = item.discipline as string | undefined;
            if (!name || !d) return false;
            const matchName = name === tournament.title || (tournament.title === '' && name === 'unknown');
            const discCode = d.toUpperCase();
            const target = disc.discipline;
            const matchDisc =
              (target === 'simple' && discCode.includes('SIMPLE')) ||
              (target === 'double' && discCode.includes('DOUBLE')) ||
              (target === 'mixte' && discCode.includes('MIXTE'));
            return matchName && matchDisc;
          });

          // Deduplicate
          const seen = new Set<string>();
          const unique = matchingRaw.filter((item) => {
            const k = `${item.date}|${item.bracketId}|${item.disciplineId}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });

          if (unique.length === 0) return;

          try {
            const detailed = await getMatchDetailsForBrackets(unique, pid);
            const matches = detailed.map((item, i) =>
              toFullMatchItem(item as Record<string, unknown>, i)
            );
            setDetailStatsCache((prev) => new Map(prev).set(key, matches));
            cacheSetWithTTL(persistKey, matches);
          } catch {
            // Silently fall back to bracket-level data
          }
        })();
      }
    }
  }, [tournaments, session?.personId, isLoading, allMatches.length, rawItems]);

  // Recompute quickStats when detail data arrives
  const enrichedQuickStats = useMemo(() => {
    if (!quickStats) return null;
    if (detailStatsCache.size === 0) return quickStats;

    // Merge detail-level matches with uncovered bracket-level matches
    const detailMatches: MatchItem[] = [];
    const coveredBracketIds = new Set<string>();

    for (const tournament of tournaments) {
      for (const disc of tournament.disciplines) {
        const key = `${tournament.title}:${disc.discipline}`;
        const cached = detailStatsCache.get(key);
        if (cached && cached.length > 0) {
          detailMatches.push(...cached);
          for (const m of disc.matches) {
            coveredBracketIds.add(m.id);
          }
        }
      }
    }

    const uncovered = allMatches.filter((m) => !coveredBracketIds.has(m.id));
    const all = [...detailMatches, ...uncovered];
    const stats = computeWinLossStats(all);

    return {
      ...quickStats,
      matchCount: stats.total,
      winRate: stats.winPercentage,
    };
  }, [quickStats, detailStatsCache, tournaments, allMatches]);

  // Collect all detail-level matches from cache
  const allDetailMatches = useMemo(() => {
    if (detailStatsCache.size === 0) return [];
    const allDetail: MatchItem[] = [];
    for (const matches of detailStatsCache.values()) {
      allDetail.push(...matches);
    }
    // Sort by raw date descending (most recent first)
    allDetail.sort((a, b) => {
      const da = a._rawDate ?? '';
      const db = b._rawDate ?? '';
      return db.localeCompare(da);
    });
    return allDetail;
  }, [detailStatsCache]);

  // Derive last 3 individual matches from detail data
  const recentDetailMatches = useMemo(() => {
    if (allDetailMatches.length === 0) return [];
    // Re-assign unique IDs (original IDs can collide across different cache entries)
    return allDetailMatches.slice(0, 3).map((m, i) => ({ ...m, id: `recent-${i}` }));
  }, [allDetailMatches]);

  // Track whether details are still loading
  const detailsLoading = useMemo(() => {
    if (allMatches.length === 0) return false;
    // Details are loading if we have tournaments but haven't finished loading all of them
    const totalGroups = tournaments.reduce((sum, t) => sum + t.disciplines.length, 0);
    return totalGroups > 0 && detailStatsCache.size < totalGroups;
  }, [allMatches.length, tournaments, detailStatsCache.size]);

  const refresh = useCallback(async () => {
    setDetailStatsCache(new Map());
    autoLoadTriggered.current.clear();
    await fetchData(true);
  }, [fetchData]);

  return {
    profile,
    recentMatches,
    recentDetailMatches,
    allDetailMatches,
    detailsLoading,
    quickStats: enrichedQuickStats,
    isLoading,
    isRefreshing,
    error,
    refresh,
    rawItems,
    personId: session?.personId ?? null,
  };
}
