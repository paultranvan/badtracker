import { useState, useEffect } from 'react';
import { useSession } from '../auth/context';
import { getOpponentList } from '../api/ffbad';
import { cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';
import type { BookmarkedPlayer } from '../bookmarks/storage';

export interface H2HCounts {
  against: number;
  together: number;
}

const OPPONENT_LIST_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches the logged-in user's opponent list from the API to compute
 * accurate full-history match counts for each bookmarked player.
 */
export function useBookmarkH2HCounts(
  bookmarks: BookmarkedPlayer[]
): Map<string, H2HCounts> {
  const { session } = useSession();
  const [counts, setCounts] = useState<Map<string, H2HCounts>>(new Map());

  useEffect(() => {
    if (!session?.personId || bookmarks.length === 0) {
      setCounts(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      const cacheKey = `opponentList:${session.personId}`;

      // Try cache first
      let opponents = await cacheGetWithTTL<
        Array<{ PersonLicence: string; MatchCount: number }>
      >(cacheKey, OPPONENT_LIST_TTL);

      // Fetch from API if not cached
      if (!opponents) {
        try {
          opponents = await getOpponentList();
          if (opponents.length > 0) {
            cacheSetWithTTL(cacheKey, opponents);
          }
        } catch {
          return; // Silently fail — badges just won't show
        }
      }

      if (cancelled || !opponents || opponents.length === 0) return;

      // Build licence → matchCount lookup
      const byLicence = new Map<string, number>();
      for (const opp of opponents) {
        if (opp.PersonLicence) {
          byLicence.set(opp.PersonLicence.trim(), opp.MatchCount ?? 0);
        }
      }

      const result = new Map<string, H2HCounts>();
      for (const b of bookmarks) {
        const against = byLicence.get(b.licence.trim()) ?? 0;
        if (against > 0) {
          result.set(b.licence, { against, together: 0 });
        }
      }

      if (!cancelled) setCounts(result);
    })();

    return () => { cancelled = true; };
  }, [session?.personId, bookmarks]);

  return counts;
}
