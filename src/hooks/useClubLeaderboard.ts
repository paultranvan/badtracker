import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getClubTops, getClubInfo, type ClubInfo } from '../api/ffbad';
import { NetworkError } from '../api/errors';
import { cacheGet, cacheSet } from '../cache/storage';
import { useConnectivity } from '../connectivity/context';
import {
  mergeTopsResults,
  type LeaderboardEntry,
  type TopsApiItem,
} from '../utils/clubLeaderboard';

// ============================================================
// Types
// ============================================================

export interface ClubLeaderboardData {
  members: LeaderboardEntry[];
  clubName: string;
  clubInfo: ClubInfo | null;
  rankedCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface CachedClubTops {
  members: LeaderboardEntry[];
  clubName: string;
  clubInfo: ClubInfo | null;
}

// ============================================================
// Hook
// ============================================================

/**
 * Fetches and manages club leaderboard using /api/search/tops.
 * Fetches all 6 disciplines in parallel, merges by licence.
 *
 * Cache-first: reads cached data immediately, refreshes in background
 * if online. Falls back to cache when offline.
 */
export function useClubLeaderboard(clubId: string | null): ClubLeaderboardData {
  const { t } = useTranslation();
  const { isConnected } = useConnectivity();

  const [members, setMembers] = useState<LeaderboardEntry[]>([]);
  const [clubName, setClubName] = useState('');
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [rankedCount, setRankedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCachedData = useRef(false);
  const prevConnected = useRef(isConnected);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!clubId) {
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
        const cached = await cacheGet<CachedClubTops>(`club-tops:${clubId}`);
        if (cached) {
          setMembers(cached.members);
          setClubName(cached.clubName);
          setClubInfo(cached.clubInfo ?? null);
          setRankedCount(cached.members.filter((m) => m.bestRate !== null).length);
          hasCachedData.current = true;
          if (!isConnected) {
            setIsLoading(false);
            return;
          }
        } else if (!isConnected) {
          setError(t('club.networkError'));
          setIsLoading(false);
          return;
        }
      }

      // Step 2: Fetch club info and tops in parallel
      try {
        const [info, topsResults] = await Promise.all([
          getClubInfo(clubId),
          getClubTops(clubId),
        ]);

        if (info) {
          setClubInfo(info);
          setClubName(info.name);
        }

        const merged = mergeTopsResults(
          topsResults as Array<[1 | 2 | 3 | 4 | 5 | 6, TopsApiItem[]]>
        );

        setMembers(merged);
        const ranked = merged.filter((m) => m.bestRate !== null).length;
        setRankedCount(ranked);

        // Step 3: Update cache
        cacheSet(`club-tops:${clubId}`, {
          members: merged,
          clubName: info?.name ?? '',
          clubInfo: info,
        });
        hasCachedData.current = true;
      } catch (err) {
        if (hasCachedData.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
        if (err instanceof NetworkError) {
          setError(t('club.networkError'));
        } else {
          setError(t('club.loadError'));
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [clubId, t, isConnected]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!cancelled) {
        await fetchData(false);
      }
    };

    if (clubId) {
      setIsLoading(true);
      load();
    } else {
      setMembers([]);
      setClubName('');
      setClubInfo(null);
      setRankedCount(0);
      setIsLoading(false);
      setError(null);
    }

    return () => {
      cancelled = true;
    };
  }, [clubId, fetchData]);

  // Auto-refresh when connectivity returns
  useEffect(() => {
    if (!prevConnected.current && isConnected && clubId) {
      fetchData(true);
    }
    prevConnected.current = isConnected;
  }, [isConnected, clubId, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    members,
    clubName,
    clubInfo,
    rankedCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
