import type { PlayerProfile, RankingLevel } from '../api/ffbad';

// ============================================================
// Types
// ============================================================

export interface BestRanking {
  discipline: 'simple' | 'double' | 'mixte';
  classement: string;
  cpph: number;
}

// ============================================================
// CPPH Rank Boundaries
// ============================================================

/**
 * French badminton ranking hierarchy, ordered highest to lowest.
 * Used ONLY for sort order (e.g., club leaderboard). NOT for computing
 * points-to-next-rank — the 2025-2026 FFBaD system uses percentile-based
 * rank assignment, so there are no fixed CPPH thresholds.
 */
export const RANK_BOUNDARIES: Array<{ rank: string; minCpph: number }> = [
  { rank: 'N1', minCpph: 2000 },
  { rank: 'N2', minCpph: 1500 },
  { rank: 'N3', minCpph: 1000 },
  { rank: 'R4', minCpph: 700 },
  { rank: 'R5', minCpph: 500 },
  { rank: 'R6', minCpph: 300 },
  { rank: 'D7', minCpph: 200 },
  { rank: 'D8', minCpph: 100 },
  { rank: 'D9', minCpph: 50 },
  { rank: 'P10', minCpph: 25 },
  { rank: 'P11', minCpph: 10 },
  { rank: 'P12', minCpph: 1 },
  { rank: 'NC', minCpph: 0 },
];

// ============================================================
// Best Ranking Selection
// ============================================================

/**
 * Find the discipline with the highest CPPH among simple, double, mixte.
 *
 * @returns The best-ranked discipline, or null if all are undefined
 */
export function getBestRanking(
  rankings: PlayerProfile['rankings']
): BestRanking | null {
  const disciplines: Array<{
    key: 'simple' | 'double' | 'mixte';
    data: { classement: string; cpph?: number } | undefined;
  }> = [
    { key: 'simple', data: rankings.simple },
    { key: 'double', data: rankings.double },
    { key: 'mixte', data: rankings.mixte },
  ];

  let best: BestRanking | null = null;

  for (const { key, data } of disciplines) {
    if (data?.cpph != null) {
      if (best === null || data.cpph > best.cpph) {
        best = {
          discipline: key,
          classement: data.classement,
          cpph: data.cpph,
        };
      }
    }
  }

  return best;
}

// ============================================================
// Rank Label
// ============================================================

/**
 * Returns the display label for a rank.
 * Returns "NC" (Non Classe) for undefined, empty, or unknown values.
 */
export function getRankLabel(rank: string | undefined): string {
  if (!rank || rank.trim() === '') {
    return 'NC';
  }
  return rank;
}

// ============================================================
// Rank Progress
// ============================================================

export interface RankProgress {
  nextRank: string | null;
  prevRank: string | null;
  pointsToNext: number | null;
  pointsToDown: number | null;
  progressPercent: number;
}

/**
 * Compute a player's progress within their current rank band.
 *
 * @param cpph      Current CPPH in the given discipline
 * @param rank      Current rank code (e.g. "D8")
 * @param discipline Which discipline's thresholds to use
 * @param levels    Ranking levels sorted descending by rate (N1 first)
 * @returns Progress info, or null if levels are empty or rank not found
 */
export function getRankProgress(
  cpph: number,
  rank: string,
  discipline: 'simple' | 'double' | 'mixte',
  levels: RankingLevel[]
): RankProgress | null {
  if (levels.length === 0) return null;

  const idx = levels.findIndex((l) => l.rank === rank);
  if (idx === -1) return null;

  const current = levels[idx];
  const lowerBound = current.minRates[discipline];

  // Next rank up is the previous index (levels sorted descending)
  const nextUp = idx > 0 ? levels[idx - 1] : null;
  // Previous rank down is the next index
  const prevDown = idx < levels.length - 1 ? levels[idx + 1] : null;

  const upperBound = nextUp ? nextUp.minRates[discipline] : null;

  const pointsToNext = upperBound != null ? Math.max(0, upperBound - cpph) : null;
  const pointsToDown = Math.max(0, cpph - lowerBound);

  // Progress percent within the band [lowerBound, upperBound)
  let progressPercent: number;
  if (upperBound == null) {
    // Highest rank (N1) — no upper bound, show 100%
    progressPercent = 100;
  } else if (upperBound <= lowerBound) {
    // Degenerate case — avoid division by zero
    progressPercent = 0;
  } else {
    const range = upperBound - lowerBound;
    progressPercent = Math.min(100, Math.max(0, ((cpph - lowerBound) / range) * 100));
  }

  return {
    nextRank: nextUp?.rank ?? null,
    prevRank: prevDown?.rank ?? null,
    pointsToNext,
    pointsToDown,
    progressPercent,
  };
}
