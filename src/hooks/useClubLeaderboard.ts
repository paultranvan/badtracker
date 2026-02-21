import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getClubLeaderboard, getClubInfo, type ClubInfo } from '../api/ffbad';
import { NetworkError } from '../api/errors';
import { cacheGet, cacheSet } from '../cache/storage';
import { useConnectivity } from '../connectivity/context';
import { normalizeToLeaderboard, type LeaderboardEntry } from '../utils/clubLeaderboard';

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

// Cache shape for club leaderboard
interface CachedClubLeaderboard {
  members: LeaderboardEntry[];
  clubName: string;
  clubInfo: ClubInfo | null;
  rankedCount: number;
}

// ============================================================
// Hook
// ============================================================

/**
 * Fetches and manages club leaderboard state for a given club ID.
 *
 * Cache-first pattern: reads cached leaderboard immediately, then fetches from API
 * in background if online. Falls back to cache when offline.
 *
 * @param clubId - FFBaD club ID (Club field from player profile), or null if unknown
 */
export function useClubLeaderboard(clubId: string | null): ClubLeaderboardData {
  const { t } = useTranslation();
  const { isConnected } = useConnectivity();

  const [members, setMembers] = useState<LeaderboardEntry[]>([]);
  const [clubName, setClubName] = useState<string>('');
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [rankedCount, setRankedCount] = useState<number>(0);
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
        const cached = await cacheGet<CachedClubLeaderboard>(`club:${clubId}`);
        if (cached) {
          setMembers(cached.members);
          setClubName(cached.clubName);
          setClubInfo(cached.clubInfo ?? null);
          setRankedCount(cached.rankedCount);
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

      // Step 2: Fetch club info and members from API
      try {
        // Fetch club info (name, address, contact, etc.)
        const info = await getClubInfo(clubId);
        if (info) {
          setClubInfo(info);
          setClubName(info.name);
        }

        // Try to fetch members
        const response = await getClubLeaderboard(clubId);

        if (Array.isArray(response.Retour)) {
          const normalized = normalizeToLeaderboard(response.Retour);
          setMembers(normalized);

          // Use club name from info or from first member
          const name = info?.name ?? '';
          if (name) setClubName(name);

          const ranked = normalized.filter((m) => m.bestRank !== 'NC').length;
          setRankedCount(ranked);

          // Step 3: Update cache
          cacheSet(`club:${clubId}`, {
            members: normalized,
            clubName: name,
            clubInfo: info,
            rankedCount: ranked,
          });
          hasCachedData.current = true;
        } else {
          // No members available — still cache club info
          setMembers([]);
          setRankedCount(0);
          if (info) {
            cacheSet(`club:${clubId}`, {
              members: [],
              clubName: info.name,
              clubInfo: info,
              rankedCount: 0,
            });
            hasCachedData.current = true;
          }
        }
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
      // No club ID — ensure clean state, no loading spinner
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
