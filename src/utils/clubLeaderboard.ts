// ============================================================
// Types
// ============================================================

export interface DisciplineRanking {
  subLevel: string;
  rate: number | null;
  rank: number;
}

export interface LeaderboardEntry {
  licence: string;
  personId: number;
  name: string;
  category: string;
  sex: 'M' | 'F';
  simple: DisciplineRanking | null;
  double: DisciplineRanking | null;
  mixte: DisciplineRanking | null;
  bestRate: number | null;
  bestSubLevel: string;
  bestDiscipline: 'simple' | 'double' | 'mixte' | null;
  position: number;
}

export type ClubDisciplineFilter = 'all' | 'simple' | 'double' | 'mixte';
export type ClubGenderFilter = 'all' | 'M' | 'F';

// ============================================================
// Raw API item shape from /api/search/tops
// ============================================================

export interface TopsApiItem {
  rank: number;
  rate: number | null;
  realRate: number | null;
  subLevel: string;
  personId: number;
  name: string;
  licence: string;
  category: string;
  club: { id: number; name: string; acronym: string };
  frenchRank: number;
  federalRank: number;
  [key: string]: unknown;
}

type DisciplineNumber = 1 | 2 | 3 | 4 | 5 | 6;

const DISCIPLINE_MAP: Record<DisciplineNumber, { field: 'simple' | 'double' | 'mixte'; sex: 'M' | 'F' }> = {
  1: { field: 'simple', sex: 'M' },
  2: { field: 'simple', sex: 'F' },
  3: { field: 'double', sex: 'M' },
  4: { field: 'double', sex: 'F' },
  5: { field: 'mixte', sex: 'M' },
  6: { field: 'mixte', sex: 'F' },
};

// ============================================================
// Merge logic
// ============================================================

interface PartialPlayer {
  licence: string;
  personId: number;
  name: string;
  category: string;
  sex: 'M' | 'F';
  simple: DisciplineRanking | null;
  double: DisciplineRanking | null;
  mixte: DisciplineRanking | null;
}

/**
 * Merge responses from all 6 /api/search/tops calls into a single LeaderboardEntry[].
 */
export function mergeTopsResults(
  results: Array<[DisciplineNumber, TopsApiItem[]]>
): LeaderboardEntry[] {
  const byLicence = new Map<string, PartialPlayer>();

  for (const [discipline, items] of results) {
    const mapping = DISCIPLINE_MAP[discipline];
    if (!mapping) continue;

    for (const item of items) {
      if (!item.licence) continue;

      let player = byLicence.get(item.licence);
      if (!player) {
        player = {
          licence: item.licence,
          personId: item.personId,
          name: item.name,
          category: item.category,
          sex: mapping.sex,
          simple: null,
          double: null,
          mixte: null,
        };
        byLicence.set(item.licence, player);
      }

      if (item.category) player.category = item.category;
      if (item.name) player.name = item.name;

      player[mapping.field] = {
        subLevel: item.subLevel ?? '-',
        rate: item.rate ?? null,
        rank: item.rank,
      };
    }
  }

  const entries: LeaderboardEntry[] = Array.from(byLicence.values()).map((p) => {
    let bestRate: number | null = null;
    let bestSubLevel = 'NC';
    let bestDiscipline: 'simple' | 'double' | 'mixte' | null = null;

    for (const disc of ['simple', 'double', 'mixte'] as const) {
      const ranking = p[disc];
      if (ranking?.rate != null && (bestRate === null || ranking.rate > bestRate)) {
        bestRate = ranking.rate;
        bestSubLevel = ranking.subLevel;
        bestDiscipline = disc;
      }
    }

    return { ...p, bestRate, bestSubLevel, bestDiscipline, position: 0 };
  });

  entries.sort((a, b) => {
    if (a.bestRate === null && b.bestRate === null) return 0;
    if (a.bestRate === null) return 1;
    if (b.bestRate === null) return -1;
    return b.bestRate - a.bestRate;
  });

  return entries.map((entry, i) => ({ ...entry, position: i + 1 }));
}

// ============================================================
// Sort and filter
// ============================================================

function getSortRate(
  entry: LeaderboardEntry,
  discipline: ClubDisciplineFilter
): number | null {
  switch (discipline) {
    case 'simple': return entry.simple?.rate ?? null;
    case 'double': return entry.double?.rate ?? null;
    case 'mixte': return entry.mixte?.rate ?? null;
    default: return entry.bestRate;
  }
}

/**
 * Get the discipline key used for sorting (for sort indicator in UI).
 */
export function getSortDiscipline(
  entry: LeaderboardEntry,
  discipline: ClubDisciplineFilter
): 'simple' | 'double' | 'mixte' | null {
  switch (discipline) {
    case 'simple': return 'simple';
    case 'double': return 'double';
    case 'mixte': return 'mixte';
    default: return entry.bestDiscipline;
  }
}

/**
 * Sort leaderboard by the selected discipline's rate (descending).
 * Re-assigns 1-based positions after sorting.
 */
export function sortLeaderboardByDiscipline(
  entries: LeaderboardEntry[],
  discipline: ClubDisciplineFilter
): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const rateA = getSortRate(a, discipline);
    const rateB = getSortRate(b, discipline);
    if (rateA === null && rateB === null) return 0;
    if (rateA === null) return 1;
    if (rateB === null) return -1;
    return rateB - rateA;
  });

  return sorted.map((entry, i) => ({ ...entry, position: i + 1 }));
}

/**
 * Filter leaderboard entries by gender, then re-assign positions.
 */
export function filterByGender(
  entries: LeaderboardEntry[],
  gender: ClubGenderFilter
): LeaderboardEntry[] {
  if (gender === 'all') return entries;
  const filtered = entries.filter((e) => e.sex === gender);
  return filtered.map((entry, i) => ({ ...entry, position: i + 1 }));
}

// ============================================================
// Category abbreviation
// ============================================================

/**
 * Abbreviate a category string for compact display.
 * "Senior" -> "Sen", "Veteran 1" -> "V1", "Junior 2" -> "J2",
 * "Minime 1" -> "M1", "Cadet 2" -> "C2", "Benjamin 2" -> "B2",
 * "Poussin 2" -> "P2", "Minibad" -> "Mini"
 */
export function abbreviateCategory(category: string): string {
  if (!category) return '';
  const lower = category.toLowerCase();
  if (lower === 'senior') return 'Sen';
  if (lower === 'minibad') return 'Mini';

  const match = category.match(/^(\w+)\s+(\d+)$/);
  if (match) {
    const type = match[1].charAt(0).toUpperCase();
    return `${type}${match[2]}`;
  }

  return category.slice(0, 3);
}
