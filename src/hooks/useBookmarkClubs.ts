import { useState, useEffect } from 'react';
import { getClubInfo, getLastClub } from '../api/ffbad';
import { cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';
import { useBookmarks } from '../bookmarks/context';
import type { BookmarkedPlayer } from '../bookmarks/storage';

const CLUB_INFO_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Batch-fetches club initials for bookmarked players.
 * Uses clubId when available, falls back to lastCLub API for players with personId.
 * Returns a Map from licence to club initials string (e.g. "CALB94").
 */
export function useBookmarkClubs(
  bookmarks: BookmarkedPlayer[]
): Map<string, string> {
  const [clubs, setClubs] = useState<Map<string, string>>(new Map());
  const { updateStoredClubId } = useBookmarks();

  useEffect(() => {
    if (bookmarks.length === 0) {
      setClubs(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      const result = new Map<string, string>();

      // Group 1: bookmarks with clubId — fetch club info by clubId
      const withClubId = new Map<string, string[]>();
      const withoutClubId: BookmarkedPlayer[] = [];

      for (const b of bookmarks) {
        if (b.clubId) {
          const existing = withClubId.get(b.clubId) ?? [];
          existing.push(b.licence);
          withClubId.set(b.clubId, existing);
        } else if (b.personId) {
          withoutClubId.push(b);
        }
      }

      // Fetch club info for bookmarks with clubId
      await Promise.all(
        Array.from(withClubId.entries()).map(async ([clubId, licences]) => {
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
              return;
            }
          }

          if (initials) {
            for (const licence of licences) {
              result.set(licence, initials);
            }
          }
        })
      );

      // Group 2: bookmarks with personId but no clubId — use lastCLub API
      if (withoutClubId.length > 0) {
        await Promise.all(
          withoutClubId.map(async (b) => {
            const cacheKey = `lastClub:${b.personId}`;

            let cached = await cacheGetWithTTL<{ id: string; initials: string }>(
              cacheKey,
              CLUB_INFO_TTL
            );

            if (!cached) {
              try {
                const club = await getLastClub(b.personId!);
                if (club) {
                  cached = club;
                  cacheSetWithTTL(cacheKey, club);
                  // Backfill clubId on the bookmark for future use
                  if (club.id) {
                    updateStoredClubId(b.licence, club.id);
                  }
                }
              } catch {
                return;
              }
            }

            if (cached?.initials) {
              result.set(b.licence, cached.initials);
            }
          })
        );
      }

      if (!cancelled) setClubs(result);
    })();

    return () => { cancelled = true; };
  }, [bookmarks, updateStoredClubId]);

  return clubs;
}
