import { useState, useEffect } from 'react';
import { useSession } from '../auth/context';
import { readAllDetailCache, filterMatchesForLicence } from './useHeadToHead';
import type { BookmarkedPlayer } from '../bookmarks/storage';

export interface H2HCounts {
  against: number;
  together: number;
}

/**
 * Scans the match detail cache to compute confrontation/partner counts
 * for each bookmarked player. No API calls — uses cached data only.
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
      const allMatches = await readAllDetailCache(session.personId);
      if (cancelled || allMatches.length === 0) return;

      const result = new Map<string, H2HCounts>();
      for (const b of bookmarks) {
        const { against, together } = filterMatchesForLicence(allMatches, b.licence);
        if (against.length > 0 || together.length > 0) {
          result.set(b.licence, { against: against.length, together: together.length });
        }
      }

      if (!cancelled) setCounts(result);
    })();

    return () => { cancelled = true; };
  }, [session?.personId, bookmarks]);

  return counts;
}
