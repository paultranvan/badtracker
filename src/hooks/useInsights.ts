import { useState, useEffect, useMemo } from 'react';
import { useSession } from '../auth/context';
import { getOpponentList, type OpponentListItem, type PlayerProfile } from '../api/ffbad';
import { cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';
import { computeAllInsights, type InsightsData } from '../utils/insights';
import type { MatchItem } from '../utils/matchHistory';
import { useRankingLevels } from '../ranking-levels/context';

const OPPONENT_LIST_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Computes all insights from settled detail match data + opponent list.
 *
 * Returns null while detail data is still loading.
 * Fetches opponent list (cached 10min) for the "Most Played" insight.
 */
export function useInsights(
  allDetailMatches: MatchItem[],
  detailsLoading: boolean,
  rankings?: PlayerProfile['rankings'] | null,
): InsightsData | null {
  const { session } = useSession();
  const rankingLevels = useRankingLevels();
  const [opponents, setOpponents] = useState<OpponentListItem[]>([]);

  // Fetch opponent list
  useEffect(() => {
    if (!session?.personId) return;
    let cancelled = false;

    (async () => {
      const cacheKey = `opponentList:${session.personId}`;
      let data = await cacheGetWithTTL<OpponentListItem[]>(cacheKey, OPPONENT_LIST_TTL);

      if (!data) {
        try {
          data = await getOpponentList();
          if (data.length > 0) {
            cacheSetWithTTL(cacheKey, data);
          }
        } catch {
          return;
        }
      }

      if (!cancelled && data) {
        setOpponents(data);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.personId]);

  // Compute insights only when details are settled
  const insights = useMemo(() => {
    if (detailsLoading || allDetailMatches.length === 0) return null;
    return computeAllInsights(allDetailMatches, opponents, rankings, rankingLevels);
  }, [allDetailMatches, detailsLoading, opponents, rankings, rankingLevels]);

  return insights;
}
