import { RANK_BOUNDARIES, getBestRanking } from './rankings';

// ============================================================
// Types
// ============================================================

/**
 * Normalized leaderboard entry for a single club member.
 * Position is 1-based and assigned after sorting by bestRank.
 */
export interface LeaderboardEntry {
  licence: string;
  nom: string;
  prenom: string;
  /** Best ranking category across all disciplines, e.g. "P10", "D7", "NC" */
  bestRank: string;
  /** 1-based position after sorting (1 = best rank) */
  position: number;
  simpleRank: string;
  simpleCpph?: number;
  doubleRank: string;
  doubleCpph?: number;
  mixteRank: string;
  mixteCpph?: number;
  /** 'M' for male, 'F' for female, undefined if unknown */
  sex?: string;
}

export type ClubDisciplineFilter = 'all' | 'simple' | 'double' | 'mixte';
export type ClubGenderFilter = 'all' | 'M' | 'F';

// ============================================================
// Helpers
// ============================================================

/**
 * Parse a CPPH value from the API response (may be string or number).
 * Returns undefined if not a valid number.
 */
function parseCpph(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Build a ranking entry from a classement + CPPH pair.
 * Returns undefined if no classement is available.
 */
function buildRanking(
  classement: string | undefined,
  cpph: string | number | undefined
): { classement: string; cpph?: number } | undefined {
  if (!classement) return undefined;
  return { classement, cpph: parseCpph(cpph) };
}

// ============================================================
// Exports
// ============================================================

/**
 * Get the sort index for a rank string using RANK_BOUNDARIES.
 *
 * Lower index = better rank (N1 = 0, N2 = 1, ... NC = 12).
 * Returns RANK_BOUNDARIES.length if rank is not found (sorts last).
 */
export function getRankSortIndex(classement: string): number {
  const upper = classement.toUpperCase().trim();
  const idx = RANK_BOUNDARIES.findIndex(
    (b) => b.rank.toUpperCase() === upper
  );
  return idx === -1 ? RANK_BOUNDARIES.length : idx;
}

/**
 * Normalize raw API items from ws_getrankingallbyclub into sorted LeaderboardEntry array.
 *
 * Processing steps:
 * 1. Cast each item to Record<string, unknown>
 * 2. Filter items without a truthy Licence field
 * 3. Build per-discipline ranking objects matching PlayerProfile['rankings'] shape
 * 4. Call getBestRanking() to find the best discipline ranking
 * 5. Sort ascending by getRankSortIndex (best rank first)
 * 6. Assign 1-based position after sorting
 */
export function normalizeToLeaderboard(rawItems: unknown[]): LeaderboardEntry[] {
  const entries = rawItems
    .map((item) => item as Record<string, unknown>)
    .filter((item) => !!item.Licence)
    .map((item) => {
      const rankings = {
        simple: buildRanking(
          item.ClassementSimple as string | undefined,
          item.CPPHSimple as string | number | undefined
        ),
        double: buildRanking(
          item.ClassementDouble as string | undefined,
          item.CPPHDouble as string | number | undefined
        ),
        mixte: buildRanking(
          item.ClassementMixte as string | undefined,
          item.CPPHMixte as string | number | undefined
        ),
      };

      const best = getBestRanking(rankings);
      // If CPPH data is available, use it. Otherwise compare rank levels directly.
      let bestRank: string;
      if (best?.classement) {
        bestRank = best.classement;
      } else {
        const candidates = [
          item.ClassementSimple as string | undefined,
          item.ClassementDouble as string | undefined,
          item.ClassementMixte as string | undefined,
        ].filter((c): c is string => !!c);
        if (candidates.length === 0) {
          bestRank = 'NC';
        } else {
          bestRank = candidates.reduce((a, b) =>
            getRankSortIndex(a) <= getRankSortIndex(b) ? a : b
          );
        }
      }

      return {
        licence: item.Licence as string,
        nom: (item.Nom as string | undefined) ?? '',
        prenom: (item.Prenom as string | undefined) ?? '',
        bestRank,
        simpleRank: rankings.simple?.classement ?? 'NC',
        simpleCpph: rankings.simple?.cpph,
        doubleRank: rankings.double?.classement ?? 'NC',
        doubleCpph: rankings.double?.cpph,
        mixteRank: rankings.mixte?.classement ?? 'NC',
        mixteCpph: rankings.mixte?.cpph,
        sex: (item.Sex as string | undefined) ?? undefined,
      };
    });

  // Sort: lower RANK_BOUNDARIES index = better rank = comes first
  entries.sort(
    (a, b) => getRankSortIndex(a.bestRank) - getRankSortIndex(b.bestRank)
  );

  // Add 1-based position after sorting
  return entries.map((entry, index) => ({ ...entry, position: index + 1 }));
}

/**
 * Sort and re-position leaderboard entries by a specific discipline.
 * 'all' uses bestRank (default behavior).
 */
export function sortLeaderboardByDiscipline(
  entries: LeaderboardEntry[],
  discipline: ClubDisciplineFilter
): LeaderboardEntry[] {
  const getRank = (entry: LeaderboardEntry): string => {
    switch (discipline) {
      case 'simple': return entry.simpleRank;
      case 'double': return entry.doubleRank;
      case 'mixte': return entry.mixteRank;
      default: return entry.bestRank;
    }
  };

  const sorted = [...entries].sort(
    (a, b) => getRankSortIndex(getRank(a)) - getRankSortIndex(getRank(b))
  );

  return sorted.map((entry, index) => ({ ...entry, position: index + 1 }));
}

/**
 * Get the display rank for an entry based on the active discipline filter.
 */
export function getDisplayRank(entry: LeaderboardEntry, discipline: ClubDisciplineFilter): string {
  switch (discipline) {
    case 'simple': return entry.simpleRank;
    case 'double': return entry.doubleRank;
    case 'mixte': return entry.mixteRank;
    default: return entry.bestRank;
  }
}

/**
 * Filter leaderboard entries by gender, then re-assign 1-based positions.
 */
export function filterByGender(
  entries: LeaderboardEntry[],
  gender: ClubGenderFilter
): LeaderboardEntry[] {
  if (gender === 'all') return entries;
  const filtered = entries.filter((e) => e.sex === gender);
  return filtered.map((entry, index) => ({ ...entry, position: index + 1 }));
}
