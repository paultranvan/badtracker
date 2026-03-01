import { useState, useEffect } from 'react';
import { getClubInfo } from '../api/ffbad';
import { cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';
import type { BookmarkedPlayer } from '../bookmarks/storage';

const CLUB_INFO_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Batch-fetches club initials for bookmarked players that have a clubId.
 * Returns a Map from licence to club initials string (e.g. "CALB94").
 */
export function useBookmarkClubs(
  bookmarks: BookmarkedPlayer[]
): Map<string, string> {
  const [clubs, setClubs] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (bookmarks.length === 0) {
      setClubs(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      // Deduplicate clubIds across bookmarks
      const clubIdToLicences = new Map<string, string[]>();
      for (const b of bookmarks) {
        if (!b.clubId) continue;
        const existing = clubIdToLicences.get(b.clubId) ?? [];
        existing.push(b.licence);
        clubIdToLicences.set(b.clubId, existing);
      }

      if (clubIdToLicences.size === 0) return;

      const result = new Map<string, string>();

      // Fetch club info for each unique clubId (parallel, cached)
      await Promise.all(
        Array.from(clubIdToLicences.entries()).map(async ([clubId, licences]) => {
          const cacheKey = `clubInitials:${clubId}`;

          let initials = await cacheGetWithTTL<string>(cacheKey, CLUB_INFO_TTL);

          if (!initials) {
            try {
              const info = await getClubInfo(clubId);
              if (info?.initials) {
                initials = info.initials;
                cacheSetWithTTL(cacheKey, initials);
              }
            } catch {
              return; // Skip this club on error
            }
          }

          if (initials) {
            for (const licence of licences) {
              result.set(licence, initials);
            }
          }
        })
      );

      if (!cancelled) setClubs(result);
    })();

    return () => { cancelled = true; };
  }, [bookmarks]);

  return clubs;
}
