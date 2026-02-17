import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPlayerProfile,
  getResultsByLicence,
  type PlayerProfile,
} from '../api/ffbad';
import { NetworkError, ServerError } from '../api/errors';
import { useSession } from '../auth/context';
import { getBestRanking } from '../utils/rankings';

// ============================================================
// Types
// ============================================================

export interface MatchPreview {
  date?: string;
  opponent?: string;
  score?: string;
  event?: string;
  round?: string;
  isWin?: boolean;
}

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
  recentMatches: MatchPreview[];
  quickStats: QuickStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Map a raw result item from the FFBaD API to a MatchPreview.
 * The ResultItem schema has all optional fields with .passthrough().
 */
function toMatchPreview(raw: Record<string, unknown>): MatchPreview {
  const score = (raw.Score as string) ?? undefined;

  // Try to determine win/loss from score or result indicator
  // FFBaD may include a result field — check common field names
  let isWin: boolean | undefined;
  const resultField =
    (raw.Resultat as string) ??
    (raw.Result as string) ??
    (raw.VD as string) ??
    undefined;

  if (resultField) {
    const upper = resultField.toUpperCase().trim();
    if (upper === 'V' || upper === 'VICTOIRE' || upper === 'WIN') {
      isWin = true;
    } else if (upper === 'D' || upper === 'DEFAITE' || upper === 'LOSS') {
      isWin = false;
    }
  }

  return {
    date: (raw.Date as string) ?? undefined,
    opponent: (raw.Adversaire as string) ?? undefined,
    score,
    event: (raw.Epreuve as string) ?? undefined,
    round: (raw.Tour as string) ?? undefined,
    isWin,
  };
}

/**
 * Compute quick stats from profile rankings and match data.
 */
function computeQuickStats(
  profile: PlayerProfile,
  allMatches: MatchPreview[]
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
 * Follows established patterns from usePlayerSearch:
 * - Cancelled flag for cleanup
 * - Separate isLoading (initial) vs isRefreshing (pull-to-refresh)
 * - Error classification with i18n keys
 * - Graceful partial failure (profile loads even if matches fail)
 */
export function useDashboardData(): DashboardData {
  const { t } = useTranslation();
  const { session } = useSession();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchPreview[]>([]);
  const [allMatches, setAllMatches] = useState<MatchPreview[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const licence = session?.licence;

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
          // Profile is critical — if it fails, show error
          const err = profileResult.reason;
          if (err instanceof NetworkError) {
            setError('dashboard.networkError');
          } else {
            setError('dashboard.loadError');
          }
        }

        // Handle matches result (non-critical — partial failure OK)
        let matchPreviews: MatchPreview[] = [];
        if (matchesResult.status === 'fulfilled') {
          const retour = matchesResult.value.Retour;
          if (Array.isArray(retour)) {
            matchPreviews = retour.map((item) =>
              toMatchPreview(item as Record<string, unknown>)
            );
          }
        }
        // If matches fail, we still show profile — just with empty matches

        setAllMatches(matchPreviews);
        setRecentMatches(matchPreviews.slice(0, 3));

        // Compute quick stats if we have profile data
        if (loadedProfile) {
          setQuickStats(computeQuickStats(loadedProfile, matchPreviews));
        }
      } catch (err) {
        // Unexpected error outside Promise.allSettled
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
    profile,
    recentMatches,
    quickStats,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
