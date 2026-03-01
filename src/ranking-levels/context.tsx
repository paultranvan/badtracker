import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSession } from '../auth/context';
import { getRankingLevels, type RankingLevel } from '../api/ffbad';
import { cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';

// ============================================================
// Constants
// ============================================================

const CACHE_KEY = 'ranking-levels';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================
// Context
// ============================================================

const RankingLevelsContext = createContext<RankingLevel[] | null>(null);

/**
 * Hook to access the ranking levels data.
 * Returns null while loading or if unavailable.
 */
export function useRankingLevels(): RankingLevel[] | null {
  return useContext(RankingLevelsContext);
}

// ============================================================
// Provider
// ============================================================

/**
 * Provides ranking level thresholds (from /api/common/rankingLevel) to the app.
 *
 * - Fetches once when the user logs in, caches for 24h.
 * - Resets to null on logout.
 * - Silently returns null on failure (non-critical data).
 */
export function RankingLevelsProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const [levels, setLevels] = useState<RankingLevel[] | null>(null);

  useEffect(() => {
    if (!session) {
      // Logged out — reset
      setLevels(null);
      return;
    }

    let cancelled = false;

    async function load() {
      // Try cache first
      const cached = await cacheGetWithTTL<RankingLevel[]>(CACHE_KEY, CACHE_TTL_MS);
      if (cached && cached.length > 0) {
        if (!cancelled) setLevels(cached);
        return;
      }

      // Cache miss — fetch from API
      try {
        const fetched = await getRankingLevels();
        if (cancelled) return;

        if (fetched.length > 0) {
          setLevels(fetched);
          await cacheSetWithTTL(CACHE_KEY, fetched);
        }
      } catch {
        // Silently ignore — ranking levels are non-critical
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <RankingLevelsContext.Provider value={levels}>
      {children}
    </RankingLevelsContext.Provider>
  );
}
