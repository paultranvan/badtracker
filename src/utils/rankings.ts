import type { PlayerProfile } from '../api/ffbad';

// ============================================================
// Types
// ============================================================

export interface RankBoundary {
  rank: string;
  minCpph: number;
}

export interface RankGaps {
  toNext: number | null;
  toPrev: number | null;
  nextRank: string | null;
  prevRank: string | null;
}

export interface BestRanking {
  discipline: 'simple' | 'double' | 'mixte';
  classement: string;
  cpph: number;
}

// ============================================================
// CPPH Rank Boundaries
// ============================================================

/**
 * French badminton CPPH ranking boundaries, ordered highest to lowest.
 * These are approximate values from FFBaD classification rules.
 *
 * Ranking hierarchy: N1 > N2 > N3 > R4 > R5 > R6 > D7 > D8 > D9 > P10 > P11 > P12 > NC
 */
export const RANK_BOUNDARIES: RankBoundary[] = [
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
// Rank Gap Computation
// ============================================================

/**
 * Compute the CPPH gap to the next higher rank and the margin above the rank below.
 *
 * @param cpph - Current CPPH points (undefined if unranked with no data)
 * @param currentRank - Current rank label (e.g., "P11", "D8", "NC")
 * @returns toNext: points needed to reach next rank, toPrev: margin above lower rank
 */
export function getRankGaps(
  cpph: number | undefined,
  currentRank: string
): RankGaps {
  if (cpph == null) {
    return { toNext: null, toPrev: null, nextRank: null, prevRank: null };
  }

  const currentIdx = RANK_BOUNDARIES.findIndex(
    (b) => b.rank.toUpperCase() === currentRank.toUpperCase()
  );

  // Rank not found in boundaries — graceful degradation
  if (currentIdx === -1) {
    return { toNext: null, toPrev: null, nextRank: null, prevRank: null };
  }

  // Next higher rank (lower index in array)
  const nextBoundary = currentIdx > 0 ? RANK_BOUNDARIES[currentIdx - 1] : null;
  // Previous lower rank (higher index in array)
  const prevBoundary =
    currentIdx < RANK_BOUNDARIES.length - 1
      ? RANK_BOUNDARIES[currentIdx + 1]
      : null;

  return {
    toNext: nextBoundary ? Math.max(0, nextBoundary.minCpph - cpph) : null,
    toPrev: prevBoundary ? Math.max(0, cpph - prevBoundary.minCpph) : null,
    nextRank: nextBoundary?.rank ?? null,
    prevRank: prevBoundary?.rank ?? null,
  };
}

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
