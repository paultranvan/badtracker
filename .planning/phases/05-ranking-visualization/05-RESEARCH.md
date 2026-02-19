# Phase 5: Ranking Visualization - Research

**Researched:** 2026-02-19
**Domain:** React Native charting — line charts with multi-series, interactive legend, milestone markers
**Confidence:** HIGH

## Summary

Phase 5 adds visual line charts showing CPPH ranking progression over time with milestone markers for rank changes. The project already has the data layer scaffolded (`getRankingEvolution` in `ffbad.ts`, `RankingEvolutionSchema` in `schemas.ts`, and `RANK_BOUNDARIES` in `rankings.ts`), so the work is primarily: (1) expand the ranking evolution schema to handle per-discipline data, (2) create a data transformation hook, and (3) build the chart screen with interactive legend and milestone markers.

**Primary recommendation:** Use `react-native-gifted-charts` for the chart implementation. It uses react-native-svg (no Skia/Reanimated native dependencies), works seamlessly with Expo, provides multi-line `dataSet` support with per-line colors, built-in pointer/tooltip interactions, and custom data point label components for milestone markers. At 52+ data points this is well within SVG rendering comfort zone. Victory Native XL would deliver higher performance through Skia but adds three heavy peer dependencies (`@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`) that the project currently does not use — excessive dependency burden for a single chart screen.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Milestone markers displayed directly on the chart line (dots/pins at the exact point rank changed)
- Markers are non-interactive — no tap action, information is visible on the marker itself
- Each marker shows the new rank label reached (e.g., "P10"), not the full transition
- Show markers for both promotions AND demotions — full picture of rank changes
- All disciplines overlaid on the same chart as different colored lines
- Tappable legend to toggle individual discipline lines on/off
- NC (unranked) disciplines shown as a flat line at 0
- Milestone markers appear for all visible disciplines, color-coded to match their respective line

### Claude's Discretion
- Chart appearance: line style, colors per discipline, axis labels, grid lines, data point density
- Chart interactions: zoom, pan, tap data point for value tooltip, time range selection
- Chart library selection (react-native-chart-kit, victory-native, react-native-skia, etc.)
- Loading states and animation when chart renders
- How rank boundary lines (horizontal dotted lines showing P12/P11/P10 thresholds) are handled, if at all
- Time axis formatting and granularity

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RANK-02 | User can see a visual line chart of ranking/points evolution over time | react-native-gifted-charts LineChart with `dataSet` prop for multi-discipline overlay, pointer config for value tooltips |
| RANK-03 | User can see a timeline of ranking milestones (when they reached NC, P12, P10, etc.) | Custom `dataPointLabelComponent` on data points where rank changes, showing rank label text |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-gifted-charts | ^1.4.x | Line chart rendering | Pure JS + react-native-svg, no Skia/Reanimated needed, multi-line `dataSet` support, custom data point labels, pointer tooltips, works with Expo out of the box |
| react-native-svg | (peer dep) | SVG rendering engine | Already widely used in RN ecosystem, Expo compatible via `npx expo install` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-linear-gradient | ~14.x | Gradient fills under chart lines | Peer dependency of gifted-charts, needed if area chart fills are used |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-native-gifted-charts | victory-native (XL) | Higher perf via Skia, but adds 3 native dependencies (skia, reanimated, gesture-handler) — overkill for 52-point line chart |
| react-native-gifted-charts | react-native-chart-kit | Simpler but less customizable, no built-in multi-line `dataSet`, harder to add milestone markers |
| react-native-gifted-charts | react-native-wagmi-charts | Great for financial charts but focused on candlestick/single-line, not multi-line overlay |

**Installation:**
```bash
npx expo install react-native-svg react-native-gifted-charts expo-linear-gradient
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── utils/
│   └── rankingChart.ts      # Data transformation: API response → chart data points
├── hooks/
│   └── useRankingEvolution.ts  # Fetch + transform ranking evolution data
app/
└── (app)/
    └── ranking-chart.tsx      # Chart screen (outside tabs, navigated from dashboard)
```

### Pattern 1: DataSet Multi-Line Chart
**What:** Use the `dataSet` prop (not `data`/`data2`/`data3`) for clean multi-line rendering
**When to use:** Always — it's the scalable way to add N discipline lines
**Example:**
```typescript
// Source: react-native-gifted-charts docs - DataSet type
import { LineChart } from 'react-native-gifted-charts';

const dataSets = [
  {
    data: simplePoints,
    color: '#2563eb',        // Blue for Simple
    dataPointsColor: '#2563eb',
    hideDataPoints: true,     // Hide regular dots, show only milestones
    thickness: 2,
  },
  {
    data: doublePoints,
    color: '#16a34a',        // Green for Double
    dataPointsColor: '#16a34a',
    hideDataPoints: true,
    thickness: 2,
  },
  {
    data: mixtePoints,
    color: '#d97706',        // Amber for Mixte
    dataPointsColor: '#d97706',
    hideDataPoints: true,
    thickness: 2,
  },
];

<LineChart
  dataSet={dataSets}
  // ... axis, pointer, styling props
/>
```

### Pattern 2: Milestone Markers via dataPointLabelComponent
**What:** Show rank label text at data points where rank changed
**When to use:** For milestone markers on the chart line
**Example:**
```typescript
// Each data point can have a custom label component
const dataPoint = {
  value: 25.5,    // CPPH value
  date: '2025-09',
  // Only show label on milestone points
  dataPointLabelComponent: () => (
    <View style={styles.milestoneMarker}>
      <Text style={styles.milestoneText}>P10</Text>
    </View>
  ),
  dataPointLabelShiftY: -20,
  customDataPoint: () => (
    <View style={[styles.milestoneDot, { backgroundColor: lineColor }]} />
  ),
};
```

### Pattern 3: Toggle Legend with State
**What:** Track which disciplines are visible via state, filter dataSets accordingly
**When to use:** For the tappable legend requirement
**Example:**
```typescript
const [visibleDisciplines, setVisibleDisciplines] = useState({
  simple: true,
  double: true,
  mixte: true,
});

const toggleDiscipline = (key: 'simple' | 'double' | 'mixte') => {
  setVisibleDisciplines(prev => ({ ...prev, [key]: !prev[key] }));
};

// Filter dataSets based on visibility
const activeSets = allDataSets.filter((_, i) => {
  const keys = ['simple', 'double', 'mixte'] as const;
  return visibleDisciplines[keys[i]];
});
```

### Pattern 4: Ranking Evolution Data Hook
**What:** Custom hook that fetches ranking evolution and transforms to chart format
**When to use:** In the chart screen component
**Example:**
```typescript
export function useRankingEvolution(licence: string) {
  // Fetch raw data
  // Transform into per-discipline arrays
  // Detect milestones (rank changes between consecutive points)
  // Return { chartData, milestones, isLoading, error, refresh }
}
```

### Anti-Patterns to Avoid
- **Re-rendering entire chart on legend toggle:** Use `useMemo` to recompute only the filtered dataSets
- **Storing chart data in multiple state variables:** Single state object for all discipline data
- **Hardcoding axis ranges:** Derive min/max from actual data with padding
- **Blocking render on data fetch:** Show skeleton/loading state while chart data loads

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line chart rendering | Custom SVG path generation | react-native-gifted-charts LineChart | Handles axes, scaling, touch, animation |
| Data point tooltips | Custom gesture + overlay positioning | gifted-charts `pointerConfig` | Built-in pointer strip with custom label component |
| SVG rendering | Custom native module | react-native-svg (peer dep) | Cross-platform, Expo compatible |
| Rank boundary detection | Manual CPPH comparison loops | Reuse existing `RANK_BOUNDARIES` + `getRankGaps` from rankings.ts | Already built and tested in Phase 3 |

**Key insight:** The chart library handles all the hard parts (coordinate mapping, axis generation, touch handling). Custom code is only needed for: data transformation, milestone detection, and the legend toggle UI.

## Common Pitfalls

### Pitfall 1: FFBaD API Response Shape Uncertainty
**What goes wrong:** The `RankingEvolutionSchema` is a stub with `Date`, `Classement`, `Points` — actual API may return different field names or structure
**Why it happens:** FFBaD API fields are not officially documented; previous phases discovered field names empirically
**How to avoid:** Use `.passthrough()` on the schema (already done), try multiple field name variants, graceful fallback if fields missing
**Warning signs:** Empty chart data despite successful API call

### Pitfall 2: Missing Per-Discipline Breakdown in Evolution API
**What goes wrong:** The ranking evolution API may return a flat list without discipline separation
**Why it happens:** API might return overall ranking or only one discipline at a time
**How to avoid:** Check if API supports discipline parameter; if not, may need to call multiple times or derive from match results. Fall back to showing only the disciplines with data available.
**Warning signs:** Only one line showing when user expects three

### Pitfall 3: Overcrowded Milestone Markers
**What goes wrong:** Too many rank changes in a short time period cause overlapping labels
**Why it happens:** A player might fluctuate between ranks frequently
**How to avoid:** Only show milestones at "sustained" rank changes, or reduce marker density when points are close together. At minimum, ensure milestone text doesn't overlap by checking spacing.
**Warning signs:** Unreadable chart with overlapping text

### Pitfall 4: NC Flat Line at 0 Distorting Y-Axis
**What goes wrong:** If one discipline is NC (value 0) and another is P10 (value 25+), the chart auto-scales and the interesting data gets compressed at the top
**Why it happens:** Large range between 0 and actual values
**How to avoid:** Consider using a minimum Y-axis value that still shows the 0 line but doesn't compress the data range excessively. Or use `yAxisOffset` to start Y-axis at a reasonable value while showing the flat line at bottom.
**Warning signs:** All non-NC lines bunched at top of chart

### Pitfall 5: Date Parsing and Sorting
**What goes wrong:** Data points appear in wrong order or axis labels display incorrectly
**Why it happens:** FFBaD dates may be in DD/MM/YYYY format (French), not ISO
**How to avoid:** Parse dates explicitly, sort chronologically before passing to chart, format axis labels with French locale
**Warning signs:** Chart line going back and forth instead of left-to-right progression

## Code Examples

### Multi-Line Chart with Milestone Markers
```typescript
// Source: react-native-gifted-charts docs + project patterns
import { LineChart } from 'react-native-gifted-charts';

interface ChartPoint {
  value: number;
  label?: string;  // X-axis label (date)
  dataPointLabelComponent?: () => React.ReactNode;
  dataPointLabelShiftY?: number;
  customDataPoint?: () => React.ReactNode;
  showDataPoint?: boolean;
}

// Transform API data to chart points with milestones
function buildChartPoints(
  evolution: Array<{ date: string; cpph: number; rank: string }>,
  color: string
): ChartPoint[] {
  return evolution.map((item, index) => {
    const prevRank = index > 0 ? evolution[index - 1].rank : null;
    const isMilestone = prevRank !== null && prevRank !== item.rank;

    const point: ChartPoint = {
      value: item.cpph,
      label: formatDateLabel(item.date),
    };

    if (isMilestone) {
      point.showDataPoint = true;
      point.dataPointLabelComponent = () => (
        <View style={{
          backgroundColor: color,
          borderRadius: 4,
          paddingHorizontal: 4,
          paddingVertical: 2,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
            {item.rank}
          </Text>
        </View>
      );
      point.dataPointLabelShiftY = -20;
    }

    return point;
  });
}
```

### Pointer/Tooltip Configuration
```typescript
// Source: react-native-gifted-charts pointerConfig
const pointerConfig = {
  pointerStripHeight: 200,
  pointerStripColor: '#e5e7eb',
  pointerStripWidth: 1,
  pointerColor: '#6b7280',
  radius: 5,
  pointerLabelWidth: 120,
  pointerLabelHeight: 70,
  pointerLabelComponent: (items: Array<{ value: number }>) => (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    }}>
      <Text style={{ fontWeight: '600', fontSize: 14 }}>
        {items[0]?.value.toFixed(1)} pts
      </Text>
    </View>
  ),
};
```

### Tappable Legend Component
```typescript
function ChartLegend({
  visible,
  onToggle,
}: {
  visible: Record<'simple' | 'double' | 'mixte', boolean>;
  onToggle: (key: 'simple' | 'double' | 'mixte') => void;
}) {
  const items = [
    { key: 'simple' as const, color: '#2563eb', label: 'Simple' },
    { key: 'double' as const, color: '#16a34a', label: 'Double' },
    { key: 'mixte' as const, color: '#d97706', label: 'Mixte' },
  ];

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
      {items.map(({ key, color, label }) => (
        <Pressable
          key={key}
          onPress={() => onToggle(key)}
          style={{ flexDirection: 'row', alignItems: 'center', opacity: visible[key] ? 1 : 0.4 }}
        >
          <View style={{
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: color, marginRight: 6,
          }} />
          <Text style={{ fontSize: 13, color: '#374151' }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-native-chart-kit (SVG) | react-native-gifted-charts or victory-native-xl | 2023-2024 | More customizable, better multi-line support, active maintenance |
| victory-native (old SVG version) | victory-native-xl (Skia + Reanimated) | 2023 | Much better performance for large datasets, but heavier deps |
| Manual SVG paths | Library-provided components | Always | Don't hand-roll chart rendering |

**Deprecated/outdated:**
- react-native-chart-kit: Last meaningful update 2021, limited multi-line support
- Original victory-native (non-XL): Migrated to XL, old version uses slow SVG updates

## Open Questions

1. **FFBaD Ranking Evolution API Response Structure**
   - What we know: Schema stub exists (`RankingEvolutionSchema`) with `Date`, `Classement`, `Points` fields
   - What's unclear: Does the API return per-discipline data in one call, or must we call per discipline? Does `Points` mean CPPH? What date format?
   - Recommendation: Build the data hook to handle both cases (single response with discipline field, or multiple calls). Use `.passthrough()` and test with real API response. Log the raw response for inspection.

2. **Data Volume for 52+ Weeks**
   - What we know: react-native-gifted-charts handles SVG rendering well for hundreds of points
   - What's unclear: How much historical data FFBaD actually returns
   - Recommendation: No concern — 52 points per discipline (156 total) is trivially handled by SVG. Use `useMemo` for data transformations to prevent unnecessary recalculation.

## Sources

### Primary (HIGH confidence)
- Context7 `/formidablelabs/victory-native-xl` — CartesianChart, Line, multi-press tooltip examples
- Context7 `/abhinandan-kushwaha/react-native-gifted-charts` — DataSet type, multi-line rendering, pointerConfig, custom data point labels
- Existing project code: `src/api/schemas.ts` (RankingEvolutionSchema), `src/api/ffbad.ts` (getRankingEvolution), `src/utils/rankings.ts` (RANK_BOUNDARIES)

### Secondary (MEDIUM confidence)
- [npm trends: react-native-gifted-charts vs victory-native](https://npmtrends.com/react-native-gifted-charts-vs-victory-native)
- [Expo SDK 54 react-native-reanimated docs](https://docs.expo.dev/versions/latest/sdk/reanimated/) — Reanimated v4 with SDK 54
- [Expo SDK 54 upgrade guide](https://expo.dev/blog/expo-sdk-upgrade-guide)
- [LogRocket top RN chart libraries 2025](https://blog.logrocket.com/top-react-native-chart-libraries/)

### Tertiary (LOW confidence)
- None — all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-native-gifted-charts is well-documented, actively maintained, Expo-compatible, no native deps beyond react-native-svg
- Architecture: HIGH — follows established project patterns (hooks, utils, route structure), existing data layer scaffolded
- Pitfalls: MEDIUM — FFBaD API response shape is the main uncertainty, but `.passthrough()` pattern is proven from Phases 2-4

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — stable domain, library APIs unlikely to change)
