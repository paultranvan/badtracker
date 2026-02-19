import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform, UIManager, LayoutAnimation } from 'react-native';
import { getResultsByLicence } from '../api/ffbad';
import { NetworkError, ServerError } from '../api/errors';
import { useSession } from '../auth/context';
import {
  toFullMatchItem,
  groupByTournament,
  filterByDiscipline,
  filterBySeason,
  computeWinLossStats,
  getAvailableSeasons,
  getDisciplineCounts,
  type MatchItem,
  type MatchSection,
  type WinLossStats,
  type DisciplineFilter,
} from '../utils/matchHistory';

// ============================================================
// Enable LayoutAnimation on Android
// ============================================================

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================
// Types
// ============================================================

export interface MatchHistoryData {
  sections: MatchSection[];
  allMatches: MatchItem[];
  stats: WinLossStats;
  disciplineCounts: Record<DisciplineFilter, number>;
  availableSeasons: string[];
  activeDiscipline: DisciplineFilter;
  activeSeason: string | null;
  expandedMatchId: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  setDiscipline: (d: DisciplineFilter) => void;
  setSeason: (s: string | null) => void;
  toggleMatchExpand: (id: string) => void;
  refresh: () => Promise<void>;
}

// Re-export types for convenience
export type { MatchItem, MatchSection, WinLossStats, DisciplineFilter };

// ============================================================
// Hook
// ============================================================

/**
 * Orchestrates match history data fetching, filtering, grouping, and stats.
 *
 * Follows established patterns from useDashboardData:
 * - Cancelled flag for cleanup
 * - Separate isLoading (initial) vs isRefreshing (pull-to-refresh)
 * - Error classification with i18n keys
 * - useMemo for derived state
 */
export function useMatchHistory(): MatchHistoryData {
  const { session } = useSession();

  // Core state
  const [allMatches, setAllMatches] = useState<MatchItem[]>([]);
  const [activeDiscipline, setActiveDiscipline] =
    useState<DisciplineFilter>('all');
  const [activeSeason, setActiveSeason] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const licence = session?.licence;

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

      try {
        const response = await getResultsByLicence(licence);
        const retour = response.Retour;

        if (Array.isArray(retour)) {
          const matches = retour.map((item, index) =>
            toFullMatchItem(item as Record<string, unknown>, index)
          );
          setAllMatches(matches);
        } else {
          // API returned a string (error message or no data)
          setAllMatches([]);
        }
      } catch (err) {
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
    [licence]
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

  // ----------------------------------------------------------
  // Derived state (memoized)
  // ----------------------------------------------------------

  const filteredMatches = useMemo(() => {
    let matches = filterByDiscipline(allMatches, activeDiscipline);
    if (activeSeason) {
      matches = filterBySeason(matches, activeSeason);
    }
    return matches;
  }, [allMatches, activeDiscipline, activeSeason]);

  const sections = useMemo(
    () => groupByTournament(filteredMatches),
    [filteredMatches]
  );

  const stats = useMemo(
    () => computeWinLossStats(filteredMatches),
    [filteredMatches]
  );

  // Counts always from ALL matches (not filtered)
  const disciplineCounts = useMemo(
    () => getDisciplineCounts(allMatches),
    [allMatches]
  );

  const availableSeasons = useMemo(
    () => getAvailableSeasons(allMatches),
    [allMatches]
  );

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const setDiscipline = useCallback((d: DisciplineFilter) => {
    setActiveDiscipline(d);
    // Collapse any expanded match when filter changes
    setExpandedMatchId(null);
  }, []);

  const setSeason = useCallback((s: string | null) => {
    setActiveSeason(s);
    // Collapse any expanded match when season changes
    setExpandedMatchId(null);
  }, []);

  const toggleMatchExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMatchId((prev) => (prev === id ? null : id));
  }, []);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // ----------------------------------------------------------
  // Return
  // ----------------------------------------------------------

  return {
    sections,
    allMatches,
    stats,
    disciplineCounts,
    availableSeasons,
    activeDiscipline,
    activeSeason,
    expandedMatchId,
    isLoading,
    isRefreshing,
    error,
    setDiscipline,
    setSeason,
    toggleMatchExpand,
    refresh,
  };
}
