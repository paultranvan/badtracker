import { useState, useEffect, useCallback } from 'react';
import { getRankingEvolution } from '../api/ffbad';
import { NetworkError } from '../api/errors';
import {
  transformEvolutionData,
  buildFlatLineForNC,
  type ChartData,
  type Discipline,
} from '../utils/rankingChart';

// ============================================================
// Types
// ============================================================

export interface RankingEvolutionResult {
  chartData: ChartData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ============================================================
// Hook
// ============================================================

/**
 * Fetch and transform ranking evolution data for chart display.
 *
 * Follows established hook patterns from useDashboardData and useMatchHistory:
 * - Cancelled flag for cleanup
 * - Separate isLoading (initial) vs isRefreshing (pull-to-refresh)
 * - Error classification with i18n keys
 * - useCallback + useEffect with cleanup
 *
 * @param licence - Player's licence number
 * @returns Chart-ready data with loading/error/refresh states
 */
export function useRankingEvolution(licence: string): RankingEvolutionResult {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const response = await getRankingEvolution(licence);

        // Handle Retour union: string = error/no data, array = evolution items
        if (typeof response.Retour === 'string') {
          // No evolution data available — not necessarily an error
          setChartData(null);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        if (!Array.isArray(response.Retour) || response.Retour.length === 0) {
          setChartData(null);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        // Transform raw data to chart format
        const data = transformEvolutionData(
          response.Retour as Array<Record<string, unknown>>
        );

        // For NC disciplines with no evolution data, build flat line at 0
        // using the date range from disciplines that DO have data
        if (data.dateRange.start && data.dateRange.end) {
          for (const disc of data.disciplines) {
            if (disc.points.length === 0) {
              disc.points = buildFlatLineForNC(
                data.dateRange,
                disc.discipline as Discipline
              );
            }
          }
        }

        setChartData(data);
      } catch (err) {
        if (err instanceof NetworkError) {
          setError('ranking.networkError');
        } else {
          setError('ranking.loadError');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [licence]
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

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    chartData,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
