// ============================================================
// Types
// ============================================================

/**
 * A fully typed match item parsed from the FFBaD API response.
 * All fields are optional since the API may not return every field.
 */
export interface MatchItem {
  id: string;
  date?: string;
  opponent?: string;
  opponentLicence?: string;
  opponent2?: string;
  opponent2Licence?: string;
  partner?: string;
  partnerLicence?: string;
  score?: string;
  discipline?: 'simple' | 'double' | 'mixte';
  round?: string;
  tournament?: string;
  tournamentDate?: string;
  isWin?: boolean;
  pointsImpact?: number;
  setScores?: string[];
  duration?: string;
  /** Raw ISO date string for season computation (display date may be formatted) */
  _rawDate?: string;
}

/**
 * A section of matches grouped by tournament for SectionList rendering.
 */
export interface MatchSection {
  title: string;
  date: string;
  data: MatchItem[];
}

/**
 * A discipline group within a tournament section (level 2 accordion).
 */
export interface DisciplineGroup {
  discipline: 'simple' | 'double' | 'mixte';
  wins: number;
  losses: number;
  points: number;
  matches: MatchItem[];
  /** Raw result items for lazy detail loading — kept from API response */
  _rawItems?: Array<Record<string, unknown>>;
}

/**
 * A tournament section with nested discipline groups (two-level accordion).
 */
export interface TournamentSection {
  title: string;
  date: string;
  totalPoints: number;
  disciplines: DisciplineGroup[];
}

/**
 * Win/loss statistics computed from a set of matches.
 */
export interface WinLossStats {
  wins: number;
  losses: number;
  total: number;
  winPercentage: number;
}

/**
 * Discipline filter options for the match history screen.
 */
export type DisciplineFilter = 'all' | 'simple' | 'double' | 'mixte';

/**
 * A single set score split into per-team values.
 */
export interface SplitScore {
  userScore: number;
  opponentScore: number;
  userWonSet: boolean;
}

// ============================================================
// Parsing
// ============================================================

/**
 * Map a discipline code from the API to a typed discipline value.
 * FFBaD uses single-letter codes: "S" (simple), "D" (double), "M" (mixte).
 */
function parseDiscipline(
  value: string | undefined
): 'simple' | 'double' | 'mixte' | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase().trim();
  if (upper === 'S' || upper === 'SIMPLE') return 'simple';
  if (upper === 'D' || upper === 'DOUBLE') return 'double';
  if (upper === 'M' || upper === 'MIXTE') return 'mixte';
  return undefined;
}

/**
 * Determine win/loss from API result indicator fields.
 * Checks multiple possible field names for robustness.
 */
function parseWinLoss(raw: Record<string, unknown>): boolean | undefined {
  const resultField =
    (raw.Resultat as string) ??
    (raw.Result as string) ??
    (raw.VD as string) ??
    undefined;

  if (!resultField) return undefined;

  const upper = resultField.toUpperCase().trim();
  if (upper === 'V' || upper === 'VICTOIRE' || upper === 'WIN') return true;
  if (upper === 'D' || upper === 'DEFAITE' || upper === 'LOSS') return false;
  return undefined;
}

/**
 * Parse a numeric points value from the API (may be string or number).
 */
function parsePoints(value: unknown): number | undefined {
  if (value == null) return undefined;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? undefined : num;
}

/**
 * Parse set scores string into an array.
 * Expected format: "21-15 18-21 21-12" or "21-15, 18-21, 21-12"
 */
function parseSetScores(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  // Split on " / " first (detail API format: "21-17 / 21-18"), then spaces/commas
  const sets = value
    .split(/\s*\/\s*|\s*,\s*|\s+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+-\d+$/.test(s));
  return sets.length > 0 ? sets : undefined;
}

// ============================================================
// Conversion
// ============================================================

/**
 * Convert a raw API result item to a fully typed MatchItem.
 *
 * Handles field name variations and missing data gracefully.
 * Uses the same win/loss detection pattern as the dashboard toMatchPreview.
 */
export function toFullMatchItem(
  raw: Record<string, unknown>,
  index: number
): MatchItem {
  // Use formatted date for display, raw date for season computation
  const date = (raw.Date as string) ?? undefined;
  // _rawDate is the ISO date string preserved by the API transform
  const rawDate = (raw._rawDate as string) ?? (raw.date as string) ?? date;
  const tournament =
    (raw.Epreuve as string) ?? (raw.Competition as string) ?? undefined;

  return {
    id: `${rawDate ?? 'unknown'}-${index}`,
    date,
    opponent: (raw.Adversaire as string) ?? undefined,
    opponentLicence: (raw.AdversaireLicence as string) ?? undefined,
    opponent2: (raw.Adversaire2 as string) ?? undefined,
    opponent2Licence: (raw.Adversaire2Licence as string) ?? undefined,
    partner: (raw.Partenaire as string) ?? undefined,
    partnerLicence: (raw.PartenaireLicence as string) ?? undefined,
    score: (raw.Score as string) ?? undefined,
    discipline: parseDiscipline(raw.Discipline as string | undefined),
    round: (raw.Tour as string) ?? undefined,
    tournament,
    tournamentDate: (raw.DateCompetition as string) ?? undefined,
    isWin: parseWinLoss(raw),
    pointsImpact: parsePoints(raw.Points),
    setScores: parseSetScores(raw.Sets),
    duration: (raw.Duree as string) ?? undefined,
    // Store raw ISO date for season computation
    _rawDate: rawDate,
  };
}

// ============================================================
// Grouping
// ============================================================

/**
 * Group matches by tournament name into sections for SectionList.
 *
 * Each section has a title (tournament name) and date.
 * Sections are sorted by date descending (most recent first).
 * Matches within sections are kept in their original order.
 */
export function groupByTournament(matches: MatchItem[]): MatchSection[] {
  const groups = new Map<string, MatchItem[]>();

  for (const match of matches) {
    const key = match.tournament ?? 'unknown';
    const existing = groups.get(key);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(key, [match]);
    }
  }

  const sections: MatchSection[] = Array.from(groups.entries()).map(
    ([tournament, data]) => ({
      title: tournament === 'unknown' ? '' : tournament,
      date: data[0]?.tournamentDate ?? data[0]?.date ?? '',
      data,
    })
  );

  // Sort sections by date descending (most recent first)
  sections.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return sections;
}

// ============================================================
// Filtering
// ============================================================

/**
 * Filter matches by discipline.
 * Returns all matches when filter is 'all'.
 * Matches with undefined discipline are included in 'all' only.
 */
export function filterByDiscipline(
  matches: MatchItem[],
  discipline: DisciplineFilter
): MatchItem[] {
  if (!Array.isArray(matches)) return [];
  if (discipline === 'all') return matches;
  return matches.filter((m) => m.discipline === discipline);
}

/**
 * Filter matches by French badminton season.
 *
 * Season format: "2025-2026" (September 2025 to August 2026).
 * Matches without a date are excluded from results.
 */
export function filterBySeason(
  matches: MatchItem[],
  season: string
): MatchItem[] {
  return matches.filter((m) => {
    const dateStr = m._rawDate ?? m.date;
    if (!dateStr) return false;
    return getSeasonFromDate(dateStr) === season;
  });
}

// ============================================================
// Statistics
// ============================================================

/**
 * Compute win/loss statistics from a set of matches.
 *
 * Only matches with a known isWin value are counted.
 * winPercentage is 0-100, rounded to nearest integer.
 */
export function computeWinLossStats(matches: MatchItem[]): WinLossStats {
  const withResult = matches.filter((m) => m.isWin !== undefined);
  const wins = withResult.filter((m) => m.isWin === true).length;
  const losses = withResult.filter((m) => m.isWin === false).length;
  const total = withResult.length;
  const winPercentage =
    total > 0 ? Math.round((wins / total) * 100) : 0;

  return { wins, losses, total, winPercentage };
}

// ============================================================
// Season Detection
// ============================================================

/**
 * Determine the French badminton season from a date string.
 *
 * French badminton season runs September 1 to August 31.
 * - September through December -> current year to next year (e.g., "2025-2026")
 * - January through August -> previous year to current year (e.g., "2024-2025")
 */
export function getSeasonFromDate(dateStr: string): string {
  let date = new Date(dateStr);

  // Try parsing French format DD/MM/YYYY if ISO fails
  if (isNaN(date.getTime())) {
    const frMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (frMatch) {
      date = new Date(parseInt(frMatch[3]), parseInt(frMatch[2]) - 1, parseInt(frMatch[1]));
    }
  }

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: 0=Jan, 8=Sep

  // September (8) through December (11) -> current year to next year
  // January (0) through August (7) -> previous year to current year
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Get the current French badminton season based on today's date.
 * Season runs September through August.
 */
export function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Get all available seasons from match dates, sorted descending (most recent first).
 */
export function getAvailableSeasons(matches: MatchItem[]): string[] {
  const seasons = new Set<string>();

  for (const match of matches) {
    const dateStr = match._rawDate ?? match.date;
    if (dateStr) {
      const season = getSeasonFromDate(dateStr);
      if (season) {
        seasons.add(season);
      }
    }
  }

  return Array.from(seasons).sort().reverse();
}

// ============================================================
// Discipline Counts
// ============================================================

/**
 * Count matches per discipline for chip badge display.
 * 'all' count includes all matches regardless of discipline.
 */
export function getDisciplineCounts(
  matches: MatchItem[]
): Record<DisciplineFilter, number> {
  const counts: Record<DisciplineFilter, number> = {
    all: matches.length,
    simple: 0,
    double: 0,
    mixte: 0,
  };

  for (const match of matches) {
    if (match.discipline === 'simple') counts.simple++;
    else if (match.discipline === 'double') counts.double++;
    else if (match.discipline === 'mixte') counts.mixte++;
  }

  return counts;
}

// ============================================================
// Nested Grouping (two-level accordion)
// ============================================================

const DISCIPLINE_ORDER: Array<'simple' | 'double' | 'mixte'> = ['simple', 'double', 'mixte'];

/**
 * Detect if a tournament name refers to Interclub competitions.
 * Interclubs span multiple months, so their sort date should be the latest match date.
 */
function isInterclub(name: string): boolean {
  return /interclub/i.test(name);
}

/**
 * Parse a date string (ISO or DD/MM/YYYY) to a comparable ISO string for sorting.
 * Returns empty string if unparseable.
 */
function toSortableDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  // ISO format
  if (dateStr.includes('-') && dateStr.length >= 10) return dateStr.slice(0, 10);
  // French format DD/MM/YYYY
  const fr = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
  return '';
}

/**
 * Group matches into a two-level structure: Tournament -> Discipline -> Matches.
 *
 * Tournaments are sorted by date descending. For interclubs, the sort date is
 * the latest match date within that tournament.
 * Disciplines within each tournament are in fixed order: Simple, Double, Mixed.
 */
export function groupByTournamentNested(matches: MatchItem[]): TournamentSection[] {
  if (!Array.isArray(matches)) return [];
  // Group by tournament name
  const groups = new Map<string, MatchItem[]>();
  for (const match of matches) {
    const key = match.tournament ?? 'unknown';
    const existing = groups.get(key);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(key, [match]);
    }
  }

  const sections: TournamentSection[] = [];

  for (const [tournament, tournamentMatches] of groups) {
    const title = tournament === 'unknown' ? '' : tournament;
    const interclub = isInterclub(title);

    // Compute tournament date
    let date: string;
    if (interclub) {
      // Use latest match date for interclubs
      const sortableDates = tournamentMatches
        .map((m) => toSortableDate(m._rawDate ?? m.date))
        .filter(Boolean);
      const latestISO = sortableDates.sort().reverse()[0] ?? '';
      // Format back to DD/MM/YYYY for display
      if (latestISO) {
        const [y, mo, d] = latestISO.split('-');
        date = `${d}/${mo}/${y}`;
      } else {
        date = tournamentMatches[0]?.tournamentDate ?? tournamentMatches[0]?.date ?? '';
      }
    } else {
      date = tournamentMatches[0]?.tournamentDate ?? tournamentMatches[0]?.date ?? '';
    }

    // Group by discipline
    const byDisc = new Map<'simple' | 'double' | 'mixte', MatchItem[]>();
    for (const m of tournamentMatches) {
      if (!m.discipline) continue;
      const existing = byDisc.get(m.discipline);
      if (existing) {
        existing.push(m);
      } else {
        byDisc.set(m.discipline, [m]);
      }
    }

    const disciplines: DisciplineGroup[] = [];
    for (const disc of DISCIPLINE_ORDER) {
      const discMatches = byDisc.get(disc);
      if (!discMatches) continue;

      const wins = discMatches.filter((m) => m.isWin === true).length;
      const losses = discMatches.filter((m) => m.isWin === false).length;
      const points = discMatches.reduce((sum, m) => sum + (m.pointsImpact ?? 0), 0);

      disciplines.push({ discipline: disc, wins, losses, points, matches: discMatches });
    }

    const totalPoints = disciplines.reduce((sum, d) => sum + d.points, 0);

    sections.push({ title, date, totalPoints, disciplines });
  }

  // Sort by date descending
  sections.sort((a, b) => {
    const dateA = toSortableDate(a.date);
    const dateB = toSortableDate(b.date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.localeCompare(dateA);
  });

  return sections;
}

// ============================================================
// Score Splitting
// ============================================================

/**
 * Split set scores into per-team values for scoreboard display.
 *
 * Parses match.setScores (["21-17", "21-18"]) or falls back to match.score.
 * Returns null if no parseable scores are found.
 */
export function splitSetScores(match: MatchItem): SplitScore[] | null {
  const rawSets = match.setScores ?? (match.score ? match.score.split(/[\s,]+/).filter((s) => s.includes('-') && /^\d+-\d+$/.test(s)) : null);

  if (!rawSets || rawSets.length === 0) return null;

  return rawSets.map((set) => {
    const [a, b] = set.split('-').map(Number);
    return {
      userScore: a,
      opponentScore: b,
      userWonSet: a > b,
    };
  });
}
