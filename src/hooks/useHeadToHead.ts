import { useState, useEffect, useCallback } from 'react';
import { getPlayerOpposition } from '../api/ffbad';
import { useSession } from '../auth/context';
import { cacheGetWithTTL, cacheSetWithTTL } from '../cache/storage';

// ============================================================
// Types
// ============================================================

interface DisciplineRecord {
  wins: number;
  losses: number;
}

export interface H2HStats {
  wins: number;
  losses: number;
  winRate: number;
  byDiscipline: {
    simple: DisciplineRecord;
    double: DisciplineRecord;
    mixte: DisciplineRecord;
  };
  lastPlayed: string | null;
  matchCount: number;
}

export interface H2HMatch {
  date: string;
  tournament: string;
  discipline: 'simple' | 'double' | 'mixte';
  isWin: boolean;
  score: string;
  points: number | null;
  relation: 'against' | 'together';
  opponents?: string;
}

export interface HeadToHeadData {
  against: H2HStats | null;
  together: H2HStats | null;
  againstMatches: H2HMatch[];
  togetherMatches: H2HMatch[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// Helpers
// ============================================================

function parseDiscipline(raw: string): 'simple' | 'double' | 'mixte' {
  const lower = (raw ?? '').toLowerCase();
  if (lower.includes('simple')) return 'simple';
  if (lower.includes('double')) return 'double';
  if (lower.includes('mixte')) return 'mixte';
  return 'simple';
}

function computeStats(matches: H2HMatch[]): H2HStats {
  const wins = matches.filter((m) => m.isWin).length;
  const losses = matches.length - wins;
  const byDiscipline = {
    simple: { wins: 0, losses: 0 },
    double: { wins: 0, losses: 0 },
    mixte: { wins: 0, losses: 0 },
  };

  for (const m of matches) {
    if (m.isWin) {
      byDiscipline[m.discipline].wins++;
    } else {
      byDiscipline[m.discipline].losses++;
    }
  }

  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));

  return {
    wins,
    losses,
    winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
    byDiscipline,
    lastPlayed: sorted[0]?.date ?? null,
    matchCount: matches.length,
  };
}

/**
 * Parse the raw /playerOpposition response into H2H matches.
 *
 * The API response shape is discovered at runtime. This function
 * handles the most likely format: an array of match objects.
 * If the format is unexpected, returns empty arrays.
 */
function parseOppositionResponse(
  data: unknown,
  _myPersonId: string
): { against: H2HMatch[]; together: H2HMatch[] } {
  const against: H2HMatch[] = [];
  const together: H2HMatch[] = [];

  if (!data || typeof data !== 'object') {
    return { against, together };
  }

  // Handle array response (list of matches)
  const items = Array.isArray(data) ? data : [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;

    const date = String(raw.date ?? raw.Date ?? raw.matchDate ?? '');
    const tournament = String(raw.name ?? raw.tournamentName ?? raw.eventName ?? '');
    const discipline = parseDiscipline(String(raw.discipline ?? raw.Discipline ?? ''));
    const score = String(raw.score ?? raw.Score ?? '');
    const points = typeof raw.winPoint === 'number' ? raw.winPoint
      : typeof raw.WinPoint === 'number' ? raw.WinPoint
      : null;

    // Determine if this was a win for the current user
    const isWin = raw.isWin === true || raw.IsWinner === '1' || raw.isWinner === true
      || String(raw.status ?? '').toLowerCase() === 'green';

    // Determine if opponent was partner or opponent
    const relation: 'against' | 'together' =
      raw.relation === 'partner' || raw.isPartner === true
        ? 'together'
        : 'against';

    const opponents = raw.opponents ? String(raw.opponents) : undefined;

    const match: H2HMatch = {
      date,
      tournament,
      discipline,
      isWin,
      score,
      points: points as number | null,
      relation,
      opponents,
    };

    if (relation === 'together') {
      together.push(match);
    } else {
      against.push(match);
    }
  }

  return { against, together };
}

// ============================================================
// Hook
// ============================================================

const H2H_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useHeadToHead(theirPersonId: string | null): HeadToHeadData {
  const { session } = useSession();
  const [against, setAgainst] = useState<H2HStats | null>(null);
  const [together, setTogether] = useState<H2HStats | null>(null);
  const [againstMatches, setAgainstMatches] = useState<H2HMatch[]>([]);
  const [togetherMatches, setTogetherMatches] = useState<H2HMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!theirPersonId || !session?.personId) return;

    setIsLoading(true);
    setError(null);

    const cacheKey = `h2h:${session.personId}:${theirPersonId}`;

    try {
      // Check cache first (TTL checked on read)
      const cached = await cacheGetWithTTL<{ against: H2HMatch[]; together: H2HMatch[] }>(cacheKey, H2H_CACHE_TTL);
      if (cached) {
        setAgainstMatches(cached.against);
        setTogetherMatches(cached.together);
        setAgainst(cached.against.length > 0 ? computeStats(cached.against) : null);
        setTogether(cached.together.length > 0 ? computeStats(cached.together) : null);
        setIsLoading(false);
        return;
      }

      // Fetch from API
      const data = await getPlayerOpposition(theirPersonId);
      const parsed = parseOppositionResponse(data, session.personId);

      setAgainstMatches(parsed.against);
      setTogetherMatches(parsed.together);
      setAgainst(parsed.against.length > 0 ? computeStats(parsed.against) : null);
      setTogether(parsed.together.length > 0 ? computeStats(parsed.together) : null);

      // Cache the result (timestamp stored automatically by cacheSetWithTTL)
      cacheSetWithTTL(cacheKey, parsed);
    } catch {
      setError('Unable to load head-to-head data');
    } finally {
      setIsLoading(false);
    }
  }, [theirPersonId, session?.personId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    against,
    together,
    againstMatches,
    togetherMatches,
    isLoading,
    error,
  };
}
