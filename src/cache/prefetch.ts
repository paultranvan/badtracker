import { cacheGet, cacheSet } from './storage';
import { getClubInfo, getClubTops } from '../api/ffbad';
import { mergeTopsResults, type TopsApiItem } from '../utils/clubLeaderboard';
import type { CachedClubTops } from '../hooks/useClubLeaderboard';

/**
 * Prefetch club leaderboard data into cache if not already cached.
 * Fire-and-forget — errors are silently caught so this never blocks the app.
 */
export async function prefetchClubLeaderboard(clubId: string): Promise<void> {
  try {
    const existing = await cacheGet<CachedClubTops>(`club-tops:${clubId}`);
    if (existing) return;

    const [info, topsResults] = await Promise.all([
      getClubInfo(clubId),
      getClubTops(clubId),
    ]);

    const merged = mergeTopsResults(
      topsResults as Array<[1 | 2 | 3 | 4 | 5 | 6, TopsApiItem[]]>
    );

    await cacheSet(`club-tops:${clubId}`, {
      members: merged,
      clubName: info?.name ?? '',
      clubInfo: info,
    });
  } catch {
    // Silently ignore — Club tab will load normally if prefetch fails
  }
}
