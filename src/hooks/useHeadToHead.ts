import { useState, useEffect, useCallback, useRef } from 'react';
import { getResultsByLicence, getMatchDetailsForBrackets } from '../api/ffbad';
import { useSession } from '../auth/context';
import { cacheGetWithTTL, cacheSetWithTTL, CACHE_PREFIX } from '../cache/storage';
import { toFullMatchItem, type MatchItem } from '../utils/matchHistory';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Types
// ============================================================

export interface HeadToHeadData {
  /** Matches where target was an opponent */
  againstMatches: MatchItem[];
  /** Matches where target was a partner */
  togetherMatches: MatchItem[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Read all detail cache entries for a given personId from AsyncStorage.
 * Detail keys follow pattern: detail:{personId}:{tournament}:{discipline}
 */
async function readAllDetailCache(personId: string): Promise<MatchItem[]> {
  const prefix = `${CACHE_PREFIX}detail:${personId}:`;
  const allKeys = await AsyncStorage.getAllKeys();
  const detailKeys = allKeys.filter((k) => k.startsWith(prefix));

  if (detailKeys.length === 0) return [];

  const entries = await AsyncStorage.multiGet(detailKeys);
  const matches: MatchItem[] = [];

  for (const [, raw] of entries) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { data: MatchItem[]; timestamp: number };
      if (parsed.data && Array.isArray(parsed.data)) {
        matches.push(...parsed.data);
      }
    } catch {
      // Skip malformed entries
    }
  }

  return matches;
}

/**
 * Fetch the user's match results and load ALL detail data.
 * This ensures opponent/partner licence fields are populated.
 */
async function fetchAndLoadAllDetails(
  personId: string,
  licence: string
): Promise<MatchItem[]> {
  const response = await getResultsByLicence(licence, personId);
  const rawItems = response._rawItems ?? [];

  if (rawItems.length === 0) return [];

  // Deduplicate raw items by bracket identity
  const seen = new Set<string>();
  const uniqueRawItems = rawItems.filter((item) => {
    const date = (item.date as string) ?? '';
    const bracketId = String(item.bracketId ?? '');
    const disciplineId = String(item.disciplineId ?? '');
    const key = `${date}|${bracketId}|${disciplineId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Load details for all brackets (parallel, uses existing cache)
  const detailed = await getMatchDetailsForBrackets(uniqueRawItems, personId);
  return detailed.map((item, index) =>
    toFullMatchItem(item as Record<string, unknown>, index)
  );
}

/**
 * Filter match items for a specific opponent/partner by licence.
 * Returns raw MatchItem arrays so the UI can group them with groupByTournamentNested.
 */
function filterMatchesForLicence(
  allMatches: MatchItem[],
  targetLicence: string
): { against: MatchItem[]; together: MatchItem[] } {
  const against: MatchItem[] = [];
  const together: MatchItem[] = [];
  const target = targetLicence.trim();

  for (const m of allMatches) {
    if (m.opponentLicence === target || m.opponent2Licence === target) {
      against.push(m);
      continue;
    }
    if (m.partnerLicence === target) {
      together.push(m);
    }
  }

  return { against, together };
}

// ============================================================
// Hook
// ============================================================

const H2H_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Head-to-head data against a specific player, built by scanning
 * the logged-in user's match detail cache for opponent/partner licences.
 *
 * Returns raw MatchItem[] so the UI can reuse groupByTournamentNested
 * and the same tournament accordion as the Matches tab.
 */
export function useHeadToHead(theirLicence: string | null): HeadToHeadData {
  const { session } = useSession();
  const [againstMatches, setAgainstMatches] = useState<MatchItem[]>([]);
  const [togetherMatches, setTogetherMatches] = useState<MatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchTriggered = useRef(false);

  const applyResults = useCallback((parsed: { against: MatchItem[]; together: MatchItem[] }) => {
    setAgainstMatches(parsed.against);
    setTogetherMatches(parsed.together);
  }, []);

  const fetchData = useCallback(async () => {
    if (!theirLicence || !session?.personId || !session?.licence) return;

    setIsLoading(true);
    setError(null);

    const cacheKey = `h2h:${session.personId}:${theirLicence}`;

    try {
      // Check H2H result cache first
      const cached = await cacheGetWithTTL<{ against: MatchItem[]; together: MatchItem[] }>(cacheKey, H2H_CACHE_TTL);
      if (cached) {
        applyResults(cached);
        setIsLoading(false);
        return;
      }

      // Phase 1: Try reading from existing match detail cache
      const cachedDetails = await readAllDetailCache(session.personId);
      if (cachedDetails.length > 0) {
        const parsed = filterMatchesForLicence(cachedDetails, theirLicence);
        applyResults(parsed);
        cacheSetWithTTL(cacheKey, parsed);
        if (parsed.against.length > 0 || parsed.together.length > 0) {
          setIsLoading(false);
          return;
        }
      }

      // Phase 2: Fetch all match details from API (only once per mount)
      if (fetchTriggered.current) {
        setIsLoading(false);
        return;
      }
      fetchTriggered.current = true;

      const allMatches = await fetchAndLoadAllDetails(session.personId, session.licence);
      const parsed = filterMatchesForLicence(allMatches, theirLicence);
      applyResults(parsed);
      cacheSetWithTTL(cacheKey, parsed);
    } catch {
      setError('Unable to load head-to-head data');
    } finally {
      setIsLoading(false);
    }
  }, [theirLicence, session?.personId, session?.licence, applyResults]);

  useEffect(() => {
    fetchTriggered.current = false;
    fetchData();
  }, [fetchData]);

  return {
    againstMatches,
    togetherMatches,
    isLoading,
    error,
  };
}
