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
  value: number;          // CPPH value (0 for NC/unranked)
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
 * Parse a CPPH value from the API response.
 * Returns 0 if undefined, null, or NaN (chart-friendly default for NC).
 *
 * Similar to parseCpph in src/api/ffbad.ts but returns 0 instead of undefined
 * since charts need numeric values for all data points.
 */
export function parseCpphValue(value: string | number | undefined): number {
  if (value == null) return 0;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? 0 : num;
}

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
    // Try Points first, then CPPH — API field names may vary
    const cpph = parseCpphValue(
      (item.Points as string | number | undefined) ??
      (item.CPPH as string | number | undefined)
    );

    const point: ChartDataPoint = {
      value: cpph,
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
      // But only if there's actual data (non-zero CPPH)
      if (cpph > 0) {
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
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;

  return {
    disciplines: disciplineData,
    dateRange,
    maxValue,
    minValue,
  };
}
