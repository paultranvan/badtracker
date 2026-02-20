import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getClubLeaderboard } from '../api/ffbad';
import { NetworkError } from '../api/errors';
import { normalizeToLeaderboard, type LeaderboardEntry } from '../utils/clubLeaderboard';

// ============================================================
// Types
// ============================================================

export interface ClubLeaderboardData {
  members: LeaderboardEntry[];
  clubName: string;
  rankedCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ============================================================
// Hook
// ============================================================

/**
 * Fetches and manages club leaderboard state for a given club ID.
 *
 * Follows the established hook pattern from useDashboardData:
 * - useCallback + useEffect with cancelled flag for cleanup
 * - Separate isLoading (initial fetch) vs isRefreshing (pull-to-refresh)
 * - Error classification with i18n keys (club.networkError, club.loadError)
 * - Graceful null clubId handling — no fetch, empty state returned
 *
 * @param clubId - FFBaD club ID (Club field from player profile), or null if unknown
 */
export function useClubLeaderboard(clubId: string | null): ClubLeaderboardData {
  const { t } = useTranslation();

  const [members, setMembers] = useState<LeaderboardEntry[]>([]);
  const [clubName, setClubName] = useState<string>('');
  const [rankedCount, setRankedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      try {
        const response = await getClubLeaderboard(clubId);

        if (Array.isArray(response.Retour)) {
          const normalized = normalizeToLeaderboard(response.Retour);
          setMembers(normalized);

          // Extract club name from first raw item's NomClub field
          const firstItem = response.Retour[0] as Record<string, unknown> | undefined;
          setClubName((firstItem?.NomClub as string | undefined) ?? '');

          // Count members with a real rank (anything other than NC)
          setRankedCount(normalized.filter((m) => m.bestRank !== 'NC').length);
        } else {
          // Retour is a string — API returned an error/empty message
          setMembers([]);
          setClubName('');
          setRankedCount(0);
        }
      } catch (err) {
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
    [clubId, t]
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
      setRankedCount(0);
      setIsLoading(false);
      setError(null);
    }

    return () => {
      cancelled = true;
    };
  }, [clubId, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    members,
    clubName,
    rankedCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
