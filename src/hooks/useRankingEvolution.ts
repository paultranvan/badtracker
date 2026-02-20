import { useState, useEffect, useCallback, useRef } from 'react';
import { getRankingEvolution } from '../api/ffbad';
import { NetworkError } from '../api/errors';
import { cacheGet, cacheSet } from '../cache/storage';
import { useConnectivity } from '../connectivity/context';
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
 * Cache-first pattern: reads cached chart data immediately, then fetches from API
 * in background if online. Falls back to cache when offline.
 *
 * @param licence - Player's licence number
 * @returns Chart-ready data with loading/error/refresh states
 */
export function useRankingEvolution(licence: string): RankingEvolutionResult {
  const { isConnected } = useConnectivity();

  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Step 1: Read from cache
      if (!isRefresh) {
        const cached = await cacheGet<ChartData>(`ranking:${licence}`);
        if (cached) {
          setChartData(cached);
          hasCachedData.current = true;
          if (!isConnected) {
            setIsLoading(false);
            return;
          }
        } else if (!isConnected) {
          setError('ranking.networkError');
          setIsLoading(false);
          return;
        }
      }

      // Step 2: Fetch from API
      try {
        const response = await getRankingEvolution(licence);

        // Handle Retour union: string = error/no data, array = evolution items
        if (typeof response.Retour === 'string') {
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

        // Step 3: Update cache
        cacheSet(`ranking:${licence}`, data);
        hasCachedData.current = true;
      } catch (err) {
        if (hasCachedData.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
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
    chartData,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
