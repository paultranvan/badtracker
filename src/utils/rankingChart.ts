// ============================================================
// Types
// ============================================================

/**
 * Discipline type for ranking evolution charts.
 */
export type Discipline = 'simple' | 'double' | 'mixte';

/**
 * A single data point on the ranking evolution chart.
 */
export interface ChartDataPoint {
  value: number;          // Rank numeric value (0=NC, 1=P12, ..., 12=N1)
  label?: string;         // X-axis date label (e.g., "Sep '25")
  date: string;           // ISO-ish date string for sorting
  rank: string;           // Rank at this point (e.g., "P10", "NC")
  isMilestone: boolean;   // True if rank changed from previous point
  discipline: Discipline;
}

/**
 * Chart data for a single discipline line.
 */
export interface DisciplineChartData {
  discipline: Discipline;
  color: string;
  points: ChartDataPoint[];
  milestones: ChartDataPoint[];  // Subset where isMilestone=true
  visible: boolean;
}

/**
 * Complete chart data for all disciplines.
 */
export interface ChartData {
  disciplines: DisciplineChartData[];
  dateRange: { start: string; end: string };
  maxValue: number;
  minValue: number;
}

// ============================================================
// Constants
// ============================================================

/**
 * Colors per discipline, matching existing app theme:
 * - Blue (#2563eb) for Simple — same as app primary color
 * - Green (#16a34a) for Double
 * - Amber (#d97706) for Mixte
 */
export const DISCIPLINE_COLORS: Record<Discipline, string> = {
  simple: '#2563eb',
  double: '#16a34a',
  mixte: '#d97706',
};

/**
 * Ordered rank labels from lowest (NC) to highest (N1).
 */
export const RANK_ORDER = ['NC', 'P12', 'P11', 'P10', 'D9', 'D8', 'D7', 'R6', 'R5', 'R4', 'N3', 'N2', 'N1'];

/**
 * Map rank labels to numeric values for Y-axis positioning.
 * Derived from RANK_ORDER to stay in sync. Higher value = better rank.
 */
export const RANK_VALUES: Record<string, number> = Object.fromEntries(
  RANK_ORDER.map((rank, index) => [rank, index])
);

/**
 * Convert a rank string to its numeric value. Returns 0 for unknown ranks.
 */
export function rankToValue(rank: string): number {
  return RANK_VALUES[rank.toUpperCase().trim()] ?? 0;
}

/**
 * French month abbreviations for chart axis labels.
 */
const FRENCH_MONTHS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];

// ============================================================
// Parsing Helpers
// ============================================================

/**
 * Parse a date string from FFBaD API response.
 *
 * Tries in order:
 * 1. ISO format (YYYY-MM-DD)
 * 2. French format (DD/MM/YYYY)
 * 3. Native Date constructor fallback
 * 4. Epoch (1970-01-01) if all parsing fails
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr || !dateStr.trim()) return new Date(0);

  // Try ISO format: YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }

  // Try French format: DD/MM/YYYY
  const frenchMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frenchMatch) {
    const [, day, month, year] = frenchMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to native Date constructor
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date(0) : fallback;
}

/**
 * Format a date string for chart X-axis labels.
 * Output: "Sep '25" (3-letter French month + 2-digit year)
 */
export function formatDateLabel(dateStr: string): string {
  const date = parseDate(dateStr);
  if (date.getTime() === 0) return '';

  const month = FRENCH_MONTHS[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${month} '${year}`;
}

// ============================================================
// Discipline Parsing
// ============================================================

/**
 * Map a discipline code from the API to a typed discipline value.
 * FFBaD uses single-letter codes: "S" (simple), "D" (double), "M" (mixte).
 * Also accepts full names for robustness.
 *
 * Same pattern as parseDiscipline in matchHistory.ts.
 */
function parseDiscipline(value: string | undefined): Discipline | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase().trim();
  if (upper === 'S' || upper === 'SIMPLE') return 'simple';
  if (upper === 'D' || upper === 'DOUBLE') return 'double';
  if (upper === 'M' || upper === 'MIXTE') return 'mixte';
  return undefined;
}

// ============================================================
// Milestone Detection
// ============================================================

/**
 * Detect milestone rank changes in a sorted array of chart data points.
 *
 * A milestone is when the rank at a data point differs from the previous point.
 * The first point is never a milestone (no previous to compare against).
 * Comparison is case-insensitive.
 *
 * @param points - Sorted chronologically
 * @returns Subset of points where rank changed
 */
export function detectMilestones(points: ChartDataPoint[]): ChartDataPoint[] {
  if (points.length < 2) return [];

  const milestones: ChartDataPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].rank.toUpperCase();
    const curr = points[i].rank.toUpperCase();
    if (prev !== curr) {
      // Mark the point as a milestone
      points[i] = { ...points[i], isMilestone: true };
      milestones.push(points[i]);
    }
  }

  return milestones;
}

// ============================================================
// NC Flat Line
// ============================================================

/**
 * Build a flat line at value 0 for NC (unranked) disciplines.
 * Creates 2 points spanning the date range so the chart renders a visible flat line.
 *
 * @param dateRange - Start and end dates from disciplines that have data
 * @param discipline - Which discipline this flat line represents
 */
export function buildFlatLineForNC(
  dateRange: { start: string; end: string },
  discipline: Discipline
): ChartDataPoint[] {
  if (!dateRange.start || !dateRange.end) return [];

  return [
    {
      value: 0,
      label: formatDateLabel(dateRange.start),
      date: dateRange.start,
      rank: 'NC',
      isMilestone: false,
      discipline,
    },
    {
      value: 0,
      label: formatDateLabel(dateRange.end),
      date: dateRange.end,
      rank: 'NC',
      isMilestone: false,
      discipline,
    },
  ];
}

// ============================================================
// Main Transformation
// ============================================================

/**
 * Transform raw FFBaD ranking evolution API response into chart-ready data.
 *
 * Groups items by discipline, sorts by date, detects milestones, and computes
 * date range and value bounds. Missing disciplines get empty point arrays
 * (caller can use buildFlatLineForNC to fill them).
 *
 * @param rawData - Array of raw API response items (Record<string, unknown>)
 * @returns ChartData with all three disciplines (even if some have no data)
 */
export function transformEvolutionData(
  rawData: Array<Record<string, unknown>>
): ChartData {
  // Group by discipline
  const grouped: Record<Discipline, ChartDataPoint[]> = {
    simple: [],
    double: [],
    mixte: [],
  };

  for (const item of rawData) {
    const discipline = parseDiscipline(item.Discipline as string | undefined);
    const dateStr = (item.Date as string) ?? '';
    const rank = (item.Classement as string) ?? 'NC';

    const point: ChartDataPoint = {
      value: rankToValue(rank),
      label: formatDateLabel(dateStr),
      date: dateStr,
      rank,
      isMilestone: false,
      discipline: discipline ?? 'simple', // Default to simple if no discipline field
    };

    if (discipline) {
      grouped[discipline].push(point);
    } else {
      // If no discipline field, add to all groups (API might return undifferentiated data)
      // But only if there's actual data (non-NC rank)
      if (rankToValue(rank) > 0) {
        grouped.simple.push({ ...point, discipline: 'simple' });
      }
    }
  }

  // Sort each discipline by date chronologically
  const sortByDate = (a: ChartDataPoint, b: ChartDataPoint) => {
    const dateA = parseDate(a.date).getTime();
    const dateB = parseDate(b.date).getTime();
    return dateA - dateB;
  };

  for (const key of Object.keys(grouped) as Discipline[]) {
    grouped[key].sort(sortByDate);
  }

  // Detect milestones for each discipline
  const disciplineData: DisciplineChartData[] = (['simple', 'double', 'mixte'] as Discipline[]).map(
    (discipline) => {
      const points = grouped[discipline];
      const milestones = detectMilestones(points);
      return {
        discipline,
        color: DISCIPLINE_COLORS[discipline],
        points,
        milestones,
        visible: true,
      };
    }
  );

  // Compute date range across all disciplines
  const allDates = rawData
    .map((item) => (item.Date as string) ?? '')
    .filter((d) => d.length > 0)
    .map((d) => ({ str: d, time: parseDate(d).getTime() }))
    .filter((d) => d.time > 0)
    .sort((a, b) => a.time - b.time);

  const dateRange = {
    start: allDates.length > 0 ? allDates[0].str : '',
    end: allDates.length > 0 ? allDates[allDates.length - 1].str : '',
  };

  // Compute value bounds
  const allValues = disciplineData.flatMap((d) => d.points.map((p) => p.value));
  const positiveValues = allValues.filter((v) => v > 0);
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 0;
  const dataMin = positiveValues.length > 0 ? Math.min(...positiveValues) : 0;
  const maxValue = Math.min(dataMax + 1, 12);
  const minValue = Math.max((dataMin > 0 ? dataMin : 0) - 1, 0);

  return {
    disciplines: disciplineData,
    dateRange,
    maxValue,
    minValue,
  };
}

// ============================================================
// Extend to Today
// ============================================================

/**
 * Extend chart data lines to today's date by appending a point
 * at the current rank for each discipline. This ensures the chart
 * visually reaches the present day. Safe to call on cached data.
 */
export function extendChartToToday(data: ChartData): ChartData {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayLabel = formatDateLabel(todayStr);
  const todayTime = now.getTime();

  const disciplines = data.disciplines.map((disc) => {
    const points = [...disc.points];
    if (points.length > 0) {
      const last = points[points.length - 1];
      // Only extend if the last point is more than 1 day old
      if (parseDate(last.date).getTime() < todayTime - 86400000) {
        points.push({
          value: last.value,
          label: todayLabel,
          date: todayStr,
          rank: last.rank,
          isMilestone: false,
          discipline: disc.discipline,
        });
      }
    }
    return { ...disc, points };
  });

  return {
    ...data,
    disciplines,
    dateRange: {
      start: data.dateRange.start,
      end: todayStr,
    },
  };
}
